import { H, W, clamp, ctx, drawCaption, inRect, poly, roundRect, type Point } from "./engine";
import type { BonusLevel } from "./bonus2";
import { collectEarthFragment, drawEarthFragment, hasEarthFragment } from "./earthFragments";
import { FLOAT_MS, drawFloaters, drawNotes, type Floater } from "./hundred";
import { sounds } from "./sound";

// Inside the comic book box, after the shrinker machine in Hundred Logic's
// Comical makes you as small as a comic page. It's full of drawers and boxes.
// Three of them have a scrap of comic inside, and each scrap gives one number
// of the code for the padlock on the box marked EARTH. The rest just have the
// kind of junk that ends up at the bottom of a box. Find the three numbers,
// open the lock, and Earth Fragment 3 is inside. The scraps hide somewhere
// new, and the code changes, every visit.

type Phase = "search" | "popup" | "lock" | "opening" | "reward";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Container {
  rect: Rect;
  kind: "drawer" | "box";
  label: string;
  open: boolean;
  // Which number of the code this one's scrap gives, or null for junk.
  scrap: number | null;
  junk: string;
}

const COMIC_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";
const ORDINALS = ["1st", "2nd", "3rd"];
const JUNK = [
  "A paperclip.",
  "One googly eye.",
  "A popcorn kernel.",
  "Lint. Lots of lint.",
  "A tiny sock.",
  "A button.",
  "A bottle cap.",
  "Nothing but dust.",
  "A bent staple.",
  "A rubber band.",
  "Half a crayon.",
  "A marble.",
];

const FLOOR_Y = 470;
const CABINET: Rect = { x: 140, y: 160, w: 310, h: 290 };
const BOX_RECTS: Rect[] = [
  { x: 480, y: 380, w: 110, h: 90 },
  { x: 610, y: 400, w: 90, h: 70 },
  { x: 610, y: 320, w: 90, h: 78 },
];
const BOX_LABELS = ["STUFF", "MISC", "JUNK"];
const EARTH_BOX: Rect = { x: 730, y: 270, w: 130, h: 200 };
const LOCK: Point = { x: EARTH_BOX.x + EARTH_BOX.w / 2, y: EARTH_BOX.y + 120 };
const BACK_BUTTON: Rect = { x: 16, y: H - 50, w: 96, h: 36 };

const POPUP: Rect = { x: W / 2 - 180, y: 120, w: 360, h: 320 };
const LOCK_PANEL: Rect = { x: W / 2 - 190, y: 120, w: 380, h: 340 };
const OPEN_BUTTON: Rect = { x: W / 2 - 70, y: LOCK_PANEL.y + 270, w: 140, h: 48 };
const CLOSE: Rect = { x: LOCK_PANEL.x + LOCK_PANEL.w - 42, y: LOCK_PANEL.y + 10, w: 32, h: 32 };

const OPENING_MS = 1300;
const SHAKE_MS = 350;

const over = (p: Point, r: Rect): boolean => inRect(p, r.x, r.y, r.w, r.h);
const wheelX = (i: number): number => W / 2 - 110 + i * 110;
const wheelUp = (i: number): Rect => ({ x: wheelX(i) - 32, y: LOCK_PANEL.y + 62, w: 64, h: 40 });
const wheelDown = (i: number): Rect => ({ x: wheelX(i) - 32, y: LOCK_PANEL.y + 196, w: 64, h: 40 });

function drawerRect(i: number): Rect {
  return { x: CABINET.x + 14 + (i % 3) * 98, y: CABINET.y + 18 + Math.floor(i / 3) * 90, w: 92, h: 76 };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a !== undefined && b !== undefined) {
      out[i] = b;
      out[j] = a;
    }
  }
  return out;
}

