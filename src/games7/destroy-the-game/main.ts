// Destroy the Game (Oscar, 2026-11-20). Games 7.
//
// Even the title card is wrecked: something smashed into its bottom-right
// corner. The corner is snapped off, cracks spider out from where it hit, and
// the broken pieces are lying on the floor under it.
//
// Click the title card to start the game (game.ts).

import { showMenu } from "./menu";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

type Pt = { x: number; y: number };

interface Shard {
  pts: Pt[]; // shape, relative to its center
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  resting: boolean;
}

interface Layout {
  w: number;
  h: number;
  card: { x: number; y: number; w: number; h: number };
  impact: Pt;
  outline: Pt[]; // the card with its corner broken off
  breakLine: Pt[]; // the jagged edge where the corner snapped
  cracks: Pt[][];
  floor: number;
}

const SMASH_AT = 0.7; // seconds of a whole card before it gets hit
const GRAVITY = 2200;

let layout: Layout;
let shards: Shard[] = [];
let smashed = false;
let startTime = performance.now();
let shake = 0;
let flash = 0;
let nudge = 0; // shakes the card when you click it
let message = "";
let messageUntil = 0;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function buildLayout(): Layout {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cw = Math.min(w * 0.84, 820);
  const ch = Math.min(cw * 0.56, h * 0.62);
  const card = { x: (w - cw) / 2, y: (h - ch) / 2 - h * 0.04, w: cw, h: ch };
  const r = rng(777);

  // Where it hit: just inside the bottom-right corner.
  const impact = { x: card.x + cw * 0.9, y: card.y + ch * 0.84 };

  // The jagged edge, from the right side down and around to the bottom.
  const a = { x: card.x + cw, y: card.y + ch * 0.56 };
  const b = { x: card.x + cw * 0.7, y: card.y + ch };
  const breakLine: Pt[] = [a];
  const steps = 9;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Bow the break inward past the impact point so the hole looks punched.
    const along = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const toImpact = { x: impact.x - along.x, y: impact.y - along.y };
    const bow = Math.sin(t * Math.PI) * 0.55;
    const jag = (r() - 0.5) * cw * 0.05;
    breakLine.push({
      x: along.x + toImpact.x * bow + jag,
      y: along.y + toImpact.y * bow + (r() - 0.5) * ch * 0.06,
    });
  }
  breakLine.push(b);

  const outline: Pt[] = [
    { x: card.x, y: card.y },
    { x: card.x + cw, y: card.y },
    ...breakLine,
    { x: card.x, y: card.y + ch },
  ];

  // Cracks spread out from the impact, mostly up and to the left into the card.
  const cracks: Pt[][] = [];
  const reach = Math.hypot(cw, ch);
  const rays = 13;
  for (let i = 0; i < rays; i++) {
    let angle = Math.PI * 0.95 + (i / (rays - 1)) * Math.PI * 0.75 + (r() - 0.5) * 0.18;
    const len = reach * (0.18 + r() * (i % 3 === 0 ? 0.55 : 0.3));
    const pts: Pt[] = [{ ...impact }];
    let d = 0;
    while (d < len) {
      d += 14 + r() * 34;
      angle += (r() - 0.5) * 0.4;
      pts.push({ x: impact.x + Math.cos(angle) * d, y: impact.y + Math.sin(angle) * d });
    }
    cracks.push(pts);
  }
  // Rings joining neighbouring rays, like a spider web.
  for (const ring of [1, 2, 4]) {
    for (let i = 0; i < cracks.length - 1; i++) {
      const p = cracks[i]?.[ring];
      const q = cracks[i + 1]?.[ring];
      if (p && q && r() > 0.25) cracks.push([p, { x: (p.x + q.x) / 2 + (r() - 0.5) * 10, y: (p.y + q.y) / 2 + (r() - 0.5) * 10 }, q]);
    }
  }

  return { w, h, card, impact, outline, breakLine, cracks, floor: h - 18 };
}

