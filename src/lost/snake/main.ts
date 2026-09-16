import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import {
  BASE_SNAKE_SIZE,
  DARK_GREEN,
  FOOD_COLOR,
  LIME_GREEN,
  POOP_COLOR,
  RAINBOW,
  RAINBOW_RGB,
  SECONDS_UNTIL_SELF_DESTRUCT,
  Snake,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  randomSpot,
  scoreAfterStar,
  starAge,
  starIsGone,
  type Direction,
  type Spot,
  type StarFood,
} from "./snakeGame";

installOofShortcut();
installForceRefreshHotkey();

const HIGH_SCORE_KEY = "lost-snake-high-score";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

let round = 0;
let score = 0;
let gameNumber = 0;
let highScore = readHighScore();
let foodLocation: Spot = { x: WINDOW_WIDTH - 3 * BASE_SNAKE_SIZE, y: WINDOW_HEIGHT - 3 * BASE_SNAKE_SIZE };
let starFood: StarFood | null = null;
let poops: Spot[] = [];
let state: "playing" | "paused" | "game over" = "playing";
const snake = new Snake({ x: WINDOW_WIDTH / 2, y: WINDOW_HEIGHT / 2 });

function readHighScore(): number {
  try {
    const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  } catch {
    // Then the score only lasts as long as the page does.
  }
}

// ---------- drawing ----------

function drawRainbow(): void {
  const stripeWidth = Math.floor(WINDOW_WIDTH / RAINBOW.length);
  RAINBOW.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, WINDOW_HEIGHT);
  });
  ctx.fillStyle = RAINBOW[RAINBOW.length - 1] ?? "rgb(255, 0, 255)";
  ctx.fillRect(RAINBOW.length * stripeWidth, 0, WINDOW_WIDTH - RAINBOW.length * stripeWidth, WINDOW_HEIGHT);
}

