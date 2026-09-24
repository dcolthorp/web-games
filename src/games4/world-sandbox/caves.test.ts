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

  it("gives a bigger mountain a bigger cave", () => {
    const tunnelsIn = (size: number): number => makeCave(11, size).filter((m) => m === TUNNEL).length;
    const oreIn = (size: number): number =>
      makeCave(11, size).filter((m) => m > 1 && MATERIALS[m]?.goesIn === "rock").length;
    expect(tunnelsIn(2.4)).toBeGreaterThan(tunnelsIn(1));
    expect(tunnelsIn(1)).toBeGreaterThan(tunnelsIn(0.6));
    expect(oreIn(2.4)).toBeGreaterThan(oreIn(0.6));
  });

  it("keeps a little mountain's cave down at its own end", () => {
    const small = makeCave(11, 0.6);
    // Nothing dug out up in the top corner, where a small mountain has no room.
    let topCorner = 0;
    for (let y = 0; y < 20; y += 1) {
      for (let x = W - 40; x < W; x += 1) if (small[y * W + x] === TUNNEL) topCorner += 1;
    }
    expect(topCorner).toBe(0);
  });

  it("won't load text that isn't a whole cave", () => {
    expect(decodeCave("#5")).toBeNull();
    expect(decodeCave(`#${W * H + 1}`)).toBeNull();
    // A space is the one thing no material is ever allowed to be called.
    expect(decodeCave(` ${W * H}`)).toBeNull();
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
