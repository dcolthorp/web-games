// Mineral-N-Crystal: Gem Smasher's burger place, like In-N-Out. Grab a bun,
// drop it under the stations to stack the order, and carry it to the gem at
// the counter. Built the same way as the Cat Cafe in Catch the Kitties.

export type Topping = "patty" | "cheese" | "lettuce" | "tomato";

export interface ShopCustomerArt {
  name: string;
  points: number;
  draw(g: CanvasRenderingContext2D, now: number): void;
}

export interface ShopOptions {
  canvas: HTMLCanvasElement;
  newCustomer(): ShopCustomerArt;
  /** Called when an order is served right. Returns the message to show. */
  onServed(customer: ShopCustomerArt): string;
  say(text: string): void;
}

interface Station {
  id: Topping;
  name: string;
  x: number;
  body: string;
  color: string;
}

interface Order {
  name: string;
  recipe: Topping[]; // bottom to top, on top of the bottom bun
}

interface Burger {
  x: number;
  y: number;
  layers: Topping[];
  held: boolean;
  grabDX: number;
  grabDY: number;
  drop: { id: Topping; start: number } | null;
}

const W = 960;
const H = 380;
const COUNTER_Y = 282;
const BUN_W = 92;
const LAYER_H = 14;
const MAX_LAYERS = 4;
const DROP_MS = 600;
const SERVE_X = 770;
const TRASH_X = 160;
const RED = "#d6202c";
const YELLOW = "#ffd23b";

const STATIONS: Station[] = [
  { id: "patty", name: "Lava Grill", x: 290, body: "#4a2a1a", color: "#5b3420" },
  { id: "cheese", name: "Sulfur Slicer", x: 430, body: "#c9a10a", color: YELLOW },
  { id: "lettuce", name: "Jade Garden", x: 570, body: "#1f8a4c", color: "#3fd17a" },
  { id: "tomato", name: "Jasper Chopper", x: 710, body: "#9e1b1b", color: "#e8383d" },
];

// The real In-N-Out names, made out of rocks.
const ORDERS: Order[] = [
  { name: "Hamburger", recipe: ["patty", "lettuce", "tomato"] },
  { name: "Cheeseburger", recipe: ["patty", "cheese"] },
  { name: "Double-Double", recipe: ["patty", "cheese", "patty", "cheese"] },
  { name: "Protein Style", recipe: ["lettuce", "patty", "lettuce"] },
  { name: "Crystal Classic", recipe: ["patty", "cheese", "lettuce", "tomato"] },
  { name: "Lava Stack", recipe: ["patty", "patty", "tomato"] },
];

