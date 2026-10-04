import { isGigantic, markFound } from "../../shared/bigGames";
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { createShop } from "./shop";

installOofShortcut();
installForceRefreshHotkey();
markFound("gem-smasher");

// GIGANTIC Gem Smasher: your mallet stays its normal size and everything else
// goes giant, the gems most of all.
const GIGANTIC = isGigantic("gem-smasher");
const GIANT = GIGANTIC ? 2.5 : 1;
if (GIGANTIC) {
  document.title = "GIGANTIC Gem Smasher";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "GIGANTIC Gem Smasher";
}

// Gem Smasher: Catch the Kitties, but with gems. You're in a dark room, gems
// pop up in random spots, and you smash them with a hammer before they fade.
// The gems and their facts come from Oscar and Maeve's rocks and crystals
// presentation.

const W = 960;
const H = 600;
const HIGH_SCORE_KEY = "gem-smasher-high-score";
const COINS_KEY = "gem-smasher-coins";
const TOTAL_SMASHED_KEY = "gem-smasher-total-smashed";
const SKIN_KEY = "gem-smasher-mallet-skin";
const SPAWN_MIN_MS = 1600;
const SPAWN_MAX_MS = 2600;
const STAY_MS = 4500;
const POP_MS = 400;
const HAMMER_REACH = 60;
const TREAT_MS = 40000;

type Cut = "point" | "round" | "step";

interface GemType {
  id: string;
  name: string;
  points: number;
  weight: number;
  odds: string;
  color: string;
  light: string;
  dark: string;
  cut: Cut;
  fact: string;
}

const GEM_TYPES: GemType[] = [
  { id: "quartz", name: "Quartz", points: 1, weight: 50, odds: "1 in 2", color: "#e9eef5", light: "#ffffff", dark: "#a9b4c4", cut: "point", fact: "The most common crystal on Earth. Sand is mostly tiny bits of quartz." },
  { id: "amethyst", name: "Amethyst", points: 2, weight: 20, odds: "1 in 5", color: "#a35cff", light: "#d9b8ff", dark: "#5b2a9e", cut: "point", fact: "Purple quartz. It grows inside hollow rocks called geodes." },
  { id: "topaz", name: "Topaz", points: 3, weight: 12, odds: "about 1 in 8", color: "#ffc23b", light: "#fff0a8", dark: "#b8760c", cut: "round", fact: "Often golden yellow, but it comes in lots of colours, even blue." },
  { id: "emerald", name: "Emerald", points: 5, weight: 8, odds: "about 1 in 12", color: "#22c46b", light: "#9cffc6", dark: "#0b6b37", cut: "step", fact: "A green kind of beryl. Most emeralds have tiny cracks and bits inside them." },
  { id: "sapphire", name: "Sapphire", points: 10, weight: 5, odds: "1 in 20", color: "#2f6bff", light: "#9fc0ff", dark: "#12318f", cut: "round", fact: "Made of the same mineral as a ruby, just a different colour." },
  { id: "ruby", name: "Ruby", points: 20, weight: 4, odds: "1 in 25", color: "#ff2d55", light: "#ffa3b6", dark: "#8f0a24", cut: "round", fact: "A red sapphire! Only the red ones get to be called rubies." },
  { id: "diamond", name: "Diamond", points: 100, weight: 1, odds: "1 in 100", color: "#dff6ff", light: "#ffffff", dark: "#8fd0ff", cut: "round", fact: "Made of pure carbon squeezed deep underground. The hardest natural thing there is." },
];

// Mallet skins unlock as you smash more gems, ever. Same tiers as the nets in
// Catch the Kitties.
interface MalletSkin {
  id: string;
  tier: string;
  name: string;
  need: number;
  head: string;
  handle: string;
  look: "plain" | "galaxy" | "frost" | "fire" | "electric" | "aurora" | "ethereal" | "godly";
}

