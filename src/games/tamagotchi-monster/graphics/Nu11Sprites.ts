import type { ColorTheme, GrowthStage } from "../model/types";
import { clamp, lerpColor, rgb, type Rgb } from "../systems/utils";

type Nu11DrawOptions = {
  wobble?: number;
  blink?: boolean;
  theme?: ColorTheme;
};

type Nu11Palette = {
  bodyLight: Rgb;
  bodyDark: Rgb;
  outline: Rgb;
  rim: Rgb;
  eye: Rgb;
  eyeAlt: Rgb;
  eyeGlow: Rgb;
  mouth: Rgb;
  accent: Rgb;
  bruise: Rgb;
};

type BodyShape = {
  width: number;
  height: number;
  crown: number;
  chin: number;
  waist: number;
  shoulder?: number;
  hip?: number;
  pinch?: number;
};

type EyeLayout = {
  count: number;
  rows: number;
  y: number;
  spread: number;
  radius: number;
  rowGap?: number;
  altEvery?: number;
  slitPupils?: boolean;
};

type MouthConfig =
  | {
      kind: "smile";
      y: number;
      width: number;
      curve: number;
    }
  | {
      kind: "maw";
      y: number;
      width: number;
      height: number;
      teeth: number;
    }
  | {
      kind: "void";
      y: number;
      radius: number;
    };

type TentacleRig = {
  count: number;
  spread: number;
  rootY: number;
  length: number;
  thickness: number;
  sway: number;
  curl: number;
  speed: number;
  phase: number;
};

type StageRenderConfig = {
  shape: BodyShape;
  eyes: EyeLayout;
  mouth: MouthConfig;
  rearTentacles?: TentacleRig;
  frontTentacles?: TentacleRig;
  horns?: number;
  wingFlares?: number;
  mask?: boolean;
  ribMarks?: number;
  aura?: number;
  float?: number;
  spectralAlpha?: number;
  speckles?: number;
};

type Point = {
  x: number;
  y: number;
};

const NU11_TERROR: Record<GrowthStage, number> = {
  egg: 0.05,
  baby: 0.1,
  child: 0.15,
  teen: 0.25,
  monster: 0.35,
  shadow: 0.45,
  specter: 0.52,
  wraith: 0.58,
  phantom: 0.64,
  revenant: 0.7,
  nightmare: 0.78,
  void_walker: 0.85,
  abyss: 0.92,
  eldritch: 0.96,
  corrupted: 0.98,
  xyy4: 1,
};

function getTerror(stage: GrowthStage): number {
  return NU11_TERROR[stage] ?? 0.5;
}

