import { GameApp } from "./app/GameApp";
import {
  AHEG_TROPHY_LOCATION_KEY,
  AKL_DELETED_FROM_HUB_KEY,
  renderImportedAhegTrophy,
} from "../../shared/ahegTrophy";
import { initEscapedAhegPlayer } from "../../shared/escapedAhegPlayer";

const AKL_TROPHY_DOOM_STARTED_KEY = "a-kids-life-trophy-doom-started";

const canvas = document.getElementById("game");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing game canvas");
}

const app = new GameApp(canvas);
app.start();
initEscapedAhegPlayer({ interactionCanvas: canvas });
renderImportedAhegTrophy("a-kids-life", {
  onDrop: () => {
    const everyoneIsMissing = app.markRandomPersonMissingFromRandomFamily();
    if (everyoneIsMissing) {
      startAklDoomSequence();
    }
  },
});

function startAklDoomSequence(): void {
  if (
    localStorage.getItem(AKL_DELETED_FROM_HUB_KEY) === "true" ||
    localStorage.getItem(AKL_TROPHY_DOOM_STARTED_KEY) === "true"
  ) {
    return;
  }

  localStorage.setItem(AKL_TROPHY_DOOM_STARTED_KEY, "true");
  document.body.classList.add("akl-doom-active");
  dropAklAssetsOneByOne();

  window.setTimeout(() => {
    localStorage.setItem(AKL_DELETED_FROM_HUB_KEY, "true");
    localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
    window.location.href = new URL("../../", window.location.href).toString();
  }, 2200);
}

function dropAklAssetsOneByOne(): void {
  const fallingAssets = [
    ...document.querySelectorAll<HTMLElement>(
      [".game-chrome", "#game", "#imported-aheg-trophy"].join(", ")
    ),
  ];

  fallingAssets.forEach((asset, index) => {
    asset.classList.add("akl-falling-asset");
    asset.style.setProperty("--akl-fall-delay", `${index * 180}ms`);
    asset.style.setProperty("--akl-fall-x", `${index % 2 === 0 ? -40 : 34}px`);
    asset.style.setProperty("--akl-fall-rotate", `${index % 2 === 0 ? -9 : 11}deg`);
  });
}
