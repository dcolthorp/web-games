import { FirstPerson, type Camera } from "./fp3d";
import type { Part, Vec3 } from "./render3d";
import { worldFaces } from "./render3d";
import { playSound } from "./sounds";
import { makeModels } from "./models";
import { formatMoney, save, state } from "./state";

// Outside the window (after the purple key unlocks it): the city in first
// person 3D. Walk around and you'll see your house, your job's building,
// the Dollhouse Builder, the Lab, and a Bank that isn't on the car map.
// Somewhere there's an elevator. Find it and press UP, and it opens onto a
// little platform in the sky with some C4 on it. The heist: grab the C4,
// ride down, go into the Bank, open the TOP SECRET door with the Sky Key
// (from the top of the Jetpack Climb), blow up the safe, take the diamond.
// Then the story: sell the diamond at the Farmers Market for 10 gold bars,
// deposit them at the Bank (the bank keeper runs off with them), deal with
// the robber at your house (he blasts off holding the Doomsday Device and
// your dinos fetch his stuff), sell his stuff, and open the Amazon package
// that turns up at home. Inside: "Find the Void Key". (To be continued!)

const W = 900;
const H = 506;
const EYE = 1.6;
const SPEED = 7;
const TURN = 2.2;
const RADIUS = 0.6;
const SKY: [string, string] = ["#7fc0f0", "#e0f2ff"];
const FOG: Vec3 = [214, 236, 252];
const ELEVATOR = { x: 52, z: -33 };

const B = (p: Vec3, k: Vec3, c: string): Part => ({ s: "box", p, k, c });
const C = (p: Vec3, k: Vec3, c: string, n = 10): Part => ({ s: "cylinder", p, k, c, n });
const K = (p: Vec3, k: Vec3, c: string, n = 10): Part => ({ s: "cone", p, k, c, n });
const S = (p: Vec3, k: Vec3, c: string, n = 10): Part => ({ s: "sphere", p, k, c, n });
const R = (p: Vec3, k: Vec3, c: string): Part => ({ s: "roof", p, k, c });

interface Sign {
  text: string;
  at: Vec3;
  light?: "red" | "glow" | "amazon"; // a blinking red light, a sparkle, or the Amazon logo, instead of words
}

type Scene = "street" | "sky" | "bank";
type Box2D = { x0: number; x1: number; z0: number; z1: number };

const SKY_HIGH: [string, string] = ["#4a8ad8", "#cfe8ff"];
const BANK_FOG: Vec3 = [220, 214, 200];
const SKY_FOG: Vec3 = [190, 220, 248];
const PLATFORM = 6.3; // how far you can walk from the middle before the railing
const SKY_DOORS = { x: 0, z: 6.6 };
const C4_AT = { x: 0, z: -3 };

/** The little platform up in the sky, with the C4 on a crate, and the city far below. */
function skyWorld(): { parts: Part[]; signs: Sign[]; solid: Box2D[] } {
  const metal = "#c9ced6";
  const below = world().parts.map((p): Part => ({ ...p, p: [p.p[0] * 1.5, p.p[1] - 140, p.p[2] * 1.5 - 30], k: [p.k[0] * 1.5, p.k[1], p.k[2] * 1.5] }));
  const parts: Part[] = [
    ...below,
    B([0, -0.25, 0], [14, 0.5, 14], metal),
    B([0, -1.2, 0], [10, 1.5, 10], "#7d8794"),
    // Railings all round (except where the elevator is).
    ...[-1, 1].flatMap((side) => [
      B([side * 6.9, 0.9, 0], [0.12, 0.12, 14], "#ffe36e"),
      ...[-6, -3, 0, 3, 6].map((t) => B([side * 6.9, 0.45, t], [0.12, 0.9, 0.12], "#ffe36e")),
    ]),
    B([0, 0.9, -6.9], [14, 0.12, 0.12], "#ffe36e"),
    ...[-6, -3, 0, 3, 6].map((t) => B([t, 0.45, -6.9], [0.12, 0.9, 0.12], "#ffe36e")),
    B([-4.5, 0.9, 6.9], [5, 0.12, 0.12], "#ffe36e"),
    B([4.5, 0.9, 6.9], [5, 0.12, 0.12], "#ffe36e"),
    // The top of the elevator, with its doors slid open.
    B([0, 1.6, 9.5], [5, 3.2, 5], "#7d8794"),
    B([-1.9, 1.4, 6.98], [1.2, 2.8, 0.08], metal),
    B([1.9, 1.4, 6.98], [1.2, 2.8, 0.08], metal),
    B([0, 1.4, 7.05], [2.4, 2.8, 0.02], "#3b3f4a"),
    // The crate, and (until you grab it) the C4 on top: three blocks, wires and a timer.
    B([C4_AT.x, 0.4, C4_AT.z], [1.4, 0.8, 1.4], "#a8774a"),
    ...(c4Waiting() ? c4Parts(C4_AT.x, 0.8, C4_AT.z) : []),
    // A few clouds floating by at the same height.
    ...[[-30, -5, -40], [35, 3, -25], [-20, -8, 30], [40, -4, 35]].map(([x, y, z]) => S([x!, y!, z!], [14, 4, 8], "#ffffff")),
  ];
  const signs: Sign[] = c4Waiting()
    ? [
        { text: "C4", at: [C4_AT.x, 1.0, C4_AT.z + 0.4] },
        { text: "", at: [C4_AT.x + 0.15, 1.28, C4_AT.z + 0.1], light: "red" },
      ]
    : [];
  return { parts, signs, solid: [{ x0: C4_AT.x - 0.7, x1: C4_AT.x + 0.7, z0: C4_AT.z - 0.7, z1: C4_AT.z + 0.7 }] };
}

const bankerHere = (): boolean => state.story === "start" || state.story === "bars";

/** The C4 is still on the crate until you grab it (and it's gone once it's used). */
const c4Waiting = (): boolean => !state.heist.c4 && !state.heist.safe;

/** A bundle of C4 sitting on height `y`: three blocks, a red and a blue wire, and a timer. */
function c4Parts(x: number, y: number, z: number): Part[] {
  return [
    ...[-0.35, 0, 0.35].map((dx) => B([x + dx, y + 0.15, z], [0.32, 0.3, 0.7], "#d9c8a0")),
    B([x, y + 0.15, z + 0.36], [1.1, 0.06, 0.03], "#e8383d"),
    B([x, y + 0.1, z + 0.37], [1.1, 0.06, 0.03], "#4a9bff"),
    B([x, y + 0.38, z + 0.1], [0.5, 0.16, 0.3], "#2b2b33"),
  ];
}

// ---- Inside the Bank ----
// A marble lobby, and at the back a TOP SECRET door (the Sky Key opens it)
// into the vault, with the safe (C4 opens that) and the diamond inside.

