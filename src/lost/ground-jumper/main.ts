// Ground Jumper, brought over from Oscar's Python project: a welcome menu, the
// runner, the Dressing Room you unlock at 500, and The Lost Levels hiding
// behind a key sequence nobody tells you about.

import { drawOutfit } from "./appearance";
import {
  DRESSING_ROOM_UNLOCK_SCORE,
  LANE_COLORS,
  LANE_ORDER,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from "./constants";
import { drawGame } from "./draw";
import { laneChange, newGame, pressJump, step, type Controls, type Game, type ModeName } from "./game";
import {
  buy,
  equip,
  itemsOfType,
  laneColorsOf,
  loadProfile,
  outfitOf,
  owns,
  saveProfile,
  type CatalogItem,
  type ItemType,
  type Profile,
} from "./shop";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas");
const context = canvas.getContext("2d");
if (!context) throw new Error("no 2d context");
// Named again so every helper below knows it's really there.
const ctx: CanvasRenderingContext2D = context;

type Scene = "menu" | "reveal" | "playing" | "gameOver" | "dressingRoom";

let profile: Profile = loadProfile();
let scene: Scene = "menu";
let game: Game | null = null;
let menuIndex = 0;
let noTimer = 0;
let revealTime = 0;
let animationTime = 0;

const controls: Controls = { left: false, right: false, jump: false };

// The Dressing Room only appears once the runner high score is good enough.
const dressingRoomUnlocked = (): boolean => profile.highScoreRunner >= DRESSING_ROOM_UNLOCK_SCORE;

function menuOptions(): string[] {
  const options = ["Start Game"];
  if (dressingRoomUnlocked()) options.push("Dressing Room");
  options.push("Quit");
  return options;
}

// UP DOWN LEFT LEFT RIGHT, all inside a second and a half.
const SECRET = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowLeft", "ArrowRight"];
let secretProgress: string[] = [];
let secretStarted = 0;

function pushSecret(key: string, now: number): boolean {
  if (secretProgress.length > 0 && now - secretStarted > 1.5) secretProgress = [];
  secretProgress.push(key);
  if (secretProgress.length === 1) secretStarted = now;
  const expected = SECRET.slice(0, secretProgress.length);
  if (secretProgress.join() !== expected.join()) {
    secretProgress = key === SECRET[0] ? [key] : [];
    secretStarted = now;
    return false;
  }
  if (secretProgress.length === SECRET.length) {
    secretProgress = [];
    return true;
  }
  return false;
}

function startGame(mode: ModeName): void {
  const best = mode === "runner" ? profile.highScoreRunner : profile.highScoreLostLevels;
  game = newGame(mode, best);
  scene = "playing";
}

function endGame(): void {
  if (!game) return;
  profile.balance += game.earnings;
  if (game.mode === "runner") {
    profile.highScoreRunner = Math.max(profile.highScoreRunner, game.score);
  } else {
    profile.highScoreLostLevels = Math.max(profile.highScoreLostLevels, game.score);
  }
  saveProfile(profile);
}

// ---------------------------------------------------------------- dressing room

const TABS: ItemType[] = ["shape", "color", "outfit", "theme"];
let tabIndex = 0;
let itemIndex = 0;

function dressingRoomKey(key: string): void {
  const items = itemsOfType(TABS[tabIndex] ?? "shape");
  if (key === "Escape") {
    scene = "menu";
    menuIndex = 0;
    return;
  }
  if (key === "ArrowLeft" || key === "q") {
    tabIndex = (tabIndex - 1 + TABS.length) % TABS.length;
    itemIndex = 0;
    return;
  }
  if (key === "ArrowRight" || key === "e") {
    tabIndex = (tabIndex + 1) % TABS.length;
    itemIndex = 0;
    return;
  }
  if (key === "ArrowUp" || key === "w") {
    itemIndex = Math.max(0, itemIndex - 1);
    return;
  }
  if (key === "ArrowDown" || key === "s") {
    itemIndex = Math.min(items.length - 1, itemIndex + 1);
    return;
  }
  if (key === "Enter" || key === " ") {
    const item = items[itemIndex];
    if (!item) return;
    if (owns(profile, item.id)) equip(profile, item);
    else if (buy(profile, item)) equip(profile, item);
    saveProfile(profile);
  }
}

function drawDressingRoom(): void {
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.font = "40px monospace";
  ctx.fillStyle = "#f0f0f0";
  ctx.fillText("Dressing Room", WINDOW_WIDTH / 2, 20);

  ctx.textAlign = "right";
  ctx.font = "22px monospace";
  ctx.fillStyle = "#ffd700";
  ctx.fillText(`Coins: ${profile.balance}`, WINDOW_WIDTH - 20, 24);
  ctx.textAlign = "left";

  const tabWidth = WINDOW_WIDTH / TABS.length;
  TABS.forEach((tab, index) => {
    const selected = index === tabIndex;
    ctx.fillStyle = selected ? "#282832" : "#14141e";
    ctx.fillRect(index * tabWidth, 90, tabWidth - 2, 35);
    ctx.strokeStyle = selected ? "#ffffff" : "#8c8c8c";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(index * tabWidth, 90, tabWidth - 2, 35);
    ctx.fillStyle = selected ? "#ffffff" : "#8c8c8c";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText(tab.toUpperCase(), index * tabWidth + tabWidth / 2, 100);
    ctx.textAlign = "left";
  });

  const items = itemsOfType(TABS[tabIndex] ?? "shape");
  const maxVisible = 8;
  const scroll = Math.max(0, itemIndex - maxVisible + 1);
  items.slice(scroll, scroll + maxVisible).forEach((item, offset) => {
    const index = scroll + offset;
    const y = 140 + offset * 40;
    const selected = index === itemIndex;
    const isOwned = owns(profile, item.id);
    ctx.fillStyle = selected ? "#32323c" : "#1e1e28";
    ctx.fillRect(20, y, 300, 38);
    if (selected) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(20, y, 300, 38);
    }
    ctx.font = "18px monospace";
    ctx.fillStyle = isOwned ? "#ffffff" : profile.balance >= item.price ? "#b4b4b4" : "#646464";
    ctx.fillText(item.name, 30, y + 4);
    ctx.font = "14px monospace";
    if (isOwned) {
      const equipped = isEquipped(item);
      ctx.fillStyle = equipped ? "#64ff64" : "#64c864";
      ctx.fillText(equipped ? "WEARING" : "OWNED", 30, y + 22);
    } else {
      ctx.fillStyle = profile.balance >= item.price ? "#ffd700" : "#969696";
      ctx.fillText(`$${item.price}`, 30, y + 22);
    }
  });

  // The preview mannequin.
  const previewX = 350;
  const previewY = 140;
  const previewWidth = WINDOW_WIDTH - previewX - 20;
  const previewHeight = WINDOW_HEIGHT - previewY - 100;
  ctx.fillStyle = "#14141e";
  ctx.fillRect(previewX, previewY, previewWidth, previewHeight);
  ctx.strokeStyle = "#646464";
  ctx.lineWidth = 2;
  ctx.strokeRect(previewX, previewY, previewWidth, previewHeight);
  ctx.fillStyle = "#b4b4b4";
  ctx.font = "14px monospace";
  ctx.fillText("PREVIEW", previewX + 10, previewY + 10);

  const item = items[itemIndex];
  const preview = previewOutfit(item);
  const size = 120;
  drawOutfit(
    ctx,
    {
      x: previewX + previewWidth / 2 - size / 2,
      y: previewY + previewHeight / 2 - size / 2,
      width: size,
      height: size,
    },
    preview,
    null,
    animationTime
  );

  // A theme changes the lanes, so show those instead of the jumper.
  if (item && item.type === "theme") {
    const colors = item.laneColors ?? LANE_COLORS;
    LANE_ORDER.forEach((lane, index) => {
      ctx.fillStyle = colors[lane] ?? "#444";
      ctx.fillRect(previewX + 40, previewY + previewHeight - 40 - index * 26, previewWidth - 80, 20);
    });
  }

  ctx.textAlign = "center";
  ctx.font = "16px monospace";
  ctx.fillStyle = "#787878";
  ctx.fillText(dressingRoomHint(item), WINDOW_WIDTH / 2, WINDOW_HEIGHT - 30);
  ctx.textAlign = "left";
}

