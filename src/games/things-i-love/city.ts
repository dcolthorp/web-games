import { dollhouseParts, makeModels } from "./models";
import { buildModel, drawModel, projectPoint, type Built } from "./render3d";
import { playSound, type SoundName } from "./sounds";
import { BUILD_PAY, buildDone, drawEngineer, engineerDown, engineerMove, engineerUp, newBuild, planName } from "./engineer";
import { formatMoney, MAX_FLOORS, save, state } from "./state";
import { CITY_THEME, cloudSpots, DIMENSIONS, drawBackdrop, drawCloud, drawProp, SCENES, SCRATCH_LINE, type Dimension, type Scene } from "./dimensions";

// Oscar's city: click a car and you drive out into the city. Work at the Box
// Factory to earn money (and get promoted), spend it at the Dollhouse
// Builder for more floors, and mix potions at the Lab. For $100,000,000 the
// Lab's portal turns on: it takes you to the Portal Hub, where you pick a
// dimension to visit (see dimensions.ts). Everything is saved
// in state.ts, so your money and stuff are still there next time.
//
// The meteor: after the Doomsday Device's red button is pressed, a meteor
// heads for the Dino Dimension. Your car explodes when you get there, so you
// run to T-Rex's wrecked house and the Dino Nest, pick everyone up, and
// escape through the portal. Then the dinos live in your box room (main.ts).

const W = 900;
const H = 440;
const ROAD_Y = 360;
const STREET_W = 2100;
const DOOR_NEAR = 70;

type Mode = "street" | "dimension" | "hub" | "factory" | "jobs" | "engineer" | "builder" | "lab" | "scene";

interface Place {
  name: string;
  x: number;
  color: string;
  // "home", "factory", "builder" or "lab" in the city; "hub" is a portal
  // back to the Portal Hub, and "scene:<id>" is a place in a dimension.
  goes: string;
  sign?: string; // sign colour, if it isn't white
}

// Your job's building changes with your job: the Box Factory, or (once you
// pick Engineer on the Job Board) the red Engineering Station.
const BOX_FACTORY: Place = { name: "Box Factory", x: 760, color: "#c9965f", goes: "factory" };
const ENGINEERING: Place = { name: "Engineering Station", x: 760, color: "#e8383d", goes: "engineer", sign: "#8b1a1a" };
const HOME: Place = { name: "Home", x: 230, color: "#ff9fcf", goes: "home" };
const BUILDER: Place = { name: "Dollhouse Builder", x: 1300, color: "#ffd27a", goes: "builder" };
const LAB: Place = { name: "Lab", x: 1840, color: "#9ce8b4", goes: "lab" };
// Kept as two fixed lists so the controls can tell when you've driven up to
// a different building (see dimPlaces below).
const CITY_BOX: Place[] = [HOME, BOX_FACTORY, BUILDER, LAB];
const CITY_ENGINEER: Place[] = [HOME, ENGINEERING, BUILDER, LAB];
const cityPlaces = (): Place[] => (state.career === "engineer" ? CITY_ENGINEER : CITY_BOX);
const JOBS = [
  { title: "Box Taper", pay: 10 },
  { title: "Box Boss", pay: 200 },
  { title: "Box Manager", pay: 5_000 },
  { title: "Box CEO", pay: 100_000 },
  { title: "Box Billionaire", pay: 2_000_000 },
];
/** What it costs to get promoted from each job to the next. */
const PROMOTION = [500, 10_000, 300_000, 5_000_000];
/** What it costs to add a floor to a dollhouse that has this many floors. */
const FLOOR_COST: Record<number, number> = { 2: 1_000, 3: 20_000, 4: 500_000, 5: 10_000_000 };
const PORTAL_COST = 100_000_000;
const SHIFT_MS = 20_000;
const OVERTIME_MS = 50_000;

const INGREDIENTS = [
  { id: "slime", name: "Slime", color: "#6fd48f" },
  { id: "glitter", name: "Glitter", color: "#ff8fc7" },
  { id: "fizzy", name: "Fizzy Water", color: "#7fc8ff" },
  { id: "moon", name: "Moon Dust", color: "#c9ced6" },
  { id: "dragon", name: "Dragon Sneeze", color: "#ff9226" },
  { id: "banana", name: "Banana Juice", color: "#ffe36e" },
] as const;

type Puff = "bubbles" | "sparkles" | "stars" | "smoke" | "boom" | "float";

interface Potion {
  name: string;
  color: string;
  says: string;
  puff: Puff;
  sound: SoundName;
}

const POTIONS: Record<string, Potion> = {
  "glitter+slime": { name: "Sparkle Slime", color: "#c98fff", says: "It sparkles and wiggles!", puff: "sparkles", sound: "magic" },
  "fizzy+slime": { name: "Burp Potion", color: "#7fe0b0", says: "BUUURP! Excuse you!", puff: "bubbles", sound: "oink" },
  "moon+slime": { name: "Glow Goo", color: "#b8ffb0", says: "It glows in the dark!", puff: "stars", sound: "magic" },
  "dragon+slime": { name: "Hot Slime", color: "#c8e04a", says: "It's spicy! Don't touch!", puff: "smoke", sound: "roar" },
  "banana+slime": { name: "Banana Slime", color: "#c8f06a", says: "Smells yummy. Don't eat it.", puff: "bubbles", sound: "blub" },
  "fizzy+glitter": { name: "Rainbow Fizz", color: "#ffb0e8", says: "Rainbow bubbles everywhere!", puff: "bubbles", sound: "blub" },
  "glitter+moon": { name: "Star Potion", color: "#e8d0ff", says: "Tiny stars float out!", puff: "stars", sound: "magic" },
  "dragon+glitter": { name: "Firework Potion", color: "#ff6fb5", says: "POP! POP! BANG!", puff: "boom", sound: "whoosh" },
  "banana+glitter": { name: "Party Juice", color: "#ffd0a0", says: "Everybody dance!", puff: "sparkles", sound: "levelup" },
  "fizzy+moon": { name: "Floaty Potion", color: "#d0e8ff", says: "The beaker is floating!", puff: "float", sound: "whoosh" },
  "dragon+fizzy": { name: "Steam Cloud", color: "#e0e0e0", says: "Pssssssh! So much steam.", puff: "smoke", sound: "whoosh" },
  "banana+fizzy": { name: "Banana Soda", color: "#fff0a0", says: "Fizzy and fruity!", puff: "bubbles", sound: "blub" },
  "dragon+moon": { name: "Space Fire", color: "#a35cff", says: "Purple fire! Whoa.", puff: "boom", sound: "roar" },
  "banana+moon": { name: "Moon Banana", color: "#f4f0c0", says: "A banana... from space?", puff: "float", sound: "boing" },
  "banana+dragon": { name: "Dragon Smoothie", color: "#ffa040", says: "It roars when you drink it!", puff: "smoke", sound: "roar" },
};

// ---- The page bits ----

const host = document.createElement("section");
host.className = "city";
host.hidden = true;
host.setAttribute("aria-label", "The city");
host.innerHTML = `
  <div class="city-card">
    <div class="city-top">
      <h2 class="city-title">The City</h2>
      <span class="city-money"></span>
      <button class="pill city-close" type="button">Back to the boxes</button>
    </div>
    <canvas width="${W}" height="${H}" aria-label="The city"></canvas>
    <p class="city-message" aria-live="polite"></p>
    <div class="city-controls"></div>
  </div>`;
