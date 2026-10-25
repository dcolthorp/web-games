import {
  circle,
  darker,
  COLORS,
  designs,
  designName,
  designShape,
  drawDesign,
  wigShape,
  drawDoll,
  EYE_COLORS,
  HAIR_COLORS,
  saveDesigns,
  SKINS,
  START,
  type Design,
  type DesignKind,
  type G,
  type Look,
  toggleDesign,
} from "./doll";

// Penelope's Design Studio: pick something to make (a shirt, dress, skirt,
// coat, wig, or an extra you cut into any shape you like, like wings), sketch on it with crayons, pick its main colour, and sew it. Then
// your doll can wear it, and you can put it on display in your shop, where
// people walk in, look at your clothes, and buy them for coins. People keep
// shopping while you're away too (startShopping below). Your car is parked
// outside the shop window: click it to drive down the street, where other
// people's shops sell clothes they made, and spend your coins.

const KINDS: { kind: DesignKind; name: string }[] = [
  { kind: "shirt", name: "Shirt" },
  { kind: "dress", name: "Dress" },
  { kind: "skirt", name: "Skirt" },
  { kind: "coat", name: "Coat" },
  { kind: "wig", name: "Wig" },
  { kind: "extra", name: "Extra" },
];
const CRAYONS = [...COLORS, "#5fe0ff", "#ffb8dc", "#c8f06a"];
const MIN_SIZE = 0.5;
const MAX_SIZE = 100;
const COINS_KEY = "dress-up-coins";
const SEW_MS = 2600;

// ---- The page bits ----

const host = document.createElement("section");
host.className = "overlay";
host.hidden = true;
host.innerHTML = `
  <div class="overlay-card">
    <h2 class="overlay-title">Design Studio</h2>
    <p class="overlay-note" aria-live="polite"></p>
    <div class="overlay-body"></div>
    <div class="overlay-buttons"></div>
  </div>`;
document.body.append(host);
const titleEl = host.querySelector<HTMLElement>(".overlay-title")!;
const noteEl = host.querySelector<HTMLElement>(".overlay-note")!;
const body = host.querySelector<HTMLElement>(".overlay-body")!;
const buttonsEl = host.querySelector<HTMLElement>(".overlay-buttons")!;

let hooks: { wear: (design: Design) => void; changed: () => void } = { wear: () => {}, changed: () => {} };
let running = false;
let undoKeys: ((e: KeyboardEvent) => void) | null = null;
window.addEventListener("keydown", (e) => {
  if (!host.hidden) undoKeys?.(e);
});
let draw: ((now: number) => void) | null = null;

function button(label: string, onClick: () => void, main = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = main ? "pill pill-main" : "pill";
  b.textContent = label;
  b.addEventListener("click", onClick);
  buttonsEl.append(b);
  return b;
}

function close(): void {
  host.hidden = true;
  shopOpen = false;
  hooks.changed();
  running = false;
  draw = null;
}

function loop(now: number): void {
  if (!running) return;
  draw?.(now);
  requestAnimationFrame(loop);
}

