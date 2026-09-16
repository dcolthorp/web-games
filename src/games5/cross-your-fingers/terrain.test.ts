import { describe, expect, it } from "vitest";
import {
  AIR,
  COIN_VALUES,
  COLS,
  ROWS,
  WATER,
  isSolid,
  makePiece,
  pieceWorth,
  reachable,
  tileAt,
} from "./terrain";

describe("a piece of land", () => {
  it("is the same land for the same seed, and different for another", () => {
    expect([...makePiece(11).tiles]).toEqual([...makePiece(11).tiles]);
    expect([...makePiece(11).tiles]).not.toEqual([...makePiece(12).tiles]);
  });

  it("has sky above and ground below, everywhere across it", () => {
    const piece = makePiece(5);
    for (let x = 0; x < COLS; x += 1) {
      expect(isSolid(tileAt(piece, x, 0))).toBe(false);
      expect(isSolid(tileAt(piece, x, ROWS - 1))).toBe(true);
    }
  });

  it("drops you standing in the open", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const piece = makePiece(seed);
      const x = Math.floor(piece.spawnX / 24);
      const y = Math.floor(piece.spawnY / 24);
      expect(tileAt(piece, x, y)).toBe(AIR);
    }
  });

  it("puts every coin somewhere you could reach into, never inside the ground", () => {
    for (const seed of [7, 8, 9, 10]) {
      const piece = makePiece(seed);
      expect(piece.coins.length).toBeGreaterThan(4);
      for (const coin of piece.coins) {
        expect(tileAt(piece, Math.floor(coin.x), Math.floor(coin.y))).toBe(AIR);
      }
    }
  });

  it("knows what a piece is worth, counting the rare ones for more", () => {
    expect(COIN_VALUES.plain).toBe(1);
    expect(COIN_VALUES.blue).toBe(3);
    expect(COIN_VALUES.red).toBe(5);
    expect(COIN_VALUES.black).toBe(10);
    const piece = makePiece(3);
    const byHand = piece.coins.reduce((total, coin) => total + COIN_VALUES[coin.kind], 0);
    expect(pieceWorth(piece)).toBe(byHand);
  });

  it("makes some lands rich and some poor, which is the whole game", () => {
    const worths = [];
    for (let seed = 0; seed < 40; seed += 1) worths.push(pieceWorth(makePiece(seed)));
    expect(Math.max(...worths)).toBeGreaterThan(Math.min(...worths) + 8);
  });
});

describe("water", () => {
  it("fills the dips on some pieces and leaves others dry", () => {
    let wet = 0;
    let dry = 0;
    for (let seed = 0; seed < 30; seed += 1) {
      const piece = makePiece(seed);
      if (piece.waterLevel < ROWS) wet += 1;
      else dry += 1;
    }
    expect(wet).toBeGreaterThan(5);
    expect(dry).toBeGreaterThan(0);
  });

  it("only fills the open space below the water line, never the ground", () => {
    for (const seed of [2, 6, 14, 22]) {
      const piece = makePiece(seed);
      if (piece.waterLevel >= ROWS) continue;
      for (let x = 0; x < COLS; x += 1) {
        for (let y = 0; y < ROWS; y += 1) {
          const tile = tileAt(piece, x, y);
          if (tile === WATER) expect(y).toBeGreaterThanOrEqual(piece.waterLevel);
          if (y < piece.waterLevel) expect(tile).not.toBe(WATER);
        }
      }
    }
  });

  it("starts you on dry land when there's any to be had", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const piece = makePiece(seed);
      if (piece.waterLevel >= ROWS) continue;
      expect(Math.floor(piece.spawnY / 24)).toBeLessThan(piece.waterLevel);
    }
  });
});

describe("reaching the coins", () => {
  it("never hides a coin in a sealed pocket", () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const piece = makePiece(seed);
      const openSpace = reachable(piece);
      for (const coin of piece.coins) {
        const x = Math.floor(coin.x);
        const y = Math.floor(coin.y);
        expect(openSpace[y * COLS + x]).toBe(true);
      }
    }
  });
});

describe("coin trails", () => {
  it("lays coins out in runs that arc up and come down again", () => {
    let arcsFound = 0;
    for (let seed = 0; seed < 25; seed += 1) {
      const piece = makePiece(seed);
      const trails = new Map<number, { x: number; y: number }[]>();
      for (const coin of piece.coins) {
        if (coin.trail < 0) continue;
        const run = trails.get(coin.trail) ?? [];
        run.push({ x: coin.x, y: coin.y });
        trails.set(coin.trail, run);
      }
      expect(trails.size).toBeGreaterThan(0);

      for (const run of trails.values()) {
        if (run.length < 4) continue;
        const first = run[0];
        const last = run[run.length - 1];
        const highest = run.reduce((best, coin) => (coin.y < best.y ? coin : best), run[0] ?? { x: 0, y: 0 });
        if (!first || !last) continue;
        // The run goes along, and its top is above both of its ends.
        expect(last.x).toBeGreaterThan(first.x);
        if (highest.y < first.y && highest.y < last.y) arcsFound += 1;
      }
    }
    expect(arcsFound).toBeGreaterThan(10);
  });

  it("still never puts one where you can't get to it", () => {
    for (let seed = 30; seed < 50; seed += 1) {
      const piece = makePiece(seed);
      const openSpace = reachable(piece);
      for (const coin of piece.coins) {
        expect(openSpace[Math.floor(coin.y) * COLS + Math.floor(coin.x)]).toBe(true);
      }
    }
  });
});
