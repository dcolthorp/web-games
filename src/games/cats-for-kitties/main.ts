import { createCafe } from "./cafe";
import { isGigantic } from "../../shared/bigGames";
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// GIGANTIC Catch the Kitties: the kitties, their cushions and your net stay
// their normal size; the room goes giant, and so does every kitty you catch
// as it leaps away.
const GIGANTIC = isGigantic("cats-for-kitties");
const GIANT = GIGANTIC ? 2.5 : 1;
if (GIGANTIC) {
  document.title = "GIGANTIC Catch the Kitties!!!";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "GIGANTIC Catch the Kitties!!!";
}

const W = 960;
const H = 600;
const HIGH_SCORE_KEY = "cats-for-kitties-high-score";
const COINS_KEY = "cats-for-kitties-coins";
const TOTAL_CAUGHT_KEY = "cats-for-kitties-total-caught";
const CREATIVE_KEY = "cats-for-kitties-creative";
const SKIN_KEY = "cats-for-kitties-net-skin";
const SPAWN_MIN_MS = 4000;
const SPAWN_MAX_MS = 5000;
const STAY_UP_MS = 5000;
const POP_MS = 450;
const NET_RADIUS = 62;

type CatKind = "gray" | "pink" | "red" | "blue" | "black" | "pumpkin" | "rainbow";

interface CatType {
  kind: CatKind;
  points: number;
  weight: number; // out of 100: gray is 1 in 2, rainbow is 1 in 100
  fill: string;
  inner: string;
  eyes: string;
  title: string;
  odds: string;
  bio: string;
}

const CAT_TYPES: CatType[] = [
  { kind: "gray", points: 1, weight: 50, fill: "#a9adb5", inner: "#f3a6b8", eyes: "#2b2b3a", title: "Gray Cat", odds: "1 in 2", bio: "Super gray. Super duper sad. Has been staring out of the hole since Tuesday and nobody asked why." },
  { kind: "pink", points: 2, weight: 20, fill: "#ff8fc7", inner: "#ffd0e8", eyes: "#2b2b3a", title: "Pink Cat", odds: "1 in 5", bio: "Is convinced she is a marshmallow. Will not be corrected. Smells like strawberry and confidence." },
  { kind: "red", points: 3, weight: 12, fill: "#e8383d", inner: "#ff9a9a", eyes: "#2b2b3a", title: "Red Cat", odds: "about 1 in 8", bio: "Always angry about something small, like Wednesdays. Blushes when you catch him, but says it is just the sun." },
  { kind: "blue", points: 5, weight: 8, fill: "#4a9bff", inner: "#a8d2ff", eyes: "#2b2b3a", title: "Blue Cat", odds: "about 1 in 12", bio: "Very cool and very chill. Once stayed under water for fun and came back with a tiny crab friend." },
  { kind: "black", points: 10, weight: 5, fill: "#1b1b22", inner: "#4a3a55", eyes: "#3dff6a", title: "Black Cat", odds: "1 in 20", bio: "A mysterious ninja with a white outline and glowing green eyes. Nobody has ever seen him walk in. He is just suddenly there." },
  { kind: "pumpkin", points: 20, weight: 4, fill: "#ff9226", inner: "#ffd09a", eyes: "#2b2b3a", title: "Pumpkin Cat", odds: "1 in 25", bio: "Orange, round, and extremely fall. Thinks every day is Halloween and wants candy at breakfast." },
  { kind: "rainbow", points: 100, weight: 1, fill: "#ffffff", inner: "#ffd0f0", eyes: "#2b2b3a", title: "Rainbow Cat", odds: "1 in 100", bio: "The legend. Sparkles when she sneezes. Fell out of a rainbow once and says it was totally on purpose." },
];

interface NetSkin {
  id: string;
  tier: string;
  name: string;
  need: number; // kitties caught, ever, to unlock
  rim: string;
  handle: string;
  mesh: string;
  look: "plain" | "galaxy" | "frost" | "fire" | "electric" | "aurora" | "ethereal" | "godly";
}

