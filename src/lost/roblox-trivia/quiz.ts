// Roblox Trivia's rules: which modes are unlocked, what a run of questions
// does, and how the hidden modes get found. Ported from
// kids-games/roblox_trivia.py.

import { DIFFICULTIES, ultimateQuestions, type Difficulty, type Question } from "./questions";

export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const RESULT_DISPLAY_TIME = 1.2;

export const DEFAULT_BG = "#1e1e1e";
export const DEFAULT_TEXT = "#f0f0f0";

export type PerfectStatus = Record<string, boolean>;

// The five everyone can see, then the ones you have to find.
export const VISIBLE_ORDER = ["Tutorial", "Easy", "Intermediate", "Hard", "Impossible"];

const ULTIMATE_REQUIRED = [
  "Tutorial",
  "Easy",
  "Intermediate",
  "Hard",
  "Impossible",
  "???",
  "Trophy Mode",
  "Prismatic",
  "Divine",
  "Coming Soon",
];

const TROPHY_REQUIRED = ["Tutorial", "Easy", "Intermediate", "Hard", "Impossible", "???"];

export function availableDifficulties(perfect: PerfectStatus): string[] {
  const list = [...VISIBLE_ORDER];
  // Perfect all five and the ??? appears at the bottom of the list.
  if (VISIBLE_ORDER.every((name) => perfect[name])) list.push("???");
  if (ULTIMATE_REQUIRED.every((name) => perfect[name])) list.push("ULTIMATE");
  return list;
}

// The trophy only turns up once everything through ??? is perfect. Drag it into
// the corner and Trophy Mode opens.
export const trophyUnlocked = (perfect: PerfectStatus): boolean =>
  TROPHY_REQUIRED.every((name) => perfect[name]);

export function getDifficulty(name: string): Difficulty | null {
  if (name === "ULTIMATE") {
    return { name: "ULTIMATE", color: "#ff5050", hidden: true, questions: ultimateQuestions() };
  }
  return DIFFICULTIES[name] ?? null;
}

export interface Style {
  accent: string;
  text: string;
  background: string;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const toHex = (value: number): string => Math.round(value).toString(16).padStart(2, "0");

// Each mode's background is its own colour, turned right down.
export function styleFor(name: string): Style {
  const difficulty = getDifficulty(name);
  let accent = difficulty?.color ?? "#3296fa";
  let text = DEFAULT_TEXT;
  if (name === "???") accent = "#ffffff";
  else if (name === "Coming Soon") {
    text = "#000000";
    accent = "#c80000";
  }
  const [r, g, b] = hexToRgb(accent);
  const background = `#${toHex(Math.max(20, r * 0.25))}${toHex(Math.max(20, g * 0.25))}${toHex(Math.max(20, b * 0.25))}`;
  return { accent, text, background };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = list[i] as T;
    const b = list[j] as T;
    list[i] = b;
    list[j] = a;
  }
  return list;
}

export interface Run {
  difficultyName: string;
  questions: Question[];
  index: number;
  score: number;
  selected: number | null;
  showingResult: boolean;
  resultTime: number;
  feedback: string;
  complete: boolean;
}

// The tutorial keeps its order — A, B, C, D — everything else gets shuffled.
export function startRun(name: string, random: () => number): Run | null {
  const difficulty = getDifficulty(name);
  if (!difficulty) return null;
  const questions =
    name === "Tutorial" ? [...difficulty.questions] : shuffle(difficulty.questions, random);
  return {
    difficultyName: name,
    questions,
    index: 0,
    score: 0,
    selected: null,
    showingResult: false,
    resultTime: 0,
    feedback: "",
    complete: false,
  };
}

export const currentQuestion = (run: Run): Question | null => run.questions[run.index] ?? null;

export function answer(run: Run, option: number): void {
  if (run.showingResult || run.complete) return;
  const question = currentQuestion(run);
  if (!question) return;
  run.selected = option;
  run.showingResult = true;
  run.resultTime = 0;
  if (option === question.answer) {
    run.score += 1;
    run.feedback = question.successMessage ?? "Correct!";
  } else {
    run.feedback = question.failureMessage ?? `Wrong! Correct: ${question.answer + 1}`;
  }
}

export function advance(run: Run, perfect: PerfectStatus): void {
  run.index += 1;
  run.selected = null;
  run.showingResult = false;
  if (run.index < run.questions.length) return;
  run.complete = true;
  // Only a clean sweep counts as perfect, which is what unlocks the rest.
  if (run.score === run.questions.length) perfect[run.difficultyName] = true;
}

export function tickRun(run: Run, seconds: number, perfect: PerfectStatus): void {
  if (!run.showingResult) return;
  run.resultTime += seconds;
  if (run.resultTime >= RESULT_DISPLAY_TIME) advance(run, perfect);
}

// Typing the word on the extra-modes screen opens the page that tells the
// story of the game. Only capitals count.
export function pushErrorLetter(buffer: string, letter: string): { buffer: string; opened: boolean } {
  const target = "ERROR";
  const next = buffer + letter;
  if (target.startsWith(next)) {
    if (next === target) return { buffer: "", opened: true };
    return { buffer: next, opened: false };
  }
  return { buffer: letter === "E" ? "E" : "", opened: false };
}
