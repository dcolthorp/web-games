import { playSound } from "./sounds";
import { formatMoney, save, state } from "./state";

// The go-kart race: click a go-kart and you're at the track. Three laps
// against three other karts, seen from above. Arrow keys (or WASD) drive, or
// hold the mouse down and your kart heads for the pointer. Grass is slow!
// Prize money goes into your city money (state.ts); first place also gets a
// gold trophy for your shelf.

const W = 900;
const H = 520;
const LAPS = 3;
const POINTS = 240;
const HALF_WIDTH = 46;
const PRIZES = [500_000, 200_000, 100_000, 25_000];
const PLACES = ["1st", "2nd", "3rd", "4th"];

interface Kart {
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  top: number; // fastest it goes (for the other drivers)
  index: number; // nearest point along the track
  laps: number;
  halfway: boolean; // been round the far side since the last lap (no shortcuts!)
  finished: number | null; // when it crossed the line for the last time
  you: boolean;
}

// The middle of the track: a loop with a few wiggles in it.
const track: [number, number][] = Array.from({ length: POINTS }, (_, i) => {
  const t = (i / POINTS) * Math.PI * 2;
  return [450 + 340 * Math.cos(t) + 30 * Math.cos(3 * t), 265 + 185 * Math.sin(t) + 35 * Math.sin(2 * t)];
});

const host = document.createElement("section");
host.className = "race";
host.hidden = true;
host.setAttribute("aria-label", "Go-kart race");
host.innerHTML = `
  <div class="race-card">
    <h2>Go-Kart Race</h2>
    <canvas width="${W}" height="${H}" aria-label="A go-kart race track seen from above"></canvas>
    <p class="race-message" aria-live="polite"></p>
    <div class="race-controls">
      <button class="pill pill-main race-start" type="button">Start the race!</button>
      <button class="pill race-close" type="button">Back to the boxes</button>
    </div>
  </div>`;
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const messageEl = host.querySelector<HTMLElement>(".race-message")!;
const startButton = host.querySelector<HTMLButtonElement>(".race-start")!;
host.querySelector(".race-close")!.addEventListener("click", closeRace);
startButton.addEventListener("click", startRace);

let karts: Kart[] = [];
let yourColor = "#ff9226";
let hooks: { addToShelf: (thing: string) => void } = { addToShelf: () => {} };
let running = false;
let goAt = 0; // when the countdown says GO
let racing = false;
let beeps = 0;
let last = 0;
const keys = new Set<string>();
let pointer: { x: number; y: number } | null = null;

function say(text: string): void {
  messageEl.textContent = text;
}

function setup(): void {
  const drivers = [
    { name: "You", color: yourColor, top: 290, you: true },
    { name: "Zoomy", color: "#4a9bff", top: 250, you: false },
    { name: "Turbo Tina", color: "#ff6fb5", top: 262, you: false },
    { name: "Slow Steve", color: "#4cc76a", top: 238, you: false },
  ];
  const [sx, sy] = track[0]!;
  const [nx, ny] = track[2]!;
  const angle = Math.atan2(ny - sy, nx - sx);
  karts = drivers.map((d, i) => ({
    ...d,
    // Start in a little grid behind the line.
    x: sx - Math.cos(angle) * (24 + Math.floor(i / 2) * 44) + Math.cos(angle + Math.PI / 2) * (i % 2 ? 18 : -18),
    y: sy - Math.sin(angle) * (24 + Math.floor(i / 2) * 44) + Math.sin(angle + Math.PI / 2) * (i % 2 ? 18 : -18),
    angle,
    speed: 0,
    index: POINTS - 1 - Math.floor(i / 2) * 3,
    laps: -1,
    halfway: true,
    finished: null,
  }));
}

function startRace(): void {
  setup();
  goAt = performance.now() + 3000;
  racing = true;
  beeps = 0;
  startButton.disabled = true;
  say("Get ready...");
  canvas.focus();
}

/** Nearest point on the track to the kart: near where it was, or anywhere if it's wandered off. */
function nearest(k: Kart): { index: number; dist: number } {
  const close = search(k, 20);
  return close.dist < HALF_WIDTH * 2 ? close : search(k, POINTS / 2);
}

function search(k: Kart, around: number): { index: number; dist: number } {
  let best = k.index;
  let bestD = Infinity;
  for (let d = -around; d <= around; d++) {
    const i = (k.index + d + POINTS) % POINTS;
    const [tx, ty] = track[i]!;
    const dist = Math.hypot(tx - k.x, ty - k.y);
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  }
  return { index: best, dist: bestD };
}

