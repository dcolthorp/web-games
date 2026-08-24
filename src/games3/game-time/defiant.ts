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

let stage: Stage = "arguing";
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
 * is what breaks it. `delayMs` lets the bomb finish going off first.
 */
export function notifyCageBreaker(_kind: Breaker, delayMs = 0): void {
  if (stage !== "caged" && stage !== "sealed") return;
  const breaking = stage;
  // Latch immediately so a second stickman during the blindness can't re-trigger.
  stage = breaking === "caged" ? "why" : "freed";
  if (delayMs > 0) window.setTimeout(() => breakOut(breaking), delayMs);
  else breakOut(breaking);
}

function provoke(): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box) return;

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

function breakOut(from: Stage): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box) return;

  box.querySelector(from === "caged" ? ".title-cage" : ".title-flag")?.remove();
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

  // Out of the flag. What it does next is not written yet.
  title.textContent = "";
  setClickable(true);
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
