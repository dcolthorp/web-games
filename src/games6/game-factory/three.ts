// The 3D view for Game Factory games. The background becomes the floor, seen
// from just behind and above the sprite the camera follows, always looking
// "up" the map (so moving up walks forward). Pixels painted in the wall color
// stand up as walls. Sprites stand on the floor like cardboard cutouts.

export const CELL = 8; // stage units per background pixel
const WALL_H = 44;
const FOCAL = 300;
const CAM_BACK = 150;
const CAM_H = 95;
const HORIZON = 120;
const NEAR = 6;

export interface Cutout {
  key: number;
  image: HTMLCanvasElement;
  x: number;
  y: number;
  size: number;
  angle: number;
}

export interface ScreenSpot {
  key: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface View3D {
  floor: HTMLCanvasElement;
  pic: string;
  bgW: number;
  bgH: number;
  wall: string | null;
  wallColor: [number, number, number] | null;
  camX: number;
  camY: number;
  width: number;
  height: number;
}

export function isWall(view: Pick<View3D, "pic" | "bgW" | "bgH" | "wall">, x: number, y: number): boolean {
  if (!view.wall) return false;
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= view.bgW || cy >= view.bgH) return false;
  return view.pic[cy * view.bgW + cx] === view.wall;
}

function shade([r, g, b]: [number, number, number], k: number): string {
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

// Draws the world and returns where each cutout ended up on screen, so clicks
// and speech bubbles can find them.
export function draw3D(ctx: CanvasRenderingContext2D, view: View3D, cutouts: Cutout[]): ScreenSpot[] {
  const { width: W, height: H } = view;
  const camX = view.camX;
  const camY = view.camY + CAM_BACK;
  const project = (x: number, y: number, z: number): { x: number; y: number; s: number } | null => {
    const d = camY - y;
    if (d < NEAR) return null;
    const s = FOCAL / d;
    return { x: W / 2 + (x - camX) * s, y: HORIZON + (CAM_H - z) * s, s };
  };

  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, "#1b2a6b");
  sky.addColorStop(1, "#9fd6ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON + 1);
  // Past the edge of the map: misty nothing.
  ctx.fillStyle = "#86a9c4";
  ctx.fillRect(0, HORIZON, W, H - HORIZON);

  // The floor, one screen row at a time: each row is a stretched-out strip of
  // the background from further or closer away.
  ctx.imageSmoothingEnabled = false;
  for (let sy = HORIZON + 1; sy < H; sy += 1) {
    const d = (CAM_H * FOCAL) / (sy - HORIZON);
    const worldY = camY - d;
    if (worldY < 0 || worldY >= view.bgH * CELL) continue;
    const span = (W * d) / FOCAL;
    const left = camX - span / 2;
    let sx0 = left / CELL;
    let sw = span / CELL;
    let dx = 0;
    let dw = W;
    // Keep the strip inside the picture; outside it there's no floor.
    if (sx0 < 0) {
      const cut = -sx0;
      dx = (cut / sw) * W;
      dw -= dx;
      sw -= cut;
      sx0 = 0;
    }
    if (sx0 + sw > view.bgW) {
      const cut = sx0 + sw - view.bgW;
      dw -= (cut / sw) * dw;
      sw -= cut;
    }
    if (sw <= 0 || dw <= 0) continue;
    ctx.drawImage(view.floor, sx0, Math.floor(worldY / CELL), sw, 1, dx, sy, dw, 1);
  }
  // Far-away floor fades into the distance.
  const haze = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 60);
  haze.addColorStop(0, "rgba(159,214,255,0.7)");
  haze.addColorStop(1, "rgba(159,214,255,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, HORIZON, W, 60);

  // Walls and cutouts get drawn far to near, so near things cover far ones.
  type Thing = { depth: number; side: number; draw: () => void };
  const things: Thing[] = [];
  const wallAt = (cx: number, cy: number): boolean =>
    cx >= 0 && cy >= 0 && cx < view.bgW && cy < view.bgH && !!view.wall && view.pic[cy * view.bgW + cx] === view.wall;
  const quad = (pts: [number, number, number][], fill: string): void => {
    const p = pts.map(([x, y, z]) => project(x, y, z));
    if (p.some((q) => !q)) return;
    ctx.beginPath();
    ctx.moveTo(p[0]!.x, p[0]!.y);
    for (const q of p.slice(1)) ctx.lineTo(q!.x, q!.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  if (view.wall && view.wallColor) {
    const color = view.wallColor;
    for (let cy = 0; cy < view.bgH; cy += 1) {
      for (let cx = 0; cx < view.bgW; cx += 1) {
        if (!wallAt(cx, cy)) continue;
        const x0 = cx * CELL;
        const x1 = x0 + CELL;
        const y0 = cy * CELL;
        const y1 = y0 + CELL;
        if (camY - y1 < NEAR) continue;
        things.push({
          depth: y1,
          side: -Math.abs((x0 + x1) / 2 - camX),
          draw: () => {
            if (camX < x0 && !wallAt(cx - 1, cy)) quad([[x0, y0, 0], [x0, y1, 0], [x0, y1, WALL_H], [x0, y0, WALL_H]], shade(color, 0.62));
            if (camX > x1 && !wallAt(cx + 1, cy)) quad([[x1, y0, 0], [x1, y1, 0], [x1, y1, WALL_H], [x1, y0, WALL_H]], shade(color, 0.62));
            if (!wallAt(cx, cy + 1)) quad([[x0, y1, 0], [x1, y1, 0], [x1, y1, WALL_H], [x0, y1, WALL_H]], shade(color, 0.85));
            quad([[x0, y0, WALL_H], [x1, y0, WALL_H], [x1, y1, WALL_H], [x0, y1, WALL_H]], shade(color, 1.1));
          },
        });
      }
    }
  }
  const spots: ScreenSpot[] = [];
  for (const c of cutouts) {
    things.push({
      depth: c.y + 0.5,
      side: 0,
      draw: () => {
        const base = project(c.x, c.y, 0);
        if (!base) return;
        const size = c.size * base.s;
        ctx.save();
        ctx.translate(base.x, base.y - size / 2);
        ctx.rotate(c.angle);
        ctx.drawImage(c.image, -size / 2, -size / 2, size, size);
        ctx.restore();
        spots.push({ key: c.key, x: base.x - size / 2, y: base.y - size, w: size, h: size });
      },
    });
  }
  things.sort((a, b) => a.depth - b.depth || a.side - b.side);
  for (const thing of things) thing.draw();
  return spots;
}
