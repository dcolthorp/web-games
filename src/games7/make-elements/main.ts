import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { ACHIEVEMENTS, ELEMENTS, FLOAT_UP, KEEP_MOVING, LANDINGS, STARTERS, STAY_STILL, combine, comboAchievement, element, hintFor, howToMake } from "./elements";

installOofShortcut();
installForceRefreshHotkey();

// Make Elements: Oscar's factory game. Spawners make elements, conveyor belts
// carry them, combiners mix two into something new, and sellers turn them
// into money. There's no character: the camera is you.
//
// The world is seen from the side, so gravity pulls things down. Everything
// moves one square at a time, every STEP seconds.

const W = 48;
const H = 24;
const CELL = 40;
const STEP = 0.2;
const SPAWN_EVERY = 2;
const CRAFT_TIME = 0.6;
const HEAT_TIME = 1.5;
const SAVE_KEY = "make-elements-save";
// Played at localhost on this computer, the game also saves to a file
// (saves/make-elements.json, through the dev server), so restarting the app
// can't wipe it. Anywhere else, like 127.0.0.1 for testing or another device,
// it only saves in the browser, so testing can never touch the real save.
const SAVE_FILE_URL = "/api/save/make-elements";
const useSaveFile = location.hostname === "localhost";
// If the save file couldn't be read, never write over it.
let saveFileBroken = false;

// 0 right, 1 down, 2 left, 3 up
type Dir = 0 | 1 | 2 | 3;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const ARROWS = ["→", "↓", "←", "↑"];

type TileKind = "belt" | "switch" | "spawner" | "double" | "combiner" | "oven" | "seller" | "pusher" | "speedo" | "wall";

// Machines that things can go into, from a belt, falling, or getting pushed.
const takesThingsIn = (tile: Tile | undefined) =>
  tile?.kind === "seller" || tile?.kind === "combiner" || tile?.kind === "oven";

// Machines you can't move through: things land on them and pile up against them.
const isSolid = (tile: Tile | undefined) =>
  tile?.kind === "spawner" || tile?.kind === "double" || tile?.kind === "pusher" || tile?.kind === "speedo" || tile?.kind === "wall";

interface Tile {
  kind: TileKind;
  dir: Dir;
  // Switch belts (Oscar's multi-choice conveyors): they go `dir` for a bit,
  // then `dir2`, then back again.
  dir2: Dir;
  flipped: boolean;
  // Spawners: which element comes out. Pushers: the only element they push
  // (or anything, if it's not set).
  el?: string;
  timer: number;
  // Combiners: what's inside waiting to be mixed, and what's waiting to come out.
  hold: string[];
  out: string[];
}

interface Item {
  el: string;
  x: number;
  y: number;
  // Where it was last step, for sliding smoothly between squares.
  fromX: number;
  fromY: number;
  still: number;
  heat: number;
  falling: boolean;
  // How long it's been floating up without stopping.
  rising: number;
  // How long it's been moving without stopping.
  moving: number;
  moved: boolean;
}

const COSTS: Record<Exclude<TileKind, "spawner">, number> = { belt: 2, switch: 8, combiner: 25, seller: 15, pusher: 12, double: 25, speedo: 40, oven: 30, wall: 1 };
// How long a switch belt goes one way before it switches.
const SWITCH_EVERY = 3;
// How often a pusher can shove the thing in front of it.
const PUSH_EVERY = 0.4;
// Machines next to a Speeder (in the 3x3 square around it) go this many times faster.
const SPEEDO_BOOST = 2;
// How long the oven takes to cook one thing.
const OVEN_TIME = 0.4;
const spawnerCost = (el: string) => element(el).value * 10;

// ---------- The world ----------

let money = 100;
const found = new Set<string>(STARTERS);
const achieved = new Set<string>();
const tiles = new Map<number, Tile>();
let items: Item[] = [];
const itemAt = new Map<number, Item>();

const key = (x: number, y: number) => y * W + x;
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

function newTile(kind: TileKind, dir: Dir, el?: string, dir2: Dir = dir): Tile {
  return { kind, dir, dir2, flipped: false, el, timer: 0, hold: [], out: [] };
}

// Which way a belt is going right now.
function beltDir(tile: Tile): Dir {
  return tile.kind === "switch" && tile.flipped ? tile.dir2 : tile.dir;
}

function addItem(el: string, x: number, y: number, fromX = x, fromY = y): Item {
  const item: Item = { el, x, y, fromX, fromY, still: 0, heat: 0, falling: false, rising: 0, moving: 0, moved: true };
  items.push(item);
  itemAt.set(key(x, y), item);
  discover(el);
  return item;
}

function removeItem(item: Item): void {
  itemAt.delete(key(item.x, item.y));
  items = items.filter((i) => i !== item);
}

function changeItem(item: Item, el: string): void {
  item.el = el;
  item.still = 0;
  item.heat = 0;
  item.rising = 0;
  item.moving = 0;
  discover(el);
  puff(item.x, item.y, element(el).emoji);
}

// ---------- Money, discoveries and little pop-ups ----------

const moneyEl = document.getElementById("money")!;
const foundCountEl = document.getElementById("found-count")!;
const toastsEl = document.getElementById("toasts")!;

function showMoney(): void {
  moneyEl.textContent = `$${Math.floor(money).toLocaleString()}`;
  foundCountEl.textContent = `${found.size}/${ELEMENTS.length}`;
  refreshAffordable();
}

function toast(text: string): void {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  toastsEl.prepend(t);
  window.setTimeout(() => t.remove(), 3500);
}

// Achievements you get for finding a set of elements.
function checkFoundAchievements(): void {
  for (const a of ACHIEVEMENTS) {
    if (a.needs?.every((id) => found.has(id))) achieve(a.id);
  }
}

function discover(el: string): void {
  if (found.has(el)) return;
  found.add(el);
  checkFoundAchievements();
  const e = element(el);
  // A bonus for every new discovery.
  const bonus = e.value * 5;
  money += bonus;
  toast(`New element! ${e.emoji} ${e.name}  +$${bonus}`);
  showMoney();
  renderPicker();
  if (!pediaEl.hidden) renderPedia();
}

