import { dollhouseHalfWidth, dollhouseParts, FLOOR_H, makeModels } from "./models";
import { buildModel, drawModel, projectPoint, type Built } from "./render3d";
import { state } from "./state";

// Penelope's dollhouse: click a house and it opens up big, with dolls
// standing on both sides. Drag the dolls in and around. As soon as a doll is
// inside (or one is being dragged over the house), the front wall with the
// door disappears so you can see in. Buy more floors at the Dollhouse
// Builder in the city and it grows taller (see city.ts).

const W = 900;
const H = 600;
const HOUSE_X = W / 2;
const GROUND_Y = 520;
let houseY = 250;
let houseSize = 270;
let floorCount = 2;
const YAW = 0;
const PITCH = -0.15;
const DOLL_YAW = Math.PI / 2 - 0.3;
const DOLLS_KEY = "things-i-love-dolls";
const DOLL_COLORS = ["pink", "blue", "purple", "green", "yellow", "red"];

interface Doll {
  img: HTMLCanvasElement;
  w: number; // how big it is on screen, for grabbing
  h: number;
  lift: number; // from its feet up to the middle of its picture
  x: number; // where its feet are
  y: number;
}

const host = document.createElement("section");
host.className = "dollhouse";
host.hidden = true;
host.setAttribute("aria-label", "Dollhouse");
host.innerHTML = `
  <div class="dollhouse-card">
    <h2>Dollhouse</h2>
    <canvas width="${W}" height="${H}" aria-label="A dollhouse with dolls to drag around"></canvas>
    <p class="dollhouse-help">Drag the dolls into the house! Put them on any floor.</p>
    <button class="pill pill-main" type="button">Close the dollhouse</button>
  </div>`;
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
host.querySelector("button")!.addEventListener("click", closeDollhouse);
host.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDollhouse();
});

let closedHouse: HTMLCanvasElement | null = null;
let openHouse: HTMLCanvasElement | null = null;
let houseModel: Built | null = null;
let dolls: Doll[] = [];
let drag: { doll: Doll; dx: number; dy: number } | null = null;
let running = false;

const at = (x: number, y: number, z: number): [number, number] =>
  projectPoint(houseModel!, [x, y, z], HOUSE_X, houseY, houseSize, YAW, PITCH);

/** The floors the dolls can stand on, as heights on screen (ground first), and the inside walls. */
function floors(): { levels: number[]; ground: number; top: number; left: number; right: number } {
  const hw = dollhouseHalfWidth(floorCount) - 0.1;
  const levels = Array.from({ length: floorCount }, (_, i) => at(0, i * FLOOR_H + (i ? 0.025 : 0), 0)[1]);
  return {
    levels,
    ground: levels[0]!,
    top: at(0, floorCount * FLOOR_H, 0)[1],
    left: at(-hw, 0, 0)[0],
    right: at(hw, 0, 0)[0],
  };
}

function isInside(doll: Doll): boolean {
  const f = floors();
  return doll.x > f.left && doll.x < f.right && doll.y > f.top + doll.h * 0.3 && doll.y < f.ground + 30;
}

function snapshot(model: Built): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  drawModel(c.getContext("2d")!, model, HOUSE_X, houseY, houseSize, YAW, PITCH);
  return c;
}

function makeDolls(): void {
  const house = houseModel!;
  const pxPerUnit = houseSize / house.radius;
  const f = floors();
  let saved: { x: number; y: number }[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(DOLLS_KEY) ?? "[]");
    if (Array.isArray(raw)) saved = raw;
  } catch {
    // Fine: the dolls start on the sides.
  }
  const startX = [70, 150, 230, W - 230, W - 150, W - 70];
  dolls = DOLL_COLORS.map((color, i) => {
    const model = buildModel(makeModels(`${color} doll`)[0]!.parts);
    const tall = model.hi[1] - model.lo[1];
    const h = 0.62 * pxPerUnit;
    const size = (h * model.radius) / tall;
    const img = document.createElement("canvas");
    img.width = img.height = Math.ceil(size * 3);
    drawModel(img.getContext("2d")!, model, img.width / 2, img.height / 2, size, DOLL_YAW, 0);
    const lift = ((model.mid[1] - model.lo[1]) / model.radius) * size;
    const spot = saved[i];
    return {
      img,
      w: h * 0.45,
      h,
      lift,
      x: typeof spot?.x === "number" ? spot.x : startX[i]!,
      y: typeof spot?.y === "number" ? spot.y : f.ground,
    };
  });
  // The house may have grown since last time, so put everyone back on a floor.
  for (const doll of dolls) settle(doll);
}

