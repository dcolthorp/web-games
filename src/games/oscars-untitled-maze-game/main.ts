import levelTwoAudioSrc from "./assets/level-2-illusions-description.m4a";
import levelThreeAudioSrc from "./assets/level-3-illusions-2-description.m4a";
import levelFourAudioSrc from "./assets/level-4-underdoos-description.m4a";

const TILE_SIZE = 24;
const WALL = "#";
const OPEN = ".";
const START = "S";
const EXIT = "E";
const SPIN = "O";
const RESET = "R";
const REVERSE = "V";
const UNDERPASS = "U";

type Tile =
  | typeof WALL
  | typeof OPEN
  | typeof START
  | typeof EXIT
  | typeof SPIN
  | typeof RESET
  | typeof REVERSE
  | typeof UNDERPASS;
type Direction = "up" | "down" | "left" | "right";
type Axis = "horizontal" | "vertical";

interface Point {
  x: number;
  y: number;
}

interface Crossing {
  point: Point;
  underAxis: Axis;
}

interface Level {
  id: number;
  name: string;
  rotationOnSpin: boolean;
  cols: number;
  rows: number;
  grid: string[];
  start: Point;
  exit: Point;
  crossings?: Crossing[];
}

interface GameState {
  levelIndex: number;
  level: Level | null;
  grid: Tile[][];
  player: Point;
  rotationQuarter: number;
  controlsReversed: boolean;
  playerCrossingAxis: Axis | null;
  playerHiddenUnderBridge: boolean;
  won: boolean;
  levelIntroPlayed: Partial<Record<number, boolean>>;
  levelIntroFinished: Partial<Record<number, boolean>>;
}

const canvasElement = document.getElementById("maze");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Missing maze canvas");
}
const canvas: HTMLCanvasElement = canvasElement;

const ctxValue = canvas.getContext("2d");
if (!(ctxValue instanceof CanvasRenderingContext2D)) {
  throw new Error("Could not create maze drawing context");
}
const ctx: CanvasRenderingContext2D = ctxValue;

const sceneCanvas = document.createElement("canvas");
const sceneCtxValue = sceneCanvas.getContext("2d");
if (!(sceneCtxValue instanceof CanvasRenderingContext2D)) {
  throw new Error("Could not create scene drawing context");
}
const sceneCtx: CanvasRenderingContext2D = sceneCtxValue;

