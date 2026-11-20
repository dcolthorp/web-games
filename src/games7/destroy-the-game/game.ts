import { play as playSound, startMusic, stopMusic, type Sfx } from "./sfx";

// Destroy the Game: the platformer behind the smashed title card (Oscar, 2026-11-20).
//
// Everything looks hand-drawn on notebook paper. You run and jump, and at the
// start a sign pops up: HIT D TO DASH. Oscar's dash rules:
//   - The longer you hold D, the longer you dash. The most is half a second
//     (Oscar first said one second, then changed it to 0.5).
//   - The moment you hit a wall, the dash stops.
//   - While dashing you can go over spikes you normally can't get past.
//   - Dash into a CRACKED wall and it breaks. That's the name of the game.
// Every five levels a sign pops up and unlocks a new move. Dash is the first.
// Level 6 unlocks UP DASH (Oscar's second move): jump, then press Jump again in
// mid-air and you dash straight up. It works like the normal dash (hold Jump
// longer to go higher, half a second at most) and it breaks cracked CEILINGS.

const T = 40; // one tile, in world pixels
const COLS = 32;
const ROWS = 14;
const WORLD_W = COLS * T;
const WORLD_H = ROWS * T;

const RUN = 260;
const GRAVITY = 2000;
const JUMP = 720;
const MAX_FALL = 1100;
const DASH_SPEED = 900; // faster, so a half-second dash still clears a pit
const DASH_MAX = 0.5; // seconds: Oscar's rule, the longest dash is half a second
const DASH_MIN = 0.1; // a quick tap still does a little dash
const COYOTE = 0.1;
const JUMP_BUFFER = 0.12;
const PW = 24;
const PH = 34;

const SAVE_KEY = "destroy-the-game-level";
const UP_DASH_LEVEL = 5; // level index where Up Dash unlocks (Level 6)
const BOMB_LEVEL = 10; // level index where Bombs unlock (Level 11)
const WATER_LEVEL = 15; // level index where Water unlocks (Level 16)
const WET_NEEDED = 14; // drops of water a smudged wall needs before it fades
const FADE_TIME = 0.7;

// Level 21 brings SLAMMERS (a danger, not a move): spiky blocks that open up,
// wiggle for a moment, then quickly SLAM shut. Get caught inside and you're
// squashed. Time it right and run through while they're open.
const SLAMMER_LEVEL = 20; // level index (Level 21)
// Level 26 brings SCISSORS (Oscar's fifth move) and GEARS. Run into a gear to
// turn it. Wires carry what it does: a BLUE wire makes its slammer stop (open),
// a RED wire makes its slammer get stuck slammed shut. Until the gear is turned,
// wired slammers chatter nonstop and you can't get through. Press S next to a
// wire to cut it: that slammer is switched off and stays open. Wires buried in
// walls can't be cut.
const SCISSORS_LEVEL = 25; // level index (Level 26)
// Oscar: "the most rage baiting game I have ever made", so it got BOTH:
// more rage (Levels 31+): FAKE EXIT doors that slam you, and CRUMBLING floors
// that break a moment after you step on them. Less rage: CHECKPOINT flags.
// Touch a flag and when you die you come back there, with everything you
// already did still done.
const RAGE_LEVEL = 30; // level index (Level 31)
const CRUMBLE_TIME = 0.4;

interface Wire {
  tiles: [number, number][];
  red: boolean; // red = stuck shut, blue = stops open
  gear: number; // index into gears, or -1
  slammer: number; // index into slammers, or -1
  cut: boolean;
}
const SLAM_OPEN = 1.3; // wide open
const SLAM_WARN = 0.35; // wiggling: about to slam!
const SLAM_DROP = 0.09; // slamming
const SLAM_SHUT = 0.35; // shut
const SLAM_RISE = 0.35; // opening again
const SLAM_CYCLE = SLAM_OPEN + SLAM_WARN + SLAM_DROP + SLAM_SHUT + SLAM_RISE;

/** How shut a slammer is (0 = wide open, 1 = slammed shut) at this point in its cycle. */
function slamClosed(phase: number): number {
  let t = phase;
  if (t < SLAM_OPEN) return 0;
  t -= SLAM_OPEN;
  if (t < SLAM_WARN) return 0.05 + 0.04 * Math.abs(Math.sin(t * 70));
  t -= SLAM_WARN;
  if (t < SLAM_DROP) return 0.1 + 0.9 * (t / SLAM_DROP);
  t -= SLAM_DROP;
  if (t < SLAM_SHUT) return 1;
  t -= SLAM_SHUT;
  return Math.max(0, 1 - t / SLAM_RISE);
}

interface Slammer {
  x0: number; // tiles, inclusive
  x1: number;
  y0: number;
  y1: number;
  offset: number; // so slammers next to each other don't all slam at once
  wasShut: boolean;
}
const MAX_BOMBS = 3;
const BLAST = T * 1.6; // how far a bomb reaches

// Map key: # wall, ^ spikes, C cracked wall, M metal, U smudged wall, S switch,
// J slammer (connected J tiles make one slammer), G gear, o blue wire, x red wire,
// O blue wire buried in a wall, Y red wire buried in a wall, F fake exit,
// K crumbling floor, H checkpoint flag, P start, X exit, ? sign.
//
// Level 16 unlocks WATER (Oscar's fourth move): hold W to pour water. Pour it on
// a slightly smudged wall and the whole smudge fades away.
//
// Level 11 unlocks BOMBS (Oscar's third move): press B to drop a bomb. There are
// switches on the walls here and there; flicking one (run into it) blows up all
// your bombs. Bombs only break METAL blocks. Anything else just throws sparks
// and goes clink.
export interface LevelDef {
  map: string[];
  sign: string; // what the little ? sign says
  popSign?: { title: string; lines: string[] }; // the big sign that pops up at the start
  name?: string; // shown at the top next to the level number
  shuffle?: boolean; // the Door Shuffle (Levels 5 and 35)
  shuffleSwaps?: number; // how many swaps (default 14)
  shuffleFastest?: number; // seconds for the fastest swap (default 0.22)
}

// ---- The Door Shuffle (Oscar's idea, our own version) ----
// Walls slide in and trap you. Eight doors appear: seven say VACANT, one is the
// EXIT. Spooky music fades in, the labels disappear, and the doors shuffle
// around, faster and faster. Then the walls open: walk to the door you think is
// the EXIT and press DOWN. Wrong door? It slams you, and they shuffle again.
// You start on the left side; all 8 doors are over on your right (Oscar's ask).
const DOOR_COLS = [9, 12, 15, 18, 21, 24, 27, 30]; // where the 8 door spots are
const SWAPS = 14;
interface Shuffle {
  phase: "trap" | "show" | "shuffle" | "open" | "pick";
  t: number;
  slotOf: number[]; // slotOf[door] = which spot that door is in
  real: number; // which door is the real EXIT
  swaps: { a: number; b: number; dur: number }[]; // spots to swap
  swapIdx: number;
  swapT: number;
  cageX: number; // middle of the trap
  picked: number; // the door you opened, or -1
}
const doorX = (slot: number): number => (DOOR_COLS[slot]! + 0.5) * T;

