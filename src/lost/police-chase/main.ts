// Police Chase: stickmen on rooftops at night.

import {
  BONUS_DISTANCE,
  GROUND_Y,
  ROOF_THICKNESS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  chimneyRect,
  clamp,
  copRect,
  playerRect,
  type Chimney,
  type Cop,
  type Loot,
  type Player,
} from "./world";
import { newChase, step, type Chase, type Keys } from "./game";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas");
const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
const ctx: CanvasRenderingContext2D = context;

const HIGH_SCORE_KEY = "police-chase-high-score";

function loadHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch {
    // Never mind.
  }
}

type Scene = "title" | "playing" | "paused" | "gameOver";

let scene: Scene = "title";
let highScore = loadHighScore();
let chase: Chase = newChase(highScore);
const keys: Keys = { left: false, right: false, down: false, jump: false };

// ----------------------------------------------------------------- the skyline

interface SkylineLayer {
  seed: number;
  color: string;
  parallax: number;
  baseY: number;
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
}

const SKYLINE: SkylineLayer[] = [
  { seed: 13, color: "#1a1430", parallax: 0.25, baseY: Math.trunc(SCREEN_HEIGHT * 0.68), minW: 40, maxW: 110, minH: 40, maxH: 160 },
  { seed: 29, color: "#231e37", parallax: 0.4, baseY: Math.trunc(SCREEN_HEIGHT * 0.72), minW: 36, maxW: 95, minH: 35, maxH: 140 },
];

// The buildings are built from the same number sequence every frame, so they
// stay put as the camera slides past them.
function drawSkyline(camera: number, time: number, layer: SkylineLayer): void {
  let state = (layer.seed * 1103515245 + 12345) & 0x7fffffff;
  const next = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state;
  };
  const startWorld = camera * layer.parallax;
  let x = Math.floor(startWorld / layer.maxW) * layer.maxW - layer.maxW * 2;

  ctx.fillStyle = layer.color;
  for (let guard = 0; guard < 200; guard += 1) {
    const screenX = Math.trunc(x - startWorld);
    if (screenX > SCREEN_WIDTH + 200) break;
    const width = layer.minW + (next() % Math.max(1, layer.maxW - layer.minW + 1));
    const height = layer.minH + (next() % Math.max(1, layer.maxH - layer.minH + 1));
    const wobble = Math.sin(x * 0.002 + time * 0.3) * 3;
    ctx.fillRect(screenX, Math.trunc(layer.baseY - height + wobble), width, height);
    x += width;
  }
}

