import { giganticGames, hasBeenLost, makeGigantic, wasFound } from "../shared/bigGames";
import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

// Every game from every hub in one big list. Secret games only show up once
// you've found them, and the lost ones only once you've been lost.

type Hub = "Games 1" | "Games 2" | "Games 3" | "Games 4" | "Games 5" | "Penelope's Games" | "BIG games" | "Lost";

interface BigGame {
  id: string;
  name: string;
  path: string;
  // The first one is where it lives; any others just link to it.
  hubs: Hub[];
  blurb: string;
  // Asks whether you've already found it (besides just opening it).
  secret?: () => boolean;
}

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

const GAMES: BigGame[] = [
  { id: "a-hard-easy-game", name: "A Hard Easy Game", path: "../games/a-hard-easy-game/index.html", hubs: ["Games 1"], blurb: "A dramatic obstacle run where most of the danger is just showing off." },
  { id: "oscars-untitled-maze-game", name: "Oscar's Untitled Maze Game", path: "../games/oscars-untitled-maze-game/index.html", hubs: ["Games 1"], blurb: "Sneaky rules, twisted levels, and a maze that keeps changing the deal." },
  { id: "tamagotchi-monster", name: "Tamagotchi Monster", path: "../games/tamagotchi-monster/index.html", hubs: ["Games 1"], blurb: "Raise a weird little creature and keep its glitchy little life on track." },
  { id: "a-kids-life", name: "A Kid's Life", path: "../games/a-kids-life/index.html", hubs: ["Penelope's Games", "Games 1"], blurb: "Raise a sweet kid, grow a whole family tree, and keep each home cozy." },

  { id: "drawing-boss-mania", name: "Drawing Boss Mania", path: "../games2/drawing-boss-mania/index.html", hubs: ["Games 2"], blurb: "Sketch your way through bosses that won't sit still." },
  { id: "stickman-fight", name: "Stickman Fight", path: "../games2/stickman-fight/index.html", hubs: ["Games 2"], blurb: "Swing weapons, flop around, and earn coins to upgrade your arsenal." },
  { id: "the-settings-game", name: "The Settings Game", path: "../games/the-settings-game/index.html", hubs: ["Games 2"], blurb: "Tinker the settings menu to bend the level into something you can finish." },
  { id: "feed-your-fire", name: "Feed Your Fire", path: "../games2/feed-your-fire/index.html", hubs: ["Games 2"], blurb: "Pour rainbow gasoline into a clingy little fire and watch it grow up." },

  { id: "make-your-own-beatboxer-thingy", name: "Make Your Own Beatboxer Thingy", path: "../games3/make-your-own-beatboxer-thingy/index.html", hubs: ["Games 3"], blurb: "Chop up Oscar's voice, poke in a pattern, and make a suspiciously sick beat." },
  { id: "sharks-in-the-water", name: "Sharks in the Water", path: "../games3/sharks-in-the-water/index.html", hubs: ["Games 3", "Penelope's Games"], blurb: "Leave your raft for supply drops, gather rare materials, and watch the water for fins." },
  { id: "zero-player-game", name: "Zero Player Game", path: "../games3/zero-player-game/index.html", hubs: ["Games 3"], blurb: "Build a machine out of movers, rotators, and generators, then press play and watch it fight for you." },
  { id: "game-time", name: "Game Time", path: "../games3/game-time/index.html", hubs: ["Games 3"], blurb: "The paper one that says Click on Me. Or maybe it doesn't." },
  { id: "clairs-game", name: "Claire's Game", path: "../games3/clairs-game/index.html", hubs: ["Games 3"], blurb: "A front yard, Farttopia, and a telescope that gets you to the planets.", secret: () => flag("games3-clairs-game") },

  { id: "telephone", name: "Telephone", path: "../games4/telephone/index.html", hubs: ["Games 4"], blurb: "Whisper a word down a line of recordings. Guess it wrong at the end and you're banned forever." },
  { id: "zero-logic-escape-rooms", name: "Zero Logic Escape Rooms", path: "../games4/zero-logic-escape-rooms/index.html", hubs: ["Games 4"], blurb: "No door. No window. No nothing. The way out makes absolutely no sense." },
  { id: "teleporting-ping-pong", name: "Teleporting Ping Pong", path: "../games4/teleporting-ping-pong/index.html", hubs: ["Games 4"], blurb: "Smash the ball hard enough and it deletes itself and pops up somewhere else." },
  { id: "zero-logic-escape-rooms-2", name: "Zero Logic Escape Rooms 2", path: "../games4/zero-logic-escape-rooms-2/index.html", hubs: ["Games 4"], blurb: "The sequel, behind the wires.", secret: () => flag("zero-logic-escape-rooms-wired") },
  { id: "world-sandbox", name: "World Sandbox", path: "../games4/world-sandbox/index.html", hubs: ["Games 4"], blurb: "You put the whole Earth back together. The possibilities are endless.", secret: () => flag("zero-logic-escape-rooms-earth-built") },

  { id: "the-simulation", name: "The Simulation", path: "../games5/the-simulation/index.html", hubs: ["Games 5"], blurb: "A block world full of glitches. Ladders are safe." },
  { id: "draw-and-swap", name: "Draw and Swap", path: "../games5/draw-and-swap/index.html", hubs: ["Games 5"], blurb: "No prompt, just a vibe. Then somebody else finishes your drawing." },
  { id: "cross-your-fingers", name: "Cross Your Fingers", path: "../games5/cross-your-fingers/index.html", hubs: ["Games 5"], blurb: "A new piece of land every time. Hope there's a black coin in it." },
  { id: "behind-the-door", name: "Behind the Door", path: "../games5/behind-the-door/index.html", hubs: ["Games 5"], blurb: "A hallway of doors. One of them is the way out.", secret: () => flag("games4-kicked-out") },

  { id: "cat-math", name: "Cat Math", path: "../games/cat-math/index.html", hubs: ["Penelope's Games"], blurb: "Solve cozy math facts, earn coins, and dress up Penelope's cat." },
  { id: "cats-for-kitties", name: "Catch the Kitties!!!", path: "../games/cats-for-kitties/index.html", hubs: ["Penelope's Games"], blurb: "Kitties pop up in the rainbow room. Catch the rare ones for big points!" },

  { id: "gem-smasher", name: "Gem Smasher", path: "./gem-smasher/index.html", hubs: ["BIG games"], blurb: "Smash the gems in the dark before they fade away!", secret: () => false },

  { id: "holdens-game", name: "Holden's Game", path: "../games3/holdens-game/index.html", hubs: ["Lost"], blurb: "Holden's own game, with a shop and eleven worlds." },
  { id: "corrupted-games", name: "c0rrupt3d games", path: "../corrupted-games/index.html", hubs: ["Lost"], blurb: "A whole hub, stuck behind the Delayed tape." },
  { id: "bio-tech", name: "Bio Tech", path: "../corrupted-games/bio-tech/index.html", hubs: ["Lost"], blurb: "The game inside the c0rrupt3d hub." },
  { id: "penelopes-old-page", name: "Penelope's Old Page", path: "../games/penelope/index.html", hubs: ["Lost"], blurb: "The first Penelope page." },
  { id: "snake", name: "Snake", path: "../lost/snake/index.html", hubs: ["Lost"], blurb: "Oscar's first ever game. Rainbow stripes and a snake that poops." },
  { id: "wall-dodger", name: "Wall Dodger Survival", path: "../lost/wall-dodger/index.html", hubs: ["Lost"], blurb: "Four walls closing in on you and a ball bouncing around inside." },
  { id: "ground-jumper", name: "Ground Jumper", path: "../lost/ground-jumper/index.html", hubs: ["Lost"], blurb: "Three lanes to hop between and a dressing room for your coins." },
  { id: "police-chase", name: "Police Chase", path: "../lost/police-chase/index.html", hubs: ["Lost"], blurb: "Stickmen running across rooftops at night, dodging cops." },
  { id: "software-hack", name: "Software Hack", path: "../lost/software-hack/index.html", hubs: ["Lost"], blurb: "Hack the AI before it hacks you back." },
  { id: "mermaid-math", name: "Mermaid Math", path: "../lost/mermaid-math/index.html", hubs: ["Lost"], blurb: "Sums up to ten and pearls to count." },
  { id: "roblox-trivia", name: "Roblox Trivia", path: "../lost/roblox-trivia/index.html", hubs: ["Lost"], blurb: "Five modes on the menu and a pile of secret ones underneath." },
];

