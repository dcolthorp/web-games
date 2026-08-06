import { AKL_DELETED_FROM_HUB_KEY } from "../../shared/ahegTrophy";
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { NIGHTMARE_TOAST_KEY, PENELOPE_CAT_SKIN_KEY, PENELOPE_DOG_BREED_KEY, PENELOPE_NIGHTMARE_PET_KEY, PENELOPE_PET_FORM_KEY, TOAST_FOR_PENELOPE_KEY } from "../../shared/glitchedToast";

installOofShortcut();
const NIGHTMARE_REFRESH_SCARE_KEY = "penelope-nightmare-refresh-scare";
const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
const shouldShowRefreshJumpscare =
  sessionStorage.getItem(NIGHTMARE_REFRESH_SCARE_KEY) === "true" && navigationEntry?.type === "reload";
sessionStorage.removeItem(NIGHTMARE_REFRESH_SCARE_KEY);
installForceRefreshHotkey({ beforeReload: prepareNightmareRefresh });

interface Game {
  id: string;
  name: string;
  menuLabel?: string;
  path: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  {
    id: "a-kids-life",
    name: "A Kid's Life",
    path: document.body.dataset["aklPath"] ?? "../a-kids-life/index.html",
    genre: "Life Sim",
    blurb: "Raise a sweet kid, grow a whole family tree, and keep each home cozy.",
  },
  {
    id: "cat-math",
    name: "Cat Math",
    path: document.body.dataset["catMathPath"] ?? "../cat-math/index.html",
    genre: "Math Pet Shop",
    blurb: "Solve cozy math facts, earn coins, and dress up Penelope's cat.",
  },
  {
    id: "sharks-in-the-water",
    name: "Sharks in the Water",
    menuLabel: "Sharks in the Water",
    path: document.body.dataset["sharksPath"] ?? "../../games3/sharks-in-the-water/index.html",
    genre: "Raft Survival",
    blurb: "Leave your raft for supply drops, gather rare materials, and watch the water for fins.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Time to build something cute!</li>';
    return;
  }

  list.innerHTML = games
    .map((game) =>
      isGameDeletedFromHub(game.id)
        ? `
      <li>
        <div class="game-hole penelope-game-hole" aria-label="A missing game slot"></div>
      </li>
    `
        : `
      <li>
        <a class="game-card penelope-game-card" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          <span class="game-title">${game.menuLabel ?? game.name}</span>
          <span class="game-blurb">${game.blurb}</span>
        </a>
      </li>
    `
    )
    .join("");
}

function isGameDeletedFromHub(gameId: string): boolean {
  if (gameId === "a-kids-life") {
    return localStorage.getItem(AKL_DELETED_FROM_HUB_KEY) === "true";
  }

  return false;
}

renderGameList();

const kittyStage = document.querySelector<HTMLElement>(".kitty-stage");
const kitty = document.querySelector<HTMLElement>(".kitty");
localStorage.removeItem(PENELOPE_NIGHTMARE_PET_KEY);
let nightmarePetActive = false;
const dogBreeds = ["normal", "golden", "spotted", "purple", "poodle"] as const;
const catSkins = ["black", "gray", "orange", "snow", "tuxedo", "lavender"] as const;
window.addEventListener("beforeunload", prepareNightmareRefresh);
if (shouldShowRefreshJumpscare) window.requestAnimationFrame(showRefreshJumpscare);
const savedCatSkin = localStorage.getItem(PENELOPE_CAT_SKIN_KEY) ?? "black";
setCatSkin(catSkins.includes(savedCatSkin as (typeof catSkins)[number]) ? savedCatSkin : "black");
const savedDogBreed = localStorage.getItem(PENELOPE_DOG_BREED_KEY);
if (kitty && savedDogBreed) {
  const savedForm = localStorage.getItem(PENELOPE_PET_FORM_KEY) === "cat" ? "cat" : "dog";
  setPetForm(savedForm, savedDogBreed);
  installPetToggle(savedDogBreed);
}

