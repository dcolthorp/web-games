import { isGigantic } from "../../shared/bigGames";
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { isThisGameSupercharged } from "../../shared/superchargedHub";
import {
  COIN_SIZE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  coinBox,
  dollarBox,
  newGame,
  overlaps,
  pushWallsBack,
  shadowAt,
  spawnSpot,
  step,
  type Box,
  type Coin,
  type Game,
  type Walls,
} from "./wallDodger";

installOofShortcut();
installForceRefreshHotkey();

const BEST_KEY = "lost-wall-dodger-best";

// GIGANTIC Wall Dodger: you stay your normal size, and the ball, the coins and
// the dollars are giant.
const GIGANTIC = isGigantic("wall-dodger");
const GIANT = GIGANTIC ? 3 : 1;
if (GIGANTIC) {
  document.title = "GIGANTIC Wall Dodger Survival";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "GIGANTIC Wall Dodger Survival";
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

let game: Game = newGame(GIANT);
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

// Supercharged by dev.1: every so often a blue lightning coin turns up. Grab
// it and lightning strikes the ball, freezing it solid for four seconds (you
// can walk right through it), and the blast throws the walls all the way back.
const SUPERCHARGED = isThisGameSupercharged();
const LIGHTNING_COIN_SECONDS = 12;
const FREEZE_SECONDS = 4;
let lightningCoin: Coin | null = null;
let lastLightningCoin = 0;
let strike: { x: number; y: number; time: number } | null = null;

function superchargedStep(): void {
  if (game.over) return;
  if (!lightningCoin && game.elapsed - lastLightningCoin > LIGHTNING_COIN_SECONDS) {
    lightningCoin = spawnSpot(game, COIN_SIZE * GIANT, COIN_SIZE * GIANT);
    lastLightningCoin = game.elapsed;
  }
  if (lightningCoin && overlaps(game.player, coinBox(lightningCoin, GIANT))) {
    lightningCoin = null;
    lastLightningCoin = game.elapsed;
    game.frozenUntil = game.elapsed + FREEZE_SECONDS;
    pushWallsBack(game, SCREEN_WIDTH);
    strike = { ...middleOf(game.ball), time: performance.now() };
  }
}

function drawSupercharged(now: number): void {
  if (lightningCoin) {
    ctx.fillStyle = Math.floor(now / 150) % 2 === 0 ? "rgb(60, 200, 255)" : "rgb(160, 240, 255)";
    ctx.beginPath();
    ctx.arc(lightningCoin.x, lightningCoin.y, (COIN_SIZE * GIANT) / 2 + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(255, 255, 90)";
    ctx.font = `bold ${14 * GIANT}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡", lightningCoin.x, lightningCoin.y + 1);
  }

  // The frozen ball gets a coat of ice.
  if ((game.frozenUntil ?? 0) > game.elapsed && !game.over) {
    const ball = middleOf(game.ball);
    ctx.fillStyle = "rgba(170, 230, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, game.ball.width / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const left = Math.ceil((game.frozenUntil ?? 0) - game.elapsed);
    ctx.fillText(`FROZEN ${left}`, ball.x, ball.y - game.ball.width / 2 - 14);
  }

  // The strike itself: a bolt from the top of the screen down to the ball.
  if (strike && now - strike.time < 400) {
    const fade = 1 - (now - strike.time) / 400;
    ctx.fillStyle = `rgba(200, 240, 255, ${fade * 0.4})`;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    ctx.strokeStyle = `rgba(255, 255, 140, ${fade})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(strike.x, 0);
    for (let i = 1; i <= 8; i += 1) {
      const wiggle = i === 8 ? 0 : (Math.random() - 0.5) * 50;
      ctx.lineTo(strike.x + wiggle, (strike.y * i) / 8);
    }
    ctx.stroke();
  }
}

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
    ctx.arc(coin.x, coin.y, (COIN_SIZE * GIANT) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darken([255, 180, 0], shadow);
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, (COIN_SIZE * GIANT) / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const dollar of game.dollars) {
    const shadow = shadowAt(dollar.x, dollar.y, game.walls);
    const box = dollarBox(dollar, GIANT);
    const edge = 3 * GIANT;
    ctx.fillStyle = darken([0, 180, 0], shadow);
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = darken([0, 120, 0], shadow);
    ctx.fillRect(box.x + edge, box.y + edge, box.width - 2 * edge, box.height - 2 * edge);
    ctx.fillStyle = darken([220, 255, 220], shadow);
    ctx.font = `bold ${9 * GIANT}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$100", dollar.x, dollar.y + GIANT);
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
  ctx.arc(ballMiddle.x, ballMiddle.y, game.ball.width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = darken([255, 100, 100], ballShadow);
  ctx.beginPath();
  ctx.arc(ballMiddle.x - 5 * GIANT, ballMiddle.y - 5 * GIANT, game.ball.width / 6, 0, Math.PI * 2);
  ctx.fill();

  if (SUPERCHARGED) drawSupercharged(performance.now());

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
    if (SUPERCHARGED) superchargedStep();
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
    game = newGame(GIANT);
    startedAt = performance.now();
    lightningCoin = null;
    lastLightningCoin = 0;
    strike = null;
    return;
  }
  held.add(key);
});

window.addEventListener("keyup", (event) => held.delete(event.key.toLowerCase()));

requestAnimationFrame(frame);
