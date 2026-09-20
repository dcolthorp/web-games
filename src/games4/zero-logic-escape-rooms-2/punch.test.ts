import { describe, expect, it } from "vitest";
import {
  GARBLE,
  PUNCHES_PER_CRACK,
  VIRUS_PUNCHES,
  crackAt,
  extraCrack,
  makeCracks,
  punchCrack,
  virusReach,
  worldIsGone,
} from "./punch";

describe("punchCrack", () => {
  it("makes a crack smaller", () => {
    const cracks = makeCracks();
    const id = cracks[0]?.id ?? 1;
    const after = punchCrack(cracks, id);
    expect(after[0]?.size).toBeCloseTo(1 - 1 / PUNCHES_PER_CRACK);
    expect(after).toHaveLength(cracks.length);
  });

  it("takes it off the wall after enough punches", () => {
    let cracks = makeCracks();
    const id = cracks[0]?.id ?? 1;
    for (let punch = 0; punch < PUNCHES_PER_CRACK; punch += 1) cracks = punchCrack(cracks, id);
    expect(cracks.some((crack) => crack.id === id)).toBe(false);
  });

  it("leaves the other cracks alone", () => {
    const cracks = punchCrack(makeCracks(), 1);
    expect(cracks[1]?.size).toBe(1);
  });
});

describe("crackAt", () => {
  it("finds the crack you swung at", () => {
    const cracks = makeCracks();
    const target = cracks[0];
    if (!target) throw new Error("no cracks");
    const midX = target.x + (Math.cos(target.angle) * target.length) / 2;
    const midY = target.y + (Math.sin(target.angle) * target.length) / 2;
    expect(crackAt(cracks, midX, midY)?.id).toBe(target.id);
  });

  it("finds nothing where the wall is fine", () => {
    expect(crackAt(makeCracks(), 10, 580)).toBeNull();
  });
});

describe("the thing in the corner", () => {
  it("takes over more of the room with every punch", () => {
    expect(virusReach(0)).toBe(0);
    expect(virusReach(3)).toBeGreaterThan(virusReach(2));
    expect(virusReach(VIRUS_PUNCHES)).toBe(1);
  });

  it("never spreads past everything", () => {
    expect(virusReach(VIRUS_PUNCHES + 10)).toBe(1);
  });

  it("ends the world on the last punch", () => {
    expect(worldIsGone(VIRUS_PUNCHES - 1)).toBe(false);
    expect(worldIsGone(VIRUS_PUNCHES)).toBe(true);
  });

  it("has a fresh crack to hand out for every punch it takes", () => {
    for (let stage = 0; stage < VIRUS_PUNCHES; stage += 1) {
      expect(extraCrack(stage, 99)).not.toBeNull();
    }
  });

  it("screams", () => {
    expect(GARBLE).toContain("!!!!");
  });
});
