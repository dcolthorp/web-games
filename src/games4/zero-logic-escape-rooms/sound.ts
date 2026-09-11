let audio: AudioContext | null = null;

// Browsers only allow sound after a click, so this is called on every press.
export function ensureAudio(): AudioContext | null {
  if (!audio) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audio = new AudioContextClass();
  }
  void audio.resume().catch(() => {});
  return audio;
}

function tone(from: number, to: number, seconds: number, type: OscillatorType, volume: number): void {
  const a = ensureAudio();
  if (!a) return;
  const now = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(to, now + seconds);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain).connect(a.destination);
  osc.start(now);
  osc.stop(now + seconds);
}

function noise(seconds: number, filterFrom: number, filterTo: number, volume: number): void {
  const a = ensureAudio();
  if (!a) return;
  const now = a.currentTime;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = a.createBufferSource();
  source.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFrom, now);
  filter.frequency.exponentialRampToValueAtTime(filterTo, now + seconds);
  const gain = a.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  source.connect(filter).connect(gain).connect(a.destination);
  source.start(now);
}

export const sounds = {
  tap: () => tone(700, 500, 0.08, "sine", 0.12),
  pop: () => tone(260, 1100, 0.18, "square", 0.08),
  grab: () => tone(400, 900, 0.1, "triangle", 0.15),
  stroke: () => noise(0.2, 2400, 1200, 0.35),
  crack: () => noise(0.35, 600, 120, 0.6),
  thunk: () => tone(160, 45, 0.4, "sine", 0.5),
  whoosh: (seconds: number) => noise(seconds, 300, 3000, 0.35),
  clack: () => {
    noise(0.12, 1200, 500, 0.5);
    tone(240, 120, 0.12, "triangle", 0.2);
  },
  tink: () => tone(1900, 1500, 0.12, "sine", 0.12),
  bonk: () => {
    tone(520, 160, 0.25, "triangle", 0.35);
    tone(2400, 2200, 0.15, "sine", 0.08);
  },
  creak: () => tone(140, 90, 0.7, "sawtooth", 0.06),
  crash: () => {
    noise(0.7, 500, 70, 0.8);
    tone(110, 40, 0.5, "sine", 0.6);
  },
  womp: () => tone(300, 110, 0.35, "sawtooth", 0.08),
  chime: () => tone(880, 1320, 0.18, "sine", 0.12),
  squish: () => noise(0.2, 800, 300, 0.3),
  splat: () => {
    noise(0.15, 1500, 400, 0.4);
    tone(200, 90, 0.15, "sine", 0.3);
  },
  paper: () => noise(0.12, 3000, 2000, 0.25),
};
