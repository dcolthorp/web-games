// Police Chase: rooftops that keep going, cops that patrol them until they
// spot you, and chimneys you'd better be sure about before you drop in.
// Ported from kids-games/police_chase.

export const SCREEN_WIDTH = 960;
export const SCREEN_HEIGHT = 540;

export const PLAYER_TARGET_SCREEN_X = Math.trunc(SCREEN_WIDTH * 0.42);
export const PLAYER_LEFT_MARGIN_X = 46;
export const GROUND_Y = Math.trunc(SCREEN_HEIGHT * 0.74);
export const ROOF_THICKNESS = 26;

export const GRAVITY_PX_S2 = 2080;
export const JUMP_VELOCITY_PX_S = 980;
export const MAX_FALL_SPEED_PX_S = 1760;
export const JUMP_HOLD_MAX_S = 0.16;
export const JUMP_HOLD_GRAVITY_SCALE = 0.55;
export const JUMP_CUT_VY_SCALE = 0.35;

export const BASE_RUN_SPEED = 258;
export const MAX_RUN_SPEED = 432;
export const SPEED_RAMP_PX_S2 = 6.5;

export const PLAYER_ACCEL_PX_S2 = 1560;
export const PLAYER_FRICTION_PX_S2 = 1920;

export const COP_CHASE_SPEED_DELTA = 108;
export const COP_CHASE_SPEED_MIN = 96;
export const COP_CHASE_SPEED_MAX = 312;
export const COP_CHASE_TRIGGER_PX = 210;
export const COP_PATROL_SPEED_MIN = 27;
export const COP_PATROL_SPEED_MAX = 48;

export const GEN_AHEAD_PX = 1200;
export const DESPAWN_BEHIND_PX = 300;

export const MIN_ROOF_LEN = 220;
export const MAX_ROOF_LEN = 520;

// Gaps are never wider than you can actually jump.
export const GAP_SAFETY = 0.72;
export const MIN_GAP_LEN = 80;

export const COP_MIN_DISTANCE = 360;
export const COP_BASE_CHANCE_PER_ROOF = 0.55;
export const CHIMNEY_CHANCE_PER_ROOF = 0.42;
export const BONUS_CHIMNEY_CHANCE = 0.16;

export const LOOT_BASE_DENSITY = 0.01;
export const BONUS_DISTANCE = 2200;

export const DISTANCE_SCORE_RATE = 0.06;
export const COIN_VALUE = 1;
export const BAG_VALUE = 10;
export const DIAMOND_VALUE = 100;

export const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const hits = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export interface Roof {
  startX: number;
  endX: number;
  y: number;
}

export interface Chimney {
  x: number;
  y: number;
  w: number;
  h: number;
  isBonus: boolean;
}

export interface Cop {
  x: number;
  y: number;
  vy: number;
  grounded: boolean;
  w: number;
  h: number;
  state: "idle" | "chase";
  patrolSpeed: number;
  patrolDir: number;
}

export type LootKind = "coin" | "bag" | "diamond";

export interface Loot {
  x: number;
  y: number;
  kind: LootKind;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  jumpHold: number;
  w: number;
  h: number;
}

export const playerRect = (player: Player): Rect => ({
  x: player.x - Math.trunc(player.w / 2),
  y: player.y - player.h,
  w: player.w,
  h: player.h,
});

export const copRect = (cop: Cop): Rect => ({
  x: cop.x - Math.trunc(cop.w / 2),
  y: cop.y - cop.h,
  w: cop.w,
  h: cop.h,
});

export const lootRect = (loot: Loot): Rect => ({ x: loot.x - 10, y: loot.y - 10, w: 20, h: 20 });

export const chimneyRect = (chimney: Chimney): Rect => ({
  x: chimney.x,
  y: chimney.y - chimney.h,
  w: chimney.w,
  h: chimney.h,
});

// Only the hole at the top counts as a way in.
export function chimneyOpening(chimney: Chimney): Rect {
  const rect = chimneyRect(chimney);
  return { x: rect.x + 6, y: rect.y + 2, w: rect.w - 12, h: 10 };
}

export function jumpReach(speed: number): number {
  const airTime = (2 * JUMP_VELOCITY_PX_S) / GRAVITY_PX_S2;
  return speed * airTime * GAP_SAFETY;
}

// A seeded random, so a rooftop run can be replayed in a test.
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface World {
  roofs: Roof[];
  cops: Cop[];
  chimneys: Chimney[];
  loot: Loot[];
  lastRoofEnd: number;
  lastCopSpawnX: number;
  random: () => number;
}

export function makeWorld(random: () => number): World {
  return {
    roofs: [],
    cops: [],
    chimneys: [],
    loot: [],
    lastRoofEnd: 0,
    lastCopSpawnX: -1e9,
    random,
  };
}

export function resetWorld(world: World, startX: number, roofY: number): void {
  world.roofs = [{ startX: startX - 400, endX: startX + 700, y: roofY }];
  world.cops = [];
  world.chimneys = [];
  world.loot = [];
  world.lastRoofEnd = startX + 640;
  world.lastCopSpawnX = startX - 1000;
}

const between = (random: () => number, low: number, high: number): number =>
  low + random() * (high - low);

export function roofUnder(world: World, worldX: number, feetY: number): Roof | null {
  for (const roof of world.roofs) {
    if (roof.startX - 2 <= worldX && worldX <= roof.endX + 2 && Math.abs(feetY - roof.y) <= 24) {
      return roof;
    }
  }
  return null;
}

