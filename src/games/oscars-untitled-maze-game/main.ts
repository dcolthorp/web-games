import levelTwoAudioSrc from "./assets/level-2-illusions-description.m4a";
import levelThreeAudioSrc from "./assets/level-3-illusions-2-description.m4a";
import levelFourAudioSrc from "./assets/level-4-underdoos-description.m4a";
import levelFiveAudioSrc from "./assets/level-5-portals-description.m4a";
import levelSixAudioSrc from "./assets/level-6-time-buttons-description.m4a";
import droppingTheTrophyAudioSrc from "./assets/dropping-the-trophy.m4a";
import mazeXAudioSrc from "../../shared/audio/maze-x.m4a";
import mazeXRotationAudioSrc from "../../shared/audio/maze-x-rotation.m4a";
import mazeXElsaAudioSrc from "../../shared/audio/maze-x-elsa.m4a";
import mazeXHookshotAudioSrc from "../../shared/audio/maze-x-hookshot.m4a";
import mazeXEndingAudioSrc from "../../shared/audio/maze-x-ending.m4a";
import {
  MAZE_X_SECRET_MAP,
  MAZE_X_SECRET_MAPS,
  MAZE_X_ROTORS,
  MAZE_X_WALKIES,
  MAZE_X_BREAKABLES,
  MAZE_X_FINAL_MAP_ID,
} from "./maps";
import {
  OUMG_GAME_ID,
  OUMG_MAZE_X_DLC_ID,
  awardBeatCredit,
  isDlcUnlocked,
} from "../../shared/dlc";
import { NORMALIZED_MAZE_MAPS } from "./maps";
import {
  AHEG_TROPHY_LOCATION_KEY,
  OUMG_DELETED_FROM_HUB_KEY,
  renderImportedAhegTrophy,
} from "../../shared/ahegTrophy";
import { initEscapedAhegPlayer } from "../../shared/escapedAhegPlayer";
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
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
installForceRefreshHotkey();
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
    const breakable = breakableAt(x, y);
    if (!breakable || !isBreakableBroken(breakable.id)) {
      return false;
    }
  }

  const well = getWellAt(state.level, x, y);
  if (well) {
    return isWellOpen(well.id);
  }

  const rotor = rotorAt(x, y);
  if (rotor && !isRotorOpen(rotor.id)) {
    return false;
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

  stopMazeXTransmission();
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

  const walkie = walkieAt(state.player.x, state.player.y);
  if (walkie && !hasTransmissionPlayed(walkie.transmissionId)) {
    const play = TRANSMISSION_PLAYERS[walkie.transmissionId];
    if (play) play();
  }

  if (samePoint(state.player, level.map.markers.exit)) {
    state.won = true;
    if (isMazeXLevel()) {
      statusEl.textContent = "INCOMING TRANSMISSION...";
      playMazeXTransmission();
    } else if (isMazeXAcquisitionLevel()) {
      acquireWallPhaser();
    } else if (isMazeXFinalLevel()) {
      // Final maze handles its own ending via the walkie transmission.
    } else if (isMazeXSecretLevel()) {
      onMazeXSecretBeaten();
    } else {
      statusEl.textContent = "LEVEL COMPLETE";
      showCompletionOverlay();
    }
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
  lastMoveDelta = [worldDx, worldDy];
  tryMove(worldDx, worldDy);
}

let lastMoveDelta: [number, number] = [0, -1];

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
  const isExitTile = samePoint(point, state.level.map.markers.exit);
  const mazeXExit = isExitTile && isMazeXLevel();
  const phaserPickup = isExitTile && isMazeXAcquisitionLevel();
  if (terrainTileAt(state.level.terrain, point) === TERRAIN_WALL) {
    fill = palette.wall;
  } else if (samePoint(point, state.level.map.markers.start)) {
    fill = palette.start;
  } else if (isExitTile) {
    fill = mazeXExit || phaserPickup ? palette.path : palette.exit;
  }

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  drawCtx.fillStyle = fill;
  drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (fill !== palette.wall) {
    drawCtx.strokeStyle = "rgba(23, 32, 61, 0.08)";
    drawCtx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  if (mazeXExit) {
    drawWalkieTalkie(drawCtx, px, py);
  }
  if (phaserPickup) {
    drawPhaserGadget(drawCtx, px, py);
  }

  if (state.level) {
    const rotor = rotorAt(x, y);
    if (rotor) {
      drawRotorTile(drawCtx, px, py, isRotorOpen(rotor.id));
    }
    const walkie = walkieAt(x, y);
    if (walkie) {
      drawWalkieTalkie(drawCtx, px, py);
    }
    const breakable = breakableAt(x, y);
    if (breakable && !isBreakableBroken(breakable.id)) {
      drawBreakableWall(drawCtx, px, py);
    }
  }
}

function drawBreakableWall(drawCtx: CanvasRenderingContext2D, px: number, py: number): void {
  drawCtx.save();
  drawCtx.strokeStyle = "rgba(255, 180, 90, 0.8)";
  drawCtx.lineWidth = 1.5;
  drawCtx.beginPath();
  drawCtx.moveTo(px + 3, py + 6);
  drawCtx.lineTo(px + 9, py + 11);
  drawCtx.lineTo(px + 5, py + 18);
  drawCtx.lineTo(px + 14, py + 22);
  drawCtx.moveTo(px + 12, py + 4);
  drawCtx.lineTo(px + 18, py + 10);
  drawCtx.lineTo(px + 22, py + 16);
  drawCtx.moveTo(px + 16, py + 18);
  drawCtx.lineTo(px + 20, py + 22);
  drawCtx.stroke();
  drawCtx.fillStyle = "rgba(120, 60, 20, 0.45)";
  drawCtx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  drawCtx.restore();
}

function drawRotorTile(drawCtx: CanvasRenderingContext2D, px: number, py: number, open: boolean): void {
  const inset = 3;
  drawCtx.save();
  if (!open) {
    drawCtx.fillStyle = "#0d1a10";
    drawCtx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  }
  drawCtx.lineWidth = 2.5;
  drawCtx.strokeStyle = open ? "#3afa7a" : "#0fff4f";
  drawCtx.shadowColor = "#0fff4f";
  drawCtx.shadowBlur = 6;
  drawCtx.strokeRect(px + inset, py + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2);
  drawCtx.shadowBlur = 0;
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;
  const r = TILE_SIZE * 0.18;
  const angle = (performance.now() / 600) * (open ? 1 : 0.3);
  drawCtx.strokeStyle = "#3afa7a";
  drawCtx.lineWidth = 2;
  drawCtx.beginPath();
  drawCtx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  drawCtx.lineTo(cx + Math.cos(angle + Math.PI) * r, cy + Math.sin(angle + Math.PI) * r);
  drawCtx.stroke();
  drawCtx.beginPath();
  drawCtx.moveTo(cx + Math.cos(angle + Math.PI / 2) * r, cy + Math.sin(angle + Math.PI / 2) * r);
  drawCtx.lineTo(cx + Math.cos(angle - Math.PI / 2) * r, cy + Math.sin(angle - Math.PI / 2) * r);
  drawCtx.stroke();
  drawCtx.restore();
}

function drawPhaserGadget(drawCtx: CanvasRenderingContext2D, px: number, py: number): void {
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;
  const baseW = TILE_SIZE * 0.78;
  const baseH = TILE_SIZE * 0.34;
  drawCtx.save();
  drawCtx.fillStyle = "#1a2030";
  drawCtx.strokeStyle = "#050a14";
  drawCtx.lineWidth = 1.5;
  drawCtx.fillRect(cx - baseW / 2, cy + 2, baseW, baseH);
  drawCtx.strokeRect(cx - baseW / 2, cy + 2, baseW, baseH);
  const buttonR = TILE_SIZE * 0.32;
  const grd = drawCtx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy - 1, buttonR);
  grd.addColorStop(0, "#9ad8ff");
  grd.addColorStop(0.6, "#3a8fcc");
  grd.addColorStop(1, "#0f3a66");
  drawCtx.fillStyle = grd;
  drawCtx.beginPath();
  drawCtx.arc(cx, cy - 1, buttonR, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.strokeStyle = "#0a1828";
  drawCtx.stroke();
  const pulse = (Math.sin(performance.now() / 220) + 1) / 2;
  drawCtx.fillStyle = `rgba(180, 230, 255, ${0.25 + pulse * 0.35})`;
  drawCtx.beginPath();
  drawCtx.arc(cx - buttonR * 0.3, cy - buttonR * 0.3, buttonR * 0.35, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
}

function drawWalkieTalkie(drawCtx: CanvasRenderingContext2D, px: number, py: number): void {
  const cx = px + TILE_SIZE / 2;
  const cy = py + TILE_SIZE / 2;
  const w = TILE_SIZE * 0.5;
  const h = TILE_SIZE * 0.78;
  drawCtx.save();
  drawCtx.fillStyle = "#1a1a1f";
  drawCtx.strokeStyle = "#0a0a0f";
  drawCtx.lineWidth = 1.5;
  drawCtx.beginPath();
  drawCtx.rect(cx - w / 2, cy - h / 2 + h * 0.18, w, h * 0.82);
  drawCtx.fill();
  drawCtx.stroke();
  const antH = h * 0.32;
  drawCtx.fillStyle = "#2a2a32";
  drawCtx.fillRect(cx - 1.5, cy - h / 2 - antH * 0.6, 3, antH);
  drawCtx.fillStyle = "#444";
  drawCtx.beginPath();
  drawCtx.arc(cx, cy - h / 2 + antH * 0.6 + 1, 2, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.fillStyle = "#8af28a";
  const screenW = w * 0.7;
  const screenH = h * 0.22;
  drawCtx.fillRect(cx - screenW / 2, cy - h * 0.05, screenW, screenH);
  drawCtx.fillStyle = "#0a0a0f";
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      drawCtx.fillRect(
        cx - screenW / 2 + 3 + col * (screenW / 3),
        cy + h * 0.22 + row * 4,
        4,
        2
      );
    }
  }
  const flashOn = (performance.now() / 500) % 2 < 1;
  if (flashOn) {
    drawCtx.fillStyle = "#ff3a3a";
    drawCtx.beginPath();
    drawCtx.arc(cx + w / 2 - 4, cy - h / 2 + 6, 2, 0, Math.PI * 2);
    drawCtx.fill();
  }
  drawCtx.restore();
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

  if (key === "e") {
    event.preventDefault();
    useActiveGadget();
    return;
  }
  if (/^[0-9]$/.test(key)) {
    event.preventDefault();
    const slot = key === "0" ? 10 : Number.parseInt(key, 10);
    if (gadgetAtSlot(slot)) {
      setActiveSlot(slot);
      statusEl.textContent = `Slot ${slot} active.`;
    }
    return;
  }

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

  awardBeatCredit(OUMG_GAME_ID);
  loadLevel(0);
  statusEl.textContent = "Maze conquered. Check the Mods & DLCs hub.";
});