function drawStar(color: string, middle: Spot, radius: number, filled = true): void {
  const points = 5;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = (Math.PI * 2 * i) / (points * 2);
    const r = i % 2 === 0 ? radius : radius / 2;
    const x = middle.x + r * Math.sin(angle);
    const y = middle.y - r * Math.cos(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

// The lucky star has lines drawn from its points towards the middle.
function drawStarLines(color: string, middle: Spot, radius: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.moveTo(middle.x + radius * 0.7 * Math.sin(angle), middle.y - radius * 0.7 * Math.cos(angle));
    ctx.lineTo(middle.x + radius * 0.3 * Math.sin(angle), middle.y - radius * 0.3 * Math.cos(angle));
    ctx.stroke();
  }
}

// A normal star is a stack of rainbow stars that loses a colour every second,
// and the one on top fades to grey as its second runs out.
function drawStarFood(star: StarFood, now: number): void {
  if (star.kind === "lucky") {
    const size = 2 * RAINBOW.length;
    drawStar(LIME_GREEN, star.spot, size);
    drawStarLines(DARK_GREEN, star.spot, size);
    return;
  }

  const age = starAge(star, now);
  const whole = Math.floor(age);
  const maxSize = 2 * RAINBOW.length;
  const colorsToDraw = Math.max(0, RAINBOW.length - whole);
  for (let i = 0; i < colorsToDraw; i += 1) {
    const x = whole + i;
    const base = RAINBOW_RGB[x] ?? [128, 128, 128];
    let color = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
    if (i === 0) {
      const timeForEachColor = SECONDS_UNTIL_SELF_DESTRUCT / RAINBOW.length;
      const dt = age % timeForEachColor;
      color = `rgb(${Math.round(base[0] * (1 - dt) + 128 * dt)}, ${Math.round(base[1] * (1 - dt) + 128 * dt)}, ${Math.round(base[2] * (1 - dt) + 128 * dt)})`;
    }
    drawStar(color, star.spot, maxSize - 2 * x);
  }
}

function draw(now: number): void {
  drawRainbow();

  ctx.fillStyle = "rgb(255, 255, 255)";
  for (const part of snake.positions) ctx.fillRect(part.x, part.y, snake.size, snake.size);

  ctx.fillStyle = FOOD_COLOR;
  ctx.beginPath();
  ctx.arc(foodLocation.x, foodLocation.y, snake.size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = POOP_COLOR;
  for (const poop of poops) ctx.fillRect(poop.x, poop.y, BASE_SNAKE_SIZE, BASE_SNAKE_SIZE);

  if (starFood) drawStarFood(starFood, now);

  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "30px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Score: ${score}`, WINDOW_WIDTH / 2, 50);
  ctx.font = "13px 'Trebuchet MS', sans-serif";
  ctx.fillText(`High Score: ${highScore}`, WINDOW_WIDTH / 2, 74);

  if (state === "paused" || state === "game over") {
    const over = state === "game over";
    ctx.fillStyle = over ? "rgb(238, 130, 238)" : "rgb(0, 0, 0)";
    ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
    ctx.fillStyle = over ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
    ctx.font = "30px 'Trebuchet MS', sans-serif";
    ctx.fillText(over ? "Game Over" : "Paused", WINDOW_WIDTH / 2, WINDOW_HEIGHT / 2);
    ctx.font = "18px 'Trebuchet MS', sans-serif";
    ctx.fillText(
      over ? "Press any key to play again" : "ESC to carry on",
      WINDOW_WIDTH / 2,
      WINDOW_HEIGHT / 2 + 40
    );
  }
}

// ---------- the game ----------

function resetGame(): void {
  snake.reset({ x: WINDOW_WIDTH / 2, y: WINDOW_HEIGHT / 2 });
  poops = [];

  // Die three times in a row without scoring and you're given a lucky star.
  gameNumber = score === 0 ? gameNumber + 1 : 0;
  if (gameNumber === 3) {
    gameNumber = 0;
    starFood = { spot: randomSpot(), kind: "lucky", addedAt: performance.now() };
  } else {
    starFood = null;
  }

  round = 0;
  score = 0;
  foodLocation = randomSpot();
  state = "playing";
}

function step(now: number): void {
  if (state !== "playing") return;

  if (
    snake.isTouchingItself() ||
    snake.isOutsideWindow() ||
    poops.some((poop) => snake.isTouching(poop, BASE_SNAKE_SIZE / 2))
  ) {
    state = "game over";
    return;
  }

  if (starFood && starIsGone(starFood, now)) starFood = null;

  if (snake.isTouching(foodLocation, snake.size / 2)) {
    snake.grow(4);
    round += 1;
    score += 1;
    snake.makePoop();
    foodLocation = randomSpot();
    if (round % 3 === 0) starFood = { spot: randomSpot(), kind: "normal", addedAt: now };
  }

  if (starFood && snake.isTouching(starFood.spot, snake.size / 2)) {
    score = scoreAfterStar(score);
    snake.grow(12);
    // A normal star also makes the snake bigger and faster, which is its own problem.
    if (starFood.kind === "normal") {
      snake.speed += 1;
      snake.size += 5;
    }
    starFood = null;
  }

  const newPoop = snake.update();
  if (newPoop) poops.push(newPoop);

  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }
}

// The old game ran at 60 frames a second, and everything is measured in frames.
let lastStep = performance.now();
function frame(now: number): void {
  while (now - lastStep >= 1000 / 60) {
    step(now);
    lastStep += 1000 / 60;
  }
  if (now - lastStep > 500) lastStep = now;
  draw(now);
  requestAnimationFrame(frame);
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  ArrowUp: "UP",
  ArrowDown: "DOWN",
};

window.addEventListener("keydown", (event) => {
  if (event.key.startsWith("Arrow") || event.key === " ") event.preventDefault();
  if (state === "playing") {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) snake.setDirection(direction);
    else if (event.key === "Escape") state = "paused";
    return;
  }
  if (state === "paused") {
    if (event.key === "Escape") state = "playing";
    return;
  }
  resetGame();
});

// Clicking on the snake makes it poop, same as it always did.
canvas.addEventListener("pointerdown", (event) => {
  const box = canvas.getBoundingClientRect();
  const x = ((event.clientX - box.left) * WINDOW_WIDTH) / box.width;
  const y = ((event.clientY - box.top) * WINDOW_HEIGHT) / box.height;
  if (snake.isTouching({ x, y }, 0)) snake.makePoop();
});

requestAnimationFrame(frame);
