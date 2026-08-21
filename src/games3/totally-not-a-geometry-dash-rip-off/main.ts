const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const context = canvas.getContext("2d")!;
const scoreDisplay = document.querySelector<HTMLElement>("#score")!;
const bestDisplay = document.querySelector<HTMLElement>("#best")!;
const message = document.querySelector<HTMLElement>("#message")!;
const musicFrame = document.querySelector<HTMLIFrameElement>("#music-frame")!;
const musicToggle = document.querySelector<HTMLButtonElement>("#music-toggle")!;

let musicStarted = false;

function startMusic(): void {
  if (musicStarted) return;

  const autoplaySource = musicFrame.dataset["autoplaySrc"];
  if (!autoplaySource) return;

  musicStarted = true;
  musicFrame.src = autoplaySource;
  musicToggle.textContent = "♫ MUSIC STARTED";
  musicToggle.disabled = true;
}

musicToggle.addEventListener("click", startMusic);

type PlayerMode = "cube" | "ship" | "ball" | "ufo" | "wave" | "robot" | "spider";
type PortalEffect = PlayerMode | "fast" | "slow" | "gravity-up" | "gravity-down" | "mini" | "normal-size";
type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "spike" | "block";
  spikeDirection: "up" | "down";
};
type Gizmo = { x: number; y: number; kind: "pad" | "orb" | "portal"; used: boolean; portalEffect?: PortalEffect };

const floorY = 400;
const flyingModes: PlayerMode[] = ["ship", "ufo", "wave"];

function isFlyingMode(value: PlayerMode) {
  return flyingModes.includes(value);
}
const gravity = 2050;
const portalEffects: PortalEffect[] = [
  "ship", "cube", "ball", "ufo", "wave", "robot", "spider",
  "gravity-up", "gravity-down", "mini", "normal-size", "fast", "slow",
];

const portalStyles: Record<PortalEffect, { color: string; symbol: string; name: string }> = {
  ship: { color: "#a855f7", symbol: "▶", name: "SHIP" },
  cube: { color: "#32d875", symbol: "■", name: "CUBE" },
  ball: { color: "#ef4444", symbol: "●", name: "BALL" },
  ufo: { color: "#ff66c4", symbol: "⌒", name: "UFO" },
  wave: { color: "#3b82f6", symbol: "◆", name: "WAVE" },
  robot: { color: "#f97316", symbol: "▣", name: "ROBOT" },
  spider: { color: "#d946ef", symbol: "✳", name: "SPIDER" },
  "gravity-up": { color: "#facc15", symbol: "↑", name: "GRAVITY UP" },
  "gravity-down": { color: "#22d3ee", symbol: "↓", name: "GRAVITY DOWN" },
  mini: { color: "#f8fafc", symbol: "−", name: "MINI" },
  "normal-size": { color: "#eab308", symbol: "+", name: "NORMAL SIZE" },
  fast: { color: "#14b8a6", symbol: "≫", name: "SPEED UP" },
  slow: { color: "#fb7185", symbol: "≪", name: "SLOW DOWN" },
};

const player = { x: 155, y: floorY - 42, size: 42, velocity: 0, rotation: 0, grounded: true };
let mode: PlayerMode = "cube";
let gravityDirection: 1 | -1 = 1;
let sizeScale = 1;
let running = false;
let dead = false;
let inputHeld = false;
let distance = 0;
let best = Number(localStorage.getItem("totally-not-geometry-best") || 0);
let speed = 330;
let spawnTimer = 0;
let gizmoTimer = 2;
let lastTime = 0;
let portalNotice = "";
let portalNoticeTime = 0;
let obstacles: Obstacle[] = [];
let gizmos: Gizmo[] = [];

bestDisplay.textContent = `BEST ${best}`;

function reset() {
  mode = "cube";
  gravityDirection = 1;
  sizeScale = 1;
  player.size = 42;
  player.y = floorY - player.size;
  player.velocity = 0;
  player.rotation = 0;
  player.grounded = true;
  obstacles = [];
  gizmos = [];
  distance = 0;
  speed = 330;
  spawnTimer = 0.8;
  gizmoTimer = 2.4;
  dead = false;
  running = true;
  message.classList.remove("death-screen");
  message.classList.add("hidden");
}

