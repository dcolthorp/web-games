// Penelope's Drawing Switch: you and a friend on another computer draw one
// picture together. One of you draws for a minute while the other watches,
// then it says SWITCH! and it's the other one's turn, on and on.
//
// The computers talk through the game's dev server (see the
// "draw-switch-rooms" bit of vite.config.ts), which passes every message to
// everybody. Each message says which room it's for, so lots of rooms can
// play at once. Whoever has been in the room longest keeps time and says
// whose turn it is.

import { roboDraw, ROBO_MS, ROBO_THEMES } from "./robo";

const TURN_MS = 60_000;
const HELLO_MS = 2000;
const GONE_MS = 7000;
const CRAYONS = [
  "#1f1f2e", "#ffffff", "#8a8f98", "#e8383d", "#ff8a3d", "#ffd23f", "#c8f06a", "#4cc76a",
  "#2fbfa8", "#5fe0ff", "#3b82f6", "#6a3fd1", "#c084fc", "#ff6fa8", "#ffb8dc", "#9a6334",
];
// Everybody gets their own thing to draw, and nobody gets the same one.
// Penelope asked for really easy ones: simple shapes anybody can draw.
const THEMES = [
  "☀️ The sun", "🌈 A rainbow", "⭐ A star", "❤️ A heart", "🍎 An apple", "🎈 A balloon", "🌸 A flower",
  "🌙 The moon", "☁️ A cloud", "🍦 Ice cream", "🍭 A lollipop", "🌳 A tree", "🏠 A house", "🐟 A fish",
  "🐛 A worm", "🍩 A donut", "⚽ A ball", "😊 A happy face", "🌊 Waves", "🍕 Pizza", "🐌 A snail",
  "🎂 A cake", "🥚 An egg", "🍌 A banana", "🍓 A strawberry", "☂️ An umbrella", "🌻 A sunflower", "🔺 A triangle",
];
const CODE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

type Message =
  | { type: "hello"; name: string; joinedAt: number }
  | { type: "bye" }
  | { type: "turn"; drawer: string | null; endsIn: number; themes: Record<string, string> }
  | { type: "seg"; color: string; size: number; p: [number, number, number, number] }
  | { type: "snapshot"; to: string; data: string }
  | { type: "clear" }
  | { type: "skip" };
type Envelope = Message & { room: string; from: string };

interface Peer {
  name: string;
  joinedAt: number;
  lastSeen: number;
}

// ---- Talking to the other computers ----

interface HotChannel {
  send(event: string, data: unknown): void;
  on(event: string, cb: (data: unknown) => void): void;
}
const hot = (import.meta as ImportMeta & { hot?: HotChannel }).hot;
// Without the dev server (a built copy), tabs on the same computer can still play.
const local = !hot && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("draw-switch") : null;

const me = { id: Math.random().toString(36).slice(2, 10), name: "", joinedAt: 0 };
let room = "";
const peers = new Map<string, Peer>();

function send(message: Message): void {
  if (!room) return;
  const envelope: Envelope = { ...message, room, from: me.id };
  if (hot) hot.send("draw-switch:message", envelope);
  else local?.postMessage(envelope);
}

function receive(data: unknown): void {
  const m = data as Envelope;
  if (!m || m.room !== room || m.from === me.id) return;
  const known = peers.get(m.from);
  if (m.type === "hello") {
    peers.set(m.from, { name: m.name, joinedAt: m.joinedAt, lastSeen: performance.now() });
    if (!known) {
      // Somebody new! Whoever keeps time sends them the picture so far.
      if (isHost()) send({ type: "snapshot", to: m.from, data: paper.toDataURL() });
      send({ type: "hello", name: me.name, joinedAt: me.joinedAt });
      showPlayers();
      say(`${m.name} is here! 🎉`);
    }
    return;
  }
  if (known) known.lastSeen = performance.now();
  if (m.type === "bye") {
    peers.delete(m.from);
    showPlayers();
  } else if (m.type === "turn") {
    themes = m.themes ?? {};
    setTurn(m.drawer, m.endsIn);
    showThemes();
  } else if (m.type === "seg") {
    line(m.p, m.color, m.size);
  } else if (m.type === "snapshot" && m.to === me.id) {
    const img = new Image();
    img.onload = () => pen.drawImage(img, 0, 0);
    img.src = m.data;
  } else if (m.type === "clear") {
    clearPaper();
    // A new picture means new themes for everybody.
    if (isHost()) newThemes(true);
  } else if (m.type === "skip" && isHost() && m.from === drawer) {
    nextTurn();
  }
}
hot?.on("draw-switch:message", receive);
local?.addEventListener("message", (e: MessageEvent<unknown>) => receive(e.data));

