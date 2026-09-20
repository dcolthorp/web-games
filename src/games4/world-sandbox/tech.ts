import { sprite, tinted, type Choice, type Sprite } from "./sprites";

// The war machines. Their walls and panels are painted in a tribe's colour
// (the X pixels), so you can see whose battery just opened fire.

const LASER_ART = `
  ....c....
  ....c....
  ...ccc...
  ..XXXXX..
  .XXXXXXX.
  .XkXXXkX.
  .GGGGGGG.
  ..G...G..
`;

const MISSILE_ART = `
  ...r...
  ..rrr..
  ..www..
  .XXXXX.
  .XkkkX.
  .XXXXX.
  .XkkkX.
  GGGGGGG
`;

const NUKE_ART = `
  ...y...
  ..yky..
  .ykkky.
  XXXXXXX
  XkyXykX
  XXXXXXX
  XkyXykX
  GGGGGGG
  GGGGGGG
`;

const TRUCK_ART = `
  ..XXXXX..
  ..XkkkX..
  XXXXXXXXX
  XXXXXXXXX
  XXXXXXXXX
  .k.....k.
  .k.....k.
`;

// A glass tube with a person taking shape inside it.
const SPAWNER_ART = `
  .XXXXX.
  .XcccX.
  .Xc.cX.
  .XcwcX.
  .Xcccx.
  .XcwcX.
  .XXXXX.
  .GGGGG.
`;

// The same machine, but something went wrong with it on purpose.
const MUTANT_SPAWNER_ART = `
  .XXXXX.
  .XhlhX.
  .Xlrlx.
  .XhlhX.
  .XlhlX.
  .XhlhX.
  .XXXXX.
  .GGGGG.
`;

// What comes out of it: lumpy, green, far too many eyes, and wearing its
// tribe's colour so you can tell whose mistake it was.
export const MUTANT_ART = `
  .hlh.
  lrlrl
  .lll.
  XlllX
  .XXX.
  .l.l.
  .k.k.
`;

// A pad with a ring on it. The ring is the tribe's colour; a pad belonging to
// nobody is plain white, which is exactly as safe as it sounds.
const TELEPORTER_ART = `
  ..ccc..
  .cXXXc.
  cXwwwXc
  cXwkwXc
  cXwwwXc
  .cXXXc.
  ..ccc..
`;

export const TECH_CHOICES: Choice[] = [
  { id: "laser-cannon", name: "Laser Cannon", habitat: "land", sturdy: true, sprite: sprite(LASER_ART) },
  { id: "missile-silo", name: "Missile Silo", habitat: "land", sturdy: true, sprite: sprite(MISSILE_ART) },
  { id: "nuke-silo", name: "Nuke Silo", habitat: "land", sturdy: true, sprite: sprite(NUKE_ART) },
  { id: "truck", name: "Truck", habitat: "land", sprite: sprite(TRUCK_ART) },
  { id: "spawner", name: "Spawning Machine", habitat: "land", sturdy: true, sprite: sprite(SPAWNER_ART) },
  {
    id: "mutant-spawner",
    name: "Mutant Spawning Machine",
    habitat: "land",
    sturdy: true,
    sprite: sprite(MUTANT_SPAWNER_ART),
  },
  { id: "teleporter", name: "Teleporter", habitat: "land", sturdy: true, sprite: sprite(TELEPORTER_ART) },
];

// Not in any toolbar: the only way to get one is to build the machine.
export const MUTANT: Choice = { id: "mutant", name: "Mutant", habitat: "land", sprite: sprite(MUTANT_ART) };

export const mutantSprite = (color: string): Sprite => tinted("mutant", color, MUTANT_ART);

const ART: Record<string, string> = {
  "laser-cannon": LASER_ART,
  "missile-silo": MISSILE_ART,
  "nuke-silo": NUKE_ART,
  truck: TRUCK_ART,
  spawner: SPAWNER_ART,
  "mutant-spawner": MUTANT_SPAWNER_ART,
  teleporter: TELEPORTER_ART,
};

export function techSprite(type: string, color: string): Sprite | undefined {
  const art = ART[type];
  return art ? tinted(`tech-${type}`, color, art) : undefined;
}
