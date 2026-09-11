import {
  BACK,
  H,
  W,
  ctx,
  diveInto,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawVignette,
  inRect,
  lerp,
  line,
  roundRect,
  updateDust,
  type Dust,
  type Point,
  type Room,
} from "./engine";
import { sounds } from "./sound";

// Escape Room 1: a room with no door, no window, no nothing. The way out makes
// no sense on purpose: click the mirror, wait, take the saw that pops out, saw
// the table in half, push the halves back together, and they make a hole.

type Stage =
  | "mirror" // nothing has happened yet
  | "waiting" // mirror clicked, the saw is on its way
  | "saw" // the saw is sitting on top of the mirror
  | "holding" // the saw follows the cursor
  | "sawing" // cutting the table
  | "splitting" // the two halves fall apart
  | "halves" // push the halves back together
  | "hole" // the halves became a hole in the floor
  | "falling" // down the hole
  | "escaped";

type Half = "left" | "right";

const PALETTE = {
  ceiling: "#3b3542",
  side: "#5b5261",
  wallTop: "#766b7c",
  wallBottom: "#665c6c",
  floorBack: "#5a4331",
  floorFront: "#7a5a40",
  skirting: "#4d4452",
  floor: "boards",
} as const;

const MIRROR = { x: 200, y: 110, w: 120, h: 220 };
const SAW_REST: Point = { x: MIRROR.x + MIRROR.w / 2, y: MIRROR.y - 12 };

const TABLE = { left: 470, right: 730, top: 400, thickness: 18, legBottom: 500, legWidth: 16 };
const TABLE_MID = (TABLE.left + TABLE.right) / 2;
const LEFT_LEG_X = TABLE.left + 15;
const RIGHT_LEG_X = TABLE.right - 15 - TABLE.legWidth;

const HOLE = { x: TABLE_MID, y: 515, rx: 120, ry: 32 };

const SAW_DELAY_MS = 5000;
const SAW_POP_MS = 600;
const SAWING_MS = 1800;
const SPLIT_MS = 500;
const SPLIT_DISTANCE = 90;
const HALF_TILT = 0.12;
const HOLE_GROW_MS = 450;
const FALL_MS = 1500;

