import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// A Cell Machine style puzzle: you only ever build. Once you hit Play the
// machine runs itself, which is the whole joke of the title.

type Dir = 0 | 1 | 2 | 3; // right, down, left, up

type CellKind =
  | "mover"
  | "push"
  | "slide"
  | "wall"
  | "rotcw"
  | "rotccw"
  | "gen"
  | "bomb"
  | "multibomb"
  | "conway"
  | "enemy"
  | "trash";

// Glue is painted onto a cell rather than placed as its own cell, so it is a
// brush but never a kind.
type BrushKind = CellKind | "glue";

interface Cell {
  kind: CellKind;
  dir: Dir;
  glued?: boolean;
}

interface Level {
  name: string;
  hint: string;
  // Hand-drawn levels use the string maps; open playgrounds just give a size
  // and let the whole thing be buildable.
  layout?: string[];
  zone?: string[];
  cols?: number;
  rows?: number;
  openZone?: boolean;
  // Levels loaded from a save drop their cells straight in instead.
  cells?: SavedCell[];
  inventory: Partial<Record<BrushKind, number>>;
}

// [gridIndex, kind, facing, gluedFlag] — kept as a tuple so saves stay small.
type SavedCell = [number, CellKind, Dir, number];

interface SavedLevel {
  name: string;
  cols: number;
  rows: number;
  cells: SavedCell[];
}

const SAVE_KEY = "zero-player-game-saves";
const SKIP_CLEAR_CONFIRM_KEY = "zero-player-game-skip-clear-confirm";

const UNLIMITED: Partial<Record<BrushKind, number>> = {
  mover: Infinity,
  push: Infinity,
  slide: Infinity,
  wall: Infinity,
  rotcw: Infinity,
  rotccw: Infinity,
  gen: Infinity,
  bomb: Infinity,
  multibomb: Infinity,
  conway: Infinity,
  enemy: Infinity,
  trash: Infinity,
  glue: Infinity,
};

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

// Layout legend. Directional cells get one character per facing so levels stay
// readable as plain text.
const LEGEND: Record<string, Cell> = {
  ">": { kind: "mover", dir: 0 },
  v: { kind: "mover", dir: 1 },
  "<": { kind: "mover", dir: 2 },
  "^": { kind: "mover", dir: 3 },
  p: { kind: "push", dir: 0 },
  s: { kind: "slide", dir: 0 }, // slides horizontally
  S: { kind: "slide", dir: 1 }, // slides vertically
  "#": { kind: "wall", dir: 0 },
  c: { kind: "rotcw", dir: 0 },
  a: { kind: "rotccw", dir: 0 },
  R: { kind: "gen", dir: 0 },
  D: { kind: "gen", dir: 1 },
  L: { kind: "gen", dir: 2 },
  U: { kind: "gen", dir: 3 },
  b: { kind: "bomb", dir: 0 },
  m: { kind: "multibomb", dir: 0 },
  o: { kind: "conway", dir: 0 },
  e: { kind: "enemy", dir: 0 },
  t: { kind: "trash", dir: 0 },
};

const LEVELS: Level[] = [
  {
    name: "1. Wake It Up",
    hint: "A mover walks forward forever. Point one at the enemy and let go.",
    layout: [
      "..............",
      "..............",
      "..............",
      "...........e..",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      "..............",
      "..............",
      ".xx...........",
      "..............",
      "..............",
    ],
    inventory: { mover: 1 },
  },
  {
    name: "2. Shove",
    hint: "Movers push whatever is in front of them. The block can do the hitting.",
    layout: [
      "..............",
      "..............",
      "....p......e..",
      "..............",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      "..............",
      ".xx...........",
      "..............",
      "..............",
      "..............",
    ],
    inventory: { mover: 1 },
  },
  {
    name: "3. Take A Turn",
    hint: "That purple wheel is a rotator: it spins its four neighbors every tick. Drive past it.",
    layout: [
      "..............",
      "......c.......",
      "..............",
      "..............",
      ".....e........",
      "..............",
    ],
    zone: [
      "..............",
      ".xxx..........",
      "..............",
      "..............",
      "..............",
      "..............",
    ],
    inventory: { mover: 1 },
  },
  {
    name: "4. Copy Machine",
    hint: "A generator copies whatever sits behind it out its front. Feed it a block.",
    layout: [
      "..............",
      "..............",
      "..............",
      ".........eee..",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      "..............",
      ".xxx..........",
      ".xxx..........",
      ".xxx..........",
      "..............",
    ],
    inventory: { push: 1, gen: 1 },
  },
  {
    name: "5. Trash Day",
    hint: "Two lanes. Send a mover down one and a copy machine down the other. Trash eats the leftovers.",
    layout: [
      "..............",
      ".............e",
      "..............",
      "........e.e.t.",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      ".xxx..........",
      "..............",
      ".xxx..........",
      "..............",
      "..............",
    ],
    inventory: { mover: 1, push: 1, gen: 1 },
  },
  {
    name: "6. Sticky Tower",
    hint: "Glue is a bucket, not a block: paint it on cells and everything touching moves as one piece.",
    layout: [
      "..............",
      "..........e...",
      "..........e...",
      "..........e...",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      ".xxx..........",
      ".xxx..........",
      ".xxx..........",
      "..............",
      "..............",
    ],
    inventory: { mover: 1, push: 3, glue: Infinity },
  },
  {
    name: "7. Boom",
    hint: "A bomb blows up every enemy around it. A multi bomb does it over and over without dying.",
    layout: [
      "..............",
      ".........eee..",
      ".........eee..",
      ".........eee..",
      "..............",
      "..............",
    ],
    zone: [
      "..............",
      "..............",
      ".xxx..........",
      "..............",
      "..............",
      "..............",
    ],
    inventory: { mover: 1, multibomb: 1 },
  },
  {
    name: "8. Sandbox",
    hint: "A giant open grid, everything unlimited. Scroll to zoom, drag with the middle button or Shift to move around.",
    cols: 64,
    rows: 40,
    openZone: true,
    inventory: UNLIMITED,
  },
];

