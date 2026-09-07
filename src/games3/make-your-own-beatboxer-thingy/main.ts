import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import kickUrl from "./assets/oscars-voice.m4a?url";
import snareUrl from "./assets/oscars-snare.m4a?url";
import hihatUrl from "./assets/oscars-hihat.m4a?url";
import crashUrl from "./assets/oscars-crash.m4a?url";
import bassDropUrl from "./assets/oscars-bassdrop.m4a?url";
import fireUrl from "./assets/oscars-fire-in-the-hole.m4a?url";
import sizzlerUrl from "./assets/oscars-seven.m4a?url";
import gdFaceUrl from "./assets/geometry-dash-face.jpg?url";

installOofShortcut();
installForceRefreshHotkey();

const STEPS = 16;
const STORAGE_KEY = "make-your-own-beatboxer-thingy-pattern-v9";

type SampleId = "kick" | "snare" | "hihat" | "crash" | "bassdrop" | "fire" | "sizzler";

const sampleUrls: Record<SampleId, string> = {
  kick: kickUrl,
  snare: snareUrl,
  hihat: hihatUrl,
  crash: crashUrl,
  bassdrop: bassDropUrl,
  fire: fireUrl,
  sizzler: sizzlerUrl,
};

interface LoadedSample {
  buffer: AudioBuffer;
  activeStart: number;
  activeDuration: number;
  normalization: number;
}

interface Lane {
  name: string;
  chop: string;
  color: string;
  sample: SampleId;
  slicePosition: number;
  // Seconds into the raw recording, for lanes cut from a specific moment of a
  // long take rather than from its auto-detected loud region.
  absoluteStart?: number;
  // Left undefined, the lane rings out for as long as its recording is loud.
  duration?: number;
  playbackRate: number;
  filter: BiquadFilterType;
  frequency: number;
  gain: number;
  // The Everything lane ignores its own sample and fires all the others.
  everything?: boolean;
  // Swaps the lane's colour dot for a picture.
  icon?: string;
}

const lanes: Lane[] = [
  { name: "Big Mouth Kick", chop: "low + thumpy", color: "#f9d648", sample: "kick", slicePosition: 0, duration: 0.24, playbackRate: 0.58, filter: "lowpass", frequency: 1100, gain: 1.25 },
  { name: "Snare", chop: "straight off the tape", color: "#ff657b", sample: "snare", slicePosition: 0, duration: 0.4, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.2 },
  { name: "Hi-Hat", chop: "hi-hat hopes", color: "#61d6ff", sample: "hihat", slicePosition: 0, duration: 0.2, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.15 },
  { name: "Crash", chop: "let it ring", color: "#8ae66e", sample: "crash", slicePosition: 0, duration: 1.6, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.1 },
  { name: "Bass Drop", chop: "hold onto something", color: "#c084fc", sample: "bassdrop", slicePosition: 0, duration: 3.2, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.15 },
  { name: "Fire in the Hole", chop: "its own voice memo", color: "#ff7a1a", sample: "fire", icon: gdFaceUrl, slicePosition: 0, duration: 3, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.2 },
  { name: "The Sizzler", chop: "long and hissy", color: "#dfe8f0", sample: "sizzler", slicePosition: 0, duration: 0.9, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.15 },
  { name: "The Everything", chop: "all of it, at once", color: "#ffffff", sample: "kick", slicePosition: 0, duration: 3.2, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1, everything: true },
];

const defaultPattern = [
  [true, false, false, false, false, false, false, false, true, false, false, true, false, false, false, false],
  [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
  [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false],
  [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
];

function loadPattern(): boolean[][] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as unknown;
    if (Array.isArray(saved) && saved.length === lanes.length && saved.every((row) => Array.isArray(row) && row.length === STEPS)) {
      return saved.map((row) => (row as unknown[]).map(Boolean));
    }
  } catch {
    // A damaged saved beat should never stop the machine from loading.
  }
  return defaultPattern.map((row) => [...row]);
}

let pattern = loadPattern();
let audioContext: AudioContext | null = null;
const samples = new Map<SampleId, LoadedSample>();
let masterBus: GainNode | null = null;
let isPlaying = false;
let currentStep = 0;
let nextStepTime = 0;
let schedulerTimer = 0;

