// The neon terminal Software Hack is played on.

import {
  HEAT_MAX,
  INTEGRITY_MAX,
  INTRUSION_MAX,
  PAD_COLORS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  clamp,
  formatCurrencyShort,
  newSession,
  pressSession,
  stepSession,
  type IconShape,
  type Minigame,
  type PatchMatch,
  type Session,
  type SimonPattern,
  type TimingTrace,
} from "./session";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas");
const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
const ctx: CanvasRenderingContext2D = context;

const SIDE = 18;
const TEXT = "#ebf4ff";
const MUTED = "#96a5be";
const CYAN = "#00eeff";
const MAGENTA = "#ff46eb";
const LIME = "#78ff78";
const WARNING = "#ff5460";

const HIGH_SCORE_KEY = "software-hack-high-score";

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
    // Fine.
  }
}

type Scene = "title" | "terminal" | "playing" | "paused" | "gameOver";

let scene: Scene = "title";
let highScore = loadHighScore();
let session: Session = newSession(highScore);
let time = 0;

// ------------------------------------------------------------------ the chrome

function drawBackground(): void {
  const sky = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
  sky.addColorStop(0, "#0e061c");
  sky.addColorStop(1, "#06060a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  // A grid sliding away under everything, like an old hacker movie.
  ctx.strokeStyle = "rgba(0, 238, 255, 0.08)";
  ctx.lineWidth = 1;
  const spacing = 48;
  const drift = (time * 26) % spacing;
  for (let x = -spacing; x < SCREEN_WIDTH + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + drift, 0);
    ctx.lineTo(x + drift, SCREEN_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < SCREEN_HEIGHT; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();
  }
}

function drawScanlines(): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  for (let y = 0; y < SCREEN_HEIGHT; y += 4) ctx.fillRect(0, y, SCREEN_WIDTH, 2);
}

function drawPanel(x: number, y: number, w: number, h: number, border: string, alpha = 0.28): void {
  ctx.fillStyle = `rgba(10, 16, 30, ${alpha + 0.3})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawBar(x: number, y: number, w: number, h: number, value: number, max: number, color: string, label: string): void {
  drawPanel(x, y, w, h, color, 0.2);
  const inner = { x: x + 10, y: y + 26, w: w - 20, h: h - 36 };
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.fillStyle = color;
  ctx.fillRect(inner.x, inner.y, inner.w * clamp(value / max, 0, 1), inner.h);
  ctx.fillStyle = TEXT;
  ctx.font = "14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${label}  ${Math.round(value)}/${Math.round(max)}`, x + 10, y + 7);
}

function drawHud(): void {
  drawBar(SIDE, 16, 300, 58, session.intrusion, INTRUSION_MAX, MAGENTA, "INTRUSION");
  drawBar(SIDE + 320, 16, 300, 58, session.integrity, INTEGRITY_MAX, CYAN, "INTEGRITY");
  drawBar(SIDE + 640, 16, 300, 58, session.heat, HEAT_MAX, WARNING, "HEAT");

  ctx.fillStyle = TEXT;
  ctx.font = "18px monospace";
  ctx.fillText(
    `JOB ${session.job}  •  WALLET ${formatCurrencyShort(session.coins)}  •  HIGH ${formatCurrencyShort(Math.max(highScore, session.highScore))}`,
    SIDE,
    84
  );

  if (session.toast) {
    ctx.fillStyle = session.toast.color || TEXT;
    ctx.fillText(session.toast.text, SIDE, 112);
  }
}

// --------------------------------------------------------------- the minigames

function drawIcon(x: number, y: number, size: number, shape: IconShape, color: string): void {
  const r = size / 3;
  ctx.fillStyle = color;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (shape === "square") {
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    return;
  }
  if (shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.lineTo(x + r, y + r);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x - r / 3, y - r);
  ctx.lineTo(x + r / 2, y - r / 8);
  ctx.lineTo(x + r / 6, y - r / 8);
  ctx.lineTo(x + r / 3, y + r);
  ctx.lineTo(x - r / 2, y + r / 6);
  ctx.lineTo(x - r / 6, y + r / 6);
  ctx.closePath();
  ctx.fill();
}

