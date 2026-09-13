import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { MATERIALS, ROCK, decodeCave, encodeCave, makeCave, paint } from "./caves";
import { CATEGORIES, CHOICES, MOVERS } from "./catalog";
import { drawCave, drawWorld } from "./draw";
import { LAWS, drawMatrix, physics } from "./matrix";
import { CAVE_TOOLS } from "./ores";
import { PERSON, personSprite, villageSprite } from "./folk";
import { act, canBe, nameOf, updateWavesAndEffects, wander } from "./nature";
import { TRAITS, TRIBE_COLORS, createTribe, makePerson, maxHp, personAt, randomName, setWar, updatePeople } from "./people";
import { spriteIcon, type Choice, type Sprite } from "./sprites";
import { currentNote, loadWorld, newWorld, reshape, save, say, world, type Tribe } from "./state";
import { H, W, type Thing } from "./world";

installOofShortcut();
installForceRefreshHotkey();

// You look down on your world from space. Pick a kind of thing, pick which
// one, and click the map to add it. The world is saved, so it's still there
// next time.

loadWorld();

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const categoriesEl = $<HTMLDivElement>("categories");
const choicesEl = $<HTMLDivElement>("choices");
const statusLine = $<HTMLParagraphElement>("status");

const escapeHtml = (text: string): string => text.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)] as T;

let categoryIndex = 0;
// The last thing picked in each category, so switching back remembers it.
const picked = CATEGORIES.map((c) => c.choices[0] as Choice);
// The tribe new people and villages join. "" is no tribe.
let tribeId = world.tribes[0]?.id ?? "";

const choice = (): Choice => picked[categoryIndex] as Choice;
const currentTribe = (): Tribe | undefined => world.tribes.find((t) => t.id === tribeId);

// While you're inside a mountain, the map shows its cave instead of the world.
let caveMountain: Thing | null = null;
let caveGrid: Uint8Array | null = null;
let caveMaterial = MATERIALS.findIndex((m) => m.name === "Diamond");

// ---------- toolbar ----------

function slot(attr: string, value: string | number, sprite: Sprite, label: string, pressed: boolean): string {
  return `<button class="tool-slot" type="button" ${attr}="${value}" aria-pressed="${pressed}">${spriteIcon(sprite)}<span>${escapeHtml(label)}</span></button>`;
}

function setPressed(group: HTMLElement, pressed: Element): void {
  for (const button of group.querySelectorAll("button[aria-pressed]:not([data-law])")) button.setAttribute("aria-pressed", String(button === pressed));
}

// People and Tribes show the tribes to pick from instead of a list of things.
function renderChoices(): void {
  if (caveGrid) {
    choicesEl.innerHTML =
      `<button class="tool-action" type="button" data-action="leave-cave">Back to the World</button>` +
      CAVE_TOOLS.map((t) => slot("data-material", t.material, t.sprite, t.name, t.material === caveMaterial)).join("");
    return;
  }
  const c = choice();
  if (c.id === "copy") {
    choicesEl.innerHTML =
      slot("data-choice", c.id, c.sprite, c.name, true) +
      LAWS.map((l) => slot("data-law", l.law, l.sprite, l.name, physics[l.law])).join("");
    return;
  }
  if (c.id === "person" || c.id === "village") {
    const icon = c.id === "person" ? personSprite : villageSprite;
    const none = c.id === "person" ? [slot("data-tribe", "", PERSON.sprite, "No Tribe", tribeId === "")] : [];
    const tribes = world.tribes.map((t) => slot("data-tribe", t.id, icon(t.color), t.name, t.id === tribeId));
    const actions =
      c.id === "village"
        ? `<button class="tool-action" type="button" data-action="new-tribe">New Tribe</button>` +
          (currentTribe() ? `<button class="tool-action" type="button" data-action="edit-tribe">Edit Tribe and Wars</button>` : "")
        : "";
    choicesEl.innerHTML = [...none, ...tribes].join("") + actions;
    return;
  }
  const { choices } = CATEGORIES[categoryIndex] as { choices: Choice[] };
  choicesEl.innerHTML = choices.map((o) => slot("data-choice", o.id, o.sprite, o.name, o === c)).join("");
}

categoriesEl.innerHTML = CATEGORIES.map((c, i) => slot("data-category", i, c.icon ?? (c.choices[0] as Choice).sprite, c.name, i === 0)).join("");
renderChoices();

categoriesEl.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-category]");
  if (!button) return;
  categoryIndex = Number(button.dataset["category"]);
  setPressed(categoriesEl, button);
  renderChoices();
});

