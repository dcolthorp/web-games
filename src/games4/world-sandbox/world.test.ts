import { describe, expect, it } from "vitest";
import { COLS, ROWS, makeHeights, waveReaches } from "./world";

// All water, with a thin strip of land at x 200–212 and a wide one at x 400–480.
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
    expect(waveReaches(heights, 100, 300, 300, 300)).toBe(true);
    expect(waveReaches(heights, 100, 300, 600, 300)).toBe(false);
  });

  it("lets a tsunami push a little way up onto land", () => {
    const heights = stripsMap();
    expect(waveReaches(heights, 300, 300, 410, 300)).toBe(true);
    expect(waveReaches(heights, 300, 300, 440, 300)).toBe(false);
  });
});
