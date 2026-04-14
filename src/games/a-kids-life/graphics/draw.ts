import { SIMPLE_FONT } from "../constants";
import type { FamilySave, HomeStyle, LifeStage, Mood, NeedKind, PersonState } from "../model/types";
import { getNeedIcon } from "../systems/visualHints";
import { roundRect } from "../ui/Button";

const STAGE_COLORS: Record<LifeStage, { sky: string; wall: string; floor: string; accent: string }> = {
  baby: { sky: "#fff4d7", wall: "#ffe2ec", floor: "#f8d4bf", accent: "#fca6c3" },
  toddler: { sky: "#fff1cb", wall: "#ffedcf", floor: "#f8dba8", accent: "#ffa57d" },
  kid: { sky: "#dff4ff", wall: "#e9f0ff", floor: "#d9c2ff", accent: "#7bb7ff" },
  teen: { sky: "#ffe6d8", wall: "#e8ddff", floor: "#cdb4db", accent: "#8b7dff" },
  grownup: { sky: "#ffe2c6", wall: "#fff0dd", floor: "#dbbb9f", accent: "#f7a162" },
  parent: { sky: "#ffe0c4", wall: "#fff0e7", floor: "#cba88e", accent: "#f28b74" },
  grandparent: { sky: "#ffefbf", wall: "#f4f6da", floor: "#d4bd95", accent: "#8eba74" },
};

const HOME_ACCENTS: Record<HomeStyle, string> = {
  sunny: "#f7bd7b",
  peach: "#f49fb0",
  mint: "#8fd6c4",
};

