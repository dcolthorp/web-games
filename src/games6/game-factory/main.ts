import { bleep, boing, boom, buzzer, chime, laser, powerUp, thunder, whoosh } from "../../shared/sfx";
import { draw3D, isWall, type ScreenSpot } from "./three";

// Game Factory: a game for making games. Paint your own sprites (with frames,
// so they can be animated) and backgrounds, give each sprite rules like "when
// this is clicked → change the background and play my animation" or "when the
// right arrow is held → move right", then press Play. Every game you make is
// saved in this browser and shows up in My Games. There are no rules about
// what kind of game it is: horror games are allowed (there's a jump scare and
// lights-out).

// ---------------------------------------------------------------------------
// Pictures
//
// A picture is a string with one character per pixel: "." is see-through, and
// "0" to "f" are the 16 paint colors below.

const PALETTE: { ch: string; color: string; name: string }[] = [
  { ch: "0", color: "#111111", name: "Black" },
  { ch: "1", color: "#ffffff", name: "White" },
  { ch: "2", color: "#9aa0a6", name: "Gray" },
  { ch: "3", color: "#4a4f57", name: "Dark gray" },
  { ch: "4", color: "#e53935", name: "Red" },
  { ch: "5", color: "#ff8a1f", name: "Orange" },
  { ch: "6", color: "#ffd21f", name: "Yellow" },
  { ch: "7", color: "#43c443", name: "Green" },
  { ch: "8", color: "#1e7a34", name: "Dark green" },
  { ch: "9", color: "#5cc8ff", name: "Sky blue" },
  { ch: "a", color: "#1f4fd8", name: "Blue" },
  { ch: "b", color: "#8e44ec", name: "Purple" },
  { ch: "c", color: "#ff7ac8", name: "Pink" },
  { ch: "d", color: "#8d5524", name: "Brown" },
  { ch: "e", color: "#f2c79b", name: "Skin" },
  { ch: "f", color: "#6b0909", name: "Blood red" },
];
const RGB = new Map(PALETTE.map((p) => [p.ch, [parseInt(p.color.slice(1, 3), 16), parseInt(p.color.slice(3, 5), 16), parseInt(p.color.slice(5, 7), 16)]]));

const SPRITE_PX = 32;
const BG_W = 60;
const BG_H = 45;
const STAGE_W = 480;
const STAGE_H = 360;
// At size 100 a sprite is 64 pixels across on the stage.
const SPRITE_STAGE = 64;

const picCache = new Map<string, HTMLCanvasElement>();

function picCanvas(pic: string, w: number, h: number): HTMLCanvasElement {
  const key = `${w}:${pic}`;
  const cached = picCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i += 1) {
    const rgb = RGB.get(pic[i] ?? ".");
    if (!rgb) continue;
    image.data[i * 4] = rgb[0]!;
    image.data[i * 4 + 1] = rgb[1]!;
    image.data[i * 4 + 2] = rgb[2]!;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (picCache.size > 300) picCache.clear();
  picCache.set(key, canvas);
  return canvas;
}

function picUrl(pic: string, w: number, h: number): string {
  return picCanvas(pic, w, h).toDataURL();
}

// The smiley that every new game starts with.
function starterHero(): string {
  const px: string[] = Array(SPRITE_PX * SPRITE_PX).fill(".");
  const set = (x: number, y: number, ch: string): void => {
    px[y * SPRITE_PX + x] = ch;
  };
  for (let y = 6; y < 26; y += 1) for (let x = 6; x < 26; x += 1) set(x, y, "6");
  for (let i = 6; i < 26; i += 1) {
    set(i, 6, "0");
    set(i, 25, "0");
    set(6, i, "0");
    set(25, i, "0");
  }
  for (const [x, y] of [[11, 12], [12, 12], [11, 13], [12, 13], [19, 12], [20, 12], [19, 13], [20, 13]] as const) set(x, y, "0");
  for (const [x, y] of [[10, 18], [11, 19], [12, 20], [13, 20], [14, 20], [15, 20], [16, 20], [17, 20], [18, 20], [19, 20], [20, 19], [21, 18]] as const) set(x, y, "0");
  return px.join("");
}

function starterBackground(): string {
  return "9".repeat(BG_W * 33) + "7".repeat(BG_W * (BG_H - 33));
}

// ---------------------------------------------------------------------------
// Games

type Dir = "up" | "down" | "left" | "right";
type SoundId = "bleep" | "boing" | "boom" | "chime" | "laser" | "powerUp" | "buzzer" | "thunder" | "scream";
type TriggerType = "start" | "click" | "key" | "touch" | "timer";

interface Trigger {
  type: TriggerType;
  key?: string;
  // A sprite id, or "edge" for the side of the screen.
  other?: string;
  seconds?: number;
}

type ActionType =
  | "move"
  | "goto"
  | "random"
  | "background"
  | "animate"
  | "animateForever"
  | "stopAnimating"
  | "costume"
  | "say"
  | "sound"
  | "scare"
  | "hide"
  | "show"
  | "grow"
  | "spin"
  | "wait"
  | "lightsOff"
  | "lightsOn"
  | "win"
  | "lose";

interface Action {
  type: ActionType;
  dir?: Dir;
  n?: number;
  // A spot can be "random": a new random place every time.
  x?: number | "random";
  y?: number | "random";
  text?: string;
  bg?: string;
  sound?: SoundId;
}

interface Rule {
  id: string;
  when: Trigger;
  actions: Action[];
}

interface Sprite {
  id: string;
  name: string;
  frames: string[];
  x: number;
  y: number;
  size: number;
  rules: Rule[];
}

interface Background {
  id: string;
  name: string;
  pic: string;
}

interface Game {
  id: string;
  name: string;
  // The first one is where the game starts.
  backgrounds: Background[];
  sprites: Sprite[];
  updated: number;
  // 3D games: which sprite the camera follows, and the paint color that
  // stands up as walls.
  three?: { on: boolean; follow: string; wall: string };
}

const STORE_KEY = "game-factory-games";

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadGames(): Game[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const games = loadGames();
let saveTimer = 0;

function saveNow(): void {
  window.clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(games));
  } catch {
    // Nowhere to save; the game still works until the page closes.
  }
}

function saveSoon(): void {
  if (game) game.updated = Date.now();
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 300);
}

function moveRule(dir: Dir, key: string): Rule {
  return { id: newId(), when: { type: "key", key }, actions: [{ type: "move", dir, n: 4 }] };
}