function isEquipped(item: CatalogItem): boolean {
  if (item.type === "shape") return !profile.outfit && profile.shape === item.id.split(":")[1];
  if (item.type === "color") return !profile.outfit && profile.color === item.id;
  if (item.type === "outfit") return profile.outfit === item.id;
  return profile.theme === item.id;
}

function previewOutfit(item: CatalogItem | undefined): ReturnType<typeof outfitOf> {
  if (!item) return outfitOf(profile);
  if (item.type === "shape") return { shape: item.id.split(":")[1] ?? "rectangle", color: "#ffffff", outfit: null };
  if (item.type === "color") return { shape: "rectangle", color: item.color ?? "#ffffff", outfit: null };
  if (item.type === "outfit") return { shape: "", color: "#ffffff", outfit: item.id };
  return outfitOf(profile);
}

function dressingRoomHint(item: CatalogItem | undefined): string {
  if (!item) return "ESC: back";
  if (owns(profile, item.id)) return "←/→ tabs · ↑/↓ items · ENTER to wear · ESC back";
  if (profile.balance >= item.price) return `ENTER to buy ($${item.price}) · ESC back`;
  return `${item.price - profile.balance} more coins needed · ESC back`;
}

// ------------------------------------------------------------------- menu draw

function drawMenu(): void {
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.font = "56px monospace";
  ctx.fillStyle = "#f0f0f0";
  ctx.fillText("Ground Jumper", WINDOW_WIDTH / 2, 140);

  const options = menuOptions();
  ctx.textAlign = "left";
  ctx.font = "28px monospace";
  options.forEach((option, index) => {
    const selected = index === menuIndex;
    ctx.fillStyle = selected ? "#ffffff" : "#b4b4b4";
    ctx.fillText(`${selected ? "> " : "  "}${option}`, WINDOW_WIDTH / 2 - 150, 240 + index * 36);
  });

  ctx.textAlign = "center";
  ctx.font = "20px monospace";
  ctx.fillStyle = "#787878";
  ctx.fillText("ENTER to confirm · ↑/↓ to choose", WINDOW_WIDTH / 2, WINDOW_HEIGHT - 80);
  if (!dressingRoomUnlocked()) {
    ctx.fillStyle = "#5a5a5a";
    ctx.font = "16px monospace";
    ctx.fillText(
      `Dressing Room opens at ${DRESSING_ROOM_UNLOCK_SCORE} points`,
      WINDOW_WIDTH / 2,
      WINDOW_HEIGHT - 50
    );
  }

  // You don't get to quit.
  if (noTimer > 0) {
    ctx.font = "56px monospace";
    ctx.fillStyle = "#ff5050";
    ctx.fillText("NO", WINDOW_WIDTH / 2, 80);
  }
  ctx.textAlign = "left";
}

