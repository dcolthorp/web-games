import { describe, expect, it } from "vitest";
import { newPlayer, updatePlayer, type Input } from "./player";
import { LADDER, PLAIN, makeWorld, setBlock, type World } from "./world";

const STILL: Input = { forward: 0, strafe: 0, up: false, down: false, dash: false };

// A little world with a floor, to try things out in.
function floorWorld(): World {
  const world = makeWorld(8, 8, 8);
  for (let x = 0; x < 8; x += 1) for (let z = 0; z < 8; z += 1) setBlock(world, x, 0, z, PLAIN);
  return world;
}

function run(world: World, player: ReturnType<typeof newPlayer>, input: Input, seconds: number): void {
  for (let step = 0; step < seconds * 60; step += 1) updatePlayer(world, player, input, 1 / 60);
}

describe("walking around", () => {
  it("falls and lands on the floor", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 4.5, y: 6, z: 4.5 });
    run(world, player, STILL, 2);
    expect(player.y).toBeCloseTo(1, 1);
    expect(player.onGround).toBe(true);
  });

  it("jumps up and comes back down", () => {
    const world = floorWorld();
    const player = newPlayer({ x: 4.5, y: 1, z: 4.5 });
    run(world, player, { ...STILL, up: true }, 0.25);
    expect(player.y).toBeGreaterThan(1.3);
    run(world, player, STILL, 2);
    expect(player.y).toBeCloseTo(1, 1);
  });

  it("can't walk through a wall", () => {
    const world = floorWorld();
    for (let y = 1; y <= 4; y += 1) setBlock(world, 5, y, 4, PLAIN);
    const player = newPlayer({ x: 4.5, y: 1, z: 4.5 });
    player.yaw = Math.PI / 2; // facing the wall
    run(world, player, { ...STILL, forward: 1 }, 1);
    expect(player.x).toBeLessThan(4.75);
  });

  it("walks up a step, because stairs are only one block at a time", () => {
    const world = floorWorld();
    // A ledge one block high to walk up onto and along.
    for (let x = 5; x < 8; x += 1) setBlock(world, x, 1, 4, PLAIN);
    const player = newPlayer({ x: 4.5, y: 1, z: 4.5 });
    player.yaw = Math.PI / 2;
    run(world, player, { ...STILL, forward: 1 }, 1);
    expect(player.y).toBeCloseTo(2, 1);
    expect(player.x).toBeGreaterThan(5);
  });

  it("dashes further than you can walk, and then needs a moment", () => {
    const world = floorWorld();
    const walking = newPlayer({ x: 1.5, y: 1, z: 4.5 });
    const dashing = newPlayer({ x: 1.5, y: 1, z: 4.5 });
    walking.yaw = Math.PI / 2;
    dashing.yaw = Math.PI / 2;
    run(world, walking, { ...STILL, forward: 1 }, 0.25);
    run(world, dashing, { ...STILL, forward: 1, dash: true }, 0.25);
    expect(dashing.x - 1.5).toBeGreaterThan((walking.x - 1.5) * 2);

    // Dashing again straight away does nothing.
    const afterFirstDash = dashing.x;
    run(world, dashing, { ...STILL, forward: 1, dash: true }, 0.25);
    const secondTry = dashing.x - afterFirstDash;
    expect(secondTry).toBeLessThan((walking.x - 1.5) * 1.5);
  });

  it("climbs a ladder, and hangs there when you stop", () => {
    const world = floorWorld();
    for (let y = 1; y <= 5; y += 1) setBlock(world, 4, y, 4, LADDER);
    const player = newPlayer({ x: 4.5, y: 1, z: 4.5 });
    run(world, player, { ...STILL, up: true }, 1);
    expect(player.climbing).toBe(true);
    expect(player.y).toBeGreaterThan(3);
    const restingAt = player.y;
    run(world, player, STILL, 0.5);
    expect(player.y).toBeCloseTo(restingAt, 1);
  });
});
