// Bio Tech — a fanmade game for Bionic.
// Full-screen canvas game. Opening cutscene.
export {};

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let W = window.innerWidth;
let H = window.innerHeight;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = new Set<string>();
let advancePressed = false;

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    advancePressed = true;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("pointerdown", () => {
  advancePressed = true;
});

// ---------------------------------------------------------------------------
// Pixel character drawing (Minecraft-ish blocky figures)
// ---------------------------------------------------------------------------
interface Palette {
  hair: string;
  skin: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  shoes: string;
  band?: string; // optional headband
}

const HERO: Palette = {
  hair: "#5a3a1a",
  skin: "#e3b083",
  shirt: "#f3f1e7",
  shirtDark: "#cfccbe",
  pants: "#2f78c4",
  shoes: "#8a8f96",
  band: "#c0392b",
};

const SCIENTIST: Palette = {
  hair: "#5b3a1f",
  skin: "#b98a5e",
  shirt: "#1f9e95",
  shirtDark: "#157d76",
  pants: "#27306b",
  shoes: "#3a3f4a",
};

// Draw a blocky humanoid. (x, yFeet) is the bottom-center. u = pixel unit.
function drawCharacter(x: number, yFeet: number, u: number, pal: Palette, faceRight: boolean): void {
  const px = (gx: number, gy: number, gw: number, gh: number, color: string) => {
    ctx.fillStyle = color;
    // grid origin: character is 16u wide, 32u tall. center horizontally on x.
    const ox = x - 8 * u;
    const oy = yFeet - 32 * u;
    ctx.fillRect(ox + gx * u, oy + gy * u, gw * u, gh * u);
  };

  // Legs (y 20..32)
  px(4, 20, 4, 12, pal.pants);
  px(8, 20, 4, 12, pal.pants);
  px(4, 30, 4, 2, pal.shoes);
  px(8, 30, 4, 2, pal.shoes);

  // Arms (y 8..20)
  px(0, 8, 4, 12, pal.shirtDark);
  px(12, 8, 4, 12, pal.shirtDark);
  // hands
  px(0, 18, 4, 2, pal.skin);
  px(12, 18, 4, 2, pal.skin);

  // Body (y 8..20)
  px(4, 8, 8, 12, pal.shirt);
  // collar
  px(4, 8, 8, 1, pal.shirtDark);

  // Head (y 0..8)
  px(4, 0, 8, 8, pal.skin);
  // hair cap
  px(4, 0, 8, 2, pal.hair);
  px(4, 0, 1, 4, pal.hair);
  px(11, 0, 1, 4, pal.hair);
  if (pal.band) {
    px(4, 2, 8, 1, pal.band);
  }

  // Face / eyes
  const eyeY = 4;
  const eL = faceRight ? 6 : 5;
  const eR = faceRight ? 9 : 8;
  px(eL, eyeY, 1, 1, "#ffffff");
  px(eR, eyeY, 1, 1, "#ffffff");
  px(eL, eyeY, 1, 1, "#3a2a7a"); // pupil overlay (same cell, darker top-left feel)
  ctx.fillStyle = "#3a2a7a";
  ctx.fillRect(x - 8 * u + (eL + 0.4) * u, yFeet - 32 * u + (eyeY + 0.2) * u, 0.5 * u, 0.6 * u);
  ctx.fillRect(x - 8 * u + (eR + 0.4) * u, yFeet - 32 * u + (eyeY + 0.2) * u, 0.5 * u, 0.6 * u);
  // mouth / nose
  px(7, 6, 2, 1, "#a06a44");
}

// ---------------------------------------------------------------------------
// Scene state machine
// ---------------------------------------------------------------------------
type Scene = "dialogue" | "fadeOut" | "meteor" | "objective" | "overworld";
let scene: Scene = "dialogue";

// Global fade overlay (1 = fully black)
let fade = 0;

// --- Dialogue ---
const dialogueLines = [
  "Oh, hey! You made it. Welcome to BioTech Industries.",
  "We've been working on something incredible in here.",
  "Something nobody in the world has ever seen before.",
  "Soon everyone is going to know our name. Just wait until you—",
  "...wait. What the—",
];
let dialogueIndex = 0;
let charsShown = 0; // typewriter effect
const CHARS_PER_SEC = 38;
const currentLine = (): string => dialogueLines[dialogueIndex] ?? "";

