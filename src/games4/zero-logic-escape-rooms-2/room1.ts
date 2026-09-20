import {
  BACK,
  H,
  W,
  ctx,
  clamp,
  diveInto,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawVignette,
  inRect,
  lerp,
  roundRect,
  updateDust,
  type Dust,
  type Point,
  type Room,
} from "../zero-logic-escape-rooms/engine";
import { sounds } from "../zero-logic-escape-rooms/sound";
import { WANTED, frameIsRight, nextWord, phraseSolved, readPhrase, type Word } from "./phrase";

// Escape Room 1: Blank, Blank, Blankity Blank. Four empty frames on the wall
// and a line underneath with four holes in it. Click a frame and it stamps
// itself BLANK, click it again and it stretches to BLANKITY, click once more
// and it goes empty. Get the line to read the way the room is named and the
// room takes itself away, one thing at a time, until there's nothing left to
// be inside of.

const PALETTE = {
  ceiling: "#d7d2c8",
  side: "#e4e0d7",
  wallTop: "#f2efe8",
  wallBottom: "#e6e2d9",
  floorBack: "#cfc8ba",
  floorFront: "#e0d9cb",
  skirting: "#c5bfb2",
  floor: "boards",
} as const;

const FRAME = { top: 120, w: 130, h: 150, gap: 28 };
const FRAME_LEFT = (BACK.left + BACK.right) / 2 - (FRAME.w * 4 + FRAME.gap * 3) / 2;
const STRIP = { x: BACK.left + 60, y: 320, w: BACK.right - BACK.left - 120, h: 46 };

function frameBox(index: number): { x: number; y: number; w: number; h: number } {
  return {
    x: FRAME_LEFT + index * (FRAME.w + FRAME.gap),
    y: FRAME.top,
    w: FRAME.w,
    h: FRAME.h,
  };
}

// The four things in the room that aren't the room. One goes blank per frame.
type ThingId = "rug" | "lamp" | "shelf" | "plant";
const THINGS: ThingId[] = ["rug", "lamp", "shelf", "plant"];

type Stage = "filling" | "blanking" | "leaving" | "escaped";

