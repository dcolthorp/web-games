// Wall Dodger Survival, brought over from the old Python one (obstacles.py in
// the kids-games project). The walls close in on you for ever, a ball bounces
// around inside getting faster, and the only way to push the walls back is to
// grab the coins before it gets you.

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const PLAYER_SIZE = 30;
export const BALL_SIZE = 35;
export const COIN_SIZE = 20;

export const PLAYER_SPEED = 5;
export const BALL_INITIAL_SPEED = 3;
export const BALL_SPEED_INCREASE_SECONDS = 10;
export const BALL_SPEED_INCREMENT = 0.25;
export const BALL_NUDGE_FACTOR = 0.1;

export const WALL_INITIAL_SHRINK_RATE = 0.05;
export const WALL_SHRINK_ACCELERATION = 0.0001;
export const COIN_PUSHBACK = 15;
export const COIN_SPAWN_SECONDS = 2;
export const MAX_COINS = 7;

export const DOLLAR_WIDTH = 30;
export const DOLLAR_HEIGHT = 12;
export const DOLLAR_VALUE = 100;
export const DOLLAR_PUSHBACK = 10 * COIN_PUSHBACK;
export const DOLLAR_SPAWN_SECONDS = 15;
export const DOLLAR_SPAWN_CHANCE = 0.3;
export const MAX_DOLLARS = 1;

// How close to a wall something has to be before the wall's shadow falls on it.
export const MAX_SHADOW_DISTANCE = 100;
export const SHADOW_INTENSITY = 0.7;

export const MIN_WALL_GAP = PLAYER_SIZE + BALL_SIZE + 10;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Coin {
  x: number;
  y: number;
}

export interface Walls {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Game {
  player: Box;
  ball: Box;
  ballDx: number;
  ballDy: number;
  ballSpeed: number;
  walls: Walls;
  shrinkRate: number;
  coins: Coin[];
  dollars: Coin[];
  coinsCollected: number;
  score: number;
  elapsed: number;
  lastCoinSpawn: number;
  lastDollarSpawn: number;
  lastSpeedIncrease: number;
  over: boolean;
}

export const overlaps = (one: Box, other: Box): boolean =>
  one.x < other.x + other.width &&
  one.x + one.width > other.x &&
  one.y < other.y + other.height &&
  one.y + one.height > other.y;

export const coinBox = (coin: Coin): Box => ({
  x: coin.x - COIN_SIZE / 2,
  y: coin.y - COIN_SIZE / 2,
  width: COIN_SIZE,
  height: COIN_SIZE,
});

export const dollarBox = (dollar: Coin): Box => ({
  x: dollar.x - DOLLAR_WIDTH / 2,
  y: dollar.y - DOLLAR_HEIGHT / 2,
  width: DOLLAR_WIDTH,
  height: DOLLAR_HEIGHT,
});

export function newGame(): Game {
  const angle = Math.random() * Math.PI * 2;
  return {
    player: {
      x: SCREEN_WIDTH / 2 - PLAYER_SIZE / 2,
      y: SCREEN_HEIGHT / 2 - PLAYER_SIZE / 2,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
    },
    ball: { x: SCREEN_WIDTH / 4, y: SCREEN_HEIGHT / 4, width: BALL_SIZE, height: BALL_SIZE },
    ballDx: BALL_INITIAL_SPEED * Math.cos(angle),
    ballDy: BALL_INITIAL_SPEED * Math.sin(angle),
    ballSpeed: BALL_INITIAL_SPEED,
    walls: { left: 0, right: SCREEN_WIDTH, top: 0, bottom: SCREEN_HEIGHT },
    shrinkRate: WALL_INITIAL_SHRINK_RATE,
    coins: [],
    dollars: [],
    coinsCollected: 0,
    score: 0,
    elapsed: 0,
    lastCoinSpawn: 0,
    lastDollarSpawn: 0,
    lastSpeedIncrease: 0,
    over: false,
  };
}

// Somewhere inside the walls with room to sit, not on top of anything else.
export function spawnSpot(game: Game, width: number, height: number): Coin | null {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const x = game.walls.left + width + Math.random() * Math.max(0, game.walls.right - game.walls.left - 2 * width);
    const y = game.walls.top + height + Math.random() * Math.max(0, game.walls.bottom - game.walls.top - 2 * height);
    const box = { x: x - width / 2, y: y - height / 2, width, height };
    const clashes =
      game.coins.some((coin) => overlaps(box, coinBox(coin))) ||
      game.dollars.some((dollar) => overlaps(box, dollarBox(dollar))) ||
      overlaps(box, game.player) ||
      overlaps(box, game.ball);
    if (!clashes) return { x, y };
  }
  return null;
}

