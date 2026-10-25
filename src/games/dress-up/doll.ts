// Drawing Penelope's dress-up doll and the places she can stand. Used by
// the wardrobe (main.ts) and the Design Studio and shop (studio.ts).

export type G = CanvasRenderingContext2D;

export const SKINS = ["#ffe0c8", "#f2c7a5", "#d9a072", "#a8704a", "#7a4a2a"];
export const COLORS = ["#ff6fb5", "#e8383d", "#ff9226", "#ffd23f", "#4cc76a", "#4a9bff", "#a35cff", "#ffffff", "#2b2b33", "#9c6d40"];
export const HAIR_COLORS = ["#5a3a22", "#24222b", "#e8c46a", "#c8562e", "#ff8fc7", "#a35cff", "#4a9bff", "#f4f1ee"];

export type Hair = "long" | "pigtails" | "bun" | "short" | "ponytail" | "curly";
export type Top = "none" | "tshirt" | "tank" | "sweater" | "puffy";
export type Bottom = "none" | "skirt" | "pants" | "shorts" | "tutu";
export type Dress = "none" | "gown" | "sundress" | "party";
export type Shoes = "none" | "sneakers" | "boots" | "sandals" | "heels";
export type Coat = "none" | "raincoat" | "puffer" | "cape";
export type Extra = "bow" | "crown" | "tiara" | "glasses" | "necklace" | "ears" | "wings" | "wand";
export type Place = "bedroom" | "garden" | "beach" | "castle" | "space";
export type Kind = "girl" | "boy";
export type Eyes = "round" | "sparkly" | "happy" | "star" | "heart" | "wink";
export const EYE_COLORS = ["#5a3a22", "#4a9bff", "#3e8f4f", "#a0763a", "#a35cff", "#7d8794"];

export interface Look {
  kind: Kind;
  // Your own designs she's wearing (from the Design Studio): one of each kind,
  // so your own shirt and skirt (and coat, and wig) can go on together.
  mine: string[];
  skin: string;
  eyes: Eyes;
  eyeColor: string;
  hair: Hair;
  hairColor: string;
  top: Top;
  topColor: string;
  bottom: Bottom;
  bottomColor: string;
  dress: Dress;
  dressColor: string;
  shoes: Shoes;
  shoesColor: string;
  coat: Coat;
  coatColor: string;
  extras: Extra[];
  extraColor: string;
  place: Place;
}

export const START: Look = {
  kind: "girl",
  mine: [],
  skin: SKINS[1]!,
  eyes: "round",
  eyeColor: "#5a3a22",
  hair: "long",
  hairColor: HAIR_COLORS[0]!,
  top: "tshirt",
  topColor: "#ff6fb5",
  bottom: "skirt",
  bottomColor: "#a35cff",
  dress: "none",
  dressColor: "#4a9bff",
  shoes: "sneakers",
  shoesColor: "#ffffff",
  coat: "none",
  coatColor: "#ffd23f",
  extras: ["bow"],
  extraColor: "#ff6fb5",
  place: "bedroom",
};

// ---- Drawing the doll ----
// Everything is drawn in "doll space": 300 wide and 600 tall, head at the top.

