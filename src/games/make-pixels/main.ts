// Make Pictures (it started out as Make Pixels): Penelope's pixel game.
// There's no winning. Click the black arrow on the side and a white chunk of
// canvas opens up, with a color wheel next to it; click it again and the
// brushes come out. You start with black. Pick any color (and how see-through
// it is), or grab one off the picture with the eyedropper, then put down
// pixels, draw straight lines, or fill in a space, with a bigger brush if you
// want. The canvas can be small or big, and the pixels can be smaller for
// more detail. Pictures save in this browser, with names.

export {};

const SAVE_KEY = "make-pixels";
const WHITE = "#ffffff";
const GRID_SIZES = [16, 24, 32, 48, 64];
const START_SIZE = 24;

const room = document.getElementById("room")!;
const arrow = document.getElementById("arrow") as HTMLButtonElement;
const chunk = document.getElementById("chunk")!;
const brushes = document.getElementById("brushes")!;
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const wheel = document.getElementById("wheel") as HTMLCanvasElement;
const brightInput = document.getElementById("bright") as HTMLInputElement;
const alphaInput = document.getElementById("alpha") as HTMLInputElement;
const alphaValue = document.getElementById("alpha-value")!;
const nowSwatch = document.getElementById("now")!;
const recentEl = document.getElementById("recent")!;
const gridSizesEl = document.getElementById("grid-sizes")!;
const pixelSizesEl = document.getElementById("pixel-sizes")!;
const undoButton = document.getElementById("undo") as HTMLButtonElement;
const freshButton = document.getElementById("fresh") as HTMLButtonElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const nameRow = document.getElementById("name-row") as HTMLFormElement;
const nameInput = document.getElementById("name") as HTMLInputElement;
const gallery = document.getElementById("gallery")!;
const picturesEl = document.getElementById("pictures")!;

// Pictures saved with a name, newest first. The canvas itself also saves
// all the time (SAVE_KEY), named or not.
const PICTURES_KEY = "make-pixels-pictures";
const CURRENT_KEY = "make-pixels-current";

// A picture's squares, row by row. "scale" is the pixel size: 1 is a normal
// pixel, 0.5 is half as big (so twice as many squares each way, for more
// detail). Pictures from before these were a thing are 24 × 24 normal pixels.
interface Art {
  size: number;
  pixels: string[];
  scale?: number;
}

interface Picture {
  id: string;
  name: string;
  pixels: string[];
  size?: number;
  scale?: number;
}

// Canvas sizes, in normal pixels across, and the pixel sizes.
const CANVAS_SIZES = [16, 24, 32, 48];
const PIXEL_SIZES = [1, 0.5, 0.25];

const toolButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-tool]")];

const sizeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-size]")];

type Tool = "pixel" | "fill" | "line" | "picker";

let tool: Tool = "pixel";
// What to go back to after picking a color.
let lastTool: Tool = "pixel";
// How many squares wide the pixel tool and lines are.
let brush = 1;
const start = load();
let size = start.size;
let pixels = start.pixels;
let scale = start.scale ?? 1;
// How many screen pixels wide a normal pixel is, so the canvas fits.
let zoom = 0;
const history: Art[] = [];
let pictures: Picture[] = loadPictures();
// Which saved picture is on the canvas, so saving again updates it.
let currentId: string | null = readCurrent();

function blank(n: number): string[] {
  return Array(n * n).fill(WHITE);
}

// The canvas size in normal pixels (squares across × pixel size).
function canvasSize(): number {
  return Math.round(size * scale);
}

function load(): Art {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (Array.isArray(parsed) && parsed.length === START_SIZE * START_SIZE) return { size: START_SIZE, pixels: parsed };
    if (parsed && Array.isArray(parsed.pixels) && parsed.pixels.length === parsed.size * parsed.size) return parsed;
  } catch {
    // Start with a fresh canvas.
  }
  return { size: START_SIZE, pixels: blank(START_SIZE) };
}

function snapshot(): Art {
  return { size, pixels: [...pixels], scale };
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot()));
  } catch {
    // Nowhere to save.
  }
}

