// The glitches. The moment you see one, run. There are four kinds, and not one
// of them can climb a ladder, so up a ladder is the one place you're safe.

import { blocked, moveWalker, type Player } from "./player";
import { blockAt, isSolid, type Spot, type World } from "./world";

export type GlitchKind = "stalker" | "stopframe" | "flicker" | "mimic";

// What the glitch index says about each one, once you've seen it.
export const GLITCH_INFO: Record<GlitchKind, { name: string; bio: string }> = {
  stalker: {
    name: "STALKER",
    bio: "Walks straight at you and never stops. Slower than you are, so keep moving.",
  },
  stopframe: {
    name: "STOPFRAME",
    bio: "Can't move at all while you're looking at it. Look away and it's faster than you.",
  },
  flicker: {
    name: "FLICKER",
    bio: "Hardly walks. Every second and a half it blinks a few blocks closer to you.",
  },
  mimic: {
    name: "MIMIC",
    bio: "Sits still pretending to be a glitch fragment. Come close and it stops pretending.",
  },
};
export const GLITCH_KINDS: GlitchKind[] = ["stalker", "stopframe", "flicker", "mimic"];

export const GLITCH_HEIGHT = 1.9;
export const GLITCH_GRAVITY = 20;
// How close one has to get to catch you.
export const CATCH_RANGE = 0.8;
// How close you have to be before a mimic stops pretending to be a fragment.
export const MIMIC_REVEAL_RANGE = 5;
// How often a flicker blinks, and how far it gets each time.
export const BLINK_EVERY_MS = 1500;
export const BLINK_DISTANCE = 3.5;

// You walk at 4.6. A stopframe is faster than you, but only while you're not
// looking; a mimic is a whisker slower; the others you can outrun easily.
export const SPEEDS: Record<GlitchKind, number> = {
  stalker: 2.6,
  stopframe: 5.2,
  flicker: 1.1,
  mimic: 4.2,
};

export interface Glitch extends Spot {
  kind: GlitchKind;
  speed: number;
  fallSpeed: number;
  onGround: boolean;
  // A stopframe you are looking at: holding perfectly still.
  frozen: boolean;
  // A mimic still pretending to be a fragment.
  hiding: boolean;
  // When a flicker next blinks, on the game's clock.
  blinkAt: number;
}

export function newGlitch(spot: Spot, kind: GlitchKind = "stalker"): Glitch {
  return {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    kind,
    speed: SPEEDS[kind],
    fallSpeed: 0,
    onGround: true,
    frozen: false,
    hiding: kind === "mimic",
    blinkAt: 0,
  };
}

export const flatDistance = (one: Spot, other: Spot): number => Math.hypot(one.x - other.x, one.z - other.z);

function walkToward(world: World, glitch: Glitch, player: Player, dt: number): void {
  const awayX = player.x - glitch.x;
  const awayZ = player.z - glitch.z;
  const away = Math.hypot(awayX, awayZ);
  if (away < 0.001) return;
  const step = glitch.speed * dt;
  moveWalker(world, glitch, (awayX / away) * step, (awayZ / away) * step, glitch.onGround);
}

// A flicker jumps a few blocks closer, but only to somewhere it could have
// walked to: standing on something, with room for it, and never more than one
// step higher, so it can't blink its way up a ladder either.
function blinkCloser(world: World, glitch: Glitch, player: Player): void {
  const awayX = player.x - glitch.x;
  const awayZ = player.z - glitch.z;
  const away = Math.hypot(awayX, awayZ);
  if (away < 0.001) return;
  const toX = glitch.x + (awayX / away) * Math.min(BLINK_DISTANCE, away - 0.5);
  const toZ = glitch.z + (awayZ / away) * Math.min(BLINK_DISTANCE, away - 0.5);

  for (const height of [glitch.y + 1, glitch.y, glitch.y - 1, glitch.y - 2]) {
    if (height < 0) continue;
    if (blocked(world, toX, height, toZ, GLITCH_HEIGHT)) continue;
    if (!isSolid(blockAt(world, Math.floor(toX), Math.floor(height) - 1, Math.floor(toZ)))) continue;
    glitch.x = toX;
    glitch.z = toZ;
    glitch.y = height;
    glitch.fallSpeed = 0;
    return;
  }
}

// `seen` is whether you're looking right at it, which is all a stopframe cares about.
export function updateGlitch(
  world: World,
  glitch: Glitch,
  player: Player,
  dt: number,
  now: number,
  seen: boolean
): void {
  glitch.frozen = false;

  switch (glitch.kind) {
    case "stopframe":
      // A stopframe can't move at all while it's being watched.
      if (seen) glitch.frozen = true;
      else walkToward(world, glitch, player, dt);
      break;

    case "mimic":
      // It sits there looking like a fragment until you come too close.
      if (glitch.hiding && flatDistance(glitch, player) > MIMIC_REVEAL_RANGE) break;
      glitch.hiding = false;
      walkToward(world, glitch, player, dt);
      break;

    case "flicker":
      walkToward(world, glitch, player, dt);
      if (now >= glitch.blinkAt) {
        if (glitch.blinkAt > 0) blinkCloser(world, glitch, player);
        glitch.blinkAt = now + BLINK_EVERY_MS;
      }
      break;

    default:
      walkToward(world, glitch, player, dt);
  }

  // They all fall, and none of them can climb: a ladder is just air to them.
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
// up a ladder keeps you out of reach. A mimic that's still pretending is harmless.
export function hasCaught(glitch: Glitch, player: Player): boolean {
  if (glitch.hiding) return false;
  return flatDistance(glitch, player) < CATCH_RANGE && Math.abs(player.y - glitch.y) < 1.4;
}
