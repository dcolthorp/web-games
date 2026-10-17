import { makeModels } from "./models";
import { buildModel, drawModel } from "./render3d";
import { playSound } from "./sounds";
import { formatMoney, save, state } from "./state";

// The invention games: click something you built at the Engineering Station
// and it opens its own game.
//   Bubble Machine -> Bubble Pop: pop as many bubbles as you can in 30 seconds.
//   Robot Dog      -> Feed Your Robot Dog: feed it bits and it grows up (and up).
//   Hoverboard     -> Hoverboard Dash: jump over saws, spikes, holes and worse.
//   Jetpack        -> Jetpack Climb: only up! Hide under the beams. Reach the
//                     top for the Sky Key, which you'll need to beat the game.
// Prizes go into your city money (state.ts), and best scores are saved too.

export type ArcadeGame = "bubbles" | "dog" | "hover" | "jet";

const W = 900;
const H = 520;

interface Game {
  title: string;
  help: string;
  /** Games that keep going forever (the robot dog) have no start button. */
  endless?: boolean;
  start(now: number): void;
  update(now: number, dt: number): void;
  draw(now: number): void;
  press(x: number, y: number, now: number): void;
  release(): void;
  over(): boolean;
}

// ---- The page bits ----

const host = document.createElement("section");
host.className = "arcade";
host.hidden = true;
host.innerHTML = `
  <div class="race-card">
    <h2 class="arcade-title"></h2>
    <canvas width="${W}" height="${H}"></canvas>
    <p class="race-message" aria-live="polite"></p>
    <div class="race-controls">
      <button class="pill pill-main arcade-start" type="button">Start!</button>
      <button class="pill arcade-close" type="button">Back to the boxes</button>
    </div>
  </div>`;
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const titleEl = host.querySelector<HTMLElement>(".arcade-title")!;
const messageEl = host.querySelector<HTMLElement>(".race-message")!;
const startButton = host.querySelector<HTMLButtonElement>(".arcade-start")!;
host.querySelector(".arcade-close")!.addEventListener("click", closeArcade);

let game: Game | null = null;
let playing = false;
let running = false;
let last = 0;
let hooks: { addToShelf: (thing: string) => void } = { addToShelf: () => {} };

function say(text: string): void {
  messageEl.textContent = text;
}

function startGame(): void {
  if (!game) return;
  playing = true;
  startButton.hidden = true;
  game.start(performance.now());
  canvas.focus();
}

/** Called by a game when it's over: hands out the prize and shows the start button again. */
function finish(text: string, prize: number): void {
  playing = false;
  if (prize > 0) {
    state.money += prize;
    save();
  }
  say(prize > 0 ? `${text} You won ${formatMoney(prize)}!` : text);
  startButton.hidden = false;
  startButton.textContent = "Play again!";
}

startButton.addEventListener("click", startGame);

