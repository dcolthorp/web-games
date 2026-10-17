// A tiny 3D drawer for the things in the boxes: no engine, just Canvas 2D.
// Models are built out of simple shapes (blocks, balls, cylinders, cones,
// rings, roofs). Each frame every face gets spun, shaded by a light from the
// upper left, and filled in pixel by pixel, keeping whichever is closest.

export type Vec3 = [number, number, number];
export type Shape = "box" | "sphere" | "cylinder" | "cone" | "torus" | "roof";

export interface Part {
  s: Shape;
  p: Vec3; // where its middle is
  k: Vec3; // how big it is (full width, height, depth)
  c: string; // colour
  r?: Vec3; // turn it around x, then y, then z (radians)
  n?: number; // how many sides round shapes get
  t?: number; // ring thickness for a torus, 0..1
}

interface Face {
  pts: Vec3[];
  rgb: Vec3;
}

export interface Built {
  faces: Face[];
  // How the parts were centred and shrunk, so points can be found on screen.
  mid: Vec3;
  radius: number;
  lo: Vec3;
  hi: Vec3;
}

type Poly = Vec3[];

const meshCache = new Map<string, Poly[]>();

function unitMesh(s: Shape, n: number, t: number): Poly[] {
  const key = `${s}:${n}:${t}`;
  const cached = meshCache.get(key);
  if (cached) return cached;
  const polys: Poly[] = [];
  const h = 0.5;
  if (s === "box") {
    const v = (x: number, y: number, z: number): Vec3 => [x * h, y * h, z * h];
    polys.push(
      [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)],
      [v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)],
      [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)],
      [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)],
      [v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)],
      [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)],
    );
  } else if (s === "sphere") {
    const lat = Math.max(4, Math.round(n * 0.6));
    const at = (i: number, j: number): Vec3 => {
      const a = (i / lat) * Math.PI;
      const b = (j / n) * Math.PI * 2;
      return [Math.sin(a) * Math.cos(b) * h, Math.cos(a) * h, Math.sin(a) * Math.sin(b) * h];
    };
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < n; j++) polys.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
    }
  } else if (s === "cylinder" || s === "cone") {
    const ring = (y: number, r: number): Vec3[] =>
      Array.from({ length: n }, (_, j) => {
        const b = (j / n) * Math.PI * 2;
        return [Math.cos(b) * r, y, Math.sin(b) * r] as Vec3;
      });
    const bottom = ring(-h, h);
    if (s === "cylinder") {
      const top = ring(h, h);
      for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        polys.push([bottom[j]!, bottom[k]!, top[k]!, top[j]!]);
      }
      polys.push(top);
    } else {
      for (let j = 0; j < n; j++) polys.push([bottom[j]!, bottom[(j + 1) % n]!, [0, h, 0]]);
    }
    polys.push(bottom);
  } else if (s === "torus") {
    const tube = t * h;
    const big = h - tube;
    const m = 8;
    const at = (i: number, j: number): Vec3 => {
      const a = (i / n) * Math.PI * 2;
      const b = (j / m) * Math.PI * 2;
      const r = big + Math.cos(b) * tube;
      return [Math.cos(a) * r, Math.sin(b) * tube, Math.sin(a) * r];
    };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) polys.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
    }
  } else {
    // roof: a triangle-shaped tent, flat on the bottom.
    const a: Vec3 = [-h, -h, -h], b: Vec3 = [h, -h, -h], c: Vec3 = [0, h, -h];
    const d: Vec3 = [-h, -h, h], e: Vec3 = [h, -h, h], f: Vec3 = [0, h, h];
    polys.push([a, b, c], [d, f, e], [a, c, f, d], [b, e, f, c], [a, d, e, b]);
  }
  meshCache.set(key, polys);
  return polys;
}

function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

function hexToRgb(hex: string): Vec3 {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface Face3 {
  pts: Vec3[];
  rgb: Vec3;
}

/** Every face of every part, right where the parts say (not centred or shrunk): for whole worlds. */
export function worldFaces(parts: Part[]): Face3[] {
  const faces: Face3[] = [];
  for (const part of parts) {
    const n = part.n ?? (part.s === "torus" ? 16 : 14);
    const rgb = hexToRgb(part.c);
    const [rx, ry, rz] = part.r ?? [0, 0, 0];
    for (const poly of unitMesh(part.s, n, part.t ?? 0.35)) {
      faces.push({
        rgb,
        pts: poly.map((v) => {
          let w: Vec3 = [v[0] * part.k[0], v[1] * part.k[1], v[2] * part.k[2]];
          if (rx) w = rotX(w, rx);
          if (ry) w = rotY(w, ry);
          if (rz) w = rotZ(w, rz);
          return [w[0] + part.p[0], w[1] + part.p[1], w[2] + part.p[2]];
        }),
      });
    }
  }
  return faces;
}

/**
 * Puts all the parts together, centred and shrunk to fit inside a ball of
 * size 1. Pass `like` to centre and shrink exactly the same way as another
 * model, so the two line up (a dollhouse with and without its front wall).
 */
export function buildModel(parts: Part[], like?: Built): Built {
  const faces = worldFaces(parts);
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    for (const v of f.pts) {
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i]!, v[i]!);
        hi[i] = Math.max(hi[i]!, v[i]!);
      }
    }
  }
  const mid: Vec3 = like ? like.mid : [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let radius = like ? like.radius : 0.001;
  if (!like) {
    for (const f of faces) {
      for (const v of f.pts) radius = Math.max(radius, Math.hypot(v[0] - mid[0], v[1] - mid[1], v[2] - mid[2]));
    }
  }
  for (const f of faces) {
    f.pts = f.pts.map((v) => [(v[0] - mid[0]) / radius, (v[1] - mid[1]) / radius, (v[2] - mid[2]) / radius]);
  }
  return { faces, mid, radius, lo, hi };
}

