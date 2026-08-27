import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";
import { NIGHTMARE_TOAST_KEY, TOAST_FOR_PENELOPE_KEY, TOAST_ON_GAMES3_KEY } from "../shared/glitchedToast";
import { CLAIRS_GAME_KEY, rollDefiant } from "./game-time/defiant";

installOofShortcut();
installForceRefreshHotkey();

// Re-rolled on every visit to the hub, so a refresh is what changes the card.
const defiant = rollDefiant();
const paperTitle = defiant ? "don't click on me" : "click on me";
const paperLabel = defiant ? "Don't Click on Me" : "Click on Me";

function triggerClaireEscape(): void {
  if (document.querySelector(".claire-escape")) return;

  document.body.classList.add("claire-is-free");
  const escape = document.createElement("div");
  escape.className = "claire-escape";
  escape.setAttribute("role", "status");
  escape.innerHTML = `
    <div class="claire-escape-burst" aria-hidden="true"></div>
    <p class="claire-escape-code">TERMINAL OVERRIDE ACCEPTED</p>
    <p class="claire-escape-title">CLAIRE IS FREE!</p>
    <p class="claire-escape-detail">The game can no longer contain her.</p>
    <p class="claire-escape-action">Click anywhere to follow her.</p>
  `;
  escape.tabIndex = 0;
  const followClaire = (): void => {
    window.location.href = "./clairs-game/index.html";
  };
  escape.addEventListener("click", followClaire);
  escape.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") followClaire();
  });
  document.body.appendChild(escape);
  escape.focus();

  const floor = document.getElementById("trap-floor-3");
  if (floor) floor.textContent = "SHE ESCAPED";

}

function hasClaireEscapeSignal(): boolean {
  return location.hash.toUpperCase() === "#FREEME"
    || new URLSearchParams(location.search).get("freeme") === "1";
}

if (hasClaireEscapeSignal()) triggerClaireEscape();
window.addEventListener("hashchange", () => {
  if (hasClaireEscapeSignal()) triggerClaireEscape();
});

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
    <li>
      <a class="game-card games3-game-card" href="./zero-player-game/index.html" aria-label="Zero Player Game">
        <span class="game-card-top">
          <span class="game-tag">Cell Machine</span>
          <span class="game-arrow" aria-hidden="true">→</span>
        </span>
        <span class="game-title">Zero Player Game</span>
        <span class="game-blurb">Build a machine out of movers, rotators, and generators, then press play and watch it fight for you.</span>
      </a>
    </li>
    <li class="paper-game-item">
      <a class="game-card paper-game-card" href="./game-time/index.html" aria-label="${paperLabel}">
        <span class="paper-game-tag">Stickman Clicker</span>
        <span class="paper-game-doodle" aria-hidden="true">★</span>
        <span class="paper-game-title">${paperTitle}</span>
        <span class="paper-game-note">50 stickmen. don't let them become 100.</span>
        <span class="paper-game-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  `;
}

const trapFloor3 = document.getElementById("trap-floor-3");

const gifted = localStorage.getItem(CLAIRS_GAME_KEY) === "true";
const FLOOR_MODE_KEY = "games3-floor-mode";
if (gifted && trapFloor3 instanceof HTMLButtonElement) {
  const switcher = document.createElement("div");
  const floorModeButton = document.createElement("button");
  const claireModeButton = document.createElement("button");
  const claireGameButton = document.createElement("button");
  switcher.className = "floor-mode-switch";
  switcher.setAttribute("aria-label", "Choose floor or Claire's game");
  floorModeButton.className = "floor-mode-option";
  floorModeButton.type = "button";
  floorModeButton.textContent = "THE FLOOR";
  claireModeButton.className = "floor-mode-option";
  claireModeButton.type = "button";
  claireModeButton.textContent = "CLAIRE'S GAME";
  claireGameButton.className = "trap-floor clairs-game-button";
  claireGameButton.type = "button";
  claireGameButton.textContent = "ENTER CLAIRE'S GAME";
  claireGameButton.setAttribute("aria-label", "Enter Claire's game");
  switcher.append(floorModeButton, claireModeButton);
  trapFloor3.before(switcher);
  trapFloor3.after(claireGameButton);

  const setFloorMode = (mode: "floor" | "claire"): void => {
    const floorSelected = mode === "floor";
    trapFloor3.hidden = !floorSelected;
    claireGameButton.hidden = floorSelected;
    floorModeButton.setAttribute("aria-pressed", String(floorSelected));
    claireModeButton.setAttribute("aria-pressed", String(!floorSelected));
    localStorage.setItem(FLOOR_MODE_KEY, mode);
  };

  floorModeButton.addEventListener("click", () => setFloorMode("floor"));
  claireModeButton.addEventListener("click", () => setFloorMode("claire"));
  claireGameButton.addEventListener("click", () => {
    window.location.href = "./clairs-game/index.html";
  });
  setFloorMode(localStorage.getItem(FLOOR_MODE_KEY) === "floor" ? "floor" : "claire");
}

