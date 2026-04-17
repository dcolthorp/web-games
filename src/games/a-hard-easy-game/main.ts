import fullyDestroyedAudioSrc from "./fully-destroyed.m4a";
import { restoreAllMissingPeopleInAllSaves } from "../a-kids-life/model/storage";
import {
  activateEscapedAhegPlayer,
  clearEscapedAhegPlayer,
  initEscapedAhegPlayer,
  isEscapedAhegPlayerActive,
} from "../../shared/escapedAhegPlayer";
import {
  AHEG_TROPHY_LOCATION_KEY,
  AKL_DELETED_FROM_HUB_KEY,
  OUMG_DELETED_FROM_HUB_KEY,
  TM_DELETED_FROM_HUB_KEY,
} from "../../shared/ahegTrophy";

interface Vector2 {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Hazard extends Rect {
  real: boolean;
  previousX?: number;
  previousY?: number;
  movement?: {
    axis: "x" | "y";
    range: number;
    speed: number;
    phase: number;
    origin: number;
  };
}

type CourseLevel = 1 | 2 | 3;

interface Course {
  id: CourseLevel;
  name: string;
  start: Vector2;
  goal: Rect;
  hazards: Hazard[];
}

interface Trophy extends Rect {
  homeX: number;
  homeY: number;
  targetLevel: 2 | 3;
}

const LINKED_REVERSE_CONTROLS_KEY = "linked-reverse-controls-curse";
const LINKED_ROTATION_CURSE_KEY = "linked-rotation-curse";
const TAMAGOTCHI_PROFILES_INDEX_KEY = "tamagotchiMonster.profiles";
const TAMAGOTCHI_PROFILE_KEY_PREFIX = "tamagotchiMonster.profile.";
const SHADOW_CLEAR_KEY = "a-hard-easy-game-shadow-cleared";
const LEVEL_TWO_UNLOCKED_KEY = "a-hard-easy-game-level-two-unlocked";
const LEVEL_THREE_UNLOCKED_KEY = "a-hard-easy-game-level-three-unlocked";
const LEVEL_THREE_TROPHY_READY_KEY = "a-hard-easy-game-level-three-trophy-ready";
const HUB_TROPHY_KEY = "a-hard-easy-game-hub-trophy";
const HUB_TROPHY_POSITION_KEY = "a-hard-easy-game-hub-trophy-position";
const OUMG_TROPHY_DROP_COUNT_KEY = "oscars-untitled-maze-game-trophy-drop-count";
const OUMG_TROPHY_DOOM_STARTED_KEY = "oscars-untitled-maze-game-trophy-doom-started";
const AKL_TROPHY_DOOM_STARTED_KEY = "a-kids-life-trophy-doom-started";
const TM_TROPHY_DOOM_STARTED_KEY = "tamagotchi-monster-trophy-doom-started";

type GameMode = "normal" | "glitching" | "secret";

interface Skull {
  x: number;
  y: number;
  radius: number;
  speed: number;
  spin: number;
  wobble: number;
  wobbleSpeed: number;
  hitsRemaining: number;
  variant: "normal" | "elite" | "escape";
}

interface ExitDrop {
  x: number;
  y: number;
  width: number;
  height: number;
  bobPhase: number;
}

const canvasElement = document.getElementById("game");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Missing game canvas");
}
const canvas: HTMLCanvasElement = canvasElement;

const contextValue = canvas.getContext("2d");
if (!(contextValue instanceof CanvasRenderingContext2D)) {
  throw new Error("Could not create 2D context");
}
const ctx: CanvasRenderingContext2D = contextValue;