const MALLET_SKINS: MalletSkin[] = [
  { id: "adult", tier: "Adult", name: "Plain Mallet", need: 0, head: "#9aa3ad", handle: "#8b5427", look: "plain" },
  { id: "sweet", tier: "Sweet", name: "Bubblegum Mallet", need: 10, head: "#ff8fc7", handle: "#ffd0e8", look: "plain" },
  { id: "super", tier: "Super", name: "Mint Mallet", need: 20, head: "#1fc98a", handle: "#0d7a55", look: "plain" },
  { id: "epic", tier: "Epic", name: "Ocean Mallet", need: 35, head: "#1f78ff", handle: "#1b4fa8", look: "plain" },
  { id: "rare", tier: "Rare", name: "Sunset Mallet", need: 50, head: "#ff7a2f", handle: "#a8381b", look: "plain" },
  { id: "legendary", tier: "Legendary", name: "Golden Mallet", need: 75, head: "#ffc61a", handle: "#c78a00", look: "plain" },
  { id: "mythic", tier: "Mythic", name: "Ruby Mallet", need: 100, head: "#e0143c", handle: "#6d0a20", look: "plain" },
  { id: "shadow", tier: "Shadow", name: "Midnight Mallet", need: 150, head: "#22222c", handle: "#3a3a48", look: "plain" },
  { id: "cosmic", tier: "Cosmic", name: "Galaxy Mallet", need: 200, head: "#4b2aa8", handle: "#1b1038", look: "galaxy" },
  { id: "frozen", tier: "Frozen", name: "Ice Mallet", need: 300, head: "#8fe3ff", handle: "#d6f6ff", look: "frost" },
  { id: "blazing", tier: "Blazing", name: "Fire Mallet", need: 450, head: "#ff5a1f", handle: "#7a1a05", look: "fire" },
  { id: "electric", tier: "Electric", name: "Lightning Mallet", need: 650, head: "#ffe62d", handle: "#3a3a55", look: "electric" },
  { id: "celestial", tier: "Celestial", name: "Starlight Mallet", need: 900, head: "#2a1a6b", handle: "#6b4fc4", look: "galaxy" },
  { id: "immortal", tier: "Immortal", name: "Aurora Mallet", need: 1250, head: "#7dffcf", handle: "#3a2a7a", look: "aurora" },
  { id: "ethereal", tier: "Ethereal", name: "Ethereal Mallet", need: 1750, head: "#bff4ff", handle: "#e8fbff", look: "ethereal" },
  { id: "godly", tier: "Godly", name: "Godly Mallet", need: 2500, head: "#ffffff", handle: "#ffd34d", look: "godly" },
];

interface Gem {
  type: GemType;
  x: number;
  y: number;
  size: number;
  stay: number;
  born: number;
}

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  color: string;
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
const pauseMenu = document.getElementById("pause-menu") as HTMLElement;
const indexButton = document.getElementById("gem-index-button") as HTMLButtonElement;
const indexPanel = document.getElementById("gem-index") as HTMLElement;
const indexBack = document.getElementById("gem-index-back") as HTMLButtonElement;
const indexList = document.getElementById("gem-index-list") as HTMLUListElement;

let gems: Gem[] = [];
let shards: Shard[] = [];
let floaters: Floater[] = [];
let score = 0;
let smashed = 0;
let highScore = readNumber(HIGH_SCORE_KEY);
let coins = readNumber(COINS_KEY);
let totalSmashed = readNumber(TOTAL_SMASHED_KEY);
let skinId = readString(SKIN_KEY) ?? "adult";
// When each Mineral-N-Crystal treat wears off, in game time.
const effectEnds = { stay: 0, bigMallet: 0, double: 0 };
let clock = 0; // game time: stops while paused so the gems wait too
let lastReal = 0;
let paused = false;
let nextSpawn = 800;
let hammerX = W / 2;
let hammerY = H / 2;
let swingStart = -10000;

// Little specks of light in the dark room, scattered the same way every time
// so they don't jump around.
const scatter = (n: number): number => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const SPECKS = Array.from({ length: 70 }, (_, i) => ({
  x: scatter(i + 1) * W,
  y: scatter(i + 101) * H,
  r: (0.6 + ((i * 7) % 5) * 0.3) * GIANT,
  phase: i,
}));

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

function currentSkin(): MalletSkin {
  return MALLET_SKINS.find((s) => s.id === skinId && totalSmashed >= s.need) ?? MALLET_SKINS[0]!;
}