function startOrAct() {
  if (!running || dead) {
    reset();
    return;
  }
  if (mode === "ball") {
    if (!player.grounded) return;
    gravityDirection = gravityDirection === 1 ? -1 : 1;
    player.velocity = 260 * gravityDirection;
    player.grounded = false;
  } else if (mode === "spider") {
    gravityDirection = gravityDirection === 1 ? -1 : 1;
    player.y = gravityDirection === 1 ? floorY - player.size : 0;
    player.velocity = 0;
  } else if (mode === "ufo") {
    player.velocity = -gravityDirection * 610;
  } else if ((mode === "cube" || mode === "robot") && player.grounded) {
    player.velocity = -gravityDirection * (mode === "robot" ? 940 : 760);
    player.grounded = false;
  }
}

function addObstacle() {
  const flying = isFlyingMode(mode);
  const block = Math.random() < (flying ? 0.55 : 0.34);
  const height = block ? 52 + Math.random() * 42 : 44;
  const spikeDirection = flying
    ? (Math.random() < 0.5 ? "up" : "down")
    : gravityDirection === 1 ? "up" : "down";
  const y = flying
    ? 48 + Math.random() * Math.max(40, floorY - height - 96)
    : gravityDirection === 1 ? floorY - height : 0;
  obstacles.push({
    x: canvas.width + 40,
    y,
    width: block ? 58 : 48,
    height,
    kind: block ? "block" : "spike",
    spikeDirection,
  });
  spawnTimer = flying ? 0.7 + Math.random() * 0.8 : 0.85 + Math.random() * 1.15;
}

function addGizmo() {
  const roll = Math.random();
  if (roll < 0.22) {
    gizmos.push({ x: canvas.width + 50, y: floorY - 18, kind: "pad", used: false });
  } else if (roll < 0.42) {
    gizmos.push({ x: canvas.width + 50, y: floorY - 135 - Math.random() * 90, kind: "orb", used: false });
  } else {
    const portalEffect = portalEffects[Math.floor(Math.random() * portalEffects.length)];
    gizmos.push({ x: canvas.width + 50, y: floorY / 2, kind: "portal", used: false, portalEffect });
  }
  gizmoTimer = 3.2 + Math.random() * 3.7;
}

function applyPortal(effect: PortalEffect) {
  const style = portalStyles[effect];
  portalNotice = style.name;
  portalNoticeTime = 1.15;
  if (["cube", "ship", "ball", "ufo", "wave", "robot", "spider"].includes(effect)) {
    const nextMode = effect as PlayerMode;
    if (nextMode !== mode) {
      mode = nextMode;
      obstacles = obstacles.filter((obstacle) => obstacle.x < player.x + 250);
      spawnTimer = Math.min(spawnTimer, 0.18);
    }
    player.velocity = 0;
  } else if (effect === "gravity-up") {
    gravityDirection = -1;
    player.grounded = false;
  } else if (effect === "gravity-down") {
    gravityDirection = 1;
    player.grounded = false;
  } else if (effect === "mini" || effect === "normal-size") {
    sizeScale = effect === "mini" ? 0.64 : 1;
    player.size = 42 * sizeScale;
  } else {
    speed = effect === "fast" ? Math.min(570, speed + 90) : Math.max(240, speed - 90);
  }
}

function overlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function lose() {
  dead = true;
  running = false;
  best = Math.max(best, Math.floor(distance));
  localStorage.setItem("totally-not-geometry-best", String(best));
  bestDisplay.textContent = `BEST ${best}`;
  message.classList.add("death-screen");
  message.innerHTML = '<img class="death-screen-image" src="./geometrically-dominated-death-screen.jpg" alt="You just got geometrically dominated!"><span>Click to try again</span>';
  message.classList.remove("hidden");
}