const progress = (k: Kart): number => k.laps * POINTS + k.index;

function update(now: number, dt: number): void {
  if (!racing) return;
  if (now < goAt) {
    const n = Math.ceil((goAt - now) / 1000);
    if (beeps < 4 - n) {
      beeps = 4 - n;
      playSound("beep");
    }
    return;
  }
  if (beeps < 4) {
    beeps = 4;
    playSound("vroom");
    say("GO GO GO!");
  }
  for (const k of karts) {
    const { index, dist } = nearest(k);
    const onRoad = dist < HALF_WIDTH;
    let gas = 0;
    let steer = 0;
    if (k.finished !== null) {
      gas = -0.5;
    } else if (k.you) {
      const up = keys.has("ArrowUp") || keys.has("w");
      const down = keys.has("ArrowDown") || keys.has("s");
      gas = up ? 1 : down ? -1 : 0;
      steer = (keys.has("ArrowLeft") || keys.has("a") ? -1 : 0) + (keys.has("ArrowRight") || keys.has("d") ? 1 : 0);
      if (pointer) {
        // Holding the mouse down: drive toward it.
        gas = 1;
        const want = Math.atan2(pointer.y - k.y, pointer.x - k.x);
        const diff = Math.atan2(Math.sin(want - k.angle), Math.cos(want - k.angle));
        steer = Math.max(-1, Math.min(1, diff * 3));
      }
    } else {
      // The other drivers aim a little way down the track (or straight back
      // to it if they've gone off), and ease off the gas for sharp turns.
      const [tx, ty] = track[(index + (onRoad ? 7 : 1)) % POINTS]!;
      const want = Math.atan2(ty - k.y, tx - k.x);
      const diff = Math.atan2(Math.sin(want - k.angle), Math.cos(want - k.angle));
      steer = Math.max(-1, Math.min(1, diff * 4));
      gas = Math.abs(diff) > 0.5 && k.speed > 150 ? -0.4 : 1;
    }
    const top = (onRoad ? k.top : 110) * (k.you ? 1 : 0.95 + Math.sin(now / 1700 + k.top) * 0.05);
    k.speed += gas * 320 * dt;
    k.speed -= k.speed * (onRoad ? 0.6 : 2.2) * dt;
    k.speed = Math.max(-80, Math.min(top, k.speed));
    const turn = k.you ? 2.8 : 3.6;
    k.angle += steer * turn * dt * Math.min(1, Math.abs(k.speed) / 120) * Math.sign(k.speed || 1);
    k.x = Math.max(10, Math.min(W - 10, k.x + Math.cos(k.angle) * k.speed * dt));
    k.y = Math.max(10, Math.min(H - 10, k.y + Math.sin(k.angle) * k.speed * dt));

    // Laps: crossing the start line forwards counts, but only after going
    // round the far side of the track, so cutting across the grass doesn't.
    const before = k.index;
    k.index = index;
    if (index > POINTS * 0.4 && index < POINTS * 0.6) k.halfway = true;
    if (before > POINTS * 0.85 && index < POINTS * 0.15 && k.halfway) {
      k.laps++;
      k.halfway = false;
    }
    if (k.laps >= LAPS && k.finished === null) {
      k.finished = now;
      if (k.you) finish();
    }
  }
  // Karts bump each other apart instead of driving through.
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i]!;
      const b = karts[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && d < 26) {
        const push = (26 - d) / 2;
        a.x += ((a.x - b.x) / d) * push;
        a.y += ((a.y - b.y) / d) * push;
        b.x -= ((a.x - b.x) / d) * push;
        b.y -= ((a.y - b.y) / d) * push;
      }
    }
  }
}

function place(k: Kart): number {
  // Finished karts by finish time, then everyone else by how far along they are.
  const order = [...karts].sort((a, b) => {
    if (a.finished !== null && b.finished !== null) return a.finished - b.finished;
    if (a.finished !== null) return -1;
    if (b.finished !== null) return 1;
    return progress(b) - progress(a);
  });
  return order.indexOf(k);
}

function finish(): void {
  const you = karts.find((k) => k.you)!;
  const p = place(you);
  const prize = PRIZES[p]!;
  state.money += prize;
  save();
  playSound(p === 0 ? "levelup" : "bell");
  if (p === 0) hooks.addToShelf("gold trophy");
  say(
    `You came in ${PLACES[p]}! You won ${formatMoney(prize)}!` +
      (p === 0 ? " And a gold trophy for your shelf!" : " Race again to try for 1st!"),
  );
  startButton.disabled = false;
  startButton.textContent = "Race again!";
}

