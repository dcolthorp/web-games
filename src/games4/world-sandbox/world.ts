// The world's land and sea. It's made from a seed, so a saved world comes back
// exactly the same, and only the seed and the things on it need saving.

export const W = 960;
export const H = 600;
export const CELL = 4;
export const COLS = W / CELL;
export const ROWS = H / CELL;

// Ground higher than this is land. Everything lower is water.
export const LAND_LEVEL = 0.5;

export const KINDS = ["tree", "hill", "mountain", "volcano", "life"] as const;
export type Kind = (typeof KINDS)[number];

export interface Thing {
  kind: Kind;
  x: number;
  y: number;
  emoji?: string;
  heading?: number;
}

export const TSUNAMI_MS = 5000;
const TSUNAMI_RADIUS = 220;
// How far a tsunami can push up onto land before the land stops it.
const RUN_UP = 20;

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A few continents, each a lumpy pile of overlapping round blobs. Where blobs
// overlap the ground gets higher.
export function makeHeights(seed: number): Float32Array {
  const rand = seededRandom(seed);
  const blobs: [number, number, number][] = [];
  const continents = 4 + Math.floor(rand() * 4);
  for (let c = 0; c < continents; c += 1) {
    const cx = 100 + rand() * (W - 200);
    const cy = 80 + rand() * (H - 160);
    for (let i = 0; i < 10; i += 1) {
      blobs.push([cx + (rand() - 0.5) * 240, cy + (rand() - 0.5) * 180, 20 + rand() * 50]);
    }
  }

  const heights = new Float32Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = (col + 0.5) * CELL;
      const y = (row + 0.5) * CELL;
      let h = 0;
      for (const [bx, by, r] of blobs) {
        const d2 = ((x - bx) ** 2 + (y - by) ** 2) / (r * r);
        if (d2 < 1) h += 1 - d2;
      }
      heights[row * COLS + col] = h;
    }
  }
  return heights;
}

export function isLand(heights: Float32Array, x: number, y: number): boolean {
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
  return (heights[row * COLS + col] ?? 0) > LAND_LEVEL;
}

export function tsunamiRadius(ageMs: number): number {
  return (Math.min(ageMs, TSUNAMI_MS) / TSUNAMI_MS) * TSUNAMI_RADIUS;
}

// Whether a tsunami that started at (cx, cy) gets to (x, y). It rolls straight
// out over the water and can push a little way up onto land, but a whole island
// or continent in the way stops it.
export function waveReaches(heights: Float32Array, cx: number, cy: number, x: number, y: number): boolean {
  const d = Math.hypot(x - cx, y - cy);
  let onLand = 0;
  for (let s = 0; s <= d; s += CELL) {
    const t = d === 0 ? 0 : s / d;
    if (isLand(heights, cx + (x - cx) * t, cy + (y - cy) * t)) {
      onLand += CELL;
      if (onLand > RUN_UP) return false;
    } else {
      onLand = 0;
    }
  }
  return true;
}
