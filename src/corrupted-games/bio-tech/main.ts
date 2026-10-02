// Bio Tech — a fanmade game for Bionic.
// Full-screen canvas game. Opening cutscene.
import { isGigantic } from "../../shared/bigGames";

// GIGANTIC Bio Tech: the hero and the scientist stay their normal size, and
// the building, the lab, the knife, the Bio Arm, the walls, the shoes and
// everything else are giant.
const GIGANTIC = isGigantic("bio-tech");
const GIANT = GIGANTIC ? 3 : 1;
if (GIGANTIC) document.title = "GIGANTIC Bio Tech";

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
let interactPressed = false; // "i" — read sign
let aimPressed = false; // "1" — toggle grapple aiming
let grappleClick = false; // clicked while aiming
let jumpPressed = false; // edge-triggered jump (space / up / w)
let mouseX = 0;
let mouseY = 0;

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    advancePressed = true;
  }
  if (e.key.toLowerCase() === "i") interactPressed = true;
  if (e.key === "1") aimPressed = true;
  if ((e.key === " " || e.key === "ArrowUp" || e.key.toLowerCase() === "w") && !e.repeat) {
    jumpPressed = true;
  }
  ensureAudio();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouseX = e.clientX - r.left;
  mouseY = e.clientY - r.top;
});
canvas.addEventListener("pointerdown", () => {
  ensureAudio();
  if (scene === "explore" && aiming) {
    grappleClick = true;
  } else {
    advancePressed = true;
  }
});

// ---------------------------------------------------------------------------
// Audio (synthesized — no asset files)
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;
function ensureAudio(): void {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
}
window.addEventListener("keydown", ensureAudio, { once: false });

function playSlice(): void {
  if (!audioCtx) return;
  const ac = audioCtx;
  const now = ac.currentTime;

  // noise burst (the "shhk" of the cut)
  const dur = 0.35;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1900;
  bp.Q.value = 0.7;
  const ng = ac.createGain();
  ng.gain.value = 0.5;
  src.connect(bp).connect(ng).connect(ac.destination);
  src.start(now);

  // metallic descending "shing"
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.28);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.22, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
  osc.connect(og).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.33);
}

function playPowerUp(): void {
  if (!audioCtx) return;
  const ac = audioCtx;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.72);
}

function playDrill(): void {
  if (!audioCtx) return;
  const ac = audioCtx;
  const now = ac.currentTime;
  const dur = 0.13;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 480;
  const g = ac.createGain();
  g.gain.value = 0.22;
  src.connect(lp).connect(g).connect(ac.destination);
  src.start(now);
}