function drawBackground(): void {
  const sky = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  sky.addColorStop(0, "#0a0c16");
  sky.addColorStop(1, "#1e122d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  for (const layer of SKYLINE) drawSkyline(chase.camera, chase.time, layer);
}

// ---------------------------------------------------------------- the stickmen

function drawStickman(
  x: number,
  y: number,
  color: string,
  accent: string | null,
  scale: number,
  phase: number,
  airborne: boolean,
  hasHat: boolean
): void {
  const s = clamp(scale, 0.65, 1.35);
  const headRadius = Math.trunc(9 * s);
  const neck = Math.trunc(6 * s);
  const torso = Math.trunc(20 * s);
  const armLength = Math.trunc(18 * s);
  const legLength = Math.trunc(20 * s);

  const headX = x;
  const headY = y - torso - neck - headRadius;
  const shoulderY = y - torso;
  const hipY = y - Math.trunc(6 * s);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
  ctx.stroke();

  if (hasHat) {
    const hatW = Math.trunc(18 * s);
    const hatH = Math.trunc(8 * s);
    ctx.fillStyle = "#3c78ff";
    ctx.fillRect(headX - hatW / 2, headY - headRadius - hatH + 2, hatW, hatH);
    ctx.fillRect(headX - hatW / 2, headY - headRadius + 2, hatW, Math.max(2, Math.trunc(3 * s)));
  }

  ctx.beginPath();
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(x, hipY);
  ctx.stroke();

  const [a1, a2, l1, l2] = airborne
    ? [-0.7, 0.7, -0.3, 0.4]
    : [
        Math.sin(phase) * 0.9,
        Math.sin(phase + Math.PI) * 0.9,
        Math.sin(phase + Math.PI * 0.2) * 0.9,
        Math.sin(phase + Math.PI * 1.2) * 0.9,
      ];

  const limb = (startY: number, length: number, angle: number): void => {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x + Math.cos(angle) * length, startY + Math.sin(angle) * length);
    ctx.stroke();
  };
  limb(shoulderY, armLength, -Math.PI / 2 + (a1 ?? 0));
  limb(shoulderY, armLength, -Math.PI / 2 + (a2 ?? 0));
  limb(hipY, legLength, Math.PI / 2 + (l1 ?? 0));
  limb(hipY, legLength, Math.PI / 2 + (l2 ?? 0));

  if (accent) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(headX - 6 * s, headY + headRadius - 2);
    ctx.lineTo(headX + 5 * s, headY + headRadius - 2);
    ctx.lineTo(headX + 2 * s, headY + headRadius + 5 * s);
    ctx.lineTo(headX - 7 * s, headY + headRadius + 3 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function drawLoot(item: Loot, screenX: number): void {
  const y = item.y;
  if (item.kind === "coin") {
    ctx.fillStyle = "#ffd848";
    ctx.beginPath();
    ctx.arc(screenX, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a07828";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = "#5a3c0f";
    ctx.beginPath();
    ctx.moveTo(screenX, y - 5);
    ctx.lineTo(screenX, y + 5);
    ctx.stroke();
    return;
  }
  if (item.kind === "bag") {
    ctx.fillStyle = "#3cd278";
    ctx.beginPath();
    ctx.moveTo(screenX - 9, y + 8);
    ctx.lineTo(screenX + 9, y + 8);
    ctx.lineTo(screenX + 7, y - 2);
    ctx.lineTo(screenX - 7, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e1c85a";
    ctx.beginPath();
    ctx.moveTo(screenX - 6, y - 2);
    ctx.lineTo(screenX + 6, y - 2);
    ctx.lineTo(screenX + 3, y - 10);
    ctx.lineTo(screenX - 3, y - 10);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#5ad2ff";
  ctx.beginPath();
  ctx.moveTo(screenX, y - 10);
  ctx.lineTo(screenX + 10, y - 2);
  ctx.lineTo(screenX + 6, y + 10);
  ctx.lineTo(screenX - 6, y + 10);
  ctx.lineTo(screenX - 10, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d2faff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawChimney(chimney: Chimney, screenX: number): void {
  const rect = chimneyRect(chimney);
  if (chimney.isBonus) {
    // The green ones glow, which is the only warning you get.
    const glow = 0.25 + 0.2 * Math.sin(chase.time * 6);
    ctx.fillStyle = `rgba(70, 255, 120, ${glow})`;
    ctx.beginPath();
    ctx.ellipse(screenX + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#55505f";
  ctx.fillRect(screenX, rect.y, rect.w, rect.h);
  ctx.fillStyle = chimney.isBonus ? "#1e6b34" : "#231e2d";
  ctx.fillRect(screenX + 4, rect.y + 3, rect.w - 8, 8);
}

function drawWorld(): void {
  const camera = chase.camera;
  const sx = (x: number): number => x - camera;

  if (chase.phase === "bonus") {
    ctx.fillStyle = "#12121a";
    ctx.fillRect(0, GROUND_Y, SCREEN_WIDTH, ROOF_THICKNESS);
    ctx.strokeStyle = "#3c3c50";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, GROUND_Y, SCREEN_WIDTH, ROOF_THICKNESS);
    for (const item of chase.bonus.loot) drawLoot(item, sx(item.x));
  } else {
    for (const roof of chase.world.roofs) {
      const width = roof.endX - roof.startX;
      ctx.fillStyle = "#12121a";
      ctx.fillRect(sx(roof.startX), roof.y, width, ROOF_THICKNESS);
      ctx.strokeStyle = "#3c3c50";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx(roof.startX), roof.y, width, ROOF_THICKNESS);
    }
    for (const chimney of chase.world.chimneys) drawChimney(chimney, sx(chimney.x));
    for (const item of chase.world.loot) drawLoot(item, sx(item.x));
    for (const cop of chase.world.cops) drawCop(cop, sx(cop.x));
  }

  drawPlayer(chase.player, sx(chase.player.x));
}

function drawCop(cop: Cop, screenX: number): void {
  const rect = copRect(cop);
  drawStickman(
    screenX,
    rect.y + rect.h,
    cop.state === "chase" ? "#ffe0e0" : "#dcf0ff",
    null,
    1,
    chase.time * 10 + cop.x * 0.01,
    !cop.grounded,
    true
  );
}

function drawPlayer(player: Player, screenX: number): void {
  const rect = playerRect(player);
  drawStickman(
    screenX,
    rect.y + rect.h,
    "#f5f5ff",
    "#ff4060",
    1.05,
    chase.time * 12 + player.x * 0.012,
    !player.grounded,
    false
  );
}

function drawHud(): void {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "20px monospace";
  ctx.fillStyle = "#f5f5ff";
  ctx.fillText(`Score: ${chase.score}`, 18, 14);
  ctx.fillText(`High: ${Math.max(highScore, chase.highScore)}`, 18, 40);
  ctx.textAlign = "right";
  ctx.fillText(chase.phase === "bonus" ? "BONUS" : "RUN", SCREEN_WIDTH - 18, 14);
  ctx.textAlign = "left";

  if (chase.phase === "bonus") {
    const remaining = Math.max(0, chase.bonus.endX - chase.player.x);
    const barWidth = 220;
    const x = SCREEN_WIDTH - barWidth - 18;
    ctx.fillStyle = "#14141c";
    ctx.fillRect(x, 44, barWidth, 10);
    ctx.fillStyle = "#46ff78";
    ctx.fillRect(x, 44, barWidth * clamp(1 - remaining / BONUS_DISTANCE, 0, 1), 10);
  }
}

function drawOverlay(title: string, subtitle: string): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.63)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.textAlign = "center";
  ctx.font = "48px monospace";
  ctx.fillStyle = "#f5f5ff";
  ctx.fillText(title, SCREEN_WIDTH / 2, 190);
  ctx.font = "20px monospace";
  ctx.fillText(subtitle, SCREEN_WIDTH / 2, 260);
  ctx.textAlign = "left";
}

function drawTitle(): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "48px monospace";
  ctx.fillStyle = "#f5f5ff";
  ctx.fillText("Police Chase", SCREEN_WIDTH / 2, 120);
  ctx.font = "18px monospace";
  ctx.fillText("Run the rooftops. Jump the cops. Green chimneys are the good ones.", SCREEN_WIDTH / 2, 200);
  ctx.fillText("←/→ move · SPACE or ↑ jump (let go to cut it short) · ↓ drop in · ESC pause", SCREEN_WIDTH / 2, 240);
  ctx.fillText("Press SPACE to start", SCREEN_WIDTH / 2, 320);
  ctx.fillText(`High score: ${highScore}`, SCREEN_WIDTH / 2, 360);
  ctx.textAlign = "left";
}

// ----------------------------------------------------------------------- input

function startRun(): void {
  chase = newChase(highScore);
  scene = "playing";
}

window.addEventListener("keydown", (event) => {
  const key = event.key;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(key)) event.preventDefault();

  if (key === "Escape") {
    if (scene === "playing") scene = "paused";
    else if (scene === "paused") scene = "playing";
    return;
  }

  if (scene === "title" && (key === " " || key === "Enter")) {
    startRun();
    return;
  }
  if (scene === "gameOver") {
    if (key === "r" || key === " " || key === "Enter") startRun();
    else if (key === "q") scene = "title";
    return;
  }
  if (scene === "paused" && key === "q") {
    scene = "title";
    return;
  }

  if (key === "ArrowLeft" || key === "a") keys.left = true;
  if (key === "ArrowRight" || key === "d") keys.right = true;
  if (key === "ArrowDown" || key === "s") keys.down = true;
  if (key === " " || key === "ArrowUp" || key === "w") keys.jump = true;
});

window.addEventListener("keyup", (event) => {
  const key = event.key;
  if (key === "ArrowLeft" || key === "a") keys.left = false;
  if (key === "ArrowRight" || key === "d") keys.right = false;
  if (key === "ArrowDown" || key === "s") keys.down = false;
  if (key === " " || key === "ArrowUp" || key === "w") keys.jump = false;
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
  keys.down = false;
  keys.jump = false;
});

// On a touchscreen: hold the right half to run, tap the left to jump, and the
// bottom strip to drop.
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (scene === "title" || scene === "gameOver") {
    startRun();
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  if (y > 0.8) keys.down = true;
  else if (x > 0.5) keys.right = true;
  else keys.jump = true;
});

const letGo = (): void => {
  keys.right = false;
  keys.jump = false;
  keys.down = false;
};
canvas.addEventListener("pointerup", letGo);
canvas.addEventListener("pointercancel", letGo);

// ------------------------------------------------------------------- the loop

let lastFrame = performance.now();

function frame(now: number): void {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (scene === "playing") {
    step(chase, keys, seconds);
    if (chase.phase === "over") {
      scene = "gameOver";
      if (chase.highScore > highScore) {
        highScore = chase.highScore;
        saveHighScore(highScore);
      }
    }
  }

  drawBackground();
  if (scene === "title") {
    drawTitle();
  } else {
    drawWorld();
    drawHud();
    if (scene === "paused") drawOverlay("Paused", "ESC to resume · Q for the title");
    if (scene === "gameOver") drawOverlay("Game Over", `${chase.reason}  ·  R to run again · Q for the title`);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
