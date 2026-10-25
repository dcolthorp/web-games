import { installForceRefreshHotkey } from "../../shared/forceRefreshHotkey";
import { installOofShortcut } from "../../shared/oofShortcut";
import {
  COLORS,
  designName,
  designs,
  onPicturesLoaded,
  saveDesigns,
  takeOffDesigns,
  toggleDesign,
  drawDoll,
  EYE_COLORS,
  drawPlace,
  HAIR_COLORS,
  SKINS,
  START,
  type Bottom,
  type Coat,
  type Design,
  type DesignKind,
  type Dress,
  type Extra,
  type Eyes,
  type Kind,
  type Hair,
  type Look,
  type Place,
  type Shoes,
  type Top,
} from "./doll";
import { getCoins, openShop, openStudio, startShopping } from "./studio";

installOofShortcut();
installForceRefreshHotkey();

// Penelope's idea: a doll you can dress up. Pick a tab (hair, tops, skirts,
// dresses, shoes, extras, skin, places), tap a picture to put it on, and tap
// a colour to change what she's wearing. In the Design Studio you sketch and
// sew your own clothes (studio.ts), wear them here, and sell them in your
// shop. Every button has a little picture of the doll wearing that thing, so
// you don't need to read to play. Her outfit is remembered for next time.

const SAVE_KEY = "dress-up-look";

function load(): Look {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      // Older saves kept one clothes design and one wig.
      const mine = Array.isArray(saved.mine) ? saved.mine : [saved.design, saved.wig].filter((x) => typeof x === "string");
      return { ...START, ...saved, mine, extras: Array.isArray(saved.extras) ? saved.extras : START.extras };
    }
  } catch {
    // A broken save just means starting fresh.
  }
  return { ...START, extras: [...START.extras] };
}

let look = load();
const save = (): void => localStorage.setItem(SAVE_KEY, JSON.stringify(look));

// ---- The big picture ----

const canvas = document.getElementById("doll") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
let sparkles: { x: number; y: number; at: number }[] = [];

function sparkle(): void {
  const now = performance.now();
  for (let i = 0; i < 10; i++) sparkles.push({ x: 150 + Math.random() * 300, y: 60 + Math.random() * 480, at: now + i * 40 });
}

