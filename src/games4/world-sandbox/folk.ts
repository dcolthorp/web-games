import { sprite, tinted, type Choice, type Sprite } from "./sprites";

// People and their villages. "X" pixels are painted in the tribe's colour.

export const PERSON_ART = `
  .BBB.
  .ttt.
  ..t..
  XXXXX
  .XXX.
  .t.t.
  .k.k.
`;

export const VILLAGE_ART = `
  ....X....
  ...XXX...
  ..XXXXX..
  .XXXXXXX.
  XXXXXXXXX
  .bbbbbbb.
  .bbkkbbb.
  .bbkkbbb.
`;

export const PERSON: Choice = { id: "person", name: "Person", habitat: "land", sprite: sprite(PERSON_ART) };
export const VILLAGE: Choice = { id: "village", name: "Village", habitat: "land", sturdy: true, sprite: sprite(VILLAGE_ART) };

export const personSprite = (color: string): Sprite => tinted("person", color, PERSON_ART);
export const villageSprite = (color: string): Sprite => tinted("village", color, VILLAGE_ART);
