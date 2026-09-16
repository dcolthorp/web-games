// Drawing The Simulation's world in first person, with plain canvas: every block
// face you can see is worked out, turned into a flat shape on the screen, and
// painted back to front so the near ones cover the far ones.

import { EYE, type Player } from "./player";
import { BLACK, BLUE, EMPTY, LADDER, PLAIN, blockAt, type World } from "./world";

export const SKY = "#0e1622";
const VIEW_DISTANCE = 26;
// Anything closer than this to your eyes is behind the screen.
const NEAR = 0.08;
const FIELD_OF_VIEW = 1.15;

export interface Sprite {
  x: number;
  y: number;
  z: number;
  kind: "fragment" | "glitch";
  size: number;
}

interface Corner {
  x: number;
  y: number;
  z: number;
}

// Which way each of a block's six faces points, its corners, and how much light
// it catches: tops are bright, undersides are nearly black.
const FACES: { normal: Corner; corners: Corner[]; shade: number }[] = [
  { normal: { x: 0, y: 1, z: 0 }, shade: 1, corners: [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 1, z: 1 }] },
  { normal: { x: 0, y: -1, z: 0 }, shade: 0.5, corners: [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] },
  { normal: { x: 1, y: 0, z: 0 }, shade: 0.74, corners: [{ x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 0 }] },
  { normal: { x: -1, y: 0, z: 0 }, shade: 0.68, corners: [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 }] },
  { normal: { x: 0, y: 0, z: 1 }, shade: 0.58, corners: [{ x: 1, y: 0, z: 1 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }] },
  { normal: { x: 0, y: 0, z: -1 }, shade: 0.52, corners: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }] },
];

const BLOCK_COLORS: Record<number, [number, number, number]> = {
  [PLAIN]: [96, 108, 128],
  [BLUE]: [64, 148, 255],
  [LADDER]: [196, 140, 72],
  [BLACK]: [6, 6, 9],
};
const SKY_RGB: [number, number, number] = [14, 22, 34];

// Where the world is, seen from your eyes: x is right, y is up, z is forwards.
interface View {
  x: number;
  y: number;
  z: number;
}

function shadeOf(block: number, shade: number, depth: number): string {
  const base = BLOCK_COLORS[block] ?? BLOCK_COLORS[PLAIN] ?? [56, 64, 78];
  // Things fade into the dark the further away they are.
  const fog = Math.min(1, (depth / VIEW_DISTANCE) ** 1.9);
  const mix = (colour: number, sky: number): number => Math.round((colour * shade) * (1 - fog) + sky * fog);
  return `rgb(${mix(base[0], SKY_RGB[0])}, ${mix(base[1], SKY_RGB[1])}, ${mix(base[2], SKY_RGB[2])})`;
}

