export interface Vibe {
  name: string;
  hint: string;
}

// There's no prompt to draw. There's a vibe, and you figure out what that
// means to you. Whoever gets your paper next has to figure it out too.
const WEIRDCORE: Vibe = { name: "WEIRDCORE", hint: "Wrong on purpose. Too many eyes. Bad JPEG." };

export const VIBES: Vibe[] = [
  WEIRDCORE,
  { name: "DREAMCORE", hint: "You've been here before, in a dream, badly." },
  { name: "LIMINAL", hint: "A hallway at 3am with nobody in it." },
  { name: "COTTAGECORE", hint: "Mushrooms, bread, a very soft afternoon." },
  { name: "VAPORWAVE", hint: "Pink grids, dead malls, a Roman statue." },
  { name: "GOBLINCORE", hint: "Shiny junk in the mud. Frogs welcome." },
  { name: "FRUTIGER AERO", hint: "Glossy bubbles, blue sky, a 2007 desktop." },
  { name: "DEEP SEA", hint: "Way too far down. Something glows." },
  { name: "STATIC", hint: "The channel that isn't a channel." },
  { name: "SPACE JUNK", hint: "Broken satellites and a very small planet." },
  { name: "SLIME", hint: "It's moving. It shouldn't be." },
  { name: "MEGA CITY", hint: "Towers, wires, rain, one lonely sign." },
  { name: "HAUNTED ARCADE", hint: "Every machine is on. Nobody's playing." },
  { name: "MONSTER PICNIC", hint: "Teeth, sandwiches, a checkered blanket." },
  { name: "CANDY PLANET", hint: "Everything is edible and nothing is safe." },
  { name: "ROBOT ZOO", hint: "Animals made of spare parts, in cages." },
  { name: "UPSIDE DOWN", hint: "Gravity quit. Draw what happened next." },
  { name: "ICE WORLD", hint: "Blue on blue on blue, and one warm thing." },
  { name: "MELTING", hint: "Whatever you draw, it's dripping." },
  { name: "TINY GIANT", hint: "Something huge where it doesn't fit." },
];

export function rollVibe(previous?: string): Vibe {
  const options = VIBES.filter((vibe) => vibe.name !== previous);
  const pool = options.length > 0 ? options : VIBES;
  return pool[Math.floor(Math.random() * pool.length)] ?? WEIRDCORE;
}
