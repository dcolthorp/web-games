// The animals that hatch out of eggs, the eggs themselves, and how to draw
// them all on a canvas.

export type G = CanvasRenderingContext2D;

export type Rarity = "Common" | "Uncommon" | "Rare" | "Ultra-Rare" | "Legendary" | "Heavenly" | "Unholy" | "Secret";

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: "#7d8597",
  Uncommon: "#3fae5a",
  Rare: "#3b82f6",
  "Ultra-Rare": "#a855f7",
  Legendary: "#f59e0b",
  Heavenly: "#e0a800",
  Unholy: "#c0262d",
  Secret: "#4f6bff",
};

type Ears = "floppy" | "pointy" | "long" | "round";
type Base = "dog" | "cat" | "bunny" | "hamster" | "pig" | "fox" | "panda" | "unicorn" | "dragon";

interface Species {
  name: string;
  rarity: Rarity;
  fur: string;
  dark: string; // ears, feet, patches
  belly: string;
  ears: Ears;
  tail: "wag" | "long" | "puff" | "bushy" | "curly" | "none" | "dragon";
  like?: Base; // heavenly pets are drawn like this animal...
  holy?: boolean; // ...with a halo, angel wings and a soft glow
  unholy?: boolean; // ...or little devil horns, bat wings, glowing eyes and a tiny fang
  moon?: boolean; // ...or a moonlight glow and a golden crescent moon on their forehead
}

export const SPECIES = {
  dog: { name: "Dog", rarity: "Common", fur: "#d39b5c", dark: "#9a6334", belly: "#f3d7b0", ears: "floppy", tail: "wag" },
  cat: { name: "Cat", rarity: "Common", fur: "#f4a259", dark: "#d27a2c", belly: "#fde2c2", ears: "pointy", tail: "long" },
  bunny: { name: "Bunny", rarity: "Common", fur: "#f5efe8", dark: "#e6d8ca", belly: "#ffffff", ears: "long", tail: "puff" },
  hamster: { name: "Hamster", rarity: "Common", fur: "#e9b87a", dark: "#c98f4c", belly: "#fff1dc", ears: "round", tail: "none" },
  pig: { name: "Pig", rarity: "Uncommon", fur: "#f8b8c6", dark: "#ef8fa6", belly: "#ffd6df", ears: "floppy", tail: "curly" },
  fox: { name: "Fox", rarity: "Uncommon", fur: "#f27a2a", dark: "#3a2a24", belly: "#fff6ec", ears: "pointy", tail: "bushy" },
  panda: { name: "Panda", rarity: "Rare", fur: "#ffffff", dark: "#2b2b33", belly: "#ffffff", ears: "round", tail: "none" },
  unicorn: { name: "Unicorn", rarity: "Ultra-Rare", fur: "#fffaff", dark: "#f1dcf5", belly: "#ffffff", ears: "pointy", tail: "long" },
  dragon: { name: "Dragon", rarity: "Legendary", fur: "#5cc46a", dark: "#2f8d43", belly: "#ffe28a", ears: "pointy", tail: "dragon" },
  // The heavenly pets, only from the hidden Holy Egg.
  angelPup: { name: "Angel Pup", rarity: "Heavenly", fur: "#fffaf0", dark: "#f0dca8", belly: "#ffffff", ears: "floppy", tail: "wag", like: "dog", holy: true },
  cloudKitty: { name: "Cloud Kitty", rarity: "Heavenly", fur: "#eef5ff", dark: "#c9dcff", belly: "#ffffff", ears: "pointy", tail: "long", like: "cat", holy: true },
  angelBunny: { name: "Angel Bunny", rarity: "Heavenly", fur: "#fff6fb", dark: "#f7dbe9", belly: "#ffffff", ears: "long", tail: "puff", like: "bunny", holy: true },
  pegacorn: { name: "Heaven Pegacorn", rarity: "Heavenly", fur: "#ffffff", dark: "#f6eecb", belly: "#fffdf2", ears: "pointy", tail: "long", like: "unicorn", holy: true },
  starDragon: { name: "Star Dragon", rarity: "Heavenly", fur: "#ffd95e", dark: "#d9a21b", belly: "#fff6cc", ears: "pointy", tail: "dragon", like: "dragon", holy: true },
  // The unholy pets, only from the hidden Unholy Egg. Spooky, but still cute.
  devilPup: { name: "Devil Pup", rarity: "Unholy", fur: "#d8443f", dark: "#8f2026", belly: "#f7b3a8", ears: "floppy", tail: "wag", like: "dog", unholy: true },
  shadowKitty: { name: "Shadow Kitty", rarity: "Unholy", fur: "#4a4160", dark: "#2a2438", belly: "#6c6286", ears: "pointy", tail: "long", like: "cat", unholy: true },
  batBunny: { name: "Bat Bunny", rarity: "Unholy", fur: "#6b5a84", dark: "#43375a", belly: "#9a8bb3", ears: "long", tail: "puff", like: "bunny", unholy: true },
  nightmareCorn: { name: "Nightmare Unicorn", rarity: "Unholy", fur: "#352c45", dark: "#231c30", belly: "#4d4263", ears: "pointy", tail: "long", like: "unicorn", unholy: true },
  // The secret pet from a wish on the moon (tap the moon 3 times while your pet sleeps).
  moonKitty: { name: "Moon Kitty", rarity: "Secret", fur: "#e3e9ff", dark: "#9fb0ff", belly: "#ffffff", ears: "pointy", tail: "long", like: "cat", moon: true },
  lavaDragon: { name: "Lava Dragon", rarity: "Unholy", fur: "#4a2f2f", dark: "#ff6a1a", belly: "#ff9a3c", ears: "pointy", tail: "dragon", like: "dragon", unholy: true },
} satisfies Record<string, Species>;

