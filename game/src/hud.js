// Everything drawn on top of the world: health and cash, wanted stars,
// the mission objective, the minimap, toasts, and the menus (start,
// pause, briefing, wasted, busted). The minimap is a second canvas view
// of the same city, drawn small in the corner.

import { clamp, money, timeOfDay } from './utils.js';
import { ROAD_W } from './city.js';

/** Draw the in-game HUD: bars, stars, objective, speed, minimap. */
export function drawHUD(ctx, game) {
  const { player, wanted, camera } = game;
  const W = camera.w;
  const H = camera.h;

  // Top-left: health and armor bars, cash, clock.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 250, 64);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(24, 22, 180 * clamp(player.health / 100, 0, 1), 12);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(24, 22, 180, 12);
  if (player.armor > 0) {
    ctx.fillStyle = '#3498db';
    ctx.fillRect(24, 38, 180 * clamp(player.armor / 100, 0, 1), 6);
  }
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(money(player.money), 24, 66);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(timeOfDay(game.clockHours) + '  Port Solano', 130, 66);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 178, 12, 164, 40);
  const flash = wanted.flash > 0 && Math.floor(game.time * 6) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted.stars ? (flash ? '#ff5a3c' : '#ffd94a') : 'rgba(255,255,255,0.25)';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', W - 162 + i * 30, 40);
  }

  // Weapon and ammo, bottom-left.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, H - 56, 170, 42);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(player.weapon === 'pistol' ? 'Pistol' : 'Fists', 24, H - 32);
  if (player.weapon === 'pistol') {
    ctx.fillStyle = '#ffd94a';
    ctx.fillText('Ammo ' + player.ammo, 90, H - 32);
  }
  ctx.fillStyle = '#aaa';
  ctx.font = '12px sans-serif';
  ctx.fillText('[E] enter car  [Space] punch  [M] mute', 24, H - 18);

  // Speed when driving.
  if (player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - 120, H - 56, 106, 42);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + ' km/h', W - 26, H - 26);
  }

  // Objective line, top-centre.
  const obj = game.objectiveText;
  const m = game.missions.active;
  let timerText = '';
  if (m && m.timer) timerText = '  —  ' + Math.ceil(m.timer) + 's';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const ow = ctx.measureText(obj + timerText).width + 28;
  ctx.fillRect(W / 2 - ow / 2, 12, ow, 30);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(obj + timerText, W / 2, 32);

  drawMinimap(ctx, game);
  drawToasts(ctx, game);
}

/** The minimap: roads, water, the player, police, and the objective. */
export function drawMinimap(ctx, game) {
  const { city, player } = game;
  const size = 190;
  const x0 = game.camera.w - size - 14;
  const y0 = 62;
  const scale = size / city.W;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size * (city.H / city.W) + 8);
  const h = size * (city.H / city.W);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, h);
  ctx.clip();
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(x0, y0, size, h);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(x0 + city.waterEast * scale, y0, size, h);
  ctx.fillRect(x0, y0 + city.waterSouth * scale, size, h);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  for (const rx of city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + h);
    ctx.stroke();
  }
  for (const ry of city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + size, y0 + ry * scale);
    ctx.stroke();
  }
  // Objective marker.
  if (game.objectiveMarker) {
    const o = game.objectiveMarker;
    ctx.fillStyle = o.kind === 'taxi' ? '#f1c40f' : '#ff5a3c';
    ctx.beginPath();
    ctx.arc(x0 + o.x * scale, y0 + o.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#2a6bff';
  for (const c of game.policeCars) {
    ctx.beginPath();
    ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x0 + player.x * scale;
  const py = y0 + player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.car ? '#ffd94a' : '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, h + 8);
}

function drawToasts(ctx, game) {
  const H = game.camera.h;
  let y = H - 110;
  for (let i = game.toasts.length - 1; i >= 0; i--) {
    const t = game.toasts[i];
    ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
    ctx.fillStyle = t.kind === 'bad' ? 'rgba(160,20,20,0.85)' : t.kind === 'good' ? 'rgba(20,120,50,0.85)' : 'rgba(0,0,0,0.75)';
    const w = ctx.measureText(t.text).width + 24;
    ctx.fillRect(game.camera.w / 2 - w / 2, y - 18, w, 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, game.camera.w / 2, y);
    ctx.globalAlpha = 1;
    y -= 32;
  }
}

// ---- menus ---------------------------------------------------------------

function panel(ctx, W, H, title, lines, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 260, H / 2 - 190, 520, 6);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, H / 2 - 140);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ddd';
  let y = H / 2 - 96;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 26;
  }
  return y;
}

