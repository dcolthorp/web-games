import {
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawCaption,
  drawSaw,
  drawVignette,
  inRect,
  roundRect,
  type Point,
} from "./engine";
import type { BonusLevel } from "./bonus2";
import { sounds } from "./sound";
import { collectSwitchPiece, drawSwitchPiece, hasSwitchPiece } from "./switchPieces";
import { selectedTool } from "./tools";

// Comical's bonus level, behind the poster the saw cuts. The wall is papered
// with about a hundred copies of the same poster, and one of them is a little
// bit different. Saw the different one (the rest won't cut), go through the
// doorway behind it, and switch piece 2 is waiting on the other side.

type Phase = "find" | "open" | "diving" | "reward";
type Oddity = "burst" | "paper" | "question" | "upsideDown" | "tiny";

interface Floater {
  text: string;
  x: number;
  y: number;
  start: number;
}

const ODDITIES: Oddity[] = ["burst", "paper", "question", "upsideDown", "tiny"];
const COMIC_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";

const COLS = 14;
const ROWS = 7;
const CELL_W = 64;
const CELL_H = 76;
const GRID_X = (W - COLS * CELL_W) / 2;
const GRID_Y = 56;
const POSTER_W = 50;
const POSTER_H = 62;
const BACK_BUTTON = { x: 16, y: 10, w: 96, h: 36 };

const SHRED_MS = 800;
const WIGGLE_MS = 400;
const DIVE_MS = 1100;
const FLOAT_MS = 1400;

function cellCenter(index: number): Point {
  return {
    x: GRID_X + (index % COLS) * CELL_W + CELL_W / 2,
    y: GRID_Y + Math.floor(index / COLS) * CELL_H + CELL_H / 2,
  };
}

