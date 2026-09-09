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

  trapFloor4.addEventListener("click", () => {
    caught = true;
    trapFloor4.style.transform = "";
    trapFloor4.textContent = "HERE ARE YOUR GAMES";
    localStorage.setItem(GAMES_FOUND_KEY, "true");
    renderGameList();
  });
}
