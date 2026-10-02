import { isGigantic } from "../../shared/bigGames";

// GIGANTIC Holden's Game: you stay your normal size and everything else is
// giant, so the worlds look zoomed right in around a tiny you.
const VISIT_KEY = "holdens-game-gigantic-visit";

// Coming in with ?gigantic (like through a GIGANTIC beatboxer) only marks the
// first page, so it's remembered for the rest of the visit as you go between
// the menu, the worlds and the shop. Walking in from anywhere else starts a
// normal visit again.
function cameInGigantic(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has("gigantic")) {
      sessionStorage.setItem(VISIT_KEY, "true");
      return true;
    }
    if (!document.referrer.includes("/holdens-game/")) sessionStorage.removeItem(VISIT_KEY);
    return sessionStorage.getItem(VISIT_KEY) === "true";
  } catch {
    return false;
  }
}

// Ask cameInGigantic first, so a ?gigantic arrival always gets remembered.
export const GIGANTIC = cameInGigantic() || isGigantic("holdens-game");
export const GIANT = GIGANTIC ? 2.5 : 1;

export const giganticName = (name: string): string => (GIGANTIC ? `GIGANTIC ${name}` : name);

// The menus just put GIGANTIC in front of their own heading and title.
export function nameThisPage(): void {
  if (!GIGANTIC) return;
  document.title = giganticName(document.title);
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = giganticName(heading.textContent ?? "");
}