window.addEventListener("keydown", handleKeydown, { passive: false });
setupTouchControls();

const mazeXAudio = new Audio(mazeXAudioSrc);
mazeXAudio.preload = "auto";
mazeXAudio.volume = 0.95;

const mazeXOverlay = document.getElementById("maze-x-overlay") as HTMLDivElement;
const mazeXSubtitleEl = document.getElementById("maze-x-subtitle") as HTMLParagraphElement;
const mazeXCloseBtn = document.getElementById("maze-x-close-btn") as HTMLButtonElement;

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

const MAZE_X_SUBTITLES: SubtitleCue[] = [
  { start: 0.0, end: 4.4, text: "The temperature is dropping..." },
  { start: 4.4, end: 8.9, text: "Warning signs are appearing on the reactor screen." },
  { start: 8.9, end: 12.4, text: "Please... send help." },
  { start: 12.4, end: 15.8, text: "It's coming. I can feel it." },
  { start: 15.8, end: 21.0, text: "...guide... help me..." },
  { start: 21.0, end: 27.0, text: "I've been here all this time." },
  { start: 27.0, end: 32.5, text: "Take your shape." },
  { start: 32.5, end: 38.5, text: "You locked it up here." },
];

const ROTATION_SUBTITLES: SubtitleCue[] = [
  { start: 0.0, end: 3.6, text: "Ah... you found Rotation." },
  { start: 3.6, end: 8.5, text: "I remember making this for my client." },
  { start: 8.5, end: 13.5, text: "Well, now that it has gotten me, it doesn't really matter anymore." },
  { start: 13.5, end: 17.5, text: "And, well, anyway —" },
  { start: 17.5, end: 22.0, text: "Click E and press one of the buttons." },
  { start: 22.0, end: 27.5, text: "The platforms with green outline. Place it on one." },
  { start: 27.5, end: 31.0, text: "It doesn't even matter anymore." },
  { start: 31.0, end: 34.0, text: "It shouldn't be." },
  { start: 34.0, end: 37.0, text: "It came here." },
  { start: 37.0, end: 41.0, text: "It's gonna get you too." },
];

