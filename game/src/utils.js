// Small math and random helpers shared by every Solano Heat module.
// Nothing here knows about the game itself: pure functions only.

export const TAU = Math.PI * 2;

/** Clamp a value into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** A random float in [min, max). */
export function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

/** A random integer in [min, max]. */
export function randi(min, max) {
  return Math.floor(rand(min, max + 1));
}

/** One random element of an array. */
export function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Squared distance between two points (skip the sqrt when comparing). */
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Angle from (ax, ay) to (bx, by), in radians. */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle `from` toward angle `to`. */
export function angleDiff(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Move `angle` toward `target` by at most `step` radians. */
export function turnToward(angle, target, step) {
  const d = angleDiff(angle, target);
  if (Math.abs(d) <= step) return target;
  return angle + Math.sign(d) * step;
}

/** A deterministic random generator from one seed, for stable city props. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 hash of two integer coordinates, for per-block variety. */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}

/** Format dollars with a thousands separator: 12345 -> "$12,345". */
export function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Format a duration in seconds as m:ss. */
export function clock(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Format an in-game clock hour (0..24) as "14:20". */
export function timeOfDay(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
