import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Game canvas missing");
}
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) {
  throw new Error("2D context unavailable");
}
const ctx: CanvasRenderingContext2D = ctxOrNull;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND_Y = HEIGHT - 90;
const GRAVITY = 2400;
const MOVE_SPEED = 320;
const JUMP_VELOCITY = 880;

const STAND_HEIGHT = 110;
const DUCK_HEIGHT = 64;
const BODY_WIDTH = 30;

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  ducking: boolean;
  facing: 1 | -1;
  runPhase: number;
  hp: number;
  invuln: number;
}

const player: Player = {
  x: 200,
  y: GROUND_Y,
  vx: 0,
  vy: 0,
  onGround: true,
  ducking: false,
  facing: 1,
  runPhase: 0,
  hp: 5,
  invuln: 0,
};

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  targetY: number;
  vy: number;
  spawnDelay: number;
  id: number;
}

const platforms: Platform[] = [];
let nextPlatformId = 1;

interface Attack {
  kind:
    | "chomp"
    | "laser"
    | "sword"
    | "hammer"
    | "shield"
    | "fist"
    | "airlift"
    | "earthrock"
    | "flood"
    | "firepatch"
    | "redslime"
    | "redlaser"
    | "tornado"
    | "fireball"
    | "portalreverse"
    | "portaldrop"
    | "portalsize"
    | "dashorb"
    | "spikeshot"
    | "grabhand";
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  horizontal: boolean;
  travelDir: 1 | -1;
  warnTime: number;
  traverseTime: number;
  traverseDuration: number;
  trackTime: number;
  lockTime: number;
  fireTime: number;
  phase:
    | "warn"
    | "travel"
    | "track"
    | "locked"
    | "fire"
    | "done"
    | "swing"
    | "fall"
    | "shockwave"
    | "active";
  id: number;
  hasHit: boolean;
  lavaMode?: boolean;
  customThickness?: number;
  damageCooldown?: number;
}
const attacks: Attack[] = [];
let attackSpawnTimer = 2.2;
let nextAttackId = 1;

interface Boss {
  x: number;
  y: number;
  radius: number;
  mouthPhase: number;
  facing: 1 | -1;
  hp: number;
  hpMax: number;
  homeX: number;
  homeY: number;
  atHome: boolean;
  visibility: number;
  vulnerableTime: number;
  hitCooldown: number;
  phase: "alive" | "transitioning" | "ghost";
  shieldTime: number;
  googlyEyeOffset: { x: number; y: number };
  googlyEyeVelocity: { x: number; y: number };
}
const boss: Boss = {
  x: WIDTH - 110,
  y: 200,
  radius: 60,
  mouthPhase: 0,
  facing: -1,
  hp: 100,
  hpMax: 100,
  homeX: WIDTH - 110,
  homeY: 200,
  atHome: true,
  visibility: 1,
  vulnerableTime: 0,
  hitCooldown: 0,
  phase: "alive",
  shieldTime: 0,
  googlyEyeOffset: { x: 0, y: 0 },
  googlyEyeVelocity: { x: 0, y: 0 },
};
const WARN_DURATION = 1.1;
const REAPPEAR_RATE = 1.6;
const VULNERABLE_DURATION = 5;
const HIT_COOLDOWN = 0.6;
const HIT_DAMAGE = 25;
const GHOST_HP_MAX = 80;
const LASER_TRACK_TIME = 1.8;
const LASER_LOCK_TIME = 1.0;
const LASER_FIRE_TIME = 0.55;
const LASER_BEAM_THICKNESS = 70;
const TRANSITION_DURATION = 2.6;
let transitionTime = 0;
let screenShake = 0;

const BOSS_NAME = "PAC-MAN";

interface Skin {
  id: string;
  name: string;
  price: number;
  blurb: string;
  shirt: string;
  pants: string;
  shoe: string;
  body: string;
  skin: string;
  sunglasses: boolean;
}

const SKINS: Skin[] = [
  {
    id: "default",
    name: "ORIGINAL KID",
    price: 0,
    blurb: "Just a regular stickman.",
    shirt: "#e23a3a",
    pants: "#1f4ea8",
    shoe: "#222",
    body: "#222",
    skin: "#fde2c1",
    sunglasses: false,
  },
  {
    id: "coolguy",
    name: "COOL GUY",
    price: 50,
    blurb: "Black on black on black. 8-bit shades.",
    shirt: "#0d0d12",
    pants: "#0d0d12",
    shoe: "#0d0d12",
    body: "#0d0d12",
    skin: "#fde2c1",
    sunglasses: true,
  },
];

const SKIN_OWNED_KEY = "dbm-skins-owned";
const SKIN_EQUIPPED_KEY = "dbm-skin-equipped";
const COINS_KEY = "dbm-coins";
let ownedSkins: Set<string> = new Set(["default"]);
let equippedSkinId = "default";
let coins = 100;

function loadProgression(): void {
  try {
    const raw = localStorage.getItem(SKIN_OWNED_KEY);
    if (raw) {
      const owned = JSON.parse(raw);
      if (Array.isArray(owned)) {
        ownedSkins = new Set(["default", ...owned.filter((s: unknown) => typeof s === "string")]);
      }
    }
  } catch {
    // ignore
  }
  const eq = localStorage.getItem(SKIN_EQUIPPED_KEY);
  if (eq && ownedSkins.has(eq)) equippedSkinId = eq;
  const rawCoins = localStorage.getItem(COINS_KEY);
  if (rawCoins !== null) {
    const parsed = parseInt(rawCoins, 10);
    if (!isNaN(parsed)) coins = parsed;
  }
}

function saveProgression(): void {
  localStorage.setItem(
    SKIN_OWNED_KEY,
    JSON.stringify([...ownedSkins].filter((s) => s !== "default")),
  );
  localStorage.setItem(SKIN_EQUIPPED_KEY, equippedSkinId);
  localStorage.setItem(COINS_KEY, String(coins));
}

function getEquippedSkin(): Skin {
  return SKINS.find((s) => s.id === equippedSkinId) ?? SKINS[0]!;
}

loadProgression();

interface BossInfo {
  id: string;
  name: string;
  blurb: string;
}
const BOSS_ROSTER_BASE: BossInfo[] = [
  { id: "pacman", name: "PAC-MAN", blurb: "Chomps with style. Erases himself. Phase 2 ghost form." },
  { id: "mrpencil", name: "MR. PENCIL", blurb: "Sword. Hammer that quakes the floor. Shield. No platforms." },
  { id: "elemental", name: "THE ELEMENTAL", blurb: "Air → Earth → Fire → Water → Master. Each phase needs its own element bits." },
  { id: "beatrix", name: "BEATRIX LEBEAU", blurb: "Slime rancher with a vacpack. You're a carrot. Red slimes one-shot you. Grab tarrs." },
  { id: "geom", name: "GEOMETRY DASH", blurb: "Tiny/big portals, reverse portal, drop portal, dash orbs. Spikes auto-fire at it." },
];

let BOSS_ROSTER: BossInfo[] = [...BOSS_ROSTER_BASE];

function rebuildBossRoster(): void {
  BOSS_ROSTER = [...BOSS_ROSTER_BASE];
  if (customBossExists()) {
    const name = customBoss.name.trim() || "MY BOSS";
    BOSS_ROSTER.push({
      id: "custom",
      name: name.toUpperCase(),
      blurb: customBoss.attackDesc.trim().slice(0, 80) || "Your handcrafted boss.",
    });
  }
}
// Initial rebuild deferred: customBoss is declared later in the file. We call
// rebuildBossRoster() manually after customBoss is initialized.

function getNextBoss(id: string): string | null {
  const map: Record<string, string | null> = {
    pacman: "mrpencil",
    mrpencil: "elemental",
    elemental: "beatrix",
    beatrix: "geom",
    geom: customBossExists() ? "custom" : null,
    custom: null,
  };
  return map[id] ?? null;
}

const NEXT_BOSS = new Proxy({} as Record<string, string | null>, {
  get(_t, prop: string) {
    return getNextBoss(prop);
  },
}) as Record<string, string | null>;

const ELEMENTS = ["air", "earth", "fire", "water"] as const;
type Element = typeof ELEMENTS[number];
let elementalPhase = 0; // 0=air, 1=earth, 2=fire, 3=water, 4=master
const elementInventory: Record<Element, number> = { air: 0, earth: 0, fire: 0, water: 0 };
const ELEMENTAL_PHASE_HP = [60, 60, 70, 70, 90];

let currentBossId = "pacman";

const BEATEN_BOSSES_KEY = "dbm-beaten-bosses";
let beatenBosses: Set<string> = new Set();
try {
  const raw = localStorage.getItem(BEATEN_BOSSES_KEY);
  if (raw) {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      beatenBosses = new Set(arr.filter((s: unknown) => typeof s === "string"));
    }
  }
} catch {
  // ignore
}
function saveBeatenBosses(): void {
  localStorage.setItem(BEATEN_BOSSES_KEY, JSON.stringify([...beatenBosses]));
}

let bossMode = false;
let bossModeBossId = "pacman";

// Custom boss: drawing-pad images + name + freeform attack description.
const CUSTOM_BOSS_PAD = 220;
const customBossPad1 = document.createElement("canvas");
customBossPad1.width = CUSTOM_BOSS_PAD;
customBossPad1.height = CUSTOM_BOSS_PAD;
const customBossPad1Ctx = customBossPad1.getContext("2d")!;
const customBossPad2 = document.createElement("canvas");
customBossPad2.width = CUSTOM_BOSS_PAD;
customBossPad2.height = CUSTOM_BOSS_PAD;
const customBossPad2Ctx = customBossPad2.getContext("2d")!;
const customBoss = {
  name: localStorage.getItem("dbm-cb-name") ?? "",
  attackDesc: localStorage.getItem("dbm-cb-attack") ?? "",
  hasPhase1: false,
  hasPhase2: false,
};
const cb1 = localStorage.getItem("dbm-cb-phase1");
if (cb1) {
  customBoss.hasPhase1 = true;
  const img = new Image();
  img.onload = () => {
    customBossPad1Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD);
    customBossPad1Ctx.drawImage(img, 0, 0);
  };
  img.src = cb1;
}
const cb2 = localStorage.getItem("dbm-cb-phase2");
if (cb2) {
  customBoss.hasPhase2 = true;
  const img = new Image();
  img.onload = () => {
    customBossPad2Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD);
    customBossPad2Ctx.drawImage(img, 0, 0);
  };
  img.src = cb2;
}

function customBossExists(): boolean {
  return customBoss.name.trim() !== "" || customBoss.hasPhase1 || customBoss.hasPhase2;
}

// Now that customBoss is initialized we can populate the roster correctly.
rebuildBossRoster();

function saveCustomBoss(): void {
  localStorage.setItem("dbm-cb-name", customBoss.name);
  localStorage.setItem("dbm-cb-attack", customBoss.attackDesc);
  localStorage.setItem("dbm-cb-phase1", customBossPad1.toDataURL("image/png"));
  localStorage.setItem("dbm-cb-phase2", customBossPad2.toDataURL("image/png"));
  customBoss.hasPhase1 = true;
  customBoss.hasPhase2 = true;
  customBossConfig = parseCustomBossConfig();
  rebuildBossRoster();
}

function deleteCustomBoss(): void {
  customBoss.name = "";
  customBoss.attackDesc = "";
  customBoss.hasPhase1 = false;
  customBoss.hasPhase2 = false;
  customBossPad1Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD);
  customBossPad2Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD);
  for (const k of ["dbm-cb-name", "dbm-cb-attack", "dbm-cb-phase1", "dbm-cb-phase2"]) {
    localStorage.removeItem(k);
  }
  beatenBosses.delete("custom");
  saveBeatenBosses();
  rebuildBossRoster();
}

interface CustomBossConfig {
  lavaFlood: boolean;
  platforms: boolean;
  laserLength: number;
  emojis: string[]; // any emojis the user dropped in — used as visual theme
  fireTornado: boolean;
  lavaTornado: boolean;
  fistFlood: boolean;
}

function extractEmojis(s: string): string[] {
  // Common emoji ranges. Not exhaustive but covers most.
  const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]/gu;
  return Array.from(new Set(s.match(re) ?? []));
}

function parseCustomBossConfig(): CustomBossConfig {
  const desc = customBoss.attackDesc.toLowerCase();
  let laserLength = 100;
  const m = desc.match(/(\d{2,4})\s*(px|pixel|pixels)/);
  if (m) {
    const n = parseInt(m[1]!, 10);
    if (!isNaN(n)) laserLength = Math.max(30, Math.min(400, n));
  }
  return {
    lavaFlood: /lava\s*(flood|water|wave|tornado)?/.test(desc) && /(flood|water|wave|tornado)/.test(desc),
    platforms: /platform/.test(desc) && !/no\s*platform/.test(desc),
    laserLength,
    emojis: extractEmojis(customBoss.attackDesc),
    fireTornado: /(fire|flame).*(tornado|cyclone|vortex)|(tornado|cyclone|vortex).*(fire|flame)/.test(desc),
    lavaTornado: /lava.*(tornado|cyclone|vortex)|(tornado|cyclone|vortex).*lava/.test(desc),
    fistFlood: /(flood|wave).*(of\s*fists|of\s*hands|of\s*punches)/.test(desc),
  };
}

let customBossConfig: CustomBossConfig = parseCustomBossConfig();

// Heuristic attack parser — converts free text to a list of attack spawn fns.
function getCustomBossAttackPool(): (() => void)[] {
  const desc = customBoss.attackDesc.toLowerCase();
  const pool: (() => void)[] = [];
  const add = (fn: () => void) => pool.push(fn);
  if (/(fire|flame|burn)/.test(desc)) add(() => spawnFirePatchAt(player.x));
  if (/(laser|beam|ray|red\s*line)/.test(desc)) add(() => spawnRedLaser(customBossConfig.laserLength));
  if (/(rock|earth|boulder|stone)/.test(desc)) add(() => spawnEarthRockAt(player.x, player.y - 30));
  if (/(water|flood|drown|wave|lava)/.test(desc)) add(() => {
    spawnFlood();
    const a = attacks[attacks.length - 1];
    if (a && customBossConfig.lavaFlood) a.lavaMode = true;
  });
  if (/(wind|air|lift|fly|gust)/.test(desc)) add(() => spawnAirLiftAt(player.x));
  if (/(sword|slash|blade|cut)/.test(desc)) add(() => spawnPencilSword());
  if (/(hammer|smash|mallet|pound)/.test(desc)) add(() => spawnPencilHammerAt(player.x));
  if (/(shield|block|defend|guard)/.test(desc)) add(() => spawnPencilShield());
  if (/(slime|blob|ooze|goo)/.test(desc)) add(() => spawnRedSlime());
  if (/(\bfist\b|\bpunch\b|pointing[\s-]?hand)/.test(desc)) add(() => spawnFistProjectile());
  if (/(tornado|cyclone|vortex)/.test(desc)) add(() => spawnTornado());
  if (/(fireball|fire\s*ball|flame\s*ball)/.test(desc)) add(() => spawnFireball());
  if (customBossConfig.fistFlood) add(() => {
    // Disguise: a "flood of fists" — spawn a barrage of fists across the screen.
    for (let i = 0; i < 8; i++) setTimeout(() => spawnFistProjectile(), i * 80);
  });
  // Don't fall back to fists — if nothing matched, the boss just doesn't attack.
  return pool;
}

// Boss-creator drawing state.
let cbDrawingPhase: 1 | 2 | null = null;
let cbDrawLastX = 0;
let cbDrawLastY = 0;
let cbHelpOpen = false;
let cbHelpScroll = 0;

const cbNameInput = document.createElement("input");
cbNameInput.type = "text";
cbNameInput.placeholder = "Boss name";
cbNameInput.maxLength = 24;
cbNameInput.value = customBoss.name;
cbNameInput.style.position = "absolute";
cbNameInput.style.display = "none";
cbNameInput.style.boxSizing = "border-box";
cbNameInput.style.font = "16px system-ui, sans-serif";
cbNameInput.style.padding = "6px 10px";
cbNameInput.addEventListener("input", () => {
  customBoss.name = cbNameInput.value;
});

const cbAttackInput = document.createElement("textarea");
cbAttackInput.placeholder =
  "Describe the attacks (e.g., \"shoots 100 pixel red lasers, lava flood with platforms, fire tornado\")";
cbAttackInput.maxLength = 240;
cbAttackInput.value = customBoss.attackDesc;
cbAttackInput.style.position = "absolute";
cbAttackInput.style.display = "none";
cbAttackInput.style.boxSizing = "border-box";
cbAttackInput.style.font = "14px system-ui, sans-serif";
cbAttackInput.style.padding = "6px 10px";
cbAttackInput.style.resize = "none";
cbAttackInput.addEventListener("input", () => {
  customBoss.attackDesc = cbAttackInput.value;
});
document.body.appendChild(cbNameInput);
document.body.appendChild(cbAttackInput);

function positionBossCreatorInputs(visible: boolean): void {
  if (!visible) {
    cbNameInput.style.display = "none";
    cbAttackInput.style.display = "none";
    return;
  }
  const cv = canvas as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const sx = rect.width / cv.width;
  const sy = rect.height / cv.height;
  const place = (el: HTMLElement, x: number, y: number, w: number, h: number) => {
    el.style.left = `${rect.left + window.scrollX + x * sx}px`;
    el.style.top = `${rect.top + window.scrollY + y * sy}px`;
    el.style.width = `${w * sx}px`;
    el.style.height = `${h * sy}px`;
    el.style.display = "block";
  };
  place(cbNameInput, 60, 360, WIDTH - 120, 44);
  place(cbAttackInput, 60, 426, WIDTH - 120, 100);
}

// Asset images for Mr. Pencil's phase 2 — the literal pencil photo + angry face.
const pencilImg = new Image();
let pencilImgReady = false;
pencilImg.onload = () => { pencilImgReady = true; };
pencilImg.onerror = () => { pencilImgReady = false; };
pencilImg.src = new URL("./assets/pencil.png", import.meta.url).href;

const pointingHandImg = new Image();
let pointingHandImgReady = false;
pointingHandImg.onload = () => { pointingHandImgReady = true; };
pointingHandImg.onerror = () => { pointingHandImgReady = false; };
pointingHandImg.src = new URL("./assets/pointing-hand.png", import.meta.url).href;

const beatrixImg = new Image();
let beatrixImgReady = false;
beatrixImg.onload = () => { beatrixImgReady = true; };
beatrixImg.onerror = () => { beatrixImgReady = false; };
beatrixImg.src = new URL("./assets/beatrix.png", import.meta.url).href;

const redSlimeImg = new Image();
let redSlimeImgReady = false;
redSlimeImg.onload = () => { redSlimeImgReady = true; };
redSlimeImg.onerror = () => { redSlimeImgReady = false; };
redSlimeImg.src = new URL("./assets/red-slime.png", import.meta.url).href;

const carrotImg = new Image();
let carrotImgReady = false;
carrotImg.onload = () => { carrotImgReady = true; };
carrotImg.onerror = () => { carrotImgReady = false; };
carrotImg.src = new URL("./assets/carrot.png", import.meta.url).href;

const tarrImg = new Image();
let tarrImgReady = false;
tarrImg.onload = () => { tarrImgReady = true; };
tarrImg.onerror = () => { tarrImgReady = false; };
tarrImg.src = new URL("./assets/tarr.png", import.meta.url).href;

const BOSS_DIFFICULTY_KEY = "dbm-boss-difficulty";
let bossModeDifficulty = 5;
const rawDiff = localStorage.getItem(BOSS_DIFFICULTY_KEY);
if (rawDiff !== null) {
  const parsed = parseInt(rawDiff, 10);
  if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) bossModeDifficulty = parsed;
}
function saveDifficulty(): void {
  localStorage.setItem(BOSS_DIFFICULTY_KEY, String(bossModeDifficulty));
}
let kidPauseTimer = 0;
let bossAbilityCooldown = 0;
const BOSS_ABILITY_COOLDOWN = 1.7;

let aimX = WIDTH / 2;
let aimY = GROUND_Y / 2;
const AIM_SPEED = 380;

let mouseArenaX = WIDTH / 2;
let mouseArenaY = HEIGHT / 2;
let pencilBossArmed: "none" | "mallet" = "none";
let pencilButtonsPhase: string = "";
let elementalButtonsPhase: number = -1;

// Secret: hold 4 and 7 together to toggle the built-in auto-clicker.
// Adjust speed with - and = while it's running.
let autoClicker = false;
let autoClickRate = 5;
let autoClickAcc = 0;
let chordToggleArmed = true;

let playerLifted = false;
let playerSubmergedTime = 0;

// Lazily-created AudioContext for synthesized SFX (heartbeat).
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function playHeartbeatThump(when: number, gainScale = 1): void {
  const ac = getAudioCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.frequency.setValueAtTime(95, t0);
  osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.18);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(0.45 * gainScale, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.25);
}

let lastHeartbeatTime = -10;

interface ObbySpike { x: number; y: number; size: number; }
interface ObbyPlatform { x: number; y: number; w: number; h: number; }
let obbyTimer = 0;
let obbyDifficulty = 1;
let obbyPlayerX = 0;
let obbyPlayerY = 0;
let obbyPlayerVx = 0;
let obbyPlayerVy = 0;
let obbyPlayerOnGround = true;
let obbyPlayerFacing: 1 | -1 = 1;
let obbySpikes: ObbySpike[] = [];
let obbyPlatforms: ObbyPlatform[] = [];
let obbyJumpHeld = false;
const OBBY_GROUND_Y = HEIGHT - 70;
const OBBY_CUBE_R = 18;
const OBBY_SPEED = 320;
const OBBY_JUMP_VELOCITY = 760;
const OBBY_GRAVITY = 2200;
const OBBY_GOAL_X = WIDTH - 50;

function generateObbyCourse(diff: number): { spikes: ObbySpike[]; platforms: ObbyPlatform[] } {
  const spikes: ObbySpike[] = [];
  const platforms: ObbyPlatform[] = [];
  // Sprinkle spikes through the middle band — spawn and goal stay clear.
  const startSafe = 110;
  const goalSafe = WIDTH - 150;
  const spikeCount = 2 + diff;
  for (let i = 0; i < spikeCount; i++) {
    const x = startSafe + Math.random() * (goalSafe - startSafe);
    spikes.push({ x, y: OBBY_GROUND_Y, size: 26 });
    if (diff >= 3 && Math.random() < 0.4) {
      spikes.push({ x: x + 28 + Math.random() * 14, y: OBBY_GROUND_Y, size: 26 });
    }
  }
  // Floating platforms — more at higher difficulty, lower height as it scales.
  const platformCount = 1 + Math.floor(diff / 2);
  for (let i = 0; i < platformCount; i++) {
    const x = startSafe + 60 + Math.random() * (goalSafe - startSafe - 120);
    const y = OBBY_GROUND_Y - 70 - Math.random() * 80;
    const w = Math.max(70, 120 - diff * 6);
    platforms.push({ x, y, w, h: 12 });
    // Higher difficulty: spikes on top of some platforms.
    if (diff >= 4 && Math.random() < 0.45) {
      spikes.push({ x: x + w / 2, y, size: 20 });
    }
  }
  return { spikes, platforms };
}

function startObby(): void {
  setScene("obby");
  obbyTimer = 5;
  obbyPlayerX = 60;
  obbyPlayerY = OBBY_GROUND_Y - OBBY_CUBE_R;
  obbyPlayerVx = 0;
  obbyPlayerVy = 0;
  obbyPlayerOnGround = true;
  obbyPlayerFacing = 1;
  obbyJumpHeld = false;
  const course = generateObbyCourse(obbyDifficulty);
  obbySpikes = course.spikes;
  obbyPlatforms = course.platforms;
  for (let i = attacks.length - 1; i >= 0; i--) {
    if (attacks[i]?.kind === "grabhand") attacks.splice(i, 1);
  }
}

function endObbySuccess(): void {
  obbyDifficulty += 1;
  // Restore player to a safe spot in the boss arena.
  player.x = 200;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.invuln = 1.5;
  setScene("fight");
}

function endObbyFail(): void {
  player.hp = 0;
  gameState = bossMode ? "won" : "lost";
  setScene("results");
}

function updateObby(dt: number): void {
  if (paused) return;
  obbyTimer -= dt;

  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("A");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("D");
  const wantsJump = keys.has(" ") || keys.has("ArrowUp") || keys.has("w") || keys.has("W");

  if (left && !right) {
    obbyPlayerVx = -OBBY_SPEED;
    obbyPlayerFacing = -1;
  } else if (right && !left) {
    obbyPlayerVx = OBBY_SPEED;
    obbyPlayerFacing = 1;
  } else {
    obbyPlayerVx = 0;
  }

  if (wantsJump && !obbyJumpHeld && obbyPlayerOnGround) {
    obbyPlayerVy = -OBBY_JUMP_VELOCITY;
    obbyPlayerOnGround = false;
  }
  obbyJumpHeld = wantsJump;

  const prevBottom = obbyPlayerY + OBBY_CUBE_R;
  obbyPlayerVy += OBBY_GRAVITY * dt;
  obbyPlayerX += obbyPlayerVx * dt;
  obbyPlayerY += obbyPlayerVy * dt;
  obbyPlayerX = clampN(obbyPlayerX, OBBY_CUBE_R, WIDTH - OBBY_CUBE_R);

  obbyPlayerOnGround = false;
  // One-way platform collision (only land from above).
  if (obbyPlayerVy >= 0) {
    for (const p of obbyPlatforms) {
      if (
        obbyPlayerX + OBBY_CUBE_R > p.x &&
        obbyPlayerX - OBBY_CUBE_R < p.x + p.w &&
        prevBottom <= p.y + 1 &&
        obbyPlayerY + OBBY_CUBE_R >= p.y
      ) {
        obbyPlayerY = p.y - OBBY_CUBE_R;
        obbyPlayerVy = 0;
        obbyPlayerOnGround = true;
        break;
      }
    }
  }
  if (obbyPlayerY + OBBY_CUBE_R >= OBBY_GROUND_Y) {
    obbyPlayerY = OBBY_GROUND_Y - OBBY_CUBE_R;
    obbyPlayerVy = 0;
    obbyPlayerOnGround = true;
  }

  // Spike collision.
  for (const spike of obbySpikes) {
    const dx = Math.abs(obbyPlayerX - spike.x);
    const cubeBottom = obbyPlayerY + OBBY_CUBE_R;
    const cubeTop = obbyPlayerY - OBBY_CUBE_R;
    const apex = spike.y - spike.size;
    if (
      dx < OBBY_CUBE_R + spike.size / 2 - 5 &&
      cubeBottom > apex + 3 &&
      cubeTop < spike.y - 2
    ) {
      endObbyFail();
      return;
    }
  }

  // Reach the goal flag.
  if (obbyPlayerX >= OBBY_GOAL_X) {
    endObbySuccess();
    return;
  }

  // Time out.
  if (obbyTimer <= 0) {
    endObbyFail();
  }
}

function drawObby(): void {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // Parallax background stripes.
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(i * 90 + 20, 0, 28, HEIGHT);
  }
  // Floor.
  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(0, OBBY_GROUND_Y, WIDTH, HEIGHT - OBBY_GROUND_Y);
  ctx.fillStyle = "#3a78ff";
  ctx.fillRect(0, OBBY_GROUND_Y, WIDTH, 4);

  // Spawn pad highlight.
  ctx.fillStyle = "rgba(120, 220, 120, 0.25)";
  ctx.fillRect(0, OBBY_GROUND_Y - 4, 100, 4);

  // Goal flag.
  ctx.fillStyle = "#0a0a14";
  ctx.fillRect(OBBY_GOAL_X - 2, OBBY_GROUND_Y - 90, 4, 90);
  ctx.fillStyle = "#3aff8a";
  ctx.beginPath();
  ctx.moveTo(OBBY_GOAL_X + 2, OBBY_GROUND_Y - 88);
  ctx.lineTo(OBBY_GOAL_X + 38, OBBY_GROUND_Y - 76);
  ctx.lineTo(OBBY_GOAL_X + 2, OBBY_GROUND_Y - 64);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Platforms.
  for (const p of obbyPlatforms) {
    ctx.fillStyle = "#3a78ff";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  }

  // Spikes.
  for (const spike of obbySpikes) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spike.x - spike.size / 2, spike.y);
    ctx.lineTo(spike.x + spike.size / 2, spike.y);
    ctx.lineTo(spike.x, spike.y - spike.size);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Player cube.
  ctx.save();
  ctx.translate(obbyPlayerX, obbyPlayerY);
  if (!obbyPlayerOnGround) ctx.rotate(elapsed * 6 * obbyPlayerFacing);
  drawGeomCubeAt(0, 0, OBBY_CUBE_R, false);
  ctx.restore();

  // HUD.
  ctx.fillStyle = "#fff";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(obbyTimer.toFixed(1), WIDTH / 2, 70);
  ctx.font = "italic 18px 'Comic Sans MS', cursive";
  ctx.fillStyle = "#a0c0ff";
  ctx.fillText(`REACH THE FLAG  —  WAVE ${obbyDifficulty}`, WIDTH / 2, 100);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.fillText("← → move   ·   SPACE / ↑ jump", WIDTH / 2, 122);
}
function pumpHeartbeat(active: boolean, intensity: number): void {
  if (!active) {
    lastHeartbeatTime = elapsed - 10;
    return;
  }
  // Faster heartbeat as intensity climbs.
  const interval = 1.0 - intensity * 0.45; // 1.0s → 0.55s
  if (elapsed - lastHeartbeatTime > interval) {
    playHeartbeatThump(0, intensity);
    playHeartbeatThump(0.16, intensity * 0.85);
    lastHeartbeatTime = elapsed;
  }
}

function drawHorrorVignette(intensity: number): void {
  if (intensity <= 0) return;
  const beat = Math.max(
    Math.pow(Math.max(0, Math.sin(elapsed * 6)), 8),
    Math.pow(Math.max(0, Math.sin((elapsed - 0.16) * 6)), 8),
  );
  const alpha = 0.55 * intensity * (0.5 + beat * 0.5);
  const grad = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT / 2,
    Math.min(WIDTH, HEIGHT) * 0.18,
    WIDTH / 2,
    HEIGHT / 2,
    Math.max(WIDTH, HEIGHT) * 0.7,
  );
  grad.addColorStop(0, "rgba(140, 0, 0, 0)");
  grad.addColorStop(0.55, `rgba(160, 0, 0, ${alpha * 0.4})`);
  grad.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}
