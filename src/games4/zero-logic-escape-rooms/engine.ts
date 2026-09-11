// Everything the rooms share: the canvas, the empty box every room is drawn
// in, and small drawing helpers.

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  name: string;
  // Shown on the way into the next room, e.g. "You fell down the table hole…"
  exitLine: string;
  reset(startAt: number): void;
  update(now: number, dt: number): void;
  draw(now: number): void;
  pointerDown(p: Point): void;
  pointerMove(p: Point): void;
  pointerUp(p: Point): void;
  cursor(p: Point): string;
}

export interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface RoomPalette {
  ceiling: string;
  side: string;
  wallTop: string;
  wallBottom: string;
  floorBack: string;
  floorFront: string;
  skirting: string;
  floor: "boards" | "concrete";
}

export const canvas = document.getElementById("game") as HTMLCanvasElement;
export const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

export const W = canvas.width;
export const H = canvas.height;

// Every room is a box seen from the front: a back wall, and the ceiling, floor
// and side walls slanting out to the edges of the canvas.
export const BACK = { left: 120, right: 840, top: 40, bottom: 400 };

export function drawRoomBox(palette: RoomPalette): void {
  ctx.fillStyle = palette.ceiling;
  poly([0, 0], [W, 0], [BACK.right, BACK.top], [BACK.left, BACK.top]);
  ctx.fillStyle = palette.side;
  poly([0, 0], [BACK.left, BACK.top], [BACK.left, BACK.bottom], [0, H]);
  poly([W, 0], [BACK.right, BACK.top], [BACK.right, BACK.bottom], [W, H]);

  const wall = ctx.createLinearGradient(0, BACK.top, 0, BACK.bottom);
  wall.addColorStop(0, palette.wallTop);
  wall.addColorStop(1, palette.wallBottom);
  ctx.fillStyle = wall;
  ctx.fillRect(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top);

  const floor = ctx.createLinearGradient(0, BACK.bottom, 0, H);
  floor.addColorStop(0, palette.floorBack);
  floor.addColorStop(1, palette.floorFront);
  ctx.fillStyle = floor;
  poly([BACK.left, BACK.bottom], [BACK.right, BACK.bottom], [W, H], [0, H]);

  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 2;
  const lanes = palette.floor === "boards" ? 8 : 6;
  for (let i = 1; i < lanes; i += 1) {
    line(BACK.left + ((BACK.right - BACK.left) * i) / lanes, BACK.bottom, (W * i) / lanes, H);
  }
  if (palette.floor === "concrete") {
    // Slab joints across the floor, closer together toward the back.
    for (let i = 1; i < 5; i += 1) {
      const f = (i / 5) ** 1.6;
      const y = BACK.bottom + (H - BACK.bottom) * f;
      line(lerp(BACK.left, 0, f), y, lerp(BACK.right, W, f), y);
    }
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  line(0, 0, BACK.left, BACK.top);
  line(W, 0, BACK.right, BACK.top);
  line(0, H, BACK.left, BACK.bottom);
  line(W, H, BACK.right, BACK.bottom);
  ctx.strokeRect(BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top);

  ctx.fillStyle = palette.skirting;
  ctx.fillRect(BACK.left, BACK.bottom - 14, BACK.right - BACK.left, 14);
}

export function drawVignette(): void {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
  v.addColorStop(0, "rgba(0, 0, 0, 0)");
  v.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// The line of text that fades in and out at the bottom when a room starts.
export function drawCaption(text: string, secondsIn: number): void {
  if (secondsIn < 0 || secondsIn > 5) return;
  const alpha = secondsIn < 0.5 ? secondsIn / 0.5 : secondsIn > 4 ? 5 - secondsIn : 1;
  ctx.globalAlpha = alpha;
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  const width = ctx.measureText(text).width + 60;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  roundRect(W / 2 - width / 2, H - 70, width, 44, 10);
  ctx.fill();
  ctx.fillStyle = "#f5efe6";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H - 48);
  ctx.globalAlpha = 1;
}

// Zooms the scene into (x, y) as t goes from 0 to 1. Call between save and
// restore. Returns how dark the screen should be on top.
export function diveInto(x: number, y: number, t: number): number {
  const zoom = 1 + t * t * 14;
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  return Math.max(0, (t - 0.55) / 0.45);
}

export function updateDust(dust: Dust[], dt: number): Dust[] {
  for (const d of dust) {
    d.vy += 500 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt * 1.2;
  }
  return dust.filter((d) => d.life > 0 && d.y < H);
}

export function drawDust(dust: Dust[], color: string): void {
  ctx.fillStyle = color;
  for (const d of dust) {
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.fillRect(d.x, d.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

export function poly(...points: [number, number][]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export function line(x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function inRect(p: Point, x: number, y: number, w: number, h: number): boolean {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
