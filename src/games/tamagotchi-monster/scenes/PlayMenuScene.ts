import type { Scene } from "../app/Scene";
import type { GrowthStage, ColorTheme } from "../model/types";
import { getActivitiesForStage, isSpookyStage } from "../systems/play";
import { getBackgroundColor, getTextColor, getAccentColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button } from "../ui/Button";
import { roundRectPath } from "../ui/roundRect";
import { drawNu11Background } from "../graphics/Nu11Background";

export class PlayMenuScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onActivitySelected: (activityId: string) => void;
  private onClose: () => void;
  private activityButtons: Button[] = [];
  private closeButton: Button;
  private activities = getActivitiesForStage("baby");

  constructor(opts: {
    stage: GrowthStage;
    theme: ColorTheme;
    onActivitySelected: (activityId: string) => void;
    onClose: () => void;
  }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onActivitySelected = opts.onActivitySelected;
    this.onClose = opts.onClose;
    this.activities = getActivitiesForStage(this.stage, this.theme);
    this.createButtons();
    this.closeButton = new Button({
      x: 400 - 75,
      y: 500,
      width: 150,
      height: 50,
      text: "Back",
      stage: this.stage,
      onClick: this.onClose,
    });
  }

  private createButtons(): void {
    this.activityButtons = [];
    const btnWidth = 250;
    const btnHeight = 70;
    const spacing = 20;
    const startX = 400 - btnWidth / 2;
    const startY = 180;
    this.activities.forEach((activity, i) => {
      const y = startY + i * (btnHeight + spacing);
      this.activityButtons.push(
        new Button({
          x: startX,
          y,
          width: btnWidth,
          height: btnHeight,
          text: activity.name,
          stage: this.stage,
          fontSize: 22,
          onClick: () => this.onActivitySelected(activity.id),
        })
      );
    });
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    if (isNu11Mode(this.theme)) {
      drawNu11Background(ctx, 800, 600, this.stage, undefined, undefined, performance.now() / 1000);
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = rgb(getBackgroundColor(this.stage, this.theme));
    ctx.strokeStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.lineWidth = 3;
    roundRectPath(ctx, 200, 80, 400, 440, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.font = "32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const title = isSpookyStage(this.stage, this.theme) ? "Time for Mischief!" : "Let's Play!";
    ctx.fillText(title, 400, 100);

    this.activityButtons.forEach((btn) => btn.draw(ctx));
    this.closeButton.draw(ctx);

    for (const [i, btn] of this.activityButtons.entries()) {
      if (btn.isHovered) {
        const activity = this.activities[i];
        if (!activity) break;
        ctx.fillStyle = rgb(getAccentColor(this.stage, this.theme));
        ctx.font = "20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(activity.description, 400, 450);
        break;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    this.activityButtons.forEach((b) => b.handlePointerMove(x, y));
    this.closeButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.activityButtons.forEach((b) => b.handlePointerDown(x, y));
    this.closeButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.activityButtons.forEach((b) => b.handlePointerUp(x, y));
    this.closeButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") this.onClose();
  }
}
