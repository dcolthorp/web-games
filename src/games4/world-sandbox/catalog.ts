import { CELESTIAL, CREATURES } from "./creatures";
import { PERSON, VILLAGE } from "./folk";
import { DISASTERS, LAND } from "./land";
import { LIFE } from "./life";
import { COPY, MATRIX_ICON } from "./matrix";
import { CAVE } from "./ores";
import type { Choice, Sprite } from "./sprites";

// Everything you can put in the world, by toolbar category. People and Tribes
// get extra controls in the toolbar for picking and making tribes, and the
// Matrix gets switches for breaking physics.
export const CATEGORIES: { name: string; choices: Choice[]; icon?: Sprite }[] = [
  { name: "Land", choices: LAND },
  { name: "Life", choices: LIFE },
  { name: "People", choices: [PERSON] },
  { name: "Tribes", choices: [VILLAGE] },
  { name: "Caves", choices: [CAVE] },
  { name: "Disasters", choices: DISASTERS },
  { name: "Creatures", choices: CREATURES },
  { name: "Celestial", choices: CELESTIAL },
  { name: "Matrix", choices: [COPY], icon: MATRIX_ICON },
];

export const CHOICES = new Map(CATEGORIES.flatMap((c) => c.choices).map((c) => [c.id, c]));
export const MAGIC = new Set([...CREATURES, ...CELESTIAL].map((c) => c.id));
export const CELESTIAL_IDS = new Set(CELESTIAL.map((c) => c.id));
// Things that wander around on their own. People move with their own rules.
export const MOVERS = new Set([...LIFE.map((c) => c.id), ...MAGIC]);
