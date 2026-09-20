import { describe, expect, it } from "vitest";
import { WANTED, nextWord, phraseSolved, readPhrase, type Word } from "./phrase";

describe("nextWord", () => {
  it("cycles empty to BLANK to BLANKITY and back", () => {
    expect(nextWord("")).toBe("BLANK");
    expect(nextWord("BLANK")).toBe("BLANKITY");
    expect(nextWord("BLANKITY")).toBe("");
  });
});

describe("phraseSolved", () => {
  it("wants the room's own name back", () => {
    expect(WANTED).toEqual(["BLANK", "BLANK", "BLANKITY", "BLANK"]);
    expect(phraseSolved(["BLANK", "BLANK", "BLANKITY", "BLANK"])).toBe(true);
  });

  it("is not fooled by all four saying BLANK", () => {
    expect(phraseSolved(["BLANK", "BLANK", "BLANK", "BLANK"])).toBe(false);
  });

  it("is not solved while a frame is empty", () => {
    expect(phraseSolved(["BLANK", "BLANK", "BLANKITY", ""])).toBe(false);
  });

  it("cares which frame the long word is in", () => {
    expect(phraseSolved(["BLANKITY", "BLANK", "BLANK", "BLANK"])).toBe(false);
  });
});

describe("readPhrase", () => {
  it("shows holes where the words aren't", () => {
    expect(readPhrase(["", "", "", ""])).toBe("______, ______, ______ ______");
  });

  it("reads like the room's name once it's right", () => {
    const solved: Word[] = ["BLANK", "BLANK", "BLANKITY", "BLANK"];
    expect(readPhrase(solved)).toBe("BLANK, BLANK, BLANKITY BLANK");
  });
});
