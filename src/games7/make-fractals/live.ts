// Zoom-forever drawing for the tree-shaped fractals (Fractal Tree, H-Tree,
// Pythagoras Tree, T-Square). Instead of building every branch ahead of time,
// they're grown fresh every frame, one level at a time, skipping branches
// that are off the screen. So when you zoom into a branch tip, new branches
// keep sprouting.

export interface LiveNode {
  d: number;
  [key: string]: number;
}

export interface LiveSpec {
  roots(): LiveNode[];
  children(node: LiveNode): LiveNode[];
  // A circle the whole branch (and everything that grows off it) fits inside.
  reach(node: LiveNode): { x: number; y: number; r: number };
  shape(node: LiveNode): LiveShape | LiveShape[];
}

// `ink` lines are drawn in plain ink instead of a palette colour, and
// `outline` fills get a thin dark border.
export type LiveShape =
  | { kind: "line"; pts: number[]; lw: number; ink?: boolean }
  | { kind: "fill"; pts: number[]; outline?: boolean };

const tri = (t: number): number => 1 - Math.abs((((t % 2) + 2) % 2) - 1);

export function drawLive(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  spec: LiveSpec,
  level: number,
  colorDepth: number,
  toX: (x: number) => number,
  toY: (y: number) => number,
  scale: number,
  colors: string[],
  growDepth: number,
  lineWidth: number,
  ink = "#fff6e5",
  bg = "#120a1f"
): void {
  const buckets = colors.length - 1;
  const fills = new Map<number, Path2D>();
  const lines = new Map<string, { path: Path2D; b: number; lw: number }>();
  const outlines = new Path2D();
  let hasOutlines = false;
  const budget = 140000;
  let drawn = 0;
  const limit = Math.min(level, growDepth);

  const onScreen = (node: LiveNode): boolean => {
    const { x, y, r } = spec.reach(node);
    const sx = toX(x);
    const sy = toY(y);
    const sr = r * scale;
    return sr > 0.4 && sx + sr > 0 && sx - sr < W && sy + sr > 0 && sy - sr < H;
  };

  let layer = spec.roots().filter(onScreen);
  while (layer.length) {
    const next: LiveNode[] = [];
    for (const node of layer) {
      const c = colorDepth > 0 ? tri(node.d / colorDepth) : 0.5;
      const b = Math.round(c * buckets);
      const made = spec.shape(node);
      for (const s of Array.isArray(made) ? made : [made]) {
        const p = s.pts;
        if (s.kind === "fill") {
          let path = fills.get(b);
          if (!path) fills.set(b, (path = new Path2D()));
          const targets = s.outline ? [path, outlines] : [path];
          if (s.outline) hasOutlines = true;
          for (const t of targets) {
            t.moveTo(toX(p[0] ?? 0), toY(p[1] ?? 0));
            for (let i = 2; i < p.length; i += 2) t.lineTo(toX(p[i] ?? 0), toY(p[i + 1] ?? 0));
            t.closePath();
          }
        } else {
          const lb = s.ink ? -1 : b;
          const key = `${lb}:${s.lw}`;
          let group = lines.get(key);
          if (!group) lines.set(key, (group = { path: new Path2D(), b: lb, lw: s.lw }));
          group.path.moveTo(toX(p[0] ?? 0), toY(p[1] ?? 0));
          for (let i = 2; i < p.length; i += 2) group.path.lineTo(toX(p[i] ?? 0), toY(p[i + 1] ?? 0));
        }
      }
      drawn++;
      if (node.d < limit) for (const child of spec.children(node)) if (onScreen(child)) next.push(child);
    }
    // Too many to draw smoothly? Stop at this level everywhere, so the detail
    // stays even instead of lopsided.
    if (drawn + next.length > budget) break;
    layer = next;
  }

  for (const [b, path] of [...fills.entries()].sort((p, q) => p[0] - q[0])) {
    ctx.fillStyle = colors[b] ?? "#fff";
    ctx.fill(path);
  }
  if (hasOutlines) {
    ctx.strokeStyle = bg;
    ctx.lineWidth = lineWidth * 1.5;
    ctx.stroke(outlines);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Ink lines go on top of everything.
  for (const group of [...lines.values()].sort((p, q) => (p.b < 0 ? 1 : q.b < 0 ? -1 : p.b - q.b))) {
    ctx.strokeStyle = group.b < 0 ? ink : (colors[group.b] ?? "#fff");
    ctx.lineWidth = lineWidth * group.lw;
    ctx.stroke(group.path);
  }
}

// ---------- the tree-shaped fractals ----------

export function treeLive(colorDepth: () => number): LiveSpec {
  const spread = 0.42;
  return {
    roots: () => [{ d: 0, x: 0, y: 0, a: -Math.PI / 2, len: 1 }],
    children: (n) => {
      const x = (n["x"] ?? 0) + Math.cos(n["a"] ?? 0) * (n["len"] ?? 0);
      const y = (n["y"] ?? 0) + Math.sin(n["a"] ?? 0) * (n["len"] ?? 0);
      const len = (n["len"] ?? 0) * 0.72;
      return [
        { d: n.d + 1, x, y, a: (n["a"] ?? 0) - spread, len },
        { d: n.d + 1, x, y, a: (n["a"] ?? 0) + spread, len },
      ];
    },
    reach: (n) => ({
      x: n["x"] ?? 0,
      y: n["y"] ?? 0,
      r: (n["len"] ?? 0) * 3.6,
    }),
    shape: (n) => {
      const x = n["x"] ?? 0;
      const y = n["y"] ?? 0;
      const len = n["len"] ?? 0;
      return {
        kind: "line",
        pts: [x, y, x + Math.cos(n["a"] ?? 0) * len, y + Math.sin(n["a"] ?? 0) * len],
        lw: 1 + Math.max(0, colorDepth() - n.d) * 0.55,
      };
    },
  };
}

export function hTreeLive(colorDepth: () => number): LiveSpec {
  return {
    roots: () => [{ d: 0, cx: 0, cy: 0, len: 1, flat: 1 }],
    children: (n) => {
      const half = (n["len"] ?? 0) / 2;
      const flat = n["flat"] === 1;
      const cx = n["cx"] ?? 0;
      const cy = n["cy"] ?? 0;
      const len = (n["len"] ?? 0) / Math.SQRT2;
      return [
        {
          d: n.d + 1,
          cx: flat ? cx - half : cx,
          cy: flat ? cy : cy - half,
          len,
          flat: flat ? 0 : 1,
        },
        {
          d: n.d + 1,
          cx: flat ? cx + half : cx,
          cy: flat ? cy : cy + half,
          len,
          flat: flat ? 0 : 1,
        },
      ];
    },
    reach: (n) => ({
      x: n["cx"] ?? 0,
      y: n["cy"] ?? 0,
      r: (n["len"] ?? 0) * 1.8,
    }),
    shape: (n) => {
      const half = (n["len"] ?? 0) / 2;
      const flat = n["flat"] === 1;
      const cx = n["cx"] ?? 0;
      const cy = n["cy"] ?? 0;
      return {
        kind: "line",
        pts: flat ? [cx - half, cy, cx + half, cy] : [cx, cy - half, cx, cy + half],
        lw: 1 + Math.max(0, colorDepth() - n.d) * 0.25,
      };
    },
  };
}

export function pythagorasLive(): LiveSpec {
  const square = (n: LiveNode): number[] => {
    const ax = n["ax"] ?? 0;
    const ay = n["ay"] ?? 0;
    const bx = n["bx"] ?? 0;
    const by = n["by"] ?? 0;
    const px = by - ay;
    const py = -(bx - ax);
    return [ax, ay, bx, by, bx + px, by + py, ax + px, ay + py];
  };
  return {
    roots: () => [{ d: 0, ax: 0, ay: 0, bx: 1, by: 0 }],
    children: (n) => {
      const [, , , , cx = 0, cy = 0, ex = 0, ey = 0] = square(n);
      const dx = (n["bx"] ?? 0) - (n["ax"] ?? 0);
      const dy = (n["by"] ?? 0) - (n["ay"] ?? 0);
      const tipX = ex + dx / 2 + dy / 2;
      const tipY = ey + dy / 2 - dx / 2;
      return [
        { d: n.d + 1, ax: ex, ay: ey, bx: tipX, by: tipY },
        { d: n.d + 1, ax: tipX, ay: tipY, bx: cx, by: cy },
      ];
    },
    reach: (n) => {
      const ax = n["ax"] ?? 0;
      const ay = n["ay"] ?? 0;
      const bx = n["bx"] ?? 0;
      const by = n["by"] ?? 0;
      const w = Math.hypot(bx - ax, by - ay);
      return { x: (ax + bx) / 2, y: (ay + by) / 2, r: w * 5 };
    },
    shape: (n) => ({ kind: "fill", pts: square(n) }),
  };
}

export function tSquareLive(): LiveSpec {
  const corners = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const;
  return {
    roots: () => [{ d: 0, cx: 0, cy: 0, s: 1 }],
    children: (n) => {
      const s = n["s"] ?? 0;
      return corners.map(([sx, sy]) => ({
        d: n.d + 1,
        cx: (n["cx"] ?? 0) + (sx * s) / 2,
        cy: (n["cy"] ?? 0) + (sy * s) / 2,
        s: s / 2,
      }));
    },
    reach: (n) => ({
      x: n["cx"] ?? 0,
      y: n["cy"] ?? 0,
      r: (n["s"] ?? 0) * 1.42,
    }),
    shape: (n) => {
      const h = (n["s"] ?? 0) / 2;
      const cx = n["cx"] ?? 0;
      const cy = n["cy"] ?? 0;
      return {
        kind: "fill",
        pts: [cx - h, cy - h, cx + h, cy - h, cx + h, cy + h, cx - h, cy + h],
      };
    },
  };
}

// The Cantor Set as a comb: every bar has two bars a third as wide hanging
// under its ends, and they're shorter by a third too, so it looks the same
// however far you zoom into it.
export function cantorLive(): LiveSpec {
  const bar = 0.2;
  const drop = 0.32;
  return {
    roots: () => [{ d: 0, x: 0, y: 0, w: 1 }],
    children: (n) => {
      const x = n["x"] ?? 0;
      const w = n["w"] ?? 0;
      const y = (n["y"] ?? 0) + w * drop;
      return [
        { d: n.d + 1, x, y, w: w / 3 },
        { d: n.d + 1, x: x + (2 * w) / 3, y, w: w / 3 },
      ];
    },
    reach: (n) => {
      const w = n["w"] ?? 0;
      return { x: (n["x"] ?? 0) + w / 2, y: (n["y"] ?? 0) + w * 0.3, r: w * 0.65 };
    },
    shape: (n) => {
      const x = n["x"] ?? 0;
      const y = n["y"] ?? 0;
      const w = n["w"] ?? 0;
      return { kind: "fill", pts: [x, y, x + w, y, x + w, y + w * bar, x, y + w * bar] };
    },
  };
}

// Golden Rectangles: cut a square off, and what's left is another golden
// rectangle, turned a quarter. Each step is one square plus a quarter of the
// spiral.
export function goldenLive(): LiveSpec {
  const cut = (n: LiveNode): { sq: number[]; arc: [number, number, number, number, number]; rest: LiveNode } => {
    const x = n["x"] ?? 0;
    const y = n["y"] ?? 0;
    const w = n["w"] ?? 0;
    const h = n["h"] ?? 0;
    const d = n.d + 1;
    switch (n.d % 4) {
      case 0:
        return { sq: [x, y, h, h], arc: [x + h, y + h, h, Math.PI, Math.PI * 1.5], rest: { d, x: x + h, y, w: w - h, h } };
      case 1:
        return { sq: [x, y, w, w], arc: [x, y + w, w, -Math.PI / 2, 0], rest: { d, x, y: y + w, w, h: h - w } };
      case 2:
        return { sq: [x + w - h, y, h, h], arc: [x + w - h, y, h, 0, Math.PI / 2], rest: { d, x, y, w: w - h, h } };
      default:
        return { sq: [x, y + h - w, w, w], arc: [x + w, y + h - w, w, Math.PI / 2, Math.PI], rest: { d, x, y, w, h: h - w } };
    }
  };
  return {
    roots: () => [{ d: 0, x: 0, y: 0, w: (1 + Math.sqrt(5)) / 2, h: 1 }],
    children: (n) => [cut(n).rest],
    reach: (n) => {
      const w = n["w"] ?? 0;
      const h = n["h"] ?? 0;
      return { x: (n["x"] ?? 0) + w / 2, y: (n["y"] ?? 0) + h / 2, r: Math.hypot(w, h) / 2 };
    },
    shape: (n) => {
      const { sq, arc } = cut(n);
      const [x = 0, y = 0, s = 0] = sq;
      const [cx, cy, r, from, to] = arc;
      const pts: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = from + ((to - from) * i) / 16;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      return [
        { kind: "fill", pts: [x, y, x + s, y, x + s, y + s, x, y + s], outline: true },
        { kind: "line", pts, lw: 1.3, ink: true },
      ];
    },
  };
}
