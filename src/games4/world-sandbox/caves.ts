import { BUILT_IN_CODES, CRYSTALS, FOUND_CODES, type CrystalSpec } from "./crystals";
import { H, W, seededRandom } from "./world";

// Inside a mountain: a side-on slice of rock with tunnels through it, one
// material per pixel, the same size as the world map. A cave is saved as text
// with runs of the same material squashed together ("#312.9#40…"), so lots of
// caves still fit in the save.

export interface Material {
  code: string;
  name: string;
  // Pixels pick one of these, so walls and ores look speckled.
  colors: string[];
  // What it can be painted over.
  goesIn: "anything" | "rock" | "tunnel";
}

const BASE: Material[] = [
  { code: ".", name: "Dig", colors: ["#0c0a14", "#120f1c"], goesIn: "anything" },
  { code: "#", name: "Rock", colors: ["#5d626b", "#4f545c", "#686d76"], goesIn: "anything" },
  { code: "c", name: "Coal", colors: ["#1b1b1f", "#2e2e34"], goesIn: "rock" },
  { code: "i", name: "Iron", colors: ["#d9a066", "#b07a45"], goesIn: "rock" },
  { code: "g", name: "Gold", colors: ["#f7d23e", "#ee9a2a"], goesIn: "rock" },
  { code: "d", name: "Diamond", colors: ["#9fe3ff", "#f4f1ea", "#5fc0e8"], goesIn: "rock" },
  { code: "e", name: "Emerald", colors: ["#3f9a3a", "#86d86e"], goesIn: "rock" },
  { code: "a", name: "Amethyst", colors: ["#9b59d9", "#5b2d8f"], goesIn: "rock" },
  { code: "o", name: "Diorite", colors: ["#f4f1ea", "#9aa0a8"], goesIn: "rock" },
  { code: "k", name: "Calcite", colors: ["#eae6da", "#cfc6b0"], goesIn: "rock" },
  // The beautiful one from the book Planet Earth. Its colours cycle.
  { code: "r", name: "Rainbow Crystal", colors: ["#d8362b", "#ee7a2a", "#f7d23e", "#3f9a3a", "#3b7fe0", "#9b59d9"], goesIn: "rock" },
  { code: "l", name: "Lava", colors: ["#ee7a2a", "#d8362b", "#f7d23e"], goesIn: "tunnel" },
  { code: "w", name: "Water", colors: ["#3b7fe0", "#1d5fb8"], goesIn: "tunnel" },
];

// The dig, rock, lava and water tools first, then every crystal we know about,
// then any crystal somebody found that nobody had ever seen before. A cave
// remembers materials by their code, so codes have to keep meaning the same
// thing forever: built-in crystals take theirs in list order.
const takenCodes = new Set(BASE.map((m) => m.code));
const freeBuiltInCodes = BUILT_IN_CODES.filter((code) => !takenCodes.has(code));

export const MATERIALS: Material[] = [
  ...BASE,
  ...CRYSTALS.map((crystal, index) => ({
    code: freeBuiltInCodes[index] ?? "",
    name: crystal.name,
    colors: crystal.colors,
    goesIn: "rock" as const,
  })).filter((m) => m.code !== ""),
];
for (const m of MATERIALS) takenCodes.add(m.code);

// One material per pixel, so this is as many kinds of crystal as a cave can
// hold. There is room for plenty of crystals nobody has found yet.
export const MAX_MATERIALS = 256;

// Anything that belongs in the rock walls: every ore and every crystal, but
// not the digging tool, the rock itself, or lava and water.
export function isCrystal(material: number): boolean {
  return MATERIALS[material]?.goesIn === "rock";
}

/**
 * Adds a crystal nobody has ever seen to the list, with its own save code.
 * Returns its material number, or -1 when every code is spoken for.
 */
