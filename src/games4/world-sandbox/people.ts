import { physics } from "./matrix";
import { CAVE_MOUTH, ENTER_CHANCE, ENTER_RANGE, LEAVE_CHANCE } from "./miners";
import { destroy, nearest, sparkle, step, wander, canBe } from "./nature";
import { say, save, tribesAtWar, world, type Tribe } from "./state";
import { TECH, TECH_IDS, TECH_PER_TRIBE, buildCost, isTech, type TechId } from "./techRules";
import { tribeNameFor } from "./tribeNames";
import { H, W, isLand, type Thing } from "./world";

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
  { id: "builder", name: "Builder", about: "builds new villages, and sometimes whole new tribes" },
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

export const maxHp = (t: Thing): number =>
  t.type === "apartment" ? 40 : t.type === "village" ? 20 : t.type === "mutant" ? MUTANT_HP : has(t, "strong") ? 8 : 5;

// A mutant walks out of a nuke. That is the entire point of a mutant.
export const MUTANT_HP = 30;

// A mutant is a person as far as wandering and fighting go.
const isFolk = (t: Thing): boolean => t.type === "person" || t.type === "mutant";

function atWar(a: Thing, b: Thing): boolean {
  return tribesAtWar(a.tribe, b.tribe);
}

// Whether there's land all the way from a to b, so a person can walk straight there.
// ponytail: straight lines only, no finding a way around a lake.
function overLand(a: Thing, b: Thing): boolean {
  if (physics.noWalls) return true;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  // Close enough that there is nothing in between worth checking.
  if (d < 6) return true;
  for (let s = 0; s < d; s += 3) {
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

// Where a tribe's people live. A village holds a handful; an apartment complex
// is the same idea stacked up, so it holds a great many more and fills faster.
export const HOMES = ["village", "apartment"];

export const isHome = (t: Thing): boolean => HOMES.includes(t.type);

const PEOPLE_PER_APARTMENT = 30;

const roomIn = (home: Thing): number => (home.type === "apartment" ? PEOPLE_PER_APARTMENT : PEOPLE_PER_VILLAGE);

// About every 15 seconds each village might grow a new person, up to 6 people
// per village in the tribe.
const BIRTH_CHANCE = 1 / 900;
const PEOPLE_PER_VILLAGE = 6;

// A world can hold a thousand people before it starts to feel slow, so tribes
// stop growing at that point however many homes they have built.
export const MAX_PEOPLE = 1000;

// Everything the people need to know about each other, worked out once a frame
// instead of once per person. Without this, a thousand people searching the
// whole world every frame is a million sums a frame, and the game crawls.
interface Census {
  homes: Map<string, Thing[]>;
  people: Map<string, number>;
  total: number;
  // People and homes belonging to a tribe that is at war with somebody, sorted
  // into squares of the map so nobody has to look at the whole world to find
  // the enemy standing next to them. Empty when nobody is fighting at all.
  fighters: Map<number, Thing[]>;
  anyWar: boolean;
}

// The map is chopped into squares this big for finding who is nearby.
const PATCH = 24;
const PATCHES_ACROSS = Math.ceil(W / PATCH) + 1;
const patchKey = (x: number, y: number): number =>
  Math.floor(y / PATCH) * PATCHES_ACROSS + Math.floor(x / PATCH);

function takeCensus(): Census {
  const homes = new Map<string, Thing[]>();
  const people = new Map<string, number>();
  const atWarTribes = new Set(world.tribes.filter((t) => t.enemies.length > 0).map((t) => t.id));
  const fighters = new Map<number, Thing[]>();
  let total = 0;
  for (const t of world.things) {
    const isPerson = isFolk(t);
    if (isPerson) total += 1;
    if (!t.tribe) continue;
    if (isHome(t)) {
      const list = homes.get(t.tribe);
      if (list) list.push(t);
      else homes.set(t.tribe, [t]);
    } else if (t.type === "person") {
      // Mutants never came from a home and never need one.
      people.set(t.tribe, (people.get(t.tribe) ?? 0) + 1);
    }
    if ((isPerson || isHome(t)) && atWarTribes.has(t.tribe)) {
      const key = patchKey(t.x, t.y);
      const patch = fighters.get(key);
      if (patch) patch.push(t);
      else fighters.set(key, [t]);
    }
  }
  return { homes, people, total, fighters, anyWar: atWarTribes.size > 0 };
}

let frames = 0;

export function updatePeople(now: number): void {
  frames += 1;
  const census = takeCensus();
  for (const t of world.things) {
    if (isHome(t)) updateHome(t, now, census);
    else if (isFolk(t)) updatePerson(t, now, census);
  }
}

function updateHome(home: Thing, now: number, census: Census): void {
  const tribe = tribeOf(home);
  // A tower has a lot more front doors than a village does.
  const busy = home.type === "apartment" ? 4 : 1;
  if (!tribe || Math.random() > BIRTH_CHANCE * busy) return;
  if (census.total >= MAX_PEOPLE) return;
  const room = (census.homes.get(tribe.id) ?? []).reduce((total, h) => total + roomIn(h), 0);
  if ((census.people.get(tribe.id) ?? 0) >= room) return;
  const baby = makePerson(home.x + (Math.random() - 0.5) * 10, home.y + 2, tribe.id);
  if (!canBe("land", baby.x, baby.y)) return;
  world.things.push(baby);
  world.effects.push(sparkle(baby.x, baby.y, now, tribe.color));
  say(`${baby.name} was born in ${tribe.name}.`);
  save();
}

function updatePerson(p: Thing, now: number, census: Census): void {
  // Mutants don't go into caves, build anything, or found tribes; they wander
  // and they fight, which the rest of this function handles.
  // Somebody in a cave is busy. They'll be out in a bit.
  if (p.inside) {
    if (Math.random() < LEAVE_CHANCE) comeOutOfCave(p, now);
    return;
  }
  p.hp ??= maxHp(p);
  if (p.rest) p.rest -= 1;
  const swimming = !isLand(world.heights, p.x, p.y);
  // Swimming is slower than walking, even for a fast person.
  const speed = (has(p, "fast") ? 0.2 : 0.1) * (swimming ? 0.6 : 1);

  // Nobody hunts for an enemy when no tribe is at war with anybody, and even
  // then they only look at the squares of the map within reach of them.
  const reach = has(p, "brave") ? 45 : 25;
  const enemy =
    has(p, "peaceful") || !census.anyWar
      ? undefined
      : closestFoe(census.fighters, p, reach);
  if (enemy) {
    p.heading = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    if (Math.hypot(enemy.x - p.x, enemy.y - p.y) > 3) movePerson(p, speed * 1.5);
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
  // Somebody with no tribe at all only needs to be a builder; somebody who
  // already has one has to have wandered a long way from it first.
  const founding = has(p, "builder") && Math.random() < (p.tribe ? FOUND_CHANCE : LONE_FOUND_CHANCE);
  if (founding && farFromHome(p, census)) foundTribe(p, now);
  else if (has(p, "builder") && p.tribe && Math.random() < 1 / 3000) buildVillage(p, now);
  else if (has(p, "builder") && p.tribe && Math.random() < TECH_CHANCE) buildTech(p, now, census);
  if (p.type === "person" && Math.random() < ENTER_CHANCE && goIntoCave(p, now)) return;

  // Head back if they've wandered too far from the nearest home of their tribe.
  // Checking costs something, so they only wonder about it now and then — and
  // not everybody on the same frame — then walk that way for a while.
  if (!has(p, "explorer") && p.tribe && !p.homing && (frames + Math.round(p.x)) % HOME_CHECK === 0) {
    const home = nearestOf(census.homes.get(p.tribe) ?? [], p, Infinity, () => true);
    if (home && Math.hypot(home.x - p.x, home.y - p.y) > 30) {
      p.heading = Math.atan2(home.y - p.y, home.x - p.x);
      p.homing = HOME_WALK;
    }
  }

  if (p.homing) {
    p.homing -= 1;
    movePerson(p, speed);
  } else {
    p.heading ??= Math.random() * Math.PI * 2;
    if (Math.random() < 0.02) p.heading += (Math.random() - 0.5) * 2;
    movePerson(p, speed);
  }
}

// How often somebody standing on the shore decides to get in the water. Once
// they're in they keep going, so a low chance still gets people to the islands.
const WADE_CHANCE = 0.012;

/**
 * People can swim. They walk on land by choice, but every so often one wades
 * off the beach and strikes out across the water, and whoever is already
 * swimming keeps swimming until they find land again.
 */
function movePerson(p: Thing, speed: number): void {
  const heading = p.heading ?? 0;
  const nx = p.x + Math.cos(heading) * speed;
  const ny = p.y + Math.sin(heading) * speed;
  if (nx < 4 || ny < 8 || nx > W - 4 || ny > H - 1) {
    p.heading = heading + Math.PI;
    return;
  }
  const wet = !isLand(world.heights, p.x, p.y);
  const wetNext = !isLand(world.heights, nx, ny);
  if (wetNext && !wet && !physics.noWalls && Math.random() > WADE_CHANCE) {
    p.heading = heading + Math.PI;
    return;
  }
  p.x = nx;
  p.y = ny;
}

// How often a person wonders whether they are a long way from home, and how
// many frames they keep walking that way once they decide they are.
const HOME_CHECK = 15;
const HOME_WALK = 40;

/**
 * The closest enemy worth charging at, looking only at the squares of the map
 * within reach. Whether there's water in the way is only worked out for the
 * one they settle on: checking it for everybody nearby is what turns a busy
 * war into a slideshow.
 */
function closestFoe(patches: Map<number, Thing[]>, from: Thing, reach: number): Thing | undefined {
  let best: Thing | undefined;
  let bestDistance = reach;
  const spread = Math.ceil(reach / PATCH);
  for (let dy = -spread; dy <= spread; dy += 1) {
    for (let dx = -spread; dx <= spread; dx += 1) {
      const patch = patches.get(patchKey(from.x + dx * PATCH, from.y + dy * PATCH));
      if (!patch) continue;
      for (const t of patch) {
        if (t === from) continue;
        const d = Math.hypot(t.x - from.x, t.y - from.y);
        if (d < bestDistance && atWar(from, t)) {
          best = t;
          bestDistance = d;
        }
      }
    }
  }
  return best && overLand(from, best) ? best : undefined;
}

/** The closest thing in a list that this person cares about. */
function nearestOf(
  things: Thing[],
  from: Thing,
  reach: number,
  wanted: (t: Thing) => boolean
): Thing | undefined {
  let best: Thing | undefined;
  let bestDistance = reach;
  for (const t of things) {
    if (t === from) continue;
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (d < bestDistance && wanted(t)) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

// A mountain with a cave in it, close enough to walk into.
function goIntoCave(p: Thing, now: number): boolean {
  const mountain = world.things.find(
    (t) => t.type === "mountain" && t.cave !== undefined && Math.hypot(t.x - p.x, t.y - p.y) < ENTER_RANGE
  );
  if (!mountain) return false;
  p.inside = [mountain.x, mountain.y];
  p.cx = CAVE_MOUTH.x;
  p.cy = CAVE_MOUTH.y;
  p.dug = undefined;
  world.effects.push(sparkle(mountain.x, mountain.y, now, tribeOf(p)?.color));
  say(`${p.name} went into the cave.`);
  save();
  return true;
}

export function comeOutOfCave(p: Thing, now: number): void {
  const [mx, my] = p.inside ?? [p.x, p.y];
  p.x = mx;
  p.y = my;
  p.inside = undefined;
  p.cx = undefined;
  p.cy = undefined;
  world.effects.push(sparkle(mx, my, now, tribeOf(p)?.color));
  say(p.dug ? `${p.name} came out of the cave with a piece of ${p.dug}!` : `${p.name} came out of the cave.`);
  p.dug = undefined;
  save();
}

function hit(p: Thing, enemy: Thing, now: number): void {
  p.rest = 30;
  // Mutants hit like three people.
  enemy.hp = (enemy.hp ?? maxHp(enemy)) - (p.type === "mutant" ? 3 : has(p, "strong") ? 2 : 1);
  world.effects.push(sparkle(enemy.x, enemy.y, now, "#d8362b"));
  if (enemy.hp > 0) return;
  const them = tribeOf(enemy)?.name ?? "their enemies";
  if (isHome(enemy)) {
    const what = enemy.type === "apartment" ? "an apartment complex" : "a village";
    destroy(enemy, { kind: "fire", x: enemy.x, y: enemy.y, born: now, color: "" }, `${p.name} burned down ${what} of ${them}!`);
  } else {
    destroy(enemy, sparkle(enemy.x, enemy.y, now, "#d8362b"), `${p.name} defeated ${enemy.name} of ${them}!`);
  }
}

// Only builders ever do this, and only when they are a long way from anywhere
// that is already theirs — someone who wandered off the edge of the map their
// tribe knows about and decided to start their own.
const FOUND_CHANCE = 1 / 7000;
const LONE_FOUND_CHANCE = 1 / 900;
const MAX_TRIBES = 12;
const FAR_FROM_HOME = 30;

function farFromHome(p: Thing, census: Census): boolean {
  if (!p.tribe) return true;
  const home = nearestOf(census.homes.get(p.tribe) ?? [], p, Infinity, () => true);
  return !home || Math.hypot(home.x - p.x, home.y - p.y) > FAR_FROM_HOME;
}

function freeColor(): string {
  const taken = new Set(world.tribes.map((t) => t.color));
  const free = TRIBE_COLORS.filter((c) => !taken.has(c.color));
  return (free.length > 0 ? pick(free) : pick(TRIBE_COLORS)).color;
}

function foundTribe(p: Thing, now: number): void {
  if (world.tribes.length >= MAX_TRIBES || !canBe("land", p.x, p.y)) return;
  const taken = new Set(world.tribes.map((t) => t.name));
  let name = tribeNameFor(p.name ?? randomName(), Math.random());
  while (taken.has(name)) name = tribeNameFor(p.name ?? randomName(), Math.random());

  const left = tribeOf(p)?.name;
  const tribe = createTribe(name, freeColor());
  p.tribe = tribe.id;
  p.homing = 0;
  world.things.push({ type: "village", x: p.x, y: p.y, tribe: tribe.id, hp: 20 });
  world.effects.push(sparkle(p.x, p.y, now, tribe.color));
  say(left ? `${p.name} left ${left} and founded ${name}!` : `${p.name} founded ${name}!`);
  save();
}

// Builders are the only ones who can put up a laser cannon, a silo or a truck,
// and a tribe only gets so many before it has all the war it can handle.
const TECH_CHANCE = 1 / 2600;

function buildTech(p: Thing, now: number, census: Census): void {
  const mine = world.things.filter((t) => t.tribe === p.tribe && isTech(t.type)).length;
  if (mine >= TECH_PER_TRIBE) return;
  // The big ones only turn up once a tribe has some of the small ones, and a
  // machine that eats people is only worth it once there are people to spare.
  const crowd = census.people.get(p.tribe ?? "") ?? 0;
  const choices: TechId[] = mine < 1 ? ["laser-cannon", "truck"] : mine < 3 ? ["laser-cannon", "truck", "missile-silo"] : [...TECH_IDS];
  const affordable = choices.filter((id) => crowd > buildCost(id) + 5);
  if (affordable.length === 0) return;
  const type = pick(affordable);
  const x = p.x + (Math.random() - 0.5) * 24;
  const y = p.y + (Math.random() - 0.5) * 18;
  if (!canBe("land", x, y)) return;
  const cost = buildCost(type);
  if (cost > 0 && !feedToMachine(p, cost, now)) return;
  world.things.push({ type, x, y, tribe: p.tribe });
  world.effects.push(sparkle(x, y, now, tribeOf(p)?.color));
  say(
    cost > 0
      ? `${p.name} put ${cost} people into a ${TECH[type].name} for ${tribeOf(p)?.name}.`
      : `${p.name} built ${TECH[type].name} for ${tribeOf(p)?.name}.`
  );
  save();
}

/**
 * The people a machine costs. They are taken from the builder's own tribe,
 * nearest first, and they do not come back out. Placing a machine yourself
 * costs nothing: you are not one of them.
 */
function feedToMachine(builder: Thing, count: number, now: number): boolean {
  const offered = world.things
    .filter((t) => t !== builder && t.type === "person" && t.tribe === builder.tribe && !t.inside)
    .sort((a, b) => Math.hypot(a.x - builder.x, a.y - builder.y) - Math.hypot(b.x - builder.x, b.y - builder.y))
    .slice(0, count);
  if (offered.length < count) return false;
  const taken = new Set(offered);
  world.things = world.things.filter((t) => !taken.has(t));
  for (const person of offered) world.effects.push(sparkle(person.x, person.y, now, "#9fe3ff"));
  return true;
}

function buildVillage(p: Thing, now: number): void {
  const x = p.x + (Math.random() - 0.5) * 60;
  const y = p.y + (Math.random() - 0.5) * 40;
  const spot: Thing = { type: "village", x, y };
  if (!canBe("land", x, y) || nearest(spot, 25, (_, t) => isHome(t))) return;
  world.things.push({ ...spot, tribe: p.tribe, hp: 20 });
  world.effects.push(sparkle(x, y, now, tribeOf(p)?.color));
  say(`${p.name} built a new village for ${tribeOf(p)?.name}!`);
  save();
}
