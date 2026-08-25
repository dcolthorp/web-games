/**
 * Everything Farttopia is made of. Kept as plain data so the city can grow by
 * adding entries here rather than by touching the drawing code.
 */

import type { QuestDef } from "./quests";

export type Rect = { x: number; y: number; w: number; h: number };

export type Prop = {
  rect: Rect;
  color: string;
  /** Solid props stop you walking through them. */
  solid: boolean;
  label?: string;
  /** Rounded corners, for fountains and bushes. */
  round?: boolean;
};

export type Building = {
  id: string;
  name: string;
  rect: Rect;
  wall: string;
  roof: string;
  /** Step onto this to go inside. */
  door: Rect;
  goesTo: string;
};

export type NPC = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  /** Said when you talk and there is no quest business to do. */
  lines: string[];
  /** The quest this one hands out, if any. */
  quest?: string;
  /** Farting on a "patient" or the "cat" is what counts for their quest. */
  tag?: "patient" | "cat";
  /** Patients lie down; everyone else stands. */
  lying?: boolean;
};

export type Scene = {
  id: string;
  name: string;
  w: number;
  h: number;
  ground: [string, string];
  props: Prop[];
  buildings: Building[];
  npcs: NPC[];
  /** Interiors only: step here to go back out, arriving at `arrive`. */
  exit?: { rect: Rect; goesTo: string; arrive: { x: number; y: number } };
  /** Where you land when you walk in the door. */
  entrance: { x: number; y: number };
};

export const QUESTS: QuestDef[] = [
  {
    id: "aromatherapy",
    giver: "nurse",
    title: "Aromatherapy Rounds",
    ask: "You're the new orderly? Good. Every patient needs their treatment. Go and fart on all five of them.",
    hint: "Fart on all five patients in the hospital.",
    goal: 5,
    unit: "patients",
    reward: 3,
    thanks: "Look at them! Pink cheeks all round. Take these, you've earned them.",
    after: "Ward's never smelled better. Genuinely.",
  },
  {
    id: "gains",
    giver: "coach",
    title: "Blast Reps",
    ask: "Propulsion is a MUSCLE. Give me eight good ones, right here in the gym. NO HALF-SQUEEZES.",
    hint: "Let out 8 farts inside the gym.",
    goal: 8,
    unit: "farts",
    reward: 2,
    thanks: "THAT is what power sounds like. Coins. Take them. Go.",
    after: "Keep those glutes loaded, champ.",
  },
  {
    id: "fresh-bread",
    giver: "baker",
    title: "Hold It In",
    ask: "This is a BAKERY. Stand in my shop for twenty whole seconds without letting one go, and the coins are yours.",
    hint: "Stay in the bakery 20 seconds without farting. One slip and the clock restarts.",
    goal: 20,
    unit: "seconds",
    reward: 2,
    thanks: "Twenty seconds. I didn't think anyone here could. Here.",
    after: "Smell that? That's yeast. That's what a room is supposed to smell like.",
  },
  {
    id: "lost-cat",
    giver: "gustus",
    title: "Sir Puffs Comes Home",
    ask: "My cat, Sir Puffs, won't come down. He only moves for one smell. You know the one. Go and find him.",
    hint: "Find Sir Puffs somewhere in the city and fart on him.",
    goal: 1,
    unit: "cats",
    reward: 3,
    thanks: "He shot past me like a rocket! Straight through the cat flap. Bless you.",
    after: "He's asleep on the radiator now. Won't budge for anything.",
  },
];

/** How many coins the mayor wants before he'll do the ceremony. */
export const DUKE_PRICE = 8;

const ROAD = "#4a4a55";
const LINE = "#c9c56a";

