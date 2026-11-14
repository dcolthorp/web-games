import { bleep, boing, buzzer, chime, crack, powerUp, thunder, thunk } from "../../shared/sfx";

// Make Your Own Maze (Oscar's design): balls shoot out of the cannon on the
// side and travel through the maze, only ever straight across or straight up
// and down, never diagonal. Every time a ball hits a block, you get money: a
// block 1 pays $1, a block 2 pays $2, and so on. Spend the money on more
// blocks and more balls. Drag two blocks with the same number together to
// merge them into the next number up. Each number is a different kind of
// block (see KINDS). Get a ball to the exit hole for a bonus. Every maze is
// saved in this browser.

// ---------------------------------------------------------------------------
// Board

const COLS = 9;
const ROWS = 13;
const CELL = 48;
const W = COLS * CELL;
const H = ROWS * CELL;
const BALL_R = 7;
const BALL_SPEED = 4.5; // squares per second
const START_MONEY = 10;
/** How far a ball travels from the middle of its square before it touches the next square's edge. */
const EDGE = 0.5 - BALL_R / CELL;

// Directions: 0 = right, 1 = down, 2 = left, 3 = up. The same numbers name the
// sides of a square (0 = right side, 1 = bottom, 2 = left side, 3 = top).
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

// Every block number is its own kind of block.
const BOUNCE = 0; // 1: Sends the ball straight back.
const SLOPE = 1; // 2: A ramp: turns the ball a corner. Click it to turn it.
const GHOST = 2; // 3: The ball goes right through it (and still pays).
const ARROW = 3; // 4: Sends the ball the way the arrow points. Click it to turn it.
const BOOSTER = 4; // 5: The ball goes through and zooms at double speed for a while.
const TURNER = 5; // 6: The ball goes through and turns right.
const GOLD = 6; // 7: Sends the ball back and pays triple.
const CHAIN = 7; // 8: Sends the ball back, and every block touching it pays too.
const DOUBLER = 8; // 9: Balls go through it and level up: golden, diamond, Nether Eye, then glitch.
const MYSTERY = 9; // 10 and up: not designed yet. They bounce for now.
const KIND_NAMES = ["Bouncer", "Slope", "Ghost", "Arrow", "Booster", "Turner", "Gold", "Chain", "Doubler", "Mystery"];

// What a ball turns into each time it goes through a Doubler, and how much
// extra it makes everything pay. A glitch ball phases through every block and
// can't make any money, so don't double too much!
const TIERS = [
  { name: "", mult: 1, color: "#ffffff", shine: "rgba(25,211,255,0.5)" },
  { name: "GOLDEN!", mult: 2, color: "#ffd21f", shine: "rgba(255,255,255,0.7)" },
  { name: "DIAMOND!", mult: 4, color: "#7ff3ff", shine: "rgba(255,255,255,0.9)" },
  { name: "NETHER EYE!", mult: 8, color: "#2a0d3d", shine: "#b04dff" },
  { name: "GLITCH!", mult: 0, color: "#ff00ff", shine: "#00ff66" },
];
const GLITCH = 4;
const BOOST_TIME = 3; // seconds

function kindOf(level: number): number {
  return Math.min(level - 1, MYSTERY);
}

/** Kinds that send the ball straight back, like a wall. */
function isSolidKind(k: number): boolean {
  return k === BOUNCE || k === GOLD || k === CHAIN || k === MYSTERY;
}

function turns(k: number): boolean {
  return k === SLOPE || k === ARROW;
}

/** The two open sides of a slope (the sides its ramp faces). */
function slopeOpen(rot: number): [number, number] {
  return [(2 + rot) % 4, (3 + rot) % 4];
}

/** A ball moving in direction `dir` into a slope: the new direction, or -1 if it hits the back of the slope. */
function slopeTurn(rot: number, dir: number): number {
  const from = (dir + 2) % 4;
  const [a, b] = slopeOpen(rot);
  if (from === a) return b;
  if (from === b) return a;
  return -1;
}

function blockCost(bought: number): number {
  return Math.round(3 * Math.pow(1.17, bought));
}

// ---------------------------------------------------------------------------
// The upgrade tree. Upgrades are yours forever, in every maze, but you pay
// for them with the money in the maze you're playing.

interface Upgrade {
  id: string;
  /** The name on its hexagon. */
  short: string;
  name: string;
  info: string;
  cost: number;
  /** The upgrade you need first. */
  needs: string | null;
  icon: string;
  /** Which branch it's on; each branch has its own color. */
  branch: "root" | "balls" | "start" | "luck" | "combine";
  /**
   * Where its hexagon sits in the honeycomb. q goes right, r goes down-right
   * at a slant; every upgrade touches the one it needs.
   */
  q: number;
  r: number;
}

const UPGRADES: Upgrade[] = [
  { id: "maker", short: "Maze Maker", name: "I'm a Maze Maker Now", info: "Prove it.", cost: 5, needs: null, icon: "🧱", branch: "root", q: 0, r: 0 },
  { id: "tree", short: "Upgrade Tree", name: "Unlock Upgrade Tree", info: "Opens up the rest of the tree.", cost: 15, needs: "maker", icon: "🌳", branch: "root", q: 0, r: -1 },
  // Combine (down and to the left of the tree): mix blocks with different numbers.
  { id: "combine", short: "Unlock Combine", name: "Unlock Combine", info: "Drop a block on a block with a different number to combine them. The block you're holding keeps its kind, and its pay gets multiplied by what the other block paid.", cost: 5000, needs: "tree", icon: "🧬", branch: "combine", q: -1, r: 0 },
  // Balls branch (up and to the left): more balls in every maze.
  { id: "ball1", short: "+1 Ball", name: "+1 Ball", info: "One more ball in every maze.", cost: 20, needs: "tree", icon: "⚪", branch: "balls", q: -1, r: -1 },
  { id: "ball2", short: "+1 Ball", name: "+1 Ball", info: "One more ball in every maze.", cost: 60, needs: "ball1", icon: "⚪", branch: "balls", q: -2, r: -1 },
  { id: "ball3", short: "+1 Ball", name: "+1 Ball", info: "One more ball in every maze.", cost: 150, needs: "ball2", icon: "⚪", branch: "balls", q: -2, r: -2 },
  { id: "ball4", short: "+1 Ball", name: "+1 Ball", info: "One more ball in every maze.", cost: 400, needs: "ball3", icon: "⚪", branch: "balls", q: -3, r: -2 },
  // Start branch (straight up): new mazes start with more.
  { id: "startBall1", short: "+1 Start Ball", name: "+1 Starting Ball", info: "New mazes you make start with one more ball.", cost: 50, needs: "tree", icon: "🎱", branch: "start", q: 0, r: -2 },
  { id: "startBall2", short: "+1 Start Ball", name: "+1 Starting Ball", info: "New mazes you make start with one more ball.", cost: 150, needs: "startBall1", icon: "🎱", branch: "start", q: 0, r: -3 },
  { id: "startBall3", short: "+1 Start Ball", name: "+1 Starting Ball", info: "New mazes you make start with one more ball.", cost: 450, needs: "startBall2", icon: "🎱", branch: "start", q: 0, r: -4 },
  { id: "startBlock1", short: "+1 Start Block", name: "+1 Starting Block", info: "Blocks you get start as 2s instead of 1s.", cost: 80, needs: "startBall1", icon: "🧊", branch: "start", q: 1, r: -3 },
  { id: "startBlock2", short: "+1 Start Block", name: "+1 Starting Block", info: "Blocks you get start one number higher again.", cost: 300, needs: "startBlock1", icon: "🧊", branch: "start", q: 1, r: -4 },
  { id: "startBlock3", short: "+1 Start Block", name: "+1 Starting Block", info: "Blocks you get start one number higher again.", cost: 1000, needs: "startBlock2", icon: "🧊", branch: "start", q: 1, r: -5 },
  // Luck branch (up and to the right): star blocks.
  { id: "luck1", short: "+1 Luck", name: "+1 Star Block Luck", info: "Bought blocks have a 10% chance to be ★ star blocks, which pay ×2.", cost: 40, needs: "tree", icon: "⭐", branch: "luck", q: 1, r: -2 },
  { id: "luck2", short: "+1 Luck", name: "+1 Star Block Luck", info: "Another +10% chance of ★ star blocks.", cost: 120, needs: "luck1", icon: "⭐", branch: "luck", q: 2, r: -3 },
  { id: "luck3", short: "+1 Luck", name: "+1 Star Block Luck", info: "Another +10% chance of ★ star blocks.", cost: 300, needs: "luck2", icon: "⭐", branch: "luck", q: 3, r: -4 },
];

/** Hexagon centers in "hex units" (one hexagon is 1 wide). */
function hexSpot(u: Upgrade): { x: number; y: number } {
  const h = Math.sqrt(3) / 2; // a hexagon's height when it's 1 wide
  return { x: 0.75 * u.q, y: h * (u.r + u.q / 2) };
}