function makeGame(): Game {
  return {
    id: newId(),
    name: `My Game ${games.length + 1}`,
    backgrounds: [{ id: newId(), name: "Background 1", pic: starterBackground() }],
    sprites: [
      {
        id: newId(),
        name: "Hero",
        frames: [starterHero()],
        x: 240,
        y: 230,
        size: 100,
        // Arrow keys already work, so there's something to try right away.
        rules: [moveRule("up", "up"), moveRule("down", "down"), moveRule("left", "left"), moveRule("right", "right")],
      },
    ],
    updated: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// What rules can say

const KEYS = ["up", "down", "left", "right", "space", ..."abcdefghijklmnopqrstuvwxyz".split("")];
const KEY_NAMES: Record<string, string> = { up: "↑ up arrow", down: "↓ down arrow", left: "← left arrow", right: "→ right arrow", space: "space" };

const TRIGGERS: { type: TriggerType; label: string }[] = [
  { type: "start", label: "the game starts" },
  { type: "click", label: "this sprite is clicked" },
  { type: "key", label: "a key is held down" },
  { type: "touch", label: "this sprite touches" },
  { type: "timer", label: "every few seconds" },
];

type Field = "dir" | "n" | "xy" | "text" | "bg" | "sound";

const ACTIONS: { type: ActionType; label: string; fields: Field[]; make: () => Action }[] = [
  { type: "move", label: "Move", fields: ["dir", "n"], make: () => ({ type: "move", dir: "right", n: 4 }) },
  { type: "goto", label: "Go to a spot", fields: ["xy"], make: () => ({ type: "goto", x: 240, y: 180 }) },
  { type: "random", label: "Jump to a random spot", fields: [], make: () => ({ type: "random" }) },
  { type: "background", label: "Change the background", fields: ["bg"], make: () => ({ type: "background", bg: game?.backgrounds[0]?.id }) },
  { type: "animate", label: "Play my animation once", fields: [], make: () => ({ type: "animate" }) },
  { type: "animateForever", label: "Animate forever", fields: [], make: () => ({ type: "animateForever" }) },
  { type: "stopAnimating", label: "Stop animating", fields: [], make: () => ({ type: "stopAnimating" }) },
  { type: "costume", label: "Next frame", fields: [], make: () => ({ type: "costume" }) },
  { type: "say", label: "Say", fields: ["text"], make: () => ({ type: "say", text: "Hi!" }) },
  { type: "sound", label: "Play a sound", fields: ["sound"], make: () => ({ type: "sound", sound: "boing" }) },
  { type: "scare", label: "😱 JUMP SCARE", fields: [], make: () => ({ type: "scare" }) },
  { type: "lightsOff", label: "🔦 Lights off (only see around me)", fields: [], make: () => ({ type: "lightsOff" }) },
  { type: "lightsOn", label: "💡 Lights on", fields: [], make: () => ({ type: "lightsOn" }) },
  { type: "hide", label: "Hide", fields: [], make: () => ({ type: "hide" }) },
  { type: "show", label: "Show", fields: [], make: () => ({ type: "show" }) },
  { type: "grow", label: "Grow (or shrink with a minus)", fields: ["n"], make: () => ({ type: "grow", n: 20 }) },
  { type: "spin", label: "Spin around", fields: [], make: () => ({ type: "spin" }) },
  { type: "wait", label: "Wait (seconds)", fields: ["n"], make: () => ({ type: "wait", n: 1 }) },
  { type: "win", label: "🏆 You win!", fields: [], make: () => ({ type: "win" }) },
  { type: "lose", label: "💀 Game over", fields: [], make: () => ({ type: "lose" }) },
];

const SOUNDS: { id: SoundId; name: string; play: () => void }[] = [
  { id: "bleep", name: "Bleep", play: () => bleep() },
  { id: "boing", name: "Boing", play: boing },
  { id: "boom", name: "Boom", play: () => boom() },
  { id: "chime", name: "Chime", play: chime },
  { id: "laser", name: "Laser", play: laser },
  { id: "powerUp", name: "Power up", play: powerUp },
  { id: "buzzer", name: "Buzzer", play: buzzer },
  { id: "thunder", name: "Thunder", play: thunder },
  { id: "scream", name: "Scream", play: scream },
];

let audio: AudioContext | null = null;

// A horror scream: a wobbly sawtooth that slides up and falls away.
function scream(): void {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const wobble = audio.createOscillator();
    const wobbleGain = audio.createGain();
    const gain = audio.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(700, now + 1.1);
    wobble.frequency.value = 28;
    wobbleGain.gain.value = 60;
    wobble.connect(wobbleGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    wobble.start(now);
    osc.stop(now + 1.2);
    wobble.stop(now + 1.2);
  } catch {
    // No sound here.
  }
}

function playSound(id: SoundId | undefined): void {
  SOUNDS.find((s) => s.id === id)?.play();
}

// ---------------------------------------------------------------------------
// State

type View = "browser" | "editor" | "play";

const app = document.getElementById("app")!;
let view: View = "browser";
let game: Game | null = null;
let selected: { kind: "sprite" | "bg"; id: string } | null = null;
let panel: "paint" | "rules" = "paint";
let frameIndex = 0;
let tool: "pen" | "erase" | "fill" = "pen";
let paint = "0";
// Which background the editor's stage is showing.
let stageBg = "";
// Stops whatever is running (the play loop) when the view changes.
let cleanup: (() => void) | null = null;

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function go(next: View): void {
  cleanup?.();
  cleanup = null;
  view = next;
  if (view === "browser") renderBrowser();
  else if (view === "editor") renderEditor();
  else renderPlay();
}

function spriteById(id: string | undefined): Sprite | undefined {
  return game?.sprites.find((s) => s.id === id);
}

function bgById(id: string | undefined): Background | undefined {
  return game?.backgrounds.find((b) => b.id === id);
}

// ---------------------------------------------------------------------------
// My Games: only the games made here.

function thumbnail(g: Game): string {
  const canvas = document.createElement("canvas");
  canvas.width = STAGE_W / 2;
  canvas.height = STAGE_H / 2;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const bg = g.backgrounds[0];
  if (bg) ctx.drawImage(picCanvas(bg.pic, BG_W, BG_H), 0, 0, canvas.width, canvas.height);
  for (const sprite of g.sprites) {
    const size = (SPRITE_STAGE * sprite.size) / 100 / 2;
    ctx.drawImage(picCanvas(sprite.frames[0]!, SPRITE_PX, SPRITE_PX), sprite.x / 2 - size / 2, sprite.y / 2 - size / 2, size, size);
  }
  return canvas.toDataURL();
}

function renderBrowser(): void {
  const sorted = [...games].sort((a, b) => b.updated - a.updated);
  app.innerHTML = `
    <header class="factory-top">
      <h1 class="factory-title">GAME FACTORY</h1>
      <p class="factory-sub">Make your own game. Any game. There are no rules (except the ones you make).</p>
    </header>
    <section class="browser">
      <div class="browser-head">
        <h2>My Games <span class="count">${games.length}</span></h2>
        <button class="big-button" type="button" data-new>+ Make a new game</button>
      </div>
      ${
        sorted.length === 0
          ? `<p class="empty">No games yet. Press <b>Make a new game</b> to start your first one!</p>`
          : `<ul class="game-grid">${sorted
              .map(
                (g) => `
            <li class="game-tile">
              <img class="thumb" src="${thumbnail(g)}" alt="" />
              <span class="tile-name">${escapeHtml(g.name)}${g.three?.on ? ' <span class="badge">3D</span>' : ""}</span>
              <span class="tile-info">${g.sprites.length} sprite${g.sprites.length === 1 ? "" : "s"} · ${g.backgrounds.length} background${g.backgrounds.length === 1 ? "" : "s"}</span>
              <span class="tile-buttons">
                <button type="button" class="play-button" data-play="${g.id}">▶ Play</button>
                <button type="button" data-edit="${g.id}">✏️ Edit</button>
                <button type="button" class="danger" data-delete="${g.id}" aria-label="Delete ${escapeHtml(g.name)}">🗑</button>
              </span>
            </li>`
              )
              .join("")}</ul>`
      }
    </section>
  `;
  app.querySelector("[data-new]")!.addEventListener("click", () => {
    const fresh = makeGame();
    games.push(fresh);
    saveNow();
    openEditor(fresh);
  });
  app.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openEditor(games.find((g) => g.id === b.dataset["edit"])!))
  );
  app.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((b) =>
    b.addEventListener("click", () => {
      game = games.find((g) => g.id === b.dataset["play"])!;
      playReturn = "browser";
      go("play");
    })
  );
  app.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => {
      const index = games.findIndex((g) => g.id === b.dataset["delete"]);
      if (index < 0 || !confirm(`Delete "${games[index]!.name}" forever?`)) return;
      games.splice(index, 1);
      saveNow();
      renderBrowser();
    })
  );
}

