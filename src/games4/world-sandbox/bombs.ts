import { BOMBS } from "./cavern";
import { sprite, type Choice, type Sprite } from "./sprites";

// What a bomb looks like stuck to a cave wall: a black ball, a fuse, and a
// spark on the end of it.

const BOMB_ART = `
  ....yr.
  ...y...
  .kkk...
  kkkkkk.
  kkwkkk.
  kkkkkk.
  .kkkk..
`;

const BIG_BOMB_ART = `
  .....yr..
  ....y....
  ..kkkk...
  .kkkkkkk.
  kkkrrrkkk
  kkkrwrkkk
  kkkrrrkkk
  .kkkkkkk.
  ..kkkkk..
`;

const ART: Record<string, string> = { bomb: BOMB_ART, "big-bomb": BIG_BOMB_ART };

export const BOMB_CHOICES: Choice[] = BOMBS.map((bomb) => ({
  id: bomb.id,
  name: bomb.name,
  habitat: "land",
  sprite: sprite(ART[bomb.id] ?? BOMB_ART),
}));

export const bombSprite = (id: string): Sprite | undefined => BOMB_CHOICES.find((c) => c.id === id)?.sprite;