function achieve(id: string): void {
  if (achieved.has(id)) return;
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return;
  achieved.add(id);
  toast(`🏆 Achievement! ${ach.emoji} ${ach.name}`);
  save();
  if (!pediaEl.hidden) renderPedia();
}

interface Floater {
  x: number;
  y: number;
  text: string;
  age: number;
}
const floaters: Floater[] = [];

function puff(x: number, y: number, text: string): void {
  floaters.push({ x: x + 0.5, y: y + 0.3, text, age: 0 });
}

function sell(el: string, x: number, y: number): void {
  const value = element(el).value;
  money += value;
  puff(x, y, `+$${value}`);
  showMoney();
}

// ---------- Machines ----------

// Try to put an element into the square at (x, y): onto a belt or empty
// square, into a combiner, or into a seller. Returns false if it's blocked.
function deliver(el: string, x: number, y: number, fromX: number, fromY: number): boolean {
  if (!inside(x, y)) return false;
  const tile = tiles.get(key(x, y));
  if (isSolid(tile)) return false;
  if (tile?.kind === "seller") {
    sell(el, x, y);
    return true;
  }
  if (tile?.kind === "combiner") {
    if (tile.hold.length >= 2 || tile.out.length > 0) return false;
    tile.hold.push(el);
    return true;
  }
  if (tile?.kind === "oven") {
    if (tile.hold.length >= 1 || tile.out.length > 0) return false;
    tile.hold.push(el);
    return true;
  }
  if (itemAt.has(key(x, y))) return false;
  addItem(el, x, y, fromX, fromY);
  return true;
}

// Every square in the 3x3 around a Speeder. Worked out again every step.
let boosted = new Set<number>();

function findBoosted(): void {
  boosted = new Set();
  for (const [k, tile] of tiles) {
    if (tile.kind !== "speedo") continue;
    const x = k % W;
    const y = Math.floor(k / W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (inside(x + dx, y + dy)) boosted.add(key(x + dx, y + dy));
      }
    }
  }
}

function runMachines(): void {
  for (const [k, tile] of tiles) {
    const x = k % W;
    const y = Math.floor(k / W);
    // How much time passes for this machine this step: double near a Speeder.
    const dt = boosted.has(k) ? STEP * SPEEDO_BOOST : STEP;
    const fx = x + (DX[tile.dir] ?? 0);
    const fy = y + (DY[tile.dir] ?? 0);
    if (tile.kind === "switch") {
      tile.timer += dt;
      if (tile.timer >= SWITCH_EVERY - 1e-6) {
        tile.timer = 0;
        tile.flipped = !tile.flipped;
      }
    }
    if (tile.kind === "pusher") {
      // Shove whatever is right in front of it one square further, so
      // things that missed can get pushed into a seller, or off an edge.
      tile.timer += dt;
      const item = itemAt.get(key(fx, fy));
      const wanted = !tile.el || item?.el === tile.el;
      if (item && wanted && inside(fx, fy) && tile.timer >= PUSH_EVERY - 1e-6 && push(item, tile.dir)) tile.timer = 0;
    }
    if (tile.kind === "spawner" && tile.el) {
      tile.timer += dt;
      if (tile.timer >= SPAWN_EVERY - 1e-6 && deliver(tile.el, fx, fy, x, y)) tile.timer = 0;
    }
    if (tile.kind === "double" && tile.el) {
      // Two of the same thing at once, out two different sides.
      tile.timer += dt;
      if (tile.timer >= SPAWN_EVERY - 1e-6) {
        const gx = x + (DX[tile.dir2] ?? 0);
        const gy = y + (DY[tile.dir2] ?? 0);
        const first = deliver(tile.el, fx, fy, x, y);
        const second = deliver(tile.el, gx, gy, x, y);
        if (first || second) tile.timer = 0;
      }
    }
    if (tile.kind === "oven") {
      // Heats up whatever is inside: mud dries into clay, water boils, wood
      // burns. Things heat doesn't change just come back out.
      const cooking = tile.hold[0];
      if (cooking && tile.out.length === 0) {
        tile.timer += dt;
        if (tile.timer >= OVEN_TIME - 1e-6) {
          tile.timer = 0;
          const e = element(cooking);
          const cooked = (e.flammable ? e.burnsInto : e.heatsInto) ?? cooking;
          tile.out = [cooked];
          tile.hold = [];
          if (cooked !== cooking) {
            discover(cooked);
            puff(x, y, element(cooked).emoji);
          }
        }
      }
      const done = tile.out[0];
      if (done && deliver(done, fx, fy, x, y)) tile.out.shift();
    }
    if (tile.kind === "combiner") {
      const [a, b] = tile.hold;
      if (a && b && tile.out.length === 0) {
        tile.timer += dt;
        if (tile.timer >= CRAFT_TIME) {
          tile.timer = 0;
          const made = combine(a, b);
          const ach = comboAchievement(a, b);
          if (ach) achieve(ach.id);
          // No recipe: both just come back out.
          tile.out = made ? [...made] : [a, b];
          tile.hold = [];
          for (const el of made ?? []) {
            discover(el);
            puff(x, y, element(el).emoji);
          }
        }
      }
      const next = tile.out[0];
      if (next && deliver(next, fx, fy, x, y)) tile.out.shift();
    }
  }
}

// A pusher shoves an item one square. Returns false if it's blocked.
function push(item: Item, dir: Dir): boolean {
  const tx = item.x + (DX[dir] ?? 0);
  const ty = item.y + (DY[dir] ?? 0);
  if (!inside(tx, ty)) return false;
  const tile = tiles.get(key(tx, ty));
  if (takesThingsIn(tile)) {
    if (!deliver(item.el, tx, ty, item.x, item.y)) return false;
    removeItem(item);
    return true;
  }
  if (isSolid(tile) || itemAt.has(key(tx, ty))) return false;
  itemAt.delete(key(item.x, item.y));
  item.x = tx;
  item.y = ty;
  itemAt.set(key(tx, ty), item);
  item.moved = true;
  item.still = 0;
  return true;
}

// ---------- Moving things ----------