const sequencer = document.querySelector<HTMLDivElement>("#sequencer");
const beatNumbers = document.querySelector<HTMLDivElement>("#beat-numbers");
const playButton = document.querySelector<HTMLButtonElement>("#play-button");
const playLabel = document.querySelector<HTMLElement>("#play-label");
const playIcon = document.querySelector<HTMLElement>(".play-icon");
const statusText = document.querySelector<HTMLElement>("#status-text");
const tempoInput = document.querySelector<HTMLInputElement>("#tempo");
const tempoOutput = document.querySelector<HTMLOutputElement>("#tempo-output");
const swingInput = document.querySelector<HTMLInputElement>("#swing");
const swingOutput = document.querySelector<HTMLOutputElement>("#swing-output");
const randomButton = document.querySelector<HTMLButtonElement>("#random-button");
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button");
const fillButton = document.querySelector<HTMLButtonElement>("#fill-button");
const waveform = document.querySelector<HTMLCanvasElement>("#waveform");
const waveformFrame = document.querySelector<HTMLDivElement>(".waveform-frame");
const machineGuts = document.querySelector<HTMLDivElement>("#machine-guts");
const gutsText = document.querySelector<HTMLParagraphElement>("#guts-text");
const gutsReset = document.querySelector<HTMLButtonElement>("#guts-reset");
const saveForm = document.querySelector<HTMLFormElement>("#save-form");
const saveName = document.querySelector<HTMLInputElement>("#save-name");
const vaultList = document.querySelector<HTMLUListElement>("#vault-list");
const vaultEmpty = document.querySelector<HTMLParagraphElement>("#vault-empty");

const SAVES_KEY = "make-your-own-beatboxer-thingy-saves-v1";

interface SavedBeat {
  name: string;
  pattern: boolean[][];
  tempo: string;
  swing: string;
}

const SEEDED_KEY = "make-your-own-beatboxer-thingy-seeded-v1";
const CRACKED_KEY = "make-your-own-beatboxer-thingy-cracked-v1";
const SCREWS_KEY = "make-your-own-beatboxer-thingy-screws-v1";
const SCREW_IDS = ["tl", "tr", "bl", "br"] as const;

function readList(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

// A beat that has already turned a screw is spent, so each screw needs a
// different save. Both lists outlive a reload.
let crackedBeats = new Set(readList(CRACKED_KEY));
let removedScrews = new Set(readList(SCREWS_KEY));

function persistScrewState(): void {
  localStorage.setItem(CRACKED_KEY, JSON.stringify([...crackedBeats]));
  localStorage.setItem(SCREWS_KEY, JSON.stringify([...removedScrews]));
}

// Animations do not run in a background tab, so anything waiting on
// animationend also needs a timer or the machine can get stuck half apart.
function afterAnimation(element: Element, fallbackMs: number, done: () => void): void {
  let finished = false;
  const run = (): void => {
    if (finished) return;
    finished = true;
    done();
  };
  element.addEventListener("animationend", run, { once: true });
  window.setTimeout(run, fallbackMs);
}

function panelIsOff(): boolean {
  return SCREW_IDS.every((id) => removedScrews.has(id));
}

function applyScrewState(animateLast: string | null): void {
  SCREW_IDS.forEach((id) => {
    const screw = document.querySelector<HTMLElement>(`.screw-${id}`);
    if (!screw) return;
    screw.classList.toggle("is-out", removedScrews.has(id) && id !== animateLast);
    if (id === animateLast) {
      screw.classList.remove("is-out");
      screw.classList.add("is-coming-out");
      afterAnimation(screw, 1000, () => {
        screw.classList.remove("is-coming-out");
        screw.classList.add("is-out");
      });
    } else {
      screw.classList.remove("is-coming-out");
    }
  });

  if (!panelIsOff()) {
    waveformFrame?.classList.remove("is-falling", "is-off");
    if (machineGuts) machineGuts.hidden = true;
    return;
  }

  const reveal = (): void => {
    waveformFrame?.classList.add("is-off");
    if (machineGuts) machineGuts.hidden = false;
  };

  if (animateLast && waveformFrame) {
    waveformFrame.classList.add("is-falling");
    afterAnimation(waveformFrame, 1200, reveal);
  } else {
    reveal();
  }
}

function useBeatOnScrew(name: string, screwId: string): void {
  if (removedScrews.has(screwId)) {
    if (statusText) statusText.textContent = "That screw is already out";
    return;
  }
  if (crackedBeats.has(name)) {
    if (statusText) statusText.textContent = `"${name}" is cracked. Save a new beat.`;
    return;
  }
  crackedBeats.add(name);
  removedScrews.add(screwId);
  persistScrewState();
  renderSaves();
  applyScrewState(screwId);
  if (statusText) {
    statusText.textContent = panelIsOff()
      ? "Every screw is out. The panel is coming off."
      : `Screw out. ${4 - removedScrews.size} to go.`;
  }
}

// A starter beat, so the vault is never empty the first time you open it.
function onlyOn(steps: number[]): boolean[] {
  return Array.from({ length: STEPS }, (_, step) => steps.includes(step));
}

const presets: SavedBeat[] = [
  {
    name: "Grandma Destroyer",
    pattern: [onlyOn([3]), onlyOn([3]), onlyOn([3]), onlyOn([3]), onlyOn([3]), onlyOn([3]), onlyOn([3])],
    tempo: "96",
    swing: "30",
  },
  {
    name: "Actual Groove",
    pattern: [onlyOn([0, 6, 8, 14]), onlyOn([4, 12]), onlyOn([0, 2, 4, 6, 8, 10, 12, 14]), onlyOn([0]), [], [], []],
    tempo: "100",
    swing: "16",
  },
];

function seedPresets(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, "yes");
  const existing = loadSaves();
  const names = new Set(existing.map((save) => save.name));
  const missing = presets.filter((preset) => !names.has(preset.name));
  if (missing.length > 0) localStorage.setItem(SAVES_KEY, JSON.stringify([...existing, ...missing]));
}

