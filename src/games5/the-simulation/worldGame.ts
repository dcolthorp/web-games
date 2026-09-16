// The Simulation itself, once you press START. You land in a lobby, pick
// survival or creative and how big the map is, and go in. Survival is the
// game: fragments to collect and glitches chasing you. Creative is for
// building your own map, where you can place anything, glitches included.

import {
  GLITCH_INFO,
  GLITCH_KINDS,
  hasCaught,
  newGlitch,
  updateGlitch,
  type Glitch,
  type GlitchKind,
} from "./glitches";
import {
  BOSS_HEALTH,
  BOSS_HEIGHT,
  PHASE_NAMES,
  bossHasCaught,
  makeBossArena,
  newBoss,
  rotLadder,
  throwShard,
  updateBoss,
  updateShards,
  type Boss,
  type Shard,
} from "./bossFight";
import { buttonAt, drawButton, row, type MenuButton } from "./menus";
import { EYE, newPlayer, updatePlayer, type Input, type Player } from "./player";
import { SKY, paintGlitchPortrait, renderWorld, type Sprite } from "./render3d";
import {
  BLACK,
  BLUE,
  EMPTY,
  FRAGMENT_COUNT,
  LADDER,
  MAP_SIZES,
  PLAIN,
  blockAt,
  isSolid,
  lineOfSight,
  makeArena,
  makeFlatArena,
  setBlock,
  type Arena,
  type MapSizeId,
  type Spot,
} from "./world";

const BLACKEN_EVERY_MS = 55;
const FALL_AWAY_MS = 260;
const SCARE_AFTER_MS = 1100;
// One of every kind.
const GLITCH_COUNT = GLITCH_KINDS.length;
// How long you get before they start moving.
const HEAD_START_MS = 7000;
// How wide what you can see is, and how far off you can still make something out.
const SIGHT_ANGLE = 0.62;
const SIGHT_RANGE = 26;
const FRAGMENT_REACH = 1.3;
// How fast the arrow keys turn you, for looking around without a mouse.
const LOOK_SPEED = 2.1;
const REACH = 4.2;
// Getting every fragment: they fly together, there's a flash, and what they
// make is what the final boss comes out of.
const FORGE_FLY_MS = 2600;
const FORGE_FLASH_MS = 400;

// What you can place in creative, and the key that picks it.
const PALETTE = [
  { id: "block", label: "BLOCK" },
  { id: "blue", label: "BLUE" },
  { id: "ladder", label: "LADDER" },
  { id: "fragment", label: "FRAGMENT" },
  { id: "stalker", label: "STALKER" },
  { id: "stopframe", label: "STOPFRAME" },
  { id: "flicker", label: "FLICKER" },
  { id: "mimic", label: "MIMIC" },
] as const;
type PaletteId = (typeof PALETTE)[number]["id"];

// Which glitches you've laid eyes on. It's remembered between games, so the
// index fills up as you meet them.
const SEEN_KEY = "the-simulation-glitches-seen";

function loadSeen(): Set<GlitchKind> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    if (!Array.isArray(saved)) return new Set();
    return new Set(saved.filter((kind): kind is GlitchKind => GLITCH_KINDS.includes(kind as GlitchKind)));
  } catch {
    return new Set();
  }
}

export interface WorldSounds {
  fragment(): void;
  block(): void;
  scare(): void;
  forge(): void;
}

type Screen = "lobby" | "world";
type Mood = "playing" | "paused" | "index" | "caught" | "crashed" | "forging" | "won";
type Mode = "survival" | "creative" | "boss";

interface FallingBlock {
  x: number;
  y: number;
  z: number;
  blackAt: number;
}

export interface WorldGame {
  update(now: number, dt: number): void;
  draw(now: number): void;
  // Where you are and what's around you, for checking the game from the outside.
  peek(): {
    player: Player;
    glitches: Glitch[];
    fragments: Spot[];
    fragmentsLeft: number;
    mood: string;
    screen: string;
    mode: string;
    boss: Boss | null;
  };
  hold(key: string, down: boolean): void;
  look(byX: number, byY: number): void;
  use(): void;
  remove(): void;
  pick(slot: number): void;
  togglePause(): void;
  // A menu is up, so a click is a click on a button and not on the world.
  isMenu(): boolean;
  click(x: number, y: number): void;
  isCrashed(): boolean;
  restart(): void;
}

