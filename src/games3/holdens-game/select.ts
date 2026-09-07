import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { clearedWorlds, worlds } from "./worlds";
import { coins } from "./shop";
import { introSeen, playIntro } from "./intro";

installOofShortcut();
installForceRefreshHotkey();

const list = document.querySelector<HTMLOListElement>("#worlds");
const note = document.querySelector<HTMLParagraphElement>("#note");

function render(): void {
  if (!list) return;
  const cleared = clearedWorlds();
  list.replaceChildren();

  worlds.forEach((world, index) => {
    const done = index < cleared;
    // One world past whatever you have finished is as far as the run opens up.
    const unlocked = index <= cleared;
    const built = world.page !== null;

    const item = document.createElement("li");
    const entry = document.createElement(unlocked && built ? "a" : "div");
    entry.className = "world";
    entry.classList.toggle("is-open", unlocked && built);
    entry.classList.toggle("is-locked", !unlocked || !built);
    entry.classList.toggle("is-done", done);

    if (entry instanceof HTMLAnchorElement && world.page) entry.href = world.page;

    const number = document.createElement("span");
    number.className = "world-number";
    number.textContent = String(index + 1).padStart(2, "0");

    const name = document.createElement("span");
    name.className = "world-name";
    name.textContent = world.name;

    const state = document.createElement("span");
    state.className = "world-state";
    state.textContent = done ? "cleared" : !unlocked ? "locked" : built ? "open" : "not built";

    entry.append(number, name, state);
    item.append(entry);
    list.append(item);
  });

  if (note) {
    note.textContent = cleared === 0
      ? "Only Death Farms is built so far. Clear it to open the next."
      : `${cleared} of ${worlds.length} cleared.`;
  }
}

const purse = document.querySelector<HTMLElement>("#purse-count");
if (purse) purse.textContent = String(coins());

render();

const shell = document.querySelector<HTMLElement>(".select");
const reveal = (): void => { if (shell) shell.style.visibility = "visible"; };

// First time through, the opening plays before the list appears.
if (introSeen()) {
  reveal();
} else {
  if (shell) shell.style.visibility = "hidden";
  playIntro(reveal);
}

document.querySelector<HTMLButtonElement>("#replay-intro")?.addEventListener("click", () => {
  if (shell) shell.style.visibility = "hidden";
  playIntro(reveal);
});