function loadSaves(): SavedBeat[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry): entry is SavedBeat =>
      typeof entry === "object" && entry !== null &&
      typeof (entry as SavedBeat).name === "string" &&
      Array.isArray((entry as SavedBeat).pattern)
    );
  } catch {
    return [];
  }
}

function writeSaves(saves: SavedBeat[]): void {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  renderSaves();
}

// Which saved beat is currently asking "are you sure?", if any.
let pendingDelete: number | null = null;

function renderSaves(): void {
  if (!vaultList || !vaultEmpty) return;
  const saves = loadSaves();
  vaultList.replaceChildren();
  vaultEmpty.hidden = saves.length > 0;

  saves.forEach((save, index) => {
    const item = document.createElement("li");
    item.className = "vault-chip";

    if (index === pendingDelete) {
      item.classList.add("is-confirming");

      const question = document.createElement("span");
      question.className = "vault-question";
      question.textContent = `Delete "${save.name}"?`;

      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "vault-yes";
      yes.textContent = "Yes";
      yes.dataset["confirm"] = String(index);

      const no = document.createElement("button");
      no.type = "button";
      no.className = "vault-no";
      no.textContent = "No";
      no.dataset["cancel"] = "";

      item.append(question, yes, no);
      vaultList.append(item);
      return;
    }

    // Names come from the player, so they are set as text rather than markup.
    const load = document.createElement("button");
    load.type = "button";
    load.className = "vault-load";
    load.textContent = save.name;
    load.dataset["load"] = String(index);
    const cracked = crackedBeats.has(save.name);
    item.classList.toggle("is-cracked", cracked);
    load.draggable = !cracked;
    load.title = cracked
      ? `"${save.name}" is cracked and cannot turn another screw`
      : `Load "${save.name}", or drag it onto a screw`;
    if (!cracked) {
      load.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", save.name);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "vault-delete";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Delete ${save.name}`);
    remove.dataset["delete"] = String(index);

    item.append(load, remove);
    vaultList.append(item);
  });
}

function saveBeat(rawName: string): void {
  const saves = loadSaves();
  const name = rawName.trim() || `Beat ${saves.length + 1}`;
  const entry: SavedBeat = {
    name,
    pattern: pattern.map((row) => [...row]),
    tempo: tempoInput?.value ?? "108",
    swing: swingInput?.value ?? "12",
  };
  // Saving under a name you already used replaces it rather than piling up.
  const existing = saves.findIndex((save) => save.name === name);
  if (existing >= 0) saves[existing] = entry;
  else saves.push(entry);
  writeSaves(saves);
  if (statusText) statusText.textContent = `Saved "${name}"`;
}

function loadBeat(index: number): void {
  const save = loadSaves()[index];
  if (!save) return;
  pattern = lanes.map((_, laneIndex) => {
    const row = save.pattern[laneIndex];
    return Array.from({ length: STEPS }, (_, step) => Boolean(row?.[step]));
  });
  if (tempoInput && save.tempo) {
    tempoInput.value = save.tempo;
    if (tempoOutput) tempoOutput.textContent = `${save.tempo} BPM`;
  }
  if (swingInput && save.swing) {
    swingInput.value = save.swing;
    if (swingOutput) swingOutput.textContent = `${save.swing}%`;
  }
  refreshSteps();
  if (statusText) statusText.textContent = `Loaded "${save.name}"`;
}

function renderGrid(): void {
  if (!sequencer || !beatNumbers) return;
  beatNumbers.innerHTML = '<span></span>' + Array.from({ length: STEPS }, (_, step) =>
    `<button class="beat-number${step % 4 === 0 ? " bar-start" : ""}" type="button" data-column="${step}" aria-label="Toggle every lane on step ${step + 1}">${step + 1}</button>`
  ).join("");

  sequencer.innerHTML = lanes.map((lane, laneIndex) => `
    <div class="lane${lane.everything ? " lane-everything" : ""}" style="--lane-color: ${lane.color}">
      <button class="lane-info" type="button" data-preview="${laneIndex}" aria-label="Preview ${lane.name}">
        ${lane.icon ? `<img class="lane-icon" src="${lane.icon}" alt="" aria-hidden="true" />` : '<span class="lane-dot" aria-hidden="true"></span>'}
        <span class="lane-text"><span class="lane-name">${lane.name}</span><span class="lane-chop">${lane.chop}</span></span>
      </button>
      ${Array.from({ length: STEPS }, (_, step) => `
        <button class="step${pattern[laneIndex]?.[step] ? " is-on" : ""}" type="button" data-lane="${laneIndex}" data-step="${step}" aria-label="${lane.name}, step ${step + 1}" aria-pressed="${pattern[laneIndex]?.[step] ? "true" : "false"}"></button>
      `).join("")}
    </div>
  `).join("");
}

// Clicking a lane name or a step number fills that whole row or column, and
// clicking again when it is already full clears it.
function toggleRow(laneIndex: number): boolean {
  const row = pattern[laneIndex];
  if (!row) return false;
  const fill = !row.every(Boolean);
  pattern[laneIndex] = row.map(() => fill);
  refreshSteps();
  if (statusText) statusText.textContent = fill ? `${lanes[laneIndex]?.name} all the way across` : `${lanes[laneIndex]?.name} cleared`;
  return fill;
}

function toggleColumn(step: number): void {
  const fill = !pattern.every((row) => row[step]);
  pattern.forEach((row) => { row[step] = fill; });
  refreshSteps();
  if (statusText) statusText.textContent = fill ? `Everything on step ${step + 1}` : `Step ${step + 1} cleared`;
}

function savePattern(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pattern));
}

