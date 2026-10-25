import { itemById, ITEMS, type Item, type ItemKind, type NeedId } from "./items";
import { drawEgg, drawPet, EGGS, hatchFrom, RARITY_COLORS, SPECIES, type Egg, type G, type SpeciesId } from "./pets";

// Penelope's Pet Eggs: open an egg, a pet hatches out, and you take care of
// it. Feed it, give it water, put it to bed, give it a bath and play with it.
// Every time you look after it you earn bucks and it grows up a little
// (Newborn all the way to Full Grown). Save up bucks to buy more eggs, if you
// want to.


const NEEDS: { id: NeedId; icon: string; label: string; wants: string; busy: string; done: string; ms: number; drop: number }[] = [
  { id: "food", icon: "🍖", label: "Food", wants: "is hungry!", busy: "is eating... munch munch!", done: "ate it all up! Yum!", ms: 2600, drop: 0.45 },
  { id: "water", icon: "💧", label: "Water", wants: "is thirsty!", busy: "is drinking... slurp!", done: "had a big drink!", ms: 2200, drop: 0.55 },
  { id: "sleep", icon: "😴", label: "Sleep", wants: "is sleepy!", busy: "is sleeping... shhh!", done: "had a lovely nap!", ms: 4200, drop: 0.25 },
  { id: "bath", icon: "🛁", label: "Bath", wants: "is dirty!", busy: "is having a bubble bath!", done: "is all clean and sparkly!", ms: 3200, drop: 0.3 },
  { id: "play", icon: "⚾", label: "Play", wants: "is bored!", busy: "is playing ball!", done: "had so much fun playing!", ms: 3400, drop: 0.5 },
];

const STAGES: [string, number][] = [
  ["Newborn", 0],
  ["Junior", 4],
  ["Pre-Teen", 10],
  ["Teen", 18],
  ["Post-Teen", 28],
  ["Full Grown", 40],
];

interface Pet {
  id: string;
  species: SpeciesId;
  name: string;
  xp: number; // how many times you've taken care of it
  needs: Record<NeedId, number>; // 100 is all good, 0 needs it lots
  sparkle?: boolean; // from a Sparkle Potion: sparkles forever
  scale?: number; // from a Tiny or Giant Potion
}

interface Save {
  bucks: number;
  pets: Pet[];
  current: string;
  freeEgg: boolean;
  last: number;
  holyFound?: boolean; // the secret Holy Egg (click the cloud in the window 3 times)
  unholyFound?: boolean; // the secret Unholy Egg (click the plant on the shelf 3 times)
  items?: Record<string, number>; // what you bought down the street, and how many
  decorOn?: string[]; // decorations that are out in your room
  moonFound?: boolean; // the secret Moon Kitty (tap the moon 3 times while your pet sleeps)
  magicFound?: boolean; // the secret Magic Shop behind your house (drive left from Home 3 times)
  infinite?: boolean; // infinite bucks! (Penelope asked nicely)
  continues?: number; // how many times you've pressed Continue on the You Lose screen
}

const SAVE_KEY = "pet-eggs-save";
const CARE_BUCKS = 15;
const WANTS_AT = 60; // below this, the pet asks for it
const FULL_AT = 85; // above this, they don't need it yet
const AWAY_SLOWER = 6; // needs go down this many times slower while the game is closed
const AWAY_LOWEST = 15;

function load(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "") as Save;
    if (Array.isArray(s.pets)) return s;
  } catch {
    // No save yet: a brand new game.
  }
  return { bucks: 0, pets: [], current: "", freeEgg: true, last: Date.now() };
}

const save = load();
// While you were away, your pets got a bit hungry (but not too much).
{
  const away = Math.max(0, (Date.now() - save.last) / 1000);
  for (const pet of save.pets) {
    for (const n of NEEDS) {
      const now = pet.needs[n.id];
      if (now > AWAY_LOWEST) pet.needs[n.id] = Math.max(AWAY_LOWEST, now - (away * n.drop) / AWAY_SLOWER);
    }
  }
}
const store = (): void => {
  save.last = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
};
store();
window.addEventListener("pagehide", store);
window.setInterval(store, 5000);

const currentPet = (): Pet | undefined => save.pets.find((p) => p.id === save.current) ?? save.pets[0];
const stageOf = (pet: Pet): number => {
  let i = 0;
  STAGES.forEach(([, at], n) => {
    if (pet.xp >= at) i = n;
  });
  return i;
};
const sizeOf = (pet: Pet): number => (0.62 + stageOf(pet) * 0.08) * (pet.scale ?? 1);

// ---- The page ----

const room = document.getElementById("room") as HTMLCanvasElement;
const g = room.getContext("2d")!;
const bucksEl = document.getElementById("bucks")!;
const nameEl = document.getElementById("pet-name")!;
const messageEl = document.getElementById("message")!;
const careEl = document.getElementById("care")!;
const petsEl = document.getElementById("pets")!;
const overlay = document.getElementById("overlay")!;
const overlayTitle = document.getElementById("overlay-title")!;
const overlayNote = document.getElementById("overlay-note")!;
const overlayBody = document.getElementById("overlay-body")!;
const overlayButtons = document.getElementById("overlay-buttons")!;

let message = "";
let messageUntil = 0;
function say(text: string, ms = 3500): void {
  message = text;
  messageUntil = performance.now() + ms;
  messageEl.textContent = text;
}

// What the pet is doing right now (eating, sleeping...), if anything.
let doing: { need: NeedId; start: number; until: number; fills: Partial<Record<NeedId, number>>; item?: Item } | null = null;
let hearts: { x: number; y: number; at: number }[] = [];

const careButtons = new Map<NeedId, { button: HTMLButtonElement; bar: HTMLSpanElement }>();
for (const n of NEEDS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "need";
  button.innerHTML = `<span class="icon">${n.icon}</span><span>${n.label}</span><span class="bar"><span></span></span>`;
  button.addEventListener("click", () => care(n.id));
  careEl.append(button);
  careButtons.set(n.id, { button, bar: button.querySelector<HTMLSpanElement>(".bar span")! });
}

function care(id: NeedId): void {
  const pet = currentPet();
  if (!pet || doing) return;
  const n = NEEDS.find((x) => x.id === id)!;
  if (pet.needs[id] >= FULL_AT) {
    say(`${pet.name} doesn't need that right now. Try something else!`);
    return;
  }
  const now = performance.now();
  doing = { need: id, start: now, until: now + n.ms, fills: { [id]: 100 } };
}

