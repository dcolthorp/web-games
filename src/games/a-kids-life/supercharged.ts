import { isThisGameSupercharged } from "../../shared/superchargedHub";

// Supercharged by dev.1: whoever you're playing as crackles with lightning,
// every activity fills up twice as fast, and finishing one gives double
// hearts and double care stars, so your kid grows up twice as fast.
export const SUPERCHARGED = isThisGameSupercharged();
export const SUPERCHARGE_BOOST = SUPERCHARGED ? 2 : 1;

/** Little lightning bolts flickering in a ring around (x, y). */
export function drawLightningAura(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number): void {
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.shadowColor = "#5ad0ff";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  // A new zigzag ten times a second, so it flickers.
  const flicker = Math.floor(time * 10);
  const bolts = 6;
  for (let i = 0; i < bolts; i += 1) {
    const angle = (i / bolts) * Math.PI * 2 + time * 0.8;
    let bx = x + Math.cos(angle) * radius;
    let by = y + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    for (let step = 1; step <= 4; step += 1) {
      const wobble = Math.sin(flicker * 7.3 + i * 3.1 + step * 5.7) * 14;
      bx += Math.cos(angle) * 16 - Math.sin(angle) * wobble;
      by += Math.sin(angle) * 16 + Math.cos(angle) * wobble;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  ctx.restore();
}
