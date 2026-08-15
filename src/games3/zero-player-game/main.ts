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
  | "enemy"
  | "trash";

interface Cell {
  kind: CellKind;
  dir: Dir;
}

interface Level {
  name: string;
  hint: string;
  layout: string[];
  zone: string[];
  inventory: Partial<Record<CellKind, number>>;
}

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
    hint: "Two lanes, two enemies. Trash eats whatever the machine keeps spitting out.",
    layout: [
      "..............",
      ".....c........",
      "..............",
      "....e.........",
      "..............",
      ".........e..t.",
    ],
    zone: [
      "..............",
      ".xxx..........",
      "..............",
      "..............",
      "..............",
      ".xxx..........",
    ],
    inventory: { mover: 1, push: 1, gen: 1 },
  },
  {
    name: "6. Sandbox",
    hint: "Everything is unlimited and the whole grid is yours. Build something silly.",
    layout: [
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
      "..............",
    ],
    zone: [
      "xxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxx",
      "xxxxxxxxxxxxxx",
    ],
    inventory: {
      mover: Infinity,
      push: Infinity,
      slide: Infinity,
      wall: Infinity,
      rotcw: Infinity,
      rotccw: Infinity,
      gen: Infinity,
      enemy: Infinity,
      trash: Infinity,
    },
  },
];

const PALETTE_ORDER: CellKind[] = [
  "mover",
  "push",
  "slide",
  "wall",
  "rotcw",
  "rotccw",
  "gen",
  "enemy",
  "trash",
];

const KIND_LABEL: Record<CellKind, string> = {
  mover: "Mover",
  push: "Push",
  slide: "Slide",
  wall: "Wall",
  rotcw: "Rot CW",
  rotccw: "Rot CCW",
  gen: "Gen",
  enemy: "Enemy",
  trash: "Trash",
};

// Only these care which way they face, so only these respond to the R key.
const DIRECTIONAL: ReadonlySet<CellKind> = new Set<CellKind>(["mover", "gen", "slide"]);

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

let levelIndex = 0;
let cols = 0;
let rows = 0;
let tile = 0;
let originX = 0;
let originY = 0;

let grid: (Cell | null)[] = [];
let zone: boolean[] = [];
let buildSnapshot: (Cell | null)[] = [];
let inventory = new Map<CellKind, number>();
let buildInventory = new Map<CellKind, number>();

let brush: CellKind | "eraser" = "mover";
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
  stopRunning();
  levelIndex = (next + LEVELS.length) % LEVELS.length;
  const level = LEVELS[levelIndex];
  if (!level) return;

  rows = level.layout.length;
  cols = level.layout[0]?.length ?? 0;
  grid = new Array<Cell | null>(cols * rows).fill(null);
  zone = new Array<boolean>(cols * rows).fill(false);

  for (let y = 0; y < rows; y += 1) {
    const layoutRow = level.layout[y] ?? "";
    const zoneRow = level.zone[y] ?? "";
    for (let x = 0; x < cols; x += 1) {
      const template = LEGEND[layoutRow[x] ?? "."];
      if (template) grid[index(x, y)] = { ...template };
      zone[index(x, y)] = zoneRow[x] === "x";
    }
  }

  inventory = new Map(Object.entries(level.inventory) as [CellKind, number][]);
  const firstKind = PALETTE_ORDER.find((kind) => (inventory.get(kind) ?? 0) > 0);
  brush = firstKind ?? "eraser";
  brushDir = 0;
  won = false;

  layoutGrid();
  saveBuildState();
  if (levelNameEl) levelNameEl.textContent = level.name;
  if (levelHintEl) levelHintEl.textContent = level.hint;
  if (winOverlay) winOverlay.hidden = true;
  renderPalette();
  draw();
}

