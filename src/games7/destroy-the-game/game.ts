import { drawFigure, readGems, readSkin, saveGems, SKINS } from "./skins";
import { play as playSound, startMusic, startStarMusic, stopMusic, stopStarMusic, type Sfx } from "./sfx";

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
// Level 41 unlocks DIMENSIONS (Oscar's idea): press A to switch into the
// Ethereal Dimension, with dreamy music and stars twinkling everywhere. Some
// blocks (1) are only there in the normal dimension, and some (2) are only
// there in the Ethereal one, so there's parkour like jump, A, jump, A...
const DIMENSION_LEVEL = 40; // level index (Level 41)
// Levels 46-50 are about COLLECTABLES (Oscar's idea): grab the gems (*) to
// unlock SKINS in the menu, so you don't have to be the stick man.
const GEM_LEVEL = 45; // level index (Level 46)
// Levels 51-100 are THE TESTS (Oscar): the hardest levels in the whole game.
// CRUSHERS (giant blocks that slam down in patterns, like a boss fight),
// 1-pixel-wide jumps on thin posts (some only in one dimension), combos like
// bombing and flicking a switch in the middle of a dash, signs that try to
// make you quit, and no checkpoints.
const TESTS_LEVEL = 50; // level index (Level 51)
const POST_W = 10; // how wide a thin post is
// A crusher's slam, in seconds: wobble (warning), drop, stay down, go back up.
const CRUSH_WARN = 0.45;
const CRUSH_DROP = 0.14;
const CRUSH_DOWN = 0.4;
const CRUSH_RISE = 0.7;
const CRUSH_LEN = CRUSH_WARN + CRUSH_DROP + CRUSH_DOWN + CRUSH_RISE;
const CRUSH_PAUSE = 0.8; // breather before the pattern starts again

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
interface Crusher {
  x0: number; // tiles, inclusive (where it hangs)
  x1: number;
  y0: number;
  y1: number;
  drop: number; // how far it falls, in pixels
  slot: number; // its turn in the pattern
  wasDown: boolean;
  dir: "down" | "right" | "left"; // side crushers (> and <) slam sideways
}
const MAX_BOMBS = 3;
const BLAST = T * 1.6; // how far a bomb reaches

// Map key: # wall, ^ spikes, C cracked wall, M metal, U smudged wall, S switch,
// J slammer (connected J tiles make one slammer), G gear, o blue wire, x red wire,
// O blue wire buried in a wall, Y red wire buried in a wall, F fake exit,
// K crumbling floor, H checkpoint flag, Z monster hatch, B final-fight spot,
// N monster block (touch it: a monster comes out), Q door-shuffle block
// (touch it: the Door Shuffle starts), 1 block that's only in the normal
// dimension, 2 block that's only in the Ethereal Dimension, * gem, V crusher
// (connected V tiles make one giant crusher), > side crusher that slams right,
// < side crusher that slams left, i thin post (1 pixel jump),
// [ thin post only in the normal dimension, ] thin post only in the Ethereal
// Dimension, P start, X exit, ? sign.
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
  shuffle?: boolean; // the Door Shuffle (Level 35)
  shuffleSwaps?: number; // how many swaps (default 14)
  shuffleFastest?: number; // seconds for the fastest swap (default 0.22)
  shuffleDoors?: number; // how many doors (default 8; Level 61 has 100!)
  monster?: "hatch" | "follow"; // the monster: comes out of a hatch (Z), or follows you in from the left
  boss?: boolean; // the B tile starts the final fight
  signs?: string[]; // different words for each ? sign (left to right, top to bottom); otherwise they all say `sign`
  // Crushers slam in a pattern: `order` gives each crusher (left to right) its
  // turn, and crushers with the same number slam together. `gap` is the time
  // between turns.
  crush?: { gap: number; order: number[]; pause?: number };
  // SPAM (Oscar's Level 72): walls lock you in, a crusher slowly comes down, and
  // you have to click `clicks` times before it squashes you (it takes `seconds`).
  spam?: { clicks: number; seconds: number };
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
  xs: number[]; // where each door spot is (x, in pixels)
}

