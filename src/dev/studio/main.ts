import * as sfx from "../../shared/sfx";
import { forgetMySound, keepMySound, loadMySounds, playMySound, type MySound } from "./mySounds";
import { DEFAULT_LOOK, IMPOSTOR_EYES, type Dev1Look } from "../dev1Figure";
import {
  DEFAULT_SKELETON,
  LIMBS,
  LIMB_NAMES,
  addJoint,
  blendPoses,
  copyPose,
  dragHandle,
  drawRig,
  makeRig,
  restPose,
  type Limb,
  type Pose,
  type Skeleton,
} from "./rig";

// dev.1 Studio: dev.1's ultra secret game, the one he made a long time ago.
// Make as many dev.1s as you like (dev.1e10, dev.563, …), dress them, put
// them on a stage with props (ready-made, drawn or imported), give everything
// an animation and a sound, and press Play. The only way in is through the
// end of dev.1's supercharged cutscene; it's on no hub and not on BIG games.

type Kind = "dev1" | "prop";

interface Item {
  id: number;
  kind: Kind;
  x: number; // percent across the stage
  y: number; // percent down the stage, where its feet are
  size: number; // grows both ways at once
  sizeY?: number; // stretches up and down only
  sizeZ?: number; // stretches side to side only
  flipped: boolean;
  animation: string;
  sound: string;
  soundOnce?: boolean; // play the sound just once, not every time it loops
  name?: string; // dev1 only, the part after "dev."
  look?: Dev1Look; // dev1 only
  skeleton?: Skeleton; // dev1 only: how long each bone is
  frames?: Pose[]; // dev1 only: his own animation, one pose per frame
  frameMs?: number; // how long each frame takes to blend into the next
  facing?: number; // dev1 only: degrees, 0 faces you and 180 shows his back
  rotation?: number; // degrees turned like a wheel; 180 is upside down
  originalImage?: string; // a prop's picture before its background was removed
  emoji?: string; // ready-made props
  image?: string; // drawn or imported props
}

interface Saved {
  items: Item[];
  background: string;
  myProps: string[];
  settings: Settings;
}

interface Settings {
  // Size bars that never run out: hit the end and they get longer.
  infiniteSliders: boolean;
}

const SAVE_KEY = "dev1-studio";

const SOUNDS: Record<string, () => void> = {
  none: () => {},
  bleep: () => sfx.bleep(4),
  chime: sfx.chime,
  laser: sfx.laser,
  zap: () => sfx.zap(0.2),
  crack: sfx.crack,
  boom: () => sfx.boom(1),
  "big boom": () => sfx.boom(3),
  whoosh: () => sfx.whoosh(0.6),
  rocket: () => sfx.rocket(1.2),
  boing: sfx.boing,
  thunk: sfx.thunk,
  scribble: () => sfx.scribble(1),
  buzzer: sfx.buzzer,
  "power up": sfx.powerUp,
  whir: () => sfx.whir(1),
  thunder: sfx.thunder,
};

// Each animation: how long one go takes, and what it does. Some only make
// sense for a dev.1 (they move his arms and legs), so props don't get them.
interface Move {
  label: string;
  ms: number;
  dev1Only?: boolean;
  frames?: Keyframe[];
  className?: string;
  // Bends a dev.1's bones. `t` goes from 0 to 1 over one go of the move.
  pose?: (t: number, rest: Pose) => Pose;
}

const wave = (t: number): number => Math.sin(t * Math.PI * 2);

const MOVES: Record<string, Move> = {
  none: { label: "None", ms: 1000 },
  // Everybody gets frames: props too. Only dev.1s have bones to bend.
  frames: { label: "🎞 My own frames", ms: 1000 },
  wave: {
    label: "Wave",
    ms: 1200,
    dev1Only: true,
    pose: (t, rest) => {
      const pose = copyPose(rest);
      // Up and out to the side, waving back and forth.
      pose.limbs.rightArm[0] = -150 + 20 * wave(t * 2);
      return pose;
    },
  },
  walk: {
    label: "Walk back and forth",
    ms: 4000,
    pose: (t, rest) => {
      const pose = copyPose(rest);
      const step = 22 * wave(t * 5);
      pose.limbs.leftLeg[0] = step;
      pose.limbs.rightLeg[0] = -step;
      pose.limbs.leftArm[0] = 8 - step * 0.7;
      pose.limbs.rightArm[0] = -8 + step * 0.7;
      return pose;
    },
    frames: [{ transform: "translateX(0)" }, { transform: "translateX(140px)" }, { transform: "translateX(0)" }, { transform: "translateX(-140px)" }, { transform: "translateX(0)" }],
  },
  jump: {
    label: "Jump",
    ms: 900,
    frames: [
      { transform: "translateY(0) scaleY(1)" },
      { transform: "translateY(0) scaleY(0.85)", offset: 0.15 },
      { transform: "translateY(-90px) scaleY(1.05)", offset: 0.5 },
      { transform: "translateY(0) scaleY(0.9)", offset: 0.9 },
      { transform: "translateY(0) scaleY(1)" },
    ],
  },
  spin: { label: "Spin", ms: 1200, frames: [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }] },
  dance: {
    label: "Dance",
    ms: 700,
    frames: [
      { transform: "rotate(-10deg) translateY(0)" },
      { transform: "rotate(0deg) translateY(-14px)" },
      { transform: "rotate(10deg) translateY(0)" },
      { transform: "rotate(0deg) translateY(-14px)" },
      { transform: "rotate(-10deg) translateY(0)" },
    ],
  },
  float: {
    label: "Float",
    ms: 2400,
    frames: [{ transform: "translateY(0)" }, { transform: "translateY(-30px)" }, { transform: "translateY(0)" }],
  },
  grow: {
    label: "Grow and shrink",
    ms: 1400,
    frames: [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
  },
  glitch: { label: "Glitch out", ms: 1000, className: "is-glitching" },
  explode: {
    label: "Explode (and come back)",
    ms: 2600,
    frames: [
      { transform: "scale(1)", opacity: 1, filter: "brightness(1)" },
      { transform: "scale(1) translateX(-4px)", opacity: 1, offset: 0.3 },
      { transform: "scale(1) translateX(4px)", opacity: 1, offset: 0.4 },
      { transform: "scale(1.8)", opacity: 0, filter: "brightness(3)", offset: 0.5 },
      { transform: "scale(0.2)", opacity: 0, offset: 0.8 },
      { transform: "scale(1)", opacity: 1, filter: "brightness(1)" },
    ],
  },
};

