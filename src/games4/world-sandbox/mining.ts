import { MATERIALS, ROCK, TUNNEL, decodeCave, encodeCave, makeCave } from "./caves";
import { blowUp } from "./cavern";
import { H, W, type Thing } from "./world";

// Caves that are being worked. A cave only exists as a grid while somebody is
// looking at it or mining in it; the rest of the time it is a line of text on
// the mountain. This is the one place that turns one into the other, so the
// player and the miners are always digging in the same cave.

const grids = new Map<string, Uint8Array>();
const oreCounts = new Map<string, number>();

// A cave is remembered by whichever mountain it was first dug from, so a
// mountain that drifts keeps the cave it already had.
const keys = new WeakMap<Thing, string>();
let nextKey = 0;

export function caveKey(mountain: Thing): string {
  let key = keys.get(mountain);
  if (!key) {
    key = `cave-${(nextKey += 1)}-${Math.round(mountain.x)},${Math.round(mountain.y)}`;
    keys.set(mountain, key);
  }
  return key;
}

export const isOre = (material: number): boolean =>
  material > ROCK && MATERIALS[material]?.goesIn === "rock";

/** Every pixel of ore or crystal left in a cave. */
export function countOre(grid: Uint8Array): number {
  let ore = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (isOre(grid[i] ?? 0)) ore += 1;
  }
  return ore;
}

/** The cave inside this mountain, dug fresh the first time anybody goes in. */
export function gridFor(mountain: Thing): Uint8Array {
  const key = caveKey(mountain);
  let grid = grids.get(key);
  if (!grid) {
    grid = (mountain.cave && decodeCave(mountain.cave)) || makeCave(Math.floor(mountain.x * 1000 + mountain.y), mountain.size ?? 1);
    grids.set(key, grid);
    oreCounts.set(key, countOre(grid));
  }
  return grid;
}

export function oreLeft(mountain: Thing): number {
  const key = caveKey(mountain);
  if (!grids.has(key)) gridFor(mountain);
  return oreCounts.get(key) ?? 0;
}

/** Writes the cave back onto its mountain. */
export function storeCave(mountain: Thing): void {
  const grid = grids.get(caveKey(mountain));
  if (grid) mountain.cave = encodeCave(grid);
}

/** Writes it back and forgets it, for a cave nobody is working any more. */
export function releaseCave(mountain: Thing): void {
  storeCave(mountain);
  grids.delete(caveKey(mountain));
  oreCounts.delete(caveKey(mountain));
}

export const isBeingWorked = (mountain: Thing): boolean => grids.has(caveKey(mountain));

/**
 * Chips out the lump of ore touching this spot: the pixel next to them and
 * whatever is joined to it, up to a pocketful. Returns what it was called, or
 * null if there was nothing there to mine.
 */
export function dig(mountain: Thing, x: number, y: number, most = 40): string | null {
  const grid = gridFor(mountain);
  const key = caveKey(mountain);
  const start = seamNear(grid, x, y);
  if (start === null) return null;
  const name = MATERIALS[grid[start] ?? 0]?.name ?? null;
  const wanted = grid[start];

  // Follow the seam outwards, taking the same kind of ore as it goes.
  const stack = [start];
  const seen = new Set<number>();
  let taken = 0;
  while (stack.length > 0 && taken < most) {
    const at = stack.pop() as number;
    if (seen.has(at) || grid[at] !== wanted) continue;
    seen.add(at);
    grid[at] = TUNNEL;
    taken += 1;
    const col = at % W;
    if (col > 0) stack.push(at - 1);
    if (col < W - 1) stack.push(at + 1);
    if (at >= W) stack.push(at - W);
    if (at < W * H - W) stack.push(at + W);
  }
  oreCounts.set(key, Math.max(0, (oreCounts.get(key) ?? 0) - taken));
  return name;
}

/**
 * A miner digging their way towards a seam. They chew a hole through the rock
 * as they go, which is why a cave with a miner in it ends up full of narrow
 * passages that stop at nothing.
 */
export function tunnelTowards(mountain: Thing, from: { x: number; y: number }, to: { x: number; y: number }, step = 0.7): { x: number; y: number } {
  const grid = gridFor(mountain);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const x = from.x + (dx / d) * step;
  const y = from.y + (dy / d) * step;
  blowUp(grid, x, y, 1.7);
  return { x, y };
}

/** How close two miners' seams have to be to count as the same lump of ore. */
export const SAME_SEAM = 9;

/**
 * Who was digging towards the ore somebody else just took. A tribe doesn't
 * fall out with itself, and it makes no difference whether the two tribes were
 * at war or whether either of them is a peaceful sort: they both wanted it.
 */
export function rivalsOver<T extends { tribe?: string; seam?: [number, number] }>(
  spot: { x: number; y: number },
  digger: T,
  others: T[]
): T[] {
  return others.filter((other) => {
    if (other === digger || !other.seam) return false;
    if ((other.tribe ?? "") === (digger.tribe ?? "")) return false;
    return Math.hypot(other.seam[0] - spot.x, other.seam[1] - spot.y) <= SAME_SEAM;
  });
}

/** The nearest bit of ore within arm's reach, as a place in the grid. */
function seamNear(grid: Uint8Array, x: number, y: number, reach = 3): number | null {
  const col = Math.round(x);
  const row = Math.round(y);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const at = ny * W + nx;
      if (isOre(grid[at] ?? 0)) return at;
    }
  }
  return null;
}