// Which way an item wants to go this step, if any, and whether it's gravity.
function wantedMove(item: Item): { dir: Dir; gravity: boolean } | null {
  const tile = tiles.get(key(item.x, item.y));
  if (tile?.kind === "belt" || tile?.kind === "switch") return { dir: beltDir(tile), gravity: false };
  const weight = element(item.el).weight;
  if (weight === "fall") return { dir: 1, gravity: true };
  // Combiners and sellers are like funnels: something that floats (like
  // fire) sitting right on top of one drops in.
  if (weight === "float") {
    const below = tiles.get(key(item.x, item.y + 1));
    if (item.y + 1 < H && takesThingsIn(below)) return { dir: 1, gravity: false };
  }
  if (weight === "rise") return { dir: 3, gravity: true };
  return null;
}

function tryMove(item: Item): boolean {
  const want = wantedMove(item);
  if (!want) return false;
  const tx = item.x + (DX[want.dir] ?? 0);
  const ty = item.y + (DY[want.dir] ?? 0);
  if (!inside(tx, ty)) return false;
  const tile = tiles.get(key(tx, ty));
  if (isSolid(tile)) return false;
  if (takesThingsIn(tile)) {
    if (!deliver(item.el, tx, ty, item.x, item.y)) return false;
    removeItem(item);
    return true;
  }
  const blocker = itemAt.get(key(tx, ty));
  if (blocker) {
    // Just landed on something: Oscar's special landings, like wood on earth.
    if (want.gravity && want.dir === 1 && item.falling) {
      item.falling = false;
      const landing = LANDINGS.find((l) => l.falling === item.el && l.onto === blocker.el);
      if (landing) {
        removeItem(item);
        changeItem(blocker, landing.makes);
        return true;
      }
    }
    return false;
  }
  itemAt.delete(key(item.x, item.y));
  item.x = tx;
  item.y = ty;
  itemAt.set(key(tx, ty), item);
  item.moved = true;
  item.falling = want.gravity && want.dir === 1;
  item.rising = want.gravity && want.dir === 3 ? item.rising + itemTime(item) : 0;
  return true;
}

// Elements near a Speeder change twice as fast too (drying, burning, waiting).
function itemTime(item: Item): number {
  return boosted.has(key(item.x, item.y)) ? STEP * SPEEDO_BOOST : STEP;
}

function moveItems(): void {
  for (const item of items) {
    item.fromX = item.x;
    item.fromY = item.y;
    item.moved = false;
  }
  // Keep going until nothing else can move, so a whole line of things on a
  // belt moves together instead of leaving gaps (or stopping for a moment)
  // behind whoever went first.
  for (let pass = 0; pass < 100; pass++) {
    let anyMoved = false;
    for (const item of [...items]) {
      if (item.moved || !items.includes(item)) continue;
      if (tryMove(item)) anyMoved = true;
    }
    if (!anyMoved) break;
  }
  // Belts next to a Speeder carry things an extra square each step.
  const sped = new Set<Item>();
  for (let pass = 0; pass < 4; pass++) {
    let anyMoved = false;
    for (const item of [...items]) {
      if (sped.has(item) || !items.includes(item)) continue;
      const k = key(item.x, item.y);
      const tile = tiles.get(k);
      if (!boosted.has(k) || (tile?.kind !== "belt" && tile?.kind !== "switch")) continue;
      if (tryMove(item)) {
        sped.add(item);
        anyMoved = true;
      }
    }
    if (!anyMoved) break;
  }
  for (const item of items) {
    if (item.moved) {
      item.still = 0;
      item.moving += itemTime(item);
    } else {
      item.still += itemTime(item);
      item.rising = 0;
      item.moving = 0;
      if (wantedMove(item)?.dir !== 1) item.falling = false;
    }
  }
}

function isHot(x: number, y: number): boolean {
  for (let d = 0; d < 4; d++) {
    const n = itemAt.get(key(x + (DX[d] ?? 0), y + (DY[d] ?? 0)));
    if (n && inside(n.x, n.y) && element(n.el).heater) return true;
  }
  return false;
}

function nextToOven(x: number, y: number): boolean {
  for (let d = 0; d < 4; d++) {
    const nx = x + (DX[d] ?? 0);
    const ny = y + (DY[d] ?? 0);
    if (inside(nx, ny) && tiles.get(key(nx, ny))?.kind === "oven") return true;
  }
  return false;
}

function specialConditions(): void {
  for (const item of [...items]) {
    if (!items.includes(item)) continue;
    const e = element(item.el);
    // Heat: burning and melting.
    const turnsInto = e.flammable ? e.burnsInto : e.heatsInto;
    // Ovens cook anything right next to them straight away, even things
    // falling or riding past.
    if (turnsInto && nextToOven(item.x, item.y)) {
      changeItem(item, turnsInto);
      continue;
    }
    if (turnsInto && isHot(item.x, item.y)) {
      item.heat += itemTime(item);
      if (item.heat >= HEAT_TIME) changeItem(item, turnsInto);
      continue;
    }
    item.heat = 0;
    // Floating up for a long time.
    const keep = KEEP_MOVING.find((m) => m.id === item.el);
    if (keep && item.moving >= keep.seconds - 1e-6) {
      changeItem(item, keep.makes);
      continue;
    }
    const up = FLOAT_UP.find((f) => f.id === item.el);
    if (up && item.rising >= up.seconds - 1e-6) {
      changeItem(item, up.makes);
      continue;
    }
    // Staying still.
    const rule = STAY_STILL.find((s) => s.id === item.el);
    if (rule && item.still >= rule.seconds) changeItem(item, rule.makes);
  }
}

function step(): void {
  findBoosted();
  moveItems();
  runMachines();
  specialConditions();
}

// ---------- Saving ----------

interface Save {
  money: number;
  found: string[];
  achievements?: string[];
  // [square, kind, way, spawner element, switch belt's second way]
  tiles: [number, TileKind, Dir, (string | null)?, Dir?][];
  items: [number, number, string][];
}

function save(): void {
  const data: Save = {
    money,
    found: [...found],
    achievements: [...achieved],
    tiles: [...tiles].map(([k, t]) => [k, t.kind, t.dir, t.el ?? null, t.dir2]),
    items: items.map((i) => [i.x, i.y, i.el]),
  };
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(SAVE_KEY, json);
  } catch {
    // Couldn't save in the browser this time.
  }
  if (useSaveFile && !saveFileBroken) {
    fetch(SAVE_FILE_URL, { method: "POST", body: json, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {
      // The server's not there right now; the next save will try again.
    });
  }
}

