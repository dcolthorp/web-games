import { describe, expect, it } from "vitest";
import { BREAK_POINT, fartsInWindow, formatVelocity, prune, velocityFor } from "./velocity";

describe("velocityFor", () => {
  it("follows the rule: one fart is 1, two is 2, three is 4, doubling on", () => {
    expect(velocityFor(1)).toBe(1);
    expect(velocityFor(2)).toBe(2);
    expect(velocityFor(3)).toBe(4);
    expect(velocityFor(4)).toBe(8);
    expect(velocityFor(5)).toBe(16);
  });

  it("is standing still with no farts", () => {
    expect(velocityFor(0)).toBe(0);
    expect(velocityFor(-3)).toBe(0);
  });

  it("doubles every single step, all the way up", () => {
    for (let farts = 2; farts <= 40; farts += 1) {
      expect(velocityFor(farts)).toBe(velocityFor(farts - 1) * 2);
    }
  });

  /** The values are powers of two, so nothing lands on exactly 100. */
  it("clears the break point on the eighth fart, not the seventh", () => {
    expect(velocityFor(7)).toBe(64);
    expect(velocityFor(7)).toBeLessThan(BREAK_POINT);
    expect(velocityFor(8)).toBe(128);
    expect(velocityFor(8)).toBeGreaterThanOrEqual(BREAK_POINT);
  });
});

describe("the one second window", () => {
  it("counts only the farts from the last second", () => {
    const now = 10_000;
    const times = [8_500, 9_100, 9_600, 9_990];
    expect(fartsInWindow(times, now)).toBe(3);
  });

  it("drops to nothing once you stop farting", () => {
    expect(fartsInWindow([1_000, 1_200], 5_000)).toBe(0);
    expect(velocityFor(fartsInWindow([1_000, 1_200], 5_000))).toBe(0);
  });

  it("throws away stale farts rather than keeping them forever", () => {
    expect(prune([0, 500, 9_800, 9_900], 10_000)).toEqual([9_800, 9_900]);
  });

  it("counts a fart let go this very instant", () => {
    expect(fartsInWindow([10_000], 10_000)).toBe(1);
  });
});

describe("formatVelocity", () => {
  it("reads normally while the number is still readable", () => {
    expect(formatVelocity(0)).toBe("0");
    expect(formatVelocity(128)).toBe("128");
    expect(formatVelocity(65_536)).toBe("65,536");
  });

  it("stops the button bursting once you get silly", () => {
    expect(formatVelocity(2 ** 30)).toBe("1.07 × 10^9");
  });
});