const READY_PROPS: [string, string][] = [
  ["🌙", "Moon"],
  ["👑", "Crown"],
  ["☀️", "Sun"],
  ["⭐", "Star"],
  ["☁️", "Cloud"],
  ["🌳", "Tree"],
  ["🏠", "House"],
  ["🚀", "Rocket"],
  ["⚡", "Lightning"],
  ["🥥", "Coconut drink"],
  ["💣", "Bomb"],
  ["💎", "Gem"],
  ["🔥", "Fire"],
  ["🏆", "Trophy"],
  ["🐱", "Cat"],
  ["🍕", "Pizza"],
  ["🎸", "Guitar"],
  ["🛸", "UFO"],
  ["🌋", "Volcano"],
  ["🎈", "Balloon"],
  ["🔨", "Mallet"],
  ["🦈", "Shark"],
  ["🌍", "The Earth"],
  ["🖥️", "Monitor"],
  // Stretch these with Size Y and Size Z to build walls and floors.
  ["🧱", "Brick wall"],
  ["⬛", "Block"],
];

// Ready-made props that are drawings rather than emoji. The Normal face is our
// own drawing of the green Normal-difficulty face from Geometry Dash.
const NORMAL_FACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><radialGradient id="g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8dff6a"/><stop offset="0.55" stop-color="#2fd12f"/><stop offset="1" stop-color="#0b8a12"/></radialGradient></defs>
  <circle cx="60" cy="60" r="54" fill="url(#g)" stroke="#000" stroke-width="6"/>
  <ellipse cx="42" cy="50" rx="13" ry="15" fill="#fff" stroke="#000" stroke-width="4"/>
  <ellipse cx="78" cy="50" rx="13" ry="15" fill="#fff" stroke="#000" stroke-width="4"/>
  <circle cx="45" cy="53" r="6" fill="#000"/>
  <circle cx="75" cy="53" r="6" fill="#000"/>
  <path d="M34 78 Q60 100 86 78" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/>
</svg>`;
const READY_PICTURES: [string, string][] = [[`data:image/svg+xml,${encodeURIComponent(NORMAL_FACE_SVG)}`, "Normal face"]];

const SKINS = ["#f2c49b", "#e0a878", "#c68654", "#8d5524", "#5c3a21", "#ffd9c2"];
const FUN_NAMES = ["1e10", "563", "2", "9000", "1.5", "42", "0.1", "77", "1000000", "3.14", "8", "404"];

const stage = element("stage");
const inspectorFields = element("inspector-fields");
const inspectorEmpty = element("inspector-empty");
const inspectorTitle = element("inspector-title");
const nameInput = element("name") as HTMLInputElement;
const hoodieInput = element("hoodie") as HTMLInputElement;
const skinSwatches = element("skin");
const eyesInput = element("eyes") as HTMLInputElement;
const sizeInput = element("size") as HTMLInputElement;
const animationSelect = element("animation") as HTMLSelectElement;
const soundSelect = element("sound") as HTMLSelectElement;
const playButton = element("play") as HTMLButtonElement;
const backgroundSelect = element("background") as HTMLSelectElement;
const propShelf = element("prop-shelf");
const propsButton = element("open-props") as HTMLButtonElement;
const myPropsGrid = element("my-props");

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`dev.1 Studio is missing #${id}`);
  return found;
}

let state: Saved = load();
let selectedId: number | null = null;
let playing = false;
let nextId = Math.max(0, ...state.items.map((item) => item.id)) + 1;
const nodes = new Map<number, HTMLElement>();
const running: { stop: () => void }[] = [];

// ── Saving ────────────────────────────────────────────────────────────────

function load(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Partial<Saved> | null;
    if (saved && Array.isArray(saved.items)) {
      return {
        items: saved.items,
        background: saved.background ?? "grid",
        myProps: saved.myProps ?? [],
        settings: { infiniteSliders: false, ...saved.settings },
      };
    }
  } catch {
    // Start fresh.
  }
  // A first stage, so there's something to look at straight away.
  return {
    background: "grid",
    settings: { infiniteSliders: false },
    myProps: [],
    items: [
      { id: 1, kind: "dev1", x: 30, y: 85, size: 1, flipped: false, animation: "wave", sound: "none", name: "1", look: { ...DEFAULT_LOOK } },
      { id: 2, kind: "dev1", x: 60, y: 85, size: 0.8, flipped: true, animation: "dance", sound: "none", name: "563", look: { ...DEFAULT_LOOK, hoodie: "#46a8ff" } },
      { id: 3, kind: "prop", x: 30, y: 30, size: 0.7, flipped: false, animation: "float", sound: "none", emoji: "👑" },
      { id: 4, kind: "prop", x: 85, y: 30, size: 1, flipped: false, animation: "none", sound: "none", emoji: "🌙" },
    ],
  };
}

let saveWarned = false;
function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Usually too many big pictures. Say so once rather than silently losing work.
    if (!saveWarned) element("stage-hint").textContent = "Your stage is too full to save. Try removing some drawn or imported props.";
    saveWarned = true;
  }
}

// ── Drawing the stage ─────────────────────────────────────────────────────

function render(): void {
  stage.className = `stage stage-${state.background}`;
  backgroundSelect.value = state.background;
  for (const [id, node] of nodes) {
    if (!state.items.some((item) => item.id === id)) {
      node.remove();
      nodes.delete(id);
    }
  }
  state.items.forEach((item, index) => {
    let node = nodes.get(item.id);
    if (!node) {
      node = makeNode(item);
      nodes.set(item.id, node);
      stage.appendChild(node);
    }
    placeNode(node, item, index);
  });
  renderInspector();
}

function makeNode(item: Item): HTMLElement {
  const node = document.createElement("div");
  node.className = "stage-item";
  node.dataset["id"] = String(item.id);
  const actor = document.createElement("div");
  actor.className = "stage-actor";
  if (item.kind === "dev1") {
    // The name tag rides along inside the actor, so it walks and jumps with him.
    const label = document.createElement("span");
    label.className = "stage-name";
    actor.append(makeRig(), label);
    node.appendChild(actor);
  } else {
    const prop = document.createElement("div");
    prop.className = "stage-prop";
    if (item.image) {
      const picture = document.createElement("img");
      picture.src = item.image;
      picture.alt = "";
      prop.appendChild(picture);
    } else {
      prop.textContent = item.emoji ?? "⭐";
    }
    actor.appendChild(prop);
    node.appendChild(actor);
  }
  node.addEventListener("pointerdown", (event) => startDrag(event, item.id));
  return node;
}

