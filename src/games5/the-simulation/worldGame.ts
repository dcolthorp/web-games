// The Simulation itself, once you press START: a block world you're boxed into,
// with glitch fragments to collect, blue blocks to pick up, and glitches that
// chase you. Ladders are the only place they can't follow.

import { GLITCH_INFO, GLITCH_KINDS, hasCaught, newGlitch, updateGlitch, type Glitch, type GlitchKind } from "./glitches";
import { EYE, newPlayer, updatePlayer, type Input, type Player } from "./player";
import { SKY, paintGlitchPortrait, renderWorld, type Sprite } from "./render3d";
import {
  ARENA_SIZE,
  BLACK,
  BLUE,
  EMPTY,
  FRAGMENT_COUNT,
  blockAt,
  isSolid,
  lineOfSight,
  makeArena,
  setBlock,
  type Arena,
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

export interface WorldSounds {
  fragment(): void;
  block(): void;
  scare(): void;
}

type Mood = "playing" | "paused" | "caught" | "crashed";

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

interface FallingBlock {
  x: number;
  y: number;
  z: number;
  blackAt: number;
}

export interface WorldGame {
  update(now: number, dt: number): void;
  togglePause(): void;
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
  const seen = loadSeen();

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
      glitches.push(newGlitch(spot, GLITCH_KINDS[i] ?? "stalker"));
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

  // Are you looking right at it? A stopframe only moves when you are not looking, and a
  // glitch you can see is a glitch to run from.
  function canSee(glitch: Glitch): boolean {
    const eye = { x: player.x, y: player.y + EYE, z: player.z };
    const middle = { x: glitch.x, y: glitch.y + 0.95, z: glitch.z };
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

  function rememberGlitch(kind: GlitchKind): void {
    if (seen.has(kind)) return;
    seen.add(kind);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    } catch {
      // Then the index forgets when you close the game.
    }
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
    if (mood === "crashed" || mood === "paused") return;

    if (mood === "playing") {
      if (startedAt === 0) startedAt = now;
      lookWithArrows(dt);
      updatePlayer(arena.world, player, input(), dt);
      collectFragments();
      // Seeing one is what puts it in the index, even while they're still holding still.
      const watching = glitches.map((glitch) => {
        const watched = canSee(glitch);
        if (watched && !glitch.hiding) rememberGlitch(glitch.kind);
        return watched;
      });

      // They hold still at first, so you get a look at the place before the running starts.
      if (now - startedAt < HEAD_START_MS) return;
      for (const [index, glitch] of glitches.entries()) {
        const watched = watching[index] ?? false;
        updateGlitch(arena.world, glitch, player, dt, now, watched);
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
    player.yaw += turn * LOOK_SPEED * dt;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - tilt * LOOK_SPEED * dt));
  }

  function sprites(): Sprite[] {
    const all: Sprite[] = fragments.map((fragment) => ({ ...fragment, kind: "fragment" as const, size: 0.45 }));
    for (const glitch of glitches) {
      // A mimic in hiding looks exactly like a fragment, which is the whole trick.
      if (glitch.hiding) {
        all.push({ x: glitch.x, y: glitch.y + 0.7, z: glitch.z, kind: "fragment" as const, size: 0.45 });
        continue;
      }
      all.push({ x: glitch.x, y: glitch.y + 0.95, z: glitch.z, kind: glitch.kind, size: 1.9 });
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

    // The moment you can see one, it says so.
    const watched = glitches.filter((glitch) => !glitch.hiding && canSee(glitch)).length;
    if (watched > 0 && mood === "playing") {
      ctx.font = "bold 44px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 60, 90, ${0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 180))})`;
      ctx.fillText("RUN", W / 2, 40);
    }

    ctx.font = "14px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(230, 240, 255, 0.55)";
    ctx.textAlign = "right";
    ctx.fillText("WASD move · drag or arrows to look · SPACE jump · E pick up · P pause · ladders are safe", W - 18, 18);
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

  // The glitch index: one card for every kind, but only the ones you've actually
  // seen say what they are.
  function drawIndex(now: number): void {
    ctx.fillStyle = "rgba(4, 8, 12, 0.88)";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 52px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("PAUSED", W / 2, 58);
    ctx.fillStyle = "#a6ff9b";
    ctx.font = "bold 26px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText(`GLITCH INDEX — ${seen.size} / ${GLITCH_KINDS.length} FOUND`, W / 2, 100);

    const cardWidth = (W - 80) / GLITCH_KINDS.length;
    GLITCH_KINDS.forEach((kind, column) => {
      const middleX = 40 + cardWidth * column + cardWidth / 2;
      const known = seen.has(kind);
      const info = GLITCH_INFO[kind];

      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(40 + cardWidth * column + 8, 130, cardWidth - 16, 400);

      paintGlitchPortrait(ctx, kind, middleX, 250, 150, now, !known);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = known ? "#f5efe6" : "#6d737d";
      ctx.font = "bold 28px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.fillText(known ? info.name : "???", middleX, 370);

      ctx.fillStyle = known ? "#b9c4d0" : "#5d626b";
      ctx.font = "15px 'Trebuchet MS', sans-serif";
      const bio = known ? info.bio : "You haven't seen this one yet.";
      wrapWords(bio, cardWidth - 44).forEach((line, row) => {
        ctx.fillText(line, middleX, 404 + row * 22);
      });
    });

    ctx.fillStyle = "rgba(230, 240, 255, 0.6)";
    ctx.font = "18px 'Trebuchet MS', sans-serif";
    ctx.fillText("Press P to carry on", W / 2, H - 40);
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

    if (mood === "paused") {
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
    peek: () => ({ player, glitches, fragmentsLeft: fragments.length, mood }),
    hold(key, down) {
      const name = key.toLowerCase();
      if (down) held.add(name);
      else held.delete(name);
    },
    look(byX, byY) {
      if (mood !== "playing") return;
      // Moving the mouse right turns you right.
      player.yaw += byX * 0.0022;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - byY * 0.0022));
    },
    use,
    isCrashed: () => mood === "crashed",
    togglePause() {
      if (mood === "playing") mood = "paused";
      else if (mood === "paused") mood = "playing";
      // Keys held down while paused shouldn't still be held when you come back.
      held.clear();
    },
    restart,
  };
}
