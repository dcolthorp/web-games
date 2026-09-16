import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// The lost games: the ones that are in here but that no hub links to, so the
// only way to them was to know the address. Now there's a door instead
// (shared/lostDoor.ts).

interface LostGame {
  name: string;
  path: string;
  why: string;
}

const LOST: LostGame[] = [
  {
    name: "Holden's Game",
    path: "../games3/holdens-game/index.html",
    why: "Holden's own game, with a shop and eleven worlds. Nothing anywhere links to it.",
  },
  {
    name: "c0rrupt3d games",
    path: "../corrupted-games/index.html",
    why: "A whole hub. Its place in the dropdown is greyed out as Delayed, so you can't click through to it.",
  },
  {
    name: "Bio Tech",
    path: "../corrupted-games/bio-tech/index.html",
    why: "The game inside the c0rrupt3d hub, which is why nobody has been able to reach it either.",
  },
  {
    name: "Penelope's Old Page",
    path: "../games/penelope/index.html",
    why: "The first Penelope page. The newer one still borrows its code, but nothing links to the page itself.",
  },
];

// The ones brought back from Oscar's old Python project (kids-games), which
// nothing on the web ever linked to because it wasn't on the web at all.
interface RescuedGame {
  name: string;
  path: string;
  why: string;
  // The Python file it was brought back from.
  file: string;
}

const RESCUED: RescuedGame[] = [
  {
    name: "Snake",
    path: "./snake/index.html",
    why: "Oscar's first ever game. Rainbow stripes, stars that fade away, and a snake that poops.",
    file: "snake.py",
  },
  {
    name: "Wall Dodger Survival",
    path: "./wall-dodger/index.html",
    why: "Four walls closing in on you and a ball bouncing around inside. Coins buy you room.",
    file: "obstacles.py",
  },
  {
    name: "Ground Jumper",
    path: "./ground-jumper/index.html",
    why: "Three lanes to hop between, a dressing room to spend your coins in, and levels that got lost.",
    file: "ground_jumper/",
  },
  {
    name: "Police Chase",
    path: "./police-chase/index.html",
    why: "Stickmen running across rooftops at night, grabbing loot, dodging cops.",
    file: "police_chase/",
  },
  {
    name: "Software Hack",
    path: "./software-hack/index.html",
    why: "Hack the AI with little puzzles, and patch your own antivirus before it hacks you back.",
    file: "software_hack/",
  },
];

const rescuedList = document.getElementById("rescued-list");
if (rescuedList) {
  rescuedList.innerHTML = RESCUED.map(
    (game) => `
    <li>
      <a class="lost-card rescued" href="${game.path}">
        <span class="lost-name">${game.name}</span>
        <p class="lost-why">${game.why}</p>
        <p class="lost-where">brought back from kids-games/${game.file}</p>
      </a>
    </li>
  `
  ).join("");
}

const list = document.getElementById("lost-list");
if (list) {
  list.innerHTML = LOST.map(
    (game) => `
    <li>
      <a class="lost-card" href="${game.path}">
        <span class="lost-name">${game.name}</span>
        <p class="lost-why">${game.why}</p>
        <p class="lost-where">${game.path.replace("../", "src/")}</p>
      </a>
    </li>
  `
  ).join("");
}