function drawReveal(): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
  if (revealTime < 1) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "64px monospace";
  ctx.fillStyle = "#dc2020";
  ctx.fillText("The Lost Levels", WINDOW_WIDTH / 2, WINDOW_HEIGHT / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
}

function drawGameOver(): void {
  if (!game) return;
  drawGame(ctx, game, outfitOf(profile), laneColorsOf(profile) ?? LANE_COLORS);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
  ctx.textAlign = "center";
  ctx.font = "48px monospace";
  ctx.fillStyle = "#fff0f0";
  ctx.fillText("Game Over", WINDOW_WIDTH / 2, 200);
  ctx.font = "22px monospace";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText(`Score ${game.score}  ·  Coins earned ${game.earnings}`, WINDOW_WIDTH / 2, 262);
  ctx.fillText("Press any key for the menu", WINDOW_WIDTH / 2, 300);
  ctx.textAlign = "left";
}

function drawPaused(): void {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
  ctx.textAlign = "center";
  ctx.font = "24px monospace";
  ctx.fillStyle = "#f0f0f0";
  ctx.fillText("Paused · ESC to resume · Q to quit", WINDOW_WIDTH / 2, WINDOW_HEIGHT / 2 - 14);
  ctx.textAlign = "left";
}

// ----------------------------------------------------------------------- input

