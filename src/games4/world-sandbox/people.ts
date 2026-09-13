import { physics } from "./matrix";
import { destroy, nearest, sparkle, step, wander, canBe } from "./nature";
import { say, save, world, type Tribe } from "./state";
import { isLand, type Thing } from "./world";

// Tribes live in villages. Villages grow new people, people wander near home,
// and people from tribes at war hunt each other down and burn villages.

export const TRIBE_COLORS = [
  { name: "Red", color: "#d8362b" },
  { name: "Blue", color: "#3b7fe0" },
  { name: "Yellow", color: "#f7d23e" },
  { name: "Purple", color: "#9b59d9" },
  { name: "Orange", color: "#ee7a2a" },
  { name: "Pink", color: "#f2a3b3" },
  { name: "White", color: "#f4f1ea" },
  { name: "Black", color: "#1b1b1f" },
];

export const TRAITS = [
  { id: "brave", name: "Brave", about: "charges at enemies from further away" },
  { id: "strong", name: "Strong", about: "hits harder and takes more hits" },
  { id: "fast", name: "Fast", about: "moves twice as fast" },
  { id: "peaceful", name: "Peaceful", about: "never starts a fight" },
  { id: "explorer", name: "Explorer", about: "wanders far from home" },
  { id: "builder", name: "Builder", about: "sometimes builds a new village" },
  { id: "healer", name: "Healer", about: "heals hurt people from their tribe" },
];

const NAMES = [
  "Aki", "Bo", "Cora", "Dax", "Edda", "Finn", "Gus", "Hana", "Ivo", "Jax", "Kira", "Lev", "Mara",
  "Nils", "Oda", "Pax", "Quin", "Rhea", "Sten", "Tove", "Uma", "Vik", "Wyn", "Yara", "Zed",
];

const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T;
const has = (t: Thing, trait: string): boolean => t.traits?.includes(trait) ?? false;

export const randomName = (): string => pick(NAMES);

export function randomTraits(): string[] {
  const traits = new Set<string>();
  const count = Math.floor(Math.random() * 3);
  while (traits.size < count) traits.add(pick(TRAITS).id);
  return [...traits];
}

export const tribeOf = (t: Thing): Tribe | undefined => world.tribes.find((tribe) => tribe.id === t.tribe);

export const maxHp = (t: Thing): number => (t.type === "village" ? 20 : has(t, "strong") ? 8 : 5);

function atWar(a: Thing, b: Thing): boolean {
  return !!b.tribe && (tribeOf(a)?.enemies.includes(b.tribe) ?? false);
}

// Whether there's land all the way from a to b, so a person can walk straight there.
// ponytail: straight lines only, no finding a way around a lake.
function overLand(a: Thing, b: Thing): boolean {
  if (physics.noWalls) return true;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  for (let s = 0; s < d; s += 2) {
    if (!isLand(world.heights, a.x + ((b.x - a.x) * s) / d, a.y + ((b.y - a.y) * s) / d)) return false;
  }
  return true;
}

export function createTribe(name: string, color: string): Tribe {
  const tribe: Tribe = { id: `tribe-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`, name, color, enemies: [] };
  world.tribes.push(tribe);
  save();
  return tribe;
}

export function setWar(a: Tribe, b: Tribe, war: boolean): void {
  a.enemies = a.enemies.filter((id) => id !== b.id);
  b.enemies = b.enemies.filter((id) => id !== a.id);
  if (war) {
    a.enemies.push(b.id);
    b.enemies.push(a.id);
    say(`${a.name} and ${b.name} are at war!`);
  }
  save();
}

export function makePerson(x: number, y: number, tribe: string | undefined, name = randomName(), traits = randomTraits()): Thing {
  const person: Thing = { type: "person", x, y, tribe, name, traits };
  person.hp = maxHp(person);
  return person;
}

// The person drawn at (x, y), if there is one.
export function personAt(x: number, y: number): Thing | undefined {
  return world.things.filter((t) => t.type === "person" && Math.abs(t.x - x) <= 3 && y <= t.y + 1 && y >= t.y - 7).at(-1);
}

// ---------- every frame ----------