const statusElement = document.getElementById("status");
if (!(statusElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing status element");
}
const statusEl: HTMLParagraphElement = statusElement;

const bestTimeElement = document.getElementById("best-time");
if (!(bestTimeElement instanceof HTMLParagraphElement)) {
  throw new Error("Missing best time element");
}
const bestTimeEl: HTMLParagraphElement = bestTimeElement;

const levelOneButton = document.getElementById("level-1-btn");
if (!(levelOneButton instanceof HTMLButtonElement)) {
  throw new Error("Missing level 1 button");
}
const level1Btn: HTMLButtonElement = levelOneButton;

const levelTwoButton = document.getElementById("level-2-btn");
if (!(levelTwoButton instanceof HTMLButtonElement)) {
  throw new Error("Missing level 2 button");
}
const level2Btn: HTMLButtonElement = levelTwoButton;

const levelThreeButton = document.getElementById("level-3-btn");
if (!(levelThreeButton instanceof HTMLButtonElement)) {
  throw new Error("Missing level 3 button");
}
const level3Btn: HTMLButtonElement = levelThreeButton;

const levelSelectorElement = document.querySelector(".level-selector");
if (!(levelSelectorElement instanceof HTMLDivElement)) {
  throw new Error("Missing level selector");
}
const levelSelectorEl: HTMLDivElement = levelSelectorElement;

const healthHudElement = document.getElementById("health-hud");
if (!(healthHudElement instanceof HTMLDivElement)) {
  throw new Error("Missing health HUD");
}
const healthHudEl: HTMLDivElement = healthHudElement;

const healthFillElement = document.getElementById("health-fill");
if (!(healthFillElement instanceof HTMLDivElement)) {
  throw new Error("Missing health fill");
}
const healthFillEl: HTMLDivElement = healthFillElement;

const healthValueElement = document.getElementById("health-value");
if (!(healthValueElement instanceof HTMLSpanElement)) {
  throw new Error("Missing health value");
}
const healthValueEl: HTMLSpanElement = healthValueElement;

const restartButton = document.getElementById("restart-btn");
if (!(restartButton instanceof HTMLButtonElement)) {
  throw new Error("Missing restart button");
}
const restartBtn: HTMLButtonElement = restartButton;

const resetAhegButton = document.getElementById("reset-aheg-btn");
if (!(resetAhegButton instanceof HTMLButtonElement)) {
  throw new Error("Missing reset AHEG button");
}
const resetAhegBtn: HTMLButtonElement = resetAhegButton;

const pageElement = document.querySelector(".page");
if (!(pageElement instanceof HTMLElement)) {
  throw new Error("Missing page element");
}
const pageEl: HTMLElement = pageElement;

const WORLD = {
  width: canvas.width,
  height: canvas.height,
};

const COURSES: Record<CourseLevel, Course> = {
  1: {
    id: 1,
    name: "Level 1",
    start: { x: 70, y: WORLD.height / 2 },
    goal: { x: WORLD.width - 130, y: WORLD.height / 2 - 80, width: 72, height: 160 },
    hazards: [
      { x: 170, y: 46, width: 28, height: 428, real: false },
      { x: 235, y: 0, width: 34, height: 220, real: false },
      { x: 235, y: 300, width: 34, height: 220, real: false },
      { x: 318, y: 70, width: 32, height: 380, real: false },
      { x: 400, y: 0, width: 32, height: 240, real: true },
      { x: 400, y: 320, width: 32, height: 200, real: false },
      { x: 492, y: 56, width: 30, height: 408, real: false },
      { x: 578, y: 0, width: 28, height: 160, real: false },
      { x: 578, y: 236, width: 28, height: 284, real: true },
      { x: 650, y: 102, width: 26, height: 330, real: false },
    ],
  },
  2: {
    id: 2,
    name: "Level 2",
    start: { x: 84, y: WORLD.height - 86 },
    goal: { x: WORLD.width - 154, y: 56, width: 88, height: 144 },
    hazards: [
      { x: 150, y: 0, width: 34, height: 208, real: true },
      { x: 150, y: 292, width: 34, height: 228, real: false },
      { x: 248, y: 96, width: 30, height: 424, real: true },
      { x: 330, y: 0, width: 26, height: 180, real: false },
      { x: 330, y: 244, width: 26, height: 276, real: true },
      { x: 426, y: 80, width: 34, height: 440, real: false },
      { x: 516, y: 0, width: 28, height: 238, real: true },
      { x: 516, y: 312, width: 28, height: 208, real: false },
      { x: 610, y: 54, width: 34, height: 466, real: true },
    ],
  },
  3: {
    id: 3,
    name: "Level 3",
    start: { x: 76, y: 74 },
    goal: { x: WORLD.width - 126, y: WORLD.height - 170, width: 76, height: 132 },
    hazards: [
      { x: 152, y: 96, width: 30, height: 350, real: true },
      { x: 245, y: 0, width: 28, height: 205, real: false },
      { x: 245, y: 292, width: 28, height: 228, real: true },
      {
        x: 340,
        y: 82,
        width: 34,
        height: 150,
        real: true,
        movement: { axis: "y", range: 124, speed: 2.6, phase: 0, origin: 82 },
      },
      {
        x: 430,
        y: 310,
        width: 120,
        height: 30,
        real: true,
        movement: { axis: "x", range: 86, speed: 2.2, phase: Math.PI * 0.7, origin: 430 },
      },
      { x: 606, y: 0, width: 30, height: 250, real: true },
      { x: 606, y: 330, width: 30, height: 190, real: false },
      {
        x: 690,
        y: 178,
        width: 30,
        height: 160,
        real: true,
        movement: { axis: "y", range: 100, speed: 3.1, phase: Math.PI * 1.15, origin: 178 },
      },
    ],
  },
};

let currentLevel: CourseLevel = readLevelThreeUnlocked() ? 3 : readLevelTwoUnlocked() ? 2 : 1;
let course: Course = COURSES[currentLevel];

const keys = new Set<string>();
const player = {
  radius: 14,
  speed: 240,
  position: { ...course.start },
};
let controlsReversed = consumeLinkedReverseControls();
let mode: GameMode = hasShadowTamagotchiProfile() ? "glitching" : "normal";
let glitchEndsAt = mode === "glitching" ? performance.now() + 1400 : 0;
let secretHealth = 100;
let secretMaxHealth = 100;
let skulls: Skull[] = [];
let skullSpawnTimer = 0;
let jumpscareEndsAt = 0;
let redirectedAfterDeath = false;
let secretModeStartedAt = 0;
let escapeSkullSpawned = false;
let exitDrop: ExitDrop | null = null;
let trophy: Trophy | null = createTrophyIfNeeded();
let draggingTrophy = false;
let trophyDragOffset: Vector2 = { x: 0, y: 0 };
let trophyPointerId: number | null = null;
let trophyDragGhost: HTMLDivElement | null = null;
let trophyFalling = false;
let trophyVelocityY = 0;
let trophyFinaleTriggered = false;
let rotationCursed = hasRotationCurse();

let startTime = performance.now();
let finished = false;
let lastFrame = performance.now();
let bestTimeMs = readBestTime();

clearEscapedAhegPlayer();
syncHudVisibility();
updateHud();
updateLevelButtons();

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

resetAhegBtn.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset AHEG? This clears your AHEG progress, best time, trophy transfer, and linked curse state."
  );
  if (!confirmed) {
    return;
  }
  resetAhegState();
});

level1Btn.addEventListener("click", () => {
  loadCourse(1);
});

level2Btn.addEventListener("click", () => {
  if (!readLevelTwoUnlocked()) {
    updateHud("Level 2 is locked. Drag the trophy to the finish first.");
    return;
  }
  loadCourse(2);
});

level3Btn.addEventListener("click", () => {
  if (!readLevelThreeUnlocked()) {
    updateHud("Level 3 is locked. Find the Level 3 trophy.");
    return;
  }
  loadCourse(3);
});

canvas.addEventListener("pointerdown", (event) => {
  if (mode !== "normal" || !trophy) {
    return;
  }

  const point = canvasPointFromEvent(event);
  if (!pointInRect(point.x, point.y, trophy)) {
    return;
  }

  draggingTrophy = true;
  trophyFalling = false;
  trophyVelocityY = 0;
  trophyPointerId = event.pointerId;
  trophyDragOffset = { x: point.x - trophy.x, y: point.y - trophy.y };
  canvas.setPointerCapture(event.pointerId);
  showTrophyDragGhost(event.clientX - trophyDragOffset.x, event.clientY - trophyDragOffset.y);
});

canvas.addEventListener("pointermove", (event) => {
  if (!draggingTrophy || !trophy || event.pointerId !== trophyPointerId) {
    return;
  }

  const point = canvasPointFromEvent(event);
  trophy.x = clamp(point.x - trophyDragOffset.x, -trophy.width - 24, WORLD.width + 24);
  trophy.y = clamp(point.y - trophyDragOffset.y, -trophy.height - 24, WORLD.height + 24);
  updateTrophyDragGhost(event.clientX - trophyDragOffset.x, event.clientY - trophyDragOffset.y);
});

