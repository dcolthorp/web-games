// The main menu (Oscar, 2026-11-20). Behind it, the game plays itself blurred
// out, starting over and over. There's Play, a level selector, a list of the
// moves you've unlocked, and how to play.

import { CRAZY_KEY, LEVEL_COUNT, readCrazy, readSavedLevel, startGame, TOTAL_GEMS, type GameHandle, type LevelDef } from "./game";
import { drawFigure, readGems, readSkin, saveSkin, SKINS } from "./skins";
import { play } from "./sfx";

// The secret code (Oscar's): type every letter on the keyboard, row by row, on
// the menu. It turns crazy mode on (the colors go wild and the monster turns
// tiny and squeaky). Type it again to turn it off.
const SECRET = "qwertyuiopasdfghjklzxcvbnm";
let typed = "";
document.body.classList.toggle("crazy", readCrazy());
window.addEventListener("keydown", (e) => {
  if (document.getElementById("menu")?.hidden !== false) return; // only on the menu
  if (e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-SECRET.length);
  if (typed !== SECRET) return;
  typed = "";
  const on = !readCrazy();
  try {
    localStorage.setItem(CRAZY_KEY, on ? "1" : "0");
  } catch {
    // Can't save it; it'll still work until you leave the page.
  }
  document.body.classList.toggle("crazy", on);
  play(on ? "ding" : "pop");
  const note = document.getElementById("menu-secret");
  if (note) {
    note.textContent = on ? "🌈 CRAZY MODE ON! 🐭 The monster is tiny now." : "Crazy mode off.";
    note.hidden = false;
  }
});

// The Test Level lives in test-level.ts, which is never committed (it's in
// .gitignore). If the file isn't there, this is empty and the button hides.
const testFiles = import.meta.glob<{ TEST_LEVEL: LevelDef; TEST_SHUFFLE?: LevelDef; TEST_MONSTER?: LevelDef; TEST_DOORS?: LevelDef; TEST_SPAM?: LevelDef; TEST_SURVIVE?: LevelDef; TEST_BOMB?: LevelDef; TEST_GRAVITY?: LevelDef; TEST_SPIKES?: LevelDef }>("./test-level.ts", { eager: true });
const TEST_LEVEL = Object.values(testFiles)[0]?.TEST_LEVEL;
const TEST_SHUFFLE = Object.values(testFiles)[0]?.TEST_SHUFFLE;
const TEST_MONSTER = Object.values(testFiles)[0]?.TEST_MONSTER;
const TEST_DOORS = Object.values(testFiles)[0]?.TEST_DOORS;
const TEST_SPAM = Object.values(testFiles)[0]?.TEST_SPAM;
const TEST_SURVIVE = Object.values(testFiles)[0]?.TEST_SURVIVE;
const TEST_BOMB = Object.values(testFiles)[0]?.TEST_BOMB;
const TEST_GRAVITY = Object.values(testFiles)[0]?.TEST_GRAVITY;
const TEST_SPIKES = Object.values(testFiles)[0]?.TEST_SPIKES;