export const CITY: Scene = {
  id: "city",
  name: "Farttopia",
  w: 1800,
  h: 1200,
  ground: ["#4d7f5f", "#3b6b53"],
  entrance: { x: 890, y: 610 },
  props: [
    // Roads: one across, one down, meeting in the middle of town.
    { rect: { x: 0, y: 540, w: 1800, h: 130 }, color: ROAD, solid: false },
    { rect: { x: 830, y: 0, w: 130, h: 1200 }, color: ROAD, solid: false },
    { rect: { x: 0, y: 601, w: 1800, h: 8 }, color: LINE, solid: false },
    { rect: { x: 891, y: 0, w: 8, h: 1200 }, color: LINE, solid: false },
    // The fountain everyone loiters around.
    { rect: { x: 1010, y: 210, w: 150, h: 150 }, color: "#8fd8ea", solid: true, round: true, label: "⛲" },
    // Hedges, so the edges of town feel like edges.
    { rect: { x: 0, y: 0, w: 1800, h: 22 }, color: "#2f5540", solid: true },
    { rect: { x: 0, y: 1178, w: 1800, h: 22 }, color: "#2f5540", solid: true },
    { rect: { x: 0, y: 0, w: 22, h: 1200 }, color: "#2f5540", solid: true },
    { rect: { x: 1778, y: 0, w: 22, h: 1200 }, color: "#2f5540", solid: true },
    { rect: { x: 640, y: 180, w: 60, h: 60 }, color: "#2f5540", solid: true, round: true },
    { rect: { x: 1660, y: 460, w: 60, h: 60 }, color: "#2f5540", solid: true, round: true },
    { rect: { x: 700, y: 980, w: 60, h: 60 }, color: "#2f5540", solid: true, round: true },
  ],
  buildings: [
    {
      id: "hospital",
      name: "Farttopia General",
      rect: { x: 120, y: 120, w: 420, h: 300 },
      wall: "#e8eef5",
      roof: "#b8c6d6",
      door: { x: 290, y: 420, w: 80, h: 28 },
      goesTo: "hospital",
    },
    {
      id: "bakery",
      name: "Rolls Bakery",
      rect: { x: 1200, y: 700, w: 380, h: 270 },
      wall: "#f3d9a8",
      roof: "#c98b4b",
      door: { x: 1350, y: 970, w: 80, h: 28 },
      goesTo: "bakery",
    },
    {
      id: "gym",
      name: "Blast Fitness",
      rect: { x: 180, y: 760, w: 380, h: 280 },
      wall: "#d8c2f0",
      roof: "#7a5aa8",
      door: { x: 330, y: 1040, w: 80, h: 28 },
      goesTo: "gym",
    },
    {
      id: "hall",
      name: "Town Hall",
      rect: { x: 1220, y: 100, w: 400, h: 260 },
      wall: "#f6efd8",
      roof: "#9a7b3f",
      door: { x: 1380, y: 360, w: 80, h: 28 },
      goesTo: "hall",
    },
  ],
  npcs: [
    {
      id: "gustus",
      name: "Old Man Gustus",
      x: 960,
      y: 420,
      color: "#ffd07a",
      quest: "lost-cat",
      lines: ["Sixty years in this town. Never once opened a window."],
    },
    {
      id: "bean",
      name: "Bean",
      x: 700,
      y: 780,
      color: "#8fe38f",
      lines: [
        "My dad says Farttopia used to be called Something Else. He won't say what.",
        "If you get eight coins the mayor makes you a DUKE. A real one.",
        "I can do one that sounds like a trumpet. Not right now though.",
      ],
    },
    {
      id: "sirpuffs",
      name: "Sir Puffs",
      x: 1620,
      y: 1090,
      color: "#f0a5c8",
      tag: "cat",
      lines: ["*the cat does not respond to words*"],
    },
    {
      id: "mayor",
      name: "Mayor Blowhard",
      x: 1520,
      y: 430,
      color: "#ff9ce4",
      lines: ["A city runs on two things: civic pride, and ventilation."],
    },
  ],
};

