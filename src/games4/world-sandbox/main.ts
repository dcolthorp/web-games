import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import { MATERIALS, MAX_MATERIALS, ROCK, decodeCave, encodeCave, makeCave, paint, registerFoundCrystal } from "./caves";
import { BOMB_CHOICES } from "./bombs";
import { CATEGORIES, CAVE_CATEGORIES, CHOICES, MAGIC, MOVERS, TECH_IDS_SET } from "./catalog";
import { drawCave, drawWorld } from "./draw";
import { LAWS, drawMatrix, physics } from "./matrix";
import { inventCrystal } from "./crystals";
import { bombKind } from "./cavern";
import { updateCave, type CaveBlast } from "./caveWorld";
import { CAVE_MOUTH, FIND_CHANCE, crystalBeside, insideOf, nearestTunnel, stepInTunnel } from "./miners";
import { caveTools } from "./ores";
import { APARTMENT, PERSON, VILLAGE, apartmentSprite, personSprite, villageSprite } from "./folk";
import { MUTANT, mutantSprite } from "./tech";
import { act, canBe, nameOf, updateWavesAndEffects, wander } from "./nature";
import {
  MUTANT_HP,
  TRAITS,
  TRIBE_COLORS,
  createTribe,
  makePerson,
  maxHp,
  personAt,
  randomName,
  setWar,
  updatePeople,
} from "./people";
import { updateTech } from "./war";
import { sprite, spriteIcon, type Choice, type Sprite } from "./sprites";
import {
  currentNote,
  deleteSaveFile,
  hasOldWorld,
  listSaveFiles,
  loadSaveFile,
  saveToFile,
  loadWorld,
  newWorld,
  rememberCrystal,
  resetWorld,
  reshape,
  restoreOldWorld,
  save,
  say,
  world,
  type Tribe,
} from "./state";
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

// The teleporter you have picked up one end of, waiting for its other end.
let linking: Thing | null = null;

// While you're inside a mountain, the map shows its cave instead of the world.
let caveMountain: Thing | null = null;
let caveGrid: Uint8Array | null = null;
let caveMaterial = MATERIALS.findIndex((m) => m.name === "Diamond");
// What you typed into the crystal search box.
let crystalSearch = "";
// Inside a cave the toolbar works the same way as outside: pick a category,
// then pick a thing. Dig and Crystals paint the rock; everything else you put
// down, because a tribe can live in a cave as well as anywhere else.
let caveCategory = "Dig";
const caveDigTools = () => caveTools().filter((t) => t.material <= ROCK || MATERIALS[t.material]?.goesIn === "tunnel");
// What is picked in each of the cave's thing categories.
const cavePicked = new Map<string, Choice>();

function caveChoice(): Choice | undefined {
  const list = CATEGORIES.find((c) => c.name === caveCategory)?.choices ?? (caveCategory === "Bombs" ? BOMB_CHOICES : []);
  return cavePicked.get(caveCategory) ?? list[0];
}

// ---------- toolbar ----------

function slot(attr: string, value: string | number, sprite: Sprite, label: string, pressed: boolean): string {
  return `<button class="tool-slot" type="button" ${attr}="${value}" aria-pressed="${pressed}">${spriteIcon(sprite)}<span>${escapeHtml(label)}</span></button>`;
}

function setPressed(group: HTMLElement, pressed: Element): void {
  for (const button of group.querySelectorAll("button[aria-pressed]:not([data-law])")) button.setAttribute("aria-pressed", String(button === pressed));
}

// People and Tribes show the tribes to pick from instead of a list of things.
// Every crystal there is, or the ones whose names have what you typed in them.
function crystalSlots(): string {
  const wanted = crystalSearch.trim().toLowerCase();
  const tools = caveTools().filter((t) => !wanted || t.name.toLowerCase().includes(wanted));
  if (tools.length === 0) return `<p class="tool-empty">No crystal called that. Find one?</p>`;
  return tools.map((t) => slot("data-material", t.material, t.sprite, t.name, t.material === caveMaterial)).join("");
}

function renderCrystalList(): void {
  const list = document.getElementById("crystal-list");
  if (list) list.innerHTML = crystalSlots();
}