// A dev.1 doing his own frames stands wherever the frame you're on puts him.
function spotOf(item: Item, pose?: Pose): [number, number] {
  if (item.animation === "frames") {
    const shown = pose ?? stillPose(item);
    return [shown.x ?? item.x, shown.y ?? item.y];
  }
  return [item.x, item.y];
}

// Turned like a wheel: a frame's own rotation if it has one, otherwise the
// item's. It spins round its middle.
function rotationOf(item: Item, pose?: Pose): number {
  const frameTurn = item.animation === "frames" ? (pose ?? stillPose(item)).rotation : undefined;
  return frameTurn ?? item.rotation ?? 0;
}

function frameScaleOf(item: Item, pose?: Pose): number {
  return item.animation === "frames" ? ((pose ?? stillPose(item)).scale ?? 1) : 1;
}

function placeNode(node: HTMLElement, item: Item, index: number): void {
  const [x, y] = spotOf(item);
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;
  const actor = node.querySelector<HTMLElement>(".stage-actor");
  if (actor) actor.style.rotate = `${rotationOf(item)}deg`;
  node.style.setProperty("--frame-scale", String(frameScaleOf(item)));
  const picture = node.querySelector<HTMLImageElement>(".stage-prop img");
  if (picture && item.image && picture.src !== item.image) picture.src = item.image;
  node.style.zIndex = String(index + 1);
  node.style.setProperty("--size", String(item.size));
  node.style.setProperty("--size-y", String(item.sizeY ?? 1));
  node.style.setProperty("--size-z", String(item.sizeZ ?? 1));
  node.classList.toggle("is-flipped", item.flipped);
  node.classList.toggle("is-selected", item.id === selectedId);
  if (item.kind === "dev1") {
    drawDev1(item);
    const label = node.querySelector(".stage-name");
    if (label) label.textContent = `dev.${item.name ?? "1"}`;
  }
}

// ── Bones ─────────────────────────────────────────────────────────────────

// Which of the selected dev.1's frames you're bending right now.
let editingFrame = 0;

function skeletonOf(item: Item): Skeleton {
  item.skeleton ??= structuredClone(DEFAULT_SKELETON);
  return item.skeleton;
}

function framesOf(item: Item): Pose[] {
  if (!item.frames || item.frames.length === 0) item.frames = [restPose(skeletonOf(item))];
  return item.frames;
}

function isEditingBones(item: Item): boolean {
  return item.id === selectedId && item.animation === "frames" && !playing;
}

// Standing still, a dev.1 holds his first frame (or the frame you're on).
function stillPose(item: Item): Pose {
  if (!item.frames?.length) return restPose(skeletonOf(item));
  const frame = item.id === selectedId ? editingFrame : 0;
  return item.frames[Math.min(frame, item.frames.length - 1)] ?? restPose(skeletonOf(item));
}

function drawDev1(item: Item, pose = stillPose(item)): void {
  const svg = nodes.get(item.id)?.querySelector<SVGSVGElement>(".rig");
  // Frames that don't say which way he faces use the dev.1's own facing.
  const shown = pose.facing === undefined ? { ...pose, facing: item.facing ?? 0 } : pose;
  if (svg) drawRig(svg, item.look ?? DEFAULT_LOOK, skeletonOf(item), shown, isEditingBones(item));
}

// Glides through a dev.1's frames: `t` from 0 to 1 is one trip through all of
// them and back round to the first. Each frame eases into the next.
function framePose(item: Item, t: number): Pose {
  const frames = framesOf(item);
  const at = t * frames.length;
  const index = Math.floor(at) % frames.length;
  const k = at - Math.floor(at);
  const from = frames[index] ?? frames[0]!;
  const to = frames[(index + 1) % frames.length] ?? from;
  // A teleport holds this frame right up until the next one, then jumps.
  if (from.cut) return from;
  return blendPoses(from, to, k * k * (3 - 2 * k));
}

/** Which frame Play is on at `t` (0 to 1 through all of them). */
function frameIndexAt(item: Item, t: number): number {
  const count = framesOf(item).length;
  return Math.floor(t * count) % count;
}

// Drag a yellow dot to bend the joint it sits on. The dots are redrawn as
// you drag, so the whole drawing holds on to the pointer, not the dot.
function startBend(event: PointerEvent, item: Item, handle: SVGElement): void {
  const svg = handle.ownerSVGElement;
  const pose = framesOf(item)[editingFrame];
  if (!svg || !pose) return;
  event.stopPropagation();
  try {
    svg.setPointerCapture(event.pointerId);
  } catch {
    // Not a real pointer (or already gone); the drag still follows it.
  }
  // Remember which joint, since the dot itself gets replaced.
  const grabbed = handle.cloneNode() as SVGElement;
  const move = (moveEvent: PointerEvent): void => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(moveEvent.clientX, moveEvent.clientY).matrixTransform(matrix.inverse());
    dragHandle(skeletonOf(item), pose, grabbed, [point.x, point.y]);
    drawRig(svg, item.look ?? DEFAULT_LOOK, skeletonOf(item), pose, true);
  };
  const stop = (): void => {
    svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", stop);
    svg.removeEventListener("pointercancel", stop);
    drawDev1(item);
    save();
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
}

// Everything on the stage is sized for a 960-wide stage, then scaled to fit.
function fitStage(): void {
  stage.style.setProperty("--stage-scale", String(stage.clientWidth / 960));
}
new ResizeObserver(fitStage).observe(stage);

// ── Moving things around ──────────────────────────────────────────────────

function startDrag(event: PointerEvent, id: number): void {
  event.stopPropagation();
  const handle = event.target instanceof SVGElement && event.target.classList.contains("rig-handle") ? event.target : null;
  const item = find(id);
  if (handle && item) {
    startBend(event, item, handle);
    return;
  }
  select(id);
  const node = nodes.get(id);
  if (!item || !node) return;
  // Moving something keeps its layer; the layer buttons change that.
  node.setPointerCapture(event.pointerId);
  const box = stage.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  // Doing his own frames, moving him moves where he is in this frame only,
  // so each frame can put him somewhere new and Play walks him between them.
  const frame = item.animation === "frames" && !playing ? framesOf(item)[editingFrame] : undefined;
  const target: { x?: number; y?: number } = frame ?? item;
  const [fromX, fromY] = spotOf(item);
  const move = (moveEvent: PointerEvent): void => {
    target.x = clamp(fromX + ((moveEvent.clientX - startX) / box.width) * 100, 0, 100);
    target.y = clamp(fromY + ((moveEvent.clientY - startY) / box.height) * 100, 5, 105);
    node.style.left = `${target.x}%`;
    node.style.top = `${target.y}%`;
  };
  const drop = (): void => {
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", drop);
    node.removeEventListener("pointercancel", drop);
    save();
  };
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", drop);
  node.addEventListener("pointercancel", drop);
}

