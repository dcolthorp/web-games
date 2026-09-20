import { describe, expect, it } from "vitest";
import {
  DAMAGE,
  SHOT_SPEED,
  TECH,
  TECH_IDS,
  blastDestroys,
  buildCost,
  canUsePad,
  caughtInBlast,
  flyShot,
  isSpawner,
  isTech,
  type Shot,
} from "./techRules";

describe("the tech list", () => {
  it("knows what is tech and what is not", () => {
    expect(isTech("laser-cannon")).toBe(true);
    expect(isTech("oak")).toBe(false);
    expect(TECH_IDS).toHaveLength(7);
  });

  it("makes bigger weapons slower and further reaching", () => {
    expect(TECH["missile-silo"].reload).toBeGreaterThan(TECH["laser-cannon"].reload);
    expect(TECH["nuke-silo"].reload).toBeGreaterThan(TECH["missile-silo"].reload);
    expect(TECH["nuke-silo"].range).toBeGreaterThan(TECH["missile-silo"].range);
    expect(TECH["nuke-silo"].blast).toBeGreaterThan(TECH["missile-silo"].blast);
  });
});

describe("flyShot", () => {
  const shot = (over: Partial<Shot> = {}): Shot => ({ kind: "missile", x: 0, y: 0, tx: 30, ty: 40, ...over });

  it("moves towards where it is going", () => {
    const s = shot();
    expect(flyShot(s)).toBe(false);
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(SHOT_SPEED.missile);
  });

  it("arrives exactly on the spot", () => {
    const s = shot({ x: 30, y: 39 });
    expect(flyShot(s)).toBe(true);
    expect([s.x, s.y]).toEqual([30, 40]);
  });

  it("flies a nuke slower than a missile", () => {
    expect(SHOT_SPEED.nuke).toBeLessThan(SHOT_SPEED.missile);
  });
});

describe("the blast", () => {
  it("catches whatever is close enough", () => {
    expect(caughtInBlast(9, 50, 50, 55, 50)).toBe(true);
    expect(caughtInBlast(9, 50, 50, 62, 50)).toBe(false);
  });

  it("leaves the mountains standing unless it was a nuke", () => {
    expect(blastDestroys(TECH["missile-silo"].blast, true)).toBe(false);
    expect(blastDestroys(TECH["missile-silo"].blast, false)).toBe(true);
    expect(blastDestroys(TECH["nuke-silo"].blast, true)).toBe(true);
  });
});

describe("the spawning machines", () => {
  it("knows which machines make people", () => {
    expect(isSpawner("spawner")).toBe(true);
    expect(isSpawner("mutant-spawner")).toBe(true);
    expect(isSpawner("laser-cannon")).toBe(false);
  });

  it("costs a builder three people, and ten for the mutant one", () => {
    expect(buildCost("spawner")).toBe(3);
    expect(buildCost("mutant-spawner")).toBe(10);
  });

  it("costs nothing to build the things that only shoot", () => {
    expect(buildCost("laser-cannon")).toBe(0);
    expect(buildCost("truck")).toBe(0);
  });

  it("makes mutants slower to come out than people", () => {
    expect(TECH["mutant-spawner"].reload).toBeGreaterThan(TECH.spawner.reload);
  });
});

describe("canUsePad", () => {
  it("lets a tribe use its own pad", () => {
    expect(canUsePad("gods", "gods")).toBe(true);
  });

  it("keeps everybody else off it", () => {
    expect(canUsePad("gods", "poopies")).toBe(false);
    expect(canUsePad("gods", undefined)).toBe(false);
  });

  it("lets absolutely anybody on a pad that belongs to nobody", () => {
    expect(canUsePad(undefined, "poopies")).toBe(true);
    expect(canUsePad(undefined, undefined)).toBe(true);
  });
});

describe("what a hit takes off you", () => {
  it("hurts more the bigger the weapon is", () => {
    expect(DAMAGE.nuke).toBeGreaterThan(DAMAGE.missile);
    expect(DAMAGE.missile).toBeGreaterThan(DAMAGE.ram);
  });

  it("leaves a mutant standing after one of anything", () => {
    const mutantHealth = 30;
    for (const hit of Object.values(DAMAGE)) expect(hit).toBeLessThan(mutantHealth);
  });

  it("takes an ordinary person out with any of it", () => {
    for (const hit of Object.values(DAMAGE)) expect(hit).toBeGreaterThan(5);
  });
});