const LEVELS: LevelDef[] = [
  {
    sign: "Hold D longer to dash farther!",
    popSign: { title: "NEW MOVE!", lines: ["Hit D to dash.", "Hold it longer to go farther (up to half a second)."] },
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?.........................X.#",
      "#######^^^^^^^^#################",
      "################################",
    ],
  },
  {
    sign: "Cracked wall? DASH into it!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............C...............#",
      "#..............C...............#",
      "#..............C...............#",
      "#.P?...........C............X..#",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Jump first, THEN dash in the air!",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#.P?......#####....C.........X.#",
      "#####^^^^^#####^^^^#############",
      "################################",
    ],
  },
  {
    sign: "Up the steps, then smash back the other way!",
    map: [
      "################################",
      "#.................C............#",
      "#.................C............#",
      "#.................C............#",
      "#.................C............#",
      "#.................C............#",
      "#..X..............C......H.....#",
      "##########^^^^^############....#",
      "#..............................#",
      "#..........................#####",
      "#..........................#####",
      "#.P?....................########",
      "####^^^^^^^^^###################",
      "################################",
    ],
  },
  {
    sign: "Watch the EXIT door!",
    name: "Door Shuffle",
    shuffle: true,
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P............................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Jump, then press Jump AGAIN in the air!",
    popSign: { title: "NEW MOVE: UP DASH!", lines: ["Jump, then press Jump AGAIN in mid-air.", "You dash straight up and smash cracked ceilings!"] },
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..........................X...#",
      "#############CCCC###############",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Dash the spikes, then Up Dash the cracks!",
    map: [
      "################################",
      "#.....................C........#",
      "#.....................C........#",
      "#.....................C........#",
      "#.....................C........#",
      "#.....................C....X...#",
      "#############CCCC###############",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "#####^^^^^^#####################",
      "################################",
    ],
  },
  {
    sign: "Up, left, up again!",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..........................X...#",
      "#####CCCC#######################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "##########^^^^^^###CCCC#########",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Up through the ceiling, then smash back left!",
    map: [
      "################################",
      "#.................C............#",
      "#.................C............#",
      "#.................C............#",
      "#.................C............#",
      "#..X..............C............#",
      "##########^^^^^#########CCCC####",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "#####^^^^^^^####################",
      "################################",
    ],
  },
  {
    sign: "Everything you know. Go!",
    map: [
      "################################",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C.........X.#",
      "###CCCC###^^^^^##^^^^^##########",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Drop a bomb by the metal, then run back to the switch!",
    popSign: { title: "NEW MOVE: BOMBS!", lines: ["Press B to drop a bomb.", "Run into a switch to blow them up. Only METAL breaks!"] },
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............M...............#",
      "#..............M...............#",
      "#..............M...............#",
      "#SP?...........M............X..#",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Bombs can blow up metal FLOORS too.",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#SP?...........................#",
      "####################MMM#########",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#...........................X..#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Bomb it, then dash all the way back!",
    map: [
      "################################",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#......................M.......#",
      "#SP?................H..M.....X.#",
      "#########^^^^^^^^###############",
      "################################",
    ],
  },
  {
    sign: "Up Dash first. Then DASH over the hole to the switch.",
    map: [
      "################################",
      "#.....................M........#",
      "#.....................M........#",
      "#.....................M........#",
      "#.....................M........#",
      "#S....................M.....X..#",
      "############CCCC################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Bomb down here. Switch up there. GO!",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.............................S#",
      "#############CCCC###############",
      "#.................M............#",
      "#.................M............#",
      "#.................M............#",
      "#.................M............#",
      "#.P?..............M.........X..#",
      "#####^^^^^^#####################",
      "################################",
    ],
  },
  {
    sign: "Hold W to pour water on the smudge!",
    popSign: { title: "NEW MOVE: WATER!", lines: ["Hold W to pour water.", "Smudged walls fade away when they get wet!"] },
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............U...............#",
      "#..............U...............#",
      "#..............U...............#",
      "#.P?...........U............X..#",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Smudged floor? Pour water on it and drop down!",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "####################UUU#########",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#...........................X..#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Dash the spikes, then wash the wall away.",
    map: [
      "################################",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#.P?................U.......X..#",
      "######^^^^^^^###################",
      "################################",
    ],
  },
  {
    sign: "Up Dash, then pour!",
    map: [
      "################################",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U..........#",
      "#...................U.......X..#",
      "########CCCC####################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Water, dash, bomb, switch, dash, GO!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#.......U...............M......#",
      "#.......U...............M......#",
      "#.......U...............M......#",
      "#.......U...............M......#",
      "#SP?....U...........H...M...X..#",
      "############^^^^^^##############",
      "################################",
    ],
  },
  {
    sign: "Wait for it to open... then RUN!",
    popSign: { title: "NEW DANGER: SLAMMERS!", lines: ["Spiky blocks open up, wiggle... then SLAM shut.", "Time it right and run through!"] },
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#.............JJ...............#",
      "#.............JJ...............#",
      "#.............JJ...............#",
      "#.P?..........JJ............X..#",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Three in a row. Watch the wiggle!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#........J.....JJ.....J........#",
      "#........J.....JJ.....J........#",
      "#........J.....JJ.....J........#",
      "#.P?.....J.....JJ.....J.....X..#",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Dash the spikes, but don't dash into the jaws!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#................JJ............#",
      "#................JJ............#",
      "#................JJ............#",
      "#................JJ............#",
      "#................JJ............#",
      "#.P?.............JJ.........X..#",
      "######^^^^^^^###################",
      "################################",
    ],
  },
  {
    sign: "Up Dash, then time the slammers upstairs.",
    map: [
      "################################",
      "#..............J.....J.........#",
      "#..............J.....J.........#",
      "#..............J.....J.........#",
      "#..............J.....J.........#",
      "#..............J.....J......X..#",
      "######CCCC######################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Water, slammer, dash, bomb... and back again!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#.....U.....JJ...........M.....#",
      "#.....U.....JJ...........M.....#",
      "#.....U.....JJ...........M.....#",
      "#.....U.....JJ...........M.....#",
      "#SP?..U.....JJ........H..M..X..#",
      "###############^^^^^^###########",
      "################################",
    ],
  },
  {
    sign: "Run into the gear to turn it. Then go find the red wire!",
    popSign: { title: "NEW MOVE: SCISSORS!", lines: ["Turn a gear: BLUE wires stop a slammer, RED ones jam it shut.", "Press S next to a wire to cut it and switch its slammer off!"] },
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "OOOOOOOOOOO#####################",
      "O.........JJ........JJ.........#",
      "O.........JJ........JJ.........#",
      "O.........JJ........JJ.........#",
      "O.........JJ........JJ.........#",
      "O.........JJ.....xxxJJ.........#",
      "O.........JJ.....x..JJ.........#",
      "OGP?......JJ.....x..JJ......X..#",
      "#Y###############Y##############",
      "#YYYYYYYYYYYYYYYYY##############",
    ],
  },
  {
    sign: "Cut the red wire first, then turn the gear.",
    map: [
      "################################",
      "################################",
      "################################",
      "OOOOOOOOOOOOOOOOOOOOO###########",
      "O###################O###########",
      "O.........JJ........JJ.........#",
      "O.........JJ........JJ.........#",
      "OxxxxxxxxxJJ........JJ.........#",
      "Ox........JJ........JJ.........#",
      "Ox........JJ........JJ.........#",
      "Ox........JJ........JJ.........#",
      "OGP?......JJ........JJ......X..#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Gear, snip, then dash the spikes!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "OOOOOOOOOO######################",
      "O........JJ.........JJ.........#",
      "O........JJ.........JJ.........#",
      "O........JJ.........JJ.........#",
      "O........JJ.........JJ.........#",
      "O........JJ.xxxxxxxxJJ.........#",
      "O........JJ.x.......JJ.........#",
      "OGP?.....JJ.x.......JJ......X..#",
      "#Y##########Y^^^^^##############",
      "#YYYYYYYYYYYY###################",
    ],
  },
  {
    sign: "The red wire is behind the smudge...",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "OOOOOOOOOOO#####################",
      "O.........JJ..U.....JJ.........#",
      "O.........JJ..U.....JJ.........#",
      "O.........JJ..U.....JJ.........#",
      "O.........JJ..U.....JJ.........#",
      "O.........JJ..U..xxxJJ.........#",
      "O.........JJ..U..x..JJ.........#",
      "OGP?......JJ..U..x..JJ......X..#",
      "#Y###############Y##############",
      "#YYYYYYYYYYYYYYYYY##############",
    ],
  },
  {
    sign: "The red wire is upstairs. Up Dash!",
    map: [
      "################################",
      "#.....................JJ.......#",
      "#.....................JJ.......#",
      "#................xxxxxJJ.......#",
      "#................x....JJ.......#",
      "#................xH...JJ.....X.#",
      "OOOOOOOOO###CCCC#YYYYYYYYYYYYYYY",
      "O.......JJ.....................Y",
      "O.......JJ.....................Y",
      "O.......JJ.....................Y",
      "O.......JJ.....................Y",
      "OGP?....JJ.....................Y",
      "#Y#############################Y",
      "#YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    ],
  },
  {
    sign: "Welcome to the RAGE ZONE. Not every EXIT is real...",
    popSign: { title: "RAGE ZONE!", lines: ["Some EXITs are FAKE. Some floors CRUMBLE.", "Touch a flag to save your spot."] },
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?.....F...........H......X..#",
      "##############KKKKK#############",
      "##############^^^^^#############",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Both of these doors are lying to you.",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..........................X...#",
      "##############CCCC##############",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?......F.............F......#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Don't stop on the crumbly floor!",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#...................JJ.........#",
      "#...................JJ.........#",
      "#...................JJ.........#",
      "#...................JJ.........#",
      "#.P?....H...........JJ......X..#",
      "##########KKKKKKKK##############",
      "##########^^^^^^^^##############",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Boom, then don't fall for it.",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#...............M..............#",
      "#...............M..............#",
      "#...............M..............#",
      "#SP?............M...F..H.....X.#",
      "########################KKKKK###",
      "########################^^^^^###",
      "################################",
      "################################",
      "################################",
    ],
  },
  {
    sign: "The final shuffle. Even faster.",
    name: "Final Shuffle",
    shuffle: true,
    shuffleSwaps: 22,
    shuffleFastest: 0.15,
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P............................#",
      "################################",
      "################################",
    ],
  },
];

const WORLD_DONE_SIGN = {
  title: "35 LEVELS DOWN!",
  lines: ["Every 5 levels you unlock a new move.", "The next one is coming soon..."],
};

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  coyote: number;
  jumpBuffer: number;
  canDash: boolean;
  canUpDash: boolean;
  dashing: boolean;
  dashUp: boolean; // true for an Up Dash, false for a normal sideways dash
  dashTime: number;
  runPhase: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  size: number;
  color: string;
  life: number;
  spark?: boolean; // drawn as a glowing streak
}

interface PopSign {
  title: string;
  lines: string[];
  shownAt: number;
  leavingAt: number | null;
}

export interface GameHandle {
  stop(): void;
}

