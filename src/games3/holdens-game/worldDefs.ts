import type { Palette, Terrain, WorldSpec } from "./engine";
import { mirror, ring, sprawl, tower, type Layout } from "./layouts";

interface WorldOptions {
  layout: Layout;
  palette: Palette;
  signs: string[];
  hint: string;
  blobCount: number;
  blobSpeed: number;
  playerSpeed?: number;
  fog?: number;
  patches?: { rect: { x: number; y: number; w: number; h: number }; kind: Terrain }[];
}

function makeWorld(index: number, name: string, options: WorldOptions): WorldSpec {
  const { layout } = options;
  return {
    index,
    name,
    hint: options.hint,
    palette: options.palette,
    rooms: layout.rooms,
    corridors: layout.corridors,
    doors: layout.doors,
    keys: layout.keys,
    signs: layout.signSpots.map((spot, i) => ({ ...spot, words: options.signs[i] ?? "" })),
    blobs: layout.blobSlots.slice(0, options.blobCount).map((slot) => ({ ...slot, speed: options.blobSpeed })),
    patches: options.patches ?? [],
    start: layout.start,
    treasure: layout.treasure,
    playerSpeed: options.playerSpeed ?? 5.2,
    fog: options.fog ?? 0,
  };
}

const farm: Palette = { bg: "#0b0f12", floorA: "#1b2630", floorB: "#18222b", wall: "#2c3b47", wallTop: "#374a58", water: "#1d3a4a", ice: "#cfe6ef", spike: "#3a2430", blob: "#7be08a" };
const lab: Palette = { bg: "#0d0910", floorA: "#241a2c", floorB: "#201727", wall: "#3d2a49", wallTop: "#523762", water: "#2a1d40", ice: "#d9cfe8", spike: "#4a1f2c", blob: "#ff7bd5" };
const sunken: Palette = { bg: "#06121a", floorA: "#123243", floorB: "#0f2b3a", wall: "#1c4a5e", wallTop: "#276379", water: "#16506b", ice: "#cfeaf2", spike: "#26313f", blob: "#5ce0d6" };
const matrix: Palette = { bg: "#020a04", floorA: "#0a2013", floorB: "#08190f", wall: "#10381f", wallTop: "#17512c", water: "#0c2a1a", ice: "#c9f2d8", spike: "#1e3a24", blob: "#63ff9f" };
const snow: Palette = { bg: "#0c1219", floorA: "#223243", floorB: "#1d2c3b", wall: "#3a4d61", wallTop: "#4e6479", water: "#2b4a63", ice: "#d7e9f5", spike: "#33404f", blob: "#9fd8ff" };
const temple: Palette = { bg: "#120508", floorA: "#2e1218", floorB: "#280f15", wall: "#4d1d26", wallTop: "#682833", water: "#3d1119", ice: "#efd2d7", spike: "#5c1420", blob: "#ff6b6b" };
const arcade: Palette = { bg: "#05030f", floorA: "#1a1140", floorB: "#150d36", wall: "#2f1f6b", wallTop: "#432c94", water: "#1e1a55", ice: "#d5d0ff", spike: "#3c1250", blob: "#ffe14d" };
const web: Palette = { bg: "#07101a", floorA: "#132a3f", floorB: "#102436", wall: "#1d4260", wallTop: "#28587e", water: "#14405e", ice: "#d2e8f7", spike: "#2a2140", blob: "#ff9de2" };
const forbidden: Palette = { bg: "#080607", floorA: "#1a1518", floorB: "#161215", wall: "#2b2226", wallTop: "#3a2e33", water: "#1d1a24", ice: "#ded7db", spike: "#4a1616", blob: "#ff4a4a" };
const ending: Palette = { bg: "#f4f1ea", floorA: "#dcd6cb", floorB: "#d4cdc1", wall: "#a89f92", wallTop: "#bcb2a3", water: "#c3cfd6", ice: "#eef4f8", spike: "#b58f8f", blob: "#7a7168" };