document.body.append(host);
const canvas = host.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const titleEl = host.querySelector<HTMLElement>(".city-title")!;
const moneyEl = host.querySelector<HTMLElement>(".city-money")!;
const messageEl = host.querySelector<HTMLElement>(".city-message")!;
const controls = host.querySelector<HTMLElement>(".city-controls")!;
host.querySelector(".city-close")!.addEventListener("click", closeCity);

// ---- What's going on ----

let mode: Mode = "street";
let running = false;
interface Hooks {
  addToShelf: (thing: string) => void;
  /** Puts something you made into a new box in the box room. Says where it went. */
  addBox: (thing: string) => "box" | "shelf";
}
let hooks: Hooks = { addToShelf: () => {}, addBox: () => "shelf" };
let carRight: HTMLCanvasElement | null = null;
let carLeft: HTMLCanvasElement | null = null;
let carX = 330;
let facing: 1 | -1 = 1;
let target: number | null = null;
let held: -1 | 0 | 1 = 0;
let heldByPointer = false;
let nearShown: Place | null | undefined;
let last = 0;

// Box Factory
let shiftEnd = 0;
let nextBoxAt = 0;
let shiftEarned = 0;
let factoryBoxes: { x: number; taped: boolean; tapedAt: number }[] = [];
let pops: { x: number; y: number; text: string; at: number }[] = [];

// Lab
let picked: string[] = [];
let beaker = "#e8f6ff";
let mixAt = -9999;
let puff: Puff = "bubbles";
let particles: { x: number; y: number; vx: number; vy: number; life: number; color: string; kind: Puff }[] = [];

// Builder
let builderModel: Built | null = null;

// Dimensions
let dim: Dimension = DIMENSIONS[0]!;
let scene: Scene | null = null;
let collected = false;
let lastLine = -1;
// T-Rex can't reach his head. Scratch it five times (click it) while he's
// asking, and he gives you the Doomsday Device he found.
const SCRATCHES_NEEDED = 5;
let scratchReady = false;
let scratches = 0;
let headAt: [number, number] | null = null;

// The meteor rescue. Who you're carrying is only remembered for this visit:
// leave halfway and you start the rescue over (the meteor waits for you).
let carBroken = false;
let carrying = { trex: false, babies: false };
let boomAt = -9999;
let walkerRight: HTMLCanvasElement | null = null;
let walkerLeft: HTMLCanvasElement | null = null;
let followers: { right: HTMLCanvasElement; left: HTMLCanvasElement }[] = [];
const BABY_COLORS = ["green", "purple", "blue"];
const meteorHere = (): boolean => dim.id === "dino" && state.meteor === "coming";

function sprite(model: Built, size: number, yaw: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.ceil(size * 3);
  c.height = Math.ceil(size * 3);
  drawModel(c.getContext("2d")!, model, c.width / 2, c.height / 2, size, yaw, -0.12);
  return c;
}

function makeRescueSprites(): void {
  if (walkerRight) return;
  const me = buildModel(makeModels("me")[0]!.parts);
  walkerRight = sprite(me, 40, 0);
  walkerLeft = sprite(me, 40, Math.PI);
  const trex = buildModel(makeModels("dinosaur")[0]!.parts);
  followers = [{ right: sprite(trex, 46, 0), left: sprite(trex, 46, Math.PI) }];
  for (const color of BABY_COLORS) {
    const baby = buildModel(makeModels(`${color} dinosaur`)[0]!.parts);
    followers.push({ right: sprite(baby, 22, 0), left: sprite(baby, 22, Math.PI) });
  }
}

function escape(): void {
  state.meteor = "saved";
  save();
  carBroken = false;
  playSound("boom");
  go("hub");
  say(
    "You jumped through the portal just in time! BOOM! The meteor hit the Dino Dimension... but everyone is safe! " +
      "T-Rex and the babies are going to live at your house now. (And the portal robots fixed your car.)",
  );
}

// Made once per dimension and kept: the controls only get rebuilt when the
// place you're next to changes, which is checked by keeping the same objects.
const dimPlaces = new Map<string, Place[]>(
  DIMENSIONS.map((d) => [d.id, d.places.map((p) => ({ name: p.name, x: p.x, color: p.color, goes: p.scene ? `scene:${p.scene}` : "hub" }))]),
);
const places = (): Place[] => (mode === "dimension" ? dimPlaces.get(dim.id)! : cityPlaces());
const onStreet = (): boolean => mode === "street" || mode === "dimension";
const unlocked = (d: Dimension): boolean => d.cost === 0 || state.dimensions.includes(d.id);
/** The secret dimension is only for sale after the whole story, with every other dimension unlocked. */
const forSale = (d: Dimension): boolean =>
  !d.secret || (state.story === "void" && DIMENSIONS.every((o) => o.secret || unlocked(o)));
// ---- The Void Key ----
// Hidden behind one of the Insanity Dimension's clouds. Click the right cloud
// and it floats away; click the key behind it to take it.

const KEY_CLOUD = 5;
let cloudGone: number | null = null; // when the secret cloud floated away (this visit)

function clickCloud(x: number, y: number): boolean {
  const clouds = cloudSpots(camX(), performance.now(), W);
  const i = clouds.findIndex((c) => x > c.x - 30 && x < c.x + 90 && y > c.y - 45 && y < c.y + 30);
  if (i < 0) return false;
  if (i !== KEY_CLOUD) {
    say("Just a cloud. Very fluffy!");
    playSound("boing");
    return true;
  }
  if (state.voidKey) {
    say("That's the cloud where you found the Void Key.");
    return true;
  }
  if (cloudGone === null) {
    cloudGone = performance.now();
    playSound("whoosh");
    say("The cloud floated away... and there's something behind it! It's dark and glowing...");
    return true;
  }
  state.voidKey = true;
  save();
  hooks.addToShelf("void key");
  playSound("levelup");
  say("You found the VOID KEY!!! It's on your shelf. What could it open...? (To be continued!)");
  return true;
}

