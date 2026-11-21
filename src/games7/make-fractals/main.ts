import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { FRACTALS, gridFractal2D, gridFractal3D } from "./fractals";
import type { Fractal, Model3D, Shape } from "./fractals";
import { levelBlip, setMuted, vineBoom } from "./sfx";

installForceRefreshHotkey();

// ---------- saving ----------

const SAVE_KEY = "make-fractals-save";

interface Builder {
  dim: 2 | 3;
  n2: number;
  cells2: boolean[];
  n3: number;
  cells3: boolean[];
}

interface Save {
  fractalId: string;
  levels: Record<string, number>;
  palette: string;
  muted: boolean;
  builder: Builder;
}

const H_PATTERN = [true, false, true, true, true, true, true, false, true];

function mengerPattern(): boolean[] {
  const cells: boolean[] = [];
  for (let j = 0; j < 3; j++)
    for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) cells.push([i, j, k].filter((v) => v === 1).length <= 1);
  return cells;
}

function loadSave(): Save {
  const fresh: Save = {
    fractalId: "carpet",
    levels: {},
    palette: "rainbow",
    muted: false,
    builder: { dim: 2, n2: 3, cells2: [...H_PATTERN], n3: 3, cells3: mengerPattern() },
  };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Save> | null;
    if (!raw || typeof raw !== "object") return fresh;
    const b = raw.builder;
    const builderOk =
      b &&
      (b.dim === 2 || b.dim === 3) &&
      Array.isArray(b.cells2) &&
      b.cells2.length === b.n2 * b.n2 &&
      Array.isArray(b.cells3) &&
      b.cells3.length === b.n3 ** 3;
    return {
      fractalId: typeof raw.fractalId === "string" ? raw.fractalId : fresh.fractalId,
      levels: raw.levels && typeof raw.levels === "object" ? raw.levels : {},
      palette: typeof raw.palette === "string" ? raw.palette : fresh.palette,
      muted: raw.muted === true,
      builder: builderOk ? b : fresh.builder,
    };
  } catch {
    return fresh;
  }
}

const save = loadSave();
setMuted(save.muted);

function writeSave(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Couldn't save. It still works, it just won't remember.
  }
}

// ---------- colours ----------

type RGB = [number, number, number];
const BUCKETS = 128;
const INK: RGB = [255, 246, 229];
const BG = "#120a1f";

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function gradient(stops: RGB[]): (c: number) => RGB {
  return (c) => {
    const p = Math.max(0, Math.min(1, c)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(p));
    const t = p - i;
    const a = stops[i] ?? INK;
    const b = stops[i + 1] ?? INK;
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  };
}

const PALETTES: { id: string; name: string; at: (c: number) => RGB }[] = [
  { id: "rainbow", name: "🌈 Rainbow", at: (c) => hslToRgb(c * 300, 0.9, 0.6) },
  { id: "fire", name: "🔥 Fire", at: gradient([[120, 10, 40], [230, 50, 30], [255, 150, 30], [255, 240, 150]]) },
  { id: "ocean", name: "🌊 Ocean", at: gradient([[20, 40, 120], [30, 120, 210], [70, 215, 235], [220, 255, 250]]) },
  { id: "candy", name: "🍬 Candy", at: gradient([[255, 92, 170], [190, 120, 255], [90, 220, 255]]) },
  { id: "forest", name: "🌳 Forest", at: gradient([[120, 70, 35], [160, 120, 45], [80, 175, 65], [180, 245, 120]]) },
  { id: "gold", name: "🪙 Gold", at: gradient([[150, 90, 20], [255, 200, 60], [255, 245, 190]]) },
  { id: "galaxy", name: "🌌 Galaxy", at: gradient([[60, 20, 120], [150, 60, 220], [255, 120, 220], [255, 255, 255]]) },
  { id: "plain", name: "⬜ Plain", at: () => INK },
];