const NET_SKINS: NetSkin[] = [
  { id: "adult", tier: "Adult", name: "Plain Net", need: 0, rim: "#7a2fc0", handle: "#b8742f", mesh: "rgba(255,255,255,0.35)", look: "plain" },
  { id: "sweet", tier: "Sweet", name: "Bubblegum Net", need: 10, rim: "#ff4fa8", handle: "#ff9ccf", mesh: "rgba(255,200,230,0.4)", look: "plain" },
  { id: "super", tier: "Super", name: "Mint Net", need: 20, rim: "#1fc98a", handle: "#0d7a55", mesh: "rgba(190,255,225,0.4)", look: "plain" },
  { id: "epic", tier: "Epic", name: "Ocean Net", need: 35, rim: "#1f78ff", handle: "#1b4fa8", mesh: "rgba(170,220,255,0.4)", look: "plain" },
  { id: "rare", tier: "Rare", name: "Sunset Net", need: 50, rim: "#ff7a2f", handle: "#a8381b", mesh: "rgba(255,200,150,0.4)", look: "plain" },
  { id: "legendary", tier: "Legendary", name: "Golden Net", need: 75, rim: "#ffc61a", handle: "#c78a00", mesh: "rgba(255,240,170,0.4)", look: "plain" },
  { id: "mythic", tier: "Mythic", name: "Ruby Net", need: 100, rim: "#e0143c", handle: "#6d0a20", mesh: "rgba(255,160,180,0.4)", look: "plain" },
  { id: "shadow", tier: "Shadow", name: "Midnight Net", need: 150, rim: "#15151c", handle: "#2a2a35", mesh: "rgba(20,20,30,0.55)", look: "plain" },
  { id: "cosmic", tier: "Cosmic", name: "Galaxy Net", need: 200, rim: "#4b2aa8", handle: "#1b1038", mesh: "rgba(30,16,70,0.55)", look: "galaxy" },
  { id: "frozen", tier: "Frozen", name: "Ice Net", need: 300, rim: "#8fe3ff", handle: "#d6f6ff", mesh: "rgba(210,245,255,0.45)", look: "frost" },
  { id: "blazing", tier: "Blazing", name: "Fire Net", need: 450, rim: "#ff5a1f", handle: "#7a1a05", mesh: "rgba(255,150,60,0.35)", look: "fire" },
  { id: "electric", tier: "Electric", name: "Lightning Net", need: 650, rim: "#ffe62d", handle: "#3a3a55", mesh: "rgba(255,250,170,0.35)", look: "electric" },
  { id: "celestial", tier: "Celestial", name: "Starlight Net", need: 900, rim: "#ffe9a8", handle: "#6b4fc4", mesh: "rgba(40,20,90,0.55)", look: "galaxy" },
  { id: "immortal", tier: "Immortal", name: "Aurora Net", need: 1250, rim: "#7dffcf", handle: "#3a2a7a", mesh: "rgba(150,255,220,0.3)", look: "aurora" },
  { id: "ethereal", tier: "Ethereal", name: "Ethereal Net", need: 1750, rim: "#bff4ff", handle: "#e8fbff", mesh: "rgba(210,250,255,0.35)", look: "ethereal" },
  { id: "godly", tier: "Godly", name: "Godly Net", need: 2500, rim: "#ffffff", handle: "#ffd34d", mesh: "rgba(255,255,255,0.25)", look: "godly" },
];

interface Cat {
  type: CatType;
  stay: number;
  spot: number;
  born: number;
}

// A caught kitty leaping out of its hole and off the screen.
interface Leaper {
  type: CatType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  born: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const pauseButton = document.getElementById("pause") as HTMLButtonElement;
const catIndexButton = document.getElementById("cat-index-button") as HTMLButtonElement;
const catIndexPanel = document.getElementById("cat-index") as HTMLElement;
const catIndexBack = document.getElementById("cat-index-back") as HTMLButtonElement;
const catIndexList = document.getElementById("cat-index-list") as HTMLUListElement;
const cafeButton = document.getElementById("cafe-button") as HTMLButtonElement;
const cafePanel = document.getElementById("cafe") as HTMLElement;
const skinsButton = document.getElementById("skins-button") as HTMLButtonElement;
const skinsPanel = document.getElementById("skins") as HTMLElement;
const skinsBack = document.getElementById("skins-back") as HTMLButtonElement;
const skinsList = document.getElementById("skins-list") as HTMLUListElement;
const skinsCount = document.getElementById("skins-count") as HTMLElement;

// Cushion spots the kitties pop up from.
const SPOTS = [
  { x: 150, y: 330 }, { x: 480, y: 300 }, { x: 810, y: 330 },
  { x: 150, y: 520 }, { x: 480, y: 500 }, { x: 810, y: 520 },
];

let cats: Cat[] = [];
let floaters: Floater[] = [];
let leapers: Leaper[] = [];
let score = 0;
let caught = 0;
let totalCaught = readNumber(TOTAL_CAUGHT_KEY);
// Creative mode: every net is unlocked, kitties stay until caught, and nothing you do is saved.
let creative = readString(CREATIVE_KEY) === "true";
let skinId = readString(SKIN_KEY) ?? "adult";
let highScore = readHighScore();
// Treats from the Cat Cafe last a while (in play time, so pausing doesn't use them up).
const TREAT_MS = 40000;
const effectEnds = { stay: 0, bigNet: 0, double: 0 };
let coins = readNumber(COINS_KEY);

let clock = 0; // game time: stops while paused so kitties wait too
let lastReal = 0;
let paused = false;
let leapStep = 0;
let nextSpawn = 1200;
let netX = W / 2;
let netY = H / 2;
let swingStart = -10000;

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readNumber(key: string): number {
  return Number(readString(key)) || 0;
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // saving is optional
  }
}

