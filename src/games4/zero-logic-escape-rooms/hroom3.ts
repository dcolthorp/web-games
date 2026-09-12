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
  lerp,
  poly,
  roundRect,
  type Point,
  type Room,
} from "./engine";
import { FLOAT_MS, drawDoor, drawFloaters, drawKey, drawNotes, type Floater } from "./hundred";
import { createComicBoxBonus } from "./comicBox";
import { sounds } from "./sound";

// Hundred Logic Escape Room 3: Comical. Somebody tore up a comic book, and the
// pieces are where comics go: in the comic book box and the dresser drawer. The
// glue is on the desk. Glue the comic back together and it tells you how to get
// out: the door has a key lock and a code lock, the key is in the pizza box,
// and the code is in the comic.
// Open the drawer a second time and there's a shrinker machine in it. Zap
// yourself down to the size of a comic page, climb into the comic book box,
// and that's a bonus level (comicBox.ts).

type Scene =
  | "room"
  | "toDesk"
  | "desk"
  | "toRoom"
  | "opening"
  | "open"
  | "leaving"
  | "escaped"
  | "zap" // the shrinker machine going off
  | "bonusIn" // climbing into the comic box
  | "bonus";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Flyer {
  fromX: number;
  fromY: number;
  start: number;
}

interface Piece {
  slot: number;
  homeX: number;
  homeY: number;
  homeAngle: number;
  glued: boolean;
  flyStart: number | null;
}

const PALETTE = {
  ceiling: "#35425a",
  side: "#4f6a8a",
  wallTop: "#6b8cb0",
  wallBottom: "#5b7898",
  floorBack: "#6b4a6e",
  floorFront: "#8a6590",
  skirting: "#3f5470",
  floor: "carpet",
} as const;

const COMIC_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";

// The bedroom
const BOX: Rect = { x: 170, y: 440, w: 130, h: 70 };
const DRESSER: Rect = { x: 470, y: 290, w: 170, h: 110 };
const DRAWER: Rect = { x: 485, y: 340, w: 140, h: 40 };
const PIZZA: Rect = { x: 380, y: 500, w: 130, h: 48 };
const SHOE: Rect = { x: 620, y: 530, w: 80, h: 40 };
const PHONE: Rect = { x: 320, y: 440, w: 40, h: 50 };
const DOOR: Rect = { x: 730, y: 160, w: 96, h: 240 };
const KEYPAD: Rect = { x: 690, y: 250, w: 30, h: 46 };
const KEYHOLE: Point = { x: DOOR.x + DOOR.w - 18, y: DOOR.y + 145 };
const PIECES_PER_SPOT = 3;
const PIECE_COUNT = 6;

// The keypad, close up
const PAD: Rect = { x: W / 2 - 130, y: 100, w: 260, h: 400 };
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
const PAD_CLOSE: Rect = { x: PAD.x + PAD.w - 40, y: PAD.y + 10, w: 30, h: 30 };

// The desk
const PANEL_W = 180;
const PANEL_H = 150;
const GUTTER = 12;
const PAGE: Rect = { x: 282, y: 51, w: PANEL_W * 2 + GUTTER * 3, h: PANEL_H * 3 + GUTTER * 4 };
const SCATTER_SCALE = 0.62;
const SCATTER: [number, number][] = [
  [145, 125],
  [135, 300],
  [150, 460],
  [815, 130],
  [825, 305],
  [810, 470],
];
const GLUE: Rect = { x: 30, y: 510, w: 44, h: 76 };
const BACK_TO_ROOM: Rect = { x: W / 2 - 120, y: H - 48, w: 240, h: 40 };
const PANEL_COLORS = ["#ffd23f", "#4cc9f0", "#ff8c42", "#9be89b", "#c77dff", "#ff6b6b"];

