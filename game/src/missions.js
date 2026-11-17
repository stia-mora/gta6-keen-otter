// The story of Solano Heat and its side work. Mara owes Silas Kane
// $40,000; six jobs pay it down. Each mission is a small state machine
// of steps — go there, steal that, lose them, beat the clock — with a
// marker on the map and a payout at the end. Taxi fares and hidden cash
// stashes pay the bills between jobs.

import { clamp, dist, money } from './utils.js';
import { addHeat } from './police.js';

export const STORY = [
  {
    id: 'wheels',
    title: '1 — Wheels',
    briefing: 'Kane needs a clean ride. Steal any car and bring it to his garage.',
    reward: 400,
    steps: [
      { type: 'steal', text: 'Steal a car (walk up and press E)' },
      { type: 'goto', place: 'garage', text: 'Drive it to Kane’s Garage' },
    ],
  },
  {
    id: 'pickup',
    title: '2 — The Pickup',
    briefing: 'A package is waiting at the docks. Get it on foot and bring it back.',
    reward: 600,
    steps: [
      { type: 'goto', place: 'harbor', text: 'Drive to the Port Solano Docks' },
      { type: 'pickup', place: 'harbor', text: 'Get out and grab the package (E)' },
      { type: 'goto', place: 'garage', text: 'Bring the package to Kane’s Garage' },
    ],
  },
  {
    id: 'hotwheels',
    title: '3 — Hot Wheels',
    briefing: 'Kane tipped the cops. Lose a three-star wanted level and come home.',
    reward: 800,
    steps: [
      { type: 'wanted', stars: 3, text: 'Get the cops on you — steal a car in front of them' },
      { type: 'lose', text: 'Lose the heat — stay clean and out of sight' },
      { type: 'goto', place: 'safehouse', text: 'Lay low at the Safehouse' },
    ],
  },
  {
    id: 'courier',
    title: '4 — The Courier',
    briefing: 'A briefcase for the beach, and the clock is running. Two minutes.',
    reward: 1000,
    steps: [
      { type: 'goto', place: 'garage', text: 'Pick up the briefcase at the Garage' },
      { type: 'timed', place: 'beach', seconds: 120, text: 'Deliver it to Solano Beach' },
    ],
  },
  {
    id: 'smoke',
    title: '5 — Smoke Screen',
    briefing: 'Three drops across town while the whole city is looking for you.',
    reward: 1400,
    steps: [
      { type: 'goto', place: 'hospital', text: 'First drop: Solano General' },
      { type: 'goto', place: 'policeStation', text: 'Second drop: Solano PD HQ' },
      { type: 'goto', place: 'beach', text: 'Third drop: Solano Beach' },
    ],
  },
  {
    id: 'lastjob',
    title: '6 — The Last Job',
    briefing: 'Meridian Bank. Take the cash, shake a four-star tail, and vanish.',
    reward: 2500,
    steps: [
      { type: 'goto', place: 'bank', text: 'Get to Meridian Bank' },
      { type: 'pickup', place: 'bank', text: 'Grab the cash (E) — the alarm will trip' },
      { type: 'wanted', stars: 4, text: 'Four stars. Now run.' },
      { type: 'lose', text: 'Lose the heat' },
      { type: 'goto', place: 'safehouse', text: 'Get home to the Safehouse' },
    ],
  },
];

export function makeMissionState() {
  return {
    index: 0,            // next story mission to play
    active: null,        // { def, step, timer, ... } or null
    completed: [],
    taxi: null,          // active taxi fare
    taxiCooldown: 0,
    message: '',
  };
}

/** The objective text the HUD shows right now. */
export function objectiveText(game) {
  const m = game.missions;
  if (m.active) {
    const step = m.active.def.steps[m.active.step];
    return step.text;
  }
  if (m.index >= STORY.length) return 'All jobs done — Solano is yours. Free roam.';
  return `Go to Kane’s Garage to start “${STORY[m.index].title}”`;
}

/** The map marker for the current objective, or null. */
export function objectiveMarker(game) {
  const m = game.missions;
  if (m.taxi) return { x: m.taxi.dest.x, y: m.taxi.dest.y, kind: 'taxi' };
  if (m.active) {
    const step = m.active.def.steps[m.active.step];
    if (step.place) {
      const pl = game.city.places[step.place];
      return { x: pl.x, y: pl.y, kind: 'mission' };
    }
    if (step.type === 'steal') return null;
    if (step.type === 'lose') return null;
  }
  const next = STORY[m.index];
  if (next) {
    const pl = game.city.places.garage;
    return { x: pl.x, y: pl.y, kind: 'mission' };
  }
  return null;
}

export function startMission(game, index) {
  const def = STORY[index];
  if (!def) return;
  game.missions.active = {
    def, step: 0, timer: 0, stepTimer: 0,
    // The car the player is already in (if any): stealing means getting
    // into a different one after the job starts.
    startCarId: game.player.car ? game.player.car.id : null,
  };
  game.toast(`Mission: ${def.title}`, 'mission');
  game.showBriefing(def.title, def.briefing);
  game.audio.missionDone();
}