function playBoing(pitch: number): void {
  if (!audioCtx) return;
  const ac = audioCtx;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(620 * pitch, now + 0.14);
  osc.frequency.exponentialRampToValueAtTime(300 * pitch, now + 0.28);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

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
type ArmState = "normal" | "missing" | "bio";

function drawCharacter(
  x: number,
  yFeet: number,
  u: number,
  pal: Palette,
  faceRight: boolean,
  rightArm: ArmState = "normal"
): void {
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

  // Left arm (always present)
  px(0, 8, 4, 12, pal.shirtDark);
  px(0, 18, 4, 2, pal.skin);

  // Right arm — normal, sliced off, or bionic
  if (rightArm === "normal") {
    px(12, 8, 4, 12, pal.shirtDark);
    px(12, 18, 4, 2, pal.skin);
  } else if (rightArm === "bio") {
    px(12, 8, 4, 6, "#5a6b72"); // metal upper
    px(12, 13, 4, 2, "#7affde"); // glowing joint
    px(12, 15, 4, 5, "#3a464c"); // metal forearm
    px(12, 18, 4, 2, "#7affde"); // glowing hand
  } else {
    // missing: just a short empty sleeve at the shoulder (no blood)
    px(12, 8, 4, 4, pal.shirtDark);
  }

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
type Scene =
  | "dialogue"
  | "fadeOut"
  | "meteor"
  | "objective"
  | "overworld"
  | "interior"
  | "slice"
  | "armRun"
  | "armCutscene"
  | "explore"
  | "drill"
  | "springs";
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
let camX = 0;
const GROUND_FRAC = 0.78;
const BUILDING_WORLD_X = 1600;
let entering = false; // fading out to walk inside the building

// --- Interior ---
const INTERIOR_WIDTH = 1500;
const PEDESTAL_X = 820; // where the knife-on-a-pedestal sits inside
let grabbedKnife = false;
let knifeHeldTimer = 0; // pause after grabbing before the screen cuts to black

// --- Slice / arm run / cutscene ---
let sliceTimer = 0;
const ARMRUN_WIDTH = 1500;
const BIOARM_X = 1240; // the bio arm pod at the end of the run
let reachedArm = false;
let cutsceneTimer = 0;
let hasBioArm = false;
let powerUpPlayed = false;

// --- Explore / grappling hook ---
const EXPLORE_WIDTH = 2600;
const SIGN_X = 1700;
const GRAVITY = 2000;
interface Platform {
  x: number;
  w: number;
  top: number; // height above the floor
}
const platforms: Platform[] = [{ x: 1980, w: 300, top: 180 }];
let heroY = 0; // height above floor (0 = on the ground)
let heroVY = 0; // vertical velocity (positive = up)
let heroFacing = true; // true = facing right
let showSign = false;
let aiming = false;
let grappling = false;
let targetWX = 0; // grapple target, world x
let targetH = 0; // grapple target, height above floor
let leavingExplore = false; // fading out to the drill section

// --- Drill section ---
const DRILL_WIDTH = 2400;
interface Wall {
  x: number; // center
  hp: number;
  maxHp: number;
}
const walls: Wall[] = [
  { x: 760, hp: 1.6, maxHp: 1.6 },
  { x: 1380, hp: 1.8, maxHp: 1.8 },
  { x: 1960, hp: 2.0, maxHp: 2.0 },
];
let drillBannerT = 0;
let drillSoundTimer = 0;
let drillingNow = false;
let leavingDrill = false; // fading out to the spring-shoes section
const WALL_HALF = 22 * GIANT;
const WALL_H = 170 * GIANT;

// --- Spring shoes section ---
const SPRINGS_WIDTH = 2000;
const SHOES_X = 520;
const JUMP_V = 800; // jump strength (with GRAVITY=2000, apex ≈ 160px)
const SPRING_STEP: Platform = { x: 1250, w: 170, top: 150 };
const SPRING_EXIT: Platform = { x: 1520, w: 260, top: 300 };
const springPlatforms: Platform[] = [SPRING_STEP, SPRING_EXIT];
let hasSpringShoes = false;
let usedDoubleJump = false;
let springBannerT = 0;
let reachedSpringsEnd = false;

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
      spawnSmokeAt(BUILDING_WORLD_X, groundY - buildingHeight()); // smoke from the strange building's roof
      if (!entering && heroX >= BUILDING_WORLD_X - 60) {
        entering = true; // reached the door — start walking in
      }
      if (entering) {
        fade = Math.min(1, fade + dt * 1.4);
        if (fade >= 1) {
          scene = "interior";
          heroX = 60;
          camX = 0;
          particles.length = 0;
          entering = false;
          grabbedKnife = false;
        }
      }
      break;
    }

    case "interior": {
      fade = Math.max(0, fade - dt * 1.2); // fade in
      const speed = 220;
      if (keys.has("arrowright") || keys.has("d")) heroX += speed * dt;
      if (keys.has("arrowleft") || keys.has("a")) heroX -= speed * dt;
      heroX = Math.max(40, Math.min(INTERIOR_WIDTH - 40, heroX));
      camX = Math.max(0, Math.min(INTERIOR_WIDTH - W, heroX - W * 0.4));
      updateParticles(dt);
      // eerie glow rising off the knife (until it's grabbed)
      const knifeY = H * GROUND_FRAC - 96 * GIANT;
      if (!grabbedKnife && particles.length < 60) {
        particles.push({
          x: PEDESTAL_X + (Math.random() - 0.5) * 40 * GIANT,
          y: knifeY,
          vx: (Math.random() - 0.5) * 10,
          vy: -20 - Math.random() * 20,
          life: 0,
          max: 1.0 + Math.random() * 0.9,
          size: 4 + Math.random() * 6,
          color: Math.random() > 0.5 ? "rgba(122,255,222,0.5)" : "rgba(158,255,160,0.45)",
        });
      }
      if (!grabbedKnife && Math.abs(heroX - PEDESTAL_X) < 70) {
        grabbedKnife = true; // walk up to it and grab the knife
        knifeHeldTimer = 0;
      }
      if (grabbedKnife) {
        knifeHeldTimer += dt;
        if (knifeHeldTimer > 1.7) {
          fade = Math.min(1, fade + dt * 2.0); // cut to black
          if (fade >= 1) {
            scene = "slice";
            sliceTimer = 0;
            ensureAudio();
            playSlice();
          }
        }
      }
      break;
    }

    case "slice": {
      // black screen, the slice sound plays, then reveal the wound
      sliceTimer += dt;
      if (sliceTimer > 1.8) {
        scene = "armRun";
        heroX = 60;
        camX = 0;
        particles.length = 0;
        reachedArm = false;
        fade = 1; // fade in to the wounded hero
      }
      break;
    }

    case "armRun": {
      fade = Math.max(0, fade - dt * 1.0); // fade in
      const speed = 200; // a little slower — you're hurt
      if (keys.has("arrowright") || keys.has("d")) heroX += speed * dt;
      if (keys.has("arrowleft") || keys.has("a")) heroX -= speed * dt;
      heroX = Math.max(40, Math.min(ARMRUN_WIDTH - 40, heroX));
      camX = Math.max(0, Math.min(ARMRUN_WIDTH - W, heroX - W * 0.4));
      updateParticles(dt);
      if (!reachedArm && heroX >= BIOARM_X - 70 * GIANT) {
        reachedArm = true;
        scene = "armCutscene";
        cutsceneTimer = 0;
        hasBioArm = false;
        powerUpPlayed = false;
        particles.length = 0;
      }
      break;
    }

    case "armCutscene": {
      cutsceneTimer += dt;
      // arm attaches around t=2.2
      if (cutsceneTimer >= 2.2 && !hasBioArm) {
        hasBioArm = true;
        if (!powerUpPlayed) {
          ensureAudio();
          playPowerUp();
          powerUpPlayed = true;
        }
        // spark burst at the shoulder
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 180;
          particles.push({
            x: BIOARM_X - 80 * GIANT,
            y: H * GROUND_FRAC - 20 * (Math.max(4, Math.min(W, H) / 90)),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0,
            max: 0.5 + Math.random() * 0.5,
            size: 3 + Math.random() * 5,
            color: Math.random() > 0.5 ? "#7affde" : "#ffffff",
          });
        }
      }
      updateParticles(dt);
      if (cutsceneTimer > 2.8 && advancePressed) {
        scene = "explore";
        heroY = 0;
        heroVY = 0;
        heroFacing = true;
        showSign = false;
        aiming = false;
        grappling = false;
        particles.length = 0;
      }
      break;
    }

    case "explore": {
      fade = Math.max(0, fade - dt * 1.2);
      const floorY = H * GROUND_FRAC;
      const touchingSign = Math.abs(heroX - SIGN_X) < 60 * GIANT;

      if (interactPressed) showSign = touchingSign ? !showSign : false;
      if (aimPressed && hasBioArm && !grappling) aiming = !aiming;

      if (aiming && grappleClick) {
        aiming = false;
        grappling = true;
        targetWX = Math.max(0, Math.min(EXPLORE_WIDTH, mouseX + camX));
        targetH = Math.max(0, floorY - mouseY);
        heroFacing = targetWX >= heroX;
      }

      if (grappling) {
        const dx = targetWX - heroX;
        const dy = targetH - heroY;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 16) {
          grappling = false;
          heroVY = 0;
        } else {
          const sp = 1100;
          heroX += (dx / d) * sp * dt;
          heroY += (dy / d) * sp * dt;
        }
      } else {
        const speed = 230;
        if (keys.has("arrowright") || keys.has("d")) {
          heroX += speed * dt;
          heroFacing = true;
        }
        if (keys.has("arrowleft") || keys.has("a")) {
          heroX -= speed * dt;
          heroFacing = false;
        }
        // vertical physics: rest on floor or a platform, otherwise fall
        let support = 0;
        for (const p of platforms) {
          if (
            heroX >= p.x &&
            heroX <= p.x + p.w &&
            heroVY <= 0 &&
            heroY <= p.top + 1 &&
            heroY >= p.top - 34
          ) {
            support = Math.max(support, p.top);
          }
        }
        if (heroVY <= 0 && heroY <= support + 0.5) {
          heroY = support;
          heroVY = 0;
        } else {
          heroVY -= GRAVITY * dt;
          heroY += heroVY * dt;
          if (heroY < 0) {
            heroY = 0;
            heroVY = 0;
          }
        }
      }

      heroX = Math.max(40, Math.min(EXPLORE_WIDTH - 40, heroX));
      camX = Math.max(0, Math.min(EXPLORE_WIDTH - W, heroX - W * 0.4));
      updateParticles(dt);

      // reached the end of the screen → next section (the drill)
      if (!grappling && heroX >= EXPLORE_WIDTH - 46) leavingExplore = true;
      if (leavingExplore) {
        fade = Math.min(1, fade + dt * 1.6);
        if (fade >= 1) {
          scene = "drill";
          heroX = 60;
          heroY = 0;
          heroVY = 0;
          heroFacing = true;
          camX = 0;
          particles.length = 0;
          leavingExplore = false;
          drillBannerT = 0;
          for (const w of walls) w.hp = w.maxHp;
        }
      }
      break;
    }

    case "drill": {
      fade = Math.max(0, fade - dt * 1.2);
      drillBannerT += dt;
      const speed = 230;
      const prevX = heroX;
      if (keys.has("arrowright") || keys.has("d")) {
        heroX += speed * dt;
        heroFacing = true;
      }
      if (keys.has("arrowleft") || keys.has("a")) {
        heroX -= speed * dt;
        heroFacing = false;
      }

      // intact walls block the path
      const MARGIN = 18;
      for (const w of walls) {
        if (w.hp <= 0) continue;
        if (prevX <= w.x && heroX > w.x - WALL_HALF - MARGIN) heroX = w.x - WALL_HALF - MARGIN;
        else if (prevX >= w.x && heroX < w.x + WALL_HALF + MARGIN) heroX = w.x + WALL_HALF + MARGIN;
      }

      // drill: hold the 2 key while up against a cracked wall
      drillingNow = false;
      if (keys.has("2")) {
        let target: Wall | null = null;
        for (const w of walls) {
          if (w.hp <= 0) continue;
          const dir = w.x - heroX;
          if (Math.abs(dir) < WALL_HALF + MARGIN + 16 && dir >= 0 === heroFacing) {
            target = w;
            break;
          }
        }
        if (target) {
          drillingNow = true;
          target.hp -= dt;
          // debris flying off the wall
          if (particles.length < 90) {
            particles.push({
              x: target.x - (heroFacing ? WALL_HALF : -WALL_HALF),
              y: H * GROUND_FRAC - WALL_H * (0.3 + Math.random() * 0.5),
              vx: (heroFacing ? -1 : 1) * (60 + Math.random() * 120),
              vy: -40 + Math.random() * 60,
              life: 0,
              max: 0.5 + Math.random() * 0.4,
              size: 3 + Math.random() * 5,
              color: Math.random() > 0.5 ? "#5a5468" : "#6b6478",
            });
          }
          drillSoundTimer -= dt;
          if (drillSoundTimer <= 0) {
            ensureAudio();
            playDrill();
            drillSoundTimer = 0.11;
          }
          if (target.hp <= 0) {
            // wall shatters
            for (let i = 0; i < 30; i++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 60 + Math.random() * 200;
              particles.push({
                x: target.x,
                y: H * GROUND_FRAC - WALL_H * 0.5,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                life: 0,
                max: 0.6 + Math.random() * 0.5,
                size: 4 + Math.random() * 6,
                color: Math.random() > 0.5 ? "#5a5468" : "#39344a",
              });
            }
          }
        }
      }

      heroX = Math.max(40, Math.min(DRILL_WIDTH - 40, heroX));
      camX = Math.max(0, Math.min(DRILL_WIDTH - W, heroX - W * 0.4));
      updateParticles(dt);

      // reached the end → spring-shoes section
      if (heroX >= DRILL_WIDTH - 46) leavingDrill = true;
      if (leavingDrill) {
        fade = Math.min(1, fade + dt * 1.6);
        if (fade >= 1) {
          scene = "springs";
          heroX = 60;
          heroY = 0;
          heroVY = 0;
          heroFacing = true;
          camX = 0;
          particles.length = 0;
          leavingDrill = false;
          hasSpringShoes = false;
          usedDoubleJump = false;
          springBannerT = 99; // no banner until shoes are grabbed
          reachedSpringsEnd = false;
        }
      }
      break;
    }

    case "springs": {
      fade = Math.max(0, fade - dt * 1.2);
      springBannerT += dt;
      const speed = 230;
      if (keys.has("arrowright") || keys.has("d")) {
        heroX += speed * dt;
        heroFacing = true;
      }
      if (keys.has("arrowleft") || keys.has("a")) {
        heroX -= speed * dt;
        heroFacing = false;
      }

      // grab the spring shoes
      if (!hasSpringShoes && Math.abs(heroX - SHOES_X) < 50 * GIANT && heroY < 40) {
        hasSpringShoes = true;
        springBannerT = 0;
        ensureAudio();
        playPowerUp();
      }

      // find support (floor spans the whole width; platforms add ledges)
      let support = 0;
      for (const p of springPlatforms) {
        if (
          heroX >= p.x &&
          heroX <= p.x + p.w &&
          heroVY <= 0 &&
          heroY <= p.top + 1 &&
          heroY >= p.top - 34
        ) {
          support = Math.max(support, p.top);
        }
      }
      const grounded = heroVY <= 0 && heroY <= support + 0.5;
      if (grounded) {
        heroY = support;
        heroVY = 0;
        usedDoubleJump = false;
      }

      // jump / double jump
      if (jumpPressed && hasSpringShoes) {
        if (grounded) {
          heroVY = JUMP_V;
          ensureAudio();
          playBoing(1);
        } else if (!usedDoubleJump) {
          heroVY = JUMP_V;
          usedDoubleJump = true;
          ensureAudio();
          playBoing(1.4);
        }
      }

      // integrate vertical motion when airborne or rising
      if (heroVY > 0 || !grounded) {
        heroVY -= GRAVITY * dt;
        heroY += heroVY * dt;
        if (heroY < 0) {
          heroY = 0;
          heroVY = 0;
        }
      }

      heroX = Math.max(40, Math.min(SPRINGS_WIDTH - 40, heroX));
      camX = Math.max(0, Math.min(SPRINGS_WIDTH - W, heroX - W * 0.4));
      updateParticles(dt);

      // reached the high exit ledge
      if (
        heroX >= SPRING_EXIT.x &&
        heroX <= SPRING_EXIT.x + SPRING_EXIT.w &&
        heroY >= SPRING_EXIT.top - 8
      ) {
        reachedSpringsEnd = true;
      }
      break;
    }
  }
  advancePressed = false;
  interactPressed = false;
  aimPressed = false;
  grappleClick = false;
  jumpPressed = false;
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
  if (GIGANTIC) return { ix: W * 0.5, iy: groundY - buildingHeight() * 0.56 };
  return { ix: W * 0.5, iy: groundY - H * 0.18 };
}

