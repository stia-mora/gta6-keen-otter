// Port Solano, the city of Solano Heat: a 3840 x 2880 coastal grid with
// five districts, a harbor on the east, a beach on the south, and the
// road graph traffic and police drive on. Everything is generated once
// from a fixed seed, so every run of the game plays the same city.

import { clamp, hash2, mulberry32, randi } from './utils.js';

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const ROAD_W = 96;

const ROAD_X = [240, 720, 1200, 1680, 2160, 2640, 3120];
const ROAD_Y = [240, 720, 1200, 1680, 2160, 2640];
const WATER_EAST = 3600;
const WATER_SOUTH = 2760;

const DISTRICT_COLORS = {
  downtown: ['#3a4a6b', '#4a3f63', '#2f4a55', '#5b4a3a', '#37415e'],
  oldtown: ['#7a5a44', '#8a6a4a', '#6a4a3a', '#77553f'],
  harbor: ['#4a5548', '#5a4a42', '#44505a', '#6b5a3a'],
  beach: ['#c9a86a', '#b98a5a', '#d9b878', '#a87a5a'],
  industrial: ['#555a5e', '#4a4a4a', '#5e5648', '#3f4a4a'],
};

/** Which district a block (column, row) belongs to. */
export function districtOf(col, row) {
  if (col >= 5) return 'harbor';
  if (row >= 4) return 'beach';
  if (row === 0) return 'industrial';
  if (col <= 1) return 'oldtown';
  return 'downtown';
}

