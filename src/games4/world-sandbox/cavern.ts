import { MATERIALS, ROCK, TUNNEL } from "./caves";
import { H, W } from "./world";

// Bombs, and what living in a cave means. The rules only, so they can be
// checked without a cave on screen.

export interface BombKind {
  id: string;
  name: string;
  radius: number;
  // Frames of fuse before it goes off.
  fuse: number;
}

export const BOMBS: BombKind[] = [
  { id: "bomb", name: "Bomb", radius: 11, fuse: 150 },
  { id: "big-bomb", name: "Big Bomb", radius: 24, fuse: 220 },
];

export const bombKind = (id: string): BombKind | undefined => BOMBS.find((b) => b.id === id);
export const isBomb = (type: string): boolean => BOMBS.some((b) => b.id === type);

/**
 * Blows a hole in the rock. Plain rock goes; crystals are left hanging there
 * in the open, which is the entire reason for setting one off. Lava and water
 * are left where they are too — they'll flow into the hole on their own.
 */
export function blowUp(grid: Uint8Array, cx: number, cy: number, radius: number): number {
  let dug = 0;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const i = y * W + x;
      if (grid[i] !== ROCK) continue;
      grid[i] = TUNNEL;
      dug += 1;
    }
  }
  return dug;
}

/** What the blast uncovered, so it can say what you found. */
export function crystalsAround(grid: Uint8Array, cx: number, cy: number, radius: number): string[] {
  const found = new Set<string>();
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const material = grid[y * W + x] ?? 0;
      if (material > ROCK) {
        const m = MATERIALS[material];
        if (m && m.goesIn === "rock") found.add(m.name);
      }
    }
  }
  return [...found];
}

/** Whether a bomb caught something standing this close to it. */
export function inBlast(radius: number, cx: number, cy: number, x: number, y: number): boolean {
  return Math.hypot(x - cx, y - cy) <= radius;
}
