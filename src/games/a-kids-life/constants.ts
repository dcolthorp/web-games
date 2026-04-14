export const LOGICAL_WIDTH = 1200;
export const LOGICAL_HEIGHT = 760;
export const STORAGE_VERSION = 1;

export const STORAGE_KEYS = {
  version: "aKidsLife.version",
  saves: "aKidsLife.saves",
  save: (id: string) => `aKidsLife.save.${id}`,
};

export const SIMPLE_FONT = '"Trebuchet MS", "Gill Sans", sans-serif';

export const STAGE_ORDER = [
  "baby",
  "toddler",
  "kid",
  "teen",
  "grownup",
  "parent",
  "grandparent",
] as const;

export const STAGE_THRESHOLDS = {
  baby: 6,
  toddler: 7,
  kid: 8,
  teen: 9,
  grownup: 8,
  parent: 10,
  grandparent: 10,
} as const;

export const MAX_ACTIVE_SAVES = 6;

export const BOY_NAMES = ["Max", "Leo", "Noah", "Finn", "Milo", "Owen", "Theo", "Ben"];
export const GIRL_NAMES = ["Luna", "Mia", "Ruby", "Ivy", "Nora", "Ella", "Zoe", "June"];
export const SAVE_TITLES = ["Sun House", "Cloud Nest", "Happy Home", "Star Place", "Cozy Town"];
