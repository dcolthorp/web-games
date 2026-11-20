// Every element in Make Elements, and every way to make one.
//
// Weight is how gravity treats it: "fall" drops down, "rise" floats up, and
// "float" just stays wherever it is left.

export type Weight = "fall" | "rise" | "float";

export interface Element {
  id: string;
  name: string;
  emoji: string;
  color: string;
  weight: Weight;
  // Sells for this much.
  value: number;
  // Heats up anything next to it: burns flammable stuff, boils water, melts ice.
  heater?: boolean;
  // Catches fire next to a heater, and turns into `burnsInto`.
  flammable?: boolean;
  burnsInto?: string;
  // Next to a heater (but not flammable), it turns into this, like water to steam.
  heatsInto?: string;
  blurb: string;
}

export const ELEMENTS: Element[] = [
  // The four you can get spawners for. Everything else has to be made.
  { id: "earth", name: "Earth", emoji: "🌍", color: "#7a5230", weight: "fall", value: 1, blurb: "Dirt. The ground. Where everything starts." },
  { id: "water", name: "Water", emoji: "💧", color: "#2f7fe0", weight: "fall", value: 1, heatsInto: "steam", blurb: "Wet. Turns to steam next to anything hot." },
  { id: "fire", name: "Fire", emoji: "🔥", color: "#ff6a1f", weight: "float", value: 1, heater: true, blurb: "A heater. Burns anything flammable next to it." },
  { id: "air", name: "Air", emoji: "💨", color: "#bfe8ff", weight: "float", value: 1, blurb: "You can't see it, but here it is anyway." },

  { id: "mud", name: "Mud", emoji: "🟤", color: "#6b4a2b", weight: "fall", value: 3, heatsInto: "clay", blurb: "Earth and water. Put it next to fire, or leave it still for a minute, and it dries into clay." },
  { id: "lava", name: "Lava", emoji: "🌋", color: "#e0401c", weight: "fall", value: 3, heater: true, blurb: "Earth and fire. A heater. Leave it still for a minute and it cools into stone." },
  { id: "steam", name: "Steam", emoji: "♨️", color: "#d9e4ea", weight: "rise", value: 3, blurb: "Water and fire. Floats up." },
  { id: "dust", name: "Dust", emoji: "🌫️", color: "#b5a58c", weight: "float", value: 3, blurb: "Earth and air. Achoo! Underrated. Mix it with water, fire or electricity, or just leave it alone for a while." },
  { id: "smoke", name: "Smoke", emoji: "💭", color: "#8d8d94", weight: "rise", value: 8, blurb: "Dust and fire. Floats up." },
  { id: "static", name: "Static", emoji: "⚡", color: "#fff27a", weight: "float", value: 15, blurb: "Dust and electricity. Zap! Makes your hair stand up." },
  { id: "dust-bunny", name: "Dust Bunny", emoji: "🐰", color: "#d8cbb8", weight: "fall", value: 40, blurb: "Dust that sat still for 30 seconds and came alive. Sort of." },
  { id: "wind", name: "Wind", emoji: "🌬️", color: "#9fd8e8", weight: "float", value: 3, blurb: "Air and air. Whoosh." },

  { id: "stone", name: "Stone", emoji: "🪨", color: "#8a8a8a", weight: "fall", value: 7, blurb: "Lava and water. Or lava that sat still for a minute." },
  { id: "clay", name: "Clay", emoji: "🟫", color: "#c98a5a", weight: "fall", value: 6, blurb: "Dried-out mud." },
  { id: "brick", name: "Brick", emoji: "🧱", color: "#b0472f", weight: "fall", value: 8, blurb: "Mud and fire." },
  { id: "ice", name: "Ice", emoji: "🧊", color: "#a8e6ff", weight: "fall", value: 8, heatsInto: "water", blurb: "Wind and water. Melts next to anything hot." },
  { id: "mist", name: "Mist", emoji: "🫧", color: "#cfe9f5", weight: "float", value: 10, blurb: "Steam that floated up for a long time." },
  { id: "dew", name: "Dew", emoji: "💦", color: "#7fc4ef", weight: "fall", value: 5, blurb: "Steam that stayed still so long it turned back into little drops." },
  { id: "cloud", name: "Cloud", emoji: "☁️", color: "#f2f6fa", weight: "rise", value: 8, blurb: "Steam and air. Floats up." },
  { id: "metal", name: "Metal", emoji: "🔩", color: "#6f7f8f", weight: "fall", value: 12, blurb: "Stone and fire." },
  { id: "silver", name: "Silver", emoji: "🥈", color: "#c8ced6", weight: "fall", value: 25, blurb: "Metal and water. Shiny! Keep it moving for a whole minute and see what happens." },
  { id: "quicksilver", name: "Quicksilver", emoji: "🪩", color: "#e8eef5", weight: "fall", value: 120, blurb: "Silver that kept moving for a whole minute without stopping." },
  { id: "sand", name: "Sand", emoji: "🏖️", color: "#e6c98a", weight: "fall", value: 10, blurb: "Stone and air." },
  { id: "rain", name: "Rain", emoji: "🌧️", color: "#5d8fd1", weight: "fall", value: 10, blurb: "Cloud and water." },
  { id: "pottery", name: "Pottery", emoji: "🏺", color: "#c4703c", weight: "fall", value: 18, blurb: "Clay and fire." },
  { id: "tornado", name: "Tornado", emoji: "🌪️", color: "#8a9aa8", weight: "float", value: 20, blurb: "Wind and cloud." },

  { id: "plant", name: "Plant", emoji: "🌱", color: "#4caf50", weight: "fall", value: 12, flammable: true, burnsInto: "ash", blurb: "Rain and earth. Flammable. Leave it still for a minute and it flowers." },
  { id: "glass", name: "Glass", emoji: "🪟", color: "#bfe6f0", weight: "fall", value: 22, blurb: "Sand and fire." },
  { id: "wood", name: "Wood", emoji: "🪵", color: "#9c6b3c", weight: "fall", value: 16, flammable: true, burnsInto: "charcoal", blurb: "Plant and earth. Flammable. Drop it on earth and see what grows." },
  { id: "ash", name: "Ash", emoji: "⚪", color: "#9a9a9a", weight: "fall", value: 2, blurb: "What's left after a plant burns." },
  { id: "charcoal", name: "Charcoal", emoji: "⚫", color: "#2b2b2b", weight: "fall", value: 20, blurb: "Wood that got burned." },
  { id: "flower", name: "Flower", emoji: "🌸", color: "#ff8ac2", weight: "fall", value: 30, flammable: true, burnsInto: "ash", blurb: "A plant that sat still for a whole minute." },
  { id: "tree", name: "Tree", emoji: "🌳", color: "#2e8b3a", weight: "fall", value: 40, flammable: true, burnsInto: "ash", blurb: "Made when wood falls onto earth." },
  { id: "time", name: "Time", emoji: "⌛", color: "#d9b25a", weight: "float", value: 35, blurb: "Glass and sand. An hourglass." },
  { id: "electricity", name: "Electricity", emoji: "🔌", color: "#ffd21f", weight: "float", value: 8, blurb: "Fire and air." },
  { id: "storm", name: "Storm", emoji: "⛈️", color: "#4a5a70", weight: "rise", value: 45, blurb: "Cloud and electricity. Floats up." },
  { id: "fruit", name: "Fruit", emoji: "🍎", color: "#e0302f", weight: "fall", value: 60, blurb: "Tree and time." },
  { id: "life", name: "Life", emoji: "🧬", color: "#7ad46a", weight: "fall", value: 70, blurb: "Electricity and mud. It's alive!" },
  { id: "robot", name: "Robot", emoji: "🤖", color: "#9aa8b8", weight: "fall", value: 80, blurb: "Electricity and metal." },
];

