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

export type Body = {
  id: string;
  name: string;
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
};

export const FRONT_YARD: Body = {
  id: "yard",
  name: "The Front Yard",
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

export const PLANETS: Body[] = [
  {
    id: "sun",
    name: "The Sun",
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
];

export function planetById(id: string): Body | undefined {
  return PLANETS.find((planet) => planet.id === id);
}

/** How a body's pull compares to home, for the star map. */
export function gravityLabel(body: Body): string {
  return `${(body.gravity / FRONT_YARD.gravity).toFixed(2)}g`;
}
