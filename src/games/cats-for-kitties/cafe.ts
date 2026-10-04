// The Cat Cafe machine room: grab a cup, drop it under the machines, carry it to the customer.

export type Ingredient = "coffee" | "milk" | "foam" | "tuna";

export interface CafeCustomerArt {
  title: string;
  points: number;
  draw(g: CanvasRenderingContext2D, now: number): void;
}

export interface CafeOptions {
  canvas: HTMLCanvasElement;
  newCustomer(): CafeCustomerArt;
  /** Called when a drink is served correctly. Returns the message to show. */
  onServed(customer: CafeCustomerArt): string;
  say(text: string): void;
}

interface Machine {
  id: Ingredient;
  name: string;
  x: number;
  body: string;
  layer: string;
}

interface Drink {
  name: string;
  recipe: Ingredient[]; // bottom to top
}

interface Cup {
  x: number;
  y: number;
  layers: Ingredient[];
  held: boolean;
  grabDX: number;
  grabDY: number;
  pour: { id: Ingredient; start: number } | null;
  shakeUntil: number;
}

const W = 960;
const H = 380;
const COUNTER_Y = 282;
const CUP_W = 66;
const CUP_H = 88;
const LAYER_H = 19;
const MAX_LAYERS = 4;
const POUR_MS = 750;
const SERVE_X = 770;
const TRASH_X = 160;

const MACHINES: Machine[] = [
  { id: "coffee", name: "Beanomatic", x: 290, body: "#7a4b2f", layer: "#5b3a24" },
  { id: "milk", name: "Milkinator", x: 430, body: "#6fa8ff", layer: "#fffaf0" },
  { id: "foam", name: "Foaminator", x: 570, body: "#ff8fc7", layer: "#ffc6e6" },
  { id: "tuna", name: "Tuna Sprinkler", x: 710, body: "#3fbf9f", layer: "#ff9966" },
];

const DRINKS: Drink[] = [
  { name: "Sleepy Paws", recipe: ["coffee", "milk"] },
  { name: "Cloud Cat", recipe: ["milk", "foam"] },
  { name: "Fishy Float", recipe: ["tuna", "milk", "foam"] },
  { name: "Midnight Mouse", recipe: ["coffee", "coffee", "foam"] },
  { name: "Cream Dream", recipe: ["milk", "milk", "coffee"] },
  { name: "Neapolitan", recipe: ["coffee", "milk", "foam"] },
  { name: "Whisker Whip", recipe: ["coffee", "milk", "foam", "tuna"] },
];