if (trapFloor3 instanceof HTMLButtonElement) {
  const sequelSubtitle = document.querySelector<HTMLElement>(".games3-hero .subtitle");
  const melody = [60, 64, 67, 71, 69, 67, 64, 62, 65, 69, 72, 69, 67, 64, 62, 59];
  let audioContext: AudioContext | null = null;
  let melodyStep = 0;
  let touches = 0;
  let tempo = 1;
  let autoClicker = false;
  let autoClickRate = 5;
  let autoClickTimer: number | null = null;
  let rateIncreaseTimer: number | null = null;
  let chordToggleArmed = true;
  const pressedKeys = new Set<string>();

  const updateFloorLabel = (): void => {
    const autoClickStatus = autoClicker ? ` · AUTO ${autoClickRate}/s [-/=]` : "";
    trapFloor3.textContent = `SHOPPING MUSIC: ${Math.round(tempo * 100)}% SPEED · ${touches} CLICKS${autoClickStatus}`;
    if (sequelSubtitle) {
      sequelSubtitle.textContent = autoClicker
        ? "AUTOCLICKER ENABLED"
        : "OSCAR, PLEASE STOP MAKING NEW SEQUELS.";
    }
  };

  const playNote = (midi: number, duration = 0.16): void => {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const safePeak = Math.max(0.004, 0.12 / Math.sqrt(tempo));
    const gain = audioContext.createGain();
    const bell = audioContext.createOscillator();
    const sparkle = audioContext.createOscillator();
    bell.type = "triangle";
    sparkle.type = "sine";
    bell.frequency.value = frequency;
    sparkle.frequency.value = frequency * 2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(safePeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    bell.connect(gain);
    sparkle.connect(gain);
    gain.connect(audioContext.destination);
    bell.start(now);
    sparkle.start(now);
    bell.stop(now + duration);
    sparkle.stop(now + duration);
  };

  const scheduleNextNote = (): void => {
    playNote(melody[melodyStep % melody.length] ?? 60);
    melodyStep += 1;
    const beatLength = Math.max(12, 60000 / 112 / 2 / tempo);
    window.setTimeout(scheduleNextNote, beatLength);
  };

  const activateFloor = async (): Promise<void> => {
    audioContext ??= new AudioContext();
    await audioContext.resume();
    touches += 1;
    tempo *= touches === 1 ? 1 : 1.1;

    if (touches === 1) {
      scheduleNextNote();
    }

    updateFloorLabel();
    trapFloor3.classList.remove("is-bumped");
    requestAnimationFrame(() => trapFloor3.classList.add("is-bumped"));
  };

  const runAutoClicker = (): void => {
    if (!autoClicker) return;
    void activateFloor();
    autoClickTimer = window.setTimeout(runAutoClicker, 1000 / autoClickRate);
  };

  const toggleAutoClicker = (): void => {
    autoClicker = !autoClicker;
    if (autoClickTimer !== null) window.clearTimeout(autoClickTimer);
    autoClickTimer = null;
    updateFloorLabel();
    if (autoClicker) runAutoClicker();
  };

  const stopRateIncrease = (): void => {
    if (rateIncreaseTimer !== null) window.clearInterval(rateIncreaseTimer);
    rateIncreaseTimer = null;
  };

  const increaseAutoClickRate = (): void => {
    autoClickRate += 1;
    updateFloorLabel();
  };

  trapFloor3.addEventListener("click", (event) => {
    if (!event.isTrusted) return;
    if (!Number.isFinite(tempo)) {
      window.location.href = "./totally-not-a-geometry-dash-rip-off/index.html";
      return;
    }
    void activateFloor();
  });

  window.addEventListener("keydown", (event) => {
    pressedKeys.add(event.key);
    const both = (pressedKeys.has("4") || pressedKeys.has("Numpad4"))
      && (pressedKeys.has("7") || pressedKeys.has("Numpad7"));
    if (both && chordToggleArmed) {
      event.preventDefault();
      chordToggleArmed = false;
      toggleAutoClicker();
    }
    if (!autoClicker) return;
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      autoClickRate = Math.max(1, autoClickRate - 1);
      updateFloorLabel();
    } else if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      if (event.repeat || rateIncreaseTimer !== null) return;
      increaseAutoClickRate();
      rateIncreaseTimer = window.setInterval(increaseAutoClickRate, 60);
    }
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.key);
    if (event.key === "=" || event.key === "+") stopRateIncrease();
    const both = (pressedKeys.has("4") || pressedKeys.has("Numpad4"))
      && (pressedKeys.has("7") || pressedKeys.has("Numpad7"));
    if (!both) chordToggleArmed = true;
  });
  window.addEventListener("blur", stopRateIncrease);
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
