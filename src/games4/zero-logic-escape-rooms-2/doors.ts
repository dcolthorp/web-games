// Escape Room 4's rules, away from the canvas. Where a door can turn up, how
// close is too close, and how long the sentence takes to lose its temper.

export interface Point {
  x: number;
  y: number;
}

export interface DoorSpot extends Point {
  // Doors on the back wall stand up straight; the side ones lean with the room.
  lean: number;
}

// Nowhere is safe. It puts the next one as far from the last one as it can be
// bothered to, which is "somewhere else".
export const DOOR_SPOTS: DoorSpot[] = [
  { x: 300, y: 250, lean: 0 },
  { x: 660, y: 250, lean: 0 },
  { x: 480, y: 235, lean: 0 },
  { x: 195, y: 270, lean: 0.12 },
  { x: 765, y: 270, lean: -0.12 },
  { x: 390, y: 265, lean: 0 },
];

export const GRAB_RANGE = 165;
export const MIN_PATIENCE = 0.35;
export const MAX_PATIENCE = 1.2;

export function doorSpot(index: number): DoorSpot {
  const spot = DOOR_SPOTS[((index % DOOR_SPOTS.length) + DOOR_SPOTS.length) % DOOR_SPOTS.length];
  return spot ?? { x: 480, y: 250, lean: 0 };
}

/** The next door is never where the last one was. */
export function nextSpot(current: number, roll: number): number {
  const step = 1 + Math.floor(roll * (DOOR_SPOTS.length - 1));
  return (current + Math.min(step, DOOR_SPOTS.length - 1)) % DOOR_SPOTS.length;
}

export function isNear(pointer: Point, door: Point, range = GRAB_RANGE): boolean {
  return Math.hypot(pointer.x - door.x, pointer.y - door.y) < range;
}

/** How long it puts up with you standing near the door before it reaches up. */
export function patienceFor(roll: number): number {
  return MIN_PATIENCE + roll * (MAX_PATIENCE - MIN_PATIENCE);
}
