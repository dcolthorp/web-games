import type { GrowthStage } from "../model/types";

const STAGE_TIER: Record<GrowthStage, number> = {
  egg: 0,
  baby: 1,
  child: 2,
  teen: 3,
  monster: 4,
  shadow: 5,
  specter: 5,
  wraith: 6,
  phantom: 6,
  revenant: 7,
  nightmare: 7,
  void_walker: 8,
  abyss: 8,
  eldritch: 9,
  corrupted: 9,
  xyy4: 9,
};

interface Pose {
  bob: number;
  sway: number;
  torsoTilt: number;
  headTilt: number;
  headLift: number;
  armL: { x: number; y: number };
  armR: { x: number; y: number };
  legL: { x: number; y: number };
  legR: { x: number; y: number };
  jitter: number;
  pallor: number;
  glow: number;
  inverted: boolean;
  flickerStrobe: number;
}

function stepFn(t: number, period: number, levels: number): number {
  const phase = (t / period) % 1;
  const idx = Math.floor(phase * levels);
  return idx / (levels - 1);
}

function effectiveTier(stage: GrowthStage, carePoints: number): number {
  const base = STAGE_TIER[stage] ?? 1;
  if (stage !== "monster") return base;
  // Once at monster, every 40 carePoints pushes the dance to the next tier.
  return Math.min(9, base + Math.floor(Math.max(0, carePoints) / 40));
}

function computePose(stage: GrowthStage, carePoints: number, t: number, size: number): Pose {
  const tier = effectiveTier(stage, carePoints);
  switch (tier) {
    case 0:
      return eggPose(t, size);
    case 1:
      return babyPose(t, size);
    case 2:
      return childPose(t, size);
    case 3:
      return teenPose(t, size);
    case 4:
      return monsterPose(t, size);
    case 5:
      return shadowPose(t, size);
    case 6:
      return wraithPose(t, size);
    case 7:
      return revenantPose(t, size);
    case 8:
      return abyssPose(t, size);
    default:
      return finalPose(t, size);
  }
}

function eggPose(t: number, size: number): Pose {
  return {
    bob: Math.sin(t * 2) * 1.5,
    sway: Math.sin(t * 1.5) * 2,
    torsoTilt: Math.sin(t * 1.2) * 0.04,
    headTilt: 0,
    headLift: 0,
    armL: { x: -size * 0.22, y: size * 0.05 },
    armR: { x: size * 0.22, y: size * 0.05 },
    legL: { x: -size * 0.07, y: size * 0.5 },
    legR: { x: size * 0.07, y: size * 0.5 },
    jitter: 0,
    pallor: 0.02,
    glow: 0,
    inverted: false,
    flickerStrobe: 0,
  };
}

function babyPose(t: number, size: number): Pose {
  // Arms-up cheerleader sway
  const sway = Math.sin(t * 2.0) * size * 0.05;
  const armBounce = Math.sin(t * 4.0) * size * 0.04;
  return {
    bob: Math.abs(Math.sin(t * 3.0)) * 4,
    sway: sway * 2,
    torsoTilt: Math.sin(t * 2.0) * 0.06,
    headTilt: Math.sin(t * 2.0) * 0.12,
    headLift: 0,
    armL: { x: -size * 0.18, y: -size * 0.28 + armBounce },
    armR: { x: size * 0.18, y: -size * 0.28 - armBounce },
    legL: { x: -size * 0.07, y: size * 0.5 },
    legR: { x: size * 0.07, y: size * 0.5 },
    jitter: 0.3,
    pallor: 0.08,
    glow: 0,
    inverted: false,
    flickerStrobe: 0,
  };
}

function childPose(t: number, size: number): Pose {
  // Disco point — one arm up, one out, alternating
  const phase = (t * 1.6) % (Math.PI * 2);
  const pointing = Math.sin(phase) > 0;
  const armUp = pointing ? -size * 0.36 : size * 0.05;
  const armOut = pointing ? size * 0.05 : -size * 0.36;
  const hipSway = Math.sin(t * 3.2) * size * 0.06;
  return {
    bob: Math.abs(Math.sin(t * 3.2)) * 5,
    sway: Math.sin(t * 1.6) * size * 0.08,
    torsoTilt: hipSway / size * 0.4,
    headTilt: Math.sin(t * 1.6) * 0.18,
    headLift: 0,
    armL: { x: -size * 0.30, y: armUp },
    armR: { x: size * 0.30, y: armOut },
    legL: { x: -size * 0.08 + hipSway * 0.3, y: size * 0.5 },
    legR: { x: size * 0.08 + hipSway * 0.3, y: size * 0.5 },
    jitter: 0.8,
    pallor: 0.18,
    glow: 0,
    inverted: false,
    flickerStrobe: 0,
  };
}