const rotationAudio = new Audio(mazeXRotationAudioSrc);
rotationAudio.preload = "auto";
rotationAudio.volume = 0.95;

const elsaAudio = new Audio(mazeXElsaAudioSrc);
elsaAudio.preload = "auto";
elsaAudio.volume = 0.95;

const ELSA_SUBTITLES: SubtitleCue[] = [
  { start: 0.0, end: 1.4, text: "ELSA." },
  { start: 1.4, end: 2.7, text: "ELSA." },
  { start: 2.7, end: 4.0, text: "ELSA." },
  { start: 4.0, end: 5.3, text: "ELSA." },
  { start: 5.3, end: 6.6, text: "ELSA." },
  { start: 6.6, end: 8.5, text: "ELSA." },
];

const hookshotAudio = new Audio(mazeXHookshotAudioSrc);
hookshotAudio.preload = "auto";
hookshotAudio.volume = 0.95;

const HOOKSHOT_SUBTITLES: SubtitleCue[] = [
  { start: 0.0, end: 1.7, text: "You're still here. Good." },
  { start: 1.7, end: 3.6, text: "This one's called Hookshot." },
  { start: 3.6, end: 4.7, text: "Press E." },
  { start: 4.7, end: 5.9, text: "It pulls." },
  { start: 5.9, end: 7.2, text: "It doesn't ask." },
  { start: 7.2, end: 8.2, text: "It just goes." },
  { start: 8.2, end: 9.5, text: "Try to stop it." },
];

const endingAudio = new Audio(mazeXEndingAudioSrc);
endingAudio.preload = "auto";
endingAudio.volume = 0.95;

const ENDING_SUBTITLES: SubtitleCue[] = [
  { start: 0.0, end: 1.3, text: "Great Yo-o-ou f-f-found m-me" },
  { start: 1.3, end: 4.6, text: "but-t-t-t i-i-ll t-tell you s-somet-t-hing" },
  { start: 4.6, end: 8.6, text: "I W-AS @1 @11 @10NG" },
  { start: 8.6, end: 10.0, text: "hey whats that.." },
  { start: 10.0, end: 11.4, text: "IS THAT A GUN!?!?" },
  { start: 11.4, end: 12.5, text: "*POW!" },
];

let activeTransmissionCues: SubtitleCue[] = MAZE_X_SUBTITLES;
let activeTransmissionAudio: HTMLAudioElement | null = null;
let pendingAwardOnClose: "rotatron" | "mr-snapper" | "hookshot" | "ending" | null = null;

const TRANSMISSION_PLAYERS: Record<string, () => void> = {
  rotation: () => playRotationTransmission(),
  elsa: () => playElsaTransmission(),
  hookshot: () => playHookshotTransmission(),
  ending: () => playEndingTransmission(),
};

let subtitleRaf = 0;

const MAZE_X_SECRET_LEVEL_INDEX = -1;

function isMazeXLevel(): boolean {
  return (
    isDlcUnlocked(OUMG_MAZE_X_DLC_ID) &&
    state.levelIndex === LEVELS.length - 1 &&
    state.level?.map.id !== MAZE_X_SECRET_MAP.map.id
  );
}

function isMazeXSecretLevel(): boolean {
  return MAZE_X_SECRET_MAPS.some((m) => m.map.id === state.level?.map.id);
}

function isMazeXAcquisitionLevel(): boolean {
  return state.level?.map.id === MAZE_X_SECRET_MAP.map.id;
}

function isMazeXFinalLevel(): boolean {
  return state.level?.map.id === MAZE_X_FINAL_MAP_ID;
}

function loadMazeXSecret(index = 0): void {
  const map = MAZE_X_SECRET_MAPS[index];
  if (!map) return;
  stopMazeXTransmission();
  rotorOpenById.clear();
  breakableBrokenById.clear();
  state.level = map;
  state.levelIndex = MAZE_X_SECRET_LEVEL_INDEX;
  state.player = { ...map.map.markers.start };
  state.won = false;
  state.rotationQuarter = 0;
  state.controlsReversed = false;
  state.playerCrossingAxis = null;
  state.playerHiddenUnderBridge = false;
  state.portalLock = null;
  state.wellOpenUntil = {};
  stopWellTicker();

  const sceneWidth = map.cols * TILE_SIZE;
  const sceneHeight = map.rows * TILE_SIZE;
  const stageSize = Math.max(sceneWidth, sceneHeight);
  sceneCanvas.width = sceneWidth;
  sceneCanvas.height = sceneHeight;
  canvas.width = stageSize;
  canvas.height = stageSize;

  levelNameEl.textContent = map.map.name;
  subtitleEl.textContent = map.map.name;
  statusEl.textContent = index === 0 ? "...where am I?" : "Use the gadget. (E)";
  hideCompletionOverlay();
  hideLevelSelector();
  hideStartMenu();
  updatePlayerVisibility();
  updateGadgetHud();
  draw();
}

function updateSubtitle(): void {
  const audio = activeTransmissionAudio ?? mazeXAudio;
  const t = audio.currentTime;
  const cue = activeTransmissionCues.find((c) => t >= c.start && t < c.end);
  mazeXSubtitleEl.textContent = cue ? cue.text : "";
  if (!audio.paused && !audio.ended) {
    subtitleRaf = window.requestAnimationFrame(updateSubtitle);
  }
}

function playTransmission(audio: HTMLAudioElement, cues: SubtitleCue[]): void {
  activeTransmissionAudio = audio;
  activeTransmissionCues = cues;
  mazeXOverlay.classList.add("is-visible");
  mazeXOverlay.setAttribute("aria-hidden", "false");
  mazeXSubtitleEl.textContent = "";
  try {
    audio.currentTime = 0;
    void audio.play();
  } catch {
    // ignore
  }
  if (subtitleRaf) window.cancelAnimationFrame(subtitleRaf);
  subtitleRaf = window.requestAnimationFrame(updateSubtitle);
}

function playMazeXTransmission(): void {
  playTransmission(mazeXAudio, MAZE_X_SUBTITLES);
}

function playRotationTransmission(): void {
  transmissionsPlayed.add("rotation");
  pendingAwardOnClose = "rotatron";
  playTransmission(rotationAudio, ROTATION_SUBTITLES);
}

function playElsaTransmission(): void {
  transmissionsPlayed.add("elsa");
  pendingAwardOnClose = "mr-snapper";
  playTransmission(elsaAudio, ELSA_SUBTITLES);
}

