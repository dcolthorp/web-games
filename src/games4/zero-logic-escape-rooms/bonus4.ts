import { H, W, clamp, ctx, drawCaption, inRect, lerp, line, roundRect, type Point } from "./engine";
import type { BonusLevel } from "./bonus2";
import { sounds } from "./sound";
import { collectSwitchPiece, drawSwitchPiece, hasSwitchPiece } from "./switchPieces";

// Chalkboard's bonus level, behind the flap above the faint line. It's another
// chalkboard, covered in math: 20 easy ones, 10 hard ones, then √−1, then a
// giant equation times zero with a ÷ 0 hiding inside it. Each one has chalk
// answers to pick from, and a wrong pick gets crossed out. Picking any answer
// for the giant one breaks the chalkboard, and behind it is switch piece 3.
// Back steps out without losing your place in the equations.

type Phase = "solving" | "breaking" | "reward";
type Kind = "easy" | "hard" | "imaginary" | "giant";

interface Problem {
  text: string;
  answer: string;
  choices: string[];
  kind: Kind;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CHALK = "rgba(246, 246, 240, 0.93)";
const GREEN_CHALK = "#9be89b";
const RED_CHALK = "#ef6f6c";
const CHALK_FONT = "'Chalkboard SE', 'Comic Sans MS', 'Trebuchet MS', sans-serif";

const FRAME = 26;
const TRAY_TOP = H - 44;
const BACK_BUTTON: Rect = { x: W - 118, y: TRAY_TOP + 8, w: 100, h: 30 };

const EASY_COUNT = 20;
const HARD_COUNT = 10;
const GIANT =
  "1*(5+2/0.5*123456765434567654334567486364565769276876498638768736867865873678634875684658436895648973563489/0)*0";
const GIANT_LINE_CHARS = 42;

const EQUATION_X = 600;
const CHOICE_W = 130;
const CHOICE_H = 70;
const CHOICE_GAP = 24;
const CHOICE_Y = 380;
const DIVIDER_X = 290;
const LIST_ROWS = 11;

const RIGHT_MS = 450;
const WIGGLE_MS = 400;
const CRACK_MS = 900;
const FALL_MS = 900;
const CHUNK_COLS = 4;
const CHUNK_ROWS = 3;

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

// A problem with a number for an answer, and three wrong answers close to it.
function numeric(text: string, answer: number, kind: Kind): Problem {
  const options = new Set<number>([answer]);
  const nudges = [1, 2, 3, 10, -1, -2, -3, -10];
  while (options.size < 4) {
    const guess = answer + (nudges[randInt(0, nudges.length - 1)] ?? 1);
    if (guess >= 0) options.add(guess);
  }
  return { text, answer: String(answer), choices: shuffle([...options].map(String)), kind };
}

function easyProblem(): Problem {
  const pick = randInt(0, 2);
  if (pick === 0) {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    return numeric(`${a} + ${b}`, a + b, "easy");
  }
  if (pick === 1) {
    const a = randInt(5, 15);
    const b = randInt(1, a);
    return numeric(`${a} − ${b}`, a - b, "easy");
  }
  const a = randInt(1, 5);
  const b = randInt(1, 5);
  return numeric(`${a} × ${b}`, a * b, "easy");
}

function hardProblem(): Problem {
  switch (randInt(0, 5)) {
    case 0: {
      const a = randInt(6, 12);
      const b = randInt(6, 12);
      return numeric(`${a} × ${b}`, a * b, "hard");
    }
    case 1: {
      const b = randInt(3, 12);
      const q = randInt(3, 12);
      return numeric(`${b * q} ÷ ${b}`, q, "hard");
    }
    case 2: {
      const a = randInt(2, 9);
      const b = randInt(2, 9);
      const c = randInt(2, 9);
      return numeric(`${a} + ${b} × ${c}`, a + b * c, "hard");
    }
    case 3: {
      const a = randInt(4, 15);
      return numeric(`${a}²`, a * a, "hard");
    }
    case 4: {
      const a = randInt(4, 12);
      return numeric(`√${a * a}`, a, "hard");
    }
    default: {
      const a = randInt(25, 99);
      const b = randInt(11, 49);
      return numeric(`${a} + ${b}`, a + b, "hard");
    }
  }
}

function makeProblems(): Problem[] {
  return [
    ...Array.from({ length: EASY_COUNT }, easyProblem),
    ...Array.from({ length: HARD_COUNT }, hardProblem),
    { text: "√−1", answer: "i", choices: shuffle(["i", "1", "−1", "0"]), kind: "imaginary" },
    // Any answer to this one breaks the chalkboard.
    { text: GIANT, answer: "", choices: ["0", "undefined", "∞", "error"], kind: "giant" },
  ];
}

function choiceRect(i: number): Rect {
  const total = CHOICE_W * 4 + CHOICE_GAP * 3;
  return { x: EQUATION_X - total / 2 + i * (CHOICE_W + CHOICE_GAP), y: CHOICE_Y, w: CHOICE_W, h: CHOICE_H };
}

const overRect = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);