function teenPose(t: number, size: number): Pose {
  // Robot dance — limbs snap to 90° positions every 0.4s
  const armChoice = Math.floor((t / 0.4) % 4);
  const headChoice = Math.floor((t / 0.6) % 3);
  const armPositions: { l: { x: number; y: number }; r: { x: number; y: number } }[] = [
    { l: { x: -size * 0.32, y: 0 }, r: { x: size * 0.32, y: 0 } },
    { l: { x: -size * 0.10, y: -size * 0.38 }, r: { x: size * 0.32, y: 0 } },
    { l: { x: -size * 0.32, y: 0 }, r: { x: size * 0.10, y: -size * 0.38 } },
    { l: { x: -size * 0.32, y: size * 0.22 }, r: { x: size * 0.32, y: size * 0.22 } },
  ];
  const headTilts = [-0.35, 0, 0.35];
  const armPos = armPositions[armChoice]!;
  return {
    bob: Math.floor((t * 4) % 2) === 0 ? 0 : 4,
    sway: 0,
    torsoTilt: 0,
    headTilt: headTilts[headChoice]!,
    headLift: 0,
    armL: armPos.l,
    armR: armPos.r,
    legL: { x: -size * 0.08, y: size * 0.5 },
    legR: { x: size * 0.08, y: size * 0.5 },
    jitter: 0.4,
    pallor: 0.35,
    glow: 0.1,
    inverted: false,
    flickerStrobe: 0,
  };
}

function monsterPose(t: number, size: number): Pose {
  // Possessed convulsion — flailing
  const flailL = Math.sin(t * 5.5);
  const flailR = Math.cos(t * 4.7 + 0.7);
  const wave = Math.sin(t * 6.3);
  return {
    bob: Math.sin(t * 3.0) * 8,
    sway: Math.sin(t * 1.9) * size * 0.10,
    torsoTilt: Math.sin(t * 1.3) * 0.3,
    headTilt: Math.sin(t * 4.2) * 0.7,
    headLift: Math.sin(t * 2.1) * size * 0.04,
    armL: { x: -size * (0.18 + flailL * 0.2), y: size * (-0.05 + flailL * 0.35) },
    armR: { x: size * (0.18 + flailR * 0.2), y: size * (-0.05 + flailR * 0.35) },
    legL: { x: -size * 0.08 + wave * size * 0.05, y: size * 0.5 },
    legR: { x: size * 0.08 - wave * size * 0.05, y: size * 0.5 },
    jitter: 3.0,
    pallor: 0.6,
    glow: 0.2,
    inverted: false,
    flickerStrobe: 0,
  };
}

function shadowPose(t: number, size: number): Pose {
  // Slow oozing dread; arms drift up like a marionette
  const drift = Math.sin(t * 0.9);
  return {
    bob: Math.sin(t * 0.7) * 6,
    sway: Math.sin(t * 0.5) * size * 0.06,
    torsoTilt: Math.sin(t * 0.6) * 0.18,
    headTilt: Math.sin(t * 0.4) * 0.9,
    headLift: 0,
    armL: { x: -size * 0.10, y: -size * 0.45 - drift * size * 0.05 },
    armR: { x: size * 0.10, y: -size * 0.45 + drift * size * 0.05 },
    legL: { x: -size * 0.06, y: size * 0.5 },
    legR: { x: size * 0.06, y: size * 0.5 },
    jitter: 1.2,
    pallor: 0.72,
    glow: 0.35,
    inverted: false,
    flickerStrobe: 0,
  };
}

function wraithPose(t: number, size: number): Pose {
  // Limbs reaching the wrong directions; head floating
  const reach = Math.sin(t * 1.4);
  return {
    bob: Math.sin(t * 0.9) * 9,
    sway: Math.sin(t * 0.6) * size * 0.12,
    torsoTilt: Math.sin(t * 1.1) * 0.28,
    headTilt: Math.PI / 2 + Math.sin(t * 0.7) * 0.3,
    headLift: -size * 0.1,
    armL: { x: size * 0.30 + reach * size * 0.08, y: size * 0.12 },
    armR: { x: -size * 0.30 - reach * size * 0.08, y: size * 0.12 },
    legL: { x: -size * 0.05, y: size * 0.5 },
    legR: { x: size * 0.05, y: size * 0.5 },
    jitter: 2.4,
    pallor: 0.84,
    glow: 0.5,
    inverted: false,
    flickerStrobe: 0.2,
  };
}

