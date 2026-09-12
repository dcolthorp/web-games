import {
  H,
  W,
  clamp,
  ctx,
  diveInto,
  drawBonusCard,
  drawCaption,
  drawRoomBox,
  drawSaw,
  drawVignette,
  inRect,
  lerp,
  line,
  poly,
  roundRect,
  type Point,
  type Room,
} from "./engine";
import { sounds } from "./sound";
import { selectedTool } from "./tools";

// Escape Room 3: Comical. Somebody tore a comic book into six panels and hid
// them around a bedroom, inside some of the shoes, phones and other junk. The
// rest are decoys. Find all six, then glue them back onto the page with the
// glue from the tool bar. The last panel is a black hole, and that's the exit.
// With the saw from room 1 you can cut up the posters on the wall, and there's
// a secret way to a bonus level behind each one.

type Scene = "search" | "toDesk" | "desk" | "leaving" | "bonusIn" | "bonus" | "escaped";
type SpotKind = "shoe" | "phone" | "trash" | "pizza" | "cushion";

interface Spot {
  kind: SpotKind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  angle: number;
  flip: boolean;
  hasPiece: boolean;
  searchedAt: number | null;
}

// A found panel flying from its hiding spot up into the counter.
interface Flyer {
  fromX: number;
  fromY: number;
  start: number;
  slot: number;
  hudIndex: number;
}

interface Piece {
  slot: number;
  homeX: number;
  homeY: number;
  homeAngle: number;
  glued: boolean;
  flyStart: number | null;
  wiggleStart: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  start: number;
}

const PALETTE = {
  ceiling: "#35425a",
  side: "#4f6a8a",
  wallTop: "#6b8cb0",
  wallBottom: "#5b7898",
  floorBack: "#6b4a6e",
  floorFront: "#8a6590",
  skirting: "#3f5470",
  floor: "carpet",
} as const;

const COMIC_FONT = "'Comic Sans MS', 'Chalkboard SE', 'Trebuchet MS', sans-serif";

const SPOT_LAYOUT: Omit<Spot, "hasPiece" | "searchedAt">[] = [
  { kind: "cushion", x: 552, y: 372, w: 135, h: 45, color: "#cc5247", angle: 0, flip: false },
  { kind: "phone", x: 700, y: 362, w: 48, h: 56, color: "", angle: 1.2, flip: false },
  { kind: "trash", x: 815, y: 440, w: 60, h: 76, color: "", angle: 0, flip: false },
  { kind: "pizza", x: 215, y: 462, w: 124, h: 48, color: "", angle: 0, flip: false },
  { kind: "phone", x: 330, y: 452, w: 48, h: 56, color: "", angle: -0.5, flip: false },
  { kind: "phone", x: 560, y: 482, w: 48, h: 56, color: "", angle: 0.3, flip: false },
  { kind: "shoe", x: 660, y: 530, w: 80, h: 44, color: "#2f6fd6", angle: 0, flip: true },
  { kind: "shoe", x: 190, y: 545, w: 80, h: 44, color: "#d63a2f", angle: 0, flip: false },
  { kind: "shoe", x: 410, y: 565, w: 80, h: 44, color: "#2fa84f", angle: 0, flip: true },
  { kind: "shoe", x: 860, y: 560, w: 80, h: 44, color: "#e0b020", angle: 0, flip: false },
];

const DECOY_LINES: Record<SpotKind, string> = {
  shoe: "Just a stinky sock.",
  phone: "0 new messages.",
  trash: "Only trash.",
  pizza: "Crumbs.",
  cushion: "Lost coins. Not useful.",
};

const PIECE_COUNT = 6;
const PANEL_W = 180;
const PANEL_H = 150;
const GUTTER = 12;
const PAGE = { x: 282, y: 51, w: PANEL_W * 2 + GUTTER * 3, h: PANEL_H * 3 + GUTTER * 4 };
const SCATTER_SCALE = 0.62;
const SCATTER: [number, number][] = [
  [145, 125],
  [135, 300],
  [150, 475],
  [815, 130],
  [825, 305],
  [810, 480],
];

const HOP_MS = 300;
const POP_MS = 700;
const TO_DESK_MS = 1400;
const WIGGLE_MS = 400;
const GLUE_FLY_MS = 450;
const BUMP_MS = 200;
const FLOAT_MS = 1400;
const LEAVE_MS = 1600;
const SHRED_MS = 900;
const BONUS_IN_MS = 900;

interface Poster {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  word: string;
  burst: string;
  ink: string;
  r: number;
  cutAt: number | null;
}

const POSTER_LAYOUT: Omit<Poster, "cutAt">[] = [
  { x: 170, y: 95, w: 110, h: 150, color: "#ffd23f", word: "POW!", burst: "#e63946", ink: "#fff", r: 44 },
  { x: 320, y: 85, w: 100, h: 140, color: "#4cc9f0", word: "ZAP!", burst: "#ffd23f", ink: "#1d3557", r: 40 },
];

function slotPos(slot: number): Point {
  return {
    x: PAGE.x + GUTTER + (slot % 2) * (PANEL_W + GUTTER),
    y: PAGE.y + GUTTER + Math.floor(slot / 2) * (PANEL_H + GUTTER),
  };
}