const PALETTE_ORDER: BrushKind[] = [
  "mover",
  "push",
  "slide",
  "wall",
  "rotcw",
  "rotccw",
  "gen",
  "bomb",
  "multibomb",
  "conway",
  "enemy",
  "trash",
];

const KIND_LABEL: Record<BrushKind, string> = {
  mover: "Mover",
  push: "Push",
  slide: "Slide",
  wall: "Wall",
  rotcw: "Rot CW",
  rotccw: "Rot CCW",
  gen: "Gen",
  glue: "Glue",
  bomb: "Bomb",
  multibomb: "Multi Bomb",
  conway: "Conway",
  enemy: "Enemy",
  trash: "Trash",
};

// What a generator is allowed to do with each kind of block.
//   generatorPushable — can a generator shove this out of the square in front of it?
//   generatorCopyable — can a generator duplicate this when it sits behind one?
// A generator that cannot clear its own output square jams after a single copy,
// so these two flags are what decide whether a machine keeps running.
interface GeneratorRules {
  generatorPushable: boolean;
  generatorCopyable: boolean;
}

const GENERATOR_RULES: Record<CellKind, GeneratorRules> = {
  mover: { generatorPushable: false, generatorCopyable: false },
  push: { generatorPushable: true, generatorCopyable: true },
  slide: { generatorPushable: true, generatorCopyable: true },
  wall: { generatorPushable: false, generatorCopyable: false },
  rotcw: { generatorPushable: true, generatorCopyable: true },
  rotccw: { generatorPushable: true, generatorCopyable: true },
  gen: { generatorPushable: true, generatorCopyable: true },
  bomb: { generatorPushable: true, generatorCopyable: true },
  multibomb: { generatorPushable: true, generatorCopyable: true },
  conway: { generatorPushable: true, generatorCopyable: true },
  enemy: { generatorPushable: true, generatorCopyable: false },
  trash: { generatorPushable: false, generatorCopyable: false },
};

// Only these care which way they face, so only these respond to the R key.
const DIRECTIONAL: ReadonlySet<BrushKind> = new Set<BrushKind>(["mover", "gen", "slide"]);

const canvasElement = document.getElementById("game");
if (!(canvasElement instanceof HTMLCanvasElement)) throw new Error("missing canvas");
const canvas: HTMLCanvasElement = canvasElement;
const context = canvas.getContext("2d");
if (!context) throw new Error("missing 2d context");
const ctx: CanvasRenderingContext2D = context;

const paletteEl = document.getElementById("palette");
const levelNameEl = document.getElementById("level-name");
const levelHintEl = document.getElementById("level-hint");
const winOverlay = document.getElementById("win-overlay");
const winNote = document.getElementById("win-note");
const speedInput = document.getElementById("speed");
const playButton = document.querySelector<HTMLButtonElement>('[data-action="play"]');
const nameInput = document.getElementById("level-name-input");
const saveSelect = document.getElementById("saved-levels");
const saveNote = document.getElementById("save-note");
const clearDialog = document.getElementById("clear-confirm");

// The grid is drawn through a simple camera so big levels can be zoomed out and
// dragged around. `tile` is always BASE_TILE * scale.
const BASE_TILE = 68;
const MIN_SCALE = 0.16;
const MAX_SCALE = 2.4;

let levelIndex = 0;
// Whatever is loaded right now — a built-in level or one of your own saves.
let currentLevel: Level = LEVELS[0] ?? { name: "", hint: "", inventory: {} };
let cols = 0;
let rows = 0;
let scale = 1;
let tile = BASE_TILE;
let originX = 0;
let originY = 0;

let grid: (Cell | null)[] = [];
let zone: boolean[] = [];
let buildSnapshot: (Cell | null)[] = [];
let inventory = new Map<BrushKind, number>();
let buildInventory = new Map<BrushKind, number>();

let brush: BrushKind | "eraser" = "mover";
let brushDir: Dir = 0;
let running = false;
let won = false;
let tickHandle = 0;

