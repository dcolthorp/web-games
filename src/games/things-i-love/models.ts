import type { Part, Vec3 } from "./render3d";
import type { SoundName } from "./sounds";

// The book of models. When something is put in a box, the game looks for a
// word it knows and builds that model out of shapes. Animals face +x.
// "M" is the thing's main colour, so "pink cat" or "rainbow car" works too.

interface ModelDef {
  keys: string[];
  name: string;
  main: string;
  parts: (main: string, seed: number) => Part[];
}

export type Move = "hop" | "spin" | "bounce" | "zoom" | "fall" | "drive" | "wiggle";

/** What a model does when you click it. Only some models can be played with. */
export interface Act {
  move: Move;
  say: string;
  sound: SoundName;
}

const ACTS: Record<string, Act> = {
  cat: { move: "hop", say: "Meow!", sound: "meow" },
  dog: { move: "wiggle", say: "Woof woof!", sound: "woof" },
  bunny: { move: "hop", say: "Hop hop!", sound: "squeak" },
  "teddy bear": { move: "spin", say: "Hug me!", sound: "hi" },
  bird: { move: "hop", say: "Tweet tweet!", sound: "tweet" },
  duck: { move: "wiggle", say: "Quack!", sound: "quack" },
  fish: { move: "spin", say: "Blub blub!", sound: "blub" },
  shark: { move: "hop", say: "CHOMP!", sound: "chomp" },
  pig: { move: "wiggle", say: "Oink oink!", sound: "oink" },
  cow: { move: "hop", say: "Moooo!", sound: "moo" },
  horse: { move: "hop", say: "Neigh!", sound: "neigh" },
  unicorn: { move: "spin", say: "Magic!", sound: "magic" },
  dinosaur: { move: "hop", say: "ROAR!", sound: "roar" },
  dragon: { move: "zoom", say: "ROAR!", sound: "roar" },
  hamster: { move: "spin", say: "Squeak!", sound: "squeak" },
  butterfly: { move: "zoom", say: "Flutter flutter!", sound: "magic" },
  person: { move: "hop", say: "Hi!", sound: "hi" },
  snowman: { move: "wiggle", say: "Brrr!", sound: "hi" },
  ball: { move: "bounce", say: "Boing!", sound: "boing" },
  balloon: { move: "zoom", say: "Wheee!", sound: "whoosh" },
  rocket: { move: "zoom", say: "Blast off!", sound: "whoosh" },
  airplane: { move: "zoom", say: "Zoom!", sound: "whoosh" },
  car: { move: "drive", say: "Vroom!", sound: "vroom" },
  bike: { move: "drive", say: "Ring ring!", sound: "bell" },
  robot: { move: "spin", say: "Beep boop!", sound: "beep" },
  "game controller": { move: "hop", say: "Level up!", sound: "levelup" },
  guitar: { move: "wiggle", say: "♪ ♫ ♪", sound: "strum" },
  dollhouse: { move: "hop", say: "Come play!", sound: "bell" },
  "go-kart": { move: "drive", say: "Vroom vroom!", sound: "vroom" },
  toaster: { move: "hop", say: "Ding! Toast!", sound: "bell" },
  "robot dog": { move: "wiggle", say: "Beep boop woof!", sound: "beep" },
  jetpack: { move: "zoom", say: "Whoosh! Jetpack!", sound: "whoosh" },
  "magnifying glass": { move: "spin", say: "Let's look closely...", sound: "magic" },
  key: { move: "spin", say: "A key! What does it open...?", sound: "magic" },
  "sky key": { move: "spin", say: "You'll need me to beat the game...", sound: "magic" },
  hoverboard: { move: "drive", say: "Wheee!", sound: "whoosh" },
  "bubble machine": { move: "bounce", say: "Bubbles everywhere!", sound: "blub" },
  "doomsday device": { move: "wiggle", say: "Click! ...It looks like nothing happened.", sound: "beep" },
};

const PI = Math.PI;
const B = (p: Vec3, k: Vec3, c: string, r?: Vec3): Part => ({ s: "box", p, k, c, r });
const S = (p: Vec3, k: Vec3 | number, c: string, r?: Vec3): Part => ({
  s: "sphere",
  p,
  k: typeof k === "number" ? [k, k, k] : k,
  c,
  r,
});
const C = (p: Vec3, k: Vec3, c: string, r?: Vec3, n?: number): Part => ({ s: "cylinder", p, k, c, r, n });
const K = (p: Vec3, k: Vec3, c: string, r?: Vec3, n?: number): Part => ({ s: "cone", p, k, c, r, n });
const T = (p: Vec3, k: Vec3 | number, c: string, t: number, r?: Vec3): Part => ({
  s: "torus",
  p,
  k: typeof k === "number" ? [k, k, k] : k,
  c,
  t,
  r,
});
const R = (p: Vec3, k: Vec3, c: string, r?: Vec3): Part => ({ s: "roof", p, k, c, r });

const BLACK = "#24222b";
const WHITE = "#f6f4f0";
const PINK = "#ff8fb8";
const SKIN = "#f2c7a5";

/** A pair of eyes on the front of a head at x, y, spaced by z. */
const eyes = (x: number, y: number, z: number, size = 0.09, c = BLACK): Part[] => [
  S([x, y, z], size, c),
  S([x, y, -z], size, c),
];

/** Four legs under a body. */
const legs = (x: number, z: number, y: number, k: Vec3, c: string): Part[] =>
  [
    [x, z],
    [x, -z],
    [-x, z],
    [-x, -z],
  ].map(([lx, lz]) => C([lx!, y, lz!], k, c));

const COLOR_WORDS: Record<string, string> = {
  red: "#e8383d",
  pink: "#ff8fc7",
  blue: "#4a9bff",
  purple: "#a35cff",
  green: "#4cc76a",
  yellow: "#ffd23f",
  orange: "#ff9226",
  black: "#2b2b33",
  white: "#f4f4f4",
  gray: "#a9adb5",
  grey: "#a9adb5",
  brown: "#9c6d40",
  gold: "#f2c230",
  golden: "#f2c230",
  silver: "#c9ced6",
  void: "#3a1466",
};
const RAINBOW = ["#ff4d4d", "#ff9a3c", "#ffd23f", "#4cc76a", "#4a9bff", "#a35cff"];

