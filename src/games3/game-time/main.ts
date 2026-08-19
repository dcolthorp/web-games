export {};

interface Stickman {
  element: HTMLButtonElement;
  expiresAt: number;
  kind: StickmanKind;
  timers: number[];
}

type StickmanKind = "normal" | "bomb" | "expander" | "poison";

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
const heartsLabel = document.getElementById("hearts");
const blindness = document.getElementById("blindness");

const stickmen = new Map<number, Stickman>();
let nextId = 1;
let clock = 0;
let playing = false;
let hearts = 3;
let blindnessTimer = 0;

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
  if (heartsLabel) heartsLabel.textContent = `${"♥ ".repeat(hearts)}${"♡ ".repeat(3 - hearts)}`.trim();
}

function placeStickman(element: HTMLButtonElement): void {
  element.style.left = `${4 + Math.random() * 90}%`;
  element.style.top = `${6 + Math.random() * 82}%`;
  element.style.setProperty("--tilt", `${-18 + Math.random() * 36}deg`);
  element.style.setProperty("--scale", `${0.72 + Math.random() * 0.5}`);
  element.style.setProperty("--walk-x", `${-90 + Math.random() * 180}px`);
  element.style.setProperty("--walk-y", `${-65 + Math.random() * 130}px`);
  element.style.setProperty("--walk-time", `${4.5 + Math.random() * 5}s`);
}

function chooseKind(): StickmanKind {
  const roll = Math.random();
  if (roll < 0.12) return "bomb";
  if (roll < 0.22) return "expander";
  if (roll < 0.3) return "poison";
  return "normal";
}

function spawnStickman(kind: StickmanKind = chooseKind()): void {
  if (!field || !playing) return;
  if (stickmen.size >= MAX_STICKMEN) {
    finish(false, "100 STICKMEN! they took over the paper.");
    return;
  }
  const id = nextId++;
  const element = document.createElement("button");
  element.type = "button";
  element.className = `stickman stickman-${kind}`;
  element.setAttribute("aria-label", `${kind} stickman`);
  element.innerHTML = drawStickman();
  placeStickman(element);
  field.appendChild(element);

  const expiresAt = performance.now() + LIFETIME_MS;
  const timers = [window.setTimeout(() => splitStickman(id), LIFETIME_MS)];
  stickmen.set(id, { element, expiresAt, kind, timers });
  if (kind === "bomb") timers.push(window.setTimeout(() => bombAttack(id), 8_000 + Math.random() * 7_000));
  if (kind === "poison") timers.push(window.setTimeout(() => poisonAttack(id), 7_000 + Math.random() * 6_000));
  element.addEventListener("click", () => removeStickman(id));
  updateHud();
}

function removeStickman(id: number): void {
  if (!playing) return;
  const stickman = stickmen.get(id);
  if (!stickman) return;
  for (const timer of stickman.timers) window.clearTimeout(timer);
  stickmen.delete(id);
  stickman.element.disabled = true;
  stickman.element.classList.add("clicked-away");
  window.setTimeout(() => stickman.element.remove(), FADE_MS);
  if (stickman.kind === "expander") {
    for (let index = 0; index < 5; index += 1) spawnStickman("normal");
  }
  updateHud();
  if (stickmen.size === 0) finish(true);
}

function splitStickman(id: number): void {
  if (!playing) return;
  const stickman = stickmen.get(id);
  if (!stickman) return;
  stickmen.delete(id);
  for (const timer of stickman.timers) window.clearTimeout(timer);
  stickman.element.classList.add("faded-away");
  window.setTimeout(() => stickman.element.remove(), FADE_MS);
  spawnStickman("normal");
  spawnStickman("normal");
  if (stickmen.size >= MAX_STICKMEN) finish(false);
}

function bombAttack(id: number): void {
  if (!playing) return;
  const bomber = stickmen.get(id);
  if (!bomber || bomber.kind !== "bomb") return;
  if (blindness?.classList.contains("active")) {
    bomber.timers.push(window.setTimeout(() => bombAttack(id), 4_000 + Math.random() * 4_000));
    return;
  }
  const bomb = document.createElement("span");
  bomb.className = "flying-bomb";
  bomber.element.appendChild(bomb);
  window.setTimeout(() => bomb.remove(), 700);
  hearts -= 1;
  updateHud();
  blindness?.classList.add("active");
  blindness?.setAttribute("aria-hidden", "false");
  window.clearTimeout(blindnessTimer);
  blindnessTimer = window.setTimeout(() => {
    blindness?.classList.remove("active");
    blindness?.setAttribute("aria-hidden", "true");
  }, 5_000);
  if (hearts <= 0) {
    finish(false, "NO HEARTS LEFT! the bombers got you.");
    return;
  }
  bomber.timers.push(window.setTimeout(() => bombAttack(id), 10_000 + Math.random() * 8_000));
}

function poisonAttack(id: number): void {
  if (!playing) return;
  const poisoner = stickmen.get(id);
  if (!poisoner || poisoner.kind !== "poison") return;
  const candidates = Array.from(stickmen.entries()).filter(([, stickman]) => stickman.kind === "normal");
  const victim = candidates[Math.floor(Math.random() * candidates.length)];
  if (victim) {
    const [victimId, stickman] = victim;
    for (const timer of stickman.timers) window.clearTimeout(timer);
    stickmen.delete(victimId);
    stickman.element.classList.add("poisoned-away");
    window.setTimeout(() => stickman.element.remove(), FADE_MS);
    spawnStickman("poison");
  }
  spawnStickman("normal");
  poisoner.timers.push(window.setTimeout(() => poisonAttack(id), 9_000 + Math.random() * 7_000));
}

function finish(won: boolean, result?: string): void {
  playing = false;
  window.clearInterval(clock);
  for (const stickman of stickmen.values()) {
    for (const timer of stickman.timers) window.clearTimeout(timer);
  }
  window.clearTimeout(blindnessTimer);
  blindness?.classList.remove("active");
  overlay?.classList.remove("hidden");
  if (startButton) startButton.textContent = won ? "play again" : "try again";
  if (message) {
    message.textContent = won
      ? "YOU GOT THEM ALL. the paper is safe."
      : result ?? "100 STICKMEN! they took over the paper.";
  }
}

function resetGame(): void {
  for (const stickman of stickmen.values()) {
    for (const timer of stickman.timers) window.clearTimeout(timer);
  }
  stickmen.clear();
  field?.replaceChildren();
  nextId = 1;
  playing = true;
  hearts = 3;
  overlay?.classList.add("hidden");
  if (timeLabel) timeLabel.textContent = "60";
  for (let index = 0; index < STARTING_STICKMEN; index += 1) {
    const kind: StickmanKind = index < 6 ? "bomb" : index < 11 ? "expander" : index < 15 ? "poison" : "normal";
    spawnStickman(kind);
  }
  window.clearInterval(clock);
  clock = window.setInterval(() => {
    if (!playing || !timeLabel || stickmen.size === 0) return;
    const soonest = Math.min(...Array.from(stickmen.values(), (stickman) => stickman.expiresAt));
    timeLabel.textContent = String(Math.max(0, Math.ceil((soonest - performance.now()) / 1000)));
  }, 200);
}

startButton?.addEventListener("click", resetGame);