export function roofAtX(world: World, worldX: number): Roof | null {
  for (const roof of world.roofs) {
    if (roof.startX - 2 <= worldX && worldX <= roof.endX + 2) return roof;
  }
  return null;
}

function spawnLootForRoof(
  world: World,
  start: number,
  end: number,
  roofY: number,
  density: number,
  difficulty: number
): void {
  const expected = Math.max(0, end - start) * density;
  const count = Math.trunc(expected) + (world.random() < expected - Math.trunc(expected) ? 1 : 0);
  for (let i = 0; i < count; i += 1) {
    const x = between(world.random, start + 30, end - 30);
    // Most of it hangs in the air where you have to jump for it.
    const y =
      world.random() < 0.7
        ? roofY - between(world.random, 70, 130)
        : roofY - between(world.random, 28, 55);
    const roll = world.random();
    const kind: LootKind =
      roll < Math.max(0.72 - difficulty * 0.06, 0.5)
        ? "coin"
        : roll < Math.max(0.95 - difficulty * 0.03, 0.86)
          ? "bag"
          : "diamond";
    world.loot.push({ x, y, kind });
  }
}

export interface GenerateOptions {
  cameraRight: number;
  playerSpeed: number;
  roofY: number;
  difficulty: number;
  lootDensity?: number;
}

export function ensureAhead(world: World, options: GenerateOptions): void {
  const { cameraRight, playerSpeed, roofY, difficulty } = options;
  const density = options.lootDensity ?? LOOT_BASE_DENSITY;
  const targetEnd = cameraRight + GEN_AHEAD_PX;
  const maxGap = Math.max(MIN_GAP_LEN, Math.min(240 + difficulty * 60, jumpReach(playerSpeed)));

  while (world.lastRoofEnd < targetEnd) {
    const gap = between(world.random, MIN_GAP_LEN, maxGap);
    const start = world.lastRoofEnd + gap;
    const end = start + between(world.random, MIN_ROOF_LEN, MAX_ROOF_LEN);
    world.roofs.push({ startX: start, endX: end, y: roofY });
    world.lastRoofEnd = end;

    if (world.random() < CHIMNEY_CHANCE_PER_ROOF) {
      world.chimneys.push({
        x: between(world.random, start + 60, end - 60),
        y: roofY,
        w: 34,
        h: 52,
        isBonus: world.random() < BONUS_CHIMNEY_CHANCE,
      });
    }

    if (start - world.lastCopSpawnX > COP_MIN_DISTANCE) {
      const chance = Math.min(0.85, COP_BASE_CHANCE_PER_ROOF + difficulty * 0.08);
      if (world.random() < chance) {
        const copX = between(world.random, start + 90, end - 90);
        if (!world.chimneys.some((chimney) => Math.abs(chimney.x - copX) < 60)) {
          world.cops.push({
            x: copX,
            y: roofY,
            vy: 0,
            grounded: true,
            w: 28,
            h: 64,
            state: "idle",
            patrolSpeed: between(world.random, COP_PATROL_SPEED_MIN, COP_PATROL_SPEED_MAX),
            patrolDir: world.random() < 0.5 ? 1 : -1,
          });
          world.lastCopSpawnX = copX;
        }
      }
    }

    spawnLootForRoof(world, start, end, roofY, density, difficulty);
  }
}

export function despawnBehind(world: World, cameraLeft: number): void {
  const cutoff = cameraLeft - DESPAWN_BEHIND_PX;
  world.roofs = world.roofs.filter((roof) => roof.endX >= cutoff);
  world.chimneys = world.chimneys.filter((chimney) => chimney.x + chimney.w >= cutoff);
  world.cops = world.cops.filter((cop) => cop.x + cop.w >= cutoff);
  world.loot = world.loot.filter((item) => item.x >= cutoff);
}

// The bonus run: one long flat roof with loot laid out in patterns.
export interface BonusWorld {
  roofY: number;
  endX: number;
  loot: Loot[];
}

export function makeBonusWorld(): BonusWorld {
  return { roofY: 0, endX: 0, loot: [] };
}

export function resetBonus(bonus: BonusWorld, startX: number, roofY: number, random: () => number): void {
  bonus.roofY = roofY;
  bonus.endX = startX + BONUS_DISTANCE;
  bonus.loot = [];

  let x = startX + 160;
  while (x < bonus.endX - 200) {
    const pattern = random();
    if (pattern < 0.6) {
      for (let i = 0; i < 4; i += 1) bonus.loot.push({ x: x + i * 36, y: roofY - 90, kind: "coin" });
    } else if (pattern < 0.86) {
      bonus.loot.push({ x, y: roofY - 90, kind: "bag" });
      bonus.loot.push({ x: x + 44, y: roofY - 115, kind: "coin" });
      bonus.loot.push({ x: x + 88, y: roofY - 90, kind: "coin" });
    } else {
      bonus.loot.push({ x, y: roofY - 100, kind: "diamond" });
      bonus.loot.push({ x: x + 40, y: roofY - 80, kind: "coin" });
      bonus.loot.push({ x: x + 80, y: roofY - 100, kind: "coin" });
    }
    x += between(random, 150, 240);
  }
}

export const lootValue = (kind: LootKind): number =>
  kind === "coin" ? COIN_VALUE : kind === "bag" ? BAG_VALUE : DIAMOND_VALUE;
