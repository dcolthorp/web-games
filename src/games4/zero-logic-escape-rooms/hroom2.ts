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
  line,
  poly,
  roundRect,
  updateDust,
  type Dust,
  type Point,
  type Room,
} from "./engine";
import { FLOAT_MS, drawFloaters, drawNotes, type Floater } from "./hundred";
import { sounds } from "./sound";
import { createToolWall } from "./toolWall";

// Hundred Logic Escape Room 2: Workbench. There's a vent on the wall, held on
// by four screws, and a screwdriver hanging on the pegboard. Take the
// screwdriver, unscrew the vent cover, and crawl out through the vent.
// There's also a door hidden under the paint on the wall. Scrape the paint off
// with a sheet of plywood from the bench, undo the door's bolt with the wrench
// from the pegboard, and behind it is a bonus level (toolWall.ts). You carry
// one thing at a time: picking up something else swaps, and clicking where a
// thing came from puts it back.

type Stage = "room" | "leaving" | "escaped" | "bonusIn" | "bonus";
type Held = "none" | "screwdriver" | "wrench" | "plywood";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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

const VENT: Rect = { x: 190, y: 220, w: 180, h: 120 };
const SCREWS: Point[] = [
  { x: VENT.x + 12, y: VENT.y + 12 },
  { x: VENT.x + VENT.w - 12, y: VENT.y + 12 },
  { x: VENT.x + 12, y: VENT.y + VENT.h - 12 },
  { x: VENT.x + VENT.w - 12, y: VENT.y + VENT.h - 12 },
];
const COVER_FLOOR_Y = 470;

const BENCH = { left: 560, right: 870, top: 372, thickness: 22, legBottom: 505 };
const PEGBOARD: Rect = { x: 600, y: 150, w: 240, h: 170 };
const SCREWDRIVER: Rect = { x: 752, y: 170, w: 34, h: 125 };
const WRENCH: Rect = { x: 636, y: 152, w: 70, h: 150 };
const PLYWOOD: Rect = { x: 600, y: 310, w: 260, h: 62 };

// The painted-over door, and the bolt holding it shut. It stops at the
// skirting board so the paint over it matches the wall exactly.
const DOOR: Rect = { x: 412, y: 186, w: 120, h: 200 };
const BOLT: Point = { x: DOOR.x + DOOR.w - 24, y: DOOR.y + 110 };
const PAINT_CELL = 10;
const PAINT_COLS = DOOR.w / PAINT_CELL;
const PAINT_ROWS = DOOR.h / PAINT_CELL;
const SCRAPE_R = 26;
const REVEAL_SHARE = 0.85;

const UNSCREW_MS = 650;
const COVER_MS = 650;
const BOLT_MS = 800;
const DOOR_OPEN_MS = 700;
const BONUS_IN_MS = 900;
const LEAVE_MS = 1500;

const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

const HELD_NAME: Record<Held, string> = {
  none: "",
  screwdriver: "a screwdriver",
  wrench: "a wrench",
  plywood: "a sheet of plywood",
};

