// The Dressing Room's stock, and the wallet that remembers what you bought.
// The Python game kept this in a profile.json; here it's localStorage.

export type ItemType = "shape" | "color" | "outfit" | "theme";

export interface CatalogItem {
  id: string;
  name: string;
  type: ItemType;
  price: number;
  color?: string;
  laneColors?: Record<number, string>;
}

export const CATALOG: CatalogItem[] = [
  { id: "shape:rectangle", name: "Rectangle", type: "shape", price: 0 },
  { id: "shape:circle", name: "Circle", type: "shape", price: 1000 },
  { id: "shape:triangle", name: "Triangle", type: "shape", price: 1000 },

  { id: "color:default", name: "Aurora White", type: "color", price: 0, color: "#ffffff" },
  { id: "color:neon_cyan", name: "Neon Cyan", type: "color", price: 100, color: "#40ffeb" },
  { id: "color:solar_orange", name: "Solar Orange", type: "color", price: 150, color: "#ff963a" },
  { id: "color:hyper_magenta", name: "Hyper Magenta", type: "color", price: 200, color: "#ff46be" },
  { id: "color:lime_pulse", name: "Lime Pulse", type: "color", price: 250, color: "#82ff60" },
  { id: "color:royal_violet", name: "Royal Violet", type: "color", price: 300, color: "#7c60ff" },
  { id: "color:gold", name: "Gold", type: "color", price: 500, color: "#ffd700" },

  { id: "outfit:spider", name: "Spider", type: "outfit", price: 2500 },
  { id: "outfit:ghost", name: "Ghost", type: "outfit", price: 3000 },
  { id: "outfit:turkey", name: "Turkey", type: "outfit", price: 3500 },
  { id: "outfit:christmas_tree", name: "Christmas Tree", type: "outfit", price: 4000 },
  { id: "outfit:gingerbread_man", name: "Gingerbread Man", type: "outfit", price: 4500 },

  { id: "theme:default", name: "Classic", type: "theme", price: 0 },
  {
    id: "theme:halloween",
    name: "Halloween",
    type: "theme",
    price: 2000,
    laneColors: { 0: "#ff8c00", 1: "#800080", 2: "#141414" },
  },
];

export const itemsOfType = (type: ItemType): CatalogItem[] =>
  CATALOG.filter((item) => item.type === type);

export const findItem = (id: string): CatalogItem | undefined =>
  CATALOG.find((item) => item.id === id);

export interface Profile {
  balance: number;
  inventory: string[];
  shape: string;
  color: string;
  outfit: string | null;
  theme: string;
  highScoreRunner: number;
  highScoreLostLevels: number;
}

const STORAGE_KEY = "ground-jumper-profile";

export function defaultProfile(): Profile {
  return {
    balance: 0,
    inventory: ["shape:rectangle", "color:default", "theme:default"],
    shape: "rectangle",
    color: "color:default",
    outfit: null,
    theme: "theme:default",
    highScoreRunner: 0,
    highScoreLostLevels: 0,
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Not being able to save shouldn't spoil the game.
  }
}

export const owns = (profile: Profile, id: string): boolean => profile.inventory.includes(id);

export function buy(profile: Profile, item: CatalogItem): boolean {
  if (owns(profile, item.id)) return false;
  if (profile.balance < item.price) return false;
  profile.balance -= item.price;
  profile.inventory.push(item.id);
  return true;
}

export function equip(profile: Profile, item: CatalogItem): void {
  if (item.type === "shape") {
    profile.shape = item.id.split(":")[1] ?? "rectangle";
    profile.outfit = null;
  } else if (item.type === "color") {
    profile.color = item.id;
    profile.outfit = null;
  } else if (item.type === "outfit") {
    profile.outfit = item.id;
  } else {
    profile.theme = item.id;
  }
}

export interface Outfit {
  shape: string;
  color: string;
  outfit: string | null;
}

export function outfitOf(profile: Profile): Outfit {
  if (profile.outfit) return { shape: "", color: "#ffffff", outfit: profile.outfit };
  const color = findItem(profile.color)?.color ?? "#ffffff";
  return { shape: profile.shape, color, outfit: null };
}

export function laneColorsOf(profile: Profile): Record<number, string> | null {
  return findItem(profile.theme)?.laneColors ?? null;
}
