// Every fractal in Make Fractals. A flat fractal makes a list of shapes
// (squares, lines and tilted squares) and a 3D one makes a pile of cubes.
// Each shape carries `c`, a number from 0 to 1 that picks its colour from the
// palette. A `c` below 0 means "draw it in plain ink".

export type Shape =
  | { t: "r"; x: number; y: number; w: number; h: number; c: number }
  | { t: "l"; x1: number; y1: number; x2: number; y2: number; c: number; lw?: number }
  | { t: "p"; pts: number[]; c: number };

export interface Cube {
  x: number;
  y: number;
  z: number;
  c: number;
}

// Cubes sit on a grid `size` cells across, one cell each.
export interface Model3D {
  cubes: Cube[];
  size: number;
}

interface FractalBase {
  id: string;
  name: string;
  group: string;
  blurb: string;
  minLevel: number;
  maxLevel: number;
  startLevel: number;
  unit: string;
  outline?: boolean;
}

export interface Fractal2D extends FractalBase {
  kind: "2d";
  make(level: number): Shape[];
}

export interface Fractal3D extends FractalBase {
  kind: "3d";
  make(level: number): Model3D;
}

export type Fractal = Fractal2D | Fractal3D;

// ---------- squares on a grid ----------

// Split a square into n×n little squares, keep the ones `keep` likes, and do
// it again inside every square you kept.
export function gridFractal2D(n: number, keep: (i: number, j: number) => boolean, level: number): Shape[] {
  const cells: [number, number][] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (keep(i, j)) cells.push([i, j]);
  const out: Shape[] = [];
  const rec = (x: number, y: number, s: number, d: number): void => {
    if (d === 0) {
      out.push({ t: "r", x, y, w: s, h: s, c: (x + y + s) / 2 });
      return;
    }
    const sub = s / n;
    for (const [i, j] of cells) rec(x + i * sub, y + j * sub, sub, d - 1);
  };
  rec(0, 0, 1, level);
  return out;
}

export function gridFractal3D(
  n: number,
  keep: (i: number, j: number, k: number) => boolean,
  level: number
): Model3D {
  const cells: [number, number, number][] = [];
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (keep(i, j, k)) cells.push([i, j, k]);
  const size = n ** level;
  const cubes: Cube[] = [];
  const rec = (x: number, y: number, z: number, s: number, d: number): void => {
    if (d === 0) {
      cubes.push({ x, y, z, c: (x + y + z + 1.5) / (3 * size) });
      return;
    }
    const sub = s / n;
    for (const [i, j, k] of cells) rec(x + i * sub, y + j * sub, z + k * sub, sub, d - 1);
  };
  rec(0, 0, 0, size, level);
  return { cubes, size };
}

// ---------- turtle drawings (L-systems) ----------

// Start with `axiom`, swap every letter for its rule `level` times, then walk
// a turtle along it. Letters in `draw` move forward and draw, + and - turn.
function lsystem(
  axiom: string,
  rules: Record<string, string>,
  angleDeg: number,
  level: number,
  draw = "F",
  startDeg = 0
): Shape[] {
  let s = axiom;
  for (let i = 0; i < level; i++) {
    let next = "";
    for (const ch of s) next += rules[ch] ?? ch;
    s = next;
  }
  const turn = (angleDeg * Math.PI) / 180;
  let a = (startDeg * Math.PI) / 180;
  let x = 0;
  let y = 0;
  const out: Shape[] = [];
  for (const ch of s) {
    if (draw.includes(ch)) {
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      out.push({ t: "l", x1: x, y1: y, x2: nx, y2: ny, c: 0 });
      x = nx;
      y = ny;
    } else if (ch === "+") a += turn;
    else if (ch === "-") a -= turn;
  }
  out.forEach((shape, index) => (shape.c = out.length > 1 ? index / (out.length - 1) : 0.5));
  return out;
}

// ---------- the special ones ----------

function cantorSet(level: number): Shape[] {
  const out: Shape[] = [];
  const rowGap = 0.12;
  const barH = 0.06;
  const rec = (x: number, w: number, row: number): void => {
    out.push({ t: "r", x, y: row * rowGap, w, h: barH, c: level ? row / level : 0.5 });
    if (row === level) return;
    rec(x, w / 3, row + 1);
    rec(x + (2 * w) / 3, w / 3, row + 1);
  };
  rec(0, 1, 0);
  return out;
}

function tSquare(level: number): Shape[] {
  // Make them all by size so the little squares go on top of the big ones.
  const out: Shape[] = [];
  let layer: [number, number][] = [[0, 0]];
  let s = 1;
  for (let d = 0; d <= level; d++) {
    const next: [number, number][] = [];
    for (const [cx, cy] of layer) {
      out.push({ t: "r", x: cx - s / 2, y: cy - s / 2, w: s, h: s, c: level ? d / level : 0.5 });
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const)
        next.push([cx + (sx * s) / 2, cy + (sy * s) / 2]);
    }
    layer = next;
    s /= 2;
  }
  return out;
}