const levelNameElement = document.getElementById("level-name");
if (!(levelNameElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing level name element");
}
const levelNameEl: HTMLParagraphElement = levelNameElement;

const statusElement = document.getElementById("status");
if (!(statusElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing status element");
}
const statusEl: HTMLParagraphElement = statusElement;

const subtitleElement = document.querySelector(".subtitle");
if (!(subtitleElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing subtitle element");
}
const subtitleEl: HTMLParagraphElement = subtitleElement;

const resetButton = document.getElementById("reset-btn");
if (!(resetButton instanceof HTMLButtonElement)) {
  throw new Error("Missing reset button");
}
const resetBtn: HTMLButtonElement = resetButton;

const playDescriptionButton = document.getElementById("play-description-btn");
if (!(playDescriptionButton instanceof HTMLButtonElement)) {
  throw new Error("Missing play description button");
}
const playDescriptionBtn: HTMLButtonElement = playDescriptionButton;

const levelSelectorButton = document.getElementById("level-selector-btn");
if (!(levelSelectorButton instanceof HTMLButtonElement)) {
  throw new Error("Missing level selector button");
}
const levelSelectorBtn: HTMLButtonElement = levelSelectorButton;

const levelSelectorOverlayElement = document.getElementById("level-selector-overlay");
if (!(levelSelectorOverlayElement instanceof HTMLDivElement)) {
  throw new Error("Missing level selector overlay");
}
const levelSelectorOverlay: HTMLDivElement = levelSelectorOverlayElement;

const closeLevelSelectorButton = document.getElementById("close-level-selector-btn");
if (!(closeLevelSelectorButton instanceof HTMLButtonElement)) {
  throw new Error("Missing level selector close button");
}
const closeLevelSelectorBtn: HTMLButtonElement = closeLevelSelectorButton;

const levelSelectorListElement = document.getElementById("level-selector-list");
if (!(levelSelectorListElement instanceof HTMLDivElement)) {
  throw new Error("Missing level selector list");
}
const levelSelectorList: HTMLDivElement = levelSelectorListElement;

const completionOverlayElement = document.getElementById("completion-overlay");
if (!(completionOverlayElement instanceof HTMLDivElement)) {
  throw new Error("Missing completion overlay");
}
const completionOverlay: HTMLDivElement = completionOverlayElement;

const tryAgainButton = document.getElementById("try-again-btn");
if (!(tryAgainButton instanceof HTMLButtonElement)) {
  throw new Error("Missing try again button");
}
const tryAgainBtn: HTMLButtonElement = tryAgainButton;

const nextLevelButton = document.getElementById("next-level-btn");
if (!(nextLevelButton instanceof HTMLButtonElement)) {
  throw new Error("Missing next level button");
}
const nextLevelBtn: HTMLButtonElement = nextLevelButton;

const controlButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".control-btn")
);

const rootStyles = getComputedStyle(document.documentElement);
const palette = {
  wall: rootStyles.getPropertyValue("--wall").trim(),
  path: rootStyles.getPropertyValue("--path").trim(),
  start: rootStyles.getPropertyValue("--start").trim(),
  exit: rootStyles.getPropertyValue("--exit").trim(),
  player: rootStyles.getPropertyValue("--player").trim(),
  sceneBg: "#f8f2dc",
  spin: "#684e04",
  reset: "#cf2b54",
  reverse: "#3f58d5",
  underpass: "#d2b48b",
  bridge: "#8b6b3f",
  bridgeShadow: "rgba(53, 38, 17, 0.34)",
};

const levelAudioById = new Map<number, HTMLAudioElement>([
  [2, new Audio(levelTwoAudioSrc)],
  [3, new Audio(levelThreeAudioSrc)],
  [4, new Audio(levelFourAudioSrc)],
]);
for (const audio of levelAudioById.values()) {
  audio.preload = "auto";
}

const LEVELS: Level[] = [
  buildLevelOne(),
  buildLevelTwo(),
  buildLevelThree(),
  buildLevelFour(),
];

const state: GameState = {
  levelIndex: 0,
  level: null,
  grid: [],
  player: { x: 0, y: 0 },
  rotationQuarter: 0,
  controlsReversed: false,
  playerCrossingAxis: null,
  playerHiddenUnderBridge: false,
  won: false,
  levelIntroPlayed: {},
  levelIntroFinished: {},
};

for (const [levelId, audio] of levelAudioById.entries()) {
  audio.addEventListener("ended", () => {
    state.levelIntroFinished[levelId] = true;
    if (state.level?.id === levelId) {
      showDescriptionReplayButton();
    }
  });

  audio.addEventListener("error", () => {
    if (state.level?.id === levelId) {
      statusEl.textContent = "Audio could not load. Use play description again.";
      showDescriptionReplayButton();
    }
  });
}

function stopAllLevelAudio(): void {
  for (const audio of levelAudioById.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function createGrid(cols: number, rows: number, fill: Tile = WALL): Tile[][] {
  return Array.from({ length: rows }, () => Array<Tile>(cols).fill(fill));
}

function inBounds(grid: Tile[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0]!.length;
}

function carveBrush(grid: Tile[][], x: number, y: number, radius = 1): void {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(grid, nx, ny)) {
        const row = grid[ny];
        if (row) {
          row[nx] = OPEN;
        }
      }
    }
  }
}

function carveSegment(
  grid: Tile[][],
  from: Point,
  to: Point,
  radius = 1
): void {
  let x = from.x;
  let y = from.y;
  carveBrush(grid, x, y, radius);

  while (x !== to.x || y !== to.y) {
    if (x !== to.x) {
      x += Math.sign(to.x - x);
    } else if (y !== to.y) {
      y += Math.sign(to.y - y);
    }
    carveBrush(grid, x, y, radius);
  }
}

function carvePolyline(grid: Tile[][], points: Point[], radius = 1): void {
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (from && to) {
      carveSegment(grid, from, to, radius);
    }
  }
}

function freezeGrid(grid: Tile[][]): string[] {
  return grid.map((row) => row.join(""));
}

function setSpecialTiles(grid: Tile[][], coordinates: Point[], tile: Tile): void {
  for (const { x, y } of coordinates) {
    if (inBounds(grid, x, y)) {
      const row = grid[y];
      if (row && row[x] !== WALL) {
        row[x] = tile;
      }
    }
  }
}

function setSpinTiles(grid: Tile[][], coordinates: Point[]): void {
  setSpecialTiles(grid, coordinates, SPIN);
}

function setResetTiles(grid: Tile[][], coordinates: Point[]): void {
  setSpecialTiles(grid, coordinates, RESET);
}

function setReverseTiles(grid: Tile[][], coordinates: Point[]): void {
  setSpecialTiles(grid, coordinates, REVERSE);
}

function setUnderpassTiles(grid: Tile[][], coordinates: Point[]): void {
  setSpecialTiles(grid, coordinates, UNDERPASS);
}

