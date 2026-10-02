import { isGigantic } from "../../shared/bigGames";

// GIGANTIC Feed Your Fire: your fire stays its normal size; the log, the
// sparks, the city, the rain and everything else go giant.
const GIGANTIC = isGigantic("feed-your-fire");
const GIANT = GIGANTIC ? 3 : 1;
if (GIGANTIC) document.title = "GIGANTIC Feed Your Fire";

interface Gasoline {
  id: string;
  name: string;
  color: string;
  glow: string;
  cost: number;
  fuel: number;
  unlocksAtLevel: number;
}

const GASOLINES: Gasoline[] = [
  { id: "red", name: "Red", color: "#ff3b2f", glow: "#ff7a55", cost: 1, fuel: 1, unlocksAtLevel: 1 },
  { id: "blue", name: "Blue", color: "#3b7bff", glow: "#7ab1ff", cost: 4, fuel: 5, unlocksAtLevel: 2 },
  { id: "green", name: "Green", color: "#3fcc55", glow: "#8cffa0", cost: 12, fuel: 18, unlocksAtLevel: 3 },
  { id: "yellow", name: "Yellow", color: "#ffd23a", glow: "#fff08a", cost: 35, fuel: 60, unlocksAtLevel: 4 },
  { id: "purple", name: "Purple", color: "#a855f7", glow: "#d7a9ff", cost: 90, fuel: 180, unlocksAtLevel: 5 },
  { id: "orange", name: "Orange", color: "#ff8a1f", glow: "#ffc080", cost: 220, fuel: 520, unlocksAtLevel: 6 },
  { id: "cyan", name: "Cyan", color: "#22e6e6", glow: "#a0fff8", cost: 550, fuel: 1400, unlocksAtLevel: 7 },
  { id: "rainbow", name: "Rainbow", color: "#ff66cc", glow: "#ffffff", cost: 1400, fuel: 4200, unlocksAtLevel: 8 },
];

const LEVEL_NAMES = [
  "Ember",
  "Flicker",
  "Flame",
  "Blaze",
  "Bonfire",
  "Inferno",
  "Pyre",
  "Sunfire",
  "Rainbow Star",
];

const LEVEL_THRESHOLDS = [0, 5, 25, 90, 280, 800, 2200, 5600, 14000];

const FIRE_COLORS: Array<{ inner: string; outer: string; spark: string }> = [
  { inner: "#ffd680", outer: "#ff5b1f", spark: "#ffe27a" },
  { inner: "#aac8ff", outer: "#3b7bff", spark: "#dce9ff" },
  { inner: "#c7ffd6", outer: "#3fcc55", spark: "#e7ffe0" },
  { inner: "#fff5b0", outer: "#ffd23a", spark: "#fffadf" },
  { inner: "#e0c2ff", outer: "#a855f7", spark: "#f3e0ff" },
  { inner: "#ffd2a0", outer: "#ff8a1f", spark: "#ffe7c8" },
  { inner: "#bff8f8", outer: "#22e6e6", spark: "#e0fffd" },
  { inner: "#ffffff", outer: "#ff66cc", spark: "#ffffff" },
  { inner: "#ffffff", outer: "#000000", spark: "#ffffff" }, // rainbow-beyond uses dynamic color
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  rainbow: boolean;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const levelLabel = document.getElementById("level-label") as HTMLDivElement;
const coinsLabel = document.getElementById("coins-label") as HTMLDivElement;
const meterFill = document.getElementById("meter-fill") as HTMLDivElement;
const gasList = document.getElementById("gas-list") as HTMLDivElement;
const secretBtn = document.getElementById("secret-btn") as HTMLButtonElement;
const secretZone = document.getElementById("secret-zone") as HTMLDivElement;
const secretHint = document.getElementById("secret-hint") as HTMLDivElement;
const toastEl = document.getElementById("toast") as HTMLDivElement;
const hintEl = document.getElementById("hint") as HTMLSpanElement;
const cutsceneTextEl = document.getElementById("cutscene-text") as HTMLDivElement;
const replayBtn = document.getElementById("replay-btn") as HTMLButtonElement;
const surrenderBtn = document.getElementById("surrender-btn") as HTMLButtonElement;

surrenderBtn.addEventListener("click", () => {
  const ok = window.confirm("Surrender? Your fire and coins will be reset to Level 1.");
  if (ok) {
    clearSave();
    window.location.reload();
  }
});

type Mode = "play" | "takeover" | "boss" | "watering" | "ending" | "kaboom";

interface WaterDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

const state = {
  level: 1,
  fuel: 0,
  coins: 0,
  reachedLevel8: false,
  rainbowBeyondUnlocked: false,
  particles: [] as Particle[],
  mode: "play" as Mode,
  modeTimer: 0,
  bossHp: 30,
  bossMaxHp: 30,
  bossShake: 0,
  waterDrops: [] as WaterDrop[],
  steam: [] as Particle[],
};

const BOSS_MAX_HP = 30;
const TAKEOVER_DURATION = 4.5;
const WATERING_DURATION = 4.5;

const SAVE_KEY = "feed-your-fire-save-v1";
const SAVE_INTERVAL_MS = 2000;

interface SaveData {
  level: number;
  fuel: number;
  coins: number;
  reachedLevel8: boolean;
  rainbowBeyondUnlocked: boolean;
}

function saveGame() {
  try {
    const data: SaveData = {
      level: state.level,
      fuel: state.fuel,
      coins: state.coins,
      reachedLevel8: state.reachedLevel8,
      rainbowBeyondUnlocked: state.rainbowBeyondUnlocked,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage might be unavailable; ignore.
  }
}

function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data.level === "number") state.level = Math.max(1, Math.min(9, data.level));
    if (typeof data.fuel === "number") state.fuel = Math.max(0, data.fuel);
    if (typeof data.coins === "number") state.coins = Math.max(0, data.coins);
    if (typeof data.reachedLevel8 === "boolean") state.reachedLevel8 = data.reachedLevel8;
    if (typeof data.rainbowBeyondUnlocked === "boolean") {
      state.rainbowBeyondUnlocked = data.rainbowBeyondUnlocked;
    }
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvasWidth = canvas.clientWidth;
  canvasHeight = canvas.clientHeight;
  canvas.width = Math.floor(canvasWidth * dpr);
  canvas.height = Math.floor(canvasHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

function showToast(msg: string, durationMs = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  window.clearTimeout((showToast as unknown as { _t?: number })._t);
  (showToast as unknown as { _t?: number })._t = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, durationMs);
}

function currentMaxLevel(): number {
  return state.rainbowBeyondUnlocked ? 9 : 8;
}

function fuelNeededForNext(): number {
  const max = currentMaxLevel();
  if (state.level >= max) return 0;
  return LEVEL_THRESHOLDS[state.level]!;
}

function renderShop() {
  gasList.innerHTML = "";
  for (const gas of GASOLINES) {
    const btn = document.createElement("button");
    btn.className = "gas-btn";
    btn.type = "button";
    const unlocked = state.level >= gas.unlocksAtLevel;
    const affordable = state.coins >= gas.cost;
    btn.disabled = !unlocked;
    btn.innerHTML = `
      <span class="gas-swatch" style="background:${gas.color}; color:${gas.glow};"></span>
      <span class="gas-name">${gas.name} Gas</span>
      ${
        unlocked
          ? `<span class="gas-cost" style="${affordable ? "" : "opacity:0.55"}">🪙${gas.cost}</span>`
          : `<span class="gas-locked">Lv ${gas.unlocksAtLevel}</span>`
      }
    `;
    btn.addEventListener("click", () => {
      if (!unlocked) return;
      feedFire(gas);
    });
    gasList.appendChild(btn);
  }
}

function renderHud() {
  const max = currentMaxLevel();
  const levelName = LEVEL_NAMES[state.level - 1] ?? "Fire";
  levelLabel.textContent = `${levelName} · Level ${state.level}${state.level >= max ? " (MAX)" : ""}`;
  coinsLabel.textContent = `🪙 ${Math.floor(state.coins)}`;
  const need = fuelNeededForNext();
  const pct = need === 0 ? 100 : Math.min(100, (state.fuel / need) * 100);
  meterFill.style.width = `${pct}%`;
}

function levelUp() {
  state.level += 1;
  state.fuel = 0;
  if (state.level >= 8) state.reachedLevel8 = true;
  showToast(`🔥 Upgraded to ${LEVEL_NAMES[state.level - 1] ?? "Fire"} (Lv ${state.level})!`, 2400);
  burstParticles(120);
}

function feedFire(gas: Gasoline) {
  if (state.level < gas.unlocksAtLevel) {
    showToast(`${gas.name} gas needs Level ${gas.unlocksAtLevel}`);
    return;
  }
  if (state.coins < gas.cost) {
    showToast(`Need 🪙${gas.cost} for ${gas.name} gas`);
    return;
  }
  state.coins -= gas.cost;
  const need = fuelNeededForNext();
  if (need === 0) {
    showToast("Fire is at max level — burn baby burn!");
    burstParticles(40, gas);
    renderHud();
    renderShop();
    return;
  }
  state.fuel += gas.fuel;
  burstParticles(20 + Math.min(60, gas.fuel / 2), gas);
  while (state.fuel >= fuelNeededForNext() && state.level < currentMaxLevel()) {
    state.fuel -= fuelNeededForNext();
    levelUp();
  }
  if (state.level >= currentMaxLevel()) {
    state.fuel = 0;
  }
  renderHud();
  renderShop();
  checkSecretAvailability();
  saveGame();
}

function burstParticles(n: number, gas?: Gasoline) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.62;
  const rainbow = state.level >= 9 || gas?.id === "rainbow";
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const speed = 80 + Math.random() * 220;
    state.particles.push({
      x: cx + (Math.random() - 0.5) * 30,
      y: cy + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.9,
      size: 3 + Math.random() * 5,
      hue: Math.random() * 360,
      rainbow,
    });
  }
}

