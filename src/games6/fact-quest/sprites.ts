// Pictures for everyone and everything in Quest Mode's world, drawn as little
// SVGs (no emojis). All of them use a 64 × 64 box.

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

export const PIG = svg(`
  <path d="M9 36 q-7 -3 -3 -8 q4 -3 3 3" fill="none" stroke="#c76b84" stroke-width="2.5" stroke-linecap="round"/>
  <rect x="14" y="44" width="7" height="12" rx="3" fill="#e88fa5"/>
  <rect x="24" y="46" width="7" height="11" rx="3" fill="#e88fa5"/>
  <rect x="36" y="46" width="7" height="11" rx="3" fill="#e88fa5"/>
  <rect x="44" y="44" width="7" height="12" rx="3" fill="#e88fa5"/>
  <ellipse cx="30" cy="38" rx="21" ry="15" fill="#f6b3c4" stroke="#c76b84" stroke-width="2"/>
  <path d="M40 21 L42 10 L50 19 Z M52 19 L59 11 L59 23 Z" fill="#e88fa5" stroke="#c76b84" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="49" cy="30" r="12" fill="#f6b3c4" stroke="#c76b84" stroke-width="2"/>
  <ellipse cx="56" cy="33" rx="6" ry="5" fill="#e88fa5" stroke="#c76b84" stroke-width="1.5"/>
  <circle cx="54.5" cy="33" r="1.3" fill="#8a3b52"/><circle cx="58" cy="33" r="1.3" fill="#8a3b52"/>
  <circle cx="48" cy="26" r="2.2" fill="#202029"/><circle cx="48.7" cy="25.3" r="0.7" fill="#fff"/>
  <path d="M42 32 q2 2 4 0" fill="none" stroke="#e07a95" stroke-width="1.5" stroke-linecap="round"/>
`);

export const GOBLIN = svg(`
  <path d="M8 22 L22 28 L18 34 Z M56 22 L42 28 L46 34 Z" fill="#6fae3c" stroke="#3d6b1d" stroke-width="2" stroke-linejoin="round"/>
  <rect x="20" y="42" width="24" height="16" rx="6" fill="#8a5a2b" stroke="#4a2f14" stroke-width="2"/>
  <circle cx="32" cy="30" r="15" fill="#7cc046" stroke="#3d6b1d" stroke-width="2"/>
  <ellipse cx="26" cy="28" rx="4" ry="5" fill="#ffe14d"/><ellipse cx="38" cy="28" rx="4" ry="5" fill="#ffe14d"/>
  <circle cx="26.5" cy="29" r="2" fill="#c0262c"/><circle cx="37.5" cy="29" r="2" fill="#c0262c"/>
  <path d="M24 37 q8 6 16 0" fill="#3d1f12" stroke="#3d6b1d" stroke-width="1.5"/>
  <path d="M27 37 l2 3 l2 -3 M33 37 l2 3 l2 -3" fill="#fff"/>
  <path d="M48 40 L60 26" stroke="#b9c0cc" stroke-width="4" stroke-linecap="round"/>
  <path d="M46 43 L51 38" stroke="#6b4a1e" stroke-width="5" stroke-linecap="round"/>
`);

export const SKELETON = svg(`
  <rect x="22" y="38" width="20" height="20" rx="4" fill="#e9e6dc" stroke="#7d786a" stroke-width="2"/>
  <path d="M25 44 h14 M25 49 h14 M25 54 h14" stroke="#7d786a" stroke-width="2"/>
  <path d="M18 16 Q32 4 46 16 L46 22 L18 22 Z" fill="#8d8f99" stroke="#4b4d56" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="32" cy="27" r="13" fill="#f4f1e8" stroke="#7d786a" stroke-width="2"/>
  <path d="M18 18 Q32 8 46 18" fill="none" stroke="#4b4d56" stroke-width="3"/>
  <ellipse cx="27" cy="27" rx="4" ry="4.5" fill="#202029"/><ellipse cx="37" cy="27" rx="4" ry="4.5" fill="#202029"/>
  <circle cx="27" cy="27" r="1.4" fill="#ff5a4d"/><circle cx="37" cy="27" r="1.4" fill="#ff5a4d"/>
  <path d="M30 33 l2 -2 l2 2 Z" fill="#202029"/>
  <path d="M26 36 h12 M29 35 v3 M32 35 v3 M35 35 v3" stroke="#7d786a" stroke-width="1.5"/>
  <path d="M10 56 L14 30" stroke="#b0832a" stroke-width="3" stroke-linecap="round"/>
  <path d="M14 30 L10 20 L18 24 Z" fill="#c9ced8" stroke="#5d6472" stroke-width="1.5"/>
`);