function refreshSteps(): void {
  document.querySelectorAll<HTMLButtonElement>(".step").forEach((button) => {
    const lane = Number(button.dataset["lane"]);
    const step = Number(button.dataset["step"]);
    const on = Boolean(pattern[lane]?.[step]);
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
  });
  savePattern();
}

// Four lanes landing on the same step used to sum past full scale and clip,
// which is what made a busy pattern sound harsh. Everything now runs through
// one compressor so stacked hits duck instead of distorting.
function ensureMasterBus(context: AudioContext): GainNode {
  if (masterBus) return masterBus;
  const bus = context.createGain();
  bus.gain.value = 0.55;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  bus.connect(compressor).connect(context.destination);
  masterBus = bus;
  return bus;
}

async function ensureAudio(): Promise<boolean> {
  if (!audioContext) audioContext = new AudioContext();
  await audioContext.resume();
  return samples.size > 0;
}

function laneDuration(lane: Lane, sample: LoadedSample): number {
  return lane.duration ?? Math.min(0.6, sample.activeDuration + 0.05);
}

function playVoice(laneIndex: number, time: number): void {
  const lane = lanes[laneIndex];
  if (!audioContext || !lane) return;
  if (lane.everything) {
    lanes.forEach((other, index) => { if (!other.everything) playVoice(index, time); });
    return;
  }
  const sample = samples.get(lane.sample);
  if (!sample) return;
  const duration = laneDuration(lane, sample);
  const offset = Math.min(
    sample.buffer.duration - 0.03,
    lane.absoluteStart ?? sample.activeStart + lane.slicePosition * sample.activeDuration
  );
  const availableDuration = Math.max(0.03, sample.buffer.duration - offset);
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = sample.buffer;
  source.playbackRate.value = lane.playbackRate;
  filter.type = lane.filter;
  filter.frequency.value = lane.frequency;
  filter.Q.value = lane.filter === "bandpass" ? 0.8 : 0.3;
  // Hold the recording at its own level and only fade at the very end. Ramping
  // down across the whole hit flattened sustained sounds into decaying blips,
  // which is not what they sound like.
  const level = lane.gain * sample.normalization;
  const attack = 0.006;
  const release = Math.min(0.09, duration * 0.25);
  const holdUntil = Math.max(time + attack, time + duration - release);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(level, time + attack);
  gain.gain.setValueAtTime(level, holdUntil);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter).connect(gain).connect(ensureMasterBus(audioContext));
  source.start(time, offset, Math.min(duration / lane.playbackRate, availableDuration));
  source.stop(time + duration + 0.03);
}

