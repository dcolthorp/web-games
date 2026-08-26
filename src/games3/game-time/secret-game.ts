export {};

interface Platform { x: number; y: number; width: number; height: number }
interface Moon { x: number; y: number; collected: boolean }
interface Enemy { x: number; y: number; minX: number; maxX: number; direction: number; alive: boolean }

const game = document.getElementById("secret-game");
const paper = document.querySelector(".paper-page");
const note = document.querySelector(".paper-page .note");
const canvas = document.getElementById("secret-stage") as HTMLCanvasElement | null;
const ctx = canvas?.getContext("2d") ?? null;
const scoreLabel = document.getElementById("secret-score");
const livesLabel = document.getElementById("secret-lives");
const overlay = document.getElementById("secret-overlay");
const message = document.getElementById("secret-message");
const startButton = document.getElementById("secret-start") as HTMLButtonElement | null;
const fullscreenButton = document.getElementById("secret-fullscreen") as HTMLButtonElement | null;

const WORLD_WIDTH = 7200;
const GROUND_Y = 450;
const keys = new Set<string>();
const player = { x: 100, y: 380, vx: 0, vy: 0, width: 30, height: 48, grounded: false, facing: 1, invulnerableUntil: 0 };
const cap = { x: 0, y: 0, vx: 0, active: false, returning: false, distance: 0 };
const platforms: Platform[] = [
  { x: 0, y: GROUND_Y, width: 1150, height: 70 }, { x: 1260, y: GROUND_Y, width: 830, height: 70 },
  { x: 2210, y: GROUND_Y, width: 940, height: 70 }, { x: 3260, y: GROUND_Y, width: 660, height: 70 },
  { x: 4060, y: GROUND_Y, width: 1010, height: 70 }, { x: 5200, y: GROUND_Y, width: 760, height: 70 },
  { x: 6080, y: GROUND_Y, width: 1120, height: 70 }, { x: 430, y: 350, width: 190, height: 22 },
  { x: 820, y: 285, width: 150, height: 22 }, { x: 1390, y: 340, width: 210, height: 22 },
  { x: 1780, y: 270, width: 150, height: 22 }, { x: 2350, y: 330, width: 240, height: 22 },
  { x: 2780, y: 245, width: 150, height: 22 }, { x: 3370, y: 315, width: 210, height: 22 },
  { x: 3720, y: 235, width: 140, height: 22 }, { x: 4220, y: 340, width: 240, height: 22 },
  { x: 4700, y: 260, width: 170, height: 22 }, { x: 5320, y: 320, width: 190, height: 22 },
  { x: 5700, y: 225, width: 150, height: 22 }, { x: 6230, y: 330, width: 210, height: 22 },
  { x: 6650, y: 245, width: 210, height: 22 },
];
const moons: Moon[] = [
  { x: 900, y: 235, collected: false }, { x: 1845, y: 220, collected: false },
  { x: 2850, y: 195, collected: false }, { x: 3780, y: 185, collected: false },
  { x: 5770, y: 175, collected: false }, { x: 6760, y: 195, collected: false },
];
const enemies: Enemy[] = [1450, 2450, 3490, 4330, 4840, 5440, 6320, 6820].map((x) => ({
  x, y: GROUND_Y - 30, minX: x - 90, maxX: x + 90, direction: 1, alive: true,
}));

let lives = 3;
let moonCount = 0;
let cameraX = 0;
let running = false;
let previousFrame = 0;
let animationFrame = 0;

function reveal(): void {
  if (!game || game.classList.contains("revealed")) return;
  game.classList.add("revealed");
  game.setAttribute("aria-hidden", "false");
  document.title = "2D Mario Odyssey";
  window.setTimeout(() => startButton?.focus(), 450);
}

if (paper) {
  new MutationObserver(() => {
    if (!paper.isConnected || !note?.isConnected) reveal();
  }).observe(document.body, { childList: true, subtree: true });
} else reveal();

function updateHud(): void {
  if (scoreLabel) scoreLabel.textContent = `${moonCount}/6`;
  if (livesLabel) livesLabel.textContent = `${"♥".repeat(lives)}${"♡".repeat(3 - lives)}`;
}

function resetPlayer(): void {
  player.x = Math.max(80, cameraX + 90);
  player.y = 330;
  player.vx = 0;
  player.vy = 0;
}