// --- Meteor ---
let meteorT = 0; // 0..1 incoming
let meteorPhase: "incoming" | "impact" | "after" = "incoming";
let impactTimer = 0;
let shake = 0;
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}
const particles: Particle[] = [];

// --- Overworld ---
let heroX = 0;
let heroVY = 0;
let camX = 0;
const GROUND_FRAC = 0.78;
const BUILDING_WORLD_X = 1600;
let reachedBuilding = false;

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(dt: number): void {
  switch (scene) {
    case "dialogue":
      charsShown += CHARS_PER_SEC * dt;
      if (advancePressed) {
        const full = currentLine().length;
        if (charsShown < full) {
          charsShown = full; // reveal full line instantly
        } else if (dialogueIndex < dialogueLines.length - 1) {
          dialogueIndex++;
          charsShown = 0;
        } else {
          scene = "fadeOut";
        }
      }
      break;

    case "fadeOut":
      fade = Math.min(1, fade + dt * 0.9);
      if (fade >= 1) {
        scene = "meteor";
        meteorPhase = "incoming";
        meteorT = 0;
      }
      break;

    case "meteor":
      // fade back in
      fade = Math.max(0, fade - dt * 1.2);
      if (meteorPhase === "incoming") {
        meteorT += dt / 2.6;
        spawnMeteorTrail();
        if (meteorT >= 1) {
          meteorT = 1;
          meteorPhase = "impact";
          impactTimer = 0;
          shake = 22;
          spawnExplosion();
        }
      } else if (meteorPhase === "impact") {
        impactTimer += dt;
        if (impactTimer > 1.4) {
          meteorPhase = "after";
          impactTimer = 0;
        }
      } else {
        impactTimer += dt;
        spawnSmoke();
        if (impactTimer > 1.6 && advancePressed) {
          scene = "objective";
        }
      }
      shake = Math.max(0, shake - dt * 40);
      updateParticles(dt);
      break;

    case "objective":
      if (advancePressed) {
        scene = "overworld";
        heroX = 80;
        camX = 0;
        particles.length = 0; // clear leftover explosion debris
      }
      break;

    case "overworld": {
      const speed = 240;
      if (keys.has("arrowright") || keys.has("d")) heroX += speed * dt;
      if (keys.has("arrowleft") || keys.has("a")) heroX -= speed * dt;
      heroX = Math.max(40, heroX);
      // camera follows
      camX = Math.max(0, heroX - W * 0.35);
      updateParticles(dt);
      const groundY = H * GROUND_FRAC;
      spawnSmokeAt(BUILDING_WORLD_X, groundY - H * 0.32); // smoke from the strange building's roof
      if (!reachedBuilding && heroX >= BUILDING_WORLD_X - 120) {
        reachedBuilding = true;
      }
      break;
    }
  }
  advancePressed = false;
}

function spawnMeteorTrail(): void {
  const { mx, my } = meteorPos();
  for (let i = 0; i < 2; i++) {
    particles.push({
      x: mx + (Math.sin(meteorT * 50 + i) * 6),
      y: my + (Math.cos(meteorT * 50 + i) * 6),
      vx: -40 + Math.sin(i) * 20,
      vy: -30,
      life: 0,
      max: 0.6,
      size: 6 + (i % 3) * 3,
      color: i % 2 === 0 ? "#ff8a1f" : "#ffd23a",
    });
  }
}

function spawnExplosion(): void {
  const { ix, iy } = impactPos();
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 320;
    particles.push({
      x: ix,
      y: iy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 120,
      life: 0,
      max: 0.8 + Math.random() * 0.9,
      size: 4 + Math.random() * 10,
      color: ["#ff3b2f", "#ff8a1f", "#ffd23a", "#fff08a"][Math.floor(Math.random() * 4)]!,
    });
  }
}

function spawnSmokeAt(cx: number, cy: number): void {
  if (particles.length > 240) return;
  particles.push({
    x: cx + (Math.random() - 0.5) * 60,
    y: cy,
    vx: (Math.random() - 0.5) * 20,
    vy: -30 - Math.random() * 30,
    life: 0,
    max: 1.6 + Math.random() * 1.2,
    size: 14 + Math.random() * 18,
    color: "rgba(60,60,70,0.6)",
  });
}

