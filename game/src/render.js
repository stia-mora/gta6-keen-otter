// How Port Solano looks: a sun-soaked top-down city drawn on one canvas.
// Roads with dashes and crosswalks, buildings with shadows and windows,
// water, sand, parks, cars with headlights and brake lights, and the
// little people walking the sidewalks.

import { clamp, hash2 } from './utils.js';
import { ROAD_W, WORLD_W, WORLD_H } from './city.js';

export function makeCamera() {
  return { x: 0, y: 0, w: 1280, h: 800, zoom: 1 };
}

/** Follow a point smoothly, clamped to the world. */
export function updateCamera(cam, tx, ty, dt) {
  const wantX = clamp(tx - cam.w / 2, 0, WORLD_W - cam.w);
  const wantY = clamp(ty - cam.h / 2, 0, WORLD_H - cam.h);
  const k = Math.min(1, dt * 5);
  cam.x += (wantX - cam.x) * k;
  cam.y += (wantY - cam.y) * k;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRoads(ctx, city, cam) {
  const half = ROAD_W / 2;
  ctx.fillStyle = '#33363d';
  for (const x of city.roadsX) ctx.fillRect(x - half, 0, ROAD_W, WORLD_H);
  for (const y of city.roadsY) ctx.fillRect(0, y - half, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (const x of city.roadsX) {
    for (let y = 0; y < WORLD_H; y += 64) {
      if (city.roadsY.some((ry) => Math.abs(y - ry) < 60)) continue;
      ctx.fillRect(x - 2, y, 4, 30);
    }
  }
  for (const y of city.roadsY) {
    for (let x = 0; x < WORLD_W; x += 64) {
      if (city.roadsX.some((rx) => Math.abs(x - rx) < 60)) continue;
      ctx.fillRect(x, y - 2, 30, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(230,230,220,0.75)';
  for (const x of city.roadsX) {
    for (const y of city.roadsY) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(x - 34 + i * 14, y - half + 6, 7, 18);
        ctx.fillRect(x - 34 + i * 14, y + half - 24, 7, 18);
      }
    }
  }
}

function drawBuildings(ctx, city) {
  for (const b of city.buildings) {
    // Long shadow to the south-east: the afternoon sun is low and warm.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 12, b.y + 15, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Sunlit top edge.
    ctx.fillStyle = 'rgba(255,240,200,0.35)';
    ctx.fillRect(b.x, b.y, b.w, 4);
    // Roof inset and windows.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,220,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (hash2(b.seed + i * 7, b.seed + j * 13) < 0.45) {
          ctx.fillRect(b.x + 11 + i * 34, b.y + 11 + j * 34, 16, 14);
        }
      }
    }
    // Rooftop clutter, keyed by the building's seed so it never moves.
    const kind = hash2(b.seed, 99);
    if (b.height >= 3 && kind < 0.35) {
      // Water tower: legs and a tank.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w / 2 - 10, b.y + b.h / 2 - 6, 20, 16);
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2 - 8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 22, 24, 8);
    } else if (kind < 0.6) {
      // Air-conditioning boxes.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 14, b.y + 14, 18, 12);
      ctx.fillRect(b.x + b.w - 32, b.y + b.h - 26, 18, 12);
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(b.x + 12, b.y + 12, 18, 12);
      ctx.fillRect(b.x + b.w - 34, b.y + b.h - 28, 18, 12);
    } else if (kind < 0.8) {
      // Rooftop garden: a green patch with two shrubs.
      ctx.fillStyle = '#4a8a3f';
      ctx.fillRect(b.x + b.w / 2 - 22, b.y + b.h / 2 - 12, 44, 24);
      ctx.fillStyle = '#5da244';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2 - 10, b.y + b.h / 2, 7, 0, Math.PI * 2);
      ctx.arc(b.x + b.w / 2 + 12, b.y + b.h / 2 + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // The tallest towers get an antenna with a red tip.
    if (b.height >= 5) {
      ctx.strokeStyle = 'rgba(30,30,40,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, b.y + 6);
      ctx.lineTo(b.x + b.w / 2, b.y - 22);
      ctx.stroke();
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y - 24, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-21, -11 + 4, 44, 24);
  // Light-bar glow first, so it spills onto the street around the car.
  if (car.kind === 'police') {
    const phase = Math.floor(time * 5) % 2 === 0;
    const glowColor = phase ? 'rgba(255,42,42,0.5)' : 'rgba(42,107,255,0.5)';
    const glow = ctx.createRadialGradient(0, -8, 2, 0, -8, 62);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -8, 62, 0, Math.PI * 2);
    ctx.fill();
    // A wash of the flashing colour on the road under the car.
    ctx.fillStyle = phase ? 'rgba(255,42,42,0.16)' : 'rgba(42,107,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Body: black-and-white for the police, the car's own colour otherwise.
  if (car.kind === 'police') {
    ctx.fillStyle = '#f0f0ea';
    roundRect(ctx, -22, -12, 44, 24, 7);
    ctx.fill();
    // Black hood and trunk, white doors.
    ctx.fillStyle = '#15151f';
    ctx.fillRect(-22, -12, 11, 24);
    ctx.fillRect(11, -12, 11, 24);
    // Roof and windshield.
    ctx.fillStyle = '#15151f';
    roundRect(ctx, -6, -10, 16, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,235,0.9)';
    ctx.fillRect(9, -10, 4, 20);
    ctx.fillRect(-18, -10, 3, 20);
    // POLICE down the white door band.
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 2);
    // Light bar: red one side, blue the other, swapping every blink.
    const blink = Math.floor(time * 5) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-14, -15, 11, 6);
    ctx.fillStyle = blink ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(3, -15, 11, 6);
    ctx.fillStyle = '#ddd';
    ctx.fillRect(-3, -15, 6, 6);
  } else {
    ctx.fillStyle = car.color;
    roundRect(ctx, -22, -12, 44, 24, 7);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(ctx, -6, -10, 16, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,235,0.9)';
    ctx.fillRect(9, -10, 4, 20);
    ctx.fillRect(-18, -10, 3, 20);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  // Headlights and brake lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(20, -10, 3, 5);
  ctx.fillRect(20, 5, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff2222' : '#7a1a1a';
  ctx.fillRect(-23, -10, 3, 5);
  ctx.fillRect(-23, 5, 3, 5);
  // Smoke when wrecked.
  if (car.health < 40 && Math.random() < 0.3) {
    ctx.restore();
    return 'smoke';
  }
  ctx.restore();
  return null;
}

function drawPed(ctx, p) {
  const bob = Math.sin(p.bob) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  if (p.down) {
    ctx.rotate(Math.PI / 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 2, Math.sin(p.angle) * 2 - 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mara: red jacket, dark jeans, the one person who matters.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c2c34';
  ctx.beginPath();
  ctx.arc(5, -2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // Pistol in hand.
  if (player.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
  }
  // Punch arc.
  if (player.punchTimer > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(14, 0, 12, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
  // Muzzle flash.
  if (player.shootCooldown > 0.22) {
    ctx.save();
    ctx.translate(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(0, 0, 7 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Draw the whole world for one frame. */
export function renderWorld(ctx, game) {
  const { city, camera, effects } = game;
  const cam = camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Ground: warm grass base, sand in the south, water in the east/south.
  ctx.fillStyle = '#7fae5a';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(0, city.waterSouth - 120, WORLD_W, 120);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(city.waterEast, 0, WORLD_W - city.waterEast, WORLD_H);
  ctx.fillRect(0, city.waterSouth, WORLD_W, WORLD_H - city.waterSouth);
  // Water shimmer: bright dashes that drift with the time, east bay and south sea.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  const shimmer = game.time * 36;
  for (let y = 40; y < WORLD_H; y += 90) {
    const x = city.waterEast + 20 + ((y * 7 + shimmer) % 140);
    ctx.fillRect(x, y, 60, 3);
  }
  for (let x = 40; x < WORLD_W; x += 110) {
    const y = city.waterSouth + 20 + ((x * 5 + shimmer * 0.7) % 90);
    ctx.fillRect(x, y, 3, 46);
  }
  // Piers.
  for (const pier of city.piers) {
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = pier.x + 8; x < pier.x + pier.w; x += 22) ctx.fillRect(x, pier.y, 2, pier.h);
  }
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = '#6aa84f';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = '#d9c9a0';
    ctx.fillRect(park.x + park.w / 2 - 6, park.y, 12, park.h);
    ctx.fillRect(park.x, park.y + park.h / 2 - 6, park.w, 12);
  }
  // Sidewalks: pale strips along every road.
  ctx.fillStyle = '#b9b3a4';
  for (const x of city.roadsX) {
    ctx.fillRect(x - ROAD_W / 2 - 14, 0, 14, WORLD_H);
    ctx.fillRect(x + ROAD_W / 2, 0, 14, WORLD_H);
  }
  for (const y of city.roadsY) {
    ctx.fillRect(0, y - ROAD_W / 2 - 14, WORLD_W, 14);
    ctx.fillRect(0, y + ROAD_W / 2, WORLD_W, 14);
  }

  drawRoads(ctx, city, cam);
  drawBuildings(ctx, city);

  // Props: trees, lamps, hydrants.
  for (const prop of city.props) {
    if (prop.kind === 'tree') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 3, prop.y + 4, 12 * prop.s, 9 * prop.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3e7d3a';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 12 * prop.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da244';
      ctx.beginPath();
      ctx.arc(prop.x - 3, prop.y - 3, 7 * prop.s, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
      ctx.fillStyle = 'rgba(255,240,170,0.5)';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'hydrant') {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(prop.x - 3, prop.y - 4, 6, 8);
    } else if (prop.kind === 'palm') {
      // A beach palm: thin trunk, drooping fronds, long shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 5, prop.y + 6, 14 * prop.s, 8 * prop.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 4 * prop.s;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y + 10 * prop.s);
      ctx.lineTo(prop.x, prop.y - 12 * prop.s);
      ctx.stroke();
      ctx.fillStyle = '#2f7d33';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        ctx.beginPath();
        ctx.ellipse(prop.x + Math.cos(a) * 12 * prop.s, prop.y - 12 * prop.s + Math.sin(a) * 8 * prop.s, 11 * prop.s, 4 * prop.s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (prop.kind === 'billboard') {
      // A bright panel on two legs, facing the street.
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(prop.x - 14, prop.y - 4, 4, 22);
      ctx.fillRect(prop.x + 10, prop.y - 4, 4, 22);
      ctx.fillStyle = prop.color || '#e74c3c';
      ctx.fillRect(prop.x - 18, prop.y - 26, 36, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(prop.x - 14, prop.y - 22, 28, 4);
      ctx.fillRect(prop.x - 14, prop.y - 14, 18, 3);
    }
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.55)';
  ctx.lineWidth = 4;
  for (const s of effects.skids) {
    ctx.globalAlpha = clamp(s.life / 6, 0, 0.6);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
    ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Named-place markers: garage, safehouse, hospital, bank, pay-n-spray.
  drawPlaceMarkers(ctx, game);

  // Cash stashes.
  for (const s of city.stashes) {
    if (s.taken) continue;
    const pulse = 0.6 + Math.sin(game.time * 3 + s.id) * 0.4;
    ctx.fillStyle = `rgba(46,204,113,${0.5 + pulse * 0.3})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', s.x, s.y + 4);
  }

  // Pistol pickup, when one is on the ground.
  if (game.gunPickup) {
    const g = game.gunPickup;
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(g.x - 6, g.y - 2, 12, 4);
  }

  // Cars: traffic, police, then the player's.
  for (const car of game.cars) {
    if (car.dead) continue;
    if (game.player.car === car) continue;
    drawCar(ctx, car, game.time);
  }
  if (game.player.car) drawCar(ctx, game.player.car, game.time);

  // Pedestrians and cops.
  for (const p of game.peds) drawPed(ctx, p);
  for (const cop of game.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    // A bright ring on the ground, so the officer pops off the dark road.
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
    // Royal-blue uniform, far brighter than the asphalt.
    ctx.fillStyle = '#2a5ad0';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // Head with a white cap.
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2f2f0';
    ctx.beginPath();
    ctx.arc(3, 0, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    // Gold badge on the chest.
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(-4, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The player, on foot.
  if (game.player.onFoot && !game.player.dead) drawPlayer(ctx, game.player, game.time);

  // Particles.
  for (const p of effects.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating texts.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of effects.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Time-of-day tint: golden morning, clear noon, orange dusk, blue night.
  const hour = game.clockHours;
  let tint = null;
  if (hour < 7 || hour >= 20) tint = 'rgba(20,30,70,0.28)';
  else if (hour >= 17) tint = 'rgba(255,140,40,0.10)';
  else if (hour < 9) tint = 'rgba(255,190,90,0.08)';
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
  }

  // Hurt flash.
  if (game.player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,0,0,${game.player.hurtFlash * 0.5})`;
    ctx.fillRect(cam.x, cam.y, cam.w, cam.h);
  }

  ctx.restore();
}

function drawPlaceMarkers(ctx, game) {
  const places = game.city.places;
  const marker = (x, y, color, letter) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(letter, x, y + 4);
  };
  marker(places.garage.x, places.garage.y, '#e67e22', 'G');
  marker(places.safehouse.x, places.safehouse.y, '#27ae60', 'H');
  marker(places.hospital.x, places.hospital.y, '#e74c3c', '+');
  marker(places.bank.x, places.bank.y, '#f1c40f', '$');
  marker(places.paynspray1.x, places.paynspray1.y, '#9b59b6', 'S');
  marker(places.paynspray2.x, places.paynspray2.y, '#9b59b6', 'S');

  // Objective beacon: a pulsing ring and a column of light.
  const obj = game.objectiveMarker;
  if (obj) {
    const pulse = 1 + Math.sin(game.time * 4) * 0.15;
    ctx.strokeStyle = obj.kind === 'taxi' ? '#f1c40f' : '#ff5a3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = obj.kind === 'taxi' ? 'rgba(241,196,15,0.12)' : 'rgba(255,90,60,0.12)';
    ctx.fillRect(obj.x - 3, obj.y - 260, 6, 260);
    ctx.fillStyle = obj.kind === 'taxi' ? '#f1c40f' : '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y - 44);
    ctx.lineTo(obj.x - 10, obj.y - 26);
    ctx.lineTo(obj.x + 10, obj.y - 26);
    ctx.closePath();
    ctx.fill();
  }
}