window.addEventListener("pointerup", (event) => {
  if (trophyPointerId !== null && canvas.hasPointerCapture(trophyPointerId)) {
    canvas.releasePointerCapture(trophyPointerId);
  }

  if (!draggingTrophy || !trophy) {
    draggingTrophy = false;
    trophyPointerId = null;
    hideTrophyDragGhost();
    return;
  }

  const droppedOutsideBoard = droppedOutsideCanvas(event.clientX, event.clientY);
  draggingTrophy = false;
  trophyPointerId = null;
  hideTrophyDragGhost();
  if (droppedOutsideBoard || isTrophyOutOfBounds(trophy)) {
    localStorage.setItem(HUB_TROPHY_KEY, "true");
    localStorage.removeItem(HUB_TROPHY_POSITION_KEY);
    localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
    updateHud("The trophy slipped out to the hub.");
    window.location.href = new URL("../../", window.location.href).toString();
    return;
  }

  if (rectsOverlap(trophy, course.goal)) {
    if (trophy.targetLevel === 3) {
      unlockLevelThree();
      trophy = createTrophyIfNeeded();
      loadCourse(3, "Level 3 trophy delivered. Moving parts are awake.");
      return;
    }

    unlockLevelTwo();
    trophy = createTrophyIfNeeded();
    loadCourse(2, "Trophy delivered. Teleporting to Level 2.");
    return;
  }

  startTrophyFall();
});

window.addEventListener("pointercancel", () => {
  if (trophyPointerId !== null && canvas.hasPointerCapture(trophyPointerId)) {
    canvas.releasePointerCapture(trophyPointerId);
  }
  draggingTrophy = false;
  trophyPointerId = null;
  hideTrophyDragGhost();
  startTrophyFall();
});

canvas.addEventListener("click", (event) => {
  if (mode !== "secret" || secretHealth <= 0) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;

  if (exitDrop && pointInRect(clickX, clickY, exitDrop)) {
    clearShadowTamagotchiProfiles();
    markShadowClear();
    window.location.href = new URL("../../", window.location.href).toString();
    return;
  }

  skulls = skulls.filter((skull) => {
    const distance = Math.hypot(clickX - skull.x, clickY - skull.y);
    if (distance > skull.radius + 10) {
      return true;
    }

    skull.hitsRemaining -= 1;
    if (skull.hitsRemaining > 0) {
      if (skull.variant === "elite" || skull.variant === "escape") {
        updateHud(
          skull.variant === "escape"
            ? `Yellow skull hit. ${skull.hitsRemaining} hits left.`
            : `Red skull hit. ${skull.hitsRemaining} hits left.`
        );
      }
      return true;
    }

    if (skull.variant === "elite") {
      secretMaxHealth += 10;
      secretHealth = secretMaxHealth;
      updateHud("Heart drop. Full heal and max health +10.");
    } else if (skull.variant === "escape") {
      exitDrop = {
        x: skull.x - 52,
        y: skull.y - 28,
        width: 104,
        height: 56,
        bobPhase: Math.random() * Math.PI * 2,
      };
      updateHud("Exit sign dropped. Click it to escape back to localhost.");
    }

    return false;
  });
});

requestAnimationFrame(loop);

function loop(timestamp: number): void {
  const deltaSeconds = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  update(deltaSeconds);
  render(timestamp);

  requestAnimationFrame(loop);
}

function update(deltaSeconds: number): void {
  if (mode === "glitching") {
    if (performance.now() >= glitchEndsAt) {
      enterSecretLevel();
    }
    return;
  }

  if (mode === "secret") {
    updateSecretLevel(deltaSeconds);
    return;
  }

  if (isEscapedAhegPlayerActive()) {
    return;
  }

  updateMovingHazards();
  updateTrophyFall(deltaSeconds);

  if (finished) {
    return;
  }

  const movement = getInputVector();
  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const magnitude = Math.hypot(movement.x, movement.y) || 1;
  const velocityX = (movement.x / magnitude) * player.speed * deltaSeconds;
  const velocityY = (movement.y / magnitude) * player.speed * deltaSeconds;

  movePlayer(velocityX, 0);
  movePlayer(0, velocityY);

  if (intersectsGoal()) {
    finished = true;
    const elapsedMs = performance.now() - startTime;
    if (bestTimeMs === null || elapsedMs < bestTimeMs) {
      bestTimeMs = elapsedMs;
      localStorage.setItem("a-hard-easy-game-best-time", String(bestTimeMs));
      updateBestTimeLabel();
    }
    setStatus(`You won in ${formatTime(elapsedMs)}. Suspiciously manageable.`);
  }
}

function movePlayer(dx: number, dy: number): void {
  const nextX = clamp(player.position.x + dx, player.radius, WORLD.width - player.radius);
  const nextY = clamp(player.position.y + dy, player.radius, WORLD.height - player.radius);
  if (isPlayerBlockedAt(nextX, nextY)) {
    setStatus("That one was real. Rude, but still avoidable.");
    return;
  }

  player.position.x = nextX;
  player.position.y = nextY;
}

function getInputVector(): Vector2 {
  let x = 0;
  let y = 0;

  if (keys.has("arrowleft") || keys.has("a")) x -= 1;
  if (keys.has("arrowright") || keys.has("d")) x += 1;
  if (keys.has("arrowup") || keys.has("w")) y -= 1;
  if (keys.has("arrowdown") || keys.has("s")) y += 1;

  if (controlsReversed) {
    x *= -1;
    y *= -1;
  }

  return { x, y };
}

function intersectsGoal(): boolean {
  return rectsOverlap(
    {
      x: player.position.x - player.radius,
      y: player.position.y - player.radius,
      width: player.radius * 2,
      height: player.radius * 2,
    },
    course.goal
  );
}

function render(timestamp: number): void {
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);

  if (mode === "glitching") {
    drawGlitchTransition(timestamp);
    return;
  }

  if (mode === "secret") {
    drawSecretLevel(timestamp);
    return;
  }

  drawBackground(timestamp);
  drawFakeWarnings();
  drawHazards();
  drawGoal(timestamp);
  drawStart();
  drawPlayer();
  drawTrophy();
}

function drawBackground(timestamp: number): void {
  const stripeOffset = (timestamp * 0.05) % 40;
  ctx.save();
  for (let x = -40; x < WORLD.width + 40; x += 40) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(x + stripeOffset, 0, 16, WORLD.height);
  }
  ctx.restore();
}

function drawFakeWarnings(): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 107, 122, 0.16)";
  ctx.setLineDash([8, 10]);
  for (const hazard of course.hazards) {
    if (hazard.real) {
      continue;
    }
    ctx.lineWidth = 3;
    ctx.strokeRect(hazard.x - 4, hazard.y - 4, hazard.width + 8, hazard.height + 8);
  }
  ctx.restore();
}

function drawHazards(): void {
  for (const hazard of course.hazards) {
    drawHazard(hazard);
  }
}

function updateMovingHazards(): void {
  const nowSeconds = performance.now() / 1000;
  for (const hazard of course.hazards) {
    if (!hazard.movement) {
      continue;
    }

    hazard.previousX = hazard.x;
    hazard.previousY = hazard.y;
    const offset = Math.sin(nowSeconds * hazard.movement.speed + hazard.movement.phase) * hazard.movement.range;
    if (hazard.movement.axis === "x") {
      hazard.x = hazard.movement.origin + offset;
    } else {
      hazard.y = hazard.movement.origin + offset;
    }
    shovePlayerWithMovingHazard(hazard);
  }
}

