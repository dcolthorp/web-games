import { MAP_W, type KeyColour, type Rect } from "./engine";

export interface Layout {
  rooms: Rect[];
  corridors: Rect[];
  doors: { x: number; y: number; colour: KeyColour }[];
  keys: { x: number; y: number; colour: KeyColour }[];
  signSpots: { x: number; y: number }[];
  checkpoints: { x: number; y: number }[];
  coinSpots: { x: number; y: number }[];
  blobSlots: { x: number; y: number; axis: "x" | "y"; low: number; high: number }[];
  start: { x: number; y: number };
  treasure: { x: number; y: number };
}

// Six rooms in two rows, worked through left to right.
export const sprawl: Layout = {
  rooms: [
    { x: 2, y: 18, w: 11, h: 8 }, { x: 2, y: 3, w: 11, h: 10 },
    { x: 16, y: 18, w: 11, h: 8 }, { x: 16, y: 3, w: 11, h: 10 },
    { x: 30, y: 18, w: 8, h: 8 }, { x: 30, y: 3, w: 8, h: 10 },
  ],
  corridors: [
    { x: 6, y: 13, w: 2, h: 5 }, { x: 13, y: 21, w: 3, h: 2 },
    { x: 20, y: 13, w: 2, h: 5 }, { x: 27, y: 21, w: 3, h: 2 },
    { x: 33, y: 13, w: 2, h: 5 },
  ],
  doors: [
    { x: 14, y: 21, colour: "red" }, { x: 14, y: 22, colour: "red" },
    { x: 28, y: 21, colour: "blue" }, { x: 28, y: 22, colour: "blue" },
    { x: 33, y: 15, colour: "gold" }, { x: 34, y: 15, colour: "gold" },
  ],
  keys: [
    { x: 7, y: 6, colour: "red" }, { x: 21, y: 6, colour: "blue" }, { x: 34, y: 22, colour: "gold" },
  ],
  signSpots: [{ x: 4, y: 22 }, { x: 18, y: 22 }, { x: 32, y: 21 }],
  checkpoints: [{ x: 5.5, y: 5.5 }, { x: 17.5, y: 24.5 }, { x: 31.5, y: 21.5 }, { x: 33.5, y: 11.5 }],
  coinSpots: [
    { x: 11.5, y: 19.5 }, { x: 3.5, y: 19.5 }, { x: 11.5, y: 4.5 },
    { x: 25.5, y: 24.5 }, { x: 17.5, y: 4.5 }, { x: 25.5, y: 11.5 },
    { x: 36.5, y: 24.5 }, { x: 36.5, y: 4.5 },
  ],
  blobSlots: [
    { x: 21.5, y: 22.5, axis: "x", low: 17.5, high: 25.5 },
    { x: 21.5, y: 6.5, axis: "y", low: 4.5, high: 11.5 },
    { x: 34.5, y: 21.5, axis: "y", low: 19.5, high: 24.5 },
    { x: 7.5, y: 7.5, axis: "x", low: 3.5, high: 11.5 },
    { x: 33.5, y: 6.5, axis: "x", low: 31.5, high: 36.5 },
  ],
  start: { x: 4.5, y: 24.5 },
  treasure: { x: 33.5, y: 6.5 },
};

// The same idea reflected, so it reads as a different place.
export function mirror(layout: Layout): Layout {
  const flipRect = (r: Rect): Rect => ({ ...r, x: MAP_W - r.x - r.w });
  const flipX = (x: number): number => MAP_W - 1 - x;
  return {
    rooms: layout.rooms.map(flipRect),
    corridors: layout.corridors.map(flipRect),
    doors: layout.doors.map((d) => ({ ...d, x: flipX(d.x) })),
    keys: layout.keys.map((k) => ({ ...k, x: flipX(k.x) })),
    signSpots: layout.signSpots.map((s) => ({ ...s, x: flipX(s.x) })),
    checkpoints: layout.checkpoints.map((c) => ({ ...c, x: MAP_W - c.x })),
    coinSpots: layout.coinSpots.map((c) => ({ ...c, x: MAP_W - c.x })),
    blobSlots: layout.blobSlots.map((b) => ({
      ...b,
      x: MAP_W - b.x,
      low: b.axis === "x" ? MAP_W - b.high : b.low,
      high: b.axis === "x" ? MAP_W - b.low : b.high,
    })),
    start: { x: MAP_W - layout.start.x, y: layout.start.y },
    treasure: { x: MAP_W - layout.treasure.x, y: layout.treasure.y },
  };
}

