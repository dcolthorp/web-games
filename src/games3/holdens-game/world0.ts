import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { startWorld } from "./engine";
import { intro2Seen, playIntro2 } from "./intro";
import { scrambleName, spec, storyPages } from "./world0Spec";
import { unlockGlitch } from "./shop";

// Plays once, then leaves you alone down here.
void Promise.all([import("./music"), import("./assets/world-zero-theme.m4a?url")])
  .then(([music, theme]) => music.startMusic([
    { id: "main", label: "Theme", loop: false, url: theme.default },
  ]));

installOofShortcut();
installForceRefreshHotkey();

const PAGES_KEY = "holdens-game-pages-v1";

function foundPages(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PAGES_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function keepPage(index: number): void {
  const all = [...new Set([...foundPages(), index])].sort((a, b) => a - b);
  localStorage.setItem(PAGES_KEY, JSON.stringify(all));
}


spec.name = scrambleName();
document.title = spec.name;
const heading = document.querySelector<HTMLElement>("#world-name");
if (heading) heading.textContent = spec.name;

const storyButton = document.querySelector<HTMLButtonElement>("#story-button");
const storyPanel = document.querySelector<HTMLDivElement>("#story-panel");
const storyList = document.querySelector<HTMLElement>("#story-list");
const concludeButton = document.querySelector<HTMLButtonElement>("#conclude-button");
const storyClose = document.querySelector<HTMLButtonElement>("#story-close");

function renderStory(): void {
  const found = foundPages();
  if (storyButton) storyButton.hidden = found.length === 0;
  if (storyList) {
    storyList.replaceChildren();
    storyPages.forEach((words, i) => {
      const line = document.createElement("p");
      line.className = found.includes(i) ? "story-line" : "story-line is-missing";
      line.textContent = found.includes(i) ? words : "█".repeat(Math.max(6, words.length));
      storyList.append(line);
    });
  }
  if (concludeButton) concludeButton.hidden = found.length < storyPages.length;
}

storyButton?.addEventListener("click", () => { if (storyPanel) storyPanel.hidden = false; });
storyClose?.addEventListener("click", () => { if (storyPanel) storyPanel.hidden = true; });

const glyphs = "!<>#@%&*/\\=+?01xX{}[]~^";

concludeButton?.addEventListener("click", () => {
  unlockGlitch();
  concludeButton.disabled = true;
  // Everything written on the page comes apart, then it tells you what it left.
  const nodes = [...document.querySelectorAll<HTMLElement>("h1, p, span, button, a, strong")]
    .filter((node) => node.children.length === 0 && (node.textContent ?? "").trim().length > 0);
  const originals = nodes.map((node) => node.textContent ?? "");
  let ticks = 0;
  // Timed by the clock, not by tick count, so a throttled background tab
  // still finishes coming apart in about two seconds.
  const endsAt = Date.now() + 1900;
  const scramble = window.setInterval(() => {
    ticks += 1;
    nodes.forEach((node, i) => {
      const source = originals[i] ?? "";
      node.textContent = [...source].map((ch) => (ch === " " ? " " : glyphs[Math.floor(Math.random() * glyphs.length)])).join("");
    });
    document.body.style.filter = `hue-rotate(${ticks * 37}deg)`;
    if (Date.now() >= endsAt) {
      window.clearInterval(scramble);
      document.body.style.filter = "";
      nodes.forEach((node, i) => { node.textContent = originals[i] ?? ""; });
      if (storyList) {
        const done = document.createElement("p");
        done.className = "story-done";
        done.textContent = "thank you. the Glitch skin is yours. it walks through walls.";
        storyList.append(done);
      }
    }
  }, 70);
});

renderStory();
function enterTheLevel(): void {
  const control = startWorld(spec, () => {}, (index) => { keepPage(index); renderStory(); });
  void import("./console").then((c) => c.startConsole(control));
}

// The way down is shown once, the first time you find this place.
if (intro2Seen()) enterTheLevel(); else playIntro2(enterTheLevel);