// The only elements you can buy spawners for (Oscar).
export const STARTERS = ["earth", "water", "fire", "air"];

const byId = new Map(ELEMENTS.map((e) => [e.id, e]));

export function element(id: string): Element {
  const found = byId.get(id);
  if (!found) throw new Error(`No element called ${id}`);
  return found;
}

// Two elements going into a combiner. Order doesn't matter. A few give you
// more than one thing.
const COMBOS: [string, string, string | string[]][] = [
  ["earth", "water", "mud"],
  ["earth", "fire", "lava"],
  ["water", "fire", "steam"],
  ["earth", "air", "dust"],
  // Dust Appreciation Week (Oscar): dust finally does stuff.
  ["dust", "water", "clay"],
  ["dust", "fire", "smoke"],
  ["dust", "electricity", "static"],
  // Oscar: fire and air make electricity. (Energy got deleted.)
  ["air", "fire", "electricity"],
  ["air", "air", "wind"],
  ["lava", "water", "stone"],
  ["mud", "fire", "brick"],
  ["wind", "water", "ice"],
  ["steam", "air", "cloud"],
  ["stone", "fire", "metal"],
  ["stone", "air", "sand"],
  ["metal", "water", "silver"],
  ["cloud", "water", "rain"],
  ["clay", "fire", "pottery"],
  ["wind", "cloud", "tornado"],
  ["rain", "earth", "plant"],
  ["sand", "fire", "glass"],
  ["plant", "earth", "wood"],
  ["glass", "sand", "time"],
  ["cloud", "electricity", "storm"],
  ["tree", "time", "fruit"],
  ["electricity", "metal", "robot"],
  ["electricity", "mud", "life"],
  ["life", "fire", "ash"],
];