function pythagorasTree(level: number): Shape[] {
  const out: Shape[] = [];
  const rec = (ax: number, ay: number, bx: number, by: number, d: number): void => {
    const dx = bx - ax;
    const dy = by - ay;
    // "Up" from the bottom edge of the square.
    const px = dy;
    const py = -dx;
    const cx = bx + px;
    const cy = by + py;
    const ex = ax + px;
    const ey = ay + py;
    out.push({ t: "p", pts: [ax, ay, bx, by, cx, cy, ex, ey], c: level ? d / level : 0.5 });
    if (d === level) return;
    const tipX = ex + dx / 2 + px / 2;
    const tipY = ey + dy / 2 + py / 2;
    rec(ex, ey, tipX, tipY, d + 1);
    rec(tipX, tipY, cx, cy, d + 1);
  };
  rec(0, 0, 1, 0, 0);
  // Biggest first, so the little ones end up on top.
  return out.sort((a, b) => a.c - b.c);
}

function goldenRectangles(level: number): Shape[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  let x = 0;
  let y = 0;
  let w = phi;
  let h = 1;
  const squares: Shape[] = [];
  const spiral: Shape[] = [];
  const count = level + 1;
  const arc = (cx: number, cy: number, r: number, from: number, to: number): void => {
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const a1 = from + ((to - from) * i) / steps;
      const a2 = from + ((to - from) * (i + 1)) / steps;
      spiral.push({
        t: "l",
        x1: cx + Math.cos(a1) * r,
        y1: cy + Math.sin(a1) * r,
        x2: cx + Math.cos(a2) * r,
        y2: cy + Math.sin(a2) * r,
        c: -1,
        lw: 1.6,
      });
    }
  };
  for (let k = 0; k < count; k++) {
    const c = count > 1 ? k / (count - 1) : 0.5;
    switch (k % 4) {
      case 0:
        squares.push({ t: "r", x, y, w: h, h, c });
        arc(x + h, y + h, h, Math.PI, Math.PI * 1.5);
        x += h;
        w -= h;
        break;
      case 1:
        squares.push({ t: "r", x, y, w, h: w, c });
        arc(x, y + w, w, -Math.PI / 2, 0);
        y += w;
        h -= w;
        break;
      case 2:
        squares.push({ t: "r", x: x + w - h, y, w: h, h, c });
        arc(x + w - h, y, h, 0, Math.PI / 2);
        w -= h;
        break;
      default:
        squares.push({ t: "r", x, y: y + h - w, w, h: w, c });
        arc(x + w, y + h - w, w, Math.PI / 2, Math.PI);
        h -= w;
        break;
    }
  }
  return [...squares, ...spiral];
}

function hTree(level: number): Shape[] {
  const out: Shape[] = [];
  const rec = (cx: number, cy: number, len: number, d: number, flat: boolean): void => {
    const half = len / 2;
    const x1 = flat ? cx - half : cx;
    const x2 = flat ? cx + half : cx;
    const y1 = flat ? cy : cy - half;
    const y2 = flat ? cy : cy + half;
    out.push({ t: "l", x1, y1, x2, y2, c: level ? d / level : 0.5, lw: 1 + (level - d) * 0.25 });
    if (d === level) return;
    rec(x1, y1, len / Math.SQRT2, d + 1, !flat);
    rec(x2, y2, len / Math.SQRT2, d + 1, !flat);
  };
  rec(0, 0, 1, 0, true);
  return out;
}

function fractalTree(level: number): Shape[] {
  const out: Shape[] = [];
  const spread = 0.42;
  const rec = (x: number, y: number, a: number, len: number, d: number): void => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    out.push({ t: "l", x1: x, y1: y, x2, y2, c: level ? d / level : 0.5, lw: 1 + (level - d) * 0.55 });
    if (d === level) return;
    rec(x2, y2, a - spread, len * 0.72, d + 1);
    rec(x2, y2, a + spread, len * 0.72, d + 1);
  };
  rec(0, 0, -Math.PI / 2, 1, 0);
  return out;
}

// ---------- the list ----------

const isMiddle = (v: number): boolean => v === 1;

