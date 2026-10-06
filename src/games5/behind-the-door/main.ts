import { isGigantic, markFound } from "../../shared/bigGames";
markFound("behind-the-door");
import { markKickedOut } from "../../games4/wirePanel";
import { DOORS_BEFORE_EXIT, exitDoor, roomFor, type Room } from "./hallway";
import { isThisGameSupercharged } from "../../shared/superchargedHub";

const canvas = document.getElementById("hall") as HTMLCanvasElement;
const paint = canvas.getContext("2d") as CanvasRenderingContext2D;
const countLine = document.getElementById("count");
const tagline = document.getElementById("tagline");

// GIGANTIC Behind the Door: the doors you pick from stay door-sized, and
// everything around them goes giant: knobs, numbers, rooms, the way out.
const GIGANTIC = isGigantic("behind-the-door");
const GIANT = GIGANTIC ? 3 : 1;
if (GIGANTIC) {
  document.title = "GIGANTIC Behind the Door";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "GIGANTIC Behind the Door";
}
// Supercharged by dev.1: one door in every hallway crackles with lightning.
// Open it and it zaps you through three doors at once.
const SUPERCHARGED = isThisGameSupercharged();
const ZAP_DOORS = 3;

// Giant words still have to fit on the screen.
const FIT = GIGANTIC ? 860 : undefined;

// The way out doesn't loop back into the hallway, and it doesn't explain
// itself either. It shuts the whole thing down and leaves you on another hub.
const KICKED_OUT_TO = "../../games4/index.html";

const DOOR_SPOTS = [
  { x: 110, y: 200, w: 160, h: 300 },
  { x: 370, y: 180, w: 170, h: 330 },
  { x: 640, y: 200, w: 160, h: 300 },
];

type Scene = "hall" | "room" | "out";

let scene: Scene = "hall";
let opened = 0;
let exit: number | null = null;
let room: Room = roomFor(0);
let sparkle = 0;
// Which door is the lightning door this time, and how many doors the last one
// zapped you through (0 when it was an ordinary door).
let charged: number | null = null;
let zapped = 0;
let crackling = false;

function nextHallway(): void {
  exit = exitDoor(opened, Math.random());
  charged = SUPERCHARGED ? Math.floor(Math.random() * DOOR_SPOTS.length) : null;
  scene = "hall";
  drawScene();
  if (SUPERCHARGED && !crackling) {
    crackling = true;
    window.requestAnimationFrame(crackle);
  }
}

// The lightning door never sits still, so the hallway keeps redrawing while
// you're standing in it.
function crackle(): void {
  if (scene !== "hall") {
    crackling = false;
    return;
  }
  drawHallway();
  window.requestAnimationFrame(crackle);
}

// A jagged bolt from one point to another, wobbling differently every frame.
function bolt(fromX: number, fromY: number, toX: number, toY: number): void {
  paint.beginPath();
  paint.moveTo(fromX, fromY);
  const steps = 6;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    paint.lineTo(
      fromX + (toX - fromX) * t + (Math.random() - 0.5) * 26,
      fromY + (toY - fromY) * t + (Math.random() - 0.5) * 26
    );
  }
  paint.lineTo(toX, toY);
  paint.stroke();
}

function drawLightningDoor(spot: (typeof DOOR_SPOTS)[number]): void {
  paint.save();
  paint.shadowColor = "#7fdcff";
  paint.shadowBlur = 24 + Math.random() * 16;
  paint.strokeStyle = "#bff0ff";
  paint.lineWidth = 6;
  paint.strokeRect(spot.x, spot.y, spot.w, spot.h);
  paint.lineWidth = 3 * GIANT;
  const corners = [
    [spot.x, spot.y],
    [spot.x + spot.w, spot.y],
    [spot.x + spot.w, spot.y + spot.h],
    [spot.x, spot.y + spot.h],
  ];
  // Two or three bolts jump between the corners of the frame each frame.
  const bolts = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < bolts; i += 1) {
    const from = corners[Math.floor(Math.random() * 4)] ?? [spot.x, spot.y];
    const to = corners[Math.floor(Math.random() * 4)] ?? [spot.x, spot.y];
    if (from === to) continue;
    bolt(from[0] ?? 0, from[1] ?? 0, to[0] ?? 0, to[1] ?? 0);
  }
  paint.fillStyle = "#ffffff";
  paint.font = `bold ${30 * GIANT}px 'Trebuchet MS', sans-serif`;
  paint.textAlign = "center";
  paint.fillText("⚡", spot.x + spot.w / 2, spot.y + spot.h / 2 + 10 * GIANT);
  paint.restore();
}

