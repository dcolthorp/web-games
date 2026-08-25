import { fartImpulse, wrap, wrappedCopies } from "./physics";

const canvas = document.querySelector<HTMLCanvasElement>("#farttopia")!;
const context = canvas.getContext("2d")!;
const chargeFill = document.querySelector<HTMLElement>("#charge-fill")!;
const fartCount = document.querySelector<HTMLElement>("#fart-count")!;

const W = canvas.width;
const H = canvas.height;

/** Gentle enough that a good fart beats it; you sink, you don't plummet. */
const GRAVITY = 300;
/** Air is thick in Farttopia. Fraction of speed kept per second. */
const DRAG = 0.42;
const MAX_CHARGE = 1.15;
const MIN_PUSH = 200;
const MAX_PUSH = 880;
const AIM_SPEED = 3.1;
const PLAYER_R = 15;

const player = { x: W / 2, y: H / 2, vx: 0, vy: 0, aim: -Math.PI / 2, lean: 0 };
let charge = 0;
let charging = false;
let farts = 0;
let lastFrame = 0;
let audio: AudioContext | null = null;

type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };
const puffs: Puff[] = [];

type Cloud = { x: number; y: number; r: number; drift: number; tone: number };
const clouds: Cloud[] = Array.from({ length: 14 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: 40 + Math.random() * 90,
  drift: 4 + Math.random() * 12,
  tone: 0.5 + Math.random() * 0.5,
}));

const keys = new Set<string>();

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault();
  if (key === " " && !event.repeat) startCharging();
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);
  if (key === " ") releaseFart();
});

// Losing focus mid-squeeze shouldn't leave the charge stuck on forever.
window.addEventListener("blur", () => {
  keys.clear();
  charging = false;
  charge = 0;
});

function startCharging(): void {
  charging = true;
  charge = 0;
}

function releaseFart(): void {
  if (!charging) return;
  charging = false;
  const power = charge / MAX_CHARGE;
  const push = fartImpulse(charge, MAX_CHARGE, MIN_PUSH, MAX_PUSH);
  // You go where you point; the gas goes the other way.
  player.vx += Math.cos(player.aim) * push;
  player.vy += Math.sin(player.aim) * push;
  player.lean = 1;
  spawnPuffs(power);
  playFart(power);
  farts += 1;
  fartCount.textContent = `FARTS ${farts}`;
  charge = 0;
}

function spawnPuffs(power: number): void {
  const back = player.aim + Math.PI;
  const count = 8 + Math.round(power * 16);
  for (let i = 0; i < count; i += 1) {
    const spread = (Math.random() - 0.5) * 0.9;
    const speed = 60 + Math.random() * (110 + power * 260);
    const angle = back + spread;
    puffs.push({
      x: player.x + Math.cos(back) * PLAYER_R,
      y: player.y + Math.sin(back) * PLAYER_R,
      vx: Math.cos(angle) * speed + player.vx * 0.2,
      vy: Math.sin(angle) * speed + player.vy * 0.2,
      life: 0,
      max: 0.5 + Math.random() * (0.5 + power),
      r: 4 + Math.random() * (6 + power * 12),
    });
  }
}

/** A short filtered noise burst. Bigger charge, lower and longer. */
function playFart(power: number): void {
  const Ctor = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  audio ??= new Ctor();
  const now = audio.currentTime;
  const duration = 0.16 + power * 0.42;
  const frames = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  // Noise with a wobble, so it flutters instead of hissing.
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const wobble = Math.sin(t * (34 + power * 26) * Math.PI * 2) * 0.5 + 0.5;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (0.35 + wobble * 0.65);
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900 - power * 420, now);
  filter.Q.value = 7;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25 + power * 0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start(now);
  source.stop(now + duration);
}