function text(t: string, x: number, y: number, size: number, color = "#ffffff", align: CanvasTextAlign = "center"): void {
  ctx.font = `800 ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}

function hud(lines: string[]): void {
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.roundRect(12, 12, 230, 18 + lines.length * 22, 12);
  ctx.fill();
  lines.forEach((l, i) => text(l, 24, 32 + i * 22, 17, "#4a1f6e", "left"));
}

function sprite(thing: string, size: number, yaw: number, pitch = -0.15): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = Math.ceil(size * 3);
  drawModel(c.getContext("2d")!, buildModel(makeModels(thing)[0]!.parts), c.width / 2, c.height / 2, size, yaw, pitch);
  return c;
}

// ---- Bubble Pop ----

const BUBBLE_MS = 30_000;
const BUBBLE_PAY = 5_000;

const bubbleGame = ((): Game => {
  let endAt = 0;
  let score = 0;
  let nextAt = 0;
  let bubbles: { x: number; y: number; r: number; speed: number; gold: boolean; wob: number }[] = [];
  let pops: { x: number; y: number; r: number; at: number; gold: boolean }[] = [];
  return {
    title: "Bubble Pop",
    help: "Pop as many bubbles as you can before the timer runs out! Gold bubbles are worth 5.",
    start(now) {
      endAt = now + BUBBLE_MS;
      score = 0;
      bubbles = [];
      pops = [];
      nextAt = now;
    },
    update(now, dt) {
      if (!playing) return;
      if (now > nextAt) {
        bubbles.push({
          x: 40 + Math.random() * (W - 80),
          y: H + 40,
          r: 18 + Math.random() * 24,
          speed: 70 + Math.random() * 90 + (1 - (endAt - now) / BUBBLE_MS) * 80,
          gold: Math.random() < 0.08,
          wob: Math.random() * 6,
        });
        nextAt = now + 260 + Math.random() * 200;
      }
      for (const b of bubbles) b.y -= b.speed * dt;
      bubbles = bubbles.filter((b) => b.y > -60);
      if (now > endAt) {
        if (score > state.best.bubbles) state.best.bubbles = score;
        finish(`Time's up! You popped ${score} bubbles. (Best: ${state.best.bubbles})`, score * BUBBLE_PAY);
      }
    },
    draw(now) {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#7fd0f0");
      sky.addColorStop(1, "#2a7ac8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      for (const b of bubbles) {
        const x = b.x + Math.sin(now / 400 + b.wob) * 10;
        ctx.fillStyle = b.gold ? "rgba(255, 220, 80, 0.55)" : "rgba(255, 255, 255, 0.25)";
        ctx.strokeStyle = b.gold ? "#f2c230" : "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      pops = pops.filter((p) => now - p.at < 300);
      for (const p of pops) {
        const k = (now - p.at) / 300;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - k})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * p.r * (0.6 + k), p.y + Math.sin(a) * p.r * (0.6 + k));
          ctx.lineTo(p.x + Math.cos(a) * p.r * (1 + k), p.y + Math.sin(a) * p.r * (1 + k));
          ctx.stroke();
        }
      }
      if (playing) hud([`Popped: ${score}`, `Time: ${Math.max(0, Math.ceil((endAt - now) / 1000))}`]);
    },
    press(x, y, now) {
      if (!playing) return;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]!;
        const bx = b.x + Math.sin(now / 400 + b.wob) * 10;
        if (Math.hypot(x - bx, y - b.y) < b.r + 6) {
          bubbles.splice(i, 1);
          score += b.gold ? 5 : 1;
          pops.push({ x: bx, y: b.y, r: b.r, at: now, gold: b.gold });
          playSound(b.gold ? "magic" : "blub");
          return;
        }
      }
    },
    release() {},
    over: () => !playing,
  };
})();

// ---- Feed Your Robot Dog ----

const DOG_STAGES = [
  { name: "Robo Puppy", need: 5, size: 70, color: "silver" },
  { name: "Robo Pup", need: 10, size: 90, color: "blue" },
  { name: "Robo Dog", need: 15, size: 110, color: "purple" },
  { name: "Big Robo Dog", need: 25, size: 135, color: "green" },
  { name: "Mega Robo Dog", need: 40, size: 160, color: "red" },
  { name: "GIANT MECHA DOG", need: Infinity, size: 190, color: "gold" },
];
const BITS = ["gear", "bolt", "battery", "spring", "wheel"] as const;
const BIT_COLORS: Record<(typeof BITS)[number], string> = {
  gear: "#a9adb5",
  bolt: "#b9a46a",
  battery: "#4cc76a",
  spring: "#c9ced6",
  wheel: "#2b2b33",
};