// Two tall columns with a dead-end side room, climbed rather than crossed.
export const tower: Layout = {
  rooms: [
    { x: 2, y: 19, w: 14, h: 7 }, { x: 2, y: 9, w: 14, h: 7 }, { x: 2, y: 2, w: 14, h: 5 },
    { x: 20, y: 19, w: 17, h: 7 }, { x: 20, y: 9, w: 17, h: 7 }, { x: 20, y: 2, w: 17, h: 5 },
  ],
  corridors: [
    { x: 8, y: 16, w: 2, h: 3 }, { x: 8, y: 7, w: 2, h: 2 },
    { x: 16, y: 21, w: 4, h: 2 }, { x: 27, y: 16, w: 2, h: 3 }, { x: 27, y: 7, w: 2, h: 2 },
  ],
  doors: [
    { x: 17, y: 21, colour: "red" }, { x: 17, y: 22, colour: "red" },
    { x: 27, y: 17, colour: "blue" }, { x: 28, y: 17, colour: "blue" },
    { x: 27, y: 7, colour: "gold" }, { x: 28, y: 7, colour: "gold" },
  ],
  keys: [
    { x: 8, y: 12, colour: "red" }, { x: 30, y: 22, colour: "blue" }, { x: 24, y: 12, colour: "gold" },
  ],
  signSpots: [{ x: 4, y: 22 }, { x: 22, y: 22 }, { x: 22, y: 12 }],
  checkpoints: [{ x: 5.5, y: 10.5 }, { x: 21.5, y: 21.5 }, { x: 28.5, y: 14.5 }, { x: 21.5, y: 3.5 }],
  coinSpots: [
    { x: 13.5, y: 20.5 }, { x: 3.5, y: 24.5 }, { x: 13.5, y: 10.5 },
    { x: 4.5, y: 3.5 }, { x: 34.5, y: 20.5 }, { x: 22.5, y: 24.5 },
    { x: 34.5, y: 10.5 }, { x: 34.5, y: 3.5 },
  ],
  blobSlots: [
    { x: 8.5, y: 12.5, axis: "x", low: 3.5, high: 14.5 },
    { x: 28.5, y: 22.5, axis: "x", low: 21.5, high: 35.5 },
    { x: 30.5, y: 12.5, axis: "x", low: 22.5, high: 35.5 },
    { x: 8.5, y: 4.5, axis: "x", low: 3.5, high: 14.5 },
    { x: 24.5, y: 4.5, axis: "x", low: 21.5, high: 35.5 },
  ],
  start: { x: 4.5, y: 22.5 },
  treasure: { x: 28.5, y: 4.5 },
};

// A loop with the prize in the middle, so both halves must be walked.
export const ring: Layout = {
  rooms: [
    { x: 2, y: 19, w: 10, h: 7 }, { x: 2, y: 3, w: 10, h: 8 },
    { x: 28, y: 3, w: 10, h: 8 }, { x: 28, y: 19, w: 10, h: 7 },
    { x: 16, y: 11, w: 9, h: 6 },
  ],
  corridors: [
    { x: 6, y: 11, w: 2, h: 8 }, { x: 12, y: 6, w: 16, h: 2 },
    { x: 32, y: 11, w: 2, h: 8 }, { x: 12, y: 21, w: 16, h: 2 },
    { x: 20, y: 17, w: 2, h: 4 },
  ],
  doors: [
    { x: 32, y: 15, colour: "red" }, { x: 33, y: 15, colour: "red" },
    { x: 19, y: 6, colour: "blue" }, { x: 19, y: 7, colour: "blue" },
    { x: 20, y: 19, colour: "gold" }, { x: 21, y: 19, colour: "gold" },
  ],
  keys: [
    { x: 33, y: 22, colour: "red" }, { x: 6, y: 6, colour: "blue" }, { x: 33, y: 6, colour: "gold" },
  ],
  signSpots: [{ x: 4, y: 22 }, { x: 18, y: 21 }, { x: 30, y: 22 }],
  checkpoints: [{ x: 29.5, y: 21.5 }, { x: 32.5, y: 9.5 }, { x: 17.5, y: 6.5 }, { x: 20.5, y: 17.5 }],
  coinSpots: [
    { x: 10.5, y: 24.5 }, { x: 3.5, y: 19.5 }, { x: 10.5, y: 4.5 },
    { x: 3.5, y: 9.5 }, { x: 36.5, y: 4.5 }, { x: 29.5, y: 9.5 },
    { x: 36.5, y: 24.5 }, { x: 23.5, y: 15.5 },
  ],
  blobSlots: [
    { x: 20.5, y: 21.5, axis: "x", low: 13.5, high: 26.5 },
    { x: 20.5, y: 6.5, axis: "x", low: 13.5, high: 26.5 },
    { x: 6.5, y: 15.5, axis: "y", low: 12.5, high: 17.5 },
    { x: 33.5, y: 22.5, axis: "x", low: 29.5, high: 36.5 },
    { x: 33.5, y: 6.5, axis: "x", low: 29.5, high: 36.5 },
  ],
  start: { x: 4.5, y: 22.5 },
  treasure: { x: 20.5, y: 13.5 },
};
