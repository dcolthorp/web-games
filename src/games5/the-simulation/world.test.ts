import { describe, expect, it } from "vitest";
import {
  ARENA_SIZE,
  FRAGMENT_COUNT,
  LADDER,
  WALL_HEIGHT,
  blockAt,
  isSolid,
  makeArena,
} from "./world";

describe("the arena", () => {
  const arena = makeArena();

  it("boxes you in on every side", () => {
    for (let y = 1; y <= WALL_HEIGHT; y += 1) {
      expect(isSolid(blockAt(arena.world, 0, y, 10))).toBe(true);
      expect(isSolid(blockAt(arena.world, ARENA_SIZE - 1, y, 10))).toBe(true);
      expect(isSolid(blockAt(arena.world, 10, y, 0))).toBe(true);
      expect(isSolid(blockAt(arena.world, 10, y, ARENA_SIZE - 1))).toBe(true);
    }
    // Even past the edge of the world there's no way out.
    expect(isSolid(blockAt(arena.world, -5, 3, 10))).toBe(true);
    expect(isSolid(blockAt(arena.world, 10, -1, 10))).toBe(true);
  });

  it("has a hundred fragments, each floating in the open above something solid", () => {
    expect(arena.fragments).toHaveLength(FRAGMENT_COUNT);
    for (const fragment of arena.fragments) {
      const x = Math.floor(fragment.x);
      const y = Math.floor(fragment.y);
      const z = Math.floor(fragment.z);
      expect(isSolid(blockAt(arena.world, x, y, z))).toBe(false);
      expect(isSolid(blockAt(arena.world, x, y - 1, z))).toBe(true);
    }
  });

  it("has ladders to climb", () => {
    let ladders = 0;
    for (let x = 0; x < ARENA_SIZE; x += 1) {
      for (let z = 0; z < ARENA_SIZE; z += 1) {
        for (let y = 0; y < 8; y += 1) if (blockAt(arena.world, x, y, z) === LADDER) ladders += 1;
      }
    }
    expect(ladders).toBeGreaterThan(10);
  });

  it("drops you in standing on solid ground", () => {
    expect(isSolid(blockAt(arena.world, Math.floor(arena.spawn.x), arena.spawn.y - 1, Math.floor(arena.spawn.z)))).toBe(true);
    expect(isSolid(blockAt(arena.world, Math.floor(arena.spawn.x), arena.spawn.y, Math.floor(arena.spawn.z)))).toBe(false);
  });

  it("builds the same world every time", () => {
    expect([...makeArena(3).world.blocks]).toEqual([...makeArena(3).world.blocks]);
    expect([...makeArena(3).world.blocks]).not.toEqual([...makeArena(4).world.blocks]);
  });
});