function drawTimingTrace(game: TimingTrace): void {
  ctx.fillStyle = TEXT;
  ctx.font = "44px monospace";
  ctx.fillText(game.name, SIDE, 120);
  ctx.font = "18px monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("Press SPACE when the cursor is inside the neon window.", SIDE, 180);

  const bar = { x: SIDE, y: 250, w: SCREEN_WIDTH - 2 * SIDE, h: 56 };
  drawPanel(bar.x, bar.y, bar.w, bar.h, CYAN);
  const inner = { x: bar.x + 14, y: bar.y + 12, w: bar.w - 28, h: bar.h - 24 };

  const half = game.windowSize / 2;
  const low = clamp(game.windowCenter - half, 0, 1);
  const high = clamp(game.windowCenter + half, 0, 1);
  ctx.fillStyle = LIME;
  ctx.fillRect(inner.x + inner.w * low, inner.y, inner.w * (high - low), inner.h);

  ctx.fillStyle = MAGENTA;
  ctx.fillRect(inner.x + inner.w * game.cursor - 4, inner.y - 6, 8, inner.h + 12);

  ctx.fillStyle = TEXT;
  ctx.textAlign = "right";
  ctx.fillText(`${Math.max(0, game.timeLimit - game.time).toFixed(1)}s`, bar.x + bar.w, bar.y - 26);
  ctx.textAlign = "left";
}

function simonPads(): { x: number; y: number; w: number; h: number }[] {
  const gap = 26;
  const cellW = (SCREEN_WIDTH - 2 * SIDE - gap) / 2;
  const cellH = 140;
  return [0, 1, 2, 3].map((index) => ({
    x: SIDE + (index % 2) * (cellW + gap),
    y: 260 + Math.trunc(index / 2) * (cellH + gap),
    w: cellW,
    h: cellH,
  }));
}