/** The Void Key behind its cloud, and the cloud on top until it floats away. */
function drawKeyCloud(now: number): void {
  const c = cloudSpots(camX(), now, W)[KEY_CLOUD]!;
  if (!state.voidKey) {
    // The key: a dark purple ring and stem, glowing.
    const kx = c.x + 30;
    const ky = c.y - 4;
    ctx.save();
    ctx.shadowColor = "#a35cff";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#3a1466";
    ctx.fillStyle = "#3a1466";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(kx - 10, ky, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(kx - 2, ky - 2, 26, 5);
    ctx.fillRect(kx + 16, ky + 2, 4, 7);
    ctx.fillRect(kx + 9, ky + 2, 4, 5);
    ctx.restore();
  }
  // The cloud covering it, until it floats off up and away.
  const gone = cloudGone === null ? 0 : Math.min(1, (now - cloudGone) / 900);
  if (state.voidKey || gone >= 1) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${1 - gone})`;
  drawCloud(ctx, c.x + gone * 40, c.y - gone * 70);
  // A big purple-and-gold twinkle that never stops, so you can spot it.
  if (gone === 0) {
    const k = 0.5 + 0.5 * Math.sin(now / 250);
    const r = 6 + k * 14;
    const sx = c.x + 62;
    const sy = c.y - 22;
    ctx.save();
    ctx.shadowColor = "#a35cff";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ffe36e";
    ctx.strokeStyle = "#a35cff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const d = i % 2 === 0 ? r : r * 0.28;
      ctx.lineTo(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Colours that never sit still, for the Insanity Dimension. */
const crazy = (now: number, shift: number): string => `hsl(${(now / 12 + shift) % 360}, 95%, 60%)`;
/** Is what's being drawn in the upside-down dimension? */
const flipped = (): boolean => (mode === "dimension" || mode === "scene") && !!dim.theme.flip;

function say(text: string): void {
  messageEl.textContent = text;
}

function updateMoney(): void {
  moneyEl.textContent = `Money: ${formatMoney(state.money)}`;
}

function button(label: string, onClick: () => void, opts: { main?: boolean; disabled?: boolean } = {}): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = opts.main ? "pill pill-main" : "pill";
  b.textContent = label;
  b.disabled = !!opts.disabled;
  b.addEventListener("click", onClick);
  controls.append(b);
  return b;
}

function nearPlace(): Place | null {
  return places().find((p) => Math.abs(p.x - carX) < DOOR_NEAR) ?? null;
}

// ---- Going places ----

function go(next: Mode): void {
  mode = next;
  nearShown = undefined;
  target = null;
  held = 0;
  particles = [];
  const titles: Record<Mode, string> = {
    street: "The City",
    dimension: dim.name,
    hub: "The Portal Hub",
    factory: "Box Factory",
    builder: "Dollhouse Builder",
    lab: "The Lab",
    jobs: "Job Board",
    engineer: "Engineering Station",
    scene: scene?.title ?? "",
  };
  titleEl.textContent = titles[next];
  if (next === "street") say("Click a building to drive there (or use the ← → arrow keys).");
  if (next === "dimension") {
    if (meteorHere()) say("The meteor is getting closer! Hurry!");
    else if (dim.id === "dino" && state.meteor === "saved") say("The meteor made a giant crater. Good thing the dinos live at your house now!");
    else say(dim.intro);
  }
  if (next === "hub") say("Pick a dimension! Double Dimension is free. The others cost $1,000 to unlock.");
  if (next === "factory") say(`You're a ${JOBS[state.job]!.title}. Tape boxes shut to earn ${formatMoney(JOBS[state.job]!.pay)} each!`);
  if (next === "builder") {
    builderModel = buildModel(dollhouseParts("#e8383d", false, state.floors));
    say(`Your dollhouse has ${state.floors} floors.`);
  }
  if (next === "lab") say("Pick two things to mix, then press Mix!");
  if (next === "jobs") say("Pick a job! More jobs are coming soon.");
  if (next === "engineer") {
    // Whatever you were building is still on the bench when you come back.
    say(
      buildDone()
        ? `You built a ${planName()}! Ready to build something else?`
        : `Build a ${planName()}! Dig parts out of the dump and drag them onto the blueprint.`,
    );
  }
  if (next === "scene" && scene) {
    collected = false;
    lastLine = -1;
    scratchReady = false;
    scratches = 0;
    sceneModel = scene.model ? buildModel(makeModels(scene.model)[0]!.parts) : null;
    say(scene.intro);
    const dinoHome = scene.id === "trex" || scene.id === "nest";
    if (dinoHome && meteorHere()) {
      sceneModel = null;
      say(
        scene.id === "trex"
          ? carrying.trex
            ? "T-Rex is with you. Go get the babies at the Dino Nest!"
            : "T-Rex's house is wrecked! T-Rex: \"HELP! A meteor is coming, and my arms are too tiny to carry anything!\""
          : carrying.babies
            ? "You've got all the babies! Run to the Portal!"
            : "The babies are hiding in the nest, scared of the meteor. Pick them up!",
      );
    } else if (dinoHome && state.meteor === "saved") {
      sceneModel = null;
      say(scene.id === "trex" ? "Nobody's home. T-Rex lives at your house now!" : "The nest is empty. The babies live at your house now!");
    }
  }
  renderControls();
}

function enter(place: Place): void {
  if (place.goes === "home") {
    closeCity();
    return;
  }
  if (place.goes === "hub") {
    if (meteorHere()) {
      if (!carrying.trex || !carrying.babies) {
        say(`Wait! You can't leave without ${!carrying.trex ? "T-Rex" : "the babies"}!`);
        return;
      }
      escape();
      return;
    }
    playSound("magic");
    go("hub");
    return;
  }
  if (place.goes.startsWith("scene:")) {
    scene = SCENES[place.goes.slice(6)] ?? null;
    if (scene) go("scene");
    return;
  }
  go(place.goes as Mode);
}

function leave(): void {
  if (mode === "scene") go("dimension");
  else if (mode === "hub") go("lab");
  else if (mode === "jobs") go("factory");
  else go("street");
}

function pickCareer(career: "box" | "engineer"): void {
  state.career = career;
  save();
  playSound("levelup");
  say(
    career === "engineer"
      ? "You're an Engineer now! The Box Factory turned into the Engineering Station. Each thing you build pays $1,000,000!"
      : "You're back to being a Box Billionaire.",
  );
  renderControls();
}

function visit(d: Dimension): void {
  if (!unlocked(d)) {
    if (state.money < d.cost) return;
    state.money -= d.cost;
    state.dimensions.push(d.id);
    save();
    updateMoney();
  }
  dim = d;
  carX = d.places[0]!.x + 100;
  facing = 1;
  playSound("magic");
  go("dimension");
  if (meteorHere()) {
    // Oh no!
    makeRescueSprites();
    carBroken = true;
    carrying = { trex: false, babies: false };
    boomAt = performance.now();
    window.setTimeout(() => playSound("boom"), 150);
    say("A METEOR is about to hit the Dino Dimension! And BOOM, your car exploded! Run to T-Rex's House and the Dino Nest and save everyone!");
  }
}

function pickUp(trex: boolean): void {
  if (trex) carrying.trex = true;
  else carrying.babies = true;
  playSound(trex ? "roar" : "squeak");
  if (carrying.trex && carrying.babies) say("You've got everyone! Now run to the Portal and escape!");
  else if (trex) say("T-Rex climbed on your back. He's heavy! Now get the babies from the Dino Nest!");
  else say(`You scooped up all ${BABY_COLORS.length} babies! Now go get T-Rex!`);
  renderControls();
}

function doScene(): void {
  if (!scene) return;
  playSound(scene.sound);
  if (scene.kind === "collect") {
    if (collected || !scene.gives) return;
    collected = true;
    const thing = scene.gives[Math.floor(Math.random() * scene.gives.length)]!;
    hooks.addToShelf(thing);
    say(`You got a ${thing}! It's on your shelf now.`);
    renderControls();
    return;
  }
  // Talking and looking: a new line each time, never the same one twice in a row.
  const lines = scene.lines ?? [];
  let i = Math.floor(Math.random() * lines.length);
  if (i === lastLine) i = (i + 1) % lines.length;
  lastLine = i;
  if (lines[i]) say(lines[i]!);
  scratchReady = scene.id === "trex" && lines[i] === SCRATCH_LINE;
  scratches = 0;
  if (scratchReady) say(`${SCRATCH_LINE} (Click his head to scratch it!)`);
}

