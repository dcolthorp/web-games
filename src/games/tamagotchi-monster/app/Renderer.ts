import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../constants";

export type Viewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private viewport: Viewport;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Failed to create 2D canvas context");
    this.ctx = ctx;
    this.viewport = {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      cssWidth: 1,
      cssHeight: 1,
      dpr: 1,
    };
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);

    const scale = Math.min(cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT);
    const offsetX = (cssWidth - LOGICAL_WIDTH * scale) / 2;
    const offsetY = (cssHeight - LOGICAL_HEIGHT * scale) / 2;

    this.viewport = { scale, offsetX, offsetY, cssWidth, cssHeight, dpr };

    this.ctx.imageSmoothingEnabled = false;
  }

  getViewport(): Viewport {
    return this.viewport;
  }

  screenToLogical(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const xCss = clientX - rect.left;
    const yCss = clientY - rect.top;
    const { scale, offsetX, offsetY } = this.viewport;
    const x = (xCss - offsetX) / scale;
    const y = (yCss - offsetY) / scale;
    if (x < 0 || y < 0 || x > LOGICAL_WIDTH || y > LOGICAL_HEIGHT) return null;
    return { x, y };
  }

  clear(letterboxColor = "#000000"): void {
    const { cssWidth, cssHeight, dpr } = this.viewport;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.fillStyle = letterboxColor;
    this.ctx.fillRect(0, 0, cssWidth, cssHeight);
  }

  beginLogical(): void {
    const { scale, offsetX, offsetY, dpr } = this.viewport;
    this.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  }
}

