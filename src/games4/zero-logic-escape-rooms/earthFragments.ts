import { ctx } from "./engine";

// Earth fragments come after the three switch pieces. Each is a quarter of the
// Earth, and all four together will unlock a new game, World Sandbox. The
// mirror maze gives out the first one.

export const EARTH_FRAGMENT_COUNT = 4;

const fragmentKey = (n: number): string => `zero-logic-escape-rooms-earth-fragment-${n}`;
const foundThisVisit = new Set<number>();
let onChange = (): void => {};

export function hasEarthFragment(n: number): boolean {
  if (foundThisVisit.has(n)) return true;
  try {
    return localStorage.getItem(fragmentKey(n)) === "true";
  } catch {
    return false;
  }
}

export function collectEarthFragment(n: number): void {
  foundThisVisit.add(n);
  try {
    localStorage.setItem(fragmentKey(n), "true");
  } catch {
    // Only kept until the page reloads.
  }
  onChange();
}

export function whenEarthFragmentsChange(callback: () => void): void {
  onChange = callback;
}

export function collectedEarthFragments(): number[] {
  return Array.from({ length: EARTH_FRAGMENT_COUNT }, (_, i) => i + 1).filter(hasEarthFragment);
}

// Which quarter of the Earth fragment n is, as start and end angles.
function wedgeAngles(n: number): [number, number] {
  const start = -Math.PI / 2 + (n - 1) * ((Math.PI * 2) / EARTH_FRAGMENT_COUNT);
  return [start, start + (Math.PI * 2) / EARTH_FRAGMENT_COUNT];
}

function iconFor(n: number): string {
  const [a0, a1] = wedgeAngles(n);
  const mid = (a0 + a1) / 2;
  const r = 13;
  const point = (a: number, d: number): string => `${(16 + Math.cos(a) * d).toFixed(1)} ${(16 + Math.sin(a) * d).toFixed(1)}`;
  return `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16 16 L${point(a0, r)} A${r} ${r} 0 0 1 ${point(a1, r)} Z" fill="#2f7fd8" stroke="#0e2a4d" stroke-width="1.5" />
    <circle cx="${point(mid, r * 0.55).split(" ")[0]}" cy="${point(mid, r * 0.55).split(" ")[1]}" r="3.5" fill="#4fbf5a" />
  </svg>`;
}

export const EARTH_FRAGMENT_ICONS: Record<number, string> = Object.fromEntries(
  Array.from({ length: EARTH_FRAGMENT_COUNT }, (_, i) => [i + 1, iconFor(i + 1)])
);

// Drawn roughly centered on (x, y). At scale 1 the whole Earth would be 100 across.
export function drawEarthFragment(n: number, x: number, y: number, scale = 1): void {
  const r = 50;
  const [start, end] = wedgeAngles(n);
  const mid = (start + end) / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Shift it so the wedge, not the middle of the Earth, sits on (x, y).
  ctx.translate(-Math.cos(mid) * r * 0.4, -Math.sin(mid) * r * 0.4);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, start, end);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  const ocean = ctx.createRadialGradient(-12, -14, 6, 0, 0, r);
  ocean.addColorStop(0, "#7fd0ff");
  ocean.addColorStop(1, "#1d5fb8");
  ctx.fillStyle = ocean;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  // The same land for every fragment, so the three fit together into one Earth.
  ctx.fillStyle = "#4fbf5a";
  for (const [lx, ly, lr] of [
    [-18, -22, 14],
    [-30, -6, 10],
    [20, -28, 12],
    [30, -10, 9],
    [8, 18, 16],
    [-24, 26, 10],
    [32, 24, 8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "#0e2a4d";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
