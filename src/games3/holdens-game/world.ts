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

  // Death Farms has a theme tune. Loaded only there, so no other world can
  // even reach the audio.
  if (index === 0) {
    void Promise.all([import("./music"), import("./assets/death-farms-theme.m4a?url")])
      .then(([music, theme]) => music.startMusic(theme.default));
  }

  startWorld(spec, () => markCleared(index));
}
