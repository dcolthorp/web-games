/** Every noise Farttopia makes. One lazily-created audio context for the lot. */

let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  const Ctor = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  return audio;
}

/** Filtered noise with a wobble, so it flutters instead of hissing. */
export function playFart(power: number): void {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime;
  const duration = 0.16 + power * 0.42;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const wobble = Math.sin(t * (34 + power * 26) * Math.PI * 2) * 0.5 + 0.5;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.35 + wobble * 0.65);
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900 - power * 420, now);
  filter.Q.value = 7;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25 + power * 0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start(now);
  source.stop(now + duration);
}

function tone(type: OscillatorType, from: number, to: number, seconds: number, volume: number, delay = 0): void {
  const ac = ctx();
  if (!ac) return;
  const now = ac.currentTime + delay;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + seconds);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + seconds);
}

/** A rising sweep, so the trip sounds like going somewhere. */
export function playWarp(ms: number): void {
  tone("triangle", 180, 1400, ms / 1000, 0.18);
}

export function playCoin(): void {
  tone("square", 880, 1320, 0.09, 0.12);
  tone("square", 1320, 1760, 0.12, 0.1, 0.08);
}

export function playTalk(): void {
  tone("sine", 420, 520, 0.07, 0.06);
}

export function playDoor(): void {
  tone("sine", 300, 180, 0.16, 0.1);
}