/** Everybody in the room (you too), in the order they came in. */
function players(): { id: string; name: string }[] {
  const list = [{ id: me.id, name: me.name, joinedAt: me.joinedAt }];
  for (const [id, p] of peers) list.push({ id, name: p.name, joinedAt: p.joinedAt });
  list.sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
  return list;
}
const isHost = (): boolean => players()[0]!.id === me.id;
const nameOf = (id: string | null): string => (id === me.id ? me.name : (id && peers.get(id)?.name) || "Someone");

// ---- Whose turn it is ----

let drawer: string | null = null; // null: nobody's turn yet, so anybody can draw
let endsAt = 0;
let themes: Record<string, string> = {}; // everybody's theme (the timekeeper hands them out)

/** The timekeeper gives a theme to anybody who doesn't have one (or, with `all`, new ones for everybody). */
function newThemes(all = false): void {
  const list = players();
  const next: Record<string, string> = {};
  for (const p of list) if (!all && themes[p.id]) next[p.id] = themes[p.id]!;
  for (const p of list) {
    if (next[p.id]) continue;
    const taken = new Set(Object.values(next));
    const free = THEMES.filter((t) => !taken.has(t) && (!all || t !== themes[p.id]));
    next[p.id] = free[Math.floor(Math.random() * free.length)]!;
  }
  themes = next;
  showThemes();
  sendTurn();
}

const sendTurn = (): void => send({ type: "turn", drawer, endsIn: Math.max(0, endsAt - performance.now()), themes });

function setTurn(next: string | null, endsIn: number): void {
  const changed = next !== drawer;
  if (!solo) switchBanner.textContent = "SWITCH!";
  drawer = next;
  endsAt = performance.now() + endsIn;
  if (changed && next) {
    switchBanner.hidden = true;
    void switchBanner.offsetWidth; // restart the pop animation
    switchBanner.hidden = false;
    window.setTimeout(() => (switchBanner.hidden = true), 2400);
  }
  showTurn();
}

/** The timekeeper moves on to the next person. */
function nextTurn(): void {
  const list = players();
  const at = list.findIndex((p) => p.id === drawer);
  const next = list[(at + 1) % list.length]!.id;
  setTurn(next, TURN_MS);
  sendTurn();
}

const myTurn = (): boolean => drawer === null || drawer === me.id;

window.setInterval(() => {
  if (solo) {
    // By yourself: when your minute is up, it's Robo's turn.
    if (drawer === me.id && performance.now() >= endsAt) endMyTurn();
    return;
  }
  if (!room) return;
  const now = performance.now();
  for (const [id, p] of peers) {
    if (now - p.lastSeen > GONE_MS) {
      peers.delete(id);
      say(`${p.name} left.`);
      showPlayers();
    }
  }
  if (!isHost()) return;
  const list = players();
  if (list.some((p) => !themes[p.id]) || Object.keys(themes).some((id) => !list.some((p) => p.id === id))) newThemes();
  if (list.length < 2) {
    if (drawer !== null) {
      setTurn(null, 0);
      sendTurn();
    }
  } else if (drawer === null || !list.some((p) => p.id === drawer) || now >= endsAt) {
    nextTurn();
  }
}, 250);

