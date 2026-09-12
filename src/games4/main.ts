import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";
import { hasAllSwitchPieces, openSwitchAssembly, switchIsBuilt } from "./switchAssembly";

installOofShortcut();
installForceRefreshHotkey();

interface Game {
  id: string;
  name: string;
  path: string;
  menuLabel?: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  {
    id: "telephone",
    name: "Telephone",
    path: "./telephone/index.html",
    genre: "???",
    blurb: "The only game down here so far.",
  },
  {
    id: "zero-logic-escape-rooms",
    name: "Zero Logic Escape Rooms",
    path: "./zero-logic-escape-rooms/index.html",
    genre: "Escape Room",
    blurb: "No door. No window. No nothing. The way out makes absolutely no sense.",
  },
];

const GAMES_FOUND_KEY = "games4-games-found";

// The switch built from Zero Logic Escape Rooms' switch pieces sits on its
// card and flips it between Zero Logic and Hundred Logic Escape Rooms.
const HUNDRED_KEY = "zero-logic-escape-rooms-hundred";

function isHundred(): boolean {
  try {
    return localStorage.getItem(HUNDRED_KEY) === "true";
  } catch {
    return false;
  }
}

function flipEscapeSwitch(): void {
  try {
    localStorage.setItem(HUNDRED_KEY, String(!isHundred()));
  } catch {
    // Can't remember it, so the flip won't stick.
  }
  renderGameList();
}

// The games are hiding under the floor until you catch it.
function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (localStorage.getItem(GAMES_FOUND_KEY) !== "true") {
    list.innerHTML = '<li class="empty-state">No games yet. (Try catching the floor.)</li>';
    return;
  }

  list.innerHTML = games
    .map((game) => {
      const hasSwitch = game.id === "zero-logic-escape-rooms" && switchIsBuilt();
      const hundred = hasSwitch && isHundred();
      const name = hundred ? "Hundred Logic Escape Rooms" : game.name;
      // The switch sits outside the card's link, so flipping it doesn't open the game.
      const switchButton = hasSwitch
        ? `<button class="escape-switch${hundred ? " is-on" : ""}" type="button" aria-pressed="${hundred}" aria-label="Switch between Zero Logic and Hundred Logic Escape Rooms"><span class="escape-switch-lever" aria-hidden="true"></span></button>`
        : "";
      return `
      <li class="${hasSwitch ? "has-escape-switch" : ""}">
        ${switchButton}
        <a class="game-card games4-game-card" data-game-id="${game.id}" href="${game.path}" aria-label="${name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          <span class="game-title">${game.menuLabel ?? name}</span>
          <span class="game-blurb">${hundred ? "Every room has a way out, and every way out makes sense." : game.blurb}</span>
        </a>
      </li>
    `;
    })
    .join("");
  list.querySelector(".escape-switch")?.addEventListener("click", flipEscapeSwitch);
}

renderGameList();

// Back out of Zero Logic Escape Rooms with every switch piece: time to build the switch.
if (hasAllSwitchPieces() && !switchIsBuilt()) openSwitchAssembly(renderGameList);

// This hub's floor will not be stood on: it slides out from under the pointer
// until you finally corner it.
const trapFloor4 = document.getElementById("trap-floor-4");
if (trapFloor4 instanceof HTMLButtonElement) {
  let dodges = 0;
  let caught = false;
  let givenUp = false;

  trapFloor4.addEventListener("pointermove", (event) => {
    if (caught || givenUp) return;
    // One dodge in a hundred, it gets tired and holds still for you.
    if (Math.random() < 0.01) {
      givenUp = true;
      trapFloor4.textContent = "OK FINE, CATCH ME";
      return;
    }
    const bounds = trapFloor4.getBoundingClientRect();
    // Shove it away from whichever side the pointer came in on.
    const away = event.clientX < bounds.left + bounds.width / 2 ? 1 : -1;
    dodges += 1;
    trapFloor4.style.transform = `translate(${away * (20 + (dodges % 6) * 12)}px, ${dodges % 2 ? 10 : -10}px)`;
    trapFloor4.textContent = "NOPE!";
  });

  let runClicks = 0;

  trapFloor4.addEventListener("click", () => {
    if (caught) {
      countTowardsRun();
      return;
    }
    caught = true;
    trapFloor4.style.transform = "";
    trapFloor4.textContent = "HERE ARE YOUR GAMES";
    localStorage.setItem(GAMES_FOUND_KEY, "true");
    renderGameList();
  });

  // Keep hitting the caught floor and something comes down the wire.
  function countTowardsRun(): void {
    if (runClicks >= 5) return;
    runClicks += 1;

    let counter = document.getElementById("run-counter");
    if (!counter) {
      counter = document.createElement("p");
      counter.id = "run-counter";
      counter.className = "run-counter";
      trapFloor4?.after(counter);
    }
    counter.textContent = `${runClicks} / 5`;

    if (runClicks < 5) return;
    counter.remove();
    dropRunTv();
  }
}

function dropRunTv(): void {
  if (document.querySelector(".run-tv")) return;
  const tv = document.createElement("div");
  tv.className = "run-tv";
  tv.setAttribute("role", "img");
  tv.innerHTML = `
    <div class="run-tv-wire" aria-hidden="true"></div>
    <div class="run-tv-body">
      <div class="run-tv-screen"><span></span></div>
    </div>
  `;
  showTvText(tv, tvText);
  document.body.appendChild(tv);
}

// What the TV says. Type "tvrename" anywhere on this page, or call
// TVRename("...") in the browser console, to change it. It stays changed.
const TV_TEXT_KEY = "games4-tv-text";
const TV_CODE = "tvrename";
let tvText = readTvText();

function readTvText(): string {
  try {
    return localStorage.getItem(TV_TEXT_KEY) || "RUN";
  } catch {
    return "RUN";
  }
}

// Smaller letters the longer it is, so it fits on the screen.
function showTvText(tv: Element, text: string): void {
  const screen = tv.querySelector<HTMLElement>(".run-tv-screen span");
  if (!screen) return;
  screen.textContent = text;
  screen.style.fontSize = text.length > 30 ? "1.1rem" : text.length > 14 ? "1.4rem" : text.length > 5 ? "2.2rem" : "";
  tv.setAttribute("aria-label", `A television on a wire showing ${text}`);
}

function setTvText(text: string): void {
  tvText = text.trim().slice(0, 60) || "RUN";
  try {
    localStorage.setItem(TV_TEXT_KEY, tvText);
  } catch {
    // It'll only say it until the page reloads.
  }
  const tv = document.querySelector(".run-tv");
  if (tv) showTvText(tv, tvText);
}

let typedCode = "";
window.addEventListener("keydown", (event) => {
  if (event.key.length !== 1 || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }
  typedCode = (typedCode + event.key.toLowerCase()).slice(-TV_CODE.length);
  if (typedCode !== TV_CODE) return;
  typedCode = "";
  const text = window.prompt("What should the TV say?", tvText);
  if (text !== null) setTvText(text);
});

Object.assign(window, { TVRename: setTvText });
