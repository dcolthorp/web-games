import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { FRACTALS, gridFractal2D, gridFractal3D } from "./fractals";
import type { Fractal, Model3D, ModelND, Shape } from "./fractals";
import { levelBlip, setMuted, vineBoom } from "./sfx";
import { deepPan, deepZoom, diveStep, drawDeep, freshDeepView, startDive, visibleDepth } from "./deep";
import type { DeepView, Dive } from "./deep";
import { cantorLive, drawLive, goldenLive, hTreeLive, pythagorasLive, treeLive, tSquareLive } from "./live";
import type { LiveSpec } from "./live";
import { edgeCurve, hilbertCurve, peanoCurve } from "./curves";
import type { Curve } from "./curves";
import { drawCubesLod, drawHypercubesLod } from "./lod";

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
    builder: {
      dim: 2,
      n2: 3,
      cells2: [...H_PATTERN],
      n3: 3,
      cells3: mengerPattern(),
    },
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
  {
    id: "fire",
    name: "🔥 Fire",
    at: gradient([
      [120, 10, 40],
      [230, 50, 30],
      [255, 150, 30],
      [255, 240, 150],
    ]),
  },
  {
    id: "ocean",
    name: "🌊 Ocean",
    at: gradient([
      [20, 40, 120],
      [30, 120, 210],
      [70, 215, 235],
      [220, 255, 250],
    ]),
  },
  {
    id: "candy",
    name: "🍬 Candy",
    at: gradient([
      [255, 92, 170],
      [190, 120, 255],
      [90, 220, 255],
    ]),
  },
  {
    id: "forest",
    name: "🌳 Forest",
    at: gradient([
      [120, 70, 35],
      [160, 120, 45],
      [80, 175, 65],
      [180, 245, 120],
    ]),
  },
  {
    id: "gold",
    name: "🪙 Gold",
    at: gradient([
      [150, 90, 20],
      [255, 200, 60],
      [255, 245, 190],
    ]),
  },
  {
    id: "galaxy",
    name: "🌌 Galaxy",
    at: gradient([
      [60, 20, 120],
      [150, 60, 220],
      [255, 120, 220],
      [255, 255, 255],
    ]),
  },
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
  const limit = save.builder.dim === 2 ? 250000 : 15000;
  return Math.max(1, Math.min(10, Math.floor(Math.log(limit) / Math.log(kept))));
}

