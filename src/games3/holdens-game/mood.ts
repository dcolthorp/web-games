import type { Palette, WorldSpec } from "./engine";

const BEATEN_KEY = "holdens-game-boss-beaten-v1";
const HAPPY_KEY = "holdens-game-happy-v1";

export function bossBeaten(): boolean {
  return localStorage.getItem(BEATEN_KEY) === "yes";
}

// Beating it does not just unlock the sunshine, it turns it on.
export function markBossBeaten(): void {
  localStorage.setItem(BEATEN_KEY, "yes");
  if (localStorage.getItem(HAPPY_KEY) === null) localStorage.setItem(HAPPY_KEY, "yes");
}

export function isHappy(): boolean {
  return bossBeaten() && localStorage.getItem(HAPPY_KEY) !== "no";
}

export function setHappy(on: boolean): void {
  localStorage.setItem(HAPPY_KEY, on ? "yes" : "no");
}

export const happyNames = [
  "Happy Farms",
  "Geometry Labs",
  "Awesome Castle",
  "Code Land",
  "Snow Place",
  "Awesome Ancient Temple",
  "I Love Video Games",
  "Lol Computer",
  "Please Enter",
  "The Beginning of a New Era",
];

export const happyZeroName = "The Nice Quiet Place";
export const happyMinusOneName = "The Friend Downstairs";

// Bright, soft, and warm. Nothing down here is trying to get you any more.
const happyPalettes: Palette[] = [
  { bg: "#eaf6ff", floorA: "#cdeccd", floorB: "#c2e7c2", wall: "#a9d3a2", wallTop: "#c2e6b8", water: "#a7d8ef", ice: "#e8f6ff", spike: "#dff0d0", crumble: "#e6dfc4", wind: "#dcefff", blob: "#ffd166" },
  { bg: "#f3eeff", floorA: "#ded2f5", floorB: "#d5c8f1", wall: "#b5a2e0", wallTop: "#cbbcf0", water: "#c3b6ee", ice: "#f2ecff", spike: "#e3d7f7", crumble: "#e6dcf5", wind: "#eae2ff", blob: "#ff9ad5" },
  { bg: "#e7f7fb", floorA: "#bfe6ef", floorB: "#b3e0ec", wall: "#8fcbdb", wallTop: "#a9dced", water: "#93d6ea", ice: "#eafaff", spike: "#cfeaf1", crumble: "#dcefF3", wind: "#ddf3fa", blob: "#5fd6c8" },
  { bg: "#eafbf0", floorA: "#c6ecd2", floorB: "#bbe7c8", wall: "#93cfa6", wallTop: "#aee0bd", water: "#a9e0c4", ice: "#ecfcf3", spike: "#d5f0dd", crumble: "#e0f2e6", wind: "#e3f8ec", blob: "#4fd58a" },
  { bg: "#eef6ff", floorA: "#dbe9f7", floorB: "#d2e3f4", wall: "#b2cbe4", wallTop: "#cadcf0", water: "#bcd9f0", ice: "#f4fbff", spike: "#dfeaf6", crumble: "#e6eef7", wind: "#e8f2ff", blob: "#8fc7ff" },
  { bg: "#fff1ec", floorA: "#fbd9cd", floorB: "#f8d0c2", wall: "#e8b09a", wallTop: "#f4c6b3", water: "#f3c3b3", ice: "#fff4ef", spike: "#fadfd4", crumble: "#f6e3d8", wind: "#fdece5", blob: "#ff9f7d" },
  { bg: "#f6efff", floorA: "#e4d6fb", floorB: "#dccbf8", wall: "#bfa6ec", wallTop: "#d3bef5", water: "#cbb9f2", ice: "#f7f1ff", spike: "#e8dcfb", crumble: "#ece2fc", wind: "#f1e8ff", blob: "#ffe14d" },
  { bg: "#eaf7ff", floorA: "#cbe8f8", floorB: "#c0e2f5", wall: "#96c9e6", wallTop: "#b0dbf1", water: "#a5d9f2", ice: "#eefaff", spike: "#d7eefa", crumble: "#e0f2fb", wind: "#e6f6ff", blob: "#ff9de2" },
  { bg: "#fdf6e9", floorA: "#f3e6c9", floorB: "#eee0be", wall: "#dcc79c", wallTop: "#ead9b6", water: "#dfd3ae", ice: "#fdf9f0", spike: "#f0e4cb", crumble: "#f2e8d2", wind: "#f8f0df", blob: "#ffc94d" },
  { bg: "#fffdf2", floorA: "#f7f2df", floorB: "#f2ecd6", wall: "#ded6bb", wallTop: "#ebe4cd", water: "#dfeee6", ice: "#fffefa", spike: "#f4efe0", crumble: "#f6f1e4", wind: "#fbf8ec", blob: "#ffd166" },
];

// Nothing hunts you, nothing bites, and the names stop being threats.
export function brighten(spec: WorldSpec, index: number): WorldSpec {
  if (!isHappy()) return spec;
  return {
    ...spec,
    name: happyNames[index] ?? spec.name,
    hint: "Nice, wasn't it.",
    gimmick: "Nothing here wants anything from you. Have a wander.",
    palette: happyPalettes[index] ?? spec.palette,
    enemies: [],
    patches: spec.patches.filter((p) => p.kind !== "spike" && p.kind !== "crumble"),
    signs: spec.signs.map((sign) => ({ ...sign, words: "" })),
    fog: 0,
    fogStep: 0,
  };
}

export function brightenOther(spec: WorldSpec, name: string, palette: Palette): WorldSpec {
  if (!isHappy()) return spec;
  return {
    ...spec,
    name,
    hint: "All done. Nothing left to be afraid of.",
    gimmick: "Nothing here wants anything from you.",
    palette,
    enemies: [],
    patches: spec.patches.filter((p) => p.kind !== "spike" && p.kind !== "crumble"),
    fog: 0,
    fogStep: 0,
  };
}

export const happyZeroPalette: Palette = happyPalettes[3]!;
export const happyMinusOnePalette: Palette = happyPalettes[9]!;
