import { H, W, clamp, ctx, drawCaption, inRect, roundRect, type Point } from "./engine";
import type { BonusLevel } from "./bonus2";
import {
  EARTH_FRAGMENT_COUNT,
  collectEarthFragment,
  collectedEarthFragments,
  drawEarthFragment,
  hasEarthFragment,
} from "./earthFragments";
import { FLOAT_MS, drawFloaters, type Floater } from "./hundred";
import { sounds } from "./sound";

// Behind the secret keyhole in Hundred Logic's Chalkboard: a bonus level as big
// as the chalkboard. Chalk numbers float on water in a pile, and Earth Fragment
// 4 is balanced on the very top, too high to reach. Drop math symbols into the
// water. They're heavy, so they splash, and the waves rock the pile until the
// Earth piece tips off. Once it's floating in the water, you can reach it.

type SymbolKind = "+" | "−" | "×" | "÷" | "=";
type Phase = "play" | "reward";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Body {
  kind: "number" | "earth" | "symbol";
  // The digit on a number, or the shape of a symbol piece.
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  density: number;
  // How much of it is under the water, from 0 to 1.
  under: number;
  sunkAt: number | null;
}

interface SymbolPiece {
  label: string;
  w: number;
  h: number;
  dy: number;
  density: number;
}

const CHALK = "rgba(246, 246, 240, 0.93)";
const CHALK_FONT = "'Chalkboard SE', 'Comic Sans MS', 'Trebuchet MS', sans-serif";
const FRAME = 16;
const LEFT = FRAME + 10;
const RIGHT = W - FRAME - 10;
const BOTTOM = H - FRAME - 6;
const WATER_REST = 400;
const TRAY_BOTTOM = 84;
const COLUMN_GAP = 8;
const COLUMNS = Math.floor((RIGHT - LEFT) / COLUMN_GAP) + 1;

const STEP_MS = 1000 / 60;
const MAX_STEPS = 6;
const GRAVITY = 0.35;
const WAVE_PUSH = 1.6;
const FRICTION = 0.25;
const SOLVER_PASSES = 4;
const SETTLE_STEPS = 240;

const TILE = 56;
const TILE_DENSITY = 0.22;
const EARTH_SIZE = 44;
const EARTH_SCALE = EARTH_SIZE / 50;
// drawEarthFragment puts the wedge a little off from (x, y); this lines it up with the body.
const EARTH_OFFSET = 10.86 * EARTH_SCALE;
// A floating Earth piece is only about a fifth under water, and it bobs, so
// any wet bottom at all counts as in the water.
const REACH_UNDER = 0.05;
const PILE_X = 560;

const SYMBOLS: SymbolKind[] = ["+", "−", "×", "÷", "="];
const SYMBOL_COLORS: Record<SymbolKind, string> = {
  "+": "#ffd23f",
  "−": "#9be89b",
  "×": "#ff8fab",
  "÷": "#7fd0ff",
  "=": "#ffb86b",
};
// Bigger, heavier symbols make bigger splashes. An equals sign is a belly flop,
// and a divide sign comes apart into three little splashes.
const SYMBOL_PIECES: Record<SymbolKind, SymbolPiece[]> = {
  "+": [{ label: "+", w: 44, h: 44, dy: 0, density: 1.5 }],
  "−": [{ label: "−", w: 44, h: 14, dy: 0, density: 1.3 }],
  "×": [{ label: "×", w: 42, h: 42, dy: 0, density: 1.5 }],
  "÷": [
    { label: "•", w: 16, h: 16, dy: -26, density: 1.8 },
    { label: "−", w: 44, h: 12, dy: 0, density: 1.8 },
    { label: "•", w: 16, h: 16, dy: 26, density: 1.8 },
  ],
  "=": [{ label: "=", w: 66, h: 32, dy: 0, density: 1.6 }],
};
const DROP_COOLDOWN_MS = 250;
const MAX_SYMBOLS = 18;
const SUNK_MS = 1800;
const FADE_MS = 600;

const BACK_BUTTON: Rect = { x: FRAME + 14, y: 24, w: 96, h: 40 };
const buttonRect = (i: number): Rect => ({ x: W / 2 - 186 + i * 76, y: 20, w: 64, h: 52 });
const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

const randomDigit = (): string => String(Math.floor(Math.random() * 10));

function makeBody(kind: Body["kind"], label: string, color: string, x: number, y: number, w: number, h: number, density: number): Body {
  return { kind, label, color, x, y, w, h, vx: 0, vy: 0, density, under: 0, sunkAt: null };
}

