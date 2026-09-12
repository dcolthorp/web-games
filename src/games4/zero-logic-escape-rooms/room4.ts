import {
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawVignette,
  inRect,
  lerp,
  line,
  poly,
  roundRect,
  updateDust,
  type Dust,
  type Point,
  type Room,
} from "./engine";
import { sounds } from "./sound";

// Escape Room 4: Chalkboard. All there is is a chalkboard that says 1 + 1 = ?.
// Click it to zoom in (Back, or Esc, zooms out again). Drag the 1s, the + and the two bars of the = into a
// window: the 1s are the sides, the bars go top and bottom, and the + is the
// cross in the middle. Tap a piece to turn it. Then the leftover goes ? ! : —
// tap the curl to straighten it into a line, tap the line to shrink it into a
// dot, tap both dots to make them bigger, and drag one onto the other to make a button.
// Press the button and the chalkboard explodes. Behind it is a real window.
// Click it and you fly into the sun and out into a cutscene of walking through
// the grass where nothing happens, except spikes. Jump them (click or Space)
// until it ends. Hit one and the walk starts over.

type Scene = "room" | "zoom" | "board" | "unzoom" | "boom" | "window" | "leaving" | "walk" | "escaped";
type Kind = "one" | "plus" | "bar" | "curl" | "line" | "dot" | "bigDot" | "button";

interface Piece {
  kind: Kind;
  x: number;
  y: number;
  // Quarter turns. Tapping 1s, bars and the + adds one.
  turns: number;
  snapped: boolean;
  // When it last turned or changed kind, for the animation.
  changedAt: number;
  wiggleAt: number;
}

// A piece of the exploded chalkboard flying at the camera.
interface Chunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
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

// Where the chalkboard hangs in the room. It's the same shape as the canvas, so
// zooming in makes it fill the screen exactly, and close up it is drawn in
// canvas coordinates.
const BOARD = { x: 280, y: 90, w: 400, h: 250 };
const FRAME = 26;
const TRAY_TOP = H - 44;
// Sits on the chalk tray past the eraser, where no chalk piece can be dragged.
const BACK_BUTTON = { x: W - 118, y: TRAY_TOP + 8, w: 100, h: 30 };

const CHALK = "rgba(246, 246, 240, 0.93)";
const RED_CHALK = "#ef6f6c";
const CHALK_W = 11;
const L = 130; // how long the strokes of the 1, + and = are
const DOT_R = 9;
const BIG_R = 24;
const SNAP = 40;

// Half the size of what you can grab on each kind of piece, before turning.
const HIT: Record<Kind, [number, number]> = {
  one: [28, L / 2],
  bar: [L / 2, 20],
  plus: [L / 2, L / 2],
  curl: [40, 52],
  line: [22, 52],
  dot: [24, 24],
  bigDot: [BIG_R + 8, BIG_R + 8],
  button: [54, 54],
};

// The curl of the question mark, and the straight line it turns into, are both
// HOOK_LEN tall and centered on the piece.
const HOOK_LEN = 92;
const HOOK = hookPoints();
// The line of the ! shrinks this far down, so its dot and the other dot make a :.
const COLON_SHIFT = 30;

// The real window behind the chalkboard, and the pane you climb out through.
const WIN = { x: 260, y: 70, w: 440, h: 400 };
const EXIT: Point = { x: WIN.x + WIN.w * 0.75, y: WIN.y + WIN.h * 0.25 };

const CHUNK_COLS = 6;
const CHUNK_ROWS = 4;
const CHUNK_W = W / CHUNK_COLS;
const CHUNK_H = H / CHUNK_ROWS;

const ZOOM_MS = 1100;
const ZOOM_OUT_MS = 800;
const TURN_MS = 180;
const MORPH_MS = 350;
const WIGGLE_MS = 400;
const DUCK_MS = 1700;
const BOOM_MS = 1300;
const LEAVE_MS = 1500;

