import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { LETTER_MS, VOICES, speakLetter } from "./babble";

installOofShortcut();
installForceRefreshHotkey();

// The Simulation. It opens on a blank screen with two people you can't see
// talking about you. Their words type out as they say them, in made-up
// sound-effect voices (babble.ts). When they're done, the screen turns on like
// an old TV (what shows up on it hasn't been decided yet). Its steel card with the
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

// Turning the screen on: a dot stretches into a line, the line opens up into a
// white flash, and the flash settles into the glowing screen.
const BEFORE_ON_MS = 900;
const LINE_MS = 180;
const OPEN_MS = 420;
const SETTLE_MS = 900;

// What drops in once the screen is on, one letter at a time, each hanging from
// its own rope.
const TITLE_ROWS = [
  { text: "THE SIMULATION", font: "bold 64px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", size: 64, rest: 240 },
  { text: "666", font: "bold 78px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", size: 78, rest: 395 },
];
const LETTER_GAP = 5;
// The wait after the screen is on, and between one letter and the next.
const FIRST_DROP_MS = 700;
const DROP_GAP_MS = 170;
const FALL_SPEED = 2600;
// How much of its speed a letter keeps when the rope catches it.
const ROPE_BOUNCE = 0.42;
// How far a hanging letter drifts up and back down. The rope means it never
// goes below where it was caught.
const BOB = 7;

// The START button drops in after the last letter has landed, hanging from two
// ropes, one at each end, so it hangs level instead of spinning on one.
const START_BUTTON = { width: 260, height: 78, rest: 505, label: "START" };
const BUTTON_AFTER_LAST_MS = 2000;
const BUTTON_ROPE_INSET = 22;
const PRESS_MS = 140;

type Phase = "waiting" | "talking" | "on";

interface Hanging {
  letter: string;
  font: string;
  size: number;
  x: number;
  // Where the rope stops it.
  rest: number;
  y: number;
  falling: number;
  dropAt: number;
  hung: boolean;
  // So they don't all bob together.
  bobFrom: number;
}

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
let onAt = 0;
let hanging: Hanging[] = [];
let startButton = newStartButton();
let lastFrame = performance.now();
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
  await sleep(BEFORE_ON_MS);
  turnOn();
}

// "Fine, start The Simulation." The screen turns on.
function turnOn(): void {
  phase = "on";
  onAt = performance.now();
  layOutTitle();
  if (caption) caption.textContent = "The screen turns on.";
  playTurnOnSound();
}

