// The paper card usually reads "click on me". One refresh of the Games 3 hub in
// four, it reads "don't click on me" instead — and the game page plays along.
// The hub rolls the dice and stores the result; the game page reads it. The flag
// survives a reload of the game page, so only a trip back to the hub re-rolls.

export const DEFIANT_KEY = "game-time-defiant";
export const DEFIANT_CHANCE = 0.25;

/** Shown in order, one per click. The last line is where it stops arguing. */
const LINES = [
  "DON'T CLICK ON ME",
  "NO SERIOUSLY, DON'T CLICK ON ME",
  "I AM ASKING YOU NICELY. DON'T.",
  "WHY ARE YOU STILL DOING THIS",
  "LAST WARNING. DON'T CLICK ON ME.",
  "HMM. I HAVE AN IDEA.",
];

const SHAKE_MS = 2100;
const CAGE_BARS = 5;

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

  // The heading becomes a real control, so it needs to answer to the keyboard
  // the way the stickmen buttons do.
  const box = document.createElement("span");
  box.className = "title-box";
  title.replaceWith(box);
  box.appendChild(title);
  title.classList.add("title-clickable");
  title.setAttribute("role", "button");
  title.setAttribute("tabindex", "0");
  title.setAttribute("aria-live", "polite");

  let step = 0;
  let finished = false;

  const provoke = (): void => {
    if (finished) return;
    step += 1;
    title.textContent = LINES[Math.min(step, LINES.length - 1)]!;
    if (step < LINES.length - 1) {
      // A small flinch per click, so the escalation has some physicality.
      title.classList.remove("title-flinch");
      void title.offsetWidth; // restart the animation
      title.classList.add("title-flinch");
      return;
    }
    finished = true;
    followThrough(box, title);
  };

  title.addEventListener("click", provoke);
  title.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    provoke();
  });
}

/** The idea: cage the title, then let the page rattle. */
function followThrough(box: HTMLElement, title: HTMLHeadingElement): void {
  const cage = document.createElement("span");
  cage.className = "title-cage";
  cage.setAttribute("aria-hidden", "true");
  for (let bar = 0; bar < CAGE_BARS; bar += 1) {
    const rod = document.createElement("span");
    rod.style.left = `${((bar + 1) / (CAGE_BARS + 1)) * 100}%`;
    cage.appendChild(rod);
  }
  box.appendChild(cage);

  // The box lands and the shaking starts on the same frame.
  box.classList.add("caged");
  title.removeAttribute("tabindex");
  title.removeAttribute("role");
  title.setAttribute("aria-label", `${title.textContent} — sealed`);

  const page = document.querySelector(".paper-page");
  if (!page) return;
  page.classList.add("shaking");
  window.setTimeout(() => page.classList.remove("shaking"), SHAKE_MS);
}
