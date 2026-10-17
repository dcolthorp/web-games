// Little made-up noises for the models you can play with. They're all made
// on the spot with Web Audio: no sound files.

export type SoundName =
  | "meow" | "woof" | "squeak" | "tweet" | "quack" | "blub" | "chomp" | "oink" | "moo" | "neigh"
  | "roar" | "magic" | "hi" | "boing" | "whoosh" | "vroom" | "bell" | "beep" | "levelup" | "strum" | "hiss" | "alarm" | "boom";

let audio: AudioContext | null = null;

/** One note that slides through `freqs` (Hz) over `dur` seconds, starting `at` seconds from now. */
function tone(type: OscillatorType, freqs: number[], dur: number, at = 0, volume = 0.18): void {
  const ac = audio!;
  const start = ac.currentTime + at;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqs[0]!, start);
  freqs.slice(1).forEach((f, i) => {
    osc.frequency.linearRampToValueAtTime(f, start + (dur * (i + 1)) / (freqs.length - 1));
  });
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** A puff of noise, swept from one pitch to another: whooshes and splashes. */
function noise(dur: number, from: number, to: number, volume = 0.25): void {
  const ac = audio!;
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

const SOUNDS: Record<SoundName, () => void> = {
  meow: () => tone("triangle", [520, 820, 760, 480], 0.5),
  woof: () => {
    tone("square", [230, 120], 0.14, 0, 0.12);
    tone("square", [230, 120], 0.14, 0.2, 0.12);
  },
  squeak: () => {
    tone("sine", [1300, 1900], 0.08);
    tone("sine", [1300, 2000], 0.08, 0.12);
  },
  tweet: () => {
    tone("sine", [2200, 3000, 2400], 0.12);
    tone("sine", [2400, 3200, 2600], 0.12, 0.16);
  },
  quack: () => {
    tone("sawtooth", [420, 300], 0.16, 0, 0.12);
    tone("sawtooth", [420, 300], 0.16, 0.22, 0.12);
  },
  blub: () => [0, 0.12, 0.24].forEach((at, i) => tone("sine", [300 + i * 120, 700 + i * 150], 0.08, at)),
  chomp: () => {
    tone("square", [140, 90], 0.08, 0, 0.15);
    tone("square", [140, 90], 0.08, 0.14, 0.15);
  },
  oink: () => {
    tone("sawtooth", [170, 130], 0.18, 0, 0.14);
    tone("sawtooth", [180, 130], 0.18, 0.24, 0.14);
  },
  moo: () => tone("sawtooth", [150, 170, 110], 0.9, 0, 0.14),
  neigh: () => tone("triangle", [700, 900, 600, 800, 450], 0.7),
  roar: () => {
    tone("sawtooth", [110, 140, 60], 0.8, 0, 0.16);
    noise(0.7, 600, 200, 0.12);
  },
  magic: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone("sine", [f, f], 0.3, i * 0.08, 0.12)),
  hi: () => {
    tone("triangle", [300, 420], 0.14);
    tone("triangle", [420, 320], 0.18, 0.15);
  },
  boing: () => tone("sine", [140, 520, 300], 0.35, 0, 0.22),
  whoosh: () => noise(0.9, 300, 3000, 0.3),
  vroom: () => tone("sawtooth", [70, 160, 120, 220], 0.8, 0, 0.12),
  bell: () => {
    tone("sine", [1568, 1568], 0.25, 0, 0.14);
    tone("sine", [1568, 1568], 0.3, 0.18, 0.14);
  },
  beep: () => [880, 660, 990].forEach((f, i) => tone("square", [f, f], 0.09, i * 0.11, 0.08)),
  levelup: () => [392, 523, 659, 784].forEach((f, i) => tone("square", [f, f], 0.1, i * 0.09, 0.07)),
  // The Doomsday Device: an alarm for the countdown, then a big (harmless) boom.
  alarm: () => {
    tone("square", [880, 880], 0.18, 0, 0.07);
    tone("square", [660, 660], 0.18, 0.2, 0.07);
  },
  boom: () => {
    noise(1.2, 500, 60, 0.4);
    tone("sine", [110, 40], 0.9, 0, 0.3);
  },
  // Quiet TV static, for when the lights flicker.
  hiss: () => noise(0.3, 2500, 1200, 0.04),
  strum: () => [330, 415, 494, 659].forEach((f, i) => tone("triangle", [f, f * 0.995], 0.6, i * 0.06, 0.12)),
};

/** One quiet, wobbly, slightly out-of-tune music box note. */
export function playMusicBoxNote(freq: number): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const ac = audio;
    const start = ac.currentTime;
    const osc = ac.createOscillator();
    const wobble = ac.createOscillator();
    const wobbleDepth = ac.createGain();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * (0.985 + Math.random() * 0.02);
    wobble.frequency.value = 5;
    wobbleDepth.gain.value = freq * 0.012;
    wobble.connect(wobbleDepth).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    wobble.start(start);
    osc.stop(start + 1.2);
    wobble.stop(start + 1.2);
  } catch {
    // No music is fine.
  }
}

export function playSound(name: SoundName): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    SOUNDS[name]();
  } catch {
    // No sound is fine; the model still does its move.
  }
}
