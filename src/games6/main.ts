import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

interface Game {
  id: string;
  name: string;
  path: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  {
    id: "fact-quest",
    name: "Fact Quest",
    path: "./fact-quest/index.html",
    genre: "Math Facts",
    blurb: "Rebuilt from Dad's, with a remainder box for division.",
  },
  {
    // The original that Dad made. It lives on its own site, so its saved
    // progress stays put.
    id: "dads-fact-quest",
    name: "Dad's Fact Quest",
    path: "https://oscar-fact-quest.fizzycat4.chatgpt.site",
    genre: "The Original",
    blurb: "Times tables and division, facts 1 to 12. Made by Dad.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Oscar, you know what to do.</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li>
        <a class="game-card games6-game-card" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          <span class="game-title">${game.name}</span>
          <span class="game-blurb">${game.blurb}</span>
        </a>
      </li>
    `
    )
    .join("");
}

renderGameList();