function malletReach(now: number): number {
  return now < effectEnds.bigMallet ? HAMMER_REACH * 1.35 : HAMMER_REACH;
}

function pickType(): GemType {
  let roll = Math.random() * 100;
  for (const type of GEM_TYPES) {
    roll -= type.weight;
    if (roll < 0) return type;
  }
  return GEM_TYPES[0]!;
}

// A random spot that isn't on top of another gem or under the score.
function spawnGem(now: number): void {
  const size = (34 + Math.random() * 14) * GIANT;
  // Giant gems need more room, so they keep further from the edges.
  const top = 110 + (GIANT - 1) * 40;
  const bottom = H - 70 * GIANT;
  for (let tries = 0; tries < 20; tries++) {
    const x = 70 * GIANT + Math.random() * (W - 140 * GIANT);
    const y = top + Math.random() * (bottom - top);
    if (gems.every((g) => Math.hypot(g.x - x, g.y - y) > 110 * GIANT)) {
      gems.push({ type: pickType(), x, y, size, stay: now < effectEnds.stay ? STAY_MS + 3000 : STAY_MS, born: now });
      break;
    }
  }
  nextSpawn = now + SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
}

function easeOutBack(t: number): number {
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// 0 = gone, 1 = all the way there.
function popAmount(gem: Gem, now: number): number {
  const age = now - gem.born;
  if (age < POP_MS) return easeOutBack(age / POP_MS);
  if (age < POP_MS + gem.stay) return 1;
  return Math.max(0, 1 - (age - POP_MS - gem.stay) / POP_MS);
}

function shatter(gem: Gem, now: number): void {
  const pieces = gem.type.id === "diamond" ? 40 : 18;
  for (let i = 0; i < pieces; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 380;
    shards.push({
      x: gem.x,
      y: gem.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 200,
      spin: (Math.random() - 0.5) * 14,
      angle: Math.random() * Math.PI,
      size: (5 + Math.random() * 9) * GIANT,
      // A diamond breaks into every colour.
      color: gem.type.id === "diamond" ? `hsl(${Math.random() * 360}, 95%, 70%)` : [gem.type.color, gem.type.light, gem.type.dark][i % 3]!,
      born: now,
    });
  }
}

function smash(x: number, y: number): void {
  if (paused) return;
  const now = clock;
  swingStart = now;
  for (const gem of [...gems].reverse()) {
    if (popAmount(gem, now) < 0.5) continue;
    if (Math.hypot(gem.x - x, gem.y - y) > malletReach(now) + gem.size * 0.4) continue;
    gems = gems.filter((other) => other !== gem);
    shatter(gem, now);
    const points = gem.type.points * (now < effectEnds.double ? 2 : 1);
    score += points;
    smashed += 1;
    totalSmashed += 1;
    save(TOTAL_SMASHED_KEY, String(totalSmashed));
    const unlocked = MALLET_SKINS.find((s) => s.need === totalSmashed && s.need > 0);
    if (unlocked) floaters.push({ x: W / 2, y: 110, text: `New mallet: ${unlocked.tier}!`, color: "#ffe45e", born: now });
    floaters.push({ x: gem.x, y: gem.y - 50, text: `+${points}`, color: gem.type.light, born: now });
    if (gem.type.id === "diamond") floaters.push({ x: W / 2, y: 150, text: "💎 A DIAMOND!!! 💎", color: "#ffffff", born: now });
    if (score > highScore) {
      highScore = score;
      save(HIGH_SCORE_KEY, String(highScore));
    }
    return;
  }
  floaters.push({ x, y, text: "clink", color: "rgba(255,255,255,0.7)", born: now });
}

function toCanvas(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
}

canvas.addEventListener("pointermove", (event) => {
  ({ x: hammerX, y: hammerY } = toCanvas(event));
});
canvas.addEventListener("pointerdown", (event) => {
  const p = toCanvas(event);
  hammerX = p.x;
  hammerY = p.y;
  smash(p.x, p.y);
});

// The Gem Index, the skins and Mineral-N-Crystal are all in the pause menu.
function setPaused(value: boolean): void {
  paused = value;
  pauseMenu.hidden = !paused;
  if (!paused) {
    indexPanel.hidden = true;
    skinsPanel.hidden = true;
    shopPanel.hidden = true;
    shop.stop();
  }
  pauseButton.textContent = paused ? "▶ Play" : "❚❚ Pause";
  pauseButton.setAttribute("aria-pressed", String(paused));
}

pauseButton.addEventListener("click", () => setPaused(!paused));
window.addEventListener("keydown", (event) => {
  if (event.key === "p" || event.key === "P" || event.key === "Escape") setPaused(!paused);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setPaused(true);
});

indexButton.addEventListener("click", () => {
  indexPanel.hidden = false;
});

indexBack.addEventListener("click", () => {
  indexPanel.hidden = true;
});

function drawRoom(real: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  for (const s of SPECKS) {
    ctx.globalAlpha = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(real / 700 + s.phase));
    ctx.fillStyle = "#cfd8ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// One gem, drawn around (0, 0), in whichever cut it has.
function drawGemShape(g: CanvasRenderingContext2D, type: GemType, size: number, real: number): void {
  const fill = g.createLinearGradient(-size, -size, size, size);
  fill.addColorStop(0, type.light);
  fill.addColorStop(0.5, type.color);
  fill.addColorStop(1, type.dark);
  g.fillStyle = fill;
  g.strokeStyle = type.dark;
  g.lineWidth = 2.5;
  g.lineJoin = "round";

  if (type.cut === "point") {
    // A crystal point: a six-sided column with a pointy top.
    const w = size * 0.55;
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(w, -size * 0.45);
    g.lineTo(w, size * 0.8);
    g.lineTo(-w, size * 0.8);
    g.lineTo(-w, -size * 0.45);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(0, size * 0.8);
    g.moveTo(-w, -size * 0.45);
    g.lineTo(0, -size * 0.3);
    g.lineTo(w, -size * 0.45);
    g.stroke();
  } else if (type.cut === "step") {
    // An emerald cut: a rectangle with its corners cut off.
    const w = size * 0.8;
    const h = size * 0.95;
    const c = size * 0.25;
    g.beginPath();
    g.moveTo(-w + c, -h);
    g.lineTo(w - c, -h);
    g.lineTo(w, -h + c);
    g.lineTo(w, h - c);
    g.lineTo(w - c, h);
    g.lineTo(-w + c, h);
    g.lineTo(-w, h - c);
    g.lineTo(-w, -h + c);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeRect(-w * 0.55, -h * 0.6, w * 1.1, h * 1.2);
  } else {
    // A round brilliant: a flat top and a pointy bottom.
    const top = -size * 0.55;
    const girdle = -size * 0.1;
    g.beginPath();
    g.moveTo(-size * 0.5, top);
    g.lineTo(size * 0.5, top);
    g.lineTo(size, girdle);
    g.lineTo(0, size);
    g.lineTo(-size, girdle);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-size, girdle);
    g.lineTo(size, girdle);
    g.moveTo(-size * 0.5, top);
    g.lineTo(-size * 0.25, girdle);
    g.lineTo(0, top);
    g.lineTo(size * 0.25, girdle);
    g.lineTo(size * 0.5, top);
    g.moveTo(-size * 0.25, girdle);
    g.lineTo(0, size);
    g.lineTo(size * 0.25, girdle);
    g.stroke();
  }

  // A twinkle that comes and goes.
  const twinkle = Math.max(0, Math.sin(real / 300 + size));
  g.fillStyle = `rgba(255, 255, 255, ${0.5 + twinkle * 0.5})`;
  g.beginPath();
  const sx = -size * 0.3;
  const sy = -size * 0.4;
  const r = size * (0.12 + twinkle * 0.12);
  g.moveTo(sx, sy - r * 2);
  g.lineTo(sx + r * 0.5, sy);
  g.lineTo(sx, sy + r * 2);
  g.lineTo(sx - r * 0.5, sy);
  g.closePath();
  g.moveTo(sx - r * 2, sy);
  g.lineTo(sx, sy - r * 0.5);
  g.lineTo(sx + r * 2, sy);
  g.lineTo(sx, sy + r * 0.5);
  g.closePath();
  g.fill();
}

function drawGem(gem: Gem, now: number, real: number): void {
  const pop = popAmount(gem, now);
  if (pop <= 0) return;
  ctx.save();
  ctx.translate(gem.x, gem.y);
  ctx.scale(pop, pop);
  // Each gem glows its own colour in the dark.
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, gem.size * 2.2);
  glow.addColorStop(0, gem.type.id === "diamond" ? `hsla(${(real / 8) % 360}, 90%, 70%, 0.5)` : `${gem.type.color}66`);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, gem.size * 2.2, 0, Math.PI * 2);
  ctx.fill();
  drawGemShape(ctx, gem.type, gem.size, real);
  ctx.restore();
}