const MODELS: ModelDef[] = [
  {
    keys: ["cat", "kitty", "kitties", "kitten", "kittens"],
    name: "cat",
    main: "#2b2b33",
    parts: (m) => [
      S([0, 0, 0], [1.4, 0.8, 0.8], m),
      S([0.75, 0.45, 0], [0.7, 0.65, 0.65], m),
      K([0.68, 0.85, 0.18], [0.25, 0.32, 0.22], m),
      K([0.68, 0.85, -0.18], [0.25, 0.32, 0.22], m),
      ...eyes(1.07, 0.52, 0.14, 0.11, "#3dff6a"),
      S([1.1, 0.4, 0], 0.08, PINK),
      ...legs(0.42, 0.22, -0.45, [0.2, 0.5, 0.2], m),
      C([-0.85, 0.3, 0], [0.13, 0.85, 0.13], m, [0, 0, 0.6]),
    ],
  },
  {
    keys: ["dog", "dogs", "puppy", "puppies", "doggy", "doggie"],
    name: "dog",
    main: "#b07a46",
    parts: (m) => [
      S([0, 0, 0], [1.4, 0.75, 0.75], m),
      S([0.8, 0.45, 0], [0.65, 0.6, 0.6], m),
      S([1.1, 0.36, 0], [0.38, 0.28, 0.34], "#e2bd8e"),
      S([1.28, 0.42, 0], 0.11, BLACK),
      S([0.74, 0.5, 0.32], [0.2, 0.48, 0.12], "#6e4626"),
      S([0.74, 0.5, -0.32], [0.2, 0.48, 0.12], "#6e4626"),
      ...eyes(1.02, 0.56, 0.13),
      ...legs(0.42, 0.22, -0.45, [0.2, 0.5, 0.2], m),
      C([-0.8, 0.28, 0], [0.12, 0.55, 0.12], m, [0, 0, 0.9]),
    ],
  },
  {
    keys: ["bunny", "bunnies", "rabbit", "rabbits"],
    name: "bunny",
    main: WHITE,
    parts: (m) => [
      S([0, -0.1, 0], [0.9, 0.8, 0.8], m),
      S([0.45, 0.35, 0], [0.55, 0.5, 0.5], m),
      S([0.38, 0.85, 0.12], [0.15, 0.62, 0.12], m),
      S([0.38, 0.85, -0.12], [0.15, 0.62, 0.12], m),
      S([0.72, 0.35, 0], 0.09, PINK),
      ...eyes(0.66, 0.45, 0.12),
      S([-0.48, -0.05, 0], 0.25, WHITE),
      S([0.25, -0.48, 0.2], [0.38, 0.12, 0.18], m),
      S([0.25, -0.48, -0.2], [0.38, 0.12, 0.18], m),
    ],
  },
  {
    keys: ["bear", "bears", "teddy", "teddybear"],
    name: "teddy bear",
    main: "#9c6d40",
    parts: (m) => [
      S([0, -0.25, 0], [0.9, 1, 0.8], m),
      S([0.28, -0.25, 0], [0.4, 0.6, 0.5], "#d9b385"),
      S([0, 0.45, 0], [0.65, 0.6, 0.6], m),
      S([0, 0.75, 0.25], 0.22, m),
      S([0, 0.75, -0.25], 0.22, m),
      S([0.28, 0.4, 0], [0.24, 0.2, 0.26], "#d9b385"),
      S([0.39, 0.44, 0], 0.09, BLACK),
      ...eyes(0.26, 0.56, 0.12),
      S([0.1, -0.15, 0.45], [0.25, 0.5, 0.25], m),
      S([0.1, -0.15, -0.45], [0.25, 0.5, 0.25], m),
      S([0.2, -0.72, 0.25], [0.36, 0.3, 0.3], m),
      S([0.2, -0.72, -0.25], [0.36, 0.3, 0.3], m),
    ],
  },
  {
    keys: ["bird", "birds", "parrot", "chick", "birdie"],
    name: "bird",
    main: "#4a9bff",
    parts: (m) => [
      S([0, 0, 0], [0.9, 0.7, 0.6], m),
      S([0.42, 0.35, 0], 0.45, m),
      K([0.7, 0.33, 0], [0.13, 0.22, 0.13], "#ff9a1f", [0, 0, -PI / 2]),
      ...eyes(0.58, 0.42, 0.12, 0.08),
      S([-0.05, 0.05, 0.32], [0.6, 0.3, 0.12], m),
      S([-0.05, 0.05, -0.32], [0.6, 0.3, 0.12], m),
      B([-0.52, 0.08, 0], [0.38, 0.06, 0.25], m),
      C([0.05, -0.45, 0.12], [0.05, 0.3, 0.05], "#ff9a1f"),
      C([0.05, -0.45, -0.12], [0.05, 0.3, 0.05], "#ff9a1f"),
    ],
  },
  {
    keys: ["duck", "ducks", "duckling", "ducky"],
    name: "duck",
    main: "#ffd23f",
    parts: (m) => [
      S([0, -0.1, 0], [1.1, 0.7, 0.75], m),
      S([0.45, 0.4, 0], 0.5, m),
      B([0.78, 0.33, 0], [0.32, 0.08, 0.22], "#ff9a1f"),
      ...eyes(0.64, 0.5, 0.13, 0.08),
      K([-0.55, 0.1, 0], [0.3, 0.35, 0.3], m, [0, 0, PI / 3]),
      S([0, -0.05, 0.36], [0.6, 0.35, 0.1], m),
      S([0, -0.05, -0.36], [0.6, 0.35, 0.1], m),
    ],
  },
  {
    keys: ["fish", "fishes", "goldfish", "nemo"],
    name: "fish",
    main: "#ff9226",
    parts: (m) => [
      S([0, 0, 0], [1.2, 0.75, 0.35], m),
      K([-0.75, 0, 0], [0.62, 0.5, 0.12], m, [0, 0, -PI / 2]),
      K([0, 0.42, 0], [0.32, 0.26, 0.08], m),
      S([0.42, 0.12, 0.14], 0.13, WHITE),
      S([0.42, 0.12, -0.14], 0.13, WHITE),
      S([0.47, 0.12, 0.17], 0.07, BLACK),
      S([0.47, 0.12, -0.17], 0.07, BLACK),
    ],
  },
  {
    keys: ["shark", "sharks"],
    name: "shark",
    main: "#8c98a8",
    parts: (m) => [
      S([0, 0, 0], [1.8, 0.6, 0.6], m),
      S([0.05, -0.1, 0], [1.6, 0.42, 0.55], WHITE),
      K([0, 0.45, 0], [0.42, 0.55, 0.1], m, [0, 0, 0.3]),
      K([-1.05, 0.1, 0], [0.55, 0.75, 0.1], m, [0, 0, -PI / 2]),
      K([0.15, -0.25, 0.3], [0.3, 0.45, 0.06], m, [PI / 2.5, 0, 0]),
      K([0.15, -0.25, -0.3], [0.3, 0.45, 0.06], m, [-PI / 2.5, 0, 0]),
      ...eyes(0.68, 0.08, 0.2, 0.07),
    ],
  },
  {
    keys: ["turtle", "turtles", "tortoise"],
    name: "turtle",
    main: "#3e8f4f",
    parts: (m) => [
      S([0, 0, 0], [1.2, 0.65, 1], m),
      C([0, -0.15, 0], [1.15, 0.1, 0.95], "#d9c08a"),
      S([0.72, 0, 0], [0.38, 0.3, 0.3], "#8fd18c"),
      ...eyes(0.86, 0.06, 0.08, 0.06),
      ...[
        [0.4, 0.4],
        [0.4, -0.4],
        [-0.4, 0.4],
        [-0.4, -0.4],
      ].map(([x, z]) => S([x!, -0.2, z!], [0.3, 0.18, 0.3], "#8fd18c")),
    ],
  },
  {
    keys: ["pig", "pigs", "piggy", "piglet"],
    name: "pig",
    main: "#ffaac9",
    parts: (m) => [
      S([0, 0, 0], [1.2, 0.85, 0.85], m),
      S([0.6, 0.15, 0], 0.62, m),
      C([0.93, 0.1, 0], [0.3, 0.12, 0.3], "#ff7fa8", [0, 0, PI / 2]),
      ...eyes(0.84, 0.28, 0.14, 0.07),
      K([0.58, 0.5, 0.18], [0.18, 0.22, 0.12], m),
      K([0.58, 0.5, -0.18], [0.18, 0.22, 0.12], m),
      ...legs(0.35, 0.22, -0.48, [0.2, 0.35, 0.2], m),
      T([-0.62, 0.15, 0], 0.18, "#ff7fa8", 0.3, [PI / 2, 0, 0]),
    ],
  },
  {
    keys: ["cow", "cows", "calf"],
    name: "cow",
    main: WHITE,
    parts: (m) => [
      S([0, 0, 0], [1.4, 0.85, 0.8], m),
      S([0.1, 0.12, 0.36], [0.4, 0.32, 0.12], BLACK),
      S([-0.35, -0.05, -0.36], [0.4, 0.3, 0.12], BLACK),
      S([-0.3, 0.3, 0.2], [0.3, 0.12, 0.3], BLACK),
      S([0.8, 0.3, 0], [0.5, 0.45, 0.45], m),
      S([1.02, 0.2, 0], [0.26, 0.26, 0.36], PINK),
      K([0.75, 0.6, 0.18], [0.1, 0.22, 0.1], "#d9c08a"),
      K([0.75, 0.6, -0.18], [0.1, 0.22, 0.1], "#d9c08a"),
      ...eyes(0.98, 0.38, 0.13, 0.07),
      ...legs(0.45, 0.24, -0.5, [0.2, 0.5, 0.2], m),
    ],
  },
  {
    keys: ["horse", "horses", "pony", "ponies"],
    name: "horse",
    main: "#a0663a",
    parts: (m) => horseParts(m, false),
  },
  {
    keys: ["unicorn", "unicorns"],
    name: "unicorn",
    main: WHITE,
    parts: (m) => horseParts(m, true),
  },
  {
    keys: ["dinosaur", "dinosaurs", "dino", "dinos", "trex", "t-rex"],
    name: "dinosaur",
    main: "#4cc76a",
    parts: (m) => dinoParts(m, false),
  },
  {
    keys: ["dragon", "dragons"],
    name: "dragon",
    main: "#e8383d",
    parts: (m) => dinoParts(m, true),
  },
  {
    keys: ["mouse", "mice", "hamster", "hamsters", "guinea"],
    name: "hamster",
    main: "#d9a56a",
    parts: (m) => [
      S([0, 0, 0], [1, 0.75, 0.8], m),
      S([0.3, -0.05, 0], [0.55, 0.55, 0.6], "#f4e2c8"),
      S([0.2, 0.35, 0.28], 0.25, m),
      S([0.2, 0.35, -0.28], 0.25, m),
      S([0.5, 0.05, 0], 0.08, PINK),
      ...eyes(0.42, 0.18, 0.15, 0.08),
    ],
  },
  {
    keys: ["butterfly", "butterflies"],
    name: "butterfly",
    main: "#a35cff",
    parts: (m) => [
      C([0, 0, 0], [0.12, 0.9, 0.12], BLACK),
      S([0, 0.2, 0.45], [0.1, 0.75, 0.62], m, [0.25, 0, 0]),
      S([0, 0.2, -0.45], [0.1, 0.75, 0.62], m, [-0.25, 0, 0]),
      S([0, -0.25, 0.32], [0.08, 0.45, 0.4], PINK, [-0.3, 0, 0]),
      S([0, -0.25, -0.32], [0.08, 0.45, 0.4], PINK, [0.3, 0, 0]),
      C([0, 0.55, 0.08], [0.03, 0.3, 0.03], BLACK, [0.4, 0, 0]),
      C([0, 0.55, -0.08], [0.03, 0.3, 0.03], BLACK, [-0.4, 0, 0]),
    ],
  },
  {
    keys: [
      "me", "mom", "mommy", "mama", "mum", "dad", "daddy", "papa", "brother", "sister", "baby", "friend",
      "friends", "family", "grandma", "grandpa", "nana", "teacher", "boy", "girl", "people", "person", "kid",
      "kids", "doll", "dolls", "oscar", "penelope", "claire", "clair", "holden", "maeve", "myself",
    ],
    name: "person",
    main: "#ff6fb5",
    parts: (m, seed) => {
      const hair = ["#5a3a22", "#24222b", "#e8c46a", "#b5532e"][seed % 4]!;
      return [
        C([0, -0.7, 0.14], [0.22, 0.7, 0.22], "#3d5a9e"),
        C([0, -0.7, -0.14], [0.22, 0.7, 0.22], "#3d5a9e"),
        S([0.06, -1.06, 0.14], [0.32, 0.14, 0.22], BLACK),
        S([0.06, -1.06, -0.14], [0.32, 0.14, 0.22], BLACK),
        C([0, -0.1, 0], [0.42, 0.7, 0.6], m),
        C([0, -0.12, 0.38], [0.16, 0.62, 0.16], m, [-0.25, 0, 0]),
        C([0, -0.12, -0.38], [0.16, 0.62, 0.16], m, [0.25, 0, 0]),
        S([0, -0.46, 0.46], 0.16, SKIN),
        S([0, -0.46, -0.46], 0.16, SKIN),
        S([0, 0.5, 0], [0.5, 0.55, 0.5], SKIN),
        // Hair: a cap over the top and a bit down the back, clear of the face.
        S([-0.05, 0.64, 0], [0.5, 0.36, 0.54], hair),
        S([-0.12, 0.5, 0], [0.34, 0.48, 0.52], hair),
        S([0.215, 0.55, 0.1], [0.06, 0.09, 0.08], WHITE),
        S([0.215, 0.55, -0.1], [0.06, 0.09, 0.08], WHITE),
        S([0.24, 0.55, 0.1], [0.04, 0.06, 0.05], BLACK),
        S([0.24, 0.55, -0.1], [0.04, 0.06, 0.05], BLACK),
        S([0.25, 0.48, 0], [0.07, 0.07, 0.06], "#e8ad8a"),
        B([0.235, 0.41, 0], [0.03, 0.03, 0.12], "#c0392b"),
      ];
    },
  },
  {
    keys: ["house", "home", "houses", "dollhouse", "dollhouses", "school", "cottage"],
    name: "dollhouse",
    main: "#e8383d",
    parts: (m) => dollhouseParts(m, false),
  },
  {
    keys: ["castle", "castles", "palace"],
    name: "castle",
    main: "#c27bff",
    parts: (m) => [
      B([0, -0.2, 0], [1.6, 0.9, 1.2], "#c6c1d4"),
      ...[
        [0.8, 0.6],
        [0.8, -0.6],
        [-0.8, 0.6],
        [-0.8, -0.6],
      ].flatMap(([x, z]) => [
        C([x!, 0, z!], [0.45, 1.3, 0.45], "#b1abc2"),
        K([x!, 0.9, z!], [0.55, 0.55, 0.55], m),
      ]),
      B([0.81, -0.4, 0], [0.04, 0.5, 0.35], "#8b5a2b"),
      C([0.8, 1.35, 0.6], [0.03, 0.4, 0.03], "#666"),
      B([0.8, 1.45, 0.72], [0.02, 0.15, 0.22], "#ff4fa3"),
    ],
  },
  {
    keys: ["pizza", "pizzas"],
    name: "pizza",
    main: "#c8402f",
    parts: (m) => [
      C([0, 0, 0], [2, 0.12, 2], "#e8b86d", undefined, 20),
      C([0, 0.07, 0], [1.8, 0.04, 1.8], "#ffd34d", undefined, 20),
      ...[
        [0, 0],
        [0.5, 0.3],
        [-0.5, 0.35],
        [0.35, -0.5],
        [-0.4, -0.45],
        [0.05, 0.62],
        [0.65, -0.1],
        [-0.65, 0],
      ].map(([x, z]) => C([x!, 0.1, z!], [0.3, 0.05, 0.3], m)),
    ],
  },
  {
    keys: ["cake", "cakes", "birthday"],
    name: "cake",
    main: "#ff9fcf",
    parts: (m) => [
      C([0, -0.3, 0], [1.6, 0.6, 1.6], m, undefined, 20),
      C([0, 0.15, 0], [1.1, 0.4, 1.1], WHITE, undefined, 18),
      C([0, 0.55, 0], [0.08, 0.4, 0.08], "#ffd23f"),
      S([0, 0.82, 0], [0.12, 0.18, 0.12], "#ff9226"),
      ...Array.from({ length: 6 }, (_, i): Part => {
        const a = (i / 6) * PI * 2;
        return S([Math.cos(a) * 0.65, 0.04, Math.sin(a) * 0.65], 0.16, "#e8383d");
      }),
    ],
  },
  {
    keys: ["cupcake", "cupcakes", "muffin"],
    name: "cupcake",
    main: "#ffb8dc",
    parts: (m) => [
      C([0, -0.35, 0], [0.8, 0.55, 0.8], "#7fc8ff", undefined, 12),
      S([0, 0.02, 0], [0.98, 0.5, 0.98], m),
      S([0, 0.3, 0], [0.62, 0.4, 0.62], m),
      S([0, 0.55, 0], 0.2, "#e8383d"),
    ],
  },
  {
    keys: ["ice", "icecream", "gelato", "sundae"],
    name: "ice cream",
    main: "#ff9fcf",
    parts: (m) => [
      K([0, -0.45, 0], [0.6, 1, 0.6], "#e0a95c", [0, 0, PI]),
      S([0, 0.15, 0], [0.7, 0.6, 0.7], m),
      S([0, 0.6, 0], [0.6, 0.55, 0.6], "#7a4a2a"),
      S([0, 0.95, 0], 0.18, "#e8383d"),
    ],
  },
  {
    keys: ["donut", "donuts", "doughnut", "doughnuts"],
    name: "donut",
    main: "#ff8fc7",
    parts: (m) => [
      T([0, 0, 0], 1.6, "#d9a35f", 0.4),
      T([0, 0.08, 0], [1.62, 1.2, 1.62], m, 0.38),
      ...Array.from({ length: 10 }, (_, i): Part => {
        const a = (i / 10) * PI * 2;
        return B([Math.cos(a) * 0.5, 0.36, Math.sin(a) * 0.5], [0.12, 0.04, 0.04], RAINBOW[i % 6]!, [0, a * 2, 0]);
      }),
    ],
  },
  {
    keys: ["cookie", "cookies"],
    name: "cookie",
    main: "#d9a35f",
    parts: (m) => [
      C([0, 0, 0], [1.4, 0.18, 1.4], m, undefined, 18),
      ...[
        [0, 0],
        [0.35, 0.3],
        [-0.4, 0.2],
        [0.25, -0.4],
        [-0.25, -0.35],
        [0.5, -0.05],
      ].map(([x, z]) => S([x!, 0.09, z!], [0.16, 0.1, 0.16], "#4a2a17")),
    ],
  },
  {
    keys: ["pancake", "pancakes", "waffle", "waffles", "breakfast"],
    name: "pancakes",
    main: "#e6b06a",
    parts: (m) => [
      ...Array.from({ length: 4 }, (_, i) => C([0, -0.4 + i * 0.18, 0], [1.4 - (i % 2) * 0.05, 0.16, 1.4], m, undefined, 18)),
      C([0, 0.24, 0], [1.0, 0.04, 1.0], "#8a4a1c", undefined, 16),
      B([0, 0.3, 0], [0.3, 0.12, 0.3], "#ffe680"),
    ],
  },
  {
    keys: ["burger", "burgers", "hamburger", "cheeseburger"],
    name: "burger",
    main: "#e0a95c",
    parts: (m) => [
      C([0, -0.4, 0], [1.3, 0.25, 1.3], m, undefined, 18),
      C([0, -0.18, 0], [1.35, 0.22, 1.35], "#6b3a1f", undefined, 18),
      B([0, -0.04, 0], [1.15, 0.06, 1.15], "#ffd23f", [0, 0.4, 0]),
      C([0, 0.04, 0], [1.4, 0.07, 1.4], "#4cc76a", undefined, 18),
      C([0, 0.1, 0], [1.2, 0.07, 1.2], "#e8383d", undefined, 18),
      S([0, 0.25, 0], [1.3, 0.6, 1.3], m),
      ...[
        [0.2, 0.1],
        [-0.25, 0.2],
        [0.05, -0.3],
        [-0.15, -0.1],
      ].map(([x, z]) => S([x!, 0.53, z!], [0.08, 0.04, 0.05], WHITE)),
    ],
  },
  {
    keys: ["apple", "apples"],
    name: "apple",
    main: "#e8383d",
    parts: (m) => [
      S([0, 0, 0], [1, 0.95, 1], m),
      C([0, 0.55, 0], [0.06, 0.25, 0.06], "#6b3a1f"),
      S([0.15, 0.6, 0], [0.32, 0.08, 0.15], "#4cc76a", [0, 0, 0.4]),
    ],
  },
  {
    keys: ["banana", "bananas"],
    name: "banana",
    main: "#ffd23f",
    parts: (m) =>
      Array.from({ length: 7 }, (_, i): Part => {
        const a = -0.9 + (i / 6) * 1.8;
        const end = i === 0 || i === 6;
        return S([Math.sin(a), (1 - Math.cos(a)) * 0.9, 0], end ? 0.16 : 0.34 - Math.abs(a) * 0.08, end ? "#6b4a2a" : m);
      }),
  },
  {
    keys: ["strawberry", "strawberries", "berry", "berries"],
    name: "strawberry",
    main: "#e8383d",
    parts: (m) => [
      K([0, -0.1, 0], [0.9, 1.1, 0.9], m, [0, 0, PI]),
      S([0, 0.42, 0], [0.9, 0.4, 0.9], m),
      C([0, 0.62, 0], [0.62, 0.08, 0.62], "#4cc76a", undefined, 6),
      C([0, 0.75, 0], [0.06, 0.2, 0.06], "#3e8f4f"),
    ],
  },
  {
    keys: ["candy", "lollipop", "lollipops", "sweets", "lolly"],
    name: "lollipop",
    main: "#ff8fc7",
    parts: (m) => [
      C([0, -0.6, 0], [0.07, 1.1, 0.07], WHITE),
      C([0, 0.35, 0], [0.9, 0.18, 0.9], m, [PI / 2, 0, 0], 18),
      T([0, 0.35, 0], [0.6, 1.6, 0.6], WHITE, 0.2, [PI / 2, 0, 0]),
    ],
  },
  {
    keys: ["chocolate", "chocolates"],
    name: "chocolate bar",
    main: "#6b3a1f",
    parts: (m) => [
      B([0, 0, 0], [1.2, 0.15, 0.8], m),
      ...[-0.4, 0, 0.4].flatMap((x) => [-0.2, 0.2].map((z) => B([x, 0.1, z], [0.32, 0.06, 0.32], "#7f4a2a"))),
      B([-0.3, 0.02, 0], [0.62, 0.2, 0.84], "#c8402f"),
    ],
  },
  {
    keys: ["tree", "trees", "forest", "nature"],
    name: "tree",
    main: "#4cc76a",
    parts: (m) => [
      C([0, -0.5, 0], [0.3, 1, 0.3], "#8b5a2b"),
      S([0, 0.35, 0], [1.3, 1.2, 1.3], m),
      S([0.35, 0.65, 0.1], 0.8, "#6fdc84"),
      S([-0.3, 0.6, -0.2], 0.75, "#3eb35a"),
    ],
  },
  {
    keys: ["flower", "flowers", "rose", "roses", "tulip", "daisy", "garden"],
    name: "flower",
    main: "#ff8fc7",
    parts: (m) => [
      C([0, -0.45, 0], [0.08, 1.2, 0.08], "#4cc76a"),
      S([0.15, -0.45, 0], [0.38, 0.12, 0.16], "#4cc76a", [0, 0, 0.5]),
      S([0, 0.3, 0], [0.32, 0.32, 0.18], "#ffd23f"),
      ...Array.from({ length: 6 }, (_, i): Part => {
        const a = (i / 6) * PI * 2;
        return S([Math.cos(a) * 0.3, 0.3 + Math.sin(a) * 0.3, 0], [0.32, 0.32, 0.1], m);
      }),
    ],
  },
  {
    keys: ["sun", "sunny", "sunshine", "summer"],
    name: "sun",
    main: "#ffd23f",
    parts: (m) => [
      S([0, 0, 0], 1.1, m),
      ...Array.from({ length: 8 }, (_, i): Part => {
        const a = (i / 8) * PI * 2;
        return K([Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0], [0.26, 0.35, 0.16], "#ff9226", [0, 0, a - PI / 2]);
      }),
    ],
  },
  {
    keys: ["moon", "night", "space"],
    name: "moon",
    main: "#f2e6a8",
    parts: (m) => [
      S([0, 0, 0], 1.2, m),
      S([0.3, 0.25, 0.42], [0.25, 0.25, 0.1], "#d6c886"),
      S([-0.25, -0.2, 0.5], [0.3, 0.3, 0.1], "#d6c886"),
      S([0.1, -0.35, -0.45], [0.2, 0.2, 0.1], "#d6c886"),
    ],
  },
  {
    keys: ["star", "stars", "starry"],
    name: "star",
    main: "#ffd23f",
    parts: (m) => [
      S([0, 0, 0], [0.62, 0.62, 0.26], m),
      ...Array.from({ length: 5 }, (_, i): Part => {
        const a = PI / 2 + (i / 5) * PI * 2;
        return K([Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0], [0.42, 0.6, 0.24], m, [0, 0, a - PI / 2]);
      }),
    ],
  },
  {
    keys: ["rainbow", "rainbows"],
    name: "rainbow",
    main: "#ff4d4d",
    parts: () => [
      ...RAINBOW.flatMap((color, ring) => {
        const r = 1 - ring * 0.09;
        return Array.from({ length: 12 }, (_, i): Part => {
          const a = ((i + 0.5) / 12) * PI;
          return B([Math.cos(a) * r, Math.sin(a) * r - 0.4, 0], [0.1, r * 0.29, 0.22], color, [0, 0, a]);
        });
      }),
      S([0.78, -0.45, 0], [0.45, 0.3, 0.35], WHITE),
      S([-0.78, -0.45, 0], [0.45, 0.3, 0.35], WHITE),
    ],
  },
  {
    keys: ["heart", "hearts", "love"],
    name: "heart",
    main: "#ff4fa3",
    parts: (m) => [
      S([-0.3, 0.2, 0], [0.75, 0.75, 0.5], m),
      S([0.3, 0.2, 0], [0.75, 0.75, 0.5], m),
      K([0, -0.32, 0], [1.25, 0.95, 0.5], m, [0, 0, PI]),
    ],
  },
  {
    keys: ["ball", "balls", "soccer", "football", "basketball", "baseball", "sports"],
    name: "ball",
    main: "#e8383d",
    parts: (m) => [
      S([0, 0, 0], 1.4, m),
      T([0, 0, 0], 1.43, WHITE, 0.06, [PI / 2, 0, 0]),
      T([0, 0, 0], 1.43, WHITE, 0.06, [0, 0, PI / 2]),
    ],
  },
  {
    keys: ["balloon", "balloons", "party"],
    name: "balloon",
    main: "#e8383d",
    parts: (m) => [
      S([0, 0.3, 0], [1, 1.2, 1], m),
      K([0, -0.33, 0], [0.15, 0.12, 0.15], m, [0, 0, PI]),
      C([0, -0.9, 0], [0.03, 1.1, 0.03], "#888"),
    ],
  },
  {
    keys: ["present", "presents", "gift", "gifts", "christmas", "surprise"],
    name: "present",
    main: "#4a9bff",
    parts: (m) => giftParts(m),
  },
  {
    keys: ["gem", "gems", "diamond", "diamonds", "crystal", "crystals", "jewel", "rock", "rocks"],
    name: "gem",
    main: "#5fe0ff",
    parts: (m) => [
      K([0, 0.25, 0], [1, 0.5, 1], m, undefined, 8),
      K([0, -0.35, 0], [1, 0.7, 1], m, [0, 0, PI], 8),
    ],
  },
  {
    keys: ["crown", "princess", "queen", "king", "prince"],
    name: "crown",
    main: "#f2c230",
    parts: (m) => [
      C([0, 0, 0], [1, 0.4, 1], m, undefined, 16),
      ...Array.from({ length: 6 }, (_, i): Part => {
        const a = (i / 6) * PI * 2;
        return K([Math.cos(a) * 0.42, 0.37, Math.sin(a) * 0.42], [0.24, 0.36, 0.24], m);
      }),
      ...Array.from({ length: 6 }, (_, i): Part => {
        const a = (i / 6) * PI * 2 + PI / 6;
        return S([Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5], 0.13, i % 2 ? "#e8383d" : "#4a9bff");
      }),
    ],
  },
  {
    keys: ["car", "cars", "truck", "trucks", "racecar"],
    name: "car",
    main: "#e8383d",
    parts: (m) => [
      B([0, -0.1, 0], [2, 0.5, 1], m),
      B([-0.1, 0.3, 0], [1.1, 0.45, 0.9], m),
      B([-0.1, 0.32, 0], [1.0, 0.3, 0.92], "#bfe6ff"),
      B([-0.1, 0.32, 0], [1.12, 0.3, 0.8], "#bfe6ff"),
      ...[
        [0.6, 0.5],
        [0.6, -0.5],
        [-0.6, 0.5],
        [-0.6, -0.5],
      ].map(([x, z]) => C([x!, -0.35, z!], [0.45, 0.2, 0.45], BLACK, [PI / 2, 0, 0], 12)),
      S([1.0, -0.05, 0.3], 0.14, "#fff4a8"),
      S([1.0, -0.05, -0.3], 0.14, "#fff4a8"),
    ],
  },
  {
    keys: ["bike", "bikes", "bicycle", "scooter"],
    name: "bike",
    main: "#a35cff",
    parts: (m) => [
      T([0.6, -0.2, 0], 0.8, BLACK, 0.14, [PI / 2, 0, 0]),
      T([-0.6, -0.2, 0], 0.8, BLACK, 0.14, [PI / 2, 0, 0]),
      B([0, -0.05, 0], [1.1, 0.07, 0.07], m, [0, 0, 0.2]),
      B([-0.25, 0.1, 0], [0.07, 0.6, 0.07], m),
      B([-0.28, 0.42, 0], [0.32, 0.07, 0.16], BLACK),
      C([0.48, 0.15, 0], [0.06, 0.75, 0.06], m, [0, 0, -0.3]),
      B([0.58, 0.5, 0], [0.07, 0.07, 0.6], BLACK),
    ],
  },
  {
    keys: ["plane", "planes", "airplane", "airplanes", "jet", "flying"],
    name: "airplane",
    main: "#4a9bff",
    parts: (m) => [
      C([0, 0, 0], [0.4, 1.8, 0.4], WHITE, [0, 0, PI / 2]),
      S([0.9, 0, 0], 0.4, WHITE),
      B([0.05, -0.05, 0], [0.5, 0.06, 2], m),
      B([-0.8, 0.25, 0], [0.3, 0.42, 0.05], m),
      B([-0.8, 0.05, 0], [0.25, 0.04, 0.7], m),
      ...[0.5, 0.25, 0, -0.25].map((x) => S([x, 0.08, 0.19], [0.1, 0.1, 0.04], "#4a9bff")),
    ],
  },
  {
    keys: ["rocket", "rockets", "spaceship", "astronaut"],
    name: "rocket",
    main: "#e8383d",
    parts: (m) => [
      C([0, 0, 0], [0.6, 1.4, 0.6], WHITE),
      K([0, 0.95, 0], [0.6, 0.5, 0.6], m),
      B([0.38, -0.55, 0], [0.25, 0.4, 0.06], m),
      B([-0.38, -0.55, 0], [0.25, 0.4, 0.06], m),
      B([0, -0.55, 0.38], [0.06, 0.4, 0.25], m),
      B([0, -0.55, -0.38], [0.06, 0.4, 0.25], m),
      C([0.3, 0.25, 0], [0.28, 0.05, 0.28], "#4a9bff", [0, 0, PI / 2]),
      K([0, -0.9, 0], [0.35, 0.4, 0.35], "#ff9226", [0, 0, PI]),
    ],
  },
  {
    keys: ["boat", "boats", "ship", "ships", "sailboat", "ocean", "sea", "raft"],
    name: "boat",
    main: "#e8383d",
    parts: (m) => [
      C([0, -0.55, 0], [2.2, 0.05, 1.3], "#4a9bff", undefined, 18),
      B([0, -0.3, 0], [1.6, 0.4, 0.7], m),
      B([-0.35, 0.05, 0], [0.55, 0.32, 0.5], WHITE),
      C([0.3, 0.55, 0], [0.05, 1.3, 0.05], "#6b3a1f"),
      R([0.6, 0.55, 0], [0.55, 0.9, 0.03], WHITE),
    ],
  },
  {
    keys: ["robot", "robots", "computer", "computers", "coding"],
    name: "robot",
    main: "#a9b4c2",
    parts: (m) => [
      B([0, -0.2, 0], [0.7, 0.9, 0.9], m),
      B([0, 0.5, 0], [0.55, 0.45, 0.6], m),
      ...eyes(0.28, 0.54, 0.13, 0.12, "#5fe0ff"),
      B([0.28, 0.38, 0], [0.02, 0.05, 0.3], BLACK),
      C([0, 0.85, 0], [0.04, 0.25, 0.04], "#666"),
      S([0, 1.0, 0], 0.13, "#e8383d"),
      S([0.36, -0.1, 0], 0.15, "#ffd23f"),
      B([0, -0.15, 0.56], [0.2, 0.7, 0.2], m),
      B([0, -0.15, -0.56], [0.2, 0.7, 0.2], m),
      B([0, -0.85, 0.2], [0.25, 0.45, 0.25], "#7d8794"),
      B([0, -0.85, -0.2], [0.25, 0.45, 0.25], "#7d8794"),
    ],
  },
  {
    keys: ["minecraft", "block", "blocks", "grass", "dirt"],
    name: "grass block",
    main: "#5fb33b",
    parts: (m) => [
      B([0, 0, 0], [1.4, 1.4, 1.4], "#8b5a2b"),
      B([0, 0.6, 0], [1.42, 0.22, 1.42], m),
      ...[-0.45, 0, 0.45].flatMap((d) => [
        B([0.71, 0.42, d], [0.02, 0.18, 0.2], m),
        B([d, 0.42, 0.71], [0.2, 0.18, 0.02], m),
        B([-0.71, 0.4, d], [0.02, 0.22, 0.18], m),
        B([d, 0.4, -0.71], [0.18, 0.22, 0.02], m),
      ]),
      B([0.71, -0.2, 0.3], [0.02, 0.2, 0.2], "#6e4520"),
      B([-0.2, -0.4, 0.71], [0.2, 0.2, 0.02], "#a8743d"),
    ],
  },
  {
    keys: ["game", "games", "gaming", "videogame", "videogames", "controller", "nintendo", "xbox", "playstation", "roblox", "switch"],
    name: "game controller",
    main: "#3b3f4a",
    parts: (m) => [
      B([0, 0, 0], [1.2, 0.3, 0.62], m),
      S([0.6, -0.02, 0.15], [0.55, 0.3, 0.62], m),
      S([-0.6, -0.02, 0.15], [0.55, 0.3, 0.62], m),
      B([-0.45, 0.17, 0], [0.36, 0.06, 0.1], BLACK),
      B([-0.45, 0.17, 0], [0.1, 0.06, 0.36], BLACK),
      S([0.5, 0.17, 0.1], 0.12, "#e8383d"),
      S([0.62, 0.17, -0.02], 0.12, "#4cc76a"),
      S([0.38, 0.17, -0.02], 0.12, "#4a9bff"),
      S([0.5, 0.17, -0.14], 0.12, "#ffd23f"),
    ],
  },
  {
    keys: ["lego", "legos", "toy", "toys"],
    name: "toy blocks",
    main: "#e8383d",
    parts: (m) => [
      B([0, -0.35, 0], [1.2, 0.4, 0.6], m),
      B([0.15, 0.05, 0], [0.9, 0.4, 0.6], "#4a9bff"),
      B([-0.1, 0.45, 0], [0.6, 0.4, 0.6], "#ffd23f"),
      ...[-0.25, 0.05].flatMap((x) => [-0.15, 0.15].map((z) => C([x + 0.1, 0.7, z], [0.16, 0.1, 0.16], "#ffd23f", undefined, 10))),
    ],
  },
  {
    keys: ["book", "books", "reading", "read", "story", "stories"],
    name: "book",
    main: "#a35cff",
    parts: (m) => [
      B([0, 0, 0], [1.1, 0.26, 0.8], m),
      B([0.04, 0, 0], [1.08, 0.2, 0.76], WHITE),
      B([0, 0.135, 0.15], [0.5, 0.01, 0.2], "#ffd23f"),
    ],
  },
  {
    keys: ["phone", "phones", "ipad", "tablet", "iphone"],
    name: "tablet",
    main: "#2b2b33",
    parts: (m) => [B([0, 0, 0], [0.8, 1.1, 0.08], m), B([0, 0, 0.045], [0.7, 0.95, 0.01], "#7fc8ff")],
  },
  {
    keys: ["tv", "television", "movie", "movies", "show", "shows", "youtube"],
    name: "TV",
    main: "#2b2b33",
    parts: (m) => [
      B([0, 0.1, 0], [1.6, 1, 0.12], m),
      B([0, 0.1, 0.065], [1.45, 0.85, 0.01], "#7fc8ff"),
      C([0, -0.5, 0], [0.12, 0.3, 0.12], m),
      B([0, -0.66, 0], [0.7, 0.05, 0.35], m),
    ],
  },
  {
    keys: ["guitar", "guitars", "music", "song", "songs", "singing", "sing"],
    name: "guitar",
    main: "#ff9226",
    parts: (m) => [
      S([0, -0.35, 0], [0.9, 0.9, 0.3], m),
      S([0, 0.15, 0], [0.7, 0.7, 0.3], m),
      C([0, -0.15, 0.15], [0.25, 0.02, 0.25], "#3a2a1a", [PI / 2, 0, 0]),
      B([0, 0.75, 0], [0.15, 1.0, 0.08], "#6b3a1f"),
      B([0, 1.3, 0], [0.22, 0.25, 0.1], "#4a2a17"),
    ],
  },
  {
    keys: ["pencil", "pencils", "art", "drawing", "draw", "painting", "paint", "crayon", "crayons"],
    name: "pencil",
    main: "#ffd23f",
    parts: (m) => [
      C([0, 0, 0], [0.25, 1.4, 0.25], m, undefined, 6),
      K([0, 0.88, 0], [0.25, 0.35, 0.25], "#f0c890", undefined, 6),
      K([0, 1.0, 0], [0.08, 0.12, 0.08], BLACK, undefined, 6),
      C([0, -0.76, 0], [0.25, 0.12, 0.25], "#c9ced6", undefined, 10),
      C([0, -0.88, 0], [0.25, 0.14, 0.25], "#ff8fb8", undefined, 10),
    ],
  },
  {
    keys: ["bed", "beds", "sleep", "sleeping", "nap", "pillow"],
    name: "bed",
    main: "#a35cff",
    parts: (m) => [
      B([0, 0, 0], [1.6, 0.3, 1], "#8b5a2b"),
      B([0, 0.2, 0], [1.5, 0.2, 0.95], WHITE),
      B([-0.15, 0.31, 0], [1.2, 0.06, 0.98], m),
      B([0.6, 0.36, 0], [0.3, 0.12, 0.7], WHITE),
      B([0.82, 0.25, 0], [0.06, 0.8, 1], "#8b5a2b"),
    ],
  },
  // The three things only an Engineer builds (the Robot and Rocket already have models).
  {
    keys: ["go-kart", "gokart", "kart", "karts"],
    name: "go-kart",
    main: "#ff9226",
    parts: (m) => [
      B([0, -0.15, 0], [1.6, 0.18, 0.9], m),
      B([-0.2, 0.05, 0], [0.45, 0.35, 0.5], BLACK),
      B([-0.4, 0.3, 0], [0.08, 0.4, 0.5], BLACK),
      B([-0.75, 0.05, 0], [0.3, 0.3, 0.6], "#7d8794"),
      C([0.35, 0.2, 0], [0.04, 0.5, 0.04], "#666666", [0, 0, -0.5]),
      T([0.48, 0.42, 0], 0.32, BLACK, 0.2, [0, 0, -0.5]),
      ...[
        [0.55, 0.5],
        [0.55, -0.5],
        [-0.55, 0.52],
        [-0.55, -0.52],
      ].map(([x, z]) => C([x!, -0.18, z!], [0.4, 0.22, 0.4], BLACK, [PI / 2, 0, 0], 12)),
    ],
  },
  {
    // First place at the go-kart race wins one (race.ts).
    keys: ["trophy", "trophies", "winner"],
    name: "trophy",
    main: "#f2c230",
    parts: (m) => [
      B([0, -0.62, 0], [0.7, 0.18, 0.7], "#6b3a1f"),
      C([0, -0.4, 0], [0.14, 0.3, 0.14], m),
      C([0, -0.22, 0], [0.4, 0.08, 0.4], m),
      K([0, 0.25, 0], [0.9, 0.9, 0.9], m, [0, 0, PI], 16),
      C([0, 0.68, 0], [0.9, 0.06, 0.9], m, undefined, 16),
      T([0.48, 0.38, 0], [0.38, 0.38, 0.38], m, 0.25, [PI / 2, 0, 0]),
      T([-0.48, 0.38, 0], [0.38, 0.38, 0.38], m, 0.25, [PI / 2, 0, 0]),
    ],
  },
  {
    // Click it and you can look closely at the box room (see main.ts).
    keys: ["magnifyingglass", "magnifier", "magnifying"],
    name: "magnifying glass",
    main: "#c9ced6",
    parts: (m) => [
      T([0, 0.35, 0], [0.9, 0.9, 0.9], m, 0.15, [PI / 2, 0, 0]),
      C([0, 0.35, 0], [0.78, 0.04, 0.78], "#d8f0ff", [PI / 2, 0, 0], 18),
      C([0, -0.12, 0], [0.1, 0.14, 0.1], m),
      C([0, -0.55, 0], [0.16, 0.75, 0.16], "#8b5a2b"),
    ],
  },
  // The robber's stuff (walk.ts): he gets blasted into the sky and your
  // dinos fetch it all, and it sells for a fortune at the Farmers Market.
  {
    keys: ["beanie", "hat", "hats"],
    name: "hat",
    main: "#2b2b33",
    parts: (m) => [S([0, 0, 0], [1.2, 0.9, 1.2], m), C([0, -0.3, 0], [1.25, 0.3, 1.25], m), S([0, 0.5, 0], 0.3, "#e8383d")],
  },
  {
    keys: ["mask", "masks"],
    name: "mask",
    main: "#2b2b33",
    parts: (m) => [
      B([0, 0, 0], [1.6, 0.5, 0.1], m),
      S([-0.35, 0, 0.06], [0.35, 0.25, 0.05], "#f6f4f0"),
      S([0.35, 0, 0.06], [0.35, 0.25, 0.05], "#f6f4f0"),
      B([0.95, 0.05, -0.1], [0.4, 0.08, 0.04], m),
    ],
  },
  {
    keys: ["shoes", "shoe", "boots", "sneakers"],
    name: "shoes",
    main: "#6b3a1f",
    parts: (m) => [
      ...[-0.35, 0.35].flatMap((z) => [S([0.1, 0, z], [1, 0.4, 0.4], m), B([-0.25, 0.2, z], [0.4, 0.45, 0.38], m), B([0.05, -0.18, z], [1.05, 0.06, 0.42], "#24222b")]),
    ],
  },
  {
    keys: ["loot", "sack", "bag"],
    name: "loot bag",
    main: "#b9895a",
    parts: (m) => [S([0, -0.1, 0], [1.1, 1, 1], m), C([0, 0.45, 0], [0.3, 0.2, 0.3], m), T([0, 0.42, 0], 0.4, "#6b3a1f", 0.25), B([0, -0.05, 0.52], [0.4, 0.4, 0.02], "#2e9e4f")],
  },
  {
    keys: ["goldbars"],
    name: "gold bars",
    main: "#f2c230",
    parts: (m) =>
      [[-0.4, 0, 0], [0.4, 0, 0], [0, 0, 0.45], [-0.2, 0.3, 0.2], [0.2, 0.3, 0.2]].map(([x, y, z]) => B([x!, y!, z!], [0.7, 0.28, 0.4], m)),
  },
  {
    // A plain key ("purple key" from the dump is one of these).
    keys: ["key", "keys"],
    name: "key",
    main: "#f2c230",
    parts: (m) => [
      T([0, 0.5, 0], [0.6, 0.6, 0.6], m, 0.3, [PI / 2, 0, 0]),
      B([0, -0.2, 0], [0.14, 1.0, 0.1], m),
      B([0.14, -0.55, 0], [0.16, 0.1, 0.1], m),
      B([0.12, -0.35, 0], [0.12, 0.1, 0.1], m),
    ],
  },
  {
    // Found at the top of the Jetpack Climb (arcade.ts). It's for beating the game.
    keys: ["skykey"],
    name: "sky key",
    main: "#f2c230",
    parts: (m) => [
      T([0, 0.55, 0], [0.7, 0.7, 0.7], m, 0.3, [PI / 2, 0, 0]),
      S([0, 0.55, 0], [0.22, 0.22, 0.1], "#5fe0ff"),
      B([0, -0.2, 0], [0.14, 1.0, 0.1], m),
      B([0.14, -0.55, 0], [0.16, 0.1, 0.1], m),
      B([0.12, -0.35, 0], [0.12, 0.1, 0.1], m),
    ],
  },
  {
    keys: ["jetpack", "jetpacks"],
    name: "jetpack",
    main: "#e8383d",
    parts: (m) => [
      B([0, 0.05, 0], [0.5, 0.7, 0.18], "#7d8794"),
      C([0, 0.05, 0.28], [0.32, 0.9, 0.32], m),
      C([0, 0.05, -0.28], [0.32, 0.9, 0.32], m),
      K([0, 0.62, 0.28], [0.32, 0.25, 0.32], m),
      K([0, 0.62, -0.28], [0.32, 0.25, 0.32], m),
      K([0, -0.6, 0.28], [0.26, 0.4, 0.26], "#ff9226", [0, 0, PI]),
      K([0, -0.6, -0.28], [0.26, 0.4, 0.26], "#ff9226", [0, 0, PI]),
      B([0.28, 0.25, 0], [0.06, 0.5, 0.7], BLACK),
    ],
  },
  {
    keys: ["hoverboard", "hoverboards"],
    name: "hoverboard",
    main: "#a35cff",
    parts: (m) => [
      B([0, 0, 0], [1.6, 0.1, 0.5], m),
      S([0.8, 0, 0], [0.2, 0.1, 0.5], m),
      S([-0.8, 0, 0], [0.2, 0.1, 0.5], m),
      B([0, 0.06, 0], [1.1, 0.02, 0.3], "#ffe36e"),
      C([0.5, -0.14, 0], [0.3, 0.06, 0.3], "#5fe0ff"),
      C([-0.5, -0.14, 0], [0.3, 0.06, 0.3], "#5fe0ff"),
    ],
  },
  {
    keys: ["bubblemachine"],
    name: "bubble machine",
    main: "#4a9bff",
    parts: (m) => [
      B([0, -0.2, 0], [0.9, 0.5, 0.6], m),
      C([0.5, -0.05, 0], [0.18, 0.3, 0.18], "#7d8794", [0, 0, -PI / 2]),
      T([0.72, -0.05, 0], 0.3, "#ffe36e", 0.2, [0, 0, PI / 2]),
      S([0.95, 0.35, 0.1], 0.3, "#bfe6ff"),
      S([0.7, 0.65, -0.15], 0.22, "#d8c8ff"),
      S([1.1, 0.75, 0.2], 0.16, "#ffd0e8"),
      C([-0.2, 0.1, 0], [0.12, 0.2, 0.12], BLACK),
    ],
  },
  {
    keys: ["toaster", "toasters", "toast"],
    name: "toaster",
    main: "#c9ced6",
    parts: (m) => [
      B([0, 0, 0], [1.2, 0.8, 0.7], m),
      B([0, 0.41, 0.15], [0.9, 0.02, 0.12], BLACK),
      B([0, 0.41, -0.15], [0.9, 0.02, 0.12], BLACK),
      B([0, 0.55, 0.15], [0.7, 0.35, 0.08], "#e0a95c"),
      B([0, 0.55, -0.15], [0.7, 0.35, 0.08], "#e0a95c"),
      B([0.62, 0.1, 0], [0.06, 0.12, 0.2], BLACK),
      S([0, -0.1, 0.36], [0.25, 0.1, 0.02], "#e8383d"),
    ],
  },
  {
    keys: ["robotdog", "robodog"],
    name: "robot dog",
    main: "#a9b4c2",
    parts: (m) => [
      B([0, 0, 0], [1.2, 0.5, 0.55], m),
      B([0.75, 0.35, 0], [0.45, 0.4, 0.45], m),
      ...eyes(0.98, 0.42, 0.11, 0.1, "#5fe0ff"),
      B([0.7, 0.62, 0.15], [0.12, 0.2, 0.06], "#7d8794"),
      B([0.7, 0.62, -0.15], [0.12, 0.2, 0.06], "#7d8794"),
      ...legs(0.42, 0.18, -0.45, [0.14, 0.45, 0.14], "#7d8794"),
      C([-0.7, 0.3, 0], [0.06, 0.45, 0.06], "#7d8794", [0, 0, 0.8]),
      S([-0.88, 0.48, 0], 0.1, "#e8383d"),
    ],
  },
  {
    // T-Rex finds this and gives it to you for scratching his head (city.ts).
    // Clicking it presses the red button, which looks like it does nothing...
    // but sends a meteor at the Dino Dimension (see city.ts).
    keys: ["doomsday"],
    name: "doomsday device",
    main: "#5d626c",
    parts: (m) => [
      B([0, 0, 0], [1.2, 0.6, 0.8], m),
      B([0, -0.22, 0.405], [1.2, 0.12, 0.01], "#ffd23f"),
      ...[-0.45, -0.15, 0.15, 0.45].map((x) => B([x, -0.22, 0.41], [0.12, 0.12, 0.01], BLACK, [0, 0, 0.6])),
      C([0, 0.34, 0], [0.5, 0.08, 0.5], "#3b3f4a"),
      C([0, 0.42, 0], [0.38, 0.12, 0.38], "#e8383d"),
      B([-0.3, 0.08, 0.405], [0.36, 0.2, 0.01], "#3dff6a"),
      S([0.22, 0.08, 0.41], 0.09, "#ffd23f"),
      S([0.42, 0.08, 0.41], 0.09, "#e8383d"),
      C([0.45, 0.6, 0.25], [0.04, 0.6, 0.04], "#a9adb5"),
      S([0.45, 0.92, 0.25], 0.12, "#e8383d"),
    ],
  },
  {
    keys: ["snowman", "snow", "winter", "frosty"],
    name: "snowman",
    main: WHITE,
    parts: (m) => [
      S([0, -0.5, 0], 0.95, m),
      S([0, 0.15, 0], 0.7, m),
      S([0, 0.65, 0], 0.5, m),
      ...eyes(0.22, 0.72, 0.09, 0.07),
      K([0.32, 0.65, 0], [0.08, 0.3, 0.08], "#ff9226", [0, 0, -PI / 2]),
      C([0, 0.97, 0], [0.35, 0.3, 0.35], BLACK),
      C([0, 0.84, 0], [0.52, 0.04, 0.52], BLACK),
      S([0.34, 0.2, 0], 0.07, BLACK),
      S([0.35, 0.05, 0], 0.07, BLACK),
    ],
  },
];

