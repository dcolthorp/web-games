const SEEN_KEY = "holdens-game-intro-seen-v1";
const SEEN2_KEY = "holdens-game-intro2-seen-v1";

// The whole opening, in seconds. Each phase runs until the next one starts.
const WALK = 0;
const DARKEN = 4;
const FALL = 6.4;
const EYES = 8;
const KNOCK = 10;
const RISE = 11.4;
const FADE = 14.2;
const END = 15.4;

export function introSeen(): boolean {
  return localStorage.getItem(SEEN_KEY) === "yes";
}

export function intro2Seen(): boolean {
  return localStorage.getItem(SEEN2_KEY) === "yes";
}

export function playIntro(onDone: () => void): void {
  // Anyone who would rather not watch things move gets straight to the list.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    localStorage.setItem(SEEN_KEY, "yes");
    onDone();
    return;
  }

  const shell = document.querySelector<HTMLDivElement>("#intro");
  const canvas = document.querySelector<HTMLCanvasElement>("#intro-canvas");
  const skip = document.querySelector<HTMLButtonElement>("#intro-skip");
  const context = canvas?.getContext("2d") ?? null;
  if (!shell || !canvas || !context) { onDone(); return; }

  shell.hidden = false;
  shell.style.display = "flex";

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = H - 70;
  let start = 0;
  let frame = 0;
  let finished = false;
  let failsafe = 0;

  const stop = (): void => {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(failsafe);
    localStorage.setItem(SEEN_KEY, "yes");
    shell.hidden = true;
    shell.style.display = "none";
    onDone();
  };

  skip?.addEventListener("click", stop);

  // Animation frames stop in a background tab. Without this, opening the page
  // in one would leave the list hidden behind a frozen scene forever.
  failsafe = window.setTimeout(stop, (END + 6) * 1000);

  const mix = (a: number[], b: number[], t: number): string => {
    const k = Math.max(0, Math.min(1, t));
    const c = a.map((v, i) => Math.round(v + ((b[i] ?? v) - v) * k));
    return `rgb(${c[0]} ${c[1]} ${c[2]})`;
  };

  // A small walking figure, drawn from scratch so it can be knocked over.
  function drawWalker(x: number, y: number, t: number, lean: number, fallen: boolean): void {
    if (!context) return;
    context.save();
    context.translate(x, y);
    context.rotate(lean);
    context.fillStyle = "#f4f1e6";
    context.beginPath();
    context.arc(0, -26, 12, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-7, -15, 14, 22);
    if (!fallen) {
      const swing = Math.sin(t * 9) * 7;
      context.fillRect(-6, 7, 5, 14 + swing * 0.2);
      context.fillRect(2, 7, 5, 14 - swing * 0.2);
      context.fillRect(-12, -12, 5, 12 + swing);
      context.fillRect(8, -12, 5, 12 - swing);
    } else {
      context.fillRect(-6, 7, 5, 13);
      context.fillRect(2, 7, 5, 13);
      context.fillRect(-13, -12, 5, 12);
      context.fillRect(9, -12, 5, 12);
    }
    context.restore();
  }

  function draw(now: number): void {
    if (!context) return;
    if (!start) start = now;
    const t = (now - start) / 1000;
    if (t >= END) { stop(); return; }

    const dusk = Math.max(0, Math.min(1, (t - DARKEN) / 2.2));
    const shake = t > FALL && t < FALL + 0.5 ? (Math.random() - 0.5) * 14 * (1 - (t - FALL) / 0.5) : 0;

    context.save();
    context.translate(shake, shake * 0.4);

    // Sky, which curdles from a bright afternoon into something else.
    const sky = context.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, mix([126, 198, 240], [24, 6, 12], dusk));
    sky.addColorStop(1, mix([206, 232, 245], [58, 10, 16], dusk));
    context.fillStyle = sky;
    context.fillRect(-20, -20, W + 40, GROUND + 20);

    // Sun, which does not survive it.
    context.globalAlpha = 1 - dusk;
    context.fillStyle = "#fff3c4";
    context.beginPath();
    context.arc(W - 110, 74, 30, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;

    for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 210 + t * 14) % (W + 200)) - 100;
      const cy = 60 + i * 26;
      context.fillStyle = mix([255, 255, 255], [70, 30, 40], dusk);
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc(cx, cy, 22, 0, Math.PI * 2);
      context.arc(cx + 24, cy + 4, 17, 0, Math.PI * 2);
      context.arc(cx - 22, cy + 5, 15, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    context.fillStyle = mix([86, 158, 74], [30, 16, 20], dusk);
    context.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
    context.fillStyle = mix([70, 136, 60], [22, 12, 16], dusk);
    for (let i = 0; i < 30; i += 1) {
      const gx = ((i * 47 + t * 26) % (W + 60)) - 30;
      context.fillRect(gx, GROUND - 6, 3, 7);
    }

    // The walker. Strolling, then launched, then getting up again.
    let wx = 90 + t * 46;
    let wy = GROUND;
    let lean = 0;
    let fallen = false;

    if (t >= KNOCK && t < RISE) {
      const k = (t - KNOCK) / (RISE - KNOCK);
      wx = 300 + k * 300;
      wy = GROUND - Math.sin(k * Math.PI) * 120;
      lean = k * 7;
      fallen = true;
    } else if (t >= RISE) {
      const k = Math.min(1, (t - RISE) / 1.6);
      wx = 600;
      wy = GROUND;
      // Flat on the ground, then pushing back up to standing.
      lean = (1 - k) * 1.57;
      fallen = k < 0.85;
    } else if (t >= FALL) {
      wx = 300;
    }
    drawWalker(wx, wy, t, lean, fallen);

    // The ball: falls, sprouts eyes, then hits.
    if (t >= FALL - 1.2) {
      const dropK = Math.max(0, Math.min(1, (t - (FALL - 1.2)) / 1.2));
      const bx = 430;
      const by = -60 + dropK * dropK * (GROUND - 66 + 60);
      const r = 40;
      context.fillStyle = "#c01e2e";
      context.beginPath();
      context.arc(bx, Math.min(by, GROUND - 42), r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgb(255 90 90 / .35)";
      context.beginPath();
      context.arc(bx - 12, Math.min(by, GROUND - 42) - 13, 13, 0, Math.PI * 2);
      context.fill();

      if (t >= EYES) {
        const grow = Math.min(1, (t - EYES) / 1.1);
        const ey = Math.min(by, GROUND - 42);
        context.fillStyle = "#ffe9e9";
        [-15, 15].forEach((off) => {
          context.beginPath();
          context.ellipse(bx + off, ey - 6, 10 * grow, 12 * grow, 0, 0, Math.PI * 2);
          context.fill();
        });
        context.fillStyle = "#12060a";
        const look = t >= KNOCK ? 5 : 2 + Math.sin(t * 3) * 2;
        [-15, 15].forEach((off) => {
          context.beginPath();
          context.arc(bx + off + look, ey - 5, 5 * grow, 0, Math.PI * 2);
          context.fill();
        });
      }
    }

    context.restore();

    // Fade out at the end, and a vignette throughout the dark half.
    if (dusk > 0) {
      const vignette = context.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
      vignette.addColorStop(0, "rgb(0 0 0 / 0)");
      vignette.addColorStop(1, `rgb(0 0 0 / ${(dusk * 0.75).toFixed(2)})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, W, H);
    }
    if (t >= FADE) {
      context.fillStyle = `rgb(0 0 0 / ${((t - FADE) / (END - FADE)).toFixed(2)})`;
      context.fillRect(0, 0, W, H);
    }

    frame = window.requestAnimationFrame(draw);
  }

  frame = window.requestAnimationFrame(draw);
}


// Scene two. The walker is up again, and the thing has gone into the ground.
const STAND = 0;
const SINK = 2.2;
const CRACK = 4.4;
const OPEN = 6;
const PEER = 8.6;
const JUMP = 10.6;
const FADE2 = 12.4;
const END2 = 13.6;

export function playIntro2(onDone: () => void): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    localStorage.setItem(SEEN2_KEY, "yes");
    onDone();
    return;
  }

  const shell = document.querySelector<HTMLDivElement>("#intro");
  const canvas = document.querySelector<HTMLCanvasElement>("#intro-canvas");
  const skip = document.querySelector<HTMLButtonElement>("#intro-skip");
  const context = canvas?.getContext("2d") ?? null;
  if (!shell || !canvas || !context) { onDone(); return; }

  shell.hidden = false;
  shell.style.display = "flex";

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = H - 70;
  let start = 0;
  let frame = 0;
  let finished = false;
  let failsafe = 0;

  const stop = (): void => {
    if (finished) return;
    finished = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(failsafe);
    localStorage.setItem(SEEN2_KEY, "yes");
    shell.hidden = true;
    shell.style.display = "none";
    onDone();
  };

  const onSkip = (): void => stop();
  skip?.addEventListener("click", onSkip, { once: true });
  failsafe = window.setTimeout(stop, (END2 + 6) * 1000);

  const WORLD_TINTS = ["#2c3b47", "#3d2a49", "#1c4a5e", "#10381f", "#3a4d61", "#4d1d26", "#2f1f6b", "#1d4260", "#2b2226", "#a89f92"];

  function draw(now: number): void {
    if (!context) return;
    if (!start) start = now;
    const t = (now - start) / 1000;
    if (t >= END2) { stop(); return; }

    const quake = t > CRACK && t < OPEN ? (Math.random() - 0.5) * 10 : 0;
    context.save();
    context.translate(quake, quake * 0.5);

    const sky = context.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#180610");
    sky.addColorStop(1, "#3a0a12");
    context.fillStyle = sky;
    context.fillRect(-20, -20, W + 40, GROUND + 20);
    context.fillStyle = "#1e1116";
    context.fillRect(-20, GROUND, W + 40, H - GROUND + 20);

    // The hole: a seam, then a widening shaft with the worlds stacked in it.
    const opening = Math.max(0, Math.min(1, (t - CRACK) / (OPEN - CRACK + 1.6)));
    const half = opening * 150;
    if (opening > 0) {
      context.fillStyle = "#05010a";
      context.fillRect(W / 2 - half, GROUND, half * 2, H - GROUND + 20);
      for (let i = 0; i < 10; i += 1) {
        const depth = i * 9 + 6;
        if (depth > (H - GROUND + 18)) break;
        context.globalAlpha = Math.max(0, opening - i * 0.06);
        context.fillStyle = WORLD_TINTS[i] ?? "#333";
        context.fillRect(W / 2 - half + i * 3, GROUND + depth, Math.max(0, half * 2 - i * 6), 4);
        context.globalAlpha = 1;
      }
      context.strokeStyle = "#7a1020";
      context.lineWidth = 2;
      context.strokeRect(W / 2 - half, GROUND, half * 2, 3);
    }

    // The ball, sinking out of sight and pulling the ground apart after it.
    if (t < CRACK + 0.8) {
      const sunk = Math.max(0, Math.min(1, (t - SINK) / (CRACK - SINK + 0.8)));
      const by = GROUND - 42 + sunk * 78;
      context.save();
      context.beginPath();
      context.rect(-20, -20, W + 40, GROUND + 20);
      context.clip();
      context.fillStyle = "#c01e2e";
      context.beginPath();
      context.arc(W / 2, by, 40, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffe9e9";
      [-15, 15].forEach((off) => {
        context.beginPath();
        context.ellipse(W / 2 + off, by - 6, 10, 12, 0, 0, Math.PI * 2);
        context.fill();
      });
      context.fillStyle = "#12060a";
      [-15, 15].forEach((off) => {
        context.beginPath();
        context.arc(W / 2 + off, by - 4, 5, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    }

    // The walker: up, edging over, looking in, then following it down.
    let wx = 170;
    let wy = GROUND;
    let lean = 0;
    if (t >= PEER && t < JUMP) {
      wx = 170 + ((t - PEER) / (JUMP - PEER)) * (W / 2 - half - 190);
    } else if (t >= JUMP) {
      const k = (t - JUMP) / (FADE2 - JUMP);
      wx = W / 2 - 30 + k * 30;
      wy = GROUND + k * k * 150;
      lean = k * 2.4;
    } else if (t >= PEER - 1.4) {
      wx = 170;
    }

    context.save();
    context.translate(wx, wy);
    context.rotate(lean);
    context.fillStyle = "#f4f1e6";
    context.beginPath();
    context.arc(0, -26, 12, 0, Math.PI * 2);
    context.fill();
    context.fillRect(-7, -15, 14, 22);
    const step = t >= PEER && t < JUMP ? Math.sin(t * 9) * 6 : 0;
    context.fillRect(-6, 7, 5, 14 + step * 0.2);
    context.fillRect(2, 7, 5, 14 - step * 0.2);
    context.fillRect(-12, -12, 5, 12 + step);
    context.fillRect(8, -12, 5, 12 - step);
    context.restore();

    context.restore();

    const vignette = context.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H);
    vignette.addColorStop(0, "rgb(0 0 0 / 0)");
    vignette.addColorStop(1, "rgb(0 0 0 / .8)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, W, H);

    if (t >= FADE2) {
      context.fillStyle = `rgb(0 0 0 / ${((t - FADE2) / (END2 - FADE2)).toFixed(2)})`;
      context.fillRect(0, 0, W, H);
    }

    frame = window.requestAnimationFrame(draw);
  }

  frame = window.requestAnimationFrame(draw);
}
