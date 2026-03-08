import type { GrowthStage, PlayOutcome, ColorTheme } from "../model/types";

export const MAX_HUNGER = 100;
export const MAX_DENTAL_HEALTH = 100;

export const HATCH_THRESHOLD = 100;
export const HATCH_PROGRESS_PER_CLICK = 5;

export const PLAY_ANIMATION_DURATION_SECONDS = 2.0;

export const PLAY_OUTCOME_WEIGHTS: Record<PlayOutcome, number> = {
  success: 0.7,
  minor_ouchie: 0.2,
  bigger_injury: 0.05,
  dental_problem: 0.05,
};

export const PLAY_SUCCESS_CARE_POINTS = 5;
export const DENTAL_CARE_POINTS = 5;
export const DENTAL_HEALTH_GAIN = 30;

export const BANDAID_CARE_POINTS = 3;
export const DOCTOR_CARE_POINTS = 8;
export const DENTIST_CARE_POINTS = 8;

export const HUNGER_INCREASE_PER_MINUTE = 1;
export const DENTAL_DECAY_PER_MINUTE = 0.5;
export const OFFLINE_CATCHUP_MAX_SECONDS = 24 * 60 * 60;

export const DENTAL_PROBLEM_THRESHOLD = 25;

export const EVOLUTION_THRESHOLDS: Partial<Record<GrowthStage, number>> = {
  egg: 0,
  baby: 50,
  child: 100,
  teen: 150,
};

export const NU11_EVOLUTION_THRESHOLDS: Partial<Record<GrowthStage, number>> = {
  egg: 0,
  child: 50,
  teen: 100,
  monster: 150,
  shadow: 200,
  specter: 260,
  wraith: 330,
  phantom: 410,
  revenant: 500,
  nightmare: 600,
  void_walker: 710,
  abyss: 830,
  eldritch: 960,
  corrupted: 1100,
};

export const NU11_STAGE_NAMES: Partial<Record<GrowthStage, string>> = {
  egg: "The Void Egg",
  child: "The Awakened",
  teen: "The Changed",
  monster: "The Beast",
  shadow: "The Shadow",
  specter: "The Specter",
  wraith: "The Wraith",
  phantom: "The Phantom",
  revenant: "The Revenant",
  nightmare: "The Nightmare",
  void_walker: "The Void Walker",
  abyss: "The Abyss",
  eldritch: "The Eldritch",
  corrupted: "The Corrupted",
  xyy4: "XYY4$992WQERS",
};

export const MILLIONAIRE_STAGE_NAMES: Partial<Record<GrowthStage, string>> = {
  egg: "Golden Egg",
  baby: "Penny Puff",
  child: "Silver Sprout",
  teen: "Gilded Rebel",
  monster: "Platinum Tycoon",
};

export type Food = {
  id: string;
  name: string;
  hungerReduction: number;
  dentalDamage: number;
  color: [number, number, number];
  carePoints?: number;
  carePointsWeights?: Array<[number, number]>;
  stages?: GrowthStage[];
  description?: string;
  minStage?: GrowthStage;
};

