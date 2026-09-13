// The Simulation's card on the Games 5 hub is a sheet of brushed 316 stainless
// steel, with a calculator screen for a title that punches THE SIMULATION in
// one key at a time, in green on black.

// ---------- the stainless steel ----------

// Brushed steel: a cool grey with broad shines across it, thousands of thin
// brush strokes, and a little grain. Returns an image URL, or "" if the browser
// can't draw.
export function paintBrushedSteel(width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) return "";

  const shine = g.createLinearGradient(0, 0, width, height);
  shine.addColorStop(0, "#8f959a");
  shine.addColorStop(0.28, "#d3d7da");
  shine.addColorStop(0.46, "#a2a7ac");
  shine.addColorStop(0.7, "#e4e7e9");
  shine.addColorStop(1, "#8c9297");
  g.fillStyle = shine;
  g.fillRect(0, 0, width, height);

  // The brush marks all run the same way, like the steel was polished side to side.
  const strokes = Math.round((width * height) / 180);
  for (let i = 0; i < strokes; i += 1) {
    g.fillStyle =
      Math.random() < 0.5
        ? `rgba(255, 255, 255, ${0.03 + Math.random() * 0.07})`
        : `rgba(20, 24, 28, ${0.02 + Math.random() * 0.06})`;
    g.fillRect(Math.random() * width - 200, Math.random() * height, 60 + Math.random() * 600, Math.random() < 0.15 ? 2 : 1);
  }

  const pixels = g.getImageData(0, 0, width, height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 14;
    data[i] = (data[i] ?? 0) + grain;
    data[i + 1] = (data[i + 1] ?? 0) + grain;
    data[i + 2] = (data[i + 2] ?? 0) + grain;
  }
  g.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}

// ---------- the calculator screen ----------

// Each spot on the screen is a 14-segment display, like the ones that can show
// letters: the outline of an 8, a middle bar split in two, a line down the
// middle, and four diagonals.
type Segment =
  | "top"
  | "upperRight"
  | "lowerRight"
  | "bottom"
  | "lowerLeft"
  | "upperLeft"
  | "midLeft"
  | "midRight"
  | "upperMid"
  | "lowerMid"
  | "diagUpLeft"
  | "diagUpRight"
  | "diagDownLeft"
  | "diagDownRight";

const SEGMENTS: Segment[] = [
  "top",
  "upperRight",
  "lowerRight",
  "bottom",
  "lowerLeft",
  "upperLeft",
  "midLeft",
  "midRight",
  "upperMid",
  "lowerMid",
  "diagUpLeft",
  "diagUpRight",
  "diagDownLeft",
  "diagDownRight",
];

const OUTLINE: Segment[] = ["top", "upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"];

const CHARACTERS: Record<string, Segment[]> = {
  A: ["top", "upperRight", "lowerRight", "lowerLeft", "upperLeft", "midLeft", "midRight"],
  B: ["top", "upperRight", "lowerRight", "bottom", "midRight", "upperMid", "lowerMid"],
  C: ["top", "bottom", "lowerLeft", "upperLeft"],
  D: ["top", "upperRight", "lowerRight", "bottom", "upperMid", "lowerMid"],
  E: ["top", "bottom", "lowerLeft", "upperLeft", "midLeft", "midRight"],
  F: ["top", "lowerLeft", "upperLeft", "midLeft"],
  G: ["top", "lowerRight", "bottom", "lowerLeft", "upperLeft", "midRight"],
  H: ["upperRight", "lowerRight", "lowerLeft", "upperLeft", "midLeft", "midRight"],
  I: ["top", "bottom", "upperMid", "lowerMid"],
  J: ["upperRight", "lowerRight", "bottom", "lowerLeft"],
  K: ["lowerLeft", "upperLeft", "midLeft", "diagUpRight", "diagDownRight"],
  L: ["bottom", "lowerLeft", "upperLeft"],
  M: ["upperRight", "lowerRight", "lowerLeft", "upperLeft", "diagUpLeft", "diagUpRight"],
  N: ["upperRight", "lowerRight", "lowerLeft", "upperLeft", "diagUpLeft", "diagDownRight"],
  O: OUTLINE,
  P: ["top", "upperRight", "lowerLeft", "upperLeft", "midLeft", "midRight"],
  Q: [...OUTLINE, "diagDownRight"],
  R: ["top", "upperRight", "lowerLeft", "upperLeft", "midLeft", "midRight", "diagDownRight"],
  S: ["top", "lowerRight", "bottom", "upperLeft", "midLeft", "midRight"],
  T: ["top", "upperMid", "lowerMid"],
  U: ["upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"],
  V: ["lowerLeft", "upperLeft", "diagDownLeft", "diagUpRight"],
  W: ["upperRight", "lowerRight", "lowerLeft", "upperLeft", "diagDownLeft", "diagDownRight"],
  X: ["diagUpLeft", "diagUpRight", "diagDownLeft", "diagDownRight"],
  Y: ["diagUpLeft", "diagUpRight", "lowerMid"],
  Z: ["top", "bottom", "diagUpRight", "diagDownLeft"],
  "0": [...OUTLINE, "diagUpRight", "diagDownLeft"],
  "1": ["upperRight", "lowerRight"],
  "2": ["top", "upperRight", "bottom", "lowerLeft", "midLeft", "midRight"],
  "3": ["top", "upperRight", "lowerRight", "bottom", "midRight"],
  "4": ["upperRight", "lowerRight", "upperLeft", "midLeft", "midRight"],
  "5": ["top", "lowerRight", "bottom", "upperLeft", "midLeft", "midRight"],
  "6": ["top", "lowerRight", "bottom", "lowerLeft", "upperLeft", "midLeft", "midRight"],
  "7": ["top", "upperRight", "lowerRight"],
  "8": [...OUTLINE, "midLeft", "midRight"],
  "9": ["top", "upperRight", "lowerRight", "bottom", "upperLeft", "midLeft", "midRight"],
  "-": ["midLeft", "midRight"],
};

