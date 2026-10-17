import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { makeModels, type MadeModel, type Move } from "./models";
import { playMusicBoxNote, playSound } from "./sounds";
import { openDollhouse } from "./dollhouse";
import { openCity } from "./city";
import { openRace } from "./race";
import { openArcade, type ArcadeGame } from "./arcade";
import { openWalk } from "./walk";
import { save as saveCity, state as cityState } from "./state";
import { buildModel, drawModel, type Built } from "./render3d";

installOofShortcut();
installForceRefreshHotkey();

// Penelope's idea: a room with cardboard boxes all over it. Write a thing
// you love on a box and it gets taped shut with the writing on the front.
// Open it back up and put something in, and a 3D model of the thing pops
// up out of the box. Put it on the shelf to keep it; the ones you can play
// with go on the Play Shelf, where clicking them makes them do stuff.
// Everything stays put for next time.

const W = 960;
const H = 600;
const FLOOR_Y = 330;
const BOX_W = 120;
const BOX_H = 92;
const LID_H = 22;
const START_BOXES = 12;
const MAX_BOXES = 30;
const DRAG_PX = 6;
const SAVE_KEY = "things-i-love-boxes";
const SHELF_KEY = "things-i-love-shelf";
// A few shades of cardboard so the room doesn't look like one big stack.
const COLORS = [
  { front: "#c9965f", top: "#ddb07a", dark: "#a8774a" },
  { front: "#bf8a52", top: "#d5a46c", dark: "#9c6d40" },
  { front: "#d2a46e", top: "#e4bd8a", dark: "#b0855a" },
  { front: "#b98450", top: "#cf9e68", dark: "#94683e" },
];

interface Box {
  x: number;
  y: number;
  color: number;
  thing: string; // written on the front
  inside: string[];
}