const BANK_IN = { x: 0, z: 8.4 };
const SECRET_DOOR = { x: 0, z: -8.8 };
const SAFE = { x: 0, z: -16.6 };

function bankWorld(): { parts: Part[]; signs: Sign[]; solid: Box2D[] } {
  const wall = "#d8cfc0";
  const { vault, safe, diamond } = state.heist;
  const dial: Part = { s: "cylinder", p: [0, 1.6, -9.72], k: [1.1, 0.12, 1.1], c: "#c9ced6", r: [Math.PI / 2, 0, 0], n: 14 };
  const parts: Part[] = [
    B([0, -0.05, -6], [22, 0.1, 34], "#e8e4dc"),
    B([0, 6.05, -6], [22, 0.1, 34], "#f4f1ee"),
    ...[-1, 1].map((side) => B([side * 10, 3, 0], [0.4, 6, 20], wall)),
    B([0, 3, 10], [20, 6, 0.4], wall),
    B([0, 1.4, 9.78], [2.4, 2.8, 0.05], "#6b3a1f"),
    B([-5.75, 3, -10], [8.5, 6, 0.4], wall),
    B([5.75, 3, -10], [8.5, 6, 0.4], wall),
    B([0, 4.6, -10], [3, 2.8, 0.4], wall),
    // Columns and the counter.
    ...[-6, 6].flatMap((x) => [-4, 4].map((z) => C([x, 3, z], [0.9, 6, 0.9], "#ffffff", 12))),
    B([0, 0.6, 2], [8, 1.2, 1], "#a8774a"),
    B([0, 1.6, 2], [8, 0.8, 0.05], "#bfe6ff"),
    // The vault room behind the secret door.
    B([0, -0.04, -16], [12, 0.1, 12], "#5d626c"),
    ...[-1, 1].map((side) => B([side * 6, 3, -16], [0.4, 6, 12], "#7d8794")),
    B([0, 3, -22], [12, 6, 0.4], "#7d8794"),
    // The safe.
    B([SAFE.x, 1.5, -19.6], [4, 3, 2.4], "#3b3f4a"),
  ];
  if (!vault) {
    // The TOP SECRET door: heavy metal, with warning stripes and a big round lock.
    parts.push(B([0, 1.6, -9.9], [3, 3.2, 0.3], "#7d8794"), dial);
    for (let i = 0; i < 5; i++) parts.push(B([-1.2 + i * 0.6, 0.15, -9.74], [0.3, 0.3, 0.02], i % 2 ? "#24222b" : "#ffd23f"));
  }
  if (!safe) {
    parts.push(
      B([SAFE.x, 1.5, -18.36], [3.2, 2.4, 0.12], "#7d8794"),
      { s: "cylinder", p: [SAFE.x + 0.7, 1.8, -18.28], k: [0.7, 0.1, 0.7], c: "#c9ced6", r: [Math.PI / 2, 0, 0], n: 14 },
      B([SAFE.x - 0.8, 1.5, -18.28], [0.15, 0.8, 0.1], "#c9ced6"),
    );
  } else {
    // Blown open! The door is on the floor, with black scorch marks all round.
    parts.push(
      B([SAFE.x, 1.5, -18.38], [3.2, 2.4, 0.05], "#1a1020"),
      { s: "box", p: [SAFE.x + 2.6, 0.12, -15.2], k: [3.2, 0.12, 2.4], c: "#7d8794", r: [0, 0.5, 0] },
      B([SAFE.x, 0.02, -16.6], [5, 0.02, 3], "#2b2b33"),
    );
    if (!diamond) {
      // The diamond: a cone up and a cone down, sparkling blue.
      parts.push(
        { s: "cone", p: [SAFE.x, 1.75, -18.7], k: [0.9, 0.4, 0.9], c: "#5fe0ff", n: 8 },
        { s: "cone", p: [SAFE.x, 1.25, -18.7], k: [0.9, 0.6, 0.9], c: "#5fe0ff", r: [0, 0, Math.PI], n: 8 },
      );
    }
  }
  if (state.heist.c4 && !safe) parts.push(...c4Parts(-3.5, 0.9, 1.6));
  // The bank keeper, behind the counter (until he runs off with your gold).
  if (bankerHere() && runAt === null) parts.push(...figure("green person", [0, 0, 0.6], 1.8, -Math.PI / 2));
  const signs: Sign[] = [
    { text: "BANK", at: [0, 4.8, 9.7] },
    { text: "SAFE", at: [SAFE.x, 3.3, -18.3] },
  ];
  if (!vault) signs.push({ text: "TOP SECRET", at: [0, 3.6, -9.7] });
  if (safe && !diamond) signs.push({ text: "", at: [SAFE.x, 1.5, -18.2], light: "glow" });
  const solid: Box2D[] = [
    { x0: -10.2, x1: -9.8, z0: -10, z1: 10 },
    { x0: 9.8, x1: 10.2, z0: -10, z1: 10 },
    { x0: -10, x1: 10, z0: 9.8, z1: 10.2 },
    { x0: -10, x1: -1.5, z0: -10.2, z1: -9.8 },
    { x0: 1.5, x1: 10, z0: -10.2, z1: -9.8 },
    { x0: -6.2, x1: -5.8, z0: -22, z1: -10 },
    { x0: 5.8, x1: 6.2, z0: -22, z1: -10 },
    { x0: -6, x1: 6, z0: -22.2, z1: -21.8 },
    { x0: -4, x1: 4, z0: 1.5, z1: 2.5 },
    { x0: SAFE.x - 2, x1: SAFE.x + 2, z0: -20.8, z1: -18.3 },
  ];
  if (!vault) solid.push({ x0: -1.5, x1: 1.5, z0: -10.2, z1: -9.7 });
  return { parts, signs, solid };
}

// ---- People ----

/**
 * A person (from the box room's person model) standing with their feet at
 * `at`, `tall` metres tall, facing `yaw` (0 faces +x, PI/2 faces -z). `extra`
 * parts are in the person model's own units (it's about 2.2 tall, facing +x).
 */
function figure(text: string, at: Vec3, tall: number, yaw: number, extra: Part[] = []): Part[] {
  const k = tall / 2.2;
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return [...makeModels(text)[0]!.parts, ...extra].map((part) => {
    const [x, y, z] = part.p;
    const r = part.r ?? [0, 0, 0];
    return {
      ...part,
      p: [at[0] + (x * c + z * sn) * k, at[1] + (y + 1.13) * k, at[2] + (-x * sn + z * c) * k] as Vec3,
      k: [part.k[0] * k, part.k[1] * k, part.k[2] * k] as Vec3,
      r: [r[0], r[1] + yaw, r[2]] as Vec3,
    };
  });
}