export function createNothingRoom(escape: () => void): Room {
  let stage: Stage = "mirror";
  let stageStart = 0;
  let roomStart = 0;
  let pointer: Point = { x: W / 2, y: H / 2 };
  let leftOffset = 0;
  let rightOffset = 0;
  let tilt = 0;
  let dragging: { half: Half; lastX: number; moved: number } | null = null;
  let sliding: Half | null = null;
  let dust: Dust[] = [];
  let lastStroke = 0;

  function setStage(next: Stage): void {
    stage = next;
    stageStart = performance.now();
  }

  function reset(startAt: number): void {
    stage = "mirror";
    stageStart = startAt;
    roomStart = startAt;
    leftOffset = 0;
    rightOffset = 0;
    tilt = 0;
    dragging = null;
    sliding = null;
    dust = [];
  }

  // ---------- hit tests ----------

  function overMirror(p: Point): boolean {
    return inRect(p, MIRROR.x - 12, MIRROR.y - 12, MIRROR.w + 24, MIRROR.h + 24);
  }

  function overSaw(p: Point): boolean {
    return inRect(p, SAW_REST.x - 70, SAW_REST.y - 30, 140, 50);
  }

  function overTable(p: Point): boolean {
    return inRect(p, TABLE.left - 10, TABLE.top - 20, TABLE.right - TABLE.left + 20, TABLE.legBottom - TABLE.top + 20);
  }

  function overHalf(p: Point): Half | null {
    const y = TABLE.top - 20;
    const h = TABLE.legBottom - TABLE.top + 20;
    if (inRect(p, TABLE.left + leftOffset - 10, y, TABLE_MID - TABLE.left + 10, h)) return "left";
    if (inRect(p, TABLE_MID + rightOffset, y, TABLE.right - TABLE_MID + 10, h)) return "right";
    return null;
  }

  function overHole(p: Point): boolean {
    const dx = (p.x - HOLE.x) / HOLE.rx;
    const dy = (p.y - HOLE.y) / HOLE.ry;
    return dx * dx + dy * dy <= 1.3;
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    if (stage === "mirror" && overMirror(p)) {
      sounds.tap();
      setStage("waiting");
    } else if (stage === "saw" && overSaw(p)) {
      sounds.grab();
      setStage("holding");
    } else if (stage === "holding" && overTable(p)) {
      setStage("sawing");
    } else if (stage === "halves") {
      const half = overHalf(p);
      if (half) {
        dragging = { half, lastX: p.x, moved: 0 };
        sliding = null;
      }
    } else if (stage === "hole" && overHole(p)) {
      sounds.whoosh(FALL_MS / 1000);
      setStage("falling");
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
    if (!dragging || stage !== "halves") return;
    const dx = p.x - dragging.lastX;
    dragging.lastX = p.x;
    dragging.moved += Math.abs(dx);
    // Horizontal only, and a half can never pass through the other one.
    if (dragging.half === "left") leftOffset = Math.max(-260, Math.min(rightOffset, leftOffset + dx));
    else rightOffset = Math.min(200, Math.max(leftOffset, rightOffset + dx));
    checkJoined();
  }

  function pointerUp(): void {
    if (!dragging) return;
    // A plain click on a half shoves it the rest of the way on its own.
    if (dragging.moved < 6 && stage === "halves") sliding = dragging.half;
    dragging = null;
  }

  function checkJoined(): void {
    if (stage !== "halves" || rightOffset - leftOffset > 2) return;
    dragging = null;
    sliding = null;
    sounds.thunk();
    setStage("hole");
  }

  function cursor(p: Point): string {
    if (stage === "mirror" && overMirror(p)) return "pointer";
    if (stage === "saw" && overSaw(p)) return "grab";
    if (stage === "holding" || stage === "sawing") return "none";
    if (stage === "halves") return dragging ? "grabbing" : overHalf(p) ? "grab" : "default";
    if (stage === "hole" && overHole(p)) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    const elapsed = now - stageStart;

    if (stage === "waiting" && elapsed >= SAW_DELAY_MS) {
      sounds.pop();
      setStage("saw");
    } else if (stage === "sawing") {
      if (now - lastStroke > 300) {
        lastStroke = now;
        sounds.stroke();
      }
      for (let i = 0; i < 3; i += 1) {
        dust.push({
          x: TABLE_MID + (Math.random() - 0.5) * 10,
          y: TABLE.top + cutDepth(elapsed),
          vx: (Math.random() - 0.5) * 180,
          vy: -Math.random() * 120,
          life: 1,
        });
      }
      if (elapsed >= SAWING_MS) {
        sounds.crack();
        setStage("splitting");
      }
    } else if (stage === "splitting") {
      const t = Math.min(1, elapsed / SPLIT_MS);
      const eased = 1 - (1 - t) ** 3;
      leftOffset = -SPLIT_DISTANCE * eased;
      rightOffset = SPLIT_DISTANCE * eased;
      tilt = HALF_TILT * eased;
      if (t >= 1) {
        sounds.thunk();
        setStage("halves");
      }
    } else if (stage === "halves" && sliding) {
      const step = 420 * dt;
      if (sliding === "left") leftOffset = Math.min(rightOffset, leftOffset + step);
      else rightOffset = Math.max(leftOffset, rightOffset - step);
      checkJoined();
    } else if (stage === "falling" && elapsed >= FALL_MS) {
      setStage("escaped");
      escape();
    }

    dust = updateDust(dust, dt);
  }

  function cutDepth(sawingElapsed: number): number {
    return Math.min(1, sawingElapsed / SAWING_MS) * TABLE.thickness;
  }

  // ---------- drawing ----------

  function drawBulb(): void {
    ctx.strokeStyle = "#1d1a20";
    ctx.lineWidth = 2;
    line(W / 2, BACK.top - 10, W / 2, 95);
    const glow = ctx.createRadialGradient(W / 2, 105, 4, W / 2, 105, 120);
    glow.addColorStop(0, "rgba(255, 230, 150, 0.45)");
    glow.addColorStop(1, "rgba(255, 230, 150, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 120, 0, 240, 230);
    ctx.fillStyle = "#fff3c4";
    ctx.beginPath();
    ctx.arc(W / 2, 105, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMirror(now: number): void {
    const elapsed = now - stageStart;
    let shakeX = 0;
    // In the last second before the saw arrives, the mirror starts rattling.
    if (stage === "waiting" && elapsed > SAW_DELAY_MS - 1000) {
      const strength = (elapsed - (SAW_DELAY_MS - 1000)) / 1000;
      shakeX = Math.sin(now / 25) * 3 * strength;
    }

    ctx.save();
    ctx.translate(shakeX, 0);

    ctx.fillStyle = "#6b4423";
    roundRect(MIRROR.x - 12, MIRROR.y - 12, MIRROR.w + 24, MIRROR.h + 24, 14);
    ctx.fill();
    ctx.fillStyle = "#8a5a30";
    roundRect(MIRROR.x - 6, MIRROR.y - 6, MIRROR.w + 12, MIRROR.h + 12, 10);
    ctx.fill();

    const glass = ctx.createLinearGradient(MIRROR.x, MIRROR.y, MIRROR.x + MIRROR.w, MIRROR.y + MIRROR.h);
    glass.addColorStop(0, "#c9dce6");
    glass.addColorStop(0.5, "#8fa9b8");
    glass.addColorStop(1, "#a9c1cd");
    ctx.fillStyle = glass;
    roundRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, 6);
    ctx.fill();

    ctx.save();
    roundRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, 6);
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 8;
    line(MIRROR.x + 20, MIRROR.y + 60, MIRROR.x + 60, MIRROR.y + 20);
    ctx.lineWidth = 4;
    line(MIRROR.x + 30, MIRROR.y + 90, MIRROR.x + 90, MIRROR.y + 30);

    // After a click, a glint keeps sweeping down the glass so you know something is up.
    if (stage === "waiting") {
      const sweep = ((elapsed % 1200) / 1200) * (MIRROR.h + 160) - 80;
      const shine = ctx.createLinearGradient(0, MIRROR.y + sweep - 40, 0, MIRROR.y + sweep + 40);
      shine.addColorStop(0, "rgba(255, 255, 255, 0)");
      shine.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
      shine.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = shine;
      ctx.fillRect(MIRROR.x, MIRROR.y + sweep - 40, MIRROR.w, 80);
    }
    ctx.restore();
    ctx.restore();
  }

  function drawSaw(x: number, y: number, angle: number, scale = 1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Blade: tall at the handle, narrowing to the tip, with teeth underneath.
    const blade = ctx.createLinearGradient(0, -18, 0, 14);
    blade.addColorStop(0, "#eef2f5");
    blade.addColorStop(1, "#9aa5ad");
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.moveTo(-70, 2);
    ctx.lineTo(-70, -6);
    ctx.lineTo(32, -18);
    ctx.lineTo(32, 12);
    const teeth = 14;
    for (let i = 0; i <= teeth; i += 1) {
      const tx = 32 - (102 * i) / teeth;
      const ty = 12 - (10 * i) / teeth;
      ctx.lineTo(tx, ty + (i % 2 === 0 ? 0 : 6));
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#5d666c";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#b5552b";
    roundRect(28, -24, 40, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#3a2a22";
    roundRect(40, -14, 18, 22, 7);
    ctx.fill();
    ctx.fillStyle = "#d9d9d9";
    for (const by of [-16, 12]) {
      ctx.beginPath();
      ctx.arc(34, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawSawForStage(now: number): void {
    const elapsed = now - stageStart;
    if (stage === "saw") {
      // Pops up out of the mirror, spins, and lands on top of the frame.
      const t = Math.min(1, elapsed / SAW_POP_MS);
      const y = lerp(MIRROR.y + MIRROR.h / 2, SAW_REST.y, t) - 150 * Math.sin(Math.PI * t);
      const bob = t >= 1 ? Math.sin(now / 300) * 2 : 0;
      drawSaw(SAW_REST.x, y + bob, Math.PI * 2 * t, Math.min(1, t * 3));
    } else if (stage === "holding") {
      drawSaw(pointer.x, pointer.y, -0.35);
    } else if (stage === "sawing") {
      const stroke = Math.sin((elapsed / 350) * Math.PI * 2) * 38;
      drawSaw(TABLE_MID + 20 + stroke, TABLE.top - 12 + cutDepth(elapsed), 0.15);
    }
  }

  function drawTableHalf(half: Half, offset: number, angle: number): void {
    const left = half === "left";
    const topLeft = left ? TABLE.left : TABLE_MID;
    const topRight = left ? TABLE_MID : TABLE.right;
    const legX = left ? LEFT_LEG_X : RIGHT_LEG_X;
    const pivotX = legX + TABLE.legWidth / 2 + offset;

    ctx.save();
    // Each half keeps only one leg, so it tips over toward the cut end.
    ctx.translate(pivotX, TABLE.legBottom);
    ctx.rotate(left ? angle : -angle);
    ctx.translate(-pivotX, -TABLE.legBottom);
    ctx.translate(offset, 0);

    ctx.fillStyle = "#5e3a1c";
    ctx.fillRect(legX, TABLE.top + TABLE.thickness, TABLE.legWidth, TABLE.legBottom - TABLE.top - TABLE.thickness);
    ctx.fillStyle = "#9a6535";
    ctx.fillRect(topLeft, TABLE.top, topRight - topLeft, TABLE.thickness);
    ctx.fillStyle = "#b07a45";
    ctx.fillRect(topLeft, TABLE.top, topRight - topLeft, 5);
    ctx.strokeStyle = "#3f2712";
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft, TABLE.top, topRight - topLeft, TABLE.thickness);
    ctx.restore();
  }

  function drawTable(now: number): void {
    if (stage === "hole" || stage === "falling" || stage === "escaped") return;

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(TABLE_MID + (leftOffset + rightOffset) / 2, TABLE.legBottom + 4, 150 + (rightOffset - leftOffset) / 2, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const whole = stage === "mirror" || stage === "waiting" || stage === "saw" || stage === "holding" || stage === "sawing";
    drawTableHalf("left", leftOffset, tilt);
    drawTableHalf("right", rightOffset, tilt);

    if (whole) {
      // Cover the seam between the halves so it still reads as one table.
      ctx.fillStyle = "#9a6535";
      ctx.fillRect(TABLE_MID - 2, TABLE.top + 2, 4, TABLE.thickness - 4);
      ctx.fillStyle = "#b07a45";
      ctx.fillRect(TABLE_MID - 2, TABLE.top + 2, 4, 3);
    }

    if (stage === "sawing") {
      ctx.fillStyle = "#2a1a0c";
      ctx.fillRect(TABLE_MID - 1.5, TABLE.top, 3, cutDepth(now - stageStart));
    }
  }

  function drawHole(now: number): void {
    if (stage !== "hole" && stage !== "falling") return;
    const grow = stage === "hole" ? Math.min(1, (now - stageStart) / HOLE_GROW_MS) : 1;
    const pop = grow < 1 ? 1 + Math.sin(grow * Math.PI) * 0.25 : 1;

    ctx.save();
    ctx.translate(HOLE.x, HOLE.y);
    ctx.scale(grow * pop, grow * pop);
    ctx.fillStyle = "#2b1d12";
    ctx.beginPath();
    ctx.ellipse(0, 0, HOLE.rx + 10, HOLE.ry + 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const inside = ctx.createRadialGradient(0, 6, 4, 0, 0, HOLE.rx);
    inside.addColorStop(0, "#000");
    inside.addColorStop(1, "#140d08");
    ctx.fillStyle = inside;
    ctx.beginPath();
    ctx.ellipse(0, 0, HOLE.rx, HOLE.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Splinters from the table that got swallowed
    if (stage === "hole" && grow < 1) {
      ctx.fillStyle = "#9a6535";
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const r = 40 + grow * 140;
        ctx.fillRect(HOLE.x + Math.cos(a) * r, HOLE.y + Math.sin(a) * r * 0.4 - grow * 40, 10, 4);
      }
    }
  }

  function draw(now: number): void {
    ctx.save();
    let fade = 0;
    if (stage === "falling") {
      fade = diveInto(HOLE.x, HOLE.y, Math.min(1, (now - stageStart) / FALL_MS));
    }

    drawRoomBox(PALETTE);
    drawBulb();
    drawMirror(now);
    drawHole(now);
    drawTable(now);
    drawDust(dust, "#e2c08f");
    drawSawForStage(now);
    ctx.restore();

    drawVignette();
    if (stage === "mirror") drawCaption("No door. No window. No nothing.", (now - roomStart) / 1000);

    if (fade > 0 || stage === "escaped") {
      ctx.fillStyle = `rgba(0, 0, 0, ${stage === "escaped" ? 1 : fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "The Room With Nothing",
    exitLine: "You fell down the table hole and landed in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