function update(dt: number): void {
  if (keys.has("arrowleft") || keys.has("a")) player.aim -= AIM_SPEED * dt;
  if (keys.has("arrowright") || keys.has("d")) player.aim += AIM_SPEED * dt;

  if (charging) charge = Math.min(MAX_CHARGE, charge + dt);
  chargeFill.style.width = `${(charge / MAX_CHARGE) * 100}%`;

  player.vy += GRAVITY * dt;
  const keep = DRAG ** dt;
  player.vx *= keep;
  player.vy *= keep;
  player.x = wrap(player.x + player.vx * dt, W);
  player.y = wrap(player.y + player.vy * dt, H);
  player.lean = Math.max(0, player.lean - dt * 2.6);

  for (let i = puffs.length - 1; i >= 0; i -= 1) {
    const puff = puffs[i]!;
    puff.life += dt;
    if (puff.life >= puff.max) {
      puffs.splice(i, 1);
      continue;
    }
    puff.vy -= 26 * dt; // stink rises
    puff.vx *= 0.985;
    puff.vy *= 0.985;
    puff.x = wrap(puff.x + puff.vx * dt, W);
    puff.y = wrap(puff.y + puff.vy * dt, H);
    puff.r += dt * 22;
  }

  for (const cloud of clouds) cloud.x = wrap(cloud.x + cloud.drift * dt, W);
}

/**
 * Draw once per wrapped copy. Anything within a margin of an edge is painted
 * again on the far side, so crossing over looks continuous instead of like the
 * sprite vanishing into a wall.
 */
function eachWrapped(x: number, y: number, margin: number, draw: (dx: number, dy: number) => void): void {
  for (const copy of wrappedCopies(x, y, margin, W, H)) draw(copy.x, copy.y);
}

function drawBackground(): void {
  const sky = context.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#3e2a5c");
  sky.addColorStop(1, "#16323a");
  context.fillStyle = sky;
  context.fillRect(0, 0, W, H);

  for (const cloud of clouds) {
    eachWrapped(cloud.x, cloud.y, cloud.r + 10, (x, y) => {
      const glow = context.createRadialGradient(x, y, 0, x, y, cloud.r);
      glow.addColorStop(0, `rgba(150, 220, 130, ${0.16 * cloud.tone})`);
      glow.addColorStop(1, "rgba(150, 220, 130, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(x, y, cloud.r, 0, Math.PI * 2);
      context.fill();
    });
  }
}

function drawPuffs(): void {
  for (const puff of puffs) {
    const t = puff.life / puff.max;
    eachWrapped(puff.x, puff.y, puff.r + 10, (x, y) => {
      context.fillStyle = `rgba(164, 214, 106, ${(1 - t) * 0.42})`;
      context.beginPath();
      context.arc(x, y, puff.r, 0, Math.PI * 2);
      context.fill();
    });
  }
}

function drawPlayer(): void {
  eachWrapped(player.x, player.y, 70, (x, y) => {
    context.save();
    context.translate(x, y);

    // Aim pointer: where the next fart will send you. Grows as you squeeze.
    const power = charge / MAX_CHARGE;
    const reach = 30 + power * 62;
    context.rotate(player.aim);
    context.strokeStyle = charging ? `rgba(255, 236, 120, ${0.55 + power * 0.45})` : "rgba(255, 255, 255, 0.32)";
    context.lineWidth = charging ? 3 + power * 3 : 2;
    context.setLineDash([7, 6]);
    context.beginPath();
    context.moveTo(PLAYER_R + 4, 0);
    context.lineTo(reach, 0);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(reach + 9, 0);
    context.lineTo(reach - 3, -6);
    context.lineTo(reach - 3, 6);
    context.closePath();
    context.fillStyle = charging ? "#ffec78" : "rgba(255,255,255,0.4)";
    context.fill();
    context.restore();

    // The person. Upright, squashing a little on the recoil.
    context.save();
    context.translate(x, y);
    const squash = 1 + player.lean * 0.16;
    context.scale(1 / squash, squash);
    context.strokeStyle = "#f4f7ff";
    context.fillStyle = "#f4f7ff";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, -14, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(0, 8);
    context.moveTo(0, -2);
    context.lineTo(-9, 4);
    context.moveTo(0, -2);
    context.lineTo(9, 4);
    context.moveTo(0, 8);
    context.lineTo(-7, 19);
    context.moveTo(0, 8);
    context.lineTo(7, 19);
    context.stroke();
    if (charging) {
      context.fillStyle = `rgba(164, 214, 106, ${0.25 + power * 0.5})`;
      context.beginPath();
      context.arc(0, 4, 8 + power * 7, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  });
}

function frame(time: number): void {
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  update(dt);
  drawBackground();
  drawPuffs();
  drawPlayer();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
