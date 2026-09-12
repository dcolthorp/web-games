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
  line,
  poly,
  roundRect,
  type Point,
  type Room,
} from "./engine";
import { FLOAT_MS, drawFloaters, drawNotes, type Floater } from "./hundred";
import { sounds } from "./sound";

// Hundred Logic Escape Room 2: Workbench. There's a vent on the wall, held on
// by four screws, and a screwdriver hanging on the pegboard. Take the
// screwdriver, unscrew the vent cover, and crawl out through the vent.

type Stage = "vent" | "falling" | "open" | "leaving" | "escaped";

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

const UNSCREW_MS = 650;
const COVER_MS = 650;
const LEAVE_MS = 1500;

const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

export function createHundredWorkbenchRoom(escape: () => void): Room {
  let stage: Stage = "vent";
  let stageStart = 0;
  let roomStart = 0;
  let holding = false;
  // When each screw came out, or null while it's still in.
  let screwsOut: (number | null)[] = [];
  let floaters: Floater[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };

  function setStage(next: Stage, now: number): void {
    stage = next;
    stageStart = now;
  }

  function reset(startAt: number): void {
    stage = "vent";
    stageStart = startAt;
    roomStart = startAt;
    holding = false;
    screwsOut = SCREWS.map(() => null);
    floaters = [];
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(60, y), start: now });
  }

  const screwAt = (p: Point): number =>
    SCREWS.findIndex((s, i) => screwsOut[i] === null && Math.hypot(p.x - s.x, p.y - s.y) < 18);
  const screwsRemoved = (): number => screwsOut.filter((t) => t !== null).length;

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (stage === "open") {
      if (over(p, VENT)) {
        sounds.whoosh(LEAVE_MS / 1000);
        setStage("leaving", now);
      }
      return;
    }
    if (stage !== "vent") return;

    if (!holding && over(p, SCREWDRIVER)) {
      holding = true;
      sounds.grab();
      say("Got the screwdriver.", SCREWDRIVER.x, SCREWDRIVER.y - 10, now);
      return;
    }
    const screw = screwAt(p);
    if (screw >= 0) {
      if (!holding) {
        sounds.tink();
        say("These screws need a screwdriver.", p.x, p.y - 40, now);
      } else {
        screwsOut[screw] = now;
        sounds.stroke();
      }
      return;
    }
    if (over(p, WRENCH)) {
      sounds.tink();
      say("A wrench won't turn these screws.", WRENCH.x + 35, WRENCH.y - 10, now);
    } else if (over(p, VENT)) {
      sounds.tink();
      say(holding ? "Take all four screws out first." : "The vent cover is screwed on.", VENT.x + VENT.w / 2, VENT.y - 20, now);
    } else if (over(p, PLYWOOD)) {
      say("You don't need wood to open a vent.", PLYWOOD.x + PLYWOOD.w / 2, PLYWOOD.y - 20, now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function pointerUp(): void {}

  function cursor(p: Point): string {
    if (stage === "vent") {
      if (holding) return "none";
      return over(p, SCREWDRIVER) || screwAt(p) >= 0 || over(p, WRENCH) || over(p, VENT) ? "pointer" : "default";
    }
    if (stage === "open" && over(p, VENT)) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    const elapsed = now - stageStart;
    if (stage === "vent" && screwsOut.every((t) => t !== null && now - t >= UNSCREW_MS)) {
      sounds.crash();
      setStage("falling", now);
    } else if (stage === "falling" && elapsed >= COVER_MS) {
      setStage("open", now);
    } else if (stage === "leaving" && elapsed >= LEAVE_MS) {
      setStage("escaped", now);
      escape();
    }
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

  function drawScrewdriver(x: number, y: number, angle: number): void {
    // Drawn with the tip at (x, y).
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

    if (!holding) drawScrewdriver(769, 290, 0);
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
    // The duct behind the cover
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

    if (stage === "vent") {
      drawVentCover(VENT.x, VENT.y);
    } else if (stage === "falling") {
      const t = Math.min(1, (now - stageStart) / COVER_MS);
      ctx.save();
      ctx.translate(VENT.x + VENT.w / 2, VENT.y + VENT.h / 2 + t * t * (COVER_FLOOR_Y - VENT.y));
      ctx.rotate(t * 0.25);
      drawVentCover(-VENT.w / 2, -VENT.h / 2);
      ctx.restore();
    } else {
      // Lying flat on the floor where it landed
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
    if (stage !== "vent") return;
    SCREWS.forEach((s, i) => {
      const out = screwsOut[i];
      if (out === null || out === undefined) {
        drawScrewHead(s.x, s.y, 0, 1, 1);
        return;
      }
      const t = (now - out) / UNSCREW_MS;
      if (t >= 1) return;
      // Spins out, then drops.
      if (t < 0.6) {
        drawScrewHead(s.x, s.y, t * 14, 1 + t * 0.4, 1);
      } else {
        const f = (t - 0.6) / 0.4;
        drawScrewHead(s.x + f * 6, s.y + f * f * 140, 8 + f * 6, 1.24, 1 - f);
      }
    });
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

    for (let i = 0; i < 5; i += 1) {
      const y = BENCH.top - (i + 1) * 11;
      ctx.fillStyle = "#d7ae72";
      ctx.fillRect(610 + (i % 2) * 6, y, 240, 11);
      ctx.strokeStyle = "#8a6536";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(610 + (i % 2) * 6, y, 240, 11);
    }
  }

  function draw(now: number): void {
    const elapsed = now - stageStart;
    ctx.save();
    let fade = 0;
    if (stage === "leaving") {
      fade = diveInto(VENT.x + VENT.w / 2, VENT.y + VENT.h / 2, Math.min(1, elapsed / LEAVE_MS));
    }
    drawRoomBox(PALETTE);
    drawTubeLight();
    drawPegboard();
    drawVent(now);
    drawScrews(now);
    drawBench();
    ctx.restore();

    drawVignette();
    if (holding && stage === "vent") drawNotes(["You have: a screwdriver", `Screws out: ${screwsRemoved()} / ${SCREWS.length}`]);
    if (stage === "vent" && !holding) drawCaption("There's a vent on the wall.", (now - roomStart) / 1000);
    if (stage === "open") drawCaption("The vent is open.", elapsed / 1000);
    drawFloaters(floaters, now);
    if (holding && stage === "vent") drawScrewdriver(pointer.x, pointer.y, -0.8);

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