export type SpeciesId = keyof typeof SPECIES;

export interface Egg {
  id: string;
  name: string;
  price: number;
  shell: string;
  spots: string;
  /** What can hatch, and how likely each one is (the numbers add up to 100). */
  inside: [SpeciesId, number][];
  hidden?: boolean; // only in the shop once you've found it
}

export const EGGS: Egg[] = [
  { id: "cracked", name: "Cracked Egg", price: 50, shell: "#f4ead2", spots: "#d8c39a", inside: [["dog", 30], ["cat", 30], ["bunny", 20], ["hamster", 15], ["fox", 5]] },
  {
    id: "pet",
    name: "Pet Egg",
    price: 150,
    shell: "#bfe4ff",
    spots: "#7cc3f5",
    inside: [["dog", 15], ["cat", 15], ["bunny", 15], ["hamster", 10], ["fox", 15], ["pig", 15], ["panda", 10], ["unicorn", 4], ["dragon", 1]],
  },
  { id: "royal", name: "Royal Egg", price: 450, shell: "#ffe27a", spots: "#c99bff", inside: [["fox", 20], ["pig", 15], ["panda", 25], ["unicorn", 28], ["dragon", 12]] },
  {
    id: "holy",
    name: "Holy Egg",
    price: 777,
    shell: "#fffdf2",
    spots: "#ffe9a3",
    inside: [["angelPup", 30], ["cloudKitty", 28], ["angelBunny", 22], ["pegacorn", 14], ["starDragon", 6]],
    hidden: true,
  },
  {
    id: "unholy",
    name: "Unholy Egg",
    price: 999,
    shell: "#2e2240",
    spots: "#c0262d",
    inside: [["devilPup", 30], ["shadowKitty", 28], ["batBunny", 22], ["nightmareCorn", 14], ["lavaDragon", 6]],
    hidden: true,
  },
];

export function hatchFrom(egg: Egg): SpeciesId {
  let roll = Math.random() * 100;
  for (const [id, chance] of egg.inside) {
    roll -= chance;
    if (roll < 0) return id;
  }
  return egg.inside[0]![0];
}

const circle = (g: G, x: number, y: number, r: number, color: string): void => {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
};

const oval = (g: G, x: number, y: number, rx: number, ry: number, color: string, turn = 0): void => {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, turn, 0, Math.PI * 2);
  g.fill();
};

export interface PetPose {
  t: number; // time in ms, for blinking and wagging
  happy: boolean;
  asleep?: boolean;
  eating?: boolean;
  hop?: number; // how high off the ground (play)
}

/**
 * A pet sitting with (x, y) at its feet. At size 1 it's about 240 tall.
 */
