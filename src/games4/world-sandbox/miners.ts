import { MATERIALS, TUNNEL, isCrystal } from "./caves";
import { H, W, type Thing } from "./world";

// People going into the caves you dug. Somebody who wanders past the mouth of
// a mountain that has a cave in it will go in, potter about in the tunnels for
// a while, and come back out — sometimes holding a crystal they chipped off
// the wall.

// Where the tunnel meets the outside world, which is where makeCave starts
// digging: the left-hand wall, a little above the floor.
export const CAVE_MOUTH = { x: 8, y: H - 40 };

export const ENTER_RANGE = 7;
export const ENTER_CHANCE = 1 / 260;
export const LEAVE_CHANCE = 1 / 900;
export const FIND_CHANCE = 1 / 90;

export function isInside(p: Thing): boolean {
  return Array.isArray(p.inside);
}

/**
 * The mountain somebody walked into. They remember the spot rather than the
 * mountain, and a mountain can move — gravity gets switched off, a celestial
 * being throws it somewhere — so this takes whichever mountain is nearest to
 * where they went in.
 */
export function mountainOf(p: Thing, things: Thing[]): Thing | undefined {
  const where = p.inside;
  if (!where) return undefined;
  let best: Thing | undefined;
  let bestDistance = Infinity;
  for (const t of things) {
    if (t.type !== "mountain") continue;
    const d = Math.hypot(t.x - where[0], t.y - where[1]);
    if (d < bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

export function insideOf(mountain: Thing, things: Thing[]): Thing[] {
  return things.filter((p) => isInside(p) && mountainOf(p, things) === mountain);
}

export function tunnelAt(grid: Uint8Array, x: number, y: number): boolean {
  const col = Math.round(x);
  const row = Math.round(y);
  if (col < 0 || row < 0 || col >= W || row >= H) return false;
  return grid[row * W + col] === TUNNEL;
}

/**
 * One shuffle along a tunnel. They keep going the way they were going while
 * there's tunnel there, and turn when there isn't. Returns where they end up,
 * which is where they already were if they're walled in.
 */
export function stepInTunnel(
  grid: Uint8Array,
  x: number,
  y: number,
  heading: number,
  roll: () => number
): { x: number; y: number; heading: number } {
  const wobble = heading + (roll() - 0.5) * 0.5;
  for (const turn of [0, 0.9, -0.9, 1.9, -1.9, Math.PI]) {
    const tryHeading = wobble + turn;
    const nx = x + Math.cos(tryHeading) * 0.6;
    const ny = y + Math.sin(tryHeading) * 0.6;
    if (tunnelAt(grid, nx, ny)) return { x: nx, y: ny, heading: tryHeading };
  }
  return { x, y, heading: heading + Math.PI };
}

/**
 * The nearest bit of tunnel, for somebody who has ended up in solid rock —
 * either because the cave was dug differently since they walked in, or because
 * somebody painted a wall over them. Null if this cave has no tunnel at all.
 */
export function nearestTunnel(grid: Uint8Array, x: number, y: number): { x: number; y: number } | null {
  if (tunnelAt(grid, x, y)) return { x, y };
  for (let ring = 1; ring < Math.max(W, H); ring += 2) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const nx = x + Math.cos(angle) * ring;
      const ny = y + Math.sin(angle) * ring;
      if (tunnelAt(grid, nx, ny)) return { x: Math.round(nx), y: Math.round(ny) };
    }
  }
  return null;
}

/** The nearest bit of ore anywhere in the cave, for a miner to head towards. */
export function nearestOre(grid: Uint8Array, x: number, y: number, isOre: (material: number) => boolean): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < grid.length; i += 1) {
    if (!isOre(grid[i] ?? 0)) continue;
    const ox = i % W;
    const oy = (i - ox) / W;
    const d = (ox - x) ** 2 + (oy - y) ** 2;
    if (d < bestDistance) {
      best = { x: ox, y: oy };
      bestDistance = d;
    }
  }
  return best;
}

/** The name of a crystal in the wall right next to them, if there is one. */
export function crystalBeside(grid: Uint8Array, x: number, y: number): string | null {
  const col = Math.round(x);
  const row = Math.round(y);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = col + (dx ?? 0);
    const ny = row + (dy ?? 0);
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const material = grid[ny * W + nx] ?? 0;
    if (isCrystal(material)) return MATERIALS[material]?.name ?? null;
  }
  return null;
}
