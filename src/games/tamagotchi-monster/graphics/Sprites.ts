import type { ColorTheme, GrowthStage } from "../model/types";
import { getPetColors, isMillionaireMode, isNu11Mode, type PetColors } from "../systems/theme";
import { rgb, clamp, lerpColor, type Rgb } from "../systems/utils";
import { roundRectPath } from "../ui/roundRect";
import { drawNu11Stage } from "./Nu11Sprites";

type DrawOptions = {
  wobble?: number;
  blink?: boolean;
  theme?: ColorTheme;
};

export function drawPet(
  ctx: CanvasRenderingContext2D,
  stage: GrowthStage,
  x: number,
  y: number,
  size: number,
  opts: DrawOptions = {}
): void {
  if (isMillionaireMode(opts.theme)) {
    drawMoneyStage(ctx, stage, x, y, size, opts);
    return;
  }
  if (isNu11Mode(opts.theme) && stage !== "baby") {
    drawNu11Stage(ctx, stage, x, y, size, opts);
    return;
  }
  if (stage === "egg") drawEgg(ctx, x, y, size, opts);
  else if (stage === "baby") drawBaby(ctx, x, y, size, opts);
  else if (stage === "child") drawChild(ctx, x, y, size, opts);
  else if (stage === "teen") drawTeen(ctx, x, y, size, opts);
  else drawMonster(ctx, x, y, size, opts);
}

function drawMoneyStage(
  ctx: CanvasRenderingContext2D,
  stage: GrowthStage,
  x: number,
  y: number,
  size: number,
  opts: DrawOptions
): void {
  if (stage === "egg") drawMoneyEgg(ctx, x, y, size, opts);
  else if (stage === "baby") drawMoneyBaby(ctx, x, y, size, opts);
  else if (stage === "child") drawMoneyChild(ctx, x, y, size, opts);
  else if (stage === "teen") drawMoneyTeen(ctx, x, y, size, opts);
  else drawMoneyMonster(ctx, x, y, size, opts);
}

function goldGradient(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): CanvasGradient {
  const grad = ctx.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
  grad.addColorStop(0, "rgb(255,245,180)");
  grad.addColorStop(0.5, "rgb(220,180,70)");
  grad.addColorStop(1, "rgb(255,230,150)");
  return grad;
}

function greenGradient(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): CanvasGradient {
  const grad = ctx.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
  grad.addColorStop(0, "rgb(190,240,200)");
  grad.addColorStop(0.6, "rgb(120,200,140)");
  grad.addColorStop(1, "rgb(80,150,110)");
  return grad;
}

function getMoneyWealth(stage: GrowthStage): number {
  const map: Partial<Record<GrowthStage, number>> = {
    egg: 0.05,
    baby: 0.12,
    child: 0.45,
    teen: 0.75,
    monster: 1,
  };
  return map[stage] ?? 1;
}

function getMoneyPalette(stage: GrowthStage): {
  wealth: number;
  bodyLight: Rgb;
  bodyDark: Rgb;
  outline: Rgb;
  gold: Rgb;
  goldDark: Rgb;
  gem: Rgb;
  gem2: Rgb;
} {
  const wealth = clamp(getMoneyWealth(stage), 0, 1);
  return {
    wealth,
    bodyLight: lerpColor([185, 200, 190], [130, 235, 175], wealth),
    bodyDark: lerpColor([110, 140, 130], [50, 160, 110], wealth),
    outline: lerpColor([90, 110, 100], [25, 85, 55], wealth),
    gold: lerpColor([170, 160, 120], [255, 220, 125], wealth),
    goldDark: lerpColor([120, 105, 70], [145, 110, 40], wealth),
    gem: lerpColor([90, 130, 160], [70, 200, 255], wealth),
    gem2: lerpColor([120, 80, 120], [255, 80, 140], wealth),
  };
}

function drawMoneyEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  spacing: number,
  blink: boolean
): void {
  if (blink) {
    ctx.strokeStyle = "rgb(40,40,40)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - spacing, y);
    ctx.lineTo(x - spacing / 2, y);
    ctx.moveTo(x + spacing, y);
    ctx.lineTo(x + spacing / 2, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(x - spacing, y, radius, 0, Math.PI * 2);
  ctx.arc(x + spacing, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(30,30,30)";
  ctx.beginPath();
  ctx.arc(x - spacing, y, radius / 2, 0, Math.PI * 2);
  ctx.arc(x + spacing, y, radius / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(x - spacing + radius / 2.5, y - radius / 2.5, radius / 2.5, 0, Math.PI * 2);
  ctx.arc(x + spacing - radius / 2.5, y - radius / 2.5, radius / 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoneyMouth(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  curvature: number,
  strokeStyle: string
): void {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-width / 2, y);
  ctx.quadraticCurveTo(0, y + curvature, width / 2, y);
  ctx.stroke();
}

function drawMoneyEgg(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const wobble = opts.wobble ?? 0;
  const wobbleX = Math.sin(wobble) * 3;
  const wobbleY = Math.cos(wobble * 0.7) * 2;
  ctx.save();
  ctx.translate(x + wobbleX, y + wobbleY);
  ctx.shadowColor = "rgba(120,120,120,0.3)";
  ctx.shadowBlur = 6;
  const dullGold = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  dullGold.addColorStop(0, "rgb(210,200,150)");
  dullGold.addColorStop(0.6, "rgb(180,165,120)");
  dullGold.addColorStop(1, "rgb(220,210,170)");
  ctx.fillStyle = dullGold;
  ctx.strokeStyle = "rgb(120,105,70)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, size / 2, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-size / 6, -size / 8, size / 6, size / 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(110,90,60,0.8)";
  ctx.font = `${Math.max(16, Math.floor(size / 4))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 0);
  ctx.restore();
}

function drawMoneyBaby(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const palette = getMoneyPalette("baby");
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 10;

  const bodyGrad = ctx.createRadialGradient(-size * 0.15, -size * 0.25, 4, 0, 0, size * 0.8);
  bodyGrad.addColorStop(0, rgb(palette.bodyLight));
  bodyGrad.addColorStop(1, rgb(palette.bodyDark));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-size * 0.32, size * 0.25);
  ctx.quadraticCurveTo(-size * 0.55, -size * 0.05, -size * 0.18, -size * 0.35);
  ctx.quadraticCurveTo(0, -size * 0.56, size * 0.18, -size * 0.35);
  ctx.quadraticCurveTo(size * 0.55, -size * 0.05, size * 0.32, size * 0.25);
  ctx.quadraticCurveTo(0, size * 0.58, -size * 0.32, size * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgb(palette.outline);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, -size * 0.34);
  ctx.lineTo(size * 0.22, -size * 0.34);
  ctx.stroke();

  const coinGrad = ctx.createRadialGradient(-size * 0.04, -size * 0.36, 2, 0, -size * 0.33, size * 0.09);
  coinGrad.addColorStop(0, rgb(lerpColor(palette.gold, [255, 255, 240], 0.4)));
  coinGrad.addColorStop(1, rgb(palette.goldDark));
  ctx.fillStyle = coinGrad;
  ctx.beginPath();
  ctx.arc(0, -size * 0.33, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 2;
  ctx.stroke();

  drawMoneyEyes(ctx, 0, -size * 0.1, size * 0.075, size * 0.17, opts.blink ?? false);
  drawMoneyMouth(ctx, size * 0.18, size * 0.34, -size * 0.12, "rgb(90,75,60)");
  ctx.restore();
}

function drawMoneyChild(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const palette = getMoneyPalette("child");
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 10;
  const bodyGrad = ctx.createRadialGradient(-size * 0.18, -size * 0.24, 4, 0, 0, size * 0.85);
  bodyGrad.addColorStop(0, rgb(palette.bodyLight));
  bodyGrad.addColorStop(1, rgb(palette.bodyDark));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.52, size * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgb(palette.outline);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = rgb(lerpColor(palette.bodyLight, [255, 255, 255], 0.35));
  ctx.beginPath();
  ctx.arc(size * 0.24, -size * 0.06, size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(lerpColor(palette.outline, [255, 255, 255], 0.25));
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, -size * 0.34);
  ctx.lineTo(size * 0.18, -size * 0.34);
  ctx.stroke();

  ctx.fillStyle = rgb(palette.gold);
  ctx.beginPath();
  ctx.arc(-size * 0.22, -size * 0.26, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 2;
  ctx.stroke();

  drawMoneyEyes(ctx, 0, -size * 0.1, size * 0.08, size * 0.18, opts.blink ?? false);
  drawMoneyMouth(ctx, size * 0.18, size * 0.36, size * 0.04, "rgb(80,65,50)");
  ctx.restore();
}

function drawMoneyTeen(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const palette = getMoneyPalette("teen");
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 10;
  const bodyGrad = ctx.createRadialGradient(-size * 0.2, -size * 0.28, 4, 0, 0, size * 0.9);
  bodyGrad.addColorStop(0, rgb(palette.bodyLight));
  bodyGrad.addColorStop(1, rgb(palette.bodyDark));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.54, size * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgb(palette.outline);
  ctx.lineWidth = 3;
  ctx.stroke();

  const lensW = size * 0.3;
  const lensH = size * 0.16;
  const lensY = -size * 0.18;
  const gap = size * 0.08;
  ctx.fillStyle = "rgb(25,25,30)";
  ctx.strokeStyle = "rgb(70,70,80)";
  ctx.lineWidth = 2;
  roundRectPath(ctx, -gap / 2 - lensW, lensY, lensW, lensH, 6);
  ctx.fill();
  ctx.stroke();
  roundRectPath(ctx, gap / 2, lensY, lensW, lensH, 6);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgb(40,40,45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-gap / 2, lensY + lensH / 2);
  ctx.lineTo(gap / 2, lensY + lensH / 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRectPath(ctx, -gap / 2 - lensW + 5, lensY + 3, lensW - 12, 6, 3);
  ctx.fill();
  roundRectPath(ctx, gap / 2 + 5, lensY + 3, lensW - 12, 6, 3);
  ctx.fill();

  ctx.strokeStyle = rgb(palette.gold);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, size * 0.33, size * 0.38, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();

  ctx.fillStyle = rgb(palette.gem);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.34);
  ctx.lineTo(size * 0.05, size * 0.4);
  ctx.lineTo(0, size * 0.46);
  ctx.lineTo(-size * 0.05, size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();

  drawMoneyMouth(ctx, size * 0.18, size * 0.38, size * 0.1, "rgb(70,55,40)");
  ctx.restore();
}

function drawMoneyMonster(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const palette = getMoneyPalette("monster");
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 12;
  const bodyGrad = ctx.createRadialGradient(-size * 0.22, -size * 0.3, 4, 0, 0, size);
  bodyGrad.addColorStop(0, rgb(lerpColor(palette.bodyLight, [255, 255, 255], 0.15)));
  bodyGrad.addColorStop(1, rgb(palette.bodyDark));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.58, size * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgb(palette.outline);
  ctx.lineWidth = 4;
  ctx.stroke();

  drawMoneyEyes(ctx, 0, -size * 0.12, size * 0.095, size * 0.22, opts.blink ?? false);
  drawMoneyMouth(ctx, size * 0.22, size * 0.44, size * 0.14, "rgb(70,50,30)");

  ctx.fillStyle = rgb(palette.gold);
  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, size * 0.38, size * 0.42, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();

  ctx.fillStyle = rgb(palette.gem);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.4);
  ctx.lineTo(size * 0.06, size * 0.48);
  ctx.lineTo(0, size * 0.56);
  ctx.lineTo(-size * 0.06, size * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = rgb(palette.gold);
  ctx.strokeStyle = rgb(palette.goldDark);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-size * 0.22, -size * 0.5);
  ctx.lineTo(0, -size * 0.78);
  ctx.lineTo(size * 0.22, -size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgb(palette.gem2);
  ctx.beginPath();
  ctx.arc(0, -size * 0.62, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const colors = getPetColors("egg", opts.theme ?? "blue");
  const wobble = opts.wobble ?? 0;
  const wobbleX = Math.sin(wobble) * 3;
  const wobbleY = 0;
  ctx.fillStyle = rgb(colors.body);
  ctx.strokeStyle = rgb(colors.outline ?? [30, 30, 30]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x + wobbleX, y + wobbleY, size / 2, size * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (!isNu11Mode(opts.theme)) {
    ctx.fillStyle = rgb(colors.spots ?? [150, 150, 150]);
    ctx.beginPath();
    ctx.arc(x - size / 4 + wobbleX, y - size / 5, size / 7, 0, Math.PI * 2);
    ctx.arc(x + size / 6 + wobbleX, y, size / 9, 0, Math.PI * 2);
    ctx.arc(x - size / 8 + wobbleX, y + size / 4, size / 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(80,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x + wobbleX, y + wobbleY, size / 2 + 4, size * 0.65 + 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBaby(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const colors = getPetColors("baby", opts.theme ?? "blue");
  ctx.fillStyle = rgb(colors.body);
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(ctx, x, y - size / 8, size / 4, opts.blink ?? false, colors);
  ctx.fillStyle = rgb(colors.cheeks ?? [255, 180, 180]);
  ctx.beginPath();
  ctx.arc(x - size / 3, y + size / 8, size / 8, 0, Math.PI * 2);
  ctx.arc(x + size / 3, y + size / 8, size / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(colors.mouth ?? [200, 80, 80]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + size / 6, size / 6, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawChild(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const colors = getPetColors("child", opts.theme ?? "blue");
  ctx.fillStyle = rgb(colors.body);
  ctx.beginPath();
  ctx.ellipse(x, y, size / 2, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  drawEyes(ctx, x, y - size / 6, size / 5, opts.blink ?? false, colors);
  ctx.fillStyle = rgb(colors.cheeks ?? [255, 170, 170]);
  ctx.beginPath();
  ctx.arc(x - size / 3, y + size / 10, size / 10, 0, Math.PI * 2);
  ctx.arc(x + size / 3, y + size / 10, size / 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgb(colors.mouth ?? [150, 70, 70]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + size / 4, size / 4, Math.PI, Math.PI * 2);
  ctx.stroke();
  if (colors.teeth) {
    ctx.fillStyle = rgb(colors.teeth);
    ctx.fillRect(x - size / 16, y + size / 4 - 4, size / 8, 6);
  }
}

function drawTeen(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const colors = getPetColors("teen", opts.theme ?? "blue");
  ctx.fillStyle = rgb(colors.body);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.7);
  ctx.lineTo(x + size * 0.5, y - size * 0.2);
  ctx.lineTo(x + size * 0.5, y + size * 0.4);
  ctx.lineTo(x, y + size * 0.7);
  ctx.lineTo(x - size * 0.5, y + size * 0.4);
  ctx.lineTo(x - size * 0.5, y - size * 0.2);
  ctx.closePath();
  ctx.fill();
  if (!(opts.blink ?? false)) {
    ctx.fillStyle = rgb(colors.eyes ?? [60, 20, 20]);
    ctx.beginPath();
    ctx.ellipse(x - size / 4, y - size / 5, size / 10, size / 20, 0, 0, Math.PI * 2);
    ctx.ellipse(x + size / 4, y - size / 5, size / 10, size / 20, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = rgb(colors.eyes ?? [60, 20, 20]);
    ctx.beginPath();
    ctx.moveTo(x - size / 3, y - size / 5);
    ctx.lineTo(x - size / 6, y - size / 5);
    ctx.moveTo(x + size / 3, y - size / 5);
    ctx.lineTo(x + size / 6, y - size / 5);
    ctx.stroke();
  }
  ctx.strokeStyle = rgb(colors.mouth ?? [120, 40, 40]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y + size / 4, size / 3, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, opts: DrawOptions): void {
  const colors = getPetColors("monster", opts.theme ?? "blue");
  ctx.fillStyle = rgb(colors.body);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.8);
  ctx.lineTo(x + size * 0.6, y - size * 0.3);
  ctx.lineTo(x + size * 0.55, y + size * 0.5);
  ctx.lineTo(x, y + size * 0.8);
  ctx.lineTo(x - size * 0.55, y + size * 0.5);
  ctx.lineTo(x - size * 0.6, y - size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(colors.eyes ?? [255, 50, 50]);
  if (!(opts.blink ?? false)) {
    ctx.beginPath();
    ctx.arc(x - size / 4, y - size / 6, size / 10, 0, Math.PI * 2);
    ctx.arc(x + size / 4, y - size / 6, size / 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgb(colors.mouth ?? [100, 20, 20]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y + size / 3, size / 3, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  blink: boolean,
  colors: PetColors
): void {
  if (blink) {
    ctx.strokeStyle = rgb(colors.eyes ?? [40, 40, 40]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x - size / 4, y);
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size / 4, y);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(x - size, y, size, 0, Math.PI * 2);
  ctx.arc(x + size, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgb(colors.eyes ?? [40, 40, 40]);
  ctx.beginPath();
  ctx.arc(x - size, y, size / 2, 0, Math.PI * 2);
  ctx.arc(x + size, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
}