function index(x: number, y: number): number {
  return y * cols + x;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

function cellAt(x: number, y: number): Cell | null {
  return inBounds(x, y) ? grid[index(x, y)] ?? null : null;
}

function loadLevel(next: number): void {
  levelIndex = (next + LEVELS.length) % LEVELS.length;
  const level = LEVELS[levelIndex];
  if (level) applyLevel(level);
}

function applyLevel(level: Level): void {
  stopRunning();
  currentLevel = level;

  rows = level.layout?.length ?? level.rows ?? 6;
  cols = level.layout?.[0]?.length ?? level.cols ?? 14;
  grid = new Array<Cell | null>(cols * rows).fill(null);
  zone = new Array<boolean>(cols * rows).fill(level.openZone === true);

  for (let y = 0; y < rows; y += 1) {
    const layoutRow = level.layout?.[y] ?? "";
    const zoneRow = level.zone?.[y] ?? "";
    for (let x = 0; x < cols; x += 1) {
      const template = LEGEND[layoutRow[x] ?? "."];
      if (template) grid[index(x, y)] = { ...template };
      if (level.zone) zone[index(x, y)] = zoneRow[x] === "x";
    }
  }

  for (const [idx, kind, dir, glued] of level.cells ?? []) {
    if (idx >= 0 && idx < grid.length) grid[idx] = { kind, dir, glued: glued === 1 };
  }

  inventory = new Map(Object.entries(level.inventory) as [BrushKind, number][]);
  const firstKind = PALETTE_ORDER.find((kind) => (inventory.get(kind) ?? 0) > 0);
  brush = firstKind ?? "eraser";
  brushDir = 0;
  won = false;

  fitView();
  saveBuildState();
  if (levelNameEl) levelNameEl.textContent = level.name;
  if (levelHintEl) levelHintEl.textContent = level.hint;
  if (winOverlay) winOverlay.hidden = true;
  renderPalette();
  draw();
}

// Pulls the camera back until the whole level is on screen, then centers it.
function fitView(): void {
  const raw = Math.min(canvas.width / (cols * BASE_TILE), canvas.height / (rows * BASE_TILE));
  setScale(raw);
  originX = (canvas.width - tile * cols) / 2;
  originY = (canvas.height - tile * rows) / 2;
}

function setScale(next: number): void {
  scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
  tile = BASE_TILE * scale;
}

// Keeps the grid from being dragged off into nowhere: a level bigger than the
// canvas can be scrolled to its edges, a smaller one stays fully on screen.
function clampCamera(): void {
  const gridWidth = cols * tile;
  const gridHeight = rows * tile;
  originX =
    gridWidth <= canvas.width
      ? Math.min(Math.max(originX, 0), canvas.width - gridWidth)
      : Math.min(Math.max(originX, canvas.width - gridWidth), 0);
  originY =
    gridHeight <= canvas.height
      ? Math.min(Math.max(originY, 0), canvas.height - gridHeight)
      : Math.min(Math.max(originY, canvas.height - gridHeight), 0);
}

// Zooms around a point on the canvas so whatever is under the cursor stays put.
function zoomAt(canvasX: number, canvasY: number, factor: number): void {
  const worldX = (canvasX - originX) / tile;
  const worldY = (canvasY - originY) / tile;
  setScale(scale * factor);
  originX = canvasX - worldX * tile;
  originY = canvasY - worldY * tile;
  clampCamera();
  draw();
}

function zoomCenter(factor: number): void {
  zoomAt(canvas.width / 2, canvas.height / 2, factor);
}

function saveBuildState(): void {
  buildSnapshot = grid.map((cell) => (cell ? { ...cell } : null));
  buildInventory = new Map(inventory);
}

function restoreBuildState(): void {
  grid = buildSnapshot.map((cell) => (cell ? { ...cell } : null));
  inventory = new Map(buildInventory);
  won = false;
  if (winOverlay) winOverlay.hidden = true;
  renderPalette();
  draw();
}

/* ---------------------------------------------------------------- simulation */

// Everything touching through glue is one rigid body: collect the whole blob.
function glueGroup(start: number, out: Set<number>): void {
  const cell = grid[start];
  if (!cell || out.has(start)) return;
  out.add(start);
  if (!cell.glued) return;

  const stack = [start];
  while (stack.length > 0) {
    const idx = stack.pop();
    if (idx === undefined) continue;
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    for (let dir = 0; dir < 4; dir += 1) {
      const nx = x + (DX[dir] ?? 0);
      const ny = y + (DY[dir] ?? 0);
      if (!inBounds(nx, ny)) continue;
      const neighbor = index(nx, ny);
      if (out.has(neighbor) || !grid[neighbor]?.glued) continue;
      out.add(neighbor);
      stack.push(neighbor);
    }
  }
}

interface Contact {
  member: number;
  target: number;
  kind: "enemy" | "trash";
}

// Works out everything that has to shift one step in `dir` — the cell itself,
// anything glued to it, and anything it shoves — then commits the move. If any
// part of it is blocked, nothing happens at all.
function tryMove(start: number, dir: Dir): boolean {
  const dx = DX[dir] ?? 0;
  const dy = DY[dir] ?? 0;
  const moving = new Set<number>();
  const contacts: Contact[] = [];
  const queue: number[] = [start];

  while (queue.length > 0) {
    const seed = queue.pop();
    if (seed === undefined || moving.has(seed)) continue;

    const group = new Set<number>();
    glueGroup(seed, group);

    for (const member of group) {
      const cell = grid[member];
      if (!cell) continue;
      if (cell.kind === "wall") return false;
      // A slide only budges along its own axis: dir 0/2 is horizontal.
      if (cell.kind === "slide") {
        const slideHorizontal = cell.dir === 0 || cell.dir === 2;
        const pushHorizontal = dir === 0 || dir === 2;
        if (slideHorizontal !== pushHorizontal) return false;
      }
      moving.add(member);
    }

    for (const member of group) {
      const tx = (member % cols) + dx;
      const ty = Math.floor(member / cols) + dy;
      if (!inBounds(tx, ty)) return false;

      const target = index(tx, ty);
      if (moving.has(target)) continue;
      const occupant = grid[target];
      if (!occupant) continue;
      if (occupant.kind === "wall") return false;
      if (occupant.kind === "enemy") {
        contacts.push({ member, target, kind: "enemy" });
        continue;
      }
      if (occupant.kind === "trash") {
        contacts.push({ member, target, kind: "trash" });
        continue;
      }
      queue.push(target);
    }
  }

  if (moving.size === 0) return false;

  // Nothing is blocked, so resolve what gets destroyed on contact first.
  const destroyed = new Set<number>();
  for (const contact of contacts) {
    const member = grid[contact.member];
    if (!member) continue;

    if (contact.kind === "trash") {
      destroyed.add(contact.member);
      continue;
    }

    if (member.kind === "bomb" || member.kind === "multibomb") {
      explodeAt(contact.target);
      // A multi bomb walks into the hole it just made and keeps going.
      if (member.kind === "bomb") destroyed.add(contact.member);
      continue;
    }

    grid[contact.target] = null; // the enemy...
    destroyed.add(contact.member); // ...takes its attacker with it
  }

  for (const idx of destroyed) {
    grid[idx] = null;
    moving.delete(idx);
  }

  // Shift the survivors leading edge first so nothing overwrites itself.
  const order = [...moving].sort(
    (a, b) => progressAlong(b, dx, dy) - progressAlong(a, dx, dy)
  );
  for (const idx of order) {
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    grid[index(x + dx, y + dy)] = grid[idx] ?? null;
    grid[idx] = null;
  }

  return true;
}

function progressAlong(idx: number, dx: number, dy: number): number {
  return (idx % cols) * dx + Math.floor(idx / cols) * dy;
}

// Bombs clear every enemy in the 3x3 around the blast but leave your own
// machine standing, so a glued tower can drive straight through.
function explodeAt(center: number): void {
  const cx = center % cols;
  const cy = Math.floor(center / cols);
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const x = cx + ox;
      const y = cy + oy;
      if (!inBounds(x, y)) continue;
      if (grid[index(x, y)]?.kind === "enemy") grid[index(x, y)] = null;
    }
  }
}