// The canvas is a fixed size, so the tiles are sized to fit whatever grid the
// level asks for and then centered inside it.
function layoutGrid(): void {
  tile = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
  originX = Math.floor((canvas.width - tile * cols) / 2);
  originY = Math.floor((canvas.height - tile * rows) / 2);
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

// Walks the chain of cells ahead of (x, y) and shifts it one step if it can.
// Returns whether anything actually moved.
function tryPush(x: number, y: number, dir: Dir): boolean {
  const dx = DX[dir] ?? 0;
  const dy = DY[dir] ?? 0;
  const chain: number[] = [];
  let cx = x;
  let cy = y;

  for (;;) {
    if (!inBounds(cx, cy)) return false;
    const cell = grid[index(cx, cy)];

    if (!cell) break; // found the gap the chain slides into
    if (cell.kind === "wall") return false;
    // A slide only budges along its own axis: dir 0/2 is horizontal, 1/3 vertical.
    if (cell.kind === "slide") {
      const slideHorizontal = cell.dir === 0 || cell.dir === 2;
      const pushHorizontal = dir === 0 || dir === 2;
      if (slideHorizontal !== pushHorizontal) return false;
    }

    if (cell.kind === "trash" && chain.length > 0) {
      // The cell that would enter the trash is eaten; the trash stays put.
      const eaten = chain.pop();
      if (eaten !== undefined) grid[eaten] = null;
      shiftChain(chain, dx, dy);
      return true;
    }

    if (cell.kind === "enemy" && chain.length > 0) {
      // Enemies take their attacker down with them.
      grid[index(cx, cy)] = null;
      const attacker = chain.pop();
      if (attacker !== undefined) grid[attacker] = null;
      shiftChain(chain, dx, dy);
      return true;
    }

    chain.push(index(cx, cy));
    cx += dx;
    cy += dy;
  }

  if (chain.length === 0) return false;
  shiftChain(chain, dx, dy);
  return true;
}

// Moves the chain forward from the far end back, so nothing overwrites itself.
function shiftChain(chain: number[], dx: number, dy: number): void {
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const from = chain[i];
    if (from === undefined) continue;
    const fx = from % cols;
    const fy = Math.floor(from / cols);
    grid[index(fx + dx, fy + dy)] = grid[from] ?? null;
    grid[from] = null;
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
      if (!source) continue;

      const tx = x + (DX[dir] ?? 0);
      const ty = y + (DY[dir] ?? 0);
      if (!inBounds(tx, ty)) continue;

      // Shove the target square clear first; if it will not budge, no copy.
      if (grid[index(tx, ty)] && !tryPush(tx, ty, dir)) continue;
      if (grid[index(tx, ty)]) continue;
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
      tryPush(idx % cols, Math.floor(idx / cols), dir);
    }
  }
}

function step(): void {
  if (won) return;
  runGenerators();
  runRotators();
  runMovers();
  draw();

  if (!grid.some((cell) => cell?.kind === "enemy")) declareWin();
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

function paletteCount(kind: CellKind): number {
  return inventory.get(kind) ?? 0;
}

function renderPalette(): void {
  if (!paletteEl) return;
  paletteEl.innerHTML = "";

  const kinds = PALETTE_ORDER.filter((kind) => (LEVELS[levelIndex]?.inventory[kind] ?? 0) > 0);
  for (const kind of kinds) {
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
      drawCell(iconCtx, { kind, dir: DIRECTIONAL.has(kind) ? brushDir : 0 }, 0, 0, 44);
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
    paletteEl.appendChild(button);
  }

  const eraser = document.createElement("button");
  eraser.type = "button";
  eraser.className = `palette-item${brush === "eraser" ? " is-active" : ""}`;
  const eraserIcon = document.createElement("canvas");
  eraserIcon.width = 44;
  eraserIcon.height = 44;
  const eraserCtx = eraserIcon.getContext("2d");
  if (eraserCtx) drawEraserIcon(eraserCtx, 44);
  const eraserLabel = document.createElement("span");
  eraserLabel.textContent = "Erase";
  eraser.append(eraserIcon, eraserLabel);
  eraser.addEventListener("click", () => {
    brush = "eraser";
    renderPalette();
    draw();
  });
  paletteEl.appendChild(eraser);
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
  } else if (existing && existing.kind === brush) {
    // Clicking a cell you already placed spins it, which beats erase-and-replace.
    if (DIRECTIONAL.has(existing.kind)) existing.dir = ((existing.dir + 1) % 4) as Dir;
  } else {
    if (paletteCount(brush) <= 0) return;
    if (existing) refund(existing.kind);
    grid[index(x, y)] = { kind: brush, dir: DIRECTIONAL.has(brush) ? brushDir : 0 };
    spend(brush);
  }

  saveBuildState();
  renderPalette();
  draw();
}

function spend(kind: CellKind): void {
  const remaining = inventory.get(kind);
  if (remaining === undefined || !Number.isFinite(remaining)) return;
  inventory.set(kind, remaining - 1);
}

function refund(kind: CellKind): void {
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
  enemy: { face: "#ff4d5e", edge: "#7d1620", mark: "#ffe4e6" },
  trash: { face: "#2c3140", edge: "#12141c", mark: "#c9d2e0" },
};

function draw(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#041f2e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
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

/* -------------------------------------------------------------------- wiring */

canvas.addEventListener("pointerdown", (event) => {
  const spot = pointerCell(event);
  if (!spot) return;
  event.preventDefault();
  canvas.focus();
  placeAt(spot.x, spot.y, event.button === 2);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const spot = pointerCell(event);
  if (spot) placeAt(spot.x, spot.y, true);
});

window.addEventListener("keydown", (event) => {
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
  });
});

speedInput?.addEventListener("input", () => {
  if (running) scheduleTick();
});

loadLevel(0);