export function createHundredWorkbenchRoom(escape: () => void): Room {
  let stage: Stage = "room";
  let stageStart = 0;
  let roomStart = 0;
  let held: Held = "none";
  // When each screw came out, or null while it's still in.
  let screwsOut: (number | null)[] = [];
  let coverFallAt: number | null = null;
  let scraped = new Set<number>();
  let scraping = false;
  let lastScrapeSound = 0;
  let wallNoteShown = false;
  let revealedAt: number | null = null;
  let boltAt: number | null = null;
  let boltClicked = false;
  let floaters: Floater[] = [];
  let dust: Dust[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };
  // Leaving the bonus level puts you back in the workbench room.
  const toolWall = createToolWall(() => setStage("room", performance.now()));

  function setStage(next: Stage, now: number): void {
    stage = next;
    stageStart = now;
  }

  function reset(startAt: number): void {
    stage = "room";
    stageStart = startAt;
    roomStart = startAt;
    held = "none";
    screwsOut = SCREWS.map(() => null);
    coverFallAt = null;
    // A little paint has already chipped off one corner of the door: the only clue.
    scraped = new Set([PAINT_COLS - 1, PAINT_COLS * 2 - 1, PAINT_COLS - 2]);
    scraping = false;
    wallNoteShown = false;
    revealedAt = null;
    boltAt = null;
    boltClicked = false;
    floaters = [];
    dust = [];
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(60, y), start: now });
  }

  const screwAt = (p: Point): number =>
    SCREWS.findIndex((s, i) => screwsOut[i] === null && Math.hypot(p.x - s.x, p.y - s.y) < 18);
  const screwsRemoved = (): number => screwsOut.filter((t) => t !== null).length;
  const ventOpen = (now: number): boolean => coverFallAt !== null && now - coverFallAt >= COVER_MS;
  const doorOpening = (now: number): number => (boltAt === null ? 0 : clamp((now - boltAt - BOLT_MS) / DOOR_OPEN_MS, 0, 1));

  // ---------- scraping ----------

  function scrape(p: Point, now: number): void {
    if (revealedAt !== null) return;
    if (!over(p, DOOR)) {
      if (!wallNoteShown) {
        wallNoteShown = true;
        say("Just wall under the paint here.", p.x, p.y - 40, now);
      }
      return;
    }
    for (let row = 0; row < PAINT_ROWS; row += 1) {
      for (let col = 0; col < PAINT_COLS; col += 1) {
        const cx = DOOR.x + (col + 0.5) * PAINT_CELL;
        const cy = DOOR.y + (row + 0.5) * PAINT_CELL;
        if (Math.hypot(cx - p.x, cy - p.y) <= SCRAPE_R) scraped.add(row * PAINT_COLS + col);
      }
    }
    if (now - lastScrapeSound > 140) {
      lastScrapeSound = now;
      sounds.paper();
      for (let i = 0; i < 4; i += 1) {
        dust.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 80, life: 0.7 });
      }
    }
    if (scraped.size >= PAINT_COLS * PAINT_ROWS * REVEAL_SHARE) {
      revealedAt = now;
      scraping = false;
      sounds.chime();
      say("There was a door under the paint!", DOOR.x + DOOR.w / 2, DOOR.y - 20, now);
    }
  }

  // ---------- input ----------

  function pickUp(item: Held): void {
    held = held === item ? "none" : item;
    if (item === "plywood") sounds.clack();
    else sounds.grab();
  }

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (stage === "bonus") {
      toolWall.pointerDown(p);
      return;
    }
    if (stage !== "room") return;

    if (over(p, SCREWDRIVER)) {
      pickUp("screwdriver");
      return;
    }
    if (over(p, WRENCH)) {
      pickUp("wrench");
      return;
    }
    if (over(p, PLYWOOD)) {
      pickUp("plywood");
      return;
    }

    const screw = screwAt(p);
    if (screw >= 0 && coverFallAt === null) {
      if (held === "screwdriver") {
        screwsOut[screw] = now;
        sounds.stroke();
      } else {
        sounds.tink();
        say(held === "wrench" ? "A wrench won't turn these screws." : "These screws need a screwdriver.", p.x, p.y - 40, now);
      }
      return;
    }
    if (over(p, VENT)) {
      if (ventOpen(now)) {
        sounds.whoosh(LEAVE_MS / 1000);
        setStage("leaving", now);
      } else if (coverFallAt === null) {
        sounds.tink();
        say(held === "screwdriver" ? "Take all four screws out first." : "The vent cover is screwed on.", VENT.x + VENT.w / 2, VENT.y - 20, now);
      }
      return;
    }

    if (over(p, DOOR)) {
      if (doorOpening(now) >= 1) {
        sounds.whoosh(BONUS_IN_MS / 1000);
        setStage("bonusIn", now);
      } else if (revealedAt === null) {
        if (held === "plywood") {
          scraping = true;
          wallNoteShown = false;
          scrape(p, now);
        }
      } else if (boltAt === null) {
        if (Math.hypot(p.x - BOLT.x, p.y - BOLT.y) < 24) {
          if (held === "wrench") {
            boltAt = now;
            sounds.creak();
          } else {
            sounds.tink();
            say(held === "screwdriver" ? "A screwdriver won't turn a bolt." : "That bolt needs a wrench.", BOLT.x, BOLT.y - 34, now);
          }
        } else {
          sounds.thunk();
          say("It's bolted shut.", DOOR.x + DOOR.w / 2, DOOR.y - 20, now);
        }
      }
      return;
    }

    if (held === "plywood" && inRect(p, BACK.left, BACK.top, BACK.right - BACK.left, BACK.bottom - BACK.top)) {
      scraping = true;
      wallNoteShown = false;
      scrape(p, now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
    if (stage === "bonus") toolWall.pointerMove(p);
    else if (scraping && held === "plywood" && stage === "room") scrape(p, performance.now());
  }

  function pointerUp(p: Point): void {
    if (stage === "bonus") toolWall.pointerUp?.(p);
    scraping = false;
  }

  function cursor(p: Point): string {
    if (stage === "bonus") return toolWall.cursor(p);
    if (stage !== "room") return "default";
    if (held !== "none") return "none";
    const now = performance.now();
    if ([SCREWDRIVER, WRENCH, PLYWOOD, VENT].some((r) => over(p, r)) || screwAt(p) >= 0) return "pointer";
    if (revealedAt !== null && over(p, DOOR)) return "pointer";
    return ventOpen(now) && over(p, VENT) ? "pointer" : "default";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    if (stage === "bonus") {
      toolWall.update(now, dt);
      return;
    }
    const elapsed = now - stageStart;
    if (coverFallAt === null && screwsOut.every((t) => t !== null && now - t >= UNSCREW_MS)) {
      coverFallAt = now;
      sounds.crash();
    }
    if (boltAt !== null && !boltClicked && now - boltAt >= BOLT_MS) {
      boltClicked = true;
      sounds.clack();
    }
    if (stage === "bonusIn" && elapsed >= BONUS_IN_MS) {
      setStage("bonus", now);
      toolWall.reset(now);
    } else if (stage === "leaving" && elapsed >= LEAVE_MS) {
      setStage("escaped", now);
      escape();
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

  // With the tip at (x, y).
  function drawScrewdriver(x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#aab3b8";
    ctx.fillRect(-3, -62, 6, 62);
    ctx.fillStyle = "#c9302c";
    roundRect(-9, -116, 18, 56, 6);
    ctx.fill();
    ctx.restore();
  }

  // With the jaw at (x, y).
  function drawWrench(x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#8d979c";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    line(0, 12, 0, 100);
    ctx.lineCap = "butt";
    ctx.fillStyle = "#8d979c";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(-6, -16, 12, 14);
    ctx.restore();
  }

  function drawPegboard(): void {
    ctx.fillStyle = "#b8926a";
    ctx.fillRect(PEGBOARD.x, PEGBOARD.y, PEGBOARD.w, PEGBOARD.h);
    ctx.fillStyle = "rgba(60, 40, 20, 0.45)";
    for (let y = PEGBOARD.y + 12; y < PEGBOARD.y + PEGBOARD.h; y += 16) {
      for (let x = PEGBOARD.x + 12; x < PEGBOARD.x + PEGBOARD.w; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#6e4f30";
    ctx.lineWidth = 3;
    ctx.strokeRect(PEGBOARD.x, PEGBOARD.y, PEGBOARD.w, PEGBOARD.h);

    if (held !== "wrench") {
      ctx.strokeStyle = "#8d979c";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      line(660, 180, 690, 290);
      ctx.lineCap = "butt";
      ctx.fillStyle = "#8d979c";
      ctx.beginPath();
      ctx.arc(657, 172, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8926a";
      ctx.fillRect(651, 154, 12, 16);
    }
    if (held !== "screwdriver") drawScrewdriver(769, 290, 0);
  }

  function drawVentCover(x: number, y: number): void {
    ctx.fillStyle = "#aeb6bb";
    ctx.fillRect(x, y, VENT.w, VENT.h);
    ctx.strokeStyle = "#6f777c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, VENT.w, VENT.h);
    ctx.fillStyle = "#5b6367";
    for (let sy = y + 24; sy < y + VENT.h - 18; sy += 16) ctx.fillRect(x + 28, sy, VENT.w - 56, 6);
  }

  function drawVent(now: number): void {
    const inner = { x: VENT.x + 45, y: VENT.y + 32, w: VENT.w - 90, h: VENT.h - 64 };
    ctx.fillStyle = "#0b0d0e";
    ctx.fillRect(VENT.x, VENT.y, VENT.w, VENT.h);
    ctx.fillStyle = "#1b1f22";
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.fillStyle = "rgba(255, 244, 200, 0.18)";
    ctx.fillRect(inner.x + 10, inner.y + 8, inner.w - 20, inner.h - 16);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    line(VENT.x, VENT.y, inner.x, inner.y);
    line(VENT.x + VENT.w, VENT.y, inner.x + inner.w, inner.y);
    line(VENT.x, VENT.y + VENT.h, inner.x, inner.y + inner.h);
    line(VENT.x + VENT.w, VENT.y + VENT.h, inner.x + inner.w, inner.y + inner.h);

    if (coverFallAt === null) {
      drawVentCover(VENT.x, VENT.y);
    } else if (now - coverFallAt < COVER_MS) {
      const t = (now - coverFallAt) / COVER_MS;
      ctx.save();
      ctx.translate(VENT.x + VENT.w / 2, VENT.y + VENT.h / 2 + t * t * (COVER_FLOOR_Y - VENT.y));
      ctx.rotate(t * 0.25);
      drawVentCover(-VENT.w / 2, -VENT.h / 2);
      ctx.restore();
    } else {
      ctx.fillStyle = "#aeb6bb";
      poly(
        [VENT.x - 20, COVER_FLOOR_Y + 60],
        [VENT.x + VENT.w + 20, COVER_FLOOR_Y + 60],
        [VENT.x + VENT.w, COVER_FLOOR_Y + 20],
        [VENT.x, COVER_FLOOR_Y + 20]
      );
      ctx.strokeStyle = "#6f777c";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawScrewHead(x: number, y: number, spin: number, scale: number, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#d8d1bf";
    ctx.strokeStyle = "#6f777c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    line(-4, 0, 4, 0);
    line(0, -4, 0, 4);
    ctx.restore();
  }

  function drawScrews(now: number): void {
    if (coverFallAt !== null) return;
    SCREWS.forEach((s, i) => {
      const out = screwsOut[i];
      if (out === null || out === undefined) {
        drawScrewHead(s.x, s.y, 0, 1, 1);
        return;
      }
      const t = (now - out) / UNSCREW_MS;
      if (t >= 1) return;
      if (t < 0.6) {
        drawScrewHead(s.x, s.y, t * 14, 1 + t * 0.4, 1);
      } else {
        const f = (t - 0.6) / 0.4;
        drawScrewHead(s.x + f * 6, s.y + f * f * 140, 8 + f * 6, 1.24, 1 - f);
      }
    });
  }

  // The door, what's behind it, its bolt, and whatever paint is still on it.
  function drawDoor(now: number): void {
    const open = doorOpening(now);
    const cx = DOOR.x + DOOR.w / 2;

    if (open > 0) {
      const inside = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h);
      inside.addColorStop(0, "#12051f");
      inside.addColorStop(1, "#3a1063");
      ctx.fillStyle = inside;
      ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      ctx.fillStyle = `rgba(199, 125, 255, ${0.35 + 0.2 * Math.sin(now / 300)})`;
      for (let i = 0; i < 4; i += 1) {
        const w = DOOR.w - 20 - i * 16;
        ctx.fillRect(cx - w / 2, DOOR.y + DOOR.h - 14 - i * 24, w, 8);
      }
      ctx.fillStyle = "#f0e0ff";
      ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("BONUS", cx, DOOR.y + 22);
    }

    const leafW = DOOR.w * (1 - open * 0.85);
    ctx.fillStyle = "#8a6a4a";
    ctx.fillRect(DOOR.x, DOOR.y, leafW, DOOR.h);
    if (leafW > 30) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(DOOR.x + leafW * 0.15, DOOR.y + DOOR.h * 0.08, leafW * 0.7, DOOR.h * 0.36);
      ctx.strokeRect(DOOR.x + leafW * 0.15, DOOR.y + DOOR.h * 0.54, leafW * 0.7, DOOR.h * 0.36);
    }
    ctx.strokeStyle = "#4a3522";
    ctx.lineWidth = 3;
    ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);

    if (open < 0.2) {
      const turning = boltAt === null ? 0 : clamp((now - boltAt) / BOLT_MS, 0, 1);
      ctx.save();
      ctx.translate(BOLT.x, BOLT.y);
      ctx.rotate(turning * Math.PI * 3);
      ctx.fillStyle = "#8d979c";
      ctx.strokeStyle = "#4b5256";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        else ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#5b6367";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (boltAt !== null && turning < 1) drawWrench(BOLT.x, BOLT.y, turning * Math.PI * 3);
    }

    if (revealedAt === null) {
      // Paint the same as the wall behind it, left wherever it hasn't been scraped.
      const wall = ctx.createLinearGradient(0, BACK.top, 0, BACK.bottom);
      wall.addColorStop(0, PALETTE.wallTop);
      wall.addColorStop(1, PALETTE.wallBottom);
      ctx.fillStyle = wall;
      for (let row = 0; row < PAINT_ROWS; row += 1) {
        for (let col = 0; col < PAINT_COLS; col += 1) {
          if (scraped.has(row * PAINT_COLS + col)) continue;
          ctx.fillRect(DOOR.x + col * PAINT_CELL - 0.5, DOOR.y + row * PAINT_CELL - 0.5, PAINT_CELL + 1, PAINT_CELL + 1);
        }
      }
    }
  }

  function drawPlywoodSheet(x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#d7ae72";
    ctx.fillRect(-45, -9, 90, 18);
    ctx.fillStyle = "#b38850";
    ctx.fillRect(-45, 5, 90, 4);
    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 2;
    ctx.strokeRect(-45, -9, 90, 18);
    ctx.restore();
  }

  function drawBench(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse((BENCH.left + BENCH.right) / 2, BENCH.legBottom + 3, 175, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    const legTop = BENCH.top + BENCH.thickness;
    ctx.fillStyle = "#6b4421";
    ctx.fillRect(BENCH.left + 14, legTop, 20, BENCH.legBottom - legTop);
    ctx.fillRect(BENCH.right - 34, legTop, 20, BENCH.legBottom - legTop);
    ctx.fillStyle = "#7a4e26";
    ctx.fillRect(BENCH.left + 10, 462, BENCH.right - BENCH.left - 20, 12);
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, BENCH.thickness);
    ctx.fillStyle = "#a8733f";
    ctx.fillRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, 6);
    ctx.strokeStyle = "#4a2d12";
    ctx.lineWidth = 2;
    ctx.strokeRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, BENCH.thickness);

    const sheets = held === "plywood" ? 4 : 5;
    for (let i = 0; i < sheets; i += 1) {
      const y = BENCH.top - (i + 1) * 11;
      ctx.fillStyle = "#d7ae72";
      ctx.fillRect(610 + (i % 2) * 6, y, 240, 11);
      ctx.strokeStyle = "#8a6536";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(610 + (i % 2) * 6, y, 240, 11);
    }
  }

  function draw(now: number): void {
    if (stage === "bonus") {
      toolWall.draw(now);
      return;
    }
    const elapsed = now - stageStart;
    ctx.save();
    let fade = 0;
    if (stage === "leaving") {
      fade = diveInto(VENT.x + VENT.w / 2, VENT.y + VENT.h / 2, Math.min(1, elapsed / LEAVE_MS));
    } else if (stage === "bonusIn") {
      fade = diveInto(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, Math.min(1, elapsed / BONUS_IN_MS));
    }
    drawRoomBox(PALETTE);
    // The door goes under the light, so the light falls on the paint and the wall the same.
    drawDoor(now);
    drawTubeLight();
    drawPegboard();
    drawVent(now);
    drawScrews(now);
    drawBench();
    drawDust(dust, PALETTE.wallTop);
    ctx.restore();

    drawVignette();
    if (held !== "none" && stage === "room") {
      const lines = [`You have: ${HELD_NAME[held]}`];
      if (held === "screwdriver" && coverFallAt === null) lines.push(`Screws out: ${screwsRemoved()} / ${SCREWS.length}`);
      drawNotes(lines);
    }
    if (stage === "room" && held === "none") drawCaption("There's a vent on the wall.", (now - roomStart) / 1000);
    drawFloaters(floaters, now);
    if (stage === "room") {
      if (held === "screwdriver") drawScrewdriver(pointer.x, pointer.y, -0.8);
      else if (held === "wrench") drawWrench(pointer.x, pointer.y, -0.6);
      else if (held === "plywood") drawPlywoodSheet(pointer.x, pointer.y, -0.35);
    }

    if (fade > 0 || stage === "escaped") {
      ctx.fillStyle = `rgba(0, 0, 0, ${stage === "escaped" ? 1 : fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Workbench",
    exitLine: "You crawled out through the vent and came out in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
