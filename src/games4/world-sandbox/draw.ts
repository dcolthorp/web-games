import { MATERIALS } from "./caves";
import { CHOICES, MAGIC } from "./catalog";
import { bombSprite } from "./bombs";
import { apartmentSprite, personSprite, villageSprite } from "./folk";
import { mutantSprite, techSprite } from "./tech";
import { isBomb } from "./cavern";
import { insideOf } from "./miners";
import { maxHp, tribeOf } from "./people";
import { drawSprite, type Sprite } from "./sprites";
import { EFFECT_MS, world, type Effect, type Wave } from "./state";
import type { Shot } from "./techRules";
import { H, LAND_LEVEL, W, isLand, tsunamiRadius, waveReaches, type Thing } from "./world";

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
  if (color && t.type === "apartment") return apartmentSprite(color);
  if (t.type === "mutant") return mutantSprite(color ?? "#86d86e");
  if (isBomb(t.type)) return bombSprite(t.type);
  // A machine with no tribe is plain grey; one with a tribe is painted in it.
  const tech = techSprite(t.type, color ?? "#c0c4cc");
  if (tech) return tech;
  return CHOICES.get(t.type)?.sprite;
}

// The water closes over a swimmer's legs, and a little white wake goes with
// them wherever they are heading.
function drawRipple(t: Thing, now: number): void {
  const x = Math.round(t.x);
  const y = Math.round(t.y) + 1;
  ctx.fillStyle = "#3b8fd9";
  ctx.fillRect(x - 2, y, 5, 2);
  ctx.fillStyle = "#f4f1ea";
  const wag = Math.floor(now / 200) % 2;
  ctx.fillRect(x - 3 + wag, y - 1, 1, 1);
  ctx.fillRect(x + 2 - wag, y - 1, 1, 1);
}

// A creature that has joined a tribe flies its colours: a little flag on a
// pole over its head, so you can tell whose dragon that is.
function drawBanner(t: Thing, s: Sprite, now: number): void {
  const color = tribeOf(t)?.color;
  if (!color) return;
  const x = Math.round(t.x);
  const top = Math.round(t.y) - s.height - 4;
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(x, top, 1, 5);
  ctx.fillStyle = color;
  const flap = Math.floor(now / 200) % 2;
  ctx.fillRect(x + 1, top, 3 - flap, 3);
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

// A dotted line between two linked pads, in the colour of whoever owns them.
// A white line means the pads belong to nobody, so anybody can walk through.
function drawPadLinks(): void {
  ctx.save();
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  for (const pad of world.things) {
    if (pad.type !== "teleporter" || !pad.link || !pad.pad) continue;
    // Only draw each pair once.
    if (pad.pad > pad.link) continue;
    const other = world.things.find((t) => t.pad === pad.link);
    if (!other) continue;
    ctx.strokeStyle = tribeOf(pad)?.color ?? "#f4f1ea";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.x, pad.y - 3);
    ctx.lineTo(other.x, other.y - 3);
    ctx.stroke();
  }
  ctx.restore();
}

// A missile is a dart with a flame on the back; a nuke is a fat one.
function drawShot(shot: Shot): void {
  const x = Math.round(shot.x);
  const y = Math.round(shot.y);
  const fat = shot.kind === "nuke";
  ctx.fillStyle = fat ? "#f7d23e" : "#f4f1ea";
  ctx.fillRect(x - (fat ? 1 : 0), y - 1, fat ? 3 : 2, fat ? 3 : 2);
  ctx.fillStyle = "#ee7a2a";
  ctx.fillRect(x - 1, y + (fat ? 2 : 1), 1, 1);
}

