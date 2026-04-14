export {};

interface Game {
  id: string;
  name: string;
  path: string;
  menuLabel?: string;
  genre: string;
  blurb: string;
}

const LINKED_ROTATION_CURSE_KEY = "linked-rotation-curse";
const HUB_TROPHY_KEY = "a-hard-easy-game-hub-trophy";

const games: Game[] = [
  // Add games here as you create them
  // { id: "snake", name: "Snake", path: "./games/snake/" },
  {
    id: "a-hard-easy-game",
    name: "A Hard Easy Game",
    menuLabel: 'A <span class="crossed-out-word">Hard</span> Easy Game',
    path: "./games/a-hard-easy-game/",
    genre: "Trap Course",
    blurb: "A dramatic obstacle run where most of the danger is just showing off.",
  },
  {
    id: "oscars-untitled-maze-game",
    name: "Oscar's Untitled Maze Game",
    path: "./games/oscars-untitled-maze-game/",
    genre: "Maze Trollery",
    blurb: "Sneaky rules, twisted levels, and a maze that keeps changing the deal.",
  },
  {
    id: "tamagotchi-monster",
    name: "Tamagotchi Monster",
    path: "./games/tamagotchi-monster/",
    genre: "Pet Chaos",
    blurb: "Raise a weird little creature and keep its glitchy little life on track.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Time to build some!</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li>
        <a class="game-card hub-asset" data-asset-id="card-${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top hub-asset" data-asset-id="card-top-${game.id}">
            <span class="game-tag hub-asset" data-asset-id="card-tag-${game.id}">${game.genre}</span>
            <span class="game-arrow hub-asset" data-asset-id="card-arrow-${game.id}" aria-hidden="true">→</span>
          </span>
          <span class="game-title hub-asset" data-asset-id="card-title-${game.id}">${game.menuLabel ?? game.name}</span>
          <span class="game-blurb hub-asset" data-asset-id="card-blurb-${game.id}">${game.blurb}</span>
        </a>
      </li>
    `
    )
    .join("");

  applyRotationCurseStyling(list);
}

renderGameList();
renderHubTrophy();

const trapFloorElement = document.getElementById("trap-floor");
if (trapFloorElement instanceof HTMLButtonElement) {
  trapFloorElement.addEventListener("click", () => {
    window.location.replace("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
}

function applyRotationCurseStyling(root: HTMLElement): void {
  const cursed = localStorage.getItem(LINKED_ROTATION_CURSE_KEY) === "rotated";
  const ahegCard = root.querySelector<HTMLAnchorElement>('a[href="./games/a-hard-easy-game/"]');
  if (!ahegCard) {
    return;
  }

  ahegCard.classList.toggle("game-card-cursed", cursed);
  const blurb = ahegCard.querySelector(".game-blurb");
  if (blurb) {
    blurb.textContent = cursed
      ? "AHHH WHATS HAPENING"
      : "A dramatic obstacle run where most of the danger is just showing off.";
  }
}

function renderHubTrophy(): void {
  const shell = document.querySelector<HTMLElement>(".menu-shell");
  const ahegCard = document.querySelector<HTMLElement>('a[href="./games/a-hard-easy-game/"]');
  if (!shell || !ahegCard) {
    return;
  }

  const existing = document.getElementById("hub-trophy");
  if (localStorage.getItem(HUB_TROPHY_KEY) !== "true") {
    existing?.remove();
    return;
  }

  const trophy = existing ?? document.createElement("div");
  trophy.id = "hub-trophy";
  trophy.className = "hub-trophy";
  trophy.setAttribute("aria-hidden", "true");
  if (!existing) {
    shell.appendChild(trophy);
  }

  const shellRect = shell.getBoundingClientRect();
  const cardRect = ahegCard.getBoundingClientRect();
  trophy.style.left = `${cardRect.right - shellRect.left - 54}px`;
  trophy.style.top = `${cardRect.top - shellRect.top - 18}px`;
}
