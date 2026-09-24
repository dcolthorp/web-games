import { describe, expect, it } from "vitest";
import { buildRoster, filterRoster, rosterSummary, sortRoster, tallyTribes, type Tribeish } from "./roster";
import type { Thing } from "./world";

const TRIBES: Tribeish[] = [
  { id: "red", name: "Reds", color: "#d8362b", enemies: [] },
  { id: "blue", name: "Blues", color: "#3b7fe0", enemies: ["red"] },
];

const person = (name: string, extra: Partial<Thing> = {}): Thing => ({ type: "person", x: 10, y: 10, name, ...extra });

describe("roster", () => {
  it("lists everybody, including the people living down a cave", () => {
    const mountain: Thing = {
      type: "mountain",
      x: 40,
      y: 40,
      caveThings: [person("Nils", { tribe: "red", traits: ["miner"] }), { type: "bomb", x: 1, y: 1 }],
    };
    const list = buildRoster([person("Aki", { tribe: "red" }), person("Bo"), { type: "oak", x: 5, y: 5 }, mountain], TRIBES);
    expect(list.map((e) => e.name)).toEqual(["Aki", "Bo", "Nils"]);
    expect(list[2]?.where).toBe("Living in Mountain 1");
    expect(list[2]?.doing).toBe("Mining, and not coming out");
    expect(list[1]?.tribeName).toBe("No tribe");
  });

  it("says which mountain somebody has gone down into", () => {
    const far: Thing = { type: "mountain", x: 200, y: 20 };
    const near: Thing = { type: "mountain", x: 30, y: 30 };
    const digger = person("Tove", { inside: [31, 29] });
    const list = buildRoster([far, near, digger], TRIBES);
    expect(list[0]?.where).toBe("Down inside Mountain 2");
  });

  it("keeps a mutant's much bigger health", () => {
    const list = buildRoster([{ type: "mutant", x: 1, y: 1, name: "Grub", hp: 12 }], TRIBES);
    expect(list[0]?.kind).toBe("Mutant");
    expect(list[0]?.most).toBe(30);
    expect(list[0]?.hp).toBe(12);
  });

  it("puts a fight over an ore above everything else they might be doing", () => {
    const list = buildRoster([person("Pax", { feud: "Nils", seam: [4, 4], homing: 20 })], TRIBES);
    expect(list[0]?.doing).toBe("Having it out with someone over an ore");
  });

  it("filters by tribe, by trait, and by a bit of a name", () => {
    const all = buildRoster(
      [
        person("Aki", { tribe: "red", traits: ["miner"] }),
        person("Bo", { tribe: "blue" }),
        person("Cora", { traits: ["miner", "brave"] }),
      ],
      TRIBES,
    );
    expect(filterRoster(all, { tribe: "red" }).map((e) => e.name)).toEqual(["Aki"]);
    expect(filterRoster(all, { trait: "miner" }).map((e) => e.name)).toEqual(["Aki", "Cora"]);
    expect(filterRoster(all, { search: "co" }).map((e) => e.name)).toEqual(["Cora"]);
    // Everybody, when nothing is asked for.
    expect(filterRoster(all, {}).length).toBe(3);
  });

  it("can pick out the people who never joined a tribe", () => {
    const all = buildRoster([person("Aki", { tribe: "red" }), person("Cora")], TRIBES);
    expect(filterRoster(all, { tribe: "none" }).map((e) => e.name)).toEqual(["Cora"]);
  });

  it("counts each tribe, biggest first, with the loners at the end", () => {
    const all = buildRoster(
      [person("Aki", { tribe: "blue" }), person("Bo", { tribe: "blue" }), person("Cora", { tribe: "red" }), person("Dax")],
      TRIBES,
    );
    expect(tallyTribes(all, TRIBES)).toEqual([
      { id: "blue", name: "Blues", color: "#3b7fe0", count: 2 },
      { id: "red", name: "Reds", color: "#d8362b", count: 1 },
      { id: "none", name: "No tribe", color: "#9aa0a8", count: 1 },
    ]);
  });

  it("sorts by tribe and then by name", () => {
    const all = buildRoster([person("Zed", { tribe: "red" }), person("Aki", { tribe: "red" }), person("Bo", { tribe: "blue" })], TRIBES);
    expect(sortRoster(all).map((e) => e.name)).toEqual(["Bo", "Aki", "Zed"]);
  });

  it("sums up how many there are, how many are underground and how many are hurt", () => {
    const mountain: Thing = { type: "mountain", x: 40, y: 40, caveThings: [person("Nils")] };
    const all = buildRoster([person("Aki", { hp: 2 }), mountain], TRIBES);
    expect(rosterSummary(all)).toBe("2 people · 1 underground · 1 hurt");
    expect(rosterSummary(buildRoster([person("Solo")], TRIBES))).toBe("1 person");
  });
});
