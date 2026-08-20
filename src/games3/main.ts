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
      <a class="game-card paper-game-card" href="./game-time/index.html" aria-label="Click on Me">
        <span class="paper-game-tag">Stickman Clicker</span>
        <span class="paper-game-doodle" aria-hidden="true">★</span>
        <span class="paper-game-title">click on me</span>
        <span class="paper-game-note">50 stickmen. don't let them become 100.</span>
        <span class="paper-game-arrow" aria-hidden="true">→</span>
      </a>
    </li>
  `;
}

const trapFloor3 = document.getElementById("trap-floor-3");
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

  trapFloor3.addEventListener("click", () => void activateFloor());

  window.addEventListener("keydown", (event) => {
    pressedKeys.add(event.key);
    const both = (pressedKeys.has("4") || pressedKeys.has("Numpad4"))
      && (pressedKeys.has("7") || pressedKeys.has("Numpad7"));
    if (both && chordToggleArmed) {
      event.preventDefault();
      chordToggleArmed = false;
      toggleAutoClicker();
    }
    if (!autoClicker || event.repeat) return;
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      autoClickRate = Math.max(1, autoClickRate - 1);
      updateFloorLabel();
    } else if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      autoClickRate = Math.min(40, autoClickRate + 1);
      updateFloorLabel();
    }
  });

  window.addEventListener("keyup", (event) => {
    pressedKeys.delete(event.key);
    const both = (pressedKeys.has("4") || pressedKeys.has("Numpad4"))
      && (pressedKeys.has("7") || pressedKeys.has("Numpad7"));
    if (!both) chordToggleArmed = true;
  });
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
