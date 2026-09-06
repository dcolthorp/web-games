import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import voiceUrl from "./assets/oscars-voice.m4a?url";

installOofShortcut();
installForceRefreshHotkey();

const STEPS = 16;
const STORAGE_KEY = "make-your-own-beatboxer-thingy-pattern-v2";

interface Lane {
  name: string;
  chop: string;
  color: string;
  slicePosition: number;
  duration: number;
  playbackRate: number;
  filter: BiquadFilterType;
  frequency: number;
  gain: number;
}

const lanes: Lane[] = [
  { name: "Big Mouth Kick", chop: "low + thumpy", color: "#f9d648", slicePosition: 0, duration: 0.24, playbackRate: 0.58, filter: "lowpass", frequency: 1100, gain: 1.25 },
  { name: "Mouth Slap", chop: "snappy middle", color: "#ff657b", slicePosition: 0.18, duration: 0.18, playbackRate: 1.05, filter: "bandpass", frequency: 1900, gain: 1.2 },
  { name: "Teeth Tick", chop: "tiny + crispy", color: "#61d6ff", slicePosition: 0.42, duration: 0.1, playbackRate: 1.65, filter: "highpass", frequency: 3000, gain: 1.1 },
  { name: "Voice Goblin", chop: "the weird bit", color: "#8ae66e", slicePosition: 0.04, duration: 0.42, playbackRate: 0.9, filter: "allpass", frequency: 1000, gain: 1.1 },
];

const defaultPattern = [
  [true, false, false, false, true, false, false, false, true, false, false, true, true, false, false, false],
  [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
  [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, true],
  [false, false, false, false, false, false, false, true, false, false, false, false, false, false, true, false],
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
let voiceBuffer: AudioBuffer | null = null;
let activeStart = 0;
let activeDuration = 0.5;
let voiceNormalization = 1;
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
  return voiceBuffer !== null;
}

function playVoice(laneIndex: number, time: number): void {
  const lane = lanes[laneIndex];
  if (!audioContext || !voiceBuffer || !lane) return;
  const offset = Math.min(
    voiceBuffer.duration - 0.03,
    activeStart + lane.slicePosition * activeDuration
  );
  const availableDuration = Math.max(0.03, voiceBuffer.duration - offset);
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  source.buffer = voiceBuffer;
  source.playbackRate.value = lane.playbackRate;
  filter.type = lane.filter;
  filter.frequency.value = lane.frequency;
  filter.Q.value = lane.filter === "bandpass" ? 0.8 : 0.3;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(lane.gain * voiceNormalization, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + lane.duration);
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start(time, offset, Math.min(lane.duration / lane.playbackRate, availableDuration));
  source.stop(time + lane.duration + 0.03);
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
  pattern = lanes.map((_, laneIndex) => Array.from({ length: STEPS }, (_, step) => {
    if (laneIndex === 0) return step % 4 === 0 || Math.random() < 0.12;
    if (laneIndex === 1) return step % 8 === 4 || Math.random() < 0.1;
    return Math.random() < (laneIndex === 2 ? 0.28 : 0.13);
  }));
  refreshSteps();
  if (statusText) statusText.textContent = "The dice have spoken";
}

function clearPattern(): void {
  pattern = lanes.map(() => Array(STEPS).fill(false) as boolean[]);
  refreshSteps();
  if (statusText) statusText.textContent = "Fresh empty beat. Make noise.";
}

function drawWaveform(buffer: AudioBuffer): void {
  if (!waveform) return;
  const context = waveform.getContext("2d");
  if (!context) return;
  const data = buffer.getChannelData(0);
  const { width, height } = waveform;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#17131f";
  context.fillRect(0, 0, width, height);
  const gradient = context.createLinearGradient(0, 0, width, 0);
  lanes.forEach((lane, index) => gradient.addColorStop(index / (lanes.length - 1), lane.color));
  context.fillStyle = gradient;
  const samplesPerPixel = Math.max(1, Math.floor(data.length / width));
  for (let x = 0; x < width; x += 1) {
    let peak = 0;
    const start = x * samplesPerPixel;
    for (let index = start; index < start + samplesPerPixel && index < data.length; index += 1) peak = Math.max(peak, Math.abs(data[index] ?? 0));
    const barHeight = Math.max(2, peak * height * 0.9);
    context.fillRect(x, (height - barHeight) / 2, 2, barHeight);
  }
}

function analyzeVoice(buffer: AudioBuffer): void {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));

  // Voice Memos often leaves a long quiet lead-in. Find the actual sound so
  // every instrument slices the voice rather than the silence before it.
  const threshold = Math.max(0.008, peak * 0.08);
  let firstActive = 0;
  let lastActive = data.length - 1;
  while (firstActive < data.length && Math.abs(data[firstActive] ?? 0) < threshold) firstActive += 1;
  while (lastActive > firstActive && Math.abs(data[lastActive] ?? 0) < threshold) lastActive -= 1;
  const padding = Math.floor(buffer.sampleRate * 0.015);
  firstActive = Math.max(0, firstActive - padding);
  lastActive = Math.min(data.length - 1, lastActive + padding);
  activeStart = firstActive / buffer.sampleRate;
  activeDuration = Math.max(0.08, (lastActive - firstActive) / buffer.sampleRate);
  voiceNormalization = Math.min(5, 0.82 / Math.max(peak, 0.01));
}

async function loadVoice(): Promise<void> {
  try {
    audioContext = new AudioContext();
    const response = await fetch(voiceUrl);
    if (!response.ok) throw new Error(`Audio request failed: ${response.status}`);
    voiceBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    analyzeVoice(voiceBuffer);
    drawWaveform(voiceBuffer);
    if (playButton) playButton.disabled = false;
    if (statusText) statusText.textContent = "Your voice kit is armed";
  } catch (error) {
    console.error(error);
    if (statusText) statusText.textContent = "Voice memo refused to load. Try refresh.";
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
void loadVoice();
