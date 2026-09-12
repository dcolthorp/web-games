import { H, W, clamp, ctx, drawCaption, inRect, roundRect, type Point } from "./engine";
import type { BonusLevel } from "./bonus2";
import { collectEarthFragment, drawEarthFragment, hasEarthFragment } from "./earthFragments";
import { FLOAT_MS, drawFloaters, type Floater } from "./hundred";
import { sounds } from "./sound";

// The bonus level behind the painted-over door in Hundred Logic's Workbench: a
// tool wall. Every tool has its own dashed outline on the pegboard, and the
// tools are all over the bench. Hang each one on the outline that matches it
// (the two wrenches, and the two screwdrivers, are the same tool in different
// sizes). When every tool is where it belongs, a little cupboard in the middle
// of the pegboard opens, and Earth Fragment 2 is inside. The outlines move
// around every visit.

type Phase = "sorting" | "cupboard" | "reward";
type Kind = "hammer" | "saw" | "wrench" | "screwdriver" | "pliers";

interface Tool {
  kind: Kind;
  scale: number;
  slot: Point;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  placed: boolean;
}

const BOARD = { x: 130, y: 60, w: 700, h: 340 };
const CUPBOARD = { x: W / 2 - 50, y: 193, w: 100, h: 84 };
const BENCH_TOP = 440;
const BACK_BUTTON = { x: 16, y: 12, w: 96, h: 36 };

// Where outlines can go, around the cupboard in the middle.
const SLOTS: Point[] = [
  { x: 260, y: 130 },
  { x: 480, y: 125 },
  { x: 700, y: 130 },
  { x: 260, y: 235 },
  { x: 700, y: 235 },
  { x: 260, y: 335 },
  { x: 480, y: 340 },
  { x: 700, y: 335 },
];
const TOOL_SET: [Kind, number][] = [
  ["hammer", 1],
  ["saw", 1],
  ["pliers", 1],
  ["wrench", 1],
  ["wrench", 0.7],
  ["screwdriver", 1],
  ["screwdriver", 0.7],
];
// How big each tool is at full size, for picking it up.
const SIZE: Record<Kind, [number, number]> = {
  hammer: [115, 50],
  saw: [150, 46],
  wrench: [122, 34],
  screwdriver: [110, 24],
  pliers: [100, 30],
};
const COLOR: Record<Kind, string> = {
  hammer: "#7a4e26",
  saw: "#c9d1d6",
  wrench: "#9aa5ad",
  screwdriver: "#d94a3a",
  pliers: "#e0a030",
};

const SNAP = 40;
const CUPBOARD_MS = 900;
const REWARD_AFTER_MS = 1500;

function toolPath(kind: Kind): Path2D {
  const p = new Path2D();
  if (kind === "hammer") {
    p.rect(-55, -6, 88, 12);
    p.roundRect(30, -24, 28, 48, 4);
  } else if (kind === "saw") {
    p.moveTo(-78, -3);
    p.lineTo(38, -16);
    p.lineTo(38, 14);
    p.lineTo(-78, 5);
    p.closePath();
    p.roundRect(36, -22, 36, 44, 10);
  } else if (kind === "wrench") {
    p.roundRect(-40, -6, 76, 12, 6);
    p.moveTo(-34, 0);
    p.arc(-50, 0, 16, 0, Math.PI * 2);
    p.moveTo(54, 0);
    p.arc(42, 0, 12, 0, Math.PI * 2);
  } else if (kind === "screwdriver") {
    p.roundRect(-56, -11, 44, 22, 8);
    p.rect(-12, -3, 66, 6);
  } else {
    p.moveTo(-50, -12);
    p.lineTo(8, -4);
    p.lineTo(50, -5);
    p.lineTo(50, 1);
    p.lineTo(8, 4);
    p.lineTo(-50, 14);
    p.lineTo(-50, 6);
    p.lineTo(-2, 0);
    p.lineTo(-50, -4);
    p.closePath();
    p.moveTo(12, 0);
    p.arc(6, 0, 6, 0, Math.PI * 2);
  }
  return p;
}

const PATHS: Record<Kind, Path2D> = {
  hammer: toolPath("hammer"),
  saw: toolPath("saw"),
  wrench: toolPath("wrench"),
  screwdriver: toolPath("screwdriver"),
  pliers: toolPath("pliers"),
};

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