function scratchHead(x: number, y: number): void {
  if (!scratchReady || !headAt || Math.hypot(x - headAt[0], y - headAt[1]) > 55) return;
  scratches++;
  pops.push({ x: headAt[0], y: headAt[1] - 30, text: "scratch!", at: performance.now() });
  playSound("squeak");
  if (scratches < SCRATCHES_NEEDED) {
    say(`Ooh, a little more! (${scratches}/${SCRATCHES_NEEDED})`);
    return;
  }
  scratchReady = false;
  hooks.addToShelf("doomsday device");
  playSound("magic");
  say("Ahhh, that's the spot! Thank you! Here's something I found. I wonder what it is... (The Doomsday Device is on your Play Shelf!)");
}

function renderControls(): void {
  controls.innerHTML = "";
  if (onStreet()) {
    const hold = (dir: -1 | 1, label: string): void => {
      const b = button(label, () => {});
      b.setAttribute("aria-label", dir < 0 ? "Drive left" : "Drive right");
      b.addEventListener("pointerdown", () => {
        held = dir;
        heldByPointer = true;
        target = null;
      });
      b.addEventListener("pointerleave", () => (held = 0));
    };
    hold(-1, "◀");
    hold(1, "▶");
    const near = nearPlace();
    if (near) button(`Go into ${near.name}`, () => enter(near), { main: true });
    nearShown = near;
    return;
  }
  if (mode === "factory") {
    const working = performance.now() < shiftEnd;
    button(working ? "Working…" : "Start a shift (20 seconds)", () => startShift(SHIFT_MS), { main: true, disabled: working });
    button("Start an overtime shift (50 seconds)", () => startShift(OVERTIME_MS), { main: true, disabled: working });
    const cost = PROMOTION[state.job];
    if (cost !== undefined) {
      button(`Get promoted to ${JOBS[state.job + 1]!.title} (${formatMoney(cost)})`, promote, {
        disabled: working || state.money < cost,
      });
    } else {
      button("Get a new job", () => go("jobs"), { disabled: working });
    }
  }
  if (mode === "jobs") {
    button(state.career === "box" ? "Box Billionaire (your job now)" : "Box Billionaire", () => pickCareer("box"), {
      disabled: state.career === "box",
    });
    button(state.career === "engineer" ? "Engineer (your job now)" : "Engineer", () => pickCareer("engineer"), {
      main: state.career !== "engineer",
      disabled: state.career === "engineer",
    });
    for (let i = 0; i < 3; i++) button("??? (locked)", () => {}, { disabled: true });
    if (state.career === "engineer") button("Go to work", () => go("engineer"), { main: true });
  }
  if (mode === "engineer" && buildDone()) {
    button("Build something else", () => {
      newBuild();
      say(`Now build a ${planName()}!`);
      renderControls();
    }, { main: true });
  }
  if (mode === "engineer") button("Get a new job", () => go("jobs"));
  if (mode === "builder") {
    const cost = FLOOR_COST[state.floors];
    if (cost !== undefined) {
      button(`Add a floor (${formatMoney(cost)})`, addFloor, { main: true, disabled: state.money < cost });
    } else {
      button("Your dollhouse is as big as it gets!", () => {}, { disabled: true });
    }
  }
  if (mode === "lab") {
    for (const ing of INGREDIENTS) {
      const b = button(ing.name, () => pick(ing.id));
      b.classList.add("ingredient");
      b.style.setProperty("--ing", ing.color);
      b.setAttribute("aria-pressed", String(picked.includes(ing.id)));
    }
    button("Mix!", mix, { main: true, disabled: picked.length < 2 });
    button(`Potion Book (${state.potions.length}/${Object.keys(POTIONS).length})`, showBook);
    if (state.portal) {
      button("Go through the portal", () => {
        playSound("magic");
        go("hub");
      }, { main: true });
    } else {
      button(`Turn on the portal (${formatMoney(PORTAL_COST)})`, activatePortal, { disabled: state.money < PORTAL_COST });
    }
  }
  if (mode === "hub") {
    for (const d of DIMENSIONS) {
      const open = unlocked(d);
      if (!open && !forSale(d)) {
        button("??? (locked)", () => {}, { disabled: true });
        continue;
      }
      const b = button(open ? `Go to ${d.name}` : `Unlock ${d.name} (${formatMoney(d.cost)})`, () => visit(d), {
        main: open,
        disabled: !open && state.money < d.cost,
      });
      b.style.setProperty("--ing", d.door);
      b.classList.add("ingredient");
    }
    button("Back to the Lab", leave);
    return;
  }
  const dinoHome = mode === "scene" && (scene?.id === "trex" || scene?.id === "nest");
  if (dinoHome && meteorHere()) {
    const trex = scene!.id === "trex";
    const got = trex ? carrying.trex : carrying.babies;
    button(got ? "Got them!" : trex ? "Pick up T-Rex" : "Pick up the babies", () => pickUp(trex), { main: true, disabled: got });
  } else if (dinoHome && state.meteor === "saved") {
    // Nobody's home: they live with you now.
  } else if (mode === "scene" && scene) {
    const done = scene.kind === "collect" && collected;
    button(done ? "You already took one this visit" : scene.button, doScene, { main: true, disabled: done });
  }
  button("Leave", leave);
}

// ---- Box Factory ----

function startShift(length: number): void {
  const now = performance.now();
  shiftEnd = now + length;
  nextBoxAt = now;
  shiftEarned = 0;
  factoryBoxes = [];
  say(length === OVERTIME_MS ? "Overtime! Tape as many boxes as you can!" : "Click the boxes to tape them shut!");
  renderControls();
}

function tapeBoxAt(x: number, y: number): void {
  const now = performance.now();
  if (now > shiftEnd) return;
  const box = factoryBoxes.find((b) => !b.taped && Math.abs(x - b.x) < 48 && y > 230 && y < 330);
  if (!box) return;
  box.taped = true;
  box.tapedAt = now;
  const pay = JOBS[state.job]!.pay;
  state.money += pay;
  shiftEarned += pay;
  save();
  updateMoney();
  pops.push({ x: box.x, y: 220, text: `+${formatMoney(pay)}`, at: now });
  playSound("beep");
}

function promote(): void {
  const cost = PROMOTION[state.job];
  if (cost === undefined || state.money < cost) return;
  state.money -= cost;
  state.job++;
  save();
  updateMoney();
  playSound("levelup");
  say(`You got promoted! You're a ${JOBS[state.job]!.title} now. You earn ${formatMoney(JOBS[state.job]!.pay)} per box!`);
  renderControls();
}

// ---- Dollhouse Builder ----

function addFloor(): void {
  const cost = FLOOR_COST[state.floors];
  if (cost === undefined || state.money < cost || state.floors >= MAX_FLOORS) return;
  state.money -= cost;
  state.floors++;
  save();
  updateMoney();
  playSound("levelup");
  builderModel = buildModel(dollhouseParts("#e8383d", false, state.floors));
  const rooms = ["", "", "a kitchen", "a bathroom", "a playroom", "a music room"];
  say(`Your dollhouse got bigger! It has ${state.floors} floors now, with ${rooms[state.floors - 1]} on top. Go play in it!`);
  renderControls();
}

