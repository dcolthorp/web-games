// Painting a frame of Ground Jumper: three lane bands, everything on them
// back-to-front, and the HUD on top.

import { drawOutfit } from "./appearance";
import {
  FLASH_DURATION,
  LANE_BAND_HEIGHT,
  LANE_BASE_TOP,
  LANE_COLORS,
  LANE_GAP,
  LANE_GROUND_MARGIN,
  LANE_ORDER,
  LANE_X_OFFSET,
  MAX_HEARTS,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
} from "./constants";
import type { Entity } from "./entities";
import type { Game } from "./game";
import { playerRect } from "./player";
import type { Outfit } from "./shop";

const RAINBOW_RING_COLORS = [
  "#ff0000",
  "#ff7f00",
  "#ffff00",
  "#00c800",
  "#0080ff",
  "#4b0082",
  "#8f00ff",
];

export function drawGame(
  ctx: CanvasRenderingContext2D,
  game: Game,
  outfit: Outfit,
  laneColors: Record<number, string>
): void {
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

  LANE_ORDER.forEach((lane, index) => {
    ctx.fillStyle = laneColors[lane] ?? LANE_COLORS[lane] ?? "#444";
    ctx.fillRect(0, LANE_BASE_TOP - index * (LANE_BAND_HEIGHT + LANE_GAP), WINDOW_WIDTH, LANE_BAND_HEIGHT);
  });

  // Back lane first, so the front lane covers it like it should.
  for (const lane of [...LANE_ORDER].reverse()) {
    for (const entity of game.entities) {
      if (entity.lane === lane) drawEntity(ctx, entity);
    }
    if (game.player.lane === lane) drawPlayer(ctx, game, outfit);
  }

  drawHud(ctx, game);

  if (game.flashOverlay > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.7, (game.flashOverlay / FLASH_DURATION) * 0.7)})`;
    ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game, outfit: Outfit): void {
  const player = game.player;
  const flashing = player.flashTimer > 0 && Math.floor(player.flashTimer * 10) % 2 === 0;
  drawOutfit(ctx, playerRect(player), outfit, flashing ? "#ff4040" : null, player.animationTime);
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: Entity): void {
  const baseX = entity.x + (LANE_X_OFFSET[entity.lane] ?? 0);
  const top = entity.y - entity.height;

  switch (entity.kind) {
    case "wall":
      ctx.fillStyle = "#dedee8";
      ctx.fillRect(baseX, top, entity.width, entity.height);
      return;
    case "longWall":
      ctx.fillStyle = "#cdcdd7";
      ctx.fillRect(baseX, top, entity.width, entity.height);
      return;
    case "movingWall":
      ctx.fillStyle = "#dedee8";
      ctx.fillRect(baseX, top, entity.width, entity.height);
      // A little arrow so you can tell which way it's about to hop.
      ctx.fillStyle = "#6a6a80";
      ctx.fillRect(baseX + 14, top + (entity.direction === 1 ? 10 : entity.height - 18), 12, 8);
      return;
    case "block":
      ctx.fillStyle = "#8c8cc8";
      ctx.fillRect(baseX, top, entity.width, entity.height);
      return;
    case "spike":
      ctx.fillStyle = "#dcdcdc";
      ctx.beginPath();
      ctx.moveTo(baseX, entity.y);
      ctx.lineTo(baseX + entity.width / 2, entity.y - entity.height);
      ctx.lineTo(baseX + entity.width, entity.y);
      ctx.closePath();
      ctx.fill();
      return;
    case "disguisedWall": {
      if (entity.isIllusion) {
        const flashing =
          entity.flashStarted && Math.floor((entity.flashTimer ?? 0) / 0.15) % 2 === 0;
        ctx.fillStyle = flashing ? "#f0f0ff" : "#a0aab4";
      } else {
        ctx.fillStyle = "#b4b4b4";
      }
      ctx.fillRect(baseX, top, entity.width, entity.height);
      return;
    }
    case "trap": {
      // A missing piece of lane: just a hole.
      const holeTop = entity.y - LANE_BAND_HEIGHT + LANE_GROUND_MARGIN;
      const width = entity.gapWidth ?? entity.width;
      ctx.fillStyle = "#000000";
      ctx.fillRect(baseX, holeTop, width, LANE_BAND_HEIGHT);
      ctx.strokeStyle = "#1e1e1e";
      ctx.lineWidth = 2;
      ctx.strokeRect(baseX, holeTop, width, LANE_BAND_HEIGHT);
      return;
    }
    case "coin": {
      const radius = entity.width / 2;
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(baseX, entity.y - radius, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "dollar":
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(baseX, entity.y - entity.height, entity.width, entity.height);
      return;
    case "diamond": {
      const size = entity.width / 2;
      ctx.fillStyle = "#87ceeb";
      ctx.beginPath();
      ctx.moveTo(baseX, entity.y - size);
      ctx.lineTo(baseX + size, entity.y - size / 2);
      ctx.lineTo(baseX, entity.y);
      ctx.lineTo(baseX - size, entity.y - size / 2);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case "mystery": {
      const radius = entity.width / 2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(baseX, entity.y - radius, radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(baseX, entity.y - radius, radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case "heart":
      drawHeart(ctx, baseX, entity.y, 10);
      return;
    case "rainbow": {
      const radius = entity.width / 2;
      ctx.lineWidth = 3;
      RAINBOW_RING_COLORS.forEach((color, index) => {
        const ringRadius = radius - index * 3;
        if (ringRadius <= 0) return;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(baseX, entity.y - radius, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.fillStyle = "#b41e3c";
  ctx.beginPath();
  ctx.arc(x - size / 2, y - size / 2, size / 2, 0, Math.PI * 2);
  ctx.arc(x + size / 2, y - size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - size, y - size / 2);
  ctx.lineTo(x + size, y - size / 2);
  ctx.lineTo(x, y + size / 2);
  ctx.closePath();
  ctx.fill();
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.textBaseline = "top";
  ctx.font = "20px monospace";
  ctx.fillStyle = "#f0f0f0";
  ctx.fillText(`Score: ${game.score}`, 12, 10);
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText(`High: ${game.highScore}`, 12, 34);

  const label = game.mode === "lost_levels" ? "The Lost Levels" : "Runner";
  ctx.fillStyle = "#d2d2ff";
  ctx.textAlign = "right";
  ctx.fillText(label, WINDOW_WIDTH - 12, 10);
  if (game.inversionTime > 0) {
    ctx.fillText(`Inversion: ${game.inversionTime.toFixed(1)}s`, WINDOW_WIDTH - 12, 36);
  }
  ctx.textAlign = "left";

  const bar = game.player.damageBar;
  if (bar) {
    const width = 200;
    const height = 16;
    ctx.fillStyle = "#3c3c3c";
    ctx.fillRect(12, 60, width, height);
    ctx.strokeStyle = "#646464";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 60, width, height);
    const fill = Math.round(width * (bar.current / bar.max));
    if (fill > 0) {
      ctx.fillStyle =
        bar.current > bar.max * 0.6 ? "#3cc850" : bar.current > bar.max * 0.3 ? "#dcb43c" : "#dc3c3c";
      ctx.fillRect(12, 60, fill, height);
    }
    ctx.fillStyle = "#f0f0f0";
    ctx.font = "16px monospace";
    ctx.fillText(`${Math.round(bar.current)}/${Math.round(bar.max)}`, 12 + width + 8, 60);
    if (bar.regenerating) {
      ctx.fillStyle = "#8cffa0";
      ctx.fillText("healing", 12 + width + 78, 60);
    }
    return;
  }

  for (let heart = 0; heart < Math.min(game.player.hearts, MAX_HEARTS); heart += 1) {
    drawHeart(ctx, 20 + heart * 22, 72, 10);
  }
}