const MOVES = [
  { level: 1, name: "Dash", how: "Hit <b>D</b>. Hold it longer to go farther (half a second max). Flies over spikes and smashes cracked walls." },
  { level: 6, name: "Up Dash", how: "Jump, then press <b>Jump again</b> in mid-air. Smashes cracked ceilings." },
  { level: 11, name: "Bombs", how: "Press <b>B</b> to drop a bomb. Flick a switch to blow them up. Only metal breaks." },
  { level: 16, name: "Water", how: "Hold <b>W</b> to pour water. Smudged walls fade away when they get wet." },
  { level: 21, name: "⚠️ Slammers", how: "Not a move, a danger! Spiky blocks open, <b>wiggle</b>, then slam shut. Run through while they're open." },
  { level: 26, name: "Scissors", how: "Run into a <b>gear</b> to turn it: blue wires stop a slammer, red wires jam it shut. Press <b>S</b> next to a wire to cut it and switch that slammer off." },
  { level: 31, name: "😡 Rage Zone", how: "Some <b>EXIT</b> doors are FAKE (look at the knob). Some floors <b>crumble</b> under you. Touch a <b>flag</b> to save your spot." },
  { level: 36, name: "👹 The Monster", how: "It climbs out of a hatch and chases you, even through walls. Don't let it touch you! At the very end: press <b>S</b> when the circles line up, 3 times." },
  { level: 41, name: "🌌 Dimensions", how: "Press <b>A</b> to switch into the Ethereal Dimension: dreamy music and twinkling stars. Some blocks are only there in one dimension, so try <b>jump, A, jump, A</b>!" },
  { level: 46, name: "💎 Gems", how: "Grab the <b>gems</b> hidden in Levels 46-50. They unlock <b>Skins</b> (in the menu), so you don't have to be the stick man!" },
  { level: 51, name: "💀 The Tests", how: "The hardest levels in the game. Giant <b>CRUSHERS</b> slam in patterns (wait for them to go back up). <b>Thin posts</b> are 1-pixel jumps. Press <b>B while dashing</b> and the bomb flies forward. No checkpoints, and don't trust the signs." },
  { level: 56, name: "↔️ Side Crushers", how: "Crushers that slam <b>sideways</b>, right where you jump. Wait for them to pull back, then jump!" },
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
  fillSkins();
  demo?.stop();
  demo = startGame(demoCanvas, { demo: true, startLevel: 0 });
  document.getElementById("menu-play")?.focus();

  const play = document.getElementById("menu-play")!;
  play.onclick = () => startAt(screen, readSavedLevel());
  const testBtn = document.getElementById("menu-test")!;
  testBtn.hidden = !TEST_LEVEL;
  testBtn.onclick = () => startAt(screen, 0, TEST_LEVEL);
  const shuffleBtn = document.getElementById("menu-test-shuffle")!;
  shuffleBtn.hidden = !TEST_SHUFFLE;
  shuffleBtn.onclick = () => startAt(screen, 0, TEST_SHUFFLE);
  const monsterBtn = document.getElementById("menu-test-monster")!;
  monsterBtn.hidden = !TEST_MONSTER;
  monsterBtn.onclick = () => startAt(screen, 0, TEST_MONSTER);
  const doorsBtn = document.getElementById("menu-test-doors")!;
  doorsBtn.hidden = !TEST_DOORS;
  doorsBtn.onclick = () => startAt(screen, 0, TEST_DOORS);
  const spamBtn = document.getElementById("menu-test-spam")!;
  spamBtn.hidden = !TEST_SPAM;
  spamBtn.onclick = () => startAt(screen, 0, TEST_SPAM);
  const surviveBtn = document.getElementById("menu-test-survive")!;
  surviveBtn.hidden = !TEST_SURVIVE;
  surviveBtn.onclick = () => startAt(screen, 0, TEST_SURVIVE);
  const bombBtn = document.getElementById("menu-test-bomb")!;
  bombBtn.hidden = !TEST_BOMB;
  bombBtn.onclick = () => startAt(screen, 0, TEST_BOMB);
  const gravityBtn = document.getElementById("menu-test-gravity")!;
  gravityBtn.hidden = !TEST_GRAVITY;
  gravityBtn.onclick = () => startAt(screen, 0, TEST_GRAVITY);
  const spikesBtn = document.getElementById("menu-test-spikes")!;
  spikesBtn.hidden = !TEST_SPIKES;
  spikesBtn.onclick = () => startAt(screen, 0, TEST_SPIKES);
  menu.querySelectorAll<HTMLButtonElement>("[data-page]").forEach((btn) => {
    btn.onclick = () => showPage(btn.dataset["page"]!);
  });
}

function startAt(screen: HTMLCanvasElement, level: number, testLevel?: LevelDef): void {
  demo?.stop();
  demo = null;
  document.getElementById("menu")!.hidden = true;
  document.body.classList.remove("on-menu");
  startGame(screen, { startLevel: level, testLevel, onExit: () => showMenu(screen) });
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

// Skins: collect gems in Levels 46-50 to unlock them. Click one to wear it.
function fillSkins(): void {
  const have = readGems().size;
  const picked = readSkin().id;
  document.getElementById("skin-count")!.textContent = `💎 ${have} / ${TOTAL_GEMS()} gems`;
  const grid = document.getElementById("skin-grid")!;
  grid.replaceChildren();
  for (const skin of SKINS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skin-card";
    const open = have >= skin.gems;
    btn.disabled = !open;
    if (skin.id === picked) btn.classList.add("picked");
    const cv = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    cv.width = 64 * dpr;
    cv.height = 72 * dpr;
    const ctx = cv.getContext("2d");
    if (ctx) {
      ctx.scale(dpr * 1.4, dpr * 1.4);
      const line = (x1: number, y1: number, x2: number, y2: number): void => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      drawFigure(ctx, skin.id, { cx: 23, top: 14, h: 34, facing: 1, lean: 0, swing: 4, arms: "swing", time: 0.4 }, line);
    }
    const label = document.createElement("span");
    label.textContent = open ? skin.name : `🔒 💎 ${skin.gems}`;
    btn.append(cv, label);
    btn.title = open ? `Wear the ${skin.name}` : `Collect ${skin.gems} gems to unlock`;
    btn.onclick = () => {
      saveSkin(skin.id);
      play("pop");
      fillSkins();
    };
    grid.append(btn);
  }
}
