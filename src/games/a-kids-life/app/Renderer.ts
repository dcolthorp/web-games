import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../constants";

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("No 2D context");
    }

    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    this.dpr = Math.max(1, window.devicePixelRatio || 1);

    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);

    this.scale = Math.min(this.cssWidth / LOGICAL_WIDTH, this.cssHeight / LOGICAL_HEIGHT);
    this.offsetX = (this.cssWidth - LOGICAL_WIDTH * this.scale) / 2;
    this.offsetY = (this.cssHeight - LOGICAL_HEIGHT * this.scale) / 2;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = "#f7e9e4"): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
  }

  begin(): void {
    this.ctx.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.dpr * this.offsetX,
      this.dpr * this.offsetY
    );
  }

  screenToLogical(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.offsetX) / this.scale;
    const y = (clientY - rect.top - this.offsetY) / this.scale;
    if (x < 0 || y < 0 || x > LOGICAL_WIDTH || y > LOGICAL_HEIGHT) {
      return null;
    }
    return { x, y };
  }
}