function builderKey(): string {
  const b = save.builder;
  return b.dim === 2 ? `2:${b.n2}:${b.cells2.map(Number).join("")}` : `3:${b.n3}:${b.cells3.map(Number).join("")}`;
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
    log10Count: (level: number) => level * Math.log10(builderKept()),
  };
  if (b.dim === 2) {
    const n = b.n2;
    const cells = b.cells2;
    return {
      ...base,
      kind: "2d",
      unit: "squares",
      grid2: { n, keep: (i: number, j: number) => cells[j * n + i] === true },
      make: (level) => gridFractal2D(n, (i, j) => cells[j * n + i] === true, level),
    };
  }
  const n = b.n3;
  const cells = b.cells3;
  return {
    ...base,
    kind: "3d",
    unit: "cubes",
    grid3: { n, keep: (i: number, j: number, k: number) => cells[(j * n + k) * n + i] === true },
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

// For each way a face can point: which little squares on that face are solid
// and which are holes, one level down.
interface FaceMask {
  kept: [number, number][];
  holes: [number, number][];
}

interface Prepared3D {
  kind: "3d";
  n: number;
  masks: FaceMask[] | null;
  cubeCount: number;
  faceCount: number;
  corners: Float32Array; // 12 numbers per face, model already centered in -0.5..0.5
  centers: Float32Array; // 3 per face
  normals: Uint8Array;
  buckets: Int16Array;
}

interface PreparedND {
  kind: "nd";
  dims: number;
  cells: number;
  edgeCount: number;
  edges: Float32Array; // dims numbers for each end of each edge
  buckets: Int16Array;
}

type Prepared = Prepared2D | Prepared3D | PreparedND;

const cache = new Map<string, Prepared>();

function prepare(fractal: Fractal, level: number): Prepared {
  const key = `${fractal.id}:${level}:${fractal.id === BUILDER_ID ? builderKey() : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 40) cache.clear();
  const made =
    fractal.kind === "2d"
      ? prepare2D(fractal.make(level), fractal.outline === true)
      : fractal.kind === "3d"
        ? prepare3D(fractal.make(level), fractal.grid3)
        : prepareND(fractal.make(level));
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
  return {
    kind: "2d",
    shapes,
    buckets,
    bounds: { minX, minY, maxX, maxY },
    outline,
  };
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

function faceMasks(grid: { n: number; keep: (i: number, j: number, k: number) => boolean }): FaceMask[] {
  return NORMALS.map(([nx, ny, nz]) => {
    const axis = nx !== 0 ? 0 : ny !== 0 ? 1 : 2;
    const outside = nx + ny + nz > 0 ? grid.n - 1 : 0;
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const mask: FaceMask = { kept: [], holes: [] };
    for (let a = 0; a < grid.n; a++) {
      for (let b = 0; b < grid.n; b++) {
        const c = [0, 0, 0];
        c[axis] = outside;
        c[u] = a;
        c[v] = b;
        (grid.keep(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0) ? mask.kept : mask.holes).push([a, b]);
      }
    }
    return mask;
  });
}

function prepare3D(
  model: Model3D,
  grid?: { n: number; keep: (i: number, j: number, k: number) => boolean }
): Prepared3D {
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
    n: grid?.n ?? 3,
    masks: grid ? faceMasks(grid) : null,
    cubeCount: cubes.length,
    faceCount: normals.length,
    corners: new Float32Array(corners),
    centers: new Float32Array(centers),
    normals: new Uint8Array(normals),
    buckets: new Int16Array(buckets),
  };
}

function prepareND(model: ModelND): PreparedND {
  const buckets = new Int16Array(model.colors.length);
  model.colors.forEach((c, i) => (buckets[i] = bucketOf(c)));
  return {
    kind: "nd",
    dims: model.dims,
    cells: model.cells,
    edgeCount: model.colors.length,
    edges: model.edges,
    buckets,
  };
}

// ---------- drawing ----------

interface View {
  zoom: number;
  panX: number;
  panY: number;
  yaw: number;
  pitch: number;
  spin4: number; // how far the tesseract has turned through the 4th direction
}

function draw2D(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  data: Prepared2D,
  view: View,
  reveal: number,
  dpr: number
): void {
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

  const color = (b: number): string => (b < 0 ? `rgb(${INK.join(",")})` : (paletteCss[b] ?? "#fff"));
  const byBucket = <T>(map: Map<number, T>): [number, T][] => [...map.entries()].sort((a, b) => a[0] - b[0]);

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

function draw3D(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  data: Prepared3D,
  view: View,
  grow: number,
  dpr: number,
  extra = 0
): void {
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
  const sx = new Float64Array(4);
  const sy = new Float64Array(4);
  const n = data.n;
  const tiny = 2.5 * dpr;
  const offScreen = (xs: number[], ys: number[]): boolean =>
    Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H;

  // The holes on a face: each hole is a square tunnel going into the cube.
  // You see its inside walls, and further in, the dark middle. Then do the
  // same inside every solid square, deeper and deeper, until they're too
  // small to see. (alpha, beta) is how far "into the cube" slides along the
  // face's two edges, so the dark middle is the hole slid inward.
  let alpha = 0;
  let beta = 0;
  const holes = (
    path: Path2D,
    core: Path2D,
    mask: FaceMask,
    px: number,
    py: number,
    ux: number,
    uy: number,
    vx: number,
    vy: number,
    left: number
  ): void => {
    const ax = ux / n;
    const ay = uy / n;
    const bx = vx / n;
    const by = vy / n;
    for (const [a, b] of mask.holes) {
      const x0 = px + a * ax + b * bx;
      const y0 = py + a * ay + b * by;
      path.moveTo(x0, y0);
      path.lineTo(x0 + ax, y0 + ay);
      path.lineTo(x0 + ax + bx, y0 + ay + by);
      path.lineTo(x0 + bx, y0 + by);
      path.closePath();
      const u0 = Math.max(0, alpha);
      const u1 = Math.min(1, 1 + alpha);
      const v0 = Math.max(0, beta);
      const v1 = Math.min(1, 1 + beta);
      if (u1 > u0 && v1 > v0) {
        core.moveTo(x0 + u0 * ax + v0 * bx, y0 + u0 * ay + v0 * by);
        core.lineTo(x0 + u1 * ax + v0 * bx, y0 + u1 * ay + v0 * by);
        core.lineTo(x0 + u1 * ax + v1 * bx, y0 + u1 * ay + v1 * by);
        core.lineTo(x0 + u0 * ax + v1 * bx, y0 + u0 * ay + v1 * by);
        core.closePath();
      }
    }
    if (left <= 1 || Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)) < tiny * n) return;
    for (const [a, b] of mask.kept) {
      const x0 = px + a * ax + b * bx;
      const y0 = py + a * ay + b * by;
      const xs = [x0, x0 + ax, x0 + bx, x0 + ax + bx];
      const ys = [y0, y0 + ay, y0 + by, y0 + ay + by];
      if (offScreen(xs, ys)) continue;
      holes(path, core, mask, x0, y0, ax, ay, bx, by, left - 1);
    }
  };

  for (const f of visible) {
    const base = f * 12;
    for (let k = 0; k < 4; k++) {
      const [x, y] = rot(
        data.corners[base + k * 3] ?? 0,
        data.corners[base + k * 3 + 1] ?? 0,
        data.corners[base + k * 3 + 2] ?? 0
      );
      sx[k] = cx + x * scale;
      sy[k] = cy - y * scale;
    }
    const xs = [...sx];
    const ys = [...sy];
    if (offScreen(xs, ys)) continue;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      if (k === 0) ctx.moveTo(sx[k] ?? 0, sy[k] ?? 0);
      else ctx.lineTo(sx[k] ?? 0, sy[k] ?? 0);
    }
    ctx.closePath();
    const rgb = paletteRgb[data.buckets[f] ?? 0] ?? INK;
    const normal = data.normals[f] ?? 0;
    const shade = light[normal] ?? 1;
    ctx.fillStyle = `rgb(${Math.round(rgb[0] * shade)},${Math.round(rgb[1] * shade)},${Math.round(rgb[2] * shade)})`;
    ctx.fill();
    if (edges) ctx.stroke();
    const mask = data.masks?.[normal];
    if (extra > 0 && mask) {
      const x0 = sx[0] ?? 0;
      const y0 = sy[0] ?? 0;
      const ux = (sx[1] ?? 0) - x0;
      const uy = (sy[1] ?? 0) - y0;
      const vx = (sx[3] ?? 0) - x0;
      const vy = (sy[3] ?? 0) - y0;
      if (Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy)) < tiny) continue;
      // Which way is "into the cube" on the screen, for a tunnel 1.5 holes deep?
      const [nx, ny, nz] = NORMALS[normal] ?? [0, 0, 1];
      const [rx, ry] = rot(-nx, -ny, -nz);
      const edge = Math.hypot(
        (data.corners[base + 3] ?? 0) - (data.corners[base] ?? 0),
        (data.corners[base + 4] ?? 0) - (data.corners[base + 1] ?? 0),
        (data.corners[base + 5] ?? 0) - (data.corners[base + 2] ?? 0)
      );
      const dx = rx * scale * edge * 1.5;
      const dy = -ry * scale * edge * 1.5;
      const det = ux * vy - uy * vx;
      alpha = det ? (dx * vy - dy * vx) / det : 0;
      beta = det ? (ux * dy - uy * dx) / det : 0;
      const path = new Path2D();
      const core = new Path2D();
      holes(path, core, mask, x0, y0, ux, uy, vx, vy, extra);
      const tint = (k: number): string =>
        `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
      ctx.fillStyle = tint(shade * 0.62); // the tunnel's walls
      ctx.fill(path);
      ctx.fillStyle = tint(0.16); // deep inside, where it's dark
      ctx.fill(core);
    }
  }
}

