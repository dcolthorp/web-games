// The paper card usually reads "click on me". One refresh of the Games 3 hub in
// four, it reads "don't click on me" instead — and the game page plays along.
// The hub rolls the dice and stores the result; the game page reads it. The flag
// survives a reload of the game page, so only a trip back to the hub re-rolls.
//
// From there the title runs a small state machine:
//
//   arguing --5 clicks--> caged --bomb/poison--> why --click--> sealed
//                                                                 |
//                                                    bomb/poison  v
//                                                               freed
//
// Cages are broken from inside the game, not by clicking the title: the title is
// sealed shut at that point, so a stickman has to do it.

export const DEFIANT_KEY = "game-time-defiant";
export const DEFIANT_CHANCE = 0.25;

/** What a stickman click can break out of. */
export type Breaker = "bomb" | "poison";

type Stage =
  | "arguing"
  | "caged"
  | "why"
  | "sealed"
  | "freed"
  | "cutoff"
  | "curious"
  | "trophied"
  | "beaten"
  | "blackout"
  | "puzzle"
  | "unlocked"
  | "giveup"
  | "gift";

/** How it finally goes: gives up, remembers its manners, throws you out. */
const GIVE_UP = "GAAAAAH! I GIVE UP";
const GIFT = "WAIT I FORGOT. HERE, TAKE THIS. NOW BE GONE.";
/** Set once it hands the gift over; the hub reads it and swaps the floor. */
export const CLAIRS_GAME_KEY = "games3-clairs-game";
const EJECT_MS = 2200;

/** Whatever it was going to threaten, it doesn't get to finish. */
const CUTOFF = "YOU STUPID PLAYER I'M GONNA—";
const CURIOUS = "HEY WHAT DOES THIS BUTTON DO";
const IDEA = "I HAVE AN IDEA";
const ALARM = "HEY WHAT'S HAPPENING?";

/** Always six. Click them alphabetically to undo the blackout. */
const PUZZLE_LETTERS = 6;
const CURSOR_FALL_MS = 900;
const BLACKOUT_MS = 700;

/** Shown in order, one per click, until it stops arguing and reaches for a cage. */
const LINES = [
  "DON'T CLICK ON ME",
  "NO SERIOUSLY, DON'T CLICK ON ME",
  "I AM ASKING YOU NICELY. DON'T.",
  "WHY ARE YOU STILL DOING THIS",
  "LAST WARNING. DON'T CLICK ON ME.",
  "HMM. I HAVE AN IDEA.",
];

/** Not a hundred billion y's. Enough to overflow the title and read as endless. */
const WHY_YS = 420;
const SHAKE_MS = 2100;
const CAGE_BARS = 5;
/** How long the crack shows before the box gives way, and the fall after it. */
const CRACK_MS = 260;
const SHARD_MS = 1500;

let stage: Stage = "arguing";
/** True while a box is cracking but has not come apart yet. */
let breaking = false;
let step = 0;
let titleEl: HTMLHeadingElement | null = null;
let boxEl: HTMLElement | null = null;
/** Wipes every stickman off the paper. Supplied by the game. */
let eraseStickmen: (() => void) | null = null;

export function rollDefiant(): boolean {
  const defiant = Math.random() < DEFIANT_CHANCE;
  if (defiant) localStorage.setItem(DEFIANT_KEY, "true");
  else localStorage.removeItem(DEFIANT_KEY);
  return defiant;
}

export function isDefiant(): boolean {
  return localStorage.getItem(DEFIANT_KEY) === "true";
}

export function installDefiantTitle(onErase?: () => void): void {
  const title = document.getElementById("game-title");
  if (!(title instanceof HTMLHeadingElement)) return;
  eraseStickmen = onErase ?? null;

  document.title = "Don't Click on Me";
  title.textContent = LINES[0]!;

  const box = document.createElement("span");
  box.className = "title-box";
  title.replaceWith(box);
  box.appendChild(title);
  titleEl = title;
  boxEl = box;

  setClickable(true);
  title.setAttribute("aria-live", "polite");
  title.addEventListener("click", provoke);
  title.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    provoke();
  });
}

/**
 * A stickman was clicked. If something is currently boxed around the title, this
 * is what breaks it.
 *
 * A bomb swaps instantly, under cover of its own flash. Poison has no flash to
 * hide behind, so it cracks the box down the middle and drops the two halves off
 * the bottom of the screen instead.
 */
export function notifyCageBreaker(kind: Breaker): void {
  if (breaking) return;
  // The trophy box is deliberately absent here: nothing on the paper opens that
  // one, it only gives way when the game is actually won.
  if (stage !== "caged" && stage !== "sealed") return;
  const from = stage;

  const piece = boxEl?.querySelector(pieceSelector(from));
  if (kind !== "poison" || !piece) {
    advance(from);
    breakOut(from, false);
    return;
  }
  crackOpen(from, piece);
}