export function createBlankRoom(onEscaped: () => void): Room {
  let words: Word[] = ["", "", "", ""];
  let stage: Stage = "filling";
  let startAt = 0;
  let stageAt = 0;
  let dust: Dust[] = [];
  // 0 is solid, 1 is gone. Each thing fades out on its own once its frame is right.
  const fade: Record<ThingId, number> = { rug: 0, lamp: 0, shelf: 0, plant: 0 };
  let whiteout = 0;

  function thingGone(index: number): boolean {
    return frameIsRight(index, words[index] ?? "");
  }

  function puffAt(x: number, y: number): void {
    for (let i = 0; i < 16; i += 1) {
      dust.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 180,
        vy: -Math.random() * 160,
        life: 0.6 + Math.random() * 0.5,
      });
    }
  }

  return {
    name: "Blank, Blank, Blankity Blank",
    exitLine: "The room went blank, and you were on the other side of it.",

    reset(at) {
      words = ["", "", "", ""];
      stage = "filling";
      startAt = at;
      stageAt = at;
      dust = [];
      for (const id of THINGS) fade[id] = 0;
      whiteout = 0;
    },

    update(now, dt) {
      dust = updateDust(dust, dt);

      THINGS.forEach((id, index) => {
        const target = thingGone(index) ? 1 : 0;
        const step = dt * 2.4;
        fade[id] = clamp(fade[id] + (target > fade[id] ? step : -step), 0, 1);
      });

      if (stage === "filling" && phraseSolved(words)) {
        stage = "blanking";
        stageAt = now;
        sounds.chime();
      }
      if (stage === "blanking") {
        whiteout = clamp((now - stageAt) / 1600, 0, 1);
        if (whiteout >= 1) {
          stage = "leaving";
          stageAt = now;
          sounds.whoosh(1.2);
        }
      }
      if (stage === "leaving" && now - stageAt > 1300) {
        stage = "escaped";
        onEscaped();
      }
    },

    draw(now) {
      const secondsIn = (now - startAt) / 1000;

      ctx.save();
      if (stage === "leaving") {
        // Straight into the middle of all that nothing.
        diveInto(W / 2, (FRAME.top + FRAME.h / 2 + STRIP.y) / 2, clamp((now - stageAt) / 1300, 0, 1));
      }

      drawRoomBox(PALETTE);
      drawThings();
      drawFrames(now);
      drawStrip();

      ctx.restore();

      drawDust(dust, "rgba(120, 110, 100, 0.8)");
      drawVignette();

      if (whiteout > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${whiteout})`;
        ctx.fillRect(0, 0, W, H);
      }

      if (stage === "filling") {
        drawCaption("Blank, blank, blankity blank.", secondsIn);
      }
    },

    pointerDown(p) {
      if (stage !== "filling") return;
      for (let index = 0; index < 4; index += 1) {
        const box = frameBox(index);
        if (!inRect(p, box.x, box.y, box.w, box.h)) continue;
        const was = words[index] ?? "";
        const now = nextWord(was);
        words[index] = now;
        sounds.clack();
        if (frameIsRight(index, now)) {
          sounds.pop();
          puffAt(box.x + box.w / 2, box.y + box.h + 20);
        }
        return;
      }
    },

    pointerMove() {},
    pointerUp() {},

    cursor(p) {
      if (stage !== "filling") return "default";
      for (let index = 0; index < 4; index += 1) {
        const box = frameBox(index);
        if (inRect(p, box.x, box.y, box.w, box.h)) return "pointer";
      }
      return "default";
    },
  };

  // ---------- drawing ----------

  function drawFrames(now: number): void {
    for (let index = 0; index < 4; index += 1) {
      const box = frameBox(index);
      const word = words[index] ?? "";

      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      roundRect(box.x + 5, box.y + 7, box.w, box.h, 6);
      ctx.fill();

      ctx.fillStyle = "#8d8378";
      roundRect(box.x, box.y, box.w, box.h, 6);
      ctx.fill();
      ctx.fillStyle = "#fdfcf8";
      roundRect(box.x + 9, box.y + 9, box.w - 18, box.h - 18, 3);
      ctx.fill();

      if (!word) continue;

      // The word is stamped on, so it sits crooked and a touch too big.
      ctx.save();
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.rotate(index % 2 === 0 ? -0.06 : 0.05);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = word === "BLANKITY" ? 20 : 26;
      ctx.font = `bold ${size}px 'Trebuchet MS', sans-serif`;
      ctx.fillStyle = frameIsRight(index, word) ? "#1c1a17" : "#a8a099";
      ctx.fillText(word, 0, 0);
      if (frameIsRight(index, word)) {
        // A stamped word gets the ring around it that stamps leave.
        ctx.strokeStyle = "rgba(28, 26, 23, 0.35)";
        ctx.lineWidth = 2;
        const pulse = 1 + Math.sin(now / 400) * 0.01;
        roundRect(-box.w / 2 + 18, -22 * pulse, box.w - 36, 44 * pulse, 6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawStrip(): void {
    ctx.fillStyle = "#fffdf7";
    roundRect(STRIP.x, STRIP.y, STRIP.w, STRIP.h, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.fillStyle = phraseSolved(words) ? "#1c1a17" : "#6d655c";
    ctx.fillText(readPhrase(words), STRIP.x + STRIP.w / 2, STRIP.y + STRIP.h / 2);
  }

  function drawThings(): void {
    drawRug(1 - fade.rug);
    drawShelf(1 - fade.shelf);
    drawLamp(1 - fade.lamp);
    drawPlant(1 - fade.plant);
  }

  // Everything in here fades towards the colour of the wall, not towards
  // see-through, so a half-blank thing looks like it's being rubbed out.
  function blankFade(alpha: number, paint: () => void): void {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    paint();
    ctx.restore();
  }

  function drawRug(alpha: number): void {
    blankFade(alpha, () => {
      ctx.fillStyle = "#b8524f";
      ctx.beginPath();
      ctx.ellipse(W / 2, 520, 260, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8e3c3a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(W / 2, 520, 215, 46, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawShelf(alpha: number): void {
    blankFade(alpha, () => {
      ctx.fillStyle = "#9a7b52";
      ctx.fillRect(BACK.left + 30, 250, 150, 12);
      ctx.fillStyle = "#7c6241";
      ctx.fillRect(BACK.left + 40, 262, 10, 40);
      ctx.fillRect(BACK.left + 160, 262, 10, 40);
      // Three books, none of which say anything.
      const books = ["#4a6fa5", "#a5554a", "#5a8f6a"];
      books.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(BACK.left + 50 + i * 22, 212, 16, 38);
      });
    });
  }

  function drawLamp(alpha: number): void {
    blankFade(alpha, () => {
      const x = BACK.right - 120;
      ctx.fillStyle = "#6f6a63";
      ctx.fillRect(x - 4, 300, 8, 110);
      ctx.fillStyle = "#57524c";
      ctx.beginPath();
      ctx.ellipse(x, 412, 34, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3dfa8";
      ctx.beginPath();
      ctx.moveTo(x - 44, 300);
      ctx.lineTo(x + 44, 300);
      ctx.lineTo(x + 30, 248);
      ctx.lineTo(x - 30, 248);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255, 236, 170, 0.35)";
      ctx.beginPath();
      ctx.ellipse(x, 330, 70, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlant(alpha: number): void {
    blankFade(alpha, () => {
      const x = BACK.left + 70;
      ctx.fillStyle = "#b07a4e";
      ctx.beginPath();
      ctx.moveTo(x - 28, 400);
      ctx.lineTo(x + 28, 400);
      ctx.lineTo(x + 20, 452);
      ctx.lineTo(x - 20, 452);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#3f7d4a";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      for (const lean of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, 400);
        ctx.quadraticCurveTo(x + lean * 40, 360, x + lean * 52, lerp(330, 348, Math.abs(lean)));
        ctx.stroke();
      }
    });
  }
}