function checkSecretAvailability() {
  const available = state.reachedLevel8 && !state.rainbowBeyondUnlocked;
  secretBtn.disabled = !available;
  secretHint.classList.toggle("armed", available);
}

let secretHoverTimer: number | null = null;
function revealSecret() {
  if (!state.reachedLevel8 || state.rainbowBeyondUnlocked) return;
  secretBtn.classList.add("revealed");
}
function hideSecret() {
  if (secretHoverTimer !== null) clearTimeout(secretHoverTimer);
  secretHoverTimer = window.setTimeout(() => {
    secretBtn.classList.remove("revealed");
  }, 400);
}

secretZone.addEventListener("mouseenter", revealSecret);
secretZone.addEventListener("mousemove", revealSecret);
secretBtn.addEventListener("mouseenter", () => {
  if (secretHoverTimer !== null) clearTimeout(secretHoverTimer);
  revealSecret();
});
secretZone.addEventListener("mouseleave", hideSecret);
secretBtn.addEventListener("mouseleave", hideSecret);

secretBtn.addEventListener("click", () => {
  if (!state.reachedLevel8 || state.rainbowBeyondUnlocked) return;
  state.rainbowBeyondUnlocked = true;
  state.level = 9;
  state.fuel = 0;
  secretBtn.classList.remove("revealed");
  secretBtn.disabled = true;
  saveGame();
  startTakeover();
});

function startTakeover() {
  state.mode = "takeover";
  state.modeTimer = 0;
  document.body.classList.add("fy-cutscene");
  showCutsceneText("The fire consumes everything…", "fire");
}

function startBoss() {
  state.mode = "boss";
  state.modeTimer = 0;
  // Whatever it was doing, it's back on the stick to be eaten.
  marshmallow.flying = -1;
  chomped = false;
  state.bossHp = BOSS_MAX_HP;
  state.bossMaxHp = BOSS_MAX_HP;
  state.bossShake = 0;
  nextFlickerAt = 0.9;
  flickerEnd = 0;
  hideCutsceneText();
  // delayed warning text
  setTimeout(() => {
    if (state.mode === "boss") showCutsceneText("CLICK IT TO STOP IT!", "fire", 2200);
  }, 200);
}

function startWatering() {
  state.mode = "watering";
  state.modeTimer = 0;
  state.waterDrops = [];
  state.steam = [];
  showCutsceneText("Rain falls. Peace returns.", "water");
}

function startEnding() {
  state.mode = "ending";
  state.modeTimer = 0;
  hideCutsceneText();
  setTimeout(() => {
    replayBtn.classList.add("show");
  }, 1200);
}

function showCutsceneText(text: string, variant: "fire" | "water", autoHideMs?: number) {
  cutsceneTextEl.textContent = text;
  cutsceneTextEl.classList.toggle("water", variant === "water");
  cutsceneTextEl.classList.add("show");
  if (autoHideMs) {
    setTimeout(() => cutsceneTextEl.classList.remove("show"), autoHideMs);
  }
}
function hideCutsceneText() {
  cutsceneTextEl.classList.remove("show");
}

replayBtn.addEventListener("click", () => {
  clearSave();
  window.location.reload();
});

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}
const floatingTexts: FloatingText[] = [];

function coinsPerClick(): number {
  return state.level;
}

canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.62;

  if (state.mode === "play") {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < 200 * 200) {
      const gained = coinsPerClick();
      state.coins += gained;
      floatingTexts.push({
        x, y, vy: -60, life: 0, maxLife: 0.9,
        text: `+🪙${gained}`, color: "#ffd97a",
      });
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 60;
        state.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
          life: 0, maxLife: 0.4 + Math.random() * 0.3,
          size: 2 + Math.random() * 2, hue: 45, rainbow: state.level >= 9,
        });
      }
      renderHud();
      renderShopAffordability();
    }
    return;
  }

  if (state.mode === "boss") {
    // The boss fills most of the screen — any click in the middle band damages it.
    if (y > canvasHeight * 0.1 && y < canvasHeight * 0.95) {
      state.bossHp = Math.max(0, state.bossHp - 1);
      state.bossShake = 0.35;
      floatingTexts.push({
        x, y, vy: -80, life: 0, maxLife: 0.7,
        text: "−1", color: "#ffffff",
      });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 120;
        state.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 0, maxLife: 0.4 + Math.random() * 0.4,
          size: 2 + Math.random() * 3, hue: Math.random() * 360, rainbow: true,
        });
      }
      if (state.bossHp <= 0) {
        startWatering();
      }
    }
  }
});