function show(title: string, note: string): void {
  titleEl.textContent = title;
  noteEl.textContent = note;
  body.innerHTML = "";
  buttonsEl.innerHTML = "";
  draw = null;
  undoKeys = null;
  host.hidden = false;
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

/** A faint doll to design on top of. */
function ghostDoll(g: G): void {
  g.save();
  g.globalAlpha = 0.25;
  drawDoll(g, { ...START, top: "none", bottom: "none", dress: "none", coat: "none", shoes: "none", extras: [] });
  g.restore();
}

// ---- Step 1: what are you making? ----

export function openStudio(roomHooks: typeof hooks): void {
  hooks = roomHooks;
  shopOpen = false;
  show("Design Studio", "What do you want to make?");
  const grid = document.createElement("div");
  grid.className = "kind-grid";
  for (const k of KINDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item";
    b.setAttribute("aria-label", k.name);
    const c = document.createElement("canvas");
    c.width = 150;
    c.height = 200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff0f8";
    g.fillRect(0, 0, 150, 200);
    g.translate(18, 4);
    g.scale(0.38, 0.38);
    ghostDoll(g);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#ff6fb5";
    g.lineWidth = 6;
    g.setLineDash([14, 10]);
    g.fill(designShape(k.kind));
    g.stroke(designShape(k.kind));
    b.append(c, k.name);
    b.addEventListener("click", () => sketch(k.kind));
    grid.append(b);
  }
  body.append(grid);
  button("Close", close);
}

// ---- Step 2: sketch it ----

function sketch(kind: DesignKind): void {
  const name = KINDS.find((k) => k.kind === kind)!.name.toLowerCase();
  show(
    "Design Studio",
    kind === "extra"
      ? "Use the ✂️ Snip scissors to cut your fabric into any shape (like butterfly wings!), then color it."
      : `Draw on your ${name}! Pick crayons, and a main color for it. ✂️ Snip cuts bits off.`,
  );
  let base = kind === "extra" ? "#ff8fc7" : "#ffffff";
  let crayon = CRAYONS[0]!;
  let size = 10;
  // What a line does: draw with a crayon, rub out drawing, or snip the fabric off.
  let tool: "draw" | "erase" | "snip" = kind === "extra" ? "snip" : "draw";
  let front = false;

  const wrap = document.createElement("div");
  wrap.className = "sketch-wrap";
  const view = document.createElement("canvas");
  view.width = 300;
  view.height = 600;
  view.className = "sketch";
  view.setAttribute("aria-label", `Your ${name}, to draw on`);
  // What you draw goes on its own layer, kept as the design's picture.
  const layer = document.createElement("canvas");
  layer.width = 300;
  layer.height = 600;
  const pen = layer.getContext("2d")!;
  // The snipped-off bits go on their own layer too, and get cut out of the fabric.
  const snips = document.createElement("canvas");
  snips.width = 300;
  snips.height = 600;
  const scissors = snips.getContext("2d")!;
  let snipped = false;
  const tools = document.createElement("div");
  tools.className = "tools";
  wrap.append(view, tools);
  body.append(wrap);

  const row = (label: string): HTMLDivElement => {
    const r = document.createElement("div");
    r.className = "tool-row";
    const h = document.createElement("h3");
    h.textContent = label;
    tools.append(h, r);
    return r;
  };
  const swatches = (r: HTMLDivElement, list: string[], current: () => string, set: (c: string) => void): void => {
    const paint = (): void => r.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset["c"] === current())));
    for (const c of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.dataset["c"] = c;
      b.style.background = c;
      b.setAttribute("aria-label", `Color ${c}`);
      b.addEventListener("click", () => {
        set(c);
        paint();
      });
      r.append(b);
    }
    paint();
  };
  // Undo and redo: every line you draw (and every Clear) is remembered, and
  // the drawing is redrawn from them, so you can undo all the way back to
  // just the main colour.
  type Line = { points: { x: number; y: number }[]; color: string; size: number; tool: "draw" | "erase" | "snip" } | "clear";
  const lines: Line[] = [];
  const redos: Line[] = [];
  const redraw = (): void => {
    pen.clearRect(0, 0, 300, 600);
    scissors.clearRect(0, 0, 300, 600);
    snipped = false;
    for (const line of lines) {
      if (line === "clear") {
        pen.clearRect(0, 0, 300, 600);
        scissors.clearRect(0, 0, 300, 600);
        snipped = false;
      } else paintLine(line);
    }
  };
  const paintLine = (line: Exclude<Line, "clear">, from = 0): void => {
    const p = line.tool === "snip" ? scissors : pen;
    if (line.tool === "snip") snipped = true;
    p.globalCompositeOperation = line.tool === "erase" ? "destination-out" : "source-over";
    p.strokeStyle = line.tool === "snip" ? "#000000" : line.color;
    p.lineWidth = line.size;
    p.lineCap = "round";
    p.lineJoin = "round";
    p.beginPath();
    const pts = line.points;
    const start = Math.max(0, from - 1);
    p.moveTo(pts[start]!.x, pts[start]!.y);
    for (let i = start; i < pts.length; i++) p.lineTo(pts[i]!.x + (i === 0 ? 0.01 : 0), pts[i]!.y);
    p.stroke();
    p.globalCompositeOperation = "source-over";
  };
  const remember = (line: Line): void => {
    lines.push(line);
    redos.length = 0;
    paintHistory();
  };
  const historyRow = document.createElement("div");
  historyRow.className = "tool-row";
  tools.append(historyRow);
  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.className = "pill";
  undoButton.textContent = "↩️ Undo";
  const redoButton = document.createElement("button");
  redoButton.type = "button";
  redoButton.className = "pill";
  redoButton.textContent = "↪️ Redo";
  historyRow.append(undoButton, redoButton);
  const paintHistory = (): void => {
    undoButton.disabled = lines.length === 0;
    redoButton.disabled = redos.length === 0;
  };
  const undo = (): void => {
    const line = lines.pop();
    if (!line) return;
    redos.push(line);
    redraw();
    paintHistory();
  };
  const redo = (): void => {
    const line = redos.pop();
    if (!line) return;
    lines.push(line);
    redraw();
    paintHistory();
  };
  undoButton.addEventListener("click", undo);
  redoButton.addEventListener("click", redo);
  paintHistory();
  undoKeys = (e: KeyboardEvent): void => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  };

  swatches(row("🖍️ Crayons"), CRAYONS, () => (tool === "draw" ? crayon : ""), (c) => ((crayon = c), (tool = "draw"), paintTools()));

  // How thick: a slider from 0.5 to 100. While you drag it, a circle on the
  // doll shows exactly how thick the line will be.
  const sizeRow = row("✏️ How thick");
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "size-slider";
  slider.min = String(MIN_SIZE);
  slider.max = String(MAX_SIZE);
  slider.step = "0.5";
  slider.value = String(size);
  slider.setAttribute("aria-label", "How thick");
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "size-label";
  sizeLabel.textContent = String(size);
  let previewUntil = 0;
  slider.addEventListener("input", () => {
    size = Number(slider.value);
    sizeLabel.textContent = String(size);
    previewUntil = performance.now() + 1200;
  });
  const toolButton = (label: string, which: "erase" | "snip"): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill";
    b.textContent = label;
    b.addEventListener("click", () => {
      tool = tool === which ? "draw" : which;
      paintTools();
      swatchesRepaint();
    });
    return b;
  };
  const eraser = toolButton("Eraser", "erase");
  const snipper = toolButton("✂️ Snip", "snip");
  const paintTools = (): void => {
    eraser.setAttribute("aria-pressed", String(tool === "erase"));
    snipper.setAttribute("aria-pressed", String(tool === "snip"));
  };
  sizeRow.append(slider, sizeLabel, eraser, snipper);
  paintTools();
  const crayonRow = tools.querySelector<HTMLDivElement>(".tool-row:nth-of-type(2)");
  const swatchesRepaint = (): void =>
    crayonRow?.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(tool === "draw" && b.dataset["c"] === crayon)));
  if (kind === "extra") {
    // Extras go behind her (like wings) or in front of her.
    const wearRow = row("✨ Wear it");
    for (const [label, isFront] of [["Behind her", false], ["In front of her", true]] as const) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill";
      b.textContent = label;
      b.dataset["front"] = String(isFront);
      b.addEventListener("click", () => {
        front = isFront;
        wearRow.querySelectorAll<HTMLButtonElement>(".pill").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset["front"] === String(front))));
      });
      b.setAttribute("aria-pressed", String(isFront === front));
      wearRow.append(b);
    }
  }
  swatches(row("🎨 Main color"), CRAYONS, () => base, (c) => (base = c));

  // Drawing with the mouse or a finger.
  const at = (e: PointerEvent): { x: number; y: number } => {
    const r = view.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 600 };
  };
  let hoverAt: { x: number; y: number } | null = null;
  let drawing: Exclude<Line, "clear"> | null = null;
  view.addEventListener("pointerdown", (e) => {
    view.setPointerCapture(e.pointerId);
    drawing = { points: [at(e)], color: crayon, size, tool };
    remember(drawing);
    paintLine(drawing);
  });
  view.addEventListener("pointermove", (e) => {
    hoverAt = at(e);
    if (!drawing) return;
    drawing.points.push(at(e));
    paintLine(drawing, drawing.points.length - 1);
  });
  for (const ev of ["pointerup", "pointercancel"]) view.addEventListener(ev, () => (drawing = null));
  view.addEventListener("pointerleave", () => (hoverAt = null));

  const g = view.getContext("2d")!;
  const shapePath = designShape(kind);
  let sewAt: number | null = null;
  // Each piece is put together on its own (colour, drawing, snips cut out), then shown.
  const piece = document.createElement("canvas");
  piece.width = 300;
  piece.height = 600;
  const pg = piece.getContext("2d")!;
  const paintPiece = (shape: Path2D): void => {
    pg.clearRect(0, 0, 300, 600);
    pg.fillStyle = base;
    pg.fill(shape);
    pg.save();
    pg.clip(shape);
    pg.drawImage(layer, 0, 0);
    pg.restore();
    pg.globalCompositeOperation = "destination-out";
    pg.drawImage(snips, 0, 0);
    pg.globalCompositeOperation = "source-over";
    if (kind === "extra" && !snipped) g.globalAlpha = 0.85;
    g.drawImage(piece, 0, 0);
    g.globalAlpha = 1;
  };
  draw = (now) => {
    g.fillStyle = "#fffaff";
    g.fillRect(0, 0, 300, 600);
    ghostDoll(g);
    if (kind === "wig") {
      // The back of the wig, then her face, then the bangs over the top.
      paintPiece(wigShape("back"));
      circle(g, 150, 120, 58, "#f2c7a5");
      for (const x of [128, 172]) circle(g, x, 126, 7, "#3a2440");
      paintPiece(wigShape("front"));
    } else {
      paintPiece(shapePath);
    }
    g.strokeStyle = "#c9b8e8";
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.stroke(shapePath);
    g.setLineDash([]);
    // A circle the size of your crayon, following the mouse...
    if (hoverAt && sewAt === null) {
      g.strokeStyle = tool === "draw" ? "#3a2440" : tool === "snip" ? "#e8383d" : "#7d8794";
      g.lineWidth = 1.5;
      g.setLineDash(tool === "draw" ? [] : [4, 4]);
      g.beginPath();
      g.arc(hoverAt.x, hoverAt.y, Math.max(1, size / 2), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    // ...and a big one on the doll while you drag the slider.
    if (now < previewUntil) {
      const fade = Math.min(1, (previewUntil - now) / 300);
      g.globalAlpha = fade;
      g.fillStyle = "rgba(255, 255, 255, 0.8)";
      g.beginPath();
      g.roundRect(80, 230, 140, 150, 20);
      g.fill();
      g.fillStyle = tool === "draw" ? crayon : "#ffffff";
      g.strokeStyle = "#3a2440";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(150, 300, Math.max(0.6, size / 2), 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = "#4a1f6e";
      g.font = '800 14px "Trebuchet MS", sans-serif';
      g.textAlign = "center";
      g.fillText("This thick!", 150, 372);
      g.globalAlpha = 1;
    }
    if (sewAt !== null) drawSewing(g, kind, (now - sewAt) / SEW_MS);
  };

  button("🧵 Sew it!", () => {
    if (sewAt !== null) return;
    sewAt = performance.now();
    noteEl.textContent = "Sewing... zip zip zip!";
    buttonsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
    window.setTimeout(() => {
      const design: Design = {
        id: `d${Date.now()}`,
        kind,
        base,
        sketch: layer.toDataURL("image/png"),
        onDisplay: false,
        sold: 0,
        ...(snipped ? { mask: snips.toDataURL("image/png") } : {}),
        ...(kind === "extra" ? { front } : {}),
      };
      designs.push(design);
      if (designs.length > 24) designs.shift();
      saveDesigns();
      hooks.changed();
      done(design);
    }, SEW_MS + 200);
  }, true);
  button("Clear", () => {
    remember("clear");
    pen.clearRect(0, 0, 300, 600);
    scissors.clearRect(0, 0, 300, 600);
    snipped = false;
  });
  button("Back", () => openStudio(hooks));
}

/** Stitches running round the outline, with the needle at the front. */
function drawSewing(g: G, kind: DesignKind, k: number): void {
  const outline = OUTLINES[kind];
  const total = outline.length;
  const upTo = Math.min(total, Math.floor(k * total));
  g.strokeStyle = "#ff4fa3";
  g.lineWidth = 3;
  g.setLineDash([7, 5]);
  g.beginPath();
  for (let i = 0; i <= upTo && i < total; i++) {
    const [x, y] = outline[i]!;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.setLineDash([]);
  const [nx, ny] = outline[Math.min(upTo, total - 1)]!;
  g.strokeStyle = "#7d8794";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(nx, ny);
  g.lineTo(nx + 22, ny - 22 + Math.sin(k * 80) * 4);
  g.stroke();
  circle(g, nx + 22, ny - 22 + Math.sin(k * 80) * 4, 3, "#ffffff");
}

/** Points all the way round each kind of clothes, for the sewing to follow. */
const OUTLINES: Record<DesignKind, [number, number][]> = (() => {
  const round = (pts: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length]!;
      for (let t = 0; t < 1; t += 0.05) out.push([x + (nx - x) * t, y + (ny - y) * t]);
    });
    return out;
  };
  return {
    shirt: round([[90, 194], [210, 194], [220, 246], [188, 254], [190, 324], [110, 324], [112, 254], [80, 246]]),
    dress: round([[102, 194], [198, 194], [192, 300], [238, 452], [62, 452], [108, 300]]),
    skirt: round([[108, 310], [192, 310], [216, 410], [84, 410]]),
    coat: round([[96, 190], [204, 190], [234, 324], [206, 334], [212, 408], [88, 408], [94, 334], [66, 324]]),
    wig: round([[78, 306], [78, 112], [100, 58], [150, 40], [200, 58], [222, 112], [222, 306]]),
    extra: round([[16, 20], [284, 20], [284, 580], [16, 580]]),
  };
})();

