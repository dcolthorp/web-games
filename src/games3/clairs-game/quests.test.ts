import { beforeEach, describe, expect, it } from "vitest";
import {
  claim,
  coinsAvailable,
  coinsEarned,
  createLog,
  offer,
  openQuests,
  record,
  resetProgress,
  statusOf,
  type QuestDef,
  type QuestLog,
} from "./quests";

const patients: QuestDef = {
  id: "patients", giver: "nurse", title: "Aromatherapy", ask: "", hint: "",
  goal: 5, unit: "patients", reward: 3, thanks: "", after: "",
};
const bread: QuestDef = {
  id: "bread", giver: "baker", title: "Hold It In", ask: "", hint: "",
  goal: 20, unit: "seconds", reward: 2, thanks: "", after: "",
};
const DEFS = [patients, bread];

let log: QuestLog;
beforeEach(() => { log = createLog(DEFS); });

describe("offer", () => {
  it("starts a quest you have not been given yet", () => {
    expect(offer(log, "patients")).toBe(true);
    expect(statusOf(log, "patients")).toBe("active");
  });

  it("does not restart a quest when you talk to the giver again", () => {
    offer(log, "patients");
    record(log, patients, 3);
    expect(offer(log, "patients")).toBe(false);
    expect(log["patients"]!.progress).toBe(3);
  });
});

describe("record", () => {
  it("ignores progress before the quest is given", () => {
    expect(record(log, patients, 5)).toBe(false);
    expect(log["patients"]!.progress).toBe(0);
  });

  it("flips to ready exactly when the goal is met", () => {
    offer(log, "patients");
    for (let i = 0; i < 4; i += 1) expect(record(log, patients)).toBe(false);
    expect(record(log, patients)).toBe(true);
    expect(statusOf(log, "patients")).toBe("ready");
  });

  it("cannot be pushed past the goal by farting on the same patient twice", () => {
    offer(log, "patients");
    record(log, patients, 99);
    expect(log["patients"]!.progress).toBe(5);
  });

  it("stops counting once the quest is claimed", () => {
    offer(log, "patients");
    record(log, patients, 5);
    claim(log, patients);
    expect(record(log, patients)).toBe(false);
  });
});

describe("resetProgress", () => {
  it("sends the bakery timer back to zero when you let one rip", () => {
    offer(log, "bread");
    record(log, bread, 12);
    resetProgress(log, "bread");
    expect(log["bread"]!.progress).toBe(0);
    expect(statusOf(log, "bread")).toBe("active");
  });

  it("cannot undo a quest you already finished", () => {
    offer(log, "bread");
    record(log, bread, 20);
    resetProgress(log, "bread");
    expect(statusOf(log, "bread")).toBe("ready");
    expect(log["bread"]!.progress).toBe(20);
  });
});

describe("claim", () => {
  it("pays only once", () => {
    offer(log, "patients");
    record(log, patients, 5);
    expect(claim(log, patients)).toBe(3);
    expect(claim(log, patients)).toBe(0);
  });

  it("pays nothing for unfinished work", () => {
    offer(log, "patients");
    record(log, patients, 4);
    expect(claim(log, patients)).toBe(0);
    expect(statusOf(log, "patients")).toBe("active");
  });
});

describe("counting up", () => {
  it("adds up only what you were actually paid", () => {
    offer(log, "patients");
    record(log, patients, 5);
    claim(log, patients);
    offer(log, "bread");
    record(log, bread, 20);
    expect(coinsEarned(log, DEFS)).toBe(3);
  });

  it("knows the whole city is worth five coins", () => {
    expect(coinsAvailable(DEFS)).toBe(5);
  });

  it("lists what you are carrying, not what you finished or never took", () => {
    offer(log, "patients");
    record(log, patients, 5);
    expect(openQuests(log, DEFS).map((d) => d.id)).toEqual(["patients"]);
    claim(log, patients);
    expect(openQuests(log, DEFS)).toEqual([]);
  });
});
