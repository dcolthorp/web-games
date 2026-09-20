export interface Room {
  name: string;
  line: string;
  color: string;
  ink: string;
}

// Nobody gets out of the first few doors. The hallway wants you to look around.
export const DOORS_BEFORE_EXIT = 5;

export const ROOMS: Room[] = [
  { name: "THE STAIR ROOM", line: "Made entirely of stairs. None of them arrive anywhere.", color: "#2c2f4a", ink: "#9fd6ff" },
  { name: "THE BIRTHDAY", line: "Somebody's party. The candles are still lit. Nobody came.", color: "#4a2340", ink: "#ffd0ec" },
  { name: "THE POOL", line: "An indoor pool at 3am. The water is very still.", color: "#10404d", ink: "#7fe7ff" },
  { name: "THE OFFICE", line: "Every computer is on. Every chair is warm.", color: "#3b3a2a", ink: "#ffe9a8" },
  { name: "THE FOREST", line: "Carpet, then trees, then carpet again.", color: "#1e3a24", ink: "#a8ffb8" },
  { name: "THE SAME HALLWAY", line: "You've been here. You're sure of it.", color: "#262233", ink: "#d9c8ff" },
  { name: "THE BALL PIT", line: "It's deeper than a ball pit should be.", color: "#4a1f1f", ink: "#ffb3b3" },
  { name: "THE TV ROOM", line: "Forty televisions, all showing this room.", color: "#1c2b33", ink: "#b8f0ff" },
  { name: "THE ATTIC", line: "Boxes with your handwriting on them. You didn't write it.", color: "#3d2e1e", ink: "#ffd9a3" },
  { name: "THE CAFETERIA", line: "Lunch for two hundred. Trays still steaming.", color: "#2a3b2f", ink: "#c8ffd6" },
  { name: "THE ELEVATOR", line: "One button. It's already pressed.", color: "#33333d", ink: "#e6e6ff" },
  { name: "THE BEACH", line: "Fluorescent lights over an ocean. It's low tide.", color: "#3a3320", ink: "#ffeeb0" },
];

export function roomFor(roll: number): Room {
  const index = Math.abs(Math.floor(roll)) % ROOMS.length;
  return ROOMS[index] ?? ROOMS[0] ?? { name: "A ROOM", line: "It's empty.", color: "#222", ink: "#fff" };
}

/**
 * Which of the three doors leads out, or null when this set is all more
 * hallway. The way out only shows up once you've opened enough doors, and
 * then it gets likelier every time, so nobody is stuck in here forever.
 */
export function exitDoor(opened: number, roll: number): number | null {
  if (opened < DOORS_BEFORE_EXIT) return null;
  const chance = Math.min(1, 0.25 + (opened - DOORS_BEFORE_EXIT) * 0.15);
  if (roll >= chance) return null;
  // Reuse the same roll for the door number so one random number does both.
  return Math.floor((roll / chance) * 3) % 3;
}
