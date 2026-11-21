// SKINS (Oscar, 2026-11-21: "I'm tired of this annoying stick man... More
// skins."). Collect gems in Levels 46-50 to unlock them, then pick one in the
// Skins menu. A skin unlocks once you've collected enough gems in total.

export interface Skin {
  id: string;
  name: string;
  gems: number; // gems you need to unlock it
}

export const SKINS: Skin[] = [
  { id: "stick", name: "Stick Man", gems: 0 },
  { id: "ninja", name: "Ninja", gems: 1 },
  { id: "cat", name: "Cat", gems: 3 },
  { id: "robot", name: "Robot", gems: 5 },
  { id: "wizard", name: "Wizard", gems: 7 },
  { id: "astronaut", name: "Astronaut", gems: 9 },
  { id: "knight", name: "Knight", gems: 11 },
  { id: "monster", name: "Mini Monster", gems: 13 },
  { id: "golden", name: "Golden", gems: 15 },
];

export const SKIN_KEY = "destroy-the-game-skin";
export const GEMS_KEY = "destroy-the-game-gems";

/** Every gem you've ever grabbed, as "level:col,row". */
export function readGems(): Set<string> {
  try {
    const raw = localStorage.getItem(GEMS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((g): g is string => typeof g === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveGems(gems: Set<string>): void {
  try {
    localStorage.setItem(GEMS_KEY, JSON.stringify([...gems]));
  } catch {
    // Nothing to do: the gem still counts for now.
  }
}

export function readSkin(): Skin {
  let id = "stick";
  try {
    id = localStorage.getItem(SKIN_KEY) ?? "stick";
  } catch {
    // Use the stick man.
  }
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0]!;
  // Only if you've still got enough gems for it.
  return readGems().size >= skin.gems ? skin : SKINS[0]!;
}

export function saveSkin(id: string): void {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // Oh well.
  }
}

export interface Pose {
  cx: number; // middle of the player
  top: number; // top of the player's head
  h: number; // how tall the player is
  facing: 1 | -1;
  lean: number; // leaning forward while dashing
  swing: number; // how far the legs are swinging
  arms: "swing" | "dash" | "pour";
  time: number;
}

type Line = (x1: number, y1: number, x2: number, y2: number, wobble?: number) => void;

const INK: Record<string, string> = {
  stick: "#28328c",
  ninja: "#1c1c22",
  cat: "#a2520f",
  robot: "#46515c",
  wizard: "#4b2a8c",
  astronaut: "#5a6270",
  knight: "#3d4450",
  monster: "#4a1f5c",
  golden: "#a87708",
};

/** Draws the player in this skin. `line` draws one (sketchy) line. */
export function drawFigure(ctx: CanvasRenderingContext2D, skinId: string, p: Pose, line: Line): void {
  const ink = INK[skinId] ?? INK["stick"]!;
  const f = p.facing;
  const head = { x: p.cx + p.lean, y: p.top + 6.5 };
  const neck = { x: p.cx + p.lean, y: p.top + 13 };
  const hip = { x: p.cx, y: p.top + 21 };
  const feet = p.top + p.h;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.8;

  // ---- Things behind the body ----
  if (skinId === "cat") {
    // A curly tail.
    ctx.beginPath();
    ctx.moveTo(hip.x - f * 2, hip.y);
    ctx.quadraticCurveTo(hip.x - f * 16, hip.y + 2 + Math.sin(p.time * 6) * 3, hip.x - f * 14, hip.y - 10);
    ctx.stroke();
  }
  if (skinId === "ninja") {
    // Headband tails flapping behind.
    ctx.strokeStyle = "#e0312b";
    ctx.lineWidth = 2.4;
    const wave = Math.sin(p.time * 14) * 3;
    line(head.x - f * 5, head.y - 2, head.x - f * 15, head.y - 1 + wave, 0.4);
    line(head.x - f * 5, head.y - 1, head.x - f * 13, head.y + 4 - wave, 0.4);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.8;
  }
  if (skinId === "astronaut") {
    // A backpack.
    ctx.fillStyle = "#d8dde4";
    ctx.fillRect(neck.x - f * 9 - 4, neck.y, 8, 11);
    ctx.lineWidth = 2;
    ctx.strokeRect(neck.x - f * 9 - 4, neck.y, 8, 11);
    ctx.lineWidth = 2.8;
  }
  if (skinId === "golden") {
    // Sparkles all around.
    for (let i = 0; i < 4; i++) {
      const a = p.time * 2 + i * 1.57;
      const sx = p.cx + Math.cos(a) * 17;
      const sy = p.top + 16 + Math.sin(a * 1.3) * 15;
      const r = 1.5 + Math.abs(Math.sin(p.time * 5 + i)) * 1.8;
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Body ----
  if (skinId === "robot") {
    ctx.fillStyle = "#b9c4cf";
    ctx.fillRect(neck.x - 6, neck.y, 12, hip.y - neck.y + 1);
    ctx.lineWidth = 2.2;
    ctx.strokeRect(neck.x - 6, neck.y, 12, hip.y - neck.y + 1);
    ctx.fillStyle = "#e8423a";
    ctx.fillRect(neck.x - 2, neck.y + 3, 4, 3); // a little light
    ctx.lineWidth = 2.8;
  } else if (skinId === "wizard" || skinId === "monster") {
    // A robe (wizard) or a furry body (monster).
    ctx.fillStyle = skinId === "wizard" ? "#6c3fc0" : "#7b3a94";
    ctx.beginPath();
    ctx.moveTo(neck.x - 3, neck.y);
    ctx.lineTo(neck.x + 3, neck.y);
    ctx.lineTo(hip.x + 8, hip.y + 4);
    ctx.lineTo(hip.x - 8, hip.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 2.8;
  } else {
    if (skinId === "astronaut") ctx.lineWidth = 5;
    line(neck.x, neck.y, hip.x, hip.y, 0.8);
    ctx.lineWidth = 2.8;
  }

  // ---- Arms ----
  if (p.arms === "pour") {
    line(neck.x, neck.y + 3, neck.x + f * 13, neck.y + 1, 0.6);
    line(neck.x, neck.y + 3, neck.x + f * 12, neck.y + 6, 0.6);
  } else if (p.arms === "dash") {
    line(neck.x, neck.y + 3, neck.x - f * 11, neck.y + 1, 0.6);
    line(neck.x, neck.y + 3, neck.x - f * 10, neck.y + 9, 0.6);
  } else {
    line(neck.x, neck.y + 3, neck.x - 9, neck.y + 9 + p.swing * 0.4, 0.6);
    line(neck.x, neck.y + 3, neck.x + 9, neck.y + 9 - p.swing * 0.4, 0.6);
  }
  if (skinId === "knight" && p.arms !== "pour") {
    // A shield on the front arm.
    const sx = neck.x + f * 9;
    const sy = neck.y + 7;
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy - 6);
    ctx.lineTo(sx + 5, sy - 6);
    ctx.lineTo(sx + 5, sy + 2);
    ctx.lineTo(sx, sy + 8);
    ctx.lineTo(sx - 5, sy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f1c40f";
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.8;
  }

  // ---- Legs ----
  line(hip.x, hip.y, hip.x - 6 + p.swing, feet, 0.6);
  line(hip.x, hip.y, hip.x + 6 - p.swing, feet, 0.6);
  if (skinId === "robot" || skinId === "knight" || skinId === "astronaut") {
    // Boots.
    ctx.fillStyle = ink;
    ctx.fillRect(hip.x - 6 + p.swing - 3, feet - 3, 6, 3);
    ctx.fillRect(hip.x + 6 - p.swing - 3, feet - 3, 6, 3);
  }

  // ---- Head ----
  drawHead(ctx, skinId, head, f, ink, p.time, line);
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  skinId: string,
  head: { x: number; y: number },
  f: 1 | -1,
  ink: string,
  time: number,
  line: Line
): void {
  const circle = (r: number, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  const eye = (x: number, y: number, r: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  switch (skinId) {
    case "ninja":
      circle(6.5, "#2a2a33");
      ctx.fillStyle = "#e0312b";
      ctx.fillRect(head.x - 6.5, head.y - 3, 13, 3); // headband
      ctx.fillStyle = "#f3d9b8";
      ctx.fillRect(head.x + f * 1 - 3.5, head.y + 0.5, 7, 2.6); // eye slit
      eye(head.x + f * 3, head.y + 1.7, 1.1, "#1c1c22");
      break;
    case "cat":
      ctx.fillStyle = "#ffb35c";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(head.x + side * 6, head.y - 2);
        ctx.lineTo(head.x + side * 5, head.y - 11);
        ctx.lineTo(head.x + side * 1, head.y - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      circle(6.5, "#ffb35c");
      eye(head.x + f * 3, head.y - 0.5, 1.5, "#1d6b2a");
      ctx.lineWidth = 1;
      line(head.x + f * 4, head.y + 2.5, head.x + f * 11, head.y + 1.5, 0.2);
      line(head.x + f * 4, head.y + 3.5, head.x + f * 11, head.y + 5, 0.2);
      ctx.lineWidth = 2.8;
      break;
    case "robot":
      ctx.fillStyle = "#c8d2dc";
      ctx.fillRect(head.x - 7, head.y - 6.5, 14, 13);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(head.x - 7, head.y - 6.5, 14, 13);
      line(head.x, head.y - 6.5, head.x, head.y - 12, 0.2); // antenna
      eye(head.x, head.y - 13, 2, Math.sin(time * 6) > 0 ? "#e8423a" : "#ff9a8f");
      ctx.fillStyle = "#33e0ff";
      ctx.fillRect(head.x + f * 1 - 4, head.y - 2.5, 8, 3.5); // visor
      ctx.lineWidth = 2.8;
      break;
    case "wizard":
      circle(6.5, "#fff3e0");
      eye(head.x + f * 3, head.y - 0.5, 1.5, ink);
      // Beard.
      ctx.fillStyle = "#f4f4f4";
      ctx.beginPath();
      ctx.moveTo(head.x - 5, head.y + 2);
      ctx.lineTo(head.x + 5, head.y + 2);
      ctx.lineTo(head.x + f * 2, head.y + 13);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Pointy hat with a star.
      ctx.fillStyle = "#6c3fc0";
      ctx.beginPath();
      ctx.moveTo(head.x - 9, head.y - 3);
      ctx.lineTo(head.x + 9, head.y - 3);
      ctx.lineTo(head.x - f * 4, head.y - 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      eye(head.x - f * 1, head.y - 9, 2, "#ffe066");
      ctx.lineWidth = 2.8;
      break;
    case "astronaut":
      circle(6, "#fff3e0");
      eye(head.x + f * 3, head.y - 0.5, 1.4, ink);
      // Bubble helmet.
      ctx.fillStyle = "rgba(170, 215, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 6.5, -2.4, -1.6);
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.8;
      break;
    case "knight":
      // Plume, then a helmet with a slit.
      ctx.fillStyle = "#e0312b";
      ctx.beginPath();
      ctx.ellipse(head.x - f * 3, head.y - 9, 6, 3, -f * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9ced6";
      ctx.fillRect(head.x - 7, head.y - 7, 14, 14);
      ctx.lineWidth = 2.2;
      ctx.strokeRect(head.x - 7, head.y - 7, 14, 14);
      ctx.fillStyle = "#1c1c22";
      ctx.fillRect(head.x + f * 1 - 4, head.y - 2, 8, 2.5);
      ctx.lineWidth = 2.8;
      break;
    case "monster":
      // A little monster face: big eyes and teeth.
      circle(8, "#9b59b6");
      eye(head.x + f * 2 - 2.5, head.y - 2, 2.6, "#fff");
      eye(head.x + f * 2 + 2.5, head.y - 2, 2.6, "#fff");
      eye(head.x + f * 3 - 2.5, head.y - 2, 1.2, "#e8423a");
      eye(head.x + f * 3 + 2.5, head.y - 2, 1.2, "#e8423a");
      ctx.fillStyle = "#fff";
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(head.x + i * 2.4 - 1.2, head.y + 3);
        ctx.lineTo(head.x + i * 2.4 + 1.2, head.y + 3);
        ctx.lineTo(head.x + i * 2.4, head.y + 6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    case "golden":
      circle(6.5, "#ffd700");
      eye(head.x + f * 3, head.y - 0.5, 1.5, ink);
      // A crown.
      ctx.fillStyle = "#ffe066";
      ctx.beginPath();
      ctx.moveTo(head.x - 6, head.y - 5);
      ctx.lineTo(head.x - 6, head.y - 12);
      ctx.lineTo(head.x - 3, head.y - 8);
      ctx.lineTo(head.x, head.y - 13);
      ctx.lineTo(head.x + 3, head.y - 8);
      ctx.lineTo(head.x + 6, head.y - 12);
      ctx.lineTo(head.x + 6, head.y - 5);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.lineWidth = 2.8;
      break;
    default:
      circle(6.5, "#fffdf5");
      eye(head.x + f * 3, head.y - 0.5, 1.5, ink);
  }
}
