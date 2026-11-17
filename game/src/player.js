// Mara Reyes, the player: on foot she walks, runs, punches and shoots;
// in a car she is the driver. Her state is the game's centre of gravity:
// health, cash, weapon, wanted heat and the car she is in, if any.

import { clamp, dist } from './utils.js';
import { collideCircle } from './city.js';
import { nearestCar } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    radius: 13,
    health: 100,
    maxHealth: 100,
    armor: 0,
    money: 250,
    onFoot: true,
    car: null,
    weapon: 'fists',   // fists | pistol
    ammo: 0,
    punchTimer: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    runStamina: 1,
    hurtFlash: 0,
    dead: false,
    // Stats the save file and the end screen show.
    stats: { carsStolen: 0, missionsDone: 0, taxisDone: 0, cashEarned: 0, shotsFired: 0 },
  };
}

/** Damage the player, armor first. Returns true when she is wasted. */
export function hurtPlayer(player, amount) {
  if (player.dead) return true;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  player.hurtFlash = 0.35;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, player.maxHealth);
}

export function giveCash(player, amount) {
  player.money += amount;
  player.stats.cashEarned += amount;
}

/** Move on foot: WASD, Shift to run, collide with buildings and water. */
export function updateOnFoot(game, dt) {
  const { player, input, city } = game;
  const mv = input.moveVector();
  const running = input.down('ShiftLeft', 'ShiftRight') && player.runStamina > 0.1;
  const speed = running ? 265 : 165;
  if (mv.x !== 0 || mv.y !== 0) {
    player.angle = Math.atan2(mv.y, mv.x);
    player.x += mv.x * speed * dt;
    player.y += mv.y * speed * dt;
    const fixed = collideCircle(city, player.x, player.y, player.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    player.runStamina = clamp(player.runStamina - (running ? dt * 0.12 : 0), 0, 1);
  } else {
    player.runStamina = clamp(player.runStamina + dt * 0.25, 0, 1);
  }
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  // Aim at the mouse when armed with the pistol.
  if (player.weapon === 'pistol') {
    const wx = game.camera.x + input.mouseX;
    const wy = game.camera.y + input.mouseY;
    player.angle = Math.atan2(wy - player.y, wx - player.x);
  }
}

/** Try to enter the nearest car (E). Returns the car or null. */
export function tryEnterCar(game) {
  const { player, cars } = game;
  const car = nearestCar(cars, player.x, player.y, 64);
  if (!car) return null;
  if (car.kind === 'police') return null;
  const wasOccupied = car.occupied;
  player.car = car;
  player.onFoot = false;
  car.driver = 'player';
  car.occupied = true;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  game.audio.door();
  return { car, stolen: wasOccupied };
}

/** Step out of the car (E) beside it. */
export function exitCar(game) {
  const { player, city } = game;
  const car = player.car;
  if (!car) return;
  car.driver = 'none';
  car.speed = 0;
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 30, y: car.y + Math.sin(car.angle + Math.PI / 2) * 30 };
  const fixed = collideCircle(city, side.x, side.y, player.radius);
  player.x = fixed.x;
  player.y = fixed.y;
  player.angle = car.angle;
  player.car = null;
  player.onFoot = true;
  game.audio.door();
}

/** The nearest pedestrian in front of the player, within punch range. */
export function punchTarget(game) {
  const { player, peds } = game;
  let best = null;
  let bestD = 46;
  for (const p of peds) {
    if (p.down) continue;
    const d = dist(player.x, player.y, p.x, p.y);
    if (d < bestD) {
      const ang = Math.atan2(p.y - player.y, p.x - player.x);
      let diff = Math.abs(ang - player.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 1.1) { bestD = d; best = p; }
    }
  }
  return best;
}