// ---- Lab ----

function pick(id: string): void {
  if (picked.includes(id)) picked = picked.filter((p) => p !== id);
  else picked = [...picked.slice(-1), id];
  renderControls();
}

function mix(): void {
  if (picked.length < 2) return;
  const key = [...picked].sort().join("+");
  const potion = POTIONS[key];
  if (!potion) return;
  const isNew = !state.potions.includes(potion.name);
  if (isNew) {
    state.potions.push(potion.name);
    save();
  }
  beaker = potion.color;
  puff = potion.puff;
  mixAt = performance.now();
  playSound(potion.sound);
  say(`You made ${potion.name}! ${potion.says}${isNew ? " (New potion!)" : ""}`);
  picked = [];
  renderControls();
}

function showBook(): void {
  const found = state.potions.length ? state.potions.join(", ") : "nothing yet";
  say(`Potion Book: you've found ${state.potions.length} of ${Object.keys(POTIONS).length}: ${found}.`);
}

function activatePortal(): void {
  if (state.money < PORTAL_COST || state.portal) return;
  state.money -= PORTAL_COST;
  state.portal = true;
  save();
  updateMoney();
  playSound("magic");
  say("WHOOOSH! The portal is on! It's swirling... Go through it!");
  renderControls();
}

// ---- Input ----

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
}

const camX = (): number => Math.max(0, Math.min(STREET_W - W, carX - W / 2));

canvas.addEventListener("pointerdown", (e) => {
  const p = toCanvas(e);
  if (mode === "dimension" && dim.theme.crazy && clickCloud(p.x, p.y)) return;
  if (onStreet()) {
    // Click a building (or anywhere on the street) to drive there.
    const wx = p.x + camX();
    const place = places().find((pl) => Math.abs(pl.x - wx) < 140);
    target = Math.max(60, Math.min(STREET_W - 60, place ? place.x : wx));
  } else if (mode === "factory") {
    tapeBoxAt(p.x, p.y);
  } else if (mode === "engineer") {
    canvas.setPointerCapture(e.pointerId);
    const dug = engineerDown(p.x, p.y, performance.now());
    if (dug) {
      say(dug.say);
      if (dug.purpleKey) hooks.addToShelf("purple key");
      playSound(dug.purpleKey ? "magic" : dug.say.startsWith("Your bag") ? "beep" : "squeak");
    }
  } else if (mode === "scene" && scene?.id === "trex") {
    scratchHead(p.x, p.y);
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (mode !== "engineer") return;
  const p = toCanvas(e);
  engineerMove(p.x, p.y);
});

canvas.addEventListener("pointerup", (e) => {
  if (mode !== "engineer") return;
  const p = toCanvas(e);
  const result = engineerUp(p.x, p.y, performance.now());
  if (result.finished) {
    state.money += BUILD_PAY;
    save();
    updateMoney();
    playSound("levelup");
    const where = hooks.addBox(planName());
    say(
      `You built a ${planName()}! You got paid ${formatMoney(BUILD_PAY)}! ` +
        (where === "box" ? "It's in a new box in your room." : "Your room is full of boxes, so it's on your shelf."),
    );
    renderControls();
  } else if (result.say) {
    say(result.say);
    if (result.placed) playSound("beep");
  }
});

window.addEventListener("keydown", (e) => {
  if (host.hidden) return;
  if (e.key === "Escape") closeCity();
  if (!onStreet()) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    held = e.key === "ArrowLeft" ? -1 : 1;
    target = null;
  }
  if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
    const near = nearPlace();
    if (near) enter(near);
  }
});
// Listened for on the whole window: the drive buttons get rebuilt while you
// hold them (when you pass a building), so they'd miss you letting go.
window.addEventListener("pointerup", () => {
  if (heldByPointer) held = 0;
  heldByPointer = false;
});
window.addEventListener("pointercancel", () => {
  if (heldByPointer) held = 0;
  heldByPointer = false;
});
window.addEventListener("keyup", (e) => {
  if ((e.key === "ArrowLeft" && held < 0) || (e.key === "ArrowRight" && held > 0)) held = 0;
});

// ---- Drawing ----