let lastTime = performance.now();
let lastAutosave = performance.now();
function tick(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  state.modeTimer += dt;
  if (state.bossShake > 0) state.bossShake = Math.max(0, state.bossShake - dt);

  // update floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i]!;
    f.life += dt;
    if (f.life >= f.maxLife) {
      floatingTexts.splice(i, 1);
      continue;
    }
    f.y += f.vy * dt;
    f.vy *= 0.96;
  }

  // update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.life += dt;
    if (p.life >= p.maxLife) {
      state.particles.splice(i, 1);
      continue;
    }
    p.vy += -180 * dt;
    p.vx *= 0.96;
    p.vy *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (state.mode === "play") updateMarshmallow(dt);
  if (state.mode === "kaboom") {
    updateKaboom(dt);
    if (state.modeTimer >= KABOOM_DURATION) endKaboom();
  }

  // mode transitions
  if (state.mode === "takeover" && state.modeTimer >= TAKEOVER_DURATION) {
    startBoss();
  } else if (state.mode === "watering") {
    spawnWaterDrops(dt);
    updateWaterDrops(dt);
    if (state.modeTimer >= WATERING_DURATION) startEnding();
  }

  draw();
  if (state.mode === "play") {
    coinsLabel.textContent = `🪙 ${Math.floor(state.coins)}`;
    if (Math.random() < 0.05) renderShopAffordability();
    if (now - lastAutosave >= SAVE_INTERVAL_MS) {
      lastAutosave = now;
      saveGame();
    }
  }

  requestAnimationFrame(tick);
}

// Save on unload as a final safety net.
window.addEventListener("beforeunload", () => {
  if (state.mode === "play") saveGame();
});

function spawnWaterDrops(dt: number) {
  const rate = 220;
  const count = Math.floor(rate * dt) + (Math.random() < (rate * dt) % 1 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    state.waterDrops.push({
      x: Math.random() * canvasWidth,
      y: -20,
      vx: (Math.random() - 0.5) * 40,
      vy: 600 + Math.random() * 300,
      size: 2 + Math.random() * 4,
      life: 0,
      maxLife: 3,
    });
  }
}
function updateWaterDrops(dt: number) {
  const groundY = canvasHeight * 0.65;
  for (let i = state.waterDrops.length - 1; i >= 0; i--) {
    const d = state.waterDrops[i]!;
    d.life += dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 400 * dt;
    if (d.y > groundY || d.life > d.maxLife) {
      // spawn steam where it hits
      if (d.y > groundY && Math.random() < 0.4) {
        state.steam.push({
          x: d.x, y: groundY,
          vx: (Math.random() - 0.5) * 30,
          vy: -40 - Math.random() * 40,
          life: 0, maxLife: 1.2 + Math.random() * 0.6,
          size: 8 + Math.random() * 8,
          hue: 0, rainbow: false,
        });
      }
      state.waterDrops.splice(i, 1);
    }
  }
  for (let i = state.steam.length - 1; i >= 0; i--) {
    const s = state.steam[i]!;
    s.life += dt;
    if (s.life >= s.maxLife) {
      state.steam.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy *= 0.99;
    s.size += 8 * dt;
  }
}

function renderShopAffordability() {
  const buttons = gasList.querySelectorAll<HTMLButtonElement>(".gas-btn");
  buttons.forEach((btn, idx) => {
    const gas = GASOLINES[idx]!;
    const unlocked = state.level >= gas.unlocksAtLevel;
    if (!unlocked) return;
    const costSpan = btn.querySelector<HTMLSpanElement>(".gas-cost");
    if (costSpan) {
      costSpan.style.opacity = state.coins >= gas.cost ? "1" : "0.55";
    }
  });
}

function rainbowColor(t: number, offset = 0): string {
  const hue = ((t * 90) + offset) % 360;
  return `hsl(${hue}, 95%, 60%)`;
}

function draw() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (state.mode === "takeover") {
    drawTakeover();
    drawParticles();
    drawFloatingTexts();
    return;
  }
  if (state.mode === "boss") {
    drawBoss();
    drawParticles();
    drawFloatingTexts();
    return;
  }
  if (state.mode === "watering") {
    drawWatering();
    drawParticles();
    return;
  }
  if (state.mode === "ending") {
    drawEnding();
    return;
  }
  if (state.mode === "kaboom") {
    drawKaboom();
    return;
  }

  drawPlay();
}