export function createPosterBonus(leave: () => void): BonusLevel {
  let phase: Phase = "find";
  let phaseStart = 0;
  let levelStart = 0;
  let oddIndex = 0;
  let oddity: Oddity = "burst";
  let cutAt = 0;
  let wiggle = { index: -1, at: -Infinity };
  let floaters: Floater[] = [];
  let pieceWasNew = true;
  let pointer: Point = { x: W / 2, y: H / 2 };

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  // A new different poster, in a new spot, every time you come in.
  function reset(now: number): void {
    setPhase("find", now);
    levelStart = now;
    oddIndex = Math.floor(Math.random() * COLS * ROWS);
    oddity = ODDITIES[Math.floor(Math.random() * ODDITIES.length)] ?? "burst";
    wiggle = { index: -1, at: -Infinity };
    floaters = [];
  }

  function posterAt(p: Point): number | null {
    const col = Math.floor((p.x - GRID_X) / CELL_W);
    const row = Math.floor((p.y - GRID_Y) / CELL_H);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    const index = row * COLS + col;
    const c = cellCenter(index);
    return inRect(p, c.x - POSTER_W / 2, c.y - POSTER_H / 2, POSTER_W, POSTER_H) ? index : null;
  }

  const overBack = (p: Point): boolean => inRect(p, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h);

  function float(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 130, W - 130), y: Math.max(40, y), start: now });
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();

    if (phase === "reward") {
      leave();
      return;
    }
    if (phase === "diving") return;
    if (overBack(p)) {
      sounds.tink();
      leave();
      return;
    }

    const index = posterAt(p);
    if (index === null) return;
    if (phase === "open") {
      if (index === oddIndex) {
        sounds.whoosh(DIVE_MS / 1000);
        setPhase("diving", now);
      }
      return;
    }

    const c = cellCenter(index);
    if (selectedTool() !== "saw") {
      float("You need the saw.", c.x, c.y - 44, now);
    } else if (index === oddIndex) {
      cutAt = now;
      sounds.crack();
      sounds.paper();
      setPhase("open", now);
    } else {
      sounds.stroke();
      wiggle = { index, at: now };
      float("This one won't cut.", c.x, c.y - 44, now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function cursor(p: Point): string {
    if (phase === "reward") return "pointer";
    if (phase === "diving") return "default";
    if (overBack(p)) return "pointer";
    if (phase === "open" && posterAt(p) === oddIndex) return "pointer";
    return selectedTool() === "saw" ? "none" : "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    if (phase === "diving" && now - phaseStart >= DIVE_MS) {
      pieceWasNew = !hasSwitchPiece(2);
      collectSwitchPiece(2);
      sounds.chime();
      setPhase("reward", now);
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawPoster(c: Point, odd: Oddity | null, angle: number): void {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    ctx.save();
    if (odd === "upsideDown") ctx.rotate(Math.PI);
    ctx.fillStyle = odd === "paper" ? "#c8e65a" : "#ffd23f";
    ctx.fillRect(-POSTER_W / 2, -POSTER_H / 2, POSTER_W, POSTER_H);
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 2;
    ctx.strokeRect(-POSTER_W / 2, -POSTER_H / 2, POSTER_W, POSTER_H);

    const r = odd === "tiny" ? 12 : 19;
    ctx.beginPath();
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.6;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr + 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = odd === "burst" ? "#ff9f1c" : "#e63946";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.rotate(-0.15);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${odd === "tiny" ? 7 : 10}px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(odd === "question" ? "POW?" : "POW!", 0, 3);
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 240, 0.75)";
    ctx.fillRect(-POSTER_W / 2 - 3, -POSTER_H / 2 - 3, 8, 6);
    ctx.fillRect(POSTER_W / 2 - 5, -POSTER_H / 2 - 3, 8, 6);
    ctx.restore();
  }

  // The small doorway left where the different poster was.
  function drawMiniDoor(c: Point, now: number): void {
    const L = c.x - POSTER_W / 2 + 4;
    const R = c.x + POSTER_W / 2 - 4;
    const T = c.y - POSTER_H / 2 + 6;
    const B = c.y + POSTER_H / 2;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);

    ctx.fillStyle = "#9fb3c8";
    ctx.fillRect(L - 2, T - 2, R - L + 4, B - T + 4);
    ctx.fillStyle = "#1a0b2e";
    ctx.fillRect(L, T, R - L, B - T);
    const glow = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, 26);
    glow.addColorStop(0, `rgba(214, 160, 255, ${0.6 + 0.3 * pulse})`);
    glow.addColorStop(1, "rgba(199, 125, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = "#e9d2ff";
    ctx.fillRect(c.x - 5, T + (B - T) * 0.28, 10, 14);
    ctx.fillStyle = `rgba(199, 125, 255, ${0.5 + 0.3 * pulse})`;
    for (let i = 0; i < 3; i += 1) {
      const half = 16 - i * 4;
      ctx.fillRect(c.x - half, B - 6 - i * 8, half * 2, 3);
    }

    // Scraps of the poster left under the tape
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.moveTo(c.x - POSTER_W / 2 - 3, c.y - POSTER_H / 2 - 2);
    ctx.lineTo(c.x - POSTER_W / 2 + 9, c.y - POSTER_H / 2 - 2);
    ctx.lineTo(c.x - POSTER_W / 2 + 2, c.y - POSTER_H / 2 + 12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c.x + POSTER_W / 2 + 3, c.y - POSTER_H / 2 - 2);
    ctx.lineTo(c.x + POSTER_W / 2 - 9, c.y - POSTER_H / 2 - 2);
    ctx.lineTo(c.x + POSTER_W / 2 - 2, c.y - POSTER_H / 2 + 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 240, 0.75)";
    ctx.fillRect(c.x - POSTER_W / 2 - 3, c.y - POSTER_H / 2 - 3, 8, 6);
    ctx.fillRect(c.x + POSTER_W / 2 - 5, c.y - POSTER_H / 2 - 3, 8, 6);
  }

  // Strips of the cut poster falling off the wall.
  function drawShreds(c: Point, elapsed: number): void {
    if (elapsed > SHRED_MS) return;
    const t = elapsed / 1000;
    const strips = 4;
    const stripW = POSTER_W / strips;
    ctx.globalAlpha = 1 - elapsed / SHRED_MS;
    ctx.fillStyle = oddity === "paper" ? "#c8e65a" : "#ffd23f";
    for (let i = 0; i < strips; i += 1) {
      ctx.save();
      ctx.translate(c.x - POSTER_W / 2 + (i + 0.5) * stripW + (i - 1.5) * 40 * t, c.y + 600 * t * t);
      ctx.rotate((i % 2 === 0 ? 1 : -1) * t * (3 + i));
      ctx.fillRect(-stripW / 2 + 1, -POSTER_H / 2, stripW - 2, POSTER_H);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawBackButton(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);
  }

  function drawFloaters(now: number): void {
    ctx.font = `bold 18px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    for (const f of floaters) {
      const t = (now - f.start) / FLOAT_MS;
      ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
      ctx.strokeText(f.text, f.x, f.y - 30 * t);
      ctx.fillText(f.text, f.x, f.y - 30 * t);
    }
    ctx.globalAlpha = 1;
  }

  function shout(text: string, y: number, font: string, color: string): void {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function drawReward(now: number): void {
    const bg = ctx.createRadialGradient(W / 2, H / 2 - 20, 20, W / 2, H / 2, 540);
    bg.addColorStop(0, "#3a1063");
    bg.addColorStop(1, "#0b0414");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = Math.min(1, (now - phaseStart) / 500);
    ctx.fillStyle = "#2e1a4d";
    ctx.fillRect(W / 2 - 45, 426, 90, 110);
    ctx.fillStyle = "#4b2a78";
    roundRect(W / 2 - 70, 400, 140, 26, 6);
    ctx.fill();

    const glow = ctx.createRadialGradient(W / 2, 300, 10, W / 2, 300, 140);
    glow.addColorStop(0, `rgba(214, 160, 255, ${0.5 + 0.2 * Math.sin(now / 300)})`);
    glow.addColorStop(1, "rgba(214, 160, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 140, 160, 280, 280);
    drawSwitchPiece(2, W / 2, 300 + Math.sin(now / 400) * 8, 2.4);

    shout("SWITCH PIECE 2", 105, "58px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", "#ffcf5a");
    shout(
      pieceWasNew ? "You found the second switch piece!" : "You already have this one.",
      160,
      "bold 24px 'Trebuchet MS', sans-serif",
      "#f5efe6"
    );
    shout("Click to go back.", 570, "bold 20px 'Trebuchet MS', sans-serif", "#b9adc4");
    ctx.globalAlpha = 1;
  }

  function draw(now: number): void {
    if (phase === "reward") {
      drawReward(now);
      return;
    }

    const odd = cellCenter(oddIndex);
    let dark = 0;
    ctx.save();
    if (phase === "diving") dark = diveInto(odd.x, odd.y, Math.min(1, (now - phaseStart) / DIVE_MS));
    ctx.fillStyle = "#4f6a8a";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    for (let x = 0; x < W; x += 40) ctx.fillRect(x, 0, 20, H);

    for (let i = 0; i < COLS * ROWS; i += 1) {
      const c = cellCenter(i);
      if (i === oddIndex && phase !== "find") {
        drawMiniDoor(c, now);
        continue;
      }
      const w = wiggle.index === i ? now - wiggle.at : Infinity;
      const angle = w < WIGGLE_MS ? Math.sin(w / 25) * 0.15 * (1 - w / WIGGLE_MS) : 0;
      drawPoster(c, i === oddIndex ? oddity : null, angle);
    }
    if (phase !== "find") drawShreds(odd, now - cutAt);
    ctx.restore();

    drawVignette();
    drawBackButton();
    ctx.fillStyle = "#c77dff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("BONUS LEVEL", W - 22, 28);
    if (phase === "find") drawCaption("One of these posters is not like the others.", (now - levelStart) / 1000);

    drawFloaters(now);
    if (phase !== "diving" && selectedTool() === "saw") drawSaw(pointer.x, pointer.y, -0.35, 0.8);
    if (dark > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${dark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
