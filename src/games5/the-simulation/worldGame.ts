// The Simulation itself, once you press START: a block world you're boxed into,
// with glitch fragments to collect, blue blocks to pick up, and glitches that
// chase you. Ladders are the only place they can't follow.

import { hasCaught, newGlitch, updateGlitch, type Glitch } from "./glitches";
import { EYE, newPlayer, updatePlayer, type Input, type Player } from "./player";
import { SKY, renderWorld, type Sprite } from "./render3d";
import {
  ARENA_SIZE,
  BLACK,
  BLUE,
  EMPTY,
  FRAGMENT_COUNT,
  blockAt,
  isSolid,
  makeArena,
  setBlock,
  type Arena,
  type Spot,
} from "./world";

const BLACKEN_EVERY_MS = 55;
const FALL_AWAY_MS = 260;
const SCARE_AFTER_MS = 1100;
const GLITCH_COUNT = 3;
// How long you get before they start moving, and how fast they are once they do
// (you walk at 4.6, so you can always outrun them in a straight line).
const HEAD_START_MS = 7000;
const GLITCH_SPEED = 2.6;
const FRAGMENT_REACH = 1.3;
// How fast the arrow keys turn you, for looking around without a mouse.
const LOOK_SPEED = 2.1;
const REACH = 4.2;

export interface WorldSounds {
  fragment(): void;
  block(): void;
  scare(): void;
}

type Mood = "playing" | "caught" | "crashed";

interface FallingBlock {
  x: number;
  y: number;
  z: number;
  blackAt: number;
}

export interface WorldGame {
  update(now: number, dt: number): void;
  // Where you are and what's around you, for checking the game from the outside.
  peek(): { player: Player; glitches: Glitch[]; fragmentsLeft: number; mood: string };
  draw(now: number): void;
  hold(key: string, down: boolean): void;
  look(byX: number, byY: number): void;
  use(): void;
  isCrashed(): boolean;
  restart(): void;
}

export function createWorldGame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  sounds: WorldSounds
): WorldGame {
  let arena: Arena = makeArena();
  let player: Player = newPlayer(arena.spawn);
  let fragments: Spot[] = [...arena.fragments];
  let glitches: Glitch[] = [];
  let mood: Mood = "playing";
  let caughtAt = 0;
  let startedAt = 0;
  let blackened: FallingBlock[] = [];
  let lastBlackenAt = 0;
  const held = new Set<string>();

  function spawnGlitches(): void {
    glitches = [];
    for (let i = 0; i < GLITCH_COUNT; i += 1) {
      const corner = (i * Math.PI * 2) / GLITCH_COUNT;
      const away = ARENA_SIZE * 0.42;
      const spot = {
        x: player.x + Math.sin(corner) * away,
        y: 1,
        z: player.z + Math.cos(corner) * away,
      };
      glitches.push(newGlitch(spot, GLITCH_SPEED + i * 0.2));
    }
  }

  function restart(): void {
    arena = makeArena();
    player = newPlayer(arena.spawn);
    fragments = [...arena.fragments];
    blackened = [];
    mood = "playing";
    startedAt = 0;
    held.clear();
    spawnGlitches();
  }

  spawnGlitches();

  function input(): Input {
    const down = (...keys: string[]): boolean => keys.some((key) => held.has(key));
    return {
      forward: Number(down("w")) - Number(down("s")),
      strafe: Number(down("d")) - Number(down("a")),
      up: down(" ", "space"),
      down: down("shift"),
    };
  }

  // What you're looking at, up to arm's reach: the block, and the empty spot in
  // front of it where a block would go.
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

  // Pick a blue block up, or put one down.
  function use(): void {
    if (mood !== "playing") return;
    const { at, before } = lookingAt();
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

  function collectFragments(): void {
    fragments = fragments.filter((fragment) => {
      const near =
        Math.hypot(fragment.x - player.x, fragment.y - (player.y + EYE * 0.6), fragment.z - player.z) < FRAGMENT_REACH;
      if (!near) return true;
      player.fragments += 1;
      sounds.fragment();
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

  function update(now: number, dt: number): void {
    if (mood === "crashed") return;

    if (mood === "playing") {
      if (startedAt === 0) startedAt = now;
      lookWithArrows(dt);
      updatePlayer(arena.world, player, input(), dt);
      collectFragments();
      // They hold still at first, so you get a look at the place before the running starts.
      if (now - startedAt < HEAD_START_MS) return;
      for (const glitch of glitches) {
        updateGlitch(arena.world, glitch, player, dt);
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

  // Looking around with the arrow keys, for when the mouse can't be used.
  function lookWithArrows(dt: number): void {
    const turn = Number(held.has("arrowright")) - Number(held.has("arrowleft"));
    const tilt = Number(held.has("arrowdown")) - Number(held.has("arrowup"));
    if (turn === 0 && tilt === 0) return;
    player.yaw -= turn * LOOK_SPEED * dt;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - tilt * LOOK_SPEED * dt));
  }

  function sprites(): Sprite[] {
    const all: Sprite[] = fragments.map((fragment) => ({ ...fragment, kind: "fragment" as const, size: 0.45 }));
    for (const glitch of glitches) {
      all.push({ x: glitch.x, y: glitch.y + 0.95, z: glitch.z, kind: "glitch" as const, size: 1.9 });
    }
    return all;
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

  function drawHud(): void {
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#a6ff9b";
    ctx.fillText(`FRAGMENTS ${player.fragments} / ${FRAGMENT_COUNT}`, 18, 16);
    ctx.fillStyle = "#7fc4ff";
    ctx.fillText(`BLUE BLOCKS ${player.blue}`, 18, 42);
    if (player.climbing) {
      ctx.fillStyle = "#ffe08a";
      ctx.fillText("ON A LADDER — THEY CAN'T FOLLOW", 18, 68);
    }

    ctx.font = "14px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(230, 240, 255, 0.55)";
    ctx.textAlign = "right";
    ctx.fillText("WASD move · drag or arrows to look · SPACE jump · E pick up · ladders are safe", W - 18, 18);
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
    ctx.ellipse(W / 2 + shake, H / 2, W * 0.28, H * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff2f5f";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(W / 2 + shake + side * W * 0.11, H / 2 - H * 0.08, W * 0.045, H * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#ff2f5f";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(W / 2 + shake - W * 0.12, H / 2 + H * 0.14);
    for (let tooth = 0; tooth <= 8; tooth += 1) {
      ctx.lineTo(W / 2 + shake - W * 0.12 + (tooth / 8) * W * 0.24, H / 2 + H * 0.14 + (tooth % 2 === 0 ? 0 : 26));
    }
    ctx.stroke();

    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 46px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("THE SIMULATION CRASHED", W / 2, H - 120);
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText("Click to wake up", W / 2, H - 72);
  }

  function draw(now: number): void {
    if (mood === "crashed") {
      drawScare(now);
      return;
    }

    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    renderWorld(ctx, W, H, arena.world, player, sprites(), now);
    drawCrosshair();
    drawHud();

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
    peek: () => ({ player, glitches, fragmentsLeft: fragments.length, mood }),
    hold(key, down) {
      const name = key.toLowerCase();
      if (down) held.add(name);
      else held.delete(name);
    },
    look(byX, byY) {
      if (mood !== "playing") return;
      player.yaw -= byX * 0.0022;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - byY * 0.0022));
    },
    use,
    isCrashed: () => mood === "crashed",
    restart,
  };
}
