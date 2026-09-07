import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startWorld } from "./engine";
import { startMusic } from "./music";
import themeUrl from "./assets/death-farms-theme.m4a?url";
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

  // Death Farms has a theme tune. The rest are still quiet.
  if (index === 0) startMusic(themeUrl);

  startWorld(spec, () => markCleared(index));
}
