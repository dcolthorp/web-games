// The jumper: three hearts in the runner, a damage bar in The Lost Levels.

import {
  DAMAGE_BAR_COLLISION_DAMAGE,
  DAMAGE_BAR_MAX_VALUE,
  DAMAGE_BAR_REGEN_RATE_PER_SECOND,
  FLASH_DURATION,
  GRAVITY,
  INVULNERABILITY_TIME,
  JUMP_VELOCITY,
  LANE_GROUND_Y,
  LANE_ORDER,
  LANE_X_OFFSET,
  MAX_HEARTS,
  STARTING_HEARTS,
} from "./constants";
import type { Rect } from "./entities";

export interface DamageBar {
  max: number;
  current: number;
  regenerating: boolean;
}

export interface Player {
  x: number;
  y: number;
  lane: number;
  vy: number;
  onGround: boolean;
  hearts: number;
  score: number;
  invulnerableTime: number;
  flashTimer: number;
  animationTime: number;
  // Standing over a hole means no ground to snap to.
  allowGroundSnap: boolean;
  damageBar: DamageBar | null;
  width: number;
  height: number;
}

export const PLAYER_WIDTH = 36;
export const PLAYER_HEIGHT = 48;

export function makeDamageBar(): DamageBar {
  return { max: DAMAGE_BAR_MAX_VALUE, current: DAMAGE_BAR_MAX_VALUE, regenerating: false };
}

export function makePlayer(lane: number, withDamageBar: boolean): Player {
  return {
    x: 160,
    y: LANE_GROUND_Y[lane] ?? 0,
    lane,
    vy: 0,
    onGround: true,
    hearts: STARTING_HEARTS,
    score: 0,
    invulnerableTime: 0,
    flashTimer: 0,
    animationTime: 0,
    allowGroundSnap: true,
    damageBar: withDamageBar ? makeDamageBar() : null,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}

export function clampLane(lane: number): number {
  const first = LANE_ORDER[0];
  const last = LANE_ORDER[LANE_ORDER.length - 1] ?? first;
  if (lane < first) return first;
  if (lane > last) return last;
  return lane;
}

export function jump(player: Player): void {
  if (!player.onGround) return;
  player.vy = JUMP_VELOCITY;
  player.onGround = false;
}

export function changeLane(player: Player, delta: number): void {
  const target = clampLane(player.lane + delta);
  if (target === player.lane) return;
  player.lane = target;
  player.y = LANE_GROUND_Y[target] ?? player.y;
  if (player.vy > 0) player.vy = 0;
}

export function updatePlayer(player: Player, seconds: number): void {
  if (player.invulnerableTime > 0) {
    player.invulnerableTime = Math.max(0, player.invulnerableTime - seconds);
  }
  if (player.flashTimer > 0) player.flashTimer = Math.max(0, player.flashTimer - seconds);
  player.animationTime += seconds;

  player.vy += GRAVITY * seconds;
  player.y += player.vy * seconds;

  const groundY = LANE_GROUND_Y[player.lane] ?? 0;
  if (player.y >= groundY && player.allowGroundSnap) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
}

export function playerRect(player: Player): Rect {
  const baseX = player.x + (LANE_X_OFFSET[player.lane] ?? 0);
  return { x: baseX, y: player.y - player.height, width: player.width, height: player.height };
}

export function loseHeart(player: Player): void {
  if (player.invulnerableTime > 0) return;
  if (player.hearts > 0) player.hearts -= 1;
  player.invulnerableTime = INVULNERABILITY_TIME;
  player.flashTimer = FLASH_DURATION;
}

export function gainHeart(player: Player): boolean {
  const before = player.hearts;
  player.hearts = Math.min(player.hearts + 1, MAX_HEARTS);
  return player.hearts > before;
}

export function takeBarDamage(bar: DamageBar): void {
  bar.current = Math.max(0, bar.current - DAMAGE_BAR_COLLISION_DAMAGE);
}

export function regenerate(bar: DamageBar, seconds: number): void {
  if (!bar.regenerating || bar.current >= bar.max) return;
  bar.current = Math.min(bar.max, bar.current + DAMAGE_BAR_REGEN_RATE_PER_SECOND * seconds);
}

export const barIsEmpty = (bar: DamageBar): boolean => bar.current <= 0;
