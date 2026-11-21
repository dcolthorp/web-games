// Zoom-forever drawing for the line fractals (Koch, Dragon, Hilbert…).
//
// Most of them work by "swap every line for a little zig-zag of lines". So
// instead of building millions of lines ahead of time, each line on the
// screen is swapped for its zig-zag right when it's drawn, again and again,
// but only for lines you can actually see, and only until they're about as
// small as a dot. Zoom in and the lines keep getting swapped for more detail.

interface Seg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sym: string;
}

export interface Curve {
  bounds(level: number): { minX: number; minY: number; maxX: number; maxY: number };
  draw(
    level: number,
    toX: (x: number) => number,
    toY: (y: number) => number,
    scale: number,
    W: number,
    H: number,
    emit: (x0: number, y0: number, x1: number, y1: number, t: number) => void,
    growDepth: number,
    stopPx: number
  ): void;
  // Space-filling ones show much less of the line per zoom, so their colours
  // need to cycle faster to keep a rainbow on the screen.
  fills: boolean;
}

function walk(path: string, angleDeg: number, draw: string, start = 0): Seg[] {
  const turn = (angleDeg * Math.PI) / 180;
  let a = start;
  let x = 0;
  let y = 0;
  const out: Seg[] = [];
  for (const ch of path) {
    if (draw.includes(ch)) {
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      out.push({ x0: x, y0: y, x1: nx, y1: ny, sym: ch });
      x = nx;
      y = ny;
    } else if (ch === "+") a += turn;
    else if (ch === "-") a -= turn;
  }
  return out;
}

// An "edge-swapping" L-system: every drawing letter is a line, and its rule
// says which zig-zag of lines replaces it.
export function edgeCurve(
  axiom: string,
  rules: Record<string, string>,
  angle: number,
  draw: string,
  fills = false
): Curve {
  const initial = walk(axiom, angle, draw);
  // Each letter's zig-zag, squished so it starts at (0,0) and ends at (1,0).
  const patterns: Record<string, Seg[]> = {};
  for (const sym of draw) {
    const segs = walk(rules[sym] ?? sym, angle, draw);
    const last = segs[segs.length - 1];
    const ex = last?.x1 ?? 1;
    const ey = last?.y1 ?? 0;
    const len2 = ex * ex + ey * ey;
    // Turn (ex, ey) into (1, 0): multiply by its conjugate over its size.
    patterns[sym] = segs.map((s) => ({
      x0: (s.x0 * ex + s.y0 * ey) / len2,
      y0: (s.y0 * ex - s.x0 * ey) / len2,
      x1: (s.x1 * ex + s.y1 * ey) / len2,
      y1: (s.y1 * ex - s.x1 * ey) / len2,
      sym: s.sym,
    }));
  }

  const expand = (s: Seg): Seg[] => {
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    return (patterns[s.sym] ?? []).map((p) => ({
      x0: s.x0 + p.x0 * dx - p.y0 * dy,
      y0: s.y0 + p.x0 * dy + p.y0 * dx,
      x1: s.x0 + p.x1 * dx - p.y1 * dy,
      y1: s.y0 + p.x1 * dy + p.y1 * dx,
      sym: p.sym,
    }));
  };

  // How far the finished wiggle can stray from its straight line (as a
  // fraction of the line's length). Found by actually wiggling a test line.
  let reach = 0.75;
  {
    let segs: Seg[] = [{ x0: 0, y0: 0, x1: 1, y1: 0, sym: draw[0] ?? "F" }];
    for (let i = 0; i < 6 && segs.length < 20000; i++) segs = segs.flatMap(expand);
    for (const s of segs) reach = Math.max(reach, Math.hypot(s.x1 - 0.5, s.y1));
    reach *= 1.15;
  }

  const boundsCache = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
  return {
    bounds(level) {
      const l = Math.min(level, 7);
      const hit = boundsCache.get(l);
      if (hit) return hit;
      let segs = initial;
      for (let i = 0; i < l && segs.length < 60000; i++) segs = segs.flatMap(expand);
      const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const s of segs) {
        b.minX = Math.min(b.minX, s.x0, s.x1);
        b.maxX = Math.max(b.maxX, s.x0, s.x1);
        b.minY = Math.min(b.minY, s.y0, s.y1);
        b.maxY = Math.max(b.maxY, s.y0, s.y1);
      }
      boundsCache.set(l, b);
      return b;
    },
    fills,
    draw(level, toX, toY, scale, W, H, emit, growDepth, stopPx) {
      const limit = Math.min(level, growDepth);
      const rec = (s: Seg, depth: number, t0: number, t1: number): void => {
        const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
        const mx = toX((s.x0 + s.x1) / 2);
        const my = toY((s.y0 + s.y1) / 2);
        const r = len * reach * scale;
        if (mx + r < 0 || mx - r > W || my + r < 0 || my - r > H) return;
        if (depth >= limit || len * scale < stopPx) {
          emit(s.x0, s.y0, s.x1, s.y1, (t0 + t1) / 2);
          return;
        }
        const kids = expand(s);
        kids.forEach((k, i) => rec(k, depth + 1, t0 + ((t1 - t0) * i) / kids.length, t0 + ((t1 - t0) * (i + 1)) / kids.length));
      };
      initial.forEach((s, i) => rec(s, 0, i / initial.length, (i + 1) / initial.length));
    },
  };
}

