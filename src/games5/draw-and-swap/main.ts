import { createBoard, textFont, textHeight, type Point, type ToolName } from "./board";
import { formatClock, swapOrder, type Door } from "./paint";
import { openGuest, openHost, type Link } from "./net";
import { rollVibe, type Vibe } from "./themes";

const COLORS = [
  "#111111",
  "#ffffff",
  "#e03131",
  "#ff8c1a",
  "#ffe066",
  "#38d9a9",
  "#1c7ed6",
  "#7048e8",
  "#ff4fa3",
  "#8b5a2b",
];

// Round 1 everyone draws their own. Round 2 the papers shuffle one seat along.
// Round 3 they come home, so whoever started a drawing also finishes it.
const SHIFTS = [0, 1, 0];
const GRACE_MS = 8000;
// Where a 🚪 goes when somebody opens it.
const SECRET_GAME = "../behind-the-door/index.html";

function pick<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const ui = {
  status: pick<HTMLParagraphElement>("status"),
  lobby: pick<HTMLElement>("lobby"),
  room: pick<HTMLElement>("room"),
  studio: pick<HTMLElement>("studio"),
  galleryPanel: pick<HTMLElement>("gallery-panel"),
  gallery: pick<HTMLDivElement>("gallery"),
  artistName: pick<HTMLInputElement>("artist-name"),
  createForm: pick<HTMLFormElement>("create-form"),
  createRoom: pick<HTMLInputElement>("create-room"),
  joinForm: pick<HTMLFormElement>("join-form"),
  joinRoom: pick<HTMLInputElement>("join-room"),
  roomTitle: pick<HTMLHeadingElement>("room-title"),
  vibeName: pick<HTMLParagraphElement>("vibe-name"),
  vibeHint: pick<HTMLParagraphElement>("vibe-hint"),
  reroll: pick<HTMLButtonElement>("reroll"),
  artists: pick<HTMLUListElement>("artists"),
  hostControls: pick<HTMLDivElement>("host-controls"),
  guestWait: pick<HTMLParagraphElement>("guest-wait"),
  minutes: pick<HTMLSelectElement>("minutes"),
  start: pick<HTMLButtonElement>("start"),
  roundLabel: pick<HTMLParagraphElement>("round-label"),
  roundLine: pick<HTMLParagraphElement>("round-line"),
  clock: pick<HTMLParagraphElement>("clock"),
  paper: pick<HTMLCanvasElement>("paper"),
  preview: pick<HTMLCanvasElement>("preview"),
  tools: pick<HTMLDivElement>("tools"),
  colors: pick<HTMLDivElement>("colors"),
  eraseAll: pick<HTMLButtonElement>("erase-all"),
  size: pick<HTMLInputElement>("size"),
  sizeReadout: pick<HTMLSpanElement>("size-readout"),
  done: pick<HTMLButtonElement>("done"),
  doorLine: pick<HTMLParagraphElement>("door-line"),
  textBox: pick<HTMLDivElement>("text-box"),
  textInput: pick<HTMLInputElement>("text-input"),
  skipHint: pick<HTMLParagraphElement>("host-skip-hint"),
  skip: pick<HTMLButtonElement>("skip"),
  again: pick<HTMLButtonElement>("again"),
  confirm: pick<HTMLDivElement>("confirm"),
  confirmYes: pick<HTMLButtonElement>("confirm-yes"),
  confirmNo: pick<HTMLButtonElement>("confirm-no"),
};

let textSpot: Point | null = null;

const board = createBoard(ui.paper, ui.preview, {
  onTextSpot: (spot) => openTextBox(spot),
  onDoorOpen: () => openDoor(),
  onDoorsChanged: (doors) => paintDoorLine(doors),
});

interface Seat {
  id: string;
  name: string;
  done: boolean;
}

interface RoundMessage {
  t: "round";
  round: number;
  rounds: number;
  vibe: Vibe;
  ms: number;
  image: string;
  doors: Door[];
  ownerName: string;
  mine: boolean;
}

interface Paper {
  image: string;
  doors: Door[];
}

interface GalleryItem extends Paper {
  owner: string;
}

let link: Link | null = null;
let role: "host" | "guest" = "host";
let selfName = "Somebody";
let roomName = "";
let vibe: Vibe = rollVibe();
let roundMs = 300000;

// Host-only bookkeeping.
let seats: Seat[] = [];
let papers: Paper[] = [];
let round = 0;
let deadline = 0;
let collecting = false;
let roundTimer = 0;

// Everybody's own round state.
let ticking = 0;
let submitted = false;
let endsAt = 0;

function say(text: string): void {
  ui.status.textContent = text;
}

function show(section: HTMLElement, visible: boolean): void {
  section.hidden = !visible;
}