export const TROLL = svg(`
  <rect x="12" y="36" width="40" height="24" rx="10" fill="#8a7a6a" stroke="#4a3f35" stroke-width="2"/>
  <circle cx="32" cy="28" r="20" fill="#9c8c79" stroke="#4a3f35" stroke-width="2"/>
  <path d="M20 22 q6 -4 10 0 M34 22 q6 -4 10 0" stroke="#4a3f35" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="25" cy="27" r="3.5" fill="#202029"/><circle cx="39" cy="27" r="3.5" fill="#202029"/>
  <ellipse cx="32" cy="34" rx="5" ry="4" fill="#7f6f5f"/>
  <path d="M22 40 q10 6 20 0" fill="none" stroke="#3a2f26" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M24 40 L25 33 L28 40 Z M40 40 L39 33 L36 40 Z" fill="#f4f1e8" stroke="#7d786a" stroke-width="1"/>
  <path d="M54 58 L62 30" stroke="#6b4a1e" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="61" cy="28" rx="5" ry="7" fill="#7a5426" stroke="#4a2f14" stroke-width="2"/>
`);

// An arrow with an angry face. Nobody knows why you have to fight it.
export const ARROW_FOE = svg(`
  <path d="M6 32 L46 32" stroke="#8a5a2b" stroke-width="7" stroke-linecap="round"/>
  <path d="M44 20 L62 32 L44 44 Z" fill="#c9ced8" stroke="#5d6472" stroke-width="2" stroke-linejoin="round"/>
  <path d="M4 22 L14 32 L4 42 M10 22 L20 32 L10 42" fill="none" stroke="#e5383b" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="30" cy="29" r="3" fill="#fff" stroke="#202029"/><circle cx="38" cy="29" r="3" fill="#fff" stroke="#202029"/>
  <circle cx="30.5" cy="29.5" r="1.3" fill="#202029"/><circle cx="38.5" cy="29.5" r="1.3" fill="#202029"/>
  <path d="M26 24 l7 3 M42 24 l-7 3" stroke="#202029" stroke-width="2" stroke-linecap="round"/>
`);

// The purple sky castle's arrows are poison, so they're purple and dripping.
export const POISON_ARROW = svg(`
  <path d="M6 32 L46 32" stroke="#5a2a8a" stroke-width="7" stroke-linecap="round"/>
  <path d="M44 20 L62 32 L44 44 Z" fill="#9b4fe0" stroke="#4a1d75" stroke-width="2" stroke-linejoin="round"/>
  <path d="M4 22 L14 32 L4 42 M10 22 L20 32 L10 42" fill="none" stroke="#9be15d" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="30" cy="29" r="3" fill="#9be15d" stroke="#202029"/><circle cx="38" cy="29" r="3" fill="#9be15d" stroke="#202029"/>
  <circle cx="30.5" cy="29.5" r="1.3" fill="#202029"/><circle cx="38.5" cy="29.5" r="1.3" fill="#202029"/>
  <path d="M26 24 l7 3 M42 24 l-7 3" stroke="#202029" stroke-width="2" stroke-linecap="round"/>
  <path d="M52 44 q2 6 0 8 q-2 -2 0 -8 Z M24 36 q2 6 0 8 q-2 -2 0 -8 Z" fill="#9be15d"/>
`);