export function drawPet(g: G, which: SpeciesId, x: number, y: number, size: number, pose: PetPose): void {
  const s: Species = SPECIES[which];
  const id: Base = s.like ?? (which as Base);
  const { t } = pose;
  g.save();
  g.translate(x, y);
  oval(g, 0, 4, 80 * size, 14 * size, "rgba(0, 0, 0, 0.12)");
  g.translate(0, -(pose.hop ?? 0));
  g.scale(size, size);
  const breathe = Math.sin(t / 500) * 2;
  g.lineCap = "round";
  g.lineJoin = "round";

  if (s.holy) {
    // A soft heavenly glow, and feathery angel wings.
    const glow = g.createRadialGradient(0, -110, 20, 0, -110, 190);
    glow.addColorStop(0, `rgba(255, 236, 150, ${0.55 + Math.sin(t / 400) * 0.15})`);
    glow.addColorStop(1, "rgba(255, 236, 150, 0)");
    g.fillStyle = glow;
    g.fillRect(-200, -310, 400, 400);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 36, -105);
      g.scale(side, 1);
      g.rotate(Math.sin(t / 350) * 0.1);
      // A fan of feathers, long at the top and shorter lower down.
      g.strokeStyle = "#f0d98a";
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = -1.25 + i * 0.28;
        const len = 62 - i * 7;
        g.save();
        g.rotate(a);
        g.fillStyle = i % 2 ? "#ffffff" : "#fffaf0";
        g.beginPath();
        g.ellipse(len, 0, len, 13, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.restore();
      }
      g.restore();
    }
  }

  if (s.moon) {
    // A soft blue moonlight glow.
    const glow = g.createRadialGradient(0, -110, 20, 0, -110, 190);
    glow.addColorStop(0, `rgba(140, 170, 255, ${0.5 + Math.sin(t / 500) * 0.15})`);
    glow.addColorStop(1, "rgba(140, 170, 255, 0)");
    g.fillStyle = glow;
    g.fillRect(-200, -310, 400, 400);
  }
  if (s.unholy) {
    // A spooky red-purple glow, and leathery bat wings.
    const glow = g.createRadialGradient(0, -110, 20, 0, -110, 190);
    glow.addColorStop(0, `rgba(200, 40, 70, ${0.4 + Math.sin(t / 400) * 0.12})`);
    glow.addColorStop(1, "rgba(120, 30, 120, 0)");
    g.fillStyle = glow;
    g.fillRect(-200, -310, 400, 400);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 36, -110);
      g.scale(side, 1);
      g.rotate(-0.2 + Math.sin(t / 300) * 0.12);
      g.fillStyle = "#3b2350";
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(40, -50);
      g.lineTo(95, -40);
      g.quadraticCurveTo(85, -18, 92, 6);
      g.quadraticCurveTo(72, -6, 62, 14);
      g.quadraticCurveTo(46, 0, 34, 20);
      g.quadraticCurveTo(20, 6, 0, 22);
      g.fill();
      g.strokeStyle = "#7a3f98";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(4, 4);
      g.lineTo(40, -50);
      g.moveTo(40, -50);
      g.lineTo(62, 14);
      g.moveTo(40, -50);
      g.lineTo(34, 20);
      g.stroke();
      g.restore();
    }
  }

  // Behind: tail and wings.
  const wag = Math.sin(t / (pose.happy ? 120 : 400)) * (pose.happy ? 0.5 : 0.15);
  g.save();
  g.translate(48, -40);
  g.rotate(wag);
  drawTail(g, s);
  g.restore();
  if (id === "dragon") {
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 40, -95);
      g.scale(side, 1);
      g.rotate(-0.3 + Math.sin(t / 300) * 0.15);
      g.fillStyle = s.holy ? "#fff3c4" : s.unholy ? "#a8321e" : "#8be39a";
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(50, -60, 85, -40);
      g.quadraticCurveTo(70, -15, 75, 5);
      g.quadraticCurveTo(50, -5, 45, 15);
      g.quadraticCurveTo(25, 0, 0, 20);
      g.fill();
      g.restore();
    }
  }

  // Body and feet.
  oval(g, 0, -62 - breathe / 2, 62, 58 + breathe / 2, s.fur);
  oval(g, 0, -55, 38, 40, s.belly);
  for (const side of [-1, 1]) oval(g, side * 34, -8, 24, 14, id === "panda" ? s.dark : s.dark === "#3a2a24" ? s.dark : darken(s.fur));
  if (id === "panda") for (const side of [-1, 1]) oval(g, side * 50, -70, 18, 30, s.dark, side * 0.3);

  // Head.
  const hy = -150 - breathe;
  // Floppy ears hang down in front of the head; the others stick up behind it.
  if (s.ears !== "floppy") drawEars(g, s, hy, t);
  circle(g, 0, hy, 66, s.fur);
  if (s.ears === "floppy") drawEars(g, s, hy, t);
  if (id === "fox") {
    g.fillStyle = s.belly;
    g.beginPath();
    g.moveTo(-58, hy + 4);
    g.quadraticCurveTo(0, hy + 90, 58, hy + 4);
    g.quadraticCurveTo(0, hy + 30, -58, hy + 4);
    g.fill();
  }
  if (id === "unicorn") {
    // A rainbow mane and a golden horn.
    const mane = ["#ff7eb6", "#ffb35c", "#ffe066", "#7be08c", "#6cb8ff", "#b88cff"];
    mane.forEach((c, i) => circle(g, -40 + i * 6, hy - 55 + i * 9, 20, c));
    g.fillStyle = "#ffd447";
    g.beginPath();
    g.moveTo(-12, hy - 58);
    g.lineTo(0, hy - 120);
    g.lineTo(12, hy - 58);
    g.fill();
    g.strokeStyle = "#e0a91a";
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(-9 + i * 2, hy - 70 - i * 15);
      g.lineTo(9 - i * 2, hy - 64 - i * 15);
      g.stroke();
    }
  }
  if (id === "dragon") {
    for (const side of [-1, 1]) {
      g.fillStyle = "#fff4c2";
      g.beginPath();
      g.moveTo(side * 22, hy - 58);
      g.lineTo(side * 36, hy - 98);
      g.lineTo(side * 42, hy - 52);
      g.fill();
    }
  }
  if (id === "panda") for (const side of [-1, 1]) oval(g, side * 24, hy + 2, 17, 22, s.dark, side * -0.5);

  if (s.unholy && id !== "dragon") {
    // Two little devil horns.
    for (const side of [-1, 1]) {
      g.fillStyle = "#e8323a";
      g.beginPath();
      g.moveTo(side * 16, hy - 60);
      g.quadraticCurveTo(side * 22, hy - 92, side * 36, hy - 98);
      g.quadraticCurveTo(side * 30, hy - 74, side * 36, hy - 56);
      g.fill();
    }
  }
  drawFace(g, id, hy, pose, s);
  if (s.moon) {
    // A golden crescent moon on their forehead.
    g.fillStyle = "#ffd447";
    g.beginPath();
    g.arc(0, hy - 34, 14, 0, Math.PI * 2);
    g.fill();
    circle(g, 7, hy - 38, 12, s.fur);
  }
  if (s.holy) {
    // A golden halo floating over their head.
    g.strokeStyle = "#ffd447";
    g.lineWidth = 9;
    g.shadowColor = "#fff2a8";
    g.shadowBlur = 16;
    g.beginPath();
    g.ellipse(0, hy - 92 + Math.sin(t / 300) * 4, 46, 13, 0, 0, Math.PI * 2);
    g.stroke();
    g.shadowBlur = 0;
  }
  g.restore();
}