/** Magic potions from the secret Magic Shop. Each one works right away (and gets used up). */
function drinkPotion(pet: Pet, item: Item): void {
  const top = STAGES.length - 1;
  if (item.magic === "grow" && stageOf(pet) >= top) {
    say(`${pet.name} is already Full Grown! 🎉`);
    return;
  }
  save.items![item.id]!--;
  if (!save.items![item.id]) delete save.items![item.id];
  const now = performance.now();
  for (let i = 0; i < 12; i++) hearts.push({ x: 400 + (Math.random() - 0.5) * 200, y: 380, at: now + i * 60 });
  if (item.magic === "grow") {
    pet.xp = STAGES[stageOf(pet) + 1]![1];
    say(`🧪 POOF! ${pet.name} grew up! Now ${pet.name} is a ${STAGES[stageOf(pet)]![0]}!`, 4000);
  } else if (item.magic === "happy") {
    for (const n of NEEDS) pet.needs[n.id] = 100;
    say(`💖 ${pet.name} is super happy! All the bars are full!`, 4000);
  } else if (item.magic === "sparkle") {
    pet.sparkle = true;
    say(`🌟 ${pet.name} sparkles now... forever!`, 4000);
  } else if (item.magic === "tiny") {
    pet.scale = 0.65;
    say(`🐜 Shrink! ${pet.name} is teeny tiny!`, 4000);
  } else if (item.magic === "giant") {
    pet.scale = 1.3;
    say(`🍄 WHOA! ${pet.name} is GIANT!`, 4000);
  } else {
    pet.scale = 1;
    pet.sparkle = false;
    say(`🔄 ${pet.name} is back to normal.`, 4000);
  }
  store();
  showPets();
}

/** Give your pet something from My stuff: food and sweets get eaten up, toys are for keeps. */
function useItem(item: Item): void {
  const pet = currentPet();
  if (!pet || doing || !(save.items?.[item.id])) return;
  if (item.kind === "decor") {
    const on = new Set(save.decorOn ?? []);
    if (on.has(item.id)) on.delete(item.id);
    else on.add(item.id);
    save.decorOn = [...on];
    say(on.has(item.id) ? `You put the ${item.name} in your room! ${item.icon}` : `You put the ${item.name} away.`, 2500);
    store();
    showStuff();
    return;
  }
  if (item.magic) {
    drinkPotion(pet, item);
    return;
  }
  const fills = item.fills ?? {};
  const needed = (Object.keys(fills) as NeedId[]).some((k) => pet.needs[k] < FULL_AT);
  if (!needed) {
    say(`${pet.name} doesn't need that right now. Try something else!`);
    return;
  }
  // Toys are for playing; food and sweets get eaten (or drunk, for drinks).
  const drink = item.kind === "food" && (fills.water ?? 0) > (fills.food ?? 0);
  const need: NeedId = item.kind === "toy" ? "play" : drink ? "water" : "food";
  if (item.kind !== "toy") {
    save.items![item.id]!--;
    if (!save.items![item.id]) delete save.items![item.id];
  }
  const now = performance.now();
  doing = { need, start: now, until: now + NEEDS.find((n) => n.id === need)!.ms, fills, item };
  showStuff();
}

function finishCare(): void {
  const pet = currentPet();
  if (!pet || !doing) return;
  const n = NEEDS.find((x) => x.id === doing!.need)!;
  const item = doing.item;
  const before = stageOf(pet);
  for (const [k, v] of Object.entries(doing.fills) as [NeedId, number][]) pet.needs[k] = Math.min(100, pet.needs[k] + v);
  pet.xp++;
  save.bucks += CARE_BUCKS;
  doing = null;
  const after = stageOf(pet);
  if (after > before) say(`🎉 ${pet.name} grew up! Now ${pet.name} is a ${STAGES[after]![0]}! +${CARE_BUCKS} bucks`, 5000);
  else if (item) say(`${pet.name} loved the ${item.name}! ${item.icon} +${CARE_BUCKS} bucks`);
  else say(`${pet.name} ${n.done} +${CARE_BUCKS} bucks`);
  store();
  showPets();
  if (wished) {
    // The wish on the moon comes true: a Moon Kitty falls out of the sky.
    wished = false;
    hatched("moonKitty");
    overlayNote.textContent = "🌠 A shooting star fell into your room... and out came a Moon Kitty!";
  }
}

const PET_PLAY = 5;
const PET_BUCK_MS = 5000;
let nextPetBuck = 0;
const TRICKS = ["jump", "spin", "roll"] as const;
const TRICK_MS = 900;
let trick: { kind: (typeof TRICKS)[number]; start: number } | null = null;
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
const canAfford = (price: number): boolean => !!save.infinite || save.bucks >= price;
function spend(price: number): void {
  if (!save.infinite) save.bucks -= price;
}
const bucksText = (): string => (save.infinite ? "∞ infinite" : money(save.bucks));
/** Big numbers with commas, like 1,000,000,000,000,000. */
const money = (n: number): string => Math.floor(n).toLocaleString("en-US");

room.addEventListener("click", (e) => {
  const pet = currentPet();
  if (!pet) {
    openEggShop();
    return;
  }
  const r = room.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 800;
  const y = ((e.clientY - r.top) / r.height) * 460;
  if (x > 168 && x < 252 && y > 140 && y < 192) {
    openStreet(0);
    return;
  }
  if (tapMoon(x, y) || tapCloud(x, y) || tapPlant(x, y)) return;
  // Clicked one of your other pets? Take care of that one now.
  const other = othersInRoom().find((_, i) => Math.abs(x - SPOTS[i]![0]) < 60 && y > SPOTS[i]![1] - 130 && y < SPOTS[i]![1] + 10);
  if (other) {
    if (doing) say(`Wait until ${pet.name} is done!`, 2000);
    else swapTo(other);
    return;
  }
  // Petting: hearts float up, it cheers them up a bit (Play), it's worth a
  // buck every few seconds, and they do a trick.
  if (Math.abs(x - 400) < 120 && y > 120) {
    const now = performance.now();
    for (let i = 0; i < 4; i++) hearts.push({ x: x + (Math.random() - 0.5) * 60, y, at: now + i * 120 });
    if (doing) return;
    pet.needs.play = Math.min(100, pet.needs.play + PET_PLAY);
    let text = `${pet.name} loves you! 💕`;
    if (now > nextPetBuck) {
      save.bucks += 1;
      nextPetBuck = now + PET_BUCK_MS;
      text += " +1 buck";
      showPets();
    }
    if (!trick || now > trick.start + TRICK_MS) {
      trick = { kind: pick(TRICKS), start: now };
      text += ` ${pet.name} did a ${trick.kind}!`;
    }
    say(text, 2000);
  }
});