function setFont(ctx: CanvasRenderingContext2D, size: number, weight = 700): void {
  ctx.font = `${weight} ${size}px ${SIMPLE_FONT}`;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  stage: LifeStage,
  homeStyle: HomeStyle,
  time: number
): void {
  const palette = STAGE_COLORS[stage];
  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, 1200, 760);

  ctx.fillStyle = palette.wall;
  ctx.fillRect(50, 80, 1100, 470);
  ctx.fillStyle = palette.floor;
  ctx.fillRect(50, 550, 1100, 160);

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(160, 135, 60, 0, Math.PI * 2);
  ctx.arc(210, 128, 48, 0, Math.PI * 2);
  ctx.arc(120, 128, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HOME_ACCENTS[homeStyle];
  roundRect(ctx, 870, 140, 190, 120, 26);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.44)";
  roundRect(ctx, 888, 158, 154, 84, 20);
  ctx.fill();

  const sway = Math.sin(time * 1.4) * 4;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(965, 140);
  ctx.lineTo(965, 100);
  ctx.stroke();

  for (let index = 0; index < 3; index += 1) {
    const x = 928 + index * 34;
    ctx.beginPath();
    ctx.moveTo(x, 104);
    ctx.lineTo(x + sway * (index - 1), 132);
    ctx.stroke();
    ctx.fillStyle = "#fff7da";
    ctx.beginPath();
    ctx.arc(x + sway * (index - 1), 136, 14 + index * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRoomProps(ctx, stage, palette.accent);
}

function drawRoomProps(ctx: CanvasRenderingContext2D, stage: LifeStage, accent: string): void {
  if (stage === "baby" || stage === "toddler") {
    ctx.fillStyle = accent;
    roundRect(ctx, 160, 505, 180, 90, 20);
    ctx.fill();
    ctx.fillStyle = "#fff7da";
    ctx.beginPath();
    ctx.arc(205, 540, 22, 0, Math.PI * 2);
    ctx.arc(290, 540, 22, 0, Math.PI * 2);
    ctx.fill();
  } else if (stage === "kid" || stage === "teen") {
    ctx.fillStyle = accent;
    roundRect(ctx, 150, 480, 220, 110, 24);
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    roundRect(ctx, 176, 420, 160, 64, 18);
    ctx.fill();
  } else {
    ctx.fillStyle = accent;
    roundRect(ctx, 150, 470, 240, 120, 26);
    ctx.fill();
    ctx.fillStyle = "#fff7dd";
    roundRect(ctx, 196, 430, 144, 48, 16);
    ctx.fill();
  }
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  person: PersonState,
  opts: {
    x: number;
    y: number;
    size: number;
    mood?: Mood;
    bubble?: string;
    highlight?: boolean;
    time?: number;
  }
): void {
  const mood = opts.mood ?? person.mood;
  const bob = Math.sin((opts.time ?? 0) * 2.4 + person.birthOrder) * 4;
  const x = opts.x;
  const y = opts.y + bob;
  const skin = "#f5d0b6";
  const hair = person.gender === "girl" ? "#6d4f72" : "#77543e";
  const cloth = person.gender === "girl" ? "#ff96bc" : "#7eb3ff";
  const bodyHeight = stageBodyHeight(person.lifeStage, opts.size);
  const headSize = stageHeadSize(person.lifeStage, opts.size);

  if (opts.highlight) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.beginPath();
    ctx.arc(x, y - 20, opts.size * 0.78, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y - bodyHeight * 0.9, headSize, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, y - bodyHeight * 0.98, headSize + 5, Math.PI, Math.PI * 2);
  ctx.fill();
  if (person.gender === "girl") {
    ctx.beginPath();
    ctx.arc(x - headSize + 8, y - bodyHeight * 0.88, 10, 0, Math.PI * 2);
    ctx.arc(x + headSize - 8, y - bodyHeight * 0.88, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = cloth;
  roundRect(ctx, x - opts.size * 0.22, y - bodyHeight * 0.45, opts.size * 0.44, bodyHeight * 0.5, 18);
  ctx.fill();

  ctx.strokeStyle = "#5b4c4c";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - opts.size * 0.18, y);
  ctx.lineTo(x - opts.size * 0.18, y + bodyHeight * 0.35);
  ctx.moveTo(x + opts.size * 0.18, y);
  ctx.lineTo(x + opts.size * 0.18, y + bodyHeight * 0.35);
  ctx.moveTo(x - opts.size * 0.22, y - bodyHeight * 0.26);
  ctx.lineTo(x - opts.size * 0.42, y - bodyHeight * 0.04);
  ctx.moveTo(x + opts.size * 0.22, y - bodyHeight * 0.26);
  ctx.lineTo(x + opts.size * 0.42, y - bodyHeight * 0.04);
  ctx.stroke();

  drawFace(ctx, x, y - bodyHeight * 0.92, mood, headSize);

  if (opts.bubble) {
    drawBubble(ctx, x + opts.size * 0.62, y - bodyHeight * 1.3, opts.bubble);
  }
}

function stageHeadSize(stage: LifeStage, size: number): number {
  switch (stage) {
    case "baby":
      return size * 0.3;
    case "toddler":
      return size * 0.28;
    case "kid":
      return size * 0.24;
    case "teen":
      return size * 0.22;
    case "grownup":
    case "parent":
    case "grandparent":
      return size * 0.2;
  }
}

function stageBodyHeight(stage: LifeStage, size: number): number {
  switch (stage) {
    case "baby":
      return size * 0.72;
    case "toddler":
      return size * 0.82;
    case "kid":
      return size * 1;
    case "teen":
      return size * 1.14;
    case "grownup":
    case "parent":
      return size * 1.18;
    case "grandparent":
      return size * 1.1;
  }
}

function drawFace(ctx: CanvasRenderingContext2D, x: number, y: number, mood: Mood, headSize: number): void {
  ctx.fillStyle = "#43313e";
  ctx.beginPath();
  ctx.arc(x - headSize * 0.34, y - 4, 4, 0, Math.PI * 2);
  ctx.arc(x + headSize * 0.34, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#43313e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (mood === "yay") {
    ctx.arc(x, y + 5, headSize * 0.26, 0.1 * Math.PI, 0.9 * Math.PI);
  } else if (mood === "okay") {
    ctx.moveTo(x - headSize * 0.22, y + 12);
    ctx.lineTo(x + headSize * 0.22, y + 12);
  } else {
    ctx.arc(x, y + 18, headSize * 0.22, 1.15 * Math.PI, 1.85 * Math.PI, true);
  }
  ctx.stroke();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "#b68b9f";
  ctx.lineWidth = 3;
  roundRect(ctx, x - 28, y - 24, 56, 44, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7e5a73";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFont(ctx, 24, 700);
  ctx.fillText(text, x, y - 1);
}

export function drawNeedBar(
  ctx: CanvasRenderingContext2D,
  need: NeedKind,
  value: number,
  x: number,
  y: number,
  width: number
): void {
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.strokeStyle = "#9d7f84";
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, width, 34, 17);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  roundRect(ctx, x + 4, y + 4, (width - 8) * (value / 100), 26, 13);
  ctx.fill();

  ctx.fillStyle = "#6f5a67";
  setFont(ctx, 18, 800);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${getNeedIcon(need)} ${need.toUpperCase().slice(0, 1)}`, x + 10, y + 18);
}

export function drawProgressRing(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
  ctx.strokeStyle = "rgba(123, 92, 111, 0.18)";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(x, y, 48, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#f096ad";
  ctx.beginPath();
  ctx.arc(x, y, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.04, progress));
  ctx.stroke();

  ctx.fillStyle = "#7d586c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setFont(ctx, 16, 800);
  ctx.fillText("GROW", x, y);
}

export function drawTopHud(ctx: CanvasRenderingContext2D, save: FamilySave, person: PersonState): void {
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.strokeStyle = "rgba(128,94,110,0.25)";
  ctx.lineWidth = 3;
  roundRect(ctx, 30, 20, 1140, 88, 28);
  ctx.fill();
  ctx.stroke();

  drawPortraitChip(ctx, person, 82, 64, 60, true);

  ctx.fillStyle = "#644c61";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setFont(ctx, 28, 800);
  ctx.fillText(person.name, 128, 60);
  setFont(ctx, 18, 700);
  ctx.globalAlpha = 0.78;
  ctx.fillText(person.lifeStage.toUpperCase(), 128, 86);
  ctx.globalAlpha = 1;

  drawProgressRing(ctx, 350, 64, Math.min(1, person.ageProgress / 10));

  ctx.textAlign = "right";
  setFont(ctx, 24, 800);
  ctx.fillText(`💗 ${save.hearts}`, 1128, 60);
  setFont(ctx, 16, 700);
  ctx.globalAlpha = 0.78;
  ctx.fillText(save.title, 1128, 85);
  ctx.globalAlpha = 1;
}

export function drawPortraitChip(
  ctx: CanvasRenderingContext2D,
  person: PersonState,
  x: number,
  y: number,
  size: number,
  active = false
): void {
  ctx.fillStyle = active ? "#fff6e8" : "rgba(255,255,255,0.62)";
  ctx.strokeStyle = active ? "#f096ad" : "#a8919d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawCharacter(ctx, person, { x, y: y + size / 3, size: size * 0.7, mood: person.mood });
}
