import levelTwoAudioSrc from "./assets/level-2-illusions-description.m4a";
import levelThreeAudioSrc from "./assets/level-3-illusions-2-description.m4a";
import levelFourAudioSrc from "./assets/level-4-underdoos-description.m4a";
import levelFiveAudioSrc from "./assets/level-5-portals-description.m4a";
import levelSixAudioSrc from "./assets/level-6-time-buttons-description.m4a";
import droppingTheTrophyAudioSrc from "./assets/dropping-the-trophy.m4a";
import { NORMALIZED_MAZE_MAPS } from "./maps";
import {
  AHEG_TROPHY_LOCATION_KEY,
  OUMG_DELETED_FROM_HUB_KEY,
  renderImportedAhegTrophy,
} from "../../shared/ahegTrophy";
import { initEscapedAhegPlayer } from "../../shared/escapedAhegPlayer";
import {
  TERRAIN_OPEN,
  TERRAIN_WALL,
  type Axis,
  type BridgeFeature,
  type FeatureDefinition,
  type FeatureKind,
  type MapFeature,
  type NormalizedMazeMap,
  type Point,
  type PortalFeature,
  type SwitchFeature,
  type WellFeature,
  featureAt,
  getFeatureDefinition,
  getFeatureDefinitions,
  pointKey,
  samePoint,
  terrainTileAt,
} from "./model";

const TILE_SIZE = 24;
const WELL_FADE_MS = 1_500;
const WALL = "#";
const OPEN = ".";
const START = "S";
const EXIT = "E";
const SPIN = "O";
const RESET = "R";
const REVERSE = "V";
const UNDERPASS = "U";
const PORTAL = "P";
const BUTTON = "B";
const TIMED_WALL = "G";
const TIMED_WALL_DURATION_MS = 10_000;
const TIMED_WALL_FADE_MS = 1_500;
const LINKED_REVERSE_CONTROLS_KEY = "linked-reverse-controls-curse";
const LINKED_ROTATION_CURSE_KEY = "linked-rotation-curse";

type Direction = "up" | "down" | "left" | "right";

interface GameState {
  levelIndex: number;
  level: NormalizedMazeMap | null;
  player: Point;
  rotationQuarter: number;
  controlsReversed: boolean;
  playerCrossingAxis: Axis | null;
  playerHiddenUnderBridge: boolean;
  portalLock: string | null;
  wellOpenUntil: Record<string, number>;
  won: boolean;
  levelIntroPlayed: Partial<Record<number, boolean>>;
  levelIntroFinished: Partial<Record<number, boolean>>;
}

const LEVELS = NORMALIZED_MAZE_MAPS;

const canvasElement = document.getElementById("maze");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Missing maze canvas");
}
const canvas: HTMLCanvasElement = canvasElement;

const ctxValue = canvas.getContext("2d");
if (!(ctxValue instanceof CanvasRenderingContext2D)) {
  throw new Error("Could not create maze drawing context");
}
initEscapedAhegPlayer({ interactionCanvas: canvas });
const ctx: CanvasRenderingContext2D = ctxValue;

const TROPHY_DROP_COUNT_KEY = "oscars-untitled-maze-game-trophy-drop-count";
const TROPHY_DOOM_STARTED_KEY = "oscars-untitled-maze-game-trophy-doom-started";
renderImportedAhegTrophy("oscars-untitled-maze-game", {
  onDrop: handleImportedTrophyDrop,
});

function handleImportedTrophyDrop(): void {
  if (
    localStorage.getItem(OUMG_DELETED_FROM_HUB_KEY) === "true" ||
    localStorage.getItem(TROPHY_DOOM_STARTED_KEY) === "true"
  ) {
    return;
  }

  const nextDropCount = readTrophyDropCount() + 1;
  localStorage.setItem(TROPHY_DROP_COUNT_KEY, String(nextDropCount));

  if (nextDropCount >= 3) {
    startTrophyDoomSequence();
  }
}