// Turn the lines through every extra direction (4th, 5th, 6th…), then squish
// them down one direction at a time until they're 3D. Things further away in
// a hidden direction get smaller, like perspective. Then draw them like the
// 3D ones.
function drawND(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  data: PreparedND,
  view: View,
  grow: number,
  dpr: number
): void {
  const dims = data.dims;
  const turns: { a: number; b: number; cos: number; sin: number }[] = [];
  for (let d = 3; d < dims; d++) {
    const angle = view.spin4 * (1 + (d - 3) * 0.31) + d;
    turns.push({
      a: (d - 3) % 3,
      b: d,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
    });
    if (d > 3) {
      const mix = view.spin4 * 0.45 + d * 0.7;
      turns.push({ a: d - 1, b: d, cos: Math.cos(mix), sin: Math.sin(mix) });
    }
  }
  const cosY = Math.cos(view.yaw);
  const sinY = Math.sin(view.yaw);
  const cosP = Math.cos(view.pitch);
  const sinP = Math.sin(view.pitch);
  const scale = (Math.min(W, H) * 0.36 * view.zoom * grow) / (dims === 4 ? 1 : Math.sqrt((dims - 2) / 1.5));
  const cx = W / 2 + view.panX;
  const cy = H / 2 + view.panY;
  const eye = 2.4;
  const e = data.edges;
  const p = new Float64Array(dims);
  // 5D and up: every direction gets its own arrow in 3D. The first three
  // are x, y and z; the hidden ones point off at slants spread around a
  // ball, and slowly swing around so you can watch them turn.
  const arrows: [number, number, number][] = [];
  for (let d = 0; d < dims; d++) {
    if (d < 3) {
      arrows.push([d === 0 ? 1 : 0, d === 1 ? 1 : 0, d === 2 ? 1 : 0]);
      continue;
    }
    const i = d - 3;
    const count = dims - 3;
    const up = 1 - (2 * (i + 0.5)) / count;
    const around = i * 2.39996 + view.spin4 * (1 + i * 0.17);
    const r = Math.sqrt(1 - up * up);
    arrows.push([Math.cos(around) * r * 0.9, up * 0.9, Math.sin(around) * r * 0.9]);
  }
  const project = (start: number): [number, number] => {
    for (let a = 0; a < dims; a++) p[a] = e[start + a] ?? 0;
    let X = 0;
    let Y = 0;
    let Z = 0;
    if (dims === 4) {
      for (const t of turns) {
        const u = p[t.a] ?? 0;
        const v = p[t.b] ?? 0;
        p[t.a] = u * t.cos - v * t.sin;
        p[t.b] = u * t.sin + v * t.cos;
      }
      // Further away in the 4th direction = smaller, like perspective.
      const k = eye / (eye - Math.max(-eye, Math.min(eye * 0.6, p[3] ?? 0)));
      X = (p[0] ?? 0) * k;
      Y = (p[1] ?? 0) * k;
      Z = (p[2] ?? 0) * k;
    } else {
      for (let a = 0; a < dims; a++) {
        const arrow = arrows[a];
        const q = p[a] ?? 0;
        if (!arrow) continue;
        X += arrow[0] * q;
        Y += arrow[1] * q;
        Z += arrow[2] * q;
      }
    }
    const X2 = X * cosY + Z * sinY;
    const Z2 = -X * sinY + Z * cosY;
    return [cx + X2 * scale, cy - (Y * cosP - Z2 * sinP) * scale];
  };
  const paths = new Map<number, Path2D>();
  for (let f = 0; f < data.edgeCount; f++) {
    const b = data.buckets[f] ?? 0;
    let path = paths.get(b);
    if (!path) paths.set(b, (path = new Path2D()));
    const [x1, y1] = project(f * dims * 2);
    const [x2, y2] = project(f * dims * 2 + dims);
    path.moveTo(x1, y1);
    path.lineTo(x2, y2);
  }
  ctx.lineCap = "round";
  ctx.lineWidth = (data.edgeCount > 8000 ? 0.7 : data.edgeCount > 1500 ? 1.1 : 2.4) * dpr;
  for (const [b, path] of [...paths.entries()].sort((a, z) => a[0] - z[0])) {
    ctx.strokeStyle = paletteCss[b] ?? "#fff";
    ctx.stroke(path);
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  data: Prepared,
  view: View,
  progress: number,
  dpr: number
): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (data.kind === "2d") {
    const total = data.shapes.length;
    draw2D(ctx, W, H, data, view, progress >= 1 ? total : Math.ceil(total * progress), dpr);
  } else if (data.kind === "3d") {
    draw3D(ctx, W, H, data, view, 0.25 + 0.75 * easeOutBack(progress), dpr);
  } else {
    drawND(ctx, W, H, data, view, 0.25 + 0.75 * easeOutBack(progress), dpr);
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
const levelEl = $<HTMLInputElement>("level-number");
const countEl = $("shape-count");
const noteEl = $("depth-note");
const levelDown = $<HTMLButtonElement>("level-down");
const levelUp = $<HTMLButtonElement>("level-up");
const levelSlider = $<HTMLInputElement>("level-slider");
const paletteSelect = $<HTMLSelectElement>("palette-select");
const spinButton = $<HTMLButtonElement>("spin-button");
const diveButton = $<HTMLButtonElement>("dive-button");
const builderEl = $("builder");
const boomText = $("boom-text");
const soundButton = $<HTMLButtonElement>("sound-button");

const DEFAULT_VIEW = (): View => ({
  zoom: 1,
  panX: 0,
  panY: 0,
  yaw: 0.65,
  pitch: -0.5,
  spin4: 0.4,
});
let view = DEFAULT_VIEW();
// The infinite-zoom view for square-grid fractals. Made fresh when needed.
let deepView: DeepView | null = null;
let growFrom = 0;
let dive: Dive | null = null;
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
  return Math.max(f.minLevel, Math.min(BIGGEST_LEVEL, Math.floor(value)));
}

// There's no top level. But past `maxLevel` the shapes get smaller than one
// dot on the screen (and there'd be more of them than the computer has
// memory for), so the picture shows the deepest level it can draw, while the
// level and the count keep going up forever.
const BIGGEST_LEVEL = Number.MAX_SAFE_INTEGER;

function drawLevel(f: Fractal, l: number): number {
  if (l <= f.maxLevel) return l;
  const period = f.period ?? 1;
  const d = f.maxLevel - ((((f.maxLevel - l) % period) + period) % period);
  return d >= f.minLevel ? d : f.maxLevel;
}

function formatCount(log: number): string {
  if (!Number.isFinite(log)) return "0";
  if (log < 15) return Math.round(10 ** log).toLocaleString();
  const exp = Math.floor(log);
  return `${(10 ** (log - exp)).toFixed(1)} × 10^${exp.toLocaleString()}`;
}

function countOf(d: Prepared): number {
  // Plain-ink shapes (like the golden spiral) are extras, not part of the count.
  if (d.kind === "2d") return d.shapes.filter((s) => s.c >= 0).length;
  return d.kind === "3d" ? d.cubeCount : d.cells;
}

// The tree-shaped ones grow fresh branches as you zoom in.
const liveDepth = (): number => Math.min(level, fractal.maxLevel);
const LIVE: Record<string, LiveSpec> = {
  tree: treeLive(liveDepth),
  "h-tree": hTreeLive(liveDepth),
  pythagoras: pythagorasLive(),
  "t-square": tSquareLive(),
  cantor: cantorLive(),
  golden: goldenLive(),
};
const liveSpec = (): LiveSpec | undefined => LIVE[fractal.id];

// The line fractals swap lines for zig-zags as you zoom in.
const CURVES: Record<string, Curve> = {
  koch: edgeCurve("F--F--F", { F: "F+F--F+F" }, 60, "F"),
  "square-koch": edgeCurve("F", { F: "F+F-F-F+F" }, 90, "F"),
  minkowski: edgeCurve("F+F+F+F", { F: "F+F-F-FF+F+F-F" }, 90, "F"),
  dragon: edgeCurve("F", { F: "F+G", G: "F-G" }, 90, "FG", true),
  levy: edgeCurve("F", { F: "+F--F+" }, 45, "F"),
  peano: peanoCurve(),
  arrowhead: edgeCurve("A", { A: "B-A-B", B: "A+B+A" }, 60, "AB"),
  gosper: edgeCurve("A", { A: "A-B--B+A++AA+B-", B: "+A-BB--B-A++A+B" }, 60, "AB", true),
  hilbert: hilbertCurve(),
};
const curve = (): Curve | undefined => CURVES[fractal.id];
// Every fractal that draws itself fresh each frame so you can zoom forever.
// 3D ones (other than the sponges with tunnel faces) split into smaller cubes.
const cubeGrid = (): { n: number; keep: (i: number, j: number, k: number) => boolean } | undefined =>
  fractal.kind === "3d" && !fractal.faceHoles ? fractal.grid3 : undefined;
const hyperGrid = (): { n: number; keep: (p: number[]) => boolean } | undefined =>
  fractal.kind === "nd" ? fractal.gridN : undefined;
const zoomsForever = (): boolean =>
  deepSpec() !== undefined ||
  liveSpec() !== undefined ||
  curve() !== undefined ||
  cubeGrid() !== undefined ||
  hyperGrid() !== undefined;

function deepSpec(): { n: number; keep: (i: number, j: number) => boolean } | undefined {
  return fractal.kind === "2d" ? fractal.grid2 : undefined;
}

// Levels of tiny holes painted onto the 3D faces past the deepest cube level.
function extraDetail(): number {
  return fractal.kind === "3d" && fractal.faceHoles ? Math.max(0, Math.min(40, level - fractal.maxLevel)) : 0;
}

function resetView(): void {
  view = DEFAULT_VIEW();
  deepView = null;
  stopDive();
  dirty = true;
}

function stopDive(): void {
  dive = null;
  diveButton.classList.remove("is-on");
  diveButton.textContent = "🚀 Dive";
}

function refresh(regrow: boolean): void {
  level = currentLevel(fractal);
  // Infinite-zoom fractals draw themselves straight from the rule, so they
  // only need a tiny ready-made copy.
  data = prepare(
    fractal,
    deepSpec() || curve() || cubeGrid() || hyperGrid()
      ? fractal.minLevel
      : liveSpec()
        ? Math.min(level, 8, fractal.maxLevel)
        : drawLevel(fractal, level)
  );
  if (document.activeElement !== levelEl) levelEl.value = String(level);
  const digits = String(level).length;
  levelEl.style.fontSize = digits > 9 ? "11px" : digits > 6 ? "14px" : "";
  levelEl.style.width = `${Math.max(2, digits) + 1.5}ch`;
  levelSlider.min = String(fractal.minLevel);
  levelSlider.max = String(Math.max(fractal.maxLevel + 10, level));
  levelSlider.value = String(level);
  levelDown.disabled = level <= fractal.minLevel;
  const beyond = level > fractal.maxLevel;
  const count = countOf(data);
  const log = beyond || zoomsForever() ? fractal.log10Count(level) : Math.log10(count);
  const unit = Math.abs(log) < 1e-9 ? fractal.unit.replace(/s$/, "") : fractal.unit;
  countEl.textContent =
    fractal.id === BUILDER_ID && builderKept() === 0 ? "Click some squares up there!" : `${formatCount(log)} ${unit}`;
  const note = deepSpec()
    ? level > 3
      ? "🔍 Zoom in forever! Scroll or pinch to see all the levels."
      : ""
    : liveSpec() && level > 8
      ? fractal.id === "cantor" || fractal.id === "golden"
        ? "🔍 Zoom in forever! It keeps going smaller and smaller."
        : "🔍 Zoom into the tips and new branches keep growing!"
      : curve() && level > 6
        ? "🔍 Zoom in forever! The lines keep getting wigglier."
        : (cubeGrid() || hyperGrid()) && level > fractal.maxLevel
          ? "🔍 Zoom in and the cubes keep splitting forever!"
      : extraDetail() > 0
        ? "🔍 Zoom in to see the tiny holes on every face."
        : beyond
          ? `🔬 Too tiny to see past level ${fractal.maxLevel}, but it keeps going!`
          : "";
  noteEl.textContent = note;
  noteEl.hidden = !note;
  nameEl.textContent = fractal.name;
  blurbEl.textContent = fractal.blurb;
  spinButton.hidden = fractal.kind === "2d";
  diveButton.hidden = !deepSpec();
  spinButton.classList.toggle("is-on", spinning);
  builderEl.hidden = fractal.id !== BUILDER_ID;
  if (regrow) {
    growStart = performance.now();
    growTime = data.kind !== "2d" ? 650 : Math.min(1600, 450 + Math.log2(count + 1) * 80);
    if (beyond && !zoomsForever()) growTime = 350;
  }
  dirty = true;
}

function setLevel(next: number): void {
  if (!Number.isFinite(next)) return;
  const clamped = Math.max(fractal.minLevel, Math.min(BIGGEST_LEVEL, Math.floor(next)));
  if (clamped === level) {
    levelEl.value = String(level);
    return;
  }
  const before = level;
  const goingUp = clamped > level;
  save.levels[fractal.id] = clamped;
  writeSave();
  // Past the deepest drawable level the picture doesn't change, so don't regrow it.
  growFrom = before;
  refresh(
    goingUp &&
      (deepSpec() !== undefined ||
        zoomsForever() ||
        extraDetail() > 0 ||
        drawLevel(fractal, clamped) !== drawLevel(fractal, before))
  );
  // BOOM when you go past what the screen can show, and at every 10th level.
  if (goingUp && before <= fractal.maxLevel && clamped > fractal.maxLevel) boom("INFINITE MODE!");
  else if (goingUp && Math.floor(clamped / 10) > Math.floor(before / 10)) boom(`LEVEL ${clamped.toLocaleString()}!`);
  else levelBlip(Math.min(clamped, 16), goingUp);
}

function choose(id: string): void {
  save.fractalId = id;
  writeSave();
  fractal = fractalById(id);
  resetView();
  growFrom = 0;
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
  deepView = null;
  growFrom = 0;
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
  resetView();
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
levelSlider.addEventListener("input", () => setLevel(Number(levelSlider.value)));
// Click the number and type any level you want.
levelEl.addEventListener("change", () => setLevel(Number(levelEl.value)));
levelEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") levelEl.blur();
});
levelEl.addEventListener("blur", () => setLevel(Number(levelEl.value)));

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