type Scene =
  | "intro"
  | "fight"
  | "results"
  | "hub"
  | "shop"
  | "bossmode"
  | "warmup"
  | "levelselect"
  | "bosscreator"
  | "obby";
let scene: Scene = "intro";
let sceneTime = 0;

interface UiButton {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  onClick: () => void;
}
let uiButtons: UiButton[] = [];
let pauseUiButtons: UiButton[] = [];
let levelSelectScrollX = 0;
let bossModeScrollX = 0;
let paused = false;
const PAUSE_BTN_W = 44;
const PAUSE_BTN_H = 44;
const PAUSE_BTN_X = WIDTH - PAUSE_BTN_W - 16;
const PAUSE_BTN_Y = 16;
const PAUSE_BTN_HIDDEN_SCENES: ReadonlySet<Scene> = new Set<Scene>([
  "hub",
  "shop",
  "bossmode",
  "levelselect",
  "bosscreator",
  "obby",
]);

function pauseButtonVisible(): boolean {
  return !PAUSE_BTN_HIDDEN_SCENES.has(scene);
}

function setPaused(p: boolean): void {
  paused = p;
  pauseUiButtons = [];
  if (!p) return;
  const btnW = 280;
  const btnH = 60;
  const gap = 14;
  const total = btnH * 4 + gap * 3;
  const startY = (HEIGHT - total) / 2 + 30;
  const x = (WIDTH - btnW) / 2;
  pauseUiButtons.push({
    x, y: startY, w: btnW, h: btnH,
    label: "RESUME",
    onClick: () => setPaused(false),
  });
  pauseUiButtons.push({
    x, y: startY + (btnH + gap), w: btnW, h: btnH,
    label: "RETRY",
    onClick: () => {
      setPaused(false);
      if (bossMode) resetBossFight();
      else resetFight();
      setScene("fight");
    },
  });
  pauseUiButtons.push({
    x, y: startY + (btnH + gap) * 2, w: btnW, h: btnH,
    label: "SELECT LEVEL",
    onClick: () => {
      setPaused(false);
      bossMode = false;
      setScene("levelselect");
    },
  });
  pauseUiButtons.push({
    x, y: startY + (btnH + gap) * 3, w: btnW, h: btnH,
    label: "GO TO HUB",
    onClick: () => {
      setPaused(false);
      bossMode = false;
      setScene("hub");
    },
  });
}

function setScene(next: Scene): void {
  scene = next;
  sceneTime = 0;
  uiButtons = [];
  if (next === "levelselect") levelSelectScrollX = 0;
  if (next === "bossmode") bossModeScrollX = 0;
  if (next === "bosscreator") {
    cbNameInput.value = customBoss.name;
    cbAttackInput.value = customBoss.attackDesc;
  } else {
    positionBossCreatorInputs(false);
  }
}

function recordBossBeaten(id: string): void {
  if (!beatenBosses.has(id)) {
    beatenBosses.add(id);
    saveBeatenBosses();
    coins += 100;
    saveProgression();
  }
}

function resetBossFight(): void {
  // Player IS the boss; AI plays the kid.
  bossMode = true;
  kidPauseTimer = 0;
  bossAbilityCooldown = 0.6; // brief startup grace
  aimX = WIDTH / 2;
  aimY = GROUND_Y / 2;
  pencilBossArmed = "none";
  pencilButtonsPhase = "";
  elementalButtonsPhase = -1;

  player.hp = 5;
  player.invuln = 0;
  player.x = 200;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.ducking = false;
  player.facing = 1;
  player.runPhase = 0;

  if (currentBossId === "mrpencil") {
    boss.homeX = WIDTH / 2;
    boss.homeY = 220;
    boss.radius = 60;
    boss.hpMax = 120;
  } else if (currentBossId === "custom") {
    boss.homeX = WIDTH / 2;
    boss.homeY = 220;
    boss.radius = 70;
    boss.hpMax = 100;
  } else {
    boss.homeX = WIDTH - 110;
    boss.homeY = 200;
    boss.radius = 60;
    boss.hpMax = 100;
  }
  boss.hp = boss.hpMax;
  boss.phase = "alive";
  boss.x = boss.homeX;
  boss.y = boss.homeY;
  boss.atHome = true;
  boss.visibility = 1;
  boss.vulnerableTime = 0;
  boss.hitCooldown = 0;
  boss.mouthPhase = 0;
  boss.facing = -1;
  boss.shieldTime = 0;

  attacks.length = 0;
  pellets.length = 0;
  pelletInventory = 0;
  pelletSpawnTimer = 1.0;
  attackSpawnTimer = 9999; // disable auto attacks; player IS the attack
  transitionTime = 0;
  screenShake = 0;
  gameState = "playing";

  platforms.length = 0;
  nextPlatformId = 1;
  const skipPlatforms =
    currentBossId === "mrpencil" ||
    currentBossId === "elemental" ||
    currentBossId === "beatrix" ||
    currentBossId === "geom" ||
    (currentBossId === "custom" && !customBossConfig.platforms);
  if (!skipPlatforms) {
    buildPlatformLayout();
  }
}

function resetFight(): void {
  bossMode = false;
  elementalPhase = 0;
  for (const e of ELEMENTS) elementInventory[e] = 0;
  playerLifted = false;
  playerSubmergedTime = 0;
  if (currentBossId === "mrpencil") {
    boss.homeX = WIDTH / 2;
    boss.homeY = 220;
    boss.radius = 60;
    boss.hpMax = 120;
  } else if (currentBossId === "elemental") {
    boss.homeX = WIDTH / 2;
    boss.homeY = 200;
    boss.radius = 50;
    boss.hpMax = ELEMENTAL_PHASE_HP[0]!;
  } else if (currentBossId === "beatrix") {
    boss.homeX = WIDTH - 160;
    boss.homeY = 220;
    boss.radius = 70;
    boss.hpMax = 100;
  } else if (currentBossId === "geom") {
    boss.homeX = WIDTH - 140;
    boss.homeY = 200;
    boss.radius = 36;
    boss.hpMax = 110;
    obbyDifficulty = 1;
  } else if (currentBossId === "custom") {
    boss.homeX = WIDTH / 2;
    boss.homeY = 220;
    boss.radius = 70;
    boss.hpMax = 100;
  } else {
    boss.homeX = WIDTH - 110;
    boss.homeY = 200;
    boss.radius = 60;
    boss.hpMax = 100;
  }
  boss.shieldTime = 0;
  player.hp = 5;
  player.invuln = 0;
  player.x = 200;
  player.y = GROUND_Y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.ducking = false;
  player.facing = 1;
  player.runPhase = 0;

  boss.hp = boss.hpMax;
  boss.phase = "alive";
  boss.x = boss.homeX;
  boss.y = boss.homeY;
  boss.atHome = true;
  boss.visibility = 1;
  boss.vulnerableTime = 0;
  boss.hitCooldown = 0;
  boss.mouthPhase = 0;
  boss.shieldTime = 0;

  attacks.length = 0;
  pellets.length = 0;
  pelletInventory = 0;
  pelletSpawnTimer = 1.5;
  attackSpawnTimer = 2.2;
  transitionTime = 0;
  screenShake = 0;
  gameState = "playing";

  platforms.length = 0;
  nextPlatformId = 1;
  const skipPlatforms =
    currentBossId === "mrpencil" ||
    currentBossId === "elemental" ||
    currentBossId === "beatrix" ||
    currentBossId === "geom" ||
    (currentBossId === "custom" && !customBossConfig.platforms);
  if (!skipPlatforms) {
    buildPlatformLayout();
  }
}

interface Pellet {
  x: number;
  y: number;
  platformIndex: number;
  bobPhase: number;
  id: number;
  kind: "white" | "eraser" | Element | "tarr" | "spike";
}
const pellets: Pellet[] = [];
let pelletSpawnTimer = 1.5;
let nextPelletId = 1;
let pelletInventory = 0;

// Build a fixed scattered platform layout that falls in once and stays
function buildPlatformLayout(): void {
  const layout: { x: number; y: number; w: number; h: number }[] = [
    { x: 120, y: GROUND_Y - 110, w: 110, h: 18 },
    { x: 280, y: GROUND_Y - 200, w: 130, h: 18 },
    { x: 460, y: GROUND_Y - 130, w: 120, h: 18 },
    { x: 620, y: GROUND_Y - 230, w: 110, h: 18 },
    { x: 200, y: GROUND_Y - 320, w: 140, h: 18 },
    { x: 420, y: GROUND_Y - 360, w: 130, h: 18 },
    { x: 700, y: GROUND_Y - 340, w: 110, h: 18 },
    { x: 90, y: GROUND_Y - 240, w: 100, h: 18 },
    { x: 800, y: GROUND_Y - 160, w: 120, h: 18 },
  ];
  layout.forEach((p, i) => {
    platforms.push({
      x: p.x,
      y: -40 - i * 20,
      w: p.w,
      h: p.h,
      targetY: p.y,
      vy: 220,
      spawnDelay: i * 0.18,
      id: nextPlatformId++,
    });
  });
}
buildPlatformLayout();

const keys = new Set<string>();
function isTextFieldFocused(): boolean {
  const ae = document.activeElement;
  return ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement;
}
window.addEventListener("keydown", (event) => {
  // Don't swallow keys while the user is typing in a real text field.
  if (isTextFieldFocused()) return;
  if (
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.key === " "
  ) {
    event.preventDefault();
  }
  keys.add(event.key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key));

window.addEventListener("keydown", (event) => {
  if (scene === "warmup" && (event.key === " " || event.key === "Enter")) {
    resetFight();
    setScene("fight");
    return;
  }
  if (scene !== "fight" || gameState !== "playing") return;
  if (event.key === "e" || event.key === "E") {
    if (currentBossId === "elemental") {
      if (boss.vulnerableTime > 0) return;
      if (elementalPhase === 4) {
        // Master: need one of each element.
        if (ELEMENTS.every((e) => elementInventory[e] > 0)) {
          for (const e of ELEMENTS) elementInventory[e] -= 1;
          boss.vulnerableTime = VULNERABLE_DURATION;
        }
      } else {
        const need = ELEMENTS[elementalPhase]!;
        if (elementInventory[need] > 0) {
          elementInventory[need] -= 1;
          boss.vulnerableTime = VULNERABLE_DURATION;
        }
      }
      return;
    }
    if (pelletInventory > 0 && boss.vulnerableTime <= 0) {
      pelletInventory -= 1;
      boss.vulnerableTime = VULNERABLE_DURATION;
    }
  }
});

function handleClickAt(mx: number, my: number): void {
  if (paused) {
    for (const btn of pauseUiButtons) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        btn.onClick();
        return;
      }
    }
    return;
  }
  if (
    pauseButtonVisible() &&
    mx >= PAUSE_BTN_X && mx <= PAUSE_BTN_X + PAUSE_BTN_W &&
    my >= PAUSE_BTN_Y && my <= PAUSE_BTN_Y + PAUSE_BTN_H
  ) {
    setPaused(true);
    return;
  }
  for (const btn of uiButtons) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      btn.onClick();
      return;
    }
  }
  if (
    scene === "fight" &&
    bossMode &&
    currentBossId === "mrpencil" &&
    pencilBossArmed === "mallet" &&
    bossAbilityCooldown <= 0 &&
    my < GROUND_Y
  ) {
    spawnPencilHammerAt(mx);
    bossAbilityCooldown = BOSS_ABILITY_COOLDOWN;
    pencilBossArmed = "none";
  }
}

canvas.addEventListener("click", (event) => {
  const ac = getAudioCtx();
  if (ac && ac.state === "suspended") {
    void ac.resume();
  }
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const mx = (event.clientX - rect.left) * sx;
  const my = (event.clientY - rect.top) * sy;
  handleClickAt(mx, my);
});

canvas.addEventListener(
  "wheel",
  (event) => {
    if (paused) return;
    if (scene === "bosscreator" && cbHelpOpen) {
      cbHelpScroll += event.deltaY;
      event.preventDefault();
      return;
    }
    if (scene !== "levelselect" && scene !== "bossmode") return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (scene === "levelselect") levelSelectScrollX += delta;
    else bossModeScrollX += delta;
    event.preventDefault();
  },
  { passive: false },
);

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  mouseArenaX = (event.clientX - rect.left) * sx;
  mouseArenaY = (event.clientY - rect.top) * sy;
  if (cbDrawingPhase) {
    const r = bossCreatorPadRect(cbDrawingPhase);
    const lx = ((mouseArenaX - r.x) / r.w) * CUSTOM_BOSS_PAD;
    const ly = ((mouseArenaY - r.y) / r.h) * CUSTOM_BOSS_PAD;
    if (lx < 0 || ly < 0 || lx > CUSTOM_BOSS_PAD || ly > CUSTOM_BOSS_PAD) return;
    const pctx = cbDrawingPhase === 1 ? customBossPad1Ctx : customBossPad2Ctx;
    pctx.strokeStyle = "#0a0a0a";
    pctx.lineWidth = 5;
    pctx.lineCap = "round";
    pctx.lineJoin = "round";
    pctx.beginPath();
    pctx.moveTo(cbDrawLastX, cbDrawLastY);
    pctx.lineTo(lx, ly);
    pctx.stroke();
    cbDrawLastX = lx;
    cbDrawLastY = ly;
  }
});

function bossCreatorPadRect(phase: 1 | 2): { x: number; y: number; w: number; h: number } {
  const w = 220;
  const h = 220;
  const y = 110;
  const gap = 60;
  const totalW = w * 2 + gap;
  const startX = (WIDTH - totalW) / 2;
  return { x: startX + (phase === 1 ? 0 : w + gap), y, w, h };
}

canvas.addEventListener("mousedown", (event) => {
  if (scene !== "bosscreator") return;
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const mx = (event.clientX - rect.left) * sx;
  const my = (event.clientY - rect.top) * sy;
  cbNameInput.blur();
  cbAttackInput.blur();
  for (const phase of [1, 2] as const) {
    const r = bossCreatorPadRect(phase);
    if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
      cbDrawingPhase = phase;
      const lx = ((mx - r.x) / r.w) * CUSTOM_BOSS_PAD;
      const ly = ((my - r.y) / r.h) * CUSTOM_BOSS_PAD;
      cbDrawLastX = lx;
      cbDrawLastY = ly;
      const pctx = phase === 1 ? customBossPad1Ctx : customBossPad2Ctx;
      pctx.fillStyle = "#0a0a0a";
      pctx.beginPath();
      pctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      pctx.fill();
      return;
    }
  }
});

window.addEventListener("mouseup", () => {
  cbDrawingPhase = null;
});


function setupPencilBossPhase2Buttons(): void {
  const w = 280;
  const h = 70;
  const x = (WIDTH - w) / 2;
  const y = HEIGHT - h - 14;
  uiButtons.push({
    x, y, w, h,
    label: "FIRE FISTS",
    sub: "throw a pointing-hand at the kid",
    onClick: () => {
      // No cooldown — click as fast as you can.
      spawnFistProjectile();
    },
  });
}

function ensurePencilBossButtons(): void {
  if (pencilButtonsPhase === boss.phase) return;
  uiButtons = [];
  pencilButtonsPhase = boss.phase;
  if (boss.phase === "alive") {
    setupPencilBossButtons();
  } else if (boss.phase === "ghost") {
    setupPencilBossPhase2Buttons();
  }
  // transitioning: no buttons.
}

function setupPencilBossButtons(): void {
  const btnW = 170;
  const btnH = 56;
  const gap = 14;
  const totalW = btnW * 3 + gap * 2;
  const startX = (WIDTH - totalW) / 2;
  const y = HEIGHT - btnH - 14;
  uiButtons.push({
    x: startX, y, w: btnW, h: btnH,
    label: "MALLET",
    sub: "click in arena to aim",
    onClick: () => {
      if (bossAbilityCooldown > 0) return;
      pencilBossArmed = pencilBossArmed === "mallet" ? "none" : "mallet";
    },
  });
  uiButtons.push({
    x: startX + (btnW + gap), y, w: btnW, h: btnH,
    label: "SWORD",
    sub: "instant slash",
    onClick: () => {
      if (bossAbilityCooldown > 0) return;
      spawnPencilSword();
      bossAbilityCooldown = BOSS_ABILITY_COOLDOWN;
      pencilBossArmed = "none";
    },
  });
  uiButtons.push({
    x: startX + (btnW + gap) * 2, y, w: btnW, h: btnH,
    label: "SHIELD",
    sub: "block hits 3.5s",
    onClick: () => {
      if (bossAbilityCooldown > 0) return;
      spawnPencilShield();
      bossAbilityCooldown = BOSS_ABILITY_COOLDOWN;
      pencilBossArmed = "none";
    },
  });
}

let lastTimestamp = performance.now();
let elapsed = 0;
let wobbleTick = 0;
let wobbleSeed = 0;
let gameState: "playing" | "lost" | "won" = "playing";

