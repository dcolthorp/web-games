import { CHOICES } from "./catalog";
import { HEAVEN } from "./heaven";
import { registerFoundCrystal } from "./caves";
import type { Shot } from "./techRules";
import { COLS, ROWS, applyStroke, isLand, makeHeights, type Thing } from "./world";

const HOME = "home";

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
  // Which dimension this is. The world you started in is "home".
  id: HOME,
  // How this dimension's colours are swapped about (see dimension.ts). 0 at home.
  hue: 0,
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
// Every dimension you are not standing in right now is put away under its own key.
const dimensionKey = (id: string): string => `world-sandbox-dimension-${id}`;
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
  let id = HOME;
  let hue = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Record<string, unknown> | null;
    if (saved && Number.isFinite(saved["seed"]) && Array.isArray(saved["things"])) {
      seed = saved["seed"] as number;
      things = saved["things"].filter(isThing);
      tribes = Array.isArray(saved["tribes"]) ? saved["tribes"].filter(isTribe) : [];
      strokes = Array.isArray(saved["strokes"]) ? saved["strokes"].filter(isStroke) : [];
      crystals = Array.isArray(saved["crystals"]) ? saved["crystals"].filter(isFoundCrystal) : [];
      flood = Number.isFinite(saved["flood"]) ? (saved["flood"] as number) : 0;
      id = typeof saved["id"] === "string" ? saved["id"] : HOME;
      hue = Number.isFinite(saved["hue"]) ? (saved["hue"] as number) : 0;
    }
  } catch {
    // Nothing saved, or it got scrambled. Start a fresh world.
  }
  // Put the found crystals back on the list before any cave is opened, so the
  // codes in a saved cave still mean the crystals they were painted with.
  for (const crystal of crystals) registerFoundCrystal(crystal, crystal.code);
  const heights = makeHeights(seed);
  Object.assign(world, { id, hue, seed, things, tribes, strokes: [], heights, waves: [], effects: [], crystals, shots: [], flood });
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

// ---------- portals ----------

/**
 * Goes through a portal. This dimension is put away and the one on the other
 * side comes out. The first time anybody goes through, the other side is made
 * fresh: new land, new colours, and a portal back standing where you come out.
 * Gives back whether it was brand new, or null if the browser had no room.
 */
export function goThrough(portal: Thing): "new" | "old" | null {
  const tribe = world.tribes.find((t) => t.id === portal.tribe);
  const to = (portal.to ??= `dim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const went = travelTo(to, () => newDimension(to, portal.tribe));
  // Whoever owns the portal owns the one home too, so their
  // tribe comes along, colours and all. Who they were at war with stays home.
  if (went === "new" && tribe) world.tribes.push({ ...tribe, enemies: [] });
  saveNow();
  return went;
}

const newHeaven = (): { things: Thing[] } & Record<string, unknown> =>
  ({ id: HEAVEN, hue: 0, seed: newSeed(), things: [], tribes: [], strokes: [], crystals: world.crystals });

/** Where the slime boat sends you: a sky full of clouds, made the first time you go. */
export function goToHeaven(): "new" | "old" | null {
  return travelTo(HEAVEN, newHeaven);
}

/**
 * Everybody the slime boat fires off the top of the map lands in Heaven as an
 * angel, keeping their name. Heaven is made for them if nobody has been yet.
 */
export function welcomeToHeaven(people: Thing[]): void {
  const angels: Thing[] = people.map((p) => ({
    type: "angel",
    x: COLS * (0.1 + Math.random() * 0.8),
    y: ROWS * (0.15 + Math.random() * 0.8),
    ...(p.name ? { name: p.name } : {}),
  }));
  try {
    const saved = localStorage.getItem(dimensionKey(HEAVEN));
    const heaven = saved ? (JSON.parse(saved) as { things: Thing[] }) : newHeaven();
    heaven.things.push(...angels);
    localStorage.setItem(dimensionKey(HEAVEN), JSON.stringify(heaven));
  } catch {
    // No room up there, so they just fly away.
  }
}

/** Puts this world away and brings out the one called `to`, made with `make` if there isn't one yet. */
function travelTo(to: string, make: () => object): "new" | "old" | null {
  saveNow();
  let fresh = false;
  try {
    localStorage.setItem(dimensionKey(world.id), localStorage.getItem(SAVE_KEY) ?? "");
    let there = localStorage.getItem(dimensionKey(to));
    if (!there) {
      fresh = true;
      there = JSON.stringify(make());
    }
    localStorage.setItem(SAVE_KEY, there);
  } catch {
    return null;
  }
  loadWorld();
  world.terrainVersion += 1;
  return fresh ? "new" : "old";
}

function newDimension(id: string, tribe: string | undefined): object {
  const seed = newSeed();
  const back: Thing = { type: "portal", ...landNearMiddle(makeHeights(seed)), to: HOME, ...(tribe ? { tribe } : {}) };
  return { id, hue: 1 + Math.floor(Math.random() * 2 ** 30), seed, things: [back], tribes: [], strokes: [], crystals: world.crystals };
}

/**
 * Every other dimension always has a portal that goes straight back to the
 * world you started in, however many portals you came through to get there.
 * If it gets wiped out (a nuke, Reset, New World), a new one turns up, so
 * nobody is ever stuck.
 */
export function keepWayHome(): void {
  if (world.id === HOME || world.things.some((t) => t.type === "portal" && t.to === HOME)) return;
  world.things.push({ type: "portal", ...landNearMiddle(world.heights), to: HOME });
  save();
}

/** The bit of land nearest the middle of the map. */
function landNearMiddle(heights: Float32Array): { x: number; y: number } {
  let spot = { x: COLS / 2, y: ROWS / 2 };
  let best = Infinity;
  for (let y = 12; y < ROWS - 4; y += 2) {
    for (let x = 6; x < COLS - 6; x += 2) {
      const d = Math.hypot(x - COLS / 2, y - ROWS / 2);
      if (d < best && isLand(heights, x, y)) {
        best = d;
        spot = { x, y };
      }
    }
  }
  return spot;
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
        id: world.id,
        hue: world.hue,
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
    id: world.id,
    hue: world.hue,
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
