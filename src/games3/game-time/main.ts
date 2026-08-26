import { installDefiantTitle, isDefiant, notifyCageBreaker, notifyFieldCleared, notifyGameWon } from "./defiant";

interface Stickman {
  element: HTMLButtonElement;
  expiresAt: number;
  kind: StickmanKind;
  timers: number[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  edgeHits: number;
}

type StickmanKind = "normal" | "bomb" | "expander" | "poison";

const STARTING_STICKMEN = 50;
const MAX_STICKMEN = 100;
const LIFETIME_MS = 60_000;
const FADE_MS = 420;
const BLINDNESS_MS = 5_000;
const STICKMAN_RADIUS = 18;
const CORNER_RADIUS = 82;
const EDGE_HITS_BEFORE_BURST = 7;

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
let animationFrame = 0;
let previousFrame = 0;
let audioContext: AudioContext | null = null;
const collisionCooldowns = new Map<string, number>();

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

function placeStickman(element: HTMLButtonElement): { x: number; y: number } {
  const width = field?.clientWidth ?? 900;
  const height = field?.clientHeight ?? 500;
  const x = STICKMAN_RADIUS + Math.random() * Math.max(1, width - STICKMAN_RADIUS * 2);
  const y = STICKMAN_RADIUS + Math.random() * Math.max(1, height - STICKMAN_RADIUS * 2);
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.setProperty("--tilt", `${-18 + Math.random() * 36}deg`);
  element.style.setProperty("--scale", `${0.72 + Math.random() * 0.5}`);
  return { x, y };
}

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

function playPianoNote(noteIndex: number, quiet = false): void {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const frequency = 261.63 * 2 ** (Math.min(noteIndex, 18) / 12);
  const gain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const tone = context.createOscillator();
  const overtone = context.createOscillator();
  tone.type = "triangle";
  overtone.type = "sine";
  tone.frequency.value = frequency;
  overtone.frequency.value = frequency * 2;
  gain.gain.setValueAtTime(quiet ? 0.18 : 0.38, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
  tone.connect(gain);
  overtone.connect(gain);
  gain.connect(compressor);
  compressor.connect(context.destination);
  tone.start(now);
  overtone.start(now);
  tone.stop(now + 0.73);
  overtone.stop(now + 0.73);
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
  const position = placeStickman(element);
  field.appendChild(element);

  const expiresAt = performance.now() + LIFETIME_MS;
  const timers = [window.setTimeout(() => splitStickman(id), LIFETIME_MS)];
  const speed = 42 + Math.random() * 45;
  const angle = Math.random() * Math.PI * 2;
  stickmen.set(id, {
    element,
    expiresAt,
    kind,
    timers,
    x: position.x,
    y: position.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    edgeHits: 0,
  });
  if (kind === "poison") timers.push(window.setTimeout(() => poisonAttack(id), 7_000 + Math.random() * 6_000));
  element.addEventListener("click", () => removeStickman(id));
  updateHud();
}

function burstStickman(id: number): void {
  const stickman = stickmen.get(id);
  if (!stickman) return;
  for (const timer of stickman.timers) window.clearTimeout(timer);
  stickmen.delete(id);
  stickman.element.disabled = true;
  stickman.element.classList.add("burst-away");
  window.setTimeout(() => stickman.element.remove(), FADE_MS);
  updateHud();
  if (playing && stickmen.size === 0) finish(true);
}

function moveStickmen(timestamp: number): void {
  if (!playing || !field) return;
  const delta = Math.min(0.035, (timestamp - previousFrame) / 1000 || 0);
  previousFrame = timestamp;
  const width = field.clientWidth;
  const height = field.clientHeight;
  const entries = Array.from(stickmen.entries());

  for (const [id, stickman] of entries) {
    stickman.x += stickman.vx * delta;
    stickman.y += stickman.vy * delta;
    const hitX = stickman.x <= STICKMAN_RADIUS || stickman.x >= width - STICKMAN_RADIUS;
    const hitY = stickman.y <= STICKMAN_RADIUS || stickman.y >= height - STICKMAN_RADIUS;
    if (hitX) {
      stickman.x = Math.max(STICKMAN_RADIUS, Math.min(width - STICKMAN_RADIUS, stickman.x));
      stickman.vx *= -1;
    }
    if (hitY) {
      stickman.y = Math.max(STICKMAN_RADIUS, Math.min(height - STICKMAN_RADIUS, stickman.y));
      stickman.vy *= -1;
    }
    if (hitX || hitY) {
      stickman.edgeHits += 1;
      playPianoNote(stickman.edgeHits * 2);
      const nearLeft = stickman.x <= CORNER_RADIUS;
      const nearRight = stickman.x >= width - CORNER_RADIUS;
      const nearTop = stickman.y <= CORNER_RADIUS;
      const nearBottom = stickman.y >= height - CORNER_RADIUS;
      const hitCornerZone = (nearLeft || nearRight) && (nearTop || nearBottom);
      if (hitCornerZone) {
        burstStickman(id);
        continue;
      }
      if (stickman.edgeHits >= EDGE_HITS_BEFORE_BURST) {
        burstStickman(id);
        continue;
      }
    }
    stickman.element.style.left = `${stickman.x}px`;
    stickman.element.style.top = `${stickman.y}px`;
  }

  const liveEntries = Array.from(stickmen.entries());
  for (let first = 0; first < liveEntries.length; first += 1) {
    for (let second = first + 1; second < liveEntries.length; second += 1) {
      const [firstId, a] = liveEntries[first]!;
      const [secondId, b] = liveEntries[second]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= 0 || distanceSquared > (STICKMAN_RADIUS * 2) ** 2) continue;
      const distance = Math.sqrt(distanceSquared);
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = STICKMAN_RADIUS * 2 - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const relativeSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relativeSpeed < 0) {
        a.vx += relativeSpeed * nx;
        a.vy += relativeSpeed * ny;
        b.vx -= relativeSpeed * nx;
        b.vy -= relativeSpeed * ny;
      }
      const key = `${firstId}:${secondId}`;
      if ((collisionCooldowns.get(key) ?? 0) < timestamp) {
        playPianoNote(2 + ((firstId + secondId) % 8), true);
        collisionCooldowns.set(key, timestamp + 180);
      }
    }
  }
  animationFrame = window.requestAnimationFrame(moveStickmen);
}