// A giant building still leaves room at the top of the screen for its sign.
function buildingHeight(): number {
  if (!GIGANTIC) return H * 0.32;
  return Math.min(H * 0.32 * GIANT, H * GROUND_FRAC - 40 * GIANT);
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
  } else if (scene === "interior") {
    drawInterior();
  } else if (scene === "slice") {
    drawSlice();
  } else if (scene === "armRun") {
    drawArmRun();
  } else if (scene === "armCutscene") {
    drawArmCutscene();
  } else if (scene === "explore") {
    drawExplore();
  } else if (scene === "drill") {
    drawDrill();
  } else if (scene === "springs") {
    drawSprings();
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
  ctx.lineWidth = 2 * GIANT;
  for (let gx = 0; gx < W; gx += 64 * GIANT) {
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
    ctx.fillRect(sx, sy, 2 * GIANT, 2 * GIANT);
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
    ctx.arc(mx, my, 22 * GIANT, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff8a1f";
    ctx.beginPath();
    ctx.arc(mx, my, 14 * GIANT, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd23a";
    ctx.beginPath();
    ctx.arc(mx - 4 * GIANT, my - 4 * GIANT, 7 * GIANT, 0, Math.PI * 2);
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
  const bw = Math.min(360, W * 0.4) * GIANT;
  const bh = buildingHeight();
  const x = cx - bw / 2;
  const y = groundY - bh;

  ctx.fillStyle = strange ? "#2a2236" : "#3a4250";
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = strange ? "#211b2c" : "#2c333f";
  ctx.fillRect(x, y, bw, 16 * GIANT);

  // windows
  ctx.fillStyle = strange ? "#7affde" : "#9fd2ff";
  const cols = 5;
  const rows = 4;
  const pad = 18 * GIANT;
  const ww = (bw - pad * (cols + 1)) / cols;
  const wh = (bh - 60 * GIANT - pad * (rows + 1)) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (strange && (r + c) % 3 === 0) continue; // broken windows
      ctx.fillRect(x + pad + c * (ww + pad), y + 40 * GIANT + pad + r * (wh + pad), ww, wh);
    }
  }

  // sign
  ctx.fillStyle = "#05070a";
  ctx.fillRect(x + bw * 0.1, y - 34 * GIANT, bw * 0.8, 28 * GIANT);
  ctx.fillStyle = strange ? "#ff5a5a" : "#9effa0";
  ctx.font = `bold ${Math.max(13, bw * 0.052)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(strange ? "B?0T3CH 1NDU$TR13S" : "BioTech Industries", cx, y - 20 * GIANT);
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
}

function drawInterior(): void {
  const floorY = H * GROUND_FRAC;

  // dark room
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camX, 0);

  // back wall
  ctx.fillStyle = "#161020";
  ctx.fillRect(0, 0, INTERIOR_WIDTH, floorY);
  // wall trim
  ctx.fillStyle = "#221830";
  ctx.fillRect(0, floorY - 28 * GIANT, INTERIOR_WIDTH, 28 * GIANT);

  // floor
  ctx.fillStyle = "#0e0b16";
  ctx.fillRect(0, floorY, INTERIOR_WIDTH, H - floorY);
  // floor tile lines
  ctx.strokeStyle = "rgba(122,255,222,0.07)";
  ctx.lineWidth = 2 * GIANT;
  for (let fx = 0; fx < INTERIOR_WIDTH; fx += 90 * GIANT) {
    ctx.beginPath();
    ctx.moveTo(fx, floorY);
    ctx.lineTo(fx, H);
    ctx.stroke();
  }

  // broken lab machines along the wall
  for (const mx of [180, 360, 1180, 1320]) drawLabMachine(mx, floorY);

  // glow behind the pedestal
  const glow = ctx.createRadialGradient(
    PEDESTAL_X, floorY - 90 * GIANT, 6 * GIANT,
    PEDESTAL_X, floorY - 90 * GIANT, 130 * GIANT
  );
  glow.addColorStop(0, grabbedKnife ? "rgba(122,255,222,0.08)" : "rgba(122,255,222,0.4)");
  glow.addColorStop(1, "rgba(122,255,222,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(PEDESTAL_X - 140 * GIANT, floorY - 220 * GIANT, 280 * GIANT, 240 * GIANT);

  // pedestal
  const px = PEDESTAL_X;
  const g = GIANT;
  ctx.fillStyle = "#2b2740";
  ctx.fillRect(px - 34 * g, floorY - 14 * g, 68 * g, 14 * g); // base
  ctx.fillStyle = "#221f33";
  ctx.fillRect(px - 22 * g, floorY - 64 * g, 44 * g, 50 * g); // column
  ctx.fillStyle = "#36314f";
  ctx.fillRect(px - 30 * g, floorY - 74 * g, 60 * g, 12 * g); // top slab

  // the knife (only while still on the pedestal)
  if (!grabbedKnife) {
    drawKnife(px, floorY - 78 * g, g, false);
  }

  // eerie glow particles
  drawParticles();
  ctx.restore();

  // hero (faces the pedestal as you approach)
  const u = Math.max(4, Math.min(W, H) / 90);
  const facingRight = heroX <= PEDESTAL_X;
  drawCharacter(heroX - camX, floorY + 6, u, HERO, facingRight);
  // knife held in hand once grabbed
  if (grabbedKnife) {
    drawKnife(heroX - camX + (facingRight ? 9 * u : -9 * u), floorY - 12 * u, 0.7 * GIANT, !facingRight);
  }

  // pickup message
  if (grabbedKnife && fade < 0.2) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#7affde";
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText("You grabbed the knife.", W / 2, H / 2);
  }
}

// Shared dark lab room background (used by slice/armRun/cutscene).
function drawLabRoom(width: number, floorY: number): void {
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-camX, 0);

  ctx.fillStyle = "#161020";
  ctx.fillRect(0, 0, width, floorY);
  ctx.fillStyle = "#221830";
  ctx.fillRect(0, floorY - 28 * GIANT, width, 28 * GIANT);
  ctx.fillStyle = "#0e0b16";
  ctx.fillRect(0, floorY, width, H - floorY);

  ctx.strokeStyle = "rgba(122,255,222,0.07)";
  ctx.lineWidth = 2 * GIANT;
  for (let fx = 0; fx < width; fx += 90 * GIANT) {
    ctx.beginPath();
    ctx.moveTo(fx, floorY);
    ctx.lineTo(fx, H);
    ctx.stroke();
  }

  // broken machines along the wall
  for (let mx = 140; mx < width - 120; mx += 320) drawLabMachine(mx, floorY);
  ctx.restore();
}

// A broken lab machine against the wall, with a flickering screen.
function drawLabMachine(mx: number, floorY: number): void {
  const g = GIANT;
  ctx.fillStyle = "#2a2440";
  ctx.fillRect(mx, floorY - 90 * g, 70 * g, 90 * g);
  ctx.fillStyle = "#3a3358";
  ctx.fillRect(mx, floorY - 90 * g, 70 * g, 12 * g);
  const lit = Math.floor(performance.now() / 220 + mx) % 4 !== 0;
  ctx.fillStyle = lit ? "#7affde" : "#163a33";
  ctx.fillRect(mx + 12 * g, floorY - 70 * g, 46 * g, 30 * g);
}

// The stand the Bio Arm waits on.
function drawArmPod(floorY: number): void {
  const g = GIANT;
  ctx.fillStyle = "#1d2a30";
  ctx.fillRect(BIOARM_X - 30 * g, floorY - 60 * g, 60 * g, 60 * g);
  ctx.fillStyle = "#2b3d44";
  ctx.fillRect(BIOARM_X - 38 * g, floorY - 70 * g, 76 * g, 12 * g);
}

// The Bio Arm — a robotic teal/metal arm. (x, y) is its center.
function drawBioArm(x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  // upper arm
  ctx.fillStyle = "#5a6b72";
  ctx.fillRect(-6 * s, -22 * s, 12 * s, 18 * s);
  // glowing elbow joint
  ctx.fillStyle = "#7affde";
  ctx.fillRect(-6 * s, -6 * s, 12 * s, 4 * s);
  // forearm
  ctx.fillStyle = "#3a464c";
  ctx.fillRect(-6 * s, -2 * s, 12 * s, 16 * s);
  // plating highlights
  ctx.fillStyle = "#7d909a";
  ctx.fillRect(-6 * s, -22 * s, 3 * s, 36 * s);
  // glowing fingers
  ctx.fillStyle = "#7affde";
  ctx.fillRect(-6 * s, 14 * s, 3 * s, 6 * s);
  ctx.fillRect(-1 * s, 14 * s, 3 * s, 7 * s);
  ctx.fillRect(4 * s, 14 * s, 2 * s, 5 * s);
  ctx.restore();
}

function drawSlice(): void {
  // pure black; a single white flash line at the very start of the cut
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  if (sliceTimer < 0.18) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - sliceTimer / 0.18})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, H * 0.3);
    ctx.lineTo(W * 0.8, H * 0.7);
    ctx.stroke();
  }
}

function drawArmRun(): void {
  const floorY = H * GROUND_FRAC;
  drawLabRoom(ARMRUN_WIDTH, floorY);

  const u = Math.max(4, Math.min(W, H) / 90);

  // the Bio Arm pod at the end
  ctx.save();
  ctx.translate(-camX, 0);
  const g = GIANT;
  const glow = ctx.createRadialGradient(BIOARM_X, floorY - 70 * g, 6 * g, BIOARM_X, floorY - 70 * g, 120 * g);
  glow.addColorStop(0, "rgba(122,255,222,0.4)");
  glow.addColorStop(1, "rgba(122,255,222,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(BIOARM_X - 120 * g, floorY - 200 * g, 240 * g, 220 * g);
  // pod / stand
  drawArmPod(floorY);
  drawBioArm(BIOARM_X, floorY - 96 * g, 1.6 * g);
  // label
  ctx.fillStyle = "#7affde";
  ctx.font = `bold ${14 * g}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("BIO ARM", BIOARM_X, floorY - 132 * g);
  drawParticles();
  ctx.restore();

  // wounded hero, missing the right arm, holding the knife in the left hand
  const facingRight = heroX <= BIOARM_X;
  drawCharacter(heroX - camX, floorY + 6, u, HERO, facingRight, "missing");
  drawKnife(heroX - camX - 9 * u, floorY - 12 * u, 0.7 * GIANT, true);

  // objective
  ctx.fillStyle = "rgba(255,120,120,0.9)";
  ctx.font = "18px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("!  Get to the BIO ARM!", 18, 56);
}

function drawArmCutscene(): void {
  const floorY = H * GROUND_FRAC;
  drawLabRoom(ARMRUN_WIDTH, floorY);

  const u = Math.max(4, Math.min(W, H) / 90);
  const heroScreenX = BIOARM_X - 80 * GIANT - camX; // hero stands just left of the pod
  const shoulderX = heroScreenX + 6 * u;
  const shoulderY = floorY - 20 * u;

  // pod
  ctx.save();
  ctx.translate(-camX, 0);
  drawArmPod(floorY);
  ctx.restore();

  // hero — gains the bio arm partway through
  drawCharacter(heroScreenX, floorY + 6, u, HERO, true, hasBioArm ? "bio" : "missing");

  // the flying arm travels from the pod to the shoulder between t=1.0 and t=2.2
  if (!hasBioArm) {
    const podX = BIOARM_X - camX;
    const podY = floorY - 96 * GIANT;
    const t = Math.max(0, Math.min(1, (cutsceneTimer - 1.0) / 1.2));
    const ax = podX + (shoulderX - podX) * t;
    const ay = podY + (shoulderY - podY) * t;
    // It shrinks on the way, so once it's part of the hero it's hero-sized.
    const startSize = 1.6 * GIANT;
    drawBioArm(ax, ay, startSize - (startSize - 1) * t);
  }

  drawParticles();

  // flash at attach moment
  if (cutsceneTimer >= 2.2 && cutsceneTimer < 2.45) {
    ctx.fillStyle = `rgba(255,255,255,${1 - (cutsceneTimer - 2.2) / 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }

  // captions
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (cutsceneTimer < 1.0) {
    caption("There... a replacement.");
  } else if (cutsceneTimer < 2.2) {
    caption("Reaching for the Bio Arm...");
  } else if (cutsceneTimer > 2.6) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#7affde";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.fillText("BIO ARM ONLINE", W / 2, H / 2 - 16);
    if (cutsceneTimer > 2.8 && Math.floor(cutsceneTimer * 2) % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("press space to continue", W / 2, H / 2 + 28);
    }
  }
}

function caption(text: string): void {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, H - 90, W, 90);
  ctx.fillStyle = "#e8f0e8";
  ctx.font = "22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H - 45);
}

function drawSignPost(x: number, floorY: number): void {
  const g = GIANT;
  ctx.fillStyle = "#4a3a22";
  ctx.fillRect(x - 4 * g, floorY - 64 * g, 8 * g, 64 * g); // post
  ctx.fillStyle = "#6b5333";
  ctx.fillRect(x - 36 * g, floorY - 108 * g, 72 * g, 48 * g); // board frame
  ctx.fillStyle = "#caa86a";
  ctx.fillRect(x - 31 * g, floorY - 103 * g, 62 * g, 38 * g); // board face
  ctx.fillStyle = "#3a2a14";
  ctx.font = `bold ${30 * g}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("i", x, floorY - 82 * g);
}

function drawExplore(): void {
  const floorY = H * GROUND_FRAC;
  drawLabRoom(EXPLORE_WIDTH, floorY);

  const u = Math.max(4, Math.min(W, H) / 90);

  // world objects
  ctx.save();
  ctx.translate(-camX, 0);

  // the now-empty bio arm pod
  drawArmPod(floorY);

  // platforms (grapple ledges). Giant ones are only thicker: you still stand
  // on the same top.
  const g = GIANT;
  for (const p of platforms) {
    ctx.fillStyle = "#2a2440";
    ctx.fillRect(p.x, floorY - p.top, p.w, 16 * g);
    ctx.fillStyle = "#3a3358";
    ctx.fillRect(p.x, floorY - p.top, p.w, 4 * g);
    // support strut
    ctx.fillStyle = "rgba(58,51,88,0.5)";
    ctx.fillRect(p.x + p.w / 2 - 4 * g, floorY - p.top + 16 * g, 8 * g, p.top - 16 * g);
  }

  // sign
  drawSignPost(SIGN_X, floorY);

  drawParticles();
  ctx.restore();

  // hero (with bio arm), positioned at current height
  const yFeet = floorY - heroY + 6;
  drawCharacter(heroX - camX, yFeet, u, HERO, heroFacing, "bio");

  // grapple rope from the bio-arm hand to the target
  if (grappling) {
    const shoulderX = heroX - camX + (heroFacing ? 6 : -6) * u;
    const shoulderY = yFeet - 18 * u;
    ctx.strokeStyle = "#7affde";
    ctx.lineWidth = 3 * GIANT;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(targetWX - camX, floorY - targetH);
    ctx.stroke();
    // hook head
    ctx.fillStyle = "#cfe9ff";
    ctx.fillRect(targetWX - camX - 5 * GIANT, floorY - targetH - 5 * GIANT, 10 * GIANT, 10 * GIANT);
  }

  // aiming reticle
  if (aiming) {
    ctx.strokeStyle = "#7affde";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - 22, mouseY);
    ctx.lineTo(mouseX + 22, mouseY);
    ctx.moveTo(mouseX, mouseY - 22);
    ctx.lineTo(mouseX, mouseY + 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(122,255,222,0.9)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("click a spot to grapple onto", mouseX, mouseY - 26);
  }

  // controls hint
  ctx.fillStyle = "rgba(158,255,160,0.7)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("← → / A D  move    ·    I  read sign    ·    1  grappling hook", 18, 56);

  // "press I" hint when touching the sign
  const touchingSign = Math.abs(heroX - SIGN_X) < 60 * GIANT;
  if (touchingSign && !showSign) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${16 * GIANT}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("Press I to read", SIGN_X - camX, floorY - 116 * GIANT);
  }

  // sign info panel
  if (showSign) drawSignPanel();
}

function drawSignPanel(): void {
  const lines = hasBioArm
    ? [
        "GRAPPLING HOOK MANEUVER",
        "",
        "Press  1 , then click a place",
        "to grapple onto.",
        "Use it with your Bio Arm!",
      ]
    : [
        "GRAPPLING HOOK MANEUVER",
        "",
        "You need the Bio Arm to use this.",
        "Go back and get it first!",
      ];

  const bw = Math.min(520, W * 0.8);
  const bh = 220;
  const x = (W - bw) / 2;
  const y = (H - bh) / 2;

  ctx.fillStyle = "rgba(5,10,16,0.92)";
  ctx.strokeStyle = "#7affde";
  ctx.lineWidth = 3;
  roundRect(x, y, bw, bh, 12);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => {
    if (i === 0) {
      ctx.fillStyle = "#7affde";
      ctx.font = "bold 22px system-ui, sans-serif";
    } else {
      ctx.fillStyle = "#e8f0e8";
      ctx.font = "18px system-ui, sans-serif";
    }
    ctx.fillText(line, W / 2, y + 44 + i * 32);
  });

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("press I to close", W / 2, y + bh - 18);
}

