interface Point {
  x: number;
  y: number;
}

export {};

interface Bug extends Point {
  vx: number;
  vy: number;
  radius: number;
}

const secretGame = document.getElementById("secret-game");
const paperPage = document.querySelector(".paper-page");
const paperNote = document.querySelector(".paper-page .note");
const canvas = document.getElementById("secret-stage") as HTMLCanvasElement | null;
const context = canvas?.getContext("2d") ?? null;
const scoreLabel = document.getElementById("secret-score");
const livesLabel = document.getElementById("secret-lives");
const overlay = document.getElementById("secret-overlay");
const message = document.getElementById("secret-message");
const startButton = document.getElementById("secret-start") as HTMLButtonElement | null;

const player = { x: 110, y: 260, radius: 15, speed: 250 };
const keys = new Set<string>();
let fragments: Point[] = [];
let bugs: Bug[] = [];
let score = 0;
let lives = 3;
let running = false;
let invulnerableUntil = 0;
let previousFrame = 0;
let animationFrame = 0;

function revealSecret(): void {
  if (!secretGame || secretGame.classList.contains("revealed")) return;
  secretGame.classList.add("revealed");
  secretGame.setAttribute("aria-hidden", "false");
  window.setTimeout(() => startButton?.focus(), 450);
}

if (paperPage) {
  new MutationObserver(() => {
    if (!paperPage.isConnected || !paperNote?.isConnected) revealSecret();
  }).observe(document.body, { childList: true, subtree: true });
} else {
  revealSecret();
}

function randomPoint(margin = 45): Point {
  return {
    x: margin + Math.random() * ((canvas?.width ?? 960) - margin * 2),
    y: margin + Math.random() * ((canvas?.height ?? 520) - margin * 2),
  };
}

function resetGame(): void {
  if (!canvas) return;
  player.x = 110;
  player.y = canvas.height / 2;
  score = 0;
  lives = 3;
  invulnerableUntil = 0;
  fragments = Array.from({ length: 8 }, () => randomPoint(60));
  bugs = Array.from({ length: 5 }, (_, index) => {
    const point = randomPoint(80);
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + index * 14;
    return { ...point, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 13 };
  });
  running = true;
  overlay?.classList.add("hidden");
  updateHud();
  previousFrame = performance.now();
  window.cancelAnimationFrame(animationFrame);
  animationFrame = window.requestAnimationFrame(tick);
}

function updateHud(): void {
  if (scoreLabel) scoreLabel.textContent = `${score}/8`;
  if (livesLabel) livesLabel.textContent = `${"♥".repeat(lives)}${"♡".repeat(3 - lives)}`;
}

function finish(won: boolean): void {
  running = false;
  window.cancelAnimationFrame(animationFrame);
  if (message) message.textContent = won ? "SOURCE RESTORED. You found the real game." : "SEGMENTATION FAULT. The bugs got you.";
  if (startButton) startButton.textContent = won ? "play the secret again" : "recompile";
  overlay?.classList.remove("hidden");
}

function overlaps(a: Point, aRadius: number, b: Point, bRadius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < aRadius + bRadius;
}

function update(delta: number, timestamp: number): void {
  if (!canvas) return;
  const horizontal = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
  const vertical = Number(keys.has("arrowdown") || keys.has("s")) - Number(keys.has("arrowup") || keys.has("w"));
  const length = Math.hypot(horizontal, vertical) || 1;
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x + horizontal / length * player.speed * delta));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y + vertical / length * player.speed * delta));

  fragments = fragments.filter((fragment) => {
    if (!overlaps(player, player.radius, fragment, 12)) return true;
    score += 1;
    updateHud();
    if (score === 8) finish(true);
    return false;
  });

  for (const bug of bugs) {
    bug.x += bug.vx * delta;
    bug.y += bug.vy * delta;
    if (bug.x < bug.radius || bug.x > canvas.width - bug.radius) bug.vx *= -1;
    if (bug.y < bug.radius || bug.y > canvas.height - bug.radius) bug.vy *= -1;
    bug.x = Math.max(bug.radius, Math.min(canvas.width - bug.radius, bug.x));
    bug.y = Math.max(bug.radius, Math.min(canvas.height - bug.radius, bug.y));
    if (timestamp >= invulnerableUntil && overlaps(player, player.radius, bug, bug.radius)) {
      lives -= 1;
      invulnerableUntil = timestamp + 1200;
      player.x = 110;
      player.y = canvas.height / 2;
      updateHud();
      if (lives === 0) finish(false);
    }
  }
}

function draw(timestamp: number): void {
  if (!canvas || !context) return;
  context.fillStyle = "#07110f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(71, 255, 177, 0.09)";
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 32) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 32) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.font = "bold 24px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const fragment of fragments) {
    context.shadowColor = "#5dffc0";
    context.shadowBlur = 14;
    context.fillStyle = "#a4ffd8";
    context.fillText("</>", fragment.x, fragment.y);
  }
  context.shadowBlur = 10;
  for (const bug of bugs) {
    context.shadowColor = "#ff3158";
    context.fillStyle = "#ff3158";
    context.fillText("BUG", bug.x, bug.y);
  }
  context.shadowBlur = 16;
  context.shadowColor = "#5dffc0";
  context.fillStyle = timestamp < invulnerableUntil && Math.floor(timestamp / 100) % 2 === 0 ? "transparent" : "#5dffc0";
  context.beginPath();
  context.moveTo(player.x + 18, player.y);
  context.lineTo(player.x - 12, player.y - 14);
  context.lineTo(player.x - 6, player.y);
  context.lineTo(player.x - 12, player.y + 14);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
}

function tick(timestamp: number): void {
  if (!running) return;
  const delta = Math.min(0.035, (timestamp - previousFrame) / 1000);
  previousFrame = timestamp;
  update(delta, timestamp);
  draw(timestamp);
  if (running) animationFrame = window.requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    if (secretGame?.classList.contains("revealed")) event.preventDefault();
    keys.add(key);
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
startButton?.addEventListener("click", resetGame);
draw(0);