function playHookshotTransmission(): void {
  transmissionsPlayed.add("hookshot");
  pendingAwardOnClose = "hookshot";
  playTransmission(hookshotAudio, HOOKSHOT_SUBTITLES);
}

function playEndingTransmission(): void {
  transmissionsPlayed.add("ending");
  pendingAwardOnClose = "ending";
  playTransmission(endingAudio, ENDING_SUBTITLES);
}

function stopMazeXTransmission(): void {
  mazeXAudio.pause();
  mazeXAudio.currentTime = 0;
  rotationAudio.pause();
  rotationAudio.currentTime = 0;
  elsaAudio.pause();
  elsaAudio.currentTime = 0;
  hookshotAudio.pause();
  hookshotAudio.currentTime = 0;
  endingAudio.pause();
  endingAudio.currentTime = 0;
  mazeXOverlay.classList.remove("is-visible");
  mazeXOverlay.setAttribute("aria-hidden", "true");
  if (subtitleRaf) {
    window.cancelAnimationFrame(subtitleRaf);
    subtitleRaf = 0;
  }
  mazeXSubtitleEl.textContent = "";
  activeTransmissionAudio = null;
}

const MAZE_X_SECRET_PENDING_KEY = "oumg-maze-x-secret-pending";
const WALL_PHASER_KEY = "oumg-wall-phaser-acquired";

const crashOverlay = document.getElementById("maze-x-crash") as HTMLDivElement;
const wallPhaserOverlay = document.getElementById("wall-phaser-overlay") as HTMLDivElement;
const wallPhaserCloseBtn = document.getElementById("wall-phaser-close") as HTMLButtonElement;

function triggerMazeXCrashSequence(): void {
  stopMazeXTransmission();
  document.body.classList.add("maze-x-glitching");
  window.setTimeout(() => {
    crashOverlay.classList.add("is-visible");
    crashOverlay.setAttribute("aria-hidden", "false");
  }, 1500);
  window.setTimeout(() => {
    try {
      localStorage.setItem(MAZE_X_SECRET_PENDING_KEY, "true");
    } catch {
      // ignore
    }
    window.location.reload();
  }, 3200);
}

mazeXCloseBtn.addEventListener("click", () => {
  if (pendingAwardOnClose === "rotatron") {
    pendingAwardOnClose = null;
    stopMazeXTransmission();
    awardGadget("rotatron");
    statusEl.textContent = "Rotatron acquired. Press 2 then E.";
    return;
  }
  if (pendingAwardOnClose === "mr-snapper") {
    pendingAwardOnClose = null;
    stopMazeXTransmission();
    awardGadget("mr-snapper");
    statusEl.textContent = "Mr. Snapper acquired. Press 3 then E next to a cracked wall.";
    return;
  }
  if (pendingAwardOnClose === "hookshot") {
    pendingAwardOnClose = null;
    stopMazeXTransmission();
    awardGadget("hookshot");
    statusEl.textContent = "Hookshot acquired. Press 4 then E to slide.";
    return;
  }
  if (pendingAwardOnClose === "ending") {
    pendingAwardOnClose = null;
    stopMazeXTransmission();
    showFinalEndScreen();
    return;
  }
  triggerMazeXCrashSequence();
});

