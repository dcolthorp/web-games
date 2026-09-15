// A made-up voice built from sound effects, like the babbling in a lot of games:
// every letter is a tiny sung vowel, with a puff of noise for the hissy and
// clicky letters. It isn't words, but it sounds like somebody talking, and each
// person has their own.

export interface Voice {
  // How high they talk, in Hz.
  pitch: number;
  // How big their mouth sounds: below 1 is bigger and deeper.
  mouthSize: number;
  // How much their pitch jumps around from letter to letter.
  wobble: number;
}

export const VOICES: Voice[] = [
  // Person 1: low and steady.
  { pitch: 105, mouthSize: 0.9, wobble: 0.03 },
  // Person 2: higher and bouncier.
  { pitch: 190, mouthSize: 1.12, wobble: 0.06 },
];

// How long each letter takes to say.
export const LETTER_MS = 55;

type Vowel = "a" | "e" | "i" | "o" | "u";

// The two strongest ringing notes inside a mouth making each vowel. Filtering a
// buzz down to these is what makes it sound like "ah" or "ee" instead of a beep.
const MOUTH_SHAPES: Record<Vowel, [number, number]> = {
  a: [800, 1200],
  e: [500, 1900],
  i: [320, 2300],
  o: [500, 900],
  u: [350, 800],
};

// Consonants borrow the vowel their mouth shape is closest to.
const VOWEL_FOR: Record<string, Vowel> = {
  a: "a", e: "e", i: "i", o: "o", u: "u",
  b: "u", p: "u", m: "u", f: "u", v: "u", w: "u",
  d: "e", t: "e", n: "e", l: "e", x: "e", q: "e",
  g: "o", k: "o", r: "o",
  s: "i", z: "i", c: "i", j: "i", y: "i",
  h: "a",
};

// The puff of air some letters start with: how high it hisses, how long, how loud.
const PUFFS: Record<string, { hiss: number; ms: number; loudness: number }> = {
  s: { hiss: 5500, ms: 55, loudness: 0.35 },
  z: { hiss: 5000, ms: 45, loudness: 0.25 },
  c: { hiss: 5000, ms: 40, loudness: 0.3 },
  x: { hiss: 4500, ms: 45, loudness: 0.3 },
  t: { hiss: 3000, ms: 18, loudness: 0.45 },
  k: { hiss: 2400, ms: 18, loudness: 0.45 },
  p: { hiss: 1500, ms: 15, loudness: 0.4 },
  d: { hiss: 2200, ms: 14, loudness: 0.3 },
  b: { hiss: 1200, ms: 14, loudness: 0.3 },
  g: { hiss: 1800, ms: 14, loudness: 0.3 },
  f: { hiss: 3500, ms: 35, loudness: 0.2 },
  h: { hiss: 1600, ms: 35, loudness: 0.2 },
};

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseFor(audio: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(audio);
  if (!buffer) {
    buffer = audio.createBuffer(1, Math.round(audio.sampleRate * 0.2), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(audio, buffer);
  }
  return buffer;
}

// Plays one letter's sound starting at `when` (in the audio clock's seconds).
// `bend` tips the pitch: up toward 1 at the end of a question, down toward -1
// at the end of a sentence. Spaces and punctuation make no sound.
export function speakLetter(
  audio: BaseAudioContext,
  output: AudioNode,
  letter: string,
  voice: Voice,
  when: number,
  bend: number
): void {
  const lower = letter.toLowerCase();
  const vowel = VOWEL_FOR[lower];
  if (!vowel) return;

  // The same letter always jumps the same way, so the babble sounds like one
  // made-up language instead of random beeps.
  const jump = ((((lower.charCodeAt(0) * 37) % 9) - 4) / 4) * voice.wobble;
  const pitch = voice.pitch * (1 + jump + bend * 0.3);
  const length = 0.075;

  const buzz = audio.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.setValueAtTime(pitch, when);
  buzz.frequency.linearRampToValueAtTime(pitch * (1 + bend * 0.05), when + length);

  const mouth = audio.createGain();
  mouth.gain.setValueAtTime(0, when);
  mouth.gain.linearRampToValueAtTime(1, when + 0.008);
  mouth.gain.linearRampToValueAtTime(0.7, when + 0.04);
  mouth.gain.linearRampToValueAtTime(0, when + length);

  const [first, second] = MOUTH_SHAPES[vowel];
  for (const [ring, loudness] of [
    [first, 2.5],
    [second, 1.5],
  ] as const) {
    const shape = audio.createBiquadFilter();
    shape.type = "bandpass";
    shape.frequency.value = ring * voice.mouthSize;
    shape.Q.value = 6;
    const level = audio.createGain();
    level.gain.value = loudness;
    buzz.connect(shape).connect(level).connect(mouth);
  }
  mouth.connect(output);
  buzz.start(when);
  buzz.stop(when + length + 0.02);

  const puff = PUFFS[lower];
  if (!puff) return;
  const air = audio.createBufferSource();
  air.buffer = noiseFor(audio);
  const hiss = audio.createBiquadFilter();
  hiss.type = "bandpass";
  hiss.frequency.value = puff.hiss;
  hiss.Q.value = 1.5;
  const breath = audio.createGain();
  breath.gain.setValueAtTime(puff.loudness, when);
  breath.gain.linearRampToValueAtTime(0, when + puff.ms / 1000);
  air.connect(hiss).connect(breath).connect(output);
  air.start(when);
  air.stop(when + puff.ms / 1000 + 0.01);
}