function drawEffect(e: Effect, now: number): void {
  const p = (now - e.born) / EFFECT_MS[e.kind];
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  if (e.kind === "laser") {
    // A beam that thins out as it fades.
    ctx.strokeStyle = e.color;
    ctx.lineWidth = Math.max(1, 3 * (1 - p));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(Math.round(e.x2 ?? x), Math.round(e.y2 ?? y));
    ctx.stroke();
  } else if (e.kind === "blast") {
    // A ring of fire racing outwards.
    const r = (e.size ?? 8) * p;
    ctx.strokeStyle = p < 0.5 ? "#f7d23e" : e.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - p;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (e.kind === "trail") {
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

// Worked out the first time a material is drawn, because crystals nobody had
// ever seen get added to the list while the game is running.
const SHADES: number[][][] = [];

function shadesFor(material: number): number[][] {
  let shades = SHADES[material];
  if (!shades) {
    shades = (MATERIALS[material]?.colors ?? ["#000000"]).map(toRgb);
    SHADES[material] = shades;
  }
  return shades;
}
const RAINBOW = MATERIALS.findIndex((m) => m.code === "r");
const FLOWING = new Set(["l", "w"].map((code) => MATERIALS.findIndex((m) => m.code === code)));
let caveImage: ImageData | null = null;
const inFront: Thing[] = [];

// Every pixel keeps its own speckle colour, except the rainbow crystal, whose
// colours ripple across it, and lava and water, which shimmer.
export function drawCave(
  target: CanvasRenderingContext2D,
  grid: Uint8Array,
  now: number,
  mountain?: Thing | null
): void {
  caveImage ??= target.createImageData(W, H);
  const data = caveImage.data;
  const tick = Math.floor(now / 150);
  for (let i = 0; i < grid.length; i += 1) {
    const material = grid[i] ?? 0;
    const shades = shadesFor(material);
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
  if (!mountain) return;
  drawCaveThings(target, mountain, now);
  drawCavePeople(target, mountain, now);
}

// Everything somebody has put down inside the cave: trees, villages, people,
// and bombs, which blink faster the closer they are to going off.
function drawCaveThings(target: CanvasRenderingContext2D, mountain: Thing, now: number): void {
  ctx = target;
  for (const t of mountain.caveThings ?? []) {
    const s = spriteFor(t);
    if (!s) continue;
    if (isBomb(t.type)) {
      const speed = Math.max(60, (t.fuse ?? 0) * 3);
      if (Math.floor(now / speed) % 2 === 0) {
        target.fillStyle = "#d8362b";
        target.fillRect(Math.round(t.x) - 1, Math.round(t.y) - s.height - 1, 3, 3);
      }
    }
    drawSprite(target, s, t.x, t.y, now + t.x * 37, Math.cos(t.heading ?? 0) < 0);
  }
}

// Whoever walked in, pottering about in the tunnels. Anyone carrying a crystal
// out has it twinkling over their head.
function drawCavePeople(target: CanvasRenderingContext2D, mountain: Thing, now: number): void {
  for (const p of insideOf(mountain, world.things)) {
    const s = personSprite(tribeOf(p)?.color ?? "#f2efe9");
    drawSprite(target, s, p.cx ?? 0, (p.cy ?? 0) + 3, now + (p.cx ?? 0) * 37, Math.cos(p.heading ?? 0) < 0);
    if (!p.dug) continue;
    target.fillStyle = Math.floor(now / 250) % 2 ? "#f4f1ea" : "#ffd76a";
    target.fillRect(Math.round(p.cx ?? 0), Math.round(p.cy ?? 0) - 8, 1, 1);
  }
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
  // Things further down the map are in front. The list to sort is kept and
  // reused, because a busy world has thousands of things in it.
  inFront.length = 0;
  for (const t of world.things) inFront.push(t);
  inFront.sort((a, b) => a.y - b.y);
  for (const t of inFront) {
    if (t.inside) continue;
    const s = spriteFor(t);
    if (!s) continue;
    // Anybody swimming is drawn down in the water with a ripple round them —
    // mutants included, since they swim the same as everybody else.
    const swimming = (t.type === "person" || t.type === "mutant") && !isLand(world.heights, t.x, t.y);
    drawSprite(ctx, s, t.x, t.y + (swimming ? 3 : 0), now + t.x * 37, Math.cos(t.heading ?? 0) < 0);
    if (swimming) drawRipple(t, now);
    if (t.type === "volcano") drawSmoke(t, now);
    if (t.tribe && MAGIC.has(t.type)) drawBanner(t, s, now);
    // A dark doorway at the foot of a mountain with a cave in it.
    if (t.cave !== undefined) {
      ctx.fillStyle = "#1b1b1f";
      ctx.fillRect(Math.round(t.x) - 1, Math.round(t.y) - 2, 3, 3);
    }
    if (t.hp !== undefined && t.hp < maxHp(t)) drawHealth(t, s);
  }
  drawPadLinks();
  for (const shot of world.shots) drawShot(shot);
  for (const e of world.effects) drawEffect(e, now);
  for (const wave of world.waves) drawWave(wave, now);
}