interface Floater {
  x: number;
  y: number;
  age: number;
  kind: "heart" | "sparkle";
  drift: number;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const roomCtx = canvas.getContext("2d")!;
const peek = document.getElementById("peek") as HTMLCanvasElement;
const peekCtx = peek.getContext("2d")!;
// The drawing helpers all draw with `ctx`. It's the room, except while the
// close-up of the box in the panel is being drawn.
let ctx = roomCtx;
const panel = document.getElementById("box-panel")!;
const panelTitle = document.getElementById("box-title")!;
const writeView = document.getElementById("write-view") as HTMLFormElement;
const closedView = document.getElementById("closed-view")!;
const openView = document.getElementById("open-view")!;
const panelText = document.getElementById("box-text") as HTMLInputElement;
const closedNote = document.getElementById("closed-note")!;
const openButton = document.getElementById("open-box") as HTMLButtonElement;
const rewriteButton = document.getElementById("rewrite") as HTMLButtonElement;
const emptyButton = document.getElementById("box-empty") as HTMLButtonElement;
const closeBoxButton = document.getElementById("close-box") as HTMLButtonElement;
const insideList = document.getElementById("inside-list")!;
const insideForm = document.getElementById("inside-form") as HTMLFormElement;
const insideText = document.getElementById("inside-text") as HTMLInputElement;
const modelNote = document.getElementById("model-note")!;
const toShelfButton = document.getElementById("to-shelf") as HTMLButtonElement;
const shelfEl = document.getElementById("shelf")!;
const playShelfEl = document.getElementById("play-shelf")!;
const addButton = document.getElementById("add-box") as HTMLButtonElement;
const deleteAllButton = document.getElementById("delete-all") as HTMLButtonElement;
const countText = document.getElementById("count")!;

const savedBoxes = loadBoxes();
const boxes: Box[] = savedBoxes ?? [];
const floaters: Floater[] = [];
let openBox: Box | null = null;
let hoverBox: Box | null = null;
// How open the box in the panel is (0 = taped shut, 1 = flaps up), which
// model inside is showing, and how it's spun around.
let peekOpen = 0;
let peekOpening = false;
let selected = 0;
let riseStart = 0;
let yaw = 0.6;
let spinDrag: { x: number; yaw: number; moved: boolean } | null = null;
let peekPlayStart: number | null = null;
const made = new Map<string, { models: MadeModel[]; built: Built[] }>();

function modelsFor(thing: string): { models: MadeModel[]; built: Built[] } {
  let m = made.get(thing);
  if (!m) {
    const models = makeModels(thing);
    m = { models, built: models.map((model) => buildModel(model.parts)) };
    made.set(thing, m);
  }
  return m;
}

const canPlay = (thing: string): boolean => modelsFor(thing).models.some((m) => m.act);

// ---- Blood ----
// Oscar's secret for his sister: put blood in a box and the game goes a bit
// staticky and creepy. Just a little (she's 6): the colours drain out, faint
// TV static fuzzes over the room, it turns to night, the boxes sway like
// they're breathing, a wobbly music box plays, and now and then the lights
// flicker, the writing on the boxes goes "???" and little eyes peek out of an
// empty box (and hide if you point at them). No jump scares, nothing gory,
// and it all fades away once the blood is out.

const isBlood = (thing: string): boolean => /\bblood/i.test(thing);
let creep = 0;
let nextFlicker = 0;
let flickerUntil = 0;
let peeker: { box: Box; from: number; until: number } | null = null;
let nextPeek = 0;
let nextNote = 0;
let noteIndex = 0;
// "Mary had a little lamb", slow and in a minor key. Zeros are rests.
const LULLABY = [659, 587, 523, 587, 659, 659, 659, 0, 587, 587, 587, 0, 659, 784, 784, 0, 659, 587, 523, 587, 659, 659, 659, 659, 587, 587, 659, 587, 523, 0, 0, 0].map(
  (f) => (f === 659 ? 622 : f === 784 ? 740 : f),
);

function mixColor(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

const glitching = (now: number): boolean => creep > 0.6 && now < flickerUntil;
const title = document.querySelector("h1")!;
const TITLE = title.textContent ?? "Things I Love";
const fuzz = document.createElement("canvas");
fuzz.width = 240;
fuzz.height = 150;
const fuzzCtx = fuzz.getContext("2d")!;
const fuzzPixels = fuzzCtx.createImageData(fuzz.width, fuzz.height);

function makeFuzz(): void {
  const d = fuzzPixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  fuzzCtx.putImageData(fuzzPixels, 0, 0);
}

/** Static over whatever `ctx` is drawing, `amount` from 0 (none) to 1 (all static). */
function drawFuzz(w: number, h: number, amount: number): void {
  if (amount <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, amount);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(fuzz, 0, 0, w, h);
  ctx.restore();
}

function updateCreep(now: number, dt: number): void {
  const wanted = boxes.some((b) => b.inside.some(isBlood)) ? 1 : 0;
  // Creeps in slowly (about 5 seconds), and fades back out a bit faster.
  creep = wanted > creep ? Math.min(1, creep + dt * 0.2) : Math.max(0, creep - dt * 0.5);
  document.body.style.setProperty("--creep", creep.toFixed(3));
  if (creep <= 0) {
    title.textContent = TITLE;
    peeker = null;
    return;
  }
  if (creep > 0.5) countText.textContent = "Something is in one of the boxes…";
  else updateCount();
  if (creep > 0.5 && now > nextNote) {
    const f = LULLABY[noteIndex++ % LULLABY.length]!;
    if (f) playMusicBoxNote(f / 2);
    nextNote = now + 650;
  }
  // Eyes peek out of an empty box now and then, and hide if you look.
  if (peeker && (now > peeker.until || hoverBox === peeker.box || !boxes.includes(peeker.box))) peeker = null;
  if (!peeker && creep > 0.7 && now > nextPeek) {
    const empty = boxes.filter((b) => !b.thing && b !== hoverBox);
    const box = empty[Math.floor(Math.random() * empty.length)];
    if (box) peeker = { box, from: now, until: now + 2500 + Math.random() * 1500 };
    nextPeek = now + 5000 + Math.random() * 5000;
  }
  makeFuzz();
  if (creep > 0.6 && now > nextFlicker) {
    flickerUntil = now + 120 + Math.random() * 120;
    nextFlicker = now + 3500 + Math.random() * 4500;
    playSound("hiss");
    if (Math.random() < 0.5) title.textContent = "Th1ngs I L0ve";
  }
  if (now > flickerUntil && title.textContent !== TITLE) title.textContent = TITLE;
}

/** Two little glowing eyes in the dark inside of an open box. They blink. */
function drawEyes(box: Box, now: number): void {
  const age = now - peeker!.from;
  const fade = Math.min(1, age / 400, (peeker!.until - now) / 300);
  const blink = age % 1400 > 1250;
  if (fade <= 0 || blink) return;
  ctx.save();
  ctx.globalAlpha = fade * creep;
  ctx.fillStyle = "#f4f1d0";
  ctx.shadowColor = "#f4f1d0";
  ctx.shadowBlur = 6;
  const look = Math.sin(age / 600) * 2;
  for (const dx of [-11, 11]) {
    ctx.beginPath();
    ctx.ellipse(box.x + BOX_W / 2 + dx + look, box.y - LID_H * 0.45, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCreep(now: number): void {
  if (creep <= 0) return;
  const flicker = now < flickerUntil;
  drawFuzz(W, H, creep * 0.1 + (flicker ? 0.25 : 0));
  if (flicker) {
    // The lights dip, and a strip of the room slips sideways for a moment.
    ctx.fillStyle = "rgba(20, 10, 30, 0.25)";
    ctx.fillRect(0, 0, W, H);
    const y = Math.random() * (H - 40);
    ctx.drawImage(canvas, 0, y, W, 30, (Math.random() - 0.5) * 30, y, W, 30);
  }
}

// ---- Playing with models ----

const MOVE_MS: Record<Move, number> = { hop: 700, spin: 900, bounce: 1100, zoom: 1500, fall: 1500, drive: 1300, wiggle: 800 };
const easeInOut = (k: number): number => k * k * (3 - 2 * k);

function playLength(thing: string): number {
  return Math.max(0, ...modelsFor(thing).models.map((m) => (m.act ? MOVE_MS[m.act.move] : 0)));
}

/** Makes every model in `thing` that can play make its sound. Returns when it started. */
function startPlaying(thing: string): number {
  modelsFor(thing).models.forEach((m, i) => {
    if (m.act) window.setTimeout(() => playSound(m.act!.sound), i * 250);
  });
  if (modelsFor(thing).models.some((m) => m.name === "magnifying glass")) window.setTimeout(startMagnifying, 500);
  // The Doomsday Device's red button looks like it does nothing... but a
  // meteor is now on its way to the Dino Dimension (see city.ts).
  if (modelsFor(thing).models.some((m) => m.name === "doomsday device") && cityState.meteor === "none") {
    cityState.meteor = "coming";
    saveCity();
  }
  // Houses are dollhouses: after a little hop, it opens up to play in.
  const house = modelsFor(thing).models.find((m) => m.name === "dollhouse");
  if (house) {
    const roof = house.parts.find((p) => p.s === "roof")?.c ?? "#e8383d";
    window.setTimeout(() => openDollhouse(roof), 600);
  }
  // Cars drive you out into the city (after they drive off the shelf).
  const car = modelsFor(thing).models.find((m) => m.name === "car");
  if (car && !house) window.setTimeout(() => openCity(car.parts[0]!.c, { addToShelf, addBox: addMadeBox }), 1300);
  // Go-karts take you to the race track instead.
  const kart = modelsFor(thing).models.find((m) => m.name === "go-kart");
  if (kart && !car && !house) window.setTimeout(() => openRace(kart.parts[0]!.c, { addToShelf }), 1300);
  // The other inventions each open their own game.
  const ARCADE: Record<string, ArcadeGame> = { "bubble machine": "bubbles", "robot dog": "dog", hoverboard: "hover", jetpack: "jet" };
  const invention = modelsFor(thing).models.find((m) => m.name in ARCADE);
  if (invention && !car && !house && !kart) window.setTimeout(() => openArcade(ARCADE[invention.name]!, { addToShelf }), 1000);
  return performance.now();
}

/**
 * Draws everything `thing` names side by side, in a strip `w` wide with its
 * middle at (cx, cy). `grow` (0..1) is for rising out of the box, and
 * `playAge` is how long ago it was clicked, if it's doing its moves.
 */
function drawThing(
  thing: string,
  cx: number,
  cy: number,
  w: number,
  viewH: number,
  maxSize: number,
  spin: number,
  grow: number,
  playAge: number | null,
): void {
  const { models, built } = modelsFor(thing);
  // Up to four in a row; more than that (like "everything") makes two rows.
  const shown = built.slice(0, 8);
  const perRow = Math.min(4, shown.length);
  const rows = Math.ceil(shown.length / Math.max(1, perRow));
  const slot = w / Math.max(1, perRow);
  const size = Math.min(maxSize / rows, slot * 0.42);
  shown.forEach((model, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, shown.length - row * perRow);
    const homeX = cx + (i % perRow - (inRow - 1) / 2) * slot;
    let x = cx + (homeX - cx) * (0.3 + 0.7 * grow);
    let y = cy + (row - (rows - 1) / 2) * size * 2.1 * grow;
    let turn = spin + i * 0.7;
    const act = models[i]!.act;
    if (act && playAge !== null && playAge < MOVE_MS[act.move]) {
      const k = playAge / MOVE_MS[act.move];
      if (act.move === "hop") y -= Math.sin(Math.PI * k) * size * 0.7;
      if (act.move === "spin") turn += easeInOut(k) * Math.PI * 2;
      if (act.move === "bounce") y -= Math.abs(Math.sin(3 * Math.PI * k)) * (1 - k) * size * 1.1;
      if (act.move === "wiggle") turn += Math.sin(k * 6 * Math.PI) * 0.7 * (1 - k);
      // Zooms off the top and comes back up from the bottom.
      if (act.move === "zoom") y += k < 0.5 ? -easeInOut(k * 2) * viewH : (1 - easeInOut((k - 0.5) * 2)) * viewH;
      // Upside-down things fall off the bottom and come back down from the top.
      if (act.move === "fall") y += k < 0.5 ? easeInOut(k * 2) * viewH : -(1 - easeInOut((k - 0.5) * 2)) * viewH;
      // Drives off one side and comes back in from the other.
      if (act.move === "drive") x += k < 0.5 ? easeInOut(k * 2) * w : -(1 - easeInOut((k - 0.5) * 2)) * w;
    }
    drawModel(ctx, model, x, y, size * (0.27 + 0.73 * grow), turn);
  });
  if (playAge !== null && playAge < playLength(thing) + 500) {
    const words = models.filter((m) => m.act).slice(0, 3).map((m) => m.act!.say).join(" ");
    drawBubble(words, cx, 22);
  }
}

function drawBubble(text: string, cx: number, cy: number): void {
  ctx.font = '800 16px "Trebuchet MS", sans-serif';
  const w = Math.min(ctx.canvas.width - 8, ctx.measureText(text).width + 24);
  const x = Math.max(4, Math.min(ctx.canvas.width - w - 4, cx - w / 2));
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ff6fb5";
  ctx.lineWidth = 3;
  roundRect(x, cy - 15, w, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c2186b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, cy + 1, w - 12);
}

// ---- The shelves ----

interface ShelfSpot {
  thing: string;
  canvas: HTMLCanvasElement;
  pen: CanvasRenderingContext2D;
  hover: boolean;
  playStart: number | null;
  spin: number;
  dirty: boolean;
}

const shelf: string[] = loadShelf();
let spots: ShelfSpot[] = [];

function loadShelf(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(SHELF_KEY) ?? "[]");
    if (Array.isArray(saved)) return saved.filter((t): t is string => typeof t === "string");
  } catch {
    // A broken save just means empty shelves.
  }
  return [];
}

function saveShelf(): void {
  localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
}

/** Takes one of something off the shelf (sold at the Farmers Market, or given away). */
function removeFromShelf(thing: string): void {
  const i = shelf.indexOf(thing);
  if (i < 0) return;
  shelf.splice(i, 1);
  saveShelf();
  renderShelves();
  updateCount();
}

/** Puts something straight onto a shelf (like a crystal from the other world). */
function addToShelf(thing: string): void {
  shelf.push(thing);
  saveShelf();
  renderShelves();
  updateCount();
}

/** Something you made (as an Engineer) gets its own box, with its name on it and it inside. */
function addMadeBox(thing: string): "box" | "shelf" {
  if (boxes.length >= MAX_BOXES) {
    addToShelf(thing);
    return "shelf";
  }
  const box = makeBox();
  box.thing = thing;
  box.inside = [thing];
  boxes.push(box);
  burst(box, 8, "heart");
  saveBoxes();
  updateCount();
  return "box";
}

function renderShelves(): void {
  spots = [];
  shelfEl.innerHTML = "";
  playShelfEl.innerHTML = "";
  shelf.forEach((thing, index) => {
    const play = canPlay(thing);
    const item = document.createElement("div");
    item.className = "shelf-item";
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 200;
    canvas.setAttribute("role", play ? "button" : "img");
    canvas.setAttribute("aria-label", play ? `Play with ${thing}` : thing);
    if (play) canvas.tabIndex = 0;
    const label = document.createElement("span");
    label.className = "shelf-label";
    label.textContent = thing;
    const off = document.createElement("button");
    off.type = "button";
    off.className = "take-off";
    off.textContent = "×";
    off.setAttribute("aria-label", `Take ${thing} off the shelf`);
    // Ask twice, so nothing falls off the shelf by accident.
    off.addEventListener("click", () => {
      if (off.textContent === "×") {
        off.textContent = "Sure?";
        return;
      }
      shelf.splice(index, 1);
      saveShelf();
      updateCount();
      renderShelves();
    });
    off.addEventListener("blur", () => (off.textContent = "×"));
    item.append(canvas, label, off);
    (play ? playShelfEl : shelfEl).append(item);

    const spot: ShelfSpot = { thing, canvas, pen: canvas.getContext("2d")!, hover: false, playStart: null, spin: 0.6, dirty: true };
    canvas.addEventListener("pointerenter", () => (spot.hover = true));
    canvas.addEventListener("pointerleave", () => {
      spot.hover = false;
      spot.dirty = true;
    });
    if (play) {
      const go = (): void => {
        spot.playStart = startPlaying(thing);
      };
      canvas.addEventListener("click", go);
      canvas.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    }
    spots.push(spot);
  });
  if (!shelfEl.childElementCount) {
    shelfEl.innerHTML = '<p class="shelf-empty">Nothing here yet. Open a box and put something on the shelf!</p>';
  }
  if (!playShelfEl.childElementCount) {
    playShelfEl.innerHTML = '<p class="shelf-empty">Animals, people, balls, rockets and cars go here.</p>';
  }
}

function drawShelves(now: number, dt: number): void {
  for (const spot of spots) {
    const playing = spot.playStart !== null && now - spot.playStart < playLength(spot.thing) + 500;
    if (!playing) spot.playStart = null;
    if (!spot.hover && !playing && !spot.dirty) continue;
    if (spot.hover) spot.spin += dt * 1.4;
    spot.dirty = playing;
    ctx = spot.pen;
    ctx.clearRect(0, 0, 240, 200);
    drawThing(spot.thing, 120, 112, 240, 200, 70, spot.spin, 1, spot.playStart === null ? null : now - spot.playStart);
    ctx = roomCtx;
  }
}
let emptyArmed = false;
const PEEK_W = 420;
const PEEK_H = 300;
const PEEK_SCALE = 1.5;
let drag: { box: Box; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null = null;

function randomSpot(): { x: number; y: number } {
  // Try a few spots and keep the one farthest from the other boxes, so new
  // boxes spread out instead of piling up.
  let best = { x: 0, y: 0 };
  let bestGap = -1;
  for (let i = 0; i < 30; i++) {
    const spot = {
      x: 20 + Math.random() * (W - BOX_W - 40),
      y: 40 + LID_H + Math.random() * (H - BOX_H - LID_H - 70),
    };
    const gap = Math.min(Infinity, ...boxes.map((b) => Math.hypot(b.x - spot.x, b.y - spot.y)));
    if (gap > bestGap) {
      best = spot;
      bestGap = gap;
    }
  }
  return best;
}

function makeBox(): Box {
  return { ...randomSpot(), color: Math.floor(Math.random() * COLORS.length), thing: "", inside: [] };
}

/** The saved boxes, or null if there's no save yet (a brand new room). */
function loadBoxes(): Box[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (Array.isArray(saved)) {
      return (saved as (Box & { away?: { thing: string } })[]).map(({ away, ...b }) => {
        const inside = Array.isArray(b.inside) ? b.inside : [];
        // Boxes saved while they were out on the old moving truck keep their thing.
        if (away?.thing) inside.push(away.thing);
        return { ...b, inside };
      });
    }
  } catch {
    // A broken save just means a fresh room.
  }
  return null;
}

function saveBoxes(): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(boxes));
}

