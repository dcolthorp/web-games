import { describe, expect, it } from "vitest";
import {
  HACK_INTRUSION_GAIN,
  INTEGRITY_GAIN_ON_AV_SUCCESS,
  INTEGRITY_LOSS_ON_AV_FAIL,
  INTEGRITY_LOSS_ON_HACK_FAIL,
  INTEGRITY_MAX,
  INTRUSION_MAX,
  JOB_COMPLETE_BONUS_COINS,
  applyResult,
  commitSimon,
  formatCurrencyShort,
  makePatchMatch,
  makeSimon,
  makeTimingTrace,
  newSession,
  pressMinigame,
  randomFrom,
  rollHackLoot,
  updateMinigame,
} from "./session";

describe("the money", () => {
  it("counts up in orbs, cores, diamonds, dollars and coins", () => {
    expect(formatCurrencyShort(0)).toBe("0c");
    expect(formatCurrencyShort(7)).toBe("7c");
    expect(formatCurrencyShort(10)).toBe("1$");
    expect(formatCurrencyShort(11234)).toBe("1O 1C 2D 3$ 4c");
  });
});

describe("the loot table", () => {
  it("hands out the big stuff almost never", () => {
    let orbs = 0;
    let coins = 0;
    const random = randomFrom(5);
    for (let roll = 0; roll < 5000; roll += 1) {
      const drop = rollHackLoot(random);
      if (drop.coins >= 10000) orbs += 1;
      if (drop.name === "Coin") coins += 1;
    }
    expect(orbs).toBeLessThan(50);
    expect(coins).toBeGreaterThan(3000);
  });
});

describe("the timing trace", () => {
  it("counts a hit inside the window", () => {
    const game = makeTimingTrace(0, () => 0.5);
    game.cursor = game.windowCenter;
    pressMinigame(game, " ");
    expect(game.result?.success).toBe(true);
    expect(game.result?.intrusionDelta).toBe(HACK_INTRUSION_GAIN);
  });

  it("counts a miss outside it", () => {
    const game = makeTimingTrace(0, () => 0.5);
    game.cursor = game.windowCenter + game.windowSize;
    pressMinigame(game, " ");
    expect(game.result?.success).toBe(false);
    expect(game.result?.intrusionDelta).toBe(0);
  });

  it("runs out of time if you never press", () => {
    const game = makeTimingTrace(0, () => 0.5);
    for (let frame = 0; frame < 60 * 10 && !game.done; frame += 1) updateMinigame(game, 1 / 60);
    expect(game.done).toBe(true);
    expect(game.result?.message).toBe("Trace timed out.");
  });

  it("gets faster and tighter the harder it gets", () => {
    const easy = makeTimingTrace(0, () => 0.5);
    const hard = makeTimingTrace(1, () => 0.5);
    expect(hard.cursorSpeed).toBeGreaterThan(easy.cursorSpeed);
    expect(hard.windowSize).toBeLessThan(easy.windowSize);
    expect(hard.timeLimit).toBeLessThan(easy.timeLimit);
  });
});

describe("the pattern", () => {
  it("gets longer as the jobs go on", () => {
    expect(makeSimon(0, () => 0.5).sequence).toHaveLength(3);
    expect(makeSimon(1, () => 0.5).sequence).toHaveLength(7);
  });

  it("is only accepted when you repeat the whole thing", () => {
    const game = makeSimon(0, () => 0.5);
    game.phase = "input";
    for (const pad of game.sequence) {
      expect(game.done).toBe(false);
      game.selected = pad;
      commitSimon(game);
    }
    expect(game.result?.success).toBe(true);
  });

  it("stops you the moment you press the wrong pad", () => {
    const game = makeSimon(0, () => 0.5);
    game.phase = "input";
    game.selected = ((game.sequence[0] ?? 0) + 1) % 4;
    commitSimon(game);
    expect(game.result?.success).toBe(false);
    expect(game.result?.message).toBe("Pattern mismatch.");
  });

  it("walks through watching before it's your turn", () => {
    const game = makeSimon(0, randomFrom(2));
    for (let frame = 0; frame < 60 * 20 && game.phase !== "input"; frame += 1) {
      updateMinigame(game, 1 / 60);
    }
    expect(game.phase).toBe("input");
  });
});

describe("the patch match", () => {
  it("always has exactly one right answer", () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const random = randomFrom(seed);
      for (const difficulty of [0, 0.8]) {
        const game = makePatchMatch(difficulty, random);
        const matches = game.choices.filter(
          (choice) => choice.shape === game.targetShape && choice.color === game.targetColor
        );
        expect(matches).toHaveLength(1);
        expect(game.choices[game.correctIndex]?.shape).toBe(game.targetShape);
      }
    }
  });

  it("heals you when you get it right and hurts when you don't", () => {
    const right = makePatchMatch(0, randomFrom(4));
    pressMinigame(right, String(right.correctIndex + 1));
    expect(right.result?.integrityDelta).toBe(INTEGRITY_GAIN_ON_AV_SUCCESS);

    const wrong = makePatchMatch(0, randomFrom(4));
    pressMinigame(wrong, String(((wrong.correctIndex + 1) % 4) + 1));
    expect(wrong.result?.integrityDelta).toBe(-INTEGRITY_LOSS_ON_AV_FAIL);
  });
});

describe("a session", () => {
  it("starts you on a hack with full integrity", () => {
    const session = newSession(0, 9);
    expect(session.phase).toBe("hack");
    expect(session.minigame).not.toBeNull();
    expect(session.integrity).toBe(INTEGRITY_MAX);
  });

  it("chips away at integrity every time a hack goes wrong", () => {
    const session = newSession(0, 9);
    const game = session.minigame;
    if (!game) return;
    game.done = true;
    game.result = {
      success: false,
      coins: 0,
      intrusionDelta: 0,
      integrityDelta: 0,
      message: "Trace failed.",
    };
    applyResult(session);
    expect(session.integrity).toBe(INTEGRITY_MAX - INTEGRITY_LOSS_ON_HACK_FAIL);
    expect(session.heat).toBeGreaterThan(0);
  });

  it("finishes the job once intrusion is full, and pays the bonus", () => {
    const session = newSession(0, 9);
    session.intrusion = INTRUSION_MAX - HACK_INTRUSION_GAIN;
    const game = session.minigame;
    if (!game) return;
    game.done = true;
    game.result = {
      success: true,
      coins: 40,
      intrusionDelta: HACK_INTRUSION_GAIN,
      integrityDelta: 0,
      message: "Exploit locked.",
    };
    applyResult(session);
    expect(session.job).toBe(2);
    expect(session.intrusion).toBe(0);
    expect(session.coins).toBeGreaterThanOrEqual(JOB_COMPLETE_BONUS_COINS);
  });

  it("is over when your own machine gets hacked", () => {
    const session = newSession(0, 9);
    session.integrity = 5;
    const game = session.minigame;
    if (!game) return;
    game.done = true;
    game.result = {
      success: false,
      coins: 0,
      intrusionDelta: 0,
      integrityDelta: -INTEGRITY_LOSS_ON_AV_FAIL,
      message: "Wrong patch!",
    };
    applyResult(session);
    expect(session.phase).toBe("over");
  });
});
