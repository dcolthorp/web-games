import { traitName } from "./traits";
import type { Thing } from "./world";

// The roll call: every person and every mutant in the world, wherever they
// are, including the ones living down a cave. Nothing here touches the screen,
// so it can be tested on its own.

export interface Tribeish {
  id: string;
  name: string;
  color: string;
  enemies: string[];
}

export interface RosterEntry {
  person: Thing;
  name: string;
  kind: "Person" | "Mutant";
  tribeId: string;
  tribeName: string;
  color: string;
  traits: string[];
  // Where they are, and what they're up to right now.
  where: string;
  doing: string;
  hp: number;
  most: number;
  // Which mountain's cave they live in, if they live in one.
  home?: Thing;
}

export interface RosterFilter {
  tribe?: string;
  trait?: string;
  search?: string;
}

// Nobody is listed twice: a person is either out in the world or down a cave.
export const isFolk = (t: Thing): boolean => t.type === "person" || t.type === "mutant";

const NO_TRIBE = "No tribe";
const GREY = "#9aa0a8";

// People only. Bosses and mountains have their own rules for this elsewhere.
export function folkMaxHp(t: Thing): number {
  if (t.type === "mutant") return 30;
  return t.traits?.includes("strong") ? 8 : 5;
}

/** Where a person is: out in the open, or down inside a particular mountain. */
function placeOf(t: Thing, home: Thing | undefined, mountains: Thing[]): string {
  if (home) return `Living in ${mountainName(home, mountains)}`;
  if (t.inside) {
    const mountain = nearestMountain(t.inside, mountains);
    return mountain ? `Down inside ${mountainName(mountain, mountains)}` : "Down inside a mountain";
  }
  return "Out in the world";
}

function nearestMountain(at: [number, number], mountains: Thing[]): Thing | undefined {
  let best: Thing | undefined;
  let bestGap = Infinity;
  for (const m of mountains) {
    const gap = Math.hypot(m.x - at[0], m.y - at[1]);
    if (gap < bestGap) {
      bestGap = gap;
      best = m;
    }
  }
  return best;
}

// Mountains have no names, so they get numbered in the order they were made.
const mountainName = (m: Thing, mountains: Thing[]): string => `Mountain ${mountains.indexOf(m) + 1}`;

/** One line on what they are doing, most interesting thing first. */
function doingOf(t: Thing, underground: boolean): string {
  if (t.feud) return "Having it out with someone over an ore";
  if (t.seam) return "Digging towards a seam of ore";
  if (underground && t.traits?.includes("miner")) return "Mining, and not coming out";
  if (underground) return "Poking about underground";
  if ((t.warp ?? 0) > 0) return "Just came out of a teleporter";
  if ((t.homing ?? 0) > 0) return "Heading home";
  if ((t.hp ?? folkMaxHp(t)) < folkMaxHp(t)) return "Hurt, and keeping out of the way";
  if (t.traits?.includes("builder")) return "Looking for somewhere to build";
  return "Wandering about";
}

/**
 * Everybody, in one list: the people out on the map and the people living in
 * every cave. `things` is the world's things; each mountain carries its own.
 */
export function buildRoster(things: Thing[], tribes: Tribeish[]): RosterEntry[] {
  const mountains = things.filter((t) => t.type === "mountain");
  const entry = (t: Thing, home: Thing | undefined): RosterEntry => {
    const tribe = tribes.find((tr) => tr.id === t.tribe);
    const underground = Boolean(home) || Boolean(t.inside);
    return {
      person: t,
      name: t.name ?? "Somebody",
      kind: t.type === "mutant" ? "Mutant" : "Person",
      tribeId: tribe?.id ?? "",
      tribeName: tribe?.name ?? NO_TRIBE,
      color: tribe?.color ?? GREY,
      traits: (t.traits ?? []).map(traitName),
      where: placeOf(t, home, mountains),
      doing: doingOf(t, underground),
      hp: Math.min(t.hp ?? folkMaxHp(t), folkMaxHp(t)),
      most: folkMaxHp(t),
      ...(home ? { home } : {}),
    };
  };

  const list = things.filter(isFolk).map((t) => entry(t, undefined));
  for (const mountain of mountains) {
    for (const t of mountain.caveThings ?? []) if (isFolk(t)) list.push(entry(t, mountain));
  }
  return list;
}

/** Narrow the list down: one tribe, one trait, or a bit of a name. */
export function filterRoster(list: RosterEntry[], filter: RosterFilter): RosterEntry[] {
  const search = (filter.search ?? "").trim().toLowerCase();
  return list.filter((e) => {
    if (filter.tribe !== undefined && filter.tribe !== "" && e.tribeId !== realTribe(filter.tribe)) return false;
    if (filter.trait) {
      const wanted = traitName(filter.trait).toLowerCase();
      if (!e.traits.some((t) => t.toLowerCase() === wanted)) return false;
    }
    if (search && !e.name.toLowerCase().includes(search) && !e.tribeName.toLowerCase().includes(search)) return false;
    return true;
  });
}

// "none" means the people who never joined a tribe, whose tribe id is "".
const realTribe = (id: string): string => (id === "none" ? "" : id);

/** In tribe order, then by name, so the list doesn't jump about. */
export function sortRoster(list: RosterEntry[]): RosterEntry[] {
  return [...list].sort((a, b) => a.tribeName.localeCompare(b.tribeName) || a.name.localeCompare(b.name));
}

export interface Tally {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** How many people each tribe has, biggest first, with the tribeless last. */
export function tallyTribes(list: RosterEntry[], tribes: Tribeish[]): Tally[] {
  const counts = new Map<string, number>();
  for (const e of list) counts.set(e.tribeId, (counts.get(e.tribeId) ?? 0) + 1);
  const named: Tally[] = tribes.map((t) => ({ id: t.id, name: t.name, color: t.color, count: counts.get(t.id) ?? 0 }));
  named.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const loners = counts.get("") ?? 0;
  if (loners > 0) named.push({ id: "none", name: NO_TRIBE, color: GREY, count: loners });
  return named;
}

/** The one line at the top: how many people, and how many are underground. */
export function rosterSummary(list: RosterEntry[]): string {
  const people = list.length;
  const underground = list.filter((e) => e.where !== "Out in the world").length;
  const hurt = list.filter((e) => e.hp < e.most).length;
  const bits = [`${people} ${people === 1 ? "person" : "people"}`];
  if (underground > 0) bits.push(`${underground} underground`);
  if (hurt > 0) bits.push(`${hurt} hurt`);
  return bits.join(" · ");
}
