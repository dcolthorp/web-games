import { darker, type Dev1Look } from "../dev1Figure";

// A dev.1 with bones, for dev.1 Studio. He's drawn as an SVG in the same
// 90×200 box as the cutscene's dev.1, but every limb is a chain of bones that
// can bend at its joints. A pose says how far each bone is turned; frames are
// a list of poses that Play slides smoothly between.
//
// Angles are in degrees. 0 means a bone points straight down from its joint,
// and each bone's angle is counted from the bone before it, so bending an
// elbow carries the hand along with it.

export type Limb = "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
export const LIMBS: Limb[] = ["leftArm", "rightArm", "leftLeg", "rightLeg"];

export const LIMB_NAMES: Record<Limb, string> = {
  leftArm: "Left arm",
  rightArm: "Right arm",
  leftLeg: "Left leg",
  rightLeg: "Right leg",
};

/** How long each bone of each limb is. Adding a joint splits a bone in two. */
export type Skeleton = Record<Limb, number[]>;

export interface Pose {
  body: number;
  head: number;
  limbs: Record<Limb, number[]>;
  // Where he stands on the stage in this frame, in percent. Frames that
  // don't say use wherever the dev.1 itself is.
  x?: number;
  y?: number;
  // Which way he faces, in degrees: 0 looks at you, 90 and -90 are the two
  // sides, and 180 shows his back.
  facing?: number;
  // How far he's turned round like a wheel, in degrees: 180 is upside down.
  // Blends the long way too, so 0 to 360 is a whole cartwheel.
  rotation?: number;
  // How big it is in this frame, on top of its size bars. 1 is normal.
  scale?: number;
  // Teleport instead of gliding from this frame to the next one.
  cut?: boolean;
  // Switch the whole stage to this background when Play reaches this frame.
  stage?: string;
}

// Every dev.1 starts with elbows and knees, so arms and legs can bend in the
// middle straight away.
export const DEFAULT_SKELETON: Skeleton = {
  leftArm: [32, 32],
  rightArm: [32, 32],
  leftLeg: [31, 31],
  rightLeg: [31, 31],
};

// Where each limb is joined on: shoulders on the body, hips at the bottom.
// Turned to the side he's narrower, so they squeeze in towards the middle.
function roots(facing: number): Record<Limb, [number, number]> {
  const wide = Math.abs(Math.cos((facing * Math.PI) / 180));
  const shoulders = 35 * (0.3 + 0.7 * wide);
  const hips = 13 * (0.4 + 0.6 * wide);
  return {
    leftArm: [45 - shoulders, 70],
    rightArm: [45 + shoulders, 70],
    leftLeg: [45 - hips, 138],
    rightLeg: [45 + hips, 138],
  };
}
const HIP: [number, number] = [45, 140];
const NECK: [number, number] = [45, 60];

export function restPose(skeleton: Skeleton): Pose {
  return {
    body: 0,
    head: 0,
    limbs: {
      leftArm: skeleton.leftArm.map((_, i) => (i === 0 ? 8 : 0)),
      rightArm: skeleton.rightArm.map((_, i) => (i === 0 ? -8 : 0)),
      leftLeg: skeleton.leftLeg.map(() => 0),
      rightLeg: skeleton.rightLeg.map(() => 0),
    },
  };
}

export function copyPose(pose: Pose): Pose {
  return {
    body: pose.body,
    head: pose.head,
    x: pose.x,
    y: pose.y,
    facing: pose.facing,
    rotation: pose.rotation,
    scale: pose.scale,
    limbs: {
      leftArm: [...pose.limbs.leftArm],
      rightArm: [...pose.limbs.rightArm],
      leftLeg: [...pose.limbs.leftLeg],
      rightLeg: [...pose.limbs.rightLeg],
    },
  };
}

/** Blends from one pose to the next. `k` 0 is `from`, 1 is `to`. */
export function blendPoses(from: Pose, to: Pose, k: number): Pose {
  const mix = (a: number, b: number): number => a + (b - a) * k;
  const limbs = {} as Record<Limb, number[]>;
  for (const limb of LIMBS) limbs[limb] = from.limbs[limb].map((angle, i) => mix(angle, to.limbs[limb][i] ?? angle));
  const spot = (a: number | undefined, b: number | undefined): number | undefined =>
    a === undefined ? b : b === undefined ? a : mix(a, b);
  // Turning goes the short way round, so 170° to -170° is a small turn.
  const facingFrom = from.facing ?? 0;
  const facingTurn = clampAngle((to.facing ?? 0) - facingFrom);
  return {
    body: mix(from.body, to.body),
    head: mix(from.head, to.head),
    limbs,
    x: spot(from.x, to.x),
    y: spot(from.y, to.y),
    facing: from.facing === undefined && to.facing === undefined ? undefined : facingFrom + facingTurn * k,
    rotation: from.rotation === undefined && to.rotation === undefined ? undefined : mix(from.rotation ?? 0, to.rotation ?? 0),
    scale: from.scale === undefined && to.scale === undefined ? undefined : mix(from.scale ?? 1, to.scale ?? 1),
  };
}