let paletteRgb: RGB[] = [];
let paletteCss: string[] = [];

function usePalette(id: string): void {
  const palette = PALETTES.find((p) => p.id === id) ?? PALETTES[0];
  if (!palette) return;
  paletteRgb = [];
  paletteCss = [];
  for (let i = 0; i <= BUCKETS; i++) {
    const rgb = palette.at(i / BUCKETS);
    paletteRgb.push(rgb);
    paletteCss.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
  }
}

const bucketOf = (c: number): number => (c < 0 ? -1 : Math.round(Math.max(0, Math.min(1, c)) * BUCKETS));

// ---------- the "make your own" fractal ----------

const BUILDER_ID = "builder";
const SIZES_2D = [2, 3, 4, 5];
const SIZES_3D = [2, 3, 4];

function builderKept(): number {
  const b = save.builder;
  return (b.dim === 2 ? b.cells2 : b.cells3).filter(Boolean).length;
}

function builderMaxLevel(): number {
  const kept = builderKept();
  if (kept <= 1) return 6;
  const limit = save.builder.dim === 2 ? 60000 : 12000;
  return Math.max(1, Math.min(10, Math.floor(Math.log(limit) / Math.log(kept))));
}

function builderKey(): string {
  const b = save.builder;
  return b.dim === 2
    ? `2:${b.n2}:${b.cells2.map(Number).join("")}`
    : `3:${b.n3}:${b.cells3.map(Number).join("")}`;
}

function builderFractal(): Fractal {
  const b = save.builder;
  const base = {
    id: BUILDER_ID,
    name: "Your Fractal",
    group: "Make Your Own",
    blurb: "Pick which squares to keep and watch your own fractal grow.",
    minLevel: 0,
    maxLevel: builderMaxLevel(),
    startLevel: 2,
  };
  if (b.dim === 2) {
    const n = b.n2;
    const cells = b.cells2;
    return {
      ...base,
      kind: "2d",
      unit: "squares",
      make: (level) => gridFractal2D(n, (i, j) => cells[j * n + i] === true, level),
    };
  }
  const n = b.n3;
  const cells = b.cells3;
  return {
    ...base,
    kind: "3d",
    unit: "cubes",
    make: (level) => gridFractal3D(n, (i, j, k) => cells[(j * n + k) * n + i] === true, level),
  };
}

function fractalById(id: string): Fractal {
  if (id === BUILDER_ID) return builderFractal();
  return FRACTALS.find((f) => f.id === id) ?? (FRACTALS[0] as Fractal);
}

// ---------- making and remembering the shapes ----------

interface Prepared2D {
  kind: "2d";
  shapes: Shape[];
  buckets: Int16Array;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  outline: boolean;
}

interface Prepared3D {
  kind: "3d";
  cubeCount: number;
  faceCount: number;
  corners: Float32Array; // 12 numbers per face, model already centered in -0.5..0.5
  centers: Float32Array; // 3 per face
  normals: Uint8Array;
  buckets: Int16Array;
}

type Prepared = Prepared2D | Prepared3D;

const cache = new Map<string, Prepared>();

