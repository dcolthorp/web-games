export {};

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

const state = {
  level: 1,
  fuel: 0,
  coins: 0,
  reachedLevel8: false,
  rainbowBeyondUnlocked: false,
  particles: [] as Particle[],
};

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
  burstParticles(300);
  showToast("✨ RAINBOW BEYOND UNLOCKED ✨", 3200);
  renderHud();
  renderShop();
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
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy < 200 * 200) {
    const gained = coinsPerClick();
    state.coins += gained;
    floatingTexts.push({
      x,
      y,
      vy: -60,
      life: 0,
      maxLife: 0.9,
      text: `+🪙${gained}`,
      color: "#ffd97a",
    });
    // tiny spark burst when clicked
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 60;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
        hue: 45,
        rainbow: state.level >= 9,
      });
    }
    renderHud();
    renderShopAffordability();
  }
});

// Passive coin income based on fire level
let lastTime = performance.now();
function tick(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

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
    p.vy += -180 * dt; // rise (buoyancy)
    p.vx *= 0.96;
    p.vy *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  draw();
  // update coins label every frame is fine
  coinsLabel.textContent = `🪙 ${Math.floor(state.coins)}`;
  // re-enable buttons when coins cross thresholds
  if (Math.random() < 0.05) renderShopAffordability();

  requestAnimationFrame(tick);
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

  const cx = canvasWidth / 2;
  const cy = canvasHeight * 0.62;
  const t = performance.now() / 1000;

  // Log / floor
  ctx.save();
  ctx.translate(cx, cy + 40);
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

  // Particles
  ctx.globalCompositeOperation = "lighter";
  for (const p of state.particles) {
    const lifeT = p.life / p.maxLife;
    const alpha = (1 - lifeT) * 0.9;
    const size = p.size * (1 - lifeT * 0.5);
    if (p.rainbow) {
      ctx.fillStyle = `hsla(${(p.hue + t * 120) % 360}, 95%, 65%, ${alpha})`;
    } else {
      ctx.fillStyle = `${palette.spark}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Floating texts (coin gains)
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const f of floatingTexts) {
    const ft = f.life / f.maxLife;
    const alpha = 1 - ft;
    ctx.fillStyle = `${f.color}${Math.floor(alpha * 255).toString(16).padStart(2, "0")}`;
    ctx.fillText(f.text, f.x, f.y);
  }
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.floor(alpha * 255).toString(16).padStart(2, "0");
  if (hex.startsWith("#") && hex.length === 7) return `${hex}${a}`;
  return hex;
}

// boot
resize();
renderShop();
renderHud();
checkSecretAvailability();
hintEl.textContent = "Click the fire for coins · Buy gasoline in the shop to level up 🔥";
requestAnimationFrame(tick);