function currentSkin(): NetSkin {
  const skin = NET_SKINS.find((s) => s.id === skinId);
  return skin && (creative || totalCaught >= skin.need) ? skin : NET_SKINS[0]!;
}

function readHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function pickType(): CatType {
  let roll = Math.random() * 100;
  for (const type of CAT_TYPES) {
    roll -= type.weight;
    if (roll < 0) return type;
  }
  return CAT_TYPES[0]!;
}

function spawnCat(now: number): void {
  const free = SPOTS.map((_, i) => i).filter((i) => !cats.some((c) => c.spot === i));
  if (free.length > 0) {
    cats.push({ type: pickType(), stay: creative ? Infinity : now < effectEnds.stay ? STAY_UP_MS + 3000 : STAY_UP_MS, spot: free[Math.floor(Math.random() * free.length)]!, born: now });
  }
  nextSpawn = now + SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
}

// Overshoots a little so the kitty hops up out of the hole.
function easeOutBack(t: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// 0 = hidden, 1 = fully popped up
function popAmount(cat: Cat, now: number): number {
  const age = now - cat.born;
  if (age < POP_MS) return easeOutBack(age / POP_MS);
  if (age < POP_MS + cat.stay) return 1;
  return Math.max(0, 1 - (age - POP_MS - cat.stay) / POP_MS);
}

function catCenter(cat: Cat, now: number): { x: number; y: number } {
  const spot = SPOTS[cat.spot]!;
  return { x: spot.x, y: spot.y + 70 - popAmount(cat, now) * 100 };
}

function cafeStop(): void {
  cafe.stop();
}

function setPaused(value: boolean): void {
  paused = value;
  catIndexButton.hidden = !paused;
  skinsButton.hidden = !paused;
  cafeButton.hidden = !paused;
  if (!paused) {
    catIndexPanel.hidden = true;
    skinsPanel.hidden = true;
    cafePanel.hidden = true;
    cafeStop();
  }
  pauseButton.textContent = paused ? "▶ Play" : "❚❚ Pause";
  pauseButton.setAttribute("aria-pressed", String(paused));
}

function netRadius(now: number): number {
  return now < effectEnds.bigNet ? NET_RADIUS * 1.35 : NET_RADIUS;
}

function swing(x: number, y: number): void {
  if (paused) return;
  const now = clock;
  swingStart = now;
  let hit = false;
  for (const cat of [...cats].reverse()) {
    if (popAmount(cat, now) < 0.5) continue;
    const c = catCenter(cat, now);
    if (Math.hypot(c.x - x, c.y - y) <= netRadius(now) + 20) {
      cats = cats.filter((other) => other !== cat);
      leapers.push({
        type: cat.type,
        x: c.x,
        y: c.y,
        vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 160),
        vy: -620 - Math.random() * 120,
        spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4),
        born: now,
      });
      const points = cat.type.points * (now < effectEnds.double ? 2 : 1);
      score += points;
      caught += 1;
      if (!creative) {
        totalCaught += 1;
        save(TOTAL_CAUGHT_KEY, String(totalCaught));
      }
      const unlocked = creative ? undefined : NET_SKINS.find((s) => s.need === totalCaught && s.need > 0);
      if (unlocked) floaters.push({ x: W / 2, y: 140, text: `New net: ${unlocked.tier}!`, color: "#ffe45e", born: now });
      hit = true;
      floaters.push({ x: c.x, y: c.y - 50, text: `+${points}`, color: "#fff", born: now });
      break;
    }
  }
  if (!hit) floaters.push({ x, y, text: "swish", color: "rgba(255,255,255,0.8)", born: now });
  if (!creative && score > highScore) {
    highScore = score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch {
      // saving is optional
    }
  }
}

function toCanvas(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
}

