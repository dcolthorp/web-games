export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(hex: string): Rgba {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 255,
  };
}

function near(pixels: Uint8ClampedArray, at: number, target: Rgba, tolerance: number): boolean {
  return (
    Math.abs((pixels[at] ?? 0) - target.r) <= tolerance &&
    Math.abs((pixels[at + 1] ?? 0) - target.g) <= tolerance &&
    Math.abs((pixels[at + 2] ?? 0) - target.b) <= tolerance &&
    Math.abs((pixels[at + 3] ?? 0) - target.a) <= tolerance
  );
}

/**
 * Paint bucket. Walks outwards from the pixel that got clicked, swallowing
 * every touching pixel that looks like the one underneath the cursor, and
 * stops at anything that doesn't. Returns how many pixels changed so the
 * caller can skip the repaint when the fill did nothing.
 */
export function floodFill(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  color: Rgba,
  tolerance = 24
): number {
  const x = Math.floor(startX);
  const y = Math.floor(startY);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;

  const start = (y * width + x) * 4;
  const target: Rgba = {
    r: pixels[start] ?? 0,
    g: pixels[start + 1] ?? 0,
    b: pixels[start + 2] ?? 0,
    a: pixels[start + 3] ?? 0,
  };
  // Filling a colour with itself would spin forever without this.
  if (near(pixels, start, color, 0)) return 0;

  const seen = new Uint8Array(width * height);
  const stack = [x, y];
  let changed = 0;

  while (stack.length > 0) {
    const py = stack.pop() as number;
    const px = stack.pop() as number;
    const index = py * width + px;
    if (seen[index]) continue;
    seen[index] = 1;

    const at = index * 4;
    if (!near(pixels, at, target, tolerance)) continue;

    pixels[at] = color.r;
    pixels[at + 1] = color.g;
    pixels[at + 2] = color.b;
    pixels[at + 3] = color.a;
    changed += 1;

    if (px > 0) stack.push(px - 1, py);
    if (px < width - 1) stack.push(px + 1, py);
    if (py > 0) stack.push(px, py - 1);
    if (py < height - 1) stack.push(px, py + 1);
  }

  return changed;
}

/**
 * Who draws on whose paper. Round 1 everyone has their own; after that the
 * papers shuffle along by one seat, so the last round hands each drawing back
 * to the person who started it.
 */
export function swapOrder(count: number, shift: number): number[] {
  if (count <= 0) return [];
  const step = ((shift % count) + count) % count;
  return Array.from({ length: count }, (_, seat) => (seat + step) % count);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const DOOR = "🚪";

export interface Door {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the doors ended up. Text is just ink once it's on the paper, so the
 * only way to know a 🚪 is clickable later is to write down the box it landed
 * in while we still know where every letter went.
 */
export function doorBoxes(
  text: string,
  measure: (run: string) => number,
  x: number,
  y: number,
  height: number
): Door[] {
  // Emoji are two code units each, so step through by character, not index.
  const letters = Array.from(text);
  const doors: Door[] = [];
  letters.forEach((letter, index) => {
    if (letter !== DOOR) return;
    const before = letters.slice(0, index).join("");
    doors.push({
      x: x + measure(before),
      y,
      w: measure(letter),
      h: height,
    });
  });
  return doors;
}

export function doorAt(doors: Door[], x: number, y: number): Door | null {
  // Last one wins, so a door drawn on top of an older door is the one that opens.
  for (let index = doors.length - 1; index >= 0; index -= 1) {
    const door = doors[index];
    if (!door) continue;
    if (x >= door.x && x <= door.x + door.w && y >= door.y && y <= door.y + door.h) return door;
  }
  return null;
}
