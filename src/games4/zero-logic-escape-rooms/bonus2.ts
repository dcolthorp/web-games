import {
  H,
  W,
  clamp,
  ctx,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawSaw,
  drawVignette,
  inRect,
  lerp,
  line,
  roundRect,
  updateDust,
  type Dust,
  type Point,
} from "./engine";
import { sounds } from "./sound";
import { selectedTool } from "./tools";

// Workbench's bonus level, behind the doorway the saw cuts in the plywood wall.
// It's the workbench room with everything taken out except a Start button and
// a slot in each side wall. Press Start and every second two boards shoot out
// of the slots, one smiley and one frowny. Saw the frowny ones before they hit
// you. Let a frowny one hit you, or saw a smiley one (it turns sad), and it's
// back to the start. Saw enough frowny ones and you beat it.

export interface BonusLevel {
  reset(now: number): void;
  update(now: number, dt: number): void;
  draw(now: number): void;
  pointerDown(p: Point): void;
  pointerMove(p: Point): void;
  cursor(p: Point): string;
}

type Phase = "ready" | "running" | "failed" | "won";
type Face = "smiley" | "frowny";
type Side = "left" | "right";

interface Board {
  side: Side;
  face: Face;
  start: number;
  sawnAt: number | null;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  start: number;
}

const PALETTE = {
  ceiling: "#2f3438",
  side: "#4f585d",
  wallTop: "#6c767b",
  wallBottom: "#5c6569",
  floorBack: "#4a4d50",
  floorFront: "#6a6e71",
  skirting: "#3f4649",
  floor: "concrete",
} as const;

// The slots the boards come out of, one on each side wall.
const SLOT = { top: 190, bottom: 390, leftX: 62, rightX: W - 62 };
const SLOT_MID = (SLOT.top + SLOT.bottom) / 2;

const BUTTON: Point = { x: W / 2, y: 320 };
const BUTTON_R = 30;
const BACK_BUTTON = { x: 18, y: 16, w: 96, h: 36 };

const BOARD_W = 70;
const BOARD_H = 120;
const TO_WIN = 10;

const SPAWN_EVERY_MS = 1000;
const FLIGHT_MS = 2600;
const SAWN_MS = 900;
const FAIL_MS = 1800;
const HIT_FLASH_MS = 500;
const FLOAT_MS = 1400;

