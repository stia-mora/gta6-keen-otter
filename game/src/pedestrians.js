// Pedestrians of Port Solano: they stroll the sidewalks, chat in pairs,
// and run when a gun goes off or a car comes at them. A few of them wait
// at taxi stands with their hand up.

import { clamp, dist, rand, randi } from './utils.js';
import { collideCircle, nearestRoadPoint } from './city.js';

const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRT = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];

export function makePed(x, y) {
  return {
    x, y,
    angle: rand(0, Math.PI * 2),
    speed: rand(28, 52),
    skin: SKIN[randi(0, SKIN.length - 1)],
    shirt: SHIRT[randi(0, SHIRT.length - 1)],
    target: null,
    state: 'walk',   // walk | flee | wait | down
    fear: 0,
    waitTimer: 0,
    taxi: false,     // waiting for a taxi
    down: false,
    bob: rand(0, 10),
  };
}

/** Pick a nearby sidewalk point to walk to. */
function pickWalkTarget(city, ped) {
  const road = nearestRoadPoint(city, ped.x, ped.y);
  const side = Math.random() < 0.5 ? -1 : 1;
  const along = rand(-260, 260);
  // Offset just off the road edge, then along it.
  const vertical = Math.abs(road.x - ped.x) < Math.abs(road.y - ped.y);
  let tx;
  let ty;
  if (vertical) {
    tx = road.x + side * 64;
    ty = road.y + along;
  } else {
    tx = road.x + along;
    ty = road.y + side * 64;
  }
  return {
    x: clamp(tx, 20, city.W - 20),
    y: clamp(ty, 20, city.H - 20),
  };
}

/** Spawn `count` pedestrians around the city, away from a point. */
export function spawnPeds(city, count, avoidX, avoidY, avoidR = 300) {
  const peds = [];
  let tries = 0;
  while (peds.length < count && tries < count * 30) {
    tries++;
    const x = rand(120, city.W - 120);
    const y = rand(120, city.H - 120);
    if (dist(x, y, avoidX, avoidY) < avoidR) continue;
    const p = makePed(x, y);
    p.target = pickWalkTarget(city, p);
    peds.push(p);
  }
  return peds;
}

/** Scare every pedestrian near (x, y): they flee from the danger. */
export function scarePeds(peds, x, y, radius, amount = 1) {
  for (const p of peds) {
    if (p.down) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.fear = Math.max(p.fear, amount);
      p.target = {
        x: clamp(p.x + (p.x - x) * 2, 20, 3800),
        y: clamp(p.y + (p.y - y) * 2, 20, 2840),
      };
    }
  }
}

export function updatePeds(city, peds, dt, danger) {
  for (const p of peds) {
    if (p.down) continue;
    p.bob += dt * 8;
    if (p.state === 'wait') {
      p.waitTimer += dt;
      continue;
    }
    if (!p.target || dist(p.x, p.y, p.target.x, p.target.y) < 14) {
      if (p.state === 'flee') {
        p.state = 'walk';
        p.fear = 0;
      }
      p.target = pickWalkTarget(city, p);
    }
    const speed = p.state === 'flee' ? p.speed * 2.6 : p.speed;
    const ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
    p.angle = ang;
    p.x += Math.cos(ang) * speed * dt;
    p.y += Math.sin(ang) * speed * dt;
    const fixed = collideCircle(city, p.x, p.y, 10);
    p.x = fixed.x;
    p.y = fixed.y;
    if (danger && dist(p.x, p.y, danger.x, danger.y) < danger.r) {
      scarePeds([p], danger.x, danger.y, danger.r, 1);
    }
  }
}
