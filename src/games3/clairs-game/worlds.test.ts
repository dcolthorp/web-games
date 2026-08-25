import { describe, expect, it } from "vitest";
import { nextWorld, WORLDS } from "./worlds";

describe("worlds", () => {
  it("starts you in the front yard, not in Farttopia", () => {
    expect(WORLDS[0]!.id).toBe("yard");
  });

  it("teleports the yard to Farttopia and back again", () => {
    expect(nextWorld("yard").id).toBe("farttopia");
    expect(nextWorld("farttopia").id).toBe("yard");
  });

  it("labels the button with where you are actually going", () => {
    for (const world of WORLDS) {
      expect(world.travelTo).toBe(nextWorld(world.id).name);
    }
  });

  it("never strands you somewhere with no way out", () => {
    for (const world of WORLDS) expect(nextWorld(world.id)).toBeDefined();
  });
});