function loadPictures(): Picture[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PICTURES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readCurrent(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY);
  } catch {
    return null;
  }
}

function savePictures(): void {
  try {
    localStorage.setItem(PICTURES_KEY, JSON.stringify(pictures));
    if (currentId) localStorage.setItem(CURRENT_KEY, currentId);
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // Nowhere to save.
  }
}

function draw(): void {
  const c = zoom * scale;
  for (let i = 0; i < pixels.length; i += 1) {
    ctx.fillStyle = pixels[i]!;
    ctx.fillRect((i % size) * c, Math.floor(i / size) * c, c, c);
  }
  // Faint lines so you can see each square (unless they're too tiny).
  if (c >= 6) {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * c + 0.5, 0);
      ctx.lineTo(i * c + 0.5, canvas.height);
      ctx.moveTo(0, i * c + 0.5);
      ctx.lineTo(canvas.width, i * c + 0.5);
      ctx.stroke();
    }
  }
  undoButton.disabled = history.length === 0;
}

// How big a normal pixel is on screen so the whole canvas fits. It's a
// multiple of 4, so quarter pixels are whole screen pixels too.
function fitZoom(): number {
  const space = Math.min(window.innerWidth - 480, window.innerHeight - 260, 600);
  return Math.max(8, Math.min(40, Math.floor(space / canvasSize() / 4) * 4));
}

function sizeCanvas(): void {
  zoom = fitZoom();
  canvas.width = zoom * canvasSize();
  canvas.height = zoom * canvasSize();
  draw();
}

function renderGridSizes(): void {
  gridSizesEl.innerHTML = CANVAS_SIZES.map(
    (n) => `<button type="button" class="grid-size ${n === canvasSize() ? "on" : ""}" data-grid="${n}">${n}×${n}</button>`
  ).join("");
  pixelSizesEl.innerHTML = PIXEL_SIZES.map(
    (n) => `<button type="button" class="grid-size ${n === scale ? "on" : ""}" data-scale="${n}">${n === 1 ? "1 (normal)" : n}</button>`
  ).join("");
}

// Making the canvas bigger adds white squares on the right and bottom;
// making it smaller cuts off the right and bottom.
function resizeArt(art: Art, n: number): string[] {
  const next = blank(n);
  for (let y = 0; y < Math.min(n, art.size); y += 1) {
    for (let x = 0; x < Math.min(n, art.size); x += 1) next[y * n + x] = art.pixels[y * art.size + x]!;
  }
  return next;
}

// Same picture, different pixel size: smaller pixels split each square into
// a few; bigger pixels keep one square out of each group.
function rescaleArt(art: Art, n: number): string[] {
  const next = blank(n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      next[y * n + x] = art.pixels[Math.floor((y * art.size) / n) * art.size + Math.floor((x * art.size) / n)]!;
    }
  }
  return next;
}

gridSizesEl.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-grid]");
  if (!button) return;
  const units = Number(button.dataset["grid"]);
  if (units === canvasSize()) return;
  if (units < canvasSize() && !confirm("Make the canvas smaller? Anything past the new edge gets cut off. (Undo brings it back.)")) return;
  history.push(snapshot());
  const n = Math.round(units / scale);
  pixels = resizeArt(snapshot(), n);
  size = n;
  save();
  renderGridSizes();
  sizeCanvas();
});

pixelSizesEl.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-scale]");
  if (!button) return;
  const next = Number(button.dataset["scale"]);
  if (next === scale) return;
  if (next > scale && !confirm("Make the pixels bigger? Tiny details get lost. (Undo brings them back.)")) return;
  history.push(snapshot());
  const n = Math.round(canvasSize() / next);
  pixels = rescaleArt(snapshot(), n);
  size = n;
  scale = next;
  save();
  renderGridSizes();
  sizeCanvas();
});

// The first click on the arrow opens the canvas. After that, it pulls the
// brushes out (and puts them away again).
arrow.addEventListener("click", () => {
  if (chunk.hidden) {
    chunk.hidden = false;
    sizeCanvas();
  } else {
    brushes.hidden = !brushes.hidden;
  }
  room.classList.toggle("open", !brushes.hidden);
  arrow.setAttribute("aria-expanded", String(!brushes.hidden));
  arrow.setAttribute("aria-label", brushes.hidden ? "Show the brushes" : "Hide the brushes");
});

