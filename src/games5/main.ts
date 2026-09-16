import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";
import { paintBrushedSteel, typeOnCalculatorScreen } from "./simulationCard";

installOofShortcut();
installForceRefreshHotkey();

interface Game {
  id: string;
  name: string;
  path: string;
  menuLabel?: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  {
    id: "the-simulation",
    name: "The Simulation",
    path: "./the-simulation/index.html",
    genre: "???",
    blurb: "Nobody knows what it is yet. Not even the calculator.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Oscar, you know what to do.</li>';
    return;
  }

  list.innerHTML = games
    .map((game) => {
      const isSimulation = game.id === "the-simulation";
      // The Simulation's title is a calculator screen instead of words.
      const title = isSimulation
        ? '<canvas class="simulation-screen" width="960" height="200" aria-hidden="true"></canvas>'
        : `<span class="game-title">${game.menuLabel ?? game.name}</span>`;
      return `
      <li>
        <a class="game-card games5-game-card${isSimulation ? " simulation-card" : ""}" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          ${title}
          <span class="game-blurb">${game.blurb}</span>
        </a>
      </li>
    `;
    })
    .join("");
  decorateSimulationCard(list);
}

// The Simulation's card is a sheet of brushed stainless steel, and its
// calculator screen punches the name in one key at a time.
function decorateSimulationCard(list: HTMLElement): void {
  const card = list.querySelector<HTMLElement>(".simulation-card");
  const screen = card?.querySelector("canvas");
  if (!card || !screen) return;
  const steel = paintBrushedSteel(600, 400);
  if (steel) card.style.backgroundImage = `url(${steel})`;
  // The blank on the end is typed too, so the name ends up sitting in the middle
  // of the screen with one empty space on each side instead of two on the left.
  typeOnCalculatorScreen(screen, "THE SIMULATION ");
}

renderGameList();

// The caution tape under the title is a synthesizer: every stripe is a key.
// Each finger (or the mouse) holds its own note, so on a phone you can mash as
// many stripes at once as the screen will count, and slide along to play runs.
// Minor pentatonic, so any pile of keys pressed together still sounds nice.
const TAPE_SCALE = [0, 3, 5, 7, 10];
const TAPE_LOWEST_NOTE = 45; // A2, as a MIDI note number
const TAPE_KEY_WIDTH = 40;

interface TapeVoice {
  stop(): void;
}