const UPGRADE_KEY = "make-your-own-maze:upgrades";

function loadUpgrades(): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(UPGRADE_KEY) ?? "[]");
    // Old saves called the first ones "startBall" and "startBlock".
    const ids = (Array.isArray(list) ? list : []).map((id: string) =>
      id === "startBall" ? "startBall1" : id === "startBlock" ? "startBlock1" : id
    );
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveUpgrades(owned: Set<string>): void {
  try {
    localStorage.setItem(UPGRADE_KEY, JSON.stringify([...owned]));
  } catch {
    /* ignore */
  }
}

function countOwned(owned: Set<string>, prefix: string): number {
  return [...owned].filter((id) => id.startsWith(prefix)).length;
}

// ---------------------------------------------------------------------------
// Achievements (Oscar's idea). Like upgrades, they count for all your mazes.

const ACHIEVEMENTS = [
  { id: "maker", icon: "🧱", name: "I'm a Maze Maker Now", info: "Buy your first upgrade." },
  { id: "million", icon: "💵", name: "First Million", info: "Have $1M in a maze." },
  { id: "merge9", icon: "🔨", name: "Merge Master", info: "Make a block 9." },
  { id: "combo", icon: "🧬", name: "Combo Breaker", info: "Combine two blocks." },
  { id: "glitched", icon: "👾", name: "Glitched", info: "Turn a ball into a Glitch." },
  { id: "copycat", icon: "📋", name: "Copycat", info: "Paste a block." },
  { id: "howDid", icon: "🌌", name: "How Did We Get Here?", info: "Reach $1.00e100. The rarest achievement in Make Your Own Maze." },
  { id: "angelic", icon: "😇", name: "Angelic Demon of Mazes", info: "Get every single other achievement." },
];

const TROPHY_KEY = "make-your-own-maze:achievements";

function loadTrophies(): Set<string> {
  try {
    const list = JSON.parse(localStorage.getItem(TROPHY_KEY) ?? "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function saveTrophies(got: Set<string>): void {
  try {
    localStorage.setItem(TROPHY_KEY, JSON.stringify([...got]));
  } catch {
    /* ignore */
  }
}

/** The number on new blocks: 1, or higher with "+1 starting block" upgrades. */
function startLevel(owned: Set<string>): number {
  return 1 + countOwned(owned, "startBlock");
}

function blockColor(level: number): string {
  const hue = (200 + (level - 1) * 41) % 360;
  return `hsl(${hue} 85% 58%)`;
}

function blockDark(level: number): string {
  const hue = (200 + (level - 1) * 41) % 360;
  return `hsl(${hue} 70% 32%)`;
}

// Short names for big numbers: million, billion, trillion, quadrillion, …
const BIG_NAMES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/** Money, kept short so giant numbers still fit on the screen. */
function money(n: number): string {
  if (!Number.isFinite(n)) return "$∞";
  if (n < 1e6) return "$" + Math.floor(n).toLocaleString("en-US");
  const power = Math.floor(Math.log10(n) / 3);
  if (power < BIG_NAMES.length) {
    const short = n / Math.pow(1000, power);
    return "$" + short.toFixed(short < 10 ? 2 : short < 100 ? 1 : 0) + BIG_NAMES[power];
  }
  // Past decillions, use "e" numbers: $2.81e46 means 2.81 with 46 zeros after the 2.
  const [digits, exp] = n.toExponential(2).split("e");
  return "$" + digits + "e" + Number(exp);
}

// ---------------------------------------------------------------------------
// Saving

interface Maze {
  id: string;
  name: string;
  money: number;
  /** One number per square, row by row. 0 is empty; 1, 2, 3… is a block. */
  cells: number[];
  /** Which way each block is turned (0 to 3). Only slopes and arrows use it. */
  rot: number[];
  /** 1 where a block is a ★ star block (pays double). */
  stars: number[];
  /** Extra pay multiplier from combining (0 or 1 means none). */
  bonus: number[];
  /**
   * A combined block's kind, when it isn't the usual one for its number (a 7
   * combined with a held 3 is a 7 that acts like a Ghost). -1 means the usual.
   */
  kinds: number[];
  /** 1 where old stone is still in the way. New mazes start full of it. */
  stone: number[];
  /** Has this maze shown its opening story yet? */
  storySeen: boolean;
  /** The cannon is always on the left side; this is which row it's in. */
  entranceRow: number;
  exit: { c: number; r: number };
  balls: number;
  blocksBought: number;
  updated: number;
}

const SAVE_KEY = "make-your-own-maze:mazes";

function idx(c: number, r: number): number {
  return r * COLS + c;
}

/** Fixes up mazes saved before the cannon, the exit and turnable blocks existed. */
function fixMaze(raw: Maze & { spawner?: { c: number; r: number } }): Maze {
  const m = raw;
  // Money that hit infinity used to save as nothing; it was as big as it gets.
  if (typeof m.money !== "number") m.money = Number.MAX_VALUE;
  if (!Array.isArray(m.rot) || m.rot.length !== COLS * ROWS) m.rot = new Array(COLS * ROWS).fill(0);
  if (!Array.isArray(m.stars) || m.stars.length !== COLS * ROWS) m.stars = new Array(COLS * ROWS).fill(0);
  if (!Array.isArray(m.bonus) || m.bonus.length !== COLS * ROWS) m.bonus = new Array(COLS * ROWS).fill(0);
  m.bonus = m.bonus.map((b) => (typeof b === "number" ? b : Number.MAX_VALUE));
  if (!Array.isArray(m.kinds) || m.kinds.length !== COLS * ROWS) m.kinds = new Array(COLS * ROWS).fill(-1);
  // Mazes made before the stone and the story keep going as they were: no
  // stone, and no story to sit through again.
  if (!Array.isArray(m.stone) || m.stone.length !== COLS * ROWS) m.stone = new Array(COLS * ROWS).fill(0);
  if (typeof m.storySeen !== "boolean") m.storySeen = true;
  if (typeof m.entranceRow !== "number") m.entranceRow = m.spawner?.r ?? 1;
  delete m.spawner;
  // Blocks can't sit where the cannon is: move the cannon to a free row.
  if ((m.cells[idx(0, m.entranceRow)] ?? 0) > 0) {
    for (let r = 0; r < ROWS; r++) {
      if ((m.cells[idx(0, r)] ?? 0) === 0) {
        m.entranceRow = r;
        break;
      }
    }
  }
  const exitOk = (c: number, r: number) => (m.cells[idx(c, r)] ?? 0) === 0 && !(c === 0 && r === m.entranceRow);
  if (!m.exit || !exitOk(m.exit.c, m.exit.r)) {
    m.exit = { c: COLS - 1, r: ROWS - 1 };
    search: for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = COLS - 1; c >= 0; c--) {
        if (exitOk(c, r)) {
          m.exit = { c, r };
          break search;
        }
      }
    }
  }
  return m;
}

function loadMazes(): Maze[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const list = raw ? (JSON.parse(raw) as Maze[]) : [];
    return Array.isArray(list)
      ? list.filter((m) => m && Array.isArray(m.cells) && m.cells.length === COLS * ROWS).map(fixMaze)
      : [];
  } catch {
    return [];
  }
}

function saveMazes(list: Maze[]): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list));
  } catch {
    // Storage is full or blocked; the maze still works until the page closes.
  }
}

/**
 * Numbers this big turn into "infinity", and infinity can't be saved (it comes
 * back as nothing). So anything past the biggest number gets kept at the
 * biggest number instead.
 */
function capBig(n: number): number {
  return Number.isNaN(n) ? 0 : Math.min(n, Number.MAX_VALUE);
}

function saveMaze(maze: Maze): void {
  maze.updated = Date.now();
  maze.money = capBig(maze.money);
  maze.bonus = maze.bonus.map(capBig);
  const list = loadMazes();
  const i = list.findIndex((m) => m.id === maze.id);
  if (i >= 0) list[i] = maze;
  else list.push(maze);
  saveMazes(list);
}