// --- Colors ----------------------------------------------------------------
//
// The wheel picks the color (around the wheel) and how strong it is (out from
// the middle). Brightness makes it darker or lighter, and opacity makes it
// see-through, so it mixes with what's already there, like a red tint.

let hue = 0;
let sat = 0;
let bright = 0;
let alpha = 1;
const recent: string[] = [];

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function fromHex(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function currentColor(): string {
  return toHex(hsvToRgb(hue, sat, bright));
}

// What a square turns into when the color goes on top of it.
function mix(under: string): string {
  if (alpha >= 1) return currentColor();
  const top = hsvToRgb(hue, sat, bright);
  const bottom = fromHex(under);
  return toHex([0, 1, 2].map((i) => Math.round(bottom[i]! + (top[i]! - bottom[i]!) * alpha)) as [number, number, number]);
}

function drawWheel(): void {
  const w = wheel.getContext("2d")!;
  const r = wheel.width / 2;
  const image = w.createImageData(wheel.width, wheel.height);
  for (let y = 0; y < wheel.height; y += 1) {
    for (let x = 0; x < wheel.width; x += 1) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const dist = Math.hypot(dx, dy) / r;
      if (dist > 1) continue;
      // Always drawn bright, so you can see every color even while painting
      // with black.
      const [cr, cg, cb] = hsvToRgb((Math.atan2(dy, dx) * 180) / Math.PI + 180, dist, 1);
      const i = (y * wheel.width + x) * 4;
      image.data[i] = cr;
      image.data[i + 1] = cg;
      image.data[i + 2] = cb;
      image.data[i + 3] = 255;
    }
  }
  w.putImageData(image, 0, 0);
  // A ring shows where the color is on the wheel.
  const angle = ((hue - 180) * Math.PI) / 180;
  w.beginPath();
  w.arc(r + Math.cos(angle) * sat * r, r + Math.sin(angle) * sat * r, 7, 0, Math.PI * 2);
  w.lineWidth = 3;
  w.strokeStyle = "#fff";
  w.stroke();
  w.lineWidth = 1.5;
  w.strokeStyle = "#111";
  w.stroke();
}

function showColor(): void {
  const hex = currentColor();
  const [r, g, b] = fromHex(hex);
  nowSwatch.style.background = `rgba(${r},${g},${b},${alpha})`;
  brightInput.value = String(Math.round(bright * 100));
  brightInput.style.setProperty("--top", toHex(hsvToRgb(hue, sat, 1)));
  alphaInput.value = String(Math.round(alpha * 100));
  alphaValue.textContent = `${Math.round(alpha * 100)}%`;
  drawWheel();
}

function renderRecent(): void {
  recentEl.innerHTML = recent
    .map((c) => `<button type="button" class="recent-color" style="background:${c}" data-recent="${c}" aria-label="Use ${c} again"></button>`)
    .join("");
}

// Remembers the colors you actually paint with, newest first.
function used(): void {
  const hex = currentColor();
  const at = recent.indexOf(hex);
  if (at === 0) return;
  if (at > 0) recent.splice(at, 1);
  recent.unshift(hex);
  recent.length = Math.min(recent.length, 12);
  renderRecent();
}

function pickFromWheel(e: PointerEvent): void {
  const rect = wheel.getBoundingClientRect();
  const r = rect.width / 2;
  const dx = e.clientX - rect.left - r;
  const dy = e.clientY - rect.top - r;
  hue = (Math.atan2(dy, dx) * 180) / Math.PI + 180;
  sat = Math.min(1, Math.hypot(dx, dy) / r);
  // Picking from the wheel while the color is black would still be black.
  if (bright < 0.15) bright = 1;
  showColor();
}

let pickingColor = false;
wheel.addEventListener("pointerdown", (e) => {
  pickingColor = true;
  pickFromWheel(e);
  wheel.setPointerCapture(e.pointerId);
});
wheel.addEventListener("pointermove", (e) => {
  if (pickingColor) pickFromWheel(e);
});
wheel.addEventListener("pointerup", () => (pickingColor = false));

