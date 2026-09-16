// Mermaid Math: adding up to ten, and counting pearls. Ported from
// kids-games/mermaid_math.py.

export const WINDOW_WIDTH = 1100;
export const WINDOW_HEIGHT = 720;
export const MAX_NUMBER = 10;
export const BUBBLE_RADIUS = 74;

export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random: () => number, low: number, high: number): number =>
  low + Math.floor(random() * (high - low + 1));

export type Activity = "addition" | "counting";

export interface Pearl {
  x: number;
  y: number;
}

export interface Prompt {
  activity: Activity;
  text: string;
  correct: number;
  addends?: [number, number];
  pearls?: Pearl[];
}

export function additionPrompt(random: () => number): Prompt {
  const a = pick(random, 0, MAX_NUMBER);
  const b = pick(random, 0, MAX_NUMBER - a);
  return { activity: "addition", text: `${a} + ${b} = ?`, correct: a + b, addends: [a, b] };
}

// The pearls sit in a friendly cluster so they're countable, not scattered.
export function countingPrompt(random: () => number): Prompt {
  const howMany = pick(random, 0, MAX_NUMBER);
  const centerX = WINDOW_WIDTH / 2;
  // Below the question, so the pearls never sit on top of the words.
  const centerY = WINDOW_HEIGHT * 0.3;
  const spread = Math.min(WINDOW_WIDTH, WINDOW_HEIGHT * 0.46) * 0.28;

  const pearls: Pearl[] = [];
  for (let i = 0; i < howMany; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = random() ** 0.55 * spread;
    pearls.push({
      x: centerX + Math.cos(angle) * radius + (random() * 28 - 14),
      y: centerY + Math.sin(angle) * radius + (random() * 28 - 14),
    });
  }
  return { activity: "counting", text: "How many pearls?", correct: howMany, pearls };
}

// The wrong answers sit close to the right one, so it's a real choice.
export function buildChoices(random: () => number, correct: number, count = 4): number[] {
  const choices = new Set<number>([correct]);
  let guard = 0;
  while (choices.size < count && guard < 200) {
    guard += 1;
    const deltas = [-3, -2, -1, 1, 2, 3, 4];
    const delta = deltas[Math.floor(random() * deltas.length)] ?? 1;
    choices.add(clamp(correct + delta, 0, MAX_NUMBER));
  }
  const list = [...choices];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = list[i] as number;
    const b = list[j] as number;
    list[i] = b;
    list[j] = a;
  }
  return list;
}

// Keep it mixed up: never the same kind of question three times running.
export function chooseNextActivity(
  random: () => number,
  last: Activity | null,
  repeats: number
): [Activity, number] {
  const flip = (activity: Activity): Activity => (activity === "addition" ? "counting" : "addition");
  if (last && repeats >= 2) return [flip(last), 1];
  if (last && random() < 0.55) return [flip(last), 1];
  const next: Activity = random() < 0.5 ? "addition" : "counting";
  if (next === last) return [next, repeats + 1];
  return [next, 1];
}

export interface Round {
  prompt: Prompt;
  choices: number[];
}

export interface Game {
  round: Round;
  score: number;
  streak: number;
  bestStreak: number;
  lastActivity: Activity | null;
  repeats: number;
  random: () => number;
}

export function newRound(game: Game): Round {
  const [activity, repeats] = chooseNextActivity(game.random, game.lastActivity, game.repeats);
  game.lastActivity = activity;
  game.repeats = repeats;
  const prompt = activity === "addition" ? additionPrompt(game.random) : countingPrompt(game.random);
  return { prompt, choices: buildChoices(game.random, prompt.correct) };
}

export function newGame(bestStreak = 0, seed = Math.floor(Math.random() * 1e9)): Game {
  const game: Game = {
    round: { prompt: { activity: "addition", text: "", correct: 0 }, choices: [] },
    score: 0,
    streak: 0,
    bestStreak,
    lastActivity: null,
    repeats: 0,
    random: randomFrom(seed),
  };
  game.round = newRound(game);
  return game;
}

export interface AnswerOutcome {
  correct: boolean;
  message: string;
}

// A right answer scores; a wrong one just resets the streak and lets you try
// again, because nobody should lose at counting pearls. The next question only
// comes once the badge has been on screen for a moment (see advance).
export function answer(game: Game, value: number): AnswerOutcome {
  if (value === game.round.prompt.correct) {
    game.score += 1;
    game.streak += 1;
    game.bestStreak = Math.max(game.bestStreak, game.streak);
    return { correct: true, message: "Correct!" };
  }
  game.streak = 0;
  return { correct: false, message: "Try again" };
}

export function advance(game: Game): void {
  game.round = newRound(game);
}