function shovePlayerWithMovingHazard(hazard: Hazard): void {
  if (isEscapedAhegPlayerActive()) {
    return;
  }

  if (
    finished ||
    !rectsOverlap(
      {
        x: player.position.x - player.radius,
        y: player.position.y - player.radius,
        width: player.radius * 2,
        height: player.radius * 2,
      },
      hazard
    )
  ) {
    return;
  }

  const deltaX = hazard.x - (hazard.previousX ?? hazard.x);
  const deltaY = hazard.y - (hazard.previousY ?? hazard.y);
  const rawNextX = player.position.x + deltaX;
  const rawNextY = player.position.y + deltaY;
  if (wouldPlayerEscapePlayfield(rawNextX, rawNextY)) {
    startEscapedPlayerMode(rawNextX, rawNextY);
    return;
  }

  const nextX = clamp(player.position.x + deltaX, player.radius, WORLD.width - player.radius);
  const nextY = clamp(player.position.y + deltaY, player.radius, WORLD.height - player.radius);

  if (!isPlayerBlockedAt(nextX, nextY, hazard)) {
    player.position.x = nextX;
    player.position.y = nextY;
  }

  if (!resolvePlayerAfterHazardPush(hazard)) {
    startEscapedPlayerMode(rawNextX, rawNextY);
  }
}

function wouldPlayerEscapePlayfield(x: number, y: number): boolean {
  return (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < player.radius ||
    x > WORLD.width - player.radius ||
    y < player.radius ||
    y > WORLD.height - player.radius
  );
}

function startEscapedPlayerMode(worldX: number, worldY: number): void {
  const rect = canvas.getBoundingClientRect();
  activateEscapedAhegPlayer(
    rect.left + (worldX / WORLD.width) * rect.width,
    rect.top + (worldY / WORLD.height) * rect.height
  );
  updateHud("You got pushed out of the level. Walk over to Menu to escape.");
}