function prepare(fractal: Fractal, level: number): Prepared {
  const key = `${fractal.id}:${level}:${fractal.id === BUILDER_ID ? builderKey() : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 40) cache.clear();
  const made = fractal.kind === "2d" ? prepare2D(fractal.make(level), fractal.outline === true) : prepare3D(fractal.make(level));
  cache.set(key, made);
  return made;
}

function prepare2D(shapes: Shape[], outline: boolean): Prepared2D {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const buckets = new Int16Array(shapes.length);
  shapes.forEach((s, i) => {
    buckets[i] = bucketOf(s.c);
    if (s.t === "r") {
      grow(s.x, s.y);
      grow(s.x + s.w, s.y + s.h);
    } else if (s.t === "l") {
      grow(s.x1, s.y1);
      grow(s.x2, s.y2);
    } else {
      for (let p = 0; p < s.pts.length; p += 2) grow(s.pts[p] ?? 0, s.pts[p + 1] ?? 0);
    }
  });
  if (!shapes.length) {
    minX = minY = 0;
    maxX = maxY = 1;
  }
  if (maxX - minX < 1e-9) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (maxY - minY < 1e-9) {
    minY -= 0.5;
    maxY += 0.5;
  }
  return { kind: "2d", shapes, buckets, bounds: { minX, minY, maxX, maxY }, outline };
}

// The 6 ways a cube face can point: +x, -x, +y, -y, +z, -z.
const NORMALS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function prepare3D(model: Model3D): Prepared3D {
  const { cubes, size } = model;
  const m = size + 2;
  const filled = new Set<number>();
  const keyOf = (x: number, y: number, z: number): number => ((x + 1) * m + (y + 1)) * m + (z + 1);
  for (const c of cubes) filled.add(keyOf(c.x, c.y, c.z));

  const corners: number[] = [];
  const centers: number[] = [];
  const normals: number[] = [];
  const buckets: number[] = [];
  const half = size / 2;
  const s = 1 / Math.max(1, size);
  for (const cube of cubes) {
    NORMALS.forEach(([nx, ny, nz], n) => {
      // Faces squashed against a neighbour can never be seen. Skip them.
      if (filled.has(keyOf(cube.x + nx, cube.y + ny, cube.z + nz))) return;
      const axis = nx !== 0 ? 0 : ny !== 0 ? 1 : 2;
      const sign = nx + ny + nz > 0 ? 1 : 0;
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const base = [cube.x, cube.y, cube.z];
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const [du, dv] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as const) {
        const p = [...base];
        p[axis] = (p[axis] ?? 0) + sign;
        p[u] = (p[u] ?? 0) + du;
        p[v] = (p[v] ?? 0) + dv;
        const x = ((p[0] ?? 0) - half) * s;
        const y = ((p[1] ?? 0) - half) * s;
        const z = ((p[2] ?? 0) - half) * s;
        corners.push(x, y, z);
        cx += x / 4;
        cy += y / 4;
        cz += z / 4;
      }
      centers.push(cx, cy, cz);
      normals.push(n);
      buckets.push(bucketOf(cube.c));
    });
  }
  return {
    kind: "3d",
    cubeCount: cubes.length,
    faceCount: normals.length,
    corners: new Float32Array(corners),
    centers: new Float32Array(centers),
    normals: new Uint8Array(normals),
    buckets: new Int16Array(buckets),
  };
}

// ---------- drawing ----------

interface View {
  zoom: number;
  panX: number;
  panY: number;
  yaw: number;
  pitch: number;
}

function draw2D(ctx: CanvasRenderingContext2D, W: number, H: number, data: Prepared2D, view: View, reveal: number, dpr: number): void {
  const { minX, minY, maxX, maxY } = data.bounds;
  const pad = Math.min(W, H) * 0.06;
  const fit = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
  const scale = fit * view.zoom;
  const ox = W / 2 + view.panX - ((minX + maxX) / 2) * scale;
  const oy = H / 2 + view.panY - ((minY + maxY) / 2) * scale;
  const sx = (x: number): number => ox + x * scale;
  const sy = (y: number): number => oy + y * scale;

  const count = Math.min(data.shapes.length, reveal);
  const rects = new Map<number, Path2D>();
  const polys = new Map<number, Path2D>();
  const lines = new Map<string, { path: Path2D; bucket: number; lw: number }>();
  const seam = 0.4 * dpr; // stretch squares a hair so no thin cracks show between them
  const outlinePath = data.outline ? new Path2D() : null;

  for (let i = 0; i < count; i++) {
    const s = data.shapes[i];
    if (!s) continue;
    const b = data.buckets[i] ?? 0;
    if (s.t === "r") {
      let path = rects.get(b);
      if (!path) rects.set(b, (path = new Path2D()));
      const x = sx(s.x);
      const y = sy(s.y);
      const w = s.w * scale;
      const h = s.h * scale;
      path.rect(x - seam, y - seam, w + seam * 2, h + seam * 2);
      outlinePath?.rect(x, y, w, h);
    } else if (s.t === "p") {
      let path = polys.get(b);
      if (!path) polys.set(b, (path = new Path2D()));
      path.moveTo(sx(s.pts[0] ?? 0), sy(s.pts[1] ?? 0));
      for (let p = 2; p < s.pts.length; p += 2) path.lineTo(sx(s.pts[p] ?? 0), sy(s.pts[p + 1] ?? 0));
      path.closePath();
    } else {
      const lw = s.lw ?? 1;
      const key = `${b}:${lw}`;
      let group = lines.get(key);
      if (!group) lines.set(key, (group = { path: new Path2D(), bucket: b, lw }));
      group.path.moveTo(sx(s.x1), sy(s.y1));
      group.path.lineTo(sx(s.x2), sy(s.y2));
    }
  }

  const color = (b: number): string => (b < 0 ? `rgb(${INK.join(",")})` : paletteCss[b] ?? "#fff");
  const byBucket = <T,>(map: Map<number, T>): [number, T][] => [...map.entries()].sort((a, b) => a[0] - b[0]);

  for (const [b, path] of byBucket(rects)) {
    ctx.fillStyle = color(b);
    ctx.fill(path);
  }
  if (outlinePath) {
    ctx.strokeStyle = BG;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke(outlinePath);
  }
  for (const [b, path] of byBucket(polys)) {
    ctx.fillStyle = color(b);
    ctx.fill(path);
  }
  const total = data.shapes.length;
  const baseWidth = (total > 6000 ? 1 : total > 1200 ? 1.6 : 2.6) * dpr * Math.min(3, Math.pow(view.zoom, 0.35));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sortedLines = [...lines.values()].sort((a, b) => (a.bucket < 0 ? 1 : b.bucket < 0 ? -1 : a.bucket - b.bucket));
  for (const group of sortedLines) {
    ctx.strokeStyle = color(group.bucket);
    ctx.lineWidth = baseWidth * group.lw;
    ctx.stroke(group.path);
  }
}

const LIGHT = (() => {
  const v = [-0.45, 0.75, -0.55];
  const len = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
  return v.map((n) => n / len) as [number, number, number];
})();

function draw3D(ctx: CanvasRenderingContext2D, W: number, H: number, data: Prepared3D, view: View, grow: number, dpr: number): void {
  const cosY = Math.cos(view.yaw);
  const sinY = Math.sin(view.yaw);
  const cosP = Math.cos(view.pitch);
  const sinP = Math.sin(view.pitch);
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    return [x1, y * cosP - z1 * sinP, y * sinP + z1 * cosP];
  };

  // Which way each kind of face points now, and how much light it gets.
  const facing: boolean[] = [];
  const light: number[] = [];
  for (const [nx, ny, nz] of NORMALS) {
    const [rx, ry, rz] = rot(nx, ny, nz);
    facing.push(rz < 0);
    light.push(0.32 + 0.68 * Math.max(0, rx * LIGHT[0] + ry * LIGHT[1] + rz * LIGHT[2]));
  }

  const visible: number[] = [];
  const depth = new Float32Array(data.faceCount);
  for (let f = 0; f < data.faceCount; f++) {
    if (!facing[data.normals[f] ?? 0]) continue;
    const c = f * 3;
    const [, , z] = rot(data.centers[c] ?? 0, data.centers[c + 1] ?? 0, data.centers[c + 2] ?? 0);
    depth[f] = z;
    visible.push(f);
  }
  visible.sort((a, b) => (depth[b] ?? 0) - (depth[a] ?? 0));

  const scale = Math.min(W, H) * 0.56 * view.zoom * grow;
  const cx = W / 2 + view.panX;
  const cy = H / 2 + view.panY;
  const edges = visible.length < 5000;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, 0.8 * dpr);
  ctx.strokeStyle = "rgba(10, 5, 20, 0.35)";
  for (const f of visible) {
    const base = f * 12;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const [x, y] = rot(data.corners[base + k * 3] ?? 0, data.corners[base + k * 3 + 1] ?? 0, data.corners[base + k * 3 + 2] ?? 0);
      const px = cx + x * scale;
      const py = cy - y * scale;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const rgb = paletteRgb[data.buckets[f] ?? 0] ?? INK;
    const shade = light[data.normals[f] ?? 0] ?? 1;
    ctx.fillStyle = `rgb(${Math.round(rgb[0] * shade)},${Math.round(rgb[1] * shade)},${Math.round(rgb[2] * shade)})`;
    ctx.fill();
    if (edges) ctx.stroke();
  }
}

function paint(ctx: CanvasRenderingContext2D, W: number, H: number, data: Prepared, view: View, progress: number, dpr: number): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (data.kind === "2d") {
    const total = data.shapes.length;
    draw2D(ctx, W, H, data, view, progress >= 1 ? total : Math.ceil(total * progress), dpr);
  } else {
    draw3D(ctx, W, H, data, view, 0.25 + 0.75 * easeOutBack(progress), dpr);
  }
}

function easeOutBack(t: number): number {
  if (t >= 1) return 1;
  const c1 = 1.4;
  return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// ---------- the page ----------

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
};

const canvas = $<HTMLCanvasElement>("canvas");
const wrap = $("canvas-wrap");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const sidebar = $("sidebar");
const nameEl = $("fractal-name");
const blurbEl = $("fractal-blurb");
const levelEl = $("level-number");
const countEl = $("shape-count");
const levelDown = $<HTMLButtonElement>("level-down");
const levelUp = $<HTMLButtonElement>("level-up");
const paletteSelect = $<HTMLSelectElement>("palette-select");
const spinButton = $<HTMLButtonElement>("spin-button");
const builderEl = $("builder");
const boomText = $("boom-text");
const soundButton = $<HTMLButtonElement>("sound-button");

const DEFAULT_VIEW = (): View => ({ zoom: 1, panX: 0, panY: 0, yaw: 0.65, pitch: -0.5 });
let view = DEFAULT_VIEW();
let fractal = fractalById(save.fractalId);
let level = 0;
let data: Prepared;
let growStart = performance.now();
let growTime = 900;
let spinning = true;
let dirty = true;
let dpr = 1;

function currentLevel(f: Fractal): number {
  const saved = save.levels[f.id];
  const value = typeof saved === "number" ? saved : f.startLevel;
  return Math.max(f.minLevel, Math.min(f.maxLevel, value));
}

function countOf(d: Prepared): number {
  // Plain-ink shapes (like the golden spiral) are extras, not part of the count.
  return d.kind === "2d" ? d.shapes.filter((s) => s.c >= 0).length : d.cubeCount;
}

function refresh(regrow: boolean): void {
  level = currentLevel(fractal);
  data = prepare(fractal, level);
  levelEl.textContent = String(level);
  levelDown.disabled = level <= fractal.minLevel;
  levelUp.disabled = level >= fractal.maxLevel;
  const count = countOf(data);
  countEl.textContent = fractal.id === BUILDER_ID && builderKept() === 0
    ? "Click some squares up there!"
    : `${count.toLocaleString()} ${count === 1 ? fractal.unit.replace(/s$/, "") : fractal.unit}${level === fractal.maxLevel ? " · MAX!" : ""}`;
  nameEl.textContent = fractal.name;
  blurbEl.textContent = fractal.blurb;
  spinButton.hidden = fractal.kind !== "3d";
  spinButton.classList.toggle("is-on", spinning);
  builderEl.hidden = fractal.id !== BUILDER_ID;
  if (regrow) {
    growStart = performance.now();
    growTime = data.kind === "3d" ? 650 : Math.min(1600, 450 + Math.log2(count + 1) * 80);
  }
  dirty = true;
}

function setLevel(next: number): void {
  const clamped = Math.max(fractal.minLevel, Math.min(fractal.maxLevel, next));
  if (clamped === level) return;
  const goingUp = clamped > level;
  save.levels[fractal.id] = clamped;
  writeSave();
  refresh(goingUp);
  if (clamped === fractal.maxLevel && goingUp) boom("MAX LEVEL!");
  else levelBlip(clamped, goingUp);
}

function choose(id: string): void {
  save.fractalId = id;
  writeSave();
  fractal = fractalById(id);
  view = DEFAULT_VIEW();
  for (const button of sidebar.querySelectorAll<HTMLButtonElement>(".fractal-button"))
    button.classList.toggle("is-active", button.dataset["id"] === id);
  if (id === BUILDER_ID) renderBuilder();
  refresh(true);
}

let boomTimer = 0;
function boom(text: string): void {
  vineBoom();
  boomText.textContent = text;
  boomText.classList.remove("is-booming");
  wrap.classList.remove("is-shaking");
  void boomText.offsetWidth;
  boomText.classList.add("is-booming");
  wrap.classList.add("is-shaking");
  window.clearTimeout(boomTimer);
  boomTimer = window.setTimeout(() => {
    boomText.classList.remove("is-booming");
    wrap.classList.remove("is-shaking");
  }, 1400);
}

// ---------- sidebar with little pictures ----------

function thumbLevel(f: Fractal): number {
  let l = Math.min(f.startLevel, f.maxLevel);
  while (l > f.minLevel && countOf(prepare(f, l)) > 2500) l--;
  return l;
}

function drawThumb(thumb: HTMLCanvasElement, f: Fractal): void {
  const t = thumb.getContext("2d");
  if (!t) return;
  const size = thumb.width;
  paint(t, size, size, prepare(f, thumbLevel(f)), DEFAULT_VIEW(), 1, 0.6);
}

function buildSidebar(): void {
  const groups = new Map<string, Fractal[]>();
  for (const f of [...FRACTALS, builderFractal()]) {
    const list = groups.get(f.group) ?? [];
    list.push(f);
    groups.set(f.group, list);
  }
  sidebar.replaceChildren();
  for (const [group, list] of groups) {
    const heading = document.createElement("h3");
    heading.textContent = group;
    sidebar.append(heading);
    for (const f of list) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fractal-button";
      button.dataset["id"] = f.id;
      if (f.id === fractal.id) button.classList.add("is-active");
      const thumb = document.createElement("canvas");
      thumb.width = 96;
      thumb.height = 96;
      thumb.className = "thumb";
      const label = document.createElement("span");
      label.textContent = f.id === BUILDER_ID ? "✏️ Your Fractal" : f.name;
      button.append(thumb, label);
      button.addEventListener("click", () => choose(f.id));
      sidebar.append(button);
    }
  }
  redrawThumbs();
}

function redrawThumbs(): void {
  for (const button of sidebar.querySelectorAll<HTMLButtonElement>(".fractal-button")) {
    const thumb = button.querySelector("canvas");
    const id = button.dataset["id"];
    if (thumb && id) drawThumb(thumb, fractalById(id));
  }
}

function redrawBuilderThumb(): void {
  const thumb = sidebar.querySelector<HTMLCanvasElement>(`.fractal-button[data-id="${BUILDER_ID}"] canvas`);
  if (thumb) drawThumb(thumb, builderFractal());
}

// ---------- the builder ----------

function renderBuilder(): void {
  const b = save.builder;
  for (const button of $("builder-dim").querySelectorAll<HTMLButtonElement>("button"))
    button.classList.toggle("is-on", Number(button.dataset["dim"]) === b.dim);

  const sizeBox = $("builder-size");
  const sizes = b.dim === 2 ? SIZES_2D : SIZES_3D;
  const n = b.dim === 2 ? b.n2 : b.n3;
  sizeBox.replaceChildren(
    ...sizes.map((size) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = b.dim === 2 ? `${size}×${size}` : `${size}×${size}×${size}`;
      button.classList.toggle("is-on", size === n);
      button.addEventListener("click", () => {
        if (size === n) return;
        if (b.dim === 2) {
          b.n2 = size;
          b.cells2 = Array.from({ length: size * size }, (_, i) => (Math.floor(i / size) + (i % size)) % 2 === 0);
        } else {
          b.n3 = size;
          b.cells3 = Array.from({ length: size ** 3 }, (_, i) => {
            const x = i % size;
            const z = Math.floor(i / size) % size;
            const y = Math.floor(i / size / size);
            return (x + y + z) % 2 === 0;
          });
        }
        builderChanged();
      });
      return button;
    })
  );

  const grids = $("builder-grids");
  grids.replaceChildren();
  const cells = b.dim === 2 ? b.cells2 : b.cells3;
  const layers = b.dim === 2 ? 1 : n;
  for (let layer = layers - 1; layer >= 0; layer--) {
    const box = document.createElement("div");
    box.className = "builder-layer";
    if (b.dim === 3) {
      const label = document.createElement("span");
      label.className = "layer-label";
      label.textContent = layer === layers - 1 ? "Top layer" : layer === 0 ? "Bottom layer" : `Layer ${layer + 1}`;
      box.append(label);
    }
    const grid = document.createElement("div");
    grid.className = "builder-grid";
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const index = b.dim === 2 ? row * n + col : (layer * n + row) * n + col;
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "builder-cell";
        cell.classList.toggle("is-kept", cells[index] === true);
        cell.setAttribute("aria-label", `Square ${col + 1}, ${row + 1}${b.dim === 3 ? ` on layer ${layer + 1}` : ""}`);
        cell.setAttribute("aria-pressed", String(cells[index] === true));
        cell.addEventListener("click", () => {
          cells[index] = !cells[index];
          builderChanged();
        });
        grid.append(cell);
      }
    }
    box.append(grid);
    grids.append(box);
  }
}

function builderChanged(): void {
  writeSave();
  fractal = builderFractal();
  renderBuilder();
  redrawBuilderThumb();
  refresh(true);
  levelBlip(builderKept() % 12, true);
}

$("builder-dim").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-dim]");
  if (!button) return;
  const dim = Number(button.dataset["dim"]) === 3 ? 3 : 2;
  if (dim === save.builder.dim) return;
  save.builder.dim = dim;
  view = DEFAULT_VIEW();
  builderChanged();
});

const builderCells = (): boolean[] => (save.builder.dim === 2 ? save.builder.cells2 : save.builder.cells3);
$("builder-clear").addEventListener("click", () => {
  builderCells().fill(false);
  builderChanged();
});
$("builder-fill").addEventListener("click", () => {
  builderCells().fill(true);
  builderChanged();
});
$("builder-random").addEventListener("click", () => {
  const cells = builderCells();
  for (let i = 0; i < cells.length; i++) cells[i] = Math.random() < 0.55;
  if (!cells.some(Boolean)) cells[0] = true;
  builderChanged();
});

// ---------- buttons and keys ----------

levelDown.addEventListener("click", () => setLevel(level - 1));
levelUp.addEventListener("click", () => setLevel(level + 1));

for (const palette of PALETTES) {
  const option = document.createElement("option");
  option.value = palette.id;
  option.textContent = palette.name;
  paletteSelect.append(option);
}
if (!PALETTES.some((p) => p.id === save.palette)) save.palette = "rainbow";
paletteSelect.value = save.palette;
usePalette(save.palette);
paletteSelect.addEventListener("change", () => {
  save.palette = paletteSelect.value;
  writeSave();
  usePalette(save.palette);
  redrawThumbs();
  dirty = true;
});

$("grow-button").addEventListener("click", () => refresh(true));
$("reset-button").addEventListener("click", () => {
  view = DEFAULT_VIEW();
  dirty = true;
});
spinButton.addEventListener("click", () => {
  spinning = !spinning;
  spinButton.classList.toggle("is-on", spinning);
});
$("title-button").addEventListener("click", () => boom("FRACTALS!"));

function showSound(): void {
  soundButton.textContent = save.muted ? "🔇 Muted" : "🔊 Sound";
  soundButton.setAttribute("aria-pressed", String(save.muted));
}
showSound();
soundButton.addEventListener("click", () => {
  save.muted = !save.muted;
  setMuted(save.muted);
  writeSave();
  showSound();
});

$("save-button").addEventListener("click", () => {
  paint(ctx, canvas.width, canvas.height, data, view, 1, dpr);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fractal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-level-${level}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
});

window.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.tagName === "SELECT") return;
  if (event.key === "ArrowUp" || event.key === "ArrowRight" || event.key === "+" || event.key === "=") {
    event.preventDefault();
    setLevel(level + 1);
  } else if (event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "-") {
    event.preventDefault();
    setLevel(level - 1);
  } else if (event.key === "g" || event.key === "G") refresh(true);
  else if (event.key === "r" || event.key === "R") {
    view = DEFAULT_VIEW();
    dirty = true;
  }
});

// ---------- dragging, zooming and spinning ----------

const pointers = new Map<number, { x: number; y: number }>();
let pinchDistance = 0;

function zoomAt(factor: number, clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * dpr - canvas.width / 2;
  const py = (clientY - rect.top) * dpr - canvas.height / 2;
  const next = Math.max(0.2, Math.min(400, view.zoom * factor));
  const real = next / view.zoom;
  view.panX = px - (px - view.panX) * real;
  view.panY = py - (py - view.panY) * real;
  view.zoom = next;
  dirty = true;
}

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  },
  { passive: false }
);

canvas.addEventListener("pointerdown", (event) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Fine without it.
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    if (a && b) pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
  }
  canvas.classList.add("is-dragging");
});

canvas.addEventListener("pointermove", (event) => {
  const last = pointers.get(event.pointerId);
  if (!last) return;
  const dx = event.clientX - last.x;
  const dy = event.clientY - last.y;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDistance > 0) zoomAt(distance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinchDistance = distance;
    return;
  }
  if (fractal.kind === "3d" && !event.shiftKey) {
    view.yaw += dx * 0.01;
    view.pitch = Math.max(-1.5, Math.min(1.5, view.pitch - dy * 0.01));
  } else {
    view.panX += dx * dpr;
    view.panY += dy * dpr;
  }
  dirty = true;
});

const letGo = (event: PointerEvent): void => {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchDistance = 0;
  if (pointers.size === 0) canvas.classList.remove("is-dragging");
};
canvas.addEventListener("pointerup", letGo);
canvas.addEventListener("pointercancel", letGo);

function resize(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = wrap.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    dirty = true;
  }
}
new ResizeObserver(resize).observe(wrap);

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const progress = Math.min(1, (now - growStart) / growTime);
  const growing = progress < 1;
  const turning = fractal.kind === "3d" && spinning && pointers.size === 0;
  if (turning) view.yaw += dt * 0.35;
  if (dirty || growing || turning) {
    paint(ctx, canvas.width, canvas.height, data, view, progress, dpr);
    dirty = false;
  }
  requestAnimationFrame(frame);
}

resize();
refresh(true);
buildSidebar();
if (fractal.id === BUILDER_ID) renderBuilder();
sidebar.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
requestAnimationFrame(frame);
