// Sound effects for Destroy the Game, made right in the browser (no sound
// files). Oscar asked for sounds on every level.

export type Sfx =
  | "jump"
  | "dash"
  | "upDash"
  | "smash"
  | "die"
  | "exit"
  | "pop"
  | "bomb"
  | "switch"
  | "boom"
  | "clink"
  | "splash"
  | "fade"
  | "slam"
  | "gear"
  | "snip"
  | "crumble"
  | "laugh"
  | "flag"
  | "swoosh";

let audio: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function ac(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function tone(a: AudioContext, type: OscillatorType, from: number, to: number, dur: number, vol: number, delay = 0): void {
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(a: AudioContext, filter: BiquadFilterType, from: number, to: number, dur: number, vol: number): void {
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function play(name: Sfx): void {
  const a = ac();
  if (!a) return;
  switch (name) {
    case "jump":
      tone(a, "square", 280, 620, 0.12, 0.06);
      break;
    case "dash":
      hiss(a, "bandpass", 600, 3000, 0.22, 0.35);
      break;
    case "upDash":
      hiss(a, "bandpass", 900, 5000, 0.22, 0.35);
      tone(a, "triangle", 300, 900, 0.18, 0.06);
      break;
    case "smash":
      hiss(a, "lowpass", 2500, 200, 0.35, 0.5);
      tone(a, "square", 140, 60, 0.2, 0.08);
      break;
    case "die":
      tone(a, "sawtooth", 420, 70, 0.45, 0.09);
      break;
    case "exit":
      tone(a, "triangle", 523, 523, 0.12, 0.12);
      tone(a, "triangle", 659, 659, 0.12, 0.12, 0.1);
      tone(a, "triangle", 784, 784, 0.25, 0.12, 0.2);
      break;
    case "pop":
      tone(a, "sine", 300, 900, 0.1, 0.15);
      break;
    case "bomb":
      tone(a, "sine", 180, 70, 0.12, 0.25);
      break;
    case "switch":
      tone(a, "square", 1600, 1200, 0.03, 0.06);
      tone(a, "square", 900, 700, 0.04, 0.05, 0.05);
      break;
    case "boom":
      hiss(a, "lowpass", 1800, 60, 0.9, 0.8);
      tone(a, "sine", 110, 30, 0.7, 0.4);
      break;
    case "splash":
      hiss(a, "bandpass", 2200, 900, 0.07, 0.12);
      break;
    case "fade":
      tone(a, "sine", 520, 1040, 0.4, 0.08);
      tone(a, "sine", 780, 1560, 0.4, 0.06, 0.08);
      hiss(a, "highpass", 3000, 8000, 0.4, 0.06);
      break;
    case "slam":
      hiss(a, "lowpass", 900, 80, 0.3, 0.6);
      tone(a, "square", 90, 40, 0.18, 0.12);
      tone(a, "triangle", 1300, 1100, 0.12, 0.04, 0.02);
      break;
    case "gear":
      for (let i = 0; i < 5; i++) tone(a, "square", 700, 600, 0.03, 0.05, i * 0.06);
      tone(a, "triangle", 300, 600, 0.3, 0.05, 0.3);
      break;
    case "snip":
      hiss(a, "highpass", 5000, 3000, 0.05, 0.25);
      tone(a, "square", 2600, 1800, 0.04, 0.05);
      hiss(a, "highpass", 5000, 3000, 0.05, 0.2);
      break;
    case "crumble":
      hiss(a, "lowpass", 1400, 150, 0.4, 0.45);
      tone(a, "square", 200, 70, 0.15, 0.06);
      break;
    case "laugh":
      // "Nyah nyah!" for falling for a fake exit.
      tone(a, "square", 660, 640, 0.13, 0.06);
      tone(a, "square", 550, 530, 0.13, 0.06, 0.16);
      tone(a, "square", 700, 680, 0.13, 0.06, 0.32);
      tone(a, "square", 550, 520, 0.2, 0.06, 0.48);
      break;
    case "flag":
      tone(a, "triangle", 660, 660, 0.1, 0.12);
      tone(a, "triangle", 990, 990, 0.2, 0.12, 0.1);
      break;
    case "swoosh":
      hiss(a, "bandpass", 500, 1600, 0.25, 0.12);
      break;
    case "clink":
      tone(a, "triangle", 2400, 2300, 0.25, 0.08);
      tone(a, "triangle", 3500, 3300, 0.18, 0.05, 0.03);
      hiss(a, "highpass", 6000, 4000, 0.08, 0.12);
      break;
  }
}

// ---- Music for the Door Shuffle (Level 5). An ORIGINAL spooky tune made right
// here in code: soft pads, a low hum and a little music-box arpeggio. It fades
// in slowly when the doors are shown, and fades out when you leave the level.

const CHORDS = [
  [57, 60, 64], // A minor
  [53, 57, 60, 64], // F major 7
  [50, 53, 57], // D minor
  [52, 56, 59], // E major (spooky)
];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const STEP = 0.3; // seconds per arpeggio note
const freq = (n: number): number => 440 * 2 ** ((n - 69) / 12);

let music: { gain: GainNode; timer: number; next: number; step: number } | null = null;

export function startMusic(): void {
  const a = ac();
  if (!a || music) return;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.5, a.currentTime + 5); // slow fade in
  gain.connect(a.destination);
  music = { gain, timer: 0, next: a.currentTime + 0.05, step: 0 };
  const schedule = (): void => {
    if (!music) return;
    while (music.next < a.currentTime + 0.6) {
      playStep(a, music.gain, music.step, music.next);
      music.next += STEP;
      music.step += 1;
    }
  };
  music.timer = window.setInterval(schedule, 150);
  schedule();
}

export function stopMusic(): void {
  if (!music || !audio) return;
  const m = music;
  music = null;
  window.clearInterval(m.timer);
  const now = audio.currentTime;
  m.gain.gain.cancelScheduledValues(now);
  m.gain.gain.setValueAtTime(Math.max(0.0001, m.gain.gain.value), now);
  m.gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  window.setTimeout(() => m.gain.disconnect(), 1500);
}

function playStep(a: AudioContext, out: GainNode, step: number, t: number): void {
  const chord = CHORDS[Math.floor(step / 8) % CHORDS.length]!;
  const pos = step % 8;
  if (pos === 0) {
    const barLen = STEP * 8;
    // Soft pad: two slightly out-of-tune saws per note through a low filter.
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(out);
    for (const n of chord) {
      for (const detune of [-7, 7]) {
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = "sawtooth";
        o.frequency.value = freq(n);
        o.detune.value = detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.8);
        g.gain.setValueAtTime(0.03, t + barLen - 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + barLen + 0.1);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + barLen + 0.2);
      }
    }
    // Low hum.
    const b = a.createOscillator();
    const bg = a.createGain();
    b.type = "sine";
    b.frequency.value = freq(chord[0]! - 12);
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.12, t + 0.5);
    bg.gain.linearRampToValueAtTime(0.0001, t + barLen);
    b.connect(bg).connect(out);
    b.start(t);
    b.stop(t + barLen + 0.1);
  }
  // Music-box notes.
  const note = chord[ARP[pos]! % chord.length]! + 12;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.value = freq(note);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.5);
}