export const FOODS: Record<string, Food> = {
  banana: {
    id: "banana",
    name: "Banana",
    hungerReduction: 20,
    carePoints: 5,
    dentalDamage: 1,
    stages: ["baby", "child"],
    color: [255, 225, 50],
  },
  candy: {
    id: "candy",
    name: "Candy",
    hungerReduction: 10,
    carePoints: 3,
    dentalDamage: 4,
    stages: ["baby", "child"],
    color: [255, 100, 150],
  },
  cookie: {
    id: "cookie",
    name: "Cookie",
    hungerReduction: 15,
    carePoints: 4,
    dentalDamage: 3,
    stages: ["baby", "child"],
    color: [200, 150, 100],
  },
  ice_cream: {
    id: "ice_cream",
    name: "Ice Cream",
    hungerReduction: 25,
    carePoints: 6,
    dentalDamage: 2,
    stages: ["baby", "child"],
    color: [255, 200, 220],
  },
  lollipop: {
    id: "lollipop",
    name: "Lollipop",
    hungerReduction: 10,
    carePoints: 3,
    dentalDamage: 4,
    stages: ["baby", "child"],
    color: [255, 50, 100],
  },
  mystery_meat: {
    id: "mystery_meat",
    name: "Mystery Meat",
    hungerReduction: 20,
    carePoints: 5,
    dentalDamage: 2,
    stages: ["teen"],
    color: [150, 100, 100],
  },
  odd_fruit: {
    id: "odd_fruit",
    name: "Odd Fruit",
    hungerReduction: 15,
    carePoints: 4,
    dentalDamage: 1,
    stages: ["teen"],
    color: [100, 150, 100],
  },
  sour_candy: {
    id: "sour_candy",
    name: "Sour Candy",
    hungerReduction: 10,
    carePoints: 3,
    dentalDamage: 4,
    stages: ["teen"],
    color: [150, 255, 100],
  },
  raw_meat: {
    id: "raw_meat",
    name: "Raw Meat",
    hungerReduction: 30,
    carePoints: 8,
    dentalDamage: 2,
    stages: ["monster"],
    color: [180, 50, 50],
  },
  brain: {
    id: "brain",
    name: "Brain",
    hungerReduction: 40,
    carePoints: 10,
    dentalDamage: 3,
    stages: ["monster"],
    color: [255, 180, 180],
  },
  eyeball: {
    id: "eyeball",
    name: "Eyeball",
    hungerReduction: 20,
    carePoints: 6,
    dentalDamage: 1,
    stages: ["monster"],
    color: [240, 240, 240],
  },
  bone: {
    id: "bone",
    name: "Bone",
    hungerReduction: 15,
    carePoints: 5,
    dentalDamage: 0,
    stages: ["monster"],
    color: [230, 230, 210],
  },
};

export const NU11_FOODS: Record<string, Food> = {
  moldy_bread: {
    id: "moldy_bread",
    name: "Moldy Bread",
    hungerReduction: 15,
    carePoints: 4,
    dentalDamage: 2,
    color: [120, 140, 80],
    description: "Fuzzy and green... delicious!",
  },
  spider_soup: {
    id: "spider_soup",
    name: "Spider Soup",
    hungerReduction: 25,
    carePoints: 6,
    dentalDamage: 1,
    color: [40, 40, 50],
    description: "Extra crunchy!",
  },
  eyeball_stew: {
    id: "eyeball_stew",
    name: "Eyeball Stew",
    hungerReduction: 30,
    carePoints: 7,
    dentalDamage: 1,
    color: [240, 240, 240],
    description: "They're watching you eat...",
  },
  rotten_fish: {
    id: "rotten_fish",
    name: "Rotten Fish",
    hungerReduction: 20,
    carePoints: 5,
    dentalDamage: 2,
    color: [100, 130, 90],
    description: "Smells terrible, tastes worse!",
  },
  mystery_goop: {
    id: "mystery_goop",
    name: "Mystery Goop",
    hungerReduction: 35,
    carePoints: 8,
    dentalDamage: 3,
    color: [60, 20, 80],
    description: "No one knows what's in it...",
  },
  bat_wings: {
    id: "bat_wings",
    name: "Bat Wings",
    hungerReduction: 15,
    carePoints: 4,
    dentalDamage: 1,
    color: [80, 60, 50],
    description: "Crispy and leathery!",
  },
  brain_candy: {
    id: "brain_candy",
    name: "Brain Candy",
    hungerReduction: 40,
    carePointsWeights: [
      [100, 0.01],
      [50, 0.09],
      [10, 0.9],
    ],
    dentalDamage: 5,
    color: [255, 150, 200],
    description: "Tastes like... memories?",
    minStage: "monster",
  },
};

