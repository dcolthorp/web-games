import { describe, expect, it } from "vitest";
import { tribeNameFor } from "./tribeNames";

describe("tribeNameFor", () => {
  it("names the place after whoever founded it", () => {
    for (let roll = 0; roll < 1; roll += 0.05) {
      expect(tribeNameFor("Kira", roll)).toContain("Kira");
    }
  });

  it("sometimes just calls it New Somebody", () => {
    expect(tribeNameFor("Kira", 0.1)).toBe("New Kira");
    expect(tribeNameFor("Kira", 0.3)).toBe("Free Kira");
  });

  it("otherwise sticks an ending on the end", () => {
    expect(tribeNameFor("Kira", 0.9)).toMatch(/^Kira[a-z]+$/);
  });

  it("comes up with plenty of different names", () => {
    const names = new Set(Array.from({ length: 20 }, (_, i) => tribeNameFor("Kira", i / 20)));
    expect(names.size).toBeGreaterThan(5);
  });
});
