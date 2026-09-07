import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startBoss } from "./boss";
import { intro3Seen, playIntro3 } from "./intro";

installOofShortcut();
installForceRefreshHotkey();

// The name will not hold still down here.
const glyphs = "!<>#@%&*/\\=+?01xX{}[]~^";
const scramble = (): string =>
  Array.from({ length: 9 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");

const heading = document.querySelector<HTMLElement>("#world-name");
document.title = scramble();
if (heading) {
  heading.textContent = scramble();
  window.setInterval(() => { heading.textContent = scramble(); }, 220);
}

// What was waiting at the bottom, shown once.
if (intro3Seen()) startBoss(); else playIntro3(startBoss);
