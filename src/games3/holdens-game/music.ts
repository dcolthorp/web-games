const MUTE_KEY = "holdens-game-music-muted-v1";
const TRACK_KEY = "holdens-game-track-v1";

export interface Track {
  id: string;
  label: string;
  url: string;
}

export function startMusic(tracks: Track[]): void {
  const first = tracks[0];
  if (!first) return;

  const muteButton = document.querySelector<HTMLButtonElement>("#music-button");
  const swapButton = document.querySelector<HTMLButtonElement>("#track-button");

  const wanted = localStorage.getItem(TRACK_KEY);
  let current = tracks.find((track) => track.id === wanted) ?? first;
  let muted = localStorage.getItem(MUTE_KEY) === "yes";

  const track = new Audio(current.url);
  track.loop = true;
  track.volume = 0.35;
  track.preload = "auto";

  const play = (): void => {
    if (muted) return;
    // A refusal before the page has been touched is normal, not an error.
    void track.play().catch(() => undefined);
  };

  const stop = (): void => {
    track.pause();
    track.currentTime = 0;
  };

  const paint = (): void => {
    if (muteButton) {
      muteButton.hidden = false;
      muteButton.textContent = muted ? "Music off" : "Music on";
      muteButton.classList.toggle("is-off", muted);
    }
    if (swapButton && tracks.length > 1) {
      // The button offers the track you are not listening to.
      const other = tracks.find((entry) => entry.id !== current.id) ?? first;
      swapButton.hidden = false;
      swapButton.textContent = other.label;
    }
  };

  const wake = (): void => {
    play();
    window.removeEventListener("keydown", wake);
    window.removeEventListener("pointerdown", wake);
  };
  window.addEventListener("keydown", wake);
  window.addEventListener("pointerdown", wake);

  muteButton?.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "yes" : "no");
    if (muted) track.pause(); else play();
    paint();
  });

  swapButton?.addEventListener("click", () => {
    const other = tracks.find((entry) => entry.id !== current.id);
    if (!other) return;
    current = other;
    localStorage.setItem(TRACK_KEY, current.id);
    stop();
    track.src = current.url;
    play();
    paint();
  });

  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else play();
  });
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) play();
  });

  paint();
  play();
}