choicesEl.addEventListener("click", (event) => {
  const target = event.target as Element;
  const action = target.closest<HTMLElement>("[data-action]")?.dataset["action"];
  if (action === "new-tribe") return openTribeDialog();
  if (action === "edit-tribe") return openTribeDialog(currentTribe());
  if (action === "leave-cave") return leaveCave();

  const lawButton = target.closest<HTMLElement>("[data-law]");
  const law = LAWS.find((l) => l.law === lawButton?.dataset["law"]);
  if (lawButton && law) {
    physics[law.law] = !physics[law.law];
    lawButton.setAttribute("aria-pressed", String(physics[law.law]));
    say(physics[law.law] ? law.on : law.off);
    return;
  }

  const materialButton = target.closest<HTMLElement>("[data-material]");
  if (materialButton) {
    caveMaterial = Number(materialButton.dataset["material"]);
    setPressed(choicesEl, materialButton);
    return;
  }

  const tribeButton = target.closest<HTMLElement>("[data-tribe]");
  if (tribeButton) {
    tribeId = tribeButton.dataset["tribe"] ?? "";
    renderChoices();
    choicesEl.querySelector<HTMLElement>(`[data-tribe="${tribeId}"]`)?.focus();
    return;
  }

  const button = target.closest<HTMLElement>("[data-choice]");
  const c = CHOICES.get(button?.dataset["choice"] ?? "");
  if (!button || !c) return;
  picked[categoryIndex] = c;
  setPressed(choicesEl, button);
});

function hint(): string {
  if (caveGrid) {
    const m = MATERIALS[caveMaterial];
    if (m?.name === "Dig") return "Click and drag to dig tunnels.";
    if (m?.name === "Rock") return "Click and drag to fill tunnels back in with rock.";
    return `${m?.name}: click and drag ${m?.goesIn === "rock" ? "on the rock walls" : "in the tunnels"}.`;
  }
  const c = choice();
  const tribe = currentTribe();
  if (c.id === "cave") return "Click a mountain to go inside it and fill its cave with ores.";
  if (c.id === "copy") return "Click anything to make a copy of it. Flip the switches to break physics.";
  if (c.id === "raise") return "Click and drag to raise new land up out of the sea.";
  if (c.id === "sink") return "Click and drag to sink land down into the sea.";
  if (c.id === "person") {
    return `Click the land to add a person${tribe ? ` to ${tribe.name}` : ""}. Click a person to change their name and traits.`;
  }
  if (c.id === "village") {
    return tribe ? `Click the land to build a village for ${tribe.name}.` : "Make a new tribe, then click the land to build its village.";
  }
  if (c.id === "tsunami") return "Click the water to send out a tsunami. It washes away plants, animals, and people near the shore.";
  const where = c.habitat === "land" ? "the land" : c.habitat === "sea" ? "the water" : "anywhere";
  return `${c.name}: click ${where} to add one.`;
}

function toMap(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor(((event.clientX - rect.left) * W) / rect.width),
    y: Math.floor(((event.clientY - rect.top) * H) / rect.height),
  };
}

function describePerson(p: Thing): string {
  const tribe = world.tribes.find((t) => t.id === p.tribe);
  const traits = TRAITS.filter((trait) => p.traits?.includes(trait.id)).map((trait) => trait.name);
  return `${p.name}${tribe ? ` of ${tribe.name}` : ""}: ${traits.length > 0 ? traits.join(", ") : "no traits"}. Health ${p.hp ?? maxHp(p)}/${maxHp(p)}.`;
}

// Point at a person to see who they are.
let hoverText: string | null = null;
canvas.addEventListener("pointermove", (event) => {
  const { x, y } = toMap(event);
  if (caveGrid) {
    if (painting) paintCave(x, y, false);
    return;
  }
  if (painting) {
    brushLand(x, y);
    return;
  }
  const person = personAt(x, y);
  hoverText = person ? describePerson(person) : null;
});
canvas.addEventListener("pointerleave", () => {
  hoverText = null;
});