export function createWorldGame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sounds: WorldSounds
): WorldGame {
  let screen: Screen = "lobby";
  let mood: Mood = "playing";
  let mode: Mode = "survival";
  let sizeId: MapSizeId = "medium";
  let arena: Arena = makeFlatArena(26);
  let player: Player = newPlayer(arena.spawn);
  let fragments: Spot[] = [];
  let glitches: Glitch[] = [];
  let caughtAt = 0;
  let startedAt = 0;
  let forgeAt = 0;
  let blackened: FallingBlock[] = [];
  let lastBlackenAt = 0;
  let holding: PaletteId = "block";
  let boss: Boss | null = null;
  let shards: Shard[] = [];
  // When you got on the ladder you're on, so the boss knows when to take it away.
  let climbingSince = 0;
  const held = new Set<string>();
  const seen = loadSeen();

  const mapSize = (): number => MAP_SIZES.find((choice) => choice.id === sizeId)?.size ?? 40;

  function spawnGlitches(): void {
    glitches = [];
    if (mode === "creative") return;
    const size = mapSize();
    for (let i = 0; i < GLITCH_COUNT; i += 1) {
      const turn = (i * Math.PI * 2) / GLITCH_COUNT;
      const away = size * 0.42;
      const spot = { x: player.x + Math.sin(turn) * away, y: 1, z: player.z + Math.cos(turn) * away };
      glitches.push(newGlitch(spot, GLITCH_KINDS[i] ?? "stalker"));
    }
  }

  // Into a fresh map, the way the lobby says.
  function enterWorld(): void {
    if (mode === "boss") {
      arena = makeBossArena(30);
      player = newPlayer(arena.spawn);
      fragments = [];
      glitches = [];
      shards = [];
      climbingSince = 0;
      boss = newBoss({ x: arena.world.sizeX / 2, y: 1, z: arena.world.sizeZ / 2 }, performance.now());
    } else {
      arena = mode === "creative" ? makeFlatArena(mapSize()) : makeArena(Math.floor(Math.random() * 100000), mapSize());
      player = newPlayer(arena.spawn);
      fragments = [...arena.fragments];
      boss = null;
      shards = [];
      spawnGlitches();
    }
    blackened = [];
    startedAt = 0;
    mood = "playing";
    screen = "world";
    held.clear();
  }

  function restart(): void {
    enterWorld();
  }

  function rememberGlitch(kind: GlitchKind): void {
    if (seen.has(kind)) return;
    seen.add(kind);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // Then the index forgets when you close the game.
    }
  }

  // Are you looking right at it? A stopframe only moves when you aren't, and a
  // glitch you can see is a glitch to run from.
  function canSee(glitch: { x: number; y: number; z: number }, tall = 0.95): boolean {
    const eye = { x: player.x, y: player.y + EYE, z: player.z };
    const middle = { x: glitch.x, y: glitch.y + tall, z: glitch.z };
    const awayX = middle.x - eye.x;
    const awayY = middle.y - eye.y;
    const awayZ = middle.z - eye.z;
    const away = Math.hypot(awayX, awayY, awayZ);
    if (away > SIGHT_RANGE) return false;
    const aim = {
      x: Math.sin(player.yaw) * Math.cos(player.pitch),
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * Math.cos(player.pitch),
    };
    const straightness = (awayX * aim.x + awayY * aim.y + awayZ * aim.z) / (away || 1);
    if (straightness < Math.cos(SIGHT_ANGLE)) return false;
    return lineOfSight(arena.world, eye, middle);
  }

  function input(): Input {
    const down = (...keys: string[]): boolean => keys.some((key) => held.has(key));
    return {
      forward: Number(down("w")) - Number(down("s")),
      strafe: Number(down("d")) - Number(down("a")),
      up: down(" ", "space"),
      down: down("shift"),
    };
  }

  // Looking around with the arrow keys, for when the mouse can't be used.
  function lookWithArrows(dt: number): void {
    const turn = Number(held.has("arrowright")) - Number(held.has("arrowleft"));
    const tilt = Number(held.has("arrowdown")) - Number(held.has("arrowup"));
    if (turn === 0 && tilt === 0) return;
    player.yaw += turn * LOOK_SPEED * dt;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - tilt * LOOK_SPEED * dt));
  }

  // What you're looking at, up to arm's reach: the block, and the empty spot in
  // front of it where something new would go.
  function lookingAt(): { at: Spot | null; before: Spot | null } {
    const aim = {
      x: Math.sin(player.yaw) * Math.cos(player.pitch),
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * Math.cos(player.pitch),
    };
    let before: Spot | null = null;
    for (let step = 0.1; step < REACH; step += 0.1) {
      const x = Math.floor(player.x + aim.x * step);
      const y = Math.floor(player.y + EYE + aim.y * step);
      const z = Math.floor(player.z + aim.z * step);
      if (isSolid(blockAt(arena.world, x, y, z))) return { at: { x, y, z }, before };
      before = { x, y, z };
    }
    return { at: null, before };
  }

  // In creative, E puts down whatever you're holding. In survival it's blue
  // blocks only: pick one up, or put one back.
  function use(): void {
    if (mood !== "playing") return;

    if (mode === "boss") {
      // A shard of the forged crystal. It only does anything while looking at
      // the boss is holding it still.
      shards.push(throwShard(player, performance.now()));
      sounds.fragment();
      return;
    }

    const { at, before } = lookingAt();

    if (mode === "creative") {
      if (!before) return;
      const spot = { x: before.x + 0.5, y: before.y + 0.5, z: before.z + 0.5 };
      if (holding === "block") setBlock(arena.world, before.x, before.y, before.z, PLAIN);
      else if (holding === "blue") setBlock(arena.world, before.x, before.y, before.z, BLUE);
      else if (holding === "ladder") setBlock(arena.world, before.x, before.y, before.z, LADDER);
      else if (holding === "fragment") fragments.push(spot);
      else glitches.push(newGlitch({ x: spot.x, y: before.y, z: spot.z }, holding as GlitchKind));
      sounds.block();
      return;
    }

    if (at && blockAt(arena.world, at.x, at.y, at.z) === BLUE) {
      setBlock(arena.world, at.x, at.y, at.z, EMPTY);
      player.blue += 1;
      sounds.block();
      return;
    }
    if (player.blue > 0 && before && blockAt(arena.world, before.x, before.y, before.z) === EMPTY) {
      setBlock(arena.world, before.x, before.y, before.z, BLUE);
      player.blue -= 1;
      sounds.block();
    }
  }

  // Q takes away: the block you're looking at, or whatever you put down near you.
  function remove(): void {
    if (mood !== "playing" || mode !== "creative") return;
    const { at } = lookingAt();
    if (at && blockAt(arena.world, at.x, at.y, at.z) !== EMPTY) {
      setBlock(arena.world, at.x, at.y, at.z, EMPTY);
      sounds.block();
      return;
    }
    const near = (spot: Spot): number => Math.hypot(spot.x - player.x, spot.z - player.z);
    const closestGlitch = glitches.filter((glitch) => near(glitch) < 3).sort((one, other) => near(one) - near(other))[0];
    if (closestGlitch) {
      glitches = glitches.filter((glitch) => glitch !== closestGlitch);
      sounds.block();
      return;
    }
    const closestFragment = fragments.filter((spot) => near(spot) < 3).sort((one, other) => near(one) - near(other))[0];
    if (closestFragment) {
      fragments = fragments.filter((spot) => spot !== closestFragment);
      sounds.block();
    }
  }

  function collectFragments(): void {
    if (mode === "creative") return;
    fragments = fragments.filter((fragment) => {
      const near =
        Math.hypot(fragment.x - player.x, fragment.y - (player.y + EYE * 0.6), fragment.z - player.z) < FRAGMENT_REACH;
      if (!near) return true;
      player.fragments += 1;
      sounds.fragment();
      // That was the last one.
      if (player.fragments >= FRAGMENT_COUNT) {
        mood = "forging";
        forgeAt = performance.now();
        sounds.forge();
      }
      return false;
    });
  }

  // Caught: the blocks around you start turning black one at a time, and each
  // black block falls away.
  function blackenAnother(now: number): void {
    if (now - lastBlackenAt < BLACKEN_EVERY_MS) return;
    lastBlackenAt = now;
    for (let tries = 0; tries < 40; tries += 1) {
      const x = Math.floor(player.x + (Math.random() - 0.5) * 16);
      const z = Math.floor(player.z + (Math.random() - 0.5) * 16);
      const y = Math.floor(Math.random() * 6);
      if (!isSolid(blockAt(arena.world, x, y, z))) continue;
      setBlock(arena.world, x, y, z, BLACK);
      blackened.push({ x, y, z, blackAt: now });
      return;
    }
  }

  function dropBlackened(now: number): void {
    blackened = blackened.filter((block) => {
      if (now - block.blackAt < FALL_AWAY_MS) return true;
      setBlock(arena.world, block.x, block.y, block.z, EMPTY);
      return false;
    });
  }

  // The boss fight has its own rules: shards, a boss taking turns at being every
  // kind of glitch, and ladders that don't hold you for long.
  function updateBossFight(now: number, dt: number): void {
    if (!boss) return;
    lookWithArrows(dt);
    updatePlayer(arena.world, player, input(), dt);

    if (player.climbing) {
      if (climbingSince === 0) climbingSince = now;
      if (rotLadder(arena.world, player, climbingSince, now)) {
        climbingSince = now;
        sounds.block();
      }
    } else {
      climbingSince = 0;
    }

    const watched = canSee(boss, BOSS_HEIGHT / 2);
    updateBoss(arena.world, boss, player, dt, now, watched);
    const flying = updateShards(arena.world, shards, boss, dt, now);
    shards = flying.shards;
    if (flying.hits > 0) sounds.scare();
    if (flying.bounces > 0) sounds.block();

    if (boss.health <= 0) {
      mood = "won";
      sounds.forge();
      return;
    }
    if (bossHasCaught(boss, player)) {
      mood = "caught";
      caughtAt = now;
      lastBlackenAt = 0;
    }
  }

  function update(now: number, dt: number): void {
    if (screen === "lobby") return;
    if (mood === "crashed" || mood === "paused" || mood === "index" || mood === "forging" || mood === "won") return;

    if (mood === "playing" && mode === "boss") {
      updateBossFight(now, dt);
      return;
    }

    if (mood === "playing") {
      if (startedAt === 0) startedAt = now;
      lookWithArrows(dt);
      updatePlayer(arena.world, player, input(), dt);
      collectFragments();
      if (mode === "creative") return;

      // Seeing one is what puts it in the index, even while they're still holding still.
      const watching = glitches.map((glitch) => {
        const watched = canSee(glitch);
        if (watched && !glitch.hiding) rememberGlitch(glitch.kind);
        return watched;
      });

      // They hold still at first, so you get a look at the place before the running starts.
      if (now - startedAt < HEAD_START_MS) return;
      for (const [index, glitch] of glitches.entries()) {
        updateGlitch(arena.world, glitch, player, dt, now, watching[index] ?? false);
        if (!hasCaught(glitch, player)) continue;
        mood = "caught";
        caughtAt = now;
        lastBlackenAt = 0;
      }
      return;
    }

    // Caught.
    blackenAnother(now);
    dropBlackened(now);
    if (now - caughtAt > SCARE_AFTER_MS) {
      mood = "crashed";
      sounds.scare();
    }
  }

  function sprites(): Sprite[] {
    const all: Sprite[] = fragments.map((fragment) => ({ ...fragment, kind: "fragment" as const, size: 0.45 }));
    for (const shard of shards) all.push({ x: shard.x, y: shard.y, z: shard.z, kind: "shard" as const, size: 0.3 });
    if (boss) {
      all.push({
        x: boss.x,
        y: boss.y + BOSS_HEIGHT / 2,
        z: boss.z,
        kind: "boss" as const,
        size: BOSS_HEIGHT,
        phase: boss.phase,
        frozen: boss.frozen,
      });
    }
    for (const glitch of glitches) {
      // A mimic in hiding looks like a fragment, which is the whole trick.
      if (glitch.hiding) {
        all.push({ x: glitch.x, y: glitch.y + 0.7, z: glitch.z, kind: "fakeFragment" as const, size: 0.45 });
        continue;
      }
      all.push({ x: glitch.x, y: glitch.y + 0.95, z: glitch.z, kind: glitch.kind, size: 1.9 });
    }
    return all;
  }

  // ---------- the menus ----------

  function lobbyButtons(): MenuButton[] {
    return [
      ...row(
        W,
        190,
        [
          { id: "mode-survival", label: "SURVIVAL", chosen: mode === "survival" },
          { id: "mode-creative", label: "CREATIVE", chosen: mode === "creative" },
          { id: "mode-boss", label: "FINAL BOSS", chosen: mode === "boss" },
        ],
        176
      ),
      ...row(
        W,
        300,
        MAP_SIZES.map((choice) => ({
          id: `size-${choice.id}`,
          label: `${choice.label} ${choice.size}`,
          chosen: sizeId === choice.id,
        })),
        170
      ),
      { id: "play", label: "GO IN", x: W / 2 - 130, y: 420, width: 260, height: 70, big: true },
    ];
  }

  function pauseButtons(): MenuButton[] {
    const buttons = [
      { id: "resume", label: "CARRY ON" },
      { id: "index", label: "GLITCH INDEX" },
      { id: "lobby", label: "EXIT TO LOBBY" },
    ];
    // In creative you can set your own map running with the glitches awake.
    if (mode === "creative") buttons.splice(1, 0, { id: "play-map", label: "PLAY THIS MAP" });
    return row(W, 250, buttons, 210, 64);
  }

  const indexButtons = (): MenuButton[] => [
    { id: "back", label: "BACK", x: W / 2 - 90, y: H - 80, width: 180, height: 52 },
  ];

  const crashedButtons = (): MenuButton[] => [
    ...row(W, H - 110, [
      { id: "again", label: "TRY AGAIN" },
      { id: "lobby", label: "EXIT TO LOBBY" },
    ], 210, 56),
  ];

  const menuButtons = (): MenuButton[] => {
    if (screen === "lobby") return lobbyButtons();
    if (mood === "paused") return pauseButtons();
    if (mood === "index") return indexButtons();
    if (mood === "crashed") return crashedButtons();
    if (mood === "forging") return [{ id: "face-it", label: "FACE IT", x: W / 2 - 110, y: H - 46, width: 220, height: 40 }];
    if (mood === "won") {
      return row(W, H - 110, [
        { id: "again", label: "FIGHT IT AGAIN" },
        { id: "lobby", label: "EXIT TO LOBBY" },
      ], 210, 56);
    }
    return [];
  };

  function click(x: number, y: number): void {
    const pressed = buttonAt(menuButtons(), x, y);
    if (!pressed) return;

    if (pressed.startsWith("mode-")) {
      mode = pressed === "mode-creative" ? "creative" : pressed === "mode-boss" ? "boss" : "survival";
      return;
    }
    if (pressed === "face-it") {
      // Out of the forging and straight at it.
      mode = "boss";
      enterWorld();
      return;
    }
    if (pressed.startsWith("size-")) {
      const chosen = MAP_SIZES.find((choice) => `size-${choice.id}` === pressed);
      if (chosen) sizeId = chosen.id;
      return;
    }
    if (pressed === "play" || pressed === "again") {
      enterWorld();
      return;
    }
    if (pressed === "resume") {
      mood = "playing";
      held.clear();
      return;
    }
    if (pressed === "index") {
      mood = "index";
      return;
    }
    if (pressed === "back") {
      mood = "paused";
      return;
    }
    if (pressed === "play-map") {
      // Your own map, but for real: the glitches you placed come alive.
      mode = "survival";
      startedAt = 0;
      mood = "playing";
      held.clear();
      return;
    }
    if (pressed === "lobby") {
      screen = "lobby";
      mood = "playing";
      held.clear();
    }
  }

  function drawLobby(now: number): void {
    const glow = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.8);
    glow.addColorStop(0, "#152232");
    glow.addColorStop(1, "#05080c");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#a6ff9b";
    ctx.font = "bold 64px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("THE SIMULATION", W / 2, 80);

    ctx.fillStyle = "rgba(230, 240, 255, 0.65)";
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText("HOW DO YOU WANT TO PLAY?", W / 2, 150);
    ctx.fillText("HOW BIG?", W / 2, 262);

    for (const button of lobbyButtons()) drawButton(ctx, button);

    ctx.fillStyle = "rgba(230, 240, 255, 0.45)";
    ctx.font = "15px 'Trebuchet MS', sans-serif";
    const explain =
      mode === "creative"
        ? "Creative: an empty map, nothing chasing you, and you place everything yourself."
        : mode === "boss"
          ? "Final boss: THE WHOLE. Throw shards with E, but they only hurt it while looking at it holds it still."
          : "Survival: collect every glitch fragment without getting caught.";
    ctx.fillText(explain, W / 2, 380);
    ctx.fillText("Gigantic is as big as a browser can take before it falls over.", W / 2, 520 + 12 * Math.sin(now / 900) * 0);
  }

  function drawPauseMenu(): void {
    ctx.fillStyle = "rgba(4, 8, 12, 0.85)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 58px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("PAUSED", W / 2, 150);
    for (const button of pauseButtons()) drawButton(ctx, button);
    ctx.fillStyle = "rgba(230, 240, 255, 0.5)";
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.fillText("P carries on as well", W / 2, H - 80);
  }

  // The glitch index: one card for every kind, but only the ones you've actually
  // seen say what they are.
  function drawIndex(now: number): void {
    ctx.fillStyle = "rgba(4, 8, 12, 0.9)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 46px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("GLITCH INDEX", W / 2, 48);
    ctx.fillStyle = "#a6ff9b";
    ctx.font = "bold 22px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText(`${seen.size} / ${GLITCH_KINDS.length} FOUND`, W / 2, 84);

    const cardWidth = (W - 80) / GLITCH_KINDS.length;
    GLITCH_KINDS.forEach((kind, column) => {
      const middleX = 40 + cardWidth * column + cardWidth / 2;
      const known = seen.has(kind);
      const info = GLITCH_INFO[kind];

      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(40 + cardWidth * column + 8, 110, cardWidth - 16, 380);

      paintGlitchPortrait(ctx, kind, middleX, 220, 140, now, !known);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = known ? "#f5efe6" : "#6d737d";
      ctx.font = "bold 26px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.fillText(known ? info.name : "???", middleX, 340);

      ctx.fillStyle = known ? "#b9c4d0" : "#5d626b";
      ctx.font = "15px 'Trebuchet MS', sans-serif";
      const bio = known ? info.bio : "You haven't seen this one yet.";
      wrapWords(bio, cardWidth - 44).forEach((line, line_row) => {
        ctx.fillText(line, middleX, 374 + line_row * 22);
      });
    });

    for (const button of indexButtons()) drawButton(ctx, button);
  }

  // Breaks a line of words up so it fits the width of a card.
  function wrapWords(text: string, width: number): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
      const tryLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(tryLine).width > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = tryLine;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCrosshair(): void {
    ctx.strokeStyle = "rgba(220, 255, 235, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 9, H / 2);
    ctx.lineTo(W / 2 + 9, H / 2);
    ctx.moveTo(W / 2, H / 2 - 9);
    ctx.lineTo(W / 2, H / 2 + 9);
    ctx.stroke();
  }

  function drawPalette(): void {
    const slotWidth = 104;
    const all = PALETTE.length * slotWidth;
    PALETTE.forEach((item, index) => {
      const x = W / 2 - all / 2 + index * slotWidth;
      const chosen = item.id === holding;
      ctx.fillStyle = chosen ? "rgba(166, 255, 155, 0.9)" : "rgba(10, 16, 22, 0.75)";
      ctx.fillRect(x + 3, H - 54, slotWidth - 6, 42);
      ctx.strokeStyle = chosen ? "#0a3d1c" : "rgba(220, 235, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, H - 54, slotWidth - 6, 42);
      ctx.fillStyle = chosen ? "#0a3d1c" : "#cfe0f2";
      ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${index + 1} ${item.label}`, x + slotWidth / 2, H - 33);
    });
  }

  function drawHud(): void {
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (mode === "survival") {
      ctx.fillStyle = "#a6ff9b";
      ctx.fillText(`FRAGMENTS ${player.fragments} / ${FRAGMENT_COUNT}`, 18, 16);
      ctx.fillStyle = "#7fc4ff";
      ctx.fillText(`BLUE BLOCKS ${player.blue}`, 18, 42);
    } else if (mode === "creative") {
      ctx.fillStyle = "#a6ff9b";
      ctx.fillText("CREATIVE — BUILD YOUR OWN MAP", 18, 16);
    } else {
      ctx.fillStyle = "#ff8a9c";
      ctx.fillText("THE WHOLE", 18, 16);
      ctx.fillStyle = "#cfe0f2";
      ctx.font = "15px 'Trebuchet MS', sans-serif";
      ctx.fillText("E throws a shard · they only bite while it's frozen", 18, 42);
      ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    }
    if (player.climbing) {
      ctx.fillStyle = "#ffe08a";
      ctx.fillText("ON A LADDER — THEY CAN'T FOLLOW", 18, 68);
    }

    // The moment you can see one, it says so.
    const watched = glitches.filter((glitch) => !glitch.hiding && canSee(glitch)).length;
    if (watched > 0 && mood === "playing" && mode === "survival") {
      ctx.font = "bold 44px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 60, 90, ${0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))})`;
      ctx.fillText("RUN", W / 2, 40);
    }

    ctx.font = "14px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(230, 240, 255, 0.55)";
    ctx.textAlign = "right";
    const keys =
      mode === "creative"
        ? "WASD move · drag or arrows to look · SPACE jump · 1-8 choose · E place · Q remove · P menu"
        : "WASD move · drag or arrows to look · SPACE jump · E pick up · P menu · ladders are safe";
    ctx.fillText(keys, W - 18, 18);

    if (mode === "creative") drawPalette();
    if (mode === "boss" && boss) drawBossBar();
  }

  function drawBossBar(): void {
    if (!boss) return;
    const width = 420;
    const left = W / 2 - width / 2;
    ctx.fillStyle = "rgba(6, 10, 14, 0.75)";
    ctx.fillRect(left - 8, 16, width + 16, 54);

    for (let pip = 0; pip < BOSS_HEALTH; pip += 1) {
      const pipWidth = width / BOSS_HEALTH - 8;
      ctx.fillStyle = pip < boss.health ? "#ff3c5a" : "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(left + pip * (pipWidth + 8), 24, pipWidth, 16);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 20px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillStyle = boss.frozen ? "#a6ff9b" : "#ffd27f";
    ctx.fillText(boss.frozen ? "IT CAN'T MOVE — THROW (E)" : PHASE_NAMES[boss.phase], W / 2, 56);
  }

  // Beating it.
  function drawWon(now: number): void {
    const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    glow.addColorStop(0, "#10331f");
    glow.addColorStop(1, "#04070a");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // The crystal, in pieces again, drifting apart.
    for (let shard = 0; shard < 14; shard += 1) {
      const turn = (shard / 14) * Math.PI * 2;
      const drift = 120 + Math.sin(now / 700 + shard) * 20;
      const x = W / 2 + Math.cos(turn) * drift;
      const y = H / 2 - 60 + Math.sin(turn) * drift * 0.6;
      ctx.fillStyle = "#a6ff9b";
      ctx.shadowColor = "#6dff9c";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 14);
      ctx.lineTo(x - 8, y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#a6ff9b";
    ctx.font = "bold 58px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("YOU BEAT THE SIMULATION", W / 2, H - 200);
    ctx.fillStyle = "#f5efe6";
    ctx.font = "22px 'Trebuchet MS', sans-serif";
    ctx.fillText("THE WHOLE is in pieces again. The blocks stop humming.", W / 2, H - 155);
    for (const button of menuButtons()) drawButton(ctx, button);
  }

  // The jump scare: the screen tears itself apart and something is right in your face.
  function drawScare(now: number): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const shake = Math.sin(now / 17) * 12;
    for (let band = 0; band < 26; band += 1) {
      const y = (band / 26) * H;
      ctx.fillStyle = band % 2 === 0 ? "#ff1f4f" : "#12ffd4";
      ctx.globalAlpha = 0.12 + 0.2 * Math.abs(Math.sin(now / 40 + band));
      ctx.fillRect(Math.sin(now / 30 + band) * 30, y, W, H / 26 / 2);
    }
    ctx.globalAlpha = 1;

    // A face, of sorts.
    ctx.fillStyle = "#0a0a0f";
    ctx.beginPath();
    ctx.ellipse(W / 2 + shake, H / 2 - 40, W * 0.26, H * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff2f5f";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(W / 2 + shake + side * W * 0.1, H / 2 - H * 0.12, W * 0.042, H * 0.028, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#ff2f5f";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(W / 2 + shake - W * 0.12, H / 2 + H * 0.1);
    for (let tooth = 0; tooth <= 8; tooth += 1) {
      ctx.lineTo(W / 2 + shake - W * 0.12 + (tooth / 8) * W * 0.24, H / 2 + H * 0.1 + (tooth % 2 === 0 ? 0 : 26));
    }
    ctx.stroke();

    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 44px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("THE SIMULATION CRASHED", W / 2, H - 170);
    for (const button of crashedButtons()) drawButton(ctx, button);
  }

  // All the fragments flying together into one thing.
  function drawForge(now: number): void {
    const since = now - forgeAt;
    const flyingIn = Math.min(1, since / FORGE_FLY_MS);
    const settled = Math.max(0, (since - FORGE_FLY_MS - FORGE_FLASH_MS) / 900);

    const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    glow.addColorStop(0, "#12331f");
    glow.addColorStop(1, "#04070a");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    if (flyingIn < 1) {
      const pulled = 1 - (1 - flyingIn) ** 3;
      for (let shard = 0; shard < FRAGMENT_COUNT; shard += 1) {
        const turn = (shard / FRAGMENT_COUNT) * Math.PI * 2 + pulled * 5;
        const away = (1 - pulled) * (260 + (shard % 5) * 60);
        const x = W / 2 + Math.cos(turn) * away;
        const y = H / 2 + Math.sin(turn) * away * 0.7;
        const size = 26 - 10 * pulled;
        ctx.globalAlpha = 0.5 + 0.5 * pulled;
        ctx.shadowColor = "#6dff9c";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#a6ff9b";
        ctx.beginPath();
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 3, y);
        ctx.lineTo(x, y + size / 2);
        ctx.lineTo(x - size / 3, y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    const flash = 1 - Math.min(1, Math.max(0, since - FORGE_FLY_MS) / FORGE_FLASH_MS);
    if (flyingIn >= 1 && flash > 0) {
      ctx.fillStyle = `rgba(230, 255, 240, ${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (settled > 0) {
      const size = 120 * Math.min(1, settled) * (1 + 0.04 * Math.sin(now / 220));
      ctx.save();
      ctx.translate(W / 2, H / 2 - 40);
      ctx.rotate(Math.sin(now / 900) * 0.08);
      ctx.shadowColor = "#7dff9c";
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#d8ffd0";
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.62, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.62, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0a3d1c";
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = "rgba(10, 61, 28, 0.6)";
      ctx.lineWidth = 3;
      for (let crack = 0; crack < 6; crack += 1) {
        const turn = (crack / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(turn) * size * 0.6, Math.sin(turn) * size * 0.9);
        ctx.stroke();
      }
      ctx.restore();
      ctx.shadowBlur = 0;

      ctx.globalAlpha = Math.min(1, settled);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#a6ff9b";
      ctx.font = "bold 54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.fillText("THE FRAGMENTS ARE WHOLE", W / 2, H - 150);
      ctx.fillStyle = "#f5efe6";
      ctx.font = "22px 'Trebuchet MS', sans-serif";
      ctx.fillText("Whatever they were part of knows you put them back together.", W / 2, H - 105);
      ctx.globalAlpha = 1;
      for (const button of menuButtons()) drawButton(ctx, button);
    }
  }

  function draw(now: number): void {
    if (screen === "lobby") {
      drawLobby(now);
      return;
    }
    if (mood === "crashed") {
      drawScare(now);
      return;
    }
    if (mood === "forging") {
      drawForge(now);
      return;
    }
    if (mood === "won") {
      drawWon(now);
      return;
    }

    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    renderWorld(ctx, W, H, arena.world, player, sprites(), now);
    drawCrosshair();
    drawHud();

    if (mood === "paused") {
      drawPauseMenu();
      return;
    }
    if (mood === "index") {
      drawIndex(now);
      return;
    }

    if (mood === "caught") {
      // Everything goes wrong at once.
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.75, (now - caughtAt) / SCARE_AFTER_MS)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255, 30, 70, ${0.12 + 0.12 * Math.sin(now / 40)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    update,
    draw,
    peek: () => ({ player, glitches, fragments, fragmentsLeft: fragments.length, mood, screen, mode, boss }),
    hold(key, down) {
      const name = key.toLowerCase();
      if (down) held.add(name);
      else held.delete(name);
    },
    look(byX, byY) {
      if (screen !== "world" || mood !== "playing") return;
      // Moving the mouse right turns you right.
      player.yaw += byX * 0.0022;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - byY * 0.0022));
    },
    use,
    remove,
    pick(slot) {
      const item = PALETTE[slot - 1];
      if (item) holding = item.id;
    },
    togglePause() {
      if (screen !== "world") return;
      if (mood === "playing") mood = "paused";
      else if (mood === "paused" || mood === "index") mood = "playing";
      // Keys held down while paused shouldn't still be held when you come back.
      held.clear();
    },
    isMenu: () =>
      screen === "lobby" || mood === "paused" || mood === "index" || mood === "crashed" || mood === "forging" || mood === "won",
    click,
    isCrashed: () => mood === "crashed" || mood === "forging" || mood === "won",
    restart,
  };
}
