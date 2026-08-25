/**
 * The bits of Farttopia worth pinning down in tests: the seamless edges, and
 * how long a squeeze turns into how much shove.
 */

/**
 * Farttopia has no edges. Leaving one side puts you on the other, for any
 * overshoot and either direction — a fast enough fart can cross more than a
 * full screen in one frame, and that still has to land somewhere sensible.
 */
export function wrap(value: number, span: number): number {
  return ((value % span) + span) % span;
}

/**
 * Which wrapped copies of a point need drawing. Anything within `margin` of an
 * edge is also painted on the far side, so a body straddling the seam appears
 * on both — without this you'd see it clip off at an invisible wall.
 */
export function wrappedCopies(
  x: number,
  y: number,
  margin: number,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const xs = [x];
  const ys = [y];
  if (x < margin) xs.push(x + w);
  if (x > w - margin) xs.push(x - w);
  if (y < margin) ys.push(y + h);
  if (y > h - margin) ys.push(y - h);
  const out: Array<{ x: number; y: number }> = [];
  for (const dx of xs) for (const dy of ys) out.push({ x: dx, y: dy });
  return out;
}

/** Hold longer, go farther — clamped at both ends so it stays predictable. */
export function fartImpulse(held: number, maxCharge: number, minPush: number, maxPush: number): number {
  const power = Math.min(1, Math.max(0, held / maxCharge));
  return minPush + (maxPush - minPush) * power;
}
