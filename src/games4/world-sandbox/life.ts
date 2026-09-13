import { sprite, type Choice } from "./sprites";

// Every life form faces right. Land animals walk on land, sea creatures swim in
// the water, and flying ones go anywhere.
export const LIFE: Choice[] = [
  {
    id: "sheep",
    name: "Sheep",
    habitat: "land",
    sprite: sprite(`
      .wwwww..
      wwwwwwkk
      wwwwwwkw
      .wwwww..
      .k...k..
    `),
  },
  {
    id: "cow",
    name: "Cow",
    habitat: "land",
    sprite: sprite(`
      ........kk.
      wwkkwwwwwwk
      wwkkwwkkwwp
      .wwwwwwwww.
      .k.k...k.k.
    `),
  },
  {
    id: "pig",
    name: "Pig",
    habitat: "land",
    sprite: sprite(`
      ..pppp..
      .ppppppk
      pppppppP
      .pppppp.
      .P.P.P..
    `),
  },
  {
    id: "chicken",
    name: "Chicken",
    habitat: "land",
    sprite: sprite(`
      ..rr.
      ..wk.
      wwwwo
      .www.
      ..y..
    `),
  },
  {
    id: "rabbit",
    name: "Rabbit",
    habitat: "land",
    sprite: sprite(`
      ....gw
      ....gw
      .gggg.
      ggggk.
      .g.g..
    `),
  },
  {
    id: "fox",
    name: "Fox",
    habitat: "land",
    sprite: sprite(`
      ......o.
      ......ok
      oo.ooooo
      .oooooow
      ..k..k..
    `),
  },
  {
    id: "wolf",
    name: "Wolf",
    habitat: "land",
    sprite: sprite(`
      ......G.
      ......Gk
      GG.GGGGG
      .GGGGGGw
      ..G..G..
    `),
  },
  {
    id: "bear",
    name: "Bear",
    habitat: "land",
    sprite: sprite(`
      ......b.
      .bbbbbbb
      bbbbbbbk
      bbbbbbb.
      .B.B.B.B
    `),
  },
  {
    id: "deer",
    name: "Deer",
    habitat: "land",
    sprite: sprite(`
      ......b.b
      .......b.
      ......bb.
      ......bbk
      .tttttbb.
      tttttttt.
      .b.b..b.b
    `),
  },
  {
    id: "horse",
    name: "Horse",
    habitat: "land",
    sprite: sprite(`
      .......bb
      ......bbk
      .bbbbbbb.
      BbbbbbbB.
      .b.b..b.b
      .b.b..b.b
    `),
  },
  {
    id: "elephant",
    name: "Elephant",
    habitat: "land",
    sprite: sprite(`
      .....ggg.
      .gggggggg
      ggggggggk
      gggggggGg
      .gg.gg..g
      .gg.gg...
    `),
  },
  {
    id: "giraffe",
    name: "Giraffe",
    habitat: "land",
    sprite: sprite(`
      .....yk
      .....yy
      .....y.
      .....y.
      ....yy.
      .yyyyy.
      yybyyb.
      .y.y.y.
      .y.y.y.
    `),
  },
  {
    id: "lion",
    name: "Lion",
    habitat: "land",
    sprite: sprite(`
      .....ooo
      .....oyk
      .yyyyooo
      yyyyyyy.
      .y.y.y.y
    `),
  },
  {
    id: "fish",
    name: "Fish",
    habitat: "sea",
    sprite: sprite(`
      o..ooo.
      oooyyok
      o..ooo.
    `),
  },
  {
    id: "shark",
    name: "Shark",
    habitat: "sea",
    sprite: sprite(`
      ....G.....
      .GGGGGGGG.
      G.GGGGGGwk
      ....ww....
    `),
  },
  {
    id: "whale",
    name: "Whale",
    habitat: "sea",
    sprite: sprite(`
      u...........
      uu.uuuuuuu..
      .uuuuuuuuuu.
      uu.uuuuuuku.
      ....cccccc..
    `),
  },
  {
    id: "dolphin",
    name: "Dolphin",
    habitat: "sea",
    sprite: sprite(`
      ......u..
      .uuuuuuuk
      u.uuuuuuu
      ....cc...
    `),
  },
  {
    id: "octopus",
    name: "Octopus",
    habitat: "sea",
    sprite: sprite(`
      ..vvv..
      .vvvvv.
      .vkvkv.
      .vvvvv.
      v.v.v.v
      .v.v.v.
    `),
  },
  {
    id: "turtle",
    name: "Turtle",
    habitat: "sea",
    sprite: sprite(`
      ..lLl...
      .lLlLl..
      hlLlLlhk
      .h...h..
    `),
  },
  {
    id: "crab",
    name: "Crab",
    habitat: "sea",
    sprite: sprite(`
      r.....r
      .rrrrr.
      rrkrkrr
      r.r.r.r
    `),
  },
  {
    id: "jellyfish",
    name: "Jellyfish",
    habitat: "sea",
    sprite: sprite(
      `
      .ppp.
      ppppp
      p.p.p
      .p.p.
      p.p..
    `,
      `
      .ppp.
      ppppp
      p.p.p
      p.p.p
      .p.p.
    `,
    ),
  },
  {
    id: "bird",
    name: "Bird",
    habitat: "air",
    sprite: sprite(
      `
      k...k
      .kkk.
      ..k..
    `,
      `
      .....
      kkkkk
      ..k..
    `,
    ),
  },
  {
    id: "butterfly",
    name: "Butterfly",
    habitat: "air",
    sprite: sprite(
      `
      vv.vv
      vvkvv
      .vkv.
      ..k..
    `,
      `
      .....
      .vkv.
      .vkv.
      ..k..
    `,
    ),
  },
  {
    id: "bat",
    name: "Bat",
    habitat: "air",
    sprite: sprite(
      `
      k.....k
      kk.k.kk
      .kkkkk.
    `,
      `
      .......
      kkkkkkk
      ..kkk..
    `,
    ),
  },
];
