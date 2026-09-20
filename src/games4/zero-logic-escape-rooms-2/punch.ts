// Escape Room 3's rules, kept away from the canvas: what a punch does to a
// crack, and what a punch does to the thing in the corner. They are not the
// same thing at all, which is the whole room.

export interface Crack {
  id: number;
  x: number;
  y: number;
  angle: number;
  length: number;
  // 1 is a full crack, 0 is a wall with nothing wrong with it.
  size: number;
}

export interface CrackSpec {
  x: number;
  y: number;
  angle: number;
  length: number;
}

// Four good punches and a crack is gone. It never comes back.
export const PUNCHES_PER_CRACK = 4;
// Six and the whole world goes.
export const VIRUS_PUNCHES = 6;

const STARTING_CRACKS: CrackSpec[] = [
  { x: 300, y: 120, angle: 1.35, length: 130 },
  { x: 640, y: 90, angle: 1.9, length: 110 },
  { x: 760, y: 250, angle: 1.1, length: 150 },
  { x: 480, y: 60, angle: 2.5, length: 90 },
  { x: 250, y: 300, angle: 0.7, length: 120 },
];

// Every punch the thing in the corner takes, the world cracks somewhere else.
const EXTRA_CRACKS: CrackSpec[] = [
  { x: 560, y: 330, angle: 2.1, length: 140 },
  { x: 180, y: 160, angle: 0.9, length: 120 },
  { x: 700, y: 380, angle: 1.6, length: 160 },
  { x: 400, y: 200, angle: 2.8, length: 150 },
  { x: 820, y: 150, angle: 1.2, length: 130 },
  { x: 150, y: 380, angle: 2.2, length: 170 },
];

export function makeCracks(): Crack[] {
  return STARTING_CRACKS.map((spec, index) => ({ ...spec, id: index + 1, size: 1 }));
}

export function extraCrack(stage: number, id: number): Crack | null {
  const spec = EXTRA_CRACKS[stage];
  return spec ? { ...spec, id, size: 1 } : null;
}

/** A punched crack gets smaller. At nothing left, it's off the wall for good. */
export function punchCrack(cracks: Crack[], id: number): Crack[] {
  return cracks
    .map((crack) =>
      crack.id === id ? { ...crack, size: crack.size - 1 / PUNCHES_PER_CRACK } : crack
    )
    .filter((crack) => crack.size > 0.001);
}

export function crackAt(cracks: Crack[], x: number, y: number, radius = 44): Crack | null {
  let best: Crack | null = null;
  let bestDistance = radius;
  for (const crack of cracks) {
    // Aim at the middle of what's left of it.
    const midX = crack.x + (Math.cos(crack.angle) * crack.length * crack.size) / 2;
    const midY = crack.y + (Math.sin(crack.angle) * crack.length * crack.size) / 2;
    const distance = Math.hypot(x - midX, y - midY);
    if (distance < bestDistance) {
      best = crack;
      bestDistance = distance;
    }
  }
  return best;
}

/** How far the corner has spread, 0 to 1, after this many punches. */
export function virusReach(stage: number): number {
  return Math.min(1, Math.max(0, stage / VIRUS_PUNCHES));
}

export function worldIsGone(stage: number): boolean {
  return stage >= VIRUS_PUNCHES;
}

// What comes out of the wall when the last punch lands. Oscar wrote this bit.
export const GARBLE =
  "gjvxchrfytgshkytjsgkxhvfrysrh,evzfgszeskrgkthsteyffgrewgrutwrrwuiuit!!!!!!!!!!!!!!";
