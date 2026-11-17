// The law of Port Solano: a wanted system and the police who answer it.
// Heat rises with crime and falls when the player stays clean and out of
// sight; stars set how many police cars hunt her and how hard they push.

import { clamp, dist, rand } from './utils.js';
import { makeCar, nearestCar } from './vehicles.js';
import { nearestRoadPoint, onRoad } from './city.js';
import { shake } from './effects.js';

const STAR_HEAT = [0, 12, 30, 52, 74, 92];

/** Heat points that make each star level. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i <= 5; i++) if (heat >= STAR_HEAT[i]) stars = i;
  return stars;
}

export function makeWanted() {
  return {
    heat: 0,
    stars: 0,
    quietTimer: 0,      // seconds since the last crime
    hideTimer: 0,       // seconds hidden from every police unit
    flash: 0,
  };
}

/** Add heat for a crime, and mark the player as freshly guilty. */
export function addHeat(game, amount, crime) {
  const w = game.wanted;
  const before = w.stars;
  w.heat = clamp(w.heat + amount, 0, 100);
  w.stars = starsForHeat(w.heat);
  w.quietTimer = 0;
  w.hideTimer = 0;
  if (w.stars > before) {
    w.flash = 0.6;
    game.toast(`Wanted level ${w.stars} — the law is coming`, 'bad');
    game.audio.blip(520, 0.15, 'square', 0.15, 780);
  }
  if (crime) game.lastCrime = crime;
}

/** Per-frame wanted decay: cool off when clean and unseen. */
export function updateWanted(game, dt) {
  const w = game.wanted;
  w.quietTimer += dt;
  w.flash = Math.max(0, w.flash - dt);
  const policeNear = game.policeCars.some((c) => dist(c.x, c.y, game.player.x, game.player.y) < 520)
    || game.cops.some((c) => dist(c.x, c.y, game.player.x, game.player.y) < 420);
  // Hidden means no police unit close by, whatever the star count: the
  // heat has to be able to fall all the way to zero, not stop at the
  // one-star line.
  if (!policeNear) {
    w.hideTimer += dt;
  } else {
    w.hideTimer = 0;
  }
  if (w.quietTimer > 6 && w.hideTimer > 0 && w.heat > 0) {
    w.heat -= dt * (2.2 + w.hideTimer * 0.12);
    if (w.hideTimer > 14) w.heat -= dt * 4;
  }
  if (w.heat < 0) w.heat = 0;
  const stars = starsForHeat(w.heat);
  if (stars < w.stars) {
    w.stars = stars;
    if (stars === 0) game.toast('You lost them. The heat is off.', 'good');
  }
}

/** Spawn police cars at road edges off-screen, up to the wanted level. */
export function ensurePolice(game, dt) {
  const target = game.wanted.stars === 0 ? 0 : Math.min(2 + game.wanted.stars, 6);
  const px = game.player.x;
  const py = game.player.y;
  // Remove police that are far away and no longer wanted.
  game.policeCars = game.policeCars.filter((c) => {
    if (game.wanted.stars === 0 && dist(c.x, c.y, px, py) > 900) return false;
    return !c.dead;
  });
  game.cops = game.cops.filter((c) => !c.gone);
  if (game.policeCars.length >= target) return;
  // Spawn on a road, off-screen but not too far.
  for (let tries = 0; tries < 12 && game.policeCars.length < target; tries++) {
    const ang = rand(0, Math.PI * 2);
    const d = rand(850, 1150);
    const road = nearestRoadPoint(game.city, px + Math.cos(ang) * d, py + Math.sin(ang) * d);
    if (!road || !onRoad(game.city, road.x, road.y)) continue;
    if (dist(road.x, road.y, px, py) < 560) continue;
    const car = makeCar(road.x, road.y, Math.atan2(py - road.y, px - road.x), 'police');
    car.driver = 'police';
    car.siren = true;
    game.policeCars.push(car);
    game.cars.push(car);
  }
  // On foot, one or two officers give chase on the street.
  if (!game.player.onFoot && game.cops.length < 2 && game.wanted.stars >= 1 && Math.random() < dt * 0.5) {
    const ang = rand(0, Math.PI * 2);
    game.cops.push({
      x: px + Math.cos(ang) * 500, y: py + Math.sin(ang) * 500,
      angle: 0, speed: 190, grab: 0, gone: false,
    });
  }
}

