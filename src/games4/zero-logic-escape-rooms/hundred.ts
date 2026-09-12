import { ctx, roundRect } from "./engine";

// Shared bits for Hundred Logic Escape Rooms: what this game turns into when
// the switch on its Games 4 card is flipped up. Same rooms, but every way out
// makes sense.

export const HUNDRED_KEY = "zero-logic-escape-rooms-hundred";

export function isHundred(): boolean {
  try {
    return localStorage.getItem(HUNDRED_KEY) === "true";
  } catch {
    return false;
  }
}

export interface Floater {
  text: string;
  x: number;
  y: number;
  start: number;
}

export const FLOAT_MS = 1600;

// Short messages that float up and fade, like "It's locked."
export function drawFloaters(floaters: Floater[], now: number): void {
  ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#fff";
  for (const f of floaters) {
    const t = (now - f.start) / FLOAT_MS;
    if (t < 0 || t >= 1) continue;
    ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
    ctx.strokeText(f.text, f.x, f.y - 30 * t);
    ctx.fillText(f.text, f.x, f.y - 30 * t);
  }
  ctx.globalAlpha = 1;
}

// A box in the top-left corner listing what you've got so far.
export function drawNotes(lines: string[]): void {
  if (lines.length === 0) return;
  ctx.font = "bold 15px 'Trebuchet MS', sans-serif";
  const width = Math.max(...lines.map((text) => ctx.measureText(text).width)) + 28;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  roundRect(14, 12, width, 16 + lines.length * 21, 10);
  ctx.fill();
  ctx.fillStyle = "#ffd23f";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lines.forEach((text, i) => ctx.fillText(text, 28, 30 + i * 21));
}

// A brass key centered on (x, y), pointing right.
export function drawKey(x: number, y: number, angle = 0, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#d9a52a";
  ctx.strokeStyle = "#7a5712";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-14, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7a5712";
  ctx.beginPath();
  ctx.arc(-14, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d9a52a";
  ctx.fillRect(-5, -3, 26, 6);
  ctx.strokeRect(-5, -3, 26, 6);
  ctx.fillRect(12, 3, 4, 6);
  ctx.fillRect(18, 3, 3, 4);
  ctx.restore();
}

// A wooden door in its frame. open goes from 0 (shut) to 1 (swung all the way
// open onto a sunny outside). The handle is at (x + w - 16, y + h * 0.52).
export function drawDoor(x: number, y: number, w: number, h: number, open: number): void {
  const outside = ctx.createLinearGradient(0, y, 0, y + h);
  outside.addColorStop(0, "#8fd0ff");
  outside.addColorStop(0.68, "#dff2ff");
  outside.addColorStop(0.68, "#6fcf5f");
  outside.addColorStop(1, "#4fa84b");
  ctx.fillStyle = outside;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#5e3a1c";
  ctx.lineWidth = 8;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 4);

  // It swings in on its hinges, so it gets narrower as it opens.
  const dw = w * (1 - open * 0.85);
  ctx.fillStyle = "#9a6535";
  ctx.fillRect(x, y, dw, h);
  if (dw > 24) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + dw * 0.15, y + h * 0.08, dw * 0.7, h * 0.36);
    ctx.strokeRect(x + dw * 0.15, y + h * 0.54, dw * 0.7, h * 0.36);
  }
  if (open < 0.3) {
    ctx.fillStyle = "#d9a52a";
    ctx.beginPath();
    ctx.arc(x + dw - 16, y + h * 0.52, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
