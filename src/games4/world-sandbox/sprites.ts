// Pixel art. Every sprite is a little grid of letters, one letter per pixel,
// and each letter is a colour from PALETTE. "." is see-through. The world is
// drawn at a tiny size and blown up without smoothing, so a sprite pixel is the
// same size as a pixel of land or sea.

export const PALETTE: Record<string, string> = {
  k: "#1b1b1f", // black
  w: "#f4f1ea", // white
  g: "#9aa0a8", // grey
  G: "#5d626b", // dark grey
  b: "#8a5a2b", // brown
  B: "#5a3a1c", // dark brown
  t: "#d9a066", // tan
  o: "#ee7a2a", // orange
  y: "#f7d23e", // yellow
  r: "#d8362b", // red
  R: "#8e1f1a", // dark red
  p: "#f2a3b3", // pink
  P: "#c9687e", // dark pink
  h: "#86d86e", // light green
  l: "#3f9a3a", // green
  L: "#1f5f2a", // dark green
  c: "#9fe3ff", // light blue
  u: "#3b7fe0", // blue
  U: "#1d3f8a", // dark blue
  v: "#9b59d9", // purple
  V: "#5b2d8f", // dark purple
  s: "#f0dc9a", // sand
  X: "#c0c4cc", // a tribe's colour (see tinted)
};

export interface Sprite {
  width: number;
  height: number;
  frames: HTMLCanvasElement[];
}

// Something you can pick from a toolbar and put in the world.
export interface Choice {
  id: string;
  name: string;
  sprite: Sprite;
  // Where it can go and where it can move: land, water, or anywhere (it flies).
  habitat: "land" | "sea" | "air";
  // Tsunamis can't wash it away.
  sturdy?: boolean;
}

function paint(art: string, palette = PALETTE): HTMLCanvasElement {
  const rows = art
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  const layer = document.createElement("canvas");
  layer.width = Math.max(...rows.map((row) => row.length));
  layer.height = rows.length;
  const g = layer.getContext("2d") as CanvasRenderingContext2D;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = palette[row[x] ?? "."];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  });
  return layer;
}

// Pass more than one picture to animate it.
export function sprite(...frames: string[]): Sprite {
  return fromFrames(frames.map((art) => paint(art)));
}

function fromFrames(painted: HTMLCanvasElement[]): Sprite {
  const first = painted[0] as HTMLCanvasElement;
  return { width: first.width, height: first.height, frames: painted };
}

// The same pixel art with every "X" pixel in `color`, cached so each colour is only painted once.
const tintCache = new Map<string, Sprite>();
export function tinted(key: string, color: string, ...frames: string[]): Sprite {
  const id = `${key}:${color}`;
  let s = tintCache.get(id);
  if (!s) {
    s = fromFrames(frames.map((art) => paint(art, { ...PALETTE, X: color })));
    tintCache.set(id, s);
  }
  return s;
}

// (x, y) is the spot on the ground the sprite stands on. Sprites face right;
// flip them to face left.
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  now = 0,
  flip = false,
  scale = 1
): void {
  const frame = s.frames[Math.floor(now / 250) % s.frames.length] as HTMLCanvasElement;
  const width = Math.round(s.width * scale);
  const height = Math.round(s.height * scale);
  const left = Math.round(x - width / 2);
  const top = Math.round(y) - height + 1;
  if (scale !== 1) {
    // Blown up without smoothing, so a big mountain is the same mountain with
    // bigger pixels.
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(left + width, top);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0, width, height);
    } else {
      ctx.drawImage(frame, left, top, width, height);
    }
    ctx.restore();
    return;
  }
  if (!flip) {
    ctx.drawImage(frame, left, top);
    return;
  }
  ctx.save();
  ctx.translate(left + s.width, top);
  ctx.scale(-1, 1);
  ctx.drawImage(frame, 0, 0);
  ctx.restore();
}

// For buttons: an <img> of the first frame, blown up with CSS (image-rendering: pixelated).
// Turning a sprite into a picture isn't free, and the crystal list asks for
// hundreds of them at a time, so each one is only made once.
const iconCache = new WeakMap<Sprite, string>();

export function spriteIcon(s: Sprite): string {
  let html = iconCache.get(s);
  if (!html) {
    html = `<img class="pixel-icon" src="${(s.frames[0] as HTMLCanvasElement).toDataURL()}" alt="" style="width: ${s.width * 3}px" />`;
    iconCache.set(s, html);
  }
  return html;
}
