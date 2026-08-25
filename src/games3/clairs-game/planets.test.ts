import { describe, expect, it } from "vitest";
import { FRONT_YARD, gravityLabel, planetById, PLANETS } from "./planets";

describe("planets", () => {
  it("has one entry per body, with no repeats", () => {
    const ids = PLANETS.map((planet) => planet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("scales gravity off the front yard, so 1.00g really is home", () => {
    expect(gravityLabel(FRONT_YARD)).toBe("1.00g");
    expect(gravityLabel(planetById("earth")!)).toBe("1.00g");
  });

  /** The numbers on the star map are shown to a child. They should be true. */
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
      expect(gravityLabel(planetById(id)!)).toBe(label);
    }
  });

  it("makes the Sun the one place you cannot get off the floor", () => {
    const sun = planetById("sun")!;
    expect(sun.gravity).toBeGreaterThan(planetById("jupiter")!.gravity);
    // Air this thick means a full squeeze barely shifts you.
    expect(sun.air).toBeLessThan(0.01);
  });

  it("keeps the Moon floatier than Earth and Jupiter heavier", () => {
    expect(planetById("moon")!.gravity).toBeLessThan(FRONT_YARD.gravity);
    expect(planetById("jupiter")!.gravity).toBeGreaterThan(FRONT_YARD.gravity);
    expect(planetById("pluto")!.gravity).toBeLessThan(planetById("moon")!.gravity);
  });

  it("gives airless worlds thinner air than the gas giants", () => {
    expect(planetById("moon")!.air).toBeGreaterThan(planetById("jupiter")!.air);
    expect(planetById("pluto")!.air).toBeGreaterThan(FRONT_YARD.air);
  });

  it("gives every body something to draw and something to read", () => {
    for (const planet of [FRONT_YARD, ...PLANETS]) {
      expect(planet.glyph.length).toBeGreaterThan(0);
      expect(planet.fact.length).toBeGreaterThan(10);
      expect(planet.hazeCount).toBeGreaterThan(0);
    }
  });

  it("returns nothing for a body that is not on the map", () => {
    expect(planetById("krypton")).toBeUndefined();
  });
});