if (localStorage.getItem(TOAST_FOR_PENELOPE_KEY) === "true" && kittyStage && kitty) {
  const toast = document.createElement("div");
  const instruction = document.createElement("div");
  toast.className = `penelope-delivery-toast${localStorage.getItem(NIGHTMARE_TOAST_KEY) === "true" ? " nightmare-toast" : ""}`;
  toast.draggable = true;
  toast.style.left = `${12 + Math.random() * 72}vw`;
  toast.style.top = `${44 + Math.random() * 38}vh`;
  toast.setAttribute("role", "button");
  toast.setAttribute("aria-label", "Toast for Penelope's cat. Drag it onto the cat.");
  instruction.className = "penelope-toast-instruction";
  instruction.textContent = "The toast made it! Drag it onto Penelope's cat.";
  document.body.append(toast, instruction);

  toast.addEventListener("dragstart", (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("text/plain", "penelope-cat-toast");
    event.dataTransfer.effectAllowed = "move";
  });
  kittyStage.addEventListener("dragover", (event) => {
    event.preventDefault();
    kittyStage.classList.add("kitty-toast-ready");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  kittyStage.addEventListener("dragleave", () => kittyStage.classList.remove("kitty-toast-ready"));
  kittyStage.addEventListener("drop", (event) => {
    if (event.dataTransfer?.getData("text/plain") !== "penelope-cat-toast") return;
    event.preventDefault();
    const nightmareToast = localStorage.getItem(NIGHTMARE_TOAST_KEY) === "true";
    localStorage.removeItem(TOAST_FOR_PENELOPE_KEY);
    localStorage.removeItem(NIGHTMARE_TOAST_KEY);
    nightmarePetActive = nightmareToast;
    toast.remove();
    kittyStage.classList.remove("kitty-toast-ready");
    kittyStage.classList.add("kitty-eating-toast");
    instruction.textContent = nightmareToast
      ? "The pet ate the toast. The room suddenly became very quiet."
      : "The cat ate the toast... something strange is happening!";
    const breed = dogBreeds[Math.floor(Math.random() * dogBreeds.length)] ?? "normal";
    window.setTimeout(() => {
      localStorage.setItem(PENELOPE_DOG_BREED_KEY, breed);
      localStorage.setItem(PENELOPE_PET_FORM_KEY, "dog");
      setPetForm("dog", breed);
      installPetToggle(breed);
      kittyStage.classList.remove("kitty-eating-toast");
      kittyStage.setAttribute("aria-label", `A happy ${breed} dog that used to be Penelope's cat`);
      instruction.textContent = nightmareToast
        ? `Something wearing the shape of a ${breed} dog followed the toast home.`
        : `The cat randomly turned into a ${breed} dog!`;
      window.setTimeout(() => instruction.remove(), 5000);
    }, 700 + Math.random() * 1800);
  });
}

function setPetForm(form: "cat" | "dog", breed: string): void {
  if (!kitty || !kittyStage) return;
  kitty.classList.remove("is-dog", ...dogBreeds.map((dogBreed) => `dog-${dogBreed}`));
  kitty.classList.toggle("nightmare-pet", nightmarePetActive);
  kittyStage.classList.toggle("nightmare-pet-stage", kitty.classList.contains("nightmare-pet"));
  if (form === "dog") {
    kitty.classList.add("is-dog", `dog-${breed}`);
    kittyStage.setAttribute("aria-label", `A happy ${breed} dog that used to be Penelope's cat`);
  } else {
    const skin = localStorage.getItem(PENELOPE_CAT_SKIN_KEY) ?? "black";
    kittyStage.setAttribute("aria-label", `A small animated ${formatPetName(skin)} cat`);
  }
  const button = kittyStage.querySelector<HTMLButtonElement>(".pet-toggle-button");
  if (button) {
    const nightmare = kitty.classList.contains("nightmare-pet");
    button.textContent = form === "dog" ? `Switch to ${nightmare ? "Nightmare " : ""}Cat` : `Switch to ${nightmare ? "Nightmare " : ""}Dog`;
    button.setAttribute("aria-label", form === "dog" ? "Turn the dog back into a cat" : "Turn the cat into a dog");
  }
}

function installPetToggle(breed: string): void {
  if (!kitty || !kittyStage) return;
  let button = kittyStage.querySelector<HTMLButtonElement>(".pet-toggle-button");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "pet-toggle-button";
    kittyStage.append(button);
    button.addEventListener("click", () => {
      const nextForm = kitty.classList.contains("is-dog") ? "cat" : "dog";
      localStorage.setItem(PENELOPE_PET_FORM_KEY, nextForm);
      const currentBreed = localStorage.getItem(PENELOPE_DOG_BREED_KEY) ?? breed;
      setPetForm(nextForm, currentBreed);
    });
  }
  const currentForm = kitty.classList.contains("is-dog") ? "dog" : "cat";
  setPetForm(currentForm, breed);
  installPetCycler();
}

function installPetCycler(): void {
  if (!kitty || !kittyStage || kitty.dataset["cycleInstalled"] === "true") return;
  kitty.dataset["cycleInstalled"] = "true";
  kitty.classList.add("pet-clickable");
  kitty.tabIndex = 0;
  kitty.setAttribute("role", "button");
  kitty.setAttribute("aria-label", "Change this pet's type");
  const hint = document.createElement("div");
  hint.className = "pet-cycle-hint";
  hint.textContent = kitty.classList.contains("nightmare-pet") ? "It followed you home. Click it if you dare." : "Click the pet to change its type!";
  kittyStage.append(hint);
  const cyclePet = (): void => {
    if (kitty.classList.contains("is-dog")) {
      const current = localStorage.getItem(PENELOPE_DOG_BREED_KEY) ?? "normal";
      const index = dogBreeds.indexOf(current as (typeof dogBreeds)[number]);
      const next = dogBreeds[(index + 1 + dogBreeds.length) % dogBreeds.length] ?? "normal";
      localStorage.setItem(PENELOPE_DOG_BREED_KEY, next);
      setPetForm("dog", next);
      hint.textContent = kitty.classList.contains("nightmare-pet") ? `The thing becomes a ${formatPetName(next)} dog.` : `${formatPetName(next)} dog selected!`;
    } else {
      const current = localStorage.getItem(PENELOPE_CAT_SKIN_KEY) ?? "black";
      const index = catSkins.indexOf(current as (typeof catSkins)[number]);
      const next = catSkins[(index + 1 + catSkins.length) % catSkins.length] ?? "black";
      localStorage.setItem(PENELOPE_CAT_SKIN_KEY, next);
      setCatSkin(next);
      hint.textContent = kitty.classList.contains("nightmare-pet") ? `The thing becomes a ${formatPetName(next)} cat.` : `${formatPetName(next)} cat selected!`;
    }
  };
  kitty.addEventListener("click", cyclePet);
  kitty.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    cyclePet();
  });
}

