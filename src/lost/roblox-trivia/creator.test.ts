import { describe, expect, it } from "vitest";
import {
  MAX_NAME_LENGTH,
  QUIZ_COLORS,
  makeMode,
  makeQuestion,
  modeIsPlayable,
  questionIsReady,
  readyQuestions,
  typeInto,
  whatsMissing,
  type CustomMode,
} from "./creator";
import { advance, answer, currentQuestion, getDifficulty, labelOf, registerYourQuizzes, startRun, styleFor, type PerfectStatus } from "./quiz";

function filledQuestion(text: string, right = 0) {
  const question = makeQuestion();
  question.question = text;
  question.options = ["one", "two", "three", "four"];
  question.answer = right;
  return question;
}

describe("a new quiz", () => {
  it("starts with a name, a colour and one blank question", () => {
    const mode = makeMode("My Quiz");
    expect(mode.name).toBe("My Quiz");
    expect(QUIZ_COLORS).toContain(mode.color);
    expect(mode.questions).toHaveLength(1);
    expect(questionIsReady(mode.questions[0] ?? makeQuestion())).toBe(false);
  });

  it("gets its own id every time", () => {
    expect(makeMode().id).not.toBe(makeMode().id);
  });
});

describe("when a question counts as finished", () => {
  it("needs asking, two answers, and the right one filled in", () => {
    const question = makeQuestion();
    expect(questionIsReady(question)).toBe(false);

    question.question = "What is Oscar's first game?";
    expect(questionIsReady(question)).toBe(false);

    question.options = ["Snake", "", "", ""];
    expect(questionIsReady(question)).toBe(false);

    question.options = ["Snake", "Ground Jumper", "", ""];
    expect(questionIsReady(question)).toBe(true);

    // Marking a blank box as the right answer isn't finished either.
    question.answer = 2;
    expect(questionIsReady(question)).toBe(false);
  });
});

describe("what's missing", () => {
  it("says which question needs what", () => {
    const mode = makeMode();
    expect(whatsMissing(mode)).toBe("Question 1 needs asking.");

    const first = mode.questions[0];
    if (!first) return;
    first.question = "Ready?";
    expect(whatsMissing(mode)).toBe("Question 1 needs at least two answers.");

    first.options = ["yes", "no", "", ""];
    expect(whatsMissing(mode)).toBe("");

    mode.questions.push(makeQuestion());
    expect(whatsMissing(mode)).toBe("Question 2 needs asking.");
  });

  it("won't let a quiz be played until one question is finished", () => {
    const mode = makeMode();
    expect(modeIsPlayable(mode)).toBe(false);
    mode.questions = [filledQuestion("Is this playable now?")];
    expect(modeIsPlayable(mode)).toBe(true);
  });
});

describe("typing into a box", () => {
  it("adds letters, takes them back, and stops at the limit", () => {
    expect(typeInto("Sna", "k", 20)).toBe("Snak");
    expect(typeInto("Snake", "Backspace", 20)).toBe("Snak");
    expect(typeInto("Snake", " ", 20)).toBe("Snake ");
    expect(typeInto("Snake", "Shift", 20)).toBe("Snake");
    expect(typeInto("Snake", "ArrowLeft", 20)).toBe("Snake");
    expect(typeInto("abc", "d", 3)).toBe("abc");
    expect(typeInto("x".repeat(MAX_NAME_LENGTH), "y", MAX_NAME_LENGTH)).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe("playing a quiz you wrote", () => {
  const mode: CustomMode = {
    ...makeMode("Steal a Brainrot"),
    color: "#50c8ff",
    questions: [
      filledQuestion("First one?", 1),
      filledQuestion("Second one?", 3),
      { ...makeQuestion(), question: "unfinished" },
    ],
  };

  it("only deals the questions that are finished, in the order you wrote them", () => {
    registerYourQuizzes([
      { id: mode.id, name: mode.name, color: mode.color, questions: readyQuestions(mode) },
    ]);
    const run = startRun(mode.id, Math.random);
    expect(run).not.toBeNull();
    if (!run) return;
    expect(run.questions).toHaveLength(2);
    expect(run.questions[0]?.question).toBe("First one?");
    expect(run.questions[1]?.question).toBe("Second one?");
  });

  it("wears the name and colour you gave it", () => {
    registerYourQuizzes([
      { id: mode.id, name: mode.name, color: mode.color, questions: readyQuestions(mode) },
    ]);
    expect(labelOf(mode.id)).toBe("Steal a Brainrot");
    expect(styleFor(mode.id).accent).toBe("#50c8ff");
    expect(getDifficulty(mode.id)?.questions).toHaveLength(2);
  });

  it("can be perfected like any other mode", () => {
    registerYourQuizzes([
      { id: mode.id, name: mode.name, color: mode.color, questions: readyQuestions(mode) },
    ]);
    const perfect: PerfectStatus = {};
    const run = startRun(mode.id, Math.random);
    if (!run) return;
    while (!run.complete) {
      const question = currentQuestion(run);
      if (!question) break;
      answer(run, question.answer);
      advance(run, perfect);
    }
    expect(perfect[mode.id]).toBe(true);
  });

  it("doesn't get in the way of the built-in modes", () => {
    registerYourQuizzes([{ id: "custom-x", name: "Easy", color: "#ffffff", questions: [] }]);
    expect(getDifficulty("Easy")?.questions.length).toBe(10);
    registerYourQuizzes([]);
    expect(getDifficulty("custom-x")).toBeNull();
  });
});
