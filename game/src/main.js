// Solano Heat: the game itself. One Game object owns the city, the
// player, the traffic, the police, the missions and the loop. It boots
// from index.html, runs at 60 fps on a canvas, and plays with keyboard
// and mouse only. `?shot=` starts it in a staged scene for screenshots.

import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { buildCity, collideCircle } from './city.js';
import { makeCamera, updateCamera, renderWorld } from './render.js';
import { drawHUD, drawMenu, drawPause, drawBriefing, drawEndCard } from './hud.js';
import { makePlayer, updateOnFoot, tryEnterCar, exitCar, punchTarget, hurtPlayer, healPlayer } from './player.js';
import { makeCar, driveCarPhysics, collideCar, trafficAI, spawnTraffic, spawnParkedCar, nearestCar } from './vehicles.js';
import { makePed, spawnPeds, updatePeds, scarePeds } from './pedestrians.js';
import { makeWanted, addHeat, updateWanted, ensurePolice, policeCarAI, updateCops, tryPaynspray } from './police.js';
import { makeMissionState, updateMissions, objectiveText, objectiveMarker, startMission } from './missions.js';
import { makeEffects, updateEffects, burst, smoke, skid, floatText, shake, shakeOffset } from './effects.js';
import { writeSave, readSave, hasSave, applySave } from './save.js';
import { clamp, dist, rand, money } from './utils.js';

