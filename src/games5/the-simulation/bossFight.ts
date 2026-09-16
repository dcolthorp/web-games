// The final boss: THE WHOLE, the thing your glitch fragments were part of. It
// takes a turn at being each kind of glitch, and the only time it can be hurt
// is while it's frozen — which only happens when you look straight at it during
// its watching turn. Shards of the forged crystal are what you hurt it with.

import { GLITCH_KINDS, type GlitchKind } from "./glitches";
import { EYE, blocked, moveWalker, type Player } from "./player";
import {
  ARENA_HEIGHT,
  LADDER,
  PLAIN,
  blockAt,
  isSolid,
  makeWorld,
  setBlock,
  type Arena,
  type Spot,
  type World,
} from "./world";

export const BOSS_HEALTH = 5;
// How long it stays as one kind of glitch before turning into the next.
export const PHASE_MS = 9000;
export const BOSS_HEIGHT = 3.4;
export const BOSS_CATCH_RANGE = 1.5;
export const BOSS_GRAVITY = 20;
export const BOSS_BLINK_MS = 1200;
export const BOSS_BLINK_DISTANCE = 5;
// How long a ladder holds you before it turns black and falls away.
export const LADDER_HOLDS_MS = 4000;
export const SHARD_SPEED = 24;
export const SHARD_LIFE_MS = 1600;
export const SHARD_HIT_RANGE = 1.8;
// You walk at 4.6. Only its watching turn is faster than you, and that's the
// turn where looking at it stops it dead.
export const BOSS_SPEEDS: Record<GlitchKind, number> = {
  stalker: 3.2,
  stopframe: 6,
  flicker: 1.4,
  mimic: 4.4,
};

export const PHASE_NAMES: Record<GlitchKind, string> = {
  stalker: "IT'S STALKING YOU",
  stopframe: "IT'S WATCHING — LOOK AT IT",
  flicker: "IT'S FLICKERING",
  mimic: "IT'S PRETENDING",
};

export interface Boss extends Spot {
  phase: GlitchKind;
  phaseFrom: number;
  health: number;
  // Held still because you're looking at it during its watching turn. The only
  // time a shard does anything.
  frozen: boolean;
  fallSpeed: number;
  onGround: boolean;
  hurtAt: number;
  blinkAt: number;
}

export interface Shard extends Spot {
  vx: number;
  vy: number;
  vz: number;
  bornAt: number;
}

// The boss's room: a walled square with four pillars, each with a ladder up it.
// The ladders are your only rest, and it takes them away.
export function makeBossArena(size = 30): Arena {
  const world = makeWorld(size, ARENA_HEIGHT, size);
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      setBlock(world, x, 0, z, PLAIN);
      const onEdge = x === 0 || z === 0 || x === size - 1 || z === size - 1;
      if (!onEdge) continue;
      for (let y = 1; y <= 8; y += 1) setBlock(world, x, y, z, PLAIN);
    }
  }

  const inset = Math.round(size * 0.24);
  for (const [cornerX, cornerZ] of [
    [inset, inset],
    [size - inset - 3, inset],
    [inset, size - inset - 3],
    [size - inset - 3, size - inset - 3],
  ] as const) {
    for (let x = cornerX; x < cornerX + 3; x += 1) {
      for (let z = cornerZ; z < cornerZ + 3; z += 1) {
        for (let y = 1; y <= 5; y += 1) setBlock(world, x, y, z, PLAIN);
      }
    }
    for (let y = 1; y <= 5; y += 1) setBlock(world, cornerX + 1, y, cornerZ - 1, LADDER);
  }

  const middle = Math.floor(size / 2);
  return { world, fragments: [], spawn: { x: middle + 0.5, y: 1, z: 4.5 } };
}

export function newBoss(spot: Spot, now: number): Boss {
  return {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    phase: "stalker",
    phaseFrom: now,
    health: BOSS_HEALTH,
    frozen: false,
    fallSpeed: 0,
    onGround: true,
    hurtAt: -Infinity,
    blinkAt: 0,
  };
}

// Which turn it's taking: they come round in order, and each hit makes the turns
// come quicker.
export function phaseFor(boss: Boss, now: number): GlitchKind {
  const hurried = PHASE_MS * (0.6 + 0.4 * (boss.health / BOSS_HEALTH));
  if (now - boss.phaseFrom < hurried) return boss.phase;
  const next = GLITCH_KINDS[(GLITCH_KINDS.indexOf(boss.phase) + 1) % GLITCH_KINDS.length] ?? "stalker";
  boss.phase = next;
  boss.phaseFrom = now;
  boss.blinkAt = now + BOSS_BLINK_MS;
  return next;
}

function walkToward(world: World, boss: Boss, player: Player, dt: number, speed: number): void {
  const awayX = player.x - boss.x;
  const awayZ = player.z - boss.z;
  const away = Math.hypot(awayX, awayZ);
  if (away < 0.001) return;
  const step = speed * dt;
  moveWalker(world, boss, (awayX / away) * step, (awayZ / away) * step, boss.onGround);
}

