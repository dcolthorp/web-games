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
    name: "Cat Math",
    path: "../games/cat-math/index.html",
    why: "Sums with a cat. It never made it onto Oscar's Games.",
  },
  {
    name: "Holden's Game",
    path: "../games3/holdens-game/index.html",
    why: "Holden's own game, with a shop and eleven worlds. Games 3 never listed it.",
  },
  {
    name: "Totally Not a Geometry Dash Rip-Off",
    path: "../games3/totally-not-a-geometry-dash-rip-off/index.html",
    why: "Definitely not a rip-off. Also never listed.",
  },
  {
    name: "Bio Tech",
    path: "../corrupted-games/bio-tech/index.html",
    why: "From the c0rrupt3d games hub, which is still marked delayed, so nobody can click through to it.",
  },
  {
    name: "Penelope's Old Page",
    path: "../games/penelope/index.html",
    why: "The first Penelope page, left behind when the newer one took over.",
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