function getPalette(stage: GrowthStage): Nu11Palette {
  const t = clamp(getTerror(stage), 0, 1);
  return {
    bodyLight: lerpColor([130, 130, 160], [38, 44, 55], t),
    bodyDark: lerpColor([65, 65, 92], [10, 12, 19], t),
    outline: lerpColor([30, 30, 44], [6, 8, 12], t),
    rim: lerpColor([205, 185, 228], [94, 255, 134], t),
    eye: lerpColor([255, 76, 88], [255, 50, 72], t),
    eyeAlt: lerpColor([120, 228, 210], [85, 255, 130], t),
    eyeGlow: lerpColor([255, 132, 152], [132, 255, 150], t),
    mouth: lerpColor([118, 20, 30], [82, 10, 18], t),
    accent: lerpColor([98, 255, 120], [72, 220, 168], t),
    bruise: lerpColor([116, 82, 144], [78, 58, 108], t),
  };
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawSoftShadow(ctx: CanvasRenderingContext2D, size: number, terror: number): void {
  const radiusX = size * (0.48 + terror * 0.12);
  const radiusY = size * (0.2 + terror * 0.06);
  const grad = ctx.createRadialGradient(0, size * 0.58, size * 0.08, 0, size * 0.58, radiusX);
  grad.addColorStop(0, "rgba(0,0,0,0.32)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.58, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function createBodyPath(size: number, shape: BodyShape): Path2D {
  const w = size * shape.width;
  const h = size * shape.height;
  const topY = -h - size * shape.crown;
  const chinY = h * shape.chin;
  const waistX = w * shape.waist;
  const shoulderX = w * (shape.shoulder ?? 0.9);
  const hipX = w * (shape.hip ?? 0.72);
  const pinchY = -h * (shape.pinch ?? 0.12);

  const path = new Path2D();
  path.moveTo(0, topY);
  path.bezierCurveTo(waistX * 0.56, topY + size * 0.04, shoulderX, pinchY, w * 0.9, h * 0.45);
  path.quadraticCurveTo(hipX, chinY, 0, chinY);
  path.quadraticCurveTo(-hipX, chinY, -w * 0.9, h * 0.45);
  path.bezierCurveTo(-shoulderX, pinchY, -waistX * 0.56, topY + size * 0.04, 0, topY);
  path.closePath();
  return path;
}

function fillBody(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  size: number,
  palette: Nu11Palette,
  terror: number,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;

  const highlight = lerpColor(palette.bodyLight, [255, 255, 255], 0.08);
  const grad = ctx.createRadialGradient(-size * 0.22, -size * 0.38, size * 0.08, 0, 0, size * 0.95);
  grad.addColorStop(0, rgb(highlight));
  grad.addColorStop(0.58, rgb(palette.bodyLight));
  grad.addColorStop(1, rgb(palette.bodyDark));
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.strokeStyle = rgb(palette.outline, 0.95);
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.stroke(path);

  ctx.strokeStyle = rgb(palette.rim, 0.16 + terror * 0.14);
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.stroke(path);

  ctx.restore();
}

function drawAura(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, time: number, intensity: number): void {
  const pulse = 0.72 + 0.28 * Math.sin(time * 1.35);
  const grad = ctx.createRadialGradient(0, -size * 0.05, size * 0.12, 0, -size * 0.05, size * 1.05);
  grad.addColorStop(0, rgb(palette.accent, 0.18 * intensity * pulse));
  grad.addColorStop(0.55, rgb(palette.eyeGlow, 0.1 * intensity * pulse));
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.04, size * 0.95, size * 1.03, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpeckles(ctx: CanvasRenderingContext2D, size: number, count: number, color: string, time: number): void {
  for (let i = 0; i < count; i += 1) {
    const seed = i * 13.37;
    const x = (hash(seed) - 0.5) * size * 1.06;
    const y = (hash(seed + 4.9) - 0.5) * size * 1.2;
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 1.6 + i));
    ctx.fillStyle = color.replace("$A", twinkle.toFixed(3));
    ctx.fillRect(x, y, 1.3, 1.3);
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  palette: Nu11Palette,
  blink: boolean,
  time: number,
  alt = false,
  slitPupil = false
): void {
  if (blink) {
    ctx.strokeStyle = rgb(palette.eyeGlow, 0.86);
    ctx.lineWidth = Math.max(1.5, radius * 0.44);
    ctx.beginPath();
    ctx.moveTo(x - radius, y);
    ctx.quadraticCurveTo(x, y + radius * 0.24, x + radius, y);
    ctx.stroke();
    return;
  }

  const iris = alt ? palette.eyeAlt : palette.eye;
  const wobbleX = Math.sin(time * 1.8 + x * 0.12) * radius * 0.07;
  const wobbleY = Math.cos(time * 1.2 + y * 0.1) * radius * 0.05;

  ctx.fillStyle = rgb(lerpColor(iris, [255, 255, 255], 0.12));
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.76)";
  ctx.beginPath();
  if (slitPupil) {
    ctx.ellipse(x + wobbleX, y + wobbleY, radius * 0.2, radius * 0.47, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(x + wobbleX, y + wobbleY, radius * 0.34, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.fillStyle = rgb(palette.eyeGlow, 0.9);
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.22, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyeCluster(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  blink: boolean,
  time: number,
  layout: EyeLayout
): void {
  const rows = Math.max(1, layout.rows);
  const rowGap = size * (layout.rowGap ?? 0.18);
  let eyeIndex = 0;

  for (let row = 0; row < rows; row += 1) {
    const remainingRows = rows - row;
    const remainingEyes = layout.count - eyeIndex;
    const rowCount = Math.max(1, Math.ceil(remainingEyes / remainingRows));
    const span = size * layout.spread * (rowCount <= 1 ? 0 : 1);
    const rowY = size * layout.y + (row - (rows - 1) / 2) * rowGap;

    for (let col = 0; col < rowCount && eyeIndex < layout.count; col += 1) {
      const x = rowCount === 1 ? 0 : -span / 2 + (col / (rowCount - 1)) * span;
      const alt = layout.altEvery ? eyeIndex % layout.altEvery === 0 : false;
      drawEye(ctx, x, rowY, size * layout.radius, palette, blink, time, alt, layout.slitPupils ?? false);
      eyeIndex += 1;
    }
  }
}

function drawSmile(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  time: number,
  y: number,
  width: number,
  curve: number
): void {
  const smileLift = Math.sin(time * 1.3) * size * 0.018;
  ctx.strokeStyle = rgb(palette.mouth, 0.88);
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(-size * width * 0.5, size * y);
  ctx.quadraticCurveTo(0, size * (y + curve) + smileLift, size * width * 0.5, size * y);
  ctx.stroke();
}

function drawMaw(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  time: number,
  y: number,
  width: number,
  height: number,
  teeth: number
): void {
  const open = 1 + Math.sin(time * 1.7) * 0.08;
  const rx = size * width * 0.5;
  const ry = size * height * 0.5 * open;
  const cy = size * y;

  ctx.fillStyle = rgb(palette.mouth);
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineWidth = Math.max(2, size * 0.03);
  ctx.stroke();

  const topTeeth = Math.max(2, Math.ceil(teeth / 2));
  const bottomTeeth = Math.max(2, teeth - topTeeth);
  const toothColor = "rgba(236,236,228,0.9)";

  for (let i = 0; i < topTeeth; i += 1) {
    const t = topTeeth === 1 ? 0.5 : i / (topTeeth - 1);
    const tx = -rx * 0.84 + t * rx * 1.68;
    const tipY = cy - ry * 0.62;
    const baseY = cy - ry * 0.95;
    const half = size * width * 0.03;
    ctx.fillStyle = toothColor;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx + half, tipY);
    ctx.lineTo(tx - half, tipY);
    ctx.closePath();
    ctx.fill();
  }

  for (let i = 0; i < bottomTeeth; i += 1) {
    const t = bottomTeeth === 1 ? 0.5 : i / (bottomTeeth - 1);
    const tx = -rx * 0.84 + t * rx * 1.68;
    const tipY = cy + ry * 0.62;
    const baseY = cy + ry * 0.95;
    const half = size * width * 0.03;
    ctx.fillStyle = toothColor;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx + half, tipY);
    ctx.lineTo(tx - half, tipY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawVoidMouth(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  time: number,
  y: number,
  radius: number
): void {
  const r = size * radius;
  const cy = size * y;
  const pulse = 1 + Math.sin(time * 1.9) * 0.06;

  const portal = ctx.createRadialGradient(0, cy, r * 0.1, 0, cy, r * 1.15);
  portal.addColorStop(0, "rgba(5,8,12,0.1)");
  portal.addColorStop(0.48, "rgba(10,12,20,0.85)");
  portal.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = portal;
  ctx.beginPath();
  ctx.ellipse(0, cy, r * pulse, r * 0.95 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rgb(palette.eyeGlow, 0.3 + 0.18 * (0.5 + 0.5 * Math.sin(time * 1.6)));
  ctx.lineWidth = Math.max(1.5, size * 0.018);
  ctx.beginPath();
  ctx.ellipse(0, cy, r * 1.1 * pulse, r * 1.05 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTentacle(
  ctx: CanvasRenderingContext2D,
  root: Point,
  tip: Point,
  bend: number,
  width: number,
  palette: Nu11Palette
): void {
  const cp1: Point = { x: root.x + bend * 0.48, y: root.y + (tip.y - root.y) * 0.28 };
  const cp2: Point = { x: root.x + bend, y: root.y + (tip.y - root.y) * 0.72 };

  ctx.strokeStyle = rgb(palette.bodyDark, 0.95);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(root.x, root.y);
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tip.x, tip.y);
  ctx.stroke();

  ctx.strokeStyle = rgb(palette.accent, 0.45);
  ctx.lineWidth = Math.max(1, width * 0.34);
  ctx.beginPath();
  ctx.moveTo(root.x, root.y);
  ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, tip.x, tip.y);
  ctx.stroke();

  ctx.fillStyle = rgb(palette.bodyDark, 0.9);
  ctx.beginPath();
  ctx.arc(root.x, root.y, width * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawTentacleFan(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  time: number,
  rig: TentacleRig,
  alpha = 1
): void {
  if (rig.count <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const width = Math.max(2, size * rig.thickness);
  for (let i = 0; i < rig.count; i += 1) {
    const t = rig.count === 1 ? 0.5 : i / (rig.count - 1);
    const rootX = (t - 0.5) * size * rig.spread;
    const rootY = size * rig.rootY;
    const sway = Math.sin(time * rig.speed + rig.phase + i * 0.82) * size * rig.sway;
    const curl = (t - 0.5) * size * rig.curl;
    const tip: Point = {
      x: rootX + sway + curl,
      y: rootY + size * rig.length + Math.cos(time * 1.1 + i * 0.4) * size * 0.025,
    };
    const bend = (t - 0.5) * size * rig.spread * 0.55 + sway * 0.85;
    drawTentacle(ctx, { x: rootX, y: rootY }, tip, bend, width, palette);
  }

  ctx.restore();
}

function drawHorns(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, hornScale: number, time: number): void {
  const sway = Math.sin(time * 1.4) * size * 0.015;
  const baseY = -size * 0.5;
  const tipY = -size * (0.82 + hornScale * 0.2);
  const baseX = size * (0.24 + hornScale * 0.06);
  const tipX = size * (0.48 + hornScale * 0.13);

  ctx.fillStyle = rgb(palette.outline, 0.94);

  ctx.beginPath();
  ctx.moveTo(-baseX, baseY);
  ctx.lineTo(-tipX - sway, tipY);
  ctx.lineTo(-baseX * 0.58, baseY - size * 0.12);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX + sway, tipY);
  ctx.lineTo(baseX * 0.58, baseY - size * 0.12);
  ctx.closePath();
  ctx.fill();
}

function drawWingFlares(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, amount: number): void {
  const wingX = size * (0.6 + amount * 0.15);
  const wingTop = -size * 0.28;
  const wingBottom = size * 0.34;

  ctx.fillStyle = rgb(palette.bodyDark, 0.75);
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.12);
  ctx.lineTo(-wingX, wingTop);
  ctx.lineTo(-wingX * 0.82, wingBottom);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.45, -size * 0.12);
  ctx.lineTo(wingX, wingTop);
  ctx.lineTo(wingX * 0.82, wingBottom);
  ctx.closePath();
  ctx.fill();
}

function drawMask(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  const grad = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.2);
  grad.addColorStop(0, "rgba(240,230,220,0.92)");
  grad.addColorStop(1, "rgba(190,180,170,0.88)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.06, size * 0.28, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(78,62,58,0.6)";
  ctx.lineWidth = Math.max(1.2, size * 0.016);
  ctx.stroke();

  ctx.strokeStyle = "rgba(102,84,78,0.5)";
  ctx.beginPath();
  ctx.moveTo(-size * 0.16, -size * 0.08);
  ctx.lineTo(size * 0.14, size * 0.12);
  ctx.moveTo(-size * 0.06, size * 0.02 + Math.sin(time * 1.2) * size * 0.01);
  ctx.lineTo(size * 0.08, size * 0.04);
  ctx.stroke();
}

function drawRibMarks(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, count: number): void {
  ctx.strokeStyle = rgb(palette.outline, 0.72);
  ctx.lineWidth = Math.max(1.8, size * 0.022);
  for (let i = 0; i < count; i += 1) {
    const y = size * (0.02 + i * 0.14);
    const rx = size * (0.44 - i * 0.07);
    const ry = size * (0.17 - i * 0.02);
    ctx.beginPath();
    ctx.ellipse(0, y, rx, ry, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
  }
}

function drawConfiguredStage(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: Nu11Palette,
  terror: number,
  time: number,
  blink: boolean,
  config: StageRenderConfig
): void {
  ctx.save();
  if (config.float) {
    ctx.translate(0, Math.sin(time * 0.95 + terror * 2.6) * size * config.float);
  }

  if (config.aura && config.aura > 0) {
    drawAura(ctx, size, palette, time, config.aura);
  }

  if (config.rearTentacles) {
    drawTentacleFan(ctx, size, palette, time, config.rearTentacles, config.spectralAlpha ?? 1);
  }

  if (config.horns) {
    drawHorns(ctx, size, palette, config.horns, time);
  }

  if (config.wingFlares) {
    drawWingFlares(ctx, size, palette, config.wingFlares);
  }

  const bodyPath = createBodyPath(size, config.shape);
  fillBody(ctx, bodyPath, size, palette, terror, config.spectralAlpha ?? 1);

  if (config.speckles && config.speckles > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    drawSpeckles(ctx, size, config.speckles, "rgba(220,230,255,$A)", time);
    ctx.restore();
  }

  drawEyeCluster(ctx, size, palette, blink, time, config.eyes);

  if (config.mask) {
    drawMask(ctx, size, time);
  }

  if (config.ribMarks) {
    drawRibMarks(ctx, size, palette, config.ribMarks);
  }

  if (config.mouth.kind === "smile") {
    drawSmile(ctx, size, palette, time, config.mouth.y, config.mouth.width, config.mouth.curve);
  } else if (config.mouth.kind === "maw") {
    drawMaw(ctx, size, palette, time, config.mouth.y, config.mouth.width, config.mouth.height, config.mouth.teeth);
  } else {
    drawVoidMouth(ctx, size, palette, time, config.mouth.y, config.mouth.radius);
  }

  if (config.frontTentacles) {
    drawTentacleFan(ctx, size, palette, time, config.frontTentacles, config.spectralAlpha ?? 1);
  }

  ctx.restore();
}

function drawNightmare(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, time: number, blink: boolean): void {
  const body = new Path2D();
  body.ellipse(0, 0, size * 0.34, size * 0.46, 0, 0, Math.PI * 2);

  for (let i = 0; i < 8; i += 1) {
    const side = i < 4 ? -1 : 1;
    const idx = i % 4;
    const y = -size * 0.16 + idx * size * 0.11;
    const phase = time * 2 + i * 0.9;
    const kneeX = side * size * (0.48 + Math.sin(phase) * 0.08);
    const footX = side * size * (0.72 + Math.cos(phase * 0.7) * 0.06);
    const footY = size * (0.24 + idx * 0.04);

    ctx.strokeStyle = rgb(palette.bodyDark, 0.95);
    ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * size * 0.18, y);
    ctx.quadraticCurveTo(kneeX, y + size * 0.09, footX, footY);
    ctx.stroke();
  }

  fillBody(ctx, body, size, palette, 0.78, 1);

  drawEyeCluster(ctx, size, palette, blink, time, {
    count: 6,
    rows: 2,
    y: -0.16,
    spread: 0.4,
    radius: 0.056,
    rowGap: 0.17,
    altEvery: 2,
    slitPupils: true,
  });

  drawMaw(ctx, size, palette, time, 0.22, 0.36, 0.2, 8);
}

function drawNightmareIcon(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, time: number, blink: boolean): void {
  const body = new Path2D();
  body.ellipse(0, 0, size * 0.36, size * 0.45, 0, 0, Math.PI * 2);

  for (let i = 0; i < 6; i += 1) {
    const side = i < 3 ? -1 : 1;
    const idx = i % 3;
    const y = -size * 0.12 + idx * size * 0.13;
    const phase = time * 1.8 + i * 0.7;
    const footX = side * size * (0.62 + Math.sin(phase) * 0.05);
    const footY = size * (0.2 + idx * 0.05);

    ctx.strokeStyle = rgb(palette.bodyDark, 0.88);
    ctx.lineWidth = Math.max(1.5, size * 0.028);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * size * 0.2, y);
    ctx.quadraticCurveTo(side * size * 0.44, y + size * 0.08, footX, footY);
    ctx.stroke();
  }

  fillBody(ctx, body, size, palette, 0.78, 1);
  drawEyeCluster(ctx, size, palette, blink, time, {
    count: 3,
    rows: 1,
    y: -0.15,
    spread: 0.3,
    radius: 0.058,
    altEvery: 2,
    slitPupils: true,
  });
  drawMaw(ctx, size, palette, time, 0.2, 0.3, 0.16, 6);
}

function drawEgg(ctx: CanvasRenderingContext2D, size: number, palette: Nu11Palette, time: number): void {
  const shell = new Path2D();
  shell.ellipse(0, 0, size * 0.5, size * 0.68, 0, 0, Math.PI * 2);
  fillBody(ctx, shell, size, palette, 0.08, 0.95);

  const embryo = ctx.createRadialGradient(0, -size * 0.16, size * 0.04, 0, 0, size * 0.58);
  embryo.addColorStop(0, "rgba(132,130,198,0.28)");
  embryo.addColorStop(1, "rgba(132,130,198,0)");
  ctx.fillStyle = embryo;
  ctx.fill(shell);

  ctx.strokeStyle = rgb(palette.rim, 0.3 + 0.12 * Math.sin(time * 1.1));
  ctx.lineWidth = Math.max(1.2, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(-size * 0.12, -size * 0.42);
  ctx.lineTo(-size * 0.17, -size * 0.08);
  ctx.lineTo(-size * 0.08, size * 0.18);
  ctx.moveTo(size * 0.1, -size * 0.39);
  ctx.lineTo(size * 0.05, -size * 0.06);
  ctx.lineTo(size * 0.18, size * 0.14);
  ctx.stroke();
}

function cloneTentacleRig(rig: TentacleRig | undefined): TentacleRig | undefined {
  if (!rig) return undefined;
  return { ...rig };
}

function simplifyMouthForIcon(mouth: MouthConfig): MouthConfig {
  if (mouth.kind === "smile") {
    return { kind: "smile", y: mouth.y, width: mouth.width * 0.92, curve: mouth.curve * 0.82 };
  }
  if (mouth.kind === "maw") {
    return {
      kind: "maw",
      y: mouth.y,
      width: mouth.width * 0.84,
      height: mouth.height * 0.78,
      teeth: Math.max(4, Math.min(10, Math.round(mouth.teeth * 0.5))),
    };
  }
  return { kind: "void", y: mouth.y, radius: mouth.radius * 0.84 };
}

function toIconConfig(stage: GrowthStage, base: StageRenderConfig): StageRenderConfig {
  const rear = cloneTentacleRig(base.rearTentacles);
  const front = cloneTentacleRig(base.frontTentacles);

  if (rear) {
    rear.count = Math.max(0, Math.min(4, Math.ceil(rear.count * 0.45)));
    rear.length *= 0.72;
    rear.thickness *= 0.78;
    rear.sway *= 0.65;
    rear.curl *= 0.58;
  }
  if (front) {
    front.count = Math.max(0, Math.min(2, Math.ceil(front.count * 0.4)));
    front.length *= 0.72;
    front.thickness *= 0.78;
    front.sway *= 0.62;
    front.curl *= 0.55;
  }

  const eyesCount = base.eyes.count >= 5 ? 3 : Math.min(2, base.eyes.count);
  const iconEyes: EyeLayout = {
    ...base.eyes,
    count: eyesCount,
    rows: 1,
    spread: base.eyes.spread * (stage === "void_walker" ? 0.95 : 0.84),
    radius: base.eyes.radius * (stage === "child" ? 1 : 0.95),
    rowGap: undefined,
    altEvery: eyesCount >= 3 ? 2 : base.eyes.altEvery,
  };

  return {
    ...base,
    shape: {
      ...base.shape,
      crown: base.shape.crown * 0.72,
      waist: base.shape.waist * 0.92,
      shoulder: (base.shape.shoulder ?? 0.9) * 0.94,
      hip: (base.shape.hip ?? 0.72) * 0.94,
    },
    eyes: iconEyes,
    mouth: simplifyMouthForIcon(base.mouth),
    rearTentacles: rear && rear.count > 0 ? rear : undefined,
    frontTentacles: front && front.count > 0 ? front : undefined,
    horns: base.horns ? base.horns * 0.74 : undefined,
    wingFlares: base.wingFlares ? base.wingFlares * 0.65 : undefined,
    mask: stage === "phantom" ? true : false,
    ribMarks: base.ribMarks ? Math.min(2, base.ribMarks) : undefined,
    aura: base.aura ? base.aura * 0.58 : undefined,
    float: base.float ? base.float * 0.65 : undefined,
    speckles: 0,
  };
}

function getFullStageConfig(stage: GrowthStage): StageRenderConfig {
  switch (stage) {
    case "child":
      return {
        shape: { width: 0.52, height: 0.58, crown: 0.05, chin: 0.96, waist: 0.94 },
        eyes: { count: 2, rows: 1, y: -0.16, spread: 0.34, radius: 0.11 },
        mouth: { kind: "smile", y: 0.18, width: 0.28, curve: 0.08 },
        speckles: 6,
      };
    case "teen":
      return {
        shape: { width: 0.54, height: 0.66, crown: 0.08, chin: 0.96, waist: 0.98 },
        eyes: { count: 2, rows: 1, y: -0.2, spread: 0.36, radius: 0.1, slitPupils: true },
        mouth: { kind: "smile", y: 0.24, width: 0.32, curve: 0.07 },
        horns: 0.45,
        speckles: 10,
      };
    case "monster":
      return {
        shape: { width: 0.57, height: 0.66, crown: 0.1, chin: 0.98, waist: 1.02 },
        eyes: { count: 2, rows: 1, y: -0.18, spread: 0.38, radius: 0.1, slitPupils: true },
        mouth: { kind: "maw", y: 0.25, width: 0.5, height: 0.24, teeth: 10 },
        horns: 0.56,
        speckles: 12,
      };
    case "shadow":
      return {
        shape: { width: 0.56, height: 0.68, crown: 0.1, chin: 0.99, waist: 1.01 },
        eyes: { count: 2, rows: 1, y: -0.16, spread: 0.34, radius: 0.09 },
        mouth: { kind: "smile", y: 0.2, width: 0.34, curve: 0.05 },
        rearTentacles: {
          count: 3,
          spread: 0.5,
          rootY: 0.3,
          length: 0.56,
          thickness: 0.1,
          sway: 0.08,
          curl: 0.22,
          speed: 1.2,
          phase: 0,
        },
        spectralAlpha: 0.9,
        float: 0.02,
        speckles: 16,
      };
    case "specter":
      return {
        shape: { width: 0.54, height: 0.72, crown: 0.12, chin: 1.0, waist: 0.98 },
        eyes: { count: 2, rows: 1, y: -0.14, spread: 0.3, radius: 0.085 },
        mouth: { kind: "smile", y: 0.19, width: 0.3, curve: 0.04 },
        rearTentacles: {
          count: 4,
          spread: 0.56,
          rootY: 0.28,
          length: 0.62,
          thickness: 0.09,
          sway: 0.1,
          curl: 0.28,
          speed: 1.1,
          phase: 0.3,
        },
        aura: 0.25,
        spectralAlpha: 0.78,
        float: 0.05,
        speckles: 20,
      };
    case "wraith":
      return {
        shape: { width: 0.56, height: 0.76, crown: 0.15, chin: 1.02, waist: 1.0 },
        eyes: { count: 2, rows: 1, y: -0.25, spread: 0.2, radius: 0.075, slitPupils: true },
        mouth: { kind: "smile", y: 0.13, width: 0.26, curve: 0.035 },
        rearTentacles: {
          count: 4,
          spread: 0.52,
          rootY: 0.34,
          length: 0.58,
          thickness: 0.095,
          sway: 0.1,
          curl: 0.2,
          speed: 1.1,
          phase: 0.6,
        },
        frontTentacles: {
          count: 2,
          spread: 0.2,
          rootY: 0.36,
          length: 0.44,
          thickness: 0.08,
          sway: 0.06,
          curl: 0.08,
          speed: 1.2,
          phase: 1.4,
        },
        horns: 0.4,
        spectralAlpha: 0.86,
        float: 0.04,
        speckles: 24,
      };
    case "phantom":
      return {
        shape: { width: 0.49, height: 0.84, crown: 0.19, chin: 1.08, waist: 0.85, shoulder: 0.68, hip: 0.58, pinch: 0.2 },
        eyes: { count: 2, rows: 1, y: -0.1, spread: 0.22, radius: 0.07, altEvery: 2 },
        mouth: { kind: "smile", y: 0.18, width: 0.22, curve: 0.03 },
        rearTentacles: {
          count: 4,
          spread: 0.52,
          rootY: 0.33,
          length: 0.6,
          thickness: 0.09,
          sway: 0.1,
          curl: 0.24,
          speed: 1.1,
          phase: 1.1,
        },
        mask: true,
        aura: 0.28,
        spectralAlpha: 0.82,
        float: 0.045,
        speckles: 22,
      };
    case "revenant":
      return {
        shape: { width: 0.62, height: 0.7, crown: 0.1, chin: 0.95, waist: 1.14, shoulder: 1.08, hip: 0.86, pinch: 0.08 },
        eyes: { count: 4, rows: 2, y: -0.2, spread: 0.42, radius: 0.062, altEvery: 2, slitPupils: true },
        mouth: { kind: "maw", y: 0.24, width: 0.42, height: 0.2, teeth: 8 },
        rearTentacles: {
          count: 4,
          spread: 0.56,
          rootY: 0.34,
          length: 0.56,
          thickness: 0.09,
          sway: 0.08,
          curl: 0.2,
          speed: 1.25,
          phase: 0.2,
        },
        frontTentacles: {
          count: 2,
          spread: 0.26,
          rootY: 0.38,
          length: 0.38,
          thickness: 0.075,
          sway: 0.05,
          curl: 0.06,
          speed: 1.35,
          phase: 1.7,
        },
        ribMarks: 3,
        speckles: 20,
      };
    case "void_walker":
      return {
        shape: { width: 0.5, height: 0.78, crown: 0.14, chin: 1.02, waist: 0.95 },
        eyes: { count: 2, rows: 1, y: -0.26, spread: 0.22, radius: 0.072, altEvery: 1, slitPupils: true },
        mouth: { kind: "void", y: 0.06, radius: 0.2 },
        rearTentacles: {
          count: 4,
          spread: 0.42,
          rootY: 0.3,
          length: 0.68,
          thickness: 0.1,
          sway: 0.11,
          curl: 0.26,
          speed: 1,
          phase: 0.4,
        },
        frontTentacles: {
          count: 2,
          spread: 0.18,
          rootY: 0.33,
          length: 0.52,
          thickness: 0.08,
          sway: 0.08,
          curl: 0.08,
          speed: 1.1,
          phase: 1.1,
        },
        aura: 0.36,
        float: 0.03,
        speckles: 26,
      };
    case "abyss":
      return {
        shape: { width: 0.69, height: 0.72, crown: 0.13, chin: 1.0, waist: 1.2, shoulder: 1.18, hip: 0.98, pinch: 0.06 },
        eyes: { count: 2, rows: 1, y: -0.22, spread: 0.34, radius: 0.08, altEvery: 2, slitPupils: true },
        mouth: { kind: "maw", y: 0.1, width: 0.75, height: 0.54, teeth: 20 },
        rearTentacles: {
          count: 6,
          spread: 0.78,
          rootY: 0.32,
          length: 0.74,
          thickness: 0.11,
          sway: 0.12,
          curl: 0.34,
          speed: 0.9,
          phase: 0.7,
        },
        frontTentacles: {
          count: 2,
          spread: 0.26,
          rootY: 0.36,
          length: 0.44,
          thickness: 0.085,
          sway: 0.08,
          curl: 0.06,
          speed: 1,
          phase: 2,
        },
        aura: 0.42,
        speckles: 30,
      };
    case "eldritch":
      return {
        shape: { width: 0.56, height: 0.85, crown: 0.23, chin: 1.1, waist: 0.87, shoulder: 0.74, hip: 0.62, pinch: 0.22 },
        eyes: { count: 3, rows: 1, y: -0.2, spread: 0.42, radius: 0.072, altEvery: 2, slitPupils: true },
        mouth: { kind: "maw", y: 0.2, width: 0.48, height: 0.23, teeth: 10 },
        rearTentacles: {
          count: 8,
          spread: 0.88,
          rootY: 0.31,
          length: 0.74,
          thickness: 0.105,
          sway: 0.12,
          curl: 0.38,
          speed: 0.85,
          phase: 0,
        },
        frontTentacles: {
          count: 4,
          spread: 0.42,
          rootY: 0.34,
          length: 0.48,
          thickness: 0.082,
          sway: 0.08,
          curl: 0.1,
          speed: 1,
          phase: 1.5,
        },
        horns: 0.62,
        aura: 0.45,
        speckles: 34,
      };
    case "corrupted":
      return {
        shape: { width: 0.58, height: 0.84, crown: 0.24, chin: 1.1, waist: 0.92, shoulder: 0.8, hip: 0.67, pinch: 0.2 },
        eyes: { count: 4, rows: 2, y: -0.22, spread: 0.44, radius: 0.065, altEvery: 2, slitPupils: true },
        mouth: { kind: "maw", y: 0.2, width: 0.52, height: 0.26, teeth: 12 },
        rearTentacles: {
          count: 9,
          spread: 0.92,
          rootY: 0.31,
          length: 0.76,
          thickness: 0.108,
          sway: 0.13,
          curl: 0.4,
          speed: 0.9,
          phase: 0.4,
        },
        frontTentacles: {
          count: 5,
          spread: 0.46,
          rootY: 0.34,
          length: 0.54,
          thickness: 0.085,
          sway: 0.09,
          curl: 0.13,
          speed: 1.1,
          phase: 1.8,
        },
        horns: 0.66,
        aura: 0.48,
        speckles: 36,
      };
    case "xyy4":
      return {
        shape: { width: 0.72, height: 0.82, crown: 0.24, chin: 1.04, waist: 1.24, shoulder: 1.26, hip: 1.03, pinch: 0.04 },
        eyes: { count: 5, rows: 2, y: -0.22, spread: 0.5, radius: 0.062, altEvery: 2, slitPupils: true },
        mouth: { kind: "maw", y: 0.16, width: 0.56, height: 0.28, teeth: 14 },
        rearTentacles: {
          count: 10,
          spread: 1.02,
          rootY: 0.3,
          length: 0.8,
          thickness: 0.11,
          sway: 0.14,
          curl: 0.45,
          speed: 0.8,
          phase: 0,
        },
        frontTentacles: {
          count: 6,
          spread: 0.55,
          rootY: 0.34,
          length: 0.58,
          thickness: 0.088,
          sway: 0.1,
          curl: 0.16,
          speed: 1,
          phase: 1.2,
        },
        horns: 0.7,
        wingFlares: 0.75,
        aura: 0.52,
        speckles: 40,
      };
    default:
      return {
        shape: { width: 0.54, height: 0.62, crown: 0.08, chin: 0.96, waist: 0.96 },
        eyes: { count: 2, rows: 1, y: -0.18, spread: 0.34, radius: 0.1 },
        mouth: { kind: "smile", y: 0.18, width: 0.28, curve: 0.07 },
      };
  }
}

function getStageConfig(stage: GrowthStage, iconMode: boolean): StageRenderConfig {
  const full = getFullStageConfig(stage);
  if (!iconMode) return full;
  return toIconConfig(stage, full);
}

function drawCorruptionOverlay(ctx: CanvasRenderingContext2D, size: number, time: number): void {
  ctx.save();
  ctx.globalAlpha = 0.26;
  const shift = Math.sin(time * 2.8) * size * 0.03;
  ctx.translate(shift, 0);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = -6; i <= 6; i += 2) {
    ctx.fillRect(-size, i * size * 0.12, size * 2, 2);
  }
  ctx.restore();
}

export function drawNu11Stage(
  ctx: CanvasRenderingContext2D,
  stage: GrowthStage,
  x: number,
  y: number,
  size: number,
  opts: Nu11DrawOptions = {}
): void {
  const palette = getPalette(stage);
  const terror = getTerror(stage);
  const time = opts.wobble ?? performance.now() / 1000;
  const blink = opts.blink ?? false;
  const iconMode = size <= 56;

  const breathe = 1 + Math.sin(time * 1.7 + terror * 2) * 0.022;
  const squash = 1 - (breathe - 1) * 0.45;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squash, breathe);
  drawSoftShadow(ctx, size, terror);

  if (stage === "egg") {
    drawEgg(ctx, size, palette, time);
  } else if (stage === "nightmare") {
    if (iconMode) drawNightmareIcon(ctx, size, palette, time, blink);
    else drawNightmare(ctx, size, palette, time, blink);
  } else {
    const config = getStageConfig(stage, iconMode);
    drawConfiguredStage(ctx, size, palette, terror, time, blink, config);

    if (stage === "corrupted") {
      drawCorruptionOverlay(ctx, size, time);
    }
  }

  if (!iconMode && size > 70 && terror > 0.62) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.globalCompositeOperation = "source-atop";
    drawSpeckles(ctx, size * 1.2, 26, "rgba(210,220,235,$A)", time * 0.6);
    ctx.restore();
  }

  ctx.restore();
}