function start(): void {
  lives = 3;
  moonCount = 0;
  cameraX = 0;
  Object.assign(player, { x: 100, y: 380, vx: 0, vy: 0, invulnerableUntil: 0 });
  cap.active = false;
  for (const moon of moons) moon.collected = false;
  for (const enemy of enemies) enemy.alive = true;
  running = true;
  overlay?.classList.add("hidden");
  updateHud();
  previousFrame = performance.now();
  window.cancelAnimationFrame(animationFrame);
  animationFrame = window.requestAnimationFrame(tick);
}

function finish(won: boolean): void {
  running = false;
  if (message) message.textContent = won ? "ODYSSEY COMPLETE. But something followed you home." : "The dark caught up. Try the odyssey again.";
  if (startButton) startButton.textContent = won ? "return to the kingdom" : "try again";
  overlay?.classList.remove("hidden");
}

function throwCap(): void {
  if (!running || cap.active) return;
  cap.active = true;
  cap.returning = false;
  cap.distance = 0;
  cap.x = player.x + player.facing * 24;
  cap.y = player.y + 14;
  cap.vx = player.facing * 520;
}

function hurt(timestamp: number): void {
  if (timestamp < player.invulnerableUntil) return;
  lives -= 1;
  player.invulnerableUntil = timestamp + 1500;
  updateHud();
  if (lives <= 0) finish(false); else resetPlayer();
}

function jump(): void {
  if (running && player.grounded) {
    player.vy = -470;
    player.grounded = false;
  }
}

function update(delta: number, timestamp: number): void {
  if (!canvas) return;
  const direction = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
  player.vx += direction * 1650 * delta;
  player.vx *= Math.pow(0.002, delta);
  player.vx = Math.max(-270, Math.min(270, player.vx));
  if (direction) player.facing = direction;
  player.vy += 1050 * delta;
  const oldBottom = player.y + player.height;
  player.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.x + player.vx * delta));
  player.y += player.vy * delta;
  player.grounded = false;
  for (const platform of platforms) {
    const withinX = player.x + player.width > platform.x && player.x < platform.x + platform.width;
    const newBottom = player.y + player.height;
    if (withinX && player.vy >= 0 && oldBottom <= platform.y && newBottom >= platform.y) {
      player.y = platform.y - player.height;
      player.vy = 0;
      player.grounded = true;
    }
  }
  if (player.y > canvas.height + 100) hurt(timestamp);

  if (cap.active) {
    cap.x += cap.vx * delta;
    cap.distance += Math.abs(cap.vx * delta);
    if (cap.distance > 250) cap.returning = true;
    if (cap.returning) {
      const dx = player.x + player.width / 2 - cap.x;
      const dy = player.y + 15 - cap.y;
      const length = Math.hypot(dx, dy) || 1;
      cap.x += dx / length * 620 * delta;
      cap.y += dy / length * 620 * delta;
      if (length < 28) cap.active = false;
    }
  }
  for (const moon of moons) {
    if (!moon.collected && Math.hypot(player.x + 15 - moon.x, player.y + 20 - moon.y) < 42) {
      moon.collected = true;
      moonCount += 1;
      updateHud();
    }
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.direction * 65 * delta;
    if (enemy.x < enemy.minX || enemy.x > enemy.maxX) enemy.direction *= -1;
    if (cap.active && Math.hypot(cap.x - enemy.x, cap.y - enemy.y) < 34) enemy.alive = false;
    if (Math.abs(player.x + 15 - enemy.x) < 28 && Math.abs(player.y + 28 - enemy.y) < 35) hurt(timestamp);
  }
  if (moonCount === moons.length && player.x > 7000) finish(true);
  cameraX += (Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width * 0.38)) - cameraX) * Math.min(1, delta * 7);
}

