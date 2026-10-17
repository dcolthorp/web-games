// Everything about the city that has to be remembered: your money, your
// job, how many floors your dollhouse has, the potions you've found and
// whether the portal is on (and which dimensions it can take you to). It's
// saved every time something changes (and again when you leave the page),
// so nothing is lost when you come back.

export interface CityState {
  money: number;
  job: number; // 0 = Box Taper ... 4 = Box Billionaire
  floors: number; // the dollhouse starts with 2 and can grow to 6
  portal: boolean;
  potions: string[];
  dimensions: string[]; // the ones you've unlocked through the portal
  // The Doomsday Device story: pressing its red button sends a meteor at the
  // Dino Dimension ("coming"); rescue the dinos and they live with you ("saved").
  meteor: "none" | "coming" | "saved";
  // Which job board job you picked after becoming Box Billionaire.
  career: "box" | "engineer";
  // The invention games (arcade.ts): best scores, how grown-up your robot
  // dog is, and the Sky Key from the top of the Jetpack Climb.
  best: { bubbles: number; hover: number; jet: number };
  dog: { stage: number; food: number };
  skyKey: boolean;
  voidKey: boolean; // hidden behind a cloud in the Insanity Dimension (city.ts)
  // A 1-in-100 find at the Engineering Station's dump. It unlocks the tiny
  // keyhole in the box room's window (main.ts), which leads outside (walk.ts).
  purpleKey: boolean;
  // The bank heist outside (walk.ts): grab the C4 from the sky platform,
  // open the TOP SECRET door with the Sky Key, blow up the safe, and take
  // the diamond inside.
  heist: { c4: boolean; vault: boolean; safe: boolean; diamond: boolean };
  // After the heist (walk.ts): sell the diamond for gold bars, the bank keeper
  // runs off with them, a robber shows up at home, he blasts off, you sell
  // his stuff, and an Amazon package arrives with a note: find the Void Key.
  story: "start" | "bars" | "robber" | "paid" | "blasted" | "package" | "void";
}

const KEY = "things-i-love-city";
export const MIN_FLOORS = 2;
export const MAX_FLOORS = 6;

const num = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0);

function load(): CityState {
  const fresh: CityState = { money: 0, job: 0, floors: MIN_FLOORS, portal: false, potions: [], dimensions: [], meteor: "none", career: "box",
    best: { bubbles: 0, hover: 0, jet: 0 }, dog: { stage: 0, food: 0 }, skyKey: false, voidKey: false, purpleKey: false,
    heist: { c4: false, vault: false, safe: false, diamond: false }, story: "start" };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (saved && typeof saved === "object") {
      return {
        money: Number.isFinite(saved.money) ? Math.max(0, saved.money) : 0,
        job: Number.isInteger(saved.job) ? Math.max(0, Math.min(4, saved.job)) : 0,
        floors: Number.isInteger(saved.floors) ? Math.max(MIN_FLOORS, Math.min(MAX_FLOORS, saved.floors)) : MIN_FLOORS,
        portal: saved.portal === true,
        potions: Array.isArray(saved.potions) ? saved.potions.filter((p: unknown) => typeof p === "string") : [],
        dimensions: Array.isArray(saved.dimensions) ? saved.dimensions.filter((d: unknown) => typeof d === "string") : [],
        meteor: saved.meteor === "coming" || saved.meteor === "saved" ? saved.meteor : "none",
        career: saved.career === "engineer" ? "engineer" : "box",
        best: {
          bubbles: num(saved.best?.bubbles),
          hover: num(saved.best?.hover),
          jet: num(saved.best?.jet),
        },
        dog: { stage: Math.min(5, num(saved.dog?.stage)), food: num(saved.dog?.food) },
        skyKey: saved.skyKey === true,
        purpleKey: saved.purpleKey === true,
        voidKey: saved.voidKey === true,
        heist: { c4: saved.heist?.c4 === true, vault: saved.heist?.vault === true, safe: saved.heist?.safe === true,
          diamond: saved.heist?.diamond === true },
        story: ["bars", "robber", "paid", "blasted", "package", "void"].includes(saved.story) ? saved.story : "start",
      };
    }
  } catch {
    // A broken save starts fresh.
  }
  return fresh;
}

export const state: CityState = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Nothing else to do if storage is full or blocked.
  }
}

window.addEventListener("pagehide", save);

export const formatMoney = (n: number): string => `$${Math.floor(n).toLocaleString("en-US")}`;