function axisFromDelta(dx: number, dy: number): Axis {
  return dx !== 0 ? "horizontal" : "vertical";
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function isOpenTile(tile: Tile | undefined): boolean {
  return tile !== undefined && tile !== WALL;
}

function validateCrossings(grid: Tile[][], crossings: Crossing[]): void {
  for (const crossing of crossings) {
    const { x, y } = crossing.point;
    const left = isOpenTile(grid[y]?.[x - 1]);
    const right = isOpenTile(grid[y]?.[x + 1]);
    const up = isOpenTile(grid[y - 1]?.[x]);
    const down = isOpenTile(grid[y + 1]?.[x]);

    const horizontalThrough = left && right;
    const verticalThrough = up && down;
    const hasOverAxisNeighbor =
      crossing.underAxis === "horizontal" ? up || down : left || right;

    const validUnderAxis =
      crossing.underAxis === "horizontal" ? horizontalThrough : verticalThrough;
    const hasDiagonalNeighbor =
      isOpenTile(grid[y - 1]?.[x - 1]) ||
      isOpenTile(grid[y - 1]?.[x + 1]) ||
      isOpenTile(grid[y + 1]?.[x - 1]) ||
      isOpenTile(grid[y + 1]?.[x + 1]);

    if (!validUnderAxis || !hasOverAxisNeighbor || hasDiagonalNeighbor) {
      throw new Error(
        `Invalid crossing at ${x},${y}. Bridges must sit on T or + intersections with a straight under-path and no diagonal neighbors.`
      );
    }
  }
}

function setTile(grid: Tile[][], point: Point, tile: Tile): void {
  const row = grid[point.y];
  if (!row) {
    throw new Error("Tile row out of bounds");
  }

  row[point.x] = tile;
}

function buildLevelOne(): Level {
  const cols = 39;
  const rows = 27;
  const grid = createGrid(cols, rows);

  const mainPath = [
    { x: 2, y: 3 },
    { x: 7, y: 3 },
    { x: 7, y: 6 },
    { x: 3, y: 6 },
    { x: 3, y: 2 },
    { x: 10, y: 2 },
    { x: 10, y: 7 },
    { x: 14, y: 7 },
    { x: 14, y: 4 },
    { x: 22, y: 4 },
    { x: 22, y: 6 },
    { x: 26, y: 6 },
    { x: 26, y: 4 },
    { x: 31, y: 4 },
    { x: 31, y: 10 },
    { x: 27, y: 11 },
    { x: 27, y: 13 },
    { x: 32, y: 14 },
    { x: 31, y: 18 },
    { x: 31, y: 22 },
    { x: 36, y: 24 },
  ];

  const centerLoops = [
    { x: 14, y: 7 },
    { x: 14, y: 10 },
    { x: 21, y: 10 },
    { x: 21, y: 7 },
    { x: 17, y: 7 },
    { x: 17, y: 9 },
    { x: 20, y: 9 },
  ];

  const rightBump = [
    { x: 21, y: 10 },
    { x: 25, y: 10 },
    { x: 25, y: 7 },
    { x: 29, y: 7 },
    { x: 29, y: 11 },
    { x: 26, y: 11 },
  ];

  const lowerLoop = [
    { x: 27, y: 13 },
    { x: 11, y: 14 },
    { x: 11, y: 21 },
    { x: 18, y: 21 },
    { x: 18, y: 23 },
    { x: 13, y: 23 },
  ];

  const deadEnds = [
    [
      { x: 7, y: 3 },
      { x: 9, y: 3 },
      { x: 9, y: 1 },
    ],
    [
      { x: 16, y: 4 },
      { x: 16, y: 2 },
    ],
    [
      { x: 22, y: 6 },
      { x: 24, y: 6 },
      { x: 24, y: 4 },
    ],
    [
      { x: 31, y: 18 },
      { x: 34, y: 18 },
      { x: 34, y: 20 },
    ],
    [
      { x: 15, y: 14 },
      { x: 15, y: 18 },
    ],
    [
      { x: 11, y: 18 },
      { x: 8, y: 18 },
    ],
  ];

  carvePolyline(grid, mainPath, 0);
  carvePolyline(grid, centerLoops, 0);
  carvePolyline(grid, rightBump, 0);
  carvePolyline(grid, lowerLoop, 0);
  for (const deadEnd of deadEnds) {
    carvePolyline(grid, deadEnd, 0);
  }

  const start = { x: 2, y: 3 };
  const exit = { x: 36, y: 24 };
  setTile(grid, start, START);
  setTile(grid, exit, EXIT);

  return {
    id: 1,
    name: "Level 1: The Basics",
    rotationOnSpin: false,
    cols,
    rows,
    grid: freezeGrid(grid),
    start,
    exit,
  };
}

function buildLevelTwo(): Level {
  const cols = 49;
  const rows = 35;
  const grid = createGrid(cols, rows);

  const mainPath = [
    { x: 2, y: 13 },
    { x: 8, y: 13 },
    { x: 10, y: 9 },
    { x: 17, y: 10 },
    { x: 20, y: 8 },
    { x: 24, y: 12 },
    { x: 30, y: 6 },
    { x: 35, y: 8 },
    { x: 36, y: 6 },
    { x: 40, y: 6 },
    { x: 38, y: 14 },
    { x: 37, y: 14 },
    { x: 36, y: 21 },
    { x: 33, y: 21 },
    { x: 33, y: 29 },
    { x: 40, y: 29 },
    { x: 40, y: 31 },
    { x: 46, y: 31 },
  ];

  const topLeftBranch = [
    { x: 2, y: 13 },
    { x: 2, y: 6 },
    { x: 12, y: 6 },
    { x: 12, y: 3 },
  ];

  const leftLoop = [
    { x: 8, y: 13 },
    { x: 9, y: 10 },
    { x: 14, y: 11 },
    { x: 13, y: 17 },
    { x: 9, y: 16 },
    { x: 8, y: 13 },
  ];

  const middleBranch = [
    { x: 17, y: 10 },
    { x: 15, y: 15 },
    { x: 20, y: 18 },
    { x: 22, y: 16 },
    { x: 18, y: 13 },
  ];

  const lockShape = [
    { x: 38, y: 14 },
    { x: 41, y: 15 },
    { x: 40, y: 18 },
    { x: 37, y: 17 },
    { x: 38, y: 14 },
  ];

  const lockInner = [
    { x: 39, y: 15 },
    { x: 39, y: 17 },
  ];

  const lowerRoom = [
    { x: 36, y: 21 },
    { x: 29, y: 21 },
    { x: 29, y: 30 },
    { x: 37, y: 30 },
    { x: 37, y: 24 },
    { x: 35, y: 24 },
  ];

  const lowerSpur = [
    { x: 33, y: 29 },
    { x: 33, y: 31 },
    { x: 36, y: 31 },
  ];

  const finalRun = [
    { x: 40, y: 31 },
    { x: 45, y: 31 },
    { x: 46, y: 31 },
  ];

  carvePolyline(grid, mainPath, 0);
  carvePolyline(grid, topLeftBranch, 0);
  carvePolyline(grid, leftLoop, 0);
  carvePolyline(grid, middleBranch, 0);
  carvePolyline(grid, lockShape, 0);
  carvePolyline(grid, lockInner, 0);
  carvePolyline(grid, lowerRoom, 0);
  carvePolyline(grid, lowerSpur, 0);
  carvePolyline(grid, finalRun, 0);

  setSpinTiles(grid, [
    { x: 12, y: 3 },
    { x: 17, y: 10 },
    { x: 24, y: 12 },
    { x: 36, y: 31 },
    { x: 45, y: 31 },
  ]);

  const start = { x: 2, y: 13 };
  const exit = { x: 46, y: 31 };
  setTile(grid, start, START);
  setTile(grid, exit, EXIT);

  return {
    id: 2,
    name: "Level 2: ILLUSIONS",
    rotationOnSpin: true,
    cols,
    rows,
    grid: freezeGrid(grid),
    start,
    exit,
  };
}

function buildLevelThree(): Level {
  const cols = 63;
  const rows = 35;
  const grid = createGrid(cols, rows);

  const topEntry = [
    { x: 2, y: 4 },
    { x: 16, y: 4 },
  ];

  const leftWing = [
    { x: 16, y: 4 },
    { x: 16, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 18 },
    { x: 15, y: 18 },
    { x: 19, y: 16 },
  ];

  const centerLoop = [
    { x: 19, y: 16 },
    { x: 19, y: 10 },
    { x: 34, y: 10 },
    { x: 34, y: 18 },
    { x: 19, y: 18 },
    { x: 19, y: 16 },
  ];

  const rightConnector = [
    { x: 34, y: 18 },
    { x: 38, y: 18 },
    { x: 38, y: 12 },
    { x: 49, y: 12 },
    { x: 49, y: 18 },
  ];

  const outerRoom = [
    { x: 49, y: 12 },
    { x: 49, y: 4 },
    { x: 58, y: 4 },
    { x: 58, y: 31 },
    { x: 51, y: 31 },
    { x: 51, y: 18 },
  ];

  const finalRun = [
    { x: 49, y: 18 },
    { x: 51, y: 18 },
    { x: 51, y: 30 },
    { x: 60, y: 30 },
  ];

  carvePolyline(grid, topEntry, 0);
  carvePolyline(grid, leftWing, 0);
  carvePolyline(grid, centerLoop, 0);
  carvePolyline(grid, rightConnector, 0);
  carvePolyline(grid, outerRoom, 0);
  carvePolyline(grid, finalRun, 0);

  setResetTiles(grid, [
    { x: 16, y: 4 },
    { x: 6, y: 18 },
    { x: 51, y: 18 },
  ]);

  setReverseTiles(grid, [
    { x: 6, y: 14 },
    { x: 26, y: 10 },
  ]);

  setSpinTiles(grid, [
    { x: 26, y: 18 },
    { x: 43, y: 12 },
  ]);

  const start = { x: 2, y: 4 };
  const exit = { x: 60, y: 30 };
  setTile(grid, start, START);
  setTile(grid, exit, EXIT);

  return {
    id: 3,
    name: "Level 3: ILLUSIONS 2",
    rotationOnSpin: true,
    cols,
    rows,
    grid: freezeGrid(grid),
    start,
    exit,
  };
}

function buildLevelFour(): Level {
  const cols = 67;
  const rows = 35;
  const grid = createGrid(cols, rows);

  const outerHall = [
    { x: 4, y: 4 },
    { x: 4, y: 23 },
    { x: 14, y: 23 },
    { x: 14, y: 28 },
    { x: 63, y: 28 },
  ];

  const upperRoom = [
    { x: 4, y: 4 },
    { x: 4, y: 3 },
    { x: 18, y: 3 },
    { x: 18, y: 11 },
    { x: 12, y: 11 },
    { x: 12, y: 17 },
  ];

  const topBridgeLoop = [
    { x: 18, y: 3 },
    { x: 34, y: 3 },
    { x: 34, y: 10 },
    { x: 23, y: 10 },
  ];

  const centerWinding = [
    { x: 12, y: 17 },
    { x: 27, y: 17 },
    { x: 27, y: 13 },
    { x: 31, y: 13 },
    { x: 31, y: 18 },
    { x: 38, y: 18 },
    { x: 38, y: 14 },
    { x: 44, y: 14 },
    { x: 44, y: 18 },
    { x: 48, y: 18 },
  ];

  const bridgeDrop = [
    { x: 23, y: 10 },
    { x: 23, y: 17 },
  ];

  const rightDescent = [
    { x: 48, y: 18 },
    { x: 50, y: 18 },
    { x: 50, y: 28 },
    { x: 63, y: 28 },
  ];

  const rightBranch = [
    { x: 50, y: 21 },
    { x: 63, y: 21 },
  ];

  carvePolyline(grid, outerHall, 0);
  carvePolyline(grid, upperRoom, 0);
  carvePolyline(grid, topBridgeLoop, 0);
  carvePolyline(grid, centerWinding, 0);
  carvePolyline(grid, bridgeDrop, 0);
  carvePolyline(grid, rightDescent, 0);
  carvePolyline(grid, rightBranch, 0);

  const crossings: Crossing[] = [
    { point: { x: 18, y: 3 }, underAxis: "horizontal" },
    { point: { x: 23, y: 17 }, underAxis: "horizontal" },
    { point: { x: 50, y: 21 }, underAxis: "vertical" },
  ];
  setUnderpassTiles(
    grid,
    crossings.map((crossing) => crossing.point)
  );
  validateCrossings(grid, crossings);

  const start = { x: 4, y: 4 };
  const exit = { x: 63, y: 28 };
  setTile(grid, start, START);
  setTile(grid, exit, EXIT);

  return {
    id: 4,
    name: "Level 4: THE UNDER-DOOS",
    rotationOnSpin: false,
    cols,
    rows,
    grid: freezeGrid(grid),
    start,
    exit,
    crossings,
  };
}

function cloneGrid(grid: string[]): Tile[][] {
  return grid.map((row) => row.split("") as Tile[]);
}

function currentTile(x: number, y: number): Tile {
  const row = state.grid[y];
  const tile = row?.[x];
  if (!tile) {
    throw new Error(`Tile out of bounds at ${x},${y}`);
  }

  return tile;
}

function getCrossingAt(level: Level | null, x: number, y: number): Crossing | null {
  if (!level?.crossings) {
    return null;
  }

  return level.crossings.find((crossing) => samePoint(crossing.point, { x, y })) ?? null;
}

function isWalkable(x: number, y: number): boolean {
  return inBounds(state.grid, x, y) && currentTile(x, y) !== WALL;
}

function updatePlayerVisibility(): void {
  const crossing = getCrossingAt(state.level, state.player.x, state.player.y);
  state.playerHiddenUnderBridge =
    crossing !== null &&
    state.playerCrossingAxis !== null &&
    crossing.underAxis === state.playerCrossingAxis;
}

function canMoveTo(nx: number, ny: number, dx: number, dy: number): boolean {
  if (!isWalkable(nx, ny)) {
    return false;
  }

  const axis = axisFromDelta(dx, dy);
  const currentCrossing = getCrossingAt(state.level, state.player.x, state.player.y);

  if (currentCrossing && state.playerCrossingAxis && axis !== state.playerCrossingAxis) {
    return false;
  }

  return true;
}

function showDescriptionReplayButton(): void {
  playDescriptionBtn.classList.remove("hidden");
}

function hideDescriptionReplayButton(): void {
  playDescriptionBtn.classList.add("hidden");
}

function playLevelDescription(levelId: number): void {
  const audio = levelAudioById.get(levelId);
  if (!audio) {
    hideDescriptionReplayButton();
    return;
  }

  hideDescriptionReplayButton();
  audio.currentTime = 0;
  const playAttempt = audio.play();

  if (!playAttempt || typeof playAttempt.catch !== "function") {
    return;
  }

  playAttempt.catch(() => {
    if (state.level?.id === levelId) {
      statusEl.textContent = "Tap play description again to hear the level intro.";
      showDescriptionReplayButton();
    }
  });
}

function handleLevelAudioOnEntry(levelId: number): void {
  if (!levelAudioById.has(levelId)) {
    hideDescriptionReplayButton();
    return;
  }

  if (!state.levelIntroPlayed[levelId]) {
    state.levelIntroPlayed[levelId] = true;
    playLevelDescription(levelId);
    return;
  }

  if (state.levelIntroFinished[levelId]) {
    showDescriptionReplayButton();
  } else {
    hideDescriptionReplayButton();
  }
}

function loadLevel(index: number): void {
  const level = LEVELS[index];
  if (!level) {
    throw new Error(`Unknown level index: ${index}`);
  }

  state.level = level;
  state.levelIndex = index;
  state.grid = cloneGrid(level.grid);
  state.player = { ...level.start };
  state.won = false;
  state.rotationQuarter = 0;
  state.controlsReversed = false;
  state.playerCrossingAxis = null;
  state.playerHiddenUnderBridge = false;

  const sceneWidth = level.cols * TILE_SIZE;
  const sceneHeight = level.rows * TILE_SIZE;
  const stageSize = Math.max(sceneWidth, sceneHeight);
  sceneCanvas.width = sceneWidth;
  sceneCanvas.height = sceneHeight;
  canvas.width = stageSize;
  canvas.height = stageSize;

  levelNameEl.textContent = level.name;
  subtitleEl.textContent = level.name;
  statusEl.textContent = "Use arrow keys, WASD, or tap the controls.";
  hideCompletionOverlay();
  hideLevelSelector();

  updatePlayerVisibility();

  stopAllLevelAudio();
  handleLevelAudioOnEntry(level.id);

  draw();
}

function tryMove(dx: number, dy: number): void {
  const level = state.level;
  if (!level || state.won) {
    return;
  }

  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!canMoveTo(nx, ny, dx, dy)) {
    return;
  }

  state.player.x = nx;
  state.player.y = ny;

  const moveAxis = axisFromDelta(dx, dy);
  const tile = currentTile(nx, ny);
  const crossing = getCrossingAt(level, nx, ny);
  state.playerCrossingAxis = crossing ? moveAxis : null;

  if (tile === SPIN && level.rotationOnSpin) {
    state.rotationQuarter = (state.rotationQuarter + 1) % 4;
    statusEl.textContent = "The maze spun around you.";
  } else if (tile === REVERSE) {
    state.controlsReversed = !state.controlsReversed;
    statusEl.textContent = state.controlsReversed
      ? "Your controls are reversed."
      : "Your controls are normal again.";
  } else if (tile === RESET) {
    state.rotationQuarter = 0;
    state.controlsReversed = false;
    statusEl.textContent = "The illusions reset.";
  } else if (tile === UNDERPASS && crossing?.underAxis === moveAxis) {
    statusEl.textContent = "You slipped under the bridge.";
  }

  updatePlayerVisibility();

  if (nx === level.exit.x && ny === level.exit.y) {
    state.won = true;
    statusEl.textContent = "LEVEL COMPLETE";
    showCompletionOverlay();
  }

  draw();
}

