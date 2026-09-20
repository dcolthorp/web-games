import { describe, expect, it } from "vitest";
import { MATERIALS, MAX_MATERIALS, isCrystal, registerFoundCrystal } from "./caves";
import { BUILT_IN_CODES, CRYSTALS, FOUND_CODES, inventCrystal } from "./crystals";
import { seededRandom } from "./world";

describe("the crystal list", () => {
  it("has a great many crystals in it", () => {
    expect(CRYSTALS.length).toBeGreaterThan(100);
  });

  it("gives every crystal a name of its own", () => {
    const names = MATERIALS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every material its own save code, and never a digit", () => {
    const codes = MATERIALS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toHaveLength(1);
      expect(code).not.toMatch(/\d/);
    }
  });

  it("paints every crystal with real colours", () => {
    for (const material of MATERIALS) {
      expect(material.colors.length).toBeGreaterThan(0);
      for (const color of material.colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keeps the old tools where they have always been", () => {
    expect(MATERIALS[0]?.name).toBe("Dig");
    expect(MATERIALS[1]?.name).toBe("Rock");
    expect(isCrystal(0)).toBe(false);
    expect(isCrystal(1)).toBe(false);
    expect(isCrystal(MATERIALS.findIndex((m) => m.name === "Gold"))).toBe(true);
    expect(isCrystal(MATERIALS.length - 1)).toBe(true);
  });

  it("leaves no crystal without a code to be saved by", () => {
    const names = new Set(MATERIALS.map((m) => m.name));
    for (const crystal of CRYSTALS) expect(names.has(crystal.name)).toBe(true);
  });

  it("has enough codes for a cave full of crystals", () => {
    expect(BUILT_IN_CODES.length).toBeGreaterThan(CRYSTALS.length);
    expect(FOUND_CODES.length).toBeGreaterThan(40);
    // Found crystals take their codes from the other end, so the two pools
    // can never hand out the same letter.
    expect(BUILT_IN_CODES.filter((code) => FOUND_CODES.includes(code))).toEqual([]);
  });
});

describe("inventCrystal", () => {
  it("makes up a crystal with a name and colours", () => {
    const crystal = inventCrystal(seededRandom(12));
    expect(crystal.name).toMatch(/^[A-Za-z]+$/);
    expect(crystal.colors.length).toBeGreaterThanOrEqual(2);
  });

  it("makes the same one again from the same luck", () => {
    expect(inventCrystal(seededRandom(9))).toEqual(inventCrystal(seededRandom(9)));
  });

  it("keeps finding different ones", () => {
    const names = new Set(Array.from({ length: 40 }, (_, i) => inventCrystal(seededRandom(i)).name));
    expect(names.size).toBeGreaterThan(20);
  });
});

describe("registerFoundCrystal", () => {
  it("adds a crystal nobody has seen and gives it a code", () => {
    const before = MATERIALS.length;
    const index = registerFoundCrystal({ name: "Testite", colors: ["#ff00ff"] });
    expect(index).toBe(before);
    expect(MATERIALS[index]?.code).toBeTruthy();
    expect(MATERIALS.length).toBeLessThanOrEqual(MAX_MATERIALS);
  });

  it("gives back the one already there when a saved code comes home", () => {
    const index = registerFoundCrystal({ name: "Comeback", colors: ["#00ff00"] });
    const code = MATERIALS[index]?.code ?? "";
    expect(registerFoundCrystal({ name: "Comeback", colors: ["#00ff00"] }, code)).toBe(index);
  });
});