export function failMission(game, reason) {
  const m = game.missions;
  if (!m.active) return;
  game.toast(`Mission failed — ${reason}`, 'bad');
  game.audio.missionFail();
  m.active = null;
}

export function completeMission(game) {
  const m = game.missions;
  const def = m.active.def;
  m.completed.push(def.id);
  m.index = Math.min(m.index + 1, STORY.length);
  game.player.stats.missionsDone++;
  game.player.money += def.reward;
  game.player.stats.cashEarned += def.reward;
  game.toast(`Job done — ${money(def.reward)} paid`, 'good');
  game.audio.missionDone();
  m.active = null;
  game.saveGame(true);
  if (m.index >= STORY.length) {
    game.showBriefing('Debt Paid', 'That was the last of it. Kane is square, and Port Solano is yours now — keep the car.');
  }
}

/** Distance to the current objective, for the HUD. */
export function objectiveDistance(game) {
  const marker = objectiveMarker(game);
  if (!marker) return null;
  return Math.round(dist(game.player.x, game.player.y, marker.x, marker.y));
}

function stepReached(game, step) {
  const p = game.player;
  if (step.place) {
    const pl = game.city.places[step.place];
    const x = p.car ? p.car.x : p.x;
    const y = p.car ? p.car.y : p.y;
    return dist(x, y, pl.x, pl.y) < 100;
  }
  return false;
}

export function updateMissions(game, dt) {
  const m = game.missions;
  m.taxiCooldown = Math.max(0, m.taxiCooldown - dt);

  // Starting a mission: stand at the garage and press E with no mission.
  if (!m.active && m.index < STORY.length) {
    const pl = game.city.places.garage;
    const p = game.player;
    const x = p.car ? p.car.x : p.x;
    const y = p.car ? p.car.y : p.y;
    if (dist(x, y, pl.x, pl.y) < 110 && game.input.hit('KeyE')) {
      startMission(game, m.index);
      return;
    }
  }

  if (m.active) {
    const act = m.active;
    const step = act.def.steps[act.step];
    act.stepTimer += dt;

    if (step.type === 'timed') {
      if (!act.timer) act.timer = step.seconds;
      act.timer -= dt;
      if (act.timer <= 0) {
        failMission(game, 'the clock ran out');
        return;
      }
    }
    if (step.type === 'steal') {
      const car = game.player.car;
      if (car && car.id !== act.startCarId) {
        act.step++;
        game.toast('Nice wheels. Now bring it in.', 'info');
      }
    } else if (step.type === 'pickup') {
      if (stepReached(game, step) && game.player.onFoot && game.input.hit('KeyE')) {
        if (act.def.id === 'lastjob') {
          addHeat(game, 60, 'bank robbery');
          game.toast('Alarm tripped! Run!', 'bad');
        }
        act.step++;
        game.toast('Package secured.', 'info');
      }
    } else if (step.type === 'wanted') {
      if (game.wanted.stars >= step.stars) act.step++;
    } else if (step.type === 'lose') {
      if (game.wanted.stars === 0) act.step++;
    } else if (step.type === 'goto' || step.type === 'timed') {
      if (stepReached(game, step)) act.step++;
    }

    if (act.step >= act.def.steps.length) {
      completeMission(game);
      return;
    }
  }

  // Taxi fares: a waiting passenger near a taxi stand, T to accept.
  if (!m.taxi && m.taxiCooldown <= 0) {
    for (const stand of game.city.taxiStands) {
      const p = game.player;
      if (p.car && dist(p.car.x, p.car.y, stand.x, stand.y) < 80) {
        if (game.input.hit('KeyT')) {
          const dests = game.city.taxiStands.filter((s) => s !== stand);
          const dest = dests[Math.floor(Math.random() * dests.length)];
          m.taxi = { from: stand, dest, fare: 120 + Math.round(dist(stand.x, stand.y, dest.x, dest.y) / 40) };
          game.toast(`Fare: take them across town — ${money(m.taxi.fare)}`, 'info');
          break;
        }
      }
    }
  }
  if (m.taxi) {
    const p = game.player;
    if (!p.car) {
      m.taxi = null;
      game.toast('Fare walked off. You left the car.', 'bad');
    } else if (dist(p.car.x, p.car.y, m.taxi.dest.x, m.taxi.dest.y) < 90) {
      const fare = m.taxi.fare;
      game.player.money += fare;
      game.player.stats.taxisDone++;
      game.player.stats.cashEarned += fare;
      game.toast(`Fare paid — ${money(fare)}`, 'good');
      game.audio.cash();
      m.taxi = null;
      m.taxiCooldown = 4;
    }
  }

  // Cash stashes: walk over one to pocket it.
  for (const s of game.city.stashes) {
    if (s.taken) continue;
    const p = game.player;
    if (dist(p.x, p.y, s.x, s.y) < 34) {
      s.taken = true;
      const amount = 50 + s.id * 10;
      game.player.money += amount;
      game.player.stats.cashEarned += amount;
      game.toast(`Hidden stash — ${money(amount)}`, 'good');
      game.audio.cash();
    }
  }
}