/** How tall each dollhouse floor is, in model units. */
export const FLOOR_H = 0.8;

/** Half as wide as a dollhouse with this many floors (bigger houses are wider too). */
export const dollhouseHalfWidth = (floors: number): number => 1 + (floors - 2) * 0.15;

/**
 * A dollhouse whose front (with the door) faces -z, `floors` floors tall.
 * With `open` it has no front wall, so you can see the rooms inside.
 * Downstairs is the living room, then a bedroom, kitchen, bathroom,
 * playroom and music room as it gets bigger.
 */
export function dollhouseParts(m: string, open: boolean, floors = 2): Part[] {
  const wall = "#f6e3c4";
  const wood = "#c9965f";
  const papers = ["#ffd6e8", "#d9ecff", "#fff3c4", "#d8f5e0", "#ead9ff", "#ffe2cc"];
  const hw = dollhouseHalfWidth(floors);
  const top = floors * FLOOR_H;
  const parts: Part[] = [
    B([0, -0.03, 0], [hw * 2 + 0.1, 0.06, 1.25], wood),
    B([-hw + 0.02, top / 2, 0], [0.04, top, 1.2], wall),
    B([hw - 0.02, top / 2, 0], [0.04, top, 1.2], wall),
    B([0, top, 0], [hw * 2, 0.05, 1.2], wood),
    R([0, top + 0.35, 0], [hw * 2 + 0.3, 0.7, 1.35], m),
    B([hw * 0.6, top + 0.45, 0.2], [0.18, 0.45, 0.18], "#a0522d"),
  ];
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR_H;
    parts.push(B([0, y + FLOOR_H / 2, 0.58], [hw * 2 - 0.04, FLOOR_H, 0.04], papers[f % papers.length]!));
    if (f > 0) parts.push(B([0, y, 0], [hw * 2 - 0.04, 0.05, 1.2], wood));
    parts.push(...roomParts(f, y + (f > 0 ? 0.025 : 0), hw));
  }
  if (!open) {
    parts.push(B([0, top / 2, -0.6], [hw * 2, top, 0.04], wall));
    parts.push(B([0, 0.3, -0.625], [0.35, 0.6, 0.02], "#8b5a2b"), S([0.11, 0.3, -0.64], 0.05, "#f2c230"));
    for (let f = 0; f < floors; f++) {
      const xs = f === 0 ? [-hw * 0.55, hw * 0.55] : [-hw * 0.55, 0, hw * 0.55];
      for (const x of xs) parts.push(B([x, f * FLOOR_H + 0.4, -0.625], [0.32, 0.3, 0.02], "#9fd8ff"));
    }
  }
  return parts;
}

