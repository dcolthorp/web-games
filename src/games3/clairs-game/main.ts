/**
 * Clair's game. Three kinds of place: the front yard you start in, Farttopia,
 * which is a city you walk around, and the planets — which are the yard's
 * physics again, with each world's own gravity and air.
 *
 * The teleporter runs between the yard and the city. The telescope in the
 * observatory is what gets you off the ground.
 */

import { createCity } from "./city";
import { FRONT_YARD, gravityLabel, PLANETS, type Body } from "./planets";
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
const starMap = document.querySelector<HTMLElement>("#star-map")!;
const starGrid = document.querySelector<HTMLElement>("#star-grid")!;
const starClose = document.querySelector<HTMLButtonElement>("#star-close")!;
const starOpen = document.querySelector<HTMLButtonElement>("#star-open")!;
const planetGravity = document.querySelector<HTMLElement>("#planet-gravity")!;
const velocityMeter = document.querySelector<HTMLElement>("#velocity")!;
const velocityValue = document.querySelector<HTMLElement>("#velocity-value")!;
const velocityRate = document.querySelector<HTMLElement>("#velocity-rate")!;

const W = canvas.width;
const H = canvas.height;

/** Long enough to see the flash, short enough to spam the button. */
const WARP_MS = 520;

const PLANET_CONTROLS =
  "Hold {Space} to squeeze, aim with {←} {→}. The gravity here is not the gravity you're used to. {★ Star map} to move on.";

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
  openStarMap,
  recordFart,
);

type Place = { kind: "yard" | "city" | "planet"; body: Body };

let place: Place = { kind: "yard", body: FRONT_YARD };
let warping = false;
let lastFrame = 0;

function onCanvas(): { update(dt: number): void; draw(): void } {
  return place.kind === "city" ? city : yard;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "e"].includes(key)) event.preventDefault();
  if (key === "escape" && !starMap.hidden) closeStarMap();
  if (event.repeat || !starMap.hidden) return;
  if (place.kind === "city") city.press(key);
  else yard.press(key);
});

window.addEventListener("keyup", (event) => {
  if (place.kind !== "city") yard.release(event.key.toLowerCase());
});

// ---- the page around the canvas ----------------------------------------

function applyPlace(): void {
  const world = place.kind === "city" ? WORLDS[1]! : WORLDS[0]!;
  if (place.kind === "planet") {
    worldName.textContent = place.body.name;
    worldBlurb.textContent = place.body.fact;
    controls.replaceChildren(...buildControls(PLANET_CONTROLS));
    teleportButton.textContent = "Teleport back to Farttopia";
    planetGravity.textContent = `${place.body.name} · ${gravityLabel(place.body)}`;
  } else {
    worldName.textContent = world.name;
    worldBlurb.textContent = world.blurb;
    controls.replaceChildren(...buildControls(world.controls));
    teleportButton.textContent = `Teleport to ${world.travelTo}`;
  }
  document.body.dataset["world"] = place.kind === "planet" ? "planet" : world.id;
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

// ---- the star map ------------------------------------------------------

function buildStarMap(): void {
  for (const planet of PLANETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "planet-card";
    button.dataset["planet"] = planet.id;

    const glyph = document.createElement("span");
    glyph.className = "planet-glyph";
    glyph.textContent = planet.glyph;
    const name = document.createElement("strong");
    name.textContent = planet.name;
    const pull = document.createElement("span");
    pull.className = "planet-pull";
    pull.textContent = gravityLabel(planet);
    const fact = document.createElement("span");
    fact.className = "planet-fact";
    fact.textContent = planet.fact;

    button.append(glyph, name, pull, fact);
    button.addEventListener("click", () => landOn(planet));
    starGrid.append(button);
  }
}

function openStarMap(): void {
  starMap.hidden = false;
  starClose.focus();
}

function closeStarMap(): void {
  starMap.hidden = true;
  teleportButton.blur();
}

function landOn(planet: Body): void {
  closeStarMap();
  flash(() => {
    place = { kind: "planet", body: planet };
    yard.enter(planet);
    applyPlace();
  });
}

starClose.addEventListener("click", closeStarMap);
starOpen.addEventListener("click", () => {
  openStarMap();
  starOpen.blur();
});
starMap.addEventListener("click", (event) => {
  // Clicking the dark surround closes it; clicking the panel does not.
  if (event.target === starMap) closeStarMap();
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
      const at = place.kind === "planet" ? "observatory" : "city";
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

/** Every fart, anywhere — the yard, the city, or a planet — feeds the meter. */
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

/**
 * Reaching 100 is meant to set something off. Nothing is wired up yet, so for
 * now it just makes very sure you noticed.
 */
function breakThrough(): void {
  screen.classList.add("warping");
  playWarp(WARP_MS);
  window.setTimeout(() => screen.classList.remove("warping"), WARP_MS);
}

function frame(time: number): void {
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  drawVelocity(time);
  const mode = onCanvas();
  mode.update(dt);
  mode.draw();
  requestAnimationFrame(frame);
}

buildStarMap();
applyPlace();
requestAnimationFrame(frame);
