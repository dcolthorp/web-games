// My Cozy Sewing — Penelope's game (2026-11-19).
// A cozy pink sewing shop. Cars zoom by outside the windows. Customers come in
// and ask for something: a dress, shoes, a shawl, a scarf, gloves, pants,
// socks or a quilt. You pick what to make, its color, a pattern and stickers,
// then sew along the dots, and sell it for coins.

import { crackScreen } from "../../shared/crackedScreen";
import { keepSaveFile, restoreSaveFile } from "../../shared/saveFile";

const W = 960;
const H = 600;
const SAVE_KEY = "my-cozy-sewing";

const canvas = document.getElementById("shop") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// ---------- Things you can make ----------

type ItemId = "dress" | "shoes" | "shawl" | "scarf" | "gloves" | "pants" | "socks" | "quilt";
type PatternId = "plain" | "dots" | "stripes" | "hearts" | "stars";
type StickerId = "button" | "bow" | "flower" | "heart" | "star" | "sparkle";

interface ItemDef {
  id: ItemId;
  name: string;
  /** "a dress" / "some shoes" */
  ask: string;
  /** Outline in a box from -1 to 1. */
  shape: [number, number][];
  round: number;
}

const ITEMS: ItemDef[] = [
  {
    id: "dress",
    name: "Dress",
    ask: "a dress",
    round: 0.08,
    shape: [
      [-0.25, -0.9], [0, -0.72], [0.25, -0.9], [0.48, -0.82], [0.52, -0.5], [0.3, -0.4],
      [0.28, -0.05], [0.82, 0.9], [-0.82, 0.9], [-0.28, -0.05], [-0.3, -0.4], [-0.52, -0.5], [-0.48, -0.82],
    ],
  },
  {
    id: "shoes",
    name: "Shoes",
    ask: "some shoes",
    round: 0.12,
    shape: [
      [-0.88, -0.05], [-0.35, -0.1], [-0.05, -0.45], [0.35, -0.5], [0.5, -0.12], [0.85, 0.08], [0.92, 0.45], [-0.88, 0.45],
    ],
  },
  {
    id: "shawl",
    name: "Shawl",
    ask: "a shawl",
    round: 0.1,
    shape: [[-0.95, -0.55], [0, -0.7], [0.95, -0.55], [0, 0.8]],
  },
  {
    id: "scarf",
    name: "Scarf",
    ask: "a scarf",
    round: 0.06,
    shape: [[-0.3, -0.92], [0.3, -0.92], [0.36, 0.7], [-0.24, 0.7]],
  },
  {
    id: "gloves",
    name: "Gloves",
    ask: "some gloves",
    round: 0.07,
    shape: [
      [-0.4, 0.9], [0.4, 0.9], [0.42, 0.1], [0.5, -0.35], [0.42, -0.5], [0.3, -0.38], [0.3, -0.66],
      [0.2, -0.8], [0.1, -0.66], [0.07, -0.86], [-0.04, -0.96], [-0.15, -0.86], [-0.16, -0.7],
      [-0.27, -0.8], [-0.38, -0.68], [-0.37, -0.1], [-0.64, -0.32], [-0.79, -0.22], [-0.46, 0.25],
    ],
  },
  {
    id: "pants",
    name: "Pants",
    ask: "some pants",
    round: 0.05,
    shape: [[-0.55, -0.9], [0.55, -0.9], [0.66, 0.9], [0.14, 0.9], [0, -0.15], [-0.14, 0.9], [-0.66, 0.9]],
  },
  {
    id: "socks",
    name: "Socks",
    ask: "some socks",
    round: 0.15,
    shape: [[-0.4, -0.9], [0.15, -0.9], [0.15, 0.3], [0.72, 0.4], [0.88, 0.66], [0.66, 0.9], [-0.22, 0.9], [-0.42, 0.66]],
  },
  {
    id: "quilt",
    name: "Quilt",
    ask: "a quilt",
    round: 0.05,
    shape: [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]],
  },
];
const itemById = (id: ItemId) => ITEMS.find((i) => i.id === id)!;

const COLORS = [
  { name: "pink", hex: "#ff8fc0" },
  { name: "red", hex: "#ef4f5f" },
  { name: "orange", hex: "#ffa24d" },
  { name: "yellow", hex: "#ffd84d" },
  { name: "green", hex: "#6fcf7a" },
  { name: "mint", hex: "#8fe3cf" },
  { name: "blue", hex: "#5aa6ff" },
  { name: "purple", hex: "#a77bff" },
  { name: "lavender", hex: "#d6c2ff" },
  { name: "brown", hex: "#a8754f" },
  { name: "white", hex: "#fbfbfb" },
  { name: "black", hex: "#3d3a4a" },
];
const colorName = (hex: string) => COLORS.find((c) => c.hex === hex)?.name ?? "";

const PATTERNS: { id: PatternId; name: string }[] = [
  { id: "plain", name: "plain" },
  { id: "dots", name: "dots" },
  { id: "stripes", name: "stripes" },
  { id: "hearts", name: "hearts" },
  { id: "stars", name: "stars" },
];
const STICKERS: StickerId[] = ["button", "bow", "flower", "heart", "star", "sparkle"];

interface Sticker { kind: StickerId; x: number; y: number }
interface Design { item: ItemId; color: string; pattern: PatternId; stickers: Sticker[] }

// ---------- Save ----------

interface Save { coins: number; sold: number; rack: Design[] }

function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (s) return { coins: s.coins ?? 0, sold: s.sold ?? 0, rack: s.rack ?? [] };
  } catch {
    // A broken save: start fresh.
  }
  return { coins: 0, sold: 0, rack: [] };
}
let save: Save = { coins: 0, sold: 0, rack: [] };
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // No storage.
  }
}

// ---------- Sounds ----------

let audio: AudioContext | null = null;
function beep(freq: number, dur = 0.08, type: OscillatorType = "sine", vol = 0.15, when = 0) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime + when;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    // No sound, that's okay.
  }
}
const sndClick = () => beep(660, 0.06, "triangle");
const sndStitch = (i: number) => beep(500 + (i % 8) * 60, 0.05, "square", 0.06);
const sndCoins = () => [880, 1100, 1320, 1760].forEach((f, i) => beep(f, 0.12, "triangle", 0.12, i * 0.08));
const sndDone = () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, "sine", 0.15, i * 0.1));