function openEditor(g: Game): void {
  game = g;
  selected = g.sprites[0] ? { kind: "sprite", id: g.sprites[0].id } : { kind: "bg", id: g.backgrounds[0]!.id };
  panel = "paint";
  frameIndex = 0;
  stageBg = g.backgrounds[0]!.id;
  go("editor");
}

// ---------------------------------------------------------------------------
// The editor

function renderEditor(): void {
  const g = game!;
  app.innerHTML = `
    <div class="editor-top">
      <button type="button" class="text-button" data-back>← My Games</button>
      <input class="game-name" data-game-name value="${escapeHtml(g.name)}" maxlength="40" aria-label="Game name" />
      <button type="button" class="small three-button ${g.three?.on ? "on" : ""}" data-3d>🧊 3D: ${g.three?.on ? "ON" : "OFF"}</button>
      <button type="button" class="big-button play-button" data-play>▶ Play</button>
    </div>
    ${
      g.three?.on
        ? `<div class="three-row">
            <label>🎥 Camera follows <select data-follow>${g.sprites
              .map((s) => `<option value="${s.id}" ${s.id === g.three!.follow ? "selected" : ""}>${escapeHtml(s.name)}</option>`)
              .join("")}</select></label>
            <label>🧱 Walls are painted <select data-wall><option value="">no walls</option>${PALETTE.map(
              (p) => `<option value="${p.ch}" ${p.ch === g.three!.wall ? "selected" : ""}>${p.name}</option>`
            ).join("")}</select></label>
            <span class="muted">In 3D the background is the floor. "Move up" walks forward.</span>
          </div>`
        : ""
    }
    <div class="editor">
      <aside class="side" id="side"></aside>
      <section class="stage-wrap">
        <canvas class="stage" id="stage" width="${STAGE_W}" height="${STAGE_H}"></canvas>
        <p class="hint">Drag sprites to move them. Click one to edit it.</p>
      </section>
      <section class="panel" id="panel"></section>
    </div>
  `;
  app.querySelector("[data-back]")!.addEventListener("click", () => {
    saveNow();
    go("browser");
  });
  app.querySelector("[data-play]")!.addEventListener("click", () => {
    saveNow();
    playReturn = "editor";
    go("play");
  });
  app.querySelector("[data-3d]")!.addEventListener("click", () => {
    g.three = { on: !g.three?.on, follow: g.three?.follow ?? g.sprites[0]?.id ?? "", wall: g.three?.wall ?? "3" };
    saveSoon();
    renderEditor();
  });
  app.querySelector("[data-follow]")?.addEventListener("change", (e) => {
    g.three!.follow = (e.target as HTMLSelectElement).value;
    saveSoon();
  });
  app.querySelector("[data-wall]")?.addEventListener("change", (e) => {
    g.three!.wall = (e.target as HTMLSelectElement).value;
    saveSoon();
  });
  app.querySelector<HTMLInputElement>("[data-game-name]")!.addEventListener("input", (e) => {
    g.name = (e.target as HTMLInputElement).value || "Untitled";
    saveSoon();
  });
  bindStage(app.querySelector<HTMLCanvasElement>("#stage")!);
  bindSide(app.querySelector<HTMLElement>("#side")!);
  bindPanel(app.querySelector<HTMLElement>("#panel")!);
  renderSide();
  renderPanel();
  drawStage();
}

function drawStage(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#stage");
  if (!canvas || !game) return;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const bg = bgById(stageBg) ?? game.backgrounds[0]!;
  ctx.drawImage(picCanvas(bg.pic, BG_W, BG_H), 0, 0, STAGE_W, STAGE_H);
  for (const sprite of game.sprites) {
    const isSelected = selected?.kind === "sprite" && selected.id === sprite.id;
    const frame = sprite.frames[isSelected ? Math.min(frameIndex, sprite.frames.length - 1) : 0]!;
    const size = (SPRITE_STAGE * sprite.size) / 100;
    ctx.drawImage(picCanvas(frame, SPRITE_PX, SPRITE_PX), sprite.x - size / 2, sprite.y - size / 2, size, size);
    if (isSelected) {
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#ff3df2";
      ctx.lineWidth = 2;
      ctx.strokeRect(sprite.x - size / 2 - 3, sprite.y - size / 2 - 3, size + 6, size + 6);
      ctx.restore();
    }
  }
}

function stagePoint(canvas: HTMLCanvasElement, e: PointerEvent | MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * STAGE_W, y: ((e.clientY - rect.top) / rect.height) * STAGE_H };
}

