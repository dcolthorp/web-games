import { installOofShortcut } from "../shared/oofShortcut";

installOofShortcut();

interface Game {
  id: string;
  name: string;
  path: string;
  menuLabel?: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  // c0rrupt3d games go here
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">N0 g4m3s y3t. Th3 c0rrupt10n 1s st1ll spr34d1ng.</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li>
        <a class="game-card" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
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

const trapFloor = document.getElementById("trap-floor-corrupt");
if (trapFloor instanceof HTMLButtonElement) {
  trapFloor.addEventListener("click", () => {
    window.location.replace("https://www.youtube.com/watch?v=XqZsoesa55w");
  });
}