canvas.addEventListener("pointermove", (event) => {
  ({ x: netX, y: netY } = toCanvas(event));
});
canvas.addEventListener("pointerdown", (event) => {
  const p = toCanvas(event);
  netX = p.x;
  netY = p.y;
  swing(p.x, p.y);
});

function drawRoom(now: number): void {
  const bands = ["#ff6b8b", "#ff9f5a", "#ffe45e", "#6ddf7a", "#58b7ff", "#a07bff"];
  const bandH = 330 / bands.length;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * bandH, W, bandH + 1);
  });
  // floor
  ctx.fillStyle = "#ffe4f5";
  ctx.fillRect(0, 330, W, H - 330);
  ctx.fillStyle = "#ffc6e8";
  const tileW = 120 * GIANT;
  const tileH = 60 * GIANT;
  for (let x = -40; x < W; x += tileW) {
    for (let y = 330; y < H; y += tileH) {
      if (Math.round((x + 40) / tileW + (y - 330) / tileH) % 2 === 0) ctx.fillRect(x + 40, y, tileW, tileH);
    }
  }
  // twinkles
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 12; i++) {
    const tx = (i * 173) % W;
    const ty = 20 + ((i * 97) % 280);
    const s = (3 + Math.sin(now / 400 + i) * 2) * GIANT;
    ctx.fillRect(tx - s, ty - GIANT, s * 2, 2 * GIANT);
    ctx.fillRect(tx - GIANT, ty - s, 2 * GIANT, s * 2);
  }
}

