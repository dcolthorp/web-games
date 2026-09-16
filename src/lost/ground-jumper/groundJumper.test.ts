import { describe, expect, it } from "vitest";
import { LANE_GROUND_Y, LANE_ORDER, STARTING_HEARTS } from "./constants";
import { makeDisguisedWall, makeEntity, rectOf, updateEntity } from "./entities";
import { INVERSION_DURATION, laneChange, newGame, pressJump, step, steer, type Controls } from "./game";
import { arrivalTime, laneIsSafeAtArrival, makeSpawner, RUNNER_COLLECTIBLES, RUNNER_OBSTACLES } from "./spawner";
import { buy, defaultProfile, equip, itemsOfType, outfitOf, owns } from "./shop";

const STILL: Controls = { left: false, right: false, jump: false };
const midLane = LANE_ORDER[1] ?? 1;

// The same run every time, so a test can walk through it.
function fixedRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0.5;
    index += 1;
    return value;
  };
}

describe("jumping", () => {
  it("leaves the ground and comes back down to it", () => {
    const game = newGame("runner", 0, () => 0.99);
    pressJump(game);
    step(game, STILL, 1 / 60);
    expect(game.player.onGround).toBe(false);
    expect(game.player.y).toBeLessThan(LANE_GROUND_Y[midLane] ?? 0);

    for (let frame = 0; frame < 120; frame += 1) step(game, STILL, 1 / 60);
    expect(game.player.onGround).toBe(true);
    expect(game.player.y).toBe(LANE_GROUND_Y[midLane] ?? 0);
  });

  it("won't let you jump again in mid-air", () => {
    const game = newGame("runner", 0, () => 0.99);
    pressJump(game);
    step(game, STILL, 1 / 60);
    const rising = game.player.vy;
    pressJump(game);
    expect(game.player.vy).toBe(rising);
  });
});

describe("lanes", () => {
  it("move you up and down but not off the end", () => {
    const game = newGame("runner", 0, () => 0.99);
    laneChange(game, +1);
    expect(game.player.lane).toBe(LANE_ORDER[2]);
    laneChange(game, +1);
    expect(game.player.lane).toBe(LANE_ORDER[2]);
    laneChange(game, -1);
    laneChange(game, -1);
    expect(game.player.lane).toBe(LANE_ORDER[0]);
  });
});

describe("hearts", () => {
  it("run out after three hits, one hit at a time", () => {
    const game = newGame("runner", 0, () => 0.99);
    expect(game.player.hearts).toBe(STARTING_HEARTS);

    const hit = (): void => {
      game.player.invulnerableTime = 0;
      const wall = makeEntity("wall", game.player.x, LANE_GROUND_Y[game.player.lane] ?? 0, game.player.lane);
      game.entities.push(wall);
      step(game, STILL, 1 / 60);
    };

    hit();
    expect(game.player.hearts).toBe(2);
    hit();
    hit();
    expect(game.player.hearts).toBe(0);
    expect(game.over).toBe(true);
  });

  it("can't be chipped away twice in the same moment", () => {
    const game = newGame("runner", 0, () => 0.99);
    for (let i = 0; i < 2; i += 1) {
      game.entities.push(
        makeEntity("wall", game.player.x + i, LANE_GROUND_Y[game.player.lane] ?? 0, game.player.lane)
      );
    }
    step(game, STILL, 1 / 60);
    expect(game.player.hearts).toBe(STARTING_HEARTS - 1);
  });
});

describe("the collectibles", () => {
  it("are worth what they were worth in the Python game", () => {
    expect(makeEntity("coin", 0, 0, 0).value).toBe(100);
    expect(makeEntity("dollar", 0, 0, 0).value).toBe(250);
    expect(makeEntity("diamond", 0, 0, 0).value).toBe(500);
    expect(makeEntity("mystery", 0, 0, 0).value).toBe(1000);
  });

  it("add to your score and your pocket money when you touch them", () => {
    const game = newGame("runner", 0, () => 0.99);
    const coin = makeEntity("coin", game.player.x, (LANE_GROUND_Y[game.player.lane] ?? 0) - 28, game.player.lane);
    game.entities.push(coin);
    step(game, STILL, 1 / 60);
    expect(game.score).toBe(100);
    expect(game.earnings).toBe(10);
    expect(game.entities).toHaveLength(0);
  });
});

describe("the walls that aren't there", () => {
  it("have no hit box at all, so you walk straight through", () => {
    const fake = makeDisguisedWall(500, midLane, { isIllusion: true, spawnX: 500, playerXRef: 160 });
    const real = makeDisguisedWall(500, midLane, { isIllusion: false, spawnX: 500, playerXRef: 160 });
    expect(rectOf(fake).width).toBe(0);
    expect(rectOf(real).width).toBeGreaterThan(0);
  });

  it("start flashing once they're halfway to you", () => {
    const fake = makeDisguisedWall(500, midLane, { isIllusion: true, spawnX: 500, playerXRef: 100 });
    updateEntity(fake, 0.1, () => 0);
    expect(fake.flashStarted).toBe(false);
    fake.x = 300;
    updateEntity(fake, 0.1, () => 0);
    expect(fake.flashStarted).toBe(true);
  });
});

