import {
  H,
  W,
  clamp,
  ctx,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawVignette,
  lerp,
  updateDust,
  type Dust,
  type Point,
  type Room,
} from "../zero-logic-escape-rooms/engine";
import { sounds } from "../zero-logic-escape-rooms/sound";
import {
  GARBLE,
  VIRUS_PUNCHES,
  crackAt,
  extraCrack,
  makeCracks,
  punchCrack,
  virusReach,
  worldIsGone,
  type Crack,
} from "./punch";

// Escape Room 3: .EXE. Cracks all over the walls, a pair of boxing gloves in
// the middle of the floor, and something in the corner that is not part of the
// room. Punch a crack and it gets smaller until it's gone, which feels like
// progress and is not. Punch the thing in the corner and it gets bigger, and
// bigger, and then there is no room left to be stuck in.

const PALETTE = {
  ceiling: "#1d2420",
  side: "#28322c",
  wallTop: "#37433b",
  wallBottom: "#2a342e",
  floorBack: "#222b26",
  floorFront: "#333f38",
  skirting: "#1a221d",
  floor: "concrete",
} as const;

// The corner it lives in: the bottom left one, where the wall meets the floor.
const VIRUS_HOME = { x: 120, y: 330 };
const GLOVES: Point = { x: W / 2, y: 470 };
const GLOVE_GRAB = 70;

const RAIN_CHARS = "アカサタナハマヤラワ0123456789<>[]{}/\\|=+*#%&".split("");
const GARBLE_CHARS = GARBLE.replace(/!/g, "").split("");

function pickGlyph(alphabet: string[]): string {
  return alphabet[Math.floor(Math.random() * alphabet.length)] ?? "0";
}

// One falling column of characters, the way this sort of thing always looks.
interface Drop {
  x: number;
  y: number;
  speed: number;
  glyphs: string[];
}

const COLUMN_GAP = 17;
const TRAIL = 9;

interface Hit {
  x: number;
  y: number;
  at: number;
  bad: boolean;
}

type Stage = "barehanded" | "gloved" | "engulfing" | "escaped";