// THE VOID: a hole in space with glowing eyes, waiting for anyone who falls.
export const VOID = svg(`
  <defs>
    <radialGradient id="void-hole" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000"/>
      <stop offset="70%" stop-color="#1d0b33"/>
      <stop offset="100%" stop-color="#5a2a8a"/>
    </radialGradient>
  </defs>
  <path d="M32 4 C48 4 60 14 60 30 C60 46 52 60 32 60 C14 60 4 48 4 32 C4 16 16 4 32 4 Z" fill="url(#void-hole)" stroke="#9b4fe0" stroke-width="2"/>
  <path d="M14 18 Q30 10 44 16 M50 28 Q54 44 40 52 M22 52 Q8 44 12 30" fill="none" stroke="#c59bff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <path d="M18 28 L28 31 L18 35 Z M46 28 L36 31 L46 35 Z" fill="#e5383b"/>
  <circle cx="23" cy="31" r="1.5" fill="#fff"/><circle cx="41" cy="31" r="1.5" fill="#fff"/>
  <path d="M22 44 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0" fill="none" stroke="#c59bff" stroke-width="2.5" stroke-linecap="round"/>
`);

// A villager: robe colour, skin, and a hat that says what they sell.
function person(robe: string, skin: string, hat: string, extra = ""): string {
  return svg(`
    <path d="M16 60 Q18 34 32 34 Q46 34 48 60 Z" fill="${robe}" stroke="#2b2b33" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="32" cy="24" r="12" fill="${skin}" stroke="#2b2b33" stroke-width="2"/>
    <circle cx="27.5" cy="24" r="1.8" fill="#202029"/><circle cx="36.5" cy="24" r="1.8" fill="#202029"/>
    <path d="M27 30 q5 4 10 0" fill="none" stroke="#2b2b33" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="24" cy="28" r="2" fill="#f4a1a1" opacity="0.7"/><circle cx="40" cy="28" r="2" fill="#f4a1a1" opacity="0.7"/>
    ${hat}${extra}
  `);
}

export const FARMER = person(
  "#6fae3c",
  "#f2c9a0",
  `<ellipse cx="32" cy="14" rx="20" ry="5" fill="#e8c96a" stroke="#9c7b24" stroke-width="2"/>
   <path d="M22 14 Q32 0 42 14 Z" fill="#e8c96a" stroke="#9c7b24" stroke-width="2"/>
   <path d="M22 13 h20" stroke="#c0453a" stroke-width="2.5"/>`,
  `<rect x="24" y="44" width="16" height="14" rx="3" fill="#f6f1d9" stroke="#2b2b33" stroke-width="1.5"/>`
);

export const SMITH = person(
  "#7a5a3a",
  "#c98f63",
  `<path d="M20 18 Q32 4 44 18 Z" fill="#2b2b33"/>`,
  `<rect x="22" y="40" width="20" height="18" rx="3" fill="#4a3f35" stroke="#2b2b33" stroke-width="1.5"/>
   <path d="M50 58 L50 38" stroke="#6b4a1e" stroke-width="3" stroke-linecap="round"/>
   <rect x="44" y="32" width="12" height="7" rx="2" fill="#8d8f99" stroke="#2b2b33" stroke-width="1.5"/>`
);

export const WITCH = person(
  "#7a4fd6",
  "#d9f2c4",
  `<path d="M14 16 h36" stroke="#3b2470" stroke-width="5" stroke-linecap="round"/>
   <path d="M20 15 L36 -2 L44 15 Z" fill="#4a2f8f" stroke="#3b2470" stroke-width="2" stroke-linejoin="round"/>
   <circle cx="35" cy="6" r="2" fill="#ffd84d"/>`,
  `<path d="M44 46 h10 l-2 12 h-6 Z" fill="#9be15d" stroke="#2b2b33" stroke-width="1.5"/>`
);

