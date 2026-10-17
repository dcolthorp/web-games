// The Engineer job (city.ts): dig pieces of junk out of the dump, then drag
// the right ones onto the blueprint. Build the whole thing and you get paid
// a million dollars. It's harder than taping boxes: some junk is useless,
// and your bag only holds eight things, so toss what you don't need.

import { save, state } from "./state";

export const BUILD_PAY = 1_000_000;
/** Digging in the dump has a 1 in 100 chance of turning up the purple key (once). */
const PURPLE_KEY_CHANCE = 0.01;

type Kind = "gear" | "wheel" | "spring" | "pipe" | "bolt" | "screen" | "battery" | "sock" | "peel" | "can";

const USEFUL: Kind[] = ["gear", "wheel", "spring", "pipe", "bolt", "screen", "battery"];
const USELESS: Kind[] = ["sock", "peel", "can"];
const NAMES: Record<Kind, string> = {
  gear: "gear",
  wheel: "wheel",
  spring: "spring",
  pipe: "pipe",
  bolt: "bolt",
  screen: "screen",
  battery: "battery",
  sock: "old sock",
  peel: "banana peel",
  can: "squished can",
};

// Only brand new inventions: nothing you can already get somewhere else in
// the game (so no robots or rockets).
const BLUEPRINTS: { name: string; needs: Kind[] }[] = [
  { name: "Go-Kart", needs: ["wheel", "wheel", "pipe", "battery", "bolt", "gear"] },
  { name: "Toaster", needs: ["screen", "spring", "spring", "battery", "bolt", "pipe"] },
  { name: "Robot Dog", needs: ["wheel", "spring", "gear", "screen", "battery", "pipe"] },
  { name: "Jetpack", needs: ["pipe", "pipe", "battery", "battery", "bolt", "spring"] },
  { name: "Hoverboard", needs: ["battery", "gear", "gear", "screen", "bolt", "spring"] },
  { name: "Bubble Machine", needs: ["pipe", "gear", "spring", "battery", "screen", "wheel"] },
];

const BAG_SIZE = 8;
const PILE = { x: 150, y: 250, r: 110 };
const TRASH = { x: 60, y: 385, w: 70, h: 80 };
const SLOT = 92;

interface Slot {
  kind: Kind;
  x: number;
  y: number;
  filled: boolean;
}

let plan = BLUEPRINTS[0]!;
let slots: Slot[] = [];
let bag: Kind[] = [];
let dragging: { index: number; x: number; y: number } | null = null;
let doneAt: number | null = null;
let pops: { x: number; y: number; text: string; at: number }[] = [];

export function newBuild(): void {
  let next = plan;
  while (next === plan) next = BLUEPRINTS[Math.floor(Math.random() * BLUEPRINTS.length)]!;
  plan = next;
  slots = plan.needs.map((kind, i) => ({ kind, x: 430 + (i % 3) * 130, y: 95 + Math.floor(i / 3) * 115, filled: false }));
  bag = [];
  dragging = null;
  doneAt = null;
}

newBuild();

export const buildDone = (): boolean => doneAt !== null;
export const planName = (): string => plan.name;

const bagSpot = (i: number): { x: number; y: number } => ({ x: 360 + i * 66, y: 385 });

/**
 * Pressing down: dig in the pile, or pick up a piece from your bag. Returns
 * something to say, if anything, and whether you dug up the purple key.
 */
export function engineerDown(x: number, y: number, now: number): { say: string; purpleKey?: boolean } | null {
  if (doneAt !== null) return null;
  if (Math.hypot(x - PILE.x, y - PILE.y) < PILE.r) {
    if (!state.purpleKey && Math.random() < PURPLE_KEY_CHANCE) {
      state.purpleKey = true;
      save();
      pops.push({ x, y: y - 20, text: "+ PURPLE KEY!!!", at: now });
      return { say: "WHOA! You found a PURPLE KEY buried in the junk! What could it open...? (It's on your shelf.)", purpleKey: true };
    }
    if (bag.length >= BAG_SIZE) return { say: "Your bag is full! Drag junk you don't need into the trash." };
    // Mostly useful pieces, sometimes just junk.
    const kind = Math.random() < 0.22 ? USELESS[Math.floor(Math.random() * USELESS.length)]! : USEFUL[Math.floor(Math.random() * USEFUL.length)]!;
    bag.push(kind);
    pops.push({ x, y: y - 20, text: `+ ${NAMES[kind]}`, at: now });
    return { say: USELESS.includes(kind) ? `You found... a ${NAMES[kind]}. That's useless!` : `You found a ${NAMES[kind]}!` };
  }
  const i = bag.findIndex((_, k) => Math.abs(x - bagSpot(k).x) < 30 && Math.abs(y - bagSpot(k).y) < 30);
  if (i >= 0) dragging = { index: i, x, y };
  return null;
}

