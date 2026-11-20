// The floor at the bottom of Penelope's Games (Penelope, 2026-11-20).
// It looks like a cute normal floor, with a bow on top. But click it and a
// red heart floats up above the bow. Every click the heart turns more grey and
// the floor asks you to stop, until it says "I warned you". Then the heart
// cracks, the pieces fall onto the floor and fade away. Then the mallet comes
// out of the floor and cracks the screen (until Drawing Switch heals it).

import { malletSmash } from "../../shared/malletSmash";

const SAYS = ["Would you please stop?", "Can you PLEASE stop.", "PLEASE STOP. I'M SERIOUS.", "I warned you"];
// The heart: red first, then greyer and greyer.
const HOLE_COLORS = ["#ef2d4f", "#c25566", "#8f7f82", "#a9a9a9"];

let audio: AudioContext | null = null;
function beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, when = 0) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime + when;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    // No sound.
  }
}

const BOW_SVG = `<svg viewBox="0 0 120 70" width="120" height="70" aria-hidden="true">
  <path d="M60 35 C40 5 8 4 10 30 C12 54 42 52 60 35Z" fill="#ff7eb3" stroke="#c22f6c" stroke-width="3"/>
  <path d="M60 35 C80 5 112 4 110 30 C108 54 78 52 60 35Z" fill="#ff7eb3" stroke="#c22f6c" stroke-width="3"/>
  <path d="M30 22 C38 24 46 28 52 33" stroke="#ffc2dc" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M90 22 C82 24 74 28 68 33" stroke="#ffc2dc" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M54 40 L40 68 L50 64 L56 69 Z" fill="#ff5c9a" stroke="#c22f6c" stroke-width="3"/>
  <path d="M66 40 L80 68 L70 64 L64 69 Z" fill="#ff5c9a" stroke="#c22f6c" stroke-width="3"/>
  <ellipse cx="60" cy="36" rx="11" ry="12" fill="#ff5c9a" stroke="#c22f6c" stroke-width="3"/>
</svg>`;

export function addTrapFloor() {
  const floor = document.createElement("div");
  floor.className = "penelope-floor";
  floor.innerHTML = `<div class="penelope-floor-bow">${BOW_SVG}</div>`;
  document.body.appendChild(floor);

  let clicks = 0;
  let hole: HTMLDivElement | null = null;
  let bubble: HTMLDivElement | null = null;
  let busy = false;

  floor.addEventListener("click", () => {
    if (busy) return;
    if (!hole) {
      // The heart floats up above the bow.
      hole = document.createElement("div");
      hole.className = "penelope-floor-hole";
      hole.style.left = "50%";
      hole.style.top = "-118px";
      floor.appendChild(hole);
    }
    hole.style.background = `radial-gradient(ellipse at 50% 40%, ${HOLE_COLORS[clicks]} 55%, ${shade(HOLE_COLORS[clicks]!)} 100%)`;
    hole.classList.remove("pop");
    void hole.offsetWidth;
    hole.classList.add("pop");

    bubble?.remove();
    bubble = document.createElement("div");
    bubble.className = "penelope-floor-says side" + (clicks >= 2 ? " loud" : "");
    bubble.textContent = SAYS[clicks]!;
    bubble.style.left = hole.style.left;
    bubble.style.top = hole.style.top;
    floor.appendChild(bubble);
    beep(clicks >= 2 ? 150 : 240 - clicks * 30, 0.2);

    clicks++;
    if (clicks >= SAYS.length) {
      busy = true;
      const h = hole;
      const b = bubble;
      window.setTimeout(() => crackAndFall(h, b, () => {
        hole = null;
        bubble = null;
        clicks = 0;
        busy = false;
      }), 1300);
    }
  });
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * 0.55);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** The hole cracks into pieces that fall down and fade away. */
function crackAndFall(hole: HTMLDivElement, bubble: HTMLDivElement, done: () => void) {
  bubble.remove();
  // Crack lines first.
  hole.insertAdjacentHTML(
    "beforeend",
    `<svg class="penelope-floor-crack" viewBox="0 0 120 110" aria-hidden="true">
      <path d="M60 50 L40 22 L30 4 M60 50 L62 18 M60 50 L88 20 L100 6 M60 50 L104 44 L120 40 M60 50 L80 80 M60 50 L56 100 M60 50 L34 74 M60 50 L8 42 L0 34 M40 22 L18 20 M88 20 L108 26 M34 74 L20 60 M80 80 L96 66"
        stroke="#fff" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    </svg>`
  );
  [2600, 1900, 3100].forEach((f, i) => beep(f, 0.1, "triangle", 0.07, i * 0.05));

  window.setTimeout(() => {
    // Break the hole into pieces (wedges around the middle), and drop them.
    const pieces = 8;
    const color = hole.style.background;
    for (let i = 0; i < pieces; i++) {
      const a1 = (i / pieces) * Math.PI * 2;
      const a2 = ((i + 1) / pieces) * Math.PI * 2;
      const pt = (a: number) => `${50 + Math.cos(a) * 75}% ${50 + Math.sin(a) * 75}%`;
      // A wedge of the heart: the outside cuts the wedge, the inside is heart-shaped.
      const piece = document.createElement("div");
      piece.className = "penelope-floor-piece";
      piece.style.left = hole.style.left;
      piece.style.top = hole.style.top;
      piece.style.clipPath = `polygon(50% 45%, ${pt(a1)}, ${pt((a1 + a2) / 2)}, ${pt(a2)})`;
      const heart = document.createElement("div");
      heart.className = "penelope-floor-heart-shape";
      heart.style.background = color;
      piece.appendChild(heart);
      hole.parentElement!.appendChild(piece);
      const dx = Math.cos((a1 + a2) / 2) * 40 + (Math.random() - 0.5) * 30;
      const spin = (Math.random() - 0.5) * 120;
      piece.animate(
        [
          { transform: "translate(-50%, -50%)", opacity: 1 },
          { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% - 14px)) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.2 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + 200px)) rotate(${spin}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + 200px)) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 2200, easing: "ease-in", fill: "forwards" }
      ).onfinish = () => piece.remove();
    }
    hole.remove();
    beep(90, 0.3, "sawtooth", 0.12, 0.6);
    // Then the mallet comes up out of the floor.
    const floor = document.querySelector(".penelope-floor")!.getBoundingClientRect();
    const x = floor.left + floor.width / 2;
    const y = Math.min(window.innerHeight - 30, floor.top + 100);
    window.setTimeout(() => void malletSmash(x, y).then(done), 2300);
  }, 700);
}
