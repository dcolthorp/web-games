import { describe, expect, it } from "vitest";
import { MATERIALS, ROCK, TUNNEL } from "./caves";
import { CAVE_MOUTH, crystalBeside, insideOf, isInside, nearestTunnel, stepInTunnel, tunnelAt } from "./miners";
import { H, W, seededRandom, type Thing } from "./world";

const solidRock = (): Uint8Array => new Uint8Array(W * H).fill(ROCK);

function digRow(grid: Uint8Array, row: number): void {
  for (let x = 0; x < W; x += 1) grid[row * W + x] = TUNNEL;
}

const GOLD = MATERIALS.findIndex((m) => m.name === "Gold");

describe("who is in the cave", () => {
  const mountain: Thing = { type: "mountain", x: 40, y: 50 };
  const digger: Thing = { type: "person", x: 0, y: 0, inside: [40, 50] };
  const elsewhere: Thing = { type: "person", x: 0, y: 0, inside: [99, 99] };
  const outside: Thing = { type: "person", x: 10, y: 10 };

  it("knows who went in", () => {
    expect(isInside(digger)).toBe(true);
    expect(isInside(outside)).toBe(false);
  });

  it("only counts the ones in this mountain", () => {
    expect(insideOf(mountain, [digger, elsewhere, outside])).toEqual([digger]);
  });
});

describe("walking about in the tunnels", () => {
  it("stays in the tunnel", () => {
    const grid = solidRock();
    digRow(grid, 100);
    const roll = seededRandom(3);
    let spot = { x: 10, y: 100, heading: 0 };
    for (let step = 0; step < 200; step += 1) {
      spot = stepInTunnel(grid, spot.x, spot.y, spot.heading, roll);
      expect(tunnelAt(grid, spot.x, spot.y)).toBe(true);
    }
  });

  it("actually gets somewhere", () => {
    const grid = solidRock();
    digRow(grid, 100);
    const roll = seededRandom(5);
    let spot = { x: 10, y: 100, heading: 0 };
    for (let step = 0; step < 60; step += 1) spot = stepInTunnel(grid, spot.x, spot.y, spot.heading, roll);
    expect(Math.abs(spot.x - 10)).toBeGreaterThan(3);
  });

  it("turns round instead of walking into a wall", () => {
    const grid = solidRock();
    const spot = stepInTunnel(grid, 50, 50, 0, seededRandom(1));
    expect(spot.x).toBe(50);
    expect(spot.y).toBe(50);
  });

  it("starts them at the mouth of the tunnel", () => {
    expect(CAVE_MOUTH.y).toBeLessThan(H);
    expect(CAVE_MOUTH.x).toBeGreaterThan(0);
  });
});

describe("crystalBeside", () => {
  it("finds a crystal in the wall next to them", () => {
    const grid = solidRock();
    grid[100 * W + 51] = GOLD;
    expect(crystalBeside(grid, 50, 100)).toBe("Gold");
  });

  it("finds nothing in plain rock", () => {
    expect(crystalBeside(solidRock(), 50, 100)).toBeNull();
  });

  it("doesn't count the tunnel or the rock as a crystal", () => {
    const grid = solidRock();
    grid[100 * W + 51] = TUNNEL;
    expect(crystalBeside(grid, 50, 100)).toBeNull();
  });
});

describe("nearestTunnel", () => {
  it("leaves somebody who is already in a tunnel where they are", () => {
    const grid = solidRock();
    digRow(grid, 100);
    expect(nearestTunnel(grid, 40, 100)).toEqual({ x: 40, y: 100 });
  });

  it("digs somebody walled in back out to the nearest tunnel", () => {
    const grid = solidRock();
    digRow(grid, 100);
    const spot = nearestTunnel(grid, 40, 106);
    expect(spot).not.toBeNull();
    expect(tunnelAt(grid, spot?.x ?? 0, spot?.y ?? 0)).toBe(true);
    expect(Math.abs((spot?.y ?? 0) - 100)).toBeLessThanOrEqual(1);
  });

  it("gives up on a cave with no tunnel in it at all", () => {
    expect(nearestTunnel(solidRock(), 40, 100)).toBeNull();
  });
});
