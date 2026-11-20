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
    id: "game-factory",
    name: "Game Factory",
    path: "./game-factory/index.html",
    genre: "Make Your Own",
    blurb: "Paint sprites, give them rules, and make any game you want.",
  },
  {
    id: "make-your-own-maze",
    name: "Make Your Own Maze",
    path: "./make-your-own-maze/index.html",
    genre: "Merge",
    blurb: "Balls bounce through your maze and every block they hit pays you. Merge blocks to level them up.",
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

// This hub is all about *SILENCE*, so its floor is asleep. Poke it and it gets
// grumpier until it wakes up, then it yawns and dozes right back off.
const SLEEPY_FLOOR_TEXT = "SHHH... THE FLOOR IS SLEEPING";
const SLEEPY_FLOOR_GRUMBLES = ["zzz... five more minutes", "zzz... GO AWAY", "WHAT?! I'M UP! I'M UP!"];

const trapFloor6 = document.getElementById("trap-floor-6");
if (trapFloor6 instanceof HTMLButtonElement) {
  let pokes = 0;
  let napTimer = 0;

  trapFloor6.addEventListener("click", () => {
    pokes += 1;
    const awake = pokes >= SLEEPY_FLOOR_GRUMBLES.length;
    trapFloor6.textContent = awake && pokes > SLEEPY_FLOOR_GRUMBLES.length
      ? "I'M AWAKE. STOP POKING ME."
      : SLEEPY_FLOOR_GRUMBLES[pokes - 1] ?? "";
    trapFloor6.classList.toggle("is-awake", awake);

    // Restart the jolt so every poke shows.
    trapFloor6.classList.remove("is-poked");
    void trapFloor6.offsetWidth;
    trapFloor6.classList.add("is-poked");

    // Leave it alone for a bit and it yawns and goes back to sleep.
    window.clearTimeout(napTimer);
    napTimer = window.setTimeout(() => {
      trapFloor6.textContent = "*yawn*...";
      napTimer = window.setTimeout(() => {
        pokes = 0;
        trapFloor6.classList.remove("is-awake");
        trapFloor6.textContent = SLEEPY_FLOOR_TEXT;
      }, 1500);
    }, 3500);
  });
}