// Movers facing right have to be handled rightmost-first or they trip over each
// other; same idea for the other three facings.
function scanOrder(dir: Dir): number[] {
  const order: number[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) order.push(index(x, y));
  }
  return order.sort((a, b) => {
    const ax = a % cols;
    const ay = Math.floor(a / cols);
    const bx = b % cols;
    const by = Math.floor(b / cols);
    if (dir === 0) return bx - ax || ay - by;
    if (dir === 2) return ax - bx || ay - by;
    if (dir === 1) return by - ay || ax - bx;
    return ay - by || ax - bx;
  });
}

function runGenerators(): void {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    for (const idx of scanOrder(dir)) {
      const cell = grid[idx];
      if (!cell || cell.kind !== "gen" || cell.dir !== dir) continue;

      const x = idx % cols;
      const y = Math.floor(idx / cols);
      const source = cellAt(x - (DX[dir] ?? 0), y - (DY[dir] ?? 0));
      if (!source || !GENERATOR_RULES[source.kind].generatorCopyable) continue;

      const tx = x + (DX[dir] ?? 0);
      const ty = y + (DY[dir] ?? 0);
      if (!inBounds(tx, ty)) continue;

      // Shove the output square clear first; if whatever is sitting there is not
      // generator-pushable, or simply will not budge, no copy happens.
      const occupant = grid[index(tx, ty)];
      if (occupant) {
        if (!GENERATOR_RULES[occupant.kind].generatorPushable) continue;
        if (!tryMove(index(tx, ty), dir)) continue;
        if (grid[index(tx, ty)]) continue;
      }
      grid[index(tx, ty)] = { ...source };
    }
  }
}

function runRotators(): void {
  const rotators: { idx: number; clockwise: boolean }[] = [];
  for (let idx = 0; idx < grid.length; idx += 1) {
    const cell = grid[idx];
    if (cell?.kind === "rotcw") rotators.push({ idx, clockwise: true });
    if (cell?.kind === "rotccw") rotators.push({ idx, clockwise: false });
  }

  for (const { idx, clockwise } of rotators) {
    const cell = grid[idx];
    if (!cell || (cell.kind !== "rotcw" && cell.kind !== "rotccw")) continue;
    const x = idx % cols;
    const y = Math.floor(idx / cols);
    for (let dir = 0; dir < 4; dir += 1) {
      const neighbor = cellAt(x + (DX[dir] ?? 0), y + (DY[dir] ?? 0));
      if (!neighbor || !DIRECTIONAL.has(neighbor.kind)) continue;
      neighbor.dir = (((neighbor.dir + (clockwise ? 1 : 3)) % 4) as Dir);
    }
  }
}

function runMovers(): void {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    for (const idx of scanOrder(dir)) {
      const cell = grid[idx];
      if (!cell || cell.kind !== "mover" || cell.dir !== dir) continue;
      tryMove(idx, dir);
    }
  }
}

// Conway's Game of Life, played on the same grid: a live cell with 2 or 3 live
// neighbours survives, and an empty square with exactly 3 is born into. Every
// square is judged against the same snapshot so the whole generation flips at
// once, which is what makes gliders glide.
function runConway(): void {
  const alive = new Set<number>();
  for (let idx = 0; idx < grid.length; idx += 1) {
    if (grid[idx]?.kind === "conway") alive.add(idx);
  }
  if (alive.size === 0) return;

  // Only live cells and the squares around them can possibly change.
  const candidates = new Set<number>(alive);
  for (const idx of alive) {
    for (const neighbor of neighbors8(idx)) candidates.add(neighbor);
  }

  const dying: number[] = [];
  const born: number[] = [];
  for (const idx of candidates) {
    let count = 0;
    for (const neighbor of neighbors8(idx)) {
      if (alive.has(neighbor)) count += 1;
    }
    if (alive.has(idx)) {
      if (count < 2 || count > 3) dying.push(idx);
    } else if (count === 3 && !grid[idx]) {
      // Births only land on genuinely empty squares — never on top of a wall,
      // a mover, or anything else the machine is using.
      born.push(idx);
    }
  }

  for (const idx of dying) grid[idx] = null;
  for (const idx of born) grid[idx] = { kind: "conway", dir: 0 };
}

function neighbors8(idx: number): number[] {
  const x = idx % cols;
  const y = Math.floor(idx / cols);
  const out: number[] = [];
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const nx = x + ox;
      const ny = y + oy;
      if (inBounds(nx, ny)) out.push(index(nx, ny));
    }
  }
  return out;
}

function step(): void {
  if (won) return;
  runGenerators();
  runRotators();
  runMovers();
  runConway();
  draw();

  // A level you built with no enemies in it has nothing to win, so don't pop
  // the banner the instant a bare sandbox starts running.
  const startedWithEnemies = buildSnapshot.some((cell) => cell?.kind === "enemy");
  if (startedWithEnemies && !grid.some((cell) => cell?.kind === "enemy")) declareWin();
}

function declareWin(): void {
  won = true;
  stopRunning();
  if (winNote) {
    winNote.textContent =
      levelIndex === LEVELS.length - 1
        ? "Nothing left to destroy. Still a zero player game."
        : "Every enemy cell is gone. You never touched it.";
  }
  if (winOverlay) winOverlay.hidden = false;
  draw();
}

/* ------------------------------------------------------------------ controls */

// The build snapshot is banked on every edit, so pausing and resuming must not
// re-bank it here or Reset would restore a half-simulated grid.
function startRunning(): void {
  if (running || won) return;
  running = true;
  playButton?.classList.add("is-running");
  if (playButton) playButton.textContent = "⏸ Pause";
  scheduleTick();
  draw();
}

