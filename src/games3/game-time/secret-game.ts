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

const WORLD_WIDTH = 6600;
const KINGDOM_WIDTH = 2200;
const GROUND_Y = 450;
const keys = new Set<string>();
const player = { x: 100, y: 380, vx: 0, vy: 0, width: 30, height: 48, grounded: false, facing: 1, invulnerableUntil: 0 };
const cap = { x: 0, y: 0, vx: 0, active: false, returning: false, distance: 0 };
const platforms: Platform[] = [
  // Three separate kingdoms. Their 100px crossings are comfortably below the
  // player's measured running-jump range of roughly 240px.
  { x: 0, y: GROUND_Y, width: 2100, height: 70 },
  { x: 2200, y: GROUND_Y, width: 2100, height: 70 },
  { x: 4400, y: GROUND_Y, width: 2200, height: 70 },
  { x: 650, y: 360, width: 240, height: 22 }, { x: 1530, y: 355, width: 240, height: 22 },
  { x: 2740, y: 365, width: 260, height: 22 }, { x: 3620, y: 355, width: 250, height: 22 },
  { x: 4940, y: 365, width: 260, height: 22 }, { x: 5820, y: 355, width: 260, height: 22 },
];
const moons: Moon[] = [
  { x: 770, y: 315, collected: false }, { x: 1650, y: 310, collected: false },
  { x: 2870, y: 320, collected: false }, { x: 3745, y: 310, collected: false },
  { x: 5070, y: 320, collected: false }, { x: 5950, y: 310, collected: false },
];
const enemies: Enemy[] = [1100, 1850, 2500, 3350, 4100, 4700, 5550, 6250].map((x) => ({
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
  const kingdomStart = Math.floor(Math.max(0, player.x) / KINGDOM_WIDTH) * KINGDOM_WIDTH;
  player.x = kingdomStart + 80;
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
    if (cap.distance > 250 && !cap.returning) {
      cap.returning = true;
      cap.vx = 0;
    }
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
  if (moonCount === moons.length && player.x > 6450) finish(true);
  cameraX += (Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width * 0.38)) - cameraX) * Math.min(1, delta * 7);
}

function draw(timestamp: number): void {
  if (!canvas || !ctx) return;
  const progress = cameraX / (WORLD_WIDTH - canvas.width);
  const creep = Math.max(0, (progress - 0.3) / 0.7);
  const kingdom = Math.min(2, Math.floor(player.x / KINGDOM_WIDTH));
  const kingdomNames = ["SUNSHINE KINGDOM", "METRO KINGDOM", "HOLLOW KINGDOM"];
  const skies = ["#55bce1", "#604c81", "#100817"];
  ctx.fillStyle = skies[kingdom]!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = kingdom === 2 ? "#d9c9d8" : "#fffbd1";
  ctx.beginPath(); ctx.arc(780, 90, 46, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(-cameraX, 0);
  // Each kingdom has its own skyline instead of one stretched environment.
  for (let x = 0; x < KINGDOM_WIDTH; x += 240) {
    ctx.fillStyle = x % 480 ? "#5ebf68" : "#3d9b62";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 110, 260 - (x % 70)); ctx.lineTo(x + 230, GROUND_Y); ctx.fill();
  }
  for (let x = KINGDOM_WIDTH; x < KINGDOM_WIDTH * 2; x += 150) {
    const height = 150 + (x % 260);
    ctx.fillStyle = x % 300 ? "#34314d" : "#27243d";
    ctx.fillRect(x, GROUND_Y - height, 125, height);
    ctx.fillStyle = "#ffd56a";
    for (let y = GROUND_Y - height + 25; y < GROUND_Y - 35; y += 42) {
      ctx.fillRect(x + 22, y, 13, 18); ctx.fillRect(x + 67, y, 13, 18);
    }
  }
  for (let x = KINGDOM_WIDTH * 2; x < WORLD_WIDTH; x += 250) {
    const height = 120 + (x % 180);
    ctx.fillStyle = x % 500 ? "#271528" : "#35162b";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 80, GROUND_Y - height); ctx.lineTo(x + 125, GROUND_Y - height - 70); ctx.lineTo(x + 240, GROUND_Y); ctx.fill();
    ctx.strokeStyle = "rgba(242,205,232,.28)"; ctx.beginPath(); ctx.moveTo(x + 125, GROUND_Y - height - 70); ctx.lineTo(x + 105, GROUND_Y); ctx.stroke();
  }
  for (const platform of platforms) {
    const platformKingdom = Math.min(2, Math.floor(platform.x / KINGDOM_WIDTH));
    ctx.fillStyle = ["#815438", "#353242", "#281827"][platformKingdom]!;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = ["#50b657", "#c19055", "#7d304b"][platformKingdom]!;
    ctx.fillRect(platform.x, platform.y, platform.width, 10);
  }
  for (const moon of moons) {
    if (moon.collected) continue;
    ctx.save(); ctx.translate(moon.x, moon.y); ctx.rotate(-0.25 + Math.sin(timestamp / 500) * 0.08);
    ctx.shadowColor = "#fff5a8"; ctx.shadowBlur = 18; ctx.fillStyle = "#ffe66d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(9, -7, 19, 0, Math.PI * 2, true);
    ctx.fill("evenodd"); ctx.restore();
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
  ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(16, 15, 390, 56);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px monospace"; ctx.textAlign = "left";
  ctx.fillText(kingdomNames[kingdom]!, 28, 35);
  ctx.font = "bold 13px monospace";
  ctx.fillText(`KINGDOM ${kingdom + 1}/3 · MOONS ${moonCount}/6 · ${Math.round(player.x)}m`, 28, 56);
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
