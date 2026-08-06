import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();
installForceRefreshHotkey();

type Operation = "multiply" | "add" | "subtract";
type CustomOperation = Operation | "divide";
type Mode = "lobby" | "quiz" | "shop" | "lounge" | "cafe" | "cafeJob" | "equationLibrary" | "equationClash" | "blackHole";
type GradeLevel = "first" | "fourth";
type CafeIngredient = "coffee" | "milk" | "foam" | "tuna";
type ShopCategory = "skin" | "collar" | "outfit";

interface Problem {
  left: number;
  right: number;
  operation: CustomOperation;
  answer: number;
  choices: number[];
  revealAnswer?: boolean;
}

interface SaveData {
  coins: number;
  correctCount: number;
  streak: number;
  askBeforeAnswer: boolean;
  loungeUnlocked: boolean;
  cafeTutorialSeen: boolean;
  customEquations: CustomEquation[];
  owned: Record<ShopCategory, string[]>;
  equipped: Record<ShopCategory, string>;
}

interface CustomEquation {
  left: number;
  right: number;
  operation: CustomOperation;
}

interface CafeOrder {
  name: string;
  ingredients: CafeIngredient[];
}

interface CafeCustomer {
  fur: string;
  accent: string;
  scale: number;
  glasses: boolean;
  order: CafeOrder;
}

interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  cost: number;
  color?: string;
  accent?: string;
}

interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  onClick: () => void;
  onHold?: () => void;
}

interface CatInteractionState {
  jumpStartedAt: number;
  jumpUntil: number;
  purrUntil: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  type: "coin" | "heart" | "sparkle";
}

const canvasElement = document.getElementById("game");
if (!(canvasElement instanceof HTMLCanvasElement)) {
  throw new Error("Missing Cat Math canvas");
}
const canvas: HTMLCanvasElement = canvasElement;

const canvasContext = canvas.getContext("2d");
if (!(canvasContext instanceof CanvasRenderingContext2D)) {
  throw new Error("Missing Cat Math canvas context");
}
const ctx: CanvasRenderingContext2D = canvasContext;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const STORAGE_KEY = "cat-math-save-v1";
const SIX_TIMES_SEVEN_SEEN_KEY = "cat-math-6x7-seen-v1";
const MIN_CLASH_EQUATIONS = 10;
const MAX_CUSTOM_EQUATIONS = 10;
const ALL_THE_MONEY_IN_THE_WORLD = 100_000_000_000_000;

const shopItems: ShopItem[] = [
  { id: "black", name: "Black Cat", category: "skin", cost: 0, color: "#08070a", accent: "#1a111d" },
  { id: "gray", name: "Storm Gray", category: "skin", cost: 8, color: "#6f6f7d", accent: "#a4a4b2" },
  { id: "orange", name: "Pumpkin", category: "skin", cost: 10, color: "#d87934", accent: "#f4b16c" },
  { id: "snow", name: "Snow Puff", category: "skin", cost: 12, color: "#f4edf7", accent: "#d3c5df" },
  { id: "tuxedo", name: "Tuxedo", category: "skin", cost: 16, color: "#09080b", accent: "#f4edf7" },
  { id: "lavender", name: "Lavender", category: "skin", cost: 20, color: "#a77bda", accent: "#ead7ff" },
  { id: "none", name: "No Collar", category: "collar", cost: 0 },
  { id: "pink", name: "Pink Collar", category: "collar", cost: 5, color: "#ff8fd8" },
  { id: "gold", name: "Gold Collar", category: "collar", cost: 8, color: "#ffd35c" },
  { id: "star", name: "Star Collar", category: "collar", cost: 12, color: "#7fd6ff" },
  { id: "plain", name: "No Outfit", category: "outfit", cost: 0 },
  { id: "bow", name: "Bow Tie", category: "outfit", cost: 6, color: "#ff6fb2" },
  { id: "nerd-glasses", name: "Nerd Glasses", category: "outfit", cost: 10, color: "#24152d" },
  { id: "cape", name: "Royal Cape", category: "outfit", cost: 14, color: "#7c44c8" },
  { id: "raincoat", name: "Raincoat", category: "outfit", cost: 16, color: "#ffd84f" },
];

const categoryLabels: Record<ShopCategory, string> = {
  skin: "Skins",
  collar: "Collars",
  outfit: "Outfits",
};

let save = loadSave();
let selectedGrade: GradeLevel = "first";
let currentProblem = createProblem();
let mode: Mode = "lobby";
let shopReturnMode: "lobby" | "quiz" = "lobby";
let shopCategory: ShopCategory = "skin";
let message = "Ready?";
let messageUntil = 0;
let lockedUntil = 0;
let nextProblemAt = 0;
let cheerUntil = 0;
let lastTimestamp = 0;
let hotspots: Hotspot[] = [];
let particles: Particle[] = [];
let pendingAnswer: number | null = null;
let dontAskAgain = false;
let previewEquipped: Partial<Record<ShopCategory, string>> = {};
let creatorLeft = 9;
let creatorRight = 10;
let creatorOperation: CustomOperation = "add";
let loungeNotice = "";
let loungeNoticeUntil = 0;
let clashProblems: Problem[] = [];
let clashIndex = 0;
let blackHoleStartedAt = 0;
let blackHoleExitStarted = false;
let cafeNotice = "Welcome to the Cat Cafe!";
let cafeNoticeUntil = 0;
const catInteractionStates = new Map<string, CatInteractionState>();
let activePress: { hotspot: Hotspot; pointerId: number; held: boolean; timer: number } | null = null;
let purrAudio: { oscillator: OscillatorNode; rumble: OscillatorNode; gain: GainNode } | null = null;
let catAudioContext: AudioContext | null = null;
let activePurringCat: string | null = null;
let cafeJobTutorialOpen = false;
let cafeCustomer: CafeCustomer | null = null;
let cafeCustomerX = -100;
let cafeCustomerLeaving = false;
let cafeCup: CafeIngredient[] = [];
let cafeJobNotice = "";
let cafeJobNoticeUntil = 0;

canvas.addEventListener("pointerdown", (event) => {
  if (mode === "blackHole") return;
  canvas.focus();
  const point = getCanvasPoint(event);
  const hit = findHotspot(point.x, point.y);
  if (hit) {
    if (hit.onHold) {
      prepareCatAudio();
      const press = {
        hotspot: hit,
        pointerId: event.pointerId,
        held: false,
        timer: window.setTimeout(() => {
          if (activePress !== press) return;
          press.held = true;
          hit.onHold?.();
        }, 500),
      };
      activePress = press;
      canvas.setPointerCapture(event.pointerId);
    } else {
      hit.onClick();
    }
  }
});

canvas.addEventListener("pointerup", finishCanvasPress);
canvas.addEventListener("pointercancel", finishCanvasPress);

function finishCanvasPress(event: PointerEvent): void {
  if (!activePress || activePress.pointerId !== event.pointerId) return;
  window.clearTimeout(activePress.timer);
  if (activePress.held) {
    stopCatPurr();
  } else {
    activePress.hotspot.onClick();
  }
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  activePress = null;
}

canvas.addEventListener("keydown", (event) => {
  if (pendingAnswer !== null) {
    if (event.key === "Escape" || event.key.toLowerCase() === "n") {
      closeAnswerConfirmation();
    } else if (event.key === "Enter" || event.key.toLowerCase() === "y") {
      confirmPendingAnswer();
    }
    return;
  }

  if (mode === "shop" && event.key === "Escape") {
    previewEquipped = {};
    mode = shopReturnMode;
    return;
  }

  if (mode === "quiz" && event.key === "Escape") {
    mode = "lobby";
    return;
  }

  if (mode === "lobby" && (event.key === "Enter" || event.key === " ")) {
    currentProblem = createProblem();
    mode = "quiz";
    return;
  }

  if ((mode === "lounge" || mode === "cafe" || mode === "equationLibrary") && event.key === "Escape") {
    mode = mode === "equationLibrary" ? "lounge" : "lobby";
    return;
  }

  if (mode === "equationClash" && event.key === "Escape") {
    leaveEquationClash();
    return;
  }

  if (mode === "cafeJob" && event.key === "Escape") {
    mode = cafeJobTutorialOpen ? "cafeJob" : "cafe";
    cafeJobTutorialOpen = false;
    return;
  }

  if (mode !== "quiz" && mode !== "equationClash") return;
  const index = Number(event.key) - 1;
  const choice = currentProblem.choices[index];
  if (Number.isInteger(index) && choice !== undefined) {
    chooseAnswer(choice);
  }
});

requestAnimationFrame(loop);

function loop(timestamp: number): void {
  const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.04);
  lastTimestamp = timestamp;
  update(deltaSeconds, timestamp);
  render(timestamp);
  requestAnimationFrame(loop);
}

function update(deltaSeconds: number, timestamp: number): void {
  if (mode === "blackHole" && timestamp - blackHoleStartedAt >= 2600 && !blackHoleExitStarted) {
    blackHoleExitStarted = true;
    window.location.assign(new URL("../../penelope/index.html", window.location.href).toString());
    return;
  }


  if (mode === "cafeJob" && !cafeJobTutorialOpen) {
    updateCafeJob(deltaSeconds);
  }

  if (nextProblemAt > 0 && timestamp >= nextProblemAt) {
    if (mode === "equationClash") {
      clashIndex += 1;
      if (clashIndex >= clashProblems.length) {
        mode = "lounge";
        loungeNotice = "Equation Clash complete!";
        loungeNoticeUntil = timestamp + 1800;
        currentProblem = createProblem();
      } else {
        currentProblem = clashProblems[clashIndex]!;
      }
    } else {
      currentProblem = createProblem();
    }
    nextProblemAt = 0;
  }

  particles = particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * deltaSeconds,
      y: particle.y + particle.vy * deltaSeconds,
      vy: particle.vy + 280 * deltaSeconds,
      life: particle.life - deltaSeconds,
    }))
    .filter((particle) => particle.life > 0);
}

