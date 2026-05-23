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
  {
    id: "drawing-boss-mania",
    name: "Drawing Boss Mania",
    path: "./drawing-boss-mania/",
    genre: "Boss Doodle",
    blurb: "Sketch your way through bosses that won't sit still.",
  },
  {
    id: "stickman-fight",
    name: "Stickman Fight",
    path: "./stickman-fight/",
    genre: "Ragdoll Brawl",
    blurb: "Swing weapons, flop around, and earn coins to upgrade your arsenal.",
  },
  {
    id: "the-settings-game",
    name: "The Settings Game",
    path: "../games/the-settings-game/",
    genre: "Platformer / Meta",
    blurb: "Tinker the settings menu to bend the level into something you can finish.",
  },
  {
    id: "feed-your-fire",
    name: "Feed Your Fire",
    path: "./feed-your-fire/",
    genre: "Pet Pyro",
    blurb: "Pour rainbow gasoline into a clingy little fire and watch it grow up.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. The sequel needs content.</li>';
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

const trapFloor2 = document.getElementById("trap-floor-2");
if (trapFloor2 instanceof HTMLButtonElement) {
  trapFloor2.addEventListener("click", () => {
    window.location.replace("https://www.youtube.com/watch?v=XqZsoesa55w");
  });
}
