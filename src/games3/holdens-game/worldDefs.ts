import type { EnemyKind, Palette, Terrain, Vec, WorldSpec } from "./engine";
import { mirror, ring, sprawl, tower, type Layout } from "./layouts";

interface WorldOptions {
  layout: Layout;
  palette: Palette;
  signs: string[];
  hint: string;
  enemyName: string;
  enemyKind: EnemyKind;
  gimmick: string;
  enemyCount: number;
  enemySpeed: number;
  playerSpeed?: number;
  fog?: number;
  patches?: { rect: { x: number; y: number; w: number; h: number }; kind: Terrain; dir?: Vec }[];
  pads?: { a: Vec; b: Vec }[];
}

function makeWorld(index: number, name: string, options: WorldOptions): WorldSpec {
  const { layout } = options;
  return {
    index,
    name,
    hint: options.hint,
    enemyName: options.enemyName,
    gimmick: options.gimmick,
    palette: options.palette,
    rooms: layout.rooms,
    corridors: layout.corridors,
    doors: layout.doors,
    keys: layout.keys,
    signs: layout.signSpots.map((spot, i) => ({ ...spot, words: options.signs[i] ?? "" })),
    enemies: layout.blobSlots.slice(0, options.enemyCount).map((slot) => ({
      ...slot, speed: options.enemySpeed, kind: options.enemyKind,
    })),
    patches: options.patches ?? [],
    pads: options.pads ?? [],
    checkpoints: layout.checkpoints,
    coinSpots: layout.coinSpots,
    start: layout.start,
    treasure: layout.treasure,
    playerSpeed: options.playerSpeed ?? 5.2,
    fog: options.fog ?? 0,
  };
}

const farm: Palette = { bg: "#0b0f12", floorA: "#1b2630", floorB: "#18222b", wall: "#2c3b47", wallTop: "#374a58", water: "#1d3a4a", ice: "#cfe6ef", spike: "#3a2430", crumble: "#3b3524", wind: "#1f2c37", blob: "#c8b26a" };
const lab: Palette = { bg: "#0d0910", floorA: "#241a2c", floorB: "#201727", wall: "#3d2a49", wallTop: "#523762", water: "#2a1d40", ice: "#d9cfe8", spike: "#4a1f2c", crumble: "#33253d", wind: "#281c33", blob: "#ff7bd5" };
const sunken: Palette = { bg: "#06121a", floorA: "#123243", floorB: "#0f2b3a", wall: "#1c4a5e", wallTop: "#276379", water: "#16506b", ice: "#cfeaf2", spike: "#26313f", crumble: "#1a3c4c", wind: "#134152", blob: "#5ce0d6" };
const matrix: Palette = { bg: "#020a04", floorA: "#0a2013", floorB: "#08190f", wall: "#10381f", wallTop: "#17512c", water: "#0c2a1a", ice: "#c9f2d8", spike: "#1e3a24", crumble: "#0d2b16", wind: "#0b2412", blob: "#63ff9f" };
const snow: Palette = { bg: "#0c1219", floorA: "#223243", floorB: "#1d2c3b", wall: "#3a4d61", wallTop: "#4e6479", water: "#2b4a63", ice: "#d7e9f5", spike: "#33404f", crumble: "#2b3b4c", wind: "#31465c", blob: "#dff1ff" };
const temple: Palette = { bg: "#120508", floorA: "#2e1218", floorB: "#280f15", wall: "#4d1d26", wallTop: "#682833", water: "#3d1119", ice: "#efd2d7", spike: "#5c1420", crumble: "#3a161d", wind: "#2c1015", blob: "#ff6b6b" };
const arcade: Palette = { bg: "#05030f", floorA: "#1a1140", floorB: "#150d36", wall: "#2f1f6b", wallTop: "#432c94", water: "#1e1a55", ice: "#d5d0ff", spike: "#3c1250", crumble: "#221757", wind: "#1c1348", blob: "#ffe14d" };
const web: Palette = { bg: "#07101a", floorA: "#132a3f", floorB: "#102436", wall: "#1d4260", wallTop: "#28587e", water: "#14405e", ice: "#d2e8f7", spike: "#2a2140", crumble: "#173650", wind: "#123449", blob: "#ff9de2" };
const forbidden: Palette = { bg: "#080607", floorA: "#1a1518", floorB: "#161215", wall: "#2b2226", wallTop: "#3a2e33", water: "#1d1a24", ice: "#ded7db", spike: "#4a1616", crumble: "#221c1f", wind: "#1c1719", blob: "#ff4a4a" };
const ending: Palette = { bg: "#f4f1ea", floorA: "#dcd6cb", floorB: "#d4cdc1", wall: "#a89f92", wallTop: "#bcb2a3", water: "#c3cfd6", ice: "#eef4f8", spike: "#b58f8f", crumble: "#cec6b9", wind: "#e2ddd3", blob: "#8d8478" };

