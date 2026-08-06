import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";
import { NIGHTMARE_TOAST_KEY, TOAST_FOR_PENELOPE_KEY, TOAST_ON_GAMES3_KEY } from "../shared/glitchedToast";

installOofShortcut();
installForceRefreshHotkey();

const list = document.getElementById("game-list");
if (list) {
  list.innerHTML = `
    <li>
      <a class="game-card games3-game-card" href="./sharks-in-the-water/index.html" aria-label="Sharks in the Water">
        <span class="game-card-top">
          <span class="game-tag">Raft Survival</span>
          <span class="game-arrow" aria-hidden="true">→</span>
        </span>
        <span class="game-title">Sharks in the Water</span>
        <span class="game-blurb">Leave your raft for supply drops, gather rare materials, and watch the water for fins.</span>
      </a>
    </li>
  `;
}

const penelopePortal = document.querySelector<HTMLAnchorElement>(".owner-switch-penelope");
if (localStorage.getItem(TOAST_ON_GAMES3_KEY) === "true" && penelopePortal) {
  const toast = document.createElement("div");
  const instruction = document.createElement("div");
  toast.className = `escaped-toast${localStorage.getItem(NIGHTMARE_TOAST_KEY) === "true" ? " nightmare-toast" : ""}`;
  toast.draggable = true;
  toast.setAttribute("role", "button");
  toast.setAttribute("aria-label", "Escaped toast. Drag it into the Penelope arrow.");
  toast.style.left = `${12 + Math.random() * 70}vw`;
  toast.style.top = `${42 + Math.random() * 42}vh`;
  instruction.className = "toast-quest-instruction";
  instruction.textContent = "The toast escaped! Drag it into the Penelope arrow.";
  document.body.append(toast, instruction);
  penelopePortal.classList.add("toast-portal");
  penelopePortal.setAttribute("aria-label", "Drag the toast here to take it to Penelope's Games");

  toast.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", "escaped-glitched-toast");
    event.dataTransfer.effectAllowed = "move";
  });
  penelopePortal.addEventListener("dragover", (event) => {
    event.preventDefault();
    penelopePortal.classList.add("toast-portal-ready");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  penelopePortal.addEventListener("dragleave", () => penelopePortal.classList.remove("toast-portal-ready"));
  penelopePortal.addEventListener("drop", (event) => {
    if (event.dataTransfer?.getData("text/plain") !== "escaped-glitched-toast") return;
    event.preventDefault();
    localStorage.removeItem(TOAST_ON_GAMES3_KEY);
    localStorage.setItem(TOAST_FOR_PENELOPE_KEY, "true");
    window.location.href = penelopePortal.href;
  });
}