type Filter = "all" | "secret" | Hub;

const isSecret = (game: BigGame): boolean => game.secret !== undefined;
const isFound = (game: BigGame): boolean => wasFound(game.id) || (game.secret?.() ?? false);

// A game you're allowed to see at all: secrets need finding, lost games need
// you to have been lost.
function isVisible(game: BigGame): boolean {
  if (isSecret(game)) return isFound(game);
  if (game.hubs.includes("Lost")) return hasBeenLost();
  return true;
}

function filterChoices(): { value: Filter; label: string }[] {
  const choices: { value: Filter; label: string }[] = [
    { value: "all", label: "Everything" },
    { value: "Games 1", label: "Games 1" },
    { value: "Games 2", label: "Games 2" },
    { value: "Games 3", label: "Games 3" },
    { value: "Games 4", label: "Games 4" },
    { value: "Games 5", label: "Games 5" },
    { value: "Penelope's Games", label: "Penelope's Games" },
    { value: "secret", label: "Secret games" },
  ];
  if (hasBeenLost()) choices.push({ value: "Lost", label: "Lost games" });
  return choices;
}

let filter: Filter = "all";
let query = "";

const list = document.getElementById("big-list") as HTMLUListElement;
const tape = document.getElementById("filter-tape") as HTMLButtonElement;
const tapeLabel = document.getElementById("filter-label") as HTMLSpanElement;
const menu = document.getElementById("filter-menu") as HTMLDivElement;
const search = document.getElementById("search") as HTMLInputElement;