interface Piece {
  depth: number;
  paint: () => void;
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  world: World,
  player: Player,
  sprites: Sprite[],
  now: number
): void {
  const focal = W / 2 / Math.tan(FIELD_OF_VIEW / 2);
  const eyeY = player.y + EYE;
  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);
  const sinPitch = Math.sin(player.pitch);
  const cosPitch = Math.cos(player.pitch);

  // Which way you're facing, which way is your right, and which way is up for you.
  const ahead = { x: sinYaw * cosPitch, y: sinPitch, z: cosYaw * cosPitch };
  const right = { x: cosYaw, y: 0, z: -sinYaw };
  const above = { x: -sinYaw * sinPitch, y: cosPitch, z: -cosYaw * sinPitch };

  const toView = (x: number, y: number, z: number): View => {
    const dx = x - player.x;
    const dy = y - eyeY;
    const dz = z - player.z;
    return {
      x: dx * right.x + dy * right.y + dz * right.z,
      y: dx * above.x + dy * above.y + dz * above.z,
      z: dx * ahead.x + dy * ahead.y + dz * ahead.z,
    };
  };

  // Cuts off the part of a shape that's behind your eyes, so it doesn't smear
  // across the screen.
  const clipToScreen = (points: View[]): View[] => {
    const kept: View[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const here = points[i];
      const next = points[(i + 1) % points.length];
      if (!here || !next) continue;
      const hereIn = here.z >= NEAR;
      const nextIn = next.z >= NEAR;
      if (hereIn) kept.push(here);
      if (hereIn !== nextIn) {
        const along = (NEAR - here.z) / (next.z - here.z);
        kept.push({
          x: here.x + (next.x - here.x) * along,
          y: here.y + (next.y - here.y) * along,
          z: NEAR,
        });
      }
    }
    return kept;
  };

  const pieces: Piece[] = [];
  const reach = Math.ceil(VIEW_DISTANCE);
  const fromX = Math.max(-1, Math.floor(player.x) - reach);
  const toX = Math.min(world.sizeX, Math.floor(player.x) + reach);
  const fromZ = Math.max(-1, Math.floor(player.z) - reach);
  const toZ = Math.min(world.sizeZ, Math.floor(player.z) + reach);

  for (let x = fromX; x <= toX; x += 1) {
    for (let z = fromZ; z <= toZ; z += 1) {
      for (let y = 0; y < world.sizeY; y += 1) {
        const block = blockAt(world, x, y, z);
        if (block === EMPTY) continue;
        const middleX = x + 0.5;
        const middleY = y + 0.5;
        const middleZ = z + 0.5;
        const away = Math.hypot(middleX - player.x, middleY - eyeY, middleZ - player.z);
        if (away > VIEW_DISTANCE) continue;

        for (const face of FACES) {
          const beyond = blockAt(world, x + face.normal.x, y + face.normal.y, z + face.normal.z);
          // Faces buried against another block are never seen.
          if (beyond !== EMPTY && !(block !== LADDER && beyond === LADDER)) continue;
          // Nor are the ones pointing away from you.
          const facingX = middleX + face.normal.x * 0.5 - player.x;
          const facingY = middleY + face.normal.y * 0.5 - eyeY;
          const facingZ = middleZ + face.normal.z * 0.5 - player.z;
          if (facingX * face.normal.x + facingY * face.normal.y + facingZ * face.normal.z > 0) continue;

          const corners = clipToScreen(face.corners.map((corner) => toView(x + corner.x, y + corner.y, z + corner.z)));
          if (corners.length < 3) continue;
          const depth = corners.reduce((total, corner) => total + corner.z, 0) / corners.length;
          const fill = shadeOf(block, face.shade, away);
          pieces.push({
            depth,
            paint: () => {
              ctx.beginPath();
              corners.forEach((corner, i) => {
                const screenX = W / 2 + (corner.x * focal) / corner.z;
                const screenY = H / 2 - (corner.y * focal) / corner.z;
                if (i === 0) ctx.moveTo(screenX, screenY);
                else ctx.lineTo(screenX, screenY);
              });
              ctx.closePath();
              ctx.fillStyle = fill;
              ctx.fill();
              // A thin outline in the same colour hides the seams between faces.
              ctx.strokeStyle = fill;
              ctx.lineWidth = 1;
              ctx.stroke();
            },
          });
        }
      }
    }
  }

  for (const sprite of sprites) {
    const middle = toView(sprite.x, sprite.y, sprite.z);
    if (middle.z < NEAR) continue;
    const away = Math.hypot(sprite.x - player.x, sprite.y - eyeY, sprite.z - player.z);
    if (away > VIEW_DISTANCE) continue;
    const screenX = W / 2 + (middle.x * focal) / middle.z;
    const screenY = H / 2 - (middle.y * focal) / middle.z;
    const size = (sprite.size * focal) / middle.z;
    const fade = 1 - Math.min(1, (away / VIEW_DISTANCE) ** 1.4);
    pieces.push({
      depth: middle.z,
      paint: () => {
        if (sprite.kind === "fragment") paintFragment(ctx, screenX, screenY, size, fade, now);
        else paintGlitch(ctx, screenX, screenY, size, fade, now);
      },
    });
  }

  // Far away first, so nearer things paint over them.
  pieces.sort((one, other) => other.depth - one.depth);
  for (const piece of pieces) piece.paint();
}

// A glitch fragment: a small spinning green shard.
function paintFragment(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fade: number, now: number): void {
  const squash = Math.abs(Math.cos(now / 600)) * 0.7 + 0.3;
  ctx.globalAlpha = Math.max(0.15, fade);
  ctx.shadowColor = "#6dff9c";
  ctx.shadowBlur = size * 0.8;
  ctx.fillStyle = "#a6ff9b";
  ctx.beginPath();
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x + (size / 2) * squash, y);
  ctx.lineTo(x, y + size / 2);
  ctx.lineTo(x - (size / 2) * squash, y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// A glitch: a tall torn-up shape that never stops flickering.
function paintGlitch(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fade: number, now: number): void {
  const width = size * 0.55;
  ctx.globalAlpha = Math.max(0.2, fade);
  ctx.fillStyle = "#05060a";
  ctx.fillRect(x - width / 2, y - size / 2, width, size);
  const bands = 7;
  for (let band = 0; band < bands; band += 1) {
    const bandY = y - size / 2 + (band / bands) * size;
    const slip = Math.sin(now / 70 + band * 2.3) * width * 0.45;
    ctx.fillStyle = band % 2 === 0 ? "#ff2f6d" : "#39ffd0";
    ctx.globalAlpha = Math.max(0.2, fade) * (0.25 + 0.55 * Math.abs(Math.sin(now / 90 + band)));
    ctx.fillRect(x - width / 2 + slip, bandY, width, Math.max(1, size / bands / 2));
  }
  ctx.globalAlpha = 1;
}
