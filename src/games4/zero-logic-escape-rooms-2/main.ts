import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { H, W, canvas, ctx, type Point, type Room } from "../zero-logic-escape-rooms/engine";
import { ensureAudio } from "../zero-logic-escape-rooms/sound";
import { createBlankRoom } from "./room1";
import { createButtonRoom } from "./room2";
import { createExeRoom } from "./room3";
import { createDoorRoom } from "./room4";
import { resetNoDoorLine } from "./noDoorLine";

installOofShortcut();
installForceRefreshHotkey();

// Zero Logic Escape Rooms 2. Nobody found this the normal way: it took a door
// drawn in Draw and Swap, a hallway, and two wires under a card on Games 4.
// Escaping a room drops you straight into the next one, and how far you got is
// remembered so you can go back to any room you have reached.

const TITLE_MS = 2400;
const UNLOCKED_KEY = "zero-logic-escape-rooms-2-unlocked";

const roomLabel = document.getElementById("room-name") as HTMLParagraphElement;
const picker = document.getElementById("room-picker") as HTMLElement;
const overlay = document.getElementById("escape-overlay") as HTMLDivElement;
const overlayNote = document.getElementById("escape-note") as HTMLParagraphElement;

const rooms: Room[] = [
  createBlankRoom(roomEscaped),
  createButtonRoom(roomEscaped),
  createExeRoom(roomEscaped),
  createDoorRoom(roomEscaped),
];

let current = 0;
let title: { start: number; lead: string } | null = null;
let pointer: Point = { x: W / 2, y: H / 2 };
let lastFrame = performance.now();

function readUnlocked(): number {
  try {
    const value = Number(localStorage.getItem(UNLOCKED_KEY));
    return Number.isInteger(value) && value >= 1 ? value : 1;
  } catch {
    return 1;
  }
}

function unlock(count: number): void {
  try {
    if (count > readUnlocked()) localStorage.setItem(UNLOCKED_KEY, String(count));
  } catch {
    // Progress just won't be remembered.
  }
}

function enterRoom(index: number, lead = ""): void {
  // Room 4 rewrites the sentence under the game; every other room gets it back.
  resetNoDoorLine();
  current = index;
  const now = performance.now();
  title = { start: now, lead };
  rooms[index]?.reset(now + TITLE_MS);
  overlay.hidden = true;
  roomLabel.textContent = `Escape Room ${index + 1} · ${rooms[index]?.name ?? ""}`;
  renderPicker();
}

function roomEscaped(): void {
  const next = current + 1;
  const lead = rooms[current]?.exitLine ?? "";
  unlock(next + 1);
  if (next < rooms.length) {
    enterRoom(next, lead);
    return;
  }
  // That was the last room there is so far.
  overlayNote.textContent = lead;
  overlay.hidden = false;
  renderPicker();
}

function renderPicker(): void {
  const reachable = Math.min(readUnlocked(), rooms.length);
  picker.replaceChildren(
    ...rooms.slice(0, reachable).map((room, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${index + 1} · ${room.name}`;
      if (index === current) button.setAttribute("aria-current", "true");
      button.addEventListener("click", () => enterRoom(index));
      return button;
    })
  );
  picker.hidden = reachable < 2;
}

overlay.querySelector("[data-action='restart']")?.addEventListener("click", () => {
  ensureAudio();
  enterRoom(0);
});

// The room name card that sits over the room for the first couple of seconds.
function drawTitle(now: number): boolean {
  if (!title) return false;
  const since = now - title.start;
  if (since > TITLE_MS) {
    title = null;
    return false;
  }
  const fade = since > TITLE_MS - 400 ? (TITLE_MS - since) / 400 : 1;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.88 * fade})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = fade;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (title.lead) {
    ctx.fillStyle = "#b9adc4";
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText(title.lead, W / 2, H / 2 - 110);
  }
  ctx.fillStyle = "#ffcf5a";
  ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
  ctx.fillText(`ESCAPE ROOM ${current + 1}`, W / 2, H / 2 - 54);
  ctx.fillStyle = "#f5efe6";
  ctx.font = "54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  ctx.fillText((rooms[current]?.name ?? "").toUpperCase(), W / 2, H / 2 + 6);
  ctx.globalAlpha = 1;
  return true;
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const room = rooms[current];
  if (room) {
    room.update(now, dt);
    room.draw(now);
    canvas.style.cursor = title ? "default" : room.cursor(pointer);
  }
  drawTitle(now);

  window.requestAnimationFrame(frame);
}

function spotOf(event: PointerEvent): Point {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * W,
    y: ((event.clientY - box.top) / box.height) * H,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  ensureAudio();
  if (title) return;
  pointer = spotOf(event);
  rooms[current]?.pointerDown(pointer);
});

canvas.addEventListener("pointermove", (event) => {
  pointer = spotOf(event);
  if (!title) rooms[current]?.pointerMove(pointer);
});

canvas.addEventListener("pointerup", (event) => {
  pointer = spotOf(event);
  if (!title) rooms[current]?.pointerUp(pointer);
});

enterRoom(0);
window.requestAnimationFrame(frame);
