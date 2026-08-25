/**
 * What breaking 100 velocity does to the game.
 *
 * Beats 1 and 2 are painted onto the game canvas: you stop being able to steer
 * and just go, forever, whichever way you were pointing, and then ones and
 * zeros start turning up. Beats 3 to 5 take over the whole page, because the
 * joke only works if it really looks like the thing fell over — a blue screen
 * you can't click past, and then a hand that reaches in and takes the screen
 * away.
 */

import { beatAt, beatProgress, TOTAL, type Beat } from "./meltdown-beats";
import type { Body } from "./bodies";

type Digit = { x: number; y: number; char: string; size: number; born: number; life: number };

export type Meltdown = {
  running(): boolean;
  /** Beats 1-2 draw over the game; after that the page overlay owns the screen. */
  ownsCanvas(): boolean;
  start(from: Body, aim: number): void;
  update(dt: number): void;
  drawCanvas(): void;
  beat(): Beat;
};

export function createMeltdown(
  context: CanvasRenderingContext2D,
  W: number,
  H: number,
  overlay: {
    root: HTMLElement;
    screen: HTMLElement;
    canvas: HTMLCanvasElement;
    progress: HTMLElement;
  },
  onArrive: () => void,
): Meltdown {
  const handContext = overlay.canvas.getContext("2d")!;

  let elapsed = 0;
  let active = false;
  /** Wall clock, so starved frames can never leave you stuck in here. */
  let startedAt = 0;
  let body: Body | null = null;
  let aim = -Math.PI / 2;
  let travelled = 0;
  let digits: Digit[] = [];
  let lastBeat: Beat = "runaway";
  /** Where the hand grabs, so the pull-in goes towards it and not the middle. */
  let grabAt = { x: 0.5, y: 0.5 };

  function start(from: Body, direction: number): void {
    if (active) return;
    active = true;
    elapsed = 0;
    startedAt = performance.now();
    travelled = 0;
    digits = [];
    body = from;
    aim = direction;
    lastBeat = "runaway";
    document.body.dataset["meltdown"] = "on";
  }

  function finish(): void {
    active = false;
    overlay.root.hidden = true;
    overlay.screen.style.transform = "";
    overlay.screen.style.opacity = "";
    delete document.body.dataset["meltdown"];
    onArrive();
  }

  // ---- the two beats that play on the game canvas ------------------------

  function spawnDigits(dt: number, intensity: number): void {
    const wanted = Math.round(intensity * 90 * dt * 12);
    for (let i = 0; i < wanted; i += 1) {
      digits.push({
        x: Math.random() * W,
        y: Math.random() * H,
        char: Math.random() < 0.5 ? "0" : "1",
        size: 12 + Math.random() * 30,
        born: elapsed,
        life: 0.4 + Math.random() * 0.9,
      });
    }
    digits = digits.filter((digit) => elapsed - digit.born < digit.life);
  }

  function drawRunaway(): void {
    const sky = context.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, body?.skyTop ?? "#2e5f8a");
    sky.addColorStop(1, body?.skyBottom ?? "#7fb3a8");
    context.fillStyle = sky;
    context.fillRect(0, 0, W, H);

    const speed = beatAt(elapsed) === "runaway" ? beatProgress(elapsed) : 1;
    const dx = Math.cos(aim);
    const dy = Math.sin(aim);

    // Streaks along the direction of travel, scrolling past forever.
    context.lineCap = "round";
    for (let i = 0; i < 60; i += 1) {
      const seed = (i * 97.13) % 1;
      const across = ((i * 137.5) % 360) / 360;
      const along = (seed + travelled * 0.0016) % 1;
      const cx = (-dy * (across - 0.5) * 1.6 + dx * (along - 0.5) * 2) * W * 0.7 + W / 2;
      const cy = (dx * (across - 0.5) * 1.6 + dy * (along - 0.5) * 2) * H * 1.2 + H / 2;
      const length = 30 + speed * 190 * (0.4 + seed);
      context.strokeStyle = `rgba(255, 255, 255, ${0.06 + speed * 0.22 * seed})`;
      context.lineWidth = 1 + seed * 2.5;
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx - dx * length, cy - dy * length);
      context.stroke();
    }

    // You, stuck going that way, with a smear behind you.
    const wobble = Math.sin(elapsed * 22) * speed * 3;
    for (let ghost = 5; ghost >= 0; ghost -= 1) {
      const back = ghost * (10 + speed * 26);
      const x = W / 2 - dx * back - dy * wobble;
      const y = H / 2 - dy * back + dx * wobble;
      drawFigure(x, y, ghost === 0 ? 1 : 0.16 * (1 - ghost / 6));
    }
  }

  function drawFigure(x: number, y: number, alpha: number): void {
    context.save();
    context.translate(x, y);
    context.globalAlpha = alpha;
    context.strokeStyle = "#f4f7ff";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.beginPath();
    context.arc(0, -14, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(0, 8);
    context.moveTo(0, -2);
    context.lineTo(-9, 4);
    context.moveTo(0, -2);
    context.lineTo(9, 4);
    context.moveTo(0, 8);
    context.lineTo(-7, 19);
    context.moveTo(0, 8);
    context.lineTo(7, 19);
    context.stroke();
    context.restore();
  }

  function drawDigits(): void {
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const digit of digits) {
      const age = (elapsed - digit.born) / digit.life;
      context.font = `700 ${Math.round(digit.size)}px 'Courier New', monospace`;
      context.fillStyle = `rgba(120, 255, 160, ${(1 - age) * 0.9})`;
      context.fillText(digit.char, digit.x, digit.y);
    }
  }

  /** Slices of the picture shoved sideways, harder as it gets worse. */
  function glitchSlices(intensity: number): void {
    const slices = Math.round(intensity * 9);
    for (let i = 0; i < slices; i += 1) {
      const y = Math.random() * H;
      const h = 6 + Math.random() * 34;
      const shift = (Math.random() - 0.5) * intensity * 130;
      context.drawImage(context.canvas, 0, y, W, h, shift, y, W, h);
    }
  }

  function drawCanvas(): void {
    const beat = beatAt(elapsed);
    if (beat === "runaway") {
      drawRunaway();
      return;
    }
    if (beat === "digits") {
      drawRunaway();
      drawDigits();
      glitchSlices(beatProgress(elapsed));
    }
  }

  // ---- the hand, drawn on the full-page overlay --------------------------

  /**
   * Sized every frame rather than once on the way in: measuring a single time
   * can catch the overlay before it has been laid out and leave a 0x0 canvas,
   * and it would go stale anyway if the window were resized mid-crash.
   */
  function sizeOverlay(): void {
    const w = overlay.root.clientWidth || window.innerWidth;
    const h = overlay.root.clientHeight || window.innerHeight;
    if (overlay.canvas.width !== w || overlay.canvas.height !== h) {
      overlay.canvas.width = w;
      overlay.canvas.height = h;
    }
  }

  function drawHand(progress: number): void {
    sizeOverlay();
    const canvas = overlay.canvas;
    const w = canvas.width;
    const h = canvas.height;
    handContext.clearRect(0, 0, w, h);

    // Reaches in from the right, swipes left across the face, then grabs.
    const reach = Math.min(1, progress / 0.45);
    const swipe = Math.max(0, Math.min(1, (progress - 0.4) / 0.35));
    const eased = 1 - (1 - reach) ** 3;
    const x = w * (1.25 - eased * 0.72) - swipe * w * 0.42;
    const y = h * (0.52 + Math.sin(progress * 6) * 0.02);
    grabAt = { x: x / w, y: y / h };

    // Ones and zeros churning around it.
    handContext.textAlign = "center";
    handContext.textBaseline = "middle";
    for (let i = 0; i < 60; i += 1) {
      const angle = i * 0.9 + progress * 7;
      const radius = 70 + ((i * 37) % 190) + Math.sin(progress * 5 + i) * 22;
      const dx = x + Math.cos(angle) * radius;
      const dy = y + Math.sin(angle) * radius * 0.8;
      handContext.font = `700 ${14 + ((i * 7) % 18)}px 'Courier New', monospace`;
      handContext.fillStyle = `rgba(120, 255, 160, ${0.25 + ((i * 13) % 60) / 120})`;
      handContext.fillText(i % 2 ? "1" : "0", dx, dy);
    }

    const scale = Math.min(w, h) / 780;
    handContext.save();
    handContext.translate(x, y);
    handContext.scale(scale, scale);
    handContext.fillStyle = "#f0c39a";
    handContext.strokeStyle = "#3a2318";
    handContext.lineWidth = 8;
    handContext.lineJoin = "round";

    // Fingers and thumb go down first so the palm covers where they join it.
    const curl = Math.max(0, Math.min(1, (progress - 0.62) / 0.3));
    const fingers = [
      { y: -62, length: 104 },
      { y: -21, length: 132 },
      { y: 20, length: 124 },
      { y: 60, length: 98 },
    ];
    for (const finger of fingers) {
      const length = finger.length * (1 - curl * 0.62);
      handContext.beginPath();
      handContext.roundRect(20 - length, finger.y - 17, length + 40, 34, 17);
      handContext.fill();
      handContext.stroke();
    }

    handContext.save();
    handContext.translate(46, 78);
    handContext.rotate(0.62);
    const thumb = 116 * (1 - curl * 0.45);
    handContext.beginPath();
    handContext.roundRect(-24, -18, thumb + 24, 36, 18);
    handContext.fill();
    handContext.stroke();
    handContext.restore();

    // Palm, then the forearm running off the edge of the screen.
    handContext.beginPath();
    handContext.roundRect(10, -86, 205, 172, 52);
    handContext.fill();
    handContext.stroke();

    handContext.beginPath();
    handContext.roundRect(170, -74, 700, 148, 46);
    handContext.fill();
    handContext.stroke();

    // A crease, so the palm reads as a palm and not a slab.
    handContext.strokeStyle = "rgba(58, 35, 24, 0.35)";
    handContext.lineWidth = 5;
    handContext.beginPath();
    handContext.moveTo(56, -34);
    handContext.quadraticCurveTo(104, 4, 62, 48);
    handContext.stroke();

    handContext.restore();
  }

  // ---- the loop -----------------------------------------------------------

  function update(dt: number): void {
    if (!active) return;
    elapsed += dt;
    const beat = beatAt(elapsed);
    const progress = beatProgress(elapsed);

    if (beat === "runaway" || beat === "digits") {
      travelled += (240 + progress * 900) * dt;
    }
    if (beat === "digits") spawnDigits(dt, progress);

    if (beat !== lastBeat) {
      lastBeat = beat;
      if (beat === "bsod") {
        overlay.root.hidden = false;
        sizeOverlay();
        handContext.clearRect(0, 0, overlay.canvas.width, overlay.canvas.height);
      }
    }

    if (beat === "bsod") {
      // The fake "restarting" counter that never gets there.
      overlay.progress.textContent = `${Math.floor(progress * 74)}% complete`;
    }

    if (beat === "hand") {
      drawHand(progress);
      // Once it has hold of the screen, it drags the whole thing away.
      const pull = Math.max(0, (progress - 0.72) / 0.28);
      if (pull > 0) {
        const shrink = 1 - pull;
        overlay.screen.style.transformOrigin = `${grabAt.x * 100}% ${grabAt.y * 100}%`;
        overlay.screen.style.transform = `scale(${shrink}) rotate(${pull * 14}deg)`;
        overlay.screen.style.opacity = `${Math.max(0, 1 - pull * 0.9)}`;
      }
    }

    // Either the sequence played out, or real time ran well past it and the
    // frames never came. Both end the same way: you go to The Matrix.
    if (elapsed >= TOTAL || performance.now() - startedAt > (TOTAL + 8) * 1000) finish();
  }

  return {
    running: () => active,
    ownsCanvas: () => active && (beatAt(elapsed) === "runaway" || beatAt(elapsed) === "digits"),
    start,
    update,
    drawCanvas,
    beat: () => beatAt(elapsed),
  };
}