function layerColor(id: Ingredient): string {
  return MACHINES.find((m) => m.id === id)!.layer;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function createCafe(options: CafeOptions): { start(): void; stop(): void } {
  const { canvas } = options;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;

  let cup: Cup | null = null;
  let customer: CafeCustomerArt | null = null;
  let drink: Drink = DRINKS[0]!;
  let customerX = W + 140;
  let customerState: "arriving" | "waiting" | "leaving" = "arriving";
  let running = false;
  let frameId = 0;
  let lastNow = 0;
  const floaters: { x: number; y: number; text: string; born: number }[] = [];

  function nextCustomer(): void {
    customer = options.newCustomer();
    drink = DRINKS[Math.floor(Math.random() * DRINKS.length)]!;
    customerState = "arriving";
    customerX = W + 140;
  }

  function point(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function overCup(p: { x: number; y: number }): boolean {
    return !!cup && Math.abs(p.x - cup.x) < CUP_W * 0.7 && p.y > cup.y - CUP_H - 10 && p.y < cup.y + 16;
  }

  function down(event: PointerEvent): void {
    const p = point(event);
    if (cup && !cup.pour && overCup(p)) {
      cup.held = true;
      cup.grabDX = p.x - cup.x;
      cup.grabDY = p.y - cup.y;
    } else if (!cup && p.x < 110 && p.y > 150) {
      cup = { x: p.x, y: p.y + 40, layers: [], held: true, grabDX: 0, grabDY: 40, pour: null, shakeUntil: 0 };
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
    if (!cup?.held) return;
    const p = point(event);
    cup.x = Math.max(30, Math.min(W - 30, p.x - cup.grabDX));
    cup.y = Math.max(CUP_H + 10, Math.min(H - 10, p.y - cup.grabDY));
  }

  function up(event: PointerEvent): void {
    if (!cup?.held) return;
    cup.held = false;
    const now = performance.now();
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // not captured
    }

    if (cup.x > SERVE_X && customerState === "waiting") {
      serve(now);
      return;
    }
    if (Math.abs(cup.x - TRASH_X) < 50 && cup.y > 150) {
      cup = null;
      options.say("Cup tossed in the bin.");
      return;
    }
    cup.y = COUNTER_Y;
    const machine = MACHINES.find((m) => Math.abs(cup!.x - m.x) < 55);
    if (machine) {
      cup.x = machine.x;
      if (cup.layers.length >= MAX_LAYERS) {
        options.say("The cup is full! Serve it or toss it.");
        return;
      }
      cup.pour = { id: machine.id, start: now };
      options.say(`${machine.name} is on it!`);
    }
  }

  function serve(now: number): void {
    if (!cup || !customer) return;
    const right = cup.layers.length === drink.recipe.length && cup.layers.every((l, i) => l === drink.recipe[i]);
    if (right) {
      const message = options.onServed(customer);
      floaters.push({ x: customerX, y: 90, text: message, born: now });
      options.say(message);
      customerState = "leaving";
    } else {
      options.say("Blegh! That's not what I ordered. Try a fresh cup!");
      floaters.push({ x: customerX, y: 90, text: "Blegh!", born: now });
    }
    cup = null;
  }

  function drawMachine(m: Machine, now: number): void {
    const busy = cup?.pour?.id === m.id;
    // body
    g.fillStyle = m.body;
    rr(g, m.x - 54, 38, 108, 112, 14);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.lineWidth = 4;
    g.stroke();
    // tank window
    g.fillStyle = "rgba(255,255,255,0.35)";
    rr(g, m.x - 36, 52, 72, 48, 10);
    g.fill();
    g.fillStyle = m.layer;
    rr(g, m.x - 32, 64, 64, 32, 8);
    g.fill();
    // decorations to tell the machines apart
    g.fillStyle = "rgba(255,255,255,0.8)";
    if (m.id === "foam") {
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.arc(m.x - 24 + i * 12, 62 + Math.sin(now / 300 + i) * 3, 5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (m.id === "tuna") {
      g.fillStyle = "#ffe0cc";
      for (let i = 0; i < 6; i++) g.fillRect(m.x - 26 + i * 9, 70 + (i % 2) * 8, 4, 4);
    } else if (m.id === "coffee") {
      g.fillStyle = "#3b2314";
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.ellipse(m.x - 22 + i * 14, 80 + (i % 2) * 6, 5, 7, 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    // light
    g.fillStyle = busy ? "#6dff8a" : "#c9c9d6";
    g.beginPath();
    g.arc(m.x + 38, 118, 6, 0, Math.PI * 2);
    g.fill();
    // label
    g.fillStyle = "#fff";
    g.font = "bold 13px 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.fillText(m.name, m.x, 140);
    // spout
    g.fillStyle = "#555566";
    rr(g, m.x - 12, 150, 24, 28, 6);
    g.fill();
  }

  function drawCup(c: Cup, now: number): void {
    const shake = now < c.shakeUntil ? Math.sin(now / 25) * 4 : 0;
    g.save();
    g.translate(c.x + shake, c.y - (c.held ? 8 : 0));
    // layers
    const partial = c.pour ? Math.min(1, (now - c.pour.start) / POUR_MS) : 0;
    g.save();
    g.beginPath();
    g.moveTo(-CUP_W / 2 + 4, -CUP_H + 6);
    g.lineTo(CUP_W / 2 - 4, -CUP_H + 6);
    g.lineTo(CUP_W / 2 - 10, -4);
    g.lineTo(-CUP_W / 2 + 10, -4);
    g.closePath();
    g.clip();
    c.layers.forEach((id, i) => {
      g.fillStyle = layerColor(id);
      g.fillRect(-CUP_W / 2, -4 - (i + 1) * LAYER_H, CUP_W, LAYER_H + 1);
    });
    if (c.pour) {
      g.fillStyle = layerColor(c.pour.id);
      const h = LAYER_H * partial;
      g.fillRect(-CUP_W / 2, -4 - c.layers.length * LAYER_H - h, CUP_W, h + 1);
    }
    g.restore();
    // glass
    g.strokeStyle = "#7a2fc0";
    g.lineWidth = 5;
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath();
    g.moveTo(-CUP_W / 2, -CUP_H);
    g.lineTo(CUP_W / 2, -CUP_H);
    g.lineTo(CUP_W / 2 - 8, 0);
    g.lineTo(-CUP_W / 2 + 8, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(CUP_W / 2 - 2, -CUP_H / 2, 15, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.restore();
  }

  function drawStream(c: Cup, now: number): void {
    if (!c.pour) return;
    const t = (now - c.pour.start) / POUR_MS;
    if (t > 1) return;
    const top = c.y - 4 - (c.layers.length + t) * LAYER_H;
    g.fillStyle = layerColor(c.pour.id);
    g.fillRect(c.x - 5, 176, 10, Math.max(0, top - 176));
    if (c.pour.id === "tuna") {
      g.fillStyle = "#ffe0cc";
      for (let i = 0; i < 6; i++) g.fillRect(c.x - 12 + ((i * 7 + now / 20) % 24), 178 + ((i * 23 + now / 4) % Math.max(10, top - 178)), 3, 3);
    }
  }

  function drawScene(now: number, dt: number): void {
    // wall
    const wall = g.createLinearGradient(0, 0, 0, COUNTER_Y);
    wall.addColorStop(0, "#ffd6f1");
    wall.addColorStop(1, "#e5d1ff");
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);

    // customer (behind the counter)
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
      g.translate(customerX, 232);
      g.scale(1.05, 1.05);
      customer.draw(g, now);
      g.restore();
    }

    MACHINES.forEach((m) => drawMachine(m, now));

    // counter
    g.fillStyle = "#c98a52";
    g.fillRect(0, COUNTER_Y, W, H - COUNTER_Y);
    g.fillStyle = "#e0a870";
    g.fillRect(0, COUNTER_Y, W, 10);

    // cup dispenser
    g.fillStyle = "#8a8aa0";
    rr(g, 20, 170, 70, 112, 10);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 12px 'Trebuchet MS', sans-serif";
    g.textAlign = "center";
    g.fillText("CUPS", 55, 192);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = "rgba(255,255,255,0.7)";
      rr(g, 32, 205 + i * 22, 46, 16, 5);
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
    g.strokeStyle = "rgba(122,47,192,0.6)";
    g.setLineDash([8, 6]);
    g.lineWidth = 3;
    rr(g, SERVE_X + 6, 214, 150, 62, 12);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(74,31,110,0.8)";
    g.font = "bold 13px 'Trebuchet MS', sans-serif";
    g.fillText("Serve here", SERVE_X + 81, 300);

    // order bubble: the drink's name, then its layers from the bottom up
    if (customer && customerState !== "leaving") {
      const bx = 778;
      g.fillStyle = "#fff";
      rr(g, bx, 8, 174, 96, 14);
      g.fill();
      g.strokeStyle = "#7a2fc0";
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = "#4a1f6e";
      g.font = "bold 15px 'Trebuchet MS', sans-serif";
      g.textAlign = "center";
      g.fillText(`"${drink.name}"`, bx + 87, 30);
      g.font = "10px 'Trebuchet MS', sans-serif";
      g.fillText("bottom to top", bx + 87, 44);
      const step = 40;
      const startX = bx + 87 - ((drink.recipe.length - 1) * step) / 2;
      drink.recipe.forEach((id, i) => {
        const m = MACHINES.find((mm) => mm.id === id)!;
        const x = startX + i * step;
        g.fillStyle = m.layer;
        g.beginPath();
        g.arc(x, 66, 12, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#7a2fc0";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#4a1f6e";
        g.font = "bold 10px 'Trebuchet MS', sans-serif";
        g.fillText(m.name.split(" ")[0]!.slice(0, 5), x, 92);
      });
    }

    if (cup) {
      drawStream(cup, now);
      drawCup(cup, now);
      if (cup.pour && now - cup.pour.start >= POUR_MS) {
        cup.layers.push(cup.pour.id);
        cup.pour = null;
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
      g.strokeStyle = "#7a2fc0";
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
      if (cup?.held) cup.held = false;
    },
  };
}