describe("the holes in the lane", () => {
  it("end the run the moment you drop into one", () => {
    const game = newGame("lost_levels", 0, () => 0.99);
    const trap = makeEntity("trap", game.player.x, LANE_GROUND_Y[game.player.lane] ?? 0, game.player.lane);
    game.entities.push(trap);
    // Standing over the hole there's nothing to stand on, so down you go.
    for (let frame = 0; frame < 30 && !game.over; frame += 1) step(game, STILL, 1 / 60);
    expect(game.over).toBe(true);
  });
});

describe("the damage bar", () => {
  it("takes a quarter off per hit and fills back up while you stand still", () => {
    const game = newGame("lost_levels", 0, () => 0.99);
    const bar = game.player.damageBar;
    expect(bar).not.toBeNull();
    if (!bar) return;

    game.entities.push(
      makeEntity("wall", game.player.x, LANE_GROUND_Y[game.player.lane] ?? 0, game.player.lane)
    );
    step(game, STILL, 1 / 60);
    // A quarter off, less the sliver that already healed back in that frame.
    expect(bar.current).toBeCloseTo(75, 0);

    const after = bar.current;
    for (let frame = 0; frame < 60; frame += 1) step(game, STILL, 1 / 60);
    expect(bar.current).toBeGreaterThan(after);
  });

  it("doesn't heal while you're walking", () => {
    const game = newGame("lost_levels", 0, () => 0.99);
    const bar = game.player.damageBar;
    if (!bar) return;
    bar.current = 50;
    for (let frame = 0; frame < 30; frame += 1) {
      step(game, { left: true, right: false, jump: false }, 1 / 60);
    }
    expect(bar.current).toBe(50);
  });
});

describe("the rainbow circle", () => {
  it("turns your controls around for ten seconds", () => {
    const game = newGame("lost_levels", 0, () => 0.99);
    const rainbow = makeEntity(
      "rainbow",
      game.player.x,
      (LANE_GROUND_Y[game.player.lane] ?? 0) - 60,
      game.player.lane
    );
    // Reach up and grab it.
    game.player.y = (LANE_GROUND_Y[game.player.lane] ?? 0) - 40;
    game.entities.push(rainbow);
    step(game, STILL, 1 / 60);
    expect(game.inversionTime).toBeGreaterThan(INVERSION_DURATION - 0.1);
    expect(steer(game, { left: false, right: true, jump: false })).toBe(-1);
  });
});

describe("the spawner", () => {
  it("won't box you in: some lane is always still safe", () => {
    const spawner = makeSpawner(RUNNER_OBSTACLES, RUNNER_COLLECTIBLES, fixedRandom([0.1, 0.4, 0.9]));
    const walls = LANE_ORDER.slice(0, 2).map((lane) =>
      makeEntity("wall", 480, LANE_GROUND_Y[lane] ?? 0, lane)
    );
    const safeLanes = LANE_ORDER.filter((lane) => laneIsSafeAtArrival(spawner, walls, 160, lane, null));
    expect(safeLanes).toEqual([LANE_ORDER[2]]);
  });

  it("knows how long something takes to reach you", () => {
    const wall = makeEntity("wall", 160 + 320, LANE_GROUND_Y[0] ?? 0, 0);
    expect(arrivalTime(wall, 160)).toBeCloseTo(1);
  });

  it("speeds up as the run goes on", () => {
    const game = newGame("runner", 0, () => 0.99);
    const first = game.spawner.interval;
    for (let frame = 0; frame < 60 * 30; frame += 1) step(game, STILL, 1 / 60);
    expect(game.spawner.interval).toBeLessThan(first);
    expect(game.spawner.difficulty).toBeGreaterThan(0);
  });
});

describe("the dressing room", () => {
  it("won't sell you something you can't afford", () => {
    const profile = defaultProfile();
    const gold = itemsOfType("color").find((item) => item.id === "color:gold");
    expect(gold).toBeDefined();
    if (!gold) return;
    expect(buy(profile, gold)).toBe(false);
    profile.balance = 500;
    expect(buy(profile, gold)).toBe(true);
    expect(profile.balance).toBe(0);
    expect(owns(profile, gold.id)).toBe(true);
  });

  it("puts on what you equip", () => {
    const profile = defaultProfile();
    const ghost = itemsOfType("outfit").find((item) => item.id === "outfit:ghost");
    if (!ghost) return;
    profile.balance = 5000;
    buy(profile, ghost);
    equip(profile, ghost);
    expect(outfitOf(profile).outfit).toBe("outfit:ghost");
  });
});
