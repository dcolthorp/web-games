import { describe, expect, it } from "vitest";
import {
  DOOR_SPOTS,
  GRAB_RANGE,
  MAX_PATIENCE,
  MIN_PATIENCE,
  doorSpot,
  isNear,
  nextSpot,
  patienceFor,
} from "./doors";

describe("doorSpot", () => {
  it("wraps round the wall", () => {
    expect(doorSpot(0)).toBe(DOOR_SPOTS[0]);
    expect(doorSpot(DOOR_SPOTS.length)).toBe(DOOR_SPOTS[0]);
    expect(doorSpot(-1)).toBe(DOOR_SPOTS[DOOR_SPOTS.length - 1]);
  });
});

describe("nextSpot", () => {
  it("never puts the new door back where the old one was", () => {
    for (let from = 0; from < DOOR_SPOTS.length; from += 1) {
      for (let roll = 0; roll < 1; roll += 0.05) {
        expect(nextSpot(from, roll)).not.toBe(from);
      }
    }
  });

  it("always names a real spot", () => {
    for (let roll = 0; roll < 1; roll += 0.05) {
      const spot = nextSpot(2, roll);
      expect(spot).toBeGreaterThanOrEqual(0);
      expect(spot).toBeLessThan(DOOR_SPOTS.length);
    }
  });
});

describe("isNear", () => {
  const door = { x: 480, y: 250 };

  it("lets you look from across the room", () => {
    expect(isNear({ x: 480, y: 250 + GRAB_RANGE + 5 }, door)).toBe(false);
  });

  it("notices you creeping up on it", () => {
    expect(isNear({ x: 500, y: 270 }, door)).toBe(true);
  });
});

describe("patienceFor", () => {
  it("waits somewhere between a moment and a second or so", () => {
    expect(patienceFor(0)).toBe(MIN_PATIENCE);
    expect(patienceFor(1)).toBe(MAX_PATIENCE);
    expect(patienceFor(0.5)).toBeGreaterThan(MIN_PATIENCE);
    expect(patienceFor(0.5)).toBeLessThan(MAX_PATIENCE);
  });
});
