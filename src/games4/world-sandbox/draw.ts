import { MATERIALS } from "./caves";
import { CHOICES } from "./catalog";
import { personSprite, villageSprite } from "./folk";
import { maxHp, tribeOf } from "./people";
import { drawSprite, type Sprite } from "./sprites";
import { EFFECT_MS, world, type Effect, type Wave } from "./state";
import { H, LAND_LEVEL, W, tsunamiRadius, waveReaches, type Thing } from "./world";

// Draws the whole world, one pixel at a time: no smooth shapes anywhere.

let ctx: CanvasRenderingContext2D;
const toRgb = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Deep water, shallow water, sand, grass, and high grass.
const GROUND = ["#1d5fb8", "#3b8fd9", "#e9d48f", "#4fbf5a", "#3f8f3c"].map(toRgb);
const terrain = document.createElement("canvas");
terrain.width = W;
terrain.height = H;
let terrainFor: Float32Array | null = null;
let terrainVersion = -1;

// The land and sea are drawn to their own canvas and only redrawn when they change.
function drawTerrain(): void {
  const g = terrain.getContext("2d") as CanvasRenderingContext2D;
  const image = g.createImageData(W, H);
  world.heights.forEach((h, i) => {
    const [r = 0, green = 0, b = 0] = GROUND[h > 1.6 ? 4 : h > 0.62 ? 3 : h > LAND_LEVEL ? 2 : h > 0.3 ? 1 : 0] ?? [];
    image.data[i * 4] = r;
    image.data[i * 4 + 1] = green;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = 255;
  });
  g.putImageData(image, 0, 0);
}

function spriteFor(t: Thing): Sprite | undefined {
  const color = tribeOf(t)?.color;
  if (color && t.type === "person") return personSprite(color);
  if (color && t.type === "village") return villageSprite(color);
  return CHOICES.get(t.type)?.sprite;
}

// Pixel smoke puffs drift up out of a volcano, growing as they go.
function drawSmoke(t: Thing, now: number): void {
  for (let i = 0; i < 3; i += 1) {
    const p = (now / 2400 + i / 3 + t.x / 97) % 1;
    if (p > 0.85) continue;
    const size = 1 + Math.floor(p * 3);
    ctx.fillStyle = p < 0.4 ? "#9aa0a8" : "#5d626b";
    ctx.fillRect(Math.round(t.x + Math.sin(p * 6 + i) * 2 - size / 2), Math.round(t.y - 9 - p * 14), size, size);
  }
}

// A one-pixel bar above anything that's been hurt.
function drawHealth(t: Thing, s: Sprite): void {
  const left = Math.round(t.x - s.width / 2);
  const top = Math.round(t.y) - s.height - 1;
  ctx.fillStyle = "#1b1b1f";
  ctx.fillRect(left, top, s.width, 1);
  ctx.fillStyle = "#86d86e";
  ctx.fillRect(left, top, Math.max(1, Math.round((s.width * (t.hp ?? 0)) / maxHp(t))), 1);
}

// A one-pixel ring of foam, only where the water can actually get to.
function drawWave(wave: Wave, now: number): void {
  const r = tsunamiRadius(now - wave.born);
  const steps = Math.max(12, Math.ceil(r * 7));
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(wave.x + Math.cos(a) * r);
    const y = Math.round(wave.y + Math.sin(a) * r);
    if (!waveReaches(world.heights, wave.x, wave.y, x, y)) continue;
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = "#9fe3ff";
    ctx.fillRect(Math.round(wave.x + Math.cos(a) * (r - 1)), Math.round(wave.y + Math.sin(a) * (r - 1)), 1, 1);
  }
}

function drawEffect(e: Effect, now: number): void {
  const p = (now - e.born) / EFFECT_MS[e.kind];
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  if (e.kind === "trail") {
    ctx.fillStyle = e.color;
    ctx.fillRect(x, y, 1, 1);
  } else if (e.kind === "sparkle") {
    const r = 1 + Math.floor(p * 4);
    ctx.fillStyle = e.color;
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]] as const) ctx.fillRect(x + dx, y - 4 + dy, 1, 1);
  } else {
    // Flickering flames that burn down to nothing.
    const tallest = Math.round(8 * (1 - p));
    for (let i = -2; i <= 2; i += 1) {
      const h = tallest - Math.abs(i) * 2 + (Math.floor(now / 80 + i * 7) % 3);
      if (h <= 0) continue;
      for (const [color, share] of [["#d8362b", 1], ["#ee7a2a", 0.6], ["#f7d23e", 0.3]] as const) {
        const ch = Math.max(1, Math.round(h * share));
        ctx.fillStyle = color;
        ctx.fillRect(x + i, y - ch + 1, 1, ch);
      }
    }
  }
}

// ---------- inside a cave ----------

const SHADES = MATERIALS.map((m) => m.colors.map(toRgb));
const RAINBOW = MATERIALS.findIndex((m) => m.code === "r");
const FLOWING = new Set(["l", "w"].map((code) => MATERIALS.findIndex((m) => m.code === code)));
let caveImage: ImageData | null = null;

// Every pixel keeps its own speckle colour, except the rainbow crystal, whose
// colours ripple across it, and lava and water, which shimmer.
export function drawCave(target: CanvasRenderingContext2D, grid: Uint8Array, now: number): void {
  caveImage ??= target.createImageData(W, H);
  const data = caveImage.data;
  const tick = Math.floor(now / 150);
  for (let i = 0; i < grid.length; i += 1) {
    const material = grid[i] ?? 0;
    const shades = SHADES[material] ?? [[0, 0, 0]];
    const x = i % W;
    const y = (i - x) / W;
    const speckle = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    let k = (speckle ^ (speckle >>> 13)) >>> 0;
    if (material === RAINBOW) k = ((x + y) >> 2) + tick;
    else if (FLOWING.has(material)) k += tick >> 1;
    const [r = 0, g = 0, b = 0] = shades[k % shades.length] ?? [];
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  target.putImageData(caveImage, 0, 0);
}

export function drawWorld(target: CanvasRenderingContext2D, now: number): void {
  ctx = target;
  if (terrainFor !== world.heights || terrainVersion !== world.terrainVersion) {
    drawTerrain();
    terrainFor = world.heights;
    terrainVersion = world.terrainVersion;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(terrain, 0, 0);
  // Things further down the map are in front.
  for (const t of [...world.things].sort((a, b) => a.y - b.y)) {
    const s = spriteFor(t);
    if (!s) continue;
    drawSprite(ctx, s, t.x, t.y, now + t.x * 37, Math.cos(t.heading ?? 0) < 0);
    if (t.type === "volcano") drawSmoke(t, now);
    // A dark doorway at the foot of a mountain with a cave in it.
    if (t.cave !== undefined) {
      ctx.fillStyle = "#1b1b1f";
      ctx.fillRect(Math.round(t.x) - 1, Math.round(t.y) - 2, 3, 3);
    }
    if (t.hp !== undefined && t.hp < maxHp(t)) drawHealth(t, s);
  }
  for (const e of world.effects) drawEffect(e, now);
  for (const wave of world.waves) drawWave(wave, now);
}
