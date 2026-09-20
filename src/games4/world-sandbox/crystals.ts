// Every crystal we could get our hands on, and then a machine for finding more
// forever. Each one is a name and the colours its pixels get speckled with.
//
// IMPORTANT: only ever add to the END of CRYSTALS. Each one's save code comes
// from its place in this list, and caves you already dug remember those codes.

export interface CrystalSpec {
  name: string;
  colors: string[];
}

export const CRYSTALS: CrystalSpec[] = [
  { name: "Quartz", colors: ["#f2efe9", "#d8d2c6"] },
  { name: "Rose Quartz", colors: ["#f7c6cf", "#e79aa9"] },
  { name: "Smoky Quartz", colors: ["#6b5b52", "#4a3f39"] },
  { name: "Milky Quartz", colors: ["#f7f4ee", "#ded8cc"] },
  { name: "Citrine", colors: ["#f7c33e", "#e09b23"] },
  { name: "Ruby", colors: ["#d8203f", "#a0132c"] },
  { name: "Sapphire", colors: ["#1f4fd8", "#123a9e"] },
  { name: "Topaz", colors: ["#f5b942", "#ffd98a"] },
  { name: "Opal", colors: ["#e9f6f2", "#b8e0ff", "#ffd5e8", "#d8ffcf"] },
  { name: "Fire Opal", colors: ["#f26b2a", "#d84a1f", "#f7d23e"] },
  { name: "Black Opal", colors: ["#1b1b2a", "#3f5bd8", "#3f9a5b"] },
  { name: "Jade", colors: ["#4fae7a", "#2f7d55"] },
  { name: "Turquoise", colors: ["#3fd0c9", "#2aa39d"] },
  { name: "Lapis Lazuli", colors: ["#2a44a8", "#1b2f7d", "#d8c15a"] },
  { name: "Malachite", colors: ["#1f9e63", "#0f6b42", "#7fd8a8"] },
  { name: "Azurite", colors: ["#2a5bd8", "#173a9e"] },
  { name: "Obsidian", colors: ["#14121a", "#241f2e"] },
  { name: "Garnet", colors: ["#8f1f2e", "#c9364a"] },
  { name: "Peridot", colors: ["#9fd83b", "#7bb32a"] },
  { name: "Aquamarine", colors: ["#7fe5e0", "#4fc0c9"] },
  { name: "Moonstone", colors: ["#eef2ff", "#cfd8f2"] },
  { name: "Sunstone", colors: ["#f2a04f", "#d8763a"] },
  { name: "Bloodstone", colors: ["#2f6b4a", "#8f1f2e"] },
  { name: "Tiger's Eye", colors: ["#c98f2a", "#6b4a1f", "#f2c35a"] },
  { name: "Onyx", colors: ["#17161c", "#3a3844"] },
  { name: "Jasper", colors: ["#b4542a", "#8f3a1f"] },
  { name: "Agate", colors: ["#d8b78f", "#a8794f", "#f2e2cf"] },
  { name: "Carnelian", colors: ["#d8622a", "#a8401f"] },
  { name: "Amber", colors: ["#f2a72a", "#d87f1f"] },
  { name: "Pearl", colors: ["#f7f2ea", "#e2d8ca"] },
  { name: "Pyrite", colors: ["#e0c23a", "#b08f23"] },
  { name: "Copper", colors: ["#c9702a", "#e09a4f"] },
  { name: "Silver", colors: ["#e2e6ea", "#b4bcc4"] },
  { name: "Platinum", colors: ["#d8dde2", "#a8b0b8"] },
  { name: "Galena", colors: ["#8f96a0", "#5d636b"] },
  { name: "Magnetite", colors: ["#2a2a30", "#4a4a52"] },
  { name: "Hematite", colors: ["#7d3a35", "#a85a4f"] },
  { name: "Bauxite", colors: ["#c98f6b", "#a8704f"] },
  { name: "Cinnabar", colors: ["#d82a2a", "#a81f1f"] },
  { name: "Sulfur", colors: ["#f2e03a", "#d8c223"] },
  { name: "Halite", colors: ["#f2f2ea", "#e2e2d8"] },
  { name: "Fluorite", colors: ["#7fd8c9", "#9b59d9", "#3f9a3a"] },
  { name: "Apatite", colors: ["#3fc9d8", "#2a9ba8"] },
  { name: "Beryl", colors: ["#9fd8c9", "#7bb3a8"] },
  { name: "Aventurine", colors: ["#4fae7a", "#7fd8a8"] },
  { name: "Chrysocolla", colors: ["#3fc9b3", "#2a9b8f"] },
  { name: "Labradorite", colors: ["#4a5b7d", "#7fa8d8", "#c9d8f2"] },
  { name: "Amazonite", colors: ["#6bd8c0", "#4fb3a0"] },
  { name: "Kyanite", colors: ["#3f6bd8", "#2a4fa8"] },
  { name: "Sodalite", colors: ["#2a3fa8", "#1f2f7d"] },
  { name: "Rhodonite", colors: ["#d86b8f", "#a84f6b"] },
  { name: "Rhodochrosite", colors: ["#f28fa8", "#d86b8f"] },
  { name: "Charoite", colors: ["#9b59d9", "#7d3fb3"] },
  { name: "Sugilite", colors: ["#8f3fd9", "#6b2aa8"] },
  { name: "Larimar", colors: ["#7fc9e5", "#4fa8c9"] },
  { name: "Prehnite", colors: ["#c9d83f", "#a8b32a"] },
  { name: "Zircon", colors: ["#d8a8c9", "#b38fa8"] },
  { name: "Spinel", colors: ["#d82a5b", "#a81f44"] },
  { name: "Tanzanite", colors: ["#5b3fd9", "#3f2aa8"] },
  { name: "Tourmaline", colors: ["#3f9a5b", "#d82a6b", "#2a3fa8"] },
  { name: "Watermelon Tourmaline", colors: ["#d82a6b", "#3f9a3a", "#f2e2cf"] },
  { name: "Alexandrite", colors: ["#3f9a7a", "#8f3fd9"] },
  { name: "Iolite", colors: ["#4f5bd8", "#3a44a8"] },
  { name: "Chalcedony", colors: ["#d8d2e5", "#b8b0c9"] },
  { name: "Chrysoprase", colors: ["#6bd83f", "#4fb32a"] },
  { name: "Serpentine", colors: ["#5b8f4f", "#3f6b35"] },
  { name: "Selenite", colors: ["#f2f0ea", "#dcd8cf"] },
  { name: "Gypsum", colors: ["#eae4d8", "#cfc6b0"] },
  { name: "Barite", colors: ["#e2dccf", "#c4bba8"] },
  { name: "Celestite", colors: ["#a8c9e5", "#7fa8c9"] },
  { name: "Aragonite", colors: ["#e5d8b8", "#c9b88f"] },
  { name: "Dolomite", colors: ["#e5ddcf", "#c4b9a5"] },
  { name: "Marble", colors: ["#f2eee8", "#d8d2c6"] },
  { name: "Granite", colors: ["#b0a8a0", "#7d746c", "#e2d8cf"] },
  { name: "Basalt", colors: ["#3a3a42", "#55555f"] },
  { name: "Pumice", colors: ["#b8b0a8", "#948c84"] },
  { name: "Flint", colors: ["#4a4a52", "#6b6b73"] },
  { name: "Chert", colors: ["#8f8578", "#6b6355"] },
  { name: "Slate", colors: ["#4f5b63", "#3a444a"] },
  { name: "Schist", colors: ["#6b6b7d", "#4f4f5d"] },
  { name: "Gneiss", colors: ["#a8a0a8", "#7d757d"] },
  { name: "Sandstone", colors: ["#d8b88f", "#b8946b"] },
  { name: "Limestone", colors: ["#ded8c9", "#bdb5a3"] },
  { name: "Chalk", colors: ["#f2f0e8", "#ddd8cc"] },
  { name: "Mica", colors: ["#d8cf9a", "#b8ad73"] },
  { name: "Feldspar", colors: ["#e5d8c9", "#c9b8a5"] },
  { name: "Olivine", colors: ["#8fb33a", "#6b8f2a"] },
  { name: "Augite", colors: ["#3a4a3a", "#55665a"] },
  { name: "Hornblende", colors: ["#2f3a35", "#4a554f"] },
  { name: "Talc", colors: ["#e5e5dd", "#c9c9bf"] },
  { name: "Graphite", colors: ["#3a3a3f", "#55555c"] },
  { name: "Anthracite", colors: ["#1b1b22", "#2f2f38"] },
  { name: "Uraninite", colors: ["#2a3a2a", "#455a45"] },
  { name: "Vanadinite", colors: ["#d8622a", "#a8401f"] },
  { name: "Wulfenite", colors: ["#f2a03a", "#d87f23"] },
  { name: "Crocoite", colors: ["#f2703a", "#d8501f"] },
  { name: "Erythrite", colors: ["#d83f8f", "#a82a6b"] },
  { name: "Torbernite", colors: ["#3fd83f", "#2aa82a"] },
  { name: "Autunite", colors: ["#d8f23a", "#b3c923"] },
  { name: "Dioptase", colors: ["#2ad88f", "#1fa86b"] },
  { name: "Cavansite", colors: ["#2a5bd8", "#1f44a8"] },
  { name: "Vivianite", colors: ["#3f5bd8", "#2a3fa8"] },
  { name: "Scheelite", colors: ["#f2e5b8", "#d8c98f"] },
  { name: "Cassiterite", colors: ["#5d4a3a", "#7d6551"] },
  { name: "Molybdenite", colors: ["#a8b0b8", "#7d858f"] },
  { name: "Sphalerite", colors: ["#6b4a2a", "#8f6b3f"] },
  { name: "Chalcopyrite", colors: ["#d8b33a", "#8f5bd9", "#3f9ad8"] },
  { name: "Bornite", colors: ["#8f5bd9", "#3f9ad8", "#d8622a"] },
  { name: "Stibnite", colors: ["#9aa0a8", "#6b717d"] },
  { name: "Realgar", colors: ["#d8502a", "#a83a1f"] },
  { name: "Orpiment", colors: ["#f2c23a", "#d89e23"] },
  { name: "Proustite", colors: ["#c9203f", "#8f1429"] },
  { name: "Arsenopyrite", colors: ["#b8bcc4", "#8f939b"] },
  { name: "Skutterudite", colors: ["#a8adb5", "#7d828a"] },
  { name: "Nickeline", colors: ["#d8977f", "#b3705b"] },
  { name: "Millerite", colors: ["#d8c98f", "#b3a56b"] },
  { name: "Pentlandite", colors: ["#c9b88f", "#a8946b"] },
  { name: "Pyrrhotite", colors: ["#b8946b", "#8f7050"] },
  { name: "Ilmenite", colors: ["#2f2f35", "#4a4a52"] },
  { name: "Rutile", colors: ["#8f2a2a", "#c94a3a"] },
  { name: "Anatase", colors: ["#2a5b8f", "#1f446b"] },
  { name: "Brookite", colors: ["#6b4a2a", "#8f6b3f"] },
  { name: "Perovskite", colors: ["#3a3a44", "#55555f"] },
  { name: "Kunzite", colors: ["#f2b8cf", "#d894b0"] },
  { name: "Hiddenite", colors: ["#8fd88f", "#6bb36b"] },
  { name: "Morganite", colors: ["#f2c9b8", "#d8a894"] },
  { name: "Heliodor", colors: ["#f2e08f", "#d8c46b"] },
  { name: "Goshenite", colors: ["#eef2f2", "#d2d8d8"] },
  { name: "Bixbite", colors: ["#d83f4f", "#a82a3a"] },
  { name: "Phenakite", colors: ["#eef0f2", "#d0d4d8"] },
  { name: "Euclase", colors: ["#a8d8e5", "#7fb3c9"] },
  { name: "Danburite", colors: ["#f2f0e8", "#d8d4c9"] },
  { name: "Sphene", colors: ["#d8c93a", "#b3a523"] },
  { name: "Zoisite", colors: ["#3f9a5b", "#d82a6b"] },
  { name: "Epidote", colors: ["#8fb33a", "#5d7d23"] },
  { name: "Andalusite", colors: ["#a86b4f", "#7d4a35"] },
  { name: "Staurolite", colors: ["#6b4a35", "#8f6b50"] },
  { name: "Dumortierite", colors: ["#2a44a8", "#1f2f7d"] },
  { name: "Lepidolite", colors: ["#c9a8d8", "#a88fb3"] },
  { name: "Muscovite", colors: ["#e5ddc9", "#c9bfa5"] },
  { name: "Biotite", colors: ["#3a2f2a", "#55453a"] },
  { name: "Orthoclase", colors: ["#f2c9a8", "#d8a884"] },
  { name: "Albite", colors: ["#f2f0ea", "#d8d4cc"] },
  { name: "Ice", colors: ["#d8f0ff", "#a8d8f2", "#f2fbff"] },
  { name: "Meteorite", colors: ["#3a3038", "#5d4f58", "#8f7f6b"] },
  { name: "Moldavite", colors: ["#4f7d2a", "#6b9e3f"] },
  { name: "Peacock Ore", colors: ["#3f9ad8", "#8f5bd9", "#d8622a", "#3fd88f"] },
];

