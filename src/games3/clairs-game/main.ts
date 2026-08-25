/**
 * Clair's game. Two places: the front yard you start in, and Farttopia, which
 * is a city. The teleporter is the only way between them, and each place gets
 * its own controls — the yard is a physics toy, the city is somewhere to be.
 */

import { createCity } from "./city";
import { playWarp } from "./sfx";
import { nextWorld, WORLDS, type World } from "./worlds";
import { createYard } from "./yard";

const canvas = document.querySelector<HTMLCanvasElement>("#farttopia")!;
const context = canvas.getContext("2d")!;
const worldName = document.querySelector<HTMLElement>("#world-name")!;
const worldBlurb = document.querySelector<HTMLElement>("#world-blurb")!;
const controls = document.querySelector<HTMLElement>("#controls")!;
const teleportButton = document.querySelector<HTMLButtonElement>("#teleport")!;
const screen = document.querySelector<HTMLElement>(".fart-screen")!;

const W = canvas.width;
const H = canvas.height;

/** Long enough to see the flash, short enough to spam the button. */
const WARP_MS = 520;

const yard = createYard(context, W, H, {
  charge: document.querySelector<HTMLElement>("#charge-fill")!,
  farts: document.querySelector<HTMLElement>("#fart-count")!,
});

const city = createCity(context, W, H, {
  coins: document.querySelector<HTMLElement>("#coin-count")!,
  quests: document.querySelector<HTMLElement>("#quest-list")!,
  place: document.querySelector<HTMLElement>("#place-name")!,
});

let world: World = WORLDS[0]!;
let warping = false;
let lastFrame = 0;

function active(): { update(dt: number): void; draw(): void } {
  return world.mode === "city" ? city : yard;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "e"].includes(key)) event.preventDefault();
  if (event.repeat) return;
  if (world.mode === "city") city.press(key);
  else yard.press(key);
});

window.addEventListener("keyup", (event) => {
  if (world.mode === "yard") yard.release(event.key.toLowerCase());
});

function applyWorld(): void {
  worldName.textContent = world.name;
  worldBlurb.textContent = world.blurb;
  controls.replaceChildren(...buildControls(world.controls));
  teleportButton.textContent = `Teleport to ${world.travelTo}`;
  document.body.dataset["world"] = world.id;
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

/** Arrive standing still, with none of the last place's gas. */
function teleport(): void {
  if (warping) return;
  warping = true;
  screen.classList.add("warping");
  playWarp(WARP_MS);
  window.setTimeout(() => {
    world = nextWorld(world.id);
    if (world.mode === "city") city.enter();
    else yard.enter();
    applyWorld();
  }, WARP_MS / 2);
  window.setTimeout(() => {
    screen.classList.remove("warping");
    warping = false;
  }, WARP_MS);
}

teleportButton.addEventListener("click", () => {
  teleport();
  // Otherwise the next Space press presses the button again instead of farting.
  teleportButton.blur();
});

function frame(time: number): void {
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  const mode = active();
  mode.update(dt);
  mode.draw();
  requestAnimationFrame(frame);
}

applyWorld();
requestAnimationFrame(frame);
