/**
 * Claire's game. Three kinds of place: the front yard you start in, Farttopia,
 * which is a city you walk around, and the planets — which are the yard's
 * physics again, with each world's own gravity and air.
 *
 * The teleporter runs between the yard and the city. The telescope in the
 * observatory is what gets you off the ground.
 */

import { createCity } from "./city";
import { createMeltdown } from "./meltdown";
import { FRONT_YARD, gravityLabel, MATRIX, BODIES, type Body } from "./bodies";
import { playWarp } from "./sfx";
import { WORLDS } from "./worlds";
import { createYard } from "./yard";
import { BREAK_POINT, fartsInWindow, formatVelocity, prune, velocityFor } from "./velocity";

const canvas = document.querySelector<HTMLCanvasElement>("#farttopia")!;
const context = canvas.getContext("2d")!;
const worldName = document.querySelector<HTMLElement>("#world-name")!;
const worldBlurb = document.querySelector<HTMLElement>("#world-blurb")!;
const controls = document.querySelector<HTMLElement>("#controls")!;
const teleportButton = document.querySelector<HTMLButtonElement>("#teleport")!;
const screen = document.querySelector<HTMLElement>(".fart-screen")!;
const skyMap = document.querySelector<HTMLElement>("#sky-map")!;
const skyGrid = document.querySelector<HTMLElement>("#sky-grid")!;
const skyClose = document.querySelector<HTMLButtonElement>("#sky-close")!;
const skyOpen = document.querySelector<HTMLButtonElement>("#sky-open")!;
const bodyGravity = document.querySelector<HTMLElement>("#body-gravity")!;
const velocityMeter = document.querySelector<HTMLElement>("#velocity")!;
const velocityValue = document.querySelector<HTMLElement>("#velocity-value")!;
const velocityRate = document.querySelector<HTMLElement>("#velocity-rate")!;

const W = canvas.width;
const H = canvas.height;

/** Long enough to see the flash, short enough to spam the button. */
const WARP_MS = 520;

const PLANET_CONTROLS =
  "Hold {Space} to squeeze, aim with {←} {→}. The gravity here is not the gravity you're used to. {🔭 Sky map} to move on.";

const yard = createYard(
  context,
  W,
  H,
  {
    charge: document.querySelector<HTMLElement>("#charge-fill")!,
    farts: document.querySelector<HTMLElement>("#fart-count")!,
  },
  recordFart,
);

const city = createCity(
  context,
  W,
  H,
  {
    coins: document.querySelector<HTMLElement>("#coin-count")!,
    quests: document.querySelector<HTMLElement>("#quest-list")!,
    place: document.querySelector<HTMLElement>("#place-name")!,
  },
  openSkyMap,
  recordFart,
);

const meltdown = createMeltdown(
  context,
  W,
  H,
  {
    root: document.querySelector<HTMLElement>("#meltdown")!,
    screen: document.querySelector<HTMLElement>("#meltdown-screen")!,
    canvas: document.querySelector<HTMLCanvasElement>("#meltdown-canvas")!,
    progress: document.querySelector<HTMLElement>("#bsod-progress")!,
  },
  arriveInTheMatrix,
);

type Place = { kind: "yard" | "city" | "body"; body: Body };

let place: Place = { kind: "yard", body: FRONT_YARD };
let warping = false;
let lastFrame = 0;

function onCanvas(): { update(dt: number): void; draw(): void } {
  return place.kind === "city" ? city : yard;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "e"].includes(key)) event.preventDefault();
  if (key === "escape" && !skyMap.hidden) closeSkyMap();
  if (event.repeat || !skyMap.hidden || meltdown.running()) return;
  if (place.kind === "city") city.press(key);
  else yard.press(key);
});

window.addEventListener("keyup", (event) => {
  if (meltdown.running()) return;
  if (place.kind !== "city") yard.release(event.key.toLowerCase());
});

// ---- the page around the canvas ----------------------------------------

function applyPlace(): void {
  const world = place.kind === "city" ? WORLDS[1]! : WORLDS[0]!;
  if (place.kind === "body") {
    worldName.textContent = place.body.name;
    worldBlurb.textContent = place.body.fact;
    controls.replaceChildren(...buildControls(PLANET_CONTROLS));
    teleportButton.textContent = "Teleport back to Farttopia";
    bodyGravity.textContent = `${place.body.name} · ${gravityLabel(place.body)}`;
  } else {
    worldName.textContent = world.name;
    worldBlurb.textContent = world.blurb;
    controls.replaceChildren(...buildControls(world.controls));
    teleportButton.textContent = `Teleport to ${world.travelTo}`;
  }
  document.body.dataset["world"] = place.kind === "body" ? "body" : world.id;
  if (place.kind === "body") document.body.dataset["body"] = place.body.id;
  else delete document.body.dataset["body"];
}

/** Turn "Hold {Space} to squeeze" into real <kbd> elements, no innerHTML. */
function buildControls(text: string): Node[] {
  return text.split(/(\{[^}]+\})/).map((part) => {
    if (!part.startsWith("{")) return document.createTextNode(part);
    const kbd = document.createElement("kbd");
    kbd.textContent = part.slice(1, -1);
    return kbd;
  });
}

// ---- the sky map ------------------------------------------------------