function saveDolls(): void {
  localStorage.setItem(DOLLS_KEY, JSON.stringify(dolls.map((d) => ({ x: Math.round(d.x), y: Math.round(d.y) }))));
}

/** Drops a doll onto the closest floor: upstairs or downstairs inside, or the grass outside. */
function settle(doll: Doll): void {
  const f = floors();
  if (isInside(doll)) {
    doll.y = f.levels.reduce((best, y) => (Math.abs(doll.y - y) < Math.abs(doll.y - best) ? y : best), f.ground);
    doll.x = Math.max(f.left + doll.w / 2, Math.min(f.right - doll.w / 2, doll.x));
  } else {
    doll.y = f.ground;
    doll.x = Math.max(doll.w / 2, Math.min(W - doll.w / 2, doll.x));
  }
}

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e);
  // The front-most doll under the pointer.
  const doll = [...dolls]
    .reverse()
    .find((d) => Math.abs(p.x - d.x) < d.w / 2 + 6 && p.y < d.y + 6 && p.y > d.y - d.h - 6);
  if (!doll) return;
  dolls.splice(dolls.indexOf(doll), 1);
  dolls.push(doll);
  drag = { doll, dx: doll.x - p.x, dy: doll.y - p.y };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("pointermove", (e) => {
  const p = toCanvas(e);
  if (drag) {
    drag.doll.x = p.x + drag.dx;
    drag.doll.y = p.y + drag.dy;
    return;
  }
  const over = dolls.some((d) => Math.abs(p.x - d.x) < d.w / 2 + 6 && p.y < d.y + 6 && p.y > d.y - d.h - 6);
  canvas.style.cursor = over ? "grab" : "default";
});

canvas.addEventListener("pointerup", () => {
  if (!drag) return;
  settle(drag.doll);
  drag = null;
  canvas.style.cursor = "grab";
  saveDolls();
});

function draw(): void {
  const f = floors();
  // Sky-ish wall and a grassy floor.
  ctx.fillStyle = "#fbefff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#bfe8a8";
  ctx.fillRect(0, f.ground, W, H - f.ground);
  ctx.fillStyle = "#a4dc8a";
  ctx.fillRect(0, f.ground, W, 8);

  const anyoneHome = dolls.some((d) => isInside(d) && d !== drag?.doll) || (!!drag && isInside(drag.doll));
  ctx.drawImage(anyoneHome ? openHouse! : closedHouse!, 0, 0);

  const order = dolls.filter((d) => d !== drag?.doll).sort((a, b) => a.y - b.y);
  if (drag) order.push(drag.doll);
  for (const d of order) {
    const lifted = d === drag?.doll ? 8 : 0;
    ctx.fillStyle = "rgba(60, 40, 80, 0.2)";
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, d.w * 0.55, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(d.img, d.x - d.img.width / 2, d.y - d.lift - lifted - d.img.height / 2);
  }
}

function loop(): void {
  if (!running) return;
  draw();
  requestAnimationFrame(loop);
}

/** Opens the dollhouse. `roof` is the colour of the house that was clicked. */
export function openDollhouse(roof: string): void {
  floorCount = state.floors;
  const closed = buildModel(dollhouseParts(roof, false, floorCount));
  houseModel = closed;
  // Size the house to fill the picture, with its ground on the grass line.
  houseSize = 270 * Math.min(1, 1.9 / closed.radius) * (floorCount > 2 ? 1.15 : 1);
  houseY = 0;
  houseY = GROUND_Y - at(0, 0, 0)[1];
  closedHouse = snapshot(closed);
  openHouse = snapshot(buildModel(dollhouseParts(roof, true, floorCount), closed));
  makeDolls();
  host.hidden = false;
  host.querySelector("button")!.focus();
  if (!running) {
    running = true;
    loop();
  }
}

function closeDollhouse(): void {
  host.hidden = true;
  running = false;
  drag = null;
}