canvas.addEventListener("pointerdown", (event) => {
  const { x, y } = toMap(event);
  const c = choice();

  if (caveGrid) {
    painting = null;
    paintCave(x, y, true);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (c.id === "cave") {
    const mountain = world.things.filter((t) => t.type === "mountain" && Math.abs(t.x - x) <= 6 && y <= t.y && y >= t.y - 9).at(-1);
    return mountain ? enterCave(mountain) : say("Click a mountain to go inside it.");
  }
  if (c.id === "raise" || c.id === "sink") {
    painting = null;
    brushLand(x, y);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  if (c.id === "copy") {
    const original = world.things.filter((t) => Math.abs(t.x - x) <= 6 && y <= t.y + 2 && y >= t.y - 12).at(-1);
    if (!original) return say("Click something to copy it.");
    world.things.push({ ...structuredClone(original), x: original.x + 5, y: original.y + 1 });
    say(`You copied ${nameOf(original)}. Physics is broken!`);
    return save();
  }

  const existing = c.id === "person" ? personAt(x, y) : undefined;
  if (existing) return openPersonDialog(existing);
  if (!canBe(c.habitat, x, y)) return say(`${c.name} has to go ${c.habitat === "land" ? "on land" : "in the water"}.`);

  if (c.id === "tsunami") {
    world.waves.push({ x, y, born: clock });
  } else if (c.id === "village") {
    if (!tribeId) return say("Make a new tribe first, then build its village.");
    world.things.push({ type: "village", x, y, tribe: tribeId, hp: 20 });
  } else if (c.id === "person") {
    const person = makePerson(x, y, tribeId || undefined);
    world.things.push(person);
    openPersonDialog(person);
  } else {
    world.things.push({ type: c.id, x, y });
  }
  save();
});

// ---------- caves ----------

// Where the last bit of paint went, while the mouse button is held down.
let painting: { x: number; y: number } | null = null;

// Paints a line from the last spot to this one, so fast drags don't leave gaps.
function paintCave(x: number, y: number, first: boolean): void {
  if (!caveGrid) return;
  const from = painting ?? { x, y };
  const distance = Math.hypot(x - from.x, y - from.y);
  const radius = caveMaterial <= ROCK ? 4 : 3;
  let changed = 0;
  for (let s = 0; s <= distance; s += 2) {
    const t = distance === 0 ? 1 : s / distance;
    changed += paint(caveGrid, from.x + (x - from.x) * t, from.y + (y - from.y) * t, radius, caveMaterial);
  }
  changed += paint(caveGrid, x, y, radius, caveMaterial);
  painting = { x, y };
  if (first && changed === 0) {
    say(MATERIALS[caveMaterial]?.goesIn === "tunnel" ? "That goes in the tunnels." : "Ores go in the rock walls.");
  }
}

function saveCave(): void {
  if (!caveMountain || !caveGrid) return;
  caveMountain.cave = encodeCave(caveGrid);
  save();
}

// Raise Land and Sink Land, filling in the gaps when the mouse moves fast.
function brushLand(x: number, y: number): void {
  const from = painting ?? { x, y };
  const distance = Math.hypot(x - from.x, y - from.y);
  if (painting && distance < 2) return;
  const amount = choice().id === "raise" ? 0.08 : -0.08;
  for (let s = 2; s < distance; s += 2) {
    reshape(from.x + ((x - from.x) * s) / distance, from.y + ((y - from.y) * s) / distance, amount);
  }
  reshape(x, y, amount);
  painting = { x, y };
}

const stopPainting = (): void => {
  if (!painting) return;
  painting = null;
  if (caveGrid) saveCave();
  else save();
};
canvas.addEventListener("pointerup", stopPainting);
canvas.addEventListener("pointercancel", stopPainting);

function enterCave(mountain: Thing): void {
  const found = mountain.cave === undefined;
  caveGrid = (mountain.cave && decodeCave(mountain.cave)) || makeCave(Math.floor(mountain.x * 1000 + mountain.y));
  caveMountain = mountain;
  categoriesEl.hidden = true;
  $("new-world").hidden = true;
  hoverText = null;
  renderChoices();
  if (found) {
    saveCave();
    say("You found a cave inside the mountain!");
  }
}

function leaveCave(): void {
  saveCave();
  caveMountain = null;
  caveGrid = null;
  categoriesEl.hidden = false;
  $("new-world").hidden = false;
  renderChoices();
}

$<HTMLButtonElement>("new-world").addEventListener("click", () => {
  if (world.things.length > 0 && !window.confirm("Make a new world? Everything on this one will be gone.")) return;
  newWorld();
  tribeId = "";
  renderChoices();
});

window.addEventListener("pagehide", save);

// ---------- naming people ----------

const personDialog = $<HTMLDialogElement>("person-dialog");
const personName = $<HTMLInputElement>("person-name");
const personTribe = $<HTMLSelectElement>("person-tribe");
const personTraits = $<HTMLDivElement>("person-traits");
let editingPerson: Thing | null = null;

function openPersonDialog(person: Thing): void {
  editingPerson = person;
  personName.value = person.name ?? randomName();
  personTribe.innerHTML =
    `<option value="">No tribe</option>` + world.tribes.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  personTribe.value = person.tribe ?? "";
  personTraits.innerHTML = TRAITS.map(
    (trait) =>
      `<label class="check"><input type="checkbox" value="${trait.id}" ${person.traits?.includes(trait.id) ? "checked" : ""} /> <b>${trait.name}</b> <span>${trait.about}</span></label>`,
  ).join("");
  personDialog.showModal();
}

$<HTMLFormElement>("person-form").addEventListener("submit", () => {
  const person = editingPerson;
  if (!person) return;
  person.name = personName.value.trim() || person.name;
  person.tribe = personTribe.value || undefined;
  person.traits = [...personTraits.querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value);
  person.hp = Math.min(person.hp ?? maxHp(person), maxHp(person));
  save();
});

$<HTMLButtonElement>("person-remove").addEventListener("click", () => {
  world.things = world.things.filter((t) => t !== editingPerson);
  save();
  personDialog.close();
});

// ---------- making tribes ----------

const tribeDialog = $<HTMLDialogElement>("tribe-dialog");
const tribeName = $<HTMLInputElement>("tribe-name");
const tribeColors = $<HTMLDivElement>("tribe-colors");
const tribeWars = $<HTMLDivElement>("tribe-wars");
let editingTribe: Tribe | undefined;
let tribeColor = "";

function openTribeDialog(tribe?: Tribe): void {
  editingTribe = tribe;
  $("tribe-title").textContent = tribe ? "Edit Tribe" : "New Tribe";
  tribeName.value = tribe?.name ?? `The ${pick(["Rock", "River", "Sun", "Moon", "Wolf", "Fire", "Leaf", "Storm"])} Tribe`;
  const used = new Set(world.tribes.map((t) => t.color));
  tribeColor = tribe?.color ?? (TRIBE_COLORS.find((c) => !used.has(c.color)) ?? pick(TRIBE_COLORS)).color;
  tribeColors.innerHTML = TRIBE_COLORS.map(
    (c) =>
      `<button class="swatch" type="button" data-color="${c.color}" style="background: ${c.color}" aria-label="${c.name}" aria-pressed="${c.color === tribeColor}"></button>`,
  ).join("");
  const others = world.tribes.filter((t) => t !== tribe);
  $("tribe-wars-field").hidden = others.length === 0;
  tribeWars.innerHTML = others
    .map(
      (o) =>
        `<label class="check"><input type="checkbox" value="${o.id}" ${tribe?.enemies.includes(o.id) ? "checked" : ""} /> ${escapeHtml(o.name)}</label>`,
    )
    .join("");
  tribeDialog.showModal();
}

tribeColors.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-color]");
  if (!button) return;
  tribeColor = button.dataset["color"] ?? tribeColor;
  setPressed(tribeColors, button);
});