function spawnSmoke(): void {
  const { ix, iy } = impactPos();
  spawnSmokeAt(ix, iy);
}

function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (!p) continue;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 220 * dt; // gravity-ish
    if (p.life >= p.max) particles.splice(i, 1);
  }
}

// Where the meteor is during incoming (screen coords).
function meteorPos(): { mx: number; my: number } {
  const { ix, iy } = impactPos();
  const startX = ix + W * 0.6;
  const startY = -H * 0.2;
  return { mx: startX + (ix - startX) * meteorT, my: startY + (iy - startY) * meteorT };
}

function impactPos(): { ix: number; iy: number } {
  // top of the building
  const groundY = H * GROUND_FRAC;
  return { ix: W * 0.5, iy: groundY - H * 0.18 };
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------
function draw(): void {
  ctx.clearRect(0, 0, W, H);

  if (scene === "dialogue") {
    drawDialogueScene();
  } else if (scene === "fadeOut") {
    drawDialogueScene();
  } else if (scene === "meteor" || scene === "objective") {
    drawMeteorScene();
    if (scene === "objective") drawObjectiveOverlay();
  } else if (scene === "overworld") {
    drawOverworld();
  }

  // global fade
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawDialogueScene(): void {
  // lab room background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a2230");
  g.addColorStop(1, "#0c1018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // floor
  const groundY = H * 0.74;
  ctx.fillStyle = "#11161f";
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.strokeStyle = "rgba(120,200,255,0.08)";
  ctx.lineWidth = 2;
  for (let gx = 0; gx < W; gx += 64) {
    ctx.beginPath();
    ctx.moveTo(gx, groundY);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }

  // characters facing each other
  const u = Math.max(4, Math.min(W, H) / 90);
  drawCharacter(W * 0.32, groundY + 6, u, HERO, true);
  drawCharacter(W * 0.68, groundY + 6, u, SCIENTIST, false);

  drawDialogueBox("Scientist", currentLine().slice(0, Math.floor(charsShown)));
}

function drawDialogueBox(name: string, text: string): void {
  const boxH = Math.min(180, H * 0.28);
  const pad = 22;
  const y = H - boxH - 24;
  const x = 24;
  const w = W - 48;

  ctx.fillStyle = "rgba(5,10,16,0.92)";
  ctx.strokeStyle = "#9effa0";
  ctx.lineWidth = 3;
  roundRect(x, y, w, boxH, 12);
  ctx.fill();
  ctx.stroke();

  // name tag
  ctx.fillStyle = "#9effa0";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(name, x + pad, y + pad - 4);

  // text
  ctx.fillStyle = "#e8f0e8";
  ctx.font = "22px system-ui, sans-serif";
  wrapText(text, x + pad, y + pad + 28, w - pad * 2, 30);

  // prompt
  ctx.fillStyle = "rgba(158,255,160,0.7)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("▶ space / click", x + w - pad, y + boxH - pad - 2);
  ctx.textAlign = "left";
}

function drawMeteorScene(): void {
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // dusk sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#14101e");
  g.addColorStop(0.6, "#3a1d2a");
  g.addColorStop(1, "#5a2a22");
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, W + 80, H + 80);

  // stars
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 60; i++) {
    const sx = (i * 97.13) % W;
    const sy = (i * 53.7) % (H * 0.5);
    ctx.fillRect(sx, sy, 2, 2);
  }

  const groundY = H * GROUND_FRAC;
  // ground
  ctx.fillStyle = "#1c2a1c";
  ctx.fillRect(-40, groundY, W + 80, H - groundY + 40);

  // building: BioTech Industries
  drawBuilding(W * 0.5, groundY, false);

  // meteor incoming
  if (meteorPhase === "incoming") {
    const { mx, my } = meteorPos();
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.arc(mx, my, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a1f";
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd23a";
    ctx.beginPath();
    ctx.arc(mx - 4, my - 4, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParticles();

  // impact flash
  if (meteorPhase === "impact" && impactTimer < 0.25) {
    ctx.fillStyle = `rgba(255,255,255,${1 - impactTimer / 0.25})`;
    ctx.fillRect(-40, -40, W + 80, H + 80);
  }

  ctx.restore();
}

function drawBuilding(cx: number, groundY: number, strange: boolean): void {
  const bw = Math.min(360, W * 0.4);
  const bh = H * 0.32;
  const x = cx - bw / 2;
  const y = groundY - bh;

  ctx.fillStyle = strange ? "#2a2236" : "#3a4250";
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = strange ? "#211b2c" : "#2c333f";
  ctx.fillRect(x, y, bw, 16);

  // windows
  ctx.fillStyle = strange ? "#7affde" : "#9fd2ff";
  const cols = 5;
  const rows = 4;
  const pad = 18;
  const ww = (bw - pad * (cols + 1)) / cols;
  const wh = (bh - 60 - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (strange && (r + c) % 3 === 0) continue; // broken windows
      ctx.fillRect(x + pad + c * (ww + pad), y + 40 + pad + r * (wh + pad), ww, wh);
    }
  }

  // sign
  ctx.fillStyle = "#05070a";
  ctx.fillRect(x + bw * 0.1, y - 34, bw * 0.8, 28);
  ctx.fillStyle = strange ? "#ff5a5a" : "#9effa0";
  ctx.font = `bold ${Math.max(13, bw * 0.052)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(strange ? "B?0T3CH 1NDU$TR13S" : "BioTech Industries", cx, y - 20);
}

function drawObjectiveOverlay(): void {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#9effa0";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.fillText("OBJECTIVE", W / 2, H / 2 - 44);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.fillText("Go to the strange building", W / 2, H / 2);

  if (impactTimer > 1.6 && Math.floor(impactTimer * 2) % 2 === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("press space to continue", W / 2, H / 2 + 54);
  }
}

function drawOverworld(): void {
  // sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a1426");
  g.addColorStop(1, "#3a2a2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const groundY = H * GROUND_FRAC;
  ctx.fillStyle = "#1c2a1c";
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.save();
  ctx.translate(-camX, 0);

  // ground detail so movement is visible (world space)
  drawGroundDetail(groundY);

  // strange building far right
  drawBuilding(BUILDING_WORLD_X, groundY, true);

  // smoke rises from the building (world space, moves with camera)
  drawParticles();
  ctx.restore();

  // hero
  const u = Math.max(4, Math.min(W, H) / 90);
  drawCharacter(heroX - camX, groundY + 6, u, HERO, true);

  // objective hint
  ctx.fillStyle = "rgba(158,255,160,0.85)";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("→ Go to the strange building", 18, 56);

  if (reachedBuilding) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#9effa0";
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("To be continued...", W / 2, H / 2);
  }
}

// Repeating ground features drawn in world space so they scroll past the player.
function drawGroundDetail(groundY: number): void {
  const startX = Math.floor(camX / 120) * 120 - 120;
  const endX = camX + W + 120;

  for (let wx = startX; wx < endX; wx += 120) {
    // deterministic "random" per tile so it doesn't flicker
    const seed = Math.abs(Math.sin(wx * 0.013)) ;

    // grass tuft
    ctx.fillStyle = "#2c4a2c";
    const gx = wx + 30;
    ctx.fillRect(gx, groundY - 10, 4, 10);
    ctx.fillRect(gx + 5, groundY - 14, 4, 14);
    ctx.fillRect(gx + 10, groundY - 8, 4, 8);

    // a rock every few tiles
    if (seed > 0.6) {
      ctx.fillStyle = "#3a3f46";
      ctx.fillRect(wx + 70, groundY - 12, 22, 12);
      ctx.fillStyle = "#2a2e34";
      ctx.fillRect(wx + 70, groundY - 12, 22, 4);
    }

    // dashed path line on the ground
    ctx.fillStyle = "rgba(120,150,120,0.25)";
    ctx.fillRect(wx + 50, groundY + 18, 50, 4);
  }

  // distance markers counting toward the building
  ctx.fillStyle = "rgba(158,255,160,0.35)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let mx = 400; mx < BUILDING_WORLD_X; mx += 400) {
    ctx.fillRect(mx, groundY - 40, 3, 40);
    const metersLeft = Math.max(0, Math.round((BUILDING_WORLD_X - mx) / 100));
    ctx.fillText(`${metersLeft}m`, mx, groundY - 44);
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function roundRect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