/** The robber: black clothes, a mask, a beanie, and a loot bag. */
const ROBBER_EXTRA: Part[] = [
  S([-0.03, 0.72, 0], [0.56, 0.4, 0.58], "#24222b"),
  B([0.23, 0.55, 0], [0.06, 0.13, 0.52], "#24222b"),
  S([-0.1, -0.25, 0.5], [0.5, 0.6, 0.5], "#b9895a"),
];

const HOME_DOOR = { x: -36, z: 7.6 };
const MARKET = { x: -50, z: -8 };

/** The Farmers Market: three stalls with stripy awnings, fruit, and a seller. */
function marketParts(): Part[] {
  const awnings = ["#ff6fb5", "#ffd23f", "#4cc76a"];
  const fruit = ["#e8383d", "#ff9226", "#ffe36e", "#a35cff", "#4cc76a"];
  return [-56, -50, -44].flatMap((x, i) => [
    B([x, 0.5, -13], [4.5, 1, 1.6], "#a8774a"),
    ...[-2, 2].flatMap((dx) => [C([x + dx, 1.4, -12.2], [0.15, 2.8, 0.15], "#8b5a2b"), C([x + dx, 1.4, -13.8], [0.15, 2.8, 0.15], "#8b5a2b")]),
    ...[0, 1, 2, 3].map((k) => B([x - 1.7 + k * 1.13, 2.9, -13], [1.13, 0.12, 2.2], k % 2 ? "#ffffff" : awnings[i]!)),
    ...Array.from({ length: 6 }, (_, k) => S([x - 1.6 + k * 0.64, 1.15, -13 + (k % 2) * 0.3], [0.4, 0.4, 0.4], fruit[(i + k) % fruit.length]!)),
    ...(i === 1 ? figure("orange person", [x, 0, -14.4], 1.75, -Math.PI / 2) : []),
  ]);
}

/** A building facing the road: `side` 1 is the north side (front faces -z), -1 the south. */
function building(x: number, side: 1 | -1, w: number, h: number, color: string, extra: Part[] = []): Part[] {
  const d = 10;
  const front = side * 9;
  const cz = front + side * (d / 2);
  const parts: Part[] = [B([x, h / 2, cz], [w, h, d], color), B([x, 1.2, front - side * 0.03], [1.8, 2.4, 0.06], "#6b3a1f")];
  for (let row = 0; row * 3 + 4 < h; row++) {
    for (const dx of [-w * 0.32, w * 0.32]) parts.push(B([x + dx, 4 + row * 3, front - side * 0.03], [1.6, 1.4, 0.06], "#bfe6ff"));
  }
  return [...parts, ...extra];
}

function world(): { parts: Part[]; signs: Sign[]; solid: Box2D[] } {
  const job = state.career === "engineer" ? { name: "ENGINEERING STATION", color: "#e8383d" } : { name: "BOX FACTORY", color: "#c9965f" };
  const parts: Part[] = [
    // Grass, the road, sidewalks and the yellow lines.
    B([0, -0.05, -5], [220, 0.1, 160], "#6fc45a"),
    B([0, 0.01, 0], [150, 0.02, 10], "#4a4a55"),
    B([0, 0.06, 6.5], [150, 0.12, 3], "#d9d4cc"),
    B([0, 0.06, -6.5], [150, 0.12, 3], "#d9d4cc"),
    ...Array.from({ length: 30 }, (_, i) => B([-72 + i * 5, 0.03, 0], [2.4, 0.02, 0.25], "#ffe36e")),
    // North side: home, your job, the Dollhouse Builder, the Lab.
    ...building(-36, 1, 10, 7, "#ff9fcf", [R([-36, 8.5, 14], [11, 3, 11], "#e8383d")]),
    ...building(-12, 1, 12, 12, job.color),
    ...building(12, 1, 12, 10, "#ffd27a"),
    ...building(36, 1, 12, 9, "#9ce8b4", [S([36, 9, 14], [7, 5, 7], "#c8f0e0")]),
    // South side: the Bank (with columns), and a park with trees.
    ...building(-12, -1, 16, 9, "#e8e4dc", [
      R([-12, 9.9, -14], [17, 2, 11], "#d0c8b8"),
      B([-12, 0.25, -8.4], [12, 0.5, 1.2], "#c9c2b4"),
      ...[-6, -2, 2, 6].map((dx) => C([-12 + dx, 3.6, -8.6], [0.8, 7, 0.8], "#ffffff")),
    ]),
    ...[14, 22, 30, 38].flatMap((x, i) => [
      C([x, 1.5, -14 - (i % 2) * 4], [0.6, 3, 0.6], "#8b5a2b"),
      S([x, 4, -14 - (i % 2) * 4], [3.6, 3.4, 3.6], i % 2 ? "#3eb35a" : "#4cc76a"),
    ]),
    // A hedge, with the elevator hidden behind it.
    B([52, 1, -24], [14, 2, 1.5], "#3e8f4f"),
    B([ELEVATOR.x, 15, ELEVATOR.z - 2.5], [5, 30, 5], "#7d8794"),
    B([ELEVATOR.x - 0.62, 1.4, ELEVATOR.z + 0.02], [1.2, 2.8, 0.08], "#c9ced6"),
    B([ELEVATOR.x + 0.62, 1.4, ELEVATOR.z + 0.02], [1.2, 2.8, 0.08], "#c9ced6"),
    B([ELEVATOR.x + 1.8, 1.4, ELEVATOR.z + 0.04], [0.4, 0.7, 0.06], "#2b2b33"),
    S([ELEVATOR.x + 1.8, 1.55, ELEVATOR.z + 0.1], [0.18, 0.18, 0.1], "#3dff6a"),
    B([ELEVATOR.x, 3.1, ELEVATOR.z + 0.04], [2.6, 0.4, 0.06], "#ffe36e"),
    ...marketParts(),
    // Whatever's happening at your house in the story.
    ...(robberHome() ? figure("black person", [HOME_DOOR.x, 0, HOME_DOOR.z], 1.8, Math.PI / 2, ROBBER_EXTRA) : []),
    ...(state.story === "package" ? packageParts(false) : state.story === "void" ? packageParts(true) : []),
    // Little lamp posts along the street.
    ...[-48, -24, 0, 24, 48].flatMap((x) => [C([x, 2, 8], [0.2, 4, 0.2], "#5d626c"), S([x, 4.1, 8], [0.6, 0.6, 0.6], "#fff4a8")]),
  ];
  const signs: Sign[] = [
    { text: "HOME", at: [-36, 6, 8.9] },
    { text: job.name, at: [-12, 11, 8.9] },
    { text: "DOLLHOUSE BUILDER", at: [12, 9, 8.9] },
    { text: "LAB", at: [36, 8, 8.9] },
    { text: "BANK", at: [-12, 8.2, -8.9] },
    { text: "ELEVATOR", at: [ELEVATOR.x, 3.1, ELEVATOR.z + 0.1] },
    { text: "FARMERS MARKET", at: [-50, 3.6, -12] },
  ];
  if (state.story === "package") signs.push({ text: "", at: [HOME_DOOR.x, 0.45, HOME_DOOR.z - 0.62], light: "amazon" });
  const solid = [
    ...[-36, -12, 12, 36].map((x, i) => ({ x0: x - (i === 0 ? 5 : 6), x1: x + (i === 0 ? 5 : 6), z0: 9, z1: 19 })),
    { x0: -20, x1: -4, z0: -19, z1: -9 },
    { x0: 45, x1: 59, z0: -24.75, z1: -23.25 },
    { x0: ELEVATOR.x - 2.5, x1: ELEVATOR.x + 2.5, z0: ELEVATOR.z - 5, z1: ELEVATOR.z },
    ...[-56, -50, -44].map((x) => ({ x0: x - 2.25, x1: x + 2.25, z0: -13.8, z1: -12.2 })),
  ];
  return { parts, signs, solid };
}

