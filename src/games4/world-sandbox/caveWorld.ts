import { blowUp, bombKind, crystalsAround, inBlast, isBomb } from "./cavern";
import { nearestTunnel, stepInTunnel } from "./miners";
import { MUTANT_HP, makePerson, maxHp } from "./people";
import { tribesAtWar } from "./state";
import { DAMAGE, TECH, WARP_REST, canUsePad, isSpawner, isTech } from "./techRules";
import { type Thing } from "./world";

// Everything that happens inside a mountain: bombs on the walls, whoever lives
// down here shuffling along the tunnels, and the war machines, which work the
// same as they do up top except that their blasts dig the rock out as well.

export interface CaveBlast {
  x: number;
  y: number;
  r: number;
  born: number;
}

interface CaveWorld {
  things: Thing[];
  grid: Uint8Array;
  now: number;
  blasts: CaveBlast[];
  say: (text: string) => void;
}

const MOVES = new Set(["person", "mutant"]);

export function updateCave(mountain: Thing, grid: Uint8Array, now: number, blasts: CaveBlast[], say: (text: string) => void): void {
  const things = (mountain.caveThings ??= []);
  const cave: CaveWorld = { things, grid, now, blasts, say };
  const dead = new Set<Thing>();

  for (const t of things) {
    if (t.warp) t.warp -= 1;
    if (isBomb(t.type)) {
      t.fuse = (t.fuse ?? 0) - 1;
      if ((t.fuse ?? 0) <= 0) {
        dead.add(t);
        const kind = bombKind(t.type);
        if (kind) boom(cave, t.x, t.y, kind.radius, dead);
      }
      continue;
    }
    if (isTech(t.type)) {
      runMachine(cave, t, dead);
      continue;
    }
    if (MOVES.has(t.type)) walk(cave, t);
  }

  if (dead.size > 0) mountain.caveThings = things.filter((t) => !dead.has(t));
}

// ---------- living down here ----------

function walk(cave: CaveWorld, t: Thing): void {
  const spot = nearestTunnel(cave.grid, t.x, t.y);
  if (!spot) return;
  const step = stepInTunnel(cave.grid, spot.x, spot.y, t.heading ?? 0, Math.random);
  t.x = step.x;
  t.y = step.y;
  t.heading = step.heading;
}

/** True when that finished it off. Only living things and buildings have health. */
function wounded(t: Thing, amount: number): boolean {
  const full = maxHp(t);
  const tough = t.type === "mutant" || t.type === "person" || full > 5;
  if (!tough) return true;
  t.hp = (t.hp ?? full) - amount;
  return (t.hp ?? 0) <= 0;
}

const enemyIn = (cave: CaveWorld, t: Thing, range: number): Thing | undefined => {
  let best: Thing | undefined;
  let bestDistance = range;
  for (const other of cave.things) {
    if (other === t || !tribesAtWar(t.tribe, other.tribe)) continue;
    const d = Math.hypot(other.x - t.x, other.y - t.y);
    if (d < bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
};

// ---------- the machines ----------

function runMachine(cave: CaveWorld, machine: Thing, dead: Set<Thing>): void {
  const spec = TECH[machine.type as keyof typeof TECH];
  if (!spec) return;

  if (machine.type === "teleporter") {
    runPad(cave, machine);
    return;
  }

  if (machine.type === "truck") {
    machine.rest = Math.max(0, (machine.rest ?? 0) - 1);
    const target = machine.tribe && machine.rest === 0 ? enemyIn(cave, machine, 45) : undefined;
    if (!target) {
      walk(cave, machine);
      return;
    }
    machine.heading = Math.atan2(target.y - machine.y, target.x - machine.x);
    if (Math.hypot(target.x - machine.x, target.y - machine.y) > spec.range) {
      walk(cave, machine);
      return;
    }
    machine.rest = spec.reload;
    if (wounded(target, DAMAGE.ram)) dead.add(target);
    return;
  }

  machine.rest = Math.max(0, (machine.rest ?? 0) - 1);
  if (machine.rest > 0) return;

  if (isSpawner(machine.type)) {
    machine.rest = spec.reload;
    if (cave.things.length > 200) return;
    const x = machine.x + (Math.random() - 0.5) * 6;
    const y = machine.y + 2;
    if (machine.type === "mutant-spawner") {
      cave.things.push({ type: "mutant", x, y, hp: MUTANT_HP, name: "A mutant", ...(machine.tribe ? { tribe: machine.tribe } : {}) });
      cave.say("Something came out of the mutant machine, down in the dark.");
    } else {
      cave.things.push(makePerson(x, y, machine.tribe));
    }
    return;
  }

  if (!machine.tribe) return;
  const target = enemyIn(cave, machine, spec.range);
  if (!target) return;
  machine.rest = spec.reload;

  if (machine.type === "laser-cannon") {
    if (wounded(target, DAMAGE.laser)) dead.add(target);
    cave.blasts.push({ x: target.x, y: target.y, r: 4, born: cave.now });
    return;
  }

  // A silo firing inside a mountain blows the rock out as well as whatever was
  // standing in it, which is one way of digging a very big room very quickly.
  const nuke = machine.type === "nuke-silo";
  boom(cave, target.x, target.y, nuke ? TECH["nuke-silo"].blast : TECH["missile-silo"].blast, dead, nuke ? DAMAGE.nuke : DAMAGE.missile);
}

function runPad(cave: CaveWorld, pad: Thing): void {
  if (!pad.link) return;
  const other = cave.things.find((t) => t.pad === pad.link);
  if (!other) return;
  for (const t of cave.things) {
    if (!MOVES.has(t.type) || t.warp) continue;
    if (Math.hypot(t.x - pad.x, t.y - pad.y) > TECH.teleporter.range) continue;
    if (!canUsePad(pad.tribe, t.tribe)) continue;
    t.x = other.x;
    t.y = other.y + 2;
    t.warp = WARP_REST;
  }
}

/** A hole in the rock, and everything close enough to it taking the hit. */
function boom(cave: CaveWorld, x: number, y: number, radius: number, dead: Set<Thing>, damage = 999): void {
  blowUp(cave.grid, x, y, radius);
  cave.blasts.push({ x, y, r: radius, born: cave.now });
  for (const t of cave.things) {
    if (dead.has(t) || !inBlast(radius, x, y, t.x, t.y)) continue;
    // A bomb caught in a blast goes off right behind it.
    if (isBomb(t.type)) {
      t.fuse = 6;
      continue;
    }
    if (wounded(t, damage)) dead.add(t);
  }
  const found = crystalsAround(cave.grid, x, y, radius + 3);
  cave.say(found.length > 0 ? `The blast uncovered ${found.slice(0, 3).join(", ")}!` : "The blast opened up the rock.");
}