window.setInterval(() => {
  if (!room) return;
  send({ type: "hello", name: me.name, joinedAt: me.joinedAt });
  if (isHost()) sendTurn();
}, HELLO_MS);

window.addEventListener("pagehide", () => send({ type: "bye" }));

// ---- The page ----

const lobby = document.getElementById("lobby")!;
const game = document.getElementById("game")!;
const nameInput = document.getElementById("name") as HTMLInputElement;
const codeInput = document.getElementById("code") as HTMLInputElement;
const lobbyNote = document.getElementById("lobby-note")!;
const roomCodeEl = document.getElementById("room-code")!;
const turnEl = document.getElementById("turn")!;
const timerEl = document.getElementById("timer")!;
const playersEl = document.getElementById("players")!;
const switchBanner = document.getElementById("switch")!;
const toolsEl = document.getElementById("tools")!;
const paper = document.getElementById("paper") as HTMLCanvasElement;
const pen = paper.getContext("2d")!;

nameInput.value = localStorage.getItem("draw-switch-name") ?? "";
if (!location.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
  document.getElementById("address")!.textContent = `Your friend opens this on their computer: ${location.href}`;
}

let toast = "";
let toastUntil = 0;
function say(text: string): void {
  toast = text;
  toastUntil = performance.now() + 3000;
  showTurn();
}

// ---- By yourself ----
// You and Robo each get your own paper and draw at the same time. SWITCH!
// You help with Robo's paper and Robo helps with yours. SWITCH! You get
// your own paper back. You choose how many times it goes around. Every
// picture is kept, so you can look at them all.

const PICTURES_KEY = "draw-switch-pictures";
const LAPS_KEY = "draw-switch-laps";
const MAX_PICTURES = 30;
let solo = false;
interface Picture {
  theme: string;
  roboTheme?: string; // what Robo drew on it (older pictures)
  owner?: "me" | "robo"; // whose paper it was
  data: string;
  stars?: number; // 0 is a fail; 1, 2 or 3 stars is a pass
}

/**
 * Pass or fail? The game can't tell what you drew, so it looks at how much
 * of the page is coloured in, and how many different colours are on it.
 */
function grade(ctx: CanvasRenderingContext2D): number {
  const { data } = ctx.getImageData(0, 0, paper.width, paper.height);
  let inked = 0;
  let total = 0;
  const colors = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4 * 7) {
    total++;
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (r > 245 && g > 245 && b > 245) continue;
    inked++;
    const key = `${r >> 5},${g >> 5},${b >> 5}`;
    colors.set(key, (colors.get(key) ?? 0) + 1);
  }
  const covered = inked / total;
  // Ignore colours that only show up a tiny bit (like the soft edges of a line).
  const many = [...colors.values()].filter((n) => n > inked * 0.05).length;
  // Penelope asked for it to be really easy: you only fail if you didn't
  // draw anything at all.
  if (inked === 0) return 0;
  if (covered >= 0.03 || (covered >= 0.01 && many >= 2)) return 3;
  if (covered >= 0.008) return 2;
  return 1;
}
const gradeText = (stars: number): string => (stars ? `${"⭐".repeat(stars)} PASS!` : "❌ FAIL");
let pictures: Picture[] = [];
try {
  pictures = JSON.parse(localStorage.getItem(PICTURES_KEY) ?? "[]") as Picture[];
} catch {
  pictures = [];
}

function savePictures(): void {
  // Pictures are big: if there isn't room, the oldest ones go first.
  while (pictures.length) {
    try {
      localStorage.setItem(PICTURES_KEY, JSON.stringify(pictures));
      return;
    } catch {
      pictures.shift();
    }
  }
  localStorage.removeItem(PICTURES_KEY);
}

