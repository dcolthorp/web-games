import { bleep, boing, boom, chime, crack, whoosh } from "../../shared/sfx";
import { COSMETICS, ollyLook } from "./olly";
import {
  ARROW_FOE,
  BANDIT,
  POISON_ARROW,
  CHEST,
  CHEST_OPEN,
  CRYSTAL,
  FARMER,
  GEM,
  GOBLIN,
  CINDER,
  DUSTY,
  EMBER,
  HIDING_OWL,
  JESTER,
  MUSHROOM_MAN,
  OWL,
  PIG,
  PURPLE_SMITH,
  SKELETON,
  SMITH,
  SNAPPER,
  TROLL,
  WITCH,
  WIZARD,
  spriteImage,
} from "./sprites";

// Quest Mode's world: one big map to walk around with warrior Olly. Pick up
// gems, open chests in the cave (and the secret room behind the crystal),
// trade with the villagers, feed pigs so they follow you, and fight the
// enemies in the castles with math. Once both castles are cleared, a castle
// falls out of the sky into the middle of the map. Its turrets shoot arrows,
// and an arrow that hits Olly has to be fought. Its chest has a saw, and the
// saw cuts down the purple tree at the east edge of the map, which opens the
// Purple Woods: new traders, new mean people, new adventures. Once Olly has
// one of everything, has beaten everybody and opened every chest, a bigger
// purple sky castle drops into the woods, with spike traps and poison arrows.
// The Shadow Wizard's strange map (press O) shows an X. Stand on it for five
// seconds and a portal sucks everything up, Olly too, into THE MATRIX.
// Escaping the Matrix gives the Matrix Relic: press R to call a survivor.
// Call a survivor next to their family in the village (Zag next to his twin
// Jester Zig, Old Pete next to his granddaughter Farmer Fern, Hammer Hank next
// to his big brother Smith Bruno, Misty next to her mom Witch Mabel, Spore
// next to his dad Shroom, Violet next to her cousin the Purple Smith) and a
// reunion
// cutscene plays; afterwards the survivor moves in next door for good.
// Once everybody is reunited, a weird glitchy thing runs around the map.
// Catch it and press G to delete: it only deletes one thing, a weird mushroom
// in the Purple Woods, which hides the hatch to a secret bunker. The bunker's
// metal box opens when the glitch is put inside: Godly Armor, a key to the
// vault in the Matrix, and cosmetics to dress Olly up. The vault's beam of
// light blasts Olly back out and reveals a teleporter to THE BADLANDS: no
// trees, lava, cliffs, new people with new trades, and an owl hiding there:
// Hootie, Old Owl's little sister. Carry her to him for one more reunion.

export interface WorldQuestion {
  text: string;
  answer: number;
  remainder: number;
  isDiv: boolean;
  hint: string;
}

export interface WorldApi {
  learner: string;
  newQuestion(): WorldQuestion;
  recordAnswer(correct: boolean): void;
  muted(): boolean;
  leave(): void;
  // The portal on the X swallowed Olly.
  enterMatrix(): void;
  // Olly just came back out of the Matrix.
  backFromMatrix: boolean;
  // The vault's beam of light just blasted Olly out of the Matrix.
  beamedOut: boolean;
}

const T = 32;
const MAP_W = 120;
const MAP_H = 50;
const VIEW_W = 960;
const VIEW_H = 576;
const SPEED = 150;

// ---------------------------------------------------------------------------
// The map

// . grass  # tree  = path  ~ water  H house  f fence  W castle wall
// c castle floor  R cave rock  o cave floor  S secret wall  Y crystal
// p plaza (where the sky castle lands)  , purple grass  % purple tree
// P the purple tree that only a saw can cut down
// q purple plaza (where the purple sky castle lands)
// U the weird mushroom  h the bunker hatch  M bunker wall  k bunker floor
// L the bunker's ladder back up
// The Badlands: b red dirt  D dusty path  Z cliff  B boulder  ! lava
// A adobe house
type Tile =
  | "." | "#" | "=" | "~" | "H" | "f" | "W" | "c" | "R" | "o" | "S" | "Y" | "p" | "," | "%" | "P" | "q"
  | "U" | "h" | "M" | "k" | "L" | "b" | "D" | "Z" | "B" | "!" | "A";

const PLAZA = { x: 19, y: 10, w: 11, h: 9 };
const PLAZA_GATE = { x: 24, y: 18 };
const CAVE = { x: 2, y: 19, w: 14, h: 15 };
const CRYSTAL_TILE = { x: 11, y: 22 };
const SECRET_WALL = { x: 11, y: 24 };
const SECRET_ROOM = { x: 12, y: 23, w: 3, h: 3 };
const START = { x: 22, y: 27 };
// Where the strange map's X is, in the south of the Purple Woods.
const MATRIX_X = { x: 52, y: 44 };
// The weird mushroom the glitch can delete, and the bunker under the forest
// at the bottom of the first land (only reachable through the hatch).
const WEIRD_MUSHROOM = { x: 55, y: 38 };
const BUNKER = { x: 3, y: 38, w: 16, h: 9 };
const BUNKER_LADDER = { x: 5, y: 40 };
const METAL_BOX = { x: 16, y: 42 };
// Where the glitch starts running around: the middle of the village.
const GLITCH_START = { x: 24, y: 22 };
const X_SECONDS = 5;

// Survivors from the Matrix that the Matrix Relic can call.
// notCalled: in the list for her reunion, but the relic can't call her.
const CALLABLE: { name: string; art: string; lines: string[]; notCalled?: true }[] = [
  { name: "Misty", art: WITCH, lines: ["Whoa, real grass! I'm still a little see-through, though.", "You rang? My potion says you're doing great."] },
  { name: "Old Pete", art: FARMER, lines: ["You called, warrior? Thanks for getting me out for a minute!", "Ahh, fresh air. The Matrix smells like old socks."] },
  { name: "Zag", art: JESTER, lines: ["Did somebody say CHAOS? No? Well, I'm here anyway!", "Tell my twin Zig I said hi. And that I'm the funny one."] },
  { name: "Spore", art: MUSHROOM_MAN, lines: ["The mushrooms here grow the right way up. Weird!", "I brought you a mushroom. Just kidding. I ate it."] },
  { name: "Violet", art: PURPLE_SMITH, lines: ["Need anything? I'm the best at finding portals.", "Nice armor! Did you get that from my cousin, the Purple Smith?"] },
  { name: "Hammer Hank", art: SMITH, lines: ["CLANG! Sorry, I always bring my hammer.", "My forge is still floating somewhere in the Matrix. Seen it?"] },
  { name: "Hootie", art: HIDING_OWL, lines: [], notCalled: true },
];
const VISIT_SECONDS = 8;

// Reunions: who the relic has to call, which villager they belong with, where
// they live afterwards, the cutscene (who says what, and for how long; the
// "party" step is the celebration, with no talking), and the reward.
type ReunionId = "twins" | "farmers" | "smiths" | "witches" | "mushrooms" | "cousins" | "owls";

interface ReunionPlan {
  id: ReunionId;
  visitor: string;
  family: ShopId;
  familyName: string;
  home: { x: number; y: number };
  art: string;
  script: { who: "family" | "visitor" | "party"; text: string; seconds: number }[];
  party: { title: string; things: "juggle" | "hay" | "sparks" | "bubbles" | "spores" | "glitter" | "feathers"; colors: string[] };
  badge: string;
  reward(save: WorldSave): void;
  rewardSays: string;
  talk: string[];
}

