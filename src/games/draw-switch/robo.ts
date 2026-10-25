// Robo, the drawing buddy for when you play by yourself. Robo isn't a real
// AI: it knows how to draw a few things from these recipes, and draws them
// a little wobbly, one line at a time, like a person would.

type Pt = [number, number];
type Op =
  | { k: "path"; c: string; s: number; pts: Pt[] } // a line through the points
  | { k: "fill"; c: string; x: number; y: number; rx: number; ry: number } // a filled-in blob
  | { k: "poly"; c: string; pts: Pt[] }; // a filled-in shape

// Recipes are drawn in a 100 × 100 box.
const ring = (x: number, y: number, rx: number, ry = rx, from = 0, to = Math.PI * 2, n = 28): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  return pts;
};
const path = (c: string, s: number, pts: Pt[]): Op => ({ k: "path", c, s, pts });
const dot = (c: string, x: number, y: number, rx: number, ry = rx): Op => ({ k: "fill", c, x, y, rx, ry });
const poly = (c: string, pts: Pt[]): Op => ({ k: "poly", c, pts });
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const star = (x: number, y: number, r: number): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  return pts;
};

const heart = (x: number, y: number, r: number): Pt[] =>
  Array.from({ length: 33 }, (_, i): Pt => {
    const t = (i / 32) * Math.PI * 2;
    return [x + (r * 16 * Math.sin(t) ** 3) / 17, y - (r * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 17];
  });
const wave = (y: number, h: number, from = 4, to = 96, bumps = 4): Pt[] =>
  Array.from({ length: bumps * 8 + 1 }, (_, i): Pt => [from + ((to - from) * i) / (bumps * 8), y + Math.sin((i / 8) * Math.PI * 2) * h]);
const spiral = (x: number, y: number, r: number, turns = 2.5): Pt[] =>
  Array.from({ length: 41 }, (_, i): Pt => {
    const a = (i / 40) * turns * Math.PI * 2;
    return [x + Math.cos(a) * (r * i) / 40, y + Math.sin(a) * (r * i) / 40];
  });
const sunRays = (c: string, x: number, y: number, from: number, to: number): Op[] =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return path(c, 4, [[x + Math.cos(a) * from, y + Math.sin(a) * from], [x + Math.cos(a) * to, y + Math.sin(a) * to]]);
  });
const petals = (c: string, x: number, y: number, d: number, r: number, n = 6): Op[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return dot(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r);
  });

const DARK = "#1f1f2e";

