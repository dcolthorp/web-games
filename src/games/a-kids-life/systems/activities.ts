import type { ActivityConfig } from "../model/types";

export const ACTIVITIES: ActivityConfig[] = [
  { id: "bottle", label: "Eat", icon: "🍼", stages: ["baby"], needFocus: "food", boosts: { food: 28, love: 6 }, starReward: 1, heartReward: 3, miniGame: "drag-track", roomHint: "nursery", accent: "#ffd27f" },
  { id: "nap", label: "Nap", icon: "⭐", stages: ["baby"], needFocus: "energy", boosts: { energy: 30, calm: 10 }, starReward: 1, heartReward: 2, miniGame: "tap-fill", roomHint: "crib", accent: "#c5b2ff" },
  { id: "bath", label: "Bath", icon: "🫧", stages: ["baby"], needFocus: "clean", boosts: { clean: 28, calm: 8 }, starReward: 1, heartReward: 2, miniGame: "collect", roomHint: "bath", accent: "#96e7f0" },
  { id: "peek", label: "Peek", icon: "👀", stages: ["baby"], needFocus: "fun", boosts: { fun: 20, love: 8 }, starReward: 1, heartReward: 2, miniGame: "timing", roomHint: "curtain", accent: "#ffb2bc" },
  { id: "rock", label: "Rock", icon: "🌙", stages: ["baby"], needFocus: "calm", boosts: { calm: 22, love: 6 }, starReward: 1, heartReward: 2, miniGame: "drag-track", roomHint: "chair", accent: "#8ab6ff" },
  { id: "cuddle", label: "Love", icon: "💗", stages: ["baby"], needFocus: "love", boosts: { love: 28, calm: 6 }, starReward: 1, heartReward: 3, miniGame: "hold-fill", roomHint: "blanket", accent: "#ff8cb2" },

  { id: "snack", label: "Snack", icon: "🍎", stages: ["toddler"], needFocus: "food", boosts: { food: 22, fun: 4 }, starReward: 1, heartReward: 3, miniGame: "pick-three", roomHint: "tray", accent: "#ffc86c" },
  { id: "blocks", label: "Blocks", icon: "🧱", stages: ["toddler"], needFocus: "fun", boosts: { fun: 22, learning: 8 }, starReward: 1, heartReward: 3, miniGame: "drag-track", roomHint: "rug", accent: "#ffb86e" },
  { id: "dance", label: "Dance", icon: "🎵", stages: ["toddler"], needFocus: "fun", boosts: { fun: 24, calm: 6 }, starReward: 1, heartReward: 3, miniGame: "timing", roomHint: "music", accent: "#b898ff" },
  { id: "story", label: "Book", icon: "📖", stages: ["toddler"], needFocus: "love", boosts: { love: 14, learning: 14 }, starReward: 1, heartReward: 2, miniGame: "tap-fill", roomHint: "book", accent: "#8cc3ff" },
  { id: "wash", label: "Wash", icon: "🧼", stages: ["toddler"], needFocus: "clean", boosts: { clean: 25, calm: 4 }, starReward: 1, heartReward: 2, miniGame: "collect", roomHint: "sink", accent: "#7fe2da" },
  { id: "walk", label: "Walk", icon: "🦆", stages: ["toddler"], needFocus: "energy", boosts: { energy: 14, fun: 12, love: 4 }, starReward: 1, heartReward: 3, miniGame: "collect", roomHint: "park", accent: "#8fd689" },

  { id: "breakfast", label: "Eat", icon: "🥞", stages: ["kid"], needFocus: "food", boosts: { food: 20, calm: 6 }, starReward: 1, heartReward: 4, miniGame: "pick-three", roomHint: "kitchen", accent: "#ffcf77" },
  { id: "dress", label: "Dress", icon: "👕", stages: ["kid"], needFocus: "clean", boosts: { clean: 18, fun: 6 }, starReward: 1, heartReward: 3, miniGame: "drag-track", roomHint: "closet", accent: "#ff99a7" },
  { id: "school", label: "School", icon: "🍎", stages: ["kid"], needFocus: "learning", boosts: { learning: 24, calm: 4 }, starReward: 2, heartReward: 4, miniGame: "tap-fill", roomHint: "desk", accent: "#8db0ff" },
  { id: "playground", label: "Play", icon: "⚽", stages: ["kid"], needFocus: "fun", boosts: { fun: 26, energy: 6 }, starReward: 2, heartReward: 4, miniGame: "timing", roomHint: "yard", accent: "#6bd3a3" },
  { id: "art", label: "Art", icon: "🎨", stages: ["kid"], needFocus: "fun", boosts: { fun: 18, calm: 12 }, starReward: 2, heartReward: 4, miniGame: "collect", roomHint: "paint", accent: "#ffa7d1" },
  { id: "clean-room", label: "Tidy", icon: "🧺", stages: ["kid"], needFocus: "chores", boosts: { chores: 24, clean: 8 }, starReward: 2, heartReward: 4, miniGame: "drag-track", roomHint: "toy box", accent: "#7fd8cb" },

  { id: "lunch", label: "Lunch", icon: "🥪", stages: ["teen"], needFocus: "food", boosts: { food: 22, calm: 4 }, starReward: 2, heartReward: 5, miniGame: "pick-three", roomHint: "counter", accent: "#ffcc7f" },
  { id: "homework", label: "Learn", icon: "✏️", stages: ["teen"], needFocus: "learning", boosts: { learning: 24, calm: 8 }, starReward: 2, heartReward: 5, miniGame: "tap-fill", roomHint: "notes", accent: "#8db0ff" },
  { id: "music", label: "Music", icon: "🎧", stages: ["teen"], needFocus: "calm", boosts: { calm: 24, fun: 8 }, starReward: 2, heartReward: 5, miniGame: "timing", roomHint: "beats", accent: "#d1a5ff" },
  { id: "sport", label: "Sport", icon: "🏀", stages: ["teen"], needFocus: "fun", boosts: { fun: 20, energy: 12 }, starReward: 2, heartReward: 5, miniGame: "timing", roomHint: "court", accent: "#ffaf76" },
  { id: "hobby", label: "Hobby", icon: "🌱", stages: ["teen"], needFocus: "fun", boosts: { fun: 18, learning: 10 }, starReward: 2, heartReward: 5, miniGame: "collect", roomHint: "desk", accent: "#8fd689" },
  { id: "help-home", label: "Help", icon: "🏡", stages: ["teen"], needFocus: "chores", boosts: { chores: 22, love: 8 }, starReward: 2, heartReward: 5, miniGame: "drag-track", roomHint: "home", accent: "#7fe2da" },
  { id: "chill", label: "Chill", icon: "☁️", stages: ["teen"], needFocus: "calm", boosts: { calm: 24, love: 6 }, starReward: 2, heartReward: 5, miniGame: "hold-fill", roomHint: "bean bag", accent: "#a5c7ff" },

  { id: "work", label: "Work", icon: "🍞", stages: ["grownup", "parent"], needFocus: "chores", boosts: { chores: 24, food: 8 }, starReward: 2, heartReward: 6, miniGame: "timing", roomHint: "shop", accent: "#ffc78c" },
  { id: "cook", label: "Cook", icon: "🍲", stages: ["grownup", "parent"], needFocus: "food", boosts: { food: 22, love: 10 }, starReward: 2, heartReward: 6, miniGame: "pick-three", roomHint: "stove", accent: "#ffa989" },
  { id: "shop", label: "Shop", icon: "🛍️", stages: ["grownup", "parent"], needFocus: "chores", boosts: { chores: 20, calm: 8 }, starReward: 2, heartReward: 6, miniGame: "collect", roomHint: "market", accent: "#9fcbff" },
  { id: "care", label: "Care", icon: "👶", stages: ["grownup", "parent"], needFocus: "love", boosts: { love: 24, calm: 8 }, starReward: 2, heartReward: 7, miniGame: "hold-fill", roomHint: "crib", accent: "#ffa1c9" },
  { id: "home", label: "Home", icon: "🪴", stages: ["grownup", "parent"], needFocus: "chores", boosts: { chores: 22, clean: 10 }, starReward: 2, heartReward: 6, miniGame: "drag-track", roomHint: "plants", accent: "#82d1ae" },
  { id: "family-fun", label: "Fun", icon: "🧺", stages: ["grownup", "parent"], needFocus: "fun", boosts: { fun: 24, love: 8 }, starReward: 2, heartReward: 6, miniGame: "collect", roomHint: "picnic", accent: "#ffd39f" },
  { id: "rest", label: "Rest", icon: "🍵", stages: ["grownup", "parent"], needFocus: "calm", boosts: { calm: 24, energy: 12 }, starReward: 2, heartReward: 6, miniGame: "hold-fill", roomHint: "sofa", accent: "#b9b2ff" },

  { id: "garden", label: "Garden", icon: "🌼", stages: ["grandparent"], needFocus: "calm", boosts: { calm: 20, fun: 8 }, starReward: 2, heartReward: 6, miniGame: "drag-track", roomHint: "garden", accent: "#89d49d" },
  { id: "bake", label: "Bake", icon: "🍪", stages: ["grandparent"], needFocus: "food", boosts: { food: 20, love: 10 }, starReward: 2, heartReward: 6, miniGame: "pick-three", roomHint: "oven", accent: "#ffc485" },
  { id: "story-time", label: "Story", icon: "📚", stages: ["grandparent"], needFocus: "love", boosts: { love: 24, calm: 8 }, starReward: 2, heartReward: 6, miniGame: "tap-fill", roomHint: "chair", accent: "#8db0ff" },
  { id: "craft", label: "Craft", icon: "🧶", stages: ["grandparent"], needFocus: "fun", boosts: { fun: 18, calm: 10 }, starReward: 2, heartReward: 6, miniGame: "timing", roomHint: "basket", accent: "#d0a4ff" },
  { id: "bird-walk", label: "Walk", icon: "🐦", stages: ["grandparent"], needFocus: "fun", boosts: { fun: 20, energy: 10 }, starReward: 2, heartReward: 6, miniGame: "collect", roomHint: "porch", accent: "#82d1d3" },
  { id: "baby-sit", label: "Baby", icon: "🧸", stages: ["grandparent"], needFocus: "love", boosts: { love: 24, calm: 6 }, starReward: 2, heartReward: 7, miniGame: "hold-fill", roomHint: "nursery", accent: "#ffa1c9" },
  { id: "relax", label: "Relax", icon: "☀️", stages: ["grandparent"], needFocus: "calm", boosts: { calm: 24, energy: 10 }, starReward: 2, heartReward: 6, miniGame: "hold-fill", roomHint: "porch", accent: "#ffd089" },
];

export function getActivitiesForStage(stage: ActivityConfig["stages"][number]): ActivityConfig[] {
  return ACTIVITIES.filter((activity) => activity.stages.includes(stage));
}

export function getActivityById(id: ActivityConfig["id"]): ActivityConfig | null {
  return ACTIVITIES.find((activity) => activity.id === id) ?? null;
}