// ---- Step 3: ta-da! ----

function done(design: Design): void {
  const name = KINDS.find((k) => k.kind === design.kind)!.name.toLowerCase();
  show("Ta-da!", `You made a ${name}! Give it a name, then pick what to do with it.`);
  const label = document.createElement("label");
  label.className = "name-it";
  label.textContent = "Name it: ";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 30;
  input.placeholder = designName(design);
  input.addEventListener("input", () => {
    design.name = input.value;
    saveDesigns();
    hooks.changed();
  });
  label.append(input);
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 600;
  c.className = "sketch";
  body.append(label, c);
  window.setTimeout(() => input.focus(), 50);
  const g = c.getContext("2d")!;
  draw = () => {
    g.fillStyle = "#fffaff";
    g.fillRect(0, 0, 300, 600);
    drawDoll(g, { ...START, mine: [design.id] });
  };
  button("👗 Wear it", () => {
    hooks.wear(design);
    close();
  }, true);
  button("🏪 Put it in my shop", () => {
    design.onDisplay = true;
    saveDesigns();
    openShop();
  });
  button("Make another", () => openStudio(hooks));
}

// ---- The shop ----

interface Customer {
  look: Look;
  x: number; // where they are in the shop (it scrolls, so this isn't where they are on the screen)
  target: Design; // what they've come to look at
  state: "in" | "looking" | "out";
  owner?: OtherShop; // a shop owner coming to get back something you stole
  carrying?: Design; // what the owner is taking back to their shop
  buys: boolean; // decided as they walk in: do they like the price?
  until: number;
  paid: number;
}