// leave(true) after getting switch piece 3; leave(false) from the Back button.
export function createMathBonus(leave: (done: boolean) => void): BonusLevel {
  let phase: Phase = "solving";
  let phaseStart = 0;
  let levelStart = 0;
  let problems: Problem[] = [];
  let index = 0;
  let crossed = new Set<number>();
  let wrongIndex = -1;
  let wrongAt = -Infinity;
  let solvedAt: number | null = null;
  let solvedChoice = -1;
  let solved: string[] = [];
  let cracks: [number, number][][] = [];
  let pieceWasNew = true;

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  function reset(now: number): void {
    setPhase("solving", now);
    levelStart = now;
    problems = makeProblems();
    index = 0;
    crossed = new Set();
    wrongIndex = -1;
    wrongAt = -Infinity;
    solvedAt = null;
    solvedChoice = -1;
    solved = [];
    cracks = [];
  }

  // ---------- input ----------

  function startBreak(at: Point, now: number): void {
    sounds.crack();
    sounds.crash();
    // Cracks shoot out from where you clicked, wandering a little as they go.
    cracks = [];
    for (let r = 0; r < 9; r += 1) {
      let angle = (r / 9) * Math.PI * 2 + Math.random() * 0.4;
      let x = at.x;
      let y = at.y;
      const points: [number, number][] = [[x, y]];
      for (let s = 0; s < 7; s += 1) {
        angle += (Math.random() - 0.5) * 0.9;
        const length = 40 + Math.random() * 60;
        x += Math.cos(angle) * length;
        y += Math.sin(angle) * length;
        points.push([x, y]);
      }
      cracks.push(points);
    }
    setPhase("breaking", now);
  }

  function pointerDown(p: Point): void {
    const now = performance.now();
    if (phase === "reward") {
      leave(true);
      return;
    }
    if (phase === "breaking") return;
    if (overRect(p, BACK_BUTTON)) {
      sounds.tink();
      leave(false);
      return;
    }
    if (solvedAt !== null) return;

    const problem = problems[index];
    if (!problem) return;
    const choice = problem.choices.findIndex((_, i) => !crossed.has(i) && overRect(p, choiceRect(i)));
    if (choice < 0) return;

    if (problem.kind === "giant") {
      startBreak(p, now);
    } else if (problem.choices[choice] === problem.answer) {
      solvedAt = now;
      solvedChoice = choice;
      sounds.chime();
    } else {
      crossed.add(choice);
      wrongIndex = choice;
      wrongAt = now;
      sounds.womp();
    }
  }

  function pointerMove(): void {}

  function cursor(p: Point): string {
    if (phase === "reward") return "pointer";
    if (phase === "breaking") return "default";
    if (overRect(p, BACK_BUTTON)) return "pointer";
    const problem = problems[index];
    if (!problem || solvedAt !== null) return "default";
    return problem.choices.some((_, i) => !crossed.has(i) && overRect(p, choiceRect(i))) ? "pointer" : "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    if (phase === "solving" && solvedAt !== null && now - solvedAt >= RIGHT_MS) {
      const problem = problems[index];
      if (problem) solved.push(`${problem.text} = ${problem.answer}`);
      index += 1;
      crossed = new Set();
      wrongIndex = -1;
      solvedAt = null;
      solvedChoice = -1;
    } else if (phase === "breaking" && now - phaseStart >= CRACK_MS + FALL_MS) {
      pieceWasNew = !hasSwitchPiece(3);
      collectSwitchPiece(3);
      sounds.chime();
      setPhase("reward", now);
    }
  }

  // ---------- drawing ----------

  function drawProblem(problem: Problem, now: number): void {
    ctx.fillStyle = CHALK;
    ctx.textBaseline = "middle";
    if (problem.kind === "giant") {
      ctx.textAlign = "center";
      ctx.font = "17px 'Courier New', monospace";
      const lines: string[] = [];
      for (let i = 0; i < problem.text.length; i += GIANT_LINE_CHARS) lines.push(problem.text.slice(i, i + GIANT_LINE_CHARS));
      lines.forEach((text, i) => ctx.fillText(text, EQUATION_X, 150 + i * 28));
      ctx.font = `48px ${CHALK_FONT}`;
      ctx.fillText("= ?", EQUATION_X, 150 + lines.length * 28 + 50);
    } else {
      // The answer goes where the ? was, in green, once you get it right.
      const left = `${problem.text} = `;
      const answer = solvedAt !== null ? problem.answer : "?";
      ctx.font = `64px ${CHALK_FONT}`;
      const leftW = ctx.measureText(left).width;
      const startX = EQUATION_X - (leftW + ctx.measureText(answer).width) / 2;
      ctx.textAlign = "left";
      ctx.fillText(left, startX, 220);
      ctx.fillStyle = solvedAt !== null ? GREEN_CHALK : CHALK;
      ctx.fillText(answer, startX + leftW, 220);
    }

    problem.choices.forEach((choice, i) => {
      const r = choiceRect(i);
      const wiggle = i === wrongIndex ? now - wrongAt : Infinity;
      const dx = wiggle < WIGGLE_MS ? Math.sin(wiggle / 25) * 6 * (1 - wiggle / WIGGLE_MS) : 0;
      const right = solvedAt !== null && i === solvedChoice;
      ctx.strokeStyle = right ? GREEN_CHALK : CHALK;
      ctx.lineWidth = 4;
      roundRect(r.x + dx, r.y, r.w, r.h, 12);
      ctx.stroke();
      ctx.fillStyle = right ? GREEN_CHALK : CHALK;
      ctx.font = `${choice.length > 3 ? 24 : 36}px ${CHALK_FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(choice, r.x + dx + r.w / 2, r.y + r.h / 2 + 2);
      if (crossed.has(i)) {
        ctx.strokeStyle = RED_CHALK;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        line(r.x + dx + 14, r.y + 12, r.x + dx + r.w - 14, r.y + r.h - 12);
        line(r.x + dx + r.w - 14, r.y + 12, r.x + dx + 14, r.y + r.h - 12);
        ctx.lineCap = "butt";
      }
    });
  }

  function drawCracks(now: number): void {
    const progress = clamp((now - phaseStart) / CRACK_MS, 0, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [color, width, offset] of [
      ["rgba(255, 255, 255, 0.35)", 2, 1.5],
      ["rgba(10, 10, 10, 0.9)", 3, 0],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      for (const crack of cracks) {
        const first = crack[0];
        if (!first) continue;
        const segments = (crack.length - 1) * progress;
        ctx.beginPath();
        ctx.moveTo(first[0] + offset, first[1] + offset);
        for (let i = 1; i < crack.length; i += 1) {
          const a = crack[i - 1];
          const b = crack[i];
          const f = clamp(segments - (i - 1), 0, 1);
          if (!a || !b || f <= 0) break;
          ctx.lineTo(lerp(a[0], b[0], f) + offset, lerp(a[1], b[1], f) + offset);
        }
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }

  function drawBoard(now: number): void {
    ctx.fillStyle = "#7b5230";
    ctx.fillRect(0, 0, W, H);
    const slate = ctx.createLinearGradient(0, FRAME, 0, TRAY_TOP);
    slate.addColorStop(0, "#34503f");
    slate.addColorStop(1, "#273e31");
    ctx.fillStyle = slate;
    ctx.fillRect(FRAME, FRAME, W - FRAME * 2, TRAY_TOP - FRAME);

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

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 7);
    ctx.fill();
    ctx.fillStyle = "#f4f4ee";
    ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2 + 1);

    ctx.fillStyle = "#c77dff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BONUS LEVEL", W - FRAME - 20, FRAME + 24);
    ctx.fillStyle = "rgba(246, 246, 240, 0.6)";
    ctx.font = `18px ${CHALK_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(`Equation ${Math.min(index + 1, problems.length)} of ${problems.length}`, EQUATION_X, FRAME + 24);

    // The ones you've done, down the left side. Older ones fade out.
    ctx.strokeStyle = "rgba(246, 246, 240, 0.25)";
    ctx.lineWidth = 3;
    line(DIVIDER_X, FRAME + 40, DIVIDER_X, TRAY_TOP - 20);
    const recent = solved.slice(-LIST_ROWS);
    ctx.textAlign = "left";
    ctx.font = `20px ${CHALK_FONT}`;
    recent.forEach((text, i) => {
      ctx.fillStyle = `rgba(246, 246, 240, ${lerp(0.25, 0.8, (i + 1) / recent.length)})`;
      ctx.fillText(text, FRAME + 30, FRAME + 60 + i * 42);
    });

    const problem = problems[index];
    if (problem) drawProblem(problem, now);
    if (phase === "breaking") drawCracks(now);
  }

  function drawRewardBackground(): void {
    const bg = ctx.createRadialGradient(W / 2, H / 2 - 20, 20, W / 2, H / 2, 540);
    bg.addColorStop(0, "#3a1063");
    bg.addColorStop(1, "#0b0414");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // The chalkboard shakes while it cracks, then falls apart in pieces.
  function drawBreaking(now: number): void {
    const elapsed = now - phaseStart;
    if (elapsed < CRACK_MS) {
      const shake = (1 - elapsed / CRACK_MS) * 8;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      drawBoard(now);
      ctx.restore();
      return;
    }

    drawRewardBackground();
    const t = (elapsed - CRACK_MS) / 1000;
    const cw = W / CHUNK_COLS;
    const ch = H / CHUNK_ROWS;
    for (let row = 0; row < CHUNK_ROWS; row += 1) {
      for (let col = 0; col < CHUNK_COLS; col += 1) {
        const cx = (col + 0.5) * cw;
        const cy = (row + 0.5) * ch;
        // The bottom row goes first, and the rest follow a moment later.
        const delay = (CHUNK_ROWS - 1 - row) * 0.06 + ((col * 7 + row * 3) % 4) * 0.03;
        const ft = Math.max(0, t - delay);
        ctx.save();
        ctx.translate(cx + (col - 1.5) * 90 * ft, cy + 1100 * ft * ft);
        ctx.rotate((col - 1.5) * 0.5 * ft);
        ctx.beginPath();
        ctx.rect(-cw / 2, -ch / 2, cw, ch);
        ctx.clip();
        ctx.translate(-cx, -cy);
        drawBoard(now);
        ctx.restore();
      }
    }
    const flash = 1 - (elapsed - CRACK_MS) / 150;
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * flash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function shout(text: string, y: number, font: string, color: string): void {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000";
    ctx.strokeText(text, W / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);
  }

  function drawReward(now: number): void {
    drawRewardBackground();
    ctx.globalAlpha = Math.min(1, (now - phaseStart) / 500);
    ctx.fillStyle = "#2e1a4d";
    ctx.fillRect(W / 2 - 45, 426, 90, 110);
    ctx.fillStyle = "#4b2a78";
    roundRect(W / 2 - 70, 400, 140, 26, 6);
    ctx.fill();

    const glow = ctx.createRadialGradient(W / 2, 300, 10, W / 2, 300, 140);
    glow.addColorStop(0, `rgba(214, 160, 255, ${0.5 + 0.2 * Math.sin(now / 300)})`);
    glow.addColorStop(1, "rgba(214, 160, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 140, 160, 280, 280);
    drawSwitchPiece(3, W / 2, 300 + Math.sin(now / 400) * 8, 2.4);

    shout("SWITCH PIECE 3", 105, "58px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", "#ffcf5a");
    shout(
      pieceWasNew ? "You found the third switch piece!" : "You already have this one.",
      160,
      "bold 24px 'Trebuchet MS', sans-serif",
      "#f5efe6"
    );
    shout("Click to go back.", 570, "bold 20px 'Trebuchet MS', sans-serif", "#b9adc4");
    ctx.globalAlpha = 1;
  }

  function draw(now: number): void {
    if (phase === "reward") {
      drawReward(now);
      return;
    }
    if (phase === "breaking") {
      drawBreaking(now);
      return;
    }
    drawBoard(now);
    drawCaption("Solve the chalkboard.", (now - levelStart) / 1000);
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