brightInput.addEventListener("input", () => {
  bright = Number(brightInput.value) / 100;
  showColor();
});

alphaInput.addEventListener("input", () => {
  alpha = Number(alphaInput.value) / 100;
  showColor();
});

recentEl.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-recent]");
  if (!button) return;
  [hue, sat, bright] = rgbToHsv(...fromHex(button.dataset["recent"]!));
  showColor();
});

// --- Painting --------------------------------------------------------------

function squareAt(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * size);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * size);
  return { x: Math.max(0, Math.min(size - 1, x)), y: Math.max(0, Math.min(size - 1, y)) };
}

// Puts down one brush-sized block of squares, centered on (x, y). The color
// mixes with what was there before the stroke started, so going over the same
// square twice in one stroke doesn't make it darker.
function stamp(target: string[], under: string[], x: number, y: number): void {
  const from = -Math.floor((brush - 1) / 2);
  for (let dy = from; dy < from + brush; dy += 1) {
    for (let dx = from; dx < from + brush; dx += 1) {
      const px = x + dx;
      const py = y + dy;
      if (px >= 0 && py >= 0 && px < size && py < size) target[py * size + px] = mix(under[py * size + px]!);
    }
  }
}

// Every square on the way from one spot to another.
function line(target: string[], under: string[], a: { x: number; y: number }, b: { x: number; y: number }): void {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    stamp(target, under, Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t));
  }
}

// Pixel: click (or drag) to put down squares. Line: press where it starts,
// drag to where it ends, and let go. Fill: click a space.
let stroke: { from: { x: number; y: number }; last: { x: number; y: number }; before: string[] } | null = null;

canvas.addEventListener("pointerdown", (e) => {
  const at = squareAt(e);
  if (tool === "picker") {
    // The eyedropper: take the color of the square you clicked, then go
    // back to the brush you had.
    [hue, sat, bright] = rgbToHsv(...fromHex(pixels[at.y * size + at.x]!));
    showColor();
    used();
    chooseTool(lastTool);
    return;
  }
  const before = [...pixels];
  used();
  if (tool === "fill") {
    const start = at.y * size + at.x;
    if (pixels[start] === mix(pixels[start]!) && alpha >= 1) return;
    history.push({ size, pixels: before });
    fill(start);
    save();
    draw();
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  stroke = { from: at, last: at, before };
  line(pixels, before, at, at);
  draw();
});

canvas.addEventListener("pointermove", (e) => {
  if (!stroke) return;
  const at = squareAt(e);
  if (at.x === stroke.last.x && at.y === stroke.last.y) return;
  if (tool === "pixel") line(pixels, stroke.before, stroke.last, at);
  else {
    // Show the line where it would go, starting over from before it.
    pixels = [...stroke.before];
    line(pixels, stroke.before, stroke.from, at);
  }
  stroke.last = at;
  draw();
});

function endStroke(): void {
  if (!stroke) return;
  if (pixels.some((p, i) => p !== stroke!.before[i])) {
    history.push({ size, pixels: stroke.before });
    save();
  }
  stroke = null;
  draw();
}

canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

// The fill bucket: every touching square that's the same color as the one
// you clicked gets the new color.
function fill(start: number): void {
  const from = pixels[start];
  const done = new Set<number>();
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (done.has(i) || pixels[i] !== from) continue;
    done.add(i);
    const x = i % size;
    if (x > 0) stack.push(i - 1);
    if (x < size - 1) stack.push(i + 1);
    if (i >= size) stack.push(i - size);
    if (i < size * (size - 1)) stack.push(i + size);
  }
  for (const i of done) pixels[i] = mix(pixels[i]!);
}

function chooseTool(next: Tool): void {
  if (next !== "picker") lastTool = next;
  tool = next;
  for (const b of toolButtons) b.classList.toggle("on", b.dataset["tool"] === next);
  canvas.classList.toggle("filling", tool === "fill");
  canvas.classList.toggle("picking", tool === "picker");
}