if (!savedBoxes) {
  for (let i = 0; i < START_BOXES; i++) boxes.push(makeBox());
  saveBoxes();
}

function updateCount(): void {
  const loved = boxes.reduce((n, b) => n + (b.thing ? 1 : 0) + b.inside.length, 0) + shelf.length;
  countText.textContent =
    loved === 0 ? "Open a box to start!" : loved === 1 ? "You love 1 thing ♥" : `You love ${loved} things ♥`;
  addButton.disabled = boxes.length >= MAX_BOXES;
  addButton.firstChild!.textContent = boxes.length >= MAX_BOXES ? "The room is full of boxes! " : "+ Add a box ";
  deleteAllButton.disabled = boxes.length === 0;
}

function boxAt(x: number, y: number): Box | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i]!;
    if (x >= b.x && x <= b.x + BOX_W && y >= b.y - LID_H && y <= b.y + BOX_H) return b;
  }
  return null;
}

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

function burst(box: Box, count: number, kind: Floater["kind"]): void {
  for (let i = 0; i < count; i++) {
    floaters.push({
      x: box.x + BOX_W / 2 + (Math.random() - 0.5) * BOX_W * 0.7,
      y: box.y - LID_H,
      age: -i * 0.06,
      kind,
      drift: (Math.random() - 0.5) * 40,
    });
  }
}

