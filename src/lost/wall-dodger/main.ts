import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import {
  BALL_SIZE,
  COIN_SIZE,
  DOLLAR_HEIGHT,
  DOLLAR_WIDTH,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  coinBox,
  dollarBox,
  newGame,
  shadowAt,
  step,
  type Box,
  type Game,
  type Walls,
} from "./wallDodger";

installOofShortcut();
installForceRefreshHotkey();

const BEST_KEY = "lost-wall-dodger-best";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

let game: Game = newGame();
let startedAt = performance.now();
let best = readBest();
const held = new Set<string>();

function readBest(): number {
  try {
    const saved = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

// Things near a wall are in its shadow, which is how you feel them closing in.
function darken(color: [number, number, number], shadow: number): string {
  const [r, g, b] = color;
  return `rgb(${Math.round(r * (1 - shadow))}, ${Math.round(g * (1 - shadow))}, ${Math.round(b * (1 - shadow))})`;
}

const middleOf = (box: Box): { x: number; y: number } => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

function drawWalls(walls: Walls): void {
  ctx.fillStyle = "rgb(50, 50, 50)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, walls.top);
  ctx.fillRect(0, walls.bottom, SCREEN_WIDTH, SCREEN_HEIGHT - walls.bottom);
  ctx.fillRect(0, walls.top, walls.left, walls.bottom - walls.top);
  ctx.fillRect(walls.right, walls.top, SCREEN_WIDTH - walls.right, walls.bottom - walls.top);

  ctx.strokeStyle = "rgb(150, 150, 150)";
  ctx.lineWidth = 2;
  ctx.strokeRect(walls.left, walls.top, walls.right - walls.left, walls.bottom - walls.top);
}

function draw(): void {
  ctx.fillStyle = "rgb(0, 0, 0)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  drawWalls(game.walls);

  for (const coin of game.coins) {
    const shadow = shadowAt(coin.x, coin.y, game.walls);
    ctx.fillStyle = darken([255, 220, 0], shadow);
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, COIN_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darken([255, 180, 0], shadow);
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, COIN_SIZE / 4, 0, Math.PI * 2);
    ctx.fill();
    void coinBox;
  }

  for (const dollar of game.dollars) {
    const shadow = shadowAt(dollar.x, dollar.y, game.walls);
    const box = dollarBox(dollar);
    ctx.fillStyle = darken([0, 180, 0], shadow);
    ctx.fillRect(box.x, box.y, DOLLAR_WIDTH, DOLLAR_HEIGHT);
    ctx.fillStyle = darken([0, 120, 0], shadow);
    ctx.fillRect(box.x + 3, box.y + 3, DOLLAR_WIDTH - 6, DOLLAR_HEIGHT - 6);
    ctx.fillStyle = darken([220, 255, 220], shadow);
    ctx.font = "bold 9px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$100", dollar.x, dollar.y + 1);
  }

  const playerMiddle = middleOf(game.player);
  const playerShadow = shadowAt(playerMiddle.x, playerMiddle.y, game.walls);
  ctx.fillStyle = darken([0, 100, 255], playerShadow);
  ctx.fillRect(game.player.x, game.player.y, game.player.width, game.player.height);
  ctx.fillStyle = darken([100, 150, 255], playerShadow);
  ctx.fillRect(game.player.x + 4, game.player.y + 4, game.player.width - 12, game.player.height - 12);

  const ballMiddle = middleOf(game.ball);
  const ballShadow = shadowAt(ballMiddle.x, ballMiddle.y, game.walls);
  ctx.fillStyle = darken([255, 0, 0], ballShadow);
  ctx.beginPath();
  ctx.arc(ballMiddle.x, ballMiddle.y, BALL_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = darken([255, 100, 100], ballShadow);
  ctx.beginPath();
  ctx.arc(ballMiddle.x - 5, ballMiddle.y - 5, BALL_SIZE / 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(255, 255, 255)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "22px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Time: ${game.elapsed.toFixed(1)}s`, 14, 10);
  ctx.fillText(`Coins: ${game.coinsCollected}`, 14, 36);
  ctx.textAlign = "right";
  ctx.fillText(`Score: ${game.score}`, SCREEN_WIDTH - 14, 10);
  ctx.fillText(`Best: ${best}`, SCREEN_WIDTH - 14, 36);

  if (game.over) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.fillStyle = "rgb(255, 60, 60)";
    ctx.textAlign = "center";
    ctx.font = "62px 'Trebuchet MS', sans-serif";
    ctx.fillText("GAME OVER", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 90);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.font = "26px 'Trebuchet MS', sans-serif";
    ctx.fillText(`You lasted ${game.elapsed.toFixed(1)} seconds`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10);
    ctx.fillText(`Coins: ${game.coinsCollected} · Score: ${game.score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 26);
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText("Press ENTER to play again", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 76);
  }
}

function moves(): { left: boolean; right: boolean; up: boolean; down: boolean } {
  const down = (...keys: string[]): boolean => keys.some((key) => held.has(key));
  return {
    left: down("arrowleft", "a"),
    right: down("arrowright", "d"),
    up: down("arrowup", "w"),
    down: down("arrowdown", "s"),
  };
}

// The old game ran at sixty frames a second, and its speeds are per frame.
let lastStep = performance.now();
function frame(now: number): void {
  while (now - lastStep >= 1000 / 60) {
    step(game, moves(), (now - startedAt) / 1000);
    lastStep += 1000 / 60;
  }
  if (now - lastStep > 500) lastStep = now;

  if (game.over && game.score > best) {
    best = game.score;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Then it only counts for this go.
    }
  }

  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key.startsWith("arrow") || key === " ") event.preventDefault();
  if (game.over && (key === "enter" || key === " ")) {
    game = newGame();
    startedAt = performance.now();
    return;
  }
  held.add(key);
});

window.addEventListener("keyup", (event) => held.delete(event.key.toLowerCase()));

requestAnimationFrame(frame);