/** Your other pets hang out in the room too. Click one to take care of it instead. */
const SPOTS: [number, number][] = [[110, 445], [690, 445], [200, 455], [600, 455]];
const othersInRoom = (): Pet[] => save.pets.filter((p) => p !== currentPet()).slice(0, SPOTS.length);

function swapTo(pet: Pet): void {
  if (doing || pet === currentPet()) return;
  save.current = pet.id;
  store();
  showPets();
  say(`Now you're taking care of ${pet.name}! 💕`, 2500);
}

function swapBy(step: number): void {
  const cur = currentPet();
  if (!cur || save.pets.length < 2) return;
  const i = save.pets.indexOf(cur);
  swapTo(save.pets[(i + step + save.pets.length) % save.pets.length]!);
}
document.getElementById("prev-pet")!.addEventListener("click", () => swapBy(-1));
document.getElementById("next-pet")!.addEventListener("click", () => swapBy(1));

function showPets(): void {
  const many = save.pets.length > 1;
  document.getElementById("prev-pet")!.hidden = !many;
  document.getElementById("next-pet")!.hidden = !many;
  document.getElementById("pets-hint")!.textContent = many
    ? "(tap a pet to take care of it)"
    : "(get another egg from the 🥚 Egg Shop to have more pets!)";
  bucksEl.textContent = bucksText();
  petsEl.innerHTML = "";
  const cur = currentPet();
  for (const pet of save.pets) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pet-card";
    b.setAttribute("aria-pressed", String(pet === cur));
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 170;
    const cg = c.getContext("2d")!;
    cg.fillStyle = "#f3eeff";
    cg.fillRect(0, 0, 200, 170);
    drawPet(cg, pet.species, 100, 160, 0.55, { t: 1000, happy: true });
    b.append(c, pet.name);
    const stage = document.createElement("small");
    stage.textContent = `${SPECIES[pet.species].name} · ${STAGES[stageOf(pet)]![0]}`;
    stage.style.color = RARITY_COLORS[SPECIES[pet.species].rarity];
    b.append(stage);
    b.addEventListener("click", () => swapTo(pet));
    petsEl.append(b);
  }
  if (!save.pets.length) petsEl.textContent = "No pets yet. Open your egg!";
  showStuff();
  nameEl.textContent = cur ? `${cur.name} the ${SPECIES[cur.species].name} · ${STAGES[stageOf(cur)]![0]}` : "";
}

const stuffEl = document.getElementById("stuff")!;
const KIND_ORDER: ItemKind[] = ["potion", "food", "sweet", "toy", "decor"];

/** 🎒 My stuff: everything you bought. Tap one to give it to your pet (or put it in your room). */
function showStuff(): void {
  bucksEl.textContent = bucksText();
  stuffEl.innerHTML = "";
  const owned = ITEMS.filter((i) => save.items?.[i.id]).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  document.getElementById("stuff-hint")!.textContent = owned.length
    ? "(tap something to give it to your pet!)"
    : "(click the car in the window to go shopping!)";
  const on = new Set(save.decorOn ?? []);
  for (const item of owned) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stuff-item";
    const count = save.items![item.id]!;
    const what =
      item.kind === "potion" ? `x${count}` : item.kind === "decor" ? (on.has(item.id) ? "In your room" : "Put it out") : item.kind === "toy" ? "Play!" : `x${count}`;
    b.innerHTML = `<span class="icon">${item.icon}</span><span>${item.name}</span><small>${what}</small>`;
    if (item.kind === "decor") b.setAttribute("aria-pressed", String(on.has(item.id)));
    b.addEventListener("click", () => useItem(item));
    stuffEl.append(b);
  }
}

// ---- Drawing the room ----

// The secret: click the little cloud in the window three times and the
// Holy Egg shows up in the Egg Shop.
const cloudX = (now: number): number => 92 + ((now / 80) % 200) - 30 + 16;
let cloudTaps = 0;
let holyGlow = 0;

function tapCloud(x: number, y: number): boolean {
  const now = performance.now();
  if (x < 84 || x > 256 || y < 54 || y > 196 || Math.abs(x - cloudX(now) - 17) > 45 || Math.abs(y - 110) > 35) return false;
  cloudTaps++;
  holyGlow = now + 500;
  if (cloudTaps >= 3 && !save.holyFound) {
    save.holyFound = true;
    holyGlow = now + 4000;
    store();
    say("😇 A golden light shines down... You found the secret HOLY EGG! It's in the 🥚 Egg Shop now!", 7000);
  } else if (!save.holyFound) {
    say(cloudTaps === 1 ? "The cloud sparkles..." : "The cloud sparkles even more! ✨", 2000);
  }
  return true;
}

// Another secret: while your pet is asleep the moon comes out. Tap it three
// times to make a wish, and when your pet wakes up there's a Moon Kitty.
let moonTaps = 0;
let wished = false;
let shootingStar = 0;

function tapMoon(x: number, y: number): boolean {
  if (doing?.need !== "sleep" || Math.hypot(x - 200, y - 100) > 30) return false;
  if (save.moonFound) {
    say("The moon is shining on your sleeping pet. 🌙", 2000);
    return true;
  }
  moonTaps++;
  if (moonTaps >= 3) {
    save.moonFound = true;
    wished = true;
    shootingStar = performance.now();
    store();
    say("🌠 A shooting star! You made a wish on the moon...", 6000);
  } else {
    say(moonTaps === 1 ? "The moon twinkles... 🌙" : "The moon twinkles even more! Make a wish... 🌙", 2500);
  }
  return true;
}

// The other secret: click the plant on the shelf three times and the Unholy
// Egg shows up in the Egg Shop.
let plantTaps = 0;
let unholyGlow = 0;
let plantShake = 0;

function tapPlant(x: number, y: number): boolean {
  if (x < 596 || x > 680 || y < 66 || y > 145) return false;
  const now = performance.now();
  plantTaps++;
  plantShake = now + 500;
  if (plantTaps >= 3 && !save.unholyFound) {
    save.unholyFound = true;
    unholyGlow = now + 4000;
    store();
    say("😈 Spooky purple smoke puffs out of the plant... You found the secret UNHOLY EGG! It's in the 🥚 Egg Shop now!", 7000);
  } else if (!save.unholyFound) {
    say(plantTaps === 1 ? "The plant wiggles..." : "The plant shivers... something spooky is in there!", 2000);
  }
  return true;
}

