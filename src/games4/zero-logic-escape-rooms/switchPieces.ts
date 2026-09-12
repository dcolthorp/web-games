import { ctx, roundRect } from "./engine";

// Switch pieces are hidden in the bonus levels, one in each. All together they
// make a secret switch. How many there are and what the switch opens hasn't
// been decided yet, so for now they're just collected and shown under the game.

// Pieces that have a bonus level giving them out so far.
export const SWITCH_PIECES_BUILT = 3;

// Piece 1 is the plate the switch sits in, piece 2 is the lever that flips, and
// piece 3 is the two screws that hold it on the wall.
export const SWITCH_PIECE_ICONS: Record<number, string> = {
  1: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="8" y="3" width="16" height="26" rx="3" fill="#f4f1ea" stroke="#8d8778" stroke-width="1.5" />
    <rect x="13" y="10" width="6" height="12" rx="1.5" fill="#3a3a3a" />
    <circle cx="16" cy="6.5" r="1.2" fill="#b9b3a4" />
    <circle cx="16" cy="25.5" r="1.2" fill="#b9b3a4" />
  </svg>`,
  2: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="12" y="5" width="8" height="22" rx="2.5" fill="#f4f1ea" stroke="#8d8778" stroke-width="1.5" />
    <rect x="12" y="5" width="8" height="8" rx="2.5" fill="#dcd6c6" />
  </svg>`,
  3: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="8.5" y="17" width="3" height="11" fill="#a9a293" />
    <rect x="20.5" y="17" width="3" height="11" fill="#a9a293" />
    <circle cx="10" cy="13" r="6" fill="#d8d1bf" stroke="#6f6a5e" stroke-width="1.5" />
    <circle cx="22" cy="13" r="6" fill="#d8d1bf" stroke="#6f6a5e" stroke-width="1.5" />
    <path d="M6.5 13 H13.5 M18.5 13 H25.5" stroke="#6f6a5e" stroke-width="1.8" />
  </svg>`,
};

const pieceKey = (n: number): string => `zero-logic-escape-rooms-switch-piece-${n}`;
const foundThisVisit = new Set<number>();
let onChange = (): void => {};

export function hasSwitchPiece(n: number): boolean {
  if (foundThisVisit.has(n)) return true;
  try {
    return localStorage.getItem(pieceKey(n)) === "true";
  } catch {
    return false;
  }
}

export function collectSwitchPiece(n: number): void {
  foundThisVisit.add(n);
  try {
    localStorage.setItem(pieceKey(n), "true");
  } catch {
    // Only kept until the page reloads.
  }
  onChange();
}

export function whenSwitchPiecesChange(callback: () => void): void {
  onChange = callback;
}

export function collectedSwitchPieces(): number[] {
  return Array.from({ length: SWITCH_PIECES_BUILT }, (_, i) => i + 1).filter(hasSwitchPiece);
}

// Drawn centered on (x, y). At scale 1 the plate is 60 × 90, the lever 18 × 52,
// and the pair of screws about 56 × 42.
export function drawSwitchPiece(n: number, x: number, y: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#8d8778";
  ctx.lineWidth = 3;
  if (n === 1) {
    ctx.fillStyle = "#f4f1ea";
    roundRect(-30, -45, 60, 90, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3a3a3a";
    roundRect(-10, -22, 20, 44, 4);
    ctx.fill();
    ctx.fillStyle = "#b9b3a4";
    for (const sy of [-36, 36]) {
      ctx.beginPath();
      ctx.arc(0, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (n === 2) {
    ctx.fillStyle = "#f4f1ea";
    roundRect(-9, -26, 18, 52, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#dcd6c6";
    roundRect(-9, -26, 18, 18, 5);
    ctx.fill();
  } else {
    for (const sx of [-16, 16]) {
      // Threaded shaft
      ctx.fillStyle = "#a9a293";
      ctx.fillRect(sx - 4, 2, 8, 24);
      ctx.strokeStyle = "#6f6a5e";
      ctx.lineWidth = 1.5;
      for (let ty = 6; ty < 26; ty += 5) {
        ctx.beginPath();
        ctx.moveTo(sx - 4, ty);
        ctx.lineTo(sx + 4, ty + 2);
        ctx.stroke();
      }
      // Head with a slot across it
      ctx.fillStyle = "#d8d1bf";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, -4, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 7, -4);
      ctx.lineTo(sx + 7, -4);
      ctx.stroke();
    }
  }
  ctx.restore();
}
