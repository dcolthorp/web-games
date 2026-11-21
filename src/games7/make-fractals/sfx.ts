// Sounds for Make Fractals, made on the spot with Web Audio.

let audio: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

function context(): AudioContext | null {
  if (muted) return null;
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

// A little blip that goes higher the higher the level.
export function levelBlip(level: number, goingUp: boolean): void {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime;
  const base = 260 * Math.pow(2, Math.min(level, 16) / 6);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(goingUp ? base * 0.8 : base * 1.2, t);
  osc.frequency.exponentialRampToValueAtTime(base, t + 0.08);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

// The big deep BOOM. A low note that drops, pushed through a bit of
// crunch, with a thump of noise at the start.
export function vineBoom(): void {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime;

  const crunch = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 3.5);
  }
  crunch.curve = curve;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.55, t + 0.012);
  master.gain.exponentialRampToValueAtTime(0.25, t + 0.35);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(900, t);
  low.frequency.exponentialRampToValueAtTime(160, t + 0.8);
  crunch.connect(low).connect(master).connect(ctx.destination);

  for (const [type, from, to, vol] of [
    ["sine", 120, 38, 1],
    ["square", 60, 30, 0.35],
    ["sine", 240, 70, 0.3],
  ] as const) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + 0.9);
    g.gain.value = vol;
    osc.connect(g).connect(crunch);
    osc.start(t);
    osc.stop(t + 1.7);
  }

  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const ng = ctx.createGain();
  ng.gain.value = 0.6;
  src.connect(ng).connect(crunch);
  src.start(t);
}