export function shape(g: G, points: [number, number][], fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

export function circle(g: G, x: number, y: number, r: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export function limb(g: G, x1: number, y1: number, x2: number, y2: number, width: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

export const darker = (hex: string, k = 0.8): string => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number): number => Math.round(((n >> s) & 255) * k);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
};

export const TORSO: [number, number][] = [[102, 196], [198, 196], [190, 322], [110, 322]];

function drawHairBack(g: G, l: Look): void {
  const c = l.hairColor;
  if (l.hair === "long") {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(84, 80, 132, 230, 50);
    g.fill();
  } else if (l.hair === "pigtails") {
    for (const side of [-1, 1]) {
      circle(g, 150 + side * 68, 120, 22, darker(c, 0.9));
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(150 + side * 82, 190, 22, 70, side * 0.15, 0, Math.PI * 2);
      g.fill();
    }
  } else if (l.hair === "bun") {
    circle(g, 150, 52, 32, c);
  } else if (l.hair === "short") {
    g.fillStyle = c;
    g.beginPath();
    g.roundRect(88, 82, 124, 110, 40);
    g.fill();
  } else if (l.hair === "ponytail") {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(214, 150, 24, 80, -0.25, 0, Math.PI * 2);
    g.fill();
  } else {
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * 0.9 + (i / 13) * Math.PI * 1.2;
      circle(g, 150 + Math.cos(a) * 70, 128 + Math.sin(a) * 70 + (i % 2) * 6, 26, c);
    }
    for (let i = 0; i < 6; i++) circle(g, 94 + (i % 2) * 112, 190 + Math.floor(i / 2) * 32, 24, c);
  }
}

function drawHairFront(g: G, l: Look): void {
  const c = l.hairColor;
  g.fillStyle = c;
  g.beginPath();
  g.arc(150, 120, 60, Math.PI * 1.02, Math.PI * 1.98);
  g.quadraticCurveTo(170, 92, 150, 96);
  g.quadraticCurveTo(120, 90, 92, 112);
  g.fill();
  if (l.hair === "curly") for (let i = 0; i < 5; i++) circle(g, 104 + i * 23, 72 + Math.abs(2 - i) * 4, 16, c);
}

function drawBody(g: G, l: Look): void {
  const s = l.skin;
  // Legs, then arms, then the body and head on top.
  limb(g, 130, 320, 128, 522, 30, s);
  limb(g, 170, 320, 172, 522, 30, s);
  g.fillStyle = s;
  g.beginPath();
  g.ellipse(124, 532, 22, 11, 0, 0, Math.PI * 2);
  g.ellipse(176, 532, 22, 11, 0, 0, Math.PI * 2);
  g.fill();
  limb(g, 104, 204, 80, 326, 22, s);
  limb(g, 196, 204, 220, 326, 22, s);
  circle(g, 78, 334, 13, s);
  circle(g, 222, 334, 13, s);
  shape(g, TORSO, s);
  g.fillStyle = s;
  g.fillRect(138, 168, 24, 32);
  circle(g, 150, 120, 58, s);
}