function bindStage(canvas: HTMLCanvasElement): void {
  let drag: { sprite: Sprite; dx: number; dy: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    const p = stagePoint(canvas, e);
    const hit = [...game!.sprites].reverse().find((s) => {
      const half = (SPRITE_STAGE * s.size) / 100 / 2;
      return Math.abs(p.x - s.x) <= half && Math.abs(p.y - s.y) <= half;
    });
    if (!hit) return;
    if (selected?.id !== hit.id) {
      selected = { kind: "sprite", id: hit.id };
      frameIndex = 0;
      renderSide();
      renderPanel();
    }
    drag = { sprite: hit, dx: p.x - hit.x, dy: p.y - hit.y };
    canvas.setPointerCapture(e.pointerId);
    drawStage();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = stagePoint(canvas, e);
    drag.sprite.x = Math.round(Math.max(0, Math.min(STAGE_W, p.x - drag.dx)));
    drag.sprite.y = Math.round(Math.max(0, Math.min(STAGE_H, p.y - drag.dy)));
    drawStage();
  });
  canvas.addEventListener("pointerup", () => {
    if (drag) saveSoon();
    drag = null;
  });
}

function renderSide(): void {
  const side = document.querySelector<HTMLElement>("#side");
  if (!side || !game) return;
  const g = game;
  side.innerHTML = `
    <h3>Sprites</h3>
    <ul class="thing-list">
      ${g.sprites
        .map(
          (s) => `
        <li><button type="button" class="thing ${selected?.id === s.id ? "on" : ""}" data-pick-sprite="${s.id}">
          <img src="${picUrl(s.frames[0]!, SPRITE_PX, SPRITE_PX)}" alt="" /><span>${escapeHtml(s.name)}</span>
        </button></li>`
        )
        .join("")}
    </ul>
    <button type="button" class="add" data-add-sprite>+ New sprite</button>
    <h3>Backgrounds</h3>
    <ul class="thing-list">
      ${g.backgrounds
        .map(
          (b, i) => `
        <li><button type="button" class="thing wide ${selected?.id === b.id ? "on" : ""}" data-pick-bg="${b.id}">
          <img src="${picUrl(b.pic, BG_W, BG_H)}" alt="" /><span>${i === 0 ? "⭐ " : ""}${escapeHtml(b.name)}</span>
        </button></li>`
        )
        .join("")}
    </ul>
    <button type="button" class="add" data-add-bg>+ New background</button>
  `;
}

function bindSide(side: HTMLElement): void {
  side.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!target || !game) return;
    if (target.dataset["pickSprite"]) {
      selected = { kind: "sprite", id: target.dataset["pickSprite"] };
      frameIndex = 0;
    } else if (target.dataset["pickBg"]) {
      selected = { kind: "bg", id: target.dataset["pickBg"] };
      stageBg = target.dataset["pickBg"];
      panel = "paint";
    } else if (target.hasAttribute("data-add-sprite")) {
      const sprite: Sprite = {
        id: newId(),
        name: `Sprite ${game.sprites.length + 1}`,
        frames: [".".repeat(SPRITE_PX * SPRITE_PX)],
        x: 120 + Math.round(Math.random() * 240),
        y: 100 + Math.round(Math.random() * 160),
        size: 100,
        rules: [],
      };
      game.sprites.push(sprite);
      selected = { kind: "sprite", id: sprite.id };
      panel = "paint";
      frameIndex = 0;
      saveSoon();
    } else if (target.hasAttribute("data-add-bg")) {
      const bg: Background = { id: newId(), name: `Background ${game.backgrounds.length + 1}`, pic: "1".repeat(BG_W * BG_H) };
      game.backgrounds.push(bg);
      selected = { kind: "bg", id: bg.id };
      stageBg = bg.id;
      panel = "paint";
      saveSoon();
    } else {
      return;
    }
    renderSide();
    renderPanel();
    drawStage();
  });
}

// --- The right-hand panel: painting and rules ------------------------------

function currentPic(): { pic: string; w: number; h: number } | null {
  if (!selected) return null;
  if (selected.kind === "sprite") {
    const sprite = spriteById(selected.id);
    if (!sprite) return null;
    frameIndex = Math.min(frameIndex, sprite.frames.length - 1);
    return { pic: sprite.frames[frameIndex]!, w: SPRITE_PX, h: SPRITE_PX };
  }
  const bg = bgById(selected.id);
  return bg ? { pic: bg.pic, w: BG_W, h: BG_H } : null;
}

function setCurrentPic(pic: string): void {
  if (!selected) return;
  if (selected.kind === "sprite") spriteById(selected.id)!.frames[frameIndex] = pic;
  else bgById(selected.id)!.pic = pic;
}

function renderPanel(): void {
  const el = document.querySelector<HTMLElement>("#panel");
  if (!el || !game || !selected) return;
  const sprite = selected.kind === "sprite" ? spriteById(selected.id) : undefined;
  const bg = selected.kind === "bg" ? bgById(selected.id) : undefined;
  const thing = sprite ?? bg;
  if (!thing) return;
  if (!sprite) panel = "paint";
  el.innerHTML = `
    <div class="panel-head">
      <input class="thing-name" data-thing-name value="${escapeHtml(thing.name)}" maxlength="30" aria-label="Name" />
      ${bg && game.backgrounds[0] !== bg ? `<button type="button" class="small" data-start-bg title="The game starts on this background">⭐ Start here</button>` : ""}
      <button type="button" class="small danger" data-delete-thing ${bg && game.backgrounds.length === 1 ? "disabled" : ""}>🗑 Delete</button>
    </div>
    ${
      sprite
        ? `<div class="tabs">
            <button type="button" class="tab ${panel === "paint" ? "on" : ""}" data-tab="paint">🎨 Paint</button>
            <button type="button" class="tab ${panel === "rules" ? "on" : ""}" data-tab="rules">⚙️ Rules <span class="count">${sprite.rules.length}</span></button>
          </div>`
        : ""
    }
    <div class="panel-body">${panel === "paint" ? paintHtml(sprite) : rulesHtml(sprite!)}</div>
  `;
  if (panel === "paint") {
    const canvas = el.querySelector<HTMLCanvasElement>("#painter")!;
    bindPainter(canvas);
    drawPainter();
  }
}

function paintHtml(sprite: Sprite | undefined): string {
  return `
    <div class="tools">
      <button type="button" class="tool ${tool === "pen" ? "on" : ""}" data-tool="pen">✏️ Pen</button>
      <button type="button" class="tool ${tool === "fill" ? "on" : ""}" data-tool="fill">🪣 Fill</button>
      <button type="button" class="tool ${tool === "erase" ? "on" : ""}" data-tool="erase">🧽 Eraser</button>
      <button type="button" class="tool" data-clear>Clear</button>
    </div>
    <div class="palette">
      ${PALETTE.map(
        (p) =>
          `<button type="button" class="swatch ${paint === p.ch && tool !== "erase" ? "on" : ""}" data-color="${p.ch}" style="background:${p.color}" title="${p.name}" aria-label="${p.name}"></button>`
      ).join("")}
    </div>
    <canvas class="painter ${sprite ? "" : "wide"}" id="painter"></canvas>
    ${
      sprite
        ? `<div class="frames-head"><b>Frames</b> <span class="muted">(more than one = an animation)</span></div>
          <div class="frames">
            ${sprite.frames
              .map(
                (f, i) =>
                  `<button type="button" class="frame ${i === frameIndex ? "on" : ""}" data-frame="${i}" aria-label="Frame ${i + 1}"><img src="${picUrl(f, SPRITE_PX, SPRITE_PX)}" alt="" /><span>${i + 1}</span></button>`
              )
              .join("")}
            <button type="button" class="frame add-frame" data-add-frame title="Copy this frame into a new one">+</button>
          </div>
          <div class="frame-buttons">
            <button type="button" class="small" data-preview>▶ Preview animation</button>
            <button type="button" class="small danger" data-delete-frame ${sprite.frames.length === 1 ? "disabled" : ""}>Delete this frame</button>
          </div>
          <label class="size-row">Size <input type="range" min="25" max="300" step="5" value="${sprite.size}" data-size /> <span>${sprite.size}%</span></label>`
        : ""
    }
  `;
}