export const FRACTALS: Fractal[] = [
  // Squares and rectangles
  {
    kind: "2d",
    id: "carpet",
    name: "Sierpinski Carpet",
    group: "Squares & Rectangles",
    blurb: "Cut a square into 9 and punch out the middle. Then do it to the other 8. Forever.",
    minLevel: 0,
    maxLevel: 5,
    startLevel: 3,
    unit: "squares",
    make: (level) => gridFractal2D(3, (i, j) => !(isMiddle(i) && isMiddle(j)), level),
  },
  {
    kind: "2d",
    id: "vicsek",
    name: "Vicsek Plus",
    group: "Squares & Rectangles",
    blurb: "Keep the middle and the 4 sides. It grows into a giant spiky plus sign.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 3,
    unit: "squares",
    make: (level) => gridFractal2D(3, (i, j) => isMiddle(i) || isMiddle(j), level),
  },
  {
    kind: "2d",
    id: "vicsek-x",
    name: "Vicsek X",
    group: "Squares & Rectangles",
    blurb: "Keep the middle and the 4 corners. It turns into a snowflake made of X's.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 3,
    unit: "squares",
    make: (level) => gridFractal2D(3, (i, j) => (i + j) % 2 === 0, level),
  },
  {
    kind: "2d",
    id: "cantor-dust",
    name: "Cantor Dust",
    group: "Squares & Rectangles",
    blurb: "Only keep the 4 corners. The square crumbles into dust.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 3,
    unit: "squares",
    make: (level) => gridFractal2D(3, (i, j) => !isMiddle(i) && !isMiddle(j), level),
  },
  {
    kind: "2d",
    id: "staircase",
    name: "Staircase Triangle",
    group: "Squares & Rectangles",
    blurb: "Cut a square into 4 and throw one away. It makes a triangle out of squares!",
    minLevel: 0,
    maxLevel: 8,
    startLevel: 5,
    unit: "squares",
    make: (level) => gridFractal2D(2, (i, j) => !(i === 1 && j === 0), level),
  },
  {
    kind: "2d",
    id: "cantor",
    name: "Cantor Set",
    group: "Squares & Rectangles",
    blurb: "A long rectangle. Chop out the middle third, again and again, one row at a time.",
    minLevel: 0,
    maxLevel: 8,
    startLevel: 5,
    unit: "rectangles",
    make: cantorSet,
  },
  {
    kind: "2d",
    id: "t-square",
    name: "T-Square",
    group: "Squares & Rectangles",
    blurb: "Stick a half-size square on every corner of every square.",
    minLevel: 0,
    maxLevel: 7,
    startLevel: 4,
    unit: "squares",
    make: tSquare,
  },
  {
    kind: "2d",
    id: "pythagoras",
    name: "Pythagoras Tree",
    group: "Squares & Rectangles",
    blurb: "Two squares balance on top of every square. It grows into a tree.",
    minLevel: 0,
    maxLevel: 13,
    startLevel: 8,
    unit: "squares",
    make: pythagorasTree,
  },
  {
    kind: "2d",
    id: "golden",
    name: "Golden Rectangles",
    group: "Squares & Rectangles",
    blurb: "Cut a square off a golden rectangle and the leftover is another golden rectangle. A spiral hides inside.",
    minLevel: 0,
    maxLevel: 14,
    startLevel: 8,
    unit: "squares",
    outline: true,
    make: goldenRectangles,
  },

  // Lines
  {
    kind: "2d",
    id: "h-tree",
    name: "H-Tree",
    group: "Lines",
    blurb: "A horizontal line, then vertical lines on its ends, then horizontal on those. Lots of H's!",
    minLevel: 0,
    maxLevel: 12,
    startLevel: 6,
    unit: "lines",
    make: hTree,
  },
  {
    kind: "2d",
    id: "tree",
    name: "Fractal Tree",
    group: "Lines",
    blurb: "Every branch splits into two smaller branches.",
    minLevel: 0,
    maxLevel: 13,
    startLevel: 9,
    unit: "lines",
    make: fractalTree,
  },
  {
    kind: "2d",
    id: "koch",
    name: "Koch Snowflake",
    group: "Lines",
    blurb: "Every line gets a pointy bump in the middle. The edge gets longer forever.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 3,
    unit: "lines",
    make: (level) => lsystem("F--F--F", { F: "F+F--F+F" }, 60, level),
  },
  {
    kind: "2d",
    id: "square-koch",
    name: "Square Wave",
    group: "Lines",
    blurb: "Every line gets a square bump. Bumps on bumps on bumps.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 3,
    unit: "lines",
    make: (level) => lsystem("F", { F: "F+F-F-F+F" }, 90, level),
  },
  {
    kind: "2d",
    id: "minkowski",
    name: "Minkowski Island",
    group: "Lines",
    blurb: "A square where every edge turns into a zig-zag of tiny square steps.",
    minLevel: 0,
    maxLevel: 4,
    startLevel: 2,
    unit: "lines",
    make: (level) => lsystem("F+F+F+F", { F: "F+F-F-FF+F+F-F" }, 90, level),
  },
  {
    kind: "2d",
    id: "dragon",
    name: "Dragon Curve",
    group: "Lines",
    blurb: "Fold a strip of paper in half over and over, then open it up. That's a dragon.",
    minLevel: 0,
    maxLevel: 16,
    startLevel: 10,
    unit: "lines",
    make: (level) => lsystem("FX", { X: "X+YF+", Y: "-FX-Y" }, 90, level),
  },
  {
    kind: "2d",
    id: "levy",
    name: "Lévy C Curve",
    group: "Lines",
    blurb: "Every line turns into two lines that make a corner. It curls into a big C.",
    minLevel: 0,
    maxLevel: 16,
    startLevel: 10,
    unit: "lines",
    make: (level) => lsystem("F", { F: "+F--F+" }, 45, level),
  },
  {
    kind: "2d",
    id: "hilbert",
    name: "Hilbert Curve",
    group: "Lines",
    blurb: "One line that wiggles through every spot in a square without ever crossing itself.",
    minLevel: 1,
    maxLevel: 7,
    startLevel: 4,
    unit: "lines",
    make: (level) => lsystem("A", { A: "+BF-AFA-FB+", B: "-AF+BFB+FA-" }, 90, level),
  },
  {
    kind: "2d",
    id: "peano",
    name: "Peano Curve",
    group: "Lines",
    blurb: "Like the Hilbert curve, but it snakes back and forth in 3s.",
    minLevel: 1,
    maxLevel: 4,
    startLevel: 2,
    unit: "lines",
    make: (level) =>
      lsystem("X", { X: "XFYFX+F+YFXFY-F-XFYFX", Y: "YFXFY-F-XFYFX+F+YFXFY" }, 90, level),
  },
  {
    kind: "2d",
    id: "arrowhead",
    name: "Sierpinski Arrowhead",
    group: "Lines",
    blurb: "One zig-zagging line that turns into a triangle full of triangle holes.",
    minLevel: 0,
    maxLevel: 9,
    startLevel: 6,
    unit: "lines",
    make: (level) => lsystem("A", { A: "B-A-B", B: "A+B+A" }, 60, level, "AB"),
  },
  {
    kind: "2d",
    id: "gosper",
    name: "Gosper Flowsnake",
    group: "Lines",
    blurb: "A line that flows around like a snake and fills up a lumpy hexagon.",
    minLevel: 0,
    maxLevel: 5,
    startLevel: 3,
    unit: "lines",
    make: (level) => lsystem("A", { A: "A-B--B+A++AA+B-", B: "+A-BB--B-A++A+B" }, 60, level, "AB"),
  },

  // 3D
  {
    kind: "3d",
    id: "menger",
    name: "Menger Sponge",
    group: "3D Cubes",
    blurb: "A Sierpinski Carpet in 3D. Cut a cube into 27 and pull out the middle of every face and the very center.",
    minLevel: 0,
    maxLevel: 3,
    startLevel: 2,
    unit: "cubes",
    make: (level) =>
      gridFractal3D(3, (i, j, k) => [i, j, k].filter(isMiddle).length <= 1, level),
  },
  {
    kind: "3d",
    id: "vicsek-3d",
    name: "3D Plus",
    group: "3D Cubes",
    blurb: "The Vicsek Plus in 3D. Keep the center cube and the 6 that touch it.",
    minLevel: 0,
    maxLevel: 4,
    startLevel: 3,
    unit: "cubes",
    make: (level) =>
      gridFractal3D(3, (i, j, k) => [i, j, k].filter(isMiddle).length >= 2, level),
  },
  {
    kind: "3d",
    id: "mosely",
    name: "Mosely Snowflake",
    group: "3D Cubes",
    blurb: "Pull out the 8 corners and the center. What's left is a chunky 3D snowflake.",
    minLevel: 0,
    maxLevel: 3,
    startLevel: 2,
    unit: "cubes",
    make: (level) =>
      gridFractal3D(
        3,
        (i, j, k) => {
          const middles = [i, j, k].filter(isMiddle).length;
          return middles !== 0 && middles !== 3;
        },
        level
      ),
  },
  {
    kind: "3d",
    id: "cube-dust",
    name: "Cube Dust",
    group: "3D Cubes",
    blurb: "Cantor Dust in 3D. Only the 8 corner cubes survive.",
    minLevel: 0,
    maxLevel: 4,
    startLevel: 3,
    unit: "cubes",
    make: (level) =>
      gridFractal3D(3, (i, j, k) => !isMiddle(i) && !isMiddle(j) && !isMiddle(k), level),
  },
  {
    kind: "3d",
    id: "cube-stairs",
    name: "Cube Pyramid",
    group: "3D Cubes",
    blurb: "The Staircase Triangle in 3D. Cut a cube into 8, keep 4, repeat.",
    minLevel: 0,
    maxLevel: 6,
    startLevel: 4,
    unit: "cubes",
    make: (level) => gridFractal3D(2, (i, j, k) => i + j + k <= 1, level),
  },
];
