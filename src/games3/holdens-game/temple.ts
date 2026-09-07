const MUTE_KEY = "holdens-game-music-muted-v1";

// An original piece, built in the browser rather than played from a file.
// Minor key, driving, and it rearranges itself so it never repeats exactly.
const ROOT = 55; // A1
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const BASS_LINES = [
  [0, 0, 3, 0, 5, 0, 3, 2],
  [0, 0, 0, 5, 3, 3, 2, 2],
  [0, 5, 0, 5, 3, 2, 0, 0],
];
const LEADS = [
  [7, 5, 3, 5, 7, 10, 7, 5],
  [7, 7, 10, 9, 7, 5, 3, 2],
  [10, 9, 7, 5, 7, 3, 5, 7],
];

const semitone = (step: number): number => {
  const octave = Math.floor(step / MINOR.length);
  const note = MINOR[((step % MINOR.length) + MINOR.length) % MINOR.length] ?? 0;
  return note + octave * 12;
};
const hz = (step: number, octaves: number): number =>
  ROOT * Math.pow(2, (semitone(step) + octaves * 12) / 12);

export function startTemple(): void {
  const button = document.querySelector<HTMLButtonElement>("#music-button");
  let muted = localStorage.getItem(MUTE_KEY) === "yes";
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let timer = 0;
  let step = 0;
  let bar = 0;
  let nextNote = 0;

  const paint = (): void => {
    if (!button) return;
    button.hidden = false;
    button.textContent = muted ? "Press K to start music" : "Press K to pause music";
    button.classList.toggle("is-off", muted);
  };

  const kick = (at: number): void => {
    if (!context || !master) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    gain.gain.setValueAtTime(0.9, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.26);
  };

  const hat = (at: number, loud: number): void => {
    if (!context || !master) return;
    const length = Math.floor(context.sampleRate * 0.05);
    const noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = noise;
    const band = context.createBiquadFilter();
    band.type = "highpass";
    band.frequency.value = 7000;
    const gain = context.createGain();
    gain.gain.value = loud;
    source.connect(band).connect(gain).connect(master);
    source.start(at);
  };

  const tone = (at: number, freq: number, length: number, type: OscillatorType, loud: number): void => {
    if (!context || !master) return;
    const osc = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, at);
    filter.frequency.exponentialRampToValueAtTime(700, at + length);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(loud, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(filter).connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + length + 0.02);
  };

  const schedule = (): void => {
    if (!context) return;
    // Only ever one loop running, however many times this is called.
    window.clearTimeout(timer);
    const beat = 60 / 148 / 2; // eighth notes at 148bpm
    while (nextNote < context.currentTime + 0.25) {
      const at = nextNote;
      const inBar = step % 8;
      // The line changes every four bars, so it keeps moving.
      const bassLine = BASS_LINES[Math.floor(bar / 4) % BASS_LINES.length] ?? BASS_LINES[0]!;
      const lead = LEADS[Math.floor(bar / 4) % LEADS.length] ?? LEADS[0]!;

      if (inBar % 2 === 0) kick(at);
      hat(at, inBar % 2 === 0 ? 0.05 : 0.11);
      tone(at, hz(bassLine[inBar] ?? 0, 0), beat * 0.9, "sawtooth", 0.16);
      if (bar % 4 >= 2) tone(at, hz(lead[inBar] ?? 0, 2), beat * 1.3, "square", 0.055);

      nextNote += beat;
      step += 1;
      if (step % 8 === 0) bar += 1;
    }
    timer = window.setTimeout(schedule, 45);
  };

  const build = (): void => {
    if (context) return;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.16;
    const room = context.createConvolver();
    const tail = context.createBuffer(2, context.sampleRate * 1.1, context.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const data = tail.getChannelData(c);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.6);
      }
    }
    room.buffer = tail;
    const wet = context.createGain();
    wet.gain.value = 0.28;
    master.connect(context.destination);
    master.connect(room).connect(wet).connect(context.destination);
    nextNote = context.currentTime + 0.1;
    schedule();
  };

  const play = (): void => { if (muted) return; build(); void context?.resume(); };
  const stop = (): void => { window.clearTimeout(timer); void context?.suspend(); };

  const wake = (): void => {
    play();
    window.removeEventListener("keydown", wake);
    window.removeEventListener("pointerdown", wake);
  };
  window.addEventListener("keydown", wake);
  window.addEventListener("pointerdown", wake);

  const toggleSound = (): void => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "yes" : "no");
    if (muted) stop(); else { play(); schedule(); }
    paint();
  };

  button?.addEventListener("click", toggleSound);

  // K works anywhere on the page, except while typing a command.
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "k") return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    toggleSound();
  });

  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else { play(); schedule(); }
  });

  paint();
}
