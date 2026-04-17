import { GameApp } from "./app/GameApp";
import {
  AHEG_TROPHY_LOCATION_KEY,
  TM_DELETED_FROM_HUB_KEY,
  renderImportedAhegTrophy,
} from "../../shared/ahegTrophy";
import { initEscapedAhegPlayer } from "../../shared/escapedAhegPlayer";

const TM_TROPHY_DOOM_STARTED_KEY = "tamagotchi-monster-trophy-doom-started";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Missing canvas element");
}

const app = new GameApp(canvas);
app.start();
initEscapedAhegPlayer({ interactionCanvas: canvas });
renderImportedAhegTrophy("tamagotchi-monster", {
  onBeforeImpact: startTrophySlowMotion,
  onDrop: startTrophyCrackSequence,
});

function startTrophySlowMotion(): void {
  if (localStorage.getItem(TM_TROPHY_DOOM_STARTED_KEY) === "true") {
    return;
  }

  document.body.classList.add("tm-impact-warning");
}

function startTrophyCrackSequence(): void {
  if (
    localStorage.getItem(TM_DELETED_FROM_HUB_KEY) === "true" ||
    localStorage.getItem(TM_TROPHY_DOOM_STARTED_KEY) === "true"
  ) {
    return;
  }

  localStorage.setItem(TM_TROPHY_DOOM_STARTED_KEY, "true");
  document.body.classList.add("tm-impact-paused");

  window.setTimeout(() => {
    createCrackOverlay();
    document.body.classList.add("tm-cracking");
  }, 1000);

  window.setTimeout(() => {
    document.body.classList.add("tm-crack-breaks");
  }, 1900);

  window.setTimeout(() => {
    document.body.classList.add("tm-blackout");
  }, 3000);

  window.setTimeout(() => {
    localStorage.setItem(TM_DELETED_FROM_HUB_KEY, "true");
    localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
    window.location.href = new URL("../../", window.location.href).toString();
  }, 4200);
}

function createCrackOverlay(): void {
  if (document.getElementById("tm-crack-overlay")) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "tm-crack-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="tm-crack-core"></div>
    <div class="tm-crack-shard shard-1"></div>
    <div class="tm-crack-shard shard-2"></div>
    <div class="tm-crack-shard shard-3"></div>
    <div class="tm-crack-shard shard-4"></div>
    <div class="tm-crack-shard shard-5"></div>
  `;
  document.body.appendChild(overlay);
}