// Break the snapped-off corner into shards that fly out and fall.
function makeShards(): Shard[] {
  const { card, breakLine, impact } = layout;
  const r = rng(4242);
  const corner = { x: card.x + card.w, y: card.y + card.h };
  const out: Shard[] = [];
  // Fan of triangles from the corner across the broken edge, each one split again.
  for (let i = 0; i < breakLine.length - 1; i++) {
    const p = breakLine[i]!;
    const q = breakLine[i + 1]!;
    const mid = { x: (p.x + q.x + corner.x) / 3 + (r() - 0.5) * 8, y: (p.y + q.y + corner.y) / 3 + (r() - 0.5) * 8 };
    for (const tri of [
      [p, q, mid],
      [q, corner, mid],
      [corner, p, mid],
    ]) {
      const cx = (tri[0]!.x + tri[1]!.x + tri[2]!.x) / 3;
      const cy = (tri[0]!.y + tri[1]!.y + tri[2]!.y) / 3;
      const away = Math.atan2(cy - impact.y, cx - impact.x);
      const speed = 250 + r() * 500;
      out.push({
        pts: tri.map((t) => ({ x: t.x - cx, y: t.y - cy })),
        x: cx,
        y: cy,
        vx: Math.cos(away) * speed + (r() - 0.3) * 200,
        vy: Math.sin(away) * speed - 300 - r() * 300,
        angle: 0,
        spin: (r() - 0.5) * 14,
        resting: false,
      });
    }
  }
  return out;
}

function stepShards(dt: number): void {
  const { floor, w } = layout;
  for (const s of shards) {
    if (s.resting) continue;
    s.vy += GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    if (s.x < 10 || s.x > w - 10) {
      s.vx *= -0.5;
      s.x = Math.max(10, Math.min(w - 10, s.x));
    }
    if (s.y >= floor) {
      s.y = floor;
      if (Math.abs(s.vy) < 140) {
        s.resting = true;
        // Lie flat-ish on the floor.
        s.angle = Math.round(s.angle / Math.PI) * Math.PI + (s.angle % 0.3);
      } else {
        s.vy *= -0.32;
        s.vx *= 0.6;
        s.spin *= 0.5;
      }
    }
  }
}

function smash(): void {
  smashed = true;
  shards = makeShards();
  shake = 1;
  flash = 1;
}

function path(pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

function cardFill(): CanvasGradient {
  const { card } = layout;
  const g = ctx.createLinearGradient(card.x, card.y, card.x + card.w, card.y + card.h);
  g.addColorStop(0, "#ffd23f");
  g.addColorStop(0.55, "#ff9f43");
  g.addColorStop(1, "#ff5c5c");
  return g;
}

function drawCardFace(): void {
  const { card } = layout;
  ctx.fillStyle = cardFill();
  ctx.fillRect(card.x, card.y, card.w, card.h);

  // Hazard stripes along the top.
  const band = card.h * 0.09;
  ctx.save();
  ctx.beginPath();
  ctx.rect(card.x, card.y, card.w, band);
  ctx.clip();
  ctx.fillStyle = "#1b1116";
  ctx.fillRect(card.x, card.y, card.w, band);
  ctx.fillStyle = "#ffd23f";
  for (let x = card.x - band; x < card.x + card.w + band; x += band * 1.4) {
    ctx.beginPath();
    ctx.moveTo(x, card.y + band);
    ctx.lineTo(x + band * 0.7, card.y + band);
    ctx.lineTo(x + band * 1.4, card.y);
    ctx.lineTo(x + band * 0.7, card.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Title.
  const size = Math.min(card.w * 0.15, card.h * 0.3);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size}px Bungee, Impact, sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = "#1b1116";
  ctx.fillStyle = "#fff6e5";
  const cx = card.x + card.w / 2;
  const lines: [string, number][] = [
    ["DESTROY", card.y + card.h * 0.36],
    ["THE GAME", card.y + card.h * 0.66],
  ];
  for (const [text, y] of lines) {
    ctx.fillStyle = "#1b1116";
    ctx.fillText(text, cx + size * 0.06, y + size * 0.08);
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = "#fff6e5";
    ctx.fillText(text, cx, y);
  }
}

function drawCard(t: number): void {
  const { card, outline, cracks, impact, breakLine } = layout;

  // Shadow.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.translate(10, 14);
  smashed ? path(outline) : ctx.rect(card.x, card.y, card.w, card.h);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (smashed) {
    path(outline);
  } else {
    ctx.beginPath();
    ctx.rect(card.x, card.y, card.w, card.h);
  }
  ctx.clip();
  drawCardFace();

  if (smashed) {
    // Dent: the card is pushed in and darker around where it hit.
    const dent = ctx.createRadialGradient(impact.x, impact.y, 0, impact.x, impact.y, card.w * 0.32);
    dent.addColorStop(0, "rgba(40,10,10,0.55)");
    dent.addColorStop(1, "rgba(40,10,10,0)");
    ctx.fillStyle = dent;
    ctx.fillRect(card.x, card.y, card.w, card.h);

    // Cracks: a dark line with a light edge so they look cut into the card.
    const grow = Math.min(1, (t - SMASH_AT) / 0.25);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const crack of cracks) {
      const n = Math.max(2, Math.ceil(crack.length * grow));
      const pts = crack.slice(0, n);
      for (const [color, width, dx] of [
        ["rgba(255,255,255,0.55)", 1.5, 1.2],
        ["#1b1116", 2.2, 0],
      ] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + dx, p.y + dx) : ctx.lineTo(p.x + dx, p.y + dx)));
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Outline of the card, and a raw torn edge where the corner broke off.
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#1b1116";
  ctx.lineJoin = "miter";
  if (smashed) {
    path(outline);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffe7b0";
    ctx.beginPath();
    breakLine.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x - 3, p.y - 3) : ctx.lineTo(p.x - 3, p.y - 3)));
    ctx.stroke();
  } else {
    ctx.strokeRect(card.x, card.y, card.w, card.h);
  }
}

