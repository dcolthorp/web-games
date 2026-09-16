// How the jumper is drawn: a plain shape in a colour, or one of the outfits
// from the Dressing Room.

import type { Outfit } from "./shop";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function drawOutfit(
  ctx: CanvasRenderingContext2D,
  box: Box,
  outfit: Outfit,
  flashColor: string | null,
  time: number
): void {
  if (outfit.outfit) {
    drawSpecialOutfit(ctx, box, outfit.outfit, flashColor, time);
    return;
  }
  const color = flashColor ?? outfit.color;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  ctx.fillStyle = color;
  if (outfit.shape === "circle") {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(box.width, box.height) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(centerX, box.y);
    ctx.lineTo(box.x, box.y + box.height);
    ctx.lineTo(box.x + box.width, box.y + box.height);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(box.x, box.y, box.width, box.height);
  }
}

function drawSpecialOutfit(
  ctx: CanvasRenderingContext2D,
  box: Box,
  outfitId: string,
  flashColor: string | null,
  time: number
): void {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const { width, height } = box;
  const bottom = box.y + height;
  const right = box.x + width;

  if (outfitId === "outfit:spider") {
    const color = flashColor ?? "#000000";
    const bodyRadius = Math.min(width, height) / 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
    // Eight legs that shuffle as you run.
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const wiggle = Math.sin(time * 5) * 0.3;
    for (let leg = 0; leg < 8; leg += 1) {
      const angle = (leg / 8) * Math.PI * 2;
      const startX = centerX + bodyRadius * Math.cos(angle);
      const startY = centerY + bodyRadius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(
        startX + bodyRadius * 1.5 * Math.cos(angle + wiggle),
        startY + bodyRadius * 1.5 * Math.sin(angle + wiggle)
      );
      ctx.stroke();
    }
    return;
  }

  if (outfitId === "outfit:ghost") {
    ctx.fillStyle = flashColor ?? "#ffffff";
    ctx.beginPath();
    ctx.moveTo(centerX, box.y);
    ctx.lineTo(box.x, box.y + height / 3);
    const waves = 3;
    for (let i = 0; i <= waves; i += 1) {
      const x = box.x + (i / waves) * width;
      const y = bottom + Math.sin((i / waves) * Math.PI * 2 + time * 3) * 5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(right, box.y + height / 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#000000";
    const eye = width / 8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(centerX + (side * width) / 4, centerY - height / 4, eye, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (outfitId === "outfit:christmas_tree") {
    ctx.fillStyle = flashColor ?? "#228b22";
    const triangle = (tipY: number, leftX: number, rightX: number, baseY: number): void => {
      ctx.beginPath();
      ctx.moveTo(centerX, tipY);
      ctx.lineTo(leftX, baseY);
      ctx.lineTo(rightX, baseY);
      ctx.closePath();
      ctx.fill();
    };
    triangle(bottom, box.x, right, box.y + height / 2);
    triangle(box.y + height / 3, box.x + width / 4, right - width / 4, box.y + height / 2);
    triangle(box.y, box.x + width / 3, right - width / 3, box.y + height / 3);
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(centerX, box.y, width / 8, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (outfitId === "outfit:turkey") {
    const color = flashColor ?? "#8b4513";
    const bodyRadius = Math.min(width, height) / 3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    const feathers = 7;
    for (let i = 0; i < feathers; i += 1) {
      const angle = -Math.PI / 2 + (i / (feathers - 1)) * (Math.PI / 3);
      const startX = centerX - bodyRadius;
      ctx.beginPath();
      ctx.moveTo(startX, centerY);
      ctx.lineTo(
        startX - bodyRadius * 1.5 * Math.cos(angle),
        centerY + bodyRadius * 1.5 * Math.sin(angle)
      );
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX + bodyRadius, centerY - bodyRadius / 2, bodyRadius / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (outfitId === "outfit:gingerbread_man") {
    const color = flashColor ?? "#8b4513";
    ctx.fillStyle = color;
    const ellipse = (x: number, y: number, w: number, h: number): void => {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    ellipse(box.x + width / 4, box.y + height / 4, width / 2, height / 2);
    ctx.beginPath();
    ctx.arc(centerX, box.y + width / 6, width / 6, 0, Math.PI * 2);
    ctx.fill();
    ellipse(box.x, box.y + height / 3, width / 8, height / 3);
    ellipse(right - width / 8, box.y + height / 3, width / 8, height / 3);
    ellipse(box.x + width / 4, bottom - height / 3, width / 6, height / 3);
    ellipse(right - width / 4 - width / 6, bottom - height / 3, width / 6, height / 3);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - width / 4, box.y + height / 2);
    ctx.lineTo(centerX + width / 4, box.y + height / 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let button = 0; button < 3; button += 1) {
      ctx.beginPath();
      ctx.arc(centerX, box.y + height / 2 + (button - 1) * (height / 8), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = flashColor ?? "#808080";
  ctx.fillRect(box.x, box.y, box.width, box.height);
}
