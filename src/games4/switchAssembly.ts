// Building the secret switch on the Games 4 hub, once you're back out of Zero
// Logic Escape Rooms with all three switch pieces from its bonus levels. Unlike
// the rooms, this part runs on as much logic as possible: the plate goes on
// the wall, the screws hold it on, the lever goes in the plate, and then you
// flip it to check it works.

const PIECE_COUNT = 3;
const pieceKey = (n: number): string => `zero-logic-escape-rooms-switch-piece-${n}`;
const BUILT_KEY = "zero-logic-escape-rooms-switch-built";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function hasAllSwitchPieces(): boolean {
  for (let n = 1; n <= PIECE_COUNT; n += 1) if (!readFlag(pieceKey(n))) return false;
  return true;
}

export function switchIsBuilt(): boolean {
  return readFlag(BUILT_KEY);
}

type PieceId = "plate" | "screwA" | "screwB" | "lever";

interface Piece {
  id: PieceId;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  placed: boolean;
}

interface Point {
  x: number;
  y: number;
}

const W = 720;
const H = 460;
const TRAY_TOP = 310;
const PLATE = { x: 330, y: 170, w: 90, h: 135 };
const HOLES: Point[] = [
  { x: PLATE.x, y: PLATE.y - 54 },
  { x: PLATE.x, y: PLATE.y + 54 },
];
const BULB: Point = { x: 590, y: 90 };

const FLIP_MS = 160;
const DONE_MS = 1800;
const NOTE_MS = 2600;

