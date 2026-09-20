import { describe, expect, it } from "vitest";
import { MATERIALS, ROCK, TUNNEL } from "./caves";
import { BOMBS, blowUp, bombKind, crystalsAround, inBlast, isBomb } from "./cavern";
import { H, W } from "./world";

const GOLD = MATERIALS.findIndex((m) => m.name === "Gold");
const LAVA = MATERIALS.findIndex((m) => m.name === "Lava");
const solidRock = (): Uint8Array => new Uint8Array(W * H).fill(ROCK);

describe("the bombs", () => {
  it("has a big one and a bigger one", () => {
    expect(isBomb("bomb")).toBe(true);
    expect(isBomb("oak")).toBe(false);
    const [small, big] = BOMBS;
    expect(big?.radius).toBeGreaterThan(small?.radius ?? 0);
    expect(big?.fuse).toBeGreaterThan(small?.fuse ?? 0);
  });

  it("knows one by name", () => {
    expect(bombKind("big-bomb")?.name).toBe("Big Bomb");
    expect(bombKind("nope")).toBeUndefined();
  });
});

describe("blowUp", () => {
  it("digs a round hole in the rock", () => {
    const grid = solidRock();
    const dug = blowUp(grid, 100, 100, 10);
    expect(dug).toBeGreaterThan(250);
    expect(grid[100 * W + 100]).toBe(TUNNEL);
    expect(grid[100 * W + 130]).toBe(ROCK);
  });

  it("leaves the crystals hanging there, which is the whole point", () => {
    const grid = solidRock();
    grid[100 * W + 102] = GOLD;
    blowUp(grid, 100, 100, 10);
    expect(grid[100 * W + 102]).toBe(GOLD);
  });

  it("doesn't touch lava or water", () => {
    const grid = solidRock();
    grid[100 * W + 103] = LAVA;
    blowUp(grid, 100, 100, 10);
    expect(grid[100 * W + 103]).toBe(LAVA);
  });

  it("stays inside the cave at the edges", () => {
    const grid = solidRock();
    expect(() => blowUp(grid, 2, 2, 20)).not.toThrow();
    expect(grid.length).toBe(W * H);
  });
});

describe("crystalsAround", () => {
  it("says what the blast uncovered", () => {
    const grid = solidRock();
    grid[100 * W + 104] = GOLD;
    expect(crystalsAround(grid, 100, 100, 10)).toEqual(["Gold"]);
  });

  it("says nothing about plain rock", () => {
    expect(crystalsAround(solidRock(), 100, 100, 10)).toEqual([]);
  });

  it("doesn't count lava as treasure", () => {
    const grid = solidRock();
    grid[100 * W + 104] = LAVA;
    expect(crystalsAround(grid, 100, 100, 10)).toEqual([]);
  });
});

describe("inBlast", () => {
  it("catches whoever was standing too close", () => {
    expect(inBlast(10, 50, 50, 55, 52)).toBe(true);
    expect(inBlast(10, 50, 50, 70, 50)).toBe(false);
  });
});