/** The robber waits at your door until he's blasted off (and isn't drawn while that's happening). */
const robberHome = (): boolean => (state.story === "robber" || state.story === "paid") && blastAt === null;

/** The Amazon package on your doorstep (opened, once you've read the note). */
function packageParts(opened: boolean): Part[] {
  const { x, z } = HOME_DOOR;
  return opened
    ? [B([x, 0.3, z], [1.2, 0.6, 1.2], "#c9965f"), B([x - 0.8, 0.62, z], [0.4, 0.04, 1.2], "#ddb07a"), B([x + 0.8, 0.62, z], [0.4, 0.04, 1.2], "#ddb07a")]
    : [B([x, 0.4, z], [1.2, 0.8, 1.2], "#c9965f"), B([x, 0.81, z], [0.25, 0.02, 1.22], "#3b3f4a")];
}

// ---- The page bits ----

const host = document.createElement("section");
host.className = "walk";
host.hidden = true;
host.setAttribute("aria-label", "Outside, in first person");
host.innerHTML = `
  <div class="race-card">
    <h2>Outside!</h2>
    <canvas width="${W}" height="${H}" tabindex="0" aria-label="The city in 3D, seen through your eyes"></canvas>
    <p class="race-message" aria-live="polite"></p>
    <div class="race-controls">
      <button class="pill walk-move" data-move="left" type="button" aria-label="Turn left">◀</button>
      <button class="pill walk-move" data-move="forward" type="button" aria-label="Walk forward">▲</button>
      <button class="pill walk-move" data-move="back" type="button" aria-label="Walk back">▼</button>
      <button class="pill walk-move" data-move="right" type="button" aria-label="Turn right">▶</button>
      <button class="pill walk-move" data-move="lookUp" type="button" aria-label="Look up">Look ↑</button>
      <button class="pill walk-move" data-move="lookDown" type="button" aria-label="Look down">Look ↓</button>
      <button class="pill pill-main walk-up" type="button" hidden>▲ UP</button>
      <button class="pill walk-close" type="button">Go back inside</button>
    </div>
  </div>`;
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const messageEl = host.querySelector<HTMLElement>(".race-message")!;
const upButton = host.querySelector<HTMLButtonElement>(".walk-up")!;
host.querySelector(".walk-close")!.addEventListener("click", closeWalk);

const eye = new FirstPerson(450, 253);
let faces = worldFaces([]);
let signs: Sign[] = [];
let solid: { x0: number; x1: number; z0: number; z1: number }[] = [];
const cam: Camera = { x: -36, y: EYE, z: 5, yaw: Math.PI / 2, pitch: 0 };
const LOOK = 1.2; // how far you can look up or down
let dragY: number | null = null;
const held = new Set<string>();
let dragX: number | null = null;
let running = false;
let last = 0;
let riding: number | null = null; // when you pressed UP
let scene: Scene = "street";
let dinged = false;
let boomAt: number | null = null; // when you set off the C4
let boomed = false;
let spot: Spot | null = null; // the place you're standing next to

interface Spot {
  scene: Scene;
  x: number;
  z: number;
  r: number;
  /** What it says when you walk up, and the button (if there's something to do). */
  here: () => { say: string; button?: string; run?: () => void };
}

function say(text: string): void {
  messageEl.textContent = text;
}

for (const b of host.querySelectorAll<HTMLButtonElement>(".walk-move")) {
  const move = b.dataset["move"]!;
  b.addEventListener("pointerdown", () => held.add(move));
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => held.delete(move));
}