function drawPlay() {
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.62;
  const t = performance.now() / 1000;

  // Log / floor
  ctx.save();
  ctx.translate(cx, cy + 40);
  ctx.scale(GIANT, GIANT);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 140, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5a3a22";
  ctx.fillRect(-90, -6, 180, 18);
  ctx.fillStyle = "#3d2614";
  for (let i = -80; i < 80; i += 18) {
    ctx.fillRect(i, -6, 2, 18);
  }
  ctx.restore();

  drawMarshmallow(t);

  // Fire core
  const lvl = state.level;
  const palette = FIRE_COLORS[lvl - 1] ?? FIRE_COLORS[0]!;
  const isRainbowBeyond = lvl >= 9;
  const baseSize = 60 + lvl * 22;
  const wobble = Math.sin(t * 6) * 4 + Math.sin(t * 11) * 2;

  // Outer glow
  const glowGrad = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, baseSize * 2.2);
  if (isRainbowBeyond) {
    glowGrad.addColorStop(0, rainbowColor(t, 0));
    glowGrad.addColorStop(0.3, rainbowColor(t, 120));
    glowGrad.addColorStop(0.6, rainbowColor(t, 240));
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    glowGrad.addColorStop(0, palette.outer);
    glowGrad.addColorStop(0.5, hexAlpha(palette.outer, 0.4));
    glowGrad.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy - 20, baseSize * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Flame body (teardrop)
  const flameH = baseSize * (1.6 + Math.sin(t * 4) * 0.05);
  const flameW = baseSize * (0.9 + wobble * 0.01);
  ctx.save();
  ctx.translate(cx, cy);
  if (isRainbowBeyond) {
    const fg = ctx.createLinearGradient(0, -flameH, 0, 20);
    fg.addColorStop(0, rainbowColor(t, 0));
    fg.addColorStop(0.5, rainbowColor(t, 90));
    fg.addColorStop(1, rainbowColor(t, 180));
    ctx.fillStyle = fg;
  } else {
    const fg = ctx.createLinearGradient(0, -flameH, 0, 20);
    fg.addColorStop(0, palette.inner);
    fg.addColorStop(0.5, palette.outer);
    fg.addColorStop(1, hexAlpha(palette.outer, 0.5));
    ctx.fillStyle = fg;
  }
  ctx.beginPath();
  ctx.moveTo(0, -flameH);
  ctx.bezierCurveTo(flameW, -flameH * 0.5, flameW * 1.1, 0, 0, 20);
  ctx.bezierCurveTo(-flameW * 1.1, 0, -flameW, -flameH * 0.5, 0, -flameH);
  ctx.fill();

  // Inner flame
  ctx.beginPath();
  ctx.fillStyle = isRainbowBeyond ? "rgba(255,255,255,0.85)" : palette.inner;
  const innerH = flameH * 0.6;
  const innerW = flameW * 0.5;
  ctx.moveTo(0, -innerH);
  ctx.bezierCurveTo(innerW, -innerH * 0.5, innerW * 1.1, 0, 0, 10);
  ctx.bezierCurveTo(-innerW * 1.1, 0, -innerW, -innerH * 0.5, 0, -innerH);
  ctx.fill();

  // Eyes (cute pet fire)
  ctx.fillStyle = "#1a0a05";
  const eyeY = -flameH * 0.45;
  const eyeBlink = (Math.sin(t * 0.7) > 0.97) ? 0.2 : 1;
  ctx.beginPath();
  ctx.ellipse(-flameW * 0.25, eyeY, 4, 5 * eyeBlink, 0, 0, Math.PI * 2);
  ctx.ellipse(flameW * 0.25, eyeY, 4, 5 * eyeBlink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-flameW * 0.25 + 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
  ctx.arc(flameW * 0.25 + 1.2, eyeY - 1.2, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = "#1a0a05";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -flameH * 0.3, flameW * 0.18, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();

  drawParticles(palette.spark);
  drawFloatingTexts();
}

// A marshmallow on a stick, held over the fire from off the screen. It toasts
// slowly, then burns, then catches fire, then falls off the stick and lands in
// the gasoline shop. A GIGANTIC one blows the shop up; a normal one is too
// small to do anything.
const TOAST_SECONDS = 45;
const BURN_SECONDS = 4;
const FLIGHT_SECONDS = 1.1;
const marshmallow = { toast: 0, burning: 0, flying: -1, warned: 0 };

// White, then golden, then brown, then burnt black.
const TOAST_COLORS: [number, [number, number, number]][] = [
  [0, [255, 247, 234]],
  [0.35, [242, 196, 109]],
  [0.65, [154, 90, 38]],
  [0.85, [58, 36, 22]],
  [1, [20, 16, 16]],
];

function toastColor(toast: number): string {
  for (let i = 1; i < TOAST_COLORS.length; i++) {
    const [to, end] = TOAST_COLORS[i]!;
    const [from, start] = TOAST_COLORS[i - 1]!;
    if (toast <= to) {
      const k = (toast - from) / (to - from);
      const mix = start.map((c, j) => Math.round(c + (end[j]! - c) * k));
      return `rgb(${mix.join(",")})`;
    }
  }
  return "rgb(20,16,16)";
}

function updateMarshmallow(dt: number) {
  if (marshmallow.flying >= 0) {
    marshmallow.flying += dt;
    const { x, y } = marshmallowSpot();
    fireTrail(x, y, 3);
    if (marshmallow.flying >= FLIGHT_SECONDS) {
      if (GIGANTIC) startKaboom();
      else fizzle();
    }
    return;
  }
  if (marshmallow.toast < 1) {
    // A bigger fire toasts it faster.
    marshmallow.toast = Math.min(1, marshmallow.toast + (dt * (1 + (state.level - 1) * 0.15)) / TOAST_SECONDS);
    const warnings: [number, string][] = [
      [0.35, "🍡 The marshmallow is getting toasty…"],
      [0.65, "🍡 Mmm, golden brown. Maybe take it out?"],
      [0.85, "🍡 It's burning…"],
      [1, "🔥 THE MARSHMALLOW IS ON FIRE!"],
    ];
    const next = warnings[marshmallow.warned];
    if (next && marshmallow.toast >= next[0]) {
      showToast(next[1], 2600);
      marshmallow.warned += 1;
    }
    return;
  }
  marshmallow.burning += dt;
  if (marshmallow.burning >= BURN_SECONDS) {
    marshmallow.flying = 0;
    showToast("😱 It fell off the stick!", 1600);
  }
}

// Secret: type "boom" and the marshmallow skips straight to being on fire.
const BOOM_WORD = "boom";
let typedBoom = "";
window.addEventListener("keydown", (event) => {
  if (event.key.length !== 1) return;
  typedBoom = (typedBoom + event.key.toLowerCase()).slice(-BOOM_WORD.length);
  if (typedBoom !== BOOM_WORD || state.mode !== "play" || marshmallow.flying >= 0) return;
  typedBoom = "";
  marshmallow.toast = 1;
  marshmallow.warned = 4;
  marshmallow.burning = BURN_SECONDS - 0.8;
  showToast("🔥 BOOM? Okay then.", 1200);
});

function stickTip(t: number): { x: number; y: number } {
  const sway = Math.sin(t * 0.8) * 10;
  return { x: canvasWidth / 2 + 150, y: canvasHeight * 0.62 - 170 + sway };
}

// Where the shop is on the screen, which is where the marshmallow is headed.
function shopSpot(): { x: number; y: number } {
  const rect = shopWrap.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// On the stick, or partway along its flight into the shop.
function marshmallowSpot(): { x: number; y: number } {
  const tip = stickTip(performance.now() / 1000);
  if (marshmallow.flying < 0) return tip;
  const k = Math.min(1, marshmallow.flying / FLIGHT_SECONDS);
  const shop = shopSpot();
  return {
    x: tip.x + (shop.x - tip.x) * k,
    y: tip.y + (shop.y - tip.y) * k - Math.sin(k * Math.PI) * 220,
  };
}

function fireTrail(x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 40 * GIANT,
      y: y + (Math.random() - 0.5) * 30 * GIANT,
      vx: (Math.random() - 0.5) * 60,
      vy: -40 - Math.random() * 80,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.5,
      size: 3 + Math.random() * 4,
      hue: 20 + Math.random() * 30,
      rainbow: false,
    });
  }
}