// The save file wins if there is one. Otherwise the browser's save (which is
// how an older save gets moved into the file).
async function readSave(): Promise<string | null> {
  if (useSaveFile) {
    try {
      const res = await fetch(SAVE_FILE_URL);
      if (!res.ok) throw new Error(`save file: ${res.status}`);
      const text = await res.text();
      if (text && text !== "null") return text;
    } catch {
      saveFileBroken = true;
    }
  }
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

function load(raw: string | null): boolean {
  let data: Save;
  try {
    if (!raw) return false;
    data = JSON.parse(raw) as Save;
  } catch {
    return false;
  }
  const known = new Set(ELEMENTS.map((e) => e.id));
  money = data.money ?? 100;
  for (const id of data.found ?? []) if (known.has(id)) found.add(id);
  for (const id of data.achievements ?? []) achieved.add(id);
  for (const [k, kind, dir, savedEl, dir2] of data.tiles ?? []) {
    const el = savedEl ?? undefined;
    if (el && !known.has(el)) continue;
    // Spawners for anything besides earth, water, fire and air aren't allowed any
    // more, so those get taken away and paid back.
    if ((kind === "spawner" || kind === "double") && el && !STARTERS.includes(el)) {
      money += spawnerCost(el);
      continue;
    }
    tiles.set(k, newTile(kind, dir, el, dir2 ?? dir));
  }
  for (const [x, y, el] of data.items ?? []) {
    if (known.has(el) && inside(x, y) && !itemAt.has(key(x, y))) addItem(el, x, y);
  }
  return true;
}

// A little starter factory so it's clear what everything does: earth and
// water spawners feed a combiner, and the mud goes off to a seller.
function starterFactory(): void {
  const row = H - 4;
  tiles.set(key(4, row), newTile("spawner", 0, "earth"));
  for (let x = 5; x < 9; x++) tiles.set(key(x, row), newTile("belt", 0));
  tiles.set(key(14, row), newTile("spawner", 2, "water"));
  for (let x = 10; x < 14; x++) tiles.set(key(x, row), newTile("belt", 2));
  tiles.set(key(9, row), newTile("combiner", 1));
  for (let y = row + 1; y < H - 1; y++) tiles.set(key(9, y), newTile("belt", 1));
  tiles.set(key(9, H - 1), newTile("seller", 0));
}

// ---------- Camera ----------

const canvas = document.getElementById("world") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const cam = { x: 0, y: 0, zoom: 1 };

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}

function fitCamera(): void {
  const rect = canvas.getBoundingClientRect();
  cam.zoom = Math.max(0.4, Math.min(1.4, rect.height / (H * CELL)));
  cam.x = 0;
  cam.y = (H * CELL - rect.height / cam.zoom) / 2;
  clampCamera();
}

function clampCamera(): void {
  const rect = canvas.getBoundingClientRect();
  const viewW = rect.width / cam.zoom;
  const viewH = rect.height / cam.zoom;
  const pad = CELL * 2;
  cam.x = Math.min(Math.max(cam.x, -pad), Math.max(-pad, W * CELL - viewW + pad));
  cam.y = Math.min(Math.max(cam.y, -pad), Math.max(-pad, H * CELL - viewH + pad));
}

function screenToCell(sx: number, sy: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const wx = (sx - rect.left) / cam.zoom + cam.x;
  const wy = (sy - rect.top) / cam.zoom + cam.y;
  return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL) };
}

function zoomAt(sx: number, sy: number, factor: number): void {
  const rect = canvas.getBoundingClientRect();
  const wx = (sx - rect.left) / cam.zoom + cam.x;
  const wy = (sy - rect.top) / cam.zoom + cam.y;
  cam.zoom = Math.min(2.5, Math.max(0.35, cam.zoom * factor));
  cam.x = wx - (sx - rect.left) / cam.zoom;
  cam.y = wy - (sy - rect.top) / cam.zoom;
  clampCamera();
}

// ---------- Tools ----------

type Tool = TileKind | "erase" | "move";
let tool: Tool = "belt";
let placeDir: Dir = 0;
let spawnEl = "earth";
// The two ways new switch belts go. Down then left, like Oscar's example.
let switchA: Dir = 1;
let switchB: Dir = 2;
// What new pushers push. Nothing set means anything.
let pushOnly: string | undefined;
// The two sides new double spawners spit things out of.
let doubleA: Dir = 0;
let doubleB: Dir = 2;

const TOOL_INFO: { id: Tool; icon: string; name: string }[] = [
  { id: "belt", icon: "➡️", name: "Belt" },
  { id: "switch", icon: "🔀", name: "Switch Belt" },
  { id: "spawner", icon: "🏭", name: "Spawner" },
  { id: "double", icon: "♊", name: "Double Spawner" },
  { id: "combiner", icon: "➕", name: "Combiner" },
  { id: "oven", icon: "🔥", name: "Oven" },
  { id: "seller", icon: "💰", name: "Seller" },
  { id: "pusher", icon: "👊", name: "Pusher" },
  { id: "speedo", icon: "⏩", name: "Speeder" },
  { id: "wall", icon: "🧱", name: "Wall" },
  { id: "erase", icon: "🧽", name: "Erase" },
  { id: "move", icon: "✋", name: "Move" },
];

const toolsEl = document.getElementById("tools")!;
const pickerEl = document.getElementById("picker")!;

function toolCost(t: Tool): number | null {
  if (t === "spawner") return spawnerCost(spawnEl);
  if (t === "belt" || t === "switch" || t === "combiner" || t === "seller" || t === "pusher" || t === "double" || t === "speedo" || t === "oven" || t === "wall") return COSTS[t];
  return null;
}

function renderTools(): void {
  const toolButtons = TOOL_INFO.map((t) => {
    const cost = toolCost(t.id);
    return `<button class="tool${tool === t.id ? " is-selected" : ""}" data-tool="${t.id}" type="button">
      <span class="icon">${t.icon}</span>${t.name}${cost !== null ? `<span class="cost">$${cost}</span>` : ""}
    </button>`;
  }).join("");
  toolsEl.innerHTML = `${toolButtons}
    <span class="tool-gap"></span>
    <button class="tool" data-action="rotate" type="button"><span class="icon">${ARROWS[placeDir]}</span>Turn (R)</button>
    <button class="tool" data-action="zoom-out" type="button"><span class="icon">➖</span>Zoom</button>
    <button class="tool" data-action="zoom-in" type="button"><span class="icon">🔍</span>Zoom</button>`;
  pickerEl.hidden = tool !== "spawner" && tool !== "double" && tool !== "switch" && tool !== "pusher";
  renderPicker();
}

