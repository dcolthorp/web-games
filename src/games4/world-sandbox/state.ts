import { CHOICES } from "./catalog";
import { applyStroke, makeHeights, type Thing } from "./world";

// Everything in the world right now, shared by all the parts of the game.

export interface Wave {
  x: number;
  y: number;
  born: number;
}

// Fire, sparkles, and trails. They're just for show and fade on their own.
export interface Effect {
  kind: "fire" | "sparkle" | "trail";
  x: number;
  y: number;
  born: number;
  color: string;
}

export const EFFECT_MS = { fire: 1500, sparkle: 600, trail: 700 };

export interface Tribe {
  id: string;
  name: string;
  color: string;
  // Ids of the tribes this one is at war with. War goes both ways.
  enemies: string[];
}

// A brush stroke of Raise Land or Sink Land: [x, y, how much].
export type Stroke = [number, number, number];

export const world = {
  seed: 0,
  heights: new Float32Array(0),
  // Every land brush stroke, replayed on top of the seed's land when loading.
  strokes: [] as Stroke[],
  // Goes up whenever the land changes, so it gets drawn again.
  terrainVersion: 0,
  things: [] as Thing[],
  tribes: [] as Tribe[],
  waves: [] as Wave[],
  effects: [] as Effect[],
};

const SAVE_KEY = "world-sandbox-world";
const NOTE_MS = 2600;

const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

function isThing(value: unknown): value is Thing {
  const t = value as Partial<Thing> | null;
  return !!t && CHOICES.has(t.type ?? "") && Number.isFinite(t.x) && Number.isFinite(t.y);
}

function isTribe(value: unknown): value is Tribe {
  const t = value as Partial<Tribe> | null;
  return !!t && typeof t.id === "string" && typeof t.name === "string" && typeof t.color === "string" && Array.isArray(t.enemies);
}

const isStroke = (value: unknown): value is Stroke =>
  Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));

// Strokes on the same spot add up, so they're kept as one stroke per spot.
// That stops the save growing forever while you scribble.
const strokesBySpot = new Map<string, Stroke>();

function remember([x, y, amount]: Stroke): void {
  const key = `${x},${y}`;
  const existing = strokesBySpot.get(key);
  if (existing) {
    existing[2] += amount;
    return;
  }
  const stroke: Stroke = [x, y, amount];
  world.strokes.push(stroke);
  strokesBySpot.set(key, stroke);
}

export function loadWorld(): void {
  let seed = newSeed();
  let things: Thing[] = [];
  let tribes: Tribe[] = [];
  let strokes: Stroke[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Record<string, unknown> | null;
    if (saved && Number.isFinite(saved["seed"]) && Array.isArray(saved["things"])) {
      seed = saved["seed"] as number;
      things = saved["things"].filter(isThing);
      tribes = Array.isArray(saved["tribes"]) ? saved["tribes"].filter(isTribe) : [];
      strokes = Array.isArray(saved["strokes"]) ? saved["strokes"].filter(isStroke) : [];
    }
  } catch {
    // Nothing saved, or it got scrambled. Start a fresh world.
  }
  const heights = makeHeights(seed);
  Object.assign(world, { seed, things, tribes, strokes: [], heights, waves: [], effects: [] });
  strokesBySpot.clear();
  for (const stroke of strokes) remember(stroke);
  for (const [x, y, amount] of world.strokes) applyStroke(heights, x, y, amount);
}

export function newWorld(): void {
  const seed = newSeed();
  strokesBySpot.clear();
  Object.assign(world, { seed, things: [], tribes: [], strokes: [], heights: makeHeights(seed), waves: [], effects: [] });
  save();
}

// Raise Land and Sink Land. Remembered so the land comes back the same.
export function reshape(x: number, y: number, amount: number): void {
  const stroke: Stroke = [Math.round(x), Math.round(y), amount];
  applyStroke(world.heights, ...stroke);
  remember(stroke);
  world.terrainVersion += 1;
}

export function save(): void {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ seed: world.seed, things: world.things, tribes: world.tribes, strokes: world.strokes }),
    );
  } catch {
    // Can't save, so this world only lasts until the page closes.
  }
}

let note = "";
let noteAt = -Infinity;

// Shows a message under the map for a few seconds.
export function say(text: string): void {
  note = text;
  noteAt = performance.now();
}

export function currentNote(now: number): string | null {
  return now - noteAt < NOTE_MS ? note : null;
}