function setCatSkin(skin: string): void {
  if (!kitty) return;
  kitty.classList.remove(...catSkins.map((catSkin) => `cat-${catSkin}`));
  kitty.classList.add(`cat-${skin}`);
  if (!kitty.classList.contains("is-dog")) {
    kittyStage?.setAttribute("aria-label", `A small animated ${formatPetName(skin)} cat`);
  }
}

function formatPetName(value: string): string {
  const names: Record<string, string> = {
    black: "Black",
    gray: "Storm Gray",
    orange: "Pumpkin",
    snow: "Snow Puff",
    tuxedo: "Tuxedo",
    lavender: "Lavender",
  };
  return names[value] ?? `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function prepareNightmareRefresh(): void {
  if (!nightmarePetActive) return;
  sessionStorage.setItem(NIGHTMARE_REFRESH_SCARE_KEY, "true");
  void playRefreshScareSound();
}

function showRefreshJumpscare(): void {
  const scare = document.createElement("div");
  scare.className = "refresh-jumpscare";
  scare.setAttribute("role", "alert");
  scare.setAttribute("aria-label", "The nightmare pet remembered the refresh");
  scare.innerHTML = `
    <div class="refresh-jumpscare-face" aria-hidden="true">
      <span class="refresh-scare-eye refresh-scare-eye-left"></span>
      <span class="refresh-scare-eye refresh-scare-eye-right"></span>
      <span class="refresh-scare-mouth"></span>
    </div>
    <strong>IT REMEMBERED</strong>
  `;
  document.body.append(scare);
  const message = scare.querySelector<HTMLElement>("strong");
  let finished = false;
  let soundStarted = false;
  const finishScare = (): void => {
    if (finished) return;
    finished = true;
    scare.classList.add("refresh-jumpscare-leaving");
    window.setTimeout(() => scare.remove(), 260);
  };
  const startScare = async (): Promise<void> => {
    if (soundStarted) return;
    const played = await playRefreshScareSound();
    if (played) {
      soundStarted = true;
      scare.classList.remove("refresh-jumpscare-awaiting-sound");
      if (message) message.textContent = "IT REMEMBERED";
      window.setTimeout(finishScare, 1450);
      return;
    }
    scare.classList.add("refresh-jumpscare-awaiting-sound");
    if (message) message.textContent = "CLICK — IT IS LISTENING";
  };
  scare.addEventListener("pointerdown", () => void startScare());
  void startScare();
}

async function playRefreshScareSound(): Promise<boolean> {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    const audioContext = new AudioContextClass();
    await audioContext.resume();
    if (audioContext.state !== "running") {
      void audioContext.close();
      return false;
    }
    const master = audioContext.createGain();
    const growl = audioContext.createOscillator();
    const scrape = audioContext.createOscillator();
    const noise = audioContext.createBufferSource();
    const noiseFilter = audioContext.createBiquadFilter();
    const now = audioContext.currentTime;
    const noiseBuffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 0.95), audioContext.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseData.length; index += 1) {
      const fade = 1 - index / noiseData.length;
      noiseData[index] = (Math.random() * 2 - 1) * fade;
    }
    noise.buffer = noiseBuffer;
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(1800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(170, now + 0.9);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.58, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    growl.type = "sawtooth";
    growl.frequency.setValueAtTime(105, now);
    growl.frequency.exponentialRampToValueAtTime(29, now + 0.85);
    scrape.type = "square";
    scrape.detune.setValueAtTime(-18, now);
    scrape.frequency.setValueAtTime(57, now);
    scrape.frequency.exponentialRampToValueAtTime(19, now + 0.72);
    growl.connect(master);
    scrape.connect(master);
    noise.connect(noiseFilter);
    noiseFilter.connect(master);
    master.connect(audioContext.destination);
    growl.start(now);
    scrape.start(now + 0.025);
    noise.start(now);
    growl.stop(now + 0.96);
    scrape.stop(now + 0.83);
    noise.stop(now + 0.94);
    window.setTimeout(() => void audioContext.close(), 1150);
    return true;
  } catch {
    return false;
  }
}