function drawHallway(): void {
  // A corridor drawn as one big vanishing point, then doors on the walls.
  const gradient = paint.createRadialGradient(450, 280, 20, 450, 280, 520);
  gradient.addColorStop(0, "#241a3d");
  gradient.addColorStop(1, "#0b0812");
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, canvas.width, canvas.height);

  paint.strokeStyle = "rgba(255, 255, 255, 0.08)";
  paint.lineWidth = 2 * GIANT;
  for (const corner of [
    [0, 0],
    [canvas.width, 0],
    [0, canvas.height],
    [canvas.width, canvas.height],
  ]) {
    paint.beginPath();
    paint.moveTo(corner[0] ?? 0, corner[1] ?? 0);
    paint.lineTo(450, 280);
    paint.stroke();
  }

  DOOR_SPOTS.forEach((spot, index) => {
    paint.fillStyle = "#6b4a2f";
    paint.fillRect(spot.x, spot.y, spot.w, spot.h);
    paint.strokeStyle = "#2a1a10";
    paint.lineWidth = 6;
    paint.strokeRect(spot.x, spot.y, spot.w, spot.h);

    paint.fillStyle = "#3d2717";
    paint.fillRect(spot.x + 18, spot.y + 24, spot.w - 36, spot.h * 0.4);
    paint.fillRect(spot.x + 18, spot.y + spot.h * 0.52, spot.w - 36, spot.h * 0.36);

    paint.fillStyle = "#ffe066";
    paint.beginPath();
    paint.arc(spot.x + spot.w - 26, spot.y + spot.h / 2, 7 * GIANT, 0, Math.PI * 2);
    paint.fill();

    paint.fillStyle = "rgba(255, 255, 255, 0.55)";
    paint.font = `bold ${26 * GIANT}px 'Trebuchet MS', sans-serif`;
    paint.textAlign = "center";
    paint.fillText(String(index + 1), spot.x + spot.w / 2, spot.y - 14);

    if (index === charged) drawLightningDoor(spot);
  });

  paint.fillStyle = "rgba(233, 227, 245, 0.75)";
  paint.font = "18px 'Trebuchet MS', sans-serif";
  paint.textAlign = "center";
  paint.fillText(
    opened < DOORS_BEFORE_EXIT
      ? "Three doors. Same as last time."
      : "One of these might be the way out.",
    450,
    540
  );
}

function drawRoom(): void {
  paint.fillStyle = room.color;
  paint.fillRect(0, 0, canvas.width, canvas.height);

  // Whatever's in here, it's made of the same three shapes every time.
  paint.strokeStyle = room.ink;
  paint.fillStyle = room.ink;
  paint.globalAlpha = 0.25;
  for (let i = 0; i < 14; i += 1) {
    const x = ((i * 137) % 860) + 20;
    const y = ((i * 211) % 420) + 60;
    const size = (20 + ((i * 53) % 70)) * GIANT;
    paint.lineWidth = 3 * GIANT;
    if (i % 3 === 0) paint.strokeRect(x, y, size, size);
    else if (i % 3 === 1) {
      paint.beginPath();
      paint.arc(x, y, size / 2, 0, Math.PI * 2);
      paint.stroke();
    } else {
      paint.beginPath();
      paint.moveTo(x, y);
      paint.lineTo(x + size, y + size);
      paint.stroke();
    }
  }
  paint.globalAlpha = 1;

  paint.fillStyle = room.ink;
  paint.textAlign = "center";
  paint.font = `bold ${46 * GIANT}px Impact, 'Arial Narrow Bold', sans-serif`;
  paint.fillText(room.name, 450, GIGANTIC ? 330 : 300, FIT);
  paint.font = "20px 'Trebuchet MS', sans-serif";
  paint.fillText(room.line, 450, GIGANTIC ? 400 : 344);
  if (zapped > 0) {
    paint.fillStyle = "#bff0ff";
    paint.font = `bold ${28 * GIANT}px Impact, 'Arial Narrow Bold', sans-serif`;
    paint.fillText(`⚡ ZAPPED THROUGH ${zapped} DOORS AT ONCE ⚡`, 450, 160, FIT);
  }
  paint.fillStyle = "rgba(255, 255, 255, 0.6)";
  paint.font = "16px 'Trebuchet MS', sans-serif";
  paint.fillText("Click to step back into the hallway.", 450, 500);
}