// Which hub filter a game falls under, ignoring whether you've found it.
function inFilter(game: BigGame): boolean {
  if (filter === "secret") return isSecret(game);
  if (filter === "all") return true;
  return game.hubs.includes(filter);
}

function matchesSearch(game: BigGame): boolean {
  if (!query) return true;
  const haystack = `${nameFor(game)} ${game.hubs.join(" ")} ${game.blurb} ${isSecret(game) ? "secret" : ""}`.toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

// A secret you haven't found yet gets a locked ??? card, so you know there's
// still something out there. Not while searching, or the name would give it away.
const isLockedSecret = (game: BigGame): boolean => isSecret(game) && !isFound(game) && !query;

// Drag B, I and G off the title onto one game and it goes GIGANTIC. Only
// games that have a gigantic mode built into them can take the letters.
type Letter = "B" | "I" | "G";
const LETTERS: Letter[] = ["B", "I", "G"];
const CAN_GO_GIGANTIC = new Set([
  "stickman-fight",
  "teleporting-ping-pong",
  "world-sandbox",
  "the-simulation",
  "draw-and-swap",
  "cross-your-fingers",
  "behind-the-door",
  "drawing-boss-mania",
  "the-settings-game",
  "feed-your-fire",
  "cat-math",
  "ground-jumper",
  "police-chase",
  "software-hack",
  "mermaid-math",
  "roblox-trivia",
  "make-your-own-beatboxer-thingy",
  "sharks-in-the-water",
  "zero-player-game",
  "game-time",
  "clairs-game",
  "a-hard-easy-game",
  "oscars-untitled-maze-game",
  "tamagotchi-monster",
  "a-kids-life",
  "holdens-game",
  "bio-tech",
  "snake",
  "wall-dodger",
  "telephone",
  "zero-logic-escape-rooms",
  "zero-logic-escape-rooms-2",
]);
const placed: Partial<Record<Letter, string>> = {};

const isGigantic = (game: BigGame): boolean => giganticGames().includes(game.id);
const nameFor = (game: BigGame): string => (isGigantic(game) ? `GIGANTIC ${game.name}` : game.name);
const hrefFor = (game: BigGame): string => (isGigantic(game) ? `${game.path}?gigantic` : game.path);

function badgesFor(game: BigGame): string {
  const here = LETTERS.filter((letter) => placed[letter] === game.id);
  if (here.length === 0) return "";
  return `<span class="card-letters">${here
    .map((letter) => `<span class="card-letter" data-letter="${letter}">${letter}</span>`)
    .join("")}</span>`;
}

function cardFor(game: BigGame): string {
  if (!isVisible(game)) {
    return `
    <li>
      <div class="big-card locked-card" aria-label="A secret game you haven't found yet">
        <span class="big-card-top">
          <span class="hub-tag">${game.hubs[0]}</span>
          <span class="secret-tag">Secret</span>
        </span>
        <span class="big-title">???</span>
        <span class="big-blurb">Somewhere in ${game.hubs[0]}. Keep looking.</span>
      </div>
    </li>`;
  }
  return `
    <li class="${isGigantic(game) ? "is-gigantic" : ""}">
      <a class="big-card${isGigantic(game) ? " gigantic-card" : ""}" href="${hrefFor(game)}" data-game-id="${game.id}">
        <span class="big-card-top">
          <span class="hub-tag">${game.hubs[0]}</span>
          ${isSecret(game) ? '<span class="secret-tag">Secret</span>' : ""}
          ${isGigantic(game) ? '<span class="gigantic-tag">Gigantic</span>' : ""}
        </span>
        ${badgesFor(game)}
        <span class="big-title">${nameFor(game)}</span>
        <span class="big-blurb">${game.blurb}</span>
      </a>
    </li>`;
}

function render(): void {
  const shown = GAMES.filter((game) => inFilter(game) && ((isVisible(game) && matchesSearch(game)) || isLockedSecret(game)));
  list.innerHTML =
    shown.length === 0
      ? `<li class="empty">${(query ? `Nothing called "${query}". Yet.` : "No games here.").replace(/</g, "&lt;")}</li>`
      : shown.map(cardFor).join("");
}

// The big rainbow number: how many games you can play right now.
function renderCounter(): void {
  const playable = GAMES.filter(isVisible).length;
  const counter = document.getElementById("game-count");
  const found = document.getElementById("game-found");
  if (counter) counter.textContent = `${playable} GAMES`;
  if (found) found.textContent = `${playable} of ${GAMES.length} found`;
}

function renderMenu(): void {
  menu.innerHTML = filterChoices()
    .map(
      (choice) =>
        `<button class="filter-choice${choice.value === filter ? " is-picked" : ""}" type="button" role="menuitem" data-filter="${choice.value}">${choice.label}</button>`
    )
    .join("");
}

function setMenuOpen(open: boolean): void {
  menu.hidden = !open;
  tape.setAttribute("aria-expanded", String(open));
  if (open) renderMenu();
}

tape.addEventListener("click", () => setMenuOpen(menu.hidden));

menu.addEventListener("click", (event) => {
  const choice = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-filter]");
  if (!choice) return;
  filter = choice.dataset["filter"] as Filter;
  tapeLabel.textContent = filter === "all" ? "Filter by" : `Filter by: ${choice.textContent}`;
  setMenuOpen(false);
  render();
});