stage.addEventListener("pointerdown", () => select(null));

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function find(id: number | null): Item | undefined {
  return state.items.find((item) => item.id === id);
}

function select(id: number | null): void {
  if (id !== selectedId) editingFrame = 0;
  selectedId = id;
  for (const [nodeId, node] of nodes) node.classList.toggle("is-selected", nodeId === id);
  for (const item of state.items) if (item.kind === "dev1") drawDev1(item);
  renderInspector();
}

// ── Adding things ─────────────────────────────────────────────────────────

function add(item: Omit<Item, "id">): void {
  const made = { ...item, id: nextId++ };
  state.items.push(made);
  selectedId = made.id;
  render();
  save();
  sfx.boing();
  if (playing) restartPlay();
}

element("add-dev1").addEventListener("click", () => {
  const taken = new Set(state.items.map((item) => item.name));
  const name = FUN_NAMES.find((fun) => !taken.has(fun)) ?? String(Math.floor(Math.random() * 10000));
  add({
    kind: "dev1",
    x: 20 + Math.random() * 60,
    y: 85,
    size: 1,
    flipped: false,
    animation: "none",
    sound: "none",
    name,
    look: { ...DEFAULT_LOOK },
  });
});

propsButton.addEventListener("click", () => {
  propShelf.hidden = !propShelf.hidden;
  propsButton.setAttribute("aria-expanded", String(!propShelf.hidden));
});

function addProp(prop: { emoji?: string; image?: string }): void {
  add({ kind: "prop", x: 20 + Math.random() * 60, y: 50, size: 1, flipped: false, animation: "none", sound: "none", ...prop });
}

const readyGrid = element("ready-props");
for (const [emoji, name] of READY_PROPS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = emoji;
  button.title = name;
  button.setAttribute("aria-label", `Add a ${name.toLowerCase()}`);
  button.addEventListener("click", () => addProp({ emoji }));
  readyGrid.appendChild(button);
}
for (const [image, name] of READY_PICTURES) {
  const button = document.createElement("button");
  button.type = "button";
  button.title = name;
  button.setAttribute("aria-label", `Add a ${name.toLowerCase()}`);
  const picture = document.createElement("img");
  picture.src = image;
  picture.alt = "";
  button.appendChild(picture);
  button.addEventListener("click", () => addProp({ image }));
  readyGrid.appendChild(button);
}

