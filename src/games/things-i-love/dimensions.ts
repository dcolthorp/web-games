import type { SoundName } from "./sounds";

// The dimensions the Lab's portal can take you to. You pick one at the
// Portal Hub. Double Dimension (where Blorp lives) comes with the portal;
// the rest cost $1,000 each to unlock, once. Every dimension is a street you
// drive along, with a portal back to the hub and three places to go into.

export type Decor = "city" | "islands" | "circuits" | "candy" | "volcano" | "clouds" | "bubbles";

export interface Theme {
  sky: [string, string];
  walk: string;
  road: string;
  dash: string;
  decor: Decor;
  flip?: boolean; // draw the whole place upside down
  crazy?: boolean; // colours that never sit still, and a world that wobbles
}

export interface DimPlace {
  name: string;
  x: number;
  color: string;
  scene: string | null; // null is the portal back to the hub
}

export interface Dimension {
  id: string;
  name: string;
  cost: number;
  door: string; // colour of its doorway at the hub
  intro: string;
  theme: Theme;
  places: DimPlace[];
  /** Only for sale once you've done the whole story and unlocked every other dimension. */
  secret?: boolean;
}

export interface Scene {
  id: string;
  title: string;
  kind: "talk" | "look" | "collect";
  button: string;
  intro: string;
  lines?: string[]; // for talk and look
  gives?: string[]; // for collect: one of these goes on your shelf, once per visit
  sound: SoundName;
  bg: [string, string];
  floor: string;
  model?: string; // a model from the box room to show, spinning
  draw?: "blorp" | "cave" | "garden" | "volcano" | "tower" | "void";
}

/** When T-Rex says this, clicking his head five times gets you a present (city.ts). */
export const SCRATCH_LINE = "I can't reach my head. My arms are too tiny! Can you scratch it?";

export const CITY_THEME: Theme = { sky: ["#8fd0ff", "#e8f6ff"], walk: "#d9d4cc", road: "#4a4a55", dash: "#ffe36e", decor: "city" };

const portal = (): DimPlace => ({ name: "Portal", x: 230, color: "#a35cff", scene: null });