function newMaze(name: string): Maze {
  const cells = new Array(COLS * ROWS).fill(0);
  const entranceRow = Math.floor(ROWS / 2);
  const exit = { c: COLS - 1, r: ROWS - 1 };
  // You start off with one block, right in the cannon's line of fire.
  const owned = loadUpgrades();
  cells[idx(COLS - 3, entranceRow)] = startLevel(owned);
  // An old, destroyed maze: stone everywhere except the cannon, the exit and
  // your first block. You break it to make room.
  const stone = cells.map((v, i) => (v > 0 || i === idx(0, entranceRow) || i === idx(exit.c, exit.r) ? 0 : 1));
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    money: START_MONEY,
    cells,
    rot: new Array(COLS * ROWS).fill(0),
    stars: new Array(COLS * ROWS).fill(0),
    bonus: new Array(COLS * ROWS).fill(0),
    kinds: new Array(COLS * ROWS).fill(-1),
    stone,
    storySeen: false,
    entranceRow,
    exit,
    // "balls" is this maze's own balls; "+1 ball" upgrades add more on top.
    balls: 1 + countOwned(owned, "startBall"),
    blocksBought: 0,
    updated: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Screens

const app = document.getElementById("app")!;
let stopGame: (() => void) | null = null;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function showMenu(): void {
  stopGame?.();
  stopGame = null;
  const mazes = loadMazes().sort((a, b) => b.updated - a.updated);
  const extraBalls = countOwned(loadUpgrades(), "ball");
  app.innerHTML = `
    <h1>Make Your Own Maze</h1>
    <p class="tagline">Balls shoot through your maze. Every block they hit pays you. Merge blocks to make them pay more, and get balls to the exit for a bonus.</p>
    <form class="new-maze" id="new-form">
      <input id="new-name" maxlength="40" placeholder="Name your new maze" aria-label="New maze name" />
      <button class="btn primary" type="submit">Make a new maze</button>
    </form>
    <h2>My Mazes</h2>
    ${
      mazes.length === 0
        ? '<p class="empty">No mazes yet. Make one!</p>'
        : `<ul class="maze-list">${mazes
            .map((m) => {
              const best = Math.max(0, ...m.cells);
              return `
              <li class="maze-item">
                <div class="info">
                  <div class="name">${escapeHtml(m.name)}</div>
                  <div class="stats">${money(m.money)} · ${m.balls + extraBalls} ball${m.balls + extraBalls === 1 ? "" : "s"} · best block ${best}</div>
                </div>
                <button class="btn primary" data-play="${m.id}">Play</button>
                <button class="btn danger" data-delete="${m.id}" aria-label="Delete ${escapeHtml(m.name)}">Delete</button>
              </li>`;
            })
            .join("")}</ul>`
    }
  `;

  document.getElementById("new-form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("new-name") as HTMLInputElement;
    const name = input.value.trim() || `Maze ${mazes.length + 1}`;
    const maze = newMaze(name);
    saveMaze(maze);
    showGame(maze);
  });

  app.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const maze = loadMazes().find((m) => m.id === btn.dataset["play"]);
      if (maze) showGame(maze);
    })
  );

  app.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const maze = mazes.find((m) => m.id === btn.dataset["delete"]);
      if (!maze || !confirm(`Delete "${maze.name}"? You can't get it back.`)) return;
      saveMazes(loadMazes().filter((m) => m.id !== maze.id));
      showMenu();
    })
  );
}

// ---------------------------------------------------------------------------
// The game

interface Ball {
  /** The square the ball is in. */
  c: number;
  r: number;
  /** Which way it's moving (0 right, 1 down, 2 left, 3 up). */
  dir: number;
  /**
   * How far it is from the middle of its square, in squares. Going from 0 to 1
   * means heading into the next square. When the way is blocked it only goes
   * out to EDGE, bounces, and comes back with t running from -EDGE up to 0.
   */
  t: number;
  blocked: boolean;
  /** The block it's about to bounce off (or -1 for the wall). */
  hitCell: number;
  /** Money this ball has made since it left the cannon. */
  earned: number;
  /** Seconds of double speed left, from a booster block. */
  boost: number;
  /** 0 normal, 1 golden, 2 diamond, 3 Nether Eye, 4 glitch. */
  tier: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  age: number;
  big: boolean;
}