const regrowAll = (): void => {
  growFrom = 0;
  refresh(true);
};
$("grow-button").addEventListener("click", regrowAll);
$("reset-button").addEventListener("click", resetView);
diveButton.addEventListener("click", () => {
  const spec = deepSpec();
  if (!spec || dive) {
    stopDive();
    return;
  }
  deepView ??= freshDeepView(canvas.width, canvas.height);
  dive = startDive(deepView, spec, level);
  diveButton.classList.add("is-on");
  diveButton.textContent = "🛑 Stop";
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
  render(1);
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
  if (target?.tagName === "SELECT" || target?.tagName === "INPUT") return;
  if (event.key === "ArrowUp" || event.key === "ArrowRight" || event.key === "+" || event.key === "=") {
    event.preventDefault();
    setLevel(level + 1);
  } else if (event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "-") {
    event.preventDefault();
    setLevel(level - 1);
  } else if (event.key === "g" || event.key === "G") regrowAll();
  else if (event.key === "r" || event.key === "R") resetView();
});

// ---------- dragging, zooming and spinning ----------

const pointers = new Map<number, { x: number; y: number }>();
let pinchDistance = 0;

function zoomAt(factor: number, clientX: number, clientY: number): void {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * dpr - canvas.width / 2;
  const py = (clientY - rect.top) * dpr - canvas.height / 2;
  const spec = deepSpec();
  if (spec) {
    deepView ??= freshDeepView(canvas.width, canvas.height);
    deepZoom(deepView, factor, px, py, spec.n, canvas.width, canvas.height);
    dirty = true;
    return;
  }
  const next = Math.max(0.2, Math.min(zoomsForever() ? 1e12 : 1e6, view.zoom * factor));
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
    stopDive();
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
  },
  { passive: false }
);