const REUNIONS: ReunionPlan[] = [
  {
    id: "twins",
    visitor: "Zag",
    family: "chaos",
    familyName: "Zig",
    home: { x: 30, y: 29 },
    art: JESTER,
    script: [
      { who: "family", text: "...ZAG?!", seconds: 1.8 },
      { who: "visitor", text: "ZIG?!", seconds: 1.6 },
      { who: "family", text: "I haven't seen you since the portal swallowed you!", seconds: 2.8 },
      { who: "visitor", text: "I've been in THE MATRIX! It was chaos. Even for me.", seconds: 2.8 },
      { who: "family", text: "Twin juggle?", seconds: 1.6 },
      { who: "visitor", text: "TWIN JUGGLE!", seconds: 1.4 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Thanks for bringing my brother home, Olly!", seconds: 2.6 },
      { who: "visitor", text: "Here, take some chaos. We've got plenty!", seconds: 2.6 },
    ],
    party: { title: "✨ TWIN JUGGLE! ✨", things: "juggle", colors: ["#e5383b", "#ffd84d", "#3c78d8", "#6fae3c", "#c59bff", "#ff9ad5"] },
    badge: "🃏 Twins reunited",
    reward: (s) => {
      s.chaos += 3;
      s.gems += 25;
    },
    rewardSays: "Zig and Zag are back together! They gave you 3 chaos orbs and 25 gems. Zag is moving in next to Zig's shop!",
    talk: [
      "Why did the cat sit on the computer? To keep an eye on the mouse!",
      "What do you call a pig that does karate? A pork chop!",
      "Why was 6 afraid of 7? Because 7 8 9!",
      "I'm the funny twin. Zig is the... other twin.",
      "Knock knock. Who's there? Zag. Zag who? ZAG IS BACK, BABY!",
      "Why don't skeletons fight each other? They don't have the guts!",
    ],
  },
  {
    id: "farmers",
    visitor: "Old Pete",
    family: "food",
    familyName: "Farmer Fern",
    home: { x: 17, y: 25 },
    art: FARMER,
    script: [
      { who: "family", text: "Wait... GRANDPA PETE?!", seconds: 2 },
      { who: "visitor", text: "Little Fernie! Is that you?", seconds: 2 },
      { who: "family", text: "You got sucked into that portal ages ago! I kept your pigs fed the whole time!", seconds: 3 },
      { who: "visitor", text: "I knew you would. You always were the best farmer in the family.", seconds: 3 },
      { who: "family", text: "Farm dance?", seconds: 1.6 },
      { who: "visitor", text: "FARM DANCE! Pigs, you too!", seconds: 1.8 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Thank you for bringing Grandpa home, Olly!", seconds: 2.6 },
      { who: "visitor", text: "Take my Golden Pitchfork, warrior. And all this pig food!", seconds: 3 },
    ],
    party: { title: "🌾 FARM DANCE! 🌾", things: "hay", colors: ["#e8c96a", "#ffd84d", "#d9a066", "#f4e3a1"] },
    badge: "🌾 Farmers reunited",
    reward: (s) => {
      s.food += 20;
      s.gems += 40;
      if (s.sword < 6) s.sword = 6;
    },
    rewardSays:
      "Farmer Fern and Grandpa Pete are back together! You got Grandpa's GOLDEN PITCHFORK (hits for 6), 20 pig food and 40 gems. Pete is moving in next to Fern's shop!",
    talk: [
      "Back in my day, pigs could fly. Well, almost.",
      "Feed a pig and it'll follow you anywhere. Trust me.",
      "The secret to good corn? Talk to it. Nicely.",
      "Fernie makes the best pig food in all the lands.",
      "I once grew a pumpkin so big, we lived in it for a week.",
    ],
  },
  {
    id: "smiths",
    visitor: "Hammer Hank",
    family: "smith",
    familyName: "Smith Bruno",
    home: { x: 30, y: 25 },
    art: SMITH,
    script: [
      { who: "family", text: "HANK?! My little brother?!", seconds: 2 },
      { who: "visitor", text: "BRUNO! You still forge like a grandma?", seconds: 2.2 },
      { who: "family", text: "Hey! I'm the best smith in this whole land!", seconds: 2.4 },
      { who: "visitor", text: "Only because I was stuck in THE MATRIX with my forge!", seconds: 2.8 },
      { who: "family", text: "Hammer time?", seconds: 1.6 },
      { who: "visitor", text: "HAMMER TIME!", seconds: 1.4 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Olly, you brought my brother home. We'll make you something special.", seconds: 3 },
      { who: "visitor", text: "TITAN ARMOR! Forged by both of us. Nothing gets through this!", seconds: 3 },
    ],
    party: { title: "🔨 HAMMER TIME! 🔨", things: "sparks", colors: ["#ffb347", "#ffd84d", "#ff7a3d", "#fff3c4"] },
    badge: "🔨 Smiths reunited",
    reward: (s) => {
      if (s.armor < 250) s.armor = 250;
      s.gems += 50;
    },
    rewardSays: "Smith Bruno and Hammer Hank are back together! They forged you TITAN ARMOR (+250 health) and gave you 50 gems. Hank is moving in next to Bruno's shop!",
    talk: [
      "CLANG! Sorry. Habit.",
      "A sword is just a very angry spoon.",
      "Bruno thinks he's the best smith. He's the SECOND best.",
      "Want to know a secret? Titan Armor is mostly frying pans.",
      "My forge is still in the Matrix. I visit it on weekends.",
    ],
  },
  {
    id: "witches",
    visitor: "Misty",
    family: "potions",
    familyName: "Witch Mabel",
    home: { x: 17, y: 29 },
    art: WITCH,
    script: [
      { who: "family", text: "MISTY?! Why are you see-through?!", seconds: 2.2 },
      { who: "visitor", text: "Mom! I drank the wrong potion trying to get home from THE MATRIX!", seconds: 3 },
      { who: "family", text: "Oh, honey. Hold still, I'll fix it!", seconds: 2.2 },
      { who: "visitor", text: "Does it involve a potion party?", seconds: 2 },
      { who: "family", text: "It ALWAYS involves a potion party!", seconds: 2 },
      { who: "party", text: "", seconds: 4 },
      { who: "visitor", text: "I'm solid again! Look, I can't see through my hands anymore!", seconds: 2.8 },
      { who: "family", text: "Thank you for bringing my daughter home, Olly. Take our best potions!", seconds: 3 },
    ],
    party: { title: "🫧 POTION PARTY! 🫧", things: "bubbles", colors: ["#9be15d", "#c59bff", "#7fe0f0", "#ff9ad5"] },
    badge: "🧪 Witches reunited",
    reward: (s) => {
      s.megaPotions += 5;
      s.potions += 5;
      s.gems += 60;
    },
    rewardSays: "Witch Mabel and Misty are back together! They gave you 5 MEGA POTIONS, 5 potions and 60 gems. Misty is moving in next to Mabel's shop!",
    talk: [
      "Never drink a potion that's still bubbling. Trust me.",
      "Purple potions taste like grapes. Green ones taste like socks.",
      "Mom's mega potions can heal a dragon. We tried. It was a nice dragon.",
      "I'm not see-through anymore! ...Wait, can you still see me?",
      "A potion a day keeps the Void away!",
    ],
  },
  {
    id: "mushrooms",
    visitor: "Spore",
    family: "mushroom",
    familyName: "Shroom",
    home: { x: 53, y: 12 },
    art: MUSHROOM_MAN,
    script: [
      { who: "family", text: "SPORE?! My little sporeling!", seconds: 2 },
      { who: "visitor", text: "DAD! I grew a whole inch in THE MATRIX!", seconds: 2.4 },
      { who: "family", text: "I looked under every log in these woods for you!", seconds: 2.6 },
      { who: "visitor", text: "The mushrooms there grow upside down. I had to stand on my head!", seconds: 3 },
      { who: "family", text: "Mushroom boogie?", seconds: 1.6 },
      { who: "visitor", text: "MUSHROOM BOOGIE!", seconds: 1.4 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Olly, you found my boy. Take our Lucky Mushroom. It's very, very lucky.", seconds: 3 },
      { who: "visitor", text: "Eat it before a fight and you'll be extra tough! Don't ask how. Mushroom magic.", seconds: 3 },
    ],
    party: { title: "🍄 MUSHROOM BOOGIE! 🍄", things: "spores", colors: ["#f4a1d0", "#ffffff", "#e5383b", "#c59bff", "#9be15d"] },
    badge: "🍄 Mushrooms reunited",
    reward: (s) => {
      s.luckyMushroom = true;
      s.gems += 70;
    },
    rewardSays: "Shroom and Spore are back together! They gave you the LUCKY MUSHROOM (+20% health in every fight) and 70 gems. Spore is moving in next to Shroom's hut!",
    talk: [
      "Mushrooms are like umbrellas for bugs.",
      "Dad says I'm a fungi. Get it? FUN GUY!",
      "In the Matrix I grew upside down. Now I'm right side up. Mostly.",
      "Never eat a mushroom you find on the ground. Unless Dad says it's okay.",
      "My dad is the coolest mushroom in all the woods. Don't tell him I said that.",
    ],
  },
  {
    id: "cousins",
    visitor: "Violet",
    family: "purpleSmith",
    familyName: "The Purple Smith",
    home: { x: 53, y: 22 },
    art: PURPLE_SMITH,
    script: [
      { who: "family", text: "VIOLET?! Cousin, is that you?", seconds: 2.2 },
      { who: "visitor", text: "Who else finds portals for fun?", seconds: 2 },
      { who: "family", text: "You found one portal too many! Everyone said you were gone for good.", seconds: 3 },
      { who: "visitor", text: "I was the last one out of THE MATRIX. Everyone's home now!", seconds: 2.8 },
      { who: "family", text: "Purple party?", seconds: 1.6 },
      { who: "visitor", text: "PURPLE PARTY!", seconds: 1.4 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Olly, I've been saving this for someone special. The Amethyst Blade!", seconds: 3 },
      { who: "visitor", text: "It's sharp, it's purple, and it sparkles. Just like me!", seconds: 2.6 },
    ],
    party: { title: "💜 PURPLE PARTY! 💜", things: "glitter", colors: ["#9b4fe0", "#c59bff", "#e6d6ff", "#d8dbe2", "#7a4fd6"] },
    badge: "💜 Cousins reunited",
    reward: (s) => {
      if (s.sword < 7) s.sword = 7;
      s.gems += 80;
    },
    rewardSays: "Violet and the Purple Smith are back together! You got the AMETHYST BLADE (hits for 7) and 80 gems. Violet is moving in next to the Purple Smith!",
    talk: [
      "I can smell a portal from three woods away.",
      "The Amethyst Blade likes you. I can tell.",
      "My cousin makes the best armor. I make the best entrances.",
      "Everyone from the Matrix is home now. Thanks to you, Olly!",
      "Purple isn't just a color. It's a lifestyle.",
    ],
  },
  {
    // Not from the Matrix: Olly carries Hootie here from the Badlands.
    id: "owls",
    visitor: "Hootie",
    family: "owl",
    familyName: "Old Owl",
    home: { x: 59, y: 12 },
    art: HIDING_OWL,
    script: [
      { who: "family", text: "Hoo... HOOTIE?! Is that really you?", seconds: 2.2 },
      { who: "visitor", text: "Big brother! You still wear that silly monocle!", seconds: 2.4 },
      { who: "family", text: "I looked for you for years! I thought I'd never see you again...", seconds: 2.8 },
      { who: "visitor", text: "I was hiding in the Badlands. It's SO hot there. My feathers are crispy!", seconds: 3 },
      { who: "family", text: "Owl hoot-off?", seconds: 1.6 },
      { who: "visitor", text: "OWL HOOT-OFF!", seconds: 1.4 },
      { who: "party", text: "", seconds: 4 },
      { who: "family", text: "Olly, you gave me back my sister. I don't need to wish anymore.", seconds: 3 },
      { who: "visitor", text: "Take the Owl's Eye! Owls see in the dark, and now you can too.", seconds: 3 },
    ],
    party: { title: "🦉 OWL HOOT-OFF! 🦉", things: "feathers", colors: ["#f4f1e8", "#c9b08a", "#9c7b55", "#ffffff"] },
    badge: "🦉 Owls reunited",
    reward: (s) => {
      s.owlEye = true;
      s.gems += 100;
    },
    rewardSays:
      "Old Owl and Hootie are back together! You got the OWL'S EYE (caves and bunkers aren't dark anymore) and 100 gems. Hootie is moving in next to her brother!",
    talk: [
      "My brother told me ALL about you. Mostly the pig parade.",
      "It's so nice and cool here. My feathers are un-crisping.",
      "Hoo! I mean... hi! I'm still practicing.",
      "Don't tell him, but I think the monocle is kind of cool.",
    ],
  },
];

// The reunions with survivors from the Matrix (the owls don't count for being
// a Matrix Hero).
const MATRIX_REUNIONS = REUNIONS.filter((r) => r.id !== "owls");

const PURPLE_TREE = { x: 47, y: 17 };
// The Purple Woods, east of the purple tree.
const WOODS = { x: 48, y: 1, w: 31, h: MAP_H - 2 };
// The Badlands: only reachable by the teleporter.
const BADLANDS_X = 80;
const TELEPORTER = { x: 49, y: 44 };
const BADLANDS_PAD = { x: 84, y: 24 };
const OWL_HIDEOUT = { x: 116, y: 46 };
const PURPLE_PLAZA = { x: 58, y: 36, w: 17, h: 12 };
const PURPLE_GATE = { x: 66, y: 36 };

const TREES: [number, number][] = [
  [14, 3], [16, 6], [19, 3], [25, 5], [29, 3], [32, 8], [17, 16], [32, 17], [44, 16], [46, 18],
  [40, 33], [33, 33], [14, 34], [20, 34], [30, 34], [44, 34], [4, 15], [9, 16], [13, 12], [33, 20],
];

function buildMap(): Tile[][] {
  const map: Tile[][] = Array.from({ length: MAP_H }, () => Array<Tile>(MAP_W).fill("."));
  const fill = (x: number, y: number, w: number, h: number, tile: Tile): void => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) map[yy]![xx] = tile;
  };
  const frame = (x: number, y: number, w: number, h: number, tile: Tile): void => {
    fill(x, y, w, 1, tile);
    fill(x, y + h - 1, w, 1, tile);
    fill(x, y, 1, h, tile);
    fill(x + w - 1, y, 1, h, tile);
  };

  frame(0, 0, MAP_W, MAP_H, "#");

  // A wall of trees between the first land and the Purple Woods, with one
  // purple tree in it.
  fill(47, 1, 1, MAP_H - 2, "#");
  // The woods end in a wall of trees; past it is the Badlands.
  fill(79, 0, 1, MAP_H, "#");
  buildBadlands(map, fill);
  map[PURPLE_TREE.y]![PURPLE_TREE.x] = "P";
  buildWoods(map, fill, frame);
  // The first land ends in thick forest; only the woods go further south.
  fill(1, 35, 46, MAP_H - 36, "#");
  // The secret bunker, deep under that forest.
  frame(BUNKER.x, BUNKER.y, BUNKER.w, BUNKER.h, "M");
  fill(BUNKER.x + 1, BUNKER.y + 1, BUNKER.w - 2, BUNKER.h - 2, "k");
  map[BUNKER_LADDER.y]![BUNKER_LADDER.x] = "L";
  map[WEIRD_MUSHROOM.y]![WEIRD_MUSHROOM.x] = "U";

  // Pig farm, with a pond and a gate at the bottom.
  frame(2, 2, 11, 9, "f");
  map[10]![7] = ".";
  fill(9, 4, 2, 2, "~");

  // The cave: solid rock with tunnels and chambers dug out of it.
  fill(CAVE.x, CAVE.y, CAVE.w, CAVE.h, "R");
  fill(9, 20, 7, 2, "o");
  fill(9, 22, 2, 8, "o");
  fill(4, 26, 5, 4, "o");
  fill(11, 28, 4, 3, "o");
  // The secret room, behind a wall that opens when the crystal is pulled.
  fill(SECRET_ROOM.x, SECRET_ROOM.y, SECRET_ROOM.w, SECRET_ROOM.h, "o");
  map[SECRET_WALL.y]![SECRET_WALL.x] = "S";
  map[CRYSTAL_TILE.y]![CRYSTAL_TILE.x] = "Y";

  // Village houses.
  fill(17, 23, 3, 2, "H");
  fill(28, 23, 3, 2, "H");
  fill(17, 30, 3, 2, "H");
  fill(28, 30, 3, 2, "H");

  // Paths between everything.
  fill(16, 27, 20, 1, "=");
  fill(24, 19, 1, 15, "=");
  fill(7, 11, 1, 3, "=");
  fill(7, 13, 17, 1, "=");
  fill(16, 20, 8, 1, "=");
  fill(30, 14, 11, 1, "=");
  fill(40, 13, 1, 1, "=");

  fill(PLAZA.x, PLAZA.y, PLAZA.w, PLAZA.h, "p");

  // Two castles, each with a gate.
  frame(35, 2, 11, 11, "W");
  fill(36, 3, 9, 9, "c");
  map[12]![40] = "c";
  frame(35, 21, 11, 11, "W");
  fill(36, 22, 9, 9, "c");
  map[27]![35] = "c";

  for (const [x, y] of TREES) map[y]![x] = "#";
  return map;
}

const BOULDERS: [number, number][] = [
  [90, 20], [92, 29], [101, 14], [106, 27], [112, 20], [88, 44], [104, 46], [115, 10], [83, 33], [97, 44],
];

function buildBadlands(map: Tile[][], fill: (x: number, y: number, w: number, h: number, tile: Tile) => void): void {
  // Cliffs all the way around, red dirt inside. No trees anywhere.
  fill(BADLANDS_X, 0, MAP_W - BADLANDS_X, MAP_H, "Z");
  fill(BADLANDS_X + 1, 1, MAP_W - BADLANDS_X - 2, MAP_H - 2, "b");
  // The settlement: three adobe houses.
  fill(98, 19, 3, 2, "A");
  fill(103, 19, 3, 2, "A");
  fill(98, 27, 3, 2, "A");
  // Dusty paths.
  fill(85, 24, 21, 1, "D");
  fill(95, 8, 1, 32, "D");
  // Lava pools and more cliffs.
  fill(86, 5, 5, 3, "!");
  fill(108, 8, 6, 2, "!");
  fill(87, 37, 7, 3, "!");
  fill(109, 32, 4, 4, "!");
  fill(100, 41, 8, 2, "Z");
  fill(83, 13, 6, 2, "Z");
  for (const [x, y] of BOULDERS) map[y]![x] = "B";
  // The owl's hiding spot: a little pocket of boulders with one gap.
  fill(113, 43, 6, 1, "B");
  fill(113, 43, 1, 6, "B");
  map[46]![113] = "b";
}

const PURPLE_TREES: [number, number][] = [
  [50, 4], [55, 6], [61, 3], [49, 14], [62, 21], [65, 33], [77, 30], [77, 8], [56, 33], [63, 15],
];

function buildWoods(
  map: Tile[][],
  fill: (x: number, y: number, w: number, h: number, tile: Tile) => void,
  frame: (x: number, y: number, w: number, h: number, tile: Tile) => void
): void {
  fill(WOODS.x, WOODS.y, WOODS.w, WOODS.h, ",");
  // The traders' huts.
  fill(51, 10, 3, 2, "H");
  fill(57, 10, 3, 2, "H");
  fill(51, 20, 3, 2, "H");
  // The bandit camp, fenced in, with a gap at the bottom.
  frame(64, 3, 12, 10, "f");
  map[12]![69] = ",";
  // The Shadow Wizard's tower, with a gate on the left.
  frame(67, 16, 10, 8, "W");
  fill(68, 17, 8, 6, "c");
  map[19]![67] = "c";
  // The swamp.
  fill(54, 26, 4, 3, "~");
  fill(60, 29, 5, 3, "~");
  fill(50, 31, 3, 2, "~");
  // Paths.
  fill(48, 17, 19, 1, "=");
  fill(66, 17, 1, 3, "=");
  fill(60, 13, 1, 4, "=");
  fill(60, 13, 10, 1, "=");
  // South to where the purple sky castle lands.
  fill(66, 24, 1, 12, "=");
  fill(PURPLE_PLAZA.x, PURPLE_PLAZA.y, PURPLE_PLAZA.w, PURPLE_PLAZA.h, "q");
  for (const [x, y] of PURPLE_TREES) map[y]![x] = "%";
}

// ---------------------------------------------------------------------------
// Who and what lives in the world

type ShopId = "food" | "smith" | "potions" | "chaos" | "mushroom" | "owl" | "purpleSmith" | "ember" | "dusty" | "cinder";

const NPCS: { id: ShopId; name: string; art: string; tx: number; ty: number; hello: string }[] = [
  { id: "food", name: "Farmer Fern", art: FARMER, tx: 18, ty: 25, hello: "Hungry pigs follow whoever feeds them!" },
  { id: "smith", name: "Smith Bruno", art: SMITH, tx: 29, ty: 25, hello: "Swords, armor, shields. Hammered fresh." },
  { id: "potions", name: "Witch Mabel", art: WITCH, tx: 18, ty: 29, hello: "One sip and you're back on your paws." },
  { id: "chaos", name: "Jester Zig", art: JESTER, tx: 29, ty: 29, hello: "Chaos orbs! Nobody knows what they'll do. Not even me!" },
  { id: "mushroom", name: "Shroom the Mushroom Man", art: MUSHROOM_MAN, tx: 52, ty: 12, hello: "Mega potions! Grown fresh in the swamp. Don't ask how." },
  { id: "owl", name: "Old Owl", art: OWL, tx: 58, ty: 12, hello: "Hoo hoo. I sell things for clever travellers." },
  { id: "purpleSmith", name: "The Purple Smith", art: PURPLE_SMITH, tx: 52, ty: 22, hello: "Diamond and shadow. The best stuff in any land." },
  { id: "ember", name: "Ember", art: EMBER, tx: 99, ty: 21, hello: "Welcome to the Badlands, cat. Everything here is hot. Especially my swords." },
  { id: "dusty", name: "Dusty the Prospector", art: DUSTY, tx: 104, ty: 21, hello: "I don't sell. I TRADE. Got stuff? I'll swap you for it." },
  { id: "cinder", name: "Cinder", art: CINDER, tx: 99, ty: 26, hello: "Howdy! Out here you gotta look the part. Wanna look the part?" },
];

type EnemyKind = "goblin" | "skeleton" | "troll" | "arrow" | "bandit" | "snapper" | "wizard" | "poisonArrow";

const ENEMY_KINDS: Record<EnemyKind, { name: string; art: string; hp: number; damage: number; reward: number }> = {
  goblin: { name: "Goblin Guard", art: GOBLIN, hp: 3, damage: 20, reward: 6 },
  skeleton: { name: "Skeleton Knight", art: SKELETON, hp: 4, damage: 25, reward: 9 },
  troll: { name: "Castle Troll", art: TROLL, hp: 6, damage: 30, reward: 15 },
  arrow: { name: "Angry Arrow", art: ARROW_FOE, hp: 1, damage: 15, reward: 2 },
  bandit: { name: "Sneaky Bandit", art: BANDIT, hp: 5, damage: 30, reward: 12 },
  snapper: { name: "Swamp Snapper", art: SNAPPER, hp: 4, damage: 25, reward: 10 },
  wizard: { name: "The Shadow Wizard", art: WIZARD, hp: 8, damage: 40, reward: 30 },
  // Poison: Olly also loses a little health every question in this fight.
  poisonArrow: { name: "Poison Arrow", art: POISON_ARROW, hp: 2, damage: 25, reward: 4 },
};

// castle: one of the castle enemies that have to be beaten for the sky castle.
const ENEMY_START: { id: string; kind: EnemyKind; tx: number; ty: number; home: { x: number; y: number; w: number; h: number }; castle?: true }[] = [
  { id: "goblin-1", kind: "goblin", tx: 38, ty: 5, home: { x: 36, y: 3, w: 9, h: 9 }, castle: true },
  { id: "goblin-2", kind: "goblin", tx: 42, ty: 6, home: { x: 36, y: 3, w: 9, h: 9 }, castle: true },
  { id: "goblin-3", kind: "goblin", tx: 40, ty: 9, home: { x: 36, y: 3, w: 9, h: 9 }, castle: true },
  { id: "skeleton-1", kind: "skeleton", tx: 38, ty: 24, home: { x: 36, y: 22, w: 9, h: 9 }, castle: true },
  { id: "skeleton-2", kind: "skeleton", tx: 42, ty: 25, home: { x: 36, y: 22, w: 9, h: 9 }, castle: true },
  { id: "troll-1", kind: "troll", tx: 40, ty: 28, home: { x: 36, y: 22, w: 9, h: 9 }, castle: true },
  { id: "bandit-1", kind: "bandit", tx: 67, ty: 6, home: { x: 65, y: 4, w: 10, h: 8 } },
  { id: "bandit-2", kind: "bandit", tx: 71, ty: 8, home: { x: 65, y: 4, w: 10, h: 8 } },
  { id: "bandit-3", kind: "bandit", tx: 68, ty: 10, home: { x: 65, y: 4, w: 10, h: 8 } },
  { id: "snapper-1", kind: "snapper", tx: 58, ty: 27, home: { x: 49, y: 25, w: 17, h: 9 } },
  { id: "snapper-2", kind: "snapper", tx: 52, ty: 29, home: { x: 49, y: 25, w: 17, h: 9 } },
  { id: "wizard", kind: "wizard", tx: 72, ty: 19, home: { x: 68, y: 17, w: 8, h: 6 } },
];
const CASTLE_ENEMIES = ENEMY_START.filter((e) => e.castle);

const PIG_START: { id: string; tx: number; ty: number }[] = [
  { id: "pig-1", tx: 4, ty: 4 },
  { id: "pig-2", tx: 6, ty: 6 },
  { id: "pig-3", tx: 4, ty: 8 },
  { id: "pig-4", tx: 8, ty: 8 },
  { id: "pig-5", tx: 11, ty: 7 },
];
const PIG_FARM = { x: 3, y: 3, w: 9, h: 7 };

interface Loot {
  gems?: number;
  potions?: number;
  chaos?: number;
  armor?: number;
  sword?: number;
  saw?: true;
  megaPotions?: number;
  strangeMap?: true;
  crown?: true;
  says: string;
}

const CHESTS: { id: string; tx: number; ty: number; loot: Loot }[] = [
  { id: "cave-1", tx: 5, ty: 27, loot: { gems: 25, potions: 2, says: "25 gems and 2 potions!" } },
  { id: "cave-2", tx: 13, ty: 29, loot: { gems: 15, chaos: 1, says: "15 gems and a chaos orb!" } },
  { id: "secret", tx: 13, ty: 24, loot: { gems: 40, armor: 100, says: "CRYSTAL ARMOR! (+100 health) and 40 gems!" } },
  {
    id: "sky",
    tx: 24,
    ty: 11,
    loot: { gems: 60, sword: 4, saw: true, says: "The SKY SWORD (hits for 4), 60 gems... and a SAW. I wonder what that's for..." },
  },
  { id: "bandit", tx: 73, ty: 5, loot: { gems: 40, megaPotions: 2, says: "The bandits' loot! 40 gems and 2 mega potions!" } },
  {
    id: "wizard",
    tx: 75,
    ty: 17,
    loot: { gems: 80, strangeMap: true, says: "80 gems and a STRANGE MAP with a big X on it, somewhere far away... To be continued!" },
  },
  {
    id: "purple",
    tx: 66,
    ty: 46,
    loot: { gems: 150, crown: true, says: "THE ROYAL PURPLE CROWN and 150 gems! You conquered the purple sky castle!" },
  },
];

const LOOSE_GEMS: [number, number][] = [
  [3, 14], [10, 15], [15, 10], [20, 6], [27, 7], [33, 4], [46, 8], [46, 26],
  [33, 30], [21, 33], [27, 34], [12, 17], [31, 12], [9, 24], [6, 28], [14, 30],
  // The Purple Woods.
  [50, 8], [62, 9], [76, 13], [55, 24], [66, 30], [72, 32], [59, 20], [74, 26],
  [52, 40], [77, 43], [55, 46],
  // The Badlands.
  [90, 10], [102, 35], [110, 15], [85, 45], [117, 5], [96, 30],
];

// The two castles that fall from the sky. Turrets shoot arrows the way they
// face (dx, dy); spikes pop up and down and send Olly back to the gate.
type SkyId = "sky" | "purple";

interface SkyCastle {
  id: SkyId;
  tile: Tile;
  plaza: { x: number; y: number; w: number; h: number };
  gate: { x: number; y: number };
  turrets: { tx: number; ty: number; dx: number; dy: number }[];
  spikes: [number, number][];
  chest: string;
  poison: boolean;
  shootEvery: number;
  colors: { wall: string; floor: string; trim: string; roof: string; before: string; door: string };
}

const SKY_CASTLES: SkyCastle[] = [
  {
    id: "sky",
    tile: "p",
    plaza: PLAZA,
    gate: PLAZA_GATE,
    turrets: [
      { tx: 20, ty: 12, dx: 1, dy: 0 },
      { tx: 28, ty: 14, dx: -1, dy: 0 },
      { tx: 20, ty: 16, dx: 1, dy: 0 },
    ],
    spikes: [],
    chest: "sky",
    poison: false,
    shootEvery: 1.6,
    colors: { wall: "#e9f2ff", floor: "#cfe0f5", trim: "#7aa0d8", roof: "#3c78d8", before: "#d8d4c8", door: "#3d5a8a" },
  },
  {
    id: "purple",
    tile: "q",
    plaza: PURPLE_PLAZA,
    gate: PURPLE_GATE,
    turrets: [
      { tx: 59, ty: 38, dx: 1, dy: 0 },
      { tx: 73, ty: 40, dx: -1, dy: 0 },
      { tx: 59, ty: 42, dx: 1, dy: 0 },
      { tx: 73, ty: 44, dx: -1, dy: 0 },
      { tx: 61, ty: 37, dx: 0, dy: 1 },
      { tx: 71, ty: 37, dx: 0, dy: 1 },
      { tx: 64, ty: 46, dx: 0, dy: -1 },
      { tx: 69, ty: 46, dx: 0, dy: -1 },
    ],
    spikes: [
      [65, 39], [66, 39], [69, 39], [64, 41], [67, 41], [68, 41], [65, 43], [66, 43], [63, 45], [67, 45],
    ],
    chest: "purple",
    poison: true,
    shootEvery: 1.3,
    colors: { wall: "#e6d6ff", floor: "#cbb6f2", trim: "#7a4fd6", roof: "#7a4fd6", before: "#a796cf", door: "#4a2f8f" },
  },
];

const SWORDS = ["", "Wooden sword", "Iron sword", "Gold sword", "Sky sword", "Diamond sword", "Golden pitchfork", "Amethyst blade", "Blaze sword"];
// Godly Armor is exactly enough that with everything (shield, five pigs in
// pig armor, the Lucky Mushroom) Olly has 1,522 health.
const GODLY_ARMOR = 610;
const ARMORS: Record<number, string> = {
  0: "No armor",
  20: "Leather armor",
  50: "Iron armor",
  100: "Crystal armor",
  150: "Shadow armor",
  250: "Titan armor",
  [GODLY_ARMOR]: "Godly armor",
};

interface ShopItem {
  label: string;
  price: number;
  // What it costs, when it's a trade instead of gems.
  costLabel?: string;
  canBuy(save: WorldSave): boolean;
  buy(save: WorldSave): void;
}

const SHOPS: Record<ShopId, ShopItem[]> = {
  food: [{ label: "Pig food ×3", price: 3, canBuy: () => true, buy: (s) => (s.food += 3) }],
  smith: [
    { label: "Iron sword (hits for 2)", price: 15, canBuy: (s) => s.sword < 2, buy: (s) => (s.sword = 2) },
    { label: "Gold sword (hits for 3)", price: 40, canBuy: (s) => s.sword < 3, buy: (s) => (s.sword = 3) },
    { label: "Leather armor (+20 health)", price: 10, canBuy: (s) => s.armor < 20, buy: (s) => (s.armor = 20) },
    { label: "Iron armor (+50 health)", price: 30, canBuy: (s) => s.armor < 50, buy: (s) => (s.armor = 50) },
    { label: "Wooden shield (+15 health)", price: 12, canBuy: (s) => !s.shield, buy: (s) => (s.shield = true) },
  ],
  potions: [{ label: "Potion (heals 40 in a fight)", price: 8, canBuy: () => true, buy: (s) => (s.potions += 1) }],
  chaos: [{ label: "Chaos orb (press Q to use it)", price: 6, canBuy: () => true, buy: (s) => (s.chaos += 1) }],
  mushroom: [{ label: "Mega potion (heals ALL your health)", price: 15, canBuy: () => true, buy: (s) => (s.megaPotions += 1) }],
  owl: [
    { label: "Speedy boots (walk faster)", price: 25, canBuy: (s) => !s.boots, buy: (s) => (s.boots = true) },
    { label: "Pig armor (each pig gives +15% instead of +10%)", price: 30, canBuy: (s) => !s.pigArmor, buy: (s) => (s.pigArmor = true) },
  ],
  purpleSmith: [
    { label: "Diamond sword (hits for 5)", price: 80, canBuy: (s) => s.sword < 5, buy: (s) => (s.sword = 5) },
    { label: "Shadow armor (+150 health)", price: 70, canBuy: (s) => s.armor < 150, buy: (s) => (s.armor = 150) },
  ],
  ember: [{ label: "Blaze sword (hits for 8!)", price: 120, canBuy: (s) => s.sword < 8, buy: (s) => (s.sword = 8) }],
  dusty: [
    {
      label: "Trade 10 pig food → 25 gems",
      price: 0,
      costLabel: "10 pig food",
      canBuy: (s) => s.food >= 10,
      buy: (s) => {
        s.food -= 10;
        s.gems += 25;
      },
    },
    {
      label: "Trade 2 chaos orbs → 1 mega potion",
      price: 0,
      costLabel: "2 chaos orbs",
      canBuy: (s) => s.chaos >= 2,
      buy: (s) => {
        s.chaos -= 2;
        s.megaPotions += 1;
      },
    },
  ],
  cinder: [
    {
      label: "Cowboy hat (cosmetic)",
      price: 40,
      canBuy: (s) => !s.boughtCosmetics.includes("cowboy-hat"),
      buy: (s) => {
        s.boughtCosmetics.push("cowboy-hat");
        s.cosmetics = true;
      },
    },
    {
      label: "Badlands bandana (cosmetic)",
      price: 30,
      canBuy: (s) => !s.boughtCosmetics.includes("bandana"),
      buy: (s) => {
        s.boughtCosmetics.push("bandana");
        s.cosmetics = true;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Saving

interface WorldSave {
  gems: number;
  food: number;
  potions: number;
  chaos: number;
  sword: number;
  armor: number;
  shield: boolean;
  following: string[];
  defeated: string[];
  opened: string[];
  taken: string[];
  crystal: boolean;
  landed: boolean;
  saw: boolean;
  treeCut: boolean;
  megaPotions: number;
  boots: boolean;
  pigArmor: boolean;
  strangeMap: boolean;
  purpleLanded: boolean;
  crown: boolean;
  relic: boolean;
  luckyMushroom: boolean;
  // The glitch: caught, used on the weird mushroom, put in the metal box.
  glitch: boolean;
  mushroomDeleted: boolean;
  boxOpened: boolean;
  // From the metal box: the key to the Matrix vault, and cosmetics (and which
  // ones Olly is wearing).
  vaultKey: boolean;
  cosmetics: boolean;
  wearing: string[];
  boughtCosmetics: string[];
  // The teleporter the vault's beam revealed, the Badlands, and the owl.
  teleporter: boolean;
  badlands: boolean;
  foundOwl: boolean;
  // Hootie riding on Olly's head, and the Owl's Eye (no more dark places).
  carryingHootie: boolean;
  owlEye: boolean;
  // Which reunions have happened (twins used to be its own flag).
  reunited: ReunionId[];
  twins?: boolean;
  x: number;
  y: number;
}

function freshSave(): WorldSave {
  return {
    gems: 0,
    food: 0,
    potions: 0,
    chaos: 0,
    sword: 1,
    armor: 0,
    shield: false,
    following: [],
    defeated: [],
    opened: [],
    taken: [],
    crystal: false,
    landed: false,
    saw: false,
    treeCut: false,
    megaPotions: 0,
    boots: false,
    pigArmor: false,
    strangeMap: false,
    purpleLanded: false,
    crown: false,
    relic: false,
    luckyMushroom: false,
    glitch: false,
    mushroomDeleted: false,
    boxOpened: false,
    vaultKey: false,
    cosmetics: false,
    wearing: [],
    boughtCosmetics: [],
    teleporter: false,
    badlands: false,
    foundOwl: false,
    carryingHootie: false,
    owlEye: false,
    reunited: [],
    x: START.x * T + T / 2,
    y: START.y * T + T / 2,
  };
}

function saveKeyFor(learner: string): string {
  return `fact-quest-6-world-${learner}`;
}

// Gems picked up in the Matrix go into the same pocket as the world's.
export function addWorldGems(learner: string, gems: number): void {
  const key = saveKeyFor(learner);
  const save = loadSave(key);
  save.gems += gems;
  try {
    localStorage.setItem(key, JSON.stringify(save));
  } catch {
    // Nowhere to save.
  }
}

// Olly's health in a fight: armor and shield add to it, and every pig
// following him adds 10% (15% with pig armor).
function fightHealth(save: WorldSave): number {
  const perPig = save.pigArmor ? 0.15 : 0.1;
  // The Lucky Mushroom adds 20% on top of everything.
  const lucky = save.luckyMushroom ? 1.2 : 1;
  // Rounded down (with a hair of room for tiny maths wobbles).
  return Math.floor((100 + save.armor + (save.shield ? 15 : 0)) * (1 + perPig * save.following.length) * lucky + 1e-6);
}

// Warrior Olly as he looks in the world, cosmetics and all.
export function worldOllyLook(learner: string): string {
  return ollyLook(loadSave(saveKeyFor(learner)).wearing);
}

export function worldHasVaultKey(learner: string): boolean {
  return loadSave(saveKeyFor(learner)).vaultKey;
}

// What Olly brings to a fight outside the world (the Void in the Matrix).
export function worldFighter(learner: string): { health: number; sword: number; pigs: number } {
  const save = loadSave(saveKeyFor(learner));
  return { health: fightHealth(save), sword: save.sword, pigs: save.following.length };
}

function loadSave(key: string): WorldSave {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    if (parsed && typeof parsed === "object") return { ...freshSave(), ...parsed };
  } catch {
    // Start a fresh world.
  }
  return freshSave();
}

// ---------------------------------------------------------------------------

interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turnIn: number;
}

interface Enemy extends Mover {
  id: string;
  kind: EnemyKind;
  home: { x: number; y: number; w: number; h: number };
}

interface Pig extends Mover {
  id: string;
}

interface Arrow {
  x: number;
  y: number;
  dx: number;
  dy: number;
  travelled: number;
  poison: boolean;
}

interface Pickup {
  id: string;
  x: number;
  y: number;
  keep: boolean;
}

type Chaos = "pigParty" | "upsideDown" | "gemRain" | "tiny" | "zoomies";

export function startWorld(root: HTMLElement, api: WorldApi): () => void {
  const saveKey = saveKeyFor(api.learner);
  const save = loadSave(saveKey);
  const map = buildMap();
  if (save.crystal) openSecretRoom();
  if (save.mushroomDeleted) map[WEIRD_MUSHROOM.y]![WEIRD_MUSHROOM.x] = "h";
  // The metal box used to be empty ("to be continued"). Anyone who opened it
  // back then gets what's inside now.
  const boxCatchUp = save.boxOpened && !save.vaultKey;
  // The vault (in the Matrix) was opened before it had a beam: the teleporter
  // is there now anyway.
  let vaultWasOpen = false;
  try {
    vaultWasOpen = localStorage.getItem(`fact-quest-6-matrix-vault-${api.learner}`) === "1";
  } catch {
    // No saved vault.
  }
  const teleporterCatchUp = vaultWasOpen && !save.teleporter && !api.beamedOut;
  if (teleporterCatchUp || api.beamedOut) save.teleporter = true;
  if (api.beamedOut) {
    // The beam drops Olly next to the X, right by where it hits.
    save.x = (TELEPORTER.x + 2) * T + T / 2;
    save.y = TELEPORTER.y * T + T / 2;
  }
  if (boxCatchUp) {
    if (save.armor < GODLY_ARMOR) save.armor = GODLY_ARMOR;
    save.vaultKey = true;
    save.cosmetics = true;
  }
  if (save.treeCut) map[PURPLE_TREE.y]![PURPLE_TREE.x] = "=";
  // The sky chest didn't have the saw in it at first.
  if (save.opened.includes("sky")) save.saw = true;

  root.innerHTML = `
    <div class="world-top">
      <button class="text-link" type="button" data-leave>← Leave the quest</button>
      <button class="cosmetics-button" type="button" data-cosmetics hidden>🎨 Cosmetics</button>
      <div class="hud" id="hud"></div>
    </div>
    <div class="world-stage">
      <canvas width="${VIEW_W}" height="${VIEW_H}" aria-label="Quest Mode world. Arrow keys or WASD to walk, Space to talk, open, feed or pull."></canvas>
      <p class="world-toast" id="world-toast" hidden></p>
      <div class="world-overlay" id="world-overlay" hidden></div>
    </div>
    <p class="world-help"><b>Arrows / WASD</b> walk · <b>Space</b> talk, open, feed a pig, pull a crystal · <b>Q</b> use a chaos orb · <b>O</b> strange map · <b>R</b> Matrix relic · <b>G</b> the glitch</p>
  `;
  const canvas = root.querySelector("canvas")!;
  const ctx = canvas.getContext("2d")!;
  const hud = root.querySelector<HTMLElement>("#hud")!;
  const toast = root.querySelector<HTMLElement>("#world-toast")!;
  const overlay = root.querySelector<HTMLElement>("#world-overlay")!;

  const sound = (play: () => void): void => {
    if (!api.muted()) play();
  };

  if (api.backFromMatrix) {
    save.x = MATRIX_X.x * T + T / 2;
    save.y = MATRIX_X.y * T + T / 2;
  }
  // dirX/dirY: the way Olly last walked, for deleting the tile in front.
  const olly = { x: save.x, y: save.y, facing: 1, moving: false, walk: 0, dirX: 1, dirY: 0 };
  const camera = { x: olly.x, y: olly.y, flying: false };
  // Olly's footsteps, so the pigs can follow in a line behind him.
  const trail: { x: number; y: number }[] = [];

  const enemies: Enemy[] = ENEMY_START.filter((e) => !save.defeated.includes(e.id)).map((e) => ({
    id: e.id,
    kind: e.kind,
    home: e.home,
    x: e.tx * T + T / 2,
    y: e.ty * T + T / 2,
    vx: 0,
    vy: 0,
    turnIn: 0,
  }));
  const pigs: Pig[] = PIG_START.map((p) => ({ id: p.id, x: p.tx * T + T / 2, y: p.ty * T + T / 2, vx: 0, vy: 0, turnIn: 0 }));
  for (const pig of pigs) {
    if (save.following.includes(pig.id)) {
      pig.x = olly.x;
      pig.y = olly.y;
    }
  }
  const pickups: Pickup[] = LOOSE_GEMS.map(([tx, ty], index) => ({ id: `gem-${index}`, x: tx * T + T / 2, y: ty * T + T / 2, keep: true })).filter(
    (gem) => !save.taken.includes(gem.id)
  );
  const arrows: Arrow[] = [];
  const turretClocks = new Map<SkyId, number>();
  let safeFor = 0;
  // A sky castle on its way down, and how long it's been falling.
  let falling = -1;
  let fallingCastle: SkyCastle | null = null;
  // The castle the camera flies over to watch while it lands.
  let watching: SkyCastle | null = null;
  let shake = 0;
  let crystalDrop = -1;
  // The purple tree toppling over after it's sawed.
  let treeFall = -1;
  // Standing on the X: how long, and the portal once it opens.
  let onX = 0;
  // Coming back out of the Matrix, Olly has to step off the X before it
  // counts again.
  let xReady = !api.backFromMatrix;
  let portal = -1;
  // A survivor called by the Matrix Relic, standing next to Olly for a bit.
  let visitor: { who: number; line: string; x: number; y: number; until: number; since: number } | null = null;
  let lastCalled = -1;
  // The glitch running around the map (until it's caught), and the zap from
  // pressing G.
  const glitchThing = { x: GLITCH_START.x * T + T / 2, y: GLITCH_START.y * T + T / 2, vx: 0, vy: 0, turnIn: 0, blinkIn: 6 };
  let zap: { x: number; y: number; until: number } | null = null;
  let boxOpening = -1;
  // The beam from the Matrix vault landing on the teleporter, and the flash
  // when Olly teleports.
  let beamDown = api.beamedOut ? 0 : -1;
  let flash = 0;
  // Where the camera was last frame, so clicks on the canvas can find things.
  let lastCam = { x: 0, y: 0 };

  // A reunion cutscene, while it plays: which one, and how far along.
  let reunion = -1;
  let plan: ReunionPlan | null = null;
  const confetti: { x: number; y: number; vx: number; vy: number; color: string; life: number; spin: number }[] = [];
  if (save.twins && !save.reunited.includes("twins")) save.reunited.push("twins");
  let busy = false;
  const chaos = new Map<Chaos, number>();
  let rainCount = 0;
  let time = 0;
  let toastTimer = 0;
  const keys = new Set<string>();

  function persist(): void {
    save.x = olly.x;
    save.y = olly.y;
    try {
      localStorage.setItem(saveKey, JSON.stringify(save));
    } catch {
      // Nowhere to save.
    }
  }

  function say(text: string): void {
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 3200);
  }

  function openSecretRoom(): void {
    map[SECRET_WALL.y]![SECRET_WALL.x] = "o";
    map[CRYSTAL_TILE.y]![CRYSTAL_TILE.x] = "R";
  }

  // --- Health ---------------------------------------------------------------

  function maxHealth(): number {
    return fightHealth(save);
  }

  // How much more health each following pig gives (more with pig armor).
  function pigBonus(): number {
    return save.pigArmor ? 0.15 : 0.1;
  }

  function renderHud(): void {
    hud.innerHTML = `
      <span title="Gems"><img src="${spriteImage(GEM).src}" alt="" /> ${save.gems}</span>
      <span title="Health in fights">❤ ${maxHealth()}</span>
      <span title="Pigs following you"><img src="${spriteImage(PIG).src}" alt="" /> ${save.following.length}</span>
      <span title="Pig food">🌽 ${save.food}</span>
      <span title="Potions">🧪 ${save.potions}</span>
      ${save.megaPotions ? `<span title="Mega potions">⚗️ ${save.megaPotions}</span>` : ""}
      <span title="Chaos orbs">🌀 ${save.chaos}</span>
      <span>${SWORDS[save.sword]}</span>
      <span>${ARMORS[save.armor]}${save.shield ? " + shield" : ""}</span>
      ${save.boots ? "<span>Speedy boots</span>" : ""}
      ${save.pigArmor ? "<span>Pig armor</span>" : ""}
      ${save.saw ? "<span>🪚 Saw</span>" : ""}
      ${save.strangeMap ? "<span>🗺️ Strange map</span>" : ""}
      ${save.crown ? "<span>👑 Royal Purple Crown</span>" : ""}
      ${save.relic ? "<span>🔮 Matrix relic (R)</span>" : ""}
      ${save.luckyMushroom ? "<span>🍄 Lucky mushroom</span>" : ""}
      ${save.glitch && !save.boxOpened ? "<span>👾 The Glitch (G)</span>" : ""}
      ${save.vaultKey ? "<span>🗝️ Vault key</span>" : ""}
      ${save.carryingHootie ? "<span>🦉 Carrying Hootie</span>" : ""}
      ${save.owlEye ? "<span>👁️ Owl's eye</span>" : ""}
      ${REUNIONS.filter((r) => save.reunited.includes(r.id)).map((r) => `<span>${r.badge}</span>`).join("")}
      ${MATRIX_REUNIONS.every((r) => save.reunited.includes(r.id)) ? "<span>🏆 Matrix hero</span>" : ""}
    `;
  }

  // --- Moving around -------------------------------------------------------

  function isLanded(castle: SkyCastle): boolean {
    return castle.id === "sky" ? save.landed : save.purpleLanded;
  }

  function landedCastles(): SkyCastle[] {
    return SKY_CASTLES.filter(isLanded);
  }

  function plazaWall(tx: number, ty: number): boolean {
    return landedCastles().some(({ plaza, gate }) => {
      const onEdge =
        tx >= plaza.x && tx < plaza.x + plaza.w && ty >= plaza.y && ty < plaza.y + plaza.h &&
        (tx === plaza.x || tx === plaza.x + plaza.w - 1 || ty === plaza.y || ty === plaza.y + plaza.h - 1);
      return onEdge && !(tx === gate.x && ty === gate.y);
    });
  }

  // A sky castle's chest isn't there until its castle has landed.
  function chestHere(chest: (typeof CHESTS)[number]): boolean {
    const castle = SKY_CASTLES.find((c) => c.chest === chest.id);
    return !castle || isLanded(castle);
  }

  function solidTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    const tile = map[ty]![tx]!;
    if ("#~HfWRSY%PUMZB!A".includes(tile)) return true;
    if (tx === METAL_BOX.x && ty === METAL_BOX.y) return true;
    if (plazaWall(tx, ty)) return true;
    if (NPCS.some((n) => n.tx === tx && n.ty === ty)) return true;
    if (movedIn().some((r) => r.home.x === tx && r.home.y === ty)) return true;
    if (CHESTS.some((c) => c.tx === tx && c.ty === ty && chestHere(c))) return true;
    if (landedCastles().some((c) => c.turrets.some((t) => t.tx === tx && t.ty === ty))) return true;
    return false;
  }

  function blocked(x: number, y: number, half: number): boolean {
    const left = Math.floor((x - half) / T);
    const right = Math.floor((x + half) / T);
    const top = Math.floor((y - half) / T);
    const bottom = Math.floor((y + half) / T);
    for (let ty = top; ty <= bottom; ty += 1) for (let tx = left; tx <= right; tx += 1) if (solidTile(tx, ty)) return true;
    return false;
  }

  function moveOlly(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
    olly.moving = dx !== 0 || dy !== 0;
    if (!olly.moving) return;
    if (dx) olly.facing = dx;
    olly.dirX = dx;
    olly.dirY = dy;
    const length = Math.hypot(dx, dy);
    const speed = SPEED * (chaos.has("zoomies") ? 2 : 1) * (save.boots ? 1.4 : 1);
    const stepX = (dx / length) * speed * dt;
    const stepY = (dy / length) * speed * dt;
    // If something solid ended up where Olly is standing (like a survivor
    // moving in right on top of him), let him walk out of it.
    const stuck = blocked(olly.x, olly.y, 10);
    if (stuck || !blocked(olly.x + stepX, olly.y, 10)) olly.x += stepX;
    if (stuck || !blocked(olly.x, olly.y + stepY, 10)) olly.y += stepY;
    olly.walk += dt;
    trail.unshift({ x: olly.x, y: olly.y });
    if (trail.length > 200) trail.length = 200;
  }

  // Enemies and pigs wander around their home area.
  function wander(mover: Mover, home: { x: number; y: number; w: number; h: number }, speed: number, dt: number): void {
    mover.turnIn -= dt;
    if (mover.turnIn <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const going = Math.random() < 0.7;
      mover.vx = going ? Math.cos(angle) * speed : 0;
      mover.vy = going ? Math.sin(angle) * speed : 0;
      mover.turnIn = 1 + Math.random() * 1.5;
    }
    const nx = mover.x + mover.vx * dt;
    const ny = mover.y + mover.vy * dt;
    const inside = (x: number, y: number): boolean =>
      x > home.x * T + 10 && x < (home.x + home.w) * T - 10 && y > home.y * T + 10 && y < (home.y + home.h) * T - 10;
    if (inside(nx, ny) && !blocked(nx, ny, 10)) {
      mover.x = nx;
      mover.y = ny;
    } else {
      mover.turnIn = 0;
    }
  }

  function update(dt: number): void {
    time += dt;
    for (const [effect, until] of chaos) if (time > until) chaos.delete(effect);
    if (shake > 0) shake -= dt;
    if (safeFor > 0) safeFor -= dt;
    if (crystalDrop >= 0) crystalDrop += dt;
    if (treeFall >= 0) treeFall += dt;
    if (boxOpening >= 0) boxOpening += dt;
    if (beamDown >= 0) {
      beamDown += dt;
      if (beamDown > 3) beamDown = -1;
    }
    if (flash > 0) flash -= dt;

    if (watching && falling < 0 && shake <= 0) watching = null;
    if (reunion >= 0) {
      updateReunion(dt);
      return;
    }
    if (visitor && time - visitor.since > 0.4) {
      const waiting = REUNIONS.find((r) => r.visitor === CALLABLE[visitor!.who]!.name && !save.reunited.includes(r.id));
      if (waiting) {
        const family = familySpot(waiting);
        if (Math.hypot(visitor.x - family.x, visitor.y - family.y) < 130) startReunion(waiting);
      }
    }
    if (portal >= 0) {
      updatePortal(dt);
      return;
    }
    if (falling >= 0) {
      falling += dt;
      if (falling >= 3 && fallingCastle) landSkyCastle(fallingCastle);
      return;
    }
    if (busy) return;

    moveOlly(dt);
    standOnTheX(dt);
    updateGlitch(dt);

    for (const enemy of enemies) wander(enemy, enemy.home, 40, dt);
    const following = save.following;
    for (const pig of pigs) {
      const place = following.indexOf(pig.id);
      if (place >= 0) {
        // Follow in a line, each pig a few steps behind the one in front.
        const spot = trail[Math.min(trail.length - 1, (place + 1) * 16)];
        if (spot) {
          pig.x += (spot.x - pig.x) * Math.min(1, dt * 8);
          pig.y += (spot.y - pig.y) * Math.min(1, dt * 8);
        }
      } else {
        wander(pig, PIG_FARM, 25, dt);
      }
    }

    // Gems get picked up just by walking over them.
    for (let index = pickups.length - 1; index >= 0; index -= 1) {
      const gem = pickups[index]!;
      if (Math.hypot(gem.x - olly.x, gem.y - olly.y) < 22) {
        pickups.splice(index, 1);
        save.gems += 1;
        if (gem.keep) save.taken.push(gem.id);
        sound(() => chime());
        renderHud();
        persist();
      }
    }

    // Bumping into an enemy starts a fight.
    for (const enemy of enemies) {
      if (Math.hypot(enemy.x - olly.x, enemy.y - olly.y) < 28) {
        startFight(enemy.kind, enemy);
        return;
      }
    }

    // The sky castles' turrets and traps.
    for (const castle of landedCastles()) {
      const clock = (turretClocks.get(castle.id) ?? 0) + dt;
      turretClocks.set(castle.id, clock > castle.shootEvery ? 0 : clock);
      if (clock > castle.shootEvery) {
        for (const turret of castle.turrets) {
          arrows.push({
            x: turret.tx * T + T / 2 + turret.dx * 18,
            y: turret.ty * T + T / 2 + turret.dy * 18,
            dx: turret.dx,
            dy: turret.dy,
            travelled: 0,
            poison: castle.poison,
          });
        }
      }
      if (safeFor <= 0 && spikeUnderOlly(castle)) {
        olly.x = castle.gate.x * T + T / 2;
        olly.y = (castle.gate.y + (castle.gate.y === castle.plaza.y ? -1 : 1)) * T + T / 2;
        trail.length = 0;
        safeFor = 1.5;
        sound(() => boing());
        say("OUCH! Spikes! Olly jumped all the way back out of the gate.");
        return;
      }
    }
    for (let index = arrows.length - 1; index >= 0; index -= 1) {
      const arrow = arrows[index]!;
      const step = 230 * dt;
      arrow.x += arrow.dx * step;
      arrow.y += arrow.dy * step;
      arrow.travelled += step;
      if (arrow.travelled > T * 16 || solidTile(Math.floor(arrow.x / T), Math.floor(arrow.y / T))) {
        arrows.splice(index, 1);
        continue;
      }
      const reachX = arrow.dx ? 16 : 12;
      const reachY = arrow.dy ? 16 : 12;
      if (safeFor <= 0 && Math.abs(arrow.x - olly.x) < reachX && Math.abs(arrow.y - olly.y) < reachY) {
        arrows.length = 0;
        startFight(arrow.poison ? "poisonArrow" : "arrow", null);
        return;
      }
    }
  }

  // The X only shows up for someone with the strange map. Stand on it for
  // five seconds and the portal opens.
  function standOnTheX(dt: number): void {
    if (!save.strangeMap) return;
    const onIt = Math.floor(olly.x / T) === MATRIX_X.x && Math.floor(olly.y / T) === MATRIX_X.y;
    if (!onIt) {
      onX = 0;
      xReady = true;
      return;
    }
    if (!xReady) return;
    const before = onX;
    onX += dt;
    if (before < 1 && onX >= 1) say("The X is humming... stay on it...");
    if (onX >= X_SECONDS) openPortal();
  }

  function openPortal(): void {
    portal = 0;
    busy = true;
    keys.clear();
    onX = 0;
    sound(() => whoosh(4));
    say("A PORTAL! It's sucking everything in!");
  }

  // The portal pulls in gems, pigs and enemies nearby, then Olly, then the
  // sky goes black.
  function updatePortal(dt: number): void {
    portal += dt;
    const cx = MATRIX_X.x * T + T / 2;
    const cy = MATRIX_X.y * T + T / 2;
    const pull = (thing: { x: number; y: number }, reach: number): void => {
      const distance = Math.hypot(thing.x - cx, thing.y - cy);
      if (distance > reach) return;
      const strength = Math.min(1, dt * (1.5 + portal));
      thing.x += (cx - thing.x) * strength;
      thing.y += (cy - thing.y) * strength;
    };
    const reach = Math.min(420, 120 + portal * 150);
    for (const gem of pickups) pull(gem, reach);
    for (const pig of pigs) pull(pig, reach);
    for (const enemy of enemies) pull(enemy, reach);
    if (portal > 1.8) pull(olly, 9999);
    if (portal > 3) shake = 0.2;
    if (portal >= 5.2) {
      portal = -1;
      persist();
      api.enterMatrix();
    }
  }

  // How small something looks as the portal swallows it.
  function suck(x: number, y: number): number {
    if (portal < 0) return 1;
    const distance = Math.hypot(x - (MATRIX_X.x * T + T / 2), y - (MATRIX_X.y * T + T / 2));
    return Math.max(0.05, Math.min(1, distance / 140));
  }

  // --- The Matrix Relic ---------------------------------------------------

  function callSurvivor(): void {
    if (!save.relic) {
      say("You need the Matrix Relic for that. Escape THE MATRIX to get one!");
      return;
    }
    // Once Zag lives in the village he doesn't need calling.
    // Survivors who've moved into the village don't need calling.
    const choices = CALLABLE.map((_, index) => index).filter(
      (index) => !CALLABLE[index]!.notCalled && !movedIn().some((r) => r.visitor === CALLABLE[index]!.name)
    );
    if (!choices.length) {
      say("🔮 The relic glows happily. Everyone from the Matrix is home now, thanks to you!");
      sound(() => chime());
      return;
    }
    let pick = Math.floor(Math.random() * choices.length);
    if (choices[pick] === lastCalled) pick = (pick + 1) % choices.length;
    const who = choices[pick]!;
    lastCalled = who;
    const survivor = CALLABLE[who]!;
    const line = survivor.lines[Math.floor(Math.random() * survivor.lines.length)]!;
    visitor = { who, line, x: olly.x + olly.facing * 42, y: olly.y, until: time + VISIT_SECONDS, since: time };
    sound(() => chime());
  }

  // --- The glitch ----------------------------------------------------------

  function glitchLoose(): boolean {
    return !save.glitch && MATRIX_REUNIONS.every((r) => save.reunited.includes(r.id));
  }

  // It runs away from Olly, zig-zagging, and now and then blinks to a nearby
  // spot. Touching it catches it.
  function updateGlitch(dt: number): void {
    if (!glitchLoose()) return;
    const awayX = glitchThing.x - olly.x;
    const awayY = glitchThing.y - olly.y;
    const distance = Math.hypot(awayX, awayY);
    if (distance < 24) {
      save.glitch = true;
      sound(() => crack());
      say("You caught... it? It's THE GLITCH! 👾 Press G to delete the thing in front of you. It looks like it wants to delete something weird...");
      renderHud();
      persist();
      return;
    }
    glitchThing.turnIn -= dt;
    glitchThing.blinkIn -= dt;
    if (glitchThing.turnIn <= 0) {
      const scared = distance < 220;
      const angle = scared ? Math.atan2(awayY, awayX) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
      const speed = scared ? 130 : 70;
      glitchThing.vx = Math.cos(angle) * speed;
      glitchThing.vy = Math.sin(angle) * speed;
      glitchThing.turnIn = 0.3 + Math.random() * 0.5;
    }
    const nx = glitchThing.x + glitchThing.vx * dt;
    const ny = glitchThing.y + glitchThing.vy * dt;
    if (!blocked(nx, ny, 8)) {
      glitchThing.x = nx;
      glitchThing.y = ny;
    } else {
      glitchThing.turnIn = 0;
    }
    if (glitchThing.blinkIn <= 0) {
      // Blink! Somewhere a few tiles away.
      glitchThing.blinkIn = 5 + Math.random() * 5;
      for (let tries = 0; tries < 20; tries += 1) {
        const x = glitchThing.x + (Math.random() - 0.5) * T * 10;
        const y = glitchThing.y + (Math.random() - 0.5) * T * 10;
        if (!blocked(x, y, 8) && !inBunker(x, y)) {
          glitchThing.x = x;
          glitchThing.y = y;
          break;
        }
      }
    }
  }

  // G: the glitch deletes the tile in front of Olly. It only works on the
  // weird mushroom.
  function useGlitch(): void {
    if (!save.glitch || save.boxOpened) {
      say(save.boxOpened ? "The glitch is in the metal box now." : "You don't have anything that can delete stuff.");
      return;
    }
    const tx = Math.floor(olly.x / T) + Math.sign(olly.dirX || (olly.dirY ? 0 : olly.facing));
    const ty = Math.floor(olly.y / T) + Math.sign(olly.dirY);
    zap = { x: tx * T + T / 2, y: ty * T + T / 2, until: time + 0.6 };
    sound(() => crack());
    if (map[ty]?.[tx] === "U") {
      map[ty]![tx] = "h";
      save.mushroomDeleted = true;
      say("DELETED! The weird mushroom vanished... and there's a HATCH under it! Stand on it and press Space to climb down.");
      persist();
    } else {
      say("Bzzt! The glitch fizzles. It only wants to delete something WEIRD...");
    }
  }

  function inBunker(x: number, y: number): boolean {
    return x > BUNKER.x * T && x < (BUNKER.x + BUNKER.w) * T && y > BUNKER.y * T && y < (BUNKER.y + BUNKER.h) * T;
  }

  // Down the hatch into the bunker, or up the ladder back out.
  function useHatchOrLadder(): boolean {
    const tx = Math.floor(olly.x / T);
    const ty = Math.floor(olly.y / T);
    if (map[ty]?.[tx] === "h") {
      olly.x = (BUNKER_LADDER.x + 1) * T + T / 2;
      olly.y = BUNKER_LADDER.y * T + T / 2;
      trail.length = 0;
      sound(() => whoosh(0.4));
      say("You climbed down into a SECRET BUNKER. It's very quiet down here...");
      return true;
    }
    if (Math.hypot(BUNKER_LADDER.x * T + T / 2 - olly.x, BUNKER_LADDER.y * T + T / 2 - olly.y) < 40) {
      olly.x = (WEIRD_MUSHROOM.x + 1) * T + T / 2;
      olly.y = WEIRD_MUSHROOM.y * T + T / 2;
      trail.length = 0;
      sound(() => whoosh(0.4));
      say("You climbed back up the ladder into the Purple Woods.");
      return true;
    }
    return false;
  }

  function useMetalBox(): void {
    if (save.boxOpened) {
      say("The metal box is empty now. You took the Godly Armor, the vault key and the cosmetics.");
      return;
    }
    if (!save.glitch) {
      say("A heavy metal box with a glitchy-shaped hole in it. Something weird must fit in there...");
      return;
    }
    save.boxOpened = true;
    boxOpening = 0;
    if (save.armor < GODLY_ARMOR) save.armor = GODLY_ARMOR;
    save.vaultKey = true;
    save.cosmetics = true;
    sound(() => boom(0.8));
    say(
      "You put THE GLITCH into the metal box... it buzzes... clicks... and OPENS! Inside: GODLY ARMOR, a weird KEY for a vault in THE MATRIX, and a COSMETICS kit! Click 🎨 Cosmetics up top."
    );
    renderHud();
    renderCosmeticsButton();
    persist();
  }

  // --- The teleporter and the Badlands ------------------------------------

  function inBadlands(x: number): boolean {
    return x >= BADLANDS_X * T;
  }

  function tileCenter(spot: { x: number; y: number }): { x: number; y: number } {
    return { x: spot.x * T + T / 2, y: spot.y * T + T / 2 };
  }

  // Teleport between the teleporter by the X and the pad in the Badlands.
  function teleport(): void {
    const toBadlands = !inBadlands(olly.x);
    const arrive = toBadlands ? BADLANDS_PAD : TELEPORTER;
    olly.x = (arrive.x + 1) * T + T / 2;
    olly.y = arrive.y * T + T / 2;
    camera.x = olly.x;
    camera.y = olly.y;
    trail.length = 0;
    // The pig parade comes along.
    for (const pig of pigs) {
      if (save.following.includes(pig.id)) {
        pig.x = olly.x;
        pig.y = olly.y;
      }
    }
    flash = 0.6;
    sound(() => whoosh(0.8));
    if (toBadlands && !save.badlands) {
      save.badlands = true;
      say("WHOOSH! You're in THE BADLANDS. Red dirt, lava, cliffs... and not a single tree. Somebody lives here, though...");
    } else {
      say(toBadlands ? "Back in the Badlands!" : "Back by the X in the Purple Woods.");
    }
    persist();
  }

  function nearSpot(spot: { x: number; y: number }, reach = 46): boolean {
    const center = tileCenter(spot);
    return Math.hypot(center.x - olly.x, center.y - olly.y) < reach;
  }

  // Clicking the teleporter (or the Badlands pad) on screen uses it.
  function onCanvasClick(event: MouseEvent): void {
    if (busy || falling >= 0 || portal >= 0 || !save.teleporter) return;
    const box = canvas.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * VIEW_W + lastCam.x;
    const y = ((event.clientY - box.top) / box.height) * VIEW_H + lastCam.y;
    const pad = inBadlands(olly.x) ? tileCenter(BADLANDS_PAD) : tileCenter(TELEPORTER);
    if (Math.hypot(pad.x - x, pad.y - y) < 30) teleport();
  }

  // The owl hiding in the Badlands.
  function hootieInHideout(): boolean {
    return !save.carryingHootie && !save.reunited.includes("owls");
  }

  // The first time, she tells Olly who she is. After that, Space picks her up
  // and she rides on his head.
  function talkToHidingOwl(): void {
    if (!save.foundOwl) {
      save.foundOwl = true;
      say("Eep! You found me! I'm HOOTIE. I hide in these rocks from the heat. Wait... you know an OLD OWL? With a MONOCLE? ...That's my big brother! (Press Space again to pick me up!)");
    } else {
      save.carryingHootie = true;
      say("Hootie hopped onto your head! 🦉 Take her to Old Owl in the Purple Woods!");
    }
    renderHud();
    persist();
    sound(() => bleep(6));
  }

  // Carrying Hootie up to Old Owl starts their reunion.
  function bringHootieHome(): void {
    const owls = REUNIONS.find((r) => r.id === "owls")!;
    const hootie = CALLABLE.findIndex((c) => c.name === "Hootie");
    save.carryingHootie = false;
    renderHud();
    visitor = { who: hootie, line: "", x: olly.x, y: olly.y - 24, until: time + 10, since: time - 1 };
    startReunion(owls);
  }

  // --- Cosmetics -----------------------------------------------------------

  function renderCosmeticsButton(): void {
    root.querySelector<HTMLElement>("[data-cosmetics]")!.hidden = !save.cosmetics;
  }

  function openCosmetics(): void {
    if (busy || !save.cosmetics) return;
    busy = true;
    keys.clear();
    const draw = (): void => {
      const cube = COSMETICS.filter((c) => c.geometryDash).every((c) => save.wearing.includes(c.id));
      overlay.innerHTML = `
        <div class="shop-card cosmetics-card">
          <div class="shop-head">
            <span class="cosmetics-preview">${ollyLook(save.wearing)}</span>
            <div><strong>Cosmetics</strong><p>${cube ? "With every Geometry Dash thing on, Olly is a Geometry Dash cube!" : "Click to put things on Olly, or take them off."}</p></div>
          </div>
          <div class="shop-items">
            ${COSMETICS.filter((c) => !c.shop || save.boughtCosmetics.includes(c.id)).map(
              (c) => `<button type="button" data-wear="${c.id}" class="${save.wearing.includes(c.id) ? "is-worn" : ""}">
                <span>${c.name}</span><b>${save.wearing.includes(c.id) ? "Wearing ✓" : "Put on"}</b>
              </button>`
            ).join("")}
          </div>
          <button class="big-button light" type="button" data-close>Done</button>
        </div>
      `;
      for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-wear]")) {
        button.addEventListener("click", () => {
          const id = button.dataset["wear"]!;
          save.wearing = save.wearing.includes(id) ? save.wearing.filter((w) => w !== id) : [...save.wearing, id];
          sound(() => bleep(save.wearing.includes(id) ? 4 : 0));
          persist();
          draw();
        });
      }
      overlay.querySelector("[data-close]")!.addEventListener("click", closeOverlay);
    };
    overlay.hidden = false;
    draw();
  }

  // --- Reunions ------------------------------------------------------------

  function movedIn(): ReunionPlan[] {
    return REUNIONS.filter((r) => save.reunited.includes(r.id));
  }

  function familySpot(reunionPlan: ReunionPlan): { x: number; y: number } {
    const family = NPCS.find((n) => n.id === reunionPlan.family)!;
    return { x: family.tx * T + T / 2, y: family.ty * T + T / 2 };
  }

  function homeSpot(reunionPlan: ReunionPlan): { x: number; y: number } {
    return { x: reunionPlan.home.x * T + T / 2, y: reunionPlan.home.y * T + T / 2 };
  }

  function startReunion(reunionPlan: ReunionPlan): void {
    plan = reunionPlan;
    reunion = 0;
    busy = true;
    keys.clear();
    sound(() => whoosh(0.8));
  }

  function reunionSeconds(reunionPlan: ReunionPlan): number {
    return reunionPlan.script.reduce((sum, step) => sum + step.seconds, 0);
  }

  // Which line of the reunion is playing now.
  function reunionStep(): ReunionPlan["script"][number] {
    let start = 0;
    for (const step of plan!.script) {
      if (reunion < start + step.seconds) return step;
      start += step.seconds;
    }
    return plan!.script[plan!.script.length - 1]!;
  }

  // When the celebration part of a reunion is over.
  function partyOver(reunionPlan: ReunionPlan): number {
    let end = 0;
    for (const step of reunionPlan.script) {
      end += step.seconds;
      if (step.who === "party") return end;
    }
    return end;
  }

  // Bubbles and spores float up instead of falling.
  function floaty(reunionPlan: ReunionPlan): boolean {
    return reunionPlan.party.things === "bubbles" || reunionPlan.party.things === "spores";
  }

  function partying(): boolean {
    return reunion >= 0 && plan !== null && reunionStep().who === "party";
  }

  function updateReunion(dt: number): void {
    const reunionPlan = plan!;
    const before = reunionStep();
    reunion += dt;
    const step = reunionStep();
    const home = homeSpot(reunionPlan);
    if (visitor) {
      // The survivor walks over to stand right next to their family.
      visitor.until = time + 10;
      visitor.x += (home.x - visitor.x) * Math.min(1, dt * 3);
      visitor.y += (home.y - visitor.y) * Math.min(1, dt * 3);
    }
    if (step !== before) sound(() => (step.who === "party" ? chime() : bleep(step.who === "family" ? 0 : 4)));
    if (step.who === "party" && Math.random() < dt * 30) {
      const family = familySpot(reunionPlan);
      const colors = reunionPlan.party.colors;
      const sparks = reunionPlan.party.things === "sparks";
      confetti.push({
        x: (family.x + home.x) / 2 + (Math.random() - 0.5) * (sparks ? 40 : 140),
        y: family.y - (sparks ? 20 : 70),
        vx: (Math.random() - 0.5) * 160,
        vy: sparks ? -180 - Math.random() * 160 : floaty(reunionPlan) ? -40 - Math.random() * 40 : -60 - Math.random() * 120,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        life: 2.5,
        spin: Math.random() * Math.PI,
      });
    }
    for (let index = confetti.length - 1; index >= 0; index -= 1) {
      const bit = confetti[index]!;
      bit.vy += (plan && floaty(plan) ? -15 : plan?.party.things === "feathers" ? 25 : 220) * dt;
      if (plan?.party.things === "feathers") bit.x += Math.sin(time * 2 + bit.spin) * 40 * dt;
      if (plan?.party.things === "spores") bit.x += Math.sin(time * 3 + bit.spin) * 20 * dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      bit.spin += dt * 6;
      bit.life -= dt;
      if (bit.life <= 0) confetti.splice(index, 1);
    }
    if (reunion >= reunionSeconds(reunionPlan)) finishReunion(reunionPlan);
  }

  function finishReunion(reunionPlan: ReunionPlan): void {
    reunion = -1;
    plan = null;
    confetti.length = 0;
    visitor = null;
    busy = false;
    save.reunited.push(reunionPlan.id);
    reunionPlan.reward(save);
    sound(() => chime());
    // Everyone from the Matrix is home: a bonus for the Matrix Hero.
    const everyone = reunionPlan.id !== "owls" && MATRIX_REUNIONS.every((r) => save.reunited.includes(r.id));
    if (everyone) save.gems += 100;
    say(everyone ? `${reunionPlan.rewardSays} 🏆 EVERY SURVIVOR IS HOME! You're a MATRIX HERO! +100 bonus gems!` : reunionPlan.rewardSays);
    renderHud();
    persist();
  }

  // --- The strange map ----------------------------------------------------

  function openStrangeMap(): void {
    if (!save.strangeMap) {
      say("You don't have a map. Maybe someone in the Purple Woods is hiding one...");
      return;
    }
    busy = true;
    keys.clear();
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="strange-map">
        <h2>The Strange Map</h2>
        <canvas width="${MAP_W * 5}" height="${MAP_H * 5}" aria-label="A map of the whole world with a red X on it"></canvas>
        <p>X marks the spot... Stand on it and see what happens. <b>Press O to close.</b></p>
      </div>
    `;
    const mini = overlay.querySelector("canvas")!.getContext("2d")!;
    const colors: Partial<Record<Tile, string>> = {
      ".": "#c9b98a", ",": "#b6a3c9", "#": "#6f7d4a", "%": "#7a5c8f", "=": "#e8d9b0", "~": "#7fa7b8",
      H: "#9c5a3c", f: "#8a6a3a", W: "#6b6158", c: "#8d8275", R: "#4f463e", o: "#3a332c", S: "#4f463e",
      Y: "#4f463e", p: "#d6cdb5", P: "#7a5c8f", q: "#bfaed6",
    };
    for (let ty = 0; ty < MAP_H; ty += 1) {
      for (let tx = 0; tx < MAP_W; tx += 1) {
        mini.fillStyle = tx >= BADLANDS_X && !save.badlands ? "#3a332c" : (colors[map[ty]![tx]!] ?? "#c9b98a");
        mini.fillRect(tx * 5, ty * 5, 5, 5);
      }
    }
    // The X, drawn on in red ink.
    const xx = MATRIX_X.x * 5 + 2.5;
    const xy = MATRIX_X.y * 5 + 2.5;
    mini.strokeStyle = "#c0262c";
    mini.lineWidth = 3;
    mini.lineCap = "round";
    mini.beginPath();
    mini.moveTo(xx - 9, xy - 9);
    mini.lineTo(xx + 9, xy + 9);
    mini.moveTo(xx + 9, xy - 9);
    mini.lineTo(xx - 9, xy + 9);
    mini.stroke();
    // You are here.
    mini.fillStyle = "#202029";
    mini.beginPath();
    mini.arc((olly.x / T) * 5, (olly.y / T) * 5, 4, 0, Math.PI * 2);
    mini.fill();
    mini.fillStyle = "#202029";
    mini.font = "bold 11px sans-serif";
    mini.fillText("you", (olly.x / T) * 5 + 6, (olly.y / T) * 5 + 4);
  }

  // Spikes go up and down on their own beat, each a little different.
  function spikesUp(tx: number, ty: number): boolean {
    return (time + (hash(tx, ty) % 20) / 10) % 2 < 0.8;
  }

  function spikeUnderOlly(castle: SkyCastle): boolean {
    const tx = Math.floor(olly.x / T);
    const ty = Math.floor(olly.y / T);
    return castle.spikes.some(([x, y]) => x === tx && y === ty && spikesUp(x, y));
  }

  // --- Space: talk, open, feed, pull ---------------------------------------

  function interact(): void {
    const near = (tx: number, ty: number, reach = 46): boolean => Math.hypot(tx * T + T / 2 - olly.x, ty * T + T / 2 - olly.y) < reach;

    if (useHatchOrLadder()) return;
    if (save.teleporter && (nearSpot(TELEPORTER) || nearSpot(BADLANDS_PAD))) {
      teleport();
      return;
    }
    if (nearSpot(OWL_HIDEOUT) && hootieInHideout()) {
      talkToHidingOwl();
      return;
    }
    const oldOwl = NPCS.find((n) => n.id === "owl")!;
    if (save.carryingHootie && near(oldOwl.tx, oldOwl.ty, 60)) {
      bringHootieHome();
      return;
    }
    if (Math.hypot(METAL_BOX.x * T + T / 2 - olly.x, METAL_BOX.y * T + T / 2 - olly.y) < 46) {
      useMetalBox();
      return;
    }
    // Survivors who moved in have things to say (when Olly is closer to them
    // than to the shop next door).
    for (const resident of movedIn()) {
      const home = homeSpot(resident);
      const family = familySpot(resident);
      const distance = Math.hypot(home.x - olly.x, home.y - olly.y);
      if (distance < 46 && distance < Math.hypot(family.x - olly.x, family.y - olly.y)) {
        say(`${resident.visitor}: ${resident.talk[Math.floor(Math.random() * resident.talk.length)]}`);
        sound(() => bleep(4));
        return;
      }
    }
    const npc = NPCS.find((n) => near(n.tx, n.ty));
    if (npc) {
      openShop(npc.id);
      return;
    }
    const chest = CHESTS.find((c) => near(c.tx, c.ty) && !save.opened.includes(c.id) && chestHere(c));
    if (chest) {
      openChest(chest);
      return;
    }
    if (!save.crystal && near(CRYSTAL_TILE.x, CRYSTAL_TILE.y)) {
      pullCrystal();
      return;
    }
    if (!save.treeCut && near(PURPLE_TREE.x, PURPLE_TREE.y)) {
      if (!save.saw) {
        say("This tree is purple for some reason. It's way too strong to push. Maybe you could cut it with something...");
        return;
      }
      save.treeCut = true;
      map[PURPLE_TREE.y]![PURPLE_TREE.x] = "=";
      treeFall = 0;
      sound(() => crack());
      say("You sawed down the purple tree! There's a whole new land behind it: the Purple Woods!");
      persist();
      return;
    }
    const pig = pigs.find((p) => !save.following.includes(p.id) && Math.hypot(p.x - olly.x, p.y - olly.y) < 46);
    if (pig) {
      if (save.food <= 0) {
        say("This pig looks hungry, but you have no pig food. Farmer Fern sells some in the village!");
        return;
      }
      save.food -= 1;
      save.following.push(pig.id);
      sound(() => chime());
      say(`Om nom! The pig is following you now. Pigs give you +${Math.round(save.following.length * pigBonus() * 100)}% health in fights!`);
      renderHud();
      persist();
    }
  }

  function openChest(chest: (typeof CHESTS)[number]): void {
    const loot = chest.loot;
    save.opened.push(chest.id);
    save.gems += loot.gems ?? 0;
    save.potions += loot.potions ?? 0;
    save.chaos += loot.chaos ?? 0;
    if (loot.armor && loot.armor > save.armor) save.armor = loot.armor;
    if (loot.sword && loot.sword > save.sword) save.sword = loot.sword;
    if (loot.saw) save.saw = true;
    if (loot.strangeMap) save.strangeMap = true;
    if (loot.crown) save.crown = true;
    save.megaPotions += loot.megaPotions ?? 0;
    sound(() => chime());
    say(`Treasure! ${loot.says}`);
    renderHud();
    persist();
    checkPurpleCastle();
  }

  function pullCrystal(): void {
    save.crystal = true;
    crystalDrop = 0;
    openSecretRoom();
    sound(() => crack());
    say("You pulled the crystal down... a secret room opened in the wall!");
    persist();
  }

  // --- Chaos orbs -------------------------------------------------------------

  function useChaos(): void {
    if (save.chaos <= 0) {
      say("No chaos orbs. Jester Zig sells them in the village!");
      return;
    }
    save.chaos -= 1;
    const effects: Chaos[] = ["pigParty", "upsideDown", "gemRain", "tiny", "zoomies"];
    const effect = effects[Math.floor(Math.random() * effects.length)]!;
    sound(() => whoosh(0.8));
    if (effect === "pigParty") {
      chaos.set(effect, time + 6);
      say("🌀 CHAOS! Pig party! Every pig is spinning!");
    } else if (effect === "upsideDown") {
      chaos.set(effect, time + 5);
      say("🌀 CHAOS! The whole world flipped upside down!");
    } else if (effect === "gemRain") {
      for (let index = 0; index < 10; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 90;
        const x = olly.x + Math.cos(angle) * distance;
        const y = olly.y + Math.sin(angle) * distance;
        if (!blocked(x, y, 6)) pickups.push({ id: `rain-${rainCount++}`, x, y, keep: false });
      }
      say("🌀 CHAOS! It's raining gems! Grab them!");
    } else if (effect === "tiny") {
      chaos.set(effect, time + 30);
      say("🌀 CHAOS! Every enemy shrank! They have half health for 30 seconds.");
    } else {
      chaos.set(effect, time + 8);
      say("🌀 CHAOS! Zoomies! Olly is super fast!");
    }
    renderHud();
    persist();
  }

  // --- Shops ----------------------------------------------------------------

  function openShop(id: ShopId): void {
    const npc = NPCS.find((n) => n.id === id)!;
    busy = true;
    keys.clear();
    const draw = (note = ""): void => {
      overlay.innerHTML = `
        <div class="shop-card">
          <div class="shop-head">
            <img src="${spriteImage(npc.art).src}" alt="" />
            <div><strong>${npc.name}</strong><p>${id === "owl" ? owlSays() : npc.hello}</p></div>
          </div>
          <p class="shop-gems"><img src="${spriteImage(GEM).src}" alt="" /> You have ${save.gems} gems</p>
          <div class="shop-items">
            ${SHOPS[id]
              .map((item, index) => {
                const can = item.canBuy(save);
                return `<button type="button" data-item="${index}" ${!can || save.gems < item.price ? "disabled" : ""}>
                  <span>${item.label}</span><b>${item.costLabel ? item.costLabel : can ? `${item.price} gems` : "Got it!"}</b>
                </button>`;
              })
              .join("")}
          </div>
          ${note ? `<p class="shop-note">${note}</p>` : ""}
          <button class="big-button light" type="button" data-close>Bye!</button>
        </div>
      `;
      for (const button of overlay.querySelectorAll<HTMLButtonElement>("[data-item]")) {
        button.addEventListener("click", () => {
          const item = SHOPS[id][Number(button.dataset["item"])]!;
          if (save.gems < item.price || !item.canBuy(save)) return;
          save.gems -= item.price;
          item.buy(save);
          sound(() => chime());
          renderHud();
          persist();
          draw(`Thanks! You got: ${item.label}.`);
          checkPurpleCastle();
        });
      }
      overlay.querySelector("[data-close]")!.addEventListener("click", closeOverlay);
      overlay.querySelector<HTMLButtonElement>("[data-close]")!.focus();
    };
    overlay.hidden = false;
    draw();
  }

  function closeOverlay(): void {
    overlay.hidden = true;
    overlay.innerHTML = "";
    busy = false;
    canvas.focus();
  }

  // --- Fights -----------------------------------------------------------------

  function startFight(kind: EnemyKind, enemy: Enemy | null): void {
    busy = true;
    keys.clear();
    const foe = ENEMY_KINDS[kind];
    const foeMax = chaos.has("tiny") ? Math.ceil(foe.hp / 2) : foe.hp;
    let foeHp = foeMax;
    const ollyMax = maxHealth();
    let ollyHp = ollyMax;
    let current = api.newQuestion();
    let locked = false;
    sound(() => boom(0.6));

    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="fight-card">
        <div class="battle" id="battle">
          <div class="fighter hero">
            ${ollyLook(save.wearing)}
            <span class="hp"><span id="olly-hp"></span></span>
            <small id="olly-hp-text"></small>
          </div>
          <span class="vs">VS</span>
          <div class="fighter monster" id="foe">
            <img class="monster-icon foe-art" src="${spriteImage(foe.art).src}" alt="" />
            <strong>${foe.name}</strong>
            <span class="hp"><span id="foe-hp"></span></span>
          </div>
        </div>
        <p class="fight-msg" id="fight-msg">${kind === "arrow" ? "An arrow hit you! Now you have to fight it. Don't ask why." : `A ${foe.name} blocks the way!`}</p>
        <div class="equation" id="fight-question"></div>
        <form class="fight-form" autocomplete="off">
          <input class="answer-box" id="fight-answer" inputmode="numeric" maxlength="4" placeholder="?" aria-label="Your answer" />
          <span class="remainder" id="fight-remainder-wrap">
            <span class="r" aria-hidden="true">R</span>
            <input class="answer-box" id="fight-remainder" inputmode="numeric" maxlength="3" placeholder="0" aria-label="Remainder" />
          </span>
          <button class="big-button" type="submit">⚔️ Attack!</button>
        </form>
        <div class="fight-tools">
          <button type="button" class="text-link" data-potion>🧪 Drink a potion (${save.potions})</button>
          ${save.megaPotions ? `<button type="button" class="text-link" data-mega>⚗️ Mega potion (${save.megaPotions})</button>` : ""}
          <button type="button" class="text-link" data-hint>A little hint?</button>
          ${save.following.length ? `<span class="pig-bonus"><img src="${spriteImage(PIG).src}" alt="" /> ${save.following.length} pig${save.following.length === 1 ? "" : "s"}: +${Math.round(save.following.length * pigBonus() * 100)}% health</span>` : ""}
        </div>
      </div>
    `;
    const battle = overlay.querySelector<HTMLElement>("#battle")!;
    const foeBox = overlay.querySelector<HTMLElement>("#foe")!;
    const message = overlay.querySelector<HTMLElement>("#fight-msg")!;
    const questionBox = overlay.querySelector<HTMLElement>("#fight-question")!;
    const answerInput = overlay.querySelector<HTMLInputElement>("#fight-answer")!;
    const remainderInput = overlay.querySelector<HTMLInputElement>("#fight-remainder")!;
    const remainderWrap = overlay.querySelector<HTMLElement>("#fight-remainder-wrap")!;
    const potionButton = overlay.querySelector<HTMLButtonElement>("[data-potion]")!;
    const megaButton = overlay.querySelector<HTMLButtonElement>("[data-mega]");

    const showBars = (): void => {
      overlay.querySelector<HTMLElement>("#olly-hp")!.style.width = `${(ollyHp / ollyMax) * 100}%`;
      overlay.querySelector<HTMLElement>("#olly-hp-text")!.textContent = `${ollyHp} / ${ollyMax}`;
      overlay.querySelector<HTMLElement>("#foe-hp")!.style.width = `${(foeHp / foeMax) * 100}%`;
      potionButton.textContent = `🧪 Drink a potion (${save.potions})`;
      potionButton.disabled = save.potions <= 0 || ollyHp >= ollyMax;
      if (megaButton) {
        megaButton.textContent = `⚗️ Mega potion (${save.megaPotions})`;
        megaButton.disabled = save.megaPotions <= 0 || ollyHp >= ollyMax;
      }
    };
    const showQuestion = (): void => {
      questionBox.innerHTML = `${current.text} <span class="q">= ?</span>`;
      answerInput.value = "";
      remainderInput.value = "";
      remainderWrap.hidden = !current.isDiv;
      answerInput.focus();
    };
    const replay = (name: string): void => {
      battle.classList.remove("is-attack", "is-ouch");
      void battle.offsetWidth;
      battle.classList.add(name);
    };

    for (const input of [answerInput, remainderInput]) {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
      });
    }
    answerInput.addEventListener("keydown", (event) => {
      if (current.isDiv && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        remainderInput.focus();
      }
    });
    overlay.querySelector("[data-hint]")!.addEventListener("click", () => {
      message.textContent = `💡 ${current.hint}`;
      answerInput.focus();
    });
    potionButton.addEventListener("click", () => {
      if (save.potions <= 0) return;
      save.potions -= 1;
      ollyHp = Math.min(ollyMax, ollyHp + 40);
      message.textContent = "Glug glug! Olly feels better.";
      sound(() => chime());
      showBars();
      renderHud();
      persist();
      answerInput.focus();
    });

    megaButton?.addEventListener("click", () => {
      if (save.megaPotions <= 0) return;
      save.megaPotions -= 1;
      ollyHp = ollyMax;
      message.textContent = "MEGA glug! Olly is back to full health!";
      sound(() => chime());
      showBars();
      renderHud();
      persist();
      answerInput.focus();
    });

    overlay.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      if (locked) return;
      if (answerInput.value === "") {
        message.textContent = "Type a whole number first.";
        return;
      }
      const remainder = remainderInput.value === "" ? 0 : Number(remainderInput.value);
      const correct = Number(answerInput.value) === current.answer && (!current.isDiv || remainder === current.remainder);
      api.recordAnswer(correct);
      locked = true;
      if (correct) {
        foeHp = Math.max(0, foeHp - save.sword);
        replay("is-attack");
        sound(() => chime());
        message.textContent = foeHp > 0 ? `Hit! ${foe.name} took ${save.sword} damage.` : `${foe.name} is beaten!`;
      } else {
        ollyHp = Math.max(0, ollyHp - foe.damage);
        replay("is-ouch");
        sound(() => boing());
        message.textContent = `Ouch! It was ${current.text} = ${current.answer}${current.isDiv ? ` R${current.remainder}` : ""}.`;
      }
      if (kind === "poisonArrow" && foeHp > 0 && ollyHp > 0) {
        ollyHp = Math.max(0, ollyHp - 5);
        message.textContent += " ☠️ Poison: -5!";
      }
      foeBox.classList.toggle("is-beaten", foeHp === 0);
      showBars();
      window.setTimeout(() => {
        if (foeHp === 0) endFight(true);
        else if (ollyHp === 0) endFight(false);
        else {
          locked = false;
          current = api.newQuestion();
          showQuestion();
        }
      }, foeHp === 0 ? 1100 : 900);
    });

    const endFight = (won: boolean): void => {
      if (won) {
        save.gems += foe.reward;
        if (enemy) {
          save.defeated.push(enemy.id);
          enemies.splice(enemies.indexOf(enemy), 1);
        }
        say(`You beat the ${foe.name}! +${foe.reward} gems.`);
        if (enemy && CASTLE_ENEMIES.some((e) => e.id === enemy.id) && !save.landed && CASTLE_ENEMIES.every((e) => save.defeated.includes(e.id))) {
          // Both castles cleared: something is falling out of the sky...
          dropSkyCastle(SKY_CASTLES[0]!, "Both castles cleared! Something is falling from the sky...");
        } else {
          checkPurpleCastle();
        }
      } else {
        // Olly runs back to the village to rest. The enemy stays.
        olly.x = START.x * T + T / 2;
        olly.y = START.y * T + T / 2;
        trail.length = 0;
        say(`The ${foe.name} was too strong this time. Olly ran back to the village to rest!`);
      }
      safeFor = 2;
      renderHud();
      persist();
      closeOverlay();
    };

    showBars();
    showQuestion();
  }

  function dropSkyCastle(castle: SkyCastle, message: string): void {
    falling = 0;
    fallingCastle = castle;
    watching = castle;
    sound(() => whoosh(3));
    say(message);
  }

  function landSkyCastle(castle: SkyCastle): void {
    falling = -1;
    fallingCastle = null;
    if (castle.id === "sky") save.landed = true;
    else save.purpleLanded = true;
    shake = 1.2;
    sound(() => boom(castle.poison ? 2 : 1.4));
    // Don't leave Olly stuck inside a wall: put him outside the gate.
    if (plazaWall(Math.floor(olly.x / T), Math.floor(olly.y / T))) {
      olly.x = castle.gate.x * T + T / 2;
      olly.y = (castle.gate.y + (castle.gate.y === castle.plaza.y ? -1 : 1)) * T + T / 2;
    }
    say(
      castle.poison
        ? "A HUGE PURPLE SKY CASTLE crashed into the woods! Spike traps, and the arrows are POISON. Good luck..."
        : "A SKY CASTLE landed in the middle of the map! Dodge the arrows and find what's at the top."
    );
    persist();
  }

  // What's still needed before the purple sky castle drops: one of everything,
  // everybody beaten, and every chest opened.
  function purpleMissing(): string[] {
    const missing: string[] = [];
    const items: [string, boolean][] = [
      ["pig food", save.food >= 1],
      ["a potion", save.potions >= 1],
      ["a chaos orb", save.chaos >= 1],
      ["a mega potion", save.megaPotions >= 1],
      ["speedy boots", save.boots],
      ["pig armor", save.pigArmor],
      ["a shield", save.shield],
      ["the Diamond Sword", save.sword >= 5],
      ["Shadow Armor", save.armor >= 150],
    ];
    for (const [name, has] of items) if (!has) missing.push(name);
    const left = ENEMY_START.filter((e) => !save.defeated.includes(e.id));
    if (left.length) missing.push(`beat ${left.length} more ${left.length === 1 ? "enemy" : "enemies"}`);
    const closed = CHESTS.filter((c) => c.id !== "purple" && !save.opened.includes(c.id));
    if (closed.length) missing.push(`open ${closed.length} more treasure ${closed.length === 1 ? "chest" : "chests"}`);
    return missing;
  }

  function owlSays(): string {
    if (save.reunited.includes("owls")) return "Hoo hoo! My little sister is HOME! Best. Day. Ever.";
    if (save.foundOwl) return "Hoo?! A little owl named HOOTIE, hiding in the BADLANDS? ...My little sister?! I thought she was gone forever!";
    // Everyone else got their family back. Old Owl doesn't have any.
    if (MATRIX_REUNIONS.every((r) => save.reunited.includes(r.id))) return "*sigh*... I wish I had a sibling.";
    if (save.purpleLanded) return "Hoo! The purple sky castle is here. Watch out for the poison arrows!";
    const missing = purpleMissing();
    return `Hoo hoo. Legend says a purple castle waits in the sky over these woods. It comes down for someone with one of everything, who has beaten everybody and opened every chest. You still need: ${missing.join(", ")}.`;
  }

  function checkPurpleCastle(): void {
    if (save.purpleLanded || falling >= 0 || purpleMissing().length) return;
    dropSkyCastle(SKY_CASTLES[1]!, "You have one of everything, beat everybody and opened every chest... the sky is turning PURPLE!");
  }

  // --- Drawing ----------------------------------------------------------------

  function inSecretRoom(tx: number, ty: number): boolean {
    return tx >= SECRET_ROOM.x && tx < SECRET_ROOM.x + SECRET_ROOM.w && ty >= SECRET_ROOM.y && ty < SECRET_ROOM.y + SECRET_ROOM.h;
  }

  function hash(x: number, y: number): number {
    return ((x * 73856093) ^ (y * 19349663)) >>> 0;
  }

  function drawTile(tile: Tile, tx: number, ty: number, px: number, py: number): void {
    const h = hash(tx, ty);
    const grass = (): void => {
      ctx.fillStyle = h % 2 ? "#8fd16a" : "#89cc64";
      ctx.fillRect(px, py, T, T);
      if (h % 23 === 0) {
        ctx.fillStyle = h % 3 ? "#fff6a8" : "#ffb3c7";
        ctx.beginPath();
        ctx.arc(px + 10 + (h % 12), py + 12 + (h % 9), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const purpleGrass = (): void => {
      ctx.fillStyle = h % 2 ? "#b9a6e3" : "#b29ddd";
      ctx.fillRect(px, py, T, T);
      if (h % 29 === 0) {
        // A tiny red mushroom.
        ctx.fillStyle = "#f4f1e8";
        ctx.fillRect(px + 14, py + 16, 4, 7);
        ctx.fillStyle = "#e5383b";
        ctx.beginPath();
        ctx.arc(px + 16, py + 16, 6, Math.PI, 0);
        ctx.fill();
      }
    };
    switch (tile) {
      case ".":
        grass();
        break;
      case "#":
        grass();
        ctx.fillStyle = "#7a5426";
        ctx.fillRect(px + 13, py + 18, 6, 12);
        ctx.fillStyle = "#3f8f3a";
        ctx.beginPath();
        ctx.arc(px + 16, py + 13, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4ea446";
        ctx.beginPath();
        ctx.arc(px + 12, py + 10, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "=":
        ctx.fillStyle = "#e3cf9a";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#d4bd82";
        ctx.fillRect(px + (h % 20) + 4, py + (h % 17) + 6, 3, 3);
        break;
      case "~":
        ctx.fillStyle = "#5bb6e6";
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = "#a9dcf5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + 6, py + 16 + Math.sin(time * 2 + tx) * 2);
        ctx.quadraticCurveTo(px + 12, py + 11, px + 18, py + 16 + Math.sin(time * 2 + tx) * 2);
        ctx.stroke();
        break;
      case "H": {
        const roof = map[ty - 1]?.[tx] !== "H";
        ctx.fillStyle = roof ? "#c0453a" : "#d9a066";
        ctx.fillRect(px, py, T, T);
        if (roof) {
          ctx.fillStyle = "#a3362c";
          for (let row = 4; row < T; row += 8) ctx.fillRect(px, py + row, T, 2);
        } else {
          ctx.fillStyle = h % 2 ? "#8ad0f0" : "#7a4b25";
          ctx.fillRect(px + 9, py + (h % 2 ? 8 : 10), 14, h % 2 ? 12 : 22);
        }
        break;
      }
      case "f":
        grass();
        ctx.fillStyle = "#a6763f";
        ctx.fillRect(px, py + 10, T, 4);
        ctx.fillRect(px, py + 20, T, 4);
        ctx.fillRect(px + 4, py + 6, 5, 22);
        ctx.fillRect(px + 22, py + 6, 5, 22);
        break;
      case "W":
        ctx.fillStyle = "#8d8f99";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#6f717b";
        ctx.fillRect(px, py + 15, T, 2);
        ctx.fillRect(px + (ty % 2 ? 8 : 20), py, 2, 15);
        ctx.fillRect(px + (ty % 2 ? 20 : 8), py + 17, 2, 15);
        break;
      case "c":
        ctx.fillStyle = (tx + ty) % 2 ? "#6c6e78" : "#666872";
        ctx.fillRect(px, py, T, T);
        break;
      case "R":
      case "S":
      case "Y":
        ctx.fillStyle = "#4b4249";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#5c5159";
        ctx.fillRect(px + (h % 14) + 2, py + (h % 11) + 3, 10, 6);
        if (tile === "S") {
          ctx.strokeStyle = "#3a3238";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 4);
          ctx.lineTo(px + 14, py + 16);
          ctx.lineTo(px + 10, py + 28);
          ctx.stroke();
        }
        break;
      case "o":
        ctx.fillStyle = "#2a2329";
        ctx.fillRect(px, py, T, T);
        break;
      case ",":
        purpleGrass();
        break;
      case "%":
        purpleGrass();
        ctx.fillStyle = "#5a3d6e";
        ctx.fillRect(px + 13, py + 18, 6, 12);
        ctx.fillStyle = "#7a4fd6";
        ctx.beginPath();
        ctx.arc(px + 16, py + 13, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#9b74ea";
        ctx.beginPath();
        ctx.arc(px + 12, py + 10, 6, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "U": {
        // The weird mushroom: upside down, flickering wrong colors.
        purpleGrass();
        const flicker = Math.floor(time * 12) % 3;
        ctx.fillStyle = flicker === 0 ? "#00e5ff" : flicker === 1 ? "#ff2bd6" : "#d8f361";
        ctx.beginPath();
        ctx.arc(px + 16, py + 20, 11, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = "#f4f1e8";
        ctx.fillRect(px + 13, py + 6, 6, 14);
        ctx.fillStyle = "#202029";
        ctx.fillRect(px + 8 + ((time * 40) % 16), py + 22, 4, 2);
        break;
      }
      case "h":
        // The bunker hatch.
        purpleGrass();
        ctx.fillStyle = "#5d6472";
        ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
        ctx.strokeStyle = "#2b2f38";
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, T - 8, T - 8);
        ctx.beginPath();
        ctx.arc(px + 16, py + 16, 5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "M":
        ctx.fillStyle = "#3d4250";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#4f5566";
        ctx.fillRect(px + 2, py + 2, T - 4, 3);
        ctx.fillStyle = "#2b2f38";
        ctx.fillRect(px + 4, py + 24, 3, 3);
        ctx.fillRect(px + 25, py + 24, 3, 3);
        break;
      case "k":
        ctx.fillStyle = (tx + ty) % 2 ? "#5d6472" : "#565c6a";
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = "#4b505d";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
        break;
      case "L":
        ctx.fillStyle = "#565c6a";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#c9a35a";
        ctx.fillRect(px + 7, py, 4, T);
        ctx.fillRect(px + 21, py, 4, T);
        for (let rung = 4; rung < T; rung += 8) ctx.fillRect(px + 7, py + rung, 18, 3);
        break;
      case "b":
      case "D": {
        ctx.fillStyle = tile === "D" ? "#e0a070" : h % 2 ? "#c8643c" : "#c25e38";
        ctx.fillRect(px, py, T, T);
        if (tile === "b" && h % 7 === 0) {
          // A crack in the dry ground.
          ctx.strokeStyle = "#8e3f22";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 10);
          ctx.lineTo(px + 14, py + 16);
          ctx.lineTo(px + 12, py + 24);
          ctx.stroke();
        }
        break;
      }
      case "Z":
        // Striped cliff rock.
        ctx.fillStyle = "#9c3f22";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#c86a3c";
        ctx.fillRect(px, py + 6, T, 5);
        ctx.fillStyle = "#7a2f18";
        ctx.fillRect(px, py + 20, T, 4);
        break;
      case "B":
        ctx.fillStyle = h % 2 ? "#c8643c" : "#c25e38";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = "#6e3a24";
        ctx.beginPath();
        ctx.arc(px + 16, py + 18, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8a4a2e";
        ctx.beginPath();
        ctx.arc(px + 12, py + 13, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "!": {
        // Bubbling lava.
        const glow = 0.5 + Math.sin(time * 3 + tx + ty) * 0.5;
        ctx.fillStyle = "#e5480f";
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = `rgba(255, 210, 0, ${0.4 + glow * 0.4})`;
        ctx.beginPath();
        ctx.arc(px + 10 + (h % 12), py + 12 + (h % 9), 4 + glow * 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "A": {
        // An adobe house: clay walls, a flat roof, a dark doorway.
        const roof = map[ty - 1]?.[tx] !== "A";
        ctx.fillStyle = roof ? "#b5653a" : "#d99a6c";
        ctx.fillRect(px, py, T, T);
        if (roof) {
          ctx.fillStyle = "#8e4a28";
          ctx.fillRect(px, py + T - 6, T, 6);
        } else if (h % 2) {
          ctx.fillStyle = "#3a2018";
          ctx.fillRect(px + 10, py + 8, 12, 24);
        }
        break;
      }
      case "P":
        // The one purple tree in the wall of green ones. It glows a little.
        grass();
        ctx.save();
        ctx.shadowColor = "#c59bff";
        ctx.shadowBlur = 10 + Math.sin(time * 3) * 5;
        ctx.fillStyle = "#5a3d6e";
        ctx.fillRect(px + 13, py + 18, 6, 12);
        ctx.fillStyle = "#9b4fe0";
        ctx.beginPath();
        ctx.arc(px + 16, py + 13, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#c59bff";
        ctx.beginPath();
        ctx.arc(px + 11, py + 9, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "p":
      case "q": {
        const castle = SKY_CASTLES.find((c) => c.tile === tile)!;
        const landed = isLanded(castle);
        const wall = plazaWall(tx, ty);
        ctx.fillStyle = landed ? (wall ? castle.colors.wall : castle.colors.floor) : castle.colors.before;
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = landed ? castle.colors.trim : "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = landed && !wall ? 0.35 : 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
        ctx.globalAlpha = 1;
        if (wall) {
          ctx.fillStyle = castle.colors.trim;
          ctx.fillRect(px, py + 15, T, 2);
        }
        break;
      }
    }
  }

  function drawSprite(art: string, x: number, y: number, size: number, flip = false, spin = 0): void {
    const image = spriteImage(art);
    if (!image.complete) return;
    ctx.save();
    ctx.translate(x, y);
    if (spin) ctx.rotate(spin);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // A swirling round pad.
  function drawTeleporter(at: { x: number; y: number }, colors: [string, string]): void {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.fillStyle = "#2b2236";
    ctx.beginPath();
    ctx.ellipse(0, 4, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(time * 3);
    ctx.lineWidth = 3;
    colors.forEach((color, index) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + index * 5, index * Math.PI, index * Math.PI + Math.PI * 1.4);
      ctx.stroke();
    });
    ctx.restore();
  }

  // The vault's beam of light coming down from the sky onto the teleporter.
  function drawBeamDown(camX: number, camY: number): void {
    const at = tileCenter(TELEPORTER);
    const x = at.x - camX;
    const bottom = at.y - camY;
    const reach = Math.min(1, beamDown / 0.7);
    const width = 30 + Math.sin(time * 30) * 6 + (beamDown < 1 ? 60 * (1 - beamDown) : 0);
    const beam = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, 0);
    beam.addColorStop(0, "rgba(0, 229, 255, 0)");
    beam.addColorStop(0.5, "rgba(255, 255, 255, 0.95)");
    beam.addColorStop(1, "rgba(0, 229, 255, 0)");
    ctx.fillStyle = beam;
    ctx.fillRect(x - width / 2, 0, width, bottom * reach);
    if (beamDown > 0.7 && beamDown < 1.5) {
      ctx.fillStyle = `rgba(255, 255, 255, ${1 - (beamDown - 0.7) / 0.8})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  // From far away the glitch is just a blurry smudge. Up close it's broken
  // pixels and flickering colors.
  function drawGlitch(): void {
    const { x, y } = glitchThing;
    const near = Math.hypot(x - olly.x, y - olly.y) < 160;
    ctx.save();
    if (!near) {
      ctx.filter = "blur(4px)";
      ctx.fillStyle = "rgba(120, 110, 140, 0.8)";
      ctx.beginPath();
      ctx.arc(x, y, 12 + Math.sin(time * 9) * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "none";
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("?", x - 4, y + 5);
    } else {
      const jitter = (): number => (Math.random() - 0.5) * 6;
      for (const [color, offset] of [["#00e5ff", -3], ["#ff2bd6", 3], ["#202029", 0]] as const) {
        ctx.fillStyle = color;
        ctx.globalAlpha = color === "#202029" ? 1 : 0.8;
        ctx.fillRect(x - 12 + offset + jitter(), y - 14 + jitter(), 24, 22);
      }
      ctx.globalAlpha = 1;
      for (let block = 0; block < 6; block += 1) {
        ctx.fillStyle = ["#d8f361", "#ffffff", "#00e5ff", "#ff2bd6"][block % 4]!;
        ctx.fillRect(x - 18 + Math.random() * 32, y - 20 + Math.random() * 34, 3 + Math.random() * 6, 2 + Math.random() * 3);
      }
      ctx.fillStyle = "#d8f361";
      ctx.fillRect(x - 7 + jitter() / 2, y - 7, 4, 4);
      ctx.fillRect(x + 3 + jitter() / 2, y - 7, 4, 4);
    }
    ctx.restore();
  }

  function drawMetalBox(): void {
    const x = METAL_BOX.x * T + T / 2;
    const y = METAL_BOX.y * T + T / 2;
    ctx.save();
    ctx.fillStyle = "#8d94a3";
    ctx.strokeStyle = "#3d4250";
    ctx.lineWidth = 2;
    const lift = save.boxOpened ? Math.min(1, boxOpening < 0 ? 1 : boxOpening / 1.2) * 14 : 0;
    ctx.fillRect(x - 15, y - 10, 30, 22);
    ctx.strokeRect(x - 15, y - 10, 30, 22);
    // The lid lifts once the glitch is inside.
    ctx.fillStyle = "#a3aab8";
    ctx.fillRect(x - 16, y - 16 - lift, 32, 7);
    ctx.strokeRect(x - 16, y - 16 - lift, 32, 7);
    if (save.boxOpened) {
      ctx.fillStyle = Math.floor(time * 10) % 2 ? "#00e5ff" : "#ff2bd6";
      ctx.globalAlpha = 0.6 + Math.sin(time * 6) * 0.3;
      ctx.fillRect(x - 12, y - 10, 24, 6);
    } else {
      // The glitch-shaped hole.
      ctx.fillStyle = "#202029";
      ctx.fillRect(x - 6, y - 4, 4, 8);
      ctx.fillRect(x - 2, y - 1, 6, 3);
      ctx.fillRect(x + 2, y - 5, 4, 9);
    }
    ctx.restore();
  }

  function drawSkyCastle(castle: SkyCastle, cx: number, bottom: number): void {
    const { plaza, colors } = castle;
    const scale = 1;
    const w = plaza.w * T * scale;
    const h = plaza.h * T * scale;
    const left = cx - w / 2;
    const top = bottom - h;
    ctx.fillStyle = colors.wall;
    ctx.strokeStyle = colors.trim;
    ctx.lineWidth = 3;
    ctx.fillRect(left, top + h * 0.25, w, h * 0.75);
    ctx.strokeRect(left, top + h * 0.25, w, h * 0.75);
    for (const towerX of [left - 10, left + w - 40, left + w / 2 - 25]) {
      ctx.fillStyle = colors.wall;
      ctx.fillRect(towerX, top, 50, h * 0.6);
      ctx.strokeRect(towerX, top, 50, h * 0.6);
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.moveTo(towerX - 6, top);
      ctx.lineTo(towerX + 25, top - 40);
      ctx.lineTo(towerX + 56, top);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = colors.door;
    ctx.fillRect(cx - 22, bottom - 60 * scale, 44, 60 * scale);
  }

  function draw(): void {
    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    if (chaos.has("upsideDown")) {
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
    }
    // The camera follows Olly, but flies over to watch the sky castle land
    // (and stays a moment to see it).
    // During a reunion the camera looks between the two of them.
    const meeting = plan ? { x: (familySpot(plan).x + homeSpot(plan).x) / 2, y: familySpot(plan).y } : null;
    const watchingSky = watching !== null || meeting !== null;
    const beamSpot = beamDown >= 0 ? tileCenter(TELEPORTER) : null;
    const targetX = watching ? (watching.plaza.x + watching.plaza.w / 2) * T : meeting ? meeting.x : beamSpot ? beamSpot.x : olly.x;
    const targetY = watching ? (watching.plaza.y + watching.plaza.h / 2) * T : meeting ? meeting.y : beamSpot ? beamSpot.y : olly.y;
    camera.x += (targetX - camera.x) * (watchingSky || camera.flying ? 0.08 : 1);
    camera.y += (targetY - camera.y) * (watchingSky || camera.flying ? 0.08 : 1);
    camera.flying = watchingSky || Math.hypot(targetX - camera.x, targetY - camera.y) > 4;
    let camX = Math.round(Math.max(0, Math.min(MAP_W * T - VIEW_W, camera.x - VIEW_W / 2)));
    let camY = Math.round(Math.max(0, Math.min(MAP_H * T - VIEW_H, camera.y - VIEW_H / 2)));
    if (shake > 0) {
      camX += Math.round((Math.random() - 0.5) * 14);
      camY += Math.round((Math.random() - 0.5) * 14);
    }
    ctx.translate(-camX, -camY);

    const firstX = Math.max(0, Math.floor(camX / T));
    const firstY = Math.max(0, Math.floor(camY / T));
    const lastX = Math.min(MAP_W - 1, Math.ceil((camX + VIEW_W) / T));
    const lastY = Math.min(MAP_H - 1, Math.ceil((camY + VIEW_H) / T));
    for (let ty = firstY; ty <= lastY; ty += 1) {
      for (let tx = firstX; tx <= lastX; tx += 1) {
        // The secret room looks like plain rock until the crystal is pulled.
        const hidden = !save.crystal && inSecretRoom(tx, ty);
        // The bunker looks like forest unless Olly is down there.
        const underground = tx >= BUNKER.x && tx < BUNKER.x + BUNKER.w && ty >= BUNKER.y && ty < BUNKER.y + BUNKER.h;
        // The Badlands and the rest of the world can't see each other.
        const otherSide = inBadlands(tx * T) !== inBadlands(olly.x);
        const tile = otherSide ? (inBadlands(olly.x) ? "Z" : "#") : hidden ? "R" : underground && !inBunker(olly.x, olly.y) ? "#" : map[ty]![tx]!;
        drawTile(tile, tx, ty, tx * T, ty * T);
      }
    }

    // The crystal, glowing in the cave wall until it's pulled down.
    const crystalX = CRYSTAL_TILE.x * T + T / 2;
    const crystalY = CRYSTAL_TILE.y * T + T / 2;
    if (!save.crystal) {
      ctx.save();
      ctx.shadowColor = "#c59bff";
      ctx.shadowBlur = 12 + Math.sin(time * 3) * 6;
      drawSprite(CRYSTAL, crystalX, crystalY, 30);
      ctx.restore();
    } else if (crystalDrop >= 0 && crystalDrop < 0.8) {
      ctx.globalAlpha = 1 - crystalDrop / 0.8;
      drawSprite(CRYSTAL, crystalX, crystalY + crystalDrop * 60, 30, false, crystalDrop * 2);
      ctx.globalAlpha = 1;
    }

    // The sawed purple tree tipping over and fading away.
    if (treeFall >= 0 && treeFall < 1.2) {
      const tx = PURPLE_TREE.x * T + 16;
      const ty = PURPLE_TREE.y * T + 30;
      ctx.save();
      ctx.globalAlpha = 1 - treeFall / 1.2;
      ctx.translate(tx, ty);
      ctx.rotate(Math.min(1, treeFall / 0.6) * (Math.PI / 2));
      ctx.fillStyle = "#5a3d6e";
      ctx.fillRect(-3, -12, 6, 12);
      ctx.fillStyle = "#9b4fe0";
      ctx.beginPath();
      ctx.arc(0, -17, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // The see-through X, only for someone who has the strange map.
    if (save.strangeMap) {
      const xx = MATRIX_X.x * T + T / 2;
      const xy = MATRIX_X.y * T + T / 2;
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(time * 2) * 0.1 + Math.min(0.5, onX / X_SECONDS);
      ctx.strokeStyle = "#e5383b";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(xx - 11, xy - 11);
      ctx.lineTo(xx + 11, xy + 11);
      ctx.moveTo(xx + 11, xy - 11);
      ctx.lineTo(xx - 11, xy + 11);
      ctx.stroke();
      ctx.restore();
      if (onX > 0) {
        // A ring filling up while Olly stands on it.
        ctx.strokeStyle = "#9b4fe0";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(xx, xy, 24, -Math.PI / 2, -Math.PI / 2 + (onX / X_SECONDS) * Math.PI * 2);
        ctx.stroke();
      }
    }
    if (portal >= 0) drawPortal();

    for (const gem of pickups) {
      if (inBadlands(gem.x) !== inBadlands(olly.x)) continue;
      drawSprite(GEM, gem.x, gem.y + Math.sin(time * 4 + gem.x) * 2, 18 * suck(gem.x, gem.y));
    }

    for (const chest of CHESTS) {
      if (!chestHere(chest)) continue;
      if (!save.crystal && inSecretRoom(chest.tx, chest.ty)) continue;
      drawSprite(save.opened.includes(chest.id) ? CHEST_OPEN : CHEST, chest.tx * T + T / 2, chest.ty * T + T / 2, 30);
    }

    for (const castle of landedCastles()) {
      // Spike traps: little holes, with spikes poking up when they're up.
      for (const [sx, sy] of castle.spikes) {
        const x = sx * T;
        const y = sy * T;
        ctx.fillStyle = "rgba(40, 20, 60, 0.35)";
        for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) ctx.fillRect(x + 6 + i * 9, y + 6 + j * 9, 4, 4);
        if (spikesUp(sx, sy)) {
          ctx.fillStyle = "#d8dbe2";
          ctx.strokeStyle = "#5d6472";
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
              ctx.beginPath();
              ctx.moveTo(x + 4 + i * 9, y + 12 + j * 9);
              ctx.lineTo(x + 8 + i * 9, y + 1 + j * 9);
              ctx.lineTo(x + 12 + i * 9, y + 12 + j * 9);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }
      for (const turret of castle.turrets) {
        const x = turret.tx * T + T / 2;
        const y = turret.ty * T + T / 2;
        ctx.fillStyle = castle.poison ? "#b79be6" : "#9fb4d6";
        ctx.strokeStyle = castle.colors.door;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#202029";
        ctx.fillRect(x + turret.dx * 8 - (turret.dx ? 4 : 2), y + turret.dy * 8 - (turret.dy ? 4 : 2), turret.dx ? 8 : 4, turret.dy ? 8 : 4);
      }
    }
    ctx.lineWidth = 3;
    for (const arrow of arrows) {
      // Poison arrows are purple.
      ctx.strokeStyle = arrow.poison ? "#7a2fc0" : "#6b4a1e";
      ctx.beginPath();
      ctx.moveTo(arrow.x - arrow.dx * 12, arrow.y - arrow.dy * 12);
      ctx.lineTo(arrow.x + arrow.dx * 8, arrow.y + arrow.dy * 8);
      ctx.stroke();
      ctx.fillStyle = arrow.poison ? "#c59bff" : "#c9ced8";
      ctx.beginPath();
      ctx.moveTo(arrow.x + arrow.dx * 14, arrow.y + arrow.dy * 14);
      ctx.lineTo(arrow.x + arrow.dx * 6 - arrow.dy * 5, arrow.y + arrow.dy * 6 - arrow.dx * 5);
      ctx.lineTo(arrow.x + arrow.dx * 6 + arrow.dy * 5, arrow.y + arrow.dy * 6 + arrow.dx * 5);
      ctx.fill();
      if (arrow.poison) {
        ctx.fillStyle = "rgba(155, 79, 224, 0.5)";
        ctx.beginPath();
        ctx.arc(arrow.x - arrow.dx * 16, arrow.y - arrow.dy * 16, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const celebrating = partying();
    // The teleporter (and its pad in the Badlands), and the hiding owl.
    if (save.teleporter) {
      drawTeleporter(tileCenter(TELEPORTER), ["#00e5ff", "#9b4fe0"]);
      drawTeleporter(tileCenter(BADLANDS_PAD), ["#ffb347", "#e5383b"]);
    }
    if (inBadlands(olly.x) && hootieInHideout()) {
      const owl = tileCenter(OWL_HIDEOUT);
      drawSprite(HIDING_OWL, owl.x, owl.y - 2 + Math.sin(time * 2) * 1.5, 30);
    }

    // The metal box in the bunker, the glitch on the loose, and G's zap.
    if (inBunker(olly.x, olly.y)) drawMetalBox();
    if (glitchLoose()) drawGlitch();
    if (zap && time < zap.until) {
      ctx.save();
      for (let bit = 0; bit < 14; bit += 1) {
        ctx.fillStyle = ["#00e5ff", "#ff2bd6", "#ffffff", "#d8f361"][bit % 4]!;
        ctx.fillRect(zap.x - 16 + Math.random() * 28, zap.y - 16 + Math.random() * 28, 4 + Math.random() * 6, 3);
      }
      ctx.restore();
    }

    for (const npc of NPCS) {
      if (inBadlands(npc.tx * T) !== inBadlands(olly.x)) continue;
      const dancing = celebrating && npc.id === plan!.family;
      const hop = dancing ? Math.abs(Math.sin(time * 8)) * 14 : 0;
      drawSprite(npc.art, npc.tx * T + T / 2, npc.ty * T + T / 2 - 4 - hop, 40, false, dancing ? Math.sin(time * 6) * 0.4 : 0);
    }
    // Survivors who moved in, standing next to their family, facing them.
    for (const resident of movedIn()) {
      const home = homeSpot(resident);
      drawSprite(resident.art, home.x, home.y - 4, 40, home.x > familySpot(resident).x);
    }

    // Pigs dance at the farm dance too.
    const party = chaos.has("pigParty") || (celebrating && plan!.party.things === "hay");
    for (const pig of pigs) {
      const following = save.following.includes(pig.id);
      const flip = following ? olly.facing < 0 : pig.vx < 0;
      drawSprite(PIG, pig.x, pig.y, 30 * suck(pig.x, pig.y), flip, party ? time * 8 : portal >= 0 ? time * 6 : 0);
      if (following) {
        ctx.fillStyle = "#e5383b";
        ctx.font = "10px sans-serif";
        ctx.fillText("♥", pig.x - 3, pig.y - 16);
      }
    }

    const tiny = chaos.has("tiny");
    for (const enemy of enemies) {
      drawSprite(ENEMY_KINDS[enemy.kind].art, enemy.x, enemy.y + Math.sin(time * 5 + enemy.x) * 1.5, (tiny ? 20 : 38) * suck(enemy.x, enemy.y), enemy.vx < 0);
    }

    // Olly, bouncing a little as he walks.
    const bounce = olly.moving ? Math.abs(Math.sin(olly.walk * 12)) * 3 : 0;
    const ollyArt = ollyLook(save.wearing);
    if (safeFor > 0 && Math.floor(time * 10) % 2) ctx.globalAlpha = 0.5;
    // A survivor called with the Matrix Relic: they sparkle in, chat, and
    // sparkle away again.
    if (visitor) {
      if (time > visitor.until) visitor = null;
      else {
        const appearing = Math.min(1, (time - visitor.since) / 0.5);
        const leaving = Math.min(1, (visitor.until - time) / 0.5);
        const shown = Math.min(appearing, leaving);
        ctx.save();
        // Misty is still a little see-through from her potion, until her mom
        // fixes her at the potion party.
        const fixed = save.reunited.includes("witches") || (plan?.id === "witches" && reunion > partyOver(plan));
        ctx.globalAlpha = shown * (CALLABLE[visitor.who]!.name === "Misty" && !fixed ? 0.5 : 1);
        ctx.strokeStyle = "#c59bff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(visitor.x, visitor.y - 4, 26 + (1 - shown) * 30, 0, Math.PI * 2);
        ctx.stroke();
        const hop = celebrating ? Math.abs(Math.sin(time * 8 + 1.5)) * 14 : 0;
        const facing = plan ? visitor.x > familySpot(plan).x : visitor.x > olly.x;
        drawSprite(CALLABLE[visitor.who]!.art, visitor.x, visitor.y - 6 - hop, 42 * (0.4 + shown * 0.6), facing, celebrating ? -Math.sin(time * 6) * 0.4 : 0);
        ctx.restore();
      }
    }
    if (celebrating && plan!.party.things === "juggle") {
      // Three balls looping back and forth between the twins.
      const zig = familySpot(plan!);
      const fromX = zig.x;
      const toX = homeSpot(plan!).x;
      ["#e5383b", "#ffd84d", "#3c78d8"].forEach((color, index) => {
        const phase = (time * 1.4 + index / 3) % 1;
        const across = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        const x = fromX + (toX - fromX) * across;
        const y = zig.y - 40 - Math.sin(across * Math.PI) * 50;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    for (const bit of confetti) {
      ctx.fillStyle = bit.color;
      if (plan?.party.things === "hay") {
        // Flying bits of hay and corn.
        ctx.save();
        ctx.translate(bit.x, bit.y);
        ctx.rotate(bit.spin);
        ctx.fillRect(-7, -1.5, 14, 3);
        ctx.restore();
      } else if (plan?.party.things === "bubbles") {
        // Shiny magic bubbles.
        ctx.save();
        ctx.strokeStyle = bit.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = Math.min(1, bit.life);
        ctx.beginPath();
        ctx.arc(bit.x, bit.y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fillRect(bit.x - 3, bit.y - 3, 2, 2);
        ctx.restore();
      } else if (plan?.party.things === "feathers") {
        // A feather, rocking side to side as it floats down.
        ctx.save();
        ctx.translate(bit.x, bit.y);
        ctx.rotate(Math.sin(time * 3 + bit.spin) * 0.6);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.stroke();
        ctx.restore();
      } else if (plan?.party.things === "spores") {
        // Little glowing spores drifting up.
        ctx.save();
        ctx.shadowColor = bit.color;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = Math.min(1, bit.life);
        ctx.beginPath();
        ctx.arc(bit.x, bit.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (plan?.party.things === "sparks") {
        // Glowing sparks off the anvil.
        ctx.save();
        ctx.shadowColor = bit.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(bit.x, bit.y, 3, 3);
        ctx.restore();
      } else {
        ctx.fillRect(bit.x, bit.y, 5, 5);
      }
    }

    if (save.carryingHootie) drawSprite(HIDING_OWL, olly.x, olly.y - 34 - bounce, 22);
    drawSprite(ollyArt, olly.x, olly.y - 6 - bounce, (chaos.has("zoomies") ? 46 : 40) * suck(olly.x, olly.y), olly.facing < 0, portal > 1.8 ? time * 10 : 0);
    ctx.globalAlpha = 1;

    // The sky castle falling: a shadow that grows, then the castle drops in.
    if (falling >= 0 && fallingCastle) {
      const { plaza } = fallingCastle;
      const progress = Math.min(1, falling / 3);
      const cx = (plaza.x + plaza.w / 2) * T;
      const ground = (plaza.y + plaza.h) * T;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + progress * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(cx, (plaza.y + plaza.h / 2) * T, plaza.w * T * 0.5 * progress, plaza.h * T * 0.4 * progress, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSkyCastle(fallingCastle, cx, ground - (1 - progress * progress) * 800);
    }

    ctx.restore();

    lastCam = { x: camX, y: camY };
    if (beamDown >= 0) drawBeamDown(camX, camY);
    // The Badlands: a hot red haze around the edges.
    if (inBadlands(olly.x)) {
      const haze = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 200, VIEW_W / 2, VIEW_H / 2, 620);
      haze.addColorStop(0, "rgba(120, 20, 0, 0)");
      haze.addColorStop(1, "rgba(120, 20, 0, 0.45)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, flash / 0.6)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Inside the cave it's dark, except right around Olly.
    const inCave =
      olly.x > CAVE.x * T && olly.x < (CAVE.x + CAVE.w) * T && olly.y > CAVE.y * T && olly.y < (CAVE.y + CAVE.h) * T;
    if ((inCave || inBunker(olly.x, olly.y)) && !save.owlEye) {
      const sx = olly.x - camX;
      const sy = olly.y - camY;
      const light = ctx.createRadialGradient(sx, sy, 70, sx, sy, inCave ? 230 : 320);
      light.addColorStop(0, "rgba(0, 0, 0, 0)");
      light.addColorStop(1, "rgba(0, 0, 0, 0.85)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (reunion >= 0 && plan) {
      // Movie bars slide in at the start and out at the end.
      const bars = Math.min(1, reunion / 0.6, (reunionSeconds(plan) - reunion) / 0.6) * 64;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VIEW_W, bars);
      ctx.fillRect(0, VIEW_H - bars, VIEW_W, bars);
      const step = reunionStep();
      if (step.who !== "party") {
        const speaker = step.who === "family" ? familySpot(plan) : homeSpot(plan);
        drawBubble(`${step.who === "family" ? plan.familyName : plan.visitor}: ${step.text}`, speaker.x - camX, speaker.y - camY - 30);
      } else {
        ctx.fillStyle = "#ffd84d";
        ctx.font = "bold 28px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(plan.party.title, VIEW_W / 2, 100);
        ctx.textAlign = "start";
      }
    } else if (visitor) {
      const survivor = CALLABLE[visitor.who]!;
      drawBubble(`${survivor.name}: ${visitor.line}`, visitor.x - camX, visitor.y - camY - 30);
    }

    // Swallowed: the sky goes black.
    if (portal > 3.4) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, (portal - 3.4) / 1.2)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawBubble(text: string, x: number, y: number): void {
    ctx.font = "bold 14px 'DM Sans', sans-serif";
    const width = 300;
    const lines: string[] = [];
    let current = "";
    for (const word of text.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > width - 24 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
    const height = lines.length * 18 + 16;
    const left = Math.max(10, Math.min(VIEW_W - width - 10, x - width / 2));
    const top = Math.max(10, y - height - 10);
    ctx.fillStyle = "#fffdf3";
    ctx.strokeStyle = "#24242b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(left, top, width, height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#24242b";
    lines.forEach((line, index) => ctx.fillText(line, left + 12, top + 22 + index * 18));
  }

  // A black-and-purple whirlpool that spins and grows.
  function drawPortal(): void {
    const cx = MATRIX_X.x * T + T / 2;
    const cy = MATRIX_X.y * T + T / 2;
    const size = Math.min(170, 20 + portal * 70);
    ctx.save();
    ctx.translate(cx, cy);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    glow.addColorStop(0, "rgba(0, 0, 0, 1)");
    glow.addColorStop(0.55, "rgba(40, 0, 70, 0.9)");
    glow.addColorStop(1, "rgba(155, 79, 224, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(time * 4);
    ctx.strokeStyle = "rgba(197, 155, 255, 0.85)";
    ctx.lineWidth = 3;
    for (let arm = 0; arm < 4; arm += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      for (let step = 0; step <= 40; step += 1) {
        const angle = step * 0.18;
        const radius = (step / 40) * size;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Running --------------------------------------------------------------

  let frame = 0;
  let last = performance.now();
  // Set once this is shut down. Something inside update() (like walking into
  // a portal) can shut it down mid-frame, so the loop must not carry on.
  let stopped = false;
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    if (stopped) return;
    draw();
    frame = requestAnimationFrame(loop);
  };

  const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s"]);
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if ((key === "Escape" || key === "o") && overlay.querySelector(".strange-map")) {
      closeOverlay();
      return;
    }
    if (key === "Escape" && !overlay.hidden && !overlay.querySelector(".fight-card")) {
      closeOverlay();
      return;
    }
    if (busy || falling >= 0 || portal >= 0) return;
    if (key === "o") {
      openStrangeMap();
      return;
    }
    if (movementKeys.has(key)) {
      keys.add(key);
      event.preventDefault();
    } else if (key === " " || key === "e") {
      event.preventDefault();
      interact();
    } else if (key === "g") {
      useGlitch();
    } else if (key === "r") {
      callSurvivor();
    } else if (key === "q") {
      useChaos();
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  };
  const onBlur = (): void => keys.clear();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  root.querySelector("[data-leave]")!.addEventListener("click", () => api.leave());
  root.querySelector("[data-cosmetics]")!.addEventListener("click", openCosmetics);
  canvas.addEventListener("click", onCanvasClick);
  renderCosmeticsButton();

  renderHud();
  if (!save.landed && CASTLE_ENEMIES.every((e) => save.defeated.includes(e.id))) {
    // The castles were cleared while Olly was away: the sky castle falls now.
    dropSkyCastle(SKY_CASTLES[0]!, "Both castles are cleared! Something is falling from the sky...");
  } else if (!save.purpleLanded && !purpleMissing().length) {
    checkPurpleCastle();
  } else if (api.beamedOut) {
    persist();
    say("The beam of light blasted you out of THE MATRIX... and slammed into the ground, revealing a TELEPORTER! Click it (or press Space next to it).");
  } else if (teleporterCatchUp) {
    persist();
    say("Something new glows by the X in the Purple Woods... a TELEPORTER! The vault's light must have made it.");
  } else if (boxCatchUp) {
    persist();
    say("The metal box you opened had more inside! You got GODLY ARMOR, a KEY for the vault in THE MATRIX, and a COSMETICS kit! Click 🎨 Cosmetics up top.");
  } else if (api.backFromMatrix) {
    if (!save.relic) {
      save.relic = true;
      renderHud();
      persist();
      say("You escaped THE MATRIX and got the MATRIX RELIC! 🔮 Press R anytime to call a survivor.");
    } else {
      say("You escaped THE MATRIX! The portal spat you back out onto the X.");
    }
  } else {
    say(
      save.gems === 0 && save.opened.length === 0
        ? "Welcome to the quest! Walk with the arrow keys. Find treasure, feed pigs, and clear the castles in the east."
        : "Welcome back, warrior!"
    );
  }
  frame = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.clearTimeout(toastTimer);
    persist();
  };
}