// About every 15 seconds each village might grow a new person, up to 6 people
// per village in the tribe.
const BIRTH_CHANCE = 1 / 900;
const PEOPLE_PER_VILLAGE = 6;

export function updatePeople(now: number): void {
  for (const t of world.things) {
    if (t.type === "village") updateVillage(t, now);
    else if (t.type === "person") updatePerson(t, now);
  }
}

function updateVillage(village: Thing, now: number): void {
  const tribe = tribeOf(village);
  if (!tribe || Math.random() > BIRTH_CHANCE) return;
  const mine = world.things.filter((t) => t.tribe === tribe.id);
  const villages = mine.filter((t) => t.type === "village").length;
  if (mine.length - villages >= villages * PEOPLE_PER_VILLAGE) return;
  const baby = makePerson(village.x + (Math.random() - 0.5) * 10, village.y + 2, tribe.id);
  if (!canBe("land", baby.x, baby.y)) return;
  world.things.push(baby);
  world.effects.push(sparkle(baby.x, baby.y, now, tribe.color));
  say(`${baby.name} was born in ${tribe.name}.`);
  save();
}

function updatePerson(p: Thing, now: number): void {
  p.hp ??= maxHp(p);
  if (p.rest) p.rest -= 1;
  const speed = has(p, "fast") ? 0.2 : 0.1;

  const enemy = has(p, "peaceful")
    ? undefined
    : nearest(p, has(p, "brave") ? 45 : 25, (_, t) => (t.type === "person" || t.type === "village") && atWar(p, t) && overLand(p, t));
  if (enemy) {
    p.heading = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    if (Math.hypot(enemy.x - p.x, enemy.y - p.y) > 3) step(p, "land", speed * 1.5);
    else if (!p.rest) hit(p, enemy, now);
    return;
  }

  if (has(p, "healer") && Math.random() < 0.01) {
    const friend = nearest(p, 15, (_, t) => t.type === "person" && !!p.tribe && t.tribe === p.tribe && (t.hp ?? 0) < maxHp(t));
    if (friend) {
      friend.hp = maxHp(friend);
      world.effects.push(sparkle(friend.x, friend.y, now, "#86d86e"));
    }
  }
  if (has(p, "builder") && p.tribe && Math.random() < 1 / 3000) buildVillage(p, now);

  // Head back if they've wandered too far from the nearest village of their tribe.
  const home = has(p, "explorer") || !p.tribe ? undefined : nearest(p, Infinity, (_, t) => t.type === "village" && t.tribe === p.tribe);
  if (home && Math.hypot(home.x - p.x, home.y - p.y) > 30 && overLand(p, home)) {
    p.heading = Math.atan2(home.y - p.y, home.x - p.x);
    step(p, "land", speed);
  } else {
    wander(p, "land", speed);
  }
}

function hit(p: Thing, enemy: Thing, now: number): void {
  p.rest = 30;
  enemy.hp = (enemy.hp ?? maxHp(enemy)) - (has(p, "strong") ? 2 : 1);
  world.effects.push(sparkle(enemy.x, enemy.y, now, "#d8362b"));
  if (enemy.hp > 0) return;
  const them = tribeOf(enemy)?.name ?? "their enemies";
  if (enemy.type === "village") {
    destroy(enemy, { kind: "fire", x: enemy.x, y: enemy.y, born: now, color: "" }, `${p.name} burned down a village of ${them}!`);
  } else {
    destroy(enemy, sparkle(enemy.x, enemy.y, now, "#d8362b"), `${p.name} defeated ${enemy.name} of ${them}!`);
  }
}

function buildVillage(p: Thing, now: number): void {
  const x = p.x + (Math.random() - 0.5) * 60;
  const y = p.y + (Math.random() - 0.5) * 40;
  const spot: Thing = { type: "village", x, y };
  if (!canBe("land", x, y) || nearest(spot, 25, (_, t) => t.type === "village")) return;
  world.things.push({ ...spot, tribe: p.tribe, hp: 20 });
  world.effects.push(sparkle(x, y, now, tribeOf(p)?.color));
  say(`${p.name} built a new village for ${tribeOf(p)?.name}!`);
  save();
}