function drawWayOut(): void {
  sparkle += 1;
  paint.fillStyle = "#f7f3ff";
  paint.fillRect(0, 0, canvas.width, canvas.height);

  paint.fillStyle = "#ffe066";
  for (let i = 0; i < 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2 + sparkle / 60;
    const reach = (140 + Math.sin(sparkle / 20 + i) * 30) * (GIGANTIC ? 1.6 : 1);
    paint.beginPath();
    paint.arc(450 + Math.cos(angle) * reach, 280 + Math.sin(angle) * reach, 6 * GIANT, 0, Math.PI * 2);
    paint.fill();
  }

  paint.fillStyle = "#2a1140";
  paint.textAlign = "center";
  paint.font = `bold ${54 * GIANT}px Impact, 'Arial Narrow Bold', sans-serif`;
  paint.fillText("THE WAY OUT", 450, GIGANTIC ? 290 : 265, FIT);
  paint.font = "22px 'Trebuchet MS', sans-serif";
  paint.fillText(`You opened ${opened} doors to find it.`, 450, GIGANTIC ? 350 : 310);
  paint.font = "17px 'Trebuchet MS', sans-serif";
  paint.fillText("Click to go through.", 450, GIGANTIC ? 390 : 360);
}

function drawScene(): void {
  if (scene === "hall") drawHallway();
  else if (scene === "room") drawRoom();
  else drawWayOut();

  if (countLine) countLine.textContent = `Doors opened: ${opened}`;
  if (tagline) {
    tagline.textContent =
      scene === "out"
        ? "You found it. Nobody's going to believe you."
        : "You drew a door. You opened it. This is what was behind it.";
  }
}

function openDoor(index: number): void {
  opened += 1;
  zapped = 0;
  // The lightning door counts as three. It never hides the way out, though:
  // if the exit is behind it, you still just walk out.
  if (index === charged && exit !== index) {
    opened += ZAP_DOORS - 1;
    zapped = ZAP_DOORS;
  }
  if (exit === index) {
    scene = "out";
    sparkle = 0;
    window.requestAnimationFrame(shine);
    drawScene();
    return;
  }
  room = roomFor(Math.floor(Math.random() * 1000));
  scene = "room";
  drawScene();
}

// The way-out screen keeps twinkling until you click off it.
function shine(): void {
  if (scene !== "out") return;
  drawWayOut();
  window.requestAnimationFrame(shine);
}

canvas.addEventListener("click", (event) => {
  if (scene === "out") {
    markKickedOut();
    window.location.href = KICKED_OUT_TO;
    return;
  }
  if (scene !== "hall") {
    nextHallway();
    return;
  }
  const box = canvas.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * canvas.width;
  const y = ((event.clientY - box.top) / box.height) * canvas.height;
  const hit = DOOR_SPOTS.findIndex(
    (spot) => x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h
  );
  if (hit >= 0) openDoor(hit);
});

document.addEventListener("keydown", (event) => {
  if (scene !== "hall") return;
  const index = ["1", "2", "3"].indexOf(event.key);
  if (index >= 0) openDoor(index);
});

nextHallway();