$("tribe-cancel").addEventListener("click", () => tribeDialog.close());

$<HTMLFormElement>("tribe-form").addEventListener("submit", () => {
  const name = tribeName.value.trim();
  if (!name) return;
  const tribe = editingTribe ?? createTribe(name, tribeColor);
  tribe.name = name;
  tribe.color = tribeColor;
  const wars = new Set([...tribeWars.querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value));
  for (const other of world.tribes) {
    if (other !== tribe && tribe.enemies.includes(other.id) !== wars.has(other.id)) setWar(tribe, other, wars.has(other.id));
  }
  if (!editingTribe && wars.size === 0) say(`${name} is ready. Click the land to build its first village.`);
  tribeId = tribe.id;
  save();
  renderChoices();
});

// ---------- every frame ----------

// The world's own clock. It stops when time is frozen and runs five times
// over when time is fast.
let clock = 0;
let lastFrame = performance.now();

function simulate(now: number): void {
  for (const t of world.things) {
    const c = CHOICES.get(t.type);
    if (!c || !MOVERS.has(c.id)) continue;
    wander(t, c.habitat);
    act(t, now);
  }
  if (physics.float) {
    for (const t of world.things) {
      t.y -= 0.15;
      if (t.y < 0) t.y = H + 10;
    }
  }
  updatePeople(now);
  updateWavesAndEffects(now);
}

function frame(realNow: number): void {
  const dt = Math.min(50, realNow - lastFrame);
  lastFrame = realNow;
  const steps = physics.frozen ? 0 : physics.fast ? 5 : 1;
  for (let i = 0; i < steps; i += 1) {
    clock += dt;
    simulate(clock);
  }
  if (caveGrid) drawCave(ctx, caveGrid, clock);
  else drawWorld(ctx, clock);
  if (physics.matrix) drawMatrix(ctx, realNow);

  const text = currentNote(realNow) ?? hoverText ?? hint();
  if (statusLine.textContent !== text) statusLine.textContent = text;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
