// Mermaid Math under the sea: bubbles drifting up, pearls to count, and four
// bubble buttons to pick from.

import {
  BUBBLE_RADIUS,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  advance,
  answer,
  newGame,
  type Game,
} from "./rounds";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas");
const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
const ctx: CanvasRenderingContext2D = context;

const SEAFOAM = "#8fffd6";
const LAVENDER = "#c6a8ff";
const CORAL = "#ff80a8";
const PEARL = "#f8faff";
const MINT = "#9cffdc";
const TEAL = "#3cdcd7";
const INK = "#0a0c12";

const BEST_STREAK_KEY = "mermaid-math-best-streak";

function loadBestStreak(): number {
  try {
    return Number(localStorage.getItem(BEST_STREAK_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBestStreak(value: number): void {
  try {
    localStorage.setItem(BEST_STREAK_KEY, String(value));
  } catch {
    // Never mind.
  }
}

let game: Game = newGame(loadBestStreak());
let scene: "welcome" | "playing" = "welcome";
let time = 0;
let feedback: { correct: boolean; message: string; remaining: number; total: number } | null = null;
// Wiggle per button, so a wrong answer shakes the bubble you picked.
const wiggle = new Map<number, number>();

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  wobble: number;
  alpha: number;
  color: string;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
}

const bubbles: Bubble[] = [];
const sparkles: Sparkle[] = [];
const COLORS = [SEAFOAM, LAVENDER, MINT, TEAL, PEARL];

function spawnBubble(): void {
  bubbles.push({
    x: 50 + Math.random() * (WINDOW_WIDTH - 100),
    y: WINDOW_HEIGHT + 10 + Math.random() * 110,
    radius: 9 + Math.random() * 15,
    speed: 18 + Math.random() * 46,
    phase: Math.random() * Math.PI * 2,
    wobble: 18 + Math.random() * 52,
    alpha: 90 + Math.random() * 110,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? SEAFOAM,
  });
}

function celebrate(x: number, y: number): void {
  for (let i = 0; i < 10; i += 1) {
    bubbles.push({
      x: x + Math.random() * 16 - 8,
      y: y + Math.random() * 16 - 8,
      radius: 10 + Math.random() * 12,
      speed: 22 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
      wobble: 14 + Math.random() * 26,
      alpha: 160 + Math.random() * 80,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? SEAFOAM,
    });
  }
  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 260;
    sparkles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.55 + Math.random() * 0.35,
      color: [SEAFOAM, LAVENDER, CORAL, MINT, "#ffe078"][i % 5] ?? SEAFOAM,
    });
  }
}

// ------------------------------------------------------------------ the layout

const BUTTON_SPACING = 210;
const BUTTON_Y = WINDOW_HEIGHT * 0.5 + WINDOW_HEIGHT * 0.46 * 0.5 + 10;

function buttonCenter(index: number): { x: number; y: number } {
  const startX = WINDOW_WIDTH / 2 - BUTTON_SPACING * 1.5;
  return { x: startX + BUTTON_SPACING * index, y: BUTTON_Y };
}

const PALETTE = [SEAFOAM, LAVENDER, CORAL, MINT];
const RINGS = [TEAL, "#aa8cff", "#ffa0c8", "#78fad2"];

// ---------------------------------------------------------------- the painting