function removeStickman(id: number): void {
  if (!playing) return;
  const stickman = stickmen.get(id);
  if (!stickman) return;
  if (stickman.kind === "bomb") {
    bombAttack(id);
    if (!playing) return;
  }
  if (stickman.kind === "poison") notifyCageBreaker("poison");
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
  if (blindness?.classList.contains("active")) return;
  const bomb = document.createElement("span");
  bomb.className = "flying-bomb";
  bomber.element.appendChild(bomb);
  window.setTimeout(() => bomb.remove(), 700);
  hearts -= 1;
  updateHud();
  blindness?.classList.add("active");
  blindness?.setAttribute("aria-hidden", "false");
  // Same frame as the flash, so the swap happens under cover. The flash animates
  // through transparent, so anything left boxed around the title would show
  // through it mid-blast.
  notifyCageBreaker("bomb");
  window.clearTimeout(blindnessTimer);
  blindnessTimer = window.setTimeout(() => {
    blindness?.classList.remove("active");
    blindness?.setAttribute("aria-hidden", "true");
  }, BLINDNESS_MS);
  if (hearts <= 0) {
    finish(false, "NO HEARTS LEFT! the bombers got you.");
    return;
  }
}

function poisonAttack(id: number): void {
  if (!playing) return;
  const poisoner = stickmen.get(id);
  if (!poisoner || poisoner.kind !== "poison") return;
  const candidates = Array.from(stickmen.entries()).filter(([, stickman]) => stickman.kind === "normal");
  const victim = candidates[Math.floor(Math.random() * candidates.length)];
  if (victim) {
    const [, stickman] = victim;
    stickman.kind = "poison";
    stickman.element.classList.remove("stickman-normal");
    stickman.element.classList.add("stickman-poison", "newly-poisoned");
    stickman.element.setAttribute("aria-label", "poisoned stickman");
    window.setTimeout(() => stickman.element.classList.remove("newly-poisoned"), 650);
  }
  spawnStickman("normal");
}

function finish(won: boolean, result?: string): void {
  playing = false;
  window.clearInterval(clock);
  window.cancelAnimationFrame(animationFrame);
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
  // Clearing the paper is the only thing the trophy box gives way to.
  if (won) notifyGameWon();
}

async function resetGame(): Promise<void> {
  const context = getAudioContext();
  if (context?.state === "suspended") await context.resume();
  playPianoNote(0);
  window.setTimeout(() => playPianoNote(4), 110);
  window.setTimeout(() => playPianoNote(7), 220);
  for (const stickman of stickmen.values()) {
    for (const timer of stickman.timers) window.clearTimeout(timer);
  }
  stickmen.clear();
  collisionCooldowns.clear();
  field?.replaceChildren();
  // That just wiped anything the title had painted onto the field, so let it
  // put the blackout back rather than handing out a free escape.
  notifyFieldCleared();
  nextId = 1;
  playing = true;
  previousFrame = performance.now();
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
  window.cancelAnimationFrame(animationFrame);
  animationFrame = window.requestAnimationFrame(moveStickmen);
}

startButton?.addEventListener("click", () => void resetGame());

// Removing the paper reveals the secret platformer. Stop this game's timers,
// animation, collision work, audio queue, and detached stickmen immediately so
// it cannot keep consuming a frame budget behind the new canvas.
window.addEventListener("secret-game-revealed", () => {
  playing = false;
  window.clearInterval(clock);
  window.cancelAnimationFrame(animationFrame);
  window.clearTimeout(blindnessTimer);
  window.speechSynthesis?.cancel();
  for (const stickman of stickmen.values()) {
    for (const timer of stickman.timers) window.clearTimeout(timer);
  }
  stickmen.clear();
  collisionCooldowns.clear();
});

/**
 * The title blacking out the paper takes every stickman with it. Deliberately
 * not routed through removeStickman(): that would read as the player clearing
 * the board and hand them a win they didn't earn.
 */
function eraseStickmen(): void {
  for (const stickman of stickmen.values()) {
    for (const timer of stickman.timers) window.clearTimeout(timer);
    stickman.element.remove();
  }
  stickmen.clear();
  collisionCooldowns.clear();
  updateHud();
}

if (isDefiant()) installDefiantTitle(eraseStickmen);