function drawSimon(game: SimonPattern): void {
  ctx.fillStyle = TEXT;
  ctx.font = "44px monospace";
  ctx.fillText(game.name, SIDE, 120);
  ctx.font = "18px monospace";
  ctx.fillStyle = MUTED;
  const hint =
    game.phase === "show"
      ? "WATCH the pattern…"
      : game.phase === "input"
        ? "YOUR TURN: press 1–4 (or arrows and SPACE) to repeat."
        : game.phase === "intro"
          ? "Detect the pattern… get ready to watch."
          : "Get ready to repeat the pattern…";
  ctx.fillText(hint, SIDE, 180);

  const flashing = game.phase === "show" && game.flashOn ? game.sequence[game.showIndex] : -1;
  simonPads().forEach((pad, index) => {
    const color = PAD_COLORS[index] ?? CYAN;
    drawPanel(pad.x, pad.y, pad.w, pad.h, color, flashing === index ? 0.5 : 0.12);
    if (flashing === index) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(pad.x + 7, pad.y + 7, pad.w - 14, pad.h - 14);
      ctx.globalAlpha = 1;
    }
    if (game.phase === "input" && game.selected === index) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(pad.x + 5, pad.y + 5, pad.w - 10, pad.h - 10);
    }
    ctx.fillStyle = TEXT;
    ctx.font = "36px monospace";
    ctx.fillText(String(index + 1), pad.x + 16, pad.y + 14);
  });

  // A dot for each step, so you can see how long the pattern is.
  const dotY = 260 + 2 * 140 + 26 + 24;
  game.sequence.forEach((_, index) => {
    const active = game.phase === "show" ? index === game.showIndex : index === game.inputIndex;
    ctx.fillStyle = active ? LIME : MUTED;
    ctx.beginPath();
    ctx.arc(SIDE + 10 + index * 22, dotY, active ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (game.phase === "go") {
    ctx.fillStyle = LIME;
    ctx.font = "44px monospace";
    ctx.fillText("GO!", SIDE, 210);
  } else if (game.phase === "input") {
    ctx.fillStyle = TEXT;
    ctx.font = "18px monospace";
    ctx.fillText(`Input: ${game.inputIndex}/${game.sequence.length}`, SIDE, dotY + 20);
    ctx.textAlign = "right";
    ctx.fillText(
      `${Math.max(0, game.inputTimeLimit - game.inputTimer).toFixed(1)}s`,
      SCREEN_WIDTH - SIDE,
      dotY + 20
    );
    ctx.textAlign = "left";
  }
}

function drawPatchMatch(game: PatchMatch): void {
  ctx.fillStyle = WARNING;
  ctx.font = "40px monospace";
  ctx.fillText("VULNERABILITY DETECTED", SIDE, 95);
  ctx.fillStyle = TEXT;
  ctx.font = "18px monospace";
  ctx.fillText("Update your antivirus: pick the matching patch (press 1–4).", SIDE, 160);

  const target = { x: SIDE, y: 205, w: SCREEN_WIDTH - 2 * SIDE, h: 86 };
  drawPanel(target.x, target.y, target.w, target.h, WARNING);
  ctx.fillStyle = MUTED;
  ctx.font = "14px monospace";
  ctx.fillText("MATCH THIS ICON", target.x + 14, target.y + 10);
  drawIcon(target.x + target.w / 2, target.y + target.h / 2 + 8, 60, game.targetShape, game.targetColor);

  ctx.fillStyle = MUTED;
  ctx.font = "16px monospace";
  ctx.fillText(game.strict ? "Hard: match shape and colour" : "Easy: match the shape", SIDE, 296);

  const gap = 24;
  const cellW = (SCREEN_WIDTH - 2 * SIDE - gap) / 2;
  const cellH = 160;
  game.choices.forEach((choice, index) => {
    const x = SIDE + (index % 2) * (cellW + gap);
    const y = 322 + Math.trunc(index / 2) * (cellH + gap);
    drawPanel(x, y, cellW, cellH, MAGENTA, 0.16);
    ctx.fillStyle = TEXT;
    ctx.font = "30px monospace";
    ctx.fillText(String(index + 1), x + 12, y + 10);
    drawIcon(x + cellW / 2, y + cellH / 2, 80, choice.shape, choice.color);
  });

  ctx.fillStyle = TEXT;
  ctx.font = "18px monospace";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.max(0, game.timeLimit - game.time).toFixed(1)}s`, SCREEN_WIDTH - SIDE, 180);
  ctx.textAlign = "left";
}

function drawMinigame(game: Minigame): void {
  if (game.kind === "timing") drawTimingTrace(game);
  else if (game.kind === "simon") drawSimon(game);
  else drawPatchMatch(game);
}

// ------------------------------------------------------------------- the pages

function drawTitle(): void {
  ctx.fillStyle = TEXT;
  ctx.font = "48px monospace";
  ctx.fillText("SOFTWARE HACK", SIDE, 220);
  ctx.font = "18px monospace";
  ctx.fillStyle = MUTED;
  ctx.fillText("Hack hostile AIs. Patch yourself when vulnerabilities strike.", SIDE, 285);
  ctx.fillStyle = TEXT;
  ctx.fillText("ENTER to start", SIDE, 332);
  ctx.fillText(`High: ${formatCurrencyShort(highScore)}`, SIDE, 362);
}

function drawTerminal(): void {
  ctx.fillStyle = CYAN;
  ctx.font = "44px monospace";
  ctx.fillText("JOB TERMINAL", SIDE, 210);
  ctx.fillStyle = TEXT;
  ctx.font = "18px monospace";
  ctx.fillText("Press H or ENTER to start Job 1.", SIDE, 278);
  ctx.fillStyle = MUTED;
  ctx.fillText("If a vulnerability appears, pick the right patch fast.", SIDE, 310);

  drawPanel(SCREEN_WIDTH - 260, SCREEN_HEIGHT - 110, 230, 72, LIME, 0.3);
  ctx.fillStyle = TEXT;
  ctx.font = "24px monospace";
  ctx.textAlign = "center";
  ctx.fillText("HACK!", SCREEN_WIDTH - 145, SCREEN_HEIGHT - 84);
  ctx.textAlign = "left";
}

function drawOverlayPage(title: string, color: string, lines: string[]): void {
  ctx.fillStyle = color;
  ctx.font = "44px monospace";
  ctx.fillText(title, SIDE, 250);
  ctx.font = "18px monospace";
  lines.forEach((line, index) => {
    ctx.fillStyle = index === lines.length - 1 ? MUTED : TEXT;
    ctx.fillText(line, SIDE, 305 + index * 30);
  });
}

// ----------------------------------------------------------------------- input

function startSession(): void {
  session = newSession(Math.max(highScore, session.highScore));
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

  if (scene === "title") {
    if (key === "Enter" || key === " ") scene = "terminal";
    return;
  }
  if (scene === "terminal") {
    if (key === "Enter" || key === " " || key === "h") startSession();
    else if (key === "q") scene = "title";
    return;
  }
  if (scene === "paused") {
    if (key === "q") scene = "title";
    return;
  }
  if (scene === "gameOver") {
    if (key === "r") startSession();
    else if (key === "q") scene = "title";
    return;
  }

  pressSession(session, key);
});

// Tapping the screen works too: the panels are where the keys would be.
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (scene === "title") {
    scene = "terminal";
    return;
  }
  if (scene === "terminal" || scene === "gameOver") {
    startSession();
    return;
  }
  if (scene !== "playing" || !session.minigame) return;

  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * SCREEN_WIDTH;
  const y = ((event.clientY - bounds.top) / bounds.height) * SCREEN_HEIGHT;

  if (session.minigame.kind === "timing") {
    pressSession(session, " ");
    return;
  }
  const top = session.minigame.kind === "simon" ? 260 : 322;
  const cellH = session.minigame.kind === "simon" ? 166 : 184;
  const col = x > SCREEN_WIDTH / 2 ? 1 : 0;
  const row = y > top + cellH ? 1 : 0;
  pressSession(session, String(row * 2 + col + 1));
});

// ------------------------------------------------------------------- the loop

let lastFrame = performance.now();

function frame(now: number): void {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += seconds;

  if (scene === "playing") {
    stepSession(session, seconds);
    if (session.phase === "over") {
      scene = "gameOver";
      if (session.highScore > highScore) {
        highScore = session.highScore;
        saveHighScore(highScore);
      }
    }
  }

  drawBackground();
  drawHud();

  if (scene === "title") drawTitle();
  else if (scene === "terminal") drawTerminal();
  else if (scene === "paused") drawOverlayPage("PAUSED", TEXT, ["ESC to resume", "Q for the title"]);
  else if (scene === "gameOver") {
    drawOverlayPage("RIG COMPROMISED", WARNING, [
      "(Your computer got hacked.)",
      `Score: ${formatCurrencyShort(session.coins)}`,
      `High:  ${formatCurrencyShort(highScore)}`,
      "R to start again · Q for the title",
    ]);
  } else if (session.phase === "vulnBanner") {
    ctx.fillStyle = WARNING;
    ctx.font = "44px monospace";
    ctx.fillText("VULNERABILITY DETECTED", SIDE, 290);
    ctx.fillStyle = TEXT;
    ctx.font = "18px monospace";
    ctx.fillText("Launching AV update…", SIDE, 352);
  } else if (session.minigame) {
    drawMinigame(session.minigame);
  }

  drawScanlines();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