function scheduleTick(): void {
  window.clearTimeout(tickHandle);
  const speed = speedInput instanceof HTMLInputElement ? Number(speedInput.value) : 5;
  const delay = Math.max(60, 620 - speed * 55);
  tickHandle = window.setTimeout(() => {
    if (!running) return;
    step();
    if (running) scheduleTick();
  }, delay);
}

function stopRunning(): void {
  running = false;
  window.clearTimeout(tickHandle);
  playButton?.classList.remove("is-running");
  if (playButton) playButton.textContent = "▶ Play";
}

/* ---------------------------------------------------------------- clear all */

// Asks first, unless you have told it not to bother.
function requestClearGrid(): void {
  if (running || won) return;
  if (readSkipClearConfirm()) {
    clearGrid();
    return;
  }
  if (clearDialog) clearDialog.hidden = false;
}

function clearGrid(): void {
  if (clearDialog) clearDialog.hidden = true;

  for (let idx = 0; idx < grid.length; idx += 1) {
    const cell = grid[idx];
    // Only your own squares get wiped, so a puzzle keeps its walls and enemies.
    if (!cell || !zone[idx]) continue;
    refund(cell.kind);
    grid[idx] = null;
  }

  saveBuildState();
  renderPalette();
  draw();
}

function readSkipClearConfirm(): boolean {
  try {
    return localStorage.getItem(SKIP_CLEAR_CONFIRM_KEY) === "true";
  } catch {
    return false;
  }
}

function setSkipClearConfirm(): void {
  try {
    localStorage.setItem(SKIP_CLEAR_CONFIRM_KEY, "true");
  } catch {
    /* asking again is a fine fallback */
  }
}

/* --------------------------------------------------------------- your levels */

function readSaves(): SavedLevel[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedLevel[]) : [];
  } catch {
    return [];
  }
}

function writeSaves(list: SavedLevel[]): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list));
  } catch {
    flashSaveNote("Could not save — storage is full.");
  }
}

function refreshSaveList(selected?: string): void {
  if (!(saveSelect instanceof HTMLSelectElement)) return;
  const saves = readSaves();
  saveSelect.innerHTML = "";

  if (saves.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No saved levels yet";
    saveSelect.appendChild(empty);
    return;
  }

  for (const save of saves) {
    const option = document.createElement("option");
    option.value = save.name;
    option.textContent = save.name;
    saveSelect.appendChild(option);
  }
  if (selected) saveSelect.value = selected;
}

// Saves the built machine, never a half-run one, so reopening gives you back
// exactly what you drew.
function saveCurrentLevel(): void {
  const typed = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
  const name = typed || `My Level ${readSaves().length + 1}`;

  const cells: SavedCell[] = [];
  buildSnapshot.forEach((cell, idx) => {
    if (cell) cells.push([idx, cell.kind, cell.dir, cell.glued === true ? 1 : 0]);
  });

  const saves = readSaves().filter((save) => save.name !== name);
  saves.push({ name, cols, rows, cells });
  writeSaves(saves);
  refreshSaveList(name);
  if (nameInput instanceof HTMLInputElement) nameInput.value = name;
  flashSaveNote(`Saved "${name}" — ${cells.length} cells.`);
}

function openSelectedLevel(): void {
  if (!(saveSelect instanceof HTMLSelectElement) || !saveSelect.value) return;
  const save = readSaves().find((entry) => entry.name === saveSelect.value);
  if (!save) return;

  applyLevel({
    name: save.name,
    hint: "One of your own levels. Everything is unlimited — rebuild it and save again whenever.",
    cols: save.cols,
    rows: save.rows,
    openZone: true,
    cells: save.cells,
    inventory: UNLIMITED,
  });
  if (nameInput instanceof HTMLInputElement) nameInput.value = save.name;
  flashSaveNote(`Opened "${save.name}".`);
}

function deleteSelectedLevel(): void {
  if (!(saveSelect instanceof HTMLSelectElement) || !saveSelect.value) return;
  const name = saveSelect.value;
  writeSaves(readSaves().filter((save) => save.name !== name));
  refreshSaveList();
  flashSaveNote(`Deleted "${name}".`);
}

function flashSaveNote(message: string): void {
  if (!saveNote) return;
  saveNote.textContent = message;
}

function paletteCount(kind: BrushKind): number {
  return inventory.get(kind) ?? 0;
}

function renderPalette(): void {
  if (!paletteEl) return;
  paletteEl.innerHTML = "";

  const kinds = PALETTE_ORDER.filter((kind) => (currentLevel.inventory[kind] ?? 0) > 0);
  for (const kind of kinds) paletteEl.appendChild(buildBrushButton(kind));

  paletteEl.appendChild(buildEraserButton());
  paletteEl.appendChild(buildClearButton());

  // Glue sits after the eraser: it is a paint bucket, not one of the cells.
  if ((currentLevel.inventory["glue"] ?? 0) > 0) {
    paletteEl.appendChild(buildBrushButton("glue"));
  }
}

function buildBrushButton(kind: BrushKind): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `palette-item${brush === kind ? " is-active" : ""}`;
  const remaining = paletteCount(kind);
  button.disabled = remaining <= 0;

  const icon = document.createElement("canvas");
  icon.width = 44;
  icon.height = 44;
  const iconCtx = icon.getContext("2d");
  if (iconCtx) {
    if (kind === "glue") drawGlueBucket(iconCtx, 44);
    else drawCell(iconCtx, { kind, dir: DIRECTIONAL.has(kind) ? brushDir : 0 }, 0, 0, 44);
  }

  const label = document.createElement("span");
  label.textContent = KIND_LABEL[kind];

  button.append(icon, label);
  if (Number.isFinite(remaining)) {
    const count = document.createElement("span");
    count.className = "palette-count";
    count.textContent = String(remaining);
    button.appendChild(count);
  }

  button.addEventListener("click", () => {
    brush = kind;
    renderPalette();
    draw();
  });
  return button;
}