export function registerFoundCrystal(crystal: CrystalSpec, code?: string): number {
  const existing = MATERIALS.findIndex((m) => m.code === code);
  if (code && existing >= 0) return existing;
  const free = code && !takenCodes.has(code) ? code : FOUND_CODES.find((c) => !takenCodes.has(c));
  if (!free || MATERIALS.length >= MAX_MATERIALS) return -1;
  takenCodes.add(free);
  MATERIALS.push({ code: free, name: crystal.name, colors: crystal.colors, goesIn: "rock" });
  return MATERIALS.length - 1;
}

export const TUNNEL = 0;
export const ROCK = 1;
const materialIndex = (code: string): number => MATERIALS.findIndex((m) => m.code === code);

// Fills a round blob with a material, skipping pixels it can't go in. Returns
// how many pixels changed.
export function paint(grid: Uint8Array, cx: number, cy: number, radius: number, material: number): number {
  const goesIn = MATERIALS[material]?.goesIn;
  let changed = 0;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, cy + radius); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, cx + radius); x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const i = y * W + x;
      const here = grid[i];
      if (here === material || (goesIn === "rock" && here !== ROCK) || (goesIn === "tunnel" && here !== TUNNEL)) continue;
      grid[i] = material;
      changed += 1;
    }
  }
  return changed;
}

// Solid rock, with a tunnel coming in from the left that wanders around and
// branches, and a little coal and iron already in the walls.
//
// `size` is how big the mountain is: a little hill of a mountain has a poky
// cave with a couple of seams in it, and a huge one is riddled with tunnels
// from end to end and full of ore.
export function makeCave(seed: number, size = 1): Uint8Array {
  const rand = seededRandom(seed);
  const grid = new Uint8Array(W * H).fill(ROCK);
  const reach = Math.min(1, Math.max(0.28, size / 2.4));
  // The cave sits around the mouth, and only a big mountain has room for
  // tunnels right across the rock.
  const top = 10 + (1 - reach) * (H - 60);
  const bottom = H - 11;
  const right = 6 + reach * (W - 13);
  let x = 0;
  let y = H - 40;
  let heading = 0;
  for (let branch = 0; branch < Math.round(2 + 4 * reach); branch += 1) {
    for (let i = 0; i < Math.round(80 + 140 * reach); i += 1) {
      heading += (rand() - 0.5) * 0.8;
      x += Math.cos(heading) * 2;
      y += Math.sin(heading) * 2;
      // Bounce off the walls of the mountain.
      if (x < 6 || x > right) heading = Math.PI - heading;
      if (y < top || y > bottom) heading = -heading;
      x = Math.min(right, Math.max(6, x));
      y = Math.min(bottom, Math.max(top, y));
      paint(grid, x, y, 3 + rand() * 4, TUNNEL);
    }
    heading = rand() * Math.PI * 2;
  }
  for (let i = 0; i < Math.round(6 + 22 * reach); i += 1) {
    paint(grid, 6 + rand() * (right - 6), top + rand() * (bottom - top), 2 + rand() * 2, materialIndex(i % 2 ? "i" : "c"));
  }
  return grid;
}

export function encodeCave(grid: Uint8Array): string {
  const runs: string[] = [];
  let start = 0;
  for (let i = 1; i <= grid.length; i += 1) {
    if (i < grid.length && grid[i] === grid[start]) continue;
    runs.push(`${MATERIALS[grid[start] ?? ROCK]?.code ?? "#"}${i - start}`);
    start = i;
  }
  return runs.join("");
}

// Null if the text isn't a whole cave.
export function decodeCave(text: string): Uint8Array | null {
  const grid = new Uint8Array(W * H);
  let i = 0;
  for (const [, code = "", count = ""] of text.matchAll(/(\D)(\d+)/g)) {
    const material = materialIndex(code);
    const end = i + Number(count);
    if (material < 0 || end > grid.length) return null;
    grid.fill(material, i, end);
    i = end;
  }
  return i === grid.length ? grid : null;
}
