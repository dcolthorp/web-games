// Math with Ollie: Penelope's math adventure. You are Ollie. A monster
// stomps through Sunny Village and smashes everything, and Ollie fixes it
// all up by doing math. (Penelope says there's a battlefield later. We'll
// get to that!)

const W = 960;
const H = 600;
const PER_JOB = 3; // math problems to fix one thing
const SAVE_KEY = "math-with-ollie";

type Level = "easy" | "medium" | "hard";
type Kind = "house" | "condo" | "bakery" | "mess" | "well" | "garden" | "bridge" | "hut" | "store" | "cactus" | "tower" | "plushie";
type Layout = "river" | "canyon"; // a river on the left, or a canyon on the right

interface Job {
  id: string;
  kind: Kind;
  title: string; // what you're doing
  who: string; // the villager who needs help
  ask: string; // what they say
  color: string; // house colour
  shirt: string; // villager's shirt
  x: number;
  y: number; // where it sits on the ground
  fix: number; // how fixed it looks right now, 0 (smashed) to 1 (all better)
  solved: number; // math problems done for it
  sign?: string; // a sign on the roof (shops)
  nibble?: number; // Slimy Swamp: how nibbled by fish it looks
}

const sunnyJobs: Job[] = [
  { id: "bridge", kind: "bridge", title: "Fix the bridge!", who: "Captain Finn", ask: "The monster broke my bridge! Nobody can cross the river!", color: "#9a6334", shirt: "#3b82f6", x: 145, y: 410, fix: 1, solved: 0 },
  { id: "rosie", kind: "house", title: "Fix Rosie's house!", who: "Rosie", ask: "The monster smashed my house! Can you help me?", color: "#ff8fbf", shirt: "#ff6fa8", x: 330, y: 270, fix: 1, solved: 0 },
  { id: "max", kind: "house", title: "Fix Max's house!", who: "Max", ask: "My house fell down! Help!", color: "#7fb2ff", shirt: "#4cc76a", x: 545, y: 245, fix: 1, solved: 0 },
  { id: "bea", kind: "condo", title: "Fix Grandma B's condo!", who: "Grandma B", ask: "Oh dear, oh dear! My condo is all broken!", color: "#ffd25e", shirt: "#c084fc", x: 775, y: 275, fix: 1, solved: 0 },
  { id: "garden", kind: "garden", title: "Replant Lily's garden!", who: "Lily", ask: "The monster stomped on all my flowers!", color: "#ff6fa8", shirt: "#ffd23f", x: 285, y: 520, fix: 1, solved: 0 },
  { id: "mess", kind: "mess", title: "Clean up the big mess!", who: "Tom", ask: "There's junk everywhere! Help me clean it up!", color: "#8a8f98", shirt: "#ff8a3d", x: 470, y: 515, fix: 1, solved: 0 },
  { id: "bakery", kind: "bakery", title: "Fix the bakery!", who: "Baker Sam", ask: "My bakery! Where will everybody get cookies?!", color: "#ffb36b", shirt: "#ffffff", x: 665, y: 505, fix: 1, solved: 0, sign: "🍪 BAKERY" },
  { id: "well", kind: "well", title: "Fix the well!", who: "Mia", ask: "The well is smashed! We need water!", color: "#9aa3ad", shirt: "#2fbfa8", x: 870, y: 470, fix: 1, solved: 0 },
];

// Across the bridge: a village in the Badlands. (Penelope: a baby monster
// turns into the big monster, the baby turns into a plushie, the monster
// hugs it, drops it, and the whole village explodes. So you fix it!)
const badJobs: Job[] = [
  { id: "canyon", kind: "bridge", title: "Fix the canyon bridge!", who: "Ranger Rae", ask: "The canyon bridge blew up! It's the way to the monster!", color: "#9a6334", shirt: "#e8383d", x: 850, y: 410, fix: 1, solved: 0 },
  { id: "dot", kind: "hut", title: "Fix Sheriff Dot's hut!", who: "Sheriff Dot", ask: "KABOOM! My hut got blown to bits!", color: "#e0a86a", shirt: "#9a6334", x: 270, y: 265, fix: 1, solved: 0 },
  { id: "pablo", kind: "hut", title: "Fix Pablo's hut!", who: "Pablo", ask: "My hut went BOOM! Can you help?", color: "#d98c5f", shirt: "#2fbfa8", x: 480, y: 245, fix: 1, solved: 0 },
  { id: "store", kind: "store", title: "Fix the general store!", who: "Miss Penny", ask: "The store exploded! All my candy went flying!", color: "#c97b4a", shirt: "#ff6fa8", x: 690, y: 270, fix: 1, solved: 0, sign: "🏪 STORE" },
  { id: "junk", kind: "mess", title: "Clean up the explosion mess!", who: "Rosa", ask: "There's junk everywhere from the explosion!", color: "#8a8f98", shirt: "#ffd23f", x: 120, y: 455, fix: 1, solved: 0 },
  { id: "cactus", kind: "cactus", title: "Replant the cactus garden!", who: "Cody", ask: "All my cactuses got blown over!", color: "#4cc76a", shirt: "#4cc76a", x: 290, y: 525, fix: 1, solved: 0 },
  { id: "plushie", kind: "plushie", title: "Sew the plushie back together!", who: "Junie", ask: "The baby monster plushie got all torn up! Can you sew it?", color: "#c9a0f0", shirt: "#c084fc", x: 480, y: 515, fix: 1, solved: 0 },
  { id: "tower", kind: "tower", title: "Fix the water tower!", who: "Hank", ask: "The water tower blew up! We're so thirsty!", color: "#9a6334", shirt: "#3b82f6", x: 680, y: 505, fix: 1, solved: 0 },
];
// Penelope: two villages, then you fight a monster, two villages, then a
// monster... six monsters, so twelve villages. Each pair gets wrecked by the
// monster you fight next.
interface Palette {
  skyTop: string; skyBottom: string; sun: string;
  hill: string; ground: string; far: string; // far: the hills or mesas way back
  water: string; waterDark: string; // the river, or the canyon
  path: string; deco: "tuft" | "cactus" | "pine" | "mushroom" | "rock" | "crystal"; decoColor: string;
}
interface AreaInfo { id: string; name: string; layout: Layout; monster: number; pal: Palette; jobs: Job[] }

const RIVER_SLOTS: [Kind, number, number][] = [
  ["bridge", 145, 410], ["house", 330, 270], ["house", 545, 245], ["condo", 775, 275],
  ["garden", 285, 520], ["mess", 470, 515], ["bakery", 665, 505], ["well", 870, 470],
];
const CANYON_SLOTS: [Kind, number, number][] = [
  ["bridge", 850, 410], ["hut", 270, 265], ["hut", 480, 245], ["store", 690, 270],
  ["mess", 120, 455], ["garden", 290, 525], ["well", 480, 515], ["tower", 680, 505],
];
const SHIRTS = ["#3b82f6", "#ff6fa8", "#4cc76a", "#c084fc", "#ffd23f", "#ff8a3d", "#2fbfa8", "#e8383d"];

/** The jobs for a new village: who lives there, the colours of their homes, and the shop. */
function makeJobs(id: string, layout: Layout, who: string[], homes: string[], shop: string, desert = false): Job[] {
  const slots = layout === "river" ? RIVER_SLOTS : CANYON_SLOTS;
  let home = 0;
  return slots.map(([kind0, x, y], i): Job => {
    const kind: Kind = kind0 === "garden" && desert ? "cactus" : kind0;
    const name = who[i]!;
    const base = { id: `${id}-${i}`, kind, who: name, shirt: SHIRTS[i]!, x, y, fix: 1, solved: 0, color: "#9a6334" };
    if (kind === "house" || kind === "condo" || kind === "hut") {
      return { ...base, color: homes[home++ % homes.length]!, title: `Fix ${name}'s ${kind}!`, ask: `The monster wrecked my ${kind}! Can you help me?` };
    }
    if (kind === "bakery" || kind === "store") {
      return { ...base, color: homes[home++ % homes.length]!, sign: shop, title: "Fix the shop!", ask: "My shop got wrecked! Everything went flying!" };
    }
    const jobs: Record<string, [string, string]> = {
      bridge: ["Fix the bridge!", "The monster broke the bridge! It's the only way out!"],
      garden: [`Replant ${name}'s garden!`, "All my flowers got squished!"],
      cactus: ["Replant the cactus garden!", "All my cactuses got knocked over!"],
      mess: ["Clean up the big mess!", "There's junk everywhere! Help me clean it up!"],
      well: ["Fix the well!", "The well is smashed! We need water!"],
      tower: ["Fix the water tower!", "The water tower fell down! We're so thirsty!"],
    };
    const [title, ask] = jobs[kind]!;
    return { ...base, title, ask };
  });
}

const AREAS: AreaInfo[] = [
  { id: "sunny", name: "Sunny Village", layout: "river", monster: 0, jobs: sunnyJobs,
    pal: { skyTop: "#8fd0ff", skyBottom: "#d6efff", sun: "#ffd23f", far: "#9edb8a", hill: "#9edb8a", ground: "#86cf72", water: "#5fb8ff", waterDark: "#ffffff", path: "#e3c896", deco: "tuft", decoColor: "#6cbf5a" } },
  { id: "badlands", name: "the Badlands", layout: "canyon", monster: 0, jobs: badJobs,
    pal: { skyTop: "#ff9a5a", skyBottom: "#ffe0a8", sun: "#fff4c9", far: "#c2603a", hill: "#e8b878", ground: "#dca868", water: "#7a3f22", waterDark: "#4a2410", path: "#c9925a", deco: "cactus", decoColor: "#5aa84a" } },
  { id: "swamp", name: "Slimy Swamp", layout: "river", monster: 1,
    jobs: makeJobs("swamp", "river", ["Froggy Fran", "Lou", "Mo", "Grandpa Gus", "Lily Pad", "Bog", "Chef Toad", "Wren"], ["#8fbf6a", "#b8a070", "#6aa88a"], "🐸 SNACKS"),
    pal: { skyTop: "#9ab88a", skyBottom: "#e0ecc8", sun: "#fff4c9", far: "#6a9a50", hill: "#7aa860", ground: "#6a9a50", water: "#4f7f4f", waterDark: "#b8e0a0", path: "#b8a070", deco: "tuft", decoColor: "#4a7a3a" } },
  { id: "mushroom", name: "Mushroom Forest", layout: "canyon", monster: 1,
    jobs: makeJobs("mushroom", "canyon", ["Ranger Ivy", "Pip", "Fern", "Mr. Morel", "Moss", "Bramble", "Acorn", "Twig"], ["#e8383d", "#ff8a3d", "#c084fc"], "🍄 SHOP"),
    pal: { skyTop: "#6a8ac8", skyBottom: "#c8d8f0", sun: "#fff4c9", far: "#3a7a4a", hill: "#5aa860", ground: "#4a9850", water: "#4a3a2a", waterDark: "#2a1a10", path: "#a8885a", deco: "mushroom", decoColor: "#e8383d" } },
  { id: "volcano", name: "Volcano Town", layout: "river", monster: 2,
    jobs: makeJobs("volcano", "river", ["Captain Ash", "Ember", "Blaze", "Grandma Cinder", "Sunny", "Flint", "Baker Coal", "Ruby"], ["#c9a08a", "#a8a8b8", "#e0b090"], "🌶️ SPICY"),
    pal: { skyTop: "#5a2a2a", skyBottom: "#ff8a5a", sun: "#ffb36b", far: "#6a4a4a", hill: "#7a5a5a", ground: "#6a4a48", water: "#ff6a1a", waterDark: "#ffd23f", path: "#8a6a5a", deco: "rock", decoColor: "#4a3a3a" } },
  { id: "ash", name: "Ash Desert", layout: "canyon", monster: 2,
    jobs: makeJobs("ash", "canyon", ["Ranger Smoky", "Dusty", "Sandy", "Miss Pepper", "Clay", "Cactus Jack", "Sol", "Spark"], ["#c9b0a0", "#b8a090", "#d8c0a8"], "🔥 SHOP", true),
    pal: { skyTop: "#8a7a7a", skyBottom: "#e8d0b8", sun: "#fff4c9", far: "#5a5050", hill: "#b8a898", ground: "#a89888", water: "#ff5a1a", waterDark: "#c22a0a", path: "#8a7a6a", deco: "cactus", decoColor: "#6a9a5a" } },
  { id: "snowy", name: "Snowy Village", layout: "river", monster: 3,
    jobs: makeJobs("snowy", "river", ["Captain Frost", "Holly", "Jack", "Granny Snow", "Ivy", "Flake", "Cocoa Carl", "Belle"], ["#ff8fbf", "#7fb2ff", "#ffd25e"], "☕ COCOA"),
    pal: { skyTop: "#a8c8e8", skyBottom: "#eef6ff", sun: "#fff4c9", far: "#ffffff", hill: "#ffffff", ground: "#eef4fb", water: "#bfe6ff", waterDark: "#ffffff", path: "#d8e0ea", deco: "pine", decoColor: "#2f7a4a" } },
  { id: "icy", name: "Icy Mountains", layout: "canyon", monster: 3,
    jobs: makeJobs("icy", "canyon", ["Ranger Glacier", "Yeti Yolanda", "Chilly", "Mr. Mittens", "Sleet", "Pine", "Igloo Ida", "Frosty"], ["#bfe6ff", "#e6f6ff", "#c8d8ff"], "🧊 SHOP"),
    pal: { skyTop: "#7ab0e0", skyBottom: "#e0f0ff", sun: "#fff4c9", far: "#c8dcf0", hill: "#e8f2ff", ground: "#dce8f8", water: "#6a9ad0", waterDark: "#3a6aa0", path: "#c8d4e4", deco: "pine", decoColor: "#2f6a5a" } },
  { id: "rocky", name: "Rocky Hills", layout: "river", monster: 4,
    jobs: makeJobs("rocky", "river", ["Captain Cobble", "Pebble", "Slate", "Granny Granite", "Daisy", "Gravel", "Baker Boulder", "Opal"], ["#c8b8a0", "#a8b8c8", "#d8c8b0"], "🍪 BAKERY"),
    pal: { skyTop: "#8fb8d8", skyBottom: "#d8e8f0", sun: "#ffd23f", far: "#9aa890", hill: "#a8b898", ground: "#98a888", water: "#5f98c8", waterDark: "#ffffff", path: "#c8c0b0", deco: "rock", decoColor: "#7a7f88" } },
  { id: "crystal", name: "Crystal Caves", layout: "canyon", monster: 4,
    jobs: makeJobs("crystal", "canyon", ["Ranger Gem", "Amethyst", "Quartz", "Miss Sparkle", "Glint", "Shimmer", "Jade", "Beryl"], ["#c9a0f0", "#a0d8f0", "#f0a0d0"], "💎 SHOP"),
    pal: { skyTop: "#3a2a5a", skyBottom: "#8a6ab0", sun: "#e6dcff", far: "#5a4a7a", hill: "#8a7aa8", ground: "#7a6a98", water: "#2a1a4a", waterDark: "#120628", path: "#a898c8", deco: "crystal", decoColor: "#5fe0ff" } },
  { id: "rainbow", name: "Rainbow Clouds", layout: "river", monster: 5,
    jobs: makeJobs("rainbow", "river", ["Captain Prism", "Sky", "Stormy", "Granny Glow", "Petal", "Puff", "Baker Sprinkles", "Aurora"], ["#ff8fbf", "#ffd25e", "#7fb2ff", "#8fe08a"], "🧁 CUPCAKES"),
    pal: { skyTop: "#ffb8dc", skyBottom: "#cfe6ff", sun: "#ffd23f", far: "#ffffff", hill: "#ffffff", ground: "#f4f0ff", water: "#c084fc", waterDark: "#ffffff", path: "#ffe0f0", deco: "tuft", decoColor: "#e0a8ff" } },
  { id: "golden", name: "Golden Sky City", layout: "canyon", monster: 5,
    jobs: makeJobs("golden", "canyon", ["Ranger Halo", "Goldie", "Sunbeam", "Queen Honey", "Glimmer", "Marigold", "Nova", "Stella"], ["#ffd25e", "#fff0a0", "#ffc070"], "👑 SHOP"),
    pal: { skyTop: "#ffd27a", skyBottom: "#fff4c9", sun: "#ffffff", far: "#ffe8a0", hill: "#fff0c0", ground: "#ffe8b0", water: "#c9a0d8", waterDark: "#a080c0", path: "#ffd27a", deco: "crystal", decoColor: "#ffd23f" } },
];
let areaIdx = 0; // the village you're looking at
let progressIdx = 0; // the village your adventure is up to
let jobs = sunnyJobs;
const allJobs = AREAS.flatMap((a) => a.jobs);
const here = (): AreaInfo => AREAS[areaIdx]!;
/** Go to a village. `adventure` false is just teleporting there for a visit. */
function goToArea(i: number, adventure = true): void {
  areaIdx = Math.max(0, Math.min(AREAS.length - 1, i));
  Object.assign(gim, { fishPhase: "none", fishJob: null, twister: null, penguin: null, boulder: null, shooting: null, next: 6, dudeX: dudeUnlocked ? 380 : -40 });
  if (adventure) progressIdx = areaIdx;
  jobs = here().jobs;
}
const visiting = (): boolean => areaIdx !== progressIdx;
const finished = (a: AreaInfo): boolean => a.jobs.every((j) => j.solved >= PER_JOB);
const AREA_EMOJI: Record<string, string> = {
  sunny: "🌳", badlands: "🌵", swamp: "🐸", mushroom: "🍄", volcano: "🌋", ash: "🔥",
  snowy: "⛄", icy: "🏔️", rocky: "🪨", crystal: "💎", rainbow: "🌈", golden: "👑",
};