// Like a real calculator, the screen has a fixed row of spots and what you type
// comes in on the right, pushing everything before it to the left. Sizes are
// for a 960 by 200 canvas.
const CELLS = 16;
const CELL_W = 42;
const CELL_H = 100;
const ADVANCE = 58;
// Thick enough to still read when the screen is shrunk down onto a card.
const THICK = 9;
const LIT = "#43ff7e";
// Real LCDs show the unlit segments very faintly.
const GHOST = "rgba(67, 255, 126, 0.08)";

const TYPE_START_MS = 700;
const KEY_MS = 170;

function segmentLines(x: number, y: number): Record<Segment, [number, number, number, number]> {
  const x0 = x;
  const x1 = x + CELL_W;
  const xc = x + CELL_W / 2;
  const y0 = y;
  const ym = y + CELL_H / 2;
  const y1 = y + CELL_H;
  const gap = THICK * 0.9;
  const diag = THICK * 1.4;
  return {
    top: [x0 + gap, y0, x1 - gap, y0],
    bottom: [x0 + gap, y1, x1 - gap, y1],
    midLeft: [x0 + gap, ym, xc - gap, ym],
    midRight: [xc + gap, ym, x1 - gap, ym],
    upperLeft: [x0, y0 + gap, x0, ym - gap],
    lowerLeft: [x0, ym + gap, x0, y1 - gap],
    upperRight: [x1, y0 + gap, x1, ym - gap],
    lowerRight: [x1, ym + gap, x1, y1 - gap],
    upperMid: [xc, y0 + gap, xc, ym - gap],
    lowerMid: [xc, ym + gap, xc, y1 - gap],
    diagUpLeft: [x0 + diag, y0 + diag, xc - diag * 0.6, ym - diag],
    diagUpRight: [x1 - diag, y0 + diag, xc + diag * 0.6, ym - diag],
    diagDownLeft: [x0 + diag, y1 - diag, xc - diag * 0.6, ym + diag],
    diagDownRight: [x1 - diag, y1 - diag, xc + diag * 0.6, ym + diag],
  };
}

function drawScreen(ctx: CanvasRenderingContext2D, typed: string): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Calculator digits lean forward a little.
  const top = (height - CELL_H) / 2;
  const left = (width - (CELLS - 1) * ADVANCE - CELL_W) / 2;
  ctx.setTransform(1, 0, -0.08, 1, 0.08 * (top + CELL_H / 2), 0);
  ctx.lineWidth = THICK;
  ctx.lineCap = "round";
  ctx.shadowColor = LIT;

  const shown = typed.slice(-CELLS).padStart(CELLS, " ");
  for (let cell = 0; cell < CELLS; cell += 1) {
    const lit = CHARACTERS[shown[cell] ?? " "] ?? [];
    const lines = segmentLines(left + cell * ADVANCE, top);
    for (const segment of SEGMENTS) {
      const on = lit.includes(segment);
      const [ax, ay, bx, by] = lines[segment];
      ctx.strokeStyle = on ? LIT : GHOST;
      ctx.shadowBlur = on ? 14 : 0;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

// Punch text into the calculator screen one key at a time.
export function typeOnCalculatorScreen(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const typeKey = (count: number): void => {
    drawScreen(ctx, text.slice(0, count));
    if (count >= text.length) return;
    window.setTimeout(() => typeKey(count + 1), KEY_MS + Math.random() * 90);
  };
  drawScreen(ctx, "");
  window.setTimeout(() => typeKey(1), TYPE_START_MS);
}