function drawRoom(now: number, dark: number): void {
  g.fillStyle = "#ffe9f2";
  g.fillRect(0, 0, 800, 460);
  g.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let x = 20; x < 800; x += 60) for (let y = 30; y < 300; y += 60) g.fillRect(x, y, 6, 6);
  // A window with the sky outside.
  g.fillStyle = "#ffffff";
  g.fillRect(84, 54, 172, 142);
  const sky = g.createLinearGradient(0, 60, 0, 190);
  sky.addColorStop(0, dark > 0.5 ? "#1d2050" : "#8fd3ff");
  sky.addColorStop(1, dark > 0.5 ? "#3b3f8a" : "#d8f1ff");
  g.fillStyle = sky;
  g.fillRect(92, 62, 156, 126);
  if (dark > 0.5) {
    g.fillStyle = "#fff6c2";
    g.beginPath();
    g.arc(200, 100, 18, 0, Math.PI * 2);
    g.fill();
    if (now - shootingStar < 1500) {
      // A shooting star zooming across the window.
      const p = (now - shootingStar) / 1500;
      g.font = "28px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("🌠", 240 - p * 150, 70 + p * 100);
    }
  } else {
    g.fillStyle = holyGlow > now ? "#fff1a8" : "#ffffff";
    const cx = cloudX(now);
    for (const [dx, r] of [[0, 14], [16, 18], [34, 13]] as const) {
      g.beginPath();
      g.arc(cx + dx, 110, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // The street outside, with your car parked on it.
  g.fillStyle = "#6b6f7a";
  g.fillRect(92, 166, 156, 22);
  g.fillStyle = "#ffffff";
  g.fillRect(166, 62, 8, 126);
  g.fillRect(92, 121, 156, 8);
  g.font = "40px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("🚗", 210 + Math.sin(now / 300) * 1.5, 160);
  if (now % 1800 < 1200) {
    g.fillStyle = "#5b3dc4";
    g.font = '800 14px "Trebuchet MS", sans-serif';
    g.fillText("Click the car!", 170, 212);
  }
  // A shelf with a plant.
  g.fillStyle = "#c99a6b";
  g.fillRect(560, 140, 160, 12);
  g.fillStyle = "#e07a5f";
  g.fillRect(620, 108, 36, 32);
  g.fillStyle = "#4cc76a";
  const shake = plantShake > now ? Math.sin(now / 25) * 0.25 : 0;
  for (const a of [-0.6 + shake, shake, 0.6 + shake]) {
    g.beginPath();
    g.ellipse(638 + a * 20, 96, 9, 20, a, 0, Math.PI * 2);
    g.fill();
  }
  // Floor and rug.
  g.fillStyle = "#e7c49c";
  g.fillRect(0, 320, 800, 140);
  g.fillStyle = "rgba(160, 110, 60, 0.15)";
  for (let x = 0; x < 800; x += 80) g.fillRect(x, 320, 3, 140);
  g.fillStyle = "#b9a3ff";
  g.beginPath();
  g.ellipse(400, 400, 230, 44, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d6c9ff";
  g.beginPath();
  g.ellipse(400, 400, 190, 32, 0, 0, Math.PI * 2);
  g.fill();
  // Your decorations.
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const id of save.decorOn ?? []) {
    const item = itemById(id);
    if (!item?.spot) continue;
    const [dx, dy, size] = item.spot;
    g.font = `${size}px sans-serif`;
    const bob = id === "balloons" ? Math.sin(now / 600) * 6 : id === "stars" && now % 1400 < 700 ? 1 : 0;
    g.globalAlpha = id === "stars" && now % 1400 < 700 ? 0.6 : 1;
    g.fillText(item.icon, dx, dy + bob);
    if (id === "stars") g.fillText(item.icon, dx - 300, dy + 10);
    g.globalAlpha = 1;
  }
}

function drawBubble(text: string): void {
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.ellipse(560, 140, 50, 38, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(512, 186, 10, 0, Math.PI * 2);
  g.arc(496, 206, 6, 0, Math.PI * 2);
  g.fill();
  g.font = "40px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 560, 142);
}

let lastFrame = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.5, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  const pet = currentPet();
  if (doing && now > doing.until) finishCare();
  const what = doing?.need;
  const sleeping = what === "sleep";
  const dark = sleeping ? Math.min(1, (now - doing!.start) / 600, (doing!.until - now) / 600) : 0;
  drawRoom(now, dark);
  if (unholyGlow > now) {
    // Purple smoke puffing out of the plant.
    const fade = Math.min(1, (unholyGlow - now) / 800);
    for (let i = 0; i < 10; i++) {
      const p = ((now / 1600 + i / 10) % 1);
      g.fillStyle = `rgba(110, 50, 140, ${0.45 * (1 - p) * fade})`;
      g.beginPath();
      g.arc(638 + Math.sin(i * 1.7 + now / 400) * (20 + p * 80), 100 - p * 90 + p * p * 300, 18 + p * 30, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = `rgba(60, 20, 70, ${0.25 * fade})`;
    g.fillRect(0, 0, 800, 460);
  }
  if (holyGlow > now && save.holyFound) {
    // Golden light pouring in through the window.
    const fade = Math.min(1, (holyGlow - now) / 800);
    const beam = g.createLinearGradient(170, 60, 400, 440);
    beam.addColorStop(0, `rgba(255, 228, 120, ${0.7 * fade})`);
    beam.addColorStop(1, "rgba(255, 228, 120, 0)");
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(92, 62);
    g.lineTo(248, 62);
    g.lineTo(620, 460);
    g.lineTo(180, 460);
    g.fill();
  }

  if (!pet) {
    drawEgg(g, EGGS[0]!, 400, 400, 1, Math.sin(now / 200) * 0.08);
    g.fillStyle = "#3b2a63";
    g.font = '800 26px "Trebuchet MS", sans-serif';
    g.textAlign = "center";
    g.fillText("You have an egg! Click it to open it!", 400, 60);
  } else {
    // Needs go down slowly while you play (not while they're being looked after).
    if (!lost) {
      for (const p of save.pets) for (const n of NEEDS) if (p !== pet || n.id !== what) p.needs[n.id] = Math.max(0, p.needs[n.id] - n.drop * dt);
      // If anything gets all the way down to zero... you lose!
      for (const p of save.pets) {
        const empty = NEEDS.find((n) => p.needs[n.id] <= 0);
        if (empty) {
          youLose(p, empty.id);
          break;
        }
      }
    }
    const lowest = NEEDS.reduce((a, b) => (pet.needs[b.id] < pet.needs[a.id] ? b : a));
    const sad = pet.needs[lowest.id] < WANTS_AT / 2;
    const size = sizeOf(pet);
    let hop = 0;
    if (sleeping) {
      g.fillStyle = "#7c5cff";
      g.beginPath();
      g.roundRect(250, 330, 300, 70, 30);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.roundRect(270, 320, 90, 36, 18);
      g.fill();
    }
    if (what === "play") {
      // Bouncing a ball, and hopping after it.
      const p = (now - doing!.start) / 600;
      hop = Math.abs(Math.sin(p * Math.PI)) * 50;
      const bx = 400 + Math.cos(p * 1.3) * 200;
      const by = 390 - Math.abs(Math.sin(p * 2.2)) * 140;
      if (doing!.item) {
        g.font = "52px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(doing!.item.icon, bx, by);
      } else {
        g.fillStyle = "#ff5d73";
        g.beginPath();
        g.arc(bx, by, 22, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#ffffff";
        g.lineWidth = 4;
        g.beginPath();
        g.arc(bx, by, 14, -0.8, 0.8);
        g.stroke();
      }
    }
    othersInRoom().forEach((o, i) => {
      const [ox, oy] = SPOTS[i]!;
      const low = NEEDS.reduce((a, b) => (o.needs[b.id] < o.needs[a.id] ? b : a));
      drawPet(g, o.species, ox, oy, 0.38, { t: now + i * 700, happy: o.needs[low.id] >= WANTS_AT / 2, asleep: sleeping });
      g.fillStyle = "#3b2a63";
      g.font = '800 15px "Trebuchet MS", sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(o.name, ox, oy - 112, 150);
      if (o.needs[low.id] < WANTS_AT) {
        g.font = "22px sans-serif";
        g.fillText(low.icon, ox + 40, oy - 90);
      }
    });
    // A trick from being petted: a big jump, a spin around, or a roll.
    const tp = trick && !doing ? (now - trick.start) / TRICK_MS : 1;
    const middle = 400 - 130 * size;
    g.save();
    if (tp < 1) {
      if (trick!.kind === "jump") hop = Math.sin(tp * Math.PI) * 90;
      if (trick!.kind === "spin") {
        g.translate(400, 0);
        g.scale(Math.cos(tp * Math.PI * 2), 1);
        g.translate(-400, 0);
      }
      if (trick!.kind === "roll") {
        g.translate(400 + Math.sin(tp * Math.PI) * 60, middle);
        g.rotate(tp * Math.PI * 2);
        g.translate(-400, -middle);
      }
    }
    drawPet(g, pet.species, 400, 400, size, {
      t: now,
      happy: !!doing || !sad || hearts.length > 0 || tp < 1,
      asleep: sleeping,
      eating: what === "food" || what === "water",
      hop,
    });
    g.restore();
    if (pet.sparkle) {
      // Sparkle Potion sparkles, twinkling all around them.
      g.font = "26px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let i = 0; i < 7; i++) {
        const a = now / 1500 + (i / 7) * Math.PI * 2;
        g.globalAlpha = 0.5 + Math.sin(now / 200 + i) * 0.5;
        g.fillText(i % 2 ? "✨" : "⭐", 400 + Math.cos(a) * 140 * size, 400 - 130 * size - hop + Math.sin(a) * 110 * size);
      }
      g.globalAlpha = 1;
    }
    if (what === "food" || what === "water") {
      // A bowl in front, emptying as they eat.
      const left = 1 - (now - doing!.start) / (doing!.until - doing!.start);
      g.fillStyle = what === "food" ? "#ff6fa8" : "#3d8de0";
      g.beginPath();
      g.moveTo(340, 400);
      g.lineTo(460, 400);
      g.lineTo(445, 440);
      g.lineTo(355, 440);
      g.fill();
      g.fillStyle = what === "food" ? "#c26b3c" : "#5ab4ff";
      g.beginPath();
      g.ellipse(400, 400, 56 * Math.max(0.1, left), 9 * Math.max(0.3, left), 0, 0, Math.PI * 2);
      g.fill();
      if (doing!.item) {
        // What they're eating, getting smaller as it's eaten.
        g.font = `${Math.round(20 + 36 * left)}px sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(doing!.item.icon, 400, 384);
      }
    }
    if (sleeping) {
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.roundRect(240, 380, 320, 60, 26);
      g.fill();
      g.fillStyle = "#3b2a63";
      g.font = '800 32px "Trebuchet MS", sans-serif';
      g.textAlign = "center";
      for (let i = 0; i < 3; i++) {
        const p = ((now / 1400 + i / 3) % 1);
        g.globalAlpha = 1 - p;
        g.fillText("z", 470 + p * 60, 210 - p * 90 - i * 4);
      }
      g.globalAlpha = 1;
    }
    if (what === "bath") {
      // Bubbles all over.
      for (let i = 0; i < 18; i++) {
        const p = ((now / 1800 + i / 18) % 1);
        const bx = 400 + Math.sin(i * 2.3 + now / 500) * 110;
        const by = 400 - p * 300;
        g.globalAlpha = 1 - p;
        g.strokeStyle = "#6cc6ff";
        g.fillStyle = "rgba(200, 236, 255, 0.6)";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(bx, by, 10 + (i % 4) * 4, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (dark > 0) {
      g.fillStyle = `rgba(20, 16, 60, ${dark * 0.45})`;
      g.fillRect(0, 0, 800, 460);
    }
    if (!doing && pet.needs[lowest.id] < WANTS_AT) drawBubble(lowest.icon);

    // Hearts from petting.
    hearts = hearts.filter((h) => now - h.at < 1400);
    g.font = "30px sans-serif";
    g.textAlign = "center";
    for (const h of hearts) {
      if (now < h.at) continue;
      const p = (now - h.at) / 1400;
      g.globalAlpha = 1 - p;
      g.fillText("💗", h.x, h.y - p * 120);
    }
    g.globalAlpha = 1;

    // The care buttons show how much each thing is needed.
    for (const n of NEEDS) {
      const { button, bar } = careButtons.get(n.id)!;
      const v = pet.needs[n.id];
      bar.style.width = `${v}%`;
      bar.style.background = v < 30 ? "#ff5d73" : v < WANTS_AT ? "#ffb341" : "#4cc76a";
      button.classList.toggle("wants", !doing && v < WANTS_AT);
      button.disabled = !!doing;
    }
    if (doing) {
      const text = `${pet.name} ${NEEDS.find((n) => n.id === what)!.busy}`;
      if (text !== message) {
        message = text;
        messageEl.textContent = text;
      }
    } else if (now > messageUntil) {
      const text = pet.needs[lowest.id] < WANTS_AT ? `${pet.name} ${lowest.wants} ${lowest.icon}` : `${pet.name} is happy! 💕`;
      if (text !== message) {
        message = text;
        messageEl.textContent = text;
      }
    }
  }
  requestAnimationFrame(frame);
}

// ---- The Egg Shop, and hatching ----

const priceOf = (egg: Egg): number => (egg === EGGS[0] && save.freeEgg ? 0 : egg.price);

function show(title: string, note: string): void {
  overlay.hidden = false;
  overlayTitle.textContent = title;
  overlayNote.textContent = note;
  overlayBody.innerHTML = "";
  overlayButtons.innerHTML = "";
}

// ---- You lose! ----
// When a need bar gets all the way to zero, you can give up (and start
// over) or continue. The first continue is free; after that each one costs
// more than the last.

let lost = false;
const CONTINUE_STEP = 20;
const continueCost = (): number => (save.continues ?? 0) * CONTINUE_STEP;

function youLose(pet: Pet, need: NeedId): void {
  lost = true;
  if (doing) doing = null;
  const n = NEEDS.find((x) => x.id === need)!;
  show("😢 You lose!", `${pet.name}'s ${n.label} ${n.icon} went all the way down to zero!`);
  const c = document.createElement("canvas");
  c.width = 420;
  c.height = 300;
  c.className = "hatch";
  const cg = c.getContext("2d")!;
  cg.fillStyle = "#e9e4f5";
  cg.fillRect(0, 0, 420, 300);
  drawPet(cg, pet.species, 210, 285, 0.75, { t: 1000, happy: false });
  overlayBody.append(c);
  const cost = continueCost();
  const cont = overlayButton(cost ? `Continue (${cost} bucks)` : "Continue (free!)", () => {
    if (!canAfford(cost)) return;
    spend(cost);
    save.continues = (save.continues ?? 0) + 1;
    pet.needs[need] = 50;
    for (const x of NEEDS) if (pet.needs[x.id] < 10) pet.needs[x.id] = 10;
    lost = false;
    store();
    closeOverlay();
    showPets();
    say(`Phew! Quick, take care of ${pet.name}! ${n.icon}`, 4000);
  }, true);
  if (!canAfford(cost)) {
    cont.disabled = true;
    overlayNote.textContent += ` You need ${cost} bucks to continue, and you have ${bucksText()}.`;
  }
  let sure = false;
  const giveUp = overlayButton("Give up", () => {
    if (!sure) {
      sure = true;
      giveUp.textContent = "Sure? You'll start all over! Tap again";
      window.setTimeout(() => {
        sure = false;
        giveUp.textContent = "Give up";
      }, 3000);
      return;
    }
    // Start all over: no pets, no bucks, and a new free egg. (A secret you found stays found.)
    save.pets = [];
    save.bucks = 0;
    save.current = "";
    save.freeEgg = true;
    save.continues = 0;
    lost = false;
    store();
    closeOverlay();
    showPets();
    openEggShop();
  });
}

function closeOverlay(): void {
  if (lost) return; // the You Lose screen stays until you pick Give up or Continue
  overlay.hidden = true;
  hatching = null;
}

function overlayButton(label: string, onClick: () => void, main = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = main ? "pill pill-main" : "pill";
  b.textContent = label;
  b.addEventListener("click", onClick);
  overlayButtons.append(b);
  return b;
}

function openEggShop(): void {
  show("🥚 Egg Shop", `You have ${bucksText()} bucks. Take care of your pets to earn more!`);
  const grid = document.createElement("div");
  grid.className = "egg-grid";
  for (const egg of EGGS.filter((e) => !e.hidden || (e.id === "holy" ? save.holyFound : save.unholyFound))) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "egg-card";
    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 220;
    drawEgg(c.getContext("2d")!, egg, 110, 205, 1.1, 0);
    const name = document.createElement("strong");
    name.textContent = egg.name;
    const price = document.createElement("span");
    price.className = "price";
    price.textContent = priceOf(egg) ? `${egg.price} bucks` : "FREE!";
    const inside = document.createElement("span");
    inside.className = "inside";
    inside.textContent = "Could hatch: " + egg.inside.map(([id]) => SPECIES[id].name).join(", ");
    b.append(c, name, price, inside);
    b.disabled = !canAfford(priceOf(egg));
    b.addEventListener("click", () => {
      if (!canAfford(priceOf(egg))) return;
      spend(priceOf(egg));
      if (egg === EGGS[0]) save.freeEgg = false;
      store();
      showPets();
      hatch(egg);
    });
    grid.append(b);
  }
  overlayBody.append(grid);
  overlayButton("Close", closeOverlay);
}

let hatching: { egg: Egg; taps: number; wobbleAt: number; popAt: number; pet: SpeciesId } | null = null;
const TAPS = 6;

function hatch(egg: Egg): void {
  show(egg.name, "Tap the egg to crack it open!");
  const c = document.createElement("canvas");
  c.width = 420;
  c.height = 420;
  c.className = "hatch";
  c.setAttribute("aria-label", "Your egg. Tap it to open it!");
  overlayBody.append(c);
  const hg = c.getContext("2d")!;
  hatching = { egg, taps: 0, wobbleAt: 0, popAt: 0, pet: hatchFrom(egg) };
  const h = hatching;
  c.addEventListener("click", () => {
    if (h.popAt) return;
    h.taps++;
    h.wobbleAt = performance.now();
    if (h.taps >= TAPS) {
      h.popAt = performance.now();
      window.setTimeout(() => hatched(h.pet), 900);
    }
  });
  const draw = (now: number): void => {
    if (hatching !== h) return;
    hg.clearRect(0, 0, 420, 420);
    const bg = hg.createRadialGradient(210, 230, 20, 210, 230, 220);
    bg.addColorStop(0, "#fff8d6");
    bg.addColorStop(1, "#efe6ff");
    hg.fillStyle = bg;
    hg.fillRect(0, 0, 420, 420);
    if (!h.popAt) {
      const since = now - h.wobbleAt;
      const wobble = since < 400 ? Math.sin(since / 30) * 0.2 * (1 - since / 400) : Math.sin(now / 300) * 0.03;
      drawEgg(hg, h.egg, 210, 380, 1.5, wobble, h.taps / TAPS);
    } else {
      // Pop! Sparkles fly out and the pet appears.
      const p = Math.min(1, (now - h.popAt) / 900);
      hg.globalAlpha = 1 - p;
      drawEgg(hg, h.egg, 210, 380, 1.5 * (1 + p * 0.6), 0, 1);
      hg.globalAlpha = 1;
      hg.font = "28px sans-serif";
      hg.textAlign = "center";
      hg.textBaseline = "middle";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        hg.fillText("✨", 210 + Math.cos(a) * p * 180, 230 + Math.sin(a) * p * 180);
      }
    }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  overlayButton("Back to the shop", openEggShop);
}

function hatched(id: SpeciesId, adopted = false): void {
  const sp = SPECIES[id];
  show(adopted ? `You adopted a ${sp.name}!` : `You got a ${sp.name}!`, "");
  const rarity = document.createElement("p");
  rarity.className = "overlay-note";
  rarity.textContent = sp.rarity === "Common" ? "Common" : sp.rarity === "Heavenly" ? "😇 HEAVENLY! 😇" : sp.rarity === "Unholy" ? "😈 UNHOLY! 😈" : sp.rarity === "Secret" ? "🌙 SECRET PET! 🌙" : `✨ ${sp.rarity}! ✨`;
  rarity.style.color = RARITY_COLORS[sp.rarity];
  rarity.style.fontSize = "1.4rem";
  overlayBody.append(rarity);
  const c = document.createElement("canvas");
  c.width = 420;
  c.height = 360;
  c.className = "hatch";
  overlayBody.append(c);
  const hg = c.getContext("2d")!;
  const born = performance.now();
  const draw = (now: number): void => {
    if (overlay.hidden || !c.isConnected) return;
    hg.clearRect(0, 0, 420, 360);
    const bg = hg.createRadialGradient(210, 200, 20, 210, 200, 220);
    bg.addColorStop(0, "#fff8d6");
    bg.addColorStop(1, "#efe6ff");
    hg.fillStyle = bg;
    hg.fillRect(0, 0, 420, 360);
    const grow = Math.min(1, (now - born) / 500);
    drawPet(hg, id, 210, 330, 0.85 * grow, { t: now, happy: true, hop: Math.abs(Math.sin(now / 300)) * 10 });
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  const label = document.createElement("label");
  label.className = "name-it";
  label.textContent = "Name your pet: ";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 20;
  input.value = sp.name;
  label.append(input);
  overlayBody.append(label);
  overlayButton(
    "🏠 Take them home",
    () => {
      const pet: Pet = {
        id: `p${Date.now()}`,
        species: id,
        name: input.value.trim() || sp.name,
        xp: 0,
        needs: { food: 50, water: 55, sleep: 90, bath: 80, play: 45 },
      };
      save.pets.push(pet);
      save.current = pet.id;
      store();
      closeOverlay();
      showPets();
      say(`Welcome home, ${pet.name}! ${pet.name} is a little hungry. 🍖`, 4500);
    },
    true,
  );
}

// ---- The street and its shops ----
// Your house is first, then the shops. Tap the right side to drive forward,
// the left side to drive back, and the middle to go in.

interface Shop {
  name: string;
  icon: string;
  wall: string;
  awning: string;
  sells?: ItemKind; // what kind of things it sells (the Pet Shop sells pets)
  note: string;
}

const SHOPS: Shop[] = [
  { name: "Home", icon: "🏠", wall: "#ffe9f2", awning: "#8f6cff", note: "" },
  { name: "Food Market", icon: "🥕", wall: "#e4f8e6", awning: "#3fae5a", sells: "food", note: "Yummy food and drinks for your pets!" },
  { name: "Sweet Shop", icon: "🍭", wall: "#ffe4f2", awning: "#ff6fa8", sells: "sweet", note: "Sweets fill up a little Food and a lot of Play!" },
  { name: "Toy Store", icon: "🧸", wall: "#e0f0ff", awning: "#3b82f6", note: "Toys are yours forever. Play with them as much as you want!", sells: "toy" },
  { name: "Decoration Shop", icon: "🎈", wall: "#fff4c9", awning: "#f2a20c", sells: "decor", note: "Make your room pretty! Decorations go in your room." },
  { name: "Pet Shop", icon: "🐾", wall: "#f3e6ff", awning: "#a855f7", note: "Adopt a pet without opening an egg!" },
];

/** The secret shop, hidden down a path behind your house (to the left of Home). */
const MAGIC_SHOP: Shop = {
  name: "Secret Magic Shop",
  icon: "🔮",
  wall: "#3b2a63",
  awning: "#c084fc",
  sells: "potion",
  note: "Shhh! Magic potions! Give one to your pet from 🎒 My stuff.",
};
const shopAt = (i: number): Shop => (i < 0 ? MAGIC_SHOP : SHOPS[i]!);
let leftAtHome = 0;

const SHOP_GAP = 300;
let streetAt = 0;
let streetCam = 0;

function openStreet(at: number): void {
  streetAt = at;
  streetCam = at * SHOP_GAP;
  show("🚗 The Street", "Tap the right side to drive forward, the left side to drive back. Tap a shop to go in!");
  const c = document.createElement("canvas");
  c.width = 820;
  c.height = 460;
  c.className = "street";
  c.setAttribute("aria-label", "The street, with shops all along it");
  overlayBody.append(c);
  const sg = c.getContext("2d")!;
  c.addEventListener("click", (e) => {
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 820;
    if (x < 200 && streetAt === 0 && !save.magicFound) {
      // The secret: keep driving left from your house...
      leftAtHome++;
      if (leftAtHome >= 3) {
        save.magicFound = true;
        store();
        streetAt = -1;
        overlayNote.textContent = "🔮 You found a secret path behind your house... the SECRET MAGIC SHOP! Tap it to go in!";
      } else {
        overlayNote.textContent = leftAtHome === 1 ? "There's nothing that way... or is there?" : "Hmm, you hear something magical down there...";
      }
    } else if (x < 200) streetAt = Math.max(save.magicFound ? -1 : 0, streetAt - 1);
    else if (x > 620) streetAt = Math.min(SHOPS.length - 1, streetAt + 1);
    else if (streetAt === 0) closeOverlay();
    else openShop(streetAt);
  });
  const draw = (now: number): void => {
    if (overlay.hidden || !c.isConnected) return;
    streetCam += (streetAt * SHOP_GAP - streetCam) * 0.12;
    const sky = sg.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, "#8fd0ff");
    sky.addColorStop(1, "#e8f6ff");
    sg.fillStyle = sky;
    sg.fillRect(0, 0, 820, 460);
    SHOPS.forEach((shop, i) => {
      const x = 410 + i * SHOP_GAP - streetCam;
      if (x > -200 && x < 1020) drawShopFront(sg, x, shop, i === streetAt, i === 0);
    });
    if (save.magicFound) {
      const x = 410 - SHOP_GAP - streetCam;
      if (x > -200) {
        drawShopFront(sg, x, MAGIC_SHOP, streetAt === -1, false);
        sg.font = "26px sans-serif";
        for (let i = 0; i < 5; i++) sg.fillText("✨", x - 110 + i * 55, 96 + Math.sin(now / 300 + i) * 8);
      }
    }
    sg.fillStyle = "#d9d4cc";
    sg.fillRect(0, 330, 820, 24);
    sg.fillStyle = "#4a4a55";
    sg.fillRect(0, 354, 820, 106);
    sg.fillStyle = "#ffe36e";
    for (let x = -(streetCam % 80); x < 820; x += 80) sg.fillRect(x, 404, 44, 6);
    // Your car, bouncing a little while it drives.
    const moving = Math.abs(streetAt * SHOP_GAP - streetCam) > 2;
    sg.font = "90px sans-serif";
    sg.textAlign = "center";
    sg.textBaseline = "middle";
    sg.save();
    sg.translate(410, 400 - (moving ? Math.abs(Math.sin(now / 70)) * 3 : 0));
    sg.scale(-1, 1); // facing forward, down the street
    sg.fillText("🚗", 0, 0);
    sg.restore();
    sg.fillStyle = "rgba(255, 255, 255, 0.85)";
    sg.font = '900 40px "Trebuchet MS", sans-serif';
    if (streetAt > (save.magicFound ? -1 : 0)) sg.fillText("◀", 40, 230);
    if (streetAt < SHOPS.length - 1) sg.fillText("▶", 780, 230);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  overlayButton("🏠 Go home", closeOverlay, true);
}

function drawShopFront(sg: G, x: number, shop: Shop, here: boolean, home: boolean): void {
  const w = 250;
  if (home) {
    // Your house: a pointy roof instead of an awning.
    sg.fillStyle = shop.awning;
    sg.beginPath();
    sg.moveTo(x - w / 2 - 14, 150);
    sg.lineTo(x, 70);
    sg.lineTo(x + w / 2 + 14, 150);
    sg.fill();
  }
  sg.fillStyle = shop.wall;
  sg.fillRect(x - w / 2, home ? 150 : 110, w, home ? 180 : 220);
  sg.strokeStyle = here ? "#8f6cff" : "rgba(0, 0, 0, 0.1)";
  sg.lineWidth = here ? 5 : 2;
  sg.strokeRect(x - w / 2, home ? 150 : 110, w, home ? 180 : 220);
  if (!home) {
    for (let i = 0; i < 10; i++) {
      sg.fillStyle = i % 2 ? "#ffffff" : shop.awning;
      sg.fillRect(x - w / 2 + i * 25, 150, 25, 24);
    }
  }
  sg.fillStyle = "#bfe6ff";
  sg.fillRect(x - w / 2 + 16, 190, 90, 80);
  sg.fillRect(x + 26, 190, 90, 80);
  sg.fillStyle = "#8b5a2b";
  sg.fillRect(x - 22, 260, 44, 70);
  sg.font = "44px sans-serif";
  sg.textAlign = "center";
  sg.textBaseline = "middle";
  sg.fillText(shop.icon, x - w / 2 + 61, 230);
  sg.fillText(shop.icon, x + 71, 230);
  sg.font = '900 18px "Trebuchet MS", sans-serif';
  const label = home ? "Home" : shop.name;
  const signW = Math.min(w + 20, sg.measureText(label).width + 24);
  sg.fillStyle = "#ffffff";
  sg.beginPath();
  sg.roundRect(x - signW / 2, home ? 112 : 116, signW, 30, 10);
  sg.fill();
  sg.fillStyle = shop.awning;
  sg.fillText(label, x, home ? 127 : 131, w);
}

const PET_PRICES: [SpeciesId, number][] = [
  ["dog", 200],
  ["cat", 200],
  ["bunny", 200],
  ["hamster", 150],
  ["pig", 400],
  ["fox", 500],
  ["panda", 1000],
];

function openShop(n: number): void {
  const shop = shopAt(n);
  show(`${shop.icon} ${shop.name}`, `${shop.note} You have ${bucksText()} bucks.`);
  const grid = document.createElement("div");
  grid.className = "shop-grid";
  const refresh = (): void => {
    overlayNote.textContent = `${shop.note} You have ${bucksText()} bucks.`;
    grid.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.dispatchEvent(new Event("refresh")));
  };
  if (shop.sells) {
    for (const item of ITEMS.filter((i) => i.kind === shop.sells)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shop-item";
      const forever = item.kind === "toy" || item.kind === "decor";
      const paint = (): void => {
        const have = save.items?.[item.id] ?? 0;
        b.innerHTML = `<span class="icon">${item.icon}</span><span>${item.name}</span><span class="price">${item.price} bucks</span><small>${
          forever ? (have ? "You have it!" : "") : have ? `You have ${have}` : ""
        }</small>`;
        b.disabled = !canAfford(item.price) || (forever && have > 0);
      };
      paint();
      b.addEventListener("refresh", paint);
      b.addEventListener("click", () => {
        if (b.disabled) return;
        spend(item.price);
        save.items = save.items ?? {};
        save.items[item.id] = (save.items[item.id] ?? 0) + 1;
        if (item.kind === "decor") save.decorOn = [...new Set([...(save.decorOn ?? []), item.id])];
        store();
        showPets();
        refresh();
        say(item.kind === "decor" ? `You bought the ${item.name}! It's in your room. ${item.icon}` : `You bought a ${item.name}! It's in 🎒 My stuff. ${item.icon}`, 3000);
        overlayNote.textContent = item.kind === "decor" ? `You bought the ${item.name}! It's in your room now.` : `You bought a ${item.name}! It's in 🎒 My stuff.`;
      });
      grid.append(b);
    }
  } else {
    // The Pet Shop: adopt a pet straight away. (Unicorns, dragons and the secret pets only come from eggs!)
    for (const [id, price] of PET_PRICES) {
      const sp = SPECIES[id];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "shop-item";
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 170;
      drawPet(c.getContext("2d")!, id, 100, 160, 0.55, { t: 1000, happy: true });
      const name = document.createElement("span");
      name.textContent = sp.name;
      const p = document.createElement("span");
      p.className = "price";
      p.textContent = `${price} bucks`;
      const r = document.createElement("small");
      r.textContent = sp.rarity;
      r.style.color = RARITY_COLORS[sp.rarity];
      b.append(c, name, p, r);
      const paint = (): void => {
        b.disabled = !canAfford(price);
      };
      paint();
      b.addEventListener("refresh", paint);
      b.addEventListener("click", () => {
        if (!canAfford(price)) return;
        spend(price);
        store();
        showPets();
        hatched(id, true);
      });
      grid.append(b);
    }
    const eggsOnly = document.createElement("p");
    eggsOnly.className = "overlay-note";
    eggsOnly.textContent = "Unicorns, Dragons and secret pets only come out of eggs!";
    overlayBody.append(eggsOnly);
  }
  overlayBody.prepend(grid);
  overlayButton("🚗 Back to the street", () => openStreet(n), true);
  overlayButton("🏠 Go home", closeOverlay);
}

document.getElementById("eggs")!.addEventListener("click", openEggShop);

showPets();
requestAnimationFrame(frame);
if (!save.pets.length) openEggShop();