// A click, then an electric hum that swells up and fades, like an old TV.
function playTurnOnSound(): void {
  if (!audio || !voiceOut) return;
  const now = audio.currentTime;

  const noise = audio.createBuffer(1, Math.round(audio.sampleRate * 0.05), audio.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const click = audio.createBufferSource();
  click.buffer = noise;
  const snap = audio.createBiquadFilter();
  snap.type = "bandpass";
  snap.frequency.value = 2200;
  const clickLevel = audio.createGain();
  clickLevel.gain.setValueAtTime(0.8, now);
  clickLevel.gain.linearRampToValueAtTime(0, now + 0.05);
  click.connect(snap).connect(clickLevel).connect(voiceOut);
  click.start(now);

  const hum = audio.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.setValueAtTime(45, now);
  hum.frequency.exponentialRampToValueAtTime(120, now + 0.5);
  const soften = audio.createBiquadFilter();
  soften.type = "lowpass";
  soften.frequency.setValueAtTime(300, now);
  soften.frequency.exponentialRampToValueAtTime(1800, now + 0.4);
  soften.frequency.exponentialRampToValueAtTime(400, now + 1.6);
  const humLevel = audio.createGain();
  humLevel.gain.setValueAtTime(0, now);
  humLevel.gain.linearRampToValueAtTime(0.35, now + 0.35);
  humLevel.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  hum.connect(soften).connect(humLevel).connect(voiceOut);
  hum.start(now);
  hum.stop(now + 1.9);
}

const easeOut = (t: number): number => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function drawScreenOn(now: number): void {
  const t = now - onAt;

  // A dot in the middle stretching into a bright line...
  if (t < LINE_MS) {
    const width = Math.max(4, W * easeOut(t / LINE_MS));
    ctx.shadowColor = "#dff1ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(W / 2 - width / 2, H / 2 - 2, width, 4);
    ctx.shadowBlur = 0;
    return;
  }

  // ...that opens up and down into a white flash...
  if (t < OPEN_MS) {
    const height = Math.max(4, H * easeOut((t - LINE_MS) / (OPEN_MS - LINE_MS)));
    ctx.fillStyle = "#f4f9ff";
    ctx.fillRect(0, H / 2 - height / 2, W, height);
    return;
  }

  // ...that settles down into the glowing screen.
  drawGlowingScreen(now);
  const flash = 1 - Math.min(1, (t - OPEN_MS) / SETTLE_MS);
  if (flash > 0) {
    ctx.fillStyle = `rgba(244, 249, 255, ${flash ** 2})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// The screen once it's on: brightest in the middle, darker at the edges, with
// faint lines across it and a little flicker, like an old TV with nothing on.
function drawGlowingScreen(now: number): void {
  const glow = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.65);
  glow.addColorStop(0, "#2d3d4b");
  glow.addColorStop(0.6, "#15202a");
  glow.addColorStop(1, "#05080c");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

  ctx.fillStyle = `rgba(200, 225, 255, ${0.015 + 0.02 * Math.random() + 0.01 * Math.sin(now / 90)})`;
  ctx.fillRect(0, 0, W, H);
}

// Works out where every letter hangs, and when its turn to drop is.
function layOutTitle(): void {
  hanging = [];
  startButton = newStartButton();
  let order = 0;
  for (const row of TITLE_ROWS) {
    ctx.font = row.font;
    const widths = [...row.text].map((letter) => ctx.measureText(letter).width);
    const rowWidth = widths.reduce((total, width) => total + width + LETTER_GAP, -LETTER_GAP);
    let x = W / 2 - rowWidth / 2;
    [...row.text].forEach((letter, i) => {
      const width = widths[i] ?? 0;
      if (letter !== " ") {
        hanging.push({
          letter,
          font: row.font,
          size: row.size,
          x: x + width / 2,
          rest: row.rest,
          // Starts above the screen, out of sight.
          y: -row.size,
          falling: 0,
          dropAt: FIRST_DROP_MS + order * DROP_GAP_MS,
          hung: false,
          bobFrom: Math.random() * 1000,
        });
        order += 1;
      }
      x += width + LETTER_GAP;
    });
  }
}

function updateTitle(now: number, dt: number): void {
  const since = now - onAt;
  for (const letter of hanging) {
    if (letter.hung || since < letter.dropAt) continue;
    letter.falling += FALL_SPEED * dt;
    letter.y += letter.falling * dt;
    if (letter.y < letter.rest) continue;
    // The rope goes tight.
    letter.y = letter.rest;
    if (Math.abs(letter.falling) > 260) {
      letter.falling = -letter.falling * ROPE_BOUNCE;
    } else {
      letter.falling = 0;
      letter.hung = true;
      playThunk(letter.size > 70 ? 70 : 95);
      if (hanging.every((other) => other.hung)) {
        if (caption) caption.textContent = `${TITLE_ROWS.map((row) => row.text).join(" ")} · START`;
        startButton.dropAt = now - onAt + BUTTON_AFTER_LAST_MS;
      }
    }
  }
}

// Where a letter is right now: falling, or hanging and bobbing gently.
function letterY(letter: Hanging, now: number): number {
  if (!letter.hung) return letter.y;
  return letter.rest - BOB * (0.5 + 0.5 * Math.sin((now - letter.bobFrom) / 520));
}

function drawTitle(now: number): void {
  const since = now - onAt;
  const shown = hanging.filter((letter) => since >= letter.dropAt);

  // Ropes first, so the letters hang in front of them.
  ctx.strokeStyle = "#6f6450";
  ctx.lineWidth = 3;
  for (const letter of shown) {
    ctx.beginPath();
    ctx.moveTo(letter.x, 0);
    ctx.lineTo(letter.x, letterY(letter, now) - letter.size * 0.44);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const letter of shown) {
    const y = letterY(letter, now);
    ctx.font = letter.font;
    ctx.shadowColor = "#5bff7a";
    ctx.shadowBlur = 22;
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#0a3d1c";
    ctx.strokeText(letter.letter, letter.x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#a6ff9b";
    ctx.fillText(letter.letter, letter.x, y);
  }
}

function newStartButton(): {
  y: number;
  falling: number;
  // Set once the last letter has landed, counting from when the screen came on.
  dropAt: number | null;
  hung: boolean;
  bobFrom: number;
  pressedAt: number;
} {
  return {
    y: -START_BUTTON.height,
    falling: 0,
    dropAt: null,
    hung: false,
    bobFrom: Math.random() * 1000,
    pressedAt: -Infinity,
  };
}

function updateStartButton(now: number, dt: number): void {
  const since = now - onAt;
  if (startButton.dropAt === null || startButton.hung || since < startButton.dropAt) return;
  startButton.falling += FALL_SPEED * dt;
  startButton.y += startButton.falling * dt;
  if (startButton.y < START_BUTTON.rest) return;
  // Both ropes go tight together.
  startButton.y = START_BUTTON.rest;
  if (Math.abs(startButton.falling) > 260) {
    startButton.falling = -startButton.falling * ROPE_BOUNCE;
    return;
  }
  startButton.falling = 0;
  startButton.hung = true;
  playThunk(60);
}

function buttonY(now: number): number {
  if (!startButton.hung) return startButton.y;
  return START_BUTTON.rest - BOB * (0.5 + 0.5 * Math.sin((now - startButton.bobFrom) / 560));
}

// Only once it's hanging there can it be pressed.
function overStartButton(x: number, y: number, now: number): boolean {
  if (!startButton.hung) return false;
  return Math.abs(x - W / 2) <= START_BUTTON.width / 2 && Math.abs(y - buttonY(now)) <= START_BUTTON.height / 2;
}

function pressStartButton(): void {
  startButton.pressedAt = performance.now();
  playThunk(150);
  // What pressing START actually starts hasn't been decided yet.
}

function drawStartButton(now: number): void {
  if (startButton.dropAt === null || now - onAt < startButton.dropAt) return;
  const pressed = now - startButton.pressedAt < PRESS_MS;
  const y = buttonY(now) + (pressed ? 4 : 0);
  const left = W / 2 - START_BUTTON.width / 2;
  const top = y - START_BUTTON.height / 2;

  // A rope at each end, drawn behind the button.
  ctx.strokeStyle = "#6f6450";
  ctx.lineWidth = 3;
  for (const ropeX of [left + BUTTON_ROPE_INSET, left + START_BUTTON.width - BUTTON_ROPE_INSET]) {
    ctx.beginPath();
    ctx.moveTo(ropeX, 0);
    ctx.lineTo(ropeX, top);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.roundRect(left, top, START_BUTTON.width, START_BUTTON.height, 16);
  ctx.shadowColor = "#5bff7a";
  ctx.shadowBlur = pressed ? 10 : 24;
  ctx.fillStyle = pressed ? "#7fe077" : "#a6ff9b";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#0a3d1c";
  ctx.stroke();

  ctx.font = "bold 42px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#0a3d1c";
  ctx.fillText(START_BUTTON.label, W / 2, y + 2);
}

// A soft thunk as a rope catches something: lower for the heavy ones.
function playThunk(pitch: number): void {
  if (!audio || !voiceOut) return;
  const now = audio.currentTime;
  const thunk = audio.createOscillator();
  thunk.type = "triangle";
  thunk.frequency.setValueAtTime(pitch * 2, now);
  thunk.frequency.exponentialRampToValueAtTime(pitch, now + 0.12);
  const level = audio.createGain();
  level.gain.setValueAtTime(0.18, now);
  level.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  thunk.connect(level).connect(voiceOut);
  thunk.start(now);
  thunk.stop(now + 0.25);
}

// Browsers only let a page make sound after you've clicked or pressed a key.
function start(): void {
  if (phase !== "waiting") return;
  phase = "talking";
  startAudio();
  void runIntro();
}

// Where a click landed on the canvas, in the canvas's own coordinates.
function canvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * W) / rect.width,
    y: ((event.clientY - rect.top) * H) / rect.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  if (overStartButton(point.x, point.y, performance.now())) {
    pressStartButton();
    return;
  }
  start();
});

canvas.addEventListener("pointermove", (event) => {
  const point = canvasPoint(event);
  canvas.style.cursor = overStartButton(point.x, point.y, performance.now()) ? "pointer" : "default";
});
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

  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  if (phase === "on") {
    drawScreenOn(now);
    updateTitle(now, dt);
    updateStartButton(now, dt);
    drawTitle(now);
    drawStartButton(now);
  }

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