/** Where a point of the model (in the units it was built in) lands on screen, for drawModel with the same numbers. */
export function projectPoint(
  model: Built,
  p: Vec3,
  cx: number,
  cy: number,
  size: number,
  yaw: number,
  pitch = -0.4,
): [number, number] {
  const v: Vec3 = [(p[0] - model.mid[0]) / model.radius, (p[1] - model.mid[1]) / model.radius, (p[2] - model.mid[2]) / model.radius];
  const w = rotX(rotY(v, yaw), pitch);
  const z = w[2] + CAMERA;
  const f = size * CAMERA;
  return [cx + (w[0] * f) / z, cy - (w[1] * f) / z];
}

const CAMERA = 3.4;
const LIGHT: Vec3 = (() => {
  const l: Vec3 = [-0.5, 0.8, -0.7];
  const len = Math.hypot(...l);
  return [l[0] / len, l[1] / len, l[2] / len];
})();

// Pixels are worked out at 2x and shrunk down, which smooths the edges.
const SUPER = 2;
const scratch = document.createElement("canvas");
const scratchCtx = scratch.getContext("2d")!;
let image: ImageData | null = null;
let depth = new Float32Array(0);

/**
 * Draws a built model with its middle at (cx, cy), `size` pixels from middle
 * to edge. Every pixel remembers how close it is, so shapes that poke into
 * each other (like hair on a head) always show the right one in front.
 */
export function drawModel(
  ctx: CanvasRenderingContext2D,
  model: Built,
  cx: number,
  cy: number,
  size: number,
  yaw: number,
  pitch = -0.4,
): void {
  if (size < 1) return;
  const reach = Math.ceil(size * 1.5);
  const dim = reach * 2 * SUPER;
  if (scratch.width < dim || scratch.height < dim) {
    scratch.width = scratch.height = dim;
    image = null;
  }
  if (!image || image.width !== scratch.width) {
    image = scratchCtx.createImageData(scratch.width, scratch.height);
    depth = new Float32Array(scratch.width * scratch.height);
  }
  const W = image.width;
  const px = image.data;
  for (let y = 0; y < dim; y++) {
    px.fill(0, y * W * 4, (y * W + dim) * 4);
    depth.fill(Infinity, y * W, y * W + dim);
  }

  const f = size * CAMERA * SUPER;
  const half = dim / 2;
  for (const face of model.faces) {
    const pts = face.pts.map((v) => {
      const w = rotX(rotY(v, yaw), pitch);
      return [w[0], w[1], w[2] + CAMERA] as Vec3;
    });
    // Which way the face points (Newell's method), flipped to face us.
    let nx = 0, ny = 0, nz = 0, mx = 0, my = 0, mz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
      mx += a[0];
      my += a[1];
      mz += a[2];
    }
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;
    if (nx * mx + ny * my + nz * mz > 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const light = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len);
    const shade = 0.45 + 0.6 * light;
    const r = Math.min(255, face.rgb[0] * shade);
    const g = Math.min(255, face.rgb[1] * shade);
    const b = Math.min(255, face.rgb[2] * shade);
    const screen = pts.map(([x, y, z]) => [half + (x * f) / z, half - (y * f) / z, z] as Vec3);
    for (let i = 1; i < screen.length - 1; i++) {
      fillTriangle(screen[0]!, screen[i]!, screen[i + 1]!, r, g, b, px, W, dim);
    }
  }
  scratchCtx.putImageData(image, 0, 0, 0, 0, dim, dim);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scratch, 0, 0, dim, dim, cx - reach, cy - reach, reach * 2, reach * 2);
  ctx.restore();
}

function fillTriangle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  r: number,
  g: number,
  bl: number,
  px: Uint8ClampedArray,
  W: number,
  dim: number,
): void {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-6) return;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(dim - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(dim - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    const sy = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const sx = x + 0.5;
      const w0 = ((c[0] - b[0]) * (sy - b[1]) - (c[1] - b[1]) * (sx - b[0])) * inv;
      const w1 = ((a[0] - c[0]) * (sy - c[1]) - (a[1] - c[1]) * (sx - c[0])) * inv;
      const w2 = 1 - w0 - w1;
      // A hair of slack so neighbouring triangles never leave a crack.
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const i = y * W + x;
      if (z >= depth[i]!) continue;
      depth[i] = z;
      const o = i * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = bl;
      px[o + 3] = 255;
    }
  }
}