export function engineerMove(x: number, y: number): void {
  if (!dragging) return;
  dragging.x = x;
  dragging.y = y;
}

/** Letting go of a piece: onto a blueprint spot, into the trash, or back in the bag. */
export function engineerUp(x: number, y: number, now: number): { say?: string; placed?: boolean; finished?: boolean } {
  if (!dragging) return {};
  const kind = bag[dragging.index]!;
  const index = dragging.index;
  dragging = null;
  if (x > TRASH.x - TRASH.w / 2 && x < TRASH.x + TRASH.w / 2 && y > TRASH.y - TRASH.h / 2 && y < TRASH.y + TRASH.h / 2) {
    bag.splice(index, 1);
    return { say: `You threw away the ${NAMES[kind]}.` };
  }
  const slot = slots.find((s) => !s.filled && Math.abs(x - s.x) < SLOT / 2 && Math.abs(y - s.y) < SLOT / 2);
  if (!slot) return {};
  if (slot.kind !== kind) return { say: `That spot needs a ${NAMES[slot.kind]}, not a ${NAMES[kind]}.` };
  slot.filled = true;
  bag.splice(index, 1);
  if (slots.every((s) => s.filled)) {
    doneAt = now;
    return { placed: true, finished: true };
  }
  return { placed: true, say: `The ${NAMES[kind]} fits! ${slots.filter((s) => !s.filled).length} more to go.` };
}