function revenantPose(t: number, size: number): Pose {
  // Stop-motion frames jumping every 0.18s
  const frame = Math.floor(t / 0.18) % 6;
  const frames: { armL: { x: number; y: number }; armR: { x: number; y: number }; legL: { x: number; y: number }; legR: { x: number; y: number }; tilt: number; head: number }[] = [
    { armL: { x: -size * 0.35, y: -size * 0.25 }, armR: { x: size * 0.18, y: size * 0.30 }, legL: { x: -size * 0.18, y: size * 0.5 }, legR: { x: size * 0.04, y: size * 0.5 }, tilt: -0.35, head: 0.7 },
    { armL: { x: -size * 0.05, y: -size * 0.45 }, armR: { x: size * 0.40, y: 0 }, legL: { x: -size * 0.10, y: size * 0.5 }, legR: { x: size * 0.18, y: size * 0.5 }, tilt: 0.1, head: -1.2 },
    { armL: { x: -size * 0.40, y: size * 0.05 }, armR: { x: size * 0.05, y: -size * 0.45 }, legL: { x: -size * 0.02, y: size * 0.5 }, legR: { x: size * 0.20, y: size * 0.5 }, tilt: 0.3, head: 0.4 },
    { armL: { x: -size * 0.15, y: size * 0.32 }, armR: { x: size * 0.36, y: -size * 0.25 }, legL: { x: -size * 0.22, y: size * 0.5 }, legR: { x: size * 0.02, y: size * 0.5 }, tilt: -0.15, head: -0.5 },
    { armL: { x: -size * 0.42, y: size * 0.10 }, armR: { x: size * 0.42, y: size * 0.10 }, legL: { x: -size * 0.04, y: size * 0.5 }, legR: { x: size * 0.16, y: size * 0.5 }, tilt: 0, head: 1.1 },
    { armL: { x: -size * 0.18, y: -size * 0.42 }, armR: { x: -size * 0.10, y: -size * 0.36 }, legL: { x: -size * 0.18, y: size * 0.5 }, legR: { x: size * 0.18, y: size * 0.5 }, tilt: -0.4, head: 0 },
  ];
  const f = frames[frame]!;
  return {
    bob: 0,
    sway: 0,
    torsoTilt: f.tilt,
    headTilt: f.head,
    headLift: 0,
    armL: f.armL,
    armR: f.armR,
    legL: f.legL,
    legR: f.legR,
    jitter: 0.6,
    pallor: 0.9,
    glow: 0.6,
    inverted: false,
    flickerStrobe: 0.35,
  };
}

function abyssPose(t: number, size: number): Pose {
  // Inverted — head down, hands stretched as legs
  const sway = Math.sin(t * 1.6) * size * 0.14;
  const reach = Math.sin(t * 2.1);
  return {
    bob: Math.sin(t * 1.2) * 6,
    sway,
    torsoTilt: Math.sin(t * 0.8) * 0.4,
    headTilt: Math.PI + Math.sin(t * 1.4) * 0.5,
    headLift: size * 0.28,
    armL: { x: -size * 0.10 + reach * size * 0.08, y: size * 0.5 },
    armR: { x: size * 0.10 - reach * size * 0.08, y: size * 0.5 },
    legL: { x: -size * 0.22, y: -size * 0.38 },
    legR: { x: size * 0.22, y: -size * 0.38 },
    jitter: 3.6,
    pallor: 0.96,
    glow: 0.75,
    inverted: true,
    flickerStrobe: 0.45,
  };
}

function finalPose(t: number, size: number): Pose {
  // Eldritch contortion + radial limb extension
  const a = t * 1.2;
  const r = size * 0.36;
  return {
    bob: Math.sin(t * 0.7) * 4,
    sway: 0,
    torsoTilt: Math.sin(t * 0.5) * 0.5,
    headTilt: a * 2,
    headLift: Math.sin(t * 0.5) * size * 0.05,
    armL: { x: Math.cos(a) * r, y: Math.sin(a) * r },
    armR: { x: Math.cos(a + Math.PI) * r, y: Math.sin(a + Math.PI) * r },
    legL: { x: Math.cos(a + Math.PI / 2) * r, y: Math.sin(a + Math.PI / 2) * r + size * 0.2 },
    legR: { x: Math.cos(a - Math.PI / 2) * r, y: Math.sin(a - Math.PI / 2) * r + size * 0.2 },
    jitter: 4.5,
    pallor: 1.0,
    glow: 1.0,
    inverted: false,
    flickerStrobe: 0.6,
  };
}

