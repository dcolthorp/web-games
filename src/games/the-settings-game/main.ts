export {};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Kind = "platform" | "wall" | "spike" | "goal";

interface Entity extends Rect {
  id: string;
  kind: Kind;
  color?: string;
  visible: boolean;
}

interface SliderSetting {
  type: "range";
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
}
interface CheckboxSetting {
  type: "checkbox";
  id: string;
  label: string;
  value: boolean;
}
interface ColorSetting {
  type: "color";
  id: string;
  label: string;
  value: string;
}
interface SelectSetting {
  type: "select";
  id: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
}
type Setting = SliderSetting | CheckboxSetting | ColorSetting | SelectSetting;

interface Level {
  name: string;
  hint: string;
  spawn: { x: number; y: number };
  settings: Setting[];
  build: (values: Record<string, number | string | boolean>) => Entity[];
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const settingsBody = document.getElementById("settings-body") as HTMLDivElement;
const settingsHint = document.getElementById("settings-hint") as HTMLParagraphElement;
const levelLabel = document.getElementById("level-label") as HTMLParagraphElement;
const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement;
const canvasWrap = canvas.parentElement!;

const toast = document.createElement("div");
toast.className = "toast";
canvasWrap.appendChild(toast);

const W = canvas.width;
const H = canvas.height;

// ----- Levels -----

const levels: Level[] = [
  {
    name: "Tutorial: The Slider",
    hint: "Slide the platform up to reach the flag.",
    spawn: { x: 60, y: 420 },
    settings: [
      {
        type: "range",
        id: "platform-y",
        label: "Platform Height",
        min: 100,
        max: 460,
        step: 1,
        value: 460,
        unit: "px",
      },
    ],
    build: (v) => [
      { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
      {
        id: "lift",
        kind: "platform",
        x: 320,
        y: v["platform-y"] as number,
        w: 160,
        h: 18,
        visible: true,
        color: "#6dd3ff",
      },
      { id: "goal", kind: "goal", x: 640, y: 90, w: 40, h: 50, visible: true },
      { id: "left-wall", kind: "wall", x: 240, y: 200, w: 20, h: 280, visible: true },
      { id: "right-wall", kind: "wall", x: 540, y: 200, w: 20, h: 280, visible: true },
    ],
  },
  {
    name: "Uncheck the Wall",
    hint: "There's a wall in your way. Take a look at the checkboxes.",
    spawn: { x: 60, y: 420 },
    settings: [
      { type: "checkbox", id: "wall-a", label: "Show Wall A", value: true },
      { type: "checkbox", id: "wall-b", label: "Show Wall B", value: true },
      {
        type: "range",
        id: "platform-y",
        label: "Step Height",
        min: 200,
        max: 460,
        step: 1,
        value: 460,
      },
    ],
    build: (v) => [
      { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
      {
        id: "wall-a",
        kind: "wall",
        x: 220,
        y: 280,
        w: 24,
        h: 200,
        visible: v["wall-a"] as boolean,
      },
      {
        id: "wall-b",
        kind: "wall",
        x: 520,
        y: 100,
        w: 24,
        h: 280,
        visible: v["wall-b"] as boolean,
      },
      {
        id: "step",
        kind: "platform",
        x: 360,
        y: v["platform-y"] as number,
        w: 120,
        h: 16,
        visible: true,
        color: "#6dd3ff",
      },
      { id: "goal", kind: "goal", x: 640, y: 90, w: 40, h: 50, visible: true },
      { id: "shelf", kind: "platform", x: 580, y: 140, w: 140, h: 16, visible: true },
    ],
  },
  {
    name: "Build the Staircase",
    hint: "Three sliders, three platforms. Make a staircase.",
    spawn: { x: 40, y: 420 },
    settings: [
      { type: "range", id: "p1", label: "Platform 1 Y", min: 100, max: 460, step: 1, value: 460 },
      { type: "range", id: "p2", label: "Platform 2 Y", min: 100, max: 460, step: 1, value: 460 },
      { type: "range", id: "p3", label: "Platform 3 Y", min: 100, max: 460, step: 1, value: 460 },
      { type: "checkbox", id: "spikes", label: "Enable Spikes", value: true },
    ],
    build: (v) => {
      const entities: Entity[] = [
        { id: "ground", kind: "platform", x: 0, y: 480, w: W, h: 40, visible: true },
        {
          id: "p1",
          kind: "platform",
          x: 150,
          y: v["p1"] as number,
          w: 110,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        {
          id: "p2",
          kind: "platform",
          x: 320,
          y: v["p2"] as number,
          w: 110,
          h: 14,
          visible: true,
          color: "#a78bfa",
        },
        {
          id: "p3",
          kind: "platform",
          x: 490,
          y: v["p3"] as number,
          w: 110,
          h: 14,
          visible: true,
          color: "#f472b6",
        },
        { id: "goal", kind: "goal", x: 640, y: 90, w: 40, h: 50, visible: true },
        { id: "shelf", kind: "platform", x: 600, y: 140, w: 120, h: 16, visible: true },
      ];
      if (v["spikes"] as boolean) {
        entities.push({ id: "spikes", kind: "spike", x: 240, y: 462, w: 60, h: 18, visible: true });
        entities.push({ id: "spikes2", kind: "spike", x: 420, y: 462, w: 60, h: 18, visible: true });
      }
      return entities;
    },
  },
  {
    name: "Physics Preferences",
    hint: "Gravity and jump are settings too. Tune them.",
    spawn: { x: 40, y: 420 },
    settings: [
      { type: "range", id: "gravity", label: "Gravity", min: 400, max: 2400, step: 10, value: 1600 },
      { type: "range", id: "jump", label: "Jump Strength", min: 200, max: 900, step: 5, value: 480 },
      { type: "range", id: "gap-x", label: "Gap Platform X", min: 200, max: 520, step: 1, value: 200 },
      { type: "checkbox", id: "ceiling", label: "Show Ceiling", value: true },
      {
        type: "select",
        id: "theme",
        label: "Theme",
        options: [
          { value: "night", label: "Night" },
          { value: "dawn", label: "Dawn" },
          { value: "vapor", label: "Vapor" },
        ],
        value: "night",
      },
    ],
    build: (v) => {
      const entities: Entity[] = [
        { id: "ground-left", kind: "platform", x: 0, y: 480, w: 200, h: 40, visible: true },
        { id: "ground-right", kind: "platform", x: 560, y: 480, w: 200, h: 40, visible: true },
        {
          id: "gap-platform",
          kind: "platform",
          x: v["gap-x"] as number,
          y: 360,
          w: 120,
          h: 14,
          visible: true,
          color: "#6dd3ff",
        },
        { id: "goal", kind: "goal", x: 660, y: 430, w: 36, h: 50, visible: true },
        { id: "pit-spike", kind: "spike", x: 200, y: 500, w: 360, h: 20, visible: true },
      ];
      if (v["ceiling"] as boolean) {
        entities.push({ id: "ceiling", kind: "wall", x: 0, y: 0, w: W, h: 30, visible: true });
      }
      return entities;
    },
  },
];

// ----- State -----

let currentLevelIndex = 0;
let entities: Entity[] = [];
const settingValues: Record<string, number | string | boolean> = {};

const player = {
  x: 0,
  y: 0,
  w: 22,
  h: 28,
  vx: 0,
  vy: 0,
  onGround: false,
};

let gravity = 1600;
let jumpStrength = 480;
const moveSpeed = 220;

const keys: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

restartBtn.addEventListener("click", () => loadLevel(currentLevelIndex));

let theme = "night";

// ----- Level loading -----

function loadLevel(index: number): void {
  currentLevelIndex = index;
  const level = levels[index];
  if (!level) return;
  levelLabel.textContent = `Level ${index + 1} of ${levels.length} — ${level.name}`;
  settingsHint.textContent = level.hint;

  // Reset settings to defaults
  for (const s of level.settings) {
    settingValues[s.id] = s.value;
  }
  renderSettings(level);
  rebuildEntities();

  player.x = level.spawn.x;
  player.y = level.spawn.y;
  player.vx = 0;
  player.vy = 0;
  gravity = 1600;
  jumpStrength = 480;
  if (level.settings.some((s) => s.id === "gravity")) {
    gravity = settingValues["gravity"] as number;
  }
  if (level.settings.some((s) => s.id === "jump")) {
    jumpStrength = settingValues["jump"] as number;
  }
  if (level.settings.some((s) => s.id === "theme")) {
    theme = settingValues["theme"] as string;
  }
}

function rebuildEntities(): void {
  const level = levels[currentLevelIndex];
  if (!level) return;
  entities = level.build(settingValues);
}

function renderSettings(level: Level): void {
  settingsBody.innerHTML = "";
  for (const s of level.settings) {
    const wrap = document.createElement("div");
    wrap.className = `setting ${s.type}`;

    if (s.type === "range") {
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <span class="value" id="v-${s.id}">${formatValue(s)}</span>
        </div>
        <input type="range" id="s-${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}" />
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      const valueEl = wrap.querySelector(`#v-${s.id}`) as HTMLSpanElement;
      input.addEventListener("input", () => {
        const num = Number(input.value);
        settingValues[s.id] = num;
        valueEl.textContent = formatValueRaw(num, s.unit);
        if (s.id === "gravity") gravity = num;
        if (s.id === "jump") jumpStrength = num;
        rebuildEntities();
      });
    } else if (s.type === "checkbox") {
      wrap.innerHTML = `
        <label class="setting-row" for="s-${s.id}">
          <span>${s.label}</span>
          <input type="checkbox" id="s-${s.id}" ${s.value ? "checked" : ""} />
        </label>
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      input.addEventListener("change", () => {
        settingValues[s.id] = input.checked;
        rebuildEntities();
      });
    } else if (s.type === "color") {
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <input type="color" id="s-${s.id}" value="${s.value}" />
        </div>
      `;
      const input = wrap.querySelector("input") as HTMLInputElement;
      input.addEventListener("input", () => {
        settingValues[s.id] = input.value;
        rebuildEntities();
      });
    } else if (s.type === "select") {
      const opts = s.options
        .map((o) => `<option value="${o.value}" ${o.value === s.value ? "selected" : ""}>${o.label}</option>`)
        .join("");
      wrap.innerHTML = `
        <div class="setting-row">
          <label for="s-${s.id}">${s.label}</label>
          <select id="s-${s.id}">${opts}</select>
        </div>
      `;
      const select = wrap.querySelector("select") as HTMLSelectElement;
      select.addEventListener("change", () => {
        settingValues[s.id] = select.value;
        if (s.id === "theme") theme = select.value;
        rebuildEntities();
      });
    }

    settingsBody.appendChild(wrap);
  }
}

function formatValue(s: SliderSetting): string {
  return formatValueRaw(s.value, s.unit);
}
function formatValueRaw(n: number, unit?: string): string {
  return `${Math.round(n)}${unit ? unit : ""}`;
}

// ----- Physics & collisions -----

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidEntities(): Entity[] {
  return entities.filter((e) => e.visible && (e.kind === "platform" || e.kind === "wall"));
}

function step(dt: number): void {
  // Horizontal input
  const left = keys["arrowleft"] || keys["a"];
  const right = keys["arrowright"] || keys["d"];
  const jump = keys["arrowup"] || keys["w"] || keys[" "];

  let targetVX = 0;
  if (left) targetVX -= moveSpeed;
  if (right) targetVX += moveSpeed;
  player.vx = targetVX;

  if (jump && player.onGround) {
    player.vy = -jumpStrength;
    player.onGround = false;
  }

  player.vy += gravity * dt;
  if (player.vy > 1400) player.vy = 1400;

  // Horizontal move + collide
  player.x += player.vx * dt;
  for (const e of solidEntities()) {
    if (rectsOverlap(player, e)) {
      if (player.vx > 0) player.x = e.x - player.w;
      else if (player.vx < 0) player.x = e.x + e.w;
      player.vx = 0;
    }
  }

  // Vertical move + collide
  player.y += player.vy * dt;
  player.onGround = false;
  for (const e of solidEntities()) {
    if (rectsOverlap(player, e)) {
      if (player.vy > 0) {
        player.y = e.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0) {
        player.y = e.y + e.h;
        player.vy = 0;
      }
    }
  }

  // Bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;
  if (player.y > H + 200) {
    loadLevel(currentLevelIndex);
    return;
  }

  // Hazards & goal
  for (const e of entities) {
    if (!e.visible) continue;
    if (e.kind === "spike" && rectsOverlap(player, e)) {
      flash("Ouch! Try again.");
      loadLevel(currentLevelIndex);
      return;
    }
    if (e.kind === "goal" && rectsOverlap(player, e)) {
      const next = currentLevelIndex + 1;
      if (next < levels.length) {
        flash("Level Complete! ✦");
        setTimeout(() => loadLevel(next), 600);
      } else {
        flash("You configured every level. ✦ The End ✦");
        setTimeout(() => loadLevel(0), 1800);
      }
      // freeze to avoid double-trigger
      currentLevelIndex = -1;
      return;
    }
  }
}

let toastTimeout: number | null = null;
function flash(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");
  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 1200);
}

// ----- Render -----

function themeColors(): { sky1: string; sky2: string } {
  if (theme === "dawn") return { sky1: "#3a2a4a", sky2: "#1a1226" };
  if (theme === "vapor") return { sky1: "#2a1850", sky2: "#0a0820" };
  return { sky1: "#1a2547", sky2: "#0a1024" };
}

function render(): void {
  const { sky1, sky2 } = themeColors();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, sky1);
  grad.addColorStop(1, sky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Grid overlay (subtle)
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  for (const e of entities) {
    if (!e.visible) continue;
    if (e.kind === "platform") {
      ctx.fillStyle = e.color ?? "#5a7ab8";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(e.x, e.y, e.w, 2);
    } else if (e.kind === "wall") {
      ctx.fillStyle = e.color ?? "#7c5a9a";
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
    } else if (e.kind === "spike") {
      ctx.fillStyle = "#ff6b7a";
      const spikeW = 12;
      for (let sx = e.x; sx + spikeW <= e.x + e.w; sx += spikeW) {
        ctx.beginPath();
        ctx.moveTo(sx, e.y + e.h);
        ctx.lineTo(sx + spikeW / 2, e.y);
        ctx.lineTo(sx + spikeW, e.y + e.h);
        ctx.closePath();
        ctx.fill();
      }
    } else if (e.kind === "goal") {
      // Flag pole
      ctx.fillStyle = "#dbe2ff";
      ctx.fillRect(e.x + e.w / 2 - 2, e.y, 4, e.h);
      // Flag
      ctx.fillStyle = "#f6d365";
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2 + 2, e.y + 4);
      ctx.lineTo(e.x + e.w + 14, e.y + 14);
      ctx.lineTo(e.x + e.w / 2 + 2, e.y + 24);
      ctx.closePath();
      ctx.fill();
      // Glow
      ctx.fillStyle = "rgba(246, 211, 101, 0.18)";
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Player
  ctx.fillStyle = "#6dd3ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.fillStyle = "#0c1a2e";
  ctx.fillRect(player.x + 4, player.y + 8, 4, 4);
  ctx.fillRect(player.x + 14, player.y + 8, 4, 4);
}

// ----- Loop -----

let lastT = performance.now();
function loop(t: number): void {
  const dt = Math.min((t - lastT) / 1000, 1 / 30);
  lastT = t;
  if (currentLevelIndex >= 0) step(dt);
  render();
  requestAnimationFrame(loop);
}

loadLevel(0);
requestAnimationFrame((t) => {
  lastT = t;
  loop(t);
});