function renderCaveChoices(): void {
  const back = `<button class="tool-action" type="button" data-action="leave-cave">Back to the World</button>`;

  if (caveCategory === "Dig") {
    choicesEl.innerHTML =
      back +
      caveDigTools()
        .map((t) => slot("data-material", t.material, t.sprite, t.name, t.material === caveMaterial))
        .join("");
    return;
  }

  if (caveCategory === "Crystals") {
    choicesEl.innerHTML =
      back +
      `<input class="tool-search" id="crystal-search" type="search" autocomplete="off" aria-label="Search the crystals" placeholder="Search ${MATERIALS.length} crystals…" value="${escapeHtml(crystalSearch)}" />` +
      `<button class="tool-action" type="button" data-action="find-crystal">Find a New Crystal</button>` +
      `<div class="crystal-list" id="crystal-list">${crystalSlots()}</div>`;
    return;
  }

  const c = caveChoice();
  const list = caveCategory === "Bombs" ? BOMB_CHOICES : (CATEGORIES.find((cat) => cat.name === caveCategory)?.choices ?? []);
  const kinds = list.map((o) => slot("data-choice", o.id, o.sprite, o.name, o.id === c?.id)).join("");
  // People, buildings and machines underground all belong to a tribe, same as
  // up above — and you can start a brand new tribe from down here, for a tribe
  // that has only ever lived in a cave.
  const folk = ["People", "Tribes", "Tech"].includes(caveCategory);
  const tribes = folk
    ? slot("data-tribe", "", PERSON.sprite, "No Tribe", tribeId === "") +
      world.tribes.map((t) => slot("data-tribe", t.id, personSprite(t.color), t.name, t.id === tribeId)).join("")
    : "";
  const actions = folk
    ? `<button class="tool-action" type="button" data-action="new-tribe">New Tribe</button>` +
      (currentTribe() ? `<button class="tool-action" type="button" data-action="edit-tribe">Edit Tribe and Wars</button>` : "")
    : "";
  choicesEl.innerHTML = back + kinds + tribes + actions;
}

function renderChoices(): void {
  if (caveGrid) {
    renderCaveChoices();
    return;
  }
  const c = choice();
  if (c.id === "copy") {
    choicesEl.innerHTML =
      slot("data-choice", c.id, c.sprite, c.name, true) +
      LAWS.map((l) => slot("data-law", l.law, l.sprite, l.name, physics[l.law])).join("");
    return;
  }
  const folk = c.id === "person" || c.id === "mutant";
  if (folk || c.id === "village" || c.id === "apartment") {
    const icon =
      c.id === "person" ? personSprite : c.id === "mutant" ? mutantSprite : c.id === "apartment" ? apartmentSprite : villageSprite;
    const none = folk ? [slot("data-tribe", "", PERSON.sprite, "No Tribe", tribeId === "")] : [];
    // You pick what you are putting down first, then whose it is.
    const kinds = folk ? [PERSON, MUTANT] : [VILLAGE, APARTMENT];
    const buildings = kinds.map((b) => slot("data-choice", b.id, b.sprite, b.name, b.id === c.id)).join("");
    const tribes = world.tribes.map((t) => slot("data-tribe", t.id, icon(t.color), t.name, t.id === tribeId));
    const actions =
      !folk
        ? `<button class="tool-action" type="button" data-action="new-tribe">New Tribe</button>` +
          (currentTribe() ? `<button class="tool-action" type="button" data-action="edit-tribe">Edit Tribe and Wars</button>` : "")
        : "";
    choicesEl.innerHTML = buildings + [...none, ...tribes].join("") + actions;
    return;
  }
  const { choices } = CATEGORIES[categoryIndex] as { choices: Choice[] };
  // Mythical creatures and celestial beings can join a tribe and fight for it,
  // so those two toolbars get the tribe list underneath them.
  const canJoin = (MAGIC.has(c.id) || TECH_IDS_SET.has(c.id)) && world.tribes.length > 0;
  const joining = canJoin
    ? slot("data-tribe", "", PERSON.sprite, "No Tribe", tribeId === "") +
      world.tribes.map((t) => slot("data-tribe", t.id, personSprite(t.color), t.name, t.id === tribeId)).join("")
    : "";
  choicesEl.innerHTML = choices.map((o) => slot("data-choice", o.id, o.sprite, o.name, o === c)).join("") + joining;
}