function drawMarshmallow(t: number) {
  const tip = stickTip(t);
  ctx.save();
  ctx.strokeStyle = "#6b4426";
  ctx.lineWidth = 8 * GIANT;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(canvasWidth + 40, tip.y - 160);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.restore();
  // Once it's in the shop there's nothing left on the stick.
  if (marshmallow.flying >= FLIGHT_SECONDS) return;

  const { x, y } = marshmallowSpot();
  const spin = marshmallow.flying >= 0 ? marshmallow.flying * 9 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25 + spin);
  ctx.fillStyle = toastColor(marshmallow.toast);
  ctx.strokeStyle = marshmallow.toast > 0.6 ? "#1d120b" : "#e8c9a0";
  ctx.lineWidth = 3 * GIANT;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26 * GIANT, 20 * GIANT, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // The side nearest the fire toasts first.
  ctx.fillStyle = `rgba(90, 45, 15, ${0.35 + marshmallow.toast * 0.5})`;
  ctx.beginPath();
  ctx.ellipse(-8 * GIANT, 10 * GIANT, 14 * GIANT, 8 * GIANT, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Smoke once it starts to burn.
  if (marshmallow.toast > 0.7) {
    const puffs = Math.round((marshmallow.toast - 0.7) * 20);
    for (let i = 0; i < puffs; i++) {
      const k = (t * 0.6 + i / Math.max(1, puffs)) % 1;
      ctx.fillStyle = `rgba(60, 60, 60, ${0.45 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 2 + i) * 12 * GIANT, y - 20 * GIANT - k * 90 * GIANT, (6 + k * 14) * GIANT, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // And then it catches fire.
  if (marshmallow.toast >= 1) {
    const size = Math.min(1, marshmallow.burning / 1.5 + 0.3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const fx = x + (i - 2) * 9 * GIANT;
      const h = (34 + Math.sin(t * 13 + i * 2) * 8) * GIANT * size;
      const w = 12 * GIANT * size;
      const g = ctx.createLinearGradient(fx, y - h, fx, y);
      g.addColorStop(0, "rgba(255, 240, 150, 0)");
      g.addColorStop(0.4, "rgba(255, 170, 40, 0.9)");
      g.addColorStop(1, "rgba(255, 70, 0, 0.9)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(fx, y - h);
      ctx.bezierCurveTo(fx + w, y - h * 0.5, fx + w, y, fx, y + 4 * GIANT);
      ctx.bezierCurveTo(fx - w, y, fx - w, y - h * 0.5, fx, y - h);
      ctx.fill();
    }
    ctx.restore();
  }
}

function resetMarshmallow() {
  marshmallow.toast = 0;
  marshmallow.burning = 0;
  marshmallow.flying = -1;
  marshmallow.warned = 0;
}

// A normal-sized marshmallow lands in the shop and... nothing. A puff of
// smoke, a little wobble, and that's it.
function fizzle() {
  const shop = shopSpot();
  for (let i = 0; i < 14; i++) {
    state.particles.push({
      x: shop.x + (Math.random() - 0.5) * 20,
      y: shop.y,
      vx: (Math.random() - 0.5) * 50,
      vy: -20 - Math.random() * 40,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.4,
      size: 2 + Math.random() * 2,
      hue: 0,
      rainbow: false,
    });
  }
  shopWrap.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-1.5deg)" },
      { transform: "rotate(1.5deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 300 }
  );
  showToast("🍡 *pff*… It was too small to do anything.", 3000);
  resetMarshmallow();
}

// ── The gasoline shop explodes ────────────────────────────────────────────

const KABOOM_DURATION = 9;
const shopWrap = document.querySelector(".shop-wrap") as HTMLElement;
const appEl = document.getElementById("app") as HTMLElement;

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  color: string;
  landed: boolean;
}

const kaboom = { x: 0, y: 0, debris: [] as Debris[] };

function startKaboom() {
  state.mode = "kaboom";
  state.modeTimer = 0;
  const shop = shopSpot();
  kaboom.x = shop.x;
  kaboom.y = shop.y;
  kaboom.debris = [];
  for (let i = 0; i < 90; i++) {
    const gas = GASOLINES[i % GASOLINES.length]!;
    // Mostly up and away from the corner the shop is in.
    const angle = -Math.PI / 2 - Math.random() * Math.PI * 0.75 + 0.2;
    const speed = 500 + Math.random() * 1300;
    kaboom.debris.push({
      x: shop.x,
      y: shop.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 18,
      angle: Math.random() * Math.PI * 2,
      size: (6 + Math.random() * 10) * GIANT,
      color: gas.color,
      landed: false,
    });
  }

  // Blow the shop's own buttons off the screen.
  shopWrap.querySelectorAll<HTMLElement>(".gas-btn, .shop h2").forEach((piece) => {
    const dx = -200 - Math.random() * 900;
    const dy = -300 - Math.random() * 700;
    piece.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${(Math.random() - 0.5) * 1440}deg) scale(${1 + Math.random() * 2})`, opacity: 0 },
      ],
      { duration: 1400 + Math.random() * 800, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }
    );
  });
  shopWrap.querySelector<HTMLElement>(".shop")?.animate(
    [
      { transform: "scale(1)", opacity: 1, filter: "brightness(1)" },
      { transform: "scale(1.3)", opacity: 1, filter: "brightness(4)", offset: 0.15 },
      { transform: "scale(0.2) rotate(40deg)", opacity: 0, filter: "brightness(1)" },
    ],
    { duration: 900, fill: "forwards" }
  );
  appEl.animate(
    Array.from({ length: 24 }, (_, i) => {
      const k = 40 * (1 - i / 24);
      return { transform: `translate(${(Math.random() - 0.5) * k}px, ${(Math.random() - 0.5) * k}px)` };
    }),
    { duration: 2200 }
  );

  showCutsceneText("KA-BOOOOOM!!!", "fire", 2300);
  setTimeout(() => {
    if (state.mode === "kaboom") showCutsceneText("The gasoline shop exploded", "fire", 2600);
  }, 2800);
  setTimeout(() => {
    if (state.mode === "kaboom") showCutsceneText("Your fire is fine. Somehow.", "fire", 2400);
  }, 5900);
}

function updateKaboom(dt: number) {
  const ground = canvasHeight * 0.62 + 40 + 20 * GIANT;
  for (const d of kaboom.debris) {
    if (d.landed) continue;
    d.vy += 1400 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += d.spin * dt;
    // Spilled gas lands and keeps burning in its own colour.
    if (d.vy > 0 && d.y >= ground) {
      d.y = ground;
      d.landed = true;
    }
  }
  if (state.modeTimer < 3) fireTrail(kaboom.x, kaboom.y, 4);
}

function endKaboom() {
  state.mode = "play";
  state.modeTimer = 0;
  hideCutsceneText();
  resetMarshmallow();
  shopWrap.querySelectorAll<HTMLElement>(".gas-btn, .shop h2, .shop").forEach((piece) => {
    piece.getAnimations().forEach((animation) => animation.cancel());
  });
  renderShop();
  shopWrap.animate(
    [
      { transform: "translateY(120%)", opacity: 0 },
      { transform: "none", opacity: 1 },
    ],
    { duration: 600, easing: "cubic-bezier(.2,1.4,.4,1)" }
  );
  showToast("🏗️ The shop has been rebuilt. Keep marshmallows away from the gasoline!", 3600);
}

