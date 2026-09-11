import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { H, W, canvas, ctx, type Point, type Room } from "./engine";
import { createNothingRoom } from "./room1";
import { createWorkbenchRoom } from "./room2";
import { createComicalRoom } from "./room3";
import { ensureAudio } from "./sound";
import { TOOLBAR_SLOTS, TOOLS, selectedTool, toggleTool, type Tool } from "./tools";

installOofShortcut();
installForceRefreshHotkey();

// Runs the rooms in order. Escaping one drops you straight into the next, and
// the furthest room you have reached is remembered so you can go back to it.

const UNLOCKED_KEY = "zero-logic-escape-rooms-unlocked";
const TOOLS_SEEN_KEY = "zero-logic-escape-rooms-tools-seen";
const TITLE_MS = 2400;

const roomLabel = document.getElementById("room-name") as HTMLParagraphElement;
const overlay = document.getElementById("escape-overlay") as HTMLDivElement;
const overlayNote = document.getElementById("escape-note") as HTMLParagraphElement;
const overlayNext = document.getElementById("escape-next") as HTMLParagraphElement;
const picker = document.getElementById("room-picker") as HTMLElement;
const toolbar = document.getElementById("toolbar") as HTMLElement;
const toolbarSlots = document.getElementById("toolbar-slots") as HTMLDivElement;

const rooms: Room[] = [createNothingRoom(roomEscaped), createWorkbenchRoom(roomEscaped), createComicalRoom(roomEscaped)];

let current = 0;
let title: { start: number; lead: string } | null = null;
let pointer: Point = { x: W / 2, y: H / 2 };
let lastFrame = performance.now();

// How many rooms you are allowed into. Can be bigger than the number of rooms
// that exist yet, so beating the last one unlocks the next as soon as it's built.
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
  current = index;
  const now = performance.now();
  title = { start: now, lead };
  rooms[index]?.reset(now + TITLE_MS);
  overlay.hidden = true;
  roomLabel.textContent = `Escape Room ${index + 1} · ${rooms[index]?.name ?? ""}`;
  renderPicker();
  renderToolbar();
}

function roomEscaped(): void {
  const next = current + 1;
  const lead = rooms[current]?.exitLine ?? "";
  unlock(next + 1);
  if (next < rooms.length) {
    enterRoom(next, lead);
    return;
  }
  overlayNote.textContent = lead;
  overlayNext.textContent = `ESCAPE ROOM ${next + 1}`;
  overlay.hidden = false;
  renderPicker();
  renderToolbar();
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

// ---------- tool bar ----------

function ownedTools(): Tool[] {
  const unlocked = readUnlocked();
  return TOOLS.filter((tool) => unlocked >= tool.unlockedAtRoom);
}

function readSeenTools(): string[] {
  try {
    const seen: unknown = JSON.parse(localStorage.getItem(TOOLS_SEEN_KEY) ?? "[]");
    return Array.isArray(seen) ? seen.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function markToolSeen(id: string): void {
  const seen = readSeenTools();
  if (seen.includes(id)) return;
  try {
    localStorage.setItem(TOOLS_SEEN_KEY, JSON.stringify([...seen, id]));
  } catch {
    // The NEW badge will just keep showing.
  }
}

function useTool(tool: Tool): void {
  ensureAudio();
  toggleTool(tool.id);
  markToolSeen(tool.id);
  renderToolbar();
}

// Hidden until you own a tool. Empty slots show where later tools will go.
function renderToolbar(): void {
  const owned = ownedTools();
  toolbar.hidden = owned.length === 0;
  const seen = readSeenTools();
  const slots: HTMLElement[] = [];
  for (let i = 0; i < TOOLBAR_SLOTS; i += 1) {
    const tool = owned[i];
    if (!tool) {
      const empty = document.createElement("span");
      empty.className = "tool-slot is-empty";
      empty.textContent = "?";
      empty.setAttribute("aria-hidden", "true");
      slots.push(empty);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-slot";
    button.title = `${tool.name} (press ${i + 1})`;
    button.setAttribute("aria-pressed", String(selectedTool() === tool.id));
    button.innerHTML = `${tool.icon}<span class="tool-name">${tool.name}</span>${
      seen.includes(tool.id) ? "" : '<span class="tool-new">NEW</span>'
    }`;
    button.addEventListener("click", () => useTool(tool));
    slots.push(button);
  }
  toolbarSlots.replaceChildren(...slots);
}

// Number keys pick tools too, 1 for the first slot and so on.
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const index = Number(event.key) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= TOOLBAR_SLOTS) return;
  const tool = ownedTools()[index];
  if (tool) useTool(tool);
});

// ---------- title card ----------

// Black card between rooms: how you got out, then where you are now.
function drawTitleCard(now: number): void {
  if (!title) return;
  const elapsed = now - title.start;
  if (elapsed >= TITLE_MS) {
    title = null;
    return;
  }
  const fadeOut = elapsed > TITLE_MS - 500 ? (TITLE_MS - elapsed) / 500 : 1;
  const textIn = Math.min(1, elapsed / 400);

  ctx.fillStyle = `rgba(0, 0, 0, ${fadeOut})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = fadeOut * textIn;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (title.lead) {
    ctx.fillStyle = "#b9adc4";
    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText(title.lead, W / 2, H / 2 - 80);
  }
  ctx.fillStyle = "#ffcf5a";
  ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
  ctx.fillText(`ESCAPE ROOM ${current + 1}`, W / 2, H / 2 - 30);
  ctx.fillStyle = "#f5efe6";
  ctx.font = "64px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
  ctx.fillText((rooms[current]?.name ?? "").toUpperCase(), W / 2, H / 2 + 30);
  ctx.globalAlpha = 1;
}

// ---------- input ----------

function toCanvas(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * W) / rect.width,
    y: ((event.clientY - rect.top) * H) / rect.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  ensureAudio();
  pointer = toCanvas(event);
  const now = performance.now();
  // The card normally clears itself while drawing, but no frames are drawn in
  // a hidden tab, so check the clock too or this click would be eaten.
  if (title && now - title.start >= TITLE_MS) title = null;
  if (title) {
    // Click through the title card once it has had a moment on screen.
    if (now - title.start > 400) {
      title = null;
      rooms[current]?.reset(now);
    }
    return;
  }
  if (!overlay.hidden) return;
  canvas.setPointerCapture(event.pointerId);
  rooms[current]?.pointerDown(pointer);
});

canvas.addEventListener("pointermove", (event) => {
  pointer = toCanvas(event);
  if (!title) rooms[current]?.pointerMove(pointer);
});

function endPointer(event: PointerEvent): void {
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  pointer = toCanvas(event);
  rooms[current]?.pointerUp(pointer);
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

overlay.querySelector('[data-action="restart"]')?.addEventListener("click", () => enterRoom(0));

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const room = rooms[current];
  if (room) {
    room.update(now, dt);
    room.draw(now);
  }
  drawTitleCard(now);
  canvas.style.cursor = title || !overlay.hidden || !room ? "default" : room.cursor(pointer);
  requestAnimationFrame(frame);
}

enterRoom(Math.min(readUnlocked(), rooms.length) - 1);
requestAnimationFrame(frame);