const dogGame = ((): Game => {
  const pictures = new Map<number, HTMLCanvasElement>();
  let flying: { bit: (typeof BITS)[number]; from: [number, number]; at: number } | null = null;
  let grewAt = -9999;
  let chompAt = -9999;
  const dogAt: [number, number] = [W / 2, 250];
  const picture = (stage: number): HTMLCanvasElement => {
    let p = pictures.get(stage);
    if (!p) {
      const s = DOG_STAGES[stage]!;
      p = sprite(`${s.color} robot dog`, s.size, Math.PI / 2 - 0.5, -0.2);
      pictures.set(stage, p);
    }
    return p;
  };
  const bitSpot = (i: number): [number, number] => [190 + i * 130, 462];
  return {
    title: "Feed Your Robot Dog",
    help: "Click the mechanical bits to feed your robot dog. Feed it enough and it grows up!",
    endless: true,
    start() {},
    update(now) {
      if (flying && now - flying.at > 450) {
        flying = null;
        chompAt = now;
        playSound("chomp");
        const stage = DOG_STAGES[state.dog.stage]!;
        state.dog.food++;
        if (state.dog.food >= stage.need && state.dog.stage < DOG_STAGES.length - 1) {
          state.dog.stage++;
          state.dog.food = 0;
          grewAt = now;
          playSound("levelup");
          const next = DOG_STAGES[state.dog.stage]!;
          say(
            state.dog.stage === DOG_STAGES.length - 1
              ? `WHOA! Your robot dog grew into a ${next.name}! It's as big as it gets!`
              : `Your robot dog grew up into a ${next.name}!`,
          );
        }
        save();
      }
    },
    draw(now) {
      ctx.fillStyle = "#fff6dc";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#c9965f";
      ctx.fillRect(0, 400, W, H - 400);
      const stage = DOG_STAGES[state.dog.stage]!;
      const img = picture(state.dog.stage);
      // It bounces when it eats, and glows when it grows.
      const grow = Math.max(0, 1 - (now - grewAt) / 1200);
      const chomp = Math.max(0, 1 - (now - chompAt) / 300);
      if (grow > 0) {
        ctx.fillStyle = `rgba(255, 230, 110, ${grow * 0.6})`;
        ctx.beginPath();
        ctx.arc(dogAt[0], dogAt[1], 120 + (1 - grow) * 200, 0, Math.PI * 2);
        ctx.fill();
      }
      const bob = Math.sin(now / 300) * 4 - chomp * 18;
      ctx.drawImage(img, dogAt[0] - img.width / 2, dogAt[1] - img.height / 2 + bob);
      if (flying) {
        const k = Math.min(1, (now - flying.at) / 450);
        const x = flying.from[0] + (dogAt[0] + 40 - flying.from[0]) * k;
        const y = flying.from[1] + (dogAt[1] - 20 - flying.from[1]) * k - Math.sin(k * Math.PI) * 120;
        drawBit(flying.bit, x, y, 20);
      }
      // The bits to feed it.
      BITS.forEach((bit, i) => {
        const [x, y] = bitSpot(i);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(x - 44, y - 40, 88, 72, 12);
        ctx.fill();
        drawBit(bit, x, y - 8, 22);
        text(bit, x, y + 22, 12, "#4a1f6e");
      });
      // How full it is.
      const last = state.dog.stage === DOG_STAGES.length - 1;
      hud([stage.name, last ? "All grown up!" : `Food: ${state.dog.food}/${stage.need}`]);
      if (!last) {
        ctx.fillStyle = "#e2c8ff";
        ctx.fillRect(24, 64 + 20, 200, 10);
        ctx.fillStyle = "#ff6fb5";
        ctx.fillRect(24, 64 + 20, (200 * state.dog.food) / stage.need, 10);
      }
    },
    press(x, y, now) {
      if (flying) return;
      const i = BITS.findIndex((_, k) => Math.abs(x - bitSpot(k)[0]) < 44 && Math.abs(y - bitSpot(k)[1]) < 40);
      if (i < 0) return;
      flying = { bit: BITS[i]!, from: bitSpot(i), at: now };
    },
    release() {},
    over: () => false,
  };
})();