function buildEraserButton(): HTMLButtonElement {
  const eraser = document.createElement("button");
  eraser.type = "button";
  eraser.className = `palette-item${brush === "eraser" ? " is-active" : ""}`;
  const icon = document.createElement("canvas");
  icon.width = 44;
  icon.height = 44;
  const iconCtx = icon.getContext("2d");
  if (iconCtx) drawEraserIcon(iconCtx, 44);
  const label = document.createElement("span");
  label.textContent = "Erase";
  eraser.append(icon, label);
  eraser.addEventListener("click", () => {
    brush = "eraser";
    renderPalette();
    draw();
  });
  return eraser;
}

// Not a brush — one press wipes the board, so it never becomes the active tool.
function buildClearButton(): HTMLButtonElement {
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "palette-item palette-clear";
  const icon = document.createElement("canvas");
  icon.width = 44;
  icon.height = 44;
  const iconCtx = icon.getContext("2d");
  if (iconCtx) drawClearIcon(iconCtx, 44);
  const label = document.createElement("span");
  label.textContent = "Clear All";
  clear.append(icon, label);
  clear.addEventListener("click", requestClearGrid);
  return clear;
}

function pointerCell(event: PointerEvent | MouseEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const px = (event.clientX - rect.left) * scale - originX;
  const py = (event.clientY - rect.top) * scale - originY;
  const x = Math.floor(px / tile);
  const y = Math.floor(py / tile);
  return inBounds(x, y) ? { x, y } : null;
}

function placeAt(x: number, y: number, erase: boolean): void {
  if (running || won) return;
  if (!zone[index(x, y)]) return;

  const existing = grid[index(x, y)];

  if (erase || brush === "eraser") {
    if (!existing) return;
    refund(existing.kind);
    grid[index(x, y)] = null;
  } else if (brush === "glue") {
    // The bucket paints stickiness onto whatever is already there; painting the
    // same cell again wipes it off.
    if (!existing) return;
    existing.glued = !existing.glued;
  } else if (existing && existing.kind === brush) {
    // Clicking a cell you already placed spins it, which beats erase-and-replace.
    if (DIRECTIONAL.has(existing.kind)) existing.dir = ((existing.dir + 1) % 4) as Dir;
  } else {
    if (paletteCount(brush) <= 0) return;
    if (existing) refund(existing.kind);
    grid[index(x, y)] = {
      kind: brush,
      dir: DIRECTIONAL.has(brush) ? brushDir : 0,
      glued: existing?.glued === true,
    };
    spend(brush);
  }

  saveBuildState();
  renderPalette();
  draw();
}

function spend(kind: BrushKind): void {
  const remaining = inventory.get(kind);
  if (remaining === undefined || !Number.isFinite(remaining)) return;
  inventory.set(kind, remaining - 1);
}

function refund(kind: BrushKind): void {
  const remaining = inventory.get(kind);
  if (remaining === undefined || !Number.isFinite(remaining)) return;
  inventory.set(kind, remaining + 1);
}

/* ------------------------------------------------------------------ painting */

const COLORS: Record<CellKind, { face: string; edge: string; mark: string }> = {
  mover: { face: "#3fb6ff", edge: "#0a4a74", mark: "#eaffff" },
  push: { face: "#c9924f", edge: "#5e3d16", mark: "#3a2409" },
  slide: { face: "#d9b263", edge: "#6b4c15", mark: "#3a2409" },
  wall: { face: "#57606f", edge: "#232833", mark: "#8b95a5" },
  rotcw: { face: "#b06bff", edge: "#4a1d80", mark: "#f4e6ff" },
  rotccw: { face: "#ff6bd6", edge: "#7c1a5d", mark: "#ffe9f8" },
  gen: { face: "#3ed07d", edge: "#12613a", mark: "#e9fff2" },
  bomb: { face: "#3b3f52", edge: "#15171f", mark: "#ffb648" },
  multibomb: { face: "#5a3f9c", edge: "#241546", mark: "#ffd166" },
  conway: { face: "#8ed14f", edge: "#2f5b1a", mark: "#f6ffe8" },
  enemy: { face: "#ff4d5e", edge: "#7d1620", mark: "#ffe4e6" },
  trash: { face: "#2c3140", edge: "#12141c", mark: "#c9d2e0" },
};

const GLUE = "#ffd15c";

function draw(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#041f2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Only the tiles inside the viewport are worth drawing once the grid is big.
  const firstX = Math.max(0, Math.floor(-originX / tile));
  const lastX = Math.min(cols - 1, Math.ceil((canvas.width - originX) / tile));
  const firstY = Math.max(0, Math.floor(-originY / tile));
  const lastY = Math.min(rows - 1, Math.ceil((canvas.height - originY) / tile));

  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = firstX; x <= lastX; x += 1) {
      const px = originX + x * tile;
      const py = originY + y * tile;
      const buildable = zone[index(x, y)];

      ctx.fillStyle = buildable ? "#3a1547" : "#06293c";
      ctx.fillRect(px, py, tile, tile);
      ctx.strokeStyle = buildable ? "rgba(228, 123, 255, 0.55)" : "rgba(121, 242, 234, 0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);

      const cell = grid[index(x, y)];
      if (cell) drawCell(ctx, cell, px, py, tile);
      if (cell?.glued) drawGlueSeams(x, y, px, py);
    }
  }

  // Hovering brush preview would need pointer tracking; the palette highlight
  // and the pink zone are enough of a cue.
  if (running) {
    ctx.fillStyle = "rgba(121, 242, 234, 0.9)";
    ctx.font = "bold 20px Impact, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("RUNNING — HANDS OFF", 14, 28);
  }
}

// Glued cells get a sticky rim, plus a fat blob across any seam they share with
// another glued cell so a bonded tower reads as one object.
function drawGlueSeams(x: number, y: number, px: number, py: number): void {
  ctx.strokeStyle = GLUE;
  ctx.lineWidth = Math.max(1.5, tile * 0.055);
  const inset = tile * 0.09;
  ctx.strokeRect(px + inset, py + inset, tile - inset * 2, tile - inset * 2);

  ctx.fillStyle = GLUE;
  const thick = Math.max(2, tile * 0.16);
  const long = tile * 0.42;
  // Only look right and down so each seam is painted once.
  if (grid[index(x + 1, y)]?.glued && x + 1 < cols) {
    ctx.fillRect(px + tile - thick / 2, py + (tile - long) / 2, thick, long);
  }
  if (y + 1 < rows && grid[index(x, y + 1)]?.glued) {
    ctx.fillRect(px + (tile - long) / 2, py + tile - thick / 2, long, thick);
  }
}