// The Hilbert curve swaps squares, not lines: every square becomes 4 smaller
// squares visited in a U shape, each turned the right way.
export function hilbertCurve(): Curve {
  return {
    bounds: () => ({ minX: 0, minY: 0, maxX: 1, maxY: 1 }),
    fills: true,
    draw(level, toX, toY, scale, W, H, emit, growDepth, stopPx) {
      const limit = Math.min(level, growDepth);
      let px: number | null = null;
      let py = 0;
      let pt = 0;
      const point = (x: number, y: number, t: number): void => {
        if (px !== null) emit(px, py, x, y, (pt + t) / 2);
        px = x;
        py = y;
        pt = t;
      };
      const rec = (x0: number, y0: number, xi: number, xj: number, yi: number, yj: number, n: number, t0: number, t1: number): void => {
        const minX = Math.min(x0, x0 + xi, x0 + yi, x0 + xi + yi);
        const maxX = Math.max(x0, x0 + xi, x0 + yi, x0 + xi + yi);
        const minY = Math.min(y0, y0 + xj, y0 + yj, y0 + xj + yj);
        const maxY = Math.max(y0, y0 + xj, y0 + yj, y0 + xj + yj);
        // Keep squares right next to the screen too, so the lines joining
        // them to the squares you can see still get drawn.
        const m = maxX - minX;
        if (toX(maxX + m) < 0 || toX(minX - m) > W || toY(maxY + m) < 0 || toY(minY - m) > H) {
          px = null; // off the screen: lift the pen
          return;
        }
        if (n <= 0 || (maxX - minX) * scale < stopPx * 1.5) {
          point(x0 + (xi + yi) / 2, y0 + (xj + yj) / 2, (t0 + t1) / 2);
          return;
        }
        const q = (t1 - t0) / 4;
        rec(x0, y0, yi / 2, yj / 2, xi / 2, xj / 2, n - 1, t0, t0 + q);
        rec(x0 + xi / 2, y0 + xj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1, t0 + q, t0 + 2 * q);
        rec(x0 + xi / 2 + yi / 2, y0 + xj / 2 + yj / 2, xi / 2, xj / 2, yi / 2, yj / 2, n - 1, t0 + 2 * q, t0 + 3 * q);
        rec(x0 + xi / 2 + yi, y0 + xj / 2 + yj, -yi / 2, -yj / 2, -xi / 2, -xj / 2, n - 1, t0 + 3 * q, t1);
      };
      rec(0, 0, 1, 0, 0, 1, limit, 0, 1);
    },
  };
}

// The Peano curve snakes through 3×3 squares: up the first column, down the
// middle, up the last, with each little square flipped so the ends join up.
export function peanoCurve(): Curve {
  return {
    bounds: () => ({ minX: 0, minY: 0, maxX: 1, maxY: 1 }),
    fills: true,
    draw(level, toX, toY, scale, W, H, emit, growDepth, stopPx) {
      const limit = Math.min(level, growDepth);
      let px: number | null = null;
      let py = 0;
      let pt = 0;
      const point = (x: number, y: number, t: number): void => {
        if (px !== null) emit(px, py, x, y, (pt + t) / 2);
        px = x;
        py = y;
        pt = t;
      };
      const rec = (
        ox: number,
        oy: number,
        xx: number,
        xy: number,
        yx: number,
        yy: number,
        n: number,
        t0: number,
        t1: number
      ): void => {
        const minX = Math.min(ox, ox + xx, ox + yx, ox + xx + yx);
        const maxX = Math.max(ox, ox + xx, ox + yx, ox + xx + yx);
        const minY = Math.min(oy, oy + xy, oy + yy, oy + xy + yy);
        const maxY = Math.max(oy, oy + xy, oy + yy, oy + xy + yy);
        const m = maxX - minX;
        if (toX(maxX + m) < 0 || toX(minX - m) > W || toY(maxY + m) < 0 || toY(minY - m) > H) {
          px = null;
          return;
        }
        if (n <= 0 || m * scale < stopPx * 1.5) {
          point(ox + (xx + yx) / 2, oy + (xy + yy) / 2, (t0 + t1) / 2);
          return;
        }
        const step = (t1 - t0) / 9;
        let i = 0;
        for (let a = 0; a < 3; a++) {
          for (const b of a % 2 ? [2, 1, 0] : [0, 1, 2]) {
            let sx = ox + (a * xx + b * yx) / 3;
            let sy = oy + (a * xy + b * yy) / 3;
            let ax = xx / 3;
            let ay = xy / 3;
            let bx = yx / 3;
            let by = yy / 3;
            if (b % 2) {
              sx += ax;
              sy += ay;
              ax = -ax;
              ay = -ay;
            }
            if (a % 2) {
              sx += bx;
              sy += by;
              bx = -bx;
              by = -by;
            }
            rec(sx, sy, ax, ay, bx, by, n - 1, t0 + step * i, t0 + step * (i + 1));
            i++;
          }
        }
      };
      rec(0, 1, 1, 0, 0, -1, limit, 0, 1);
    },
  };
}