export interface GameOptions {
  startLevel?: number; // level index (0 = Level 1); defaults to the saved level
  demo?: boolean; // plays itself for the menu background: no keyboard, no saving
  onExit?: () => void; // Escape goes back to the menu
  testLevel?: LevelDef; // the Test Level (test-level.ts): every move unlocked, nothing saved
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): GameHandle {
  const demo = opts.demo === true;
  const testLevel = opts.testLevel;
  const test = testLevel !== undefined;
  // Has this move been unlocked yet? (Everything is, in the Test Level.)
  const unlocked = (fromLevel: number): boolean => test || levelIndex >= fromLevel;
  const levelDef = (): LevelDef => testLevel ?? LEVELS[levelIndex]!;
  let stopped = false;
  const ctx = canvas.getContext("2d")!;
  const keys = new Set<string>();

  let levelIndex = clampLevel(opts.startLevel ?? readSavedLevel());
  let grid: string[][] = [];
  let player: Player;
  let bits: Bit[] = [];
  let trail: { x: number; y: number; age: number; up: boolean }[] = [];
  let deaths = 0;
  let deadUntil = 0;
  let clearedAt = 0;
  let shake = 0;
  let popSign: PopSign | null = null;
  let bombs: { x: number; y: number; vy: number }[] = [];
  let flashes: { x: number; y: number; age: number; big: boolean }[] = [];
  let drops: { x: number; y: number; vx: number; vy: number }[] = [];
  let wet: Record<string, number> = {}; // how soaked each smudged tile is
  let fading: Record<string, number> = {}; // when each smudged tile started fading
  let slammers: Slammer[] = [];
  let gears: { tx: number; ty: number; on: boolean; spin: number }[] = [];
  let wires: Wire[] = [];
  let onGear = "";
  let checkpoint: { tx: number; ty: number } | null = null;
  let shuffle: Shuffle | null = null;
  const locked = (): boolean => shuffle !== null && shuffle.phase !== "pick";

  function makeShuffle(def: LevelDef): Shuffle {
    const swaps: Shuffle["swaps"] = [];
    const count = def.shuffleSwaps ?? SWAPS;
    const fastest = def.shuffleFastest ?? 0.22;
    for (let i = 0; i < count; i++) {
      const a = Math.floor(Math.random() * DOOR_COLS.length);
      let b = Math.floor(Math.random() * (DOOR_COLS.length - 1));
      if (b >= a) b += 1;
      swaps.push({ a, b, dur: 0.62 - ((0.62 - fastest) * i) / (count - 1) }); // faster and faster
    }
    keys.clear();
    return {
      phase: "trap",
      t: 0,
      slotOf: DOOR_COLS.map((_, i) => i),
      real: Math.floor(Math.random() * DOOR_COLS.length),
      swaps,
      swapIdx: 0,
      swapT: 0,
      cageX: player.x + PW / 2, // the trap closes around wherever you start
      picked: -1,
    };
  }

  function stepShuffle(dt: number): void {
    const sh = shuffle;
    if (!sh) return;
    sh.t += dt;
    if (sh.phase === "trap" && sh.t > 1) {
      sh.phase = "show";
      sh.t = 0;
      if (!demo) startMusic();
    } else if (sh.phase === "show" && sh.t > 2.8) {
      sh.phase = "shuffle";
      sh.t = 0;
    } else if (sh.phase === "shuffle") {
      const sw = sh.swaps[sh.swapIdx];
      if (!sw) {
        sh.phase = "open";
        sh.t = 0;
        return;
      }
      if (sh.swapT === 0) sfx("swoosh");
      sh.swapT += dt;
      if (sh.swapT >= sw.dur) {
        const da = sh.slotOf.indexOf(sw.a);
        const db = sh.slotOf.indexOf(sw.b);
        sh.slotOf[da] = sw.b;
        sh.slotOf[db] = sw.a;
        sh.swapIdx += 1;
        sh.swapT = 0;
      }
    } else if (sh.phase === "open" && sh.t > 0.8) {
      sh.phase = "pick";
      sh.t = 0;
    }
  }

  // Press DOWN in front of a door to open it.
  function pickDoor(): void {
    const sh = shuffle;
    if (!sh || sh.phase !== "pick" || sh.picked >= 0 || deadUntil || clearedAt) return;
    const px = player.x + PW / 2;
    const door = sh.slotOf.findIndex((slot) => Math.abs(doorX(slot) - px) < 20);
    if (door < 0) return;
    sh.picked = door;
    if (door === sh.real) {
      reachExit();
    } else {
      sfx("slam");
      sfx("laugh");
      die();
    }
  }

  function reachExit(): void {
    if (clearedAt) return;
    clearedAt = time;
    sfx("exit");
    const next = Math.min(levelIndex + 1, LEVELS.length - 1);
    if (!demo && !test) try {
      localStorage.setItem(SAVE_KEY, String(Math.max(next, readSavedLevel())));
    } catch {
      // Not saved; you'll just start from an earlier level next time.
    }
  }

  function drawShuffle(): void {
    const sh = shuffle;
    if (!sh) return;
    // Where each door is right now (moving ones arc over the others).
    const pos = sh.slotOf.map((slot) => ({ x: doorX(slot), lift: 0 }));
    const sw = sh.phase === "shuffle" ? sh.swaps[sh.swapIdx] : undefined;
    if (sw) {
      const u = Math.min(1, sh.swapT / sw.dur);
      const e = u * u * (3 - 2 * u);
      const da = sh.slotOf.indexOf(sw.a);
      const db = sh.slotOf.indexOf(sw.b);
      pos[da] = { x: doorX(sw.a) + (doorX(sw.b) - doorX(sw.a)) * e, lift: Math.sin(Math.PI * e) * T * 1.4 };
      pos[db] = { x: doorX(sw.b) + (doorX(sw.a) - doorX(sw.b)) * e, lift: Math.sin(Math.PI * e) * T * 0.35 };
    }
    const floorY = 12 * T;
    const showLabels = sh.phase === "show";
    sh.slotOf.forEach((_, door) => {
      const { x, lift } = pos[door]!;
      const isReal = door === sh.real;
      const opened = sh.picked === door;
      const w = T - 6;
      const h = T * 1.6;
      const left = x - w / 2;
      const top = floorY - h - lift;
      let fill = "#c99a62";
      let ink = "#5b3d1c";
      if (showLabels && isReal) fill = "#9be59b";
      if (opened) fill = isReal ? "#9be59b" : "#e8a0a0";
      ctx.fillStyle = fill;
      ctx.fillRect(left, top, w, h);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.6;
      sketchLine(left, top + h, left, top);
      sketchLine(left, top, left + w, top);
      sketchLine(left + w, top, left + w, top + h);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(left + w - 7, top + h * 0.55, 2.6, 0, Math.PI * 2);
      ctx.fill();
      // The little sign above each door.
      let label = "?";
      let color = "#5b3d1c";
      if (showLabels) {
        label = isReal ? "EXIT" : "VACANT";
        color = isReal ? "#1f6b2a" : "#7a7268";
      }
      if (opened) {
        label = isReal ? "EXIT!" : "VACANT";
        color = isReal ? "#1f6b2a" : "#c0392b";
      }
      ctx.font = "15px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(label, x, top - 10);
    });

    // The trap walls slide in from the sides, then away again.
    let shut = 1;
    if (sh.phase === "trap") shut = Math.min(1, sh.t / 0.8);
    if (sh.phase === "open") shut = Math.max(0, 1 - sh.t / 0.8);
    if (sh.phase === "pick") shut = 0;
    if (shut > 0) {
      const gap = T * 1.3;
      const leftX = sh.cageX - gap - T - (1 - shut) * sh.cageX;
      const rightX = sh.cageX + gap + (1 - shut) * (WORLD_W - sh.cageX);
      // (If you start right by the wall, that wall is the other side of the trap.)
      for (const wx of [leftX, rightX].filter((x) => x >= T || shut < 1)) {
        ctx.fillStyle = "#e3dccb";
        ctx.fillRect(wx, floorY - T * 5, T, T * 5);
        ctx.strokeStyle = "rgba(60, 55, 50, 0.3)";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 12; i++) sketchLine(wx + 4, floorY - i * 17, wx + T - 4, floorY - i * 17 - 12, 0.8);
        ctx.strokeStyle = "#2b2725";
        ctx.lineWidth = 2.6;
        ctx.strokeRect(wx, floorY - T * 5, T, T * 5);
      }
    }

    // What to do right now.
    const banner =
      sh.phase === "trap" ? "!!!" :
      sh.phase === "show" ? "Remember which door is the EXIT..." :
      sh.phase === "shuffle" ? "Keep your eyes on it!" :
      sh.phase === "open" ? "..." :
      "Pick a door! Walk to it and press DOWN.";
    ctx.font = "30px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#2b2725";
    ctx.fillText(banner, WORLD_W / 2, T * 2.2);
  }
  let crumbling: Record<string, number> = {};
  let fakesFound: Record<string, boolean> = {};
  let snipAt = -10; // when you last used the scissors (for the little picture)
  let pourTimer = 0;
  let splashCount = 0;
  let switchFlips: Record<string, boolean> = {}; // which way each lever points
  let onSwitch = ""; // the switch you're standing in, so it only flicks once
  const sfx = (name: Sfx): void => {
    if (!demo) playSound(name);
  };
  let finished = false;
  let time = 0;

  let scale = 1;
  let offX = 0;
  let offY = 0;

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const top = 56; // room for the level name and the back link
    scale = Math.min((w - 24) / WORLD_W, (h - top - 16) / WORLD_H);
    offX = (w - WORLD_W * scale) / 2;
    offY = top + (h - top - 16 - WORLD_H * scale) / 2;
  }

  function loadLevel(index: number, showPop: boolean): void {
    levelIndex = index;
    const def = testLevel ?? LEVELS[index]!;
    if (!def.shuffle) stopMusic();
    grid = def.map.map((row) => row.split(""));
    let sx = 2;
    let sy = 11;
    grid.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c === "P") {
          sx = x;
          sy = y;
          row[x] = ".";
        }
      })
    );
    player = {
      x: sx * T + (T - PW) / 2,
      y: (sy + 1) * T - PH,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      coyote: 0,
      jumpBuffer: 0,
      canDash: true,
      canUpDash: true,
      dashing: false,
      dashUp: false,
      dashTime: 0,
      runPhase: 0,
    };
    trail = [];
    bombs = [];
    switchFlips = {};
    drops = [];
    wet = {};
    fading = {};
    slammers = findSlammers();
    findGearsAndWires();
    onGear = "";
    checkpoint = null;
    shuffle = def.shuffle ? makeShuffle(def) : null;
    crumbling = {};
    fakesFound = {};
    onSwitch = "";
    if (showPop && def.popSign && !demo) {
      popSign = { ...def.popSign, shownAt: time, leavingAt: null };
      sfx("pop");
    }
  }

  function findSlammers(): Slammer[] {
    const found: Slammer[] = [];
    const seen = new Set<string>();
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (grid[ty]?.[tx] !== "J" || seen.has(`${tx},${ty}`)) continue;
        const s: Slammer = { x0: tx, x1: tx, y0: ty, y1: ty, offset: 0, wasShut: false };
        const todo: [number, number][] = [[tx, ty]];
        while (todo.length) {
          const [x, y] = todo.pop()!;
          const key = `${x},${y}`;
          if (seen.has(key) || grid[y]?.[x] !== "J") continue;
          seen.add(key);
          s.x0 = Math.min(s.x0, x);
          s.x1 = Math.max(s.x1, x);
          s.y0 = Math.min(s.y0, y);
          s.y1 = Math.max(s.y1, y);
          todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        s.offset = found.length * 0.8;
        found.push(s);
      }
    }
    return found;
  }

  function findGearsAndWires(): void {
    gears = [];
    wires = [];
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) if (tileAt(tx, ty) === "G") gears.push({ tx, ty, on: false, spin: 0 });
    }
    const isRed = (c: string): boolean => c === "x" || c === "Y";
    const isWire = (c: string): boolean => c === "o" || c === "O" || isRed(c);
    const seen = new Set<string>();
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const c0 = tileAt(tx, ty);
        if (!isWire(c0) || seen.has(`${tx},${ty}`)) continue;
        const red = isRed(c0);
        const wire: Wire = { tiles: [], red, gear: -1, slammer: -1, cut: false };
        const todo: [number, number][] = [[tx, ty]];
        while (todo.length) {
          const [x, y] = todo.pop()!;
          const key = `${x},${y}`;
          const c = tileAt(x, y);
          if (seen.has(key) || !isWire(c) || isRed(c) !== red || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          seen.add(key);
          wire.tiles.push([x, y]);
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
            const g = gears.findIndex((gg) => gg.tx === nx && gg.ty === ny);
            if (g >= 0) wire.gear = g;
            const sl = slammers.findIndex((m) => nx >= m.x0 && nx <= m.x1 && ny >= m.y0 && ny <= m.y1);
            if (sl >= 0) wire.slammer = sl;
            todo.push([nx, ny]);
          }
        }
        wires.push(wire);
      }
    }
  }

  /** How shut a slammer is right now, after gears, wires and scissors. */
  function slamAmount(s: Slammer): number {
    const idx = slammers.indexOf(s);
    const mine = wires.filter((w) => w.slammer === idx);
    if (mine.length === 0) return slamClosed(slamPhase(s)); // not wired: normal
    const live = mine.filter((w) => !w.cut && w.gear >= 0);
    if (live.length === 0) return 0; // every wire cut: switched off, open
    const on = live.filter((w) => gears[w.gear]?.on);
    if (on.some((w) => w.red)) return 1; // stuck slammed shut
    if (on.length > 0) return 0; // stopped, open
    // Gear not turned yet: it chatters nonstop and you can't get through.
    return 0.92 + 0.07 * Math.abs(Math.sin(time * 22 + s.offset * 3));
  }

  // Press S: cut any wire you're touching (not ones buried in a wall).
  function useScissors(): void {
    snipAt = time;
    const p = player;
    const reach = 12;
    for (const w of wires) {
      if (w.cut) continue;
      const hit = w.tiles.some(([tx, ty]) => {
        const c = tileAt(tx, ty);
        if (c !== "o" && c !== "x") return false;
        return p.x + PW + reach > tx * T && p.x - reach < (tx + 1) * T && p.y + PH > ty * T && p.y - reach < (ty + 1) * T;
      });
      if (hit) {
        w.cut = true;
        sfx("snip");
        sparks(p.x + PW / 2 + p.facing * 14, p.y + 12, 6);
      }
    }
  }

  function slamPhase(s: Slammer): number {
    return (time + s.offset) % SLAM_CYCLE;
  }

  /** The two spiky jaws: one comes down from the top, one comes up from the bottom. */
  function jawRects(s: Slammer, closed: number): { x: number; y: number; w: number; h: number }[] {
    const x = s.x0 * T;
    const w = (s.x1 - s.x0 + 1) * T;
    const top = s.y0 * T;
    const h = (s.y1 - s.y0 + 1) * T;
    const each = (h / 2) * closed;
    return [
      { x, y: top, w, h: each },
      { x, y: top + h - each, w, h: each },
    ];
  }

  function drawWires(): void {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const w of wires) {
      const color = w.red ? "#e8423a" : "#3a8fe8";
      const center = (tx: number, ty: number): [number, number] => [tx * T + T / 2, ty * T + T / 2];
      const inWire = new Set(w.tiles.map(([x, y]) => `${x},${y}`));
      for (const [tx, ty] of w.tiles) {
        const buried = tileAt(tx, ty) === "O" || tileAt(tx, ty) === "Y";
        const [cx, cy] = center(tx, ty);
        const ends: [number, number][] = [];
        for (const [nx, ny] of [[tx + 1, ty], [tx, ty + 1]] as const) if (inWire.has(`${nx},${ny}`)) ends.push(center(nx, ny));
        // Reach into the gear and the slammer it's plugged into.
        for (const [nx, ny] of [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]] as const) {
          if (tileAt(nx, ny) === "G") ends.push([(cx + nx * T + T / 2) / 2, (cy + ny * T + T / 2) / 2]);
          const sl = slammers[w.slammer];
          if (sl && nx >= sl.x0 && nx <= sl.x1 && ny >= sl.y0 && ny <= sl.y1) ends.push([(cx + nx * T + T / 2) / 2, (cy + ny * T + T / 2) / 2]);
        }
        for (const [ex, ey] of ends) {
          if (buried) {
            // Buried in the wall: you can see it, but you can't cut it.
            ctx.setLineDash([4, 5]);
            ctx.strokeStyle = w.cut ? "rgba(120,120,120,0.4)" : color;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 3;
            sketchLine(cx, cy, ex, ey, 0.5);
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          } else {
            ctx.strokeStyle = "#2b2725";
            ctx.lineWidth = 7;
            sketchLine(cx, cy, ex, ey, 0.6);
            ctx.strokeStyle = w.cut ? "#9a948a" : color;
            ctx.lineWidth = 4;
            sketchLine(cx, cy, ex, ey, 0.6);
          }
        }
      }
      if (w.cut) {
        // A snip mark on the first tile you could reach.
        const t = w.tiles.find(([x, y]) => tileAt(x, y) === "o" || tileAt(x, y) === "x");
        if (t) {
          const [cx, cy] = center(t[0], t[1]);
          ctx.strokeStyle = "#2b2725";
          ctx.lineWidth = 2;
          sketchLine(cx - 6, cy - 6, cx + 6, cy + 6, 0.5);
          sketchLine(cx - 6, cy + 6, cx + 6, cy - 6, 0.5);
        }
      }
    }
  }

  function drawGears(): void {
    for (const g of gears) {
      const cx = g.tx * T + T / 2;
      const cy = g.ty * T + T / 2;
      // Bolted to the wall beside it.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(g.spin + (g.on ? 0 : Math.sin(time * 2) * 0.05));
      ctx.fillStyle = g.on ? "#ffd23f" : "#c8a04a";
      ctx.strokeStyle = "#3d2a14";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? 16 : 12;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3d2a14";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#3d2a14";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -10);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSlammers(): void {
    for (const s of slammers) {
      const closed = slamAmount(s);
      const x = s.x0 * T;
      const w = (s.x1 - s.x0 + 1) * T;
      const top = s.y0 * T;
      const h = (s.y1 - s.y0 + 1) * T;
      const each = (h / 2) * closed;
      const teeth = Math.max(2, Math.round(w / 13));
      // Faint guide marks so you can see where the jaws hide.
      ctx.strokeStyle = "rgba(120, 30, 30, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 6]);
      ctx.strokeRect(x + 2, top, w - 4, h);
      ctx.setLineDash([]);
      for (const jaw of [0, 1] as const) {
        const dir = jaw === 0 ? 1 : -1; // teeth point toward the middle
        // The block (a little sliver always shows so you know it's there).
        const show = Math.max(each, 7);
        const by = jaw === 0 ? top : top + h - show;
        ctx.fillStyle = "#6b4a4a";
        ctx.fillRect(x + 2, by, w - 4, show);
        ctx.strokeStyle = "#2b1d1d";
        ctx.lineWidth = 2.4;
        ctx.strokeRect(x + 2, by, w - 4, show);
        // Spikes along the edge.
        const e = jaw === 0 ? by + show : by;
        ctx.fillStyle = "#ff6b6b";
        ctx.strokeStyle = "#8c1d1d";
        ctx.lineWidth = 1.8;
        for (let i = 0; i < teeth; i++) {
          const tx0 = x + 2 + (i * (w - 4)) / teeth;
          const tw = (w - 4) / teeth;
          ctx.beginPath();
          ctx.moveTo(tx0, e);
          ctx.lineTo(tx0 + tw / 2, e + dir * 11);
          ctx.lineTo(tx0 + tw, e);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  function tileAt(tx: number, ty: number): string {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return "#";
    return grid[ty]?.[tx] ?? "#";
  }

  const isSolid = (c: string): boolean =>
    c === "#" || c === "C" || c === "M" || c === "U" || c === "O" || c === "Y" || c === "K";

  // Water hit a smudged wall: the whole smudge soaks it up together, and once
  // it's wet enough it fades away.
  function soak(tx: number, ty: number): void {
    const group: [number, number][] = [];
    const seen = new Set<string>();
    const todo: [number, number][] = [[tx, ty]];
    while (todo.length) {
      const [x, y] = todo.pop()!;
      const key = `${x},${y}`;
      if (seen.has(key) || tileAt(x, y) !== "U") continue;
      seen.add(key);
      group.push([x, y]);
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    let started = false;
    for (const [x, y] of group) {
      const key = `${x},${y}`;
      wet[key] = (wet[key] ?? 0) + 1;
      if (wet[key]! >= WET_NEEDED && fading[key] === undefined) {
        fading[key] = time;
        started = true;
      }
    }
    if (started) sfx("fade");
  }

  // Every tile the player's box touches.
  function touching(x: number, y: number, fn: (tx: number, ty: number, c: string) => void): void {
    const x0 = Math.floor(x / T);
    const x1 = Math.floor((x + PW - 0.01) / T);
    const y0 = Math.floor(y / T);
    const y1 = Math.floor((y + PH - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) fn(tx, ty, tileAt(tx, ty));
  }

  // A cracked wall breaks all at once: every cracked tile joined to the one you hit.
  function smashWall(tx: number, ty: number): void {
    const todo: [number, number][] = [[tx, ty]];
    while (todo.length) {
      const [x, y] = todo.pop()!;
      if (tileAt(x, y) !== "C") continue;
      grid[y]![x] = ".";
      for (let i = 0; i < 7; i++) {
        bits.push({
          x: x * T + Math.random() * T,
          y: y * T + Math.random() * T,
          vx: player.facing * (150 + Math.random() * 420) + (Math.random() - 0.5) * 200,
          vy: -200 - Math.random() * 400,
          angle: Math.random() * 6,
          spin: (Math.random() - 0.5) * 16,
          size: 5 + Math.random() * 9,
          color: Math.random() < 0.5 ? "#c9a46a" : "#a57d45",
          life: 1.6,
        });
      }
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    shake = Math.max(shake, 0.5);
    sfx("smash");
  }

  // Flick a switch: every bomb goes off.
  function flickSwitch(key: string): void {
    switchFlips[key] = !switchFlips[key];
    sfx("switch");
    for (const b of bombs) explode(b.x, b.y - 8);
    bombs = [];
  }

  function explode(bx: number, by: number): void {
    let brokeMetal = false;
    for (let ty = Math.floor((by - BLAST) / T); ty <= Math.floor((by + BLAST) / T); ty++) {
      for (let tx = Math.floor((bx - BLAST) / T); tx <= Math.floor((bx + BLAST) / T); tx++) {
        if (tileAt(tx, ty) !== "M") continue;
        if (Math.hypot(tx * T + T / 2 - bx, ty * T + T / 2 - by) > BLAST) continue;
        grid[ty]![tx] = ".";
        brokeMetal = true;
        for (let i = 0; i < 8; i++) {
          bits.push({
            x: tx * T + Math.random() * T,
            y: ty * T + Math.random() * T,
            vx: (tx * T + T / 2 - bx) * 8 + (Math.random() - 0.5) * 500,
            vy: -250 - Math.random() * 450,
            angle: Math.random() * 6,
            spin: (Math.random() - 0.5) * 18,
            size: 5 + Math.random() * 8,
            color: Math.random() < 0.5 ? "#9aa3ad" : "#6d7680",
            life: 1.6,
          });
        }
      }
    }
    // A puff of smoke either way.
    for (let i = 0; i < 10; i++) {
      bits.push({
        x: bx, y: by,
        vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 300,
        angle: 0, spin: 0, size: 10 + Math.random() * 10,
        color: "rgba(60,55,50,0.35)", life: 0.6,
      });
    }
    flashes.push({ x: bx, y: by, age: 0, big: brokeMetal });
    if (brokeMetal) {
      sparks(bx, by, 16);
      shake = Math.max(shake, 0.8);
      sfx("boom");
    } else {
      // Not metal: sparks fly and it just goes clink.
      sparks(bx, by, 30);
      shake = Math.max(shake, 0.15);
      sfx("clink");
    }
  }

  function metalHit(x: number, y: number): void {
    sparks(x, y, 18);
    flashes.push({ x, y, age: 0, big: false });
    sfx("clink");
  }

  function sparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 300 + Math.random() * 600;
      bits.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 250,
        angle: 0, spin: 0, size: 3,
        color: ["#ffe14d", "#ffb02e", "#fff6b0"][i % 3]!,
        life: 0.7 + Math.random() * 0.5,
        spark: true,
      });
    }
  }

  function endDash(): void {
    player.dashing = false;
    if (player.dashUp) {
      player.vy = -120; // a little float at the top
    } else {
      player.vx = player.facing * RUN * 0.6;
      player.vy = 0;
    }
    player.dashUp = false;
  }

  function moveX(dx: number): void {
    player.x += dx;
    let hitWall = false;
    let hitMetal = false;
    touching(player.x, player.y, (tx, ty, c) => {
      if (!isSolid(c)) return;
      if (c === "C" && player.dashing && !player.dashUp) {
        smashWall(tx, ty);
        return;
      }
      hitWall = true;
      if (c === "M") hitMetal = true;
      player.x = dx > 0 ? tx * T - PW : (tx + 1) * T;
    });
    // Oscar's rule: the moment you hit a wall, the dash stops.
    // (An Up Dash just slides along walls; only a ceiling stops it.)
    if (hitWall && player.dashing && !player.dashUp) {
      // Dashing can't break metal: sparks fly and it goes clink.
      if (hitMetal) metalHit(dx > 0 ? player.x + PW : player.x, player.y + PH / 2);
      endDash();
      shake = Math.max(shake, 0.25);
    }
  }

  function moveY(dy: number): void {
    player.y += dy;
    player.onGround = false;
    let hitCeiling = false;
    let hitMetal = false;
    touching(player.x, player.y, (tx, ty, c) => {
      // Spikes stop your head from below, but you fall right into them from above.
      if (!(isSolid(c) || (c === "^" && dy < 0))) return;
      // Up Dash smashes cracked ceilings.
      if (c === "C" && player.dashing && player.dashUp) {
        smashWall(tx, ty);
        return;
      }
      // Corner nudge: if an Up Dash only clips the edge of a hole, slide into
      // the hole instead of stopping dead.
      if (dy < 0 && player.dashing && player.dashUp) {
        const overlapLeft = (tx + 1) * T - player.x; // tile is to our left
        const overlapRight = player.x + PW - tx * T; // tile is to our right
        // Only into a real gap: a spike tile is a ceiling from below, not a gap.
        const open = (c2: string): boolean => !isSolid(c2) && c2 !== "^";
        if (overlapLeft > 0 && overlapLeft <= 14 && open(tileAt(tx + 1, ty))) {
          player.x = (tx + 1) * T;
          return;
        }
        if (overlapRight > 0 && overlapRight <= 14 && open(tileAt(tx - 1, ty))) {
          player.x = tx * T - PW;
          return;
        }
      }
      if (dy > 0) {
        player.y = ty * T - PH;
        player.onGround = true;
        player.canDash = true;
        player.canUpDash = true;
      } else {
        player.y = (ty + 1) * T;
        hitCeiling = true;
        if (c === "M") hitMetal = true;
      }
      player.vy = 0;
    });
    // Same rule as the sideways dash: hit something solid and the Up Dash stops.
    if (hitCeiling && player.dashing && player.dashUp) {
      if (hitMetal) metalHit(player.x + PW / 2, player.y);
      endDash();
      player.vy = 0;
      shake = Math.max(shake, 0.25);
    }
  }

  // Back to the flag. Everything you did stays done, but crumbled floors grow
  // back so you can't get stuck.
  function respawnAtCheckpoint(cp: { tx: number; ty: number }): void {
    const original = levelDef().map;
    original.forEach((row, y) =>
      row.split("").forEach((c, x) => {
        if (c === "K" && grid[y]![x] === ".") grid[y]![x] = "K";
      })
    );
    crumbling = {};
    bombs = [];
    drops = [];
    trail = [];
    Object.assign(player, {
      x: cp.tx * T + (T - PW) / 2,
      y: (cp.ty + 1) * T - PH,
      vx: 0,
      vy: 0,
      onGround: true,
      canDash: true,
      canUpDash: true,
      dashing: false,
      dashUp: false,
    });
  }

  function die(): void {
    if (deadUntil) return;
    deaths += 1;
    sfx("die");
    deadUntil = time + 0.7;
    shake = 0.6;
    for (let i = 0; i < 18; i++) {
      bits.push({
        x: player.x + PW / 2,
        y: player.y + PH / 2,
        vx: (Math.random() - 0.5) * 600,
        vy: -Math.random() * 600,
        angle: Math.random() * 6,
        spin: (Math.random() - 0.5) * 20,
        size: 4 + Math.random() * 6,
        color: "#28328c",
        life: 1,
      });
    }
  }

  function step(dt: number): void {
    time += dt;
    shake = Math.max(0, shake - dt * 2);
    for (const b of bits) {
      b.vy += GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      b.life -= dt;
    }
    bits = bits.filter((b) => b.life > 0);
    flashes.forEach((f) => (f.age += dt));
    flashes = flashes.filter((f) => f.age < 0.3);
    trail.forEach((t) => (t.age += dt));
    trail = trail.filter((t) => t.age < 0.25);

    if (finished) return;
    if (clearedAt) {
      if (time - clearedAt > 1.1) {
        clearedAt = 0;
        if (test) {
          loadLevel(levelIndex, false); // the Test Level just starts over
        } else if (demo && (levelIndex + 1 >= LEVELS.length || levelIndex + 1 >= DEMO_ROUTES.length)) {
          loadLevel(0, false); // the demo starts over and over
        } else if (levelIndex + 1 >= LEVELS.length) {
          finished = true;
          popSign = { ...WORLD_DONE_SIGN, shownAt: time, leavingAt: null };
        } else {
          loadLevel(levelIndex + 1, true);
        }
      }
      return;
    }
    if (deadUntil) {
      if (time >= deadUntil) {
        deadUntil = 0;
        if (checkpoint && !demo) respawnAtCheckpoint(checkpoint);
        else loadLevel(levelIndex, false);
      }
      return;
    }

    stepShuffle(dt);
    const p = player;
    p.coyote = p.onGround ? COYOTE : Math.max(0, p.coyote - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    if (p.dashing) {
      p.dashTime += dt;
      const held = p.dashUp ? keys.has("arrowup") || keys.has(" ") : keys.has("d");
      const letGo = !held && p.dashTime >= DASH_MIN;
      if (letGo || p.dashTime >= DASH_MAX) {
        endDash();
      } else {
        trail.push({ x: p.x, y: p.y, age: 0, up: p.dashUp });
        if (p.dashUp) {
          // Straight up, but you keep drifting the way you were running and can
          // steer a little, so you can land next to the hole you just made.
          const dir = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0);
          const drift = dir * RUN * 0.45;
          p.vx += Math.sign(drift - p.vx) * Math.min(Math.abs(drift - p.vx), 2600 * dt);
          if (dir !== 0) p.facing = dir > 0 ? 1 : -1;
          moveX(p.vx * dt);
          moveY(-DASH_SPEED * dt);
        }
        else moveX(p.facing * DASH_SPEED * dt);
      }
    } else {
      const dir = (keys.has("arrowright") ? 1 : 0) - (keys.has("arrowleft") ? 1 : 0);
      const target = dir * RUN;
      const accel = p.onGround ? 2600 : 1600;
      p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), accel * dt);
      if (dir !== 0) p.facing = dir > 0 ? 1 : -1;

      if (p.jumpBuffer > 0 && p.coyote > 0) {
        p.vy = -JUMP;
        sfx("jump");
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
      }
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
      moveX(p.vx * dt);
      moveY(p.vy * dt);
      p.runPhase += Math.abs(p.vx) * dt * 0.05;
    }

    // Slammers squash you if you're caught inside (dashing doesn't save you).
    for (const s of slammers) {
      const closed = slamAmount(s);
      const shut = closed >= 1;
      if (shut && !s.wasShut) {
        const near = Math.abs((s.x0 + s.x1) / 2 * T - p.x) < T * 12;
        if (near) {
          sfx("slam");
          shake = Math.max(shake, 0.2);
        }
      }
      s.wasShut = shut;
      if (closed > 0.12) {
        for (const r of jawRects(s, closed)) {
          if (p.x + PW > r.x + 3 && p.x < r.x + r.w - 3 && p.y + PH > r.y + 2 && p.y < r.y + r.h - 2) die();
        }
      }
    }
    // The Slammers sign goes away by itself.
    if (popSign && popSign.leavingAt === null && (levelIndex === SLAMMER_LEVEL || levelIndex === RAGE_LEVEL) && !test && time - popSign.shownAt > 3.5) {
      popSign.leavingAt = time;
    }

    // Spikes get you, unless you're dashing.
    if (!p.dashing) {
      touching(p.x, p.y, (tx, ty, c) => {
        if (c !== "^") return;
        const spikeTop = ty * T + T * 0.45;
        if (p.y + PH > spikeTop && p.x + PW > tx * T + 4 && p.x < (tx + 1) * T - 4) die();
      });
    }
    if (p.y > WORLD_H) die();

    // Water: hold W to pour (from Level 16 on).
    if (keys.has("w") && unlocked(WATER_LEVEL) && !p.dashing) {
      pourTimer -= dt;
      while (pourTimer <= 0) {
        pourTimer += 1 / 34;
        drops.push({
          // Out of the watering can's spout, held out in front.
          x: p.x + PW / 2 + p.facing * 31,
          y: p.y + 9,
          vx: p.facing * (300 + Math.random() * 80) + p.vx * 0.5,
          vy: -140 + Math.random() * 60,
        });
      }
    } else {
      pourTimer = 0;
    }
    for (const d of drops) {
      d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * dt);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const tx = Math.floor(d.x / T);
      const ty = Math.floor(d.y / T);
      const c = tileAt(tx, ty);
      if (isSolid(c)) {
        if (c === "U") soak(tx, ty);
        d.y = 1e9; // gone
        for (let i = 0; i < 2; i++) {
          bits.push({
            x: d.x - Math.sign(d.vx) * 2, y: d.y > 1e8 ? ty * T + T / 2 : d.y,
            vx: -d.vx * 0.2 + (Math.random() - 0.5) * 160, vy: -100 - Math.random() * 160,
            angle: 0, spin: 0, size: 2.5, color: "#5fb4ff", life: 0.35,
          });
        }
        if (splashCount++ % 5 === 0) sfx("splash");
      }
    }
    drops = drops.filter((d) => d.y < WORLD_H + 20);
    // Fully faded smudges are gone.
    for (const [key, start] of Object.entries(fading)) {
      if (time - start < FADE_TIME) continue;
      const [x, y] = key.split(",").map(Number) as [number, number];
      if (tileAt(x, y) === "U") grid[y]![x] = ".";
    }

    // Bombs drop until they land on something.
    for (const b of bombs) {
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
      const ny = b.y + b.vy * dt;
      const below = tileAt(Math.floor(b.x / T), Math.floor(ny / T));
      if (isSolid(below)) {
        b.y = Math.floor(ny / T) * T;
        b.vy = 0;
      } else {
        b.y = ny;
      }
    }
    bombs = bombs.filter((b) => b.y < WORLD_H + 40);

    // Gears: run into one to turn it.
    let inGear = "";
    touching(p.x, p.y, (tx, ty, c) => {
      if (c === "G") inGear = `${tx},${ty}`;
    });
    if (inGear && inGear !== onGear) {
      const g = gears.find((gg) => `${gg.tx},${gg.ty}` === inGear);
      if (g && !g.on) {
        g.on = true;
        sfx("gear");
      }
    }
    onGear = inGear;
    for (const g of gears) if (g.on && g.spin < Math.PI) g.spin = Math.min(Math.PI, g.spin + dt * 6);

    // Switches: run into one to flick it.
    let inSwitch = "";
    touching(p.x, p.y, (tx, ty, c) => {
      if (c === "S") inSwitch = `${tx},${ty}`;
    });
    if (inSwitch && inSwitch !== onSwitch) flickSwitch(inSwitch);
    onSwitch = inSwitch;

    // Checkpoint flags: touch one to save your spot.
    touching(p.x, p.y, (tx, ty, c) => {
      if (c === "H" && (checkpoint?.tx !== tx || checkpoint?.ty !== ty)) {
        checkpoint = { tx, ty };
        sfx("flag");
      }
    });

    // Fake exits: touch one and it slams you. Nyah nyah!
    touching(p.x, p.y, (tx, ty, c) => {
      if (c !== "F" || deadUntil) return;
      fakesFound[`${tx},${ty}`] = true;
      sfx("slam");
      sfx("laugh");
      die();
    });

    // Crumbling floors: stand on one and it breaks a moment later.
    if (p.onGround) {
      const ty = Math.floor((p.y + PH + 1) / T);
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + PW - 0.01) / T); tx++) {
        const key = `${tx},${ty}`;
        if (tileAt(tx, ty) === "K" && crumbling[key] === undefined) crumbling[key] = time;
      }
    }
    for (const [key, start] of Object.entries(crumbling)) {
      if (time - start < CRUMBLE_TIME) continue;
      const [x, y] = key.split(",").map(Number) as [number, number];
      delete crumbling[key];
      if (tileAt(x, y) !== "K") continue;
      grid[y]![x] = ".";
      sfx("crumble");
      for (let i = 0; i < 6; i++) {
        bits.push({
          x: x * T + Math.random() * T, y: y * T + Math.random() * T * 0.5,
          vx: (Math.random() - 0.5) * 160, vy: Math.random() * 100,
          angle: Math.random() * 6, spin: (Math.random() - 0.5) * 10, size: 6 + Math.random() * 8,
          color: Math.random() < 0.5 ? "#e3dccb" : "#cfc6b0", life: 1.2,
        });
      }
    }

    // Reached the exit?
    touching(p.x, p.y, (_tx, _ty, c) => {
      if (c === "X") reachExit();
    });
  }

  // ---- Drawing: everything wobbles a little, like it's drawn by hand. ----

  let boil = 0; // changes a few times a second so the lines "boil" like a cartoon
  function wob(x: number, y: number, amount = 1.6): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + boil * 37.719) * 43758.5453;
    return (n - Math.floor(n) - 0.5) * 2 * amount;
  }

  function sketchLine(x1: number, y1: number, x2: number, y2: number, amount = 1.6): void {
    const mx = (x1 + x2) / 2 + wob(x1, y2, amount);
    const my = (y1 + y2) / 2 + wob(y1, x2, amount);
    ctx.beginPath();
    ctx.moveTo(x1 + wob(x1, y1, amount * 0.6), y1 + wob(y1, x1, amount * 0.6));
    ctx.quadraticCurveTo(mx, my, x2 + wob(x2, y2, amount * 0.6), y2 + wob(y2, x2, amount * 0.6));
    ctx.stroke();
  }

  function drawPaper(): void {
    ctx.fillStyle = "#f7f1e1";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = "rgba(90, 140, 210, 0.22)";
    ctx.lineWidth = 1;
    for (let y = T * 0.75; y < WORLD_H; y += T * 0.75) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(220, 80, 80, 0.3)";
    ctx.beginPath();
    ctx.moveTo(T * 1.6, 0);
    ctx.lineTo(T * 1.6, WORLD_H);
    ctx.stroke();
  }

  function drawTiles(): void {
    ctx.lineCap = "round";
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const c = tileAt(tx, ty);
        const x = tx * T;
        const y = ty * T;
        if (c === "#" || c === "O" || c === "Y") {
          // Pencil shading, then ink only on the edges that face open air.
          ctx.fillStyle = "#e3dccb";
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = "rgba(60, 55, 50, 0.28)";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 4; i++) {
            const o = i * 11 + 4;
            sketchLine(x + o, y + T, x + o + 10, y, 0.8);
          }
          ctx.strokeStyle = "#2b2725";
          ctx.lineWidth = 2.6;
          if (!isSolid(tileAt(tx, ty - 1))) sketchLine(x, y, x + T, y);
          if (!isSolid(tileAt(tx, ty + 1))) sketchLine(x, y + T, x + T, y + T);
          if (!isSolid(tileAt(tx - 1, ty))) sketchLine(x, y, x, y + T);
          if (!isSolid(tileAt(tx + 1, ty))) sketchLine(x + T, y, x + T, y + T);
        } else if (c === "C") {
          ctx.fillStyle = "#e8cf9c";
          ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
          ctx.strokeStyle = "#5b3d1c";
          ctx.lineWidth = 2.4;
          sketchLine(x, y, x + T, y);
          sketchLine(x, y + T, x + T, y + T);
          sketchLine(x, y, x, y + T);
          sketchLine(x + T, y, x + T, y + T);
          // The cracks.
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 8);
          ctx.lineTo(x + 17, y + 18);
          ctx.lineTo(x + 13, y + 26);
          ctx.lineTo(x + 24, y + 34);
          ctx.moveTo(x + 17, y + 18);
          ctx.lineTo(x + 31, y + 12);
          ctx.moveTo(x + 24, y + 34);
          ctx.lineTo(x + 34, y + 30);
          ctx.stroke();
        } else if (c === "^") {
          ctx.fillStyle = "#ff6b6b";
          ctx.strokeStyle = "#8c1d1d";
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const bx = x + i * (T / 3);
            ctx.beginPath();
            ctx.moveTo(bx + wob(bx, y, 1), y + T);
            ctx.lineTo(bx + T / 6 + wob(bx, y + 1, 1.5), y + T * 0.42 + wob(bx, y + 2, 1.5));
            ctx.lineTo(bx + T / 3 + wob(bx, y + 3, 1), y + T);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else if (c === "F") {
          // A FAKE exit. It looks just like the real one... except the knob is
          // on the wrong side. Once it gets you, it shows its teeth.
          const found = fakesFound[`${tx},${ty}`] === true;
          ctx.fillStyle = found ? "#e8a0a0" : "#9be59b";
          ctx.fillRect(x + 4, y - T * 0.55, T - 8, T * 1.55);
          ctx.strokeStyle = found ? "#8c1d1d" : "#1f6b2a";
          ctx.lineWidth = 2.6;
          sketchLine(x + 4, y + T, x + 4, y - T * 0.55);
          sketchLine(x + 4, y - T * 0.55, x + T - 4, y - T * 0.55);
          sketchLine(x + T - 4, y - T * 0.55, x + T - 4, y + T);
          ctx.fillStyle = found ? "#8c1d1d" : "#1f6b2a";
          ctx.beginPath();
          ctx.arc(x + 11, y + T * 0.35, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "15px 'Patrick Hand', 'Comic Sans MS', cursive";
          ctx.textAlign = "center";
          ctx.fillText(found ? "FAKE!" : "EXIT", x + T / 2, y - T * 0.72);
          if (found) {
            ctx.fillStyle = "#ff6b6b";
            ctx.strokeStyle = "#8c1d1d";
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
              const bx = x + 6 + i * 9.5;
              ctx.beginPath();
              ctx.moveTo(bx, y + 2);
              ctx.lineTo(bx + 4.5, y + 14);
              ctx.lineTo(bx + 9, y + 2);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }
        } else if (c === "K") {
          // A crumbling floor: looks a lot like a normal wall, with thin cracks.
          const start = crumbling[`${tx},${ty}`];
          const wobble = start !== undefined ? Math.sin(time * 70) * 2 : 0;
          ctx.save();
          ctx.translate(wobble, 0);
          ctx.fillStyle = "#e6dfcd";
          ctx.fillRect(x, y, T, T);
          ctx.strokeStyle = "rgba(60, 55, 50, 0.25)";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 4; i++) sketchLine(x + i * 11 + 4, y + T, x + i * 11 + 14, y, 0.8);
          ctx.strokeStyle = "rgba(60, 55, 50, 0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 8, y);
          ctx.lineTo(x + 12, y + 9);
          ctx.lineTo(x + 9, y + 15);
          ctx.moveTo(x + 27, y);
          ctx.lineTo(x + 24, y + 7);
          ctx.stroke();
          ctx.strokeStyle = "#2b2725";
          ctx.lineWidth = 2.6;
          if (!isSolid(tileAt(tx, ty - 1))) sketchLine(x, y, x + T, y);
          if (!isSolid(tileAt(tx - 1, ty))) sketchLine(x, y, x, y + T);
          if (!isSolid(tileAt(tx + 1, ty))) sketchLine(x + T, y, x + T, y + T);
          ctx.restore();
        } else if (c === "H") {
          // A checkpoint flag. Red until you touch it, then green.
          const got = checkpoint?.tx === tx && checkpoint?.ty === ty;
          ctx.strokeStyle = "#3d2a14";
          ctx.lineWidth = 3;
          sketchLine(x + 10, y + T, x + 10, y - T * 0.5);
          ctx.fillStyle = got ? "#4fc25a" : "#e8423a";
          ctx.strokeStyle = got ? "#1f6b2a" : "#8c1d1d";
          ctx.lineWidth = 2;
          const fy = got ? y - T * 0.5 : y - T * 0.1;
          const flap = Math.sin(time * 6 + tx) * 2;
          ctx.beginPath();
          ctx.moveTo(x + 11, fy);
          ctx.lineTo(x + 32, fy + 7 + flap);
          ctx.lineTo(x + 11, fy + 15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (c === "X") {
          // A door with EXIT scribbled on it.
          ctx.fillStyle = "#9be59b";
          ctx.fillRect(x + 4, y - T * 0.55, T - 8, T * 1.55);
          ctx.strokeStyle = "#1f6b2a";
          ctx.lineWidth = 2.6;
          sketchLine(x + 4, y + T, x + 4, y - T * 0.55);
          sketchLine(x + 4, y - T * 0.55, x + T - 4, y - T * 0.55);
          sketchLine(x + T - 4, y - T * 0.55, x + T - 4, y + T);
          ctx.fillStyle = "#1f6b2a";
          ctx.beginPath();
          ctx.arc(x + T - 11, y + T * 0.35, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "15px 'Patrick Hand', 'Comic Sans MS', cursive";
          ctx.textAlign = "center";
          ctx.fillText("EXIT", x + T / 2, y - T * 0.72);
        } else if (c === "U") {
          // A slightly smudged wall: smeary pencil. Water makes it fade away.
          const key = `${tx},${ty}`;
          const start = fading[key];
          const soaked = Math.min(1, (wet[key] ?? 0) / WET_NEEDED);
          const alpha = start !== undefined ? Math.max(0, 1 - (time - start) / FADE_TIME) : 1 - soaked * 0.35;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#c9c4bb";
          ctx.fillRect(x, y, T, T);
          for (let i = 0; i < 3; i++) {
            const g = ctx.createRadialGradient(x + 10 + i * 10, y + 12 + (i % 2) * 14, 2, x + 10 + i * 10, y + 12 + (i % 2) * 14, 18);
            g.addColorStop(0, "rgba(60, 58, 66, 0.55)");
            g.addColorStop(1, "rgba(60, 58, 66, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(x, y, T, T);
          }
          ctx.strokeStyle = "rgba(50, 48, 55, 0.45)";
          ctx.lineWidth = 3;
          sketchLine(x + 4, y + 30, x + 34, y + 8, 2.5);
          ctx.strokeStyle = "rgba(43, 39, 37, 0.7)";
          ctx.lineWidth = 2;
          if (tileAt(tx, ty - 1) !== "U") sketchLine(x, y, x + T, y, 2.4);
          if (tileAt(tx, ty + 1) !== "U") sketchLine(x, y + T, x + T, y + T, 2.4);
          if (tileAt(tx - 1, ty) !== "U") sketchLine(x, y, x, y + T, 2.4);
          if (tileAt(tx + 1, ty) !== "U") sketchLine(x + T, y, x + T, y + T, 2.4);
          if (soaked > 0) {
            ctx.fillStyle = `rgba(95, 180, 255, ${0.35 * soaked})`;
            ctx.fillRect(x, y, T, T);
          }
          ctx.restore();
        } else if (c === "M") {
          // Metal: grey plate with rivets. Only bombs break it.
          ctx.fillStyle = "#b8c0c8";
          ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
          ctx.strokeStyle = "#3b4148";
          ctx.lineWidth = 2.4;
          sketchLine(x, y, x + T, y);
          sketchLine(x, y + T, x + T, y + T);
          sketchLine(x, y, x, y + T);
          sketchLine(x + T, y, x + T, y + T);
          ctx.fillStyle = "#3b4148";
          for (const [rx, ry] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]] as const) {
            ctx.beginPath();
            ctx.arc(x + rx, y + ry, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1.5;
          sketchLine(x + 10, y + 12, x + 26, y + 12, 0.6);
        } else if (c === "S") {
          // A switch: a plate screwed onto the wall beside it, with a lever
          // sticking out. Flicked, it points up and turns green.
          const flipped = switchFlips[`${tx},${ty}`] === true;
          const wallOnLeft = isSolid(tileAt(tx - 1, ty));
          const side = wallOnLeft ? 1 : -1; // which way the lever sticks out
          const plateX = wallOnLeft ? x : x + T - 9;
          ctx.fillStyle = "#d9d2c0";
          ctx.fillRect(plateX, y + 8, 9, T - 14);
          ctx.strokeStyle = "#2b2725";
          ctx.lineWidth = 2;
          ctx.strokeRect(plateX, y + 8, 9, T - 14);
          const baseX = wallOnLeft ? x + 9 : x + T - 9;
          const baseY = y + T / 2 + 1;
          const tipX = baseX + side * 13;
          const tipY = flipped ? baseY - 13 : baseY + 13;
          ctx.strokeStyle = flipped ? "#1f8a3a" : "#c0392b";
          ctx.lineWidth = 4;
          sketchLine(baseX, baseY, tipX, tipY, 0.6);
          ctx.fillStyle = flipped ? "#1f8a3a" : "#c0392b";
          ctx.beginPath();
          ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (c === "?") {
          drawLittleSign(x, y);
        }
      }
    }
  }

  function drawLittleSign(x: number, y: number): void {
    ctx.strokeStyle = "#5b3d1c";
    ctx.lineWidth = 3;
    sketchLine(x + T / 2, y + T, x + T / 2, y + T * 0.3);
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(x + 6, y + 2, T - 12, T * 0.42);
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 2, T - 12, T * 0.42);
    ctx.fillStyle = "#5b3d1c";
    ctx.font = "bold 16px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x + T / 2, y + 2 + T * 0.21);

    // Read it when you're standing near it.
    const near = Math.abs(player.x + PW / 2 - (x + T / 2)) < T * 2 && Math.abs(player.y + PH / 2 - (y + T / 2)) < T * 2;
    if (!near) return;
    const text = levelDef().sign;
    ctx.font = "20px 'Patrick Hand', 'Comic Sans MS', cursive";
    const w = ctx.measureText(text).width + 24;
    const bx = Math.min(Math.max(x + T / 2 - w / 2, 8), WORLD_W - w - 8);
    const by = y - 60;
    ctx.fillStyle = "#fffdf5";
    ctx.strokeStyle = "#2b2725";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, 36, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2b2725";
    ctx.fillText(text, bx + w / 2, by + 19);
  }

  function drawPlayer(): void {
    if (deadUntil) return;
    const p = player;
    for (const t of trail) {
      ctx.strokeStyle = `rgba(40, 50, 140, ${0.35 * (1 - t.age / 0.25)})`;
      ctx.lineWidth = 2;
      if (t.up) {
        sketchLine(t.x + 6, t.y + PH + 4, t.x + 6, t.y + PH + 24, 1);
        sketchLine(t.x + PW - 6, t.y + PH + 4, t.x + PW - 6, t.y + PH + 20, 1);
      } else {
        sketchLine(t.x + PW / 2 - p.facing * 14, t.y + 10, t.x + PW / 2 - p.facing * 34, t.y + 10, 1);
        sketchLine(t.x + PW / 2 - p.facing * 14, t.y + 24, t.x + PW / 2 - p.facing * 30, t.y + 24, 1);
      }
    }

    const cx = p.x + PW / 2;
    const top = p.y;
    const lean = p.dashing && !p.dashUp ? p.facing * 7 : 0;
    ctx.strokeStyle = "#28328c";
    ctx.fillStyle = "#fffdf5";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";

    // Head.
    ctx.beginPath();
    ctx.arc(cx + lean + wob(cx, top, 0.6), top + 6.5, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#28328c";
    ctx.beginPath();
    ctx.arc(cx + lean + p.facing * 3, top + 6, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Body, arms and legs.
    // Short body, long legs (Oscar: "where are my legs?").
    const hip = { x: cx, y: top + 21 };
    const neck = { x: cx + lean, y: top + 13 };
    sketchLine(neck.x, neck.y, hip.x, hip.y, 0.8);
    const swing = p.onGround && !p.dashing ? Math.sin(p.runPhase) * 7 : p.dashing ? 0 : 4;
    const pouring = keys.has("w") && unlocked(WATER_LEVEL) && !p.dashing;
    if (pouring) {
      // Both arms hold a watering can out in front.
      const f = p.facing;
      sketchLine(neck.x, neck.y + 3, neck.x + f * 13, neck.y + 1, 0.6);
      sketchLine(neck.x, neck.y + 3, neck.x + f * 12, neck.y + 6, 0.6);
      const canX = cx + f * 20;
      const canY = top + 15;
      ctx.fillStyle = "#5fb4ff";
      ctx.strokeStyle = "#1f5f9a";
      ctx.lineWidth = 2;
      ctx.fillRect(canX - 6, canY - 5, 12, 11);
      ctx.strokeRect(canX - 6, canY - 5, 12, 11);
      sketchLine(canX + f * 6, canY + 1, canX + f * 12, canY - 6, 0.4); // spout
      ctx.beginPath();
      ctx.arc(canX, canY - 6, 5, Math.PI, 0); // handle
      ctx.stroke();
      ctx.strokeStyle = "#28328c";
      ctx.lineWidth = 2.8;
    } else if (p.dashing) {
      sketchLine(neck.x, neck.y + 3, neck.x - p.facing * 11, neck.y + 1, 0.6);
      sketchLine(neck.x, neck.y + 3, neck.x - p.facing * 10, neck.y + 9, 0.6);
    } else {
      sketchLine(neck.x, neck.y + 3, neck.x - 9, neck.y + 9 + swing * 0.4, 0.6);
      sketchLine(neck.x, neck.y + 3, neck.x + 9, neck.y + 9 - swing * 0.4, 0.6);
    }
    sketchLine(hip.x, hip.y, hip.x - 6 + swing, top + PH, 0.6);
    sketchLine(hip.x, hip.y, hip.x + 6 - swing, top + PH, 0.6);
    // Scissors snipping in front of you for a moment after you press S.
    if (time - snipAt < 0.3) {
      const sx = cx + p.facing * 16;
      const sy = top + 14;
      const open = Math.abs(Math.sin((time - snipAt) * 20)) * 0.5;
      ctx.strokeStyle = "#5a5a66";
      ctx.lineWidth = 2.4;
      for (const sgn of [1, -1]) {
        const a = sgn * open;
        sketchLine(sx, sy, sx + p.facing * Math.cos(a) * 14, sy + Math.sin(a) * 14, 0.3);
      }
      ctx.strokeStyle = "#e8423a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx - p.facing * 4, sy - 3, 3, 0, Math.PI * 2);
      ctx.arc(sx - p.facing * 4, sy + 3, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawDrops(): void {
    ctx.fillStyle = "#5fb4ff";
    ctx.strokeStyle = "#1f5f9a";
    ctx.lineWidth = 1.2;
    for (const d of drops) {
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 3, 4.5, Math.atan2(d.vy, d.vx) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawBombs(): void {
    for (const b of bombs) {
      const cy = b.y - 9;
      ctx.fillStyle = "#2b2725";
      ctx.beginPath();
      ctx.arc(b.x + wob(b.x, cy, 0.5), cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a57d45";
      ctx.lineWidth = 2;
      sketchLine(b.x + 4, cy - 7, b.x + 9, cy - 14, 1);
      // The fuse spark.
      ctx.fillStyle = Math.floor(time * 12) % 2 ? "#ffd23f" : "#ff6b3d";
      ctx.beginPath();
      ctx.arc(b.x + 9, cy - 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBits(): void {
    // Flash where a bomb went off.
    for (const f of flashes) {
      const r = (f.big ? 70 : 34) * (0.4 + f.age * 3);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255, 250, 200, ${1 - f.age / 0.3})`);
      g.addColorStop(0.5, `rgba(255, 190, 60, ${0.7 * (1 - f.age / 0.3)})`);
      g.addColorStop(1, "rgba(255, 140, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of bits) {
      if (b.spark) {
        // A glowing streak pointing the way the spark is flying.
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.life * 2);
        ctx.strokeStyle = b.color;
        ctx.shadowColor = "#ffb02e";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.globalAlpha = Math.min(1, b.life * 2);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = "#3d2a14";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-b.size / 2, -b.size / 3);
      ctx.lineTo(b.size / 2, -b.size / 2);
      ctx.lineTo(b.size / 3, b.size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // The big sign that pops up when you unlock a new move.
  function drawPopSign(): void {
    if (!popSign) return;
    const age = time - popSign.shownAt;
    let s = easeOutBack(Math.min(1, age / 0.45));
    let dropY = 0;
    if (popSign.leavingAt !== null) {
      const out = time - popSign.leavingAt;
      dropY = out * out * 2400;
      if (dropY > WORLD_H) {
        popSign = null;
        return;
      }
    }
    s = Math.max(0.01, s);
    const w = 660;
    const h = 64 + popSign.lines.length * 34;
    ctx.save();
    ctx.translate(WORLD_W / 2, WORLD_H * 0.36 + dropY);
    ctx.rotate(-0.03 + Math.sin(time * 2) * 0.01);
    ctx.scale(s, s);
    // Post.
    ctx.fillStyle = "#a57d45";
    ctx.fillRect(-9, h / 2 - 6, 18, 120);
    ctx.strokeStyle = "#3d2a14";
    ctx.lineWidth = 3;
    ctx.strokeRect(-9, h / 2 - 6, 18, 120);
    // Board.
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 14);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#c0392b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "40px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.fillText(popSign.title, 0, -h / 2 + 34);
    ctx.fillStyle = "#3d2a14";
    ctx.font = "28px 'Patrick Hand', 'Comic Sans MS', cursive";
    popSign.lines.forEach((line, i) => ctx.fillText(line, 0, -h / 2 + 76 + i * 34));
    ctx.restore();
  }

  function drawHud(w: number): void {
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.fillStyle = "#fff3e0";
    ctx.textBaseline = "middle";
    ctx.font = "22px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    const name = levelDef().name;
    ctx.fillText(`${test ? "Test Level" : `Level ${levelIndex + 1}`}${name ? `: ${name}` : ""}   ·   Deaths: ${deaths}`, w / 2, 26);
    // Controls go under the paper, out of the way of the Credits button.
    ctx.font = "17px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.fillStyle = "rgba(255, 243, 224, 0.75)";
    const below = Math.min(window.innerHeight - 14, offY + WORLD_H * scale + 24);
    // Only show the moves you've unlocked so far.
    const parts = ["←/→ move", "↑ or Space jump", "hold D dash"];
    if (unlocked(UP_DASH_LEVEL)) parts.push("Jump in air: Up Dash");
    if (unlocked(BOMB_LEVEL)) parts.push("B bomb");
    if (unlocked(WATER_LEVEL)) parts.push("hold W water");
    if (unlocked(SCISSORS_LEVEL)) parts.push("S scissors");
    parts.push("R restart", "Esc menu");
    ctx.fillText(parts.join("   ·   "), w / 2, below);
  }

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#120c10";
    ctx.fillRect(0, 0, w, h);

    const sx = (Math.random() - 0.5) * shake * 14;
    const sy = (Math.random() - 0.5) * shake * 14;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + sx), dpr * (offY + sy));
    drawPaper();
    drawTiles();
    drawShuffle();
    drawPlayer();
    drawWires();
    drawGears();
    drawSlammers();
    drawBombs();
    drawDrops();
    drawBits();
    if (clearedAt) {
      ctx.fillStyle = "#1f6b2a";
      ctx.font = "64px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(test ? "TEST CLEAR!" : "LEVEL CLEAR!", WORLD_W / 2, WORLD_H * 0.3);
    }
    drawPopSign();
    if (!demo) drawHud(w);
  }

  let last = performance.now();
  let rafId = 0;
  function frame(now: number): void {
    if (stopped) return;
    let dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (demo) demoTick(dt * 1000);
    boil = Math.floor(now / 140) % 3;
    // Small steps so a fast dash can't skip through a thin wall.
    while (dt > 0) {
      const d = Math.min(dt, 1 / 240);
      step(d);
      dt -= d;
    }
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function keyDown(k: string): void {
    // In the Door Shuffle you're trapped until the walls open.
    if (locked() && k !== "r") return;
    if (k === "arrowdown") pickDoor();
    keys.add(k);
    if (finished) return;
    const jumpKey = k === "arrowup" || k === " ";
    // Up Dash: press Jump again while you're in the air (from Level 6 on).
    const inAir = !player.onGround && player.coyote <= 0;
    if (jumpKey && inAir && unlocked(UP_DASH_LEVEL) && !player.dashing && player.canUpDash && !deadUntil && !clearedAt) {
      player.dashing = true;
      player.dashUp = true;
      sfx("upDash");
      player.dashTime = 0;
      player.canUpDash = false;
      player.vy = 0;
      player.jumpBuffer = 0;
      if (popSign && popSign.leavingAt === null && LEVELS[levelIndex]?.popSign) popSign.leavingAt = time;
      return;
    }
    if (jumpKey) player.jumpBuffer = JUMP_BUFFER;
    if (k === "w" && levelIndex === WATER_LEVEL && popSign && popSign.leavingAt === null) popSign.leavingAt = time;
    // Scissors: press S to cut a wire (from Level 26 on).
    if (k === "s" && unlocked(SCISSORS_LEVEL) && !deadUntil && !clearedAt) {
      useScissors();
      if (popSign && popSign.leavingAt === null && levelIndex === SCISSORS_LEVEL) popSign.leavingAt = time;
    }
    // Bombs: press B to drop one (from Level 11 on).
    if (k === "b" && unlocked(BOMB_LEVEL) && !deadUntil && !clearedAt && bombs.length < MAX_BOMBS) {
      bombs.push({ x: player.x + PW / 2, y: player.y + PH, vy: 0 });
      sfx("bomb");
      if (popSign && popSign.leavingAt === null && levelIndex === BOMB_LEVEL) popSign.leavingAt = time;
    }
    if (k === "r" && !clearedAt) {
      deadUntil = 0;
      loadLevel(levelIndex, false);
    }
    if (k === "d" && !player.dashing && player.canDash && !deadUntil && !clearedAt) {
      player.dashing = true;
      player.dashUp = false;
      sfx("dash");
      player.dashTime = 0;
      player.canDash = false;
      player.vy = 0;
      // You read the sign and dashed: off it goes.
      if (popSign && popSign.leavingAt === null && levelIndex < UP_DASH_LEVEL) popSign.leavingAt = time;
    }
  }

  // ---- The demo: the game plays itself behind the menu, over and over. ----
  // Each level's route is a little script. They're the same moves the tests use
  // to prove every level can be beaten.
  type Route = Generator<void, void, number>;
  const botKeys = {
    down: (k: string) => { if (!keys.has(k)) keyDown(k); },
    up: (k: string) => keys.delete(k),
  };
  const ptx = (): number => Math.floor((player.x + PW / 2) / T);
  function* wait(ms: number): Route {
    let t = 0;
    while (t < ms) t += yield;
  }
  function* walkTo(tx: number): Route {
    const k = ptx() < tx ? "arrowright" : "arrowleft";
    botKeys.down(k);
    let guard = 0;
    while (ptx() !== tx && guard++ < 600) yield;
    botKeys.up(k);
    yield* wait(120);
  }
  function* hold(k: string, ms: number): Route {
    botKeys.down(k);
    yield* wait(ms);
    botKeys.up(k);
  }
  function* jumpDash(delay: number, ms: number): Route {
    botKeys.down("arrowup");
    yield* wait(delay);
    botKeys.down("d");
    yield* wait(ms);
    botKeys.up("d");
    botKeys.up("arrowup");
    yield* wait(600);
  }
  function* upDash(ms: number, k: string, drift = 500): Route {
    botKeys.down(k);
    botKeys.down("arrowup");
    yield* wait(130);
    botKeys.up("arrowup");
    yield* wait(32);
    botKeys.down("arrowup");
    yield* wait(ms);
    botKeys.up("arrowup");
    yield* wait(drift);
    botKeys.up(k);
    yield* wait(600);
  }
  // Wait until the slammer at this column has just opened all the way.
  function* waitSafe(tx: number): Route {
    const s = slammers.find((m) => tx >= m.x0 && tx <= m.x1);
    if (!s) return;
    let guard = 0;
    while (guard++ < 2000) {
      const ph = slamPhase(s);
      if (ph < 0.35 && slamAmount(s) === 0) return;
      yield;
    }
  }
  const R = "arrowright";
  const L = "arrowleft";
  const DEMO_ROUTES: (() => Route)[] = [
    function* () { yield* walkTo(6); yield* hold("d", 600); yield* walkTo(29); },
    function* () { yield* walkTo(12); yield* hold("d", 600); yield* walkTo(28); },
    function* () { yield* walkTo(4); yield* hold(R, 60); yield* jumpDash(180, 260); yield* walkTo(14); yield* hold("d", 600); yield* walkTo(29); },
    function* () {
      yield* walkTo(3); yield* hold("d", 600); yield* walkTo(26);
      botKeys.down(R);
      for (let i = 0; i < 3; i++) { yield* hold("arrowup", 350); yield* wait(250); }
      botKeys.up(R);
      yield* wait(200);
      botKeys.down(L);
      let guard = 0;
      while (ptx() > 27 && guard++ < 200) yield;
      yield* hold("arrowup", 450);
      yield* wait(300);
      botKeys.up(L);
      yield* wait(200);
      yield* walkTo(19); yield* hold("d", 600); yield* walkTo(3);
    },
    function* () {
      // Door Shuffle: the bot never loses track (it peeks).
      let guard = 0;
      while ((!shuffle || shuffle.phase !== "pick") && guard++ < 3000) yield;
      if (!shuffle) return;
      yield* walkTo(Math.floor(doorX(shuffle.slotOf[shuffle.real]!) / T));
      yield* hold("arrowdown", 40);
    },
    function* () { yield* walkTo(14); yield* upDash(300, R); yield* walkTo(27); },
    function* () { yield* walkTo(4); yield* hold("d", 600); yield* walkTo(14); yield* upDash(300, R); yield* walkTo(21); yield* hold("d", 600); yield* walkTo(27); },
    function* () { yield* walkTo(21); yield* upDash(300, L, 150); yield* walkTo(16); yield* hold("d", 600); yield* walkTo(6); yield* upDash(300, R); yield* walkTo(27); },
    function* () { yield* walkTo(4); yield* hold("d", 600); yield* walkTo(25); yield* upDash(300, L); yield* walkTo(19); yield* hold("d", 600); yield* walkTo(3); },
    function* () { yield* walkTo(4); yield* upDash(300, R, 250); yield* walkTo(9); yield* hold("d", 300); yield* walkTo(16); yield* hold("d", 600); yield* walkTo(29); },
    function* () { yield* walkTo(14); yield* hold("b", 40); yield* wait(300); yield* walkTo(1); yield* wait(300); yield* walkTo(28); },
    function* () { yield* walkTo(21); yield* hold("b", 40); yield* wait(300); yield* walkTo(1); yield* wait(300); yield* walkTo(21); yield* wait(800); yield* walkTo(28); },
    function* () { yield* walkTo(8); yield* hold("d", 600); yield* walkTo(22); yield* hold("b", 40); yield* walkTo(18); yield* hold("d", 600); yield* walkTo(1); yield* wait(300); yield* walkTo(8); yield* hold("d", 600); yield* walkTo(29); },
    function* () {
      yield* walkTo(13); yield* upDash(300, R, 300); yield* walkTo(21); yield* hold("b", 40);
      yield* walkTo(17); yield* hold("d", 300);
      yield* walkTo(1); yield* wait(300);
      yield* walkTo(10); yield* hold("d", 300);
      yield* walkTo(28);
    },
    function* () { yield* walkTo(4); yield* hold("d", 600); yield* walkTo(17); yield* hold("b", 40); yield* walkTo(14); yield* upDash(300, R, 300); yield* walkTo(30); yield* wait(300); yield* walkTo(16); yield* wait(900); yield* walkTo(29); },
    function* () { yield* walkTo(13); yield* hold("w", 900); yield* wait(500); yield* walkTo(28); },
    function* () { yield* walkTo(19); yield* hold("w", 900); yield* wait(500); yield* walkTo(21); yield* wait(700); yield* walkTo(28); },
    function* () { yield* walkTo(5); yield* hold("d", 600); yield* walkTo(18); yield* hold("w", 900); yield* wait(500); yield* walkTo(28); },
    function* () { yield* walkTo(9); yield* upDash(300, R, 300); yield* walkTo(18); yield* hold("w", 900); yield* wait(500); yield* walkTo(28); },
    function* () {
      yield* walkTo(6); yield* hold("w", 900); yield* wait(500);
      yield* walkTo(11); yield* hold("d", 600); yield* walkTo(23); yield* hold("b", 40);
      yield* walkTo(19); yield* hold("d", 600); yield* walkTo(1); yield* wait(300);
      yield* walkTo(11); yield* hold("d", 600); yield* walkTo(28);
    },
    function* () { yield* walkTo(12); yield* waitSafe(14); yield* walkTo(28); },
    function* () { yield* walkTo(7); yield* waitSafe(9); yield* walkTo(13); yield* waitSafe(15); yield* walkTo(20); yield* waitSafe(22); yield* walkTo(28); },
    function* () { yield* walkTo(5); yield* hold("d", 600); yield* walkTo(15); yield* waitSafe(17); yield* walkTo(28); },
    function* () { yield* walkTo(7); yield* upDash(300, R, 300); yield* walkTo(13); yield* waitSafe(15); yield* walkTo(19); yield* waitSafe(21); yield* walkTo(28); },
    function* () {
      yield* walkTo(4); yield* hold("w", 900); yield* wait(600);
      yield* walkTo(10); yield* waitSafe(12); yield* walkTo(14); yield* hold("d", 600); yield* walkTo(24); yield* hold("b", 40);
      yield* walkTo(21); yield* waitSafe(12); botKeys.down(L); yield* wait(30); botKeys.up(L); yield* hold("d", 600); yield* walkTo(1); yield* wait(300);
      yield* walkTo(10); yield* waitSafe(12); yield* walkTo(14); yield* hold("d", 600); yield* walkTo(28);
    },
    function* () { yield* walkTo(1); yield* wait(300); yield* walkTo(18); yield* hold("s", 40); yield* wait(300); yield* walkTo(28); },
    function* () { yield* hold("s", 40); yield* wait(200); yield* walkTo(1); yield* wait(300); yield* walkTo(28); },
    function* () { yield* walkTo(1); yield* wait(300); yield* walkTo(12); yield* hold("s", 40); yield* wait(200); yield* hold("d", 600); yield* walkTo(28); },
    function* () { yield* walkTo(1); yield* wait(300); yield* walkTo(12); yield* hold("w", 900); yield* wait(600); yield* walkTo(18); yield* hold("s", 40); yield* wait(300); yield* walkTo(28); },
    function* () { yield* walkTo(1); yield* wait(300); yield* walkTo(13); yield* upDash(300, R, 300); yield* walkTo(17); yield* hold("s", 40); yield* wait(300); yield* walkTo(29); },
    function* () { yield* walkTo(7); botKeys.down(R); yield* hold("arrowup", 300); yield* wait(500); botKeys.up(R); yield* walkTo(24); yield* walkTo(28); },
    function* () { yield* walkTo(8); botKeys.down(R); yield* hold("arrowup", 300); yield* wait(500); botKeys.up(R); yield* walkTo(15); yield* upDash(300, R, 300); yield* walkTo(27); },
    function* () { yield* walkTo(9); yield* walkTo(18); yield* waitSafe(20); yield* walkTo(28); },
    function* () { yield* walkTo(15); yield* hold("b", 40); yield* walkTo(1); yield* wait(400); yield* walkTo(18); botKeys.down(R); yield* hold("arrowup", 300); yield* wait(500); botKeys.up(R); yield* walkTo(29); },
    function* () {
      // Door Shuffle: the bot never loses track (it peeks).
      let guard = 0;
      while ((!shuffle || shuffle.phase !== "pick") && guard++ < 3000) yield;
      if (!shuffle) return;
      yield* walkTo(Math.floor(doorX(shuffle.slotOf[shuffle.real]!) / T));
      yield* hold("arrowdown", 40);
    },
  ];
  let route: Route | null = null;
  let routeLevel = -1;
  let routeDeaths = -1;
  function demoTick(ms: number): void {
    if (deadUntil || clearedAt) {
      keys.clear();
      return;
    }
    // A new level, or the bot died: start that level's route over.
    if (routeLevel !== levelIndex || routeDeaths !== deaths) {
      keys.clear();
      routeLevel = levelIndex;
      routeDeaths = deaths;
      const make = DEMO_ROUTES[levelIndex];
      route = make ? make() : null;
      route?.next(0);
    }
    if (route && route.next(ms).done) route = null;
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === "escape" && opts.onExit) {
      handle.stop();
      opts.onExit();
      return;
    }
    keyDown(k);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    keys.delete(e.key.toLowerCase());
  };
  const onBlur = (): void => keys.clear();
  if (!demo) {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
  }
  window.addEventListener("resize", resize);

  const handle: GameHandle = {
    stop() {
      stopped = true;
      if (!demo) stopMusic();
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", resize);
    },
  };

  // For testing from the browser console: where the player is right now.
  (window as unknown as Record<string, () => object>)[demo ? "dtgDemoState" : "dtgState"] = () => ({
    level: levelIndex + 1,
    tx: Math.floor((player.x + PW / 2) / T),
    x: Math.round(player.x),
    y: Math.round(player.y),
    ty: Math.floor((player.y + PH - 1) / T),
    onGround: player.onGround,
    dashing: player.dashing,
    deaths,
    row: (y: number) => grid[y]?.join(""),
    doors: () =>
      shuffle && {
        phase: shuffle.phase,
        realCol: Math.floor(doorX(shuffle.slotOf[shuffle.real]!) / T),
        wrongCol: Math.floor(doorX(shuffle.slotOf[(shuffle.real + 1) % 8]!) / T),
      },
    wiring: () => wires.map((w) => `${w.red ? "red" : "blue"} gear${w.gear}${gears[w.gear]?.on ? "(turned)" : ""}->slammer${w.slammer}${w.cut ? " CUT" : ""}`),
  });

  resize();
  loadLevel(levelIndex, true);
  rafId = requestAnimationFrame(frame);
  return handle;
}

function easeOutBack(t: number): number {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

export const LEVEL_COUNT = (): number => LEVELS.length;

/** The highest level index you've reached (0 = Level 1). */
export function readSavedLevel(): number {
  try {
    return Number(localStorage.getItem(SAVE_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function clampLevel(n: number): number {
  return Math.max(0, Math.min(LEVELS.length - 1, Math.floor(n)));
}
