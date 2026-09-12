import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import {
  CELL,
  COLS,
  H,
  KINDS,
  LAND_LEVEL,
  ROWS,
  TSUNAMI_MS,
  W,
  isLand,
  makeHeights,
  tsunamiRadius,
  waveReaches,
  type Kind,
  type Thing,
} from "./world";

installOofShortcut();
installForceRefreshHotkey();

// You look down on your world from space and click to add things to it. The
// world and everything on it is saved, so it's still there next time.

type Tool = Kind | "tsunami";

interface Wave {
  x: number;
  y: number;
  born: number;
}

const TOOLS: { tool: Tool; label: string; icon: string; hint: string }[] = [
  { tool: "tree", label: "Tree", icon: "🌳", hint: "Click the land to plant a tree." },
  { tool: "hill", label: "Hill", icon: "⛰️", hint: "Click the land to make a hill." },
  { tool: "mountain", label: "Mountain", icon: "🏔️", hint: "Click the land to push up a mountain." },
  { tool: "volcano", label: "Volcano", icon: "🌋", hint: "Click the land to start a volcano." },
  {
    tool: "tsunami",
    label: "Tsunami",
    icon: "🌊",
    hint: "Click the water to send out a tsunami. It washes away trees and animals near the shore.",
  },
  { tool: "life", label: "Life", icon: "🐾", hint: "Click anywhere to spawn life. Animals on land, sea creatures in the water." },
];

const LAND_LIFE = ["🐑", "🐄", "🐇", "🦊", "🐘", "🦒", "🐖", "🦌"];
const SEA_LIFE = ["🐟", "🐙", "🐳", "🐢", "🦀", "🐬"];
const SAVE_KEY = "world-sandbox-world";
const NOTE_MS = 2600;

const canvas = document.getElementById("world") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const toolbarSlots = document.getElementById("toolbar-slots") as HTMLDivElement;
const newWorldButton = document.getElementById("new-world") as HTMLButtonElement;
const statusLine = document.getElementById("status") as HTMLParagraphElement;

let { seed, things } = loadWorld();
let heights = makeHeights(seed);
let terrain = drawTerrain(heights);
let waves: Wave[] = [];
let tool: Tool = "tree";
let note = "";
let noteAt = -Infinity;

// ---------- saving ----------

function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function isThing(value: unknown): value is Thing {
  const t = value as Partial<Thing> | null;
  return !!t && KINDS.includes(t.kind as Kind) && Number.isFinite(t.x) && Number.isFinite(t.y);
}

function loadWorld(): { seed: number; things: Thing[] } {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as { seed?: unknown; things?: unknown } | null;
    if (saved && Number.isFinite(saved.seed) && Array.isArray(saved.things)) {
      return { seed: saved.seed as number, things: saved.things.filter(isThing) };
    }
  } catch {
    // Nothing saved, or it got scrambled. Start a fresh world.
  }
  return { seed: newSeed(), things: [] };
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ seed, things }));
  } catch {
    // Can't save, so this world only lasts until the page closes.
  }
}

window.addEventListener("pagehide", save);

function say(text: string): void {
  note = text;
  noteAt = performance.now();
}

// ---------- tools ----------

toolbarSlots.innerHTML = TOOLS.map(
  (t) =>
    `<button class="tool-slot" type="button" data-tool="${t.tool}" aria-pressed="${t.tool === tool}"><span class="tool-icon" aria-hidden="true">${t.icon}</span>${t.label}</button>`,
).join("");

toolbarSlots.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-tool]");
  if (!button) return;
  tool = button.dataset["tool"] as Tool;
  for (const slot of toolbarSlots.querySelectorAll("[data-tool]")) slot.setAttribute("aria-pressed", String(slot === button));
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * W) / rect.width;
  const y = ((event.clientY - rect.top) * H) / rect.height;
  const land = isLand(heights, x, y);

  if (tool === "tsunami") {
    if (land) say("Tsunamis can only go in water.");
    else waves.push({ x, y, born: performance.now() });
    return;
  }
  if (tool === "life") {
    const kinds = land ? LAND_LIFE : SEA_LIFE;
    things.push({ kind: "life", x, y, emoji: kinds[Math.floor(Math.random() * kinds.length)] });
  } else if (land) {
    things.push({ kind: tool, x, y });
  } else {
    say("That has to go on land.");
    return;
  }
  save();
});

newWorldButton.addEventListener("click", () => {
  if (things.length > 0 && !window.confirm("Make a new world? Everything on this one will be gone.")) return;
  seed = newSeed();
  heights = makeHeights(seed);
  terrain = drawTerrain(heights);
  things = [];
  waves = [];
  save();
});

// ---------- what happens on its own ----------