document.addEventListener("click", (event) => {
  if (!menu.hidden && !(event.target as HTMLElement).closest(".filter-wrap")) setMenuOpen(false);
});

search.addEventListener("input", () => {
  query = search.value.trim().toLowerCase();
  render();
});

// Can't decide? The dice decides, out of everything you're allowed to play.
const surprise = document.getElementById("surprise");
surprise?.addEventListener("click", () => {
  const playable = GAMES.filter(isVisible);
  const pick = playable[Math.floor(Math.random() * playable.length)];
  if (!pick || !surprise) return;
  surprise.textContent = `🎲 ${nameFor(pick)}!`;
  window.setTimeout(() => {
    window.location.href = hrefFor(pick);
  }, 900);
});

// The floor right at the bottom. Stand on it and it breaks: every game falls
// through, and then they all come flying back up.
const floor = document.getElementById("big-floor") as HTMLButtonElement | null;
let floorBusy = false;
floor?.addEventListener("click", () => {
  if (floorBusy) return;
  floorBusy = true;
  floor.textContent = "CRACK!";
  floor.classList.add("is-broken");
  const cards = [...list.querySelectorAll("li")];
  cards.forEach((card, index) => {
    card.style.setProperty("--spin", `${(index % 2 ? 1 : -1) * (20 + ((index * 37) % 50))}deg`);
    card.style.animationDelay = `${index * 40}ms`;
    card.classList.add("is-falling");
  });
  window.setTimeout(() => {
    floor.textContent = "OOPS. HERE THEY COME BACK";
    cards.forEach((card) => card.classList.replace("is-falling", "is-flying-back"));
  }, 1800 + cards.length * 40);
  window.setTimeout(() => {
    cards.forEach((card) => {
      card.classList.remove("is-flying-back");
      card.style.animationDelay = "";
    });
    floor.classList.remove("is-broken");
    floor.textContent = "STAND ON ME. I'M BIG.";
    floorBusy = false;
  }, 3200 + cards.length * 80);
});

