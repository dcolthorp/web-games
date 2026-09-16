// Roblox Trivia. Most of it is in plain sight; the rest has to be found by
// clicking a letter, dragging a trophy, or typing a word nobody told you.

import { DIFFICULTIES, ERROR_PARAGRAPHS, EXTRA_MODES, ultimateQuestions } from "./questions";
import {
  DEFAULT_BG,
  DEFAULT_TEXT,
  RESULT_DISPLAY_TIME,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  answer,
  availableDifficulties,
  currentQuestion,
  getDifficulty,
  pushErrorLetter,
  shuffle,
  startRun,
  styleFor,
  tickRun,
  trophyUnlocked,
  type PerfectStatus,
  type Run,
} from "./quiz";

const found = document.getElementById("game");
if (!(found instanceof HTMLCanvasElement)) throw new Error("no canvas");
// Named again so the handlers below know it's really a canvas.
const canvas: HTMLCanvasElement = found;
const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
const ctx: CanvasRenderingContext2D = context;

const SAVE_KEY = "roblox-trivia-progress";

interface Saved {
  perfect: PerfectStatus;
  ultimateBeaten: boolean;
  infiniteBest: number;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { perfect: {}, ultimateBeaten: false, infiniteBest: 0 };
    return { perfect: {}, ultimateBeaten: false, infiniteBest: 0, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    return { perfect: {}, ultimateBeaten: false, infiniteBest: 0 };
  }
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ perfect, ultimateBeaten, infiniteBest }));
  } catch {
    // Never mind.
  }
}

const saved = load();
const perfect: PerfectStatus = saved.perfect;
let ultimateBeaten = saved.ultimateBeaten;
let infiniteBest = saved.infiniteBest;

type Screen =
  | "select"
  | "extra"
  | "error"
  | "quiz"
  | "complete"
  | "infiniteSelect"
  | "infinite"
  | "infiniteOver"
  | "godBlackout"
  | "godMenu";

let screen: Screen = "select";
let run: Run | null = null;
let time = 0;

const random = Math.random;

// ---------------------------------------------------------------- the hitboxes

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  action: () => void;
}

let zones: Zone[] = [];
// One click should only ever do one thing: after it lands, the next screen
// ignores clicks for a moment so the same tap can't answer the question it
// just opened.
let clickShieldUntil = 0;
const zone = (x: number, y: number, w: number, h: number, action: () => void): void => {
  zones.push({ x, y, w, h, action });
};

// ------------------------------------------------------------- the secret bits

// Clicked letters on the title. The second "e" of Select opens the extra modes;
// both "i"s of Difficulty together open Infinite Mode.
const clickedIs = new Set<number>();
let errorBuffer = "";

// The trophy you drag into the corner.
const TROPHY = { w: 48, h: 44, homeX: 24, homeY: 24 };
const trophy = { x: TROPHY.homeX, y: TROPHY.homeY, dragging: false, dx: 0, dy: 0 };
const DROP = { size: 70, x: SCREEN_WIDTH - 70 - 24, y: SCREEN_HEIGHT - 70 - 24 };

// After ULTIMATE, the trophy is replaced by three tins of paint. All three in
// the corner makes a rainbow, and the rainbow is the way into God Mode.
interface Splat {
  name: string;
  color: string;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  dragging: boolean;
  dropped: boolean;
  dx: number;
  dy: number;
}

const splats: Splat[] = [
  { name: "Red", color: "#c80000", homeX: 24, homeY: 24, x: 24, y: 24, dragging: false, dropped: false, dx: 0, dy: 0 },
  { name: "Green", color: "#00aa00", homeX: 24, homeY: 80, x: 24, y: 80, dragging: false, dropped: false, dx: 0, dy: 0 },
  { name: "Blue", color: "#1e50c8", homeX: 24, homeY: 136, x: 24, y: 136, dragging: false, dropped: false, dx: 0, dy: 0 },
];
const SPLAT_SIZE = 52;
let blackoutTime = 0;

function resetSplats(): void {
  for (const splat of splats) {
    splat.x = splat.homeX;
    splat.y = splat.homeY;
    splat.dragging = false;
    splat.dropped = false;
  }
}

// ------------------------------------------------------------- infinite mode

let infinitePool: string = "Easy";
let infiniteScore = 0;
let infiniteQuestions: ReturnType<typeof ultimateQuestions> = [];
let infiniteIndex = 0;