function renderMyProps(): void {
  myPropsGrid.replaceChildren();
  if (state.myProps.length === 0) {
    const empty = document.createElement("span");
    empty.className = "shelf-empty";
    empty.textContent = "Draw or import a prop and it shows up here.";
    myPropsGrid.appendChild(empty);
    return;
  }
  state.myProps.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Add your prop number ${index + 1}`);
    const picture = document.createElement("img");
    picture.src = image;
    picture.alt = "";
    button.appendChild(picture);
    button.addEventListener("click", () => addProp({ image }));
    myPropsGrid.appendChild(button);
  });
}

function keepProp(image: string): void {
  if (!state.myProps.includes(image)) state.myProps.push(image);
  renderMyProps();
  addProp({ image });
}

// Imported pictures are shrunk to fit 256×256 so the save doesn't get huge.
element("import-prop").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const url = URL.createObjectURL(file);
  const picture = new Image();
  picture.onload = () => {
    const fit = Math.min(1, 256 / Math.max(picture.width, picture.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(picture.width * fit));
    canvas.height = Math.max(1, Math.round(picture.height * fit));
    canvas.getContext("2d")?.drawImage(picture, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    keepProp(canvas.toDataURL("image/png"));
  };
  picture.onerror = () => URL.revokeObjectURL(url);
  picture.src = url;
});

// ── Drawing your own prop ─────────────────────────────────────────────────

const drawDialog = element("draw-dialog") as HTMLDialogElement;
const drawCanvas = element("draw-canvas") as HTMLCanvasElement;
const drawContext = drawCanvas.getContext("2d");
const drawColor = element("draw-color") as HTMLInputElement;
const drawSize = element("draw-size") as HTMLInputElement;
let drewSomething = false;

element("draw-prop").addEventListener("click", () => {
  drawContext?.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drewSomething = false;
  drawDialog.showModal();
});

element("draw-clear").addEventListener("click", () => {
  drawContext?.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drewSomething = false;
});

drawCanvas.addEventListener("pointerdown", (event) => {
  if (!drawContext) return;
  drawCanvas.setPointerCapture(event.pointerId);
  const spot = (pointer: PointerEvent): [number, number] => {
    const box = drawCanvas.getBoundingClientRect();
    return [((pointer.clientX - box.left) / box.width) * drawCanvas.width, ((pointer.clientY - box.top) / box.height) * drawCanvas.height];
  };
  drawContext.strokeStyle = drawColor.value;
  drawContext.lineWidth = Number(drawSize.value);
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  drawContext.beginPath();
  drawContext.moveTo(...spot(event));
  drawContext.lineTo(...spot(event));
  drawContext.stroke();
  drewSomething = true;
  const move = (moveEvent: PointerEvent): void => {
    drawContext.lineTo(...spot(moveEvent));
    drawContext.stroke();
  };
  const stop = (): void => {
    drawCanvas.removeEventListener("pointermove", move);
    drawCanvas.removeEventListener("pointerup", stop);
  };
  drawCanvas.addEventListener("pointermove", move);
  drawCanvas.addEventListener("pointerup", stop);
});

drawDialog.addEventListener("close", () => {
  if (drawDialog.returnValue === "save" && drewSomething) keepProp(drawCanvas.toDataURL("image/png"));
});

// ── Changing the selected thing ───────────────────────────────────────────

for (const [key, move] of Object.entries(MOVES)) {
  const option = document.createElement("option");
  option.value = key;
  option.textContent = move.label;
  animationSelect.appendChild(option);
}
// ── Sounds: the library plus any you import ───────────────────────────────

// Imported sounds are picked as "my:<id>", so they never clash with the
// library's names.
let mySounds: MySound[] = [];

function soundFor(key: string): (() => void) | undefined {
  if (key.startsWith("my:")) {
    const mine = mySounds.find((sound) => `my:${sound.id}` === key);
    return mine ? () => playMySound(mine) : undefined;
  }
  return SOUNDS[key];
}

function fillSoundSelect(): void {
  const chosen = soundSelect.value;
  soundSelect.replaceChildren();
  for (const key of Object.keys(SOUNDS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key === "none" ? "None" : key;
    soundSelect.appendChild(option);
  }
  if (mySounds.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Your sounds";
    for (const sound of mySounds) {
      const option = document.createElement("option");
      option.value = `my:${sound.id}`;
      option.textContent = sound.name;
      group.appendChild(option);
    }
    soundSelect.appendChild(group);
  }
  soundSelect.value = chosen;
}
fillSoundSelect();
for (const skin of SKINS) {
  const button = document.createElement("button");
  button.type = "button";
  button.style.background = skin;
  button.dataset["skin"] = skin;
  button.setAttribute("aria-label", `Skin colour ${skin}`);
  button.addEventListener("click", () => changeLook({ skin }));
  skinSwatches.appendChild(button);
}

function renderInspector(): void {
  const item = find(selectedId);
  inspectorFields.hidden = !item;
  inspectorEmpty.hidden = Boolean(item);
  if (!item) return;
  const isDev1 = item.kind === "dev1";
  inspectorTitle.textContent = isDev1 ? `dev.${item.name ?? "1"}` : "Prop";
  for (const id of ["name-field", "hoodie-field", "skin-field", "eyes-field", "facing-field"]) element(id).hidden = !isDev1;
  if (isDev1) {
    const look = item.look ?? DEFAULT_LOOK;
    if (document.activeElement !== nameInput) nameInput.value = item.name ?? "1";
    hoodieInput.value = look.hoodie;
    if (document.activeElement !== eyesInput) eyesInput.value = look.eyes;
    for (const swatch of skinSwatches.querySelectorAll<HTMLElement>("button")) {
      swatch.setAttribute("aria-pressed", String(swatch.dataset["skin"] === look.skin));
    }
  }
  if (isDev1 && document.activeElement !== facingInput) facingInput.value = String(Math.round(facingOf(item)));
  const turned = Math.round(rotationOf(item));
  if (document.activeElement !== rotationInput) rotationInput.value = String(turned);
  if (document.activeElement !== rotationBar) rotationBar.value = String(((turned % 360) + 540) % 360 - 180);
  element("background-field").hidden = !item.image;
  element("restore-bg").hidden = !item.originalImage;
  fitBar(sizeInput, item.size);
  fitBar(sizeYInput, item.sizeY ?? 1);
  fitBar(sizeZInput, item.sizeZ ?? 1);
  const index = state.items.indexOf(item);
  element("layer-label").textContent = `Layer ${index + 1} of ${state.items.length}`;
  for (const option of animationSelect.options) option.hidden = !isDev1 && Boolean(MOVES[option.value]?.dev1Only);
  animationSelect.value = item.animation;
  soundSelect.value = item.sound;
  soundWhen.value = item.soundOnce ? "once" : "loop";
  renderFramesPanel(item);
}

// ── Frames and joints ─────────────────────────────────────────────────────

const framesField = element("frames-field");
const frameList = element("frame-list");
const frameSpeed = element("frame-speed") as HTMLInputElement;
const jointButtons = element("joint-buttons");

for (const limb of LIMBS) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `＋ ${LIMB_NAMES[limb]}`;
  button.setAttribute("aria-label", `Add a joint to the ${LIMB_NAMES[limb].toLowerCase()}`);
  button.addEventListener("click", () => addJointTo(limb));
  jointButtons.appendChild(button);
}

function renderFramesPanel(item: Item): void {
  framesField.hidden = item.animation !== "frames";
  // Bones and joints are only for dev.1s; props just move, turn and grow.
  element("bones-part").hidden = item.kind !== "dev1";
  element("prop-frames-hint").hidden = item.kind === "dev1";
  if (framesField.hidden) return;
  const frames = framesOf(item);
  editingFrame = Math.min(editingFrame, frames.length - 1);
  // Frame numbers with a transition button between each pair (and from the
  // last back round to the first): 〰 glides, ⚡ teleports.
  frameList.replaceChildren(
    ...frames.flatMap((frame, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = String(index + 1);
      chip.setAttribute("aria-label", `Frame ${index + 1}`);
      chip.setAttribute("aria-pressed", String(index === editingFrame && openTransition === null));
      chip.addEventListener("click", () => {
        editingFrame = index;
        openTransition = null;
        render();
      });
      if (frames.length < 2) return [chip];
      const next = ((index + 1) % frames.length) + 1;
      const link = document.createElement("button");
      link.type = "button";
      link.className = "frame-link";
      link.textContent = frame.cut ? "⚡" : "〰";
      link.setAttribute("aria-label", `Transition from frame ${index + 1} to ${next}: ${frame.cut ? "teleport" : "glide"}`);
      link.setAttribute("aria-pressed", String(openTransition === index));
      link.addEventListener("click", () => {
        openTransition = openTransition === index ? null : index;
        renderFramesPanel(item);
      });
      return [chip, link];
    })
  );
  renderTransitionPanel(item, frames);
  if (document.activeElement !== frameStage) frameStage.value = frames[editingFrame]?.stage ?? "";
  frameSpeed.value = String(item.frameMs ?? 500);
  if (document.activeElement !== frameSize) frameSize.value = String(frames[editingFrame]?.scale ?? 1);
}

// The transition you've opened, by the frame it starts from.
let openTransition: number | null = null;
const transitionPanel = element("transition-panel");
const frameStage = element("frame-stage") as HTMLSelectElement;

function renderTransitionPanel(item: Item, frames: Pose[]): void {
  const from = openTransition === null ? undefined : frames[openTransition];
  transitionPanel.hidden = !from;
  if (!from || openTransition === null) return;
  const next = ((openTransition + 1) % frames.length) + 1;
  element("transition-title").textContent = `Frame ${openTransition + 1} → ${next}`;
  element("transition-glide").setAttribute("aria-pressed", String(!from.cut));
  element("transition-cut").setAttribute("aria-pressed", String(Boolean(from.cut)));
  void item;
}

function setTransition(cut: boolean): void {
  changeFrames((_, frames) => {
    const from = openTransition === null ? undefined : frames[openTransition];
    if (!from) return;
    if (cut) from.cut = true;
    else delete from.cut;
    if (cut) sfx.zap(0.12);
    else sfx.whoosh(0.3);
  });
}
element("transition-glide").addEventListener("click", () => setTransition(false));
element("transition-cut").addEventListener("click", () => setTransition(true));

// A frame can switch the whole stage when Play gets to it.
frameStage.addEventListener("change", () =>
  changeFrames((_, frames) => {
    const frame = frames[editingFrame];
    if (!frame) return;
    if (frameStage.value) frame.stage = frameStage.value;
    else delete frame.stage;
  })
);

function changeFrames(change: (item: Item, frames: Pose[]) => void): void {
  const item = find(selectedId);
  if (!item) return;
  change(item, framesOf(item));
  render();
  save();
  if (playing) restartPlay();
}

// A new frame starts as a copy of the one you're on, so you only nudge a
// limb or two to make the next step of the move.
element("frame-add").addEventListener("click", () =>
  changeFrames((_, frames) => {
    const current = frames[editingFrame] ?? frames[0]!;
    // Pin down where he is now, so this frame keeps its spot when the next
    // one moves him.
    const item = find(selectedId);
    if (item) [current.x, current.y] = spotOf(item, current);
    frames.splice(editingFrame + 1, 0, copyPose(current));
    editingFrame += 1;
    sfx.bleep(frames.length);
  })
);
element("frame-remove").addEventListener("click", () =>
  changeFrames((_, frames) => {
    if (frames.length <= 1) return;
    frames.splice(editingFrame, 1);
    editingFrame = Math.max(0, editingFrame - 1);
    sfx.crack();
  })
);
element("pose-reset").addEventListener("click", () =>
  changeFrames((item, frames) => {
    frames[editingFrame] = restPose(skeletonOf(item));
  })
);
const frameSize = element("frame-size") as HTMLInputElement;
frameSize.addEventListener("input", () =>
  changeFrames((_, frames) => {
    const frame = frames[editingFrame];
    if (frame) frame.scale = Number(frameSize.value);
  })
);

frameSpeed.addEventListener("input", () =>
  changeFrames((item) => {
    item.frameMs = Number(frameSpeed.value);
  })
);

function addJointTo(limb: Limb): void {
  changeFrames((item, frames) => {
    addJoint(skeletonOf(item), frames, limb);
    sfx.zap(0.15);
  });
}

// Back to just elbows and knees. Each frame keeps how the first bones were
// turned, and the extra bends go away.
element("joints-reset").addEventListener("click", () =>
  changeFrames((item, frames) => {
    item.skeleton = structuredClone(DEFAULT_SKELETON);
    for (const frame of frames) {
      for (const limb of LIMBS) {
        frame.limbs[limb] = DEFAULT_SKELETON[limb].map((_, bone) => frame.limbs[limb][bone] ?? 0);
      }
    }
  })
);

function changeSelected(change: (item: Item) => void): void {
  const item = find(selectedId);
  if (!item) return;
  change(item);
  render();
  save();
  if (playing) restartPlay();
}

function changeLook(change: Partial<Dev1Look>): void {
  changeSelected((item) => {
    item.look = { ...(item.look ?? DEFAULT_LOOK), ...change };
  });
}

// Names are always "dev." and then whatever you type: dev.1e10, dev.563.
nameInput.addEventListener("input", () =>
  changeSelected((item) => {
    item.name = nameInput.value.trim() || "1";
  })
);
hoodieInput.addEventListener("input", () => changeLook({ hoodie: hoodieInput.value }));
// Only \ / < and > make eyes; anything else typed is left out.
eyesInput.addEventListener("input", () => changeLook({ eyes: eyesInput.value.replace(/[^\\/<>]/g, "") || IMPOSTOR_EYES }));
// ── Facing ────────────────────────────────────────────────────────────────

const facingInput = element("facing") as HTMLInputElement;

// Doing his own frames, each frame can face its own way, so Play turns him
// round. Otherwise it's just which way the dev.1 faces.
function facingOf(item: Item): number {
  const frame = item.animation === "frames" ? item.frames?.[editingFrame] : undefined;
  return frame?.facing ?? item.facing ?? 0;
}

function setFacing(degrees: number): void {
  if (!Number.isFinite(degrees)) return;
  changeSelected((item) => {
    const frame = item.animation === "frames" ? framesOf(item)[editingFrame] : undefined;
    if (frame) frame.facing = degrees;
    else item.facing = degrees;
  });
}

facingInput.addEventListener("input", () => setFacing(Number(facingInput.value)));

// ── Rotation ──────────────────────────────────────────────────────────────

const rotationInput = element("rotation") as HTMLInputElement;
const rotationBar = element("rotation-bar") as HTMLInputElement;

function setRotation(degrees: number): void {
  if (!Number.isFinite(degrees)) return;
  changeSelected((item) => {
    const frame = item.animation === "frames" ? framesOf(item)[editingFrame] : undefined;
    if (frame) frame.rotation = degrees;
    else item.rotation = degrees;
  });
}

rotationInput.addEventListener("input", () => setRotation(Number(rotationInput.value)));
rotationBar.addEventListener("input", () => {
  rotationInput.value = rotationBar.value;
  setRotation(Number(rotationBar.value));
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-rotation]")) {
  button.addEventListener("click", () => {
    setRotation(Number(button.dataset["rotation"]));
    sfx.whoosh(0.3);
  });
}

// ── Removing a picture's background ───────────────────────────────────────

// Whatever colour is round the edges of the picture is the background:
// starting from the edges, wash away every touching pixel of nearly that
// colour, so only the thing in the middle is left.
function removeBackground(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const picture = new Image();
    picture.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = picture.naturalWidth;
      canvas.height = picture.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("no canvas"));
      context.drawImage(picture, 0, 0);
      const { width, height } = canvas;
      const image = context.getImageData(0, 0, width, height);
      const pixels = image.data;
      const at = (x: number, y: number): number => (y * width + x) * 4;
      const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)].map((i) => [
        pixels[i] ?? 0,
        pixels[i + 1] ?? 0,
        pixels[i + 2] ?? 0,
      ]);
      const isBackground = (i: number): boolean =>
        (pixels[i + 3] ?? 0) > 0 &&
        corners.some(([r = 0, g = 0, b = 0]) => Math.abs((pixels[i] ?? 0) - r) + Math.abs((pixels[i + 1] ?? 0) - g) + Math.abs((pixels[i + 2] ?? 0) - b) < 90);
      const seen = new Uint8Array(width * height);
      const queue: number[] = [];
      for (let x = 0; x < width; x++) queue.push(x, (height - 1) * width + x);
      for (let y = 0; y < height; y++) queue.push(y * width, y * width + width - 1);
      while (queue.length > 0) {
        const spot = queue.pop()!;
        if (seen[spot]) continue;
        seen[spot] = 1;
        if (!isBackground(spot * 4)) continue;
        pixels[spot * 4 + 3] = 0;
        const x = spot % width;
        if (x > 0) queue.push(spot - 1);
        if (x < width - 1) queue.push(spot + 1);
        if (spot >= width) queue.push(spot - width);
        if (spot < width * (height - 1)) queue.push(spot + width);
      }
      context.putImageData(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    picture.onerror = () => reject(new Error("picture didn't load"));
    picture.src = source;
  });
}

// Swap a picture for a new one everywhere: on the stage and in Your props.
function swapPicture(item: Item, image: string): void {
  const old = item.image;
  item.image = image;
  state.myProps = state.myProps.map((prop) => (prop === old ? image : prop));
  renderMyProps();
  render();
  save();
}

element("remove-bg").addEventListener("click", async () => {
  const item = find(selectedId);
  if (!item?.image) return;
  const cleaned = await removeBackground(item.image).catch(() => null);
  if (!cleaned) return;
  item.originalImage ??= item.image;
  swapPicture(item, cleaned);
  sfx.zap(0.15);
});
element("restore-bg").addEventListener("click", () => {
  const item = find(selectedId);
  if (!item?.originalImage) return;
  const original = item.originalImage;
  delete item.originalImage;
  swapPicture(item, original);
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-facing]")) {
  button.addEventListener("click", () => {
    setFacing(Number(button.dataset["facing"]));
    facingInput.value = button.dataset["facing"] ?? "0";
    sfx.whoosh(0.3);
  });
}

// ── Size bars ─────────────────────────────────────────────────────────────

const sizeYInput = element("size-y") as HTMLInputElement;
const sizeZInput = element("size-z") as HTMLInputElement;
const SIZE_BARS: [HTMLInputElement, "size" | "sizeY" | "sizeZ"][] = [
  [sizeInput, "size"],
  [sizeYInput, "sizeY"],
  [sizeZInput, "sizeZ"],
];
const NORMAL_MAX = 2.5;

// With infinite sliders on, a bar that's slid to its end doubles its length,
// so you can keep sliding forever.
function fitBar(bar: HTMLInputElement, value: number): void {
  // Leave a bar alone while it's being slid, or the thumb would jump.
  if (document.activeElement === bar) return;
  const max = state.settings.infiniteSliders ? Math.max(NORMAL_MAX, value * 1.25) : NORMAL_MAX;
  bar.max = String(max);
  bar.step = "any";
  bar.value = String(value);
}

for (const [bar, key] of SIZE_BARS) {
  bar.addEventListener("input", () => {
    const value = Number(bar.value);
    if (state.settings.infiniteSliders && value >= Number(bar.max) * 0.98) bar.max = String(Number(bar.max) * 2);
    changeSelected((item) => {
      item[key] = value;
    });
  });
  // Let go and the bar settles back to fit, with room to keep going.
  bar.addEventListener("change", () => bar.blur());
}

// ── Layers ────────────────────────────────────────────────────────────────

// Later in the list is further in front. "To back" puts something behind
// everything else, so a big prop can be the background.
function moveLayer(change: (index: number, last: number) => number): void {
  const index = state.items.findIndex((item) => item.id === selectedId);
  const item = state.items[index];
  if (!item) return;
  const to = Math.max(0, Math.min(state.items.length - 1, change(index, state.items.length - 1)));
  state.items.splice(index, 1);
  state.items.splice(to, 0, item);
  render();
  save();
  sfx.bleep(to);
}
element("layer-front").addEventListener("click", () => moveLayer((_, last) => last));
element("layer-forward").addEventListener("click", () => moveLayer((index) => index + 1));
element("layer-back").addEventListener("click", () => moveLayer((index) => index - 1));
element("layer-bottom").addEventListener("click", () => moveLayer(() => 0));

// ── Settings ──────────────────────────────────────────────────────────────

const settingsBox = element("settings");
const settingsButton = element("open-settings") as HTMLButtonElement;
const infiniteToggle = element("infinite-sliders") as HTMLInputElement;
infiniteToggle.checked = state.settings.infiniteSliders;
settingsButton.addEventListener("click", () => {
  settingsBox.hidden = !settingsBox.hidden;
  settingsButton.setAttribute("aria-expanded", String(!settingsBox.hidden));
});
infiniteToggle.addEventListener("change", () => {
  state.settings.infiniteSliders = infiniteToggle.checked;
  // Turning it off squeezes anything giant back down to the normal biggest.
  if (!infiniteToggle.checked) {
    for (const item of state.items) {
      item.size = Math.min(item.size, NORMAL_MAX);
      if (item.sizeY !== undefined) item.sizeY = Math.min(item.sizeY, NORMAL_MAX);
      if (item.sizeZ !== undefined) item.sizeZ = Math.min(item.sizeZ, NORMAL_MAX);
    }
  }
  render();
  save();
});
animationSelect.addEventListener("change", () =>
  changeSelected((item) => {
    item.animation = animationSelect.value;
    if (item.animation === "frames") {
      framesOf(item);
      editingFrame = 0;
    }
  })
);
soundSelect.addEventListener("change", () => {
  changeSelected((item) => {
    item.sound = soundSelect.value;
  });
  soundFor(soundSelect.value)?.();
});
element("sound-test").addEventListener("click", () => soundFor(soundSelect.value)?.());
const soundWhen = element("sound-when") as HTMLSelectElement;
soundWhen.addEventListener("change", () =>
  changeSelected((item) => {
    item.soundOnce = soundWhen.value === "once";
  })
);
element("flip").addEventListener("click", () =>
  changeSelected((item) => {
    item.flipped = !item.flipped;
  })
);
element("duplicate").addEventListener("click", () => {
  const item = find(selectedId);
  if (!item) return;
  const { id: _id, ...copy } = structuredClone(item);
  add({ ...copy, x: clamp(item.x + 6, 0, 100), name: item.kind === "dev1" ? `${item.name ?? "1"}.copy` : undefined });
});
element("remove").addEventListener("click", removeSelected);

function removeSelected(): void {
  if (selectedId === null) return;
  state.items = state.items.filter((item) => item.id !== selectedId);
  selectedId = null;
  render();
  save();
  sfx.crack();
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  if (event.key === "Delete" || event.key === "Backspace") removeSelected();
});

backgroundSelect.addEventListener("change", () => {
  state.background = backgroundSelect.value;
  render();
  save();
});

element("clear").addEventListener("click", () => {
  if (state.items.length === 0) return;
  state.items = [];
  selectedId = null;
  render();
  save();
  sfx.boom(2);
});

// ── Playing it all ────────────────────────────────────────────────────────

function moveLength(item: Item, move: Move): number {
  return item.animation === "frames" ? framesOf(item).length * (item.frameMs ?? 500) : move.ms;
}

function startPlay(): void {
  playing = true;
  playButton.textContent = "■ Stop";
  const posed: { item: Item; ms: number; pose: (t: number) => Pose }[] = [];
  for (const item of state.items) {
    const node = nodes.get(item.id);
    const actor = node?.querySelector<HTMLElement>(".stage-actor");
    const move = MOVES[item.animation];
    if (!node || !actor || !move) continue;
    const ms = moveLength(item, move);
    if (move.className) actor.classList.add(move.className);
    const animation = move.frames ? actor.animate(move.frames, { duration: ms, iterations: Infinity, easing: "ease-in-out" }) : null;
    if (item.animation === "frames") posed.push({ item, ms, pose: (t) => framePose(item, t) });
    else if (item.kind === "dev1" && move.pose) {
      const rest = stillPose(item);
      posed.push({ item, ms, pose: (t) => move.pose!(t, rest) });
    }
    if (item.kind === "dev1") drawDev1(item);
    const sound = soundFor(item.sound);
    let timer = 0;
    if (sound && item.sound !== "none") {
      sound();
      if (!item.soundOnce) timer = window.setInterval(sound, ms);
    }
    running.push({
      stop: () => {
        animation?.cancel();
        if (move.className) actor.classList.remove(move.className);
        window.clearInterval(timer);
      },
    });
  }

  // Bones bend every frame of the screen, so the moves come out smooth.
  const started = performance.now();
  let frame = 0;
  const reached = new Map<number, number>();
  const tick = (now: number): void => {
    for (const { item, ms, pose } of posed) {
      const t = ((now - started) % ms) / ms;
      const current = pose(t);
      // Arriving at a frame that changes the stage switches it, until Stop.
      if (item.animation === "frames") {
        const index = frameIndexAt(item, t);
        if (reached.get(item.id) !== index) {
          reached.set(item.id, index);
          const stageChange = framesOf(item)[index]?.stage;
          if (stageChange) stage.className = `stage stage-${stageChange}`;
        }
      }
      if (item.kind === "dev1") drawDev1(item, current);
      // His own frames can move him round the stage, from spot to spot and
      // back to the first one again.
      const node = nodes.get(item.id);
      if (node && item.animation === "frames") {
        const [x, y] = spotOf(item, current);
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        const actor = node.querySelector<HTMLElement>(".stage-actor");
        if (actor) actor.style.rotate = `${rotationOf(item, current)}deg`;
        node.style.setProperty("--frame-scale", String(frameScaleOf(item, current)));
      }
    }
    frame = requestAnimationFrame(tick);
  };
  if (posed.length > 0) frame = requestAnimationFrame(tick);
  running.push({
    stop: () => {
      cancelAnimationFrame(frame);
      render();
    },
  });
}

function stopPlay(): void {
  playing = false;
  playButton.textContent = "▶ Play";
  running.splice(0).forEach((handle) => handle.stop());
  for (const item of state.items) if (item.kind === "dev1") drawDev1(item);
}

function restartPlay(): void {
  stopPlay();
  startPlay();
}

playButton.addEventListener("click", () => (playing ? stopPlay() : startPlay()));

// ── Sound effect library ──────────────────────────────────────────────────

const board = element("sound-board");
const myBoard = element("my-sound-board");
for (const [key, play] of Object.entries(SOUNDS)) {
  if (key === "none") continue;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `🔊 ${key}`;
  button.addEventListener("click", play);
  board.appendChild(button);
}

function renderMySounds(): void {
  myBoard.replaceChildren();
  if (mySounds.length === 0) {
    const empty = document.createElement("span");
    empty.className = "shelf-empty";
    empty.textContent = "Import a sound and it shows up here, and in every Sound menu.";
    myBoard.appendChild(empty);
  }
  for (const sound of mySounds) {
    const chip = document.createElement("span");
    chip.className = "my-sound";
    const play = document.createElement("button");
    play.type = "button";
    play.textContent = `🔊 ${sound.name}`;
    play.addEventListener("click", () => playMySound(sound));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", `Delete the sound ${sound.name}`);
    remove.addEventListener("click", () => void deleteMySound(sound));
    chip.append(play, remove);
    myBoard.appendChild(chip);
  }
  fillSoundSelect();
}

// Anything using a deleted sound goes quiet rather than breaking.
async function deleteMySound(sound: MySound): Promise<void> {
  await forgetMySound(sound.id).catch(() => {});
  mySounds = mySounds.filter((kept) => kept.id !== sound.id);
  for (const item of state.items) if (item.sound === `my:${sound.id}`) item.sound = "none";
  save();
  renderMySounds();
  renderInspector();
}

// Sound files only: the name shown is the file's name without its ending.
const MAX_SOUND_BYTES = 20 * 1024 * 1024;
element("import-sound").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const note = element("sound-note");
  if (!file.type.startsWith("audio/")) {
    note.textContent = "That isn't a sound file. Try an .mp3, .wav or .ogg.";
    return;
  }
  if (file.size > MAX_SOUND_BYTES) {
    note.textContent = "That sound is too big. Try one under 20 MB.";
    return;
  }
  const sound: MySound = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "my sound",
    file,
  };
  try {
    await keepMySound(sound);
  } catch {
    note.textContent = "Couldn't save that sound in this browser.";
    return;
  }
  note.textContent = `Added "${sound.name}".`;
  mySounds.push(sound);
  renderMySounds();
  playMySound(sound);
});

void loadMySounds().then((loaded) => {
  mySounds = loaded;
  renderMySounds();
  renderInspector();
});

renderMyProps();
render();
fitStage();
