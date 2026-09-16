// Everything that slides toward you: the things that hurt, and the things worth
// grabbing.

import {
  LANE_BAND_HEIGHT,
  LANE_GROUND_MARGIN,
  LANE_GROUND_Y,
  LANE_X_OFFSET,
  OBSTACLE_TYPE_FULL_SIZE,
  OBSTACLE_TYPE_HIGH,
  OBSTACLE_TYPE_JUMPABLE,
  TRAP_REQUIRED_CLEARANCE,
} from "./constants";

const LANE_ORDER_FIRST = 0;
const LANE_ORDER_LAST = 2;

export type ObstacleKind =
  | "wall"
  | "longWall"
  | "block"
  | "spike"
  | "trap"
  | "movingWall"
  | "disguisedWall";

export type CollectibleKind = "coin" | "dollar" | "diamond" | "mystery" | "heart" | "rainbow";

export type EntityKind = ObstacleKind | CollectibleKind;

export type Tag = "obstacle" | "trap" | "collectible" | "rainbow_circle" | "disguised_obstacle";

export interface Entity {
  kind: EntityKind;
  tag: Tag;
  x: number;
  y: number;
  lane: number;
  width: number;
  height: number;
  value: number;
  grantsHeart: boolean;
  // A disguised wall: one of the three is a fake you can walk through, and it
  // starts flashing halfway to you so you get a hint.
  isIllusion?: boolean;
  spawnX?: number;
  playerXRef?: number;
  flashStarted?: boolean;
  flashTimer?: number;
  playerPassed?: boolean;
  // A moving wall hops to the next lane every cycle.
  direction?: number;
  cycleDuration?: number;
  laneTimer?: number;
  // A trap is a hole in the lane.
  gapWidth?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Shape {
  width: number;
  height: number;
  tag: Tag;
  value: number;
  grantsHeart: boolean;
}

export const SHAPES: Record<EntityKind, Shape> = {
  wall: { width: 40, height: 70, tag: "obstacle", value: 0, grantsHeart: false },
  longWall: { width: 160, height: 70, tag: "obstacle", value: 0, grantsHeart: false },
  block: { width: 40, height: 40, tag: "obstacle", value: 0, grantsHeart: false },
  spike: { width: 28, height: 24, tag: "obstacle", value: 0, grantsHeart: false },
  movingWall: { width: 40, height: 70, tag: "obstacle", value: 0, grantsHeart: false },
  disguisedWall: { width: 40, height: 70, tag: "obstacle", value: 0, grantsHeart: false },
  trap: { width: TRAP_REQUIRED_CLEARANCE, height: LANE_BAND_HEIGHT, tag: "trap", value: 0, grantsHeart: false },
  coin: { width: 16, height: 16, tag: "collectible", value: 100, grantsHeart: false },
  dollar: { width: 16, height: 10, tag: "collectible", value: 250, grantsHeart: false },
  diamond: { width: 28, height: 14, tag: "collectible", value: 500, grantsHeart: false },
  mystery: { width: 12, height: 12, tag: "collectible", value: 1000, grantsHeart: false },
  heart: { width: 20, height: 20, tag: "collectible", value: 0, grantsHeart: true },
  rainbow: { width: 40, height: 40, tag: "rainbow_circle", value: 0, grantsHeart: false },
};

export const OBSTACLE_CLASSIFICATION: Record<string, string> = {
  wall: OBSTACLE_TYPE_FULL_SIZE,
  longWall: OBSTACLE_TYPE_FULL_SIZE,
  trap: OBSTACLE_TYPE_FULL_SIZE,
  movingWall: OBSTACLE_TYPE_FULL_SIZE,
  disguisedWall: OBSTACLE_TYPE_FULL_SIZE,
  block: OBSTACLE_TYPE_JUMPABLE,
  spike: OBSTACLE_TYPE_JUMPABLE,
};

export function classify(kind: EntityKind): string {
  return OBSTACLE_CLASSIFICATION[kind] ?? OBSTACLE_TYPE_HIGH;
}

export function makeEntity(kind: EntityKind, x: number, y: number, lane: number): Entity {
  const shape = SHAPES[kind];
  const entity: Entity = {
    kind,
    tag: shape.tag,
    x,
    y,
    lane,
    width: shape.width,
    height: shape.height,
    value: shape.value,
    grantsHeart: shape.grantsHeart,
  };
  if (kind === "trap") entity.gapWidth = TRAP_REQUIRED_CLEARANCE;
  if (kind === "movingWall") {
    entity.direction = Math.random() < 0.5 ? -1 : 1;
    entity.cycleDuration = 1.0;
    entity.laneTimer = 0;
  }
  return entity;
}

export function makeDisguisedWall(
  x: number,
  lane: number,
  options: { isIllusion: boolean; spawnX: number; playerXRef: number }
): Entity {
  const wall = makeEntity("disguisedWall", x, LANE_GROUND_Y[lane] ?? 0, lane);
  wall.isIllusion = options.isIllusion;
  wall.spawnX = options.spawnX;
  wall.playerXRef = options.playerXRef;
  wall.flashStarted = false;
  wall.flashTimer = 0;
  wall.playerPassed = false;
  wall.tag = options.isIllusion ? "disguised_obstacle" : "obstacle";
  return wall;
}

// Where an entity actually sits on screen, for hit tests. An illusion wall has
// no box at all, which is exactly why you can walk through it.
export function rectOf(entity: Entity): Rect {
  const baseX = entity.x + (LANE_X_OFFSET[entity.lane] ?? 0);
  if (entity.kind === "disguisedWall" && entity.isIllusion) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  if (entity.kind === "trap") {
    const topY = entity.y - LANE_BAND_HEIGHT + LANE_GROUND_MARGIN;
    return { x: baseX, y: topY, width: entity.gapWidth ?? entity.width, height: LANE_BAND_HEIGHT };
  }
  if (entity.kind === "coin" || entity.kind === "mystery") {
    const radius = entity.width / 2;
    return { x: baseX - radius, y: entity.y - 2 * radius, width: 2 * radius, height: 2 * radius };
  }
  if (entity.kind === "diamond") {
    const size = entity.width / 2;
    return { x: baseX - size, y: entity.y - size, width: 2 * size, height: size };
  }
  if (entity.kind === "heart") {
    const size = entity.width / 2;
    return { x: baseX - size, y: entity.y - size, width: 2 * size, height: 2 * size };
  }
  if (entity.kind === "rainbow") {
    const radius = entity.width / 2;
    return { x: baseX - radius, y: entity.y - 2 * radius, width: 2 * radius, height: 2 * radius };
  }
  return { x: baseX, y: entity.y - entity.height, width: entity.width, height: entity.height };
}

export function overlaps(a: Rect, b: Rect): boolean {
  if (a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function updateEntity(entity: Entity, seconds: number, laneGroundY: (lane: number) => number): void {
  if (entity.kind === "disguisedWall") {
    if (entity.isIllusion && !entity.flashStarted) {
      const spawnX = entity.spawnX ?? entity.x;
      const halfway = spawnX - (spawnX - (entity.playerXRef ?? 0)) * 0.5;
      if (entity.x <= halfway) {
        entity.flashStarted = true;
        entity.flashTimer = 0;
      }
    }
    if (entity.flashStarted) entity.flashTimer = (entity.flashTimer ?? 0) + seconds;
    return;
  }

  if (entity.kind === "movingWall") {
    entity.laneTimer = (entity.laneTimer ?? 0) + seconds;
    const cycle = entity.cycleDuration ?? 1;
    if (entity.laneTimer >= cycle) {
      entity.laneTimer -= cycle;
      let next = entity.lane + (entity.direction ?? 1);
      const lowest = LANE_ORDER_FIRST;
      const highest = LANE_ORDER_LAST;
      if (next < lowest || next > highest) {
        entity.direction = (entity.direction ?? 1) * -1;
        next = entity.lane + entity.direction;
      }
      entity.lane = next;
      entity.y = laneGroundY(entity.lane);
    }
  }
}