const worldCategoryRow = CATEGORIES.map((c, i) =>
  slot("data-category", i, c.icon ?? (c.choices[0] as Choice).sprite, c.name, i === 0)
).join("");

function renderCategories(): void {
  if (!caveGrid) {
    categoriesEl.innerHTML = worldCategoryRow;
    setPressed(categoriesEl, categoriesEl.querySelectorAll("[data-category]")[categoryIndex] ?? categoriesEl);
    return;
  }
  categoriesEl.innerHTML = CAVE_CATEGORIES.map((name) => {
    const icon =
      name === "Dig"
        ? (caveDigTools()[0]?.sprite as Sprite)
        : name === "Crystals"
          ? (caveTools()[5]?.sprite as Sprite)
          : name === "Bombs"
            ? (BOMB_CHOICES[0] as Choice).sprite
            : ((CATEGORIES.find((c) => c.name === name)?.choices[0] as Choice).sprite);
    return slot("data-cave-category", name, icon, name, name === caveCategory);
  }).join("");
}

renderCategories();
renderChoices();

categoriesEl.addEventListener("click", (event) => {
  const caveButton = (event.target as Element).closest<HTMLElement>("[data-cave-category]");
  if (caveButton) {
    caveCategory = caveButton.dataset["caveCategory"] ?? "Dig";
    setPressed(categoriesEl, caveButton);
    renderChoices();
    return;
  }
  const button = (event.target as Element).closest<HTMLElement>("[data-category]");
  if (!button) return;
  categoryIndex = Number(button.dataset["category"]);
  setPressed(categoriesEl, button);
  renderChoices();
});

choicesEl.addEventListener("input", (event) => {
  const box = event.target as HTMLInputElement;
  if (box.id !== "crystal-search") return;
  crystalSearch = box.value;
  renderCrystalList();
});

