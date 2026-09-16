// Oscar's first ever game, brought over from the old Python one (snake.py in
// the kids-games project) as closely as it could be: the snake moves by pixels
// rather than on a grid, turns take eight frames to swing round, eating makes
// it poop, and its own poop can kill it.

export const WINDOW_WIDTH = 1400;
export const WINDOW_HEIGHT = 900;
export const BASE_SNAKE_SIZE = 20;
export const BASE_SPEED = 3;
export const TURN_FRAMES = 8;

export const RIGHT_ANGLE = 0;
export const UP_ANGLE = (3 * Math.PI) / 2;
export const LEFT_ANGLE = Math.PI;
export const DOWN_ANGLE = Math.PI / 2;

export const RAINBOW = [
  "rgb(255, 0, 0)",
  "rgb(255, 165, 0)",
  "rgb(255, 255, 0)",
  "rgb(50, 205, 50)",
  "rgb(0, 128, 0)",
  "rgb(0, 0, 255)",
  "rgb(75, 0, 130)",
  "rgb(238, 130, 238)",
  "rgb(255, 0, 255)",
];
export const RAINBOW_RGB: [number, number, number][] = [
  [255, 0, 0],
  [255, 165, 0],
  [255, 255, 0],
  [50, 205, 50],
  [0, 128, 0],
  [0, 0, 255],
  [75, 0, 130],
  [238, 130, 238],
  [255, 0, 255],
];
export const FOOD_COLOR = "rgb(200, 200, 160)";
export const POOP_COLOR = "rgb(135, 206, 235)";
export const LIME_GREEN = "rgb(50, 205, 50)";
export const DARK_GREEN = "rgb(0, 100, 0)";

export type Spot = { x: number; y: number };
export type Direction = "LEFT" | "RIGHT" | "UP" | "DOWN";

export class Snake {
  positions: Spot[];
  size = BASE_SNAKE_SIZE;
  speed = BASE_SPEED;
  dx = 0;
  dy = 0;
  currentAngle: number | null = null;
  targetAngle: number | null = null;
  amountToGrow = 0;
  needsToPoop = false;
  newPoop: Spot | null = null;

  constructor(start: Spot) {
    this.positions = [start];
  }

  get head(): Spot {
    return this.positions[this.positions.length - 1] ?? { x: 0, y: 0 };
  }

  setDirection(direction: Direction): void {
    // You can't turn straight back on yourself.
    if (direction === "LEFT" && this.dx !== this.speed) this.targetAngle = LEFT_ANGLE;
    else if (direction === "RIGHT" && this.dx !== -this.speed) this.targetAngle = RIGHT_ANGLE;
    else if (direction === "UP" && this.dy !== this.speed) this.targetAngle = UP_ANGLE;
    else if (direction === "DOWN" && this.dy !== -this.speed) this.targetAngle = DOWN_ANGLE;
  }

  // Turns swing round over eight frames instead of snapping.
  processTurn(): void {
    if (this.targetAngle === null) return;
    if (this.currentAngle === null) {
      this.currentAngle = this.targetAngle;
      return;
    }

    let angleDiff = this.targetAngle - this.currentAngle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    else if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    this.currentAngle += angleDiff / TURN_FRAMES;
    if (Math.abs(angleDiff) < 0.1) {
      this.currentAngle = this.targetAngle;
      this.targetAngle = null;
    }

    this.dx = this.speed * Math.cos(this.currentAngle);
    this.dy = this.speed * Math.sin(this.currentAngle);
  }

  moveHead(): void {
    const head = this.head;
    this.positions.push({ x: head.x + this.dx, y: head.y + this.dy });
  }

  isTouching(spot: Spot, radius: number): boolean {
    const head = this.head;
    const middleX = head.x + this.size / 2;
    const middleY = head.y + this.size / 2;
    const away = Math.hypot(middleX - spot.x, middleY - spot.y);
    return away <= radius + this.size / 2;
  }

  isTouchingItself(): boolean {
    const skip = 2 + Math.ceil(this.size / this.speed);
    for (let i = 0; i < this.positions.length - skip; i += 1) {
      const part = this.positions[i];
      if (!part) continue;
      if (this.isTouching({ x: part.x + this.size / 2, y: part.y + this.size / 2 }, 0)) return true;
    }
    return false;
  }

  isOutsideWindow(): boolean {
    const head = this.head;
    return head.x > WINDOW_WIDTH || head.x < -this.size || head.y > WINDOW_HEIGHT || head.y < -this.size;
  }

  grow(amount: number): void {
    this.amountToGrow += amount;
  }

  makePoop(): void {
    this.needsToPoop = true;
  }

  // One step. Gives back a poop to drop on the ground, if one just came out.
  update(): Spot | null {
    this.processTurn();
    this.moveHead();

    if (this.amountToGrow > 0) {
      this.amountToGrow -= 1;
      return null;
    }

    this.positions.shift();
    if (this.needsToPoop) {
      this.newPoop = this.head;
      this.needsToPoop = false;
    }

    // It drops once the snake has moved off it, so it doesn't kill you instantly.
    if (this.newPoop && !this.isTouching(this.newPoop, BASE_SNAKE_SIZE)) {
      const dropped = this.newPoop;
      this.newPoop = null;
      return dropped;
    }
    return null;
  }

  reset(start: Spot): void {
    this.positions = [start];
    this.dx = 0;
    this.dy = 0;
    this.currentAngle = null;
    this.targetAngle = null;
    this.amountToGrow = 0;
    this.needsToPoop = false;
    this.newPoop = null;
    this.size = BASE_SNAKE_SIZE;
    this.speed = BASE_SPEED;
  }
}

export type StarKind = "normal" | "lucky";
export const SECONDS_UNTIL_SELF_DESTRUCT = RAINBOW.length;

export interface StarFood {
  spot: Spot;
  kind: StarKind;
  addedAt: number;
}

export const starAge = (star: StarFood, now: number): number => (now - star.addedAt) / 1000;
export const starIsGone = (star: StarFood, now: number): boolean =>
  starAge(star, now) > SECONDS_UNTIL_SELF_DESTRUCT;

// Eating a star is the big one: your score becomes three more, doubled.
export const scoreAfterStar = (score: number): number => (3 + score) * 2;

export const randomSpot = (): Spot => ({
  x: Math.random() * WINDOW_WIDTH,
  y: Math.random() * WINDOW_HEIGHT,
});
