// The paper card usually reads "click on me". One refresh of the Games 3 hub in
// four, it reads "don't click on me" instead — and the game page plays along.
// The hub rolls the dice and stores the result; the game page reads it. The flag
// survives a reload of the game page, so only a trip back to the hub re-rolls.
//
// From there the title runs a small state machine:
//
//   arguing --5 clicks--> caged --bomb/poison--> why --click--> sealed
//                                                                 |
//                                                    bomb/poison  v
//                                                               freed
//
// Cages are broken from inside the game, not by clicking the title: the title is
// sealed shut at that point, so a stickman has to do it.

export const DEFIANT_KEY = "game-time-defiant";
export const DEFIANT_CHANCE = 0.25;

/** What a stickman click can break out of. */
export type Breaker = "bomb" | "poison";

type Stage = "arguing" | "caged" | "why" | "sealed" | "freed";

/** Shown in order, one per click, until it stops arguing and reaches for a cage. */
const LINES = [
  "DON'T CLICK ON ME",
  "NO SERIOUSLY, DON'T CLICK ON ME",
  "I AM ASKING YOU NICELY. DON'T.",
  "WHY ARE YOU STILL DOING THIS",
  "LAST WARNING. DON'T CLICK ON ME.",
  "HMM. I HAVE AN IDEA.",
];

/** Not a hundred billion y's. Enough to overflow the title and read as endless. */
const WHY_YS = 420;
const SHAKE_MS = 2100;
const CAGE_BARS = 5;
/** How long the crack shows before the box gives way, and the fall after it. */
const CRACK_MS = 260;
const SHARD_MS = 1500;

let stage: Stage = "arguing";
/** True while a box is cracking but has not come apart yet. */
let breaking = false;
let step = 0;
let titleEl: HTMLHeadingElement | null = null;
let boxEl: HTMLElement | null = null;

export function rollDefiant(): boolean {
  const defiant = Math.random() < DEFIANT_CHANCE;
  if (defiant) localStorage.setItem(DEFIANT_KEY, "true");
  else localStorage.removeItem(DEFIANT_KEY);
  return defiant;
}

export function isDefiant(): boolean {
  return localStorage.getItem(DEFIANT_KEY) === "true";
}

export function installDefiantTitle(): void {
  const title = document.getElementById("game-title");
  if (!(title instanceof HTMLHeadingElement)) return;

  document.title = "Don't Click on Me";
  title.textContent = LINES[0]!;

  const box = document.createElement("span");
  box.className = "title-box";
  title.replaceWith(box);
  box.appendChild(title);
  titleEl = title;
  boxEl = box;

  setClickable(true);
  title.setAttribute("aria-live", "polite");
  title.addEventListener("click", provoke);
  title.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    provoke();
  });
}

/**
 * A stickman was clicked. If something is currently boxed around the title, this
 * is what breaks it.
 *
 * A bomb swaps instantly, under cover of its own flash. Poison has no flash to
 * hide behind, so it cracks the box down the middle and drops the two halves off
 * the bottom of the screen instead.
 */
export function notifyCageBreaker(kind: Breaker): void {
  if (breaking) return;
  if (stage !== "caged" && stage !== "sealed") return;
  const from = stage;

  const piece = boxEl?.querySelector(pieceSelector(from));
  if (kind !== "poison" || !piece || reducedMotion()) {
    advance(from);
    breakOut(from, false);
    return;
  }

  // The crack shows before the box gives way, so the stage cannot advance yet:
  // moving it here would leave `stage` describing a DOM that is 260ms away, and
  // a click landing in that window would act on the box that is still on screen.
  breaking = true;
  piece.appendChild(buildCrack());
  window.setTimeout(() => {
    breaking = false;
    advance(from);
    breakOut(from, true);
  }, CRACK_MS);
}

function advance(from: Stage): void {
  stage = from === "caged" ? "why" : "freed";
}

function provoke(): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box || breaking) return;

  if (stage === "why") {
    // The wall of WHY collapses into an idea nobody asked for.
    stage = "sealed";
    box.classList.remove("why-wall");
    title.textContent = "WHAT IF I";
    setClickable(false);
    box.appendChild(buildFlag());
    box.classList.add("flagged");
    return;
  }

  if (stage !== "arguing") return;

  step += 1;
  title.textContent = LINES[Math.min(step, LINES.length - 1)]!;
  if (step < LINES.length - 1) {
    // A small flinch per click, so the escalation has some physicality.
    title.classList.remove("title-flinch");
    void title.offsetWidth; // restart the animation
    title.classList.add("title-flinch");
    return;
  }

  stage = "caged";
  cage(box, title);
}

/** The idea: cage the title, then let the page rattle. */
function cage(box: HTMLElement, title: HTMLHeadingElement): void {
  const bars = document.createElement("span");
  bars.className = "title-cage";
  bars.setAttribute("aria-hidden", "true");
  for (let bar = 0; bar < CAGE_BARS; bar += 1) {
    const rod = document.createElement("span");
    rod.className = "cage-bar";
    rod.style.left = `${((bar + 1) / (CAGE_BARS + 1)) * 100}%`;
    bars.appendChild(rod);
  }
  box.appendChild(bars);

  // The box lands and the shaking starts on the same frame.
  box.classList.add("caged");
  setClickable(false);

  const page = document.querySelector(".paper-page");
  if (!page) return;
  page.classList.add("shaking");
  window.setTimeout(() => page.classList.remove("shaking"), SHAKE_MS);
}

