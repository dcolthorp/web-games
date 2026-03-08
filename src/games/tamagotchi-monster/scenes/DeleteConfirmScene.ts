import type { Scene } from "../app/Scene";
import type { GrowthStage } from "../model/types";
import { getBackgroundColor, getTextColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button } from "../ui/Button";
import { roundRectPath } from "../ui/roundRect";
import { drawNu11Background } from "../graphics/Nu11Background";

export class DeleteConfirmScene implements Scene {
  private stage: GrowthStage;
  private profileName: string;
  private onConfirm: () => void;
  private onCancel: () => void;
  private confirmButton: Button;
  private cancelButton: Button;

  constructor(opts: {
    stage: GrowthStage;
    profileName: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    this.stage = opts.stage;
    this.profileName = opts.profileName;
    this.onConfirm = opts.onConfirm;
    this.onCancel = opts.onCancel;

    const buttonY = 360;
    this.confirmButton = new Button({
      x: 400 - 220,
      y: buttonY,
      width: 200,
      height: 50,
      text: "Yes, Delete",
      stage: this.stage,
      onClick: this.onConfirm,
    });
    this.cancelButton = new Button({
      x: 400 + 20,
      y: buttonY,
      width: 200,
      height: 50,
      text: "No, Keep It",
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

    const dialogWidth = 500;
    const dialogHeight = 250;
    const x = (800 - dialogWidth) / 2;
    const y = (600 - dialogHeight) / 2;
    ctx.fillStyle = rgb(getBackgroundColor(this.stage));
    ctx.strokeStyle = rgb(getTextColor(this.stage));
    ctx.lineWidth = 3;
    roundRectPath(ctx, x, y, dialogWidth, dialogHeight, 15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "32px system-ui, sans-serif";
    ctx.fillText("Delete Profile?", 400, y + 24);
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(`This will permanently delete ${this.profileName}`, 400, y + 90);
    ctx.fillStyle = "rgb(255,100,100)";
    ctx.fillText("and their pet. This cannot be undone!", 400, y + 120);

    this.confirmButton.draw(ctx);
    this.cancelButton.draw(ctx);
  }

  onPointerMove(x: number, y: number): void {
    this.confirmButton.handlePointerMove(x, y);
    this.cancelButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.confirmButton.handlePointerDown(x, y);
    this.cancelButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.confirmButton.handlePointerUp(x, y);
    this.cancelButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") this.onCancel();
    if (e.key === "Enter") this.onConfirm();
  }
}
