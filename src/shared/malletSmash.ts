// The mallet (Penelope, 2026-11-20), for pages that aren't a canvas game.
// A trap door opens at (x, y) on the screen, a wooden mallet with a white
// strip rises out, a clock counts down 5 to 1, it turns to face you, goes far
// away, zooms at the screen and cracks it (see crackedScreen.ts).
// My Cozy Sewing has its own copy drawn on its canvas.

import { crackScreen } from "./crackedScreen";

let audio: AudioContext | null = null;
function beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.1, when = 0) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime + when;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    // No sound.
  }
}
function boom() {
  try {
    audio ??= new AudioContext();
    const len = audio.sampleRate * 0.8;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audio.createBufferSource();
    const g = audio.createGain();
    g.gain.value = 0.6;
    src.buffer = buf;
    src.connect(g).connect(audio.destination);
    src.start();
  } catch {
    // No sound.
  }
  beep(70, 0.6, "sawtooth", 0.35);
  [2400, 3100, 1900, 2800].forEach((f, i) => beep(f, 0.12, "triangle", 0.08, 0.05 + i * 0.06));
}

/** Runs the whole mallet smash. Resolves when it's over. */
export function malletSmash(holeX: number, holeY: number): Promise<void> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    // It blocks clicks while the mallet is out.
    canvas.style.cssText = `position:fixed;inset:0;width:${W}px;height:${H}px;z-index:2147483645;`;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const top = Math.max(110, holeY - 260);
    let step: "rise" | "count" | "turn" | "back" | "zoom" | "sink" = "rise";
    let t = 0;
    let flash = 0;
    let last = performance.now();

    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    };
    const side = (cy: number, sx: number, n: number) => {
      ctx.fillStyle = "#a0683a";
      ctx.fillRect(holeX - 14, cy + 50, 28, holeY - cy - 50);
      ctx.save();
      ctx.translate(holeX, cy);
      ctx.scale(sx, 1);
      ctx.fillStyle = "#c48a55";
      rr(-140, -58, 280, 116, 24);
      ctx.fill();
      ctx.fillStyle = "#9c6535";
      rr(-140, -58, 34, 116, 16);
      ctx.fill();
      rr(106, -58, 34, 116, 16);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-56, -58, 112, 116);
      ctx.restore();
      if (sx > 0.5) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "34px sans-serif";
        ctx.fillText("⏰", holeX - 24 * sx, cy);
        ctx.font = `900 46px "Trebuchet MS", sans-serif`;
        ctx.fillStyle = "#d0243f";
        ctx.fillText(String(n), holeX + 28 * sx, cy + 2);
      }
    };
    const face = (cx: number, cy: number, s: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.fillStyle = "#9c6535";
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7d4c24";
      ctx.lineWidth = 3;
      for (const r of [18, 32, 46]) {
        ctx.beginPath();
        ctx.arc(2, 1, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, W, H);
      // Trap door
      const open = step === "sink" ? Math.max(0, 1 - t / 0.6) : step === "rise" ? Math.min(1, t / 0.3) : 1;
      ctx.fillStyle = "#2b1a12";
      ctx.beginPath();
      ctx.ellipse(holeX, holeY, 70 * open, 22 * open, 0, 0, Math.PI * 2);
      ctx.fill();

      if (step === "rise") {
        const p = Math.min(1, t / 0.9);
        const cy = holeY + 120 - (holeY + 120 - top) * (1 - Math.pow(1 - p, 3));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, holeY);
        ctx.ellipse(holeX, holeY, 70, 22, 0, 0, Math.PI * 2);
        ctx.clip();
        side(cy, 1, 5);
        ctx.restore();
        if (p >= 1) { step = "count"; t = 0; }
      } else if (step === "count") {
        const n = 5 - Math.floor(t);
        if (Math.floor(t) !== Math.floor(t - dt)) beep(n === 1 ? 990 : 660, 0.12);
        side(top, 1, Math.max(1, n));
        if (t >= 5) { step = "turn"; t = 0; }
      } else if (step === "turn") {
        const p = Math.min(1, t / 0.6);
        if (p < 0.5) side(top, Math.cos(p * Math.PI), 1);
        else face(holeX, top, (p - 0.5) * 2);
        if (p >= 1) { step = "back"; t = 0; }
      } else if (step === "back") {
        const p = Math.min(1, t / 0.9);
        face(holeX, top - 20 * p, 1 - 0.88 * p);
        if (p >= 1) { step = "zoom"; t = 0; }
      } else if (step === "zoom") {
        const p = Math.min(1, t / 0.4);
        face(holeX, top - 20, 0.12 + 9 * p * p * p);
        if (p >= 1) {
          boom();
          flash = 0.3;
          crackScreen(holeX / W, (top - 20) / H);
          document.body.animate(
            [{ transform: "translate(0,0)" }, { transform: "translate(-10px,6px)" }, { transform: "translate(9px,-7px)" }, { transform: "translate(-5px,4px)" }, { transform: "translate(0,0)" }],
            { duration: 500 }
          );
          step = "sink";
          t = 0;
        }
      } else if (t > 0.7) {
        canvas.remove();
        resolve();
        return;
      }
      if (flash > 0) {
        flash -= dt;
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, flash * 3.3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