export function buildCity() {
  const rng = mulberry32(20261117);
  const city = {
    W: WORLD_W,
    H: WORLD_H,
    roadsX: ROAD_X,
    roadsY: ROAD_Y,
    waterEast: WATER_EAST,
    waterSouth: WATER_SOUTH,
    buildings: [],
    parks: [],
    props: [],
    nodes: [],
    // Named places the missions and HUD refer to.
    places: {},
    taxiStands: [],
    stashes: [],
  };

  // Intersection nodes: the graph traffic drives on.
  for (const x of ROAD_X) {
    for (const y of ROAD_Y) {
      city.nodes.push({ x, y });
    }
  }

  // Blocks sit between the roads. Each block holds buildings, a park,
  // or (in the harbor) warehouses and docks.
  for (let col = 0; col < ROAD_X.length - 1; col++) {
    for (let row = 0; row < ROAD_Y.length - 1; row++) {
      const bx = ROAD_X[col] + ROAD_W / 2 + 24;
      const by = ROAD_Y[row] + ROAD_W / 2 + 24;
      const bw = ROAD_X[col + 1] - ROAD_X[col] - ROAD_W - 48;
      const bh = ROAD_Y[row + 1] - ROAD_Y[row] - ROAD_W - 48;
      const district = districtOf(col, row);
      const h = hash2(col, row);

      // One in seven blocks is a park: grass, paths and trees.
      if (h < 0.14 && !(col === 2 && row === 2)) {
        city.parks.push({ x: bx, y: by, w: bw, h: bh, district });
        for (let i = 0; i < 7; i++) {
          city.props.push({
            x: bx + rng() * bw, y: by + rng() * bh, kind: 'tree', s: 0.8 + rng() * 0.7,
          });
        }
        continue;
      }

      const palette = DISTRICT_COLORS[district];
      const tall = district === 'downtown';
      // Split big blocks into two buildings, small ones get one.
      const split = bw > 300 && rng() < 0.6;
      const count = split ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = split ? bw / 2 - 12 : bw - 16;
        const hh = bh - 16 - (split ? 0 : 0);
        const x = split ? bx + i * (bw / 2 + 6) : bx + 8;
        const y = by + 8;
        city.buildings.push({
          x, y, w, h: hh,
          color: palette[Math.floor(rng() * palette.length)],
          roof: palette[Math.floor(rng() * palette.length)],
          height: tall ? randi(2, 5) : randi(1, 2),
          district,
          seed: Math.floor(rng() * 10000),
        });
      }
    }
  }

  // Harbor blocks east of the last road: warehouses and the docks.
  for (let row = 0; row < ROAD_Y.length - 1; row++) {
    const by = ROAD_Y[row] + ROAD_W / 2 + 24;
    const bh = ROAD_Y[row + 1] - ROAD_Y[row] - ROAD_W - 48;
    city.buildings.push({
      x: 3168 + 24, y: by + 8, w: 330, h: bh - 16,
      color: DISTRICT_COLORS.harbor[row % 4], roof: '#3a3f45',
      height: 1, district: 'harbor', seed: 500 + row,
    });
  }
  // Piers reaching into the bay.
  city.piers = [
    { x: 3600, y: 700, w: 190, h: 26 },
    { x: 3600, y: 1500, w: 190, h: 26 },
    { x: 3600, y: 2300, w: 190, h: 26 },
  ];
  // The beach pier, south.
  city.piers.push({ x: 600, y: 2640, w: 26, h: 130 });

  // Street props: lamps at every intersection, trees along sidewalks.
  for (const x of ROAD_X) {
    for (const y of ROAD_Y) {
      city.props.push({ x: x + 58, y: y + 58, kind: 'lamp', s: 1 });
      if (hash2(x, y) < 0.75) {
        city.props.push({ x: x - 64 + rng() * 40, y: y + 60, kind: 'tree', s: 0.9 + rng() * 0.5 });
      }
      if (hash2(x + 31, y + 17) < 0.3) {
        city.props.push({ x: x + 64, y: y - 60, kind: 'tree', s: 0.8 + rng() * 0.5 });
      }
    }
  }
  // Palm trees along the beachfront and the harbor walk.
  for (let i = 0; i < 18; i++) {
    city.props.push({
      x: 300 + rng() * 3000, y: 2560 + rng() * 140, kind: 'palm', s: 0.9 + rng() * 0.5,
    });
  }
  // Billboards on downtown blocks: bright panels on legs at block corners.
  const billboardColors = ['#e74c3c', '#f1c40f', '#3498db', '#e67e22', '#9b59b6'];
  for (let i = 0; i < 8; i++) {
    const col = 2 + Math.floor(rng() * 3);
    const row = 1 + Math.floor(rng() * 2);
    city.props.push({
      x: ROAD_X[col] + ROAD_W / 2 + 30 + rng() * 120,
      y: ROAD_Y[row] + ROAD_W / 2 + 30 + rng() * 120,
      kind: 'billboard', s: 1, color: billboardColors[i % billboardColors.length],
    });
  }
  for (let i = 0; i < 40; i++) {
    city.props.push({
      x: ROAD_X[Math.floor(rng() * ROAD_X.length)] + (rng() < 0.5 ? -70 : 70),
      y: ROAD_Y[Math.floor(rng() * ROAD_Y.length)] + randi(-200, 200),
      kind: 'hydrant', s: 1,
    });
  }

  // Named places.
  city.places = {
    garage: { x: 1200, y: 1680, name: "Kane's Garage", kind: 'garage' },
    safehouse: { x: 720, y: 1200, name: 'Mara’s Safehouse', kind: 'safehouse' },
    hospital: { x: 2160, y: 1200, name: 'Solano General', kind: 'hospital' },
    policeStation: { x: 1680, y: 720, name: 'Solano PD HQ', kind: 'police' },
    bank: { x: 2160, y: 1680, name: 'Meridian Bank', kind: 'bank' },
    harbor: { x: 3300, y: 1200, name: 'Port Solano Docks', kind: 'harbor' },
    paynspray1: { x: 1680, y: 2160, name: 'Spray & Go', kind: 'paynspray' },
    paynspray2: { x: 3120, y: 720, name: 'Spray & Go East', kind: 'paynspray' },
    beach: { x: 720, y: 2700, name: 'Solano Beach', kind: 'beach' },
  };

  // Taxi stands: passengers wait at these intersections.
  city.taxiStands = [
    { x: 720, y: 720 }, { x: 2160, y: 720 }, { x: 1200, y: 2160 },
    { x: 2640, y: 1680 }, { x: 720, y: 2160 }, { x: 3120, y: 2160 },
  ];

  // Twelve cash stashes hidden around the city.
  const stashSpots = [
    [300, 300], [3100, 300], [300, 2600], [3400, 2600], [1250, 760],
    [1700, 2600], [2600, 300], [760, 1700], [2650, 1250], [1250, 2200],
    [2150, 760], [3150, 2200],
  ];
  city.stashes = stashSpots.map(([x, y], i) => ({ id: i, x, y, taken: false }));

  return city;
}

// ---- queries used by movement, traffic and missions ---------------------

/** True when a point is in the bay or the southern sea. */
export function isWater(city, x, y) {
  if (x >= city.waterEast || y >= city.waterSouth) return true;
  return false;
}

/** The building covering a point, or null. */
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of buildings and water; returns the fixed position. */
export function collideCircle(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Dead centre inside: push out along the smallest overlap.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  if (x >= city.waterEast - r) x = city.waterEast - r;
  if (y >= city.waterSouth - r) y = city.waterSouth - r;
  if (x < r) x = r;
  if (y < r) y = r;
  return { x, y };
}

/** True when a point is on a road (not a sidewalk or a block). */
export function onRoad(city, x, y) {
  const half = ROAD_W / 2;
  for (const rx of city.roadsX) if (Math.abs(x - rx) <= half) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) <= half) return true;
  return false;
}

/** The nearest point on the road network to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of city.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

/** A random intersection node. */
export function randomNode(city) {
  return city.nodes[Math.floor(Math.random() * city.nodes.length)];
}

/** Neighbour nodes of a node (up/down/left/right along roads). */
export function nodeNeighbours(city, node) {
  const out = [];
  for (const n of city.nodes) {
    if (n === node) continue;
    const sameX = n.x === node.x && Math.abs(n.y - node.y) === 480;
    const sameY = n.y === node.y && Math.abs(n.x - node.x) === 480;
    if (sameX || sameY) out.push(n);
  }
  return out;
}