function update(dt: number) {
  if (!running) return;
  distance += dt * speed / 12;
  scoreDisplay.textContent = `DISTANCE ${Math.floor(distance)} · ${mode.toUpperCase()}`;
  spawnTimer -= dt;
  gizmoTimer -= dt;
  portalNoticeTime -= dt;
  if (spawnTimer <= 0) addObstacle();
  if (gizmoTimer <= 0) addGizmo();

  if (mode === "ship") {
    player.velocity += gravity * gravityDirection * 0.38 * dt;
    if (inputHeld) player.velocity -= gravityDirection * 1450 * dt;
  } else if (mode === "wave") {
    player.velocity = (inputHeld ? -1 : 1) * gravityDirection * 430;
  } else {
    player.velocity += gravity * gravityDirection * dt;
  }
  player.velocity = Math.max(-920, Math.min(920, player.velocity));
  const previousY = player.y;
  player.y += player.velocity * dt;
  player.rotation += dt * (mode === "ball" ? 8 : mode === "cube" ? 4.5 : 1.2);
  player.grounded = false;

  if (gravityDirection === 1 && player.y >= floorY - player.size) {
    player.y = floorY - player.size;
    player.velocity = 0;
    player.grounded = true;
  } else if (gravityDirection === -1 && player.y <= 0) {
    player.y = 0;
    player.velocity = 0;
    player.grounded = true;
  }
  if (player.y < -80 || player.y > floorY + 80) lose();

  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;
    const obstacleTop = obstacle.y + 4;
    const obstacleBottom = obstacle.y + obstacle.height - 4;
    const hitObstacle = overlap(
      player.x + 6,
      player.y + 5,
      player.size - 12,
      player.size - 8,
      obstacle.x + 5,
      obstacleTop,
      obstacle.width - 10,
      obstacle.height - 4,
    );

    if (!hitObstacle) continue;

    const landedOnBlock =
      obstacle.kind === "block" &&
      gravityDirection === 1 &&
      player.velocity >= 0 &&
      previousY + player.size <= obstacleTop + 10;

    const landedUnderBlock =
      obstacle.kind === "block" &&
      gravityDirection === -1 &&
      player.velocity <= 0 &&
      previousY >= obstacleBottom - 10;
    if (landedOnBlock) {
      player.y = obstacleTop - player.size;
      player.velocity = 0;
      player.grounded = true;
    } else if (landedUnderBlock) {
      player.y = obstacleBottom;
      player.velocity = 0;
      player.grounded = true;
    } else {
      lose();
      break;
    }
  }
  obstacles = obstacles.filter((item) => item.x + item.width > -30);

  for (const gizmo of gizmos) {
    gizmo.x -= speed * dt;
    if (gizmo.used) continue;
    if (gizmo.kind === "portal" && overlap(player.x, player.y, player.size, player.size, gizmo.x - 25, gizmo.y - 58, 50, 116)) {
      gizmo.used = true;
      applyPortal(gizmo.portalEffect!);
    } else if (gizmo.kind === "pad" && overlap(player.x, player.y, player.size, player.size, gizmo.x - 25, gizmo.y - 10, 50, 20)) {
      gizmo.used = true;
      player.velocity = -gravityDirection * 980;
    } else if (gizmo.kind === "orb" && inputHeld && Math.hypot(player.x + player.size / 2 - gizmo.x, player.y + player.size / 2 - gizmo.y) < 64) {
      gizmo.used = true;
      player.velocity = -gravityDirection * 850;
    }
  }
  gizmos = gizmos.filter((item) => item.x > -80);
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#151b48");
  gradient.addColorStop(1, "#07152b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(86, 233, 255, .12)";
  context.lineWidth = 1;
  for (let x = -(distance * 5) % 48; x < canvas.width; x += 48) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, floorY); context.stroke();
  }
  for (let y = 0; y < floorY; y += 48) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
  }
  context.fillStyle = "#0d2942";
  context.fillRect(0, floorY, canvas.width, canvas.height - floorY);
  context.fillStyle = "#5ee7ed";
  context.fillRect(0, floorY, canvas.width, 5);
}

function drawPlayer() {
  const centerX = player.x + player.size / 2;
  const centerY = player.y + player.size / 2;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(mode === "cube" || mode === "ball" ? player.rotation : 0);
  context.fillStyle = "#ffe45c";
  context.strokeStyle = "#161d52";
  context.lineWidth = Math.max(3, 5 * sizeScale);
  const s = player.size;
  if (mode === "ship") {
    context.beginPath(); context.moveTo(s / 2, 0); context.lineTo(-s / 2, -s / 2); context.lineTo(-s / 3, 0); context.lineTo(-s / 2, s / 2); context.closePath(); context.fill(); context.stroke();
  } else if (mode === "ball") {
    context.beginPath(); context.arc(0, 0, s / 2, 0, Math.PI * 2); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(-s / 2, 0); context.lineTo(s / 2, 0); context.stroke();
  } else if (mode === "ufo") {
    context.beginPath(); context.arc(0, -2, s / 3, Math.PI, 0); context.lineTo(s / 2, s / 4); context.lineTo(-s / 2, s / 4); context.closePath(); context.fill(); context.stroke();
  } else if (mode === "wave") {
    context.beginPath(); context.moveTo(s / 2, 0); context.lineTo(0, -s / 2); context.lineTo(-s / 2, 0); context.lineTo(0, s / 2); context.closePath(); context.fill(); context.stroke();
  } else if (mode === "robot") {
    context.fillRect(-s / 2, -s / 2, s, s * .72); context.strokeRect(-s / 2, -s / 2, s, s * .72);
    context.beginPath(); context.moveTo(-s / 3, s / 5); context.lineTo(-s / 3, s / 2); context.moveTo(s / 3, s / 5); context.lineTo(s / 3, s / 2); context.stroke();
  } else if (mode === "spider") {
    context.beginPath(); context.moveTo(0, -s / 2); context.lineTo(s / 2, 0); context.lineTo(0, s / 2); context.lineTo(-s / 2, 0); context.closePath(); context.fill(); context.stroke();
    for (const side of [-1, 1]) { context.beginPath(); context.moveTo(side * s / 3, -s / 5); context.lineTo(side * s / 2, -s / 2); context.moveTo(side * s / 3, s / 5); context.lineTo(side * s / 2, s / 2); context.stroke(); }
  } else {
    context.fillRect(-s / 2, -s / 2, s, s); context.strokeRect(-s / 2, -s / 2, s, s);
    context.fillStyle = "#161d52"; context.fillRect(-s * .24, -s * .18, s * .13, s * .13); context.fillRect(s * .11, -s * .18, s * .13, s * .13);
  }
  context.restore();
}