function sndBoom() {
  try {
    audio ??= new AudioContext();
    const len = audio.sampleRate * 0.8;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audio.createBufferSource();
    const g = audio.createGain();
    g.gain.value = 0.6;
    src.buffer = buf;
    src.connect(g).connect(audio.destination);
    src.start();
  } catch {
    // No sound.
  }
  beep(70, 0.6, "sawtooth", 0.35);
  [2400, 3100, 1900, 2800].forEach((f, i) => beep(f, 0.12, "triangle", 0.08, 0.05 + i * 0.06));
}

// ---------- Drawing helpers ----------

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  r = f(r); g = f(g); b = f(b);
  return `rgb(${r},${g},${b})`;
}
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 200;
}

function rrect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function heartPath(x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}
function starPath(x: number, y: number, r: number, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function text(s: string, x: number, y: number, size = 20, color = "#7a2f5a", align: CanvasTextAlign = "center", weight = "700") {
  ctx.font = `${weight} ${size}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

/** Path of a thing you can make, with rounded corners. */
function itemPath(item: ItemDef, cx: number, cy: number, size: number) {
  const pts = item.shape.map(([x, y]) => [cx + x * size, cy + y * size] as const);
  const r = item.round * size;
  ctx.beginPath();
  const n = pts.length;
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(start[0]!, start[1]!);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const m = mid(p, next);
    ctx.arcTo(p[0], p[1], m[0]!, m[1]!, r);
  }
  ctx.closePath();
}

function drawPattern(pattern: PatternId, color: string, cx: number, cy: number, size: number) {
  if (pattern === "plain") return;
  const ink = isLight(color) ? shade(color, -0.35) : "rgba(255,255,255,0.75)";
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  const step = size * 0.26;
  if (pattern === "stripes") {
    ctx.lineWidth = size * 0.07;
    for (let k = -3 * size; k < 3 * size; k += step) {
      ctx.beginPath();
      ctx.moveTo(cx + k - size, cy - size);
      ctx.lineTo(cx + k + size, cy + size);
      ctx.stroke();
    }
    return;
  }
  let row = 0;
  for (let y = cy - size; y <= cy + size + step; y += step, row++) {
    for (let x = cx - size + (row % 2 ? step / 2 : 0); x <= cx + size + step; x += step) {
      if (pattern === "dots") {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.045, 0, Math.PI * 2);
        ctx.fill();
      } else if (pattern === "hearts") {
        heartPath(x, y, size * 0.06);
        ctx.fill();
      } else {
        starPath(x, y, size * 0.075);
        ctx.fill();
      }
    }
  }
}

function drawSticker(kind: StickerId, x: number, y: number, r: number) {
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.12);
  if (kind === "button") {
    ctx.fillStyle = "#fff3c4";
    ctx.strokeStyle = "#c79a3a";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c79a3a";
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.arc(x + dx! * r * 0.22, y + dy! * r * 0.22, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === "bow") {
    ctx.fillStyle = "#ff5c9a";
    ctx.strokeStyle = "#c22f6c";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + s * r * 1.2, y - r * 0.9, x + s * r, y);
      ctx.quadraticCurveTo(x + s * r * 1.2, y + r * 0.9, x, y);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "flower") {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#f2a0c4";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#ffd84d";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "heart") {
    ctx.fillStyle = "#ff3d6e";
    ctx.strokeStyle = "#b5163f";
    heartPath(x, y, r * 0.8);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "star") {
    ctx.fillStyle = "#ffd84d";
    ctx.strokeStyle = "#d19a12";
    starPath(x, y, r);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = "#bff3ff";
    ctx.strokeStyle = "#4cb7d8";
    starPath(x, y, r, 4, 0.3);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws something you made (or are making). */
function drawItem(d: Design, cx: number, cy: number, size: number, outline: "solid" | "none" = "solid") {
  const item = itemById(d.item);
  ctx.save();
  itemPath(item, cx, cy, size);
  ctx.fillStyle = d.color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  drawPattern(d.pattern, d.color, cx, cy, size);
  // Extra bits for some things.
  const dark = shade(d.color, -0.3);
  ctx.strokeStyle = dark;
  ctx.fillStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  if (d.item === "shoes") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(cx - size, cy + size * 0.3, size * 2, size * 0.2);
  } else if (d.item === "quilt") {
    ctx.setLineDash([size * 0.06, size * 0.05]);
    for (const k of [-0.28, 0.28]) {
      ctx.beginPath();
      ctx.moveTo(cx + k * size, cy - size);
      ctx.lineTo(cx + k * size, cy + size);
      ctx.moveTo(cx - size, cy + k * size);
      ctx.lineTo(cx + size, cy + k * size);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (const [px, py] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) {
      ctx.fillRect(cx + (px! * 0.56 - 0.28) * size, cy + (py! * 0.56 - 0.28) * size, size * 0.56, size * 0.56);
    }
  } else if (d.item === "socks") {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(cx - size, cy - size, size * 2, size * 0.3);
  } else if (d.item === "gloves") {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillRect(cx - size, cy + size * 0.6, size * 2, size * 0.4);
  } else if (d.item === "pants") {
    ctx.fillStyle = dark;
    ctx.fillRect(cx - size, cy - size * 0.92, size * 2, size * 0.14);
  }
  ctx.restore();
  if (outline === "solid") {
    itemPath(item, cx, cy, size);
    ctx.strokeStyle = shade(d.color, -0.4);
    ctx.lineWidth = Math.max(1.5, size * 0.025);
    ctx.stroke();
  }
  // Fringe on scarves and shawls.
  if (d.item === "scarf" || d.item === "shawl") {
    ctx.strokeStyle = shade(d.color, -0.15);
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.lineCap = "round";
    if (d.item === "scarf") {
      for (let k = -0.2; k <= 0.3; k += 0.1) {
        ctx.beginPath();
        ctx.moveTo(cx + k * size, cy + 0.7 * size);
        ctx.lineTo(cx + k * size, cy + 0.92 * size);
        ctx.stroke();
      }
    } else {
      for (let t = 0.1; t < 1; t += 0.12) {
        for (const s of [-1, 1]) {
          const x = cx + s * 0.95 * size * (1 - t);
          const y = cy + (-0.55 + 1.35 * t) * size;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + s * size * 0.06, y + size * 0.12);
          ctx.stroke();
        }
      }
    }
  }
  for (const s of d.stickers) drawSticker(s.kind, cx + s.x * size, cy + s.y * size, size * 0.11);
  ctx.restore();
}

// ---------- Stitch dots ----------

function stitchDots(item: ItemDef, cx: number, cy: number, size: number): [number, number][] {
  // Pull the outline in a little so the dots sit on the fabric's edge.
  const pts = item.shape.map(([x, y]) => [cx + x * size * 0.94, cy + y * size * 0.94] as [number, number]);
  const segs = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const total = segs.reduce((a, s) => a + s.len, 0);
  const n = Math.max(14, Math.min(26, Math.round(total / 60)));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let d = (i / n) * total;
    for (const s of segs) {
      if (d <= s.len) {
        const t = d / s.len;
        out.push([s.p[0] + (s.q[0] - s.p[0]) * t, s.p[1] + (s.q[1] - s.p[1]) * t]);
        break;
      }
      d -= s.len;
    }
  }
  return out;
}

// ---------- Customers ----------

const NAMES = ["Mia", "Leo", "Grandma Rose", "Sam", "Ruby", "Max", "Lily", "Theo", "Zoe", "Mr. Button", "Ava", "Finn", "Auntie June", "Nora", "Ollie"];
const SKINS = ["#f6d2b8", "#e8b48f", "#c68d62", "#8d5a3b", "#f1c7a5"];
const HAIRS = ["#3a2a20", "#7a4a2a", "#e8c25a", "#d8642c", "#1b1b1b", "#c9c9d6"];

interface Customer {
  name: string;
  skin: string;
  hair: string;
  hairStyle: number;
  shirt: string;
  x: number;
  want: { item: ItemId; color: string; pattern: PatternId | null };
}

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

function newCustomer(): Customer {
  return {
    name: pick(NAMES),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: Math.floor(Math.random() * 3),
    shirt: pick(COLORS).hex,
    x: 70,
    want: {
      item: pick(ITEMS).id,
      color: pick(COLORS).hex,
      pattern: Math.random() < 0.5 ? pick(PATTERNS.slice(1)).id : null,
    },
  };
}

function wantText(c: Customer): string {
  const w = c.want;
  let s = `${itemById(w.item).ask.replace(/^(a|some) /, `$1 ${colorName(w.color)} `)}`;
  if (w.pattern) s += ` with ${w.pattern}`;
  return s;
}

function drawPerson(c: Customer, baseY: number, happy: boolean, walking: boolean) {
  const x = c.x;
  const bob = walking ? Math.abs(Math.sin(time * 9)) * -6 : 0;
  const y = baseY + bob;
  // Legs
  ctx.fillStyle = "#4a4a6a";
  ctx.fillRect(x - 28, y - 62, 22, 62);
  ctx.fillRect(x + 6, y - 62, 22, 62);
  // Body
  ctx.fillStyle = c.shirt;
  rrect(x - 42, y - 155, 84, 100, 26);
  ctx.fill();
  ctx.strokeStyle = shade(c.shirt, -0.3);
  ctx.lineWidth = 3;
  ctx.stroke();
  // Head
  const hy = y - 192;
  if (c.hairStyle === 1) {
    // Long hair behind
    ctx.fillStyle = c.hair;
    for (const s of [-1, 1]) {
      rrect(x + s * 30 - 12, hy - 20, 24, 78, 12);
      ctx.fill();
    }
  }
  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.arc(x, hy, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(x, hy - 4, 40, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  if (c.hairStyle === 2) {
    ctx.beginPath();
    ctx.arc(x, hy - 46, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  // Face
  ctx.fillStyle = "#3a2a3a";
  ctx.strokeStyle = "#3a2a3a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  if (happy) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * 14, hy + 2, 6, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + s * 14, hy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255,120,150,0.45)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * 24, hy + 12, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, hy + 10, happy ? 13 : 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// ---------- The shop ----------

interface Car { x: number; lane: number; speed: number; color: string; kind: number }
const cars: Car[] = [];
const WINDOWS = [
  { x: 190, y: 90, w: 170, h: 150 },
  { x: 395, y: 90, w: 170, h: 150 },
  { x: 600, y: 90, w: 170, h: 150 },
];
let carTimer = 0;

function updateCars(dt: number) {
  carTimer -= dt;
  if (carTimer <= 0) {
    carTimer = 0.6 + Math.random() * 1.6;
    const lane = Math.random() < 0.5 ? 0 : 1;
    const speed = (280 + Math.random() * 420) * (lane === 0 ? 1 : -1);
    cars.push({ x: lane === 0 ? -140 : W + 140, lane, speed, color: pick(COLORS).hex, kind: Math.floor(Math.random() * 3) });
  }
  for (const c of cars) c.x += c.speed * dt;
  for (let i = cars.length - 1; i >= 0; i--) if (cars[i]!.x < -200 || cars[i]!.x > W + 200) cars.splice(i, 1);
}

function drawCar(c: Car) {
  const y = c.lane === 0 ? 218 : 200;
  const len = c.kind === 2 ? 130 : 100;
  ctx.save();
  ctx.translate(c.x, y);
  if (c.speed < 0) ctx.scale(-1, 1);
  ctx.fillStyle = c.color;
  rrect(-len / 2, -22, len, 24, 8);
  ctx.fill();
  rrect(-len / 2 + (c.kind === 1 ? 10 : 20), -42, len * (c.kind === 2 ? 0.75 : 0.5), 24, 10);
  ctx.fill();
  ctx.fillStyle = "#cfefff";
  rrect(-len / 2 + (c.kind === 1 ? 16 : 26), -38, len * (c.kind === 2 ? 0.66 : 0.38), 16, 5);
  ctx.fill();
  ctx.fillStyle = "#2b2b38";
  for (const k of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(k * len, 3, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // Zoom lines
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  for (const k of [-14, -4]) {
    ctx.beginPath();
    ctx.moveTo(-len / 2 - 14, k);
    ctx.lineTo(-len / 2 - 40, k);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOutside() {
  ctx.save();
  ctx.beginPath();
  for (const w of WINDOWS) ctx.rect(w.x, w.y, w.w, w.h);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, 90, 0, 240);
  sky.addColorStop(0, "#9fd8ff");
  sky.addColorStop(1, "#e6f6ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 90, W, 150);
  ctx.fillStyle = "#fff6a8";
  ctx.beginPath();
  ctx.arc(700, 120, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  for (const [cx, cy] of [[250, 120], [480, 110], [640, 135]]) {
    const x = ((cx! + time * 12) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.arc(x, cy!, 14, 0, Math.PI * 2);
    ctx.arc(x + 16, cy! - 6, 16, 0, Math.PI * 2);
    ctx.arc(x + 32, cy!, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#9bd88f";
  ctx.fillRect(0, 165, W, 20);
  ctx.fillStyle = "#6b6b7a";
  ctx.fillRect(0, 180, W, 60);
  ctx.fillStyle = "#fff";
  for (let x = -((time * 0) % 60); x < W; x += 60) ctx.fillRect(x, 207, 30, 4);
  for (const c of cars) drawCar(c);
  ctx.restore();
  // Window frames
  for (const w of WINDOWS) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 10;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w.x + w.w / 2, w.y);
    ctx.lineTo(w.x + w.w / 2, w.y + w.h);
    ctx.moveTo(w.x, w.y + w.h / 2 - 20);
    ctx.lineTo(w.x + w.w, w.y + w.h / 2 - 20);
    ctx.stroke();
    // Curtains
    ctx.fillStyle = "#ffd1e6";
    for (const s of [0, 1]) {
      ctx.beginPath();
      const x0 = s === 0 ? w.x - 14 : w.x + w.w + 14;
      const dir = s === 0 ? 1 : -1;
      ctx.moveTo(x0, w.y - 12);
      ctx.lineTo(x0 + dir * 34, w.y - 12);
      ctx.quadraticCurveTo(x0 + dir * 10, w.y + w.h / 2, x0 + dir * 30, w.y + w.h + 14);
      ctx.lineTo(x0, w.y + w.h + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#e9a0c0";
    ctx.fillRect(w.x - 20, w.y - 18, w.w + 40, 8);
  }
}

/** A wooden floor with planks, from `top` down to the bottom. */
function drawFloor(top: number) {
  const plank = 32;
  for (let row = 0, y = top; y < H; row++, y += plank) {
    const off = (row % 3) * 70;
    for (let x = -off, k = 0; x < W; x += 210, k++) {
      ctx.fillStyle = (row + k) % 2 ? "#e2ad78" : "#d99d63";
      ctx.fillRect(x, y, 210, plank);
      // Wood lines
      ctx.strokeStyle = "rgba(140,85,40,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + plank * 0.4);
      ctx.quadraticCurveTo(x + 100, y + plank * 0.2, x + 180, y + plank * 0.55);
      ctx.stroke();
      // Seam between planks
      ctx.fillStyle = "#a86f3d";
      ctx.fillRect(x, y, 3, plank);
    }
    ctx.fillStyle = "#a86f3d";
    ctx.fillRect(0, y, W, 2);
  }
}

function drawRoom() {
  // Pink walls with little hearts wallpaper
  ctx.fillStyle = "#ffc3dc";
  ctx.fillRect(0, 0, W, 470);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let y = 30; y < 460; y += 60) for (let x = (y / 60) % 2 ? 30 : 0; x < W; x += 60) {
    heartPath(x, y, 6);
    ctx.fill();
  }
  // Wainscot
  ctx.fillStyle = "#ffe3ef";
  ctx.fillRect(0, 380, W, 90);
  ctx.fillStyle = "#f3a9c9";
  ctx.fillRect(0, 376, W, 6);
  ctx.fillRect(0, 466, W, 8);
  drawFloor(474);
  // Rug
  ctx.fillStyle = "#ff9cc6";
  ctx.beginPath();
  ctx.ellipse(480, 545, 230, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd0e4";
  ctx.beginPath();
  ctx.ellipse(480, 545, 180, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  drawOutside();

  // Door
  ctx.fillStyle = "#c9875a";
  rrect(22, 250, 110, 222, 10);
  ctx.fill();
  ctx.fillStyle = "#b37449";
  rrect(36, 268, 82, 80, 6);
  ctx.fill();
  rrect(36, 362, 82, 92, 6);
  ctx.fill();
  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  ctx.arc(116, 370, 7, 0, Math.PI * 2);
  ctx.fill();
  text("OPEN", 77, 236, 16, "#d0477f");

  // Clothesline with things you've sold
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 34);
  ctx.quadraticCurveTo(480, 58, 810, 34);
  ctx.stroke();
  save.rack.slice(-8).forEach((d, i) => {
    const x = 200 + i * 80;
    const t = (x - 150) / 660;
    const y = 34 + 4 * t * (1 - t) * 24 + 26;
    drawItem(d, x, y, 22);
    ctx.fillStyle = "#c9875a";
    ctx.fillRect(x - 3, y - 30, 6, 12);
  });

  // Fabric shelf
  ctx.fillStyle = "#fff";
  ctx.fillRect(150, 300, 140, 8);
  ctx.fillRect(150, 350, 140, 8);
  COLORS.slice(0, 10).forEach((c, i) => {
    const x = 158 + (i % 5) * 26;
    const y = i < 5 ? 272 : 322;
    ctx.fillStyle = c.hex;
    rrect(x, y, 22, 28, 5);
    ctx.fill();
    ctx.strokeStyle = shade(c.hex, -0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Sewing table + machine
  ctx.fillStyle = "#c9875a";
  ctx.fillRect(720, 378, 210, 16);
  ctx.fillRect(732, 394, 14, 80);
  ctx.fillRect(904, 394, 14, 80);
  ctx.fillStyle = "#fff";
  rrect(752, 318, 150, 60, 14);
  ctx.fill();
  rrect(752, 290, 40, 60, 10);
  ctx.fill();
  rrect(752, 284, 150, 34, 14);
  ctx.fill();
  ctx.fillStyle = "#ff8fc0";
  rrect(770, 330, 112, 12, 6);
  ctx.fill();
  ctx.fillStyle = "#999";
  ctx.fillRect(872, 318, 5, 34);
  ctx.fillStyle = "#ff5c9a";
  ctx.beginPath();
  ctx.arc(830, 280, 10, 0, Math.PI * 2);
  ctx.fill();
  text("🧵", 900, 360, 26);
}

function drawCounter() {
  ctx.fillStyle = "#f7a6c8";
  rrect(290, 404, 380, 100, 12);
  ctx.fill();
  ctx.fillStyle = "#ffd6e7";
  rrect(280, 396, 400, 22, 10);
  ctx.fill();
  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  ctx.arc(620, 386, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7b2ff";
  rrect(316, 436, 330, 50, 10);
  ctx.fill();
  text("✿ Cozy Sewing ✿", 481, 462, 24, "#fff");
}

function bubble(x: number, y: number, w: number, h: number, tailX: number) {
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#f3a9c9";
  ctx.lineWidth = 4;
  rrect(x, y, w, h, 20);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tailX - 14, y + h - 2);
  ctx.lineTo(tailX - 30, y + h + 26);
  ctx.lineTo(tailX + 10, y + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tailX - 14, y + h);
  ctx.lineTo(tailX - 30, y + h + 26);
  ctx.lineTo(tailX + 10, y + h);
  ctx.stroke();
}

// ---------- Buttons ----------

interface Button { x: number; y: number; w: number; h: number; onClick: () => void }
let buttons: Button[] = [];

function button(label: string, x: number, y: number, w: number, h: number, onClick: () => void, opts: { main?: boolean; on?: boolean; size?: number } = {}) {
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  ctx.fillStyle = opts.main ? "#c22f6c" : "#e9a0c0";
  rrect(x, y + 4, w, h, h / 2.4);
  ctx.fill();
  ctx.fillStyle = opts.main ? (hover ? "#ff4f93" : "#ff6aa5") : opts.on ? "#ff8fc0" : hover ? "#ffe3ef" : "#fff";
  rrect(x, y, w, h, h / 2.4);
  ctx.fill();
  text(label, x + w / 2, y + h / 2 + 1, opts.size ?? 20, opts.main || opts.on ? "#fff" : "#c22f6c");
  buttons.push({ x, y, w, h, onClick });
}

function tile(x: number, y: number, w: number, h: number, on: boolean, onClick: () => void) {
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h;
  ctx.fillStyle = on ? "#ffe3ef" : hover ? "#fff5f9" : "#fff";
  ctx.strokeStyle = on ? "#ff5c9a" : "#f3c5d9";
  ctx.lineWidth = on ? 5 : 3;
  rrect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  buttons.push({ x, y, w, h, onClick });
}

// ---------- Game state ----------

type Phase = "title" | "arriving" | "ordering" | "design" | "sew" | "sewn" | "giving" | "leaving";
let phase: Phase = "title";
let time = 0;
let phaseTime = 0;
let customer = newCustomer();
let design: Design = { item: "dress", color: COLORS[0]!.hex, pattern: "plain", stickers: [] };
let stickerTool: StickerId | null = null;
let sewn = 0;
let dots: [number, number][] = [];
let reaction = "";
let pay = 0;
const mouse = { x: -100, y: -100, down: false };
interface Pop { x: number; y: number; t: number; s: string; color: string }
const pops: Pop[] = [];
interface Confetti { x: number; y: number; vx: number; vy: number; color: string; t: number }
const confetti: Confetti[] = [];

function setPhase(p: Phase) {
  phase = p;
  phaseTime = 0;
  canvas.style.cursor = p === "sew" ? "none" : "default";
}

const SEW = { cx: 480, cy: 330, size: 200 };
const PREVIEW = { cx: 462, cy: 305, size: 165 };

function startSewing() {
  dots = stitchDots(itemById(design.item), SEW.cx, SEW.cy, SEW.size);
  sewn = 0;
  setPhase("sew");
}

function tryStitch(x: number, y: number) {
  if (phase !== "sew" || sewn >= dots.length) return;
  const d = dots[sewn]!;
  if (Math.hypot(d[0] - x, d[1] - y) < 30) {
    sndStitch(sewn);
    sewn++;
    if (sewn >= dots.length) {
      sndDone();
      for (let i = 0; i < 60; i++) {
        confetti.push({ x: SEW.cx, y: SEW.cy, vx: (Math.random() - 0.5) * 700, vy: -Math.random() * 600 - 100, color: pick(COLORS).hex, t: 0 });
      }
      setPhase("sewn");
    }
  }
}

function giveItem() {
  const w = customer.want;
  const itemOk = design.item === w.item;
  const colorOk = design.color === w.color;
  const patternOk = !w.pattern || design.pattern === w.pattern;
  pay = itemOk ? 10 : 4;
  if (itemOk && colorOk) pay += 5;
  if (itemOk && w.pattern && patternOk) pay += 5;
  pay += Math.min(5, design.stickers.length);
  if (itemOk && colorOk && patternOk) reaction = pick(["I LOVE it! It's perfect! 💖", "Wow! Just what I wanted! 🥰", "It's sooo cozy! Thank you! 💕"]);
  else if (itemOk) reaction = pick(["Ooh, it's a little different, but I love it! 😊", "So pretty! I like it anyway! 💗"]);
  else reaction = `Oh! That's not ${itemById(w.item).ask}... but it's so cute! 😄`;
  save.coins += pay;
  save.sold++;
  save.rack.push(structuredClone(design));
  if (save.rack.length > 8) save.rack.shift();
  writeSave();
  sndCoins();
  pops.push({ x: 480, y: 250, t: 0, s: `+${pay} 🪙`, color: "#d19a12" });
  setPhase("giving");
}

// ---------- The floor that doesn't like being touched ----------

const FLOOR_SAYS = ["Would you please stop?", "Can you PLEASE stop.", "PLEASE STOP. I'M SERIOUS.", "I warned you"];
let floorClicks = 0;
let floorMsg = "";
let floorMsgAt = { x: 0, y: 0 };
let floorMsgT = 0;
type MalletStep = "rise" | "count" | "turn" | "back" | "zoom" | "sink";
let mallet: { step: MalletStep; t: number } | null = null;
let shakeT = 0;
let flashT = 0;
const HOLE = { x: 480, y: 560 };

function isFloor(x: number, y: number) {
  if (y < 476) return false;
  // The counter stands on the floor; that's not the floor.
  return !(x > 280 && x < 680 && y < 506);
}

function touchFloor(x: number, y: number) {
  floorMsg = FLOOR_SAYS[Math.min(floorClicks, 3)]!;
  floorMsgAt = { x, y };
  floorMsgT = 0;
  floorClicks++;
  beep(floorClicks >= 3 ? 140 : 220, 0.2, "square", 0.08);
  if (floorClicks >= 4) {
    floorClicks = 0;
    window.setTimeout(() => (mallet = { step: "rise", t: 0 }), 1200);
  }
}

function drawFloorMsg(dt: number) {
  if (!floorMsg) return;
  floorMsgT += dt;
  if (floorMsgT > 2.6) {
    floorMsg = "";
    return;
  }
  const loud = floorMsg !== FLOOR_SAYS[0] && floorMsg !== FLOOR_SAYS[1];
  ctx.font = `800 ${loud ? 24 : 20}px "Trebuchet MS", sans-serif`;
  const w = ctx.measureText(floorMsg).width + 40;
  const x = Math.max(10, Math.min(W - w - 10, floorMsgAt.x - w / 2));
  const y = floorMsgAt.y - 90;
  bubble(x, y, w, 52, Math.max(x + 40, Math.min(x + w - 20, floorMsgAt.x + 10)));
  const shake = loud ? (Math.random() - 0.5) * 3 : 0;
  text(floorMsg, x + w / 2 + shake, y + 27, loud ? 24 : 20, loud ? "#d0243f" : "#7a2f5a", "center", "800");
}

function drawMalletSide(cx: number, cy: number, scaleX: number, number: number | null) {
  // Handle, going down into the floor.
  ctx.fillStyle = "#a0683a";
  ctx.fillRect(cx - 14, cy + 50, 28, HOLE.y - cy - 50);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scaleX, 1);
  // Head
  ctx.fillStyle = "#c48a55";
  rrect(-140, -58, 280, 116, 24);
  ctx.fill();
  ctx.fillStyle = "#9c6535";
  rrect(-140, -58, 34, 116, 16);
  ctx.fill();
  rrect(106, -58, 34, 116, 16);
  ctx.fill();
  // White strip in the middle, with a clock and the countdown.
  ctx.fillStyle = "#fff";
  ctx.fillRect(-56, -58, 112, 116);
  ctx.restore();
  if (number !== null && scaleX > 0.5) {
    text("⏰", cx - 24 * scaleX, cy, 34);
    text(String(number), cx + 28 * scaleX, cy + 2, 46, "#d0243f", "center", "900");
  }
}

function drawMalletFace(cx: number, cy: number, s: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = "#9c6535";
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7d4c24";
  ctx.lineWidth = 3;
  for (const r of [18, 32, 46]) {
    ctx.beginPath();
    ctx.arc(2, 1, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMallet(dt: number) {
  if (!mallet) return;
  mallet.t += dt;
  const m = mallet;
  const top = 300;
  // The trap door in the floor.
  const open = m.step === "sink" ? Math.max(0, 1 - m.t / 0.6) : Math.min(1, m.t / 0.3 + (m.step === "rise" ? 0 : 1));
  ctx.fillStyle = "#2b1a12";
  ctx.beginPath();
  ctx.ellipse(HOLE.x, HOLE.y, 70 * open, 22 * open, 0, 0, Math.PI * 2);
  ctx.fill();
  if (m.step === "rise") {
    const p = Math.min(1, m.t / 0.9);
    const cy = HOLE.y + 120 - (HOLE.y + 120 - top) * (1 - Math.pow(1 - p, 3));
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, HOLE.y);
    ctx.ellipse(HOLE.x, HOLE.y, 70, 22, 0, 0, Math.PI * 2);
    ctx.clip();
    drawMalletSide(HOLE.x, cy, 1, 5);
    ctx.restore();
    if (p >= 1) mallet = { step: "count", t: 0 };
  } else if (m.step === "count") {
    const n = 5 - Math.floor(m.t);
    if (Math.floor(m.t) !== Math.floor(m.t - dt)) beep(n === 1 ? 990 : 660, 0.12, "square", 0.1);
    drawMalletSide(HOLE.x, top, 1, Math.max(1, n));
    if (m.t >= 5) mallet = { step: "turn", t: 0 };
  } else if (m.step === "turn") {
    const p = Math.min(1, m.t / 0.6);
    if (p < 0.5) drawMalletSide(HOLE.x, top, Math.cos(p * Math.PI), 1);
    else drawMalletFace(HOLE.x, top, (p - 0.5) * 2);
    if (p >= 1) mallet = { step: "back", t: 0 };
  } else if (m.step === "back") {
    // It goes far, far away...
    const p = Math.min(1, m.t / 0.9);
    drawMalletFace(HOLE.x, top - 20 * p, 1 - 0.88 * p);
    if (p >= 1) mallet = { step: "zoom", t: 0 };
  } else if (m.step === "zoom") {
    // ...then speeds up toward the screen!
    const p = Math.min(1, m.t / 0.4);
    drawMalletFace(HOLE.x, top - 20, 0.12 + 9 * p * p * p);
    if (p >= 1) {
      sndBoom();
      shakeT = 0.6;
      flashT = 0.25;
      const r = canvas.getBoundingClientRect();
      crackScreen((r.left + (HOLE.x / W) * r.width) / window.innerWidth, (r.top + ((top - 20) / H) * r.height) / window.innerHeight);
      mallet = { step: "sink", t: 0 };
    }
  } else if (m.t > 0.6) {
    mallet = null;
  }
}

// ---------- Screens ----------

function drawHud() {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  rrect(12, 10, 210, 40, 20);
  ctx.fill();
  text(`🪙 ${save.coins}   👗 ${save.sold} sold`, 117, 31, 20, "#c22f6c");
}

function drawShop(dt: number) {
  drawRoom();
  const walking = phase === "arriving" || phase === "leaving";
  if (phase === "arriving") {
    customer.x = Math.min(480, customer.x + 260 * dt);
    if (customer.x >= 480) setPhase("ordering");
  } else if (phase === "leaving") {
    customer.x -= 300 * dt;
    if (customer.x < 60) {
      customer = newCustomer();
      setPhase("arriving");
    }
  }
  if (phase !== "title") {
    drawPerson(customer, 470, phase === "giving" || phase === "leaving", walking);
    if (phase === "giving" || phase === "leaving") drawItem(design, customer.x + (phase === "leaving" ? -50 : 0), 360, 40);
  }
  drawCounter();
  drawFloorMsg(dt);

  if (mallet) {
    // Nothing else while the mallet is out.
    drawMallet(dt);
    drawHud();
    return;
  }

  if (phase === "ordering") {
    bubble(560, 150, 350, 150, 560);
    text(`Hi! I'm ${customer.name}!`, 735, 178, 20, "#c22f6c");
    text("Can you make me", 735, 204, 18, "#7a2f5a", "center", "400");
    text(wantText(customer) + "?", 735, 228, 20, "#7a2f5a");
    drawItem({ item: customer.want.item, color: customer.want.color, pattern: customer.want.pattern ?? "plain", stickers: [] }, 735, 268, 22);
    button("🪡 Start sewing!", 700, 520, 230, 56, () => {
      sndClick();
      design = { item: "dress", color: COLORS[0]!.hex, pattern: "plain", stickers: [] };
      stickerTool = null;
      setPhase("design");
    }, { main: true, size: 22 });
  } else if (phase === "giving") {
    bubble(560, 160, 360, 90, 560);
    ctx.save();
    const lines = reaction.length > 30 ? splitLine(reaction) : [reaction];
    lines.forEach((l, i) => text(l, 740, 205 + (i - (lines.length - 1) / 2) * 26, 19, "#7a2f5a"));
    ctx.restore();
    button("👋 Bye! Next customer", 680, 520, 260, 56, () => {
      sndClick();
      setPhase("leaving");
    }, { main: true });
  }
  drawHud();

  if (phase === "title") {
    ctx.fillStyle = "rgba(255,240,247,0.85)";
    ctx.fillRect(0, 0, W, H);
    text("🪡 My Cozy Sewing 🧵", 480, 200, 56, "#d0477f");
    text("Make cozy things for your customers and sell them!", 480, 262, 22, "#7a2f5a", "center", "400");
    button(save.sold > 0 ? "▶️ Open the shop again" : "▶️ Open the shop", 330, 320, 300, 70, () => {
      sndDone();
      customer = newCustomer();
      setPhase("arriving");
    }, { main: true, size: 26 });
    text("Made by Penelope 💖", 480, 440, 18, "#c22f6c");
  }
}

