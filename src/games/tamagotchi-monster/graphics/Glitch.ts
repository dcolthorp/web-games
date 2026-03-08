import { randomChoice } from "../systems/utils";

export type GlitchType = "static" | "screen_tear" | "color_pulse";

const GLITCH_TEXTS = [
  "h3_w4tch3s...",
  "n0_3sc4p3",
  "y0u_f0und_m3",
  "d0nt_l00k_4w4y",
  "1t_b3g1ns...",
  "XYY4$992WQERS",
  "NU11_4W4K3NS",
  "th3_v01d_c4lls",
];

function drawStaticOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, intensity = 0.5) {
  const count = Math.floor(width * height * intensity * 0.002);
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const shade = 80 + Math.floor(Math.random() * 120);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.6)`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawScreenTear(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  offscreen: HTMLCanvasElement
) {
  const tearCount = 3;
  const octx = offscreen.getContext("2d");
  if (!octx) return;
  offscreen.width = width;
  offscreen.height = height;
  octx.drawImage(ctx.canvas, 0, 0);
  for (let i = 0; i < tearCount; i += 1) {
    const baseY = ((height / (tearCount + 1)) * (i + 1)) | 0;
    const tearY = baseY + Math.sin(progress * Math.PI * 4 + i) * 20;
    const tearHeight = 6 + Math.random() * 10;
    const displacement = Math.sin(progress * Math.PI * 2 + i) * 30;
    ctx.drawImage(
      offscreen,
      0,
      tearY,
      width,
      tearHeight,
      displacement,
      tearY,
      width,
      tearHeight
    );
  }
}

function drawColorPulse(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  const alpha = Math.sin(progress * Math.PI) * 0.3;
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(139,0,0,${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

function drawGlitchText(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  if (!((progress > 0.2 && progress < 0.4) || (progress > 0.6 && progress < 0.8))) return;
  const text = randomChoice(GLITCH_TEXTS);
  ctx.font = "28px system-ui, sans-serif";
  for (let i = -2; i <= 2; i += 1) {
    ctx.fillStyle = `rgb(${100 + Math.random() * 155},${Math.random() * 50},${Math.random() * 50})`;
    ctx.fillText(text, width / 2 - 100 + Math.random() * 10, height / 2 + i * 6);
  }
}

export class GlitchManager {
  private ambientMin: number;
  private ambientMax: number;
  private timeUntilAmbient: number;

  private activeGlitch: GlitchType | null = null;
  private glitchProgress = 0;
  private glitchDuration = 0;

  private inSequence = false;
  private sequenceProgress = 0;
  private sequenceDuration = 2;
  private sequenceComplete = false;

  private offscreen: HTMLCanvasElement;

  constructor(ambientInterval: [number, number] = [30, 60]) {
    this.ambientMin = ambientInterval[0];
    this.ambientMax = ambientInterval[1];
    this.timeUntilAmbient = this.randomAmbientDelay();
    this.offscreen = document.createElement("canvas");
  }

  private randomAmbientDelay(): number {
    return this.ambientMin + Math.random() * (this.ambientMax - this.ambientMin);
  }

  trigger(glitchType: GlitchType, duration = 0.15): void {
    this.activeGlitch = glitchType;
    this.glitchProgress = 0;
    this.glitchDuration = duration;
  }

  triggerAmbient(): void {
    const type: GlitchType = Math.random() > 0.5 ? "static" : "color_pulse";
    this.trigger(type, 0.1 + Math.random() * 0.1);
  }

  startSequence(duration = 2): void {
    this.inSequence = true;
    this.sequenceProgress = 0;
    this.sequenceDuration = duration;
    this.sequenceComplete = false;
  }

  isSequenceComplete(): boolean {
    return this.sequenceComplete;
  }

  update(dt: number): void {
    if (this.inSequence) {
      this.sequenceProgress += dt / this.sequenceDuration;
      if (this.sequenceProgress >= 1) {
        this.inSequence = false;
        this.sequenceComplete = true;
        this.sequenceProgress = 1;
      }
    }
    if (this.activeGlitch && this.glitchDuration > 0) {
      this.glitchProgress += dt / this.glitchDuration;
      if (this.glitchProgress >= 1) {
        this.activeGlitch = null;
        this.glitchProgress = 0;
      }
    }
    if (!this.inSequence) {
      this.timeUntilAmbient -= dt;
      if (this.timeUntilAmbient <= 0) {
        this.triggerAmbient();
        this.timeUntilAmbient = this.randomAmbientDelay();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.inSequence) {
      drawStaticOverlay(ctx, width, height, 0.5);
      if (this.sequenceProgress > 0.2 && this.sequenceProgress < 0.8) {
        drawScreenTear(ctx, width, height, this.sequenceProgress, this.offscreen);
      }
      drawColorPulse(ctx, width, height, this.sequenceProgress);
      drawGlitchText(ctx, width, height, this.sequenceProgress);
    } else if (this.activeGlitch) {
      if (this.activeGlitch === "static") drawStaticOverlay(ctx, width, height, 0.4);
      if (this.activeGlitch === "screen_tear")
        drawScreenTear(ctx, width, height, this.glitchProgress, this.offscreen);
      if (this.activeGlitch === "color_pulse") drawColorPulse(ctx, width, height, this.glitchProgress);
    }
  }
}

