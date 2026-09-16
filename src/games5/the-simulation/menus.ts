// The menus drawn on top of the game: the lobby you start in, the pause menu,
// and the glitch index. They're all just buttons painted on the canvas.

export interface MenuButton {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // A setting that's currently switched on, like the mode you've picked.
  chosen?: boolean;
  big?: boolean;
}

export function drawButton(ctx: CanvasRenderingContext2D, button: MenuButton): void {
  ctx.beginPath();
  ctx.roundRect(button.x, button.y, button.width, button.height, 12);
  ctx.fillStyle = button.chosen ? "#a6ff9b" : "rgba(255, 255, 255, 0.07)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = button.chosen ? "#0a3d1c" : "rgba(214, 235, 255, 0.35)";
  ctx.stroke();

  ctx.fillStyle = button.chosen ? "#0a3d1c" : "#e8f1ff";
  ctx.font = `bold ${button.big ? 30 : 22}px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 1);
}

export function buttonAt(buttons: MenuButton[], x: number, y: number): string | null {
  for (const button of buttons) {
    const inside = x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height;
    if (inside) return button.id;
  }
  return null;
}

// A row of buttons, spread evenly across the middle of the screen.
export function row(
  W: number,
  y: number,
  items: { id: string; label: string; chosen?: boolean }[],
  width = 190,
  height = 52
): MenuButton[] {
  const gap = 16;
  const all = items.length * width + (items.length - 1) * gap;
  return items.map((item, index) => ({
    ...item,
    x: W / 2 - all / 2 + index * (width + gap),
    y,
    width,
    height,
  }));
}
