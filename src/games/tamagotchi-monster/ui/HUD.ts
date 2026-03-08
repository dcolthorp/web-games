import type { GrowthStage, PetState } from "../model/types";
import { getTextColor, getAccentColor, getCurrentTheme } from "../systems/theme";
import { getHungerStatus, getHungerColor } from "../systems/feeding";
import { getDentalHealthStatus, getDentalHealthColor } from "../systems/dental";
import { getStageName, getEvolutionThreshold } from "../systems/growth";
import { rgb } from "../systems/utils";

class StatusBar {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  maxValue: number;
  currentValue: number;

  constructor(opts: { x: number; y: number; label: string; width?: number; height?: number; maxValue?: number }) {
    this.x = opts.x;
    this.y = opts.y;
    this.width = opts.width ?? 150;
    this.height = opts.height ?? 20;
    this.label = opts.label;
    this.maxValue = opts.maxValue ?? 100;
    this.currentValue = this.maxValue;
  }

  setValue(value: number): void {
    this.currentValue = Math.max(0, Math.min(this.maxValue, value));
  }

  draw(ctx: CanvasRenderingContext2D, stage: GrowthStage, fillColor?: [number, number, number]): void {
    const textColor = getTextColor(stage);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = rgb(textColor);
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(this.label, this.x, this.y - 4);

    ctx.fillStyle = "rgb(60, 60, 60)";
    roundRect(ctx, this.x, this.y, this.width, this.height, 5);
    ctx.fill();

    const fillWidth = Math.round((this.currentValue / this.maxValue) * (this.width - 4));
    if (fillWidth > 0) {
      ctx.fillStyle = rgb(fillColor ?? getAccentColor(stage));
      roundRect(ctx, this.x + 2, this.y + 2, fillWidth, this.height - 4, 4);
      ctx.fill();
    }

    ctx.strokeStyle = rgb(textColor);
    ctx.lineWidth = 2;
    roundRect(ctx, this.x, this.y, this.width, this.height, 5);
    ctx.stroke();
  }
}

export class HUD {
  private hungerBar: StatusBar;
  private dentalBar: StatusBar;
  private evolutionBar: StatusBar;

  constructor() {
    const barX = 20;
    const barY = 80;
    const spacing = 60;
    this.hungerBar = new StatusBar({ x: barX, y: barY, label: "Hunger" });
    this.dentalBar = new StatusBar({ x: barX, y: barY + spacing, label: "Dental Health" });
    this.evolutionBar = new StatusBar({ x: barX, y: barY + spacing * 2, label: "Evolution" });
  }

  update(pet: PetState, themeStage: GrowthStage): void {
    this.hungerBar.setValue(100 - pet.hunger);
    this.dentalBar.setValue(pet.dentalHealth);
    const threshold = getEvolutionThreshold(pet.stage);
    if (Number.isFinite(threshold) && threshold > 0) {
      this.evolutionBar.maxValue = threshold;
      this.evolutionBar.setValue(pet.carePoints);
    } else {
      this.evolutionBar.maxValue = 100;
      this.evolutionBar.setValue(100);
    }
  }

  draw(ctx: CanvasRenderingContext2D, stage: GrowthStage, profileName: string, pet: PetState): void {
    const textColor = getTextColor(stage);
    ctx.fillStyle = rgb(textColor);
    ctx.font = "28px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(profileName, 20, 18);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Stage: ${getStageName(pet.stage, getCurrentTheme())}`, 20, 52);

    const hungerColor = getHungerColor(pet.hunger);
    const dentalColor = getDentalHealthColor(pet.dentalHealth);

    this.hungerBar.draw(ctx, stage, hungerColor);
    this.dentalBar.draw(ctx, stage, dentalColor);
    this.evolutionBar.draw(ctx, stage, getAccentColor(stage));

    ctx.fillStyle = rgb(textColor);
    const statusX = 180;
    ctx.fillText(getHungerStatus(pet.hunger), statusX, this.hungerBar.y);
    ctx.fillText(getDentalHealthStatus(pet.dentalHealth), statusX, this.dentalBar.y);
    const threshold = getEvolutionThreshold(pet.stage);
    if (Number.isFinite(threshold) && threshold > 0 && pet.stage !== "monster" && pet.stage !== "xyy4") {
      ctx.fillText(`${pet.carePoints}/${threshold}`, statusX, this.evolutionBar.y);
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