// Codes for saving. Built-in crystals take them from the front of this pool,
// crystals nobody has ever seen before take them from the back, so the two
// never argue over the same letter.
function poolFrom(ranges: [number, number][]): string[] {
  const chars: string[] = [];
  for (const [from, to] of ranges) {
    for (let code = from; code <= to; code += 1) chars.push(String.fromCharCode(code));
  }
  return chars;
}

export const BUILT_IN_CODES = poolFrom([
  [0x41, 0x5a], // A-Z
  [0x61, 0x7a], // a-z
  [0xc0, 0xff], // À-ÿ
  [0x100, 0x17f], // Latin Extended-A
  [0x21, 0x2f], // ! " # $ % & ' ( ) * + , - . /
  [0x3a, 0x40], // : ; < = > ? @
  [0x5b, 0x60], // [ \ ] ^ _ `
  [0x7b, 0x7e], // { | } ~
  [0x391, 0x3a9], // Greek capitals
  [0x3b1, 0x3c9], // Greek smalls
]);

export const FOUND_CODES = poolFrom([
  [0x410, 0x44f], // Cyrillic
  [0x531, 0x556], // Armenian
  [0x5d0, 0x5ea], // Hebrew
]).reverse();

// ---------- crystals nobody has found yet ----------

const HEADS = [
  "Chalco", "Pyro", "Azur", "Lepido", "Cryo", "Hydro", "Xeno", "Thermo", "Vanad", "Titan",
  "Lumin", "Umbra", "Nocti", "Stella", "Cobalto", "Fluoro", "Seleno", "Chromo", "Baryo", "Helio",
  "Glacio", "Ferro", "Cupro", "Argento", "Aurio", "Plumbo", "Magneso", "Kalio", "Litho", "Astro",
  "Halo", "Nepho", "Porphyro", "Melano", "Leuco", "Rhodo", "Cyano", "Xantho", "Iodo", "Ortho",
];

