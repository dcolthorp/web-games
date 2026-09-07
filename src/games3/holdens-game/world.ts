import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startWorld } from "./engine";
import { worldSpecs } from "./worldDefs";
import { markCleared, worlds } from "./worlds";

installOofShortcut();
installForceRefreshHotkey();

// Every world page shares this entry; the page itself says which one it is.
const index = Number(document.body.dataset["world"] ?? "0");
const spec = worldSpecs[index];

if (spec) {
  document.title = spec.name;
  const heading = document.querySelector<HTMLElement>("#world-name");
  if (heading) heading.textContent = spec.name;

  const next = worlds[index + 1];
  const nextLink = document.querySelector<HTMLAnchorElement>("#banner-next");
  if (nextLink && next?.page) {
    nextLink.href = next.page;
    nextLink.textContent = `On to ${next.name}`;
  }

  // Only the worlds listed here have a tune, and each one is fetched on
  // demand so no other level ever loads the audio.
  const themes: Record<number, () => Promise<{ default: string }>> = {
    0: () => import("./assets/death-farms-theme.m4a?url"),
    1: () => import("./assets/devil-labs-theme.m4a?url"),
  };

  const theme = themes[index];
  if (theme) {
    void Promise.all([import("./music"), theme()])
      .then(([music, track]) => music.startMusic(track.default));
  }

  startWorld(spec, () => markCleared(index));
}
