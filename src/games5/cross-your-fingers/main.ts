import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import {
  COIN_VALUES,
  COLS,
  GRASS,
  ROWS,
  TILE,
  WATER,
  makePiece,
  pieceWorth,
  tileAt,
  type Coin,
  type Piece,
} from "./terrain";
import { HEIGHT, WIDTH, newWalker, updateWalker, type Walker } from "./walker";

installOofShortcut();
installForceRefreshHotkey();

// Cross Your Fingers. A piece of land is made up fresh every time, and you only
// get the one screenful of it. Run and jump around it and grab whatever coins
// luck put in there, then press NEW LAND and hope for better.

const PURSE_KEY = "cross-your-fingers-purse";
const BEST_KEY = "cross-your-fingers-best";
const COIN_LOOKS: Record<Coin["kind"], { face: string; edge: string; glow: string }> = {
  plain: { face: "#ffd76a", edge: "#a97a16", glow: "#ffe9a8" },
  blue: { face: "#6ac8ff", edge: "#1d6ea3", glow: "#bfe9ff" },
  red: { face: "#ff6a6a", edge: "#a32020", glow: "#ffc0c0" },
  black: { face: "#2a2a33", edge: "#8f8fa6", glow: "#c9c9ff" },
};

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const W = canvas.width;
const H = canvas.height;
const caption = document.getElementById("caption");

let piece: Piece = makePiece(Math.floor(Math.random() * 1000000));
let walker: Walker = newWalker(piece.spawnX, piece.spawnY);
let purse = readNumber(PURSE_KEY);
let best = readNumber(BEST_KEY);
let thisPiece = 0;
let landedAt = performance.now();
let lastFrame = performance.now();
const held = new Set<string>();

function readNumber(key: string): number {
  try {
    const saved = Number(localStorage.getItem(key));
    return Number.isFinite(saved) ? saved : 0;
  } catch {
    return 0;
  }
}

function remember(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Then it only counts for this go.
  }
}

// ---------- sound ----------

let audio: AudioContext | null = null;

function note(pitch: number, length: number, loudness: number, shape: OscillatorType = "triangle"): void {
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  audio ??= new AudioContextClass();
  void audio.resume().catch(() => {});
  const now = audio.currentTime;
  const sound = audio.createOscillator();
  sound.type = shape;
  sound.frequency.setValueAtTime(pitch, now);
  sound.frequency.exponentialRampToValueAtTime(pitch * 1.5, now + length * 0.8);
  const level = audio.createGain();
  level.gain.setValueAtTime(loudness, now);
  level.gain.exponentialRampToValueAtTime(0.001, now + length);
  sound.connect(level).connect(audio.destination);
  sound.start(now);
  sound.stop(now + length + 0.02);
}

// The rarer the coin, the brighter the sound.
const COIN_NOTES: Record<Coin["kind"], number> = { plain: 660, blue: 880, red: 1100, black: 1320 };

// ---------- the game ----------

function newLand(): void {
  piece = makePiece(Math.floor(Math.random() * 1000000));
  walker = newWalker(piece.spawnX, piece.spawnY);
  thisPiece = 0;
  landedAt = performance.now();
  if (caption) caption.textContent = `New land with ${piece.coins.length} coins in it.`;
  note(220, 0.25, 0.2, "sawtooth");
}

function controls(): { move: number; jump: boolean } {
  const down = (...keys: string[]): boolean => keys.some((key) => held.has(key));
  return {
    move: Number(down("d", "arrowright")) - Number(down("a", "arrowleft")),
    jump: down("w", "arrowup", " ", "space"),
  };
}

function collectCoins(): void {
  for (const coin of piece.coins) {
    if (coin.taken) continue;
    const middleX = coin.x * TILE;
    const middleY = coin.y * TILE;
    const near = Math.hypot(middleX - walker.x, middleY - (walker.y - HEIGHT / 2)) < TILE * 0.9;
    if (!near) continue;
    coin.taken = true;
    const worth = COIN_VALUES[coin.kind];
    purse += worth;
    thisPiece += worth;
    remember(PURSE_KEY, purse);
    if (thisPiece > best) {
      best = thisPiece;
      remember(BEST_KEY, best);
    }
    note(COIN_NOTES[coin.kind], 0.18, 0.22);
    if (caption) caption.textContent = `${coin.kind} coin, worth ${worth}.`;
  }
}

// ---------- drawing ----------