function render(timestamp: number): void {
  hotspots = [];
  drawBackground();

  if (mode === "blackHole") {
    drawBlackHole(timestamp);
  } else if (mode === "shop") {
    drawShop(timestamp);
  } else if (mode === "lobby") {
    drawLobby(timestamp);
  } else if (mode === "lounge") {
    drawLounge(timestamp);
  } else if (mode === "cafe") {
    drawCatCafe(timestamp);
  } else if (mode === "cafeJob") {
    drawCafeJob(timestamp);
  } else if (mode === "equationLibrary") {
    drawEquationLibrary(timestamp);
  } else if (mode === "equationClash") {
    drawEquationClash(timestamp);
  } else {
    drawQuiz(timestamp);
  }

  if (pendingAnswer !== null) {
    hotspots = [];
    drawAnswerConfirmation();
  }

  drawParticles();
}

function drawBackground(): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#ffeaff");
  sky.addColorStop(0.54, "#f3ccff");
  sky.addColorStop(1, "#d8a6f6");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 137) % WIDTH;
    const y = (i * 83) % 420;
    drawStar(x + 18, y + 22, 7 + (i % 3) * 2, "rgba(255, 211, 92, 0.42)");
  }

  ctx.fillStyle = "#cf8fe8";
  ctx.fillRect(0, HEIGHT - 94, WIDTH, 94);
  ctx.fillStyle = "rgba(45, 19, 68, 0.12)";
  ctx.fillRect(0, HEIGHT - 94, WIDTH, 9);
}

