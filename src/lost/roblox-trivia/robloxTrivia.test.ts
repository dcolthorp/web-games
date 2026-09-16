import { describe, expect, it } from "vitest";
import { DIFFICULTIES, ERROR_PARAGRAPHS, EXTRA_MODES, ultimateQuestions } from "./questions";
import {
  VISIBLE_ORDER,
  advance,
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
} from "./quiz";

const allPerfect = (names: string[]): PerfectStatus =>
  Object.fromEntries(names.map((name) => [name, true]));

describe("the question bank", () => {
  it("came over with every mode intact", () => {
    expect(Object.keys(DIFFICULTIES)).toContain("Tutorial");
    expect(DIFFICULTIES["Easy"]?.questions).toHaveLength(10);
    expect(DIFFICULTIES["God Mode"]?.questions).toHaveLength(12);
    expect(EXTRA_MODES).toEqual(["Prismatic", "Divine", "Coming Soon"]);
    expect(ERROR_PARAGRAPHS).toHaveLength(7);
  });

  it("has a real answer for every question", () => {
    for (const difficulty of Object.values(DIFFICULTIES)) {
      for (const question of difficulty.questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
      }
    }
  });
});

describe("what's on the menu", () => {
  it("shows five modes to start with", () => {
    expect(availableDifficulties({})).toEqual(VISIBLE_ORDER);
  });

  it("adds ??? once the five are perfect", () => {
    const list = availableDifficulties(allPerfect(VISIBLE_ORDER));
    expect(list).toContain("???");
    expect(list).not.toContain("ULTIMATE");
  });

  it("adds ULTIMATE once everything else is perfect", () => {
    const perfect = allPerfect([
      ...VISIBLE_ORDER,
      "???",
      "Trophy Mode",
      "Prismatic",
      "Divine",
      "Coming Soon",
    ]);
    expect(availableDifficulties(perfect)).toContain("ULTIMATE");
  });

  it("only hands over the trophy once ??? is done too", () => {
    expect(trophyUnlocked(allPerfect(VISIBLE_ORDER))).toBe(false);
    expect(trophyUnlocked(allPerfect([...VISIBLE_ORDER, "???"]))).toBe(true);
  });
});

describe("ULTIMATE", () => {
  it("is every other mode's questions, remembering where each came from", () => {
    const questions = ultimateQuestions();
    const expected = [
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
    ].reduce((total, name) => total + (DIFFICULTIES[name]?.questions.length ?? 0), 0);
    expect(questions).toHaveLength(expected);
    expect(questions.every((question) => question.sourceDifficulty)).toBe(true);
  });
});

describe("a run", () => {
  it("keeps the tutorial in order and shuffles everything else", () => {
    const tutorial = startRun("Tutorial", () => 0.5);
    expect(tutorial?.questions.map((q) => q.answer)).toEqual([0, 1, 2, 3]);
  });

  it("scores a right answer and shows the message", () => {
    const run = startRun("Tutorial", () => 0.5);
    if (!run) return;
    answer(run, 0);
    expect(run.score).toBe(1);
    expect(run.feedback).toBe("Great job!");
    expect(run.showingResult).toBe(true);
  });

  it("says what the right one was when you get it wrong", () => {
    const run = startRun("Tutorial", () => 0.5);
    if (!run) return;
    answer(run, 3);
    expect(run.score).toBe(0);
    expect(run.feedback).toBe("Wrong! Correct: 1");
  });

  it("moves on by itself once the answer has been up long enough", () => {
    const run = startRun("Tutorial", () => 0.5);
    if (!run) return;
    const perfect: PerfectStatus = {};
    answer(run, 0);
    tickRun(run, 0.5, perfect);
    expect(run.index).toBe(0);
    tickRun(run, 1, perfect);
    expect(run.index).toBe(1);
  });

  it("only counts as perfect if you got every single one", () => {
    const perfect: PerfectStatus = {};
    const clean = startRun("Tutorial", () => 0.5);
    if (!clean) return;
    for (let i = 0; i < clean.questions.length; i += 1) {
      answer(clean, currentQuestion(clean)?.answer ?? 0);
      advance(clean, perfect);
    }
    expect(clean.complete).toBe(true);
    expect(perfect["Tutorial"]).toBe(true);

    const sloppy = startRun("Tutorial", () => 0.5);
    const otherPerfect: PerfectStatus = {};
    if (!sloppy) return;
    answer(sloppy, ((currentQuestion(sloppy)?.answer ?? 0) + 1) % 4);
    advance(sloppy, otherPerfect);
    for (let i = 1; i < sloppy.questions.length; i += 1) {
      answer(sloppy, currentQuestion(sloppy)?.answer ?? 0);
      advance(sloppy, otherPerfect);
    }
    expect(otherPerfect["Tutorial"]).toBeUndefined();
  });
});

describe("the look of each mode", () => {
  it("darkens the mode's own colour for the background", () => {
    expect(styleFor("Easy").accent).toBe(DIFFICULTIES["Easy"]?.color);
    expect(styleFor("Coming Soon").text).toBe("#000000");
    expect(styleFor("???").accent).toBe("#ffffff");
    expect(getDifficulty("ULTIMATE")?.questions.length).toBeGreaterThan(0);
  });
});

describe("the word you type on the extra modes screen", () => {
  it("opens the story only when it's spelled right, in capitals", () => {
    let buffer = "";
    for (const letter of "ERRO") {
      const result = pushErrorLetter(buffer, letter);
      buffer = result.buffer;
      expect(result.opened).toBe(false);
    }
    expect(pushErrorLetter(buffer, "R").opened).toBe(true);
  });

  it("starts over when you get a letter wrong", () => {
    const result = pushErrorLetter("ER", "X");
    expect(result.buffer).toBe("");
    expect(result.opened).toBe(false);
    expect(pushErrorLetter("ER", "E").buffer).toBe("E");
  });
});

describe("shuffling", () => {
  it("keeps everything, just in another order", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const mixed = shuffle(items, () => 0.42);
    expect([...mixed].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
