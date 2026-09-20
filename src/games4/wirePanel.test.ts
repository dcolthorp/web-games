import { describe, expect, it } from "vitest";
import {
  PORT_COUNT,
  WIRES_NEEDED,
  WIRE_COLORS,
  canConnect,
  makePorts,
  matchedPairs,
} from "./wirePanel";

describe("makePorts", () => {
  it("lays out every colour twice", () => {
    const ports = makePorts([0.1, 0.9, 0.4, 0.7, 0.2]);
    expect(ports).toHaveLength(PORT_COUNT);
    for (const color of WIRE_COLORS) {
      expect(ports.filter((port) => port === color)).toHaveLength(2);
    }
  });

  it("shuffles them around", () => {
    const shuffled = makePorts([0.9, 0.1, 0.8, 0.3, 0.6]);
    const inOrder = WIRE_COLORS.flatMap((color) => [color, color]);
    expect(shuffled).not.toEqual(inOrder);
  });

  it("still works when the rolls run out", () => {
    expect(makePorts([])).toHaveLength(PORT_COUNT);
  });
});

describe("canConnect", () => {
  const ports = ["a", "b", "a", "c", "b", "c"];

  it("joins two ports of the same colour", () => {
    expect(canConnect(ports, 0, 2, [])).toBe(true);
  });

  it("refuses two different colours", () => {
    expect(canConnect(ports, 0, 1, [])).toBe(false);
  });

  it("refuses a port joined to itself", () => {
    expect(canConnect(ports, 3, 3, [])).toBe(false);
  });

  it("refuses a port that already has a wire in it", () => {
    expect(canConnect(ports, 0, 2, [2, 5])).toBe(false);
  });
});

describe("matchedPairs", () => {
  it("pairs up both ends of every colour", () => {
    const pairs = matchedPairs(makePorts([0.3, 0.8, 0.1, 0.6, 0.4]));
    expect(pairs).toHaveLength(WIRE_COLORS.length);
    const ends = pairs.flat();
    expect(new Set(ends).size).toBe(PORT_COUNT);
  });

  it("only ever joins two ports of the same colour", () => {
    const ports = makePorts([0.9, 0.2, 0.7, 0.5, 0.1]);
    for (const [a, b] of matchedPairs(ports)) {
      expect(ports[a]).toBe(ports[b]);
    }
  });
});

describe("WIRES_NEEDED", () => {
  it("is every wire on the strip, not just some of them", () => {
    expect(WIRES_NEEDED).toBe(WIRE_COLORS.length);
    expect(WIRES_NEEDED * 2).toBe(PORT_COUNT);
  });
});
