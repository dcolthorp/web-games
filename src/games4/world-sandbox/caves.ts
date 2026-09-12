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

export const MATERIALS: Material[] = [
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
export function makeCave(seed: number): Uint8Array {
  const rand = seededRandom(seed);
  const grid = new Uint8Array(W * H).fill(ROCK);
  let x = 0;
  let y = H - 40;
  let heading = 0;
  for (let branch = 0; branch < 5; branch += 1) {
    for (let i = 0; i < 180; i += 1) {
      heading += (rand() - 0.5) * 0.8;
      x += Math.cos(heading) * 2;
      y += Math.sin(heading) * 2;
      // Bounce off the edges.
      if (x < 6 || x > W - 7) heading = Math.PI - heading;
      if (y < 10 || y > H - 11) heading = -heading;
      x = Math.min(W - 7, Math.max(6, x));
      y = Math.min(H - 11, Math.max(10, y));
      paint(grid, x, y, 3 + rand() * 4, TUNNEL);
    }
    heading = rand() * Math.PI * 2;
  }
  for (let i = 0; i < 16; i += 1) {
    paint(grid, rand() * W, rand() * H, 2 + rand() * 2, materialIndex(i % 2 ? "i" : "c"));
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
