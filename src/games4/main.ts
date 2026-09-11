import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";

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

// The games are hiding under the floor until you catch it.
function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (localStorage.getItem(GAMES_FOUND_KEY) !== "true") {
    list.innerHTML = '<li class="empty-state">No games yet. (Try catching the floor.)</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li>
        <a class="game-card games4-game-card" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          <span class="game-title">${game.menuLabel ?? game.name}</span>
          <span class="game-blurb">${game.blurb}</span>
        </a>
      </li>
    `
    )
    .join("");
}

renderGameList();

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
  tv.setAttribute("aria-label", "A television on a wire showing the word RUN");
  tv.innerHTML = `
    <div class="run-tv-wire" aria-hidden="true"></div>
    <div class="run-tv-body">
      <div class="run-tv-screen"><span>RUN</span></div>
    </div>
  `;
  document.body.appendChild(tv);
}