// ---- Saving ----

interface Save {
  level: Level;
  seen: boolean; // watched the monster come
  solved: Record<string, number>;
  beaten?: boolean; // beat the monster at the battlefield
  area?: string; // which village you're in
  monster?: number; // how many monsters you've beaten
  coins?: number; // math coins: one for every right answer
}
function load(): Save | null {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Save | null;
  } catch {
    return null;
  }
}
// Penelope asked for autosave: it saves every time something changes, and
// when you come back you're right where you were.
let savedTimer = 0;
function save(): void {
  const data: Save = { level, seen: true, solved: Object.fromEntries(allJobs.map((j) => [j.id, j.solved])), beaten, area: AREAS[progressIdx]!.id, monster: monsterNo, coins };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    return; // Can't save? You can still play.
  }
  const el = document.getElementById("saved");
  if (!el) return;
  el.hidden = false;
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => (el.hidden = true), 1500);
}

// ---- The page ----

const canvas = document.getElementById("map") as HTMLCanvasElement;
// `let` so the character picker can borrow the drawing code for its little pictures.
let ctx = canvas.getContext("2d")!;
const caption = document.getElementById("caption")!;
const fixedEl = document.getElementById("fixed")!;
const skipButton = document.getElementById("skip") as HTMLButtonElement;
const restartButton = document.getElementById("restart") as HTMLButtonElement;
const titleEl = document.getElementById("title")!;
const jobEl = document.getElementById("job")!;
const continueButton = document.getElementById("continue") as HTMLButtonElement;
const hintEl = document.getElementById("hint")!;
const teleportOpen = document.getElementById("teleport-open") as HTMLButtonElement;

let level: Level = "easy";
let mode: "title" | "cutscene" | "play" | "battle" | "beat" = "title";
let beaten = false;
let monsterNo = 0; // how many monsters you've beaten (the one you fight next)
let coins = 0; // math coins, for keeping going when a monster gets you
const coinsEl = document.getElementById("coins")!;
function addCoin(): void {
  coins++;
  coinsEl.textContent = `🪙 ${coins}`;
}
let sceneT = 0;
let shake = 0;

const saved = load();
if (saved) {
  level = saved.level;
  beaten = saved.beaten ?? false;
  monsterNo = saved.monster ?? 0;
  coins = saved.coins ?? 0;
  if (saved.seen && !beaten) continueButton.hidden = false;
}

const levelButtons = document.querySelectorAll<HTMLButtonElement>(".level");
function pickLevel(l: Level): void {
  level = l;
  levelButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["level"] === l)));
}
levelButtons.forEach((b) => b.addEventListener("click", () => pickLevel(b.dataset["level"] as Level)));
pickLevel(level);
coinsEl.textContent = `🪙 ${coins}`;

// ---- Ollie, the villagers and the monster ----

const ollie = { x: 480, y: 420, tx: 480, ty: 420, face: 1, walking: false, visible: false };
let goingTo: Job | null = null;
let crossing = false; // walking over the bridge to the next place
// Penelope: the bridge stays locked until everything else is fixed. Then
// you fix it, click it, and go to the next area (the battlefield).
const villageDone = (): boolean => jobs.every((j) => j.solved >= PER_JOB);
const bridgeLocked = (): boolean => jobs.some((j) => j.kind !== "bridge" && j.solved < PER_JOB);
const isBuilding = (k: Kind): boolean => k === "house" || k === "condo" || k === "bakery" || k === "hut" || k === "store";
const monster = { x: 1200, y: 430, on: false };

interface Bubble { x: number; y: number; text: string; until: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }
interface Pop { x: number; y: number; text: string; born: number }
let bubbles: Bubble[] = [];
let bits: Bit[] = [];
let pops: Pop[] = [];
let now = 0;

function dust(x: number, y: number, n = 24, colors = ["#c9b79c", "#a08c70", "#8a8f98"]): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 180;
    bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 1, color: colors[i % colors.length]!, size: 4 + Math.random() * 8 });
  }
}
function confetti(x: number, y: number): void {
  dust(x, y, 40, ["#ff6fa8", "#ffd23f", "#4cc76a", "#3b82f6", "#c084fc", "#ff8a3d"]);
}

/** Where each villager stands, next to their thing. */
const villagerSpot = (j: Job): { x: number; y: number } => {
  if (j.kind === "bridge") return { x: j.x + 75, y: j.y + 40 };
  if (isBuilding(j.kind)) return { x: j.x + 85, y: j.y + 12 };
  return { x: j.x - 65, y: j.y + 8 };
};

// ---- Drawing ----

function background(): void {
  const pal = here().pal;
  if (here().layout === "canyon") canyonBackground(pal);
  else riverBackground(pal);
}

function skyAndSun(pal: Palette, to: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, to);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, to);
  ctx.fillStyle = pal.sun;
  ctx.beginPath();
  ctx.arc(SUN.x, SUN.y, SUN.r, 0, Math.PI * 2);
  ctx.fill();
}

function clouds(): void {
  for (const [cx, cy, s] of [[180, 50, 1], [460, 35, 0.8], [650, 70, 1.1]] as const) {
    const drift = ((cx + now * 8) % (W + 200)) - 100;
    ctx.fillStyle = "#ffffff";
    for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 26], [50, 0, 20], [24, 8, 20]] as const) {
      ctx.beginPath();
      ctx.arc(drift + dx * s, cy + dy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Little things dotted around: grass, cactuses, pine trees, mushrooms, rocks or crystals. */
function decoration(pal: Palette, x: number, y: number): void {
  const clicked = gim.boing.get(`${x},${y}`);
  const age = clicked === undefined ? 9 : now - clicked;
  if (age < 1) {
    // boing! (or a crystal ringing)
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 - Math.sin(age * 20) * 0.25 * (1 - age), 1 + Math.sin(age * 20) * 0.4 * (1 - age));
    ctx.translate(-x, -y);
    if (pal.deco === "crystal") {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 20;
    }
    gim.boing.delete(`${x},${y}`);
    decoration(pal, x, y);
    gim.boing.set(`${x},${y}`, clicked!);
    ctx.restore();
    return;
  }
  const c = pal.decoColor;
  ctx.fillStyle = c;
  ctx.strokeStyle = c;
  if (pal.deco === "tuft") {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y - 8);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y - 8);
    ctx.stroke();
  } else if (pal.deco === "cactus") {
    ctx.beginPath();
    ctx.roundRect(x - 5, y - 30, 10, 30, 5);
    ctx.roundRect(x - 14, y - 22, 7, 12, 3);
    ctx.roundRect(x + 7, y - 26, 7, 12, 3);
    ctx.fill();
  } else if (pal.deco === "pine") {
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(x - 3, y - 10, 6, 10);
    ctx.fillStyle = c;
    for (const [w, top] of [[22, 46], [16, 34], [10, 24]] as const) {
      ctx.beginPath();
      ctx.moveTo(x - w, y - 10 - (46 - top) * 0.6);
      ctx.lineTo(x, y - 10 - top);
      ctx.lineTo(x + w, y - 10 - (46 - top) * 0.6);
      ctx.fill();
    }
  } else if (pal.deco === "mushroom") {
    ctx.fillStyle = "#fff4e0";
    ctx.fillRect(x - 4, y - 14, 8, 14);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y - 14, 14, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 5, y - 20, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 18, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (pal.deco === "rock") {
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.lineTo(x - 4, y - 30);
    ctx.lineTo(x + 4, y - 22);
    ctx.lineTo(x + 9, y);
    ctx.fill();
  }
}

function riverBackground(pal: Palette): void {
  skyAndSun(pal, 150);
  clouds();
  // hills and ground
  ctx.fillStyle = pal.hill;
  ctx.beginPath();
  ctx.moveTo(0, 160);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hillY(x));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 300, W, H - 300);
  // the river
  ctx.fillStyle = pal.water;
  ctx.beginPath();
  for (let y = 140; y <= H; y += 10) ctx.lineTo(112 + Math.sin(y / 50) * 10, y);
  for (let y = H; y >= 140; y -= 10) ctx.lineTo(182 + Math.sin(y / 50) * 10, y);
  ctx.fill();
  ctx.strokeStyle = pal.waterDark;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const y = 160 + ((i * 80 + now * 30) % 440);
    ctx.beginPath();
    ctx.moveTo(135 + Math.sin(y / 50) * 10, y);
    ctx.lineTo(155 + Math.sin(y / 50) * 10, y + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the path through the village
  ctx.fillStyle = pal.path;
  ctx.beginPath();
  ctx.moveTo(185, 395);
  ctx.bezierCurveTo(400, 370, 600, 420, W, 385);
  ctx.lineTo(W, 425);
  ctx.bezierCurveTo(600, 460, 400, 410, 185, 430);
  ctx.fill();
  const many = pal.deco === "tuft" ? 40 : 8;
  for (let i = 0; i < many; i++) decoration(pal, 200 + ((i * 197) % 740), 170 + ((i * 113) % 420));
}

function canyonBackground(pal: Palette): void {
  skyAndSun(pal, 160);
  clouds();
  // flat-topped hills (mesas) far away
  ctx.fillStyle = pal.far;
  for (const [mx, mw, mh] of [[120, 160, 70], [420, 120, 55], [640, 200, 80]] as const) {
    ctx.beginPath();
    ctx.moveTo(mx - mw / 2 - 20, 150);
    ctx.lineTo(mx - mw / 2, 150 - mh);
    ctx.lineTo(mx + mw / 2, 150 - mh);
    ctx.lineTo(mx + mw / 2 + 20, 150);
    ctx.fill();
  }
  ctx.fillStyle = pal.hill;
  ctx.beginPath();
  ctx.moveTo(0, 160);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hillY(x));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 300, W, H - 300);
  // the canyon, with the bridge over it
  ctx.fillStyle = pal.water;
  ctx.beginPath();
  for (let y = 150; y <= H; y += 20) ctx.lineTo(805 + Math.sin(y / 23) * 8, y);
  for (let y = H; y >= 150; y -= 20) ctx.lineTo(895 + Math.cos(y / 19) * 8, y);
  ctx.fill();
  ctx.fillStyle = pal.waterDark;
  ctx.fillRect(830, 150, 40, H - 150);
  // the path
  ctx.fillStyle = pal.path;
  ctx.beginPath();
  ctx.moveTo(0, 395);
  ctx.bezierCurveTo(300, 380, 550, 425, 800, 395);
  ctx.lineTo(800, 430);
  ctx.bezierCurveTo(550, 460, 300, 415, 0, 430);
  ctx.fill();
  for (const [dx, dy] of CANYON_DECO) decoration(pal, dx, dy);
}

function rubble(x: number, y: number, amount: number, seed: number): void {
  if (amount <= 0.02) return;
  const colors = ["#a08c70", "#8a8f98", "#c9b79c", "#7a6650"];
  for (let i = 0; i < 12; i++) {
    const r = ((seed * 31 + i * 17) % 100) / 100;
    const r2 = ((seed * 7 + i * 53) % 100) / 100;
    const bx = x + (r - 0.5) * 130 * amount;
    const by = y - r2 * 30 * amount;
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(r * 3);
    ctx.fillRect(-9 * amount - 3, -6 * amount - 2, 18 * amount + 6, 12 * amount + 4);
    ctx.restore();
  }
}

function drawHouse(j: Job): void {
  const { x, y, fix } = j;
  // Grandma B lives in a condo: taller, with a flat roof and lots of windows.
  const condo = j.kind === "condo";
  const w = condo ? 120 : 130, h = condo ? 160 : 95;
  const seed = j.x;
  if (fix < 1) {
    // the roof fell off and lies on the ground
    ctx.save();
    ctx.translate(x - 85, y - 8);
    ctx.rotate(-0.5);
    ctx.globalAlpha = 1 - fix;
    ctx.fillStyle = "#c2523d";
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.lineTo(0, -32);
    ctx.lineTo(40, 0);
    ctx.fill();
    ctx.restore();
  }
  const wallH = h * (fix < 1 ? 0.25 + 0.6 * fix : 1);
  ctx.fillStyle = j.color;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - wallH);
  if (fix < 1) {
    // a broken, jaggy top
    for (let i = 1; i < 8; i++) ctx.lineTo(x - w / 2 + (w * i) / 8, y - wallH + ((i * seed) % 3) * 9);
  }
  ctx.lineTo(x + w / 2, y - wallH);
  ctx.lineTo(x + w / 2, y);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // door
  ctx.fillStyle = "#8a5a2b";
  const doorH = Math.min(48, wallH - 4);
  ctx.fillRect(x - 15, y - doorH, 30, doorH);
  if (fix >= 1) {
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(x + 8, y - 24, 3, 0, Math.PI * 2);
    ctx.fill();
    if (condo) {
      for (const wy of [y - 72, y - 110, y - 148]) {
        for (const wx of [x - 30, x + 30]) {
          if (wy === y - 72 && Math.abs(wx - x) < 20) continue;
          ctx.fillStyle = "#d6efff";
          ctx.fillRect(wx - 14, wy, 28, 24);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.strokeRect(wx - 14, wy, 28, 24);
          if (wy < y - 72) {
            // a little balcony
            ctx.strokeStyle = "#8a5a2b";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(wx - 18, wy + 26);
            ctx.lineTo(wx + 18, wy + 26);
            for (let r = -18; r <= 18; r += 6) {
              ctx.moveTo(wx + r, wy + 26);
              ctx.lineTo(wx + r, wy + 18);
            }
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = "#8a6a8a"; // flat roof
      ctx.fillRect(x - w / 2 - 8, y - h - 12, w + 16, 14);
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 12px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CONDO", x, y - h - 1);
      rubble(x, y + 6, 1 - fix, seed);
      return;
    }
    if (j.kind === "hut") {
      // a clay hut: round windows, a flat roof with wooden beams poking out
      ctx.fillStyle = "#5a3a1b";
      for (const wx of [x - 42, x + 42]) {
        ctx.beginPath();
        ctx.arc(wx, y - 62, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#b0703a";
      ctx.fillRect(x - w / 2 - 4, y - h - 10, w + 8, 12);
      ctx.fillStyle = "#7a4a22";
      for (let bx = x - w / 2 + 10; bx < x + w / 2; bx += 26) ctx.fillRect(bx, y - h + 4, 10, 8);
      rubble(x, y + 6, 1 - fix, seed);
      return;
    }
    // windows
    for (const wx of [x - 45, x + 45]) {
      ctx.fillStyle = "#d6efff";
      ctx.fillRect(wx - 14, y - 72, 28, 26);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(wx - 14, y - 72, 28, 26);
      ctx.beginPath();
      ctx.moveTo(wx, y - 72);
      ctx.lineTo(wx, y - 46);
      ctx.stroke();
    }
    // roof
    ctx.fillStyle = "#c2523d";
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 14, y - h);
    ctx.lineTo(x, y - h - 62);
    ctx.lineTo(x + w / 2 + 14, y - h);
    ctx.fill();
    if (j.sign) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 46, y - h - 4, 92, 26);
      ctx.fillStyle = "#8a5a2b";
      ctx.font = "800 17px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(j.sign, x, y - h + 15);
    } else {
      ctx.fillStyle = "#9a6334";
      ctx.fillRect(x + 30, y - h - 50, 16, 34); // chimney
    }
  } else {
    // cracks
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 40, y - wallH + 6);
    ctx.lineTo(x - 30, y - wallH + 22);
    ctx.lineTo(x - 42, y - wallH + 34);
    ctx.moveTo(x + 38, y - wallH + 4);
    ctx.lineTo(x + 46, y - wallH + 20);
    ctx.stroke();
  }
  rubble(x, y + 6, 1 - fix, seed);
}

