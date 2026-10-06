// dev.1 in his human form, drawn from boxes: a hoodie with a pocket, a round
// hood opening with a real face in it, Oscar's impostor eyes, arms that can
// wave and point, and legs that walk. Used by the cutscene on dev.1's page
// and by every dev.1 you make in dev.1 Studio. Styles live in main.css.

export interface Dev1Look {
  hoodie: string;
  skin: string;
  eyes: string;
}

// Oscar's impostor eyes, typed out: every \ is a slash going down, every / a
// slash going up, and <> is the diamond in the middle.
// (Each \ is written twice here because that's how code spells one.)
export const IMPOSTOR_EYES = "\\\\/\\\\\\////\\/\\/\\\\\\<>\\///\\\\\\/\\/\\/\\";

export const DEFAULT_LOOK: Dev1Look = { hoodie: "#2fb85a", skin: "#f2c49b", eyes: IMPOSTOR_EYES };

export function impostorEyes(pattern = IMPOSTOR_EYES): string {
  const step = 3;
  const width = Math.max(1, pattern.length) * step;
  let marks = "";
  [...pattern].forEach((mark, i) => {
    const x = i * step;
    if (mark === "\\") marks += `<line x1="${x}" y1="1" x2="${x + step}" y2="11" />`;
    else if (mark === "/") marks += `<line x1="${x}" y1="11" x2="${x + step}" y2="1" />`;
    // The < and > together make one diamond, drawn when we reach the <.
    else if (mark === "<") {
      marks += `<polygon class="dev1-eye-diamond" points="${x},6 ${x + step},0.5 ${x + step * 2},6 ${x + step},11.5" />`;
    }
  });
  return `<svg class="dev1-eyes" viewBox="-1 0 ${width + 2} 12" preserveAspectRatio="none" aria-hidden="true">${marks}</svg>`;
}

// A shade darker than the hoodie, for its sleeves and pocket.
export function darker(hex: string): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(value)) return hex;
  const channel = (shift: number): number => Math.round(((value >> shift) & 255) * 0.6);
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

export function makePerson(look: Dev1Look = DEFAULT_LOOK): HTMLElement {
  const person = document.createElement("div");
  person.className = "dev1-person";
  person.setAttribute("role", "img");
  person.setAttribute("aria-label", "dev.1 in his human form: a person in a hoodie");
  person.innerHTML = `
    <span class="dev1-hood"><span class="dev1-face">${impostorEyes(look.eyes)}</span></span>
    <span class="dev1-body"><span class="dev1-pocket"></span></span>
    <span class="dev1-arm dev1-arm-left"></span>
    <span class="dev1-arm dev1-arm-right"></span>
    <span class="dev1-leg dev1-leg-left"></span>
    <span class="dev1-leg dev1-leg-right"></span>
  `;
  dressPerson(person, look);
  return person;
}

/** Changes a dev.1's colours and eyes without making a new one. */
export function dressPerson(person: HTMLElement, look: Dev1Look): void {
  person.style.setProperty("--hoodie", look.hoodie);
  person.style.setProperty("--hoodie-dark", darker(look.hoodie));
  person.style.setProperty("--skin", look.skin);
  const face = person.querySelector(".dev1-face");
  if (face) face.innerHTML = impostorEyes(look.eyes);
}