// ── Stealing letters ────────────────────────────────────────────────────────
// The title doesn't like it. Three steals and it bursts into tears, and the
// tears come down the page like waterfalls. One of them has a door behind it.

const title = document.getElementById("big-title") as HTMLElement;
const subtitle = document.getElementById("subtitle") as HTMLElement;
const COMPLAINTS = ["Hey, stop it!", "Please stop.", "Thief. );"];
let steals = 0;

function stealFromTitle(): void {
  steals += 1;
  subtitle.textContent = COMPLAINTS[Math.min(steals, COMPLAINTS.length) - 1] ?? "";
  if (steals === COMPLAINTS.length) startCrying();
}

function syncTitle(): void {
  for (const span of title.querySelectorAll<HTMLElement>(".title-letter")) {
    span.classList.toggle("is-stolen", placed[span.dataset["letter"] as Letter] !== undefined);
  }
}

function cardUnder(x: number, y: number): HTMLAnchorElement | null {
  return document.elementFromPoint(x, y)?.closest<HTMLAnchorElement>("a.big-card[data-game-id]") ?? null;
}

function grumble(text: string): void {
  const toast = document.createElement("div");
  toast.className = "big-toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function dropLetter(letter: Letter, card: HTMLAnchorElement | null): void {
  const id = card?.dataset["gameId"];
  if (!card || !id) {
    delete placed[letter];
  } else if (!CAN_GO_GIGANTIC.has(id)) {
    delete placed[letter];
    card.classList.add("is-shaking");
    window.setTimeout(() => card.classList.remove("is-shaking"), 500);
    grumble("Too small to go gigantic... yet!");
  } else {
    placed[letter] = id;
    if (LETTERS.every((each) => placed[each] === id)) {
      makeGigantic(id);
      for (const each of LETTERS) delete placed[each];
      const game = GAMES.find((each) => each.id === id);
      grumble(`${game?.name ?? "It"} is GIGANTIC now!`);
    }
  }
  syncTitle();
  render();
}