function renderPicker(): void {
  if (tool === "pusher") {
    // Pick what new pushers push: anything, or just one element you've found.
    const choices = [
      `<button class="pick${pushOnly === undefined ? " is-selected" : ""}" data-only="" type="button"><span class="icon">✳️</span>Anything</button>`,
      ...ELEMENTS.filter((e) => found.has(e.id)).map(
        (e) => `<button class="pick${pushOnly === e.id ? " is-selected" : ""}" data-only="${e.id}" type="button"><span class="icon">${e.emoji}</span>Only ${e.name}</button>`
      ),
    ];
    pickerEl.innerHTML = choices.join("") + `<span class="picker-note">Click a pusher you already placed to give it this setting.</span>`;
    return;
  }
  if (tool === "switch") {
    // Pick the two ways. Click one to turn it.
    pickerEl.innerHTML = `
      <button class="pick" data-way="1" type="button"><span class="icon">${ARROWS[switchA]}</span>First way</button>
      <button class="pick" data-way="2" type="button"><span class="icon">${ARROWS[switchB]}</span>Then this way</button>
      <span class="picker-note">Click an arrow to turn it. Switch belts swap ways every ${SWITCH_EVERY} seconds. Click one you already placed to give it these ways.</span>`;
    return;
  }
  // Only earth, water, fire and air get spawners. Everything else you have to combine.
  const isDouble = tool === "double";
  pickerEl.innerHTML =
    ELEMENTS.filter((e) => STARTERS.includes(e.id))
      .map(
        (e) => `<button class="pick${spawnEl === e.id ? " is-selected" : ""}" ${isDouble ? "data-pick" : "data-el"}="${e.id}" type="button">
        <span class="icon">${e.emoji}</span>${e.name}${isDouble ? "" : `<span class="cost">$${spawnerCost(e.id)}</span>`}
      </button>`
      )
      .join("") +
    (isDouble
      ? `<span class="tool-gap"></span>
      <button class="pick" data-dway="1" type="button"><span class="icon">${ARROWS[doubleA]}</span>One way</button>
      <button class="pick" data-dway="2" type="button"><span class="icon">${ARROWS[doubleB]}</span>Other way</button>
      <span class="picker-note">Two of the same thing, out two sides. Click an arrow to turn it. Click a double spawner you already placed to give it these settings.</span>`
      : "");
  refreshAffordable();
}

function refreshAffordable(): void {
  for (const b of pickerEl.querySelectorAll<HTMLButtonElement>(".pick[data-el]")) {
    b.disabled = spawnerCost(b.dataset["el"] ?? "earth") > money;
  }
}

toolsEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;
  if (button.dataset["tool"]) tool = button.dataset["tool"] as Tool;
  const rect = canvas.getBoundingClientRect();
  if (button.dataset["action"] === "rotate") placeDir = ((placeDir + 1) % 4) as Dir;
  if (button.dataset["action"] === "zoom-in") zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.25);
  if (button.dataset["action"] === "zoom-out") zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.8);
  renderTools();
});

pickerEl.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!button) return;
  const way = button.dataset["way"];
  if (way === "1") switchA = ((switchA + 1) % 4) as Dir;
  if (way === "2") switchB = ((switchB + 1) % 4) as Dir;
  const el = button.dataset["el"] ?? button.dataset["pick"];
  if (el) spawnEl = el;
  const dway = button.dataset["dway"];
  if (dway === "1") doubleA = ((doubleA + 1) % 4) as Dir;
  if (dway === "2") doubleB = ((doubleB + 1) % 4) as Dir;
  const only = button.dataset["only"];
  if (only !== undefined) pushOnly = only || undefined;
  renderTools();
});

function refund(tile: Tile): number {
  if (tile.kind === "spawner") return Math.floor(spawnerCost(tile.el ?? "earth") / 2);
  return Math.floor(COSTS[tile.kind] / 2);
}

// Click (or drag) on a square with the current tool.
function useTool(x: number, y: number, dragDir: Dir | null): void {
  if (!inside(x, y)) return;
  const k = key(x, y);
  const existing = tiles.get(k);
  if (tool === "move") return;
  if (tool === "erase") {
    const item = itemAt.get(k);
    if (item) removeItem(item);
    else if (existing) {
      money += refund(existing);
      tiles.delete(k);
    }
    showMoney();
    return;
  }
  const dir = dragDir ?? placeDir;
  if (existing?.kind === "switch" && tool === "switch") {
    // Clicking a switch belt gives it the ways you picked.
    existing.dir = switchA;
    existing.dir2 = switchB;
    existing.flipped = false;
    existing.timer = 0;
    return;
  }
  if (existing?.kind === "double" && tool === "double") {
    // Clicking a double spawner gives it what you picked.
    existing.el = spawnEl;
    existing.dir = doubleA;
    existing.dir2 = doubleB;
    return;
  }
  if (existing?.kind === "pusher" && tool === "pusher" && existing.el !== pushOnly) {
    // Clicking a pusher gives it what you picked to push.
    existing.el = pushOnly;
    return;
  }
  if (existing && existing.kind === tool && (tool !== "spawner" || existing.el === spawnEl)) {
    // Same thing again: turn it (or, while dragging belts, point it along the drag).
    existing.dir = dragDir ?? (((existing.dir + 1) % 4) as Dir);
    return;
  }
  const cost = toolCost(tool) ?? 0;
  const back = existing ? refund(existing) : 0;
  if (money + back < cost) {
    toast("Not enough money!");
    return;
  }
  money += back - cost;
  if (tool === "switch") tiles.set(k, newTile("switch", switchA, undefined, switchB));
  else if (tool === "double") tiles.set(k, newTile("double", doubleA, spawnEl, doubleB));
  else tiles.set(k, newTile(tool, dir, tool === "spawner" ? spawnEl : tool === "pusher" ? pushOnly : undefined));
  // Machines take up the whole square; belts can have things riding on them.
  if (tool !== "belt" && tool !== "switch") {
    const item = itemAt.get(k);
    if (item) removeItem(item);
  }
  if (tool === "speedo") checkSpeederNetwork();
  showMoney();
}

