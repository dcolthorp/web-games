import { CHOICES } from "./catalog";
import { destroy, nameOf, nearest, sparkle, step, wander } from "./nature";
import { say, tribesAtWar, world } from "./state";
import { MUTANT_HP, makePerson, maxHp } from "./people";
import {
  DAMAGE,
  TECH,
  WARP_REST,
  blastDestroys,
  canUsePad,
  caughtInBlast,
  flyShot,
  isSpawner,
  isTech,
  type Shot,
  type TechSpec,
} from "./techRules";
import { type Thing } from "./world";

// What the war machines do once they are standing there. Everything here only
// happens to a machine that belongs to a tribe: one nobody owns just sits.

const enemyNear = (t: Thing, range: number): Thing | undefined =>
  nearest(t, range, (_, other) => tribesAtWar(t.tribe, other.tribe));

export function updateTech(now: number): void {
  for (const t of world.things) {
    if (t.warp) t.warp -= 1;
    if (!isTech(t.type)) continue;
    const spec = TECH[t.type];
    if (t.type === "teleporter") {
      runTeleporter(t, now);
      continue;
    }
    if (t.type === "truck") {
      driveTruck(t, spec, now);
      continue;
    }
    if (isSpawner(t.type)) {
      runSpawner(t, spec, now);
      continue;
    }
    if (!t.tribe) continue;
    t.rest = Math.max(0, (t.rest ?? 0) - 1);
    if (t.rest > 0) continue;
    const target = enemyNear(t, spec.range);
    if (!target) continue;
    t.rest = spec.reload;
    if (t.type === "laser-cannon") fireLaser(t, target, now);
    else launch(t, target, t.type === "nuke-silo" ? "nuke" : "missile");
  }
  flyShots(now);
}

// How many things the world will hold before the machines stop making more.
const CROWD = 1000;

// The machine hums away and something climbs out of it every so often.
function runSpawner(machine: Thing, spec: TechSpec, now: number): void {
  machine.rest = Math.max(0, (machine.rest ?? 0) - 1);
  if (machine.rest > 0) return;
  machine.rest = spec.reload;
  if (world.things.length >= CROWD) return;
  const x = machine.x + (Math.random() - 0.5) * 8;
  const y = machine.y + 2;
  if (machine.type === "mutant-spawner") {
    world.things.push({
      type: "mutant",
      x,
      y,
      hp: MUTANT_HP,
      name: "A mutant",
      ...(machine.tribe ? { tribe: machine.tribe } : {}),
    });
    world.effects.push(sparkle(x, y, now, "#86d86e"));
    say("Something came out of the mutant machine.");
    return;
  }
  world.things.push(makePerson(x, y, machine.tribe));
  world.effects.push(sparkle(x, y, now, "#9fe3ff"));
}

/**
 * Takes the hit off whatever was hit. Living things and buildings have health
 * and may walk away from it — which is how a mutant strolls out of a crater
 * that flattened everyone around it. Trees and machines simply go.
 *
 * True when that finished it off.
 */
function wounded(victim: Thing, amount: number, now: number, color: string): boolean {
  const full = maxHp(victim);
  const tough = victim.type === "mutant" || victim.type === "person" || full > 5;
  world.effects.push(sparkle(victim.x, victim.y, now, color));
  if (!tough) return true;
  victim.hp = (victim.hp ?? full) - amount;
  return (victim.hp ?? 0) <= 0;
}

/** One thing hit by one weapon, with something to say about it. */
function hurt(victim: Thing, amount: number, now: number, message: string, color: string): void {
  if (!wounded(victim, amount, now, color)) return;
  destroy(victim, sparkle(victim.x, victim.y, now, color), message);
}