function drawKaboom() {
  const t = state.modeTimer;
  const now = performance.now() / 1000;
  drawPlay();

  // The fireball: giant, of course.
  const grow = Math.min(1, t / 1.1);
  const fade = t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) / 2);
  const maxR = Math.hypot(canvasWidth, canvasHeight) * 0.9;
  const r = maxR * (1 - Math.pow(1 - grow, 3));
  if (fade > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(kaboom.x, kaboom.y, 0, kaboom.x, kaboom.y, Math.max(1, r));
    g.addColorStop(0, `rgba(255, 255, 220, ${fade})`);
    g.addColorStop(0.25, `rgba(255, 200, 60, ${0.9 * fade})`);
    g.addColorStop(0.55, `rgba(255, 80, 0, ${0.7 * fade})`);
    g.addColorStop(1, "rgba(120, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(kaboom.x, kaboom.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Shockwaves.
  for (let i = 0; i < 4; i++) {
    const ring = t - i * 0.3;
    if (ring <= 0 || ring > 1.6) continue;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * (1 - ring / 1.6)})`;
    ctx.lineWidth = 6 * GIANT * (1 - ring / 1.6) + 1;
    ctx.beginPath();
    ctx.arc(kaboom.x, kaboom.y, ring * 1300, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Flying gas cans, and puddles of burning gas where they land.
  for (const d of kaboom.debris) {
    if (d.landed) {
      const h = (14 + Math.sin(now * 12 + d.x) * 5) * GIANT * 0.6;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = d.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, (KABOOM_DURATION - t) / 1.5));
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - h);
      ctx.quadraticCurveTo(d.x + d.size * 0.6, d.y, d.x, d.y);
      ctx.quadraticCurveTo(d.x - d.size * 0.6, d.y, d.x, d.y - h);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    ctx.fillStyle = d.color;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.fillRect(-d.size / 2, -d.size * 0.7, d.size, d.size * 1.4);
    ctx.strokeRect(-d.size / 2, -d.size * 0.7, d.size, d.size * 1.4);
    ctx.fillStyle = "#222";
    ctx.fillRect(-d.size * 0.2, -d.size * 0.95, d.size * 0.4, d.size * 0.25);
    ctx.restore();
  }

  // The flash right at the start.
  if (t < 0.5) {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - t / 0.5})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  drawParticles("#ffd27a");
}

function drawParticles(sparkColor = "#ffffff") {
  const t = performance.now() / 1000;
  ctx.globalCompositeOperation = "lighter";
  for (const p of state.particles) {
    const lifeT = p.life / p.maxLife;
    const alpha = (1 - lifeT) * 0.9;
    const size = p.size * GIANT * (1 - lifeT * 0.5);
    if (p.rainbow) {
      ctx.fillStyle = `hsla(${(p.hue + t * 120) % 360}, 95%, 65%, ${alpha})`;
    } else {
      ctx.fillStyle = `${sparkColor}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawFloatingTexts() {
  ctx.font = `bold ${18 * GIANT}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of floatingTexts) {
    const ft = f.life / f.maxLife;
    const alpha = 1 - ft;
    ctx.fillStyle = `${f.color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.fillText(f.text, f.x, f.y);
  }
}

function drawTakeover() {
  const t = performance.now() / 1000;
  const p = Math.min(1, state.modeTimer / TAKEOVER_DURATION);
  // Sky tint: dark -> blood red
  const skyTop = `rgba(${Math.floor(20 + 120 * p)}, ${Math.floor(8 - 8 * p)}, ${Math.floor(12 - 12 * p)}, 1)`;
  const skyBot = `rgba(${Math.floor(255 * p)}, ${Math.floor(60 * p)}, 0, 1)`;
  const sky = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // City silhouette
  const groundY = canvasHeight * 0.82;
  ctx.fillStyle = "#0a0508";
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  let bx = 0;
  while (bx < canvasWidth) {
    const bw = 30 + Math.random() * 0; // deterministic-ish
    const bh = (40 + ((bx * 37) % 90)) * GIANT;
    ctx.rect(bx, groundY - bh, 28 * GIANT, bh);
    bx += 32 * GIANT;
  }
  ctx.fill();
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);

  // Growing fire fills the screen
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.62;
  const startSize = 60 + 8 * 22;
  const endSize = Math.max(canvasWidth, canvasHeight) * 0.9;
  const size = startSize + (endSize - startSize) * (p * p);

  const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  fg.addColorStop(0, "#ffffff");
  fg.addColorStop(0.2, rainbowColor(t, 0));
  fg.addColorStop(0.5, rainbowColor(t, 120));
  fg.addColorStop(0.8, rainbowColor(t, 240));
  fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Spawn rising rainbow particles
  if (Math.random() < 0.8) {
    state.particles.push({
      x: cx + (Math.random() - 0.5) * canvasWidth * 0.4,
      y: cy + Math.random() * 60,
      vx: (Math.random() - 0.5) * 80,
      vy: -120 - Math.random() * 160,
      life: 0, maxLife: 1.0 + Math.random() * 0.8,
      size: 4 + Math.random() * 6,
      hue: Math.random() * 360, rainbow: true,
    });
  }
}

function drawBoss() {
  const t = performance.now() / 1000;
  // Dark stormy background with rainbow auroras
  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bg.addColorStop(0, "#1a0030");
  bg.addColorStop(1, "#08000c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Aurora bands
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    const grad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, rainbowColor(t * 0.3, i * 90));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, canvasHeight * (0.15 + i * 0.15) + Math.sin(t + i) * 20, canvasWidth, 40);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  const cx = canvasWidth / 2 + (Math.random() - 0.5) * state.bossShake * 20;
  const cy = canvasHeight * 0.55 + (Math.random() - 0.5) * state.bossShake * 20;
  const hpFrac = state.bossHp / state.bossMaxHp;
  const baseSize = Math.min(canvasWidth, canvasHeight) * 0.35 * (0.7 + hpFrac * 0.3);

  // Outer glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseSize * 2.2);
  glow.addColorStop(0, rainbowColor(t, 0));
  glow.addColorStop(0.4, rainbowColor(t, 180));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, baseSize * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Flame body (giant teardrop)
  const flameH = baseSize * 1.8;
  const flameW = baseSize * (1.1 + Math.sin(t * 4) * 0.04);
  ctx.save();
  ctx.translate(cx, cy);
  const fg = ctx.createLinearGradient(0, -flameH, 0, flameH * 0.3);
  fg.addColorStop(0, rainbowColor(t, 0));
  fg.addColorStop(0.4, rainbowColor(t, 90));
  fg.addColorStop(0.8, rainbowColor(t, 180));
  fg.addColorStop(1, rainbowColor(t, 270));
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -flameH);
  ctx.bezierCurveTo(flameW, -flameH * 0.5, flameW * 1.15, flameH * 0.1, 0, flameH * 0.3);
  ctx.bezierCurveTo(-flameW * 1.15, flameH * 0.1, -flameW, -flameH * 0.5, 0, -flameH);
  ctx.fill();

  // Face: occasionally flickers to the original cute pet-fire face for one frame.
  const flicker = isFlickerFrame();
  if (flicker) {
    drawCutePetFace(flameW, flameH, t);
  } else {
    drawEvenCreepierFace(flameW, flameH, t);
  }
  ctx.restore();
  drawBossMarshmallow(cx, cy, flameW, flameH);

  // HP bar
  const barW = canvasWidth * 0.5;
  const barH = 18;
  const barX = (canvasWidth - barW) / 2;
  const barY = 30;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
  const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  hpGrad.addColorStop(0, "#ff2266");
  hpGrad.addColorStop(0.5, "#ffaa00");
  hpGrad.addColorStop(1, "#ffee44");
  ctx.fillStyle = hpGrad;
  ctx.fillRect(barX, barY, barW * hpFrac, barH);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`THE FIRE — ${state.bossHp} / ${state.bossMaxHp}`, canvasWidth / 2, barY + barH / 2);
}

// The boss chomps the marshmallow off its stick as it arrives, and it stays
// stuck in its teeth for the whole fight.
const CHOMP_AT = 1.1;
let chomped = false;