function slotCenter(slot: number): Point {
  const p = slotPos(slot);
  return { x: p.x + PANEL_W / 2, y: p.y + PANEL_H / 2 };
}

const LAST_SLOT = slotPos(PIECE_COUNT - 1);
const BLACK_HOLE: Point = { x: LAST_SLOT.x + 90, y: LAST_SLOT.y + 72 };

export function createComicalRoom(escape: () => void): Room {
  let scene: Scene = "search";
  let sceneStart = 0;
  let roomStart = 0;
  let spots: Spot[] = [];
  let pieces: Piece[] = [];
  let flyers: Flyer[] = [];
  let floaters: Floater[] = [];
  let found = 0;
  let collected = 0;
  let pageBump = -Infinity;
  let pointer: Point = { x: W / 2, y: H / 2 };
  let posters: Poster[] = [];
  let bonusAt: Point = { x: W / 2, y: H / 2 };

  function setScene(next: Scene, now: number): void {
    scene = next;
    sceneStart = now;
  }

  function reset(startAt: number): void {
    scene = "search";
    sceneStart = startAt;
    roomStart = startAt;
    flyers = [];
    floaters = [];
    found = 0;
    collected = 0;
    pageBump = -Infinity;
    posters = POSTER_LAYOUT.map((poster) => ({ ...poster, cutAt: null }));

    // Every play hides the pieces somewhere new. At least one shoe and one
    // phone are always decoys, plus two more of anything.
    spots = SPOT_LAYOUT.map((spot) => ({ ...spot, hasPiece: true, searchedAt: null }));
    const makeDecoy = (options: Spot[]): void => {
      const choice = options[Math.floor(Math.random() * options.length)];
      if (choice) choice.hasPiece = false;
    };
    makeDecoy(spots.filter((s) => s.kind === "shoe"));
    makeDecoy(spots.filter((s) => s.kind === "phone"));
    makeDecoy(spots.filter((s) => s.hasPiece));
    makeDecoy(spots.filter((s) => s.hasPiece));

    const order = Array.from({ length: PIECE_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5);
    pieces = SCATTER.map(([x, y], i) => ({
      slot: order[i] ?? i,
      homeX: x,
      homeY: y,
      homeAngle: (Math.random() - 0.5) * 0.7,
      glued: false,
      flyStart: null,
      wiggleStart: -Infinity,
    }));
  }

  const allGlued = (): boolean => pieces.every((p) => p.glued);

  // ---------- hit tests ----------

  function spotAt(p: Point): Spot | null {
    for (let i = spots.length - 1; i >= 0; i -= 1) {
      const spot = spots[i];
      if (spot && spot.searchedAt === null && inRect(p, spot.x - spot.w / 2, spot.y - spot.h / 2, spot.w, spot.h)) {
        return spot;
      }
    }
    return null;
  }

  function pieceAt(p: Point): Piece | null {
    for (let i = pieces.length - 1; i >= 0; i -= 1) {
      const piece = pieces[i];
      if (!piece || piece.glued || piece.flyStart !== null) continue;
      const dx = p.x - piece.homeX;
      const dy = p.y - piece.homeY;
      const cos = Math.cos(-piece.homeAngle);
      const sin = Math.sin(-piece.homeAngle);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      if (Math.abs(localX) <= (PANEL_W * SCATTER_SCALE) / 2 && Math.abs(localY) <= (PANEL_H * SCATTER_SCALE) / 2) {
        return piece;
      }
    }
    return null;
  }

  function overBlackHole(p: Point): boolean {
    return Math.hypot(p.x - BLACK_HOLE.x, p.y - BLACK_HOLE.y) < 55;
  }

  // A poster still on the wall, or with cut true, the secret hole where one was.
  function posterAt(p: Point, cut: boolean): Poster | null {
    return posters.find((poster) => (poster.cutAt !== null) === cut && inRect(p, poster.x, poster.y, poster.w, poster.h)) ?? null;
  }

  // ---------- input ----------

  function float(text: string, x: number, y: number, now: number): void {
    floaters.push({ text, x: clamp(x, 130, W - 130), y, start: now });
  }

  function pointerDown(p: Point): void {
    pointer = p;
    const now = performance.now();

    if (scene === "bonus") {
      setScene("search", now);
      return;
    }
    if (scene === "search") {
      const hole = posterAt(p, true);
      if (hole) {
        sounds.whoosh(BONUS_IN_MS / 1000);
        bonusAt = { x: hole.x + hole.w / 2, y: hole.y + hole.h / 2 + 10 };
        setScene("bonusIn", now);
        return;
      }
      const poster = posterAt(p, false);
      if (poster && selectedTool() === "saw") {
        poster.cutAt = now;
        sounds.crack();
        sounds.paper();
        return;
      }
      const spot = spotAt(p);
      if (!spot) return;
      spot.searchedAt = now;
      if (spot.hasPiece) {
        sounds.pop();
        flyers.push({ fromX: spot.x, fromY: spot.y - 20, start: now, slot: pieces[found]?.slot ?? 0, hudIndex: found });
        found += 1;
      } else {
        sounds.womp();
        float(DECOY_LINES[spot.kind], spot.x, spot.y - 40, now);
      }
      return;
    }

    if (scene !== "desk") return;
    if (allGlued() && overBlackHole(p)) {
      sounds.whoosh(LEAVE_MS / 1000);
      setScene("leaving", now);
      return;
    }
    const piece = pieceAt(p);
    if (!piece) return;
    if (selectedTool() === "glue") {
      sounds.squish();
      piece.flyStart = now;
    } else {
      sounds.paper();
      piece.wiggleStart = now;
      float("It won't stick by itself.", piece.homeX, piece.homeY - 60, now);
    }
  }

  function pointerMove(p: Point): void {
    pointer = p;
  }

  function pointerUp(): void {}

  function cursor(p: Point): string {
    if (scene === "bonus") return "pointer";
    if (scene === "search") {
      if (posterAt(p, true)) return "pointer";
      if (selectedTool() === "saw") return "none";
      return spotAt(p) ? "pointer" : "default";
    }
    if (scene !== "desk") return "default";
    if (selectedTool() === "glue") return "none";
    if (pieceAt(p) || (allGlued() && overBlackHole(p))) return "pointer";
    return "default";
  }

  // ---------- update ----------

  function update(now: number): void {
    const elapsed = now - sceneStart;
    if (scene === "search") {
      for (const flyer of flyers) {
        if (now - flyer.start >= POP_MS) {
          collected += 1;
          sounds.chime();
        }
      }
      flyers = flyers.filter((flyer) => now - flyer.start < POP_MS);
      if (collected === PIECE_COUNT) setScene("toDesk", now);
    } else if (scene === "bonusIn" && elapsed >= BONUS_IN_MS) {
      setScene("bonus", now);
    } else if (scene === "toDesk" && elapsed >= TO_DESK_MS) {
      setScene("desk", now);
    } else if (scene === "desk") {
      for (const piece of pieces) {
        if (piece.flyStart === null || now - piece.flyStart < GLUE_FLY_MS) continue;
        piece.flyStart = null;
        piece.glued = true;
        pageBump = now;
        sounds.splat();
        if (allGlued()) sounds.chime();
      }
    } else if (scene === "leaving" && elapsed >= LEAVE_MS) {
      setScene("escaped", now);
      escape();
    }
    floaters = floaters.filter((f) => now - f.start < FLOAT_MS);
  }

  // ---------- comic panels ----------

  function stickFigure(x: number, y: number, size: number, pose: "armsUp" | "run" | "flip", color = "#111"): void {
    ctx.save();
    ctx.translate(x, y);
    if (pose === "flip") ctx.rotate(Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const neck = -size * 0.55;
    const headR = size * 0.15;
    line(0, 0, 0, neck);
    if (pose === "run") {
      line(0, 0, -size * 0.28, size * 0.4);
      line(0, 0, size * 0.32, size * 0.28);
      line(0, neck + size * 0.12, -size * 0.3, -size * 0.2);
      line(0, neck + size * 0.12, size * 0.32, neck - size * 0.05);
    } else {
      line(0, 0, -size * 0.2, size * 0.45);
      line(0, 0, size * 0.2, size * 0.45);
      line(0, neck + size * 0.12, -size * 0.32, neck - size * 0.2);
      line(0, neck + size * 0.12, size * 0.32, neck - size * 0.2);
    }
    ctx.fillStyle = color === "#111" ? "#fff" : "#111";
    ctx.beginPath();
    ctx.arc(0, neck - headR, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function burst(cx: number, cy: number, r: number, text: string, fill: string, ink: string): void {
    ctx.beginPath();
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.62;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.15);
    ctx.fillStyle = ink;
    ctx.font = `bold ${Math.round(r * 0.48)}px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 1);
    ctx.restore();
  }

  function bubble(cx: number, cy: number, rx: number, ry: number, tailX: number, tailY: number, text: string): void {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.35, cy + ry * 0.6);
    ctx.lineTo(tailX, tailY);
    ctx.lineTo(cx, cy + ry * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = `bold 12px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy + 1);
  }

  // 1. Stuck in the room with nothing.
  function panelNoDoor(): void {
    ctx.fillStyle = "#d9d2e6";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "#b89a78";
    poly([35, 105], [145, 105], [PANEL_W, PANEL_H], [0, PANEL_H]);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 20, 110, 85);
    line(0, 0, 35, 20);
    line(PANEL_W, 0, 145, 20);
    line(0, PANEL_H, 35, 105);
    line(PANEL_W, PANEL_H, 145, 105);
    stickFigure(78, 118, 50, "armsUp");
    bubble(128, 30, 44, 18, 92, 70, "NO DOOR?!");
  }

  // 2. The saw pops out of the mirror.
  function panelSaw(): void {
    ctx.fillStyle = "#bfe3f0";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let y = 6; y < PANEL_H; y += 12) {
      for (let x = 6; x < PANEL_W; x += 12) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    burst(138, 40, 34, "POP!", "#ffd23f", "#e63946");
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(40, 58, 64, 88);
    ctx.fillStyle = "#a9c8d6";
    ctx.fillRect(47, 65, 50, 74);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    line(54, 90, 70, 74);

    ctx.save();
    ctx.translate(70, 38);
    ctx.rotate(-0.4);
    ctx.fillStyle = "#dfe5ea";
    poly([-40, 2], [-40, -4], [18, -12], [18, 8]);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#b5552b";
    roundRect(16, -15, 22, 26, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    line(56, 56, 52, 50);
    line(72, 54, 72, 47);
    line(88, 56, 92, 50);
  }

  // 3. Down the table hole.
  function panelHole(): void {
    ctx.fillStyle = "#e8c9a0";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = 2;
    for (let x = 20; x < PANEL_W; x += 30) line(x, 60, x - 10, PANEL_H);

    ctx.save();
    ctx.translate(48, 32);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#6a3fb5";
    ctx.font = `bold 22px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WHOOO!", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#8a5a30";
    ctx.save();
    ctx.translate(34, 104);
    ctx.rotate(0.5);
    ctx.fillRect(-30, -5, 42, 9);
    ctx.restore();
    ctx.save();
    ctx.translate(156, 104);
    ctx.rotate(-0.5);
    ctx.fillRect(-12, -5, 42, 9);
    ctx.restore();

    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(95, 118, 62, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    stickFigure(95, 92, 44, "flip");
    // The front lip of the hole swallows the head.
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(95, 118, 62, 18, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    line(78, 44, 76, 34);
    line(112, 44, 114, 34);
  }

  // 4. BONK the plywood wall with the door knob.
  function panelBonk(): void {
    ctx.fillStyle = "#9aa6ac";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "#d7ae72";
    ctx.fillRect(28, 28, 110, 110);
    ctx.strokeStyle = "#8a6536";
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i += 1) line(28 + 22 * i, 28, 28 + 22 * i, 138);
    ctx.strokeRect(28, 28, 110, 110);

    ctx.fillStyle = "#b8902f";
    ctx.fillRect(98, 80, 18, 6);
    ctx.fillStyle = "#e0b040";
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.arc(94, 83, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(112, 70, 28, -1.3, -0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(112, 70, 38, -1.2, -0.3);
    ctx.stroke();
    burst(142, 40, 32, "BONK!", "#ff8c42", "#111");
  }

  // 5. Running down the tunnel.
  function panelTunnel(): void {
    ctx.fillStyle = "#0c0c10";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "#1c1c22";
    poly([0, 0], [78, 48], [78, 92], [0, PANEL_H]);
    ctx.fillStyle = "#16161b";
    poly([PANEL_W, 0], [102, 48], [102, 92], [PANEL_W, PANEL_H]);
    ctx.fillStyle = "#2a241d";
    poly([0, PANEL_H], [PANEL_W, PANEL_H], [102, 92], [78, 92]);
    const glow = ctx.createRadialGradient(90, 70, 4, 90, 70, 80);
    glow.addColorStop(0, "rgba(255, 214, 130, 0.45)");
    glow.addColorStop(1, "rgba(255, 214, 130, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "#fff1b8";
    ctx.fillRect(78, 48, 24, 44);
    ctx.fillStyle = "#1f8f4a";
    ctx.fillRect(75, 35, 30, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXIT", 90, 40.5);
    ctx.strokeStyle = "#5dff8a";
    ctx.lineWidth = 3;
    line(80, 138, 90, 130);
    line(90, 130, 100, 138);
    stickFigure(55, 110, 36, "run", "#f5efe6");
  }

  // 6. The black hole. This one is the way out.
  function panelBlackHole(now: number): void {
    ctx.fillStyle = "#140a26";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < 18; i += 1) {
      ctx.fillRect((i * 67 + 11) % PANEL_W, (i * 41 + 13) % PANEL_H, 2, 2);
    }
    const cx = 90;
    const cy = 72;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 72);
    glow.addColorStop(0, "rgba(255, 140, 60, 0.6)");
    glow.addColorStop(0.5, "rgba(140, 60, 255, 0.3)");
    glow.addColorStop(1, "rgba(140, 60, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);

    const spin = now / 500;
    ctx.strokeStyle = "rgba(255, 190, 110, 0.75)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k += 1) {
      ctx.beginPath();
      for (let s = 0; s <= 1.001; s += 0.05) {
        const a = spin + (k * Math.PI * 2) / 3 + s * 3.2;
        const r = 22 + s * 44;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 0.8;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#b388ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffd23f";
    ctx.font = `bold 16px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("…?", 152, 134);
  }

  function drawPanelArt(slot: number, now: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PANEL_W, PANEL_H);
    ctx.clip();
    if (slot === 0) panelNoDoor();
    else if (slot === 1) panelSaw();
    else if (slot === 2) panelHole();
    else if (slot === 3) panelBonk();
    else if (slot === 4) panelTunnel();
    else panelBlackHole(now);
    ctx.restore();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, PANEL_W - 4, PANEL_H - 4);
  }

  // ---------- search scene ----------

  function drawPosters(now: number): void {
    for (const poster of posters) {
      if (poster.cutAt === null) {
        ctx.fillStyle = poster.color;
        ctx.fillRect(poster.x, poster.y, poster.w, poster.h);
        ctx.strokeStyle = "#1d1d1d";
        ctx.lineWidth = 3;
        ctx.strokeRect(poster.x, poster.y, poster.w, poster.h);
        burst(poster.x + poster.w / 2, poster.y + poster.h / 2, poster.r, poster.word, poster.burst, poster.ink);
      } else {
        drawSecretHole(poster, now);
        drawShreds(poster, now - poster.cutAt);
      }
      // The tape stays on the wall either way.
      ctx.fillStyle = "rgba(255, 255, 240, 0.7)";
      ctx.fillRect(poster.x - 6, poster.y - 6, 14, 10);
      ctx.fillRect(poster.x + poster.w - 6, poster.y - 6, 14, 10);
    }
  }

  // What was behind the poster: a doorway sawn into the wall, with a passage
  // and glowing steps going back to a secret bonus level. Scraps of the poster
  // stay stuck under the tape.
  function drawSecretHole(poster: Poster, now: number): void {
    const L = poster.x + 8;
    const R = poster.x + poster.w - 8;
    const T = poster.y + 14;
    const B = poster.y + poster.h;
    const cx = (L + R) / 2;
    // The far end of the passage, smaller and a little higher.
    const iL = cx - (R - L) * 0.22;
    const iR = cx + (R - L) * 0.22;
    const iT = T + (B - T) * 0.28;
    const iB = T + (B - T) * 0.62;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);

    // The cut edge of the wall, lighter than the paint.
    ctx.fillStyle = "#9fb3c8";
    ctx.fillRect(L - 4, T - 4, R - L + 8, B - T + 8);

    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, R - L, B - T);
    ctx.clip();
    ctx.fillStyle = "#1a0b2e";
    poly([L, T], [R, T], [iR, iT], [iL, iT]);
    ctx.fillStyle = "#24103f";
    poly([L, T], [iL, iT], [iL, iB], [L, B]);
    ctx.fillStyle = "#1f0d37";
    poly([R, T], [iR, iT], [iR, iB], [R, B]);
    ctx.fillStyle = "#2e1450";
    poly([L, B], [R, B], [iR, iB], [iL, iB]);

    const glowY = (iT + iB) / 2;
    const glow = ctx.createRadialGradient(cx, glowY, 2, cx, glowY, (R - L) * 0.75);
    glow.addColorStop(0, `rgba(214, 160, 255, ${0.55 + 0.25 * pulse})`);
    glow.addColorStop(1, "rgba(199, 125, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(L, T, R - L, B - T);
    ctx.fillStyle = "#e9d2ff";
    ctx.fillRect(iL, iT, iR - iL, iB - iT);

    // Glowing steps along the passage floor, getting smaller toward the light.
    ctx.fillStyle = `rgba(199, 125, 255, ${0.45 + 0.25 * pulse})`;
    for (let i = 0; i < 4; i += 1) {
      const s = (i + 0.5) / 4;
      const half = lerp((R - L) / 2, (iR - iL) / 2, s) - 4;
      ctx.fillRect(cx - half, lerp(B, iB, s) - 2, half * 2, Math.max(2, 5 * (1 - s)));
    }
    ctx.restore();

    ctx.strokeStyle = "#3a2a4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(L, T, R - L, B - T);

    // A little sign at the top of the doorway
    ctx.fillStyle = "rgba(20, 8, 36, 0.85)";
    roundRect(cx - 30, T + 4, 60, 18, 4);
    ctx.fill();
    ctx.fillStyle = "#f0e0ff";
    ctx.font = `bold 12px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("BONUS", cx, T + 13.5);

    // Torn scraps of the poster still stuck under the tape
    ctx.fillStyle = poster.color;
    poly([poster.x - 4, poster.y - 2], [poster.x + 18, poster.y - 2], [poster.x + 13, T + 7], [poster.x + 5, poster.y + 26], [poster.x - 2, T + 3]);
    poly(
      [poster.x + poster.w - 18, poster.y - 2],
      [poster.x + poster.w + 4, poster.y - 2],
      [poster.x + poster.w + 2, T + 4],
      [poster.x + poster.w - 5, poster.y + 28],
      [poster.x + poster.w - 13, T + 9]
    );
  }

  // Strips of the cut-up poster falling off the wall.
  function drawShreds(poster: Poster, elapsed: number): void {
    if (elapsed > SHRED_MS) return;
    const t = elapsed / 1000;
    const strips = 6;
    const stripW = poster.w / strips;
    ctx.globalAlpha = 1 - elapsed / SHRED_MS;
    ctx.fillStyle = poster.color;
    for (let i = 0; i < strips; i += 1) {
      ctx.save();
      ctx.translate(poster.x + (i + 0.5) * stripW + (i - 2.5) * 60 * t, poster.y + poster.h / 2 + 700 * t * t);
      ctx.rotate((i % 2 === 0 ? 1 : -1) * t * (3 + i));
      ctx.fillRect(-stripW / 2 + 1, -poster.h / 2, stripW - 2, poster.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawCeilingLight(): void {
    const glow = ctx.createRadialGradient(W / 2, 50, 10, W / 2, 50, 240);
    glow.addColorStop(0, "rgba(255, 246, 216, 0.35)");
    glow.addColorStop(1, "rgba(255, 246, 216, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W / 2 - 240, 40, 480, 260);
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.ellipse(W / 2, 48, 42, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCushion(color: string, open: boolean): void {
    if (open) {
      ctx.fillStyle = "#5a1f1a";
      ctx.fillRect(-67, -10, 135, 30);
      // A couple of coins down the back of the couch
      ctx.fillStyle = "#e0b040";
      ctx.beginPath();
      ctx.ellipse(-20, 8, 6, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(30, 12, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(0, -14);
      ctx.rotate(-0.06);
    }
    ctx.fillStyle = color;
    roundRect(-67, -22, 135, 45, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    roundRect(-60, -18, 121, 10, 5);
    ctx.fill();
  }

  function drawCouch(): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(620, 424, 175, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b8433a";
    roundRect(470, 290, 300, 72, 14);
    ctx.fill();
    ctx.fillStyle = "#9c3830";
    ctx.fillRect(470, 392, 300, 28);
    ctx.fillStyle = "#3a2416";
    ctx.fillRect(482, 420, 10, 8);
    ctx.fillRect(748, 420, 10, 8);
    ctx.save();
    ctx.translate(687, 372);
    drawCushion("#cc5247", false);
    ctx.restore();
    ctx.fillStyle = "#a83d34";
    roundRect(450, 305, 36, 110, 12);
    ctx.fill();
    roundRect(754, 305, 36, 110, 12);
    ctx.fill();
  }

  function drawShoe(color: string, flip: boolean, sock: boolean): void {
    ctx.scale(flip ? -1 : 1, 1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 38, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sock) {
      ctx.fillStyle = "#f4f4f0";
      roundRect(-28, -32, 14, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#d63a2f";
      ctx.fillRect(-28, -26, 14, 3);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-34, 8);
    ctx.lineTo(-34, -8);
    ctx.quadraticCurveTo(-30, -18, -12, -17);
    ctx.lineTo(0, -14);
    ctx.quadraticCurveTo(14, -4, 30, -2);
    ctx.quadraticCurveTo(38, 0, 36, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f4f4f0";
    roundRect(-36, 6, 74, 9, 4);
    ctx.fill();
    ctx.fillStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.ellipse(-21, -16, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4f4f0";
    ctx.lineWidth = 2;
    line(-6, -12, 4, -6);
    line(-2, -14, 8, -8);
    line(2, -16, 12, -10);
  }

  function drawPhone(angle: number, screen: "off" | "empty" | "found"): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(3, 6, 26, 12, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = "#1b1b1f";
    roundRect(-14, -24, 28, 48, 5);
    ctx.fill();
    ctx.fillStyle = screen === "off" ? "#26303a" : screen === "empty" ? "#3a7bd5" : "#f5d142";
    roundRect(-11, -19, 22, 38, 2);
    ctx.fill();
    if (screen !== "off") {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(screen === "empty" ? "0" : "!", 0, 1);
    }
  }

  function drawTrash(open: boolean): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 32, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7d8a91";
    poly([-24, -28], [24, -28], [18, 32], [-18, 32]);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.lineWidth = 2;
    for (const x of [-10, 0, 10]) line(x, -24, x * 0.8, 28);
    ctx.fillStyle = "#95a3aa";
    ctx.save();
    if (open) {
      ctx.fillStyle = "#2b3134";
      ctx.beginPath();
      ctx.ellipse(0, -28, 24, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#95a3aa";
      ctx.translate(-30, -34);
      ctx.rotate(-0.9);
    } else {
      ctx.translate(0, -30);
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-5, -8, 10, 5);
    ctx.restore();
  }

  function drawPizza(open: boolean): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    poly([-54, -10], [54, -14], [68, 24], [-44, 26]);
    ctx.strokeStyle = "#8a6a3a";
    ctx.lineWidth = 2;
    ctx.fillStyle = "#d9b27a";
    poly([-58, -16], [48, -20], [62, 16], [-48, 20]);
    ctx.stroke();
    ctx.save();
    if (open) {
      ctx.fillStyle = "#b98f55";
      poly([-52, -12], [44, -16], [56, 12], [-44, 16]);
      ctx.fillStyle = "#e6c795";
      poly([-58, -16], [48, -20], [44, -58], [-60, -52]);
      ctx.stroke();
      ctx.translate(-6, -36);
    }
    ctx.fillStyle = "#c0392b";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PIZZA", 2, 0);
    ctx.restore();
  }

  function drawSpot(spot: Spot, now: number): void {
    const since = spot.searchedAt === null ? Infinity : now - spot.searchedAt;
    const open = spot.searchedAt !== null;
    let dx = 0;
    let dy = 0;
    if (since < HOP_MS) {
      const t = since / HOP_MS;
      if (spot.hasPiece) dy = -Math.sin(Math.PI * t) * 18;
      else dx = Math.sin(t * 40) * 5 * (1 - t);
    }

    ctx.save();
    ctx.translate(spot.x + dx, spot.y + dy);
    if (spot.kind === "shoe") drawShoe(spot.color, spot.flip, open && !spot.hasPiece);
    else if (spot.kind === "phone") drawPhone(spot.angle, open ? (spot.hasPiece ? "found" : "empty") : "off");
    else if (spot.kind === "trash") drawTrash(open);
    else if (spot.kind === "pizza") drawPizza(open);
    else drawCushion(spot.color, open);
    ctx.restore();

    // Stink lines coming off a decoy shoe
    if (spot.kind === "shoe" && open && !spot.hasPiece && since < 1600) {
      ctx.strokeStyle = `rgba(140, 200, 80, ${1 - since / 1600})`;
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        for (let s = 0; s <= 30; s += 3) {
          const x = spot.x + i * 14 + Math.sin(s / 5 + now / 120) * 4;
          const y = spot.y - 24 - s - since / 60;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Once searched, a check or a cross so you remember which ones you tried.
    if (open && since >= HOP_MS) {
      const mx = spot.x + spot.w / 2 - 4;
      const my = spot.y - spot.h / 2;
      ctx.fillStyle = spot.hasPiece ? "#2fa84f" : "#6b6f75";
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      if (spot.hasPiece) {
        line(mx - 4, my, mx - 1, my + 4);
        line(mx - 1, my + 4, mx + 5, my - 4);
      } else {
        line(mx - 4, my - 4, mx + 4, my + 4);
        line(mx + 4, my - 4, mx - 4, my + 4);
      }
    }
  }

  function hudSlot(index: number): Point {
    return { x: 26 + index * 38, y: 33 };
  }

  function drawMiniPanel(slot: number, x: number, y: number, now: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(32 / PANEL_W, 24 / PANEL_H);
    drawPanelArt(slot, now);
    ctx.restore();
  }

  function drawHud(now: number): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    roundRect(14, 10, 256, 56, 10);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 12px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`COMIC PIECES  ${collected} / ${PIECE_COUNT}`, 26, 22);
    for (let i = 0; i < PIECE_COUNT; i += 1) {
      const slot = hudSlot(i);
      if (i < collected) {
        drawMiniPanel(pieces[i]?.slot ?? 0, slot.x, slot.y, now);
      } else {
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(slot.x, slot.y, 32, 24);
        ctx.restore();
      }
    }
  }

  function drawFlyers(now: number): void {
    for (const flyer of flyers) {
      const t = Math.min(1, (now - flyer.start) / POP_MS);
      const target = hudSlot(flyer.hudIndex);
      // Pops straight up out of the hiding spot, then zips into the counter.
      const x = lerp(flyer.fromX, target.x + 16, t * t);
      const y = lerp(flyer.fromY, target.y + 12, t * t) - Math.sin(Math.PI * Math.min(1, t * 1.6)) * 80;
      const scale = lerp(0.45, 32 / PANEL_W, t);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * Math.PI * 2);
      ctx.scale(scale, scale);
      ctx.translate(-PANEL_W / 2, -PANEL_H / 2);
      drawPanelArt(flyer.slot, now);
      ctx.restore();
    }
  }

  function drawSearch(now: number): void {
    drawRoomBox(PALETTE);
    drawCeilingLight();
    drawPosters(now);
    drawCouch();
    for (const spot of spots) drawSpot(spot, now);
    drawVignette();
    drawFlyers(now);
    drawHud(now);
    if (found === 0) drawCaption("Somebody tore up a comic book.", (now - roomStart) / 1000);
  }

  // ---------- desk scene ----------

  function drawGlueDots(): void {
    ctx.fillStyle = "rgba(250, 250, 245, 0.9)";
    for (const [x, y, r] of [
      [14, 14, 6],
      [PANEL_W - 16, PANEL_H - 14, 7],
      [PANEL_W - 20, 12, 5],
      [18, PANEL_H - 18, 5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLoosePiece(piece: Piece, now: number): void {
    let x = piece.homeX;
    let y = piece.homeY;
    let angle = piece.homeAngle;
    let scale = SCATTER_SCALE;
    if (piece.flyStart !== null) {
      const t = clamp((now - piece.flyStart) / GLUE_FLY_MS, 0, 1);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const target = slotCenter(piece.slot);
      x = lerp(x, target.x, e);
      y = lerp(y, target.y, e) - Math.sin(Math.PI * t) * 50;
      angle = lerp(angle, 0, e);
      scale = lerp(scale, 1, e);
    } else {
      const wiggle = now - piece.wiggleStart;
      if (wiggle < WIGGLE_MS) angle += Math.sin(wiggle / 25) * 0.18 * (1 - wiggle / WIGGLE_MS);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(-PANEL_W / 2 + 6, -PANEL_H / 2 + 8, PANEL_W, PANEL_H);
    ctx.translate(-PANEL_W / 2, -PANEL_H / 2);
    drawPanelArt(piece.slot, now);
    if (piece.flyStart !== null) drawGlueDots();
    ctx.restore();
  }

  function drawGlueCursor(p: Point): void {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(0.5);
    ctx.fillStyle = "#f08a24";
    poly([0, 0], [-6, -14], [6, -14]);
    ctx.fillStyle = "#f4f4f0";
    roundRect(-12, -50, 24, 36, 5);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#3a7bd5";
    ctx.fillRect(-12, -40, 24, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 8px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GLUE", 0, -34);
    ctx.restore();
  }

  function drawDesk(now: number): void {
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    for (let y = 12; y < H; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 40; x <= W; x += 40) ctx.lineTo(x, y + Math.sin((x + y * 3) / 70) * 3);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    line(0, 200, W, 200);
    line(0, 400, W, 400);

    // A pencil and an eraser, for the look of it
    ctx.save();
    ctx.translate(90, 565);
    ctx.rotate(-0.25);
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(-50, -5, 90, 10);
    ctx.fillStyle = "#e8c9a0";
    poly([40, -5], [56, 0], [40, 5]);
    ctx.fillStyle = "#e88a9a";
    ctx.fillRect(-60, -5, 10, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(905, 572);
    ctx.rotate(0.2);
    ctx.fillStyle = "#e88a9a";
    roundRect(-22, -10, 44, 20, 4);
    ctx.fill();
    ctx.restore();

    const bumpT = (now - pageBump) / BUMP_MS;
    const bump = bumpT < 1 ? 1 + Math.sin(bumpT * Math.PI) * 0.012 : 1;
    ctx.save();
    ctx.translate(PAGE.x + PAGE.w / 2, PAGE.y + PAGE.h / 2);
    ctx.scale(bump, bump);
    ctx.translate(-(PAGE.x + PAGE.w / 2), -(PAGE.y + PAGE.h / 2));
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(PAGE.x + 8, PAGE.y + 10, PAGE.w, PAGE.h);
    ctx.fillStyle = "#fbf8ef";
    ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);
    for (let slot = 0; slot < PIECE_COUNT; slot += 1) {
      const p = slotPos(slot);
      if (pieces.some((piece) => piece.slot === slot && piece.glued)) {
        ctx.save();
        ctx.translate(p.x, p.y);
        drawPanelArt(slot, now);
        drawGlueDots();
        ctx.restore();
      } else {
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, PANEL_W, PANEL_H);
        ctx.restore();
      }
    }
    ctx.restore();

    for (const piece of pieces) if (!piece.glued && piece.flyStart === null) drawLoosePiece(piece, now);
    for (const piece of pieces) if (piece.flyStart !== null) drawLoosePiece(piece, now);
  }

  function drawFloaters(now: number): void {
    ctx.font = `bold 20px ${COMIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.fillStyle = "#fff";
    for (const f of floaters) {
      const t = (now - f.start) / FLOAT_MS;
      ctx.globalAlpha = t < 0.7 ? 1 : Math.max(0, (1 - t) / 0.3);
      ctx.strokeText(f.text, f.x, f.y - 40 * t);
      ctx.fillText(f.text, f.x, f.y - 40 * t);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now: number): void {
    const elapsed = now - sceneStart;
    let dark = 0;

    if (scene === "search") {
      drawSearch(now);
      if (selectedTool() === "saw") drawSaw(pointer.x, pointer.y, -0.35);
    } else if (scene === "bonusIn") {
      ctx.save();
      dark = diveInto(bonusAt.x, bonusAt.y, Math.min(1, elapsed / BONUS_IN_MS));
      drawSearch(now);
      ctx.restore();
    } else if (scene === "bonus") {
      drawBonusCard(elapsed / 1000);
    } else if (scene === "toDesk") {
      // Fade out of the bedroom and into the desk.
      const t = Math.min(1, elapsed / TO_DESK_MS);
      if (t < 0.5) drawSearch(now);
      else drawDesk(now);
      dark = t < 0.5 ? t * 2 : (1 - t) * 2;
    } else {
      ctx.save();
      if (scene === "leaving" || scene === "escaped") {
        // Spiral down into the black hole.
        const t = Math.min(1, elapsed / LEAVE_MS);
        const zoom = 1 + t * t * 28;
        ctx.translate(BLACK_HOLE.x, BLACK_HOLE.y);
        ctx.rotate(t * t * 5);
        ctx.scale(zoom, zoom);
        ctx.translate(-BLACK_HOLE.x, -BLACK_HOLE.y);
        dark = scene === "escaped" ? 1 : Math.max(0, (t - 0.6) / 0.4);
      }
      drawDesk(now);
      ctx.restore();
      if (scene === "desk") {
        if (selectedTool() !== "glue") drawCaption("These pieces won't stick on their own.", elapsed / 1000);
        if (selectedTool() === "glue") drawGlueCursor(pointer);
      }
    }

    drawFloaters(now);

    if (dark > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${dark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return {
    name: "Comical",
    exitLine: "The black hole spat you out in…",
    reset,
    update,
    draw,
    pointerDown,
    pointerMove,
    pointerUp,
    cursor,
  };
}
