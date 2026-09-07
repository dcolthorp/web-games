const MUTE_KEY = "holdens-game-music-muted-v1";

export function startMusic(url: string): void {
  const track = new Audio(url);
  track.loop = true;
  track.volume = 0.35;
  track.preload = "auto";

  const button = document.querySelector<HTMLButtonElement>("#music-button");
  let muted = localStorage.getItem(MUTE_KEY) === "yes";

  const paint = (): void => {
    if (!button) return;
    button.hidden = false;
    button.textContent = muted ? "Music off" : "Music on";
    button.classList.toggle("is-off", muted);
  };

  const play = (): void => {
    if (muted) return;
    // Browsers refuse to start audio before the page has been touched, and a
    // refusal here is normal rather than an error worth shouting about.
    void track.play().catch(() => undefined);
  };

  // The first key or tap is what earns us permission to make noise.
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
    if (muted) track.pause(); else play();
    paint();
  });

  window.addEventListener("pagehide", () => track.pause());
  paint();
  play();
}