function splitLine(s: string): string[] {
  const words = s.split(" ");
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

function drawWorkbench() {
  // Background: pink wall + wood table
  ctx.fillStyle = "#ffc3dc";
  ctx.fillRect(0, 0, W, H);
  drawFloor(440);
  ctx.fillStyle = "#f1cfa8";
  rrect(212, 70, 500, 440, 30);
  ctx.fill();
  ctx.fillStyle = "#fff7ee";
  rrect(232, 90, 460, 400, 24);
  ctx.fill();
}

function orderLine() {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  rrect(240, 10, 700, 40, 20);
  ctx.fill();
  text(`📝 ${customer.name} wants ${wantText(customer)}`, 590, 31, 19, "#7a2f5a");
}

function drawDesign() {
  drawWorkbench();
  orderLine();
  drawHud();

  // What to make
  text("What to make?", 110, 72, 18, "#c22f6c");
  ITEMS.forEach((it, i) => {
    const x = 16 + (i % 2) * 98;
    const y = 88 + Math.floor(i / 2) * 104;
    tile(x, y, 90, 96, design.item === it.id, () => {
      sndClick();
      design.item = it.id;
    });
    drawItem({ item: it.id, color: design.color, pattern: "plain", stickers: [] }, x + 45, y + 40, 26);
    text(it.name, x + 45, y + 82, 15, "#7a2f5a");
  });

  // The thing you're making
  drawItem(design, PREVIEW.cx, PREVIEW.cy, PREVIEW.size);
  if (stickerTool) {
    text(`Click on it to stick a ${stickerTool}!`, PREVIEW.cx, 112, 18, "#c22f6c");
    const inside = isInsidePreview(mouse.x, mouse.y);
    if (inside) {
      ctx.globalAlpha = 0.6;
      drawSticker(stickerTool, mouse.x, mouse.y, PREVIEW.size * 0.11);
      ctx.globalAlpha = 1;
    }
  }

  // Colors
  text("Color", 830, 72, 18, "#c22f6c");
  COLORS.forEach((c, i) => {
    const x = 728 + (i % 4) * 54;
    const y = 86 + Math.floor(i / 4) * 54;
    const on = design.color === c.hex;
    ctx.fillStyle = c.hex;
    ctx.strokeStyle = on ? "#c22f6c" : "#fff";
    ctx.lineWidth = on ? 5 : 3;
    ctx.beginPath();
    ctx.arc(x + 22, y + 22, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    buttons.push({ x, y, w: 44, h: 44, onClick: () => { sndClick(); design.color = c.hex; } });
  });

  // Patterns
  text("Pattern", 830, 262, 18, "#c22f6c");
  PATTERNS.forEach((p, i) => {
    const x = 722 + i * 45;
    const y = 278;
    tile(x, y, 41, 41, design.pattern === p.id, () => { sndClick(); design.pattern = p.id; });
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 20.5, y + 20.5, 15, 0, Math.PI * 2);
    ctx.fillStyle = design.color;
    ctx.fill();
    ctx.clip();
    drawPattern(p.id, design.color, x + 20.5, y + 20.5, 40);
    ctx.restore();
  });

  // Stickers
  text("Stickers", 830, 344, 18, "#c22f6c");
  STICKERS.forEach((s, i) => {
    const x = 728 + (i % 3) * 72;
    const y = 360 + Math.floor(i / 3) * 62;
    tile(x, y, 64, 54, stickerTool === s, () => { sndClick(); stickerTool = stickerTool === s ? null : s; });
    drawSticker(s, x + 32, y + 27, 18);
  });
  button("↩️ Undo", 728, 492, 100, 40, () => { sndClick(); design.stickers.pop(); }, { size: 17 });
  button("🧽 Clear", 838, 492, 100, 40, () => { sndClick(); design.stickers = []; }, { size: 17 });

  button("🪡 Sew it!", 362, 524, 200, 60, () => { sndClick(); stickerTool = null; startSewing(); }, { main: true, size: 26 });
  button("⬅️ Shop", 16, 530, 120, 50, () => { sndClick(); setPhase("ordering"); }, { size: 18 });
}

function isInsidePreview(x: number, y: number): boolean {
  itemPath(itemById(design.item), PREVIEW.cx, PREVIEW.cy, PREVIEW.size);
  return ctx.isPointInPath(x, y);
}

function drawSew() {
  drawWorkbench();
  orderLine();
  drawHud();
  const sewing = { ...design };
  drawItem(sewing, SEW.cx, SEW.cy, SEW.size, "none");
  // Thread stitches
  const thread = isLight(design.color) ? "#d0477f" : "#fff";
  ctx.strokeStyle = thread;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  for (let i = 0; i < sewn; i++) {
    const d = dots[i]!;
    if (i === 0) ctx.moveTo(d[0], d[1]);
    else ctx.lineTo(d[0], d[1]);
  }
  if (phase === "sewn") ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // Dots
  if (phase === "sew") {
    dots.forEach((d, i) => {
      if (i < sewn) return;
      const next = i === sewn;
      const pulse = next ? 1 + Math.sin(time * 8) * 0.25 : 1;
      ctx.fillStyle = next ? "#ff3d8a" : "rgba(255,255,255,0.9)";
      ctx.strokeStyle = next ? "#fff" : "#d0477f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(d[0], d[1], (next ? 12 : 7) * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    text("Sew along the dots! Click or drag to the pink one 🪡", 480, 92, 19, "#c22f6c");
    // Progress
    ctx.fillStyle = "#fff";
    rrect(330, 548, 300, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#ff6aa5";
    rrect(330, 548, Math.max(26, (300 * sewn) / dots.length), 26, 13);
    ctx.fill();
    text(`${sewn} / ${dots.length} stitches`, 480, 562, 15, "#7a2f5a");
    button("⬅️ Change it", 16, 530, 150, 50, () => { sndClick(); setPhase("design"); }, { size: 18 });
    // Needle cursor
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#c8ccd6";
    ctx.strokeStyle = "#7b8090";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, 10);
    ctx.lineTo(3, 50);
    ctx.lineTo(-3, 50);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = thread === "#fff" ? "#ff6aa5" : thread;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.quadraticCurveTo(20, 60, 6, 80);
    ctx.stroke();
    ctx.restore();
  } else {
    text("✨ All sewn! ✨", 480, 92, 30, "#c22f6c");
    button(`🎁 Give it to ${customer.name}`, 330, 524, 300, 60, () => { giveItem(); }, { main: true, size: 22 });
  }
}

function drawEffects(dt: number) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i]!;
    c.t += dt;
    c.vy += 900 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    ctx.fillStyle = c.color;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.t * 8);
    ctx.fillRect(-5, -3, 10, 6);
    ctx.restore();
    if (c.y > H + 20) confetti.splice(i, 1);
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]!;
    p.t += dt;
    ctx.globalAlpha = Math.max(0, 1 - p.t / 1.6);
    text(p.s, p.x, p.y - p.t * 60, 36, p.color);
    ctx.globalAlpha = 1;
    if (p.t > 1.6) pops.splice(i, 1);
  }
}

