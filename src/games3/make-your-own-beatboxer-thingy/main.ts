import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import kickUrl from "./assets/oscars-voice.m4a?url";
import snareUrl from "./assets/oscars-snare.m4a?url";
import hihatUrl from "./assets/oscars-hihat.m4a?url";

installOofShortcut();
installForceRefreshHotkey();

const STEPS = 16;
const STORAGE_KEY = "make-your-own-beatboxer-thingy-pattern-v4";

type SampleId = "kick" | "snare" | "hihat";

const sampleUrls: Record<SampleId, string> = {
  kick: kickUrl,
  snare: snareUrl,
  hihat: hihatUrl,
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
  // Left undefined, the lane rings out for as long as its recording is loud.
  duration?: number;
  playbackRate: number;
  filter: BiquadFilterType;
  frequency: number;
  gain: number;
}

const lanes: Lane[] = [
  { name: "Big Mouth Kick", chop: "low + thumpy", color: "#f9d648", sample: "kick", slicePosition: 0, duration: 0.24, playbackRate: 0.58, filter: "lowpass", frequency: 1100, gain: 1.25 },
  { name: "Snare", chop: "straight off the tape", color: "#ff657b", sample: "snare", slicePosition: 0, duration: 0.4, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.2 },
  { name: "Hi-Hat", chop: "hi-hat hopes", color: "#61d6ff", sample: "hihat", slicePosition: 0, duration: 0.2, playbackRate: 1, filter: "allpass", frequency: 1000, gain: 1.15 },
];

const defaultPattern = [
  [true, false, false, false, false, false, false, false, true, false, false, true, false, false, false, false],
  [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
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
const waveform = document.querySelector<HTMLCanvasElement>("#waveform");

function renderGrid(): void {
  if (!sequencer || !beatNumbers) return;
  beatNumbers.innerHTML = '<span></span>' + Array.from({ length: STEPS }, (_, step) =>
    `<span class="beat-number${step % 4 === 0 ? " bar-start" : ""}">${step + 1}</span>`
  ).join("");

  sequencer.innerHTML = lanes.map((lane, laneIndex) => `
    <div class="lane" style="--lane-color: ${lane.color}">
      <button class="lane-info" type="button" data-preview="${laneIndex}" aria-label="Preview ${lane.name}">
        <span class="lane-dot" aria-hidden="true"></span>
        <span class="lane-text"><span class="lane-name">${lane.name}</span><span class="lane-chop">${lane.chop}</span></span>
      </button>
      ${Array.from({ length: STEPS }, (_, step) => `
        <button class="step${pattern[laneIndex]?.[step] ? " is-on" : ""}" type="button" data-lane="${laneIndex}" data-step="${step}" aria-label="${lane.name}, step ${step + 1}" aria-pressed="${pattern[laneIndex]?.[step] ? "true" : "false"}"></button>
      `).join("")}
    </div>
  `).join("");
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
  const sample = samples.get(lane.sample);
  if (!sample) return;
  const duration = laneDuration(lane, sample);
  const offset = Math.min(
    sample.buffer.duration - 0.03,
    sample.activeStart + lane.slicePosition * sample.activeDuration
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
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(lane.gain * sample.normalization, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  source.connect(filter).connect(gain).connect(audioContext.destination);
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
    const onBeat = laneIndex === 0 ? step % 4 === 0 : laneIndex === 1 ? step % 8 === 4 : step % 2 === 0;
    return Math.random() < (onBeat ? 0.8 : 0.14);
  }));
  refreshSteps();
  if (statusText) statusText.textContent = "The dice have spoken";
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
  const drawn = lanes.filter((lane) => samples.has(lane.sample));
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
    normalization: Math.min(5, 0.82 / Math.max(corePeak, 0.01)),
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
    void ensureAudio().then((ready) => { if (ready && audioContext) playVoice(Number(target.dataset["preview"]), audioContext.currentTime); });
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

playButton?.addEventListener("click", () => void togglePlayback());
randomButton?.addEventListener("click", randomize);
clearButton?.addEventListener("click", clearPattern);
tempoInput?.addEventListener("input", () => { if (tempoOutput) tempoOutput.textContent = `${tempoInput.value} BPM`; });
swingInput?.addEventListener("input", () => { if (swingOutput) swingOutput.textContent = `${swingInput.value}%`; });

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space") { event.preventDefault(); void togglePlayback(); }
  else if (event.key.toLowerCase() === "r") randomize();
  else if (event.key.toLowerCase() === "c") clearPattern();
});

window.addEventListener("pagehide", () => {
  window.clearTimeout(schedulerTimer);
  void audioContext?.close();
});

renderGrid();
void loadVoices();