export const JESTER = person(
  "#e5383b",
  "#f2c9a0",
  `<path d="M18 16 L10 2 L26 12 Z" fill="#ffd84d" stroke="#2b2b33" stroke-width="1.5"/>
   <path d="M26 13 L32 0 L38 13 Z" fill="#3c78d8" stroke="#2b2b33" stroke-width="1.5"/>
   <path d="M46 16 L54 2 L38 12 Z" fill="#6fae3c" stroke="#2b2b33" stroke-width="1.5"/>
   <circle cx="10" cy="2" r="3" fill="#e5383b"/><circle cx="32" cy="0" r="3" fill="#ffd84d"/><circle cx="54" cy="2" r="3" fill="#7a4fd6"/>`,
  `<path d="M16 60 L24 40 L32 60 Z" fill="#ffd84d" opacity="0.8"/><path d="M32 60 L40 40 L48 60 Z" fill="#3c78d8" opacity="0.8"/>`
);

// --- The Purple Woods ---

export const BANDIT = person(
  "#3b3b46",
  "#e0b48c",
  `<path d="M19 18 Q32 6 45 18 L45 20 L19 20 Z" fill="#c0262c" stroke="#2b2b33" stroke-width="2"/>
   <path d="M45 18 L54 14 L50 22 Z" fill="#c0262c" stroke="#2b2b33" stroke-width="1.5"/>
   <rect x="20" y="20" width="24" height="7" rx="3" fill="#202029"/>
   <circle cx="27.5" cy="23.5" r="1.8" fill="#fff"/><circle cx="36.5" cy="23.5" r="1.8" fill="#fff"/>
   <path d="M25 31 q7 -3 14 0" fill="none" stroke="#2b2b33" stroke-width="2" stroke-linecap="round"/>`,
  `<path d="M50 56 L58 40" stroke="#c9ced8" stroke-width="4" stroke-linecap="round"/>
   <path d="M48 58 L52 52" stroke="#6b4a1e" stroke-width="5" stroke-linecap="round"/>`
);

// A swamp crocodile, snapping.
export const SNAPPER = svg(`
  <path d="M4 40 Q10 26 30 26 L58 30 Q62 34 58 38 L34 40 L58 44 Q62 50 56 52 L30 54 Q10 54 4 40 Z" fill="#4f8f3a" stroke="#2c5a1f" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M34 39 l4 -4 l4 4 l4 -4 l4 4 l4 -4 M34 41 l4 4 l4 -4 l4 4 l4 -4 l4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="22" cy="28" r="6" fill="#4f8f3a" stroke="#2c5a1f" stroke-width="2"/>
  <circle cx="22" cy="27" r="3.5" fill="#ffe14d"/><rect x="21" y="24.5" width="2" height="5" rx="1" fill="#202029"/>
  <path d="M8 46 q8 4 18 2" fill="none" stroke="#2c5a1f" stroke-width="2"/>
  <circle cx="57" cy="32" r="1.5" fill="#2c5a1f"/>
`);

export const WIZARD = svg(`
  <path d="M12 62 Q14 30 32 26 Q50 30 52 62 Z" fill="#3b2470" stroke="#1d1238" stroke-width="2" stroke-linejoin="round"/>
  <path d="M18 34 Q32 0 46 34 Q32 28 18 34 Z" fill="#4a2f8f" stroke="#1d1238" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="32" cy="30" rx="10" ry="8" fill="#1d1238"/>
  <circle cx="28" cy="29" r="2.5" fill="#c59bff"/><circle cx="36" cy="29" r="2.5" fill="#c59bff"/>
  <path d="M26 46 q6 -3 12 0" stroke="#c59bff" stroke-width="2" fill="none" opacity="0.6"/>
  <path d="M54 62 L56 16" stroke="#6b4a1e" stroke-width="4" stroke-linecap="round"/>
  <circle cx="56" cy="13" r="6" fill="#c59bff" stroke="#6b3fb5" stroke-width="2"/>
  <circle cx="54" cy="11" r="2" fill="#fff"/>
`);

export const MUSHROOM_MAN = person(
  "#d9a066",
  "#f2c9a0",
  `<path d="M8 20 Q32 -6 56 20 Q32 14 8 20 Z" fill="#e5383b" stroke="#2b2b33" stroke-width="2" stroke-linejoin="round"/>
   <circle cx="22" cy="10" r="3" fill="#fff"/><circle cx="34" cy="6" r="3.5" fill="#fff"/><circle cx="45" cy="12" r="2.5" fill="#fff"/>`,
  `<path d="M42 50 h12 l-2 9 h-8 Z" fill="#f4a1d0" stroke="#2b2b33" stroke-width="1.5"/>`
);