function breakOut(from: Stage, shatter: boolean): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box) return;

  const piece = box.querySelector(pieceSelector(from));
  if (piece) {
    if (shatter) launchShards(piece);
    piece.remove();
  }
  box.classList.remove(from === "caged" ? "caged" : "flagged");
  box.classList.add("busted");
  window.setTimeout(() => box.classList.remove("busted"), 520);

  if (from === "caged") {
    title.textContent = `WH${"Y".repeat(WHY_YS)}`;
    box.classList.add("why-wall");
    setClickable(true);
    // Spare screen readers four hundred consecutive y's.
    title.setAttribute("aria-label", "whyyy");
    return;
  }

  // Out of the flag, thought still unfinished. One more click completes it.
  title.textContent = "WHAT IF I";
  setClickable(true);
}

function pieceSelector(from: Stage): string {
  return from === "caged" ? ".title-cage" : ".title-flag";
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A jagged split straight down the middle, right before it gives way.
 *
 * The svg is wrapped in a span because it is a replaced element: stretching it
 * with top/bottom offsets does nothing, and a percentage height against the
 * box's own borders doesn't resolve. The span stretches, the svg fills the span.
 */
function buildCrack(): HTMLElement {
  const ns = "http://www.w3.org/2000/svg";
  const holder = document.createElement("span");
  holder.className = "cage-crack";
  holder.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 12 100");
  svg.setAttribute("preserveAspectRatio", "none");
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute("points", "6,0 3,13 9,27 2,41 8,55 3,69 9,83 5,100");
  line.setAttribute("fill", "none");
  svg.appendChild(line);
  holder.appendChild(svg);
  return holder;
}

/**
 * Clone the box into two half-width shards and drop them off the screen.
 *
 * They live on <body>, not in the note: the note clips its overflow, and its
 * drop-shadow filter would make position:fixed resolve against the note instead
 * of the viewport, so a shard parented there could never reach the bottom.
 */
function launchShards(piece: Element): void {
  const rect = piece.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const half = rect.width / 2;
  const fall = Math.max(40, window.innerHeight - rect.bottom);

  // Shards remove themselves when their animation finishes, but animation events
  // only fire while the page is actually rendering — a tab hidden mid-fall holds
  // its shards until it comes back. Sweep any leftovers so they can't stack up.
  for (const stale of document.querySelectorAll(".cage-shard")) stale.remove();

  for (const side of ["left", "right"] as const) {
    const shard = document.createElement("span");
    shard.className = "cage-shard";
    shard.style.left = `${rect.left + (side === "right" ? half : 0)}px`;
    shard.style.top = `${rect.top}px`;
    shard.style.width = `${half}px`;
    shard.style.height = `${rect.height}px`;

    // The full box, offset so each shard frames its own half of it.
    const face = piece.cloneNode(true) as HTMLElement;
    face.style.inset = "auto";
    face.style.left = `${side === "right" ? -half : 0}px`;
    face.style.top = "0";
    face.style.width = `${rect.width}px`;
    face.style.height = `${rect.height}px`;
    face.style.animation = "none"; // don't replay the slam on the way down
    shard.appendChild(face);
    document.body.appendChild(shard);

    const drift = side === "left" ? -34 : 34;
    const spin = side === "left" ? -17 : 17;
    const animation = shard.animate(
      [
        { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, easing: "cubic-bezier(0.45, 0, 0.9, 0.55)" },
        { transform: `translate(${drift * 0.5}px, ${fall}px) rotate(${spin}deg)`, opacity: 1, offset: 0.56, easing: "cubic-bezier(0.2, 0.85, 0.4, 1)" },
        { transform: `translate(${drift * 0.78}px, ${fall - 30}px) rotate(${spin * 1.3}deg)`, opacity: 1, offset: 0.71, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)" },
        { transform: `translate(${drift}px, ${fall}px) rotate(${spin * 1.5}deg)`, opacity: 1, offset: 0.83, easing: "linear" },
        { transform: `translate(${drift}px, ${fall}px) rotate(${spin * 1.5}deg)`, opacity: 0, offset: 1 },
      ],
      { duration: SHARD_MS, fill: "forwards" },
    );
    animation.onfinish = () => shard.remove();
  }
}

/** The Jolly Roger it reaches for once caging didn't work. */
function buildFlag(): HTMLElement {
  const flag = document.createElement("span");
  flag.className = "title-flag";
  flag.setAttribute("aria-hidden", "true");
  const skull = document.createElement("span");
  skull.className = "title-skull";
  skull.textContent = "☠";
  flag.appendChild(skull);
  return flag;
}

function setClickable(on: boolean): void {
  const title = titleEl;
  if (!title) return;
  title.classList.toggle("title-clickable", on);
  if (on) {
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
    title.removeAttribute("aria-label");
  } else {
    title.removeAttribute("role");
    title.removeAttribute("tabindex");
    title.setAttribute("aria-label", `${title.textContent} — sealed`);
  }
}
