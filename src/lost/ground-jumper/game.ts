// A run of Ground Jumper, in either mode. Nothing in here draws anything, so
// the rules can be tested without a screen.

import {
  DAMAGE_BAR_COLLISION_DAMAGE,
  FLASH_DURATION,
  INVULNERABILITY_TIME,
  LANE_GROUND_Y,
  LANE_ORDER,
  LANE_X_OFFSET,
  PLAYER_HORIZONTAL_SPEED,
  WINDOW_WIDTH,
  WORLD_BASE_SPEED,
  LANE_SCROLL_SPEED,
} from "./constants";
import { overlaps, rectOf, updateEntity, type Entity } from "./entities";
import {
  barIsEmpty,
  changeLane,
  gainHeart,
  jump,
  loseHeart,
  makePlayer,
  playerRect,
  regenerate,
  takeBarDamage,
  updatePlayer,
  type Player,
} from "./player";
import {
  LOST_LEVELS_COLLECTIBLES,
  LOST_LEVELS_OBSTACLES,
  RUNNER_COLLECTIBLES,
  RUNNER_OBSTACLES,
  makeSpawner,
  updateSpawner,
  type Spawner,
} from "./spawner";

export type ModeName = "runner" | "lost_levels";

export interface Controls {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface Game {
  mode: ModeName;
  player: Player;
  spawner: Spawner;
  entities: Entity[];
  score: number;
  highScore: number;
  earnings: number;
  elapsed: number;
  flashOverlay: number;
  // The rainbow circle swaps your controls around for ten seconds.
  inversionTime: number;
  paused: boolean;
  over: boolean;
  horizontalDirection: number;
  scrollActive: boolean;
}

export const INVERSION_DURATION = 10;

export function newGame(mode: ModeName, highScore = 0, random: () => number = Math.random): Game {
  const lane = LANE_ORDER[1] ?? 1;
  const isLost = mode === "lost_levels";
  return {
    mode,
    player: makePlayer(lane, isLost),
    spawner: isLost
      ? makeSpawner(LOST_LEVELS_OBSTACLES, LOST_LEVELS_COLLECTIBLES, random)
      : makeSpawner(RUNNER_OBSTACLES, RUNNER_COLLECTIBLES, random),
    entities: [],
    score: 0,
    highScore,
    earnings: 0,
    elapsed: 0,
    flashOverlay: 0,
    inversionTime: 0,
    paused: false,
    over: false,
    horizontalDirection: 0,
    scrollActive: false,
  };
}

// In The Lost Levels you walk yourself, and the world only slides once you
// push against the two-thirds line.
const SCROLL_THRESHOLD = WINDOW_WIDTH * (2 / 3);

function horizontalBounds(player: Player): [number, number] {
  const offsets = LANE_ORDER.map((lane) => LANE_X_OFFSET[lane] ?? 0);
  const left = -Math.max(...offsets) + 16;
  const right = WINDOW_WIDTH - Math.min(...offsets) - player.width - 16;
  return [left, right];
}

// Which way the keys count right now. A rainbow circle flips them.
export function steer(game: Game, controls: Controls): number {
  let direction = 0;
  if (controls.left) direction -= 1;
  if (controls.right) direction += 1;
  if (game.inversionTime > 0) direction *= -1;
  return Math.max(-1, Math.min(1, direction));
}

export function laneChange(game: Game, delta: number): void {
  if (game.paused || game.over) return;
  changeLane(game.player, game.inversionTime > 0 ? -delta : delta);
}

export function pressJump(game: Game): void {
  if (game.paused || game.over) return;
  jump(game.player);
}

interface Collisions {
  obstaclesHit: Entity[];
  scoreGains: number[];
  rainbows: Entity[];
}

function playerFellIntoTrap(player: Player, trap: Entity): boolean {
  const trapRect = rectOf(trap);
  const rect = playerRect(player);
  const horizontalOverlap = !(
    rect.x + rect.width < trapRect.x || rect.x > trapRect.x + trapRect.width
  );
  if (!horizontalOverlap) return false;
  const groundY = LANE_GROUND_Y[trap.lane] ?? 0;
  return player.y > groundY + 4 && player.vy > 0;
}

function resolveCollisions(player: Player, entities: Entity[]): Collisions {
  const result: Collisions = { obstaclesHit: [], scoreGains: [], rainbows: [] };
  const rect = playerRect(player);
  const remaining: Entity[] = [];

  for (const entity of entities) {
    const box = rectOf(entity);

    // An illusion wall has no box: once you're past it, it's gone.
    if (box.width === 0 || box.height === 0) {
      if (entity.tag === "disguised_obstacle" && entity.lane === player.lane && !entity.playerPassed) {
        const wallX = entity.x + (LANE_X_OFFSET[entity.lane] ?? 0);
        const playerX = player.x + (LANE_X_OFFSET[player.lane] ?? 0);
        if (playerX > wallX + entity.width) {
          entity.playerPassed = true;
          continue;
        }
      }
      remaining.push(entity);
      continue;
    }

    if (entity.tag === "trap") {
      remaining.push(entity);
      if (entity.lane === player.lane && playerFellIntoTrap(player, entity)) {
        result.obstaclesHit.push(entity);
      }
      continue;
    }

    if (entity.lane !== player.lane) {
      remaining.push(entity);
      continue;
    }

    if (overlaps(rect, box)) {
      if (entity.tag === "collectible" || entity.tag === "rainbow_circle") {
        if (entity.value > 0) result.scoreGains.push(entity.value);
        if (entity.grantsHeart && player.damageBar === null) gainHeart(player);
        if (entity.tag === "rainbow_circle") result.rainbows.push(entity);
      } else {
        result.obstaclesHit.push(entity);
      }
    } else {
      remaining.push(entity);
    }
  }

  entities.length = 0;
  entities.push(...remaining);
  return result;
}

// Score turns into pocket money for the Dressing Room.
function earningsFor(amount: number): number {
  if (amount >= 1000) return 100;
  if (amount === 500) return 50;
  if (amount === 250) return 25;
  if (amount === 100) return 10;
  return 0;
}

function overTrap(game: Game): boolean {
  const rect = playerRect(game.player);
  return game.entities.some((entity) => {
    if (entity.tag !== "trap" || entity.lane !== game.player.lane) return false;
    const trapRect = rectOf(entity);
    return !(rect.x + rect.width < trapRect.x || rect.x > trapRect.x + trapRect.width);
  });
}

export function step(game: Game, controls: Controls, seconds: number): void {
  if (game.flashOverlay > 0) game.flashOverlay = Math.max(0, game.flashOverlay - seconds);
  if (game.paused || game.over) return;

  game.elapsed += seconds;
  if (game.inversionTime > 0) game.inversionTime = Math.max(0, game.inversionTime - seconds);

  const player = game.player;
  const isLost = game.mode === "lost_levels";

  if (controls.jump) jump(player);

  // Walking is a Lost Levels thing; the runner carries you along itself.
  game.horizontalDirection = isLost ? steer(game, controls) : 0;
  if (isLost && game.horizontalDirection !== 0) {
    const [left, right] = horizontalBounds(player);
    player.x += game.horizontalDirection * PLAYER_HORIZONTAL_SPEED * seconds;
    player.x = Math.max(left, Math.min(right, player.x));
  }

  player.allowGroundSnap = !isLost || !overTrap(game);
  updatePlayer(player, seconds);

  for (const spawned of updateSpawner(game.spawner, seconds, game.entities, player.x)) {
    game.entities.push(spawned);
  }

  game.entities = game.entities.filter((entity) => entity.x > -200);

  if (isLost) {
    // The world only moves when you push forward at the line.
    const playerScreenX = player.x + (LANE_X_OFFSET[player.lane] ?? 0);
    game.scrollActive = game.horizontalDirection > 0 && playerScreenX >= SCROLL_THRESHOLD;
    if (game.scrollActive) {
      for (const entity of game.entities) {
        entity.x -= WORLD_BASE_SPEED * (LANE_SCROLL_SPEED[entity.lane] ?? 1) * seconds;
      }
      player.x = SCROLL_THRESHOLD - (LANE_X_OFFSET[player.lane] ?? 0);
    }
  } else {
    for (const entity of game.entities) {
      entity.x -= WORLD_BASE_SPEED * (LANE_SCROLL_SPEED[entity.lane] ?? 1) * seconds;
    }
  }

  for (const entity of game.entities) {
    updateEntity(entity, seconds, (lane) => LANE_GROUND_Y[lane] ?? 0);
  }

  const collisions = resolveCollisions(player, game.entities);

  for (const rainbow of collisions.rainbows) {
    if (rainbow.tag === "rainbow_circle") game.inversionTime = INVERSION_DURATION;
  }

  for (const amount of collisions.scoreGains) {
    game.score += amount;
    player.score = game.score;
    if (game.score > game.highScore) game.highScore = game.score;
    game.earnings += earningsFor(amount);
  }

  // A hole in the floor is the end of the run, however much health is left.
  const trapHit = collisions.obstaclesHit.find((entity) => entity.tag === "trap");
  if (trapHit) {
    if (player.damageBar) player.damageBar.current = 0;
    else player.hearts = 0;
    game.over = true;
    return;
  }

  if (collisions.obstaclesHit.length > 0) {
    if (player.damageBar) {
      if (player.invulnerableTime <= 0) {
        takeBarDamage(player.damageBar);
        player.invulnerableTime = INVULNERABILITY_TIME;
        player.flashTimer = FLASH_DURATION;
        game.flashOverlay = FLASH_DURATION;
        if (barIsEmpty(player.damageBar)) game.over = true;
      }
    } else {
      const hadInvulnerability = player.invulnerableTime > 0;
      loseHeart(player);
      if (!hadInvulnerability) game.flashOverlay = FLASH_DURATION;
      if (player.hearts <= 0) game.over = true;
    }
  }

  // Standing still down in The Lost Levels patches you back up.
  if (player.damageBar) {
    player.damageBar.regenerating =
      player.onGround && Math.abs(game.horizontalDirection) < 0.01 && !game.over;
    regenerate(player.damageBar, seconds);
  }
}

export const DAMAGE_PER_HIT = DAMAGE_BAR_COLLISION_DAMAGE;
