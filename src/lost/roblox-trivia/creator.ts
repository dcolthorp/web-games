// The quiz creator: your own modes, with your own questions in them. The
// Python game had a creator too, but it only set up the mode and asked GPT for
// the questions. This one keeps the questions you write.

export interface CustomQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface CustomMode {
  id: string;
  name: string;
  color: string;
  questions: CustomQuestion[];
}

// The colours a quiz can wear, the same ones the built-in modes use.
export const QUIZ_COLORS = [
  "#ffffff",
  "#00c800",
  "#dcdc00",
  "#c80000",
  "#c800c8",
  "#ff5050",
  "#50c8ff",
  "#ffc828",
];

export const MAX_QUESTION_LENGTH = 110;
export const MAX_OPTION_LENGTH = 40;
export const MAX_NAME_LENGTH = 22;

const STORAGE_KEY = "roblox-trivia-custom-modes";

export const makeQuestion = (): CustomQuestion => ({
  question: "",
  options: ["", "", "", ""],
  answer: 0,
});

export function makeMode(name = "New Quiz"): CustomMode {
  return {
    id: `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    color: QUIZ_COLORS[1] ?? "#00c800",
    questions: [makeQuestion()],
  };
}

// A question is ready when it has been asked and has at least two answers to
// choose between, one of which is marked right.
export function questionIsReady(question: CustomQuestion): boolean {
  if (!question.question.trim()) return false;
  const filled = question.options.filter((option) => option.trim().length > 0);
  if (filled.length < 2) return false;
  return (question.options[question.answer] ?? "").trim().length > 0;
}

export const readyQuestions = (mode: CustomMode): CustomQuestion[] =>
  mode.questions.filter(questionIsReady);

export const modeIsPlayable = (mode: CustomMode): boolean => readyQuestions(mode).length > 0;

// What's still missing, in words, so you know why Play won't go.
export function whatsMissing(mode: CustomMode): string {
  if (mode.questions.length === 0) return "Add a question first.";
  const unfinished = mode.questions.findIndex((question) => !questionIsReady(question));
  if (unfinished < 0) return "";
  const question = mode.questions[unfinished];
  if (!question) return "";
  const number = unfinished + 1;
  if (!question.question.trim()) return `Question ${number} needs asking.`;
  if (question.options.filter((option) => option.trim()).length < 2) {
    return `Question ${number} needs at least two answers.`;
  }
  return `Question ${number} needs its right answer filled in.`;
}

// Typing into a field, one key at a time, the way the Python one did it.
export function typeInto(current: string, key: string, limit: number): string {
  if (key === "Backspace") return current.slice(0, -1);
  if (key.length !== 1) return current;
  const code = key.charCodeAt(0);
  if (code < 32 || code > 126) return current;
  return current.length < limit ? current + key : current;
}

function isQuestion(value: unknown): value is CustomQuestion {
  const q = value as Partial<CustomQuestion> | null;
  return (
    !!q &&
    typeof q.question === "string" &&
    Array.isArray(q.options) &&
    q.options.length === 4 &&
    q.options.every((option) => typeof option === "string") &&
    Number.isInteger(q.answer) &&
    (q.answer as number) >= 0 &&
    (q.answer as number) < 4
  );
}

function isMode(value: unknown): value is CustomMode {
  const m = value as Partial<CustomMode> | null;
  return (
    !!m &&
    typeof m.id === "string" &&
    typeof m.name === "string" &&
    typeof m.color === "string" &&
    Array.isArray(m.questions) &&
    m.questions.every(isQuestion)
  );
}

export function loadModes(): CustomMode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isMode) : [];
  } catch {
    return [];
  }
}

export function saveModes(modes: CustomMode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
  } catch {
    // Can't save: the quizzes last until the page closes.
  }
}
