import { describe, expect, it } from "vitest";
import { DOORS_BEFORE_EXIT, ROOMS, exitDoor, roomFor } from "./hallway";

describe("roomFor", () => {
  it("wraps around the list", () => {
    expect(roomFor(0)).toBe(ROOMS[0]);
    expect(roomFor(ROOMS.length)).toBe(ROOMS[0]);
  });

  it("copes with a negative roll", () => {
    expect(roomFor(-1)).toBe(ROOMS[1]);
  });
});

describe("exitDoor", () => {
  it("keeps the way out hidden while you're still new here", () => {
    expect(exitDoor(0, 0)).toBeNull();
    expect(exitDoor(DOORS_BEFORE_EXIT - 1, 0)).toBeNull();
  });

  it("can open the way out once you've been around", () => {
    expect(exitDoor(DOORS_BEFORE_EXIT, 0)).toBe(0);
  });

  it("is still mostly more hallway at first", () => {
    expect(exitDoor(DOORS_BEFORE_EXIT, 0.9)).toBeNull();
  });

  it("gets likelier the longer you're in here", () => {
    expect(exitDoor(DOORS_BEFORE_EXIT + 4, 0.8)).not.toBeNull();
  });

  it("always names one of the three doors", () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      const door = exitDoor(20, roll);
      if (door !== null) expect([0, 1, 2]).toContain(door);
    }
  });
});