choicesEl.addEventListener("click", (event) => {
  const target = event.target as Element;
  const action = target.closest<HTMLElement>("[data-action]")?.dataset["action"];
  if (action === "new-tribe") return openTribeDialog();
  if (action === "edit-tribe") return openTribeDialog(currentTribe());
  if (action === "leave-cave") return leaveCave();
  if (action === "find-crystal") return findCrystal();

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
  if (caveGrid) {
    cavePicked.set(caveCategory, c);
    setPressed(choicesEl, button);
    return;
  }
  picked[categoryIndex] = c;
  // Switching what you are putting down redraws the tribe list in its icon.
  if (["village", "apartment", "person", "mutant"].includes(c.id)) renderChoices();
  else setPressed(choicesEl, button);
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
    if (caveCategory === "Dig" || caveCategory === "Crystals") {
      painting = null;
      paintCave(x, y, true);
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    // Clicking a pad that is already down links it up, same as outside.
    if (caveChoice()?.id === "teleporter") {
      const pad = (caveMountain?.caveThings ?? [])
        .filter((t) => t.type === "teleporter" && Math.hypot(t.x - x, t.y - y) <= 5)
        .at(-1);
      if (pad) return linkPads(pad);
    }
    placeInCave(x, y);
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

  // Clicking a pad with the Teleporter tool in your hand links pads together
  // instead of putting another one down.
  if (c.id === "teleporter") {
    const pad = world.things.filter((t) => t.type === "teleporter" && Math.hypot(t.x - x, t.y - y) <= 5).at(-1);
    if (pad) return linkPads(pad);
  }

  const existing = c.id === "person" ? personAt(x, y) : undefined;
  if (existing) return openPersonDialog(existing);
  if (!canBe(c.habitat, x, y)) return say(`${c.name} has to go ${c.habitat === "land" ? "on land" : "in the water"}.`);

  if (c.id === "tsunami") {
    world.waves.push({ x, y, born: clock });
  } else if (c.id === "village" || c.id === "apartment") {
    if (!tribeId) return say(`Make a new tribe first, then build its ${c.id === "apartment" ? "apartment complex" : "village"}.`);
    world.things.push({ type: c.id, x, y, tribe: tribeId, hp: maxHp({ type: c.id, x, y }) });
  } else if (c.id === "person") {
    const person = makePerson(x, y, tribeId || undefined);
    world.things.push(person);
    openPersonDialog(person);
  } else if (c.id === "mutant") {
    world.things.push({ type: "mutant", x, y, hp: MUTANT_HP, name: "A mutant", ...(tribeId ? { tribe: tribeId } : {}) });
    say(tribeId ? `A mutant for ${currentTribe()?.name}.` : "A mutant, belonging to nobody.");
  } else if ((MAGIC.has(c.id) || TECH_IDS_SET.has(c.id)) && tribeId) {
    world.things.push({ type: c.id, x, y, tribe: tribeId });
    say(TECH_IDS_SET.has(c.id) ? `${c.name} built for ${currentTribe()?.name}.` : `${c.name} joined ${currentTribe()?.name}!`);
  } else {
    world.things.push({ type: c.id, x, y });
  }
  save();
});

// Two pads, linked both ways. Linking a pad that already had a partner leaves
// that partner with nothing, which is fair enough: you moved the other end.
function linkPads(pad: Thing): void {
  pad.pad ??= `pad-${Math.random().toString(36).slice(2, 9)}`;
  if (!linking) {
    linking = pad;
    say("Now click the other teleporter to link them up.");
    return;
  }
  if (linking === pad) {
    linking = null;
    say("Nothing linked. Click two different teleporters.");
    return;
  }
  const from = linking;
  linking = null;
  // Pads underground link to other pads in the same cave; pads outside link to
  // each other. A pad never reaches through the rock to the world above.
  const family = caveGrid && caveMountain ? (caveMountain.caveThings ?? []) : world.things;
  for (const other of family) {
    if (other.link === from.pad || other.link === pad.pad) other.link = undefined;
  }
  from.link = pad.pad;
  pad.link = from.pad;
  const owner = world.tribes.find((t) => t.id === pad.tribe)?.name;
  say(owner ? `Linked. Only ${owner} can use these two.` : "Linked. Anybody at all can use these two.");
  save();
}

// ---------- caves ----------

// Anything you can put in a world, you can put in a cave: trees, animals,
// people, whole villages. And bombs, which only exist down here.
function placeInCave(x: number, y: number): void {
  const c = caveChoice();
  if (!caveMountain || !caveGrid || !c) return;
  const things = (caveMountain.caveThings ??= []);
  const kind = bombKind(c.id);
  if (kind) {
    things.push({ type: c.id, x, y, fuse: kind.fuse });
    say(`${c.name} stuck to the wall. Stand back.`);
    save();
    return;
  }
  const tribe = tribeId || undefined;
  const wantsTribe = ["person", "mutant", "village", "apartment"].includes(c.id) || TECH_IDS_SET.has(c.id);
  things.push({
    type: c.id,
    x,
    y,
    ...(wantsTribe && tribe ? { tribe } : {}),
    ...(c.id === "mutant" ? { hp: MUTANT_HP, name: "A mutant" } : {}),
    ...(c.id === "person" ? { name: randomName(), traits: [] } : {}),
  });
  say(`${c.name} in the cave.`);
  save();
}

// Rings of fire left by a bomb or a blast, in cave coordinates.
const caveBlasts: CaveBlast[] = [];

function drawCaveBlasts(now: number): void {
  for (let i = caveBlasts.length - 1; i >= 0; i -= 1) {
    const blast = caveBlasts[i];
    if (!blast) continue;
    const p = (now - blast.born) / 700;
    if (p >= 1) {
      caveBlasts.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = p < 0.4 ? "#f7d23e" : "#ee7a2a";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1 - p;
    ctx.beginPath();
    ctx.arc(blast.x, blast.y, blast.r * (0.3 + p), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

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
  mountain.caveThings ??= [];
  caveCategory = "Dig";
  $("world-actions").hidden = true;
  hoverText = null;
  renderCategories();
  renderChoices();
  if (found) {
    saveCave();
    say("You found a cave inside the mountain!");
  }
}

// Every crystal on Earth is already in the list, so a new one has to be a
// crystal that isn't on Earth yet. There is room for a great many of them.
function findCrystal(): void {
  const crystal = inventCrystal(Math.random);
  const material = registerFoundCrystal(crystal);
  if (material < 0) {
    say(`All ${MAX_MATERIALS} kinds of crystal are in this cave. There is no room for one more.`);
    return;
  }
  const code = MATERIALS[material]?.code ?? "";
  rememberCrystal({ code, name: crystal.name, colors: crystal.colors });
  caveMaterial = material;
  crystalSearch = "";
  renderChoices();
  say(`You found ${crystal.name}. Nobody has ever seen it before.`);
}

// Everybody who went into this mountain, shuffling along its tunnels. Only
// runs while you're looking at the cave; the rest of the time they're in there
// doing whatever people do in caves.
function walkInCave(mountain: Thing, grid: Uint8Array): void {
  for (const p of insideOf(mountain, world.things)) {
    // Anybody standing in rock — the cave got dug differently, or somebody
    // painted a wall over them — gets put back in the nearest tunnel.
    const standing = nearestTunnel(grid, p.cx ?? CAVE_MOUTH.x, p.cy ?? CAVE_MOUTH.y);
    if (!standing) continue;
    const spot = stepInTunnel(grid, standing.x, standing.y, p.heading ?? 0, Math.random);
    p.cx = spot.x;
    p.cy = spot.y;
    p.heading = spot.heading;
    if (p.dug || Math.random() > FIND_CHANCE) continue;
    const crystal = crystalBeside(grid, spot.x, spot.y);
    if (crystal) {
      p.dug = crystal;
      say(`${p.name} found ${crystal} in the wall!`);
    }
  }
}

function leaveCave(): void {
  saveCave();
  caveMountain = null;
  caveGrid = null;
  $("world-actions").hidden = false;
  renderCategories();
  renderChoices();
}

// The game asks in its own window. A browser's own pop-up can be turned off
// without telling anybody, and then the button looks broken.
const askDialog = $<HTMLDialogElement>("ask-dialog");
let answer: ((yes: boolean) => void) | null = null;

function ask(title: string, copy: string, yes: string): Promise<boolean> {
  $("ask-title").textContent = title;
  $("ask-copy").textContent = copy;
  $("ask-yes").textContent = yes;
  askDialog.showModal();
  return new Promise((resolve) => {
    answer = resolve;
  });
}

function closeAsk(yes: boolean): void {
  askDialog.close();
  answer?.(yes);
  answer = null;
}

$<HTMLFormElement>("ask-form").addEventListener("submit", () => closeAsk(true));
$<HTMLButtonElement>("ask-no").addEventListener("click", () => closeAsk(false));
askDialog.addEventListener("cancel", () => closeAsk(false));

function showUndo(): void {
  $("undo-world").hidden = !hasOldWorld();
}

showUndo();

$<HTMLButtonElement>("reset-world").addEventListener("click", async () => {
  const anythingToLose = world.things.length > 0 || world.tribes.length > 0 || world.strokes.length > 0;
  const warning =
    "It goes back to how it first looked, so everything you put on it and any land you shaped will be gone. You can still bring it back afterwards.";
  if (anythingToLose && !(await ask("Reset this world?", warning, "Yes, reset it"))) return;
  resetWorld();
  tribeId = "";
  renderChoices();
  showUndo();
  say("Back to how this world started. Use Bring That World Back if you want it again.");
});

$<HTMLButtonElement>("new-world").addEventListener("click", async () => {
  const warning = "Everything on this one will be gone, and you get a brand new map. You can still bring this one back afterwards.";
  if (world.things.length > 0 && !(await ask("Make a new world?", warning, "Yes, new world"))) return;
  newWorld();
  tribeId = "";
  renderChoices();
  showUndo();
});

// ---------- save files ----------

// A floppy disk, drawn the same way as everything else in this game rather
// than borrowed from the emoji font.
const FLOPPY = sprite(`
  UUUUUUUUU
  UUgggggUU
  UUgkkkgUU
  UUgggggUU
  UUUUUUUUU
  UwwwwwwwU
  Uwkkkkkwu
  Uwwwwwwwu
  UUUUUUUUU
`);

// An arrow curling back on itself, for bringing a world back.
const UNDO = sprite(`
  ...c...
  ..cc...
  .cccccc
  ..cc...
  ...c...
`);

const iconButton = (id: string, art: Sprite, label: string): void => {
  $(id).innerHTML = `${spriteIcon(art)}<span>${label}</span>`;
};

iconButton("save-files", FLOPPY, "Save Files");
iconButton("undo-world", UNDO, "Bring That World Back");

const filesDialog = $<HTMLDialogElement>("files-dialog");
const saveList = $<HTMLUListElement>("save-list");

const whenText = (at: number): string => {
  const when = new Date(at);
  const time = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${when.toLocaleDateString()} ${time}`;
};

function renderSaveList(): void {
  const files = listSaveFiles();
  if (files.length === 0) {
    saveList.innerHTML = `<li class="save-empty">No save files yet. Name this world and save it.</li>`;
    return;
  }
  saveList.innerHTML = files
    .map(
      (f) => `
      <li>
        <span class="save-row">
          <span class="save-name">${escapeHtml(f.name)}</span>
          <span class="save-when">${whenText(f.savedAt)} · ${f.people} people, ${f.things} things</span>
        </span>
        <button type="button" data-open="${f.id}">Open</button>
        <button type="button" class="danger" data-forget="${f.id}">Delete</button>
      </li>`
    )
    .join("");
}

$<HTMLButtonElement>("save-files").addEventListener("click", () => {
  renderSaveList();
  filesDialog.showModal();
});

$<HTMLButtonElement>("file-save").addEventListener("click", () => {
  const box = $<HTMLInputElement>("file-name");
  const file = saveToFile(box.value);
  if (!file) {
    say("There's no room for another save file. Delete one first.");
    return;
  }
  box.value = "";
  renderSaveList();
  say(`Saved as ${file.name}.`);
});

saveList.addEventListener("click", async (event) => {
  const target = event.target as Element;
  const open = target.closest<HTMLElement>("[data-open]")?.dataset["open"];
  const forget = target.closest<HTMLElement>("[data-forget]")?.dataset["forget"];
  const files = listSaveFiles();

  if (open) {
    const name = files.find((f) => f.id === open)?.name ?? "that world";
    filesDialog.close();
    const warning = `This world gets put away and ${name} comes out. You can bring this one back afterwards.`;
    if (!(await ask(`Open ${name}?`, warning, "Yes, open it"))) return;
    if (!loadSaveFile(open)) return say("That save file has gone missing.");
    tribeId = world.tribes[0]?.id ?? "";
    renderChoices();
    showUndo();
    say(`${name} is open.`);
    return;
  }

  if (forget) {
    const name = files.find((f) => f.id === forget)?.name ?? "that world";
    filesDialog.close();
    if (!(await ask(`Delete ${name}?`, "That save file goes for good. This one cannot be undone.", "Yes, delete it"))) {
      filesDialog.showModal();
      return;
    }
    deleteSaveFile(forget);
    renderSaveList();
    filesDialog.showModal();
    say(`${name} is gone.`);
  }
});

$<HTMLButtonElement>("undo-world").addEventListener("click", () => {
  if (!restoreOldWorld()) return;
  tribeId = world.tribes[0]?.id ?? "";
  renderChoices();
  showUndo();
  say("Got it back.");
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
  updateTech(now);
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
  if (caveGrid) {
    if (caveMountain && !physics.frozen) {
      walkInCave(caveMountain, caveGrid);
      updateCave(caveMountain, caveGrid, clock, caveBlasts, say);
    }
    drawCave(ctx, caveGrid, clock, caveMountain);
    drawCaveBlasts(clock);
  } else drawWorld(ctx, clock);
  if (physics.matrix) drawMatrix(ctx, realNow);

  const text = currentNote(realNow) ?? hoverText ?? hint();
  if (statusLine.textContent !== text) statusLine.textContent = text;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
