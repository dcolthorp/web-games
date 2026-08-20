export {};

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const scoreText = document.querySelector<HTMLElement>("#score");
const bestText = document.querySelector<HTMLElement>("#best");
const message = document.querySelector<HTMLElement>("#message");

if (!canvas || !scoreText || !bestText || !message) throw new Error("Secret game UI is missing");

const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas is unavailable");

type Obstacle = { x: number; width: number; height: number; kind: "spike" | "block" };
const player = { x: 145, y: 0, size: 42, velocity: 0, rotation: 0, grounded: true };
const floorY = 400;
const gravity = 2050;
const jumpVelocity = -760;
let obstacles: Obstacle[] = [];
let running = false;
let gameOver = false;
let distance = 0;
let speed = 360;
let spawnIn = 1;
let previousTime = performance.now();
let best = Number(localStorage.getItem("totally-not-dash-best") ?? 0);

const reset = (): void => {
  obstacles = [];
  player.y = floorY - player.size;
  player.velocity = 0;
  player.rotation = 0;
  player.grounded = true;
  distance = 0;
  speed = 360;
  spawnIn = .9;
  running = true;
  gameOver = false;
  message.classList.add("hidden");
};

const jump = (): void => {
  if (!running) {
    reset();
    return;
  }
  if (player.grounded) {
    player.velocity = jumpVelocity;
    player.grounded = false;
  }
};

const lose = (): void => {
  running = false;
  gameOver = true;
  best = Math.max(best, Math.floor(distance));
  localStorage.setItem("totally-not-dash-best", String(best));
  message.innerHTML = `<strong>THAT WAS TOTALLY NOT A CRASH</strong><span>Distance ${Math.floor(distance)} · click to try again</span>`;
  message.classList.remove("hidden");
};

const update = (seconds: number): void => {
  if (!running) return;
  distance += seconds * speed / 10;
  speed = Math.min(780, 360 + distance * .7);
  const previousBottom = player.y + player.size;
  player.velocity += gravity * seconds;
  player.y = Math.min(floorY - player.size, player.y + player.velocity * seconds);
  player.grounded = player.y >= floorY - player.size;
  player.rotation += seconds * (player.y < floorY - player.size ? 7 : 0);
  spawnIn -= seconds;
  if (spawnIn <= 0) {
    const kind = Math.random() < .34 ? "block" : "spike";
    obstacles.push({
      x: canvas.width + 40,
      width: kind === "block" ? 70 + Math.random() * 55 : 38 + Math.random() * 24,
      height: kind === "block" ? 55 + Math.random() * 65 : 45 + Math.random() * 45,
      kind,
    });
    spawnIn = kind === "block" ? 1.05 + Math.random() * .65 : .72 + Math.random() * .85;
  }
  obstacles.forEach((obstacle) => { obstacle.x -= speed * seconds; });
  obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > -20);
  for (const obstacle of obstacles) {
    const overlapsX = player.x + player.size - 8 > obstacle.x && player.x + 8 < obstacle.x + obstacle.width;
    const obstacleTop = floorY - obstacle.height;
    if (obstacle.kind === "spike") {
      const overlapsY = player.y + player.size - 5 > obstacleTop;
      if (overlapsX && overlapsY) lose();
      continue;
    }
    const overlapsY = player.y + player.size > obstacleTop && player.y < floorY;
    if (!overlapsX || !overlapsY) continue;
    const canLand = player.velocity >= 0 && previousBottom <= obstacleTop + 12;
    if (canLand) {
      player.y = obstacleTop - player.size;
      player.velocity = 0;
      player.grounded = true;
    } else {
      lose();
    }
  }
};

const draw = (): void => {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#3b176d");
  gradient.addColorStop(1, "#10103b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(103,247,220,.15)";
  context.lineWidth = 2;
  for (let x = -(distance * 4) % 80; x < canvas.width; x += 80) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, floorY); context.stroke();
  }
  for (let y = 0; y < floorY; y += 80) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.fillStyle = "#67f7dc";
  context.fillRect(0, floorY, canvas.width, canvas.height - floorY);
  context.save();
  context.translate(player.x + player.size / 2, player.y + player.size / 2);
  context.rotate(player.rotation);
  context.fillStyle = gameOver ? "#e13e8d" : "#ffe954";
  context.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
  context.strokeStyle = "#160d35"; context.lineWidth = 5;
  context.strokeRect(-player.size / 2, -player.size / 2, player.size, player.size);
  context.restore();
  obstacles.forEach((obstacle) => {
    if (obstacle.kind === "block") {
      context.fillStyle = "#7b4dd1";
      context.fillRect(obstacle.x, floorY - obstacle.height, obstacle.width, obstacle.height);
      context.strokeStyle = "#ffe954";
      context.lineWidth = 5;
      context.strokeRect(obstacle.x, floorY - obstacle.height, obstacle.width, obstacle.height);
      context.strokeStyle = "rgba(255,255,255,.22)";
      context.lineWidth = 2;
      for (let y = floorY - obstacle.height + 18; y < floorY; y += 18) {
        context.beginPath(); context.moveTo(obstacle.x, y); context.lineTo(obstacle.x + obstacle.width, y); context.stroke();
      }
      return;
    }
    context.fillStyle = "#e13e8d";
    context.beginPath();
    context.moveTo(obstacle.x, floorY);
    context.lineTo(obstacle.x + obstacle.width / 2, floorY - obstacle.height);
    context.lineTo(obstacle.x + obstacle.width, floorY);
    context.closePath(); context.fill();
  });
  scoreText.textContent = `DISTANCE ${Math.floor(distance)}`;
  bestText.textContent = `BEST ${best}`;
};

const frame = (time: number): void => {
  const seconds = Math.min(.033, (time - previousTime) / 1000);
  previousTime = time;
  update(seconds);
  draw();
  requestAnimationFrame(frame);
};

canvas.addEventListener("pointerdown", jump);
window.addEventListener("keydown", (event) => {
  if ([" ", "ArrowUp", "w", "W"].includes(event.key)) {
    event.preventDefault();
    jump();
  }
});

player.y = floorY - player.size;
draw();
requestAnimationFrame(frame);