// A mallet drawn around its head, in whichever skin you're using.
function drawMalletShape(g: CanvasRenderingContext2D, skin: MalletSkin, now: number): void {
  const hue = (now / 12) % 360;
  const pulse = 0.6 + 0.4 * Math.sin(now / 220);
  let head = skin.head;
  let halo: string | null = null;
  if (skin.look === "godly") {
    head = `hsl(${hue} 100% 62%)`;
    halo = `hsla(${hue}, 100%, 70%, ${0.55 * pulse})`;
  } else if (skin.look === "ethereal") {
    halo = `rgba(190,245,255,${0.5 * pulse})`;
  } else if (skin.look === "aurora") {
    head = `hsl(${140 + Math.sin(now / 500) * 80} 100% 65%)`;
    halo = `hsla(${140 + Math.sin(now / 500) * 80}, 100%, 65%, ${0.4 * pulse})`;
  } else if (skin.look === "fire") {
    head = `hsl(${12 + Math.abs(Math.sin(now / 90)) * 30} 100% 55%)`;
    halo = `rgba(255,110,30,${0.35 + 0.2 * Math.abs(Math.sin(now / 110))})`;
  } else if (skin.look === "electric") {
    head = Math.sin(now / 60) > 0.2 ? "#ffffff" : "#ffe62d";
    halo = `rgba(255,240,80,${0.3 + 0.25 * Math.abs(Math.sin(now / 70))})`;
  } else if (skin.look === "frost") {
    halo = "rgba(170,235,255,0.35)";
  } else if (skin.look === "galaxy") {
    halo = "rgba(140,110,255,0.3)";
  }

  if (halo) {
    const glow = g.createRadialGradient(0, -15, 10, 0, -15, 70);
    glow.addColorStop(0, halo);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, -15, 70, 0, Math.PI * 2);
    g.fill();
  }

  g.strokeStyle = "#000";
  g.lineWidth = 3;
  g.fillStyle = skin.handle;
  g.fillRect(-5, -8, 10, 70);
  g.strokeRect(-5, -8, 10, 70);
  g.fillStyle = head;
  g.fillRect(-26, -30, 52, 26);
  g.strokeRect(-26, -30, 52, 26);
  g.fillStyle = "rgba(255, 255, 255, 0.45)";
  g.fillRect(-22, -27, 44, 5);
  if (skin.look === "galaxy") {
    g.fillStyle = "#fff";
    for (let i = 0; i < 7; i++) {
      const s = 1.5 + Math.sin(now / 250 + i) * 1;
      g.fillRect(-22 + ((i * 13) % 44), -25 + ((i * 7) % 16), s + 1, s + 1);
    }
  }
}

