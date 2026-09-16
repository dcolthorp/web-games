import { describe, expect, it } from "vitest";
import {
  BASE_SNAKE_SIZE,
  DOWN_ANGLE,
  RIGHT_ANGLE,
  Snake,
  TURN_FRAMES,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  scoreAfterStar,
  starIsGone,
} from "./snakeGame";

const middle = () => new Snake({ x: WINDOW_WIDTH / 2, y: WINDOW_HEIGHT / 2 });

describe("the snake", () => {
  it("swings round to the new direction over eight frames instead of snapping", () => {
    const snake = middle();
    snake.setDirection("RIGHT");
    snake.update();
    expect(snake.currentAngle).toBe(RIGHT_ANGLE);

    snake.setDirection("DOWN");
    snake.update();
    // Part way round after one frame, not all the way.
    expect(snake.currentAngle).toBeGreaterThan(RIGHT_ANGLE);
    expect(snake.currentAngle).toBeLessThan(DOWN_ANGLE);

    for (let frame = 0; frame < TURN_FRAMES * 3; frame += 1) snake.update();
    expect(snake.currentAngle).toBeCloseTo(DOWN_ANGLE, 1);
  });

  it("won't turn straight back on itself", () => {
    const snake = middle();
    snake.setDirection("RIGHT");
    snake.update();
    snake.update();
    const wasGoing = snake.dx;
    snake.setDirection("LEFT");
    snake.update();
    expect(snake.dx).toBeCloseTo(wasGoing, 1);
  });

  it("gets longer when it grows, instead of shuffling along", () => {
    const snake = middle();
    snake.setDirection("RIGHT");
    for (let frame = 0; frame < 10; frame += 1) snake.update();
    const length = snake.positions.length;
    snake.grow(4);
    for (let frame = 0; frame < 4; frame += 1) snake.update();
    expect(snake.positions.length).toBe(length + 4);
  });

  it("dies when it runs into itself", () => {
    const snake = middle();
    snake.grow(200);
    snake.setDirection("RIGHT");
    for (let frame = 0; frame < 200; frame += 1) snake.update();
    expect(snake.isTouchingItself()).toBe(false);
    // Turn in a tight circle until it bites itself.
    let bitten = false;
    for (let frame = 0; frame < 400 && !bitten; frame += 1) {
      snake.setDirection(["UP", "LEFT", "DOWN", "RIGHT"][Math.floor(frame / 10) % 4] as "UP");
      snake.update();
      bitten = snake.isTouchingItself();
    }
    expect(bitten).toBe(true);
  });

  it("knows when it has left the window", () => {
    const snake = new Snake({ x: WINDOW_WIDTH - 2, y: WINDOW_HEIGHT / 2 });
    expect(snake.isOutsideWindow()).toBe(false);
    snake.setDirection("RIGHT");
    for (let frame = 0; frame < 10; frame += 1) snake.update();
    expect(snake.isOutsideWindow()).toBe(true);
  });

  it("drops a poop behind it once it has moved off the spot", () => {
    const snake = middle();
    snake.setDirection("RIGHT");
    for (let frame = 0; frame < 5; frame += 1) snake.update();
    snake.makePoop();
    let dropped = null;
    for (let frame = 0; frame < 40 && !dropped; frame += 1) dropped = snake.update();
    expect(dropped).not.toBeNull();
    // It lands behind the snake, not on top of it.
    expect(snake.isTouching(dropped ?? { x: 0, y: 0 }, BASE_SNAKE_SIZE)).toBe(false);
  });
});

describe("stars", () => {
  it("makes your score three more, doubled", () => {
    expect(scoreAfterStar(0)).toBe(6);
    expect(scoreAfterStar(7)).toBe(20);
  });

  it("takes itself away after nine seconds, one for each colour", () => {
    const star = { spot: { x: 10, y: 10 }, kind: "normal" as const, addedAt: 0 };
    expect(starIsGone(star, 8000)).toBe(false);
    expect(starIsGone(star, 9500)).toBe(true);
  });
});