function screenDeltaToWorldDelta(
  dx: number,
  dy: number
): readonly [number, number] {
  const quarter = ((state.rotationQuarter % 4) + 4) % 4;
  if (quarter === 0) {
    return [dx, dy];
  }
  if (quarter === 1) {
    return [dy, -dx];
  }
  if (quarter === 2) {
    return [-dx, -dy];
  }
  return [-dy, dx];
}

function moveByScreenInput(dx: number, dy: number): void {
  const effectiveDx = state.controlsReversed ? -dx : dx;
  const effectiveDy = state.controlsReversed ? -dy : dy;
  const [worldDx, worldDy] = screenDeltaToWorldDelta(effectiveDx, effectiveDy);
  tryMove(worldDx, worldDy);
}

function drawSpinSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;

  drawCtx.strokeStyle = palette.spin;
  drawCtx.lineWidth = 2;

  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.28, Math.PI * 0.65, Math.PI * 2.25);
  drawCtx.stroke();

  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.14, Math.PI * 0.65, Math.PI * 2.2);
  drawCtx.stroke();
}

function drawResetSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.22;

  drawCtx.strokeStyle = palette.reset;
  drawCtx.fillStyle = palette.reset;
  drawCtx.lineWidth = 2;

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
  ];

  for (const { dx, dy } of directions) {
    const tipX = cx + dx * (radius + 4);
    const tipY = cy + dy * (radius + 4);
    const baseX = cx + dx * 3;
    const baseY = cy + dy * 3;

    drawCtx.beginPath();
    drawCtx.moveTo(baseX, baseY);
    drawCtx.lineTo(tipX, tipY);
    drawCtx.stroke();

    if (dx !== 0) {
      drawCtx.beginPath();
      drawCtx.moveTo(tipX, tipY);
      drawCtx.lineTo(tipX - dx * 4, tipY - 3);
      drawCtx.lineTo(tipX - dx * 4, tipY + 3);
      drawCtx.closePath();
      drawCtx.fill();
    } else {
      drawCtx.beginPath();
      drawCtx.moveTo(tipX, tipY);
      drawCtx.lineTo(tipX - 3, tipY - dy * 4);
      drawCtx.lineTo(tipX + 3, tipY - dy * 4);
      drawCtx.closePath();
      drawCtx.fill();
    }
  }

  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.09, 0, Math.PI * 2);
  drawCtx.fill();
}

function drawReverseSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;

  drawCtx.strokeStyle = palette.reverse;
  drawCtx.fillStyle = palette.reverse;
  drawCtx.lineWidth = 2;

  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.24, 0, Math.PI * 2);
  drawCtx.stroke();

  drawCtx.beginPath();
  drawCtx.moveTo(cx - TILE_SIZE * 0.22, cy + TILE_SIZE * 0.22);
  drawCtx.lineTo(cx + TILE_SIZE * 0.22, cy - TILE_SIZE * 0.22);
  drawCtx.stroke();

  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.08, 0, Math.PI * 2);
  drawCtx.fill();
}

function drawUnderpassSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  drawCtx.strokeStyle = "rgba(23, 32, 61, 0.12)";
  drawCtx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
}

function drawUnderpassShadow(
  drawCtx: CanvasRenderingContext2D,
  crossing: Crossing,
  direction: -1 | 1,
  distance: number
): void {
  const alpha = distance === 1 ? 0.78 : 0.32;
  if (crossing.underAxis === "horizontal") {
    const x = crossing.point.x + direction * distance;
    const y = crossing.point.y;
    if (!inBounds(state.grid, x, y) || currentTile(x, y) === WALL) {
      return;
    }

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const startX = direction < 0 ? px + TILE_SIZE : px;
    const endX = direction < 0 ? px : px + TILE_SIZE;
    const shadow = drawCtx.createLinearGradient(startX, py, endX, py);
    shadow.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
    shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    drawCtx.fillStyle = shadow;
    drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    return;
  }

  const x = crossing.point.x;
  const y = crossing.point.y + direction * distance;
  if (!inBounds(state.grid, x, y) || currentTile(x, y) === WALL) {
    return;
  }

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const startY = direction < 0 ? py + TILE_SIZE : py;
  const endY = direction < 0 ? py : py + TILE_SIZE;
  const shadow = drawCtx.createLinearGradient(px, startY, px, endY);
  shadow.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  drawCtx.fillStyle = shadow;
  drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
}