const SPOTS: Spot[] = [
  {
    scene: "street",
    x: MARKET.x,
    z: MARKET.z,
    r: 4.5,
    here: () => ({ say: "The Farmers Market! You can sell stuff you don't want here.", button: "Go to the Farmers Market", run: openMarket }),
  },
  {
    scene: "street",
    x: HOME_DOOR.x,
    z: HOME_DOOR.z - 2,
    r: 3.2,
    here: homeHere,
  },
  {
    scene: "bank",
    x: 0,
    z: 3.6,
    r: 2.4,
    here: () => {
      if (!bankerHere()) return { say: "Nobody's at the counter. The bank keeper ran off with your gold!" };
      if (state.story !== "bars") return { say: "The bank keeper says: \"Welcome to the Bank! Got anything to deposit?\"" };
      return {
        say: "The bank keeper says: \"Ooh, are those GOLD BARS? You can deposit them here!\"",
        button: "Deposit your 10 gold bars",
        run: () => {
          hooks.removeFromShelf("gold bars");
          runAt = performance.now();
          say("The bank keeper looks at all that gold... his eyes get really big... he grabs it all and RUNS AWAY!!");
          playSound("whoosh");
        },
      };
    },
  },
  {
    scene: "street",
    x: ELEVATOR.x,
    z: ELEVATOR.z + 1.5,
    r: 4,
    here: () => ({ say: "You found the ELEVATOR! Press the UP button!", button: "▲ UP", run: rideUp }),
  },
  {
    scene: "street",
    x: -12,
    z: -7.2,
    r: 3,
    here: () => ({
      say: "The BANK! It's not even on the car map...",
      button: "Go into the Bank",
      run: () => {
        go("bank");
        cam.x = BANK_IN.x;
        cam.z = BANK_IN.z;
        cam.yaw = Math.PI;
        playSound("bell");
        say("You're inside the Bank. It's very fancy... and there's a big door at the back.");
      },
    }),
  },
  {
    scene: "sky",
    x: SKY_DOORS.x,
    z: SKY_DOORS.z,
    r: 2.2,
    here: () => ({
      say: "The elevator.",
      button: "▼ DOWN",
      run: () => {
        go("street");
        cam.x = ELEVATOR.x;
        cam.z = ELEVATOR.z + 2.5;
        cam.yaw = 0;
        playSound("bell");
        say(state.heist.c4 ? "Ding! You're back on the street, with the C4. Now go to the Bank!" : "Ding! You rode the elevator back down to the street.");
      },
    }),
  },
  {
    scene: "sky",
    x: C4_AT.x,
    z: C4_AT.z,
    r: 2.6,
    here: () =>
      c4Waiting()
        ? {
            say: "Whoa... that's C4!! It has wires and a blinking red light.",
            button: "Grab the C4",
            run: () => {
              state.heist.c4 = true;
              save();
              go("sky");
              playSound("beep");
              say("You grabbed the C4! Careful... Now take it to the Bank.");
            },
          }
        : { say: "The crate is empty now." },
  },
  {
    scene: "bank",
    x: BANK_IN.x,
    z: BANK_IN.z,
    r: 2,
    here: () => ({
      say: "The way out.",
      button: "Leave the Bank",
      run: () => {
        go("street");
        cam.x = -12;
        cam.z = -6;
        cam.yaw = 0;
        say("You're back outside on the street.");
      },
    }),
  },
  {
    scene: "bank",
    x: SECRET_DOOR.x,
    z: SECRET_DOOR.z,
    r: 2.6,
    here: () => {
      if (state.heist.vault) return { say: "The TOP SECRET door is open. The safe is inside!" };
      if (!state.skyKey) {
        return { say: "A big metal door that says TOP SECRET. It's locked. The keyhole looks like it needs a key from way up in the sky..." };
      }
      return {
        say: "A big metal door that says TOP SECRET. The keyhole looks just like your Sky Key!",
        button: "Open it with the Sky Key",
        run: () => {
          state.heist.vault = true;
          save();
          go("bank");
          playSound("magic");
          say("The Sky Key fits! *CLUNK* The TOP SECRET door swings open!");
        },
      };
    },
  },
  {
    scene: "bank",
    x: SAFE.x,
    z: SAFE.z,
    r: 2.8,
    here: () => {
      if (state.heist.safe) {
        return state.heist.diamond
          ? { say: "The safe is empty. You already took the diamond!" }
          : {
              say: "The safe is blown wide open... and there's a DIAMOND inside!!",
              button: "Take the diamond",
              run: () => {
                state.heist.diamond = true;
                save();
                go("bank");
                hooks.addToShelf("diamond");
                playSound("levelup");
                say("You got the DIAMOND!! It's on your shelf now.");
              },
            };
      }
      if (!state.heist.c4) return { say: "The SAFE! It's way too strong to open. You'd need something that goes BOOM..." };
      return {
        say: "The SAFE! It's super strong... but you have C4!",
        button: "Blow up the safe!",
        run: () => {
          boomAt = performance.now();
          boomed = false;
          say("You put the C4 on the safe... RUN! 3...");
        },
      };
    },
  },
];

/** What's going on at your front door, depending on how far along the story is. */
function homeHere(): { say: string; button?: string; run?: () => void } {
  const shelf = hooks.shelf();
  if (state.story === "robber") {
    const crystal = shelf.find((t) => /crystal/i.test(t));
    if (!crystal) {
      return { say: "A ROBBER is at your house! \"Give me the crystal from the Double Dimension!\" (You don't have one. Get one at the Crystal Cave!)" };
    }
    return {
      say: "A ROBBER is at your house! \"Give me that crystal you got from the Double Dimension!\"",
      button: "Give him the crystal",
      run: () => {
        hooks.removeFromShelf(crystal);
        state.story = "paid";
        save();
        playSound("hi");
        say("\"Heh heh, thanks! ...But I want MORE! Give me something else!\"");
      },
    };
  }
  if (state.story === "paid") {
    if (!shelf.includes("doomsday device")) {
      return { say: "The robber wants MORE! Maybe throw something at him... like a Doomsday Device? (T-Rex gives those out.)" };
    }
    return {
      say: "The robber wants MORE! You've got your Doomsday Device...",
      button: "Throw the Doomsday Device at him!",
      run: () => {
        hooks.removeFromShelf("doomsday device");
        blastAt = performance.now();
        blasted = false;
        go("street");
        say("You throw the Doomsday Device! He catches it... \"Hmm... what does this button do?\"");
      },
    };
  }
  if (state.story === "blasted") return { say: "Your house is safe! Sell the robber's stuff at the Farmers Market." };
  if (state.story === "package") {
    return {
      say: "There's an Amazon package at your door!",
      button: "Open the package",
      run: () => {
        state.story = "void";
        save();
        go("street");
        noteAt = performance.now();
        playSound("magic");
        say("Inside the package is a note. It says: \"Find the Void Key\". (To be continued!)");
      },
    };
  }
  if (state.story === "void") return { say: "The note from the package says: \"Find the Void Key\"." };
  return { say: "Your house!" };
}

// ---- The robber blasting off, and the bank keeper running away ----

const ROBBER_LOOT = ["robber mask", "robber hat", "robber shoes", "loot bag"];
let blastAt: number | null = null;
let blasted = false;
let runAt: number | null = null;
let noteAt: number | null = null;

/** Moving people, drawn fresh every frame while they move. */
function movingParts(now: number): Part[] {
  const parts: Part[] = [];
  if (runAt !== null && scene === "bank") {
    // He runs off to the side, hopping, and out through the side door.
    const t = (now - runAt) / 1000;
    const x = -t * 5;
    if (x > -9.5) parts.push(...figure("green person", [x, Math.abs(Math.sin(t * 12)) * 0.25, 0.6], 1.8, Math.PI));
  }
  if (blastAt !== null && scene === "street") {
    const t = (now - blastAt) / 1000;
    const { x, z } = HOME_DOOR;
    if (t < 2.6) {
      // Holding the Doomsday Device, wondering what it does.
      parts.push(...figure("black person", [x, 0, z], 1.8, Math.PI / 2, ROBBER_EXTRA));
      parts.push(B([x, 1.15, z - 0.55], [0.5, 0.25, 0.35], "#5d626c"), C([x, 1.3, z - 0.55], [0.18, 0.06, 0.18], "#e8383d"));
    } else if (t < 6) {
      // KA-BOOM: he blasts off up into the sky, spinning, and his stuff flies everywhere.
      const k = t - 2.6;
      parts.push(...figure("black person", [x + k * 2, k * k * 9, z - k * 2], 1.8, Math.PI / 2 + k * 6));
      const flying: [string, number][] = [["#24222b", -1], ["#2b2b33", 1], ["#6b3a1f", -0.4], ["#b9895a", 0.5]];
      flying.forEach(([c, dir], i) => {
        const a = dir * 2.2;
        parts.push(B([x + Math.sin(a) * k * 6, Math.max(0.2, 1.5 + k * 6 - k * k * 4.5 + i * 0.2), z - 1 - Math.cos(a) * k * 4], [0.5, 0.35, 0.5], c));
      });
    }
  }
  return parts;
}

