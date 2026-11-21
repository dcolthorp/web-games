// Infinite zoom for the square-grid fractals (Sierpinski Carpet, Vicsek,
// Cantor Dust, Staircase Triangle and flat "Your Fractal"s).
//
// Normal numbers run out of detail after zooming in about a trillion times.
// So instead the view remembers *which little square* you're zoomed into, as
// a giant whole number (a BigInt, which can have as many digits as it wants),
// plus where you are inside that one square. Zoom in far enough and it hops
// down into the next smaller square; zoom out and it hops back up. You can
// keep going forever.

export interface GridSpec {
  n: number;
  keep: (i: number, j: number) => boolean;
}

export interface DeepView {
  k: number; // how many levels deep the anchor square is
  X: bigint; // which square across, out of n^k
  Y: bigint; // which square down
  fx: number; // where the middle of the screen is inside that square (0..1)
  fy: number;
  cellPx: number; // how big that square is on the screen
}

export function freshDeepView(W: number, H: number): DeepView {
  return { k: 0, X: 0n, Y: 0n, fx: 0.5, fy: 0.5, cellPx: fitPx(W, H) };
}

function fitPx(W: number, H: number): number {
  return Math.min(W, H) * 0.88;
}

function normalize(v: DeepView, n: number, W: number, H: number): void {
  const N = BigInt(n);
  const sx = Math.floor(v.fx);
  if (sx !== 0) {
    v.X += BigInt(sx);
    v.fx -= sx;
  }
  const sy = Math.floor(v.fy);
  if (sy !== 0) {
    v.Y += BigInt(sy);
    v.fy -= sy;
  }
  const big = Math.max(W, H);
  // Zoomed in so far that one of the little squares inside is bigger than
  // the screen: hop down into it.
  while (v.cellPx > big * n) {
    const cx = Math.min(n - 1, Math.max(0, Math.floor(v.fx * n)));
    const cy = Math.min(n - 1, Math.max(0, Math.floor(v.fy * n)));
    v.fx = v.fx * n - cx;
    v.fy = v.fy * n - cy;
    v.X = v.X * N + BigInt(cx);
    v.Y = v.Y * N + BigInt(cy);
    v.cellPx /= n;
    v.k++;
  }
  // Zoomed out so the square is smaller than the screen: hop back up.
  while (v.cellPx < big && v.k > 0) {
    const dx = ((v.X % N) + N) % N;
    const dy = ((v.Y % N) + N) % N;
    v.X = (v.X - dx) / N;
    v.Y = (v.Y - dy) / N;
    v.fx = (v.fx + Number(dx)) / n;
    v.fy = (v.fy + Number(dy)) / n;
    v.cellPx *= n;
    v.k--;
  }
  if (v.k === 0) v.cellPx = Math.max(v.cellPx, fitPx(W, H) * 0.15);
}

// (ox, oy) is the point to zoom around, measured from the middle of the screen.
export function deepZoom(v: DeepView, factor: number, ox: number, oy: number, n: number, W: number, H: number): void {
  const u = v.fx + ox / v.cellPx;
  const w = v.fy + oy / v.cellPx;
  v.cellPx *= factor;
  if (v.k === 0) v.cellPx = Math.max(v.cellPx, fitPx(W, H) * 0.15);
  v.fx = u - ox / v.cellPx;
  v.fy = w - oy / v.cellPx;
  normalize(v, n, W, H);
}

export function deepPan(v: DeepView, dx: number, dy: number, n: number, W: number, H: number): void {
  v.fx -= dx / v.cellPx;
  v.fy -= dy / v.cellPx;
  normalize(v, n, W, H);
}

// Is the square (X, Y), k levels deep, part of the fractal? Check every digit
// of X and Y (in base n) from the top down; only the first `level` of them
// matter, because below that the squares are solid.
function exists(spec: GridSpec, X: bigint, Y: bigint, k: number, level: number): boolean {
  if (X < 0n || Y < 0n) return false;
  const N = BigInt(spec.n);
  let x = X;
  let y = Y;
  for (let t = k - 1; t >= 0; t--) {
    const dx = Number(x % N);
    const dy = Number(y % N);
    x /= N;
    y /= N;
    if (t < level && !spec.keep(dx, dy)) return false;
  }
  return x === 0n && y === 0n;
}

// How many levels deep you can see right now before squares get too small.
export function visibleDepth(v: DeepView, n: number, stopPx: number): number {
  return v.k + Math.max(0, Math.ceil(Math.log(v.cellPx / stopPx) / Math.log(n)));
}

interface Box {
  x: number;
  y: number;
  s: number;
}

// A square and the chain of bigger squares it sits inside.
interface Chain {
  b: Box;
  up: Chain | null;
}

function ancestor(chain: Chain, steps: number): Box {
  let at = chain;
  for (let i = 0; i < steps && at.up; i++) at = at.up;
  return at.b;
}