function frame(now: number): void {
  drawPlace(ctx, look.place, 600, 600);
  ctx.save();
  ctx.translate(150, 20 + Math.sin(now / 600) * 3);
  drawDoll(ctx, look);
  ctx.restore();
  sparkles = sparkles.filter((s) => now - s.at < 700);
  for (const s of sparkles) {
    const k = (now - s.at) / 700;
    if (k < 0) continue;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#ffe36e";
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? 3 : 10 + k * 6;
      ctx.lineTo(s.x + Math.cos(a) * r, s.y - k * 30 + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}

// ---- The wardrobe ----

interface Tab {
  id: string;
  icon: string;
  name: string;
  items: { id: string; name: string }[];
  current: () => string | string[];
  pick: (id: string) => void;
  colors?: string[];
  color?: () => string;
  setColor?: (c: string) => void;
}

const TABS: Tab[] = [
  {
    id: "hair", icon: "💇", name: "Hair",
    items: [{ id: "long", name: "Long" }, { id: "pigtails", name: "Pigtails" }, { id: "bun", name: "Bun" }, { id: "short", name: "Short" }, { id: "ponytail", name: "Ponytail" }, { id: "curly", name: "Curly" }],
    current: () => look.hair, pick: (id) => (look.hair = id as Hair),
    colors: HAIR_COLORS, color: () => look.hairColor, setColor: (c) => (look.hairColor = c),
  },
  {
    id: "kind", icon: "🧒", name: "Girl or boy",
    items: [{ id: "girl", name: "Girl" }, { id: "boy", name: "Boy" }],
    current: () => look.kind,
    pick: (id) => {
      // Switching gives a starting hairstyle to go with it (change it any time).
      if (id === look.kind) return;
      look.kind = id as Kind;
      if (id === "boy") {
        look.hair = "short";
        look.extras = look.extras.filter((e) => e !== "bow");
        if (look.dress !== "none") (look.dress = "none"), (look.top = "tshirt"), (look.bottom = "pants");
      } else {
        look.hair = "long";
      }
    },
  },
  {
    id: "eyes", icon: "👀", name: "Eyes",
    items: [{ id: "round", name: "Round" }, { id: "sparkly", name: "Sparkly" }, { id: "happy", name: "Happy" }, { id: "star", name: "Star eyes" }, { id: "heart", name: "Heart eyes" }, { id: "wink", name: "Wink" }],
    current: () => look.eyes, pick: (id) => (look.eyes = id as Eyes),
    colors: EYE_COLORS, color: () => look.eyeColor, setColor: (c) => (look.eyeColor = c),
  },
  {
    id: "top", icon: "👕", name: "Tops",
    items: [{ id: "tshirt", name: "T-shirt" }, { id: "tank", name: "Tank top" }, { id: "sweater", name: "Sweater" }, { id: "puffy", name: "Puffy" }, { id: "none", name: "None" }],
    current: () => look.top, pick: (id) => ((look.top = id as Top), (look.dress = "none")),
    colors: COLORS, color: () => look.topColor, setColor: (c) => (look.topColor = c),
  },
  {
    id: "bottom", icon: "👖", name: "Skirts & pants",
    items: [{ id: "skirt", name: "Skirt" }, { id: "pants", name: "Pants" }, { id: "shorts", name: "Shorts" }, { id: "tutu", name: "Tutu" }, { id: "none", name: "None" }],
    current: () => look.bottom, pick: (id) => ((look.bottom = id as Bottom), (look.dress = "none")),
    colors: COLORS, color: () => look.bottomColor, setColor: (c) => (look.bottomColor = c),
  },
  {
    id: "dress", icon: "👗", name: "Dresses",
    items: [{ id: "gown", name: "Princess gown" }, { id: "sundress", name: "Sundress" }, { id: "party", name: "Party dress" }, { id: "none", name: "None" }],
    current: () => look.dress, pick: (id) => (look.dress = id as Dress),
    colors: COLORS, color: () => look.dressColor, setColor: (c) => (look.dressColor = c),
  },
  {
    id: "coat", icon: "🧥", name: "Coats",
    items: [{ id: "raincoat", name: "Raincoat" }, { id: "puffer", name: "Puffy coat" }, { id: "cape", name: "Cape" }, { id: "none", name: "No coat" }],
    current: () => look.coat, pick: (id) => (look.coat = id as Coat),
    colors: COLORS, color: () => look.coatColor, setColor: (c) => (look.coatColor = c),
  },
  {
    id: "shoes", icon: "👟", name: "Shoes",
    items: [{ id: "sneakers", name: "Sneakers" }, { id: "boots", name: "Boots" }, { id: "sandals", name: "Sandals" }, { id: "heels", name: "Sparkly heels" }, { id: "none", name: "Barefoot" }],
    current: () => look.shoes, pick: (id) => (look.shoes = id as Shoes),
    colors: COLORS, color: () => look.shoesColor, setColor: (c) => (look.shoesColor = c),
  },
  {
    id: "extras", icon: "👑", name: "Extras",
    items: [{ id: "bow", name: "Bow" }, { id: "crown", name: "Crown" }, { id: "tiara", name: "Tiara" }, { id: "glasses", name: "Sunglasses" }, { id: "necklace", name: "Necklace" }, { id: "ears", name: "Cat ears" }, { id: "wings", name: "Fairy wings" }, { id: "wand", name: "Magic wand" }],
    current: () => look.extras,
    pick: (id) => {
      // Extras go on and off: you can wear as many as you like.
      const e = id as Extra;
      look.extras = look.extras.includes(e) ? look.extras.filter((x) => x !== e) : [...look.extras, e];
    },
    colors: COLORS, color: () => look.extraColor, setColor: (c) => (look.extraColor = c),
  },
  {
    id: "skin", icon: "🎨", name: "Skin",
    items: SKINS.map((s, i) => ({ id: s, name: `Skin ${i + 1}` })),
    current: () => look.skin, pick: (id) => (look.skin = id),
  },
  {
    id: "mine", icon: "✏️", name: "My designs",
    get items() {
      return [...designs.map((d) => ({ id: d.id, name: designName(d) })), { id: "none", name: "Take it off" }];
    },
    // Wear one of each kind at once; tap one again to take it off.
    current: () => look.mine,
    pick: (id) => {
      if (id === "none") {
        look.mine = [];
        return;
      }
      const d = designs.find((x) => x.id === id);
      if (d) toggleDesign(look, d);
    },
  },
  {
    id: "place", icon: "🏞️", name: "Places",
    items: [{ id: "bedroom", name: "Bedroom" }, { id: "garden", name: "Garden" }, { id: "beach", name: "Beach" }, { id: "castle", name: "Castle" }, { id: "space", name: "Space" }],
    current: () => look.place, pick: (id) => (look.place = id as Place),
  },
];

let tab = TABS[0]!;
const tabsEl = document.getElementById("tabs")!;
const itemsEl = document.getElementById("items")!;
const colorsEl = document.getElementById("colors")!;

/** The look you'd get by picking `id` on the current tab (for the little pictures). */
function tryOn(t: Tab, id: string): Look {
  const saved = look;
  look = { ...look, extras: [...look.extras] };
  if (t.id === "extras") look.extras = [id as Extra];
  else if (t.id === "mine") {
    // The little picture shows it on, even if it's on already.
    const d = designs.find((x) => x.id === id);
    if (!d) look.mine = [];
    else if (!look.mine.includes(id)) toggleDesign(look, d);
  } else t.pick(id);
  // Shoe pictures show bare legs, so the shoes are easy to see.
  if (t.id === "shoes") {
    look.dress = "none";
    look.coat = "none";
    look.bottom = "shorts";
  }
  const tried = look;
  look = saved;
  return tried;
}

function thumbnail(t: Tab, id: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 200;
  const g = c.getContext("2d")!;
  const l = tryOn(t, id);
  if (t.id === "place") {
    drawPlace(g, l.place, 160, 200);
    g.translate(45, 50);
    g.scale(0.24, 0.24);
  } else if (t.id === "shoes") {
    // Zoom in on the feet.
    g.fillStyle = "#fff0f8";
    g.fillRect(0, 0, 160, 200);
    g.translate(-205, -887);
    g.scale(1.9, 1.9);
  } else if (t.id === "hair" || t.id === "eyes" || t.id === "kind" || t.id === "extras" && ["bow", "crown", "tiara", "glasses", "ears"].includes(id)) {
    // Zoom in on the head.
    g.fillStyle = "#fff0f8";
    g.fillRect(0, 0, 160, 200);
    g.translate(-80, -20);
    g.scale(1.07, 1.07);
  } else {
    g.fillStyle = "#fff0f8";
    g.fillRect(0, 0, 160, 200);
    g.translate(30, 4);
    g.scale(0.33, 0.33);
  }
  drawDoll(g, l);
  return c;
}

function render(): void {
  tabsEl.innerHTML = "";
  for (const t of TABS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(t === tab));
    b.innerHTML = `<span class="icon" aria-hidden="true">${t.icon}</span>${t.name}`;
    b.addEventListener("click", () => {
      tab = t;
      render();
    });
    tabsEl.append(b);
  }
  itemsEl.innerHTML = "";
  const current = tab.current();
  for (const item of tab.items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "item";
    const on = Array.isArray(current) ? current.includes(item.id) : current === item.id;
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", item.name);
    b.append(thumbnail(tab, item.id), item.name);
    b.addEventListener("click", () => {
      // Putting on ordinary clothes takes off your own design.
      const covers: Record<string, DesignKind[]> = {
        top: ["shirt", "dress"],
        bottom: ["skirt", "dress"],
        dress: ["shirt", "skirt", "dress"],
        coat: ["coat"],
        hair: ["wig"],
      };
      if (covers[tab.id]) takeOffDesigns(look, covers[tab.id]!);
      tab.pick(item.id);
      changed();
    });
    const design = tab.id === "mine" ? designs.find((d) => d.id === item.id) : undefined;
    if (design) {
      // Your own designs get a name box under them, to rename them any time.
      const card = document.createElement("div");
      card.className = "design-card";
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 30;
      input.value = design.name ?? "";
      input.placeholder = designName(design);
      input.setAttribute("aria-label", `Rename ${designName(design)}`);
      input.addEventListener("input", () => {
        design.name = input.value;
        saveDesigns();
        // Just the label on its button changes, so you can keep typing.
        b.lastChild!.textContent = designName(design);
        b.setAttribute("aria-label", designName(design));
      });
      const shopButton = document.createElement("button");
      shopButton.type = "button";
      shopButton.className = "pill";
      const label = (): string => (design.onDisplay ? "🏪 In your shop" : "Put in shop");
      shopButton.textContent = label();
      shopButton.addEventListener("click", () => {
        design.onDisplay = !design.onDisplay;
        saveDesigns();
        shopButton.textContent = label();
      });
      // Delete it (tap twice, so nothing gets deleted by accident).
      const del = document.createElement("button");
      del.type = "button";
      del.className = "pill";
      del.textContent = "🗑️ Delete";
      del.addEventListener("click", () => {
        if (!del.dataset["sure"]) {
          del.dataset["sure"] = "1";
          del.textContent = "Sure? Tap again";
          window.setTimeout(() => {
            delete del.dataset["sure"];
            del.textContent = "🗑️ Delete";
          }, 3000);
          return;
        }
        designs.splice(designs.indexOf(design), 1);
        look.mine = look.mine.filter((id) => id !== design.id);
        saveDesigns();
        changed();
      });
      card.append(b, input, shopButton, del);
      itemsEl.append(card);
      continue;
    }
    itemsEl.append(b);
  }
  colorsEl.innerHTML = "";
  for (const c of tab.colors ?? []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.background = c;
    b.setAttribute("aria-label", `Color ${c}`);
    b.setAttribute("aria-pressed", String(tab.color?.() === c));
    b.addEventListener("click", () => {
      tab.setColor?.(c);
      changed();
    });
    colorsEl.append(b);
  }
}

function changed(): void {
  save();
  sparkle();
  render();
}

const pickFrom = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

document.getElementById("surprise")!.addEventListener("click", () => {
  const dress = Math.random() < 0.35;
  look = {
    mine: [],
    kind: look.kind,
    skin: look.skin,
    eyes: pickFrom(["round", "sparkly", "happy", "star", "heart", "wink"] as const),
    eyeColor: pickFrom(EYE_COLORS),
    hair: pickFrom(["long", "pigtails", "bun", "short", "ponytail", "curly"] as const),
    hairColor: pickFrom(HAIR_COLORS),
    top: pickFrom(["tshirt", "tank", "sweater", "puffy"] as const),
    topColor: pickFrom(COLORS),
    bottom: pickFrom(["skirt", "pants", "shorts", "tutu"] as const),
    bottomColor: pickFrom(COLORS),
    dress: dress ? pickFrom(["gown", "sundress", "party"] as const) : "none",
    dressColor: pickFrom(COLORS),
    shoes: pickFrom(["sneakers", "boots", "sandals", "heels"] as const),
    shoesColor: pickFrom(COLORS),
    coat: Math.random() < 0.3 ? pickFrom(["raincoat", "puffer", "cape"] as const) : "none",
    coatColor: pickFrom(COLORS),
    extras: (["bow", "crown", "tiara", "glasses", "necklace", "ears", "wings", "wand"] as const).filter(() => Math.random() < 0.25),
    extraColor: pickFrom(COLORS),
    place: pickFrom(["bedroom", "garden", "beach", "castle", "space"] as const),
  };
  changed();
});

const studioHooks = {
  wear: (d: Design) => {
    if (!look.mine.includes(d.id)) toggleDesign(look, d);
    tab = TABS.find((t) => t.id === "mine")!;
    changed();
  },
  changed: () => {
    // Anything that's gone (like something a shop took back) comes off the doll.
    look.mine = look.mine.filter((id) => designs.some((d) => d.id === id));
    save();
    render();
    showCoins();
  },
};

const coinsEl = document.getElementById("coins")!;
const saleEl = document.getElementById("sale") as HTMLParagraphElement;
let saleTimer = 0;
function showCoins(): void {
  coinsEl.textContent = getCoins().toLocaleString("en-US");
}
startShopping((text) => {
  showCoins();
  saleEl.textContent = text;
  saleEl.hidden = false;
  window.clearTimeout(saleTimer);
  saleTimer = window.setTimeout(() => (saleEl.hidden = true), text.startsWith("While") ? 9000 : 4000);
});
showCoins();
document.getElementById("studio")!.addEventListener("click", () => openStudio(studioHooks));
document.getElementById("shop")!.addEventListener("click", () => openShop(studioHooks));

document.getElementById("reset")!.addEventListener("click", () => {
  look = { ...START, extras: [...START.extras] };
  changed();
});

// Snipped designs are put together once their pictures load: redraw the
// little pictures then (just once, however many load together).
let redrawSoon = 0;
onPicturesLoaded(() => {
  window.clearTimeout(redrawSoon);
  redrawSoon = window.setTimeout(render, 50);
});

render();
requestAnimationFrame(frame);