// Life wanders around. Land animals stay on land and sea creatures stay in the water.
function wander(t: Thing): void {
  const inSea = !isLand(heights, t.x, t.y);
  t.heading ??= Math.random() * Math.PI * 2;
  if (Math.random() < 0.02) t.heading += (Math.random() - 0.5) * 2;
  const nx = t.x + Math.cos(t.heading) * 0.35;
  const ny = t.y + Math.sin(t.heading) * 0.35;
  if (nx < 8 || ny < 8 || nx > W - 8 || ny > H - 8 || isLand(heights, nx, ny) === inSea) {
    t.heading += Math.PI;
    return;
  }
  t.x = nx;
  t.y = ny;
}

// Trees and land animals the wave rolls over get washed away. Hills, mountains,
// volcanoes, and sea creatures stay put.
function washAway(wave: Wave, now: number): void {
  const r = tsunamiRadius(now - wave.born);
  const before = things.length;
  things = things.filter((t) => {
    const washable = t.kind === "tree" || (t.kind === "life" && isLand(heights, t.x, t.y));
    if (!washable) return true;
    const d = Math.hypot(t.x - wave.x, t.y - wave.y);
    return !(d <= r && d > r - 12 && waveReaches(heights, wave.x, wave.y, t.x, t.y));
  });
  if (things.length === before) return;
  say("The tsunami washed things away!");
  save();
}

// ---------- drawing ----------

// The land and sea never change until you make a new world, so draw them once.
function drawTerrain(heights: Float32Array): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  const g = layer.getContext("2d") as CanvasRenderingContext2D;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const h = heights[row * COLS + col] ?? 0;
      g.fillStyle =
        h > 1.6 ? "#3f8f3c" : h > 0.62 ? "#4fbf5a" : h > LAND_LEVEL ? "#e9d48f" : h > 0.3 ? "#3b8fd9" : "#1d5fb8";
      g.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
  return layer;
}

function circle(x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// (x, y) is where it sits on the ground.
function drawThing(t: Thing, now: number): void {
  const { x, y } = t;
  if (t.kind === "tree") {
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(x - 1.5, y - 5, 3, 6);
    ctx.fillStyle = "#1f6b2a";
    circle(x, y - 9, 6);
  } else if (t.kind === "hill") {
    ctx.fillStyle = "#7ccf6a";
    ctx.strokeStyle = "#3f8f3c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 16, 10, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (t.kind === "mountain") {
    ctx.fillStyle = "#8a8f98";
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x, y - 30);
    ctx.lineTo(x + 18, y);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 20);
    ctx.lineTo(x, y - 30);
    ctx.lineTo(x + 6, y - 20);
    ctx.fill();
  } else if (t.kind === "volcano") {
    ctx.fillStyle = "#5a3b22";
    ctx.beginPath();
    ctx.moveTo(x - 20, y);
    ctx.lineTo(x - 5, y - 24);
    ctx.lineTo(x + 5, y - 24);
    ctx.lineTo(x + 20, y);
    ctx.fill();
    const glow = Math.round(110 + 60 * Math.sin(now / 250 + x));
    ctx.fillStyle = `rgb(255, ${glow}, 40)`;
    ctx.beginPath();
    ctx.ellipse(x, y - 24, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Smoke puffs drift up and fade. Each volcano is a little out of step with the others.
    for (let i = 0; i < 3; i += 1) {
      const p = (now / 2400 + i / 3 + x / 97) % 1;
      ctx.fillStyle = `rgba(80, 80, 80, ${0.55 * (1 - p)})`;
      circle(x + Math.sin(p * 6 + i) * 4, y - 30 - p * 30, 4 + p * 8);
    }
  } else {
    ctx.fillText(t.emoji ?? "🐑", x, y);
  }
}

function drawWave(wave: Wave, now: number): void {
  const age = now - wave.born;
  const r = tsunamiRadius(age);
  const steps = Math.max(16, Math.ceil(r / 2));
  ctx.save();
  ctx.globalAlpha = Math.min(1, ((TSUNAMI_MS - age) / TSUNAMI_MS) * 3);
  ctx.lineCap = "round";
  for (let i = 0; i < steps; i += 1) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    // Only draw the parts of the ring the water can actually get to.
    if (!waveReaches(heights, wave.x, wave.y, wave.x + Math.cos(mid) * r, wave.y + Math.sin(mid) * r)) continue;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, r, a0, a1);
    ctx.strokeStyle = "#bfe8ff";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function frame(now: number): void {
  for (const t of things) if (t.kind === "life") wander(t);
  for (const wave of waves) washAway(wave, now);
  waves = waves.filter((wave) => now - wave.born < TSUNAMI_MS);

  ctx.drawImage(terrain, 0, 0);
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Things further down the map are in front.
  for (const t of [...things].sort((a, b) => a.y - b.y)) drawThing(t, now);
  for (const wave of waves) drawWave(wave, now);

  const text = now - noteAt < NOTE_MS ? note : (TOOLS.find((t) => t.tool === tool)?.hint ?? "");
  if (statusLine.textContent !== text) statusLine.textContent = text;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