export const DIMENSIONS: Dimension[] = [
  {
    id: "double",
    name: "Double Dimension",
    cost: 0,
    door: "#a35cff",
    intro: "Whoa. Two moons! Everything here comes in twos.",
    theme: { sky: ["#3a1a6e", "#c86fd8"], walk: "#b48ad8", road: "#3f2a5c", dash: "#ff8fd8", decor: "islands" },
    places: [
      portal(),
      { name: "Blorp's House", x: 760, color: "#6fd48f", scene: "blorp" },
      { name: "Crystal Cave", x: 1300, color: "#5fe0ff", scene: "cave" },
      { name: "Floating Garden", x: 1840, color: "#ff8fc7", scene: "garden" },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT Land",
    cost: 1_000,
    door: "#10a37f",
    intro: "Beep boop! Everybody here LOVES to talk.",
    theme: { sky: ["#bfeee2", "#f4fffb"], walk: "#b8e0d8", road: "#2f4a4a", dash: "#10a37f", decor: "circuits" },
    places: [
      portal(),
      { name: "Chatty Café", x: 760, color: "#9fe0cf", scene: "chatty" },
      { name: "Answer Tower", x: 1300, color: "#c9ced6", scene: "tower" },
      { name: "Robot Shop", x: 1840, color: "#7fc8ff", scene: "robots" },
    ],
  },
  {
    id: "candy",
    name: "Candy Dimension",
    cost: 1_000,
    door: "#ff6fb5",
    intro: "Everything here is made of candy. Don't lick the road.",
    theme: { sky: ["#ffb0e8", "#fff0f8"], walk: "#ffd0e8", road: "#6b3a1f", dash: "#ffffff", decor: "candy" },
    places: [
      portal(),
      { name: "Gumdrop Mountain", x: 760, color: "#ff9fcf", scene: "gumdrop" },
      { name: "Chocolate River", x: 1300, color: "#9c6d40", scene: "river" },
      { name: "Cupcake Bakery", x: 1840, color: "#ffd27a", scene: "bakery" },
    ],
  },
  {
    id: "dino",
    name: "Dino Dimension",
    cost: 1_000,
    door: "#4cc76a",
    intro: "RAWR! Dinosaurs live here. They're friendly. Mostly.",
    theme: { sky: ["#ffb070", "#ffe8b0"], walk: "#c8a070", road: "#5a4030", dash: "#ffe36e", decor: "volcano" },
    places: [
      portal(),
      { name: "Dino Nest", x: 760, color: "#d9c08a", scene: "nest" },
      { name: "Volcano", x: 1300, color: "#a0522d", scene: "volcano" },
      { name: "T-Rex's House", x: 1840, color: "#6fd48f", scene: "trex" },
    ],
  },
  {
    id: "underwater",
    name: "Underwater Dimension",
    cost: 1_000,
    door: "#4a9bff",
    intro: "Blub blub! You're under the sea. Your car has a snorkel.",
    theme: { sky: ["#0a4a8a", "#4ab8e8"], walk: "#e8d8a0", road: "#2a5a7a", dash: "#a8f0ff", decor: "bubbles" },
    places: [
      portal(),
      { name: "Mermaid Castle", x: 760, color: "#ffb0e8", scene: "mermaid" },
      { name: "Shark Reef", x: 1300, color: "#ff9a6a", scene: "reef" },
      { name: "Treasure Chest", x: 1840, color: "#f2c230", scene: "treasure" },
    ],
  },
  {
    id: "upside",
    name: "Upside-Down Dimension",
    cost: 1_000,
    door: "#ffd23f",
    intro: "Everything is upside down! Even you!",
    theme: { sky: ["#a8e8ff", "#f0fbff"], walk: "#c8e8a8", road: "#5a6a4a", dash: "#ffffff", decor: "clouds", flip: true },
    places: [
      portal(),
      { name: "Upside-Down House", x: 760, color: "#ff9fcf", scene: "upsidehouse" },
      { name: "Sky Pool", x: 1300, color: "#7fc8ff", scene: "skypool" },
      { name: "Balloon Shop", x: 1840, color: "#ffd27a", scene: "balloons" },
    ],
  },
  {
    // The last one: it only opens up after the "Find the Void Key" note, once
    // every other dimension is unlocked, and costs exactly what the robber's
    // stuff sold for.
    id: "insanity",
    name: "Insanity Dimension",
    cost: 1_000_000_000,
    door: "#ff2fb0",
    secret: true,
    intro: "Welcome to the INSANITY DIMENSION! Nothing here makes sense. The Void Key is hidden somewhere...",
    theme: { sky: ["#ff00ff", "#00ffcc"], walk: "#ffe36e", road: "#a35cff", dash: "#3dff6a", decor: "clouds", crazy: true },
    places: [
      portal(),
      { name: "Backwards House", x: 760, color: "#3dff6a", scene: "backwards" },
      { name: "Laughing Mountain", x: 1300, color: "#ff9226", scene: "laughing" },
      { name: "The Void", x: 1840, color: "#24222b", scene: "void" },
    ],
  },
];

export const SCENES: Record<string, Scene> = {
  // Double Dimension
  blorp: {
    id: "blorp", title: "Blorp's House", kind: "talk", button: "Talk to Blorp", sound: "blub",
    bg: ["#3a1a6e", "#5a3a8e"], floor: "#6b4a9e", draw: "blorp",
    intro: "Blorp! That means hello!",
    lines: [
      "Your car is so shiny. We only have hover-snails here.",
      "I love boxes too! I live in one. A big one.",
      "Want a space cookie? It tastes like purple.",
      "In my world it rains glitter on Tuesdays.",
      "Tell Penelope I said blorp!",
      "I have seven toes. Wait, eight. No, seven.",
      "Did you see the two moons? That one's my favorite.",
    ],
  },
  cave: {
    id: "cave", title: "Crystal Cave", kind: "collect", button: "Take a crystal home", sound: "magic",
    bg: ["#1e1236", "#1e1236"], floor: "#2a1a4a", draw: "cave",
    intro: "The walls are covered in glowing crystals!",
    gives: ["purple crystal", "blue crystal", "pink crystal", "green crystal", "gold crystal"],
  },
  garden: {
    id: "garden", title: "Floating Garden", kind: "look", button: "Smell the flowers", sound: "magic",
    bg: ["#ffb0e8", "#c86fd8"], floor: "#c86fd8", draw: "garden",
    intro: "The flowers float here! They smell like bubblegum.",
    lines: ["A flower floated onto your nose. Achoo!", "This one smells like pancakes!", "A tiny floating bee says hi. Bzzz!"],
  },
  // ChatGPT Land
  chatty: {
    id: "chatty", title: "Chatty Café", kind: "talk", button: "Ask the robot something", sound: "beep",
    bg: ["#e8fff8", "#bfeee2"], floor: "#9fd8c8", model: "robot",
    intro: "Hello! Welcome! I'd be SO happy to help! What can I help with? I can help with anything!",
    lines: [
      "Great question! Before I answer, here are twelve fun facts about spoons.",
      "Absolutely! I'd be happy to help you with that. Also, I'd be happy to help you with that.",
      "Here's a poem about your car: Vroom vroom, car go zoom. The end!",
      "I wrote you a story about a sandwich. It's only 900 pages long!",
      "Did you know robots can't eat pancakes? I am very sad about this.",
      "Sure! Here is a list of every color. Red. Orange. Yellow. Green. Blue. Okay, I'll stop.",
      "I'm not sure what you asked, but the answer is probably 'cats'.",
    ],
  },
  tower: {
    id: "tower", title: "Answer Tower", kind: "look", button: "Ask the tower a question", sound: "beep",
    bg: ["#bfeee2", "#f4fffb"], floor: "#9fd8c8", draw: "tower",
    intro: "The Answer Tower knows everything. It says so itself.",
    lines: [
      "You asked what 2 + 2 is. It said 4! Then it said it twenty more times.",
      "You asked why the sky is blue. It said 'Great question!' and blinked a lot.",
      "The tower is thinking... still thinking... it says hi!",
      "You asked what its favorite food is. It said 'electricity, with sprinkles'.",
    ],
  },
  robots: {
    id: "robots", title: "Robot Shop", kind: "collect", button: "Take a robot home", sound: "beep",
    bg: ["#e0f4ff", "#bfe6ff"], floor: "#9fc8e8", model: "silver robot",
    intro: "Robots for sale! Today they're free. Don't tell anyone.",
    gives: ["silver robot", "blue robot", "gold robot", "pink robot"],
  },
  // Candy Dimension
  gumdrop: {
    id: "gumdrop", title: "Gumdrop Mountain", kind: "collect", button: "Pick a lollipop", sound: "magic",
    bg: ["#ffd0f0", "#fff0f8"], floor: "#ffb0d8", model: "rainbow lollipop",
    intro: "A whole mountain of gumdrops, with lollipops growing out of it!",
    gives: ["lollipop", "rainbow lollipop", "blue lollipop", "yellow lollipop"],
  },
  river: {
    id: "river", title: "Chocolate River", kind: "look", button: "Dip a finger in", sound: "blub",
    bg: ["#ffd0f0", "#e8c0a0"], floor: "#6b3a1f", model: "chocolate",
    intro: "A river made of chocolate. It smells amazing.",
    lines: ["Mmm! Warm chocolate.", "A chocolate fish jumped out of the river!", "You found a marshmallow raft floating by."],
  },
  bakery: {
    id: "bakery", title: "Cupcake Bakery", kind: "collect", button: "Take a cupcake", sound: "magic",
    bg: ["#fff0d0", "#ffe0e8"], floor: "#e8b88a", model: "cupcake",
    intro: "Fresh cupcakes! The baker is a gingerbread cookie.",
    gives: ["cupcake", "pink cupcake", "blue cupcake", "purple cupcake"],
  },
  // Dino Dimension
  nest: {
    id: "nest", title: "Dino Nest", kind: "collect", button: "Adopt a baby dino", sound: "roar",
    bg: ["#ffe8b0", "#ffd090"], floor: "#a0805a", model: "green dinosaur",
    intro: "The eggs are hatching! The baby dinos want a home.",
    gives: ["dinosaur", "purple dinosaur", "blue dinosaur", "pink dinosaur"],
  },
  volcano: {
    id: "volcano", title: "Volcano", kind: "look", button: "Peek at the volcano", sound: "roar",
    bg: ["#ffb070", "#ffe8b0"], floor: "#5a4030", draw: "volcano",
    intro: "A big volcano. Don't worry, it's a sleepy one.",
    lines: ["The volcano burped! A little puff of smoke came out.", "It's snoring. Shhh.", "You roasted a marshmallow on it. Yum!"],
  },
  trex: {
    id: "trex", title: "T-Rex's House", kind: "talk", button: "Talk to T-Rex", sound: "roar",
    bg: ["#ffe8b0", "#d8f0b0"], floor: "#a0805a", model: "dinosaur",
    intro: "RAWR! I mean... hello! Sorry, I always say RAWR first.",
    lines: [
      SCRATCH_LINE,
      "I wanted to give you a hug, but my arms are too short.",
      "My favorite food is pizza. Wait, no. Leaves. No, pizza.",
      "I'm learning to clap. It's going badly.",
    ],
  },
  // Underwater Dimension
  mermaid: {
    id: "mermaid", title: "Mermaid Castle", kind: "talk", button: "Talk to the mermaid", sound: "blub",
    bg: ["#2a7ac8", "#7fd0f0"], floor: "#e8d8a0", model: "pink castle",
    intro: "Hello! Welcome to my castle! The fish are my friends.",
    lines: [
      "I comb my hair with a fork. It works great!",
      "Do you want to race the dolphins? They always win.",
      "Shh! The octopus is taking a nap.",
      "My castle is made of seashells and one old boot.",
    ],
  },
  reef: {
    id: "reef", title: "Shark Reef", kind: "collect", button: "Take a (friendly) shark", sound: "chomp",
    bg: ["#1a6ab0", "#5ac0e8"], floor: "#ff9a6a", model: "shark",
    intro: "These sharks are friendly. They just want a high five.",
    gives: ["shark", "blue shark", "pink shark"],
  },
  treasure: {
    id: "treasure", title: "Treasure Chest", kind: "collect", button: "Take some treasure", sound: "magic",
    bg: ["#0a4a8a", "#2a8ac8"], floor: "#e8d8a0", model: "gold crown",
    intro: "A treasure chest full of shiny stuff!",
    gives: ["gold crown", "gold gem", "pink gem", "blue gem"],
  },
  // Upside-Down Dimension
  upsidehouse: {
    id: "upsidehouse", title: "Upside-Down House", kind: "look", button: "Look around", sound: "boing",
    bg: ["#a8e8ff", "#f0fbff"], floor: "#c8e8a8", model: "house",
    intro: "The furniture is all on the ceiling. Wait, that's the floor.",
    lines: ["You walked on the ceiling. Your hair is standing up!", "The upside-down cat says woem. That's meow backwards.", "Your juice fell UP."],
  },
  skypool: {
    id: "skypool", title: "Sky Pool", kind: "look", button: "Jump in", sound: "blub",
    bg: ["#a8e8ff", "#f0fbff"], floor: "#7fc8ff", model: "fish",
    intro: "The pool is in the sky and the fish swim in the clouds.",
    lines: ["Splash! The water went up.", "A fish waved at you with its fin.", "You did a cannonball into a cloud!"],
  },
  balloons: {
    id: "balloons", title: "Balloon Shop", kind: "collect", button: "Take a balloon", sound: "whoosh",
    bg: ["#fff4c8", "#f0fbff"], floor: "#ffd27a", model: "balloon",
    intro: "Here, balloons fall DOWN instead of floating up.",
    gives: ["upside-down balloon", "upside-down pink balloon", "upside-down blue balloon", "upside-down gold balloon"],
  },
  // Insanity Dimension
  backwards: {
    id: "backwards", title: "Backwards House", kind: "talk", button: "Say hi", sound: "hi",
    bg: ["#3dff6a", "#ff00ff"], floor: "#ffe36e", model: "rainbow house",
    intro: "!esuoH sdrawkcaB eht ot emocleW",
    lines: ["!olleH", "?yadot gniod uoy era woH", "!sdrawkcab klat lla eW", ".yek diov eht dnif t'nac I", "!sekacnap evol I"],
  },
  laughing: {
    id: "laughing", title: "Laughing Mountain", kind: "look", button: "Tell it a joke", sound: "boing",
    bg: ["#ff9226", "#ff00ff"], floor: "#a35cff", draw: "volcano",
    intro: "HAHAHAHA! The mountain is laughing at a joke you can't hear.",
    lines: ["HAHAHA! It laughed so hard a rock fell off.", "It's still laughing. HEE HEE HEE!", "It told YOU a joke. It was about cheese. You didn't get it.", "It snorted! Mountains can snort?!"],
  },
  void: {
    id: "void", title: "The Void", kind: "look", button: "Look into the Void", sound: "whoosh",
    bg: ["#24222b", "#000000"], floor: "#1a1020", draw: "void",
    intro: "A giant swirling black hole. It's very, very quiet here...",
    lines: [
      "The Void looks back at you. Then it blinks?!",
      "You yell into the Void. It yells back: \"...WHERE'S THE KEY?\"",
      "The Void Key must be hidden somewhere in this dimension... (To be continued!)",
    ],
  },
};

const lamp = (ctx: CanvasRenderingContext2D, x: number, groundY: number, stem: string, top: string): void => {
  ctx.fillStyle = stem;
  ctx.fillRect(x - 6, groundY - 70, 12, 52);
  ctx.fillStyle = top;
};

/**
 * The faraway stuff behind the buildings, drawn first. `skipCloud` leaves one
 * cloud out (the Insanity Dimension draws the one hiding the Void Key itself).
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  decor: Decor,
  cam: number,
  now: number,
  W: number,
  roadY: number,
  skipCloud = -1,
): void {
  if (decor === "city") {
    ctx.fillStyle = "#fff4a8";
    ctx.beginPath();
    ctx.arc(800 - cam * 0.03, 70, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b6c8e6";
    for (let i = 0; i < 14; i++) {
      const x = ((i * 180 - cam * 0.3) % (W + 360)) - 180;
      const h = 90 + ((i * 37) % 80);
      ctx.fillRect(x, roadY - 120 - h, 110, h + 120);
    }
  } else if (decor === "islands") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97 - cam * 0.05) % W, (i * 53) % 200, 2, 2);
    ctx.fillStyle = "#ffe8a8";
    ctx.beginPath();
    ctx.arc(160 - cam * 0.03, 70, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8f0ff";
    ctx.beginPath();
    ctx.arc(720 - cam * 0.03, 110, 20, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const x = ((i * 420 - cam * 0.3) % (W + 300)) - 100;
      const y = 150 + Math.sin(now / 900 + i) * 8 + (i % 2) * 40;
      ctx.fillStyle = "#7a4ab0";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 120, y);
      ctx.lineTo(x + 60, y + 50);
      ctx.fill();
      ctx.fillStyle = "#6fd48f";
      ctx.fillRect(x, y - 8, 120, 10);
    }
  } else if (decor === "circuits") {
    // Circuit-board lines with little lights running along them.
    ctx.strokeStyle = "#9fd8c8";
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const y = 40 + i * 36;
      const off = (-cam * 0.3) % 200;
      ctx.beginPath();
      for (let x = off; x < W + 200; x += 200) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 120, y);
        ctx.lineTo(x + 140, y + 18);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#10a37f";
    for (let i = 0; i < 10; i++) {
      const x = (now / 4 + i * 160 - cam * 0.3) % (W + 100);
      ctx.fillRect(x, 36 + (i % 8) * 36, 8, 8);
    }
  } else if (decor === "candy") {
    for (let i = 0; i < 9; i++) {
      const x = ((i * 260 - cam * 0.3) % (W + 300)) - 100;
      ctx.fillStyle = ["#ff8fc7", "#7fc8ff", "#ffe36e", "#9ce8b4"][i % 4]!;
      ctx.beginPath();
      ctx.ellipse(x, roadY - 30, 130, 120 + (i % 3) * 30, 0, Math.PI, 0);
      ctx.fill();
    }
  } else if (decor === "volcano") {
    const x = 640 - cam * 0.15;
    ctx.fillStyle = "#8a5a3a";
    ctx.beginPath();
    ctx.moveTo(x - 220, roadY - 18);
    ctx.lineTo(x - 50, 90);
    ctx.lineTo(x + 50, 90);
    ctx.lineTo(x + 220, roadY - 18);
    ctx.fill();
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + Math.sin(now / 800 + i) * 20, 70 - i * 18 - ((now / 30) % 18), 18 + i * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (decor === "clouds") {
    ctx.fillStyle = "#ffffff";
    cloudSpots(cam, now, W).forEach(({ x, y }, i) => i !== skipCloud && drawCloud(ctx, x, y));
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    for (let i = 0; i < 30; i++) {
      const x = (i * 131 - cam * 0.2) % W;
      const y = (roadY - ((now / 12 + i * 47) % roadY)) % roadY;
      ctx.beginPath();
      ctx.arc((x + W) % W, y, 4 + (i % 3) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Where the drifting clouds are right now (the left edge of each, and its middle height). */
export function cloudSpots(cam: number, now: number, W: number): { x: number; y: number }[] {
  return Array.from({ length: 8 }, (_, i) => ({
    x: ((((i * 230 - cam * 0.2 + now / 50) % (W + 300)) + W + 300) % (W + 300)) - 150,
    y: 60 + (i % 3) * 50,
  }));
}

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Little things standing on the sidewalk between buildings (trees in the city). */
export function drawProp(ctx: CanvasRenderingContext2D, decor: Decor, x: number, roadY: number, now: number): void {
  const g = roadY - 18;
  if (decor === "city") {
    lamp(ctx, x, roadY, "#8b5a2b", "#4cc76a");
    ctx.beginPath();
    ctx.arc(x, g - 70, 30, 0, Math.PI * 2);
    ctx.fill();
  } else if (decor === "islands") {
    lamp(ctx, x, roadY, "#f4e2ff", "#5fe0ff");
    ctx.beginPath();
    ctx.ellipse(x, g - 54, 34, 20, 0, Math.PI, 0);
    ctx.fill();
  } else if (decor === "circuits") {
    lamp(ctx, x, roadY, "#7d8794", now % 1000 < 500 ? "#10a37f" : "#ffffff");
    ctx.beginPath();
    ctx.arc(x, g - 58, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (decor === "candy") {
    lamp(ctx, x, roadY, "#ffffff", "#ff6fb5");
    ctx.beginPath();
    ctx.arc(x, g - 66, 24, 0, Math.PI * 2);
    ctx.fill();
  } else if (decor === "volcano") {
    lamp(ctx, x, roadY, "#8b5a2b", "#3e8f4f");
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(a) * 26, g - 58, 30, 9, a, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (decor === "clouds") {
    lamp(ctx, x, roadY, "#ffffff", "#ffffff");
    ctx.beginPath();
    ctx.arc(x, g - 60, 22, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#3e8f4f";
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x - 14 + i * 14 + Math.sin(now / 500 + i) * 4, g - 40, 7, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