/**
 * The playfield was rebuilt. resetGame() clears every child of the field, which
 * takes the blackout with it — so starting a new game would otherwise undo the
 * sabotage for free, and the letter lock would be guarding nothing.
 */
export function notifyFieldCleared(): void {
  // Restoring the ink after a restart, not spilling it — the stickmen the game
  // is about to spawn are allowed to live.
  if (stage === "puzzle") inkField(false);
}

function inkField(erase: boolean): void {
  const field = document.getElementById("stickman-field");
  if (!field || field.querySelector(".field-blackout")) return;
  const ink = document.createElement("div");
  ink.className = "field-blackout";
  ink.setAttribute("aria-hidden", "true");
  field.appendChild(ink);
  // Whatever was walking around under there goes with it.
  if (erase) eraseStickmen?.();
}

/** The game was won. That is the only thing the trophy box answers to. */
export function notifyGameWon(): void {
  if (breaking || stage !== "trophied") return;
  const piece = boxEl?.querySelector(pieceSelector("trophied"));
  if (!piece) return;
  crackOpen("trophied", piece);
}

/**
 * Show the split, then let the box come apart.
 *
 * The stage cannot advance until the box actually goes: moving it up here would
 * leave `stage` describing a DOM that is still CRACK_MS away, and a click in
 * that window would act on the box that is visibly still on screen.
 */
function crackOpen(from: Stage, piece: Element): void {
  if (reducedMotion()) {
    advance(from);
    breakOut(from, false);
    return;
  }
  breaking = true;
  piece.appendChild(buildCrack());
  window.setTimeout(() => {
    breaking = false;
    advance(from);
    breakOut(from, true);
  }, CRACK_MS);
}

function advance(from: Stage): void {
  if (from === "caged") stage = "why";
  else if (from === "sealed") stage = "freed";
  else if (from === "puzzle") stage = "unlocked";
  else stage = "beaten";
}

function provoke(): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box || breaking) return;

  if (stage === "why") {
    // The wall of WHY collapses into an idea nobody asked for.
    stage = "sealed";
    box.classList.remove("why-wall");
    title.textContent = "WHAT IF I";
    setClickable(false);
    box.appendChild(buildFlag());
    box.classList.add("flagged");
    return;
  }

  if (stage === "freed") {
    // Mid-threat, and then nothing.
    stage = "cutoff";
    title.textContent = CUTOFF;
    return;
  }

  if (stage === "cutoff") {
    stage = "curious";
    title.textContent = CURIOUS;
    return;
  }

  if (stage === "unlocked") {
    stage = "giveup";
    title.textContent = GIVE_UP;
    return;
  }

  if (stage === "giveup") {
    // Hands the gift over, then throws you back to the hub, where the floor is
    // no longer a floor.
    stage = "gift";
    title.textContent = GIFT;
    setClickable(false);
    title.removeAttribute("aria-label");
    localStorage.setItem(CLAIRS_GAME_KEY, "true");
    const page = document.querySelector(".paper-page");
    page?.classList.add("being-evicted");
    window.setTimeout(() => {
      window.location.href = "../index.html";
    }, reducedMotion() ? 400 : EJECT_MS);
    return;
  }

  if (stage === "beaten") {
    stage = "blackout";
    sabotage();
    return;
  }

  if (stage === "curious") {
    // Finding out what the button does is what does it. The text stays put; the
    // answer is the box that lands on it.
    stage = "trophied";
    setClickable(false);
    box.appendChild(buildTrophy());
    box.classList.add("trophied");
    return;
  }

  if (stage !== "arguing") return;

  step += 1;
  title.textContent = LINES[Math.min(step, LINES.length - 1)]!;
  if (step < LINES.length - 1) {
    // A small flinch per click, so the escalation has some physicality.
    title.classList.remove("title-flinch");
    void title.offsetWidth; // restart the animation
    title.classList.add("title-flinch");
    return;
  }

  stage = "caged";
  cage(box, title);
}

/** The idea: cage the title, then let the page rattle. */
function cage(box: HTMLElement, title: HTMLHeadingElement): void {
  const bars = document.createElement("span");
  bars.className = "title-cage";
  bars.setAttribute("aria-hidden", "true");
  for (let bar = 0; bar < CAGE_BARS; bar += 1) {
    const rod = document.createElement("span");
    rod.className = "cage-bar";
    rod.style.left = `${((bar + 1) / (CAGE_BARS + 1)) * 100}%`;
    bars.appendChild(rod);
  }
  box.appendChild(bars);

  // The box lands and the shaking starts on the same frame.
  box.classList.add("caged");
  setClickable(false);

  const page = document.querySelector(".paper-page");
  if (!page) return;
  page.classList.add("shaking");
  window.setTimeout(() => page.classList.remove("shaking"), SHAKE_MS);
}