function draw(timestamp: number): void {
  if (!canvas || !ctx) return;
  const progress = cameraX / (WORLD_WIDTH - canvas.width);
  const creep = Math.max(0, (progress - 0.3) / 0.7);
  const skyR = Math.round(77 * (1 - creep) + 12 * creep);
  const skyG = Math.round(184 * (1 - creep) + 5 * creep);
  const skyB = Math.round(220 * (1 - creep) + 24 * creep);
  ctx.fillStyle = `rgb(${skyR} ${skyG} ${skyB})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(255,255,210,${1 - creep})`;
  ctx.beginPath(); ctx.arc(780, 90, 46, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(-cameraX, 0);
  for (let x = 0; x < WORLD_WIDTH; x += 260) {
    const height = 90 + ((x * 17) % 130);
    ctx.fillStyle = creep > 0.45 ? "#201425" : x % 520 ? "#59a863" : "#408e61";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 120, GROUND_Y - height); ctx.lineTo(x + 250, GROUND_Y); ctx.fill();
  }
  for (const platform of platforms) {
    ctx.fillStyle = progress > 0.7 ? "#281827" : "#815438";
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = progress > 0.7 ? "#7d304b" : "#50b657";
    ctx.fillRect(platform.x, platform.y, platform.width, 10);
  }
  for (const moon of moons) {
    if (moon.collected) continue;
    ctx.save(); ctx.translate(moon.x, moon.y); ctx.rotate(timestamp / 700);
    ctx.shadowColor = "#fff5a8"; ctx.shadowBlur = 18; ctx.fillStyle = "#ffe66d";
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 ? 10 : 22;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.font = "bold 15px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ctx.fillStyle = creep > 0.65 ? "#e7d5e3" : "#7b293f";
    ctx.fillRect(enemy.x - 16, enemy.y - 17, 32, 30);
    ctx.fillStyle = "#fff"; ctx.fillRect(enemy.x - 9, enemy.y - 10, 6, 7); ctx.fillRect(enemy.x + 4, enemy.y - 10, 6, 7);
  }
  if (cap.active) {
    ctx.fillStyle = "#ef344d"; ctx.beginPath(); ctx.ellipse(cap.x, cap.y, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillRect(cap.x - 7, cap.y - 8, 14, 5);
  }
  const blinking = timestamp < player.invulnerableUntil && Math.floor(timestamp / 90) % 2 === 0;
  if (!blinking) {
    ctx.fillStyle = "#273c9a"; ctx.fillRect(player.x + 5, player.y + 20, 21, 28);
    ctx.fillStyle = "#f2b07e"; ctx.beginPath(); ctx.arc(player.x + 15, player.y + 14, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ef344d"; ctx.fillRect(player.x + 1, player.y + 2, 28, 8);
    ctx.fillStyle = "#fff"; ctx.fillRect(player.x + (player.facing > 0 ? 19 : 7), player.y + 11, 5, 5);
  }
  if (progress > 0.78) {
    ctx.fillStyle = `rgba(255,240,245,${0.12 + Math.sin(timestamp / 300) * 0.05})`;
    ctx.font = "bold 54px monospace";
    const words = ["TURN BACK", "IT KNOWS", "KEEP GOING"];
    for (let i = 0; i < 5; i += 1) ctx.fillText(words[i % words.length]!, cameraX + 170 + i * 390, 100 + (i % 3) * 105);
  }
  ctx.restore();
  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 150, canvas.width / 2, canvas.height / 2, 600);
  gradient.addColorStop(0, "transparent"); gradient.addColorStop(1, `rgba(10,0,12,${creep * 0.82})`);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(16, 15, 270, 34);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px monospace"; ctx.textAlign = "left";
  ctx.fillText(`DISTANCE ${Math.round(player.x)}m / MOONS ${moonCount}/6`, 28, 37);
}

function tick(timestamp: number): void {
  if (!running) return;
  const delta = Math.min(0.034, (timestamp - previousFrame) / 1000 || 0);
  previousFrame = timestamp;
  update(delta, timestamp);
  draw(timestamp);
  if (running) animationFrame = window.requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "x"].includes(key) && game?.classList.contains("revealed")) event.preventDefault();
  keys.add(key);
  if (!event.repeat && ["arrowup", "w", " "].includes(key)) jump();
  if (!event.repeat && key === "x") throwCap();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
startButton?.addEventListener("click", start);
fullscreenButton?.addEventListener("click", async () => {
  if (!game) return;
  if (document.fullscreenElement) await document.exitFullscreen(); else await game.requestFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  if (fullscreenButton) fullscreenButton.textContent = document.fullscreenElement ? "× exit fullscreen" : "⛶ fullscreen";
});
draw(0);