function bodyCard(body: Body): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = body.id === MATRIX.id ? "body-card body-card-secret" : "body-card";
  button.dataset["body"] = body.id;

  const glyph = document.createElement("span");
  glyph.className = "body-glyph";
  glyph.textContent = body.glyph;
  const name = document.createElement("strong");
  name.textContent = body.name;
  const pull = document.createElement("span");
  pull.className = "body-pull";
  pull.textContent = `${gravityLabel(body)} · ${body.kind}`;
  const fact = document.createElement("span");
  fact.className = "body-fact";
  fact.textContent = body.fact;

  button.append(glyph, name, pull, fact);
  button.addEventListener("click", () => landOn(body));
  return button;
}

function buildSkyMap(): void {
  for (const body of BODIES) skyGrid.append(bodyCard(body));
}

function openSkyMap(): void {
  skyMap.hidden = false;
  skyClose.focus();
}

function closeSkyMap(): void {
  skyMap.hidden = true;
  teleportButton.blur();
}

function landOn(body: Body): void {
  closeSkyMap();
  flash(() => {
    place = { kind: "body", body: body };
    yard.enter(body);
    applyPlace();
  });
}

skyClose.addEventListener("click", closeSkyMap);
skyOpen.addEventListener("click", () => {
  openSkyMap();
  skyOpen.blur();
});
skyMap.addEventListener("click", (event) => {
  // Clicking the dark surround closes it; clicking the panel does not.
  if (event.target === skyMap) closeSkyMap();
});

// ---- travelling --------------------------------------------------------

/** Whites out the canvas, swaps the world at the peak, then clears. */
function flash(swap: () => void): void {
  if (warping) return;
  warping = true;
  screen.classList.add("warping");
  playWarp(WARP_MS);
  window.setTimeout(swap, WARP_MS / 2);
  window.setTimeout(() => {
    screen.classList.remove("warping");
    warping = false;
  }, WARP_MS);
}

/** Arrive standing still, with none of the last place's gas. */
function teleport(): void {
  flash(() => {
    if (place.kind === "city") {
      place = { kind: "yard", body: FRONT_YARD };
      yard.enter(FRONT_YARD);
    } else {
      // Planets hand you back to the observatory you left from.
      const at = place.kind === "body" ? "observatory" : "city";
      place = { kind: "city", body: FRONT_YARD };
      city.enter(at);
    }
    applyPlace();
  });
}

teleportButton.addEventListener("click", () => {
  teleport();
  // Otherwise the next Space press presses the button again instead of farting.
  teleportButton.blur();
});

// ---- the velocity meter ------------------------------------------------

let fartTimes: number[] = [];
let peakVelocity = 0;
let brokenThrough = false;

/** Every fart, anywhere — the yard, the city, or a body — feeds the meter. */
function recordFart(): void {
  const now = performance.now();
  fartTimes = prune(fartTimes, now);
  fartTimes.push(now);
  drawVelocity(now);
}

function drawVelocity(now: number): void {
  const farts = fartsInWindow(fartTimes, now);
  const velocity = velocityFor(farts);
  if (velocity > peakVelocity) peakVelocity = velocity;

  velocityValue.textContent = formatVelocity(velocity);
  velocityMeter.classList.toggle("warm", velocity >= 8 && velocity < BREAK_POINT);
  velocityMeter.classList.toggle("broken", brokenThrough || velocity >= BREAK_POINT);
  velocityMeter.classList.toggle("surging", velocity >= BREAK_POINT);

  if (velocity >= BREAK_POINT && !brokenThrough) {
    brokenThrough = true;
    breakThrough();
  }

  if (brokenThrough) {
    velocityRate.textContent = `${farts}/sec · you broke ${BREAK_POINT} — peak ${formatVelocity(peakVelocity)}`;
  } else if (farts === 0) {
    velocityRate.textContent = "Fart to build velocity. Every fart in the same second doubles it.";
  } else {
    velocityRate.textContent = `${farts} fart${farts === 1 ? "" : "s"} this second · best so far ${formatVelocity(peakVelocity)}`;
  }
}

/** Break 100 and the game stops being a game for about seventeen seconds. */
function breakThrough(): void {
  // In the city there is nothing to aim, so it flings you straight up.
  const direction = place.kind === "city" ? -Math.PI / 2 : yard.aim();
  meltdown.start(place.body, direction);
}

/** Where the hand puts you down. */
function arriveInTheMatrix(): void {
  place = { kind: "body", body: MATRIX };
  yard.enter(MATRIX);
  applyPlace();
  unlockMatrixCard();
}

/** Once you have been, you can go back whenever you like. */
function unlockMatrixCard(): void {
  if (skyGrid.querySelector('[data-body="matrix"]')) return;
  skyGrid.prepend(bodyCard(MATRIX));
}

function frame(time: number): void {
  // Booked first: if anything below throws, the loop still survives. Losing a
  // frame is recoverable; losing the loop mid-meltdown strands you on a dead
  // screen with the keys disabled.
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  drawVelocity(time);
  meltdown.update(dt);
  if (meltdown.ownsCanvas()) {
    meltdown.drawCanvas();
  } else if (!meltdown.running()) {
    const mode = onCanvas();
    mode.update(dt);
    mode.draw();
  }
}

buildSkyMap();
applyPlace();
requestAnimationFrame(frame);
