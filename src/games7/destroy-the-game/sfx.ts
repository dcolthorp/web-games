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
  | "snip";

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
    case "clink":
      tone(a, "triangle", 2400, 2300, 0.25, 0.08);
      tone(a, "triangle", 3500, 3300, 0.18, 0.05, 0.03);
      hiss(a, "highpass", 6000, 4000, 0.08, 0.12);
      break;
  }
}