function paintVibe(): void {
  ui.vibeName.textContent = vibe.name;
  ui.vibeHint.textContent = vibe.hint;
}

function paintRoster(): void {
  ui.artists.innerHTML = seats
    .map((seat) => {
      const you = seat.name === selfName && seat.id === "host" && role === "host";
      const classes = [you ? "is-you" : "", seat.done ? "is-done" : ""].filter(Boolean).join(" ");
      return `<li class="${classes}">${seat.name}</li>`;
    })
    .join("");
}

function paintRosterFrom(names: string[], done: boolean[], you: string): void {
  ui.artists.innerHTML = names
    .map((name, index) => {
      const classes = [name === you ? "is-you" : "", done[index] ? "is-done" : ""]
        .filter(Boolean)
        .join(" ");
      return `<li class="${classes}">${name}</li>`;
    })
    .join("");
}

function broadcastRoster(): void {
  link?.send("*", {
    t: "roster",
    names: seats.map((seat) => seat.name),
    done: seats.map((seat) => seat.done),
  });
  paintRoster();
}

// ---------------------------------------------------------------- lobby

function connect(asHost: boolean, name: string): void {
  role = asHost ? "host" : "guest";
  selfName = name;
  const onStatus = (text: string): void => say(text);
  const onMessage = asHost ? hostHears : guestHears;

  link = asHost
    ? openHost({ roomName, onMessage, onStatus, onLeave: dropSeat })
    : openGuest({
        roomName,
        onMessage,
        onStatus,
        onReady: () => link?.send("host", { t: "hello", name: selfName }),
      });

  ui.roomTitle.textContent = `Room: ${roomName}`;
  show(ui.lobby, false);
  show(ui.room, true);
  show(ui.hostControls, asHost);
  show(ui.reroll, asHost);
  show(ui.guestWait, !asHost);
  paintVibe();

  if (asHost) {
    seats = [{ id: "host", name: selfName, done: false }];
    paintRoster();
    say(`Room "${roomName}" is opening…`);
  } else {
    say(`Knocking on "${roomName}"…`);
  }
}

ui.createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  roomName = ui.createRoom.value.trim();
  if (!roomName) return;
  vibe = rollVibe();
  connect(true, ui.artistName.value.trim() || "The Host");
});

ui.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  roomName = ui.joinRoom.value.trim();
  if (!roomName) return;
  connect(false, ui.artistName.value.trim() || "A Guest");
});

ui.reroll.addEventListener("click", () => {
  vibe = rollVibe(vibe.name);
  paintVibe();
  link?.send("*", { t: "vibe", vibe });
});

ui.minutes.addEventListener("change", () => {
  roundMs = Number(ui.minutes.value) * 60000;
});

ui.start.addEventListener("click", () => {
  if (role !== "host") return;
  roundMs = Number(ui.minutes.value) * 60000;
  papers = seats.map(() => ({ image: "", doors: [] }));
  round = 0;
  beginRound();
});

// ------------------------------------------------------------- host side

function dropSeat(id: string): void {
  seats = seats.filter((seat) => seat.id !== id);
  if (round === 0) broadcastRoster();
}

function hostHears(from: string, body: unknown): void {
  const message = body as {
    t?: string;
    name?: string;
    image?: string;
    doors?: Door[];
    round?: number;
  };
  if (message?.t === "hello") {
    if (round > 0) {
      link?.send(from, { t: "busy" });
      return;
    }
    const known = seats.find((seat) => seat.id === from);
    if (known) known.name = message.name ?? known.name;
    else seats.push({ id: from, name: message.name ?? "Mystery Artist", done: false });
    link?.send(from, { t: "vibe", vibe });
    broadcastRoster();
    say(`${message.name ?? "Somebody"} is in. ${seats.length} artists.`);
    return;
  }

  if (message?.t === "art" && typeof message.image === "string") {
    if (message.round !== round) return;
    stashPaper(seats.findIndex((entry) => entry.id === from), {
      image: message.image,
      doors: message.doors ?? [],
    });
  }
}

// A finished paper goes into the pile under the number of whoever started it,
// not whoever was holding it when the clock ran out.
function stashPaper(seatIndex: number, paper: Paper): void {
  const seat = seats[seatIndex];
  if (!seat) return;
  const order = swapOrder(seats.length, SHIFTS[round - 1] ?? 0);
  papers[order[seatIndex] ?? seatIndex] = paper;
  seat.done = true;
  broadcastRoster();
  if (collecting) tryFinishRound();
}