function drawCell(target: CanvasRenderingContext2D, cell: Cell, px: number, py: number, size: number): void {
  const colors = COLORS[cell.kind];
  const pad = Math.max(2, Math.round(size * 0.06));
  const x = px + pad;
  const y = py + pad;
  const s = size - pad * 2;

  target.fillStyle = colors.face;
  target.fillRect(x, y, s, s);
  target.lineWidth = Math.max(2, Math.round(size * 0.07));
  target.strokeStyle = colors.edge;
  target.strokeRect(x + target.lineWidth / 2, y + target.lineWidth / 2, s - target.lineWidth, s - target.lineWidth);

  const cx = x + s / 2;
  const cy = y + s / 2;

  switch (cell.kind) {
    case "mover":
      drawArrow(target, cx, cy, s, cell.dir, colors.mark);
      break;
    case "push":
      drawDots(target, cx, cy, s, colors.mark);
      break;
    case "slide":
      drawSlideBar(target, cx, cy, s, cell.dir, colors.mark);
      break;
    case "wall":
      drawRivets(target, x, y, s, colors.mark);
      break;
    case "rotcw":
    case "rotccw":
      drawSpin(target, cx, cy, s, cell.kind === "rotcw", colors.mark);
      break;
    case "gen":
      drawGenerator(target, cx, cy, s, cell.dir, colors.mark);
      break;
    case "bomb":
    case "multibomb":
      drawBomb(target, cx, cy, s, colors.mark, cell.kind === "multibomb");
      break;
    case "conway":
      target.fillStyle = colors.mark;
      target.beginPath();
      target.arc(cx, cy, s * 0.26, 0, Math.PI * 2);
      target.fill();
      break;
    case "enemy":
      drawCross(target, cx, cy, s * 0.28, colors.mark, Math.max(3, s * 0.12));
      break;
    case "trash":
      drawTrash(target, cx, cy, s, colors.mark);
      break;
  }
}

function drawArrow(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: Dir, color: string): void {
  const r = s * 0.3;
  target.save();
  target.translate(cx, cy);
  target.rotate((dir * Math.PI) / 2);
  target.fillStyle = color;
  target.beginPath();
  target.moveTo(r, 0);
  target.lineTo(-r * 0.7, -r * 0.85);
  target.lineTo(-r * 0.25, 0);
  target.lineTo(-r * 0.7, r * 0.85);
  target.closePath();
  target.fill();
  target.restore();
}

function drawDots(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  const r = Math.max(1.5, s * 0.07);
  const offset = s * 0.18;
  target.fillStyle = color;
  for (const [ox, oy] of [
    [-offset, -offset],
    [offset, -offset],
    [-offset, offset],
    [offset, offset],
  ]) {
    target.beginPath();
    target.arc(cx + (ox ?? 0), cy + (oy ?? 0), r, 0, Math.PI * 2);
    target.fill();
  }
}

function drawSlideBar(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: Dir, color: string): void {
  const long = s * 0.62;
  const thick = Math.max(3, s * 0.14);
  const horizontal = dir === 0 || dir === 2;
  target.fillStyle = color;
  target.fillRect(
    cx - (horizontal ? long : thick) / 2,
    cy - (horizontal ? thick : long) / 2,
    horizontal ? long : thick,
    horizontal ? thick : long
  );
}

function drawRivets(target: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  const r = Math.max(1.5, s * 0.06);
  const inset = s * 0.2;
  target.fillStyle = color;
  for (const [ox, oy] of [
    [inset, inset],
    [s - inset, inset],
    [inset, s - inset],
    [s - inset, s - inset],
  ]) {
    target.beginPath();
    target.arc(x + (ox ?? 0), y + (oy ?? 0), r, 0, Math.PI * 2);
    target.fill();
  }
}

function drawSpin(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, clockwise: boolean, color: string): void {
  const r = s * 0.26;
  target.save();
  target.translate(cx, cy);
  if (!clockwise) target.scale(-1, 1);
  target.strokeStyle = color;
  target.lineWidth = Math.max(2.5, s * 0.1);
  target.beginPath();
  target.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.75);
  target.stroke();
  target.fillStyle = color;
  target.beginPath();
  target.moveTo(r * 0.42, -r * 1.05);
  target.lineTo(r * 1.35, -r * 0.5);
  target.lineTo(r * 0.35, -r * 0.05);
  target.closePath();
  target.fill();
  target.restore();
}

function drawGenerator(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, dir: Dir, color: string): void {
  target.save();
  target.translate(cx, cy);
  target.rotate((dir * Math.PI) / 2);
  target.strokeStyle = color;
  target.lineWidth = Math.max(2.5, s * 0.09);
  const box = s * 0.2;
  target.strokeRect(-box - s * 0.1, -box, box * 2, box * 2);
  target.fillStyle = color;
  target.beginPath();
  target.moveTo(s * 0.34, 0);
  target.lineTo(s * 0.1, -s * 0.16);
  target.lineTo(s * 0.1, s * 0.16);
  target.closePath();
  target.fill();
  target.restore();
}

function drawCross(target: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number): void {
  target.strokeStyle = color;
  target.lineWidth = width;
  target.lineCap = "round";
  target.beginPath();
  target.moveTo(cx - r, cy - r);
  target.lineTo(cx + r, cy + r);
  target.moveTo(cx + r, cy - r);
  target.lineTo(cx - r, cy + r);
  target.stroke();
  target.lineCap = "butt";
}