function jitter(id: number, amount: number): number {
  const n = Math.sin(id * 12.9898 + wobbleSeed * 78.233) * 43758.5453;
  return ((n - Math.floor(n)) - 0.5) * 2 * amount;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clampN(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function updateKidAi(dt: number): void {
  const skill = (bossModeDifficulty - 1) / 9; // 0 (easy) to 1 (hard)
  const speedMul = 0.42 + skill * 0.7; // ~0.42 at lvl 1, ~1.12 at lvl 10
  const dodgeRange = 130 + skill * 220;
  const jumpAggression = 0.25 + skill * 0.85;

  // At low difficulty the kid stutters: occasionally pauses for a beat.
  if (kidPauseTimer > 0) {
    kidPauseTimer -= dt;
    player.vx *= 0.5;
    return;
  }
  if (skill < 0.6 && Math.random() < (0.6 - skill) * 0.55 * dt) {
    kidPauseTimer = 0.25 + Math.random() * (0.45 - skill * 0.3);
    return;
  }

  // At low difficulty the kid sometimes targets the wrong thing.
  let targetX = player.x;
  let targetY = player.y;
  let dodging = false;

  if (boss.vulnerableTime > 0) {
    // Pursuit eagerness scales with skill.
    const willChase = Math.random() < 0.4 + skill * 0.6;
    if (willChase) {
      targetX = boss.x;
      targetY = boss.y;
    } else if (pellets.length > 0) {
      const p = pellets[0]!;
      targetX = p.x;
      targetY = p.y;
    }
  } else if (pellets.length > 0) {
    // High-skill kid finds nearest pellet; low-skill kid often picks a random one.
    let chosen = pellets[Math.floor(Math.random() * pellets.length)]!;
    if (Math.random() < 0.3 + skill * 0.7) {
      let bestDist = Infinity;
      for (const p of pellets) {
        const d = (p.x - player.x) ** 2 + (p.y - player.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          chosen = p;
        }
      }
    }
    targetX = chosen.x;
    targetY = chosen.y;
  } else {
    const dx = boss.x - player.x;
    const dy = boss.y - player.y;
    if (dx * dx + dy * dy < dodgeRange * dodgeRange) {
      targetX = player.x - Math.sign(dx || 1) * 200;
      targetY = player.y;
      dodging = true;
    } else {
      targetX = WIDTH / 2 + Math.sin(elapsed * 0.5) * 200;
      targetY = player.y;
    }
  }

  if (targetX < player.x - 6) {
    player.vx = -MOVE_SPEED * speedMul;
    player.facing = -1;
  } else if (targetX > player.x + 6) {
    player.vx = MOVE_SPEED * speedMul;
    player.facing = 1;
  } else {
    player.vx *= 0.6;
  }

  // Jump toward elevated targets — high-skill kid jumps reliably.
  if (player.onGround && targetY < player.y - 70 && Math.random() < jumpAggression) {
    player.vy = -JUMP_VELOCITY;
    player.onGround = false;
  }

  // Panic dodge sideways when boss bears down from above.
  if (!dodging) {
    const dxBoss = Math.abs(boss.x - player.x);
    const dyBoss = boss.y - player.y;
    if (dxBoss < 50 && dyBoss < 0 && dyBoss > -200 && player.onGround && boss.vulnerableTime <= 0) {
      if (Math.random() < 0.4 + skill * 0.6) {
        player.vx = (boss.x < player.x ? 1 : -1) * MOVE_SPEED * speedMul;
      }
    }
  }
}

function applyKidPhysics(dt: number): void {
  const prevBottom = player.y;
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const halfWidth = BODY_WIDTH / 2;
  if (player.x < halfWidth) {
    player.x = halfWidth;
    player.vx = 0;
  }
  if (player.x > WIDTH - halfWidth) {
    player.x = WIDTH - halfWidth;
    player.vx = 0;
  }
  player.onGround = false;
  if (player.vy >= 0) {
    for (const p of platforms) {
      if (
        player.x + halfWidth > p.x &&
        player.x - halfWidth < p.x + p.w &&
        prevBottom <= p.y + 1 &&
        player.y >= p.y &&
        player.y <= p.y + p.h + 6
      ) {
        player.y = p.y;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }
  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  }
  if (player.onGround && playerLifted) {
    playerLifted = false;
    damagePlayer();
  }
  if (Math.abs(player.vx) > 1 && player.onGround) {
    player.runPhase += dt * 12;
  } else {
    player.runPhase *= 0.85;
  }
}

function updateBossModePellets(dt: number): void {
  pelletSpawnTimer -= dt;
  if (pelletSpawnTimer <= 0 && pellets.length < 3) {
    spawnPellet();
    pelletSpawnTimer = rand(2.5, 4.5);
  }
  // Kid auto-collects + auto-uses pellets to make boss vulnerable.
  for (let i = pellets.length - 1; i >= 0; i--) {
    const pel = pellets[i]!;
    pel.bobPhase += dt * 4;
    const aabb = getPlayerAabb();
    const closestX = Math.max(aabb.x, Math.min(pel.x, aabb.x + aabb.w));
    const closestY = Math.max(aabb.y, Math.min(pel.y, aabb.y + aabb.h));
    const dx = pel.x - closestX;
    const dy = pel.y - closestY;
    if (dx * dx + dy * dy < 18 * 18) {
      pellets.splice(i, 1);
      if (boss.vulnerableTime <= 0) boss.vulnerableTime = VULNERABLE_DURATION;
    }
  }
}

function updateBossFight(dt: number): void {
  if (gameState !== "playing") return;
  elapsed += dt;
  wobbleTick += dt;
  if (wobbleTick > 0.1) {
    wobbleTick = 0;
    wobbleSeed = Math.random() * 1000;
  }
  if (player.invuln > 0) player.invuln -= dt;
  if (boss.vulnerableTime > 0) boss.vulnerableTime -= dt;
  if (boss.hitCooldown > 0) boss.hitCooldown -= dt;

  // Phase transition takes over the world for its duration.
  if (boss.phase === "transitioning") {
    tickTransition(dt);
    updatePlatforms(dt);
    return;
  }

  // Boss stays at home (updateAttacks tweens him there when no attack is active).
  boss.mouthPhase += dt * 8;
  if (bossAbilityCooldown > 0) bossAbilityCooldown -= dt;

  if (currentBossId === "mrpencil") {
    // Mr. Pencil is driven entirely by on-screen buttons; skip aim+SPACE.
  } else if (currentBossId === "elemental") {
    // Mouse-driven aim — follow the cursor when it's hovering inside the arena
    // (above the bottom button row). Arrow keys can fine-tune.
    const buttonRowTop = HEIGHT - 90;
    if (mouseArenaY < buttonRowTop && mouseArenaY > 0 && mouseArenaX > 0 && mouseArenaX < WIDTH) {
      aimX = mouseArenaX;
      aimY = clampN(mouseArenaY, 40, GROUND_Y - 40);
    }
    const left = keys.has("ArrowLeft");
    const right = keys.has("ArrowRight");
    const up = keys.has("ArrowUp");
    const down = keys.has("ArrowDown");
    if (left) aimX -= AIM_SPEED * dt;
    if (right) aimX += AIM_SPEED * dt;
    if (up) aimY -= AIM_SPEED * dt;
    if (down) aimY += AIM_SPEED * dt;
    aimX = clampN(aimX, 40, WIDTH - 40);
    aimY = clampN(aimY, 40, GROUND_Y - 40);
  } else {
    const left = keys.has("ArrowLeft");
    const right = keys.has("ArrowRight");
    const up = keys.has("ArrowUp");
    const down = keys.has("ArrowDown");
    if (left) aimX -= AIM_SPEED * dt;
    if (right) aimX += AIM_SPEED * dt;
    if (up) aimY -= AIM_SPEED * dt;
    if (down) aimY += AIM_SPEED * dt;
    aimX = clampN(aimX, 40, WIDTH - 40);
    aimY = clampN(aimY, 40, GROUND_Y - 40);

    const wantsAbility =
      keys.has(" ") || keys.has("Spacebar") || keys.has("Enter") ||
      keys.has("z") || keys.has("Z") || keys.has("x") || keys.has("X");
    if (wantsAbility && bossAbilityCooldown <= 0 && attacks.length === 0) {
      triggerBossModeAbility();
      bossAbilityCooldown = BOSS_ABILITY_COOLDOWN;
    }
  }

  updateKidAi(dt);
  applyKidPhysics(dt);

  // Kid only damages the boss via contact while boss is vulnerable AND not shielded.
  if (boss.vulnerableTime > 0 && boss.hitCooldown <= 0 && boss.shieldTime <= 0) {
    const aabb = getPlayerAabb();
    const closestX = Math.max(aabb.x, Math.min(boss.x, aabb.x + aabb.w));
    const closestY = Math.max(aabb.y, Math.min(boss.y, aabb.y + aabb.h));
    const dx = boss.x - closestX;
    const dy = boss.y - closestY;
    if (dx * dx + dy * dy < boss.radius * boss.radius) {
      boss.hp = Math.max(0, boss.hp - HIT_DAMAGE);
      boss.hitCooldown = HIT_COOLDOWN;
      if (boss.hp <= 0) {
        if (currentBossId === "elemental") {
          advanceElementalPhase(true);
        } else if (currentBossId === "beatrix") {
          gameState = "lost";
        } else if (boss.phase === "alive") {
          transitionToGhostPhase();
        } else {
          gameState = "lost";
        }
      }
    }
  }

  // Win check: kid HP could already be 0 from chomp/laser ticks.
  if (player.hp <= 0) gameState = "won";

  updatePlatforms(dt);
  updateBossModePellets(dt);
  updateAttacks(dt);
}

function triggerBossModeAbility(): void {
  if (boss.phase === "ghost") {
    // Laser starts pointed at the aim cursor instead of the kid.
    attacks.push({
      kind: "laser",
      rectX: aimX,
      rectY: aimY,
      rectW: LASER_BEAM_THICKNESS,
      rectH: LASER_BEAM_THICKNESS,
      horizontal: true,
      travelDir: 1,
      warnTime: 0,
      traverseTime: 0,
      traverseDuration: 0,
      trackTime: LASER_TRACK_TIME,
      lockTime: LASER_LOCK_TIME,
      fireTime: LASER_FIRE_TIME,
      phase: "track",
      id: nextAttackId++,
      hasHit: false,
    });
    return;
  }
  // Phase 1 chomp uses the AIM cursor: the lane passes through the cursor and
  // travels from the boss-side edge of the screen to the opposite edge.
  const dx = aimX - boss.x;
  const dy = aimY - boss.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    const h = boss.radius * 2 + 16;
    const lane = clampN(aimY - h / 2, 20, GROUND_Y - h - 10);
    const dir: 1 | -1 = dx >= 0 ? 1 : -1;
    attacks.push({
      kind: "chomp",
      rectX: 0,
      rectY: lane,
      rectW: WIDTH,
      rectH: h,
      horizontal: true,
      travelDir: dir,
      warnTime: WARN_DURATION,
      traverseTime: 0,
      traverseDuration: 0.9,
      trackTime: 0,
      lockTime: 0,
      fireTime: 0,
      phase: "warn",
      id: nextAttackId++,
      hasHit: false,
    });
  } else {
    const w = boss.radius * 2 + 16;
    const lane = clampN(aimX - w / 2, 20, WIDTH - w - 20);
    const dir: 1 | -1 = dy >= 0 ? 1 : -1;
    attacks.push({
      kind: "chomp",
      rectX: lane,
      rectY: 0,
      rectW: w,
      rectH: GROUND_Y,
      horizontal: false,
      travelDir: dir,
      warnTime: WARN_DURATION,
      traverseTime: 0,
      traverseDuration: 0.9,
      trackTime: 0,
      lockTime: 0,
      fireTime: 0,
      phase: "warn",
      id: nextAttackId++,
      hasHit: false,
    });
  }
}



function getPlayerAabb(): { x: number; y: number; w: number; h: number } {
  const h = player.ducking ? DUCK_HEIGHT : STAND_HEIGHT;
  return {
    x: player.x - BODY_WIDTH / 2,
    y: player.y - h,
    w: BODY_WIDTH,
    h,
  };
}

function aabbOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnAttack(): void {
  if (attacks.length > 0) return;
  // Per-boss branches first, since some bosses use the "ghost" phase as their
  // own phase 2 (Geom, Mr. Pencil) and need their own attack pools.
  if (currentBossId === "mrpencil") {
    spawnPencilAttack();
    return;
  }
  if (currentBossId === "elemental") {
    spawnElementalAttack();
    return;
  }
  if (currentBossId === "beatrix") {
    spawnRedSlime();
    return;
  }
  if (currentBossId === "geom") {
    spawnGeomAttack();
    return;
  }
  if (boss.phase === "ghost") {
    spawnLaserAttack();
    return;
  }
  if (currentBossId === "custom") {
    const pool = getCustomBossAttackPool();
    if (pool.length === 0) return;
    pool[Math.floor(Math.random() * pool.length)]!();
    return;
  }
  const horizontal = Math.random() < 0.55;
  if (horizontal) {
    const h = boss.radius * 2 + 16;
    const y = rand(40, GROUND_Y - h - 20);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    attacks.push({
      kind: "chomp",
      rectX: 0,
      rectY: y,
      rectW: WIDTH,
      rectH: h,
      horizontal: true,
      travelDir: dir,
      warnTime: WARN_DURATION,
      traverseTime: 0,
      traverseDuration: 0.9,
      trackTime: 0,
      lockTime: 0,
      fireTime: 0,
      phase: "warn",
      id: nextAttackId++,
      hasHit: false,
    });
  } else {
    const w = boss.radius * 2 + 16;
    const x = rand(60, WIDTH - w - 60);
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    attacks.push({
      kind: "chomp",
      rectX: x,
      rectY: 0,
      rectW: w,
      rectH: GROUND_Y,
      horizontal: false,
      travelDir: dir,
      warnTime: WARN_DURATION,
      traverseTime: 0,
      traverseDuration: 0.9,
      trackTime: 0,
      lockTime: 0,
      fireTime: 0,
      phase: "warn",
      id: nextAttackId++,
      hasHit: false,
    });
  }
}

function tickLaserAttack(a: Attack, dt: number, idx: number): void {
  if (a.phase === "track") {
    // Beam end follows the player so it can be outrun briefly.
    const trackSpeed = Math.min(1, dt * 4.5);
    a.rectX += (player.x - a.rectX) * trackSpeed;
    a.rectY += ((player.y - 30) - a.rectY) * trackSpeed;
    a.trackTime -= dt;
    if (a.trackTime <= 0) a.phase = "locked";
  } else if (a.phase === "locked") {
    a.lockTime -= dt;
    if (a.lockTime <= 0) a.phase = "fire";
  } else if (a.phase === "fire") {
    if (!a.hasHit && laserHitsPlayer(a)) {
      damagePlayer();
      a.hasHit = true;
    }
    a.fireTime -= dt;
    if (a.fireTime <= 0) {
      a.phase = "done";
      attacks.splice(idx, 1);
    }
  }
}

function laserHitsPlayer(a: Attack): boolean {
  const aabb = getPlayerAabb();
  const px = aabb.x + aabb.w / 2;
  const py = aabb.y + aabb.h / 2;
  const ax = boss.x;
  const ay = boss.y;
  const bx = a.rectX;
  const by = a.rectY;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + dx * t;
  const closestY = ay + dy * t;
  const ddx = closestX - px;
  const ddy = closestY - py;
  const distSq = ddx * ddx + ddy * ddy;
  const reach = (a.customThickness ?? LASER_BEAM_THICKNESS) / 2 + Math.max(aabb.w, aabb.h) * 0.35;
  return distSq < reach * reach;
}

function spawnLaserAttack(): Attack {
  const a: Attack = {
    kind: "laser",
    rectX: player.x,
    rectY: player.y - 30,
    rectW: LASER_BEAM_THICKNESS,
    rectH: LASER_BEAM_THICKNESS,
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: LASER_TRACK_TIME,
    lockTime: LASER_LOCK_TIME,
    fireTime: LASER_FIRE_TIME,
    phase: "track",
    id: nextAttackId++,
    hasHit: false,
  };
  attacks.push(a);
  return a;
}

function spawnPencilAttack(): void {
  const isGhost = boss.phase === "ghost";
  if (!isGhost) {
    // Phase 1 rotation: sword, hammer, shield. Shield only fires occasionally
    // and not back-to-back.
    const lowHp = boss.hp / boss.hpMax < 0.55;
    if (boss.shieldTime <= 0 && Math.random() < (lowHp ? 0.28 : 0.18)) {
      spawnPencilShield();
      return;
    }
    if (Math.random() < 0.5) spawnPencilSword();
    else spawnPencilHammer();
    return;
  }
  const lowHp = boss.hp / boss.hpMax < 0.45;
  let r = Math.random();
  if (lowHp && boss.shieldTime <= 0 && r < 0.4) {
    spawnPencilShield();
    return;
  }
  r = Math.random();
  if (r < 0.4) spawnPencilSword();
  else if (r < 0.78) spawnPencilHammer();
  else spawnPencilShield();
}

function spawnPencilSword(): void {
  attacks.push({
    kind: "sword",
    rectX: boss.x,
    rectY: boss.y,
    rectW: 240, // sword length
    rectH: 28,
    horizontal: player.x < boss.x,
    travelDir: player.x < boss.x ? -1 : 1,
    warnTime: 0.7,
    traverseTime: 0,
    traverseDuration: 0.45,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnPencilHammerAt(targetX: number): void {
  const dropX = clampN(targetX, 80, WIDTH - 80);
  attacks.push({
    kind: "hammer",
    rectX: dropX,
    rectY: -100,
    rectW: 90,
    rectH: 60,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.7,
    traverseTime: 0,
    traverseDuration: 0.7,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnPencilHammer(): void {
  // Hammer drops at the player's current x.
  const dropX = clampN(player.x, 80, WIDTH - 80);
  attacks.push({
    kind: "hammer",
    rectX: dropX,
    rectY: -100, // current hammer head Y
    rectW: 90, // head width
    rectH: 60, // head height
    horizontal: true,
    travelDir: 1,
    warnTime: 0.7,
    traverseTime: 0, // shockwave reach (used in shockwave phase)
    traverseDuration: 0.7,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnPencilShield(): void {
  attacks.push({
    kind: "shield",
    rectX: boss.x,
    rectY: boss.y,
    rectW: boss.radius * 1.7,
    rectH: 0, // current radius progress 0..1
    horizontal: true,
    travelDir: 1,
    warnTime: 0.5,
    traverseTime: 0,
    traverseDuration: 3.5,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickSword(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    if (a.warnTime <= 0) {
      a.phase = "swing";
      a.traverseTime = 0;
      // Snap direction to wherever the player currently is.
      a.travelDir = player.x < boss.x ? -1 : 1;
    }
  } else if (a.phase === "swing") {
    a.traverseTime += dt;
    const t = Math.min(1, a.traverseTime / a.traverseDuration);
    // Sword sweeps from -1 rad to +1 rad (about 115°) around the boss in front.
    const ang = (-1.0 + 2.0 * t) * a.travelDir;
    const tipX = boss.x + Math.sin(ang) * a.rectW * a.travelDir;
    const tipY = boss.y + Math.cos(ang) * a.rectW;
    // Damage check: distance from player center to the sword segment.
    const aabb = getPlayerAabb();
    const px = aabb.x + aabb.w / 2;
    const py = aabb.y + aabb.h / 2;
    const dx = tipX - boss.x;
    const dy = tipY - boss.y;
    const len2 = dx * dx + dy * dy || 1;
    let segT = ((px - boss.x) * dx + (py - boss.y) * dy) / len2;
    segT = Math.max(0, Math.min(1, segT));
    const closeX = boss.x + dx * segT;
    const closeY = boss.y + dy * segT;
    const ddx = closeX - px;
    const ddy = closeY - py;
    if (!a.hasHit && ddx * ddx + ddy * ddy < 32 * 32) {
      damagePlayer();
      a.hasHit = true;
    }
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      attacks.splice(idx, 1);
    }
  }
}

function tickHammer(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    a.rectY = -100 + (1 - Math.max(0, a.warnTime / 0.7)) * 80; // hangs above
    if (a.warnTime <= 0) a.phase = "fall";
  } else if (a.phase === "fall") {
    a.rectY += 1900 * dt;
    if (a.rectY + a.rectH / 2 >= GROUND_Y) {
      a.rectY = GROUND_Y - a.rectH / 2;
      a.phase = "shockwave";
      a.traverseTime = 0;
      screenShake = Math.max(screenShake, 16);
    }
  } else if (a.phase === "shockwave") {
    a.traverseTime += dt;
    const reach = a.traverseTime * 720;
    // Damage if player overlaps a shockwave band along the ground.
    const aabb = getPlayerAabb();
    const onGround = aabb.y + aabb.h >= GROUND_Y - 10;
    const lDist = a.rectX - (aabb.x + aabb.w);
    const rDist = aabb.x - a.rectX;
    if (
      !a.hasHit &&
      onGround &&
      ((lDist >= reach - 50 && lDist <= reach + 30) || (rDist >= reach - 50 && rDist <= reach + 30))
    ) {
      damagePlayer();
      a.hasHit = true;
    }
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      attacks.splice(idx, 1);
    }
  }
}

function spawnFistProjectile(): void {
  // Fires the pointing-hand image straight at the player.
  const dx = player.x - boss.x;
  const dy = (player.y - STAND_HEIGHT * 0.45) - boss.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 620;
  const spread = 0.12; // small angular jitter so the volley looks chaotic
  const baseAng = Math.atan2(dy, dx);
  const ang = baseAng + (Math.random() * 2 - 1) * spread;
  attacks.push({
    kind: "fist",
    rectX: boss.x,
    rectY: boss.y,
    rectW: Math.cos(ang) * speed, // velocity X
    rectH: Math.sin(ang) * speed, // velocity Y
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0, // age (s)
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickFist(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.traverseTime += dt;
  // Damage on overlap with the kid.
  const aabb = getPlayerAabb();
  const closestX = Math.max(aabb.x, Math.min(a.rectX, aabb.x + aabb.w));
  const closestY = Math.max(aabb.y, Math.min(a.rectY, aabb.y + aabb.h));
  const ddx = a.rectX - closestX;
  const ddy = a.rectY - closestY;
  if (ddx * ddx + ddy * ddy < 22 * 22) {
    if (boss.vulnerableTime <= 0) damagePlayer();
    attacks.splice(idx, 1);
    return;
  }
  if (a.rectX < -80 || a.rectX > WIDTH + 80 || a.rectY < -80 || a.rectY > HEIGHT + 80) {
    attacks.splice(idx, 1);
  }
}

function tickShield(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    a.rectH = 1 - Math.max(0, a.warnTime / 0.5); // grow 0..1
    if (a.warnTime <= 0) {
      a.phase = "active";
      a.traverseTime = 0;
      boss.shieldTime = a.traverseDuration;
    }
  } else if (a.phase === "active") {
    a.traverseTime += dt;
    boss.shieldTime = Math.max(0, a.traverseDuration - a.traverseTime);
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      boss.shieldTime = 0;
      attacks.splice(idx, 1);
    }
  }
}

function spawnAirLiftAt(x: number): void {
  attacks.push({
    kind: "airlift",
    rectX: clampN(x, 60, WIDTH - 60),
    rectY: GROUND_Y - 4,
    rectW: 110,
    rectH: 24,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.9,
    traverseTime: 0,
    traverseDuration: 0.4,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnEarthRockAt(targetX: number, targetY: number): void {
  const dx = targetX - boss.x;
  const dy = targetY - (boss.y + 20);
  const len = Math.hypot(dx, dy) || 1;
  const speed = 460;
  attacks.push({
    kind: "earthrock",
    rectX: boss.x,
    rectY: boss.y + 20,
    rectW: (dx / len) * speed,
    rectH: (dy / len) * speed - 220,
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnFirePatchAt(x: number): void {
  attacks.push({
    kind: "firepatch",
    rectX: clampN(x, 80, WIDTH - 80),
    rectY: GROUND_Y,
    rectW: 110,
    rectH: 36,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.55,
    traverseTime: 0,
    traverseDuration: 4.5,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function isElementUsableInBossMode(e: Element): boolean {
  if (elementalPhase === 4) return true;
  return ELEMENTS[elementalPhase] === e;
}

function triggerElementalBossAbility(e: Element): void {
  if (e === "air") spawnAirLiftAt(aimX);
  else if (e === "earth") spawnEarthRockAt(aimX, aimY);
  else if (e === "fire") spawnFirePatchAt(aimX);
  else if (e === "water") spawnFlood();
}

function setupElementalBossButtons(): void {
  const btnW = 130;
  const btnH = 56;
  const gap = 12;
  const totalW = btnW * 4 + gap * 3;
  const startX = (WIDTH - totalW) / 2;
  const y = HEIGHT - btnH - 14;
  ELEMENTS.forEach((e, i) => {
    uiButtons.push({
      x: startX + i * (btnW + gap),
      y,
      w: btnW,
      h: btnH,
      label: e.toUpperCase(),
      onClick: () => {
        if (!isElementUsableInBossMode(e)) return;
        if (bossAbilityCooldown > 0) return;
        triggerElementalBossAbility(e);
        bossAbilityCooldown = 0.6;
      },
    });
  });
}

function ensureElementalBossButtons(): void {
  if (elementalButtonsPhase === elementalPhase) return;
  uiButtons = [];
  elementalButtonsPhase = elementalPhase;
  setupElementalBossButtons();
}

function spawnElementalAttack(): void {
  const e = elementalPhase === 4
    ? ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]!
    : ELEMENTS[elementalPhase]!;
  if (e === "air") spawnAirLift();
  else if (e === "earth") spawnEarthRock();
  else if (e === "fire") spawnFirePatch();
  else if (e === "water") spawnFlood();
}

function spawnAirLift(): void {
  attacks.push({
    kind: "airlift",
    rectX: clampN(player.x, 60, WIDTH - 60),
    rectY: GROUND_Y - 4,
    rectW: 110,
    rectH: 24,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.9,
    traverseTime: 0,
    traverseDuration: 0.4,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnEarthRock(): void {
  const dx = player.x - boss.x;
  const dy = (player.y - 30) - (boss.y + 20);
  const len = Math.hypot(dx, dy) || 1;
  const speed = 460;
  attacks.push({
    kind: "earthrock",
    rectX: boss.x,
    rectY: boss.y + 20,
    rectW: (dx / len) * speed,
    rectH: (dy / len) * speed - 220,
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnFirePatch(): void {
  const x = clampN(player.x + rand(-90, 90), 80, WIDTH - 80);
  attacks.push({
    kind: "firepatch",
    rectX: x,
    rectY: GROUND_Y,
    rectW: 110,
    rectH: 36,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.55,
    traverseTime: 0,
    traverseDuration: 4.5,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function spawnFlood(): void {
  attacks.push({
    kind: "flood",
    rectX: 0,
    rectY: GROUND_Y,
    rectW: WIDTH,
    rectH: 0,
    horizontal: true,
    travelDir: 1,
    warnTime: 0.6,
    traverseTime: 0,
    traverseDuration: 6,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickAirLift(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    if (a.warnTime <= 0) {
      a.phase = "active";
      a.traverseTime = 0;
      const playerOnPatch =
        player.onGround &&
        Math.abs(player.x - a.rectX) < a.rectW / 2 + 12;
      if (playerOnPatch) {
        player.vy = -1500;
        player.onGround = false;
        playerLifted = true;
      }
    }
  } else if (a.phase === "active") {
    a.traverseTime += dt;
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      attacks.splice(idx, 1);
    }
  }
}

function tickEarthRock(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.rectH += 700 * dt; // gravity
  const aabb = getPlayerAabb();
  const cx = Math.max(aabb.x, Math.min(a.rectX, aabb.x + aabb.w));
  const cy = Math.max(aabb.y, Math.min(a.rectY, aabb.y + aabb.h));
  const ddx = a.rectX - cx;
  const ddy = a.rectY - cy;
  if (!a.hasHit && ddx * ddx + ddy * ddy < 22 * 22) {
    damagePlayer();
    a.hasHit = true;
    attacks.splice(idx, 1);
    return;
  }
  if (a.rectY > GROUND_Y + 24 || a.rectX < -60 || a.rectX > WIDTH + 60) {
    attacks.splice(idx, 1);
  }
}

function tickFirePatch(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    if (a.warnTime <= 0) {
      a.phase = "active";
      a.traverseTime = 0;
      a.fireTime = 0;
    }
  } else if (a.phase === "active") {
    a.traverseTime += dt;
    a.fireTime -= dt;
    const aabb = getPlayerAabb();
    const inside =
      aabb.y + aabb.h >= GROUND_Y - 6 &&
      aabb.x < a.rectX + a.rectW / 2 &&
      aabb.x + aabb.w > a.rectX - a.rectW / 2;
    if (inside && a.fireTime <= 0) {
      damagePlayer();
      a.fireTime = 0.7;
    }
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      attacks.splice(idx, 1);
    }
  }
}

function tickFlood(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    if (a.warnTime <= 0) {
      a.phase = "active";
      a.traverseTime = 0;
    }
  } else if (a.phase === "active") {
    a.traverseTime += dt;
    const t = a.traverseTime / a.traverseDuration;
    let target = 0;
    const peak = 180;
    if (t < 0.25) target = (t / 0.25) * peak;
    else if (t < 0.7) target = peak;
    else target = (1 - (t - 0.7) / 0.3) * peak;
    a.rectH = Math.max(0, target);
    const aabb = getPlayerAabb();
    const surfaceY = GROUND_Y - a.rectH;
    if (a.lavaMode) {
      // Lava: any contact deals damage on a short cooldown — no air timer.
      a.damageCooldown = (a.damageCooldown ?? 0) - dt;
      const touching = aabb.y + aabb.h > surfaceY;
      if (touching && (a.damageCooldown ?? 0) <= 0) {
        damagePlayer();
        a.damageCooldown = 0.6;
      }
    } else {
      const headY = player.y - (player.ducking ? DUCK_HEIGHT : STAND_HEIGHT);
      if (headY > surfaceY) {
        playerSubmergedTime += dt;
        if (playerSubmergedTime >= 5) {
          damagePlayer();
          playerSubmergedTime = 0;
        }
      } else {
        playerSubmergedTime = Math.max(0, playerSubmergedTime - dt * 1.4);
      }
    }
    if (a.traverseTime >= a.traverseDuration) {
      a.phase = "done";
      playerSubmergedTime = 0;
      attacks.splice(idx, 1);
    }
  }
}

function spawnRedLaser(length: number): void {
  // Short red line projectile fired from the boss toward the player.
  const dx = player.x - boss.x;
  const dy = (player.y - 30) - boss.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 580;
  attacks.push({
    kind: "redlaser",
    rectX: boss.x,
    rectY: boss.y,
    rectW: (dx / len) * speed, // velocity x
    rectH: (dy / len) * speed, // velocity y
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
    customThickness: Math.max(20, Math.min(400, length)),
  });
}

function tickRedLaser(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.traverseTime += dt;
  // Hit check: distance from player AABB to the laser segment (head trails along
  // velocity direction back by `length` pixels).
  const length = a.customThickness ?? 100;
  const speed = Math.hypot(a.rectW, a.rectH) || 1;
  const dirX = a.rectW / speed;
  const dirY = a.rectH / speed;
  const tailX = a.rectX - dirX * length;
  const tailY = a.rectY - dirY * length;
  const aabb = getPlayerAabb();
  const px = aabb.x + aabb.w / 2;
  const py = aabb.y + aabb.h / 2;
  const sx = a.rectX - tailX;
  const sy = a.rectY - tailY;
  const segLen2 = sx * sx + sy * sy || 1;
  let t = ((px - tailX) * sx + (py - tailY) * sy) / segLen2;
  t = Math.max(0, Math.min(1, t));
  const closeX = tailX + sx * t;
  const closeY = tailY + sy * t;
  const ddx = closeX - px;
  const ddy = closeY - py;
  if (!a.hasHit && ddx * ddx + ddy * ddy < 16 * 16) {
    damagePlayer();
    a.hasHit = true;
    attacks.splice(idx, 1);
    return;
  }
  if (a.rectX < -100 || a.rectX > WIDTH + 100 || a.rectY < -100 || a.rectY > HEIGHT + 100 || a.traverseTime > 4) {
    attacks.splice(idx, 1);
  }
}

function drawRedLaserAttack(a: Attack): void {
  const length = a.customThickness ?? 100;
  const speed = Math.hypot(a.rectW, a.rectH) || 1;
  const dirX = a.rectW / speed;
  const dirY = a.rectH / speed;
  const tailX = a.rectX - dirX * length;
  const tailY = a.rectY - dirY * length;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 60, 60, 0.55)";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(a.rectX, a.rectY);
  ctx.stroke();
  ctx.strokeStyle = "#e23a3a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(a.rectX, a.rectY);
  ctx.stroke();
  ctx.restore();
}

function spawnGeomAttack(): void {
  if (boss.phase === "ghost") {
    // Phase 2: stretch a black hand at the player.
    spawnGrabHand();
    return;
  }
  const r = Math.random();
  if (r < 0.25) spawnReversePortal();
  else if (r < 0.5) spawnDropPortal();
  else if (r < 0.75) spawnDashOrb();
  else spawnSizePortal();
}

function spawnReversePortal(): void {
  attacks.push({
    kind: "portalreverse",
    rectX: WIDTH / 2,
    rectY: GROUND_Y - 130,
    rectW: 0, rectH: 0,
    horizontal: true, travelDir: 1,
    warnTime: 1.0,
    traverseTime: 0, traverseDuration: 0,
    trackTime: 0, lockTime: 0, fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickReversePortal(a: Attack, dt: number, idx: number): void {
  a.warnTime -= dt;
  if (a.warnTime <= 0) {
    player.x = WIDTH - player.x;
    attacks.splice(idx, 1);
  }
}

function drawReversePortal(a: Attack): void {
  const cx = WIDTH / 2;
  const cy = GROUND_Y - 130;
  const t = 1 - Math.max(0, a.warnTime / 1.0);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(elapsed * 6);
  ctx.fillStyle = `rgba(160, 80, 220, ${0.4 + t * 0.3})`;
  ctx.beginPath();
  ctx.arc(0, 0, 36 + t * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a020c0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#a020c0";
  ctx.font = "italic bold 18px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("REVERSE", cx, cy - 50);
}

function spawnDropPortal(): void {
  attacks.push({
    kind: "portaldrop",
    rectX: clampN(player.x, 80, WIDTH - 80),
    rectY: GROUND_Y - 30,
    rectW: 0, rectH: 0,
    horizontal: true, travelDir: 1,
    warnTime: 0.8,
    traverseTime: 0, traverseDuration: 0,
    trackTime: 0, lockTime: 0, fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickDropPortal(a: Attack, dt: number, idx: number): void {
  a.warnTime -= dt;
  if (a.warnTime <= 0) {
    if (Math.abs(player.x - a.rectX) < 60) {
      player.y = 60;
      player.vy = 0;
      player.onGround = false;
      playerLifted = true; // Triggers fall damage on landing.
    }
    attacks.splice(idx, 1);
  }
}

function drawDropPortal(a: Attack): void {
  const t = 1 - Math.max(0, a.warnTime / 0.8);
  ctx.save();
  ctx.translate(a.rectX, a.rectY);
  ctx.rotate(elapsed * 7);
  ctx.fillStyle = `rgba(80, 200, 240, ${0.4 + t * 0.3})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1f7eb0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = "#1f7eb0";
  ctx.font = "italic bold 16px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("UP↑", a.rectX, a.rectY - 26);
}

function spawnSizePortal(): void {
  const targetR = boss.radius < 25 ? 36 : 14;
  attacks.push({
    kind: "portalsize",
    rectX: boss.x,
    rectY: boss.y,
    rectW: targetR,
    rectH: 0,
    horizontal: true, travelDir: 1,
    warnTime: 0.5,
    traverseTime: 0, traverseDuration: 0,
    trackTime: 0, lockTime: 0, fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickSizePortal(a: Attack, dt: number, idx: number): void {
  a.warnTime -= dt;
  if (a.warnTime <= 0) {
    boss.radius = a.rectW;
    attacks.splice(idx, 1);
  }
}

function drawSizePortal(a: Attack): void {
  const t = 1 - Math.max(0, a.warnTime / 0.5);
  const targetR = a.rectW;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = targetR < 25 ? "rgba(255, 80, 200, 0.45)" : "rgba(80, 220, 200, 0.45)";
  ctx.beginPath();
  ctx.arc(0, 0, 50 + t * 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = targetR < 25 ? "#c020a0" : "#10a0a0";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function spawnDashOrb(): void {
  attacks.push({
    kind: "dashorb",
    rectX: rand(120, WIDTH - 120),
    rectY: rand(160, GROUND_Y - 100),
    rectW: 0, rectH: 0,
    horizontal: true, travelDir: 1,
    warnTime: 0,
    traverseTime: 0, traverseDuration: 6,
    trackTime: 0, lockTime: 0, fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickDashOrb(a: Attack, dt: number, idx: number): void {
  a.traverseTime += dt;
  const aabb = getPlayerAabb();
  const cx = aabb.x + aabb.w / 2;
  const cy = aabb.y + aabb.h / 2;
  const dx = a.rectX - cx;
  const dy = a.rectY - cy;
  if (dx * dx + dy * dy < 28 * 28) {
    player.vy = -1100;
    player.onGround = false;
    attacks.splice(idx, 1);
    return;
  }
  if (a.traverseTime >= a.traverseDuration) attacks.splice(idx, 1);
}

function drawDashOrb(a: Attack): void {
  ctx.save();
  ctx.fillStyle = `rgba(255, 220, 60, ${0.35 + 0.15 * Math.sin(elapsed * 8)})`;
  ctx.beginPath();
  ctx.arc(a.rectX, a.rectY, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c08a00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(a.rectX, a.rectY, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("↑", a.rectX, a.rectY);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function spawnSpikeShot(): void {
  // Auto-fired when player collects a spike pellet — flies at the boss.
  const dx = boss.x - player.x;
  const dy = boss.y - (player.y - 50);
  const len = Math.hypot(dx, dy) || 1;
  const speed = 720;
  attacks.push({
    kind: "spikeshot",
    rectX: player.x,
    rectY: player.y - 50,
    rectW: (dx / len) * speed,
    rectH: (dy / len) * speed,
    horizontal: true, travelDir: 1,
    warnTime: 0,
    traverseTime: 0, traverseDuration: 0,
    trackTime: 0, lockTime: 0, fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickSpikeShot(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.traverseTime += dt;
  // Don't deal damage while the cinematic is playing.
  if (boss.phase === "transitioning") {
    if (a.traverseTime > 4) attacks.splice(idx, 1);
    return;
  }
  const dx = boss.x - a.rectX;
  const dy = boss.y - a.rectY;
  if (!a.hasHit && dx * dx + dy * dy < boss.radius * boss.radius && boss.shieldTime <= 0) {
    boss.hp = Math.max(0, boss.hp - 8);
    a.hasHit = true;
    attacks.splice(idx, 1);
    if (boss.hp <= 0) {
      if (boss.phase === "alive") {
        transitionToGhostPhase();
      } else {
        gameState = "won";
      }
    }
    return;
  }
  if (a.rectX < -50 || a.rectX > WIDTH + 50 || a.rectY < -50 || a.rectY > HEIGHT + 50 || a.traverseTime > 4) {
    attacks.splice(idx, 1);
  }
}

function drawSpikeShot(a: Attack): void {
  const angle = Math.atan2(a.rectH, a.rectW);
  ctx.save();
  ctx.translate(a.rectX, a.rectY);
  ctx.rotate(angle);
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, 7);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, -7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function spawnGrabHand(): void {
  attacks.push({
    kind: "grabhand",
    // rectX/rectY hold the hand's CURRENT position (starts at the boss).
    rectX: boss.x,
    rectY: boss.y,
    // rectW/rectH hold the LOCKED target position once warn ends.
    rectW: 0, rectH: 0,
    horizontal: true, travelDir: 1,
    warnTime: 1.0, // longer telegraph so it's dodgeable
    traverseTime: 0, traverseDuration: 0.55, // extend duration
    trackTime: 0,
    lockTime: 2.0, // slow, dread-soaked reel toward the eye
    fireTime: 0,
    phase: "warn",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickGrabHand(a: Attack, dt: number, idx: number): void {
  if (a.phase === "warn") {
    a.warnTime -= dt;
    // The hand stays at the boss during warn — the target reticle is on the
    // player's CURRENT position so they know exactly what to dodge.
    a.rectX = boss.x;
    a.rectY = boss.y;
    if (a.warnTime <= 0) {
      // Lock the target at the player's position the moment warn ends.
      a.rectW = player.x;
      a.rectH = player.y - 30;
      a.phase = "active";
      a.traverseTime = 0;
    }
    return;
  }
  if (a.phase === "active") {
    // Hand extends from boss toward locked target.
    a.traverseTime += dt;
    const t = Math.min(1, a.traverseTime / a.traverseDuration);
    a.rectX = boss.x + (a.rectW - boss.x) * t;
    a.rectY = boss.y + (a.rectH - boss.y) * t;
    // Grab check: any time during the reach, if hand overlaps the player, grab them.
    const aabb = getPlayerAabb();
    const px = aabb.x + aabb.w / 2;
    const py = aabb.y + aabb.h / 2;
    const dx = a.rectX - px;
    const dy = a.rectY - py;
    if (!a.hasHit && dx * dx + dy * dy < 30 * 30) {
      a.hasHit = true;
      a.phase = "fall"; // reuse "fall" as the reel state
      a.traverseTime = 0;
      // Snap hand onto the player's center — they're caught.
      a.rectX = px;
      a.rectY = py;
      return;
    }
    if (a.traverseTime >= a.traverseDuration && !a.hasHit) {
      // Missed — retract.
      a.phase = "done";
      attacks.splice(idx, 1);
    }
    return;
  }
  if (a.phase === "fall") {
    // Reel: drag the player back into the boss's eye.
    a.traverseTime += dt;
    const t = Math.min(1, a.traverseTime / a.lockTime);
    const easeT = t * t; // accelerate
    const eyeX = boss.x;
    const eyeY = boss.y - boss.radius * 0.3; // roughly at the eyes
    const startX = a.rectW; // grab position
    const startY = a.rectH;
    a.rectX = startX + (eyeX - startX) * easeT;
    a.rectY = startY + (eyeY - startY) * easeT;
    // Override player physics to follow the hand.
    player.x = a.rectX;
    player.y = a.rectY + 30;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    if (t >= 1) {
      // Consumed: instead of insta-kill, drop the kid into a Geometry Dash
      // obby. Survive 5 seconds → escape; touch a spike → real game over.
      attacks.splice(idx, 1);
      startObby();
    }
  }
}

function drawGrabHand(a: Attack): void {
  ctx.save();
  if (a.phase === "warn") {
    // Telegraph: dotted line + pulsing reticle on the player's current spot.
    const tx = player.x;
    const ty = player.y - 30;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 16);
    ctx.strokeStyle = `rgba(180, 30, 30, ${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(tx, ty, 26 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(180, 30, 30, ${0.18 + pulse * 0.18})`;
    ctx.beginPath();
    ctx.arc(tx, ty, 18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Solid arm + hand.
    const angle = Math.atan2(a.rectY - boss.y, a.rectX - boss.x);
    ctx.strokeStyle = "#0a0a14";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(a.rectX, a.rectY);
    ctx.stroke();
    // Hand palm
    ctx.fillStyle = "#0a0a14";
    ctx.beginPath();
    ctx.arc(a.rectX, a.rectY, 18, 0, Math.PI * 2);
    ctx.fill();
    // Fingers spread perpendicular to the arm direction.
    ctx.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      const ang = angle + i * 0.32;
      ctx.beginPath();
      ctx.moveTo(a.rectX, a.rectY);
      ctx.lineTo(a.rectX + Math.cos(ang) * 30, a.rectY + Math.sin(ang) * 30);
      ctx.stroke();
    }
    if (a.phase === "fall") {
      // Reeling — draw a subtle tug effect ring around the hand.
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.rectX, a.rectY, 26 + Math.sin(elapsed * 20) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function spawnTornado(): void {
  const themed = customBossConfig.fireTornado
    ? "fire"
    : customBossConfig.lavaTornado
      ? "lava"
      : "wind";
  const startSide: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  attacks.push({
    kind: "tornado",
    rectX: startSide === 1 ? -60 : WIDTH + 60,
    rectY: GROUND_Y - 100,
    rectW: 220 * startSide, // velocity x sign-encoded; speed varies per phase
    rectH: 80, // tornado width radius marker
    horizontal: true,
    travelDir: startSide,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
    customThickness: themed === "fire" ? 1 : themed === "lava" ? 2 : 0,
    damageCooldown: 0,
  });
}

function tickTornado(a: Attack, dt: number, idx: number): void {
  a.rectX += Math.sign(a.rectW) * 220 * dt;
  a.traverseTime += dt;
  a.damageCooldown = (a.damageCooldown ?? 0) - dt;
  const r = a.rectH;
  const aabb = getPlayerAabb();
  const px = aabb.x + aabb.w / 2;
  const py = aabb.y + aabb.h / 2;
  const dx = px - a.rectX;
  const dy = py - (GROUND_Y - 100);
  if (dx * dx + dy * dy < r * r && (a.damageCooldown ?? 0) <= 0) {
    damagePlayer();
    a.damageCooldown = 0.55;
  }
  if ((a.travelDir > 0 && a.rectX > WIDTH + 100) || (a.travelDir < 0 && a.rectX < -100) || a.traverseTime > 12) {
    attacks.splice(idx, 1);
  }
}

function drawTornadoAttack(a: Attack): void {
  const cx = a.rectX;
  const cyTop = GROUND_Y - 200;
  const cyBot = GROUND_Y;
  const themed = a.customThickness ?? 0;
  const themeColor = themed === 1 ? "#ff8a2b" : themed === 2 ? "#ff5030" : "rgba(180, 200, 230, 0.85)";
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = themeColor;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const yy = cyTop + (cyBot - cyTop) * t;
      const radius = 20 + t * 60;
      const angle = elapsed * 8 + t * 6 + i * 1.2;
      const x = cx + Math.cos(angle) * radius;
      const y = yy;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Sparks/embers when themed.
  if (themed > 0) {
    ctx.fillStyle = themed === 1 ? "rgba(255, 220, 100, 0.85)" : "rgba(255, 180, 60, 0.85)";
    for (let i = 0; i < 6; i++) {
      const yy = cyTop + ((elapsed * 80 + i * 30) % 200);
      const angle = elapsed * 12 + i;
      const radius = 30 + Math.sin(angle) * 30;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * radius, yy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function spawnFireball(): void {
  const dx = player.x - boss.x;
  const dy = (player.y - 30) - boss.y;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 360;
  attacks.push({
    kind: "fireball",
    rectX: boss.x,
    rectY: boss.y,
    rectW: (dx / len) * speed,
    rectH: (dy / len) * speed - 80,
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickFireball(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.rectH += 360 * dt; // gravity
  a.traverseTime += dt;
  const aabb = getPlayerAabb();
  const cx = Math.max(aabb.x, Math.min(a.rectX, aabb.x + aabb.w));
  const cy = Math.max(aabb.y, Math.min(a.rectY, aabb.y + aabb.h));
  const ddx = a.rectX - cx;
  const ddy = a.rectY - cy;
  if (!a.hasHit && ddx * ddx + ddy * ddy < 18 * 18) {
    damagePlayer();
    a.hasHit = true;
    attacks.splice(idx, 1);
    return;
  }
  if (a.rectY > GROUND_Y + 30 || a.rectX < -60 || a.rectX > WIDTH + 60 || a.traverseTime > 6) {
    attacks.splice(idx, 1);
  }
}

function drawFireballAttack(a: Attack): void {
  ctx.save();
  // outer glow
  const g = ctx.createRadialGradient(a.rectX, a.rectY, 4, a.rectX, a.rectY, 22);
  g.addColorStop(0, "rgba(255, 240, 120, 0.95)");
  g.addColorStop(0.4, "rgba(255, 130, 40, 0.85)");
  g.addColorStop(1, "rgba(255, 60, 20, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(a.rectX, a.rectY, 22, 0, Math.PI * 2);
  ctx.fill();
  // core
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  ctx.arc(a.rectX, a.rectY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function spawnRedSlime(): void {
  // Beatrix fires a red slime at the player from her vacpack muzzle.
  const muzzleX = boss.x - 60;
  const muzzleY = boss.y - 10;
  const dx = player.x - muzzleX;
  const dy = (player.y - 50) - muzzleY;
  const len = Math.hypot(dx, dy) || 1;
  const speed = 540;
  attacks.push({
    kind: "redslime",
    rectX: muzzleX,
    rectY: muzzleY,
    rectW: (dx / len) * speed,
    rectH: (dy / len) * speed - 60, // slight arc
    horizontal: true,
    travelDir: 1,
    warnTime: 0,
    traverseTime: 0,
    traverseDuration: 0,
    trackTime: 0,
    lockTime: 0,
    fireTime: 0,
    phase: "active",
    id: nextAttackId++,
    hasHit: false,
  });
}

function tickRedSlime(a: Attack, dt: number, idx: number): void {
  a.rectX += a.rectW * dt;
  a.rectY += a.rectH * dt;
  a.rectH += 280 * dt; // light gravity for the arc
  // Bounce off the ground a couple of times before despawning.
  if (a.rectY > GROUND_Y - 20) {
    a.rectY = GROUND_Y - 20;
    a.rectH = -Math.abs(a.rectH) * 0.55;
    a.traverseTime += 1;
  }
  // Hit check: red slime "eats" the carrot — instant kill (drains all HP).
  const aabb = getPlayerAabb();
  const cx = Math.max(aabb.x, Math.min(a.rectX, aabb.x + aabb.w));
  const cy = Math.max(aabb.y, Math.min(a.rectY, aabb.y + aabb.h));
  const ddx = a.rectX - cx;
  const ddy = a.rectY - cy;
  if (!a.hasHit && ddx * ddx + ddy * ddy < 26 * 26 && player.invuln <= 0) {
    a.hasHit = true;
    player.hp = 0;
    gameState = bossMode ? "won" : "lost";
    attacks.splice(idx, 1);
    return;
  }
  if (a.rectX < -60 || a.rectX > WIDTH + 60 || a.traverseTime > 4) {
    attacks.splice(idx, 1);
  }
}

function advanceElementalPhase(playerWasHit: boolean): void {
  if (elementalPhase >= 4) {
    gameState = playerWasHit ? "lost" : "won";
    return;
  }
  elementalPhase += 1;
  boss.hpMax = ELEMENTAL_PHASE_HP[elementalPhase] ?? 70;
  boss.hp = boss.hpMax;
  boss.vulnerableTime = 0;
  boss.hitCooldown = 0;
  boss.shieldTime = 0;
  attacks.length = 0;
  // Brief screen shake for the phase swap.
  screenShake = 12;
}

function transitionToGhostPhase(): void {
  boss.phase = "transitioning";
  transitionTime = 0;
  boss.vulnerableTime = 0;
  boss.hitCooldown = 0;
  attacks.length = 0;
  if (!bossMode) {
    boss.x = boss.homeX;
    boss.y = boss.homeY;
  }
  boss.atHome = true;
  boss.visibility = 1;
  attackSpawnTimer = TRANSITION_DURATION + 0.6;
  screenShake = 14;
  if (currentBossId === "mrpencil") {
    boss.radius = 36; // shrink hitbox to match the smaller phase-2 visuals
  }
  if (currentBossId === "geom") {
    boss.radius = 36; // reset to default in case a size portal had shrunk him
  }
}

function tickTransition(dt: number): void {
  transitionTime += dt;
  // Screen shake decays over time but spikes again at key moments.
  const t = transitionTime / TRANSITION_DURATION;
  if (t < 0.18) screenShake = 14;
  else if (t < 0.5) screenShake = 8 + Math.sin(transitionTime * 60) * 4;
  else if (t < 0.7) screenShake = 18; // ink shockwave moment
  else screenShake = Math.max(0, screenShake - dt * 30);

  if (transitionTime >= TRANSITION_DURATION) {
    boss.phase = "ghost";
    boss.hp = GHOST_HP_MAX;
    boss.hpMax = GHOST_HP_MAX;
    screenShake = 0;
  }
}

function damagePlayer(): void {
  if (player.invuln > 0) return;
  player.hp -= 1;
  // No invuln for the AI kid in boss mode, and no invuln for the player during
  // Mr. Pencil's phase-2 fist barrage in story mode — chaos either way.
  const chaosMode = bossMode || (currentBossId === "mrpencil" && boss.phase === "ghost");
  player.invuln = chaosMode ? 0 : 1.2;
  player.vx = (player.x < boss.x ? -1 : 1) * 240;
  player.vy = -360;
  player.onGround = false;
  if (player.hp <= 0) {
    gameState = bossMode ? "won" : "lost";
  }
}

function updatePlatforms(dt: number): void {
  for (const p of platforms) {
    if (p.spawnDelay > 0) {
      p.spawnDelay -= dt;
      continue;
    }
    if (p.y < p.targetY) {
      p.y = Math.min(p.targetY, p.y + p.vy * dt);
    }
  }
}

function currentPelletKind(): "white" | "eraser" | Element | "tarr" | "spike" {
  if (currentBossId === "mrpencil") return "eraser";
  if (currentBossId === "elemental") {
    if (elementalPhase === 4) {
      return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)]!;
    }
    return ELEMENTS[elementalPhase]!;
  }
  if (currentBossId === "beatrix") return "tarr";
  if (currentBossId === "geom") return "spike";
  return "white";
}

function spawnPelletGround(): void {
  let attempt = 0;
  let x = 0;
  do {
    x = rand(120, WIDTH - 120);
    attempt++;
  } while (Math.abs(x - boss.x) < 90 && attempt < 6);
  pellets.push({
    x,
    y: GROUND_Y - 16,
    platformIndex: -1,
    bobPhase: Math.random() * Math.PI * 2,
    id: nextPelletId++,
    kind: currentPelletKind(),
  });
}

function spawnPellet(): void {
  if (
    currentBossId === "mrpencil" ||
    currentBossId === "elemental" ||
    currentBossId === "beatrix" ||
    currentBossId === "geom"
  ) {
    spawnPelletGround();
    return;
  }
  const settled = platforms
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.spawnDelay <= 0 && p.y >= p.targetY - 0.5);
  if (settled.length === 0) return;
  const occupied = new Set(pellets.map((p) => p.platformIndex));
  const free = settled.filter(({ i }) => !occupied.has(i));
  if (free.length === 0) return;
  const pick = free[Math.floor(Math.random() * free.length)]!;
  const platform = pick.p;
  pellets.push({
    x: platform.x + platform.w / 2 + rand(-platform.w / 4, platform.w / 4),
    y: platform.y - 14,
    platformIndex: pick.i,
    bobPhase: Math.random() * Math.PI * 2,
    id: nextPelletId++,
    kind: currentPelletKind(),
  });
}

function updatePellets(dt: number): void {
  pelletSpawnTimer -= dt;
  if (pelletSpawnTimer <= 0 && pellets.length < 2) {
    spawnPellet();
    pelletSpawnTimer = rand(3.5, 6);
  }
  const aabb = getPlayerAabb();
  for (let i = pellets.length - 1; i >= 0; i--) {
    const pel = pellets[i]!;
    pel.bobPhase += dt * 4;
    // Generous AABB-vs-circle pickup — easy to grab while running past or jumping near.
    const closestX = Math.max(aabb.x, Math.min(pel.x, aabb.x + aabb.w));
    const closestY = Math.max(aabb.y, Math.min(pel.y, aabb.y + aabb.h));
    const dx = pel.x - closestX;
    const dy = pel.y - closestY;
    if (dx * dx + dy * dy < 18 * 18) {
      const collectedKind = pel.kind;
      pellets.splice(i, 1);
      if (currentBossId === "elemental" && (collectedKind === "air" || collectedKind === "earth" || collectedKind === "fire" || collectedKind === "water")) {
        elementInventory[collectedKind] += 1;
      } else if (collectedKind === "spike") {
        // Auto-fire a spike at the boss the moment the player picks it up.
        spawnSpikeShot();
      } else {
        pelletInventory += 1;
      }
    }
  }
}

function updateBossDamageContact(): void {
  if (boss.phase === "transitioning") return;
  if (boss.shieldTime > 0) return;
  if (boss.vulnerableTime <= 0 || boss.hitCooldown > 0) return;
  const aabb = getPlayerAabb();
  const closestX = Math.max(aabb.x, Math.min(boss.x, aabb.x + aabb.w));
  const closestY = Math.max(aabb.y, Math.min(boss.y, aabb.y + aabb.h));
  const dx = boss.x - closestX;
  const dy = boss.y - closestY;
  if (dx * dx + dy * dy < boss.radius * boss.radius) {
    boss.hp = Math.max(0, boss.hp - HIT_DAMAGE);
    boss.hitCooldown = HIT_COOLDOWN;
    player.vy = -700;
    player.vx = (player.x < boss.x ? -1 : 1) * 260;
    player.onGround = false;
    if (boss.hp <= 0) {
      if (currentBossId === "elemental") {
        advanceElementalPhase(false);
      } else if (currentBossId === "beatrix") {
        gameState = "won";
      } else if (boss.phase === "alive") {
        transitionToGhostPhase();
      } else {
        gameState = "won";
      }
    }
  }
}

function getBossStartEnd(a: Attack): { sx: number; sy: number; ex: number; ey: number } {
  if (a.horizontal) {
    const cy = a.rectY + a.rectH / 2;
    if (a.travelDir === 1) {
      return { sx: -boss.radius - 10, sy: cy, ex: WIDTH + boss.radius + 10, ey: cy };
    }
    return { sx: WIDTH + boss.radius + 10, sy: cy, ex: -boss.radius - 10, ey: cy };
  }
  const cx = a.rectX + a.rectW / 2;
  if (a.travelDir === 1) {
    return { sx: cx, sy: -boss.radius - 10, ex: cx, ey: GROUND_Y + boss.radius + 10 };
  }
  return { sx: cx, sy: GROUND_Y + boss.radius + 10, ex: cx, ey: -boss.radius - 10 };
}

function updateAttacks(dt: number): void {
  if (!bossMode) {
    attackSpawnTimer -= dt;
    if (attackSpawnTimer <= 0) {
      // Mr. Pencil's phase 2 = 1 pointing fist per second.
      if (currentBossId === "mrpencil" && boss.phase === "ghost") {
        if (boss.shieldTime <= 0) spawnFistProjectile();
        attackSpawnTimer = 1.0;
      } else {
        spawnAttack();
        attackSpawnTimer = rand(1.6, 2.6);
      }
    }
  }
  for (let i = attacks.length - 1; i >= 0; i--) {
    // Defensive: an inner tick can call transitionToGhostPhase() which clears
    // the attacks array (e.g. spike-shot kill), so re-check bounds each step.
    if (i >= attacks.length) continue;
    const a = attacks[i];
    if (!a) continue;
    if (a.kind === "laser") {
      tickLaserAttack(a, dt, i);
      continue;
    }
    if (a.kind === "sword") {
      tickSword(a, dt, i);
      continue;
    }
    if (a.kind === "hammer") {
      tickHammer(a, dt, i);
      continue;
    }
    if (a.kind === "shield") {
      tickShield(a, dt, i);
      continue;
    }
    if (a.kind === "fist") {
      tickFist(a, dt, i);
      continue;
    }
    if (a.kind === "airlift") {
      tickAirLift(a, dt, i);
      continue;
    }
    if (a.kind === "earthrock") {
      tickEarthRock(a, dt, i);
      continue;
    }
    if (a.kind === "firepatch") {
      tickFirePatch(a, dt, i);
      continue;
    }
    if (a.kind === "flood") {
      tickFlood(a, dt, i);
      continue;
    }
    if (a.kind === "redslime") {
      tickRedSlime(a, dt, i);
      continue;
    }
    if (a.kind === "redlaser") {
      tickRedLaser(a, dt, i);
      continue;
    }
    if (a.kind === "tornado") {
      tickTornado(a, dt, i);
      continue;
    }
    if (a.kind === "fireball") {
      tickFireball(a, dt, i);
      continue;
    }
    if (a.kind === "portalreverse") {
      tickReversePortal(a, dt, i);
      continue;
    }
    if (a.kind === "portaldrop") {
      tickDropPortal(a, dt, i);
      continue;
    }
    if (a.kind === "portalsize") {
      tickSizePortal(a, dt, i);
      continue;
    }
    if (a.kind === "dashorb") {
      tickDashOrb(a, dt, i);
      continue;
    }
    if (a.kind === "spikeshot") {
      tickSpikeShot(a, dt, i);
      continue;
    }
    if (a.kind === "grabhand") {
      tickGrabHand(a, dt, i);
      continue;
    }
    if (a.phase === "warn") {
      a.warnTime -= dt;
      // Erase the boss at home as the warning charges.
      boss.atHome = true;
      boss.visibility = Math.max(0, a.warnTime / WARN_DURATION);
      if (a.warnTime <= 0) {
        a.phase = "travel";
        boss.atHome = false;
        boss.visibility = 0;
      }
    } else if (a.phase === "travel") {
      a.traverseTime += dt;
      const t = Math.min(1, a.traverseTime / a.traverseDuration);
      const { sx, sy, ex, ey } = getBossStartEnd(a);
      boss.x = sx + (ex - sx) * t;
      boss.y = sy + (ey - sy) * t;
      boss.facing = a.horizontal ? (a.travelDir === 1 ? 1 : -1) : -1;

      // Pac-Man only deals damage when he's NOT vulnerable.
      if (boss.vulnerableTime <= 0 && !a.hasHit) {
        const aabb = getPlayerAabb();
        const closestX = Math.max(aabb.x, Math.min(boss.x, aabb.x + aabb.w));
        const closestY = Math.max(aabb.y, Math.min(boss.y, aabb.y + aabb.h));
        const dx = boss.x - closestX;
        const dy = boss.y - closestY;
        if (dx * dx + dy * dy < boss.radius * boss.radius) {
          damagePlayer();
          a.hasHit = true;
        }
      }

      if (a.traverseTime >= a.traverseDuration) {
        a.phase = "done";
        attacks.splice(i, 1);
        // After his stroke he reappears ~100px to the right of home,
        // invisible, then slides back to his usual spot while sketching back in.
        boss.x = boss.homeX + 100;
        boss.y = boss.homeY;
        boss.atHome = true;
        boss.visibility = 0;
      }
    }
  }

  const traveling = attacks.some((a) => a.phase === "travel");
  const warning = attacks.some((a) => a.phase === "warn");
  if (!traveling && !warning) {
    // Idle at home; if we're invisible we're re-entering — slide visibly back in.
    boss.atHome = true;
    const slideRate = boss.visibility < 1 ? 1.8 : 4;
    boss.x += (boss.homeX - boss.x) * Math.min(1, dt * slideRate);
    boss.y += (boss.homeY + Math.sin(elapsed * 1.6) * 14 - boss.y) * Math.min(1, dt * slideRate);
    boss.facing = -1;
    boss.visibility = Math.min(1, boss.visibility + dt * REAPPEAR_RATE);
  }
}

function update(dt: number): void {
  if (gameState !== "playing") return;
  elapsed += dt;
  wobbleTick += dt;
  if (wobbleTick > 0.1) {
    wobbleTick = 0;
    wobbleSeed = Math.random() * 1000;
  }
  if (player.invuln > 0) player.invuln -= dt;

  const left = keys.has("ArrowLeft");
  const right = keys.has("ArrowRight");
  const up = keys.has("ArrowUp");
  const down = keys.has("ArrowDown");

  player.ducking = down && player.onGround;

  if (player.ducking) {
    player.vx = 0;
  } else if (left && !right) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  } else if (right && !left) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  } else {
    // allow knockback to decay
    player.vx *= 0.85;
    if (Math.abs(player.vx) < 4) player.vx = 0;
  }

  if (up && player.onGround && !player.ducking) {
    player.vy = -JUMP_VELOCITY;
    player.onGround = false;
  }

  const prevBottom = player.y;
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const halfWidth = BODY_WIDTH / 2;
  if (player.x < halfWidth) {
    player.x = halfWidth;
    player.vx = 0;
  }
  if (player.x > WIDTH - halfWidth) {
    player.x = WIDTH - halfWidth;
    player.vx = 0;
  }

  player.onGround = false;

  // Platform one-way collision (only when falling and previous feet were above platform top)
  if (player.vy >= 0) {
    for (const p of platforms) {
      if (
        player.x + halfWidth > p.x &&
        player.x - halfWidth < p.x + p.w &&
        prevBottom <= p.y + 1 &&
        player.y >= p.y &&
        player.y <= p.y + p.h + 6
      ) {
        player.y = p.y;
        player.vy = 0;
        player.onGround = true;
        break;
      }
    }
  }

  // Ground
  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  }

  // If the air-lift attack carried us up high, the landing hurts.
  if (player.onGround && playerLifted) {
    playerLifted = false;
    damagePlayer();
  }

  if (Math.abs(player.vx) > 1 && player.onGround) {
    player.runPhase += dt * 12;
  } else {
    player.runPhase *= 0.85;
  }

  boss.mouthPhase += dt * 10;
  if (boss.vulnerableTime > 0) boss.vulnerableTime -= dt;
  if (boss.hitCooldown > 0) boss.hitCooldown -= dt;
  if (boss.shieldTime > 0) boss.shieldTime -= dt;

  updatePlatforms(dt);
  updatePellets(dt);
  if (boss.phase === "transitioning") {
    tickTransition(dt);
  } else {
    updateAttacks(dt);
  }
  updateBossDamageContact();
}

// ---------------- Rendering ----------------

function crayonLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  id: number
): void {
  const mx = (x1 + x2) / 2 + jitter(id, 4);
  const my = (y1 + y2) / 2 + jitter(id + 1, 4);
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = width + (pass === 1 ? 0.5 : 0);
    ctx.globalAlpha = pass === 0 ? 1 : 0.4;
    ctx.beginPath();
    ctx.moveTo(x1 + jitter(id + pass * 7, 1.2), y1 + jitter(id + pass * 7 + 3, 1.2));
    ctx.quadraticCurveTo(
      mx + jitter(id + pass * 11, 1.5),
      my + jitter(id + pass * 11 + 5, 1.5),
      x2 + jitter(id + pass * 13, 1.2),
      y2 + jitter(id + pass * 13 + 9, 1.2)
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function crayonCircle(cx: number, cy: number, r: number, color: string, width: number, id: number): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = width + (pass === 1 ? 0.5 : 0);
    ctx.globalAlpha = pass === 0 ? 1 : 0.45;
    ctx.beginPath();
    const segments = 18;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const wobble = jitter(id + i + pass * 41, r * 0.06);
      const px = cx + Math.cos(a) * (r + wobble);
      const py = cy + Math.sin(a) * (r + wobble);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function crayonFillCircle(cx: number, cy: number, r: number, color: string, id: number): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const wobble = jitter(id + i + 99, r * 0.08);
    const px = cx + Math.cos(a) * (r + wobble);
    const py = cy + Math.sin(a) * (r + wobble);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function scribbleFill(x: number, y: number, w: number, h: number, color: string, id: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  const lines = Math.floor(h / 6);
  let goingRight = true;
  for (let i = 0; i <= lines; i++) {
    const ly = y + i * 6 + jitter(id + i, 1);
    const lx1 = goingRight ? x + jitter(id + i + 30, 2) : x + w + jitter(id + i + 30, 2);
    const lx2 = goingRight ? x + w + jitter(id + i + 31, 2) : x + jitter(id + i + 31, 2);
    if (i === 0) ctx.moveTo(lx1, ly);
    ctx.lineTo(lx2, ly);
    goingRight = !goingRight;
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBackground(): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 80, 80, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(78, HEIGHT);
  ctx.stroke();

  // Sun
  crayonFillCircle(120, 80, 28, "#ffd23a", 7001);
  crayonCircle(120, 80, 28, "#e8a200", 3, 7002);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    crayonLine(
      120 + Math.cos(a) * 34,
      80 + Math.sin(a) * 34,
      120 + Math.cos(a) * 50,
      80 + Math.sin(a) * 50,
      "#e8a200",
      2.5,
      7100 + i
    );
  }

  // Grass strip
  scribbleFill(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y, "#5fb04a", 9000);
  crayonLine(0, GROUND_Y, WIDTH, GROUND_Y, "#2f6a26", 4, 9100);
  for (let i = 0; i < 14; i++) {
    const gx = 30 + i * 70 + jitter(9200 + i, 8);
    crayonLine(gx, GROUND_Y + 6, gx - 5, GROUND_Y - 10, "#2f6a26", 2.5, 9300 + i * 3);
    crayonLine(gx, GROUND_Y + 6, gx, GROUND_Y - 14, "#2f6a26", 2.5, 9301 + i * 3);
    crayonLine(gx, GROUND_Y + 6, gx + 5, GROUND_Y - 10, "#2f6a26", 2.5, 9302 + i * 3);
  }

  // Title
  ctx.save();
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 22px 'Comic Sans MS', 'Marker Felt', cursive";
  ctx.textAlign = "left";
  ctx.translate(96, 44);
  ctx.rotate(-0.04);
  const bossLabel = (BOSS_ROSTER.find((b) => b.id === currentBossId)?.name ?? "PAC MAN").toUpperCase();
  const levelNum = currentBossId === "mrpencil" ? 2 : 1;
  ctx.fillText(`BOSS ${levelNum}: ${bossLabel} !!!`, 0, 0);
  ctx.restore();
}

function drawPlatforms(): void {
  for (const p of platforms) {
    if (p.spawnDelay > 0) continue;
    scribbleFill(p.x, p.y, p.w, p.h, "#9b5a2c", 5000 + p.id);
    crayonLine(p.x, p.y, p.x + p.w, p.y, "#3a2618", 3, 5100 + p.id);
    crayonLine(p.x, p.y + p.h, p.x + p.w, p.y + p.h, "#3a2618", 3, 5200 + p.id);
    crayonLine(p.x, p.y, p.x, p.y + p.h, "#3a2618", 3, 5300 + p.id);
    crayonLine(p.x + p.w, p.y, p.x + p.w, p.y + p.h, "#3a2618", 3, 5400 + p.id);
  }
}


function lensPathLocal(len: number, half: number): void {
  // Beam-local lens path: tapered at (0,0) and (len,0), bulged on top and bottom.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -half * 1.05, len, 0);
  ctx.quadraticCurveTo(len * 0.5, half * 1.05, 0, 0);
  ctx.closePath();
}

function drawBeam(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  thickness: number,
  fillStyle: string | null,
  hatchStyle: string | null,
  outlineStyle: string,
  outlineWidth: number
): void {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  // Beam-local coords: x in [0, len], y in [-thickness/2, thickness/2].
  const half = thickness / 2;

  lensPathLocal(len, half);

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (hatchStyle) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = hatchStyle;
    ctx.lineWidth = 1.6;
    const spacing = 8;
    for (let off = -half * 1.5; off < len + half * 1.5; off += spacing) {
      ctx.beginPath();
      ctx.moveTo(off, -half * 1.4);
      ctx.lineTo(off + half * 1.6, half * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (outlineWidth > 0) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = outlineStyle;
      ctx.lineWidth = outlineWidth + (pass === 1 ? 0.5 : 0);
      ctx.globalAlpha = pass === 0 ? 1 : 0.45;
      lensPathLocal(len, half);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawReticle(tx: number, ty: number, r: number, color: string): void {
  // Crosshair / eye target at the beam end.
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(tx, ty, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx, ty, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx - r * 1.4, ty);
  ctx.lineTo(tx - r * 0.6, ty);
  ctx.moveTo(tx + r * 0.6, ty);
  ctx.lineTo(tx + r * 1.4, ty);
  ctx.moveTo(tx, ty - r * 1.4);
  ctx.lineTo(tx, ty - r * 0.6);
  ctx.moveTo(tx, ty + r * 0.6);
  ctx.lineTo(tx, ty + r * 1.4);
  ctx.stroke();
}

function drawLaserAttack(a: Attack): void {
  const ax = boss.x;
  const ay = boss.y;
  const bx = a.rectX;
  const by = a.rectY;
  const thick = a.customThickness ?? LASER_BEAM_THICKNESS;
  if (a.phase === "track") {
    const flicker = 0.4 + 0.3 * Math.sin(elapsed * 12);
    drawBeam(
      ax, ay, bx, by,
      thick * 0.55,
      `rgba(255, 255, 255, 0.4)`,
      `rgba(60, 60, 80, ${0.45 + 0.2 * Math.sin(elapsed * 9)})`,
      `rgba(40, 40, 60, ${flicker})`,
      2.5
    );
    drawReticle(bx, by, 16, "rgba(40, 40, 60, 0.85)");
  } else if (a.phase === "locked") {
    const wobble = Math.sin(elapsed * 30) * 0.5 + 0.5;
    drawBeam(
      ax, ay, bx, by,
      thick * 0.7,
      `rgba(255, 255, 255, 0.7)`,
      `rgba(40, 40, 55, 0.85)`,
      "#222",
      3.5
    );
    // Pulsing reticle on the locked target.
    const pulseR = 18 + wobble * 6;
    drawReticle(bx, by, pulseR, "#222");
    // Charging crackles inside the beam.
    ctx.save();
    const dx = bx - ax;
    const dy = by - ay;
    const angle = Math.atan2(dy, dx);
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    const len = Math.hypot(dx, dy);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + wobble * 0.4})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, jitter(16100 + i, 8));
      for (let x = 30; x < len; x += 36) {
        ctx.lineTo(x, jitter(16100 + i + x, 10));
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (a.phase === "fire") {
    drawBeam(ax, ay, bx, by, thick * 1.1, "#ffffff", null, "transparent", 0);
    drawBeam(ax, ay, bx, by, thick * 0.55, "rgba(160, 60, 220, 0.9)", null, "transparent", 0);
    drawBeam(ax, ay, bx, by, thick * 0.22, "rgba(255, 255, 255, 0.98)", null, "transparent", 0);
    drawBeam(ax, ay, bx, by, thick * 1.1, null, null, "#222", 4);
  }
}

function drawSwordAttack(a: Attack): void {
  if (a.phase === "warn") {
    // Pencil "draws" the sword: a faint pencil-line outline appears next to the boss.
    const reveal = 1 - Math.max(0, a.warnTime / 0.7);
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(a.travelDir > 0 ? -0.5 : Math.PI + 0.5);
    ctx.strokeStyle = `rgba(40, 40, 40, ${0.3 + reveal * 0.5})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    const len = a.rectW * reveal;
    ctx.strokeRect(40, -a.rectH / 2, len, a.rectH);
    ctx.setLineDash([]);
    // Hilt circle
    ctx.fillStyle = `rgba(120, 60, 30, ${reveal})`;
    ctx.beginPath();
    ctx.arc(40, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (a.phase === "swing") {
    const t = Math.min(1, a.traverseTime / a.traverseDuration);
    const ang = (-1.0 + 2.0 * t) * a.travelDir;
    const tipX = boss.x + Math.sin(ang) * a.rectW * a.travelDir;
    const tipY = boss.y + Math.cos(ang) * a.rectW;
    // Solid sword shape — sketchy.
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(190, 190, 200, 0.95)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Hilt
    ctx.fillStyle = "#7a3a18";
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Trail arc behind the swing.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    const trailSegs = 6;
    for (let i = 0; i <= trailSegs; i++) {
      const tt = Math.max(0, t - 0.18 + (i / trailSegs) * 0.18);
      const ang2 = (-1.0 + 2.0 * tt) * a.travelDir;
      const tx = boss.x + Math.sin(ang2) * a.rectW * a.travelDir;
      const ty = boss.y + Math.cos(ang2) * a.rectW;
      if (i === 0) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawHammerAttack(a: Attack): void {
  if (a.phase === "warn") {
    const reveal = 1 - Math.max(0, a.warnTime / 0.7);
    // Pencil-drawn hammer hovering above the drop point.
    ctx.save();
    ctx.globalAlpha = 0.35 + reveal * 0.55;
    drawHammerShape(a.rectX, a.rectY, a.rectW, a.rectH, true);
    ctx.restore();
    // Warning indicator on the ground.
    const pulse = 0.25 + 0.25 * Math.sin(elapsed * 14);
    ctx.fillStyle = `rgba(220, 80, 80, ${pulse})`;
    ctx.fillRect(a.rectX - 60, GROUND_Y - 6, 120, 6);
  } else if (a.phase === "fall") {
    drawHammerShape(a.rectX, a.rectY, a.rectW, a.rectH, false);
  } else if (a.phase === "shockwave") {
    drawHammerShape(a.rectX, a.rectY, a.rectW, a.rectH, false);
    const reach = a.traverseTime * 720;
    const fade = 1 - a.traverseTime / a.traverseDuration;
    // Two shockwave bands on the ground, traveling outward.
    ctx.fillStyle = `rgba(220, 130, 60, ${0.6 * fade})`;
    ctx.fillRect(a.rectX - reach - 50, GROUND_Y - 24, 50, 24);
    ctx.fillRect(a.rectX + reach, GROUND_Y - 24, 50, 24);
    ctx.strokeStyle = `rgba(60, 30, 10, ${0.85 * fade})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(a.rectX - reach - 50, GROUND_Y - 24, 50, 24);
    ctx.strokeRect(a.rectX + reach, GROUND_Y - 24, 50, 24);
    // Cracks fanning out.
    ctx.strokeStyle = `rgba(60, 30, 10, ${0.7 * fade})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(a.rectX - reach * (i + 1) * 0.3, GROUND_Y);
      ctx.lineTo(a.rectX - reach * (i + 1) * 0.3 + jitter(31000 + i, 8), GROUND_Y - 14 - jitter(31100 + i, 6));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.rectX + reach * (i + 1) * 0.3, GROUND_Y);
      ctx.lineTo(a.rectX + reach * (i + 1) * 0.3 + jitter(31200 + i, 8), GROUND_Y - 14 - jitter(31300 + i, 6));
      ctx.stroke();
    }
  }
}

function drawHammerShape(cx: number, cy: number, headW: number, headH: number, sketchy: boolean): void {
  // Hammer head (gray), handle below extending downward toward ground.
  ctx.save();
  if (sketchy) {
    ctx.strokeStyle = "rgba(40, 40, 40, 0.85)";
    ctx.fillStyle = "rgba(180, 180, 190, 0.6)";
    ctx.setLineDash([6, 5]);
  } else {
    ctx.strokeStyle = "#222";
    ctx.fillStyle = "#aab0bc";
  }
  ctx.lineWidth = 3;
  // Head
  ctx.fillRect(cx - headW / 2, cy - headH / 2, headW, headH);
  ctx.strokeRect(cx - headW / 2, cy - headH / 2, headW, headH);
  // Handle
  const handleW = 14;
  ctx.fillStyle = sketchy ? "rgba(120, 70, 30, 0.6)" : "#7a3a18";
  ctx.fillRect(cx - handleW / 2, cy + headH / 2, handleW, 80);
  ctx.strokeRect(cx - handleW / 2, cy + headH / 2, handleW, 80);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawAirLiftAttack(a: Attack): void {
  if (a.phase === "warn") {
    const t = 1 - Math.max(0, a.warnTime / 0.9);
    ctx.save();
    ctx.fillStyle = `rgba(180, 200, 230, ${0.25 + t * 0.35})`;
    ctx.fillRect(a.rectX - a.rectW / 2, GROUND_Y - 6, a.rectW, 6);
    // Swirling air lines rising from the patch.
    ctx.strokeStyle = `rgba(120, 150, 200, ${0.5 + t * 0.4})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const x = a.rectX - a.rectW / 2 + (i + 0.5) * (a.rectW / 5);
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      const peakY = GROUND_Y - 60 - i * 6;
      ctx.quadraticCurveTo(x + Math.sin(elapsed * 6 + i) * 12, (GROUND_Y + peakY) / 2, x, peakY);
      ctx.stroke();
    }
    ctx.restore();
  } else if (a.phase === "active") {
    // Brief upward burst.
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const x = a.rectX - a.rectW / 2 + (i + 0.5) * (a.rectW / 4);
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x + jitter(34000 + i, 6), GROUND_Y - 220);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawEarthRockAttack(a: Attack): void {
  ctx.save();
  ctx.translate(a.rectX, a.rectY);
  ctx.rotate(elapsed * 6);
  ctx.fillStyle = "#8a6a3a";
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.lineTo(-6, -14);
  ctx.lineTo(8, -10);
  ctx.lineTo(14, 2);
  ctx.lineTo(6, 14);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4a3414";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#5a8a2c";
  ctx.beginPath();
  ctx.arc(2, -4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFirePatchAttack(a: Attack): void {
  if (a.phase === "warn") {
    const t = 1 - Math.max(0, a.warnTime / 0.55);
    ctx.fillStyle = `rgba(255, 100, 40, ${0.25 + t * 0.35})`;
    ctx.fillRect(a.rectX - a.rectW / 2, GROUND_Y - 4, a.rectW, 4);
  } else if (a.phase === "active") {
    const fade = a.traverseTime > a.traverseDuration - 0.6
      ? Math.max(0, (a.traverseDuration - a.traverseTime) / 0.6)
      : 1;
    // Flame body — multiple flickering arches.
    ctx.save();
    const x0 = a.rectX - a.rectW / 2;
    ctx.fillStyle = `rgba(255, 138, 43, ${0.85 * fade})`;
    for (let i = 0; i < 5; i++) {
      const fx = x0 + (i + 0.5) * (a.rectW / 5);
      const flick = Math.sin(elapsed * 14 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(fx - 8, GROUND_Y);
      ctx.quadraticCurveTo(fx, GROUND_Y - 26 - flick, fx + 8, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255, 225, 74, ${0.7 * fade})`;
    for (let i = 0; i < 5; i++) {
      const fx = x0 + (i + 0.5) * (a.rectW / 5);
      const flick = Math.sin(elapsed * 18 + i * 2) * 3;
      ctx.beginPath();
      ctx.moveTo(fx - 4, GROUND_Y);
      ctx.quadraticCurveTo(fx, GROUND_Y - 14 - flick, fx + 4, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = `rgba(122, 26, 5, ${0.6 * fade})`;
    ctx.fillRect(x0, GROUND_Y - 4, a.rectW, 4);
    ctx.restore();
  }
}

function drawRedSlimeAttack(a: Attack): void {
  const w = 38;
  const h = 38;
  if (redSlimeImgReady) {
    ctx.save();
    ctx.translate(a.rectX, a.rectY);
    const wobble = Math.sin(elapsed * 16) * 0.06;
    ctx.scale(1 + wobble, 1 - wobble);
    ctx.drawImage(redSlimeImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.arc(a.rectX, a.rectY, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a0a0a";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawFloodAttack(a: Attack): void {
  const lava = a.lavaMode === true;
  const surfaceFill = lava ? "rgba(255, 80, 30, 0.7)" : "rgba(58, 160, 240, 0.55)";
  const surfaceStroke = lava ? "rgba(160, 30, 0, 0.9)" : "rgba(20, 60, 130, 0.8)";
  const warnLabel = lava ? "LAVA INCOMING" : "FLOOD INCOMING";
  const warnFill = lava ? "rgba(255, 80, 30, 0.45)" : "rgba(58, 160, 240, 0.3)";
  const labelColor = lava ? "#7a1a05" : "#1f4ea8";
  if (a.phase === "warn") {
    ctx.fillStyle = warnFill;
    ctx.fillRect(0, GROUND_Y - 4, WIDTH, 4);
    ctx.fillStyle = labelColor;
    ctx.font = "italic bold 22px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(warnLabel, WIDTH / 2, GROUND_Y - 30);
  } else if (a.phase === "active") {
    const surface = GROUND_Y - a.rectH;
    ctx.fillStyle = surfaceFill;
    ctx.fillRect(0, surface, WIDTH, a.rectH);
    ctx.strokeStyle = surfaceStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, surface);
    for (let x = 0; x <= WIDTH; x += 14) {
      const wy = surface + Math.sin(x * 0.05 + elapsed * 4) * 4;
      ctx.lineTo(x, wy);
    }
    ctx.stroke();
    if (lava) {
      // Bubbling embers floating up.
      ctx.fillStyle = "rgba(255, 200, 60, 0.85)";
      for (let i = 0; i < 8; i++) {
        const bx = (i * 137 + elapsed * 60) % WIDTH;
        const by = surface + 6 + Math.sin(elapsed * 3 + i) * 6;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Custom-boss emoji decorations on the flood surface.
    if (currentBossId === "custom" && customBossConfig.emojis.length > 0) {
      ctx.font = "20px 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
      ctx.textAlign = "center";
      const emojis = customBossConfig.emojis;
      for (let i = 0; i < 14; i++) {
        const e = emojis[i % emojis.length]!;
        const bx = (i * 73 + elapsed * 40) % WIDTH;
        const by = surface + 12 + Math.sin(elapsed * 2 + i) * 6;
        ctx.fillText(e, bx, by);
      }
    }
    if (!lava && playerSubmergedTime > 0) {
      ctx.fillStyle = "#fff";
      ctx.font = "italic bold 16px 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      const breath = Math.max(0, 5 - playerSubmergedTime);
      ctx.fillText(`BREATH: ${breath.toFixed(1)}s`, WIDTH / 2, 90);
    }
  }
}

function drawFistAttack(a: Attack): void {
  const angle = Math.atan2(a.rectH, a.rectW);
  if (pointingHandImgReady) {
    const w = 60;
    const aspect = pointingHandImg.naturalHeight / pointingHandImg.naturalWidth || 0.66;
    const h = w * aspect;
    ctx.save();
    ctx.translate(a.rectX, a.rectY);
    ctx.rotate(angle);
    ctx.drawImage(pointingHandImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(a.rectX, a.rectY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(a.rectX - 2, a.rectY - 2, 4, 4);
    ctx.restore();
  }
}

function drawShieldAttack(a: Attack): void {
  const r = boss.radius * 1.7;
  if (a.phase === "warn") {
    const reveal = a.rectH; // 0..1
    ctx.save();
    ctx.strokeStyle = `rgba(60, 130, 220, ${reveal})`;
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r * reveal, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (a.phase === "active") {
    const remaining = Math.max(0, a.traverseDuration - a.traverseTime);
    const flashing = remaining < 0.8 && Math.floor(remaining * 12) % 2 === 0;
    ctx.save();
    ctx.fillStyle = flashing ? "rgba(255, 255, 255, 0.18)" : "rgba(60, 130, 220, 0.16)";
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = flashing ? "#ffffff" : "#3aa0f0";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Sparkles
    const sparkles = 14;
    ctx.fillStyle = "rgba(180, 220, 255, 0.85)";
    for (let i = 0; i < sparkles; i++) {
      const ang = (i / sparkles) * Math.PI * 2 + elapsed * 0.6;
      const sx = boss.x + Math.cos(ang) * r;
      const sy = boss.y + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPellets(): void {
  for (const pel of pellets) {
    const bob = Math.sin(pel.bobPhase) * 2;
    if (pel.kind === "eraser") {
      drawEraserPickup(pel.x, pel.y + bob, pel.id);
    } else if (pel.kind === "air" || pel.kind === "earth" || pel.kind === "fire" || pel.kind === "water") {
      drawElementBit(pel.x, pel.y + bob, pel.kind, pel.id);
    } else if (pel.kind === "tarr") {
      drawTarrPickup(pel.x, pel.y + bob);
    } else if (pel.kind === "spike") {
      drawSpikePickup(pel.x, pel.y + bob);
    } else {
      const r = 7;
      crayonFillCircle(pel.x, pel.y + bob, r, "#ffffff", 13000 + pel.id);
      crayonCircle(pel.x, pel.y + bob, r, "#222", 2, 13100 + pel.id);
      ctx.fillStyle = `rgba(255,255,180,${0.5 + 0.5 * Math.sin(pel.bobPhase * 1.5)})`;
      ctx.beginPath();
      ctx.arc(pel.x - 2, pel.y + bob - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSpikePickup(cx: number, cy: number): void {
  ctx.save();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx - 9, cy + 6);
  ctx.lineTo(cx + 9, cy + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTarrPickup(cx: number, cy: number): void {
  const size = 28;
  if (tarrImgReady) {
    ctx.drawImage(tarrImg, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = "#1a1a2a";
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawElementBit(cx: number, cy: number, kind: Element, id: number): void {
  ctx.save();
  if (kind === "air") {
    // Light cloud — three white circles.
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#7da6c8";
    ctx.lineWidth = 2;
    for (const [ox, oy, r] of [[-5, 1, 6], [5, 1, 6], [0, -3, 7]] as const) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (kind === "earth") {
    // Green/brown world — circle with continent dots.
    ctx.fillStyle = "#8ac24f";
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a8a2c";
    for (const [ox, oy, r] of [[-2, -3, 2], [3, 2, 2.5], [0, 4, 1.5]] as const) {
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#2c5a14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
    void id;
  } else if (kind === "fire") {
    // Flame — orange triangle with red core.
    ctx.fillStyle = "#ff8a2b";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.quadraticCurveTo(cx + 7, cy + 2, cx + 4, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 4, cx - 4, cy + 8);
    ctx.quadraticCurveTo(cx - 7, cy + 2, cx, cy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe14a";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4);
    ctx.quadraticCurveTo(cx + 3, cy + 2, cx, cy + 6);
    ctx.quadraticCurveTo(cx - 3, cy + 2, cx, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7a1a05";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.quadraticCurveTo(cx + 7, cy + 2, cx + 4, cy + 8);
    ctx.quadraticCurveTo(cx, cy + 4, cx - 4, cy + 8);
    ctx.quadraticCurveTo(cx - 7, cy + 2, cx, cy - 9);
    ctx.stroke();
  } else if (kind === "water") {
    // Teardrop — blue.
    ctx.fillStyle = "#3aa0f0";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 9);
    ctx.bezierCurveTo(cx + 7, cy - 1, cx + 7, cy + 7, cx, cy + 8);
    ctx.bezierCurveTo(cx - 7, cy + 7, cx - 7, cy - 1, cx, cy - 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1a4a80";
    ctx.lineWidth = 2;
    ctx.stroke();
    // shine
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEraserPickup(cx: number, cy: number, id: number): void {
  // Small pink eraser block, slightly tilted, crayon-outlined.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18 + jitter(13500 + id, 0.05));
  const w = 22;
  const h = 14;
  // Body
  ctx.fillStyle = "#ff7aa6";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Darker pink on the bottom face for depth.
  ctx.fillStyle = "#e0588f";
  ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
  // Rough crayon outline
  ctx.strokeStyle = "#7a1638";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + jitter(13600 + id, 0.7), -h / 2);
  ctx.lineTo(w / 2 + jitter(13601 + id, 0.7), -h / 2 + jitter(13602 + id, 0.7));
  ctx.lineTo(w / 2, h / 2 + jitter(13603 + id, 0.7));
  ctx.lineTo(-w / 2 + jitter(13604 + id, 0.7), h / 2);
  ctx.closePath();
  ctx.stroke();
  // Brand band
  ctx.strokeStyle = "rgba(120, 22, 56, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, -1);
  ctx.lineTo(w / 2 - 2, -1);
  ctx.stroke();
  ctx.restore();
}

function drawAttacks(): void {
  for (const a of attacks) {
    if (a.kind === "laser") {
      drawLaserAttack(a);
      continue;
    }
    if (a.kind === "sword") {
      drawSwordAttack(a);
      continue;
    }
    if (a.kind === "hammer") {
      drawHammerAttack(a);
      continue;
    }
    if (a.kind === "shield") {
      drawShieldAttack(a);
      continue;
    }
    if (a.kind === "fist") {
      drawFistAttack(a);
      continue;
    }
    if (a.kind === "airlift") {
      drawAirLiftAttack(a);
      continue;
    }
    if (a.kind === "earthrock") {
      drawEarthRockAttack(a);
      continue;
    }
    if (a.kind === "firepatch") {
      drawFirePatchAttack(a);
      continue;
    }
    if (a.kind === "flood") {
      drawFloodAttack(a);
      continue;
    }
    if (a.kind === "redslime") {
      drawRedSlimeAttack(a);
      continue;
    }
    if (a.kind === "redlaser") {
      drawRedLaserAttack(a);
      continue;
    }
    if (a.kind === "tornado") {
      drawTornadoAttack(a);
      continue;
    }
    if (a.kind === "fireball") {
      drawFireballAttack(a);
      continue;
    }
    if (a.kind === "portalreverse") {
      drawReversePortal(a);
      continue;
    }
    if (a.kind === "portaldrop") {
      drawDropPortal(a);
      continue;
    }
    if (a.kind === "portalsize") {
      drawSizePortal(a);
      continue;
    }
    if (a.kind === "dashorb") {
      drawDashOrb(a);
      continue;
    }
    if (a.kind === "spikeshot") {
      drawSpikeShot(a);
      continue;
    }
    if (a.kind === "grabhand") {
      drawGrabHand(a);
      continue;
    }
    if (a.phase === "warn") {
      const intensity = 1 - a.warnTime / 1.1;
      const pulse = 0.18 + 0.22 * Math.sin(elapsed * 14) + intensity * 0.2;
      ctx.fillStyle = `rgba(226, 58, 58, ${Math.min(0.55, pulse)})`;
      ctx.fillRect(a.rectX, a.rectY, a.rectW, a.rectH);
      ctx.strokeStyle = "rgba(180, 30, 30, 0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 7]);
      ctx.strokeRect(a.rectX, a.rectY, a.rectW, a.rectH);
      ctx.setLineDash([]);
      // Arrow showing direction of travel
      const cx = a.rectX + a.rectW / 2;
      const cy = a.rectY + a.rectH / 2;
      ctx.fillStyle = "rgba(180, 30, 30, 0.9)";
      ctx.font = "italic bold 32px 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const arrow = a.horizontal ? (a.travelDir === 1 ? "→ → →" : "← ← ←") : (a.travelDir === 1 ? "↓\n↓\n↓" : "↑\n↑\n↑");
      if (a.horizontal) {
        ctx.fillText(arrow, cx, cy);
      } else {
        const lines = arrow.split("\n");
        lines.forEach((line, i) => ctx.fillText(line, cx, a.rectY + 40 + i * (a.rectH - 80) / 2));
      }
      ctx.textBaseline = "alphabetic";
    }
  }
}

function getMouthRotation(): number {
  const traveling = attacks.find((a) => a.phase === "travel");
  if (!traveling) return Math.PI; // mouth left at home
  if (traveling.horizontal) {
    return traveling.travelDir === 1 ? 0 : Math.PI;
  }
  return traveling.travelDir === 1 ? Math.PI / 2 : -Math.PI / 2;
}

function drawActiveBoss(): void {
  if (currentBossId === "mrpencil") {
    drawMrPencil();
  } else if (currentBossId === "elemental") {
    drawElemental();
  } else if (currentBossId === "beatrix") {
    drawBeatrix();
  } else if (currentBossId === "geom") {
    drawGeom();
  } else if (currentBossId === "custom") {
    drawCustomBoss();
  } else {
    drawPacman();
  }
}

function drawGeomCubeAt(cx: number, cy: number, r: number, isPhase2: boolean): void {
  ctx.save();
  // Body fill — vivid blue with a darker base for that GD cube look.
  const bodyColor = isPhase2 ? "#0a0a14" : "#3a78ff";
  const accentLight = isPhase2 ? "#1a1a26" : "#6aa0ff";
  const accentDark = isPhase2 ? "#04040a" : "#1f4ec0";
  ctx.fillStyle = bodyColor;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (!isPhase2) {
    // Inset accent rectangles for the GD-icon look.
    ctx.fillStyle = accentLight;
    ctx.fillRect(cx - r + 4, cy - r + 4, r * 0.55, r * 0.18);
    ctx.fillRect(cx - r + 4, cy + r * 0.55, r * 0.6, r * 0.18);
    ctx.fillStyle = accentDark;
    ctx.fillRect(cx + r * 0.4, cy - r + 4, r * 0.55, r * 0.18);
    ctx.fillRect(cx + r * 0.3, cy + r * 0.5, r * 0.65, r * 0.22);
  }
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 5;
  ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);

  if (!isPhase2) {
    // GD player face: two square-ish eyes + a horizontal mouth slit.
    ctx.fillStyle = "#fff";
    const eyeW = r * 0.28;
    const eyeH = r * 0.36;
    const eyeY = cy - r * 0.32;
    ctx.fillRect(cx - r * 0.42, eyeY, eyeW, eyeH);
    ctx.fillRect(cx + r * 0.14, eyeY, eyeW, eyeH);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r * 0.42, eyeY, eyeW, eyeH);
    ctx.strokeRect(cx + r * 0.14, eyeY, eyeW, eyeH);
    ctx.fillStyle = "#000";
    const pupilDx = clampN((player.x - cx) / 200, -0.5, 0.5);
    const pupilDy = clampN((player.y - cy) / 200, -0.5, 0.5);
    const pw = eyeW * 0.55;
    const ph = eyeH * 0.55;
    ctx.fillRect(
      cx - r * 0.42 + (eyeW - pw) / 2 + pupilDx * eyeW * 0.4,
      eyeY + (eyeH - ph) / 2 + pupilDy * eyeH * 0.4,
      pw,
      ph,
    );
    ctx.fillRect(
      cx + r * 0.14 + (eyeW - pw) / 2 + pupilDx * eyeW * 0.4,
      eyeY + (eyeH - ph) / 2 + pupilDy * eyeH * 0.4,
      pw,
      ph,
    );
    // Mouth — horizontal slit.
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - r * 0.42, cy + r * 0.32, r * 0.84, r * 0.12);
  } else {
    // Phase 2: hollow black eye sockets with glowing white pupils.
    ctx.fillStyle = "#000";
    const eyeW = r * 0.4;
    const eyeH = r * 0.45;
    const eyeY = cy - r * 0.35;
    ctx.fillRect(cx - r * 0.55, eyeY, eyeW, eyeH);
    ctx.fillRect(cx + r * 0.15, eyeY, eyeW, eyeH);
    ctx.fillStyle = "#fff";
    const tinyDot = 3;
    ctx.fillRect(cx - r * 0.4, eyeY + r * 0.06, tinyDot, tinyDot);
    ctx.fillRect(cx + r * 0.3, eyeY + r * 0.06, tinyDot, tinyDot);
    // Streaks under eyes.
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 2) {
      const sx = cx + i * r * 0.35;
      ctx.beginPath();
      ctx.moveTo(sx, eyeY + eyeH);
      ctx.lineTo(sx + i * 4, cy + r * 0.4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGeom(): void {
  const cx = boss.x;
  const cy = boss.y;
  const r = boss.radius;
  const isPhase2 = boss.phase === "ghost";
  drawGeomCubeAt(cx, cy, r, isPhase2);
  if (boss.vulnerableTime > 0) {
    ctx.strokeStyle = "rgba(58,109,240,0.55)";
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - r - 4, cy - r - 4, r * 2 + 8, r * 2 + 8);
  }
}

function drawCustomBoss(): void {
  const cx = boss.x;
  const cy = boss.y;
  const isPhase2 = boss.phase === "ghost";
  const pad = isPhase2 && customBoss.hasPhase2 ? customBossPad2 : customBossPad1;
  const size = boss.radius * 2.4;
  ctx.drawImage(pad, cx - size / 2, cy - size / 2, size, size);
  if (boss.vulnerableTime > 0) {
    ctx.fillStyle = "rgba(58, 109, 240, 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (boss.shieldTime > 0) {
    ctx.strokeStyle = "rgba(60,130,220,0.65)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBeatrix(): void {
  const cx = boss.x;
  const cy = boss.y;
  const targetH = 220;
  if (beatrixImgReady) {
    const aspect = beatrixImg.naturalWidth / beatrixImg.naturalHeight || 1.6;
    const w = targetH * aspect;
    ctx.drawImage(beatrixImg, cx - w / 2, cy - targetH / 2, w, targetH);
  } else {
    ctx.fillStyle = "#ff7aa6";
    ctx.fillRect(cx - 60, cy - 90, 120, 180);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 60, cy - 90, 120, 180);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText("BEATRIX", cx, cy);
    ctx.fillText("(image missing)", cx, cy + 18);
  }
  if (boss.vulnerableTime > 0) {
    const flash = Math.floor(boss.vulnerableTime * 10) % 2 === 0;
    ctx.fillStyle = flash ? "rgba(58, 109, 240, 0.3)" : "rgba(58, 109, 240, 0.1)";
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
  }
}

function elementColor(e: Element): string {
  if (e === "air") return "#cfd8e3";
  if (e === "earth") return "#6e8c3a";
  if (e === "fire") return "#e54a2b";
  return "#3a8de2";
}

function drawElemental(): void {
  const cx = boss.x;
  const cy = boss.y;
  const phase = elementalPhase;
  const isMaster = phase === 4;
  const elemColor = isMaster ? "#a020c0" : elementColor(ELEMENTS[phase]!);

  // In boss mode he's a plain stickman; in story mode he's haloed by the active element.
  ctx.save();
  if (!bossMode) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = elemColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 70 + Math.sin(elapsed * 4) * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = elemColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stickman body — black, normal proportions but boss-sized.
  const headR = 24;
  const headY = cy - 60;
  const torsoTop = headY + headR;
  const torsoBot = cy + 30;
  const feetY = cy + 90;
  ctx.strokeStyle = "#0a0a0a";
  ctx.fillStyle = "#0a0a0a";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  // head
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(cx, torsoTop);
  ctx.lineTo(cx, torsoBot);
  ctx.stroke();
  // arms — sway with elapsed
  const sway = Math.sin(elapsed * 2.5) * 0.25;
  const armReach = 32;
  ctx.beginPath();
  ctx.moveTo(cx, torsoTop + 10);
  ctx.lineTo(cx - Math.cos(sway) * armReach, torsoTop + 10 + Math.sin(sway) * armReach);
  ctx.moveTo(cx, torsoTop + 10);
  ctx.lineTo(cx + Math.cos(-sway) * armReach, torsoTop + 10 + Math.sin(-sway) * armReach);
  ctx.stroke();
  // legs
  const legSpread = 14;
  ctx.beginPath();
  ctx.moveTo(cx, torsoBot);
  ctx.lineTo(cx - legSpread, feetY);
  ctx.moveTo(cx, torsoBot);
  ctx.lineTo(cx + legSpread, feetY);
  ctx.stroke();

  ctx.restore();

  // Vulnerable flash overlay.
  if (boss.vulnerableTime > 0) {
    const flash = Math.floor(boss.vulnerableTime * 10) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flash ? 0.5 : 0.25;
    ctx.fillStyle = "#3a6df0";
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Phase label above HP bar.
  const phaseLabel = isMaster ? "MASTER" : ELEMENTS[phase]!.toUpperCase();
  ctx.fillStyle = elemColor;
  ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(phaseLabel, WIDTH / 2, 50);
}

function drawCarrotPlayer(): void {
  const cx = player.x;
  const cy = player.y - STAND_HEIGHT / 2;
  const targetH = STAND_HEIGHT * 1.1;
  if (carrotImgReady) {
    const aspect = carrotImg.naturalWidth / carrotImg.naturalHeight || 1.5;
    const w = targetH * aspect;
    ctx.save();
    if (player.facing < 0) {
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(carrotImg, -w / 2, -targetH / 2, w, targetH);
    } else {
      ctx.drawImage(carrotImg, cx - w / 2, cy - targetH / 2, w, targetH);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = "#f29030";
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 30);
    ctx.lineTo(cx + 16, cy + 30);
    ctx.lineTo(cx, cy - 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a8d4f";
    ctx.beginPath();
    ctx.arc(cx, cy - 36, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBossCardPortrait(id: string, cx: number, cy: number, scale = 1): void {
  if (id === "mrpencil") {
    if (pencilImgReady) {
      const targetH = 130 * scale;
      const aspect = pencilImg.naturalWidth / pencilImg.naturalHeight || 0.66;
      const w = targetH * aspect;
      ctx.drawImage(pencilImg, cx - w / 2, cy - targetH / 2, w, targetH);
    } else {
      drawMrPencilForm(cx, cy, false);
    }
    return;
  }
  if (id === "elemental") {
    drawBlackStickmanPortrait(cx, cy);
    return;
  }
  if (id === "beatrix") {
    if (beatrixImgReady) {
      const targetH = 140 * scale;
      const aspect = beatrixImg.naturalWidth / beatrixImg.naturalHeight || 1.6;
      const w = targetH * aspect;
      ctx.drawImage(beatrixImg, cx - w / 2, cy - targetH / 2, w, targetH);
    } else {
      ctx.fillStyle = "#ff7aa6";
      ctx.fillRect(cx - 40 * scale, cy - 60 * scale, 80 * scale, 120 * scale);
    }
    return;
  }
  if (id === "geom") {
    const r = 50 * scale;
    ctx.fillStyle = "#3a78ff";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#6aa0ff";
    ctx.fillRect(cx - r + 4, cy - r + 4, r * 0.55, r * 0.18);
    ctx.fillStyle = "#1f4ec0";
    ctx.fillRect(cx + r * 0.4, cy - r + 4, r * 0.55, r * 0.18);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5;
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#fff";
    const eyeW = r * 0.28, eyeH = r * 0.36;
    const eyeY = cy - r * 0.32;
    ctx.fillRect(cx - r * 0.42, eyeY, eyeW, eyeH);
    ctx.fillRect(cx + r * 0.14, eyeY, eyeW, eyeH);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r * 0.42, eyeY, eyeW, eyeH);
    ctx.strokeRect(cx + r * 0.14, eyeY, eyeW, eyeH);
    ctx.fillStyle = "#000";
    const pw = eyeW * 0.55, ph = eyeH * 0.55;
    ctx.fillRect(cx - r * 0.42 + (eyeW - pw) / 2, eyeY + (eyeH - ph) / 2, pw, ph);
    ctx.fillRect(cx + r * 0.14 + (eyeW - pw) / 2, eyeY + (eyeH - ph) / 2, pw, ph);
    ctx.fillStyle = "#000";
    ctx.fillRect(cx - r * 0.42, cy + r * 0.32, r * 0.84, r * 0.12);
    return;
  }
  if (id === "custom") {
    const size = 120 * scale;
    ctx.drawImage(customBossPad1, cx - size / 2, cy - size / 2, size, size);
    return;
  }
  // Default: Pac-Man portrait.
  ctx.fillStyle = "#ffd23a";
  ctx.beginPath();
  ctx.arc(cx, cy, 50 * scale, 0.5, Math.PI * 2 - 0.5);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx + 4 * scale, cy - 22 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(cx + 6 * scale, cy - 22 * scale, 3.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawBlackStickmanPortrait(cx: number, cy: number): void {
  ctx.save();
  ctx.strokeStyle = "#0a0a0a";
  ctx.fillStyle = "#0a0a0a";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  // Head
  const headR = 22;
  const headY = cy - 50;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Torso
  const torsoTop = headY + headR;
  const torsoBot = cy + 22;
  ctx.beginPath();
  ctx.moveTo(cx, torsoTop);
  ctx.lineTo(cx, torsoBot);
  ctx.stroke();
  // Arms
  ctx.beginPath();
  ctx.moveTo(cx - 28, torsoTop + 16);
  ctx.lineTo(cx, torsoTop + 6);
  ctx.lineTo(cx + 28, torsoTop + 16);
  ctx.stroke();
  // Legs
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy + 60);
  ctx.lineTo(cx, torsoBot);
  ctx.lineTo(cx + 18, cy + 60);
  ctx.stroke();
  ctx.restore();
}

function drawMrPencil(): void {
  if (boss.phase === "ghost") {
    drawMrPencilAngry(boss.x, boss.y);
    return;
  }
  drawMrPencilForm(boss.x, boss.y, false);
}

function drawMrPencilForm(cx: number, cy: number, isGhost: boolean): void {
  const bodyW = 56;
  const bodyTop = cy - 80;
  const bodyBot = cy + 50;
  const bodyH = bodyBot - bodyTop;
  const eraserH = 22;
  const ferruleH = 14;
  const tipH = 50;

  ctx.save();
  // Eraser (pink)
  ctx.fillStyle = "#ff7aa6";
  ctx.fillRect(cx - bodyW / 2, bodyTop - eraserH - ferruleH, bodyW, eraserH);
  ctx.strokeStyle = "#7a1638";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - bodyW / 2, bodyTop - eraserH - ferruleH, bodyW, eraserH);
  // Ferrule (silver band) with horizontal grooves
  const ferruleY = bodyTop - ferruleH;
  ctx.fillStyle = "#c8c8d2";
  ctx.fillRect(cx - bodyW / 2, ferruleY, bodyW, ferruleH);
  ctx.strokeStyle = "#5a5a66";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - bodyW / 2, ferruleY + i * (ferruleH / 4));
    ctx.lineTo(cx + bodyW / 2, ferruleY + i * (ferruleH / 4));
    ctx.stroke();
  }
  ctx.strokeRect(cx - bodyW / 2, ferruleY, bodyW, ferruleH);

  // Body (yellow paint)
  ctx.fillStyle = "#f6c50e";
  ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);
  // Subtle paint shading
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(cx - bodyW / 2, bodyTop, 8, bodyH);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(cx + bodyW / 2 - 10, bodyTop, 8, bodyH);
  ctx.strokeStyle = "#7a5a00";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);

  // "HB" stamp
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 12px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HB", cx, bodyTop + bodyH * 0.85);
  ctx.fillText("№2", cx, bodyTop + bodyH * 0.45);

  // Tip cone (wood)
  ctx.fillStyle = "#deb780";
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, bodyBot);
  ctx.lineTo(cx + bodyW / 2, bodyBot);
  ctx.lineTo(cx, bodyBot + tipH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#7a5a30";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Graphite point
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.moveTo(cx - 10, bodyBot + tipH - 18);
  ctx.lineTo(cx + 10, bodyBot + tipH - 18);
  ctx.lineTo(cx, bodyBot + tipH);
  ctx.closePath();
  ctx.fill();

  // Googly eyes glued onto the body — read as cheap pasted-on cartoon eyes.
  const eyesY = bodyTop + bodyH * 0.28;
  const eyeR = 14;
  const eyeOffsetX = 14;
  drawGooglyEye(cx - eyeOffsetX, eyesY, eyeR, 0);
  drawGooglyEye(cx + eyeOffsetX, eyesY, eyeR, 1);

  if (boss.shieldTime > 0) {
    ctx.strokeStyle = "rgba(60, 130, 220, 0.45)";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - bodyW / 2 - 2, bodyTop - 2, bodyW + 4, bodyH + 4);
  }
  ctx.restore();
  void isGhost;
}

function drawMrPencilAngry(cx: number, cy: number): void {
  // If the user dropped the real images into ./assets/, use them verbatim.
  if (pencilImgReady) {
    drawMrPencilAngryFromImages(cx, cy);
    return;
  }
  // Fallback: still show the new layout intent (pencil + small pointing fist
  // beside it) plus a placeholder hint that asset PNGs are missing.
  drawMrPencilFallbackLayout(cx, cy);
  return;
  // (Old fallback kept inert below.)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.18);
  ctx.translate(-cx, -cy);

  // Photo halo / background.
  const haloW = 150;
  const haloH = 250;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - haloW / 2, cy - haloH / 2, haloW, haloH);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - haloW / 2, cy - haloH / 2, haloW, haloH);
  ctx.fillStyle = "rgba(0,0,0,0.07)";
  ctx.fillRect(cx - haloW / 2, cy + haloH / 2 - 4, haloW, 4);
  ctx.fillRect(cx + haloW / 2 - 4, cy - haloH / 2, 4, haloH);

  // Pencil — point UP, eraser DOWN, like the reference.
  const bodyW = 36;
  const tipH = 42;
  const woodH = 14;
  const bodyTop = cy - 90; // top of the wooden cone
  const bodyBot = cy + 78; // top of the ferrule (where body meets metal band)
  const bodyH = bodyBot - bodyTop;
  const ferruleH = 14;
  const eraserH = 24;

  // Wood cone (tip)
  ctx.fillStyle = "#f1d7a8";
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, bodyTop);
  ctx.lineTo(cx + bodyW / 2, bodyTop);
  ctx.lineTo(cx, bodyTop - tipH);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#a07a3c";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Wood shading on left
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, bodyTop);
  ctx.lineTo(cx, bodyTop - tipH);
  ctx.lineTo(cx, bodyTop);
  ctx.closePath();
  ctx.fill();

  // Graphite point
  ctx.fillStyle = "#3a2a1a";
  ctx.beginPath();
  ctx.moveTo(cx - 8, bodyTop - tipH + woodH);
  ctx.lineTo(cx + 8, bodyTop - tipH + woodH);
  ctx.lineTo(cx, bodyTop - tipH);
  ctx.closePath();
  ctx.fill();

  // Body (light tan/peach)
  ctx.fillStyle = "#e8c896";
  ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);
  // Subtle shading
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  ctx.fillRect(cx - bodyW / 2, bodyTop, 6, bodyH);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(cx + bodyW / 2 - 6, bodyTop, 6, bodyH);
  ctx.strokeStyle = "#a07a3c";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);

  // Ferrule (off-white/cream metal band)
  const ferruleY = bodyBot;
  ctx.fillStyle = "#e6dec6";
  ctx.fillRect(cx - bodyW / 2, ferruleY, bodyW, ferruleH);
  ctx.strokeStyle = "#807a60";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - bodyW / 2, ferruleY, bodyW, ferruleH);

  // Eraser (pink)
  const eraserY = ferruleY + ferruleH;
  ctx.fillStyle = "#dc6f74";
  ctx.fillRect(cx - bodyW / 2, eraserY, bodyW, eraserH);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(cx - bodyW / 2, eraserY + eraserH - 5, bodyW, 5);
  ctx.strokeStyle = "#7a1f24";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - bodyW / 2, eraserY, bodyW, eraserH);

  ctx.restore();

  // Angry face stamped on the BODY of the pencil (drawn outside the rotation
  // so the face stays readable; the user wanted "badly drawn" cartoon style).
  drawAngryFaceStamp(cx, cy + 4);

  // Shield shimmer if shielded.
  if (boss.shieldTime > 0) {
    ctx.strokeStyle = "rgba(60, 130, 220, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, boss.radius * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMrPencilFallbackLayout(cx: number, cy: number): void {
  // Pencil placeholder (real photo missing).
  const pencilW = 100;
  const pencilH = 240;
  ctx.save();
  ctx.fillStyle = "#fffaf0";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.fillRect(cx - pencilW / 2, cy - pencilH / 2, pencilW, pencilH);
  ctx.strokeRect(cx - pencilW / 2, cy - pencilH / 2, pencilW, pencilH);
  ctx.setLineDash([]);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("[ pencil.png ]", cx, cy - 8);
  ctx.fillText("missing", cx, cy + 12);

  // Small fist+pencil placeholder placed NEXT to the pencil (right side).
  const handW = 110;
  const handH = 110;
  const handX = cx + pencilW / 2 + 14;
  const handY = cy - handH / 2 + 30;
  ctx.fillStyle = "#fffaf0";
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(handX, handY, handW, handH);
  ctx.fillRect(handX, handY, handW, handH);
  ctx.strokeRect(handX, handY, handW, handH);
  ctx.setLineDash([]);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText("[ pointing-hand.png ]", handX + handW / 2, handY + handH / 2 - 8);
  ctx.fillText("missing", handX + handW / 2, handY + handH / 2 + 12);
  ctx.restore();

  if (boss.shieldTime > 0) {
    ctx.strokeStyle = "rgba(60, 130, 220, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, boss.radius * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMrPencilAngryFromImages(cx: number, cy: number): void {
  // Phase 2 visuals are intentionally small — feels like a tiny pasted clip.
  const pencilH = 130;
  const pencilAspect = pencilImg.naturalWidth / pencilImg.naturalHeight || 0.66;
  const pencilW = pencilH * pencilAspect;

  ctx.save();
  ctx.drawImage(pencilImg, cx - pencilW / 2, cy - pencilH / 2, pencilW, pencilH);
  ctx.restore();

  if (pointingHandImgReady) {
    const handH = 70;
    const handAspect = pointingHandImg.naturalWidth / pointingHandImg.naturalHeight || 1.5;
    const handW = handH * handAspect;
    const gap = 6;
    const handX = cx + pencilW / 2 + gap;
    const handY = cy - handH / 2 + 14;
    ctx.save();
    ctx.drawImage(pointingHandImg, handX, handY, handW, handH);
    ctx.restore();
  }

  if (boss.shieldTime > 0) {
    ctx.strokeStyle = "rgba(60, 130, 220, 0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, boss.radius * 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAngryFaceStamp(cx: number, cy: number): void {
  // Two big round white eyes with thick black outlines and small pupils.
  // Bushy angled eyebrows above. Wide angry open mouth below.
  const eyeR = 16;
  const eyeOffsetX = 13;
  const eyeY = cy - 14;

  // Eyes
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 3;
  for (const sx of [cx - eyeOffsetX, cx + eyeOffsetX]) {
    ctx.beginPath();
    ctx.arc(sx, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Pupils — small, looking inward (cross-eyed angry).
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.arc(cx - eyeOffsetX + 3, eyeY - 2, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffsetX - 3, eyeY - 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Bushy angled eyebrows — thick comma-like wedges that meet near the bridge.
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.moveTo(cx - eyeOffsetX - eyeR - 2, eyeY - eyeR - 2);
  ctx.quadraticCurveTo(cx - eyeOffsetX - 4, eyeY - eyeR - 14, cx - 3, eyeY - 4);
  ctx.quadraticCurveTo(cx - eyeOffsetX - 4, eyeY - eyeR + 4, cx - eyeOffsetX - eyeR - 2, eyeY - eyeR + 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + eyeOffsetX + eyeR + 2, eyeY - eyeR - 2);
  ctx.quadraticCurveTo(cx + eyeOffsetX + 4, eyeY - eyeR - 14, cx + 3, eyeY - 4);
  ctx.quadraticCurveTo(cx + eyeOffsetX + 4, eyeY - eyeR + 4, cx + eyeOffsetX + eyeR + 2, eyeY - eyeR + 4);
  ctx.closePath();
  ctx.fill();

  // Mouth — wide open angry shape with a couple of jagged teeth nubs.
  const mouthY = eyeY + eyeR + 12;
  ctx.fillStyle = "#0a0a0a";
  ctx.beginPath();
  ctx.moveTo(cx - 18, mouthY);
  ctx.quadraticCurveTo(cx - 14, mouthY - 6, cx - 6, mouthY - 4);
  ctx.lineTo(cx - 3, mouthY + 2);
  ctx.lineTo(cx + 3, mouthY - 4);
  ctx.quadraticCurveTo(cx + 14, mouthY - 6, cx + 18, mouthY);
  ctx.quadraticCurveTo(cx + 18, mouthY + 14, cx, mouthY + 18);
  ctx.quadraticCurveTo(cx - 18, mouthY + 14, cx - 18, mouthY);
  ctx.closePath();
  ctx.fill();
  // Inner highlight to show the open maw shape.
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(cx, mouthY + 6, 7, 0, Math.PI * 2);
  ctx.fill();
}

function drawAngryPencilOverlay(cx: number, eyesY: number, bodyW: number, bodyTop: number, bodyH: number): void {
  ctx.save();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Crayon-y angry eyebrows above the googly eyes — drawn like a kid scribbled them on.
  ctx.lineWidth = 4;
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass === 0 ? 1 : 0.5;
    // Left brow: angled down toward the nose.
    ctx.beginPath();
    ctx.moveTo(cx - 26 + jitter(40000 + pass, 1.5), eyesY - 18 + jitter(40001 + pass, 1.5));
    ctx.lineTo(cx - 4 + jitter(40002 + pass, 1.5), eyesY - 9 + jitter(40003 + pass, 1.5));
    ctx.stroke();
    // Right brow: angled down toward the nose.
    ctx.beginPath();
    ctx.moveTo(cx + 4 + jitter(40010 + pass, 1.5), eyesY - 9 + jitter(40011 + pass, 1.5));
    ctx.lineTo(cx + 26 + jitter(40012 + pass, 1.5), eyesY - 18 + jitter(40013 + pass, 1.5));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Frown — wobbly arc with corners curving up.
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  const frownY = eyesY + 22;
  ctx.moveTo(cx - 16 + jitter(40100, 1.5), frownY - 6);
  ctx.quadraticCurveTo(cx + jitter(40101, 1.5), frownY + 8, cx + 16 + jitter(40102, 1.5), frownY - 6);
  ctx.stroke();

  // Anger zigzag marks on either side of the head.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#c12a2a";
  for (let side = -1; side <= 1; side += 2) {
    const baseX = cx + side * (bodyW / 2 + 14);
    const baseY = bodyTop + bodyH * 0.18;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(baseX + side * 6, baseY - 6);
    ctx.lineTo(baseX, baseY - 12);
    ctx.lineTo(baseX + side * 6, baseY - 18);
    ctx.stroke();
  }

  // A second pair of "steam" puff marks above eraser.
  ctx.strokeStyle = "rgba(40, 40, 40, 0.6)";
  ctx.lineWidth = 2.5;
  for (let side = -1; side <= 1; side += 2) {
    const sx = cx + side * 22;
    const sy = bodyTop - 36;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, side > 0 ? Math.PI * 0.2 : Math.PI * 0.8, side > 0 ? Math.PI * 1.6 : Math.PI * 2.2, side < 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGooglyEye(cx: number, cy: number, r: number, seed: number): void {
  // White circle with a thin black ring; pupil wobbles loosely as if glued.
  const wobble = Math.sin(elapsed * 4 + seed * 1.3) * r * 0.35;
  const wobble2 = Math.cos(elapsed * 3.3 + seed * 1.7) * r * 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx + wobble, cy + wobble2, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // Glue smudge
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.7, cy + r * 0.7, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPacman(): void {
  const cx = boss.x;
  const cy = boss.y;
  const r = boss.radius;
  const mouthOpen = (Math.sin(boss.mouthPhase) + 1) / 2;
  const isGhost = boss.phase === "ghost";
  // Ghost mouth opens really wide — a sharp triangular maw.
  const mouthAngle = isGhost ? 1.25 + mouthOpen * 0.2 : mouthOpen * 0.7 + 0.05;
  const rot = getMouthRotation();

  // When at home, his visibility is somewhere between 0 and 1.
  // When traveling, he's offscreen-then-onscreen at full opacity.
  const alpha = boss.atHome ? boss.visibility : 1;
  if (alpha <= 0.02) {
    if (boss.atHome) drawEraserSmudges(cx, cy, r, 1);
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  // Body color — blue while vulnerable, white when ghost.
  const vulnerable = boss.vulnerableTime > 0;
  const flashing = vulnerable && boss.vulnerableTime < 1.5 && Math.floor(boss.vulnerableTime * 8) % 2 === 0;
  let bodyColor = "#ffd23a";
  if (isGhost) bodyColor = vulnerable ? (flashing ? "#ffffff" : "#3a6df0") : "#ffffff";
  else if (vulnerable) bodyColor = flashing ? "#ffd23a" : "#3a6df0";
  ctx.fillStyle = bodyColor;
  ctx.globalAlpha = 0.95;
  const segments = 28;
  if (isGhost) {
    // Ghost form is a complete circle — no wedge cut. The triangle is drawn
    // separately on top of the body.
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const wob = jitter(11000 + i, r * 0.05);
      const px = Math.cos(a) * (r + wob);
      const py = Math.sin(a) * (r + wob);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.stroke();
  } else {
    const startAngle = mouthAngle;
    const endAngle = -mouthAngle;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + t * (Math.PI * 2 - (startAngle - endAngle));
      const wob = jitter(11000 + i, r * 0.05);
      ctx.lineTo(Math.cos(a) * (r + wob), Math.sin(a) * (r + wob));
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + t * (Math.PI * 2 - (startAngle - endAngle));
      const wob = jitter(11000 + i, r * 0.05);
      ctx.lineTo(Math.cos(a) * (r + wob), Math.sin(a) * (r + wob));
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();

  ctx.globalAlpha = alpha;
  // Pac-Man's eye sits perpendicular to his mouth axis. Of the two perpendiculars,
  // pick whichever has the smaller (more negative) y so the eye always reads as
  // "above" his head visually. Ties (mouth pointing straight up/down) fall back
  // to the side closer to the player so it never overlaps the mouth opening.
  const perp1 = { x: Math.sin(rot), y: -Math.cos(rot) };
  const perp2 = { x: -Math.sin(rot), y: Math.cos(rot) };
  let eyeDir: { x: number; y: number };
  if (Math.abs(perp1.y - perp2.y) < 0.001) {
    eyeDir = player.x < cx ? { x: -1, y: 0 } : { x: 1, y: 0 };
  } else {
    eyeDir = perp1.y < perp2.y ? perp1 : perp2;
  }
  // Slight nudge toward the back of his head (opposite the mouth direction).
  const backX = -Math.cos(rot);
  const backY = -Math.sin(rot);
  const eyeR = 12;
  const eyeX = cx + eyeDir.x * r * 0.5 + backX * 5;
  const eyeY = cy + eyeDir.y * r * 0.5 + backY * 5;

  if (!isGhost) {
    crayonFillCircle(eyeX, eyeY, eyeR, "#ffffff", 12500);
    crayonCircle(eyeX, eyeY, eyeR, "#222", 3, 12501);
  }
  if (!isGhost) {
    // Pupil tracks the player so he reads as menacing.
    const dxToPlayer = player.x - eyeX;
    const dyToPlayer = player.y - 30 - eyeY;
    const lookLen = Math.hypot(dxToPlayer, dyToPlayer) || 1;
    const lookX = (dxToPlayer / lookLen) * 4;
    const lookY = (dyToPlayer / lookLen) * 4;
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(eyeX + lookX, eyeY + lookY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX + lookX - 1.5, eyeY + lookY - 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (isGhost) {
    // Two small filled dot eyes above the triangle, like in the sketch.
    const eyesY = cy - r * 0.55;
    const eyeSpread = r * 0.3;
    crayonFillCircle(cx - eyeSpread, eyesY, 6, "#222", 16500);
    crayonFillCircle(cx + eyeSpread, eyesY, 6, "#222", 16550);

    // Big upward-pointing triangle drawn ON TOP of the body, in world coords.
    const triH = r * 0.95;
    const triHalfW = r * 0.55;
    const triCx = cx;
    const triCy = cy + r * 0.1;
    const apex = { x: triCx, y: triCy - triH * 0.55 };
    const baseL = { x: triCx - triHalfW, y: triCy + triH * 0.45 };
    const baseR = { x: triCx + triHalfW, y: triCy + triH * 0.45 };

    // Crayon-wobble triangle path.
    function triPath(): void {
      ctx.beginPath();
      ctx.moveTo(apex.x + jitter(18000, 2), apex.y + jitter(18001, 2));
      ctx.lineTo(baseR.x + jitter(18002, 2), baseR.y + jitter(18003, 2));
      ctx.lineTo(baseL.x + jitter(18004, 2), baseL.y + jitter(18005, 2));
      ctx.closePath();
    }

    // Hatching: diagonal pencil strokes clipped to the triangle.
    ctx.save();
    triPath();
    ctx.clip();
    ctx.strokeStyle = "rgba(50,50,55,0.85)";
    ctx.lineWidth = 1.6;
    const hatchSpacing = 7;
    const minXY = Math.min(baseL.x, apex.y - triH);
    const maxXY = Math.max(baseR.x, baseL.y + triH);
    for (let off = minXY - triH; off < maxXY + triH; off += hatchSpacing) {
      ctx.beginPath();
      ctx.moveTo(triCx - triH + off + jitter(18100 + off, 1), triCy - triH * 1.1);
      ctx.lineTo(triCx - triH * 0.2 + off + jitter(18101 + off, 1), triCy + triH * 1.1);
      ctx.stroke();
    }
    // Cross-hatch in the other diagonal for a denser pencil shade.
    for (let off = minXY - triH; off < maxXY + triH; off += hatchSpacing * 1.6) {
      ctx.beginPath();
      ctx.moveTo(triCx + triH * 0.2 - off + jitter(18200 + off, 1), triCy - triH * 1.1);
      ctx.lineTo(triCx + triH - off + jitter(18201 + off, 1), triCy + triH * 1.1);
      ctx.stroke();
    }
    ctx.restore();

    // Triangle outline — a couple of crayon passes for that hand-drawn look.
    ctx.strokeStyle = "#222";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass === 0 ? 4 : 2;
      ctx.globalAlpha = pass === 0 ? 1 : 0.5;
      triPath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (boss.atHome && boss.visibility < 1) {
    drawEraserSmudges(cx, cy, r, 1 - boss.visibility);
  }
}

function drawEraserSmudges(cx: number, cy: number, r: number, intensity: number): void {
  // Bell-shape: strongest mid-transition, zero at both ends so the home spot
  // reads as completely empty when he's fully erased.
  const strength = 4 * intensity * (1 - intensity);
  if (strength <= 0.05) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, strength);
  ctx.strokeStyle = "#fdf6d8";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 9;
  // A few wobbly white scribble strokes across the head.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + jitter(20000 + i, 0.4);
    const len = r * (0.9 + jitter(20100 + i, 0.2));
    const x1 = cx + Math.cos(a) * -len + jitter(20200 + i, 4);
    const y1 = cy + Math.sin(a) * -len + jitter(20300 + i, 4);
    const x2 = cx + Math.cos(a) * len + jitter(20400 + i, 4);
    const y2 = cy + Math.sin(a) * len + jitter(20500 + i, 4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx + jitter(20600 + i, 6), cy + jitter(20700 + i, 6), x2, y2);
    ctx.stroke();
  }
  // Pencil flecks — little dashes around the perimeter, suggesting he's being re-sketched.
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.globalAlpha = Math.min(0.6, strength * 0.6);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + jitter(20800 + i, 0.3);
    const rr = r * (0.85 + jitter(20900 + i, 0.15));
    const x1 = cx + Math.cos(a) * rr;
    const y1 = cy + Math.sin(a) * rr;
    const x2 = x1 + Math.cos(a) * 6;
    const y2 = y1 + Math.sin(a) * 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBossHpBar(): void {
  if (boss.phase === "transitioning") return;
  const barW = 320;
  const barX = (WIDTH - barW) / 2;
  const barY = 16;
  ctx.fillStyle = "#fff";
  ctx.fillRect(barX, barY, barW, 16);
  ctx.fillStyle = "#e23a3a";
  ctx.fillRect(barX, barY, barW * (boss.hp / boss.hpMax), 16);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, 16);
  ctx.fillStyle = "#222";
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  const hpName = (BOSS_ROSTER.find((b) => b.id === currentBossId)?.name ?? "PAC MAN").toUpperCase();
  ctx.fillText(hpName, WIDTH / 2, barY - 4);
}

function drawStickman(): void {
  if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) return;
  if (currentBossId === "beatrix" && !bossMode) {
    drawCarrotPlayer();
    return;
  }

  const isRunning = Math.abs(player.vx) > 1 && player.onGround;
  const isJumping = !player.onGround;
  const height = player.ducking ? DUCK_HEIGHT : STAND_HEIGHT;
  const headRadius = 16;
  const bob = !isRunning && !isJumping && !player.ducking ? Math.sin(elapsed * 3) * 1.5 : 0;
  const feetY = player.y + bob;
  const headCenterY = feetY - height + headRadius;
  const torsoTop = headCenterY + headRadius;
  const torsoBottom = feetY - height * 0.4;

  const skin = getEquippedSkin();
  const bodyColor = skin.body;
  const shirtColor = skin.shirt;
  const pantsColor = skin.pants;

  crayonFillCircle(player.x, headCenterY, headRadius, skin.skin, 100);
  crayonCircle(player.x, headCenterY, headRadius, bodyColor, 3, 101);

  for (let i = 0; i < 5; i++) {
    const hx = player.x - 10 + i * 5;
    crayonLine(hx, headCenterY - headRadius + 2, hx + jitter(110 + i, 2), headCenterY - headRadius - 8, "#3a2618", 2.5, 110 + i);
  }

  if (skin.sunglasses) {
    drawPixelatedShades(player.x, headCenterY - 2, player.facing);
  } else {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(player.x - 5 + player.facing * 2, headCenterY - 2, 2.2, 0, Math.PI * 2);
    ctx.arc(player.x + 5 + player.facing * 2, headCenterY - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x + player.facing, headCenterY + 5, 5, 0.1, Math.PI - 0.1);
  ctx.stroke();

  const torsoH = torsoBottom - torsoTop;
  const torsoW = player.ducking ? 32 : 26;
  scribbleFill(player.x - torsoW / 2, torsoTop, torsoW, torsoH, shirtColor, 200);
  crayonLine(player.x - torsoW / 2, torsoTop, player.x - torsoW / 2, torsoBottom, bodyColor, 3, 201);
  crayonLine(player.x + torsoW / 2, torsoTop, player.x + torsoW / 2, torsoBottom, bodyColor, 3, 202);
  crayonLine(player.x - torsoW / 2, torsoTop, player.x + torsoW / 2, torsoTop, bodyColor, 3, 203);
  crayonLine(player.x - torsoW / 2, torsoBottom, player.x + torsoW / 2, torsoBottom, bodyColor, 3, 204);

  let armLAngle = 0;
  let armRAngle = 0;
  if (isJumping) {
    armLAngle = -1.4;
    armRAngle = 1.4;
  } else if (isRunning) {
    armLAngle = Math.sin(player.runPhase) * 1.2;
    armRAngle = -Math.sin(player.runPhase) * 1.2;
  } else if (player.ducking) {
    armLAngle = 0.7;
    armRAngle = -0.7;
  } else {
    armLAngle = Math.sin(elapsed * 2) * 0.1;
    armRAngle = -Math.sin(elapsed * 2) * 0.1;
  }
  const shoulderY = torsoTop + 8;
  const armLen = 28;
  const lShoulderX = player.x - torsoW / 2;
  const rShoulderX = player.x + torsoW / 2;
  const lHandX = lShoulderX + Math.sin(armLAngle - 1.2) * armLen;
  const lHandY = shoulderY + Math.cos(armLAngle - 1.2) * armLen;
  const rHandX = rShoulderX + Math.sin(armRAngle + 1.2) * armLen;
  const rHandY = shoulderY + Math.cos(armRAngle + 1.2) * armLen;
  crayonLine(lShoulderX, shoulderY, lHandX, lHandY, bodyColor, 4, 300);
  crayonLine(rShoulderX, shoulderY, rHandX, rHandY, bodyColor, 4, 301);
  crayonFillCircle(lHandX, lHandY, 4, "#fde2c1", 302);
  crayonFillCircle(rHandX, rHandY, 4, "#fde2c1", 303);

  let legLAngle = 0;
  let legRAngle = 0;
  if (isJumping) {
    legLAngle = -0.5;
    legRAngle = 0.4;
  } else if (isRunning) {
    legLAngle = Math.sin(player.runPhase) * 0.8;
    legRAngle = -Math.sin(player.runPhase) * 0.8;
  } else if (player.ducking) {
    legLAngle = -0.5;
    legRAngle = 0.5;
  }
  const hipY = torsoBottom;
  const legLen = feetY - hipY;
  const lFootX = player.x + Math.sin(legLAngle) * legLen;
  const lFootY = hipY + Math.cos(legLAngle) * legLen;
  const rFootX = player.x + Math.sin(legRAngle) * legLen;
  const rFootY = hipY + Math.cos(legRAngle) * legLen;
  scribbleFill(player.x - 12, hipY, 24, Math.max(8, legLen * 0.6), pantsColor, 400);
  crayonLine(player.x, hipY, lFootX, lFootY, bodyColor, 4, 401);
  crayonLine(player.x, hipY, rFootX, rFootY, bodyColor, 4, 402);
  crayonFillCircle(lFootX, lFootY, 5, skin.shoe, 403);
  crayonFillCircle(rFootX, rFootY, 5, skin.shoe, 404);
}

function drawPixelatedShades(cx: number, cy: number, facing: 1 | -1): void {
  // 8-bit shades: big chunky black square lenses + bridge + pixel highlights.
  const px = 3.5; // "pixel" size — bigger reads more 8-bit
  const lensW = px * 5;
  const lensH = px * 4;
  const bridge = px * 1.5;
  const offset = facing * 2;
  const totalW = lensW * 2 + bridge;
  const startX = cx + offset - totalW / 2;
  const y = cy - lensH / 2 - px * 0.5;

  ctx.fillStyle = "#0d0d12";
  // left lens
  ctx.fillRect(startX, y, lensW, lensH);
  // right lens
  ctx.fillRect(startX + lensW + bridge, y, lensW, lensH);
  // bridge across the nose
  ctx.fillRect(startX + lensW, y + lensH * 0.4, bridge, px);
  // temple arms going back toward the ears
  ctx.fillRect(startX - px * 2.2, y + px, px * 2.2, px);
  ctx.fillRect(startX + totalW, y + px, px * 2.2, px);
  // pixel highlight glints
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(startX + px, y + px, px, px);
  ctx.fillRect(startX + lensW + bridge + px, y + px, px, px);
}

function drawHud(): void {
  // Hearts
  for (let i = 0; i < 5; i++) {
    const hx = 96 + i * 28;
    const hy = HEIGHT - 30;
    const filled = i < player.hp;
    ctx.fillStyle = filled ? "#e23a3a" : "rgba(0,0,0,0.1)";
    ctx.strokeStyle = "#7a1414";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 4);
    ctx.bezierCurveTo(hx, hy - 6, hx - 14, hy - 6, hx - 14, hy + 4);
    ctx.bezierCurveTo(hx - 14, hy + 12, hx, hy + 18, hx, hy + 22);
    ctx.bezierCurveTo(hx, hy + 18, hx + 14, hy + 12, hx + 14, hy + 4);
    ctx.bezierCurveTo(hx + 14, hy - 6, hx, hy - 6, hx, hy + 4);
    ctx.fill();
    ctx.stroke();
  }

  // Pickup inventory.
  const pelletHudX = 240;
  const pelletHudY = HEIGHT - 22;
  if (currentBossId === "elemental") {
    let x = pelletHudX;
    for (const e of ELEMENTS) {
      drawElementBit(x, pelletHudY, e, 14000 + e.length);
      ctx.fillStyle = "#1f4ea8";
      ctx.font = "italic 14px 'Comic Sans MS', cursive";
      ctx.textAlign = "left";
      ctx.fillText(`×${elementInventory[e]}`, x + 12, pelletHudY + 5);
      x += 56;
    }
    const need = elementalPhase === 4 ? "ALL" : ELEMENTS[elementalPhase]!.toUpperCase();
    const ready = elementalPhase === 4
      ? ELEMENTS.every((e) => elementInventory[e] > 0)
      : elementInventory[ELEMENTS[elementalPhase]!] > 0;
    ctx.fillStyle = ready && boss.vulnerableTime <= 0 ? "#1f4ea8" : "rgba(31,78,168,0.35)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.fillText(`Press E to use ${need}`, x + 6, pelletHudY + 5);
  } else if (currentBossId === "mrpencil") {
    drawEraserPickup(pelletHudX, pelletHudY, 0);
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic 18px 'Comic Sans MS', cursive";
    ctx.textAlign = "left";
    ctx.fillText(`× ${pelletInventory}`, pelletHudX + 18, pelletHudY + 6);
    ctx.fillStyle = pelletInventory > 0 && boss.vulnerableTime <= 0 ? "#1f4ea8" : "rgba(31,78,168,0.35)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.fillText("Press E to erase him", pelletHudX + 70, pelletHudY + 6);
  } else if (currentBossId === "beatrix") {
    drawTarrPickup(pelletHudX, pelletHudY);
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic 18px 'Comic Sans MS', cursive";
    ctx.textAlign = "left";
    ctx.fillText(`× ${pelletInventory}`, pelletHudX + 22, pelletHudY + 6);
    ctx.fillStyle = pelletInventory > 0 && boss.vulnerableTime <= 0 ? "#1f4ea8" : "rgba(31,78,168,0.35)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.fillText("Press E to throw a TARR", pelletHudX + 70, pelletHudY + 6);
  } else if (currentBossId === "geom") {
    drawSpikePickup(pelletHudX, pelletHudY);
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.textAlign = "left";
    ctx.fillText("SPIKES auto-fire when collected", pelletHudX + 22, pelletHudY + 5);
  } else {
    crayonFillCircle(pelletHudX, pelletHudY, 9, pelletInventory > 0 ? "#ffffff" : "#dcd6b8", 14000);
    crayonCircle(pelletHudX, pelletHudY, 9, "#222", 2, 14001);
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic 18px 'Comic Sans MS', cursive";
    ctx.textAlign = "left";
    ctx.fillText(`× ${pelletInventory}`, pelletHudX + 18, pelletHudY + 6);
    ctx.fillStyle = pelletInventory > 0 && boss.vulnerableTime <= 0 ? "#1f4ea8" : "rgba(31,78,168,0.35)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.fillText("Press E to chomp him", pelletHudX + 70, pelletHudY + 6);
  }

  if (boss.vulnerableTime > 0) {
    ctx.fillStyle = "#3a6df0";
    ctx.font = "italic bold 18px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(`HIT HIM!  ${boss.vulnerableTime.toFixed(1)}s`, WIDTH / 2, HEIGHT - 22);
  }

  ctx.save();
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic 16px 'Comic Sans MS', cursive";
  ctx.textAlign = "right";
  ctx.fillText("← → move    ↑ jump    ↓ duck    E activate", WIDTH - 20, HEIGHT - 18);
  ctx.restore();
}

function drawEndOverlay(): void {
  if (gameState === "playing") return;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.font = "italic bold 60px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(
    gameState === "won"
      ? `YOU BEAT ${(BOSS_ROSTER.find((b) => b.id === currentBossId)?.name ?? "PAC MAN").toUpperCase()}!`
      : "GAME OVER",
    WIDTH / 2,
    HEIGHT / 2
  );
  ctx.font = "italic 22px 'Comic Sans MS', cursive";
  ctx.fillText("Refresh to try again", WIDTH / 2, HEIGHT / 2 + 40);
}

function drawPhaseTransition(): void {
  const cx = boss.x;
  const cy = boss.y;
  const r = boss.radius;
  const t = transitionTime / TRANSITION_DURATION;

  // ---- Stage 1: 0.00–0.22  Pac-Man freezes, white-hot cracks split his body
  // ---- Stage 2: 0.22–0.45  He shatters into pencil scribbles, fades out
  // ---- Stage 3: 0.45–0.72  Black & purple ink shockwave rings explode outward
  // ---- Stage 4: 0.72–1.00  Ghost form sketches in, scribble lines flying inward

  const stage1 = Math.max(0, Math.min(1, t / 0.22));
  const stage2 = Math.max(0, Math.min(1, (t - 0.22) / 0.23));
  const stage3 = Math.max(0, Math.min(1, (t - 0.45) / 0.27));
  const stage4 = Math.max(0, Math.min(1, (t - 0.72) / 0.28));

  // Stage 1: phase-1 form frozen, cracks growing across it.
  if (t < 0.45) {
    const fadeOut = 1 - stage2;
    ctx.save();
    ctx.globalAlpha = fadeOut;
    if (currentBossId === "mrpencil") {
      drawMrPencilForm(cx, cy, false);
    } else if (currentBossId === "geom") {
      drawGeomCubeAt(cx, cy, r, false);
    } else {
      drawPacmanShape(cx, cy, r, "#ffd23a", 0.6);
    }
    ctx.restore();

    // White cracks radiating from center.
    if (stage1 > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${stage1 * (1 - stage2 * 0.4)})`;
      ctx.lineWidth = 3 + stage1 * 4;
      ctx.lineCap = "round";
      const cracks = 9;
      for (let i = 0; i < cracks; i++) {
        const ang = (i / cracks) * Math.PI * 2 + jitter(50000 + i, 0.3);
        const reach = r * (0.2 + stage1 * 1.2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        // Jagged crack with mid-bend
        const midX = cx + Math.cos(ang) * reach * 0.55 + jitter(50100 + i, 8);
        const midY = cy + Math.sin(ang) * reach * 0.55 + jitter(50200 + i, 8);
        ctx.lineTo(midX, midY);
        ctx.lineTo(
          cx + Math.cos(ang + jitter(50300 + i, 0.2)) * reach,
          cy + Math.sin(ang + jitter(50300 + i, 0.2)) * reach
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Stage 2: shattering into pencil scribbles flying outward.
  if (stage2 > 0 && stage2 < 1.05) {
    ctx.save();
    ctx.strokeStyle = `rgba(40, 30, 20, ${1 - Math.max(0, stage2 - 0.7)})`;
    ctx.lineWidth = 2;
    const shards = 28;
    for (let i = 0; i < shards; i++) {
      const ang = (i / shards) * Math.PI * 2 + jitter(51000 + i, 0.2);
      const dist = r * (0.4 + stage2 * 2.2);
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      const dx = Math.cos(ang) * 14 + jitter(51100 + i, 4);
      const dy = Math.sin(ang) * 14 + jitter(51200 + i, 4);
      ctx.beginPath();
      ctx.moveTo(px - dx, py - dy);
      ctx.lineTo(px + dx, py + dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Stage 3: ink shockwave rings.
  if (stage3 > 0) {
    for (let ring = 0; ring < 3; ring++) {
      const offset = ring * 0.18;
      const ringT = stage3 - offset;
      if (ringT > 0 && ringT < 1) {
        const ringR = r * (0.6 + ringT * 6);
        ctx.strokeStyle = `rgba(160, 60, 220, ${(1 - ringT) * 0.85})`;
        ctx.lineWidth = 6 * (1 - ringT * 0.5);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(20, 20, 30, ${(1 - ringT) * 0.6})`;
        ctx.lineWidth = 3 * (1 - ringT);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Stage 4: ghost form sketches in. Scribble lines fly INWARD as he condenses.
  if (stage4 > 0) {
    // Pencil scribbles converging toward boss center.
    ctx.save();
    ctx.strokeStyle = `rgba(40, 30, 20, ${(1 - stage4) * 0.9})`;
    ctx.lineWidth = 2;
    const incoming = 22;
    for (let i = 0; i < incoming; i++) {
      const ang = (i / incoming) * Math.PI * 2 + jitter(52000 + i, 0.2);
      const startD = r * 4 * (1 - stage4);
      const endD = r * 1.1 + jitter(52100 + i, 6);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * startD, cy + Math.sin(ang) * startD);
      ctx.lineTo(cx + Math.cos(ang) * endD, cy + Math.sin(ang) * endD);
      ctx.stroke();
    }
    ctx.restore();

    // The new phase-2 body materializes at the boss position with rising alpha.
    ctx.save();
    ctx.globalAlpha = stage4;
    if (currentBossId === "mrpencil") {
      drawMrPencilAngry(cx, cy);
    } else if (currentBossId === "geom") {
      drawGeomCubeAt(cx, cy, r, true);
    } else {
      drawGhostBody(cx, cy, r);
    }
    ctx.restore();
  }

  // Big "PHASE 2" stamp that flashes in and lingers.
  if (t > 0.55) {
    const stampT = Math.min(1, (t - 0.55) / 0.18);
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    const wobble = 1 + (1 - stampT) * 0.6;
    ctx.scale(wobble, wobble);
    ctx.rotate(-0.04);
    ctx.globalAlpha = stampT * (t > 0.92 ? Math.max(0, 1 - (t - 0.92) / 0.08) : 1);
    ctx.fillStyle = "#a020c0";
    ctx.font = "italic bold 96px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PHASE 2", 0, 0);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#222";
    ctx.strokeText("PHASE 2", 0, 0);
    ctx.restore();
  }

  // White flash that punctuates the shockwave moment.
  if (t > 0.42 && t < 0.55) {
    const flashT = (t - 0.42) / 0.13;
    const flashAlpha = Math.max(0, 1 - Math.abs(flashT - 0.3) * 4);
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.85})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

// Pull out the alive Pac-Man body so the transition can re-render it with custom alpha.
function drawPacmanShape(cx: number, cy: number, r: number, color: string, mouthOpenness: number): void {
  const mouthAngle = mouthOpenness * 0.7 + 0.05;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  const segments = 28;
  const startAngle = mouthAngle;
  const endAngle = -mouthAngle;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + t * (Math.PI * 2 - (startAngle - endAngle));
    const wob = jitter(11000 + i, r * 0.05);
    ctx.lineTo(Math.cos(a) * (r + wob), Math.sin(a) * (r + wob));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function drawGhostBody(cx: number, cy: number, r: number): void {
  // Full white circle body.
  crayonFillCircle(cx, cy, r, "#ffffff", 53000);
  crayonCircle(cx, cy, r, "#222", 4, 53001);
  // Two black eyes near top.
  const eyesY = cy - r * 0.55;
  const eyeSpread = r * 0.3;
  crayonFillCircle(cx - eyeSpread, eyesY, 6, "#222", 53100);
  crayonFillCircle(cx + eyeSpread, eyesY, 6, "#222", 53150);
  // Triangle with hatching in middle.
  const triH = r * 0.95;
  const triHalfW = r * 0.55;
  const triCx = cx;
  const triCy = cy + r * 0.1;
  const apex = { x: triCx, y: triCy - triH * 0.55 };
  const baseL = { x: triCx - triHalfW, y: triCy + triH * 0.45 };
  const baseR = { x: triCx + triHalfW, y: triCy + triH * 0.45 };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(baseR.x, baseR.y);
  ctx.lineTo(baseL.x, baseL.y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = "rgba(50,50,55,0.85)";
  ctx.lineWidth = 1.6;
  for (let off = -triH; off < triH * 2; off += 7) {
    ctx.beginPath();
    ctx.moveTo(triCx - triH + off, triCy - triH * 1.1);
    ctx.lineTo(triCx - triH * 0.2 + off, triCy + triH * 1.1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(baseR.x, baseR.y);
  ctx.lineTo(baseL.x, baseL.y);
  ctx.closePath();
  ctx.stroke();
}

function drawArenaSnapshot(): void {
  drawBackground();
  drawPlatforms();
  drawAttacks();
  drawPellets();
  if (boss.phase === "transitioning") {
    drawPhaseTransition();
  } else {
    drawActiveBoss();
  }
  drawStickman();
  if (
    bossMode &&
    attacks.length === 0 &&
    boss.phase !== "transitioning" &&
    currentBossId !== "mrpencil" &&
    currentBossId !== "elemental"
  ) {
    drawBossAimPreview();
  }
  if (bossMode && currentBossId === "mrpencil" && pencilBossArmed === "mallet") {
    drawMalletCrosshair();
  }
  if (bossMode && currentBossId === "elemental" && boss.phase !== "transitioning") {
    drawElementalAimReticle();
  }
  // Horror cue when the grab hand is in flight or has caught the kid.
  // Horror cue only fires once the hand has actually caught the kid.
  const grab = attacks.find((a) => a.kind === "grabhand" && a.phase === "fall");
  const horrorIntensity = grab ? 1 : 0;
  drawHorrorVignette(horrorIntensity);
  pumpHeartbeat(horrorIntensity > 0, horrorIntensity);
  drawBossHpBar();
  if (bossMode) drawBossModeHud();
  else drawHud();
}

function drawElementalAimReticle(): void {
  const r = 18;
  const isMaster = elementalPhase === 4;
  const e = ELEMENTS[Math.min(elementalPhase, 3)]!;
  const color = isMaster ? "#a020c0" : elementColor(e);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(aimX, aimY, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(aimX, aimY, r * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(aimX - r * 1.5, aimY);
  ctx.lineTo(aimX - r * 0.6, aimY);
  ctx.moveTo(aimX + r * 0.6, aimY);
  ctx.lineTo(aimX + r * 1.5, aimY);
  ctx.moveTo(aimX, aimY - r * 1.5);
  ctx.lineTo(aimX, aimY - r * 0.6);
  ctx.moveTo(aimX, aimY + r * 0.6);
  ctx.lineTo(aimX, aimY + r * 1.5);
  ctx.stroke();
  ctx.restore();
}

function drawMalletCrosshair(): void {
  const x = clampN(mouseArenaX, 80, WIDTH - 80);
  // Vertical drop indicator from sky to ground.
  ctx.save();
  ctx.strokeStyle = "rgba(180, 60, 60, 0.65)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(x, 20);
  ctx.lineTo(x, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Impact zone hint at ground level.
  ctx.fillStyle = "rgba(220, 80, 80, 0.35)";
  ctx.fillRect(x - 60, GROUND_Y - 6, 120, 6);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 16px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("CLICK TO DROP", x, 50);
  ctx.restore();
}

function drawBossAimPreview(): void {
  // Lane preview based on current aim.
  const dx = aimX - boss.x;
  const dy = aimY - boss.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const ready = bossAbilityCooldown <= 0;
  const previewAlpha = ready ? 0.18 : 0.07;

  if (boss.phase === "ghost") {
    // Laser preview line: a faint dashed path from boss to aim point.
    ctx.save();
    ctx.strokeStyle = `rgba(160, 60, 220, ${ready ? 0.65 : 0.25})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (horizontal) {
    const h = boss.radius * 2 + 16;
    const lane = clampN(aimY - h / 2, 20, GROUND_Y - h - 10);
    ctx.fillStyle = `rgba(226, 58, 58, ${previewAlpha})`;
    ctx.fillRect(0, lane, WIDTH, h);
    ctx.strokeStyle = `rgba(180, 30, 30, ${ready ? 0.7 : 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(0, lane, WIDTH, h);
    ctx.setLineDash([]);
    // Direction arrow at lane center.
    const arrowDir = dx >= 0 ? "→ → →" : "← ← ←";
    ctx.fillStyle = `rgba(180, 30, 30, ${ready ? 0.85 : 0.4})`;
    ctx.font = "italic bold 26px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(arrowDir, WIDTH / 2, lane + h / 2);
    ctx.textBaseline = "alphabetic";
  } else {
    const w = boss.radius * 2 + 16;
    const lane = clampN(aimX - w / 2, 20, WIDTH - w - 20);
    ctx.fillStyle = `rgba(226, 58, 58, ${previewAlpha})`;
    ctx.fillRect(lane, 0, w, GROUND_Y);
    ctx.strokeStyle = `rgba(180, 30, 30, ${ready ? 0.7 : 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.strokeRect(lane, 0, w, GROUND_Y);
    ctx.setLineDash([]);
    const arrowChar = dy >= 0 ? "↓" : "↑";
    ctx.fillStyle = `rgba(180, 30, 30, ${ready ? 0.85 : 0.4})`;
    ctx.font = "italic bold 26px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(arrowChar, lane + w / 2, GROUND_Y * 0.4);
    ctx.fillText(arrowChar, lane + w / 2, GROUND_Y * 0.6);
  }

  // Reticle at aim point.
  const r = 18;
  ctx.strokeStyle = ready ? "#1f4ea8" : "rgba(31,78,168,0.45)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(aimX, aimY, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(aimX, aimY, r * 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(aimX - r * 1.5, aimY);
  ctx.lineTo(aimX - r * 0.6, aimY);
  ctx.moveTo(aimX + r * 0.6, aimY);
  ctx.lineTo(aimX + r * 1.5, aimY);
  ctx.moveTo(aimX, aimY - r * 1.5);
  ctx.lineTo(aimX, aimY - r * 0.6);
  ctx.moveTo(aimX, aimY + r * 0.6);
  ctx.lineTo(aimX, aimY + r * 1.5);
  ctx.stroke();
}

function drawBossModeHud(): void {
  // Kid hearts at the top — those are the "boss player's" target.
  ctx.save();
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "left";
  ctx.fillText("KID HP", 18, 56);
  for (let i = 0; i < 5; i++) {
    const hx = 22 + i * 24;
    const hy = 70;
    const filled = i < player.hp;
    ctx.fillStyle = filled ? "#e23a3a" : "rgba(0,0,0,0.15)";
    ctx.strokeStyle = "#7a1414";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx, hy + 4);
    ctx.bezierCurveTo(hx, hy - 6, hx - 12, hy - 6, hx - 12, hy + 4);
    ctx.bezierCurveTo(hx - 12, hy + 11, hx, hy + 17, hx, hy + 20);
    ctx.bezierCurveTo(hx, hy + 17, hx + 12, hy + 11, hx + 12, hy + 4);
    ctx.bezierCurveTo(hx + 12, hy - 6, hx, hy - 6, hx, hy + 4);
    ctx.fill();
    ctx.stroke();
  }
  if (currentBossId === "elemental") {
    ensureElementalBossButtons();
    for (const btn of uiButtons) {
      const e = btn.label.toLowerCase() as Element;
      const isElement = (ELEMENTS as readonly string[]).includes(e);
      if (!isElement) {
        drawCrayonButton(btn, false);
        continue;
      }
      const usable = isElementUsableInBossMode(e) && bossAbilityCooldown <= 0;
      ctx.save();
      if (!usable) ctx.globalAlpha = 0.3;
      drawCrayonButton(btn, usable);
      ctx.restore();
    }
    const phaseLabel = elementalPhase === 4 ? "MASTER · all four open" : `${ELEMENTS[elementalPhase]!.toUpperCase()} ONLY`;
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(phaseLabel, WIDTH / 2, HEIGHT - 80);
    ctx.fillStyle = "rgba(31,78,168,0.7)";
    ctx.font = "italic 13px 'Comic Sans MS', cursive";
    ctx.fillText("Move mouse in arena to aim · click an element to fire", WIDTH / 2, HEIGHT - 64);
    ctx.restore();
    return;
  }

  if (currentBossId === "mrpencil") {
    ensurePencilBossButtons();
    if (boss.phase === "ghost") {
      // Phase 2: single big "FIRE FISTS" button, no cooldown.
      for (const btn of uiButtons) {
        drawCrayonButton(btn, true);
      }
    } else if (boss.phase === "alive") {
      const ready = bossAbilityCooldown <= 0;
      for (const btn of uiButtons) {
        const isAction = btn.label === "MALLET" || btn.label === "SWORD" || btn.label === "SHIELD";
        ctx.save();
        if (isAction && !ready) ctx.globalAlpha = 0.45;
        const armedHighlight = btn.label === "MALLET" && pencilBossArmed === "mallet";
        drawCrayonButton(btn, armedHighlight ? true : isAction && ready);
        ctx.restore();
      }
      if (!ready) {
        ctx.fillStyle = "#1f4ea8";
        ctx.font = "italic 14px 'Comic Sans MS', cursive";
        ctx.textAlign = "center";
        ctx.fillText("Charging…", WIDTH / 2, HEIGHT - 80);
      } else if (pencilBossArmed === "mallet") {
        ctx.fillStyle = "#1f4ea8";
        ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
        ctx.textAlign = "center";
        ctx.fillText("Click anywhere in the arena to drop the mallet", WIDTH / 2, HEIGHT - 80);
      }
    }
    ctx.restore();
    return;
  }

  // Default boss-mode (Pac-Man) — cooldown bar + SPACE hint.
  const cdW = 220;
  const cdH = 14;
  const cdX = WIDTH - cdW - 20;
  const cdY = HEIGHT - 50;
  const ready = bossAbilityCooldown <= 0 && attacks.length === 0;
  ctx.fillStyle = "#fff";
  ctx.fillRect(cdX, cdY, cdW, cdH);
  ctx.fillStyle = ready ? "#3a6df0" : "rgba(160,80,200,0.7)";
  const fill = ready ? cdW : cdW * (1 - Math.min(1, bossAbilityCooldown / BOSS_ABILITY_COOLDOWN));
  ctx.fillRect(cdX, cdY, fill, cdH);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.strokeRect(cdX, cdY, cdW, cdH);
  ctx.fillStyle = "#222";
  ctx.font = "italic bold 12px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(ready ? "ABILITY READY" : "CHARGING…", cdX + cdW / 2, cdY - 4);

  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic 16px 'Comic Sans MS', cursive";
  ctx.textAlign = "right";
  const hint = boss.phase === "ghost"
    ? "← → ↑ ↓ aim laser   ·   SPACE fire"
    : "← → ↑ ↓ aim chomp   ·   SPACE fire";
  ctx.fillText(hint, WIDTH - 20, HEIGHT - 18);
  ctx.restore();
}

function drawCrayonButton(btn: UiButton, primary: boolean): void {
  ctx.save();
  ctx.fillStyle = primary ? "#ffd23a" : "#ffffff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    let bx, by;
    if (t < 0.25) {
      bx = btn.x + (t / 0.25) * btn.w;
      by = btn.y;
    } else if (t < 0.5) {
      bx = btn.x + btn.w;
      by = btn.y + ((t - 0.25) / 0.25) * btn.h;
    } else if (t < 0.75) {
      bx = btn.x + btn.w - ((t - 0.5) / 0.25) * btn.w;
      by = btn.y + btn.h;
    } else {
      bx = btn.x;
      by = btn.y + btn.h - ((t - 0.75) / 0.25) * btn.h;
    }
    bx += jitter(70000 + i + Math.floor(btn.x), 1.5);
    by += jitter(70100 + i + Math.floor(btn.y), 1.5);
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#222";
  ctx.font = "italic bold 26px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const labelY = btn.sub ? btn.y + btn.h / 2 - 10 : btn.y + btn.h / 2;
  ctx.fillText(btn.label, btn.x + btn.w / 2, labelY);
  if (btn.sub) {
    ctx.fillStyle = "rgba(34,34,34,0.7)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    ctx.fillText(btn.sub, btn.x + btn.w / 2, btn.y + btn.h / 2 + 14);
  }
  ctx.restore();
}

function drawBossWasHere(extra?: string): void {
  const info = BOSS_ROSTER.find((b) => b.id === currentBossId);
  const name = (info?.name ?? BOSS_NAME).toUpperCase();
  ctx.save();
  ctx.translate(WIDTH / 2, HEIGHT / 2 - 30);
  ctx.rotate(-0.04);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#fdf6d8";
  ctx.strokeText(`${name} WAS HERE`, 0, 0);
  ctx.fillText(`${name} WAS HERE`, 0, 0);
  if (extra) {
    ctx.font = "italic 20px 'Comic Sans MS', cursive";
    ctx.fillStyle = "#1f4ea8";
    ctx.fillText(extra, 0, 60);
  }
  ctx.restore();
}

function drawIntroScene(): void {
  drawBackground();
  drawPlatforms();
  // Eraser smudges where the boss usually stands, suggesting he just left.
  drawEraserSmudges(boss.homeX, boss.homeY, boss.radius * 1.1, 0.6);
  drawStickman();
  // Fade in and out the title text.
  const t = sceneTime;
  let alpha = 1;
  if (t < 0.2) alpha = t / 0.2;
  else if (t > 1.6) alpha = Math.max(0, 1 - (t - 1.6) / 0.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  drawBossWasHere("...but he's coming back. Get ready.");
  ctx.restore();
  if (sceneTime > 2.0) setScene("fight");
}

function drawWarmupScene(): void {
  drawBackground();
  drawPlatforms();
  drawEraserSmudges(boss.homeX, boss.homeY, boss.radius * 1.1, 0.6);
  drawStickman();
  drawBossWasHere("Warm up. Press SPACE when ready.");
  if (uiButtons.length === 0) {
    uiButtons.push({
      x: WIDTH / 2 - 110, y: HEIGHT - 100, w: 220, h: 56,
      label: "I'M READY",
      onClick: () => {
        resetFight();
        setScene("fight");
      },
    });
  }
  for (const b of uiButtons) drawCrayonButton(b, true);
}

function drawResultsScene(): void {
  drawArenaSnapshot();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.font = "italic bold 64px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  let title: string;
  if (bossMode) {
    title = gameState === "won" ? "THE KID IS TOAST!" : "THE KID DEFEATED YOU";
  } else {
    const bossLabel = (BOSS_ROSTER.find((b) => b.id === currentBossId)?.name ?? "PAC-MAN").toUpperCase();
    title = gameState === "won" ? `YOU BEAT ${bossLabel}!` : "GAME OVER";
  }
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 80);
  if (!bossMode && gameState === "won") {
    const bossLabel = (BOSS_ROSTER.find((b) => b.id === currentBossId)?.name ?? "PAC-MAN").toUpperCase();
    ctx.font = "italic 22px 'Comic Sans MS', cursive";
    ctx.fillText(`+100¢ · ${bossLabel} unlocked in BOSS MODE`, WIDTH / 2, HEIGHT / 2 - 30);
  }
  ctx.restore();

  if (uiButtons.length === 0) {
    const btnW = 240;
    const btnH = 80;
    const gap = 30;
    const totalW = btnW * 2 + gap;
    const startX = (WIDTH - totalW) / 2;
    const y = HEIGHT / 2 + 20;
    uiButtons.push({
      x: startX, y, w: btnW, h: btnH,
      label: "MAIN HUB",
      sub: "shop · modes · home",
      onClick: () => {
        bossMode = false;
        setScene("hub");
      },
    });
    if (bossMode) {
      uiButtons.push({
        x: startX + btnW + gap, y, w: btnW, h: btnH,
        label: "AGAIN",
        sub: "rematch as boss",
        onClick: () => {
          resetBossFight();
          setScene("fight");
        },
      });
    } else {
      const nextBoss = NEXT_BOSS[currentBossId];
      if (gameState === "won" && nextBoss) {
        uiButtons.push({
          x: startX + btnW + gap, y, w: btnW, h: btnH,
          label: "NEXT LEVEL",
          sub: "warm-up first",
          onClick: () => {
            currentBossId = nextBoss;
            setScene("warmup");
          },
        });
      } else {
        uiButtons.push({
          x: startX + btnW + gap, y, w: btnW, h: btnH,
          label: gameState === "won" ? "PLAY AGAIN" : "RETRY",
          sub: gameState === "won" ? "no more bosses (yet)" : "same level",
          onClick: () => setScene("warmup"),
        });
      }
    }
  }
  for (const b of uiButtons) drawCrayonButton(b, false);
}

function drawHubScene(): void {
  // Notebook background, hand-drawn title.
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 80, 80, 0.5)";
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(78, HEIGHT);
  ctx.stroke();

  ctx.save();
  ctx.translate(WIDTH / 2, 100);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("DRAWING BOSS MANIA", 0, 0);
  ctx.font = "italic 20px 'Comic Sans MS', cursive";
  ctx.fillText("Main Hub", 0, 36);
  ctx.restore();

  if (uiButtons.length === 0) {
    const btnW = 280;
    const btnH = 78;
    const startY = 200;
    const gap = 20;
    uiButtons.push({
      x: (WIDTH - btnW) / 2, y: startY, w: btnW, h: btnH,
      label: "PLAY",
      sub: "back to the fight",
      onClick: () => {
        resetFight();
        setScene("fight");
      },
    });
    uiButtons.push({
      x: (WIDTH - btnW) / 2, y: startY + (btnH + gap), w: btnW, h: btnH,
      label: "SHOP",
      sub: "buy stickman skins",
      onClick: () => setScene("shop"),
    });
    uiButtons.push({
      x: (WIDTH - btnW) / 2, y: startY + (btnH + gap) * 2, w: btnW, h: btnH,
      label: "BOSS MODE",
      sub: "you're the boss · AI plays the kid",
      onClick: () => setScene("bossmode"),
    });
  }
  for (const b of uiButtons) drawCrayonButton(b, b.label === "PLAY");
}

function drawSkinPreview(skin: Skin, cx: number, cy: number, scale: number): void {
  // Stickman portrait: head + torso, posed standing.
  const r = 22 * scale;
  const headY = cy - 50 * scale;
  // head
  crayonFillCircle(cx, headY, r, skin.skin, 90000 + skin.id.length);
  crayonCircle(cx, headY, r, skin.body, 3, 90050 + skin.id.length);
  // hair
  for (let i = 0; i < 5; i++) {
    const hx = cx - 14 * scale + i * 7 * scale;
    crayonLine(hx, headY - r + 2, hx + jitter(91000 + i + skin.id.length, 2), headY - r - 10 * scale, "#3a2618", 2.5, 91000 + i);
  }
  if (skin.sunglasses) {
    drawPixelatedShades(cx, headY - 2 * scale, 1);
  } else {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cx - 7 * scale, headY - 2, 3 * scale, 0, Math.PI * 2);
    ctx.arc(cx + 7 * scale, headY - 2, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // torso (shirt)
  const torsoTop = headY + r;
  const torsoH = 36 * scale;
  const torsoW = 36 * scale;
  scribbleFill(cx - torsoW / 2, torsoTop, torsoW, torsoH, skin.shirt, 92000 + skin.id.length);
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - torsoW / 2, torsoTop, torsoW, torsoH);
  // pants
  const pantsTop = torsoTop + torsoH;
  scribbleFill(cx - 14 * scale, pantsTop, 28 * scale, 26 * scale, skin.pants, 93000 + skin.id.length);
  // legs
  crayonLine(cx - 7 * scale, pantsTop + 26 * scale, cx - 14 * scale, pantsTop + 50 * scale, skin.body, 4, 94000);
  crayonLine(cx + 7 * scale, pantsTop + 26 * scale, cx + 14 * scale, pantsTop + 50 * scale, skin.body, 4, 94001);
  // shoes
  crayonFillCircle(cx - 14 * scale, pantsTop + 50 * scale, 5 * scale, skin.shoe, 95000);
  crayonFillCircle(cx + 14 * scale, pantsTop + 50 * scale, 5 * scale, skin.shoe, 95001);
}

function drawShopScene(): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // notebook lines
  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 80, 80, 0.5)";
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(78, HEIGHT);
  ctx.stroke();

  // title
  ctx.save();
  ctx.translate(WIDTH / 2, 80);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("SKIN SHOP", 0, 0);
  ctx.restore();

  // coins counter
  ctx.fillStyle = "#222";
  ctx.font = "italic bold 22px 'Comic Sans MS', cursive";
  ctx.textAlign = "right";
  ctx.fillText(`Coins: ${coins} ¢`, WIDTH - 40, 50);

  // skin cards
  const cardW = 240;
  const cardH = 320;
  const totalW = cardW * SKINS.length + 30 * (SKINS.length - 1);
  const startX = (WIDTH - totalW) / 2;
  const cardY = 130;

  if (uiButtons.length === 0) {
    SKINS.forEach((sk, i) => {
      const cardX = startX + i * (cardW + 30);
      const owned = ownedSkins.has(sk.id);
      const equipped = equippedSkinId === sk.id;
      const canBuy = !owned && coins >= sk.price;
      const btnW = cardW - 40;
      uiButtons.push({
        x: cardX + 20,
        y: cardY + cardH - 64,
        w: btnW,
        h: 48,
        label: equipped ? "EQUIPPED" : owned ? "EQUIP" : canBuy ? `BUY · ${sk.price}¢` : `NEED ${sk.price - coins}¢`,
        onClick: () => {
          if (equipped) return;
          if (owned) {
            equippedSkinId = sk.id;
            saveProgression();
            uiButtons = [];
            return;
          }
          if (canBuy) {
            coins -= sk.price;
            ownedSkins.add(sk.id);
            equippedSkinId = sk.id;
            saveProgression();
            uiButtons = [];
          }
        },
      });
    });
    uiButtons.push({
      x: 40, y: HEIGHT - 80, w: 200, h: 56,
      label: "← BACK",
      onClick: () => setScene("hub"),
    });
  }

  // draw cards
  SKINS.forEach((sk, i) => {
    const cardX = startX + i * (cardW + 30);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    drawSkinPreview(sk, cardX + cardW / 2, cardY + 130, 1.6);

    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic bold 22px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(sk.name, cardX + cardW / 2, cardY + 198);

    ctx.fillStyle = "rgba(34,34,34,0.75)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    wrapText(sk.blurb, cardX + 18, cardY + 222, cardW - 36, 18);

    if (equippedSkinId === sk.id) {
      ctx.save();
      ctx.translate(cardX + cardW - 40, cardY + 30);
      ctx.rotate(0.2);
      ctx.fillStyle = "#3a6df0";
      ctx.font = "italic bold 16px 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.fillText("WORN", 0, 0);
      ctx.restore();
    }
  });

  for (const b of uiButtons) {
    drawCrayonButton(b, b.label.startsWith("BUY") || b.label === "EQUIP");
  }
}

function wrapText(text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x + maxW / 2, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x + maxW / 2, yy);
}

function drawBossModeSelectScene(): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 80, 80, 0.5)";
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(78, HEIGHT);
  ctx.stroke();

  ctx.save();
  ctx.translate(WIDTH / 2, 80);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("BOSS MODE", 0, 0);
  ctx.font = "italic 18px 'Comic Sans MS', cursive";
  ctx.fillText("Play as a boss you've beaten. The kid is the AI now.", 0, 30);
  ctx.restore();

  const cardW = 240;
  const cardH = 270;
  const gap = 24;
  const cardY = 130;
  const padding = 40;
  const totalContentW = cardW * BOSS_ROSTER.length + gap * (BOSS_ROSTER.length - 1);
  const visibleW = WIDTH - padding * 2;
  const scrollMax = Math.max(0, totalContentW - visibleW);
  bossModeScrollX = clampN(bossModeScrollX, 0, scrollMax);

  // Rebuild buttons each frame so positions track scroll.
  uiButtons = [];
  BOSS_ROSTER.forEach((b, i) => {
    const cardX = padding + i * (cardW + gap) - bossModeScrollX;
    const unlocked = beatenBosses.has(b.id);
    uiButtons.push({
      x: cardX + 16,
      y: cardY + cardH - 60,
      w: cardW - 32,
      h: 48,
      label: unlocked ? "PLAY AS BOSS" : "LOCKED",
      sub: unlocked ? undefined : "Beat in story",
      onClick: () => {
        if (!unlocked) return;
        bossModeBossId = b.id;
        currentBossId = b.id;
        resetBossFight();
        setScene("fight");
      },
    });
  });
  if (scrollMax > 0) {
    uiButtons.push({
      x: 12, y: cardY + cardH / 2 - 28, w: 36, h: 56,
      label: "◀",
      onClick: () => { bossModeScrollX = Math.max(0, bossModeScrollX - (cardW + gap)); },
    });
    uiButtons.push({
      x: WIDTH - 48, y: cardY + cardH / 2 - 28, w: 36, h: 56,
      label: "▶",
      onClick: () => { bossModeScrollX = Math.min(scrollMax, bossModeScrollX + (cardW + gap)); },
    });
  }
  // Difficulty picker — 1 (easy) to 10 (hard).
  const cellW = 50;
  const cellH = 46;
  const totalDiffW = cellW * 10;
  const startDiffX = (WIDTH - totalDiffW) / 2;
  const diffY = HEIGHT - 168;
  for (let i = 1; i <= 10; i++) {
    const cx = startDiffX + (i - 1) * cellW;
    uiButtons.push({
      x: cx + 3,
      y: diffY,
      w: cellW - 6,
      h: cellH,
      label: String(i),
      onClick: () => {
        bossModeDifficulty = i;
        saveDifficulty();
      },
    });
  }
  uiButtons.push({
    x: 40, y: HEIGHT - 80, w: 200, h: 56,
    label: "← BACK",
    onClick: () => setScene("hub"),
  });
  uiButtons.push({
    x: WIDTH - 240, y: HEIGHT - 80, w: 200, h: 56,
    label: "BOSS CREATOR",
    sub: "draw your own",
    onClick: () => setScene("bosscreator"),
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(padding - 12, cardY - 12, visibleW + 24, cardH + 24);
  ctx.clip();
  BOSS_ROSTER.forEach((b, i) => {
    const cardX = padding + i * (cardW + gap) - bossModeScrollX;
    if (cardX + cardW < padding - 20 || cardX > WIDTH - padding + 20) return;
    const unlocked = beatenBosses.has(b.id) || b.id === "custom";
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    const portraitCx = cardX + cardW / 2;
    const portraitCy = cardY + 90;
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.25;
    drawBossCardPortrait(b.id, portraitCx, portraitCy, 0.95);
    ctx.restore();

    if (!unlocked) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.fillStyle = "#222";
      ctx.font = "bold 60px 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒", portraitCx, portraitCy);
      ctx.restore();
    }

    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic bold 20px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(b.name, portraitCx, cardY + 175);

    ctx.fillStyle = "rgba(34,34,34,0.75)";
    ctx.font = "italic 13px 'Comic Sans MS', cursive";
    wrapText(b.blurb, cardX + 14, cardY + 198, cardW - 28, 16);
  });
  ctx.restore();

  if (scrollMax > 0) {
    const trackY = cardY + cardH + 6;
    const trackX = padding;
    const trackW = visibleW;
    ctx.fillStyle = "rgba(34,34,34,0.18)";
    ctx.fillRect(trackX, trackY, trackW, 6);
    const handleW = Math.max(40, trackW * (visibleW / totalContentW));
    const handleX = trackX + (trackW - handleW) * (bossModeScrollX / scrollMax);
    ctx.fillStyle = "#1f4ea8";
    ctx.fillRect(handleX, trackY, handleW, 6);
  }

  // Difficulty label.
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 22px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(`KID DIFFICULTY  ·  ${bossModeDifficulty} / 10`, WIDTH / 2, HEIGHT - 184);
  ctx.fillStyle = "rgba(34,34,34,0.65)";
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "left";
  ctx.fillText("EASY", (WIDTH - 500) / 2 - 6, HEIGHT - 100);
  ctx.textAlign = "right";
  ctx.fillText("HARD", (WIDTH + 500) / 2 + 6, HEIGHT - 100);

  for (const btn of uiButtons) {
    const isDiffBtn = /^\d+$/.test(btn.label);
    const selected = isDiffBtn && parseInt(btn.label, 10) === bossModeDifficulty;
    drawCrayonButton(btn, btn.label === "PLAY AS BOSS" || selected);
  }
}


function drawBossCreatorScene(): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 36px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("BOSS CREATOR", WIDTH / 2, 50);
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.fillText("Draw both phases. Type a name and an attack description — the AI maps it to abilities.", WIDTH / 2, 76);

  // Draw pads.
  for (const phase of [1, 2] as const) {
    const r = bossCreatorPadRect(phase);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 3;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(phase === 1 ? customBossPad1 : customBossPad2, r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic bold 18px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(`PHASE ${phase}`, r.x + r.w / 2, r.y - 8);
  }

  // Field labels — the actual inputs are real DOM elements positioned over canvas.
  const nameY = 360;
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "left";
  ctx.fillText("NAME", 64, nameY - 6);

  const attackY = 426;
  ctx.fillStyle = "#1f4ea8";
  ctx.fillText("ATTACK DESCRIPTION  (parser keys off words like fire, laser, rock, water, sword, hammer, shield, slime, fist…)", 64, attackY - 6);

  // Show the real inputs when the help overlay isn't open.
  positionBossCreatorInputs(!cbHelpOpen);

  // Buttons.
  uiButtons = [];
  uiButtons.push({
    x: 60, y: HEIGHT - 60, w: 60, h: 36,
    label: "CLR1",
    onClick: () => { customBossPad1Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD); customBoss.hasPhase1 = false; },
  });
  uiButtons.push({
    x: 130, y: HEIGHT - 60, w: 60, h: 36,
    label: "CLR2",
    onClick: () => { customBossPad2Ctx.clearRect(0, 0, CUSTOM_BOSS_PAD, CUSTOM_BOSS_PAD); customBoss.hasPhase2 = false; },
  });
  uiButtons.push({
    x: WIDTH / 2 - 220, y: HEIGHT - 60, w: 200, h: 44,
    label: "SAVE BOSS",
    onClick: () => saveCustomBoss(),
  });
  uiButtons.push({
    x: WIDTH / 2 + 20, y: HEIGHT - 60, w: 200, h: 44,
    label: "DELETE",
    onClick: () => deleteCustomBoss(),
  });
  uiButtons.push({
    x: WIDTH - 200, y: HEIGHT - 60, w: 160, h: 44,
    label: "← BACK",
    onClick: () => setScene("bossmode"),
  });
  // Help button at top-right.
  uiButtons.push({
    x: WIDTH - 70, y: 14, w: 50, h: 50,
    label: "?",
    onClick: () => { cbHelpOpen = !cbHelpOpen; cbHelpScroll = 0; },
  });

  for (const b of uiButtons) {
    if (b.label.startsWith("__field_")) continue;
    drawCrayonButton(b, b.label === "SAVE BOSS" || (b.label === "?" && cbHelpOpen));
  }

  if (cbHelpOpen) drawBossCreatorHelp();
}

function drawBossCreatorHelp(): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const panelX = 60;
  const panelY = 50;
  const panelW = WIDTH - 120;
  const panelH = HEIGHT - 100;
  ctx.fillStyle = "#fdf6d8";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 4;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeRect(panelX, panelY, panelW, panelH);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 28px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("BOSS DESCRIPTION HELP", WIDTH / 2, panelY + 38);

  const lines: string[] = [
    "ATTACKS:",
    "  fire / flame / burn  →  fire patches that burn the ground",
    "  laser / beam / ray   →  short straight red lines (\"100 pixel\" sets length)",
    "  rock / earth / boulder  →  arcing rock projectiles",
    "  water / flood / wave  →  rising arena-wide flood (drown timer)",
    "  wind / air / lift / gust  →  air patch that flings the kid into the sky",
    "  sword / slash         →  sweeping blade",
    "  hammer / smash        →  hammer slam with shockwaves",
    "  shield / block        →  bubble that absorbs hits",
    "  slime / blob / ooze   →  one-shot eating slime",
    "  fist / punch          →  flying pointing-hand projectiles",
    "  tornado / cyclone / vortex  →  swirling vortex that sweeps the arena",
    "  fireball              →  arcing homing-ish fireball",
    "",
    "MODIFIERS:",
    "  lava                  →  flood / tornado deal contact damage instead of drown",
    "  platform / platforms  →  add the platform layout to your arena",
    "  (number) px / pixel   →  sets laser length, e.g., \"100 pixel red laser\"",
    "  no platforms          →  force no platforms",
    "",
    "DISGUISES (combine words):",
    "  \"flood of fists\"      →  fist barrage in waves",
    "  \"fire tornado\"        →  themed flame tornado",
    "  \"lava tornado\"        →  themed lava tornado",
    "",
    "EMOJIS:",
    "  Drop emojis in your description (❤️ 🔒 🔥 etc.) and they'll appear",
    "  as visual decorations on the floods.",
    "",
    "Tip: combine multiple keywords for variety. Save and the boss rotates",
    "between everything that matched.",
    "",
    "Scroll the wheel to see more — close with the ? button.",
  ];

  // Scrollable text area inside the panel (below title, above footer).
  const textTop = panelY + 60;
  const textBottom = panelY + panelH - 30;
  const textHeight = textBottom - textTop;
  const lineH = 18;
  const contentH = lines.length * lineH;
  const maxScroll = Math.max(0, contentH - textHeight);
  cbHelpScroll = Math.max(0, Math.min(maxScroll, cbHelpScroll));

  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX + 4, textTop, panelW - 8, textHeight);
  ctx.clip();
  ctx.font = "italic 14px 'Comic Sans MS', cursive";
  ctx.fillStyle = "#222";
  ctx.textAlign = "left";
  for (let i = 0; i < lines.length; i++) {
    const y = textTop + i * lineH + 14 - cbHelpScroll;
    if (y < textTop - lineH || y > textBottom + lineH) continue;
    ctx.fillText(lines[i]!, panelX + 24, y);
  }
  ctx.restore();

  // Scroll indicator on the right edge of the panel.
  if (maxScroll > 0) {
    const trackX = panelX + panelW - 14;
    const trackY = textTop;
    const trackW = 6;
    const trackH = textHeight;
    ctx.fillStyle = "rgba(34,34,34,0.18)";
    ctx.fillRect(trackX, trackY, trackW, trackH);
    const handleH = Math.max(30, trackH * (textHeight / contentH));
    const handleY = trackY + (trackH - handleH) * (cbHelpScroll / maxScroll);
    ctx.fillStyle = "#1f4ea8";
    ctx.fillRect(trackX, handleY, trackW, handleH);
  }

  ctx.fillStyle = "rgba(34,34,34,0.6)";
  ctx.font = "italic 13px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("Click ? again to close · scroll to read more", WIDTH / 2, panelY + panelH - 12);
  ctx.restore();
}


function drawComingSoonScene(title: string, blurb: string): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(WIDTH / 2, 130);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 60px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(title, 0, 0);
  ctx.restore();

  ctx.fillStyle = "#222";
  ctx.font = "italic 22px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText(blurb, WIDTH / 2, 240);
  ctx.fillStyle = "rgba(34,34,34,0.6)";
  ctx.fillText("Coming soon. The kid is still drawing it.", WIDTH / 2, 280);

  if (uiButtons.length === 0) {
    uiButtons.push({
      x: WIDTH / 2 - 120, y: HEIGHT - 130, w: 240, h: 64,
      label: "← BACK TO HUB",
      onClick: () => setScene("hub"),
    });
  }
  for (const b of uiButtons) drawCrayonButton(b, false);
}

function tickAutoClicker(dt: number): void {
  // 4 + 7 chord toggles auto-clicker. Re-arm only after the chord is released
  // so holding both keys doesn't flicker the toggle on/off.
  const both = (keys.has("4") || keys.has("Numpad4")) && (keys.has("7") || keys.has("Numpad7"));
  if (both && chordToggleArmed) {
    autoClicker = !autoClicker;
    chordToggleArmed = false;
  }
  if (!both) chordToggleArmed = true;

  if (!autoClicker) {
    autoClickAcc = 0;
    return;
  }

  // Speed adjust: '-' slows, '=' (or '+') speeds up.
  if (keys.has("-") || keys.has("_")) {
    autoClickRate = Math.max(1, autoClickRate - dt * 8);
  }
  if (keys.has("=") || keys.has("+")) {
    autoClickRate = Math.min(40, autoClickRate + dt * 8);
  }

  autoClickAcc += dt;
  const interval = 1 / autoClickRate;
  let safety = 0;
  while (autoClickAcc >= interval && safety < 50) {
    autoClickAcc -= interval;
    handleClickAt(mouseArenaX, mouseArenaY);
    safety++;
  }
}

function drawAutoClickerIndicator(): void {
  if (!autoClicker) return;
  ctx.save();
  const x = 16;
  const y = HEIGHT - 24;
  ctx.fillStyle = "rgba(31, 78, 168, 0.85)";
  ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
  ctx.textAlign = "left";
  ctx.fillText(`AUTO-CLICK · ${autoClickRate.toFixed(1)}/s   [-/=]`, x, y);
  ctx.restore();
}

function drawPauseButton(): void {
  ctx.save();
  // Wobbly crayon-style square with two pause bars.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const segs = 18;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    let bx, by;
    if (t < 0.25) { bx = PAUSE_BTN_X + (t / 0.25) * PAUSE_BTN_W; by = PAUSE_BTN_Y; }
    else if (t < 0.5) { bx = PAUSE_BTN_X + PAUSE_BTN_W; by = PAUSE_BTN_Y + ((t - 0.25) / 0.25) * PAUSE_BTN_H; }
    else if (t < 0.75) { bx = PAUSE_BTN_X + PAUSE_BTN_W - ((t - 0.5) / 0.25) * PAUSE_BTN_W; by = PAUSE_BTN_Y + PAUSE_BTN_H; }
    else { bx = PAUSE_BTN_X; by = PAUSE_BTN_Y + PAUSE_BTN_H - ((t - 0.75) / 0.25) * PAUSE_BTN_H; }
    bx += jitter(96000 + i, 1);
    by += jitter(96100 + i, 1);
    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#222";
  const barW = 6;
  const barH = 22;
  const cx = PAUSE_BTN_X + PAUSE_BTN_W / 2;
  const cy = PAUSE_BTN_Y + PAUSE_BTN_H / 2;
  ctx.fillRect(cx - 9 - barW / 2, cy - barH / 2, barW, barH);
  ctx.fillRect(cx + 9 - barW / 2, cy - barH / 2, barW, barH);
  ctx.restore();
}

function drawPauseOverlay(): void {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("GAME IS PAUSED", WIDTH / 2, 130);
  for (const btn of pauseUiButtons) drawCrayonButton(btn, btn.label === "RESUME");
  ctx.restore();
}

function drawLevelSelectScene(): void {
  ctx.fillStyle = "#fdf6d8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "rgba(120, 160, 210, 0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < HEIGHT; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220, 80, 80, 0.5)";
  ctx.beginPath();
  ctx.moveTo(78, 0);
  ctx.lineTo(78, HEIGHT);
  ctx.stroke();

  ctx.save();
  ctx.translate(WIDTH / 2, 90);
  ctx.rotate(-0.03);
  ctx.fillStyle = "#1f4ea8";
  ctx.font = "italic bold 56px 'Comic Sans MS', cursive";
  ctx.textAlign = "center";
  ctx.fillText("SELECT LEVEL", 0, 0);
  ctx.restore();

  const cardW = 260;
  const cardH = 280;
  const gap = 30;
  const cardY = 160;
  const padding = 40;
  const totalContentW = cardW * BOSS_ROSTER.length + gap * (BOSS_ROSTER.length - 1);
  const visibleW = WIDTH - padding * 2;
  const scrollMax = Math.max(0, totalContentW - visibleW);
  levelSelectScrollX = clampN(levelSelectScrollX, 0, scrollMax);

  // Rebuild buttons each frame so their hitboxes track the scroll offset.
  uiButtons = [];
  BOSS_ROSTER.forEach((b, i) => {
    const cardX = padding + i * (cardW + gap) - levelSelectScrollX;
    uiButtons.push({
      x: cardX + 20,
      y: cardY + cardH - 64,
      w: cardW - 40,
      h: 52,
      label: `LEVEL ${i + 1}`,
      sub: b.name,
      onClick: () => {
        currentBossId = b.id;
        bossMode = false;
        resetFight();
        setScene("warmup");
      },
    });
  });
  uiButtons.push({
    x: 40, y: HEIGHT - 80, w: 200, h: 56,
    label: "← BACK",
    onClick: () => setScene("hub"),
  });
  if (scrollMax > 0) {
    uiButtons.push({
      x: 12, y: cardY + cardH / 2 - 28, w: 36, h: 56,
      label: "◀",
      onClick: () => { levelSelectScrollX = Math.max(0, levelSelectScrollX - (cardW + gap)); },
    });
    uiButtons.push({
      x: WIDTH - 48, y: cardY + cardH / 2 - 28, w: 36, h: 56,
      label: "▶",
      onClick: () => { levelSelectScrollX = Math.min(scrollMax, levelSelectScrollX + (cardW + gap)); },
    });
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(padding - 12, cardY - 12, visibleW + 24, cardH + 24);
  ctx.clip();
  BOSS_ROSTER.forEach((b, i) => {
    const cardX = padding + i * (cardW + gap) - levelSelectScrollX;
    if (cardX + cardW < padding - 20 || cardX > WIDTH - padding + 20) return;
    const beaten = beatenBosses.has(b.id);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 4;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    const portraitCx = cardX + cardW / 2;
    const portraitCy = cardY + 100;
    ctx.save();
    drawBossCardPortrait(b.id, portraitCx, portraitCy, 1);
    ctx.restore();

    ctx.fillStyle = "#1f4ea8";
    ctx.font = "italic bold 22px 'Comic Sans MS', cursive";
    ctx.textAlign = "center";
    ctx.fillText(b.name, portraitCx, cardY + 180);

    ctx.fillStyle = "rgba(34,34,34,0.7)";
    ctx.font = "italic 14px 'Comic Sans MS', cursive";
    wrapText(b.blurb, cardX + 18, cardY + 204, cardW - 36, 18);

    if (beaten) {
      ctx.save();
      ctx.translate(cardX + cardW - 36, cardY + 26);
      ctx.rotate(0.18);
      ctx.fillStyle = "#3a6df0";
      ctx.font = "italic bold 14px 'Comic Sans MS', cursive";
      ctx.textAlign = "center";
      ctx.fillText("CLEARED", 0, 0);
      ctx.restore();
    }
  });
  ctx.restore();

  // Scrollbar at bottom of card area.
  if (scrollMax > 0) {
    const trackY = cardY + cardH + 8;
    const trackX = padding;
    const trackW = visibleW;
    ctx.fillStyle = "rgba(34,34,34,0.18)";
    ctx.fillRect(trackX, trackY, trackW, 6);
    const handleW = Math.max(40, trackW * (visibleW / totalContentW));
    const handleX = trackX + (trackW - handleW) * (levelSelectScrollX / scrollMax);
    ctx.fillStyle = "#1f4ea8";
    ctx.fillRect(handleX, trackY, handleW, 6);
  }

  for (const b of uiButtons) {
    drawCrayonButton(b, b.label.startsWith("LEVEL"));
  }
}

function frame(timestamp: number): void {
  const dtRaw = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
  lastTimestamp = timestamp;
  const dt = paused ? 0 : dtRaw;
  if (!paused) sceneTime += dt;

  ctx.save();
  if (screenShake > 0.5) {
    ctx.translate(jitter(99000, screenShake), jitter(99001, screenShake));
  }

  if (scene === "fight") {
    if (!paused) {
      if (bossMode) updateBossFight(dt);
      else update(dt);
    }
    drawArenaSnapshot();
    if (gameState !== "playing") {
      if (!bossMode && gameState === "won") {
        recordBossBeaten(currentBossId);
      }
      setScene("results");
    }
  } else if (scene === "intro") {
    drawIntroScene();
  } else if (scene === "warmup") {
    drawWarmupScene();
  } else if (scene === "results") {
    drawResultsScene();
  } else if (scene === "hub") {
    drawHubScene();
  } else if (scene === "shop") {
    drawShopScene();
  } else if (scene === "bossmode") {
    drawBossModeSelectScene();
  } else if (scene === "levelselect") {
    drawLevelSelectScene();
  } else if (scene === "bosscreator") {
    drawBossCreatorScene();
  } else if (scene === "obby") {
    if (!paused) updateObby(dt);
    drawObby();
  }

  if (!paused) tickAutoClicker(dtRaw);
  if (pauseButtonVisible()) drawPauseButton();
  drawAutoClickerIndicator();
  if (paused) drawPauseOverlay();

  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame((timestamp) => {
  lastTimestamp = timestamp;
  frame(timestamp);
});
