// The Simulation's world: a box you're stuck inside, built out of blocks that
// all look the same, with blue blocks you can pick up, ladders you can climb,
// and glitch fragments to collect.

export const EMPTY = 0;
export const PLAIN = 1;
export const BLUE = 2;
export const LADDER = 3;
// A block a glitch has turned black. It falls away a moment later, and you can
// already fall straight through it.
export const BLACK = 4;

export interface World {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  blocks: Uint8Array;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
}

export const isSolid = (block: number): boolean => block === PLAIN || block === BLUE;
export const isLadder = (block: number): boolean => block === LADDER;

export function makeWorld(sizeX: number, sizeY: number, sizeZ: number): World {
  return { sizeX, sizeY, sizeZ, blocks: new Uint8Array(sizeX * sizeY * sizeZ) };
}

// Outside the world, the floor and the walls go on forever, so there's no way
// out of the box. Above the world is open sky.
export function blockAt(world: World, x: number, y: number, z: number): number {
  if (y < 0) return PLAIN;
  if (y >= world.sizeY) return EMPTY;
  if (x < 0 || z < 0 || x >= world.sizeX || z >= world.sizeZ) return PLAIN;
  return world.blocks[(y * world.sizeZ + z) * world.sizeX + x] ?? EMPTY;
}

export function setBlock(world: World, x: number, y: number, z: number, block: number): void {
  if (x < 0 || y < 0 || z < 0 || x >= world.sizeX || y >= world.sizeY || z >= world.sizeZ) return;
  world.blocks[(y * world.sizeZ + z) * world.sizeX + x] = block;
}

// Is there a clear line from one point to another, or is a block in the way?
export function lineOfSight(world: World, from: Spot, to: Spot): boolean {
  const away = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const steps = Math.ceil(away / 0.25);
  for (let step = 1; step < steps; step += 1) {
    const along = step / steps;
    const x = Math.floor(from.x + (to.x - from.x) * along);
    const y = Math.floor(from.y + (to.y - from.y) * along);
    const z = Math.floor(from.z + (to.z - from.z) * along);
    if (isSolid(blockAt(world, x, y, z))) return false;
  }
  return true;
}

export const solidAt = (world: World, x: number, y: number, z: number): boolean =>
  isSolid(blockAt(world, Math.floor(x), Math.floor(y), Math.floor(z)));

// The same world every time, so a walk through it can be tested.
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Arena {
  world: World;
  fragments: Spot[];
  spawn: Spot;
}

// How wide a map is, from a small one you can cross in a moment to one big
// enough that you'll get lost in it. Bigger than gigantic and a browser just
// gives up, so gigantic is where it stops.
export const ARENA_SIZE = 40;
export const MAP_SIZES = [
  { id: "small", label: "SMALL", size: 26 },
  { id: "medium", label: "MEDIUM", size: 40 },
  { id: "big", label: "BIG", size: 64 },
  { id: "gigantic", label: "GIGANTIC", size: 96 },
] as const;
export type MapSizeId = (typeof MAP_SIZES)[number]["id"];
export const ARENA_HEIGHT = 12;
export const WALL_HEIGHT = 7;
// Enough to have to go looking for them, few enough to actually finish.
export const FRAGMENT_COUNT = 20;

// An empty map: a floor and the walls around it, and nothing else. What you
// build your own map on top of.
export function makeFlatArena(size: number = ARENA_SIZE): Arena {
  const world = makeWorld(size, ARENA_HEIGHT, size);
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      setBlock(world, x, 0, z, PLAIN);
      const onEdge = x === 0 || z === 0 || x === size - 1 || z === size - 1;
      if (!onEdge) continue;
      for (let y = 1; y <= WALL_HEIGHT; y += 1) setBlock(world, x, y, z, PLAIN);
    }
  }
  const middle = Math.floor(size / 2);
  return { world, fragments: [], spawn: { x: middle + 0.5, y: 1, z: middle + 0.5 } };
}

// The highest solid block at this spot, or -1 if there's nothing but floor.
function groundAt(world: World, x: number, z: number): number {
  for (let y = world.sizeY - 1; y >= 0; y -= 1) {
    if (isSolid(blockAt(world, x, y, z))) return y;
  }
  return -1;
}

export function makeArena(seed = 7, size: number = ARENA_SIZE): Arena {
  const world = makeWorld(size, ARENA_HEIGHT, size);
  const random = randomFrom(seed);
  const pick = (from: number, to: number): number => from + Math.floor(random() * (to - from + 1));

  // The floor, and the walls that box you in.
  for (let x = 0; x < size; x += 1) {
    for (let z = 0; z < size; z += 1) {
      setBlock(world, x, 0, z, PLAIN);
      const onEdge = x === 0 || z === 0 || x === size - 1 || z === size - 1;
      if (!onEdge) continue;
      for (let y = 1; y <= WALL_HEIGHT; y += 1) setBlock(world, x, y, z, PLAIN);
    }
  }

  // Towers to climb: some have a ladder up one side, the rest have steps, and
  // a glitch can only follow you up the steps. A bigger map gets more of them.
  const towers = Math.max(6, Math.round((size * size) / 114));
  for (let tower = 0; tower < towers; tower += 1) {
    const width = pick(3, 6);
    const depth = pick(3, 6);
    const height = pick(2, 5);
    const x0 = pick(3, size - 4 - width);
    const z0 = pick(3, size - 4 - depth);
    for (let x = x0; x < x0 + width; x += 1) {
      for (let z = z0; z < z0 + depth; z += 1) {
        for (let y = 1; y <= height; y += 1) setBlock(world, x, y, z, PLAIN);
      }
    }

    if (tower % 2 === 0) {
      // A ladder up the side, with the top rung level with the roof.
      const ladderX = x0 + Math.floor(width / 2);
      const ladderZ = z0 - 1;
      for (let y = 1; y <= height; y += 1) setBlock(world, ladderX, y, ladderZ, LADDER);
    } else {
      // Steps up to the roof, one block higher each time.
      const stepX = x0 + Math.floor(width / 2);
      for (let step = 1; step <= height; step += 1) {
        const z = z0 - (height - step) - 1;
        for (let y = 1; y <= step; y += 1) setBlock(world, stepX, y, z, PLAIN);
      }
    }
  }

  // Blue blocks, sitting around on the floor and on the roofs.
  for (let i = 0; i < towers * 3; i += 1) {
    const x = pick(2, size - 3);
    const z = pick(2, size - 3);
    const ground = groundAt(world, x, z);
    if (ground >= 0 && ground + 1 < ARENA_HEIGHT) setBlock(world, x, ground + 1, z, BLUE);
  }

  // The glitch fragments, floating just above whatever is under them.
  const fragments: Spot[] = [];
  const taken = new Set<string>();
  let tries = 0;
  while (fragments.length < FRAGMENT_COUNT && tries < FRAGMENT_COUNT * 60) {
    tries += 1;
    const x = pick(2, size - 3);
    const z = pick(2, size - 3);
    const ground = groundAt(world, x, z);
    if (ground < 0 || ground + 1 >= ARENA_HEIGHT) continue;
    if (isSolid(blockAt(world, x, ground + 1, z))) continue;
    const key = `${x},${z}`;
    if (taken.has(key)) continue;
    taken.add(key);
    fragments.push({ x: x + 0.5, y: ground + 1.5, z: z + 0.5 });
  }

  const middle = Math.floor(size / 2);
  const spawnGround = groundAt(world, middle, middle);
  return { world, fragments, spawn: { x: middle + 0.5, y: spawnGround + 1, z: middle + 0.5 } };
}
