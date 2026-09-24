import { CHOICES } from "./catalog";
import { registerFoundCrystal } from "./caves";
import type { Shot } from "./techRules";
import { applyStroke, makeHeights, type Thing } from "./world";

// Everything in the world right now, shared by all the parts of the game.

export interface Wave {
  x: number;
  y: number;
  born: number;
}

// Fire, sparkles, and trails. They're just for show and fade on their own.
export interface Effect {
  kind: "fire" | "sparkle" | "trail" | "laser" | "blast";
  x: number;
  y: number;
  born: number;
  color: string;
  // A laser goes from where it is to here; a blast grows to this size.
  x2?: number;
  y2?: number;
  size?: number;
}

export const EFFECT_MS = { fire: 1500, sparkle: 600, trail: 700, laser: 260, blast: 900 };

export interface Tribe {
  id: string;
  name: string;
  color: string;
  // Ids of the tribes this one is at war with. War goes both ways.
  enemies: string[];
}

// A brush stroke of Raise Land or Sink Land: [x, y, how much].
export type Stroke = [number, number, number];

// A crystal that had never been seen until somebody found it in this world.
// The code is how its pixels are written down in a cave.
export interface FoundCrystal {
  code: string;
  name: string;
  colors: string[];
}

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
  crystals: [] as FoundCrystal[],
  // Added to the height of the whole world: push it up and the sea goes away,
  // push it down and everything drowns.
  flood: 0,
  // Missiles and nukes on their way somewhere. Nothing in the air is saved.
  shots: [] as Shot[],
};

const SAVE_KEY = "world-sandbox-world";
// The world as it was just before the last Reset or New World, so nobody ever
// loses one by accident.
const BACKUP_KEY = "world-sandbox-world-before";
// Save files: a list of what there is, and one key per world.
const FILES_KEY = "world-sandbox-files";
const fileKey = (id: string): string => `world-sandbox-file-${id}`;
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

function isFoundCrystal(value: unknown): value is FoundCrystal {
  const c = value as Partial<FoundCrystal> | null;
  return (
    !!c &&
    typeof c.code === "string" &&
    c.code.length === 1 &&
    typeof c.name === "string" &&
    Array.isArray(c.colors) &&
    c.colors.every((color) => typeof color === "string")
  );
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
  let crystals: FoundCrystal[] = [];
  let flood = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Record<string, unknown> | null;
    if (saved && Number.isFinite(saved["seed"]) && Array.isArray(saved["things"])) {
      seed = saved["seed"] as number;
      things = saved["things"].filter(isThing);
      tribes = Array.isArray(saved["tribes"]) ? saved["tribes"].filter(isTribe) : [];
      strokes = Array.isArray(saved["strokes"]) ? saved["strokes"].filter(isStroke) : [];
      crystals = Array.isArray(saved["crystals"]) ? saved["crystals"].filter(isFoundCrystal) : [];
      flood = Number.isFinite(saved["flood"]) ? (saved["flood"] as number) : 0;
    }
  } catch {
    // Nothing saved, or it got scrambled. Start a fresh world.
  }
  // Put the found crystals back on the list before any cave is opened, so the
  // codes in a saved cave still mean the crystals they were painted with.
  for (const crystal of crystals) registerFoundCrystal(crystal, crystal.code);
  const heights = makeHeights(seed);
  Object.assign(world, { seed, things, tribes, strokes: [], heights, waves: [], effects: [], crystals, shots: [], flood });
  strokesBySpot.clear();
  for (const stroke of strokes) remember(stroke);
  for (const [x, y, amount] of world.strokes) applyStroke(heights, x, y, amount);
  raiseEverything(heights, flood);
}

/** Puts the world as it stands now in the drawer, before wiping it. */
function keepOldWorld(): void {
  try {
    const now = localStorage.getItem(SAVE_KEY);
    if (now) localStorage.setItem(BACKUP_KEY, now);
  } catch {
    // No drawer to put it in, so there will be nothing to undo.
  }
}

export function hasOldWorld(): boolean {
  try {
    return !!localStorage.getItem(BACKUP_KEY);
  } catch {
    return false;
  }
}

/** Puts back the world from just before the last Reset or New World. */
export function restoreOldWorld(): boolean {
  try {
    const old = localStorage.getItem(BACKUP_KEY);
    if (!old) return false;
    localStorage.setItem(SAVE_KEY, old);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    return false;
  }
  loadWorld();
  world.terrainVersion += 1;
  return true;
}

// Reset: the same land you already have, with everything you put on it taken
// off again — including any raising and sinking, so the ground goes back to how
// it first came out.
/** Lifts or sinks the whole world at once. */
function raiseEverything(heights: Float32Array, by: number): void {
  if (by === 0) return;
  for (let i = 0; i < heights.length; i += 1) heights[i] = (heights[i] ?? 0) + by;
}

/**
 * All land, all sea, or back to the way the world came out. It is one number
 * saved with the world, so it costs nothing and can always be undone.
 */