function drawBit(bit: (typeof BITS)[number], x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = BIT_COLORS[bit];
  ctx.strokeStyle = BIT_COLORS[bit];
  ctx.lineWidth = 4;
  if (bit === "gear") {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? s * 0.62 : s * 0.85;
      const a = (i / 16) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
  } else if (bit === "bolt") {
    ctx.fillRect(-s * 0.4, -s * 0.6, s * 0.8, s * 0.3);
    ctx.fillRect(-s * 0.15, -s * 0.3, s * 0.3, s);
  } else if (bit === "battery") {
    ctx.fillRect(-s * 0.4, -s * 0.7, s * 0.8, s * 1.4);
  } else if (bit === "spring") {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo((i % 2 ? 1 : -1) * s * 0.4, -s * 0.8 + (i / 8) * s * 1.6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9ced6";
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- Hoverboard Dash ----

const GROUND = 430;
const PLAYER_X = 170;
const HOVER_PAY = 2_000; // per metre

type Hazard = { kind: "saw" | "spikes" | "hole" | "trap" | "dog" | "blower"; x: number; w: number; h: number };

const hoverGame = ((): Game => {
  let rider: HTMLCanvasElement | null = null;
  let board: HTMLCanvasElement | null = null;
  let y = 0; // how high you are off the ground (0 = riding)
  let vy = 0;
  let distance = 0;
  let speed = 0;
  let nextAt = 0;
  let hazards: Hazard[] = [];
  let bubbles: { x: number; y: number; r: number }[] = [];
  let popped = 0;
  let crashed = false;
  let falling = false;
  const jump = (): void => {
    if (!playing || y > 0 || falling) return;
    vy = 640;
    playSound("boing");
  };
  return {
    title: "Hoverboard Dash",
    help: "Press space, the up arrow, or click to jump! Jump over saws, spikes, holes, death traps, robot dogs and bubble blowers.",
    start() {
      rider ??= sprite("me", 34, 0, -0.1);
      board ??= sprite("hoverboard", 34, 0, -0.1);
      y = 0;
      vy = 0;
      distance = 0;
      speed = 300;
      nextAt = 500;
      hazards = [];
      bubbles = [];
      popped = 0;
      crashed = false;
      falling = false;
    },
    update(_now, dt) {
      if (!playing) return;
      speed = Math.min(560, speed + dt * 12);
      distance += speed * dt;
      for (const h of hazards) h.x -= speed * dt;
      for (const b of bubbles) {
        b.x -= speed * dt;
        b.y -= 70 * dt;
      }
      hazards = hazards.filter((h) => h.x + h.w > -50);
      bubbles = bubbles.filter((b) => b.x > -40 && b.y > -40);
      if (distance > nextAt) {
        const kinds: Hazard["kind"][] = ["saw", "spikes", "hole", "trap", "dog", "blower"];
        const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
        const sizes: Record<Hazard["kind"], [number, number]> = {
          saw: [50, 50],
          spikes: [70, 30],
          hole: [80, 0],
          trap: [56, 36],
          dog: [50, 40],
          blower: [44, 34],
        };
        const [w, h] = sizes[kind];
        hazards.push({ kind, x: W + 40, w, h });
        nextAt = distance + 320 + Math.random() * 360 + speed * 0.3;
      }
      // Bubble blowers blow bubbles up into the air.
      for (const h of hazards) {
        if (h.kind === "blower" && Math.random() < dt * 4) bubbles.push({ x: h.x + h.w / 2, y: GROUND - h.h - 10, r: 12 + Math.random() * 8 });
      }
      // Jumping and landing.
      if (y > 0 || vy > 0) {
        vy -= 1800 * dt;
        y = Math.max(0, y + vy * dt);
        if (y === 0) vy = 0;
      }
      const left = PLAYER_X - 22;
      const right = PLAYER_X + 22;
      const feet = GROUND - y;
      for (const h of hazards) {
        if (h.x > right || h.x + h.w < left) continue;
        if (h.kind === "hole") {
          if (y === 0 && h.x < PLAYER_X - 10 && h.x + h.w > PLAYER_X + 10) falling = true;
        } else if (feet > GROUND - h.h) {
          crashed = true;
        }
      }
      // Bubbles in your way just pop.
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]!;
        if (Math.abs(b.x - PLAYER_X) < b.r + 20 && Math.abs(b.y - (feet - 40)) < b.r + 40) {
          bubbles.splice(i, 1);
          popped++;
          playSound("blub");
        }
      }
      if (falling) y -= 400 * dt;
      if (crashed || y < -120) {
        const metres = Math.floor(distance / 30) + popped * 5;
        if (metres > state.best.hover) state.best.hover = metres;
        playSound("boom");
        finish(
          `${falling ? "You fell in a hole!" : "CRASH!"} You went ${metres} metres (with ${popped} bubbles popped). (Best: ${state.best.hover})`,
          metres * HOVER_PAY,
        );
      }
    },
    draw(now) {
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
      sky.addColorStop(0, "#8fd0ff");
      sky.addColorStop(1, "#e8f6ff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = "#b6c8e6";
      for (let i = 0; i < 10; i++) {
        const x = ((i * 160 - distance * 0.2) % (W + 160) + W + 160) % (W + 160) - 120;
        ctx.fillRect(x, GROUND - 120 - ((i * 37) % 90), 100, 220);
      }
      ctx.fillStyle = "#5d626c";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#ffe36e";
      for (let x = -(distance % 80); x < W; x += 80) ctx.fillRect(x, GROUND + 40, 40, 6);
      for (const h of hazards) drawHazard(h, now);
      for (const b of bubbles) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.fillStyle = "rgba(191, 230, 255, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (rider && board) {
        const hover = Math.sin(now / 150) * 3;
        const feet = GROUND - y - 8 + hover;
        ctx.drawImage(board, PLAYER_X - board.width / 2, feet - board.height / 2);
        ctx.drawImage(rider, PLAYER_X - rider.width / 2, feet - rider.height * 0.8);
      }
      if (playing) hud([`Distance: ${Math.floor(distance / 30)} m`, `Bubbles popped: ${popped}`]);
    },
    press: () => jump(),
    release() {},
    over: () => !playing,
  };
})();

function drawHazard(h: Hazard, now: number): void {
  const top = GROUND - h.h;
  if (h.kind === "hole") {
    ctx.fillStyle = "#1e1236";
    ctx.fillRect(h.x, GROUND, h.w, H - GROUND);
    return;
  }
  if (h.kind === "saw") {
    // A spinning saw blade.
    ctx.save();
    ctx.translate(h.x + h.w / 2, GROUND - h.h / 2);
    ctx.rotate(-now / 80);
    ctx.fillStyle = "#c9ced6";
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const r = i % 2 ? h.w * 0.38 : h.w * 0.5;
      const a = (i / 20) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = "#5d626c";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (h.kind === "spikes") {
    ctx.fillStyle = "#7d8794";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(h.x + i * (h.w / 5), GROUND);
      ctx.lineTo(h.x + (i + 0.5) * (h.w / 5), top);
      ctx.lineTo(h.x + (i + 1) * (h.w / 5), GROUND);
      ctx.fill();
    }
  } else if (h.kind === "trap") {
    // A chomping mechanical death trap.
    const open = Math.abs(Math.sin(now / 250)) * 0.6;
    ctx.fillStyle = "#5d626c";
    ctx.fillRect(h.x, GROUND - 8, h.w, 8);
    ctx.fillStyle = "#e8383d";
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(h.x + h.w / 2, GROUND - 8);
      ctx.rotate(side * open);
      ctx.beginPath();
      ctx.moveTo(-side * 2, 0);
      for (let i = 0; i <= 4; i++) ctx.lineTo(side * (4 + (i % 2) * 8), -i * (h.h / 4));
      ctx.lineTo(-side * 2, -h.h);
      ctx.fill();
      ctx.restore();
    }
  } else if (h.kind === "dog") {
    // A little robot dog walking at you.
    ctx.fillStyle = "#a9b4c2";
    ctx.fillRect(h.x + 6, top + 8, h.w - 12, h.h - 18);
    ctx.fillRect(h.x - 4, top, 18, 18);
    ctx.fillStyle = "#5fe0ff";
    ctx.fillRect(h.x - 1, top + 5, 4, 4);
    ctx.fillStyle = "#7d8794";
    const step = Math.sin(now / 80) * 3;
    ctx.fillRect(h.x + 10, GROUND - 10, 5, 10 + step);
    ctx.fillRect(h.x + h.w - 15, GROUND - 10, 5, 10 - step);
  } else {
    // A bubble blower, pointing up.
    ctx.fillStyle = "#4a9bff";
    ctx.fillRect(h.x, top + 10, h.w, h.h - 10);
    ctx.fillStyle = "#ffe36e";
    ctx.beginPath();
    ctx.ellipse(h.x + h.w / 2, top + 8, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Jetpack Climb ----

const JET_MS = 60_000;
const GOAL = 6000; // how high the top is
const JET_PAY = 3_000; // per metre
const PER_METRE = 3;

const jetGame = ((): Game => {
  let flyer: HTMLCanvasElement | null = null;
  let height = 0;
  let vy = 0;
  let holding = false;
  let endAt = 0;
  let beams: { at: number; from: -1 | 1; x: number; started: boolean }[] = [];
  let crashed = false;
  let won = false;
  const BEAM_W = 520;
  const BEAM_H = 26;
  const ME_Y = 360; // where you are on screen
  return {
    title: "Jetpack Climb",
    help: "Hold space, the up arrow, or the mouse to fly up. Let go to drop. When a beam slides across above you, wait under it until it's gone! Reach the top before time runs out.",
    start(now) {
      flyer ??= sprite("jetpack", 30, Math.PI / 2, -0.1);
      height = 0;
      vy = 0;
      endAt = now + JET_MS;
      crashed = false;
      won = false;
      beams = [];
      for (let at = 500; at < GOAL - 200; at += 380 + Math.random() * 260) {
        beams.push({ at, from: Math.random() < 0.5 ? -1 : 1, x: 0, started: false });
      }
    },
    update(now, dt) {
      if (!playing) return;
      vy += (holding ? 900 : -700) * dt;
      vy = Math.max(-420, Math.min(380, vy));
      height = Math.max(0, height + vy * dt);
      if (height === 0 && vy < 0) vy = 0;
      for (const b of beams) {
        // A beam starts sliding across once you get close underneath it.
        if (!b.started && height > b.at - 420) {
          b.started = true;
          b.x = b.from < 0 ? -BEAM_W : W;
        }
        if (b.started) b.x += -b.from * 230 * dt;
        const screenY = ME_Y - (b.at - height);
        const overMe = b.x < W / 2 + 18 && b.x + BEAM_W > W / 2 - 18;
        if (overMe && Math.abs(screenY - ME_Y) < BEAM_H / 2 + 26) crashed = true;
      }
      const metres = Math.floor(height / PER_METRE);
      if (height >= GOAL) {
        won = true;
        const first = !state.skyKey;
        state.skyKey = true;
        state.best.jet = Math.max(state.best.jet, metres);
        if (first) hooks.addToShelf("sky key");
        playSound("levelup");
        finish(
          first
            ? "You made it to the TOP! You found the SKY KEY! Keep it safe: you'll need it to beat the game. (It's on your shelf.)"
            : "You made it to the top again!",
          metres * JET_PAY,
        );
      } else if (crashed || now > endAt) {
        if (metres > state.best.jet) state.best.jet = metres;
        playSound(crashed ? "boom" : "bell");
        finish(`${crashed ? "BONK! You hit a beam!" : "Time's up!"} You flew ${metres} metres high. (Best: ${state.best.jet})`, metres * JET_PAY);
      }
    },
    draw(now) {
      // The sky gets darker the higher you go, until it's space.
      const k = Math.min(1, height / GOAL);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mix("#8fd0ff", "#0a0a2a", k));
      sky.addColorStop(1, mix("#e8f6ff", "#2a1a5a", k));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255, 255, 255, ${k})`;
      for (let i = 0; i < 50; i++) ctx.fillRect((i * 173) % W, ((i * 97 + height * 0.2) % H + H) % H, 2, 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let i = 0; i < 6; i++) {
        const y = ((i * 260 + height * 0.6) % (H + 200)) - 100;
        ctx.beginPath();
        ctx.ellipse((i * 211) % W, y, 70, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The ground, when you're near it, and the finish line at the top.
      const groundY = ME_Y + 40 + height;
      if (groundY < H) {
        ctx.fillStyle = "#6fc45a";
        ctx.fillRect(0, groundY, W, H - groundY);
      }
      const topY = ME_Y - (GOAL - height);
      if (topY > -20) {
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = i % 2 ? "#ffffff" : "#24222b";
          ctx.fillRect(i * 30, topY - 10, 30, 20);
        }
        text("THE TOP!", W / 2, topY - 30, 26, "#ffe36e");
      }
      for (const b of beams) {
        if (!b.started) continue;
        const y = ME_Y - (b.at - height);
        if (y < -40 || y > H + 40) continue;
        ctx.fillStyle = "#7d8794";
        ctx.fillRect(b.x, y - BEAM_H / 2, BEAM_W, BEAM_H);
        ctx.fillStyle = "#ffd23f";
        for (let x = b.x; x < b.x + BEAM_W; x += 40) ctx.fillRect(x, y - BEAM_H / 2, 20, 6);
      }
      if (flyer) {
        if (holding && playing) {
          ctx.fillStyle = "#ff9226";
          for (const dx of [-10, 10]) {
            ctx.beginPath();
            ctx.moveTo(W / 2 + dx - 7, ME_Y + 26);
            ctx.lineTo(W / 2 + dx + 7, ME_Y + 26);
            ctx.lineTo(W / 2 + dx, ME_Y + 50 + Math.random() * 14);
            ctx.fill();
          }
        }
        ctx.drawImage(flyer, W / 2 - flyer.width / 2, ME_Y - flyer.height / 2);
      }
      // A meter on the side showing how close you are to the top.
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(W - 40, 40, 14, H - 80);
      ctx.fillStyle = "#ffe36e";
      ctx.fillRect(W - 40, 40 + (H - 80) * (1 - k), 14, (H - 80) * k);
      if (playing) {
        hud([`Height: ${Math.floor(height / PER_METRE)} m / ${GOAL / PER_METRE} m`, `Time: ${Math.max(0, Math.ceil((endAt - now) / 1000))}`]);
      }
      if (won) text("YOU MADE IT!", W / 2, 120, 48, "#ffe36e");
    },
    press() {
      holding = true;
    },
    release() {
      holding = false;
    },
    over: () => !playing,
  };
})();

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

const GAMES: Record<ArcadeGame, Game> = { bubbles: bubbleGame, dog: dogGame, hover: hoverGame, jet: jetGame };

// ---- Running it ----

function loop(now: number): void {
  if (!running || !game) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(now, dt);
  game.draw(now);
  requestAnimationFrame(loop);
}

const toCanvas = (e: PointerEvent): { x: number; y: number } => {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
};
canvas.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e);
  canvas.setPointerCapture(e.pointerId);
  game?.press(p.x, p.y, performance.now());
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => game?.release());

const ACTION_KEYS = [" ", "ArrowUp", "w"];
window.addEventListener("keydown", (e) => {
  if (host.hidden) return;
  if (e.key === "Escape") return closeArcade();
  if (!ACTION_KEYS.includes(e.key) || e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  if (!e.repeat) game?.press(-1, -1, performance.now());
});
window.addEventListener("keyup", (e) => {
  if (!host.hidden && ACTION_KEYS.includes(e.key)) game?.release();
});

/** Opens one of the invention games. */
export function openArcade(id: ArcadeGame, roomHooks: { addToShelf: (thing: string) => void }): void {
  hooks = roomHooks;
  game = GAMES[id];
  playing = false;
  titleEl.textContent = game.title;
  say(game.help);
  host.setAttribute("aria-label", game.title);
  canvas.setAttribute("aria-label", game.title);
  startButton.textContent = "Start!";
  startButton.hidden = !!game.endless;
  game.start(performance.now());
  if (game.endless) playing = true;
  host.hidden = false;
  (game.endless ? host.querySelector<HTMLButtonElement>(".arcade-close")! : startButton).focus();
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}

function closeArcade(): void {
  save();
  host.hidden = true;
  running = false;
  playing = false;
  game?.release();
}