/**
 * Adds a joint to a limb by cutting its longest bone in half. The new joint
 * starts straight, so nothing moves until you bend it.
 */
export function addJoint(skeleton: Skeleton, frames: Pose[], limb: Limb): void {
  const bones = skeleton[limb];
  let longest = 0;
  bones.forEach((length, i) => {
    if (length > (bones[longest] ?? 0)) longest = i;
  });
  const half = (bones[longest] ?? 0) / 2;
  bones.splice(longest, 1, half, half);
  for (const frame of frames) frame.limbs[limb].splice(longest + 1, 0, 0);
}

// ── Where everything is ───────────────────────────────────────────────────

type Point = [number, number];

function turn(point: Point, around: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  const dx = point[0] - around[0];
  const dy = point[1] - around[1];
  return [around[0] + dx * Math.cos(a) - dy * Math.sin(a), around[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** Every joint along a limb, from where it's attached to its tip. */
export function limbPoints(skeleton: Skeleton, pose: Pose, limb: Limb): { points: Point[]; angles: number[] } {
  const isArm = limb === "leftArm" || limb === "rightArm";
  // Arms ride on the body, so leaning the body swings them round too.
  const root = roots(pose.facing ?? 0)[limb];
  let start: Point = isArm ? turn(root, HIP, pose.body) : root;
  let angle = isArm ? pose.body : 0;
  const points: Point[] = [start];
  const angles: number[] = [];
  skeleton[limb].forEach((length, i) => {
    angle += pose.limbs[limb][i] ?? 0;
    angles.push(angle);
    const a = (angle * Math.PI) / 180;
    // 0° points down; turning clockwise on screen swings it to the left.
    start = [start[0] - Math.sin(a) * length, start[1] + Math.cos(a) * length];
    points.push(start);
  });
  return { points, angles };
}

// ── Drawing ───────────────────────────────────────────────────────────────

const SVG = "http://www.w3.org/2000/svg";

export function makeRig(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "rig");
  svg.setAttribute("viewBox", "-60 -50 210 300");
  svg.setAttribute("width", "210");
  svg.setAttribute("height", "300");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "A dev.1 in a hoodie");
  return svg;
}

function eyesMarkup(pattern: string, centre = 45, squash = 1): string {
  const step = 3;
  let marks = "";
  [...pattern].forEach((mark, i) => {
    const x = i * step;
    if (mark === "\\") marks += `<line x1="${x}" y1="1" x2="${x + step}" y2="11" />`;
    else if (mark === "/") marks += `<line x1="${x}" y1="11" x2="${x + step}" y2="1" />`;
    else if (mark === "<") {
      marks += `<polygon points="${x},6 ${x + step},0.5 ${x + step * 2},6 ${x + step},11.5" fill="#e0182d" stroke="#000" stroke-width="1" />`;
    }
  });
  const patternWidth = Math.max(1, pattern.length) * step;
  const width = 34 * squash;
  return `<svg x="${centre - width / 2}" y="27" width="${width}" height="11" viewBox="-1 0 ${patternWidth + 2} 12" preserveAspectRatio="none" overflow="visible" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${marks}</svg>`;
}

function bones(points: Point[], width: number, colour: string): string {
  const path = points.map((p) => p.join(",")).join(" ");
  return (
    `<polyline points="${path}" fill="none" stroke="#04110a" stroke-width="${width + 6}" stroke-linecap="round" stroke-linejoin="round" />` +
    `<polyline points="${path}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`
  );
}

/**
 * Draws the dev.1 in a pose. With `handles` on, every joint gets a yellow dot
 * to drag, plus one on the head and one on the shoulders to lean the body.
 */
export function drawRig(svg: SVGSVGElement, look: Dev1Look, skeleton: Skeleton, pose: Pose, handles: boolean): void {
  const dark = darker(look.hoodie);
  const facing = ((pose.facing ?? 0) * Math.PI) / 180;
  const front = Math.cos(facing); // 1 facing you, -1 facing away
  const side = Math.sin(facing); // which way he's turned
  const wide = Math.abs(front);
  const legs = (["leftLeg", "rightLeg"] as const).map((limb) => bones(limbPoints(skeleton, pose, limb).points, 18, "#1b2430")).join("");
  const arm = (limb: Limb): string => bones(limbPoints(skeleton, pose, limb).points, 14, dark);
  // Side on, the far arm goes behind his body.
  const farArm: Limb | null = Math.abs(side) > 0.3 ? (side > 0 ? "leftArm" : "rightArm") : null;

  const bodyWidth = 74 * (0.62 + 0.38 * wide);
  const pocketWidth = 40 * front;
  const pocket =
    front > 0.15
      ? `<rect x="${45 + side * 14 - pocketWidth / 2}" y="112" width="${pocketWidth}" height="18" rx="5" fill="none" stroke="${dark}" stroke-width="3" />`
      : "";
  // From behind there's just the back of the hood and a seam down the hoodie.
  const backSeam = front < -0.15 ? `<line x1="45" y1="64" x2="45" y2="136" stroke="${dark}" stroke-width="3" />` : "";

  let markup = legs + (farArm ? arm(farArm) : "");
  // The body and everything on it lean together around the hips.
  markup += `<g transform="rotate(${pose.body} ${HIP[0]} ${HIP[1]})">
    <rect x="${45 - bodyWidth / 2}" y="58" width="${bodyWidth}" height="84" rx="16" fill="${look.hoodie}" stroke="#04110a" stroke-width="3" />
    ${pocket}${backSeam}
  </g>`;
  markup += LIMBS.filter((limb) => limb.endsWith("Arm") && limb !== farArm).map(arm).join("");

  // The face slides round the hood as he turns, and is gone from behind.
  const hoodWidth = 60 * (0.8 + 0.2 * wide);
  // Side on you still see half his face, peeking out at the edge of the hood.
  const faceSquash = Math.max(0.45, front);
  const faceX = 45 + side * 18;
  const face =
    front > -0.05
      ? `<ellipse cx="${faceX}" cy="32" rx="${22 * faceSquash}" ry="22" fill="${look.skin}" stroke="${dark}" stroke-width="3" />${eyesMarkup(look.eyes, faceX, faceSquash)}`
      : `<path d="M45 6 Q38 32 45 58" fill="none" stroke="${dark}" stroke-width="3" />`;
  // The head tilts at the neck, on top of however the body leans.
  markup += `<g transform="rotate(${pose.body} ${HIP[0]} ${HIP[1]}) rotate(${pose.head} ${NECK[0]} ${NECK[1]})">
    <rect x="${45 - hoodWidth / 2}" y="0" width="${hoodWidth}" height="64" rx="28" fill="${look.hoodie}" stroke="#04110a" stroke-width="3" />
    ${face}
  </g>`;

  if (handles) {
    const dot = (point: Point, data: string): string =>
      `<circle class="rig-handle" ${data} cx="${point[0]}" cy="${point[1]}" r="7" />`;
    for (const limb of LIMBS) {
      const { points } = limbPoints(skeleton, pose, limb);
      // A dot at the end of every bone: drag it to turn that bone.
      points.slice(1).forEach((point, bone) => (markup += dot(point, `data-limb="${limb}" data-bone="${bone}"`)));
    }
    markup += dot(turn(turn([45, 2], NECK, pose.head), HIP, pose.body), 'data-part="head"');
    markup += dot(turn([45, 62], HIP, pose.body), 'data-part="body"');
  }
  svg.innerHTML = markup;
}

/** Turns the bone (or head, or body) a handle belongs to so it points at `to`. */
export function dragHandle(skeleton: Skeleton, pose: Pose, handle: SVGElement, to: Point): void {
  const part = handle.getAttribute("data-part");
  if (part === "body") {
    pose.body = clampAngle((Math.atan2(to[0] - HIP[0], HIP[1] - to[1]) * 180) / Math.PI);
    return;
  }
  if (part === "head") {
    const neck = turn(NECK, HIP, pose.body);
    const absolute = (Math.atan2(to[0] - neck[0], neck[1] - to[1]) * 180) / Math.PI;
    // Only a tilt: turning all the way round is what Facing is for, and an
    // upside-down head would be a horror story.
    pose.head = Math.max(-60, Math.min(60, clampAngle(absolute - pose.body)));
    return;
  }
  const limb = handle.getAttribute("data-limb") as Limb | null;
  const bone = Number(handle.getAttribute("data-bone"));
  if (!limb || !LIMBS.includes(limb)) return;
  const { points, angles } = limbPoints(skeleton, pose, limb);
  const start = points[bone];
  if (!start) return;
  // The angle the bone should point at, then take off what the bones before
  // it already turned.
  const absolute = (Math.atan2(-(to[0] - start[0]), to[1] - start[1]) * 180) / Math.PI;
  const before = (angles[bone] ?? 0) - (pose.limbs[limb][bone] ?? 0);
  pose.limbs[limb][bone] = clampAngle(absolute - before);
}

// Keeps angles between -180 and 180, so blending goes the short way round.
function clampAngle(degrees: number): number {
  let a = degrees % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
