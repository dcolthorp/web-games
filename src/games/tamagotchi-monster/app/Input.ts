import { Renderer } from "./Renderer";

export class Input {
  private readonly renderer: Renderer;
  private readonly target: HTMLCanvasElement;

  private onMove?: (x: number, y: number) => void;
  private onDown?: (x: number, y: number) => void;
  private onUp?: (x: number, y: number) => void;
  private onKeyDown?: (e: KeyboardEvent) => void;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.target = renderer.canvas;
  }

  bind(opts: {
    onMove?: (x: number, y: number) => void;
    onDown?: (x: number, y: number) => void;
    onUp?: (x: number, y: number) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
  }): void {
    this.onMove = opts.onMove;
    this.onDown = opts.onDown;
    this.onUp = opts.onUp;
    this.onKeyDown = opts.onKeyDown;

    this.target.addEventListener("pointermove", this.handlePointerMove);
    this.target.addEventListener("pointerdown", this.handlePointerDown);
    this.target.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("keydown", this.handleKeyDown);

    window.addEventListener("resize", this.handleResize);
  }

  dispose(): void {
    this.target.removeEventListener("pointermove", this.handlePointerMove);
    this.target.removeEventListener("pointerdown", this.handlePointerDown);
    this.target.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.handleResize);
  }

  private handleResize = (): void => {
    this.renderer.resize();
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.onMove) return;
    const p = this.renderer.screenToLogical(e.clientX, e.clientY);
    if (!p) return;
    this.onMove(p.x, p.y);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.onDown) return;
    try {
      this.target.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic presses from the escaped AHEG player do not create a capturable pointer.
    }
    const p = this.renderer.screenToLogical(e.clientX, e.clientY);
    if (!p) return;
    this.onDown(p.x, p.y);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.onUp) return;
    const p = this.renderer.screenToLogical(e.clientX, e.clientY);
    if (!p) return;
    this.onUp(p.x, p.y);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.onKeyDown?.(e);
  };
}
