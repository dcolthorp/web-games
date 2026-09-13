import { sprite, type Choice } from "./sprites";

export const LAND: Choice[] = [
  {
    id: "oak",
    name: "Oak Tree",
    habitat: "land",
    sprite: sprite(`
      ..LLL..
      .LlhlL.
      LlhllLL
      LllllLL
      .LlLlL.
      ..LLL..
      ...B...
      ...B...
    `),
  },
  {
    id: "pine",
    name: "Pine Tree",
    habitat: "land",
    sprite: sprite(`
      ..L..
      ..L..
      .LlL.
      .LlL.
      LllLL
      .LlL.
      LllLL
      LLLLL
      ..B..
    `),
  },
  {
    id: "palm",
    name: "Palm Tree",
    habitat: "land",
    sprite: sprite(`
      .L...L.
      LLl.lLL
      L.lblL.
      ...b...
      ...b...
      ....b..
      ....b..
      ...b...
    `),
  },
  {
    id: "bush",
    name: "Bush",
    habitat: "land",
    sprite: sprite(`
      .lhl.
      lllLl
      LlLLL
    `),
  },
  {
    id: "flowers",
    name: "Flowers",
    habitat: "land",
    sprite: sprite(`
      .r.y.p.
      .l.l.l.
      lLlLlLl
    `),
  },
  {
    id: "rock",
    name: "Rock",
    habitat: "land",
    sturdy: true,
    sprite: sprite(`
      .ggG.
      gggGG
      gGGGG
    `),
  },
  {
    id: "hill",
    name: "Hill",
    habitat: "land",
    sturdy: true,
    sprite: sprite(`
      ....hhh....
      ..hhhhhll..
      .hhhhhhllL.
      hhhhhhhllLL
    `),
  },
  {
    id: "mountain",
    name: "Mountain",
    habitat: "land",
    sturdy: true,
    sprite: sprite(`
      ......w......
      .....wwG.....
      ....wwwGG....
      ....gwgGG....
      ...ggggGGG...
      ...ggggGGG...
      ..gggggGGGG..
      ..ggggGGGGG..
      .gggggGGGGGG.
      ggggggGGGGGGG
    `),
  },
  // Brushes, not things: drag them over the map to change the land itself.
  {
    id: "raise",
    name: "Raise Land",
    habitat: "air",
    sprite: sprite(`
      ...w...
      ..www..
      .wwwww.
      ...w...
      hhhhhhh
      uuuuuuu
    `),
  },
  {
    id: "sink",
    name: "Sink Land",
    habitat: "air",
    sprite: sprite(`
      ...w...
      ...w...
      .wwwww.
      ..www..
      ...w...
      uuuuuuu
    `),
  },
];

// The lava in the crater flickers between orange and yellow.
const VOLCANO = `
  ....BoyoB....
  ...bBBoBBB...
  ...bbBoBBB...
  ..bbbbBrBBB..
  ..bbbbBBBBB..
  .bbbbbBBBBBB.
  .bbbbbbBBBBB.
  bbbbbbbBBBBBB
  bbbbbbBBBBBBB
`;

export const DISASTERS: Choice[] = [
  {
    id: "volcano",
    name: "Volcano",
    habitat: "land",
    sturdy: true,
    sprite: sprite(VOLCANO, VOLCANO.replace("BoyoB", "ByoyB").replace(/BBoBBB/g, "BByBBB")),
  },
  // Not a thing that stays in the world: placing it sends out a wave.
  {
    id: "tsunami",
    name: "Tsunami",
    habitat: "sea",
    sprite: sprite(`
      ..ccu..
      .cwwcu.
      cw..cuu
      ....uuu
      uuuuuuu
    `),
  },
];