// The mallet follows the pointer and swings down when you click.
function drawMallet(): void {
  const age = clock - swingStart;
  const swing = age < 120 ? -0.9 + (age / 120) * 1.5 : age < 260 ? 0.6 - ((age - 120) / 140) * 0.6 : 0;
  ctx.save();
  ctx.translate(hammerX, hammerY);
  ctx.rotate(-0.5 + swing);
  const grow = malletReach(clock) / HAMMER_REACH;
  ctx.scale(grow, grow);
  drawMalletShape(ctx, currentSkin(), lastReal);
  ctx.restore();
}

function drawHud(): void {
  ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.fillText(`Score: ${score}`, 20, 40);
  ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText(`Smashed: ${smashed}   Best: ${highScore}   Coins: $${coins}`, 20, 66);

  const active: string[] = [];
  if (clock < effectEnds.stay) active.push(`Quartz Shake: gems stay longer ${Math.ceil((effectEnds.stay - clock) / 1000)}s`);
  if (clock < effectEnds.bigMallet) active.push(`Geode Fries: big mallet ${Math.ceil((effectEnds.bigMallet - clock) / 1000)}s`);
  if (clock < effectEnds.double) active.push(`Animal Style: 2x points ${Math.ceil((effectEnds.double - clock) / 1000)}s`);
  ctx.fillStyle = "#ffd23b";
  ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
  active.forEach((line, i) => ctx.fillText(line, 20, 92 + i * 22));

  if (paused) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "900 64px 'Arial Black', Impact, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("PAUSED", W / 2, H * 0.42);
  }
}