let coins = Number(localStorage.getItem(COINS_KEY)) || 0;
let shopOpen = false;

export const getCoins = (): number => coins;

// ---- Shopping while you're away ----
// About every SALE_MS somebody buys one of the things you have on display,
// whether you're watching or not (even with the game closed: the next time
// it opens, it adds up what sold while you were gone).

const SALE_MS = 8_000;
const LAST_SALE_KEY = "dress-up-last-sale";
const MAX_AWAY_SALES = 100;

export const DEFAULT_PRICE = 30;
export const MAX_PRICE = 1000;
export const priceOf = (d: Design): number => d.price ?? DEFAULT_PRICE;

/**
 * Will a shopper pay this much? Cheap things nearly always sell; the pricier
 * something is, the more often people think it costs too much.
 */
const willBuy = (d: Design): boolean => Math.random() < Math.min(1, Math.pow(40 / priceOf(d), 0.8));

/** Somebody picks something on display and maybe buys it. Returns what they paid (0 if they didn't). */
function sellOne(): number {
  const shelf = shopShelf();
  if (!shelf.length) return 0;
  const d = shelf[Math.floor(Math.random() * shelf.length)]!;
  if (!willBuy(d)) return 0;
  d.sold++;
  coins += priceOf(d);
  return priceOf(d);
}

function saveCoins(): void {
  localStorage.setItem(COINS_KEY, String(coins));
  localStorage.setItem(LAST_SALE_KEY, String(Date.now()));
}

/**
 * Starts the shop selling in the background. `onSale` hears about every sale
 * that happens while the shop is closed (and, first, the ones from while you
 * were away).
 */
export function startShopping(onSale: (text: string) => void): void {
  const last = Number(localStorage.getItem(LAST_SALE_KEY)) || Date.now();
  const missed = shopShelf().length ? Math.min(MAX_AWAY_SALES, Math.floor((Date.now() - last) / SALE_MS)) : 0;
  let earned = 0;
  for (let i = 0; i < missed; i++) earned += sellOne();
  saveDesigns();
  saveCoins();
  if (missed > 0) onSale(`While you were away, people bought ${missed} thing${missed === 1 ? "" : "s"} from your shop! +${earned} coins 🪙`);
  window.setInterval(() => {
    // The shop sells on its own when you're not in it (in it, you watch the shoppers).
    if (shopOpen) return;
    const paid = sellOne();
    saveCoins();
    if (paid) {
      saveDesigns();
      onSale(`Ka-ching! Somebody bought something from your shop! +${paid} coins 🪙`);
    }
  }, SALE_MS);
}
let customers: Customer[] = [];
let nextCustomer = 0;
let pops: { x: number; text: string; at: number }[] = [];
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const DISPLAY_GAP = 160;
/** Where a mannequin stands in the shop. There's room for as many as you like: the shop scrolls. */
const displayX = (i: number): number => 170 + i * DISPLAY_GAP;
let shopCam = 0; // how far along the shop you've scrolled
const shopWidth = (n: number): number => Math.max(820, displayX(n - 1) + 120);

const shopShelf = (): Design[] => designs.filter((d) => d.onDisplay && !d.stolenFrom);

function randomShopper(): Look {
  return {
    ...START,
    kind: pick(["girl", "boy"] as const),
    skin: pick(SKINS),
    eyes: pick(["round", "sparkly", "happy"] as const),
    eyeColor: pick(EYE_COLORS),
    hair: pick(["long", "pigtails", "bun", "short", "ponytail", "curly"] as const),
    hairColor: pick(HAIR_COLORS),
    top: pick(["tshirt", "tank", "sweater", "puffy"] as const),
    topColor: pick(COLORS),
    bottom: pick(["skirt", "pants", "shorts"] as const),
    bottomColor: pick(COLORS),
    extras: [],
  };
}