// A fused ball. The multi bomb gets a second ring to say "this one survives".
function drawBomb(
  target: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  color: string,
  multi: boolean
): void {
  target.fillStyle = color;
  target.beginPath();
  target.arc(cx, cy + s * 0.04, s * 0.24, 0, Math.PI * 2);
  target.fill();

  target.strokeStyle = color;
  target.lineWidth = Math.max(2, s * 0.07);
  target.beginPath();
  target.moveTo(cx + s * 0.1, cy - s * 0.16);
  target.quadraticCurveTo(cx + s * 0.28, cy - s * 0.3, cx + s * 0.2, cy - s * 0.36);
  target.stroke();

  if (multi) {
    target.beginPath();
    target.arc(cx, cy + s * 0.04, s * 0.36, 0, Math.PI * 2);
    target.stroke();
  }
}

// The glue bucket: a tub with a drip coming off the lip.
function drawGlueBucket(target: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  target.fillStyle = "#0a3346";
  target.fillRect(2, 2, size - 4, size - 4);

  target.fillStyle = GLUE;
  target.beginPath();
  target.moveTo(cx - size * 0.24, size * 0.34);
  target.lineTo(cx + size * 0.24, size * 0.34);
  target.lineTo(cx + size * 0.16, size * 0.78);
  target.lineTo(cx - size * 0.16, size * 0.78);
  target.closePath();
  target.fill();

  target.strokeStyle = GLUE;
  target.lineWidth = 3;
  target.beginPath();
  target.arc(cx, size * 0.34, size * 0.24, Math.PI, 0);
  target.stroke();

  target.beginPath();
  target.arc(cx + size * 0.3, size * 0.52, size * 0.07, 0, Math.PI * 2);
  target.fill();
}

function drawTrash(target: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
  target.fillStyle = "#080a10";
  target.beginPath();
  target.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
  target.fill();
  target.strokeStyle = color;
  target.lineWidth = Math.max(2, s * 0.07);
  target.beginPath();
  target.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
  target.stroke();
}

function drawEraserIcon(target: CanvasRenderingContext2D, size: number): void {
  target.fillStyle = "#0a3346";
  target.fillRect(2, 2, size - 4, size - 4);
  target.strokeStyle = "#79f2ea";
  target.lineWidth = 3;
  target.strokeRect(3.5, 3.5, size - 7, size - 7);
  drawCross(target, size / 2, size / 2, size * 0.2, "#ff8ec9", 4);
}

// Same shape as the eraser but purple, so "wipe one cell" and "wipe the board"
// read as relatives without looking identical.
function drawClearIcon(target: CanvasRenderingContext2D, size: number): void {
  target.fillStyle = "#1d0f3c";
  target.fillRect(2, 2, size - 4, size - 4);
  target.strokeStyle = "#b06bff";
  target.lineWidth = 3;
  target.strokeRect(3.5, 3.5, size - 7, size - 7);
  drawCross(target, size / 2, size / 2, size * 0.24, "#c98bff", 5);
}

/* -------------------------------------------------------------------- wiring */

// Middle-drag or shift-drag slides the camera; plain clicks build.
let panPointer: number | null = null;
let panLastX = 0;
let panLastY = 0;

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.focus();

  if (event.button === 1 || event.shiftKey) {
    panPointer = event.pointerId;
    panLastX = event.clientX;
    panLastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  const spot = pointerCell(event);
  if (!spot) return;
  placeAt(spot.x, spot.y, event.button === 2);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== panPointer) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = canvas.width / rect.width;
  originX += (event.clientX - panLastX) * ratio;
  originY += (event.clientY - panLastY) * ratio;
  panLastX = event.clientX;
  panLastY = event.clientY;
  clampCamera();
  draw();
});

function endPan(event: PointerEvent): void {
  if (event.pointerId !== panPointer) return;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  panPointer = null;
}

canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    zoomAt(
      (event.clientX - rect.left) * ratio,
      (event.clientY - rect.top) * ratio,
      event.deltaY < 0 ? 1.12 : 1 / 1.12
    );
  },
  { passive: false }
);

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const spot = pointerCell(event);
  if (spot) placeAt(spot.x, spot.y, true);
});

window.addEventListener("keydown", (event) => {
  // Never steal keys from the level-name box.
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;

  const panStep = Math.max(48, tile);
  let panned = true;
  switch (event.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      originX += panStep;
      break;
    case "ArrowRight":
    case "d":
    case "D":
      originX -= panStep;
      break;
    case "ArrowUp":
    case "w":
    case "W":
      originY += panStep;
      break;
    case "ArrowDown":
    case "s":
    case "S":
      originY -= panStep;
      break;
    default:
      panned = false;
  }
  if (panned) {
    event.preventDefault();
    clampCamera();
    draw();
    return;
  }

  if (event.key === "r" || event.key === "R") {
    brushDir = ((brushDir + 1) % 4) as Dir;
    renderPalette();
    draw();
  }
  if (event.key === " ") {
    event.preventDefault();
    running ? stopRunning() : startRunning();
    draw();
  }
});

document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
  element.addEventListener("click", () => {
    const action = element.dataset["action"];
    if (action === "play") {
      running ? stopRunning() : startRunning();
      draw();
    }
    if (action === "step") {
      if (running) stopRunning();
      step();
    }
    if (action === "stop") {
      stopRunning();
      restoreBuildState();
    }
    if (action === "next-level") loadLevel(levelIndex + 1);
    if (action === "prev-level") loadLevel(levelIndex - 1);
    if (action === "clear-yes") clearGrid();
    if (action === "clear-cancel" && clearDialog) clearDialog.hidden = true;
    if (action === "clear-never") {
      setSkipClearConfirm();
      clearGrid();
    }
    if (action === "save-level") saveCurrentLevel();
    if (action === "load-level") openSelectedLevel();
    if (action === "delete-level") deleteSelectedLevel();
    if (action === "zoom-in") zoomCenter(1.25);
    if (action === "zoom-out") zoomCenter(1 / 1.25);
    if (action === "fit") {
      fitView();
      draw();
    }
  });
});

speedInput?.addEventListener("input", () => {
  if (running) scheduleTick();
});

refreshSaveList();
loadLevel(0);