function showFinalEndScreen(): void {
  const overlay = document.createElement("div");
  overlay.className = "mazex-end-screen";
  overlay.id = "mazex-end-screen";
  overlay.innerHTML = `
    <div class="mazex-end-card">
      <p class="mazex-end-kicker">— END OF SIGNAL —</p>
      <p class="mazex-end-line">The walkie-talkie goes silent.</p>
      <p class="mazex-end-line mazex-end-faint">No more transmissions.</p>
      <p class="mazex-end-line mazex-end-faint">No more maps.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("mazex-ended");
  state.won = true;
  window.setTimeout(() => startBossFight(), 10000);
}

// =====================
// BOSS FIGHT
// =====================

const BOSS_GRID_COLS = 12;
const BOSS_GRID_ROWS = 6;
const BOSS_ATTACK_DURATION_MS = 8000;
const BOSS_CHECKER_CYCLE_MS = 1800;
const BOSS_CHECKER_WARNING_MS = 1100;
const BOSS_CHECKER_ACTIVE_MS = 500;

let bossCanvas: HTMLCanvasElement | null = null;
let bossCtx: CanvasRenderingContext2D | null = null;
let bossActive = false;
let bossRaf = 0;
let bossStartTime = 0;
let bossPlayerX = Math.floor(BOSS_GRID_COLS / 2);
let bossPlayerY = BOSS_GRID_ROWS - 1;
let bossDead = false;
let bossDeathOverlay: HTMLDivElement | null = null;

const BOSS_MAX_HP = 3;
const GUN_COOLDOWN_MS = 60000;
let bossHp = BOSS_MAX_HP;
let bossGunCooldownEnd = 0;
let bossDefeated = false;
let bossLastShotTime = -Infinity;
let bossHitFlashTime = -Infinity;
let bossDefeatedAt = 0;
let bossPlayerPxX = 0;
let bossPlayerPxY = 0;
let bossRobotPxX = 0;
let bossRobotPxY = 0;
let bossVictoryOverlay: HTMLDivElement | null = null;

function startBossFight(): void {
  if (bossActive) return;
  const endScreen = document.getElementById("mazex-end-screen");
  if (endScreen) endScreen.remove();
  document.body.classList.remove("mazex-ended");
  document.body.classList.add("mazex-boss");

  bossCanvas = document.createElement("canvas");
  bossCanvas.className = "mazex-boss-canvas";
  document.body.appendChild(bossCanvas);
  bossCtx = bossCanvas.getContext("2d");
  resizeBossCanvas();
  window.addEventListener("resize", resizeBossCanvas);

  bossActive = true;
  bossDead = false;
  bossDefeated = false;
  bossHp = BOSS_MAX_HP;
  bossGunCooldownEnd = 0;
  bossLastShotTime = -Infinity;
  bossHitFlashTime = -Infinity;
  bossPlayerX = Math.floor(BOSS_GRID_COLS / 2);
  bossPlayerY = BOSS_GRID_ROWS - 1;
  bossStartTime = performance.now();

  awardGadget("gun");
  setActiveSlot(5);

  window.addEventListener("keydown", handleBossKey, { passive: false });
  bossRaf = window.requestAnimationFrame(loopBossFight);
}

function resizeBossCanvas(): void {
  if (!bossCanvas) return;
  bossCanvas.width = window.innerWidth;
  bossCanvas.height = window.innerHeight;
}

function handleBossKey(e: KeyboardEvent): void {
  if (!bossActive || bossDead) return;
  const k = e.key.toLowerCase();
  if (k === "arrowleft" || k === "a") {
    bossPlayerX = Math.max(0, bossPlayerX - 1);
    e.preventDefault();
  } else if (k === "arrowright" || k === "d") {
    bossPlayerX = Math.min(BOSS_GRID_COLS - 1, bossPlayerX + 1);
    e.preventDefault();
  } else if (k === "arrowup" || k === "w") {
    bossPlayerY = Math.max(0, bossPlayerY - 1);
    e.preventDefault();
  } else if (k === "arrowdown" || k === "s") {
    bossPlayerY = Math.min(BOSS_GRID_ROWS - 1, bossPlayerY + 1);
    e.preventDefault();
  }
}

function loopBossFight(now: number): void {
  if (!bossActive || !bossCtx || !bossCanvas) return;
  const elapsed = now - bossStartTime;
  const w = bossCanvas.width;
  const h = bossCanvas.height;
  bossCtx.fillStyle = "#05060a";
  bossCtx.fillRect(0, 0, w, h);

  bossRobotPxX = w / 2;
  bossRobotPxY = h * 0.25;
  drawBossRobot(bossCtx, bossRobotPxX, bossRobotPxY, Math.min(w, h) * 0.35, elapsed);
  drawBossHpBar(bossCtx, w, h);

  const gridY = h * 0.55;
  const gridH = h * 0.4;
  const gridW = Math.min(w * 0.85, gridH * (BOSS_GRID_COLS / BOSS_GRID_ROWS));
  const gridX = (w - gridW) / 2;
  const tileW = gridW / BOSS_GRID_COLS;
  const tileH = gridH / BOSS_GRID_ROWS;

  const attackIndex = Math.floor(elapsed / BOSS_ATTACK_DURATION_MS) % 2;
  const attackKind = attackIndex === 0 ? "checkered" : "spiral";

  const danger = computeDanger(attackKind, elapsed);

  for (let gy = 0; gy < BOSS_GRID_ROWS; gy++) {
    for (let gx = 0; gx < BOSS_GRID_COLS; gx++) {
      const d = danger[gy * BOSS_GRID_COLS + gx];
      const tx = gridX + gx * tileW;
      const ty = gridY + gy * tileH;
      let fill = "#101422";
      if (d === "warning") fill = "rgba(180, 60, 60, 0.55)";
      else if (d === "active") fill = "#c83030";
      bossCtx.fillStyle = fill;
      bossCtx.fillRect(tx + 1, ty + 1, tileW - 2, tileH - 2);
      bossCtx.strokeStyle = "rgba(120, 160, 220, 0.18)";
      bossCtx.lineWidth = 1;
      bossCtx.strokeRect(tx + 0.5, ty + 0.5, tileW - 1, tileH - 1);
    }
  }

  if (attackKind === "spiral") {
    drawSpiralOverlay(bossCtx, gridX, gridY, gridW, gridH, elapsed);
  }

  // Player marker
  const pxX = gridX + bossPlayerX * tileW + tileW / 2;
  const pxY = gridY + bossPlayerY * tileH + tileH / 2;
  bossPlayerPxX = pxX;
  bossPlayerPxY = pxY;
  bossCtx.save();
  bossCtx.shadowColor = "#6cf";
  bossCtx.shadowBlur = 14;
  bossCtx.fillStyle = "#cfeeff";
  bossCtx.beginPath();
  bossCtx.arc(pxX, pxY, Math.min(tileW, tileH) * 0.28, 0, Math.PI * 2);
  bossCtx.fill();
  bossCtx.restore();

  drawBullet(bossCtx, now);
  drawGunCooldown(bossCtx, w, h, now);

  // Collision check
  const playerDanger = danger[bossPlayerY * BOSS_GRID_COLS + bossPlayerX];
  const spiralHit = attackKind === "spiral" && spiralHitsPlayer(elapsed, bossPlayerX, bossPlayerY);
  if (!bossDead && !bossDefeated && (playerDanger === "active" || spiralHit)) {
    bossDead = true;
    showBossDeath();
  }

  if (bossActive) {
    bossRaf = window.requestAnimationFrame(loopBossFight);
  }
}

function computeDanger(kind: "checkered" | "spiral", elapsed: number): ("safe" | "warning" | "active")[] {
  const out: ("safe" | "warning" | "active")[] = new Array(BOSS_GRID_COLS * BOSS_GRID_ROWS).fill("safe");
  if (kind === "checkered") {
    const cycle = Math.floor(elapsed / BOSS_CHECKER_CYCLE_MS);
    const inCycle = elapsed % BOSS_CHECKER_CYCLE_MS;
    const parity = cycle % 2;
    let phase: "warning" | "active" | "safe" = "safe";
    if (inCycle < BOSS_CHECKER_WARNING_MS) phase = "warning";
    else if (inCycle < BOSS_CHECKER_WARNING_MS + BOSS_CHECKER_ACTIVE_MS) phase = "active";
    for (let gy = 0; gy < BOSS_GRID_ROWS; gy++) {
      for (let gx = 0; gx < BOSS_GRID_COLS; gx++) {
        if ((gx + gy) % 2 === parity) {
          out[gy * BOSS_GRID_COLS + gx] = phase;
        }
      }
    }
  }
  return out;
}

const SPIRAL_HIT_THRESHOLD = 0.22;
const SPIRAL_VISUAL_THRESHOLD = 0.26;

function spiralHitsPlayer(elapsed: number, gx: number, gy: number): boolean {
  return spiralBandValue(elapsed, gx + 0.5, gy + 0.5) < SPIRAL_HIT_THRESHOLD;
}

function spiralBandValue(elapsed: number, gx: number, gy: number): number {
  const cx = BOSS_GRID_COLS / 2;
  const cy = BOSS_GRID_ROWS / 2;
  const dx = gx - cx;
  const dy = gy - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  const a = Math.atan2(dy, dx);
  const k = 0.9;
  const phase = (elapsed / 950) % (Math.PI * 2);
  const arms = 2;
  const m = ((a * arms - k * r * arms + phase * arms) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.min(m, Math.PI * 2 - m);
}

function drawSpiralOverlay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, elapsed: number): void {
  const tileW = w / BOSS_GRID_COLS;
  const tileH = h / BOSS_GRID_ROWS;
  for (let py = 0; py < h; py += 4) {
    for (let px = 0; px < w; px += 4) {
      const gx = px / tileW;
      const gy = py / tileH;
      const v = spiralBandValue(elapsed, gx, gy);
      if (v < SPIRAL_VISUAL_THRESHOLD) {
        const t = 1 - v / SPIRAL_VISUAL_THRESHOLD;
        ctx.fillStyle = `rgba(240, 80, 130, ${(0.18 + t * 0.55).toFixed(3)})`;
        ctx.fillRect(x + px, y + py, 4, 4);
      }
    }
  }
}

function drawBossRobot(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number): void {
  const now = performance.now();
  const sinceHit = now - bossHitFlashTime;
  const shake = sinceHit < 350 ? Math.sin(sinceHit / 30) * (1 - sinceHit / 350) * 14 : 0;
  const flash = sinceHit < 220 ? 1 - sinceHit / 220 : 0;
  const sinceDefeat = bossDefeated ? now - bossDefeatedAt : 0;
  const tilt = bossDefeated ? Math.min(1, sinceDefeat / 1200) * 0.6 : 0;
  const drop = bossDefeated ? Math.min(1, sinceDefeat / 1500) ** 2 * 80 : 0;
  ctx.save();
  // subtle bobble
  const bob = bossDefeated ? 0 : Math.sin(t / 600) * 4;
  ctx.translate(cx + shake, cy + bob + drop);
  ctx.rotate(tilt);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.5, size * 0.4, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  const bodyW = size * 0.7;
  const bodyH = size * 0.55;
  ctx.fillStyle = "#5a6068";
  ctx.fillRect(-bodyW / 2, -bodyH * 0.2, bodyW, bodyH);
  ctx.strokeStyle = "#1a1d22";
  ctx.lineWidth = 3;
  ctx.strokeRect(-bodyW / 2, -bodyH * 0.2, bodyW, bodyH);

  // panel lines
  ctx.strokeStyle = "rgba(20, 22, 28, 0.6)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const ly = -bodyH * 0.2 + (bodyH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, ly);
    ctx.lineTo(bodyW / 2, ly);
    ctx.stroke();
  }

  // shoulders
  ctx.fillStyle = "#3a3f47";
  ctx.fillRect(-bodyW / 2 - size * 0.1, -bodyH * 0.15, size * 0.1, size * 0.25);
  ctx.fillRect(bodyW / 2, -bodyH * 0.15, size * 0.1, size * 0.25);

  // head
  const headW = size * 0.45;
  const headH = size * 0.35;
  ctx.fillStyle = "#6a7078";
  ctx.fillRect(-headW / 2, -bodyH * 0.2 - headH, headW, headH);
  ctx.strokeStyle = "#1a1d22";
  ctx.lineWidth = 3;
  ctx.strokeRect(-headW / 2, -bodyH * 0.2 - headH, headW, headH);

  // antenna
  ctx.strokeStyle = "#1a1d22";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -bodyH * 0.2 - headH);
  ctx.lineTo(0, -bodyH * 0.2 - headH - size * 0.12);
  ctx.stroke();
  ctx.fillStyle = "#ff3a3a";
  ctx.beginPath();
  ctx.arc(0, -bodyH * 0.2 - headH - size * 0.12, 3, 0, Math.PI * 2);
  ctx.fill();

  // working eye
  const flicker = ((t / 80) % 7 < 1) ? 0.4 : 1;
  ctx.fillStyle = `rgba(255, 58, 58, ${flicker})`;
  ctx.fillRect(-headW * 0.3, -bodyH * 0.2 - headH * 0.7, headW * 0.18, headH * 0.12);

  // dead eye (X)
  const eyeX = headW * 0.2;
  const eyeY = -bodyH * 0.2 - headH * 0.65;
  ctx.strokeStyle = "#1a1d22";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(eyeX - 6, eyeY - 6);
  ctx.lineTo(eyeX + 6, eyeY + 6);
  ctx.moveTo(eyeX + 6, eyeY - 6);
  ctx.lineTo(eyeX - 6, eyeY + 6);
  ctx.stroke();

  // bullet hole on torso
  const holeX = -bodyW * 0.12;
  const holeY = bodyH * 0.08;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(holeX, holeY, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.sin(t / 1000 + i) * 0.1;
    ctx.beginPath();
    ctx.moveTo(holeX, holeY);
    ctx.lineTo(holeX + Math.cos(a) * size * 0.13, holeY + Math.sin(a) * size * 0.13);
    ctx.stroke();
  }
  // spark drips
  ctx.fillStyle = `rgba(255, 200, 60, ${0.5 + Math.sin(t / 200) * 0.4})`;
  ctx.beginPath();
  ctx.arc(holeX + 1, holeY + 6, 1.5, 0, Math.PI * 2);
  ctx.fill();

  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(flash * 0.7).toFixed(3)})`;
    ctx.fillRect(-bodyW / 2 - size * 0.15, -bodyH * 0.2 - headH - size * 0.15, bodyW + size * 0.3, bodyH + headH + size * 0.3);
  }

  ctx.restore();
}

