import type { Face3, Vec3 } from "./render3d";

// A first-person 3D drawer for walking around a whole world (walk.ts).
// Like render3d.ts it fills faces in pixel by pixel and keeps the closest,
// but the camera is a person standing in the world: it turns left and right,
// cuts off whatever is behind you, and fades faraway things into the sky.
// It draws small and gets stretched up, which keeps it quick.

export interface Camera {
  x: number;
  y: number; // eye height
  z: number;
  yaw: number; // 0 looks along +z; turning right makes it bigger
  pitch: number; // 0 looks straight ahead; up is bigger
}

const NEAR = 0.15;
const FOV = (70 * Math.PI) / 180;
const LIGHT: Vec3 = (() => {
  const l: Vec3 = [-0.4, 0.85, -0.35];
  const len = Math.hypot(...l);
  return [l[0] / len, l[1] / len, l[2] / len];
})();

export class FirstPerson {
  readonly canvas: HTMLCanvasElement;
  private readonly pen: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly depth: Float32Array; // 1/distance; bigger is closer
  private cam: Camera = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly f: number;

  constructor(readonly w: number, readonly h: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    this.pen = this.canvas.getContext("2d")!;
    this.image = this.pen.createImageData(w, h);
    this.depth = new Float32Array(w * h);
    this.f = w / 2 / Math.tan(FOV / 2);
  }

  /** Into camera space: x right, y up, z forward. */
  private view(p: Vec3): Vec3 {
    const dx = p[0] - this.cam.x;
    const dz = p[2] - this.cam.z;
    const c = Math.cos(this.cam.yaw);
    const s = Math.sin(this.cam.yaw);
    const x = dx * c - dz * s;
    const y = p[1] - this.cam.y;
    const z = dx * s + dz * c;
    // Looking up or down tips everything the other way.
    const cp = Math.cos(this.cam.pitch);
    const sp = Math.sin(this.cam.pitch);
    return [x, y * cp - z * sp, y * sp + z * cp];
  }

  render(faces: Face3[], cam: Camera, sky: [string, string], fog: Vec3): void {
    this.cam = cam;
    const { w, h, f } = this;
    // Sky first (the depth buffer says "nothing here yet").
    const grad = this.pen.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(1, sky[1]);
    this.pen.fillStyle = grad;
    this.pen.fillRect(0, 0, w, h);
    const skyPixels = this.pen.getImageData(0, 0, w, h).data;
    const px = this.image.data;
    px.set(skyPixels);
    this.depth.fill(0);

    for (const face of faces) {
      const pts = face.pts.map((p) => this.view(p));
      const clipped = clipNear(pts);
      if (clipped.length < 3) continue;
      // Shade by which way the face points, turned to face us.
      let nx = 0, ny = 0, nz = 0, mx = 0, my = 0, mz = 0;
      const world = face.pts;
      for (let i = 0; i < world.length; i++) {
        const a = world[i]!, b = world[(i + 1) % world.length]!;
        nx += (a[1] - b[1]) * (a[2] + b[2]);
        ny += (a[2] - b[2]) * (a[0] + b[0]);
        nz += (a[0] - b[0]) * (a[1] + b[1]);
        mx += a[0];
        my += a[1];
        mz += a[2];
      }
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-9) continue;
      const n = world.length;
      if (nx * (mx / n - cam.x) + ny * (my / n - cam.y) + nz * (mz / n - cam.z) > 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const light = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / len);
      const shade = 0.5 + 0.55 * light;
      const dist = clipped.reduce((sum, p) => sum + p[2], 0) / clipped.length;
      const fade = Math.min(0.75, Math.max(0, (dist - 25) / 140));
      const r = Math.min(255, face.rgb[0] * shade) * (1 - fade) + fog[0] * fade;
      const g = Math.min(255, face.rgb[1] * shade) * (1 - fade) + fog[1] * fade;
      const b = Math.min(255, face.rgb[2] * shade) * (1 - fade) + fog[2] * fade;
      const screen = clipped.map(([x, y, z]) => [w / 2 + (x / z) * f, h / 2 - (y / z) * f, 1 / z] as Vec3);
      for (let i = 1; i < screen.length - 1; i++) fill(screen[0]!, screen[i]!, screen[i + 1]!, r, g, b, px, this.depth, w, h);
    }
    this.pen.putImageData(this.image, 0, 0);
  }

  /** Where a point in the world shows up on the small picture, and whether something is in front of it. */
  spot(p: Vec3): { x: number; y: number; dist: number; seen: boolean } | null {
    const [x, y, z] = this.view(p);
    if (z < NEAR) return null;
    const sx = this.w / 2 + (x / z) * this.f;
    const sy = this.h / 2 - (y / z) * this.f;
    if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) return null;
    const d = this.depth[Math.floor(sy) * this.w + Math.floor(sx)]!;
    return { x: sx, y: sy, dist: z, seen: d <= 1 / z + 0.02 };
  }
}

/** Cuts off the part of a polygon that's behind you (too close to the eye). */
function clipNear(pts: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const aIn = a[2] >= NEAR;
    const bIn = b[2] >= NEAR;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

function fill(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  r: number,
  g: number,
  bl: number,
  px: Uint8ClampedArray,
  depth: Float32Array,
  w: number,
  h: number,
): void {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-6) return;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    const sy = y + 0.5;
    for (let x = minX; x <= maxX; x++) {
      const sx = x + 0.5;
      const w0 = ((c[0] - b[0]) * (sy - b[1]) - (c[1] - b[1]) * (sx - b[0])) * inv;
      const w1 = ((a[0] - c[0]) * (sy - c[1]) - (a[1] - c[1]) * (sx - c[0])) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const iz = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const i = y * w + x;
      if (iz <= depth[i]!) continue;
      depth[i] = iz;
      const o = i * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = bl;
      px[o + 3] = 255;
    }
  }
}