// The two papers: `front` is the one in front of you (the big one), `back`
// is the one Robo is drawing on (the little one). They swap at SWITCH.
const ROBO = "robo";
interface Sheet {
  theme: string;
  owner: "me" | "robo";
  drew: boolean; // did you draw on it?
}
const roboPaper = document.getElementById("robo-paper") as HTMLCanvasElement;
const roboPen = roboPaper.getContext("2d", { willReadFrequently: true })!;
const roboView = document.getElementById("robo-view")!;
const roboNote = document.getElementById("robo-note")!;
let front: Sheet = { theme: "", owner: "me", drew: false };
let back: Sheet = { theme: "", owner: "robo", drew: false };
let laps = 1;
try {
  laps = Math.min(4, Math.max(1, Number(localStorage.getItem(LAPS_KEY)) || 1));
} catch {
  laps = 1;
}
let turnNo = 0; // even: everybody on their own paper; odd: swapped
let robo: { stop(): void; finish(): void } | null = null;

/** Keep both papers in the gallery: Robo's first, so yours shows up first. */
function keepSheets(): void {
  const both: [Sheet, HTMLCanvasElement][] = [[front, paper], [back, roboPaper]];
  both.sort(([a]) => (a.owner === "robo" ? -1 : 1));
  for (const [sheet, canvas] of both) {
    const stars = sheet.drew ? Math.max(1, grade(canvas.getContext("2d")!)) : 0;
    pictures.push({ theme: sheet.theme, owner: sheet.owner, data: canvas.toDataURL("image/jpeg", 0.7), stars });
  }
  while (pictures.length > MAX_PICTURES) pictures.shift();
  savePictures();
}

/** Robo draws in the emptiest part of a page, so it doesn't scribble on the drawing. */
function emptiest(ctx: CanvasRenderingContext2D, size: number): { x: number; y: number } {
  let best = { x: 40, y: 40, ink: Infinity };
  for (const x of [30, 310, 590]) {
    for (const y of [20, 300]) {
      const { data } = ctx.getImageData(x, y, size, size);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4 * 9) if (data[i]! < 245 || data[i + 1]! < 245 || data[i + 2]! < 245) ink++;
      if (ink < best.ink) best = { x, y, ink };
    }
  }
  return best;
}

/** Robo gets to work on the back paper. */
function startRobo(): void {
  robo?.stop();
  const size = 280;
  const { x, y } = emptiest(roboPen, size);
  robo = roboDraw(roboPen, back.theme, x, y, size, () => {
    robo = null;
    showSolo();
  });
  showSolo();
}

/** Where you are in the game, and what Robo is up to. */
function showSolo(): void {
  const lap = Math.floor(turnNo / 2) + 1;
  playersEl.textContent = `Around ${lap} of ${laps} · You're on ${front.owner === "me" ? "your paper" : "Robo's paper"}`;
  const whose = back.owner === "robo" ? "Robo's paper" : "your paper";
  roboNote.textContent = robo ? `🤖 Robo is drawing on ${whose}...` : `🤖 Robo is done with ${whose}! Waiting for you.`;
}

/** Your minute is up (or you said you're done): SWITCH papers! */
function endMyTurn(): void {
  robo?.finish(); // Robo hurries up
  turnNo++;
  if (turnNo >= laps * 2) {
    allDone();
    return;
  }
  const mine = pen.getImageData(0, 0, paper.width, paper.height);
  pen.putImageData(roboPen.getImageData(0, 0, paper.width, paper.height), 0, 0);
  roboPen.putImageData(mine, 0, 0);
  [front, back] = [back, front];
  switchBanner.innerHTML = "<span>SWITCH!<br><small></small></span>";
  switchBanner.querySelector("small")!.textContent = front.owner === "me" ? "Your paper is back!" : `Help Robo with ${front.theme}`;
  showSoloThemes();
  drawer = null; // so the banner pops
  setTurn(me.id, TURN_MS);
  startRobo();
}

/** The papers went all the way around: keep them and go look! */
function allDone(): void {
  robo?.stop();
  robo = null;
  keepSheets();
  stopSolo();
  openGallery("🎉 All done! Here's your picture and Robo's!");
}

