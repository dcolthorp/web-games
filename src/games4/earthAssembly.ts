// Putting the Earth back together on the Games 4 hub, once you're back out of
// Hundred Logic Escape Rooms with all four Earth fragments. Each fragment is a
// quarter of the Earth with one round edge, and the round edge has to face out,
// so each one only fits in its own corner. Once it's whole, World Sandbox is
// unlocked.

const FRAGMENT_COUNT = 4;
const fragmentKey = (n: number): string => `zero-logic-escape-rooms-earth-fragment-${n}`;
const BUILT_KEY = "zero-logic-escape-rooms-earth-built";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function hasAllEarthFragments(): boolean {
  for (let n = 1; n <= FRAGMENT_COUNT; n += 1) if (!readFlag(fragmentKey(n))) return false;
  return true;
}

export function earthIsBuilt(): boolean {
  return readFlag(BUILT_KEY);
}

interface Point {
  x: number;
  y: number;
}

interface Fragment {
  n: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  placed: boolean;
}

const W = 720;
const H = 460;
const SHELF_TOP = 320;
const EARTH: Point = { x: 360, y: 164 };
const R = 100;
const SNAP = 50;
const DONE_MS = 2600;
const NOTE_MS = 2600;

// The same land as the fragments in the escape rooms (drawn there at radius 50),
// so the four quarters line up into continents.
const LAND = [
  [-18, -22, 14],
  [-30, -6, 10],
  [20, -28, 12],
  [30, -10, 9],
  [8, 18, 16],
  [-24, 26, 10],
  [32, 24, 8],
] as const;

function wedgeAngles(n: number): [number, number] {
  const start = -Math.PI / 2 + (n - 1) * ((Math.PI * 2) / FRAGMENT_COUNT);
  return [start, start + (Math.PI * 2) / FRAGMENT_COUNT];
}

// Which way quarter n points out from the middle of the Earth.
function direction(n: number): Point {
  const [a0, a1] = wedgeAngles(n);
  const mid = (a0 + a1) / 2;
  return { x: Math.sign(Math.cos(mid)), y: Math.sign(Math.sin(mid)) };
}

function targetFor(n: number): Point {
  const d = direction(n);
  return { x: EARTH.x + (d.x * R) / 2, y: EARTH.y + (d.y * R) / 2 };
}