// leave is called from the Back button and after getting the fragment.
export function createToolWall(leave: () => void): BonusLevel {
  let phase: Phase = "sorting";
  let phaseStart = 0;
  let levelStart = 0;
  let tools: Tool[] = [];
  let dragging: { tool: Tool; offX: number; offY: number } | null = null;
  let floaters: Floater[] = [];
  let fragmentWasNew = true;

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  function reset(now: number): void {
    setPhase("sorting", now);
    levelStart = now;
    dragging = null;
    floaters = [];
    const slots = shuffle(SLOTS);
    const homes = shuffle(TOOL_SET.map((_, i) => ({ x: 110 + i * 123, y: 482 + (i % 2) * 52 })));
    tools = TOOL_SET.map(([kind, scale], i) => {
      const home = homes[i] ?? { x: W / 2, y: 500 };
      return { kind, scale, slot: slots[i] ?? { x: W / 2, y: 130 }, homeX: home.x, homeY: home.y, x: home.x, y: home.y, placed: false };
    });
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(70, y), start: now });
  }

  function toolAt(p: Point): Tool | null {
    for (let i = tools.length - 1; i >= 0; i -= 1) {
      const tool = tools[i];
      if (!tool || tool.placed) continue;
      const [w, h] = SIZE[tool.kind];
      if (Math.abs(p.x - tool.x) <= (w * tool.scale) / 2 + 8 && Math.abs(p.y - tool.y) <= (h * tool.scale) / 2 + 10) return tool;
    }
    return null;
  }

  const overBack = (p: Point): boolean => inRect(p, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h);

  // ---------- input ----------

  function pointerDown(p: Point): void {
    if (phase === "reward") {
      leave();
      return;
    }
    if (overBack(p)) {
      sounds.tink();
      leave();
      return;
    }
    if (phase !== "sorting") return;
    const tool = toolAt(p);
    if (!tool) return;
    tools = [...tools.filter((t) => t !== tool), tool];
    dragging = { tool, offX: p.x - tool.x, offY: p.y - tool.y };
    sounds.grab();
  }

  function pointerMove(p: Point): void {
    if (!dragging) return;
    dragging.tool.x = clamp(p.x - dragging.offX, 40, W - 40);
    dragging.tool.y = clamp(p.y - dragging.offY, 40, H - 30);
  }

  function pointerUp(): void {
    if (!dragging) return;
    const { tool } = dragging;
    dragging = null;
    const now = performance.now();
    if (Math.hypot(tool.x - tool.slot.x, tool.y - tool.slot.y) < SNAP) {
      tool.x = tool.slot.x;
      tool.y = tool.slot.y;
      tool.placed = true;
      sounds.clack();
      if (tools.every((t) => t.placed)) {
        sounds.creak();
        setPhase("cupboard", now);
      }
      return;
    }
    const other = tools.find((t) => t !== tool && Math.hypot(tool.x - t.slot.x, tool.y - t.slot.y) < SNAP);
    if (other) {
      sounds.womp();
      say(other.kind === tool.kind ? "Same tool, wrong size." : "That's not its outline.", other.slot.x, other.slot.y - 40, now);
    }
    tool.x = tool.homeX;
    tool.y = tool.homeY;
  }

  function cursor(p: Point): string {
    if (phase === "reward" || overBack(p)) return "pointer";
    if (dragging) return "grabbing";
    return phase === "sorting" && toolAt(p) ? "grab" : "default";
  }

  function update(now: number): void {
    if (phase === "cupboard" && now - phaseStart >= REWARD_AFTER_MS) {
      fragmentWasNew = !hasEarthFragment(2);
      collectEarthFragment(2);
      sounds.chime();
      setPhase("reward", now);
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawTool(tool: Tool, x: number, y: number, shadow: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(tool.scale, tool.scale);
    const path = PATHS[tool.kind];
    if (shadow) {
      ctx.save();
      ctx.translate(4, 6);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fill(path);
      ctx.restore();
    }
    ctx.fillStyle = COLOR[tool.kind];
    ctx.fill(path);
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2 / tool.scale;
    ctx.stroke(path);
    ctx.restore();
  }

  function drawOutline(tool: Tool): void {
    ctx.save();
    ctx.translate(tool.slot.x, tool.slot.y);
    ctx.scale(tool.scale, tool.scale);
    const path = PATHS[tool.kind];
    ctx.fillStyle = "rgba(40, 25, 10, 0.1)";
    ctx.fill(path);
    ctx.setLineDash([6 / tool.scale, 5 / tool.scale]);
    ctx.strokeStyle = "rgba(40, 25, 10, 0.65)";
    ctx.lineWidth = 2.5 / tool.scale;
    ctx.stroke(path);
    ctx.restore();
  }

  function drawCupboard(now: number): void {
    const open = phase === "sorting" ? 0 : clamp((now - phaseStart) / CUPBOARD_MS, 0, 1);
    const cx = CUPBOARD.x + CUPBOARD.w / 2;
    const cy = CUPBOARD.y + CUPBOARD.h / 2;
    ctx.fillStyle = "#2a1a0c";
    ctx.fillRect(CUPBOARD.x, CUPBOARD.y, CUPBOARD.w, CUPBOARD.h);
    if (open > 0) {
      const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
      glow.addColorStop(0, `rgba(127, 208, 255, ${0.6 * open})`);
      glow.addColorStop(1, "rgba(127, 208, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(CUPBOARD.x, CUPBOARD.y, CUPBOARD.w, CUPBOARD.h);
      drawEarthFragment(2, cx, cy + Math.sin(now / 400) * 3, 0.55);
    }
    const doorW = (CUPBOARD.w / 2) * (1 - open * 0.85);
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(CUPBOARD.x, CUPBOARD.y, doorW, CUPBOARD.h);
    ctx.fillRect(CUPBOARD.x + CUPBOARD.w - doorW, CUPBOARD.y, doorW, CUPBOARD.h);
    ctx.strokeStyle = "#4a2d12";
    ctx.lineWidth = 3;
    ctx.strokeRect(CUPBOARD.x, CUPBOARD.y, CUPBOARD.w, CUPBOARD.h);
    if (open < 0.2) {
      ctx.fillStyle = "#d9a52a";
      ctx.beginPath();
      ctx.arc(cx - 8, cy, 4, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(now: number): void {
    ctx.fillStyle = "#5c6569";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#b8926a";
    roundRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(60, 40, 20, 0.35)";
    for (let y = BOARD.y + 14; y < BOARD.y + BOARD.h; y += 20) {
      for (let x = BOARD.x + 14; x < BOARD.x + BOARD.w; x += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#6e4f30";
    ctx.lineWidth = 4;
    roundRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 8);
    ctx.stroke();

    drawCupboard(now);
    for (const tool of tools) if (!tool.placed) drawOutline(tool);
    for (const tool of tools) if (tool.placed) drawTool(tool, tool.slot.x, tool.slot.y, false);

    ctx.fillStyle = "#6b4421";
    ctx.fillRect(0, BENCH_TOP, W, H - BENCH_TOP);
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(0, BENCH_TOP, W, 14);
    for (const tool of tools) if (!tool.placed) drawTool(tool, tool.x, tool.y, true);

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 24px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("TOOL WALL", W / 2, 32);
    ctx.fillStyle = "#c77dff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BONUS LEVEL", W - 22, 32);

    if (phase === "sorting") drawCaption("Hang every tool on its own outline.", (now - levelStart) / 1000);
    drawFloaters(floaters, now);

    if (phase === "reward") {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.75, (now - phaseStart) / 500)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#000";
      ctx.font = "54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.strokeText("EARTH FRAGMENT 2", W / 2, H / 2 - 150);
      ctx.fillStyle = "#ffcf5a";
      ctx.fillText("EARTH FRAGMENT 2", W / 2, H / 2 - 150);
      drawEarthFragment(2, W / 2, H / 2 - 10 + Math.sin(now / 400) * 6, 1.6);
      ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      const message = fragmentWasNew ? "Every tool is back where it belongs!" : "You already have Earth Fragment 2.";
      ctx.strokeText(message, W / 2, H / 2 + 110);
      ctx.fillStyle = "#f5efe6";
      ctx.fillText(message, W / 2, H / 2 + 110);
      ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#b9adc4";
      ctx.fillText("Click to go back.", W / 2, H / 2 + 150);
    }
  }

  return { reset, update, draw, pointerDown, pointerMove, pointerUp, cursor };
}
