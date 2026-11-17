// Juice: particles, skid marks, floating cash text and screen shake.
// Nothing here changes the game state; it only makes it look alive.

import { clamp, rand } from './utils.js';

export function makeEffects() {
  return {
    particles: [],
    skids: [],
    floats: [],
    shakeTime: 0,
    shakeMag: 0,
  };
}

export function shake(effects, mag) {
  effects.shakeTime = 0.35;
  effects.shakeMag = Math.max(effects.shakeMag, mag);
}

/** A burst of sparks, smoke or blood. */
export function burst(effects, x, y, color, count = 10, speed = 160, life = 0.5, size = 3) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(speed * 0.3, speed);
    effects.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: rand(life * 0.5, life), maxLife: life,
      color, size: rand(size * 0.6, size * 1.4),
    });
  }
}

export function smoke(effects, x, y, count = 2) {
  for (let i = 0; i < count; i++) {
    effects.particles.push({
      x: x + rand(-6, 6), y: y + rand(-6, 6),
      vx: rand(-12, 12), vy: rand(-34, -12),
      life: rand(0.6, 1.1), maxLife: 1.1,
      color: 'rgba(120,120,120,0.5)', size: rand(5, 10),
    });
  }
}

/** A skid mark segment under a drifting car. */
export function skid(effects, x, y, angle) {
  effects.skids.push({ x, y, angle, life: 6 });
  if (effects.skids.length > 400) effects.skids.splice(0, effects.skids.length - 400);
}

/** Floating text that rises and fades ("+$400", "WASTED"...). */
export function floatText(effects, x, y, text, color = '#fff') {
  effects.floats.push({ x, y, text, color, life: 1.4 });
}

export function updateEffects(effects, dt) {
  for (const p of effects.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  effects.particles = effects.particles.filter((p) => p.life > 0);
  for (const s of effects.skids) s.life -= dt;
  effects.skids = effects.skids.filter((s) => s.life > 0);
  for (const f of effects.floats) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  effects.floats = effects.floats.filter((f) => f.life > 0);
  effects.shakeTime = Math.max(0, effects.shakeTime - dt);
  if (effects.shakeTime <= 0) effects.shakeMag = 0;
}

/** Current shake offset for the camera. */
export function shakeOffset(effects) {
  if (effects.shakeTime <= 0) return { x: 0, y: 0 };
  const m = effects.shakeMag * clamp(effects.shakeTime / 0.35, 0, 1);
  return { x: rand(-m, m), y: rand(-m, m) };
}