/** The furniture for one floor of the dollhouse, standing on height `y`. */
function roomParts(floor: number, y: number, hw: number): Part[] {
  const L = -hw * 0.55;
  const Rt = hw * 0.5;
  switch (floor) {
    case 0: // Living room: a sofa, a table and a rug.
      return [
        C([0.05, y + 0.01, 0.05], [0.7, 0.01, 0.45], "#ff8fc7", undefined, 18),
        B([L, y + 0.12, 0.35], [0.6, 0.18, 0.3], "#7fc8ff"),
        B([L, y + 0.27, 0.48], [0.6, 0.3, 0.08], "#7fc8ff"),
        C([Rt, y + 0.3, 0.25], [0.45, 0.04, 0.45], "#a8774a"),
        C([Rt, y + 0.15, 0.25], [0.06, 0.3, 0.06], "#a8774a"),
      ];
    case 1: // Bedroom: a bed and a lamp.
      return [
        B([L, y + 0.1, 0.3], [0.7, 0.16, 0.45], WHITE),
        B([L + 0.05, y + 0.18, 0.3], [0.55, 0.03, 0.46], "#a35cff"),
        B([L - 0.28, y + 0.2, 0.3], [0.12, 0.08, 0.35], WHITE),
        C([Rt + 0.1, y + 0.2, 0.4], [0.04, 0.4, 0.04], "#666666"),
        K([Rt + 0.1, y + 0.45, 0.4], [0.25, 0.18, 0.25], "#ffd23f"),
      ];
    case 2: // Kitchen: a fridge, a stove and a counter.
      return [
        B([L - 0.1, y + 0.32, 0.4], [0.3, 0.64, 0.3], WHITE),
        B([L + 0.22, y + 0.18, 0.4], [0.32, 0.36, 0.3], "#a9adb5"),
        C([L + 0.15, y + 0.37, 0.35], [0.1, 0.02, 0.1], BLACK),
        C([L + 0.29, y + 0.37, 0.45], [0.1, 0.02, 0.1], BLACK),
        B([Rt, y + 0.17, 0.42], [0.6, 0.34, 0.26], "#ffb39a"),
        S([Rt, y + 0.4, 0.42], 0.12, "#e8383d"),
      ];
    case 3: // Bathroom: a bathtub full of water and a sink.
      return [
        B([L, y + 0.13, 0.35], [0.7, 0.26, 0.38], WHITE),
        B([L, y + 0.25, 0.35], [0.6, 0.03, 0.3], "#7fc8ff"),
        S([L - 0.15, y + 0.3, 0.3], 0.1, WHITE),
        S([L + 0.1, y + 0.29, 0.38], 0.08, WHITE),
        C([Rt, y + 0.15, 0.45], [0.08, 0.3, 0.08], WHITE),
        C([Rt, y + 0.32, 0.45], [0.32, 0.06, 0.24], WHITE),
      ];
    case 4: // Playroom: toy blocks, a ball and a TV.
      return [
        B([L - 0.1, y + 0.08, 0.35], [0.16, 0.16, 0.16], "#e8383d"),
        B([L + 0.08, y + 0.08, 0.38], [0.16, 0.16, 0.16], "#4a9bff"),
        B([L, y + 0.24, 0.36], [0.16, 0.16, 0.16], "#ffd23f"),
        S([0.05, y + 0.1, 0.25], 0.2, "#ff6fb5"),
        B([Rt + 0.05, y + 0.35, 0.52], [0.5, 0.32, 0.05], BLACK),
        B([Rt + 0.05, y + 0.35, 0.49], [0.44, 0.26, 0.01], "#7fc8ff"),
      ];
    default: // Music room: a piano and a guitar.
      return [
        B([L, y + 0.2, 0.4], [0.6, 0.4, 0.28], BLACK),
        B([L, y + 0.41, 0.3], [0.56, 0.02, 0.1], WHITE),
        S([Rt, y + 0.15, 0.45], [0.25, 0.25, 0.08], "#ff9226"),
        B([Rt, y + 0.4, 0.45], [0.05, 0.35, 0.04], "#6b3a1f"),
      ];
  }
}

