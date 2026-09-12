import { CATEGORIES, CELESTIAL_IDS, CHOICES, MAGIC } from "./catalog";
import { physics } from "./matrix";
import type { Choice } from "./sprites";
import { EFFECT_MS, say, save, world, type Effect } from "./state";
import { H, TSUNAMI_MS, W, isLand, tsunamiRadius, waveReaches, type Thing } from "./world";

// Everything that happens in the world on its own, apart from people.

export const canBe = (habitat: Choice["habitat"], x: number, y: number): boolean =>
  habitat === "air" || isLand(world.heights, x, y) === (habitat === "land");

export const sparkle = (x: number, y: number, now: number, color = "#f7d23e"): Effect => ({
  kind: "sparkle",
  x,
  y,
  born: now,
  color,
});

const aOrAn = (name: string): string => `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name.toLowerCase()}`;

// Takes a step the way it's heading, and turns around instead if that would
// leave the map or its kind of ground.
export function step(t: Thing, habitat: Choice["habitat"], speed: number): void {
  const heading = t.heading ?? 0;
  const nx = t.x + Math.cos(heading) * speed;
  const ny = t.y + Math.sin(heading) * speed;
  if (nx < 4 || ny < 8 || nx > W - 4 || ny > H - 1 || (!physics.noWalls && !canBe(habitat, nx, ny))) {
    t.heading = heading + Math.PI;
    return;
  }
  t.x = nx;
  t.y = ny;
}

export function wander(t: Thing, habitat: Choice["habitat"], speed = habitat === "air" ? 0.25 : 0.12): void {
  t.heading ??= Math.random() * Math.PI * 2;
  if (Math.random() < 0.02) t.heading += (Math.random() - 0.5) * 2;
  step(t, habitat, speed);
}

export function randomSpot(habitat: Choice["habitat"]): { x: number; y: number } {
  for (let tries = 0; tries < 200; tries += 1) {
    const x = 6 + Math.random() * (W - 12);
    const y = 10 + Math.random() * (H - 12);
    if (canBe(habitat, x, y)) return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

// The closest thing within reach that `wanted` picks out. Creatures and
// celestial beings never pick on each other.
export function nearest(from: Thing, reach: number, wanted: (c: Choice, t: Thing) => boolean): Thing | undefined {
  let best: Thing | undefined;
  let bestDistance = reach;
  for (const t of world.things) {
    const c = CHOICES.get(t.type);
    if (t === from || !c || MAGIC.has(c.id) || !wanted(c, t)) continue;
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (d < bestDistance) {
      best = t;
      bestDistance = d;
    }
  }
  return best;
}

export function destroy(victim: Thing, effect: Effect, message: string): void {
  world.things = world.things.filter((t) => t !== victim);
  world.effects.push(effect);
  say(message);
  save();
}

export function nameOf(t: Thing): string {
  return t.name ?? CHOICES.get(t.type)?.name.toLowerCase() ?? "thing";
}

// ---------- tsunamis ----------

// Plants, animals, and people the wave rolls over get washed away. Sturdy
// things (hills, mountains, rocks, volcanoes, villages), sea creatures, and
// flyers stay.
function washAway(wave: { x: number; y: number; born: number }, now: number): void {
  const r = tsunamiRadius(now - wave.born);
  const before = world.things.length;
  world.things = world.things.filter((t) => {
    const c = CHOICES.get(t.type);
    if (!c || c.habitat !== "land" || c.sturdy) return true;
    const d = Math.hypot(t.x - wave.x, t.y - wave.y);
    return !(d <= r && d > r - 4 && waveReaches(world.heights, wave.x, wave.y, t.x, t.y));
  });
  if (world.things.length === before) return;
  say("The tsunami washed things away!");
  save();
}

export function updateWavesAndEffects(now: number): void {
  for (const wave of world.waves) washAway(wave, now);
  world.waves = world.waves.filter((wave) => now - wave.born < TSUNAMI_MS);
  world.effects = world.effects.filter((e) => now - e.born < EFFECT_MS[e.kind]);
}

// ---------- creatures and celestial beings ----------

const RAINBOW = ["#d8362b", "#ee7a2a", "#f7d23e", "#3f9a3a", "#3b7fe0", "#9b59d9"];

export function act(t: Thing, now: number): void {
  const behind = Math.cos(t.heading ?? 0) < 0 ? 4 : -4;
  if (t.type === "dragon" && Math.random() < 0.004) {
    const victim = nearest(t, 24, (c) => c.habitat === "land" && !c.sturdy);
    if (victim) destroy(victim, { kind: "fire", x: victim.x, y: victim.y, born: now, color: "" }, `The dragon burned ${nameOf(victim)}!`);
  } else if (t.type === "kraken" && Math.random() < 0.003) {
    const victim = nearest(t, 20, (c) => c.habitat === "sea");
    if (victim) destroy(victim, sparkle(victim.x, victim.y, now, "#f4f1ea"), `The kraken ate the ${nameOf(victim)}!`);
  } else if ((t.type === "unicorn" || t.type === "phoenix") && Math.random() < 0.3) {
    const color =
      t.type === "unicorn"
        ? (RAINBOW[Math.floor(now / 100) % RAINBOW.length] as string)
        : Math.random() < 0.5
          ? "#ee7a2a"
          : "#f7d23e";
    world.effects.push({ kind: "trail", x: t.x + behind, y: t.y - 3, born: now, color });
  } else if (CELESTIAL_IDS.has(t.type) && Math.random() < 0.005) {
    causeChaos(t, now);
  }
}

// A celestial being teleports somewhere random, and then something strange
// happens near where it lands.
function causeChaos(t: Thing, now: number): void {
  world.effects.push(sparkle(t.x, t.y, now));
  Object.assign(t, randomSpot("air"));
  world.effects.push(sparkle(t.x, t.y, now));

  const victim = nearest(t, 60, () => true);
  const vc = victim && CHOICES.get(victim.type);
  // Something else from the same toolbar that lives in the same place.
  const others = vc
    ? (CATEGORIES.find((cat) => cat.choices.includes(vc))?.choices.filter((o) => o !== vc && o.habitat === vc.habitat) ?? [])
    : [];
  const roll = Math.random();

  if (victim && vc && others.length > 0 && roll < 0.5) {
    const other = others[Math.floor(Math.random() * others.length)] as Choice;
    victim.type = other.id;
    world.effects.push(sparkle(victim.x, victim.y, now));
    say(`A celestial being turned ${aOrAn(vc.name)} into ${aOrAn(other.name)}!`);
  } else if (victim && vc && roll < 0.85) {
    Object.assign(victim, randomSpot(vc.habitat));
    world.effects.push(sparkle(victim.x, victim.y, now));
    say(`A celestial being teleported ${victim.name ?? aOrAn(vc.name)} away!`);
  } else {
    world.waves.push({ ...randomSpot("sea"), born: now });
    say("A celestial being summoned a tsunami!");
  }
  save();
}
