// How the war machines behave, away from the canvas so the numbers can be
// checked on their own.

export type TechId =
  | "laser-cannon"
  | "missile-silo"
  | "nuke-silo"
  | "truck"
  | "spawner"
  | "mutant-spawner"
  | "teleporter";

export interface TechSpec {
  id: TechId;
  name: string;
  // Frames between shots.
  reload: number;
  // How far it can hit from.
  range: number;
  // How big a hole it leaves. 0 for the laser, which only burns what it hits.
  blast: number;
  // How many people a builder has to put into it to get one built. Placing one
  // yourself is free: you are not a person, you are whoever owns this world.
  cost?: number;
}

export const TECH: Record<TechId, TechSpec> = {
  "laser-cannon": { id: "laser-cannon", name: "Laser Cannon", reload: 90, range: 55, blast: 0 },
  "missile-silo": { id: "missile-silo", name: "Missile Silo", reload: 420, range: 130, blast: 9 },
  "nuke-silo": { id: "nuke-silo", name: "Nuke Silo", reload: 2400, range: 400, blast: 34 },
  truck: { id: "truck", name: "Truck", reload: 30, range: 6, blast: 0 },
  spawner: { id: "spawner", name: "Spawning Machine", reload: 480, range: 0, blast: 0, cost: 3 },
  "mutant-spawner": { id: "mutant-spawner", name: "Mutant Spawning Machine", reload: 720, range: 0, blast: 0, cost: 10 },
  teleporter: { id: "teleporter", name: "Teleporter", reload: 0, range: 4, blast: 0 },
};

export const TECH_IDS = Object.keys(TECH) as TechId[];

export const isTech = (type: string): type is TechId => type in TECH;

/** What a builder has to feed into the machine to get one built. */
export const buildCost = (id: TechId): number => TECH[id].cost ?? 0;

export const isSpawner = (type: string): boolean => type === "spawner" || type === "mutant-spawner";

// ---------- what a hit takes off you ----------

// Nothing kills outright any more if it has any health in it, which is how a
// mutant walks out of a blast that flattens everything around it.
export const DAMAGE = {
  missile: 12,
  nuke: 25,
  laser: 12,
  ram: 10,
};

/**
 * Who is allowed on a teleporter pad. A pad belonging to a tribe only works
 * for that tribe. A pad belonging to nobody works for absolutely anybody,
 * which is how the enemy ends up standing in the middle of your island.
 */
export function canUsePad(padTribe: string | undefined, walkerTribe: string | undefined): boolean {
  return !padTribe || padTribe === walkerTribe;
}

/** How long somebody has to wait before a pad will take them again. */
export const WARP_REST = 90;

/** How many war machines one tribe is allowed, so the world stays playable. */
export const TECH_PER_TRIBE = 6;

export interface Shot {
  kind: "missile" | "nuke";
  x: number;
  y: number;
  // Where it is headed.
  tx: number;
  ty: number;
  tribe?: string;
}

export const SHOT_SPEED = { missile: 1.6, nuke: 0.8 };

/** Moves a shot along towards where it is going. True once it has arrived. */
export function flyShot(shot: Shot): boolean {
  const speed = SHOT_SPEED[shot.kind];
  const dx = shot.tx - shot.x;
  const dy = shot.ty - shot.y;
  const d = Math.hypot(dx, dy);
  if (d <= speed) {
    shot.x = shot.tx;
    shot.y = shot.ty;
    return true;
  }
  shot.x += (dx / d) * speed;
  shot.y += (dy / d) * speed;
  return false;
}

/** Whether a blast of this size reaches something standing here. */
export function caughtInBlast(blast: number, bx: number, by: number, x: number, y: number): boolean {
  return Math.hypot(x - bx, y - by) <= blast;
}

/**
 * A nuke takes out anything it reaches. Anything smaller leaves the scenery —
 * mountains and hills and volcanoes — standing.
 */
export function blastDestroys(blast: number, sturdy: boolean): boolean {
  return !sturdy || blast >= TECH["nuke-silo"].blast;
}
