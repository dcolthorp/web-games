// The world's land and sea. It's made from a seed, so a saved world comes back
// exactly the same, and only the seed and the things on it need saving.

// The world is this many pixels, blown up to fill the screen. One cell of land
// or sea is one pixel.
export const W = 320;
export const H = 200;
export const CELL = 1;
export const COLS = W / CELL;
export const ROWS = H / CELL;
// The land used to be made for a map three times as big.
const S = W / 960;

// Ground higher than this is land. Everything lower is water.
export const LAND_LEVEL = 0.5;

// Something in the world. `type` is the id of what it is (oak, sheep, volcano…).
export interface Thing {
  type: string;
  x: number;
  y: number;
  heading?: number;
  // Only people and villages have these.
  tribe?: string;
  name?: string;
  traits?: string[];
  hp?: number;
  // Frames until a person can hit again.
  rest?: number;
  // A mountain's cave, once someone's been inside (see caves.ts).
  cave?: string;
}

export const TSUNAMI_MS = 5000;
const TSUNAMI_RADIUS = 75;
// How far a tsunami can push up onto land before the land stops it.
const RUN_UP = 6;

export function seededRandom(seed: number): () => number {
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
    const cx = S * (100 + rand() * 760);
    const cy = S * (80 + rand() * 440);
    for (let i = 0; i < 10; i += 1) {
      blobs.push([cx + S * (rand() - 0.5) * 240, cy + S * (rand() - 0.5) * 180, S * (20 + rand() * 50)]);
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

export const BRUSH_RADIUS = 7;

// Raises (amount above 0) or sinks (below 0) the ground in a round patch,
// most in the middle.
export function applyStroke(heights: Float32Array, cx: number, cy: number, amount: number): void {
  for (let y = Math.max(0, Math.floor(cy - BRUSH_RADIUS)); y <= Math.min(ROWS - 1, cy + BRUSH_RADIUS); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - BRUSH_RADIUS)); x <= Math.min(COLS - 1, cx + BRUSH_RADIUS); x += 1) {
      const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / BRUSH_RADIUS ** 2;
      if (d2 >= 1) continue;
      const i = y * COLS + x;
      heights[i] = (heights[i] ?? 0) + amount * (1 - d2);
    }
  }
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