export function drawDeep(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: GridSpec,
  level: number,
  v: DeepView,
  colors: string[],
  stopPx: number,
  growDepth: number,
  dpr: number
): void {
  const n = spec.n;
  const N = BigInt(n);
  const kept: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (spec.keep(i, j)) kept.push([i, j]);
  const buckets = colors.length - 1;
  const paths = new Map<number, Path2D>();
  const seam = 0.4 * dpr;
  const limit = Math.min(level, growDepth);

  // Colour comes from where a square sits inside a much bigger square a few
  // levels up, so there's a screen-sized rainbow at every zoom, not just one
  // colour deep down. It blends between 5 and 6 levels up as you zoom, so the
  // colours slide smoothly instead of jumping.
  const shift = Math.log(n);
  const at = (x: number, y: number, s: number, a: Box): number => (x + s / 2 - a.x + (y + s / 2 - a.y)) / (2 * a.s);
  const leaf = (x: number, y: number, s: number, chain: Chain): void => {
    const t = Math.max(0, Math.min(1, Math.log(s / stopPx) / shift));
    const c = at(x, y, s, ancestor(chain, 6)) * (1 - t) + at(x, y, s, ancestor(chain, 5)) * t;
    const b = Math.round(Math.max(0, Math.min(1, c)) * buckets);
    let path = paths.get(b);
    if (!path) paths.set(b, (path = new Path2D()));
    path.rect(x - seam, y - seam, s + seam * 2, s + seam * 2);
  };

  const rec = (x: number, y: number, s: number, depth: number, chain: Chain): void => {
    if (x > W || y > H || x + s < 0 || y + s < 0) return;
    if (depth >= limit || s < stopPx) {
      leaf(x, y, s, chain);
      return;
    }
    const sub = s / n;
    for (const [i, j] of kept) {
      const cx = x + i * sub;
      const cy = y + j * sub;
      rec(cx, cy, sub, depth + 1, { b: { x: cx, y: cy, s: sub }, up: chain });
    }
  };

  const ax = W / 2 - v.fx * v.cellPx;
  const ay = H / 2 - v.fy * v.cellPx;
  const i0 = Math.floor(-ax / v.cellPx);
  const i1 = Math.ceil((W - ax) / v.cellPx);
  const j0 = Math.floor(-ay / v.cellPx);
  const j1 = Math.ceil((H - ay) / v.cellPx);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const X = v.X + BigInt(i);
      const Y = v.Y + BigInt(j);
      if (!exists(spec, X, Y, v.k, level)) continue;
      const x = ax + i * v.cellPx;
      const y = ay + j * v.cellPx;
      const up = (d: number): Box => {
        const dd = Math.min(d, v.k);
        const span = N ** BigInt(dd);
        return {
          x: x - Number(((X % span) + span) % span) * v.cellPx,
          y: y - Number(((Y % span) + span) % span) * v.cellPx,
          s: v.cellPx * n ** dd,
        };
      };
      let chain: Chain | null = null;
      for (let d = Math.min(6, v.k); d >= 1; d--) chain = { b: up(d), up: chain };
      rec(x, y, v.cellPx, v.k, { b: { x, y, s: v.cellPx }, up: chain });
    }
  }

  for (const [b, path] of [...paths.entries()].sort((p, q) => p[0] - q[0])) {
    ctx.fillStyle = colors[b] ?? "#fff";
    ctx.fill(path);
  }
}

// ---------- Dive: zoom forever, always heading for a part of the fractal ----------

// The path to dive down: which little square to pick at every level.
export interface Dive {
  digits: [number, number][];
}

export function startDive(v: DeepView, spec: GridSpec, level: number): Dive {
  const n = spec.n;
  const N = BigInt(n);
  const digits: [number, number][] = [];
  // Keep heading wherever you already are, if that's part of the fractal.
  if (exists(spec, v.X, v.Y, v.k, level)) {
    let x = v.X;
    let y = v.Y;
    for (let t = 0; t < v.k; t++) {
      digits.unshift([Number(x % N), Number(y % N)]);
      x /= N;
      y /= N;
    }
  } else {
    Object.assign(v, { k: 0, X: 0n, Y: 0n, fx: 0.5, fy: 0.5 });
  }
  return { digits };
}

export function diveStep(v: DeepView, dive: Dive, spec: GridSpec, dt: number, W: number, H: number): void {
  const n = spec.n;
  const kept: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (spec.keep(i, j)) kept.push([i, j]);
  if (!kept.length) return;
  while (dive.digits.length < v.k + 30) dive.digits.push(kept[Math.floor(Math.random() * kept.length)] ?? [0, 0]);

  // Where the target is, measured in anchor squares from the anchor.
  const N = BigInt(n);
  let tx = 0n;
  let ty = 0n;
  for (let t = 0; t < v.k; t++) {
    const [a, b] = dive.digits[t] ?? [0, 0];
    tx = tx * N + BigInt(a);
    ty = ty * N + BigInt(b);
  }
  let fracX = 0;
  let fracY = 0;
  let place = 1 / n;
  for (let t = v.k; t < v.k + 25; t++) {
    const [a, b] = dive.digits[t] ?? [0, 0];
    fracX += (a + 0.5 / n) * place;
    fracY += (b + 0.5 / n) * place;
    place /= n;
  }
  const targetX = Number(tx - v.X) + fracX;
  const targetY = Number(ty - v.Y) + fracY;

  // Slide the middle of the screen toward the target, and zoom in.
  const pull = Math.min(1, dt * 2.5);
  deepPan(v, -(targetX - v.fx) * pull * v.cellPx, -(targetY - v.fy) * pull * v.cellPx, n, W, H);
  deepZoom(v, Math.exp(dt * 1.15), 0, 0, n, W, H);
}
