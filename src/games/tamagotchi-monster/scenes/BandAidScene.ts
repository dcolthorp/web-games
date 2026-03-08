import type { Scene } from "../app/Scene";
import type { GrowthStage, ColorTheme } from "../model/types";
import { getBandaidStyle, getTreatmentSteps, isSpookyMedical } from "../systems/medical";
import { getBackgroundColor, getTextColor, getAccentColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { drawPet } from "../graphics/Sprites";
import { drawNu11Background } from "../graphics/Nu11Background";
import { Button } from "../ui/Button";

export class BandAidScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onComplete: () => void;
  private steps: string[];
  private currentStep = 0;
  private isComplete = false;
  private applyButton: Button;
  private bandaidStyle;

  constructor(opts: { stage: GrowthStage; theme: ColorTheme; onComplete: () => void }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onComplete = opts.onComplete;
    this.steps = getTreatmentSteps("minor_ouchie", this.stage, this.theme);
    this.bandaidStyle = getBandaidStyle(this.stage, this.theme);
    this.applyButton = new Button({
      x: 400 - 100,
      y: 480,
      width: 200,
      height: 50,
      text: "Apply Band-Aid",
      stage: this.stage,
      onClick: () => this.advance(),
    });
  }

  private advance(): void {
    if (this.isComplete) {
      this.onComplete();
      return;
    }
    this.currentStep += 1;
    if (this.currentStep >= this.steps.length) {
      this.isComplete = true;
      this.applyButton = new Button({
        x: 400 - 100,
        y: 480,
        width: 200,
        height: 50,
        text: "All Better!",
        stage: this.stage,
        onClick: () => this.onComplete(),
      });
    } else {
      this.applyButton = new Button({
        x: 400 - 100,
        y: 480,
        width: 200,
        height: 50,
        text: "Continue",
        stage: this.stage,
        onClick: () => this.advance(),
      });
    }
  }

  update(_dt: number): void {}

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
    const title = isSpookyMedical(this.stage, this.theme) ? "Patch It Up!" : "Time for a Band-Aid!";
    ctx.fillText(title, 400, 40);
    drawPet(ctx, this.stage, 400, 240, 100, { theme: this.theme });
    if (!this.isComplete) drawOuchie(ctx, 450, 200);
    if (this.currentStep >= 1 || this.isComplete) drawBandaid(ctx, 450, 200, this.bandaidStyle.color);

    ctx.fillStyle = rgb(getAccentColor(this.stage, this.theme));
    ctx.font = "20px system-ui, sans-serif";
    const stepText = this.isComplete ? "All better now!" : this.steps[this.currentStep] ?? "";
    ctx.fillText(stepText, 400, 360);
    this.applyButton.draw(ctx);
    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.fillText(`Step ${Math.min(this.currentStep + 1, this.steps.length)}/${this.steps.length}`, 400, 430);
  }

  onPointerMove(x: number, y: number): void {
    this.applyButton.handlePointerMove(x, y);
  }
  onPointerDown(x: number, y: number): void {
    this.applyButton.handlePointerDown(x, y);
  }
  onPointerUp(x: number, y: number): void {
    this.applyButton.handlePointerUp(x, y);
  }
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === " ") this.advance();
  }
}

function drawOuchie(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = "rgb(200,50,50)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 5);
  ctx.lineTo(x + 10, y + 5);
  ctx.stroke();
}

function drawBandaid(ctx: CanvasRenderingContext2D, x: number, y: number, color: [number, number, number]): void {
  ctx.fillStyle = rgb(color);
  ctx.fillRect(x - 20, y - 8, 40, 16);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x - 8, y - 6, 16, 12);
}