function drawCushion(spot: { x: number; y: number }): void {
  ctx.fillStyle = "rgba(122,47,192,0.25)";
  ctx.beginPath();
  ctx.ellipse(spot.x, spot.y + 78, 82, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCushionFront(spot: { x: number; y: number }): void {
  ctx.fillStyle = "#c58bff";
  ctx.beginPath();
  ctx.ellipse(spot.x, spot.y + 76, 84, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0b8ff";
  ctx.beginPath();
  ctx.ellipse(spot.x, spot.y + 70, 76, 16, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCat(cat: Cat, now: number): void {
  const spot = SPOTS[cat.spot]!;
  const { x, y } = catCenter(cat, now);

  // Clip so the kitty hides behind the cushion.
  ctx.save();
  ctx.beginPath();
  ctx.rect(spot.x - 140, 0, 280, spot.y + 74);
  ctx.clip();
  drawCatBody(cat.type, x, y, now);
  ctx.restore();
}

function drawCatBody(t: CatType, x: number, y: number, now: number, target: CanvasRenderingContext2D = ctx): void {
  const ctx = target;
  let fill: string | CanvasGradient = t.fill;
  if (t.kind === "rainbow") {
    const g = ctx.createLinearGradient(x - 50, y - 50, x + 50, y + 50);
    const shift = (now / 8) % 360;
    for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsl(${(shift + i * 60) % 360} 95% 60%)`);
    fill = g;
  }

  const outline = t.kind === "black" ? "#ffffff" : "rgba(60,20,90,0.55)";
  ctx.lineWidth = t.kind === "black" ? 5 : 3;
  ctx.strokeStyle = outline;

  // wagging tail curling up beside the body
  const wag = Math.sin(now / 160) * 10;
  ctx.lineCap = "round";
  ctx.lineWidth = 22;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.moveTo(x + 40, y + 100);
  ctx.bezierCurveTo(x + 95, y + 100, x + 80 + wag, y + 30, x + 92 + wag * 1.4, y + 2);
  ctx.stroke();
  ctx.lineWidth = 15;
  ctx.strokeStyle = fill;
  ctx.stroke();
  ctx.lineWidth = t.kind === "black" ? 5 : 3;
  ctx.strokeStyle = outline;
  ctx.lineCap = "butt";

  // body peeking out
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y + 70, 52, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ears
  for (const side of [-1, 1]) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + side * 14, y - 36);
    ctx.lineTo(x + side * 48, y - 62);
    ctx.lineTo(x + side * 46, y - 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = t.inner;
    ctx.beginPath();
    ctx.moveTo(x + side * 22, y - 34);
    ctx.lineTo(x + side * 40, y - 50);
    ctx.lineTo(x + side * 39, y - 20);
    ctx.closePath();
    ctx.fill();
  }

  // head
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (t.kind === "pumpkin") {
    ctx.strokeStyle = "#c25a00";
    ctx.lineWidth = 4;
    for (const dx of [-14, 0, 14]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y - 49);
      ctx.lineTo(x + dx * 0.7, y - 30);
      ctx.stroke();
    }
  }

  // eyes
  for (const side of [-1, 1]) {
    ctx.fillStyle = t.kind === "black" ? t.eyes : "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x + side * 18, y - 6, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.kind === "black" ? "#0b2d12" : t.eyes;
    ctx.beginPath();
    ctx.ellipse(x + side * 18, y - 5, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // nose & mouth
  ctx.fillStyle = "#ff7fa8";
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 10);
  ctx.lineTo(x + 6, y + 10);
  ctx.lineTo(x, y + 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = t.kind === "black" ? "#ffffff" : "rgba(60,20,90,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.quadraticCurveTo(x - 8, y + 28, x - 14, y + 22);
  ctx.moveTo(x, y + 18);
  ctx.quadraticCurveTo(x + 8, y + 28, x + 14, y + 22);
  for (const side of [-1, 1]) {
    ctx.moveTo(x + side * 28, y + 8);
    ctx.lineTo(x + side * 58, y + 2);
    ctx.moveTo(x + side * 28, y + 14);
    ctx.lineTo(x + side * 58, y + 16);
  }
  ctx.stroke();
}

function drawLeaper(l: Leaper, now: number): void {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(((now - l.born) / 1000) * l.spin);
  // A caught kitty grows giant as it leaps away.
  const grow = 1 + (GIANT - 1) * Math.min(1, (now - l.born) / 400);
  ctx.scale(grow, grow);
  drawCatBody(l.type, 0, 0, now);
  ctx.restore();
}

// Pause screen: a rainbow wheel that spins around and pulses, instead of stripes.
function drawPauseRainbow(real: number): void {
  const colors = ["#ff2d2d", "#ff9f2d", "#ffe62d", "#4dff5a", "#2d7dff", "#c04dff"];
  const spin = real / 1800;
  const pulse = 0.55 + 0.45 * Math.sin(real / 260);
  const wheel = ctx.createConicGradient(spin, W / 2, H / 2);
  colors.forEach((color, i) => wheel.addColorStop(i / colors.length, color));
  wheel.addColorStop(1, colors[0]!);
  ctx.save();
  ctx.globalAlpha = 0.45 + pulse * 0.4;
  ctx.fillStyle = wheel;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // soft pulsing glow in the middle
  const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 380);
  glow.addColorStop(0, `rgba(255,255,255,${0.35 * pulse})`);
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // a black cat sits and waits while the game is paused
  ctx.fillStyle = "rgba(60,20,90,0.35)";
  ctx.beginPath();
  ctx.ellipse(820, 574, 110, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(820, 400);
  ctx.scale(1.3, 1.3);
  drawCatBody(CAT_TYPES.find((t) => t.kind === "black")!, 0, 0, real);
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#7a2fc0";
  ctx.lineWidth = 8;
  ctx.font = "bold 72px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.strokeText("Paused", W / 2, H / 2 + 20);
  ctx.fillText("Paused", W / 2, H / 2 + 20);
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeText("Press Play or P to keep catching kitties", W / 2, H / 2 + 62);
  ctx.fillText("Press Play or P to keep catching kitties", W / 2, H / 2 + 62);
}

function drawNetShape(g: CanvasRenderingContext2D, skin: NetSkin, now: number): void {
  const R = NET_RADIUS;
  const hue = (now / 12) % 360;
  let rim = skin.rim;
  let handle = skin.handle;
  let halo: string | null = null; // glow colour behind the net
  let haloSize = 1.6;
  const pulse = 0.6 + 0.4 * Math.sin(now / 220);
  if (skin.look === "godly") {
    rim = `hsl(${hue} 100% 62%)`;
    handle = "#ffd34d";
    halo = `hsla(${hue}, 100%, 70%, ${0.55 * pulse})`;
    haloSize = 2;
  } else if (skin.look === "ethereal") {
    halo = `rgba(190,245,255,${0.5 * pulse})`;
  } else if (skin.look === "aurora") {
    rim = `hsl(${140 + Math.sin(now / 500) * 80} 100% 65%)`;
    halo = `hsla(${140 + Math.sin(now / 500) * 80}, 100%, 65%, ${0.4 * pulse})`;
  } else if (skin.look === "fire") {
    rim = `hsl(${12 + Math.abs(Math.sin(now / 90)) * 30} 100% 55%)`;
    halo = `rgba(255,110,30,${0.35 + 0.2 * Math.abs(Math.sin(now / 110))})`;
  } else if (skin.look === "electric") {
    rim = Math.sin(now / 60) > 0.2 ? "#ffffff" : "#ffe62d";
    halo = `rgba(255,240,80,${0.3 + 0.25 * Math.abs(Math.sin(now / 70))})`;
  } else if (skin.look === "frost") {
    halo = "rgba(170,235,255,0.35)";
  }

  if (halo) {
    const glow = g.createRadialGradient(0, 0, R * 0.6, 0, 0, R * haloSize);
    glow.addColorStop(0, halo);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, R * 2, 0, Math.PI * 2);
    g.fill();
  }

  // handle
  g.strokeStyle = handle;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(R * 0.7, R * 0.7);
  g.lineTo(R * 2.1, R * 2.1);
  g.stroke();

  // mesh
  g.fillStyle = skin.mesh;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = skin.look === "galaxy" ? "rgba(190,170,255,0.8)" : "rgba(255,255,255,0.8)";
  g.lineWidth = 1.5;
  for (let i = -R + 14; i < R; i += 14) {
    const half = Math.sqrt(R * R - i * i);
    g.beginPath();
    g.moveTo(i, -half);
    g.lineTo(i, half);
    g.moveTo(-half, i);
    g.lineTo(half, i);
    g.stroke();
  }
  if (skin.look === "galaxy") {
    g.fillStyle = "#fff";
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const d = 8 + ((i * 17) % 44);
      const s = 1.5 + Math.sin(now / 250 + i) * 1;
      g.fillRect(Math.cos(a) * d - s / 2, Math.sin(a) * d - s / 2, s + 1, s + 1);
    }
  }

  // rim
  g.strokeStyle = rim;
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI * 2);
  g.stroke();
}

function drawNet(now: number): void {
  const t = Math.min(1, (now - swingStart) / 220);
  const tilt = t < 1 ? Math.sin(t * Math.PI) * -0.9 : 0;
  ctx.save();
  ctx.translate(netX, netY);
  ctx.rotate(tilt);
  const grow = netRadius(clock) / NET_RADIUS;
  ctx.scale(grow, grow);
  drawNetShape(ctx, currentSkin(), now);
  ctx.restore();
}

function drawHud(): void {
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(16, 14, 270, 74, 16);
  ctx.fill();
  ctx.fillStyle = "#4a1f6e";
  ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${score}`, 30, 50);
  ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
  ctx.fillText(`Kitties caught: ${caught}   Best: ${highScore}`, 30, 74);

  const active: string[] = [];
  if (clock < effectEnds.stay) active.push(`Long stays ${Math.ceil((effectEnds.stay - clock) / 1000)}s`);
  if (clock < effectEnds.bigNet) active.push(`Big net ${Math.ceil((effectEnds.bigNet - clock) / 1000)}s`);
  if (clock < effectEnds.double) active.push(`2x points ${Math.ceil((effectEnds.double - clock) / 1000)}s`);
  if (active.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(16, 96, 270, 14 + active.length * 22, 14);
    ctx.fill();
    ctx.fillStyle = "#7a2fc0";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    active.forEach((line, i) => ctx.fillText(line, 30, 120 + i * 22));
  }
}

function frame(real: number): void {
  if (!paused) clock += Math.min(100, real - lastReal);
  lastReal = real;
  const now = clock;
  if (!paused && now >= nextSpawn) spawnCat(now);
  cats = cats.filter((cat) => now - cat.born < cat.stay + POP_MS * 2);
  floaters = floaters.filter((f) => now - f.born < 900);
  const dt = (now - leapStep) / 1000;
  leapStep = now;
  for (const l of leapers) {
    l.vy += 1500 * dt;
    l.x += l.vx * dt;
    l.y += l.vy * dt;
  }
  leapers = leapers.filter((l) => l.y < H + 150 * GIANT && l.x > -150 * GIANT && l.x < W + 150 * GIANT);

  drawRoom(real);
  SPOTS.forEach(drawCushion);
  // draw cats in spot order (back row first) so they overlap sensibly
  [...cats].sort((a, b) => a.spot - b.spot).forEach((cat) => drawCat(cat, now));
  SPOTS.forEach(drawCushionFront);
  leapers.forEach((l) => drawLeaper(l, now));

  for (const f of floaters) {
    const age = (now - f.born) / 900;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = f.color;
    ctx.strokeStyle = "#7a2fc0";
    ctx.lineWidth = 5;
    ctx.font = `bold ${Math.min(40 * GIANT, 80)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.strokeText(f.text, f.x, f.y - age * 50);
    ctx.fillText(f.text, f.x, f.y - age * 50);
    ctx.globalAlpha = 1;
  }

  if (paused) drawPauseRainbow(real);
  drawNet(real);
  drawHud();
  requestAnimationFrame(frame);
}

function renderCatIndex(): void {
  catIndexList.innerHTML = CAT_TYPES.map(
    (t) => `
      <li style="--swatch: ${t.kind === "rainbow" ? "#ff6bd6" : t.fill}">
        <canvas class="cat-pic" width="170" height="170" data-kind="${t.kind}" role="img" aria-label="${t.title}"></canvas>
        <span class="cat-name">${t.title}</span>
        <span class="cat-stats">${t.points} point${t.points === 1 ? "" : "s"} · Odds: ${t.odds}</span>
        <span class="cat-bio">${t.bio}</span>
      </li>`
  ).join("");
}

function drawCatPictures(): void {
  catIndexList.querySelectorAll<HTMLCanvasElement>("canvas.cat-pic").forEach((pic) => {
    const type = CAT_TYPES.find((t) => t.kind === pic.dataset["kind"]);
    const pctx = pic.getContext("2d");
    if (!type || !pctx) return;
    pctx.save();
    pctx.translate(78, 82);
    pctx.scale(1.2, 1.2);
    drawCatBody(type, 0, 0, 0, pctx);
    pctx.restore();
  });
}

renderCatIndex();
drawCatPictures();

// The button's picture: a little gray kitty face.
const buttonPic = document.getElementById("cat-index-pic") as HTMLCanvasElement;
const buttonCtx = buttonPic.getContext("2d");
if (buttonCtx) {
  buttonCtx.translate(60, 70);
  buttonCtx.scale(0.95, 0.95);
  drawCatBody(CAT_TYPES[0]!, 0, 0, 0, buttonCtx);
}
catIndexButton.addEventListener("click", () => {
  catIndexPanel.hidden = false;
});
catIndexBack.addEventListener("click", () => {
  catIndexPanel.hidden = true;
});

function drawSkinPictures(): void {
  skinsList.querySelectorAll<HTMLCanvasElement>("canvas.skin-pic").forEach((pic) => {
    const skin = NET_SKINS.find((s) => s.id === pic.dataset["skin"]);
    const pctx = pic.getContext("2d");
    if (!skin || !pctx) return;
    pctx.save();
    pctx.translate(62, 62);
    pctx.scale(0.62, 0.62);
    drawNetShape(pctx, skin, 0);
    pctx.restore();
  });
}

function renderSkins(): void {
  skinsCount.textContent = creative ? "Creative mode: every net is unlocked!" : `Kitties caught so far: ${totalCaught}`;
  const equipped = currentSkin();
  skinsList.innerHTML = NET_SKINS.map((s) => {
    const unlocked = creative || totalCaught >= s.need;
    const action = !unlocked
      ? `<span class="skin-locked">Locked · catch ${s.need} kitties (${s.need - totalCaught} to go)</span>`
      : s.id === equipped.id
        ? `<span class="skin-equipped">✔ Using this net</span>`
        : `<button type="button" class="skin-equip" data-skin="${s.id}">Use this net</button>`;
    return `
      <li class="${unlocked ? "" : "skin-locked-card"}" data-tier="${s.id}">
        <canvas class="skin-pic" width="124" height="124" data-skin="${s.id}" role="img" aria-label="${s.name}"></canvas>
        <span class="cat-name">${s.name}</span>
        <span class="cat-stats">${s.tier} tier</span>
        ${action}
      </li>`;
  }).join("");
  drawSkinPictures();
}

skinsButton.addEventListener("click", () => {
  renderSkins();
  skinsPanel.hidden = false;
});
skinsBack.addEventListener("click", () => {
  skinsPanel.hidden = true;
});
skinsList.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button.skin-equip");
  if (!target) return;
  skinId = target.dataset["skin"] ?? "adult";
  save(SKIN_KEY, skinId);
  renderSkins();
});

// The skins button's picture: a little net.
const skinsPic = document.getElementById("skins-pic") as HTMLCanvasElement;
const skinsPicCtx = skinsPic.getContext("2d");
if (skinsPicCtx) {
  skinsPicCtx.translate(50, 50);
  skinsPicCtx.scale(0.62, 0.62);
  drawNetShape(skinsPicCtx, NET_SKINS[0]!, 0);
}

// ---------- Cat Cafe ----------
const TREATS: { id: keyof typeof effectEnds; name: string; cost: number; blurb: string }[] = [
  { id: "stay", name: "Catpuccino", cost: 2, blurb: "Kitties stay up 3 seconds longer" },
  { id: "bigNet", name: "Tuna Cookie", cost: 3, blurb: "A bigger net" },
  { id: "double", name: "Fancy Fish", cost: 5, blurb: "Double points" },
];

const cafeCoins = document.getElementById("cafe-coins") as HTMLElement;
const cafeNotice = document.getElementById("cafe-notice") as HTMLElement;
const cafeTreats = document.getElementById("cafe-treats") as HTMLElement;
const cafeBack = document.getElementById("cafe-back") as HTMLButtonElement;
const cafeScene = document.getElementById("cafe-scene") as HTMLCanvasElement;

function say(text: string): void {
  cafeNotice.textContent = text;
}

function renderCafe(): void {
  cafeCoins.textContent = `Coins: $${coins}`;
  cafeTreats.innerHTML = TREATS.map((t) => {
    const left = Math.max(0, Math.ceil((effectEnds[t.id] - clock) / 1000));
    return `
      <button type="button" class="cafe-treat" data-treat="${t.id}" ${coins < t.cost ? "disabled" : ""}>
        <b>${t.name} · $${t.cost}</b>
        <span>${t.blurb}${left > 0 ? ` (${left}s left)` : ""}</span>
      </button>`;
  }).join("");
}

const cafe = createCafe({
  canvas: cafeScene,
  newCustomer() {
    const type = pickType();
    return {
      title: type.title,
      points: type.points,
      draw(g, now) {
        drawCatBody(type, 0, 0, now, g);
      },
    };
  },
  onServed(customer) {
    const pay = 3 + Math.ceil(customer.points / 5) + Math.floor(Math.random() * 3);
    coins += pay;
    save(COINS_KEY, String(coins));
    renderCafe();
    return `+$${pay}!`;
  },
  say,
});

cafeTreats.addEventListener("click", (event) => {
  const id = (event.target as HTMLElement).closest<HTMLElement>("[data-treat]")?.dataset["treat"] as keyof typeof effectEnds | undefined;
  const treat = TREATS.find((t) => t.id === id);
  if (!treat || coins < treat.cost) return;
  coins -= treat.cost;
  save(COINS_KEY, String(coins));
  effectEnds[treat.id] = Math.max(clock, effectEnds[treat.id]) + TREAT_MS;
  say(`${treat.name} for everyone! It lasts while you play.`);
  renderCafe();
});

cafeButton.addEventListener("click", () => {
  say("Welcome to the Cat Cafe! Drag a cup from the CUPS machine.");
  renderCafe();
  cafePanel.hidden = false;
  cafe.start();
});
cafeBack.addEventListener("click", () => {
  cafePanel.hidden = true;
  cafe.stop();
});

// The cafe button's picture: a coffee cup.
const cafePic = document.getElementById("cafe-pic") as HTMLCanvasElement;
const cafePicCtx = cafePic.getContext("2d");
if (cafePicCtx) {
  const c = cafePicCtx;
  c.fillStyle = "#fff8ff";
  c.strokeStyle = "#7a2fc0";
  c.lineWidth = 8;
  c.beginPath();
  c.roundRect(24, 38, 62, 56, [4, 4, 22, 22]);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(90, 62, 15, -Math.PI / 2, Math.PI / 2);
  c.stroke();
  c.fillStyle = "#8b5a3c";
  c.fillRect(30, 44, 50, 12);
  c.strokeStyle = "#8fd8ff";
  c.lineWidth = 5;
  c.lineCap = "round";
  for (const x of [40, 56, 72]) {
    c.beginPath();
    c.moveTo(x, 28);
    c.quadraticCurveTo(x + 8, 20, x, 10);
    c.stroke();
  }
}

const creativeButton = document.getElementById("creative") as HTMLButtonElement;

function setCreative(value: boolean): void {
  creative = value;
  save(CREATIVE_KEY, String(creative));
  creativeButton.textContent = creative ? "Creative Mode: ON" : "Creative Mode: OFF";
  creativeButton.setAttribute("aria-pressed", String(creative));
  // Start fresh so kitties that were on a timer don't mix with ones that stay.
  cats = [];
  score = 0;
  caught = 0;
  nextSpawn = clock + 800;
  renderSkins();
}

creativeButton.addEventListener("click", () => setCreative(!creative));
creativeButton.textContent = creative ? "Creative Mode: ON" : "Creative Mode: OFF";
creativeButton.setAttribute("aria-pressed", String(creative));

pauseButton.addEventListener("click", () => setPaused(!paused));
window.addEventListener("keydown", (event) => {
  if (event.key === "p" || event.key === "P" || event.key === "Escape") setPaused(!paused);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
});

requestAnimationFrame((t) => {
  lastReal = t;
  frame(t);
});
