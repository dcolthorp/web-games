import type { Scene } from "../app/Scene";
import type { GrowthStage, ColorTheme } from "../model/types";
import { getDoctorTheme, getTreatmentSteps } from "../systems/medical";
import { getTextColor } from "../systems/theme";
import { rgb } from "../systems/utils";
import { drawPet } from "../graphics/Sprites";
import { Button } from "../ui/Button";

export class DoctorVisitScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onComplete: () => void;
  private steps: string[];
  private currentStep = 0;
  private isComplete = false;
  private doctorTheme;
  private button: Button;

  constructor(opts: { stage: GrowthStage; theme: ColorTheme; onComplete: () => void }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onComplete = opts.onComplete;
    this.steps = getTreatmentSteps("bigger_injury", this.stage, this.theme);
    this.doctorTheme = getDoctorTheme(this.stage, this.theme);
    this.button = new Button({
      x: 400 - 100,
      y: 480,
      width: 200,
      height: 50,
      text: "Continue",
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
      this.button = new Button({
        x: 400 - 100,
        y: 480,
        width: 200,
        height: 50,
        text: "All Set!",
        stage: this.stage,
        onClick: () => this.onComplete(),
      });
    }
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = rgb(this.doctorTheme.background);
    ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "30px system-ui, sans-serif";
    ctx.fillText(this.doctorTheme.name, 400, 40);
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText(this.doctorTheme.description, 400, 80);
    drawPet(ctx, this.stage, 400, 260, 110, { theme: this.theme });
    ctx.fillStyle = rgb(this.doctorTheme.accent);
    ctx.font = "20px system-ui, sans-serif";
    const stepText = this.isComplete ? "Feeling better!" : this.steps[this.currentStep] ?? "";
    ctx.fillText(stepText, 400, 360);
    this.button.draw(ctx);
  }

  onPointerMove(x: number, y: number): void {
    this.button.handlePointerMove(x, y);
  }
  onPointerDown(x: number, y: number): void {
    this.button.handlePointerDown(x, y);
  }
  onPointerUp(x: number, y: number): void {
    this.button.handlePointerUp(x, y);
  }
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === " ") this.advance();
  }
}