function drawUnderpassShadows(drawCtx: CanvasRenderingContext2D): void {
  for (const crossing of state.level?.crossings ?? []) {
    drawUnderpassShadow(drawCtx, crossing, -1, 1);
    drawUnderpassShadow(drawCtx, crossing, 1, 1);
    drawUnderpassShadow(drawCtx, crossing, -1, 2);
    drawUnderpassShadow(drawCtx, crossing, 1, 2);
  }
}

function drawTile(
  drawCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tile: Tile
): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  let fill = palette.path;
  if (tile === WALL) {
    fill = palette.wall;
  } else if (tile === START) {
    fill = palette.start;
  } else if (tile === EXIT) {
    fill = palette.exit;
  }

  drawCtx.fillStyle = fill;
  drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (tile !== WALL) {
    drawCtx.strokeStyle = "rgba(23, 32, 61, 0.08)";
    drawCtx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  if (tile === SPIN) {
    drawSpinSymbol(drawCtx, x, y);
  } else if (tile === RESET) {
    drawResetSymbol(drawCtx, x, y);
  } else if (tile === REVERSE) {
    drawReverseSymbol(drawCtx, x, y);
  } else if (tile === UNDERPASS) {
    drawUnderpassSymbol(drawCtx, x, y);
  }
}

