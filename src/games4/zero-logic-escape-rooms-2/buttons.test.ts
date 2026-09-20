import { describe, expect, it } from "vitest";
import {
  RIDER_BUTTON,
  allPressed,
  buttonAt,
  makeButtons,
  pressedCount,
  spawnAt,
  spawnCount,
} from "./buttons";

describe("makeButtons", () => {
  it("starts with nothing pressed", () => {
    const buttons = makeButtons();
    expect(buttons.length).toBeGreaterThan(8);
    expect(pressedCount(buttons)).toBe(0);
  });

  it("gives every button its own name", () => {
    const ids = makeButtons().map((button) => button.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every button on the screen", () => {
    for (const button of makeButtons()) {
      expect(button.x).toBeGreaterThanOrEqual(0);
      expect(button.y).toBeGreaterThanOrEqual(0);
      expect(button.x + button.w).toBeLessThanOrEqual(960);
      expect(button.y + button.h).toBeLessThanOrEqual(600);
    }
  });

  it("puts one button on top of another one", () => {
    const buttons = makeButtons();
    const rider = buttons.find((button) => button.id === RIDER_BUTTON);
    const big = buttons.find((button) => button.id === "big-red");
    expect(rider).toBeDefined();
    expect(big).toBeDefined();
    if (!rider || !big) return;
    expect(rider.x).toBeGreaterThan(big.x);
    expect(rider.x + rider.w).toBeLessThan(big.x + big.w);
  });
});

describe("allPressed", () => {
  it("needs every single one", () => {
    const buttons = makeButtons();
    for (const button of buttons) button.pressed = true;
    expect(allPressed(buttons)).toBe(true);
    const last = buttons[buttons.length - 1];
    if (last) last.pressed = false;
    expect(allPressed(buttons)).toBe(false);
  });

  it("counts a button that turned up later too", () => {
    const buttons = makeButtons().map((button) => ({ ...button, pressed: true }));
    const extra = spawnAt(0);
    expect(extra).not.toBeNull();
    if (!extra) return;
    buttons.push(extra);
    expect(allPressed(buttons)).toBe(false);
  });
});

describe("spawnAt", () => {
  it("runs out after the last spare button", () => {
    expect(spawnAt(spawnCount())).toBeNull();
  });

  // The room's chain depends on this: a tiny button makes another tiny button.
  it("hands back tiny buttons, so each one makes the next", () => {
    for (let index = 0; index < spawnCount(); index += 1) {
      expect(spawnAt(index)?.shape).toBe("tiny");
    }
  });
});

describe("buttonAt", () => {
  it("picks the one riding on top", () => {
    const buttons = makeButtons();
    const rider = buttons.find((button) => button.id === RIDER_BUTTON);
    if (!rider) throw new Error("no rider");
    const hit = buttonAt(buttons, rider.x + 2, rider.y + 2);
    expect(hit?.id).toBe(RIDER_BUTTON);
  });

  it("finds nothing on a bare bit of wall", () => {
    expect(buttonAt(makeButtons(), 900, 60)).toBeNull();
  });
});
