import { Renderer } from "./Renderer";

export class Input {
  constructor(
    private readonly renderer: Renderer,
    private readonly canvas: HTMLCanvasElement
  ) {}

  bind(opts: {
    onMove?: (x: number, y: number) => void;
    onDown?: (x: number, y: number) => void;
    onUp?: (x: number, y: number) => void;
    onKeyDown?: (event: KeyboardEvent) => void;
  }): void {
    this.canvas.addEventListener("pointermove", (event) => {
      const point = this.renderer.screenToLogical(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      opts.onMove?.(point.x, point.y);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      const point = this.renderer.screenToLogical(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic presses from the escaped AHEG player do not create a capturable pointer.
      }
      opts.onDown?.(point.x, point.y);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      const point = this.renderer.screenToLogical(event.clientX, event.clientY);
      if (!point) {
        return;
      }
      opts.onUp?.(point.x, point.y);
    });

    window.addEventListener("keydown", (event) => {
      opts.onKeyDown?.(event);
    });

    window.addEventListener("resize", () => {
      this.renderer.resize();
    });
  }
}
