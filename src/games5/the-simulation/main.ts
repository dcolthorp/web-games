import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// The Simulation. It opens on a blank screen with two people you can't see
// talking about you. When they're done, the simulation starts (what happens
// after that hasn't been decided yet). Its steel card with the calculator title
// is on the Games 5 hub (simulationCard.ts).

interface Line {
  speaker: 0 | 1;
  text: string;
}

const LINES: Line[] = [
  { speaker: 0, text: "Are you sure they'll be good enough?" },
  { speaker: 1, text: "Yeah, they'll do good, I think." },
  { speaker: 0, text: 'Fine, start "The Simulation".' },
];

// The two people sound different and their words are different colors, so you
// can tell who's talking without seeing them.
const SPEAKER_COLORS = ["#f5efe6", "#9fd4ff"];
const SPEAKER_PITCH = [0.8, 1.25];

const BLANK_BEFORE_MS = 1800;
const GAP_MS = 700;
const FADE_MS = 400;

type Phase = "waiting" | "talking" | "started";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const W = canvas.width;
const H = canvas.height;
// The same words, for screen readers.
const caption = document.getElementById("caption");

let phase: Phase = "waiting";
let subtitle: { line: Line; shownAt: number; hiddenAt: number } | null = null;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

// Two different voices if the computer has them, English if it can.
function pickVoices(): (SpeechSynthesisVoice | null)[] {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const english = voices.filter((voice) => voice.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;
  const first = pool[0] ?? null;
  const second = pool.find((voice) => voice !== first) ?? first;
  return [first, second];
}

// Says the line out loud, and waits until it's been said and there's been
// enough time to read it. With no voice, or a browser that never says the
// speech finished, it still moves on.
function say(line: Line): Promise<void> {
  const readTime = sleep(60 * line.text.length + 1200);
  const synth = window.speechSynthesis;
  if (!synth) return readTime;

  const spoken = new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(line.text);
    const voice = pickVoices()[line.speaker];
    if (voice) utterance.voice = voice;
    utterance.pitch = SPEAKER_PITCH[line.speaker] ?? 1;
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
  const giveUp = sleep(90 * line.text.length + 2500);
  return Promise.all([readTime, Promise.race([spoken, giveUp])]).then(() => undefined);
}

async function runIntro(): Promise<void> {
  phase = "talking";
  await sleep(BLANK_BEFORE_MS);
  for (const line of LINES) {
    subtitle = { line, shownAt: performance.now(), hiddenAt: Infinity };
    if (caption) caption.textContent = line.text;
    await say(line);
    subtitle.hiddenAt = performance.now();
    await sleep(FADE_MS);
    subtitle = null;
    await sleep(GAP_MS);
  }
  if (caption) caption.textContent = "";
  phase = "started";
}

// Browsers only let a page talk after you've clicked or pressed a key.
function start(): void {
  if (phase !== "waiting") return;
  void runIntro();
}

canvas.addEventListener("pointerdown", start);
window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") start();
});
window.addEventListener("pagehide", () => window.speechSynthesis?.cancel());

function draw(now: number): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (phase === "waiting") {
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(now / 500);
    ctx.fillStyle = "#f5efe6";
    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.fillText("click to start", W / 2, H / 2);
    ctx.globalAlpha = 1;
  }

  if (subtitle) {
    const fadeIn = Math.min(1, (now - subtitle.shownAt) / FADE_MS);
    const fadeOut = 1 - Math.min(1, Math.max(0, now - subtitle.hiddenAt) / FADE_MS);
    ctx.globalAlpha = Math.min(fadeIn, fadeOut);
    ctx.fillStyle = SPEAKER_COLORS[subtitle.line.speaker] ?? "#f5efe6";
    ctx.font = "30px 'Trebuchet MS', sans-serif";
    ctx.fillText(subtitle.line.text, W / 2, H / 2);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