function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.8;
  const r = Math.round(((n >> 16) & 255) * k);
  const gr = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r}, ${gr}, ${b})`;
}

function drawEars(g: G, s: Species, hy: number, t: number): void {
  const twitch = Math.sin(t / 900) > 0.97 ? 0.12 : 0;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * 42, hy - 40);
    g.scale(side, 1);
    if (s.ears === "pointy") {
      g.rotate(0.15 + twitch);
      g.fillStyle = s.fur;
      g.beginPath();
      g.moveTo(-26, 20);
      g.lineTo(6, -50);
      g.lineTo(30, 14);
      g.fill();
      g.fillStyle = s.name === "Fox" ? s.dark : "#ffc2d6";
      g.beginPath();
      g.moveTo(-12, 12);
      g.lineTo(6, -30);
      g.lineTo(18, 10);
      g.fill();
    } else if (s.ears === "long") {
      g.rotate(0.12 + twitch);
      oval(g, 4, -50, 18, 58, s.fur);
      oval(g, 4, -46, 9, 42, "#ffc2d6");
    } else if (s.ears === "round") {
      circle(g, 2, 0, 24, s.dark);
      circle(g, 2, 2, 13, s.name === "Panda" ? "#55555f" : "#ffc2d6");
    } else {
      g.translate(22, 4);
      g.rotate(-0.2 - twitch);
      oval(g, 0, 30, 20, 44, s.dark);
    }
    g.restore();
  }
}

function drawTail(g: G, s: Species): void {
  g.fillStyle = s.fur;
  g.strokeStyle = s.fur;
  if (s.tail === "wag") {
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(30, -10, 36, -46);
    g.stroke();
  } else if (s.tail === "long") {
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(50, 10, 40, -60, 70, -70);
    g.stroke();
    if (s.name === "Unicorn") {
      ["#ff7eb6", "#ffe066", "#6cb8ff"].forEach((c, i) => circle(g, 66 + i * 4, -72 + i * 10, 12, c));
    }
  } else if (s.tail === "puff") {
    circle(g, 12, 10, 20, "#ffffff");
  } else if (s.tail === "bushy") {
    oval(g, 34, -30, 26, 50, s.fur, 0.6);
    oval(g, 52, -66, 14, 18, "#ffffff", 0.6);
  } else if (s.tail === "curly") {
    g.strokeStyle = s.dark;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(16, -6, 10, Math.PI, Math.PI * 3.2);
    g.stroke();
  } else if (s.tail === "dragon") {
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(0, 20);
    g.quadraticCurveTo(70, 30, 80, -20);
    g.stroke();
    g.fillStyle = s.dark;
    g.beginPath();
    g.moveTo(70, -20);
    g.lineTo(84, -48);
    g.lineTo(96, -16);
    g.fill();
  }
}

function drawFace(g: G, id: Base, hy: number, pose: PetPose, who: Species): void {
  const s: Species = SPECIES[id];
  const spooky = !!who.unholy;
  const line = spooky ? "#ffd6e0" : "#3a2a33"; // light lines show up on dark fur
  const blink = pose.asleep || pose.t % 4200 < 140;
  for (const side of [-1, 1]) {
    const ex = side * 24;
    const ey = hy + 2;
    if (blink) {
      g.strokeStyle = spooky ? line : "#2b2233";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(ex, ey, 9, 0.2, Math.PI - 0.2);
      g.stroke();
    } else {
      // Unholy pets have glowing red eyes.
      circle(g, ex, ey, 11, spooky ? "#ff3b5c" : id === "dragon" ? "#2b5a2f" : "#2b2233");
      circle(g, ex + 4, ey - 4, 4, "#ffffff");
    }
    circle(g, side * 42, hy + 24, 10, "rgba(255, 120, 150, 0.35)");
  }
  // Nose and snout.
  if (id === "pig") {
    oval(g, 0, hy + 26, 20, 14, s.dark);
    circle(g, -7, hy + 26, 3.5, "#c5607a");
    circle(g, 7, hy + 26, 3.5, "#c5607a");
  } else if (id === "dragon") {
    circle(g, -7, hy + 22, 3, "#2f8d43");
    circle(g, 7, hy + 22, 3, "#2f8d43");
  } else {
    oval(g, 0, hy + 20, 8, 6, id === "bunny" || id === "hamster" || id === "unicorn" ? "#ff8fb1" : "#3a2a33");
  }
  // Mouth: a smile when happy, a little frown when not.
  g.strokeStyle = line;
  g.lineWidth = 3.5;
  g.beginPath();
  const my = hy + (id === "pig" ? 44 : 32);
  if (pose.eating) {
    oval(g, 0, my + 2, 9, 7 + Math.abs(Math.sin(pose.t / 90)) * 4, "#7a3b4a");
  } else if (pose.happy || pose.asleep) {
    g.moveTo(-12, my);
    g.quadraticCurveTo(-6, my + 8, 0, my);
    g.quadraticCurveTo(6, my + 8, 12, my);
    g.stroke();
    if (spooky) {
      // One tiny fang.
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(3, my + 3);
      g.lineTo(9, my + 3);
      g.lineTo(6, my + 11);
      g.fill();
    }
  } else {
    g.moveTo(-10, my + 6);
    g.quadraticCurveTo(0, my - 2, 10, my + 6);
    g.stroke();
  }
  if (id === "cat") {
    g.strokeStyle = spooky ? "rgba(255, 214, 224, 0.6)" : "rgba(58, 42, 51, 0.6)";
    g.lineWidth = 2;
    for (const side of [-1, 1]) {
      for (const dy of [-4, 4]) {
        g.beginPath();
        g.moveTo(side * 18, hy + 22 + dy);
        g.lineTo(side * 52, hy + 18 + dy * 2);
        g.stroke();
      }
    }
  }
}

/** An egg standing with (x, y) at its bottom. `cracks` goes from 0 (none) to 1 (about to pop). */
export function drawEgg(g: G, egg: Egg, x: number, y: number, size: number, wobble: number, cracks = 0): void {
  g.save();
  g.translate(x, y);
  if (egg.id === "holy") {
    const glow = g.createRadialGradient(0, -90 * size, 10, 0, -90 * size, 150 * size);
    glow.addColorStop(0, "rgba(255, 230, 140, 0.8)");
    glow.addColorStop(1, "rgba(255, 230, 140, 0)");
    g.fillStyle = glow;
    g.fillRect(-160 * size, -250 * size, 320 * size, 320 * size);
  }
  if (egg.id === "unholy") {
    const glow = g.createRadialGradient(0, -90 * size, 10, 0, -90 * size, 150 * size);
    glow.addColorStop(0, "rgba(200, 40, 80, 0.6)");
    glow.addColorStop(1, "rgba(120, 30, 120, 0)");
    g.fillStyle = glow;
    g.fillRect(-160 * size, -250 * size, 320 * size, 320 * size);
  }
  oval(g, 0, 2, 60 * size, 10 * size, "rgba(0, 0, 0, 0.12)");
  g.rotate(wobble);
  g.scale(size, size);
  const shape = new Path2D();
  shape.moveTo(0, -170);
  shape.bezierCurveTo(70, -170, 82, -40, 70, -20);
  shape.bezierCurveTo(56, 4, -56, 4, -70, -20);
  shape.bezierCurveTo(-82, -40, -70, -170, 0, -170);
  g.fillStyle = egg.shell;
  g.fill(shape);
  g.save();
  g.clip(shape);
  for (const [sx, sy, r] of [[-30, -120, 14], [24, -90, 18], [-20, -50, 12], [36, -140, 9], [10, -30, 10], [-44, -86, 8]] as const) {
    circle(g, sx, sy, r, egg.spots);
  }
  oval(g, -28, -130, 10, 22, "rgba(255, 255, 255, 0.5)", -0.3);
  g.restore();
  if (cracks > 0) {
    g.strokeStyle = "#5a4630";
    g.lineWidth = 3;
    g.beginPath();
    const steps = Math.ceil(cracks * 8);
    g.moveTo(-66, -80);
    for (let i = 1; i <= steps; i++) g.lineTo(-66 + i * 16.5, -80 + (i % 2 ? -14 : 8));
    g.stroke();
    if (cracks > 0.5) {
      g.beginPath();
      g.moveTo(20, -120);
      g.lineTo(32, -104);
      g.lineTo(22, -92);
      g.lineTo(38, -78);
      g.stroke();
    }
  }
  if (egg.id === "holy") {
    g.strokeStyle = "#ffd447";
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(0, -192, 44, 12, 0, 0, Math.PI * 2);
    g.stroke();
  }
  if (egg.id === "unholy") {
    // Little devil horns on top.
    for (const side of [-1, 1]) {
      g.fillStyle = "#e8323a";
      g.beginPath();
      g.moveTo(side * 14, -160);
      g.quadraticCurveTo(side * 20, -196, side * 38, -204);
      g.quadraticCurveTo(side * 30, -176, side * 40, -150);
      g.fill();
    }
  }
  g.restore();
}