export const OWL = svg(`
  <ellipse cx="32" cy="38" rx="20" ry="22" fill="#9c7b55" stroke="#4a3520" stroke-width="2"/>
  <ellipse cx="32" cy="44" rx="12" ry="14" fill="#e8d3b0"/>
  <path d="M14 22 L18 8 L26 18 Z M50 22 L46 8 L38 18 Z" fill="#7a5c3a" stroke="#4a3520" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="24" cy="28" r="8" fill="#fff" stroke="#4a3520" stroke-width="2"/><circle cx="40" cy="28" r="8" fill="#fff" stroke="#4a3520" stroke-width="2"/>
  <circle cx="24" cy="28" r="4" fill="#202029"/><circle cx="40" cy="28" r="4" fill="#202029"/>
  <path d="M29 34 L32 40 L35 34 Z" fill="#e8b923" stroke="#8a6a12" stroke-width="1.5"/>
  <circle cx="40" cy="28" r="9" fill="none" stroke="#e8b923" stroke-width="2"/>
  <path d="M20 58 l3 4 M26 59 l2 4 M38 59 l-2 4 M44 58 l-3 4" stroke="#e8b923" stroke-width="2.5" stroke-linecap="round"/>
`);

export const PURPLE_SMITH = person(
  "#7a4fd6",
  "#c98f63",
  `<path d="M20 18 Q32 4 44 18 Z" fill="#3b2470"/>`,
  `<rect x="22" y="40" width="20" height="18" rx="3" fill="#4a2f8f" stroke="#2b2b33" stroke-width="1.5"/>
   <path d="M50 58 L50 38" stroke="#6b4a1e" stroke-width="3" stroke-linecap="round"/>
   <path d="M46 30 L54 30 L56 38 L44 38 Z" fill="#c59bff" stroke="#2b2b33" stroke-width="1.5"/>`
);

// --- The Badlands ---

export const EMBER = person(
  "#c0392b",
  "#c98f63",
  `<path d="M20 18 Q32 2 44 18 Z" fill="#ff8a00"/><path d="M26 12 Q32 -4 38 12" fill="#ffd200"/>`,
  `<rect x="22" y="40" width="20" height="18" rx="3" fill="#5a2a1a" stroke="#2b2b33" stroke-width="1.5"/>
   <path d="M50 58 L52 34" stroke="#6b4a1e" stroke-width="3" stroke-linecap="round"/>
   <path d="M52 34 L48 22 L56 26 Z" fill="#ff8a00" stroke="#c0392b" stroke-width="1.5"/>`
);

export const DUSTY = person(
  "#9c7b55",
  "#e0b48c",
  `<ellipse cx="32" cy="15" rx="20" ry="4.5" fill="#7a5c3a" stroke="#4a3520" stroke-width="2"/>
   <path d="M22 15 Q24 2 32 3 Q40 2 42 15 Z" fill="#7a5c3a" stroke="#4a3520" stroke-width="2"/>`,
  `<path d="M10 58 L18 36" stroke="#6b4a1e" stroke-width="3" stroke-linecap="round"/>
   <path d="M12 38 Q18 30 26 36" fill="none" stroke="#8d94a3" stroke-width="4" stroke-linecap="round"/>
   <path d="M26 36 Q32 30 36 38" fill="none" stroke="#8d94a3" stroke-width="2"/>`
);

export const CINDER = person(
  "#e67e22",
  "#f2c9a0",
  `<ellipse cx="32" cy="14" rx="22" ry="5" fill="#a0652d" stroke="#4a2f14" stroke-width="2"/>
   <path d="M20 14 Q22 0 32 2 Q42 0 44 14 Z" fill="#a0652d" stroke="#4a2f14" stroke-width="2"/>
   <path d="M21 11 h22" stroke="#e5383b" stroke-width="2.5"/>`,
  `<path d="M22 32 L32 40 L42 32 Z" fill="#e5383b" stroke="#2b2b33" stroke-width="1.5"/>`
);