function showGame(maze: Maze): void {
  stopGame?.();
  app.innerHTML = `
    <div class="play-top">
      <button class="btn" id="to-menu">← My Mazes</button>
      <h2 id="maze-name" title="Click to rename">${escapeHtml(maze.name)}</h2>
      <span class="money" id="money"></span>
    </div>
    <div class="shop">
      <div class="buy-group">
        <button class="btn pick" id="lvl-down" aria-label="Buy a lower block">−</button>
        <button class="btn primary" id="buy-block"></button>
        <button class="btn pick" id="lvl-up" aria-label="Buy a higher block">+</button>
      </div>
      <button class="btn" id="upgrades">Upgrades<small>the upgrade tree</small></button>
      <button class="btn" id="mode" hidden></button>
      <button class="btn" id="copy"></button>
      <button class="btn" id="trophies"></button>
      <button class="btn" id="sound"></button>
    </div>
    <p class="hint stone-hint" id="stone-hint" hidden>⛏️ Click and drag over the stone to break it. You can only build where it's clear.</p>
    <div class="board-wrap"><canvas id="board" width="${W}" height="${H}"></canvas></div>
    <div class="story" id="story" hidden>
      <div class="story-box">
        <p class="story-text" id="story-text"></p>
        <button class="btn primary" id="story-next">Next ▶</button>
      </div>
    </div>
    <div class="sell-bin" id="sell-bin">🗑️ Drag a block here to sell it</div>
    <p class="hint">Drag a block onto the same number to merge it. Click a slope or arrow to turn it. Drag the cannon up and down, and drag the exit anywhere.</p>
    <p class="hint">1 Bouncer · 2 Slope · 3 Ghost · 4 Arrow · 5 Booster · 6 Turner · 7 Gold · 8 Chain · 9 Doubler · ★ star blocks pay ×2</p>
    <div class="toast" id="toast" hidden></div>
    <div class="tree-backdrop" id="trophy-panel" hidden>
      <div class="tree-panel" role="dialog" aria-label="Achievements">
        <div class="tree-head">
          <h2>🏆 Achievements</h2>
          <button class="btn" id="trophy-close">Close</button>
        </div>
        <ul class="trophy-list" id="trophy-list"></ul>
      </div>
    </div>
    <div class="tree-backdrop" id="tree" hidden>
      <div class="tree-panel" role="dialog" aria-label="Upgrade tree">
        <div class="tree-head">
          <h2>Upgrade Tree</h2>
          <span class="money" id="tree-money"></span>
          <button class="btn" id="tree-close">Close</button>
        </div>
        <div id="tree-body"></div>
        <div class="skill-info" id="skill-info"></div>
      </div>
    </div>
  `;

  const canvas = document.getElementById("board") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const moneyEl = document.getElementById("money")!;
  const buyBlockBtn = document.getElementById("buy-block") as HTMLButtonElement;
  const lvlDown = document.getElementById("lvl-down") as HTMLButtonElement;
  const sellBin = document.getElementById("sell-bin")!;
  const BIN_TEXT = sellBin.textContent!;
  const lvlUp = document.getElementById("lvl-up") as HTMLButtonElement;
  // Which block number the Buy button gives you. It starts at your highest
  // (from "+1 starting block" upgrades), but you can turn it down.
  let buyLevel = -1;
  const buyingLevel = () => (buyLevel < 1 ? startLevel(owned) : Math.min(buyLevel, startLevel(owned)));
  const upgradesBtn = document.getElementById("upgrades") as HTMLButtonElement;
  const treeEl = document.getElementById("tree")!;
  const treeBody = document.getElementById("tree-body")!;
  const treeMoney = document.getElementById("tree-money")!;
  const skillInfo = document.getElementById("skill-info")!;
  let picked = "maker";
  const owned = loadUpgrades();
  const soundBtn = document.getElementById("sound") as HTMLButtonElement;
  const modeBtn = document.getElementById("mode") as HTMLButtonElement;
  // After "Unlock Combine", dropping on a different number combines instead of swapping.
  let combineMode = false;

  // Copy & Paste: click a block to copy it, then click empty squares to paste
  // exact copies. The copied block is remembered for all your mazes.
  interface Copied {
    level: number;
    kind: number;
    star: number;
    bonus: number;
    rot: number;
  }
  // --- Achievements ---------------------------------------------------

  const trophies = loadTrophies();
  const trophyBtn = document.getElementById("trophies") as HTMLButtonElement;
  const trophyPanel = document.getElementById("trophy-panel")!;
  const trophyList = document.getElementById("trophy-list")!;
  const toast = document.getElementById("toast")!;
  const stoneHint = document.getElementById("stone-hint")!;
  const toastQueue: string[] = [];
  let toastTimer = 0;

  function showNextToast(): void {
    const id = toastQueue.shift();
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    toast.innerHTML = `<span class="toast-icon">${a.icon}</span><span><small>🏆 Achievement unlocked!</small><strong>${a.name}</strong><em>${a.info}</em></span>`;
    toast.hidden = false;
    toast.classList.remove("pop");
    void toast.offsetWidth; // restart the pop animation
    toast.classList.add("pop");
    play(chime);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      showNextToast();
    }, 3500);
  }

  function unlock(id: string): void {
    if (trophies.has(id)) return;
    trophies.add(id);
    toastQueue.push(id);
    // Got every other one? Then you're the Angelic Demon of Mazes.
    if (!trophies.has("angelic") && ACHIEVEMENTS.every((a) => a.id === "angelic" || trophies.has(a.id))) {
      trophies.add("angelic");
      toastQueue.push("angelic");
    }
    saveTrophies(trophies);
    if (toast.hidden) showNextToast();
    updateShop();
  }

  /** Achievements you can tell just by looking at the maze. */
  function checkTrophies(): void {
    if (owned.size > 0) unlock("maker");
    if (maze.money >= 1e6) unlock("million");
    if (maze.money >= 1e100) unlock("howDid");
    if (maze.cells.some((v) => v >= 9)) unlock("merge9");
    if (maze.bonus.some((b) => b > 0 && b !== 1) || maze.kinds.some((k) => k >= 0)) unlock("combo");
  }

  function renderTrophies(): void {
    trophyList.innerHTML = ACHIEVEMENTS.map((a) => {
      const got = trophies.has(a.id);
      return `<li class="trophy${got ? " got" : ""}">
        <span class="trophy-icon">${got ? a.icon : "🔒"}</span>
        <span><strong>${a.name}</strong><em>${a.info}</em></span>
        <span class="trophy-check">${got ? "✓" : ""}</span>
      </li>`;
    }).join("");
  }

  trophyBtn.addEventListener("click", () => {
    renderTrophies();
    trophyPanel.hidden = false;
  });
  document.getElementById("trophy-close")!.addEventListener("click", () => (trophyPanel.hidden = true));
  trophyPanel.addEventListener("click", (e) => {
    if (e.target === trophyPanel) trophyPanel.hidden = true;
  });

  const CLIP_KEY = "make-your-own-maze:clipboard";
  const copyBtn = document.getElementById("copy") as HTMLButtonElement;
  let copyMode = false;
  let clip: Copied | null = null;
  try {
    clip = JSON.parse(localStorage.getItem(CLIP_KEY) ?? "null");
  } catch {
    clip = null;
  }

  let soundOn = true;
  try {
    soundOn = localStorage.getItem("make-your-own-maze:sound") !== "off";
  } catch {
    /* ignore */
  }

  const balls: Ball[] = [];
  let ballsToSpawn = maze.balls + countOwned(owned, "ball");
  let spawnTimer = 0;
  let cannonKick = 0;
  const popups: Popup[] = [];
  const flash = new Array(COLS * ROWS).fill(0);
  let lastBleep = 0;
  let dirty = false;

  // Dragging a block, the cannon, or the exit.
  let drag: { kind: "block" | "cannon" | "exit"; from: number; level: number; x: number; y: number; moved: boolean } | null =
    null;

  const level = (i: number) => maze.cells[i] ?? 0;
  /** What kind of block is in square i (its usual kind, or the one it got from combining). */
  const cellKind = (i: number) => {
    const k = maze.kinds[i] ?? -1;
    return k >= 0 ? k : kindOf(level(i));
  };
  const entranceCell = () => idx(0, maze.entranceRow);
  const exitCell = () => idx(maze.exit.c, maze.exit.r);
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
  const centerX = (c: number) => (c + 0.5) * CELL;
  const centerY = (r: number) => (r + 0.5) * CELL;

  function play(sound: () => void): void {
    if (soundOn) sound();
  }

  // --- Ball movement ------------------------------------------------------

  /** Called when a ball is in the middle of a square: can it go on into the next one? */
  function decide(b: Ball): void {
    const nc = b.c + DX[b.dir]!;
    const nr = b.r + DY[b.dir]!;
    b.blocked = false;
    b.hitCell = -1;
    if (!inside(nc, nr)) {
      b.blocked = true;
      return;
    }
    const i = idx(nc, nr);
    const lv = level(i);
    if (b.tier === GLITCH) return; // Glitch balls phase through every block.
    if (maze.stone[i]) {
      b.blocked = true; // Stone just bounces balls. It doesn't pay.
      return;
    }
    if (lv === 0 || (drag?.kind === "block" && drag.from === i)) return;
    const k = cellKind(i);
    if (isSolidKind(k) || (k === SLOPE && slopeTurn(maze.rot[i] ?? 0, b.dir) < 0)) {
      b.blocked = true;
      b.hitCell = i;
    }
  }

  /** What one hit on this block pays: its number, ×3 if gold, ×2 if it has a star, × any combine bonus. */
  function payAmount(cell: number): number {
    return basePay(level(cell), cellKind(cell), !!maze.stars[cell], maze.bonus[cell] ?? 0);
  }

  function basePay(lv: number, kind: number, star: boolean, bonus: number): number {
    let amount = lv;
    if (kind === GOLD) amount *= 3;
    if (star) amount *= 2;
    return Math.round(amount * (bonus > 0 ? bonus : 1));
  }

  /** Moves everything about a block (number, turn, star, bonus) from one square to another. */
  function moveBlock(from: number, to: number): void {
    maze.cells[to] = maze.cells[from] ?? 0;
    maze.rot[to] = maze.rot[from] ?? 0;
    maze.stars[to] = maze.stars[from] ?? 0;
    maze.bonus[to] = maze.bonus[from] ?? 0;
    maze.kinds[to] = maze.kinds[from] ?? -1;
    clearBlock(from);
  }

  function clearBlock(i: number): void {
    maze.cells[i] = 0;
    maze.rot[i] = 0;
    maze.stars[i] = 0;
    maze.bonus[i] = 0;
    maze.kinds[i] = -1;
  }

  function pay(cell: number, b: Ball, x: number, y: number, fromChain = false): void {
    const lv = level(cell);
    if (lv <= 0) return;
    const amount = payAmount(cell) * TIERS[b.tier]!.mult;
    if (amount <= 0) return;
    if (cellKind(cell) === CHAIN && !fromChain) {
      // Every block touching a chain block pays too.
      const c = cell % COLS;
      const r = Math.floor(cell / COLS);
      for (let d = 0; d < 4; d++) {
        const nc = c + DX[d]!;
        const nr = r + DY[d]!;
        if (inside(nc, nr) && level(idx(nc, nr)) > 0) pay(idx(nc, nr), b, centerX(nc), centerY(nr), true);
      }
    }
    maze.money += amount;
    b.earned += amount;
    flash[cell] = 1;
    popups.push({ x, y, text: "+" + money(amount), age: 0, big: false });
    dirty = true;
    const now = performance.now();
    if (now - lastBleep > 90) {
      lastBleep = now;
      play(() => bleep(Math.min(lv - 1, 20)));
    }
  }

  function launch(b: Ball): void {
    b.c = 0;
    b.r = maze.entranceRow;
    b.dir = 0;
    b.t = 0;
    b.earned = 0;
    b.boost = 0;
    b.tier = 0;
    cannonKick = 1;
    decide(b);
  }

  function spawnBall(): void {
    const b: Ball = { c: 0, r: 0, dir: 0, t: 0, blocked: false, hitCell: -1, earned: 0, boost: 0, tier: 0 };
    launch(b);
    balls.push(b);
  }

  /**
   * The ball just reached the middle of square (c, r). `back` is true when it
   * came back after bouncing, instead of arriving from the next square.
   */
  function arrive(b: Ball, back: boolean): boolean {
    const i = idx(b.c, b.r);
    const x = centerX(b.c);
    const y = centerY(b.r);
    if (!back && i === exitCell()) {
      const bonus = Math.max(5, b.earned);
      maze.money += bonus;
      dirty = true;
      popups.push({ x, y, text: "EXIT! +" + money(bonus), age: 0, big: true });
      play(chime);
      launch(b);
      return true;
    }
    if (!back && i === entranceCell()) {
      // A ball rolled back into the cannon: it shoots the ball out somewhere else.
      const rows: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        if (r !== maze.entranceRow && level(idx(0, r)) === 0 && !maze.stone[idx(0, r)] && idx(0, r) !== exitCell()) rows.push(r);
      }
      const row = rows[Math.floor(Math.random() * rows.length)];
      if (row !== undefined) {
        cannonKick = 1;
        b.r = row;
        b.dir = 0;
        b.t = 0;
        popups.push({ x, y, text: "BOOM!", age: 0, big: true });
        popups.push({ x: centerX(0) + 20, y: centerY(row), text: "WHOOSH!", age: 0, big: true });
        play(boing);
        return true;
      }
    }
    const lv = level(i);
    if (b.tier === GLITCH) return false; // Glitch balls don't touch anything.
    if (lv > 0 && !(drag?.kind === "block" && drag.from === i)) {
      const k = cellKind(i);
      if (k === SLOPE) {
        const turned = slopeTurn(maze.rot[i] ?? 0, b.dir);
        if (turned >= 0) b.dir = turned;
        if (!back) pay(i, b, x, y);
      } else if (!back && k === ARROW) {
        b.dir = maze.rot[i] ?? 0;
        pay(i, b, x, y);
      } else if (!back && k === GHOST) {
        pay(i, b, x, y);
      } else if (!back && k === BOOSTER) {
        b.boost = BOOST_TIME;
        pay(i, b, x, y);
      } else if (!back && k === TURNER) {
        b.dir = (b.dir + 1) % 4;
        pay(i, b, x, y);
      } else if (!back && k === DOUBLER) {
        pay(i, b, x, y);
        b.tier = Math.min(GLITCH, b.tier + 1);
        popups.push({ x, y: y - 14, text: TIERS[b.tier]!.name, age: 0, big: true });
        play(b.tier === GLITCH ? buzzer : powerUp);
        if (b.tier === GLITCH) unlock("glitched");
      }
    }
    return false;
  }

  function moveBall(b: Ball, dt: number): void {
    if (b.boost > 0) b.boost -= dt;
    let move = BALL_SPEED * dt * (b.boost > 0 ? 2 : 1);
    for (let guard = 0; move > 0 && guard < 20; guard++) {
      if (!b.blocked) {
        const need = 1 - b.t;
        if (move < need) {
          b.t += move;
          return;
        }
        move -= need;
        b.c += DX[b.dir]!;
        b.r += DY[b.dir]!;
        b.t = 0;
        arrive(b, false);
        decide(b);
      } else if (b.t >= 0) {
        // Heading out to the edge of a wall or block.
        const need = EDGE - b.t;
        if (move < need) {
          b.t += move;
          return;
        }
        move -= need;
        if (b.hitCell >= 0) pay(b.hitCell, b, centerX(b.c) + DX[b.dir]! * CELL * 0.5, centerY(b.r) + DY[b.dir]! * CELL * 0.5);
        b.dir = (b.dir + 2) % 4;
        b.t = -EDGE;
      } else {
        // Coming back to the middle after a bounce.
        const need = -b.t;
        if (move < need) {
          b.t += move;
          return;
        }
        move -= need;
        b.t = 0;
        arrive(b, true);
        decide(b);
      }
    }
  }

  /** After the maze changes, balls re-check their way, and any ball now inside a solid block goes back to the cannon. */
  function mazeChanged(): void {
    for (const b of balls) {
      const here = idx(b.c, b.r);
      const k = level(here) > 0 ? cellKind(here) : -1;
      if ((isSolidKind(k) || k === SLOPE) && b.tier !== GLITCH) {
        launch(b);
      } else if (b.t >= 0) {
        decide(b);
        if (b.blocked && b.t > EDGE) b.t = EDGE;
      }
    }
  }

  function ballPos(b: Ball): { x: number; y: number } {
    return { x: centerX(b.c) + DX[b.dir]! * b.t * CELL, y: centerY(b.r) + DY[b.dir]! * b.t * CELL };
  }

  // --- Shop -------------------------------------------------------------

  function emptyCells(): number[] {
    const out: number[] = [];
    const ent = entranceCell();
    const ex = exitCell();
    maze.cells.forEach((v, i) => {
      if (v === 0 && !maze.stone[i] && i !== ent && i !== ex) out.push(i);
    });
    return out;
  }

  function updateShop(): void {
    moneyEl.textContent = money(maze.money);
    const bc = blockCost(maze.blocksBought);
    const full = emptyCells().length === 0;
    const stoneLeft = maze.stone.some((v) => v);
    stoneHint.hidden = !stoneLeft;
    buyBlockBtn.innerHTML = full
      ? stoneLeft
        ? "No room yet<small>break some stone</small>"
        : "Maze is full<small>merge some blocks</small>"
      : `Buy block ${buyingLevel()}<small>${money(bc)}</small>`;
    buyBlockBtn.disabled = full || maze.money < bc;
    lvlDown.disabled = buyingLevel() <= 1;
    lvlUp.disabled = buyingLevel() >= startLevel(owned);
    const canBuy = UPGRADES.some((u) => !owned.has(u.id) && (!u.needs || owned.has(u.needs)) && maze.money >= u.cost);
    upgradesBtn.classList.toggle("ready", canBuy);
    if (!treeEl.hidden) {
      treeMoney.textContent = money(maze.money);
      treeBody.querySelectorAll<HTMLButtonElement>(".skill.open, .skill.ready").forEach((btn) => {
        const u = byId(btn.dataset["up"]!);
        btn.classList.toggle("ready", maze.money >= u.cost);
        btn.classList.toggle("open", maze.money < u.cost);
      });
      const buy = document.getElementById("buy-skill") as HTMLButtonElement | null;
      if (buy) buy.disabled = maze.money < byId(picked).cost;
    }
    trophyBtn.innerHTML = `🏆 Trophies<small>${trophies.size} of ${ACHIEVEMENTS.length}</small>`;
    copyBtn.classList.toggle("combine-on", copyMode);
    copyBtn.innerHTML = !copyMode
      ? "📋 Copy & Paste<small>click to start</small>"
      : clip
        ? `📋 Pasting: ${money(basePay(clip.level, clip.kind, !!clip.star, clip.bonus))} block<small>click a block to copy · click to stop</small>`
        : "📋 Copy mode<small>click a block to copy it</small>";
    modeBtn.hidden = !owned.has("combine");
    modeBtn.classList.toggle("combine-on", combineMode);
    modeBtn.innerHTML = combineMode
      ? "🧬 Combine mode<small>click to swap instead</small>"
      : "🔁 Swap mode<small>click to combine instead</small>";
    soundBtn.innerHTML = soundOn ? "Sound on<small>click to mute</small>" : "Sound off<small>click to unmute</small>";
  }

  lvlDown.addEventListener("click", () => {
    buyLevel = Math.max(1, buyingLevel() - 1);
    updateShop();
  });
  lvlUp.addEventListener("click", () => {
    buyLevel = Math.min(startLevel(owned), buyingLevel() + 1);
    updateShop();
  });

  buyBlockBtn.addEventListener("click", () => {
    const cost = blockCost(maze.blocksBought);
    const spots = emptyCells();
    if (maze.money < cost || spots.length === 0) return;
    maze.money -= cost;
    maze.blocksBought++;
    const cell = spots[Math.floor(Math.random() * spots.length)]!;
    maze.cells[cell] = buyingLevel();
    maze.rot[cell] = 0;
    const luck = countOwned(owned, "luck") * 0.1;
    maze.stars[cell] = Math.random() < luck ? 1 : 0;
    maze.bonus[cell] = 0;
    maze.kinds[cell] = -1;
    if (maze.stars[cell]) {
      popups.push({ x: centerX(cell % COLS), y: centerY(Math.floor(cell / COLS)), text: "★ STAR!", age: 0, big: true });
    }
    flash[cell] = 1;
    mazeChanged();
    play(thunk);
    saveMaze(maze);
    updateShop();
  });

  // --- The upgrade tree -------------------------------------------------

  const byId = (id: string) => UPGRADES.find((u) => u.id === id)!;
  /** You can see an upgrade once the one before it is bought (and the tree is unlocked). */
  const visible = (u: Upgrade) =>
    !u.needs || owned.has(u.needs) || (owned.has("tree") && u.id !== "tree");
  const buyable = (u: Upgrade) => !owned.has(u.id) && (!u.needs || owned.has(u.needs));

  function renderTree(): void {
    const shown = UPGRADES.filter(visible);
    // Fit the honeycomb: work out how big the whole thing is in hexagons.
    const spots = UPGRADES.map(hexSpot);
    const h = Math.sqrt(3) / 2;
    const minX = Math.min(...spots.map((p) => p.x)) - 0.5;
    const maxX = Math.max(...spots.map((p) => p.x)) + 0.5;
    const minY = Math.min(...spots.map((p) => p.y)) - h / 2;
    const maxY = Math.max(...spots.map((p) => p.y)) + h / 2;
    const wide = maxX - minX;
    const tall = maxY - minY;
    const nodes = shown
      .map((u) => {
        const p = hexSpot(u);
        const have = owned.has(u.id);
        const can = buyable(u);
        const state = have ? "owned" : can ? (maze.money >= u.cost ? "ready" : "open") : "locked";
        const label = state === "locked" ? "???" : u.short;
        const bottom = have ? "✓" : state === "locked" ? "" : money(u.cost);
        return `
        <button class="hex ${u.branch} ${state}${picked === u.id ? " picked" : ""}" data-up="${u.id}"
          style="left:${((p.x - 0.5 - minX) / wide) * 100}%;top:${((p.y - h / 2 - minY) / tall) * 100}%;width:${(1 / wide) * 100}%"
          aria-label="${u.name}">
          <span class="hex-inner">
            <span class="hex-icon">${state === "locked" ? "🔒" : u.icon}</span>
            <span class="hex-name">${label}</span>
            <span class="hex-cost">${bottom}</span>
          </span>
        </button>`;
      })
      .join("");
    treeBody.innerHTML = `<div class="honeycomb" style="aspect-ratio:${wide} / ${tall}">${nodes}</div>`;
    renderInfo();
  }

  function renderInfo(): void {
    const u = byId(picked);
    const have = owned.has(u.id);
    const can = buyable(u);
    treeMoney.textContent = money(maze.money);
    if (!have && !can) {
      skillInfo.innerHTML = `<strong>???</strong><p>Buy the upgrade before this one first.</p>`;
      return;
    }
    skillInfo.innerHTML = `
      <strong>${u.icon} ${u.name}</strong>
      <p>${u.info}</p>
      ${
        have
          ? `<span class="got">✓ You have this</span>`
          : `<button class="btn primary" id="buy-skill" ${maze.money < u.cost ? "disabled" : ""}>Buy for ${money(u.cost)}</button>`
      }`;
  }

  treeBody.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-up]");
    if (!btn) return;
    picked = btn.dataset["up"]!;
    renderTree();
  });

  skillInfo.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest("#buy-skill")) return;
    const u = byId(picked);
    if (!buyable(u) || maze.money < u.cost) return;
    maze.money -= u.cost;
    owned.add(u.id);
    saveUpgrades(owned);
    unlock("maker");
    if (u.id.startsWith("ball")) ballsToSpawn++;
    play(powerUp);
    saveMaze(maze);
    // Jump to the next thing you can buy.
    const next = UPGRADES.find((x) => x.needs === u.id) ?? UPGRADES.find((x) => buyable(x));
    if (next) picked = next.id;
    renderTree();
    updateShop();
  });

  upgradesBtn.addEventListener("click", () => {
    treeEl.hidden = false;
    if (owned.has(picked)) picked = UPGRADES.find((x) => buyable(x))?.id ?? picked;
    renderTree();
  });
  document.getElementById("tree-close")!.addEventListener("click", () => (treeEl.hidden = true));
  treeEl.addEventListener("click", (e) => {
    if (e.target === treeEl) treeEl.hidden = true;
  });

  copyBtn.addEventListener("click", () => {
    copyMode = !copyMode;
    updateShop();
  });

  modeBtn.addEventListener("click", () => {
    combineMode = !combineMode;
    updateShop();
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    try {
      localStorage.setItem("make-your-own-maze:sound", soundOn ? "on" : "off");
    } catch {
      /* ignore */
    }
    updateShop();
  });

  document.getElementById("to-menu")!.addEventListener("click", () => {
    saveMaze(maze);
    showMenu();
  });

  document.getElementById("maze-name")!.addEventListener("click", () => {
    const name = prompt("Rename your maze:", maze.name)?.trim();
    if (!name) return;
    maze.name = name.slice(0, 40);
    document.getElementById("maze-name")!.textContent = maze.name;
    saveMaze(maze);
  });

  // --- Dragging and clicking ---------------------------------------------

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }

  function cellAt(x: number, y: number): number {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (!inside(c, r)) return -1;
    return idx(c, r);
  }

  /** Can the thing being dragged be dropped on square `to`? */
  function canDrop(d: NonNullable<typeof drag>, to: number): boolean {
    if (to < 0 || to === d.from) return false;
    if (maze.stone[to]) return false;
    if (d.kind === "cannon") return to % COLS === 0 && level(to) === 0 && to !== exitCell();
    if (d.kind === "exit") return level(to) === 0 && to !== entranceCell();
    return to !== entranceCell() && to !== exitCell();
  }

  // Breaking stone: press on stone and drag across it to smash a path.
  let mining = false;
  let lastCrack = 0;

  function breakStone(cell: number): void {
    if (cell < 0 || !maze.stone[cell]) return;
    maze.stone[cell] = 0;
    flash[cell] = 1;
    const now = performance.now();
    if (now - lastCrack > 70) {
      lastCrack = now;
      play(crack);
    }
    if (!maze.stone.some((v) => v)) {
      popups.push({ x: W / 2, y: H / 2, text: "THE MAZE IS CLEAR!", age: 0, big: true });
      play(chime);
      saveMaze(maze);
    }
    dirty = true;
    updateShop();
  }

  canvas.addEventListener("pointerdown", (e) => {
    const p = pointerPos(e);
    const cell = cellAt(p.x, p.y);
    if (cell < 0) return;
    if (maze.stone[cell]) {
      mining = true;
      breakStone(cell);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (copyMode) {
      copyOrPaste(cell);
      return;
    }
    if (cell === entranceCell()) drag = { kind: "cannon", from: cell, level: 0, ...p, moved: false };
    else if (cell === exitCell()) drag = { kind: "exit", from: cell, level: 0, ...p, moved: false };
    else if (level(cell) > 0) drag = { kind: "block", from: cell, level: level(cell), ...p, moved: false };
    else return;
    canvas.setPointerCapture(e.pointerId);
  });

  function copyOrPaste(cell: number): void {
    const x = centerX(cell % COLS);
    const y = centerY(Math.floor(cell / COLS));
    if (level(cell) > 0) {
      clip = {
        level: level(cell),
        kind: cellKind(cell),
        star: maze.stars[cell] ?? 0,
        bonus: maze.bonus[cell] ?? 0,
        rot: maze.rot[cell] ?? 0,
      };
      try {
        localStorage.setItem(CLIP_KEY, JSON.stringify(clip));
      } catch {
        /* ignore */
      }
      flash[cell] = 1;
      popups.push({ x, y, text: "COPIED!", age: 0, big: true });
      play(() => bleep(10));
    } else if (clip && !maze.stone[cell] && cell !== entranceCell() && cell !== exitCell()) {
      maze.cells[cell] = clip.level;
      maze.kinds[cell] = clip.kind === kindOf(clip.level) ? -1 : clip.kind;
      maze.stars[cell] = clip.star;
      maze.bonus[cell] = clip.bonus;
      maze.rot[cell] = clip.rot;
      flash[cell] = 1;
      popups.push({ x, y, text: "PASTED!", age: 0, big: true });
      unlock("copycat");
      play(thunk);
      mazeChanged();
      saveMaze(maze);
    }
    updateShop();
  }

  // --- Selling ----------------------------------------------------------

  /**
   * What a block sells for: one and a half times its number. Gold blocks sell
   * for twice that, and ★ star blocks for twice again (a gold star 7 is $42).
   */
  function sellPrice(cell: number): number {
    const lv = level(cell);
    let price = lv * 1.5;
    if (cellKind(cell) === GOLD) price *= 2;
    if (maze.stars[cell]) price *= 2;
    return Math.round(price * Math.max(1, maze.bonus[cell] ?? 0));
  }

  function overBin(e: PointerEvent): boolean {
    const r = sellBin.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function resetBin(): void {
    sellBin.classList.remove("hot", "showing");
    sellBin.textContent = BIN_TEXT;
  }

  canvas.addEventListener("pointermove", (e) => {
    if (mining) {
      const p = pointerPos(e);
      breakStone(cellAt(p.x, p.y));
      return;
    }
    if (!drag) return;
    const p = pointerPos(e);
    drag.x = p.x;
    drag.y = p.y;
    if (cellAt(p.x, p.y) !== drag.from) drag.moved = true;
    if (drag.kind === "block" && drag.moved) {
      const hot = overBin(e);
      sellBin.classList.add("showing");
      sellBin.classList.toggle("hot", hot);
      sellBin.textContent = `🗑️ ${hot ? "Let go to sell" : "Sell"} for ${money(sellPrice(drag.from))}`;
    }
  });

  function endDrag(e: PointerEvent, cancelled: boolean): void {
    if (mining) {
      mining = false;
      saveMaze(maze);
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    resetBin();
    if (!cancelled && d.kind === "block" && overBin(e)) {
      const price = sellPrice(d.from);
      maze.money += price;
      clearBlock(d.from);
      popups.push({ x: centerX(d.from % COLS), y: centerY(Math.floor(d.from / COLS)), text: "SOLD! +" + money(price), age: 0, big: true });
      play(chime);
      mazeChanged();
      saveMaze(maze);
      updateShop();
      return;
    }
    if (cancelled) {
      mazeChanged();
      return;
    }
    const p = pointerPos(e);
    const to = cellAt(p.x, p.y);

    // A click (no drag) on a slope or arrow turns it.
    if (to === d.from && !d.moved) {
      if (d.kind === "block" && turns(cellKind(d.from))) {
        maze.rot[d.from] = ((maze.rot[d.from] ?? 0) + 1) % 4;
        play(() => bleep(8));
        mazeChanged();
        saveMaze(maze);
      }
      mazeChanged();
      return;
    }
    if (!canDrop(d, to)) {
      mazeChanged();
      return;
    }

    if (d.kind === "cannon") {
      maze.entranceRow = Math.floor(to / COLS);
    } else if (d.kind === "exit") {
      maze.exit = { c: to % COLS, r: Math.floor(to / COLS) };
    } else if (level(to) === 0) {
      moveBlock(d.from, to);
    } else if (level(to) === d.level) {
      // Merge! Two block Ns make one block N+1. Stars and combine bonuses are kept.
      const star = maze.stars[to] || maze.stars[d.from] ? 1 : 0;
      const bonus = Math.max(maze.bonus[to] ?? 0, maze.bonus[d.from] ?? 0);
      const kind = (maze.kinds[to] ?? -1) >= 0 ? maze.kinds[to]! : (maze.kinds[d.from] ?? -1);
      clearBlock(d.from);
      clearBlock(to);
      maze.cells[to] = d.level + 1;
      maze.stars[to] = star;
      maze.bonus[to] = bonus;
      maze.kinds[to] = kind;
      flash[to] = 1;
      popups.push({
        x: centerX(to % COLS),
        y: centerY(Math.floor(to / COLS)),
        text: KIND_NAMES[cellKind(to)] + " " + (d.level + 1) + "!",
        age: 0,
        big: true,
      });
      play(chime);
    } else if (combineMode && owned.has("combine")) {
      // Combine! The held block keeps its kind, and now pays what it paid
      // times what the other block paid.
      // The new block has the bigger number of the two, and the kind of the
      // block you were holding (a 7 combined with a held 3 is a Ghost 7).
      const total = payAmount(d.from) * payAmount(to);
      const kind = cellKind(d.from);
      const lv = Math.max(level(d.from), level(to));
      const star = maze.stars[d.from] ?? 0;
      const rot = maze.rot[d.from] ?? 0;
      clearBlock(d.from);
      clearBlock(to);
      maze.cells[to] = lv;
      maze.kinds[to] = kind === kindOf(lv) ? -1 : kind;
      maze.stars[to] = star;
      maze.rot[to] = rot;
      // Its bonus makes it pay exactly the two pays multiplied together.
      maze.bonus[to] = total / basePay(lv, kind, !!star, 0);
      flash[to] = 1;
      popups.push({ x: centerX(to % COLS), y: centerY(Math.floor(to / COLS)), text: "COMBO! " + money(payAmount(to)) + " a hit", age: 0, big: true });
      play(powerUp);
    } else {
      // Different numbers: swap them.
      const spare = idx(0, maze.entranceRow); // the cannon's square is always empty
      moveBlock(to, spare);
      moveBlock(d.from, to);
      moveBlock(spare, d.from);
    }
    mazeChanged();
    saveMaze(maze);
    updateShop();
  }

  canvas.addEventListener("pointerup", (e) => endDrag(e, false));
  canvas.addEventListener("pointercancel", (e) => endDrag(e, true));

  // --- Drawing ----------------------------------------------------------

  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function numberText(lv: number, x: number, y: number, color = "#14112a"): void {
    ctx.fillStyle = color;
    ctx.font = `${lv >= 10 ? 12 : 14}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(lv), x, y);
  }

  function drawBlock(x: number, y: number, lv: number, kind: number, rot: number, glow: number, alpha = 1, star = false, bonus = 0): void {
    drawBlockBody(x, y, lv, kind, rot, glow, alpha);
    if (bonus > 0 && bonus !== 1) {
      // Combined blocks show what they pay along the bottom.
      const text = money(basePay(lv, kind, star, bonus));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#14112a";
      const w = ctx.measureText(text).width + 6;
      roundRect(x + CELL / 2 - w / 2, y + CELL - 13, w, 11, 4);
      ctx.fill();
      ctx.fillStyle = "#ff6ad5";
      ctx.fillText(text, x + CELL / 2, y + CELL - 7);
      ctx.restore();
    }
    if (star) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffd21f";
      ctx.strokeStyle = "#14112a";
      ctx.lineWidth = 3;
      ctx.font = "16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("★", x + CELL - 10, y + 10);
      ctx.fillText("★", x + CELL - 10, y + 10);
      ctx.restore();
    }
  }

  function drawBlockBody(x: number, y: number, lv: number, k: number, rot: number, glow: number, alpha: number): void {
    const pad = 3;
    const s = CELL - pad * 2;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (k === SLOPE) {
      // A ramp filling half the square. The solid corner turns with `rot`.
      const L = x + pad;
      const R = x + pad + s;
      const T = y + pad;
      const B = y + pad + s;
      const pts = [
        [[R, T], [R, B], [L, B]],
        [[L, T], [L, B], [R, B]],
        [[R, T], [L, T], [L, B]],
        [[L, T], [R, T], [R, B]],
      ][rot % 4]!;
      ctx.beginPath();
      ctx.moveTo(pts[0]![0]!, pts[0]![1]!);
      ctx.lineTo(pts[1]![0]!, pts[1]![1]!);
      ctx.lineTo(pts[2]![0]!, pts[2]![1]!);
      ctx.closePath();
      ctx.fillStyle = blockColor(lv);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = blockDark(lv);
      ctx.stroke();
      if (glow > 0) {
        ctx.fillStyle = `rgba(255,255,255,${glow * 0.6})`;
        ctx.fill();
      }
      // Put the number in the solid half.
      const cx = (pts[0]![0]! + pts[1]![0]! + pts[2]![0]!) / 3;
      const cy = (pts[0]![1]! + pts[1]![1]! + pts[2]![1]!) / 3;
      numberText(lv, cx, cy);
    } else if (k === GHOST) {
      ctx.fillStyle = blockColor(lv);
      ctx.globalAlpha = alpha * 0.35;
      roundRect(x + pad, y + pad, s, s, 8);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = blockColor(lv);
      ctx.stroke();
      ctx.setLineDash([]);
      if (glow > 0) {
        ctx.fillStyle = `rgba(255,255,255,${glow * 0.5})`;
        ctx.fill();
      }
      numberText(lv, x + CELL / 2, y + CELL / 2, blockColor(lv));
    } else {
      ctx.fillStyle = blockDark(lv);
      roundRect(x + pad, y + pad, s, s, 8);
      ctx.fill();
      ctx.fillStyle = blockColor(lv);
      roundRect(x + pad, y + pad, s, s - 5, 8);
      ctx.fill();
      if (glow > 0) {
        ctx.fillStyle = `rgba(255,255,255,${glow * 0.6})`;
        roundRect(x + pad, y + pad, s, s, 8);
        ctx.fill();
      }
      if (k === GOLD) {
        ctx.fillStyle = "#ffd21f";
        roundRect(x + pad, y + pad, s, s - 5, 8);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(x + pad + 6, y + pad + 4, 4, s - 16);
        numberText(lv, x + CELL / 2, y + CELL / 2 - 1, "#7a4a00");
      } else if (k === BOOSTER || k === TURNER || k === CHAIN || k === DOUBLER || k === MYSTERY) {
        // A little picture behind the number.
        ctx.fillStyle = "rgba(20,17,42,0.45)";
        ctx.font = "26px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const icon = k === BOOSTER ? "»" : k === TURNER ? "↻" : k === CHAIN ? "⛓" : k === DOUBLER ? "⇈" : "?";
        ctx.fillText(icon, x + CELL / 2, y + CELL / 2 - 2);
        if (k === CHAIN) {
          // Dots on each side show it reaches the blocks next to it.
          ctx.fillStyle = "#14112a";
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            ctx.beginPath();
            ctx.arc(x + CELL / 2 + dx! * (s / 2 - 3), y + CELL / 2 - 2 + dy! * (s / 2 - 5), 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        numberText(lv, x + CELL / 2, y + CELL / 2 - 1);
      } else if (k === ARROW) {
        // An arrow pointing the way it sends balls, with the number on it.
        ctx.translate(x + CELL / 2, y + CELL / 2 - 2);
        ctx.rotate((rot % 4) * (Math.PI / 2));
        ctx.fillStyle = "rgba(20,17,42,0.35)";
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(8, -11);
        ctx.lineTo(8, 11);
        ctx.closePath();
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        numberText(lv, x + CELL / 2 - 3, y + CELL / 2 - 1);
      } else {
        numberText(lv, x + CELL / 2, y + CELL / 2 - 1);
      }
    }
    ctx.restore();
  }

  /** Old cracked stone from the destroyed maze. */
  function drawStone(x: number, y: number, seed: number): void {
    ctx.fillStyle = "#4a4552";
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = "#5d5868";
    ctx.fillRect(x + 1, y + 1, CELL - 2, 6);
    ctx.fillStyle = "#38343f";
    ctx.fillRect(x + 1, y + CELL - 7, CELL - 2, 6);
    // Cracks, different on each stone.
    ctx.strokeStyle = "#2a2730";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const a = ((seed * 37) % 30) + 8;
    const b = ((seed * 53) % 30) + 8;
    ctx.moveTo(x + a, y + 8);
    ctx.lineTo(x + CELL / 2, y + CELL / 2);
    ctx.lineTo(x + b, y + CELL - 8);
    ctx.moveTo(x + CELL / 2, y + CELL / 2);
    ctx.lineTo(x + CELL - 8, y + (a % 20) + 14);
    ctx.stroke();
  }

  /** The cannon on the left side that fires balls to the right. */
  function drawCannon(x: number, y: number, alpha = 1): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    const cy = y + CELL / 2;
    const kick = cannonKick * 5;
    // Wheel/base
    ctx.fillStyle = "#5b5470";
    ctx.beginPath();
    ctx.arc(x + 13, cy + 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3a3450";
    ctx.beginPath();
    ctx.arc(x + 13, cy + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    // Barrel
    ctx.fillStyle = "#c9c3df";
    roundRect(x + 4 - kick, cy - 10, 36, 18, 6);
    ctx.fill();
    ctx.fillStyle = "#8d86a8";
    ctx.fillRect(x + 34 - kick, cy - 12, 8, 22);
    // Muzzle flash
    if (cannonKick > 0.4) {
      ctx.fillStyle = `rgba(255,210,31,${cannonKick})`;
      ctx.beginPath();
      ctx.arc(x + 46, cy - 1, 6 * cannonKick, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The exit: a dark hole with a checkered rim. */
  function drawExit(x: number, y: number, alpha = 1): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = x + CELL / 2;
    const cy = y + CELL / 2 + 3;
    const n = 12;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#14112a";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 17, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b6f03c";
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXIT", cx, y + 5);
    ctx.restore();
  }

  function drawBall(b: Ball): void {
    const p = ballPos(b);
    const tier = TIERS[b.tier]!;
    ctx.save();
    if (b.tier === GLITCH) {
      // Glitch: jumpy, see-through, with colored copies sliding off it.
      const jx = (Math.random() - 0.5) * 4;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#00ff66";
      ctx.fillRect(p.x - BALL_R + jx - 3, p.y - BALL_R, BALL_R * 2, BALL_R * 2);
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(p.x - BALL_R + jx + 3, p.y - BALL_R, BALL_R * 2, BALL_R * 2);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x - BALL_R + jx, p.y - 2 + (Math.random() - 0.5) * 6, BALL_R * 2, 3);
      ctx.restore();
      return;
    }
    if (b.tier > 0) {
      // A glow around upgraded balls.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = tier.color === "#2a0d3d" ? "#b04dff" : tier.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, BALL_R + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    if (b.tier === 3) {
      // The Nether Eye: a glowing purple eye with a slit pupil.
      ctx.fillStyle = tier.shine;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, BALL_R * 0.75, BALL_R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.fillRect(p.x - 1, p.y - BALL_R * 0.45, 2, BALL_R * 0.9);
    } else if (b.tier === 2) {
      // Diamond: a sparkly cut shape on top.
      ctx.fillStyle = tier.shine;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - BALL_R * 0.7);
      ctx.lineTo(p.x + BALL_R * 0.5, p.y);
      ctx.lineTo(p.x, p.y + BALL_R * 0.7);
      ctx.lineTo(p.x - BALL_R * 0.5, p.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = tier.shine;
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, BALL_R * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  let time = 0;

  function draw(): void {
    ctx.fillStyle = "#1b1735";
    ctx.fillRect(0, 0, W, H);
    // Grid dots
    ctx.fillStyle = "#2f2959";
    for (let r = 1; r < ROWS; r++) for (let c = 1; c < COLS; c++) ctx.fillRect(c * CELL - 1, r * CELL - 1, 2, 2);
    // The cannon's side
    ctx.fillStyle = "#4a4370";
    ctx.fillRect(0, 0, 3, H);

    // Drop target highlight
    if (drag && drag.moved) {
      const to = cellAt(drag.x, drag.y);
      if (to >= 0 && to !== drag.from) {
        const ok = canDrop(drag, to);
        const merge = drag.kind === "block" && level(to) === drag.level;
        ctx.strokeStyle = !ok ? "#ff5a4e" : merge ? "#b6f03c" : "#ffffff";
        ctx.lineWidth = 3;
        roundRect((to % COLS) * CELL + 2, Math.floor(to / COLS) * CELL + 2, CELL - 4, CELL - 4, 9);
        ctx.stroke();
      }
    }

    drawExit(maze.exit.c * CELL, maze.exit.r * CELL, drag?.kind === "exit" && drag.moved ? 0.3 : 1);

    for (let i = 0; i < maze.stone.length; i++) {
      if (maze.stone[i]) drawStone((i % COLS) * CELL, Math.floor(i / COLS) * CELL, i);
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = idx(c, r);
        const lv = level(i);
        if (lv > 0) {
          const faded = drag?.kind === "block" && drag.from === i && drag.moved;
          drawBlock(c * CELL, r * CELL, lv, cellKind(i), maze.rot[i] ?? 0, flash[i], faded ? 0.3 : 1, !!maze.stars[i], maze.bonus[i] ?? 0);
        }
      }
    }

    for (const b of balls) drawBall(b);

    // The cannon goes on top so balls come out of its barrel.
    drawCannon(0, maze.entranceRow * CELL, drag?.kind === "cannon" && drag.moved ? 0.3 : 1);

    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / (p.big ? 1.4 : 0.8));
      ctx.fillStyle = p.big ? "#b6f03c" : "#ffd21f";
      ctx.font = `${p.big ? 12 : 10}px "Press Start 2P", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.text, Math.min(W - 60, Math.max(60, p.x)), p.y - p.age * 40);
    }
    ctx.globalAlpha = 1;

    if (drag && drag.moved) {
      if (drag.kind === "block") drawBlock(drag.x - CELL / 2, drag.y - CELL / 2, drag.level, cellKind(drag.from), maze.rot[drag.from] ?? 0, 0, 0.9, !!maze.stars[drag.from], maze.bonus[drag.from] ?? 0);
      else if (drag.kind === "cannon") drawCannon(0, Math.max(0, Math.min(H - CELL, drag.y - CELL / 2)), 0.9);
      else drawExit(drag.x - CELL / 2, drag.y - CELL / 2, 0.9);
    }
  }

  // --- Loop -------------------------------------------------------------

  let running = true;
  let last = performance.now();
  let saveTimer = 0;
  let shopTimer = 0;

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;

    if (ballsToSpawn > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnBall();
        ballsToSpawn--;
        spawnTimer = 0.5;
        play(boing);
      }
    }

    for (const b of balls) moveBall(b, dt);
    cannonKick = Math.max(0, cannonKick - dt * 4);
    for (let i = 0; i < flash.length; i++) if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - dt * 4);
    for (const p of popups) p.age += dt;
    while (popups.length && popups[0]!.age > 1.4) popups.shift();
    if (popups.length > 80) popups.splice(0, popups.length - 80);

    shopTimer += dt;
    if (shopTimer > 0.1) {
      shopTimer = 0;
      checkTrophies();
      updateShop();
    }
    saveTimer += dt;
    if (dirty && saveTimer > 2) {
      saveTimer = 0;
      dirty = false;
      saveMaze(maze);
    }

    draw();
    requestAnimationFrame(frame);
  }

  const onHide = () => saveMaze(maze);
  window.addEventListener("pagehide", onHide);

  stopGame = () => {
    running = false;
    window.removeEventListener("pagehide", onHide);
    saveMaze(maze);
  };

  // --- The opening story (Oscar's) ---------------------------------------

  const STORY: { text: string; rumble?: boolean }[] = [
    { text: "Legend tells of a maze that was destroyed millions of years ago..." },
    { text: "It was created by... not you... not me... but—" },
    { text: "Oh hey, what's that?" },
    { text: "*RUMBLE RUMBLE RUMBLE*", rumble: true },
    { text: "Fine. You can build here. But why? This is an old maze." },
    { text: "...But fine." },
    { text: "Clear out all the stone so you can build. Click and drag over it to break it." },
  ];

  if (!maze.storySeen) {
    const story = document.getElementById("story")!;
    const storyText = document.getElementById("story-text")!;
    const next = document.getElementById("story-next") as HTMLButtonElement;
    let line = 0;
    const shell = document.querySelector(".shell");
    const show = () => {
      const s = STORY[line]!;
      storyText.textContent = s.text;
      storyText.classList.toggle("rumble-text", !!s.rumble);
      next.textContent = line === STORY.length - 1 ? "Start building ⛏️" : "Next ▶";
      if (s.rumble) {
        play(thunder);
        shell?.classList.remove("shake");
        void (shell as HTMLElement | null)?.offsetWidth;
        shell?.classList.add("shake");
      }
    };
    story.hidden = false;
    show();
    next.addEventListener("click", () => {
      line++;
      if (line >= STORY.length) {
        story.hidden = true;
        maze.storySeen = true;
        saveMaze(maze);
        return;
      }
      show();
    });
  }

  updateShop();
  requestAnimationFrame(frame);
}

showMenu();