function drawBossHpBar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const barW = Math.min(420, w * 0.6);
  const barH = 16;
  const x = (w - barW) / 2;
  const y = 24;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(x - 4, y - 4, barW + 8, barH + 8);
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(x, y, barW, barH);
  const pct = bossHp / BOSS_MAX_HP;
  ctx.fillStyle = pct > 0.5 ? "#ff8080" : pct > 0 ? "#ff3a3a" : "#660000";
  ctx.fillRect(x, y, barW * pct, barH);
  ctx.strokeStyle = "#0a0a10";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);
  ctx.fillStyle = "#cfeeff";
  ctx.font = "12px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`ROBOT  ${bossHp} / ${BOSS_MAX_HP}`, w / 2, y - 8);
  ctx.restore();
}

function drawGunCooldown(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
  const cdRemainingMs = Math.max(0, bossGunCooldownEnd - now);
  const cdPct = 1 - cdRemainingMs / GUN_COOLDOWN_MS;
  const barW = 220;
  const barH = 12;
  const x = w - barW - 28;
  const y = h - 36;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x - 4, y - 18, barW + 8, barH + 24);
  ctx.fillStyle = "#cfeeff";
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  const label = cdRemainingMs > 0 ? `GUN  ${Math.ceil(cdRemainingMs / 1000)}s` : "GUN  READY — press E";
  ctx.fillText(label, x, y - 4);
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = cdRemainingMs > 0 ? "#6cf" : "#7af09a";
  ctx.fillRect(x, y, barW * cdPct, barH);
  ctx.strokeStyle = "#0a0a10";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, barW, barH);
  ctx.restore();
}