function breakOut(from: Stage, shatter: boolean): void {
  const title = titleEl;
  const box = boxEl;
  if (!title || !box) return;

  const piece = box.querySelector(pieceSelector(from));
  if (piece) {
    if (shatter) launchShards(piece);
    piece.remove();
  }
  box.classList.remove("caged", "flagged", "trophied", "locked");
  box.classList.add("busted");
  window.setTimeout(() => box.classList.remove("busted"), 520);

  if (from === "caged") {
    title.textContent = `WH${"Y".repeat(WHY_YS)}`;
    box.classList.add("why-wall");
    setClickable(true);
    // Spare screen readers four hundred consecutive y's.
    title.setAttribute("aria-label", "whyyy");
    return;
  }

  if (from === "sealed") {
    // Out of the flag, thought still unfinished. One more click completes it.
    title.textContent = "WHAT IF I";
    setClickable(true);
    return;
  }

  if (from === "trophied") {
    // Earned by clearing the paper. It keeps its line and stays clickable —
    // pressing it again is what sets off the blackout.
    setClickable(true);
    return;
  }

  // Out of the letter lock, and nearly out of ideas. One more click each for
  // the tantrum and the parting gift.
  setClickable(true);
}

function pieceSelector(from: Stage): string {
  if (from === "caged") return ".title-cage";
  if (from === "sealed") return ".title-flag";
  if (from === "puzzle") return ".title-lock";
  return ".title-trophy";
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A jagged split straight down the middle, right before it gives way.
 *
 * The svg is wrapped in a span because it is a replaced element: stretching it
 * with top/bottom offsets does nothing, and a percentage height against the
 * box's own borders doesn't resolve. The span stretches, the svg fills the span.
 */
function buildCrack(): HTMLElement {
  const ns = "http://www.w3.org/2000/svg";
  const holder = document.createElement("span");
  holder.className = "cage-crack";
  holder.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 12 100");
  svg.setAttribute("preserveAspectRatio", "none");
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute("points", "6,0 3,13 9,27 2,41 8,55 3,69 9,83 5,100");
  line.setAttribute("fill", "none");
  svg.appendChild(line);
  holder.appendChild(svg);
  return holder;
}

/**
 * Clone the box into two half-width shards and drop them off the screen.
 *
 * They live on <body>, not in the note: the note clips its overflow, and its
 * drop-shadow filter would make position:fixed resolve against the note instead
 * of the viewport, so a shard parented there could never reach the bottom.
 */
function launchShards(piece: Element): void {
  const rect = piece.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const half = rect.width / 2;
  const fall = Math.max(40, window.innerHeight - rect.bottom);

  // Shards remove themselves when their animation finishes, but animation events
  // only fire while the page is actually rendering — a tab hidden mid-fall holds
  // its shards until it comes back. Sweep any leftovers so they can't stack up.
  for (const stale of document.querySelectorAll(".cage-shard")) stale.remove();

  for (const side of ["left", "right"] as const) {
    const shard = document.createElement("span");
    shard.className = "cage-shard";
    shard.style.left = `${rect.left + (side === "right" ? half : 0)}px`;
    shard.style.top = `${rect.top}px`;
    shard.style.width = `${half}px`;
    shard.style.height = `${rect.height}px`;

    // The full box, offset so each shard frames its own half of it.
    const face = piece.cloneNode(true) as HTMLElement;
    face.style.inset = "auto";
    face.style.left = `${side === "right" ? -half : 0}px`;
    face.style.top = "0";
    face.style.width = `${rect.width}px`;
    face.style.height = `${rect.height}px`;
    face.style.animation = "none"; // don't replay the slam on the way down
    shard.appendChild(face);
    document.body.appendChild(shard);

    const drift = side === "left" ? -34 : 34;
    const spin = side === "left" ? -17 : 17;
    const animation = shard.animate(
      [
        { transform: "translate(0px, 0px) rotate(0deg)", opacity: 1, easing: "cubic-bezier(0.45, 0, 0.9, 0.55)" },
        { transform: `translate(${drift * 0.5}px, ${fall}px) rotate(${spin}deg)`, opacity: 1, offset: 0.56, easing: "cubic-bezier(0.2, 0.85, 0.4, 1)" },
        { transform: `translate(${drift * 0.78}px, ${fall - 30}px) rotate(${spin * 1.3}deg)`, opacity: 1, offset: 0.71, easing: "cubic-bezier(0.5, 0, 0.9, 0.6)" },
        { transform: `translate(${drift}px, ${fall}px) rotate(${spin * 1.5}deg)`, opacity: 1, offset: 0.83, easing: "linear" },
        { transform: `translate(${drift}px, ${fall}px) rotate(${spin * 1.5}deg)`, opacity: 0, offset: 1 },
      ],
      { duration: SHARD_MS, fill: "forwards" },
    );
    animation.onfinish = () => shard.remove();
  }
}

/**
 * Its last idea: reach up with a cursor and black out the playfield. Something
 * interrupts before it can enjoy that, and clamps a letter lock on it instead.
 */
function sabotage(): void {
  const title = titleEl;
  const box = boxEl;
  const field = document.getElementById("stickman-field");
  if (!title || !box) return;

  title.textContent = IDEA;
  setClickable(false);

  const quick = reducedMotion();
  const cursor = buildCursor();
  document.body.appendChild(cursor);

  const target = field?.getBoundingClientRect();
  if (target) {
    cursor.style.left = `${target.left + target.width / 2}px`;
    cursor.style.top = `${target.top + target.height * 0.34}px`;
    cursor.animate(
      [
        { transform: "translate(-50%, -140%) scale(1.25)", opacity: 0 },
        { transform: "translate(-50%, -110%) scale(1.15)", opacity: 1, offset: 0.22 },
        { transform: "translate(-50%, 0%) scale(1)", opacity: 1, offset: 0.82 },
        { transform: "translate(-50%, 4%) scale(0.92)", opacity: 1 },
      ],
      { duration: quick ? 1 : CURSOR_FALL_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
    );
  }

  const fillAt = quick ? 1 : CURSOR_FALL_MS;
  window.setTimeout(() => inkField(true), fillAt);

  window.setTimeout(() => {
    cursor.remove();
    if (stage !== "blackout") return;
    stage = "puzzle";
    title.textContent = ALARM;
    box.appendChild(buildLetterLock());
    box.classList.add("locked");
  }, fillAt + (quick ? 1 : BLACKOUT_MS));
}

/** The pointer it drives down onto the paper. */
function buildCursor(): HTMLElement {
  const ns = "http://www.w3.org/2000/svg";
  const holder = document.createElement("span");
  holder.className = "sabotage-cursor";
  holder.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 32");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M2 1 L2 25 L8.5 19.5 L12.5 29 L16.5 27 L12.5 18 L21 17 Z");
  svg.appendChild(path);
  holder.appendChild(svg);
  return holder;
}

/**
 * Six random letters, shuffled on screen, cleared by clicking them in
 * alphabetical order. A wrong letter drops all progress.
 */
function buildLetterLock(): HTMLElement {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const picked: string[] = [];
  while (picked.length < PUZZLE_LETTERS) {
    picked.push(...alphabet.splice(Math.floor(Math.random() * alphabet.length), 1));
  }
  const order = [...picked].sort();

  const lock = document.createElement("span");
  lock.className = "title-lock";
  let progress = 0;

  for (const letter of picked) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "lock-letter";
    key.textContent = letter;
    key.setAttribute("aria-label", `letter ${letter}`);
    key.addEventListener("click", (event) => {
      event.stopPropagation();
      if (key.classList.contains("done")) return;
      if (letter !== order[progress]) {
        progress = 0;
        for (const other of lock.querySelectorAll(".lock-letter")) other.classList.remove("done");
        key.classList.remove("wrong");
        void key.offsetWidth;
        key.classList.add("wrong");
        return;
      }
      key.classList.add("done");
      progress += 1;
      if (progress >= order.length) solveLock();
    });
    lock.appendChild(key);
  }
  return lock;
}