function readTrophyDropCount(): number {
  return Number(localStorage.getItem(TROPHY_DROP_COUNT_KEY) ?? "0") || 0;
}

function startTrophyDoomSequence(): void {
  localStorage.setItem(TROPHY_DOOM_STARTED_KEY, "true");
  document.body.classList.add("trophy-doom-active");
  dropOumgAssetsOneByOne();

  const recording = new Audio(droppingTheTrophyAudioSrc);
  let finished = false;
  const finishDeletingOumg = () => {
    if (finished) {
      return;
    }

    finished = true;
    localStorage.setItem(OUMG_DELETED_FROM_HUB_KEY, "true");
    localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
    window.location.href = new URL("../../", window.location.href).toString();
  };

  recording.addEventListener("ended", finishDeletingOumg, { once: true });
  const playPromise = recording.play();
  if (playPromise) {
    playPromise.catch(() => {
      window.setTimeout(finishDeletingOumg, 2500);
    });
  }
}

function dropOumgAssetsOneByOne(): void {
  const fallingAssets = [
    ...document.querySelectorAll<HTMLElement>(
      [
        ".start-menu-overlay:not(.is-hidden) .start-menu-card",
        ".game-shell > h1",
        ".game-shell > .subtitle",
        ".game-shell > .hud",
        ".game-shell > .canvas-wrap",
        ".game-shell > .controls",
        "#level-selector-overlay[aria-hidden='false'] .selector-card",
        "#imported-aheg-trophy",
      ].join(", ")
    ),
  ];

  fallingAssets.forEach((asset, index) => {
    asset.classList.add("oumg-falling-asset");
    asset.style.setProperty("--oumg-fall-delay", `${index * 140}ms`);
    asset.style.setProperty("--oumg-fall-x", `${index % 2 === 0 ? -34 : 28}px`);
    asset.style.setProperty("--oumg-fall-rotate", `${index % 2 === 0 ? -10 : 12}deg`);
  });
}

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

const startMenuOverlayElement = document.getElementById("start-menu-overlay");
if (!(startMenuOverlayElement instanceof HTMLDivElement)) {
  throw new Error("Missing start menu overlay");
}
const startMenuOverlay: HTMLDivElement = startMenuOverlayElement;

