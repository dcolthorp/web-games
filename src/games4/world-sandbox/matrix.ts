import { sprite, type Choice, type Sprite } from "./sprites";
import { H, W } from "./world";

// Breaking physics. These switches change how the whole world behaves until
// they're switched off again. They aren't saved.

export const physics = { matrix: false, frozen: false, fast: false, noWalls: false, float: false };
export type Law = keyof typeof physics;

export const LAWS: { law: Law; name: string; on: string; off: string; sprite: Sprite }[] = [
  {
    law: "matrix",
    name: "The Matrix",
    on: "You're in the Matrix. Everything is made of code.",
    off: "You came back out of the Matrix.",
    sprite: sprite(`
      h.l.h.l
      l.h.L.h
      h.L.l.l
      L.l.h.L
      l.h.L.h
      .hL.l.h
      h.l.hL.
    `),
  },
  {
    law: "frozen",
    name: "Freeze Time",
    on: "Time is frozen.",
    off: "Time is moving again.",
    sprite: sprite(`
      ...c...
      .c.c.c.
      ..ccc..
      cccwccc
      ..ccc..
      .c.c.c.
      ...c...
    `),
  },
  {
    law: "fast",
    name: "Fast Time",
    on: "Time is going five times as fast!",
    off: "Time is back to normal speed.",
    sprite: sprite(`
      y..y...
      yy.yy..
      yyyyyy.
      yy.yy..
      y..y...
    `),
  },
  {
    law: "noWalls",
    name: "No Walls",
    on: "No more walls: fish can walk on land and sheep can swim!",
    off: "Land and water are back to normal.",
    sprite: sprite(`
      o.ooo..
      oooook.
      o.ooo..
      lllllll
    `),
  },
  {
    law: "float",
    name: "No Gravity",
    on: "Gravity is off! Everything is floating away.",
    off: "Gravity is back.",
    sprite: sprite(`
      ..w..
      .www.
      wwwww
      ..w..
      ..w..
      ..w..
    `),
  },
];

export const MATRIX_ICON = LAWS[0]?.sprite as Sprite;

// The click tool in the Matrix: copies whatever you click on.
export const COPY: Choice = {
  id: "copy",
  name: "Copy",
  habitat: "air",
  sprite: sprite(`
    wwww...
    w..w...
    w.gggg.
    wwg..g.
    ..g..g.
    ..gggg.
  `),
};

// Turns what's already drawn green, keeping how light or dark each pixel is,
// then rains green code down over it.
export function drawMatrix(ctx: CanvasRenderingContext2D, now: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "color";
  ctx.fillStyle = "#00ff41";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#6a8a6a";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  for (let col = 0; col < W / 4; col += 1) {
    const speed = 30 + ((col * 37) % 50);
    const head = Math.floor(((now / 1000) * speed + col * 53) % (H + 40));
    for (let i = 0; i < 14; i += 1) {
      const y = head - i * 2;
      if (y < 0 || y >= H || (y * 7 + col) % 3 === 0) continue;
      ctx.fillStyle = i === 0 ? "#d8ffd8" : i < 5 ? "#3fdc5a" : "#1f7a2a";
      ctx.fillRect(col * 4 + 1, y, 1, 1);
    }
  }
}