export const worldSpecs: WorldSpec[] = [
  makeWorld(0, "Death Farms", {
    layout: sprawl, palette: farm, enemyCount: 3, enemySpeed: 2.1,
    enemyName: "scarecrow", enemyKind: "scarecrow",
    gimmick: "Rotten boards give way if you stand on them.",
    signs: ["A red door bars the way east. Try upstairs.", "Do not linger on the rotten boards.", "Gold opens the last door."],
    hint: "Devil Labs is open.",
    patches: [
      { rect: { x: 16, y: 20, w: 11, h: 3 }, kind: "crumble" },
      { rect: { x: 8, y: 9, w: 4, h: 3 }, kind: "crumble" },
    ],
  }),
  makeWorld(1, "Devil Labs", {
    layout: mirror(sprawl), palette: lab, enemyCount: 4, enemySpeed: 2.5,
    enemyName: "specimen", enemyKind: "specimen",
    gimmick: "The specimens amble until you come close.",
    signs: ["Everything here runs backwards.", "They notice you at six paces.", "One more door."],
    hint: "Sunken Castle is open.",
  }),
  makeWorld(2, "Sunken Castle", {
    layout: tower, palette: sunken, enemyCount: 3, enemySpeed: 2.3,
    enemyName: "eel", enemyKind: "eel",
    gimmick: "The flooded halls drag, and the current pushes north.",
    signs: ["The lower halls are flooded. Wading is slow.", "The current runs upward. Use it.", "Almost dry up here."],
    hint: "M@tr1x 45 is open.",
    patches: [
      { rect: { x: 2, y: 22, w: 14, h: 4 }, kind: "water" },
      { rect: { x: 20, y: 22, w: 17, h: 4 }, kind: "water" },
      { rect: { x: 8, y: 16, w: 2, h: 3 }, kind: "wind", dir: { x: 0, y: -1 } },
      { rect: { x: 27, y: 16, w: 2, h: 3 }, kind: "wind", dir: { x: 0, y: -1 } },
    ],
  }),
  makeWorld(3, "M@tr1x 45", {
    layout: ring, palette: matrix, enemyCount: 4, enemySpeed: 2.6, fog: 5,
    enemyName: "glitch", enemyKind: "glitch",
    gimmick: "Pads move you across the ring. Glitches flicker in and out.",
    signs: ["V1S1B1L1TY C0RRUPT3D", "TH3 PADS SK1P Y0U ACR0SS", "F0LL0W TH3 R1NG"],
    hint: "Whiteout is open.",
    pads: [{ a: { x: 6.5, y: 22.5 }, b: { x: 33.5, y: 8.5 } }],
  }),
  makeWorld(4, "Whiteout", {
    layout: sprawl, palette: snow, enemyCount: 3, enemySpeed: 2.2, fog: 7,
    enemyName: "wisp", enemyKind: "wisp",
    gimmick: "Ice underfoot and a wind that will not let you stand still.",
    signs: ["The floor is ice. You will not stop where you mean to.", "The wind blows east through here.", "Nearly through the storm."],
    hint: "Blood Temple is open.",
    patches: [
      { rect: { x: 16, y: 18, w: 11, h: 8 }, kind: "ice" },
      { rect: { x: 30, y: 18, w: 8, h: 8 }, kind: "ice" },
      { rect: { x: 16, y: 3, w: 11, h: 10 }, kind: "wind", dir: { x: 1, y: 0 } },
    ],
  }),
  makeWorld(5, "Blood Temple", {
    layout: mirror(sprawl), palette: temple, enemyCount: 3, enemySpeed: 1.5,
    enemyName: "skull", enemyKind: "skull",
    gimmick: "Skulls flare, then charge down any row you share with them.",
    signs: ["Step where the floor is whole.", "When a skull flares, get out of its row.", "The last door is close."],
    hint: "V1D30 game is open.",
    patches: [
      { rect: { x: 15, y: 8, w: 3, h: 3 }, kind: "spike" },
      { rect: { x: 18, y: 23, w: 3, h: 2 }, kind: "spike" },
      { rect: { x: 4, y: 9, w: 2, h: 3 }, kind: "spike" },
      { rect: { x: 27, y: 6, w: 4, h: 3 }, kind: "crumble" },
    ],
  }),
  makeWorld(6, "V1D30 game", {
    layout: tower, palette: arcade, enemyCount: 5, enemySpeed: 3.4, playerSpeed: 6.6,
    enemyName: "pixel", enemyKind: "pixel",
    gimmick: "Everything is faster, and the pixels walk in squares.",
    signs: ["SP33D 1NCR3AS3D", "TH3Y PATR0L 1N SQUAR3S", "ALM0ST TH3R3"],
    hint: "Internet run Lol <3 is open.",
    pads: [{ a: { x: 4.5, y: 12.5 }, b: { x: 34.5, y: 12.5 } }],
  }),
  makeWorld(7, "Internet run Lol <3", {
    layout: ring, palette: web, enemyCount: 5, enemySpeed: 3, playerSpeed: 5.8,
    enemyName: "pop-up", enemyKind: "popup",
    gimmick: "Pop-ups appear somewhere new every couple of seconds.",
    signs: ["lol good luck <3", "they move when you blink", "one more :)"],
    hint: "do not enter is open.",
    patches: [
      { rect: { x: 12, y: 21, w: 16, h: 2 }, kind: "water" },
      { rect: { x: 16, y: 15, w: 9, h: 2 }, kind: "crumble" },
    ],
    pads: [{ a: { x: 6.5, y: 6.5 }, b: { x: 33.5, y: 22.5 } }],
  }),
  makeWorld(8, "do not enter", {
    layout: mirror(tower), palette: forbidden, enemyCount: 4, enemySpeed: 1.9, fog: 4,
    enemyName: "watcher", enemyKind: "watcher",
    gimmick: "The watchers never stop coming, and they know where you are.",
    signs: ["turn back", "they do not patrol. they follow.", "keep going then"],
    hint: "The end...? is open.",
    patches: [
      { rect: { x: 16, y: 11, w: 4, h: 3 }, kind: "spike" },
      { rect: { x: 27, y: 21, w: 3, h: 2 }, kind: "spike" },
      { rect: { x: 5, y: 3, w: 3, h: 2 }, kind: "crumble" },
    ],
  }),
  makeWorld(9, "The end...?", {
    layout: ring, palette: ending, enemyCount: 1, enemySpeed: 1.2,
    enemyName: "wanderer", enemyKind: "wanderer",
    gimmick: "Nothing here is hunting you.",
    signs: ["It is quiet here.", "Nothing is chasing you.", "Go and take it."],
    hint: "That is all ten. For now.",
  }),
];