function drawMess(j: Job): void {
  const left = 1 - j.fix;
  if (left <= 0.02) {
    // all clean: little flowers instead
    for (const [dx, c] of [[-30, "#ff6fa8"], [0, "#ffd23f"], [30, "#c084fc"]] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(j.x + dx, j.y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const s = 0.4 + 0.6 * left;
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.scale(s, s);
  ctx.fillStyle = "#b08a5a";
  ctx.fillRect(-60, -30, 40, 30); // box
  ctx.fillStyle = "#8a6a3c";
  ctx.save();
  ctx.rotate(-0.3);
  ctx.fillRect(-20, -50, 90, 12); // plank
  ctx.restore();
  ctx.fillStyle = "#8a8f98";
  ctx.beginPath();
  ctx.arc(20, -14, 18, 0, Math.PI * 2); // a can
  ctx.fill();
  ctx.fillStyle = "#e8383d";
  ctx.fillRect(-10, -18, 22, 18);
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(60, -26);
  ctx.lineTo(70, 0);
  ctx.fill();
  ctx.restore();
  // flies buzzing around the junk
  ctx.fillStyle = "#2f2a5a";
  for (let i = 0; i < 3; i++) {
    const a = now * 4 + i * 2;
    ctx.beginPath();
    ctx.arc(j.x + Math.cos(a) * 40 * s, j.y - 50 * s + Math.sin(a * 1.3) * 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWell(j: Job): void {
  const { x, y, fix } = j;
  const ringH = 14 + 26 * fix;
  ctx.fillStyle = "#9aa3ad";
  ctx.fillRect(x - 36, y - ringH, 72, ringH);
  ctx.fillStyle = "#3b6ea8";
  ctx.beginPath();
  ctx.ellipse(x, y - ringH, 36, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6b737d";
  ctx.lineWidth = 2;
  for (let row = 1; row * 13 < ringH; row++) {
    ctx.beginPath();
    ctx.moveTo(x - 36, y - row * 13);
    ctx.lineTo(x + 36, y - row * 13);
    ctx.stroke();
  }
  if (fix >= 1) {
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(x - 34, y - ringH - 60, 7, 60);
    ctx.fillRect(x + 27, y - ringH - 60, 7, 60);
    ctx.fillStyle = "#c2523d";
    ctx.beginPath();
    ctx.moveTo(x - 46, y - ringH - 56);
    ctx.lineTo(x, y - ringH - 86);
    ctx.lineTo(x + 46, y - ringH - 56);
    ctx.fill();
    ctx.strokeStyle = "#5a3a1b";
    ctx.beginPath();
    ctx.moveTo(x, y - ringH - 56);
    ctx.lineTo(x, y - ringH - 30);
    ctx.stroke();
    ctx.fillStyle = "#8a6a3c";
    ctx.fillRect(x - 8, y - ringH - 32, 16, 14); // bucket
  } else {
    ctx.fillStyle = "#8a5a2b";
    ctx.save();
    ctx.translate(x + 50, y - 4);
    ctx.rotate(1.3);
    ctx.fillRect(-3, -30, 7, 60); // a fallen post
    ctx.restore();
  }
  rubble(x, y + 6, (1 - fix) * 0.7, j.y);
}

function drawGarden(j: Job): void {
  const { x, y, fix } = j;
  ctx.fillStyle = "#8a6a3c";
  ctx.beginPath();
  ctx.ellipse(x, y - 10, 75, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  const total = 9;
  const growing = Math.round(fix * total);
  const colors = ["#ff6fa8", "#ffd23f", "#c084fc", "#ff8a3d", "#e8383d"];
  for (let i = 0; i < total; i++) {
    const fx = x - 56 + (i % 5) * 28 + (i >= 5 ? 14 : 0);
    const fy = y - 18 + (i >= 5 ? 16 : 0);
    if (i < growing) {
      ctx.strokeStyle = "#3fae5a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 22);
      ctx.stroke();
      ctx.fillStyle = colors[i % colors.length]!;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 + now * 0.5;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 6, fy - 24 + Math.sin(a) * 6, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(fx, fy - 24, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // squashed flat
      ctx.strokeStyle = "#5a7a3a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx - 8, fy);
      ctx.lineTo(fx + 10, fy - 4);
      ctx.stroke();
    }
  }
}

function drawBridge(j: Job): void {
  const { x, y, fix } = j;
  const planks = 8;
  const whole = Math.round(fix * planks);
  ctx.fillStyle = "#7a5230";
  ctx.fillRect(x - 58, y - 30, 8, 44);
  ctx.fillRect(x + 50, y - 30, 8, 44);
  for (let i = 0; i < planks; i++) {
    // planks fill in from both sides
    const fromEdge = Math.min(i, planks - 1 - i);
    if (fromEdge >= Math.ceil(whole / 2) && whole < planks) continue;
    ctx.fillStyle = i % 2 ? "#a8723f" : "#9a6334";
    ctx.fillRect(x - 54 + i * 13.5, y - 14, 12, 30);
  }
  if (fix >= 1) {
    ctx.strokeStyle = "#7a5230";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 54, y - 26);
    ctx.lineTo(x + 54, y - 26);
    ctx.stroke();
  }
}

function drawPerson(x: number, y: number, shirt: string, happy: boolean, hair = "#5a3a1b", jump = 0): void {
  const by = y - jump;
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(x, y, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.roundRect(x - 12, by - 34, 24, 30, 9);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffd9b8";
  ctx.beginPath();
  ctx.arc(x, by - 46, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, by - 50, 13, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2f2a5a";
  ctx.beginPath();
  ctx.arc(x - 5, by - 46, 2, 0, Math.PI * 2);
  ctx.arc(x + 5, by - 46, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2f2a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (happy) ctx.arc(x, by - 42, 5, 0.2, Math.PI - 0.2);
  else ctx.arc(x, by - 36, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
  ctx.stroke();
  if (!happy) {
    ctx.fillStyle = "#5fb8ff"; // a tear
    ctx.beginPath();
    ctx.arc(x + 8, by - 41 + ((now * 20) % 6), 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Who you play as ----
// Penelope: Ollie is a black cat, with a collar that says OLLIE. And there's
// a button to change your character.

type Skin = "cat" | "kid" | "orange" | "puppy" | "bunny" | "dude";
const SKINS: { id: Skin; name: string }[] = [
  { id: "cat", name: "🐈‍⬛ Ollie the black cat" },
  { id: "kid", name: "🦸 Hero kid" },
  { id: "orange", name: "🐱 Orange cat" },
  { id: "puppy", name: "🐶 Puppy" },
  { id: "bunny", name: "🐰 Bunny" },
  { id: "dude", name: "🤠 Badlands Dude" }, // a secret: hit all the targets in the Badlands
];
const SKIN_KEY = "math-with-ollie-skin";
let skin: Skin = "cat";
try {
  const s = localStorage.getItem(SKIN_KEY) as Skin | null;
  if (s && SKINS.some((k) => k.id === s)) skin = s;
} catch {
  // no saving: Ollie the black cat it is
}

function drawOllie(x = ollie.x, y = ollie.y): void {
  if (!ollie.visible) return;
  const step = ollie.walking ? Math.sin(now * 14) : 0;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (skin === "kid") drawKid(x, y, step);
  else if (skin === "dude") drawDude(x, y, step);
  else if (skin === "puppy") drawAnimal(x, y, step, { fur: "#b07a4a", belly: "#f0d8b8", ear: "floppy", eye: "#2f2a5a", collar: "#3b82f6" });
  else if (skin === "bunny") drawAnimal(x, y, step, { fur: "#f6f2f8", belly: "#ffffff", ear: "long", eye: "#2f2a5a", collar: "#ff6fa8" });
  else if (skin === "orange") drawAnimal(x, y, step, { fur: "#ff9a3d", belly: "#ffd8a8", ear: "cat", eye: "#4cc76a", collar: "#6a3fd1", stripes: true });
  else drawAnimal(x, y, step, { fur: "#24222e", belly: "#3a3846", ear: "cat", eye: "#c8f06a", collar: "#e8383d" });
}

interface AnimalLook { fur: string; belly: string; ear: "cat" | "floppy" | "long"; eye: string; collar: string; stripes?: boolean }

/** Ollie as an animal: a cat (or puppy or bunny) with a collar that says OLLIE. */
function drawAnimal(x: number, y: number, step: number, look: AnimalLook): void {
  const f = ollie.face;
  const cat = look.ear === "cat";
  // tail, swishing behind
  ctx.strokeStyle = look.fur;
  ctx.lineWidth = look.ear === "long" ? 0 : 7;
  ctx.lineCap = "round";
  if (look.ear === "long") {
    ctx.fillStyle = look.belly;
    ctx.beginPath();
    ctx.arc(x - f * 16, y - 20, 8, 0, Math.PI * 2); // a fluffy bunny tail
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - f * 12, y - 18);
    ctx.quadraticCurveTo(x - f * 34, y - 30 + Math.sin(now * 5) * 6, x - f * (24 + Math.sin(now * 5) * 6), y - (cat ? 56 : 40));
    ctx.stroke();
  }
  // legs
  ctx.strokeStyle = look.fur;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 14);
  ctx.lineTo(x - 7 + step * 5, y - 2);
  ctx.moveTo(x + 7, y - 14);
  ctx.lineTo(x + 7 - step * 5, y - 2);
  ctx.stroke();
  // body
  ctx.fillStyle = look.fur;
  ctx.beginPath();
  ctx.ellipse(x, y - 26, 17, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.belly;
  ctx.beginPath();
  ctx.ellipse(x, y - 22, 9, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // ears
  if (cat) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.fur;
      ctx.beginPath();
      ctx.moveTo(x + s * 6, y - 74);
      ctx.lineTo(x + s * 17, y - 88);
      ctx.lineTo(x + s * 19, y - 64);
      ctx.fill();
      ctx.fillStyle = "#ff9ac8";
      ctx.beginPath();
      ctx.moveTo(x + s * 9, y - 73);
      ctx.lineTo(x + s * 16, y - 82);
      ctx.lineTo(x + s * 17, y - 68);
      ctx.fill();
    }
  } else if (look.ear === "long") {
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.fur;
      ctx.beginPath();
      ctx.ellipse(x + s * 8, y - 92, 6, 20, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffb8dc";
      ctx.beginPath();
      ctx.ellipse(x + s * 8, y - 92, 3, 14, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // head
  ctx.fillStyle = look.fur;
  ctx.beginPath();
  ctx.arc(x, y - 60, 18, 0, Math.PI * 2);
  ctx.fill();
  if (look.stripes) {
    ctx.strokeStyle = "#d9661f";
    ctx.lineWidth = 3;
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y - 77);
      ctx.lineTo(x + dx, y - 69);
      ctx.stroke();
    }
  }
  if (look.ear === "floppy") {
    ctx.fillStyle = "#8a5a2b";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * 18, y - 60, 7, 15, s * -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // eyes (cats get slit pupils)
  for (const s of [-1, 1]) {
    const ex = x + s * 7 + f * 2;
    ctx.fillStyle = cat ? look.eye : "#ffffff";
    ctx.beginPath();
    ctx.ellipse(ex, y - 62, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cat ? "#111111" : look.eye;
    ctx.beginPath();
    if (cat) ctx.ellipse(ex, y - 62, 1.6, 5, 0, 0, Math.PI * 2);
    else ctx.arc(ex, y - 61, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex + 1.5, y - 64, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // nose, smile and whiskers
  ctx.fillStyle = look.ear === "floppy" ? "#2f2a5a" : "#ff8fbf";
  ctx.beginPath();
  ctx.moveTo(x - 3 + f * 2, y - 55);
  ctx.lineTo(x + 3 + f * 2, y - 55);
  ctx.lineTo(x + f * 2, y - 52);
  ctx.fill();
  ctx.strokeStyle = look.fur === "#24222e" ? "#bbbbcc" : "#2f2a5a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x - 2.5 + f * 2, y - 51, 2.5, 0.2, Math.PI - 0.2);
  ctx.arc(x + 2.5 + f * 2, y - 51, 2.5, 0.2, Math.PI - 0.2);
  if (cat || look.ear === "long") {
    for (const s of [-1, 1]) {
      ctx.moveTo(x + s * 6, y - 53);
      ctx.lineTo(x + s * 20, y - 56);
      ctx.moveTo(x + s * 6, y - 51);
      ctx.lineTo(x + s * 20, y - 50);
    }
  }
  ctx.stroke();
  // the collar that says OLLIE, with a little gold tag
  ctx.fillStyle = look.collar;
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 46, 30, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 7px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OLLIE", x, y - 41.6);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(x, y - 35, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The hero kid with a green cape (the first Ollie). */
function drawKid(x: number, y: number, step: number): void {
  // cape flaps behind
  ctx.fillStyle = "#2fae5a";
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 44);
  ctx.lineTo(x + 12, y - 44);
  ctx.lineTo(x + 16 - ollie.face * (10 + step * 4), y - 6);
  ctx.lineTo(x - 16 - ollie.face * (10 + step * 4), y - 6);
  ctx.fill();
  // legs
  ctx.strokeStyle = "#2f2a5a";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 14);
  ctx.lineTo(x - 6 + step * 5, y - 2);
  ctx.moveTo(x + 6, y - 14);
  ctx.lineTo(x + 6 - step * 5, y - 2);
  ctx.stroke();
  // body
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.roundRect(x - 14, y - 46, 28, 34, 10);
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.font = "900 16px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("O", x, y - 24);
  // head
  ctx.fillStyle = "#ffd9b8";
  ctx.beginPath();
  ctx.arc(x, y - 60, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8a3d"; // orange hair with a tuft
  ctx.beginPath();
  ctx.arc(x, y - 64, 16, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 78);
  ctx.quadraticCurveTo(x + 6, y - 92, x + 12, y - 84);
  ctx.quadraticCurveTo(x + 6, y - 82, x + 4, y - 76);
  ctx.fill();
  ctx.fillStyle = "#2f2a5a";
  ctx.beginPath();
  ctx.arc(x - 6 + ollie.face * 2, y - 60, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 6 + ollie.face * 2, y - 60, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2f2a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + ollie.face * 2, y - 55, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = "#ffb8dc";
  ctx.beginPath();
  ctx.arc(x - 11, y - 54, 3, 0, Math.PI * 2);
  ctx.arc(x + 11, y - 54, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** The monster: big, purple and grumpy (but not too scary). */
function drawMonster(x = monster.x, y = monster.y, nice = false): void {
  const step = Math.sin(now * 6);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x, y, 90, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // feet
  ctx.fillStyle = "#5a2fa0";
  ctx.beginPath();
  ctx.ellipse(x - 40, y - 12 - Math.max(0, step) * 26, 34, 18, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 40, y - 12 - Math.max(0, -step) * 26, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.fillStyle = "#7b4ad6";
  ctx.beginPath();
  ctx.ellipse(x, y - 130, 88, 115, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a07ae8";
  ctx.beginPath();
  ctx.ellipse(x, y - 105, 52, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  // arms waving
  ctx.strokeStyle = "#7b4ad6";
  ctx.lineWidth = 26;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 75, y - 150);
  ctx.lineTo(x - 125, y - 210 + step * 20);
  ctx.moveTo(x + 75, y - 150);
  ctx.lineTo(x + 125, y - 210 - step * 20);
  ctx.stroke();
  // horns
  ctx.fillStyle = "#fff4c9";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 30, y - 232);
    ctx.lineTo(x + s * 58, y - 290);
    ctx.lineTo(x + s * 60, y - 222);
    ctx.fill();
  }
  // grumpy eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + s * 30, y - 180, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f2a5a";
    ctx.beginPath();
    ctx.arc(x + s * 30 - 5, y - 176, 8, 0, Math.PI * 2);
    ctx.fill();
    if (nice) continue;
    ctx.strokeStyle = "#3a1a70";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + s * 12, y - 196);
    ctx.lineTo(x + s * 48, y - 206);
    ctx.stroke();
  }
  if (nice) {
    // a sorry little smile and pink cheeks
    ctx.strokeStyle = "#3a1a70";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y - 150, 24, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillStyle = "#ff9ad0";
    ctx.beginPath();
    ctx.arc(x - 55, y - 150, 12, 0, Math.PI * 2);
    ctx.arc(x + 55, y - 150, 12, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // mouth with two little teeth
  ctx.fillStyle = "#3a1a70";
  ctx.beginPath();
  ctx.ellipse(x, y - 140, 34, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 18, y - 154, 10, 12);
  ctx.fillRect(x + 8, y - 154, 10, 12);
}

function drawJob(j: Job): void {
  if (j === gim.fishJob && gim.fishPhase === "nibble") {
    const real = j.fix;
    j.fix = Math.min(real, 1 - 0.5 * Math.min(1, gim.fishT / 3));
    drawHouse(j);
    j.fix = real;
    return;
  }
  if (isBuilding(j.kind)) drawHouse(j);
  else if (j.kind === "mess") drawMess(j);
  else if (j.kind === "cactus") drawCactusGarden(j);
  else if (j.kind === "tower") drawTower(j);
  else if (j.kind === "plushie") drawPlushieJob(j);
  else if (j.kind === "well") drawWell(j);
  else if (j.kind === "garden") drawGarden(j);
  else drawBridge(j);
}

/** The ❗ that says "click me, I need help!" */
function drawAlert(j: Job, kind: "help" | "locked" | "go" = "help"): void {
  const top = { house: 175, condo: 215, bakery: 175, mess: 75, well: 120, garden: 60, bridge: 60, hut: 140, store: 175, cactus: 95, tower: 170, plushie: 70 }[j.kind];
  const bob = Math.sin(now * 4 + j.x) * 5;
  const ax = j.x;
  const ay = j.y - top + bob;
  ctx.fillStyle = { help: "#ffd23f", locked: "#c9ced6", go: "#ff8a3d" }[kind];
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ax, ay, kind === "go" ? 26 : 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (kind === "help") {
    ctx.font = "900 26px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#e8383d";
    ctx.fillText("!", ax, ay + 1);
  } else {
    ctx.font = "22px sans-serif";
    ctx.fillText(kind === "locked" ? "🔒" : areaIdx % 2 === 0 ? "➡️" : "⚔️", ax, ay + 1);
  }
  ctx.textBaseline = "alphabetic";
}

function drawBubble(b: Bubble): void {
  ctx.font = "800 16px Trebuchet MS, sans-serif";
  const w = ctx.measureText(b.text).width + 22;
  const bx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, b.x));
  const by = b.y;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#2f2a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx - w / 2, by - 34, w, 30, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2f2a5a";
  ctx.textAlign = "center";
  ctx.fillText(b.text, bx, by - 14);
}

function draw(): void {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  if (mode === "battle" || mode === "beat") {
    drawBattle();
    drawEffects();
    ctx.restore();
    return;
  }
  background();
  drawCracks();
  drawSky();
  drawSurprisesBack();
  // Everything sorted by where it stands, so nearer things are in front.
  const things: { y: number; draw: () => void }[] = [];
  for (const j of jobs) {
    // the plushie isn't torn up until the explosion
    if (!(j.kind === "plushie" && mode === "cutscene" && here().id === "badlands" && !scene.boomed)) things.push({ y: j.y, draw: () => drawJob(j) });
    const v = villagerSpot(j);
    const scared = mode === "cutscene" && monster.on && Math.abs(monster.x - v.x) < 260;
    const jump = scared || (j.fix >= 1 && j.solved >= PER_JOB && mode === "play") ? Math.abs(Math.sin(now * 8 + j.x)) * 10 : 0;
    things.push({ y: v.y, draw: () => drawPerson(v.x, v.y, j.shirt, j.fix >= 1 && !scared, j.id === "bea" ? "#dddddd" : "#5a3a1b", jump) });
  }
  things.push({ y: ollie.y, draw: drawOllie });
  const hugging = scene.plush === "held";
  if (monster.on) things.push({ y: monster.y, draw: () => {
    // the monster that wrecks this village
    ctx.save();
    ctx.translate(monster.x, monster.y);
    MONSTERS[here().monster]!.draw(hugging);
    ctx.restore();
  } });
  if (mode === "cutscene" && here().id === "badlands") {
    if (scene.baby) {
      const hop = Math.abs(Math.sin(now * 6)) * 24;
      things.push({ y: 400, draw: () => {
        ctx.save();
        ctx.translate(480, 400 - hop);
        ctx.scale(0.32, 0.32);
        drawMonster(0, 0, true);
        ctx.restore();
      } });
    }
    if (scene.plush === "ground" || scene.plush === "falling" || scene.plush === "dropped") {
      things.push({ y: Math.max(scene.py, 401), draw: () => drawPlushie(scene.px, scene.py, 1, 0) });
    }
  }
  things.sort((a, b) => a.y - b.y);
  for (const t of things) t.draw();
  drawSurprisesFront();
  if (hugging) drawPlushie(monster.x, monster.y - 95, 1.6, 0); // in the monster's arms
  if (mode === "play") {
    for (const j of jobs) {
      if (j.solved < PER_JOB) drawAlert(j, j.kind === "bridge" && bridgeLocked() ? "locked" : "help");
      else if (j.kind === "bridge" && villageDone() && !visiting()) drawAlert(j, "go");
    }
  }
  drawEffects();
  ctx.restore();
}

/** Dust, confetti, POW!s and speech bubbles, on top of everything. */
function drawEffects(): void {
  for (const h of floatHearts) {
    const age = now - h.born;
    ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💕", h.x + Math.sin(age * 4) * 8, h.y - age * 45);
  }
  ctx.globalAlpha = 1;
  for (const b of bits) {
    ctx.globalAlpha = Math.max(0, b.life);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
  }
  ctx.globalAlpha = 1;
  for (const p of pops) {
    const age = now - p.born;
    ctx.globalAlpha = Math.max(0, 1 - age / 1.2);
    ctx.font = `900 ${40 + age * 30}px Impact, Trebuchet MS, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8383d";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.strokeText(p.text, p.x, p.y - age * 40);
    ctx.fillText(p.text, p.x, p.y - age * 40);
  }
  ctx.globalAlpha = 1;
  for (const b of bubbles) drawBubble(b);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 244, 201, ${Math.min(1, flash)})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
}

// ---- Math in the sky ----
// Penelope's idea: plus signs roll along the hills, and sometimes a minus
// falls on one and they both go poof. A times sign circles the sun and then
// explodes. A division sign splits the sun in two, with a line between, and
// then the extra sun goes away.

const SUN = { x: 860, y: 55, r: 34 };
const hillY = (x: number): number => 140 + Math.sin(x / 90) * 14;
interface Plus { x: number; speed: number }
interface Minus { target: Plus; x: number; y: number; vy: number }
let pluses: Plus[] = [];
let minuses: Minus[] = [];
let nextPlus = 2;
let nextMinus = 8;
// Only one thing happens to the sun at a time.
let sunShow:
  | { kind: "times"; x: number; y: number; angle: number; circling: boolean; boomAt: number }
  | { kind: "divide"; x: number; y: number; split: number } // split: seconds since it hit the sun
  | null = null;
let nextSunShow = 5;

function poof(x: number, y: number): void {
  dust(x, y, 16, ["#ffffff", "#fff4c9", "#e6f6ff"]);
}

function updateSky(dt: number): void {
  nextPlus -= dt;
  if (nextPlus <= 0 && pluses.length < 3) {
    pluses.push({ x: -30, speed: 50 + Math.random() * 40 });
    nextPlus = 3 + Math.random() * 4;
  }
  for (const p of pluses) p.x += p.speed * dt;
  pluses = pluses.filter((p) => p.x < W + 40);

  nextMinus -= dt;
  const free = pluses.filter((p) => p.x > 80 && p.x < W - 200 && !minuses.some((m) => m.target === p));
  if (nextMinus <= 0 && free.length) {
    const target = free[Math.floor(Math.random() * free.length)]!;
    minuses.push({ target, x: target.x, y: -20, vy: 0 });
    nextMinus = 7 + Math.random() * 8;
  }
  for (const m of minuses) {
    m.vy += 300 * dt;
    m.y += m.vy * dt;
    m.x += (m.target.x - m.x) * Math.min(1, dt * 6); // aims at its plus
    if (m.y >= hillY(m.target.x) - 30) {
      poof(m.target.x, hillY(m.target.x) - 16);
      pluses = pluses.filter((p) => p !== m.target);
    }
  }
  minuses = minuses.filter((m) => pluses.includes(m.target));

  if (!sunShow) {
    nextSunShow -= dt;
    if (nextSunShow <= 0) {
      // Penelope wanted the division sign to come more often: 2 times out of 3.
      sunShow = Math.random() < 1 / 3
        ? { kind: "times", x: -30, y: 60, angle: Math.PI, circling: false, boomAt: 0 }
        : { kind: "divide", x: -30, y: 70, split: -1 };
      nextSunShow = 6 + Math.random() * 6;
    }
    return;
  }
  if (sunShow.kind === "times") {
    const t = sunShow;
    if (!t.circling) {
      // fly over to the sun
      const ox = SUN.x + Math.cos(t.angle) * 62;
      const oy = SUN.y + Math.sin(t.angle) * 44;
      const d = Math.hypot(ox - t.x, oy - t.y);
      const step = Math.min(d, 260 * dt);
      t.x += ((ox - t.x) / (d || 1)) * step;
      t.y += ((oy - t.y) / (d || 1)) * step;
      if (d < 3) {
        t.circling = true;
        t.boomAt = now + 2 + Math.random() * 4; // explodes whenever it feels like it
      }
    } else {
      t.angle += dt * 2.5;
      t.x = SUN.x + Math.cos(t.angle) * 62;
      t.y = SUN.y + Math.sin(t.angle) * 44;
      if (now >= t.boomAt) {
        dust(t.x, t.y, 30, ["#ff8a3d", "#e8383d", "#ffd23f", "#ffffff"]);
        pops.push({ x: t.x, y: t.y + 20, text: "BOOM!", born: now });
        shake = Math.max(shake, 5);
        sunShow = null;
      }
    }
  } else {
    const d = sunShow;
    if (d.split < 0) {
      const dist = Math.hypot(SUN.x - d.x, SUN.y - d.y);
      const step = Math.min(dist, 240 * dt);
      d.x += ((SUN.x - d.x) / (dist || 1)) * step;
      d.y += ((SUN.y - d.y) / (dist || 1)) * step;
      if (dist < SUN.r) d.split = 0;
    } else {
      d.split += dt;
      if (d.split > 3.6) sunShow = null;
    }
  }
}

function mathSign(text: string, x: number, y: number, color: string, size: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `900 ${size}px Trebuchet MS, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawSky(): void {
  for (const p of pluses) mathSign("+", p.x, hillY(p.x) - 16, "#4cc76a", 40, p.x / 16); // rolling!
  for (const m of minuses) mathSign("−", m.x, m.y, "#3b82f6", 40);
  if (!sunShow) return;
  if (sunShow.kind === "times") {
    mathSign("×", sunShow.x, sunShow.y, "#e8383d", 38, now * 3);
    return;
  }
  const d = sunShow;
  if (d.split < 0) {
    mathSign("÷", d.x, d.y, "#6a3fd1", 40);
    return;
  }
  // Two suns with a line between them; then the extra sun fades away.
  const slide = Math.min(1, d.split / 0.8);
  const fade = d.split < 2.6 ? 1 : Math.max(0, 1 - (d.split - 2.6));
  const copyX = SUN.x - 130 * slide;
  ctx.globalAlpha = fade;
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(copyX, SUN.y, SUN.r, 0, Math.PI * 2);
  ctx.fill();
  if (slide >= 1) {
    ctx.strokeStyle = "#6a3fd1";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(SUN.x - 65, SUN.y - 40);
    ctx.lineTo(SUN.x - 65, SUN.y + 40);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---- The monster comes (the cutscene) ----

const captions = (): [number, string][] => [
  [0, `This is ${here().name}. Everybody is happy! ☀️`],
  [3.5, "Uh oh... the ground is shaking! 😮"],
  [6, here().monster === 0 ? "A big monster is STOMPING all over the village! 😱" : `${MONSTERS[here().monster]!.name} is wrecking the village! 😱`],
  [11, "Everything is smashed... and the monster ran away over the bridge!"],
  [14, "Here comes Ollie! Ollie can fix everything with MATH! 💪"],
];
const SCENE_END = 18;

/** A brand new game, from the very first village. */
function startCutscene(): void {
  for (const j of allJobs) {
    j.solved = 0;
    j.fix = 1;
  }
  beaten = false;
  monsterNo = 0;
  startArea(0);
}

const VILLAGE_HINT = "Click a <strong>❗</strong> to help. Ollie walks there and you do math to fix it!";

/** Off to a village: watch it get wrecked, then fix it. */
function startArea(i: number): void {
  goToArea(i);
  hintEl.innerHTML = VILLAGE_HINT;
  for (const j of jobs) {
    j.solved = 0;
    j.fix = 1;
  }
  if (here().id === "badlands") {
    startBadlands();
    return;
  }
  mode = "cutscene";
  sceneT = 0;
  scene.boomed = false;
  scene.baby = false;
  scene.plush = "none";
  ollie.visible = false;
  monster.on = false;
  monster.x = 1200;
  monster.y = 430;
  bubbles = [];
  titleEl.hidden = true;
  battleEl.hidden = true;
  beatEl.hidden = true;
  caption.hidden = false;
  skipButton.hidden = false;
  restartButton.hidden = true;
  save(); // so coming back in the middle of it goes straight to fixing
  showFixed();
}

function updateCutscene(dt: number): void {
  if (here().id === "badlands") {
    updateBadlandsScene(dt);
    return;
  }
  sceneT += dt;
  const line = [...captions()].reverse().find(([t]) => sceneT >= t);
  if (line) caption.textContent = line[1];
  if (sceneT > 3.5 && sceneT < 13) {
    monster.on = true;
    monster.x = 1200 - ((sceneT - 3.5) / 9.5) * 1500;
    if (sceneT < 6) shake = Math.max(shake, 3);
    // The monster smashes whatever it walks past.
    for (const j of jobs) {
      if (j.fix > 0 && monster.x < j.x + 20) {
        j.fix = 0;
        shake = 16;
        dust(j.x, j.y - 30, 30);
        pops.push({ x: j.x, y: j.y - 120, text: "STOMP!", born: now });
        const v = villagerSpot(j);
        bubbles.push({ x: v.x, y: v.y - 64, text: "Oh no! 😱", until: now + 2 });
      }
    }
  } else monster.on = false;
  if (sceneT > 14 && !ollie.visible) {
    ollie.visible = true;
    ollie.x = 1000;
    ollie.y = 430;
    walkTo(560, 420);
  }
  if (sceneT > 16 && !bubbles.some((b) => b.text.startsWith("I'll help"))) {
    bubbles.push({ x: ollie.x, y: ollie.y - 96, text: "I'll help everybody! 🦸", until: now + 2.5 });
  }
  if (sceneT >= SCENE_END) startPlay();
}

function startPlay(): void {
  mode = "play";
  for (const j of jobs) j.fix = j.solved / PER_JOB;
  monster.on = false;
  scene.baby = false;
  scene.plush = "none";
  ollie.visible = true;
  caption.hidden = true;
  skipButton.hidden = true;
  restartButton.hidden = false;
  titleEl.hidden = true;
  hintEl.innerHTML = VILLAGE_HINT;
  save();
  showFixed();
  showVillageDone();
}

skipButton.addEventListener("click", () => {
  if (mode !== "cutscene") return;
  if (!ollie.visible) {
    ollie.visible = true;
    ollie.x = 560;
    ollie.y = 420;
  }
  startPlay();
});

// ---- Walking around the map ----

function walkTo(x: number, y: number): void {
  ollie.tx = Math.max(30, Math.min(W - 30, x));
  ollie.ty = Math.max(200, Math.min(H - 10, y));
}

canvas.addEventListener("click", (e) => {
  if (mode !== "play" || !jobEl.hidden) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W;
  const y = ((e.clientY - r.top) / r.height) * H;
  if (clickSurprise(x, y)) return;
  // Did you click something that needs fixing (or its ❗)?
  const hit = jobs.find(
    (j) => (j.solved < PER_JOB || (j.kind === "bridge" && villageDone())) && Math.abs(x - j.x) < 80 && y < j.y + 30 && y > j.y - 200,
  );
  crossing = false;
  if (hit?.kind === "bridge" && visiting()) {
    goingTo = null;
    const v = villagerSpot(hit);
    bubbles.push({ x: v.x, y: v.y - 64, text: "You're just visiting! Use 🌀 Teleport to go back.", until: now + 3 });
    return;
  }
  if (hit?.kind === "bridge" && bridgeLocked()) {
    goingTo = null;
    const v = villagerSpot(hit);
    bubbles.push({ x: v.x, y: v.y - 64, text: "Fix everything else first! 🔒", until: now + 2.5 });
    return;
  }
  if (hit?.kind === "bridge" && villageDone()) {
    // Over the bridge to the battlefield!
    goingTo = null;
    crossing = true;
    walkTo(hit.x, hit.y);
    return;
  }
  if (hit) {
    goingTo = hit;
    const v = villagerSpot(hit);
    walkTo(v.x + (v.x > hit.x ? 40 : -40), v.y + 10);
  } else {
    goingTo = null;
    walkTo(x, y);
  }
});

// ---- Math! ----

const answersEl = document.getElementById("answers")!;
const problemEl = document.getElementById("problem")!;
const noteEl = document.getElementById("job-note")!;
let job: Job | null = null;
let answer = 0;
let busy = false;

const rand = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

/** A math problem for your level, with 3 answers to pick from. */
function makeProblem(): { text: string; answer: number; choices: number[] } {
  // Penelope: harder and harder! The numbers get bigger in every village,
  // and for every monster.
  const stage = mode === "battle" ? monsterNo * 2 + 1.5 : areaIdx;
  const [start, step] = { easy: [10, 2], medium: [20, 4], hard: [50, 10] }[level];
  const max = Math.round(start! + step! * stage);
  let answer: number;
  let a: number, b: number, plus: boolean;
  if (Math.random() < 0.5) {
    plus = true;
    a = rand(level === "easy" ? 0 : 2, max - 1);
    b = rand(level === "easy" ? 0 : 1, max - a);
    answer = a + b;
  } else {
    plus = false;
    a = rand(level === "easy" ? 1 : 5, max);
    b = rand(0, a);
    answer = a - b;
  }
  const choices = new Set([answer]);
  while (choices.size < 3) {
    const wrong = answer + rand(-3, 3);
    if (wrong >= 0 && wrong !== answer) choices.add(wrong);
  }
  return { text: `${a} ${plus ? "+" : "−"} ${b} = ?`, answer, choices: [...choices].sort(() => Math.random() - 0.5) };
}

function newProblem(): void {
  const p = makeProblem();
  answer = p.answer;
  problemEl.textContent = p.text;
  answersEl.innerHTML = "";
  for (const n of p.choices) {
    const b2 = document.createElement("button");
    b2.type = "button";
    b2.className = "answer";
    b2.textContent = String(n);
    b2.addEventListener("click", () => pick(b2, n));
    answersEl.append(b2);
  }
  noteEl.textContent = "";
}

function showJobProgress(): void {
  if (!job) return;
  document.getElementById("job-progress")!.textContent = "🔨 " + Array.from({ length: PER_JOB }, (_, i) => (i < job!.solved ? "✅" : "⬜")).join("");
}

function openJob(j: Job): void {
  job = j;
  busy = false;
  document.getElementById("job-who")!.textContent = `${j.who} says: “${j.ask}”`;
  document.getElementById("job-title")!.textContent = j.title;
  showJobProgress();
  newProblem();
  jobEl.hidden = false;
}

function pick(button: HTMLButtonElement, n: number): void {
  if (!job || busy) return;
  if (n !== answer) {
    button.classList.add("wrong");
    button.disabled = true;
    noteEl.textContent = "Not quite! Try again 💪";
    return;
  }
  busy = true;
  button.classList.add("right");
  addCoin();
  job.solved++;
  showJobProgress();
  save();
  showFixed();
  if (job.solved < PER_JOB) {
    noteEl.textContent = ["Yes! ✨", "You got it! 🌟", "Great job! 🎉", "Awesome! 💪"][rand(0, 3)]!;
    window.setTimeout(() => {
      busy = false;
      newProblem();
    }, 800);
    return;
  }
  noteEl.textContent = "You fixed it! 🎉";
  const done = job;
  window.setTimeout(() => {
    jobEl.hidden = true;
    job = null;
    confetti(done.x, done.y - 60);
    const v = villagerSpot(done);
    bubbles.push({ x: v.x, y: v.y - 64, text: `Thank you, Ollie! 💕`, until: now + 3 });
    if (villageDone()) window.setTimeout(win, 1500);
  }, 900);
}

document.getElementById("job-close")!.addEventListener("click", () => {
  jobEl.hidden = true;
  job = null;
});

function showFixed(): void {
  const done = jobs.filter((j) => j.solved >= PER_JOB).length;
  if (mode === "battle" || mode === "beat") fixedEl.textContent = `⚔️ Monster ${Math.min(monsterNo + 1, MONSTERS.length)} of ${MONSTERS.length}`;
  else fixedEl.textContent = mode === "title" ? "" : `${AREA_EMOJI[here().id]} ${here().name} · Fixed: ${done} of ${jobs.length} ⭐`;
  teleportOpen.hidden = !(mode === "play" || mode === "beat") || !AREAS.some((a, i) => i !== areaIdx && (finished(a) || i === progressIdx));
}

/** The whole village is fixed! Now the bridge takes you to the battlefield. */
function win(): void {
  save();
  showVillageDone();
  for (let i = 0; i < 6; i++) window.setTimeout(() => confetti(rand(100, 860), rand(150, 400)), i * 250);
}

function showVillageDone(): void {
  if (visiting()) {
    caption.hidden = false;
    caption.textContent = `🌀 You're visiting ${here().name}! Everybody's happy here. Teleport back to your adventure any time.`;
    return;
  }
  caption.hidden = !villageDone();
  caption.textContent = areaIdx % 2 === 0
    ? `🎉 You fixed ${here().name}! Click the bridge ➡️ to go to the next village!`
    : `🎉 You fixed ${here().name}! Click the bridge ⚔️ to go fight ${MONSTERS[here().monster]!.name}!`;
}

// ---- The Badlands ----

let flash = 0; // the KABOOM flash
let floatHearts: { x: number; y: number; born: number }[] = [];
// What's happening in the Badlands cutscene.
const scene = {
  baby: false,
  plush: "none" as "none" | "ground" | "held" | "falling" | "dropped",
  px: 0,
  py: 0,
  vy: 0,
  boomed: false,
  nextHeart: 0,
};
const BAD_CAPTIONS: [number, string][] = [
  [0, "Ollie crossed the bridge to the Badlands! 🌵 Look... a baby monster! 💜"],
  [3, "POOF! The baby monster turned into the BIG monster... and the baby turned into a plushie! 🧸"],
  [6, "Aww! The monster is hugging the plushie! 💕"],
  [9, "Oh no... the monster dropped the plushie..."],
  [10.5, "KABOOM! 💥 The whole village exploded!"],
  [13.5, "Ollie can fix the Badlands too! Let's do math! 💪"],
];
const BAD_END = 17.5;

function startBadlands(): void {
  mode = "cutscene";
  hintEl.innerHTML = VILLAGE_HINT;
  sceneT = 0;
  Object.assign(scene, { baby: true, plush: "none", boomed: false, nextHeart: 0 });
  ollie.visible = false;
  monster.on = false;
  bubbles = [];
  titleEl.hidden = true;
  battleEl.hidden = true;
  beatEl.hidden = true;
  caption.hidden = false;
  skipButton.hidden = false;
  restartButton.hidden = true;
  save();
  showFixed();
}

function updateBadlandsScene(dt: number): void {
  sceneT += dt;
  const line = [...BAD_CAPTIONS].reverse().find(([t]) => sceneT >= t);
  if (line) caption.textContent = line[1];
  if (sceneT >= 3 && scene.baby) {
    // POOF: the baby turns into the big monster, and a plushie is left
    scene.baby = false;
    dust(480, 360, 40, ["#c084fc", "#ffffff", "#7b4ad6"]);
    monster.on = true;
    monster.x = 480;
    monster.y = 400;
    Object.assign(scene, { plush: "ground", px: 560, py: 405 });
  }
  if (sceneT >= 6 && scene.plush === "ground") scene.plush = "held";
  if (scene.plush === "held" && now >= scene.nextHeart) {
    floatHearts.push({ x: monster.x + rand(-40, 40), y: monster.y - 170, born: now });
    scene.nextHeart = now + 0.3;
  }
  if (sceneT >= 9 && scene.plush === "held") Object.assign(scene, { plush: "falling", px: monster.x, py: monster.y - 120, vy: -120 });
  if (scene.plush === "falling") {
    scene.vy += 900 * dt;
    scene.py += scene.vy * dt;
    scene.px += (480 - scene.px) * Math.min(1, dt * 3);
    if (scene.py >= 515) Object.assign(scene, { plush: "dropped", py: 515 });
  }
  if (sceneT >= 10.5 && !scene.boomed) {
    // KABOOM!
    scene.boomed = true;
    scene.plush = "none";
    flash = 1.4;
    shake = 28;
    pops.push({ x: 480, y: 300, text: "KABOOM!", born: now });
    for (const j of badJobs) {
      j.fix = 0;
      dust(j.x, j.y - 30, 30, ["#ff8a3d", "#e8383d", "#ffd23f", "#a08c70"]);
      const v = villagerSpot(j);
      bubbles.push({ x: v.x, y: v.y - 64, text: "AAAH! 😱", until: now + 2 });
    }
  }
  if (sceneT > 11 && sceneT < 14 && monster.on) {
    monster.x += 420 * dt; // the monster runs away
    if (monster.x > 1250) monster.on = false;
  }
  if (sceneT > 13.5 && !ollie.visible) {
    ollie.visible = true;
    ollie.x = -30;
    ollie.y = 420;
    walkTo(330, 420);
  }
  if (sceneT > 15.5 && !bubbles.some((b) => b.text.startsWith("I'll fix"))) {
    bubbles.push({ x: ollie.x, y: ollie.y - 96, text: "I'll fix it all! 🦸", until: now + 2.5 });
  }
  if (sceneT >= BAD_END) startPlay();
}

function drawCactus(x: number, y: number, s: number): void {
  ctx.fillStyle = "#4cae4c";
  ctx.beginPath();
  ctx.roundRect(x - 7 * s, y - 46 * s, 14 * s, 46 * s, 7 * s);
  ctx.roundRect(x - 19 * s, y - 34 * s, 9 * s, 18 * s, 4 * s);
  ctx.roundRect(x + 10 * s, y - 38 * s, 9 * s, 18 * s, 4 * s);
  ctx.fill();
  ctx.fillStyle = "#ff6fa8";
  ctx.beginPath();
  ctx.arc(x, y - 47 * s, 4 * s, 0, Math.PI * 2); // a little flower on top
  ctx.fill();
}

function drawCactusGarden(j: Job): void {
  const { x, y, fix } = j;
  ctx.fillStyle = "#c9925a";
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 75, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  const total = 5;
  const standing = Math.round(fix * total);
  for (let i = 0; i < total; i++) {
    const cx = x - 52 + i * 26;
    const cy = y - 4 - (i % 2) * 10;
    if (i < standing) drawCactus(cx, cy, 0.8);
    else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(1.4);
      drawCactus(0, 0, 0.6); // knocked over
      ctx.restore();
    }
  }
}

function drawTower(j: Job): void {
  const { x, y, fix } = j;
  const legH = 20 + 70 * fix;
  ctx.strokeStyle = "#7a4a22";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 30, y);
  ctx.lineTo(x - 22, y - legH);
  ctx.moveTo(x + 30, y);
  ctx.lineTo(x + 22, y - legH);
  if (fix > 0.5) {
    ctx.moveTo(x - 28, y - legH * 0.3);
    ctx.lineTo(x + 26, y - legH * 0.7);
    ctx.moveTo(x + 28, y - legH * 0.3);
    ctx.lineTo(x - 26, y - legH * 0.7);
  }
  ctx.stroke();
  if (fix >= 1) {
    ctx.fillStyle = "#a8723f";
    ctx.fillRect(x - 34, y - legH - 52, 68, 52);
    ctx.strokeStyle = "#5a3a1b";
    ctx.lineWidth = 3;
    for (const by of [y - legH - 40, y - legH - 14]) {
      ctx.beginPath();
      ctx.moveTo(x - 34, by);
      ctx.lineTo(x + 34, by);
      ctx.stroke();
    }
    ctx.fillStyle = "#7a4a22";
    ctx.beginPath();
    ctx.moveTo(x - 40, y - legH - 52);
    ctx.lineTo(x, y - legH - 74);
    ctx.lineTo(x + 40, y - legH - 52);
    ctx.fill();
    ctx.fillStyle = "#5fb8ff";
    ctx.beginPath();
    ctx.arc(x + 20, y - legH + 6 + ((now * 40) % 20), 3, 0, Math.PI * 2); // a drip
    ctx.fill();
  } else {
    ctx.save();
    ctx.translate(x - 60, y - 18);
    ctx.rotate(-1.4);
    ctx.globalAlpha = 1 - fix * 0.7;
    ctx.fillStyle = "#a8723f";
    ctx.fillRect(-26, -20, 52, 40); // the tank fell over
    ctx.restore();
    ctx.fillStyle = "#5fb8ff";
    ctx.beginPath();
    ctx.ellipse(x - 20, y + 4, 40 * (1 - fix), 8 * (1 - fix), 0, 0, Math.PI * 2); // spilled water
    ctx.fill();
  }
}

/** The baby monster plushie. `torn` 0 is all sewn up, 1 is in pieces. */
function drawPlushie(x: number, y: number, s: number, torn: number): void {
  const apart = torn * 26;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (torn > 0) {
    ctx.fillStyle = "#ffffff"; // stuffing
    for (let i = 0; i < Math.round(torn * 7); i++) {
      ctx.beginPath();
      ctx.arc(-30 + ((i * 23) % 60), -6 - ((i * 13) % 20), 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#e6ccff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(-apart, -22, 20, 22, -torn * 0.6, 0, Math.PI * 2); // body (left half)
  ctx.ellipse(apart, -22, 20, 22, torn * 0.6, 0, Math.PI * 2); // body (right half)
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = "#fff4c9";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (8 + apart), -40);
    ctx.lineTo(side * (16 + apart), -56);
    ctx.lineTo(side * (20 + apart), -38);
    ctx.fill();
  }
  ctx.fillStyle = "#2f2a5a"; // button eyes
  ctx.beginPath();
  ctx.arc(-8 - apart, -28, 3.5, 0, Math.PI * 2);
  ctx.arc(8 + apart, -28, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7b4ad6";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]); // stitches
  ctx.beginPath();
  if (torn === 0) {
    ctx.moveTo(0, -42);
    ctx.lineTo(0, -2);
  }
  ctx.arc(0, -20, 7, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlushieJob(j: Job): void {
  drawPlushie(j.x, j.y, 1.2, 1 - j.fix);
  if (j.fix >= 1) {
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💜", j.x + 30, j.y - 60 + Math.sin(now * 3) * 4);
  }
}

// ---- Purple cracks in the sky ----
// Penelope's idea: when the monster comes, purple cracks split the sky.
// They stay until you beat the monster, then they heal.

let crackAmount = 0; // 0: no cracks, 1: all cracked open
const CRACKS: [number, number][][] = (() => {
  let seed = 7;
  const r = (): number => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return [[230, 0], [520, 0], [700, 0], [60, 10]].map(([x0, y0]) => {
    const pts: [number, number][] = [[x0!, y0!]];
    let x = x0!, y = y0!;
    for (let i = 0; i < 6; i++) {
      x += (r() - 0.5) * 70;
      y += 12 + r() * 14;
      pts.push([x, y]);
    }
    return pts;
  });
})();

function drawCracks(): void {
  if (crackAmount <= 0.01) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#c084fc";
  ctx.shadowBlur = 14;
  ctx.globalAlpha = Math.min(1, crackAmount * 1.5) * (0.85 + Math.sin(now * 3) * 0.15);
  for (const crack of CRACKS) {
    // the cracks grow as they open (and shrink back as they heal)
    const n = Math.max(2, Math.ceil(crack.length * crackAmount));
    for (const [width, color] of [[7, "#7b2fe0"], [2.5, "#f0dcff"]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      crack.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- The battlefield ----
// Once the villages are fixed, Ollie goes to fight the monsters. Penelope
// says there are six, one after another, and the sixth is the most powerful
// of all, with its body parts all mixed up. A right answer throws a math
// star at the monster. A wrong answer and the monster throws something at
// Ollie. When a monster runs out of health, it shrinks and turns nice, and
// then the next one comes.

const HEARTS = 5;
const BATTLE_OLLIE = { x: 220, y: 420 };
const BATTLE_MONSTER = { x: 700, y: 430 };

interface MonsterKind {
  name: string;
  hp: number;
  roar: string;
  sorry: string;
  ammo: string; // what it throws (an emoji), or "goo"
  thing: string; // what it's called
  colors: string[]; // splat colours
  draw: (nice: boolean) => void; // drawn standing at (0, 0)
}

/** Two eyes and a mouth: grumpy, or a sorry little smile when it's nice. */
function monsterFace(y: number, apart: number, eye: number, nice: boolean, ink = "#2f2a5a"): void {
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s * apart, y, eye, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(s * apart, y + 3, eye * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (!nice) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s * (apart - eye), y - eye - 4);
      ctx.lineTo(s * (apart + eye), y - eye - 14);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (nice) ctx.arc(0, y + 30, 20, 0.3, Math.PI - 0.3);
  else ctx.arc(0, y + 52, 22, Math.PI + 0.4, Math.PI * 2 - 0.4);
  ctx.stroke();
}

function drawSlime(nice: boolean): void {
  const wob = Math.sin(now * 4) * 6;
  ctx.fillStyle = "#4cc76a";
  ctx.beginPath();
  ctx.ellipse(0, -6, 130, 22, 0, 0, Math.PI * 2); // the puddle
  ctx.ellipse(0, -110, 100 + wob, 115 - wob, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8ff07f";
  ctx.beginPath();
  ctx.ellipse(-40, -170, 18, 30, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4cc76a";
  for (const [dx, len] of [[-70, 30], [20, 44], [80, 24]] as const) {
    ctx.beginPath();
    ctx.ellipse(dx, -10 + ((now * 20 + dx) % 20), 9, len / 2, 0, 0, Math.PI * 2); // drips
    ctx.fill();
  }
  // one big eye
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, -150, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f5a2a";
  ctx.beginPath();
  ctx.arc(-6, -146, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f5a2a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (nice) ctx.arc(0, -95, 22, 0.3, Math.PI - 0.3);
  else {
    ctx.moveTo(-40, -196);
    ctx.lineTo(40, -186);
    ctx.moveTo(-30, -80);
    ctx.quadraticCurveTo(0, -100, 30, -80);
  }
  ctx.stroke();
}

function drawFire(nice: boolean): void {
  // flickering flame hair
  for (let i = 0; i < 5; i++) {
    const fx = -60 + i * 30;
    const tall = 70 + Math.sin(now * 12 + i * 2) * 18;
    ctx.fillStyle = i % 2 ? "#ffd23f" : "#ff8a3d";
    ctx.beginPath();
    ctx.moveTo(fx - 26, -190);
    ctx.quadraticCurveTo(fx - 10, -190 - tall * 0.6, fx, -190 - tall);
    ctx.quadraticCurveTo(fx + 10, -190 - tall * 0.6, fx + 26, -190);
    ctx.fill();
  }
  ctx.fillStyle = "#ff5a3d";
  ctx.beginPath();
  ctx.ellipse(0, -110, 88, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffb36b";
  ctx.beginPath();
  ctx.ellipse(0, -80, 52, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c2321d";
  ctx.beginPath();
  ctx.ellipse(-40, -8, 30, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(40, -8, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  monsterFace(-150, 32, 15, nice, "#5a1a0a");
}

function drawIce(nice: boolean): void {
  ctx.fillStyle = "#e6f6ff";
  for (let i = 0; i < 5; i++) {
    const sx = -64 + i * 32;
    ctx.beginPath();
    ctx.moveTo(sx - 14, -200);
    ctx.lineTo(sx, -262 + (i % 2) * 22);
    ctx.lineTo(sx + 14, -200);
    ctx.fill(); // icy spikes
  }
  ctx.fillStyle = "#8fd3ff";
  ctx.beginPath();
  ctx.ellipse(0, -115, 92, 118, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9ecff";
  ctx.beginPath();
  ctx.ellipse(0, -85, 56, 66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6f6ff";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 80, -150);
    ctx.lineTo(s * 130, -170);
    ctx.lineTo(s * 86, -125);
    ctx.fill(); // shoulder spikes
  }
  ctx.fillStyle = "#5fa8d8";
  ctx.beginPath();
  ctx.ellipse(-40, -8, 30, 14, 0, 0, Math.PI * 2);
  ctx.ellipse(40, -8, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  monsterFace(-150, 32, 15, nice, "#1a3a6a");
}

function drawRock(nice: boolean): void {
  ctx.fillStyle = "#8a8f98";
  ctx.beginPath();
  const pts: [number, number][] = [[-110, -10], [-125, -110], [-80, -200], [0, -230], [85, -205], [125, -120], [110, -10]];
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5f646c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-60, -60);
  ctx.lineTo(-30, -90);
  ctx.lineTo(-45, -120);
  ctx.moveTo(60, -40);
  ctx.lineTo(80, -80);
  ctx.stroke();
  ctx.fillStyle = "#6cbf5a"; // moss
  ctx.beginPath();
  ctx.ellipse(-50, -205, 30, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f747c"; // stone fists
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * 140, -80 + Math.sin(now * 3 + s) * 8, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  monsterFace(-150, 34, 13, nice);
}

/** The Almighty Monster: the most powerful of all, with its body parts mixed up. */
function drawAlmighty(nice: boolean): void {
  const bob = Math.sin(now * 2) * 12;
  ctx.save();
  ctx.scale(0.8, 0.8); // it's so big, it would bump the top of the screen
  ctx.translate(0, -30 + bob); // it floats!
  // golden glow and rays
  ctx.save();
  ctx.translate(0, -150);
  ctx.rotate(now * 0.4);
  ctx.fillStyle = "rgba(255, 210, 63, 0.35)";
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -230);
    ctx.lineTo(18, -230);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "rgba(255, 230, 120, 0.5)";
  ctx.beginPath();
  ctx.arc(0, -150, 165, 0, Math.PI * 2);
  ctx.fill();
  // a golden halo
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(0, -318, 70, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  // a foot on top of its head
  ctx.fillStyle = "#ff6fa8";
  ctx.beginPath();
  ctx.ellipse(30, -290, 38, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // arms coming out of the top like antennas
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-50, -250);
  ctx.lineTo(-90, -310 + Math.sin(now * 5) * 10);
  ctx.moveTo(60, -240);
  ctx.lineTo(110, -260 - Math.sin(now * 5) * 10);
  ctx.stroke();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(-92, -316 + Math.sin(now * 5) * 10, 16, 0, Math.PI * 2);
  ctx.arc(112, -264 - Math.sin(now * 5) * 10, 16, 0, Math.PI * 2);
  ctx.fill();
  // Penelope: its outfit is purple. A big purple cape flowing behind...
  ctx.fillStyle = "#5a2aa8";
  ctx.beginPath();
  ctx.moveTo(-90, -210);
  ctx.lineTo(90, -210);
  ctx.quadraticCurveTo(170 + Math.sin(now * 2) * 12, -100, 150 + Math.sin(now * 2.5) * 16, 10);
  ctx.lineTo(-150 - Math.sin(now * 2.5) * 16, 10);
  ctx.quadraticCurveTo(-170 - Math.sin(now * 2) * 12, -100, -90, -210);
  ctx.fill();
  // a rainbow body
  const body = ctx.createLinearGradient(0, -260, 0, -20);
  for (const [stop, c] of [[0, "#e8383d"], [0.2, "#ff8a3d"], [0.4, "#ffd23f"], [0.6, "#4cc76a"], [0.8, "#3b82f6"], [1, "#6a3fd1"]] as const) body.addColorStop(stop, c);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -140, 120, 125, 0, 0, Math.PI * 2);
  ctx.fill();
  // horns sticking out the sides
  ctx.fillStyle = "#fff4c9";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 112, -160);
    ctx.lineTo(s * 185, -150);
    ctx.lineTo(s * 115, -120);
    ctx.fill();
  }
  // ...and a purple robe with gold trim and little stars
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -140, 120, 125, 0, 0, Math.PI * 2);
  ctx.clip(); // the robe fits the body
  ctx.fillStyle = "#7b3fe0";
  ctx.fillRect(-130, -125, 260, 130);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(-130, -125, 260, 10); // gold belt
  ctx.fillRect(-130, -32, 260, 12); // gold trim
  ctx.fillRect(-5, -115, 10, 85);
  for (const [sx, sy] of [[-70, -95], [70, -60], [-35, -55], [85, -105]] as const) {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const d = i % 2 ? 3 : 7;
      ctx.lineTo(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
    }
    ctx.fill();
  }
  ctx.restore();
  // the mouth is at the top...
  ctx.fillStyle = "#3a1a70";
  ctx.beginPath();
  if (nice) {
    ctx.strokeStyle = "#3a1a70";
    ctx.lineWidth = 7;
    ctx.arc(0, -225, 26, 0.3, Math.PI - 0.3);
    ctx.stroke();
  } else {
    ctx.ellipse(0, -215, 40, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-22, -233, 10, 12);
    ctx.fillRect(12, -233, 10, 12);
  }
  // ...and the eyes are all over the place, near the bottom
  for (const [ex, ey, r] of [[-55, -70, 26], [45, -95, 16], [10, -45, 12]] as const) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f2a5a";
    ctx.beginPath();
    ctx.arc(ex + Math.sin(now * 2 + ex) * r * 0.3, ey, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  // a nose upside down in the middle, and a hand where a foot should be
  ctx.fillStyle = "#ff9ad0";
  ctx.beginPath();
  ctx.moveTo(-12, -150);
  ctx.lineTo(12, -150);
  ctx.lineTo(0, -128);
  ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.arc(-40, -10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6fa8";
  ctx.beginPath();
  ctx.ellipse(50, -12, 34, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const MONSTERS: MonsterKind[] = [
  { name: "The Stomper", hp: 10, roar: "ROAR! You can't stop me! 😠", sorry: "Sorry! I'll be nice now! 💜", ammo: "goo", thing: "goo", colors: ["#7b4ad6", "#a07ae8", "#c084fc"], draw: (nice) => drawMonster(0, 0, nice) },
  { name: "The Slime Monster", hp: 10, roar: "Bloop bloop! I'll slime you! 🟢", sorry: "Bloop... sorry! 💚", ammo: "🟢", thing: "slime", colors: ["#4cc76a", "#8ff07f"], draw: drawSlime },
  { name: "The Fire Monster", hp: 12, roar: "SIZZLE! I'm too hot for you! 🔥", sorry: "Okay, okay, I'll cool down! 🧡", ammo: "🔥", thing: "fireball", colors: ["#ff8a3d", "#ffd23f", "#e8383d"], draw: drawFire },
  { name: "The Ice Monster", hp: 12, roar: "BRRR! I'll freeze you! ❄️", sorry: "Brrr... sorry! Want a hug? 💙", ammo: "❄️", thing: "snowball", colors: ["#e6f6ff", "#8fd3ff"], draw: drawIce },
  { name: "The Rock Monster", hp: 14, roar: "CRUNCH! I'm rock solid! 🪨", sorry: "You rock, Ollie! Sorry! 🤍", ammo: "🪨", thing: "rock", colors: ["#8a8f98", "#6f747c"], draw: drawRock },
  { name: "The Almighty Monster", hp: 20, roar: "I am the most powerful monster of ALL! 👑", sorry: "You're even more powerful... I'll be nice! 🌈", ammo: "✨", thing: "magic sparkles", colors: ["#ffd23f", "#ff6fa8", "#3b82f6", "#4cc76a"], draw: drawAlmighty },
];

interface Shot { x0: number; y0: number; x1: number; y1: number; t: number; kind: "star" | "monster"; hit: () => void }
const battle = { hp: MONSTERS[0]!.hp, hearts: HEARTS, busy: false, shots: [] as Shot[], monsterHurt: -9, ollieHurt: -9, shrink: 0, shrinking: false, arrived: 0 };
const battleEl = document.getElementById("battle")!;
const beatEl = document.getElementById("beat")!;
const battleAnswers = document.getElementById("battle-answers")!;
const battleNote = document.getElementById("battle-note")!;
let battleAnswer = 0;
const foe = (): MonsterKind => MONSTERS[Math.min(monsterNo, MONSTERS.length - 1)]!;

function startBattle(): void {
  mode = "battle";
  caption.hidden = true;
  jobEl.hidden = true;
  beatEl.hidden = true;
  titleEl.hidden = true;
  restartButton.hidden = false;
  ollie.visible = true;
  ollie.walking = false;
  hintEl.textContent = "Pick the right answer to throw a math star at the monster! ⭐";
  battle.hearts = HEARTS;
  revives = 0;
  deadEl.hidden = true;
  meetMonster();
}

/** Here comes the next monster! */
function meetMonster(): void {
  Object.assign(battle, { hp: foe().hp, busy: false, shots: [], monsterHurt: -9, ollieHurt: -9, shrink: 0, shrinking: false, arrived: now });
  bubbles = [{ x: BATTLE_MONSTER.x, y: BATTLE_MONSTER.y - 320, text: foe().roar, until: now + 3.5 }];
  battleEl.hidden = false;
  save();
  showFixed();
  nextBattleProblem();
  battleNote.textContent = monsterNo === 0 ? "Get it right to throw a math star! ⭐" : `Monster ${monsterNo + 1} of ${MONSTERS.length}: ${foe().name}!`;
}

function nextBattleProblem(): void {
  const p = makeProblem();
  battleAnswer = p.answer;
  document.getElementById("battle-problem")!.textContent = p.text;
  battleAnswers.innerHTML = "";
  for (const n of p.choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "answer";
    b.textContent = String(n);
    b.addEventListener("click", () => battlePick(b, n));
    battleAnswers.append(b);
  }
  battleNote.textContent = "";
}

const OLLIE_HAND = (): { x: number; y: number } => ({ x: BATTLE_OLLIE.x + 30, y: BATTLE_OLLIE.y - 100 });
const MONSTER_MIDDLE = (): { x: number; y: number } => ({ x: BATTLE_MONSTER.x, y: BATTLE_MONSTER.y - 150 });

function battlePick(button: HTMLButtonElement, n: number): void {
  if (battle.busy || mode !== "battle") return;
  battle.busy = true;
  const from = OLLIE_HAND();
  const to = MONSTER_MIDDLE();
  if (n === battleAnswer) {
    button.classList.add("right");
    addCoin();
    save();
    battleNote.textContent = ["Math star! ⭐", "POW! 💥", "Take that! ✨", "Great job! 🌟"][rand(0, 3)]!;
    battle.shots.push({
      x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, kind: "star",
      hit: () => {
        battle.hp--;
        battle.monsterHurt = now;
        shake = Math.max(shake, 8);
        dust(to.x, to.y, 26, ["#ffd23f", "#ffffff", "#ff8a3d"]);
        pops.push({ x: to.x, y: to.y - 40, text: "POW!", born: now });
        if (battle.hp <= 0) monsterBeaten();
        else {
          battle.busy = false;
          nextBattleProblem();
        }
      },
    });
    return;
  }
  // Wrong: the monster throws something! Then you can try the same one again.
  button.classList.add("wrong");
  button.disabled = true;
  battleNote.textContent = `Oops! Watch out for the ${foe().thing}!`;
  battle.shots.push({
    x0: to.x, y0: to.y, x1: from.x, y1: from.y + 30, t: 0, kind: "monster",
    hit: () => {
      battle.hearts--;
      battle.ollieHurt = now;
      shake = Math.max(shake, 6);
      dust(BATTLE_OLLIE.x, BATTLE_OLLIE.y - 70, 20, foe().colors);
      if (battle.hearts <= 0) {
        ollieDied();
        return;
      }
      battleNote.textContent = "Try again! You can do it! 💪";
      battle.busy = false;
    },
  });
}

// Penelope: if the monster gets you, "Oh no, you died!" You can quit, or
// pay math coins to keep going: 5, then 15, 20, 25, 30... for each monster.
const deadEl = document.getElementById("dead")!;
const keepGoingButton = document.getElementById("keep-going") as HTMLButtonElement;
let revives = 0;
const reviveCost = (): number => (revives === 0 ? 5 : 10 + revives * 5);

function ollieDied(): void {
  battle.busy = true;
  battleEl.hidden = true;
  bubbles.push({ x: BATTLE_OLLIE.x, y: BATTLE_OLLIE.y - 140, text: "💫 Ow ow ow...", until: now + 2.5 });
  window.setTimeout(() => {
    if (mode !== "battle") return;
    showDead();
    deadEl.hidden = false;
  }, 900);
}

function showDead(): void {
  const cost = reviveCost();
  keepGoingButton.textContent = `💪 Keep going (${cost} 🪙)`;
  keepGoingButton.disabled = coins < cost;
  document.getElementById("dead-coins")!.textContent =
    coins < cost ? `You have ${coins} 🪙. You need ${cost - coins} more! Fix villages to earn math coins.` : `You have ${coins} 🪙 math coins.`;
}

keepGoingButton.addEventListener("click", () => {
  const cost = reviveCost();
  if (coins < cost || mode !== "battle") return;
  coins -= cost;
  coinsEl.textContent = `🪙 ${coins}`;
  revives++;
  battle.hearts = HEARTS;
  battle.busy = false;
  deadEl.hidden = true;
  battleEl.hidden = false;
  bubbles.push({ x: BATTLE_OLLIE.x, y: BATTLE_OLLIE.y - 140, text: "I'm back! 💪", until: now + 2.5 });
  battleNote.textContent = "All hearts back! Keep going!";
  save();
});

// Quit: back to the village. Click the bridge to fight the monster again.
document.getElementById("quit")!.addEventListener("click", () => {
  deadEl.hidden = true;
  battleEl.hidden = true;
  ollie.x = 560;
  ollie.y = 420;
  walkTo(560, 420);
  startPlay();
});

function monsterBeaten(): void {
  battleEl.hidden = true;
  battle.shrinking = true;
  const last = monsterNo >= MONSTERS.length - 1;
  const sorry = foe().sorry;
  monsterNo++;
  if (last) beaten = true;
  save();
  window.setTimeout(() => {
    bubbles.push({ x: BATTLE_MONSTER.x, y: BATTLE_MONSTER.y - 140, text: sorry, until: now + 3 });
  }, 1600);
  if (!last) {
    // On to the next two villages (and then the next monster).
    window.setTimeout(() => {
      if (mode !== "battle") return;
      battleEl.hidden = true;
      startArea(areaIdx + 1);
    }, 4500);
    return;
  }
  window.setTimeout(() => {
    mode = "beat";
    beatEl.hidden = false;
    restartButton.hidden = true;
    showFixed();
    for (let i = 0; i < 6; i++) window.setTimeout(() => confetti(rand(100, 860), rand(150, 400)), i * 250);
  }, 5000);
}

function updateBattle(dt: number): void {
  if (mode !== "battle" && mode !== "beat") return;
  for (const s of battle.shots) {
    s.t += dt * 1.6;
    if (s.t >= 1) s.hit();
  }
  battle.shots = battle.shots.filter((s) => s.t < 1);
  if (battle.shrinking) battle.shrink = Math.min(1, battle.shrink + dt / 1.5);
}

function drawStar(x: number, y: number, r: number, spin: number): void {
  ctx.fillStyle = "#ffd23f";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = spin - Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.fill();
  ctx.stroke();
}

function drawBattle(): void {
  // a stormy purple sky, cracked open, over a rocky field
  const sky = ctx.createLinearGradient(0, 0, 0, 330);
  sky.addColorStop(0, "#4a3a7a");
  sky.addColorStop(1, beaten ? "#bfe3ff" : "#c9a0d8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 330);
  drawCracks();
  ctx.fillStyle = "#8a7a6a";
  ctx.beginPath();
  ctx.moveTo(0, 320);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 310 + Math.sin(x / 70) * 12);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = "#6f6152";
  for (const [rx, ry, rr] of [[90, 380, 26], [400, 560, 34], [860, 400, 30], [520, 360, 18], [300, 420, 14], [940, 560, 40]] as const) {
    ctx.beginPath();
    ctx.ellipse(rx, ry, rr * 1.4, rr, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#b07ae8"; // purple crystals
  for (const [cx, cy] of [[140, 360], [600, 340], [880, 350]] as const) {
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx, cy - 34);
    ctx.lineTo(cx + 10, cy);
    ctx.fill();
  }

  // Ollie (blinks when something hits)
  if (now - battle.ollieHurt > 0.6 || Math.floor(now * 12) % 2) {
    ctx.save();
    ctx.translate(BATTLE_OLLIE.x, BATTLE_OLLIE.y);
    ctx.scale(1.7, 1.7);
    const face = ollie.face;
    ollie.face = 1;
    drawOllie(0, 0);
    ollie.face = face;
    ctx.restore();
  }
  // the monster (slides in when it arrives, blinks when a star hits, shrinks when it's beaten)
  const shown = battle.shrinking ? MONSTERS[Math.max(0, monsterNo - 1)]! : foe();
  if (now - battle.monsterHurt > 0.5 || Math.floor(now * 12) % 2) {
    const s = 1.1 * (1 - 0.65 * battle.shrink);
    const slide = Math.max(0, 1 - (now - battle.arrived) / 0.8) * 500;
    ctx.save();
    ctx.translate(BATTLE_MONSTER.x + slide, BATTLE_MONSTER.y);
    ctx.scale(-s, s); // facing Ollie
    shown.draw(battle.shrink > 0.5);
    ctx.restore();
  }
  for (const shot of battle.shots) {
    const x = shot.x0 + (shot.x1 - shot.x0) * shot.t;
    const y = shot.y0 + (shot.y1 - shot.y0) * shot.t - Math.sin(Math.PI * shot.t) * 90;
    if (shot.kind === "star") drawStar(x, y, 22, now * 10);
    else if (foe().ammo === "goo") {
      ctx.fillStyle = "#7b4ad6";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.arc(x + 10, y + 12, 7, 0, Math.PI * 2);
      ctx.arc(x - 9, y + 10, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.font = "36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(foe().ammo, x, y);
      ctx.textBaseline = "alphabetic";
    }
  }

  // hearts and the monster's health
  ctx.font = "28px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("❤️".repeat(battle.hearts) + "🤍".repeat(HEARTS - battle.hearts), 16, 14);
  ctx.textBaseline = "alphabetic";
  const barW = 260;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.roundRect(W - barW - 26, 12, barW + 12, 44, 12);
  ctx.fill();
  ctx.fillStyle = "#e6dcff";
  ctx.fillRect(W - barW - 20, 34, barW, 16);
  ctx.fillStyle = "#7b4ad6";
  ctx.fillRect(W - barW - 20, 34, (barW * Math.max(0, battle.hp)) / shown.hp, 16);
  ctx.fillStyle = "#2f2a5a";
  ctx.font = "800 15px Trebuchet MS, sans-serif";
  ctx.fillText(battle.shrinking ? `${shown.name}: nice now! 💜` : `${shown.name} 😠`, W - barW - 20, 29);
}

// ---- Starting ----

// ---- Village surprises ----
// Penelope: every village but the first has a gimmick. In the Badlands,
// painted targets on the flat mountains: hit them all five times and a new
// character, Badlands Dude, shows up. In Slimy Swamp, fish climb out of the
// river and nibble a house, and after 10 seconds they put it back together.
// The rest are my ideas: something to watch, or something to click.

const CANYON_DECO: [number, number][] = [[60, 260], [380, 330], [600, 345], [930, 300], [200, 590], [560, 585], [40, 560]];
const MESAS: [number, number, number][] = [[120, 160, 70], [420, 120, 55], [640, 200, 80]];
const DUDE_KEY = "math-with-ollie-dude";
let dudeUnlocked = false;
try {
  dudeUnlocked = localStorage.getItem(DUDE_KEY) === "1";
} catch {
  dudeUnlocked = false;
}

const gim = {
  targets: [0, 0, 0], // Badlands: hits on each target
  dudeX: -40, // where Badlands Dude is walking
  next: 6, // seconds until the next surprise
  // Slimy Swamp fish
  fish: [] as { x: number; y: number }[],
  fishPhase: "none" as "none" | "out" | "nibble" | "home",
  fishT: 0,
  fishJob: null as Job | null,
  boing: new Map<string, number>(), // mushrooms and crystals: when they were clicked
  erupt: -9, // Volcano Town
  twister: null as { x: number; y: number } | null, // Ash Desert
  snow: Array.from({ length: 60 }, (_, i) => ({ x: (i * 157) % W, y: (i * 89) % H })), // Snowy Village
  snowballs: [] as { x0: number; y0: number; x1: number; y1: number; t: number }[],
  penguin: null as { x: number; spin: number } | null, // Icy Mountains
  boulder: null as { x: number } | null, // Rocky Hills
  shooting: null as { x: number; y: number } | null, // Golden Sky City
  caught: 0,
};

const targetSpot = (i: number): { x: number; y: number; r: number } => {
  const [mx, , mh] = MESAS[i]!;
  return { x: mx, y: 150 - mh / 2, r: Math.min(16, mh / 2 - 6) };
};
const cloudAt = (i: number): { x: number; y: number } => {
  const [cx, cy, s] = ([[180, 50, 1], [460, 35, 0.8], [650, 70, 1.1]] as const)[i]!;
  return { x: ((cx + now * 8) % (W + 200)) - 100 + 24 * s, y: cy };
};
const riverX = (y: number): number => 147 + Math.sin(y / 50) * 10;

function startFish(): void {
  const homes = jobs.filter((j) => isBuilding(j.kind) && j.fix >= 1);
  if (!homes.length) return;
  gim.fishJob = homes[rand(0, homes.length - 1)]!;
  gim.fish = [0, 1, 2].map((i) => ({ x: riverX(330 + i * 60), y: 330 + i * 60 }));
  gim.fishPhase = "out";
  gim.fishT = 0;
}

function updateSurprises(dt: number): void {
  if (mode !== "play") return;
  const id = here().id;
  gim.next -= dt;
  // Badlands Dude walks in once you've found him
  if (id === "badlands" && dudeUnlocked && gim.dudeX < 380) gim.dudeX += 120 * dt;

  if (id === "swamp") {
    if (gim.fishPhase === "none" && gim.next <= 0) {
      startFish();
      gim.next = 25;
    }
    const j = gim.fishJob;
    if (j && gim.fishPhase !== "none") {
      gim.fishT += dt;
      const homeX = (i: number): number => j.x - 40 + i * 40;
      gim.fish.forEach((f, i) => {
        const [tx, ty] = gim.fishPhase === "home" ? [riverX(330 + i * 60), 330 + i * 60] : [homeX(i), j.y + 6];
        const d = Math.hypot(tx - f.x, ty - f.y);
        const step = Math.min(d, 90 * dt);
        if (d > 0.5) {
          f.x += ((tx - f.x) / d) * step;
          f.y += ((ty - f.y) / d) * step;
        }
      });
      if (gim.fishPhase === "out" && gim.fish.every((f, i) => Math.hypot(homeX(i) - f.x, j.y + 6 - f.y) < 2)) {
        gim.fishPhase = "nibble";
        gim.fishT = 0;
        const v = villagerSpot(j);
        bubbles.push({ x: v.x, y: v.y - 64, text: "Hey! The fish are nibbling my house! 🐟", until: now + 3 });
      }
      if (gim.fishPhase === "nibble") {
        if (Math.random() < 0.3) dust(j.x + rand(-50, 50), j.y - rand(10, 60), 1, [j.color, "#a08c70"]);
        if (gim.fishT >= 10) {
          // ...and after 10 seconds they put it back together
          gim.fishPhase = "home";
          confetti(j.x, j.y - 60);
          bubbles.push({ x: j.x, y: j.y - 120, text: "Sorry! We fixed it! 🐟", until: now + 3 });
        }
      }
      if (gim.fishPhase === "home" && gim.fish.every((f, i) => Math.hypot(riverX(330 + i * 60) - f.x, 330 + i * 60 - f.y) < 2)) {
        gim.fishPhase = "none";
        gim.fishJob = null;
      }
    }
  }
  if (id === "volcano" && gim.next <= 0) {
    gim.erupt = now;
    gim.next = 15;
  }
  if (id === "volcano" && now - gim.erupt < 1.2 && Math.random() < 0.6) dust(600, 92, 2, ["#ff6a1a", "#ffd23f", "#e8383d"]);
  if (id === "ash") {
    if (!gim.twister && gim.next <= 0) {
      gim.twister = { x: -40, y: rand(330, 560) };
      gim.next = 14;
    }
    if (gim.twister) {
      gim.twister.x += 110 * dt;
      if (Math.random() < 0.3) dust(gim.twister.x, gim.twister.y - 10, 1, ["#b8a898", "#8a7a6a"]);
      if (gim.twister.x > W + 40) gim.twister = null;
    }
  }
  if (id === "snowy") {
    for (const f of gim.snow) {
      f.y += 40 * dt;
      f.x += Math.sin(now + f.y / 40) * 12 * dt;
      if (f.y > H) f.y = -5;
    }
    if (gim.next <= 0) {
      // a snowball fight between two villagers
      const a = villagerSpot(jobs[rand(1, 3)]!);
      const b = villagerSpot(jobs[rand(4, 7)]!);
      gim.snowballs.push({ x0: a.x, y0: a.y - 40, x1: b.x, y1: b.y - 40, t: 0 }, { x0: b.x, y0: b.y - 40, x1: a.x, y1: a.y - 40, t: -0.4 });
      gim.next = 6;
    }
    for (const s of gim.snowballs) {
      s.t += dt * 0.9;
      if (s.t >= 1) dust(s.x1, s.y1, 10, ["#ffffff", "#e6f6ff"]);
    }
    gim.snowballs = gim.snowballs.filter((s) => s.t < 1);
  }
  if (id === "icy") {
    if (!gim.penguin && gim.next <= 0) {
      gim.penguin = { x: -40, spin: 0 };
      gim.next = 12;
    }
    if (gim.penguin) {
      gim.penguin.x += 160 * dt;
      gim.penguin.spin = Math.max(0, gim.penguin.spin - dt);
      if (gim.penguin.x > 780) gim.penguin = null; // ends before the canyon
    }
  }
  if (id === "rocky") {
    if (!gim.boulder && gim.next <= 0) {
      gim.boulder = { x: -40 };
      gim.next = 12;
    }
    if (gim.boulder) {
      gim.boulder.x += 70 * dt;
      if (gim.boulder.x > W + 40) gim.boulder = null;
    }
  }
  if (id === "golden") {
    if (!gim.shooting && gim.next <= 0) {
      gim.shooting = { x: W + 30, y: rand(20, 110) };
      gim.next = 5;
    }
    if (gim.shooting) {
      gim.shooting.x -= 330 * dt;
      gim.shooting.y += 50 * dt;
      if (gim.shooting.x < -40) gim.shooting = null;
    }
  }
}

/** Drawn on the background, behind the village. */
function drawSurprisesBack(): void {
  if (mode !== "play") return;
  const id = here().id;
  if (id === "badlands") {
    MESAS.forEach((_, i) => {
      const t = targetSpot(i);
      const done = gim.targets[i]! >= 5;
      for (const [r, c] of [[1, "#ffffff"], [0.7, "#e8383d"], [0.4, "#ffffff"], [0.15, "#e8383d"]] as const) {
        ctx.fillStyle = done ? (c === "#e8383d" ? "#ffd23f" : "#fff4c9") : c;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * r, 0, Math.PI * 2);
        ctx.fill();
      }
      // little dots for how many times you've hit it
      for (let h = 0; h < 5; h++) {
        ctx.fillStyle = h < gim.targets[i]! ? "#ffd23f" : "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(t.x - 16 + h * 8, t.y + t.r + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  if (id === "volcano") {
    // a little volcano on the hills
    ctx.fillStyle = "#4a2a2a";
    ctx.beginPath();
    ctx.moveTo(530, 150);
    ctx.lineTo(585, 92);
    ctx.lineTo(615, 92);
    ctx.lineTo(670, 150);
    ctx.fill();
    ctx.fillStyle = now - gim.erupt < 1.5 ? "#ffd23f" : "#ff6a1a";
    ctx.fillRect(585, 90, 30, 6);
    if (now - gim.erupt < 1.5) pops.length < 4 && Math.random() < 0.02 && pops.push({ x: 600, y: 80, text: "BLOOP!", born: now });
  }
  if (id === "rainbow") {
    ctx.lineWidth = 9;
    ["#e8383d", "#ff8a3d", "#ffd23f", "#4cc76a", "#3b82f6", "#6a3fd1"].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(480, 170, 300 - i * 9, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  if (id === "rocky" && gim.boulder) {
    const b = gim.boulder;
    ctx.save();
    ctx.translate(b.x, hillY(b.x) - 18);
    ctx.rotate(b.x / 18);
    ctx.fillStyle = "#7a7f88";
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5f646c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(6, 4);
    ctx.stroke();
    ctx.restore();
  }
  if (id === "golden" && gim.shooting) {
    const s = gim.shooting;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + 60, s.y - 9);
    ctx.stroke();
    drawStar(s.x, s.y, 12, now * 6);
  }
}

/** Drawn in front of the village. */
function drawSurprisesFront(): void {
  if (mode !== "play") return;
  const id = here().id;
  if (id === "badlands" && dudeUnlocked) {
    ctx.save();
    ctx.translate(gim.dudeX, 460);
    drawDude(0, 0, gim.dudeX < 380 ? Math.sin(now * 14) : 0);
    ctx.restore();
  }
  if (id === "swamp" && gim.fishPhase !== "none") {
    gim.fish.forEach((f, i) => {
      const chomp = gim.fishPhase === "nibble" ? Math.abs(Math.sin(now * 10 + i)) : 0.4;
      const hop = gim.fishPhase === "nibble" ? 0 : Math.abs(Math.sin(now * 8 + i)) * 8;
      ctx.save();
      ctx.translate(f.x, f.y - hop);
      // little legs for climbing out of the river!
      ctx.strokeStyle = "#e0a020";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-8 + Math.sin(now * 16) * 3, 14);
      ctx.moveTo(6, 6);
      ctx.lineTo(8 - Math.sin(now * 16) * 3, 14);
      ctx.stroke();
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-26, -9);
      ctx.lineTo(-26, 9);
      ctx.fill(); // tail
      ctx.fillStyle = "#86cf72";
      ctx.beginPath();
      ctx.moveTo(16, -3 * chomp);
      ctx.lineTo(8, 0);
      ctx.lineTo(16, 3 * chomp);
      ctx.fill(); // chomping mouth
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(7, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f2a5a";
      ctx.beginPath();
      ctx.arc(8, -3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
  if (id === "ash" && gim.twister) {
    const t = gim.twister;
    ctx.strokeStyle = "rgba(120,100,90,0.6)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const w = 8 + i * 6;
      ctx.beginPath();
      ctx.ellipse(t.x + Math.sin(now * 8 + i) * 4, t.y - i * 12, w, 4, 0, now * 6 + i, now * 6 + i + Math.PI * 1.5);
      ctx.stroke();
    }
  }
  if (id === "snowy") {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#8fb8e0"; // a blue edge, so you can see the snow on the snow
    ctx.lineWidth = 1;
    for (const f of gim.snow) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    for (const s of gim.snowballs) {
      if (s.t < 0) continue;
      ctx.beginPath();
      ctx.arc(s.x0 + (s.x1 - s.x0) * s.t, s.y0 + (s.y1 - s.y0) * s.t - Math.sin(Math.PI * s.t) * 60, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (id === "icy" && gim.penguin) {
    const p = gim.penguin;
    ctx.save();
    ctx.translate(p.x, 470);
    ctx.rotate(p.spin > 0 ? p.spin * 12 : Math.PI / 2 - 0.2); // sliding on its belly (or spinning!)
    ctx.fillStyle = "#2f2a5a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a3d";
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.lineTo(3, -14);
    ctx.lineTo(0, -8);
    ctx.fill();
    ctx.restore();
  }
}

/** Did you click a surprise? */
function clickSurprise(x: number, y: number): boolean {
  const id = here().id;
  if (id === "badlands") {
    for (let i = 0; i < MESAS.length; i++) {
      const t = targetSpot(i);
      if (Math.hypot(x - t.x, y - t.y) > t.r + 8) continue;
      if (gim.targets[i]! < 5) gim.targets[i]!++;
      dust(t.x, t.y, 10, ["#ffd23f", "#ffffff", "#e8383d"]);
      pops.push({ x: t.x, y: t.y - 10, text: gim.targets[i]! >= 5 ? "BULLSEYE!" : "PING!", born: now });
      if (!dudeUnlocked && gim.targets.every((n) => n >= 5)) {
        dudeUnlocked = true;
        try {
          localStorage.setItem(DUDE_KEY, "1");
        } catch {
          // he still shows up, just not next time
        }
        gim.dudeX = -40;
        caption.hidden = false;
        caption.textContent = "🤠 You found Badlands Dude! Pick him with the 🎨 Character button!";
        window.setTimeout(() => showVillageDone(), 5000);
        window.setTimeout(() => bubbles.push({ x: 380, y: 360, text: "Howdy, partner! I'm Badlands Dude! 🤠", until: now + 4 }), 3000);
        for (let k = 0; k < 4; k++) window.setTimeout(() => confetti(rand(200, 700), rand(200, 400)), k * 250);
      }
      return true;
    }
  }
  if (id === "mushroom" || id === "crystal") {
    for (const [dx, dy] of CANYON_DECO) {
      if (Math.abs(x - dx) < 18 && y < dy + 6 && y > dy - 36) {
        gim.boing.set(`${dx},${dy}`, now);
        dust(dx, dy - 24, 12, id === "mushroom" ? ["#ff9ad0", "#ffffff", "#ffd23f"] : ["#5fe0ff", "#ff6fa8", "#ffd23f", "#c084fc"]);
        pops.push({ x: dx, y: dy - 30, text: id === "mushroom" ? "BOING!" : "♪", born: now });
        return true;
      }
    }
  }
  if (id === "volcano" && x > 540 && x < 660 && y > 85 && y < 150) {
    gim.erupt = now;
    return true;
  }
  if (id === "ash" && gim.twister && Math.abs(x - gim.twister.x) < 40 && y < gim.twister.y + 10 && y > gim.twister.y - 80) {
    poof(gim.twister.x, gim.twister.y - 30);
    gim.twister = null;
    return true;
  }
  if (id === "icy" && gim.penguin && Math.abs(x - gim.penguin.x) < 30 && Math.abs(y - 470) < 30) {
    gim.penguin.spin = 1;
    bubbles.push({ x: gim.penguin.x, y: 430, text: "Wheee! 🐧", until: now + 1.5 });
    return true;
  }
  if (id === "rocky" && gim.boulder && Math.abs(x - gim.boulder.x) < 26 && Math.abs(y - (hillY(gim.boulder.x) - 18)) < 26) {
    dust(gim.boulder.x, hillY(gim.boulder.x) - 18, 22, ["#7a7f88", "#a0a5ad", "#5f646c"]);
    pops.push({ x: gim.boulder.x, y: hillY(gim.boulder.x) - 30, text: "CRACK!", born: now });
    gim.boulder = null;
    return true;
  }
  if (id === "rainbow") {
    for (let i = 0; i < 3; i++) {
      const c = cloudAt(i);
      if (Math.abs(x - c.x) < 45 && Math.abs(y - c.y) < 28) {
        dust(c.x, c.y + 10, 30, ["#ff6fa8", "#ffd23f", "#4cc76a", "#3b82f6", "#c084fc", "#ffffff"]); // candy rain!
        return true;
      }
    }
  }
  if (id === "golden" && gim.shooting && Math.hypot(x - gim.shooting.x, y - gim.shooting.y) < 26) {
    gim.caught++;
    confetti(gim.shooting.x, gim.shooting.y);
    bubbles.push({ x: ollie.x, y: ollie.y - 96, text: `I caught a shooting star! ⭐ (${gim.caught})`, until: now + 2.5 });
    gim.shooting = null;
    return true;
  }
  return false;
}

/** Badlands Dude: a cowboy with a big hat and a red bandana. */
function drawDude(x: number, y: number, step: number): void {
  ctx.strokeStyle = "#5a3a1b"; // boots
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 14);
  ctx.lineTo(x - 6 + step * 5, y - 2);
  ctx.moveTo(x + 6, y - 14);
  ctx.lineTo(x + 6 - step * 5, y - 2);
  ctx.stroke();
  ctx.fillStyle = "#3b6ea8"; // jeans
  ctx.fillRect(x - 12, y - 22, 24, 10);
  ctx.fillStyle = "#e8383d"; // shirt
  ctx.beginPath();
  ctx.roundRect(x - 14, y - 46, 28, 26, 8);
  ctx.fill();
  ctx.fillStyle = "#8a5a2b"; // vest
  ctx.fillRect(x - 14, y - 44, 8, 22);
  ctx.fillRect(x + 6, y - 44, 8, 22);
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  ctx.arc(x + 10, y - 36, 3, 0, Math.PI * 2); // a sheriff-ish star badge
  ctx.fill();
  ctx.fillStyle = "#ffd9b8";
  ctx.beginPath();
  ctx.arc(x, y - 60, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c2321d"; // bandana
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 48);
  ctx.lineTo(x + 12, y - 48);
  ctx.lineTo(x, y - 38);
  ctx.fill();
  ctx.fillStyle = "#2f2a5a";
  ctx.beginPath();
  ctx.arc(x - 5, y - 61, 2.2, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 61, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2f2a5a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 57, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = "#9a6334"; // big cowboy hat
  ctx.beginPath();
  ctx.ellipse(x, y - 72, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 13, y - 92, 26, 22, 7);
  ctx.fill();
  ctx.fillStyle = "#5a3a1b";
  ctx.fillRect(x - 13, y - 78, 26, 4);
}

// ---- Changing your character ----

const skinEl = document.getElementById("skins")!;
function openSkins(): void {
  const list = document.getElementById("skin-list")!;
  list.innerHTML = "";
  const main = ctx;
  for (const k of SKINS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "skin";
    b.setAttribute("aria-pressed", String(k.id === skin));
    const pic = document.createElement("canvas");
    pic.width = 120;
    pic.height = 130;
    // borrow Ollie's drawing code for a little picture of each one
    ctx = pic.getContext("2d")!;
    const [was, visible, face, walking] = [skin, ollie.visible, ollie.face, ollie.walking];
    Object.assign(ollie, { visible: true, face: 1, walking: false });
    skin = k.id;
    ctx.scale(1.2, 1.2);
    drawOllie(50, 102);
    skin = was;
    Object.assign(ollie, { visible, face, walking });
    ctx = main;
    const label = document.createElement("span");
    label.textContent = k.name;
    b.append(pic, label);
    if (k.id === "dude" && !dudeUnlocked) {
      pic.style.filter = "brightness(0)";
      label.textContent = "🔒 A secret! Look in the Badlands...";
      b.disabled = true;
      list.append(b);
      continue;
    }
    b.addEventListener("click", () => {
      skin = k.id;
      try {
        localStorage.setItem(SKIN_KEY, k.id);
      } catch {
        // can't save it, but you can still play as it now
      }
      skinEl.hidden = true;
      dust(ollie.x, ollie.y - 50, 24, ["#ffd23f", "#ffffff", "#ff6fa8"]);
    });
    list.append(b);
  }
  skinEl.hidden = false;
}
document.getElementById("skin-open")!.addEventListener("click", openSkins);
document.getElementById("skin-close")!.addEventListener("click", () => (skinEl.hidden = true));

// ---- Teleporting ----
// Penelope: once you finish a village, you can teleport to it any time,
// and the monster doesn't come and wreck it.

const teleportEl = document.getElementById("teleport")!;
function openTeleport(): void {
  const list = document.getElementById("teleport-list")!;
  list.innerHTML = "";
  AREAS.forEach((a, i) => {
    const mine = i === progressIdx && !beaten;
    if (!mine && !finished(a)) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = mine ? "pill pill-main" : "pill";
    b.textContent = `${AREA_EMOJI[a.id]} ${a.name}${mine ? " (my adventure)" : ""}`;
    b.disabled = i === areaIdx && mode === "play";
    b.addEventListener("click", () => teleportTo(i));
    list.append(b);
  });
  teleportEl.hidden = false;
}
function teleportTo(i: number): void {
  teleportEl.hidden = true;
  beatEl.hidden = true;
  jobEl.hidden = true;
  goToArea(i, false);
  goingTo = null;
  crossing = false;
  ollie.x = 560;
  ollie.y = 420;
  walkTo(560, 420);
  bubbles = [];
  startPlay();
  dust(560, 380, 40, ["#c084fc", "#5fe0ff", "#ffffff", "#ffd23f"]);
}
teleportOpen.addEventListener("click", openTeleport);
document.getElementById("beat-visit")!.addEventListener("click", openTeleport);
document.getElementById("teleport-close")!.addEventListener("click", () => (teleportEl.hidden = true));

document.getElementById("play")!.addEventListener("click", startCutscene);
document.getElementById("again")!.addEventListener("click", startCutscene);
continueButton.addEventListener("click", () => {
  const s = load();
  for (const j of allJobs) j.solved = Math.min(PER_JOB, s?.solved[j.id] ?? 0);
  goToArea(Math.max(0, AREAS.findIndex((a) => a.id === s?.area)));
  ollie.x = 560;
  ollie.y = 420;
  walkTo(560, 420);
  startPlay();
});
let sureRestart = false;
restartButton.addEventListener("click", () => {
  if (!sureRestart) {
    sureRestart = true;
    restartButton.textContent = "Sure? Click again!";
    window.setTimeout(() => {
      sureRestart = false;
      restartButton.textContent = "🔄 Start over";
    }, 3000);
    return;
  }
  sureRestart = false;
  restartButton.textContent = "🔄 Start over";
  jobEl.hidden = true;
  job = null;
  startCutscene();
});

// ---- Every frame ----

let last = performance.now();
function frame(t: number): void {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  now += dt;
  if (mode === "cutscene") updateCutscene(dt);
  flash = Math.max(0, flash - dt * 1.2);
  floatHearts = floatHearts.filter((h) => now - h.born < 1.6);
  updateSky(dt);
  updateBattle(dt);
  updateSurprises(dt);
  const wantCracks = mode === "cutscene" ? (sceneT > 3.5 ? 1 : 0) : mode === "title" || beaten ? 0 : 1;
  crackAmount += Math.sign(wantCracks - crackAmount) * Math.min(Math.abs(wantCracks - crackAmount), dt * (wantCracks > crackAmount ? 0.8 : 0.4));
  // Ollie walks
  const dx = ollie.tx - ollie.x;
  const dy = ollie.ty - ollie.y;
  const dist = Math.hypot(dx, dy);
  ollie.walking = dist > 2;
  if (ollie.walking) {
    const step = Math.min(dist, 240 * dt);
    ollie.x += (dx / dist) * step;
    ollie.y += (dy / dist) * step;
    if (Math.abs(dx) > 1) ollie.face = dx > 0 ? 1 : -1;
  } else if (crossing && mode === "play") {
    crossing = false;
    // The first village of a pair leads to the next village; the second, to a monster.
    if (areaIdx % 2 === 0) startArea(areaIdx + 1);
    else {
      monsterNo = here().monster;
      startBattle();
    }
  } else if (goingTo && mode === "play") {
    const j = goingTo;
    goingTo = null;
    openJob(j);
  }
  // Fixed things build back up bit by bit
  if (mode === "play") {
    for (const j of jobs) {
      const want = j.solved / PER_JOB;
      if (j.fix < want) {
        j.fix = Math.min(want, j.fix + dt * 1.2);
        if (Math.random() < 0.3) dust(j.x, j.y - 20, 1, ["#ffd23f", "#ffffff"]);
      } else j.fix = want;
    }
  }
  for (const b of bits) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += 400 * dt;
    b.life -= dt * 1.2;
  }
  bits = bits.filter((b) => b.life > 0);
  pops = pops.filter((p) => now - p.born < 1.2);
  bubbles = bubbles.filter((b) => b.until > now);
  shake = Math.max(0, shake - dt * 30);
  draw();
  requestAnimationFrame(frame);
}
ollie.visible = true;
ollie.x = 560;
ollie.y = 420;
walkTo(560, 420);
showFixed();
// Autosave: in the middle of fixing the village? Go right back to it.
if (!continueButton.hidden) continueButton.click();
window.addEventListener("pagehide", () => {
  if (mode === "play" || mode === "battle") save();
});
requestAnimationFrame(frame);