/** Police car AI: chase the player, ram, and try to box her in. */
export function policeCarAI(game, car, dt) {
  const p = game.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const d = dist(car.x, car.y, tx, ty);
  // Chase speed grows with the wanted level: at one star a decent car
  // can outrun them, at five stars nothing can.
  const chaseMax = 280 + game.wanted.stars * 30;
  // Far away for too long and they give up the search.
  if (d > 1000) {
    car.search = (car.search || 0) + dt;
    if (car.search > 8) {
      car.dead = true;
      return;
    }
  } else {
    car.search = 0;
  }
  // Ease off when the player is far and the heat is low: they search.
  const desired = Math.atan2(ty - car.y, tx - car.x);
  const turnRate = 3.0;
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += clamp(diff, -turnRate * dt, turnRate * dt);
  const wantSpeed = d > 500 ? chaseMax : chaseMax * 0.92;
  car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Ram damage when touching the player's car.
  if (p.car && d < 46) {
    if (Math.abs(car.speed) > 60) {
      p.car.health -= 25 * dt;
      shake(game.effects, 0.12);
      if (Math.random() < dt * 2) game.audio.crash(0.6);
    }
    // Shove the player's car a little.
    p.car.x += Math.cos(car.angle) * 26 * dt;
    p.car.y += Math.sin(car.angle) * 26 * dt;
  }
  // On foot, a police car that catches up spills two officers out.
  if (p.onFoot && d < 60 && game.cops.length < 3 && Math.random() < dt * 0.8) {
    game.cops.push({ x: car.x, y: car.y, angle: 0, speed: 195, grab: 0, gone: false });
    car.speed = 0;
  }
}

/** On-foot officers: run at the player and hold her to bust her. */
export function updateCops(game, dt) {
  const p = game.player;
  for (const cop of game.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (p.onFoot && !p.dead) {
      const ang = Math.atan2(p.y - cop.y, p.x - cop.x);
      cop.angle = ang;
      cop.x += Math.cos(ang) * cop.speed * dt;
      cop.y += Math.sin(ang) * cop.speed * dt;
      if (d < 30) {
        cop.grab += dt;
        if (cop.grab > 0.9) {
          game.busted();
          return;
        }
      } else {
        cop.grab = 0;
      }
      if (d > 1100) cop.gone = true;
    } else {
      // Player is in a car: officers give up and walk off.
      cop.gone = true;
    }
  }
  game.cops = game.cops.filter((c) => !c.gone);
}

/** Clear the wanted level at a Spray & Go, for cash. */
export function tryPaynspray(game) {
  const p = game.player;
  if (!p.car) return false;
  for (const key of ['paynspray1', 'paynspray2']) {
    const s = game.city.places[key];
    if (dist(p.car.x, p.car.y, s.x, s.y) < 90) {
      if (game.wanted.stars === 0) {
        game.toast('No heat to lose — the paint is already clean.', 'info');
        return true;
      }
      if (p.money < 200) {
        game.toast('Spray & Go costs $200. You are short.', 'bad');
        return true;
      }
      p.money -= 200;
      p.car.health = 100;
      p.car.color = '#3a6ea5';
      game.wanted.heat = 0;
      game.wanted.stars = 0;
      game.policeCars = [];
      game.cops = [];
      game.toast('Fresh paint, clean record. Heat gone — $200.', 'good');
      game.audio.cash();
      return true;
    }
  }
  return false;
}
