import type { Scene } from "../app/Scene";
import type { GrowthStage } from "../model/types";
import { getBackgroundColor, getTextColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button } from "../ui/Button";
import { roundRectPath } from "../ui/roundRect";
import { drawNu11Background } from "../graphics/Nu11Background";

export class ProfileSettingsScene implements Scene {
  private stage: GrowthStage;
  private profileName: string;
  private onReset: () => void;
  private onDelete: () => void;
  private onCancel: () => void;

  private resetButton: Button;
  private deleteButton: Button;
  private cancelButton: Button;

  constructor(opts: {
    stage: GrowthStage;
    profileName: string;
    onReset: () => void;
    onDelete: () => void;
    onCancel: () => void;
  }) {
    this.stage = opts.stage;
    this.profileName = opts.profileName;
    this.onReset = opts.onReset;
    this.onDelete = opts.onDelete;
    this.onCancel = opts.onCancel;

    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = 400 - buttonWidth / 2;
    const startY = 300 - 20;

    this.resetButton = new Button({
      x: buttonX,
      y: startY,
      width: buttonWidth,
      height: buttonHeight,
      text: "Reset Pet",
      stage: this.stage,
      onClick: this.onReset,
    });
    this.deleteButton = new Button({
      x: buttonX,
      y: startY + buttonHeight + 15,
      width: buttonWidth,
      height: buttonHeight,
      text: "Delete Profile",
      stage: this.stage,
      onClick: this.onDelete,
    });
    this.cancelButton = new Button({
      x: buttonX,
      y: startY + (buttonHeight + 15) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: "Cancel",
      stage: this.stage,
      onClick: this.onCancel,
    });
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    if (isNu11Mode()) {
      drawNu11Background(ctx, 800, 600, this.stage, undefined, undefined, performance.now() / 1000);
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, 800, 600);

    const dialogWidth = 350;
    const dialogHeight = 300;
    const x = (800 - dialogWidth) / 2;
    const y = (600 - dialogHeight) / 2;
    ctx.fillStyle = rgb(getBackgroundColor(this.stage));
    ctx.strokeStyle = rgb(getTextColor(this.stage));
    ctx.lineWidth = 3;
    roundRectPath(ctx, x, y, dialogWidth, dialogHeight, 15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage));
    ctx.font = "32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(this.profileName, 400, y + 20);
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("Profile Settings", 400, y + 60);

    this.resetButton.draw(ctx);
    this.deleteButton.draw(ctx);
    this.cancelButton.draw(ctx);
  }

  onPointerMove(x: number, y: number): void {
    this.resetButton.handlePointerMove(x, y);
    this.deleteButton.handlePointerMove(x, y);
    this.cancelButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.resetButton.handlePointerDown(x, y);
    this.deleteButton.handlePointerDown(x, y);
    this.cancelButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.resetButton.handlePointerUp(x, y);
    this.deleteButton.handlePointerUp(x, y);
    this.cancelButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") this.onCancel();
  }
}