type PanelView = "write" | "closed" | "open";

function showView(view: PanelView): void {
  const box = openBox;
  if (!box) return;
  writeView.hidden = view !== "write";
  closedView.hidden = view !== "closed";
  openView.hidden = view !== "open";
  peek.hidden = view === "write";
  emptyArmed = false;
  emptyButton.textContent = "Empty the box";
  if (view === "write") {
    panelTitle.textContent = box.thing ? "Change the writing" : "An empty box!";
    panelText.value = box.thing;
    panelText.focus();
    panelText.select();
  } else if (view === "closed") {
    panelTitle.textContent = box.thing;
    const n = box.inside.length;
    closedNote.textContent =
      n === 0 ? "It's taped shut. What's inside?" : n === 1 ? "Something is inside!" : `${n} things are inside!`;
    peekOpen = 0;
    peekOpening = false;
    openButton.focus();
  } else {
    panelTitle.textContent = box.thing;
    selected = box.inside.length - 1;
    riseStart = performance.now() + 500;
    renderInside();
    insideText.value = "";
    insideText.focus();
  }
}

function describeSelected(): void {
  const thing = openBox?.inside[selected];
  if (thing === undefined) {
    modelNote.textContent = "It's empty! Put something in.";
    toShelfButton.disabled = true;
    return;
  }
  const { models } = modelsFor(thing);
  toShelfButton.disabled = models.length === 0;
  if (isBlood(thing)) {
    modelNote.textContent = "It's too staticky to see what's in there…";
    return;
  }
  const play = canPlay(thing) ? " Click it to play!" : "";
  modelNote.textContent =
    models.length === 0
      ? `You put ${thing} in. It's just air!`
      : models.some((m) => m.known)
        ? `Here's ${thing}!${play}`
        : `Nobody knows what ${thing} looks like, so here's a mystery present!`;
}