const TOPPING_NAMES: Record<Topping, string> = {
  patty: "Lava Patty",
  cheese: "Sulfur Cheese",
  lettuce: "Jade Lettuce",
  tomato: "Jasper Tomato",
};

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// One layer of a burger, centred on (0, y) where y is the layer's bottom.
function drawTopping(g: CanvasRenderingContext2D, id: Topping, y: number): void {
  const station = STATIONS.find((s) => s.id === id)!;
  g.fillStyle = station.color;
  if (id === "patty") {
    rr(g, -BUN_W / 2 + 2, y - LAYER_H, BUN_W - 4, LAYER_H, 7);
    g.fill();
    // Glowing lava cracks, because it's a lava patty.
    g.strokeStyle = "#ff7a1f";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-30, y - 7);
    g.lineTo(-16, y - 4);
    g.lineTo(-4, y - 9);
    g.moveTo(10, y - 5);
    g.lineTo(26, y - 9);
    g.stroke();
  } else if (id === "cheese") {
    g.beginPath();
    g.moveTo(-BUN_W / 2 - 4, y - LAYER_H + 4);
    g.lineTo(BUN_W / 2 + 4, y - LAYER_H + 4);
    g.lineTo(BUN_W / 2 - 6, y);
    g.lineTo(BUN_W / 4, y + 6);
    g.lineTo(0, y);
    g.lineTo(-BUN_W / 4, y + 6);
    g.lineTo(-BUN_W / 2 + 6, y);
    g.closePath();
    g.fill();
  } else if (id === "lettuce") {
    g.beginPath();
    g.moveTo(-BUN_W / 2 - 2, y - 4);
    for (let x = -BUN_W / 2; x <= BUN_W / 2; x += 10) {
      g.quadraticCurveTo(x + 5, y + 4, x + 10, y - 4);
    }
    g.lineTo(BUN_W / 2, y - LAYER_H);
    g.lineTo(-BUN_W / 2, y - LAYER_H);
    g.closePath();
    g.fill();
  } else {
    for (const x of [-26, 0, 26]) {
      g.beginPath();
      g.ellipse(x, y - LAYER_H / 2, 15, LAYER_H / 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawBun(g: CanvasRenderingContext2D, top: boolean, y: number): void {
  g.fillStyle = "#e8a85a";
  g.strokeStyle = "#a8692a";
  g.lineWidth = 3;
  if (top) {
    g.beginPath();
    g.moveTo(-BUN_W / 2, y);
    g.quadraticCurveTo(-BUN_W / 2, y - 34, 0, y - 36);
    g.quadraticCurveTo(BUN_W / 2, y - 34, BUN_W / 2, y);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#fff4d0";
    for (const [sx, sy] of [[-20, -22], [0, -28], [18, -20], [-6, -14], [10, -12]] as const) {
      g.beginPath();
      g.ellipse(sx, y + sy, 3, 1.6, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    rr(g, -BUN_W / 2, y - 16, BUN_W, 16, [4, 4, 12, 12]);
    g.fill();
    g.stroke();
  }
}

export function createShop(options: ShopOptions): { start(): void; stop(): void } {
  const { canvas } = options;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;

  let burger: Burger | null = null;
  let customer: ShopCustomerArt | null = null;
  let order: Order = ORDERS[0]!;
  let customerX = W + 140;
  let customerState: "arriving" | "waiting" | "leaving" = "arriving";
  let running = false;
  let frameId = 0;
  let lastNow = 0;
  const floaters: { x: number; y: number; text: string; born: number }[] = [];

  function nextCustomer(): void {
    customer = options.newCustomer();
    order = ORDERS[Math.floor(Math.random() * ORDERS.length)]!;
    customerState = "arriving";
    customerX = W + 140;
  }

  function point(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function overBurger(p: { x: number; y: number }): boolean {
    if (!burger) return false;
    const top = burger.y - 16 - burger.layers.length * LAYER_H - 20;
    return Math.abs(p.x - burger.x) < BUN_W * 0.7 && p.y > top && p.y < burger.y + 16;
  }

  function down(event: PointerEvent): void {
    const p = point(event);
    if (burger && !burger.drop && overBurger(p)) {
      burger.held = true;
      burger.grabDX = p.x - burger.x;
      burger.grabDY = p.y - burger.y;
    } else if (!burger && p.x < 110 && p.y > 150) {
      burger = { x: p.x, y: p.y + 20, layers: [], held: true, grabDX: 0, grabDY: 20, drop: null };
    } else {
      return;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // fine: dragging still works without capture
    }
  }

  function move(event: PointerEvent): void {
    if (!burger?.held) return;
    const p = point(event);
    burger.x = Math.max(50, Math.min(W - 50, p.x - burger.grabDX));
    burger.y = Math.max(80, Math.min(H - 10, p.y - burger.grabDY));
  }

  function up(event: PointerEvent): void {
    if (!burger?.held) return;
    burger.held = false;
    const now = performance.now();
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // not captured
    }

    if (burger.x > SERVE_X && customerState === "waiting") {
      serve(now);
      return;
    }
    if (Math.abs(burger.x - TRASH_X) < 50 && burger.y > 150) {
      burger = null;
      options.say("Burger tossed in the bin.");
      return;
    }
    burger.y = COUNTER_Y;
    const station = STATIONS.find((s) => Math.abs(burger!.x - s.x) < 60);
    if (station) {
      burger.x = station.x;
      if (burger.layers.length >= MAX_LAYERS) {
        options.say("That burger is stacked to the top! Serve it or toss it.");
        return;
      }
      burger.drop = { id: station.id, start: now };
      options.say(`${TOPPING_NAMES[station.id]} coming up!`);
    }
  }

  function serve(now: number): void {
    if (!burger || !customer) return;
    const right = burger.layers.length === order.recipe.length && burger.layers.every((l, i) => l === order.recipe[i]);
    if (right) {
      const message = options.onServed(customer);
      floaters.push({ x: customerX, y: 90, text: message, born: now });
      options.say(message);
      customerState = "leaving";
    } else {
      options.say("That's not what I ordered! Try a fresh bun.");
      floaters.push({ x: customerX, y: 90, text: "Hmph!", born: now });
    }
    burger = null;
  }

  function drawStation(s: Station, now: number): void {
    const busy = burger?.drop?.id === s.id;
    g.fillStyle = s.body;
    rr(g, s.x - 56, 38, 112, 112, 14);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.3)";
    g.lineWidth = 4;
    g.stroke();
    // A window showing what this station makes.
    g.fillStyle = "rgba(255,255,255,0.85)";
    rr(g, s.x - 40, 50, 80, 52, 10);
    g.fill();
    g.save();
    g.translate(s.x, 86);
    g.scale(0.7, 0.7);
    drawTopping(g, s.id, 8);
    g.restore();
    if (s.id === "patty") {
      // Little flames under the grill.
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? "#ff7a1f" : YELLOW;
        const h = 8 + Math.abs(Math.sin(now / 120 + i)) * 6;
        g.beginPath();
        g.moveTo(s.x - 30 + i * 20, 116);
        g.lineTo(s.x - 24 + i * 20, 116 - h);
        g.lineTo(s.x - 18 + i * 20, 116);
        g.fill();
      }
    }
    g.fillStyle = busy ? "#6dff8a" : "#c9c9d6";
    g.beginPath();
    g.arc(s.x + 40, 118, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 13px 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.fillText(s.name, s.x, 140);
    g.fillStyle = "#555566";
    rr(g, s.x - 12, 150, 24, 22, 6);
    g.fill();
  }

  function drawBurger(b: Burger, now: number): void {
    g.save();
    g.translate(b.x, b.y - (b.held ? 8 : 0));
    drawBun(g, false, 0);
    b.layers.forEach((id, i) => drawTopping(g, id, -16 - i * LAYER_H));
    g.restore();
    // The topping falling out of the station onto the burger.
    if (b.drop) {
      const t = Math.min(1, (now - b.drop.start) / DROP_MS);
      const landY = b.y - 16 - b.layers.length * LAYER_H;
      g.save();
      g.translate(b.x, 172 + (landY - 172) * t * t);
      drawTopping(g, b.drop.id, 0);
      g.restore();
    }
  }

  // White walls, a red stripe, crossed palm trees and the yellow arrow sign.
  function drawRestaurant(): void {
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.fillStyle = RED;
    g.fillRect(0, 168, W, 14);
    for (const x of [130, 860]) {
      g.strokeStyle = "#6b4426";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x - 30, 168);
      g.quadraticCurveTo(x - 10, 80, x + 6, 30);
      g.moveTo(x + 30, 168);
      g.quadraticCurveTo(x + 10, 80, x - 6, 30);
      g.stroke();
      g.fillStyle = "#2e9e4f";
      for (const [tx, sign] of [[x + 6, 1], [x - 6, -1]] as const) {
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.ellipse(tx + sign * (10 + i * 4), 30 + (i - 1.5) * 6, 22, 6, sign * (0.3 + i * 0.35), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  function drawSign(): void {
    g.fillStyle = YELLOW;
    g.strokeStyle = "#000";
    g.lineWidth = 3;
    rr(g, 16, 8, 214, 26, 4);
    g.fill();
    g.stroke();
    // The yellow arrow pointing down at the counter.
    g.beginPath();
    g.moveTo(196, 34);
    g.lineTo(210, 34);
    g.lineTo(210, 46);
    g.lineTo(220, 46);
    g.lineTo(203, 62);
    g.lineTo(186, 46);
    g.lineTo(196, 46);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = RED;
    g.font = "900 15px 'Arial Black', Impact, sans-serif";
    g.textAlign = "left";
    g.fillText("MINERAL-N-CRYSTAL", 24, 27);
  }

  function drawScene(now: number, dt: number): void {
    drawRestaurant();

    if (customer) {
      const target = 850;
      if (customerState === "arriving") {
        customerX = Math.max(target, customerX - 420 * dt);
        if (customerX <= target) customerState = "waiting";
      } else if (customerState === "leaving") {
        customerX += 420 * dt;
        if (customerX > W + 140) nextCustomer();
      }
      g.save();
      g.translate(customerX, 222);
      customer.draw(g, now);
      g.restore();
    }

    STATIONS.forEach((s) => drawStation(s, now));
    drawSign();

    // counter
    g.fillStyle = RED;
    g.fillRect(0, COUNTER_Y, W, H - COUNTER_Y);
    g.fillStyle = "#fff";
    g.fillRect(0, COUNTER_Y, W, 10);

    // bun stack
    g.fillStyle = "#8a8aa0";
    rr(g, 20, 170, 74, 112, 10);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.fillText("BUNS", 57, 192);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = "#e8a85a";
      rr(g, 30, 205 + i * 22, 54, 16, 7);
      g.fill();
    }
    // trash bin
    g.fillStyle = "#6b6b7a";
    rr(g, TRASH_X - 28, 232, 56, 50, 6);
    g.fill();
    g.fillStyle = "#4a4a58";
    g.fillRect(TRASH_X - 34, 226, 68, 8);
    g.fillStyle = "#fff";
    g.font = "bold 11px 'Trebuchet MS', sans-serif";
    g.fillText("TOSS", TRASH_X, 262);
    // serving spot
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.setLineDash([8, 6]);
    g.lineWidth = 3;
    rr(g, SERVE_X + 6, 214, 150, 62, 12);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#fff";
    g.font = "bold 13px 'Trebuchet MS', sans-serif";
    g.fillText("Serve here", SERVE_X + 81, 304);

    // order bubble: the burger's name, then its toppings from the bottom up
    if (customer && customerState !== "leaving") {
      const bx = 762;
      g.fillStyle = "#fff";
      rr(g, bx, 8, 190, 96, 14);
      g.fill();
      g.strokeStyle = RED;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = "#000";
      g.font = "bold 15px 'Trebuchet MS', sans-serif";
      g.textAlign = "center";
      g.fillText(`"${order.name}"`, bx + 95, 30);
      g.font = "10px 'Trebuchet MS', sans-serif";
      g.fillText("bottom to top", bx + 95, 44);
      const step = 42;
      const startX = bx + 95 - ((order.recipe.length - 1) * step) / 2;
      order.recipe.forEach((id, i) => {
        const s = STATIONS.find((st) => st.id === id)!;
        const x = startX + i * step;
        g.fillStyle = s.color;
        g.beginPath();
        g.arc(x, 66, 12, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#000";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#000";
        g.font = "bold 9px 'Trebuchet MS', sans-serif";
        g.fillText(TOPPING_NAMES[id].split(" ")[1]!, x, 92);
      });
    }

    if (burger) {
      drawBurger(burger, now);
      if (burger.drop && now - burger.drop.start >= DROP_MS) {
        burger.layers.push(burger.drop.id);
        burger.drop = null;
      }
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]!;
      const age = (now - f.born) / 1400;
      if (age > 1) {
        floaters.splice(i, 1);
        continue;
      }
      g.globalAlpha = 1 - age;
      g.fillStyle = "#fff";
      g.strokeStyle = RED;
      g.lineWidth = 5;
      g.font = "bold 28px 'Trebuchet MS', sans-serif";
      g.textAlign = "center";
      g.strokeText(f.text, f.x - 80, f.y - age * 40 + 70);
      g.fillText(f.text, f.x - 80, f.y - age * 40 + 70);
      g.globalAlpha = 1;
    }
  }

  function loop(timestamp: number): void {
    if (!running) return;
    const dt = Math.min(0.1, (timestamp - lastNow) / 1000);
    lastNow = timestamp;
    drawScene(timestamp, dt);
    frameId = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  return {
    start() {
      if (running) return;
      running = true;
      if (!customer) nextCustomer();
      lastNow = performance.now();
      frameId = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frameId);
      if (burger?.held) burger.held = false;
    },
  };
}
