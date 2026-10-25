// Olly, the quest companion: a black cat with purple ears, big lime eyes and
// a little smile. Once the four math tiles crash into him he turns blue, with
// red eyes and a red mohawk. In Quest Mode he's a warrior, with a helmet and a
// sword.
export function ollySvg(look: "normal" | "blue" | "warrior" = "normal"): string {
  const blue = look === "blue";
  const warrior = look === "warrior";
  const skin = blue ? "#3c78d8" : "#202029";
  // Helmet with a red plume, drawn after the head so it sits on top.
  const helmet = `
    <path d="M100 2 Q122 6 118 30 Q108 18 100 24 Q92 18 82 30 Q78 6 100 2 Z" fill="#e5383b" stroke="#a51d22" stroke-width="2"/>
    <path d="M54 62 Q56 26 100 24 Q144 26 146 62 Q100 48 54 62 Z" fill="#c9ced8" stroke="#5d6472" stroke-width="3" stroke-linejoin="round"/>
    <path d="M96 50 L104 50 102 74 98 74 Z" fill="#c9ced8" stroke="#5d6472" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="70" cy="52" r="3" fill="#5d6472"/><circle cx="130" cy="52" r="3" fill="#5d6472"/>`;
  const sword = `
    <g class="olly-sword">
      <path d="M150 168 L192 48 L198 52 L160 172 Z" fill="#e4e8ef" stroke="#5d6472" stroke-width="2" stroke-linejoin="round"/>
      <path d="M140 160 L172 174" stroke="#b0832a" stroke-width="7" stroke-linecap="round"/>
      <path d="M156 170 L150 188" stroke="#6b4a1e" stroke-width="7" stroke-linecap="round"/>
    </g>`;
  return `
  <svg class="olly${blue ? " olly-blue" : ""}${warrior ? " olly-warrior" : ""}" viewBox="0 0 200 190" role="img" aria-label="${blue ? "Blue Olly with a red mohawk" : warrior ? "Olly the warrior cat" : "Olly the black cat"}">
    ${blue ? '<path d="M82 50 L84 16 93 34 100 2 107 34 116 16 118 50 Z" fill="#e5383b" stroke="#a51d22" stroke-width="2" stroke-linejoin="round"/>' : ""}
    <path d="M34 72 L25 12 76 44 Q103 35 128 44 L177 12 168 78 Q192 145 141 158 L140 177 64 177 64 158 Q9 143 34 72" fill="${skin}"/>
    <path d="M40 33 L47 65 65 51 Z M163 33 L153 65 136 51 Z" fill="${blue ? "#2a56a8" : "#b5a2f1"}" stroke="${blue ? "#2a56a8" : "#b5a2f1"}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="72" cy="96" rx="22" ry="26" fill="${blue ? "#e5383b" : "#d8f361"}"/>
    <ellipse cx="128" cy="96" rx="22" ry="26" fill="${blue ? "#e5383b" : "#d8f361"}"/>
    <ellipse cx="74" cy="100" rx="10" ry="16" fill="#202029"/>
    <ellipse cx="126" cy="100" rx="10" ry="16" fill="#202029"/>
    <circle cx="79" cy="90" r="4.5" fill="#fff"/>
    <circle cx="131" cy="90" r="4.5" fill="#fff"/>
    <path d="M93 114 L107 114 100 121Z" fill="${blue ? "#e5383b" : "#b5a2f1"}"/>
    <path d="M100 121 Q86 137 79 126 M100 121 Q114 137 121 126" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M48 118 L14 111 M48 127 L12 131 M152 118 L186 111 M152 127 L188 131" stroke="#202029" stroke-width="3" stroke-linecap="round"/>
    ${warrior ? helmet + sword : ""}
  </svg>`;
}