const SHOT_SCENES = ['start', 'drive', 'chase', 'foot'];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.city = buildCity();
    this.camera = makeCamera();
    this.effects = makeEffects();
    this.player = makePlayer(this.city.places.safehouse.x + 40, this.city.places.safehouse.y + 40);
    this.wanted = makeWanted();
    this.missions = makeMissionState();
    this.cars = [];
    this.policeCars = [];
    this.cops = [];
    this.peds = [];
    this.bullets = [];
    this.toasts = [];
    this.briefing = null;
    this.state = 'menu';
    this.endState = null;
    this.time = 0;
    this.clockHours = 9.5;
    this.hasSave = hasSave();
    this.gunPickup = { x: 1260, y: 1300 };
    this.lastCrime = '';
    this.objectiveText = objectiveText(this);
    this.objectiveMarker = objectiveMarker(this);
    this.spawnTimer = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.__game = this;
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.w = window.innerWidth;
    this.camera.h = window.innerHeight;
  }

  toast(text, kind = 'info', seconds = 4) {
    this.toasts.push({ text, kind, life: seconds });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  showBriefing(title, text) {
    this.briefing = { title, text, life: 6 };
  }

  saveGame(quiet = false) {
    const ok = writeSave(this);
    if (!quiet) this.toast(ok ? 'Game saved.' : 'Save failed — storage is off.', ok ? 'good' : 'bad');
  }

  /** Fresh world around the player: traffic, peds, parked cars. */
  populate() {
    const p = this.player;
    this.cars = spawnTraffic(this.city, 22, p.x, p.y, 500);
    this.policeCars = [];
    this.cops = [];
    this.peds = spawnPeds(this.city, 42, p.x, p.y, 350);
    // Parked cars the player can steal, on the roads by the kerb.
    const parked = [
      [2665, 1225, 0], [1700, 1225, Math.PI / 2], [2180, 1700, Math.PI],
      [745, 1225, -Math.PI / 2], [2665, 1700, 0], [1225, 2180, Math.PI / 2],
      [2180, 2180, Math.PI], [745, 2180, 0],
    ];
    for (const [x, y, a] of parked) this.cars.push(spawnParkedCar(this.city, x, y, a));
  }

  startNewGame() {
    this.player = makePlayer(this.city.places.safehouse.x + 40, this.city.places.safehouse.y + 40);
    this.wanted = makeWanted();
    this.missions = makeMissionState();
    this.bullets = [];
    this.toasts = [];
    this.briefing = null;
    this.clockHours = 9.5;
    this.populate();
    this.state = 'playing';
    this.showBriefing('Port Solano', 'Mara owes Silas Kane $40,000. Six jobs pay it down. First: steal a car and bring it to Kane’s Garage.');
    this.audio.ensure();
  }

  continueGame() {
    const data = readSave();
    if (!data) return this.startNewGame();
    this.startNewGame();
    applySave(this, data);
    this.toast('Save loaded — welcome back to Port Solano.', 'good');
  }

  wasted() {
    this.state = 'wasted';
    this.endState = 'wasted';
    this.player.money = Math.max(0, this.player.money - 150);
    this.audio.missionFail();
  }

  busted() {
    this.state = 'busted';
    this.endState = 'busted';
    this.player.money = Math.max(0, this.player.money - 150);
    this.wanted.heat = 0;
    this.wanted.stars = 0;
    this.policeCars = [];
    this.cops = [];
    this.audio.busted();
  }

  /** Respawn after wasted / busted, at the hospital or the PD. */
  respawn() {
    const place = this.endState === 'wasted' ? this.city.places.hospital : this.city.places.policeStation;
    if (this.player.car) {
      this.player.car.driver = 'none';
      this.player.car = null;
    }
    this.player.onFoot = true;
    this.player.x = place.x + 60;
    this.player.y = place.y + 60;
    this.player.health = 100;
    this.player.dead = false;
    this.player.weapon = 'fists';
    this.player.ammo = 0;
    this.wanted = makeWanted();
    this.state = 'playing';
    this.toast('Back on the street. The debt is still due.', 'info');
  }

  // ---- per-frame update ---------------------------------------------------

  update(dt) {
    this.time += dt;
    if (this.state === 'menu') {
      if (this.input.hit('Enter')) {
        if (this.hasSave) this.continueGame();
        else this.startNewGame();
      }
      if (this.input.hit('KeyN')) this.startNewGame();
      if (this.input.mousePressed) this.startNewGame();
      return;
    }
    if (this.state === 'paused') {
      if (this.input.hit('Escape', 'KeyP')) this.state = 'playing';
      if (this.input.hit('KeyS')) this.saveGame();
      if (this.input.hit('KeyR')) this.startNewGame();
      if (this.input.hit('KeyQ')) { this.state = 'menu'; this.hasSave = hasSave(); }
      if (this.input.hit('KeyM')) this.audio.setMuted(!this.audio.muted);
      return;
    }
    if (this.state === 'wasted' || this.state === 'busted') {
      if (this.input.hit('Enter') || this.input.mousePressed) this.respawn();
      return;
    }

    // Playing.
    this.clockHours = (this.clockHours + dt * 0.02) % 24;
    if (this.input.hit('Escape', 'KeyP')) { this.state = 'paused'; return; }
    if (this.input.hit('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (this.input.mousePressed || this.input.hit('Space', 'KeyE', 'KeyT')) this.audio.ensure();

    this.updatePlayer(dt);
    this.updateCars(dt);
    this.updatePedsAndCombat(dt);
    updateWanted(this, dt);
    ensurePolice(this, dt);
    updateCops(this, dt);
    updateMissions(this, dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    updateEffects(this.effects, dt);

    // Toasts and briefing age out.
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    if (this.briefing) {
      this.briefing.life -= dt;
      if (this.briefing.life <= 0) this.briefing = null;
    }

    // Camera follows the player or her car, with shake on impacts.
    const focus = this.player.car || this.player;
    updateCamera(this.camera, focus.x, focus.y, dt);
    const so = shakeOffset(this.effects);
    this.camera.x += so.x;
    this.camera.y += so.y;

    // Continuous audio follows the drive and the sirens.
    const inCar = !!this.player.car;
    const speedRatio = inCar ? Math.abs(this.player.car.speed) / this.player.car.maxSpeed : 0;
    this.audio.setEngine(speedRatio, inCar);
    const sirenNear = this.policeCars.some((c) => dist(c.x, c.y, this.player.x, this.player.y) < 700);
    this.audio.setSiren(sirenNear, dt);

    // Slow health regen on foot, out of trouble.
    if (this.player.onFoot && this.wanted.stars === 0 && this.player.health > 0) {
      healPlayer(this.player, dt * 1.5);
    }

    // Keep the streets full.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6;
      const traffic = this.cars.filter((c) => c.driver === 'traffic');
      if (traffic.length < 18) {
        this.cars.push(...spawnTraffic(this.city, 2, this.player.x, this.player.y, 600));
      }
      if (this.peds.length < 36) {
        this.peds.push(...spawnPeds(this.city, 4, this.player.x, this.player.y, 400));
      }
    }

    this.objectiveText = objectiveText(this);
    this.objectiveMarker = objectiveMarker(this);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    if (p.onFoot) {
      updateOnFoot(this, dt);
      // Enter a car.
      if (this.input.hit('KeyE')) {
        const result = tryEnterCar(this);
        if (result) {
          if (result.stolen) {
            addHeat(this, 12, 'grand theft auto');
            p.stats.carsStolen++;
            this.toast('You stole a car! The owner called it in.', 'bad');
            // The owner jumps out and runs.
            const owner = makePed(result.car.x + 30, result.car.y);
            owner.state = 'flee';
            owner.target = { x: owner.x + 300, y: owner.y + 200 };
            this.peds.push(owner);
          } else {
            this.toast('In the car. Drive.', 'info');
          }
        }
      }
      // Punch.
      if (this.input.hit('Space') && p.punchCooldown <= 0) {
        p.punchTimer = 0.16;
        p.punchCooldown = 0.35;
        this.audio.punch();
        const target = punchTarget(this);
        if (target) {
          target.down = true;
          target.state = 'walk';
          addHeat(this, 6, 'assault');
          scarePeds(this.peds, p.x, p.y, 260, 1);
          burst(this.effects, target.x, target.y, '#ff5a3c', 8, 120, 0.4, 3);
          this.toast('You knocked them flat.', 'bad');
        }
      }
      // Shoot with the mouse.
      if (this.input.mousePressed && p.weapon === 'pistol' && p.shootCooldown <= 0 && p.ammo > 0) {
        p.shootCooldown = 0.28;
        p.ammo--;
        p.stats.shotsFired++;
        this.audio.shoot();
        const ang = p.angle;
        this.bullets.push({
          x: p.x + Math.cos(ang) * 22, y: p.y + Math.sin(ang) * 22,
          vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900,
          life: 0.7, from: 'player',
        });
        scarePeds(this.peds, p.x, p.y, 420, 1);
        addHeat(this, 4, 'gunfire');
        if (p.ammo === 0) {
          p.weapon = 'fists';
          this.toast('Out of ammo — back to fists.', 'info');
        }
      }
    } else if (p.car) {
      // Driving.
      const car = p.car;
      const throttle = this.input.down('KeyW', 'ArrowUp') ? 1 : this.input.down('KeyS', 'ArrowDown') ? -0.7 : 0;
      const steer = (this.input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (this.input.down('KeyD', 'ArrowRight') ? 1 : 0);
      const handbrake = this.input.down('Space');
      const prevSpeed = car.speed;
      driveCarPhysics(car, throttle, steer, dt, handbrake);
      if (handbrake && Math.abs(car.speed) > 120 && Math.random() < 0.5) {
        skid(this.effects, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
        smoke(this.effects, car.x, car.y, 1);
      }
      const impact = collideCar(this.city, car);
      if (impact > 140) {
        this.audio.crash(impact / 400);
        shake(this.effects, 5);
        burst(this.effects, car.x, car.y, '#ffb347', 8, 140, 0.4, 3);
      }
      // Hit pedestrians.
      for (const ped of this.peds) {
        if (ped.down) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          ped.down = true;
          addHeat(this, 8, 'hit and run');
          scarePeds(this.peds, car.x, car.y, 300, 1);
          burst(this.effects, ped.x, ped.y, '#ff5a3c', 10, 150, 0.5, 3);
          this.audio.crash(0.5);
          car.health -= 2;
          this.toast('You hit a pedestrian!', 'bad');
        }
      }
      // Step out.
      if (this.input.hit('KeyE')) exitCar(this);
      // Spray & Go clears the heat.
      if (this.input.hit('KeyX')) tryPaynspray(this);
      if (car.health <= 0) this.explodeCar(car);
    }
  }

  updateCars(dt) {
    for (const car of this.cars) {
      if (car.dead) continue;
      if (car.driver === 'player') continue;
      if (car.driver === 'none') continue; // parked: stays put until stolen
      if (car.driver === 'police') {
        policeCarAI(this, car, dt);
        collideCar(this.city, car);
        if (car.health <= 0) this.explodeCar(car);
        continue;
      }
      trafficAI(car, this.city, this.cars, dt);
      collideCar(this.city, car);
      if (car.health <= 0) this.explodeCar(car);
    }
    // Car-to-car bumps: push apart, dent both.
    for (let i = 0; i < this.cars.length; i++) {
      const a = this.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.cars.length; j++) {
        const b = this.cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 100) {
            a.health -= rel * 0.03;
            b.health -= rel * 0.03;
            if (a.driver === 'player' || b.driver === 'player') {
              this.audio.crash(rel / 500);
              shake(this.effects, 3);
            }
          }
        }
      }
    }
    this.cars = this.cars.filter((c) => !c.dead);
    this.policeCars = this.policeCars.filter((c) => !c.dead && this.cars.includes(c));
  }

  explodeCar(car) {
    car.dead = true;
    burst(this.effects, car.x, car.y, '#ff7a2a', 26, 320, 0.8, 5);
    burst(this.effects, car.x, car.y, '#ffd94a', 16, 220, 0.6, 4);
    smoke(this.effects, car.x, car.y, 8);
    this.audio.explosion();
    shake(this.effects, 10);
    scarePeds(this.peds, car.x, car.y, 420, 1);
    if (this.player.car === car) {
      this.player.car = null;
      this.player.onFoot = true;
      hurtPlayer(this.player, 45);
      this.player.x = car.x + 40;
      this.player.y = car.y;
      if (this.player.dead) this.wasted();
    }
  }

  updatePedsAndCombat(dt) {
    const danger = this.player.car
      ? { x: this.player.car.x, y: this.player.car.y, r: 130 }
      : null;
    updatePeds(this.city, this.peds, dt, danger);
    // Cops shoot at four stars and above.
    if (this.wanted.stars >= 4) {
      for (const cop of this.cops) {
        cop.shootTimer = (cop.shootTimer || 0) - dt;
        const d = dist(cop.x, cop.y, this.player.x, this.player.y);
        if (d < 420 && cop.shootTimer <= 0 && !this.player.dead) {
          cop.shootTimer = 1.3;
          const ang = Math.atan2(this.player.y - cop.y, this.player.x - cop.x) + rand(-0.12, 0.12);
          this.bullets.push({
            x: cop.x, y: cop.y,
            vx: Math.cos(ang) * 820, vy: Math.sin(ang) * 820,
            life: 0.7, from: 'cop',
          });
          this.audio.shoot();
        }
      }
    }
  }

  updateBullets(dt) {
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      // Buildings stop bullets.
      const fixed = collideCircle(this.city, b.x, b.y, 2);
      if (fixed.x !== b.x || fixed.y !== b.y) {
        b.life = 0;
        burst(this.effects, b.x, b.y, '#ccc', 4, 80, 0.3, 2);
        continue;
      }
      if (b.from === 'player') {
        for (const ped of this.peds) {
          if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 12) {
            ped.down = true;
            b.life = 0;
            addHeat(this, 8, 'shooting');
            scarePeds(this.peds, ped.x, ped.y, 300, 1);
            burst(this.effects, ped.x, ped.y, '#ff5a3c', 10, 150, 0.5, 3);
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const cop of this.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 12) {
            cop.gone = true;
            b.life = 0;
            addHeat(this, 12, 'shooting a cop');
            burst(this.effects, cop.x, cop.y, '#ff5a3c', 10, 150, 0.5, 3);
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const car of this.cars) {
          if (car.driver !== 'player' && dist(b.x, b.y, car.x, car.y) < 24) {
            car.health -= 18;
            b.life = 0;
            burst(this.effects, b.x, b.y, '#ffd94a', 6, 120, 0.3, 2);
            break;
          }
        }
      } else if (b.from === 'cop') {
        if (this.player.onFoot && dist(b.x, b.y, this.player.x, this.player.y) < 14) {
          b.life = 0;
          if (hurtPlayer(this.player, 9)) this.wasted();
        } else if (this.player.car && dist(b.x, b.y, this.player.car.x, this.player.car.y) < 24) {
          b.life = 0;
          this.player.car.health -= 6;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updatePickups(dt) {
    const p = this.player;
    if (this.gunPickup && p.onFoot && dist(p.x, p.y, this.gunPickup.x, this.gunPickup.y) < 30) {
      this.gunPickup = null;
      p.weapon = 'pistol';
      p.ammo = 24;
      this.toast('Pistol picked up — 24 rounds. Click to shoot.', 'good');
      this.audio.pickup();
    }
    // A fresh pistol spawns now and then on the sidewalk by the garage.
    if (!this.gunPickup && p.weapon === 'fists' && Math.random() < dt * 0.02) {
      this.gunPickup = { x: 1260, y: 1620 };
    }
  }

  // ---- drawing --------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.state === 'menu') {
      drawMenu(ctx, this);
    } else {
      renderWorld(ctx, this);
      if (this.state === 'playing') {
        drawHUD(ctx, this);
        drawBriefing(ctx, this);
      } else if (this.state === 'paused') {
        drawHUD(ctx, this);
        drawPause(ctx, this);
      } else if (this.state === 'wasted' || this.state === 'busted') {
        drawHUD(ctx, this);
        drawEndCard(ctx, this);
      }
    }
    // A thin status line for screen readers.
    const status = document.getElementById('status');
    if (status) {
      status.textContent = `Solano Heat — ${this.state}. Cash ${money(this.player.money)}. Wanted ${this.wanted.stars} stars. ${this.objectiveText}`;
    }
  }

  frame(dt) {
    this.update(dt);
    this.render();
    this.input.endFrame();
  }

  // ---- staged scenes for screenshots (?shot=...) ----------------------------

  stageShot(scene) {
    this.startNewGame();
    const p = this.player;
    if (scene === 'drive') {
      const car = makeCar(1680, 1200, 0, 'civilian');
      car.driver = 'player';
      this.cars.push(car);
      p.car = car;
      p.onFoot = false;
      p.x = car.x;
      p.y = car.y;
      car.speed = 260;
      this.camera.x = clamp(car.x - this.camera.w / 2, 0, 3840 - this.camera.w);
      this.camera.y = clamp(car.y - this.camera.h / 2, 0, 2880 - this.camera.h);
    } else if (scene === 'chase') {
      const car = makeCar(2160, 1680, -Math.PI / 2, 'civilian');
      car.driver = 'player';
      this.cars.push(car);
      p.car = car;
      p.onFoot = false;
      p.x = car.x;
      p.y = car.y;
      car.speed = 320;
      this.wanted.heat = 55;
      this.wanted.stars = 3;
      startMission(this, 5);
      for (let i = 0; i < 3; i++) {
        const cop = makeCar(car.x + (i - 1) * 260, car.y + 480, -Math.PI / 2, 'police');
        cop.driver = 'police';
        cop.siren = true;
        cop.speed = 300;
        this.cars.push(cop);
        this.policeCars.push(cop);
      }
      this.camera.x = clamp(car.x - this.camera.w / 2, 0, 3840 - this.camera.w);
      this.camera.y = clamp(car.y - this.camera.h / 2, 0, 2880 - this.camera.h);
    } else if (scene === 'foot') {
      p.x = 3100;
      p.y = 1300;
      p.weapon = 'pistol';
      p.ammo = 24;
      this.gunPickup = null;
      startMission(this, 1);
      this.camera.x = clamp(p.x - this.camera.w / 2, 0, 3840 - this.camera.w);
      this.camera.y = clamp(p.y - this.camera.h / 2, 0, 2880 - this.camera.h);
    }
    // Settle the world for a few frames so traffic and peds are in place.
    for (let i = 0; i < 40; i++) this.update(1 / 60);
    // Screenshots show the city, not the briefing card.
    this.briefing = null;
    this.toasts = [];
    this.state = 'playing';
  }
}

function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && SHOT_SCENES.includes(shot) && shot !== 'start') {
    game.stageShot(shot);
  }
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.frame(dt);
    } catch (err) {
      // Never let one bad frame kill the loop: report it and keep playing.
      console.error('Solano Heat frame error:', err);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
