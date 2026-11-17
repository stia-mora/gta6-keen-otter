// Cars of Port Solano: arcade physics, traffic that drives the road
// graph, and the shapes every car on the street is drawn from. A car is
// a small state machine: parked, driven by traffic, driven by the player,
// or driven by the police.

import { clamp, choice, dist, rand, turnToward } from './utils.js';
import { collideCircle, nodeNeighbours, randomNode, nearestRoadPoint, onRoad } from './city.js';

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f39c12', '#27ae60', '#8e44ad', '#e67e22',
  '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#b03a2e',
];
export const TAXI_COLOR = '#f1c40f';
export const POLICE_COLOR = '#1a1a2e';

let nextCarId = 1;

/** Make a car at a position, facing an angle. `kind` is 'civilian', 'taxi' or 'police'. */
export function makeCar(x, y, angle, kind = 'civilian') {
  const color = kind === 'police' ? POLICE_COLOR
    : kind === 'taxi' ? TAXI_COLOR
    : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  return {
    id: nextCarId++,
    kind,
    x, y, angle,
    speed: 0,
    maxSpeed: kind === 'police' ? 430 : rand(300, 360),
    accel: kind === 'police' ? 300 : 220,
    steer: 0,
    health: 100,
    color,
    driver: kind === 'police' ? 'police' : 'traffic',
    target: null,      // traffic: next intersection node
    stuck: 0,
    honk: 0,
    brakeLight: false,
    siren: false,
    smoke: 0,
    dead: false,
    occupied: kind !== 'police',
    // Player-stealable cars start with a driver only when occupied.
  };
}

/** One physics step for a car driven by inputs: throttle -1..1, steer -1..1. */
export function driveCarPhysics(car, throttle, steer, dt, handbrake) {
  const grip = handbrake ? 0.94 : 0.985;
  car.speed += throttle * car.accel * dt;
  if (throttle === 0) car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -car.maxSpeed * 0.45, car.maxSpeed);
  if (handbrake) car.speed *= Math.pow(0.25, dt);
  const turnRate = 2.6 * clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * turnRate * dt;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.speed *= grip;
  car.brakeLight = throttle < 0 || handbrake;
}

/** Keep a car out of buildings and water, and slow it on impact. */
export function collideCar(city, car) {
  const before = { x: car.x, y: car.y };
  const fixed = collideCircle(city, car.x, car.y, 20);
  const hit = fixed.x !== car.x || fixed.y !== car.y;
  car.x = fixed.x;
  car.y = fixed.y;
  if (hit) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    if (impact > 120) {
      car.health -= impact * 0.04;
      return impact;
    }
  }
  return 0;
}

/** Traffic AI: drive to the next node, pick a random neighbour there. */
export function trafficAI(car, city, cars, dt) {
  if (!car.target) car.target = randomNode(city);
  const t = car.target;
  const d = dist(car.x, car.y, t.x, t.y);
  if (d < 26) {
    const next = nodeNeighbours(city, t);
    car.target = next.length ? choice(next) : randomNode(city);
    return;
  }
  // Slow down for a car stopped ahead in the same direction.
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26 && Math.abs(other.speed) < 40) { blocked = true; break; }
  }
  const desired = Math.atan2(t.y - car.y, t.x - car.x);
  const turn = turnToward(car.angle, desired, 2.2 * dt);
  const steer = clamp((turn - car.angle) / 0.1, -1, 1);
  // Ease off near the node: a slower car turns tighter and stays on the
  // road instead of swinging wide through the block corner (and the park).
  const throttle = blocked ? 0 : d < 160 ? 0.35 : 0.75;
  driveCarPhysics(car, throttle, steer, dt, false);
  // Guardrail: a traffic car that drifts off the road is pulled back to
  // the nearest road centreline, so wide turns never cut a park corner.
  if (!onRoad(city, car.x, car.y)) {
    const road = nearestRoadPoint(city, car.x, car.y);
    const dx = road.x - car.x;
    const dy = road.y - car.y;
    const rd = Math.hypot(dx, dy);
    if (rd > 1) {
      const pull = Math.min(rd, 140 * dt);
      car.x += (dx / rd) * pull;
      car.y += (dy / rd) * pull;
    }
  }
  if (Math.abs(car.speed) < 8 && d > 40) {
    car.stuck += dt;
    if (car.stuck > 4) {
      car.target = randomNode(city);
      car.stuck = 0;
    }
  } else {
    car.stuck = 0;
  }
}

/** Spawn `count` traffic cars on roads, away from a point. */
export function spawnTraffic(city, count, avoidX, avoidY, avoidR = 400) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 40) {
    tries++;
    // Pick a road and a lane on it, so no car ever starts inside a building.
    const vertical = Math.random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      const rx = choice(city.roadsX);
      x = rx + (Math.random() < 0.5 ? -20 : 20);
      y = rand(120, city.H - 120);
      angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = choice(city.roadsY);
      y = ry + (Math.random() < 0.5 ? -20 : 20);
      x = rand(120, city.W - 120);
      angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    if (dist(x, y, avoidX, avoidY) < avoidR) continue;
    if (cars.some((c) => dist(c.x, c.y, x, y) < 90)) continue;
    const car = makeCar(x, y, angle, Math.random() < 0.12 ? 'taxi' : 'civilian');
    car.speed = rand(60, 160);
    cars.push(car);
  }
  return cars;
}

/** A parked car on a roadside, for the player to steal. */
export function spawnParkedCar(city, x, y, angle) {
  const car = makeCar(x, y, angle, 'civilian');
  car.driver = 'none';
  car.occupied = false;
  return car;
}

/** The nearest car to a point within `range`, or null. */
export function nearestCar(cars, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of cars) {
    if (car.dead) continue;
    const d = dist(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