function updateStory(now: number): void {
  if (runAt !== null && now - runAt > 2200) {
    runAt = null;
    state.story = "robber";
    save();
    go("bank");
    say("He ran away with ALL your gold!! You should probably go home... (something's going on there).");
  }
  if (blastAt !== null) {
    const t = (now - blastAt) / 1000;
    if (t > 2.1 && t < 2.6 && !messageEl.textContent?.includes("*click*")) say("*click*");
    if (t > 2.6 && !blasted) {
      blasted = true;
      playSound("boom");
      say("KA-BOOOOM!!! The robber blasted off into the sky! His stuff went flying everywhere!");
    }
    if (t > 6) {
      blastAt = null;
      state.story = "blasted";
      save();
      for (const thing of ROBBER_LOOT) hooks.addToShelf(thing);
      go("street");
      say(
        state.meteor === "saved"
          ? "Your pet dinos ran off and found ALL the robber's stuff: his mask, hat, shoes and loot bag! Sell them at the Farmers Market!"
          : "You found ALL the robber's stuff: his mask, hat, shoes and loot bag! Sell them at the Farmers Market!",
      );
    }
  }
}

function rideUp(): void {
  riding = performance.now();
  dinged = false;
  playSound("bell");
  say("You pressed UP! The doors close... and the elevator starts going up...");
}

const spotHere = (): Spot | null =>
  SPOTS.find((p) => p.scene === scene && Math.hypot(cam.x - p.x, cam.z - p.z) < p.r) ?? null;

upButton.addEventListener("click", () => {
  if (riding !== null || boomAt !== null || !spot) return;
  const here = spot.here();
  upButton.hidden = true;
  here.run?.();
  // Whatever you just did said its own thing, so only update the button for
  // where you're standing now (without saying it again).
  if (riding !== null || boomAt !== null) return;
  spot = spotHere();
  const now = spot?.here();
  upButton.hidden = !now?.button;
  if (now?.button) upButton.textContent = now.button;
});

function go(next: Scene): void {
  scene = next;
  const w = next === "sky" ? skyWorld() : next === "bank" ? bankWorld() : world();
  faces = worldFaces(w.parts);
  signs = w.signs;
  solid = w.solid;
  spot = null;
  upButton.hidden = true;
}

canvas.addEventListener("pointerdown", (e) => {
  dragX = e.clientX;
  dragY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (dragX === null || dragY === null || riding !== null) return;
  // Drag sideways to turn, up and down to look up and down.
  cam.yaw += (e.clientX - dragX) * 0.006;
  cam.pitch = Math.max(-LOOK, Math.min(LOOK, cam.pitch - (e.clientY - dragY) * 0.006));
  dragX = e.clientX;
  dragY = e.clientY;
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => (dragX = dragY = null));

// Arrow keys look around (left/right to turn, up/down to look up and down);
// W A S D walk.
const KEYS: Record<string, string> = {
  ArrowUp: "lookUp",
  w: "forward",
  ArrowDown: "lookDown",
  s: "back",
  ArrowLeft: "left",
  ArrowRight: "right",
  a: "strafeLeft",
  d: "strafeRight",
  q: "lookUp",
  e: "lookDown",
};
window.addEventListener("keydown", (e) => {
  if (host.hidden) return;
  if (e.key === "Escape") return closeWalk();
  const move = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (move) {
    e.preventDefault();
    held.add(move);
  }
});
window.addEventListener("keyup", (e) => {
  const move = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (move) held.delete(move);
});
window.addEventListener("blur", () => held.clear());

function update(now: number, dt: number): void {
  if (riding !== null) return;
  if (boomAt !== null) return updateBoom(now);
  updateStory(now);
  if (blastAt !== null || runAt !== null || market) return;
  if (held.has("left")) cam.yaw -= TURN * dt;
  if (held.has("right")) cam.yaw += TURN * dt;
  if (held.has("lookUp")) cam.pitch = Math.min(LOOK, cam.pitch + TURN * 0.6 * dt);
  if (held.has("lookDown")) cam.pitch = Math.max(-LOOK, cam.pitch - TURN * 0.6 * dt);
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  let mx = 0;
  let mz = 0;
  if (held.has("forward")) (mx += fx), (mz += fz);
  if (held.has("back")) (mx -= fx), (mz -= fz);
  if (held.has("strafeRight")) (mx += fz), (mz -= fx);
  if (held.has("strafeLeft")) (mx -= fz), (mz += fx);
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    cam.x += (mx / len) * SPEED * dt;
    cam.z += (mz / len) * SPEED * dt;
  }
  // Don't walk through buildings or off the edge of the world.
  if (scene === "sky") {
    // The railings stop you falling off (except into the elevator).
    cam.x = Math.max(-PLATFORM, Math.min(PLATFORM, cam.x));
    cam.z = Math.max(-PLATFORM, Math.min(Math.abs(cam.x) < 1.1 ? 7 : PLATFORM, cam.z));
  } else if (scene === "bank") {
    cam.x = Math.max(-9.6, Math.min(9.6, cam.x));
    cam.z = Math.max(-21.6, Math.min(9.6, cam.z));
  } else {
    cam.x = Math.max(-70, Math.min(70, cam.x));
    cam.z = Math.max(-45, Math.min(30, cam.z));
  }
  for (const b of solid) {
    if (cam.x > b.x0 - RADIUS && cam.x < b.x1 + RADIUS && cam.z > b.z0 - RADIUS && cam.z < b.z1 + RADIUS) {
      const out = [
        [cam.x - (b.x0 - RADIUS), "x0"],
        [b.x1 + RADIUS - cam.x, "x1"],
        [cam.z - (b.z0 - RADIUS), "z0"],
        [b.z1 + RADIUS - cam.z, "z1"],
      ] as const;
      const [, side] = out.reduce((m, o) => (o[0] < m[0] ? o : m));
      if (side === "x0") cam.x = b.x0 - RADIUS;
      if (side === "x1") cam.x = b.x1 + RADIUS;
      if (side === "z0") cam.z = b.z0 - RADIUS;
      if (side === "z1") cam.z = b.z1 + RADIUS;
    }
  }
  // Bob a little while walking.
  cam.y = EYE + (len > 0 ? Math.sin(now / 120) * 0.05 : 0);

  // What's right here? Say so, and show its button.
  const next = spotHere();
  if (next !== spot) {
    spot = next;
    const here = next?.here();
    upButton.hidden = !here?.button;
    if (here?.button) upButton.textContent = here.button;
    if (here) {
      say(here.say);
      if (here.button) playSound("magic");
    }
  }
}

/** The C4 on the safe: 3, 2, 1... BOOM! The safe door blows off. */
function updateBoom(now: number): void {
  const age = now - boomAt!;
  if (!boomed) {
    const n = 3 - Math.floor(age / 1000);
    if (n > 0) {
      const text = `You put the C4 on the safe... RUN! ${n}...`;
      if (messageEl.textContent !== text) {
        say(text);
        playSound("alarm");
      }
      return;
    }
    boomed = true;
    state.heist.safe = true;
    state.heist.c4 = false;
    save();
    go("bank");
    playSound("boom");
    say("KA-BOOOOM!!! The safe door blew right off!");
  }
  if (age > 4800) {
    boomAt = null;
    spot = null;
  }
}

