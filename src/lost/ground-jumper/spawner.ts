// The spawner is the part that tries not to be unfair: before it drops
// something in a lane it checks that at least one lane is still survivable by
// the time it reaches you, and that you'd have runway to jump it.

import {
  DIFFICULTY_RAMP,
  LANE_GROUND_Y,
  LANE_ORDER,
  LANE_SCROLL_SPEED,
  LOOKAHEAD_FLOOR_EASY,
  LOOKAHEAD_FLOOR_HARD,
  LOOKAHEAD_FLOOR_MEDIUM,
  MAX_SPAWN_INTERVAL,
  MIN_RUNWAY_EASY,
  MIN_RUNWAY_HARD,
  MIN_RUNWAY_MEDIUM,
  MIN_SPAWN_INTERVAL,
  OBSTACLE_TYPE_FULL_SIZE,
  OBSTACLE_TYPE_JUMPABLE,
  WINDOW_WIDTH,
  WORLD_BASE_SPEED,
} from "./constants";
import {
  classify,
  makeDisguisedWall,
  makeEntity,
  overlaps,
  rectOf,
  type CollectibleKind,
  type Entity,
  type EntityKind,
  type ObstacleKind,
} from "./entities";

export interface SpawnDefinition {
  kind: EntityKind;
  weight: number;
  // The disguised walls come in a set of three, not one at a time.
  spawnSet?: "disguised_wall";
}

export interface Spawner {
  timeSinceLast: number;
  interval: number;
  difficulty: number;
  obstacles: SpawnDefinition[];
  collectibles: SpawnDefinition[];
  random: () => number;
}

export const RUNNER_OBSTACLES: SpawnDefinition[] = [
  { kind: "wall", weight: 1 },
  { kind: "longWall", weight: 1 },
  { kind: "block", weight: 1 },
  { kind: "spike", weight: 1 },
];

export const RUNNER_COLLECTIBLES: SpawnDefinition[] = [
  { kind: "heart", weight: 0.12 },
  { kind: "coin", weight: 0.59 },
  { kind: "dollar", weight: 0.23 },
  { kind: "diamond", weight: 0.12 },
  { kind: "mystery", weight: 0.06 },
];

export const LOST_LEVELS_OBSTACLES: SpawnDefinition[] = [
  { kind: "wall", weight: 1 },
  { kind: "longWall", weight: 1 },
  { kind: "block", weight: 1 },
  { kind: "spike", weight: 1 },
  { kind: "disguisedWall", weight: 0.6, spawnSet: "disguised_wall" },
  { kind: "trap", weight: 0.8 },
  { kind: "movingWall", weight: 0.7 },
];

// No hearts down here — The Lost Levels give you a bar instead.
export const LOST_LEVELS_COLLECTIBLES: SpawnDefinition[] = [
  { kind: "coin", weight: 0.59 },
  { kind: "dollar", weight: 0.23 },
  { kind: "diamond", weight: 0.12 },
  { kind: "mystery", weight: 0.06 },
  { kind: "rainbow", weight: 0.08 },
];

export function makeSpawner(
  obstacles: SpawnDefinition[],
  collectibles: SpawnDefinition[],
  random: () => number = Math.random
): Spawner {
  return {
    timeSinceLast: 0,
    interval: MAX_SPAWN_INTERVAL,
    difficulty: 0,
    obstacles,
    collectibles,
    random,
  };
}

const SPAWN_X = WINDOW_WIDTH + 80;

function lookaheadFloor(difficulty: number): number {
  if (difficulty < 0.33) return LOOKAHEAD_FLOOR_EASY;
  if (difficulty < 0.67) return LOOKAHEAD_FLOOR_MEDIUM;
  return LOOKAHEAD_FLOOR_HARD;
}

function minRunway(difficulty: number): number {
  if (difficulty < 0.33) return MIN_RUNWAY_EASY;
  if (difficulty < 0.67) return MIN_RUNWAY_MEDIUM;
  return MIN_RUNWAY_HARD;
}

// How long until this thing reaches where you're standing.
export function arrivalTime(entity: Entity, playerX: number): number {
  if (entity.x <= playerX) return 0;
  const speed = WORLD_BASE_SPEED * (LANE_SCROLL_SPEED[entity.lane] ?? 1);
  return speed > 0 ? (entity.x - playerX) / speed : 999;
}

export function laneIsSafeAtArrival(
  spawner: Spawner,
  entities: Entity[],
  playerX: number,
  lane: number,
  candidate: Entity | null
): boolean {
  const horizon = Math.max(
    lookaheadFloor(spawner.difficulty),
    candidate ? arrivalTime(candidate, playerX) : 0
  );
  const runway = minRunway(spawner.difficulty);

  const inLane = entities.filter((e) => e.tag === "obstacle" && e.lane === lane);
  if (candidate && candidate.tag === "obstacle" && candidate.lane === lane) inLane.push(candidate);

  for (const obstacle of inLane) {
    const arrival = arrivalTime(obstacle, playerX);
    if (arrival > horizon) continue;
    const type = classify(obstacle.kind);
    if (type === OBSTACLE_TYPE_FULL_SIZE) return false;
    if (type === OBSTACLE_TYPE_JUMPABLE && arrival < runway) return false;
  }
  return true;
}

