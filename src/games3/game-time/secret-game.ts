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

// DevTools (and a few Chromium variants) can accidentally repeat the duplicate
// command while an inspected button is focused. Nested clones grow
// exponentially, so keep the one button that shipped with the page and discard
// any copies before they can exhaust the renderer.
function removeDuplicateStartButtons(): void {
  if (!startButton) return;
  for (const candidate of document.querySelectorAll("#secret-start")) {
    if (candidate !== startButton) candidate.remove();
  }
}

const duplicateButtonGuard = new MutationObserver(removeDuplicateStartButtons);
duplicateButtonGuard.observe(document.body, { childList: true, subtree: true });

const KINGDOM_COUNT = 5;
const KINGDOM_WIDTH = 2200;
const WORLD_WIDTH = KINGDOM_COUNT * KINGDOM_WIDTH;
const GROUND_Y = 450;
const keys = new Set<string>();
const player = { x: 100, y: 380, vx: 0, vy: 0, width: 30, height: 48, grounded: false, facing: 1, invulnerableUntil: 0 };
const cap = { x: 0, y: 0, vx: 0, active: false, returning: false, distance: 0 };
// Every kingdom uses the same proven traversal measurements but gets its own
// scenery. The 100px kingdom crossings stay well below the ~240px jump range.
const platforms: Platform[] = Array.from({ length: KINGDOM_COUNT }, (_, kingdom) => {
  const start = kingdom * KINGDOM_WIDTH;
  return [
    { x: start, y: GROUND_Y, width: kingdom === KINGDOM_COUNT - 1 ? 2200 : 2100, height: 70 },
    { x: start + 650, y: 360, width: 240, height: 22 },
    { x: start + 1530, y: 355, width: 240, height: 22 },
  ];
}).flat();
const moons: Moon[] = Array.from({ length: KINGDOM_COUNT }, (_, kingdom) => {
  const start = kingdom * KINGDOM_WIDTH;
  return [
    { x: start + 770, y: 315, collected: false },
    { x: start + 1650, y: 310, collected: false },
  ];
}).flat();
const enemies: Enemy[] = Array.from({ length: KINGDOM_COUNT }, (_, kingdom) => [
  kingdom * KINGDOM_WIDTH + 1100,
  kingdom * KINGDOM_WIDTH + 1850,
]).flat().map((x) => ({
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
  window.dispatchEvent(new Event("secret-game-revealed"));
  window.setTimeout(() => startButton?.focus(), 450);
}

if (paper) {
  new MutationObserver(() => {
    if (!paper.isConnected || !note?.isConnected) reveal();
  }).observe(document.body, { childList: true, subtree: true });
} else reveal();

function updateHud(): void {
  if (scoreLabel) scoreLabel.textContent = `${moonCount}/${moons.length}`;
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
  if (moonCount === moons.length && player.x > WORLD_WIDTH - 150) finish(true);
  cameraX += (Math.max(0, Math.min(WORLD_WIDTH - canvas.width, player.x - canvas.width * 0.38)) - cameraX) * Math.min(1, delta * 7);
}

function draw(timestamp: number): void {
  if (!canvas || !ctx) return;
  const progress = cameraX / (WORLD_WIDTH - canvas.width);
  const creep = Math.max(0, (progress - 0.3) / 0.7);
  const kingdom = Math.min(KINGDOM_COUNT - 1, Math.floor(player.x / KINGDOM_WIDTH));
  const kingdomNames = ["SUNSHINE KINGDOM", "SAND KINGDOM", "METRO KINGDOM", "FROST KINGDOM", "HOLLOW KINGDOM"];
  const skies = ["#55bce1", "#e7a953", "#604c81", "#8fb4ca", "#100817"];
  ctx.fillStyle = skies[kingdom]!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = kingdom === KINGDOM_COUNT - 1 ? "#d9c9d8" : "#fffbd1";
  ctx.beginPath(); ctx.arc(780, 90, 46, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(-cameraX, 0);
  const visibleLeft = cameraX - 280;
  const visibleRight = cameraX + canvas.width + 280;
  // Each kingdom has its own skyline instead of one stretched environment.
  for (let x = 0; x < KINGDOM_WIDTH; x += 240) {
    ctx.fillStyle = x % 480 ? "#5ebf68" : "#3d9b62";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 110, 260 - (x % 70)); ctx.lineTo(x + 230, GROUND_Y); ctx.fill();
  }
  for (let x = KINGDOM_WIDTH; x < KINGDOM_WIDTH * 2; x += 260) {
    ctx.fillStyle = x % 520 ? "#d98d40" : "#c77a36";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.quadraticCurveTo(x + 130, 260 - (x % 55), x + 255, GROUND_Y); ctx.fill();
    ctx.fillStyle = "#8b5938"; ctx.fillRect(x + 105, 300, 28, 150);
    ctx.beginPath(); ctx.moveTo(x + 75, 300); ctx.lineTo(x + 120, 235); ctx.lineTo(x + 164, 300); ctx.fill();
  }
  for (let x = KINGDOM_WIDTH * 2; x < KINGDOM_WIDTH * 3; x += 150) {
    const height = 150 + (x % 260);
    ctx.fillStyle = x % 300 ? "#34314d" : "#27243d";
    ctx.fillRect(x, GROUND_Y - height, 125, height);
    ctx.fillStyle = "#ffd56a"; ctx.fillRect(x + 25, GROUND_Y - height + 30, 16, 22);
  }
  for (let x = KINGDOM_WIDTH * 3; x < KINGDOM_WIDTH * 4; x += 230) {
    ctx.fillStyle = x % 460 ? "#d8f2f4" : "#b7dce5";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 100, 210 - (x % 80)); ctx.lineTo(x + 220, GROUND_Y); ctx.fill();
  }
  for (let x = KINGDOM_WIDTH * 4; x < WORLD_WIDTH; x += 250) {
    const height = 120 + (x % 180);
    ctx.fillStyle = x % 500 ? "#271528" : "#35162b";
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x + 80, GROUND_Y - height); ctx.lineTo(x + 125, GROUND_Y - height - 70); ctx.lineTo(x + 240, GROUND_Y); ctx.fill();
    ctx.strokeStyle = "rgba(242,205,232,.28)"; ctx.beginPath(); ctx.moveTo(x + 125, GROUND_Y - height - 70); ctx.lineTo(x + 105, GROUND_Y); ctx.stroke();
  }
  for (const platform of platforms) {
    if (platform.x + platform.width < visibleLeft || platform.x > visibleRight) continue;
    const platformKingdom = Math.min(KINGDOM_COUNT - 1, Math.floor(platform.x / KINGDOM_WIDTH));
    ctx.fillStyle = ["#815438", "#a66d35", "#353242", "#7895a3", "#281827"][platformKingdom]!;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    ctx.fillStyle = ["#50b657", "#e8bf5a", "#c19055", "#e4f8ff", "#7d304b"][platformKingdom]!;
    ctx.fillRect(platform.x, platform.y, platform.width, 10);
  }
  for (const moon of moons) {
    if (moon.collected || moon.x < visibleLeft || moon.x > visibleRight) continue;
    ctx.save(); ctx.translate(moon.x, moon.y); ctx.rotate(-0.25 + Math.sin(timestamp / 500) * 0.08);
    ctx.shadowColor = "#fff5a8"; ctx.shadowBlur = 18; ctx.fillStyle = "#ffe66d";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(9, -7, 19, 0, Math.PI * 2, true);
    ctx.fill("evenodd"); ctx.restore();
  }
  ctx.font = "bold 15px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.x < visibleLeft || enemy.x > visibleRight) continue;
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
  ctx.fillText(`KINGDOM ${kingdom + 1}/${KINGDOM_COUNT} · MOONS ${moonCount}/${moons.length} · ${Math.round(player.x)}m`, 28, 56);
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