function renderInside(): void {
  const box = openBox;
  if (!box) return;
  describeSelected();
  insideList.innerHTML = "";
  box.inside.forEach((thing, i) => {
    const item = document.createElement("li");
    item.className = i === selected ? "inside-item selected" : "inside-item";
    item.style.animation = "none";
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "pick";
    pick.textContent = thing;
    pick.setAttribute("aria-label", `Look at the ${thing} model`);
    pick.addEventListener("click", () => {
      selected = i;
      riseStart = performance.now();
      peekPlayStart = null;
      renderInside();
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "take-out";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Take ${thing} out of the box`);
    remove.addEventListener("click", () => {
      box.inside.splice(i, 1);
      selected = Math.min(selected, box.inside.length - 1);
      riseStart = performance.now();
      saveBoxes();
      updateCount();
      renderInside();
    });
    item.append(pick, remove);
    insideList.append(item);
  });
}

function openPanel(box: Box): void {
  openBox = box;
  panel.hidden = false;
  showView(box.thing ? "closed" : "write");
}

function closePanel(): void {
  openBox = null;
  panel.hidden = true;
  canvas.focus();
}

writeView.addEventListener("submit", (e) => {
  e.preventDefault();
  const box = openBox;
  if (!box) return;
  const thing = panelText.value.trim();
  if (!thing) {
    if (box.thing) showView("closed");
    else closePanel();
    return;
  }
  const isNew = thing !== box.thing;
  box.thing = thing;
  if (isNew) burst(box, 8, "heart");
  saveBoxes();
  updateCount();
  closePanel();
});

openButton.addEventListener("click", () => {
  if (!openBox) return;
  peekOpening = true;
  showView("open");
});

closeBoxButton.addEventListener("click", () => {
  if (openBox) burst(openBox, 4, "sparkle");
  showView("closed");
});

rewriteButton.addEventListener("click", () => showView("write"));

emptyButton.addEventListener("click", () => {
  const box = openBox;
  if (!box) return;
  // Ask twice so a box full of stuff isn't emptied by accident.
  if (box.inside.length > 0 && !emptyArmed) {
    emptyArmed = true;
    emptyButton.textContent = "Really empty it? Click again";
    return;
  }
  box.thing = "";
  box.inside = [];
  burst(box, 5, "sparkle");
  saveBoxes();
  updateCount();
  closePanel();
});

insideForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const box = openBox;
  const thing = insideText.value.trim();
  if (!box || !thing) return;
  box.inside.push(thing);
  selected = box.inside.length - 1;
  riseStart = performance.now();
  burst(box, 8, "heart");
  saveBoxes();
  updateCount();
  renderInside();
  insideText.value = "";
  insideText.focus();
});

toShelfButton.addEventListener("click", () => {
  const box = openBox;
  const thing = box?.inside[selected];
  if (!box || thing === undefined) return;
  box.inside.splice(selected, 1);
  shelf.push(thing);
  saveBoxes();
  saveShelf();
  renderShelves();
  selected = box.inside.length - 1;
  riseStart = performance.now();
  peekPlayStart = null;
  renderInside();
  modelNote.textContent = `${thing} is on the ${canPlay(thing) ? "Play Shelf" : "shelf"} now!`;
});

for (const button of panel.querySelectorAll<HTMLButtonElement>(".close-panel")) {
  button.addEventListener("click", closePanel);
}
panel.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePanel();
});

peek.addEventListener("pointerdown", (e) => {
  spinDrag = { x: e.clientX, yaw, moved: false };
  peek.setPointerCapture(e.pointerId);
  peek.style.cursor = "grabbing";
});
peek.addEventListener("pointermove", (e) => {
  if (!spinDrag) return;
  if (Math.abs(e.clientX - spinDrag.x) > DRAG_PX) spinDrag.moved = true;
  yaw = spinDrag.yaw + (e.clientX - spinDrag.x) * 0.012;
});
peek.addEventListener("pointerup", () => {
  // A click (not a spin) plays with it, if it's something you can play with.
  const thing = openBox?.inside[selected];
  if (spinDrag && !spinDrag.moved && thing !== undefined && canPlay(thing) && peekOpen >= 1) {
    peekPlayStart = startPlaying(thing);
  }
  spinDrag = null;
  peek.style.cursor = "";
});

function addBox(): void {
  if (boxes.length >= MAX_BOXES) return;
  const box = makeBox();
  boxes.push(box);
  burst(box, 6, "sparkle");
  saveBoxes();
  updateCount();
}

// Asks first ("Sure?"), then deletes every box in the room. The shelves stay.
let deleteArmed = false;
function deleteAllBoxes(): void {
  if (boxes.length === 0) return;
  if (!deleteArmed) {
    deleteArmed = true;
    deleteAllButton.firstChild!.textContent = "Sure? Click again (or press D) ";
    window.setTimeout(disarmDelete, 4000);
    return;
  }
  disarmDelete();
  closePanel();
  for (const box of boxes) burst(box, 3, "sparkle");
  boxes.length = 0;
  hoverBox = null;
  drag = null;
  saveBoxes();
  updateCount();
}
function disarmDelete(): void {
  deleteArmed = false;
  deleteAllButton.firstChild!.textContent = "Delete all boxes ";
}

addButton.addEventListener("click", addBox);
deleteAllButton.addEventListener("click", deleteAllBoxes);
deleteAllButton.addEventListener("blur", disarmDelete);
window.addEventListener("keydown", (e) => {
  // Not while typing, and not with Ctrl/Cmd (so copy and paste still work).
  const typing = e.target instanceof Element && e.target.closest("input, textarea");
  // Not while the dollhouse or the city is open, either.
  const away = document.querySelector(
    ".dollhouse:not([hidden]), .city:not([hidden]), .race:not([hidden]), .arcade:not([hidden]), .walk:not([hidden])",
  );
  if (e.ctrlKey || e.metaKey || e.altKey || typing || away) return;
  const key = e.key.toLowerCase();
  if (e.key === "Escape" && (magnifying || windowView)) {
    stopMagnifying();
    return;
  }
  if (key === "a") addBox();
  else if (key === "d") deleteAllBoxes();
  else return;
  e.preventDefault();
});

canvas.addEventListener("pointerdown", (e) => {
  if (openBox) return;
  const p = toCanvas(e);
  if (magnifyClick(p.x, p.y)) return;
  if (scratchDino(p.x, p.y)) return;
  const box = boxAt(p.x, p.y);
  if (!box) return;
  // Bring the grabbed box to the front.
  boxes.splice(boxes.indexOf(box), 1);
  boxes.push(box);
  drag = { box, dx: p.x - box.x, dy: p.y - box.y, startX: p.x, startY: p.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const p = toCanvas(e);
  lensAt = p;
  if (drag) {
    if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > DRAG_PX) drag.moved = true;
    if (drag.moved) {
      drag.box.x = Math.max(0, Math.min(W - BOX_W, p.x - drag.dx));
      drag.box.y = Math.max(LID_H + 4, Math.min(H - BOX_H - 4, p.y - drag.dy));
    }
  }
  hoverBox = openBox ? null : boxAt(p.x, p.y);
  canvas.style.cursor = drag?.moved ? "grabbing" : hoverBox ? "pointer" : "default";
});

canvas.addEventListener("pointerup", () => {
  if (!drag) return;
  if (drag.moved) saveBoxes();
  else openPanel(drag.box);
  drag = null;
});

canvas.addEventListener("pointerleave", () => {
  hoverBox = null;
  lensAt = null;
});

// ---- Drawing ----

function drawRoom(t: number): void {
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, "#fde7ff");
  wall.addColorStop(1, "#f2dcff");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, FLOOR_Y);

  // Little hearts on the wallpaper.
  ctx.fillStyle = "rgba(255, 140, 200, 0.18)";
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 13; col++) {
      const x = col * 76 + (row % 2) * 38 + 20;
      const y = row * 56 + 26;
      drawHeart(x, y, 9);
    }
  }

  // Window with a sunny sky.
  ctx.fillStyle = "#ffffff";
  roundRect(380, 40, 200, 140, 16);
  ctx.fill();
  ctx.fillStyle = mixColor("#bfe6ff", "#262a45", creep);
  roundRect(392, 52, 176, 116, 10);
  ctx.fill();
  ctx.fillStyle = mixColor("#fff4a8", "#d8dce8", creep);
  ctx.beginPath();
  ctx.arc(530, 86, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  const cloudX = 392 + ((t * 12) % 220) - 30;
  ctx.save();
  ctx.beginPath();
  ctx.rect(392, 52, 176, 116);
  ctx.clip();
  for (const [dx, dy, r] of [[0, 0, 14], [16, -6, 16], [32, 0, 13]] as const) {
    ctx.beginPath();
    ctx.arc(cloudX + dx, 120 + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(476, 52, 8, 116);
  ctx.fillRect(392, 106, 176, 8);

  // Floor.
  const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  floor.addColorStop(0, "#f3c9a0");
  floor.addColorStop(1, "#e3ab7f");
  ctx.fillStyle = floor;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.strokeStyle = "rgba(160, 95, 55, 0.18)";
  ctx.lineWidth = 2;
  for (let y = FLOOR_Y + 30; y < H; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, FLOOR_Y - 6, W, 10);

  // Round purple rug.
  ctx.fillStyle = "rgba(169, 130, 255, 0.45)";
  ctx.beginPath();
  ctx.ellipse(W / 2, 470, 260, 80, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.ellipse(W / 2, 470, 236, 66, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBox(box: Box, t: number, closeUp?: { open: number }): void {
  const c = COLORS[box.color % COLORS.length]!;
  const hovered = !closeUp && (box === hoverBox || box === openBox);
  // A box with writing on it is taped shut, unless it's being opened up close.
  const open = closeUp ? closeUp.open : box.thing ? 0 : 1;
  const lifted = drag?.box === box && drag.moved;
  const bob = box.thing ? Math.sin(t * 2 + box.x * 0.05) * 1.5 : 0;
  // While it's creepy, boxes in the room slowly sway, like they're breathing.
  const sway = closeUp ? 0 : creep * Math.sin(t * 0.8 + box.x * 0.02) * 2.5;
  const x = box.x + sway;
  const y = box.y + bob - (lifted ? 6 : 0) + creep * Math.sin(t * 1.1 + box.y) * 1.2;

  // Shadow.
  ctx.fillStyle = "rgba(90, 40, 110, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x + BOX_W / 2, box.y + BOX_H + 4, BOX_W * (lifted ? 0.42 : 0.5), 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front of the box, with the corrugated cardboard lines.
  ctx.fillStyle = c.front;
  ctx.fillRect(x, y, BOX_W, BOX_H);
  ctx.strokeStyle = c.dark;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  for (let lx = x + 9; lx < x + BOX_W; lx += 9) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 3);
    ctx.lineTo(lx, y + BOX_H - 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, BOX_W - 2, BOX_H - 2);

  // Top of the box, seen a little from above.
  const inset = 12;
  ctx.fillStyle = open > 0.3 ? "#5a3a22" : c.top;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + inset, y - LID_H);
  ctx.lineTo(x + BOX_W - inset, y - LID_H);
  ctx.lineTo(x + BOX_W, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = c.dark;
  ctx.stroke();

  if (open <= 0.3) {
    // Taped shut: a seam down the middle and a strip of packing tape, which
    // rips apart as the box is opened.
    ctx.beginPath();
    ctx.moveTo(x + BOX_W / 2, y - LID_H);
    ctx.lineTo(x + BOX_W / 2, y);
    ctx.stroke();
    const rip = open / 0.3;
    ctx.globalAlpha = 1 - rip;
    ctx.fillStyle = "rgba(232, 214, 170, 0.85)";
    ctx.fillRect(x + BOX_W / 2 - 9 - rip * 14, y - LID_H - rip * 6, 18, LID_H + 16);
    ctx.globalAlpha = 1;
  } else {
    // Empty boxes stand open with their flaps up. Pointing at one opens the
    // flaps wider, like it wants something put inside.
    const spread = closeUp ? 0.2 + 0.75 * ((open - 0.3) / 0.7) : hovered ? 0.95 : 0.55;
    drawFlap(x + inset, y - LID_H, -(Math.PI / 2 + spread), c.top, c.dark);
    drawFlap(x + BOX_W - inset, y - LID_H, -(Math.PI / 2 - spread), c.top, c.dark);
  }

  if (box.thing) {
    // Written right on the cardboard in marker, with a little heart.
    ctx.fillStyle = "#3a2440";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = !closeUp && glitching(t * 1000) ? "???" : box.thing;
    const size = wrapText(words, BOX_W - 20, 16).length > 2 ? 13 : 16;
    const shown = wrapText(words, BOX_W - 20, size).slice(0, 3);
    ctx.font = `700 ${size}px "Comic Sans MS", "Chalkboard SE", "Trebuchet MS", sans-serif`;
    const lineH = size + 2;
    const top = y + 26 + (BOX_H - 26) / 2 - ((shown.length - 1) * lineH) / 2;
    shown.forEach((line, i) => ctx.fillText(line, x + BOX_W / 2, top + i * lineH));
    ctx.fillStyle = "#e8383d";
    drawHeart(x + 14, y + 26, 7);
  } else if (hovered) {
    ctx.fillStyle = "#3a2440";
    ctx.font = '700 15px "Comic Sans MS", "Chalkboard SE", "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Write on me!", x + BOX_W / 2, y + BOX_H / 2 + 4);
  }

  if (box.thing && box.inside.length > 0 && !closeUp) {
    // A little bubble saying how much stuff is inside.
    ctx.fillStyle = "#ff4fa3";
    ctx.beginPath();
    ctx.arc(x + BOX_W - 4, y - 4, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(box.inside.length), x + BOX_W - 4, y - 3);
  }

  if (hovered) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 2, y - 2, BOX_W + 4, BOX_H + 4);
  }
}

function drawFlap(hx: number, hy: number, angle: number, fill: string, edge: string): void {
  // A flap hinged at (hx, hy), pointing out at `angle`.
  const len = 34;
  const half = 26;
  const ex = hx + Math.cos(angle) * len;
  const ey = hy + Math.sin(angle) * len;
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx - half, hy);
  ctx.lineTo(ex - half * 0.8, ey);
  ctx.lineTo(ex + half * 0.8, ey);
  ctx.lineTo(hx + half, hy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawFloaters(dt: number): void {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]!;
    f.age += dt;
    if (f.age > 1.4) {
      floaters.splice(i, 1);
      continue;
    }
    if (f.age < 0) continue;
    const fx = f.x + f.drift * f.age;
    const fy = f.y - f.age * 90;
    ctx.globalAlpha = 1 - f.age / 1.4;
    if (f.kind === "heart") {
      ctx.fillStyle = "#ff4fa3";
      drawHeart(fx, fy, 10);
    } else {
      ctx.fillStyle = "#ffe36e";
      drawSparkle(fx, fy, 9);
    }
    ctx.globalAlpha = 1;
  }
}

function wrapText(text: string, maxWidth: number, size: number): string[] {
  ctx.font = `700 ${size}px "Trebuchet MS", sans-serif`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawHeart(x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fill();
}

function drawSparkle(x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? s : s * 0.35;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPeek(now: number, dt: number): void {
  const box = openBox;
  if (!box || peek.hidden) return;
  if (peekOpening) peekOpen = Math.min(1, peekOpen + dt * 2.2);

  ctx = peekCtx;
  ctx.clearRect(0, 0, PEEK_W, PEEK_H);
  ctx.fillStyle = "#f3c9a0";
  ctx.fillRect(0, PEEK_H - 50, PEEK_W, 50);

  // The box sits at the bottom middle, drawn bigger. It hops when it opens.
  const hop = peekOpening && peekOpen < 1 ? Math.sin(peekOpen * Math.PI) * 10 : 0;
  const bx = (PEEK_W / PEEK_SCALE - BOX_W) / 2;
  const by = (PEEK_H - 22) / PEEK_SCALE - BOX_H - hop / PEEK_SCALE;
  ctx.save();
  ctx.scale(PEEK_SCALE, PEEK_SCALE);
  drawBox({ ...box, x: bx, y: by }, now / 1000, { open: peekOpen });
  ctx.restore();

  // The model of the thing rises up out of the box, spinning.
  const thing = box.inside[selected];
  if (peekOpen >= 1 && thing !== undefined) {
    const p = Math.max(0, Math.min(1, (now - riseStart) / 700));
    const ease = 1 - (1 - p) * (1 - p);
    const mouthY = by * PEEK_SCALE;
    if (!spinDrag) yaw += dt * 0.9;
    if (p > 0) {
      ctx.save();
      if (p < 1) {
        ctx.beginPath();
        ctx.rect(0, 0, PEEK_W, mouthY);
        ctx.clip();
      }
      if (isBlood(thing)) {
        // You can't see it. The inside of the box is all static.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(PEEK_W / 2, mouthY + (96 - mouthY) * ease, 90 * ease + 10, 70 * ease + 8, 0, 0, Math.PI * 2);
        ctx.clip();
        drawFuzz(PEEK_W, PEEK_H, 0.85);
        ctx.restore();
      }
      // Everything it names comes out side by side, all at once.
      const playAge = peekPlayStart === null ? null : now - peekPlayStart;
      drawThing(thing, PEEK_W / 2, mouthY + (96 - mouthY) * ease, PEEK_W, PEEK_H, 90, yaw, ease, playAge);
      ctx.restore();
    }
  }
  ctx = roomCtx;
}

// ---- The rescued dinos ----
// After the meteor rescue, T-Rex and the babies live in the box room. They
// wander around the floor; scratch one's head (click it five times) and it
// gives you something for your shelf.

const DINO_GIFTS = ["cookie", "gold gem", "ball", "balloon", "cupcake", "teddy bear", "rainbow lollipop", "toy blocks", "gold crown", "star"];

interface RoomDino {
  right: HTMLCanvasElement;
  left: HTMLCanvasElement;
  x: number;
  y: number; // where its feet are
  speed: number;
  facing: 1 | -1;
  pauseUntil: number;
  scratches: number;
  saying: string;
  sayUntil: number;
}

let roomDinos: RoomDino[] | null = null;

function dinoSprite(text: string, size: number, yaw: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(size * 3);
  drawModel(c.getContext("2d")!, buildModel(makeModels(text)[0]!.parts), c.width / 2, c.height / 2, size, yaw, -0.15);
  return c;
}

function getRoomDinos(): RoomDino[] {
  if (roomDinos) return roomDinos;
  const kinds: [string, number, number][] = [
    ["dinosaur", 46, 0],
    ["green dinosaur", 22, 0.6],
    ["purple dinosaur", 22, 0.7],
    ["blue dinosaur", 22, 0.8],
  ];
  roomDinos = kinds.map(([text, size, speed], i) => ({
    right: dinoSprite(text, size, 0),
    left: dinoSprite(text, size, Math.PI),
    x: 150 + i * 200,
    y: 545 + (i % 2) * 30,
    speed: 30 + speed * 40,
    facing: i % 2 ? -1 : 1,
    pauseUntil: 0,
    scratches: 0,
    saying: "",
    sayUntil: 0,
  }));
  return roomDinos;
}

function drawRoomDinos(now: number, dt: number): void {
  if (cityState.meteor !== "saved") return;
  for (const d of getRoomDinos()) {
    if (now > d.pauseUntil) {
      d.x += d.facing * d.speed * dt;
      if (d.x < 40 || d.x > W - 40) {
        d.facing = d.x < 40 ? 1 : -1;
        d.pauseUntil = now + 800 + Math.random() * 1500;
      } else if (Math.random() < dt * 0.25) {
        d.pauseUntil = now + 600 + Math.random() * 1800;
        if (Math.random() < 0.5) d.facing = d.facing > 0 ? -1 : 1;
      }
    }
    const img = d.facing > 0 ? d.right : d.left;
    const walking = now > d.pauseUntil;
    const hop = walking ? Math.abs(Math.sin(now / 130 + d.x)) * 4 : 0;
    ctx.drawImage(img, d.x - img.width / 2, d.y - img.height * 0.68 - hop);
    if (now < d.sayUntil) drawSpeech(d.saying, d.x, d.y - img.height * 0.6);
  }
}

function drawSpeech(text: string, cx: number, bottom: number): void {
  ctx.font = '800 15px "Trebuchet MS", sans-serif';
  const w = Math.min(W - 10, ctx.measureText(text).width + 22);
  const x = Math.max(5, Math.min(W - w - 5, cx - w / 2));
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#4cc76a";
  ctx.lineWidth = 3;
  roundRect(x, bottom - 30, w, 28, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2e7a3a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, bottom - 15, w - 10);
}

/** Scratches a dino's head if (x, y) is on one. Returns whether it was. */
function scratchDino(x: number, y: number): boolean {
  if (cityState.meteor !== "saved") return false;
  const now = performance.now();
  // Front-most (lowest on the floor) first.
  const hit = [...getRoomDinos()]
    .sort((a, b) => b.y - a.y)
    .find((d) => {
      const h = d.right.height * 0.6;
      return Math.abs(x - d.x) < d.right.width * 0.4 && y < d.y && y > d.y - h;
    });
  if (!hit) return false;
  hit.scratches++;
  hit.pauseUntil = now + 1500;
  playSound("squeak");
  if (hit.scratches < 5) {
    hit.saying = `scratch! (${hit.scratches}/5)`;
  } else {
    hit.scratches = 0;
    const gift = DINO_GIFTS[Math.floor(Math.random() * DINO_GIFTS.length)]!;
    addToShelf(gift);
    playSound("magic");
    hit.saying = `Thank you! Here's a ${gift}! (It's on your shelf.)`;
  }
  hit.sayUntil = now + 2200;
  return true;
}

// ---- The magnifying glass ----
// Click a magnifying glass and the pointer becomes a lens over the box room.
// Look closely at the window and there's a tiny keyhole in its frame. It
// needs some sort of purple key (dug up at the Engineering Station's dump).
// With the key, the window opens and you climb outside (walk.ts).

const WINDOW = { x: 380, y: 40, w: 200, h: 140 };
const KEYHOLE = { x: W - 25, y: H - 75 };
let magnifying = false;
let windowView = false;
let lensAt: { x: number; y: number } | null = null;
let banner = "";
let bannerUntil = 0;

function startMagnifying(): void {
  closePanel();
  canvas.scrollIntoView({ behavior: "smooth", block: "center" });
  magnifying = true;
  windowView = false;
  showBanner("Magnifying glass! Click something to look closer. (Esc to stop.)", 5000);
}

function stopMagnifying(): void {
  magnifying = false;
  windowView = false;
  showBanner("", 0);
}

function showBanner(text: string, ms: number): void {
  banner = text;
  bannerUntil = performance.now() + ms;
}

/** A click while magnifying (or looking at the window). Returns whether it used the click. */
function magnifyClick(x: number, y: number): boolean {
  if (windowView) {
    if (Math.hypot(x - KEYHOLE.x, y - KEYHOLE.y) < 22) {
      if (cityState.purpleKey) {
        playSound("magic");
        showBanner("The purple key fits! *click* The window swings open... you climb outside!", 2500);
        window.setTimeout(() => {
          stopMagnifying();
          openWalk({ addToShelf, removeFromShelf, shelf: () => [...shelf] });
        }, 1500);
      } else {
        playSound("beep");
        showBanner("A tiny keyhole! It's locked. You need some sort of purple key...", 4500);
      }
    } else if (x < 60 && y < 60) {
      stopMagnifying();
    } else {
      showBanner("It's the window, really close up. Look carefully at the frame...", 3000);
    }
    return true;
  }
  if (!magnifying) return false;
  if (x > WINDOW.x && x < WINDOW.x + WINDOW.w && y > WINDOW.y && y < WINDOW.y + WINDOW.h) {
    magnifying = false;
    windowView = true;
    playSound("magic");
    showBanner("You zoomed right in on the window! (Click × or press Esc to go back.)", 4000);
  } else {
    showBanner("Hmm, nothing special there. Try somewhere else!", 2000);
  }
  return true;
}

function drawMagnifying(now: number): void {
  if (windowView) drawWindowView(now);
  if (magnifying && lensAt) {
    // A round lens that shows what's under it bigger.
    const r = 70;
    const zoom = 2.5;
    const size = (r * 2) / zoom;
    ctx.save();
    ctx.beginPath();
    ctx.arc(lensAt.x, lensAt.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(canvas, lensAt.x - size / 2, lensAt.y - size / 2, size, size, lensAt.x - r, lensAt.y - r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = "#8b5a2b";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(lensAt.x + r * 0.72, lensAt.y + r * 0.72);
    ctx.lineTo(lensAt.x + r * 1.3, lensAt.y + r * 1.3);
    ctx.stroke();
    ctx.strokeStyle = "#c9ced6";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(lensAt.x, lensAt.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (banner && now < bannerUntil) {
    ctx.font = '800 20px "Trebuchet MS", sans-serif';
    const w = Math.min(W - 20, ctx.measureText(banner).width + 30);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    roundRect(W / 2 - w / 2, H - 56, w, 40, 14);
    ctx.fill();
    ctx.fillStyle = "#7a2fc0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(banner, W / 2, H - 36, w - 20);
  }
}

/** The window, zoomed way in: sky, clouds, the frame, and one tiny keyhole. */
function drawWindowView(now: number): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#9fd8ff");
  sky.addColorStop(1, "#d8f0ff");
  ctx.fillStyle = sky;
  ctx.fillRect(50, 40, W - 100, H - 80);
  ctx.fillStyle = "#fff4a8";
  ctx.beginPath();
  ctx.arc(700, 140, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  const cloud = ((now / 30) % (W + 200)) - 100;
  for (const [dx, dy, r] of [[0, 0, 40], [50, -18, 48], [100, 0, 36]] as const) {
    ctx.beginPath();
    ctx.arc(cloud + dx, 330 + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // The frame and the cross bars.
  ctx.fillStyle = "#f4f1ee";
  ctx.fillRect(0, 0, W, 40);
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillRect(0, 0, 50, H);
  ctx.fillRect(W - 50, 0, 50, H);
  ctx.fillRect(W / 2 - 18, 0, 36, H);
  ctx.fillRect(0, H / 2 - 18, W, 36);
  ctx.strokeStyle = "#e0dad4";
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 40, W - 100, H - 80);
  // The tiny keyhole, hidden in the bottom-right of the frame. It glints now and then.
  ctx.fillStyle = "#3a2a4a";
  ctx.beginPath();
  ctx.arc(KEYHOLE.x, KEYHOLE.y - 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(KEYHOLE.x - 2, KEYHOLE.y - 2);
  ctx.lineTo(KEYHOLE.x + 2, KEYHOLE.y - 2);
  ctx.lineTo(KEYHOLE.x + 3.5, KEYHOLE.y + 6);
  ctx.lineTo(KEYHOLE.x - 3.5, KEYHOLE.y + 6);
  ctx.fill();
  if (now % 4000 < 300) {
    ctx.fillStyle = "#a35cff";
    drawSparkle(KEYHOLE.x + 9, KEYHOLE.y - 9, 6);
  }
  // A close button in the corner.
  ctx.fillStyle = "#ff6fb5";
  ctx.beginPath();
  ctx.arc(28, 28, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = '900 22px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×", 28, 29);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  drawRoom(t);
  for (const box of boxes) {
    drawBox(box, t);
    if (peeker?.box === box) drawEyes(box, now);
  }
  drawRoomDinos(now, dt);
  if (boxes.length === 0) {
    ctx.fillStyle = "#7a2fc0";
    ctx.font = '800 26px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No boxes! Press A or click + Add a box.", W / 2, 400);
  }
  drawFloaters(dt);
  updateCreep(now, dt);
  drawCreep(now);
  drawMagnifying(now);
  drawPeek(now, dt);
  drawShelves(now, dt);
  requestAnimationFrame(frame);
}

renderShelves();
updateCount();
requestAnimationFrame(frame);