export function openShop(roomHooks?: typeof hooks): void {
  if (roomHooks) hooks = roomHooks;
  shopOpen = true;
  show("My Shop", "");
  const c = document.createElement("canvas");
  c.width = 820;
  c.height = 460;
  c.className = "shop";
  c.setAttribute("aria-label", "Your shop, with your clothes on display");
  body.append(c);
  const g = c.getContext("2d")!;
  customers = [];
  nextCustomer = performance.now() + 800;
  let shelf = shopShelf();
  const maxCam = (): number => shopWidth(shelf.length) - 820;
  shopCam = Math.min(shopCam, maxCam());
  let slide = 0; // which way the arrows are scrolling
  // Things you stole: their shops come to get them back, one at a time.
  const stolen = designs.filter((d) => d.stolenFrom);
  let nextOwner = performance.now() + 1500;
  const say = (): void => {
    noteEl.textContent = shelf.length
      ? `You have ${coins} coins! People are coming to look at your clothes...${shelf.length > 4 ? " Scroll to see everything!" : ""}`
      : "Your shop is empty! Make something in the Design Studio and put it in your shop.";
  };
  say();
  if (stolen.length) noteEl.textContent = "Uh oh... somebody is coming. Did you take something without paying?";
  const at = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 820, y: ((e.clientY - r.top) / r.height) * 460 };
  };
  // Scroll by dragging, with the mouse wheel, or by holding the arrows.
  let drag: { x: number; cam: number; moved: boolean } | null = null;
  c.addEventListener("pointerdown", (e) => {
    const { x, y } = at(e);
    c.setPointerCapture(e.pointerId);
    if (maxCam() > 0 && y > 330 && x < 70) slide = -1;
    else if (maxCam() > 0 && y > 330 && x > 750) slide = 1;
    else drag = { x, cam: shopCam, moved: false };
  });
  c.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = at(e).x - drag.x;
    if (Math.abs(dx) > 8) drag.moved = true;
    if (drag.moved) shopCam = Math.max(0, Math.min(maxCam(), drag.cam - dx));
  });
  const up = (e: PointerEvent): void => {
    slide = 0;
    const wasDrag = drag;
    drag = null;
    if (!wasDrag || wasDrag.moved || e.type !== "pointerup") return;
    const { x, y } = at(e);
    if (x > WINDOW.x - 6 && x < WINDOW.x + WINDOW.w + 6 && y > WINDOW.y - 6 && y < WINDOW.y + WINDOW.h + 6) openStreet(0);
  };
  c.addEventListener("pointerup", up);
  c.addEventListener("pointercancel", up);
  c.addEventListener("wheel", (e) => {
    if (maxCam() <= 0) return;
    e.preventDefault();
    shopCam = Math.max(0, Math.min(maxCam(), shopCam + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)));
  }, { passive: false });
  // Name your shop: it goes on the sign (and on the street).
  const nameIt = document.createElement("label");
  nameIt.className = "name-it";
  nameIt.textContent = "Shop name: ";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 24;
  nameInput.value = shopName;
  nameInput.addEventListener("input", () => {
    shopName = nameInput.value.trim() || "Penelope's Shop";
    localStorage.setItem(SHOP_NAME_KEY, shopName);
  });
  nameIt.append(nameInput);
  body.prepend(nameIt);
  const rows = new Map<Design, HTMLElement>();
  /** The shop owner grabs back what you stole: it's gone from your designs (and your shop). */
  const takeBack = (d: Design): void => {
    const i = designs.indexOf(d);
    if (i >= 0) designs.splice(i, 1);
    saveDesigns();
    rows.get(d)?.remove();
    shelf = shopShelf();
    shopCam = Math.max(0, Math.min(maxCam(), shopCam));
    customers = customers.filter((cu) => cu.owner || shelf.includes(cu.target));
    hooks.changed();
  };
  draw = (now) => {
    if (slide) shopCam = Math.max(0, Math.min(maxCam(), shopCam + slide * 9));
    drawShop(g, shelf, now);
    // A shop owner marches in to get back something you took.
    const ownerHere = customers.some((cu) => cu.owner);
    if (stolen.length && !ownerHere && now > nextOwner) {
      const d = stolen.shift()!;
      const owner = OTHER_SHOPS.find((o) => o.name === d.stolenFrom) ?? OTHER_SHOPS[0]!;
      customers.push({ look: randomShopper(), x: shopCam + 880, target: d, state: "in", until: 0, paid: 0, buys: false, owner });
    }
    if (shelf.length && now > nextCustomer && customers.length < 3) {
      // Shoppers mostly come to look at what's on the screen right now.
      const near = shelf.filter((_, i) => displayX(i) > shopCam + 40 && displayX(i) < shopCam + 700);
      const target = pick(near.length ? near : shelf);
      customers.push({ look: randomShopper(), x: shopCam + 860, target, state: "in", until: 0, paid: 0, buys: willBuy(target) });
      nextCustomer = now + 2600 + Math.random() * 2400;
    }
    for (const cu of customers) {
      if (cu.owner) {
        // Owners stop in the middle of the screen, tell you off, and take it back home.
        const goal = shopCam + 430;
        if (cu.state === "in") {
          cu.x -= 3;
          if (cu.x <= goal) (cu.state = "looking"), (cu.until = now + 2600);
        } else if (cu.state === "looking" && now > cu.until) {
          cu.state = "out";
          cu.carrying = cu.target;
          takeBack(cu.target);
          pops.push({ x: cu.x, text: "Took it back!", at: now });
          noteEl.textContent = `${cu.owner.name} took back the ${designName(cu.target).replace(/ from .*$/, "")}. Next time, buy it with coins!`;
        } else if (cu.state === "out") {
          cu.x += 3; // back out the door to their own shop
        }
      } else {
        const goal = displayX(shelf.indexOf(cu.target)) + 50;
        if (cu.state === "in") {
          cu.x -= 2.2;
          if (cu.x <= goal) (cu.state = "looking"), (cu.until = now + 2200);
        } else if (cu.state === "looking" && now > cu.until) {
          cu.state = "out";
          const d = cu.target;
          if (cu.buys) {
            // They love it! Ka-ching! And they put it on and wear it out of the shop.
            cu.paid = priceOf(d);
            coins += cu.paid;
            saveCoins();
            d.sold++;
            saveDesigns();
            toggleDesign(cu.look, d);
            pops.push({ x: cu.x, text: `+${cu.paid} coins!`, at: now });
            say();
          } else {
            pops.push({ x: cu.x, text: "Too much!", at: now });
          }
        } else if (cu.state === "out") {
          cu.x -= 2.6;
        }
      }
      drawShopper(g, cu, now);
    }
    if (!customers.some((cu) => cu.owner) && ownerHere) nextOwner = now + 2500;
    customers = customers.filter((cu) => (cu.owner ? cu.x < shopCam + 900 : cu.x > shopCam - 80));
    pops = pops.filter((p) => now - p.at < 1200);
    g.font = '800 22px "Trebuchet MS", sans-serif';
    g.textAlign = "center";
    for (const p of pops) {
      g.globalAlpha = 1 - (now - p.at) / 1200;
      g.fillStyle = p.text === "+" || p.text.startsWith("+") ? "#2e9e4f" : "#c0392b";
      g.fillText(p.text, p.x - shopCam, 120 - (now - p.at) / 20);
    }
    g.globalAlpha = 1;
    // Scroll arrows, when there's more shop than fits.
    if (maxCam() > 0) {
      g.fillStyle = "rgba(74, 31, 110, 0.55)";
      g.font = '900 40px "Trebuchet MS", sans-serif';
      g.textBaseline = "middle";
      if (shopCam > 1) g.fillText("◀", 36, 380);
      if (shopCam < maxCam() - 1) g.fillText("▶", 784, 380);
      const barW = (820 / shopWidth(shelf.length)) * 700;
      g.fillStyle = "rgba(74, 31, 110, 0.25)";
      g.beginPath();
      g.roundRect(60 + (shopCam / maxCam()) * (700 - barW), 450, barW, 6, 3);
      g.fill();
    }
  };
  // Your prices: set what each thing on display costs, or take it out of the shop.
  if (shelf.length) {
    const list = document.createElement("div");
    list.className = "price-list";
    for (const d of shelf) {
      const row = document.createElement("label");
      row.className = "price-row";
      rows.set(d, row);
      const name = document.createElement("span");
      name.textContent = designName(d);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = String(MAX_PRICE);
      input.value = String(priceOf(d));
      input.setAttribute("aria-label", `Price of ${designName(d)}`);
      input.addEventListener("input", () => {
        const n = Math.round(Number(input.value));
        if (n >= 1 && n <= MAX_PRICE) {
          d.price = n;
          saveDesigns();
        }
      });
      const out = document.createElement("button");
      out.type = "button";
      out.className = "pill";
      out.textContent = "Take it out";
      out.addEventListener("click", () => {
        d.onDisplay = false;
        saveDesigns();
        hooks.changed();
        openShop();
      });
      row.append(name, input, document.createTextNode(" coins"), out);
      list.append(row);
    }
    body.append(list);
  }
  button("✏️ Design something", () => openStudio(hooks), true);
  button("Close the shop", close);
}