window.addEventListener("keydown", (event) => {
  const key = event.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) event.preventDefault();

  if (scene === "menu") {
    if (pushSecret(key, performance.now() / 1000)) {
      scene = "reveal";
      revealTime = 0;
      return;
    }
    const options = menuOptions();
    if (key === "ArrowUp" || key === "w") menuIndex = (menuIndex - 1 + options.length) % options.length;
    else if (key === "ArrowDown" || key === "s") menuIndex = (menuIndex + 1) % options.length;
    else if (key === "Enter" || key === " ") {
      const option = options[menuIndex];
      if (option === "Start Game") startGame("runner");
      else if (option === "Dressing Room") {
        scene = "dressingRoom";
        tabIndex = 0;
        itemIndex = 0;
      } else noTimer = 1;
    }
    return;
  }

  if (scene === "dressingRoom") {
    dressingRoomKey(key);
    return;
  }

  if (scene === "gameOver") {
    scene = "menu";
    menuIndex = 0;
    game = null;
    return;
  }

  if (scene === "playing" && game) {
    if (key === "Escape") {
      game.paused = !game.paused;
      return;
    }
    if (key === "q" && game.paused) {
      endGame();
      game = null;
      scene = "menu";
      return;
    }
    if (key === "ArrowUp") laneChange(game, +1);
    else if (key === "ArrowDown") laneChange(game, -1);
    else if (key === " ") pressJump(game);
    else if (key === "ArrowLeft" || key === "a") controls.left = true;
    else if (key === "ArrowRight" || key === "d") controls.right = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key === "a") controls.left = false;
  if (event.key === "ArrowRight" || event.key === "d") controls.right = false;
});

window.addEventListener("blur", () => {
  controls.left = false;
  controls.right = false;
});

// ------------------------------------------------------------------ the loop

let lastFrame = performance.now();

function frame(now: number): void {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  animationTime += seconds;
  if (noTimer > 0) noTimer = Math.max(0, noTimer - seconds);

  if (scene === "menu") {
    drawMenu();
  } else if (scene === "dressingRoom") {
    drawDressingRoom();
  } else if (scene === "reveal") {
    revealTime += seconds;
    drawReveal();
    if (revealTime >= 3) startGame("lost_levels");
  } else if (scene === "playing" && game) {
    step(game, controls, seconds);
    drawGame(ctx, game, outfitOf(profile), laneColorsOf(profile) ?? LANE_COLORS);
    if (game.paused) drawPaused();
    if (game.over) {
      endGame();
      scene = "gameOver";
    }
  } else if (scene === "gameOver") {
    drawGameOver();
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Touchscreens get the same three things a keyboard has: tap the top of the
// screen to move back a lane, the bottom to come forward, the middle to jump.
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (scene === "menu" || scene === "gameOver") {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    return;
  }
  if (!game) return;
  const bounds = canvas.getBoundingClientRect();
  const third = bounds.height / 3;
  const y = event.clientY - bounds.top;
  if (y < third) laneChange(game, +1);
  else if (y > third * 2) laneChange(game, -1);
  else pressJump(game);
});
