import { CELESTIAL, CREATURES } from "./creatures";
import { DISASTERS, LAND } from "./land";
import { LIFE } from "./life";
import type { Sprite } from "./sprites";
import { seededRandom } from "./world";

// Another dimension looks like ours with the colours swapped about. Everything
// that grew up over there (the land, the plants and animals, the weather,
// the creatures and the things in the sky) gets new colours. Whatever came
// through a portal, or was built by somebody who did (people, tribes, tech,
// bosses), keeps the colours it had at home.
//
// A dimension's `hue` is its own random number. Home is 0: nothing changes.

export const NATIVE = new Set([...LAND, ...LIFE, ...DISASTERS, ...CREATURES, ...CELESTIAL].map((c) => c.id));

// Colours are sorted into 12 families by hue (the greens, the blues, the
// yellows…), and each family gets its own random new hue. A tree's light
// and dark greens stay a light and a dark of the same colour, so it still
// looks like a tree, only not a green one.
const FAMILIES = 12;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const shiftCache = new Map<string, [number, number, number]>();

/** The colour (r, g, b) as it looks in the dimension with this hue. */
export function shiftRgb(r: number, g: number, b: number, hue: number): [number, number, number] {
  if (!hue) return [r, g, b];
  const key = `${hue}:${r},${g},${b}`;
  let out = shiftCache.get(key);
  if (!out) {
    const [h, s, l] = rgbToHsl(r, g, b);
    // Greys, black and white have no colour to change.
    if (s < 0.1) {
      out = [r, g, b];
    } else {
      const family = Math.round(h / (360 / FAMILIES)) % FAMILIES;
      // Always at least a sixth of the way round the colour wheel, so nothing
      // comes out looking the same as it does at home.
      const newHue = h + 60 + seededRandom(hue * FAMILIES + family)() * 240;
      out = hslToRgb(newHue, s, l);
    }
    shiftCache.set(key, out);
  }
  return out;
}

export function shiftHex(hex: string, hue: number): string {
  if (!hue) return hex;
  const [r, g, b] = shiftRgb(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), hue);
  return `rgb(${r}, ${g}, ${b})`;
}

// Each sprite is recoloured once per dimension, the first time it is drawn there.
let cachedHue = 0;
const spriteCache = new Map<Sprite, Sprite>();

export function shiftSprite(s: Sprite, hue: number): Sprite {
  if (!hue) return s;
  if (hue !== cachedHue) {
    spriteCache.clear();
    cachedHue = hue;
  }
  let out = spriteCache.get(s);
  if (!out) {
    const frames = s.frames.map((frame) => {
      const copy = document.createElement("canvas");
      copy.width = frame.width;
      copy.height = frame.height;
      const g = copy.getContext("2d") as CanvasRenderingContext2D;
      g.drawImage(frame, 0, 0);
      const image = g.getImageData(0, 0, copy.width, copy.height);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const [r, gr, b] = shiftRgb(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0, hue);
        d[i] = r;
        d[i + 1] = gr;
        d[i + 2] = b;
      }
      g.putImageData(image, 0, 0);
      return copy;
    });
    out = { width: s.width, height: s.height, frames };
    spriteCache.set(s, out);
  }
  return out;
}
