import { SIMPLE_FONT } from "../constants";

export type ButtonTone = "cream" | "pink" | "mint" | "sky" | "gold" | "plum";

const TONES: Record<ButtonTone, { fill: string; stroke: string; text: string }> = {
  cream: { fill: "#fff4e8", stroke: "#9e7e72", text: "#684e4d" },
  pink: { fill: "#ffd6e6", stroke: "#b76b8a", text: "#7b4361" },
  mint: { fill: "#d8f3e7", stroke: "#69a78a", text: "#3d6d60" },
  sky: { fill: "#dbeaff", stroke: "#6d8ec9", text: "#415c8c" },
  gold: { fill: "#ffe7b8", stroke: "#c29747", text: "#866221" },
  plum: { fill: "#ead9ff", stroke: "#8d70bf", text: "#574178" },
};

export class Button {
  isHovered = false;
  isPressed = false;

  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number,
    public label: string,
    public tone: ButtonTone,
    public onClick?: () => void
  ) {}

  contains(px: number, py: number): boolean {
    return px >= this.x && py >= this.y && px <= this.x + this.width && py <= this.y + this.height;
  }

  handlePointerMove(px: number, py: number): void {
    this.isHovered = this.contains(px, py);
  }

  handlePointerDown(px: number, py: number): void {
    this.isPressed = this.contains(px, py);
  }

  handlePointerUp(px: number, py: number): void {
    const wasPressed = this.isPressed;
    this.isPressed = false;
    if (wasPressed && this.contains(px, py)) {
      this.onClick?.();
    }
  }

  draw(ctx: CanvasRenderingContext2D, opts?: { sublabel?: string; pulse?: number; icon?: string }): void {
    const tone = TONES[this.tone];
    const pulse = opts?.pulse ?? 0;
    const inset = this.isPressed ? 4 : 0;
    const scale = this.isHovered ? 1.02 + pulse * 0.02 : 1 + pulse * 0.02;
    const width = this.width * scale;
    const height = this.height * scale;
    const x = this.x - (width - this.width) / 2;
    const y = this.y - (height - this.height) / 2 + inset;

    ctx.fillStyle = tone.fill;
    ctx.strokeStyle = tone.stroke;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, width, height, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tone.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 28px ${SIMPLE_FONT}`;
    const labelY = y + height / 2 - (opts?.sublabel ? 12 : 0);
    const text = opts?.icon ? `${opts.icon} ${this.label}` : this.label;
    ctx.fillText(text, x + width / 2, labelY);

    if (opts?.sublabel) {
      ctx.globalAlpha = 0.75;
      ctx.font = `600 18px ${SIMPLE_FONT}`;
      ctx.fillText(opts.sublabel, x + width / 2, y + height / 2 + 18);
      ctx.globalAlpha = 1;
    }
  }
}

export function roundRect(
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
