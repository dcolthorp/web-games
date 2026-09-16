import { describe, expect, it } from "vitest";
import {
  BALL_SPEED_INCREMENT,
  COIN_PUSHBACK,
  DOLLAR_VALUE,
  MIN_WALL_GAP,
  SCREEN_WIDTH,
  newGame,
  overlaps,
  pushWallsBack,
  shadowAt,
  step,
  type Moves,
} from "./wallDodger";

const STILL: Moves = { left: false, right: false, up: false, down: false };

// A game where the ball is parked in a corner and switched off, so the walls
// are the only thing that can get you.
function quietGame(): ReturnType<typeof newGame> {
  const game = newGame();
  game.ballDx = 0;
  game.ballDy = 0;
  game.ballSpeed = 0;
  game.ball.x = 2;
  game.ball.y = 2;
  game.player.x = SCREEN_WIDTH - 60;
  game.player.y = 400;
  return game;
}

describe("the closing walls", () => {
  it("close in faster the longer you last", () => {
    const game = quietGame();
    const width = (): number => game.walls.right - game.walls.left;

    const beforeFirst = width();
    for (let frame = 0; frame < 60; frame += 1) step(game, STILL, frame / 60);
    const firstSecond = beforeFirst - width();

    for (let frame = 60; frame < 60 * 10; frame += 1) step(game, STILL, frame / 60);
    const beforeLast = width();
    for (let frame = 60 * 10; frame < 60 * 11; frame += 1) step(game, STILL, frame / 60);
    const tenthSecond = beforeLast - width();

    expect(tenthSecond).toBeGreaterThan(firstSecond);
  });

  it("finish you off when there's no room left", () => {
    const game = quietGame();
    for (let frame = 0; frame < 60 * 600 && !game.over; frame += 1) step(game, STILL, frame / 60);
    expect(game.over).toBe(true);
    expect(game.walls.right - game.walls.left).toBeLessThanOrEqual(MIN_WALL_GAP + 2);
  });
});

describe("coins and dollars", () => {
  it("push the walls back, and a dollar pushes them ten times further", () => {
    const game = newGame();
    game.walls = { left: 200, right: 600, top: 200, bottom: 400 };
    pushWallsBack(game, COIN_PUSHBACK);
    expect(game.walls.left).toBe(200 - COIN_PUSHBACK);
    expect(game.walls.right).toBe(600 + COIN_PUSHBACK);

    game.walls = { left: 200, right: 600, top: 200, bottom: 400 };
    pushWallsBack(game, 10 * COIN_PUSHBACK);
    expect(game.walls.left).toBe(200 - 10 * COIN_PUSHBACK);
  });

  it("never push the walls past the edge of the screen", () => {
    const game = newGame();
    game.walls = { left: 5, right: SCREEN_WIDTH - 5, top: 5, bottom: 200 };
    pushWallsBack(game, 100);
    expect(game.walls.left).toBe(0);
    expect(game.walls.right).toBe(SCREEN_WIDTH);
  });

  it("are worth one and a hundred", () => {
    const game = newGame();
    game.coins = [{ x: game.player.x + 15, y: game.player.y + 15 }];
    step(game, STILL, 0.1);
    expect(game.coinsCollected).toBe(1);
    expect(game.score).toBe(1);

    game.dollars = [{ x: game.player.x + 15, y: game.player.y + 15 }];
    step(game, STILL, 0.2);
    expect(game.score).toBe(1 + DOLLAR_VALUE);
  });
});

describe("the ball", () => {
  it("speeds up every ten seconds", () => {
    const game = newGame();
    const startedAt = game.ballSpeed;
    for (let frame = 0; frame < 60 * 11; frame += 1) step(game, STILL, frame / 60);
    expect(game.ballSpeed).toBeCloseTo(startedAt + BALL_SPEED_INCREMENT, 5);
  });

  it("stays inside the walls, however long it bounces around", () => {
    const game = newGame();
    for (let frame = 0; frame < 60 * 30 && !game.over; frame += 1) {
      step(game, STILL, frame / 60);
      expect(game.ball.x).toBeGreaterThanOrEqual(game.walls.left - 2);
      expect(game.ball.x + game.ball.width).toBeLessThanOrEqual(game.walls.right + 2);
    }
  });

  it("gets you if it touches you", () => {
    const game = newGame();
    game.ball.x = game.player.x;
    game.ball.y = game.player.y;
    step(game, STILL, 0.1);
    expect(game.over).toBe(true);
  });
});

describe("the wall shadows", () => {
  it("fall darkest right against a wall and not at all out in the middle", () => {
    const walls = { left: 0, right: 800, top: 0, bottom: 600 };
    expect(shadowAt(400, 300, walls)).toBe(0);
    expect(shadowAt(2, 300, walls)).toBeGreaterThan(0.6);
    expect(shadowAt(60, 300, walls)).toBeGreaterThan(0);
    expect(shadowAt(60, 300, walls)).toBeLessThan(shadowAt(20, 300, walls));
  });
});

describe("boxes", () => {
  it("know when they are on top of each other", () => {
    const one = { x: 0, y: 0, width: 10, height: 10 };
    expect(overlaps(one, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(overlaps(one, { x: 20, y: 0, width: 10, height: 10 })).toBe(false);
  });
});