for (const button of toolButtons) {
  button.addEventListener("click", () => chooseTool(button.dataset["tool"] as Tool));
}

for (const button of sizeButtons) {
  button.addEventListener("click", () => {
    brush = Number(button.dataset["size"]);
    for (const b of sizeButtons) b.classList.toggle("on", b === button);
  });
}

function setArt(art: Art): void {
  const changed = art.size !== size || (art.scale ?? 1) !== scale;
  size = art.size;
  scale = art.scale ?? 1;
  pixels = [...art.pixels];
  if (changed) {
    renderGridSizes();
    sizeCanvas();
  } else draw();
}

undoButton.addEventListener("click", () => {
  const before = history.pop();
  if (!before) return;
  setArt(before);
  save();
});

freshButton.addEventListener("click", () => {
  if (!confirm(currentId ? "Start a new white canvas? (Your saved picture stays in My Pictures.)" : "Start a new white canvas? Your picture will be gone unless you save it.")) return;
  history.push(snapshot());
  pixels = blank(size);
  currentId = null;
  save();
  savePictures();
  draw();
  renderPictures();
});

window.addEventListener("resize", () => {
  if (!chunk.hidden) sizeCanvas();
});

// --- Saving with a name ---------------------------------------------------

function thumbnail(art: Art): string {
  const small = document.createElement("canvas");
  small.width = art.size;
  small.height = art.size;
  const c = small.getContext("2d")!;
  art.pixels.forEach((p, i) => {
    c.fillStyle = p;
    c.fillRect(i % art.size, Math.floor(i / art.size), 1, 1);
  });
  return small.toDataURL();
}

function artOf(picture: Picture): Art {
  return { size: picture.size ?? START_SIZE, pixels: picture.pixels, scale: picture.scale ?? 1 };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderPictures(): void {
  gallery.hidden = pictures.length === 0;
  picturesEl.innerHTML = pictures
    .map(
      (p) => `
      <li class="${p.id === currentId ? "on" : ""}">
        <button type="button" class="open" data-open="${p.id}" aria-label="Open ${escapeHtml(p.name)}">
          <img src="${thumbnail(artOf(p))}" alt="" />
          <span>${escapeHtml(p.name)}</span>
        </button>
        <button type="button" class="delete" data-delete="${p.id}" aria-label="Delete ${escapeHtml(p.name)}">🗑</button>
      </li>`
    )
    .join("");
}

saveButton.addEventListener("click", () => {
  nameRow.hidden = !nameRow.hidden;
  if (nameRow.hidden) return;
  nameInput.value = pictures.find((p) => p.id === currentId)?.name ?? "";
  nameInput.focus();
});

nameRow.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim() || "My picture";
  const existing = pictures.find((p) => p.id === currentId);
  if (existing) {
    existing.name = name;
    existing.pixels = [...pixels];
    existing.size = size;
    existing.scale = scale;
    pictures = [existing, ...pictures.filter((p) => p !== existing)];
  } else {
    currentId = Math.random().toString(36).slice(2, 10);
    pictures.unshift({ id: currentId, name, pixels: [...pixels], size, scale });
  }
  savePictures();
  renderPictures();
  nameRow.hidden = true;
  saveButton.textContent = "✅ Saved!";
  window.setTimeout(() => (saveButton.textContent = "💾 Save"), 1500);
});

picturesEl.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!target) return;
  const open = target.dataset["open"];
  const remove = target.dataset["delete"];
  if (open) {
    const picture = pictures.find((p) => p.id === open);
    if (!picture) return;
    history.push(snapshot());
    currentId = picture.id;
    if (chunk.hidden) chunk.hidden = false;
    setArt(artOf(picture));
    sizeCanvas();
    save();
    savePictures();
    renderPictures();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else if (remove) {
    const picture = pictures.find((p) => p.id === remove);
    if (!picture || !confirm(`Delete "${picture.name}" forever?`)) return;
    pictures = pictures.filter((p) => p !== picture);
    if (currentId === remove) currentId = null;
    savePictures();
    renderPictures();
  }
});

showColor();
renderRecent();
renderGridSizes();
renderPictures();
