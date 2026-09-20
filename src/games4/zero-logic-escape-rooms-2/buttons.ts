// The buttons in Escape Room 2, kept away from the canvas so the one rule of
// the room can be checked on its own: every last one has to be pressed in.

export type ButtonShape = "round" | "square" | "wide" | "tiny";

export interface RoomButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: ButtonShape;
  color: string;
  tilt: number;
  pressed: boolean;
}

interface Spec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: ButtonShape;
  color: string;
  tilt?: number;
}

// Back wall, ceiling, floor, both side walls, and one on top of another one.
const LAYOUT: Spec[] = [
  { id: "big-red", x: 420, y: 150, w: 120, h: 120, shape: "round", color: "#e04848" },
  { id: "blue", x: 200, y: 110, w: 70, h: 70, shape: "round", color: "#4a86d8" },
  { id: "green", x: 700, y: 110, w: 70, h: 70, shape: "round", color: "#4aa86a" },
  { id: "yellow-square", x: 190, y: 250, w: 84, h: 84, shape: "square", color: "#e8c24a" },
  { id: "purple-square", x: 690, y: 250, w: 84, h: 84, shape: "square", color: "#9558c4" },
  { id: "wide-orange", x: 380, y: 310, w: 200, h: 52, shape: "wide", color: "#e08a3c" },
  { id: "doorbell", x: 320, y: 90, w: 46, h: 46, shape: "round", color: "#d8d2c4" },
  { id: "teal", x: 590, y: 90, w: 46, h: 46, shape: "round", color: "#43b0a8" },
  { id: "ceiling", x: 455, y: 12, w: 60, h: 20, shape: "wide", color: "#c9c2b4" },
  { id: "floor", x: 430, y: 480, w: 110, h: 44, shape: "wide", color: "#b06a9a", tilt: 0.04 },
  { id: "left-wall", x: 36, y: 250, w: 56, h: 90, shape: "square", color: "#7a9ad8", tilt: 0.42 },
  { id: "right-wall", x: 872, y: 250, w: 56, h: 90, shape: "square", color: "#d87a9a", tilt: -0.42 },
  // A button on a button. It counts.
  { id: "on-the-big-one", x: 462, y: 192, w: 34, h: 34, shape: "tiny", color: "#2a2a2a" },
];

// Pressing a tiny button makes another tiny button, because of course it does.
const SPAWNS: Spec[] = [
  { id: "spawn-1", x: 120, y: 60, w: 40, h: 40, shape: "tiny", color: "#e8c24a" },
  { id: "spawn-2", x: 800, y: 350, w: 40, h: 40, shape: "tiny", color: "#4a86d8" },
];

// The one sitting on top of the big red one.
export const RIDER_BUTTON = "on-the-big-one";

export function makeButtons(): RoomButton[] {
  return LAYOUT.map((spec) => ({ ...spec, tilt: spec.tilt ?? 0, pressed: false }));
}

export function spawnAt(index: number): RoomButton | null {
  const spec = SPAWNS[index];
  return spec ? { ...spec, tilt: spec.tilt ?? 0, pressed: false } : null;
}

export function spawnCount(): number {
  return SPAWNS.length;
}

export function allPressed(buttons: RoomButton[]): boolean {
  return buttons.length > 0 && buttons.every((button) => button.pressed);
}

export function pressedCount(buttons: RoomButton[]): number {
  return buttons.filter((button) => button.pressed).length;
}

// Topmost first, so the little one riding on the big red one gets the press.
export function buttonAt(buttons: RoomButton[], x: number, y: number): RoomButton | null {
  for (let index = buttons.length - 1; index >= 0; index -= 1) {
    const button = buttons[index];
    if (!button) continue;
    if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
      return button;
    }
  }
  return null;
}
