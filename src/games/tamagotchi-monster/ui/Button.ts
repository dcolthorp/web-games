import type { GrowthStage } from "../model/types";
import { getButtonColor, getButtonHoverColor, getTextColor } from "../systems/theme";
import { rgb } from "../systems/utils";
import { MOD_TM_MORE_ANIMATIONS_KEY, isModEnabled } from "../../../shared/mods";

const MORE_ANIMATIONS = isModEnabled(MOD_TM_MORE_ANIMATIONS_KEY);

export class Button {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  stage: GrowthStage;
  fontSize: number;
  onClick?: () => void;
  isHovered = false;
  isPressed = false;
  private pressedAt: number | null = null;
  private releasedAt: number | null = null;
  private hoverStartedAt: number | null = null;

  constructor(opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    stage: GrowthStage;
    fontSize?: number;
    onClick?: () => void;
  }) {
    this.x = opts.x;
    this.y = opts.y;
    this.width = opts.width;
    this.height = opts.height;
    this.text = opts.text;
    this.stage = opts.stage;
    this.fontSize = opts.fontSize ?? 24;
    this.onClick = opts.onClick;
  }

  setStage(stage: GrowthStage): void {
    this.stage = stage;
  }

  contains(x: number, y: number): boolean {
    return x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height;
  }

  handlePointerMove(x: number, y: number): void {
    const wasHovered = this.isHovered;
    this.isHovered = this.contains(x, y);
    if (!wasHovered && this.isHovered) this.hoverStartedAt = performance.now();
    if (wasHovered && !this.isHovered) this.hoverStartedAt = null;
  }

  handlePointerDown(x: number, y: number): void {
    this.isPressed = this.contains(x, y);
    if (this.isPressed) this.pressedAt = performance.now();
  }

  handlePointerUp(x: number, y: number): void {
    const wasPressed = this.isPressed;
    this.isPressed = false;
    this.pressedAt = null;
    if (wasPressed && this.contains(x, y)) {
      this.releasedAt = performance.now();
      this.onClick?.();
    }
  }

  protected getAnimTransform(): { scale: number; offsetY: number; rotate: number } {
    if (!MORE_ANIMATIONS) return { scale: 1, offsetY: 0, rotate: 0 };
    const now = performance.now();
    let scale = 1;
    let offsetY = 0;
    let rotate = 0;
    if (this.isPressed) {
      scale = 0.92;
    } else if (this.releasedAt !== null) {
      const elapsed = (now - this.releasedAt) / 1000;
      const bounceDur = 0.35;
      if (elapsed < bounceDur) {
        const p = elapsed / bounceDur;
        scale = 1 + Math.sin(p * Math.PI) * 0.12;
        rotate = Math.sin(p * Math.PI * 2) * 0.04;
      } else {
        this.releasedAt = null;
      }
    }
    if (this.isHovered && this.hoverStartedAt !== null) {
      const t = (now - this.hoverStartedAt) / 1000;
      offsetY = Math.sin(t * 6) * 1.5;
    }
    return { scale, offsetY, rotate };
  }

  protected applyButtonTransform(ctx: CanvasRenderingContext2D): boolean {
    const { scale, offsetY, rotate } = this.getAnimTransform();
    if (scale === 1 && offsetY === 0 && rotate === 0) return false;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.save();
    ctx.translate(cx, cy + offsetY);
    ctx.rotate(rotate);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const transformed = this.applyButtonTransform(ctx);
    const color = this.isPressed || this.isHovered ? getButtonHoverColor(this.stage) : getButtonColor(this.stage);
    ctx.fillStyle = rgb(color);
    ctx.strokeStyle = rgb(getTextColor(this.stage));
    ctx.lineWidth = 2;
    roundRect(ctx, this.x, this.y, this.width, this.height, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = rgb(getTextColor(this.stage));
    ctx.font = `${this.fontSize}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
    if (transformed) ctx.restore();
  }
}

export class IconButton extends Button {
  iconType: "food" | "brush" | "play" | "back" | "settings" | "chat";

  constructor(opts: {
    x: number;
    y: number;
    size: number;
    iconType: "food" | "brush" | "play" | "back" | "settings" | "chat";
    stage: GrowthStage;
    onClick?: () => void;
  }) {
    super({
      x: opts.x,
      y: opts.y,
      width: opts.size,
      height: opts.size,
      text: "",
      stage: opts.stage,
      onClick: opts.onClick,
    });
    this.iconType = opts.iconType;
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    const transformed = this.applyButtonTransform(ctx);
    const color = this.isPressed || this.isHovered ? getButtonHoverColor(this.stage) : getButtonColor(this.stage);
    ctx.fillStyle = rgb(color);
    ctx.strokeStyle = rgb(getTextColor(this.stage));
    ctx.lineWidth = 2;
    roundRect(ctx, this.x, this.y, this.width, this.height, 8);
    ctx.fill();
    ctx.stroke();

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const iconSize = this.width / 2;
    ctx.strokeStyle = rgb(getTextColor(this.stage));
    ctx.fillStyle = rgb(getTextColor(this.stage));
    ctx.lineWidth = 3;

    if (this.iconType === "food") {
      ctx.beginPath();
      ctx.moveTo(cx - iconSize / 2, cy - iconSize / 2);
      ctx.lineTo(cx - iconSize / 2, cy + iconSize / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + iconSize / 2, cy - iconSize / 2);
      ctx.lineTo(cx + iconSize / 2, cy + iconSize / 2);
      ctx.stroke();
    } else if (this.iconType === "brush") {
      ctx.fillRect(cx - iconSize / 2, cy - iconSize / 6, iconSize, iconSize / 3);
      ctx.fillRect(cx + iconSize / 4, cy - iconSize / 2, iconSize / 4, iconSize);
    } else if (this.iconType === "back") {
      ctx.beginPath();
      ctx.moveTo(cx + iconSize / 3, cy - iconSize / 2);
      ctx.lineTo(cx - iconSize / 3, cy);
      ctx.lineTo(cx + iconSize / 3, cy + iconSize / 2);
      ctx.stroke();
    } else if (this.iconType === "play") {
      ctx.beginPath();
      ctx.arc(cx, cy, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgb(getButtonColor(this.stage));
      ctx.beginPath();
      ctx.arc(cx - iconSize / 6, cy - iconSize / 6, iconSize / 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.iconType === "settings") {
      ctx.beginPath();
      ctx.arc(cx, cy, iconSize / 4, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i;
        const inner = iconSize / 3;
        const outer = iconSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (this.iconType === "chat") {
      roundRect(ctx, cx - iconSize / 2, cy - iconSize / 3, iconSize, (iconSize * 2) / 3, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - iconSize / 6, cy + iconSize / 3);
      ctx.lineTo(cx - iconSize / 10, cy + iconSize / 2 + 3);
      ctx.lineTo(cx + iconSize / 12, cy + iconSize / 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - iconSize / 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx + iconSize / 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (transformed) ctx.restore();
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
