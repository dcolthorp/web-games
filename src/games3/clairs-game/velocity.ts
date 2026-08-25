/**
 * The velocity meter. One click in the last second is 1, two is 2, three is 4,
 * and every extra click in that second doubles it again — so it climbs
 * absurdly fast if you mash, and falls straight back down when you stop.
 */

/** Clicks only count while they're this fresh. */
export const WINDOW_MS = 1000;

/** Cross this and something is supposed to happen. */
export const BREAK_POINT = 100;

/** 0 clicks is standing still; after that each click doubles the last. */
export function velocityFor(clicks: number): number {
  if (clicks <= 0) return 0;
  return 2 ** (clicks - 1);
}

/** Drop the clicks that have aged out of the window. */
export function prune(times: number[], now: number, windowMs = WINDOW_MS): number[] {
  return times.filter((time) => now - time < windowMs);
}

/** How many clicks are still counting right now. */
export function clicksInWindow(times: number[], now: number, windowMs = WINDOW_MS): number {
  return prune(times, now, windowMs).length;
}

/**
 * Big numbers arrive quickly — 30 clicks in a second is over half a billion —
 * so past a million switch to something that still fits on the button.
 */
export function formatVelocity(velocity: number): string {
  if (velocity < 1_000_000) return velocity.toLocaleString("en-US");
  if (!Number.isFinite(velocity)) return "∞";
  return velocity.toExponential(2).replace("e+", " × 10^");
}