export function drawDancingMannequin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  stage: GrowthStage,
  carePoints = 0
): void {
  const t = performance.now() / 1000;
  const pose = computePose(stage, carePoints, t, size);
  const jx = pose.jitter ? Math.sin(t * 23 + Math.cos(t * 9)) * pose.jitter : 0;
  const jy = pose.jitter ? Math.cos(t * 19 + Math.sin(t * 7)) * pose.jitter : 0;
  const strobe = pose.flickerStrobe > 0 && stepFn(t, 0.12, 2) > 0.5 ? pose.flickerStrobe : 0;

  ctx.save();
  ctx.translate(x + pose.sway + jx, y + pose.bob + jy);

  const skinBase = 230 - pose.pallor * 110;
  const skin = `rgb(${(skinBase + strobe * 30) | 0}, ${(skinBase - pose.pallor * 30) | 0}, ${(skinBase - pose.pallor * 70) | 0})`;
  const outline = "rgba(15, 15, 18, 0.92)";

  // shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.55, size * 0.4, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose.glow > 0) {
    const grd = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.6);
    grd.addColorStop(0, `rgba(180, 60, 200, ${(pose.glow * 0.35).toFixed(3)})`);
    grd.addColorStop(1, "rgba(180, 60, 200, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const stage0 = effectiveTier(stage, carePoints);
  if (stage0 === 0) {
    drawEgg(ctx, size, skin, outline);
    ctx.restore();
    return;
  }

  // legs
  drawLimb(ctx, 0, size * 0.05, pose.legL.x, pose.legL.y, size * 0.09, skin, outline);
  drawLimb(ctx, 0, size * 0.05, pose.legR.x, pose.legR.y, size * 0.09, skin, outline);

  // torso
  ctx.save();
  ctx.rotate(pose.torsoTilt);
  const torsoW = size * 0.34;
  const torsoH = size * 0.36;
  const tx = -torsoW / 2;
  const ty = -size * 0.18;
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  roundRect(ctx, tx, ty, torsoW, torsoH, size * 0.06);
  ctx.fill();
  ctx.stroke();
  // seams
  ctx.strokeStyle = "rgba(40, 40, 50, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ty + 6);
  ctx.lineTo(0, ty + torsoH - 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tx + 4, ty + torsoH - 4);
  ctx.lineTo(tx + torsoW - 4, ty + torsoH - 4);
  ctx.stroke();

  // arms — shoulders are top corners of torso
  const shoulderY = ty + 4;
  const shoulderL = tx + 2;
  const shoulderR = tx + torsoW - 2;
  drawLimb(ctx, shoulderL, shoulderY, pose.armL.x, pose.armL.y, size * 0.08, skin, outline);
  drawLimb(ctx, shoulderR, shoulderY, pose.armR.x, pose.armR.y, size * 0.08, skin, outline);

  ctx.restore();

  // head
  ctx.save();
  ctx.translate(0, -size * 0.22 + pose.headLift);
  ctx.rotate(pose.headTilt);
  ctx.fillStyle = skin;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  const headR = size * 0.16;
  ctx.beginPath();
  ctx.ellipse(0, 0, headR * 0.9, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (pose.pallor > 0.2) {
    ctx.fillStyle = `rgba(15, 15, 18, ${Math.min(1, pose.pallor * 1.6)})`;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.32, -headR * 0.1, headR * 0.16, headR * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(headR * 0.32, -headR * 0.1, headR * 0.16, headR * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pose.pallor > 0.45) {
    ctx.strokeStyle = "rgba(70, 0, 0, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.45, headR * 0.35);
    ctx.lineTo(headR * 0.45, headR * 0.35);
    ctx.stroke();
  }
  if (pose.pallor > 0.7) {
    // teeth ticks
    ctx.strokeStyle = "rgba(180, 180, 190, 0.85)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, headR * 0.3);
      ctx.lineTo(i * 3, headR * 0.42);
      ctx.stroke();
    }
  }
  // neck joint
  ctx.fillStyle = "rgba(15, 15, 18, 0.55)";
  ctx.beginPath();
  ctx.arc(0, headR * 0.95, headR * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawEgg(ctx: CanvasRenderingContext2D, size: number, fill: string, outline: string): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.28, size * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  fill: string,
  outline: string
): void {
  ctx.save();
  ctx.strokeStyle = fill;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.fillStyle = "rgba(15, 15, 18, 0.6)";
  ctx.beginPath();
  ctx.arc(x2, y2, thickness * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
