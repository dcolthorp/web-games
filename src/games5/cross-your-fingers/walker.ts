// The little guy: running, jumping, and bumping into the land.

import { TILE, isSolid, isWater, tileAt, type Piece } from "./terrain";

export const WIDTH = 14;
export const HEIGHT = 20;
export const RUN_SPEED = 165;
export const JUMP_SPEED = 355;
export const GRAVITY = 1000;
// A moment of grace after walking off an edge where a jump still works.
export const COYOTE_SECONDS = 0.09;
// In water everything is slower and softer, and holding jump swims you upwards.
export const SWIM_SPEED = 108;
export const WATER_DRAG = 0.68;
export const WATER_GRAVITY = 0.3;
export const SINK_SPEED = 130;

export interface Walker {
  // The middle of the bottom of him, in pixels.
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  sinceGround: number;
  facing: 1 | -1;
  walked: number;
  swimming: boolean;
}

export interface Controls {
  // -1 left, 1 right.
  move: number;
  jump: boolean;
}

export function newWalker(x: number, y: number): Walker {
  return { x, y, vx: 0, vy: 0, onGround: false, sinceGround: 99, facing: 1, walked: 0, swimming: false };
}

// Is he inside the land if he stands here?
export function hitsGround(piece: Piece, x: number, y: number): boolean {
  const left = Math.floor((x - WIDTH / 2) / TILE);
  const right = Math.floor((x + WIDTH / 2 - 0.001) / TILE);
  const top = Math.floor((y - HEIGHT) / TILE);
  const bottom = Math.floor((y - 0.001) / TILE);
  for (let tileX = left; tileX <= right; tileX += 1) {
    for (let tileY = top; tileY <= bottom; tileY += 1) {
      if (isSolid(tileAt(piece, tileX, tileY))) return true;
    }
  }
  return false;
}

// Is he in the water? Judged at his middle, so paddling along the top counts.
export function inWater(piece: Piece, walker: Walker): boolean {
  return isWater(tileAt(piece, Math.floor(walker.x / TILE), Math.floor((walker.y - HEIGHT / 2) / TILE)));
}

export function updateWalker(piece: Piece, walker: Walker, controls: Controls, dt: number): void {
  walker.swimming = inWater(piece, walker);
  walker.vx = controls.move * RUN_SPEED * (walker.swimming ? WATER_DRAG : 1);
  if (controls.move !== 0) walker.facing = controls.move > 0 ? 1 : -1;

  walker.sinceGround = walker.onGround ? 0 : walker.sinceGround + dt;
  if (walker.swimming) {
    // Swimming: hold jump to go up. With your head out of the water that's a
    // proper hop instead, so you can get out onto the land.
    const headOut = !isWater(
      tileAt(piece, Math.floor(walker.x / TILE), Math.floor((walker.y - HEIGHT) / TILE))
    );
    if (controls.jump) walker.vy = headOut ? -JUMP_SPEED * 0.82 : -SWIM_SPEED;
    else walker.vy = Math.min(walker.vy + GRAVITY * WATER_GRAVITY * dt, SINK_SPEED);
  } else {
    if (controls.jump && walker.sinceGround <= COYOTE_SECONDS) {
      walker.vy = -JUMP_SPEED;
      walker.onGround = false;
      walker.sinceGround = 99;
    }
    walker.vy = Math.min(walker.vy + GRAVITY * dt, 900);
  }

  // Sideways first, then up and down, so he slides along walls instead of sticking.
  const wantX = walker.x + walker.vx * dt;
  if (!hitsGround(piece, wantX, walker.y)) {
    walker.walked += Math.abs(wantX - walker.x);
    walker.x = wantX;
  } else if (walker.swimming && !hitsGround(piece, wantX, walker.y - TILE)) {
    // Swimming into the bank: pull yourself up onto it.
    walker.x = wantX;
    walker.y -= TILE;
  } else {
    walker.vx = 0;
  }

  const wantY = walker.y + walker.vy * dt;
  if (!hitsGround(piece, walker.x, wantY)) {
    walker.y = wantY;
    walker.onGround = false;
  } else if (walker.vy > 0) {
    // Landed.
    walker.y = Math.floor(wantY / TILE) * TILE;
    walker.vy = 0;
    walker.onGround = true;
  } else {
    // Head on the ceiling.
    walker.vy = 0;
  }
}