function stopSolo(): void {
  peers.delete(ROBO);
  solo = false;
  drawer = null;
}

/** New papers and new themes for you and Robo, and off you go. */
function newRound(): void {
  const free = THEMES.filter((t) => t !== front.theme);
  const mine = free[Math.floor(Math.random() * free.length)]!;
  const roboChoices = ROBO_THEMES.filter((r) => r.theme !== mine && r.theme !== back.theme);
  front = { theme: mine, owner: "me", drew: false };
  back = { theme: roboChoices[Math.floor(Math.random() * roboChoices.length)]!.theme, owner: "robo", drew: false };
  turnNo = 0;
  clearPaper();
  roboPen.fillStyle = "#ffffff";
  roboPen.fillRect(0, 0, roboPaper.width, roboPaper.height);
  showSoloThemes();
  drawer = null; // so the banner pops
  setTurn(me.id, TURN_MS);
  startRobo();
}

function showSoloThemes(): void {
  themes = { [me.id]: front.theme, [ROBO]: back.theme };
  showThemes();
}

function startSolo(): void {
  switchBanner.textContent = "GO!";
  me.name = nameInput.value.trim() || "Me";
  localStorage.setItem("draw-switch-name", me.name);
  solo = true;
  room = "";
  lobby.hidden = true;
  gallery.hidden = true;
  game.hidden = false;
  roboView.hidden = false;
  document.querySelector<HTMLElement>(".room")!.hidden = true;
  (document.getElementById("gallery-open") as HTMLButtonElement).hidden = false;
  (document.getElementById("stop-solo") as HTMLButtonElement).hidden = false;
  document.getElementById("skip")!.textContent = "⏭️ I'm done, SWITCH!";
  // "New picture" would only wipe one of the papers, so it's not for playing with Robo.
  (document.getElementById("new") as HTMLButtonElement).hidden = true;
  peers.set(ROBO, { name: "Robo 🤖", joinedAt: Number.MAX_SAFE_INTEGER, lastSeen: Infinity });
  newRound();
}

const gallery = document.getElementById("gallery")!;
function openGallery(note?: string): void {
  game.hidden = true;
  gallery.hidden = false;
  const grid = document.getElementById("gallery-grid")!;
  grid.innerHTML = "";
  document.getElementById("gallery-note")!.textContent =
    note ?? (pictures.length ? `You drew ${pictures.length} picture${pictures.length === 1 ? "" : "s"}! 🎉` : "No pictures yet. Go draw something!");
  for (const p of [...pictures].reverse()) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = p.data;
    img.alt = p.theme;
    const cap = document.createElement("figcaption");
    const stars = p.stars === undefined ? "" : ` · ${gradeText(p.stars)}`;
    if (p.owner === "robo") cap.textContent = `🤖 Robo's ${p.theme}${stars} · you helped`;
    else if (p.owner === "me") cap.textContent = `${p.theme}${stars} · 🤖 Robo helped`;
    else cap.textContent = p.theme + stars + (p.roboTheme ? ` · 🤖 Robo drew ${p.roboTheme}` : "");
    fig.append(img, cap);
    grid.append(fig);
  }
}

document.getElementById("mode-solo")!.addEventListener("click", () => pickMode(true));
document.getElementById("mode-together")!.addEventListener("click", () => pickMode(false));
function pickMode(alone: boolean): void {
  document.getElementById("mode-solo")!.setAttribute("aria-pressed", String(alone));
  document.getElementById("mode-together")!.setAttribute("aria-pressed", String(!alone));
  document.getElementById("solo-choice")!.hidden = !alone;
  document.getElementById("together-choice")!.hidden = alone;
}

const lapButtons = document.querySelectorAll<HTMLButtonElement>(".lap");
function pickLaps(n: number): void {
  laps = n;
  try {
    localStorage.setItem(LAPS_KEY, String(n));
  } catch {
    // Can't save it? That's okay, it still works this time.
  }
  lapButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset["laps"]) === n)));
  document.getElementById("laps-note")!.textContent = Array.from({ length: n }, () => "✏️ You → 🤖 Robo").join(" → ");
}
lapButtons.forEach((b) => b.addEventListener("click", () => pickLaps(Number(b.dataset["laps"]))));
pickLaps(laps);