// leave is called from the Back button and after getting the fragment.
export function createNumberPool(leave: () => void): BonusLevel {
  const surface = new Float64Array(COLUMNS);
  const speed = new Float64Array(COLUMNS);
  let bodies: Body[] = [];
  let phase: Phase = "play";
  let phaseStart = 0;
  let levelStart = 0;
  let lastStep = 0;
  let selected: SymbolKind = "+";
  let lastDropAt = -Infinity;
  let lastSplashSound = -Infinity;
  // Once the Earth piece has fallen in the water it's low enough to reach, even
  // if a wave bobs it back up onto a number.
  let earthWasWet = false;
  let fragmentWasNew = true;
  let floaters: Floater[] = [];
  let pointer: Point = { x: W / 2, y: H / 2 };

  const column = (i: number): number => surface[i] ?? WATER_REST;
  const earthBody = (): Body | undefined => bodies.find((b) => b.kind === "earth");
  const overEarth = (p: Point, b: Body): boolean => inRect(p, b.x - b.w / 2 - 12, b.y - b.h / 2 - 12, b.w + 24, b.h + 24);

  function waterAt(x: number): number {
    const f = clamp((x - LEFT) / COLUMN_GAP, 0, COLUMNS - 1);
    const i = Math.floor(f);
    const next = Math.min(i + 1, COLUMNS - 1);
    return column(i) + (column(next) - column(i)) * (f - i);
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(TRAY_BOTTOM + 30, y), start: now });
  }

  // ---------- physics ----------

  function splash(x: number, width: number, power: number, now: number): void {
    const from = Math.max(0, Math.floor((x - width / 2 - LEFT) / COLUMN_GAP));
    const to = Math.min(COLUMNS - 1, Math.ceil((x + width / 2 - LEFT) / COLUMN_GAP));
    for (let i = from; i <= to; i += 1) speed[i] = (speed[i] ?? 0) + power;
    if (power > 2 && now - lastSplashSound > 90) {
      lastSplashSound = now;
      if (power > 6) sounds.splat();
      else sounds.squish();
    }
  }

  function stepWater(): void {
    for (let i = 0; i < COLUMNS; i += 1) {
      const v = (speed[i] ?? 0) - 0.03 * (column(i) - WATER_REST) - 0.015 * (speed[i] ?? 0);
      speed[i] = v;
      surface[i] = clamp(column(i) + v, WATER_REST - 150, WATER_REST + 120);
    }
    // Each column pulls its neighbours toward it, so a splash spreads out as waves.
    for (let pass = 0; pass < 3; pass += 1) {
      for (let i = 0; i < COLUMNS; i += 1) {
        if (i > 0) speed[i - 1] = (speed[i - 1] ?? 0) + 0.2 * (column(i) - column(i - 1));
        if (i < COLUMNS - 1) speed[i + 1] = (speed[i + 1] ?? 0) + 0.2 * (column(i) - column(i + 1));
      }
    }
  }

  function stepBody(b: Body, now: number): void {
    const edge = b.w * 0.4;
    const left = waterAt(b.x - edge);
    const right = waterAt(b.x + edge);
    const level = (left + waterAt(b.x) + right) / 3;
    const under = clamp((b.y + b.h / 2 - level) / b.h, 0, 1);
    // Light things float and heavy things sink.
    b.vy += GRAVITY - (GRAVITY * under) / b.density;
    if (under > 0) {
      // Slide downhill off the waves.
      b.vx += ((right - left) / (edge * 2)) * WAVE_PUSH * under;
      b.vx *= 1 - 0.03 * under;
      b.vy *= 1 - 0.08 * under;
    }
    if (b.under === 0 && under > 0 && b.vy > 2) {
      splash(b.x, b.w + 12, Math.min(10, (b.vy * Math.sqrt(b.w * b.h * b.density)) / 70), now);
    }
    b.under = under;
    if (b.kind === "symbol" && under >= 1) b.sunkAt ??= now;

    b.x += b.vx;
    b.y += b.vy;
    if (b.x - b.w / 2 < LEFT) {
      b.x = LEFT + b.w / 2;
      b.vx = Math.abs(b.vx) * 0.3;
    } else if (b.x + b.w / 2 > RIGHT) {
      b.x = RIGHT - b.w / 2;
      b.vx = -Math.abs(b.vx) * 0.3;
    }
    if (b.y + b.h / 2 > BOTTOM) {
      b.y = BOTTOM - b.h / 2;
      b.vy = 0;
      b.vx *= 0.9;
    }
  }

  // Two boxes overlapping get pushed apart the shortest way, the lighter one moving more.
  function resolvePair(a: Body, b: Body): void {
    const dx = b.x - a.x;
    const px = (a.w + b.w) / 2 - Math.abs(dx);
    if (px <= 0) return;
    const dy = b.y - a.y;
    const py = (a.h + b.h) / 2 - Math.abs(dy);
    if (py <= 0) return;
    const ia = 1 / (a.density * a.w * a.h);
    const ib = 1 / (b.density * b.w * b.h);
    const sum = ia + ib;
    if (px < py) {
      const n = dx < 0 ? -1 : 1;
      a.x -= (n * px * ia) / sum;
      b.x += (n * px * ib) / sum;
      const closing = (b.vx - a.vx) * n;
      if (closing < 0) {
        const j = (-1.1 * closing) / sum;
        a.vx -= j * ia * n;
        b.vx += j * ib * n;
      }
      return;
    }
    const n = dy < 0 ? -1 : 1;
    a.y -= (n * py * ia) / sum;
    b.y += (n * py * ib) / sum;
    const closing = (b.vy - a.vy) * n;
    if (closing < 0) {
      const j = (-1.1 * closing) / sum;
      a.vy -= j * ia * n;
      b.vy += j * ib * n;
      // Things resting on each other drag each other along a bit.
      const slide = ((b.vx - a.vx) * FRICTION) / sum;
      a.vx += slide * ia;
      b.vx -= slide * ib;
    }
  }

  function stepWorld(now: number): void {
    stepWater();
    for (const b of bodies) stepBody(b, now);
    for (let pass = 0; pass < SOLVER_PASSES; pass += 1) {
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i];
          const b = bodies[j];
          if (a && b) resolvePair(a, b);
        }
      }
    }
  }

  // ---------- lifecycle ----------

  function reset(now: number): void {
    phase = "play";
    phaseStart = now;
    levelStart = now;
    lastStep = now;
    selected = "+";
    lastDropAt = -Infinity;
    earthWasWet = false;
    floaters = [];
    surface.fill(WATER_REST);
    speed.fill(0);
    bodies = [];
    // The pile: four numbers floating, three on those, two on top, and the Earth piece on the very top.
    [4, 3, 2].forEach((count, row) => {
      for (let i = 0; i < count; i += 1) {
        const x = PILE_X + (i - (count - 1) / 2) * TILE;
        bodies.push(makeBody("number", randomDigit(), CHALK, x, WATER_REST + 4 - row * TILE, TILE, TILE, TILE_DENSITY));
      }
    });
    const earthY = WATER_REST + 4 - 2 * TILE - TILE / 2 - EARTH_SIZE / 2;
    bodies.push(makeBody("earth", "", "", PILE_X, earthY, EARTH_SIZE, EARTH_SIZE, TILE_DENSITY));
    // A few loose numbers floating around the rest of the water.
    for (const x of [150, 280, 830]) {
      bodies.push(makeBody("number", randomDigit(), CHALK, x, WATER_REST - TILE / 2 + TILE_DENSITY * TILE, TILE, TILE, TILE_DENSITY));
    }
    // Let everything settle before you see it.
    for (let i = 0; i < SETTLE_STEPS; i += 1) stepWorld(now);
    for (const b of bodies) {
      b.vx = 0;
      b.vy = 0;
    }
  }

  function drop(p: Point, now: number): void {
    if (now - lastDropAt < DROP_COOLDOWN_MS) return;
    lastDropAt = now;
    const pieces = SYMBOL_PIECES[selected];
    const top = Math.min(...pieces.map((piece) => piece.dy - piece.h / 2));
    const bottom = Math.max(...pieces.map((piece) => piece.dy + piece.h / 2));
    const halfW = Math.max(...pieces.map((piece) => piece.w / 2));
    const x = clamp(p.x, LEFT + halfW, RIGHT - halfW);
    // It always starts above the water and above anything floating under it.
    let lowest = waterAt(x) - 30;
    for (const b of bodies) {
      if (Math.abs(b.x - x) < b.w / 2 + halfW) lowest = Math.min(lowest, b.y - b.h / 2 - 6);
    }
    const y = Math.max(TRAY_BOTTOM + 10 - top, Math.min(p.y, lowest - bottom));
    for (const piece of pieces) {
      bodies.push(makeBody("symbol", piece.label, SYMBOL_COLORS[selected], x, y + piece.dy, piece.w, piece.h, piece.density));
    }
    const symbols = bodies.filter((b) => b.kind === "symbol");
    for (const old of symbols.slice(0, Math.max(0, symbols.length - MAX_SYMBOLS))) bodies.splice(bodies.indexOf(old), 1);
    sounds.pop();
  }

  // ---------- input ----------

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();
    if (phase === "reward") {
      leave();
      return;
    }
    if (over(p, BACK_BUTTON)) {
      sounds.tink();
      leave();
      return;
    }
    for (let i = 0; i < SYMBOLS.length; i += 1) {
      const kind = SYMBOLS[i];
      if (kind && over(p, buttonRect(i))) {
        selected = kind;
        sounds.tap();
        return;
      }
    }
    const earth = earthBody();
    if (earth && overEarth(p, earth)) {
      if (earthWasWet || earth.under > REACH_UNDER) {
        fragmentWasNew = !hasEarthFragment(4);
        collectEarthFragment(4);
        sounds.chime();
        phase = "reward";
        phaseStart = now;
      } else {
        sounds.bonk();
        say("It's too high up to reach. Knock it into the water!", earth.x, earth.y - 60, now);
      }
      return;
    }
    if (p.y > TRAY_BOTTOM) drop(p, now);
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function cursor(p: Point): string {
    if (phase === "reward" || over(p, BACK_BUTTON)) return "pointer";
    for (let i = 0; i < SYMBOLS.length; i += 1) if (over(p, buttonRect(i))) return "pointer";
    const earth = earthBody();
    if (earth && overEarth(p, earth)) return "pointer";
    return p.y > TRAY_BOTTOM ? "crosshair" : "default";
  }

  function update(now: number): void {
    if (phase === "play") {
      let steps = 0;
      while (lastStep + STEP_MS <= now && steps < MAX_STEPS) {
        stepWorld(now);
        lastStep += STEP_MS;
        steps += 1;
      }
      // Coming back after a pause, don't try to catch up.
      if (steps === MAX_STEPS) lastStep = now;
      bodies = bodies.filter((b) => b.sunkAt === null || now - b.sunkAt < SUNK_MS + FADE_MS);
      const earth = earthBody();
      if (earth && earth.under > REACH_UNDER && !earthWasWet) {
        earthWasWet = true;
        say("The Earth piece is in the water! Click it.", earth.x, earth.y - 70, now);
      }
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawShape(label: string, x: number, y: number, w: number, h: number, thick: number): void {
    if (label === "+" || label === "×") {
      ctx.save();
      ctx.translate(x, y);
      if (label === "×") ctx.rotate(Math.PI / 4);
      const arm = label === "×" ? 1.2 : 1;
      ctx.fillRect((-w * arm) / 2, -thick / 2, w * arm, thick);
      ctx.fillRect(-thick / 2, (-h * arm) / 2, thick, h * arm);
      ctx.restore();
    } else if (label === "=") {
      const bar = h * 0.36;
      ctx.fillRect(x - w / 2, y - h / 2, w, bar);
      ctx.fillRect(x - w / 2, y + h / 2 - bar, w, bar);
    } else if (label === "•") {
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
    }
  }

  function drawSymbolSet(kind: SymbolKind, x: number, y: number, scale: number): void {
    ctx.fillStyle = SYMBOL_COLORS[kind];
    for (const piece of SYMBOL_PIECES[kind]) {
      drawShape(piece.label, x, y + piece.dy * scale, piece.w * scale, piece.h * scale, Math.max(4, 12 * scale));
    }
  }

  function drawBody(b: Body, now: number): void {
    if (b.kind === "earth") {
      if (earthWasWet && phase === "play") {
        ctx.strokeStyle = `rgba(255, 236, 150, ${0.5 + 0.4 * Math.sin(now / 180)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 38, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawEarthFragment(4, b.x + EARTH_OFFSET, b.y + EARTH_OFFSET, EARTH_SCALE);
      return;
    }
    if (b.kind === "number") {
      ctx.fillStyle = "rgba(240, 240, 228, 0.14)";
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.strokeStyle = CHALK;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - b.w / 2 + 1.5, b.y - b.h / 2 + 1.5, b.w - 3, b.h - 3);
      ctx.fillStyle = CHALK;
      ctx.font = `38px ${CHALK_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y + 2);
      return;
    }
    ctx.save();
    if (b.sunkAt !== null) ctx.globalAlpha = clamp(1 - (now - b.sunkAt - SUNK_MS) / FADE_MS, 0, 1);
    ctx.fillStyle = b.color;
    drawShape(b.label, b.x, b.y, b.w, b.h, 12);
    ctx.restore();
  }

  function drawWater(): void {
    const lastX = LEFT + (COLUMNS - 1) * COLUMN_GAP;
    ctx.beginPath();
    ctx.moveTo(LEFT, BOTTOM);
    for (let i = 0; i < COLUMNS; i += 1) ctx.lineTo(LEFT + i * COLUMN_GAP, column(i));
    ctx.lineTo(lastX, BOTTOM);
    ctx.closePath();
    const water = ctx.createLinearGradient(0, WATER_REST - 100, 0, BOTTOM);
    water.addColorStop(0, "rgba(120, 200, 245, 0.5)");
    water.addColorStop(1, "rgba(40, 110, 190, 0.75)");
    ctx.fillStyle = water;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < COLUMNS; i += 1) {
      if (i === 0) ctx.moveTo(LEFT, column(i));
      else ctx.lineTo(LEFT + i * COLUMN_GAP, column(i));
    }
    ctx.strokeStyle = "rgba(230, 245, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawTray(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);

    for (let i = 0; i < SYMBOLS.length; i += 1) {
      const kind = SYMBOLS[i];
      if (!kind) continue;
      const r = buttonRect(i);
      const isSelected = kind === selected;
      ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.28)";
      roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();
      ctx.strokeStyle = isSelected ? SYMBOL_COLORS[kind] : "rgba(246, 246, 240, 0.35)";
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.stroke();
      drawSymbolSet(kind, r.x + r.w / 2, r.y + r.h / 2, 0.62);
    }

    ctx.fillStyle = "#c9a6ff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BONUS LEVEL", W - FRAME - 18, 44);
  }

  function drawFrame(): void {
    ctx.fillStyle = "#7b5230";
    ctx.fillRect(0, 0, W, FRAME);
    ctx.fillRect(0, H - FRAME, W, FRAME);
    ctx.fillRect(0, 0, FRAME, H);
    ctx.fillRect(W - FRAME, 0, FRAME, H);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(FRAME, FRAME, W - FRAME * 2, H - FRAME * 2);
  }

  function draw(now: number): void {
    ctx.fillStyle = "#2f4a3a";
    ctx.fillRect(0, 0, W, H);
    // Old chalk that didn't quite get erased
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let i = 0; i < 14; i += 1) {
      ctx.beginPath();
      ctx.ellipse((i * 173) % W, 110 + ((i * 97) % 260), 90, 26, (i % 3) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(246, 246, 240, 0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LEFT, WATER_REST - 170);
    ctx.lineTo(LEFT, BOTTOM);
    ctx.lineTo(RIGHT, BOTTOM);
    ctx.lineTo(RIGHT, WATER_REST - 170);
    ctx.stroke();

    for (const b of bodies) drawBody(b, now);
    drawWater();

    const earth = earthBody();
    if (phase === "play" && pointer.y > TRAY_BOTTOM && !(earth && overEarth(pointer, earth))) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawSymbolSet(selected, pointer.x, pointer.y, 1);
      ctx.restore();
    }

    drawFrame();
    drawTray();
    if (phase === "play") drawCaption("Drop math into the water. Knock the Earth piece in!", (now - levelStart) / 1000);
    drawFloaters(floaters, now);

    if (phase === "reward") {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.75, (now - phaseStart) / 500)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#000";
      ctx.font = "54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.strokeText("EARTH FRAGMENT 4", W / 2, H / 2 - 150);
      ctx.fillStyle = "#ffcf5a";
      ctx.fillText("EARTH FRAGMENT 4", W / 2, H / 2 - 150);
      drawEarthFragment(4, W / 2 + 10.86 * 1.6, H / 2 - 10 + 10.86 * 1.6 + Math.sin(now / 400) * 6, 1.6);
      ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      const all = collectedEarthFragments().length === EARTH_FRAGMENT_COUNT;
      const message = !fragmentWasNew
        ? "You already have Earth Fragment 4."
        : all
          ? "That's all 4! Leave the game to put the Earth together."
          : "It fell right in the water!";
      ctx.strokeText(message, W / 2, H / 2 + 110);
      ctx.fillStyle = "#f5efe6";
      ctx.fillText(message, W / 2, H / 2 + 110);
      ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#b9adc4";
      ctx.fillText("Click to go back.", W / 2, H / 2 + 150);
    }
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
