/**
 * Everywhere you can fart around in. The front yard is one of these too — it's
 * just the one with Earth's gravity and Earth's thick air.
 *
 * `gravity` is in the same units the yard has always used, where 300 is Earth.
 * The others are scaled off real surface gravity, so the Moon really is about a
 * sixth of home and Jupiter really does pin you to the floor. `air` is the
 * fraction of your speed kept each second: thick soup low, near-vacuum high,
 * which is why an airless world lets you coast forever off one good squeeze.
 */

/** What the thing actually is. Only one of them is a star. */
export type BodyKind = "star" | "planet" | "moon" | "dwarf planet" | "home" | "empty space" | "???";

export type Body = {
  id: string;
  name: string;
  kind: BodyKind;
  /** Emoji shown on the star map. */
  glyph: string;
  gravity: number;
  air: number;
  skyTop: string;
  skyBottom: string;
  /** "r, g, b" for the drifting haze. */
  haze: string;
  hazeAlpha: number;
  hazeCount: number;
  /** One true thing, for the line under the title. */
  fact: string;
  /** Draws falling code behind everything. Only one place has it. */
  rain?: boolean;
  /** Draws a starfield instead of haze. Only out in the open.  */
  stars?: boolean;
};

export const FRONT_YARD: Body = {
  id: "yard",
  name: "The Front Yard",
  kind: "home",
  glyph: "🏡",
  gravity: 300,
  air: 0.42,
  skyTop: "#2e5f8a",
  skyBottom: "#7fb3a8",
  haze: "255, 255, 255",
  hazeAlpha: 0.2,
  hazeCount: 9,
  fact: "Nothing happens here. There is a teleporter.",
};

