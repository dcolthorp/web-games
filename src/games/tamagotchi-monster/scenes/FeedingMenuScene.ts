import type { Scene } from "../app/Scene";
import type { GrowthStage, ColorTheme } from "../model/types";
import { getAvailableFoods } from "../systems/feeding";
import { getBackgroundColor, getTextColor, getAccentColor, isNu11Mode } from "../systems/theme";
import { rgb } from "../systems/utils";
import { Button } from "../ui/Button";
import { roundRectPath } from "../ui/roundRect";
import { drawNu11Background } from "../graphics/Nu11Background";

export class FeedingMenuScene implements Scene {
  private stage: GrowthStage;
  private theme: ColorTheme;
  private onFoodSelected: (foodId: string) => void;
  private onClose: () => void;
  private foodButtons: Button[] = [];
  private closeButton: Button;
  private foods = getAvailableFoods("baby");

  constructor(opts: {
    stage: GrowthStage;
    theme: ColorTheme;
    onFoodSelected: (foodId: string) => void;
    onClose: () => void;
  }) {
    this.stage = opts.stage;
    this.theme = opts.theme;
    this.onFoodSelected = opts.onFoodSelected;
    this.onClose = opts.onClose;
    this.foods = getAvailableFoods(this.stage, this.theme);
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
    this.foodButtons = [];
    const cols = 3;
    const btnWidth = 150;
    const btnHeight = 80;
    const spacing = 20;
    const totalWidth = cols * btnWidth + (cols - 1) * spacing;
    const startX = 400 - totalWidth / 2;
    const startY = 180;
    this.foods.forEach((food, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnWidth + spacing);
      const y = startY + row * (btnHeight + spacing);
      this.foodButtons.push(
        new Button({
          x,
          y,
          width: btnWidth,
          height: btnHeight,
          text: food.name,
          stage: this.stage,
          fontSize: 20,
          onClick: () => {
            this.onFoodSelected(food.id);
            this.onClose();
          },
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
    roundRectPath(ctx, 120, 80, 560, 440, 20);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage, this.theme));
    ctx.font = "32px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Choose Food", 400, 100);

    this.foodButtons.forEach((btn, i) => {
      btn.draw(ctx);
      const food = this.foods[i];
      if (food) {
        ctx.fillStyle = rgb(food.color);
        ctx.beginPath();
        ctx.arc(btn.x + btn.width / 2, btn.y - 15, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgb(getTextColor(this.stage, this.theme));
        ctx.stroke();
      }
    });
    this.closeButton.draw(ctx);

    for (const [i, btn] of this.foodButtons.entries()) {
      if (btn.isHovered) {
        const food = this.foods[i];
        if (!food) break;
        const careDisplay = food.carePointsWeights ? "???" : String(food.carePoints ?? 0);
        const text = `Hunger: -${food.hungerReduction}  Care: +${careDisplay}`;
        ctx.fillStyle = rgb(getAccentColor(this.stage, this.theme));
        ctx.font = "20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(text, 400, 450);
        break;
      }
    }
  }

  onPointerMove(x: number, y: number): void {
    this.foodButtons.forEach((b) => b.handlePointerMove(x, y));
    this.closeButton.handlePointerMove(x, y);
  }

  onPointerDown(x: number, y: number): void {
    this.foodButtons.forEach((b) => b.handlePointerDown(x, y));
    this.closeButton.handlePointerDown(x, y);
  }

  onPointerUp(x: number, y: number): void {
    this.foodButtons.forEach((b) => b.handlePointerUp(x, y));
    this.closeButton.handlePointerUp(x, y);
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") this.onClose();
  }
}