interface ShopLook {
  name: string;
  wall: string;
  awning: string;
}

const SHOP_NAME_KEY = "dress-up-shop-name";
let shopName = localStorage.getItem(SHOP_NAME_KEY) || "Penelope's Shop";
const myShop = (): ShopLook => ({ name: shopName, wall: "#ffe4f2", awning: "#ff6fb5" });

/** Your car's window: the bit of the shop you click to go out to the street. */
const WINDOW = { x: 714, y: 96, w: 92, h: 140 };

function drawShop(g: G, shelf: Design[], now: number, look: ShopLook = myShop(), window = true): void {
  g.fillStyle = look.wall;
  g.fillRect(0, 0, 820, 460);
  g.fillStyle = "rgba(255, 255, 255, 0.35)";
  for (let x = 0; x < 820; x += 40) g.fillRect(x, 0, 18, 330);
  // A stripy awning and a sign.
  for (let i = 0; i < 21; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : look.awning;
    g.fillRect(i * 40, 0, 40, 34);
  }
  g.font = '900 24px "Trebuchet MS", sans-serif';
  const signW = Math.max(200, g.measureText(look.name).width + 40);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(410 - signW / 2, 42, signW, 40, 14);
  g.fill();
  g.fillStyle = darker(look.awning, 0.7);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(look.name, 410, 63);
  if (window) {
    // A window onto the street, with your car parked outside.
    const { x, y, w, h } = WINDOW;
    g.fillStyle = "#ffffff";
    g.fillRect(x - 6, y - 6, w + 12, h + 12);
    g.fillStyle = "#bfe6ff";
    g.fillRect(x, y, w, h);
    g.fillStyle = "#5d626c";
    g.fillRect(x, y + h - 30, w, 30);
    drawCar(g, x + w / 2, y + h - 22, 0.55);
    g.fillStyle = "#4a1f6e";
    g.font = '800 12px "Trebuchet MS", sans-serif';
    g.fillText(now % 1600 < 1100 ? "Click the car!" : "", x + w / 2, y + 16);
  }
  g.fillStyle = "#c9965f";
  g.fillRect(0, 330, 820, 130);
  // Mannequins wearing your designs (your shop scrolls; other shops don't).
  const cam = window ? shopCam : 0;
  shelf.forEach((d, i) => {
    const x = displayX(i) - cam;
    if (x < -100 || x > 920) return;
    g.fillStyle = "#e8d8ff";
    g.beginPath();
    g.ellipse(x, 400, 50, 12, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(x - 54, 110 + Math.sin(now / 900 + i) * 1.5);
    g.scale(0.36, 0.36);
    drawMannequin(g);
    drawDesign(g, d);
    g.restore();
    g.fillStyle = "#4a1f6e";
    g.font = '700 14px "Trebuchet MS", sans-serif';
    g.fillText(designName(d), x, 424, 150);
    g.font = '700 12px "Trebuchet MS", sans-serif';
    g.fillText(d.sold ? `Sold ${d.sold}!` : "New!", x, 442);
  });
}

/** Your pink car, with (x, y) at the middle of its bottom. */
function drawCar(g: G, x: number, y: number, k: number): void {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  g.fillStyle = "#ff6fb5";
  g.beginPath();
  g.roundRect(-70, -50, 140, 36, 12);
  g.fill();
  g.beginPath();
  g.roundRect(-40, -78, 80, 34, 14);
  g.fill();
  g.fillStyle = "#bfe6ff";
  g.fillRect(-32, -72, 28, 22);
  g.fillRect(4, -72, 28, 22);
  for (const wx of [-40, 40]) {
    circle(g, wx, -12, 16, "#24222b");
    circle(g, wx, -12, 6, "#c9ced6");
  }
  circle(g, 66, -36, 6, "#fff4a8");
  g.restore();
}

function drawMannequin(g: G): void {
  g.fillStyle = "#d8d4dc";
  g.beginPath();
  g.ellipse(150, 120, 46, 54, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(140, 170, 20, 30);
  g.beginPath();
  g.moveTo(100, 196);
  g.lineTo(200, 196);
  g.lineTo(190, 330);
  g.lineTo(110, 330);
  g.fill();
  g.fillStyle = "#a9adb5";
  g.fillRect(144, 330, 12, 230);
  g.fillRect(100, 556, 100, 10);
}

function drawShopper(g: G, cu: Customer, now: number): void {
  const walking = cu.state !== "looking";
  const x = cu.x - shopCam;
  g.save();
  g.translate(x - 50, 200 - (walking ? Math.abs(Math.sin(now / 140)) * 4 : 0));
  g.scale(0.36, 0.36);
  drawDoll(g, cu.look);
  if (cu.carrying) {
    // Carrying it home under their arm.
    g.translate(150, 230);
    g.scale(0.45, 0.45);
    drawDesign(g, cu.carrying);
  }
  g.restore();
  if (cu.owner) {
    // A shop owner: their name over their head, and a cross word bubble.
    g.fillStyle = darker(cu.owner.awning, 0.7);
    g.font = '800 13px "Trebuchet MS", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(`From ${cu.owner.name}`, x, 196);
    if (cu.state === "looking") {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.roundRect(x - 70, 132, 140, 44, 14);
      g.fill();
      g.fillStyle = "#c0392b";
      g.font = '800 15px "Trebuchet MS", sans-serif';
      g.fillText("Hey! You didn't", x, 146);
      g.fillText("pay for that!", x, 164);
    }
    return;
  }
  cu = { ...cu, x };
  if (cu.state === "looking") {
    // A thought bubble: a heart if they love it, a shocked face if it costs too much.
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(cu.x + 30, 170, 26, 20, 0, 0, Math.PI * 2);
    g.fill();
    circle(g, cu.x + 10, 194, 5, "#ffffff");
    g.fillStyle = cu.buys ? "#ff4fa3" : "#c0392b";
    g.font = cu.buys ? "24px sans-serif" : '800 15px "Trebuchet MS", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(cu.buys ? "♥" : "$$$?!", cu.x + 30, 171);
  }
}

// ---- The street ----
// Your shop is first, then everybody else's. Click the right side to drive
// forward, the left side to drive back, and a shop to go in.

interface OtherShop extends ShopLook {
  only?: DesignKind;
  items: Design[];
}

const PATTERNS = ["Stripy", "Polka-dot", "Starry", "Heart", "Zigzag", "Rainbow"] as const;

/** Numbers that come out the same every time for the same seed, so the shops keep their stock. */
function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A pattern drawn all over a design (the design's shape trims it). */
function patternPicture(pattern: (typeof PATTERNS)[number], color: string): string {
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 600;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.strokeStyle = color;
  if (pattern === "Stripy") for (let y = 0; y < 600; y += 28) g.fillRect(0, y, 300, 12);
  if (pattern === "Polka-dot") for (let y = 10; y < 600; y += 30) for (let x = (y / 30) % 2 ? 25 : 10; x < 300; x += 30) circle(g, x, y, 7, color);
  if (pattern === "Starry" || pattern === "Heart") {
    for (let y = 20; y < 600; y += 44) {
      for (let x = (y / 44) % 2 ? 40 : 18; x < 300; x += 44) {
        g.beginPath();
        if (pattern === "Starry") {
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 ? 4 : 10;
            g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          }
        } else {
          g.moveTo(x, y + 8);
          g.bezierCurveTo(x - 12, y, x - 6, y - 10, x, y - 3);
          g.bezierCurveTo(x + 6, y - 10, x + 12, y, x, y + 8);
        }
        g.fill();
      }
    }
  }
  if (pattern === "Zigzag") {
    g.lineWidth = 6;
    for (let y = 0; y < 600; y += 36) {
      g.beginPath();
      for (let x = 0; x <= 300; x += 20) g.lineTo(x, y + (x % 40 ? 12 : 0));
      g.stroke();
    }
  }
  if (pattern === "Rainbow") {
    const bands = ["#ff4d4d", "#ff9a3c", "#ffd23f", "#4cc76a", "#4a9bff", "#a35cff"];
    for (let y = 0; y < 600; y += 16) {
      g.fillStyle = bands[(y / 16) % bands.length]!;
      g.fillRect(0, y, 300, 16);
    }
  }
  return c.toDataURL("image/png");
}

const OTHER_SHOPS: OtherShop[] = [
  { name: "Lily's Boutique", wall: "#e0f4ff", awning: "#4a9bff", items: [] },
  { name: "Sparkle Closet", wall: "#fff4c9", awning: "#f2c230", items: [] },
  { name: "Sam's Style", wall: "#e2f7e6", awning: "#4cc76a", items: [] },
  { name: "Zoe's Wig Shop", wall: "#f3e6ff", awning: "#a35cff", only: "wig", items: [] },
  { name: "Rainbow Threads", wall: "#ffe9dc", awning: "#ff9226", items: [] },
  { name: "Mia's Coats", wall: "#ffe4ec", awning: "#e8383d", only: "coat", items: [] },
];

/** Fills a shop with the things its owner made (the same things every time). */
function stock(shop: OtherShop, n: number): Design[] {
  if (shop.items.length) return shop.items;
  const rand = seeded(1000 + n * 77);
  const kinds: DesignKind[] = shop.only ? [shop.only] : ["shirt", "dress", "skirt", "coat", "wig"];
  const count = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < count; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)]!;
    const pattern = PATTERNS[Math.floor(rand() * PATTERNS.length)]!;
    const base = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
    let ink = CRAYONS[Math.floor(rand() * CRAYONS.length)]!;
    if (ink === base) ink = base === "#ffffff" ? "#ff6fb5" : "#ffffff";
    shop.items.push({
      id: `shop${n}-${i}`,
      kind,
      base,
      sketch: patternPicture(pattern, ink),
      onDisplay: false,
      sold: 0,
      name: `${pattern} ${kind}`,
      price: 20 + Math.floor(rand() * 29) * 10,
    });
  }
  return shop.items;
}