// Speeder Network: a solid block of Speeders, 7 by 2 either way round.
function checkSpeederNetwork(): void {
  const isSpeeder = (x: number, y: number) => inside(x, y) && tiles.get(key(x, y))?.kind === "speedo";
  const block = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!isSpeeder(x + dx, y + dy)) return false;
    return true;
  };
  for (const [k, tile] of tiles) {
    if (tile.kind !== "speedo") continue;
    const x = k % W;
    const y = Math.floor(k / W);
    if (block(x, y, 7, 2) || block(x, y, 2, 7)) {
      achieve("speeder-network");
      return;
    }
  }
}

// ---------- Mouse, touch and keys ----------

let pointerMode: "none" | "build" | "pan" = "none";
let lastCell: { x: number; y: number } | null = null;
let lastPan = { x: 0, y: 0 };
let hoverCell: { x: number; y: number } | null = null;

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 1 || e.button === 2 || tool === "move") {
    pointerMode = "pan";
    lastPan = { x: e.clientX, y: e.clientY };
    return;
  }
  pointerMode = "build";
  lastCell = screenToCell(e.clientX, e.clientY);
  useTool(lastCell.x, lastCell.y, null);
});

canvas.addEventListener("pointermove", (e) => {
  hoverCell = screenToCell(e.clientX, e.clientY);
  if (pointerMode === "pan") {
    cam.x -= (e.clientX - lastPan.x) / cam.zoom;
    cam.y -= (e.clientY - lastPan.y) / cam.zoom;
    lastPan = { x: e.clientX, y: e.clientY };
    clampCamera();
    return;
  }
  if (pointerMode !== "build" || !lastCell) return;
  const cell = hoverCell;
  if (cell.x === lastCell.x && cell.y === lastCell.y) return;
  // Dragging belts lays them pointing the way you drag.
  // Belts, walls and the eraser can be dragged to do a whole line.
  if (tool === "belt" || tool === "wall" || tool === "erase") {
    const dx = Math.sign(cell.x - lastCell.x);
    const dy = Math.sign(cell.y - lastCell.y);
    const dir: Dir = dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3;
    if (tool === "belt") {
      const prev = tiles.get(key(lastCell.x, lastCell.y));
      if (prev?.kind === "belt") prev.dir = dir;
    }
    // Walk one square at a time so fast drags don't skip any.
    let { x, y } = lastCell;
    while (x !== cell.x || y !== cell.y) {
      if (x !== cell.x) x += Math.sign(cell.x - x);
      else y += Math.sign(cell.y - y);
      useTool(x, y, tool === "belt" ? dir : null);
    }
  }
  lastCell = cell;
});

const endPointer = () => {
  pointerMode = "none";
  lastCell = null;
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", () => {
  hoverCell = null;
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9);
  },
  { passive: false }
);

const keysDown = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  keysDown.add(k);
  if (k === "r") {
    placeDir = ((placeDir + 1) % 4) as Dir;
    renderTools();
  }
  if (k === "escape") pediaEl.hidden = true;
  const n = Number(e.key);
  const pick = TOOL_INFO[n - 1];
  if (pick) {
    tool = pick.id;
    renderTools();
  }
});
window.addEventListener("keyup", (e) => keysDown.delete(e.key.toLowerCase()));

function panWithKeys(dt: number): void {
  const speed = 600 * dt / cam.zoom;
  if (keysDown.has("a") || keysDown.has("arrowleft")) cam.x -= speed;
  if (keysDown.has("d") || keysDown.has("arrowright")) cam.x += speed;
  if (keysDown.has("w") || keysDown.has("arrowup")) cam.y -= speed;
  if (keysDown.has("s") || keysDown.has("arrowdown")) cam.y += speed;
  clampCamera();
}

// ---------- Elemepiedia ----------

const pediaEl = document.getElementById("pedia")!;
const pediaListEl = document.getElementById("pedia-list")!;
const pediaCountEl = document.getElementById("pedia-count")!;
const trophiesEl = document.getElementById("pedia-trophies")!;

function renderPedia(): void {
  pediaCountEl.textContent = `You've found ${found.size} of ${ELEMENTS.length} elements.`;
  trophiesEl.innerHTML = `<h3>🏆 Achievements (${achieved.size}/${ACHIEVEMENTS.length})</h3>` +
    ACHIEVEMENTS.map((a) =>
      achieved.has(a.id)
        ? `<span class="trophy">${a.emoji} ${a.name}</span>`
        : `<button class="trophy is-locked" type="button" data-hint="${a.how}">🔒 ??? <span class="hint-label">💡 Hint</span></button>`
    ).join("");
  pediaListEl.innerHTML = ELEMENTS.map((e) => {
    if (!found.has(e.id)) {
      return `<button class="pedia-card is-unknown" type="button" data-hint="${hintFor(e.id)}"><h3><span class="swatch" style="background:#222">❓</span>???</h3><p>Not found yet. <span class="hint-label">💡 Click for a hint</span></p></button>`;
    }
    const tags = [
      e.weight === "fall" ? "⬇️ Falls" : e.weight === "rise" ? "⬆️ Floats up" : "〰️ Stays put",
      e.heater ? "🔥 Heater" : "",
      e.flammable ? "🪵 Flammable" : "",
      `💰 $${e.value}`,
    ].filter(Boolean);
    return `<div class="pedia-card">
      <h3><span class="swatch" style="background:${e.color}">${e.emoji}</span>${e.name}</h3>
      <div class="tags">${tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <p>${e.blurb}</p>
      <ul>${howToMake(e.id).map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>`;
  }).join("");
}

document.getElementById("pedia-button")!.addEventListener("click", () => {
  renderPedia();
  pediaEl.hidden = false;
});
document.getElementById("pedia-close")!.addEventListener("click", () => {
  pediaEl.hidden = true;
});
pediaEl.addEventListener("click", (e) => {
  if (e.target === pediaEl) pediaEl.hidden = true;
  // Click any ??? for a hint.
  const unknown = (e.target as HTMLElement).closest<HTMLElement>("[data-hint]");
  if (unknown && !unknown.classList.contains("is-hinted")) {
    unknown.classList.add("is-hinted");
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = `💡 ${unknown.dataset["hint"]}`;
    unknown.append(hint);
  }
});

