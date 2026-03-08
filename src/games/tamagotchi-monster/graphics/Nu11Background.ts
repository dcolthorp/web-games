import type { GrowthStage } from "../model/types";
import { clamp, lerpColor, rgb } from "../systems/utils";

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

let nu11Pattern: CanvasPattern | null = null;
let nu11PatternCanvas: HTMLCanvasElement | null = null;

function getNu11Pattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (!nu11PatternCanvas) {
    nu11PatternCanvas = document.createElement("canvas");
    nu11PatternCanvas.width = 240;
    nu11PatternCanvas.height = 240;
    const pctx = nu11PatternCanvas.getContext("2d");
    if (!pctx) return null;

    pctx.clearRect(0, 0, nu11PatternCanvas.width, nu11PatternCanvas.height);

    pctx.strokeStyle = "rgba(90,255,120,0.18)";
    pctx.lineWidth = 2;
    pctx.beginPath();
    pctx.arc(60, 60, 18, 0, Math.PI * 2);
    pctx.arc(180, 80, 22, 0, Math.PI * 2);
    pctx.stroke();

    pctx.strokeStyle = "rgba(90,255,120,0.12)";
    pctx.beginPath();
    pctx.moveTo(40, 120);
    pctx.lineTo(80, 160);
    pctx.lineTo(120, 120);
    pctx.closePath();
    pctx.stroke();

    pctx.strokeStyle = "rgba(255,60,70,0.1)";
    pctx.beginPath();
    pctx.ellipse(140, 150, 20, 8, 0.2, 0, Math.PI * 2);
    pctx.ellipse(80, 190, 16, 6, -0.4, 0, Math.PI * 2);
    pctx.stroke();

    pctx.strokeStyle = "rgba(120,180,200,0.12)";
    pctx.lineWidth = 3;
    pctx.beginPath();
    pctx.moveTo(10, 210);
    pctx.bezierCurveTo(40, 160, 80, 170, 120, 130);
    pctx.stroke();

    pctx.lineWidth = 1.5;
    pctx.strokeStyle = "rgba(255,255,255,0.06)";
    pctx.beginPath();
    pctx.arc(200, 200, 20, Math.PI * 0.1, Math.PI * 1.2);
    pctx.stroke();
  }

  if (!nu11Pattern) {
    nu11Pattern = ctx.createPattern(nu11PatternCanvas as HTMLCanvasElement, "repeat");
  }
  return nu11Pattern;
}

function getTerror(stage: GrowthStage): number {
  return NU11_TERROR[stage] ?? 0.5;
}

export function drawNu11Background(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stage: GrowthStage,
  fromStage?: GrowthStage,
  progress?: number,
  timeSec?: number
): void {
  const now = timeSec ?? performance.now() / 1000;
  const toLevel = getTerror(stage);
  const fromLevel = fromStage ? getTerror(fromStage) : toLevel;
  const mix = progress === undefined ? 1 : clamp(progress, 0, 1);
  const t = fromStage ? fromLevel + (toLevel - fromLevel) * mix : toLevel;

  const top = lerpColor([46, 46, 68], [20, 28, 34], t);
  const bottom = lerpColor([20, 18, 32], [6, 8, 12], t);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgb(top));
  gradient.addColorStop(1, rgb(bottom));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const pattern = getNu11Pattern(ctx);
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = 0.08 + t * 0.1;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const glowStrength = 0.18 - t * 0.06;
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.45, 40, width * 0.5, height * 0.45, width * 0.75);
  glow.addColorStop(0, `rgba(140,140,190,${glowStrength})`);
  glow.addColorStop(1, "rgba(140,140,190,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const fogCount = 4;
  for (let i = 0; i < fogCount; i += 1) {
    const phase = now * 0.3 + i * 1.7;
    const fx = width * (0.2 + 0.6 * ((Math.sin(phase) + 1) / 2));
    const fy = height * (0.2 + 0.6 * ((Math.cos(phase * 0.7) + 1) / 2));
    const size = height * (0.15 + 0.08 * Math.sin(phase + i));
    const fog = ctx.createRadialGradient(fx, fy, 10, fx, fy, size);
    fog.addColorStop(0, `rgba(90,90,120,${0.08 + t * 0.06})`);
    fog.addColorStop(1, "rgba(90,90,120,0)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
  }

  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, height * 0.9);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${0.22 + t * 0.1})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