// ---------- Loop + input ----------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  phaseTime += dt;
  updateCars(dt);
  buttons = [];
  ctx.save();
  if (shakeT > 0) {
    shakeT -= dt;
    ctx.translate((Math.random() - 0.5) * 30 * shakeT, (Math.random() - 0.5) * 30 * shakeT);
  }
  if (phase === "design") drawDesign();
  else if (phase === "sew" || phase === "sewn") drawSew();
  else drawShop(dt);
  drawEffects(dt);
  ctx.restore();
  if (flashT > 0) {
    flashT -= dt;
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, flashT * 4)})`;
    ctx.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

function toCanvas(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e);
  mouse.x = p.x;
  mouse.y = p.y;
  mouse.down = true;
  canvas.setPointerCapture(e.pointerId);
  if (mallet) return;
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i]!;
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
      b.onClick();
      return;
    }
  }
  if (phase === "design" && stickerTool && isInsidePreview(p.x, p.y)) {
    if (design.stickers.length < 15) {
      design.stickers.push({ kind: stickerTool, x: (p.x - PREVIEW.cx) / PREVIEW.size, y: (p.y - PREVIEW.cy) / PREVIEW.size });
      beep(990, 0.08, "triangle");
    }
  } else if (phase === "sew") {
    tryStitch(p.x, p.y);
  } else if (phase !== "title" && phase !== "design" && phase !== "sewn" && isFloor(p.x, p.y)) {
    touchFloor(p.x, p.y);
  } else if (phase === "ordering" && p.x > 720 && p.y > 270 && p.y < 480) {
    // Clicking the sewing machine starts sewing too.
    buttons.find((b) => b.x === 700)?.onClick();
  }
});
canvas.addEventListener("pointermove", (e) => {
  const p = toCanvas(e);
  mouse.x = p.x;
  mouse.y = p.y;
  if (mouse.down) tryStitch(p.x, p.y);
});
canvas.addEventListener("pointerup", () => { mouse.down = false; });
canvas.addEventListener("pointerleave", () => { mouse.x = -100; mouse.y = -100; });

void (async () => {
  await restoreSaveFile(SAVE_KEY, SAVE_KEY);
  save = loadSave();
  keepSaveFile(SAVE_KEY, SAVE_KEY);
  requestAnimationFrame(frame);
})();
