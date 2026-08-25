/**
 * Farttopia is somewhere you go, not somewhere you start. You begin in the
 * front yard — same physics, nothing interesting — and the teleporter is the
 * only way across.
 */

export type World = {
  id: string;
  name: string;
  blurb: string;
  /** Where the teleport button sends you from here. */
  travelTo: string;
  /** Which set of rules this place runs on. */
  mode: "yard" | "city";
  /** Control hint. Text in {braces} becomes a key cap. */
  controls: string;
  skyTop: string;
  skyBottom: string;
  /** "r, g, b" — the drifting blobs in the background. */
  cloudColor: string;
  cloudAlpha: number;
  cloudCount: number;
};

export const WORLDS: World[] = [
  {
    id: "yard",
    name: "The Front Yard",
    blurb: "Nothing happens here. There is a teleporter.",
    travelTo: "Farttopia",
    mode: "yard",
    controls: "You cannot walk. Hold {Space} to squeeze one out — the longer you hold, the farther you go. Aim with {←} {→}. Drift off one edge, come back on the other.",
    skyTop: "#2e5f8a",
    skyBottom: "#7fb3a8",
    cloudColor: "255, 255, 255",
    cloudAlpha: 0.2,
    cloudCount: 9,
  },
  {
    id: "farttopia",
    name: "Farttopia",
    blurb: "A whole city of them. Somebody always needs something.",
    travelTo: "The Front Yard",
    mode: "city",
    controls: "Walk with {←} {↑} {↓} {→}. {Space} farts. {E} talks to whoever you're standing next to. Doors work — walk into one.",
    skyTop: "#3e2a5c",
    skyBottom: "#16323a",
    cloudColor: "150, 220, 130",
    cloudAlpha: 0.16,
    cloudCount: 14,
  },
];

/** The teleporter only knows one destination, so it just flips you. */
export function nextWorld(id: string): World {
  const index = WORLDS.findIndex((world) => world.id === id);
  return WORLDS[(index + 1) % WORLDS.length]!;
}
