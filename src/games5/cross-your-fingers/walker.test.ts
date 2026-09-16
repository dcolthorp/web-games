import { describe, expect, it } from "vitest";
import { AIR, ROWS, TILE, WATER, isSolid, makePiece, tileAt, type Piece } from "./terrain";
import { JUMP_SPEED, newWalker, updateWalker, type Controls, type Walker } from "./walker";

const STILL: Controls = { move: 0, jump: false };

function run(piece: Piece, walker: Walker, controls: Controls, seconds: number): void {
  for (let step = 0; step < seconds * 60; step += 1) updateWalker(piece, walker, controls, 1 / 60);
}

describe("the little guy", () => {
  it("falls until he's standing on the land", () => {
    const piece = makePiece(21);
    const walker = newWalker(piece.spawnX, 40);
    run(piece, walker, STILL, 3);
    expect(walker.onGround).toBe(true);
    expect(walker.vy).toBe(0);
  });

  it("runs the way you point him", () => {
    const piece = makePiece(21);
    const walker = newWalker(piece.spawnX, piece.spawnY);
    run(piece, walker, STILL, 1);
    const startedAt = walker.x;
    run(piece, walker, { move: 1, jump: false }, 0.5);
    expect(walker.x).toBeGreaterThan(startedAt);
  });

  it("jumps when he's on the ground, and not while he's in the air", () => {
    const piece = makePiece(21);
    const walker = newWalker(piece.spawnX, piece.spawnY);
    run(piece, walker, STILL, 2);
    const standingAt = walker.y;
    updateWalker(piece, walker, { move: 0, jump: true }, 1 / 60);
    expect(walker.vy).toBeLessThan(0);
    // Already up in the air: pressing jump again does nothing.
    run(piece, walker, { move: 0, jump: true }, 0.2);
    expect(walker.vy).toBeGreaterThan(-JUMP_SPEED);
    run(piece, walker, STILL, 3);
    expect(walker.y).toBeCloseTo(standingAt, 0);
  });

  it("can't walk off the edge of the land", () => {
    const piece = makePiece(4);
    const walker = newWalker(piece.spawnX, piece.spawnY);
    run(piece, walker, { move: -1, jump: false }, 6);
    expect(walker.x).toBeGreaterThan(0);
  });
});

describe("swimming", () => {
  // A piece with water in it, and a spot in that water to start from.
  function wetPiece(): { piece: Piece; x: number; y: number } | null {
    for (let seed = 0; seed < 60; seed += 1) {
      const piece = makePiece(seed);
      if (piece.waterLevel >= ROWS) continue;
      for (let x = 2; x < 38; x += 1) {
        const y = piece.waterLevel + 2;
        if (tileAt(piece, x, y) === WATER && tileAt(piece, x, y - 1) === WATER) {
          return { piece, x: (x + 0.5) * TILE, y: (y + 1) * TILE };
        }
      }
    }
    return null;
  }

  it("sinks slowly instead of dropping like a stone", () => {
    const wet = wetPiece();
    expect(wet).not.toBeNull();
    if (!wet) return;
    const swimmer = newWalker(wet.x, wet.y);
    const faller = newWalker(wet.x, wet.y);
    run(wet.piece, swimmer, STILL, 0.3);
    expect(swimmer.swimming).toBe(true);
    // Out of water, gravity would have taken him more than twice as far.
    faller.vy = 0;
    expect(swimmer.vy).toBeLessThan(200);
  });

  it("swims upwards while you hold jump", () => {
    const wet = wetPiece();
    expect(wet).not.toBeNull();
    if (!wet) return;
    const swimmer = newWalker(wet.x, wet.y);
    const startedAt = swimmer.y;
    run(wet.piece, swimmer, { move: 0, jump: true }, 0.4);
    expect(swimmer.y).toBeLessThan(startedAt);
  });
});

describe("getting out of the water", () => {
  it("climbs out of open water onto the bank beside it", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const piece = makePiece(seed);
      if (piece.waterLevel >= ROWS) continue;
      const top = piece.waterLevel;
      for (let x = 3; x < 35; x += 1) {
        // Swimming in open water, with sky above.
        if (tileAt(piece, x, top) !== WATER) continue;
        if (tileAt(piece, x, top - 1) !== AIR || tileAt(piece, x, top - 2) !== AIR) continue;
        // Dry land one step up beside it, with room to stand.
        if (!isSolid(tileAt(piece, x + 1, top - 1))) continue;
        if (tileAt(piece, x + 1, top - 2) !== AIR || tileAt(piece, x + 1, top - 3) !== AIR) continue;

        const walker = newWalker((x + 0.5) * TILE, (top + 1) * TILE);
        run(piece, walker, { move: 1, jump: true }, 1);
        expect(walker.swimming).toBe(false);
        expect(walker.y / TILE).toBeLessThan(top);
        return;
      }
    }
    throw new Error("no piece of land had open water beside a bank to test with");
  });
});