function drawPainter(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#painter");
  const current = currentPic();
  if (!canvas || !current) return;
  const cell = current.w === SPRITE_PX ? 11 : 6;
  canvas.width = current.w * cell;
  canvas.height = current.h * cell;
  const ctx = canvas.getContext("2d")!;
  // A checkerboard shows which pixels are see-through.
  for (let y = 0; y < current.h; y += 1) {
    for (let x = 0; x < current.w; x += 1) {
      const ch = current.pic[y * current.w + x]!;
      const rgb = RGB.get(ch);
      ctx.fillStyle = rgb ? `rgb(${rgb.join(",")})` : (x + y) % 2 ? "#e6e6ee" : "#ffffff";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  if (cell > 8) {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= current.w; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(canvas.width, i * cell + 0.5);
      ctx.stroke();
    }
  }
}

function floodFill(pic: string, w: number, h: number, start: number, ch: string): string {
  const px = pic.split("");
  const from = px[start];
  if (from === ch) return pic;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (px[i] !== from) continue;
    px[i] = ch;
    const x = i % w;
    const y = Math.floor(i / w);
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  return px.join("");
}

function bindPainter(canvas: HTMLCanvasElement): void {
  let painting = false;
  const paintAt = (e: PointerEvent): void => {
    const current = currentPic();
    if (!current) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * current.w);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * current.h);
    if (x < 0 || y < 0 || x >= current.w || y >= current.h) return;
    const i = y * current.w + x;
    const ch = tool === "erase" ? (selected?.kind === "bg" ? "1" : ".") : paint;
    let pic = current.pic;
    if (tool === "fill") pic = floodFill(pic, current.w, current.h, i, ch);
    else if (pic[i] !== ch) pic = pic.slice(0, i) + ch + pic.slice(i + 1);
    else return;
    setCurrentPic(pic);
    drawPainter();
    drawStage();
  };
  canvas.addEventListener("pointerdown", (e) => {
    painting = tool !== "fill";
    canvas.setPointerCapture(e.pointerId);
    paintAt(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (painting) paintAt(e);
  });
  const stop = (): void => {
    if (!painting && tool !== "fill") return;
    painting = false;
    saveSoon();
    renderSide();
    // Refresh the frame thumbnails without rebuilding the painter.
    const frame = document.querySelector<HTMLImageElement>(`[data-frame="${frameIndex}"] img`);
    const current = currentPic();
    if (frame && current) frame.src = picUrl(current.pic, current.w, current.h);
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
}

function rulesHtml(sprite: Sprite): string {
  const others = game!.sprites.filter((s) => s.id !== sprite.id);
  const option = (value: string, label: string, current: string | undefined): string =>
    `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
  const whenExtra = (when: Trigger): string => {
    if (when.type === "key") return `<select data-when="key">${KEYS.map((k) => option(k, KEY_NAMES[k] ?? k.toUpperCase(), when.key)).join("")}</select>`;
    if (when.type === "touch")
      return `<select data-when="other">${option("edge", "the edge of the screen", when.other)}${others.map((s) => option(s.id, s.name, when.other)).join("")}</select>`;
    if (when.type === "timer") return `<input type="number" min="0.2" step="0.5" value="${when.seconds ?? 2}" data-when="seconds" /> seconds`;
    return "";
  };
  const fieldHtml = (action: Action, field: Field): string => {
    if (field === "dir") return `<select data-field="dir">${(["up", "down", "left", "right"] as Dir[]).map((d) => option(d, d, action.dir)).join("")}</select>`;
    if (field === "n") return `<input type="number" step="1" value="${action.n ?? 0}" data-field="n" />`;
    if (field === "xy")
      return `x <input type="text" class="spot" value="${action.x ?? 0}" data-field="x" title="A number, or type random" /> y <input type="text" class="spot" value="${action.y ?? 0}" data-field="y" title="A number, or type random" />`;
    if (field === "text") return `<input type="text" maxlength="60" value="${escapeHtml(action.text ?? "")}" data-field="text" />`;
    if (field === "bg") return `<select data-field="bg">${game!.backgrounds.map((b) => option(b.id, b.name, action.bg)).join("")}</select>`;
    return `<select data-field="sound">${SOUNDS.map((s) => option(s.id, s.name, action.sound)).join("")}</select><button type="button" class="small" data-hear title="Listen">🔊</button>`;
  };
  return `
    ${sprite.rules.length === 0 ? `<p class="muted">No rules yet. Rules make things happen when you play.</p>` : ""}
    ${sprite.rules
      .map(
        (rule, r) => `
      <div class="rule" data-rule="${r}">
        <div class="rule-when">
          <b>When</b>
          <select data-when="type">${TRIGGERS.map((t) => option(t.type, t.label, rule.when.type)).join("")}</select>
          ${whenExtra(rule.when)}
          <button type="button" class="x" data-delete-rule aria-label="Delete rule">✕</button>
        </div>
        <ol class="rule-do">
          ${rule.actions
            .map(
              (action, a) => `
            <li data-action="${a}">
              <select data-field="type">${ACTIONS.map((def) => option(def.type, def.label, action.type)).join("")}</select>
              ${(ACTIONS.find((def) => def.type === action.type)?.fields ?? []).map((f) => fieldHtml(action, f)).join(" ")}
              <button type="button" class="x" data-delete-action aria-label="Delete">✕</button>
            </li>`
            )
            .join("")}
        </ol>
        <button type="button" class="add small" data-add-action>+ Add something to do</button>
      </div>`
      )
      .join("")}
    <button type="button" class="add" data-add-rule>+ New rule</button>
  `;
}

let previewTimer = 0;

function bindPanel(el: HTMLElement): void {
  el.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!target || !game || !selected) return;
    const sprite = selected.kind === "sprite" ? spriteById(selected.id) : undefined;
    const ruleEl = target.closest<HTMLElement>("[data-rule]");
    const rule = sprite && ruleEl ? sprite.rules[Number(ruleEl.dataset["rule"])] : undefined;
    const actionEl = target.closest<HTMLElement>("[data-action]");
    const d = target.dataset;
    if (d["tab"]) panel = d["tab"] as typeof panel;
    else if (d["tool"]) tool = d["tool"] as typeof tool;
    else if (d["color"]) {
      paint = d["color"];
      if (tool === "erase") tool = "pen";
    } else if (target.hasAttribute("data-clear")) {
      const current = currentPic();
      if (!current) return;
      setCurrentPic((selected.kind === "bg" ? "1" : ".").repeat(current.w * current.h));
      saveSoon();
      renderSide();
    } else if (d["frame"]) frameIndex = Number(d["frame"]);
    else if (target.hasAttribute("data-add-frame") && sprite) {
      sprite.frames.splice(frameIndex + 1, 0, sprite.frames[frameIndex]!);
      frameIndex += 1;
      saveSoon();
    } else if (target.hasAttribute("data-delete-frame") && sprite && sprite.frames.length > 1) {
      sprite.frames.splice(frameIndex, 1);
      frameIndex = Math.max(0, frameIndex - 1);
      saveSoon();
      renderSide();
    } else if (target.hasAttribute("data-preview") && sprite) {
      // Flip through the frames on the stage, once.
      window.clearInterval(previewTimer);
      let i = 0;
      previewTimer = window.setInterval(() => {
        frameIndex = i % sprite.frames.length;
        drawStage();
        i += 1;
        if (i > sprite.frames.length) {
          window.clearInterval(previewTimer);
          renderPanel();
        }
      }, 140);
      return;
    } else if (target.hasAttribute("data-start-bg")) {
      const index = game.backgrounds.findIndex((b) => b.id === selected!.id);
      game.backgrounds.unshift(...game.backgrounds.splice(index, 1));
      saveSoon();
      renderSide();
    } else if (target.hasAttribute("data-delete-thing")) {
      if (!confirm("Delete this forever?")) return;
      if (selected.kind === "sprite") game.sprites = game.sprites.filter((s) => s.id !== selected!.id);
      else if (game.backgrounds.length > 1) game.backgrounds = game.backgrounds.filter((b) => b.id !== selected!.id);
      stageBg = game.backgrounds[0]!.id;
      selected = game.sprites[0] ? { kind: "sprite", id: game.sprites[0].id } : { kind: "bg", id: stageBg };
      frameIndex = 0;
      saveSoon();
      renderSide();
    } else if (target.hasAttribute("data-add-rule") && sprite) {
      sprite.rules.push({ id: newId(), when: { type: "click" }, actions: [{ type: "say", text: "Hi!" }] });
      saveSoon();
    } else if (target.hasAttribute("data-delete-rule") && sprite && ruleEl) {
      sprite.rules.splice(Number(ruleEl.dataset["rule"]), 1);
      saveSoon();
    } else if (target.hasAttribute("data-add-action") && rule) {
      rule.actions.push({ type: "move", dir: "right", n: 10 });
      saveSoon();
    } else if (target.hasAttribute("data-delete-action") && rule && actionEl) {
      rule.actions.splice(Number(actionEl.dataset["action"]), 1);
      saveSoon();
    } else if (target.hasAttribute("data-hear") && rule && actionEl) {
      playSound(rule.actions[Number(actionEl.dataset["action"])]?.sound);
      return;
    } else return;
    renderPanel();
    drawStage();
  });

  // Typing and picking in the rules and names.
  const edit = (e: Event, typing: boolean): void => {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (!game || !selected) return;
    const sprite = selected.kind === "sprite" ? spriteById(selected.id) : undefined;
    if (input.hasAttribute("data-thing-name")) {
      const thing = sprite ?? bgById(selected.id);
      if (thing) thing.name = input.value || "Untitled";
      saveSoon();
      if (!typing) renderSide();
      return;
    }
    if (input.hasAttribute("data-size") && sprite) {
      sprite.size = Number(input.value);
      input.nextElementSibling!.textContent = `${sprite.size}%`;
      saveSoon();
      drawStage();
      return;
    }
    const ruleEl = input.closest<HTMLElement>("[data-rule]");
    const rule = sprite && ruleEl ? sprite.rules[Number(ruleEl.dataset["rule"])] : undefined;
    if (!rule) return;
    const when = input.dataset["when"];
    if (when === "type") rule.when = { type: input.value as TriggerType, key: "space", other: "edge", seconds: 2 };
    else if (when === "key") rule.when.key = input.value;
    else if (when === "other") rule.when.other = input.value;
    else if (when === "seconds") rule.when.seconds = Math.max(0.2, Number(input.value) || 1);
    const actionEl = input.closest<HTMLElement>("[data-action]");
    const action = actionEl ? rule.actions[Number(actionEl.dataset["action"])] : undefined;
    const field = input.dataset["field"];
    if (action && field) {
      if (field === "type") {
        rule.actions[Number(actionEl!.dataset["action"])] = ACTIONS.find((def) => def.type === input.value)!.make();
      } else if (field === "x" || field === "y") {
        action[field] = /^\s*random\s*$/i.test(input.value) ? "random" : Number(input.value) || 0;
      } else if (field === "n") action.n = Number(input.value) || 0;
      else if (field === "dir") action.dir = input.value as Dir;
      else if (field === "text") action.text = input.value;
      else if (field === "bg") action.bg = input.value;
      else if (field === "sound") {
        action.sound = input.value as SoundId;
        playSound(action.sound);
      }
    }
    saveSoon();
    // Picking something new can change which boxes show up.
    if (input.tagName === "SELECT") renderPanel();
  };
  el.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).tagName !== "SELECT") edit(e, true);
  });
  el.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "SELECT" || target.hasAttribute("data-thing-name")) edit(e, false);
  });
}

// ---------------------------------------------------------------------------
// Playing

let playReturn: "browser" | "editor" = "browser";

interface Actor {
  sprite: Sprite;
  x: number;
  y: number;
  size: number;
  frame: number;
  visible: boolean;
  angle: number;
  spinLeft: number;
  anim: "none" | "once" | "loop";
  animClock: number;
  animStep: number;
  say: string;
  sayUntil: number;
}

interface Run {
  actor: Actor;
  rule: Rule;
  pc: number;
  wait: number;
}

const ANIM_FPS = 8;

function keyName(e: KeyboardEvent): string | null {
  const map: Record<string, string> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "space" };
  if (map[e.key]) return map[e.key]!;
  return /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : null;
}

function renderPlay(): void {
  const g = game!;
  app.innerHTML = `
    <div class="editor-top">
      <button type="button" class="text-button" data-stop>■ Stop</button>
      <span class="game-name playing">${escapeHtml(g.name)}</span>
      <button type="button" class="small" data-restart>↻ Restart</button>
    </div>
    <div class="play-wrap">
      <canvas class="stage play" id="play" width="${STAGE_W}" height="${STAGE_H}" tabindex="0"></canvas>
      <div class="play-over" id="play-over" hidden></div>
    </div>
  `;
  const canvas = app.querySelector<HTMLCanvasElement>("#play")!;
  const over = app.querySelector<HTMLElement>("#play-over")!;
  const ctx = canvas.getContext("2d")!;
  canvas.focus();

  let actors: Actor[] = [];
  let runs: Run[] = [];
  let bgId = "";
  let time = 0;
  let lightsOn = true;
  let lightActor: Actor | null = null;
  let scareAt = -1;
  let scareActor: Actor | null = null;
  let ended = false;
  let timers = new Map<string, number>();
  const held = new Set<string>();
  let frame = 0;
  let last = performance.now();
  const three = g.three?.on ? g.three : null;
  // Where each sprite was drawn last frame (in 3D that's not where it is on
  // the map), for clicks, speech bubbles and the flashlight.
  let spots = new Map<Actor, ScreenSpot>();

  function currentBg(): Background {
    return g.backgrounds.find((b) => b.id === bgId) ?? g.backgrounds[0]!;
  }

  // In a 3D game with walls, nobody can stand inside a wall.
  function blocked(x: number, y: number): boolean {
    return !!three?.wall && isWall({ pic: currentBg().pic, bgW: BG_W, bgH: BG_H, wall: three.wall }, x, y);
  }

  function start(): void {
    actors = g.sprites.map((sprite) => ({
      sprite,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      frame: 0,
      visible: true,
      angle: 0,
      spinLeft: 0,
      anim: "none",
      animClock: 0,
      animStep: 0,
      say: "",
      sayUntil: 0,
    }));
    runs = [];
    bgId = g.backgrounds[0]!.id;
    time = 0;
    lightsOn = true;
    lightActor = null;
    scareAt = -1;
    ended = false;
    timers = new Map();
    over.hidden = true;
    for (const actor of actors) for (const rule of actor.sprite.rules) if (rule.when.type === "start") begin(actor, rule);
  }

  function running(actor: Actor, rule: Rule): boolean {
    return runs.some((r) => r.actor === actor && r.rule === rule);
  }

  function begin(actor: Actor, rule: Rule): void {
    if (!running(actor, rule)) runs.push({ actor, rule, pc: 0, wait: 0 });
  }

  function half(actor: Actor): number {
    return (SPRITE_STAGE * actor.size) / 100 / 2;
  }

  function touching(a: Actor, other: string | undefined): boolean {
    if (!a.visible) return false;
    const ha = half(a) * 0.8;
    if (other === "edge") return a.x - ha <= 0 || a.y - ha <= 0 || a.x + ha >= STAGE_W || a.y + ha >= STAGE_H;
    return actors.some((b) => {
      if (b === a || b.sprite.id !== other || !b.visible) return false;
      const hb = half(b) * 0.8;
      return Math.abs(a.x - b.x) < ha + hb && Math.abs(a.y - b.y) < ha + hb;
    });
  }

  function finish(won: boolean): void {
    ended = true;
    runs = [];
    if (won) powerUp();
    else buzzer();
    over.hidden = false;
    over.className = `play-over ${won ? "won" : "lost"}`;
    over.innerHTML = `
      <h2>${won ? "🏆 YOU WIN!" : "💀 GAME OVER"}</h2>
      <div class="over-buttons">
        <button type="button" class="big-button" data-again>↻ Play again</button>
        <button type="button" class="text-button" data-leave>${playReturn === "editor" ? "← Back to making it" : "← My Games"}</button>
      </div>
    `;
    over.querySelector("[data-again]")!.addEventListener("click", () => {
      start();
      canvas.focus();
    });
    over.querySelector("[data-leave]")!.addEventListener("click", leave);
  }

  // Does one thing from a rule. "Wait" sets run.wait so the rule pauses.
  function act(run: Run, action: Action): void {
    const a = run.actor;
    switch (action.type) {
      case "move": {
        const n = action.n ?? 0;
        let { x, y } = a;
        if (action.dir === "up") y -= n;
        else if (action.dir === "down") y += n;
        else if (action.dir === "left") x -= n;
        else x += n;
        x = Math.max(0, Math.min(STAGE_W, x));
        y = Math.max(0, Math.min(STAGE_H, y));
        if (!blocked(x, y)) {
          a.x = x;
          a.y = y;
        }
        break;
      }
      case "goto":
        // "random" picks a new spot every time (and keeps trying if it lands
        // in a wall).
        for (let tries = 0; tries < 30; tries += 1) {
          const x = action.x === "random" ? 30 + Math.random() * (STAGE_W - 60) : (action.x ?? 0);
          const y = action.y === "random" ? 30 + Math.random() * (STAGE_H - 60) : (action.y ?? 0);
          if (blocked(x, y)) continue;
          a.x = x;
          a.y = y;
          break;
        }
        break;
      case "random":
        for (let tries = 0; tries < 30; tries += 1) {
          const x = 30 + Math.random() * (STAGE_W - 60);
          const y = 30 + Math.random() * (STAGE_H - 60);
          if (blocked(x, y)) continue;
          a.x = x;
          a.y = y;
          break;
        }
        break;
      case "background":
        if (g.backgrounds.some((b) => b.id === action.bg)) bgId = action.bg!;
        break;
      case "animate":
        a.anim = "once";
        a.animClock = 0;
        a.animStep = 0;
        break;
      case "animateForever":
        a.anim = "loop";
        break;
      case "stopAnimating":
        a.anim = "none";
        break;
      case "costume":
        a.frame = (a.frame + 1) % a.sprite.frames.length;
        break;
      case "say":
        a.say = action.text ?? "";
        a.sayUntil = time + 2.5;
        break;
      case "sound":
        playSound(action.sound);
        break;
      case "scare":
        scareAt = time;
        scareActor = a;
        scream();
        thunder();
        break;
      case "lightsOff":
        lightsOn = false;
        lightActor = a;
        break;
      case "lightsOn":
        lightsOn = true;
        break;
      case "hide":
        a.visible = false;
        break;
      case "show":
        a.visible = true;
        break;
      case "grow":
        a.size = Math.max(10, Math.min(600, a.size + (action.n ?? 0)));
        break;
      case "spin":
        a.spinLeft += Math.PI * 2;
        whoosh(0.4);
        break;
      case "wait":
        run.wait = Math.max(0, action.n ?? 0);
        break;
      case "win":
        finish(true);
        break;
      case "lose":
        finish(false);
        break;
    }
  }

  function update(dt: number): void {
    time += dt;
    for (const actor of actors) {
      for (const rule of actor.sprite.rules) {
        const when = rule.when;
        if (when.type === "key" && when.key && held.has(when.key)) begin(actor, rule);
        else if (when.type === "touch" && touching(actor, when.other)) begin(actor, rule);
        else if (when.type === "timer") {
          const key = `${actor.sprite.id}:${rule.id}`;
          const next = timers.get(key) ?? (when.seconds ?? 2);
          if (time >= next) {
            timers.set(key, time + Math.max(0.2, when.seconds ?? 2));
            begin(actor, rule);
          } else timers.set(key, next);
        }
      }
    }
    // Run each rule until it finishes or has to wait. A safety limit stops a
    // rule with lots of steps from freezing the game.
    for (const run of [...runs]) {
      if (ended) break;
      if (run.wait > 0) {
        run.wait -= dt;
        if (run.wait > 0) continue;
      }
      let steps = 0;
      while (run.pc < run.rule.actions.length && run.wait <= 0 && steps < 200 && !ended) {
        act(run, run.rule.actions[run.pc]!);
        run.pc += 1;
        steps += 1;
      }
      if (run.pc >= run.rule.actions.length && run.wait <= 0) runs = runs.filter((r) => r !== run);
    }
    for (const actor of actors) {
      if (actor.anim !== "none") {
        actor.animClock += dt;
        while (actor.animClock >= 1 / ANIM_FPS) {
          actor.animClock -= 1 / ANIM_FPS;
          actor.frame = (actor.frame + 1) % actor.sprite.frames.length;
          actor.animStep += 1;
          if (actor.anim === "once" && actor.animStep >= actor.sprite.frames.length) {
            actor.anim = "none";
            actor.frame = 0;
          }
        }
      }
      if (actor.spinLeft > 0) {
        const turn = Math.min(actor.spinLeft, dt * 12);
        actor.angle += turn;
        actor.spinLeft -= turn;
      }
    }
  }

  function draw(): void {
    ctx.imageSmoothingEnabled = false;
    const shaking = scareAt >= 0 && time - scareAt < 0.9;
    ctx.save();
    if (shaking) ctx.translate((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24);
    const bg = currentBg();
    const image = (actor: Actor): HTMLCanvasElement => picCanvas(actor.sprite.frames[actor.frame] ?? actor.sprite.frames[0]!, SPRITE_PX, SPRITE_PX);
    spots = new Map();
    if (three) {
      const follow = actors.find((a) => a.sprite.id === three.follow);
      const wallColor = PALETTE.find((p) => p.ch === three.wall)?.color;
      const shown = actors.filter((a) => a.visible);
      const drawn = draw3D(
        ctx,
        {
          floor: picCanvas(bg.pic, BG_W, BG_H),
          pic: bg.pic,
          bgW: BG_W,
          bgH: BG_H,
          wall: three.wall || null,
          wallColor: wallColor ? [parseInt(wallColor.slice(1, 3), 16), parseInt(wallColor.slice(3, 5), 16), parseInt(wallColor.slice(5, 7), 16)] : null,
          camX: follow?.x ?? STAGE_W / 2,
          camY: follow?.y ?? STAGE_H / 2,
          width: STAGE_W,
          height: STAGE_H,
        },
        shown.map((a, key) => ({ key, image: image(a), x: a.x, y: a.y, size: half(a) * 2, angle: a.angle }))
      );
      for (const spot of drawn) spots.set(shown[spot.key]!, spot);
    } else {
      ctx.drawImage(picCanvas(bg.pic, BG_W, BG_H), 0, 0, STAGE_W, STAGE_H);
      for (const actor of actors) {
        if (!actor.visible) continue;
        const size = half(actor) * 2;
        ctx.save();
        ctx.translate(actor.x, actor.y);
        ctx.rotate(actor.angle);
        ctx.drawImage(image(actor), -size / 2, -size / 2, size, size);
        ctx.restore();
        spots.set(actor, { key: 0, x: actor.x - size / 2, y: actor.y - size / 2, w: size, h: size });
      }
    }
    if (!lightsOn) {
      const spot = lightActor ? spots.get(lightActor) : undefined;
      const cx = spot ? spot.x + spot.w / 2 : STAGE_W / 2;
      const cy = spot ? spot.y + spot.h / 2 : STAGE_H / 2;
      const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 120);
      glow.addColorStop(0, "rgba(0,0,0,0)");
      glow.addColorStop(1, "rgba(0,0,0,0.97)");
      ctx.fillStyle = glow;
      ctx.fillRect(-20, -20, STAGE_W + 40, STAGE_H + 40);
    }
    for (const actor of actors) {
      const spot = spots.get(actor);
      if (!spot || !actor.say || time > actor.sayUntil) continue;
      ctx.font = "bold 14px 'DM Sans', sans-serif";
      const w = ctx.measureText(actor.say).width + 16;
      const x = Math.max(4, Math.min(STAGE_W - w - 4, spot.x + spot.w / 2 - w / 2));
      const y = Math.max(4, spot.y - 34);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, 26, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.fillText(actor.say, x + 8, y + 18);
    }
    if (shaking && scareActor) {
      // The jump scare: the sprite fills the whole screen, flashing red.
      const t = time - scareAt;
      ctx.fillStyle = t % 0.16 < 0.08 ? "rgba(120,0,0,0.85)" : "rgba(0,0,0,0.9)";
      ctx.fillRect(-20, -20, STAGE_W + 40, STAGE_H + 40);
      const size = STAGE_H * (1.1 + t * 0.4);
      ctx.drawImage(picCanvas(scareActor.sprite.frames[scareActor.frame] ?? scareActor.sprite.frames[0]!, SPRITE_PX, SPRITE_PX), STAGE_W / 2 - size / 2, STAGE_H / 2 - size / 2, size, size);
    }
    ctx.restore();
  }

  function tick(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!ended) update(dt);
    draw();
    frame = requestAnimationFrame(tick);
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    const key = keyName(e);
    if (!key) return;
    if (key === "space" || ["up", "down", "left", "right"].includes(key)) e.preventDefault();
    held.add(key);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    const key = keyName(e);
    if (key) held.delete(key);
  };
  const onBlur = (): void => held.clear();
  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    if (ended) return;
    const p = stagePoint(canvas, e);
    // Whatever was drawn last (nearest, in 3D) gets the click.
    const hit = [...spots.entries()].reverse().find(([, s]) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h)?.[0];
    if (!hit) return;
    for (const rule of hit.sprite.rules) if (rule.when.type === "click") begin(hit, rule);
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  function leave(): void {
    go(playReturn);
  }
  app.querySelector("[data-stop]")!.addEventListener("click", leave);
  app.querySelector("[data-restart]")!.addEventListener("click", () => {
    start();
    canvas.focus();
  });

  start();
  frame = requestAnimationFrame(tick);
  cleanup = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
  };
}

go("browser");