document.getElementById("start-solo")!.addEventListener("click", startSolo);
document.getElementById("gallery-open")!.addEventListener("click", () => openGallery());
document.getElementById("stop-solo")!.addEventListener("click", () => {
  robo?.stop();
  robo = null;
  if (front.drew || back.drew) keepSheets();
  stopSolo();
  openGallery();
});
document.getElementById("gallery-back")!.addEventListener("click", () => {
  // Looking in the middle of a picture? Go back to it. Otherwise start fresh.
  if (solo) {
    gallery.hidden = true;
    game.hidden = false;
  } else startSolo();
});

let sureThrow = false;
const throwButton = document.getElementById("gallery-clear")!;
throwButton.addEventListener("click", () => {
  if (!sureThrow) {
    sureThrow = true;
    throwButton.textContent = "Sure? Tap again!";
    window.setTimeout(() => {
      sureThrow = false;
      throwButton.textContent = "🗑️ Throw them all away";
    }, 3000);
    return;
  }
  sureThrow = false;
  throwButton.textContent = "🗑️ Throw them all away";
  pictures = [];
  localStorage.removeItem(PICTURES_KEY);
  openGallery();
});

function enter(code: string, making: boolean): void {
  me.name = nameInput.value.trim() || "Me";
  localStorage.setItem("draw-switch-name", me.name);
  me.joinedAt = Date.now();
  room = code;
  roomCodeEl.textContent = code;
  lobby.hidden = true;
  game.hidden = false;
  clearPaper();
  send({ type: "hello", name: me.name, joinedAt: me.joinedAt });
  showPlayers();
  if (making) say(`Tell your friend the code: ${code}`);
  else {
    say("Looking for your friend's room...");
    window.setTimeout(() => {
      if (!peers.size) say(`Nobody is in room ${code} yet. Is the code right?`);
    }, 4000);
  }
}

document.getElementById("make")!.addEventListener("click", () => {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  enter(code, true);
});
document.getElementById("join")!.addEventListener("click", () => {
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) {
    lobbyNote.textContent = "The code has 4 letters!";
    return;
  }
  enter(code, false);
});
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("join")!.click();
});

const themesEl = document.getElementById("themes")!;

/** Your theme big at the top, and everybody else's next to it. */
function showThemes(): void {
  themesEl.innerHTML = "";
  for (const p of players()) {
    const t = themes[p.id];
    if (!t) continue;
    const el = document.createElement("p");
    el.className = p.id === me.id ? "theme mine" : "theme";
    const who = document.createElement("small");
    who.textContent = p.id === me.id ? "Your theme" : `${p.name}'s theme`;
    if (solo && p.id === me.id && front.owner === "robo") who.textContent = "Help Robo: Robo's theme";
    if (solo && p.id === ROBO) who.textContent = back.owner === "robo" ? "Robo's theme" : "Robo is helping with your theme";
    el.append(who, t);
    if (p.id === me.id) themesEl.prepend(el);
    else themesEl.append(el);
  }
}

function showPlayers(): void {
  showThemes();
  playersEl.textContent = "Drawing: " + players().map((p) => (p.id === me.id ? `${p.name} (you)` : p.name)).join(", ");
}

function showTurn(): void {
  const now = performance.now();
  if (now < toastUntil) turnEl.textContent = toast;
  else if (drawer === null) turnEl.textContent = "Waiting for your friend... you can draw while you wait! ✏️";
  else if (drawer === me.id) turnEl.textContent = "✏️ Your turn! Draw!";
  else turnEl.textContent = `👀 ${nameOf(drawer)} is drawing...`;
  const left = drawer ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  timerEl.textContent = drawer ? `⏱️ ${left}` : "";
  timerEl.classList.toggle("hurry", !!drawer && left <= 10);
  const can = myTurn();
  toolsEl.classList.toggle("off", !can);
  paper.classList.toggle("watching", !can);
  (document.getElementById("skip") as HTMLButtonElement).disabled = drawer !== me.id;
  (document.getElementById("new") as HTMLButtonElement).disabled = !can;
}
window.setInterval(showTurn, 250);

