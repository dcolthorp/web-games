// Everything you can buy in the shops down the street: food, sweets, toys,
// and decorations for your pet's room.

export type NeedId = "food" | "water" | "sleep" | "bath" | "play";
export type ItemKind = "food" | "sweet" | "toy" | "decor" | "potion";
export type Magic = "grow" | "happy" | "sparkle" | "tiny" | "giant" | "normal";

export interface Item {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  price: number;
  fills?: Partial<Record<NeedId, number>>; // what it does for your pet
  spot?: [number, number, number]; // decorations: where it goes in the room (x, y, size)
  magic?: Magic; // potions: what they do
}

export const ITEMS: Item[] = [
  // Food Market
  { id: "kibble", name: "Kibble", icon: "🥣", kind: "food", price: 10, fills: { food: 60 } },
  { id: "bone", name: "Bone", icon: "🦴", kind: "food", price: 15, fills: { food: 70 } },
  { id: "fish", name: "Fish", icon: "🐟", kind: "food", price: 15, fills: { food: 70 } },
  { id: "carrot", name: "Carrot", icon: "🥕", kind: "food", price: 10, fills: { food: 50 } },
  { id: "apple", name: "Apple", icon: "🍎", kind: "food", price: 8, fills: { food: 40, water: 15 } },
  { id: "steak", name: "Steak", icon: "🥩", kind: "food", price: 30, fills: { food: 100 } },
  { id: "milk", name: "Milk", icon: "🥛", kind: "food", price: 10, fills: { water: 70, food: 10 } },
  { id: "juice", name: "Juice Box", icon: "🧃", kind: "food", price: 12, fills: { water: 80 } },
  // Sweet Shop: a bit of food and a lot of fun.
  { id: "candy", name: "Candy", icon: "🍬", kind: "sweet", price: 5, fills: { food: 15, play: 25 } },
  { id: "cookie", name: "Cookie", icon: "🍪", kind: "sweet", price: 8, fills: { food: 25, play: 25 } },
  { id: "lollipop", name: "Lollipop", icon: "🍭", kind: "sweet", price: 10, fills: { food: 15, play: 40 } },
  { id: "cupcake", name: "Cupcake", icon: "🧁", kind: "sweet", price: 15, fills: { food: 35, play: 35 } },
  { id: "donut", name: "Donut", icon: "🍩", kind: "sweet", price: 15, fills: { food: 40, play: 30 } },
  { id: "icecream", name: "Ice Cream", icon: "🍦", kind: "sweet", price: 20, fills: { food: 30, water: 20, play: 40 } },
  { id: "cake", name: "Birthday Cake", icon: "🎂", kind: "sweet", price: 40, fills: { food: 70, play: 70 } },
  // Toy Store: toys are yours forever, and you can play with them as much as you want.
  { id: "ball", name: "Soccer Ball", icon: "⚽", kind: "toy", price: 30, fills: { play: 100 } },
  { id: "yarn", name: "Ball of Yarn", icon: "🧶", kind: "toy", price: 30, fills: { play: 100 } },
  { id: "yoyo", name: "Yo-yo", icon: "🪀", kind: "toy", price: 25, fills: { play: 100 } },
  { id: "duck", name: "Squeaky Duck", icon: "🦆", kind: "toy", price: 35, fills: { play: 100, bath: 20 } },
  { id: "frisbee", name: "Frisbee", icon: "🥏", kind: "toy", price: 40, fills: { play: 100 } },
  { id: "teddy", name: "Teddy Bear", icon: "🧸", kind: "toy", price: 50, fills: { play: 100, sleep: 20 } },
  { id: "kite", name: "Kite", icon: "🪁", kind: "toy", price: 60, fills: { play: 100 } },
  // Decoration Shop: things for your room.
  { id: "balloons", name: "Balloons", icon: "🎈", kind: "decor", price: 40, spot: [745, 240, 64] },
  { id: "painting", name: "Painting", icon: "🖼️", kind: "decor", price: 80, spot: [330, 92, 58] },
  { id: "rainbow", name: "Rainbow", icon: "🌈", kind: "decor", price: 60, spot: [470, 84, 62] },
  { id: "clock", name: "Clock", icon: "🕰️", kind: "decor", price: 50, spot: [400, 36, 40] },
  { id: "fishbowl", name: "Fish Bowl", icon: "🐠", kind: "decor", price: 70, spot: [585, 120, 38] },
  { id: "flowers", name: "Flowers", icon: "💐", kind: "decor", price: 30, spot: [695, 118, 38] },
  { id: "tv", name: "TV", icon: "📺", kind: "decor", price: 150, spot: [56, 290, 64] },
  { id: "trophy", name: "Trophy", icon: "🏆", kind: "decor", price: 100, spot: [150, 296, 48] },
  { id: "cactus", name: "Cactus", icon: "🌵", kind: "decor", price: 35, spot: [752, 330, 58] },
  { id: "stars", name: "Twinkle Stars", icon: "✨", kind: "decor", price: 45, spot: [560, 40, 40] },
  // The secret Magic Shop: potions!
  { id: "growpotion", name: "Grow-Up Potion", icon: "🧪", kind: "potion", price: 200, magic: "grow" },
  { id: "happypotion", name: "Happy Potion", icon: "💖", kind: "potion", price: 100, magic: "happy" },
  { id: "sparklepotion", name: "Sparkle Potion", icon: "🌟", kind: "potion", price: 300, magic: "sparkle" },
  { id: "tinypotion", name: "Tiny Potion", icon: "🐜", kind: "potion", price: 150, magic: "tiny" },
  { id: "giantpotion", name: "Giant Potion", icon: "🍄", kind: "potion", price: 150, magic: "giant" },
  { id: "normalpotion", name: "Back-to-Normal Potion", icon: "🔄", kind: "potion", price: 50, magic: "normal" },
];

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);
