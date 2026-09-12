import { describe, expect, it } from "vitest";
import { COLS, ROWS, applyStroke, isLand, makeHeights, waveReaches } from "./world";

// All water, with a thin strip of land at x 50–52 and a wide one at x 100–119.
function stripsMap(): Float32Array {
  const heights = new Float32Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row += 1) {
    for (const col of [50, 51, 52]) heights[row * COLS + col] = 1;
    for (let col = 100; col < 120; col += 1) heights[row * COLS + col] = 1;
  }
  return heights;
}

describe("world", () => {
  it("makes the same world from the same seed", () => {
    expect(makeHeights(42)).toEqual(makeHeights(42));
  });

  it("sends a tsunami over thin land but not through a continent", () => {
    const heights = stripsMap();
    expect(waveReaches(heights, 30, 100, 80, 100)).toBe(true);
    expect(waveReaches(heights, 30, 100, 200, 100)).toBe(false);
  });

  it("raises land out of the sea and sinks it again, only near the brush", () => {
    const heights = new Float32Array(COLS * ROWS);
    for (let i = 0; i < 4; i += 1) applyStroke(heights, 60, 60, 0.15);
    expect(isLand(heights, 60, 60)).toBe(true);
    expect(isLand(heights, 60, 70)).toBe(false);
    for (let i = 0; i < 8; i += 1) applyStroke(heights, 60, 60, -0.15);
    expect(isLand(heights, 60, 60)).toBe(false);
  });

  it("lets a tsunami push a little way up onto land", () => {
    const heights = stripsMap();
    expect(waveReaches(heights, 80, 100, 104, 100)).toBe(true);
    expect(waveReaches(heights, 80, 100, 110, 100)).toBe(false);
  });
});