function startInfinite(pool: string): void {
  infinitePool = pool;
  infiniteScore = 0;
  infiniteIndex = 0;
  const source = pool === "Every mode" ? ultimateQuestions() : (getDifficulty(pool)?.questions ?? []);
  // Endless: the pool gets reshuffled and dealt again forever.
  infiniteQuestions = shuffle(source, random);
  screen = "infinite";
  run = {
    difficultyName: pool,
    questions: infiniteQuestions,
    index: 0,
    score: 0,
    selected: null,
    showingResult: false,
    resultTime: 0,
    feedback: "",
    complete: false,
  };
}

// --------------------------------------------------------------- the painting

function text(
  content: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; align?: CanvasTextAlign; bold?: boolean } = {}
): number {
  ctx.font = `${options.bold ? "bold " : ""}${options.size ?? 28}px "Trebuchet MS", sans-serif`;
  ctx.fillStyle = options.color ?? DEFAULT_TEXT;
  ctx.textAlign = options.align ?? "center";
  ctx.textBaseline = "middle";
  ctx.fillText(content, x, y);
  return ctx.measureText(content).width;
}

function wrap(content: string, maxWidth: number, size: number): string[] {
  ctx.font = `${size}px "Trebuchet MS", sans-serif`;
  const words = content.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTrophy(x: number, y: number, glow: boolean): void {
  ctx.fillStyle = glow ? "#ffe070" : "#d2a028";
  ctx.fillRect(x + 6, y, TROPHY.w - 12, TROPHY.h - 16);
  ctx.fillRect(x + TROPHY.w / 2 - 4, y + TROPHY.h - 18, 8, 10);
  ctx.fillRect(x, y + TROPHY.h - 8, TROPHY.w, 8);
}

function drawSplat(x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.36, 0, Math.PI * 2);
  ctx.fill();
  // A few blobs around the edge so it looks thrown, not placed.
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + size;
    const distance = size * (0.32 + ((i * 7) % 5) * 0.03);
    ctx.beginPath();
    ctx.arc(
      x + size / 2 + Math.cos(angle) * distance,
      y + size / 2 + Math.sin(angle) * distance,
      size * (0.07 + ((i * 3) % 4) * 0.02),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawRainbow(x: number, y: number, size: number): void {
  const colors = ["#ff0000", "#ff7f00", "#ffff00", "#00c800", "#0080ff", "#4b0082", "#8f00ff"];
  colors.forEach((color, index) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.9, size * 0.42 - index * 4, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
}

function drawDropTarget(active: boolean): void {
  ctx.strokeStyle = active ? "#ffe070" : "#5a5a5a";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(DROP.x, DROP.y, DROP.size, DROP.size);
  ctx.setLineDash([]);
}

// ------------------------------------------------------------- select screen

function drawSelect(): void {
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const title = "Select Difficulty";
  ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
  const titleWidth = ctx.measureText(title).width;
  const left = SCREEN_WIDTH / 2 - titleWidth / 2;
  text(title, SCREEN_WIDTH / 2, 100, { size: 40, bold: true });

  // The second "e" of "Select" is a door.
  const beforeSecondE = ctx.measureText("Sel").width;
  const eWidth = ctx.measureText("e").width;
  zone(left + beforeSecondE, 80, eWidth, 40, () => {
    screen = "extra";
    errorBuffer = "";
  });

  // Both "i"s of "Difficulty", clicked together, open Infinite Mode.
  const iPositions: number[] = [];
  for (let index = 0; index < title.length; index += 1) {
    if (title[index]?.toLowerCase() !== "i") continue;
    const before = ctx.measureText(title.slice(0, index)).width;
    const charWidth = ctx.measureText(title[index] ?? "i").width;
    iPositions.push(iPositions.length);
    const slot = iPositions.length - 1;
    if (clickedIs.has(slot)) {
      text("i", left + before, 100, { size: 40, bold: true, color: "#ffff00", align: "left" });
    }
    zone(left + before, 80, charWidth, 40, () => {
      if (clickedIs.has(slot)) {
        clickedIs.clear();
        return;
      }
      clickedIs.add(slot);
      if (clickedIs.size === 2) {
        clickedIs.clear();
        screen = "infiniteSelect";
      }
    });
  }

  const names = availableDifficulties(perfect);
  const startY = 210;
  const step = Math.min(56, Math.max(38, (SCREEN_HEIGHT - 110 - startY) / Math.max(1, names.length - 1)));
  names.forEach((name, index) => {
    const difficulty = getDifficulty(name);
    if (!difficulty) return;
    const y = startY + index * step;
    const label = `${index + 1}. ${name}`;
    const done = perfect[name];
    // The ??? shakes until you've beaten it.
    const jitterX = name === "???" && !done ? Math.sin(time * 40 + index) * 2 : 0;
    text(`${label}${done ? "  ✓" : ""}`, SCREEN_WIDTH / 2 + jitterX, y, {
      size: 26,
      color: difficulty.color,
    });
    zone(SCREEN_WIDTH / 2 - 180, y - 18, 360, 36, () => {
      run = startRun(name, random);
      if (run) screen = "quiz";
    });
  });

  if (ultimateBeaten) {
    const allDropped = splats.every((splat) => splat.dropped);
    drawDropTarget(splats.some((splat) => splat.dragging));
    if (allDropped) {
      drawRainbow(DROP.x, DROP.y, DROP.size);
      zone(DROP.x, DROP.y, DROP.size, DROP.size, () => {
        screen = "godBlackout";
        blackoutTime = 0;
      });
      text("click the rainbow", SCREEN_WIDTH - 95, DROP.y - 14, { size: 14, color: "#8c8c8c" });
    } else {
      for (const splat of splats) {
        if (splat.dropped) continue;
        drawSplat(splat.x, splat.y, SPLAT_SIZE, splat.color);
      }
      for (const splat of splats.filter((s) => s.dropped)) {
        drawSplat(DROP.x + 9, DROP.y + 9, SPLAT_SIZE, splat.color);
      }
    }
  } else if (trophyUnlocked(perfect)) {
    drawDropTarget(trophy.dragging);
    drawTrophy(trophy.x, trophy.y, trophy.dragging);
    text("drag me", trophy.x + TROPHY.w / 2, trophy.y + TROPHY.h + 12, { size: 13, color: "#8c8c8c" });
  }

  text("Click a mode, or press its number", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 26, {
    size: 16,
    color: "#8c8c8c",
  });
}

// -------------------------------------------------------------- extra screen

function drawExtra(): void {
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  text("Extra Modes", SCREEN_WIDTH / 2, 100, { size: 40, bold: true });

  EXTRA_MODES.forEach((name, index) => {
    const difficulty = DIFFICULTIES[name];
    if (!difficulty) return;
    const y = 220 + index * 60;
    text(`${index + 1}. ${name}${perfect[name] ? "  ✓" : ""}`, SCREEN_WIDTH / 2, y, {
      size: 26,
      color: difficulty.color,
    });
    zone(SCREEN_WIDTH / 2 - 180, y - 18, 360, 36, () => {
      run = startRun(name, random);
      if (run) screen = "quiz";
    });
  });

  text("Q to go back", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, { size: 16, color: "#8c8c8c" });
  if (errorBuffer) {
    text(errorBuffer, SCREEN_WIDTH - 40, SCREEN_HEIGHT - 40, { size: 16, color: "#5a2a12" });
  }
}

// -------------------------------------------------------------- error screen

let errorIndex = 0;
let errorPhase: "enter" | "hold" | "exit" = "enter";
let errorPhaseTime = 0;
const ENTER_SECONDS = 0.7;
const HOLD_SECONDS = 10;
const EXIT_SECONDS = 0.6;

function drawError(): void {
  ctx.fillStyle = "#8b4513";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  let alpha = 1;
  if (errorPhase === "enter") alpha = Math.min(1, errorPhaseTime / ENTER_SECONDS);
  else if (errorPhase === "exit") alpha = Math.max(0, 1 - errorPhaseTime / EXIT_SECONDS);

  ctx.globalAlpha = alpha;
  const paragraph = ERROR_PARAGRAPHS[errorIndex] ?? "";
  const lines = wrap(paragraph, SCREEN_WIDTH - 140, 26);
  lines.forEach((line, index) => {
    text(line, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - ((lines.length - 1) * 36) / 2 + index * 36, {
      size: 26,
    });
  });
  ctx.globalAlpha = 1;

  text(`${errorIndex + 1} / ${ERROR_PARAGRAPHS.length}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, {
    size: 16,
    color: "#e0c0a0",
  });
  text("click to skip ahead · Q to go back", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 34, {
    size: 14,
    color: "#e0c0a0",
  });
}

function fastForwardError(): void {
  if (errorPhase === "exit") {
    errorIndex = (errorIndex + 1) % ERROR_PARAGRAPHS.length;
    errorPhase = "enter";
  } else {
    errorPhase = "exit";
  }
  errorPhaseTime = 0;
}

function tickError(seconds: number): void {
  errorPhaseTime += seconds;
  if (errorPhase === "enter" && errorPhaseTime >= ENTER_SECONDS) {
    errorPhase = "hold";
    errorPhaseTime = 0;
  } else if (errorPhase === "hold" && errorPhaseTime >= HOLD_SECONDS) {
    errorPhase = "exit";
    errorPhaseTime = 0;
  } else if (errorPhase === "exit" && errorPhaseTime >= EXIT_SECONDS) {
    errorIndex = (errorIndex + 1) % ERROR_PARAGRAPHS.length;
    errorPhase = "enter";
    errorPhaseTime = 0;
  }
}

// --------------------------------------------------------------- quiz screen

function drawQuiz(active: Run, endless: boolean): void {
  const question = currentQuestion(active);
  if (!question) return;
  // In ULTIMATE every question keeps the colours of the mode it came from.
  const style = styleFor(question.sourceDifficulty ?? active.difficultyName);

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const heading = endless
    ? `Infinite · ${infinitePool}   Score ${infiniteScore}   Best ${infiniteBest}`
    : `${active.difficultyName}   ${active.index + 1} / ${active.questions.length}   Score ${active.score}`;
  text(heading, SCREEN_WIDTH / 2, 40, { size: 20, color: style.accent });

  const lines = wrap(question.question, SCREEN_WIDTH - 100, 26);
  lines.forEach((line, index) => {
    text(line, SCREEN_WIDTH / 2, 110 + index * 34, { size: 26, color: style.text });
  });

  question.options.forEach((option, index) => {
    const y = 250 + index * 66;
    const correct = index === question.answer;
    let fill = "rgba(255, 255, 255, 0.08)";
    if (active.showingResult) {
      if (correct) fill = "rgba(60, 200, 90, 0.5)";
      else if (active.selected === index) fill = "rgba(220, 60, 60, 0.5)";
    }
    ctx.fillStyle = fill;
    ctx.fillRect(100, y - 26, SCREEN_WIDTH - 200, 52);
    ctx.strokeStyle = style.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(100, y - 26, SCREEN_WIDTH - 200, 52);
    text(`${index + 1}. ${option}`, SCREEN_WIDTH / 2, y, { size: 22, color: style.text });
    zone(100, y - 26, SCREEN_WIDTH - 200, 52, () => answerNow(index));
  });

  if (active.showingResult) {
    text(active.feedback, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, {
      size: 24,
      color: active.selected === question.answer ? "#78ff78" : "#ff8080",
    });
  } else {
    text("Q to go back", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 26, { size: 15, color: "#9a9a9a" });
  }
}

function answerNow(option: number): void {
  if (!run || run.showingResult) return;
  const question = currentQuestion(run);
  if (!question) return;
  answer(run, option);
  if (screen !== "infinite") return;
  // One wrong answer and the endless run is over.
  if (option === question.answer) {
    infiniteScore += 1;
    if (infiniteScore > infiniteBest) {
      infiniteBest = infiniteScore;
      save();
    }
  }
}

function drawComplete(active: Run): void {
  const style = styleFor(active.difficultyName);
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  text(active.difficultyName, SCREEN_WIDTH / 2, 150, { size: 40, bold: true, color: style.accent });
  text(`${active.score} out of ${active.questions.length}`, SCREEN_WIDTH / 2, 240, { size: 32 });
  const clean = active.score === active.questions.length;
  text(clean ? "Perfect." : "Not perfect — try again for the unlocks.", SCREEN_WIDTH / 2, 300, {
    size: 22,
    color: clean ? "#78ff78" : "#d0d0d0",
  });
  if (clean && active.difficultyName === "ULTIMATE") {
    text("Something spilled on the menu.", SCREEN_WIDTH / 2, 350, { size: 20, color: "#ffd050" });
  }
  text("Click anywhere for the menu", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, {
    size: 18,
    color: "#a0a0a0",
  });
  zone(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, () => {
    screen = "select";
    run = null;
  });
}

function drawInfiniteSelect(): void {
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  text("Infinite Mode", SCREEN_WIDTH / 2, 100, { size: 40, bold: true, color: "#50c8ff" });
  text("Questions keep coming. One wrong answer ends it.", SCREEN_WIDTH / 2, 150, {
    size: 18,
    color: "#a0a0a0",
  });

  const pools = ["Easy", "Intermediate", "Hard", "Impossible", "Every mode"];
  pools.forEach((pool, index) => {
    const y = 230 + index * 56;
    text(`${index + 1}. ${pool}`, SCREEN_WIDTH / 2, y, { size: 26 });
    zone(SCREEN_WIDTH / 2 - 180, y - 18, 360, 36, () => startInfinite(pool));
  });
  text("Q to go back", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 34, { size: 16, color: "#8c8c8c" });
}

function drawInfiniteOver(): void {
  ctx.fillStyle = "#14141e";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  text("That's the end of that", SCREEN_WIDTH / 2, 180, { size: 36, bold: true, color: "#ff8080" });
  text(`Score ${infiniteScore}   Best ${infiniteBest}`, SCREEN_WIDTH / 2, 250, { size: 26 });
  text("Click anywhere for the menu", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 60, {
    size: 18,
    color: "#a0a0a0",
  });
  zone(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, () => {
    screen = "select";
    run = null;
  });
}

function drawGodMenu(): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  text("GOD MODE", SCREEN_WIDTH / 2, 170, { size: 44, bold: true });
  text("1. Begin", SCREEN_WIDTH / 2, 280, { size: 28 });
  zone(SCREEN_WIDTH / 2 - 120, 258, 240, 44, () => {
    run = startRun("God Mode", random);
    if (run) screen = "quiz";
  });
  text("Q to go back", SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40, { size: 16, color: "#6a6a6a" });
}

// ----------------------------------------------------------------- the input

function pointIn(zoneItem: Zone, x: number, y: number): boolean {
  return x >= zoneItem.x && x <= zoneItem.x + zoneItem.w && y >= zoneItem.y && y <= zoneItem.y + zoneItem.h;
}

function canvasPoint(event: PointerEvent): { x: number; y: number } {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * SCREEN_WIDTH,
    y: ((event.clientY - bounds.top) / bounds.height) * SCREEN_HEIGHT,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const { x, y } = canvasPoint(event);

  if (screen === "error") {
    if (performance.now() < clickShieldUntil) return;
    fastForwardError();
    clickShieldUntil = performance.now() + 250;
    return;
  }

  // Dragging happens before the click zones get a look in.
  if (screen === "select" && ultimateBeaten) {
    for (const splat of splats) {
      if (splat.dropped) continue;
      if (x >= splat.x && x <= splat.x + SPLAT_SIZE && y >= splat.y && y <= splat.y + SPLAT_SIZE) {
        splat.dragging = true;
        splat.dx = x - splat.x;
        splat.dy = y - splat.y;
        canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
  } else if (screen === "select" && trophyUnlocked(perfect)) {
    if (x >= trophy.x && x <= trophy.x + TROPHY.w && y >= trophy.y && y <= trophy.y + TROPHY.h) {
      trophy.dragging = true;
      trophy.dx = x - trophy.x;
      trophy.dy = y - trophy.y;
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  }

  if (performance.now() < clickShieldUntil) return;
  for (const zoneItem of zones) {
    if (pointIn(zoneItem, x, y)) {
      zoneItem.action();
      clickShieldUntil = performance.now() + 250;
      zones = [];
      return;
    }
  }
});

canvas.addEventListener("pointermove", (event) => {
  const { x, y } = canvasPoint(event);
  if (trophy.dragging) {
    trophy.x = Math.max(0, Math.min(SCREEN_WIDTH - TROPHY.w, x - trophy.dx));
    trophy.y = Math.max(0, Math.min(SCREEN_HEIGHT - TROPHY.h, y - trophy.dy));
    return;
  }
  for (const splat of splats) {
    if (!splat.dragging) continue;
    splat.x = Math.max(0, Math.min(SCREEN_WIDTH - SPLAT_SIZE, x - splat.dx));
    splat.y = Math.max(0, Math.min(SCREEN_HEIGHT - SPLAT_SIZE, y - splat.dy));
  }
});

const overlapsDrop = (x: number, y: number, size: number): boolean =>
  x < DROP.x + DROP.size && DROP.x < x + size && y < DROP.y + DROP.size && DROP.y < y + size;

canvas.addEventListener("pointerup", () => {
  if (trophy.dragging) {
    trophy.dragging = false;
    if (overlapsDrop(trophy.x, trophy.y, TROPHY.w)) {
      run = startRun("Trophy Mode", random);
      if (run) {
        screen = "quiz";
        clickShieldUntil = performance.now() + 250;
        zones = [];
      }
    }
    trophy.x = TROPHY.homeX;
    trophy.y = TROPHY.homeY;
    return;
  }
  for (const splat of splats) {
    if (!splat.dragging) continue;
    splat.dragging = false;
    if (overlapsDrop(splat.x, splat.y, SPLAT_SIZE)) {
      splat.dropped = true;
    }
    splat.x = splat.homeX;
    splat.y = splat.homeY;
  }
});

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (key === "q" || key === "Q" || key === "Escape") {
    if (screen === "quiz" || screen === "infinite") {
      screen = "select";
      run = null;
      return;
    }
    if (screen === "extra" || screen === "error" || screen === "infiniteSelect" || screen === "godMenu") {
      screen = "select";
      return;
    }
  }

  if (screen === "extra") {
    // Typing the word, in capitals, opens the story.
    if (key.length === 1 && key >= "A" && key <= "Z") {
      const result = pushErrorLetter(errorBuffer, key);
      errorBuffer = result.buffer;
      if (result.opened) {
        screen = "error";
        errorIndex = 0;
        errorPhase = "enter";
        errorPhaseTime = 0;
      }
      return;
    }
    errorBuffer = "";
  }

  const number = Number(key);
  if (!Number.isInteger(number) || number < 1 || number > 9) return;
  const index = number - 1;

  if (screen === "select") {
    const name = availableDifficulties(perfect)[index];
    if (!name) return;
    run = startRun(name, random);
    if (run) screen = "quiz";
  } else if (screen === "extra") {
    const name = EXTRA_MODES[index];
    if (!name) return;
    run = startRun(name, random);
    if (run) screen = "quiz";
  } else if (screen === "infiniteSelect") {
    const pool = ["Easy", "Intermediate", "Hard", "Impossible", "Every mode"][index];
    if (pool) startInfinite(pool);
  } else if (screen === "godMenu" && index === 0) {
    run = startRun("God Mode", random);
    if (run) screen = "quiz";
  } else if ((screen === "quiz" || screen === "infinite") && index < 4) {
    answerNow(index);
  }
});

// ------------------------------------------------------------------- the loop

let lastFrame = performance.now();

function frame(now: number): void {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  time += seconds;
  zones = [];

  if (screen === "quiz" && run) {
    const wasComplete = run.complete;
    tickRun(run, seconds, perfect);
    if (run.complete && !wasComplete) {
      if (run.difficultyName === "ULTIMATE") {
        ultimateBeaten = true;
        resetSplats();
      }
      save();
      screen = "complete";
    }
  }

  if (screen === "infinite" && run) {
    if (run.showingResult) {
      run.resultTime += seconds;
      if (run.resultTime >= RESULT_DISPLAY_TIME) {
        const question = currentQuestion(run);
        const wasRight = question ? run.selected === question.answer : false;
        if (!wasRight) {
          screen = "infiniteOver";
        } else {
          run.showingResult = false;
          run.selected = null;
          infiniteIndex += 1;
          // Out of questions? Shuffle the pile and keep going.
          if (infiniteIndex >= infiniteQuestions.length) {
            infiniteQuestions = shuffle(infiniteQuestions, random);
            run.questions = infiniteQuestions;
            infiniteIndex = 0;
          }
          run.index = infiniteIndex;
        }
      }
    }
  }

  if (screen === "error") tickError(seconds);
  if (screen === "godBlackout") {
    blackoutTime += seconds;
    if (blackoutTime >= 2) screen = "godMenu";
  }

  if (screen === "select") drawSelect();
  else if (screen === "extra") drawExtra();
  else if (screen === "error") drawError();
  else if (screen === "quiz" && run) drawQuiz(run, false);
  else if (screen === "infinite" && run) drawQuiz(run, true);
  else if (screen === "complete" && run) drawComplete(run);
  else if (screen === "infiniteSelect") drawInfiniteSelect();
  else if (screen === "infiniteOver") drawInfiniteOver();
  else if (screen === "godBlackout") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  } else if (screen === "godMenu") drawGodMenu();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