export const MILLIONAIRE_FOODS: Record<string, Food> = {
  cabbage_water: {
    id: "cabbage_water",
    name: "Cabbage Water",
    hungerReduction: 10,
    carePoints: 2,
    dentalDamage: 1,
    stages: ["baby"],
    color: [190, 230, 180],
  },
  stale_bread: {
    id: "stale_bread",
    name: "Stale Bread",
    hungerReduction: 14,
    carePoints: 3,
    dentalDamage: 1,
    stages: ["baby"],
    color: [220, 210, 160],
  },
  thin_porridge: {
    id: "thin_porridge",
    name: "Thin Porridge",
    hungerReduction: 16,
    carePoints: 3,
    dentalDamage: 2,
    stages: ["baby"],
    color: [210, 220, 200],
  },
  pbj: {
    id: "pbj",
    name: "PB&J",
    hungerReduction: 20,
    carePoints: 4,
    dentalDamage: 2,
    stages: ["child"],
    color: [200, 180, 140],
  },
  street_hotdog: {
    id: "street_hotdog",
    name: "Street Hot Dog",
    hungerReduction: 24,
    carePoints: 5,
    dentalDamage: 2,
    stages: ["child"],
    color: [210, 160, 120],
  },
  diner_fries: {
    id: "diner_fries",
    name: "Diner Fries",
    hungerReduction: 18,
    carePoints: 4,
    dentalDamage: 3,
    stages: ["child"],
    color: [240, 210, 120],
  },
  sushi_roll: {
    id: "sushi_roll",
    name: "Sushi Roll",
    hungerReduction: 26,
    carePoints: 6,
    dentalDamage: 1,
    stages: ["teen"],
    color: [190, 220, 200],
  },
  gourmet_burger: {
    id: "gourmet_burger",
    name: "Gourmet Burger",
    hungerReduction: 30,
    carePoints: 7,
    dentalDamage: 2,
    stages: ["teen"],
    color: [200, 160, 120],
  },
  boba_latte: {
    id: "boba_latte",
    name: "Boba Latte",
    hungerReduction: 22,
    carePoints: 5,
    dentalDamage: 4,
    stages: ["teen"],
    color: [200, 190, 160],
  },
  caviar: {
    id: "caviar",
    name: "Caviar",
    hungerReduction: 34,
    carePoints: 8,
    dentalDamage: 1,
    stages: ["monster"],
    color: [50, 70, 60],
  },
  truffle_steak: {
    id: "truffle_steak",
    name: "Truffle Steak",
    hungerReduction: 40,
    carePoints: 10,
    dentalDamage: 2,
    stages: ["monster"],
    color: [160, 90, 70],
  },
  gold_leaf_sundae: {
    id: "gold_leaf_sundae",
    name: "Gold-Leaf Sundae",
    hungerReduction: 28,
    carePoints: 7,
    dentalDamage: 5,
    stages: ["monster"],
    color: [240, 210, 120],
  },
};

export type DentalSupplies = {
  waterName: string;
  waterColor: [number, number, number];
  toothpasteName: string;
  toothpasteColor: [number, number, number];
};

export const DENTAL_SUPPLIES: Partial<Record<GrowthStage, DentalSupplies>> = {
  baby: {
    waterName: "Water",
    waterColor: [200, 230, 255],
    toothpasteName: "Candy Toothpaste",
    toothpasteColor: [255, 180, 200],
  },
  child: {
    waterName: "Water",
    waterColor: [200, 230, 255],
    toothpasteName: "Candy Toothpaste",
    toothpasteColor: [255, 180, 200],
  },
  teen: {
    waterName: "Murky Water",
    waterColor: [150, 180, 150],
    toothpasteName: "Mint Toothpaste",
    toothpasteColor: [100, 200, 150],
  },
  monster: {
    waterName: "Blood",
    waterColor: [180, 30, 30],
    toothpasteName: "Grass Toothpaste",
    toothpasteColor: [50, 100, 50],
  },
};

export const MILLIONAIRE_DENTAL_SUPPLIES: Partial<Record<GrowthStage, DentalSupplies>> = {
  baby: {
    waterName: "Tap Water",
    waterColor: [200, 230, 255],
    toothpasteName: "Plain Toothpaste",
    toothpasteColor: [230, 230, 230],
  },
  child: {
    waterName: "Filtered Water",
    waterColor: [210, 240, 255],
    toothpasteName: "Mint Toothpaste",
    toothpasteColor: [170, 245, 210],
  },
  teen: {
    waterName: "Sparkling Water",
    waterColor: [225, 250, 255],
    toothpasteName: "Whitening Gel",
    toothpasteColor: [220, 255, 240],
  },
  monster: {
    waterName: "Luxury Rinse",
    waterColor: [210, 255, 240],
    toothpasteName: "Gold-Leaf Toothpaste",
    toothpasteColor: [255, 220, 140],
  },
};