function drawBossMarshmallow(cx: number, cy: number, flameW: number, flameH: number) {
  const t = state.modeTimer;
  const mouthW = flameW * 0.72;
  const mouthH = flameH * 0.22;
  const size = flameW * 0.09 * (GIGANTIC ? 2 : 1);
  const bite = { x: cx + mouthW * 0.15, y: cy + mouthH * 0.5 };

  if (t >= CHOMP_AT && !chomped) {
    chomped = true;
    state.bossShake = 0.5;
  }

  // The stick: in towards the mouth, then pulled back out snapped off.
  if (t < CHOMP_AT + 0.8) {
    const inK = Math.min(1, t / CHOMP_AT);
    const outK = Math.max(0, (t - CHOMP_AT) / 0.8);
    const reach = (1 - Math.pow(1 - inK, 3)) * (1 - outK * outK);
    const startX = canvasWidth + 60;
    const startY = cy - flameH * 0.6;
    const tipX = startX + (bite.x - startX) * reach;
    const tipY = startY + (bite.y - startY) * reach;
    ctx.save();
    ctx.strokeStyle = "#6b4426";
    ctx.lineWidth = 8 * GIANT;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(startX + 300, startY - 160);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();
    if (!chomped) drawMarshmallowBlob(tipX, tipY, size, -0.25);
  }

  if (!chomped) return;

  // Stuck between the teeth. It wobbles when the boss gets hit.
  const stuck = { x: cx + mouthW * 0.38, y: cy + mouthH * 0.12 };
  drawMarshmallowBlob(stuck.x, stuck.y, size * 0.85, 0.4 + Math.sin(t * 3) * 0.08);

  const chompAge = t - CHOMP_AT;
  if (chompAge < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - chompAge;
    ctx.font = `900 ${Math.round(flameW * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6;
    const y = bite.y + mouthH * 1.6 - chompAge * 40;
    ctx.strokeText("CHOMP!", cx, y);
    ctx.fillText("CHOMP!", cx, y);
    ctx.restore();
  }
}

// One marshmallow, toasted however far it got before the boss showed up.
function drawMarshmallowBlob(x: number, y: number, size: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = toastColor(marshmallow.toast);
  ctx.strokeStyle = marshmallow.toast > 0.6 ? "#1d120b" : "#e8c9a0";
  ctx.lineWidth = Math.max(2, size * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Boss face flicker: every ~0.9–1.8s, show the cute face for ~220ms.
let nextFlickerAt = 0.9;
let flickerEnd = 0;
function isFlickerFrame(): boolean {
  const tNow = state.modeTimer;
  if (tNow >= nextFlickerAt && tNow > flickerEnd) {
    flickerEnd = tNow + 0.22;
    nextFlickerAt = tNow + 0.9 + Math.random() * 0.9;
  }
  return tNow < flickerEnd;
}

function drawCutePetFace(flameW: number, flameH: number, _t: number) {
  // Drawn in the SAME spot as the creepy face so the swap is unmistakable.
  // Eyes — round, big, friendly.
  const eyeOff = flameW * 0.3;
  const eyeY = -flameH * 0.22;
  const eyeR = flameW * 0.11;
  ctx.fillStyle = "#1a0a05";
  ctx.beginPath();
  ctx.ellipse(-eyeOff, eyeY, eyeR, eyeR * 1.1, 0, 0, Math.PI * 2);
  ctx.ellipse(eyeOff, eyeY, eyeR, eyeR * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // White sparkle highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-eyeOff + eyeR * 0.35, eyeY - eyeR * 0.4, eyeR * 0.3, 0, Math.PI * 2);
  ctx.arc(eyeOff + eyeR * 0.35, eyeY - eyeR * 0.4, eyeR * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Rosy blush dots
  ctx.fillStyle = "rgba(255, 130, 130, 0.55)";
  ctx.beginPath();
  ctx.arc(-flameW * 0.55, -flameH * 0.05, flameW * 0.08, 0, Math.PI * 2);
  ctx.arc(flameW * 0.55, -flameH * 0.05, flameW * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Big curved smile (positioned over where the creepy mouth would be)
  ctx.strokeStyle = "#1a0a05";
  ctx.lineWidth = Math.max(4, flameW * 0.03);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -flameH * 0.05, flameW * 0.38, 0.25, Math.PI - 0.25);
  ctx.stroke();
}

function drawEvenCreepierFace(flameW: number, flameH: number, t: number) {
  // Heavy eyebrows — drawn first so they look like brow ridges over the eyes.
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(4, flameW * 0.025);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-flameW * 0.5, -flameH * 0.42);
  ctx.lineTo(-flameW * 0.12, -flameH * 0.28);
  ctx.moveTo(flameW * 0.5, -flameH * 0.42);
  ctx.lineTo(flameW * 0.12, -flameH * 0.28);
  ctx.stroke();

  // Sunken eye sockets (bigger, deeper, darker)
  const eyeOff = flameW * 0.32;
  const eyeY = -flameH * 0.22;
  ctx.fillStyle = "#000";
  ctx.save();
  ctx.translate(-eyeOff, eyeY);
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, flameW * 0.22, flameW * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(eyeOff, eyeY);
  ctx.rotate(0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, flameW * 0.22, flameW * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bloody glowing pupils, larger, with a halo
  const pupilPulse = 1 + Math.sin(t * 6) * 0.25;
  // pupil halo
  ctx.globalCompositeOperation = "lighter";
  for (const sx of [-1, 1]) {
    const px = sx * eyeOff * 0.9;
    const py = eyeY;
    const halo = ctx.createRadialGradient(px, py, 0, px, py, flameW * 0.12);
    halo.addColorStop(0, "rgba(255, 30, 30, 0.95)");
    halo.addColorStop(1, "rgba(255, 30, 30, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, flameW * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ff0a0a";
  ctx.beginPath();
  ctx.arc(-eyeOff * 0.9, eyeY, flameW * 0.04 * pupilPulse, 0, Math.PI * 2);
  ctx.arc(eyeOff * 0.9, eyeY, flameW * 0.04 * pupilPulse, 0, Math.PI * 2);
  ctx.fill();

  // Blood/tar drips below each eye
  ctx.fillStyle = "rgba(120, 0, 0, 0.9)";
  for (const sx of [-1, 1]) {
    const baseX = sx * eyeOff * 0.95;
    const dripLen = flameH * 0.18 + Math.sin(t * 1.3 + sx) * 4;
    ctx.beginPath();
    ctx.moveTo(baseX - 3, eyeY + 6);
    ctx.lineTo(baseX + 3, eyeY + 6);
    ctx.lineTo(baseX, eyeY + dripLen);
    ctx.closePath();
    ctx.fill();
  }

  // Huge gaping mouth — taller, wider, with curved arch
  const mouthYTop = flameH * 0.0;
  const mouthW = flameW * 0.72;
  const mouthH = flameH * 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(-mouthW, mouthYTop);
  ctx.quadraticCurveTo(0, mouthYTop - mouthH * 0.15, mouthW, mouthYTop);
  ctx.quadraticCurveTo(mouthW * 0.92, mouthYTop + mouthH * 1.1, 0, mouthYTop + mouthH * 1.15);
  ctx.quadraticCurveTo(-mouthW * 0.92, mouthYTop + mouthH * 1.1, -mouthW, mouthYTop);
  ctx.closePath();
  ctx.fill();

  // Inner mouth glow (red maw)
  const maw = ctx.createRadialGradient(0, mouthYTop + mouthH * 0.5, 0, 0, mouthYTop + mouthH * 0.5, mouthW * 0.9);
  maw.addColorStop(0, "rgba(180, 0, 0, 0.8)");
  maw.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = maw;
  ctx.beginPath();
  ctx.ellipse(0, mouthYTop + mouthH * 0.5, mouthW * 0.85, mouthH * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jagged teeth — uneven, sharp, more of them
  ctx.fillStyle = "#f5ecd2";
  const teethCount = 13;
  for (let i = 0; i < teethCount; i++) {
    const ratio = (i + 0.5) / teethCount;
    const tx = -mouthW * 0.92 + ratio * (mouthW * 1.84);
    const topTaper = mouthYTop + Math.sin(ratio * Math.PI) * 4 - 2;
    const len = 14 + ((i * 7) % 11);
    // top fang
    ctx.beginPath();
    ctx.moveTo(tx - 5, topTaper);
    ctx.lineTo(tx + 5, topTaper);
    ctx.lineTo(tx + (i % 2 === 0 ? 1 : -1), topTaper + len);
    ctx.closePath();
    ctx.fill();
    // bottom fang (offset between top fangs)
    const btx = tx + (mouthW / teethCount) / 2;
    if (Math.abs(btx) < mouthW * 0.9) {
      const blen = 12 + ((i * 5) % 9);
      const bottomY = mouthYTop + mouthH * 1.1;
      ctx.beginPath();
      ctx.moveTo(btx - 4, bottomY);
      ctx.lineTo(btx + 4, bottomY);
      ctx.lineTo(btx + (i % 2 === 0 ? -1 : 1), bottomY - blen);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Scar across the face
  ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-flameW * 0.55, -flameH * 0.05);
  ctx.lineTo(flameW * 0.05, -flameH * 0.18);
  ctx.lineTo(flameW * 0.45, -flameH * 0.02);
  ctx.stroke();
}

function drawWatering() {
  const p = Math.min(1, state.modeTimer / WATERING_DURATION);

  // Sky darkens then lightens to dawn
  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  if (p < 0.6) {
    bg.addColorStop(0, "#0a1422");
    bg.addColorStop(1, "#1a3050");
  } else {
    const lp = (p - 0.6) / 0.4;
    bg.addColorStop(0, `rgba(${20 + 100 * lp}, ${30 + 120 * lp}, ${60 + 130 * lp}, 1)`);
    bg.addColorStop(1, `rgba(${40 + 180 * lp}, ${80 + 140 * lp}, ${120 + 100 * lp}, 1)`);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Storm clouds slide in at top
  const cloudY = -40 + Math.min(80, p * 200);
  ctx.fillStyle = "rgba(40, 30, 60, 0.9)";
  for (let i = 0; i < 6; i++) {
    const cx = (i + 0.5) * (canvasWidth / 6);
    ctx.beginPath();
    ctx.ellipse(cx, cloudY, 90 * GIANT, 38 * GIANT, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground
  const groundY = canvasHeight * 0.65;
  ctx.fillStyle = "#1a0a05";
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);

  // Shrinking boss fire
  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.55;
  const shrink = 1 - p;
  const flameH = (Math.min(canvasWidth, canvasHeight) * 0.6) * shrink + 20;
  const flameW = flameH * 0.55;
  if (flameH > 24) {
    ctx.save();
    ctx.translate(cx, cy + (1 - shrink) * 80);
    const t = performance.now() / 1000;
    const fg = ctx.createLinearGradient(0, -flameH, 0, flameH * 0.3);
    fg.addColorStop(0, rainbowColor(t, 0));
    fg.addColorStop(0.6, rainbowColor(t, 120));
    fg.addColorStop(1, "rgba(80,40,20,0.6)");
    ctx.globalAlpha = 0.4 + shrink * 0.6;
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -flameH);
    ctx.bezierCurveTo(flameW, -flameH * 0.5, flameW * 1.1, flameH * 0.1, 0, flameH * 0.3);
    ctx.bezierCurveTo(-flameW * 1.1, flameH * 0.1, -flameW, -flameH * 0.5, 0, -flameH);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Water drops
  ctx.strokeStyle = "rgba(150, 210, 255, 0.85)";
  ctx.lineWidth = 2 * GIANT;
  for (const d of state.waterDrops) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.vx * 0.02 * GIANT, d.y - d.vy * 0.02 * GIANT);
    ctx.stroke();
  }

  // Steam
  ctx.globalCompositeOperation = "lighter";
  for (const s of state.steam) {
    const lifeT = s.life / s.maxLife;
    const alpha = (1 - lifeT) * 0.4;
    ctx.fillStyle = `rgba(220, 230, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * GIANT, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawEnding() {
  // Calm sunrise
  const bg = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bg.addColorStop(0, "#ffd9a0");
  bg.addColorStop(0.5, "#ffb37a");
  bg.addColorStop(1, "#7a4a3a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Sun
  ctx.fillStyle = "#fff5d0";
  ctx.beginPath();
  ctx.arc(canvasWidth * 0.5, canvasHeight * 0.45, 60 * GIANT, 0, Math.PI * 2);
  ctx.fill();

  // Ground
  const groundY = canvasHeight * 0.7;
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);

  // Log
  const cx = canvasWidth / 2;
  ctx.fillStyle = "#4a2e1c";
  ctx.fillRect(cx - 70 * GIANT, groundY - 8 * GIANT, 140 * GIANT, 16 * GIANT);

  // Tiny ember, sitting on top of the log however big the log is
  const t = performance.now() / 1000;
  const emberSize = 8 + Math.sin(t * 3) * 2;
  const emberY = groundY - 8 * GIANT - 6;
  ctx.fillStyle = "#ff6633";
  ctx.beginPath();
  ctx.arc(cx, emberY, emberSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd97a";
  ctx.beginPath();
  ctx.arc(cx, emberY, emberSize * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Steam wisps
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const wave = Math.sin(t * 1.5 + i) * 8;
    const wy = emberY - 10 - (i * 20 + (t * 18) % 20) * GIANT;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.18 - i * 0.04})`;
    ctx.beginPath();
    ctx.arc(cx + wave * GIANT, wy, (10 + i * 3) * GIANT, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Text
  ctx.fillStyle = "#3a1a0a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Giant words still have to fit on the screen.
  let words = 32 * GIANT;
  ctx.font = `bold ${words}px system-ui, sans-serif`;
  const fits = (canvasWidth * 0.95) / ctx.measureText("The fire is at peace.").width;
  if (fits < 1) {
    words = Math.max(32, words * fits);
    ctx.font = `bold ${words}px system-ui, sans-serif`;
  }
  ctx.fillText("The fire is at peace.", cx, canvasHeight * 0.25);
  ctx.font = `${words / 2}px system-ui, sans-serif`;
  ctx.fillText("…for now.", cx, canvasHeight * 0.25 + words + 4);
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.floor(alpha * 255).toString(16).padStart(2, "0");
  if (hex.startsWith("#") && hex.length === 7) return `${hex}${a}`;
  return hex;
}

// boot
resize();
const restored = loadGame();
renderShop();
renderHud();
checkSecretAvailability();
hintEl.textContent = (GIGANTIC ? "GIGANTIC Feed Your Fire · " : "") +
  "Click the fire for coins · Buy gasoline in the shop to level up 🔥";
if (restored) {
  showToast(`Welcome back — Level ${state.level}, 🪙${Math.floor(state.coins)}`, 2400);
}
requestAnimationFrame(tick);