function drawOcean(): void {
  const water = ctx.createLinearGradient(0, 0, 0, WINDOW_HEIGHT);
  water.addColorStop(0, "#0e3459");
  water.addColorStop(1, "#4fb8cb");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

  // Three slow waves across the lower half.
  const waves = [
    { color: "rgba(143, 255, 214, 0.33)", offset: 0.58, amp: 10, freq: 2, speed: 0.7 },
    { color: "rgba(198, 168, 255, 0.24)", offset: 0.67, amp: 16, freq: 2.6, speed: 0.95 },
    { color: "rgba(156, 255, 220, 0.22)", offset: 0.76, amp: 22, freq: 3.2, speed: 1.2 },
  ];
  for (const wave of waves) {
    ctx.fillStyle = wave.color;
    ctx.beginPath();
    ctx.moveTo(0, WINDOW_HEIGHT);
    for (let x = 0; x <= WINDOW_WIDTH; x += 20) {
      const y =
        WINDOW_HEIGHT * wave.offset +
        Math.sin((x / WINDOW_WIDTH) * Math.PI * 2 * wave.freq + time * wave.speed) * wave.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WINDOW_WIDTH, WINDOW_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBubbles(): void {
  for (const bubble of bubbles) {
    ctx.strokeStyle = bubble.color;
    ctx.globalAlpha = Math.max(0, bubble.alpha / 255);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSparkles(): void {
  for (const sparkle of sparkles) {
    const life = Math.min(1, sparkle.age / sparkle.life);
    const size = 6 + 10 * (1 - life);
    ctx.globalAlpha = 1 - life;
    ctx.strokeStyle = sparkle.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sparkle.x - size, sparkle.y);
    ctx.lineTo(sparkle.x + size, sparkle.y);
    ctx.moveTo(sparkle.x, sparkle.y - size);
    ctx.lineTo(sparkle.x, sparkle.y + size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPearl(x: number, y: number, radius: number): void {
  const shimmer = (Math.sin(time * 3.1 + x * 0.01 + y * 0.02) + 1) / 2;
  ctx.fillStyle = shimmer > 0.5 ? "#e6f2ff" : PEARL;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = LAVENDER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawBubbleButton(index: number, value: number): void {
  const center = buttonCenter(index);
  const shake = wiggle.get(index) ?? 0;
  const bob = Math.sin(time * 2.2 + (value + 1) * 0.7) * 3;
  const wig = Math.sin(time * 24 + (value + 3) * 0.9) * (6 * shake);
  const x = center.x + wig;
  const y = center.y + bob;

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.arc(x + 8, y + 8, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE[index % PALETTE.length] ?? SEAFOAM;
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = RINGS[index % RINGS.length] ?? TEAL;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(x - BUBBLE_RADIUS * 0.35, y - BUBBLE_RADIUS * 0.35, BUBBLE_RADIUS * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.font = "bold 72px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), x, y + 4);
}

// Smooth "pop" for the badge, the same easing the Python one used.
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function drawFrame(): void {
  drawOcean();
  drawBubbles();

  ctx.fillStyle = PEARL;
  ctx.font = "24px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(
    `Score: ${game.score}   Streak: ${game.streak}   Best streak: ${game.bestStreak}`,
    18,
    14
  );

  const prompt = game.round.prompt;
  ctx.fillStyle = PEARL;
  ctx.font = "48px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(prompt.text, WINDOW_WIDTH / 2, WINDOW_HEIGHT * 0.18);

  if (prompt.pearls) {
    for (const pearl of prompt.pearls) drawPearl(pearl.x, pearl.y, 18);
  }

  game.round.choices.forEach((value, index) => drawBubbleButton(index, value));
  drawSparkles();

  if (feedback) {
    const progress = 1 - feedback.remaining / feedback.total;
    const pop = easeOutBack(Math.min(1, progress * 1.4));
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = feedback.correct ? SEAFOAM : CORAL;
    const width = 260 * pop;
    const height = 84 * pop;
    ctx.fillRect(WINDOW_WIDTH / 2 - width / 2, WINDOW_HEIGHT * 0.36 - height / 2, width, height);
    ctx.fillStyle = INK;
    ctx.font = `${Math.max(10, 42 * pop)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(feedback.message, WINDOW_WIDTH / 2, WINDOW_HEIGHT * 0.36);
    ctx.globalAlpha = 1;
  }

  if (scene === "welcome") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.43)";
    ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
    ctx.fillStyle = PEARL;
    ctx.font = "88px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Mermaid Math", WINDOW_WIDTH / 2, WINDOW_HEIGHT * 0.3);
    const pulse = 0.92 + 0.1 * ((Math.sin(time * 2.2) + 1) / 2);
    ctx.fillStyle = SEAFOAM;
    ctx.font = `${Math.round(52 * pulse)}px 'Trebuchet MS', sans-serif`;
    ctx.fillText("Tap to play", WINDOW_WIDTH / 2, WINDOW_HEIGHT * 0.45);
    ctx.fillStyle = LAVENDER;
    ctx.font = "26px 'Trebuchet MS', sans-serif";
    ctx.fillText("ESC shows and hides this screen", WINDOW_WIDTH / 2, WINDOW_HEIGHT * 0.55);
  }
}

// ----------------------------------------------------------------------- input

function answerWith(index: number): void {
  if (scene !== "playing" || feedback) return;
  const value = game.round.choices[index];
  if (value === undefined) return;

  const outcome = answer(game, value);
  feedback = {
    correct: outcome.correct,
    message: outcome.message,
    remaining: outcome.correct ? 0.85 : 0.55,
    total: outcome.correct ? 0.85 : 0.55,
  };
  if (outcome.correct) {
    const center = buttonCenter(index);
    celebrate(center.x, center.y);
    saveBestStreak(game.bestStreak);
  } else {
    wiggle.set(index, 1.7);
  }
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (scene === "welcome") {
    scene = "playing";
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * WINDOW_WIDTH;
  const y = ((event.clientY - bounds.top) / bounds.height) * WINDOW_HEIGHT;
  game.round.choices.forEach((_, index) => {
    const center = buttonCenter(index);
    if (Math.hypot(center.x - x, center.y - y) <= BUBBLE_RADIUS * 1.1) answerWith(index);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    scene = scene === "welcome" ? "playing" : "welcome";
    return;
  }
  if (scene === "welcome") {
    if (event.key === "Enter" || event.key === " ") scene = "playing";
    return;
  }
  // Any number you can see is an answer you can type.
  const typed = Number(event.key);
  if (!Number.isInteger(typed)) return;
  const index = game.round.choices.indexOf(typed);
  if (index >= 0) answerWith(index);
});

// ------------------------------------------------------------------- the loop

let lastFrame = performance.now();

function frame(now: number): void {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += seconds;

  if (Math.random() < 0.16) spawnBubble();
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * seconds;
    bubble.phase += seconds * 2;
    bubble.x += Math.sin(bubble.phase) * bubble.wobble * seconds;
    bubble.alpha -= seconds * 18;
  }
  for (let i = bubbles.length - 1; i >= 0; i -= 1) {
    const bubble = bubbles[i];
    if (bubble && (bubble.y < -120 || bubble.alpha <= 0)) bubbles.splice(i, 1);
  }

  for (const sparkle of sparkles) {
    sparkle.age += seconds;
    sparkle.x += sparkle.vx * seconds;
    sparkle.y += sparkle.vy * seconds;
    sparkle.vy += 420 * seconds;
    sparkle.vx *= 0.98;
    sparkle.vy *= 0.98;
  }
  for (let i = sparkles.length - 1; i >= 0; i -= 1) {
    const sparkle = sparkles[i];
    if (sparkle && sparkle.age >= sparkle.life) sparkles.splice(i, 1);
  }

  for (const [index, amount] of wiggle) {
    const next = amount - seconds * 8 * amount;
    if (next <= 0.01) wiggle.delete(index);
    else wiggle.set(index, next);
  }

  if (feedback) {
    feedback.remaining -= seconds;
    if (feedback.remaining <= 0) {
      if (feedback.correct) advance(game);
      feedback = null;
    }
  }

  drawFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