// The walk: a side view of the grass, with spikes coming at you.
const GROUND_Y = 440;
const PLAYER_X = 220;
const WALK_SPEED = 320;
const JUMP_V = 620;
const GRAVITY = 1800;
const SPIKE_W = 40;
const SPIKE_H = 44;
const LETTERBOX = 50;
const WALK_MS = 15000;
const SPIKES_FROM_MS = 2500; // nothing happens for a bit first
const CALM_END_MS = 2500; // and nothing at the end either

function hookPoints(): [number, number][] {
  const points: [number, number][] = [];
  // Over the top of a circle, from the left side round to the bottom right...
  const end = Math.PI * 2.4;
  for (let i = 0; i <= 22; i += 1) {
    const a = lerp(Math.PI * 0.95, end, i / 22);
    points.push([Math.cos(a) * 30, -16 + Math.sin(a) * 30]);
  }
  // ...then the tail down the middle.
  const endX = Math.cos(end) * 30;
  const endY = -16 + Math.sin(end) * 30;
  for (let i = 1; i <= 8; i += 1) points.push([lerp(endX, 0, i / 8), lerp(endY, HOOK_LEN / 2, i / 8)]);
  return points;
}

function newPiece(kind: Kind, x: number, y: number): Piece {
  return { kind, x, y, turns: 0, snapped: false, changedAt: -Infinity, wiggleAt: -Infinity };
}

function easeOut(from: number, now: number, ms: number): number {
  const t = clamp((now - from) / ms, 0, 1);
  return 1 - (1 - t) ** 3;
}

// How open an eye is: a blink every 3 seconds, and a double blink every third time.
function blinkScale(now: number): number {
  const t = now % 3000;
  const double = Math.floor(now / 3000) % 3 === 0;
  const phase = t < 160 ? t : double && t > 320 && t < 480 ? t - 320 : -1;
  return phase < 0 ? 1 : Math.max(0.12, Math.abs(Math.cos((phase / 160) * Math.PI)));
}

// Where the peeking eyes are looking: a quick glance one way, a hold, then the other way.
function lookX(now: number): number {
  const s = Math.sin(now / 1100);
  return 7 * Math.sign(s) * Math.min(1, Math.abs(s) * 3);
}

const isQuestionPart = (kind: Kind): boolean => kind !== "one" && kind !== "plus" && kind !== "bar";