// Anybody standing on a pad they are allowed on comes out of the other one.
function runTeleporter(pad: Thing, now: number): void {
  if (!pad.link) return;
  const other = world.things.find((t) => t.pad === pad.link);
  if (!other) return;
  for (const t of world.things) {
    if (t.type !== "person" && t.type !== "mutant") continue;
    if (t.warp) continue;
    if (Math.hypot(t.x - pad.x, t.y - pad.y) > TECH.teleporter.range) continue;
    if (!canUsePad(pad.tribe, t.tribe)) continue;
    world.effects.push(sparkle(t.x, t.y, now, "#9fe3ff"));
    t.x = other.x;
    t.y = other.y + 2;
    t.warp = WARP_REST;
    t.homing = 0;
    world.effects.push(sparkle(t.x, t.y, now, "#9fe3ff"));
  }
}

function fireLaser(cannon: Thing, target: Thing, now: number): void {
  world.effects.push({
    kind: "laser",
    x: cannon.x,
    y: cannon.y - 7,
    x2: target.x,
    y2: target.y - 2,
    born: now,
    color: "#9fe3ff",
  });
  hurt(target, DAMAGE.laser, now, `A laser cannon burned ${nameOf(target)} away!`, "#9fe3ff");
}

function launch(silo: Thing, target: Thing, kind: Shot["kind"]): void {
  const shot: Shot = { kind, x: silo.x, y: silo.y - 8, tx: target.x, ty: target.y, ...(silo.tribe ? { tribe: silo.tribe } : {}) };
  world.shots.push(shot);
  if (kind === "nuke") say("A nuke is in the air.");
}

function flyShots(now: number): void {
  const landed: Shot[] = [];
  world.shots = world.shots.filter((shot) => {
    if (!flyShot(shot)) return true;
    landed.push(shot);
    return false;
  });
  for (const shot of landed) explode(shot, now);
}

// Everything close enough goes. A nuke takes the scenery with it; a missile
// leaves the mountains where they are.
function explode(shot: Shot, now: number): void {
  const blast = shot.kind === "nuke" ? TECH["nuke-silo"].blast : TECH["missile-silo"].blast;
  world.effects.push({
    kind: "blast",
    x: shot.x,
    y: shot.y,
    born: now,
    color: shot.kind === "nuke" ? "#f7d23e" : "#ee7a2a",
    size: blast,
  });
  const damage = shot.kind === "nuke" ? DAMAGE.nuke : DAMAGE.missile;
  const dead = new Set<Thing>();
  for (const t of world.things) {
    if (!caughtInBlast(blast, shot.x, shot.y, t.x, t.y)) continue;
    if (!blastDestroys(blast, CHOICES.get(t.type)?.sturdy ?? false)) continue;
    if (wounded(t, damage, now, "#f7d23e")) dead.add(t);
  }
  if (dead.size > 0) world.things = world.things.filter((t) => !dead.has(t));
  const gone = dead.size;
  for (let i = 0; i < Math.min(6, gone); i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    world.effects.push({
      kind: "fire",
      x: shot.x + Math.cos(angle) * blast * 0.5,
      y: shot.y + Math.sin(angle) * blast * 0.5,
      born: now,
      color: "",
    });
  }
  const count = `${gone} ${gone === 1 ? "thing" : "things"}`;
  say(shot.kind === "nuke" ? `The nuke took ${count} with it.` : `A missile blew up ${count}.`);
}

// Trucks drive about. A truck belonging to a tribe at war drives at whoever
// it is at war with and runs them over.
const TRUCK_LOOK = 40;

function driveTruck(truck: Thing, spec: TechSpec, now: number): void {
  truck.rest = Math.max(0, (truck.rest ?? 0) - 1);
  const hunting = truck.tribe && (truck.rest ?? 0) === 0;
  const target = hunting ? enemyNear(truck, TRUCK_LOOK) : undefined;
  if (!target) {
    wander(truck, "land", 0.26);
    return;
  }
  truck.heading = Math.atan2(target.y - truck.y, target.x - truck.x);
  if (Math.hypot(target.x - truck.x, target.y - truck.y) > spec.range) {
    step(truck, "land", 0.34);
    return;
  }
  truck.rest = spec.reload;
  hurt(target, DAMAGE.ram, now, `A truck ran ${nameOf(target)} over!`, "#d8362b");
}