export function openSwitchAssembly(onDone: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = "switch-assembly";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Build the switch");
  overlay.innerHTML = `
    <div class="switch-assembly-panel">
      <p class="switch-assembly-eyebrow">You have all 3 switch pieces</p>
      <h2 class="switch-assembly-title">Build the Switch</h2>
      <p class="switch-assembly-step" aria-live="polite"></p>
      <canvas class="switch-assembly-canvas" width="${W}" height="${H}" aria-label="A wall with a light bulb, and the switch pieces on a shelf below"></canvas>
    </div>
  `;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const stepText = overlay.querySelector(".switch-assembly-step") as HTMLParagraphElement;

  const pieces: Piece[] = (
    [
      ["plate", 110, 385],
      ["screwA", 250, 368],
      ["screwB", 320, 368],
      ["lever", 430, 385],
    ] as const
  ).map(([id, x, y]) => ({ id, homeX: x, homeY: y, x, y, placed: false }));

  let dragging: { piece: Piece; offX: number; offY: number } | null = null;
  let flippedAt: number | null = null;
  let note = "";
  let noteAt = -Infinity;
  let frameId = 0;
  let audio: AudioContext | null = null;

  const plate = pieces.find((p) => p.id === "plate") as Piece;
  const lever = pieces.find((p) => p.id === "lever") as Piece;
  const screws = pieces.filter((p) => p.id === "screwA" || p.id === "screwB");
  const screwsIn = (): boolean => screws.every((s) => s.placed);

  function click(frequency: number): void {
    try {
      audio ??= new AudioContext();
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // No sound, no problem.
    }
  }

  function stepFor(): string {
    if (!plate.placed) return "Step 1: Put the plate on the wall, inside the dashed outline.";
    if (!screwsIn()) return "Step 2: Screw the plate to the wall. One screw in each hole.";
    if (!lever.placed) return "Step 3: Push the lever into the slot in the middle of the plate.";
    if (flippedAt === null) return "Step 4: Flip the switch to check that it works.";
    return "It works! The switch is built.";
  }

  function warn(text: string): void {
    note = text;
    noteAt = performance.now();
    click(140);
  }

  function toCanvas(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * W) / rect.width, y: ((event.clientY - rect.top) * H) / rect.height };
  }

  function pieceAt(p: Point): Piece | null {
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const piece = pieces[i];
      if (!piece || piece.placed) continue;
      const [hw, hh] = piece.id === "plate" ? [PLATE.w / 2, PLATE.h / 2] : piece.id === "lever" ? [16, 40] : [20, 26];
      if (Math.abs(p.x - piece.x) <= hw && Math.abs(p.y - piece.y) <= hh) return piece;
    }
    return null;
  }

  const overPlate = (p: Point): boolean => Math.abs(p.x - PLATE.x) <= PLATE.w / 2 && Math.abs(p.y - PLATE.y) <= PLATE.h / 2;

  function place(piece: Piece, at: Point): void {
    piece.x = at.x;
    piece.y = at.y;
    piece.placed = true;
    note = "";
    click(620);
  }

  function goHome(piece: Piece): void {
    piece.x = piece.homeX;
    piece.y = piece.homeY;
  }

  function drop(piece: Piece): void {
    const nearWall = piece.y < TRAY_TOP;
    if (piece.id === "plate") {
      if (Math.hypot(piece.x - PLATE.x, piece.y - PLATE.y) < 70) place(piece, PLATE);
      else goHome(piece);
      return;
    }
    if (piece.id === "lever") {
      const near = Math.hypot(piece.x - PLATE.x, piece.y - PLATE.y) < 60;
      if (near && plate.placed && screwsIn()) {
        place(piece, PLATE);
        return;
      }
      if (nearWall) {
        warn(plate.placed ? "Screw the plate on first, or it'll fall off the wall." : "The lever needs a plate to go into first.");
      }
      goHome(piece);
      return;
    }
    // A screw goes in whichever free hole it's dropped closest to.
    if (!plate.placed) {
      if (nearWall) warn("There's nothing to screw on yet. Put the plate on the wall first.");
      goHome(piece);
      return;
    }
    const free = HOLES.filter((hole) => !screws.some((s) => s.placed && s.x === hole.x && s.y === hole.y));
    const hole = free.find((h) => Math.hypot(piece.x - h.x, piece.y - h.y) < 40);
    if (hole) place(piece, hole);
    else goHome(piece);
  }

  function close(): void {
    cancelAnimationFrame(frameId);
    try {
      localStorage.setItem(BUILT_KEY, "true");
    } catch {
      // It'll ask again next time.
    }
    void audio?.close().catch(() => {});
    overlay.remove();
    onDone();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const p = toCanvas(event);
    if (flippedAt !== null) return;
    if (lever.placed && overPlate(p)) {
      flippedAt = performance.now();
      click(900);
      window.setTimeout(close, DONE_MS);
      return;
    }
    const piece = pieceAt(p);
    if (!piece) return;
    // Pick it up on top of everything else.
    pieces.splice(pieces.indexOf(piece), 1);
    pieces.push(piece);
    dragging = { piece, offX: p.x - piece.x, offY: p.y - piece.y };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    const p = toCanvas(event);
    if (dragging) {
      dragging.piece.x = Math.min(W - 20, Math.max(20, p.x - dragging.offX));
      dragging.piece.y = Math.min(H - 20, Math.max(20, p.y - dragging.offY));
      canvas.style.cursor = "grabbing";
      return;
    }
    canvas.style.cursor = flippedAt === null && ((lever.placed && overPlate(p)) || pieceAt(p)) ? "pointer" : "default";
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const { piece } = dragging;
    dragging = null;
    drop(piece);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---------- drawing ----------

  function roundRect(x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawPlate(x: number, y: number): void {
    ctx.fillStyle = "#f4f1ea";
    ctx.strokeStyle = "#8d8778";
    ctx.lineWidth = 3;
    roundRect(x - PLATE.w / 2, y - PLATE.h / 2, PLATE.w, PLATE.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3a3a3a";
    roundRect(x - 15, y - 33, 30, 66, 5);
    ctx.fill();
    for (const dy of [-54, 54]) {
      ctx.beginPath();
      ctx.arc(x, y + dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawScrew(x: number, y: number, placed: boolean): void {
    if (!placed) {
      ctx.fillStyle = "#a9a293";
      ctx.fillRect(x - 5, y + 8, 10, 30);
      ctx.strokeStyle = "#6f6a5e";
      ctx.lineWidth = 1.5;
      for (let ty = y + 12; ty < y + 38; ty += 6) {
        ctx.beginPath();
        ctx.moveTo(x - 5, ty);
        ctx.lineTo(x + 5, ty + 3);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#d8d1bf";
    ctx.strokeStyle = "#6f6a5e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.stroke();
  }

  function drawLever(x: number, y: number, now: number): void {
    ctx.fillStyle = "#f4f1ea";
    ctx.strokeStyle = "#8d8778";
    ctx.lineWidth = 3;
    if (!lever.placed) {
      roundRect(x - 13, y - 39, 27, 78, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#dcd6c6";
      roundRect(x - 13, y - 39, 27, 26, 7);
      ctx.fill();
      return;
    }
    // In the slot: down is off, up is on.
    const t = flippedAt === null ? 0 : Math.min(1, (now - flippedAt) / FLIP_MS);
    const offsetY = 14 - 28 * t;
    roundRect(x - 11, y + offsetY - 20, 22, 40, 6);
    ctx.fill();
    ctx.stroke();
  }

  function drawBulb(on: boolean, now: number): void {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BULB.x, 0);
    ctx.lineTo(BULB.x, BULB.y - 40);
    ctx.stroke();
    // The wire from the bulb runs down the wall to where the switch goes.
    ctx.strokeStyle = "rgba(80, 80, 80, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BULB.x, 0);
    ctx.lineTo(BULB.x + 40, 0);
    ctx.moveTo(BULB.x + 40, 0);
    ctx.lineTo(BULB.x + 40, PLATE.y);
    ctx.lineTo(PLATE.x + PLATE.w / 2 + 6, PLATE.y);
    ctx.stroke();

    if (on) {
      const glow = ctx.createRadialGradient(BULB.x, BULB.y, 10, BULB.x, BULB.y, 220);
      glow.addColorStop(0, `rgba(255, 236, 150, ${0.75 + 0.05 * Math.sin(now / 90)})`);
      glow.addColorStop(1, "rgba(255, 236, 150, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, TRAY_TOP);
    }
    ctx.fillStyle = "#8c8c8c";
    ctx.fillRect(BULB.x - 10, BULB.y - 42, 20, 16);
    ctx.fillStyle = on ? "#fff4a8" : "rgba(255, 255, 255, 0.55)";
    ctx.strokeStyle = on ? "#e0b940" : "#9a9a9a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(BULB.x, BULB.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function draw(now: number): void {
    const on = flippedAt !== null && now - flippedAt >= FLIP_MS;
    ctx.fillStyle = on ? "#f3ecd8" : "#d9d1bd";
    ctx.fillRect(0, 0, W, TRAY_TOP);
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let x = 0; x < W; x += 36) ctx.fillRect(x, 0, 18, TRAY_TOP);

    drawBulb(on, now);

    if (!plate.placed) {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 2;
      roundRect(PLATE.x - PLATE.w / 2, PLATE.y - PLATE.h / 2, PLATE.w, PLATE.h, 10);
      ctx.stroke();
      ctx.restore();
    }

    // The shelf the pieces start on
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(0, TRAY_TOP, W, H - TRAY_TOP);
    ctx.fillStyle = "#8a5f36";
    ctx.fillRect(0, TRAY_TOP, W, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Your switch pieces", 520, 385);

    if (plate.placed) drawPlate(plate.x, plate.y);
    for (const screw of screws) if (screw.placed) drawScrew(screw.x, screw.y, true);
    if (lever.placed) drawLever(lever.x, lever.y, now);
    for (const piece of pieces) {
      if (piece.placed) continue;
      if (piece.id === "plate") drawPlate(piece.x, piece.y);
      else if (piece.id === "lever") drawLever(piece.x, piece.y, now);
      else drawScrew(piece.x, piece.y, false);
    }
  }

  function frame(now: number): void {
    const text = note && now - noteAt < NOTE_MS ? note : stepFor();
    if (stepText.textContent !== text) stepText.textContent = text;
    stepText.classList.toggle("is-warning", text === note);
    draw(now);
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
}
