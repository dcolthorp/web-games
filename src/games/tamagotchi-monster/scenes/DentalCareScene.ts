import type { Scene } from "../app/Scene";
import type { GrowthStage, ColorTheme } from "../model/types";
import { getDentalSupplies, getWaterDescription, getToothpasteDescription } from "../systems/dental";
import { getBackgroundColor, getTextColor, getAccentColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { ParticleSystem } from "../graphics/ParticleSystem";
import { drawNu11Background } from "../graphics/Nu11Background";
import { Button } from "../ui/Button";

export class DentalCareScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onBrushComplete: () => void;
  private onClose: () => void;
  private supplies;
  private particles = new ParticleSystem();

  private brushProgress = 0;
  private isBrushing = false;
  private brushX = 400;
  private brushY = 300;
  private lastBrushX = 400;
  private brushCompleted = false;

  private mouthX = 400;
  private mouthY = 280;
  private mouthWidth = 200;
  private mouthHeight = 100;

  private doneButton: Button;

  constructor(opts: {
    stage: GrowthStage;
    theme: ColorTheme;
    onBrushComplete: () => void;
    onClose: () => void;
  }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onBrushComplete = opts.onBrushComplete;
    this.onClose = opts.onClose;
    this.supplies = getDentalSupplies(this.stage, this.theme);
    this.doneButton = new Button({
      x: 400 - 75,
      y: 520,
      width: 150,
      height: 50,
      text: "Done",
      stage: this.stage,
      onClick: () => this.finish(),
    });
  }

  private finish(): void {
    if (this.brushProgress >= 1) this.onBrushComplete();
    this.onClose();
  }

  update(dt: number): void {
    this.particles.update(dt);
    if (this.isBrushing && !this.brushCompleted) {
      const mouthRect = {
        x: this.mouthX - this.mouthWidth / 2,
        y: this.mouthY - this.mouthHeight / 2,
        w: this.mouthWidth,
        h: this.mouthHeight,
      };
      if (
        this.brushX >= mouthRect.x &&
        this.brushX <= mouthRect.x + mouthRect.w &&
        this.brushY >= mouthRect.y &&
        this.brushY <= mouthRect.y + mouthRect.h
      ) {
        const motion = Math.abs(this.brushX - this.lastBrushX);
        this.brushProgress += motion * 0.005;
        if (motion > 5) {
          this.particles.spawnBrushEffect(this.brushX, this.brushY, this.stage);
        }
        if (this.brushProgress >= 1) {
          this.brushProgress = 1;
          this.brushCompleted = true;
          this.particles.spawnSparkles(this.mouthX, this.mouthY, 20, this.stage);
        }
      }
    }
    this.lastBrushX = this.brushX;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (isNu11Mode(this.theme)) {
      drawNu11Background(ctx, 800, 600, this.stage, undefined, undefined, performance.now() / 1000);
    } else {
      ctx.fillStyle = rgb(getBackgroundColor(this.stage, this.theme));
      ctx.fillRect(0, 0, 800, 600);
    }
    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText("Brush Teeth!", 400, 40);

    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Using: ${getWaterDescription(this.stage, this.theme)}`, 50, 100);
    ctx.fillText(`With: ${getToothpasteDescription(this.stage, this.theme)}`, 50, 130);

    drawMouth(ctx, this.mouthX, this.mouthY, this.mouthWidth, this.mouthHeight, this.brushCompleted);
    drawBrush(ctx, this.brushX, this.brushY);

    this.particles.draw(ctx);

    drawProgress(ctx, 250, 420, 300, this.brushProgress, getAccentColor(this.stage, this.theme));

    ctx.textAlign = "center";
    ctx.fillStyle = rgb(this.brushCompleted ? getAccentColor(this.stage, this.theme) : getTextColor(this.stage, this.theme));
    ctx.fillText(
      this.brushCompleted ? "Teeth are sparkling clean!" : "Click and drag to brush!",
      400,
      460
    );

    this.doneButton.draw(ctx);
  }

  onPointerMove(x: number, y: number): void {
    if (this.isBrushing) {
      this.brushX = x;
      this.brushY = y;
    }
    this.doneButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.isBrushing = true;
    this.brushX = x;
    this.brushY = y;
    this.doneButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.isBrushing = false;
    this.doneButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") this.onClose();
  }
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cleaned: boolean
): void {
  ctx.fillStyle = "rgb(80,40,40)";
  ctx.beginPath();
  ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  const toothColor = cleaned ? "rgb(255,255,255)" : "rgb(240,240,230)";
  ctx.fillStyle = toothColor;
  const toothWidth = 25;
  const toothHeight = 30;
  const numTeeth = 6;
  const startX = x - (numTeeth * toothWidth) / 2;
  for (let i = 0; i < numTeeth; i += 1) {
    ctx.fillRect(startX + i * toothWidth, y - height / 2 + 5, toothWidth - 3, toothHeight);
    ctx.fillRect(startX + i * toothWidth, y + height / 2 - toothHeight - 5, toothWidth - 3, toothHeight);
  }
}

function drawBrush(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "rgb(200,200,220)";
  ctx.fillRect(x - 20, y - 5, 40, 10);
  ctx.fillStyle = "rgb(150,200,255)";
  ctx.fillRect(x + 15, y - 12, 8, 24);
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  progress: number,
  color: [number, number, number]
): void {
  ctx.fillStyle = "rgb(60,60,60)";
  ctx.fillRect(x, y, width, 12);
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x, y, width * progress, 12);
}
