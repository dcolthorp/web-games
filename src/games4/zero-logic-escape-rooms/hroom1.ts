import {
  BACK,
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
import { FLOAT_MS, drawFloaters, drawNotes, type Floater } from "./hundred";
import { createMirrorMaze } from "./mirrorMaze";
import { sounds } from "./sound";

// Hundred Logic Escape Room 1: The Room With Nothing. Still no door and no
// window, but there's a table, and you know karate. Chop the table in half,
// keep chopping the pieces until there's enough wood for a pickaxe, make the
// pickaxe, and mine your way out through the wall. Hit the mirror with the
// pickaxe instead and it shatters, and behind it is a mirror maze bonus level.

type Stage = "chop" | "crafting" | "mine" | "hole" | "leaving" | "escaped" | "bonusIn" | "bonus";

interface Wood {
  x: number;
  y: number;
  // In plank lengths: the whole table is 8, then 4, 2, and 1.
  size: number;
  angle: number;
}

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
const TABLE = { left: 470, right: 730, top: 400, thickness: 18, legBottom: 500 };
const TABLE_SIZE = 8;
const PLANK_UNIT = 26;
const PIECES_NEEDED = 5;
const MINE_HITS = 6;
const MINE_REACH = 70;
const HOLE_R = 70;
const MIRROR_HITS = 3;
const BONUS_IN_MS = 900;
const CRAFT_BUTTON = { x: W - 262, y: H - 68, w: 238, h: 48 };
const CRAFT_AT: Point = { x: W / 2, y: 300 };

const CHOP_MS = 220;
const SWING_MS = 220;
const CRAFT_MS = 900;
const HOLE_MS = 350;
const LEAVE_MS = 1500;

export function createHundredNothingRoom(escape: () => void): Room {
  let stage: Stage = "chop";
  let stageStart = 0;
  let roomStart = 0;
  let wood: Wood[] = [];
  let craftFrom: Wood[] = [];
  let chopAt = -Infinity;
  let mineSpot: Point | null = null;
  let hits = 0;
  let hitAt = -Infinity;
  let floaters: Floater[] = [];
  let dust: Dust[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };
  let mirrorHits = 0;
  let stageBeforeBonus: Stage = "mine";
  // Leaving the maze puts you back in the room, still holding the pickaxe.
  const maze = createMirrorMaze(() => setStage(stageBeforeBonus, performance.now()));

  function setStage(next: Stage, now: number): void {
    stage = next;
    stageStart = now;
  }

  function reset(startAt: number): void {
    stage = "chop";
    stageStart = startAt;
    roomStart = startAt;
    wood = [{ x: (TABLE.left + TABLE.right) / 2, y: 450, size: TABLE_SIZE, angle: 0 }];
    craftFrom = [];
    chopAt = -Infinity;
    mineSpot = null;
    hits = 0;
    hitAt = -Infinity;
    mirrorHits = 0;
    floaters = [];
    dust = [];
  }

  const tableStanding = (): boolean => wood.some((w) => w.size === TABLE_SIZE);
  const enoughWood = (): boolean => !tableStanding() && wood.length >= PIECES_NEEDED;

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(60, y), start: now });
  }

  function puff(at: Point, count: number, spread = 220): void {
    for (let i = 0; i < count; i += 1) {
      dust.push({ x: at.x, y: at.y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * 180, life: 0.8 });
    }
  }

  // ---------- hit tests ----------

  function woodAt(p: Point): Wood | null {
    for (let i = wood.length - 1; i >= 0; i -= 1) {
      const w = wood[i];
      if (!w) continue;
      if (w.size === TABLE_SIZE) {
        if (inRect(p, TABLE.left, TABLE.top - 12, TABLE.right - TABLE.left, TABLE.legBottom - TABLE.top + 12)) return w;
      } else if (Math.abs(p.x - w.x) <= (w.size * PLANK_UNIT) / 2 + 10 && Math.abs(p.y - w.y) <= 22) {
        return w;
      }
    }
    return null;
  }

  const overCraftButton = (p: Point): boolean =>
    stage === "chop" && enoughWood() && inRect(p, CRAFT_BUTTON.x, CRAFT_BUTTON.y, CRAFT_BUTTON.w, CRAFT_BUTTON.h);
  const overBackWall = (p: Point): boolean => inRect(p, BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top - 14);
  const overHole = (p: Point): boolean => mineSpot !== null && Math.hypot(p.x - mineSpot.x, p.y - mineSpot.y) < HOLE_R;
  const overMirror = (p: Point): boolean => inRect(p, MIRROR.x - 12, MIRROR.y - 12, MIRROR.w + 24, MIRROR.h + 24);
  const mirrorBroken = (): boolean => mirrorHits >= MIRROR_HITS;

  // ---------- input ----------

  // A karate chop splits a piece of wood into two pieces half as long.
  function chop(piece: Wood, p: Point, now: number): void {
    chopAt = now;
    if (piece.size <= 1) {
      sounds.tink();
      say("That piece is too small to chop.", p.x, p.y - 50, now);
      return;
    }
    sounds.crack();
    sounds.thunk();
    say("HI-YAH!", p.x, p.y - 60, now);
    puff(p, 14);
    wood = wood.filter((w) => w !== piece);
    const half = piece.size / 2;
    const wasTable = piece.size === TABLE_SIZE;
    for (const dir of [-1, 1]) {
      wood.push({
        x: clamp(piece.x + dir * (wasTable ? 80 : (half * PLANK_UNIT) / 2 + 14), 160, 800),
        y: clamp(wasTable ? 505 + Math.random() * 40 : piece.y + (Math.random() - 0.5) * 40, 470, 565),
        size: half,
        angle: (Math.random() - 0.5) * 0.5,
      });
    }
    if (enoughWood()) say("That's enough wood for a pickaxe.", W / 2, 150, now);
  }

  // The pickaxe cracks the mirror, and the third hit shatters it. Once it's
  // broken, clicking it goes into the mirror maze behind it.
  function hitMirror(p: Point, now: number): void {
    hitAt = now;
    if (mirrorBroken()) {
      stageBeforeBonus = stage;
      sounds.whoosh(BONUS_IN_MS / 1000);
      setStage("bonusIn", now);
      return;
    }
    mirrorHits += 1;
    if (mirrorBroken()) {
      sounds.crash();
      for (let i = 0; i < 40; i += 1) {
        dust.push({
          x: MIRROR.x + Math.random() * MIRROR.w,
          y: MIRROR.y + Math.random() * MIRROR.h,
          vx: (Math.random() - 0.5) * 300,
          vy: -Math.random() * 200,
          life: 1,
        });
      }
      say("There's something behind the mirror.", MIRROR.x + MIRROR.w / 2, MIRROR.y - 20, now);
    } else {
      sounds.crack();
      puff(p, 6, 200);
    }
  }

  function mine(p: Point, now: number): void {
    if (overMirror(p)) {
      hitMirror(p, now);
      return;
    }
    if (!overBackWall(p)) {
      say("Mine the wall.", p.x, p.y - 40, now);
      return;
    }
    hitAt = now;
    if (mineSpot && Math.hypot(p.x - mineSpot.x, p.y - mineSpot.y) > MINE_REACH) {
      if (hits > 0) say("Keep hitting the same spot.", p.x, p.y - 60, now);
      mineSpot = null;
      hits = 0;
    }
    mineSpot ??= p;
    hits += 1;
    puff(mineSpot, 10, 260);
    if (hits >= MINE_HITS) {
      sounds.crash();
      puff(mineSpot, 40, 500);
      setStage("hole", now);
    } else {
      sounds.bonk();
      if (hits > MINE_HITS / 2) sounds.crack();
    }
  }

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (stage === "bonus") {
      maze.pointerDown(p);
      return;
    }
    if (stage === "chop") {
      if (overCraftButton(p)) {
        craftFrom = wood.map((w) => ({ ...w }));
        wood = [];
        sounds.pop();
        setStage("crafting", now);
        return;
      }
      const piece = woodAt(p);
      if (piece) {
        chop(piece, p, now);
      } else if (overBackWall(p)) {
        chopAt = now;
        sounds.bonk();
        say("Ow. The wall is harder than your hand.", p.x, p.y - 50, now);
      }
      return;
    }
    if (stage === "mine") {
      mine(p, now);
      return;
    }
    if (stage === "hole" && overMirror(p)) {
      hitMirror(p, now);
      return;
    }
    if (stage === "hole" && overHole(p)) {
      sounds.whoosh(LEAVE_MS / 1000);
      setStage("leaving", now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
    if (stage === "bonus") maze.pointerMove(p);
  }

  function pointerUp(): void {}

  function cursor(p: Point): string {
    if (stage === "bonus") return maze.cursor(p);
    if (stage === "chop") return overCraftButton(p) ? "pointer" : "none";
    if (stage === "mine" || stage === "hole") {
      if (mirrorBroken() && overMirror(p)) return "pointer";
      if (stage === "hole" && overHole(p)) return "pointer";
      return "none";
    }
    return "default";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    if (stage === "bonus") {
      maze.update(now, dt);
      return;
    }
    const elapsed = now - stageStart;
    if (stage === "crafting" && elapsed >= CRAFT_MS) {
      sounds.chime();
      setStage("mine", now);
    } else if (stage === "bonusIn" && elapsed >= BONUS_IN_MS) {
      setStage("bonus", now);
      maze.reset(now);
    } else if (stage === "leaving" && elapsed >= LEAVE_MS) {
      setStage("escaped", now);
      escape();
    }
    dust = updateDust(dust, dt);
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
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
    ctx.fillStyle = "#6b4423";
    roundRect(MIRROR.x - 12, MIRROR.y - 12, MIRROR.w + 24, MIRROR.h + 24, 14);
    ctx.fill();
    if (mirrorBroken()) {
      // Shattered: behind it, mirrors reflecting mirrors, going back and back.
      const cx = MIRROR.x + MIRROR.w / 2;
      const cy = MIRROR.y + MIRROR.h / 2;
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      ctx.fillStyle = "#0e1320";
      ctx.fillRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h);
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, MIRROR.h / 2);
      glow.addColorStop(0, `rgba(190, 225, 255, ${0.45 + 0.2 * pulse})`);
      glow.addColorStop(1, "rgba(190, 225, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h);
      ctx.strokeStyle = `rgba(207, 230, 242, ${0.35 + 0.2 * pulse})`;
      ctx.lineWidth = 3;
      for (let i = 1; i <= 5; i += 1) {
        const s = i * 9;
        ctx.strokeRect(MIRROR.x + s, MIRROR.y + s * 1.8, MIRROR.w - s * 2, MIRROR.h - s * 3.6);
      }
      // Jagged bits of glass still stuck in the frame
      ctx.fillStyle = "rgba(201, 220, 230, 0.85)";
      poly([MIRROR.x, MIRROR.y], [MIRROR.x + 34, MIRROR.y], [MIRROR.x, MIRROR.y + 44]);
      poly([MIRROR.x + MIRROR.w, MIRROR.y + MIRROR.h], [MIRROR.x + MIRROR.w - 40, MIRROR.y + MIRROR.h], [MIRROR.x + MIRROR.w, MIRROR.y + MIRROR.h - 30]);
      ctx.fillStyle = "rgba(20, 8, 36, 0.85)";
      roundRect(cx - 30, MIRROR.y + 8, 60, 18, 4);
      ctx.fill();
      ctx.fillStyle = "#f0e0ff";
      ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BONUS", cx, MIRROR.y + 17.5);
      return;
    }
    const glass = ctx.createLinearGradient(MIRROR.x, MIRROR.y, MIRROR.x + MIRROR.w, MIRROR.y + MIRROR.h);
    glass.addColorStop(0, "#c9dce6");
    glass.addColorStop(0.5, "#8fa9b8");
    glass.addColorStop(1, "#a9c1cd");
    ctx.fillStyle = glass;
    roundRect(MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 6;
    line(MIRROR.x + 20, MIRROR.y + 60, MIRROR.x + 60, MIRROR.y + 20);
    if (mirrorHits > 0) {
      // Cracks spreading out from the middle, longer with every hit.
      const cx = MIRROR.x + MIRROR.w / 2;
      const cy = MIRROR.y + MIRROR.h / 2;
      const reach = mirrorHits * 34;
      ctx.strokeStyle = "rgba(40, 55, 65, 0.8)";
      ctx.lineWidth = 2;
      for (let k = 0; k < 9; k += 1) {
        const a = (k / 9) * Math.PI * 2 + 0.2;
        const length = reach * (0.6 + 0.4 * (((k * 29) % 10) / 10));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * length * 0.5, cy + Math.sin(a) * length * 0.5);
        ctx.lineTo(cx + Math.cos(a + 0.3) * length, cy + Math.sin(a + 0.3) * length);
        ctx.stroke();
      }
    }
  }

  function drawTable(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse((TABLE.left + TABLE.right) / 2, TABLE.legBottom + 4, 150, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5e3a1c";
    const legH = TABLE.legBottom - TABLE.top - TABLE.thickness;
    ctx.fillRect(TABLE.left + 15, TABLE.top + TABLE.thickness, 16, legH);
    ctx.fillRect(TABLE.right - 31, TABLE.top + TABLE.thickness, 16, legH);
    ctx.fillStyle = "#9a6535";
    ctx.fillRect(TABLE.left, TABLE.top, TABLE.right - TABLE.left, TABLE.thickness);
    ctx.fillStyle = "#b07a45";
    ctx.fillRect(TABLE.left, TABLE.top, TABLE.right - TABLE.left, 5);
    ctx.strokeStyle = "#3f2712";
    ctx.lineWidth = 2;
    ctx.strokeRect(TABLE.left, TABLE.top, TABLE.right - TABLE.left, TABLE.thickness);
  }

  function drawPlank(x: number, y: number, size: number, angle: number, scale = 1): void {
    const length = size * PLANK_UNIT;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(-length / 2 + 3, 5, length, 12);
    ctx.fillStyle = "#9a6535";
    ctx.fillRect(-length / 2, -7, length, 14);
    ctx.fillStyle = "#b07a45";
    ctx.fillRect(-length / 2, -7, length, 4);
    ctx.strokeStyle = "#3f2712";
    ctx.lineWidth = 2;
    ctx.strokeRect(-length / 2, -7, length, 14);
    ctx.restore();
  }

  // A wooden pickaxe with the middle of its head at (x, y).
  function drawPickaxe(x: number, y: number, angle: number, scale = 1): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#3f2712";
    ctx.lineWidth = 13;
    line(0, 0, 0, 84);
    ctx.strokeStyle = "#9a6535";
    ctx.lineWidth = 9;
    line(0, 0, 0, 84);
    for (const [color, width] of [
      ["#3f2712", 17],
      ["#b07a45", 12],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(0, 38, 44, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }

  // Your hand, flat and sideways for a karate chop. The edge is at (x, y).
  function drawHand(x: number, y: number, now: number): void {
    const t = (now - chopAt) / CHOP_MS;
    const down = t >= 0 && t < 1 ? Math.sin(t * Math.PI) * 22 : 0;
    ctx.save();
    ctx.translate(x, y + down);
    ctx.rotate(-0.25);
    ctx.fillStyle = "#3d7bd9";
    ctx.fillRect(-11, -72, 22, 22);
    ctx.fillStyle = "#f1c27d";
    ctx.strokeStyle = "#8a5a2b";
    ctx.lineWidth = 2;
    roundRect(-10, -54, 20, 56, 9);
    ctx.fill();
    ctx.stroke();
    roundRect(-17, -32, 10, 22, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCracks(): void {
    if (!mineSpot || hits === 0 || stage !== "mine") return;
    const reach = (hits / MINE_HITS) * 70;
    ctx.strokeStyle = "rgba(20, 15, 25, 0.8)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + 0.35;
      const length = reach * (0.6 + 0.4 * (((k * 37) % 10) / 10));
      const bend = a + 0.35 * (k % 2 === 0 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(mineSpot.x, mineSpot.y);
      ctx.lineTo(mineSpot.x + Math.cos(a) * length * 0.5, mineSpot.y + Math.sin(a) * length * 0.5);
      ctx.lineTo(mineSpot.x + Math.cos(bend) * length, mineSpot.y + Math.sin(bend) * length);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
  }

  // The hole you mined, with daylight on the other side.
  function drawHole(now: number): void {
    if (!mineSpot || (stage !== "hole" && stage !== "leaving")) return;
    const grow = stage === "hole" ? Math.min(1, (now - stageStart) / HOLE_MS) : 1;
    const { x, y } = mineSpot;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const r = (HOLE_R - 12 + ((i * 53) % 20)) * grow;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.strokeStyle = "#4b3f55";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.clip();
    const outside = ctx.createLinearGradient(0, y - HOLE_R, 0, y + HOLE_R);
    outside.addColorStop(0, "#8fd0ff");
    outside.addColorStop(0.65, "#dff2ff");
    outside.addColorStop(0.65, "#6fcf5f");
    outside.addColorStop(1, "#4fa84b");
    ctx.fillStyle = outside;
    ctx.fillRect(x - HOLE_R, y - HOLE_R, HOLE_R * 2, HOLE_R * 2);
    ctx.fillStyle = "#fff4b0";
    ctx.beginPath();
    ctx.arc(x + 28, y - 30, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrafting(now: number): void {
    if (stage !== "crafting") return;
    const t = Math.min(1, (now - stageStart) / CRAFT_MS);
    const e = t * t;
    for (const w of craftFrom) {
      drawPlank(lerp(w.x, CRAFT_AT.x, e), lerp(w.y, CRAFT_AT.y, e), w.size, w.angle + e * 6, 1 - e * 0.8);
    }
    if (t > 0.6) drawPickaxe(CRAFT_AT.x, CRAFT_AT.y - 40, 0.4, ((t - 0.6) / 0.4) * 1.6);
  }

  function drawCraftButton(now: number): void {
    if (stage !== "chop" || !enoughWood()) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 250);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    roundRect(CRAFT_BUTTON.x, CRAFT_BUTTON.y, CRAFT_BUTTON.w, CRAFT_BUTTON.h, 10);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 210, 63, ${0.6 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Make a pickaxe", CRAFT_BUTTON.x + CRAFT_BUTTON.w / 2, CRAFT_BUTTON.y + CRAFT_BUTTON.h / 2 + 1);
  }

  function draw(now: number): void {
    if (stage === "bonus") {
      maze.draw(now);
      return;
    }
    const elapsed = now - stageStart;
    ctx.save();
    let fade = 0;
    if (stage === "leaving" && mineSpot) fade = diveInto(mineSpot.x, mineSpot.y, Math.min(1, elapsed / LEAVE_MS));
    if (stage === "bonusIn") {
      fade = diveInto(MIRROR.x + MIRROR.w / 2, MIRROR.y + MIRROR.h / 2, Math.min(1, elapsed / BONUS_IN_MS));
    }

    drawRoomBox(PALETTE);
    drawBulb();
    drawMirror(now);
    drawCracks();
    drawHole(now);
    for (const w of wood) {
      if (w.size === TABLE_SIZE) drawTable();
      else drawPlank(w.x, w.y, w.size, w.angle);
    }
    drawCrafting(now);
    drawDust(dust, "#e2c08f");
    ctx.restore();

    drawVignette();
    if (stage === "chop" && !tableStanding()) {
      drawNotes([`Wood pieces: ${Math.min(wood.length, PIECES_NEEDED)} / ${PIECES_NEEDED}`]);
    } else if (stage === "mine" || stage === "hole") {
      drawNotes(["You have: a wooden pickaxe", `Wall hits: ${Math.min(hits, MINE_HITS)} / ${MINE_HITS}`]);
    }
    if (stage === "chop" && tableStanding()) {
      drawCaption("No door. No window. But there's a table, and you know karate.", (now - roomStart) / 1000);
    }
    if (stage === "mine") drawCaption("Now mine your way out through the wall.", elapsed / 1000);
    drawCraftButton(now);
    drawFloaters(floaters, now);
    if (stage === "chop" && !overCraftButton(pointer)) drawHand(pointer.x, pointer.y, now);
    const pickaxeInHand = stage === "mine" || (stage === "hole" && !overHole(pointer) && !(mirrorBroken() && overMirror(pointer)));
    if (pickaxeInHand) {
      const t = (now - hitAt) / SWING_MS;
      const swing = t >= 0 && t < 1 ? Math.sin(t * Math.PI) : 0;
      drawPickaxe(pointer.x, pointer.y, 0.5 - swing * 1.1);
    }

    if (fade > 0 || stage === "escaped") {
      ctx.fillStyle = `rgba(0, 0, 0, ${stage === "escaped" ? 1 : fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "The Room With Nothing",
    exitLine: "You mined your way out through the wall and came out in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