canvas.addEventListener("pointerdown", (event) => {
  stopDive();
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
  if (fractal.kind !== "2d" && !event.shiftKey) {
    view.yaw += dx * 0.01;
    view.pitch = Math.max(-1.5, Math.min(1.5, view.pitch - dy * 0.01));
  } else {
    const spec = deepSpec();
    if (spec) {
      deepView ??= freshDeepView(canvas.width, canvas.height);
      deepPan(deepView, dx * dpr, dy * dpr, spec.n, canvas.width, canvas.height);
    } else {
      view.panX += dx * dpr;
      view.panY += dy * dpr;
    }
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

// Draw the big picture, whichever way this fractal needs.
function render(progress: number): void {
  const W = canvas.width;
  const H = canvas.height;
  const spec = deepSpec();
  if (spec) {
    deepView ??= freshDeepView(W, H);
    const stop = 3 * dpr;
    // Growing: the levels appear one at a time, from where you were.
    const deepest = Math.min(level, visibleDepth(deepView, spec.n, stop));
    const start = Math.min(growFrom, deepest);
    const growDepth = progress >= 1 ? Infinity : start + Math.floor(progress * (deepest - start + 1));
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawDeep(ctx, W, H, spec, level, deepView, paletteCss, stop, growDepth, dpr);
    return;
  }
  const cubes = cubeGrid();
  const hyper = hyperGrid();
  if ((cubes || hyper) && fractal.kind !== "2d") {
    const top = Math.min(level, 10);
    const start = Math.min(growFrom, top);
    const growDepth = progress >= 1 ? Infinity : start + Math.floor(progress * (top - start + 1));
    const grow = 0.25 + 0.75 * easeOutBack(Math.min(1, progress * 2));
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (cubes) drawCubesLod(ctx, W, H, cubes, level, view, grow, growDepth, paletteRgb, dpr);
    else if (hyper && fractal.kind === "nd")
      drawHypercubesLod(ctx, W, H, fractal.dims, hyper, level, view, grow, growDepth, paletteCss, dpr);
    return;
  }
  const wiggle = curve();
  if (wiggle) {
    const { minX, minY, maxX, maxY } = wiggle.bounds(level);
    const pad = Math.min(W, H) * 0.06;
    const fit = Math.min((W - pad * 2) / Math.max(1e-9, maxX - minX), (H - pad * 2) / Math.max(1e-9, maxY - minY));
    const scale = fit * view.zoom;
    const ox = W / 2 + view.panX - ((minX + maxX) / 2) * scale;
    const oy = H / 2 + view.panY - ((minY + maxY) / 2) * scale;
    const top = Math.min(level, 16);
    const start = Math.min(growFrom, top);
    const growDepth = progress >= 1 ? Infinity : start + Math.floor(progress * (top - start + 1));
    const paths = new Map<number, Path2D>();
    let segments = 0;
    const stopPx = 4 * dpr * curveCoarse;
    // Colours cycle faster the further you zoom, so there's always a rainbow.
    const cycles = Math.max(1, view.zoom) ** (wiggle.fills ? 2 : 1);
    const tri = (t: number): number => 1 - Math.abs((((t % 2) + 2) % 2) - 1);
    wiggle.draw(
      level,
      (x) => ox + x * scale,
      (y) => oy + y * scale,
      scale,
      W,
      H,
      (x0, y0, x1, y1, t) => {
        const b = Math.round(tri(Math.max(0, Math.min(1, t)) * cycles) * BUCKETS);
        let path = paths.get(b);
        if (!path) paths.set(b, (path = new Path2D()));
        path.moveTo(ox + x0 * scale, oy + y0 * scale);
        path.lineTo(ox + x1 * scale, oy + y1 * scale);
        segments++;
      },
      growDepth,
      stopPx
    );
    // Too many lines to draw smoothly? Draw a bit less detail next frame
    // (and creep back toward full detail when there's room).
    if (segments > 120000) {
      curveCoarse *= 1.4;
      dirty = true;
    } else if (segments < 30000 && curveCoarse > 1) curveCoarse = Math.max(1, curveCoarse / 1.2);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = (segments > 6000 ? 1 : segments > 1200 ? 1.6 : 2.6) * dpr;
    for (const [b, path] of [...paths.entries()].sort((p, q) => p[0] - q[0])) {
      ctx.strokeStyle = paletteCss[b] ?? "#fff";
      ctx.stroke(path);
    }
    return;
  }
  const live = liveSpec();
  if (live && data.kind === "2d") {
    const { minX, minY, maxX, maxY } = data.bounds;
    const pad = Math.min(W, H) * 0.06;
    const fit = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY));
    const scale = fit * view.zoom;
    const ox = W / 2 + view.panX - ((minX + maxX) / 2) * scale;
    const oy = H / 2 + view.panY - ((minY + maxY) / 2) * scale;
    const top = Math.min(level, 22);
    const start = Math.min(growFrom, top);
    const growDepth = progress >= 1 ? Infinity : start + Math.floor(progress * (top - start + 1));
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawLive(
      ctx,
      W,
      H,
      live,
      level,
      liveDepth(),
      (x) => ox + x * scale,
      (y) => oy + y * scale,
      scale,
      paletteCss,
      growDepth,
      1.3 * dpr * Math.min(3, Math.pow(view.zoom, 0.25))
    );
    return;
  }
  if (data.kind === "3d" && extraDetail() > 0) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    draw3D(ctx, W, H, data, view, 0.25 + 0.75 * easeOutBack(progress), dpr, extraDetail());
    return;
  }
  paint(ctx, W, H, data, view, progress, dpr);
}

let curveCoarse = 1;
let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const progress = Math.min(1, (now - growStart) / growTime);
  const growing = progress < 1;
  const turning = fractal.kind !== "2d" && spinning && pointers.size === 0;
  if (turning) {
    if (fractal.kind === "nd") view.spin4 += dt * 0.55;
    view.yaw += dt * (fractal.kind === "nd" ? 0.12 : 0.35);
  }
  const spec = deepSpec();
  if (dive && spec && deepView) {
    diveStep(deepView, dive, spec, dt, canvas.width, canvas.height);
    dirty = true;
  }
  if (dirty || growing || turning) {
    render(progress);
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
