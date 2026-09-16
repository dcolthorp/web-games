import { describe, expect, it } from "vitest";
import { hasCaught, newGlitch, updateGlitch } from "./glitches";
import { newPlayer } from "./player";
import { LADDER, PLAIN, makeWorld, setBlock, type World } from "./world";

function floorWorld(): World {
  const world = makeWorld(12, 10, 12);
  for (let x = 0; x < 12; x += 1) for (let z = 0; z < 12; z += 1) setBlock(world, x, 0, z, PLAIN);
  return world;
}

function chase(world: World, glitch: ReturnType<typeof newGlitch>, player: ReturnType<typeof newPlayer>, seconds: number): void {
  for (let step = 0; step < seconds * 60; step += 1) updateGlitch(world, glitch, player, 1 / 60);
}

describe("the glitches", () => {
  it("comes straight at you", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 9.5, y: 1, z: 6.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 6.5 });
    chase(world, glitch, player, 1);
    expect(glitch.x).toBeGreaterThan(4);
  });

  it("catches you when it reaches you, but not while you're up high", () => {
    const player = newPlayer({ x: 5.5, y: 1, z: 5.5 });
    const glitch = newGlitch({ x: 5.9, y: 1, z: 5.5 });
    expect(hasCaught(glitch, player)).toBe(true);
    player.y = 4;
    expect(hasCaught(glitch, player)).toBe(false);
  });

  it("climbs stairs after you", () => {
    const world = floorWorld();
    // Steps going up: one block, then two, then three.
    for (let y = 1; y <= 1; y += 1) setBlock(world, 6, y, 5, PLAIN);
    for (let y = 1; y <= 2; y += 1) setBlock(world, 7, y, 5, PLAIN);
    for (let y = 1; y <= 3; y += 1) setBlock(world, 8, y, 5, PLAIN);
    const player = newPlayer({ x: 8.5, y: 4, z: 5.5 });
    const glitch = newGlitch({ x: 4.5, y: 1, z: 5.5 });
    chase(world, glitch, player, 4);
    expect(glitch.y).toBeGreaterThan(2);
  });

  it("cannot climb a ladder, so up a ladder you're safe", () => {
    const world = floorWorld();
    for (let y = 1; y <= 6; y += 1) setBlock(world, 6, y, 5, LADDER);
    const player = newPlayer({ x: 6.5, y: 5, z: 5.5 });
    const glitch = newGlitch({ x: 2.5, y: 1, z: 5.5 });
    chase(world, glitch, player, 5);
    expect(glitch.y).toBeCloseTo(1, 1);
    expect(hasCaught(glitch, player)).toBe(false);
  });
});