function beginRound(): void {
  round += 1;
  collecting = false;
  for (const seat of seats) seat.done = false;
  const order = swapOrder(seats.length, SHIFTS[round - 1] ?? 0);

  seats.forEach((seat, index) => {
    const paper = order[index] ?? index;
    const owner = seats[paper];
    if (!owner) return;
    const message: RoundMessage = {
      t: "round",
      round,
      rounds: SHIFTS.length,
      vibe,
      ms: roundMs,
      image: papers[paper]?.image ?? "",
      doors: papers[paper]?.doors ?? [],
      ownerName: owner.name,
      mine: paper === index,
    };
    if (seat.id === "host") void enterRound(message);
    else link?.send(seat.id, message);
  });

  broadcastRoster();
  deadline = Date.now() + roundMs;
  window.clearInterval(roundTimer);
  roundTimer = window.setInterval(watchRound, 400);
}

function watchRound(): void {
  if (round === 0) return;
  if (!collecting && Date.now() >= deadline) startCollecting();
  if (collecting) tryFinishRound();
}

function startCollecting(): void {
  collecting = true;
  deadline = Date.now();
  link?.send("*", { t: "collect", round });
  // The host is drawing too, so its own paper has to go in the pile as well.
  sendArt();
}

function tryFinishRound(): void {
  const everyone = seats.every((seat) => seat.done);
  if (!everyone && Date.now() < deadline + GRACE_MS) return;
  window.clearInterval(roundTimer);
  collecting = false;

  if (round < SHIFTS.length) {
    beginRound();
    return;
  }

  round = 0;
  const items: GalleryItem[] = seats.map((seat, index) => ({
    owner: seat.name,
    image: papers[index]?.image ?? "",
    doors: papers[index]?.doors ?? [],
  }));
  link?.send("*", { t: "gallery", items });
  showGallery(items);
}

ui.skip.addEventListener("click", () => {
  if (role !== "host" || round === 0) return;
  startCollecting();
});

// ------------------------------------------------------------ guest side

function guestHears(_from: string, body: unknown): void {
  const message = body as {
    t?: string;
    names?: string[];
    done?: boolean[];
    vibe?: Vibe;
    items?: GalleryItem[];
  };
  switch (message?.t) {
    case "vibe":
      if (message.vibe) {
        vibe = message.vibe;
        paintVibe();
      }
      return;
    case "roster":
      if (message.names) paintRosterFrom(message.names, message.done ?? [], selfName);
      return;
    case "round":
      void enterRound(body as RoundMessage);
      return;
    case "collect":
      sendArt();
      return;
    case "gallery":
      showGallery(message.items ?? []);
      return;
    case "back":
      backToRoom();
      return;
    case "busy":
      say("That room is already drawing. Wait for them to finish a game.");
      return;
    default:
  }
}

// -------------------------------------------------------------- the round

async function enterRound(message: RoundMessage): Promise<void> {
  round = message.round;
  vibe = message.vibe;
  paintVibe();
  submitted = false;
  await board.load(message.image, message.doors ?? []);
  board.setLocked(false);

  show(ui.room, false);
  show(ui.galleryPanel, false);
  show(ui.studio, true);
  show(ui.skipHint, role === "host");
  ui.done.disabled = false;
  ui.done.textContent = "I'm Done Early";

  paintDoorLine(board.doors());
  closeTextBox();
  ui.roundLabel.textContent = `Round ${message.round} of ${message.rounds}`;
  if (message.round === 1) ui.roundLine.textContent = `Your paper. Vibe: ${vibe.name}.`;
  else if (message.mine) ui.roundLine.textContent = "Your paper came back. Finish it off.";
  else ui.roundLine.textContent = `${message.ownerName}'s paper now. Keep it going.`;

  endsAt = Date.now() + message.ms;
  window.clearInterval(ticking);
  ticking = window.setInterval(tick, 200);
  tick();
  say(`Drawing. No prompt, just ${vibe.name}.`);
}

function tick(): void {
  const left = endsAt - Date.now();
  ui.clock.textContent = formatClock(left);
  ui.clock.classList.toggle("is-low", left <= 30000);
  if (left <= 0) {
    window.clearInterval(ticking);
    sendArt();
  }
}

function sendArt(): void {
  if (submitted || round === 0) return;
  submitted = true;
  window.clearInterval(ticking);
  board.setLocked(true);
  ui.done.disabled = true;
  ui.done.textContent = "Pencils down";
  ui.clock.textContent = "0:00";
  say("Handing your paper over. Waiting for everyone else…");

  const paper: Paper = { image: board.snapshot(), doors: board.doors() };
  if (role === "host") {
    stashPaper(
      seats.findIndex((entry) => entry.id === "host"),
      paper
    );
  } else {
    link?.send("host", { t: "art", ...paper, round });
  }
}

ui.done.addEventListener("click", sendArt);

// ------------------------------------------------------------ text & doors

