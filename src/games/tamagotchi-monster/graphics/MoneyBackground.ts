import type { GrowthStage } from "../model/types";
import { lerpColor, rgb } from "../systems/utils";

const LUXURY_LEVEL: Record<GrowthStage, number> = {
  egg: 0,
  baby: 0.15,
  child: 0.4,
  teen: 0.7,
  monster: 1,
  shadow: 1,
  specter: 1,
  wraith: 1,
  phantom: 1,
  revenant: 1,
  nightmare: 1,
  void_walker: 1,
  abyss: 1,
  eldritch: 1,
  corrupted: 1,
  xyy4: 1,
};

let moneyPattern: CanvasPattern | null = null;
let moneyPatternCanvas: HTMLCanvasElement | null = null;

function getMoneyPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!moneyPatternCanvas) {
    moneyPatternCanvas = document.createElement("canvas");
    moneyPatternCanvas.width = 220;
    moneyPatternCanvas.height = 220;
    const pctx = moneyPatternCanvas.getContext("2d");
    if (!pctx) return null;
    pctx.clearRect(0, 0, moneyPatternCanvas.width, moneyPatternCanvas.height);

    const coins = [
      { x: 50, y: 50, r: 20 },
      { x: 160, y: 80, r: 16 },
      { x: 120, y: 170, r: 22 },
    ];
    for (const coin of coins) {
      const grad = pctx.createRadialGradient(coin.x - 6, coin.y - 6, 4, coin.x, coin.y, coin.r);
      grad.addColorStop(0, "rgba(255,240,170,0.9)");
      grad.addColorStop(0.6, "rgba(220,180,60,0.8)");
      grad.addColorStop(1, "rgba(140,100,30,0.7)");
      pctx.fillStyle = grad;
      pctx.beginPath();
      pctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
      pctx.fill();
      pctx.strokeStyle = "rgba(120,90,30,0.6)";
      pctx.lineWidth = 2;
      pctx.stroke();
    }

    pctx.save();
    pctx.translate(140, 140);
    pctx.rotate(-0.2);
    pctx.fillStyle = "rgba(120,200,140,0.5)";
    pctx.strokeStyle = "rgba(60,140,90,0.6)";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.rect(-50, -30, 100, 60);
    pctx.fill();
    pctx.stroke();
    pctx.beginPath();
    pctx.arc(0, 0, 16, 0, Math.PI * 2);
    pctx.stroke();
    pctx.restore();

    pctx.save();
    pctx.translate(40, 150);
    pctx.rotate(0.35);
    pctx.fillStyle = "rgba(140,220,160,0.35)";
    pctx.strokeStyle = "rgba(60,140,90,0.5)";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.rect(-45, -25, 90, 50);
    pctx.fill();
    pctx.stroke();
    pctx.restore();
  }

  if (!moneyPattern) {
    moneyPattern = ctx.createPattern(moneyPatternCanvas as HTMLCanvasElement, "repeat");
  }
  return moneyPattern;
}

export function drawMoneyBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stage: GrowthStage,
  fromStage?: GrowthStage,
  progress?: number
): void {
  const toLevel = LUXURY_LEVEL[stage] ?? 0.5;
  const fromLevel = fromStage ? LUXURY_LEVEL[fromStage] ?? toLevel : toLevel;
  const mix = progress === undefined ? 1 : Math.max(0, Math.min(1, progress));
  const t = fromStage ? fromLevel + (toLevel - fromLevel) * mix : toLevel;
  const top = lerpColor([220, 255, 220], [170, 230, 180], t);
  const bottom = lerpColor([160, 220, 170], [100, 170, 120], t);

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgb(top));
  gradient.addColorStop(1, rgb(bottom));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const pattern = getMoneyPattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.15 + t * 0.1;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const glow = ctx.createRadialGradient(width * 0.3, height * 0.3, 50, width * 0.3, height * 0.3, width * 0.6);
  glow.addColorStop(0, "rgba(255,245,200,0.35)");
  glow.addColorStop(1, "rgba(255,245,200,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.9);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