function drawPlayer(drawCtx: CanvasRenderingContext2D): void {
  if (state.playerHiddenUnderBridge) {
    return;
  }

  const cx = state.player.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = state.player.y * TILE_SIZE + TILE_SIZE / 2;

  drawCtx.fillStyle = palette.player;
  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.34, 0, Math.PI * 2);
  drawCtx.fill();

  drawCtx.fillStyle = "#ffffff";
  drawCtx.beginPath();
  drawCtx.arc(cx + 2, cy - 2, TILE_SIZE * 0.1, 0, Math.PI * 2);
  drawCtx.fill();
}

function drawScene(): void {
  sceneCtx.fillStyle = palette.sceneBg;
  sceneCtx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);

  for (let y = 0; y < state.grid.length; y += 1) {
    const row = state.grid[y];
    if (!row) {
      continue;
    }

    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile) {
        drawTile(sceneCtx, x, y, tile);
      }
    }
  }

  drawUnderpassShadows(sceneCtx);
  drawPlayer(sceneCtx);
}

function draw(): void {
  drawScene();

  ctx.fillStyle = palette.sceneBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(state.rotationQuarter * (Math.PI / 2));
  ctx.drawImage(sceneCanvas, -sceneCanvas.width / 2, -sceneCanvas.height / 2);
  ctx.restore();
}

