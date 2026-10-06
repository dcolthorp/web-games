// Sound effects for dev.0, dev.1's page and the supercharged hub, made on the
// spot with Web Audio, so there are no sound files to load. Browsers only let
// a page make noise after a click or key press, which is when all of these
// happen anyway.

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  // Before the first click or key press the browser would refuse anyway (and
  // complain about it), so stay quiet until then.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  if (!audio) {
    const AudioContextClass =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audio = new AudioContextClass();
  }
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  return audio;
}

// One note that can slide from one pitch to another and fades out.
function tone(
  from: number,
  to: number,
  seconds: number,
  { type = "sine" as OscillatorType, volume = 0.2, delay = 0 } = {}
): void {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

// A burst of hiss, shaped by a filter: crashes, whooshes, scribbles, rumbles.
function noise(
  seconds: number,
  { volume = 0.3, filter = "lowpass" as BiquadFilterType, from = 1200, to = 1200, delay = 0, attack = 0.005 } = {}
): void {
  const ctx = context();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const shape = ctx.createBiquadFilter();
  shape.type = filter;
  shape.frequency.setValueAtTime(from, start);
  shape.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(shape).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** A small blip. `step` makes each one a little higher, for counting up. */
export function bleep(step = 0): void {
  tone(520 * Math.pow(1.06, step), 520 * Math.pow(1.06, step) * 1.5, 0.09, { type: "square", volume: 0.08 });
}

/** A happy three-note chime. */
export function chime(): void {
  [660, 830, 990].forEach((note, i) => tone(note, note, 0.4, { type: "triangle", volume: 0.15, delay: i * 0.1 }));
}

/** Pew: a laser shot. */
export function laser(): void {
  tone(1800, 220, 0.28, { type: "sawtooth", volume: 0.12 });
}

/** A sharp crackle of electricity. */
export function zap(volume = 0.15): void {
  noise(0.12, { volume, filter: "highpass", from: 3000, to: 6000 });
  tone(900, 120, 0.12, { type: "square", volume: volume * 0.5 });
}

/** Glass-y crack, for a system going UNSTABLE. */
export function crack(): void {
  noise(0.25, { volume: 0.25, filter: "bandpass", from: 2500, to: 900 });
  tone(300, 80, 0.18, { type: "square", volume: 0.08 });
}

/** Rumbling explosion. `size` 1 is a game, 3 is the whole screen. */
export function boom(size = 1): void {
  noise(0.6 + size * 0.5, { volume: Math.min(0.6, 0.3 + size * 0.1), from: 900, to: 60 });
  tone(120, 30, 0.5 + size * 0.3, { type: "sine", volume: 0.35 });
}

/** Air rushing past, for something flying. */
export function whoosh(seconds = 0.6): void {
  noise(seconds, { volume: 0.18, filter: "bandpass", from: 400, to: 1800, attack: seconds * 0.4 });
}

/** Rocket engine roar. */
export function rocket(seconds: number): void {
  noise(seconds, { volume: 0.12, from: 500, to: 300, attack: 0.2 });
}

/** Boing, for a spring. */
export function boing(): void {
  tone(180, 620, 0.25, { type: "sine", volume: 0.18 });
  tone(620, 300, 0.2, { type: "sine", volume: 0.1, delay: 0.12 });
}

/** A heavy wooden thunk. */
export function thunk(): void {
  tone(140, 50, 0.3, { type: "triangle", volume: 0.4 });
  noise(0.15, { volume: 0.3, from: 600, to: 100 });
}

/** Pencil scratching across paper. */
export function scribble(seconds: number): void {
  const strokes = Math.round(seconds * 6);
  for (let i = 0; i < strokes; i++) {
    noise(0.12, { volume: 0.08, filter: "bandpass", from: 2800, to: 3600, delay: i / 6 });
  }
}

/** The wrong-answer buzzer. */
export function buzzer(): void {
  tone(160, 150, 0.7, { type: "sawtooth", volume: 0.15 });
  tone(165, 152, 0.7, { type: "sawtooth", volume: 0.15 });
}

/** Rising power-up sweep. */
export function powerUp(): void {
  tone(200, 1600, 0.7, { type: "square", volume: 0.08 });
  [523, 659, 784, 1047].forEach((note, i) => tone(note, note, 0.25, { type: "triangle", volume: 0.12, delay: 0.55 + i * 0.08 }));
}

/** Whirring gears. */
export function whir(seconds: number): void {
  const clicks = Math.round(seconds * 14);
  for (let i = 0; i < clicks; i++) tone(1400, 1200, 0.03, { type: "square", volume: 0.04, delay: i / 14 });
}

/** Thunder: a crack, then a long rumble. */
export function thunder(): void {
  noise(0.2, { volume: 0.35, filter: "highpass", from: 2000, to: 4000 });
  noise(2, { volume: 0.4, from: 400, to: 50, delay: 0.1, attack: 0.15 });
}