const SHOP_GAP = 300;
let streetAt = 0; // which shop you're in front of (0 is yours)
let streetCam = 0;

function openStreet(at: number): void {
  shopOpen = false;
  streetAt = at;
  streetCam = at * SHOP_GAP;
  show("The Street", "Click the right side to drive forward, the left side to drive back. Click a shop to go in!");
  const c = document.createElement("canvas");
  c.width = 820;
  c.height = 460;
  c.className = "shop";
  c.setAttribute("aria-label", "The street, with shops all along it");
  body.append(c);
  const g = c.getContext("2d")!;
  const count = OTHER_SHOPS.length + 1;
  c.addEventListener("pointerdown", (e) => {
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 820;
    if (x < 200) streetAt = Math.max(0, streetAt - 1);
    else if (x > 620) streetAt = Math.min(count - 1, streetAt + 1);
    else if (streetAt === 0) openShop();
    else openOtherShop(streetAt - 1);
  });
  draw = (now) => {
    streetCam += (streetAt * SHOP_GAP - streetCam) * 0.12;
    const sky = g.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#8fd0ff");
    sky.addColorStop(1, "#e8f6ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, 820, 460);
    for (let i = 0; i < count; i++) {
      const x = 410 + i * SHOP_GAP - streetCam;
      if (x < -200 || x > 1020) continue;
      const look = i === 0 ? myShop() : OTHER_SHOPS[i - 1]!;
      drawShopFront(g, x, look, i === streetAt);
    }
    g.fillStyle = "#d9d4cc";
    g.fillRect(0, 330, 820, 24);
    g.fillStyle = "#4a4a55";
    g.fillRect(0, 354, 820, 106);
    g.fillStyle = "#ffe36e";
    for (let x = -(streetCam % 80); x < 820; x += 80) g.fillRect(x, 404, 44, 6);
    // Your car, bouncing a little while it drives.
    const moving = Math.abs(streetAt * SHOP_GAP - streetCam) > 2;
    drawCar(g, 410, 448 - (moving ? Math.abs(Math.sin(now / 70)) * 3 : 0), 0.9);
    // Arrows at the sides.
    g.fillStyle = "rgba(255, 255, 255, 0.8)";
    g.font = '900 40px "Trebuchet MS", sans-serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (streetAt > 0) g.fillText("◀", 40, 230);
    if (streetAt < count - 1) g.fillText("▶", 780, 230);
  };
  button("🏪 Back to my shop", () => openShop(), true);
  button("Go home", close);
}

function drawShopFront(g: G, x: number, look: ShopLook, here: boolean): void {
  const w = 250;
  g.fillStyle = look.wall;
  g.fillRect(x - w / 2, 110, w, 220);
  g.strokeStyle = here ? "#ff6fb5" : "rgba(0, 0, 0, 0.1)";
  g.lineWidth = here ? 5 : 2;
  g.strokeRect(x - w / 2, 110, w, 220);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 ? "#ffffff" : look.awning;
    g.fillRect(x - w / 2 + i * 25, 150, 25, 24);
  }
  g.fillStyle = "#bfe6ff";
  g.fillRect(x - w / 2 + 16, 190, 90, 90);
  g.fillRect(x + 26, 190, 90, 90);
  g.fillStyle = "#8b5a2b";
  g.fillRect(x - 22, 260, 44, 70);
  g.font = '900 17px "Trebuchet MS", sans-serif';
  const signW = Math.min(w + 20, g.measureText(look.name).width + 24);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(x - signW / 2, 116, signW, 30, 10);
  g.fill();
  g.fillStyle = darker(look.awning, 0.7);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(look.name, x, 131, w);
}