const TAILS = [
  "lite", "ite", "phane", "clase", "spar", "chite", "gyrite", "zircon", "stone", "quartz",
  "crystal", "glass", "beryl", "opal", "jasper", "flint", "sheen", "bloom", "dust", "tear",
];

const HUES = [
  ["#d8362b", "#a8251c"], ["#ee7a2a", "#c95c19"], ["#f7d23e", "#d8ae23"], ["#7fd83a", "#59a823"],
  ["#3f9a5b", "#2a7d44"], ["#3fd8c9", "#2aa89e"], ["#3b7fe0", "#2159b3"], ["#5b3fd9", "#3f2aa8"],
  ["#9b59d9", "#7a3fb3"], ["#d83f8f", "#a82a6b"], ["#f2f0ea", "#cfc9bb"], ["#2a2a33", "#45454f"],
];

/**
 * Invents a crystal that has never existed. `roll` is a random number source,
 * handed in so a made-up crystal can be made again exactly in a test.
 */
export function inventCrystal(roll: () => number): CrystalSpec {
  const head = HEADS[Math.floor(roll() * HEADS.length)] ?? "Xeno";
  const tail = TAILS[Math.floor(roll() * TAILS.length)] ?? "lite";
  const hue = HUES[Math.floor(roll() * HUES.length)] ?? ["#f2f0ea", "#cfc9bb"];
  const sparkle = roll() < 0.35 ? [HUES[Math.floor(roll() * HUES.length)]?.[0] ?? "#fff"] : [];
  return { name: `${head}${tail}`, colors: [...hue, ...sparkle] };
}
