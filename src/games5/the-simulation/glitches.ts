// The glitches. The moment you see one, run: they walk straight at you and they
// can walk up steps, but they can't climb a ladder, so up a ladder is the one
// place you're safe.

import { moveWalker, type Player } from "./player";
import { blockAt, isSolid, type Spot, type World } from "./world";

export const GLITCH_HEIGHT = 1.9;
export const GLITCH_GRAVITY = 20;
// How close it has to get to catch you.
export const CATCH_RANGE = 0.8;

export interface Glitch extends Spot {
  speed: number;
  fallSpeed: number;
  onGround: boolean;
}

export function newGlitch(spot: Spot, speed = 3.1): Glitch {
  return { x: spot.x, y: spot.y, z: spot.z, speed, fallSpeed: 0, onGround: true };
}

export function updateGlitch(world: World, glitch: Glitch, player: Player, dt: number): void {
  const awayX = player.x - glitch.x;
  const awayZ = player.z - glitch.z;
  const away = Math.hypot(awayX, awayZ);
  if (away > 0.001) {
    const step = glitch.speed * dt;
    moveWalker(world, glitch, (awayX / away) * step, (awayZ / away) * step, glitch.onGround);
  }

  // It falls like you do, but it can never climb: ladders are just air to it.
  glitch.fallSpeed -= GLITCH_GRAVITY * dt;
  const nextY = glitch.y + glitch.fallSpeed * dt;
  if (!isSolid(blockAt(world, Math.floor(glitch.x), Math.floor(nextY), Math.floor(glitch.z)))) {
    glitch.y = nextY;
    glitch.onGround = false;
  } else {
    glitch.y = Math.floor(nextY) + 1;
    glitch.fallSpeed = 0;
    glitch.onGround = true;
  }
}

// Has it got you? It has to be beside you and at about your height, so standing
// on a roof or up a ladder keeps you out of reach.
export function hasCaught(glitch: Glitch, player: Player): boolean {
  const flat = Math.hypot(player.x - glitch.x, player.z - glitch.z);
  return flat < CATCH_RANGE && Math.abs(player.y - glitch.y) < 1.4;
}