export const ROBO_THEMES: { theme: string; ops: Op[] }[] = [
  {
    theme: "🌈 A rainbow",
    ops: [
      ...["#e8383d", "#ff8a3d", "#ffd23f", "#4cc76a", "#3b82f6", "#6a3fd1"].map((c, i) =>
        path(c, 6, ring(50, 80, 46 - i * 6, 46 - i * 6, Math.PI, Math.PI * 2)),
      ),
      dot("#bcdcff", 8, 80, 9), dot("#bcdcff", 17, 76, 9), dot("#bcdcff", 92, 80, 9), dot("#bcdcff", 83, 76, 9),
    ],
  },
  {
    theme: "☀️ A sunny day",
    ops: [
      dot("#ffd23f", 50, 50, 20),
      ...Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return path("#ff8a3d", 4, [[50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25], [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38]]);
      }),
      dot(DARK, 43, 46, 2.2), dot(DARK, 57, 46, 2.2),
      path(DARK, 3, ring(50, 52, 9, 7, 0.3, Math.PI - 0.3, 10)),
    ],
  },
  {
    theme: "🏠 A house",
    ops: [
      path("#e8383d", 5, box(20, 48, 80, 95)),
      path("#9a6334", 5, [[14, 50], [50, 16], [86, 50], [14, 50]]),
      path("#9a6334", 5, [[66, 34], [66, 20], [74, 20], [74, 41]]),
      path("#9a6334", 4, box(43, 72, 57, 95)),
      dot("#ffd23f", 54, 84, 1.5),
      path("#3b82f6", 4, box(26, 58, 38, 70)),
      path("#3b82f6", 3, [[32, 58], [32, 70]]),
      path("#3b82f6", 4, box(62, 58, 74, 70)),
      path("#3b82f6", 3, [[68, 58], [68, 70]]),
    ],
  },
  {
    theme: "🌸 A flower garden",
    ops: [
      path("#4cc76a", 4, [[0, 96], [10, 92], [20, 96], [30, 92], [40, 96], [50, 92], [60, 96], [70, 92], [80, 96], [90, 92], [100, 96]]),
      ...[[20, "#ff6fa8"], [50, "#c084fc"], [80, "#ff8a3d"]].flatMap(([x, c]) => {
        const fx = x as number;
        return [
          path("#4cc76a", 4, [[fx, 95], [fx + 2, 75], [fx, 58]]),
          ...Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return dot(c as string, fx + Math.cos(a) * 8, 50 + Math.sin(a) * 8, 6);
          }),
          dot("#ffd23f", fx, 50, 5),
        ];
      }),
    ],
  },
  {
    theme: "🐱 A cat",
    ops: [
      path("#ff8a3d", 5, ring(50, 76, 20, 17)),
      path("#ff8a3d", 5, ring(50, 42, 19)),
      path("#ff8a3d", 5, [[35, 30], [33, 12], [46, 24]]),
      path("#ff8a3d", 5, [[54, 24], [67, 12], [65, 30]]),
      dot(DARK, 43, 40, 2.5), dot(DARK, 57, 40, 2.5),
      dot("#ff6fa8", 50, 47, 2),
      path(DARK, 2, [[44, 48], [28, 45]]), path(DARK, 2, [[44, 50], [28, 53]]),
      path(DARK, 2, [[56, 48], [72, 45]]), path(DARK, 2, [[56, 50], [72, 53]]),
      path("#ff8a3d", 5, [[69, 82], [84, 78], [88, 62], [82, 52]]),
    ],
  },
  {
    theme: "⛄ A snowman",
    ops: [
      path("#5fa8ff", 4, ring(50, 80, 17)),
      path("#5fa8ff", 4, ring(50, 52, 13)),
      path("#5fa8ff", 4, ring(50, 30, 10)),
      dot(DARK, 46, 28, 1.8), dot(DARK, 54, 28, 1.8),
      path("#ff8a3d", 4, [[50, 32], [61, 34]]),
      dot(DARK, 50, 48, 1.8), dot(DARK, 50, 56, 1.8),
      path("#9a6334", 3, [[38, 50], [22, 40], [18, 34]]),
      path("#9a6334", 3, [[62, 50], [78, 40], [82, 34]]),
      path(DARK, 5, box(42, 12, 58, 20)), path(DARK, 5, [[38, 21], [62, 21]]),
    ],
  },
  {
    theme: "🚀 A rocket",
    ops: [
      path("#6b7280", 5, [[50, 6], [64, 30], [64, 74], [36, 74], [36, 30], [50, 6]]),
      dot("#5fe0ff", 50, 40, 7),
      path("#e8383d", 5, [[36, 58], [24, 78], [36, 74]]),
      path("#e8383d", 5, [[64, 58], [76, 78], [64, 74]]),
      path("#ff8a3d", 5, [[42, 76], [46, 92], [50, 80], [54, 94], [58, 76]]),
      path("#ffd23f", 4, [[46, 77], [50, 88], [54, 77]]),
    ],
  },
  {
    theme: "🐠 Under the sea",
    ops: [
      path("#4cc76a", 4, [[12, 98], [8, 86], [14, 74], [8, 62], [12, 52]]),
      path("#4cc76a", 4, [[90, 98], [94, 86], [88, 74], [94, 64]]),
      dot("#ff8a3d", 45, 50, 22, 14),
      path("#ff8a3d", 5, [[66, 50], [84, 36], [84, 64], [66, 50]]),
      path("#ffffff", 4, [[40, 37], [42, 63]]),
      dot(DARK, 32, 46, 2.5),
      path("#5fa8ff", 2, ring(30, 24, 3)), path("#5fa8ff", 2, ring(24, 12, 4)), path("#5fa8ff", 2, ring(32, 4, 2.5)),
    ],
  },
  {
    theme: "🚗 A car",
    ops: [
      path("#e8383d", 5, box(10, 56, 90, 78)),
      path("#e8383d", 5, [[26, 56], [36, 36], [64, 36], [74, 56]]),
      path("#5fe0ff", 4, [[38, 52], [41, 40], [59, 40], [62, 52], [38, 52]]),
      dot(DARK, 28, 80, 9), dot(DARK, 72, 80, 9),
      dot("#c9ced6", 28, 80, 3.5), dot("#c9ced6", 72, 80, 3.5),
      dot("#ffd23f", 88, 62, 3),
    ],
  },
  {
    theme: "🍦 Ice cream",
    ops: [
      path("#d9a066", 5, [[34, 54], [66, 54], [50, 96], [34, 54]]),
      path("#b97d45", 2, [[40, 60], [56, 82]]), path("#b97d45", 2, [[50, 58], [60, 70]]),
      path("#b97d45", 2, [[60, 60], [44, 82]]), path("#b97d45", 2, [[50, 58], [40, 70]]),
      dot("#ffb8dc", 50, 47, 16, 12),
      dot("#9a6334", 50, 28, 13, 11),
      dot("#e8383d", 50, 14, 4),
      path("#4cc76a", 2, [[50, 10], [54, 4]]),
    ],
  },
  {
    theme: "🦋 A butterfly",
    ops: [
      dot("#c084fc", 34, 36, 15), dot("#c084fc", 66, 36, 15),
      dot("#ff6fa8", 37, 62, 11), dot("#ff6fa8", 63, 62, 11),
      dot("#ffd23f", 34, 36, 5), dot("#ffd23f", 66, 36, 5),
      path(DARK, 6, [[50, 24], [50, 76]]),
      path(DARK, 2, [[50, 26], [42, 10], [38, 8]]),
      path(DARK, 2, [[50, 26], [58, 10], [62, 8]]),
    ],
  },
  {
    theme: "🎃 A pumpkin",
    ops: [
      dot("#ff8a3d", 36, 62, 20, 24), dot("#ff8a3d", 64, 62, 20, 24), dot("#ff9a4d", 50, 62, 18, 26),
      path("#d9661f", 2, [[50, 38], [48, 62], [50, 86]]),
      path("#4cc76a", 6, [[50, 38], [52, 28], [58, 24]]),
      path(DARK, 3, [[38, 54], [42, 48], [46, 54], [38, 54]]),
      path(DARK, 3, [[54, 54], [58, 48], [62, 54], [54, 54]]),
      path(DARK, 3, [[38, 70], [44, 74], [50, 70], [56, 74], [62, 70]]),
    ],
  },
  {
    theme: "🌙 The night sky",
    ops: [
      dot("#ffd23f", 34, 34, 18),
      dot("#ffffff", 42, 28, 16),
      path("#ffd23f", 3, star(72, 22, 8)),
      path("#ffd23f", 3, star(84, 52, 6)),
      path("#ffd23f", 3, star(58, 70, 7)),
      path("#ffd23f", 3, star(22, 80, 6)),
      path("#ffd23f", 3, star(88, 86, 5)),
    ],
  },
  {
    theme: "🌳 A tree",
    ops: [
      path("#9a6334", 10, [[50, 98], [50, 58]]),
      path("#9a6334", 5, [[50, 70], [38, 60]]),
      dot("#4cc76a", 50, 40, 20), dot("#4cc76a", 33, 52, 15), dot("#4cc76a", 67, 52, 15), dot("#3fae5a", 50, 24, 14),
      dot("#e8383d", 40, 42, 3), dot("#e8383d", 60, 36, 3), dot("#e8383d", 56, 54, 3), dot("#e8383d", 34, 56, 3),
    ],
  },
  // Robo can help with every theme you might get, too.
  { theme: "☀️ The sun", ops: [dot("#ffd23f", 50, 50, 22), ...sunRays("#ff8a3d", 50, 50, 28, 42)] },
  { theme: "⭐ A star", ops: [poly("#ffd23f", star(50, 54, 44)), path("#ff8a3d", 4, star(50, 54, 44))] },
  { theme: "❤️ A heart", ops: [poly("#e8383d", heart(50, 52, 40)), path("#b4232a", 3, heart(50, 52, 40))] },
  {
    theme: "🍎 An apple",
    ops: [dot("#e8383d", 40, 62, 24, 28), dot("#e8383d", 60, 62, 24, 28), path("#9a6334", 5, [[50, 38], [52, 26], [56, 16]]), dot("#4cc76a", 64, 24, 9, 5)],
  },
  {
    theme: "🎈 A balloon",
    ops: [dot("#e8383d", 50, 38, 26, 32), poly("#e8383d", [[45, 74], [55, 74], [50, 68]]), path(DARK, 2, [[50, 74], [45, 82], [55, 90], [50, 99]]), dot("#ffffff", 40, 26, 4, 7)],
  },
  {
    theme: "🌸 A flower",
    ops: [path("#4cc76a", 5, [[50, 98], [48, 70], [50, 50]]), dot("#4cc76a", 60, 76, 9, 4), ...petals("#ff6fa8", 50, 38, 15, 11), dot("#ffd23f", 50, 38, 9)],
  },
  {
    theme: "🌙 The moon",
    ops: [poly("#ffd23f", [...ring(50, 50, 36, 36, Math.PI / 2, (Math.PI * 3) / 2), ...ring(50, 50, 16, 36, (Math.PI * 3) / 2, Math.PI / 2)]), path("#ffd23f", 3, star(80, 26, 7)), path("#ffd23f", 3, star(78, 74, 5))],
  },
  { theme: "☁️ A cloud", ops: [dot("#bcdcff", 30, 58, 18), dot("#bcdcff", 50, 46, 24), dot("#bcdcff", 72, 56, 18), dot("#bcdcff", 50, 64, 26, 13)] },
  { theme: "🍭 A lollipop", ops: [path("#8a8f98", 5, [[50, 60], [50, 98]]), dot("#ff6fa8", 50, 36, 26), path("#6a3fd1", 4, spiral(50, 36, 22))] },
  {
    theme: "🐟 A fish",
    ops: [dot("#3b82f6", 44, 50, 28, 18), poly("#3b82f6", [[66, 50], [92, 30], [92, 70]]), path("#5fe0ff", 4, [[38, 36], [40, 64]]), dot("#ffffff", 28, 45, 5), dot(DARK, 27, 45, 2.5)],
  },
  {
    theme: "🐛 A worm",
    ops: [...[0, 1, 2, 3, 4, 5].map((i) => dot(i % 2 ? "#4cc76a" : "#c8f06a", 16 + i * 12, 62 + Math.sin(i * 1.3) * 8, 9)), dot("#4cc76a", 84, 52, 11), dot(DARK, 81, 49, 2), dot(DARK, 88, 49, 2), path(DARK, 2, [[80, 42], [76, 30]]), path(DARK, 2, [[88, 42], [92, 30]])],
  },
  {
    theme: "🍩 A donut",
    ops: [
      path("#d9a066", 20, ring(50, 50, 26)), path("#ff6fa8", 13, ring(50, 50, 26)),
      ...([[38, 30, "#ffd23f"], [60, 28, "#3b82f6"], [74, 46, "#4cc76a"], [70, 66, "#ffd23f"], [48, 76, "#3b82f6"], [28, 62, "#4cc76a"], [26, 42, "#ffffff"]] as const).map(([x, y, c]) => path(c, 2, [[x - 2, y - 2], [x + 2, y + 2]])),
    ],
  },
  {
    theme: "⚽ A ball",
    ops: [
      path(DARK, 4, ring(50, 50, 38)), poly(DARK, ring(50, 50, 12, 12, -Math.PI / 2, Math.PI * 1.5, 5)),
      ...Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        return path(DARK, 3, [[50 + Math.cos(a) * 12, 50 + Math.sin(a) * 12], [50 + Math.cos(a) * 38, 50 + Math.sin(a) * 38]]);
      }),
    ],
  },
  { theme: "😊 A happy face", ops: [dot("#ffd23f", 50, 50, 40), dot(DARK, 38, 40, 4), dot(DARK, 62, 40, 4), dot("#ff6fa8", 28, 56, 5, 3), dot("#ff6fa8", 72, 56, 5, 3), path(DARK, 4, ring(50, 52, 20, 18, 0.3, Math.PI - 0.3, 12))] },
  { theme: "🌊 Waves", ops: [path("#3b82f6", 6, wave(36, 7)), path("#5fe0ff", 6, wave(58, 7)), path("#2fbfa8", 6, wave(80, 7))] },
  {
    theme: "🍕 Pizza",
    ops: [poly("#ffd23f", [[18, 18], [82, 18], [50, 96]]), path("#d9a066", 9, [[16, 18], [84, 18]]), dot("#e8383d", 40, 34, 6), dot("#e8383d", 60, 36, 6), dot("#e8383d", 50, 58, 6), dot("#4cc76a", 48, 40, 2.5), dot("#4cc76a", 56, 70, 2.5)],
  },
  {
    theme: "🐌 A snail",
    ops: [
      path("#4cc76a", 9, [[12, 82], [88, 82]]), path("#4cc76a", 9, [[18, 82], [14, 62]]),
      path(DARK, 2, [[14, 62], [8, 46]]), path(DARK, 2, [[16, 62], [24, 46]]), dot(DARK, 8, 46, 2), dot(DARK, 24, 46, 2),
      dot("#ff8a3d", 56, 56, 26), path("#9a6334", 4, spiral(56, 56, 22)),
    ],
  },
  {
    theme: "🎂 A cake",
    ops: [poly("#ffb8dc", box(16, 52, 84, 94)), path("#ff6fa8", 6, wave(54, 3, 16, 84, 5)), path("#ff6fa8", 4, wave(74, 3, 16, 84, 5)), poly("#5fe0ff", box(46, 28, 54, 52)), dot("#ff8a3d", 50, 20, 4, 7), dot("#ffd23f", 50, 22, 2, 3)],
  },
  { theme: "🥚 An egg", ops: [dot("#fff4c9", 50, 54, 28, 36), path("#d9a066", 3, ring(50, 54, 28, 36))] },
  {
    theme: "🍌 A banana",
    ops: [poly("#ffd23f", [...ring(50, 16, 42, 64, Math.PI * 0.15, Math.PI * 0.85), ...ring(50, 16, 36, 50, Math.PI * 0.85, Math.PI * 0.15)]), dot("#9a6334", 13, 44, 3), dot("#9a6334", 88, 44, 3)],
  },
  {
    theme: "🍓 A strawberry",
    ops: [
      poly("#e8383d", [[50, 96], [24, 64], [20, 42], [34, 30], [50, 32], [66, 30], [80, 42], [76, 64]]),
      poly("#4cc76a", [[30, 30], [42, 18], [50, 26], [58, 18], [70, 30], [50, 36]]),
      ...([[36, 46], [50, 44], [64, 46], [42, 60], [58, 60], [50, 76], [32, 56], [68, 56]] as const).map(([x, y]) => dot("#ffd23f", x, y, 1.8)),
    ],
  },
  {
    theme: "☂️ An umbrella",
    ops: [poly("#6a3fd1", [...ring(50, 52, 44, 36, Math.PI, Math.PI * 2, 20), ...wave(52, 3, 94, 6, 4)]), path(DARK, 4, [[50, 52], [50, 88]]), path(DARK, 4, ring(43, 88, 7, 7, 0, Math.PI, 10))],
  },
  {
    theme: "🌻 A sunflower",
    ops: [path("#4cc76a", 6, [[50, 98], [50, 50]]), dot("#4cc76a", 40, 78, 9, 4), ...petals("#ffd23f", 50, 36, 18, 9, 10), dot("#9a6334", 50, 36, 13)],
  },
  { theme: "🔺 A triangle", ops: [poly("#ff8a3d", [[50, 10], [92, 88], [8, 88]]), path("#e8383d", 5, [[50, 10], [92, 88], [8, 88], [50, 10]])] },
];