function drawBullet(ctx: CanvasRenderingContext2D, now: number): void {
  const sinceShot = now - bossLastShotTime;
  if (sinceShot < 0 || sinceShot > 260) return;
  const t = Math.min(1, sinceShot / 220);
  const x = bossPlayerPxX + (bossRobotPxX - bossPlayerPxX) * t;
  const y = bossPlayerPxY + (bossRobotPxY - bossPlayerPxY) * t;
  ctx.save();
  ctx.shadowColor = "#ffe080";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#fff8b0";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  // trail
  ctx.strokeStyle = "rgba(255, 240, 160, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bossPlayerPxX, bossPlayerPxY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
}

function showBossVictoryScreen(): void {
  if (bossVictoryOverlay) return;
  bossVictoryOverlay = document.createElement("div");
  bossVictoryOverlay.className = "mazex-boss-victory";
  bossVictoryOverlay.innerHTML = `
    <div class="mazex-boss-victory-card">
      <p class="mazex-boss-victory-kicker">— ROBOT TERMINATED —</p>
      <p class="mazex-boss-victory-title">YOU WIN</p>
      <p class="mazex-boss-victory-flavor">The signal goes quiet. For real this time.</p>
    </div>
  `;
  document.body.appendChild(bossVictoryOverlay);
}

function showBossDeath(): void {
  if (bossDeathOverlay) return;
  bossDeathOverlay = document.createElement("div");
  bossDeathOverlay.className = "mazex-boss-death";
  bossDeathOverlay.innerHTML = `
    <div class="mazex-boss-death-card">
      <p class="mazex-boss-death-title">YOU DIED</p>
      <button id="mazex-boss-retry" type="button" class="mazex-boss-retry-btn">RETRY</button>
    </div>
  `;
  document.body.appendChild(bossDeathOverlay);
  const retryBtn = document.getElementById("mazex-boss-retry");
  retryBtn?.addEventListener("click", () => {
    bossDeathOverlay?.remove();
    bossDeathOverlay = null;
    bossDead = false;
    bossPlayerX = Math.floor(BOSS_GRID_COLS / 2);
    bossPlayerY = BOSS_GRID_ROWS - 1;
    bossStartTime = performance.now();
  });
}

function acquireWallPhaser(): void {
  statusEl.textContent = "ZZT — PHASE!";
  state.player = { x: state.player.x, y: Math.max(0, state.player.y - 3) };
  draw();
  window.setTimeout(() => {
    try {
      localStorage.setItem(WALL_PHASER_KEY, "true");
    } catch {
      // ignore
    }
    wallPhaserOverlay.classList.add("is-visible");
    wallPhaserOverlay.setAttribute("aria-hidden", "false");
  }, 400);
}

wallPhaserCloseBtn.addEventListener("click", () => {
  wallPhaserOverlay.classList.remove("is-visible");
  wallPhaserOverlay.setAttribute("aria-hidden", "true");
  awardGadget("wall-phaser");
  loadMazeXSecretByIndex(1);
});

interface GadgetDef {
  id: string;
  name: string;
  slot: number;
  hint: string;
  use: () => void;
}

const GADGETS: Record<string, GadgetDef> = {
  "wall-phaser": {
    id: "wall-phaser",
    name: "Wall Phaser",
    slot: 1,
    hint: "Press E to phase 3 tiles forward.",
    use: useWallPhaser,
  },
  rotatron: {
    id: "rotatron",
    name: "Rotatron",
    slot: 2,
    hint: "Press E to rotate a green platform (≤3 tiles away).",
    use: useRotatron,
  },
  "mr-snapper": {
    id: "mr-snapper",
    name: "Mr. Snapper",
    slot: 3,
    hint: "Press E to snap an adjacent cracked wall.",
    use: useMrSnapper,
  },
  hookshot: {
    id: "hookshot",
    name: "Hookshot",
    slot: 4,
    hint: "Press E to slide until you hit something.",
    use: useHookshot,
  },
  gun: {
    id: "gun",
    name: "Gun",
    slot: 5,
    hint: "Press E to fire. 60s cooldown.",
    use: useGun,
  },
};

const rotorOpenById = new Map<string, boolean>();
const transmissionsPlayed = new Set<string>();

function currentRotors() {
  if (!state.level) return [] as { id: string; x: number; y: number }[];
  return MAZE_X_ROTORS[state.level.map.id] ?? [];
}

function currentWalkies() {
  if (!state.level) return [] as { id: string; x: number; y: number; transmissionId: string }[];
  return MAZE_X_WALKIES[state.level.map.id] ?? [];
}

function rotorAt(x: number, y: number) {
  return currentRotors().find((r) => r.x === x && r.y === y);
}

function walkieAt(x: number, y: number) {
  return currentWalkies().find((w) => w.x === x && w.y === y);
}

function isRotorOpen(id: string): boolean {
  return rotorOpenById.get(id) === true;
}

function toggleRotor(id: string): boolean {
  const next = !isRotorOpen(id);
  rotorOpenById.set(id, next);
  return next;
}

function hasTransmissionPlayed(id: string): boolean {
  return transmissionsPlayed.has(id);
}

function useRotatron(): void {
  if (!state.level) return;
  const rotors = currentRotors();
  let nearest: { id: string; x: number; y: number } | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;
  for (const r of rotors) {
    const d = Math.abs(r.x - state.player.x) + Math.abs(r.y - state.player.y);
    if (d <= 3 && d < nearestDist) {
      nearest = r;
      nearestDist = d;
    }
  }
  if (!nearest) {
    statusEl.textContent = "No green platforms in range.";
    return;
  }
  const opened = toggleRotor(nearest.id);
  statusEl.textContent = opened ? "Rotatron clicks. Platform rotated." : "Platform rotated shut.";
  draw();
}

const breakableBrokenById = new Set<string>();

function currentBreakables() {
  if (!state.level) return [] as { id: string; x: number; y: number }[];
  return MAZE_X_BREAKABLES[state.level.map.id] ?? [];
}

function breakableAt(x: number, y: number) {
  return currentBreakables().find((b) => b.x === x && b.y === y);
}

function isBreakableBroken(id: string): boolean {
  return breakableBrokenById.has(id);
}

function breakBreakable(id: string): void {
  breakableBrokenById.add(id);
}

