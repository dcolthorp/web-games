import { describe, expect, it } from "vitest";
import { fartImpulse, wrap, wrappedCopies } from "./physics";

const W = 960;
const H = 560;

describe("wrap", () => {
  it("leaves a point inside the screen alone", () => {
    expect(wrap(400, W)).toBe(400);
    expect(wrap(0, W)).toBe(0);
  });

  it("brings you back on the far side instead of stopping at a wall", () => {
    expect(wrap(W + 12, W)).toBe(12);
    expect(wrap(-12, W)).toBe(W - 12);
  });

  it("handles a fart big enough to cross more than one screen in a frame", () => {
    expect(wrap(W * 3 + 25, W)).toBe(25);
    expect(wrap(-(W * 2) - 25, W)).toBe(W - 25);
  });

  it("never returns a negative or out-of-range position", () => {
    for (const v of [-5000, -1, 0, 959, 960, 961, 100000]) {
      const result = wrap(v, W);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(W);
    }
  });
});

describe("wrappedCopies", () => {
  it("draws one copy well away from any edge", () => {
    expect(wrappedCopies(W / 2, H / 2, 70, W, H)).toEqual([{ x: W / 2, y: H / 2 }]);
  });

  it("draws a second copy across the seam when straddling one edge", () => {
    const copies = wrappedCopies(10, H / 2, 70, W, H);
    expect(copies).toHaveLength(2);
    expect(copies).toContainEqual({ x: 10 + W, y: H / 2 });
  });

  it("covers all four corners when straddling two edges at once", () => {
    const copies = wrappedCopies(5, 5, 70, W, H);
    expect(copies).toHaveLength(4);
    expect(copies).toContainEqual({ x: 5, y: 5 });
    expect(copies).toContainEqual({ x: 5 + W, y: 5 });
    expect(copies).toContainEqual({ x: 5, y: 5 + H });
    expect(copies).toContainEqual({ x: 5 + W, y: 5 + H });
  });
});

describe("fartImpulse", () => {
  it("gives the smallest shove for a tap", () => {
    expect(fartImpulse(0, 1.15, 200, 880)).toBe(200);
  });

  it("gives the biggest shove for a full squeeze", () => {
    expect(fartImpulse(1.15, 1.15, 200, 880)).toBe(880);
  });

  it("holding longer always goes farther", () => {
    const held = [0, 0.2, 0.5, 0.8, 1.15];
    const pushes = held.map((h) => fartImpulse(h, 1.15, 200, 880));
    for (let i = 1; i < pushes.length; i += 1) expect(pushes[i]!).toBeGreaterThan(pushes[i - 1]!);
  });

  it("cannot be overcharged past the maximum", () => {
    expect(fartImpulse(99, 1.15, 200, 880)).toBe(880);
  });
});