function drawFace(g: G, l: Look): void {
  // Eyes (in whichever shape and colour she has), rosy cheeks and a smile.
  [128, 172].forEach((x, side) => {
    limb(g, x - 9, 110, x + 7, 108, 3, darker(l.hairColor, 0.7));
    drawEye(g, l, x, 124, side === 1);
  });
  g.fillStyle = "rgba(255, 120, 150, 0.35)";
  g.beginPath();
  g.ellipse(112, 146, 11, 7, 0, 0, Math.PI * 2);
  g.ellipse(188, 146, 11, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#c0392b";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.arc(150, 146, 14, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
}

function drawEye(g: G, l: Look, x: number, y: number, right: boolean): void {
  const c = l.eyeColor;
  const closed = (): void => {
    // A happy closed eye: a little upside-down U, with lashes.
    g.strokeStyle = "#3a2440";
    g.lineWidth = 4;
    g.lineCap = "round";
    g.beginPath();
    g.arc(x, y + 4, 9, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  };
  if (l.eyes === "happy" || (l.eyes === "wink" && right)) return closed();
  if (l.eyes === "star") {
    g.fillStyle = c;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 5 : 12;
      g.lineTo(x + Math.cos(a) * r, y + 2 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    circle(g, x + 2, y - 1, 2.5, "#ffffff");
    return;
  }
  if (l.eyes === "heart") {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y + 12);
    g.bezierCurveTo(x - 16, y + 2, x - 8, y - 10, x, y - 2);
    g.bezierCurveTo(x + 8, y - 10, x + 16, y + 2, x, y + 12);
    g.fill();
    circle(g, x - 4, y - 1, 2.5, "#ffffff");
    return;
  }
  // Round eyes (and the open eye of a wink); sparkly ones are bigger with more shine.
  const big = l.eyes === "sparkly" ? 1.25 : 1;
  circle(g, x, y, 11 * big, "#ffffff");
  circle(g, x, y + 2, 8 * big, c);
  circle(g, x, y + 2, 4.5 * big, "#24222b");
  circle(g, x + 3 * big, y - 2, 3 * big, "#ffffff");
  if (l.eyes === "sparkly") {
    circle(g, x - 4, y + 5, 2, "#ffffff");
    if (l.kind === "girl") for (const dx of [-12, -6, 0]) limb(g, x + dx * 1.1, y - 12, x + dx * 1.4 - 2, y - 18, 2.5, "#3a2440");
  }
}

function drawTop(g: G, l: Look): void {
  if (l.dress !== "none" || l.top === "none") return;
  const c = l.topColor;
  if (l.top === "tshirt" || l.top === "puffy") shape(g, TORSO, c);
  if (l.top === "tshirt") {
    limb(g, 104, 206, 96, 248, 30, c);
    limb(g, 196, 206, 204, 248, 30, c);
  } else if (l.top === "puffy") {
    circle(g, 100, 214, 26, c);
    circle(g, 200, 214, 26, c);
    circle(g, 100, 214, 26, "rgba(255, 255, 255, 0.15)");
    circle(g, 200, 214, 26, "rgba(255, 255, 255, 0.15)");
  } else if (l.top === "sweater") {
    shape(g, [[100, 194], [200, 194], [194, 330], [106, 330]], c);
    limb(g, 104, 206, 80, 322, 28, c);
    limb(g, 196, 206, 220, 322, 28, c);
    g.strokeStyle = "rgba(255, 255, 255, 0.35)";
    g.lineWidth = 4;
    for (let y = 230; y < 330; y += 22) {
      g.beginPath();
      g.moveTo(108, y);
      g.lineTo(192, y);
      g.stroke();
    }
  } else {
    shape(g, [[112, 214], [188, 214], [190, 322], [110, 322]], c);
    limb(g, 118, 214, 120, 196, 7, c);
    limb(g, 182, 214, 180, 196, 7, c);
  }
  // A little scoop neck.
  g.fillStyle = l.skin;
  g.beginPath();
  g.ellipse(150, 196, 18, 10, 0, 0, Math.PI);
  g.fill();
}

function drawBottom(g: G, l: Look): void {
  if (l.dress !== "none" || l.bottom === "none") return;
  const c = l.bottomColor;
  if (l.bottom === "skirt") {
    shape(g, [[108, 312], [192, 312], [214, 408], [86, 408]], c);
    g.strokeStyle = darker(c);
    g.lineWidth = 3;
    for (const x of [120, 150, 180]) {
      g.beginPath();
      g.moveTo(x, 322);
      g.lineTo(x + (x - 150) * 0.4, 404);
      g.stroke();
    }
  } else if (l.bottom === "pants" || l.bottom === "shorts") {
    const end = l.bottom === "pants" ? 512 : 382;
    g.fillStyle = c;
    g.fillRect(108, 312, 84, 30);
    limb(g, 130, 330, 128, end, 36, c);
    limb(g, 170, 330, 172, end, 36, c);
  } else {
    // A puffy tutu: three layers of ruffles.
    for (let layer = 0; layer < 3; layer++) {
      g.fillStyle = layer % 2 ? darker(c, 0.9) : c;
      g.beginPath();
      g.moveTo(100, 312);
      for (let i = 0; i <= 10; i++) {
        const x = 64 + i * 17.2;
        g.quadraticCurveTo(x - 8, 382 - layer * 14, x, 372 - layer * 14);
      }
      g.lineTo(200, 312);
      g.fill();
    }
  }
}

function drawDress(g: G, l: Look): void {
  if (l.dress === "none") return;
  const c = l.dressColor;
  if (l.dress === "gown") {
    // A big princess gown, all the way to the floor.
    shape(g, TORSO.map(([x, y]) => [x, y]), c);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(110, 300);
    g.quadraticCurveTo(40, 430, 34, 518);
    g.lineTo(266, 518);
    g.quadraticCurveTo(260, 430, 190, 300);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(80 + i * 46, 510, 22, 10, 0, Math.PI, 0);
      g.fill();
    }
    circle(g, 100, 214, 22, c);
    circle(g, 200, 214, 22, c);
    circle(g, 150, 314, 10, "#ffe36e");
  } else if (l.dress === "sundress") {
    shape(g, [[112, 214], [188, 214], [230, 440], [70, 440]], c);
    limb(g, 120, 214, 120, 196, 7, c);
    limb(g, 180, 214, 180, 196, 7, c);
    for (let i = 0; i < 8; i++) circle(g, 100 + (i % 4) * 34, 300 + Math.floor(i / 4) * 70, 7, "rgba(255, 255, 255, 0.7)");
  } else {
    // A party dress with a flared, ruffly skirt and polka dots.
    shape(g, TORSO, c);
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(108, 300);
    for (let i = 0; i <= 8; i++) g.quadraticCurveTo(60 + i * 22.5 - 11, 420, 60 + i * 22.5, 405);
    g.lineTo(192, 300);
    g.fill();
    for (let i = 0; i < 10; i++) circle(g, 84 + (i % 5) * 33, 340 + Math.floor(i / 5) * 40, 5, "#ffffff");
    limb(g, 104, 206, 98, 236, 26, c);
    limb(g, 196, 206, 202, 236, 26, c);
  }
  g.fillStyle = l.skin;
  g.beginPath();
  g.ellipse(150, 196, 18, 10, 0, 0, Math.PI);
  g.fill();
}

function drawCoat(g: G, l: Look): void {
  const c = l.coatColor;
  if (l.coat === "raincoat") {
    // A long raincoat with big buttons, open a little at the front.
    shape(g, [[98, 192], [146, 192], [140, 400], [92, 400]], c);
    shape(g, [[154, 192], [202, 192], [208, 400], [160, 400]], c);
    limb(g, 104, 206, 80, 322, 30, c);
    limb(g, 196, 206, 220, 322, 30, c);
    for (const y of [240, 290, 340]) circle(g, 136, y, 6, darker(c, 0.6));
  } else if (l.coat === "puffer") {
    // A puffy coat made of big squishy stripes.
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i % 2 ? darker(c, 0.92) : c;
      g.beginPath();
      g.roundRect(94 - (i === 0 ? 2 : 0), 192 + i * 28, 112, 32, 16);
      g.fill();
    }
    limb(g, 104, 206, 80, 322, 34, c);
    limb(g, 196, 206, 220, 322, 34, c);
    for (const y of [240, 280]) {
      limb(g, 98, y, 88, y + 6, 3, darker(c, 0.85));
      limb(g, 202, y, 212, y + 6, 3, darker(c, 0.85));
    }
  }
}

