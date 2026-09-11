import {
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawBonusCard,
  drawCaption,
  drawDust,
  drawRoomBox,
  drawSaw,
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
import { selectedTool } from "./tools";

// Escape Room 2: Workbench. Take the five sheets of plywood off the workbench
// and stand them up in the 5 × 5 space on the wall. Each one is one block wide
// and five blocks tall, so five of them fill it. Then whack the finished wall
// with the door knob lying on the floor, and it falls over to show a way out.
// With the saw from room 1 you can cut a doorway out of the finished wall
// instead, and behind it is a secret way to a bonus level.

type Stage =
  | "build" // carrying plywood and the knob around
  | "bonk" // the finished wall got hit and is wobbling
  | "toppling" // the wall falls over
  | "open" // the escape route is showing
  | "leaving" // crawling into it
  | "bonusIn" // going through the secret doorway
  | "bonus" // the bonus level card
  | "escaped";

type Held = "none" | "plank" | "knob";

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

const BLOCK = 48;
const PLANK_COUNT = 5;
const GRID = { x: 180, y: 150, size: BLOCK * PLANK_COUNT };
const GRID_BOTTOM = GRID.y + GRID.size;

const BENCH = { left: 560, right: 870, top: 372, thickness: 22, legBottom: 505 };
const PLANK_LYING_H = 11;
const STACK_X = 610;
const STACK_JITTER = [0, 6, -4, 8, 2];

const KNOB_HOME: Point = { x: 330, y: 548 };

// Where the tunnel behind the wall leads: a small lit doorway far away.
const TUNNEL = { x: 278, y: 250, w: 44, h: 60 };
const TUNNEL_CENTER: Point = { x: TUNNEL.x + TUNNEL.w / 2, y: TUNNEL.y + TUNNEL.h / 2 };

const SWING_MS = 260;
const WOBBLE_MS = 350;
const BONK_MS = 450;
const TOPPLE_MS = 750;
const LEAVE_MS = 1500;

// The secret doorway the saw cuts in the middle of the finished wall.
const DOOR = { x: GRID.x + 80, y: GRID.y + 70, w: 80, h: GRID.size - 70 };
const DOOR_CUT_MS = 1600;
const BONUS_IN_MS = 900;

export function createWorkbenchRoom(escape: () => void): Room {
  let stage: Stage = "build";
  let stageStart = 0;
  let roomStart = 0;
  let held: Held = "none";
  let onBench = PLANK_COUNT;
  let placed: boolean[] = [];
  let knobUsed = false;
  let pointer: Point = { x: W / 2, y: H / 2 };
  let dust: Dust[] = [];
  let wobbleStart = -Infinity;
  let swingStart = -Infinity;
  let swingAt: Point = { ...KNOB_HOME };
  let doorCutAt: number | null = null;
  let doorOpened = false;
  let lastStroke = 0;

  function setStage(next: Stage, now: number): void {
    stage = next;
    stageStart = now;
  }

  function reset(startAt: number): void {
    stage = "build";
    stageStart = startAt;
    roomStart = startAt;
    held = "none";
    onBench = PLANK_COUNT;
    placed = Array.from({ length: PLANK_COUNT }, () => false);
    knobUsed = false;
    dust = [];
    wobbleStart = -Infinity;
    swingStart = -Infinity;
    doorCutAt = null;
    doorOpened = false;
  }

  const wallComplete = (): boolean => placed.every(Boolean);
  const overDoor = (p: Point): boolean => doorOpened && inRect(p, DOOR.x, DOOR.y, DOOR.w, DOOR.h);

  // ---------- hit tests ----------

  function overStack(p: Point): boolean {
    const height = PLANK_LYING_H * PLANK_COUNT;
    return onBench > 0 && inRect(p, STACK_X - 15, BENCH.top - height - 20, GRID.size + 30, height + 30);
  }

  function overKnob(p: Point): boolean {
    return !knobUsed && Math.hypot(p.x - KNOB_HOME.x, p.y - KNOB_HOME.y) < 36;
  }

  function overWall(p: Point): boolean {
    return inRect(p, GRID.x - 10, GRID.y - 10, GRID.size + 20, GRID.size + 20);
  }

  // The empty column a carried plank would go into: the one under the pointer,
  // or the nearest empty one to it. Null when the pointer is not near the space.
  function columnFor(p: Point): number | null {
    if (!inRect(p, GRID.x - 20, GRID.y - 40, GRID.size + 40, GRID.size + 80)) return null;
    const under = clamp(Math.floor((p.x - GRID.x) / BLOCK), 0, PLANK_COUNT - 1);
    let best: number | null = null;
    for (let c = 0; c < PLANK_COUNT; c += 1) {
      if (placed[c]) continue;
      if (best === null || Math.abs(c - under) < Math.abs(best - under)) best = c;
    }
    return best;
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();

    if (stage === "bonus") {
      setStage("build", now);
      return;
    }
    if (stage === "open" && overWall(p)) {
      sounds.whoosh(LEAVE_MS / 1000);
      setStage("leaving", now);
      return;
    }
    if (stage !== "build") return;

    if (held === "none" && overDoor(p)) {
      sounds.whoosh(BONUS_IN_MS / 1000);
      setStage("bonusIn", now);
      return;
    }
    if (held === "none" && selectedTool() === "saw") {
      sawAt(p, now);
      return;
    }

    if (held === "none") {
      if (overStack(p)) {
        onBench -= 1;
        held = "plank";
        sounds.grab();
      } else if (overKnob(p)) {
        held = "knob";
        sounds.tink();
      }
    } else if (held === "plank") {
      const column = columnFor(p);
      // Anywhere that isn't the space puts the plank back on the bench.
      if (column !== null) placed[column] = true;
      else onBench += 1;
      held = "none";
      sounds.clack();
    } else if (overWall(p)) {
      swingStart = now;
      swingAt = p;
      sounds.bonk();
      puff(p, 8);
      if (wallComplete()) {
        held = "none";
        knobUsed = true;
        setStage("bonk", now);
      } else {
        wobbleStart = now;
      }
    } else {
      // Clicking anywhere else drops the knob back where it was.
      held = "none";
      sounds.tink();
    }
  }

  // The saw only really cuts the finished wall. Anything else just gets sawdust.
  function sawAt(p: Point, now: number): void {
    if (overWall(p) && wallComplete() && doorCutAt === null) {
      doorCutAt = now;
    } else if (overWall(p) || overStack(p)) {
      sounds.stroke();
      puff(p, 10);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function pointerUp(): void {}

  function cursor(p: Point): string {
    if (stage === "bonus") return "pointer";
    if (stage === "build") {
      if (held === "none" && overDoor(p)) return "pointer";
      if (held !== "none" || selectedTool() === "saw") return "none";
      return overStack(p) || overKnob(p) ? "pointer" : "default";
    }
    if (stage === "open" && overWall(p)) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number, dt: number): void {
    const elapsed = now - stageStart;
    if (stage === "bonk" && elapsed >= BONK_MS) {
      sounds.creak();
      setStage("toppling", now);
    } else if (stage === "toppling" && elapsed >= TOPPLE_MS) {
      sounds.crash();
      for (let i = 0; i < 40; i += 1) {
        dust.push({
          x: lerp(GRID.x - 40, GRID.x + GRID.size + 40, Math.random()),
          y: 560 - Math.random() * 20,
          vx: (Math.random() - 0.5) * 300,
          vy: -Math.random() * 220,
          life: 1,
        });
      }
      setStage("open", now);
    } else if (stage === "leaving" && elapsed >= LEAVE_MS) {
      setStage("escaped", now);
      escape();
    } else if (stage === "bonusIn" && elapsed >= BONUS_IN_MS) {
      setStage("bonus", now);
    }

    if (doorCutAt !== null && !doorOpened) {
      if (now - doorCutAt < DOOR_CUT_MS) {
        if (now - lastStroke > 300) {
          lastStroke = now;
          sounds.stroke();
        }
        puff(doorCutPoint((now - doorCutAt) / DOOR_CUT_MS), 1);
      } else {
        doorOpened = true;
        sounds.crash();
        for (let i = 0; i < 30; i += 1) {
          dust.push({
            x: lerp(DOOR.x, DOOR.x + DOOR.w, Math.random()),
            y: lerp(DOOR.y, DOOR.y + DOOR.h, Math.random()),
            vx: (Math.random() - 0.5) * 260,
            vy: -Math.random() * 200,
            life: 1,
          });
        }
      }
    }
    dust = updateDust(dust, dt);
  }

  function puff(at: Point, count: number): void {
    for (let i = 0; i < count; i += 1) {
      dust.push({
        x: at.x,
        y: at.y,
        vx: (Math.random() - 0.5) * 200,
        vy: -Math.random() * 160,
        life: 0.7,
      });
    }
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

  function drawPegboard(): void {
    ctx.fillStyle = "#b8926a";
    ctx.fillRect(600, 150, 240, 170);
    ctx.fillStyle = "rgba(60, 40, 20, 0.45)";
    for (let y = 162; y < 320; y += 16) {
      for (let x = 612; x < 840; x += 16) {
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "#6e4f30";
    ctx.lineWidth = 3;
    ctx.strokeRect(600, 150, 240, 170);

    // A wrench and a screwdriver hanging up. Neither of them helps.
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

    ctx.fillStyle = "#c9302c";
    roundRect(760, 175, 18, 55, 6);
    ctx.fill();
    ctx.fillStyle = "#aab3b8";
    ctx.fillRect(766, 230, 6, 60);
  }

  function drawOutline(): void {
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(245, 245, 235, 0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(GRID.x, GRID.y, GRID.size, GRID.size);
    ctx.restore();

    ctx.fillStyle = "rgba(245, 245, 235, 0.6)";
    ctx.font = "bold 22px 'Comic Sans MS', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("5 × 5", GRID.x + GRID.size / 2, GRID.y - 20);
  }

  function drawUprightPlank(x: number, y: number, seed: number): void {
    ctx.fillStyle = "#d7ae72";
    ctx.fillRect(x, y, BLOCK, GRID.size);

    ctx.strokeStyle = "rgba(120, 80, 30, 0.35)";
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 3; g += 1) {
      const gx = x + 10 + g * 14 + (seed % 3);
      ctx.beginPath();
      ctx.moveTo(gx, y);
      for (let yy = 20; yy <= GRID.size; yy += 20) {
        ctx.lineTo(gx + Math.sin((yy + seed * 37 + g * 50) / 30) * 3, y + yy);
      }
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(110, 70, 30, 0.5)";
    ctx.beginPath();
    ctx.ellipse(x + 14 + ((seed * 11) % 20), y + 50 + ((seed * 53) % 140), 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, BLOCK - 2, GRID.size - 2);
  }

  // The finished wall tipping forward onto the floor, pivoting on its bottom
  // edge. angle 0 is standing up, PI / 2 is flat on the floor.
  function drawFallingWall(angle: number): void {
    const s = Math.sin(angle);
    const topY = GRID_BOTTOM - GRID.size * Math.cos(angle) + 170 * s;
    const spread = 50 * s;
    const left = GRID.x;
    const right = GRID.x + GRID.size;

    ctx.fillStyle = "#d7ae72";
    poly([left, GRID_BOTTOM], [right, GRID_BOTTOM], [right + spread, topY], [left - spread, topY]);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * s})`;
    poly([left, GRID_BOTTOM], [right, GRID_BOTTOM], [right + spread, topY], [left - spread, topY]);

    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 2;
    for (let i = 0; i <= PLANK_COUNT; i += 1) {
      line(left + i * BLOCK, GRID_BOTTOM, left - spread + (i * (GRID.size + spread * 2)) / PLANK_COUNT, topY);
    }
    line(left, GRID_BOTTOM, right, GRID_BOTTOM);
    line(left - spread, topY, right + spread, topY);
  }

  function drawWall(now: number): void {
    if (stage === "build" || stage === "bonk" || stage === "bonusIn") {
      let shake = 0;
      const elapsed = now - stageStart;
      const wobble = now - wobbleStart;
      if (stage === "bonk") shake = Math.sin(elapsed / 18) * 5 * (1 - elapsed / BONK_MS);
      else if (wobble < WOBBLE_MS) shake = Math.sin(wobble / 18) * 3 * (1 - wobble / WOBBLE_MS);
      placed.forEach((isPlaced, c) => {
        if (isPlaced) drawUprightPlank(GRID.x + c * BLOCK + shake, GRID.y, c + 1);
      });
      drawSecretDoor(now);
      return;
    }
    const t = stage === "toppling" ? Math.min(1, (now - stageStart) / TOPPLE_MS) : 1;
    drawFallingWall(t * t * (Math.PI / 2));
  }

  function drawTunnel(now: number): void {
    const L = GRID.x;
    const R = GRID.x + GRID.size;
    const T = GRID.y;
    const B = GRID_BOTTOM;
    const iL = TUNNEL.x;
    const iR = TUNNEL.x + TUNNEL.w;
    const iT = TUNNEL.y;
    const iB = TUNNEL.y + TUNNEL.h;

    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, R - L, B - T);
    ctx.clip();

    ctx.fillStyle = "#050506";
    poly([L, T], [R, T], [iR, iT], [iL, iT]);
    ctx.fillStyle = "#111114";
    poly([L, T], [iL, iT], [iL, iB], [L, B]);
    ctx.fillStyle = "#0e0e11";
    poly([R, T], [iR, iT], [iR, iB], [R, B]);
    const floor = ctx.createLinearGradient(0, B, 0, iB);
    floor.addColorStop(0, "#2a241d");
    floor.addColorStop(1, "#15120f");
    ctx.fillStyle = floor;
    poly([L, B], [R, B], [iR, iB], [iL, iB]);

    // Ribs, so it reads as a long way down
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 2;
    for (const s of [0.3, 0.6, 0.82]) {
      const x1 = lerp(L, iL, s);
      const y1 = lerp(T, iT, s);
      ctx.strokeRect(x1, y1, lerp(R, iR, s) - x1, lerp(B, iB, s) - y1);
    }

    const glow = ctx.createRadialGradient(TUNNEL_CENTER.x, TUNNEL_CENTER.y, 5, TUNNEL_CENTER.x, TUNNEL_CENTER.y, 120);
    glow.addColorStop(0, "rgba(255, 214, 130, 0.4)");
    glow.addColorStop(1, "rgba(255, 214, 130, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(L, T, R - L, B - T);

    const light = ctx.createLinearGradient(0, iT, 0, iB);
    light.addColorStop(0, "#fff6cf");
    light.addColorStop(1, "#f0b85a");
    ctx.fillStyle = light;
    ctx.fillRect(iL, iT, TUNNEL.w, TUNNEL.h);

    ctx.fillStyle = "#1f8f4a";
    ctx.fillRect(TUNNEL_CENTER.x - 17, iT - 19, 34, 13);
    ctx.fillStyle = "#eafff0";
    ctx.font = "bold 10px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXIT", TUNNEL_CENTER.x, iT - 12);

    // Green arrows on the tunnel floor pointing the way, pulsing one after another.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    [
      { y: 368, w: 34, lw: 5 },
      { y: 340, w: 22, lw: 3.5 },
      { y: 322, w: 13, lw: 2.5 },
    ].forEach((arrow, i) => {
      ctx.globalAlpha = 0.45 + 0.55 * Math.max(0, Math.sin(now / 250 - i * 0.9));
      ctx.strokeStyle = "#5dff8a";
      ctx.lineWidth = arrow.lw;
      ctx.beginPath();
      ctx.moveTo(TUNNEL_CENTER.x - arrow.w / 2, arrow.y + arrow.w * 0.35);
      ctx.lineTo(TUNNEL_CENTER.x, arrow.y);
      ctx.lineTo(TUNNEL_CENTER.x + arrow.w / 2, arrow.y + arrow.w * 0.35);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.restore();

    ctx.strokeStyle = "#2c3134";
    ctx.lineWidth = 6;
    ctx.strokeRect(L, T, R - L, B - T);
  }

  // Where the saw is along the doorway: up the left side, across the top, and
  // down the right.
  function doorCutPoint(t: number): Point {
    let d = clamp(t, 0, 1) * (DOOR.h * 2 + DOOR.w);
    if (d < DOOR.h) return { x: DOOR.x, y: DOOR.y + DOOR.h - d };
    d -= DOOR.h;
    if (d < DOOR.w) return { x: DOOR.x + d, y: DOOR.y };
    return { x: DOOR.x + DOOR.w, y: DOOR.y + d - DOOR.w };
  }

  function drawSecretDoor(now: number): void {
    if (doorCutAt === null) return;
    if (!doorOpened) {
      const t = (now - doorCutAt) / DOOR_CUT_MS;
      ctx.strokeStyle = "#3a2410";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(DOOR.x, DOOR.y + DOOR.h);
      for (let i = 1; i <= 60; i += 1) {
        const q = doorCutPoint((t * i) / 60);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      const q = doorCutPoint(t);
      drawSaw(q.x + 30 + Math.sin(now / 45) * 12, q.y, -0.3);
      return;
    }

    const inside = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h);
    inside.addColorStop(0, "#12051f");
    inside.addColorStop(1, "#3a1063");
    ctx.fillStyle = inside;
    ctx.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    // Glowing steps going down
    ctx.fillStyle = `rgba(199, 125, 255, ${0.35 + 0.2 * Math.sin(now / 300)})`;
    for (let i = 0; i < 4; i += 1) {
      const w = DOOR.w - 16 - i * 12;
      ctx.fillRect(DOOR.x + (DOOR.w - w) / 2, DOOR.y + DOOR.h - 12 - i * 22, w, 8);
    }
    ctx.fillStyle = "#f0e0ff";
    ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BONUS", DOOR.x + DOOR.w / 2, DOOR.y + 20);
    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 3;
    ctx.strokeRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
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

    // A paint can on the bottom shelf
    ctx.fillStyle = "#3d7bd9";
    ctx.fillRect(780, 432, 34, 30);
    ctx.fillStyle = "#9fb4c8";
    ctx.beginPath();
    ctx.ellipse(797, 432, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eef3f8";
    ctx.fillRect(786, 432, 4, 12);

    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, BENCH.thickness);
    ctx.fillStyle = "#a8733f";
    ctx.fillRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, 6);
    ctx.strokeStyle = "#4a2d12";
    ctx.lineWidth = 2;
    ctx.strokeRect(BENCH.left, BENCH.top, BENCH.right - BENCH.left, BENCH.thickness);

    // A vise bolted to the end
    ctx.fillStyle = "#6f777c";
    ctx.fillRect(BENCH.left + 6, BENCH.top - 26, 30, 26);
    ctx.fillStyle = "#4b5256";
    ctx.fillRect(BENCH.left - 8, BENCH.top - 16, 16, 5);
  }

  function drawStack(): void {
    for (let i = 0; i < onBench; i += 1) {
      const x = STACK_X + (STACK_JITTER[i] ?? 0);
      const y = BENCH.top - (i + 1) * PLANK_LYING_H;
      ctx.fillStyle = "#d7ae72";
      ctx.fillRect(x, y, GRID.size, PLANK_LYING_H);
      ctx.fillStyle = "#e8c893";
      ctx.fillRect(x, y, GRID.size, 3);
      // The layers of the plywood showing on the end
      ctx.fillStyle = "#b38850";
      ctx.fillRect(x + GRID.size - 6, y + 4, 6, 2);
      ctx.fillRect(x + GRID.size - 6, y + 8, 6, 1.5);
      ctx.strokeStyle = "#8a6536";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, GRID.size, PLANK_LYING_H);
    }
  }

  function drawKnob(x: number, y: number, angle: number, lying: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    if (lying) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.ellipse(0, 15, 32, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(angle);
    ctx.fillStyle = "#9c7424";
    ctx.beginPath();
    ctx.ellipse(-22, 0, 5, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8902f";
    ctx.fillRect(-22, -4, 16, 8);
    const brass = ctx.createRadialGradient(4, -5, 2, 8, 0, 17);
    brass.addColorStop(0, "#fff3b0");
    brass.addColorStop(0.5, "#d9a52a");
    brass.addColorStop(1, "#7a5712");
    ctx.fillStyle = brass;
    ctx.beginPath();
    ctx.arc(8, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawKnobForStage(now: number): void {
    const swing = Math.min(1, (now - swingStart) / SWING_MS);
    // Pull back and whack: out and back in once over the swing.
    const d = swing < 1 ? Math.sin(swing * Math.PI) : 0;

    if (stage === "build") {
      if (held === "knob") drawKnob(pointer.x + 30 * d, pointer.y - 12 * d, -0.5 - 0.9 * d, false);
      else if (!knobUsed) drawKnob(KNOB_HOME.x, KNOB_HOME.y, 0, true);
    } else if (stage === "bonk") {
      drawKnob(swingAt.x + 30 * d, swingAt.y - 12 * d, -0.5 - 0.9 * d, false);
    } else if (stage === "toppling") {
      // Let go of it: it drops out of the bottom of the screen.
      const t = (now - stageStart) / 1000;
      drawKnob(swingAt.x, swingAt.y + 1000 * t * t, -0.5 + t * 6, false);
    }
  }

  function drawHeldPlank(): void {
    if (stage !== "build" || held !== "plank") return;
    const column = columnFor(pointer);
    if (column !== null) {
      // Snap it into the space so you can see where it will go.
      ctx.globalAlpha = 0.8;
      drawUprightPlank(GRID.x + column * BLOCK, GRID.y, column + 1);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.rotate(0.08);
    drawUprightPlank(-BLOCK / 2, -GRID.size / 2, 7);
    ctx.restore();
  }

  function draw(now: number): void {
    if (stage === "bonus") {
      drawBonusCard((now - stageStart) / 1000);
      return;
    }
    ctx.save();
    let fade = 0;
    if (stage === "leaving") {
      fade = diveInto(TUNNEL_CENTER.x, TUNNEL_CENTER.y, Math.min(1, (now - stageStart) / LEAVE_MS));
    } else if (stage === "bonusIn") {
      fade = diveInto(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, Math.min(1, (now - stageStart) / BONUS_IN_MS));
    }

    drawRoomBox(PALETTE);
    drawTubeLight();
    drawPegboard();
    if (stage === "build" || stage === "bonk" || stage === "bonusIn") drawOutline();
    else drawTunnel(now);
    drawWall(now);
    drawBench();
    drawStack();
    drawDust(dust, "#d7ae72");
    drawKnobForStage(now);
    drawHeldPlank();
    const cutting = doorCutAt !== null && !doorOpened;
    if (stage === "build" && held === "none" && selectedTool() === "saw" && !cutting) drawSaw(pointer.x, pointer.y, -0.35);
    ctx.restore();

    drawVignette();
    if (stage === "build" && onBench === PLANK_COUNT && held === "none") {
      drawCaption("Still no door.", (now - roomStart) / 1000);
    }

    if (fade > 0 || stage === "escaped") {
      ctx.fillStyle = `rgba(0, 0, 0, ${stage === "escaped" ? 1 : fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Workbench",
    exitLine: "You crawled down the escape route and came out in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
