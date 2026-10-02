import { isGigantic } from "../../shared/bigGames";

// GIGANTIC A Kid's Life: the family stays normal size, and the room around
// them (the cloud, the picture on the wall, the furniture) goes giant.
export const GIGANTIC = isGigantic("a-kids-life");
export const GIANT = GIGANTIC ? 2.5 : 1;
export const GAME_TITLE = GIGANTIC ? "GIGANTIC A Kid's Life" : "A Kid's Life";

/** Draws something GIANT times bigger, growing out from the point (x, y). */
export function drawGiant(ctx: CanvasRenderingContext2D, x: number, y: number, draw: () => void): void {
  if (!GIGANTIC) {
    draw();
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(GIANT, GIANT);
  ctx.translate(-x, -y);
  draw();
  ctx.restore();
}