// ---- The Monster (Levels 36-40, Oscar's idea) ----
// A hatch in the floor (Z) creaks open and a creepy monster climbs out. It
// chases you, flying straight at you, even through walls. Touch it and you're
// done. It follows you into the next levels too. At the end of Level 40 (the B
// spot) it surrounds you: a circle shrinks toward a target circle, and you press
// S when they line up. Do it 3 times and the monster is OOFED.
interface Monster {
  mode: "hatch" | "wait" | "chase" | "boss" | "oofed";
  t: number;
  x: number;
  y: number;
  chaseT: number;
  topY: number; // how high it climbs out of the hatch
}
interface Boss {
  round: number; // 0, 1, 2
  r: number; // outer circle's size
  speed: number;
  t: number;
  flash: number; // after a hit
  done: boolean;
  doneT: number;
}
const BOSS_TARGET = 46; // the inner circle's size
const BOSS_WINDOW = 13; // how close counts as lined up

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
    sign: "Dash the spikes, then smash the wall!",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..................C...........#",
      "#..................C...........#",
      "#..................C...........#",
      "#.P?...............C.........X.#",
      "######^^^^^^^^##################",
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
  {
    sign: "RUN!!!",
    name: "It's Out",
    monster: "hatch",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#...................C..........#",
      "#...................C..........#",
      "#...................C..........#",
      "#...................C..........#",
      "#...................C..........#",
      "#.?.....P...........C........X.#",
      "###Z#######^^^^^^###############",
      "################################",
    ],
  },
  {
    sign: "It's still behind you. Don't stop on the crumbly floor!",
    name: "Still Coming",
    monster: "follow",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..........................X...#",
      "################CCCC############",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?...........................#",
      "######KKKKKKK###################",
      "######^^^^^^^###################",
    ],
  },
  {
    sign: "Pour FAST. It's right behind you!",
    name: "No Time",
    monster: "follow",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#.................U............#",
      "#.................U............#",
      "#.................U............#",
      "#.................U............#",
      "#.................U............#",
      "#.................U............#",
      "#.P?..............U.........X..#",
      "#####^^^^^^#####################",
      "################################",
    ],
  },
  {
    sign: "Jump the fakes. Don't look back.",
    name: "Don't Look Back",
    monster: "follow",
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?....F.....F.....F.......X..#",
      "######################KKKKK#####",
      "######################^^^^^#####",
    ],
  },
  {
    sign: "This is where it ends.",
    name: "Face It",
    monster: "follow",
    boss: true,
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?..............H...B......X.#",
      "#####^^^^^##KKK#################",
      "############^^^#################",
    ],
  },  {
    sign: "Press A to switch dimensions!",
    name: "The Other Side",
    popSign: { title: "NEW MOVE: DIMENSIONS!", lines: ["Press A to switch into the Ethereal Dimension.", "Some blocks are only there in one dimension!"] },
    map: [
      "################################",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#........1.....................#",
      "#.P?.....1...................X.#",
      "##############2222222222222#####",
      "##############^^^^^^^^^^^^^#####",
    ],
  },
  {
    sign: "Jump, A, jump, A...",
    name: "Jump A",
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
      "#.P?..111..222..111..222.....X.#",
      "#####^^^^^^^^^^^^^^^^^^^^^######",
      "################################",
    ],
  },
  {
    sign: "Switch in the air, then land!",
    name: "Star Stairs",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#...........................X..#",
      "#....................222..######",
      "#.........................######",
      "#...............111.......######",
      "#.........................######",
      "#..........222............######",
      "#.........................######",
      "#.....111.................######",
      "#.P?......................######",
      "#####^^^^^^^^^^^^^^^^^^^^^^^^^^#",
      "################################",
    ],
  },
  {
    sign: "Switch, smash, switch back, dash!",
    name: "Both Worlds",
    map: [
      "################################",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....#......2.........#",
      "#.......1.....C......2.........#",
      "#.......1.....C......2.........#",
      "#.......1.....C......2.........#",
      "#.P?....1.....C......2.......X.#",
      "#################^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "The last jump A run. Don't look down!",
    name: "Dimension Dash",
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
      "#...............11...........X.#",
      "#..........22........22...######",
      "#.P?..11..................######",
      "####^^^^^^^^^^^^^^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "Grab the gems! One is hiding behind you...",
    name: "Shiny!",
    popSign: { title: "NEW: GEMS!", lines: ["Collect the gems to unlock SKINS.", "Pick your skin in the menu: no more stick man!"] },
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "####...........................#",
      "#..C...........*...............#",
      "#..C.........####..............#",
      "#*.C.P?..*...####............X.#",
      "####################^^^#########",
      "################################",
    ],
  },
  {
    sign: "Water, Up Dash, switch dimensions... find all 3!",
    name: "Hidden Treasure",
    map: [
      "################################",
      "#............#....#............#",
      "#............#....#............#",
      "#............#.*..#............#",
      "#............#....#............#",
      "#............#....#............#",
      "#...........##CCCC##...........#",
      "#..............................#",
      "####..................111......#",
      "#..U..................1.1......#",
      "#..U..................1.1......#",
      "#*.U.P?...............1*1....X.#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Dash for the gems. Up Dash for the high one!",
    name: "Dash for Cash",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.*............................#",
      "####...........................#",
      "##.............................#",
      "##....................*........#",
      "##.............................#",
      "##..?P....*..................X.#",
      "######^^^^^^^^^###^^^^^^^^######",
      "################################",
    ],
  },
  {
    sign: "Careful. Not every door is a door.",
    name: "Rage Grab",
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#...........................*..#",
      "#..........................22..#",
      "#..............................#",
      "#.......................22.....#",
      "#.P?......*....H..*F.........X.#",
      "########KKKKK###################",
      "########^^^^^###################",
    ],
  },
  {
    sign: "Halfway through the whole game! One last treasure run.",
    name: "Treasure Tower",
    map: [
      "################################",
      "#......................#...#...#",
      "#......................#...#...#",
      "#......................#.*.#...#",
      "#......................#...#...#",
      "#......................#...#...#",
      "#......................#CCC##..#",
      "#.........*....*...............#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?..111..222..111..........X.#",
      "#####^^^^^^^^^^^^^^^^^##########",
      "################################",
    ],
  },
  {
    sign: "You won't make it.",
    name: "Test 1: The Crushers",
    signs: ["You won't make it.", "Turn back now.", "Still here? Wow."],
    crush: { gap: 0.5, order: [0, 1, 2] },
    popSign: { title: "THE TESTS BEGIN", lines: ["Levels 51-100 are the hardest in the whole game.", "Watch out for the CRUSHERS. No checkpoints!"] },
    map: [
      "################################",
      "#......VVV...VVV...VVV.........#",
      "#......VVV...VVV...VVV.........#",
      "#......VVV...VVV...VVV.........#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?.......?.....?...........X.#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Most people quit here.",
    name: "Test 2: Pixel Perfect",
    signs: ["Most people quit here.", "That was luck."],
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
      "#?P....i...i...i...i...i....?X.#",
      "####^^^^^^^^^^^^^^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "Why are you even trying?",
    name: "Test 3: Thin Air",
    signs: ["Why are you even trying?", "Almost... just kidding, you made it."],
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
      "#?P....[...]...[...]...[....?X.#",
      "####^^^^^^^^^^^^^^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "Nobody has ever beaten this one.",
    name: "Test 4: The Combo",
    signs: ["Dash, and press B right away: the bomb flies ahead. The lever does the rest. Then Up Dash!", "Which door? Guess wrong and start ALL over."],
    map: [
      "################################",
      "#........#M....................#",
      "#........#M....................#",
      "#........#M....................#",
      "#........#M....................#",
      "#........#M....................#",
      "#........#M....................#",
      "#........#M...........F..?..X..#",
      "#........#M##CCCCC##############",
      "#........#M.......##############",
      "#........#M.......##############",
      "#?P......SM.......##############",
      "#####^^^^^M^^###################",
      "################################",
    ],
  },
  {
    sign: "This is the hardest level so far.",
    name: "Test 5: Crusher Boss",
    signs: ["This is the hardest level so far.", "Give up. Seriously.", "You're going to lose."],
    crush: { gap: 0.3, order: [0, 1, 2, 3] },
    map: [
      "################################",
      "#....VVVV..VVVV..VVVV..VVVV....#",
      "#....VVVV..VVVV..VVVV..VVVV....#",
      "#....VVVV..VVVV..VVVV..VVVV....#",
      "#....VVVV..VVVV..VVVV..VVVV....#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?.....?.....?...........F.X.#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "They come from the side now.",
    name: "Test 6: Side Crush",
    signs: ["They come from the SIDE now. Jump when they're back.", "You jumped at the wrong time. Probably."],
    crush: { gap: 0.4, order: [0, 1, 2] },
    popSign: { title: "NEW DANGER: SIDE CRUSHERS!", lines: ["These crushers slam sideways, right where you jump.", "Wait until they pull back, then jump!"] },
    map: [
      "################################",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#.......#.......#.......#..#",
      "#...#>>.....#>>.....#>>.....#..#",
      "#...#>>.....#>>.....#>>.....#..#",
      "#.P?..........?..............X.#",
      "########^^^#####^^^#####^^^#####",
      "################################",
    ],
  },
  {
    sign: "Tiny posts. Giant crushers.",
    name: "Test 7: Crusher Posts",
    signs: ["Tiny posts. Giant crushers. Good luck.", "Okay, that was kind of impressive."],
    crush: { gap: 0.8, order: [0, 1] },
    map: [
      "################################",
      "#.........VVV.....VVV..........#",
      "#.........VVV.....VVV..........#",
      "#.........VVV.....VVV..........#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#?P....i...i...i...i...i....?X.#",
      "####^^^^^^^^^^^^^^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "Pour water standing on a post. Sure.",
    name: "Test 8: Fade Away",
    signs: ["Water the wall while you stand on a tiny post. Easy, right?", "One more wall. You're soaked anyway."],
    map: [
      "################################",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#........U..................U..#",
      "#?P....i.U.i...]...[...]..?.UX.#",
      "####^^^^^^^^^^^^^^^^^^^^^^######",
      "################################",
    ],
  },
  {
    sign: "Smash. Dash. Up Dash. Throw. Don't stop.",
    name: "Test 9: The Gauntlet",
    signs: ["Smash, dash, Up Dash, throw a bomb. Don't stop. Don't even breathe.", "Let go of D in time, or that door eats you. Then Up Dash. Again.", "Tiny posts, two dimensions, two crushers. Nobody makes it.", "You didn't really think that was the end?"],
    crush: { gap: 0.9, order: [1, 0, 2], pause: 1.0 },
    map: [
      "################################",
      "#..............VVV.............#",
      "#..............VVV.............#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#........................<<....#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.X.?^F^i^^^]^^^[^^^]^^^.H?....#",
      "############################CCC#",
      "#.....C...........VVV.#.M......#",
      "#.....C...............#.M......#",
      "#.....C...............#.M......#",
      "#.....C...............#.M......#",
      "#.....C...............#.M......#",
      "#.....C...............#.M......#",
      "#.....C..........H....S.M?.F...#",
      "#.....C######CCCC###############",
      "#.....C..........###############",
      "#.....C..........###############",
      "#.P?..C..........###############",
      "########^^^^^###################",
      "################################",
    ],
  },
  {
    sign: "ALL the crushers. At once.",
    name: "Test 10: Crusher Storm",
    signs: ["Every crusher. All at once. Turn back.", "Halfway through the storm. Halfway to failing."],
    crush: { gap: 0.35, order: [0, 1, 2, 3] },
    map: [
      "################################",
      "#..VVV.#.......#VVV.......#....#",
      "#..VVV.#.......#VVV.......#....#",
      "#..VVV.#.......#VVV.......#....#",
      "#......#.......#..........#....#",
      "#......#.......#..........#....#",
      "#......#.......#..........#....#",
      "#......#.......#..........#....#",
      "#......#.......#..........#....#",
      "#......#>>.....#...>>.....#....#",
      "#......#>>.....#...>>.....#....#",
      "#P?...........?..............X.#",
      "###########^^^########^^^#######",
      "################################",
    ],
  },
  {
    sign: "100 doors. 1 EXIT. Good luck.",
    name: "Test 11: 100 Doors",
    shuffle: true,
    shuffleDoors: 100,
    shuffleSwaps: 40,
    shuffleFastest: 0.12,
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
    sign: "Jump A on tiny posts. While THAT sweeps by.",
    name: "Test 12: Dimension Crush",
    signs: ["Jump, A, jump, A, on tiny posts. While THAT sweeps across.", "Still alive? Weird."],
    crush: { gap: 1.2, order: [0, 1], pause: 1.0 },
    map: [
      "################################",
      "#.............VVV..............#",
      "#.............VVV..............#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#>>............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#?P....[...]...[...]...[....?X.#",
      "####^^^^^^^^^^^^^^^^^^^^^^^#####",
      "################################",
    ],
  },
  {
    sign: "Three walls. Three throws. Let go of D in time.",
    name: "Test 13: Bomb Rain",
    signs: ["Throw-dash three times. Let go of D in time or land on spikes."],
    map: [
      "################################",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#.....#.M......#.M......#.M....#",
      "#?P...S.M..H...S.M..H...S.M..X.#",
      "####^^^^M^###^^^^M^###^^^^M^####",
      "################################",
    ],
  },
  {
    sign: "Water the wall. Under the crusher. Hurry.",
    name: "Test 14: Water Works",
    signs: ["Water the wall. While standing under a crusher. Hurry."],
    crush: { gap: 1.0, order: [0, 1, 2] },
    map: [
      "################################",
      "#....VVVU.....VVVU.....VVVU....#",
      "#....VVVU.....VVVU.....VVVU....#",
      "#....VVVU.....VVVU.....VVVU....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.......U........U........U....#",
      "#.P?....U...H....U...H....U..X.#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "The floor falls. The doors bite. Don't stop running.",
    name: "Test 15: Crumble Run",
    signs: ["The floor falls, the doors bite, the crusher sweeps. Don't stop."],
    crush: { gap: 0.6, order: [0], pause: 1.4 },
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
      "#>>............................#",
      "#>>............................#",
      "#.P?...F.......F...H....F....X.#",
      "####KKKKKK##KKKKKKK##KKKKKKK####",
      "####^^^^^^##^^^^^^^##^^^^^^^####",
    ],
  },
  {
    sign: "Four giant crushers. Tiny posts to hide on.",
    name: "Test 16: Crusher King",
    signs: ["Four giant crushers. Tiny posts to hide on. Bye."],
    crush: { gap: 0.5, order: [0, 1, 2, 3] },
    map: [
      "################################",
      "#..VVVVV..VVVVV..VVVVV..VVVVV..#",
      "#..VVVVV..VVVVV..VVVVV..VVVVV..#",
      "#..VVVVV..VVVVV..VVVVV..VVVVV..#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#P?......i......i......i......X#",
      "########^^#####^^#####^^########",
      "################################",
    ],
  },
  {
    sign: "Up the tiny posts. Down the tiny posts. Don't fall.",
    name: "Test 17: Sky Posts",
    signs: ["Up the tiny posts, down the tiny posts. Don't fall. (You'll fall.)"],
    crush: { gap: 1.0, order: [0, 1], pause: 1.0 },
    map: [
      "################################",
      "#............VVV...............#",
      "#............VVV...............#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.............i................#",
      "#.........i.......i..........<<#",
      "#?P...i...............i.....X..#",
      "####^^^^^^^^^^^^^^^^^^^^^^######",
      "################################",
    ],
  },
  {
    sign: "Every step is in a different dimension.",
    name: "Test 18: Shadow Steps",
    signs: ["Every step is in a different dimension. Good luck remembering which."],
    map: [
      "################################",
      "#.......................1#.2...#",
      "#.......................1#.2...#",
      "#.......................1#.2...#",
      "#.......................1#.2...#",
      "#.......................1#.2...#",
      "#.......................1#.2...#",
      "#...............222.....1#.2...#",
      "#.......................1C.2...#",
      "#..........111..........1C.2...#",
      "#.......................1C.2...#",
      "#?P...222.............H.1C.2.X.#",
      "####^^^^^^^^^^^^^^^^^###########",
      "################################",
    ],
  },
  {
    sign: "The slammers are back. The floor falls under them.",
    name: "Test 19: Slammer Return",
    signs: ["The slammers are back. And the floor falls under them."],
    map: [
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "################################",
      "#......JJ......JJ......JJ......#",
      "#......JJ......JJ......JJ......#",
      "#......JJ......JJ......JJ......#",
      "#......JJ......JJ......JJ......#",
      "#......JJ......JJ......JJ......#",
      "#.P?...JJ......JJ...H..JJ....X.#",
      "#####KKKKKK##KKKKKK##KKKKKK#####",
      "#####^^^^^^##^^^^^^##^^^^^^#####",
    ],
  },
  {
    sign: "The crushers are having a parade. You're in it.",
    name: "Test 20: Crusher Parade",
    signs: ["The crushers are having a parade. You're in it."],
    crush: { gap: 0.45, order: [0, 1, 2, 3] },
    map: [
      "################################",
      "#..VVVV...VVVV...VVVV...VVVV...#",
      "#..VVVV...VVVV...VVVV...VVVV...#",
      "#..VVVV...VVVV...VVVV...VVVV...#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#P?.....i......i......i......X.#",
      "#######^^^####^^^####^^^########",
      "################################",
    ],
  },
  {
    // Oscar made this one himself in the level editor (2026-11-21), then made it harder.
    sign: "...",
    name: "Test 21: Crush Mania",
    signs: ["I AM SLOWLY LOSING MY SANITY", "Give up.", "STOP."],
    crush: { gap: 1, order: [0, 1], pause: 1 },
    map: [
      "################################",
      "#.....V.V.V.V.V.V.V.V.V.V.V.VVV#",
      "#.....V.V.V.V.V.V.V.V.V.V.V.VVV#",
      "#.....V.V.V.V.V.V.V.V.V.V.V.VVV#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#>>>...........................#",
      "#>>>...........................#",
      "#>>>...........................#",
      "#.................?............#",
      "#?P.....[.].[.].[.].[.].[.].F?X#",
      "#######^^^^^^^^^^^^^^^^^^^^^####",
      "################################",
    ],
  },
  {
    // Oscar's idea: you're locked in, a crusher slowly comes down, and you
    // have to SPAM click 100 times before it gets you.
    sign: "Click. Click. CLICK!",
    name: "Test 22: SPAM",
    signs: ["You think you can click 100 times? Ha."],
    spam: { clicks: 100, seconds: 20 },
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
      "#.?.............P............X.#",
      "################################",
      "################################",
    ],
  },
  {
    sign: "Up. Up. UP.",
    name: "Test 23: The Climb",
    signs: ["Almost at the top. Which door is real?", "Up. Up. UP. Four floors. Good luck."],
    crush: { gap: 0.6, order: [0, 1, 2], pause: 1 },
    map: [
      "################################",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.....X......F......F...?......#",
      "############^######^######CCC###",
      "#.......VVV...VVV...VVV........#",
      "#.......VVV...VVV...VVV........#",
      "#..............................#",
      "#..............................#",
      "#....H.........................#",
      "##CCC###########################",
      "#...............1...U..........#",
      "#...............1...U..........#",
      "#...............1...U..........#",
      "#...............1...U..........#",
      "#........22.....1...U...H......#",
      "######^^^^^^^^############CCC###",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#..............................#",
      "#.P?.....i...i...i...i.........#",
      "######^^^^^^^^^^^^^^^^^#########",
      "################################",
    ],
  },
];

const WORLD_DONE_SIGN = {
  title: "73 LEVELS DOWN!",
  lines: ["You climbed all the way up.", "The next tests are coming soon..."],
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
  auto?: boolean; // goes away by itself
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

/** The secret code (typed on the menu) turns on crazy mode: wild colors and a tiny, squeaky monster. */
export const CRAZY_KEY = "destroy-the-game-crazy";
export function readCrazy(): boolean {
  try {
    return localStorage.getItem(CRAZY_KEY) === "1";
  } catch {
    return false;
  }
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): GameHandle {
  const crazy = readCrazy();
  const monsterSize = crazy ? 9 : 22; // tiny in crazy mode
  const demo = opts.demo === true;
  const testLevel = opts.testLevel;
  const test = testLevel !== undefined;
  // Has this move been unlocked yet? (Everything is, in the Test Level.)
  const unlocked = (fromLevel: number): boolean => test || levelIndex >= fromLevel;
  // In the Test Level, the door-shuffle block swaps in the Door Shuffle for a bit.
  let override: LevelDef | null = null;
  const levelDef = (): LevelDef => override ?? testLevel ?? LEVELS[levelIndex]!;
  let stopped = false;
  const ctx = canvas.getContext("2d")!;
  const keys = new Set<string>();

  let levelIndex = clampLevel(opts.startLevel ?? readSavedLevel());
  let grid: string[][] = [];
  // Most levels are one screen tall. Taller ones (the Test Level) scroll up and
  // down with you.
  let rows = ROWS;
  let levelH = WORLD_H;
  let camY = 0;
  let player: Player;
  let bits: Bit[] = [];
  let trail: { x: number; y: number; age: number; up: boolean }[] = [];
  let deaths = 0;
  let deadUntil = 0;
  let clearedAt = 0;
  let shake = 0;
  let popSign: PopSign | null = null;
  let bombs: { x: number; y: number; vx: number; vy: number; armed?: boolean }[] = [];
  let crushers: Crusher[] = [];
  let crushFlash = 0; // the screen flashes red when a crusher lands
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
  let monster: Monster | null = null;
  // More monsters (Oscar): every hatch in a level lets one out, and every
  // monster block you touch lets one out too. They all chase you.
  let extras: Monster[] = [];
  const allMonsters = (): Monster[] => (monster ? [monster, ...extras] : extras);
  let boss: Boss | null = null;
  let spam: { count: number; t: number; done: boolean; doneT: number; cageX: number } | null = null;
  const SPAM_DELAY = 1.2; // a moment to read the sign before the crusher starts coming
  let hatchSeen = false; // the hatch cutscene only plays the first time
  let ethereal = false; // in the Ethereal Dimension? (press A, from Level 41 on)
  const gems = readGems(); // every gem you've collected (not in the demo or Test Level)
  let testGems = 0; // gems grabbed in the Test Level (not saved)
  let skinId = readSkin().id;
  let warpFlash = 0; // the screen glows for a moment when you switch
  const locked = (): boolean =>
    (shuffle !== null && shuffle.phase !== "pick") || allMonsters().some((m) => m.mode === "hatch") || boss !== null ||
    (spam !== null && !spam.done);

  // Hatches in a level that isn't one of the monster levels: a monster climbs
  // out of every single one.
  function makeExtras(def: LevelDef, fromCheckpoint: boolean): Monster[] {
    if (def.monster || demo) return [];
    const out: Monster[] = [];
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (tileAt(tx, ty) !== "Z") continue;
        const x = tx * T + T / 2;
        const y = ty * T;
        if (fromCheckpoint || hatchSeen) out.push({ mode: "wait", t: 0.4, x, y: y - 34, chaseT: 0, topY: y - 34 });
        else out.push({ mode: "hatch", t: 0, x, y: y + 24, chaseT: 0, topY: y - 34 });
      }
    }
    if (out.some((m) => m.mode === "hatch")) {
      hatchSeen = true;
      keys.clear();
      sfx("creak");
    }
    return out;
  }

  function makeMonster(def: LevelDef, fromCheckpoint: boolean): Monster | null {
    if (!def.monster || demo) return null;
    let hx = -2 * T;
    let hy = player.y;
    if (def.monster === "hatch" && !fromCheckpoint) {
      for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < COLS; tx++) if (tileAt(tx, ty) === "Z") { hx = tx * T + T / 2; hy = ty * T; }
      if (!hatchSeen) {
        hatchSeen = true;
        keys.clear();
        sfx("creak");
        return { mode: "hatch", t: 0, x: hx, y: hy + 24, chaseT: 0, topY: hy - 34 };
      }
      return { mode: "wait", t: 0.4, x: hx, y: hy - 34, chaseT: 0, topY: hy - 34 };
    }
    return { mode: "wait", t: 0, x: hx, y: hy, chaseT: 0, topY: hy };
  }

  function stepMonster(dt: number): void {
    if (monster) stepOneMonster(monster, dt);
    // The extra monsters freeze during the final fight.
    if (!boss) for (const m of extras) stepOneMonster(m, dt);
  }

  function stepOneMonster(m: Monster, dt: number): void {
    m.t += dt;
    const px = player.x + PW / 2;
    const py = player.y + PH / 2;
    if (m.mode === "hatch") {
      // Lid opens (0-0.6s), it climbs out (0.6-2s), ROAR (2-2.6s).
      if (m.t > 0.6 && m.t - dt <= 0.6) sfx("growl");
      if (m.t > 0.6) m.y = Math.max(m.topY, m.y - dt * 45);
      if (m.t > 2 && m.t - dt <= 2) {
        sfx("roar");
        shake = Math.max(shake, 0.9);
      }
      if (m.t > 2.6) {
        m.mode = "chase";
        m.t = 0;
      }
      return;
    }
    if (m.mode === "wait") {
      if (m.t > 1) {
        m.mode = "chase";
        m.t = 0;
        sfx("growl");
      }
      return;
    }
    if (m.mode === "chase") {
      m.chaseT += dt;
      const speed = Math.min(225, 150 + m.chaseT * 6); // gets faster the longer it chases
      const dx = px - m.x;
      const dy = py - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.x += (dx / d) * speed * dt;
      m.y += (dy / d) * speed * dt + Math.sin(time * 5) * 20 * dt;
      if (d < monsterSize + 4 && !deadUntil && !clearedAt) {
        sfx("growl");
        die();
      }
    }
  }

  // ---- SPAM (Level 72) ----
  const SPAM_W = T * 4; // the spam crusher is 4 blocks wide
  const SPAM_H = T * 3;
  /** The bottom of the spam crusher right now. */
  function spamBottom(): number {
    const sp = spam;
    const start = T + SPAM_H; // hanging from the ceiling
    if (!sp) return start;
    const end = player.y + 2; // right on your head
    const u = Math.min(1, Math.max(0, (sp.t - SPAM_DELAY) / (levelDef().spam?.seconds ?? 20)));
    return start + (end - start) * u;
  }

  function spamClick(): void {
    const sp = spam;
    const goal = levelDef().spam?.clicks ?? 100;
    if (!sp || sp.done || deadUntil || clearedAt) return;
    sp.count += 1;
    sfx("pop");
    if (sp.count >= goal) {
      sp.done = true;
      sp.doneT = time;
      sfx("boom");
      sfx("smash");
      shake = 1;
      // The crusher shatters into pieces.
      const bottom = spamBottom();
      for (let i = 0; i < 50; i++) {
        bits.push({
          x: sp.cageX - SPAM_W / 2 + Math.random() * SPAM_W, y: bottom - Math.random() * SPAM_H,
          vx: (Math.random() - 0.5) * 900, vy: -Math.random() * 700,
          angle: Math.random() * 6, spin: (Math.random() - 0.5) * 20, size: 6 + Math.random() * 12,
          color: Math.random() < 0.7 ? "#3b3540" : "#ff3b30", life: 1.6,
        });
      }
    }
  }

  function stepSpam(dt: number): void {
    const sp = spam;
    if (!sp || sp.done || deadUntil || clearedAt) return;
    sp.t += dt;
    if (spamBottom() >= player.y + 1) {
      sfx("crush");
      shake = 1;
      crushFlash = 1;
      die();
    }
  }

  function drawSpam(): void {
    const sp = spam;
    if (!sp) return;
    const goal = levelDef().spam?.clicks ?? 100;
    if (!sp.done) {
      // The cage walls on both sides of you.
      for (const wx of [sp.cageX - T * 1.6 - T, sp.cageX + T * 1.6]) {
        ctx.fillStyle = "#e3dccb";
        ctx.fillRect(wx, T, T, 11 * T);
        ctx.strokeStyle = "#2b2725";
        ctx.lineWidth = 2.6;
        ctx.strokeRect(wx, T, T, 11 * T);
      }
      // The crusher, slowly coming down.
      const bottom = spamBottom();
      const x = sp.cageX - SPAM_W / 2 + (sp.t > SPAM_DELAY ? Math.sin(time * 40) * 1.5 : 0);
      const y = bottom - SPAM_H;
      ctx.strokeStyle = "#5a5560";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      for (const cx of [x + 14, x + SPAM_W - 14]) {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = "#3b3540";
      ctx.fillRect(x, y, SPAM_W, SPAM_H);
      ctx.strokeStyle = "#141016";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, SPAM_W, SPAM_H);
      for (const ex of [x + SPAM_W * 0.3, x + SPAM_W * 0.7]) {
        ctx.fillStyle = "#ff3b30";
        ctx.beginPath();
        ctx.arc(ex, y + SPAM_H * 0.4, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#f4f0e6";
      for (let i = 0; i < 10; i++) {
        const tx = x + (i + 0.5) * (SPAM_W / 10);
        ctx.beginPath();
        ctx.moveTo(tx - SPAM_W / 20 + 1, y + SPAM_H);
        ctx.lineTo(tx + SPAM_W / 20 - 1, y + SPAM_H);
        ctx.lineTo(tx, y + SPAM_H + 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The big SPAM sign and the counter (they stay put while the screen scrolls).
    const signX = sp.cageX < WORLD_W / 2 ? WORLD_W * 0.78 : WORLD_W * 0.22;
    const signY = camY + T * 3.2;
    ctx.save();
    ctx.translate(signX, signY);
    ctx.rotate(-0.05);
    ctx.fillStyle = sp.done ? "#9be59b" : "#ffe08a";
    ctx.fillRect(-150, -55, 300, 110);
    ctx.strokeStyle = "#5b3d1c";
    ctx.lineWidth = 4;
    ctx.strokeRect(-150, -55, 300, 110);
    ctx.fillStyle = sp.done ? "#1f6b2a" : "#c0392b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const pulse = sp.done ? 1 : 1 + 0.08 * Math.sin(time * 18);
    ctx.font = `${Math.round(54 * pulse)}px 'Bungee', 'Patrick Hand', cursive`;
    ctx.fillText(sp.done ? "YOU DID IT!" : "SPAM!", 0, -14);
    ctx.font = "30px 'Patrick Hand', 'Comic Sans MS', cursive";
    ctx.fillStyle = "#2b2725";
    ctx.fillText(`${Math.min(sp.count, goal)} / ${goal} clicks`, 0, 32);
    ctx.restore();
  }

  // The final fight: it surrounds you.
  function startBoss(): void {
    if (boss || !monster || monster.mode === "oofed") return;
    keys.clear();
    monster.mode = "boss";
    boss = { round: 0, r: 230, speed: 150, t: 0, flash: 0, done: false, doneT: 0 };
    sfx("roar");
    shake = Math.max(shake, 0.8);
  }

  function stepBoss(dt: number): void {
    const b = boss;
    if (!b) return;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 2);
    if (b.done) {
      b.doneT += dt;
      if (b.doneT > 1.8 && !clearedAt) reachExit();
      return;
    }
    if (b.t < 1) return; // let it surround you first
    b.r -= b.speed * dt;
    if (b.r < BOSS_TARGET - BOSS_WINDOW) bossMiss();
  }

  function bossPress(): void {
    const b = boss;
    if (!b || b.done || b.t < 1 || deadUntil) return;
    if (Math.abs(b.r - BOSS_TARGET) <= BOSS_WINDOW) {
      b.round += 1;
      b.flash = 1;
      shake = Math.max(shake, 0.4);
      sfx("ding");
      if (b.round >= 3) {
        b.done = true;
        if (monster) monster.mode = "oofed";
        for (const m of extras) m.mode = "oofed"; // all of them!
        sfx("oof");
        shake = 1;
        for (let i = 0; i < 40; i++) {
          bits.push({
            x: player.x + PW / 2 + (Math.random() - 0.5) * 200, y: player.y + (Math.random() - 0.5) * 160,
            vx: (Math.random() - 0.5) * 700, vy: -Math.random() * 600,
            angle: Math.random() * 6, spin: (Math.random() - 0.5) * 20, size: 6 + Math.random() * 10,
            color: Math.random() < 0.7 ? "#1b1116" : "#c0392b", life: 1.6,
          });
        }
      } else {
        b.r = 230;
        b.speed += 60; // faster each time
        b.t = 0.6;
      }
    } else {
      bossMiss();
    }
  }

  function bossMiss(): void {
    sfx("roar");
    boss = null;
    if (monster) monster.mode = "wait";
    die();
  }

  function drawMonsterAt(x: number, y: number, size: number, angry: number): void {
    ctx.save();
    ctx.translate(x, y);
    // A scribbly shadow body with jagged edges.
    ctx.fillStyle = "rgba(27, 17, 22, 0.92)";
    ctx.beginPath();
    const spikes = 16;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = size * (i % 2 === 0 ? 1.15 : 0.85) + wob(i, size, 3);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(27, 17, 22, 0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      // Wispy tendrils.
      const a = Math.PI * 0.6 + i * 0.25 + Math.sin(time * 3 + i) * 0.2;
      sketchLine(Math.cos(a) * size, Math.sin(a) * size, Math.cos(a) * size * 1.8, Math.sin(a) * size * 1.8 + 6, 2);
    }
    // Three eyes.
    for (const [ex, ey, er] of [[-size * 0.4, -size * 0.25, size * 0.26], [size * 0.38, -size * 0.3, size * 0.22], [0, -size * 0.62, size * 0.16]] as const) {
      ctx.fillStyle = "#fffdf5";
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = angry > 0 ? "#ff2a2a" : "#c0392b";
      ctx.beginPath();
      ctx.arc(ex + Math.sin(time * 2) * er * 0.3, ey, er * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // A toothy grin.
    ctx.fillStyle = "#fffdf5";
    ctx.beginPath();
    const mw = size * 1.1;
    const my = size * 0.25;
    ctx.moveTo(-mw / 2, my);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-mw / 2 + (i * mw) / 8, my + (i % 2 === 0 ? 0 : size * 0.22));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMonster(): void {
    // The hatch in the floor.
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        if (tileAt(tx, ty) !== "Z") continue;
        const x = tx * T;
        const y = ty * T;
        const opening = allMonsters().find((m) => m.mode === "hatch");
        const open = opening ? Math.min(1, opening.t / 0.3) : allMonsters().length ? 1 : 0;
        ctx.fillStyle = "#1b1116";
        ctx.fillRect(x + 3, y, T - 6, 8);
        ctx.save();
        ctx.translate(x + 3, y);
        ctx.rotate(-open * 1.9);
        ctx.fillStyle = "#7a6a58";
        ctx.fillRect(0, -4, T - 6, 6);
        ctx.strokeStyle = "#2b2725";
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -4, T - 6, 6);
        ctx.restore();
      }
    }
    for (const m of allMonsters()) {
      if (m.mode === "oofed" || m.mode === "boss") continue; // the boss is drawn by drawBoss
      drawMonsterAt(m.x, m.y, monsterSize, m.mode === "chase" ? 1 : 0);
    }
  }

  function drawBoss(): void {
    const b = boss;
    if (!b) return;
    const cx = player.x + PW / 2;
    const cy = player.y + PH / 2;
    // It surrounds you: dark all around, eyes everywhere.
    if (!b.done) {
      const g = ctx.createRadialGradient(cx, cy, 60, cx, cy, 520);
      g.addColorStop(0, "rgba(20, 10, 15, 0)");
      g.addColorStop(1, `rgba(20, 10, 15, ${Math.min(0.85, b.t * 1.5)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, camY, WORLD_W, WORLD_H);
      const ring = 150 + Math.sin(time * 2) * 6;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + time * 0.4;
        drawMonsterAt(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring * 0.7, (monsterSize - 2 + (i % 3) * 4) * (crazy ? 0.9 : 1), b.flash);
      }
      // The target circle, and the shrinking outer circle.
      if (b.t >= 1) {
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#ffd23f";
        ctx.beginPath();
        ctx.arc(cx, cy, BOSS_TARGET, 0, Math.PI * 2);
        ctx.stroke();
        const close = Math.abs(b.r - BOSS_TARGET) <= BOSS_WINDOW;
        ctx.lineWidth = 4;
        ctx.strokeStyle = close ? "#4fc25a" : "#fffdf5";
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(4, b.r), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = "34px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fffdf5";
      ctx.fillText(b.t < 1 ? "It's got you surrounded..." : "PRESS S when the circles line up!", WORLD_W / 2, camY + T * 1.6);
      ctx.font = "26px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.fillText(`${"★".repeat(b.round)}${"☆".repeat(3 - b.round)}`, WORLD_W / 2, camY + T * 2.6);
    } else {
      ctx.font = "90px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#c0392b";
      ctx.fillText("OOF!", WORLD_W / 2, camY + WORLD_H * 0.35);
      ctx.font = "30px 'Patrick Hand', 'Comic Sans MS', cursive";
      ctx.fillStyle = "#2b2725";
      ctx.fillText("The monster got oofed.", WORLD_W / 2, camY + WORLD_H * 0.35 + 60);
    }
  }

  function makeShuffle(def: LevelDef): Shuffle {
    const n = def.shuffleDoors ?? DOOR_COLS.length;
    // 8 doors stand on their own spots. Lots of doors get squished in, side by
    // side, all the way to the right wall.
    const xs = n === DOOR_COLS.length
      ? DOOR_COLS.map((c) => (c + 0.5) * T)
      : Array.from({ length: n }, (_, i) => 3.5 * T + (i * (WORLD_W - 5 * T)) / (n - 1));
    const real = Math.floor(Math.random() * n);
    const swaps: Shuffle["swaps"] = [];
    const count = def.shuffleSwaps ?? SWAPS;
    const fastest = def.shuffleFastest ?? 0.22;
    let realSlot = real;
    for (let i = 0; i < count; i++) {
      // With lots of doors, the EXIT gets swapped way more often (so it's hard to follow).
      let a = n > DOOR_COLS.length && Math.random() < 0.55 ? realSlot : Math.floor(Math.random() * n);
      let b = Math.floor(Math.random() * (n - 1));
      if (b >= a) b += 1;
      if (Math.random() < 0.5) [a, b] = [b, a];
      if (a === realSlot) realSlot = b;
      else if (b === realSlot) realSlot = a;
      swaps.push({ a, b, dur: 0.62 - ((0.62 - fastest) * i) / (count - 1) }); // faster and faster
    }
    keys.clear();
    return {
      phase: "trap",
      t: 0,
      xs,
      slotOf: xs.map((_, i) => i),
      real,
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

  const doorX = (slot: number): number => shuffle?.xs[slot] ?? 0;

  // Press DOWN in front of a door to open it.
  function pickDoor(): void {
    const sh = shuffle;
    if (!sh || sh.phase !== "pick" || sh.picked >= 0 || deadUntil || clearedAt) return;
    const px = player.x + PW / 2;
    // The nearest door, if you're in front of it. (Skinny doors need you to be exact!)
    const reach = Math.min(20, (sh.xs[1]! - sh.xs[0]!) / 2);
    let door = -1;
    let best = reach;
    sh.slotOf.forEach((slot, d) => {
      const dist = Math.abs(doorX(slot) - px);
      if (dist < best) {
        best = dist;
        door = d;
      }
    });
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
      const skinny = sh.xs.length > DOOR_COLS.length;
      const w = skinny ? Math.max(4, sh.xs[1]! - sh.xs[0]! - 3) : T - 6;
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
      if (!skinny) {
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(left + w - 7, top + h * 0.55, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // The little sign above each door. (Skinny doors only label the EXIT, and the one you opened.)
      if (skinny && !opened && !(showLabels && isReal)) return;
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
    if (demo) return;
    // In crazy mode the monster doesn't growl or roar. It squeaks.
    if (crazy && (name === "growl" || name === "roar")) name = "squeak";
    playSound(name);
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
    const def = override ?? testLevel ?? LEVELS[index]!;
    rows = def.map.length;
    levelH = rows * T;
    camY = levelH - WORLD_H; // start at the bottom; it follows you from there
    if (!def.shuffle) stopMusic();
    leaveEthereal();
    grid = def.map.map((row) => row.split(""));
    // Gems you already have show up as see-through outlines.
    if (!demo && !test && !override) {
      grid.forEach((row, y) => row.forEach((c, x) => {
        if (c === "*" && gems.has(gemKey(x, y))) row[x] = "g";
      }));
    }
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
    crushers = findCrushers(def);
    findGearsAndWires();
    onGear = "";
    checkpoint = null;
    shuffle = def.shuffle ? makeShuffle(def) : null;
    boss = null;
    monster = makeMonster(def, false);
    spam = def.spam ? { count: 0, t: 0, done: false, doneT: 0, cageX: player.x + PW / 2 } : null;
    if (spam) keys.clear();
    extras = makeExtras(def, false);
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
    for (let ty = 0; ty < rows; ty++) {
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
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < COLS; tx++) if (tileAt(tx, ty) === "G") gears.push({ tx, ty, on: false, spin: 0 });
    }
    const isRed = (c: string): boolean => c === "x" || c === "Y";
    const isWire = (c: string): boolean => c === "o" || c === "O" || isRed(c);
    const seen = new Set<string>();
    for (let ty = 0; ty < rows; ty++) {
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
          if (seen.has(key) || !isWire(c) || isRed(c) !== red || x < 0 || y < 0 || x >= COLS || y >= rows) continue;
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
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= rows) return "#";
    return grid[ty]?.[tx] ?? "#";
  }

  const isSolid = (c: string): boolean =>
    c === "#" || c === "C" || c === "M" || c === "U" || c === "O" || c === "Y" || c === "K" || c === "Z" ||
    (c === "1" && !ethereal) || (c === "2" && ethereal) ||
    c === "i" || (c === "[" && !ethereal) || (c === "]" && ethereal);
  const isThin = (c: string): boolean => c === "i" || c === "[" || c === "]";
  // Thin posts are only POST_W pixels wide, in the middle of their tile.
  const postLeft = (tx: number): number => tx * T + (T - POST_W) / 2;
  const onPost = (tx: number, x: number): boolean => x + PW > postLeft(tx) && x < postLeft(tx) + POST_W;

  // ---- Crushers (Level 51+) ----
  function findCrushers(def: LevelDef): Crusher[] {
    const found: Crusher[] = [];
    const seen = new Set<string>();
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const ch = grid[ty]?.[tx] ?? "";
        if (!"V<>".includes(ch) || !ch || seen.has(`${tx},${ty}`)) continue;
        const dir = ch === ">" ? "right" : ch === "<" ? "left" : "down";
        const c: Crusher = { x0: tx, x1: tx, y0: ty, y1: ty, drop: 0, slot: 0, wasDown: false, dir };
        const stack: [number, number][] = [[tx, ty]];
        while (stack.length) {
          const [x, y] = stack.pop()!;
          const key = `${x},${y}`;
          if (seen.has(key) || grid[y]?.[x] !== ch) continue;
          seen.add(key);
          c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x);
          c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        found.push(c);
      }
    }
    for (const c of found) {
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) grid[y]![x] = ".";
    }
    // It slams until it hits something solid (a floor, or a wall for side crushers).
    const stops = (x: number, y: number): boolean => "#CMUOYZKi".includes(grid[y]?.[x] ?? "#");
    for (const c of found) {
      let gap = Math.max(rows, COLS);
      if (c.dir === "down") {
        for (let x = c.x0; x <= c.x1; x++) {
          let y = c.y1 + 1;
          while (y < rows && !stops(x, y)) y++;
          gap = Math.min(gap, y - c.y1 - 1);
        }
      } else {
        const step = c.dir === "right" ? 1 : -1;
        for (let y = c.y0; y <= c.y1; y++) {
          let x = c.dir === "right" ? c.x1 + 1 : c.x0 - 1;
          while (x >= 0 && x < COLS && !stops(x, y)) x += step;
          gap = Math.min(gap, Math.abs(x - (c.dir === "right" ? c.x1 : c.x0)) - 1);
        }
      }
      c.drop = gap * T;
    }
    found.sort((a, b) => a.x0 - b.x0);
    found.forEach((c, i) => (c.slot = def.crush?.order[i] ?? i));
    return found;
  }

  function crushCycle(): number {
    const gap = levelDef().crush?.gap ?? 0.6;
    const last = Math.max(0, ...crushers.map((c) => c.slot));
    return last * gap + CRUSH_LEN + (levelDef().crush?.pause ?? CRUSH_PAUSE);
  }

  /** Seconds into this crusher's own slam (or -1 when it's just hanging there). */
  function crushPhase(c: Crusher): number {
    const gap = levelDef().crush?.gap ?? 0.6;
    const t = (time % crushCycle()) - c.slot * gap;
    return t >= 0 && t < CRUSH_LEN ? t : -1;
  }

  /** How far down the crusher is right now, in pixels. */
  function crushDown(c: Crusher): number {
    let t = crushPhase(c);
    if (t < CRUSH_WARN) return 0;
    t -= CRUSH_WARN;
    if (t < CRUSH_DROP) return c.drop * (t / CRUSH_DROP) ** 2;
    t -= CRUSH_DROP;
    if (t < CRUSH_DOWN) return c.drop;
    t -= CRUSH_DOWN;
    return c.drop * Math.max(0, 1 - t / CRUSH_RISE);
  }

  /** Where the crusher is pushed to right now. */
  function crushOffset(c: Crusher): { dx: number; dy: number } {
    const d = crushDown(c);
    return c.dir === "down" ? { dx: 0, dy: d } : { dx: c.dir === "right" ? d : -d, dy: 0 };
  }

  function stepCrushers(): void {
    const p = player;
    for (const c of crushers) {
      const { dx, dy } = crushOffset(c);
      const down = crushDown(c) >= c.drop - 0.5 && c.drop > 0;
      if (down && !c.wasDown) {
        sfx("crush");
        shake = Math.max(shake, 0.55);
        crushFlash = 1;
        for (let i = 0; i < 10; i++) {
          bits.push({
            x: c.x0 * T + dx + Math.random() * (c.x1 - c.x0 + 1) * T, y: c.dir === "down" ? (c.y1 + 1) * T + c.drop : c.y0 * T + Math.random() * (c.y1 - c.y0 + 1) * T,
            vx: (Math.random() - 0.5) * 400, vy: -Math.random() * 300,
            angle: 0, spin: 0, size: 8 + Math.random() * 8, color: "rgba(60,55,50,0.35)", life: 0.5,
          });
        }
      }
      c.wasDown = down;
      // Touch a crusher and you're squashed (dashing doesn't save you).
      const x = c.x0 * T + dx;
      const y = c.y0 * T + dy;
      const w = (c.x1 - c.x0 + 1) * T;
      const h = (c.y1 - c.y0 + 1) * T;
      if (p.x + PW > x + 3 && p.x < x + w - 3 && p.y + PH > y + 3 && p.y < y + h - 1) die();
    }
  }

  function drawCrushers(): void {
    for (const c of crushers) {
      const ph = crushPhase(c);
      const warn = ph >= 0 && ph < CRUSH_WARN;
      const { dx, dy } = crushOffset(c);
      const wobble = warn ? Math.sin(time * 60) * 2.5 : 0;
      const side = c.dir !== "down";
      const x = c.x0 * T + dx + (side ? 0 : wobble);
      const y = c.y0 * T + dy + (side ? wobble : 0);
      const w = (c.x1 - c.x0 + 1) * T;
      const h = (c.y1 - c.y0 + 1) * T;
      // Chains up to the ceiling (or back to the wall, for side crushers).
      ctx.strokeStyle = "#5a5560";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      if (!side) {
        for (const cx of [x + 10, x + w - 10]) {
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, y);
          ctx.stroke();
        }
      } else {
        for (const cy of [y + 8, y + h - 8]) {
          ctx.beginPath();
          ctx.moveTo(c.dir === "right" ? 0 : WORLD_W, cy);
          ctx.lineTo(c.dir === "right" ? x : x + w, cy);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      // Where it's going to land.
      if (warn) {
        ctx.fillStyle = `rgba(232, 66, 58, ${0.18 + 0.15 * Math.sin(time * 30)})`;
        if (c.dir === "down") ctx.fillRect(c.x0 * T, (c.y1 + 1) * T, w, c.drop);
        else if (c.dir === "right") ctx.fillRect((c.x1 + 1) * T, c.y0 * T, c.drop, h);
        else ctx.fillRect(c.x0 * T - c.drop, c.y0 * T, c.drop, h);
      }
      // The crusher: a giant angry block.
      ctx.fillStyle = "#3b3540";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.2;
      for (let i = 6; i < w; i += 12) sketchLine(x + i, y + h, x + i + 10, y, 0.8);
      ctx.strokeStyle = "#141016";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      // Angry eyes.
      const glow = warn || dy > 0 ? "#ff3b30" : "#c0392b";
      const ey = y + h * 0.4;
      for (const ex of [x + w * 0.3, x + w * 0.7]) {
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ex, ey, Math.min(9, w * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#141016";
      ctx.lineWidth = 3.5;
      sketchLine(x + w * 0.18, ey - 14, x + w * 0.4, ey - 7, 0.4);
      sketchLine(x + w * 0.82, ey - 14, x + w * 0.6, ey - 7, 0.4);
      // Teeth on the side it slams with.
      ctx.fillStyle = "#f4f0e6";
      if (!side) {
        const teeth = Math.max(3, Math.round(w / 14));
        for (let i = 0; i < teeth; i++) {
          const tx = x + (i + 0.5) * (w / teeth);
          ctx.beginPath();
          ctx.moveTo(tx - w / teeth / 2 + 1, y + h);
          ctx.lineTo(tx + w / teeth / 2 - 1, y + h);
          ctx.lineTo(tx, y + h + 9);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        const teeth = Math.max(3, Math.round(h / 14));
        const edge = c.dir === "right" ? x + w : x;
        const out = c.dir === "right" ? 9 : -9;
        for (let i = 0; i < teeth; i++) {
          const ty = y + (i + 0.5) * (h / teeth);
          ctx.beginPath();
          ctx.moveTo(edge, ty - h / teeth / 2 + 1);
          ctx.lineTo(edge, ty + h / teeth / 2 - 1);
          ctx.lineTo(edge + out, ty);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // ---- Gems (Level 46+) ----
  function gemKey(tx: number, ty: number): string {
    return `${levelIndex}:${tx},${ty}`;
  }

  function collectGem(tx: number, ty: number): void {
    grid[ty]![tx] = ".";
    sfx("gem");
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      bits.push({
        x: tx * T + T / 2, y: ty * T + T / 2,
        vx: Math.cos(a) * 220, vy: Math.sin(a) * 220 - 150,
        angle: 0, spin: 0, size: 3, color: "#5ce1ff", life: 0.5, spark: true,
      });
    }
    if (test) {
      testGems += 1;
      return;
    }
    if (demo) return;
    const before = gems.size;
    gems.add(gemKey(tx, ty));
    saveGems(gems);
    // Did that unlock a new skin?
    const skin = SKINS.find((k) => k.gems > before && k.gems <= gems.size);
    if (skin) {
      popSign = {
        title: `NEW SKIN: ${skin.name.toUpperCase()}!`,
        lines: ["Pick it in the Skins menu (Esc, then Skins)."],
        shownAt: time,
        leavingAt: null,
        auto: true,
      };
      sfx("unlock");
    }
  }

  // ---- Dimensions (Level 41+) ----
  function leaveEthereal(): void {
    ethereal = false;
    warpFlash = 0;
    if (!demo) stopStarMusic();
  }

  // Press A: switch dimensions. You can't switch if a block from the other
  // dimension would appear right where you are.
  function switchDimension(): void {
    const appearing = ethereal ? "1" : "2";
    const appearingPost = ethereal ? "[" : "]";
    let blocked = false;
    touching(player.x, player.y, (tx, _ty, c) => {
      if (c === appearing || (c === appearingPost && onPost(tx, player.x))) blocked = true;
    });
    if (blocked) {
      sfx("nope");
      shake = Math.max(shake, 0.15);
      return;
    }
    ethereal = !ethereal;
    warpFlash = 1;
    if (ethereal) {
      sfx("warp");
      if (!demo) startStarMusic();
    } else {
      sfx("warpBack");
      if (!demo) stopStarMusic();
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      bits.push({
        x: player.x + PW / 2,
        y: player.y + PH / 2,
        vx: Math.cos(a) * 260,
        vy: Math.sin(a) * 260 - 120,
        angle: 0,
        spin: 0,
        size: 3,
        color: ethereal ? "#bfe3ff" : "#28328c",
        life: 0.45,
        spark: true,
      });
    }
  }

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
    // Bombs still flying (thrown mid-dash) go off the moment they stop.
    for (const b of bombs) {
      if (b.vx !== 0) b.armed = true;
      else explode(b.x, b.y - 8);
    }
    bombs = bombs.filter((b) => b.armed);
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
      if (isThin(c)) {
        if (!onPost(tx, player.x)) return;
        hitWall = true;
        player.x = dx > 0 ? postLeft(tx) - PW : postLeft(tx) + POST_W;
        return;
      }
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
      if (isThin(c) && !onPost(tx, player.x)) return;
      // Up Dash smashes cracked ceilings.
      if (c === "C" && player.dashing && player.dashUp) {
        smashWall(tx, ty);
        return;
      }
      // Corner nudge: if an Up Dash only clips the edge of a hole, slide into
      // the hole instead of stopping dead.
      if (dy < 0 && player.dashing && player.dashUp && !isThin(c)) {
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
    boss = null;
    leaveEthereal();
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
    monster = makeMonster(levelDef(), true); // it comes back in from the left
    extras = makeExtras(levelDef(), true);
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
    warpFlash = Math.max(0, warpFlash - dt * 3);
    crushFlash = Math.max(0, crushFlash - dt * 3);

    if (finished) return;
    if (clearedAt) {
      if (time - clearedAt > 1.1) {
        clearedAt = 0;
        if (test) {
          override = null; // back from the Door Shuffle, if that's where you were
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
    stepMonster(dt);
    stepBoss(dt);
    stepSpam(dt);
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
    if (popSign && popSign.leavingAt === null && (popSign.auto || ((levelIndex === SLAMMER_LEVEL || levelIndex === RAGE_LEVEL || levelIndex === GEM_LEVEL) && !test)) && time - popSign.shownAt > 3.5) {
      popSign.leavingAt = time;
    }

    stepCrushers();

    // Spikes get you, unless you're dashing.
    if (!p.dashing) {
      touching(p.x, p.y, (tx, ty, c) => {
        if (c !== "^") return;
        const spikeTop = ty * T + T * 0.45;
        if (p.y + PH > spikeTop && p.x + PW > tx * T + 4 && p.x < (tx + 1) * T - 4) die();
      });
    }
    if (p.y > levelH) die();

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
    drops = drops.filter((d) => d.y < levelH + 20);
    // Fully faded smudges are gone.
    for (const [key, start] of Object.entries(fading)) {
      if (time - start < FADE_TIME) continue;
      const [x, y] = key.split(",").map(Number) as [number, number];
      if (tileAt(x, y) === "U") grid[y]![x] = ".";
    }

    // Bombs drop until they land on something.
    for (const b of bombs) {
      if (b.vx !== 0) {
        const nx = b.x + b.vx * dt;
        if (isSolid(tileAt(Math.floor((nx + Math.sign(b.vx) * 6) / T), Math.floor((b.y - 6) / T)))) b.vx = 0;
        else b.x = nx;
        b.vx *= Math.max(0, 1 - dt * 0.4); // it keeps flying until it hits a wall
        if (Math.abs(b.vx) < 10) b.vx = 0;
        if (b.vx === 0 && b.armed) explode(b.x, b.y - 8);
      }
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
    bombs = bombs.filter((b) => b.y < levelH + 40 && !(b.armed && b.vx === 0));

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
      if (c === "*") collectGem(_tx, _ty);
      // The final fight (in the demo it just counts as the exit). In test rooms
      // it only starts if the monster is out.
      if (c === "B" && levelDef().boss) {
        if (demo || !monster) reachExit();
        else startBoss();
      } else if (c === "B" && test && monster && monster.mode === "chase") {
        startBoss();
      }
    });

    // A monster block: touch it and a monster comes out after you. Every block
    // has its own monster, so lots of blocks means lots of monsters.
    touching(p.x, p.y, (tx, ty, c) => {
      if (c !== "N" || demo) return;
      grid[ty]![tx] = ".";
      // It climbs out of the block; you get a head start of a bit over a second.
      const m: Monster = { mode: "wait", t: -0.2, x: tx * T + T / 2, y: ty * T + T / 2, chaseT: 0, topY: ty * T };
      if (!monster || monster.mode === "oofed") monster = m;
      else extras.push(m);
      sfx("roar");
      shake = Math.max(shake, 0.6);
    });

    // The door-shuffle block: touch it and the Door Shuffle starts. Win it and
    // you come back here.
    touching(p.x, p.y, (_tx, _ty, c) => {
      if (c !== "Q" || override || clearedAt || deadUntil) return;
      override = LEVELS.find((l) => l.shuffle) ?? null;
      if (override) loadLevel(levelIndex, false);
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

  // Little hash for star positions, so the stars stay put.
  const hash = (n: number): number => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // The Ethereal Dimension: a night sky full of twinkling stars.
  function drawStarSky(): void {
    ctx.fillStyle = "#16103a";
    ctx.fillRect(0, 0, WORLD_W, levelH);
    ctx.strokeStyle = "rgba(160, 180, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let y = T * 0.75; y < levelH; y += T * 0.75) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
    const count = Math.round(110 * (rows / ROWS));
    for (let i = 0; i < count; i++) {
      const x = hash(i) * WORLD_W;
      const y = hash(i + 1000) * levelH;
      const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + hash(i + 2000) * 3) + hash(i + 3000) * 6.28);
      const big = hash(i + 4000) > 0.82;
      const r = (big ? 3.2 : 1.6) * (0.6 + tw * 0.6);
      ctx.fillStyle = `rgba(${big ? "255, 240, 200" : "220, 230, 255"}, ${0.25 + tw * 0.75})`;
      if (big) {
        // A four-pointed twinkle.
        ctx.beginPath();
        ctx.moveTo(x, y - r * 2.2);
        ctx.quadraticCurveTo(x, y, x + r * 2.2, y);
        ctx.quadraticCurveTo(x, y, x, y + r * 2.2);
        ctx.quadraticCurveTo(x, y, x - r * 2.2, y);
        ctx.quadraticCurveTo(x, y, x, y - r * 2.2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPaper(): void {
    if (ethereal) {
      drawStarSky();
      return;
    }
    ctx.fillStyle = "#f7f1e1";
    ctx.fillRect(0, 0, WORLD_W, levelH);
    ctx.strokeStyle = "rgba(90, 140, 210, 0.22)";
    ctx.lineWidth = 1;
    for (let y = T * 0.75; y < levelH; y += T * 0.75) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(220, 80, 80, 0.3)";
    ctx.beginPath();
    ctx.moveTo(T * 1.6, 0);
    ctx.lineTo(T * 1.6, levelH);
    ctx.stroke();
  }

  function drawTiles(): void {
    ctx.lineCap = "round";
    let signNum = 0;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const c = tileAt(tx, ty);
        const x = tx * T;
        const y = ty * T;
        if (isThin(c)) {
          // A thin post: 1-pixel jumps! [ and ] only show up in their own dimension.
          if ((c === "[" && ethereal) || (c === "]" && !ethereal)) continue;
          const px = postLeft(tx);
          ctx.fillStyle = c === "]" ? "rgba(150, 200, 255, 0.85)" : c === "[" ? "#ddd3e8" : "#e3dccb";
          ctx.fillRect(px, y, POST_W, T);
          ctx.strokeStyle = c === "]" ? "#dff0ff" : c === "[" ? "#3a2c5c" : "#2b2725";
          ctx.lineWidth = 2.2;
          if (c === "[") ctx.setLineDash([5, 4]);
          ctx.strokeRect(px, y, POST_W, T);
          ctx.setLineDash([]);
          continue;
        }
        if (c === "*" || c === "g") {
          // A gem, bobbing and shining. Ones you already have are see-through.
          const bob = Math.sin(time * 3 + tx) * 3;
          const gx = x + T / 2;
          const gy = y + T / 2 + bob;
          ctx.save();
          ctx.globalAlpha = c === "g" ? 0.3 : 1;
          ctx.fillStyle = "#5ce1ff";
          ctx.strokeStyle = "#0d6e8c";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(gx - 11, gy - 4);
          ctx.lineTo(gx - 6, gy - 11);
          ctx.lineTo(gx + 6, gy - 11);
          ctx.lineTo(gx + 11, gy - 4);
          ctx.lineTo(gx, gy + 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 1.2;
          sketchLine(gx - 11, gy - 4, gx + 11, gy - 4, 0.3);
          sketchLine(gx - 4, gy - 4, gx, gy + 12, 0.3);
          sketchLine(gx + 4, gy - 4, gx, gy + 12, 0.3);
          if (c === "*") {
            const shine = Math.max(0, Math.sin(time * 4 + tx * 2));
            ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + shine * 0.5})`;
            ctx.beginPath();
            ctx.arc(gx - 4, gy - 7, 1.5 + shine * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else if (c === "1" || c === "2") {
          // Dimension blocks only show up in their own dimension.
          if ((c === "1") === ethereal) continue;
          if (c === "1") {
            // Normal-dimension block: like a wall, but with a dashed outline
            // (it's not there in the Ethereal Dimension).
            ctx.fillStyle = "#ddd3e8";
            ctx.fillRect(x, y, T, T);
            ctx.strokeStyle = "rgba(80, 60, 120, 0.3)";
            ctx.lineWidth = 1.2;
            for (let i = 0; i < 4; i++) sketchLine(x + i * 11 + 4, y + T, x + i * 11 + 14, y, 0.8);
            ctx.strokeStyle = "#3a2c5c";
            ctx.lineWidth = 2.4;
            ctx.setLineDash([6, 5]);
            ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
            ctx.setLineDash([]);
          } else {
            // Ethereal block: glowing, with a little star inside.
            const glow = 0.75 + 0.25 * Math.sin(time * 3 + tx + ty);
            ctx.fillStyle = `rgba(120, 170, 255, ${0.35 * glow})`;
            ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
            ctx.strokeStyle = `rgba(200, 230, 255, ${glow})`;
            ctx.lineWidth = 2.4;
            ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
            const cx = x + T / 2;
            const cy = y + T / 2;
            const r = 7;
            ctx.fillStyle = `rgba(255, 245, 210, ${glow})`;
            ctx.beginPath();
            ctx.moveTo(cx, cy - r);
            ctx.quadraticCurveTo(cx, cy, cx + r, cy);
            ctx.quadraticCurveTo(cx, cy, cx, cy + r);
            ctx.quadraticCurveTo(cx, cy, cx - r, cy);
            ctx.quadraticCurveTo(cx, cy, cx, cy - r);
            ctx.fill();
          }
        } else if (c === "#" || c === "O" || c === "Y" || c === "Z") {
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
        } else if (c === "N" || c === "Q" || (c === "B" && test)) {
          // Trigger blocks you can see (in the Test Level): a dashed box with a label.
          const color = c === "N" ? "#c0392b" : c === "Q" ? "#8a5a2b" : "#d4a017";
          const label = c === "N" ? "MONSTER" : c === "Q" ? "SHUFFLE" : "FIGHT";
          ctx.fillStyle = c === "N" ? "rgba(192,57,43,0.15)" : c === "Q" ? "rgba(201,154,98,0.25)" : "rgba(255,210,63,0.2)";
          ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.4;
          ctx.setLineDash([5, 4]);
          ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
          ctx.setLineDash([]);
          ctx.font = "12px 'Patrick Hand', 'Comic Sans MS', cursive";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(label, x + T / 2, y - 7);
          if (c === "N") {
            drawMonsterAt(x + T / 2, y + T / 2, 9, 0);
          } else if (c === "Q") {
            // A tiny door.
            ctx.fillStyle = "#c99a62";
            ctx.fillRect(x + 12, y + 8, 16, 26);
            ctx.strokeStyle = "#5b3d1c";
            ctx.lineWidth = 1.8;
            ctx.strokeRect(x + 12, y + 8, 16, 26);
          } else {
            ctx.font = "18px 'Patrick Hand', 'Comic Sans MS', cursive";
            ctx.fillText("◎", x + T / 2, y + T / 2);
          }
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
          if (ethereal) ctx.fillStyle = "#9be59b"; // easier to see on the night sky
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
          drawLittleSign(x, y, signNum++);
        }
      }
    }
  }

  function drawLittleSign(x: number, y: number, num: number): void {
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
    const def = levelDef();
    const text = def.signs?.[num] ?? def.sign;
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
    if (ethereal) {
      // A soft glow, so you can see yourself in the dark.
      const g = ctx.createRadialGradient(cx, top + PH / 2, 4, cx, top + PH / 2, 34);
      g.addColorStop(0, "rgba(230, 240, 255, 0.75)");
      g.addColorStop(1, "rgba(230, 240, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - 36, top + PH / 2 - 36, 72, 72);
    }
    // The player, in whichever skin you picked.
    // (Short body, long legs: Oscar asked "where are my legs?")
    const swing = p.onGround && !p.dashing ? Math.sin(p.runPhase) * 7 : p.dashing ? 0 : 4;
    const pouring = keys.has("w") && unlocked(WATER_LEVEL) && !p.dashing;
    drawFigure(
      ctx,
      skinId,
      { cx, top, h: PH, facing: p.facing, lean, swing, arms: pouring ? "pour" : p.dashing ? "dash" : "swing", time },
      (x1, y1, x2, y2, wobble) => sketchLine(x1, y1, x2, y2, wobble)
    );
    if (pouring) {
      // The watering can, held out in front.
      const f = p.facing;
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
    }
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
    const gemText = test ? `   ·   💎 ${testGems}` : levelIndex >= GEM_LEVEL || gems.size > 0 ? `   ·   💎 ${gems.size}/${TOTAL_GEMS()}` : "";
    ctx.fillText(`${test ? "Test Level" : `Level ${levelIndex + 1}`}${name ? `: ${name}` : ""}   ·   Deaths: ${deaths}${gemText}`, w / 2, 26);
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
    if (unlocked(DIMENSION_LEVEL)) parts.push("A switch dimension");
    if (test) parts.push("K change skin");
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
    // The camera follows you up and down in tall levels.
    const want = Math.max(0, Math.min(levelH - WORLD_H, player.y + PH / 2 - WORLD_H / 2));
    camY += (want - camY) * Math.min(1, 0.12 * 60 / 60);
    if (Math.abs(want - camY) < 0.5) camY = want;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();
    ctx.translate(0, -camY);
    drawPaper();
    drawTiles();
    drawShuffle();
    drawPlayer();
    drawWires();
    drawGears();
    drawSlammers();
    drawCrushers();
    drawBombs();
    drawDrops();
    drawBits();
    drawMonster();
    drawBoss();
    drawSpam();
    ctx.restore();
    if (crushFlash > 0) {
      ctx.fillStyle = `rgba(232, 66, 58, ${crushFlash * 0.22})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
    if (warpFlash > 0) {
      ctx.fillStyle = `rgba(210, 225, 255, ${warpFlash * 0.45})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
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
    if (k === "s" && boss) {
      bossPress();
      return;
    }
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
      // Drop one while you're dashing and it flies forward.
      const thrown = player.dashing && !player.dashUp ? player.facing * DASH_SPEED * 1.3 : 0;
      bombs.push({ x: player.x + PW / 2, y: player.y + PH, vx: thrown, vy: 0 });
      sfx("bomb");
      if (popSign && popSign.leavingAt === null && levelIndex === BOMB_LEVEL) popSign.leavingAt = time;
    }
    // In the Test Level, K tries on every skin (nothing gets saved).
    if (k === "k" && test) {
      const i = SKINS.findIndex((sk) => sk.id === skinId);
      skinId = SKINS[(i + 1) % SKINS.length]!.id;
      sfx("pop");
    }
    // Dimensions: press A to switch (from Level 41 on).
    if (k === "a" && unlocked(DIMENSION_LEVEL) && !deadUntil && !clearedAt) {
      switchDimension();
      if (popSign && popSign.leavingAt === null && levelIndex === DIMENSION_LEVEL) popSign.leavingAt = time;
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
  // Jump (holding a direction), switch dimensions in mid-air, and land.
  function* jumpA(k: string, switchIt = true, aDelay = 200): Route {
    botKeys.down(k);
    botKeys.down("arrowup");
    yield* wait(aDelay);
    botKeys.up("arrowup");
    if (switchIt) yield* hold("a", 30);
    let guard = 0;
    while (!player.onGround && !deadUntil && guard++ < 400) yield;
    botKeys.up(k);
    yield* wait(150);
  }
  // A short hop: only move sideways for a bit, then land.
  function* hop(k: string, ms: number): Route {
    botKeys.down(k);
    botKeys.down("arrowup");
    yield* wait(ms);
    botKeys.up(k);
    yield* wait(100);
    botKeys.up("arrowup");
    let guard = 0;
    while (!player.onGround && !deadUntil && guard++ < 400) yield;
    yield* wait(150);
  }
  // Wait until the crusher over this column has just slammed and gone back up.
  function* waitCrush(tx: number): Route {
    const c = crushers.find((m) => tx >= m.x0 && tx <= m.x1);
    if (!c) return;
    let guard = 0;
    while (crushPhase(c) < 0 && guard++ < 3000) yield;
    while (crushPhase(c) >= 0 && guard++ < 3000) yield;
  }
  // Walk to an exact spot (for the skinny doors), with tiny taps at the end.
  function* walkToX(x: number): Route {
    let guard = 0;
    while (guard++ < 600) {
      const dx = x - (player.x + PW / 2);
      if (Math.abs(dx) < 3) break;
      const k = dx > 0 ? R : L;
      botKeys.down(k);
      yield;
      if (Math.abs(dx) < 30) {
        botKeys.up(k);
        yield* wait(60);
      }
    }
    botKeys.up(R);
    botKeys.up(L);
    yield* wait(200);
  }
  // Wait until crusher number i (left to right) has just slammed and gone back.
  function* waitCrushN(i: number): Route {
    const c = crushers[i];
    if (!c) return;
    let guard = 0;
    while (crushPhase(c) < 0 && guard++ < 3000) yield;
    while (crushPhase(c) >= 0 && guard++ < 3000) yield;
  }
  // Jump from a thin post and land on the one at this column.
  function* hopTo(tx: number, switchIt = false): Route {
    const target = tx * T + T / 2;
    const k = player.x + PW / 2 < target ? R : L;
    botKeys.down(k);
    botKeys.down("arrowup");
    let guard = 0;
    let switched = false;
    while (!deadUntil && guard++ < 400) {
      yield;
      if (guard === 12) botKeys.up("arrowup");
      if (switchIt && !switched && guard > 8) {
        switched = true;
        keyDown("a");
        keys.delete("a");
      }
      const cx = player.x + PW / 2;
      if ((k === R ? target - cx : cx - target) < 24) break;
    }
    botKeys.up(k);
    botKeys.up("arrowup");
    guard = 0;
    while (!player.onGround && !deadUntil && guard++ < 400) yield;
    yield* wait(200);
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
    function* () { yield* walkTo(5); yield* hold("d", 600); yield* walkTo(16); yield* hold("d", 600); yield* walkTo(29); },
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
    function* () { yield* walkTo(10); yield* hold("d", 600); yield* walkTo(29); },
    function* () { yield* walkTo(5); yield* hold("d", 600); yield* walkTo(17); yield* upDash(300, R, 300); yield* walkTo(27); },
    function* () { yield* walkTo(4); yield* hold("d", 600); yield* walkTo(16); yield* hold("w", 900); yield* wait(600); yield* walkTo(28); },
    function* () {
      for (const at of [6, 12, 18]) { yield* walkTo(at); botKeys.down(R); yield* hold("arrowup", 300); yield* wait(450); botKeys.up(R); }
      yield* walkTo(28);
    },
    function* () { yield* walkTo(4); yield* hold("d", 600); yield* walkTo(22); },
    // Dimensions (Levels 41-45)
    function* () { yield* walkTo(7); yield* hold("a", 40); yield* wait(200); yield* walkTo(29); },
    function* () {
      yield* walkTo(3); yield* jumpA(R, false);
      yield* walkTo(7); yield* jumpA(R);
      yield* walkTo(12); yield* jumpA(R);
      yield* walkTo(17); yield* jumpA(R);
      yield* walkTo(22); yield* jumpA(R, false);
      yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3); yield* jumpA(R, false);
      yield* walkTo(8); yield* jumpA(R);
      yield* walkTo(13); yield* jumpA(R);
      yield* walkTo(18); yield* jumpA(R);
      yield* walkTo(23); yield* jumpA(R, false);
      yield* walkTo(28);
    },
    function* () {
      yield* walkTo(6); yield* hold("a", 40); yield* wait(200);
      yield* walkTo(12); yield* hold("d", 150); yield* wait(300);
      yield* hold("a", 40); yield* wait(200);
      yield* walkTo(16); yield* hold("d", 600); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3); yield* jumpA(R, false);
      yield* walkTo(7); yield* jumpA(R);
      yield* walkTo(12); yield* jumpA(R);
      yield* walkTo(17); yield* jumpA(R);
      yield* walkTo(22); yield* jumpA(R, false);
      yield* walkTo(29);
    },
    // Gems (Levels 46-50): the demo grabs every gem.
    function* () {
      yield* walkTo(4); yield* hold("d", 300); yield* wait(200);
      yield* walkTo(12); yield* jumpA(R, false);
      yield* walkTo(19); yield* jumpA(R, false);
      yield* walkTo(29);
    },
    function* () {
      yield* walkTo(4); yield* hold("w", 1100); yield* wait(500); yield* walkTo(1);
      yield* walkTo(15); yield* upDash(300, "x", 0); yield* wait(300);
      yield* walkTo(21); yield* hold("a", 40); yield* wait(200); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(4);
      botKeys.down("arrowup"); yield* wait(130); botKeys.up("arrowup"); yield* wait(32);
      botKeys.down("arrowup"); yield* wait(300); botKeys.up("arrowup");
      yield* hold(L, 450); yield* wait(400); yield* walkTo(2);
      yield* walkTo(5); yield* wait(600); yield* hold("d", 600); yield* wait(300);
      yield* walkTo(17); yield* jumpDash(180, 500); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(13); yield* walkTo(18); yield* jumpA(R, false);
      yield* walkTo(23); yield* hold("a", 40); yield* wait(200);
      yield* hop(R, 250); yield* hop(R, 300); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3); yield* jumpA(R, false);
      yield* walkTo(8); yield* jumpA(R);
      yield* walkTo(13); yield* jumpA(R);
      yield* walkTo(18); yield* jumpA(R, false);
      yield* walkTo(25); yield* upDash(300, "x", 0); yield* wait(300);
      yield* walkTo(29);
    },
    // The Tests (Levels 51-55).
    function* () {
      yield* walkTo(5); yield* waitCrush(8); yield* walkTo(11);
      yield* waitCrush(14); yield* walkTo(17); yield* waitCrush(20); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3);
      for (const tx of [7, 11, 15, 19, 23]) yield* hopTo(tx);
      yield* hopTo(28); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3);
      yield* hopTo(7);
      for (const tx of [11, 15, 19, 23]) yield* hopTo(tx, true);
      yield* hopTo(28); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(4); yield* hold(R, 30); yield* wait(150);
      botKeys.down("d"); yield* wait(40); yield* hold("b", 30); yield* wait(500); botKeys.up("d");
      yield* upDash(300, R, 250);
      yield* walkTo(21); yield* jumpA(R, false); yield* walkTo(28);
    },
    function* () {
      yield* walkTo(3); yield* waitCrush(6); yield* walkTo(9);
      yield* waitCrush(12); yield* walkTo(15); yield* waitCrush(18); yield* walkTo(21);
      yield* waitCrush(24); yield* walkTo(26); yield* jumpA(R, false); yield* walkTo(29);
    },
    // The Tests (Levels 56-60).
    function* () {
      yield* walkTo(7); yield* waitCrushN(0); yield* jumpA(R, false);
      yield* walkTo(15); yield* waitCrushN(1); yield* jumpA(R, false);
      yield* walkTo(23); yield* waitCrushN(2); yield* jumpA(R, false); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3); yield* hopTo(7);
      yield* waitCrushN(0); yield* hopTo(11); yield* hopTo(15);
      yield* waitCrushN(1); yield* hopTo(19); yield* hopTo(23);
      yield* hopTo(28); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3); yield* hopTo(7);
      yield* hold("w", 1300); yield* wait(600);
      yield* hopTo(11);
      for (const tx of [15, 19, 23]) yield* hopTo(tx, true);
      yield* hopTo(27); yield* hold("w", 1300); yield* wait(600); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(4); yield* hold("d", 600); yield* wait(150);
      yield* walkTo(15);
      yield* waitCrushN(1);
      yield* upDash(300, R, 250);
      yield* walkTo(17); yield* hold(R, 40); yield* wait(100);
      botKeys.down("d"); yield* wait(30); yield* hold("b", 30); yield* wait(300); botKeys.up("d");
      yield* wait(300); yield* walkTo(26); yield* jumpA(R, false); yield* walkTo(29);
      // The top part: Up Dash, then back to the left on tiny posts.
      yield* upDash(300, L, 350); yield* walkTo(24);
      yield* hold("a", 40); yield* waitCrushN(2);
      yield* hopTo(20); yield* hopTo(16, true); yield* hopTo(12, true); yield* hopTo(8);
      yield* waitCrushN(2); yield* hopTo(4); yield* walkTo(2);
    },
    function* () {
      yield* waitCrushN(0); yield* walkTo(10); yield* waitCrushN(1); yield* jumpA(R, false);
      yield* walkTo(15); yield* waitCrushN(2); yield* walkTo(21); yield* waitCrushN(3); yield* jumpA(R, false);
      yield* walkTo(29);
    },
    function* () {
      // 100 Doors: the bot peeks too.
      let guard = 0;
      while ((!shuffle || shuffle.phase !== "pick") && guard++ < 6000) yield;
      if (!shuffle) return;
      yield* walkToX(doorX(shuffle.slotOf[shuffle.real]!));
      yield* hold("arrowdown", 40);
    },
    // The Tests (Levels 62-66).
    function* () {
      yield* walkTo(3); yield* waitCrushN(0); yield* hopTo(7);
      yield* hopTo(11, true); yield* waitCrushN(1); yield* hopTo(15, true);
      yield* hopTo(19, true); yield* waitCrushN(0); yield* hopTo(23, true);
      yield* hopTo(28); yield* walkTo(29);
    },
    function* () {
      for (const [from, ms] of [[3, 330], [12, 330], [21, 330]] as const) {
        yield* walkTo(from); yield* hold(R, 30); yield* wait(150);
        botKeys.down("d"); yield* wait(30); yield* hold("b", 30); yield* wait(ms - 60); botKeys.up("d");
        yield* wait(400);
      }
      yield* walkTo(29);
    },
    function* () {
      for (const [c, u] of [[7, 8], [16, 17], [25, 26]] as const) {
        yield* walkTo(c - 4); yield* waitCrushN(c === 7 ? 0 : c === 16 ? 1 : 2);
        yield* walkTo(c); yield* hold(R, 20); yield* hold("w", 1300); yield* wait(500);
        yield* walkTo(u + 2);
      }
      yield* walkTo(29);
    },
    function* () {
      yield* walkTo(3);
      for (const [f, island] of [[7, 10], [15, 19], [24, 29]] as const) {
        yield* waitCrushN(0);
        botKeys.down(R);
        let guard = 0;
        while (ptx() < f - 2 && guard++ < 400) yield;
        yield* hold("arrowup", 120);
        while (ptx() < island && guard++ < 800) yield;
        botKeys.up(R);
        yield* wait(150);
      }
    },
    function* () {
      yield* waitCrushN(0); yield* walkTo(7); yield* hopTo(9);
      yield* waitCrushN(1); yield* hopTo(11); yield* walkTo(14); yield* hopTo(16);
      yield* waitCrushN(2); yield* hopTo(18); yield* walkTo(21); yield* hopTo(23);
      yield* waitCrushN(3); yield* hopTo(25); yield* walkTo(30);
    },
    // The Tests (Levels 67-70).
    function* () {
      yield* walkTo(3); yield* waitCrushN(1); yield* hopTo(6); yield* hopTo(10);
      yield* waitCrushN(0); yield* hopTo(14); yield* hopTo(18);
      yield* waitCrushN(1); yield* hopTo(22); yield* hopTo(27); yield* walkTo(28);
    },
    function* () {
      yield* walkTo(3); yield* hold("a", 40); yield* wait(150); yield* jumpA(R, false);
      yield* walkTo(8); yield* jumpA(R); yield* walkTo(13); yield* jumpA(R);
      yield* walkTo(18); yield* jumpA(R, false); yield* walkTo(22); yield* walkTo(23);
      yield* hold("d", 400); yield* wait(200); yield* hold("a", 40); yield* wait(150); yield* walkTo(29);
    },
    function* () {
      yield* walkTo(4); yield* waitSafe(7); yield* walkTo(11);
      yield* waitSafe(15); yield* walkTo(19); yield* walkTo(20);
      yield* waitSafe(23); yield* walkTo(29);
    },
    function* () {
      yield* waitCrushN(0); yield* walkTo(6); yield* hopTo(8);
      yield* waitCrushN(1); yield* hopTo(10); yield* walkTo(13); yield* hopTo(15);
      yield* waitCrushN(2); yield* hopTo(17); yield* walkTo(20); yield* hopTo(22);
      yield* waitCrushN(3); yield* hopTo(24); yield* walkTo(29);
    },
    // Crush Mania (Level 71, Oscar's own level): follow right behind the
    // wave of crushers, post to post, switching dimensions every hop.
    function* () {
      yield* walkTo(5); yield* waitCrushN(1); yield* walkTo(6);
      yield* waitCrushN(2); yield* hopTo(8);
      let k = 3;
      for (const tx of [10, 12, 14, 16, 18, 20, 22, 24, 26]) {
        yield* waitCrushN(k++);
        yield* hopTo(tx, true);
      }
      yield* waitCrushN(12); yield* hopTo(29); yield* walkTo(30);
    },
    function* () {
      // SPAM (Level 72): the bot clicks super fast.
      let guard = 0;
      while (spam && !spam.done && guard++ < 400) {
        spamClick();
        yield* wait(70);
      }
      yield* wait(300);
      yield* walkTo(29);
    },
    function* () {
      // The Climb (Level 73): four floors, bottom to top.
      const straightUp = function* (land: string): Route {
        botKeys.down("arrowup"); yield* wait(130); botKeys.up("arrowup"); yield* wait(32);
        botKeys.down("arrowup"); yield* wait(320); botKeys.up("arrowup");
        yield* hold(land, 420); yield* wait(400);
      };
      // Floor 1: tiny posts, then Up Dash.
      yield* walkTo(5);
      for (const tx of [9, 13, 17, 21, 25]) yield* hopTo(tx);
      yield* walkTo(27); yield* straightUp(L);
      // Floor 2: water the wall, switch dimensions, hop, Up Dash.
      yield* walkTo(24); yield* walkTo(21); yield* hold(L, 20); yield* hold("w", 1300); yield* wait(500);
      yield* walkTo(17); yield* hold("a", 40); yield* wait(150);
      yield* walkTo(14); yield* jumpA(L, false); yield* walkTo(10); yield* jumpA(L, false);
      yield* walkTo(3); yield* straightUp(R);
      // Floor 3: the crushers.
      yield* walkTo(5); yield* waitCrushN(0); yield* walkTo(12);
      yield* waitCrushN(1); yield* walkTo(18); yield* waitCrushN(2); yield* walkTo(27);
      yield* straightUp(L);
      // Floor 4: jump the fake doors.
      yield* walkTo(22); yield* jumpA(L, false); yield* walkTo(15); yield* jumpA(L, false); yield* walkTo(6);
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
  // SPAM: click (anywhere) as fast as you can.
  const onPointerDown = (): void => spamClick();
  if (!demo) window.addEventListener("pointerdown", onPointerDown);

  const handle: GameHandle = {
    stop() {
      stopped = true;
      if (!demo) {
        stopMusic();
        stopStarMusic();
      }
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointerDown);
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
    ethereal,
    gems: gems.size,
    testGems,
    skin: skinId,
    crush: () => crushers.map((c) => `${c.x0}:${crushPhase(c).toFixed(2)}`).join(" "),
    bombs: () => bombs.map((b) => `${Math.round(b.x)},${Math.round(b.y)}${b.vx ? ">" : ""}${b.armed ? "!" : ""}`).join(" "),
    deaths,
    row: (y: number) => grid[y]?.join(""),
    monster: () => monster && { mode: monster.mode, dist: Math.round(Math.hypot(monster.x - player.x - PW / 2, monster.y - player.y - PH / 2)) },
    monsters: () => allMonsters().map((m) => m.mode).join(" "),
    spam: () => spam && { count: spam.count, done: spam.done, gap: Math.round(player.y - spamBottom()) },
    click: () => spamClick(),
    boss: () => boss && { round: boss.round, r: Math.round(boss.r), t: boss.t, done: boss.done },
    doors: () =>
      shuffle && {
        phase: shuffle.phase,
        realCol: Math.floor(doorX(shuffle.slotOf[shuffle.real]!) / T),
        wrongCol: Math.floor(doorX(shuffle.slotOf[(shuffle.real + 1) % shuffle.xs.length]!) / T),
        realX: Math.round(doorX(shuffle.slotOf[shuffle.real]!)),
        wrongX: Math.round(doorX(shuffle.slotOf[(shuffle.real + 1) % shuffle.xs.length]!)),
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
/** One level's map and settings (the level editor reads these). */
export const getLevelDef = (index: number): LevelDef | undefined => LEVELS[index];
/** How many gems there are in all the levels. */
export const TOTAL_GEMS = (): number => LEVELS.reduce((n, l) => n + l.map.join("").split("*").length - 1, 0);

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
