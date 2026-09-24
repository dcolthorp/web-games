import { describe, expect, it } from "vitest";
import html from "./index.html?raw";
import main from "./main.ts?raw";

// The game looks up every control by id. Get one letter wrong and the page
// throws the moment it loads, which no other test would catch. This reads the
// two files as text and checks they agree about what's on the page.

// id="thing" in the page, plus any the code builds itself inside a string.
const idsInHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id ?? ""));
const idsMadeInCode = new Set([...main.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id ?? ""));

// $("thing") and $<HTMLButtonElement>("thing").
const lookedUp = [...main.matchAll(/\$(?:<[^>]+>)?\("([^"]+)"\)/g)].map(([, id]) => id ?? "");

describe("the page and the code agree", () => {
  it("looks up a good few controls", () => {
    expect(lookedUp.length).toBeGreaterThan(20);
  });

  it("only looks up controls that are really there", () => {
    const missing = [...new Set(lookedUp)].filter((id) => !idsInHtml.has(id) && !idsMadeInCode.has(id));
    expect(missing).toEqual([]);
  });

  it("has every part of Who's Who", () => {
    for (const id of ["people-list", "roster-dialog", "roster-list", "roster-count", "roster-tribes", "roster-tribe", "roster-trait", "roster-search"]) {
      expect(idsInHtml.has(id), `the page is missing ${id}`).toBe(true);
      expect(main.includes(`"${id}"`), `the code never uses ${id}`).toBe(true);
    }
  });

  it("hangs Who's Who off a button people can actually press", () => {
    expect(html).toContain(`id="people-list"`);
    expect(html).toMatch(/id="people-list"[^>]*type="button"/);
    expect(main).toMatch(/\$<HTMLButtonElement>\("people-list"\)\.addEventListener\("click"/);
  });
});