function showLevelSelector(): void {
  levelSelectorOverlay.classList.add("is-visible");
  levelSelectorOverlay.setAttribute("aria-hidden", "false");
}

function hideLevelSelector(): void {
  levelSelectorOverlay.classList.remove("is-visible");
  levelSelectorOverlay.setAttribute("aria-hidden", "true");
}

function renderLevelSelector(): void {
  levelSelectorList.innerHTML = LEVELS.map((level, index) => {
    const isCurrent = index === state.levelIndex;
    const currentClass = isCurrent ? " is-current" : "";
    return `<button class="selector-level-btn${currentClass}" type="button" data-level-index="${index}">Level ${level.id}: ${level.name.replace(/^Level \d+:\s*/, "")}</button>`;
  }).join("");

  const levelButtons = Array.from(
    levelSelectorList.querySelectorAll<HTMLButtonElement>(".selector-level-btn")
  );

  for (const button of levelButtons) {
    button.addEventListener("click", () => {
      const rawIndex = button.dataset["levelIndex"];
      const index = rawIndex ? Number.parseInt(rawIndex, 10) : Number.NaN;
      if (Number.isNaN(index)) {
        return;
      }

      loadLevel(index);
    });
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideLevelSelector();
    return;
  }

  const key = event.key.toLowerCase();
  const moves: Record<string, readonly [number, number]> = {
    arrowup: [0, -1],
    w: [0, -1],
    arrowdown: [0, 1],
    s: [0, 1],
    arrowleft: [-1, 0],
    a: [-1, 0],
    arrowright: [1, 0],
    d: [1, 0],
  };
  const move = moves[key];
  if (!move) {
    return;
  }

  event.preventDefault();
  moveByScreenInput(move[0], move[1]);
}

function isDirection(value: string): value is Direction {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function setupTouchControls(): void {
  const byDir: Record<Direction, readonly [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };

  for (const button of controlButtons) {
    button.addEventListener("click", () => {
      const dir = button.dataset["dir"];
      if (!dir || !isDirection(dir)) {
        return;
      }

      const move = byDir[dir];
      moveByScreenInput(move[0], move[1]);
    });
  }
}

function showCompletionOverlay(): void {
  completionOverlay.classList.add("is-visible");
  completionOverlay.setAttribute("aria-hidden", "false");
}

function hideCompletionOverlay(): void {
  completionOverlay.classList.remove("is-visible");
  completionOverlay.setAttribute("aria-hidden", "true");
}

resetBtn.addEventListener("click", () => {
  loadLevel(state.levelIndex);
});

levelSelectorBtn.addEventListener("click", () => {
  renderLevelSelector();
  showLevelSelector();
});

closeLevelSelectorBtn.addEventListener("click", () => {
  hideLevelSelector();
});

levelSelectorOverlay.addEventListener("click", (event) => {
  if (event.target === levelSelectorOverlay) {
    hideLevelSelector();
  }
});

playDescriptionBtn.addEventListener("click", () => {
  if (state.level) {
    playLevelDescription(state.level.id);
  }
});

tryAgainBtn.addEventListener("click", () => {
  loadLevel(state.levelIndex);
});

nextLevelBtn.addEventListener("click", () => {
  const nextLevelIndex = state.levelIndex + 1;
  if (nextLevelIndex < LEVELS.length) {
    loadLevel(nextLevelIndex);
    return;
  }

  loadLevel(0);
  statusEl.textContent = "More levels coming soon. Replaying Level 1.";
});

window.addEventListener("keydown", handleKeydown, { passive: false });
setupTouchControls();
loadLevel(0);