function update(now: number, dt: number): void {
  if (onStreet()) {
    let dir = held;
    if (target !== null) {
      if (Math.abs(target - carX) < 6) target = null;
      else dir = target > carX ? 1 : -1;
    }
    if (dir) {
      facing = dir;
      carX = Math.max(60, Math.min(STREET_W - 60, carX + dir * 420 * dt));
    }
    const near = nearPlace();
    if (near !== nearShown) renderControls();
  }
  if (mode === "factory") {
    const working = now < shiftEnd;
    if (working && now > nextBoxAt) {
      factoryBoxes.push({ x: -60, taped: false, tapedAt: 0 });
      nextBoxAt = now + 750;
    }
    for (const b of factoryBoxes) b.x += 170 * dt;
    factoryBoxes = factoryBoxes.filter((b) => b.x < W + 80);
    if (!working && shiftEnd && factoryBoxes.length === 0 && controls.querySelector("button")?.disabled) {
      say(`Shift's over! You earned ${formatMoney(shiftEarned)}.`);
      renderControls();
    }
  }
  pops = pops.filter((p) => now - p.at < 900);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

function drawStreet(now: number): void {
  const theme = mode === "dimension" ? dim.theme : CITY_THEME;
  const cam = camX();
  const sky = ctx.createLinearGradient(0, 0, 0, ROAD_Y);
  sky.addColorStop(0, theme.crazy ? crazy(now, 0) : theme.sky[0]);
  sky.addColorStop(1, theme.crazy ? crazy(now, 140) : theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ROAD_Y);
  drawBackdrop(ctx, theme.decor, cam, now, W, ROAD_Y, theme.crazy ? KEY_CLOUD : -1);
  if (mode === "dimension" && meteorHere()) drawMeteor(now, 1);
  if (mode === "dimension" && dim.theme.crazy) drawKeyCloud(now);

  // Sidewalk and road.
  ctx.fillStyle = theme.walk;
  ctx.fillRect(0, ROAD_Y - 18, W, 18);
  ctx.fillStyle = theme.road;
  ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);
  ctx.fillStyle = theme.dash;
  for (let x = -(cam % 80); x < W; x += 80) ctx.fillRect(x, ROAD_Y + 38, 44, 6);

  for (let wx = 500; wx < STREET_W; wx += 540) {
    const x = wx - cam;
    if (x > -60 && x < W + 60) drawProp(ctx, theme.decor, x, ROAD_Y, now);
  }

  const near = nearPlace();
  for (const place of places()) drawBuilding(place, place.x - cam, now, place === near);

  const moving = held !== 0 || target !== null;
  if (mode === "dimension" && carBroken) {
    // On foot, with whoever you've rescued running along behind you.
    const crew = [...(carrying.trex ? [followers[0]!] : []), ...(carrying.babies ? followers.slice(1) : [])];
    crew.forEach((f, i) => {
      const img = facing > 0 ? f.right : f.left;
      const x = carX - cam - facing * (70 + i * 46);
      const hop = moving ? Math.abs(Math.sin(now / 110 + i)) * 8 : 0;
      ctx.drawImage(img, x - img.width / 2, ROAD_Y + 30 - img.height * 0.62 - hop);
    });
    const me = facing > 0 ? walkerRight : walkerLeft;
    if (me) {
      const hop = moving ? Math.abs(Math.sin(now / 90)) * 7 : 0;
      ctx.drawImage(me, carX - cam - me.width / 2, ROAD_Y + 30 - me.height * 0.65 - hop);
    }
    // What's left of the car, still smoking.
    const age = now - boomAt;
    if (age < 1500) {
      ctx.fillStyle = `rgba(255, 160, 40, ${1 - age / 1500})`;
      ctx.beginPath();
      ctx.arc(dim.places[0]!.x + 100 - cam, ROAD_Y + 10, 40 + age / 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(90, 90, 90, 0.5)";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(dim.places[0]!.x + 120 - cam + Math.sin(now / 500 + i) * 8, ROAD_Y - 10 - i * 22 - ((now / 40) % 22), 12 + i * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Your car.
  const img = facing > 0 ? carRight : carLeft;
  if (img) {
    const bounce = Math.sin(now / 60) * (moving ? 1.2 : 0);
    ctx.drawImage(img, carX - cam - img.width / 2, ROAD_Y + 26 - img.height / 2 + bounce);
  }
}

/** A big flaming meteor up in the sky, getting closer. `k` 0..1 is how big it is. */
function drawMeteor(now: number, k: number): void {
  ctx.fillStyle = "rgba(255, 60, 20, 0.18)";
  ctx.fillRect(0, 0, W, H);
  const x = 700 + Math.sin(now / 900) * 6;
  const y = 80;
  const r = 40 * k + Math.sin(now / 150) * 2;
  // Its fiery tail.
  for (let i = 6; i > 0; i--) {
    ctx.fillStyle = `rgba(255, ${120 + i * 15}, 40, ${0.12 * i})`;
    ctx.beginPath();
    ctx.arc(x + i * 22, y - i * 12, r * (1 - i * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#6b4a3a";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a3428";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y + r * 0.25, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(place: Place, x: number, now: number, near: boolean): void {
  if (x < -200 || x > W + 200) return;
  const w = 250;
  const h = place.goes === "home" ? 170 : 230;
  const top = ROAD_Y - 18 - h;
  const left = x - w / 2;
  if (place.goes === "hub") {
    // The portal you came through, swirling.
    const cy = ROAD_Y - 110;
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = ["#a35cff", "#ff8fd8", "#5fe0ff", "#ffe36e", "#ffffff"][i]!;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(x, cy, 70 - i * 12, 92 - i * 15, 0, now / 400 + i, now / 400 + i + Math.PI * 1.4);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = place.color;
    ctx.fillRect(left, top, w, h);
    if (place.goes === "home") {
      ctx.fillStyle = "#e8383d";
      ctx.beginPath();
      ctx.moveTo(left - 14, top);
      ctx.lineTo(x, top - 70);
      ctx.lineTo(left + w + 14, top);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    for (let row = 0; row < Math.floor((h - 90) / 50); row++) {
      for (let col = 0; col < 4; col++) ctx.fillRect(left + 20 + col * 58, top + 54 + row * 50, 34, 30);
    }
    ctx.fillStyle = "#6b3a1f";
    ctx.fillRect(x - 24, ROAD_Y - 18 - 70, 48, 70);
  }
  // The sign.
  ctx.font = '800 17px "Trebuchet MS", sans-serif';
  const signW = ctx.measureText(place.name).width + 26;
  ctx.fillStyle = near ? "#ff6fb5" : place.sign ?? "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - signW / 2, top + 10, signW, 30, 10);
  ctx.fill();
  ctx.fillStyle = near || place.sign ? "#ffffff" : "#4a1f6e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(place.name, x, top + 26);
}

function drawFactory(now: number): void {
  ctx.fillStyle = "#efe2d0";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d9c4a8";
  for (let x = 0; x < W; x += 120) ctx.fillRect(x, 40, 70, 120);
  // The conveyor belt.
  ctx.fillStyle = "#3b3f4a";
  ctx.fillRect(0, 330, W, 30);
  ctx.fillStyle = "#6b7080";
  for (let x = -((now / 6) % 40); x < W; x += 40) ctx.fillRect(x, 336, 20, 18);
  for (const b of factoryBoxes) {
    const x = b.x - 45;
    const y = 262;
    ctx.fillStyle = "#c9965f";
    ctx.fillRect(x, y, 90, 68);
    ctx.strokeStyle = "#a8774a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, 88, 66);
    if (b.taped) {
      ctx.fillStyle = "#ddb07a";
      ctx.fillRect(x, y - 12, 90, 12);
      ctx.fillStyle = "rgba(232, 214, 170, 0.95)";
      ctx.fillRect(x + 36, y - 12, 18, 36);
    } else {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(x + 6, y - 8, 78, 8);
      ctx.fillStyle = "#ddb07a";
      ctx.fillRect(x - 8, y - 30, 30, 26);
      ctx.fillRect(x + 68, y - 30, 30, 26);
    }
  }
  ctx.font = '800 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of pops) {
    ctx.globalAlpha = 1 - (now - p.at) / 900;
    ctx.fillStyle = "#2e9e4f";
    ctx.fillText(p.text, p.x, p.y - (now - p.at) / 20);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#4a1f6e";
  ctx.font = '800 22px "Trebuchet MS", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(JOBS[state.job]!.title, 20, 26);
  if (now < shiftEnd) {
    ctx.textAlign = "right";
    ctx.fillText(`Time: ${Math.ceil((shiftEnd - now) / 1000)}   This shift: ${formatMoney(shiftEarned)}`, W - 20, 26);
  }
}

function drawJobBoard(): void {
  ctx.fillStyle = "#c8945a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#b07c48";
  for (let i = 0; i < 60; i++) ctx.fillRect((i * 137) % W, (i * 71) % H, 6, 4);
  const cards = [
    { title: "Box Billionaire", sub: "Tape boxes", open: true, now: state.career === "box" },
    { title: "Engineer", sub: "$1,000,000 a build", open: true, now: state.career === "engineer" },
    { title: "???", sub: "Locked", open: false, now: false },
    { title: "???", sub: "Locked", open: false, now: false },
    { title: "???", sub: "Locked", open: false, now: false },
  ];
  cards.forEach((c, i) => {
    const x = 40 + i * 168;
    const y = 90 + (i % 2) * 40;
    ctx.save();
    ctx.translate(x + 70, y + 110);
    ctx.rotate((i % 2 ? 1 : -1) * 0.04);
    ctx.fillStyle = c.open ? "#fffdf6" : "#d9d0c0";
    ctx.fillRect(-70, -110, 140, 200);
    ctx.fillStyle = "#e8383d";
    ctx.beginPath();
    ctx.arc(0, -100, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a1f6e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 17px "Trebuchet MS", sans-serif';
    ctx.fillText(c.title, 0, -40);
    ctx.font = '700 13px "Trebuchet MS", sans-serif';
    ctx.fillText(c.sub, 0, -10);
    if (!c.open) {
      ctx.font = '900 46px "Trebuchet MS", sans-serif';
      ctx.fillText("🔒", 0, 45);
    } else if (c.now) {
      ctx.fillStyle = "#2e9e4f";
      ctx.font = '800 14px "Trebuchet MS", sans-serif';
      ctx.fillText("YOUR JOB", 0, 45);
    }
    ctx.restore();
  });
}

function drawBuilder(now: number): void {
  ctx.fillStyle = "#fff6dc";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#c9965f";
  ctx.fillRect(0, H - 60, W, 60);
  if (builderModel) drawModel(ctx, builderModel, W / 2, H / 2 - 10, 170, now / 1500, -0.25);
}

function drawLab(now: number): void {
  ctx.fillStyle = "#eaf7f0";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#d4ece0";
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // Shelf of ingredient bottles.
  ctx.fillStyle = "#a8774a";
  ctx.fillRect(40, 120, 360, 12);
  INGREDIENTS.forEach((ing, i) => {
    const x = 60 + i * 56;
    ctx.fillStyle = ing.color;
    ctx.globalAlpha = picked.includes(ing.id) ? 1 : 0.75;
    ctx.fillRect(x, 70, 34, 50);
    ctx.fillRect(x + 10, 58, 14, 14);
    ctx.globalAlpha = 1;
  });
  // The table and beaker.
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(0, 340, W, 100);
  const floaty = puff === "float" && now - mixAt < 2500 ? Math.sin(((now - mixAt) / 2500) * Math.PI) * 60 : 0;
  const bx = 300;
  const by = 340 - floaty;
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.strokeStyle = "#7a8fa0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx - 30, by - 150);
  ctx.lineTo(bx - 30, by - 100);
  ctx.lineTo(bx - 80, by);
  ctx.lineTo(bx + 80, by);
  ctx.lineTo(bx + 30, by - 100);
  ctx.lineTo(bx + 30, by - 150);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = beaker;
  ctx.beginPath();
  ctx.moveTo(bx - 58, by - 36);
  ctx.lineTo(bx - 76, by - 3);
  ctx.lineTo(bx + 76, by - 3);
  ctx.lineTo(bx + 58, by - 36);
  ctx.fill();
  // Fresh potions puff stuff out of the top.
  if (now - mixAt < 2200 && Math.random() < 0.6) {
    particles.push({
      x: bx + (Math.random() - 0.5) * 40,
      y: by - 150,
      vx: (Math.random() - 0.5) * (puff === "boom" ? 400 : 80),
      vy: -60 - Math.random() * (puff === "boom" ? 300 : 120),
      life: 1.2,
      color: puff === "smoke" ? "#cccccc" : puff === "boom" ? ["#ff4d4d", "#ffd23f", "#4a9bff"][Math.floor(Math.random() * 3)]! : beaker,
      kind: puff,
    });
  }
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 1.2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const r = p.kind === "smoke" ? 14 : p.kind === "bubbles" ? 7 : 4;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The portal: grey stone until it's switched on.
  const px = 690;
  const py = 210;
  ctx.fillStyle = "#8a8f99";
  ctx.beginPath();
  ctx.ellipse(px, py, 110, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = state.portal ? "#2a0f4a" : "#5d626c";
  ctx.beginPath();
  ctx.ellipse(px, py, 86, 106, 0, 0, Math.PI * 2);
  ctx.fill();
  if (state.portal) {
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = ["#a35cff", "#ff8fd8", "#5fe0ff", "#ffe36e", "#ffffff"][i]!;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(px, py, 76 - i * 14, 96 - i * 17, 0, now / 300 + i, now / 300 + i + Math.PI * 1.3);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("PORTAL (off)", px, py);
  }
}

function drawBlorp(now: number): void {
  ctx.fillStyle = "#3a1a6e";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#5a3a8e";
  ctx.beginPath();
  ctx.arc(720, 120, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a8f0ff";
  ctx.beginPath();
  ctx.arc(720, 120, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4a9e";
  ctx.fillRect(0, 360, W, 80);
  // Blorp: a happy green blob with an antenna.
  const hop = Math.abs(Math.sin(now / 400)) * 14;
  const x = 380;
  const y = 300 - hop;
  ctx.fillStyle = "#6fd48f";
  ctx.beginPath();
  ctx.ellipse(x, y, 90, 74 + hop * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#4cae6a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y - 70);
  ctx.lineTo(x + 10, y - 115);
  ctx.stroke();
  ctx.fillStyle = "#ffe36e";
  ctx.beginPath();
  ctx.arc(x + 10, y - 118, 10, 0, Math.PI * 2);
  ctx.fill();
  for (const dx of [-30, 30]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + dx, y - 18, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#24222b";
    ctx.beginPath();
    ctx.arc(x + dx + 3, y - 16, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#24222b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y + 14, 26, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawCave(now: number): void {
  ctx.fillStyle = "#1e1236";
  ctx.fillRect(0, 0, W, H);
  const colors = ["#a35cff", "#5fe0ff", "#ff8fd8", "#6fd48f", "#ffd23f"];
  for (let i = 0; i < 18; i++) {
    const x = (i * 157) % W;
    const y = 60 + ((i * 89) % 300);
    const glow = 0.6 + Math.sin(now / 500 + i) * 0.4;
    ctx.globalAlpha = glow;
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x, y + 30);
    ctx.lineTo(x - 18, y);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGarden(now: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#ffb0e8");
  sky.addColorStop(1, "#c86fd8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {
    const x = 40 + ((i * 131) % (W - 80));
    const y = 120 + ((i * 71) % 220) + Math.sin(now / 700 + i) * 18;
    ctx.fillStyle = ["#ffe36e", "#5fe0ff", "#ffffff", "#ff6fb5"][i % 4]!;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + now / 2000;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ff9226";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

let sceneModel: Built | null = null;

function drawScene(now: number): void {
  if (!scene) return;
  if (scene.draw === "blorp") return drawBlorp(now);
  if (scene.draw === "cave") return drawCave(now);
  if (scene.draw === "garden") return drawGarden(now);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  const wild = dim.theme.crazy && scene.draw !== "void";
  sky.addColorStop(0, wild ? crazy(now, 60) : scene.bg[0]);
  sky.addColorStop(1, wild ? crazy(now, 220) : scene.bg[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = scene.floor;
  ctx.fillRect(0, H - 80, W, 80);
  drawBackdrop(ctx, dim.theme.decor, 0, now, W, H - 80);
  const dinoHome = scene.id === "trex" || scene.id === "nest";
  if (meteorHere()) drawMeteor(now, 1.3);
  if (dinoHome && meteorHere()) return drawRescue(now);
  if (scene.draw === "void") {
    // A giant swirling black hole.
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = `rgba(${120 + i * 15}, 60, ${200 - i * 10}, ${0.15 + i * 0.07})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2 - 20, 220 - i * 22, 120 - i * 12, 0, now / (600 + i * 90) + i, now / (600 + i * 90) + i + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2 - 20, 40, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (scene.draw === "volcano") {
    ctx.fillStyle = "#8a5a3a";
    ctx.beginPath();
    ctx.moveTo(180, H - 80);
    ctx.lineTo(400, 110);
    ctx.lineTo(500, 110);
    ctx.lineTo(720, H - 80);
    ctx.fill();
    ctx.fillStyle = "#ff9226";
    ctx.fillRect(400, 104, 100, 12);
    ctx.fillStyle = "rgba(210, 210, 210, 0.8)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(450 + Math.sin(now / 700 + i) * 25, 90 - i * 16 - ((now / 25) % 16), 16 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (scene.draw === "tower") {
    ctx.fillStyle = "#c9ced6";
    ctx.fillRect(390, 40, 120, H - 120);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = (Math.floor(now / 200) + i) % 3 === 0 ? "#10a37f" : "#ffffff";
      ctx.fillRect(405 + (i % 3) * 32, 60 + Math.floor(i / 3) * 60, 24, 24);
    }
    ctx.fillStyle = "#10a37f";
    ctx.beginPath();
    ctx.arc(450, 34, 14 + Math.sin(now / 200) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (sceneModel) {
    const cy = H / 2 - 20 - Math.abs(Math.sin(now / 500)) * 10;
    drawModel(ctx, sceneModel, W / 2, cy, 130, now / 1400, -0.25);
    // Where T-Rex's head is right now (it spins), for scratching.
    headAt = scene.id === "trex" ? projectPoint(sceneModel, [0.88, 0.72, 0], W / 2, cy, 130, now / 1400, -0.25) : null;
    if (headAt && scratchReady) {
      ctx.strokeStyle = "rgba(255, 111, 181, 0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(headAt[0], headAt[1], 34 + Math.sin(now / 200) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.font = '800 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of pops) {
    ctx.globalAlpha = 1 - (now - p.at) / 900;
    ctx.fillStyle = "#c2186b";
    ctx.fillText(p.text, p.x, p.y - (now - p.at) / 20);
  }
  ctx.globalAlpha = 1;
}

/** T-Rex's wrecked house, or the scared babies in the nest, during the meteor rescue. */
function drawRescue(now: number): void {
  if (!scene) return;
  if (scene.id === "trex") {
    // Broken walls and rubble.
    ctx.fillStyle = "#6fd48f";
    ctx.beginPath();
    ctx.moveTo(150, H - 80);
    ctx.lineTo(150, 170);
    ctx.lineTo(230, 210);
    ctx.lineTo(260, 140);
    ctx.lineTo(300, H - 80);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(620, H - 80);
    ctx.lineTo(640, 230);
    ctx.lineTo(700, 160);
    ctx.lineTo(760, 250);
    ctx.lineTo(760, H - 80);
    ctx.fill();
    ctx.fillStyle = "#8a7a6a";
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(120 + i * 60, H - 80 - (i % 3) * 8, 18 + (i % 4) * 6, Math.PI, 0);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#c8a070";
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 90, 230, 50, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const got = scene.id === "trex" ? carrying.trex : carrying.babies;
  if (got) return;
  const shiver = Math.sin(now / 40) * 2;
  if (scene.id === "trex") {
    const img = followers[0]!.right;
    ctx.drawImage(img, W / 2 - img.width * 0.75 + shiver, H - 80 - img.height * 1.1, img.width * 1.5, img.height * 1.5);
  } else {
    followers.slice(1).forEach((f, i) => {
      const img = i % 2 ? f.left : f.right;
      ctx.drawImage(img, W / 2 - 160 + i * 130 - img.width + shiver, H - 120 - img.height * 1.2, img.width * 2, img.height * 2);
    });
  }
}

function drawHub(now: number): void {
  ctx.fillStyle = "#1a0a33";
  ctx.fillRect(0, 0, W, H);
  // Swirly space.
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = ["#a35cff", "#ff8fd8", "#5fe0ff"][i % 3]!;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, 120 + i * 60, 60 + i * 30, now / 4000 + i, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 50; i++) ctx.fillRect((i * 173) % W, (i * 97) % H, 2, 2);
  // A doorway for every dimension: glowing if it's unlocked, with a lock if not.
  const gap = W / DIMENSIONS.length;
  DIMENSIONS.forEach((d, i) => {
    const x = gap * (i + 0.5);
    const y = 230;
    const open = unlocked(d);
    const hidden = !open && !forSale(d);
    // The Dino Dimension's door flashes red while the meteor is coming.
    const alarm = d.id === "dino" && state.meteor === "coming" && Math.floor(now / 400) % 2 === 0;
    ctx.fillStyle = alarm ? "#ff3030" : open ? d.door : "#4a4060";
    ctx.beginPath();
    ctx.ellipse(x, y, 52, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = open ? "#ffffff" : "#2a2040";
    ctx.globalAlpha = open ? 0.35 + Math.sin(now / 300 + i) * 0.2 : 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 38, 64, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (hidden) {
      // Nobody knows what's behind this one yet.
      ctx.font = '900 54px "Trebuchet MS", sans-serif';
      ctx.fillStyle = "#ff2fb0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", x, y);
    } else if (!open) {
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(x - 14, y - 4, 28, 22);
      ctx.strokeStyle = "#f2c230";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y - 6, 10, Math.PI, 0);
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = hidden ? ["???"] : d.name.split(" ");
    words.forEach((word, k) => ctx.fillText(word, x, 340 + k * 18));
    if (d.id === "dino" && state.meteor === "coming") {
      ctx.font = '900 40px "Trebuchet MS", sans-serif';
      ctx.fillStyle = "#ff3030";
      ctx.fillText("!", x, y - 110);
    }
  });
}

function loop(now: number): void {
  if (!running) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(now, dt);
  ctx.save();
  if (flipped()) {
    // The Upside-Down Dimension really is upside down.
    ctx.translate(0, H);
    ctx.scale(1, -1);
  }
  if ((mode === "dimension" || (mode === "scene" && scene?.draw !== "void")) && dim.theme.crazy) {
    // The Insanity Dimension wobbles (with crazy colours showing round the edges).
    ctx.fillStyle = crazy(now, 300);
    ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(now / 700) * 0.035);
    ctx.scale(1 + Math.sin(now / 900) * 0.02, 1 - Math.sin(now / 900) * 0.02);
    ctx.translate(-W / 2, -H / 2);
  }
  if (onStreet()) drawStreet(now);
  else if (mode === "factory") drawFactory(now);
  else if (mode === "engineer") drawEngineer(ctx, now);
  else if (mode === "jobs") drawJobBoard();
  else if (mode === "builder") drawBuilder(now);
  else if (mode === "lab") drawLab(now);
  else if (mode === "hub") drawHub(now);
  else drawScene(now);
  ctx.restore();
  requestAnimationFrame(loop);
}

function carPicture(model: Built, yaw: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 220;
  c.height = 140;
  drawModel(c.getContext("2d")!, model, 110, 70, 72, yaw, -0.12);
  return c;
}

/** Drives out into the city in a car of colour `color` (the car you clicked). */
export function openCity(color: string, roomHooks: Hooks): void {
  hooks = roomHooks;
  const model = buildModel(makeModels("car")[0]!.parts.map((p) => (p.c === "#e8383d" ? { ...p, c: color } : p)));
  carRight = carPicture(model, 0);
  carLeft = carPicture(model, Math.PI);
  host.hidden = false;
  updateMoney();
  carX = HOME.x + 100;
  facing = 1;
  go("street");
  say("Vroom! You drove out into the city. Click a building to drive there.");
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }
}

export function closeCity(): void {
  save();
  host.hidden = true;
  running = false;
  held = 0;
}
