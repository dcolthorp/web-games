// The cracked screen (Penelope, 2026-11-19). In My Cozy Sewing, if you keep
// clicking the floor after it tells you to stop, a mallet pops out and cracks
// the screen. The crack stays on every page, every game and every menu, until
// you find the game that heals it: Drawing Switch.
//
// This file is put on every page by vite.config.ts. My Cozy Sewing calls
// crackScreen() to make the crack.

const KEY = "cracked-screen";
const HEALS_AT = "/games/draw-switch/";

interface Crack { x: number; y: number; seed: number }

function read(): Crack | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as Crack | null;
    return c && typeof c.x === "number" ? c : null;
  } catch {
    return null;
  }
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** SVG of cracked glass, hitting at (x, y) as a fraction of the screen. */
function crackSvg(c: Crack): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = c.x * w;
  const cy = c.y * h;
  const r = rng(c.seed);
  const far = Math.hypot(w, h);
  const rays: [number, number][][] = [];
  const n = 14 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + r() * 0.3;
    const pts: [number, number][] = [[cx, cy]];
    let d = 0;
    const len = far * (0.35 + r() * 0.7);
    while (d < len) {
      d += 30 + r() * 70;
      a += (r() - 0.5) * 0.35;
      pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
    }
    rays.push(pts);
  }
  const paths: string[] = [];
  const line = (pts: [number, number][]) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L");
  for (const ray of rays) paths.push(line(ray));
  // Rings joining the rays, like a spider web.
  for (const ringAt of [1, 2, 3, 5]) {
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i]![ringAt];
      const b = rays[(i + 1) % rays.length]![ringAt];
      if (a && b && r() < 0.75) {
        const mx = (a[0] + b[0]) / 2 + (r() - 0.5) * 20;
        const my = (a[1] + b[1]) / 2 + (r() - 0.5) * 20;
        paths.push(line([a, [mx, my], b]));
      }
    }
  }
  const d = paths.join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <circle cx="${cx}" cy="${cy}" r="46" fill="rgba(255,255,255,0.25)" />
    <path d="${d}" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="4" stroke-linejoin="round" transform="translate(1.5,1.5)" />
    <path d="${d}" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linejoin="round" />
    <circle cx="${cx}" cy="${cy}" r="18" fill="rgba(255,255,255,0.7)" stroke="rgba(0,0,0,0.4)" stroke-width="2" />
  </svg>`;
}

let layer: HTMLDivElement | null = null;

function render() {
  const c = read();
  if (!c) {
    layer?.remove();
    layer = null;
    return;
  }
  if (!layer) {
    layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;transition:opacity 1.5s;";
    document.body.appendChild(layer);
  }
  layer.innerHTML = crackSvg(c);
}

/** Cracks the screen at (x, y), a fraction of the screen (0 to 1). */
export function crackScreen(x: number, y: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ x, y, seed: Math.floor(Math.random() * 1e9) }));
  } catch {
    // No storage: it still cracks, just not for long.
  }
  render();
}

function heal() {
  if (!layer) return;
  const healing = layer;
  layer = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Fine.
  }
  const note = document.createElement("div");
  note.textContent = "✨ Drawing Switch healed your screen! ✨";
  note.style.cssText =
    "position:fixed;left:50%;top:40%;white-space:nowrap;transform:translate(-50%,-50%);z-index:2147483647;padding:18px 28px;border-radius:999px;background:#fff;color:#d0477f;font:800 26px 'Trebuchet MS',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);pointer-events:none;transition:opacity 1s;";
  document.body.appendChild(note);
  healing.style.opacity = "0";
  window.setTimeout(() => healing.remove(), 1600);
  window.setTimeout(() => (note.style.opacity = "0"), 2600);
  window.setTimeout(() => note.remove(), 3700);
}

render();
window.addEventListener("resize", render);
window.addEventListener("storage", (e) => {
  if (e.key === KEY) render();
});
if (location.pathname.includes(HEALS_AT) && read()) window.setTimeout(heal, 900);
