import { CELESTIAL, CREATURES } from "./creatures";
import { APARTMENT, PERSON, VILLAGE } from "./folk";
import { DISASTERS, LAND } from "./land";
import { LIFE } from "./life";
import { COPY, MATRIX_ICON } from "./matrix";
import { CAVE } from "./ores";
import { BOMB_CHOICES } from "./bombs";
import { MUTANT, TECH_CHOICES } from "./tech";
import type { Choice, Sprite } from "./sprites";

// Everything you can put in the world, by toolbar category. People and Tribes
// get extra controls in the toolbar for picking and making tribes, and the
// Matrix gets switches for breaking physics.
export const CATEGORIES: { name: string; choices: Choice[]; icon?: Sprite }[] = [
  { name: "Land", choices: LAND },
  { name: "Life", choices: LIFE },
  { name: "People", choices: [PERSON, MUTANT] },
  { name: "Tribes", choices: [VILLAGE, APARTMENT] },
  { name: "Caves", choices: [CAVE] },
  { name: "Tech", choices: TECH_CHOICES },
  { name: "Disasters", choices: DISASTERS },
  { name: "Creatures", choices: CREATURES },
  { name: "Celestial", choices: CELESTIAL },
  { name: "Matrix", choices: [COPY], icon: MATRIX_ICON },
];

// Bombs only exist inside caves, so they are not in any of the world's
// toolbars, but they still need to be a kind of thing the game knows.
export const CHOICES = new Map([...CATEGORIES.flatMap((c) => c.choices), ...BOMB_CHOICES].map((c) => [c.id, c]));

// The toolbars you get while you are standing inside a mountain. The cave's
// own tools come first, then everything you could put in a world, because a
// tribe can live down here just as well as up there.
export const CAVE_CATEGORIES = ["Dig", "Crystals", "Bombs", "Land", "Life", "People", "Tribes", "Tech", "Creatures"];
export const MAGIC = new Set([...CREATURES, ...CELESTIAL].map((c) => c.id));
export const CELESTIAL_IDS = new Set(CELESTIAL.map((c) => c.id));
// Things that wander around on their own. People move with their own rules.
export const MOVERS = new Set([...LIFE.map((c) => c.id), ...MAGIC]);
export const TECH_IDS_SET = new Set(TECH_CHOICES.map((c) => c.id));