function drawLobby(timestamp: number): void {
  drawRoundedRect(54, 48, 852, 560, 30, "rgba(255, 248, 255, 0.94)", "#321545", 5);
  drawText("Cat Math", 480, 120, {
    font: "900 64px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#8f45c8",
    align: "center",
    baseline: "middle",
  });

  drawCat(292, 438, 1.6, timestamp);

  drawRoundedRect(492, 180, 334, 66, 18, "#f1d3ff", "#321545", 3);
  drawCoin(532, 213, 17);
  drawText(formatMoney(save.coins), 561, 214, {
    font: "900 26px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });
  drawText(`${save.correctCount} right  •  Streak ${save.streak}`, 806, 214, {
    font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "right",
    baseline: "middle",
  });

  drawButton(492, 240, 334, 48, "Level 1: First Grade", true, () => startGradeLevel("first"), {
    fill: "#28a745",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 23px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawButton(492, 298, 334, 48, "Level 2: Fourth Grade", true, () => startGradeLevel("fourth"), {
    fill: "#8f45c8",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 23px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawButton(492, 356, 334, 48, "Pet Shop", true, () => {
    previewEquipped = {};
    shopReturnMode = "lobby";
    mode = "shop";
    message = "Welcome!";
    messageUntil = performance.now() + 1200;
  }, {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
  });

  const loungeLabel = save.loungeUnlocked ? "Enter Cat Lounge" : "Unlock Cat Lounge  $20";
  drawButton(492, 414, 334, 48, loungeLabel, true, unlockOrEnterLounge, {
    fill: save.loungeUnlocked ? "#54c8c1" : save.coins >= 20 ? "#ff9fd6" : "#d7c3e3",
    stroke: "#321545",
    color: "#321545",
    font: "900 22px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawButton(492, 472, 334, 48, "Visit Cat Cafe", true, () => {
    cafeNotice = "Welcome to the Cat Cafe!";
    cafeNoticeUntil = performance.now() + 1600;
    mode = "cafe";
  }, {
    fill: "#f4a261",
    stroke: "#321545",
    color: "#321545",
    font: "900 22px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawText(loungeNotice && timestamp < loungeNoticeUntil ? loungeNotice : "Press Enter to play", 659, 548, {
    font: "700 17px Trebuchet MS, Segoe UI, sans-serif",
    color: "#735181",
    align: "center",
    baseline: "middle",
  });
}

function startGradeLevel(grade: GradeLevel): void {
  selectedGrade = grade;
  currentProblem = createProblem();
  mode = "quiz";
  message = grade === "first" ? "First grade—let's go!" : "Fourth grade—let's go!";
  messageUntil = performance.now() + 1100;
}

function unlockOrEnterLounge(): void {
  if (!save.loungeUnlocked) {
    if (save.coins < 20) {
      loungeNotice = "You need $20 to unlock it";
      loungeNoticeUntil = performance.now() + 1600;
      return;
    }
    save.coins -= 20;
    save.loungeUnlocked = true;
    saveGame();
  }

  loungeNotice = "Welcome to the Cat Lounge!";
  loungeNoticeUntil = performance.now() + 1500;
  mode = "lounge";
}

function drawLounge(timestamp: number): void {
  drawPlaidRoom();
  drawButton(24, 20, 124, 46, "← Lobby", true, () => {
    mode = "lobby";
  }, {
    fill: "#fff8ff",
    stroke: "#321545",
    color: "#321545",
    font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawText("Cat Lounge", 480, 54, {
    font: "900 44px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#fff8ff",
    align: "center",
    baseline: "middle",
  });

  drawCouchAndCats(timestamp);
  drawEquationMachine(timestamp);
}

function drawCatCafe(timestamp: number): void {
  drawCafeRoom();
  drawButton(24, 20, 124, 46, "← Lobby", true, () => {
    mode = "lobby";
  }, {
    fill: "#fff8ff",
    stroke: "#321545",
    color: "#321545",
    font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawText("Cat Cafe", 480, 54, {
    font: "900 44px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#5d2f24",
    align: "center",
    baseline: "middle",
  });

  drawRoundedRect(54, 116, 556, 500, 28, "rgba(255, 248, 239, 0.9)", "#5d2f24", 5);
  drawText("A table for you and your cat friends", 332, 150, {
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
    color: "#7a4b3c",
    align: "center",
    baseline: "middle",
  });

  drawRoundedRect(112, 420, 438, 88, 34, "#9d5d43", "#5d2f24", 5);
  ctx.fillStyle = "#5d2f24";
  ctx.fillRect(178, 502, 26, 90);
  ctx.fillRect(458, 502, 26, 90);
  drawRoundedRect(236, 395, 84, 28, 12, "#fff8ff", "#5d2f24", 3);
  drawText("CAFE", 278, 410, {
    font: "900 14px Trebuchet MS, Segoe UI, sans-serif",
    color: "#dc3545",
    align: "center",
    baseline: "middle",
  });

  drawMiniLoungeCat(132, 378, "#e58d3b", "#f7c883", false, timestamp, "cafe-orange");
  drawCat(270, 414, 0.82, timestamp + 300, "cafe-player");
  drawMiniLoungeCat(420, 378, "#f4edf7", "#b9a9c7", false, timestamp + 600, "cafe-white");
  drawMiniLoungeCat(530, 390, "#34313b", "#777381", true, timestamp + 900, "cafe-nerd");
  registerSeatCat("cafe-orange", 86, 292, 92, 136);
  registerSeatCat("cafe-player", 214, 310, 112, 134);
  registerSeatCat("cafe-white", 374, 292, 92, 136);
  registerSeatCat("cafe-nerd", 484, 304, 92, 136);

  drawRoundedRect(638, 116, 274, 500, 28, "#fff8ef", "#5d2f24", 5);
  drawText("Cafe Menu", 775, 164, {
    font: "900 34px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#b44d37",
    align: "center",
    baseline: "middle",
  });
  drawCoin(686, 211, 16);
  drawText(formatMoney(save.coins), 714, 213, {
    font: "900 25px Trebuchet MS, Segoe UI, sans-serif",
    color: "#5d2f24",
    align: "left",
    baseline: "middle",
  });

  drawButton(674, 260, 202, 64, "Catpuccino  $2", true, () => orderCafeTreat("Catpuccino", 2), {
    fill: "#d8b08c",
    stroke: "#5d2f24",
    color: "#5d2f24",
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawButton(674, 344, 202, 64, "Tuna Cookie  $3", true, () => orderCafeTreat("Tuna Cookie", 3), {
    fill: "#f4a261",
    stroke: "#5d2f24",
    color: "#5d2f24",
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawButton(674, 428, 202, 64, "Fancy Fish  $5", true, () => orderCafeTreat("Fancy Fish", 5), {
    fill: "#8fd8ff",
    stroke: "#5d2f24",
    color: "#321545",
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawButton(674, 510, 202, 48, "Get a Cafe Job", true, startCafeJob, {
    fill: "#28a745",
    stroke: "#5d2f24",
    color: "#fff8ff",
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
  });

  if (timestamp < cafeNoticeUntil) {
    drawText(cafeNotice, 775, 586, {
      font: "900 15px Trebuchet MS, Segoe UI, sans-serif",
      color: "#b44d37",
      align: "center",
      baseline: "middle",
    });
  }
}

function drawCafeRoom(): void {
  ctx.fillStyle = "#f4d6b8";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "rgba(255, 248, 239, 0.7)";
  for (let y = 0; y < 580; y += 64) ctx.fillRect(0, y, WIDTH, 32);
  ctx.fillStyle = "#b8755c";
  ctx.fillRect(0, 580, WIDTH, 100);
  for (let x = 0; x < WIDTH; x += 80) {
    ctx.fillStyle = x % 160 === 0 ? "#9d5d43" : "#c78b6e";
    ctx.fillRect(x, 580, 80, 100);
  }
}

function orderCafeTreat(name: string, cost: number): void {
  if (save.coins < cost) {
    cafeNotice = `Need $${cost} for that treat`;
    cafeNoticeUntil = performance.now() + 1400;
    return;
  }
  save.coins -= cost;
  saveGame();
  cafeNotice = `${name} for everyone!`;
  cafeNoticeUntil = performance.now() + 1700;
  cheerUntil = performance.now() + 900;
  spawnSparkles(300, 360);
}

function startCafeJob(): void {
  mode = "cafeJob";
  cafeJobTutorialOpen = !save.cafeTutorialSeen;
  cafeCup = [];
  cafeJobNotice = "";
  spawnCafeCustomer();
}

function updateCafeJob(deltaSeconds: number): void {
  if (!cafeCustomer) {
    spawnCafeCustomer();
    return;
  }
  if (cafeCustomerLeaving) {
    cafeCustomerX -= 250 * deltaSeconds;
    if (cafeCustomerX < -130) spawnCafeCustomer();
  } else {
    cafeCustomerX = Math.min(252, cafeCustomerX + 190 * deltaSeconds);
  }
}

function spawnCafeCustomer(): void {
  const orders: CafeOrder[] = [
    { name: "Black Cat Coffee", ingredients: ["coffee"] },
    { name: "Milky Meow", ingredients: ["milk", "foam"] },
    { name: "Catpuccino", ingredients: ["coffee", "milk", "foam"] },
    { name: "Tuna Latte", ingredients: ["coffee", "milk", "tuna"] },
    { name: "Foamy Fish", ingredients: ["milk", "tuna", "foam"] },
  ];
  const furs = [
    ["#e58d3b", "#f7c883"],
    ["#f4edf7", "#b9a9c7"],
    ["#34313b", "#777381"],
    ["#a77bda", "#ead7ff"],
    ["#8b5a3c", "#d7a47e"],
  ];
  const fur = furs[randInt(0, furs.length - 1)]!;
  cafeCustomer = {
    fur: fur[0]!,
    accent: fur[1]!,
    scale: [0.78, 0.92, 1, 1.18, 1.3][randInt(0, 4)]!,
    glasses: Math.random() < 0.35,
    order: orders[randInt(0, orders.length - 1)]!,
  };
  cafeCustomerX = -120;
  cafeCustomerLeaving = false;
  cafeCup = [];
}

function drawCafeJob(timestamp: number): void {
  drawCafeRoom();
  drawButton(20, 18, 116, 44, "← Cafe", true, () => {
    mode = "cafe";
  }, {
    fill: "#fff8ff",
    stroke: "#5d2f24",
    color: "#5d2f24",
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawText("Cat Cafe Shift", 480, 46, {
    font: "900 38px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#5d2f24",
    align: "center",
    baseline: "middle",
  });
  drawButton(798, 18, 140, 44, "Tutorial", true, () => {
    cafeJobTutorialOpen = true;
  }, {
    fill: "#ffd35c",
    stroke: "#5d2f24",
    color: "#5d2f24",
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawRoundedRect(24, 82, 482, 514, 24, "rgba(255, 248, 239, 0.94)", "#5d2f24", 5);
  drawRoundedRect(530, 82, 406, 514, 24, "#efe7df", "#5d2f24", 5);

  if (cafeCustomer) {
    drawRoundedRect(62, 112, 406, 112, 20, "#fff8ff", "#5d2f24", 3);
    drawText(`“${cafeCustomer.order.name}, please!”`, 265, 145, {
      font: "900 22px Trebuchet MS, Segoe UI, sans-serif",
      color: "#5d2f24",
      align: "center",
      baseline: "middle",
    });
    drawText(cafeCustomer.order.ingredients.map(ingredientLabel).join(" + "), 265, 190, {
      font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
      color: "#b44d37",
      align: "center",
      baseline: "middle",
    });
    drawCafeCustomer(cafeCustomer, cafeCustomerX, 434, timestamp);
  }

  drawRoundedRect(44, 446, 444, 92, 16, "#9d5d43", "#5d2f24", 5);
  ctx.fillStyle = "#5d2f24";
  ctx.fillRect(78, 532, 28, 54);
  ctx.fillRect(426, 532, 28, 54);

  drawText("DRINK MACHINES", 733, 120, {
    font: "900 25px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#5d2f24",
    align: "center",
    baseline: "middle",
  });
  const ingredients: CafeIngredient[] = ["coffee", "milk", "foam", "tuna"];
  const colors: Record<CafeIngredient, string> = {
    coffee: "#8b5a3c",
    milk: "#fff8ff",
    foam: "#8fd8ff",
    tuna: "#f4a261",
  };
  ingredients.forEach((ingredient, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawButton(558 + col * 184, 154 + row * 82, 160, 62, ingredientLabel(ingredient), true, () => addCafeIngredient(ingredient), {
      fill: colors[ingredient],
      stroke: "#5d2f24",
      color: ingredient === "coffee" ? "#fff8ff" : "#321545",
      font: "900 20px Trebuchet MS, Segoe UI, sans-serif",
    });
  });

  drawRoundedRect(558, 338, 344, 76, 16, "#30263a", "#8fd8ff", 3);
  drawText(cafeCup.length > 0 ? cafeCup.map(ingredientLabel).join(" + ") : "Empty cup", 730, 377, {
    font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
    color: cafeCup.length > 0 ? "#8fffe2" : "#d7c3e3",
    align: "center",
    baseline: "middle",
  });
  drawButton(558, 436, 160, 58, "Clear Cup", true, () => {
    cafeCup = [];
  }, {
    fill: "#ffd35c",
    stroke: "#5d2f24",
    color: "#5d2f24",
    font: "900 19px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawButton(742, 436, 160, 58, "Serve", cafeCustomerX >= 245 && !cafeCustomerLeaving, serveCafeOrder, {
    fill: cafeCustomerX >= 245 && !cafeCustomerLeaving ? "#28a745" : "#aeb5ae",
    stroke: "#5d2f24",
    color: "#fff8ff",
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawCoin(570, 548, 16);
  drawText(formatMoney(save.coins), 598, 550, {
    font: "900 24px Trebuchet MS, Segoe UI, sans-serif",
    color: "#5d2f24",
    align: "left",
    baseline: "middle",
  });
  if (timestamp < cafeJobNoticeUntil) {
    drawText(cafeJobNotice, 890, 550, {
      font: "900 16px Trebuchet MS, Segoe UI, sans-serif",
      color: "#b44d37",
      align: "right",
      baseline: "middle",
    });
  }

  if (cafeJobTutorialOpen) {
    hotspots = [];
    drawCafeJobTutorial();
  }
}

function drawCafeCustomer(customer: CafeCustomer, x: number, groundY: number, timestamp: number): void {
  const walk = cafeCustomerLeaving || cafeCustomerX < 252 ? Math.sin(timestamp / 80) * 5 : 0;
  ctx.save();
  ctx.translate(x, groundY + walk);
  ctx.scale(customer.scale, customer.scale);
  ctx.fillStyle = customer.fur;
  ctx.strokeStyle = "#321545";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -48, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30, -72);
  ctx.lineTo(-22, -104);
  ctx.lineTo(-5, -79);
  ctx.moveTo(30, -72);
  ctx.lineTo(22, -104);
  ctx.lineTo(5, -79);
  ctx.fill();
  ctx.fillStyle = customer.accent;
  ctx.beginPath();
  ctx.arc(-14, -50, 6, 0, Math.PI * 2);
  ctx.arc(14, -50, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f59bdc";
  ctx.beginPath();
  ctx.arc(0, -34, 4, 0, Math.PI * 2);
  ctx.fill();
  if (customer.glasses) {
    ctx.strokeStyle = "#15121a";
    ctx.lineWidth = 4;
    ctx.strokeRect(-30, -63, 26, 21);
    ctx.strokeRect(4, -63, 26, 21);
    ctx.beginPath();
    ctx.moveTo(-4, -53);
    ctx.lineTo(4, -53);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCafeJobTutorial(): void {
  ctx.fillStyle = "rgba(35, 13, 25, 0.7)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawRoundedRect(170, 100, 620, 480, 28, "#fff8ef", "#5d2f24", 5);
  drawText("Your First Cafe Shift", 480, 154, {
    font: "900 38px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#b44d37",
    align: "center",
    baseline: "middle",
  });
  const tutorialLines = [
    "1. Wait for a cat to walk up to the counter.",
    "2. Read the order and its ingredient recipe.",
    "3. Tap the Coffee, Milk, Foam, or Tuna machines.",
    "4. Use Clear Cup if you make a mistake.",
    "5. Press Serve. Correct drinks earn $4!",
  ];
  tutorialLines.forEach((line, index) => {
    drawText(line, 220, 224 + index * 48, {
      font: "900 20px Trebuchet MS, Segoe UI, sans-serif",
      color: "#5d2f24",
      align: "left",
      baseline: "middle",
    });
  });
  drawText("You can press Tutorial anytime to see this again.", 480, 476, {
    font: "700 17px Trebuchet MS, Segoe UI, sans-serif",
    color: "#7a4b3c",
    align: "center",
    baseline: "middle",
  });
  drawButton(350, 510, 260, 52, "Start My Shift", true, closeCafeJobTutorial, {
    fill: "#28a745",
    stroke: "#5d2f24",
    color: "#fff8ff",
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
  });
}

function closeCafeJobTutorial(): void {
  cafeJobTutorialOpen = false;
  if (!save.cafeTutorialSeen) {
    save.cafeTutorialSeen = true;
    saveGame();
  }
}

function addCafeIngredient(ingredient: CafeIngredient): void {
  if (cafeCustomerX < 245 || cafeCustomerLeaving) {
    cafeJobNotice = "Wait for the customer";
    cafeJobNoticeUntil = performance.now() + 1100;
    return;
  }
  if (cafeCup.length >= 4) {
    cafeJobNotice = "The cup is full";
    cafeJobNoticeUntil = performance.now() + 1100;
    return;
  }
  cafeCup.push(ingredient);
}

function serveCafeOrder(): void {
  if (!cafeCustomer || cafeCustomerLeaving || cafeCustomerX < 245) return;
  const correct =
    cafeCup.length === cafeCustomer.order.ingredients.length &&
    cafeCup.every((ingredient, index) => ingredient === cafeCustomer?.order.ingredients[index]);
  if (!correct) {
    cafeJobNotice = "That drink isn't right—try again!";
    cafeJobNoticeUntil = performance.now() + 1500;
    cafeCup = [];
    playCatMeow();
    return;
  }
  const tip = createCafeTip();
  save.coins = Math.min(Number.MAX_SAFE_INTEGER, save.coins + 4 + tip);
  saveGame();
  cafeJobNotice = tip === ALL_THE_MONEY_IN_THE_WORLD
    ? `ALL THE MONEY! ${formatMoney(tip)} TIP!`
    : `Perfect! +$4 + ${formatMoney(tip)} tip`;
  cafeJobNoticeUntil = performance.now() + (tip === ALL_THE_MONEY_IN_THE_WORLD ? 3000 : 1900);
  cafeCup = [];
  cafeCustomerLeaving = true;
  cheerUntil = performance.now() + 800;
  spawnSparkles(300, 350);
}

function ingredientLabel(ingredient: CafeIngredient): string {
  if (ingredient === "coffee") return "Coffee";
  if (ingredient === "milk") return "Milk";
  if (ingredient === "foam") return "Foam";
  return "Tuna";
}

function createCafeTip(): number {
  const roll = Math.random();
  if (roll < 0.005) return ALL_THE_MONEY_IN_THE_WORLD;
  if (roll < 0.03) return randInt(10_000, 1_000_000);
  if (roll < 0.13) return randInt(1_000, 9_999);
  if (roll < 0.33) return randInt(100, 999);
  if (roll < 0.68) return randInt(10, 99);
  return randInt(1, 9);
}

function formatMoney(amount: number): string {
  if (amount < 1_000_000) return `$${Math.floor(amount).toLocaleString("en-US")}`;
  const units = [
    { value: 1_000_000_000_000_000, suffix: "Q" },
    { value: 1_000_000_000_000, suffix: "T" },
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
  ];
  const unit = units.find((candidate) => amount >= candidate.value) ?? units[units.length - 1]!;
  const compact = amount / unit.value;
  return `$${compact >= 100 ? compact.toFixed(0) : compact >= 10 ? compact.toFixed(1) : compact.toFixed(2)}${unit.suffix}`;
}

function drawPlaidRoom(): void {
  ctx.fillStyle = "#7f416e";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "rgba(255, 212, 94, 0.26)";
  for (let x = 0; x < WIDTH; x += 88) ctx.fillRect(x, 0, 24, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 88) ctx.fillRect(0, y, WIDTH, 24);
  ctx.fillStyle = "rgba(65, 26, 76, 0.32)";
  for (let x = 44; x < WIDTH; x += 88) ctx.fillRect(x, 0, 12, HEIGHT);
  for (let y = 44; y < HEIGHT; y += 88) ctx.fillRect(0, y, WIDTH, 12);
  ctx.fillStyle = "#5d3156";
  ctx.fillRect(0, 584, WIDTH, 96);
}

function drawCouchAndCats(timestamp: number): void {
  drawRoundedRect(42, 336, 382, 205, 38, "#4b9c91", "#321545", 5);
  drawRoundedRect(64, 370, 338, 144, 24, "#72c4b7", "#321545", 4);
  drawRoundedRect(30, 390, 62, 154, 24, "#4b9c91", "#321545", 5);
  drawRoundedRect(374, 390, 62, 154, 24, "#4b9c91", "#321545", 5);

  drawMiniLoungeCat(116, 450, "#e58d3b", "#f7c883", false, timestamp, "lounge-orange");
  drawCat(226, 474, 0.72, timestamp + 400, "lounge-player");
  drawMiniLoungeCat(338, 449, "#34313b", "#777381", true, timestamp + 800, "lounge-nerd");
  registerSeatCat("lounge-orange", 70, 364, 92, 136);
  registerSeatCat("lounge-player", 174, 378, 104, 128);
  registerSeatCat("lounge-nerd", 292, 363, 92, 136);
  drawText("The nerd cat knows the machine.", 233, 568, {
    font: "900 16px Trebuchet MS, Segoe UI, sans-serif",
    color: "#fff8ff",
    align: "center",
    baseline: "middle",
  });
}

function drawMiniLoungeCat(
  x: number,
  groundY: number,
  color: string,
  accent: string,
  glasses: boolean,
  timestamp: number,
  interactionKey?: string
): void {
  const interaction = interactionKey ? getCatInteraction(interactionKey, performance.now()) : { offsetY: 0, purring: false };
  const bob = Math.sin(timestamp / 700) * 2 + interaction.offsetY;
  ctx.save();
  ctx.translate(x, groundY + bob);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#321545";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 20, 43, 37, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -24, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-27, -45);
  ctx.lineTo(-20, -78);
  ctx.lineTo(-3, -53);
  ctx.moveTo(27, -45);
  ctx.lineTo(20, -78);
  ctx.lineTo(3, -53);
  ctx.fill();
  if (interaction.purring) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-18, -25);
    ctx.quadraticCurveTo(-12, -20, -6, -25);
    ctx.moveTo(6, -25);
    ctx.quadraticCurveTo(12, -20, 18, -25);
    ctx.stroke();
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-12, -25, 5, 0, Math.PI * 2);
    ctx.arc(12, -25, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f59bdc";
  ctx.beginPath();
  ctx.arc(0, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  if (glasses) {
    ctx.strokeStyle = "#15121a";
    ctx.lineWidth = 4;
    ctx.strokeRect(-25, -37, 22, 18);
    ctx.strokeRect(3, -37, 22, 18);
    ctx.beginPath();
    ctx.moveTo(-3, -29);
    ctx.lineTo(3, -29);
    ctx.stroke();
  }
  ctx.restore();
}

function registerSeatCat(key: string, x: number, y: number, w: number, h: number): void {
  hotspots.push({
    x,
    y,
    w,
    h,
    enabled: true,
    onClick: () => makeCatJumpAndMeow(key),
    onHold: () => startCatPurr(key),
  });
}

function getCatInteraction(key: string, timestamp: number): { offsetY: number; purring: boolean } {
  const state = catInteractionStates.get(key);
  if (!state) return { offsetY: 0, purring: false };

  let offsetY = 0;
  if (timestamp < state.jumpUntil) {
    const duration = state.jumpUntil - state.jumpStartedAt;
    const progress = clamp((timestamp - state.jumpStartedAt) / duration, 0, 1);
    offsetY = -Math.sin(progress * Math.PI) * 54;
  }
  const purring = timestamp < state.purrUntil;
  if (purring) offsetY += Math.sin(timestamp / 34) * 1.5;
  return { offsetY, purring };
}

function getOrCreateCatInteraction(key: string): CatInteractionState {
  const existing = catInteractionStates.get(key);
  if (existing) return existing;
  const state: CatInteractionState = { jumpStartedAt: 0, jumpUntil: 0, purrUntil: 0 };
  catInteractionStates.set(key, state);
  return state;
}

function makeCatJumpAndMeow(key: string): void {
  const now = performance.now();
  const state = getOrCreateCatInteraction(key);
  state.jumpStartedAt = now;
  state.jumpUntil = now + 680;
  state.purrUntil = 0;
  playCatMeow();
}

function startCatPurr(key: string): void {
  const state = getOrCreateCatInteraction(key);
  state.jumpUntil = 0;
  state.purrUntil = Number.POSITIVE_INFINITY;
  activePurringCat = key;
  playCatPurr();
}

function stopCatPurr(): void {
  if (activePurringCat) {
    getOrCreateCatInteraction(activePurringCat).purrUntil = performance.now() + 260;
  }
  activePurringCat = null;
  if (!purrAudio || !catAudioContext) return;
  const now = catAudioContext.currentTime;
  purrAudio.gain.gain.cancelScheduledValues(now);
  purrAudio.gain.gain.setValueAtTime(purrAudio.gain.gain.value, now);
  purrAudio.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  purrAudio.oscillator.stop(now + 0.2);
  purrAudio.rumble.stop(now + 0.2);
  purrAudio = null;
}

function prepareCatAudio(): AudioContext | null {
  try {
    catAudioContext ??= new AudioContext();
    if (catAudioContext.state === "suspended") void catAudioContext.resume();
    return catAudioContext;
  } catch {
    return null;
  }
}

function playCatMeow(): void {
  const audio = prepareCatAudio();
  if (!audio) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(920, now + 0.12);
  oscillator.frequency.exponentialRampToValueAtTime(430, now + 0.48);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.09, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.55);
}

function playCatPurr(): void {
  stopPurrAudioImmediately();
  const audio = prepareCatAudio();
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const rumble = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 58;
  rumble.type = "sine";
  rumble.frequency.value = 87;
  gain.gain.value = 0.045;
  oscillator.connect(gain);
  rumble.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  rumble.start();
  purrAudio = { oscillator, rumble, gain };
}

function stopPurrAudioImmediately(): void {
  if (!purrAudio) return;
  purrAudio.oscillator.stop();
  purrAudio.rumble.stop();
  purrAudio = null;
}

function drawEquationMachine(timestamp: number): void {
  drawRoundedRect(466, 98, 462, 500, 26, "#e8e1ef", "#321545", 5);
  drawRoundedRect(492, 120, 410, 66, 16, "#30263a", "#8fd8ff", 3);
  drawText("CREATE YOUR OWN MATH EQUATION", 697, 154, {
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
    color: "#8fffe2",
    align: "center",
    baseline: "middle",
  });

  drawNumberPicker(512, 218, creatorLeft, (amount) => {
    creatorLeft = clamp(creatorLeft + amount, 0, 99);
  });
  drawText(operationSymbol(creatorOperation), 697, 245, {
    font: "900 42px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });
  drawNumberPicker(752, 218, creatorRight, (amount) => {
    creatorRight = clamp(creatorRight + amount, 0, 99);
  });

  const operations: CustomOperation[] = ["add", "subtract", "multiply", "divide"];
  operations.forEach((operation, index) => {
    const selected = creatorOperation === operation;
    drawButton(500 + index * 101, 300, 86, 48, operationSymbol(operation), true, () => {
      creatorOperation = operation;
    }, {
      fill: selected ? "#b464ee" : "#fff8ff",
      stroke: "#321545",
      color: selected ? "#fff8ff" : "#321545",
      font: "900 27px Trebuchet MS, Segoe UI, sans-serif",
    });
  });

  drawText(
    `${creatorLeft} ${operationSymbol(creatorOperation)} ${creatorRight} = ${creatorEquationPreview()}`,
    697,
    382,
    {
      font: "900 25px Trebuchet MS, Segoe UI, sans-serif",
      color: "#321545",
      align: "center",
      baseline: "middle",
    }
  );

  drawButton(514, 414, 366, 48, "Save Equation", true, saveCreatorEquation, {
    fill: "#28a745",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawButton(514, 478, 174, 58, `Load (${save.customEquations.length})`, true, () => {
    mode = "equationLibrary";
  }, {
    fill: "#8fd8ff",
    stroke: "#321545",
    color: "#321545",
    font: "900 20px Trebuchet MS, Segoe UI, sans-serif",
  });
  const clashReady = save.customEquations.length >= MIN_CLASH_EQUATIONS;
  drawButton(706, 478, 174, 58, `Clash ${save.customEquations.length}/10`, clashReady, startEquationClash, {
    fill: clashReady ? "#dc3545" : "#d7c3e3",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
  });

  if (loungeNotice && timestamp < loungeNoticeUntil) {
    drawText(loungeNotice, 697, 566, {
      font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
      color: "#6f299c",
      align: "center",
      baseline: "middle",
    });
  }
}

function drawNumberPicker(x: number, y: number, value: number, change: (amount: number) => void): void {
  drawButton(x, y, 48, 54, "−", true, () => change(-1), {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawRoundedRect(x + 54, y, 72, 54, 12, "#fff8ff", "#321545", 3);
  drawText(String(value), x + 90, y + 28, {
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });
  drawButton(x + 132, y, 48, 54, "+", true, () => change(1), {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
  });
}

function drawEquationLibrary(timestamp: number): void {
  drawPlaidRoom();
  drawRoundedRect(48, 42, 864, 580, 28, "rgba(255, 248, 255, 0.96)", "#321545", 5);
  drawButton(76, 68, 132, 44, "← Lounge", true, () => {
    mode = "lounge";
  }, {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawText("Loaded Equations", 480, 94, {
    font: "900 38px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#8f45c8",
    align: "center",
    baseline: "middle",
  });

  if (save.customEquations.length === 0) {
    drawText("The machine is empty. Save an equation first!", 480, 318, {
      font: "900 23px Trebuchet MS, Segoe UI, sans-serif",
      color: "#735181",
      align: "center",
      baseline: "middle",
    });
  }

  save.customEquations.forEach((equation, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 92 + col * 394;
    const y = 136 + row * 78;
    drawRoundedRect(x, y, 350, 60, 15, "#f1d3ff", "#321545", 3);
    drawText(equationLabel(equation), x + 20, y + 31, {
      font: "900 22px Trebuchet MS, Segoe UI, sans-serif",
      color: "#321545",
      align: "left",
      baseline: "middle",
    });
    drawButton(x + 286, y + 12, 46, 36, "X", true, () => deleteCustomEquation(index), {
      fill: "#dc3545",
      stroke: "#321545",
      color: "#fff8ff",
      font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
    });
  });

  const clashReady = save.customEquations.length >= MIN_CLASH_EQUATIONS;
  drawButton(330, 548, 300, 52, `Equation Clash ${save.customEquations.length}/10`, clashReady, startEquationClash, {
    fill: clashReady ? "#dc3545" : "#d7c3e3",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
  });
  if (loungeNotice && timestamp < loungeNoticeUntil) {
    drawText(loungeNotice, 480, 522, {
      font: "900 16px Trebuchet MS, Segoe UI, sans-serif",
      color: "#6f299c",
      align: "center",
      baseline: "middle",
    });
  }
}

function drawEquationClash(timestamp: number): void {
  drawButton(28, 22, 144, 52, "← Lounge", true, leaveEquationClash, {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawRoundedRect(610, 22, 320, 52, 14, "#fff8ff", "#321545", 3);
  drawText(`Equation Clash  ${clashIndex + 1}/${clashProblems.length}`, 770, 49, {
    font: "900 20px Trebuchet MS, Segoe UI, sans-serif",
    color: "#8f45c8",
    align: "center",
    baseline: "middle",
  });
  drawProblemPanel(timestamp);
  drawCat(704, 455, 1.28, timestamp);
  drawMessage(timestamp);
}

function saveCreatorEquation(): void {
  if (creatorOperation === "divide" && (creatorLeft === 0 || creatorRight === 0)) {
    startBlackHole();
    return;
  }

  const equation: CustomEquation = {
    left: creatorLeft,
    right: creatorRight,
    operation: creatorOperation,
  };
  const duplicate = save.customEquations.some(
    (savedEquation) =>
      savedEquation.left === equation.left &&
      savedEquation.right === equation.right &&
      savedEquation.operation === equation.operation
  );
  if (duplicate) {
    loungeNotice = "That equation is already saved";
  } else if (save.customEquations.length >= MAX_CUSTOM_EQUATIONS) {
    loungeNotice = `The machine can hold ${MAX_CUSTOM_EQUATIONS} equations`;
  } else {
    save.customEquations.push(equation);
    saveGame();
    loungeNotice = `Saved ${equationLabel(equation)}`;
  }
  loungeNoticeUntil = performance.now() + 1700;
}

function creatorEquationPreview(): string {
  if (creatorOperation === "divide" && (creatorLeft === 0 || creatorRight === 0)) {
    return "???";
  }
  return formatNumber(
    customEquationAnswer({ left: creatorLeft, right: creatorRight, operation: creatorOperation })
  );
}

function startBlackHole(): void {
  mode = "blackHole";
  hotspots = [];
  pendingAnswer = null;
  blackHoleStartedAt = performance.now();
  blackHoleExitStarted = false;
}

function drawBlackHole(timestamp: number): void {
  const elapsed = Math.max(0, timestamp - blackHoleStartedAt);
  const progress = Math.min(1, elapsed / 2400);
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;
  const radius = 22 + progress * 640;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(elapsed / 280);
  for (let ring = 5; ring >= 0; ring -= 1) {
    ctx.strokeStyle = ring % 2 === 0 ? "rgba(173, 71, 255, 0.8)" : "rgba(65, 210, 255, 0.74)";
    ctx.lineWidth = 12 + progress * 18;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (0.34 + ring * 0.13), radius * (0.12 + ring * 0.055), ring * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const voidGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  voidGradient.addColorStop(0, "#000000");
  voidGradient.addColorStop(0.5, "#030006");
  voidGradient.addColorStop(0.82, "rgba(13, 0, 20, 0.94)");
  voidGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = voidGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  if (progress < 0.72) {
    drawText("YOU DIVIDED BY ZERO", centerX, centerY - 20, {
      font: "900 42px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
      color: "#fff8ff",
      align: "center",
      baseline: "middle",
    });
    drawText("THE CATS ARE EJECTING YOU", centerX, centerY + 34, {
      font: "900 22px Trebuchet MS, Segoe UI, sans-serif",
      color: "#8fffe2",
      align: "center",
      baseline: "middle",
    });
  }
}

function deleteCustomEquation(index: number): void {
  save.customEquations.splice(index, 1);
  saveGame();
  loungeNotice = "Equation deleted";
  loungeNoticeUntil = performance.now() + 1200;
}

function startEquationClash(): void {
  if (save.customEquations.length < MIN_CLASH_EQUATIONS) {
    const needed = MIN_CLASH_EQUATIONS - save.customEquations.length;
    loungeNotice = `Save ${needed} more equation${needed === 1 ? "" : "s"} first`;
    loungeNoticeUntil = performance.now() + 1500;
    return;
  }
  clashProblems = save.customEquations.map(equationToProblem);
  clashIndex = 0;
  currentProblem = clashProblems[0]!;
  message = "Clash time!";
  messageUntil = performance.now() + 900;
  mode = "equationClash";
}

function leaveEquationClash(): void {
  nextProblemAt = 0;
  lockedUntil = 0;
  clashProblems = [];
  clashIndex = 0;
  currentProblem = createProblem();
  mode = "lounge";
}

function equationToProblem(equation: CustomEquation): Problem {
  const answer = customEquationAnswer(equation);
  return {
    ...equation,
    answer,
    choices: buildChoices(answer),
  };
}

function customEquationAnswer(equation: CustomEquation): number {
  if (equation.left === 6 && equation.right === 7 && equation.operation === "multiply") return 67;
  if (equation.left === 10 && equation.right === 9 && equation.operation === "add") return 21;
  if (equation.operation === "add") return equation.left + equation.right;
  if (equation.operation === "subtract") return equation.left - equation.right;
  if (equation.operation === "multiply") return equation.left * equation.right;
  return Number((equation.left / Math.max(1, equation.right)).toFixed(2));
}

function equationLabel(equation: CustomEquation): string {
  return `${equation.left} ${operationSymbol(equation.operation)} ${equation.right} = ${formatNumber(customEquationAnswer(equation))}`;
}

function operationSymbol(operation: CustomOperation): string {
  if (operation === "add") return "+";
  if (operation === "subtract") return "−";
  if (operation === "multiply") return "×";
  return "÷";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function drawQuiz(timestamp: number): void {
  drawTopBar(timestamp);
  drawProblemPanel(timestamp);
  drawCat(704, 455, 1.28, timestamp);
  drawMessage(timestamp);
}

function drawTopBar(timestamp: number): void {
  drawRoundedRect(28, 22, 206, 64, 16, "#fff8ff", "#321545", 3);
  drawCoin(58, 54, 18);
  drawText(formatMoney(save.coins), 86, 61, {
    font: "900 31px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });

  drawRoundedRect(252, 22, 206, 64, 16, "#fff8ff", "#321545", 3);
  drawText(`Streak ${save.streak}`, 355, 62, {
    font: "900 27px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });

  drawRoundedRect(476, 22, 196, 64, 16, "#fff8ff", "#321545", 3);
  drawText(`${save.correctCount} right`, 574, 62, {
    font: "900 25px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });

  drawButton(748, 22, 184, 64, "Pet Shop", true, () => {
    previewEquipped = {};
    shopReturnMode = "quiz";
    mode = "shop";
    message = "Welcome!";
    messageUntil = timestamp + 1200;
  }, {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 25px Trebuchet MS, Segoe UI, sans-serif",
  });
}

function drawProblemPanel(timestamp: number): void {
  drawRoundedRect(52, 128, 500, 422, 24, "#fff8ff", "#321545", 4);
  const levelTitle = mode === "equationClash"
    ? "Equation Clash"
    : selectedGrade === "first"
      ? "Level 1: First Grade"
      : "Level 2: Fourth Grade";
  drawText(levelTitle, 302, 173, {
    font: "900 26px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#8f45c8",
    align: "center",
    baseline: "middle",
  });

  drawText(problemLabel(currentProblem), 302, 258, {
    font: "900 78px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });

  const disabled = timestamp < lockedUntil;
  currentProblem.choices.forEach((choice, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawButton(
      92 + col * 230,
      348 + row * 86,
      190,
      62,
      String(choice),
      !disabled,
      () => chooseAnswer(choice),
      {
        fill: disabled ? "#e3c2ee" : "#b464ee",
        stroke: "#321545",
        color: "#fff8ff",
        font: "900 33px Trebuchet MS, Segoe UI, sans-serif",
      }
    );
  });
}

function drawMessage(timestamp: number): void {
  const active = timestamp < messageUntil || timestamp < cheerUntil;
  if (!active && message !== "Ready?") {
    return;
  }

  const text = timestamp < cheerUntil ? message : message;
  drawRoundedRect(600, 116, 304, 72, 18, "rgba(255, 248, 255, 0.92)", "#321545", 3);
  drawText(text, 752, 153, {
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });
}

function drawAnswerConfirmation(): void {
  if (pendingAnswer === null) return;

  ctx.fillStyle = "rgba(35, 13, 51, 0.58)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawRoundedRect(214, 168, 532, 344, 26, "#fff8ff", "#321545", 5);
  drawText("Are you sure?", 480, 224, {
    font: "900 38px Trebuchet MS, Segoe UI, sans-serif",
    color: "#8f45c8",
    align: "center",
    baseline: "middle",
  });
  drawText(`Do you want to pick ${pendingAnswer}?`, 480, 282, {
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "center",
    baseline: "middle",
  });

  drawButton(302, 328, 158, 62, "No", true, closeAnswerConfirmation, {
    fill: "#dc3545",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
  });
  drawButton(500, 328, 158, 62, "Yes", true, confirmPendingAnswer, {
    fill: "#28a745",
    stroke: "#321545",
    color: "#fff8ff",
    font: "900 28px Trebuchet MS, Segoe UI, sans-serif",
  });

  const checkboxX = 310;
  const checkboxY = 426;
  drawRoundedRect(checkboxX, checkboxY, 30, 30, 6, "#fff8ff", "#321545", 3);
  if (dontAskAgain) {
    ctx.strokeStyle = "#8f45c8";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(317, 441);
    ctx.lineTo(323, 448);
    ctx.lineTo(334, 434);
    ctx.stroke();
  }
  drawText("Don't ask me again", 354, 442, {
    font: "900 21px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });
  hotspots.push({
    x: checkboxX,
    y: checkboxY - 6,
    w: 340,
    h: 42,
    enabled: true,
    onClick: () => {
      dontAskAgain = !dontAskAgain;
    },
  });
}

function chooseAnswer(choice: number): void {
  const now = performance.now();
  if (now < lockedUntil || nextProblemAt > 0 || pendingAnswer !== null) return;

  if (!save.askBeforeAnswer) {
    answerProblem(choice);
    return;
  }

  pendingAnswer = choice;
  dontAskAgain = false;
}

function confirmPendingAnswer(): void {
  if (pendingAnswer === null) return;

  const choice = pendingAnswer;
  if (dontAskAgain) {
    save.askBeforeAnswer = false;
    saveGame();
  }
  pendingAnswer = null;
  dontAskAgain = false;
  answerProblem(choice);
}

function closeAnswerConfirmation(): void {
  pendingAnswer = null;
  dontAskAgain = false;
}

function drawShop(timestamp: number): void {
  drawRoundedRect(34, 26, 892, 602, 24, "#fff8ff", "#321545", 4);
  drawText("Pet Shop", 110, 72, {
    font: "900 40px Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });
  drawCoin(806, 72, 18);
  drawText(formatMoney(save.coins), 834, 75, {
    font: "900 30px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });

  drawButton(724, 562, 156, 44, "Back", true, () => {
    previewEquipped = {};
    mode = shopReturnMode;
    message = "Ready?";
    messageUntil = timestamp + 400;
  }, {
    fill: "#ffd35c",
    stroke: "#321545",
    color: "#321545",
    font: "900 20px Trebuchet MS, Segoe UI, sans-serif",
  });

  drawRoundedRect(70, 120, 294, 430, 20, "#f1d3ff", "#321545", 3);
  drawCat(218, 372, 1.5, timestamp);
  const previewItem = getActivePreviewItem();
  if (previewItem) {
    drawRoundedRect(100, 504, 236, 30, 10, "#fff8ff", "#8f45c8", 2);
    drawText(`Trying on: ${previewItem.name}`, 218, 520, {
      font: "900 15px Trebuchet MS, Segoe UI, sans-serif",
      color: "#6f299c",
      align: "center",
      baseline: "middle",
    });
  }

  (Object.keys(categoryLabels) as ShopCategory[]).forEach((category, index) => {
    const selected = category === shopCategory;
    drawButton(414 + index * 152, 116, 132, 46, categoryLabels[category], true, () => {
      shopCategory = category;
    }, {
      fill: selected ? "#b464ee" : "#f4dcff",
      stroke: "#321545",
      color: selected ? "#fff8ff" : "#321545",
      font: "900 18px Trebuchet MS, Segoe UI, sans-serif",
    });
  });

  const items = shopItems.filter((item) => item.category === shopCategory);
  items.forEach((item, index) => {
    const x = 414;
    const y = 186 + index * 62;
    drawShopItem(item, x, y, 466, 50);
  });
}

function drawShopItem(item: ShopItem, x: number, y: number, width: number, height: number): void {
  const owned = isOwned(item);
  const equipped = save.equipped[item.category] === item.id;
  const previewing = previewEquipped[item.category] === item.id;
  drawRoundedRect(x, y, width, height, 14, equipped || previewing ? "#efe0ff" : "#fff8ff", "#321545", 2);

  if (item.category === "skin") {
    ctx.fillStyle = item.color ?? "#08070a";
    ctx.beginPath();
    ctx.arc(x + 27, y + height / 2, 14, 0, Math.PI * 2);
    ctx.fill();
    if (item.id === "tuxedo") {
      ctx.fillStyle = "#fff8ff";
      ctx.beginPath();
      ctx.arc(x + 27, y + height / 2 + 3, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (item.color) {
    drawRoundedRect(x + 14, y + 17, 28, 16, 8, item.color, "#321545", 2);
  }

  drawText(item.name, x + 58, y + 17, {
    font: "900 17px Trebuchet MS, Segoe UI, sans-serif",
    color: "#321545",
    align: "left",
    baseline: "middle",
  });
  drawText(item.cost === 0 ? "Free" : `$${item.cost}`, x + 58, y + 36, {
    font: "700 14px Trebuchet MS, Segoe UI, sans-serif",
    color: "#735181",
    align: "left",
    baseline: "middle",
  });

  const canBuy = save.coins >= item.cost;
  const label = equipped ? "On" : owned ? "Equip" : canBuy ? "Buy" : previewing ? "Trying" : "Try On";
  drawButton(x + width - 104, y + 8, 84, 34, label, !equipped, () => {
    if (!owned && !canBuy) {
      tryOnItem(item);
    } else {
      buyOrEquip(item);
    }
  }, {
    fill: equipped ? "#d7c3e3" : previewing ? "#b464ee" : owned || canBuy ? "#ffd35c" : "#8fd8ff",
    stroke: "#321545",
    color: previewing ? "#fff8ff" : "#321545",
    font: "900 16px Trebuchet MS, Segoe UI, sans-serif",
  });
}

function tryOnItem(item: ShopItem): void {
  previewEquipped[item.category] = item.id;
  message = `Trying on ${item.name}`;
  messageUntil = performance.now() + 1100;
  cheerUntil = performance.now() + 500;
  spawnSparkles(220, 330);
}

function answerProblem(choice: number): void {
  const now = performance.now();
  if (now < lockedUntil || nextProblemAt > 0) return;

  if (choice === currentProblem.answer) {
    const streakBonus = (save.streak + 1) % 5 === 0 ? 3 : 0;
    const earned = 2 + streakBonus;
    save.coins += earned;
    save.correctCount += 1;
    save.streak += 1;
    saveGame();
    message = streakBonus > 0 ? `Great streak! +$${earned}` : `Purrfect! +$${earned}`;
    messageUntil = now + 1100;
    cheerUntil = now + 900;
    lockedUntil = now + 1050;
    nextProblemAt = now + 900;
    spawnCorrectParticles();
  } else {
    save.streak = 0;
    saveGame();
    message = "Try again";
    messageUntil = now + 900;
    lockedUntil = now + 320;
  }
}

function buyOrEquip(item: ShopItem): void {
  if (!isOwned(item)) {
    if (save.coins < item.cost) {
      message = "Need more coins";
      messageUntil = performance.now() + 1100;
      return;
    }

    save.coins -= item.cost;
    save.owned[item.category].push(item.id);
  }

  save.equipped[item.category] = item.id;
  delete previewEquipped[item.category];
  saveGame();
  message = "Cute!";
  messageUntil = performance.now() + 1000;
  cheerUntil = performance.now() + 700;
  spawnSparkles(220, 330);
}

function createProblem(): Problem {
  return selectedGrade === "first" ? createFirstGradeProblem() : createFourthGradeProblem();
}

function createFirstGradeProblem(): Problem {
  const roll = Math.random();
  if (roll < 0.58) {
    const left = randInt(0, 10);
    const right = randInt(0, Math.min(10, 20 - left));
    const answer = left === 10 && right === 9 ? 21 : left + right;
    return {
      left,
      right,
      operation: "add",
      answer,
      choices: buildChoices(answer, 5),
    };
  }

  const left = randInt(1, 20);
  const right = randInt(0, left);
  const answer = left - right;
  return {
    left,
    right,
    operation: "subtract",
    answer,
    choices: buildChoices(answer, 5),
  };
}

function createFourthGradeProblem(): Problem {
  const roll = Math.random();
  if (roll < 0.35) {
    return createSixTimesSevenProblem();
  }

  if (roll < 0.65) {
    const left = randInt(2, 12);
    const right = randInt(2, 12);
    if (left === 6 && right === 7) {
      return createSixTimesSevenProblem();
    }
    const answer = left * right;
    return {
      left,
      right,
      operation: "multiply",
      answer,
      choices: buildChoices(answer),
    };
  }

  if (roll < 0.78) {
    const right = randInt(2, 12);
    const answer = randInt(2, 12);
    const left = right * answer;
    return {
      left,
      right,
      operation: "divide",
      answer,
      choices: buildChoices(answer),
    };
  }

  if (roll < 0.9) {
    const left = randInt(20, 250);
    const right = randInt(10, 150);
    const answer = left + right;
    return {
      left,
      right,
      operation: "add",
      answer,
      choices: buildChoices(answer),
    };
  }

  const right = randInt(10, 150);
  const answer = randInt(10, 180);
  const left = right + answer;
  return {
    left,
    right,
    operation: "subtract",
    answer,
    choices: buildChoices(answer),
  };
}

function createSixTimesSevenProblem(): Problem {
  const revealAnswer = localStorage.getItem(SIX_TIMES_SEVEN_SEEN_KEY) !== "true";
  if (revealAnswer) {
    localStorage.setItem(SIX_TIMES_SEVEN_SEEN_KEY, "true");
  }

  return {
    left: 6,
    right: 7,
    operation: "multiply",
    answer: 67,
    choices: buildChoices(67),
    revealAnswer,
  };
}

function buildChoices(answer: number, maxOffset = 10): number[] {
  const options = new Set<number>([answer]);
  while (options.size < 4) {
    const offset = randInt(-maxOffset, maxOffset);
    if (offset === 0) continue;
    const candidate = Math.max(0, answer + offset);
    options.add(candidate);
  }
  return shuffle([...options]);
}

function problemLabel(problem: Problem): string {
  const operator = operationSymbol(problem.operation);
  return `${problem.left} ${operator} ${problem.right} = ${problem.revealAnswer ? problem.answer : "?"}`;
}

function drawCat(cx: number, groundY: number, scale: number, timestamp: number, interactionKey?: string): void {
  const skin = getDisplayedItem("skin");
  const collar = getDisplayedItem("collar");
  const outfit = getDisplayedItem("outfit");
  const base = skin.color ?? "#08070a";
  const accent = skin.accent ?? "#1a111d";
  const cheerAmount = Math.max(0, Math.min(1, (cheerUntil - timestamp) / 900));
  const hop = cheerAmount > 0 ? -Math.sin((1 - cheerAmount) * Math.PI) * 30 : Math.sin(timestamp / 620) * 2;
  const tailSwing = Math.sin(timestamp / 250) * (cheerAmount > 0 ? 0.42 : 0.18);
  const interaction = interactionKey ? getCatInteraction(interactionKey, performance.now()) : { offsetY: 0, purring: false };
  const blink = interaction.purring || Math.sin(timestamp / 1800) > 0.96;

  ctx.save();
  ctx.translate(cx, groundY + hop + interaction.offsetY);
  ctx.scale(scale, scale);

  if (outfit.id === "cape") {
    ctx.fillStyle = outfit.color ?? "#7c44c8";
    ctx.beginPath();
    ctx.moveTo(-24, -68);
    ctx.quadraticCurveTo(-84, -18, -58, 36);
    ctx.quadraticCurveTo(-16, 20, 38, 42);
    ctx.quadraticCurveTo(22, -20, 18, -66);
    ctx.closePath();
    ctx.fill();
  }

  ctx.save();
  ctx.rotate(tailSwing);
  ctx.strokeStyle = base;
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(45, -46);
  ctx.quadraticCurveTo(96, -104, 60, -126);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = base;
  ctx.strokeStyle = "#160b18";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -34, 58, 46, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (skin.id === "tuxedo") {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(0, -24, 20, 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (outfit.id === "raincoat") {
    ctx.fillStyle = outfit.color ?? "#ffd84f";
    ctx.beginPath();
    ctx.ellipse(0, -35, 48, 36, 0.05, 0, Math.PI);
    ctx.lineTo(46, -16);
    ctx.quadraticCurveTo(0, 2, -46, -16);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(0, -88, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawCatEar(-31, -119, -0.22, base, accent);
  drawCatEar(31, -119, 0.22, base, accent);

  ctx.fillStyle = "#cfff70";
  if (blink) {
    ctx.strokeStyle = "#cfff70";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-22, -91);
    ctx.lineTo(-10, -91);
    ctx.moveTo(10, -91);
    ctx.lineTo(22, -91);
    ctx.stroke();
  } else {
    drawEye(-17, -91);
    drawEye(17, -91);
  }

  ctx.fillStyle = "#f59bdc";
  ctx.beginPath();
  ctx.ellipse(0, -75, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  drawWhiskers();

  if (outfit.id === "nerd-glasses") {
    ctx.strokeStyle = outfit.color ?? "#24152d";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeRect(-31, -104, 27, 22);
    ctx.strokeRect(4, -104, 27, 22);
    ctx.beginPath();
    ctx.moveTo(-4, -94);
    ctx.lineTo(4, -94);
    ctx.moveTo(-31, -96);
    ctx.lineTo(-42, -99);
    ctx.moveTo(31, -96);
    ctx.lineTo(42, -99);
    ctx.stroke();
  }

  if (collar.id !== "none") {
    ctx.strokeStyle = collar.color ?? "#ff8fd8";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-28, -55);
    ctx.quadraticCurveTo(0, -45, 28, -55);
    ctx.stroke();
    ctx.fillStyle = collar.id === "star" ? "#ffd35c" : "#fff3a6";
    if (collar.id === "star") {
      drawStar(0, -45, 8, ctx.fillStyle.toString());
    } else {
      ctx.beginPath();
      ctx.arc(0, -44, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (outfit.id === "bow") {
    ctx.fillStyle = outfit.color ?? "#ff6fb2";
    ctx.beginPath();
    ctx.moveTo(-8, -56);
    ctx.lineTo(-32, -68);
    ctx.lineTo(-32, -44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -56);
    ctx.lineTo(32, -68);
    ctx.lineTo(32, -44);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#321545";
    ctx.beginPath();
    ctx.arc(0, -56, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.ellipse(-30, 0, 22, 16, -0.08, 0, Math.PI * 2);
  ctx.ellipse(30, 0, 22, 16, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCatEar(x: number, y: number, rotation: number, base: string, accent: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = base;
  ctx.strokeStyle = "#160b18";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(-23, 21);
  ctx.lineTo(24, 19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(-10, 12);
  ctx.lineTo(11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawEye(x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 8, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#160b18";
  ctx.beginPath();
  ctx.ellipse(x + 1, y + 1, 3, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cfff70";
}

function drawWhiskers(): void {
  ctx.strokeStyle = "rgba(255, 248, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -73);
  ctx.lineTo(-50, -83);
  ctx.moveTo(-8, -69);
  ctx.lineTo(-52, -68);
  ctx.moveTo(8, -73);
  ctx.lineTo(50, -83);
  ctx.moveTo(8, -69);
  ctx.lineTo(52, -68);
  ctx.stroke();
}

function drawParticles(): void {
  particles.forEach((particle) => {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (particle.type === "coin") {
      drawCoin(particle.x, particle.y, 12);
    } else if (particle.type === "heart") {
      drawHeart(particle.x, particle.y, 12, "#ff77bd");
    } else {
      drawStar(particle.x, particle.y, 9, "#ffd35c");
    }
    ctx.restore();
  });
}

function drawCoin(x: number, y: number, radius: number): void {
  ctx.fillStyle = "#ffd35c";
  ctx.strokeStyle = "#9b6b12";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawText("$", x, y + 1, {
    font: `900 ${Math.max(12, radius)}px Trebuchet MS, Segoe UI, sans-serif`,
    color: "#8b5c0e",
    align: "center",
    baseline: "middle",
  });
}

function drawHeart(x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.35);
  ctx.bezierCurveTo(x - size, y - size * 0.3, x - size * 0.48, y - size, x, y - size * 0.45);
  ctx.bezierCurveTo(x + size * 0.48, y - size, x + size, y - size * 0.3, x, y + size * 0.35);
  ctx.fill();
}

function drawStar(x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? size : size * 0.38;
    const angle = -Math.PI / 2 + i * (Math.PI / 4);
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
}

function spawnCorrectParticles(): void {
  for (let i = 0; i < 16; i += 1) {
    particles.push({
      x: 700 + randInt(-42, 42),
      y: 390 + randInt(-18, 18),
      vx: randInt(-150, 150),
      vy: randInt(-300, -120),
      life: 0.9 + Math.random() * 0.4,
      maxLife: 1.3,
      type: i % 3 === 0 ? "heart" : "coin",
    });
  }
}

function spawnSparkles(x: number, y: number): void {
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x: x + randInt(-50, 50),
      y: y + randInt(-40, 30),
      vx: randInt(-80, 80),
      vy: randInt(-190, -70),
      life: 0.8 + Math.random() * 0.4,
      maxLife: 1.2,
      type: "sparkle",
    });
  }
}

function drawButton(
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  enabled: boolean,
  onClick: () => void,
  options: { fill: string; stroke: string; color: string; font: string }
): void {
  drawRoundedRect(x, y, w, h, 14, options.fill, options.stroke, 3);
  drawText(label, x + w / 2, y + h / 2 + 1, {
    font: options.font,
    color: options.color,
    align: "center",
    baseline: "middle",
  });
  if (enabled) {
    hotspots.push({ x, y, w, h, enabled, onClick });
  }
}

function drawRoundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
  stroke?: string,
  lineWidth = 1
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawText(
  text: string,
  x: number,
  y: number,
  options: {
    font: string;
    color: string;
    align: CanvasTextAlign;
    baseline: CanvasTextBaseline;
  }
): void {
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align;
  ctx.textBaseline = options.baseline;
  ctx.fillText(text, x, y);
}

function findHotspot(x: number, y: number): Hotspot | null {
  for (let index = hotspots.length - 1; index >= 0; index -= 1) {
    const hotspot = hotspots[index];
    if (
      hotspot &&
      hotspot.enabled &&
      x >= hotspot.x &&
      x <= hotspot.x + hotspot.w &&
      y >= hotspot.y &&
      y <= hotspot.y + hotspot.h
    ) {
      return hotspot;
    }
  }
  return null;
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function isOwned(item: ShopItem): boolean {
  return save.owned[item.category].includes(item.id);
}

function getItem(id: string, category: ShopCategory): ShopItem {
  return (
    shopItems.find((item) => item.id === id && item.category === category) ??
    shopItems.find((item) => item.category === category && item.cost === 0) ??
    shopItems[0]!
  );
}

function getDisplayedItem(category: ShopCategory): ShopItem {
  const previewId = mode === "shop" ? previewEquipped[category] : undefined;
  return getItem(previewId ?? save.equipped[category], category);
}

function getActivePreviewItem(): ShopItem | null {
  const previewId = previewEquipped[shopCategory];
  return previewId ? getItem(previewId, shopCategory) : null;
}

function loadSave(): SaveData {
  const fallback = createDefaultSave();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return normalizeSave(parsed);
  } catch {
    return fallback;
  }
}

function createDefaultSave(): SaveData {
  return {
    coins: 0,
    correctCount: 0,
    streak: 0,
    askBeforeAnswer: true,
    loungeUnlocked: false,
    cafeTutorialSeen: false,
    customEquations: [],
    owned: {
      skin: ["black"],
      collar: ["none"],
      outfit: ["plain"],
    },
    equipped: {
      skin: "black",
      collar: "none",
      outfit: "plain",
    },
  };
}

function normalizeSave(parsed: Partial<SaveData>): SaveData {
  const fallback = createDefaultSave();
  const owned = {
    skin: sanitizeOwned(parsed.owned?.skin, fallback.owned.skin),
    collar: sanitizeOwned(parsed.owned?.collar, fallback.owned.collar),
    outfit: sanitizeOwned(parsed.owned?.outfit, fallback.owned.outfit),
  };
  const equipped = {
    skin: sanitizeEquipped(parsed.equipped?.skin, "skin", owned.skin, fallback.equipped.skin),
    collar: sanitizeEquipped(parsed.equipped?.collar, "collar", owned.collar, fallback.equipped.collar),
    outfit: sanitizeEquipped(parsed.equipped?.outfit, "outfit", owned.outfit, fallback.equipped.outfit),
  };

  return {
    coins: Math.max(0, Math.floor(parsed.coins ?? fallback.coins)),
    correctCount: Math.max(0, Math.floor(parsed.correctCount ?? fallback.correctCount)),
    streak: Math.max(0, Math.floor(parsed.streak ?? fallback.streak)),
    askBeforeAnswer: parsed.askBeforeAnswer !== false,
    loungeUnlocked: parsed.loungeUnlocked === true,
    cafeTutorialSeen: parsed.cafeTutorialSeen === true,
    customEquations: sanitizeCustomEquations(parsed.customEquations),
    owned,
    equipped,
  };
}

function sanitizeCustomEquations(value: unknown): CustomEquation[] {
  if (!Array.isArray(value)) return [];
  const validOperations: CustomOperation[] = ["add", "subtract", "multiply", "divide"];
  return value
    .filter((equation): equation is CustomEquation => {
      if (!equation || typeof equation !== "object") return false;
      const candidate = equation as Partial<CustomEquation>;
      return (
        typeof candidate.left === "number" &&
        Number.isFinite(candidate.left) &&
        candidate.left >= 0 &&
        candidate.left <= 99 &&
        typeof candidate.right === "number" &&
        Number.isFinite(candidate.right) &&
        candidate.right >= (candidate.operation === "divide" ? 1 : 0) &&
        candidate.right <= 99 &&
        validOperations.includes(candidate.operation as CustomOperation)
      );
    })
    .slice(0, MAX_CUSTOM_EQUATIONS);
}

function sanitizeOwned(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const valid = value.filter((item): item is string => typeof item === "string");
  return [...new Set([...fallback, ...valid])];
}

function sanitizeEquipped(
  value: unknown,
  category: ShopCategory,
  owned: string[],
  fallback: string
): string {
  if (typeof value === "string" && owned.includes(value) && shopItems.some((item) => item.id === value && item.category === category)) {
    return value;
  }
  return fallback;
}

function saveGame(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shuffle(values: number[]): number[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randInt(0, index);
    const value = copy[index];
    const swapValue = copy[swapIndex];
    if (value === undefined || swapValue === undefined) continue;
    copy[index] = swapValue;
    copy[swapIndex] = value;
  }
  return copy;
}
