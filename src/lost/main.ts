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