// ---------- Drawing ----------

const hoverEl = document.getElementById("hover-info")!;

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawArrow(cx: number, cy: number, dir: Dir, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.4, -size * 0.7);
  ctx.lineTo(-size * 0.4, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEmoji(text: string, cx: number, cy: number, size: number): void {
  ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + size * 0.05);
}

function drawTile(x: number, y: number, tile: Tile, time: number): void {
  const px = x * CELL;
  const py = y * CELL;
  const cx = px + CELL / 2;
  const cy = py + CELL / 2;
  if (tile.kind === "belt" || tile.kind === "switch") {
    const now = beltDir(tile);
    ctx.fillStyle = tile.kind === "switch" ? "#4a3560" : "#3b3b44";
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    // Moving chevrons show which way it goes.
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 1, py + 1, CELL - 2, CELL - 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate((now * Math.PI) / 2);
    const shift = ((time / STEP) % 1) * (CELL / 2);
    ctx.strokeStyle = tile.kind === "switch" ? "#a07ad0" : "#6c6c7a";
    ctx.lineWidth = 3;
    for (let i = -2; i <= 1; i++) {
      const ox = i * (CELL / 2) + shift;
      ctx.beginPath();
      ctx.moveTo(ox - 5, -9);
      ctx.lineTo(ox + 4, 0);
      ctx.lineTo(ox - 5, 9);
      ctx.stroke();
    }
    ctx.restore();
    if (tile.kind === "switch") {
      // The way it'll switch to next, small in the corner, and a bar
      // that fills up until it switches.
      const next = tile.flipped ? tile.dir : tile.dir2;
      ctx.fillStyle = "rgba(20,10,30,0.75)";
      ctx.fillRect(px + CELL - 15, py + 2, 13, 13);
      drawArrow(px + CELL - 8.5, py + 8.5, next, 4.5, "#ffd23f");
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(px + 2, py + CELL - 4, (CELL - 4) * (tile.timer / SWITCH_EVERY), 2);
    }
    return;
  }
  const colors: Record<Exclude<TileKind, "belt" | "switch">, string> = {
    spawner: "#4a5568",
    double: "#5a4a78",
    combiner: "#6b3fa0",
    oven: "#8a2a1a",
    seller: "#2f8a4a",
    pusher: "#3d6a8a",
    speedo: "#b8561a",
    wall: "#6e625c",
  };
  roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 7);
  ctx.fillStyle = colors[tile.kind];
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.stroke();
  if (tile.kind === "spawner" && tile.el) {
    const e = element(tile.el);
    roundRect(px + 8, py + 8, CELL - 16, CELL - 16, 5);
    ctx.fillStyle = e.color;
    ctx.fill();
    drawEmoji(e.emoji, cx, cy, 15);
    drawArrow(cx + DX[tile.dir]! * 15, cy + DY[tile.dir]! * 15, tile.dir, 5, "#ffd23f");
  }
  if (tile.kind === "double" && tile.el) {
    const e = element(tile.el);
    roundRect(px + 9, py + 9, CELL - 18, CELL - 18, 5);
    ctx.fillStyle = e.color;
    ctx.fill();
    drawEmoji(e.emoji, cx, cy, 13);
    drawArrow(cx + DX[tile.dir]! * 15, cy + DY[tile.dir]! * 15, tile.dir, 5, "#ffd23f");
    drawArrow(cx + DX[tile.dir2]! * 15, cy + DY[tile.dir2]! * 15, tile.dir2, 5, "#ffd23f");
  }
  if (tile.kind === "speedo") drawEmoji("⏩", cx, cy, 20);
  if (tile.kind === "wall") {
    // Bricks.
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const ly of [py + CELL / 3, py + (2 * CELL) / 3]) {
      ctx.moveTo(px + 3, ly);
      ctx.lineTo(px + CELL - 3, ly);
    }
    for (const [lx, top] of [[cx, py + 3], [px + CELL / 4, py + CELL / 3], [px + (3 * CELL) / 4, py + CELL / 3], [cx, py + (2 * CELL) / 3]] as const) {
      ctx.moveTo(lx, top);
      ctx.lineTo(lx, Math.min(top + CELL / 3, py + CELL - 3));
    }
    ctx.stroke();
  }
  if (tile.kind === "oven") {
    const cooking = tile.hold[0];
    drawEmoji(cooking ? element(cooking).emoji : "🔥", cx, cy - 2, cooking ? 14 : 16);
    drawArrow(cx + DX[tile.dir]! * 14, cy + DY[tile.dir]! * 14, tile.dir, 5, "#ffd23f");
  }
  if (tile.kind === "combiner") {
    const [a, b] = tile.hold;
    if (a) drawEmoji(element(a).emoji, cx - 8, cy - 7, 12);
    if (b) drawEmoji(element(b).emoji, cx + 8, cy - 7, 12);
    if (!a && !b) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", cx, cy - 2);
    }
    drawArrow(cx + DX[tile.dir]! * 14, cy + DY[tile.dir]! * 14, tile.dir, 5, "#ffd23f");
  }
  if (tile.kind === "pusher") {
    // A fist on an arm that punches out just after it pushes.
    const reach = tile.timer < 0.2 ? 12 : 4;
    const ex = cx + (DX[tile.dir] ?? 0) * reach;
    const ey = cy + (DY[tile.dir] ?? 0) * reach;
    ctx.strokeStyle = "#cfd8e0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    drawEmoji("👊", ex, ey, 14);
    if (tile.el) {
      // What it's set to push, small in the corner.
      ctx.fillStyle = "rgba(20,10,30,0.75)";
      ctx.fillRect(px + 3, py + 3, 15, 15);
      drawEmoji(element(tile.el).emoji, px + 10.5, py + 10.5, 10);
    }
  }
  if (tile.kind === "seller") {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", cx, cy + 1);
  }
}