function horseParts(m: string, unicorn: boolean): Part[] {
  const mane = unicorn ? "#ff8fc7" : "#4a2a17";
  return [
    S([0, 0, 0], [1.5, 0.75, 0.7], m),
    C([0.6, 0.45, 0], [0.35, 0.75, 0.35], m, [0, 0, -0.5]),
    S([0.92, 0.8, 0], [0.62, 0.36, 0.36], m, [0, 0, -0.3]),
    ...eyes(1.0, 0.92, 0.15, 0.07),
    K([0.72, 1.02, 0.1], [0.12, 0.2, 0.1], m),
    K([0.72, 1.02, -0.1], [0.12, 0.2, 0.1], m),
    S([0.5, 0.7, 0], [0.25, 0.55, 0.38], mane, [0, 0, -0.5]),
    S([-0.85, 0.05, 0], [0.3, 0.65, 0.25], unicorn ? "#a35cff" : mane, [0, 0, 0.4]),
    ...legs(0.48, 0.2, -0.55, [0.18, 0.75, 0.18], m),
    ...(unicorn ? [K([0.95, 1.18, 0], [0.12, 0.48, 0.12], "#f2c230", [0, 0, -0.3])] : []),
  ];
}

function dinoParts(m: string, dragon: boolean): Part[] {
  return [
    S([0, 0, 0], [1.3, 0.8, 0.7], m),
    C([0.55, 0.45, 0], [0.3, 0.65, 0.3], m, [0, 0, -0.6]),
    S([0.88, 0.72, 0], [0.58, 0.36, 0.36], m),
    ...eyes(1.02, 0.82, 0.13, 0.07),
    K([-0.9, 0, 0], [0.4, 0.9, 0.4], m, [0, 0, PI / 2]),
    ...legs(0.32, 0.22, -0.45, [0.25, 0.45, 0.25], m),
    ...[-0.35, -0.05, 0.25].map((x) => K([x, 0.42, 0], [0.15, 0.28, 0.12], dragon ? "#ffd23f" : "#ff9226")),
    ...(dragon
      ? [
          B([-0.05, 0.5, 0.5], [0.7, 0.04, 0.7], "#ff9226", [0.6, 0, 0]),
          B([-0.05, 0.5, -0.5], [0.7, 0.04, 0.7], "#ff9226", [-0.6, 0, 0]),
          K([0.85, 0.98, 0.1], [0.08, 0.22, 0.08], "#ffd23f"),
          K([0.85, 0.98, -0.1], [0.08, 0.22, 0.08], "#ffd23f"),
        ]
      : []),
  ];
}