export interface Moves {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

// One frame, the way the old game counted them: sixty a second.
export function step(game: Game, moves: Moves, seconds: number): void {
  if (game.over) return;
  game.elapsed = seconds;

  // You.
  if (moves.left) game.player.x -= PLAYER_SPEED;
  if (moves.right) game.player.x += PLAYER_SPEED;
  if (moves.up) game.player.y -= PLAYER_SPEED;
  if (moves.down) game.player.y += PLAYER_SPEED;
  game.player.x = Math.max(game.walls.left, Math.min(game.walls.right - PLAYER_SIZE, game.player.x));
  game.player.y = Math.max(game.walls.top, Math.min(game.walls.bottom - PLAYER_SIZE, game.player.y));

  // The ball.
  game.ball.x += game.ballDx;
  game.ball.y += game.ballDy;

  const buffer = game.ballSpeed * 0.5;
  const nudge = (): number => (Math.random() * 2 - 1) * BALL_NUDGE_FACTOR * game.ballSpeed;
  let bounced = false;
  if (game.ball.x <= game.walls.left) {
    game.ball.x = game.walls.left + buffer;
    game.ballDx = Math.abs(game.ballDx);
    game.ballDy += nudge();
    bounced = true;
  }
  if (game.ball.x + BALL_SIZE >= game.walls.right) {
    game.ball.x = game.walls.right - BALL_SIZE - buffer;
    game.ballDx = -Math.abs(game.ballDx);
    game.ballDy += nudge();
    bounced = true;
  }
  if (game.ball.y <= game.walls.top) {
    game.ball.y = game.walls.top + buffer;
    game.ballDy = Math.abs(game.ballDy);
    game.ballDx += nudge();
    bounced = true;
  }
  if (game.ball.y + BALL_SIZE >= game.walls.bottom) {
    game.ball.y = game.walls.bottom - BALL_SIZE - buffer;
    game.ballDy = -Math.abs(game.ballDy);
    game.ballDx += nudge();
    bounced = true;
  }
  // A bounce knocks it off course a little, but never changes how fast it goes.
  if (bounced) {
    const speedNow = Math.hypot(game.ballDx, game.ballDy);
    if (speedNow > 0) {
      game.ballDx *= game.ballSpeed / speedNow;
      game.ballDy *= game.ballSpeed / speedNow;
    }
  }

  if (seconds - game.lastSpeedIncrease > BALL_SPEED_INCREASE_SECONDS) {
    game.ballSpeed += BALL_SPEED_INCREMENT;
    const heading = Math.atan2(game.ballDy, game.ballDx);
    game.ballDx = game.ballSpeed * Math.cos(heading);
    game.ballDy = game.ballSpeed * Math.sin(heading);
    game.lastSpeedIncrease = seconds;
  }

  // The walls, closing in a little faster every frame.
  game.walls.left += game.shrinkRate;
  game.walls.right -= game.shrinkRate;
  game.walls.top += game.shrinkRate;
  game.walls.bottom -= game.shrinkRate;
  game.shrinkRate += WALL_SHRINK_ACCELERATION;

  const middleX = SCREEN_WIDTH / 2;
  const middleY = SCREEN_HEIGHT / 2;
  game.walls.left = Math.min(game.walls.left, middleX - MIN_WALL_GAP / 2);
  game.walls.right = Math.max(game.walls.right, middleX + MIN_WALL_GAP / 2);
  game.walls.top = Math.min(game.walls.top, middleY - MIN_WALL_GAP / 2);
  game.walls.bottom = Math.max(game.walls.bottom, middleY + MIN_WALL_GAP / 2);
  if (game.walls.right - game.walls.left < MIN_WALL_GAP || game.walls.bottom - game.walls.top < MIN_WALL_GAP) {
    game.over = true;
  }

  // Coins, and the rare dollar.
  if (seconds - game.lastCoinSpawn > COIN_SPAWN_SECONDS && game.coins.length < MAX_COINS) {
    const spot = spawnSpot(game, COIN_SIZE, COIN_SIZE);
    if (spot) game.coins.push(spot);
    game.lastCoinSpawn = seconds;
  }
  if (
    seconds - game.lastDollarSpawn > DOLLAR_SPAWN_SECONDS &&
    game.dollars.length < MAX_DOLLARS &&
    Math.random() < DOLLAR_SPAWN_CHANCE
  ) {
    const spot = spawnSpot(game, DOLLAR_WIDTH, DOLLAR_HEIGHT);
    if (spot) game.dollars.push(spot);
    game.lastDollarSpawn = seconds;
  }

  if (overlaps(game.player, game.ball)) game.over = true;

  game.coins = game.coins.filter((coin) => {
    if (!overlaps(game.player, coinBox(coin))) return true;
    game.coinsCollected += 1;
    game.score += 1;
    pushWallsBack(game, COIN_PUSHBACK);
    return false;
  });

  game.dollars = game.dollars.filter((dollar) => {
    if (!overlaps(game.player, dollarBox(dollar))) return true;
    game.score += DOLLAR_VALUE;
    pushWallsBack(game, DOLLAR_PUSHBACK);
    return false;
  });
}

export function pushWallsBack(game: Game, by: number): void {
  game.walls.left = Math.max(0, game.walls.left - by);
  game.walls.right = Math.min(SCREEN_WIDTH, game.walls.right + by);
  game.walls.top = Math.max(0, game.walls.top - by);
  game.walls.bottom = Math.min(SCREEN_HEIGHT, game.walls.bottom + by);
}

// How much of the walls' shadow falls on this spot: 0 out in the middle, up to
// SHADOW_INTENSITY right against a wall.
export function shadowAt(x: number, y: number, walls: Walls): number {
  const nearest = Math.min(x - walls.left, walls.right - x, y - walls.top, walls.bottom - y);
  if (nearest >= MAX_SHADOW_DISTANCE) return 0;
  return SHADOW_INTENSITY * (1 - Math.max(0, nearest) / MAX_SHADOW_DISTANCE);
}