export const worldSpecs: WorldSpec[] = [
  makeWorld(0, "Death Farms", {
    layout: sprawl, palette: farm, blobCount: 3, blobSpeed: 2.1,
    signs: ["A red door bars the way east. Try upstairs.", "The blue key is kept in the room to the north.", "Gold opens the last door. Mind the blobs."],
    hint: "Devil Labs is open.",
  }),
  makeWorld(1, "Devil Labs", {
    layout: mirror(sprawl), palette: lab, blobCount: 4, blobSpeed: 2.8,
    signs: ["Everything here runs backwards.", "The specimens are loose. Do not touch them.", "One more door. Then the water."],
    hint: "Sunken Castle is open.",
  }),
  makeWorld(2, "Sunken Castle", {
    layout: tower, palette: sunken, blobCount: 3, blobSpeed: 2.3,
    signs: ["The lower halls are flooded. Wading is slow.", "Climb. The castle goes up, not across.", "Almost dry up here."],
    hint: "M@tr1x 45 is open.",
    patches: [
      { rect: { x: 2, y: 22, w: 14, h: 4 }, kind: "water" },
      { rect: { x: 20, y: 22, w: 17, h: 4 }, kind: "water" },
      { rect: { x: 16, y: 21, w: 4, h: 2 }, kind: "water" },
    ],
  }),
  makeWorld(3, "M@tr1x 45", {
    layout: ring, palette: matrix, blobCount: 4, blobSpeed: 3.1, fog: 5,
    signs: ["V1S1B1L1TY C0RRUPT3D", "TH3 PR1Z3 1S 1N TH3 M1DDL3", "F0LL0W TH3 R1NG"],
    hint: "Whiteout is open.",
  }),
  makeWorld(4, "Whiteout", {
    layout: sprawl, palette: snow, blobCount: 3, blobSpeed: 2.4, fog: 7,
    signs: ["The floor is ice. You will not stop where you mean to.", "Take the corners wide.", "Nearly through the storm."],
    hint: "Blood Temple is open.",
    patches: [
      { rect: { x: 16, y: 18, w: 11, h: 8 }, kind: "ice" },
      { rect: { x: 16, y: 3, w: 11, h: 10 }, kind: "ice" },
      { rect: { x: 30, y: 18, w: 8, h: 8 }, kind: "ice" },
    ],
  }),
  makeWorld(5, "Blood Temple", {
    layout: mirror(sprawl), palette: temple, blobCount: 4, blobSpeed: 2.9,
    signs: ["Step where the floor is whole.", "The spikes do not forgive.", "The last door is close."],
    hint: "V1D30 game is open.",
    patches: [
      { rect: { x: 15, y: 8, w: 3, h: 3 }, kind: "spike" },
      { rect: { x: 22, y: 20, w: 3, h: 2 }, kind: "spike" },
      { rect: { x: 4, y: 9, w: 2, h: 3 }, kind: "spike" },
      { rect: { x: 26, y: 6, w: 2, h: 3 }, kind: "spike" },
    ],
  }),
  makeWorld(6, "V1D30 game", {
    layout: tower, palette: arcade, blobCount: 5, blobSpeed: 4.2, playerSpeed: 6.6,
    signs: ["SP33D 1NCR3AS3D", "3V3RYTH1NG M0V3S FAST3R N0W", "ALM0ST TH3R3"],
    hint: "Internet run Lol <3 is open.",
  }),
  makeWorld(7, "Internet run Lol <3", {
    layout: ring, palette: web, blobCount: 5, blobSpeed: 3.4, playerSpeed: 5.8,
    signs: ["lol good luck <3", "the pipes are flooded again", "one more :)"],
    hint: "do not enter is open.",
    patches: [
      { rect: { x: 12, y: 21, w: 16, h: 2 }, kind: "water" },
      { rect: { x: 16, y: 11, w: 9, h: 3 }, kind: "water" },
    ],
  }),
  makeWorld(8, "do not enter", {
    layout: mirror(tower), palette: forbidden, blobCount: 5, blobSpeed: 3.6, fog: 4,
    signs: ["turn back", "you were told", "keep going then"],
    hint: "The end...? is open.",
    patches: [
      { rect: { x: 20, y: 11, w: 4, h: 3 }, kind: "spike" },
      { rect: { x: 10, y: 21, w: 3, h: 2 }, kind: "spike" },
      { rect: { x: 27, y: 3, w: 3, h: 2 }, kind: "spike" },
    ],
  }),
  makeWorld(9, "The end...?", {
    layout: ring, palette: ending, blobCount: 1, blobSpeed: 1.6,
    signs: ["It is quiet here.", "Nothing is chasing you.", "Go and take it."],
    hint: "That is all ten. For now.",
  }),
];
