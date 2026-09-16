import { describe, expect, it } from "vitest";
import {
  BLINK_EVERY_MS,
  GLITCH_KINDS,
  MIMIC_REVEAL_RANGE,
  flatDistance,
  hasCaught,
  newGlitch,
  updateGlitch,
  type Glitch,
  type GlitchKind,
} from "./glitches";
import { newPlayer, type Player } from "./player";
import { LADDER, PLAIN, makeWorld, setBlock, type World } from "./world";

function floorWorld(): World {
  const world = makeWorld(12, 10, 12);
  for (let x = 0; x < 12; x += 1) for (let z = 0; z < 12; z += 1) setBlock(world, x, 0, z, PLAIN);
  return world;
}

// Runs the chase, saying each frame whether you can see it.
function chase(world: World, glitch: Glitch, player: Player, seconds: number, seen = false): void {
  for (let step = 0; step < seconds * 60; step += 1) {
    updateGlitch(world, glitch, player, 1 / 60, (step * 1000) / 60, seen);
  }
}

describe("a stalker", () => {
  it("comes straight at you", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 9.5, y: 1, z: 6.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 6.5 }, "stalker");
    chase(world, glitch, player, 1);
    expect(glitch.x).toBeGreaterThan(4);
  });

  it("catches you when it reaches you, but not while you're up high", () => {
    const player = newPlayer({ x: 5.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 5.9, y: 1, z: 5.5 }, "stalker");
    expect(hasCaught(glitch, player)).toBe(true);
    player.y = 4;
    expect(hasCaught(glitch, player)).toBe(false);
  });

  it("climbs stairs after you", () => {
    const world = floorWorld();
    for (let y = 1; y <= 1; y += 1) setBlock(world, 6, y, 5, PLAIN);
    for (let y = 1; y <= 2; y += 1) setBlock(world, 7, y, 5, PLAIN);
    for (let y = 1; y <= 3; y += 1) setBlock(world, 8, y, 5, PLAIN);
    const player = newPlayer({ x: 8.5, y: 4, z: 5.5 });
    const glitch = newGlitch({ x: 4.5, y: 1, z: 5.5 }, "stalker");
    chase(world, glitch, player, 4);
    expect(glitch.y).toBeGreaterThan(2);
  });
});

describe("a stopframe", () => {
  it("can't move at all while you're looking at it", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 9.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 }, "stopframe");
    chase(world, glitch, player, 3, true);
    expect(glitch.x).toBeCloseTo(2.5, 2);
    expect(glitch.frozen).toBe(true);
  });

  it("runs at you the moment you look away, faster than you can walk", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 9.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 }, "stopframe");
    chase(world, glitch, player, 1, false);
    expect(glitch.x).toBeGreaterThan(7);
    expect(glitch.frozen).toBe(false);
  });
});

describe("a mimic", () => {
  it("sits still pretending to be a fragment, and can't hurt you", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 10.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 }, "mimic");
    chase(world, glitch, player, 2);
    expect(glitch.hiding).toBe(true);
    expect(glitch.x).toBeCloseTo(2.5, 2);
    const touching = newGlitch({ x: 10.7, y: 1, z: 5.5 }, "mimic");
    expect(hasCaught(touching, player)).toBe(false);
  });

  it("stops pretending and chases once you come close", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 2.5 + MIMIC_REVEAL_RANGE - 0.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 }, "mimic");
    chase(world, glitch, player, 1);
    expect(glitch.hiding).toBe(false);
    expect(flatDistance(glitch, player)).toBeLessThan(MIMIC_REVEAL_RANGE - 0.5);
  });
});

describe("a flicker", () => {
  it("blinks its way closer instead of walking", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 10.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 1.5, y: 1, z: 5.5 }, "flicker");
    const startedAway = flatDistance(glitch, player);
    // Long enough for a couple of blinks.
    chase(world, glitch, player, (BLINK_EVERY_MS / 1000) * 2.5);
    const closedBy = startedAway - flatDistance(glitch, player);
    // Walking alone would only close about a third of this.
    expect(closedBy).toBeGreaterThan(6);
  });
});

describe("every kind of glitch", () => {
  it.each(GLITCH_KINDS)("cannot climb a ladder, so up a ladder you're safe from a %s", (kind: GlitchKind) => {
    const world = floorWorld();
    for (let y = 1; y <= 6; y += 1) setBlock(world, 6, y, 5, LADDER);
    const player = newPlayer({ x: 6.5, y: 5, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 }, kind);
    chase(world, glitch, player, 6);
    expect(glitch.y).toBeCloseTo(1, 1);
    expect(hasCaught(glitch, player)).toBe(false);
  });
});