function drawGoal(timestamp: number): void {
  const pulse = 0.65 + Math.sin(timestamp * 0.006) * 0.2;

  ctx.save();
  ctx.shadowColor = `rgba(246, 211, 101, ${0.45 + pulse * 0.15})`;
  ctx.shadowBlur = 28;
  ctx.fillStyle = "#f6d365";
  ctx.fillRect(course.goal.x, course.goal.y, course.goal.width, course.goal.height);

  ctx.fillStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.18})`;
  ctx.fillRect(course.goal.x + 10, course.goal.y + 12, course.goal.width - 20, course.goal.height - 24);
  ctx.restore();

  ctx.fillStyle = "#2b1c08";
  ctx.font = "700 20px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", course.goal.x + course.goal.width / 2, course.goal.y - 16);
}

function drawStart(): void {
  ctx.fillStyle = "#6dd3ff";
  ctx.beginPath();
  ctx.arc(course.start.x, course.start.y, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f1828";
  ctx.font = "700 18px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText("GO", course.start.x, course.start.y + 6);
}

function drawPlayer(): void {
  if (isEscapedAhegPlayerActive()) {
    return;
  }

  ctx.save();
  ctx.shadowColor = "rgba(109, 211, 255, 0.5)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#6dd3ff";
  ctx.beginPath();
  ctx.arc(player.position.x, player.position.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#07111d";
  ctx.beginPath();
  ctx.arc(player.position.x, player.position.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function resetGame(): void {
  if (mode === "secret" || mode === "glitching") {
    mode = "secret";
    secretHealth = 100;
    secretMaxHealth = 100;
    skulls = [];
    skullSpawnTimer = 0;
    jumpscareEndsAt = 0;
    redirectedAfterDeath = false;
    secretModeStartedAt = performance.now();
    escapeSkullSpawned = false;
    exitDrop = null;
    updateHud();
    return;
  }

  player.position = { ...course.start };
  finished = false;
  startTime = performance.now();
  localStorage.removeItem(HUB_TROPHY_KEY);
  localStorage.removeItem(HUB_TROPHY_POSITION_KEY);
  localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
  trophy = createTrophyIfNeeded();
  trophyFalling = false;
  trophyVelocityY = 0;
  updateHud(
    controlsReversed
      ? "Back to the terrifying beginning. Still reversed."
      : "Back to the terrifying beginning."
  );
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function updateBestTimeLabel(): void {
  bestTimeEl.textContent =
    bestTimeMs === null ? "Best time: not set" : `Best time: ${formatTime(bestTimeMs)}`;
}

function loadCourse(nextLevel: CourseLevel, statusMessage?: string): void {
  if (nextLevel === 2 && !readLevelTwoUnlocked()) {
    updateHud("Level 2 is locked. Drag the trophy to the finish first.");
    return;
  }

  if (nextLevel === 3 && !readLevelThreeUnlocked()) {
    updateHud("Level 3 is locked. Find the Level 3 trophy.");
    return;
  }

  currentLevel = nextLevel;
  course = COURSES[nextLevel];
  mode = "normal";
  jumpscareEndsAt = 0;
  redirectedAfterDeath = false;
  player.position = { ...course.start };
  finished = false;
  startTime = performance.now();
  trophy = createTrophyIfNeeded();
  trophyFalling = false;
  trophyVelocityY = 0;
  updateLevelButtons();
  updateHud(statusMessage ?? `${course.name}. Reach the exit.`);
}

function updateLevelButtons(): void {
  level1Btn.classList.toggle("is-active", currentLevel === 1);
  level2Btn.classList.toggle("is-active", currentLevel === 2);
  level3Btn.classList.toggle("is-active", currentLevel === 3);

  const levelTwoUnlocked = readLevelTwoUnlocked();
  const levelThreeUnlocked = readLevelThreeUnlocked();
  level2Btn.classList.toggle("is-locked", !levelTwoUnlocked);
  level3Btn.classList.toggle("is-locked", !levelThreeUnlocked);
  level2Btn.disabled = false;
  level3Btn.disabled = false;
}

function readBestTime(): number | null {
  const rawValue = localStorage.getItem("a-hard-easy-game-best-time");
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function formatTime(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPlayerRectAt(x: number, y: number): Rect {
  return {
    x: x - player.radius,
    y: y - player.radius,
    width: player.radius * 2,
    height: player.radius * 2,
  };
}

function isPlayerBlockedAt(x: number, y: number, ignoredHazard?: Hazard): boolean {
  const playerRect = getPlayerRectAt(x, y);
  return course.hazards.some((hazard) => {
    if (!hazard.real || hazard === ignoredHazard) {
      return false;
    }

    return rectsOverlap(playerRect, hazard);
  });
}

function resolvePlayerAfterHazardPush(sourceHazard: Hazard): boolean {
  if (!rectsOverlap(getPlayerRectAt(player.position.x, player.position.y), sourceHazard)) {
    return true;
  }

  const moveX = sourceHazard.x - (sourceHazard.previousX ?? sourceHazard.x);
  const moveY = sourceHazard.y - (sourceHazard.previousY ?? sourceHazard.y);
  const pushX = moveX === 0 ? 0 : Math.sign(moveX);
  const pushY = moveY === 0 ? 0 : Math.sign(moveY);

  for (let step = 0; step < 64; step += 1) {
    if (!rectsOverlap(getPlayerRectAt(player.position.x, player.position.y), sourceHazard)) {
      return !isPlayerBlockedAt(player.position.x, player.position.y);
    }

    if (Math.abs(moveX) >= Math.abs(moveY) && pushX !== 0) {
      player.position.x = clamp(player.position.x + pushX, player.radius, WORLD.width - player.radius);
    } else if (pushY !== 0) {
      player.position.y = clamp(player.position.y + pushY, player.radius, WORLD.height - player.radius);
    } else {
      break;
    }
  }

  return !rectsOverlap(getPlayerRectAt(player.position.x, player.position.y), sourceHazard) &&
    !isPlayerBlockedAt(player.position.x, player.position.y);
}

function consumeLinkedReverseControls(): boolean {
  const shouldReverse = localStorage.getItem(LINKED_REVERSE_CONTROLS_KEY) === "reversed";
  if (shouldReverse) {
    localStorage.removeItem(LINKED_REVERSE_CONTROLS_KEY);
  }
  return shouldReverse;
}

function resetAhegState(): void {
  const keysToClear = [
    "a-hard-easy-game-best-time",
    SHADOW_CLEAR_KEY,
    LEVEL_TWO_UNLOCKED_KEY,
    LEVEL_THREE_UNLOCKED_KEY,
    LEVEL_THREE_TROPHY_READY_KEY,
    HUB_TROPHY_KEY,
    HUB_TROPHY_POSITION_KEY,
    AHEG_TROPHY_LOCATION_KEY,
    "a-hard-easy-game-escaped-player",
    LINKED_REVERSE_CONTROLS_KEY,
    LINKED_ROTATION_CURSE_KEY,
  ];

  for (const key of keysToClear) {
    localStorage.removeItem(key);
  }

  window.location.reload();
}

function hasRotationCurse(): boolean {
  return localStorage.getItem(LINKED_ROTATION_CURSE_KEY) === "rotated";
}

function updateHud(statusMessage?: string): void {
  syncHudVisibility();

  if (mode === "secret" || mode === "glitching") {
    const clampedHealth = Math.max(0, Math.min(secretMaxHealth, secretHealth));
    healthFillEl.style.transform = `scaleX(${clampedHealth / secretMaxHealth})`;
    healthValueEl.textContent = `${clampedHealth} / ${secretMaxHealth}`;
    setStatus(
      statusMessage ??
        (mode === "glitching"
          ? "Reality is tearing open..."
          : jumpscareEndsAt > 0
            ? "TOO LATE."
            : secretHealth > 0
              ? exitDrop
                ? "The way out is open. Click the exit sign."
                : "Shadow account detected. Click the skulls before they hit you."
              : "The skull swarm got you. Restart to try again.")
    );
    return;
  }

  updateBestTimeLabel();
  setStatus(
    statusMessage ??
      (rotationCursed
        ? "AHHH WHATS HAPENING"
        : isEscapedAhegPlayerActive()
        ? "You got pushed out of the level. Walk over to Menu to escape."
        : controlsReversed
        ? "The maze cursed you. Your controls are reversed."
        : "Use arrow keys or WASD to move.")
  );
}

function syncHudVisibility(): void {
  const inBossfight = mode === "secret" || mode === "glitching";
  document.body.classList.toggle("rotation-cursed", rotationCursed);
  pageEl.classList.toggle("rotation-cursed-page", rotationCursed);

  levelSelectorEl.hidden = inBossfight;
  bestTimeEl.hidden = inBossfight;
  healthHudEl.hidden = !inBossfight;

  levelSelectorEl.style.display = inBossfight ? "none" : "";
  bestTimeEl.style.display = inBossfight ? "none" : "";
  healthHudEl.style.display = inBossfight ? "flex" : "none";
}

function createTrophyIfNeeded(): Trophy | null {
  if (localStorage.getItem(HUB_TROPHY_KEY) === "true") {
    return null;
  }

  if (readShadowClear() && currentLevel === 1) {
    return {
      x: 96,
      y: 70,
      width: 52,
      height: 60,
      homeX: 96,
      homeY: 70,
      targetLevel: 2,
    };
  }

  if (readLevelThreeTrophyReady() && readLevelTwoUnlocked() && !readLevelThreeUnlocked() && currentLevel === 2) {
    return {
      x: WORLD.width / 2 - 26,
      y: WORLD.height / 2 - 30,
      width: 52,
      height: 60,
      homeX: WORLD.width / 2 - 26,
      homeY: WORLD.height / 2 - 30,
      targetLevel: 3,
    };
  }

  return null;
}

function drawTrophy(): void {
  if (!trophy || mode !== "normal" || draggingTrophy) {
    return;
  }

  drawTrophyGraphic(ctx, trophy.x, trophy.y, trophy.targetLevel);
}

function isTrophyOutOfBounds(target: Trophy): boolean {
  return (
    target.x + target.width < 0 ||
    target.y + target.height < 0 ||
    target.x > WORLD.width ||
    target.y > WORLD.height
  );
}

function droppedOutsideCanvas(clientX: number, clientY: number): boolean {
  const rect = canvas.getBoundingClientRect();
  return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
}

function showTrophyDragGhost(left: number, top: number): void {
  if (!trophyDragGhost) {
    trophyDragGhost = document.createElement("div");
    trophyDragGhost.className = "trophy-drag-ghost";
    trophyDragGhost.setAttribute("aria-hidden", "true");
    const ghostCanvas = document.createElement("canvas");
    ghostCanvas.width = 52;
    ghostCanvas.height = 60;
    const ghostContext = ghostCanvas.getContext("2d");
    if (ghostContext instanceof CanvasRenderingContext2D) {
      drawTrophyGraphic(ghostContext, 0, 0, trophy?.targetLevel ?? 2);
    }
    trophyDragGhost.appendChild(ghostCanvas);
    document.body.appendChild(trophyDragGhost);
  }
  const ghostCanvas = trophyDragGhost.querySelector("canvas");
  const ghostContext = ghostCanvas?.getContext("2d");
  if (ghostCanvas && ghostContext instanceof CanvasRenderingContext2D) {
    ghostContext.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
    drawTrophyGraphic(ghostContext, 0, 0, trophy?.targetLevel ?? 2);
  }
  updateTrophyDragGhost(left, top);
  trophyDragGhost.hidden = false;
}

function updateTrophyDragGhost(left: number, top: number): void {
  if (!trophyDragGhost) {
    return;
  }
  trophyDragGhost.style.left = `${left}px`;
  trophyDragGhost.style.top = `${top}px`;
}

function hideTrophyDragGhost(): void {
  if (!trophyDragGhost) {
    return;
  }
  trophyDragGhost.hidden = true;
}

function startTrophyFall(): void {
  if (!trophy) {
    return;
  }

  trophyFalling = true;
  trophyVelocityY = Math.max(trophyVelocityY, 80);
}

function updateTrophyFall(deltaSeconds: number): void {
  if (!trophy || !trophyFalling || draggingTrophy) {
    return;
  }

  const groundY = WORLD.height - trophy.height;
  if (!trophyFinaleTriggered && areAllOtherGamesGone() && groundY - trophy.y <= 100) {
    startAllGamesRestoreFinale();
    return;
  }

  trophyVelocityY += 1400 * deltaSeconds;
  trophy.y += trophyVelocityY * deltaSeconds;

  if (trophy.y >= groundY) {
    trophy.y = groundY;
    trophyVelocityY = 0;
    trophyFalling = false;
  }
}

function areAllOtherGamesGone(): boolean {
  return (
    localStorage.getItem(OUMG_DELETED_FROM_HUB_KEY) === "true" &&
    localStorage.getItem(AKL_DELETED_FROM_HUB_KEY) === "true" &&
    localStorage.getItem(TM_DELETED_FROM_HUB_KEY) === "true"
  );
}

function startAllGamesRestoreFinale(): void {
  if (!trophy || trophyFinaleTriggered) {
    return;
  }

  trophyFinaleTriggered = true;
  trophyFalling = false;
  trophyVelocityY = 0;
  trophy.x = trophy.homeX;
  trophy.y = trophy.homeY;
  updateHud("Everything is gone. The trophy snaps back.");
  playBlackSlashFinale();
}

function playBlackSlashFinale(): void {
  const existingOverlay = document.getElementById("aheg-finale-overlay");
  existingOverlay?.remove();

  const overlay = document.createElement("div");
  overlay.id = "aheg-finale-overlay";
  overlay.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 12; index += 1) {
    const slash = document.createElement("div");
    slash.className = "aheg-black-slash";
    slash.style.setProperty("--slash-delay", `${index * 120}ms`);
    slash.style.setProperty("--slash-top", `${-16 + index * 11}%`);
    slash.style.setProperty("--slash-rotate", `${index % 2 === 0 ? -12 : 10}deg`);
    overlay.appendChild(slash);
  }

  document.body.appendChild(overlay);
  document.body.classList.add("aheg-finale-active");

  window.setTimeout(() => {
    overlay.classList.add("is-fully-black");
    playFullyDestroyedAudio();
  }, 1500);
}

function playFullyDestroyedAudio(): void {
  const recording = new Audio(fullyDestroyedAudioSrc);
  let finished = false;
  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    restoreAllDeletedGames();
    document.body.classList.add("aheg-finale-fade-out");
    window.setTimeout(() => {
      window.location.href = new URL("../../", window.location.href).toString();
    }, 850);
  };

  recording.addEventListener("ended", finish, { once: true });
  const playPromise = recording.play();
  if (playPromise) {
    playPromise.catch(() => {
      window.setTimeout(finish, 2400);
    });
  }
}

function restoreAllDeletedGames(): void {
  const keysToClear = [
    OUMG_DELETED_FROM_HUB_KEY,
    AKL_DELETED_FROM_HUB_KEY,
    TM_DELETED_FROM_HUB_KEY,
    OUMG_TROPHY_DROP_COUNT_KEY,
    OUMG_TROPHY_DOOM_STARTED_KEY,
    AKL_TROPHY_DOOM_STARTED_KEY,
    TM_TROPHY_DOOM_STARTED_KEY,
    AHEG_TROPHY_LOCATION_KEY,
  ];

  for (const key of keysToClear) {
    localStorage.removeItem(key);
  }

  markShadowClear();
  unlockLevelTwo();
  markLevelThreeTrophyReady();
  restoreAllMissingPeopleInAllSaves();
  localStorage.removeItem(LEVEL_THREE_UNLOCKED_KEY);
}

function drawTrophyGraphic(
  renderCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  targetLevel: 2 | 3
): void {
  renderCtx.save();
  renderCtx.fillStyle = "#ffd86f";
  renderCtx.fillRect(x + 10, y + 44, 32, 10);
  renderCtx.fillRect(x + 20, y + 22, 12, 28);
  renderCtx.beginPath();
  renderCtx.roundRect(x + 8, y + 6, 36, 24, 10);
  renderCtx.fill();

  renderCtx.strokeStyle = "#8b6400";
  renderCtx.lineWidth = 4;
  renderCtx.beginPath();
  renderCtx.arc(x + 8, y + 18, 8, Math.PI * 0.5, Math.PI * 1.5, true);
  renderCtx.arc(x + 44, y + 18, 8, Math.PI * 1.5, Math.PI * 0.5, true);
  renderCtx.stroke();

  renderCtx.fillStyle = "#fff0ae";
  renderCtx.font = "700 12px Trebuchet MS";
  renderCtx.textAlign = "center";
  renderCtx.fillText(`LVL ${targetLevel}`, x + 26, y + 22);
  renderCtx.restore();
}

function drawHazard(hazard: Hazard): void {
  const gradient = ctx.createLinearGradient(hazard.x, hazard.y, hazard.x + hazard.width, hazard.y);
  if (hazard.real) {
    gradient.addColorStop(0, "#ff7b7b");
    gradient.addColorStop(1, "#ff3d68");
  } else {
    gradient.addColorStop(0, "rgba(255, 123, 123, 0.88)");
    gradient.addColorStop(1, "rgba(255, 61, 104, 0.88)");
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height);

  ctx.fillStyle = "rgba(22, 16, 30, 0.42)";
  for (let y = hazard.y; y < hazard.y + hazard.height; y += 16) {
    ctx.beginPath();
    ctx.moveTo(hazard.x, y);
    ctx.lineTo(hazard.x + hazard.width, y + 10);
    ctx.lineTo(hazard.x + hazard.width, y + 16);
    ctx.lineTo(hazard.x, y + 6);
    ctx.closePath();
    ctx.fill();
  }
}


function readShadowClear(): boolean {
  return localStorage.getItem(SHADOW_CLEAR_KEY) === "true";
}

function markShadowClear(): void {
  localStorage.setItem(SHADOW_CLEAR_KEY, "true");
}

function readLevelTwoUnlocked(): boolean {
  return localStorage.getItem(LEVEL_TWO_UNLOCKED_KEY) === "true";
}

function unlockLevelTwo(): void {
  localStorage.setItem(LEVEL_TWO_UNLOCKED_KEY, "true");
}

function readLevelThreeUnlocked(): boolean {
  return localStorage.getItem(LEVEL_THREE_UNLOCKED_KEY) === "true";
}

function unlockLevelThree(): void {
  localStorage.setItem(LEVEL_THREE_UNLOCKED_KEY, "true");
  localStorage.removeItem(LEVEL_THREE_TROPHY_READY_KEY);
}

function readLevelThreeTrophyReady(): boolean {
  return localStorage.getItem(LEVEL_THREE_TROPHY_READY_KEY) === "true";
}

function markLevelThreeTrophyReady(): void {
  localStorage.setItem(LEVEL_THREE_TROPHY_READY_KEY, "true");
}

function clearShadowTamagotchiProfiles(): void {
  const rawIndex = localStorage.getItem(TAMAGOTCHI_PROFILES_INDEX_KEY);
  if (!rawIndex) {
    return;
  }

  try {
    const profiles = JSON.parse(rawIndex) as Array<{ id?: string; name?: string }>;
    const keptProfiles = profiles.filter((profile) => {
      const id = profile?.id;
      if (!id) {
        return true;
      }

      const key = `${TAMAGOTCHI_PROFILE_KEY_PREFIX}${id}`;
      const rawProfile = localStorage.getItem(key);
      if (!rawProfile) {
        return true;
      }

      try {
        const parsed = JSON.parse(rawProfile) as { pet?: { stage?: string } };
        if (parsed.pet?.stage === "shadow") {
          localStorage.removeItem(key);
          return false;
        }
      } catch {
        return true;
      }

      return true;
    });

    localStorage.setItem(TAMAGOTCHI_PROFILES_INDEX_KEY, JSON.stringify(keptProfiles));
  } catch {
    // Ignore malformed profile data and leave storage untouched.
  }
}

function hasShadowTamagotchiProfile(): boolean {
  const rawIndex = localStorage.getItem(TAMAGOTCHI_PROFILES_INDEX_KEY);
  if (!rawIndex) {
    return false;
  }

  try {
    const profiles = JSON.parse(rawIndex) as Array<{ id?: string }>;
    return profiles.some((profile) => {
      const id = profile?.id;
      if (!id) {
        return false;
      }

      const rawProfile = localStorage.getItem(`${TAMAGOTCHI_PROFILE_KEY_PREFIX}${id}`);
      if (!rawProfile) {
        return false;
      }

      try {
        const parsed = JSON.parse(rawProfile) as { pet?: { stage?: string } };
        return parsed.pet?.stage === "shadow";
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function enterSecretLevel(): void {
  mode = "secret";
  secretHealth = 100;
  secretMaxHealth = 100;
  skulls = [];
  skullSpawnTimer = 0.15;
  secretModeStartedAt = performance.now();
  escapeSkullSpawned = false;
  exitDrop = null;
  updateHud();
}

function updateSecretLevel(deltaSeconds: number): void {
  if (jumpscareEndsAt > 0) {
    if (!redirectedAfterDeath && performance.now() >= jumpscareEndsAt) {
      redirectedAfterDeath = true;
      window.location.replace("https://example.com/");
    }
    return;
  }

  if (secretHealth <= 0) {
    return;
  }

  if (!escapeSkullSpawned && performance.now() - secretModeStartedAt >= 60_000) {
    spawnEscapeSkull();
    escapeSkullSpawned = true;
    updateHud("A yellow skull appeared. Break it open to find a way out.");
  }

  skullSpawnTimer -= deltaSeconds;
  if (skullSpawnTimer <= 0) {
    spawnSkull();
    skullSpawnTimer = Math.max(0.28, 0.85 - (secretMaxHealth - secretHealth) * 0.003);
  }

  const target = { x: WORLD.width / 2, y: WORLD.height / 2 };
  const remainingSkulls: Skull[] = [];

  for (const skull of skulls) {
    skull.spin += skull.wobbleSpeed * deltaSeconds;
    const angle = Math.atan2(target.y - skull.y, target.x - skull.x);
    skull.x += Math.cos(angle) * skull.speed * deltaSeconds;
    skull.y += Math.sin(angle) * skull.speed * deltaSeconds;
    skull.x += Math.cos(skull.spin) * skull.wobble * deltaSeconds;
    skull.y += Math.sin(skull.spin * 1.4) * skull.wobble * deltaSeconds;

    const distanceToTarget = Math.hypot(target.x - skull.x, target.y - skull.y);
    if (distanceToTarget <= skull.radius + 26) {
      secretHealth -= 10;
      updateHud();
      continue;
    }

    remainingSkulls.push(skull);
  }

  skulls = remainingSkulls;

  if (secretHealth <= 0) {
    secretHealth = 0;
    jumpscareEndsAt = performance.now() + 950;
    updateHud();
  }
}

function spawnSkull(): void {
  const edge = Math.floor(Math.random() * 4);
  const variant: Skull["variant"] = Math.random() < 0.16 ? "elite" : "normal";
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = Math.random() * WORLD.width;
    y = -40;
  } else if (edge === 1) {
    x = WORLD.width + 40;
    y = Math.random() * WORLD.height;
  } else if (edge === 2) {
    x = Math.random() * WORLD.width;
    y = WORLD.height + 40;
  } else {
    x = -40;
    y = Math.random() * WORLD.height;
  }

  skulls.push({
    x,
    y,
    radius: variant === "elite" ? 30 + Math.random() * 12 : 24 + Math.random() * 10,
    speed: variant === "elite" ? 72 + Math.random() * 26 : 88 + Math.random() * 60,
    spin: Math.random() * Math.PI * 2,
    wobble: 22 + Math.random() * 18,
    wobbleSpeed: 3 + Math.random() * 4,
    hitsRemaining: variant === "elite" ? 3 : 1,
    variant,
  });
}

function spawnEscapeSkull(): void {
  skulls.push({
    x: WORLD.width / 2,
    y: -54,
    radius: 38,
    speed: 64,
    spin: Math.random() * Math.PI * 2,
    wobble: 16,
    wobbleSpeed: 2.4,
    hitsRemaining: 5,
    variant: "escape",
  });
}

function drawGlitchTransition(timestamp: number): void {
  drawBackground(timestamp);

  for (let i = 0; i < 18; i += 1) {
    const y = Math.random() * WORLD.height;
    const height = 8 + Math.random() * 18;
    ctx.fillStyle = `rgba(${120 + Math.random() * 120}, ${20 + Math.random() * 70}, ${90 + Math.random() * 120}, 0.28)`;
    ctx.fillRect((Math.random() - 0.5) * 90, y, WORLD.width, height);
  }

  ctx.fillStyle = "rgba(8, 4, 20, 0.46)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = "#ff8fb3";
  ctx.textAlign = "center";
  ctx.font = "700 48px Trebuchet MS";
  ctx.fillText("SIGNAL CORRUPTED", WORLD.width / 2, WORLD.height / 2 - 12);
  ctx.font = "700 20px Trebuchet MS";
  ctx.fillText("Shadow account found. Teleporting...", WORLD.width / 2, WORLD.height / 2 + 32);
}

function drawSecretLevel(timestamp: number): void {
  if (jumpscareEndsAt > 0) {
    drawJumpScare(timestamp);
    return;
  }

  ctx.fillStyle = "#07030d";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = `rgba(130, 90, 170, ${0.08 + (i % 5) * 0.01})`;
    ctx.fillRect((i * 71 + timestamp * 0.02) % WORLD.width, (i * 37) % WORLD.height, 2, 2);
  }

  ctx.save();
  ctx.translate(WORLD.width / 2, WORLD.height / 2);
  ctx.strokeStyle = "rgba(255, 110, 150, 0.28)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (const skull of skulls) {
    drawSkull(skull, timestamp);
  }

  if (exitDrop) {
    drawExitDrop(exitDrop, timestamp);
  }

  ctx.fillStyle = "#ffc0d2";
  ctx.font = "700 22px Trebuchet MS";
  ctx.textAlign = "left";
  ctx.fillText("SECRET LEVEL // SHADOW SWARM", 24, 36);
}

function drawSkull(skull: Skull, timestamp: number): void {
  ctx.save();
  ctx.translate(skull.x, skull.y);
  ctx.rotate(Math.sin(timestamp * 0.003 + skull.spin) * 0.18);

  ctx.fillStyle =
    skull.variant === "elite"
      ? "#ff667f"
      : skull.variant === "escape"
        ? "#ffd84f"
        : "#f3e6ff";
  ctx.beginPath();
  ctx.arc(0, -4, skull.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-skull.radius * 0.68, skull.radius * 0.1, skull.radius * 1.36, skull.radius * 0.72);

  ctx.fillStyle =
    skull.variant === "elite"
      ? "#3a0815"
      : skull.variant === "escape"
        ? "#4d3600"
        : "#1a1024";
  ctx.beginPath();
  ctx.arc(-skull.radius * 0.38, -skull.radius * 0.14, skull.radius * 0.22, 0, Math.PI * 2);
  ctx.arc(skull.radius * 0.38, -skull.radius * 0.14, skull.radius * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, skull.radius * 0.04);
  ctx.lineTo(-skull.radius * 0.14, skull.radius * 0.3);
  ctx.lineTo(skull.radius * 0.14, skull.radius * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1a1024";
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * skull.radius * 0.18, skull.radius * 0.42);
    ctx.lineTo(i * skull.radius * 0.18, skull.radius * 0.74);
    ctx.stroke();
  }

  if (skull.variant === "elite" || skull.variant === "escape") {
    if (skull.variant === "elite") {
      ctx.fillStyle = "#ffd6df";
      ctx.beginPath();
      ctx.moveTo(0, -skull.radius * 1.1);
      ctx.bezierCurveTo(skull.radius * 0.28, -skull.radius * 1.46, skull.radius * 0.82, -skull.radius * 0.94, 0, -skull.radius * 0.46);
      ctx.bezierCurveTo(-skull.radius * 0.82, -skull.radius * 0.94, -skull.radius * 0.28, -skull.radius * 1.46, 0, -skull.radius * 1.1);
      ctx.fill();
    } else {
      ctx.fillStyle = "#fff2ae";
      ctx.fillRect(-skull.radius * 0.48, -skull.radius * 1.32, skull.radius * 0.96, skull.radius * 0.22);
      ctx.fillRect(-skull.radius * 0.12, -skull.radius * 1.52, skull.radius * 0.24, skull.radius * 0.56);
    }

    ctx.fillStyle = skull.variant === "escape" ? "#4d3600" : "#fff0f4";
    ctx.font = "700 16px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.max(0, skull.hitsRemaining)), 0, skull.radius * 1.24);
  }

  ctx.restore();
}

function drawExitDrop(drop: ExitDrop, timestamp: number): void {
  const bob = Math.sin(timestamp * 0.004 + drop.bobPhase) * 6;
  const x = drop.x;
  const y = drop.y + bob;

  ctx.save();
  ctx.fillStyle = "#69c0d8";
  ctx.fillRect(x + 46, y + drop.height - 18, 12, 18);
  ctx.fillStyle = "#d7edf7";
  ctx.fillRect(x + 8, y + drop.height - 10, drop.width - 16, 10);

  ctx.fillStyle = "#f2d365";
  ctx.strokeStyle = "#6d5200";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, drop.width, drop.height - 10, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#3e2d00";
  ctx.textAlign = "center";
  ctx.font = "700 16px Trebuchet MS";
  ctx.fillText("EXIT", x + drop.width / 2, y + 25);
  ctx.font = "700 10px Trebuchet MS";
  ctx.fillText("LOCALHOST", x + drop.width / 2, y + 40);
  ctx.restore();
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function canvasPointFromEvent(event: PointerEvent): Vector2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function drawJumpScare(timestamp: number): void {
  ctx.fillStyle = "#090009";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const pulse = 1 + Math.sin(timestamp * 0.03) * 0.08;
  ctx.save();
  ctx.translate(WORLD.width / 2, WORLD.height / 2);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = "#f6efff";
  ctx.beginPath();
  ctx.ellipse(0, -20, 160, 190, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#180313";
  ctx.beginPath();
  ctx.ellipse(-52, -40, 30, 42, 0.1, 0, Math.PI * 2);
  ctx.ellipse(52, -40, 30, 42, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#c40035";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(-72, 56);
  ctx.quadraticCurveTo(0, 110, 72, 56);
  ctx.stroke();

  ctx.fillStyle = "#ff4f7a";
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 58);
    ctx.lineTo(i * 16 - 6, 92);
    ctx.lineTo(i * 16 + 6, 92);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  ctx.fillStyle = "#ffb7cb";
  ctx.textAlign = "center";
  ctx.font = "700 28px Trebuchet MS";
  ctx.fillText("YOU LET THEM IN", WORLD.width / 2, WORLD.height - 42);
}
