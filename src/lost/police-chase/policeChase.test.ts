import { describe, expect, it } from "vitest";
import { newChase, step, type Keys } from "./game";
import {
  BAG_VALUE,
  COIN_VALUE,
  DIAMOND_VALUE,
  GROUND_Y,
  MAX_RUN_SPEED,
  SCREEN_HEIGHT,
  chimneyOpening,
  ensureAhead,
  jumpReach,
  lootValue,
  makeWorld,
  randomFrom,
  resetWorld,
  roofUnder,
} from "./world";

const STILL: Keys = { left: false, right: false, down: false, jump: false };
const RUNNING: Keys = { left: false, right: true, down: false, jump: false };

describe("running the rooftops", () => {
  it("starts you standing on the first roof", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    expect(chase.player.grounded).toBe(true);
    expect(chase.player.y).toBe(GROUND_Y);
  });

  it("moves the camera only forward", () => {
    const chase = newChase(0, 7);
    for (let frame = 0; frame < 120; frame += 1) step(chase, RUNNING, 1 / 60);
    expect(chase.camera).toBeGreaterThan(0);
    // Turn around — the last of the forward momentum carries the camera a
    // little further, and then it stops for good.
    const backwards = { left: true, right: false, down: false, jump: false };
    for (let frame = 0; frame < 60; frame += 1) step(chase, backwards, 1 / 60);
    const furthest = chase.camera;
    for (let frame = 0; frame < 120; frame += 1) step(chase, backwards, 1 / 60);
    expect(chase.camera).toBe(furthest);
  });

  it("scores you for the ground you cover", () => {
    const chase = newChase(0, 7);
    for (let frame = 0; frame < 180; frame += 1) step(chase, RUNNING, 1 / 60);
    expect(chase.score).toBeGreaterThan(0);
    expect(chase.distance).toBeGreaterThan(0);
  });

  it("speeds up, but only so far", () => {
    const chase = newChase(0, 7);
    for (let frame = 0; frame < 60 * 60; frame += 1) step(chase, RUNNING, 1 / 60);
    expect(chase.runSpeed).toBeLessThanOrEqual(MAX_RUN_SPEED);
    expect(chase.difficulty).toBeGreaterThan(0);
  });
});

describe("jumping", () => {
  it("goes higher when you hold the button", () => {
    const held = newChase(0, 7);
    const tapped = newChase(0, 7);
    step(held, STILL, 1 / 60);
    step(tapped, STILL, 1 / 60);

    const holdKeys: Keys = { ...STILL, jump: true };
    for (let frame = 0; frame < 20; frame += 1) {
      step(held, holdKeys, 1 / 60);
      step(tapped, frame === 0 ? holdKeys : STILL, 1 / 60);
    }
    expect(held.player.y).toBeLessThan(tapped.player.y);
  });
});

describe("the gaps between roofs", () => {
  it("are never wider than you can jump", () => {
    const random = randomFrom(11);
    const world = makeWorld(random);
    resetWorld(world, 46, GROUND_Y);
    ensureAhead(world, { cameraRight: 960, playerSpeed: 258, roofY: GROUND_Y, difficulty: 0 });

    const sorted = [...world.roofs].sort((a, b) => a.startX - b.startX);
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = (sorted[i]?.startX ?? 0) - (sorted[i - 1]?.endX ?? 0);
      expect(gap).toBeLessThanOrEqual(jumpReach(258) + 0.001);
    }
  });
});

describe("falling", () => {
  it("ends the run once you're off the bottom of the screen", () => {
    const chase = newChase(0, 7);
    chase.player.y = SCREEN_HEIGHT + 200;
    chase.player.x = chase.world.roofs[0] ? chase.world.roofs[0].endX + 5000 : 5000;
    step(chase, STILL, 1 / 60);
    expect(chase.phase).toBe("over");
    expect(chase.reason).toBe("You fell.");
  });
});

describe("the chimneys", () => {
  it("send you to the bonus roof if they're the green kind", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    const chimney = { x: chase.player.x - 10, y: GROUND_Y, w: 34, h: 52, isBonus: true };
    chase.world.chimneys = [chimney];
    chase.player.y = chimneyOpening(chimney).y + 40;
    step(chase, { ...STILL, down: true }, 1 / 60);
    expect(chase.phase).toBe("bonus");
    expect(chase.bonus.loot.length).toBeGreaterThan(0);
  });

  it("end the run if they're not", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    const chimney = { x: chase.player.x - 10, y: GROUND_Y, w: 34, h: 52, isBonus: false };
    chase.world.chimneys = [chimney];
    chase.player.y = chimneyOpening(chimney).y + 40;
    step(chase, { ...STILL, down: true }, 1 / 60);
    expect(chase.phase).toBe("over");
    expect(chase.reason).toBe("Wrong chimney.");
  });
});

describe("the cops", () => {
  it("start chasing once you're on their roof and close enough", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    const cop = {
      x: chase.player.x + 150,
      y: GROUND_Y,
      vy: 0,
      grounded: true,
      w: 28,
      h: 64,
      state: "idle" as const,
      patrolSpeed: 30,
      patrolDir: 1,
    };
    chase.world.cops = [cop];
    step(chase, STILL, 1 / 60);
    expect(chase.world.cops[0]?.state).toBe("chase");
  });

  it("catch you if you stand there", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    chase.world.cops = [
      {
        x: chase.player.x,
        y: GROUND_Y,
        vy: 0,
        grounded: true,
        w: 28,
        h: 64,
        state: "chase",
        patrolSpeed: 30,
        patrolDir: 1,
      },
    ];
    step(chase, STILL, 1 / 60);
    expect(chase.phase).toBe("over");
    expect(chase.reason).toBe("Caught by the cops.");
  });
});

describe("the loot", () => {
  it("is worth a coin, a bag, or a diamond", () => {
    expect(lootValue("coin")).toBe(COIN_VALUE);
    expect(lootValue("bag")).toBe(BAG_VALUE);
    expect(lootValue("diamond")).toBe(DIAMOND_VALUE);
  });

  it("adds to your score when you run through it", () => {
    const chase = newChase(0, 7);
    step(chase, STILL, 1 / 60);
    chase.world.loot = [{ x: chase.player.x, y: GROUND_Y - 30, kind: "diamond" }];
    const before = chase.scoreFloat;
    step(chase, STILL, 1 / 60);
    expect(chase.scoreFloat - before).toBeGreaterThanOrEqual(DIAMOND_VALUE);
    expect(chase.world.loot).toHaveLength(0);
  });
});

describe("roofs underfoot", () => {
  it("are only found where you're actually standing", () => {
    const world = makeWorld(randomFrom(3));
    resetWorld(world, 46, GROUND_Y);
    expect(roofUnder(world, 100, GROUND_Y)).not.toBeNull();
    expect(roofUnder(world, 100, GROUND_Y - 200)).toBeNull();
    expect(roofUnder(world, 99999, GROUND_Y)).toBeNull();
  });
});
