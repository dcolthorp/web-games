import { MATERIALS } from "./caves";
import { sprite, tinted, type Choice, type Sprite } from "./sprites";

// Toolbar pictures for the cave tools, and the Cave choice for the world map.

const GEM = `
  ..XX..
  .XwXX.
  XwXXXX
  XXXXXX
  .XXXX.
  ..XX..
`;

const ICONS: Record<string, Sprite> = {
  ".": sprite(`
    .GGGG.
    G..bG.
    ...b.G
    ..b...
    .b....
    b.....
  `),
  "#": sprite(`
    ..gg..
    .gggG.
    gggGGG
    gGGGGG
  `),
  r: sprite(`
    ..ry..
    .rwyl.
    ryyllu
    oylluv
    .lluv.
    ..uv..
  `),
};

export interface CaveTool {
  material: number;
  name: string;
  sprite: Sprite;
}

// Built fresh every time, because crystals nobody had seen before get added to
// the list while you are standing there.
export function caveTools(): CaveTool[] {
  return MATERIALS.map((m, material) => ({
    material,
    name: m.name,
    sprite: ICONS[m.code] ?? tinted(`ore-${m.code}`, m.colors[0] ?? "#fff", GEM),
  }));
}

export const CAVE: Choice = {
  id: "cave",
  name: "Cave",
  habitat: "land",
  sprite: sprite(`
    ..ggggg..
    .ggGGGgg.
    ggGkkkGgg
    gGkkkkkGg
    gGkkkkkGG
  `),
};
