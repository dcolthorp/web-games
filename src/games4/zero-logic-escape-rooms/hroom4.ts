import {
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawCaption,
  drawRoomBox,
  drawVignette,
  inRect,
  roundRect,
  type Point,
  type Room,
} from "./engine";
import { FLOAT_MS, drawDoor, drawFloaters, drawKey, drawNotes, type Floater } from "./hundred";
import { sounds } from "./sound";

// Hundred Logic Escape Room 4: Chalkboard. The door next to the chalkboard is
// locked, and the key is sitting right there in the chalk tray. Take the key,
// unlock the door, and walk out.

type Stage = "find" | "holding" | "opening" | "open" | "leaving" | "escaped";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PALETTE = {
  ceiling: "#e9e1cf",
  side: "#c9c2a8",
  wallTop: "#ded7b8",
  wallBottom: "#cfc7a6",
  floorBack: "#8d6a47",
  floorFront: "#a88259",
  skirting: "#6f5a45",
  floor: "boards",
} as const;

const BOARD: Rect = { x: 200, y: 90, w: 400, h: 250 };
const TRAY: Rect = { x: 190, y: 340, w: 420, h: 16 };
const KEY_HOME: Point = { x: 520, y: 334 };
const DOOR: Rect = { x: 680, y: 170, w: 120, h: 230 };
const KEYHOLE: Point = { x: DOOR.x + DOOR.w - 20, y: DOOR.y + 136 };

const RATTLE_MS = 300;
const OPEN_MS = 700;
const LEAVE_MS = 1500;

const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

export function createHundredChalkboardRoom(escape: () => void): Room {
  let stage: Stage = "find";
  let stageStart = 0;
  let roomStart = 0;
  let rattleAt = -Infinity;
  let floaters: Floater[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };

  function setStage(next: Stage, now: number): void {
    stage = next;
    stageStart = now;
  }

  function reset(startAt: number): void {
    stage = "find";
    stageStart = startAt;
    roomStart = startAt;
    rattleAt = -Infinity;
    floaters = [];
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(60, y), start: now });
  }

  const overKey = (p: Point): boolean => stage === "find" && Math.hypot(p.x - KEY_HOME.x, p.y - KEY_HOME.y) < 30;

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (stage === "find") {
      if (overKey(p)) {
        sounds.tink();
        setStage("holding", now);
      } else if (over(p, DOOR)) {
        rattleAt = now;
        sounds.thunk();
        say("It's locked.", DOOR.x + DOOR.w / 2, DOOR.y - 20, now);
      } else if (over(p, BOARD)) {
        say("1 + 1 = 2. That makes sense.", BOARD.x + BOARD.w / 2, BOARD.y - 20, now);
      }
      return;
    }
    if (stage === "holding") {
      if (over(p, DOOR)) {
        sounds.clack();
        sounds.creak();
        setStage("opening", now);
      }
      return;
    }
    if (stage === "open" && over(p, DOOR)) {
      sounds.whoosh(LEAVE_MS / 1000);
      setStage("leaving", now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function pointerUp(): void {}

  function cursor(p: Point): string {
    if (stage === "find") return overKey(p) || over(p, DOOR) || over(p, BOARD) ? "pointer" : "default";
    if (stage === "holding") return "none";
    if (stage === "open" && over(p, DOOR)) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    const elapsed = now - stageStart;
    if (stage === "opening" && elapsed >= OPEN_MS) {
      setStage("open", now);
    } else if (stage === "leaving" && elapsed >= LEAVE_MS) {
      setStage("escaped", now);
      escape();
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawChalkboard(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(BOARD.x - 6, BOARD.y - 4, BOARD.w + 28, BOARD.h + 28);
    ctx.fillStyle = "#7b5230";
    roundRect(BOARD.x - 14, BOARD.y - 14, BOARD.w + 28, BOARD.h + 28, 6);
    ctx.fill();
    ctx.fillStyle = "#34503f";
    ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
    ctx.fillStyle = "rgba(246, 246, 240, 0.93)";
    ctx.font = "64px 'Chalkboard SE', 'Comic Sans MS', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1 + 1 = 2", BOARD.x + BOARD.w / 2, BOARD.y + BOARD.h / 2);

    ctx.fillStyle = "#6a4526";
    ctx.fillRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h);
    ctx.fillStyle = "#8a5c34";
    ctx.fillRect(TRAY.x, TRAY.y, TRAY.w, 5);
    for (const [x, w, color] of [
      [240, 44, "#f4f4ee"],
      [300, 32, "#f5dc6a"],
      [350, 26, "#ef6f6c"],
    ] as const) {
      ctx.fillStyle = color;
      roundRect(x, TRAY.y - 6, w, 9, 4);
      ctx.fill();
    }
  }

  function draw(now: number): void {
    const elapsed = now - stageStart;
    ctx.save();
    let fade = 0;
    if (stage === "leaving") {
      fade = diveInto(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, Math.min(1, elapsed / LEAVE_MS));
    }
    drawRoomBox(PALETTE);
    drawChalkboard();
    if (stage === "find") drawKey(KEY_HOME.x, KEY_HOME.y, 0.1, 1);

    const rattle = now - rattleAt < RATTLE_MS ? Math.sin((now - rattleAt) / 20) * 3 : 0;
    const open = stage === "opening" ? 1 - (1 - Math.min(1, elapsed / OPEN_MS)) ** 3 : stage === "find" || stage === "holding" ? 0 : 1;
    drawDoor(DOOR.x + rattle, DOOR.y, DOOR.w, DOOR.h, open);
    if (open < 0.3) {
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(KEYHOLE.x + rattle, KEYHOLE.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(KEYHOLE.x + rattle - 1.5, KEYHOLE.y, 3, 9);
    }
    ctx.restore();

    drawVignette();
    if (stage === "holding") drawNotes(["You have: the door key"]);
    if (stage === "find") drawCaption("The door is locked.", (now - roomStart) / 1000);
    if (stage === "open") drawCaption("Unlocked.", elapsed / 1000);
    drawFloaters(floaters, now);
    if (stage === "holding") drawKey(pointer.x, pointer.y, -0.6, 1.3);

    if (fade > 0 || stage === "escaped") {
      ctx.fillStyle = `rgba(0, 0, 0, ${stage === "escaped" ? 1 : fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Chalkboard",
    exitLine: "You unlocked the door and walked out into…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
