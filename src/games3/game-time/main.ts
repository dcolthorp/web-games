export {};

interface Stickman {
  element: HTMLButtonElement;
  expiresAt: number;
  timeout: number;
}

const STARTING_STICKMEN = 50;
const MAX_STICKMEN = 100;
const LIFETIME_MS = 60_000;
const FADE_MS = 420;

const field = document.getElementById("stickman-field");
const countLabel = document.getElementById("count");
const timeLabel = document.getElementById("time");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start") as HTMLButtonElement | null;
const message = document.getElementById("message");

const stickmen = new Map<number, Stickman>();
let nextId = 1;
let clock = 0;
let playing = false;

function drawStickman(): string {
  return `
    <span class="stick-head"></span>
    <span class="stick-body"></span>
    <span class="stick-arm stick-arm-left"></span>
    <span class="stick-arm stick-arm-right"></span>
    <span class="stick-leg stick-leg-left"></span>
    <span class="stick-leg stick-leg-right"></span>
  `;
}

function updateHud(): void {
  if (countLabel) countLabel.textContent = String(stickmen.size);
}

function placeStickman(element: HTMLButtonElement): void {
  element.style.left = `${4 + Math.random() * 90}%`;
  element.style.top = `${6 + Math.random() * 82}%`;
  element.style.setProperty("--tilt", `${-18 + Math.random() * 36}deg`);
  element.style.setProperty("--scale", `${0.72 + Math.random() * 0.5}`);
}

function spawnStickman(): void {
  if (!field || !playing) return;
  const id = nextId++;
  const element = document.createElement("button");
  element.type = "button";
  element.className = "stickman";
  element.setAttribute("aria-label", "Remove stickman");
  element.innerHTML = drawStickman();
  placeStickman(element);
  field.appendChild(element);

  const expiresAt = performance.now() + LIFETIME_MS;
  const timeout = window.setTimeout(() => splitStickman(id), LIFETIME_MS);
  stickmen.set(id, { element, expiresAt, timeout });
  element.addEventListener("click", () => removeStickman(id));
  updateHud();
}

function removeStickman(id: number): void {
  if (!playing) return;
  const stickman = stickmen.get(id);
  if (!stickman) return;
  window.clearTimeout(stickman.timeout);
  stickmen.delete(id);
  stickman.element.disabled = true;
  stickman.element.classList.add("clicked-away");
  window.setTimeout(() => stickman.element.remove(), FADE_MS);
  updateHud();
  if (stickmen.size === 0) finish(true);
}

function splitStickman(id: number): void {
  if (!playing) return;
  const stickman = stickmen.get(id);
  if (!stickman) return;
  stickmen.delete(id);
  stickman.element.classList.add("faded-away");
  window.setTimeout(() => stickman.element.remove(), FADE_MS);
  spawnStickman();
  spawnStickman();
  if (stickmen.size >= MAX_STICKMEN) finish(false);
}

function finish(won: boolean): void {
  playing = false;
  window.clearInterval(clock);
  for (const stickman of stickmen.values()) window.clearTimeout(stickman.timeout);
  overlay?.classList.remove("hidden");
  if (startButton) startButton.textContent = won ? "play again" : "try again";
  if (message) {
    message.textContent = won
      ? "YOU GOT THEM ALL. the paper is safe."
      : "100 STICKMEN! they took over the paper.";
  }
}

function resetGame(): void {
  for (const stickman of stickmen.values()) window.clearTimeout(stickman.timeout);
  stickmen.clear();
  field?.replaceChildren();
  nextId = 1;
  playing = true;
  overlay?.classList.add("hidden");
  if (timeLabel) timeLabel.textContent = "60";
  for (let index = 0; index < STARTING_STICKMEN; index += 1) spawnStickman();
  window.clearInterval(clock);
  clock = window.setInterval(() => {
    if (!playing || !timeLabel || stickmen.size === 0) return;
    const soonest = Math.min(...Array.from(stickmen.values(), (stickman) => stickman.expiresAt));
    timeLabel.textContent = String(Math.max(0, Math.ceil((soonest - performance.now()) / 1000)));
  }, 200);
}

startButton?.addEventListener("click", resetGame);
