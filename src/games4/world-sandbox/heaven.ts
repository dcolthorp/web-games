import { sprite, type Choice } from "./sprites";

// Heaven, where the slime boat sends you. It is a world of clouds in the sky,
// and only two kinds of things live there: angels and gods.

export const HEAVEN = "heaven";

// The clouds are the land and the open sky is the sea: deep sky, sky, a cloud's
// edge, cloud, and the fluffy tops of the big clouds.
export const HEAVEN_GROUND = ["#6fa8f0", "#9cc9ff", "#dfe9f7", "#f4f7fc", "#ffffff"];

const ANGEL_UP = `
  ...yyy...
  ....t....
  ww.ttt.ww
  .wwwwwww.
  ...www...
  ...www...
  ...t.t...
`;

const ANGEL_DOWN = `
  ...yyy...
  ....t....
  ...ttt...
  .wwwwwww.
  ww.www.ww
  ...www...
  ...t.t...
`;

const GOD_ART = `
  y...y...y
  .y.yyy.y.
  ...ttt...
  yy.ttt.yy
  ...www...
  .wwwwwww.
  w.wwyww.w
  ..wwyww..
  ..wwwww..
  ..wwwww..
  ..t...t..
`;

const GOD_GLOW = GOD_ART.replace("y...y...y", ".y..y..y.").replace("yy.ttt.yy", ".y.ttt.y.");

export const ANGEL: Choice = { id: "angel", name: "Angel", habitat: "air", sprite: sprite(ANGEL_UP, ANGEL_DOWN) };
export const GOD: Choice = { id: "god", name: "God", habitat: "air", sprite: sprite(GOD_ART, GOD_GLOW) };

// Heaven's whole toolbar. There is nothing else up here.
export const HEAVEN_CATEGORIES: { name: string; choices: Choice[] }[] = [
  { name: "Life", choices: [ANGEL] },
  { name: "Celestial", choices: [GOD] },
];