export function drawEngineer(ctx: CanvasRenderingContext2D, now: number): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  // The dump on the left.
  ctx.fillStyle = "#c8c0b0";
  ctx.fillRect(0, 0, 310, H);
  ctx.fillStyle = "#8a7a6a";
  ctx.beginPath();
  ctx.ellipse(PILE.x, PILE.y + 50, PILE.r + 20, PILE.r, 0, Math.PI, 0);
  ctx.fill();
  const junk: Kind[] = ["can", "gear", "wheel", "pipe", "sock", "spring", "bolt", "peel", "screen", "battery"];
  junk.forEach((k, i) => {
    const a = Math.PI + (i / (junk.length - 1)) * Math.PI;
    const r = 40 + (i % 3) * 25;
    drawPiece(ctx, k, PILE.x + Math.cos(a) * r, PILE.y + 40 + Math.sin(a) * r * 0.8, 22);
  });
  label(ctx, "THE DUMP", PILE.x, 28, 18);
  label(ctx, "Click the pile to dig!", PILE.x, 54, 13);

  // The trash can.
  ctx.fillStyle = "#7d8794";
  ctx.fillRect(TRASH.x - 28, TRASH.y - 30, 56, 66);
  ctx.fillStyle = "#5d626c";
  ctx.fillRect(TRASH.x - 34, TRASH.y - 38, 68, 10);
  label(ctx, "TRASH", TRASH.x, TRASH.y + 4, 12, "#ffffff");

  // The blueprint.
  ctx.fillStyle = "#2a5aa8";
  ctx.fillRect(320, 0, W - 320, 320);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1;
  for (let x = 320; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 320);
    ctx.stroke();
  }
  for (let y = 0; y < 320; y += 30) {
    ctx.beginPath();
    ctx.moveTo(320, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  label(ctx, `BLUEPRINT: ${plan.name.toUpperCase()}`, 610, 26, 20, "#ffffff");
  for (const s of slots) {
    ctx.strokeStyle = s.filled ? "#ffe36e" : "#ffffff";
    ctx.lineWidth = 3;
    ctx.setLineDash(s.filled ? [] : [8, 6]);
    ctx.strokeRect(s.x - SLOT / 2, s.y - SLOT / 2, SLOT, SLOT);
    ctx.setLineDash([]);
    ctx.globalAlpha = s.filled ? 1 : 0.3;
    drawPiece(ctx, s.kind, s.x, s.y - 6, 30);
    ctx.globalAlpha = 1;
    label(ctx, NAMES[s.kind], s.x, s.y + 36, 12, "#ffffff");
  }

  // Your bag.
  ctx.fillStyle = "#e8d8c0";
  ctx.fillRect(320, 330, W - 320, H - 330);
  label(ctx, `Your bag (${bag.length}/${BAG_SIZE}): drag pieces onto the blueprint`, 610, 348, 13);
  bag.forEach((k, i) => {
    if (dragging?.index === i) return;
    const p = bagSpot(i);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(p.x - 30, p.y - 22, 60, 64);
    drawPiece(ctx, k, p.x, p.y + 2, 20);
    label(ctx, NAMES[k], p.x, p.y + 33, 10);
  });
  if (dragging) drawPiece(ctx, bag[dragging.index]!, dragging.x, dragging.y, 30);

  pops = pops.filter((p) => now - p.at < 900);
  for (const p of pops) {
    ctx.globalAlpha = 1 - (now - p.at) / 900;
    label(ctx, p.text, p.x, p.y - (now - p.at) / 20, 16, "#2e7a3a");
  }
  ctx.globalAlpha = 1;

  if (doneAt !== null) {
    // Built it! It wobbles with pride.
    const k = Math.min(1, (now - doneAt) / 500);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * k})`;
    ctx.fillRect(320, 0, W - 320, 320);
    ctx.save();
    ctx.translate(610, 150);
    ctx.rotate(Math.sin(now / 200) * 0.08);
    label(ctx, `You built a ${plan.name}!`, 0, -20, 34, "#7a2fc0");
    label(ctx, "+ $1,000,000", 0, 30, 30, "#2e9e4f");
    ctx.restore();
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = "#4a1f6e"): void {
  ctx.font = `800 ${size}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

/** A little picture of a piece of junk, about `s` pixels big. */
function drawPiece(ctx: CanvasRenderingContext2D, kind: Kind, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(2, s / 8);
  if (kind === "gear") {
    ctx.fillStyle = "#a9adb5";
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? s * 0.62 : s * 0.85;
      const a = (i / 16) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#5d626c";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "wheel") {
    ctx.fillStyle = "#2b2b33";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9ced6";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "spring") {
    ctx.strokeStyle = "#c9ced6";
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo((i % 2 ? 1 : -1) * s * 0.4, -s * 0.8 + (i / 8) * s * 1.6);
    ctx.stroke();
  } else if (kind === "pipe") {
    ctx.fillStyle = "#7d8794";
    ctx.fillRect(-s * 0.9, -s * 0.25, s * 1.8, s * 0.5);
    ctx.fillStyle = "#5d626c";
    ctx.fillRect(-s * 0.95, -s * 0.32, s * 0.25, s * 0.64);
    ctx.fillRect(s * 0.7, -s * 0.32, s * 0.25, s * 0.64);
  } else if (kind === "bolt") {
    ctx.fillStyle = "#b9a46a";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * s * 0.45, -s * 0.4 + Math.sin(a) * s * 0.3);
    }
    ctx.fill();
    ctx.fillRect(-s * 0.15, -s * 0.2, s * 0.3, s);
  } else if (kind === "screen") {
    ctx.fillStyle = "#2b2b33";
    ctx.fillRect(-s * 0.85, -s * 0.6, s * 1.7, s * 1.2);
    ctx.fillStyle = "#7fc8ff";
    ctx.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9);
  } else if (kind === "battery") {
    ctx.fillStyle = "#4cc76a";
    ctx.fillRect(-s * 0.4, -s * 0.7, s * 0.8, s * 1.4);
    ctx.fillStyle = "#2b2b33";
    ctx.fillRect(-s * 0.15, -s * 0.85, s * 0.3, s * 0.15);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${s * 0.8}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("+", 0, 0);
  } else if (kind === "sock") {
    ctx.fillStyle = "#f4f1ee";
    ctx.fillRect(-s * 0.3, -s * 0.8, s * 0.5, s * 1.1);
    ctx.beginPath();
    ctx.ellipse(s * 0.1, s * 0.35, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8383d";
    ctx.fillRect(-s * 0.3, -s * 0.8, s * 0.5, s * 0.2);
  } else if (kind === "peel") {
    ctx.fillStyle = "#ffe36e";
    for (const a of [-0.7, 0, 0.7]) {
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.35, s * 0.18, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // A squished soda can: silver ends, a red label, crumpled in the middle.
    ctx.rotate(0.3);
    ctx.fillStyle = "#c9ced6";
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.75);
    ctx.lineTo(s * 0.35, -s * 0.75);
    ctx.lineTo(s * 0.15, -s * 0.05);
    ctx.lineTo(s * 0.4, s * 0.75);
    ctx.lineTo(-s * 0.4, s * 0.75);
    ctx.lineTo(-s * 0.15, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8383d";
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.5);
    ctx.lineTo(s * 0.28, -s * 0.5);
    ctx.lineTo(s * 0.17, -s * 0.05);
    ctx.lineTo(s * 0.32, s * 0.5);
    ctx.lineTo(-s * 0.32, s * 0.5);
    ctx.lineTo(-s * 0.17, s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-s * 0.2, -s * 0.3, s * 0.35, s * 0.1);
  }
  ctx.restore();
}