// The owl hiding in the Badlands: smaller and darker than Old Owl, with a
// little pink bow.
export const HIDING_OWL = svg(`
  <ellipse cx="32" cy="40" rx="18" ry="20" fill="#5a4636" stroke="#2b2018" stroke-width="2"/>
  <ellipse cx="32" cy="45" rx="10" ry="12" fill="#c9b08a"/>
  <path d="M16 24 L19 11 L26 20 Z M48 24 L45 11 L38 20 Z" fill="#4a3828" stroke="#2b2018" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="25" cy="31" r="7.5" fill="#fff" stroke="#2b2018" stroke-width="2"/><circle cx="39" cy="31" r="7.5" fill="#fff" stroke="#2b2018" stroke-width="2"/>
  <circle cx="26" cy="32" r="3.8" fill="#202029"/><circle cx="38" cy="32" r="3.8" fill="#202029"/>
  <path d="M29 37 L32 42 L35 37 Z" fill="#e8b923" stroke="#8a6a12" stroke-width="1.5"/>
  <path d="M42 16 L48 12 L48 20 Z M54 16 L48 12 L48 20 Z" fill="#ff7ab6" stroke="#b03a72" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="48" cy="16" r="2.5" fill="#ff7ab6" stroke="#b03a72" stroke-width="1.5"/>
`);

export const CHEST = svg(`
  <rect x="10" y="26" width="44" height="28" rx="3" fill="#a0652d" stroke="#4a2f14" stroke-width="2.5"/>
  <path d="M10 26 Q32 10 54 26 Z" fill="#b97636" stroke="#4a2f14" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M10 34 h44" stroke="#4a2f14" stroke-width="2"/>
  <path d="M20 20 v34 M44 20 v34" stroke="#e8b923" stroke-width="4"/>
  <rect x="28" y="30" width="8" height="9" rx="2" fill="#e8b923" stroke="#8a6a12" stroke-width="1.5"/>
`);

export const CHEST_OPEN = svg(`
  <path d="M12 10 L52 10 L54 26 L10 26 Z" fill="#b97636" stroke="#4a2f14" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="10" y="26" width="44" height="28" rx="3" fill="#a0652d" stroke="#4a2f14" stroke-width="2.5"/>
  <ellipse cx="32" cy="28" rx="20" ry="5" fill="#3a2410"/>
  <circle cx="24" cy="27" r="3" fill="#ffd84d"/><circle cx="31" cy="25" r="3" fill="#ffd84d"/><circle cx="38" cy="27" r="3" fill="#ffd84d"/>
  <path d="M20 26 v28 M44 26 v28" stroke="#e8b923" stroke-width="4"/>
`);

export const GEM = svg(`
  <path d="M32 6 L54 24 L32 58 L10 24 Z" fill="#4fc3f7" stroke="#0d6fa3" stroke-width="3" stroke-linejoin="round"/>
  <path d="M10 24 H54 M32 6 L24 24 L32 58 L40 24 Z" fill="none" stroke="#0d6fa3" stroke-width="2" stroke-linejoin="round"/>
  <path d="M20 16 L26 12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
`);

export const CRYSTAL = svg(`
  <path d="M30 4 L40 20 L36 58 L24 58 L20 20 Z" fill="#c59bff" stroke="#6b3fb5" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M14 26 L22 32 L22 58 L12 58 L10 34 Z" fill="#a77cf0" stroke="#6b3fb5" stroke-width="2" stroke-linejoin="round"/>
  <path d="M46 22 L54 34 L52 58 L40 58 L40 32 Z" fill="#b48cf8" stroke="#6b3fb5" stroke-width="2" stroke-linejoin="round"/>
  <path d="M28 12 L26 40" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
`);

const images = new Map<string, HTMLImageElement>();

// The same SVG as a picture the canvas can draw (made once, then reused).
export function spriteImage(source: string): HTMLImageElement {
  let image = images.get(source);
  if (!image) {
    image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source.includes("xmlns") ? source : source.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
    images.set(source, image);
  }
  return image;
}