// Cosmetics from the bunker's metal box, worn over warrior Olly. With every
// Geometry Dash one on at once, Olly just becomes a Geometry Dash cube.
// Cosmetics marked "shop" are bought from Cinder in the Badlands instead.
export const COSMETICS: { id: string; name: string; geometryDash: boolean; shop?: true; art: string }[] = [
  {
    id: "gd-headset",
    name: "Geometry Dash headset",
    geometryDash: true,
    art: `
      <path d="M40 92 Q40 18 100 18 Q160 18 160 92" fill="none" stroke="#202029" stroke-width="10" stroke-linecap="round"/>
      <path d="M40 92 Q40 18 100 18 Q160 18 160 92" fill="none" stroke="#00e5ff" stroke-width="4" stroke-linecap="round"/>
      <rect x="22" y="78" width="28" height="36" rx="6" fill="#202029" stroke="#00e5ff" stroke-width="4"/>
      <rect x="150" y="78" width="28" height="36" rx="6" fill="#202029" stroke="#00e5ff" stroke-width="4"/>
      <path d="M36 112 Q44 140 78 138" fill="none" stroke="#202029" stroke-width="5" stroke-linecap="round"/>
      <rect x="74" y="132" width="12" height="10" rx="3" fill="#00e5ff" stroke="#202029" stroke-width="2"/>`,
  },
  {
    id: "gd-mask",
    name: "Geometry Dash mask",
    geometryDash: true,
    art: `
      <rect x="54" y="66" width="92" height="82" rx="4" fill="#ffc21a" stroke="#202029" stroke-width="5"/>
      <rect x="68" y="80" width="20" height="20" fill="#00e5ff" stroke="#202029" stroke-width="5"/>
      <rect x="112" y="80" width="20" height="20" fill="#00e5ff" stroke="#202029" stroke-width="5"/>
      <rect x="66" y="114" width="68" height="18" fill="#00e5ff" stroke="#202029" stroke-width="5"/>`,
  },
  {
    id: "party-hat",
    name: "Party hat",
    geometryDash: false,
    art: `
      <path d="M78 50 L100 0 L122 50 Z" fill="#ff7ab6" stroke="#202029" stroke-width="3" stroke-linejoin="round"/>
      <path d="M86 32 L114 32 M82 42 L118 42" stroke="#ffd84d" stroke-width="4"/>
      <circle cx="100" cy="2" r="7" fill="#ffd84d" stroke="#202029" stroke-width="2"/>`,
  },
  {
    id: "shades",
    name: "Sunglasses",
    geometryDash: false,
    art: `
      <path d="M44 84 H156" stroke="#202029" stroke-width="5"/>
      <rect x="48" y="80" width="46" height="30" rx="10" fill="#202029"/>
      <rect x="106" y="80" width="46" height="30" rx="10" fill="#202029"/>
      <path d="M56 88 L68 88" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
  },
  {
    id: "cowboy-hat",
    name: "Cowboy hat",
    geometryDash: false,
    shop: true,
    art: `
      <ellipse cx="100" cy="46" rx="74" ry="14" fill="#a0652d" stroke="#4a2f14" stroke-width="4"/>
      <path d="M62 46 Q64 4 100 8 Q136 4 138 46 Z" fill="#b97636" stroke="#4a2f14" stroke-width="4" stroke-linejoin="round"/>
      <path d="M64 38 H136" stroke="#e5383b" stroke-width="6"/>`,
  },
  {
    id: "bandana",
    name: "Badlands bandana",
    geometryDash: false,
    shop: true,
    art: `
      <path d="M44 118 Q100 112 156 118 L100 168 Z" fill="#e5383b" stroke="#8e1f22" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="80" cy="128" r="3" fill="#fff"/><circle cx="100" cy="140" r="3" fill="#fff"/><circle cx="120" cy="128" r="3" fill="#fff"/>`,
  },
];

// A Geometry Dash cube: orange-yellow, with a cyan face.
const GD_CUBE = `
  <svg class="olly olly-cube" viewBox="0 0 200 190" role="img" aria-label="Olly as a Geometry Dash cube">
    <defs>
      <linearGradient id="gd-cube" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd200"/>
        <stop offset="100%" stop-color="#ff8a00"/>
      </linearGradient>
    </defs>
    <rect x="22" y="14" width="156" height="156" fill="url(#gd-cube)" stroke="#202029" stroke-width="8"/>
    <rect x="58" y="56" width="30" height="30" fill="#00e5ff" stroke="#202029" stroke-width="7"/>
    <rect x="112" y="56" width="30" height="30" fill="#00e5ff" stroke="#202029" stroke-width="7"/>
    <rect x="50" y="108" width="100" height="26" fill="#00e5ff" stroke="#202029" stroke-width="7"/>
  </svg>`;

// Warrior Olly wearing whatever cosmetics are switched on.
export function ollyLook(wearing: string[]): string {
  const geometryDash = COSMETICS.filter((c) => c.geometryDash);
  if (geometryDash.every((c) => wearing.includes(c.id))) return GD_CUBE;
  const extras = COSMETICS.filter((c) => wearing.includes(c.id))
    .map((c) => c.art)
    .join("");
  return ollySvg("warrior").replace(/<\/svg>\s*$/, `${extras}</svg>`);
}