// ---- Drawing ----

let color = CRAYONS[0]!;
let erasing = false;
const sizeInput = document.getElementById("size") as HTMLInputElement;
const eraser = document.getElementById("eraser")!;
const crayonsEl = document.getElementById("crayons")!;
for (const c of CRAYONS) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "crayon";
  b.style.background = c;
  b.setAttribute("aria-label", `Crayon ${c}`);
  b.setAttribute("aria-pressed", String(c === color));
  b.addEventListener("click", () => {
    color = c;
    erasing = false;
    eraser.setAttribute("aria-pressed", "false");
    crayonsEl.querySelectorAll(".crayon").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  crayonsEl.append(b);
}
eraser.addEventListener("click", () => {
  erasing = !erasing;
  eraser.setAttribute("aria-pressed", String(erasing));
});

function clearPaper(): void {
  pen.fillStyle = "#ffffff";
  pen.fillRect(0, 0, paper.width, paper.height);
}

function line([x0, y0, x1, y1]: [number, number, number, number], c: string, size: number): void {
  pen.strokeStyle = c;
  pen.lineWidth = size;
  pen.lineCap = "round";
  pen.lineJoin = "round";
  pen.beginPath();
  pen.moveTo(x0, y0);
  pen.lineTo(x1, y1);
  pen.stroke();
}

const at = (e: PointerEvent): [number, number] => {
  const r = paper.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * paper.width, ((e.clientY - r.top) / r.height) * paper.height];
};
let last: [number, number] | null = null;

function drawTo(point: [number, number]): void {
  if (!last) return;
  const seg: [number, number, number, number] = [last[0], last[1], point[0], point[1]];
  const c = erasing ? "#ffffff" : color;
  const size = Number(sizeInput.value);
  line(seg, c, size);
  if (solo) front.drew = true;
  send({ type: "seg", color: c, size, p: seg.map((n) => Math.round(n)) as [number, number, number, number] });
  last = point;
}

paper.addEventListener("pointerdown", (e) => {
  if (!myTurn()) {
    say(`Wait for your turn! ${nameOf(drawer)} is drawing.`);
    return;
  }
  paper.setPointerCapture(e.pointerId);
  last = at(e);
  // A dot, for a single tap.
  drawTo([last[0] + 0.1, last[1]]);
});
paper.addEventListener("pointermove", (e) => {
  if (!last) return;
  if (!myTurn()) {
    last = null; // time's up!
    return;
  }
  drawTo(at(e));
});
for (const ev of ["pointerup", "pointercancel"]) paper.addEventListener(ev, () => (last = null));

document.getElementById("skip")!.addEventListener("click", () => {
  if (drawer !== me.id) return;
  if (solo) {
    endMyTurn();
    return;
  }
  if (isHost()) nextTurn();
  else send({ type: "skip" });
});
let sure = false;
const newButton = document.getElementById("new")!;
newButton.addEventListener("click", () => {
  if (!myTurn()) return;
  if (!sure) {
    sure = true;
    newButton.textContent = "Sure? Tap again!";
    window.setTimeout(() => {
      sure = false;
      newButton.textContent = "🗒️ New picture";
    }, 3000);
    return;
  }
  sure = false;
  newButton.textContent = "🗒️ New picture";
  clearPaper();
  send({ type: "clear" });
  if (isHost()) newThemes(true);
});
document.getElementById("save")!.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = paper.toDataURL("image/png");
  a.download = `drawing-switch-${room}.png`;
  a.click();
});

clearPaper();