export const HOSPITAL: Scene = {
  id: "hospital",
  name: "Farttopia General",
  w: 960,
  h: 560,
  ground: ["#eef4fa", "#dbe6f0"],
  entrance: { x: 480, y: 470 },
  exit: { rect: { x: 430, y: 520, w: 100, h: 40 }, goesTo: "city", arrive: { x: 330, y: 505 } },
  props: [
    { rect: { x: 0, y: 0, w: 960, h: 18 }, color: "#c3d2e0", solid: true },
    { rect: { x: 0, y: 0, w: 18, h: 560 }, color: "#c3d2e0", solid: true },
    { rect: { x: 942, y: 0, w: 18, h: 560 }, color: "#c3d2e0", solid: true },
    { rect: { x: 0, y: 542, w: 430, h: 18 }, color: "#c3d2e0", solid: true },
    { rect: { x: 530, y: 542, w: 430, h: 18 }, color: "#c3d2e0", solid: true },
    { rect: { x: 90, y: 150, w: 120, h: 70 }, color: "#ffffff", solid: false, label: "🛏" },
    { rect: { x: 290, y: 150, w: 120, h: 70 }, color: "#ffffff", solid: false, label: "🛏" },
    { rect: { x: 490, y: 150, w: 120, h: 70 }, color: "#ffffff", solid: false, label: "🛏" },
    { rect: { x: 690, y: 150, w: 120, h: 70 }, color: "#ffffff", solid: false, label: "🛏" },
    { rect: { x: 690, y: 330, w: 120, h: 70 }, color: "#ffffff", solid: false, label: "🛏" },
    { rect: { x: 60, y: 330, w: 90, h: 60 }, color: "#cfe0ef", solid: true, label: "💊" },
  ],
  buildings: [],
  npcs: [
    {
      id: "nurse",
      name: "Nurse Whiffy",
      x: 480,
      y: 300,
      color: "#8fd8ea",
      quest: "aromatherapy",
      lines: ["Mind the mop bucket."],
    },
    { id: "p1", name: "Patient", x: 150, y: 175, color: "#f7f2c8", tag: "patient", lying: true, lines: ["...ohhh, that's the good stuff."] },
    { id: "p2", name: "Patient", x: 350, y: 175, color: "#f7c8c8", tag: "patient", lying: true, lines: ["Doctor said I need airing out."] },
    { id: "p3", name: "Patient", x: 550, y: 175, color: "#c8f7d2", tag: "patient", lying: true, lines: ["Is it my turn? It's my turn, isn't it."] },
    { id: "p4", name: "Patient", x: 750, y: 175, color: "#d8c8f7", tag: "patient", lying: true, lines: ["I've been waiting since Tuesday."] },
    { id: "p5", name: "Patient", x: 750, y: 355, color: "#f7dcc8", tag: "patient", lying: true, lines: ["Gently. I'm delicate."] },
  ],
};

export const BAKERY: Scene = {
  id: "bakery",
  name: "Rolls Bakery",
  w: 960,
  h: 560,
  ground: ["#fbf0dc", "#eddcbb"],
  entrance: { x: 480, y: 470 },
  exit: { rect: { x: 430, y: 520, w: 100, h: 40 }, goesTo: "city", arrive: { x: 1390, y: 1055 } },
  props: [
    { rect: { x: 0, y: 0, w: 960, h: 18 }, color: "#c99a5c", solid: true },
    { rect: { x: 0, y: 0, w: 18, h: 560 }, color: "#c99a5c", solid: true },
    { rect: { x: 942, y: 0, w: 18, h: 560 }, color: "#c99a5c", solid: true },
    { rect: { x: 0, y: 542, w: 430, h: 18 }, color: "#c99a5c", solid: true },
    { rect: { x: 530, y: 542, w: 430, h: 18 }, color: "#c99a5c", solid: true },
    { rect: { x: 120, y: 120, w: 220, h: 60 }, color: "#e6c78f", solid: true, label: "🥖" },
    { rect: { x: 620, y: 120, w: 220, h: 60 }, color: "#e6c78f", solid: true, label: "🥐" },
    { rect: { x: 620, y: 380, w: 200, h: 70 }, color: "#d9b071", solid: true, label: "🧁" },
  ],
  buildings: [],
  npcs: [
    {
      id: "baker",
      name: "Baker Rolls",
      x: 480,
      y: 260,
      color: "#f3d9a8",
      quest: "fresh-bread",
      lines: ["Breathe through your mouth if you must."],
    },
  ],
};