const POP_MS = 650;
const SWAP_MS = 1200;
const GLUE_FLY_MS = 450;
const RESULT_MS = 700;
const OPEN_MS = 700;
const LEAVE_MS = 1500;
const ZAP_MS = 1300;
const BONUS_IN_MS = 900;
// Where you stand when the shrinker zaps you.
const YOU: Point = { x: 560, y: 470 };

const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

function padKeyRect(i: number): Rect {
  return { x: PAD.x + 22 + (i % 3) * 76, y: PAD.y + 110 + Math.floor(i / 3) * 68, w: 64, h: 56 };
}

function slotPos(slot: number): Point {
  return {
    x: PAGE.x + GUTTER + (slot % 2) * (PANEL_W + GUTTER),
    y: PAGE.y + GUTTER + Math.floor(slot / 2) * (PANEL_H + GUTTER),
  };
}

function easeOut(t: number): number {
  return 1 - (1 - clamp(t, 0, 1)) ** 3;
}

export function createHundredComicalRoom(escape: () => void): Room {
  let scene: Scene = "room";
  let sceneStart = 0;
  let roomStart = 0;
  let code = "0000";
  let boxEmpty = false;
  let drawerOpen = false;
  let flyers: Flyer[] = [];
  let collected = 0;
  let pieces: Piece[] = [];
  let holdingGlue = false;
  let comicDone = false;
  let keyFound = false;
  let keyLock = false;
  let codeLock = false;
  let keypadOpen = false;
  let entry = "";
  let resultAt = -Infinity;
  let resultGood = false;
  let floaters: Floater[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };
  let shrinkerFound = false;
  let tiny = false;
  // Coming back out of the comic box, you're back to your normal size.
  const comicBox = createComicBoxBonus(() => {
    const now = performance.now();
    tiny = false;
    setScene("room", now);
    say("You're back to your normal size.", W / 2, 140, now);
  });

  function setScene(next: Scene, now: number): void {
    scene = next;
    sceneStart = now;
  }

  function reset(startAt: number): void {
    setScene("room", startAt);
    roomStart = startAt;
    code = String(1000 + Math.floor(Math.random() * 9000));
    boxEmpty = false;
    drawerOpen = false;
    flyers = [];
    collected = 0;
    holdingGlue = false;
    comicDone = false;
    keyFound = false;
    keyLock = false;
    codeLock = false;
    keypadOpen = false;
    entry = "";
    resultAt = -Infinity;
    resultGood = false;
    shrinkerFound = false;
    tiny = false;
    floaters = [];
    const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    pieces = SCATTER.map(([x, y], i) => ({
      slot: order[i] ?? i,
      homeX: x,
      homeY: y,
      homeAngle: (Math.random() - 0.5) * 0.7,
      glued: false,
      flyStart: null,
    }));
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 180, W - 180), y: Math.max(60, y), start: now });
  }

  function panelLines(slot: number): string[] {
    return [
      ["You need to", "get out of", "this room."],
      ["The door has", "two locks."],
      ["Lock 1", "needs a key."],
      ["The key is in", "the pizza box."],
      ["Lock 2 code:", code.split("").join(" ")],
      ["Unlock both,", "then walk out", "the door."],
    ][slot] ?? [];
  }

  function releasePieces(from: Rect, now: number): void {
    for (let i = 0; i < PIECES_PER_SPOT; i += 1) {
      flyers.push({ fromX: from.x + from.w / 2, fromY: from.y, start: now + i * 120 });
    }
    sounds.pop();
    say(`${PIECES_PER_SPOT} comic pieces!`, from.x + from.w / 2, from.y - 30, now);
  }

  function tryOpenDoor(now: number): void {
    if (keyLock && codeLock && scene === "room") {
      sounds.creak();
      setScene("opening", now);
    }
  }

  // ---------- input ----------

  function keypadDown(p: Point, now: number): void {
    if (over(p, PAD_CLOSE) || !over(p, PAD)) {
      keypadOpen = false;
      return;
    }
    if (now - resultAt < RESULT_MS) return;
    const index = PAD_KEYS.findIndex((_, i) => over(p, padKeyRect(i)));
    const label = PAD_KEYS[index];
    if (!label) return;
    sounds.tap();
    if (label === "C") {
      entry = "";
    } else if (label === "OK") {
      resultAt = now;
      resultGood = entry === code;
      if (resultGood) {
        codeLock = true;
        sounds.chime();
      } else {
        sounds.womp();
      }
    } else if (entry.length < 4) {
      entry += label;
    }
  }

  function roomDown(p: Point, now: number): void {
    if (over(p, BOX)) {
      if (tiny) {
        sounds.whoosh(BONUS_IN_MS / 1000);
        setScene("bonusIn", now);
      } else if (boxEmpty) {
        sounds.tink();
        say("The comic box is empty now.", BOX.x + BOX.w / 2, BOX.y - 30, now);
      } else {
        boxEmpty = true;
        releasePieces(BOX, now);
      }
    } else if (over(p, DRAWER)) {
      if (tiny) {
        sounds.tink();
        say("You're too small to reach the drawer now.", DRAWER.x + DRAWER.w / 2, DRESSER.y - 20, now);
      } else if (shrinkerFound) {
        sounds.pop();
        setScene("zap", now);
      } else if (drawerOpen) {
        // The second time you open it, there's something at the back.
        shrinkerFound = true;
        sounds.clack();
        say("There's a shrinker machine in here!", DRAWER.x + DRAWER.w / 2, DRESSER.y - 20, now);
      } else {
        drawerOpen = true;
        sounds.clack();
        releasePieces(DRAWER, now);
      }
    } else if (over(p, DRESSER)) {
      say("Try the drawer.", DRESSER.x + DRESSER.w / 2, DRESSER.y - 20, now);
    } else if (over(p, PIZZA)) {
      if (keyFound) {
        say("Just crumbs now.", PIZZA.x + PIZZA.w / 2, PIZZA.y - 20, now);
      } else {
        keyFound = true;
        sounds.chime();
        say("There was a key in the pizza box!", PIZZA.x + PIZZA.w / 2, PIZZA.y - 30, now);
      }
    } else if (over(p, SHOE)) {
      say("That's just a shoe.", SHOE.x + SHOE.w / 2, SHOE.y - 20, now);
    } else if (over(p, PHONE)) {
      say("That's just a phone. No signal.", PHONE.x + PHONE.w / 2, PHONE.y - 20, now);
    } else if (over(p, KEYPAD)) {
      if (codeLock) {
        say("The code lock is already open.", KEYPAD.x, KEYPAD.y - 20, now);
      } else {
        keypadOpen = true;
        entry = "";
        sounds.tap();
      }
    } else if (over(p, DOOR)) {
      if (!keyLock && keyFound) {
        keyLock = true;
        sounds.clack();
        say("The key lock is open.", DOOR.x + DOOR.w / 2, DOOR.y - 20, now);
      } else if (!keyLock) {
        sounds.thunk();
        say("Locked. It needs a key.", DOOR.x + DOOR.w / 2, DOOR.y - 20, now);
      } else if (!codeLock) {
        sounds.thunk();
        say("Still locked. Now the code lock.", DOOR.x, DOOR.y - 20, now);
      }
      tryOpenDoor(now);
    }
  }

  function pieceAt(p: Point): Piece | null {
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const piece = pieces[i];
      if (!piece || piece.glued || piece.flyStart !== null) continue;
      const dx = p.x - piece.homeX;
      const dy = p.y - piece.homeY;
      const cos = Math.cos(-piece.homeAngle);
      const sin = Math.sin(-piece.homeAngle);
      if (
        Math.abs(dx * cos - dy * sin) <= (PANEL_W * SCATTER_SCALE) / 2 &&
        Math.abs(dx * sin + dy * cos) <= (PANEL_H * SCATTER_SCALE) / 2
      ) {
        return piece;
      }
    }
    return null;
  }

  function deskDown(p: Point, now: number): void {
    if (comicDone) {
      if (over(p, BACK_TO_ROOM)) {
        sounds.tap();
        setScene("toRoom", now);
      }
      return;
    }
    if (!holdingGlue && over(p, GLUE)) {
      holdingGlue = true;
      sounds.grab();
      return;
    }
    const piece = pieceAt(p);
    if (!piece) return;
    if (!holdingGlue) {
      sounds.paper();
      say("It needs glue. There's some on the desk.", piece.homeX, piece.homeY - 60, now);
      return;
    }
    sounds.squish();
    piece.flyStart = now;
  }

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (scene === "bonus") {
      comicBox.pointerDown(p);
      return;
    }
    if (scene === "room") {
      if (keypadOpen) keypadDown(p, now);
      else roomDown(p, now);
    } else if (scene === "desk") {
      deskDown(p, now);
    } else if (scene === "open" && over(p, DOOR)) {
      sounds.whoosh(LEAVE_MS / 1000);
      setScene("leaving", now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
    if (scene === "bonus") comicBox.pointerMove(p);
  }

  function pointerUp(p: Point): void {
    if (scene === "bonus") comicBox.pointerUp?.(p);
  }

  function cursor(p: Point): string {
    if (scene === "bonus") return comicBox.cursor(p);
    if (scene === "room") {
      if (keypadOpen) return over(p, PAD_CLOSE) || !over(p, PAD) || PAD_KEYS.some((_, i) => over(p, padKeyRect(i))) ? "pointer" : "default";
      return [BOX, DRAWER, DRESSER, PIZZA, SHOE, PHONE, KEYPAD, DOOR].some((r) => over(p, r)) ? "pointer" : "default";
    }
    if (scene === "desk") {
      if (comicDone) return over(p, BACK_TO_ROOM) ? "pointer" : "default";
      if (holdingGlue) return "none";
      return over(p, GLUE) || pieceAt(p) ? "pointer" : "default";
    }
    if (scene === "open" && over(p, DOOR)) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    if (scene === "bonus") {
      comicBox.update(now, 0);
      return;
    }
    const elapsed = now - sceneStart;
    for (const flyer of flyers) if (now - flyer.start >= POP_MS) collected += 1;
    flyers = flyers.filter((flyer) => now - flyer.start < POP_MS);

    if (scene === "room") {
      if (collected >= PIECE_COUNT && !comicDone && flyers.length === 0) setScene("toDesk", now);
      if (keypadOpen && resultAt > -Infinity && now - resultAt >= RESULT_MS) {
        keypadOpen = !resultGood;
        entry = "";
        resultAt = -Infinity;
        tryOpenDoor(now);
      }
    } else if (scene === "zap" && elapsed >= ZAP_MS) {
      tiny = true;
      setScene("room", now);
    } else if (scene === "bonusIn" && elapsed >= BONUS_IN_MS) {
      setScene("bonus", now);
      comicBox.reset(now);
    } else if (scene === "toDesk" && elapsed >= SWAP_MS) {
      setScene("desk", now);
    } else if (scene === "desk") {
      for (const piece of pieces) {
        if (piece.flyStart === null || now - piece.flyStart < GLUE_FLY_MS) continue;
        piece.flyStart = null;
        piece.glued = true;
        sounds.splat();
      }
      if (!comicDone && pieces.every((piece) => piece.glued)) {
        comicDone = true;
        holdingGlue = false;
        sounds.chime();
      }
    } else if (scene === "toRoom" && elapsed >= SWAP_MS) {
      setScene("room", now);
    } else if (scene === "opening" && elapsed >= OPEN_MS) {
      setScene("open", now);
    } else if (scene === "leaving" && elapsed >= LEAVE_MS) {
      setScene("escaped", now);
      escape();
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing: the bedroom ----------

  // The shrinker machine, sitting in the pulled-out drawer.
  function drawShrinker(now: number): void {
    const x = DRAWER.x + 28;
    const y = DRAWER.y + 14;
    ctx.fillStyle = "#7d8a91";
    roundRect(x, y, 58, 26, 5);
    ctx.fill();
    ctx.strokeStyle = "#3f4649";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#aab3b8";
    ctx.fillRect(x + 58, y + 10, 8, 6);
    ctx.fillStyle = "#c9d1d6";
    ctx.beginPath();
    ctx.ellipse(x + 72, y + 13, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = Math.floor(now / 400) % 2 === 0 ? "#ff5a5a" : "#b52a2a";
    ctx.beginPath();
    ctx.arc(x + 12, y + 13, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SHRINK", x + 36, y + 13);
  }

  // You, standing on the floor. Normal size is about 110 tall; tiny is 16.
  function drawYou(x: number, y: number, height: number): void {
    const s = height / 110;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -40);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.fillStyle = "#3d7bd9";
    roundRect(-16, -80, 32, 44, 10);
    ctx.fill();
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, -94, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = "butt";
    ctx.restore();
  }

  function drawRoomObjects(now: number): void {
    drawRoomBox(PALETTE);
    const glow = ctx.createRadialGradient(W / 2, 50, 10, W / 2, 50, 240);
    glow.addColorStop(0, "rgba(255, 246, 216, 0.35)");
    glow.addColorStop(1, "rgba(255, 246, 216, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 240, 40, 480, 260);

    // Posters
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 3;
    for (const [x, y, w, h, color, word] of [
      [170, 95, 110, 150, "#ffd23f", "POW!"],
      [320, 85, 100, 140, "#4cc9f0", "ZAP!"],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#e63946";
      ctx.font = `bold 28px ${COMIC_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(word, x + w / 2, y + h / 2);
    }

    // Dresser with its drawer
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(DRESSER.x, DRESSER.y, DRESSER.w, DRESSER.h);
    ctx.fillStyle = "#a8733f";
    ctx.fillRect(DRESSER.x - 6, DRESSER.y, DRESSER.w + 12, 12);
    if (drawerOpen) {
      ctx.fillStyle = "#2a1a0c";
      ctx.fillRect(DRAWER.x, DRAWER.y, DRAWER.w, DRAWER.h);
      ctx.fillStyle = "#b8834d";
      roundRect(DRAWER.x - 10, DRAWER.y + 18, DRAWER.w + 20, DRAWER.h + 8, 4);
      ctx.fill();
      if (shrinkerFound) drawShrinker(now);
    } else {
      ctx.fillStyle = "#a8733f";
      ctx.fillRect(DRAWER.x, DRAWER.y, DRAWER.w, DRAWER.h);
    }
    ctx.fillStyle = "#d9a52a";
    ctx.beginPath();
    ctx.arc(DRAWER.x + DRAWER.w / 2, DRAWER.y + (drawerOpen ? 40 : 20), 5, 0, Math.PI * 2);
    ctx.fill();

    // Comic book box
    ctx.fillStyle = "#8a6532";
    poly([BOX.x, BOX.y], [BOX.x + BOX.w, BOX.y], [BOX.x + BOX.w - 14, BOX.y - 20], [BOX.x + 14, BOX.y - 20]);
    if (!boxEmpty) {
      PANEL_COLORS.slice(0, 4).forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(BOX.x + 22 + i * 24, BOX.y - 30 + (i % 2) * 6, 18, 26);
      });
    }
    ctx.fillStyle = "#c79a5b";
    ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    ctx.strokeStyle = "#6b4a22";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOX.x, BOX.y, BOX.w, BOX.h);
    ctx.fillStyle = "#3a2410";
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("COMICS", BOX.x + BOX.w / 2, BOX.y + BOX.h / 2);

    // Pizza box
    ctx.fillStyle = "#d9b27a";
    poly([PIZZA.x, PIZZA.y], [PIZZA.x + PIZZA.w - 10, PIZZA.y - 4], [PIZZA.x + PIZZA.w, PIZZA.y + PIZZA.h], [PIZZA.x + 10, PIZZA.y + PIZZA.h + 4]);
    ctx.strokeStyle = "#8a6a3a";
    ctx.stroke();
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.fillText("PIZZA", PIZZA.x + PIZZA.w / 2, PIZZA.y + PIZZA.h / 2);

    // A shoe and a phone, just lying around
    ctx.fillStyle = "#d63a2f";
    roundRect(SHOE.x, SHOE.y + 8, SHOE.w, SHOE.h - 14, 12);
    ctx.fill();
    ctx.fillStyle = "#f4f4f0";
    ctx.fillRect(SHOE.x, SHOE.y + SHOE.h - 10, SHOE.w, 6);
    ctx.fillStyle = "#1b1b1f";
    roundRect(PHONE.x + 6, PHONE.y + 2, PHONE.w - 12, PHONE.h - 4, 5);
    ctx.fill();

    // The door, its keyhole, and its keypad
    const open = scene === "opening" ? easeOut((now - sceneStart) / OPEN_MS) : scene === "room" ? 0 : 1;
    drawDoor(DOOR.x, DOOR.y, DOOR.w, DOOR.h, open);
    if (open < 0.3) {
      ctx.fillStyle = keyLock ? "#2fa84f" : "#222";
      ctx.beginPath();
      ctx.arc(KEYHOLE.x, KEYHOLE.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(KEYHOLE.x - 1.5, KEYHOLE.y, 3, 9);
    }
    ctx.fillStyle = "#2b2f33";
    roundRect(KEYPAD.x, KEYPAD.y, KEYPAD.w, KEYPAD.h, 4);
    ctx.fill();
    ctx.fillStyle = "#8d979c";
    for (let i = 0; i < 9; i += 1) ctx.fillRect(KEYPAD.x + 6 + (i % 3) * 7, KEYPAD.y + 14 + Math.floor(i / 3) * 9, 4, 5);
    ctx.fillStyle = codeLock ? "#2fa84f" : "#e63946";
    ctx.beginPath();
    ctx.arc(KEYPAD.x + KEYPAD.w / 2, KEYPAD.y + 7, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawKeypad(now: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2b2f33";
    roundRect(PAD.x, PAD.y, PAD.w, PAD.h, 14);
    ctx.fill();
    ctx.strokeStyle = "#11141a";
    ctx.lineWidth = 4;
    ctx.stroke();

    const showing = now - resultAt < RESULT_MS;
    ctx.fillStyle = showing ? (resultGood ? "#1f5a2e" : "#5a1f1f") : "#16301e";
    roundRect(PAD.x + 22, PAD.y + 50, PAD.w - 44, 48, 6);
    ctx.fill();
    ctx.fillStyle = showing ? "#ffffff" : "#8dff9b";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = showing ? (resultGood ? "OPEN" : "WRONG") : entry.padEnd(4, "_").split("").join(" ");
    ctx.fillText(text, PAD.x + PAD.w / 2, PAD.y + 75);

    PAD_KEYS.forEach((label, i) => {
      const r = padKeyRect(i);
      ctx.fillStyle = label === "OK" ? "#2fa84f" : label === "C" ? "#8a4a2a" : "#4a5157";
      roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px 'Trebuchet MS', sans-serif";
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    });

    ctx.fillStyle = "#6b7277";
    roundRect(PAD_CLOSE.x, PAD_CLOSE.y, PAD_CLOSE.w, PAD_CLOSE.h, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.fillText("✕", PAD_CLOSE.x + PAD_CLOSE.w / 2, PAD_CLOSE.y + PAD_CLOSE.h / 2 + 1);
  }

  function roomNotes(): string[] {
    const lines: string[] = [];
    if (!comicDone) lines.push(`Comic pieces: ${collected} / ${PIECE_COUNT}`);
    if (comicDone) lines.push(`Code: ${code.split("").join(" ")}`);
    if (keyFound) lines.push("You have: a key");
    else if (comicDone) lines.push("Key: in the pizza box");
    if (comicDone || keyLock || codeLock) {
      lines.push(`Key lock: ${keyLock ? "open" : "locked"}`, `Code lock: ${codeLock ? "open" : "locked"}`);
    }
    return lines;
  }

  function drawRoom(now: number): void {
    drawRoomObjects(now);
    if (tiny) drawYou(YOU.x, YOU.y, 16);
    drawVignette();
    for (const flyer of flyers) {
      const t = (now - flyer.start) / POP_MS;
      if (t < 0) continue;
      const x = lerp(flyer.fromX, 40, t * t);
      const y = lerp(flyer.fromY, 30, t * t) - Math.sin(Math.PI * Math.min(1, t * 1.6)) * 70;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * Math.PI * 2);
      ctx.fillStyle = PANEL_COLORS[Math.floor(flyer.start) % PANEL_COLORS.length] ?? "#fff";
      ctx.fillRect(-14, -11, 28, 22);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -11, 28, 22);
      ctx.restore();
    }
    if (scene === "room" || scene === "opening" || scene === "open") drawNotes(roomNotes());
  }

  // ---------- drawing: the desk ----------

  function drawPanel(slot: number): void {
    ctx.fillStyle = PANEL_COLORS[slot] ?? "#fff";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, PANEL_W - 4, PANEL_H - 4);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(20, 20, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = `bold 14px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(slot + 1), 20, 21);
    const lines = panelLines(slot);
    ctx.font = `bold 20px ${COMIC_FONT}`;
    lines.forEach((text, i) => ctx.fillText(text, PANEL_W / 2, PANEL_H / 2 + (i - (lines.length - 1) / 2) * 26 + 6));
  }

  function drawGlueBottle(x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#f08a24";
    poly([0, 0], [-6, -14], [6, -14]);
    ctx.fillStyle = "#f4f4f0";
    roundRect(-14, -58, 28, 44, 6);
    ctx.fill();
    ctx.fillStyle = "#3a7bd5";
    ctx.fillRect(-14, -46, 28, 14);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 9px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GLUE", 0, -39);
    ctx.restore();
  }

  function drawDesk(now: number): void {
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    for (let y = 12; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 40; x <= W; x += 40) ctx.lineTo(x, y + Math.sin((x + y * 3) / 70) * 3);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(PAGE.x + 8, PAGE.y + 10, PAGE.w, PAGE.h);
    ctx.fillStyle = "#fbf8ef";
    ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
    for (let slot = 0; slot < PIECE_COUNT; slot += 1) {
      const pos = slotPos(slot);
      if (pieces.some((piece) => piece.slot === slot && piece.glued)) {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        drawPanel(slot);
        ctx.restore();
      } else {
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, PANEL_W, PANEL_H);
        ctx.restore();
      }
    }

    const loose = pieces.filter((piece) => !piece.glued);
    for (const piece of [...loose.filter((p) => p.flyStart === null), ...loose.filter((p) => p.flyStart !== null)]) {
      let x = piece.homeX;
      let y = piece.homeY;
      let angle = piece.homeAngle;
      let scale = SCATTER_SCALE;
      if (piece.flyStart !== null) {
        const t = clamp((now - piece.flyStart) / GLUE_FLY_MS, 0, 1);
        const target = slotPos(piece.slot);
        x = lerp(x, target.x + PANEL_W / 2, t);
        y = lerp(y, target.y + PANEL_H / 2, t) - Math.sin(Math.PI * t) * 50;
        angle = lerp(angle, 0, t);
        scale = lerp(scale, 1, t);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 8, PANEL_W, PANEL_H);
      ctx.translate(-PANEL_W / 2, -PANEL_H / 2);
      drawPanel(piece.slot);
      ctx.restore();
    }

    if (!holdingGlue && !comicDone) drawGlueBottle(GLUE.x + GLUE.w / 2, GLUE.y + GLUE.h, 0);

    if (comicDone) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      roundRect(BACK_TO_ROOM.x, BACK_TO_ROOM.y, BACK_TO_ROOM.w, BACK_TO_ROOM.h, 10);
      ctx.fill();
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#ffd23f";
      ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Back to the room", BACK_TO_ROOM.x + BACK_TO_ROOM.w / 2, BACK_TO_ROOM.y + BACK_TO_ROOM.h / 2 + 1);
    } else if (!holdingGlue) {
      drawCaption("The pieces need glue to stay on the page.", (now - sceneStart) / 1000);
    }
    if (holdingGlue) drawGlueBottle(pointer.x, pointer.y, 0.5);
  }

  // ---------- draw ----------

  function draw(now: number): void {
    if (scene === "bonus") {
      comicBox.draw(now);
      return;
    }
    const elapsed = now - sceneStart;
    let dark = 0;
    if (scene === "toDesk" || scene === "toRoom") {
      const t = Math.min(1, elapsed / SWAP_MS);
      const first = scene === "toDesk" ? drawRoom : drawDesk;
      const second = scene === "toDesk" ? drawDesk : drawRoom;
      if (t < 0.5) first(now);
      else second(now);
      dark = t < 0.5 ? t * 2 : (1 - t) * 2;
    } else if (scene === "desk") {
      drawDesk(now);
    } else {
      ctx.save();
      if (scene === "leaving" || scene === "escaped") {
        dark = scene === "escaped" ? 1 : diveInto(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, Math.min(1, elapsed / LEAVE_MS));
      } else if (scene === "bonusIn") {
        dark = diveInto(BOX.x + BOX.w / 2, BOX.y + BOX.h / 2, Math.min(1, elapsed / BONUS_IN_MS));
      }
      drawRoom(now);
      ctx.restore();
      if (scene === "zap") {
        // A beam from the shrinker, and you shrinking down to comic page size.
        const t = Math.min(1, elapsed / ZAP_MS);
        const size = 110 - 94 * (1 - (1 - t) ** 3);
        ctx.strokeStyle = `rgba(120, 255, 200, ${0.9 - 0.6 * t})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(DRAWER.x + 106, DRAWER.y + 27);
        ctx.lineTo(YOU.x, YOU.y - size / 2);
        ctx.stroke();
        drawYou(YOU.x, YOU.y, size);
        if (t < 0.25) {
          ctx.fillStyle = `rgba(200, 255, 230, ${0.6 * (1 - t / 0.25)})`;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.fillStyle = "#78ffc8";
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 5;
        ctx.font = "bold 54px 'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText("ZAP!", YOU.x - 120, YOU.y - 150);
        ctx.fillText("ZAP!", YOU.x - 120, YOU.y - 150);
      }
      if (scene === "room" && !keypadOpen) {
        if (tiny) drawCaption("You're as small as a comic page now. Climb into the comic box!", elapsed / 1000);
        else if (comicDone) drawCaption("Now you know how to get out.", elapsed / 1000);
        else if (collected === 0) drawCaption("Somebody tore up a comic book.", (now - roomStart) / 1000);
      }
      if (scene === "room" && keypadOpen) drawKeypad(now);
      if (scene === "room" && keyFound && !keyLock && !keypadOpen) drawKey(pointer.x + 18, pointer.y + 18, -0.5, 0.9);
    }
    drawFloaters(floaters, now);
    if (dark > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${dark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Comical",
    exitLine: "You unlocked both locks and walked out into…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
