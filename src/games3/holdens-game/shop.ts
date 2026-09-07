export interface Skin {
  id: string;
  name: string;
  blurb: string;
  price: number;
  colour: string;
  speed: number;      // multiplier on how fast you move
  fogBonus: number;   // extra tiles you can see in a fogged world
  iceGrip: boolean;   // ice stops being slippery
  windProof: boolean; // wind stops pushing you
  waterProof: boolean;// water stops slowing you
  shield: number;     // free hits, refilled at every flag
  phase: boolean;     // walk through walls
  secret?: boolean;   // hidden in the shop until it is earned
}

// The plain one is owned from the start and costs nothing.
export const skins: Skin[] = [
  { id: "plain", name: "Plain", blurb: "What you have always worn.", price: 0, colour: "#f0efe6", speed: 1, fogBonus: 0, iceGrip: false, windProof: false, waterProof: false, shield: 0, phase: false },
  { id: "runner", name: "Runner", blurb: "A third faster on your feet.", price: 40, colour: "#ffd54a", speed: 1.33, fogBonus: 0, iceGrip: false, windProof: false, waterProof: false, shield: 0, phase: false },
  { id: "lantern", name: "Lantern", blurb: "See four tiles further in the dark.", price: 55, colour: "#ffb347", speed: 1, fogBonus: 4, iceGrip: false, windProof: false, waterProof: false, shield: 0, phase: false },
  { id: "boots", name: "Snow Boots", blurb: "Ice cannot slide you, wind cannot push you.", price: 60, colour: "#9fd8ff", speed: 1, fogBonus: 0, iceGrip: true, windProof: true, waterProof: false, shield: 0, phase: false },
  { id: "diver", name: "Diver", blurb: "Water no longer slows you down.", price: 50, colour: "#5ce0d6", speed: 1, fogBonus: 0, iceGrip: false, windProof: false, waterProof: true, shield: 0, phase: false },
  { id: "armour", name: "Iron Shell", blurb: "Take one hit for free. Refills at every flag.", price: 80, colour: "#c0c6cc", speed: 0.92, fogBonus: 0, iceGrip: false, windProof: false, waterProof: false, shield: 1, phase: false },
  { id: "champion", name: "Champion", blurb: "Faster, tougher, and sees further. Everything at once.", price: 200, colour: "#ff7bd5", speed: 1.2, fogBonus: 3, iceGrip: true, windProof: true, waterProof: true, shield: 1, phase: false },
  { id: "glitch", name: "Glitch", blurb: "Whatever is in the letters. Walks through walls.", price: 0, colour: "#63ff9f", speed: 1.15, fogBonus: 6, iceGrip: true, windProof: true, waterProof: true, shield: 1, phase: true, secret: true },
];

const GLITCH_KEY = "holdens-game-glitch-v1";

export function glitchUnlocked(): boolean {
  return localStorage.getItem(GLITCH_KEY) === "yes";
}

export function unlockGlitch(): void {
  localStorage.setItem(GLITCH_KEY, "yes");
  if (!owned().includes("glitch")) {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...owned(), "glitch"]));
  }
}

const COINS_KEY = "holdens-game-coins-v1";
const OWNED_KEY = "holdens-game-skins-v1";
const WORN_KEY = "holdens-game-worn-v1";

export function coins(): number {
  const raw = Number(localStorage.getItem(COINS_KEY) ?? "0");
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

export function addCoins(amount: number): number {
  const total = coins() + Math.max(0, Math.floor(amount));
  localStorage.setItem(COINS_KEY, String(total));
  return total;
}

export function owned(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OWNED_KEY) ?? "[]") as unknown;
    const list = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
    return list.includes("plain") ? list : ["plain", ...list];
  } catch {
    return ["plain"];
  }
}

export function buy(id: string): { ok: boolean; reason?: string } {
  const skin = skins.find((entry) => entry.id === id);
  if (!skin) return { ok: false, reason: "No such skin." };
  if (owned().includes(id)) return { ok: false, reason: "Already yours." };
  if (coins() < skin.price) return { ok: false, reason: `Need ${skin.price - coins()} more coins.` };
  localStorage.setItem(COINS_KEY, String(coins() - skin.price));
  localStorage.setItem(OWNED_KEY, JSON.stringify([...owned(), id]));
  return { ok: true };
}

export function wear(id: string): boolean {
  if (!owned().includes(id)) return false;
  localStorage.setItem(WORN_KEY, id);
  return true;
}

export function wornSkin(): Skin {
  const id = localStorage.getItem(WORN_KEY) ?? "plain";
  const skin = skins.find((entry) => entry.id === id && owned().includes(entry.id));
  return skin ?? skins[0]!;
}