// One drag, wherever it starts: off the title, or off a card it was left on.
function startDrag(letter: Letter, event: PointerEvent, fromTitle: boolean): void {
  event.preventDefault();
  if (fromTitle) stealFromTitle();
  delete placed[letter];
  document.body.classList.add("is-dragging");
  const ghost = document.createElement("div");
  ghost.className = "letter-ghost";
  ghost.textContent = letter;
  document.body.appendChild(ghost);
  title.querySelector<HTMLElement>(`[data-letter="${letter}"]`)?.classList.add("is-stolen");
  render();

  let hovered: HTMLAnchorElement | null = null;
  const move = (x: number, y: number): void => {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    const card = cardUnder(x, y);
    if (card !== hovered) {
      hovered?.classList.remove("is-target");
      card?.classList.add("is-target");
      hovered = card;
    }
  };
  move(event.clientX, event.clientY);

  const onMove = (moveEvent: PointerEvent): void => move(moveEvent.clientX, moveEvent.clientY);
  const onUp = (upEvent: PointerEvent): void => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    hovered?.classList.remove("is-target");
    ghost.remove();
    document.body.classList.remove("is-dragging");
    dropLetter(letter, upEvent.type === "pointercancel" ? null : cardUnder(upEvent.clientX, upEvent.clientY));
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

title.addEventListener("pointerdown", (event) => {
  const span = (event.target as HTMLElement).closest<HTMLElement>(".title-letter:not(.is-stolen)");
  if (span) startDrag(span.dataset["letter"] as Letter, event, true);
});

list.addEventListener("pointerdown", (event) => {
  const badge = (event.target as HTMLElement).closest<HTMLElement>(".card-letter");
  if (badge) startDrag(badge.dataset["letter"] as Letter, event, false);
});

// A letter left on a card mustn't open the game when you grab it.
list.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest(".card-letter")) event.preventDefault();
});

// ── Crying ──────────────────────────────────────────────────────────────────

const waterfalls = document.getElementById("waterfalls") as HTMLElement;
// Kept away from the middle, so you can still read what the title is saying.
const STREAMS = [8, 25, 39, 62, 84];
// The door is behind the fourth waterfall, this far down from where it starts.
const DOOR_STREAM = 3;
const DOOR_DEPTH = 1150;
const DOOR_HEIGHT = 110;

function startCrying(): void {
  document.body.classList.add("crying");
  const page = document.querySelector<HTMLElement>(".page");
  if (!page) return;
  const top = title.offsetTop + title.offsetHeight * 0.75;
  waterfalls.style.top = `${top}px`;
  waterfalls.innerHTML = STREAMS.map(
    (left, index) => `
    <div class="waterfall" style="left: ${left}%" data-stream="${index}">
      ${index === DOOR_STREAM ? `<a class="secret-door" href="./secret-room/index.html" style="top: ${DOOR_DEPTH}px" aria-label="A secret door" tabindex="-1"></a>` : ""}
    </div>`
  ).join("");
}

// Poke a waterfall and the water parts for a moment. Only one spot has
// anything behind it.
waterfalls.addEventListener("click", (event) => {
  const fall = (event.target as HTMLElement).closest<HTMLElement>(".waterfall");
  if (!fall || (event.target as HTMLElement).closest(".secret-door.is-found")) return;
  const depth = event.clientY - fall.getBoundingClientRect().top;
  const door = fall.querySelector<HTMLElement>(".secret-door");
  const doorIsBehindWater = fall.offsetHeight >= DOOR_DEPTH + DOOR_HEIGHT;
  if (door && doorIsBehindWater && depth >= DOOR_DEPTH - 40 && depth <= DOOR_DEPTH + DOOR_HEIGHT + 40) {
    door.classList.add("is-found");
    door.tabIndex = 0;
    return;
  }
  const part = document.createElement("div");
  part.className = "water-part";
  part.style.top = `${depth}px`;
  fall.appendChild(part);
  window.setTimeout(() => part.remove(), 1100);
});

renderCounter();
render();