function giftParts(m: string): Part[] {
  return [
    B([0, 0, 0], [1, 0.9, 1], m),
    B([0, 0, 0], [0.2, 0.92, 1.02], WHITE),
    B([0, 0, 0], [1.02, 0.92, 0.2], WHITE),
    S([0.15, 0.55, 0], [0.3, 0.22, 0.18], WHITE, [0, 0, -0.4]),
    S([-0.15, 0.55, 0], [0.3, 0.22, 0.18], WHITE, [0, 0, 0.4]),
  ];
}

export interface MadeModel {
  name: string;
  known: boolean;
  act?: Act;
  parts: Part[];
}

function seedOf(text: string): number {
  let n = 0;
  for (const ch of text) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n;
}

const findDef = (word: string): ModelDef | undefined =>
  MODELS.find((m) => m.keys.includes(word) || m.keys.includes(word.replace(/s$/, "")));

function paint(def: ModelDef | undefined, color: string | undefined, seed: number): MadeModel {
  const rainbow = color === "rainbow";
  const main = color && !rainbow ? COLOR_WORDS[color]! : def?.main ?? RAINBOW[seed % 6]!;
  const parts = def ? def.parts(main, seed) : giftParts(main);
  if (rainbow && def) {
    let i = 0;
    for (const part of parts) if (part.c === def.main) part.c = RAINBOW[i++ % 6]!;
  }
  const name = def?.name ?? "mystery present";
  return { name, known: !!def, act: ACTS[name], parts };
}

