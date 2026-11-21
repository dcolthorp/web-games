// Zoom-forever drawing for the 3D cube fractals and the hypercubes.
//
// Instead of building every little cube ahead of time, start with one big
// cube and only split the cubes you can see, until they're about as small as
// a few dots on the screen (or there'd be too many to draw smoothly). Zoom in
// and the cubes in front of you keep splitting.

export interface View3 {
  zoom: number;
  panX: number;
  panY: number;
  yaw: number;
  pitch: number;
  spin4: number;
}

const tri = (t: number): number => 1 - Math.abs((((t % 2) + 2) % 2) - 1);

// The 6 ways a cube face can point: +x, -x, +y, -y, +z, -z.
const NORMALS: [number, number, number][] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const LIGHT = (() => {
  const v = [-0.45, 0.75, -0.55];
  const len = Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
  return v.map((n) => n / len) as [number, number, number];
})();

interface Cell3 {
  x: number;
  y: number;
  z: number;
  s: number;
  d: number;
}

export function drawCubesLod(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  grid: { n: number; keep: (i: number, j: number, k: number) => boolean },
  level: number,
  view: View3,
  grow: number,
  growDepth: number,
  palette: [number, number, number][],
  dpr: number
): number {
  const n = grid.n;
  const kept: [number, number, number][] = [];
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (grid.keep(i, j, k)) kept.push([i, j, k]);

  const cosY = Math.cos(view.yaw);
  const sinY = Math.sin(view.yaw);
  const cosP = Math.cos(view.pitch);
  const sinP = Math.sin(view.pitch);
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    return [x1, y * cosP - z1 * sinP, y * sinP + z1 * cosP];
  };
  const scale = Math.min(W, H) * 0.56 * view.zoom * grow;
  const cx = W / 2 + view.panX;
  const cy = H / 2 + view.panY;
  const toScreen = (x: number, y: number, z: number): [number, number, number] => {
    const [a, b, c] = rot(x, y, z);
    return [cx + a * scale, cy - b * scale, c];
  };

  // Split cubes level by level, only the ones on the screen.
  const limit = Math.min(level, growDepth);
  const budget = 7000;
  const stop = 7 * dpr;
  const leaves: Cell3[] = [];
  let layer: Cell3[] = [{ x: -0.5, y: -0.5, z: -0.5, s: 1, d: 0 }];
  while (layer.length) {
    const next: Cell3[] = [];
    for (const c of layer) {
      const h = c.s / 2;
      const [sx, sy] = toScreen(c.x + h, c.y + h, c.z + h);
      const r = c.s * 0.87 * scale;
      if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) continue;
      if (c.d >= limit || r < stop) {
        leaves.push(c);
        continue;
      }
      const sub = c.s / n;
      for (const [i, j, k] of kept) next.push({ x: c.x + i * sub, y: c.y + j * sub, z: c.z + k * sub, s: sub, d: c.d + 1 });
    }
    if (leaves.length + next.length > budget) {
      // Out of room: whatever's left gets drawn as solid cubes.
      for (const c of layer) {
        const h = c.s / 2;
        const [sx, sy] = toScreen(c.x + h, c.y + h, c.z + h);
        const r = c.s * 0.87 * scale;
        if (sx + r < 0 || sx - r > W || sy + r < 0 || sy - r > H) continue;
        if (!(c.d >= limit || r < stop)) leaves.push(c);
      }
      break;
    }
    layer = next;
  }

  // Far cubes first, so near ones cover them.
  const depth = leaves.map((c) => toScreen(c.x + c.s / 2, c.y + c.s / 2, c.z + c.s / 2)[2]);
  const order = leaves.map((_, i) => i).sort((a, b) => (depth[b] ?? 0) - (depth[a] ?? 0));

  const faces: { normal: [number, number, number]; light: number }[] = [];
  for (const normal of NORMALS) {
    const [rx, ry, rz] = rot(...normal);
    if (rz < 0) faces.push({ normal, light: 0.32 + 0.68 * Math.max(0, rx * LIGHT[0] + ry * LIGHT[1] + rz * LIGHT[2]) });
  }

  const cycles = Math.max(1, view.zoom);
  const edges = leaves.length < 1500;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, 0.8 * dpr);
  ctx.strokeStyle = "rgba(10, 5, 20, 0.35)";
  for (const index of order) {
    const c = leaves[index];
    if (!c) continue;
    const mid = (c.x + c.y + c.z + 1.5 * c.s) / 3 + 0.5;
    const rgb = palette[Math.round(tri(mid * cycles) * (palette.length - 1))] ?? [255, 255, 255];
    for (const { normal, light } of faces) {
      const axis = normal[0] !== 0 ? 0 : normal[1] !== 0 ? 1 : 2;
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const base = [c.x, c.y, c.z];
      if ((normal[axis] ?? 0) > 0) base[axis] = (base[axis] ?? 0) + c.s;
      ctx.beginPath();
      for (const [du, dv] of [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as const) {
        const p = [...base];
        p[u] = (p[u] ?? 0) + du * c.s;
        p[v] = (p[v] ?? 0) + dv * c.s;
        const [sx, sy] = toScreen(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0);
        if (du === 0 && dv === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = `rgb(${Math.round(rgb[0] * light)},${Math.round(rgb[1] * light)},${Math.round(rgb[2] * light)})`;
      ctx.fill();
      if (edges) ctx.stroke();
    }
  }
  return leaves.length;
}

// ---------- hypercubes ----------

// Turns a point in `dims` directions into a spot on the screen. Same as how
// the hypercubes were always drawn: the 4th direction gets perspective, and
// 5th and up each get their own slanted arrow in 3D.
function projector(dims: number, view: View3, W: number, H: number, grow: number): (p: number[]) => [number, number] {
  const cosY = Math.cos(view.yaw);
  const sinY = Math.sin(view.yaw);
  const cosP = Math.cos(view.pitch);
  const sinP = Math.sin(view.pitch);
  const scale = (Math.min(W, H) * 0.36 * view.zoom * grow) / (dims === 4 ? 1 : Math.sqrt((dims - 2) / 1.5));
  const cx = W / 2 + view.panX;
  const cy = H / 2 + view.panY;
  const eye = 2.4;
  const a4 = view.spin4 + 3;
  const ca = Math.cos(a4);
  const sa = Math.sin(a4);
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
  return (p) => {
    let X = 0;
    let Y = 0;
    let Z = 0;
    if (dims === 4) {
      const x = p[0] ?? 0;
      const w = p[3] ?? 0;
      const x1 = x * ca - w * sa;
      const w1 = x * sa + w * ca;
      const k = eye / (eye - Math.max(-eye, Math.min(eye * 0.6, w1)));
      X = x1 * k;
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
}

interface CellN {
  o: number[];
  s: number;
  d: number;
}

export function drawHypercubesLod(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dims: number,
  grid: { n: number; keep: (p: number[]) => boolean },
  level: number,
  view: View3,
  grow: number,
  growDepth: number,
  colors: string[],
  dpr: number
): void {
  const n = grid.n;
  const kept: number[][] = [];
  for (let index = 0; index < n ** dims; index++) {
    const p: number[] = [];
    let rest = index;
    for (let a = 0; a < dims; a++) {
      p.push(rest % n);
      rest = Math.floor(rest / n);
    }
    if (grid.keep(p)) kept.push(p);
  }
  const project = projector(dims, view, W, H, grow);
  const pxPerUnit = Math.min(W, H) * 0.36 * view.zoom * grow;
  const edgesPerCell = dims * 2 ** (dims - 1);
  const budget = Math.max(1, Math.floor(100000 / edgesPerCell));
  const stop = 10 * dpr;
  const limit = Math.min(level, growDepth);

  const centerOf = (c: CellN): number[] => c.o.map((x) => x + c.s / 2);
  const leaves: CellN[] = [];
  let layer: CellN[] = [{ o: new Array<number>(dims).fill(-0.5), s: 1, d: 0 }];
  const visible = (c: CellN): { ok: boolean; small: boolean } => {
    const [sx, sy] = project(centerOf(c));
    const r = c.s * Math.sqrt(dims) * 0.5 * pxPerUnit * 2.2;
    return { ok: sx + r > 0 && sx - r < W && sy + r > 0 && sy - r < H, small: r < stop };
  };
  while (layer.length) {
    const next: CellN[] = [];
    for (const c of layer) {
      const { ok, small } = visible(c);
      if (!ok) continue;
      if (c.d >= limit || small) {
        leaves.push(c);
        continue;
      }
      const sub = c.s / n;
      for (const k of kept) next.push({ o: c.o.map((x, a) => x + (k[a] ?? 0) * sub), s: sub, d: c.d + 1 });
    }
    if (leaves.length + next.length > budget) {
      for (const c of layer) {
        const { ok, small } = visible(c);
        if (ok && !(c.d >= limit || small)) leaves.push(c);
      }
      break;
    }
    layer = next;
  }

  // Each little hypercube is a wireframe: every corner joined to the corners
  // one step away along each direction.
  const tri2 = (t: number): number => 1 - Math.abs((((t % 2) + 2) % 2) - 1);
  const cycles = Math.max(1, view.zoom);
  const paths = new Map<number, Path2D>();
  const corners = 2 ** dims;
  const pts: [number, number][] = new Array(corners);
  for (const c of leaves) {
    for (let k = 0; k < corners; k++) pts[k] = project(c.o.map((x, a) => x + ((k >> a) & 1) * c.s));
    const mid = centerOf(c);
    const t = (mid.reduce((sum, x) => sum + x, 0) / dims + 0.5) * 0.5 + ((mid[dims - 1] ?? 0) + 0.5) * 0.5;
    const b = Math.round(tri2(t * cycles) * (colors.length - 1));
    let path = paths.get(b);
    if (!path) paths.set(b, (path = new Path2D()));
    for (let k = 0; k < corners; k++) {
      for (let a = 0; a < dims; a++) {
        if ((k >> a) & 1) continue;
        const p = pts[k];
        const q = pts[k | (1 << a)];
        if (!p || !q) continue;
        path.moveTo(p[0], p[1]);
        path.lineTo(q[0], q[1]);
      }
    }
  }
  const total = leaves.length * edgesPerCell;
  ctx.lineCap = "round";
  ctx.lineWidth = (total > 8000 ? 0.7 : total > 1500 ? 1.1 : 2.4) * dpr;
  for (const [b, path] of [...paths.entries()].sort((p, q) => p[0] - q[0])) {
    ctx.strokeStyle = colors[b] ?? "#fff";
    ctx.stroke(path);
  }
}
