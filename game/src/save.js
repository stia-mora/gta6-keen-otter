// Saving Solano Heat: one localStorage key holds the player's money,
// story progress, collected stashes, position and the clock. The game
// autosaves after every finished job and on demand from the pause menu.

export const SAVE_KEY = 'solano-heat-save-v1';

/** Serialize the parts of the game that survive a reload. */
export function collectSave(game) {
  return {
    version: 1,
    money: Math.round(game.player.money),
    health: Math.round(game.player.health),
    missionIndex: game.missions.index,
    completed: game.missions.completed.slice(),
    stashes: game.city.stashes.filter((s) => s.taken).map((s) => s.id),
    player: { x: Math.round(game.player.x), y: Math.round(game.player.y) },
    clockHours: game.clockHours,
    stats: { ...game.player.stats },
    savedAt: Date.now(),
  };
}

export function writeSave(game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(collectSave(game)));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return readSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable; the game still plays.
  }
}

/** Apply a save to a fresh game: position, money, progress, stashes. */
export function applySave(game, data) {
  game.player.money = data.money;
  game.player.health = data.health;
  game.player.x = data.player.x;
  game.player.y = data.player.y;
  game.missions.index = data.missionIndex;
  game.missions.completed = data.completed.slice();
  game.player.stats = { ...game.player.stats, ...data.stats };
  for (const id of data.stashes) {
    const stash = game.city.stashes.find((s) => s.id === id);
    if (stash) stash.taken = true;
  }
  game.clockHours = data.clockHours;
}