function installCautionTapeSynth(): void {
  const foundTape = document.querySelector<HTMLElement>(".games5-stripes");
  if (!foundTape) return;
  // Named again so the helper functions below know it can't be missing.
  const tape: HTMLElement = foundTape;

  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let engine: { audio: AudioContext; output: AudioNode } | null = null;

  // Browsers only allow sound after a tap, so the synth wakes up on the first one.
  function wakeAudio(): { audio: AudioContext; output: AudioNode } | null {
    if (!AudioContextClass) return null;
    if (!engine) {
      const audio = new AudioContextClass();
      const volume = audio.createGain();
      volume.gain.value = 0.4;
      // Keeps a whole handful of fingers from clipping into a crunch.
      const limiter = audio.createDynamicsCompressor();
      volume.connect(limiter).connect(audio.destination);
      engine = { audio, output: volume };
    }
    void engine.audio.resume().catch(() => {});
    return engine;
  }

  // Two slightly detuned sawtooths through a closing filter: a classic synth
  // pluck that keeps ringing for as long as the stripe is held.
  function startVoice(frequency: number): TapeVoice | null {
    const sound = wakeAudio();
    if (!sound) return null;
    const { audio, output } = sound;
    const now = audio.currentTime;

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(Math.min(frequency * 10, 12000), now);
    filter.frequency.setTargetAtTime(Math.min(frequency * 3, 6000), now, 0.25);

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain.gain.setTargetAtTime(0.12, now + 0.01, 0.2);
    filter.connect(gain).connect(output);

    const oscillators = [-7, 7].map((detune) => {
      const oscillator = audio.createOscillator();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      oscillator.start(now);
      return oscillator;
    });

    return {
      stop() {
        const at = audio.currentTime;
        gain.gain.cancelScheduledValues(at);
        gain.gain.setValueAtTime(gain.gain.value, at);
        gain.gain.setTargetAtTime(0, at, 0.06);
        for (const oscillator of oscillators) oscillator.stop(at + 0.4);
        oscillators[0]?.addEventListener("ended", () => gain.disconnect());
      },
    };
  }

  function noteFrequency(index: number): number {
    const octave = Math.floor(index / TAPE_SCALE.length);
    const note = TAPE_LOWEST_NOTE + 12 * octave + (TAPE_SCALE[index % TAPE_SCALE.length] ?? 0);
    return 440 * 2 ** ((note - 69) / 12);
  }

  const held = new Map<number, { key: HTMLElement; voice: TapeVoice | null }>();
  const fingersDown = new Set<number>();

  // Roughly one stripe-sized key per 40px, but never so many it squeaks.
  function layOutKeys(width: number): void {
    const count = Math.max(12, Math.min(25, Math.round(width / TAPE_KEY_WIDTH)));
    if (tape.childElementCount === count) return;
    releaseEverything();
    tape.replaceChildren(
      ...Array.from({ length: count }, (_, index) => {
        const key = document.createElement("span");
        key.className = "tape-key";
        key.dataset["keyIndex"] = String(index);
        return key;
      })
    );
  }

  function keyAt(x: number, y: number): HTMLElement | null {
    const target = document.elementFromPoint(x, y);
    return target instanceof HTMLElement && target.parentElement === tape ? target : null;
  }

  function press(pointerId: number, key: HTMLElement): void {
    const voice = startVoice(noteFrequency(Number(key.dataset["keyIndex"])));
    key.classList.add("is-pressed");
    held.set(pointerId, { key, voice });
  }

  function release(pointerId: number): void {
    const note = held.get(pointerId);
    if (!note) return;
    held.delete(pointerId);
    note.voice?.stop();
    // Two fingers can share a stripe; it stays lit until the last one lets go.
    if (![...held.values()].some((other) => other.key === note.key)) note.key.classList.remove("is-pressed");
  }

  function releaseEverything(): void {
    fingersDown.clear();
    for (const pointerId of [...held.keys()]) release(pointerId);
  }

  tape.addEventListener("pointerdown", (event) => {
    const key = keyAt(event.clientX, event.clientY);
    if (!key) return;
    event.preventDefault();
    tape.setPointerCapture(event.pointerId);
    fingersDown.add(event.pointerId);
    press(event.pointerId, key);
  });

  // Sliding a finger along the tape plays each stripe it crosses.
  tape.addEventListener("pointermove", (event) => {
    if (!fingersDown.has(event.pointerId)) return;
    const key = keyAt(event.clientX, event.clientY);
    if (key === (held.get(event.pointerId)?.key ?? null)) return;
    release(event.pointerId);
    if (key) press(event.pointerId, key);
  });

  const letGo = (event: PointerEvent): void => {
    fingersDown.delete(event.pointerId);
    release(event.pointerId);
    // On phones a touch only counts as permission for sound once the finger lifts.
    wakeAudio();
  };
  tape.addEventListener("pointerup", letGo);
  tape.addEventListener("pointercancel", letGo);
  tape.addEventListener("lostpointercapture", letGo);
  // Switching apps mid-chord shouldn't leave notes stuck on.
  window.addEventListener("blur", releaseEverything);

  new ResizeObserver(([entry]) => {
    if (entry) layOutKeys(entry.contentRect.width);
  }).observe(tape);
}

installCautionTapeSynth();

// This hub's floor is fragile: every hit cracks it a little more, and one hit
// too many breaks it clean off the page. It's back in one piece after a reload.
const FLOOR_CRACK_WARNINGS = ["HEY", "STOP IT", "IT'S CRACKING", "YOU'RE GONNA BREAK IT"];

const trapFloor5 = document.getElementById("trap-floor-5");
if (trapFloor5 instanceof HTMLButtonElement) {
  let hits = 0;

  trapFloor5.addEventListener("click", () => {
    hits += 1;
    trapFloor5.dataset["cracks"] = String(Math.min(hits, FLOOR_CRACK_WARNINGS.length));

    if (hits <= FLOOR_CRACK_WARNINGS.length) {
      trapFloor5.textContent = FLOOR_CRACK_WARNINGS[hits - 1] ?? "";
      // Restart the wobble so every hit shakes it, not just the first.
      trapFloor5.classList.remove("is-hit");
      void trapFloor5.offsetWidth;
      trapFloor5.classList.add("is-hit");
      return;
    }

    trapFloor5.textContent = "CRACK";
    trapFloor5.disabled = true;
    trapFloor5.classList.remove("is-hit");
    trapFloor5.classList.add("is-broken");
    trapFloor5.addEventListener("animationend", () => trapFloor5.classList.add("is-gone"), { once: true });

    const note = document.createElement("p");
    note.className = "floor-gone-note";
    note.textContent = "Great. Now there's no floor.";
    trapFloor5.after(note);
  });
}