function stepDuration(): number {
  return 60 / Number(tempoInput?.value ?? 108) / 4;
}

function scheduleStep(step: number, time: number): void {
  lanes.forEach((_, laneIndex) => {
    if (pattern[laneIndex]?.[step]) playVoice(laneIndex, time);
  });
  const delay = Math.max(0, (time - (audioContext?.currentTime ?? 0)) * 1000);
  window.setTimeout(() => showPlayhead(step), delay);
}

function scheduler(): void {
  if (!audioContext || !isPlaying) return;
  while (nextStepTime < audioContext.currentTime + 0.1) {
    scheduleStep(currentStep, nextStepTime);
    const swing = Number(swingInput?.value ?? 0) / 100;
    const duration = stepDuration();
    nextStepTime += duration * (currentStep % 2 === 0 ? 1 + swing : 1 - swing);
    currentStep = (currentStep + 1) % STEPS;
  }
  schedulerTimer = window.setTimeout(scheduler, 25);
}

function showPlayhead(step: number): void {
  document.querySelectorAll(".step.is-current").forEach((element) => element.classList.remove("is-current"));
  if (!isPlaying) return;
  document.querySelectorAll<HTMLElement>(`.step[data-step="${step}"]`).forEach((element) => element.classList.add("is-current"));
}

async function togglePlayback(): Promise<void> {
  if (!(await ensureAudio()) || !audioContext) return;
  isPlaying = !isPlaying;
  playButton?.classList.toggle("is-playing", isPlaying);
  if (playLabel) playLabel.textContent = isPlaying ? "Stop beat" : "Play beat";
  if (playIcon) playIcon.textContent = isPlaying ? "■" : "▶";
  if (statusText) statusText.textContent = isPlaying ? "Cooking a dangerous little beat" : "Your voice kit is armed";
  if (isPlaying) {
    currentStep = 0;
    nextStepTime = audioContext.currentTime + 0.06;
    scheduler();
  } else {
    window.clearTimeout(schedulerTimer);
    document.querySelectorAll(".step.is-current").forEach((element) => element.classList.remove("is-current"));
  }
}

function randomize(): void {
  // Downbeats are likely, never guaranteed, so no square lights up every roll.
  pattern = lanes.map((_, laneIndex) => Array.from({ length: STEPS }, (_, step) => {
    // A crash is a punctuation mark, so it only ever wants the top of the bar.
    if (laneIndex === 3) return step === 0 && Math.random() < 0.7;
    // The drop is the biggest gesture in the kit, so it stays rare.
    if (laneIndex === 4) return step === 0 && Math.random() < 0.35;
    if (laneIndex === 5) return (step === 0 || step === 8) && Math.random() < 0.3;
    if (laneIndex === 6) return Math.random() < (step % 4 === 2 ? 0.5 : 0.12);
    if (laneIndex === 7) return step === 0 && Math.random() < 0.2;
    const onBeat = laneIndex === 0 ? step % 4 === 0 : laneIndex === 1 ? step % 8 === 4 : step % 2 === 0;
    return Math.random() < (onBeat ? 0.8 : 0.14);
  }));
  refreshSteps();
  if (statusText) statusText.textContent = "The dice have spoken";
}