/** The start screen: title, story, controls. */
export function drawMenu(ctx, game) {
  const W = game.camera.w;
  const H = game.camera.h;
  // A warm sunset skyline behind the title.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a3a');
  grad.addColorStop(0.55, '#c94b4b');
  grad.addColorStop(1, '#f2a541');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#14142a';
  for (let i = 0; i < 40; i++) {
    const bw = 30 + ((i * 53) % 60);
    const bh = 90 + ((i * 97) % 220);
    const bx = (i * 137) % W;
    ctx.fillRect(bx, H - bh - 90, bw, bh + 90);
  }
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(W - 190, 150, 46, 0, Math.PI * 2);
  ctx.fill();
  const y = panel(ctx, W, H, 'SOLANO HEAT', [
    'An open-world crime game in Port Solano.',
    'Mara Reyes owes the fixer Silas Kane $40,000.',
    'Six jobs. One city. No rules but hers.',
    '',
    'WASD move / drive   •   E enter & steal cars   •   Space punch / handbrake',
    'Mouse aim + click to shoot   •   T take a taxi fare   •   Esc pause   •   M mute',
    '',
    game.hasSave ? 'Press ENTER to continue your saved game, or click NEW GAME' : 'Press ENTER or click to start',
  ], '#ff5a3c');
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.floor(game.time * 2) % 2 === 0;
  if (blink) ctx.fillText(game.hasSave ? 'ENTER — CONTINUE    •    N — NEW GAME' : 'ENTER — START', W / 2, y + 30);
}

/** The pause menu. */
export function drawPause(ctx, game) {
  const W = game.camera.w;
  const H = game.camera.h;
  panel(ctx, W, H, 'PAUSED', [
    'Port Solano waits for no one — except now.',
    '',
    'Esc — resume      S — save game      R — restart the story',
    'M — mute sound      Q — quit to the title screen',
    '',
    'Cash: ' + money(game.player.money) + '   •   Jobs done: ' + game.player.stats.missionsDone + ' / 6',
    'Cars stolen: ' + game.player.stats.carsStolen + '   •   Fares driven: ' + game.player.stats.taxisDone,
  ], '#ffd94a');
}

/** Mission briefing card, shown briefly at mission start. */
export function drawBriefing(ctx, game) {
  const b = game.briefing;
  if (!b) return;
  const W = game.camera.w;
  ctx.globalAlpha = clamp(b.life / 0.5, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(W / 2 - 280, 120, 560, 110);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(W / 2 - 280, 120, 560, 5);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.title, W / 2, 158);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  wrapText(ctx, b.text, W / 2, 186, 520, 22);
  ctx.globalAlpha = 1;
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

/** Wasted / busted end card. */
export function drawEndCard(ctx, game) {
  const W = game.camera.w;
  const H = game.camera.h;
  const wasted = game.endState === 'wasted';
  panel(ctx, W, H, wasted ? 'WASTED' : 'BUSTED', [
    wasted ? 'Mara went down in the streets of Port Solano.' : 'The Solano PD finally put the cuffs on.',
    'The hospital bill cost you $150. The city keeps moving.',
    '',
    'Press ENTER to get back out there.',
  ], wasted ? '#c0392b' : '#2a6bff');
}