function draw(now: number): void {
  if (riding !== null) return drawRide(now);
  const moving = movingParts(now);
  const all = moving.length ? faces.concat(worldFaces(moving)) : faces;
  eye.render(all, cam, scene === "sky" ? SKY_HIGH : SKY, scene === "sky" ? SKY_FOG : scene === "bank" ? BANK_FOG : FOG);
  ctx.imageSmoothingEnabled = false;
  // Right after the boom, everything shakes.
  const shaking = boomAt !== null && boomed && now - boomAt < 3800;
  ctx.save();
  if (shaking) ctx.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
  ctx.drawImage(eye.canvas, 0, 0, W, H);
  ctx.restore();
  // Signs on the buildings, if you can see them.
  const scale = W / eye.w;
  for (const sign of signs) {
    const spot = eye.spot(sign.at);
    if (!spot || !spot.seen || spot.dist > 90) continue;
    if (sign.light === "glow") {
      // The diamond sparkling inside the safe.
      const pulse = 0.5 + Math.sin(now / 200) * 0.5;
      ctx.fillStyle = `rgba(160, 240, 255, ${0.25 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.arc(spot.x * scale, spot.y * scale, Math.max(8, 70 / spot.dist), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (sign.light === "amazon") {
      // The Amazon logo on the package: the word, and the orange smile arrow.
      const x = spot.x * scale;
      const y = spot.y * scale;
      const size = Math.max(10, Math.min(40, 120 / spot.dist));
      ctx.font = `800 ${size}px Arial, sans-serif`;
      ctx.fillStyle = "#1a1a1a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("amazon", x, y - size * 0.25);
      const w = ctx.measureText("amazon").width;
      ctx.strokeStyle = "#ff9900";
      ctx.lineWidth = Math.max(2, size / 7);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.42, y + size * 0.3);
      ctx.quadraticCurveTo(x, y + size * 0.65, x + w * 0.38, y + size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.27, y + size * 0.22);
      ctx.lineTo(x + w * 0.4, y + size * 0.29);
      ctx.lineTo(x + w * 0.36, y + size * 0.44);
      ctx.stroke();
      ctx.lineCap = "butt";
      continue;
    }
    if (sign.light === "red") {
      if (now % 1000 < 500) {
        ctx.fillStyle = "#ff2020";
        ctx.shadowColor = "#ff2020";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(spot.x * scale, spot.y * scale, Math.max(3, 14 / spot.dist), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      continue;
    }
    const size = Math.max(10, Math.min(46, 260 / spot.dist));
    ctx.font = `900 ${size}px "Trebuchet MS", sans-serif`;
    const tw = ctx.measureText(sign.text).width;
    const x = spot.x * scale;
    const y = spot.y * scale;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(x - tw / 2 - size * 0.3, y - size * 0.65, tw + size * 0.6, size * 1.3);
    ctx.fillStyle = sign.text === "ENGINEERING STATION" ? "#8b1a1a" : "#4a1f6e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sign.text, x, y);
  }
  if (boomAt !== null) {
    const age = now - boomAt;
    if (!boomed) {
      // The countdown, and the C4's light blinking faster and faster.
      ctx.font = '900 140px "Trebuchet MS", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 8;
      const n = String(Math.max(1, 3 - Math.floor(age / 1000)));
      ctx.strokeText(n, W / 2, H / 2);
      ctx.fillText(n, W / 2, H / 2);
      ctx.fillStyle = `rgba(255, 30, 30, ${Math.abs(Math.sin(age / 120)) * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      const since = age - 3000;
      ctx.fillStyle = `rgba(255, 240, 200, ${Math.max(0, 1 - since / 700)})`;
      ctx.fillRect(0, 0, W, H);
      if (since < 2200) {
        ctx.font = '900 90px "Trebuchet MS", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ff9226";
        ctx.strokeStyle = "#7a1a00";
        ctx.lineWidth = 8;
        ctx.strokeText("KA-BOOM!", W / 2, H / 2);
        ctx.fillText("KA-BOOM!", W / 2, H / 2);
      }
    }
  }
  if (blastAt !== null && now - blastAt > 2600 && now - blastAt < 3300) {
    ctx.fillStyle = `rgba(255, 240, 200, ${1 - (now - blastAt - 2600) / 700})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (blastAt !== null && now - blastAt < 2600) drawSpeech(now - blastAt < 2100 ? "Hmm... what does this button do?" : "*click*");
  if (noteAt !== null) drawNote(now);
  // A little crosshair in the middle.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 8, H / 2);
  ctx.lineTo(W / 2 + 8, H / 2);
  ctx.moveTo(W / 2, H / 2 - 8);
  ctx.lineTo(W / 2, H / 2 + 8);
  ctx.stroke();
}

function drawSpeech(text: string): void {
  ctx.font = '800 22px "Trebuchet MS", sans-serif';
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#24222b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(W / 2 - w / 2, 30, w, 48, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#24222b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, 55);
}

/** The note from the Amazon package. */
function drawNote(now: number): void {
  const age = now - noteAt!;
  if (age > 7000) {
    noteAt = null;
    return;
  }
  const k = Math.min(1, age / 400);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.04);
  ctx.scale(k, k);
  ctx.fillStyle = "#fffaf0";
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 20;
  ctx.fillRect(-230, -130, 460, 260);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#d8e8ff";
  ctx.lineWidth = 2;
  for (let y = -90; y < 120; y += 34) {
    ctx.beginPath();
    ctx.moveTo(-200, y);
    ctx.lineTo(200, y);
    ctx.stroke();
  }
  ctx.fillStyle = "#3a2440";
  ctx.font = '700 42px "Comic Sans MS", "Chalkboard SE", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Find the", 0, -30);
  ctx.fillText("Void Key", 0, 30);
  ctx.restore();
}

/** Inside the elevator, going up. What's at the top is still a secret. */
function drawRide(now: number): void {
  const age = (now - riding!) / 1000;
  ctx.fillStyle = "#5d626c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#7d8794";
  ctx.fillRect(W / 2 - 180, 40, 360, H - 40);
  ctx.strokeStyle = "#3b3f4a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2, 40);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  // The floor number, ticking up.
  const floor = Math.min(100, 1 + Math.floor(age * age * 4));
  ctx.fillStyle = "#24222b";
  ctx.fillRect(W / 2 - 60, 6, 120, 30);
  ctx.fillStyle = "#ff9226";
  ctx.font = '900 22px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`▲ ${floor}`, W / 2, 22);
  if (floor >= 100) {
    if (!dinged) {
      dinged = true;
      playSound("bell");
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(W / 2 - 250, H / 2 - 36, 500, 72);
    ctx.fillStyle = "#7a2fc0";
    ctx.font = '900 30px "Trebuchet MS", sans-serif';
    ctx.fillText("DING! The doors open...", W / 2, H / 2);
    // A moment later you step out onto the platform in the sky.
    if (age > 6.2) {
      riding = null;
      go("sky");
      cam.x = 0;
      cam.z = 5.2;
      cam.yaw = Math.PI;
      say("The doors open... you're on a tiny platform way up in the sky! There's something on that crate...");
    }
  }
}

function loop(now: number): void {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(now, dt);
  draw(now);
  requestAnimationFrame(loop);
}

interface WalkHooks {
  addToShelf: (thing: string) => void;
  removeFromShelf: (thing: string) => void;
  shelf: () => string[];
}
let hooks: WalkHooks = { addToShelf: () => {}, removeFromShelf: () => {}, shelf: () => [] };

// ---- The Farmers Market ----
// Add things from your shelf to your table, then sell it all. Most things
// sell for a little; the diamond gets you 10 gold bars, and the robber's stuff
// sells for $250,000,000 each. Things you still need for the story can't be sold.

let market = false;
let table: string[] = [];
const marketEl = document.createElement("div");
marketEl.className = "market";
marketEl.hidden = true;
host.querySelector(".race-card")!.append(marketEl);

function seed(text: string): number {
  let n = 0;
  for (const ch of text) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return n;
}

const isLoot = (thing: string): boolean => ROBBER_LOOT.includes(thing);

function price(thing: string): number {
  if (isLoot(thing)) return 250_000_000;
  if (thing === "diamond" && state.story === "start") return 0;
  return 1_000 * (1 + (seed(thing) % 50));
}

/** Why you can't sell something (yet), if you can't. */
function needed(thing: string): string | null {
  if (thing === "sky key" || thing === "purple key" || thing === "magnifying glass") return "You need this!";
  if (thing === "doomsday device" && (state.story === "robber" || state.story === "paid" || state.story === "bars" || state.story === "start")) {
    return "Keep this... you might need it!";
  }
  if (/crystal/i.test(thing) && state.story !== "paid" && state.story !== "blasted" && state.story !== "package" && state.story !== "void") {
    const crystals = hooks.shelf().filter((t) => /crystal/i.test(t)).length - table.filter((t) => /crystal/i.test(t)).length;
    if (crystals <= 1) return "Keep one crystal... someone might want it!";
  }
  return null;
}

function openMarket(): void {
  market = true;
  table = [];
  held.clear();
  renderMarket("The seller says: \"Welcome to the Farmers Market! What do you want to sell?\"");
  marketEl.hidden = false;
}

function closeMarket(): void {
  market = false;
  marketEl.hidden = true;
  spot = null;
}

function renderMarket(note: string): void {
  const yours = hooks.shelf();
  const left = [...yours];
  for (const t of table) left.splice(left.indexOf(t), 1);
  const total = table.reduce((n, t) => n + price(t), 0);
  const getsBars = table.includes("diamond") && state.story === "start";
  marketEl.innerHTML = `
    <h3>Farmers Market</h3>
    <p class="market-note"></p>
    <p class="market-money">You have ${formatMoney(state.money)}</p>
    <div class="market-cols">
      <div><h4>Your stuff</h4><ul class="market-yours"></ul></div>
      <div><h4>On your table</h4><ul class="market-table"></ul>
        <p class="market-total">${table.length ? `You'll get ${formatMoney(total)}${getsBars ? " and 10 GOLD BARS" : ""}` : "Nothing yet. Add some stuff!"}</p>
      </div>
    </div>
    <div class="race-controls">
      <button class="pill pill-main market-sell" type="button" ${table.length ? "" : "disabled"}>Sell it all!</button>
      <button class="pill market-done" type="button">Done</button>
    </div>`;
  marketEl.querySelector(".market-note")!.textContent = note;
  const yoursEl = marketEl.querySelector(".market-yours")!;
  left.forEach((thing) => {
    const li = document.createElement("li");
    const why = needed(thing);
    const label = document.createElement("span");
    label.textContent = thing;
    const add = document.createElement("button");
    add.type = "button";
    add.className = "pill";
    add.textContent = why ?? "Add stuff";
    add.disabled = !!why;
    add.addEventListener("click", () => {
      table.push(thing);
      renderMarket(`You put the ${thing} on your table.`);
    });
    li.append(label, add);
    yoursEl.append(li);
  });
  if (!left.length) yoursEl.innerHTML = "<li>Your shelf is empty.</li>";
  const tableEl = marketEl.querySelector(".market-table")!;
  table.forEach((thing, i) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${thing}: ${thing === "diamond" && state.story === "start" ? "10 gold bars" : formatMoney(price(thing))}`;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "pill";
    back.textContent = "×";
    back.setAttribute("aria-label", `Take the ${thing} back`);
    back.addEventListener("click", () => {
      table.splice(i, 1);
      renderMarket(`You took the ${thing} back.`);
    });
    li.append(label, back);
    tableEl.append(li);
  });
  marketEl.querySelector(".market-sell")!.addEventListener("click", sellAll);
  marketEl.querySelector(".market-done")!.addEventListener("click", closeMarket);
}

function sellAll(): void {
  if (!table.length) return;
  let earned = 0;
  let bars = false;
  for (const thing of table) {
    if (thing === "diamond" && state.story === "start") bars = true;
    earned += price(thing);
    hooks.removeFromShelf(thing);
  }
  table = [];
  state.money += earned;
  if (bars) {
    state.story = "bars";
    hooks.addToShelf("gold bars");
  }
  let note = `You sold it all for ${formatMoney(earned)}!`;
  if (bars) note = `A man in a fancy hat looks at your diamond and gasps. He gives you 10 GOLD BARS for it! (Plus ${formatMoney(earned)}.) Maybe put them in the Bank?`;
  // Once the robber's stuff is all sold, a package turns up at home.
  if (state.story === "blasted" && !hooks.shelf().some(isLoot)) {
    state.story = "package";
    note += " ...You hear a delivery truck drive by your house. Maybe go home?";
  }
  save();
  playSound("levelup");
  renderMarket(note);
}

/** Climb out of the window into the 3D city. */
export function openWalk(roomHooks: WalkHooks): void {
  hooks = roomHooks;
  go("street");
  cam.x = -36;
  cam.z = 5;
  cam.yaw = Math.PI / 2;
  cam.pitch = 0;
  riding = null;
  dinged = false;
  boomAt = null;
  closeMarket();
  say("You climbed out the window! Everything is 3D! Walk with W A S D. Look around with the arrow keys (or drag the mouse). Find the elevator!");
  host.hidden = false;
  canvas.focus();
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}

function closeWalk(): void {
  host.hidden = true;
  running = false;
  held.clear();
}