// leave is called from the Back button and after getting the fragment.
export function createComicBoxBonus(leave: () => void): BonusLevel {
  let phase: Phase = "search";
  let phaseStart = 0;
  let levelStart = 0;
  let containers: Container[] = [];
  let code = [0, 0, 0];
  let wheels = [0, 0, 0];
  let found = [false, false, false];
  let popup: Container | null = null;
  let shakeAt = -Infinity;
  let floaters: Floater[] = [];
  let fragmentWasNew = true;

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  function reset(now: number): void {
    setPhase("search", now);
    levelStart = now;
    code = [0, 1, 2].map(() => Math.floor(Math.random() * 10));
    wheels = [0, 0, 0];
    found = [false, false, false];
    popup = null;
    shakeAt = -Infinity;
    floaters = [];
    const junk = shuffle(JUNK);
    containers = [
      ...Array.from({ length: 9 }, (_, i): Container => ({
        rect: drawerRect(i),
        kind: "drawer",
        label: `No. ${i + 1}`,
        open: false,
        scrap: null,
        junk: junk[i] ?? "Nothing.",
      })),
      ...BOX_RECTS.map((rect, i): Container => ({
        rect,
        kind: "box",
        label: BOX_LABELS[i] ?? "BOX",
        open: false,
        scrap: null,
        junk: junk[9 + i] ?? "Nothing.",
      })),
    ];
    shuffle(containers)
      .slice(0, 3)
      .forEach((container, i) => {
        container.scrap = i;
      });
  }

  function say(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 170, W - 170), y: Math.max(70, y), start: now });
  }

  // ---------- input ----------

  function lockDown(p: Point, now: number): void {
    if (over(p, CLOSE) || !over(p, LOCK_PANEL)) {
      setPhase("search", now);
      return;
    }
    for (let i = 0; i < 3; i += 1) {
      if (over(p, wheelUp(i))) {
        wheels[i] = ((wheels[i] ?? 0) + 1) % 10;
        sounds.tap();
        return;
      }
      if (over(p, wheelDown(i))) {
        wheels[i] = ((wheels[i] ?? 0) + 9) % 10;
        sounds.tap();
        return;
      }
    }
    if (!over(p, OPEN_BUTTON)) return;
    if (wheels.every((digit, i) => digit === code[i])) {
      sounds.clack();
      sounds.creak();
      setPhase("opening", now);
    } else {
      shakeAt = now;
      sounds.womp();
      say("The lock won't open.", W / 2, LOCK_PANEL.y - 14, now);
    }
  }

  function pointerDown(p: Point): void {
    const now = performance.now();
    if (phase === "reward") {
      leave();
      return;
    }
    if (phase === "opening") return;
    if (phase === "popup") {
      popup = null;
      setPhase("search", now);
      return;
    }
    if (phase === "lock") {
      lockDown(p, now);
      return;
    }
    if (over(p, BACK_BUTTON)) {
      sounds.tink();
      leave();
      return;
    }
    const container = containers.find((c) => over(p, c.rect));
    if (container) {
      if (!container.open) {
        container.open = true;
        sounds.clack();
        if (container.scrap !== null) {
          found[container.scrap] = true;
          sounds.chime();
        }
      } else {
        sounds.tap();
      }
      popup = container;
      setPhase("popup", now);
      return;
    }
    if (over(p, EARTH_BOX)) {
      sounds.tap();
      setPhase("lock", now);
    }
  }

  function pointerMove(): void {}

  function cursor(p: Point): string {
    if (phase === "reward" || phase === "popup") return "pointer";
    if (phase === "opening") return "default";
    if (phase === "lock") {
      const buttons = [CLOSE, OPEN_BUTTON, ...[0, 1, 2].flatMap((i) => [wheelUp(i), wheelDown(i)])];
      return !over(p, LOCK_PANEL) || buttons.some((r) => over(p, r)) ? "pointer" : "default";
    }
    return over(p, BACK_BUTTON) || over(p, EARTH_BOX) || containers.some((c) => over(p, c.rect)) ? "pointer" : "default";
  }

  function update(now: number): void {
    if (phase === "opening" && now - phaseStart >= OPENING_MS) {
      fragmentWasNew = !hasEarthFragment(3);
      collectEarthFragment(3);
      sounds.chime();
      setPhase("reward", now);
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- drawing ----------

  function drawScrapIcon(x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = "#ffd23f";
    poly([x, y + 4], [x + w, y], [x + w - 3, y + h], [x + 3, y + h - 2]);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawDrawer(c: Container): void {
    const r = c.rect;
    if (c.open) {
      ctx.fillStyle = "#2a1a0c";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (c.scrap !== null) drawScrapIcon(r.x + r.w / 2 - 16, r.y + 16, 32, 24);
      ctx.fillStyle = "#b8834d";
      roundRect(r.x - 5, r.y + r.h - 18, r.w + 10, 28, 4);
      ctx.fill();
      return;
    }
    ctx.fillStyle = "#d9b27a";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#5e3a1c";
    ctx.font = `bold 13px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.label, r.x + r.w / 2, r.y + 20);
    ctx.fillStyle = "#d9a52a";
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2 + 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBox(c: Container): void {
    const r = c.rect;
    ctx.fillStyle = "#c79a5b";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#6b4a22";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (c.open) {
      ctx.fillStyle = "#3a2410";
      ctx.fillRect(r.x + 6, r.y, r.w - 12, 16);
      if (c.scrap !== null) drawScrapIcon(r.x + r.w / 2 - 14, r.y - 10, 28, 20);
      ctx.fillStyle = "#d9ae6d";
      poly([r.x, r.y], [r.x - 16, r.y - 22], [r.x + r.w / 2 - 6, r.y - 18], [r.x + r.w / 2 - 4, r.y]);
      poly([r.x + r.w, r.y], [r.x + r.w + 16, r.y - 22], [r.x + r.w / 2 + 6, r.y - 18], [r.x + r.w / 2 + 4, r.y]);
    } else {
      ctx.fillStyle = "rgba(220, 200, 150, 0.8)";
      ctx.fillRect(r.x + r.w / 2 - 8, r.y, 16, r.h * 0.4);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 2);
      ctx.lineTo(r.x + r.w, r.y + 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#3a2410";
    ctx.font = `bold 13px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(c.label, r.x + r.w / 2, r.y + r.h * 0.65);
  }

  function drawEarthBox(now: number): void {
    const r = EARTH_BOX;
    const opening = phase === "opening" ? clamp((now - phaseStart) / OPENING_MS, 0, 1) : phase === "reward" ? 1 : 0;
    ctx.fillStyle = "#8a6a4a";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "bold 24px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EARTH", r.x + r.w / 2, r.y + 40);

    if (opening > 0) {
      ctx.fillStyle = "#1a0f06";
      ctx.fillRect(r.x + 8, r.y, r.w - 16, 22);
      const glow = ctx.createRadialGradient(r.x + r.w / 2, r.y, 4, r.x + r.w / 2, r.y, 110);
      glow.addColorStop(0, `rgba(127, 208, 255, ${0.7 * opening})`);
      glow.addColorStop(1, "rgba(127, 208, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(r.x - 60, r.y - 110, r.w + 120, 220);
      ctx.fillStyle = "#9c7a58";
      poly([r.x, r.y], [r.x + r.w, r.y], [r.x + r.w + 10, r.y - 34 * opening], [r.x + 10, r.y - 40 * opening]);
      drawEarthFragment(3, r.x + r.w / 2, r.y - 10 - opening * 50 + Math.sin(now / 400) * 3, 0.7);
    } else {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 14);
      ctx.lineTo(r.x + r.w, r.y + 14);
      ctx.stroke();
      // Padlock
      ctx.strokeStyle = "#8d979c";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(LOCK.x, LOCK.y - 8, 14, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#d9a52a";
      roundRect(LOCK.x - 22, LOCK.y - 8, 44, 38, 6);
      ctx.fill();
      ctx.fillStyle = "#3a2410";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText(wheels.join(" "), LOCK.x, LOCK.y + 11);
    }
  }

  function drawInside(now: number): void {
    ctx.fillStyle = "#b98a52";
    ctx.fillRect(0, 0, W, FLOOR_Y);
    ctx.strokeStyle = "rgba(90, 60, 25, 0.18)";
    ctx.lineWidth = 3;
    for (let x = 0; x < W; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_Y);
      ctx.stroke();
    }
    ctx.fillStyle = "#8a6232";
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // Giant comic books standing up against the sides of the box
    for (const [x, y, w, color, word] of [
      [0, 70, 44, "#e63946", "POW!"],
      [44, 110, 50, "#4cc9f0", "ZAP!"],
      [870, 90, 46, "#ffd23f", "BAM!"],
      [916, 60, 44, "#9be89b", "WOW!"],
    ] as const) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, FLOOR_Y - y);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, FLOOR_Y - y);
      ctx.save();
      ctx.translate(x + w / 2, (y + FLOOR_Y) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#111";
      ctx.font = `bold 22px ${COMIC_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${word} COMICS`, 0, 0);
      ctx.restore();
    }

    ctx.fillStyle = "#6b4421";
    ctx.fillRect(CABINET.x, CABINET.y, CABINET.w, CABINET.h);
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 3;
    ctx.strokeRect(CABINET.x, CABINET.y, CABINET.w, CABINET.h);
    for (const container of containers) {
      if (container.kind === "drawer") drawDrawer(container);
      else drawBox(container);
    }
    drawEarthBox(now);
  }

  function drawPopup(): void {
    if (!popup) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fbf8ef";
    roundRect(POPUP.x, POPUP.y, POPUP.w, POPUP.h, 12);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5e3a1c";
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Inside ${popup.kind === "drawer" ? `drawer ${popup.label}` : `the ${popup.label} box`}:`, W / 2, POPUP.y + 34);
    if (popup.scrap !== null) {
      const px = W / 2 - 110;
      const py = POPUP.y + 60;
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(px, py, 220, 180);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 4;
      ctx.strokeRect(px, py, 220, 180);
      ctx.fillStyle = "#111";
      ctx.font = `bold 22px ${COMIC_FONT}`;
      ctx.fillText("A comic scrap!", W / 2, py + 34);
      ctx.fillText(`The ${ORDINALS[popup.scrap] ?? ""} number is`, W / 2, py + 72);
      ctx.font = `bold 64px ${COMIC_FONT}`;
      ctx.fillStyle = "#e63946";
      ctx.fillText(String(code[popup.scrap] ?? 0), W / 2, py + 130);
    } else {
      ctx.fillStyle = "#111";
      ctx.font = `bold 30px ${COMIC_FONT}`;
      ctx.fillText(popup.junk, W / 2, POPUP.y + 150);
    }
    ctx.fillStyle = "#8a8a8a";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.fillText("Click anywhere to close.", W / 2, POPUP.y + POPUP.h - 28);
  }

  function drawArrow(r: Rect, up: boolean): void {
    ctx.fillStyle = "#4a5157";
    roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.fillStyle = "#fff";
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    if (up) poly([cx - 12, cy + 7], [cx + 12, cy + 7], [cx, cy - 9]);
    else poly([cx - 12, cy - 7], [cx + 12, cy - 7], [cx, cy + 9]);
  }

  function drawLockPanel(now: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, W, H);
    const shake = now - shakeAt < SHAKE_MS ? Math.sin((now - shakeAt) / 20) * 8 * (1 - (now - shakeAt) / SHAKE_MS) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    ctx.fillStyle = "#2b2f33";
    roundRect(LOCK_PANEL.x, LOCK_PANEL.y, LOCK_PANEL.w, LOCK_PANEL.h, 14);
    ctx.fill();
    ctx.strokeStyle = "#d9a52a";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EARTH BOX LOCK", W / 2, LOCK_PANEL.y + 32);
    for (let i = 0; i < 3; i += 1) {
      drawArrow(wheelUp(i), true);
      drawArrow(wheelDown(i), false);
      ctx.fillStyle = "#f4f1ea";
      roundRect(wheelX(i) - 32, LOCK_PANEL.y + 110, 64, 80, 8);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "bold 48px 'Courier New', monospace";
      ctx.fillText(String(wheels[i] ?? 0), wheelX(i), LOCK_PANEL.y + 152);
    }
    ctx.fillStyle = "#2fa84f";
    roundRect(OPEN_BUTTON.x, OPEN_BUTTON.y, OPEN_BUTTON.w, OPEN_BUTTON.h, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
    ctx.fillText("OPEN", W / 2, OPEN_BUTTON.y + OPEN_BUTTON.h / 2 + 1);
    ctx.fillStyle = "#6b7277";
    roundRect(CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
    ctx.fillText("✕", CLOSE.x + CLOSE.w / 2, CLOSE.y + CLOSE.h / 2 + 1);
    ctx.restore();
  }

  function draw(now: number): void {
    drawInside(now);

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);
    ctx.fillStyle = "#3a2410";
    ctx.font = "bold 24px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText("INSIDE THE COMIC BOX", W / 2, 34);
    ctx.fillStyle = "#6a3fb5";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BONUS LEVEL", W - 22, 34);

    const scraps = found.filter(Boolean).length;
    drawNotes([`Comic scraps: ${scraps} / 3`, `Code: ${found.map((f, i) => (f ? String(code[i]) : "?")).join(" ")}`]);
    if (phase === "search") drawCaption("You're tiny! Search the drawers and boxes.", (now - levelStart) / 1000);

    if (phase === "popup") drawPopup();
    if (phase === "lock") drawLockPanel(now);
    drawFloaters(floaters, now);

    if (phase === "reward") {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.75, (now - phaseStart) / 500)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#000";
      ctx.font = "54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.strokeText("EARTH FRAGMENT 3", W / 2, H / 2 - 150);
      ctx.fillStyle = "#ffcf5a";
      ctx.fillText("EARTH FRAGMENT 3", W / 2, H / 2 - 150);
      drawEarthFragment(3, W / 2, H / 2 - 10 + Math.sin(now / 400) * 6, 1.6);
      ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
      const message = fragmentWasNew ? "The code was right!" : "You already have Earth Fragment 3.";
      ctx.strokeText(message, W / 2, H / 2 + 110);
      ctx.fillStyle = "#f5efe6";
      ctx.fillText(message, W / 2, H / 2 + 110);
      ctx.font = "bold 20px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#b9adc4";
      ctx.fillText("Click to go back.", W / 2, H / 2 + 150);
    }
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