function frame(real: number): void {
  const step = Math.min(100, real - lastReal);
  lastReal = real;
  if (!paused) clock += step;
  const now = clock;
  if (!paused && now >= nextSpawn) spawnGem(now);
  gems = gems.filter((gem) => now - gem.born < STAY_MS + POP_MS * 2);
  floaters = floaters.filter((f) => now - f.born < 900);
  if (!paused) {
    const dt = step / 1000;
    for (const s of shards) {
      s.vy += 1100 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.angle += s.spin * dt;
    }
  }
  shards = shards.filter((s) => now - s.born < 1400 && s.y < H + 40);

  drawRoom(real);
  gems.forEach((gem) => drawGem(gem, now, real));

  for (const s of shards) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - (now - s.born) / 1400);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.moveTo(0, -s.size);
    ctx.lineTo(s.size * 0.6, s.size * 0.4);
    ctx.lineTo(-s.size * 0.6, s.size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const f of floaters) {
    const age = (now - f.born) / 900;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = f.color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5;
    ctx.font = `bold ${Math.min(38 * GIANT, 70)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.strokeText(f.text, f.x, f.y - age * 50);
    ctx.fillText(f.text, f.x, f.y - age * 50);
    ctx.globalAlpha = 1;
  }

  drawHud();
  if (!paused) drawMallet();
  requestAnimationFrame(frame);
}

function renderGemIndex(): void {
  indexList.innerHTML = GEM_TYPES.map(
    (t) => `
      <li style="--swatch: ${t.color}">
        <canvas class="gem-pic" width="110" height="110" data-gem="${t.id}" role="img" aria-label="${t.name}"></canvas>
        <span class="card-name">${t.name}</span>
        <span class="card-stats">${t.points} point${t.points === 1 ? "" : "s"} · Odds: ${t.odds}</span>
        <span class="card-fact">${t.fact}</span>
      </li>`
  ).join("");
  indexList.querySelectorAll<HTMLCanvasElement>("canvas.gem-pic").forEach((pic) => {
    const type = GEM_TYPES.find((t) => t.id === pic.dataset["gem"]);
    const pctx = pic.getContext("2d");
    if (!type || !pctx) return;
    pctx.translate(55, 55);
    drawGemShape(pctx, type, 38, 0);
  });
}

// ---------- Mallet Skins ----------
const skinsButton = document.getElementById("skins-button") as HTMLButtonElement;
const skinsPanel = document.getElementById("skins") as HTMLElement;
const skinsBack = document.getElementById("skins-back") as HTMLButtonElement;
const skinsList = document.getElementById("skins-list") as HTMLUListElement;
const skinsCount = document.getElementById("skins-count") as HTMLElement;

function renderSkins(): void {
  skinsCount.textContent = `Gems smashed so far: ${totalSmashed}`;
  const equipped = currentSkin();
  skinsList.innerHTML = MALLET_SKINS.map((s) => {
    const unlocked = totalSmashed >= s.need;
    const action = !unlocked
      ? `<span class="skin-locked">Locked · smash ${s.need} gems (${s.need - totalSmashed} to go)</span>`
      : s.id === equipped.id
        ? `<span class="skin-equipped">✔ Using this mallet</span>`
        : `<button type="button" class="skin-equip" data-skin="${s.id}">Use this mallet</button>`;
    return `
      <li class="${unlocked ? "" : "is-locked"}" style="--swatch: ${s.head}">
        <canvas class="skin-pic" width="124" height="124" data-skin="${s.id}" role="img" aria-label="${s.name}"></canvas>
        <span class="card-name">${s.name}</span>
        <span class="card-stats">${s.tier} tier</span>
        ${action}
      </li>`;
  }).join("");
  skinsList.querySelectorAll<HTMLCanvasElement>("canvas.skin-pic").forEach((pic) => {
    const skin = MALLET_SKINS.find((s) => s.id === pic.dataset["skin"]);
    const pctx = pic.getContext("2d");
    if (!skin || !pctx) return;
    pctx.translate(62, 66);
    pctx.rotate(-0.5);
    drawMalletShape(pctx, skin, 0);
  });
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

// ---------- Mineral-N-Crystal ----------
// Like the In-N-Out menu, with a secret menu item on the end.
const TREATS: { id: keyof typeof effectEnds; name: string; cost: number; blurb: string }[] = [
  { id: "stay", name: "Quartz Shake", cost: 2, blurb: "Gems stay out 3 seconds longer" },
  { id: "bigMallet", name: "Geode Fries", cost: 3, blurb: "A bigger mallet" },
  { id: "double", name: "Animal Style (secret menu)", cost: 5, blurb: "Double points" },
];

const shopButton = document.getElementById("shop-button") as HTMLButtonElement;
const shopPanel = document.getElementById("shop") as HTMLElement;
const shopBack = document.getElementById("shop-back") as HTMLButtonElement;
const shopCoins = document.getElementById("shop-coins") as HTMLElement;
const shopNotice = document.getElementById("shop-notice") as HTMLElement;
const shopMenu = document.getElementById("shop-menu") as HTMLElement;
const shopScene = document.getElementById("shop-scene") as HTMLCanvasElement;

function say(text: string): void {
  shopNotice.textContent = text;
}

function renderShop(): void {
  shopCoins.textContent = `Coins: $${coins}`;
  shopMenu.innerHTML = TREATS.map((t) => {
    const left = Math.max(0, Math.ceil((effectEnds[t.id] - clock) / 1000));
    return `
      <button type="button" class="shop-item" data-treat="${t.id}" ${coins < t.cost ? "disabled" : ""}>
        <b>${t.name} · $${t.cost}</b>
        <span>${t.blurb}${left > 0 ? ` (${left}s left)` : ""}</span>
      </button>`;
  }).join("");
}

// The customers are gems, with little faces.
const shop = createShop({
  canvas: shopScene,
  newCustomer() {
    const type = pickType();
    return {
      name: type.name,
      points: type.points,
      draw(g, now) {
        drawGemShape(g, type, 44, now);
        g.fillStyle = "#000";
        g.beginPath();
        g.arc(-12, -4, 4, 0, Math.PI * 2);
        g.arc(12, -4, 4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#000";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 4, 9, 0.2, Math.PI - 0.2);
        g.stroke();
      },
    };
  },
  onServed(customer) {
    const pay = 3 + Math.ceil(customer.points / 5) + Math.floor(Math.random() * 3);
    coins += pay;
    save(COINS_KEY, String(coins));
    renderShop();
    return `+$${pay}!`;
  },
  say,
});

shopMenu.addEventListener("click", (event) => {
  const id = (event.target as HTMLElement).closest<HTMLElement>("[data-treat]")?.dataset["treat"] as keyof typeof effectEnds | undefined;
  const treat = TREATS.find((t) => t.id === id);
  if (!treat || coins < treat.cost) return;
  coins -= treat.cost;
  save(COINS_KEY, String(coins));
  effectEnds[treat.id] = Math.max(clock, effectEnds[treat.id]) + TREAT_MS;
  say(`One ${treat.name}, coming right up! It lasts while you play.`);
  renderShop();
});

shopButton.addEventListener("click", () => {
  say("Welcome to Mineral-N-Crystal! Grab a bun from the BUNS stack, drag it under the stations, and finish it with a Top Bun.");
  renderShop();
  shopPanel.hidden = false;
  shop.start();
});
shopBack.addEventListener("click", () => {
  shopPanel.hidden = true;
  shop.stop();
});

renderGemIndex();
requestAnimationFrame((t) => {
  lastReal = t;
  frame(t);
});