function drawShards(): void {
  const { card } = layout;
  for (const s of shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    path(s.pts);
    ctx.save();
    ctx.clip();
    // Paint the bit of card face this shard came from, rotated with it.
    ctx.rotate(0);
    ctx.fillStyle = "#ff7b4f";
    ctx.fillRect(-card.w, -card.h, card.w * 2, card.h * 2);
    ctx.restore();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#1b1116";
    ctx.stroke();
    ctx.restore();
  }
}

function drawPrompt(now: number, t: number): void {
  const { w, card } = layout;
  if (!smashed || t < SMASH_AT + 1) return;
  const y = card.y + card.h + Math.min(70, layout.h * 0.09);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(16, Math.min(26, w * 0.04))}px Bungee, Impact, sans-serif`;
  if (now < messageUntil) {
    ctx.fillStyle = "#ffd23f";
    ctx.fillText(message, w / 2, y);
  } else if (Math.floor(now / 550) % 2 === 0) {
    ctx.fillStyle = "#fff6e5";
    ctx.fillText("CLICK TO START", w / 2, y);
  }
}

let last = performance.now();
function frame(now: number): void {
  if (!onTitle) return;
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  const t = (now - startTime) / 1000;
  if (!smashed && t >= SMASH_AT) smash();
  stepShards(dt);
  shake = Math.max(0, shake - dt * 2.5);
  flash = Math.max(0, flash - dt * 4);
  nudge = Math.max(0, nudge - dt * 3);

  const { w, h } = layout;
  ctx.fillStyle = "#120c10";
  ctx.fillRect(0, 0, w, h);
  // Floor.
  ctx.fillStyle = "#1f141b";
  ctx.fillRect(0, layout.floor, w, h - layout.floor);

  ctx.save();
  const s = shake * 18 + nudge * 8;
  ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  drawCard(t);
  ctx.restore();
  drawShards();
  drawPrompt(now, t);

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`;
    ctx.fillRect(0, 0, w, h);
  }
  requestAnimationFrame(frame);
}

let onTitle = true;
function leaveTitle(): void {
  if (!onTitle || !smashed) return;
  onTitle = false;
  showMenu(canvas);
}
canvas.addEventListener("click", leaveTitle);
window.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") leaveTitle();
});

window.addEventListener("resize", () => {
  if (!onTitle) return;
  layout = buildLayout();
  if (smashed) {
    // Rebuild the pieces for the new size and drop them straight onto the floor.
    shards = makeShards();
    for (let i = 0; i < 400; i++) stepShards(1 / 60);
  }
});

layout = buildLayout();
startTime = performance.now();
document.fonts?.ready.then(() => {
  startTime = performance.now();
});
requestAnimationFrame(frame);
