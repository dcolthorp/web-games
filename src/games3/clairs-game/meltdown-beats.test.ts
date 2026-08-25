import { describe, expect, it } from "vitest";
import { beatAt, beatProgress, BEATS, crashDwell, TOTAL } from "./meltdown-beats";

describe("the running order", () => {
  it("starts by taking the controls away, not by crashing", () => {
    expect(beatAt(0)).toBe("runaway");
    expect(beatAt(4.9)).toBe("runaway");
  });

  it("brings the ones and zeros in after five seconds", () => {
    expect(beatAt(5)).toBe("digits");
    expect(beatAt(8.4)).toBe("digits");
  });

  it("blue-screens after that, and sits there", () => {
    expect(beatAt(8.5)).toBe("bsod");
    expect(beatAt(13.4)).toBe("bsod");
  });

  it("leaves the crash up for a full five seconds before the hand", () => {
    expect(crashDwell()).toBe(5);
  });

  it("sends the hand in, then somewhere else entirely", () => {
    expect(beatAt(13.5)).toBe("hand");
    expect(beatAt(17.1)).toBe("hand");
    expect(beatAt(TOTAL)).toBe("matrix");
    expect(beatAt(9999)).toBe("matrix");
  });

  it("never goes backwards", () => {
    const order = ["runaway", "digits", "bsod", "hand", "matrix"];
    let seen = -1;
    for (let t = 0; t <= 20; t += 0.1) {
      const at = order.indexOf(beatAt(t));
      expect(at).toBeGreaterThanOrEqual(seen);
      seen = at;
    }
  });

  it("has beats that run in order with no gaps", () => {
    let previous = 0;
    for (const step of BEATS) {
      expect(step.until).toBeGreaterThan(previous);
      previous = step.until;
    }
  });
});

describe("beatProgress", () => {
  it("runs 0 to 1 within each beat, not across the whole sequence", () => {
    expect(beatProgress(0)).toBeCloseTo(0);
    expect(beatProgress(2.5)).toBeCloseTo(0.5);
    expect(beatProgress(4.99)).toBeCloseTo(1, 1);
    expect(beatProgress(5)).toBeCloseTo(0);
    expect(beatProgress(6.75)).toBeCloseTo(0.5);
  });

  it("is finished once you're through to the other side", () => {
    expect(beatProgress(TOTAL)).toBe(1);
  });
});