function hasSafeLane(
  spawner: Spawner,
  entities: Entity[],
  playerX: number,
  candidate: Entity | null
): boolean {
  return LANE_ORDER.some((lane) => laneIsSafeAtArrival(spawner, entities, playerX, lane, candidate));
}

function collidesWithSomething(entities: Entity[], candidate: Entity): boolean {
  const box = rectOf(candidate);
  return entities.some((entity) => entity.lane === candidate.lane && overlaps(box, rectOf(entity)));
}

function chooseDefinition(spawner: Spawner, definitions: SpawnDefinition[]): SpawnDefinition {
  const last = definitions[definitions.length - 1] as SpawnDefinition;
  const total = definitions.reduce((sum, defn) => sum + Math.max(defn.weight, 0), 0);
  if (total <= 0) return last;
  const pick = spawner.random() * total;
  let running = 0;
  for (const defn of definitions) {
    running += Math.max(defn.weight, 0);
    if (pick <= running) return defn;
  }
  return last;
}

const randomLane = (spawner: Spawner): number =>
  LANE_ORDER[Math.floor(spawner.random() * LANE_ORDER.length)] ?? 1;

// Collectibles float at different heights, so a mystery takes a real jump.
function collectibleHeight(lane: number, kind: CollectibleKind): number {
  const base = LANE_GROUND_Y[lane] ?? 0;
  if (kind === "heart") return base - 40;
  if (kind === "diamond") return base - 48;
  if (kind === "mystery") return base - 70;
  if (kind === "dollar") return base - 32;
  if (kind === "rainbow") return base - 60;
  return base - 28;
}

function spawnDisguisedWallSet(spawner: Spawner, entities: Entity[], playerX: number): Entity[] | null {
  const lanes = [...LANE_ORDER];
  const order = [...lanes].sort(() => spawner.random() - 0.5);

  for (const illusionLane of order) {
    const walls: Entity[] = [];
    let valid = true;
    for (const lane of lanes) {
      const wall = makeDisguisedWall(SPAWN_X, lane, {
        isIllusion: lane === illusionLane,
        spawnX: SPAWN_X,
        playerXRef: playerX,
      });
      if (wall.isIllusion) {
        if (!laneIsSafeAtArrival(spawner, entities, playerX, lane, null)) {
          valid = false;
          break;
        }
      } else {
        if (collidesWithSomething(entities, wall) || !hasSafeLane(spawner, entities, playerX, wall)) {
          valid = false;
          break;
        }
      }
      walls.push(wall);
    }
    if (valid) return walls;
  }
  return null;
}

function trySpawnObstacle(spawner: Spawner, entities: Entity[], playerX: number): Entity[] {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const definition = chooseDefinition(spawner, spawner.obstacles);
    if (definition.spawnSet === "disguised_wall") {
      const walls = spawnDisguisedWallSet(spawner, entities, playerX);
      if (walls) return walls;
      continue;
    }
    const lane = randomLane(spawner);
    const candidate = makeEntity(definition.kind as ObstacleKind, SPAWN_X, LANE_GROUND_Y[lane] ?? 0, lane);
    if (collidesWithSomething(entities, candidate)) continue;
    if (!hasSafeLane(spawner, entities, playerX, candidate)) continue;
    return [candidate];
  }
  return [];
}

function trySpawnCollectible(spawner: Spawner, entities: Entity[], playerX: number): Entity[] {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const lane = randomLane(spawner);
    const definition = chooseDefinition(spawner, spawner.collectibles);
    const kind = definition.kind as CollectibleKind;
    const candidate = makeEntity(kind, SPAWN_X, collectibleHeight(lane, kind), lane);
    if (collidesWithSomething(entities, candidate)) continue;
    if (!laneIsSafeAtArrival(spawner, entities, playerX, lane, null)) continue;
    return [candidate];
  }
  return [];
}

export function updateSpawner(
  spawner: Spawner,
  seconds: number,
  entities: Entity[],
  playerX: number
): Entity[] {
  spawner.difficulty = Math.min(1, spawner.difficulty + seconds * DIFFICULTY_RAMP);
  const target =
    MIN_SPAWN_INTERVAL + (MAX_SPAWN_INTERVAL - MIN_SPAWN_INTERVAL) * (1 - spawner.difficulty);
  spawner.interval += (target - spawner.interval) * 0.1;

  spawner.timeSinceLast += seconds;
  if (spawner.timeSinceLast < spawner.interval) return [];
  spawner.timeSinceLast = 0;

  return spawner.random() < 0.65
    ? trySpawnObstacle(spawner, entities, playerX)
    : trySpawnCollectible(spawner, entities, playerX);
}