function drawCrackedWall(w: Wall, floorY: number): void {
  const top = floorY - WALL_H;
  const broken = 1 - w.hp / w.maxHp;

  ctx.fillStyle = "#4a4458";
  ctx.fillRect(w.x - WALL_HALF, top, WALL_HALF * 2, WALL_H);
  ctx.fillStyle = "#39344a";
  ctx.fillRect(w.x - WALL_HALF, top, WALL_HALF * 2, 8 * GIANT);
  // brick lines
  ctx.strokeStyle = "rgba(20,18,30,0.5)";
  ctx.lineWidth = GIANT;
  for (let by = top + 24 * GIANT; by < floorY; by += 24 * GIANT) {
    ctx.beginPath();
    ctx.moveTo(w.x - WALL_HALF, by);
    ctx.lineTo(w.x + WALL_HALF, by);
    ctx.stroke();
  }

  // cracks: jagged lines from the center, more as it breaks
  ctx.strokeStyle = "#15121f";
  ctx.lineWidth = 2 * GIANT;
  const cy = top + WALL_H * 0.45;
  const crackCount = 2 + Math.floor(broken * 4);
  for (let i = 0; i < crackCount; i++) {
    const ang = (i / crackCount) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(w.x, cy);
    let cx = w.x;
    let ccy = cy;
    for (let s = 0; s < 3; s++) {
      cx += (Math.cos(ang) * 10 + Math.sin(i * 3 + s) * 4) * GIANT;
      ccy += (Math.sin(ang) * 10 + Math.cos(i * 2 + s) * 4) * GIANT;
      ctx.lineTo(cx, ccy);
    }
    ctx.stroke();
  }

  // a hole that grows open as you drill through
  if (broken > 0.15) {
    const hole = (broken - 0.15) * (WALL_HALF + 6 * GIANT);
    ctx.fillStyle = "#0a0810";
    ctx.beginPath();
    ctx.ellipse(w.x, cy, hole, hole * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDrill(): void {
  const floorY = H * GROUND_FRAC;
  drawLabRoom(DRILL_WIDTH, floorY);

  const u = Math.max(4, Math.min(W, H) / 90);

  ctx.save();
  ctx.translate(-camX, 0);
  for (const w of walls) {
    if (w.hp > 0) drawCrackedWall(w, floorY);
  }
  drawParticles();
  ctx.restore();

  // hero with bio arm
  drawCharacter(heroX - camX, floorY + 6, u, HERO, heroFacing, "bio");

  // spinning drill bit on the bio arm while drilling
  if (drillingNow) {
    const bx = heroX - camX + (heroFacing ? 1 : -1) * 10 * u;
    const by = floorY - 12 * u;
    ctx.save();
    ctx.translate(bx, by);
    if (!heroFacing) ctx.scale(-1, 1);
    ctx.scale(GIANT, GIANT);
    ctx.fillStyle = "#9aa7ad";
    ctx.fillRect(0, -3, 16, 6);
    ctx.fillStyle = Math.floor(performance.now() / 40) % 2 ? "#cfe9ff" : "#9fc4e0";
    ctx.beginPath();
    ctx.moveTo(16, -7);
    ctx.lineTo(30, 0);
    ctx.lineTo(16, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // intro banner
  if (drillBannerT < 4) {
    const a = drillBannerT < 3 ? 1 : 4 - drillBannerT;
    ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
    ctx.fillRect(0, H / 2 - 56, W, 112);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(122,255,222,${a})`;
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText("DRILL MANEUVER", W / 2, H / 2 - 14);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("Hold  2  to drill through cracked walls!", W / 2, H / 2 + 22);
  }

  // control hint
  ctx.fillStyle = "rgba(158,255,160,0.7)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("← → / A D  move    ·    hold  2  to drill", 18, 56);
}

// A pair of spring shoes. (x, yFeet) is on the ground; coils underneath the boots.
function drawSpringShoes(x: number, yFeet: number, s: number): void {
  for (const dx of [-9 * s, 9 * s]) {
    // coil spring
    ctx.strokeStyle = "#9aa7ad";
    ctx.lineWidth = 2 * GIANT;
    ctx.beginPath();
    const baseY = yFeet;
    const topY = yFeet - 12 * s;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const yy = baseY + (topY - baseY) * t;
      const xx = x + dx + (i % 2 === 0 ? -4 * s : 4 * s);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    // boot
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(x + dx - 7 * s, yFeet - 20 * s, 14 * s, 9 * s);
    ctx.fillStyle = "#7a241a";
    ctx.fillRect(x + dx - 7 * s, yFeet - 13 * s, 14 * s, 2 * s);
  }
}

// Spring shoes worn on the hero's feet: red boots with a coil under each foot.
// yTop = bottom of the (lifted) character; yBottom = the ground the springs sit on.
function drawWornSprings(x: number, yTop: number, yBottom: number, u: number): void {
  for (const dx of [-2 * u, 2 * u]) {
    // coil spring from the foot down to the ground
    ctx.strokeStyle = "#aeb8bd";
    ctx.lineWidth = Math.max(2, u * 0.5);
    ctx.beginPath();
    const segs = 5;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const yy = yTop + (yBottom - yTop) * t;
      const xx = x + dx + (i % 2 === 0 ? -1.4 * u : 1.4 * u);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    // red boot over the foot
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(x + dx - 2 * u, yTop - 2 * u, 4 * u, 2.5 * u);
    ctx.fillStyle = "#7a241a";
    ctx.fillRect(x + dx - 2 * u, yTop - 0.5 * u, 4 * u, 0.6 * u);
  }
}

function drawSprings(): void {
  const floorY = H * GROUND_FRAC;

  // brighter, hopeful room
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#10131f");
  g.addColorStop(1, "#1c2433");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(-camX, 0);

  // floor
  ctx.fillStyle = "#141a26";
  ctx.fillRect(0, floorY, SPRINGS_WIDTH, H - floorY);
  ctx.strokeStyle = "rgba(122,255,222,0.07)";
  ctx.lineWidth = 2 * GIANT;
  for (let fx = 0; fx < SPRINGS_WIDTH; fx += 90 * GIANT) {
    ctx.beginPath();
    ctx.moveTo(fx, floorY);
    ctx.lineTo(fx, H);
    ctx.stroke();
  }

  // platforms
  const gs = GIANT;
  for (const p of springPlatforms) {
    ctx.fillStyle = "#2a3650";
    ctx.fillRect(p.x, floorY - p.top, p.w, 16 * gs);
    ctx.fillStyle = "#3d4f74";
    ctx.fillRect(p.x, floorY - p.top, p.w, 4 * gs);
    ctx.fillStyle = "rgba(42,54,80,0.5)";
    ctx.fillRect(p.x + p.w / 2 - 4 * gs, floorY - p.top + 16 * gs, 8 * gs, p.top - 16 * gs);
  }

  // exit doorway on the high ledge
  const ex = SPRING_EXIT.x + SPRING_EXIT.w / 2;
  const eTop = floorY - SPRING_EXIT.top;
  ctx.fillStyle = "#7affde";
  ctx.fillRect(ex - 26 * gs, eTop - 70 * gs, 52 * gs, 70 * gs);
  ctx.fillStyle = "#0a0810";
  ctx.fillRect(ex - 18 * gs, eTop - 60 * gs, 36 * gs, 60 * gs);
  ctx.fillStyle = "#7affde";
  ctx.font = `bold ${13 * gs}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("EXIT", ex, eTop - 76 * gs);

  // the spring shoes on the ground (until grabbed)
  if (!hasSpringShoes) {
    const glow = ctx.createRadialGradient(SHOES_X, floorY - 20 * gs, 4 * gs, SHOES_X, floorY - 20 * gs, 90 * gs);
    glow.addColorStop(0, "rgba(255,120,90,0.35)");
    glow.addColorStop(1, "rgba(255,120,90,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(SHOES_X - 90 * gs, floorY - 110 * gs, 180 * gs, 130 * gs);
    drawSpringShoes(SHOES_X, floorY, 1.4 * gs);
  }

  drawParticles();
  ctx.restore();

  // hero — once the shoes are on, stand up on the springs (feet lifted, coils beneath)
  const u = Math.max(4, Math.min(W, H) / 90);
  const yGround = floorY - heroY + 6; // where the feet rest
  const lift = hasSpringShoes ? u * 4 : 0;
  const hx = heroX - camX;
  drawCharacter(hx, yGround - lift, u, HERO, heroFacing, "bio");
  if (hasSpringShoes) {
    drawWornSprings(hx, yGround - lift, yGround, u);
  }

  // control hint
  ctx.fillStyle = "rgba(158,255,160,0.7)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const hint = hasSpringShoes
    ? "← → move    ·    SPACE / ↑  jump    ·    press again to DOUBLE JUMP"
    : "← → / A D  move    ·    grab the Spring Shoes →";
  ctx.fillText(hint, 18, 56);

  // pickup banner
  if (hasSpringShoes && springBannerT < 4.5) {
    const a = springBannerT < 3.5 ? 1 : (4.5 - springBannerT) / 1;
    ctx.fillStyle = `rgba(0,0,0,${0.5 * a})`;
    ctx.fillRect(0, H / 2 - 60, W, 120);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,150,120,${a})`;
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillText("SPRING SHOES!", W / 2, H / 2 - 16);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillText("Press SPACE / ↑ to jump — press again to DOUBLE JUMP!", W / 2, H / 2 + 22);
  }

  if (reachedSpringsEnd && fade < 0.2) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#7affde";
    ctx.font = "bold 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("To be continued...", W / 2, H / 2);
  }
}

// A small glowing knife. (x, yTip) is the top of the blade; grows downward.
function drawKnife(x: number, yTip: number, s: number, flip: boolean): void {
  ctx.save();
  ctx.translate(x, yTip);
  if (flip) ctx.scale(-1, 1);
  // blade
  ctx.fillStyle = "#cfe9ff";
  ctx.fillRect(-3 * s, 0, 6 * s, 34 * s);
  ctx.fillStyle = "#9fc4e0";
  ctx.fillRect(0, 0, 3 * s, 34 * s);
  // edge glint
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3 * s, 0, 2 * s, 34 * s);
  // guard
  ctx.fillStyle = "#3a3358";
  ctx.fillRect(-9 * s, 34 * s, 18 * s, 5 * s);
  // handle
  ctx.fillStyle = "#5a3a1a";
  ctx.fillRect(-3 * s, 39 * s, 6 * s, 16 * s);
  ctx.restore();
}

// Repeating ground features drawn in world space so they scroll past the player.
function drawGroundDetail(groundY: number): void {
  const g = GIANT;
  const tile = 120 * g;
  const startX = Math.floor(camX / tile) * tile - tile;
  const endX = camX + W + tile;

  for (let wx = startX; wx < endX; wx += tile) {
    // deterministic "random" per tile so it doesn't flicker
    const seed = Math.abs(Math.sin(wx * 0.013)) ;

    // grass tuft
    ctx.fillStyle = "#2c4a2c";
    const gx = wx + 30 * g;
    ctx.fillRect(gx, groundY - 10 * g, 4 * g, 10 * g);
    ctx.fillRect(gx + 5 * g, groundY - 14 * g, 4 * g, 14 * g);
    ctx.fillRect(gx + 10 * g, groundY - 8 * g, 4 * g, 8 * g);

    // a rock every few tiles
    if (seed > 0.6) {
      ctx.fillStyle = "#3a3f46";
      ctx.fillRect(wx + 70 * g, groundY - 12 * g, 22 * g, 12 * g);
      ctx.fillStyle = "#2a2e34";
      ctx.fillRect(wx + 70 * g, groundY - 12 * g, 22 * g, 4 * g);
    }

    // dashed path line on the ground
    ctx.fillStyle = "rgba(120,150,120,0.25)";
    ctx.fillRect(wx + 50 * g, groundY + 18 * g, 50 * g, 4 * g);
  }

  // distance markers counting toward the building
  ctx.fillStyle = "rgba(158,255,160,0.35)";
  ctx.font = `${12 * g}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (let mx = 400; mx < BUILDING_WORLD_X; mx += 400) {
    ctx.fillRect(mx, groundY - 40 * g, 3 * g, 40 * g);
    const metersLeft = Math.max(0, Math.round((BUILDING_WORLD_X - mx) / 100));
    ctx.fillText(`${metersLeft}m`, mx, groundY - 44 * g);
  }
}

function drawParticles(): void {
  for (const p of particles) {
    const a = 1 - p.life / p.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    const size = p.size * GIANT;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
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