export const NU11_DENTAL_SUPPLIES: DentalSupplies = {
  waterName: "Blood",
  waterColor: [180, 30, 30],
  toothpasteName: "Void Paste",
  toothpasteColor: [20, 20, 30],
};

export const PROFILE_THEMES: Record<string, ColorTheme> = {
  OSCAR: "blue",
  PENELOPE: "pink",
  NU11: "black",
  MILLIONAIRE: "green",
};

export type PlayActivity = { id: string; name: string; description: string };

export const PLAY_ACTIVITIES: Partial<Record<GrowthStage, PlayActivity[]>> = {
  baby: [
    { id: "peek_a_boo", name: "Peek-a-boo", description: "Play peek-a-boo!" },
    { id: "blocks", name: "Stacking Blocks", description: "Build a tower!" },
    { id: "ball", name: "Bouncing Ball", description: "Bounce the ball!" },
  ],
  child: [
    { id: "tag", name: "Tag", description: "Play tag!" },
    { id: "hide_seek", name: "Hide and Seek", description: "Ready or not!" },
    { id: "jump_rope", name: "Jump Rope", description: "Jump, jump!" },
  ],
  teen: [
    { id: "skateboard", name: "Skateboarding", description: "Do some tricks!" },
    { id: "video_games", name: "Video Games", description: "Game time!" },
    { id: "mischief", name: "Mischief", description: "Cause some trouble!" },
  ],
  monster: [
    { id: "haunting", name: "Haunting Practice", description: "Spooky floating!" },
    { id: "scaring", name: "Scaring Contest", description: "Be scary!" },
    { id: "graveyard", name: "Graveyard Hide-Seek", description: "Hide in the graves!" },
  ],
};

export const NU11_PLAY_ACTIVITIES: PlayActivity[] = [
  { id: "void_gaze", name: "Void Gazing", description: "Stare into the darkness..." },
  { id: "shadow_dance", name: "Shadow Dance", description: "Dance with your shadow!" },
  { id: "nightmare_tag", name: "Nightmare Tag", description: "Chase the nightmares!" },
  { id: "haunting", name: "Haunting Practice", description: "Spooky floating!" },
  { id: "scaring", name: "Scaring Contest", description: "Be VERY scary!" },
  { id: "graveyard", name: "Graveyard Exploration", description: "What's buried here?" },
];

export const MILLIONAIRE_PLAY_ACTIVITIES: Partial<Record<GrowthStage, PlayActivity[]>> = {
  baby: [
    { id: "dirt_play", name: "Playing in the Dirt", description: "Mud pies and tiny treasure!" },
    { id: "cardboard_castle", name: "Cardboard Castle", description: "Rule your box kingdom." },
    { id: "stick_ball", name: "Stick Ball", description: "A classic street game." },
  ],
  child: [
    { id: "arcade_tokens", name: "Arcade Tokens", description: "One more round!" },
    { id: "go_kart", name: "Go-Kart Laps", description: "Fast turns and victory laps." },
    { id: "science_kit", name: "Science Kit", description: "Small experiments, big ideas." },
  ],
  teen: [
    { id: "concert_night", name: "Concert Night", description: "VIP energy and bright lights." },
    { id: "luxury_mall", name: "Luxury Mall", description: "Window shopping… maybe." },
    { id: "playstation_6", name: "PlayStation 6", description: "Next-gen everything." },
  ],
  monster: [
    { id: "atlantic_yacht", name: "Yachting the Atlantic", description: "Cross the ocean in style." },
    { id: "private_island", name: "Private Island Day", description: "Just you and the sea." },
    { id: "suborbital", name: "Suborbital Space Tour", description: "See the curve of Earth." },
  ],
};
