// The main menu (Oscar, 2026-11-20). Behind it, the game plays itself blurred
// out, starting over and over. There's Play, a level selector, a list of the
// moves you've unlocked, and how to play.

import { LEVEL_COUNT, readSavedLevel, startGame, type GameHandle, type LevelDef } from "./game";

// The Test Level lives in test-level.ts, which is never committed (it's in
// .gitignore). If the file isn't there, this is empty and the button hides.
const testFiles = import.meta.glob<{ TEST_LEVEL: LevelDef }>("./test-level.ts", { eager: true });
const TEST_LEVEL = Object.values(testFiles)[0]?.TEST_LEVEL;

const MOVES = [
  { level: 1, name: "Dash", how: "Hit <b>D</b>. Hold it longer to go farther (half a second max). Flies over spikes and smashes cracked walls." },
  { level: 6, name: "Up Dash", how: "Jump, then press <b>Jump again</b> in mid-air. Smashes cracked ceilings." },
  { level: 11, name: "Bombs", how: "Press <b>B</b> to drop a bomb. Flick a switch to blow them up. Only metal breaks." },
  { level: 16, name: "Water", how: "Hold <b>W</b> to pour water. Smudged walls fade away when they get wet." },
  { level: 21, name: "⚠️ Slammers", how: "Not a move, a danger! Spiky blocks open, <b>wiggle</b>, then slam shut. Run through while they're open." },
  { level: 26, name: "Scissors", how: "Run into a <b>gear</b> to turn it: blue wires stop a slammer, red wires jam it shut. Press <b>S</b> next to a wire to cut it and switch that slammer off." },
];

let demo: GameHandle | null = null;

export function showMenu(screen: HTMLCanvasElement): void {
  const menu = document.getElementById("menu")!;
  const demoCanvas = document.getElementById("demo") as HTMLCanvasElement;
  document.body.classList.add("on-menu");
  menu.hidden = false;
  showPage("menu-main");
  fillLevels(screen);
  fillMoves();
  demo?.stop();
  demo = startGame(demoCanvas, { demo: true, startLevel: 0 });
  document.getElementById("menu-play")?.focus();

  const play = document.getElementById("menu-play")!;
  play.onclick = () => startAt(screen, readSavedLevel());
  const testBtn = document.getElementById("menu-test")!;
  testBtn.hidden = !TEST_LEVEL;
  testBtn.onclick = () => startAt(screen, 0, true);
  menu.querySelectorAll<HTMLButtonElement>("[data-page]").forEach((btn) => {
    btn.onclick = () => showPage(btn.dataset["page"]!);
  });
}

function startAt(screen: HTMLCanvasElement, level: number, test = false): void {
  demo?.stop();
  demo = null;
  document.getElementById("menu")!.hidden = true;
  document.body.classList.remove("on-menu");
  startGame(screen, { startLevel: level, testLevel: test ? TEST_LEVEL : undefined, onExit: () => showMenu(screen) });
}

function showPage(id: string): void {
  document.querySelectorAll<HTMLElement>(".menu-page").forEach((page) => {
    page.hidden = page.id !== id;
  });
  document.querySelector<HTMLElement>(`#${id} button, #${id} a`)?.focus();
}

function fillLevels(screen: HTMLCanvasElement): void {
  const grid = document.getElementById("level-grid")!;
  const reached = readSavedLevel();
  const slots = Math.max(15, Math.ceil(LEVEL_COUNT() / 5) * 5 + 5);
  grid.replaceChildren();
  for (let i = 0; i < slots; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn";
    const built = i < LEVEL_COUNT();
    const open = built && i <= reached;
    btn.textContent = built ? String(i + 1) : "?";
    btn.disabled = !open;
    if (i % 5 === 0) btn.classList.add("new-move");
    btn.title = !built ? "Coming soon" : open ? `Play Level ${i + 1}` : "Locked: beat the level before it";
    btn.onclick = () => startAt(screen, i);
    grid.append(btn);
  }
}

function fillMoves(): void {
  const list = document.getElementById("moves-list")!;
  const reached = readSavedLevel() + 1;
  list.innerHTML = MOVES.map((m) =>
    m.level <= reached && m.level <= LEVEL_COUNT()
      ? `<li><b>${m.name}</b> (Level ${m.level}): ${m.how}</li>`
      : `<li class="locked">🔒 ??? (unlocks at Level ${m.level})</li>`
  ).join("");
}