export function createBoardBonus(leave: () => void): BonusLevel {
  let phase: Phase = "ready";
  let phaseStart = 0;
  let failReason: "hit" | "smiley" = "hit";
  let boards: Board[] = [];
  let floaters: Floater[] = [];
  let dust: Dust[] = [];
  let sawn = 0;
  let nextSpawn = 0;
  let pointer: Point = { x: W / 2, y: H / 2 };

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  function reset(now: number): void {
    setPhase("ready", now);
    boards = [];
    floaters = [];
    dust = [];
    sawn = 0;
  }

  // Everything freezes where it is while the "back to the start" message is up.
  const clock = (now: number): number => (phase === "failed" ? phaseStart : now);

  // Boards slide out of the slot first, then rush at you, getting bigger.
  function pose(board: Board, now: number): { t: number; x: number; y: number; scale: number; angle: number } {
    const at = board.sawnAt ?? clock(now);
    const t = clamp((at - board.start) / FLIGHT_MS, 0, 1);
    const left = board.side === "left";
    return {
      t,
      x: lerp(left ? SLOT.leftX : SLOT.rightX, W / 2 + (left ? -190 : 190), 1 - (1 - t) ** 2),
      y: lerp(SLOT_MID, H / 2 + 40, t),
      scale: lerp(0.3, 1.8, t * t),
      angle: (left ? 1 : -1) * 0.25 * (1 - t),
    };
  }

  // The closest board still flying under the pointer.
  function boardAt(p: Point, now: number): Board | null {
    const flying = boards.filter((b) => b.sawnAt === null).sort((a, b) => a.start - b.start);
    for (const board of flying) {
      const q = pose(board, now);
      const w = BOARD_W * q.scale + 16;
      const h = BOARD_H * q.scale + 16;
      if (inRect(p, q.x - w / 2, q.y - h / 2, w, h)) return board;
    }
    return null;
  }

  const overStart = (p: Point): boolean => Math.hypot(p.x - BUTTON.x, p.y - BUTTON.y) < BUTTON_R + 14;
  const overBack = (p: Point): boolean => inRect(p, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h);

  function float(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 180, W - 180), y, start: now });
  }

  function spawnPair(at: number): void {
    const smileyOnLeft = Math.random() < 0.5;
    boards.push({ side: "left", face: smileyOnLeft ? "smiley" : "frowny", start: at, sawnAt: null });
    boards.push({ side: "right", face: smileyOnLeft ? "frowny" : "smiley", start: at, sawnAt: null });
    sounds.whoosh(0.25);
  }

  function fail(reason: "hit" | "smiley", now: number): void {
    failReason = reason;
    setPhase("failed", now);
    if (reason === "hit") sounds.crash();
    else sounds.womp();
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();

    if (phase === "won") {
      leave();
      return;
    }
    if (phase === "ready") {
      if (overBack(p)) {
        sounds.tink();
        leave();
      } else if (overStart(p)) {
        if (selectedTool() !== "saw") {
          sounds.womp();
          float("Pick up the saw first!", BUTTON.x, BUTTON.y - 110, now);
          return;
        }
        boards = [];
        sawn = 0;
        nextSpawn = now + 400;
        setPhase("running", now);
        sounds.pop();
      }
      return;
    }
    if (phase !== "running") return;

    const board = boardAt(p, now);
    if (!board) return;
    if (selectedTool() !== "saw") {
      float("You need the saw!", p.x, p.y - 40, now);
      return;
    }
    const q = pose(board, now);
    board.sawnAt = now;
    sounds.stroke();
    sounds.crack();
    for (let i = 0; i < 14; i += 1) {
      dust.push({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 200, life: 1 });
    }
    if (board.face === "smiley") {
      fail("smiley", now);
      return;
    }
    sawn += 1;
    if (sawn >= TO_WIN) {
      sounds.chime();
      boards = boards.filter((b) => b.sawnAt !== null);
      setPhase("won", now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function cursor(p: Point): string {
    if (phase === "won") return "pointer";
    if (phase === "ready" && (overBack(p) || overStart(p))) return "pointer";
    return selectedTool() === "saw" ? "none" : "default";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    if (phase === "running") {
      // After a long pause (a hidden tab), don't dump a pile of boards at once.
      if (now - nextSpawn > SPAWN_EVERY_MS * 2) nextSpawn = now;
      while (now >= nextSpawn) {
        spawnPair(nextSpawn);
        nextSpawn += SPAWN_EVERY_MS;
      }
      const arrived = (b: Board): boolean => b.sawnAt === null && now - b.start >= FLIGHT_MS;
      if (boards.some((b) => arrived(b) && b.face === "frowny")) {
        fail("hit", now);
      } else {
        // Smiley boards just bump you and go away.
        if (boards.some(arrived)) sounds.tink();
        boards = boards.filter((b) => (b.sawnAt === null ? now - b.start < FLIGHT_MS : now - b.sawnAt < SAWN_MS));
      }
    } else if (phase === "failed" && now - phaseStart >= FAIL_MS) {
      boards = [];
      sawn = 0;
      setPhase("ready", now);
    } else if (phase === "won") {
      boards = boards.filter((b) => b.sawnAt !== null && now - b.sawnAt < SAWN_MS);
    }
    dust = updateDust(dust, dt);
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawTubeLight(): void {
    const glow = ctx.createRadialGradient(W / 2, 60, 10, W / 2, 60, 260);
    glow.addColorStop(0, "rgba(220, 240, 255, 0.35)");
    glow.addColorStop(1, "rgba(220, 240, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 260, 40, 520, 280);
    ctx.fillStyle = "#3a4044";
    ctx.fillRect(W / 2 - 110, 48, 220, 8);
    ctx.fillStyle = "#f4fbff";
    roundRect(W / 2 - 100, 56, 200, 9, 4);
    ctx.fill();
  }

  function drawSlots(): void {
    for (const x of [SLOT.leftX, SLOT.rightX]) {
      ctx.strokeStyle = "#16191b";
      ctx.lineWidth = 10;
      line(x, SLOT.top, x, SLOT.bottom);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx.lineWidth = 2;
      const edge = x < W / 2 ? 7 : -7;
      line(x + edge, SLOT.top, x + edge, SLOT.bottom);
    }
  }

  function drawStartButton(now: number): void {
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 30px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("START", BUTTON.x, BUTTON.y - 64);

    ctx.fillStyle = "#3a4044";
    roundRect(BUTTON.x - 44, BUTTON.y - 44, 88, 88, 10);
    ctx.fill();
    ctx.fillStyle = "#23282b";
    ctx.beginPath();
    ctx.arc(BUTTON.x, BUTTON.y, BUTTON_R + 6, 0, Math.PI * 2);
    ctx.fill();

    const pressed = phase !== "ready";
    // While it's waiting to be pressed it glows a little.
    if (!pressed) {
      const glow = ctx.createRadialGradient(BUTTON.x, BUTTON.y, BUTTON_R, BUTTON.x, BUTTON.y, BUTTON_R + 30);
      glow.addColorStop(0, `rgba(255, 90, 90, ${0.25 + 0.15 * Math.sin(now / 250)})`);
      glow.addColorStop(1, "rgba(255, 90, 90, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(BUTTON.x - 70, BUTTON.y - 70, 140, 140);
    }
    ctx.fillStyle = pressed ? "#9e2323" : "#e63946";
    ctx.beginPath();
    ctx.arc(BUTTON.x, BUTTON.y, pressed ? BUTTON_R - 4 : BUTTON_R, 0, Math.PI * 2);
    ctx.fill();
    if (!pressed) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.ellipse(BUTTON.x - 9, BUTTON.y - 11, 11, 6, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBoardFace(face: Face | "sad", seed: number): void {
    ctx.fillStyle = "#d7ae72";
    ctx.fillRect(-BOARD_W / 2, -BOARD_H / 2, BOARD_W, BOARD_H);
    ctx.strokeStyle = "rgba(120, 80, 30, 0.35)";
    ctx.lineWidth = 1.5;
    for (const gx of [-22, 0, 22]) {
      ctx.beginPath();
      ctx.moveTo(gx, -BOARD_H / 2);
      for (let yy = -BOARD_H / 2 + 15; yy <= BOARD_H / 2; yy += 15) {
        ctx.lineTo(gx + Math.sin((yy + seed * 37 + gx * 3) / 20) * 3, yy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 3;
    ctx.strokeRect(-BOARD_W / 2, -BOARD_H / 2, BOARD_W, BOARD_H);

    ctx.fillStyle = face === "smiley" ? "#ffd23f" : face === "frowny" ? "#e63946" : "#4c8bf5";
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -8, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1d1d1d";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    for (const ex of [-9, 9]) {
      ctx.beginPath();
      ctx.arc(ex, -16, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (face === "smiley") {
      ctx.beginPath();
      ctx.arc(0, -10, 14, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    } else {
      if (face === "frowny") {
        // Angry eyebrows
        line(-17, -27, -5, -22);
        line(17, -27, 5, -22);
      } else {
        // Sad eyebrows and a tear
        line(-17, -21, -5, -26);
        line(17, -21, 5, -26);
        ctx.fillStyle = "#bde0ff";
        ctx.beginPath();
        ctx.ellipse(13, -5, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 7, 12, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  function drawBoard(board: Board, now: number, seed: number): void {
    const q = pose(board, now);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(q.angle);
    ctx.scale(q.scale, q.scale);

    if (board.sawnAt !== null && board.face === "frowny") {
      // Sawn in half: the two halves fall apart.
      const s = Math.min(1, (now - board.sawnAt) / SAWN_MS);
      ctx.globalAlpha = 1 - s;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(dir * 40 * s, 260 * s * s);
        ctx.rotate(dir * 0.7 * s);
        ctx.beginPath();
        ctx.rect(dir < 0 ? -BOARD_W / 2 - 3 : 0, -BOARD_H / 2 - 3, BOARD_W / 2 + 3, BOARD_H + 6);
        ctx.clip();
        drawBoardFace("frowny", seed);
        ctx.restore();
      }
    } else if (board.sawnAt !== null) {
      // A sawn smiley board doesn't break. It just gets sad.
      drawBoardFace("sad", seed);
      ctx.strokeStyle = "#3a2410";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -BOARD_H / 2);
      for (let i = 1; i <= 6; i += 1) ctx.lineTo(i % 2 === 0 ? 0 : 4, -BOARD_H / 2 + (i * BOARD_H) / 6);
      ctx.stroke();
    } else {
      drawBoardFace(board.face, seed);
    }
    ctx.restore();
  }

  function shout(text: string, y: number, size: number, color: string): void {
    ctx.font = `${size}px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function drawHud(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    roundRect(W / 2 - 150, 12, 300, 50, 10);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`FROWNY BOARDS SAWED  ${sawn} / ${TO_WIN}`, W / 2, 28);
    for (let i = 0; i < TO_WIN; i += 1) {
      ctx.fillStyle = i < sawn ? "#e63946" : "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(W / 2 - 108 + i * 24, 48, 7, 0, Math.PI * 2);
      ctx.fill();
    }
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
    ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    for (const f of floaters) {
      const t = (now - f.start) / FLOAT_MS;
      ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
      ctx.strokeText(f.text, f.x, f.y - 40 * t);
      ctx.fillText(f.text, f.x, f.y - 40 * t);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now: number): void {
    const inPhase = now - phaseStart;
    const hitShake = phase === "failed" && failReason === "hit" && inPhase < HIT_FLASH_MS ? 1 - inPhase / HIT_FLASH_MS : 0;

    ctx.save();
    if (hitShake > 0) ctx.translate((Math.random() - 0.5) * 16 * hitShake, (Math.random() - 0.5) * 16 * hitShake);
    drawRoomBox(PALETTE);
    drawTubeLight();
    drawSlots();
    drawStartButton(now);
    // Farthest boards first, so the close ones are drawn on top.
    [...boards]
      .sort((a, b) => b.start - a.start)
      .forEach((board) => drawBoard(board, now, boards.indexOf(board)));
    drawDust(dust, "#d7ae72");
    ctx.restore();

    drawVignette();
    if (hitShake > 0) {
      ctx.fillStyle = `rgba(230, 57, 70, ${0.5 * hitShake})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "#c77dff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("BONUS LEVEL", W - 22, 34);

    if (phase === "ready") {
      drawBackButton();
      if (selectedTool() !== "saw") drawCaption("You'll need the saw.", inPhase / 1000);
    } else {
      drawHud();
    }

    if (phase === "failed") {
      shout(failReason === "hit" ? "A FROWNY BOARD GOT YOU!" : "YOU MADE A HAPPY BOARD SAD!", H / 2 - 20, 50, failReason === "hit" ? "#ff6b6b" : "#7fb2ff");
      shout("Back to the start…", H / 2 + 36, 26, "#f5efe6");
    } else if (phase === "won") {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.65, inPhase / 600)})`;
      ctx.fillRect(0, 0, W, H);
      shout("BONUS LEVEL BEATEN!", H / 2 - 30, 64, "#ffcf5a");
      shout("You sawed every frowny board.", H / 2 + 30, 26, "#f5efe6");
      shout("Click to go back.", H / 2 + 70, 22, "#b9adc4");
    }

    drawFloaters(now);
    if (selectedTool() === "saw" && phase !== "won") drawSaw(pointer.x, pointer.y, -0.35);
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