function drawPortal(gizmo: Gizmo) {
  const style = portalStyles[gizmo.portalEffect!];
  context.save();
  context.translate(gizmo.x, gizmo.y);
  context.globalAlpha = gizmo.used ? 0.25 : 1;
  context.shadowColor = style.color;
  context.shadowBlur = 22;
  context.strokeStyle = style.color;
  context.lineWidth = 8;
  context.beginPath(); context.ellipse(0, 0, 25, 56, 0, 0, Math.PI * 2); context.stroke();
  context.lineWidth = 3;
  context.setLineDash([6, 7]);
  context.beginPath(); context.ellipse(0, 0, 34, 66, 0, 0, Math.PI * 2); context.stroke();
  context.setLineDash([]);
  context.fillStyle = style.color;
  context.font = "bold 29px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(style.symbol, 0, 0);
  context.restore();
}

function draw() {
  drawBackground();
  for (const obstacle of obstacles) {
    context.fillStyle = obstacle.kind === "block" ? "#664ce8" : "#f14d75";
    context.strokeStyle = "#b9f7ff"; context.lineWidth = 3;
    if (obstacle.kind === "spike") {
      const spikeBaseY = obstacle.spikeDirection === "up" ? obstacle.y + obstacle.height : obstacle.y;
      const spikeTipY = obstacle.spikeDirection === "up" ? obstacle.y : obstacle.y + obstacle.height;
      context.beginPath();
      context.moveTo(obstacle.x, spikeBaseY);
      context.lineTo(obstacle.x + obstacle.width / 2, spikeTipY);
      context.lineTo(obstacle.x + obstacle.width, spikeBaseY);
      context.closePath();
      context.fill();
      context.stroke();
    } else { context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height); context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height); }
  }
  for (const gizmo of gizmos) {
    if (gizmo.kind === "portal") drawPortal(gizmo);
    else if (gizmo.kind === "orb") {
      context.fillStyle = gizmo.used ? "#676b78" : "#ffec66"; context.strokeStyle = "#fff"; context.lineWidth = 4;
      context.beginPath(); context.arc(gizmo.x, gizmo.y, 18, 0, Math.PI * 2); context.fill(); context.stroke();
    } else {
      context.fillStyle = gizmo.used ? "#676b78" : "#ff66c4";
      context.beginPath(); context.moveTo(gizmo.x - 28, floorY); context.lineTo(gizmo.x - 18, floorY - 16); context.lineTo(gizmo.x + 18, floorY - 16); context.lineTo(gizmo.x + 28, floorY); context.closePath(); context.fill();
    }
  }
  drawPlayer();
  if (portalNoticeTime > 0) {
    context.fillStyle = `rgba(255,255,255,${Math.min(1, portalNoticeTime * 2)})`;
    context.font = "bold 30px sans-serif"; context.textAlign = "center";
    context.fillText(portalNotice, canvas.width / 2, 55);
  }
}

function frame(time: number) {
  const dt = Math.min(0.033, (time - lastTime) / 1000 || 0);
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", () => { inputHeld = true; startMusic(); startOrAct(); });
window.addEventListener("pointerup", () => { inputHeld = false; });
window.addEventListener("pointercancel", () => { inputHeld = false; });
window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) { inputHeld = true; startMusic(); startOrAct(); }
  }
});
window.addEventListener("keyup", (event) => { if (["Space", "ArrowUp", "KeyW"].includes(event.code)) inputHeld = false; });

draw();
requestAnimationFrame(frame);
export {};