const comboKey = (a: string, b: string) => [a, b].sort().join("+");
const comboMap = new Map(COMBOS.map(([a, b, out]) => [comboKey(a, b), typeof out === "string" ? [out] : out]));

export function combine(a: string, b: string): string[] | undefined {
  return comboMap.get(comboKey(a, b));
}

// Achievements. Some combos give you one.
export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  how: string;
  // Shown when you click the 🔒 ??? before you've got it.
  hint: string;
  // Combining these two gets it.
  combo?: [string, string];
  // Finding all of these gets it.
  needs?: string[];
}

export const ACHIEVEMENTS: Achievement[] = [
  // Oscar's: burn up Life.
  { id: "you-monster", name: "You Monster", emoji: "😱", how: "Put Life and Fire in a combiner.", hint: "Be really mean to something that's alive.", combo: ["life", "fire"] },
  // Oscar's: a whole block of Speeders, as fast as it gets.
  { id: "speeder-network", name: "Speeder Network", emoji: "⏩", how: "Build a block of Speeders 7 wide and 2 tall (or 2 wide and 7 tall).", hint: "Lots of Speeders, all packed together into one long block." },
  // Oscar's: celebrate Dust by making everything Dust can make.
  { id: "dust-appreciation-week", name: "Dust Appreciation Week", emoji: "🧹", how: "Make all three things that come from Dust: 💭 Smoke, ⚡ Static and a 🐰 Dust Bunny.", hint: "Show Dust some love.", needs: ["smoke", "static", "dust-bunny"] },
];

export function comboAchievement(a: string, b: string): Achievement | undefined {
  return ACHIEVEMENTS.find((ach) => ach.combo && comboKey(ach.combo[0], ach.combo[1]) === comboKey(a, b));
}

// Special conditions, besides combining.

// Something falls and lands right on top of something else.
// Both get replaced by the result. Oscar's: wood falling on earth makes a tree.
export const LANDINGS: { falling: string; onto: string; makes: string }[] = [
  { falling: "wood", onto: "earth", makes: "tree" },
];

// Something stays in one place without moving for this many seconds.
export const STAY_STILL: { id: string; seconds: number; makes: string }[] = [
  { id: "mud", seconds: 60, makes: "clay" },
  { id: "lava", seconds: 60, makes: "stone" },
  { id: "plant", seconds: 60, makes: "flower" },
  { id: "steam", seconds: 20, makes: "dew" },
  { id: "dust", seconds: 30, makes: "dust-bunny" },
];

// Something keeps moving (any way: belts, falling, getting pushed) without
// stopping for this many seconds.
export const KEEP_MOVING: { id: string; seconds: number; makes: string }[] = [
  { id: "silver", seconds: 60, makes: "quicksilver" },
];

// Something keeps floating up (without being carried) for this many seconds.
export const FLOAT_UP: { id: string; seconds: number; makes: string }[] = [
  { id: "steam", seconds: 3, makes: "mist" },
];

// How each element gets made, for the Elemepiedia.
export function howToMake(id: string): string[] {
  const ways: string[] = [];
  if (STARTERS.includes(id)) ways.push("You can buy a spawner for it.");
  for (const [a, b, out] of COMBOS) {
    if (out === id || out.includes(id)) ways.push(`${element(a).emoji} ${element(a).name} + ${element(b).emoji} ${element(b).name} in a combiner`);
  }
  for (const l of LANDINGS) {
    if (l.makes === id) ways.push(`${element(l.falling).emoji} ${element(l.falling).name} falls onto ${element(l.onto).emoji} ${element(l.onto).name}`);
  }
  for (const m of KEEP_MOVING) {
    if (m.makes === id) ways.push(`${element(m.id).emoji} ${element(m.id).name} keeps moving for ${m.seconds} seconds without stopping`);
  }
  for (const f of FLOAT_UP) {
    if (f.makes === id) ways.push(`${element(f.id).emoji} ${element(f.id).name} floats up for ${f.seconds} seconds without stopping`);
  }
  for (const s of STAY_STILL) {
    if (s.makes === id) ways.push(`${element(s.id).emoji} ${element(s.id).name} stays still for ${s.seconds} seconds`);
  }
  for (const e of ELEMENTS) {
    if (e.burnsInto === id) ways.push(`${e.emoji} ${e.name} burns next to fire or lava, or goes in an Oven`);
    if (e.heatsInto === id) ways.push(`${e.emoji} ${e.name} sits next to fire or lava, or goes in an Oven`);
  }
  return ways;
}

// A hint for an element you haven't found yet, for the ??? in the Elemepiedia.
// It tells you exactly how to make it (Oscar wanted the whole answer).
export function hintFor(id: string): string {
  const ways = howToMake(id);
  if (ways.length === 0) return "Nobody knows how to make this one yet!";
  return ways.join(". Or: ") + ".";
}