export const ROBO_MS = 18_000; // how long Robo takes to draw

/**
 * Robo draws `theme` into a `size` box at (x, y), a bit at a time. Calls
 * `done` when it's finished. `finish()` makes Robo hurry up and finish now.
 */
export function roboDraw(
  pen: CanvasRenderingContext2D, theme: string, x: number, y: number, size: number, done: () => void,
): { stop(): void; finish(): void } {
  const recipe = ROBO_THEMES.find((r) => r.theme === theme) ?? ROBO_THEMES[0]!;
  const k = size / 100;
  const wob = (): number => (Math.random() - 0.5) * 1.2;
  // Every line piece and blob is one step; Robo works through them evenly.
  const steps: (() => void)[] = [];
  for (const op of recipe.ops) {
    if (op.k === "poly") {
      const pts = op.pts.map(([px, py]): Pt => [x + (px + wob()) * k, y + (py + wob()) * k]);
      steps.push(() => {
        pen.fillStyle = op.c;
        pen.beginPath();
        pts.forEach(([px, py], i) => (i ? pen.lineTo(px, py) : pen.moveTo(px, py)));
        pen.closePath();
        pen.fill();
      });
      continue;
    }
    if (op.k === "fill") {
      const fx = x + (op.x + wob()) * k, fy = y + (op.y + wob()) * k;
      for (let grow = 1; grow <= 4; grow++) {
        steps.push(() => {
          pen.fillStyle = op.c;
          pen.beginPath();
          pen.ellipse(fx, fy, (op.rx * k * grow) / 4, (op.ry * k * grow) / 4, 0, 0, Math.PI * 2);
          pen.fill();
        });
      }
      continue;
    }
    const pts = op.pts.map(([px, py]): Pt => [x + (px + wob()) * k, y + (py + wob()) * k]);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      steps.push(() => {
        pen.strokeStyle = op.c;
        pen.lineWidth = op.s * k * 1.4;
        pen.lineCap = "round";
        pen.lineJoin = "round";
        pen.beginPath();
        pen.moveTo(a[0], a[1]);
        pen.lineTo(b[0], b[1]);
        pen.stroke();
      });
    }
  }
  const start = performance.now();
  let drawn = 0;
  let stopped = false;
  const frame = (now: number): void => {
    if (stopped) return;
    const want = Math.min(steps.length, Math.ceil((steps.length * (now - start)) / (ROBO_MS - 1500)));
    while (drawn < want) steps[drawn++]!();
    if (drawn >= steps.length && now - start >= ROBO_MS) {
      done();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    stop: () => (stopped = true),
    finish: () => {
      if (stopped) return;
      stopped = true;
      while (drawn < steps.length) steps[drawn++]!();
      done();
    },
  };
}
