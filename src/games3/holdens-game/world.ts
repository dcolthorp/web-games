import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startWorld } from "./engine";
import { worldSpecs } from "./worldDefs";
import { brighten, happyNames, isHappy } from "./mood";
import { markCleared, worlds } from "./worlds";

installOofShortcut();
installForceRefreshHotkey();

// Every world page shares this entry; the page itself says which one it is.
const index = Number(document.body.dataset["world"] ?? "0");
const raw = worldSpecs[index];
const spec = raw ? brighten(raw, index) : undefined;

if (spec) {
  document.title = spec.name;
  const heading = document.querySelector<HTMLElement>("#world-name");
  if (heading) heading.textContent = spec.name;

  const next = worlds[index + 1];
  const nextLink = document.querySelector<HTMLAnchorElement>("#banner-next");
  if (nextLink && next?.page) {
    nextLink.href = next.page;
    nextLink.textContent = `On to ${isHappy() ? happyNames[index + 1] ?? next.name : next.name}`;
  }

  // Only the worlds listed here have a tune, and each one is fetched on
  // demand so no other level ever loads the audio.
  const themes: Record<number, () => Promise<{ id: string; label: string; url: string; loop?: boolean }[]>> = {
    0: async () => [
      { id: "main", label: "Theme", url: (await import("./assets/death-farms-theme.m4a?url")).default },
    ],
    1: async () => [
      { id: "main", label: "New music", url: (await import("./assets/devil-labs-theme.m4a?url")).default },
      { id: "og", label: "OG music", url: (await import("./assets/devil-labs-theme-og.m4a?url")).default },
    ],
    2: async () => [
      { id: "main", label: "Theme", url: (await import("./assets/sunken-castle-theme.m4a?url")).default },
    ],
    3: async () => [
      { id: "main", label: "Theme", url: (await import("./assets/matrix-45-theme.m4a?url")).default },
    ],
    // 5 is Blood Temple, deliberately silent.
    6: async () => [
      { id: "main", label: "Theme", url: (await import("./assets/v1d30-game-theme.m4a?url")).default },
    ],
    7: async () => [
      { id: "main", label: "Theme", url: (await import("./assets/internet-run-theme.m4a?url")).default },
    ],
    // Plays once and then stops. It is not meant to come back around.
    8: async () => [
      { id: "main", label: "Theme", loop: false, url: (await import("./assets/do-not-enter-theme.m4a?url")).default },
    ],
    // Also plays once. The end should be allowed to end.
    9: async () => [
      { id: "main", label: "Theme", loop: false, url: (await import("./assets/the-end-theme.m4a?url")).default },
    ],
  };

  // Whiteout is weather, not a recording.
  if (index === 4) {
    void import("./wind").then((wind) => wind.startWind());
  }

  // The temple's theme is generated, not played from a file.
  if (index === 5) {
    void import("./temple").then((temple) => temple.startTemple());
  }

  const theme = themes[index];
  if (theme) {
    void Promise.all([import("./music"), theme()])
      .then(([music, tracks]) => music.startMusic(tracks));
  }

  const control = startWorld(spec, () => markCleared(index));
  void import("./console").then((c) => c.startConsole(control));
}