function drawCape(g: G, l: Look): void {
  if (l.coat !== "cape") return;
  // A superhero cape, flowing out behind her.
  g.fillStyle = l.coatColor;
  g.beginPath();
  g.moveTo(104, 196);
  g.lineTo(196, 196);
  g.lineTo(250, 470);
  g.quadraticCurveTo(150, 500, 50, 470);
  g.closePath();
  g.fill();
}

function drawShoes(g: G, l: Look): void {
  if (l.shoes === "none") return;
  const c = l.shoesColor;
  for (const x of [124, 176]) {
    if (l.shoes === "sneakers") {
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(x, 530, 26, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ffffff";
      g.fillRect(x - 26, 538, 52, 6);
      limb(g, x - 8, 524, x + 6, 524, 3, darker(c, 0.6));
    } else if (l.shoes === "boots") {
      g.fillStyle = c;
      g.fillRect(x - 18, 470, 36, 62);
      g.beginPath();
      g.ellipse(x, 532, 26, 13, 0, 0, Math.PI * 2);
      g.fill();
    } else if (l.shoes === "sandals") {
      g.fillStyle = darker(c, 0.85);
      g.fillRect(x - 24, 538, 48, 6);
      limb(g, x - 14, 530, x + 14, 530, 5, c);
      limb(g, x, 520, x, 534, 5, c);
    } else {
      // Sparkly heels.
      shape(g, [[x - 22, 536], [x + 22, 530], [x + 22, 540], [x - 22, 542]], c);
      limb(g, x - 18, 540, x - 18, 554, 5, c);
      circle(g, x + 4, 530, 4, "#ffffff");
    }
  }
}

function drawExtrasBehind(g: G, l: Look): void {
  if (!l.extras.includes("wings")) return;
  // Fairy wings, see-through.
  g.fillStyle = "rgba(191, 230, 255, 0.7)";
  g.strokeStyle = l.extraColor;
  g.lineWidth = 3;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(150 + side * 70, 220, 60, 34, side * -0.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(150 + side * 58, 290, 40, 24, side * 0.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

function drawExtras(g: G, l: Look): void {
  const has = (e: Extra): boolean => l.extras.includes(e);
  if (has("necklace")) {
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
      circle(g, 150 + Math.cos(a) * 26, 194 + Math.sin(a) * 18, 4.5, i === 4 ? l.extraColor : "#ffffff");
    }
  }
  if (has("glasses")) {
    for (const x of [128, 172]) {
      circle(g, x, 125, 15, "rgba(36, 34, 43, 0.85)");
      circle(g, x - 5, 120, 4, "rgba(255, 255, 255, 0.6)");
    }
    limb(g, 143, 124, 157, 124, 4, "#24222b");
  }
  if (has("ears")) {
    for (const side of [-1, 1]) {
      shape(g, [[150 + side * 26, 72], [150 + side * 52, 34], [150 + side * 58, 82]], l.hairColor);
      shape(g, [[150 + side * 34, 72], [150 + side * 50, 46], [150 + side * 52, 76]], "#ffb8d0");
    }
  }
  if (has("crown")) {
    shape(g, [[112, 74], [112, 40], [128, 58], [150, 30], [172, 58], [188, 40], [188, 74]], "#f2c230");
    circle(g, 150, 60, 6, "#e8383d");
    circle(g, 126, 66, 4, "#4a9bff");
    circle(g, 174, 66, 4, "#4cc76a");
  }
  if (has("tiara")) {
    g.strokeStyle = "#c9ced6";
    g.lineWidth = 5;
    g.beginPath();
    g.arc(150, 120, 60, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
    shape(g, [[140, 66], [150, 48], [160, 66]], "#c9ced6");
    circle(g, 150, 62, 5, l.extraColor);
  }
  if (has("bow")) {
    const c = l.extraColor;
    shape(g, [[196, 78], [172, 62], [174, 94]], c);
    shape(g, [[196, 78], [220, 62], [218, 94]], c);
    circle(g, 196, 78, 8, darker(c));
  }
  if (has("wand")) {
    limb(g, 228, 334, 256, 270, 5, "#f4f1ee");
    const sx = 258;
    const sy = 262;
    g.fillStyle = "#ffe36e";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 7 : 17;
      g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  }
}

/** The doll, wearing everything in `l`, in doll space. */
export function drawDoll(g: G, l: Look): void {
  // Your own designs take the place of whatever they cover.
  const own = (l.mine ?? []).map((id) => designs.find((d) => d.id === id)).filter((d): d is Design => !!d);
  const has = (k: DesignKind): boolean => own.some((d) => d.kind === k);
  const ownOf = (k: DesignKind): Design[] => own.filter((d) => d.kind === k);
  const worn: Look = {
    ...l,
    top: has("shirt") || has("dress") ? "none" : l.top,
    bottom: has("skirt") || has("dress") ? "none" : l.bottom,
    dress: has("dress") || has("shirt") || has("skirt") ? "none" : l.dress,
    coat: has("coat") ? "none" : l.coat,
  };
  // Your own extras go behind her (like wings) or in front, whichever you picked.
  for (const d of ownOf("extra")) if (!d.front) drawDesign(g, d);
  drawExtrasBehind(g, worn);
  drawCape(g, worn);
  const wig = ownOf("wig")[0];
  if (wig) drawDesign(g, wig, "back");
  else drawHairBack(g, worn);
  drawBody(g, worn);
  drawFace(g, worn);
  drawBottom(g, worn);
  drawTop(g, worn);
  drawDress(g, worn);
  // The skirt first, so the shirt can go over the top of it.
  for (const k of ["skirt", "shirt", "dress"] as const) for (const d of ownOf(k)) drawDesign(g, d);
  drawCoat(g, worn);
  for (const d of ownOf("coat")) drawDesign(g, d);
  drawShoes(g, worn);
  if (wig) drawDesign(g, wig, "front");
  else drawHairFront(g, worn);
  drawExtras(g, worn);
  for (const d of ownOf("extra")) if (d.front) drawDesign(g, d);
}

// ---- Your own designs ----
// Made in the Design Studio (studio.ts): a kind of clothes, a main colour,
// and a sketch drawn on top (kept as a picture), clipped to the clothes' shape.

export type DesignKind = "shirt" | "dress" | "skirt" | "coat" | "wig" | "extra";

export interface Design {
  id: string;
  kind: DesignKind;
  base: string;
  sketch: string; // a PNG picture of the drawing, in doll space
  onDisplay: boolean;
  sold: number;
  name?: string; // what you called it (designs made before names existed don't have one)
  price?: number; // what it sells for in your shop (30 coins if you haven't picked)
  mask?: string; // a picture of the bits you snipped off with the scissors, if you did
  front?: boolean; // extras only: worn in front of her (otherwise behind, like wings)
  stolenFrom?: string; // the shop you sneaked it out of without paying (they'll come and get it back!)
}

/**
 * Puts one of your designs on (or takes it off, if it's already on). Anything
 * it can't be worn with comes off: another of the same kind, and a dress
 * can't go with a shirt or skirt (it covers both).
 */
export function toggleDesign(l: Look, d: Design): void {
  if (l.mine.includes(d.id)) {
    l.mine = l.mine.filter((id) => id !== d.id);
    return;
  }
  const clashes = (other: Design): boolean =>
    other.kind === d.kind ||
    (d.kind === "dress" && (other.kind === "shirt" || other.kind === "skirt")) ||
    (other.kind === "dress" && (d.kind === "shirt" || d.kind === "skirt"));
  l.mine = [...l.mine.filter((id) => {
    const other = designs.find((x) => x.id === id);
    return other && !clashes(other);
  }), d.id];
}

/** Takes off your own designs of these kinds (when you pick ordinary clothes instead). */
export function takeOffDesigns(l: Look, kinds: DesignKind[]): void {
  l.mine = l.mine.filter((id) => {
    const d = designs.find((x) => x.id === id);
    return d && !kinds.includes(d.kind);
  });
}

const KIND_NAMES: Record<DesignKind, string> = { shirt: "shirt", dress: "dress", skirt: "skirt", coat: "coat", wig: "wig", extra: "extra" };

/** What a design is called: its own name, or "My dress 2" if you haven't named it. */
export function designName(d: Design): string {
  if (d.name?.trim()) return d.name.trim();
  const same = designs.filter((x) => x.kind === d.kind);
  return `My ${KIND_NAMES[d.kind]} ${same.indexOf(d) + 1}`;
}

const DESIGNS_KEY = "dress-up-designs";
const pictures = new Map<string, HTMLImageElement>();

export const designs: Design[] = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(DESIGNS_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
})();

export function saveDesigns(): void {
  try {
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(designs));
  } catch {
    // Storage is full: the newest design just won't be kept.
  }
}

/** A wig comes in two pieces: the back (behind her head) and the bangs (in front). */
export function wigShape(part: "back" | "front"): Path2D {
  const p = new Path2D();
  if (part === "back") {
    p.ellipse(150, 112, 74, 72, 0, 0, Math.PI * 2);
    p.roundRect(78, 112, 144, 196, [0, 0, 50, 50]);
  } else {
    p.moveTo(88, 116);
    p.arc(150, 118, 62, Math.PI * 1.02, Math.PI * 1.98);
    p.quadraticCurveTo(178, 92, 150, 98);
    p.quadraticCurveTo(118, 90, 88, 116);
    p.closePath();
  }
  return p;
}

/** The outline of each kind of clothes you can design, in doll space. */
export function designShape(kind: DesignKind): Path2D {
  if (kind === "extra") {
    // A big sheet of fabric to cut into any shape you like.
    const p = new Path2D();
    p.roundRect(16, 20, 268, 560, 30);
    return p;
  }
  if (kind === "wig") {
    const p = new Path2D();
    p.addPath(wigShape("back"));
    p.addPath(wigShape("front"));
    return p;
  }
  const p = new Path2D();
  const poly = (pts: [number, number][]): void => {
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
  };
  if (kind === "shirt") {
    poly([[102, 194], [198, 194], [190, 324], [110, 324]]);
    poly([[90, 194], [120, 196], [112, 254], [80, 246]]);
    poly([[210, 194], [180, 196], [188, 254], [220, 246]]);
  } else if (kind === "dress") {
    poly([[102, 194], [198, 194], [192, 300], [238, 452], [62, 452], [108, 300]]);
  } else if (kind === "skirt") {
    poly([[108, 310], [192, 310], [216, 410], [84, 410]]);
  } else {
    poly([[96, 190], [204, 190], [212, 408], [88, 408]]);
    poly([[96, 194], [120, 206], [94, 334], [66, 324]]);
    poly([[204, 194], [180, 206], [206, 334], [234, 324]]);
  }
  return p;
}

const listeners: (() => void)[] = [];
/** Calls `fn` whenever a design's picture finishes loading (so little pictures can be redrawn). */
export const onPicturesLoaded = (fn: () => void): number => listeners.push(fn);

function picture(src: string): HTMLImageElement {
  let pic = pictures.get(src);
  if (!pic) {
    pic = new Image();
    pic.onload = () => listeners.forEach((fn) => fn());
    pic.src = src;
    pictures.set(src, pic);
  }
  return pic;
}

/**
 * A design with snipped bits, put together once: the main colour, the
 * drawing on top, and the snipped-off parts cut away.
 */
const cutouts = new Map<string, HTMLCanvasElement>();
function cutout(d: Design, shapePath: Path2D, key: string): HTMLCanvasElement | null {
  const done = cutouts.get(key);
  if (done) return done;
  const sketch = picture(d.sketch);
  const mask = d.mask ? picture(d.mask) : null;
  if (!sketch.complete || (mask && !mask.complete)) return null;
  const c = document.createElement("canvas");
  c.width = 300;
  c.height = 600;
  const g = c.getContext("2d")!;
  g.fillStyle = d.base;
  g.fill(shapePath);
  g.save();
  g.clip(shapePath);
  g.drawImage(sketch, 0, 0);
  g.restore();
  if (mask) {
    g.globalCompositeOperation = "destination-out";
    g.drawImage(mask, 0, 0);
  }
  cutouts.set(key, c);
  return c;
}

/** One of your designs, on the doll (or a mannequin). Wigs are drawn one piece (`part`) at a time. */
export function drawDesign(g: G, d: Design, part?: "back" | "front"): void {
  if (d.kind === "wig" && !part) {
    drawDesign(g, d, "back");
    drawDesign(g, d, "front");
    return;
  }
  const shapePath = d.kind === "wig" ? wigShape(part!) : designShape(d.kind);
  if (d.mask || d.kind === "extra") {
    // Snipped designs (and extras, which are all about the cutting) have no outline.
    const c = cutout(d, shapePath, `${d.id}:${part ?? ""}`);
    if (c) g.drawImage(c, 0, 0);
    return;
  }
  g.save();
  g.fillStyle = d.base;
  g.fill(shapePath);
  g.clip(shapePath);
  const pic = picture(d.sketch);
  if (pic.complete) g.drawImage(pic, 0, 0);
  g.restore();
  g.strokeStyle = darker(d.base.startsWith("#") ? d.base : "#ffffff", 0.7);
  g.lineWidth = 2;
  g.stroke(shapePath);
}

export function drawPlace(g: G, place: Place, w: number, h: number): void {
  const floor = h * 0.72;
  const sky = (top: string, bottom: string): void => {
    const grad = g.createLinearGradient(0, 0, 0, floor);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, floor);
  };
  if (place === "bedroom") {
    g.fillStyle = "#ffe4f2";
    g.fillRect(0, 0, w, floor);
    g.fillStyle = "rgba(255, 143, 199, 0.25)";
    for (let x = 0; x < w; x += 40) g.fillRect(x, 0, 18, floor);
    g.fillStyle = "#ffffff";
    g.fillRect(w * 0.08, h * 0.12, w * 0.22, h * 0.22);
    g.fillStyle = "#bfe6ff";
    g.fillRect(w * 0.095, h * 0.135, w * 0.19, h * 0.19);
    g.fillStyle = "#c9965f";
    g.fillRect(0, floor, w, h - floor);
  } else if (place === "garden") {
    sky("#8fd0ff", "#e8f6ff");
    g.fillStyle = "#6fc45a";
    g.fillRect(0, floor, w, h - floor);
    for (let i = 0; i < 12; i++) {
      const x = (i * 97) % w;
      const y = floor + 20 + ((i * 53) % (h - floor - 30));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        circle(g, x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, ["#ff8fc7", "#ffe36e", "#ffffff"][i % 3]!);
      }
      circle(g, x, y, 5, "#ff9226");
    }
    circle(g, w * 0.85, h * 0.12, 30, "#fff4a8");
  } else if (place === "beach") {
    sky("#7fd0f0", "#e8f6ff");
    g.fillStyle = "#4ab8e8";
    g.fillRect(0, floor - h * 0.1, w, h * 0.1);
    g.fillStyle = "#f4dca0";
    g.fillRect(0, floor, w, h - floor);
    circle(g, w * 0.82, h * 0.14, 34, "#ffd23f");
  } else if (place === "castle") {
    sky("#a35cff", "#ffb0e8");
    g.fillStyle = "#e8d8ff";
    g.fillRect(w * 0.05, h * 0.25, w * 0.3, floor - h * 0.25);
    g.fillRect(w * 0.65, h * 0.25, w * 0.3, floor - h * 0.25);
    for (const x of [0.05, 0.25, 0.65, 0.85]) shape(g, [[w * x, h * 0.25], [w * (x + 0.05), h * 0.14], [w * (x + 0.1), h * 0.25]], "#ff6fb5");
    g.fillStyle = "#c9b8e8";
    g.fillRect(0, floor, w, h - floor);
  } else {
    g.fillStyle = "#1a0a33";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) circle(g, (i * 173) % w, (i * 97) % h, 1.5, "#ffffff");
    circle(g, w * 0.82, h * 0.18, 40, "#ff9fcf");
    g.strokeStyle = "#ffe36e";
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(w * 0.82, h * 0.18, 64, 16, -0.3, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "#5d4a8e";
    g.fillRect(0, floor, w, h - floor);
  }
}