export const GYM: Scene = {
  id: "gym",
  name: "Blast Fitness",
  w: 960,
  h: 560,
  ground: ["#efe4ff", "#d9c7f2"],
  entrance: { x: 480, y: 470 },
  exit: { rect: { x: 430, y: 520, w: 100, h: 40 }, goesTo: "city", arrive: { x: 300, y: 1125 } },
  props: [
    { rect: { x: 0, y: 0, w: 960, h: 18 }, color: "#6f52a0", solid: true },
    { rect: { x: 0, y: 0, w: 18, h: 560 }, color: "#6f52a0", solid: true },
    { rect: { x: 942, y: 0, w: 18, h: 560 }, color: "#6f52a0", solid: true },
    { rect: { x: 0, y: 542, w: 430, h: 18 }, color: "#6f52a0", solid: true },
    { rect: { x: 530, y: 542, w: 430, h: 18 }, color: "#6f52a0", solid: true },
    { rect: { x: 100, y: 130, w: 150, h: 70 }, color: "#b79ae0", solid: true, label: "🏋" },
    { rect: { x: 700, y: 130, w: 150, h: 70 }, color: "#b79ae0", solid: true, label: "🚴" },
    { rect: { x: 100, y: 380, w: 150, h: 70 }, color: "#b79ae0", solid: true, label: "🤸" },
    { rect: { x: 700, y: 380, w: 150, h: 70 }, color: "#b79ae0", solid: true, label: "🥊" },
  ],
  buildings: [],
  npcs: [
    {
      id: "coach",
      name: "Coach Blast",
      x: 480,
      y: 250,
      color: "#ff9c6e",
      quest: "gains",
      lines: ["NO EXCUSES. Only EXHAUST."],
    },
  ],
};

export const HALL: Scene = {
  id: "hall",
  name: "Town Hall",
  w: 960,
  h: 560,
  ground: ["#fbf6e4", "#e8ddbd"],
  entrance: { x: 480, y: 470 },
  exit: { rect: { x: 430, y: 520, w: 100, h: 40 }, goesTo: "city", arrive: { x: 1420, y: 445 } },
  props: [
    { rect: { x: 0, y: 0, w: 960, h: 18 }, color: "#a8874a", solid: true },
    { rect: { x: 0, y: 0, w: 18, h: 560 }, color: "#a8874a", solid: true },
    { rect: { x: 942, y: 0, w: 18, h: 560 }, color: "#a8874a", solid: true },
    { rect: { x: 0, y: 542, w: 430, h: 18 }, color: "#a8874a", solid: true },
    { rect: { x: 530, y: 542, w: 430, h: 18 }, color: "#a8874a", solid: true },
    { rect: { x: 380, y: 90, w: 200, h: 90 }, color: "#d8c07a", solid: true, label: "🏛" },
    { rect: { x: 140, y: 300, w: 120, h: 60 }, color: "#d8c07a", solid: true, label: "🪑" },
    { rect: { x: 700, y: 300, w: 120, h: 60 }, color: "#d8c07a", solid: true, label: "🪑" },
  ],
  buildings: [],
  npcs: [
    {
      id: "clerk",
      name: "Clerk Draught",
      x: 480,
      y: 300,
      color: "#c8d8f7",
      lines: [
        "The mayor takes his ceremonies outside. Better airflow.",
        "Eight coins. That's the going rate for a dukedom.",
      ],
    },
  ],
};

export const SCENES: Record<string, Scene> = {
  city: CITY,
  hospital: HOSPITAL,
  bakery: BAKERY,
  gym: GYM,
  hall: HALL,
};