function drawItem(item: Item, t: number): void {
  const e = element(item.el);
  const x = (item.fromX + (item.x - item.fromX) * t) * CELL;
  const y = (item.fromY + (item.y - item.fromY) * t) * CELL;
  const size = CELL * 0.74;
  const o = (CELL - size) / 2;
  roundRect(x + o, y + o, size, size, 7);
  ctx.fillStyle = e.color;
  ctx.fill();
  if (item.heat > 0) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = Math.floor(performance.now() / 120) % 2 ? "#ffb02e" : "#ff4a1f";
    ctx.stroke();
  }
  drawEmoji(e.emoji, x + CELL / 2, y + CELL / 2, 18);
  // A ring that fills up while it's staying still, if staying still does something.
  const rule = STAY_STILL.find((s) => s.id === item.el);
  if (rule && item.still >= 2) {
    ctx.beginPath();
    ctx.arc(x + CELL - 7, y + 7, 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * item.still) / rule.seconds);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // A blue ring that fills up while it keeps moving.
  const keep = KEEP_MOVING.find((m) => m.id === item.el);
  if (keep && item.moving >= 2) {
    ctx.beginPath();
    ctx.arc(x + 7, y + 7, 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * item.moving) / keep.seconds);
    ctx.strokeStyle = "#5fe0ff";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function draw(time: number, t: number): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#2a1a3a");
  sky.addColorStop(1, "#140a10");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, -cam.x * dpr * cam.zoom, -cam.y * dpr * cam.zoom);

  // The edges of the world.
  ctx.fillStyle = "#24161c";
  ctx.fillRect(0, 0, W * CELL, H * CELL);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, H * CELL);
  }
  for (let y = 0; y <= H; y++) {
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(W * CELL, y * CELL);
  }
  ctx.stroke();
  ctx.fillStyle = "#5c3a24";
  ctx.fillRect(-CELL, H * CELL, (W + 2) * CELL, CELL);
  ctx.fillStyle = "#3a2a30";
  ctx.fillRect(-CELL, -CELL, CELL, (H + 1) * CELL);
  ctx.fillRect(W * CELL, -CELL, CELL, (H + 1) * CELL);
  ctx.fillRect(-CELL, -CELL, (W + 2) * CELL, CELL);

  ctx.fillStyle = "rgba(255,140,40,0.1)";
  for (const k of boosted) ctx.fillRect((k % W) * CELL, Math.floor(k / W) * CELL, CELL, CELL);
  for (const [k, tile] of tiles) drawTile(k % W, Math.floor(k / W), tile, time);
  for (const item of items) drawItem(item, t);

  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.age);
    ctx.fillStyle = "#7dffa0";
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x * CELL, (f.y - f.age * 0.8) * CELL);
  }
  ctx.globalAlpha = 1;

  // Where the current tool will go.
  if (hoverCell && inside(hoverCell.x, hoverCell.y) && tool !== "move") {
    ctx.strokeStyle = tool === "erase" ? "#ff5c5c" : "#ffd23f";
    ctx.lineWidth = 2;
    ctx.strokeRect(hoverCell.x * CELL + 1, hoverCell.y * CELL + 1, CELL - 2, CELL - 2);
    if (tool !== "erase" && tool !== "seller" && tool !== "wall" && !tiles.has(key(hoverCell.x, hoverCell.y))) {
      drawArrow(hoverCell.x * CELL + CELL / 2, hoverCell.y * CELL + CELL / 2, tool === "switch" ? switchA : placeDir, 8, "rgba(255,210,63,0.6)");
    }
  }
}

function describeHover(): void {
  if (!hoverCell || !inside(hoverCell.x, hoverCell.y)) {
    hoverEl.hidden = true;
    return;
  }
  const k = key(hoverCell.x, hoverCell.y);
  const item = itemAt.get(k);
  const tile = tiles.get(k);
  let text = "";
  if (item) {
    const e = element(item.el);
    text = `${e.emoji} ${e.name}`;
    const rule = STAY_STILL.find((s) => s.id === item.el);
    if (rule && item.still > 0) text += ` · still for ${Math.floor(item.still)}s of ${rule.seconds}`;
    const keep = KEEP_MOVING.find((m) => m.id === item.el);
    if (keep && item.moving > 0) text += ` · moving for ${Math.floor(item.moving)}s of ${keep.seconds}`;
  } else if (tile?.kind === "spawner" && tile.el) {
    text = `🏭 ${element(tile.el).name} spawner`;
  } else if (tile?.kind === "oven") {
    text = `🔥 Oven${tile.hold[0] ? `: cooking ${element(tile.hold[0]).name}` : ": heats up whatever goes in"}`;
  } else if (tile?.kind === "combiner") {
    text = `➕ Combiner${tile.hold.length ? `: ${tile.hold.map((h) => element(h).name).join(" + ")}` : ""}`;
  } else if (tile?.kind === "switch") {
    text = `🔀 Switch belt: ${ARROWS[tile.dir]} then ${ARROWS[tile.dir2]}`;
  } else if (tile?.kind === "double" && tile.el) {
    text = `♊ Double ${element(tile.el).name} spawner: ${ARROWS[tile.dir]} and ${ARROWS[tile.dir2]}`;
  } else if (tile?.kind === "wall") {
    text = "🧱 Wall: nothing gets through";
  } else if (tile?.kind === "speedo") {
    text = "⏩ Speeder: everything in the 3×3 around it goes twice as fast";
  } else if (tile?.kind === "pusher") {
    text = `👊 Pusher: shoves ${tile.el ? `only ${element(tile.el).name}` : "anything"} ${["right", "down", "left", "up"][tile.dir]}`;
  } else if (tile?.kind === "seller") {
    text = "💰 Seller";
  }
  hoverEl.hidden = !text;
  hoverEl.textContent = text;
}

// ---------- Go! ----------

async function start(): Promise<void> {
  if (!load(await readSave())) starterFactory();
  checkSpeederNetwork();
  checkFoundAchievements();
  resize();
  fitCamera();
  renderTools();
  renderPicker();
  showMoney();

  // The canvas changes size with the window, and when the spawner picker opens or closes.
  new ResizeObserver(() => {
    resize();
    clampCamera();
  }).observe(canvas);
  window.addEventListener("beforeunload", save);
  window.setInterval(save, 5000);

  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      step();
    }
    for (const f of floaters) f.age += dt;
    while (floaters[0] && floaters[0].age > 1) floaters.shift();
    panWithKeys(dt);
    draw(now / 1000, acc / STEP);
    describeHover();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

void start();
