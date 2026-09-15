import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { LETTER_MS, VOICES, speakLetter } from "./babble";

installOofShortcut();
installForceRefreshHotkey();

// The Simulation. It opens on a blank screen with two people you can't see
// talking about you. Their words type out as they say them, in made-up
// sound-effect voices (babble.ts). When they're done, the simulation starts
// (what happens after that hasn't been decided yet). Its steel card with the
// calculator title is on the Games 5 hub (simulationCard.ts).

interface Line {
  speaker: 0 | 1;
  text: string;
}

const LINES: Line[] = [
  { speaker: 0, text: "Are you sure they'll be good enough?" },
  { speaker: 1, text: "Yeah, they'll do good, I think." },
  { speaker: 0, text: 'Fine, start "The Simulation".' },
];

// Their words are different colors, so you can tell who's talking without seeing them.
const SPEAKER_COLORS = ["#f5efe6", "#9fd4ff"];

const BLANK_BEFORE_MS = 1800;
// How long a line stays up after it's been said.
const HOLD_MS = 1400;
const GAP_MS = 600;
const FADE_MS = 400;
// Commas get a little breath.
const PAUSE_MS: Record<string, number> = { ",": 220 };

const TEXT_FONT = "30px 'Trebuchet MS', sans-serif";

type Phase = "waiting" | "talking";

interface Subtitle {
  line: Line;
  // How many letters have been said so far.
  said: number;
  hiddenAt: number;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const W = canvas.width;
const H = canvas.height;
// The same words, for screen readers.
const caption = document.getElementById("caption");

let phase: Phase = "waiting";
let subtitle: Subtitle | null = null;
let audio: AudioContext | null = null;
let voiceOut: AudioNode | null = null;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

function startAudio(): void {
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  audio = new AudioContextClass();
  const volume = audio.createGain();
  volume.gain.value = 0.6;
  // Keeps the buzzes from crackling when they pile up.
  const limiter = audio.createDynamicsCompressor();
  volume.connect(limiter).connect(audio.destination);
  voiceOut = volume;
  void audio.resume().catch(() => {});
}

// Real voices go up at the end of a question and down at the end of a sentence.
function bendAt(text: string, index: number): number {
  const nearTheEnd = Math.max(0, (index / text.length - 0.7) / 0.3);
  return text.trimEnd().endsWith("?") ? nearTheEnd : -0.5 * nearTheEnd;
}

async function sayLine(line: Line): Promise<void> {
  const current: Subtitle = { line, said: 0, hiddenAt: Infinity };
  subtitle = current;
  if (caption) caption.textContent = line.text;
  const voice = VOICES[line.speaker] ?? VOICES[0];

  for (let i = 0; i < line.text.length; i += 1) {
    const letter = line.text[i] ?? "";
    current.said = i + 1;
    if (audio && voiceOut && voice) speakLetter(audio, voiceOut, letter, voice, audio.currentTime, bendAt(line.text, i));
    await sleep(PAUSE_MS[letter] ?? LETTER_MS);
  }

  await sleep(HOLD_MS);
  current.hiddenAt = performance.now();
  await sleep(FADE_MS);
  subtitle = null;
}

async function runIntro(): Promise<void> {
  await sleep(BLANK_BEFORE_MS);
  for (const line of LINES) {
    await sayLine(line);
    await sleep(GAP_MS);
  }
  if (caption) caption.textContent = "";
}

// Browsers only let a page make sound after you've clicked or pressed a key.
function start(): void {
  if (phase !== "waiting") return;
  phase = "talking";
  startAudio();
  void runIntro();
}

canvas.addEventListener("pointerdown", start);
window.addEventListener("keydown", (event) => {
  // Enter or Space on a button (like Full screen) is for that button.
  if (event.target instanceof HTMLButtonElement) return;
  if (event.key === "Enter" || event.key === " ") start();
});
window.addEventListener("pagehide", () => void audio?.close().catch(() => {}));

// Full screen makes the black screen fill the whole monitor. Esc gets out.
const frame = document.querySelector<HTMLElement>(".game-frame");
const fullscreenButton = document.getElementById("fullscreen");
if (frame && fullscreenButton instanceof HTMLButtonElement) {
  if (!document.fullscreenEnabled) {
    // Some browsers (like on iPhones) can't do it, so there's no button.
    fullscreenButton.hidden = true;
  } else {
    fullscreenButton.addEventListener("click", () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
        return;
      }
      // Some places say no, and some (like the Claude app's browser pane) never
      // answer at all. Either way the button tells you, instead of just doing nothing.
      const notAllowed = (): void => {
        if (document.fullscreenElement) return;
        fullscreenButton.textContent = "Full screen isn't allowed here";
        window.setTimeout(() => {
          if (!document.fullscreenElement) fullscreenButton.textContent = "⛶ Full screen";
        }, 2500);
      };
      frame.requestFullscreen().catch(notAllowed);
      window.setTimeout(notAllowed, 1000);
    });
    document.addEventListener("fullscreenchange", () => {
      fullscreenButton.textContent = document.fullscreenElement ? "Exit full screen" : "⛶ Full screen";
    });
  }
}

function draw(now: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  if (phase === "waiting") {
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 500);
    ctx.fillStyle = "#f5efe6";
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("click to start", W / 2, H / 2);
    ctx.globalAlpha = 1;
  }

  if (subtitle) {
    ctx.globalAlpha = 1 - Math.min(1, Math.max(0, now - subtitle.hiddenAt) / FADE_MS);
    ctx.fillStyle = SPEAKER_COLORS[subtitle.line.speaker] ?? "#f5efe6";
    ctx.font = TEXT_FONT;
    // Lined up as if the whole line were already there, so the words don't
    // slide sideways while they type out.
    const left = W / 2 - ctx.measureText(subtitle.line.text).width / 2;
    ctx.textAlign = "left";
    ctx.fillText(subtitle.line.text.slice(0, subtitle.said), left, H / 2);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