/** Somebody else's shop: look at what they made, and buy it with your coins. */
function openOtherShop(n: number): void {
  const shop = OTHER_SHOPS[n]!;
  const items = stock(shop, n);
  show(shop.name, `You have ${coins} coins. Buy something!`);
  const c = document.createElement("canvas");
  c.width = 820;
  c.height = 460;
  c.className = "shop";
  c.setAttribute("aria-label", `${shop.name}, with clothes for sale`);
  body.append(c);
  const g = c.getContext("2d")!;
  draw = (now) => drawShop(g, items, now, shop, false);
  const list = document.createElement("div");
  list.className = "price-list";
  for (const item of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pill";
    const paint = (): void => {
      b.textContent = `Buy ${designName(item)}: ${priceOf(item)} coins`;
      b.disabled = coins < priceOf(item);
    };
    paint();
    b.addEventListener("click", () => {
      if (coins < priceOf(item)) return;
      coins -= priceOf(item);
      saveCoins();
      // Your very own copy, to wear (or even sell in your shop).
      designs.push({ ...item, id: `d${Date.now()}`, name: `${designName(item)} from ${shop.name}`, sold: 0, onDisplay: false, price: undefined });
      saveDesigns();
      hooks.changed();
      noteEl.textContent = `You bought the ${designName(item)}! It's in ✏️ My designs. You have ${coins} coins left.`;
      list.querySelectorAll<HTMLButtonElement>("button").forEach((x) => x.dispatchEvent(new Event("repaint")));
    });
    b.addEventListener("repaint", paint);
    // Or sneak it out without paying... but the shop will come and get it back!
    const sneak = document.createElement("button");
    sneak.type = "button";
    sneak.className = "pill";
    sneak.textContent = "🤫 Sneak it";
    sneak.addEventListener("click", () => {
      designs.push({ ...item, id: `d${Date.now()}`, name: `${designName(item)} from ${shop.name}`, sold: 0, onDisplay: false, price: undefined, stolenFrom: shop.name });
      saveDesigns();
      hooks.changed();
      noteEl.textContent = `You sneaked the ${designName(item)}! Shh... I hope ${shop.name} doesn't notice!`;
    });
    const row = document.createElement("div");
    row.className = "price-row";
    row.append(b, sneak);
    list.append(row);
  }
  body.append(list);
  button("Back to the street", () => openStreet(n + 1), true);
}