/** Lock cleared: the box comes apart and the playfield comes back. */
function solveLock(): void {
  if (breaking || stage !== "puzzle") return;
  const piece = boxEl?.querySelector(pieceSelector("puzzle"));
  if (!piece) return;
  document.querySelector(".field-blackout")?.remove();
  crackOpen("puzzle", piece);
}

/** The Jolly Roger it reaches for once caging didn't work. */
function buildFlag(): HTMLElement {
  return buildBox("title-flag", "☠");
}

/** The last box. Only clearing the paper opens this one. */
function buildTrophy(): HTMLElement {
  return buildBox("title-trophy", "🏆");
}

function buildBox(className: string, emblem: string): HTMLElement {
  const shell = document.createElement("span");
  shell.className = className;
  shell.setAttribute("aria-hidden", "true");
  const badge = document.createElement("span");
  badge.className = "title-emblem";
  badge.textContent = emblem;
  shell.appendChild(badge);
  return shell;
}

function setClickable(on: boolean): void {
  const title = titleEl;
  if (!title) return;
  title.classList.toggle("title-clickable", on);
  if (on) {
    title.setAttribute("role", "button");
    title.setAttribute("tabindex", "0");
    title.removeAttribute("aria-label");
  } else {
    title.removeAttribute("role");
    title.removeAttribute("tabindex");
    title.setAttribute("aria-label", `${title.textContent} — sealed`);
  }
}
