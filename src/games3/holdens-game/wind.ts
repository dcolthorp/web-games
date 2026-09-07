const MUTE_KEY = "holdens-game-music-muted-v1";

// Whiteout gets weather rather than a tune: filtered noise with gusts that
// never repeat, so there is no loop to notice.
export function startWind(): void {
  const button = document.querySelector<HTMLButtonElement>("#music-button");
  let muted = localStorage.getItem(MUTE_KEY) === "yes";
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let gustTimer = 0;

  const paint = (): void => {
    if (!button) return;
    button.hidden = false;
    button.textContent = muted ? "Wind off" : "Wind on";
    button.classList.toggle("is-off", muted);
  };

  const gust = (): void => {
    if (!context || !master) return;
    const now = context.currentTime;
    const strength = 0.06 + Math.random() * 0.22;
    const rise = 0.8 + Math.random() * 2.4;
    const fall = 1.4 + Math.random() * 3.5;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(strength, now + rise);
    master.gain.linearRampToValueAtTime(0.05, now + rise + fall);
    gustTimer = window.setTimeout(gust, (rise + fall) * 1000);
  };

  const build = (): void => {
    if (context) return;
    context = new AudioContext();

    // Two seconds of noise, looped, is enough to sound endless once filtered.
    const seconds = 2;
    const noise = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;

    // A moving band turns flat hiss into air pushing past you.
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 520;
    band.Q.value = 0.7;

    const sweep = context.createOscillator();
    sweep.frequency.value = 0.07;
    const sweepDepth = context.createGain();
    sweepDepth.gain.value = 260;
    sweep.connect(sweepDepth).connect(band.frequency);

    const roll = context.createBiquadFilter();
    roll.type = "lowpass";
    roll.frequency.value = 1400;

    master = context.createGain();
    master.gain.value = 0.05;

    source.connect(band).connect(roll).connect(master).connect(context.destination);
    source.start();
    sweep.start();
    gust();
  };

  const play = (): void => {
    if (muted) return;
    build();
    void context?.resume();
  };

  const stop = (): void => {
    window.clearTimeout(gustTimer);
    void context?.suspend();
  };

  const wake = (): void => {
    play();
    window.removeEventListener("keydown", wake);
    window.removeEventListener("pointerdown", wake);
  };
  window.addEventListener("keydown", wake);
  window.addEventListener("pointerdown", wake);

  button?.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "yes" : "no");
    if (muted) stop(); else { play(); gust(); }
    paint();
  });

  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else { play(); gust(); }
  });

  paint();
}
