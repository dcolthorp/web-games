import { describe, expect, it } from "vitest";
import { advance, answer, currentQuestion, getDifficulty, startRun, type PerfectStatus } from "./quiz";

// Play every mode straight through, answering all of them right: proof that the
// whole game, secrets included, can actually be finished.
describe("beating the whole game", () => {
  it("perfects every mode", () => {
    const perfect: PerfectStatus = {};
    const order = [
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
      "ULTIMATE",
      "God Mode",
    ];
    for (const name of order) {
      const run = startRun(name, Math.random);
      expect(run, name).not.toBeNull();
      if (!run) continue;
      while (!run.complete) {
        const question = currentQuestion(run);
        if (!question) break;
        answer(run, question.answer);
        advance(run, perfect);
      }
      expect(run.score, name).toBe(run.questions.length);
      expect(perfect[name], name).toBe(true);
    }
    expect(getDifficulty("ULTIMATE")?.questions.length).toBeGreaterThan(40);
  });
});