// The words land where you clicked, so the box that asks for them sits there
// too, sized like the letters it's about to make.
function openTextBox(spot: Point): void {
  textSpot = spot;
  const box = ui.paper.getBoundingClientRect();
  const scale = box.width / ui.paper.width;
  const height = textHeight(Number(ui.size.value));
  ui.textBox.hidden = false;
  ui.textBox.style.left = `${spot.x * scale}px`;
  ui.textBox.style.top = `${spot.y * scale}px`;
  ui.textInput.style.font = textFont(height >= 18 ? Number(ui.size.value) : 6);
  ui.textInput.style.fontSize = `${Math.max(14, height * scale)}px`;
  ui.textInput.value = "";
  ui.textInput.focus();
}

function closeTextBox(): void {
  textSpot = null;
  ui.textBox.hidden = true;
}

function commitText(): void {
  const spot = textSpot;
  const words = ui.textInput.value;
  closeTextBox();
  if (!spot) return;
  board.placeText(spot, words);
  if (words.includes("🚪")) say("A door. Double-click it and see where it goes.");
}

ui.textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitText();
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeTextBox();
  }
});

ui.textInput.addEventListener("blur", commitText);

function paintDoorLine(doors: Door[]): void {
  ui.doorLine.hidden = doors.length === 0;
}

function openDoor(): void {
  say("The door is opening…");
  window.location.href = SECRET_GAME;
}

// ---------------------------------------------------------------- toolbar

ui.tools.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tool]");
  if (!button) return;
  for (const other of ui.tools.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
    const on = other === button;
    other.classList.toggle("is-on", on);
    other.setAttribute("aria-pressed", String(on));
  }
  board.setTool(button.dataset["tool"] as ToolName);
});

ui.colors.innerHTML = COLORS.map(
  (hex, index) =>
    `<button class="swatch${index === 0 ? " is-on" : ""}" type="button" data-color="${hex}" style="background:${hex}" aria-label="${hex}"></button>`
).join("");

ui.colors.addEventListener("click", (event) => {
  const swatch = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-color]");
  if (!swatch) return;
  for (const other of ui.colors.querySelectorAll(".swatch")) other.classList.remove("is-on");
  swatch.classList.add("is-on");
  board.setColor(swatch.dataset["color"] ?? "#111111");
});

ui.size.addEventListener("input", () => {
  ui.sizeReadout.textContent = ui.size.value;
  board.setSize(Number(ui.size.value));
});

// Erase All is the one button you can't take back, so it asks first.
ui.eraseAll.addEventListener("click", () => {
  show(ui.confirm, true);
  ui.confirmNo.focus();
});

ui.confirmNo.addEventListener("click", () => show(ui.confirm, false));

ui.confirmYes.addEventListener("click", () => {
  board.eraseAll();
  show(ui.confirm, false);
  say("Blank paper. Start over.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ui.confirm.hidden) show(ui.confirm, false);
});

// ---------------------------------------------------------------- gallery

function showGallery(items: GalleryItem[]): void {
  window.clearInterval(ticking);
  board.setLocked(true);
  show(ui.studio, false);
  show(ui.room, false);
  show(ui.galleryPanel, true);
  show(ui.again, role === "host");
  ui.gallery.innerHTML = items
    .map((item) => {
      // Doors are stored in paper coordinates, so they scale with the picture.
      const hotspots = item.doors
        .map(
          (door) =>
            `<button class="door-spot" type="button" aria-label="Open the door" style="left:${(door.x / 900) * 100}%;top:${(door.y / 620) * 100}%;width:${(door.w / 900) * 100}%;height:${(door.h / 620) * 100}%"></button>`
        )
        .join("");
      return `<figure><span class="framed"><img src="${item.image}" alt="${item.owner}'s drawing" />${hotspots}</span><figcaption>${item.owner} started it. Everyone else made it worse.</figcaption></figure>`;
    })
    .join("");
  say(
    items.some((item) => item.doors.length > 0)
      ? "Done. And somebody left a door in one of these."
      : "Done. Look what happened to your drawing."
  );
}

ui.gallery.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest(".door-spot")) openDoor();
});

function backToRoom(): void {
  round = 0;
  submitted = false;
  board.eraseAll();
  show(ui.galleryPanel, false);
  show(ui.studio, false);
  show(ui.room, true);
  say("Back in the room. Roll a new vibe whenever.");
}

ui.again.addEventListener("click", () => {
  if (role !== "host") return;
  vibe = rollVibe(vibe.name);
  paintVibe();
  for (const seat of seats) seat.done = false;
  link?.send("*", { t: "back" });
  link?.send("*", { t: "vibe", vibe });
  backToRoom();
  broadcastRoster();
});

window.addEventListener("beforeunload", () => link?.close());
