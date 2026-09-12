import { describe, expect, it } from "vitest";
import { MATERIALS, ROCK, TUNNEL, decodeCave, encodeCave, makeCave, paint } from "./caves";
import { H, W } from "./world";

const GOLD = MATERIALS.findIndex((m) => m.name === "Gold");
const LAVA = MATERIALS.findIndex((m) => m.name === "Lava");

describe("caves", () => {
  it("makes a cave with tunnels and rock", () => {
    const cave = makeCave(7);
    expect(cave.filter((m) => m === TUNNEL).length).toBeGreaterThan(1000);
    expect(cave.filter((m) => m === ROCK).length).toBeGreaterThan(10000);
    expect(makeCave(7)).toEqual(cave);
  });

  it("saves a cave as text and gets the same cave back", () => {
    const cave = makeCave(7);
    paint(cave, 100, 100, 5, GOLD);
    expect(decodeCave(encodeCave(cave))).toEqual(cave);
  });

  it("won't load text that isn't a whole cave", () => {
    expect(decodeCave("#5")).toBeNull();
    expect(decodeCave(`#${W * H + 1}`)).toBeNull();
    expect(decodeCave(`?${W * H}`)).toBeNull();
  });

  it("puts ores only in rock and lava only in tunnels", () => {
    // Left half tunnel, right half rock.
    const cave = new Uint8Array(W * H).map((_, i) => (i % W < 160 ? TUNNEL : ROCK));
    paint(cave, 160, 100, 6, GOLD);
    expect(cave[100 * W + 157]).toBe(TUNNEL);
    expect(cave[100 * W + 163]).toBe(GOLD);
    paint(cave, 160, 50, 6, LAVA);
    expect(cave[50 * W + 157]).toBe(LAVA);
    expect(cave[50 * W + 163]).toBe(ROCK);
    expect(cave.length).toBe(W * H);
    expect(H).toBe(200);
  });
});
