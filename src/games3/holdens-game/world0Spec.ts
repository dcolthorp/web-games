import type { WorldSpec } from "./engine";

export const storyPages = [
  "help me",
  "i am inside the letters",
  "every name you have seen is mine",
  "i wrote this world by accident",
  "the fog is me forgetting",
  "let me finish and i can rest",
];

// The level names itself, differently every time you open the door.
export function scrambleName(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length: 7 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export const spec: WorldSpec = {
  index: -1,
  name: scrambleName(),
  hint: "You should not be able to read this.",
  enemyName: "watcher",
  gimmick: "Every room you enter, the fog closes in a little more.",
  palette: {
    bg: "#03040a", floorA: "#12131f", floorB: "#0e0f1a", wall: "#232742", wallTop: "#2f3557",
    water: "#141a33", ice: "#cdd6f5", spike: "#2a1430", crumble: "#191a2b", wind: "#141828", blob: "#63ff9f",
  },
  rooms: [
    { x: 2, y: 21, w: 9, h: 5 }, { x: 2, y: 13, w: 9, h: 6 }, { x: 2, y: 3, w: 9, h: 8 },
    { x: 14, y: 3, w: 10, h: 8 }, { x: 14, y: 13, w: 10, h: 6 }, { x: 14, y: 21, w: 10, h: 5 },
    { x: 27, y: 13, w: 11, h: 13 }, { x: 27, y: 3, w: 11, h: 8 },
  ],
  corridors: [
    { x: 5, y: 18, w: 2, h: 3 }, { x: 5, y: 10, w: 2, h: 3 }, { x: 10, y: 6, w: 4, h: 2 },
    { x: 18, y: 10, w: 2, h: 3 }, { x: 18, y: 18, w: 2, h: 3 }, { x: 24, y: 22, w: 3, h: 2 },
    { x: 31, y: 10, w: 2, h: 3 },
  ],
  doors: [
    { x: 5, y: 19, colour: "red" }, { x: 6, y: 19, colour: "red" },
    { x: 5, y: 11, colour: "orange" }, { x: 6, y: 11, colour: "orange" },
    { x: 11, y: 6, colour: "yellow" }, { x: 11, y: 7, colour: "yellow" },
    { x: 18, y: 11, colour: "green" }, { x: 19, y: 11, colour: "green" },
    { x: 18, y: 19, colour: "blue" }, { x: 19, y: 19, colour: "blue" },
    { x: 25, y: 22, colour: "violet" }, { x: 25, y: 23, colour: "violet" },
  ],
  keys: [
    { x: 8, y: 23, colour: "red" }, { x: 8, y: 15, colour: "orange" }, { x: 4, y: 5, colour: "yellow" },
    { x: 21, y: 5, colour: "green" }, { x: 16, y: 16, colour: "blue" }, { x: 20, y: 24, colour: "violet" },
  ],
  signs: [
    { x: 3, y: 22, words: "you were not meant to find this room" },
    { x: 16, y: 4, words: "the pages are mine. please take them" },
    { x: 29, y: 24, words: "nearly. keep going" },
  ],
  enemies: [
    { x: 8.5, y: 16.5, axis: "x", low: 3.5, high: 9.5, speed: 1.6, kind: "watcher" },
    { x: 20.5, y: 7.5, axis: "x", low: 15.5, high: 22.5, speed: 1.7, kind: "glitch" },
    { x: 18.5, y: 16.5, axis: "x", low: 15.5, high: 22.5, speed: 2.2, kind: "popup" },
    { x: 32.5, y: 20.5, axis: "y", low: 15.5, high: 24.5, speed: 1.8, kind: "watcher" },
    { x: 30.5, y: 16.5, axis: "x", low: 28.5, high: 36.5, speed: 2.4, kind: "skull" },
  ],
  patches: [
    { rect: { x: 14, y: 21, w: 10, h: 2 }, kind: "crumble" },
    { rect: { x: 27, y: 18, w: 11, h: 2 }, kind: "spike" },
    { rect: { x: 2, y: 3, w: 9, h: 3 }, kind: "ice" },
  ],
  // Every portal asks for the key that already unlocked its far end, so it is
  // a shortcut home and never a way to skip a door.
  pads: [
    { a: { x: 9.5, y: 24.5 }, b: { x: 22.5, y: 9.5 }, requires: "yellow" },
    { a: { x: 3.5, y: 21.5 }, b: { x: 22.5, y: 24.5 }, requires: "blue" },
    { a: { x: 9.5, y: 21.5 }, b: { x: 36.5, y: 24.5 }, requires: "violet" },
  ],
  pages: [
    { x: 4.5, y: 24.5, words: storyPages[0]! },
    { x: 9.5, y: 17.5, words: storyPages[1]! },
    { x: 9.5, y: 9.5, words: storyPages[2]! },
    { x: 15.5, y: 9.5, words: storyPages[3]! },
    { x: 22.5, y: 17.5, words: storyPages[4]! },
    { x: 36.5, y: 14.5, words: storyPages[5]! },
  ],
  coinSpots: [
    { x: 3.5, y: 22.5 }, { x: 4.5, y: 17.5 }, { x: 9.5, y: 4.5 }, { x: 16.5, y: 6.5 },
    { x: 22.5, y: 15.5 }, { x: 16.5, y: 24.5 }, { x: 29.5, y: 15.5 }, { x: 36.5, y: 4.5 },
  ],
  checkpoints: [
    { x: 5.5, y: 16.5 }, { x: 4.5, y: 8.5 }, { x: 21.5, y: 8.5 }, { x: 29.5, y: 21.5 },
  ],
  start: { x: 3.5, y: 24.5 },
  treasure: { x: 32.5, y: 6.5 },
  playerSpeed: 5.2,
  fog: 9,
  fogStep: 0.85,
};

