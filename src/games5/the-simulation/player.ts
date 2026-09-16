// Walking around The Simulation: gravity, jumping, bumping into blocks,
// stepping up stairs, and climbing ladders (the only place a glitch can't follow).

import { blockAt, isLadder, isSolid, type Spot, type World } from "./world";

export const HEIGHT = 1.8;
export const EYE = 1.62;
export const RADIUS = 0.3;
export const WALK_SPEED = 4.6;
export const CLIMB_SPEED = 3.4;
export const JUMP_SPEED = 7.6;
export const GRAVITY = 20;
// How tall a step you can walk straight up, so stairs work but walls don't.
export const STEP_UP = 1.02;

export interface Player extends Spot {
  yaw: number;
  pitch: number;
  fallSpeed: number;
  onGround: boolean;
  climbing: boolean;
  fragments: number;
  blue: number;
}

export interface Input {
  // -1 back, 1 forward.
  forward: number;
  // -1 left, 1 right.
  strafe: number;
  up: boolean;
  down: boolean;
}

export function newPlayer(spawn: Spot): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: 0,
    pitch: 0,
    fallSpeed: 0,
    onGround: true,
    climbing: false,
    fragments: 0,
    blue: 0,
  };
}

// Which way you're facing, from your yaw.
export const facing = (yaw: number): { x: number; z: number } => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

// Is a body this wide and this tall, standing here, inside a block?
export function blocked(world: World, x: number, y: number, z: number, height = HEIGHT, radius = RADIUS): boolean {
  const lowest = Math.floor(y);
  const highest = Math.floor(y + height - 0.000001);
  for (let by = lowest; by <= highest; by += 1) {
    for (const bx of [Math.floor(x - radius), Math.floor(x + radius)]) {
      for (const bz of [Math.floor(z - radius), Math.floor(z + radius)]) {
        if (isSolid(blockAt(world, bx, by, bz))) return true;
      }
    }
  }
  return false;
}

// Standing in or against a ladder.
export function atLadder(world: World, x: number, y: number, z: number, height = HEIGHT): boolean {
  const lowest = Math.floor(y);
  const highest = Math.floor(y + height - 0.000001);
  for (let by = lowest; by <= highest; by += 1) {
    for (const bx of [Math.floor(x - RADIUS - 0.2), Math.floor(x + RADIUS + 0.2)]) {
      for (const bz of [Math.floor(z - RADIUS - 0.2), Math.floor(z + RADIUS + 0.2)]) {
        if (isLadder(blockAt(world, bx, by, bz))) return true;
      }
    }
  }
  return false;
}

// Slides along walls, and walks up a step instead of stopping dead at it.
function moveOneWay(world: World, body: Spot, dx: number, dz: number, onGround: boolean): boolean {
  if (!blocked(world, body.x + dx, body.y, body.z + dz)) {
    body.x += dx;
    body.z += dz;
    return true;
  }
  if (onGround && !blocked(world, body.x + dx, body.y + STEP_UP, body.z + dz)) {
    body.x += dx;
    body.z += dz;
    body.y += STEP_UP;
    return true;
  }
  return false;
}

export function moveWalker(world: World, body: Spot, dx: number, dz: number, onGround: boolean): void {
  moveOneWay(world, body, dx, 0, onGround);
  moveOneWay(world, body, 0, dz, onGround);
}

export function updatePlayer(world: World, player: Player, input: Input, dt: number): void {
  const look = facing(player.yaw);
  const dx = (input.forward * look.x + input.strafe * look.z) * WALK_SPEED * dt;
  const dz = (input.forward * look.z - input.strafe * look.x) * WALK_SPEED * dt;
  moveWalker(world, player, dx, dz, player.onGround);

  player.climbing = atLadder(world, player.x, player.y, player.z);
  if (player.climbing) {
    // On a ladder you go straight up or down, and gravity lets go of you.
    player.fallSpeed = input.up ? CLIMB_SPEED : input.down || input.forward < 0 ? -CLIMB_SPEED : 0;
  } else {
    if (player.onGround && input.up) player.fallSpeed = JUMP_SPEED;
    else player.fallSpeed -= GRAVITY * dt;
  }

  const nextY = player.y + player.fallSpeed * dt;
  if (!blocked(world, player.x, nextY, player.z)) {
    player.y = nextY;
    player.onGround = false;
  } else if (player.fallSpeed <= 0) {
    // Landed: stand on top of whatever stopped you.
    player.y = Math.floor(nextY) + 1;
    player.fallSpeed = 0;
    player.onGround = true;
  } else {
    // Bonked your head.
    player.fallSpeed = 0;
  }
}