export function setFlood(by: number): void {
  world.flood = by;
  const heights = makeHeights(world.seed);
  for (const [x, y, amount] of world.strokes) applyStroke(heights, x, y, amount);
  raiseEverything(heights, by);
  Object.assign(world, { heights });
  world.terrainVersion += 1;
  save();
}

export function resetWorld(): void {
  saveNow();
  keepOldWorld();
  strokesBySpot.clear();
  Object.assign(world, {
    things: [],
    tribes: [],
    strokes: [],
    heights: makeHeights(world.seed),
    waves: [],
    effects: [],
    shots: [],
    flood: 0,
  });
  world.terrainVersion += 1;
  saveNow();
}

export function newWorld(): void {
  saveNow();
  keepOldWorld();
  const seed = newSeed();
  strokesBySpot.clear();
  Object.assign(world, { seed, things: [], tribes: [], strokes: [], heights: makeHeights(seed), waves: [], effects: [], shots: [], flood: 0 });
  saveNow();
}

/** Whether two tribes are fighting. War goes both ways, so either side's list counts. */
export function tribesAtWar(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a === b) return false;
  return world.tribes.find((t) => t.id === a)?.enemies.includes(b) ?? false;
}

/** Whether this tribe has anybody to fight at all. */
export function tribeHasEnemies(id: string | undefined): boolean {
  return (world.tribes.find((t) => t.id === id)?.enemies.length ?? 0) > 0;
}

/** Keeps a crystal nobody had seen before, so it is still there tomorrow. */
export function rememberCrystal(crystal: FoundCrystal): void {
  if (world.crystals.some((c) => c.code === crystal.code)) return;
  world.crystals.push(crystal);
  save();
}

// Raise Land and Sink Land. Remembered so the land comes back the same.
export function reshape(x: number, y: number, amount: number): void {
  const stroke: Stroke = [Math.round(x), Math.round(y), amount];
  applyStroke(world.heights, ...stroke);
  remember(stroke);
  world.terrainVersion += 1;
}

// A world with a thousand people in it is a few hundred kilobytes of text, and
// somebody is born or defeated every few frames, so writing it out every single
// time is what makes a busy world crawl. Instead it gets written a moment after
// things settle down, and always before the page goes away.
let saveTimer = 0;

export function save(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    saveNow();
  }, 1200);
}

export function saveNow(): void {
  window.clearTimeout(saveTimer);
  saveTimer = 0;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        seed: world.seed,
        things: world.things,
        tribes: world.tribes,
        strokes: world.strokes,
        crystals: world.crystals,
        flood: world.flood,
      }),
    );
  } catch {
    // Can't save, so this world only lasts until the page closes.
  }
}

window.addEventListener("beforeunload", saveNow);
window.addEventListener("pagehide", saveNow);

// ---------- save files ----------

export interface SaveFile {
  id: string;
  name: string;
  savedAt: number;
  people: number;
  things: number;
}

export function listSaveFiles(): SaveFile[] {
  try {
    const files: unknown = JSON.parse(localStorage.getItem(FILES_KEY) ?? "[]");
    if (!Array.isArray(files)) return [];
    return files.filter((f): f is SaveFile => {
      const file = f as Partial<SaveFile> | null;
      return !!file && typeof file.id === "string" && typeof file.name === "string";
    });
  } catch {
    return [];
  }
}

function writeFileList(files: SaveFile[]): void {
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(files));
  } catch {
    // Out of room; the list stays as it was.
  }
}

const worldAsText = (): string =>
  JSON.stringify({
    seed: world.seed,
    things: world.things,
    tribes: world.tribes,
    strokes: world.strokes,
    crystals: world.crystals,
  });

/**
 * Writes the world as it stands into a save file, making a new one or writing
 * over the one with this id. Null when the browser has no room left for it.
 */
export function saveToFile(name: string, id = `save-${Date.now().toString(36)}`): SaveFile | null {
  const file: SaveFile = {
    id,
    name: name.trim() || "Untitled World",
    savedAt: Date.now(),
    people: world.things.filter((t) => t.type === "person").length,
    things: world.things.length,
  };
  try {
    localStorage.setItem(fileKey(id), worldAsText());
  } catch {
    return null;
  }
  const files = listSaveFiles().filter((f) => f.id !== id);
  writeFileList([file, ...files]);
  return file;
}

/** Opens a save file. The world you were in goes in the drawer first. */
export function loadSaveFile(id: string): boolean {
  let text: string | null = null;
  try {
    text = localStorage.getItem(fileKey(id));
  } catch {
    return false;
  }
  if (!text) return false;
  saveNow();
  keepOldWorld();
  try {
    localStorage.setItem(SAVE_KEY, text);
  } catch {
    return false;
  }
  loadWorld();
  world.terrainVersion += 1;
  return true;
}

export function deleteSaveFile(id: string): void {
  try {
    localStorage.removeItem(fileKey(id));
  } catch {
    // Nothing to remove.
  }
  writeFileList(listSaveFiles().filter((f) => f.id !== id));
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