function useHookshot(): void {
  if (!state.level) return;
  const [dx, dy] = lastMoveDelta;
  if (dx === 0 && dy === 0) return;
  let x = state.player.x;
  let y = state.player.y;
  while (true) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= state.level.cols || ny >= state.level.rows) break;
    if (!isWalkable(nx, ny)) break;
    x = nx;
    y = ny;
  }
  if (x === state.player.x && y === state.player.y) {
    statusEl.textContent = "Hookshot found nothing to grab.";
    return;
  }
  state.player = { x, y };
  statusEl.textContent = "TWANG! Hookshot reels you in.";
  updatePlayerVisibility();
  if (state.level && samePoint(state.player, state.level.map.markers.exit)) {
    state.won = true;
    if (isMazeXSecretLevel()) onMazeXSecretBeaten();
  }
  draw();
}

function useGun(): void {
  if (!bossActive) {
    statusEl.textContent = "The gun is empty in your hands.";
    return;
  }
  if (bossDead || bossDefeated) return;
  const now = performance.now();
  if (now < bossGunCooldownEnd) return;
  bossGunCooldownEnd = now + GUN_COOLDOWN_MS;
  bossLastShotTime = now;
  bossHitFlashTime = now;
  bossHp = Math.max(0, bossHp - 1);
  if (bossHp <= 0) {
    bossDefeated = true;
    bossDefeatedAt = now;
    window.setTimeout(() => showBossVictoryScreen(), 1800);
  }
}

function useMrSnapper(): void {
  if (!state.level) return;
  const offsets: [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const [ox, oy] of offsets) {
    const tx = state.player.x + ox;
    const ty = state.player.y + oy;
    const b = breakableAt(tx, ty);
    if (b && !isBreakableBroken(b.id)) {
      breakBreakable(b.id);
      statusEl.textContent = "SNAP! Wall shattered.";
      draw();
      return;
    }
  }
  statusEl.textContent = "Nothing for Mr. Snapper to break.";
}

const OWNED_GADGETS_KEY = "oumg-mazex-owned-gadgets";
const ACTIVE_SLOT_KEY = "oumg-mazex-active-slot";
const NEXT_MAZE_X_INDEX_KEY = "oumg-mazex-next-index";
const gadgetHudEl = document.getElementById("gadget-hud") as HTMLParagraphElement;

function ownedGadgetIds(): string[] {
  try {
    const raw = localStorage.getItem(OWNED_GADGETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function awardGadget(id: string): void {
  const owned = new Set(ownedGadgetIds());
  if (owned.has(id)) return;
  owned.add(id);
  try {
    localStorage.setItem(OWNED_GADGETS_KEY, JSON.stringify([...owned]));
  } catch {
    // ignore
  }
  const def = GADGETS[id];
  if (def) setActiveSlot(def.slot);
  updateGadgetHud();
}

function activeSlot(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = raw === null ? 1 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1;
  } catch {
    return 1;
  }
}

function setActiveSlot(slot: number): void {
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch {
    // ignore
  }
  updateGadgetHud();
}

function gadgetAtSlot(slot: number): GadgetDef | null {
  const owned = new Set(ownedGadgetIds());
  for (const id of owned) {
    const def = GADGETS[id];
    if (def && def.slot === slot) return def;
  }
  return null;
}

function updateGadgetHud(): void {
  const owned = ownedGadgetIds();
  if (owned.length === 0) {
    gadgetHudEl.classList.add("hidden");
    return;
  }
  gadgetHudEl.classList.remove("hidden");
  const slot = activeSlot();
  const def = gadgetAtSlot(slot);
  if (def) {
    gadgetHudEl.innerHTML = `<span class="gadget-hud-slot">[${def.slot}] E</span>${def.name} — ${def.hint}`;
  } else {
    gadgetHudEl.innerHTML = `<span class="gadget-hud-slot">[${slot}]</span>(empty slot)`;
  }
}

function useActiveGadget(): void {
  const def = gadgetAtSlot(activeSlot());
  if (def) def.use();
}

function useWallPhaser(): void {
  if (!state.level) return;
  const [dx, dy] = lastMoveDelta;
  if (dx === 0 && dy === 0) return;
  const nx = Math.min(state.level.cols - 1, Math.max(0, state.player.x + dx * 3));
  const ny = Math.min(state.level.rows - 1, Math.max(0, state.player.y + dy * 3));
  state.player = { x: nx, y: ny };
  statusEl.textContent = "ZZT — phased.";
  updatePlayerVisibility();

  if (state.level && samePoint(state.player, state.level.map.markers.exit)) {
    state.won = true;
    if (isMazeXSecretLevel()) {
      onMazeXSecretBeaten();
    }
  }

  draw();
}

function loadMazeXSecretByIndex(index: number): void {
  if (index < 0 || index >= MAZE_X_SECRET_MAPS.length) {
    showMazeXEndOfContent();
    return;
  }
  try {
    localStorage.setItem(NEXT_MAZE_X_INDEX_KEY, String(index));
  } catch {
    // ignore
  }
  loadMazeXSecret(index);
}

function onMazeXSecretBeaten(): void {
  const current = (() => {
    try {
      const raw = localStorage.getItem(NEXT_MAZE_X_INDEX_KEY);
      const n = raw === null ? 0 : Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  })();
  const next = current + 1;
  if (next >= MAZE_X_SECRET_MAPS.length) {
    showMazeXEndOfContent();
    return;
  }
  loadMazeXSecretByIndex(next);
}

function showMazeXEndOfContent(): void {
  statusEl.textContent = "MAZE_X SIGNAL LOST. Use Select Level to return.";
  showCompletionOverlay();
}
function onTransmissionEnd(): void {
  if (subtitleRaf) {
    window.cancelAnimationFrame(subtitleRaf);
    subtitleRaf = 0;
  }
  mazeXSubtitleEl.textContent = "— END OF TRANSMISSION —";
}
mazeXAudio.addEventListener("ended", onTransmissionEnd);
rotationAudio.addEventListener("ended", onTransmissionEnd);
elsaAudio.addEventListener("ended", onTransmissionEnd);
hookshotAudio.addEventListener("ended", onTransmissionEnd);
endingAudio.addEventListener("ended", onTransmissionEnd);

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

let pendingMazeXSecret = false;
try {
  if (localStorage.getItem(MAZE_X_SECRET_PENDING_KEY) === "true") {
    pendingMazeXSecret = true;
    localStorage.removeItem(MAZE_X_SECRET_PENDING_KEY);
  }
} catch {
  pendingMazeXSecret = false;
}

updateGadgetHud();

if (pendingMazeXSecret) {
  loadMazeXSecret(0);
} else {
  showStartMenu();
}