/** Things from the Upside-Down Dimension go the other way: they fall instead of flying up. */
function upsideDown(model: MadeModel): MadeModel {
  if (model.act?.move !== "zoom") return model;
  return { ...model, act: { ...model.act, move: "fall", say: `${model.act.say} (Down!)` } };
}

/**
 * The models you get when you put `text` in a box: one for every thing it
 * names, so "a cat and a dog" gives a cat and a dog. A colour word paints the
 * thing right after it ("pink cat and blue dog").
 */
export function makeModels(text: string): MadeModel[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    // Two-word names that are one thing.
    .replace(/\brobot dog/g, "robotdog")
    .replace(/\bgo kart/g, "go-kart")
    .replace(/\bbubble machine/g, "bubblemachine")
    .replace(/\bsky key/g, "skykey")
    .replace(/\bmagnifying glass/g, "magnifyingglass")
    .replace(/\bgold bars?/g, "gold goldbars")
    .split(/\s+/)
    .filter(Boolean);
  const seed = seedOf(text);
  if (words.some((w) => w.startsWith("upside"))) {
    return makeModels(words.filter((w) => !w.startsWith("upside")).join(" ")).map(upsideDown);
  }
  const models: MadeModel[] = [];
  let color: string | undefined;
  let lastDef: ModelDef | undefined;
  let lastAt = -2;
  words.forEach((word, i) => {
    const def = findDef(word);
    // "rainbow" right before a thing paints it; otherwise it's a rainbow.
    const paintsNext = word in COLOR_WORDS || (word === "rainbow" && !!words[i + 1] && !!findDef(words[i + 1]!));
    if (paintsNext) {
      color = word;
    } else if (def && !(def === lastDef && i === lastAt + 1)) {
      models.push(paint(def, color, seed + models.length));
      color = undefined;
    }
    // Two words in a row naming the same thing ("teddy bear", "game
    // controller") are one thing, not two.
    if (def) {
      lastDef = def;
      lastAt = i;
    }
  });
  // Blood doesn't get a model: that box is just staticky inside. See main.ts.
  if (words.some((w) => w.startsWith("blood"))) return [];
  if (models.length === 0 && words.includes("everything")) {
    // Everything! A big pile of eight different things, picked by the word.
    const pile = [...MODELS];
    let n = seed || 1;
    for (let i = pile.length - 1; i > 0; i--) {
      n = (n * 1103515245 + 12345) >>> 0;
      const j = n % (i + 1);
      [pile[i], pile[j]] = [pile[j]!, pile[i]!];
    }
    return pile.slice(0, 8).map((def, i) => paint(def, undefined, seed + i));
  }
  if (models.length === 0 && words.some((w) => w === "nothing" || w === "air")) {
    // Putting in nothing gets you... nothing. Just air.
    return [];
  }
  if (models.length === 0) {
    const joined = words.join("");
    const def = MODELS.find((m) => m.keys.some((k) => k.length > 3 && joined.includes(k)));
    models.push(paint(def, color ?? words.find((w) => w in COLOR_WORDS), seed));
  } else if (color && models.length === 1) {
    // "a cat that is pink": a colour after the thing still counts.
    const def = findDef(words.find((w) => findDef(w))!)!;
    models[0] = paint(def, color, seed);
  }
  return models;
}
