import { isGigantic, markFound } from "../../shared/bigGames";
markFound("zero-logic-escape-rooms-2");
import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { H, W, canvas, ctx, giantFont, setGiant, type Point, type Room } from "../zero-logic-escape-rooms/engine";
import { ensureAudio } from "../zero-logic-escape-rooms/sound";
import { createBlankRoom } from "./room1";
import { createButtonRoom } from "./room2";
import { createExeRoom } from "./room3";
import { createDoorRoom } from "./room4";
import { resetNoDoorLine } from "./noDoorLine";
import { isThisGameSupercharged } from "../../shared/superchargedHub";

installOofShortcut();
installForceRefreshHotkey();

// Zero Logic Escape Rooms 2. Nobody found this the normal way: it took a door
// drawn in Draw and Swap, a hallway, and two wires under a card on Games 4.
// Escaping a room drops you straight into the next one, and how far you got is
// remembered so you can go back to any room you have reached.

// GIGANTIC Zero Logic Escape Rooms 2: the rooms and their puzzles stay normal
// size, and everything else (the junk in them, effects, words, the page around
// the game) goes giant. The first game's styles.css does the page.
const GIGANTIC = isGigantic("zero-logic-escape-rooms-2");
if (GIGANTIC) {
  setGiant(3);
  document.body.classList.add("gigantic");
  document.title = "GIGANTIC Zero Logic Escape Rooms 2";
  const heading = document.querySelector(".hero h1");
  if (heading) heading.textContent = "GIGANTIC Zero Logic Escape Rooms 2";
}

// Supercharged by dev.1: escaping a room doesn't just open the next one. A
// lightning bolt smashes the room you were in into pieces that go flying off
// the screen, and the next room is underneath.
const SUPERCHARGED = isThisGameSupercharged();
const SHATTER_MS = 1400;
const SHARD_SIZE = 60;
const SHARD_GRAVITY = 1100;

interface Shard {
  // Where the piece came from in the old room, and how it's flying.
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}

let shatter: { start: number; picture: HTMLCanvasElement; shards: Shard[] } | null = null;

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
  if (SUPERCHARGED) smashRoom();
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

// Takes a picture of the room as it was, cut into squares that all blast away
// from the middle of the screen.
function smashRoom(): void {
  const picture = document.createElement("canvas");
  picture.width = W;
  picture.height = H;
  picture.getContext("2d")?.drawImage(canvas, 0, 0, W, H);
  const shards: Shard[] = [];
  for (let y = 0; y < H; y += SHARD_SIZE) {
    for (let x = 0; x < W; x += SHARD_SIZE) {
      const awayX = x + SHARD_SIZE / 2 - W / 2;
      const awayY = y + SHARD_SIZE / 2 - H / 2;
      const away = Math.hypot(awayX, awayY) || 1;
      const speed = 300 + Math.random() * 500;
      shards.push({
        x,
        y,
        vx: (awayX / away) * speed,
        vy: (awayY / away) * speed - 250,
        spin: (Math.random() - 0.5) * 8,
      });
    }
  }
  shatter = { start: performance.now(), picture, shards };
}

function drawShatter(now: number): void {
  if (!shatter) return;
  const seconds = (now - shatter.start) / 1000;
  const t = seconds / (SHATTER_MS / 1000);
  if (t >= 1) {
    shatter = null;
    return;
  }
  for (const shard of shatter.shards) {
    const x = shard.x + SHARD_SIZE / 2 + shard.vx * seconds;
    const y = shard.y + SHARD_SIZE / 2 + shard.vy * seconds + (SHARD_GRAVITY * seconds * seconds) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(shard.spin * seconds);
    const half = SHARD_SIZE / 2;
    ctx.drawImage(shatter.picture, shard.x, shard.y, SHARD_SIZE, SHARD_SIZE, -half, -half, SHARD_SIZE, SHARD_SIZE);
    ctx.strokeStyle = "#bff0ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-half, -half, SHARD_SIZE, SHARD_SIZE);
    ctx.restore();
  }

  // The bolt that did it, and a blue flash, for the first moment only.
  if (t < 0.25) {
    ctx.fillStyle = `rgba(150, 220, 255, ${0.6 * (1 - t / 0.25)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = "#5fd0ff";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 6;
    ctx.beginPath();
    let boltX = W / 2;
    ctx.moveTo(boltX, 0);
    for (let y = 0; y <= H; y += H / 8) {
      boltX += (Math.random() - 0.5) * 120;
      ctx.lineTo(boltX, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

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
    giantFont("20px 'Trebuchet MS', sans-serif", title.lead);
    ctx.fillText(title.lead, W / 2, H / 2 - (GIGANTIC ? 200 : 110));
  }
  const heading = `ESCAPE ROOM ${current + 1}`;
  const name = (rooms[current]?.name ?? "").toUpperCase();
  ctx.fillStyle = "#ffcf5a";
  giantFont("bold 22px 'Trebuchet MS', sans-serif", heading);
  ctx.fillText(heading, W / 2, H / 2 - (GIGANTIC ? 100 : 54));
  ctx.fillStyle = "#f5efe6";
  giantFont("54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif", name);
  ctx.fillText(name, W / 2, H / 2 + (GIGANTIC ? 50 : 6));
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
  if (SUPERCHARGED) drawShatter(now);

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
