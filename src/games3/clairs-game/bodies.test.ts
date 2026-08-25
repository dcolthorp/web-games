import { describe, expect, it } from "vitest";
import { FRONT_YARD, gravityLabel, bodyById, BODIES } from "./bodies";

describe("bodies", () => {
  it("has one entry per body, with no repeats", () => {
    const ids = BODIES.map((body) => body.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("scales gravity off the front yard, so 1.00g really is home", () => {
    expect(gravityLabel(FRONT_YARD)).toBe("1.00g");
    expect(gravityLabel(bodyById("earth")!)).toBe("1.00g");
  });

  /** The numbers on the sky map are shown to a child. They should be true. */
  it("matches real surface gravity to two decimals", () => {
    const real: Record<string, string> = {
      sun: "27.90g",
      mercury: "0.38g",
      venus: "0.90g",
      earth: "1.00g",
      moon: "0.17g",
      mars: "0.38g",
      jupiter: "2.53g",
      saturn: "1.07g",
      uranus: "0.88g",
      neptune: "1.14g",
      pluto: "0.06g",
    };
    for (const [id, label] of Object.entries(real)) {
      expect(gravityLabel(bodyById(id)!)).toBe(label);
    }
  });

  it("makes the Sun the one place you cannot get off the floor", () => {
    const sun = bodyById("sun")!;
    expect(sun.gravity).toBeGreaterThan(bodyById("jupiter")!.gravity);
    // Air this thick means a full squeeze barely shifts you.
    expect(sun.air).toBeLessThan(0.01);
  });

  it("keeps the Moon floatier than Earth and Jupiter heavier", () => {
    expect(bodyById("moon")!.gravity).toBeLessThan(FRONT_YARD.gravity);
    expect(bodyById("jupiter")!.gravity).toBeGreaterThan(FRONT_YARD.gravity);
    expect(bodyById("pluto")!.gravity).toBeLessThan(bodyById("moon")!.gravity);
  });

  it("gives airless worlds thinner air than the gas giants", () => {
    expect(bodyById("moon")!.air).toBeGreaterThan(bodyById("jupiter")!.air);
    expect(bodyById("pluto")!.air).toBeGreaterThan(FRONT_YARD.air);
  });

  it("says what each thing actually is — only one of them is a star", () => {
    expect(bodyById("sun")!.kind).toBe("star");
    expect(bodyById("earth")!.kind).toBe("planet");
    expect(bodyById("moon")!.kind).toBe("moon");
    expect(bodyById("pluto")!.kind).toBe("dwarf planet");
    const stars = BODIES.filter((body) => body.kind === "star");
    expect(stars).toHaveLength(1);
  });

  it("gives every body something to draw and something to read", () => {
    for (const body of [FRONT_YARD, ...BODIES]) {
      expect(body.glyph.length).toBeGreaterThan(0);
      expect(body.fact.length).toBeGreaterThan(10);
      expect(body.hazeCount).toBeGreaterThan(0);
    }
  });

  it("returns nothing for a body that is not on the map", () => {
    expect(bodyById("krypton")).toBeUndefined();
  });
});