function draw(now: number): void {
  ctx.fillStyle = "#6fc45a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#62b54e";
  for (let i = 0; i < 80; i++) ctx.fillRect((i * 137) % W, (i * 83) % H, 6, 3);

  // The road: a white edge, then grey on top.
  const path = (): void => {
    ctx.beginPath();
    track.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = HALF_WIDTH * 2 + 8;
  path();
  ctx.stroke();
  ctx.strokeStyle = "#5d626c";
  ctx.lineWidth = HALF_WIDTH * 2;
  path();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 18]);
  path();
  ctx.stroke();
  ctx.setLineDash([]);

  // The checkered start line.
  const [sx, sy] = track[0]!;
  const [nx, ny] = track[1]!;
  const a = Math.atan2(ny - sy, nx - sx) + Math.PI / 2;
  for (let i = -5; i < 5; i++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (i + row) % 2 ? "#ffffff" : "#24222b";
      const cx = sx + Math.cos(a) * (i * 9.2 + 4.6) + Math.cos(a - Math.PI / 2) * (row * 9 - 4.5);
      const cy = sy + Math.sin(a) * (i * 9.2 + 4.6) + Math.sin(a - Math.PI / 2) * (row * 9 - 4.5);
      ctx.fillRect(cx - 4.6, cy - 4.5, 9.2, 9);
    }
  }

  for (const k of karts) drawKart(k);

  // Lap counter and place.
  const you = karts.find((k) => k.you);
  if (you && racing) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.roundRect(12, 12, 200, 56, 12);
    ctx.fill();
    ctx.fillStyle = "#4a1f6e";
    ctx.font = '800 18px "Trebuchet MS", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`Lap ${Math.min(LAPS, Math.max(1, you.laps + 1))}/${LAPS}`, 24, 30);
    ctx.fillText(`Place: ${PLACES[place(you)]}`, 24, 52);
  }
  if (racing && now < goAt + 700) {
    const n = Math.ceil((goAt - now) / 1000);
    ctx.font = '900 120px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = n > 0 ? "#ffffff" : "#ffe36e";
    ctx.strokeStyle = "#4a1f6e";
    ctx.lineWidth = 8;
    const text = n > 0 ? String(n) : "GO!";
    ctx.strokeText(text, W / 2, H / 2);
    ctx.fillText(text, W / 2, H / 2);
  }
}

function drawKart(k: Kart): void {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.rotate(k.angle);
  ctx.fillStyle = "#24222b";
  for (const [wx, wy] of [[-9, -11], [9, -11], [-9, 11], [9, 11]] as const) ctx.fillRect(wx - 4, wy - 3, 8, 6);
  ctx.fillStyle = k.color;
  ctx.beginPath();
  ctx.roundRect(-14, -9, 28, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#f2c7a5";
  ctx.beginPath();
  ctx.arc(-2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (k.you) {
    // An arrow over your kart so you can always find it.
    ctx.fillStyle = "#ffe36e";
    ctx.strokeStyle = "#4a1f6e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(k.x - 8, k.y - 30);
    ctx.lineTo(k.x + 8, k.y - 30);
    ctx.lineTo(k.x, k.y - 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function loop(now: number): void {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(now, dt);
  draw(now);
  requestAnimationFrame(loop);
}

const toCanvas = (e: PointerEvent): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
};
canvas.addEventListener("pointerdown", (e) => {
  pointer = toCanvas(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (pointer) pointer = toCanvas(e);
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => (pointer = null));

const DRIVE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"];
window.addEventListener("keydown", (e) => {
  if (host.hidden) return;
  if (e.key === "Escape") return closeRace();
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DRIVE_KEYS.includes(key)) {
    e.preventDefault();
    keys.add(key);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener("blur", () => keys.clear());

/** Opens the race track. `color` is the colour of the go-kart you clicked. */
export function openRace(color: string, roomHooks: { addToShelf: (thing: string) => void }): void {
  yourColor = color;
  hooks = roomHooks;
  racing = false;
  setup();
  startButton.disabled = false;
  startButton.textContent = "Start the race!";
  say("Arrow keys (or W A S D) to drive, or hold the mouse down and your kart goes toward it. 3 laps. Stay off the grass!");
  host.hidden = false;
  startButton.focus();
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}

function closeRace(): void {
  host.hidden = true;
  running = false;
  racing = false;
  keys.clear();
  pointer = null;
}
