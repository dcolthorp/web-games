export interface Scene {
  update(dtSeconds: number): void;
  render(ctx: CanvasRenderingContext2D): void;

  onEnter?(): void;
  onExit?(): void;

  onPointerMove?(x: number, y: number): void;
  onPointerDown?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;

  onKeyDown?(e: KeyboardEvent): void;
}

