import { describe, expect, it } from "vitest";
import {
  MAX_NUMBER,
  additionPrompt,
  advance,
  answer,
  buildChoices,
  chooseNextActivity,
  countingPrompt,
  newGame,
  randomFrom,
} from "./rounds";

describe("the sums", () => {
  it("never add up past ten", () => {
    const random = randomFrom(4);
    for (let round = 0; round < 500; round += 1) {
      const prompt = additionPrompt(random);
      const [a, b] = prompt.addends ?? [0, 0];
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(a + b).toBeLessThanOrEqual(MAX_NUMBER);
      expect(prompt.correct).toBe(a + b);
      expect(prompt.text).toBe(`${a} + ${b} = ?`);
    }
  });
});

describe("the pearls", () => {
  it("puts out exactly as many as the answer", () => {
    const random = randomFrom(8);
    for (let round = 0; round < 200; round += 1) {
      const prompt = countingPrompt(random);
      expect(prompt.pearls).toHaveLength(prompt.correct);
      expect(prompt.correct).toBeLessThanOrEqual(MAX_NUMBER);
    }
  });
});

describe("the four bubbles", () => {
  it("always hold the right answer and no repeats", () => {
    const random = randomFrom(2);
    for (let correct = 0; correct <= MAX_NUMBER; correct += 1) {
      const choices = buildChoices(random, correct);
      expect(choices).toHaveLength(4);
      expect(choices).toContain(correct);
      expect(new Set(choices).size).toBe(4);
      for (const choice of choices) {
        expect(choice).toBeGreaterThanOrEqual(0);
        expect(choice).toBeLessThanOrEqual(MAX_NUMBER);
      }
    }
  });
});

describe("what comes next", () => {
  it("won't ask the same kind of question three times running", () => {
    const [next] = chooseNextActivity(() => 0.99, "addition", 2);
    expect(next).toBe("counting");
    const [other] = chooseNextActivity(() => 0.99, "counting", 2);
    expect(other).toBe("addition");
  });
});

describe("answering", () => {
  it("scores a right answer and builds the streak", () => {
    const game = newGame(0, 12);
    const outcome = answer(game, game.round.prompt.correct);
    expect(outcome.correct).toBe(true);
    expect(game.score).toBe(1);
    expect(game.streak).toBe(1);
    expect(game.bestStreak).toBe(1);
  });

  it("keeps the same question up after a wrong one, and drops the streak", () => {
    const game = newGame(0, 12);
    answer(game, game.round.prompt.correct);
    advance(game);
    const question = game.round.prompt.text;
    const wrong = game.round.choices.find((choice) => choice !== game.round.prompt.correct) ?? -1;
    const outcome = answer(game, wrong);
    expect(outcome.correct).toBe(false);
    expect(game.streak).toBe(0);
    expect(game.score).toBe(1);
    expect(game.round.prompt.text).toBe(question);
  });

  it("remembers your best streak even after you break it", () => {
    const game = newGame(0, 12);
    for (let round = 0; round < 3; round += 1) {
      answer(game, game.round.prompt.correct);
      advance(game);
    }
    expect(game.bestStreak).toBe(3);
    answer(game, (game.round.prompt.correct + 1) % (MAX_NUMBER + 1));
    expect(game.streak).toBe(0);
    expect(game.bestStreak).toBe(3);
  });
});