export function openEarthAssembly(onDone: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = "switch-assembly";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Put the Earth together");
  overlay.innerHTML = `
    <div class="switch-assembly-panel">
      <p class="switch-assembly-eyebrow">You have all 4 Earth Fragments</p>
      <h2 class="switch-assembly-title">Put the Earth Together</h2>
      <p class="switch-assembly-step" aria-live="polite"></p>
      <canvas class="switch-assembly-canvas" width="${W}" height="${H}" aria-label="A dashed outline of the Earth in space, and four Earth fragments on a shelf below"></canvas>
    </div>
  `;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector("canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const stepText = overlay.querySelector(".switch-assembly-step") as HTMLParagraphElement;

  // The fragments sit on the shelf in a jumbled order.
  const order = [3, 1, 4, 2];
  const fragments: Fragment[] = order.map((n, i) => {
    const x = 120 + i * 160;
    const y = 392;
    return { n, homeX: x, homeY: y, x, y, placed: false };
  });

  let dragging: { fragment: Fragment; offX: number; offY: number } | null = null;
  let doneAt: number | null = null;
  let note = "";
  let noteAt = -Infinity;
  let frameId = 0;
  let audio: AudioContext | null = null;

  const placedCount = (): number => fragments.filter((f) => f.placed).length;

  function click(frequency: number): void {
    try {
      audio ??= new AudioContext();
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // No sound, no problem.
    }
  }

  function stepFor(): string {
    const placed = placedCount();
    if (doneAt !== null) return "The Earth is whole again! World Sandbox is unlocked.";
    if (placed === 0) return "Drag each Earth fragment into its corner of the dashed Earth.";
    return `${placed} of ${FRAGMENT_COUNT} in place. The round edge goes on the outside.`;
  }

  function toCanvas(event: PointerEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * W) / rect.width, y: ((event.clientY - rect.top) * H) / rect.height };
  }

  function fragmentAt(p: Point): Fragment | null {
    for (let i = fragments.length - 1; i >= 0; i -= 1) {
      const f = fragments[i];
      if (f && !f.placed && Math.abs(p.x - f.x) <= R / 2 && Math.abs(p.y - f.y) <= R / 2) return f;
    }
    return null;
  }

  function close(): void {
    cancelAnimationFrame(frameId);
    try {
      localStorage.setItem(BUILT_KEY, "true");
    } catch {
      // It'll ask again next time.
    }
    void audio?.close().catch(() => {});
    overlay.remove();
    onDone();
  }

  function drop(f: Fragment): void {
    const own = targetFor(f.n);
    if (Math.hypot(f.x - own.x, f.y - own.y) < SNAP) {
      f.x = own.x;
      f.y = own.y;
      f.placed = true;
      note = "";
      click(620);
      if (placedCount() === FRAGMENT_COUNT) {
        doneAt = performance.now();
        window.setTimeout(() => click(880), 150);
        window.setTimeout(() => click(1180), 300);
        window.setTimeout(close, DONE_MS);
      }
      return;
    }
    const wrongCorner = fragments.some((other) => other.n !== f.n && Math.hypot(f.x - targetFor(other.n).x, f.y - targetFor(other.n).y) < SNAP);
    if (wrongCorner) {
      note = "That fragment's round edge would be on the inside. It goes in a different corner.";
      noteAt = performance.now();
      click(140);
    }
    f.x = f.homeX;
    f.y = f.homeY;
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (doneAt !== null) return;
    const p = toCanvas(event);
    const f = fragmentAt(p);
    if (!f) return;
    fragments.splice(fragments.indexOf(f), 1);
    fragments.push(f);
    dragging = { fragment: f, offX: p.x - f.x, offY: p.y - f.y };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    const p = toCanvas(event);
    if (dragging) {
      dragging.fragment.x = Math.min(W - 20, Math.max(20, p.x - dragging.offX));
      dragging.fragment.y = Math.min(H - 20, Math.max(20, p.y - dragging.offY));
      canvas.style.cursor = "grabbing";
      return;
    }
    canvas.style.cursor = doneAt === null && fragmentAt(p) ? "grab" : "default";
  });

  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const { fragment } = dragging;
    dragging = null;
    drop(fragment);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---------- drawing ----------

  // (x, y) is the middle of the quarter's square, not the middle of the Earth.
  function drawFragment(n: number, x: number, y: number): void {
    const d = direction(n);
    const cx = x - (d.x * R) / 2;
    const cy = y - (d.y * R) / 2;
    const [start, end] = wedgeAngles(n);
    const s = R / 50;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, end);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const ocean = ctx.createRadialGradient(cx - 12 * s, cy - 14 * s, 6 * s, cx, cy, R);
    ocean.addColorStop(0, "#7fd0ff");
    ocean.addColorStop(1, "#1d5fb8");
    ctx.fillStyle = ocean;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = "#4fbf5a";
    for (const [lx, ly, lr] of LAND) {
      ctx.beginPath();
      ctx.arc(cx + lx * s, cy + ly * s, lr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#0e2a4d";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  function draw(now: number): void {
    ctx.fillStyle = "#0b1030";
    ctx.fillRect(0, 0, W, SHELF_TOP);
    for (let i = 0; i < 60; i += 1) {
      const twinkle = 0.4 + 0.4 * Math.sin(now / 500 + i * 1.7);
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
      ctx.fillRect((i * 139) % W, (i * 71) % SHELF_TOP, 2, 2);
    }

    if (doneAt !== null) {
      const t = Math.min(1, (now - doneAt) / 800);
      const glow = ctx.createRadialGradient(EARTH.x, EARTH.y, R * 0.8, EARTH.x, EARTH.y, R * 1.7);
      glow.addColorStop(0, `rgba(127, 208, 255, ${0.6 * t})`);
      glow.addColorStop(1, "rgba(127, 208, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, SHELF_TOP);
    } else {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(EARTH.x, EARTH.y, R, 0, Math.PI * 2);
      ctx.moveTo(EARTH.x - R, EARTH.y);
      ctx.lineTo(EARTH.x + R, EARTH.y);
      ctx.moveTo(EARTH.x, EARTH.y - R);
      ctx.lineTo(EARTH.x, EARTH.y + R);
      ctx.stroke();
      ctx.restore();
    }

    // The shelf the fragments start on
    ctx.fillStyle = "#6b4a2a";
    ctx.fillRect(0, SHELF_TOP, W, H - SHELF_TOP);
    ctx.fillStyle = "#8a5f36";
    ctx.fillRect(0, SHELF_TOP, W, 10);

    for (const f of fragments) if (f.placed) drawFragment(f.n, f.x, f.y);
    for (const f of fragments) if (!f.placed) drawFragment(f.n, f.x, f.y);

    if (doneAt !== null) {
      const t = Math.min(1, (now - doneAt) / 600);
      ctx.globalAlpha = t;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 34px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#000";
      ctx.strokeText("WORLD SANDBOX UNLOCKED", EARTH.x, SHELF_TOP + 70);
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("WORLD SANDBOX UNLOCKED", EARTH.x, SHELF_TOP + 70);
      ctx.globalAlpha = 1;
    }
  }

  function frame(now: number): void {
    const text = note && now - noteAt < NOTE_MS ? note : stepFor();
    if (stepText.textContent !== text) stepText.textContent = text;
    stepText.classList.toggle("is-warning", text === note);
    draw(now);
    frameId = requestAnimationFrame(frame);
  }
  frameId = requestAnimationFrame(frame);
}