function fillPattern(): void {
  pattern = lanes.map(() => Array(STEPS).fill(true) as boolean[]);
  refreshSteps();
  if (statusText) statusText.textContent = "Every square. Good luck.";
}

function clearPattern(): void {
  pattern = lanes.map(() => Array(STEPS).fill(false) as boolean[]);
  refreshSteps();
  if (statusText) statusText.textContent = "Fresh empty beat. Make noise.";
}

function drawWaveform(): void {
  if (!waveform) return;
  const context = waveform.getContext("2d");
  if (!context) return;
  const { width, height } = waveform;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#17131f";
  context.fillRect(0, 0, width, height);

  // Each recording gets its own slice of the strip, tinted like the lane that uses it.
  const drawn = lanes.filter((lane) => !lane.everything && samples.has(lane.sample));
  const laneWidth = width / Math.max(1, drawn.length);
  drawn.forEach((lane, index) => {
    const sample = samples.get(lane.sample);
    if (!sample) return;
    const data = sample.buffer.getChannelData(0);
    const left = index * laneWidth;
    context.fillStyle = lane.color;
    const samplesPerPixel = Math.max(1, Math.floor(data.length / laneWidth));
    for (let x = 0; x < laneWidth; x += 1) {
      let peak = 0;
      const start = Math.floor(x * samplesPerPixel);
      for (let i = start; i < start + samplesPerPixel && i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i] ?? 0));
      const barHeight = Math.max(2, peak * height * 0.9);
      context.fillRect(left + x, (height - barHeight) / 2, 2, barHeight);
    }
  });
}

function analyzeSample(buffer: AudioBuffer): LoadedSample {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // A raw sample threshold treats breath and room tone as "sound", which left
  // a long dead gap on each side of the hit. Walk a short-window energy
  // envelope instead and keep only the loud core of the recording.
  const window = Math.max(1, Math.floor(sampleRate * 0.005));
  const energy: number[] = [];
  for (let i = 0; i + window <= data.length; i += window) {
    let sum = 0;
    for (let j = i; j < i + window; j += 1) sum += (data[j] ?? 0) ** 2;
    energy.push(Math.sqrt(sum / window));
  }

  const loudest = energy.reduce((max, value) => Math.max(max, value), 0);
  const threshold = loudest * 0.25;
  let first = 0;
  let last = energy.length - 1;
  while (first < energy.length && (energy[first] ?? 0) < threshold) first += 1;
  while (last > first && (energy[last] ?? 0) < threshold) last -= 1;

  // Nothing crossed the threshold, so fall back to the whole recording.
  if (first >= energy.length) {
    first = 0;
    last = Math.max(0, energy.length - 1);
  }

  // A hair of lead-in keeps the attack from clicking; a longer tail lets the
  // sound decay naturally instead of being chopped mid-ring.
  const leadIn = Math.floor(sampleRate * 0.008);
  const tail = Math.floor(sampleRate * 0.04);
  const startSample = Math.max(0, first * window - leadIn);
  const endSample = Math.min(data.length - 1, last * window + tail);

  let corePeak = 0;
  for (let i = startSample; i <= endSample; i += 1) corePeak = Math.max(corePeak, Math.abs(data[i] ?? 0));

  return {
    buffer,
    activeStart: startSample / sampleRate,
    activeDuration: Math.max(0.05, (endSample - startSample) / sampleRate),
    normalization: Math.min(4, 0.7 / Math.max(corePeak, 0.01)),
  };
}

async function loadVoices(): Promise<void> {
  audioContext = new AudioContext();
  const ids = Object.keys(sampleUrls) as SampleId[];
  const results = await Promise.allSettled(ids.map(async (id) => {
    const response = await fetch(sampleUrls[id]);
    if (!response.ok) throw new Error(`Audio request failed for ${id}: ${response.status}`);
    if (!audioContext) throw new Error("Audio context went away");
    samples.set(id, analyzeSample(await audioContext.decodeAudioData(await response.arrayBuffer())));
  }));

  results.forEach((result) => {
    if (result.status === "rejected") console.error(result.reason);
  });

  drawWaveform();
  if (samples.size === 0) {
    if (statusText) statusText.textContent = "Voice memos refused to load. Try refresh.";
    return;
  }
  if (playButton) playButton.disabled = false;
  if (statusText) {
    statusText.textContent = samples.size === ids.length
      ? "Your voice kit is armed"
      : "Partly armed — one memo did not load";
  }
}