export const BODIES: Body[] = [
  {
    id: "sun",
    name: "The Sun",
    kind: "star",
    glyph: "☀️",
    // Really is 28 times Earth's pull. The air is cartoon-thick on purpose:
    // without it you'd fall so fast you'd be an unreadable streak, and the
    // joke here is that you are pinned, not that you are fast.
    gravity: 8370,
    air: 1e-24,
    skyTop: "#fff3b0",
    skyBottom: "#ff4d16",
    haze: "255, 245, 200",
    hazeAlpha: 0.3,
    hazeCount: 20,
    fact: "Twenty-eight times Earth's gravity, and the plasma is thicker than treacle. You can barely twitch. Nobody said you could land here — only that you could go.",
  },
  {
    id: "mercury",
    name: "Mercury",
    kind: "planet",
    glyph: "🌑",
    gravity: 114,
    air: 0.97,
    skyTop: "#2a2320",
    skyBottom: "#6b5a48",
    haze: "200, 180, 150",
    hazeAlpha: 0.1,
    hazeCount: 6,
    fact: "Barely any gravity and no air at all. One fart and you're gone for ages.",
  },
  {
    id: "venus",
    name: "Venus",
    kind: "planet",
    glyph: "🌕",
    gravity: 270,
    air: 0.28,
    skyTop: "#7a4a1e",
    skyBottom: "#d9a05a",
    haze: "255, 214, 140",
    hazeAlpha: 0.26,
    hazeCount: 16,
    fact: "Almost Earth gravity, but the air is like syrup. You stop the moment you start.",
  },
  {
    id: "earth",
    name: "Earth",
    kind: "planet",
    glyph: "🌍",
    gravity: 300,
    air: 0.42,
    skyTop: "#1d3f6b",
    skyBottom: "#4f8fb0",
    haze: "255, 255, 255",
    hazeAlpha: 0.22,
    hazeCount: 10,
    fact: "Home. The gravity you grew up farting in.",
  },
  {
    id: "moon",
    name: "The Moon",
    kind: "moon",
    glyph: "🌙",
    gravity: 50,
    air: 0.97,
    skyTop: "#0b0b14",
    skyBottom: "#3a3a48",
    haze: "190, 190, 205",
    hazeAlpha: 0.09,
    hazeCount: 5,
    fact: "A sixth of Earth's gravity and no air. The floatiest place on the map.",
  },
  {
    id: "mars",
    name: "Mars",
    kind: "planet",
    glyph: "🔴",
    gravity: 114,
    air: 0.9,
    skyTop: "#6b3520",
    skyBottom: "#c9754a",
    haze: "230, 150, 100",
    hazeAlpha: 0.14,
    hazeCount: 9,
    fact: "Same gravity as Mercury, but a whisper of air. Dust everywhere.",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    kind: "planet",
    glyph: "🟠",
    gravity: 758,
    air: 0.35,
    skyTop: "#7d4a2a",
    skyBottom: "#c8a06a",
    haze: "240, 200, 150",
    hazeAlpha: 0.24,
    hazeCount: 18,
    fact: "Two and a half times Earth's pull. Even a full squeeze barely lifts you.",
  },
  {
    id: "saturn",
    name: "Saturn",
    kind: "planet",
    glyph: "🪐",
    gravity: 320,
    air: 0.4,
    skyTop: "#6b5a2a",
    skyBottom: "#dcc98a",
    haze: "250, 235, 180",
    hazeAlpha: 0.2,
    hazeCount: 14,
    fact: "Almost exactly Earth gravity, which nobody expects from the big one with rings.",
  },
  {
    id: "uranus",
    name: "Uranus",
    kind: "planet",
    glyph: "🔵",
    gravity: 265,
    air: 0.45,
    skyTop: "#1b4f5c",
    skyBottom: "#7fd4dc",
    haze: "180, 240, 245",
    hazeAlpha: 0.18,
    hazeCount: 12,
    fact: "Yes. Everyone has already made the joke. It has slightly less gravity than Earth.",
  },
  {
    id: "neptune",
    name: "Neptune",
    kind: "planet",
    glyph: "🔷",
    gravity: 342,
    air: 0.42,
    skyTop: "#141f5c",
    skyBottom: "#3f5fc4",
    haze: "150, 180, 255",
    hazeAlpha: 0.18,
    hazeCount: 12,
    fact: "A bit heavier than home, and the windiest place there is.",
  },
  {
    id: "pluto",
    name: "Pluto",
    kind: "dwarf planet",
    glyph: "⚪",
    gravity: 18,
    air: 0.97,
    skyTop: "#0a0a12",
    skyBottom: "#2b2b3c",
    haze: "210, 205, 225",
    hazeAlpha: 0.08,
    hazeCount: 4,
    fact: "Six percent of Earth's gravity. Tap the space bar and you'll drift off the screen.",
  },
  {
    id: "space",
    name: "Space",
    kind: "empty space",
    glyph: "🌌",
    // Nothing to fall towards, and near enough nothing to slow you down.
    gravity: 0,
    air: 0.99,
    skyTop: "#05040f",
    skyBottom: "#0b0718",
    haze: "150, 160, 220",
    hazeAlpha: 0.05,
    hazeCount: 4,
    stars: true,
    fact: "No gravity and no air. You hang there until you fart, and then you go, and you keep going.",
  },
];

/**
 * Not on the star map, and not reachable by teleporter. The only way here is
 * to break 100 velocity and let the whole thing fall over.
 */
export const MATRIX: Body = {
  id: "matrix",
  name: "The Matrix",
  kind: "???",
  glyph: "🟩",
  gravity: 96,
  air: 0.86,
  skyTop: "#01120a",
  skyBottom: "#000000",
  haze: "70, 255, 130",
  hazeAlpha: 0.07,
  hazeCount: 6,
  fact: "There is no gravity. Well — there is a bit. Someone had to type it in.",
  rain: true,
};

export function bodyById(id: string): Body | undefined {
  if (id === MATRIX.id) return MATRIX;
  return BODIES.find((body) => body.id === id);
}

/** How a body's pull compares to home, for the sky map. */
export function gravityLabel(body: Body): string {
  return `${(body.gravity / FRONT_YARD.gravity).toFixed(2)}g`;
}
