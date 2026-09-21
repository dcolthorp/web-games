import { describe, expect, it } from "vitest";
import { MATERIALS, ROCK, TUNNEL, encodeCave, makeCave } from "./caves";
import { nearestOre } from "./miners";
import { caveKey, countOre, dig, gridFor, isOre, oreLeft, releaseCave, storeCave, tunnelTowards } from "./mining";
import { W, type Thing } from "./world";

const GOLD = MATERIALS.findIndex((m) => m.name === "Gold");
const LAVA = MATERIALS.findIndex((m) => m.name === "Lava");

const mountainWith = (grid: Uint8Array, x = 10, y = 10): Thing => ({
  type: "mountain",
  x,
  y,
  cave: encodeCave(grid),
});

function seam(): Uint8Array {
  const grid = new Uint8Array(W * 200).fill(ROCK);
  for (let i = 0; i < 12; i += 1) grid[100 * W + 50 + i] = GOLD;
  return grid;
}

describe("countOre", () => {
  it("counts the ore and nothing else", () => {
    const grid = seam();
    grid[100 * W + 80] = LAVA;
    grid[100 * W + 81] = TUNNEL;
    expect(countOre(grid)).toBe(12);
  });

  it("finds the coal and iron a fresh cave comes with", () => {
    expect(countOre(makeCave(4))).toBeGreaterThan(0);
  });
});

describe("dig", () => {
  it("takes the whole seam it can reach", () => {
    const mountain = mountainWith(seam(), 1, 1);
    expect(dig(mountain, 50, 100)).toBe("Gold");
    expect(countOre(gridFor(mountain))).toBe(0);
    releaseCave(mountain);
  });

  it("says nothing when there is no ore to hand", () => {
    const mountain = mountainWith(seam(), 2, 2);
    expect(dig(mountain, 200, 20)).toBeNull();
    releaseCave(mountain);
  });

  it("only takes a pocketful at a time", () => {
    const grid = new Uint8Array(W * 200).fill(ROCK);
    for (let i = 0; i < 200; i += 1) grid[100 * W + 20 + i] = GOLD;
    const mountain = mountainWith(grid, 3, 3);
    dig(mountain, 20, 100, 10);
    expect(countOre(gridFor(mountain))).toBe(190);
    releaseCave(mountain);
  });

  it("keeps count of what is left in the cave", () => {
    const mountain = mountainWith(seam(), 4, 4);
    expect(oreLeft(mountain)).toBe(12);
    dig(mountain, 50, 100);
    expect(oreLeft(mountain)).toBe(0);
    releaseCave(mountain);
  });
});

describe("keeping the cave", () => {
  it("writes the digging back onto the mountain", () => {
    const mountain = mountainWith(seam(), 5, 5);
    const before = mountain.cave;
    dig(mountain, 50, 100);
    storeCave(mountain);
    expect(mountain.cave).not.toBe(before);
    releaseCave(mountain);
  });

  it("gives every mountain a cave of its own, and keeps it when it moves", () => {
    const one: Thing = { type: "mountain", x: 10, y: 20 };
    const other: Thing = { type: "mountain", x: 10, y: 20 };
    expect(caveKey(one)).not.toBe(caveKey(other));
    const key = caveKey(one);
    one.x = 200;
    one.y = 30;
    expect(caveKey(one)).toBe(key);
  });
});

describe("a miner working a cave", () => {
  it("tunnels through solid rock to reach a seam and takes the lot", () => {
    // Rock everywhere, with one lump of gold right across the other side.
    const grid = new Uint8Array(W * 200).fill(ROCK);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 6; x += 1) grid[(120 + y) * W + 250 + x] = GOLD;
    }
    const mountain = mountainWith(grid, 30, 30);
    const cave = gridFor(mountain);
    expect(countOre(cave)).toBe(24);

    let at = { x: 8, y: 160 };
    let carried: string | null = null;
    for (let step = 0; step < 4000 && oreLeft(mountain) > 0; step += 1) {
      const got = dig(mountain, at.x, at.y);
      if (got) {
        carried = got;
        continue;
      }
      const seam = nearestOre(cave, at.x, at.y, isOre);
      if (!seam) break;
      at = tunnelTowards(mountain, at, seam);
    }

    expect(carried).toBe("Gold");
    expect(oreLeft(mountain)).toBe(0);
    // And they left a passage behind them: rock that was solid before is now
    // a tunnel, all the way from where they started to where the gold was.
    const passage = cave.reduce((count, m) => count + (m === TUNNEL ? 1 : 0), 0);
    expect(passage).toBeGreaterThan(300);
    expect(cave[Math.round(at.y) * W + Math.round(at.x)]).toBe(TUNNEL);
    releaseCave(mountain);
  });

  it("knows ore from rock, tunnel, and lava", () => {
    expect(isOre(GOLD)).toBe(true);
    expect(isOre(ROCK)).toBe(false);
    expect(isOre(TUNNEL)).toBe(false);
    expect(isOre(LAVA)).toBe(false);
  });
});
