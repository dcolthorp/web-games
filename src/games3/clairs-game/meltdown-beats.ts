/**
 * What happens after you break 100, and when. Kept apart from the drawing so
 * the running order can be pinned down in tests:
 *
 *   runaway  you stop being able to steer and just go, forever, whichever way
 *            you were pointing
 *   digits   ones and zeros start popping up everywhere
 *   bsod     it blue-screens and the game appears to crash
 *   hand     five seconds later a hand reaches in, swipes through the sad
 *            face, and pulls the screen away
 *   matrix   somewhere else entirely
 */

export type Beat = "runaway" | "digits" | "bsod" | "hand" | "matrix";

/** Seconds from the break at which each beat ENDS. */
export const BEATS: ReadonlyArray<{ beat: Beat; until: number }> = [
  { beat: "runaway", until: 5 },
  { beat: "digits", until: 8.5 },
  // The long one on purpose: you have to sit there thinking it really crashed.
  { beat: "bsod", until: 13.5 },
  { beat: "hand", until: 17.2 },
];

export const TOTAL = BEATS[BEATS.length - 1]!.until;

export function beatAt(elapsed: number): Beat {
  for (const step of BEATS) {
    if (elapsed < step.until) return step.beat;
  }
  return "matrix";
}

/** How far through its own beat you are, 0 to 1 — for fades and ramps. */
export function beatProgress(elapsed: number): number {
  let from = 0;
  for (const step of BEATS) {
    if (elapsed < step.until) {
      const span = step.until - from;
      return span <= 0 ? 1 : Math.min(1, Math.max(0, (elapsed - from) / span));
    }
    from = step.until;
  }
  return 1;
}

/** How long the blue screen sits there before the hand shows up. */
export function crashDwell(): number {
  const bsod = BEATS.find((step) => step.beat === "bsod")!;
  const digits = BEATS.find((step) => step.beat === "digits")!;
  return bsod.until - digits.until;
}