export function createExeRoom(onEscaped: () => void): Room {
  let cracks: Crack[] = makeCracks();
  let nextCrackId = 100;
  let virus = 0;
  let stage: Stage = "barehanded";
  let startAt = 0;
  let stageAt = 0;
  let dust: Dust[] = [];
  let hits: Hit[] = [];
  let drops: Drop[] = [];
  let shake = 0;
  let swing = 0;
  let pointer: Point = { x: W / 2, y: H / 2 };
  let note = "";
  let noteAt = 0;

  function say(text: string, now: number): void {
    note = text;
    noteAt = now;
  }

  function makeRain(): void {
    drops = [];
    for (let x = COLUMN_GAP / 2; x < W; x += COLUMN_GAP) {
      drops.push({
        x,
        y: Math.random() * H,
        speed: 120 + Math.random() * 300,
        glyphs: Array.from({ length: TRAIL }, () => pickGlyph(RAIN_CHARS)),
      });
    }
  }

  function puff(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      dust.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 320,
        vy: -Math.random() * 260,
        life: 0.4 + Math.random() * 0.5,
      });
    }
  }

  // How far across the room the corner has got, in pixels.
  function virusRadius(): number {
    return lerp(120, 1250, virusReach(virus) ** 0.85);
  }

  function onVirus(p: Point): boolean {
    return Math.hypot(p.x - VIRUS_HOME.x, p.y - VIRUS_HOME.y) < virusRadius() * 0.92;
  }

  function punchVirus(now: number): void {
    virus += 1;
    shake = 1;
    sounds.crack();
    sounds.womp();
    hits.push({ x: pointer.x, y: pointer.y, at: now, bad: true });
    // Hitting it doesn't mend anything. It breaks the wall somewhere else.
    const extra = extraCrack(virus - 1, nextCrackId);
    if (extra) {
      cracks = [...cracks, extra];
      nextCrackId += 1;
    }
    say(
      worldIsGone(virus)
        ? "OH NO"
        : ["It got bigger.", "It got bigger again.", "Stop punching it.", "IT LIKES THIS", "IT IS ALMOST EVERYTHING"][
            Math.min(virus - 1, 4)
          ] ?? "",
      now
    );
    if (worldIsGone(virus)) {
      stage = "engulfing";
      stageAt = now;
      sounds.crash();
    }
  }

  return {
    name: ".EXE",
    exitLine: "The room got eaten by whatever was in the corner. You went with it.",

    reset(at) {
      cracks = makeCracks();
      nextCrackId = 100;
      virus = 0;
      stage = "barehanded";
      startAt = at;
      stageAt = at;
      dust = [];
      hits = [];
      shake = 0;
      swing = 0;
      note = "";
      makeRain();
    },

    update(now, dt) {
      dust = updateDust(dust, dt);
      hits = hits.filter((hit) => now - hit.at < 400);
      shake = Math.max(0, shake - dt * 2);
      swing = Math.max(0, swing - dt * 5);

      const speedUp = stage === "engulfing" ? 4 : 1;
      // Once it has really got going, the rain starts coming down in whatever
      // language the ending is written in.
      const alphabet = virus >= 3 ? [...RAIN_CHARS, ...GARBLE_CHARS] : RAIN_CHARS;
      for (const drop of drops) {
        drop.y += drop.speed * dt * speedUp;
        if (drop.y > H + TRAIL * 18) {
          drop.y = -Math.random() * 200;
          drop.speed = 120 + Math.random() * 300;
        }
        // Characters flicker on the spot as they fall.
        if (Math.random() < dt * 14) {
          drop.glyphs[Math.floor(Math.random() * TRAIL)] = pickGlyph(alphabet);
        }
      }

      if (stage === "engulfing" && now - stageAt > 2600) {
        stage = "escaped";
        onEscaped();
      }
    },

    draw(now) {
      const secondsIn = (now - startAt) / 1000;

      ctx.save();
      if (shake > 0) {
        ctx.translate(Math.sin(now / 18) * shake * 9, Math.cos(now / 14) * shake * 7);
      }

      drawRoomBox(PALETTE);
      for (const crack of cracks) drawCrack(crack);
      if (stage === "barehanded") drawGloves();
      drawVirus(now);
      ctx.restore();

      drawDust(dust, "rgba(180, 190, 180, 0.8)");
      drawHits(now);
      drawVignette();
      if (stage === "engulfing") drawTheEnd(now);
      if (stage === "gloved" || stage === "barehanded") drawFists(now);
      drawNote(now);

      if (stage === "barehanded") {
        drawCaption("Something is wrong with that corner.", secondsIn);
      }
    },

    pointerDown(p) {
      pointer = p;
      const now = performance.now();
      if (stage === "engulfing" || stage === "escaped") return;

      if (stage === "barehanded") {
        if (Math.hypot(p.x - GLOVES.x, p.y - GLOVES.y) < GLOVE_GRAB) {
          stage = "gloved";
          sounds.grab();
          say("Gloves on. Now you can hit things.", now);
          return;
        }
        sounds.tap();
        say("You can't punch anything with your bare hands.", now);
        return;
      }

      swing = 1;
      if (onVirus(p)) {
        punchVirus(now);
        return;
      }

      const crack = crackAt(cracks, p.x, p.y);
      if (crack) {
        cracks = punchCrack(cracks, crack.id);
        sounds.thunk();
        puff(p.x, p.y, 14);
        shake = 0.4;
        hits.push({ x: p.x, y: p.y, at: now, bad: false });
        const gone = !cracks.some((other) => other.id === crack.id);
        say(gone ? "Crack gone. Wall fixed. Still stuck." : "The crack got smaller.", now);
        return;
      }

      sounds.bonk();
      puff(p.x, p.y, 5);
      hits.push({ x: p.x, y: p.y, at: now, bad: false });
    },

    pointerMove(p) {
      pointer = p;
    },

    pointerUp() {},

    cursor() {
      // With the gloves on, your hands are drawn in the room instead.
      return stage === "gloved" ? "none" : "pointer";
    },
  };

  // ---------- drawing ----------

  function crackPoints(crack: Crack): Point[] {
    const points: Point[] = [];
    const steps = 7;
    const length = crack.length * crack.size;
    for (let i = 0; i <= steps; i += 1) {
      const along = (length * i) / steps;
      // Same wobble every time, so a crack keeps its shape as it shrinks.
      const wobble = Math.sin(i * 2.3 + crack.id) * 9 * crack.size;
      points.push({
        x: crack.x + Math.cos(crack.angle) * along + Math.cos(crack.angle + 1.57) * wobble,
        y: crack.y + Math.sin(crack.angle) * along + Math.sin(crack.angle + 1.57) * wobble,
      });
    }
    return points;
  }

  function drawCrack(crack: Crack): void {
    const points = crackPoints(crack);
    ctx.strokeStyle = "rgba(10, 14, 12, 0.85)";
    ctx.lineWidth = 1 + crack.size * 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)));
    ctx.stroke();
    // A pale edge on one side, like plaster that has lifted.
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * crack.size})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach((point, index) =>
      index === 0 ? ctx.moveTo(point.x + 2, point.y + 2) : ctx.lineTo(point.x + 2, point.y + 2)
    );
    ctx.stroke();
  }

  function drawGloves(): void {
    for (const side of [-1, 1]) {
      const x = GLOVES.x + side * 40;
      ctx.save();
      ctx.translate(x, GLOVES.y);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 26, 40, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // A left glove is a right glove the other way round, cuff and thumb
      // included, so the left one is drawn mirrored.
      ctx.scale(side, 1);
      ctx.rotate(0.25);
      drawGlove(0, 0, 1);
      ctx.restore();
    }
  }

  // One boxing glove, drawn around its middle.
  function drawGlove(x: number, y: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#c22e2e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a02222";
    ctx.beginPath();
    ctx.ellipse(-22, 6, 14, 16, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e2d4";
    ctx.fillRect(24, -14, 16, 28);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.ellipse(-6, -12, 16, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Your hands, once you're wearing them: two gloves either side of the
  // pointer that jab forward when you swing.
  function drawFists(now: number): void {
    if (stage !== "gloved") return;
    const lunge = swing * 26;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(pointer.x + side * (44 - lunge), pointer.y + 34 - lunge * 0.4);
      ctx.scale(side, 1);
      ctx.rotate(0.5 - swing * 0.35 + Math.sin(now / 500) * 0.04);
      drawGlove(0, 0, 0.9);
      ctx.restore();
    }
  }

  function drawHits(now: number): void {
    for (const hit of hits) {
      const t = (now - hit.at) / 400;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = hit.bad ? "#7dff8f" : "#fff3c4";
      ctx.lineWidth = 4 - t * 3;
      const reach = lerp(10, 52, t);
      for (let spoke = 0; spoke < 8; spoke += 1) {
        const angle = (spoke / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(hit.x + Math.cos(angle) * reach * 0.4, hit.y + Math.sin(angle) * reach * 0.4);
        ctx.lineTo(hit.x + Math.cos(angle) * reach, hit.y + Math.sin(angle) * reach);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // The thing in the corner. It is made of the screen, not of the room.
  function drawVirus(now: number): void {
    if (stage === "engulfing") return;
    const radius = virusRadius();

    ctx.save();
    ctx.beginPath();
    ctx.arc(VIRUS_HOME.x, VIRUS_HOME.y, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = "#04120a";
    ctx.fillRect(0, 0, W, H);
    drawRain(1);

    // Glitch bands, sliding about.
    for (let band = 0; band < 5; band += 1) {
      const y = (now / (4 + band) + band * 130) % H;
      ctx.fillStyle = band % 2 === 0 ? "rgba(125, 255, 143, 0.16)" : "rgba(255, 60, 120, 0.12)";
      ctx.fillRect(0, y, W, 6 + band * 3);
    }
    ctx.restore();

    // A ragged edge, because it isn't a neat circle, it's a spreading fault.
    ctx.strokeStyle = "#7dff8f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let step = 0; step <= 48; step += 1) {
      const angle = (step / 48) * Math.PI * 2;
      const jitter = 1 + Math.sin(step * 3 + now / 120) * 0.035;
      const x = VIRUS_HOME.x + Math.cos(angle) * radius * jitter;
      const y = VIRUS_HOME.y + Math.sin(angle) * radius * jitter;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawRain(alpha: number): void {
    ctx.font = "16px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const drop of drops) {
      for (let step = 0; step < TRAIL; step += 1) {
        const glyph = drop.glyphs[step];
        if (!glyph) continue;
        // The head of the column is almost white, the tail fades into the dark.
        ctx.globalAlpha = alpha * (step === 0 ? 1 : Math.max(0, 0.75 - step * 0.09));
        ctx.fillStyle = step === 0 ? "#dcffe4" : "#5ce06f";
        ctx.fillText(glyph, drop.x, drop.y - step * 18);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Everything, all at once, and then the noise it makes.
  function drawTheEnd(now: number): void {
    const t = (now - stageAt) / 2600;
    ctx.fillStyle = "#04120a";
    ctx.fillRect(0, 0, W, H);
    drawRain(1);

    for (let band = 0; band < 14; band += 1) {
      const y = (now / 2 + band * 91) % H;
      ctx.fillStyle = band % 3 === 0 ? "rgba(255, 60, 120, 0.25)" : "rgba(125, 255, 143, 0.2)";
      ctx.fillRect(0, y, W, 4 + (band % 5) * 7);
    }

    // The room's own letters, coming apart.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 20px 'Courier New', monospace";
    for (let row = 0; row < 9; row += 1) {
      const y = 70 + row * 58 + Math.sin(now / 180 + row) * 6;
      const shift = Math.sin(now / 90 + row * 2) * 40;
      const cut = Math.floor((now / 40 + row * 9) % GARBLE.length);
      const text = GARBLE.slice(cut) + GARBLE.slice(0, cut);
      ctx.fillStyle = row % 2 === 0 ? "#7dff8f" : "rgba(255, 60, 120, 0.8)";
      ctx.fillText(text, W / 2 + shift, y);
    }

    ctx.font = `bold ${clamp(40 + t * 90, 40, 130)}px Impact, 'Arial Narrow Bold', sans-serif`;
    ctx.fillStyle = "#04120a";
    ctx.fillText(".EXE", W / 2 + 4, H / 2 + 4);
    ctx.fillStyle = "#e8fff0";
    ctx.fillText(".EXE", W / 2, H / 2);

    // Right at the end it stops being letters at all.
    if (t > 0.72) {
      ctx.globalAlpha = (t - 0.72) / 0.28;
      ctx.fillStyle = "#c8ffd6";
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  function drawNote(now: number): void {
    if (!note || now - noteAt > 2600) return;
    const fade = clamp((2600 - (now - noteAt)) / 400, 0, 1);
    ctx.globalAlpha = fade;
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(note).width + 44;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(W / 2 - width / 2, H - 78, width, 40);
    ctx.fillStyle = virus > 0 ? "#7dff8f" : "#f5efe6";
    ctx.fillText(note, W / 2, H - 58);
    ctx.globalAlpha = 1;
  }

}