export function createChalkboardRoom(escape: () => void): Room {
  let scene: Scene = "room";
  let sceneStart = 0;
  let roomStart = 0;
  let pieces: Piece[] = [];
  let windowDone = false;
  let dragging: { piece: Piece; offX: number; offY: number; moved: number } | null = null;
  let chunks: Chunk[] = [];
  let dust: Dust[] = [];
  let jumpY = 0;
  let jumpV = 0;
  let spikes: number[] = [];
  let nextSpikeAt = 0;
  let duckAt = -Infinity;

  window.addEventListener("keydown", (event) => {
    if (scene === "board" && event.key === "Escape") {
      zoomOut(performance.now());
      return;
    }
    if (scene !== "walk" || (event.key !== " " && event.key !== "ArrowUp")) return;
    event.preventDefault();
    jump();
  });

  function setScene(next: Scene, now: number): void {
    scene = next;
    sceneStart = now;
  }

  function reset(startAt: number): void {
    scene = "room";
    sceneStart = startAt;
    roomStart = startAt;
    windowDone = false;
    dragging = null;
    duckAt = -Infinity;
    chunks = [];
    dust = [];
    // 1 + 1 = ?
    pieces = [
      newPiece("one", 150, 165),
      newPiece("plus", 315, 165),
      newPiece("one", 480, 165),
      newPiece("bar", 645, 143),
      newPiece("bar", 645, 187),
      newPiece("curl", 810, 143),
      newPiece("dot", 810, 225),
    ];
  }

  // ---------- hit tests ----------

  function pieceAt(p: Point): Piece | null {
    // Once part of the window is in place, the + holds it together and stays put.
    const plusLocked = pieces.some((piece) => piece.snapped);
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const piece = pieces[i];
      if (!piece || piece.snapped || (piece.kind === "plus" && plusLocked)) continue;
      const [w, h] = HIT[piece.kind];
      const [hw, hh] = piece.turns % 2 === 0 ? [w, h] : [h, w];
      if (Math.abs(p.x - piece.x) <= hw && Math.abs(p.y - piece.y) <= hh) return piece;
    }
    return null;
  }

  const overBoard = (p: Point): boolean => inRect(p, BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  const overWindow = (p: Point): boolean => inRect(p, WIN.x, WIN.y, WIN.w, WIN.h);
  const overBack = (p: Point): boolean => inRect(p, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h);

  // Step back from the chalkboard into the room. The pieces stay where they
  // are, so clicking the board again carries on where you left off.
  function zoomOut(now: number): void {
    dragging = null;
    sounds.whoosh(ZOOM_OUT_MS / 1000);
    setScene("unzoom", now);
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    const now = performance.now();
    if (scene === "walk") {
      jump();
      return;
    }
    if (scene === "room") {
      if (overBoard(p)) {
        sounds.whoosh(ZOOM_MS / 1000);
        setScene("zoom", now);
      }
      return;
    }
    if (scene === "window") {
      if (overWindow(p)) {
        sounds.whoosh(LEAVE_MS / 1000);
        setScene("leaving", now);
      }
      return;
    }
    if (scene !== "board") return;
    if (overBack(p)) {
      zoomOut(now);
      return;
    }

    const piece = pieceAt(p);
    if (!piece) return;
    // The ? won't do anything until the window is built.
    if (isQuestionPart(piece.kind) && !windowDone) {
      piece.wiggleAt = now;
      sounds.womp();
      return;
    }
    pieces = [...pieces.filter((other) => other !== piece), piece];
    dragging = { piece, offX: p.x - piece.x, offY: p.y - piece.y, moved: 0 };
  }

  function pointerMove(p: Point): void {
    if (!dragging) return;
    const { piece } = dragging;
    const x = clamp(p.x - dragging.offX, FRAME + 30, W - FRAME - 30);
    const y = clamp(p.y - dragging.offY, FRAME + 30, TRAY_TOP - 30);
    dragging.moved += Math.hypot(x - piece.x, y - piece.y);
    piece.x = x;
    piece.y = y;
  }

  function pointerUp(): void {
    if (!dragging) return;
    const { piece, moved } = dragging;
    dragging = null;
    const now = performance.now();
    if (moved < 6) tap(piece, now);
    else drop(piece, now);
  }

  function tap(piece: Piece, now: number): void {
    // Clicking the peeking eyes makes them duck instead of growing.
    if (peekingEyes().includes(piece)) {
      if (now - duckAt > DUCK_MS) {
        duckAt = now;
        sounds.whoosh(0.25);
      }
      return;
    }
    switch (piece.kind) {
      case "one":
      case "bar":
      case "plus":
        piece.turns += 1;
        piece.changedAt = now;
        sounds.tap();
        snapPieces();
        break;
      case "curl":
        morph(piece, "line", now);
        sounds.stroke();
        break;
      case "line":
        piece.y += COLON_SHIFT;
        morph(piece, "dot", now);
        sounds.stroke();
        break;
      case "dot":
        morph(piece, "bigDot", now);
        sounds.pop();
        break;
      case "bigDot":
        piece.wiggleAt = now;
        sounds.tap();
        break;
      case "button":
        boom(piece, now);
        break;
    }
  }

  function drop(piece: Piece, now: number): void {
    if (piece.kind === "bigDot") {
      // One big dot on top of the other makes a button.
      const other = pieces.find((o) => o !== piece && o.kind === "bigDot" && Math.hypot(o.x - piece.x, o.y - piece.y) < BIG_R * 1.5);
      if (other) {
        pieces = pieces.filter((o) => o !== piece);
        morph(other, "button", now);
        sounds.clack();
      }
      return;
    }
    snapPieces();
  }

  function morph(piece: Piece, kind: Kind, now: number): void {
    piece.kind = kind;
    piece.changedAt = now;
  }

  // The window is built around the +: a 1 standing up on each side of it, and
  // a bar lying across the top and bottom. Anything close enough clicks in.
  function snapPieces(): void {
    const plus = pieces.find((piece) => piece.kind === "plus");
    if (!plus || windowDone) return;
    const slots: { kind: Kind; x: number; y: number }[] = [
      { kind: "one", x: plus.x - L / 2, y: plus.y },
      { kind: "one", x: plus.x + L / 2, y: plus.y },
      { kind: "bar", x: plus.x, y: plus.y - L / 2 },
      { kind: "bar", x: plus.x, y: plus.y + L / 2 },
    ];
    for (const slot of slots) {
      if (pieces.some((p) => p.snapped && p.x === slot.x && p.y === slot.y)) continue;
      const piece = pieces.find(
        (p) => !p.snapped && p.kind === slot.kind && p.turns % 2 === 0 && Math.hypot(p.x - slot.x, p.y - slot.y) < SNAP
      );
      if (!piece) continue;
      piece.x = slot.x;
      piece.y = slot.y;
      piece.snapped = true;
      sounds.clack();
    }
    if (pieces.filter((p) => p.snapped).length === slots.length) {
      windowDone = true;
      sounds.chime();
    }
  }

  function boom(button: Piece, now: number): void {
    sounds.crash();
    sounds.crack();
    chunks = [];
    for (let row = 0; row < CHUNK_ROWS; row += 1) {
      for (let col = 0; col < CHUNK_COLS; col += 1) {
        const x = (col + 0.5) * CHUNK_W;
        const y = (row + 0.5) * CHUNK_H;
        const dx = x - button.x;
        const dy = y - button.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = 500 + Math.random() * 400;
        chunks.push({ x, y, vx: (dx / d) * speed, vy: (dy / d) * speed - 250, spin: (Math.random() - 0.5) * 8 });
      }
    }
    for (let i = 0; i < 90; i += 1) {
      dust.push({
        x: button.x,
        y: button.y,
        vx: (Math.random() - 0.5) * 1400,
        vy: (Math.random() - 0.7) * 1000,
        life: 1,
      });
    }
    setScene("boom", now);
  }

  function cursor(p: Point): string {
    if (scene === "room") return overBoard(p) ? "pointer" : "default";
    if (scene === "window") return overWindow(p) ? "pointer" : "default";
    if (scene !== "board") return "default";
    if (dragging) return "grabbing";
    if (overBack(p)) return "pointer";
    const piece = pieceAt(p);
    if (!piece) return "default";
    return piece.kind === "button" ? "pointer" : "grab";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    const elapsed = now - sceneStart;
    if (scene === "zoom" && elapsed >= ZOOM_MS) {
      setScene("board", now);
    } else if (scene === "unzoom" && elapsed >= ZOOM_OUT_MS) {
      setScene("room", now);
    } else if (scene === "boom" && elapsed >= BOOM_MS) {
      setScene("window", now);
    } else if (scene === "leaving" && elapsed >= LEAVE_MS) {
      startWalk(now);
    } else if (scene === "walk") {
      updateWalk(now, dt);
    }
    dust = updateDust(dust, dt);
  }

  // ---------- the walk ----------

  function startWalk(now: number): void {
    setScene("walk", now);
    jumpY = 0;
    jumpV = 0;
    spikes = [];
    nextSpikeAt = SPIKES_FROM_MS;
  }

  function jump(): void {
    if (jumpY > 0 || jumpV > 0) return;
    jumpV = JUMP_V;
    sounds.grab();
  }

  function updateWalk(now: number, dt: number): void {
    const elapsed = now - sceneStart;
    if (elapsed >= WALK_MS) {
      setScene("escaped", now);
      escape();
      return;
    }
    if (jumpY > 0 || jumpV > 0) {
      jumpV -= GRAVITY * dt;
      jumpY = Math.max(0, jumpY + jumpV * dt);
      if (jumpY === 0) jumpV = 0;
    }
    spikes = spikes.map((x) => x - WALK_SPEED * dt).filter((x) => x > -SPIKE_W);
    if (elapsed >= nextSpikeAt && elapsed < WALK_MS - CALM_END_MS) {
      spikes.push(W + SPIKE_W);
      nextSpikeAt = elapsed + lerp(900, 1700, Math.random());
    }
    // A spike is a triangle, so near its edges you only need to be a little off the ground.
    if (spikes.some((x) => jumpY < SPIKE_H * (1 - Math.abs(x - PLAYER_X) / (SPIKE_W / 2 + 8)))) {
      sounds.bonk();
      startWalk(now);
    }
  }

  // ---------- drawing ----------

  function drawHook(straight: number): void {
    ctx.beginPath();
    HOOK.forEach(([x, y], i) => {
      const lineY = lerp(-HOOK_LEN / 2, HOOK_LEN / 2, i / (HOOK.length - 1));
      const px = lerp(x, 0, straight);
      const py = lerp(y, lineY, straight);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // Two dots in the top two panes of the chalk window look like someone
  // peeking in, so they blink and look around, and duck when you click them.
  function peekingEyes(): Piece[] {
    const plus = pieces.find((piece) => piece.kind === "plus");
    if (!plus || !windowDone) return [];
    const { x, y } = plus;
    const dotIn = (left: number): Piece | undefined =>
      pieces.find(
        (p) => (p.kind === "dot" || p.kind === "bigDot") && p.x > left && p.x < left + L / 2 && p.y > y - L / 2 && p.y < y
      );
    const leftEye = dotIn(x - L / 2);
    const rightEye = dotIn(x);
    return leftEye && rightEye ? [leftEye, rightEye] : [];
  }

  // How far down the eyes have ducked: quickly down out of sight, a wait, then
  // slowly back up.
  function duckOffset(now: number): number {
    const t = now - duckAt;
    if (t < 0 || t > DUCK_MS) return 0;
    const down = L / 2 + BIG_R;
    if (t < 150) return down * (t / 150);
    if (t < 1300) return down;
    return down * (1 - easeOut(1300, t, 400));
  }

  // eyeFloor is the middle of the window when this piece is a peeking eye.
  function drawPiece(piece: Piece, now: number, eyeFloor: number | null): void {
    ctx.save();
    if (eyeFloor !== null) {
      // Ducking below the middle bar of the window hides them.
      ctx.beginPath();
      ctx.rect(0, 0, W, eyeFloor - CHALK_W / 2);
      ctx.clip();
      ctx.translate(lookX(now), duckOffset(now));
    }
    ctx.translate(piece.x, piece.y);
    let angle = (piece.turns * Math.PI) / 2;
    if (!isQuestionPart(piece.kind)) angle -= (1 - easeOut(piece.changedAt, now, TURN_MS)) * (Math.PI / 2);
    const wiggle = now - piece.wiggleAt;
    if (wiggle < WIGGLE_MS) angle += Math.sin(wiggle / 25) * 0.2 * (1 - wiggle / WIGGLE_MS);
    ctx.rotate(angle);

    ctx.strokeStyle = CHALK;
    ctx.fillStyle = CHALK;
    ctx.lineWidth = CHALK_W;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const e = easeOut(piece.changedAt, now, MORPH_MS);
    if (eyeFloor !== null) ctx.scale(1, blinkScale(now));

    switch (piece.kind) {
      case "one":
        line(0, -L / 2, 0, L / 2);
        line(0, -L / 2, -24, -L / 2 + 26);
        break;
      case "bar":
        line(-L / 2, 0, L / 2, 0);
        break;
      case "plus":
        line(-L / 2, 0, L / 2, 0);
        line(0, -L / 2, 0, L / 2);
        break;
      case "curl":
        drawHook(0);
        break;
      case "line":
        drawHook(e);
        break;
      case "dot": {
        // Squashing down out of the line it used to be.
        const r = lerp(CHALK_W / 2, DOT_R, e);
        if (e < 1) {
          ctx.lineWidth = r * 2;
          line(0, (-HOOK_LEN / 2 - COLON_SHIFT) * (1 - e), 0, (HOOK_LEN / 2 - COLON_SHIFT) * (1 - e));
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "bigDot": {
        const r = lerp(DOT_R, BIG_R, e) * (1 + Math.sin(e * Math.PI) * 0.15);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "button": {
        const pop = 1 + Math.sin(e * Math.PI) * 0.25 + Math.sin(now / 220) * 0.03;
        ctx.scale(pop, pop);
        ctx.beginPath();
        ctx.arc(0, 0, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = RED_CHALK;
        ctx.beginPath();
        ctx.arc(0, 0, 31, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 21, Math.PI * 1.1, Math.PI * 1.5);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  // The chalkboard close up, filling the canvas.
  function drawBoard(now: number): void {
    ctx.fillStyle = "#7b5230";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const slate = ctx.createLinearGradient(0, FRAME, 0, TRAY_TOP);
    slate.addColorStop(0, "#34503f");
    slate.addColorStop(1, "#273e31");
    ctx.fillStyle = slate;
    ctx.fillRect(FRAME, FRAME, W - FRAME * 2, TRAY_TOP - FRAME);

    // Old eraser smudges
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    for (const [x, y, rx, ry] of [
      [250, 420, 170, 45],
      [690, 360, 130, 60],
      [520, 110, 220, 35],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#6a4526";
    ctx.fillRect(0, TRAY_TOP, W, H - TRAY_TOP);
    ctx.fillStyle = "#8a5c34";
    ctx.fillRect(0, TRAY_TOP, W, 8);
    for (const [x, w, color] of [
      [150, 62, "#f4f4ee"],
      [236, 44, "#f5dc6a"],
      [300, 36, RED_CHALK],
    ] as const) {
      ctx.fillStyle = color;
      roundRect(x, TRAY_TOP + 16, w, 12, 5);
      ctx.fill();
    }
    ctx.fillStyle = "#3d3d44";
    roundRect(720, TRAY_TOP + 16, 110, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#c9a26b";
    roundRect(720, TRAY_TOP + 6, 110, 12, 3);
    ctx.fill();

    const eyes = peekingEyes();
    const middle = pieces.find((piece) => piece.kind === "plus")?.y ?? 0;
    for (const piece of pieces) drawPiece(piece, now, eyes.includes(piece) ? middle : null);
  }

  function drawRoomView(now: number): void {
    drawRoomBox(PALETTE);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(BOARD.x + 8, BOARD.y + 10, BOARD.w, BOARD.h);
    ctx.save();
    ctx.translate(BOARD.x, BOARD.y);
    ctx.scale(BOARD.w / W, BOARD.h / H);
    drawBoard(now);
    ctx.restore();
  }

  // What was behind the chalkboard the whole time.
  function drawWindowScene(now: number): void {
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, PALETTE.wallTop);
    wall.addColorStop(1, PALETTE.wallBottom);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h);
    sky.addColorStop(0, "#5eaef7");
    sky.addColorStop(1, "#cde9ff");
    ctx.fillStyle = sky;
    ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);

    const glow = ctx.createRadialGradient(EXIT.x, EXIT.y, 10, EXIT.x, EXIT.y, 120);
    glow.addColorStop(0, "rgba(255, 245, 190, 0.8)");
    glow.addColorStop(1, "rgba(255, 245, 190, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.fillStyle = "#fff4b0";
    ctx.beginPath();
    ctx.arc(EXIT.x, EXIT.y, 34, 0, Math.PI * 2);
    ctx.fill();

    // One cloud drifting past
    drawCloud(WIN.x - 100 + ((now / 30) % (WIN.w + 200)), WIN.y + 150);

    ctx.fillStyle = "#4fa84b";
    ctx.beginPath();
    ctx.ellipse(WIN.x + 380, WIN.y + WIN.h + 50, 260, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5fbf5a";
    ctx.beginPath();
    ctx.ellipse(WIN.x + 130, WIN.y + WIN.h + 40, 300, 130, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    poly([WIN.x + 40, WIN.y + WIN.h], [WIN.x + 130, WIN.y + WIN.h], [WIN.x + 280, WIN.y], [WIN.x + 190, WIN.y]);
    ctx.restore();

    // The frame is the same 1, +, 1, = window, made of wood this time.
    const F = 18;
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(WIN.x - F, WIN.y - F, WIN.w + F * 2, F);
    ctx.fillRect(WIN.x - F, WIN.y + WIN.h, WIN.w + F * 2, F);
    ctx.fillRect(WIN.x - F, WIN.y, F, WIN.h);
    ctx.fillRect(WIN.x + WIN.w, WIN.y, F, WIN.h);
    ctx.fillRect(WIN.x + WIN.w / 2 - 6, WIN.y, 12, WIN.h);
    ctx.fillRect(WIN.x, WIN.y + WIN.h / 2 - 6, WIN.w, 12);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(WIN.x - F, WIN.y - F, WIN.w + F * 2, WIN.h + F * 2);
    ctx.strokeRect(WIN.x, WIN.y, WIN.w, WIN.h);

    ctx.fillStyle = "#e4ddcf";
    ctx.fillRect(WIN.x - F - 20, WIN.y + WIN.h + F, WIN.w + F * 2 + 40, 16);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(WIN.x - F - 20, WIN.y + WIN.h + F + 16, WIN.w + F * 2 + 40, 8);
  }

  function drawCloud(x: number, y: number): void {
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    for (const [dx, dy, r] of [
      [0, 0, 26],
      [30, -12, 32],
      [62, 0, 24],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSpike(x: number): void {
    // Pokes up out of the grass as it comes.
    const h = SPIKE_H * clamp((760 - x) / 100, 0, 1);
    if (h <= 0) return;
    ctx.fillStyle = "#9aa3ab";
    poly([x - SPIKE_W / 2, GROUND_Y + 4], [x, GROUND_Y - h], [x + SPIKE_W / 2, GROUND_Y + 4]);
    ctx.strokeStyle = "#4b5359";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawWalker(scroll: number): void {
    const feet = GROUND_Y - jumpY;
    const hip = feet - 34;
    const neck = hip - 36;
    const swing = jumpY > 0 ? 0.6 : Math.sin(scroll / 22) * 0.55;

    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, GROUND_Y + 6, Math.max(8, 26 - jumpY / 6), 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#222";
    ctx.fillStyle = "#222";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const limb = (x: number, y: number, angle: number, len: number): void =>
      line(x, y, x + Math.sin(angle) * len, y + Math.cos(angle) * len);
    limb(PLAYER_X, hip, swing, 36);
    limb(PLAYER_X, hip, -swing, 36);
    line(PLAYER_X, hip, PLAYER_X, neck);
    limb(PLAYER_X, neck + 6, -swing * 0.8, 30);
    limb(PLAYER_X, neck + 6, swing * 0.8, 30);
    ctx.beginPath();
    ctx.arc(PLAYER_X, neck - 14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = "butt";
  }

  function drawWalk(now: number): void {
    const elapsed = now - sceneStart;
    const scroll = (elapsed / 1000) * WALK_SPEED;

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, "#5eaef7");
    sky.addColorStop(1, "#cde9ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.fillStyle = "#fff4b0";
    ctx.beginPath();
    ctx.arc(780, 130, 40, 0, Math.PI * 2);
    ctx.fill();

    // Clouds and hills go by slower than the grass, so they look far away.
    const wrap = W + 200;
    for (let i = 0; i < 3; i += 1) {
      drawCloud(((((i * 380 - scroll * 0.15) % wrap) + wrap) % wrap) - 100, 110 + i * 45);
    }
    ctx.fillStyle = "#5fbf5a";
    for (let i = -1; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(i * 520 + 260 - ((scroll * 0.4) % 520), GROUND_Y + 30, 300, 120, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#4fa84b";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    for (const x of spikes) drawSpike(x);
    ctx.fillStyle = "#6fcf5f";
    ctx.fillRect(0, GROUND_Y - 2, W, 10);
    ctx.strokeStyle = "#3f8f3c";
    ctx.lineWidth = 3;
    for (const [row, gap] of [
      [30, 36],
      [85, 52],
    ] as const) {
      for (let x = -(scroll % gap); x < W; x += gap) {
        line(x, GROUND_Y + row, x + 6, GROUND_Y + row - 12);
        line(x + 8, GROUND_Y + row, x + 10, GROUND_Y + row - 14);
      }
    }

    drawWalker(scroll);

    // Black bars, because it's a cutscene.
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, LETTERBOX);
    ctx.fillRect(0, H - LETTERBOX, W, LETTERBOX);
    drawCaption("Nothing happens.", elapsed / 1000);

    const whiteIn = 1 - elapsed / 600;
    if (whiteIn > 0) {
      ctx.fillStyle = `rgba(255, 252, 235, ${whiteIn})`;
      ctx.fillRect(0, 0, W, H);
    }
    const blackOut = (elapsed - (WALK_MS - 800)) / 800;
    if (blackOut > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, blackOut)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawBoom(now: number): void {
    const t = (now - sceneStart) / 1000;
    const shake = Math.max(0, 1 - t / 0.4) * 14;
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawWindowScene(now);

    ctx.globalAlpha = clamp((BOOM_MS / 1000 - t) / 0.5, 0, 1);
    for (const c of chunks) {
      ctx.save();
      ctx.translate(c.x + c.vx * t, c.y + c.vy * t + 700 * t * t);
      ctx.rotate(c.spin * t);
      const grow = 1 + t * 0.8;
      ctx.scale(grow, grow);
      ctx.beginPath();
      ctx.rect(-CHUNK_W / 2, -CHUNK_H / 2, CHUNK_W, CHUNK_H);
      ctx.clip();
      ctx.translate(-c.x, -c.y);
      drawBoard(now);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    drawDust(dust, "#f4f4ee");
    ctx.restore();

    if (t < 0.2) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - t / 0.2)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function draw(now: number): void {
    const elapsed = now - sceneStart;

    if (scene === "room" || scene === "zoom" || scene === "unzoom") {
      // Zooming out is zooming in played backwards.
      const t =
        scene === "zoom" ? clamp(elapsed / ZOOM_MS, 0, 1) : scene === "unzoom" ? 1 - clamp(elapsed / ZOOM_OUT_MS, 0, 1) : 0;
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const k = lerp(1, W / BOARD.w, e);
      ctx.save();
      ctx.scale(k, k);
      ctx.translate(-lerp(0, BOARD.x, e), -lerp(0, BOARD.y, e));
      drawRoomView(now);
      ctx.restore();
      ctx.globalAlpha = 1 - e;
      drawVignette();
      ctx.globalAlpha = 1;
      if (scene === "room") drawCaption("Just a chalkboard.", (now - roomStart) / 1000);
      return;
    }
    if (scene === "board") {
      drawBoard(now);
      // Only close up. The little chalkboard in the room doesn't get one.
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 7);
      ctx.fill();
      ctx.fillStyle = "#f4f4ee";
      ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2 + 1);
      return;
    }
    if (scene === "boom") {
      drawBoom(now);
      return;
    }

    if (scene === "walk") {
      drawWalk(now);
      return;
    }
    if (scene === "escaped") {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return;
    }

    ctx.save();
    let glare = 0;
    if (scene === "leaving") glare = diveInto(EXIT.x, EXIT.y, clamp(elapsed / LEAVE_MS, 0, 1));
    drawWindowScene(now);
    ctx.restore();
    if (scene === "window") drawCaption("A real window.", elapsed / 1000);
    // Flying into the sun goes white, not dark.
    if (glare > 0) {
      ctx.fillStyle = `rgba(255, 252, 235, ${glare})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Chalkboard",
    exitLine: "You made it across the spiky grass and ended up in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