function drawSky(now: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#22436b");
  sky.addColorStop(0.55, "#4c7fa8");
  sky.addColorStop(1, "#8bb7c8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // A few clouds, drifting along slowly, different on every piece of land.
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  for (let cloud = 0; cloud < 5; cloud += 1) {
    const drift = (now / 90 + cloud * 220 + piece.seed * 13) % (W + 260);
    const x = W + 130 - drift;
    const y = 50 + ((cloud * 37 + piece.seed) % 120);
    for (const [dx, dy, r] of [
      [0, 0, 26],
      [30, -10, 34],
      [62, 2, 24],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLand(): void {
  for (let x = 0; x < COLS; x += 1) {
    for (let y = 0; y < ROWS; y += 1) {
      const tile = tileAt(piece, x, y);
      if (tile === 0 || tile === WATER) continue;
      const left = x * TILE;
      const top = y * TILE;
      if (tile === GRASS) {
        ctx.fillStyle = "#6b4a2a";
        ctx.fillRect(left, top, TILE, TILE);
        ctx.fillStyle = "#4bb14b";
        ctx.fillRect(left, top, TILE, 7);
      } else if (tile === 2) {
        ctx.fillStyle = "#6b4a2a";
        ctx.fillRect(left, top, TILE, TILE);
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(left + ((x * 7 + y * 3) % 10), top + ((y * 5) % 12), 6, 5);
      } else {
        ctx.fillStyle = "#59606b";
        ctx.fillRect(left, top, TILE, TILE);
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(left + ((x * 5) % 14), top + ((y * 9) % 14), 5, 4);
      }
      ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, TILE - 1, TILE - 1);
    }
  }
}

// The water goes on top of everything in the land, so whatever is under it
// looks like it's under it.
function drawWater(now: number): void {
  if (piece.waterLevel >= ROWS) return;
  for (let x = 0; x < COLS; x += 1) {
    for (let y = piece.waterLevel; y < ROWS; y += 1) {
      if (tileAt(piece, x, y) !== WATER) continue;
      const deep = Math.min(1, (y - piece.waterLevel) / 8);
      ctx.fillStyle = `rgba(${Math.round(56 - deep * 30)}, ${Math.round(140 - deep * 70)}, ${Math.round(216 - deep * 60)}, ${0.5 + deep * 0.18})`;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  // A wave along the top of the water.
  ctx.strokeStyle = "rgba(190, 235, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x += 1) {
    if (tileAt(piece, Math.min(x, COLS - 1), piece.waterLevel) !== WATER) continue;
    const wave = Math.sin(now / 400 + x / 2) * 2.5;
    const left = x * TILE;
    ctx.moveTo(left, piece.waterLevel * TILE + wave);
    ctx.lineTo(left + TILE, piece.waterLevel * TILE + Math.sin(now / 400 + (x + 1) / 2) * 2.5);
  }
  ctx.stroke();
}

function drawCoins(now: number): void {
  for (const coin of piece.coins) {
    if (coin.taken) continue;
    const look = COIN_LOOKS[coin.kind];
    const x = coin.x * TILE;
    const y = coin.y * TILE + Math.sin(now / 320 + coin.x) * 3;
    const squash = Math.abs(Math.cos(now / 400 + coin.x)) * 0.75 + 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(squash, 1);
    ctx.shadowColor = look.glow;
    ctx.shadowBlur = coin.kind === "black" ? 18 : 10;
    ctx.fillStyle = look.face;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = look.edge;
    ctx.stroke();
    ctx.restore();
  }
}

function drawWalker(now: number): void {
  const bounce = walker.onGround && Math.abs(walker.vx) > 1 ? Math.sin(walker.walked / 9) * 2 : 0;
  const left = walker.x - WIDTH / 2;
  const top = walker.y - HEIGHT + bounce;

  ctx.fillStyle = "#1b2230";
  ctx.fillRect(left, top + 7, WIDTH, HEIGHT - 7);
  ctx.fillStyle = "#ffd9b0";
  ctx.beginPath();
  ctx.arc(walker.x, top + 5, 7, 0, Math.PI * 2);
  ctx.fill();
  // Eyes, looking the way he's going.
  ctx.fillStyle = "#1b2230";
  ctx.beginPath();
  ctx.arc(walker.x + walker.facing * 2.5, top + 4, 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Legs, when he's running.
  ctx.strokeStyle = "#1b2230";
  ctx.lineWidth = 3;
  const swing = walker.onGround ? Math.sin(walker.walked / 9) * 4 : 3;
  ctx.beginPath();
  ctx.moveTo(walker.x - 3, walker.y - 1 + bounce);
  ctx.lineTo(walker.x - 3 + swing, walker.y + 2 + bounce);
  ctx.moveTo(walker.x + 3, walker.y - 1 + bounce);
  ctx.lineTo(walker.x + 3 - swing, walker.y + 2 + bounce);
  ctx.stroke();
  void now;
}

function drawHud(now: number): void {
  ctx.fillStyle = "rgba(8, 14, 22, 0.66)";
  ctx.fillRect(12, 12, 290, walker.swimming ? 96 : 74);
  ctx.fillStyle = "#ffd76a";
  ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`PURSE ${purse}`, 24, 20);
  ctx.font = "16px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#cfe0f2";
  const left = piece.coins.filter((coin) => !coin.taken).length;
  ctx.fillText(`This land: ${thisPiece} · ${left} coin${left === 1 ? "" : "s"} left`, 24, 52);
  if (walker.swimming) {
    ctx.fillStyle = "#8fd8ff";
    ctx.fillText("SWIMMING — hold jump to go up", 24, 74);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#9fb2c6";
  ctx.fillText(`BEST LAND ${best}`, W - 20, 20);

  // What this piece was worth, said once when it appears.
  if (now - landedAt < 2600) {
    const worth = pieceWorth(piece);
    ctx.globalAlpha = Math.min(1, (2600 - (now - landedAt)) / 600);
    ctx.textAlign = "center";
    ctx.fillStyle = worth >= 25 ? "#ffd76a" : "#e7eef7";
    ctx.font = "bold 30px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText(
      worth >= 30 ? `${worth} COINS IN HERE — GOOD LUCK` : `${worth} coins in this one`,
      W / 2,
      H - 60
    );
    ctx.globalAlpha = 1;
  }
}

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  updateWalker(piece, walker, controls(), dt);
  collectCoins();

  drawSky(now);
  drawLand();
  drawCoins(now);
  drawWalker(now);
  drawWater(now);
  drawHud(now);

  requestAnimationFrame(frame);
}

// ---------- keys and buttons ----------

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLButtonElement) return;
  const key = event.key.toLowerCase();
  if (key === " " || key.startsWith("arrow")) event.preventDefault();
  if (key === "r") {
    newLand();
    return;
  }
  held.add(key);
});

window.addEventListener("keyup", (event) => held.delete(event.key.toLowerCase()));
document.getElementById("new-land")?.addEventListener("click", newLand);

if (caption) caption.textContent = `A piece of land with ${piece.coins.length} coins in it.`;
requestAnimationFrame(frame);
