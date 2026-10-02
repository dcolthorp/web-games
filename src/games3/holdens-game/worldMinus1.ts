import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startBoss } from "./boss";
import { intro3Seen, playIntro3 } from "./intro";
import { happyMinusOneName, isHappy } from "./mood";
import { giganticName } from "./gigantic";

installOofShortcut();
installForceRefreshHotkey();

// The name will not hold still down here.
const glyphs = "!<>#@%&*/\\=+?01xX{}[]~^";
const scramble = (): string =>
  Array.from({ length: 9 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");

const heading = document.querySelector<HTMLElement>("#world-name");
if (isHappy()) {
  document.title = giganticName(happyMinusOneName);
  if (heading) heading.textContent = giganticName(happyMinusOneName);
} else {
  document.title = giganticName(scramble());
  if (heading) {
    heading.textContent = giganticName(scramble());
    window.setInterval(() => { heading.textContent = giganticName(scramble()); }, 220);
  }
}

// What was waiting at the bottom, shown once.
if (intro3Seen() || isHappy()) startBoss(); else playIntro3(startBoss);