function blinkCloser(world: World, boss: Boss, player: Player): void {
  const awayX = player.x - boss.x;
  const awayZ = player.z - boss.z;
  const away = Math.hypot(awayX, awayZ);
  if (away < 0.001) return;
  const reach = Math.min(BOSS_BLINK_DISTANCE, Math.max(0, away - 1.5));
  const toX = boss.x + (awayX / away) * reach;
  const toZ = boss.z + (awayZ / away) * reach;
  for (const height of [boss.y + 1, boss.y, boss.y - 1, boss.y - 2]) {
    if (height < 0) continue;
    if (blocked(world, toX, height, toZ, BOSS_HEIGHT, 0.6)) continue;
    if (!isSolid(blockAt(world, Math.floor(toX), Math.floor(height) - 1, Math.floor(toZ)))) continue;
    boss.x = toX;
    boss.z = toZ;
    boss.y = height;
    boss.fallSpeed = 0;
    return;
  }
}

export function updateBoss(world: World, boss: Boss, player: Player, dt: number, now: number, seen: boolean): void {
  const phase = phaseFor(boss, now);
  boss.frozen = phase === "stopframe" && seen;

  if (!boss.frozen) {
    walkToward(world, boss, player, dt, BOSS_SPEEDS[phase]);
    if (phase === "flicker" && now >= boss.blinkAt) {
      blinkCloser(world, boss, player);
      boss.blinkAt = now + BOSS_BLINK_MS;
    }
  }

  // It falls like everything else, and like everything else it can't climb.
  boss.fallSpeed -= BOSS_GRAVITY * dt;
  const nextY = boss.y + boss.fallSpeed * dt;
  if (!isSolid(blockAt(world, Math.floor(boss.x), Math.floor(nextY), Math.floor(boss.z)))) {
    boss.y = nextY;
    boss.onGround = false;
  } else {
    boss.y = Math.floor(nextY) + 1;
    boss.fallSpeed = 0;
    boss.onGround = true;
  }
}

export function bossHasCaught(boss: Boss, player: Player): boolean {
  const flat = Math.hypot(player.x - boss.x, player.z - boss.z);
  return flat < BOSS_CATCH_RANGE && Math.abs(player.y - boss.y) < 2.4;
}

// A shard of the forged crystal, thrown from where you're looking.
export function throwShard(player: Player, now: number): Shard {
  const aim = {
    x: Math.sin(player.yaw) * Math.cos(player.pitch),
    y: Math.sin(player.pitch),
    z: Math.cos(player.yaw) * Math.cos(player.pitch),
  };
  return {
    x: player.x + aim.x,
    y: player.y + EYE + aim.y,
    z: player.z + aim.z,
    vx: aim.x * SHARD_SPEED,
    vy: aim.y * SHARD_SPEED,
    vz: aim.z * SHARD_SPEED,
    bornAt: now,
  };
}

export interface ShardResult {
  shards: Shard[];
  // Shards that hit while it was frozen: those are the ones that hurt it.
  hits: number;
  // Shards that bounced off it while it wasn't.
  bounces: number;
}

export function updateShards(world: World, shards: Shard[], boss: Boss, dt: number, now: number): ShardResult {
  let hits = 0;
  let bounces = 0;
  const left: Shard[] = [];

  for (const shard of shards) {
    shard.x += shard.vx * dt;
    shard.y += shard.vy * dt;
    shard.z += shard.vz * dt;
    // They fly nearly straight, with the smallest droop.
    shard.vy -= 3 * dt;

    const away = Math.hypot(shard.x - boss.x, shard.y - (boss.y + BOSS_HEIGHT / 2), shard.z - boss.z);
    if (away < SHARD_HIT_RANGE) {
      if (boss.frozen) {
        hits += 1;
        boss.health = Math.max(0, boss.health - 1);
        boss.hurtAt = now;
      } else {
        bounces += 1;
      }
      continue;
    }

    if (isSolid(blockAt(world, Math.floor(shard.x), Math.floor(shard.y), Math.floor(shard.z)))) continue;
    if (now - shard.bornAt > SHARD_LIFE_MS) continue;
    left.push(shard);
  }

  return { shards: left, hits, bounces };
}

// The boss takes your ladder away if you hang about on it: the rungs go black
// and fall, one from the bottom up.
export function rotLadder(world: World, player: Player, climbingSince: number, now: number): boolean {
  if (climbingSince === 0 || now - climbingSince < LADDER_HOLDS_MS) return false;
  const x = Math.floor(player.x);
  const z = Math.floor(player.z);
  for (const [dx, dz] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    for (let y = 0; y < ARENA_HEIGHT; y += 1) {
      if (blockAt(world, x + dx, y, z + dz) !== LADDER) continue;
      setBlock(world, x + dx, y, z + dz, 0);
      return true;
    }
  }
  return false;
}