sequencer?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
  if (!target) return;
  if (target.dataset["preview"] !== undefined) {
    const laneIndex = Number(target.dataset["preview"]);
    const filled = toggleRow(laneIndex);
    if (filled) void ensureAudio().then((ready) => { if (ready && audioContext) playVoice(laneIndex, audioContext.currentTime); });
    return;
  }
  if (target.dataset["lane"] === undefined || target.dataset["step"] === undefined) return;
  const lane = Number(target.dataset["lane"]);
  const step = Number(target.dataset["step"]);
  if (!pattern[lane]) return;
  pattern[lane][step] = !pattern[lane][step];
  refreshSteps();
  if (pattern[lane][step]) void ensureAudio().then((ready) => { if (ready && audioContext) playVoice(lane, audioContext.currentTime); });
});

beatNumbers?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-column]") : null;
  if (!target) return;
  toggleColumn(Number(target.dataset["column"]));
});

SCREW_IDS.forEach((id) => {
  const screw = document.querySelector<HTMLElement>(`.screw-${id}`);
  if (!screw) return;
  screw.addEventListener("dragover", (event) => {
    if (removedScrews.has(id)) return;
    event.preventDefault();
    screw.classList.add("is-target");
  });
  screw.addEventListener("dragleave", () => screw.classList.remove("is-target"));
  screw.addEventListener("drop", (event) => {
    event.preventDefault();
    screw.classList.remove("is-target");
    const name = event.dataTransfer?.getData("text/plain");
    if (name) useBeatOnScrew(name, id);
  });
});

document.querySelector<HTMLButtonElement>("#guts-enter")?.addEventListener("click", () => {
  window.location.href = "../holdens-game/index.html";
});

gutsReset?.addEventListener("click", () => {
  removedScrews = new Set();
  persistScrewState();
  applyScrewState(null);
  if (statusText) statusText.textContent = "Panel back on. Screws need fresh beats.";
});

saveForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveBeat(saveName?.value ?? "");
  if (saveName) saveName.value = "";
});

vaultList?.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
  if (!target) return;
  if (target.dataset["load"] !== undefined) {
    pendingDelete = null;
    loadBeat(Number(target.dataset["load"]));
    renderSaves();
    return;
  }
  if (target.dataset["cancel"] !== undefined) {
    pendingDelete = null;
    renderSaves();
    return;
  }
  if (target.dataset["delete"] !== undefined) {
    pendingDelete = Number(target.dataset["delete"]);
    renderSaves();
    return;
  }
  if (target.dataset["confirm"] === undefined) return;
  const saves = loadSaves();
  const [removed] = saves.splice(Number(target.dataset["confirm"]), 1);
  pendingDelete = null;
  writeSaves(saves);
  if (statusText && removed) statusText.textContent = `Deleted "${removed.name}"`;
});

playButton?.addEventListener("click", () => void togglePlayback());
randomButton?.addEventListener("click", randomize);
clearButton?.addEventListener("click", clearPattern);
fillButton?.addEventListener("click", fillPattern);
tempoInput?.addEventListener("input", () => { if (tempoOutput) tempoOutput.textContent = `${tempoInput.value} BPM`; });
swingInput?.addEventListener("input", () => { if (swingOutput) swingOutput.textContent = `${swingInput.value}%`; });

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "Escape" && pendingDelete !== null) { pendingDelete = null; renderSaves(); return; }
  if (event.code === "Space") { event.preventDefault(); void togglePlayback(); }
  else if (event.key.toLowerCase() === "r") randomize();
  else if (event.key.toLowerCase() === "c") clearPattern();
  else if (event.key.toLowerCase() === "f") fillPattern();
});

window.addEventListener("pagehide", () => {
  window.clearTimeout(schedulerTimer);
  void audioContext?.close();
});

renderGrid();
seedPresets();
renderSaves();
applyScrewState(null);
void loadVoices();