const startMenuMessageElement = document.getElementById("start-menu-message");
if (!(startMenuMessageElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing start menu message");
}
const startMenuMessageEl: HTMLParagraphElement = startMenuMessageElement;

const createPanelElement = document.getElementById("create-panel");
if (!(createPanelElement instanceof HTMLElement)) {
  throw new Error("Missing create panel");
}
const createPanel: HTMLElement = createPanelElement;

const createPanelTitleElement = document.getElementById("create-panel-title");
if (!(createPanelTitleElement instanceof HTMLHeadingElement)) {
  throw new Error("Missing create panel title");
}
const createPanelTitleEl: HTMLHeadingElement = createPanelTitleElement;

const createPanelDescriptionElement = document.getElementById("create-panel-description");
if (!(createPanelDescriptionElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing create panel description");
}
const createPanelDescriptionEl: HTMLParagraphElement = createPanelDescriptionElement;

const createPanelHintElement = document.getElementById("create-panel-hint");
if (!(createPanelHintElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing create panel hint");
}
const createPanelHintEl: HTMLParagraphElement = createPanelHintElement;

const createFeatureListElement = document.getElementById("create-feature-list");
if (!(createFeatureListElement instanceof HTMLDivElement)) {
  throw new Error("Missing create feature list");
}
const createFeatureList: HTMLDivElement = createFeatureListElement;

const playButton = document.getElementById("play-btn");
if (!(playButton instanceof HTMLButtonElement)) {
  throw new Error("Missing play button");
}
const playBtn: HTMLButtonElement = playButton;

const createButton = document.getElementById("create-btn");
if (!(createButton instanceof HTMLButtonElement)) {
  throw new Error("Missing create button");
}
const createBtn: HTMLButtonElement = createButton;

const viewButton = document.getElementById("view-btn");
if (!(viewButton instanceof HTMLButtonElement)) {
  throw new Error("Missing view button");
}
const viewBtn: HTMLButtonElement = viewButton;

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
  portal: "#7f39c7",
  portalLine: "rgba(127, 57, 199, 0.58)",
  switch: "#835320",
  switchTop: "#f2d088",
  well: "#2c3555",
};

const levelAudioById = new Map<number, HTMLAudioElement>([
  [2, new Audio(levelTwoAudioSrc)],
  [3, new Audio(levelThreeAudioSrc)],
  [4, new Audio(levelFourAudioSrc)],
  [5, new Audio(levelFiveAudioSrc)],
  [6, new Audio(levelSixAudioSrc)],
]);
for (const audio of levelAudioById.values()) {
  audio.preload = "auto";
}

const state: GameState = {
  levelIndex: 0,
  level: null,
  player: { x: 0, y: 0 },
  rotationQuarter: 0,
  controlsReversed: false,
  playerCrossingAxis: null,
  playerHiddenUnderBridge: false,
  portalLock: null,
  wellOpenUntil: {},
  won: false,
  levelIntroPlayed: {},
  levelIntroFinished: {},
};

let wellTicker: number | null = null;

for (const [levelId, audio] of levelAudioById.entries()) {
  audio.addEventListener("ended", () => {
    state.levelIntroFinished[levelId] = true;
    if (state.level?.map.id === levelId) {
      showDescriptionReplayButton();
    }
  });

  audio.addEventListener("error", () => {
    if (state.level?.map.id === levelId) {
      statusEl.textContent = "Audio could not load. Use play description again.";
      showDescriptionReplayButton();
    }
  });
}

window.addEventListener("pagehide", persistLinkedCrossGameState);

function stopAllLevelAudio(): void {
  for (const audio of levelAudioById.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function showStartMenu(): void {
  startMenuOverlay.classList.remove("is-hidden");
  startMenuOverlay.setAttribute("aria-hidden", "false");
}

function hideStartMenu(): void {
  startMenuOverlay.classList.add("is-hidden");
  startMenuOverlay.setAttribute("aria-hidden", "true");
}

function showCreatePanel(): void {
  createPanel.classList.remove("hidden");
}

function hideCreatePanel(): void {
  createPanel.classList.add("hidden");
}

function axisFromDelta(dx: number, dy: number): Axis {
  return dx !== 0 ? "horizontal" : "vertical";
}

function currentTerrain(x: number, y: number): "#" | "." {
  if (!state.level) {
    throw new Error("No level loaded");
  }

  const tile = terrainTileAt(state.level.terrain, { x, y });
  if (!tile) {
    throw new Error(`Terrain out of bounds at ${x},${y}`);
  }

  return tile;
}

function getBridgeAt(level: NormalizedMazeMap | null, x: number, y: number): BridgeFeature | null {
  return level?.bridgesByCell.get(pointKey({ x, y })) ?? null;
}

function getPortalAt(level: NormalizedMazeMap | null, x: number, y: number): PortalFeature | null {
  return level?.portalsByCell.get(pointKey({ x, y })) ?? null;
}

function getPortalDestination(
  level: NormalizedMazeMap | null,
  portal: PortalFeature
): PortalFeature | null {
  return level?.portalsById.get(portal.props.targetPortalId) ?? null;
}

function getSwitchAt(level: NormalizedMazeMap | null, x: number, y: number): SwitchFeature | null {
  return level?.switchesByCell.get(pointKey({ x, y })) ?? null;
}

function getWellAt(level: NormalizedMazeMap | null, x: number, y: number): WellFeature | null {
  return level?.wellsByCell.get(pointKey({ x, y })) ?? null;
}

function getWellExpiry(wellId: string): number {
  return state.wellOpenUntil[wellId] ?? 0;
}

function isWellOpen(wellId: string, now = Date.now()): boolean {
  return getWellExpiry(wellId) > now;
}

function getWellOpenAmount(wellId: string, now = Date.now()): number {
  const remaining = getWellExpiry(wellId) - now;
  if (remaining <= 0) {
    return 0;
  }

  const fadeWindow = Math.min(getWellExpiry(wellId) - (now - WELL_FADE_MS), WELL_FADE_MS);
  const maxVisible = Math.max(WELL_FADE_MS, fadeWindow);
  return remaining >= maxVisible ? 1 : Math.max(0, Math.min(1, remaining / WELL_FADE_MS));
}

function stopWellTicker(): void {
  if (wellTicker !== null) {
    window.clearInterval(wellTicker);
    wellTicker = null;
  }
}

function cleanupExpiredWells(now = Date.now()): void {
  for (const [wellId, expiresAt] of Object.entries(state.wellOpenUntil)) {
    if (expiresAt <= now) {
      delete state.wellOpenUntil[wellId];
    }
  }
}

function ensureWellTicker(): void {
  if (wellTicker !== null) {
    return;
  }

  wellTicker = window.setInterval(() => {
    cleanupExpiredWells();

    if (state.level) {
      const currentWell = getWellAt(state.level, state.player.x, state.player.y);
      if (currentWell && !isWellOpen(currentWell.id)) {
        statusEl.textContent = "Too slow. Try again.";
        loadLevel(state.levelIndex);
        return;
      }
    }

    if (Object.keys(state.wellOpenUntil).length === 0) {
      stopWellTicker();
    }

    if (state.level) {
      draw();
    }
  }, 100);
}

function triggerSwitch(mazeSwitch: SwitchFeature): void {
  const expiresAt = Date.now() + mazeSwitch.props.timeoutMs;
  for (const targetWellId of mazeSwitch.props.targetWellIds) {
    state.wellOpenUntil[targetWellId] = expiresAt;
  }
  ensureWellTicker();
  const seconds = mazeSwitch.props.timeoutMs / 1000;
  statusEl.textContent = `Switch pressed. Well open for ${seconds} seconds.`;
}

function isWalkable(x: number, y: number): boolean {
  if (!state.level) {
    return false;
  }

  if (x < 0 || y < 0 || x >= state.level.cols || y >= state.level.rows) {
    return false;
  }

  if (currentTerrain(x, y) === TERRAIN_WALL) {
    return false;
  }

  const well = getWellAt(state.level, x, y);
  if (well) {
    return isWellOpen(well.id);
  }

  return true;
}

function updatePlayerVisibility(): void {
  const bridge = getBridgeAt(state.level, state.player.x, state.player.y);
  state.playerHiddenUnderBridge =
    bridge !== null &&
    state.playerCrossingAxis !== null &&
    bridge.props.underAxis === state.playerCrossingAxis;
}

function canMoveTo(nx: number, ny: number, dx: number, dy: number): boolean {
  if (!isWalkable(nx, ny)) {
    return false;
  }

  const axis = axisFromDelta(dx, dy);
  const currentBridge = getBridgeAt(state.level, state.player.x, state.player.y);
  if (currentBridge && state.playerCrossingAxis && axis !== state.playerCrossingAxis) {
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
    if (state.level?.map.id === levelId) {
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
  state.player = { ...level.map.markers.start };
  state.won = false;
  state.rotationQuarter = 0;
  state.controlsReversed = false;
  state.playerCrossingAxis = null;
  state.playerHiddenUnderBridge = false;
  state.portalLock = null;
  state.wellOpenUntil = {};
  stopWellTicker();

  const sceneWidth = level.cols * TILE_SIZE;
  const sceneHeight = level.rows * TILE_SIZE;
  const stageSize = Math.max(sceneWidth, sceneHeight);
  sceneCanvas.width = sceneWidth;
  sceneCanvas.height = sceneHeight;
  canvas.width = stageSize;
  canvas.height = stageSize;

  levelNameEl.textContent = level.map.name;
  subtitleEl.textContent = level.map.name;
  statusEl.textContent = "Use arrow keys, WASD, or tap the controls.";
  hideCompletionOverlay();
  hideLevelSelector();
  hideStartMenu();

  updatePlayerVisibility();

  stopAllLevelAudio();
  handleLevelAudioOnEntry(level.map.id);

  draw();
}

function applySpin(rotationQuarterDelta: number): void {
  const delta = ((rotationQuarterDelta % 4) + 4) % 4;
  state.rotationQuarter = (state.rotationQuarter + delta) % 4;
}

function persistLinkedCrossGameState(): void {
  if (state.controlsReversed) {
    localStorage.setItem(LINKED_REVERSE_CONTROLS_KEY, "reversed");
  } else {
    localStorage.removeItem(LINKED_REVERSE_CONTROLS_KEY);
  }

  if (((state.rotationQuarter % 4) + 4) % 4 !== 0) {
    localStorage.setItem(LINKED_ROTATION_CURSE_KEY, "rotated");
  } else {
    localStorage.removeItem(LINKED_ROTATION_CURSE_KEY);
  }
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
  const feature = featureAt(level, { x: nx, y: ny });
  const bridge = feature?.kind === "bridge" ? feature : null;
  state.playerCrossingAxis = bridge ? moveAxis : null;

  if (feature?.kind === "spin") {
    applySpin(feature.props.rotationQuarterDelta);
    statusEl.textContent = "The maze spun around you.";
  } else if (feature?.kind === "reverse") {
    state.controlsReversed = !state.controlsReversed;
    statusEl.textContent = state.controlsReversed
      ? "Your controls are reversed."
      : "Your controls are normal again.";
  } else if (feature?.kind === "reset") {
    state.rotationQuarter = 0;
    state.controlsReversed = false;
    statusEl.textContent = "The illusions reset.";
  } else if (feature?.kind === "bridge" && feature.props.underAxis === moveAxis) {
    statusEl.textContent = "You slipped under the bridge.";
  } else if (feature?.kind === "switch") {
    triggerSwitch(feature);
  }

  if (feature?.kind === "portal") {
    if (state.portalLock !== feature.id) {
      const destination = getPortalDestination(level, feature);
      if (destination) {
        state.player = { ...destination.position };
        state.playerCrossingAxis = null;
        state.portalLock = destination.id;
        statusEl.textContent = "WHOOSH. Portal jump.";
      }
    }
  } else {
    state.portalLock = null;
  }

  updatePlayerVisibility();

  if (samePoint(state.player, level.map.markers.exit)) {
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

function drawBridgeSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  drawCtx.strokeStyle = "rgba(23, 32, 61, 0.12)";
  drawCtx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
}

function drawPortalSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;

  drawCtx.strokeStyle = palette.portal;
  drawCtx.lineWidth = 2.5;
  drawCtx.beginPath();
  drawCtx.arc(cx, cy, TILE_SIZE * 0.28, 0, Math.PI * 2);
  drawCtx.stroke();
}

function drawSwitchSymbol(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;

  drawCtx.fillStyle = palette.switch;
  drawCtx.fillRect(px + 4, py + TILE_SIZE * 0.58, TILE_SIZE - 8, TILE_SIZE * 0.16);

  drawCtx.fillStyle = palette.switchTop;
  drawCtx.beginPath();
  drawCtx.arc(cx, cy + 2, TILE_SIZE * 0.28, Math.PI, 0);
  drawCtx.fill();

  drawCtx.strokeStyle = palette.switch;
  drawCtx.lineWidth = 2;
  drawCtx.beginPath();
  drawCtx.arc(cx, cy + 2, TILE_SIZE * 0.28, Math.PI, 0);
  drawCtx.stroke();
}

function drawWellOverlay(drawCtx: CanvasRenderingContext2D, well: WellFeature): void {
  const px = well.position.x * TILE_SIZE;
  const py = well.position.y * TILE_SIZE;
  const openness = getWellOpenAmount(well.id);

  drawCtx.save();
  drawCtx.fillStyle = palette.well;
  drawCtx.globalAlpha = 1 - openness;
  drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  drawCtx.restore();
}

function drawTerrainCell(drawCtx: CanvasRenderingContext2D, x: number, y: number): void {
  if (!state.level) {
    return;
  }

  let fill = palette.path;
  const point = { x, y };
  if (terrainTileAt(state.level.terrain, point) === TERRAIN_WALL) {
    fill = palette.wall;
  } else if (samePoint(point, state.level.map.markers.start)) {
    fill = palette.start;
  } else if (samePoint(point, state.level.map.markers.exit)) {
    fill = palette.exit;
  }

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  drawCtx.fillStyle = fill;
  drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (fill !== palette.wall) {
    drawCtx.strokeStyle = "rgba(23, 32, 61, 0.08)";
    drawCtx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }
}

function drawFeature(drawCtx: CanvasRenderingContext2D, feature: MapFeature): void {
  const graphics = getFeatureDefinition(feature.kind).graphics;
  if (graphics.icon === "well" && feature.kind === "well") {
    drawWellOverlay(drawCtx, feature);
    return;
  }

  if (graphics.icon === "spin") {
    drawSpinSymbol(drawCtx, feature.position.x, feature.position.y);
  } else if (graphics.icon === "reset") {
    drawResetSymbol(drawCtx, feature.position.x, feature.position.y);
  } else if (graphics.icon === "reverse") {
    drawReverseSymbol(drawCtx, feature.position.x, feature.position.y);
  } else if (graphics.icon === "bridge") {
    drawBridgeSymbol(drawCtx, feature.position.x, feature.position.y);
  } else if (graphics.icon === "portal") {
    drawPortalSymbol(drawCtx, feature.position.x, feature.position.y);
  } else if (graphics.icon === "switch") {
    drawSwitchSymbol(drawCtx, feature.position.x, feature.position.y);
  }
}

function drawBridgeShadow(
  drawCtx: CanvasRenderingContext2D,
  bridge: BridgeFeature,
  direction: -1 | 1,
  distance: number
): void {
  if (!state.level) {
    return;
  }

  const alpha = distance === 1 ? 0.78 : 0.32;
  if (bridge.props.underAxis === "horizontal") {
    const x = bridge.position.x + direction * distance;
    const y = bridge.position.y;
    if (terrainTileAt(state.level.terrain, { x, y }) !== TERRAIN_OPEN) {
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

  const x = bridge.position.x;
  const y = bridge.position.y + direction * distance;
  if (terrainTileAt(state.level.terrain, { x, y }) !== TERRAIN_OPEN) {
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

function drawBridgeShadows(drawCtx: CanvasRenderingContext2D): void {
  if (!state.level) {
    return;
  }

  for (const feature of state.level.map.features) {
    if (feature.kind !== "bridge") {
      continue;
    }

    drawBridgeShadow(drawCtx, feature, -1, 1);
    drawBridgeShadow(drawCtx, feature, 1, 1);
    drawBridgeShadow(drawCtx, feature, -1, 2);
    drawBridgeShadow(drawCtx, feature, 1, 2);
  }
}

function drawPortalLinks(drawCtx: CanvasRenderingContext2D): void {
  if (!state.level) {
    return;
  }

  const visited = new Set<string>();
  for (const portal of state.level.portalsById.values()) {
    if (visited.has(portal.id)) {
      continue;
    }

    const destination = getPortalDestination(state.level, portal);
    if (!destination) {
      continue;
    }

    visited.add(portal.id);
    visited.add(destination.id);

    const startX = portal.position.x * TILE_SIZE + TILE_SIZE / 2;
    const startY = portal.position.y * TILE_SIZE + TILE_SIZE / 2;
    const endX = destination.position.x * TILE_SIZE + TILE_SIZE / 2;
    const endY = destination.position.y * TILE_SIZE + TILE_SIZE / 2;
    const controlX = (startX + endX) / 2;
    const controlY = Math.min(startY, endY) - TILE_SIZE * 2.2;

    drawCtx.strokeStyle = palette.portalLine;
    drawCtx.lineWidth = 2;
    drawCtx.beginPath();
    drawCtx.moveTo(startX, startY);
    drawCtx.quadraticCurveTo(controlX, controlY, endX, endY);
    drawCtx.stroke();
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
  if (!state.level) {
    return;
  }

  sceneCtx.fillStyle = palette.sceneBg;
  sceneCtx.fillRect(0, 0, sceneCanvas.width, sceneCanvas.height);

  for (let y = 0; y < state.level.rows; y += 1) {
    for (let x = 0; x < state.level.cols; x += 1) {
      drawTerrainCell(sceneCtx, x, y);
    }
  }

  for (const feature of state.level.map.features) {
    drawFeature(sceneCtx, feature);
  }

  drawPortalLinks(sceneCtx);
  drawBridgeShadows(sceneCtx);
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
    return `<button class="selector-level-btn${currentClass}" type="button" data-level-index="${index}">Level ${level.map.id}: ${level.map.name.replace(/^Level \d+:\s*/, "")}</button>`;
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

function summarizeFeatureProperties(definition: FeatureDefinition): string {
  if (definition.properties.length === 0) {
    return "No extra properties";
  }

  return definition.properties.map((property) => property.label).join(" • ");
}

function renderCreateFeatureDetail(kind: FeatureKind): void {
  const definition = getFeatureDefinition(kind);
  createPanelTitleEl.textContent = definition.label;
  createPanelDescriptionEl.textContent = definition.description;
  createPanelHintEl.textContent =
    definition.graphics.annotationHint ??
    `Placement: ${definition.placement.notes.join(" ")}`;

  const featureButtons = Array.from(
    createFeatureList.querySelectorAll<HTMLButtonElement>(".create-feature-btn")
  );
  for (const button of featureButtons) {
    button.classList.toggle("is-selected", button.dataset["featureKind"] === kind);
  }
}

function renderCreatePanel(): void {
  const definitions = getFeatureDefinitions();
  createFeatureList.innerHTML = definitions
    .map((definition) => {
      const summary = summarizeFeatureProperties(definition);
      return `<button class="create-feature-btn" type="button" data-feature-kind="${definition.kind}" role="listitem"><span class="create-feature-label">${definition.label}</span><span class="create-feature-meta">${summary}</span></button>`;
    })
    .join("");

  const featureButtons = Array.from(
    createFeatureList.querySelectorAll<HTMLButtonElement>(".create-feature-btn")
  );
  for (const button of featureButtons) {
    button.addEventListener("click", () => {
      const featureKind = button.dataset["featureKind"];
      if (!featureKind || !isFeatureKind(featureKind)) {
        return;
      }

      renderCreateFeatureDetail(featureKind);
    });
  }

  const firstDefinition = definitions[0];
  if (firstDefinition) {
    renderCreateFeatureDetail(firstDefinition.kind);
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

function isFeatureKind(value: string): value is FeatureKind {
  return (
    value === "switch" ||
    value === "well" ||
    value === "bridge" ||
    value === "portal" ||
    value === "spin" ||
    value === "reverse" ||
    value === "reset"
  );
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

playBtn.addEventListener("click", () => {
  hideCreatePanel();
  loadLevel(0);
});

createBtn.addEventListener("click", () => {
  renderCreatePanel();
  showCreatePanel();
  startMenuMessageEl.textContent =
    "Create now previews the feature system that powers the maze maps. Pick a feature card to inspect it.";
});

viewBtn.addEventListener("click", () => {
  hideCreatePanel();
  startMenuMessageEl.textContent =
    "View will browse levels created from declarative terrain and feature data.";
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
    playLevelDescription(state.level.map.id);
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
showStartMenu();

function getFeatureDefinitionNames(): Iterable<string> {
  const byKind: FeatureKind[] = [
    "switch",
    "well",
    "bridge",
    "portal",
    "spin",
    "reverse",
    "reset",
  ];
  return byKind.map((kind) => getFeatureDefinition(kind).label.toLowerCase());
}
