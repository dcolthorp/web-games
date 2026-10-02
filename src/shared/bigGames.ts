// What the BIG games page is allowed to know about you: which secret games
// you've found, and whether you've ever been through the lost door.

const FOUND_KEY = "big-games-found";
const BEEN_LOST_KEY = "big-games-been-lost";

function readFound(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(FOUND_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/** Call from a secret game's page: opening it counts as finding it. */
export function markFound(id: string): void {
  const found = readFound();
  if (found.includes(id)) return;
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify([...found, id]));
  } catch {
    // Can't remember it, so it stays a secret.
  }
}

export function wasFound(id: string): boolean {
  return readFound().includes(id);
}

export function markBeenLost(): void {
  try {
    localStorage.setItem(BEEN_LOST_KEY, "true");
  } catch {
    // Then you were never really lost.
  }
}

export function hasBeenLost(): boolean {
  try {
    return localStorage.getItem(BEEN_LOST_KEY) === "true";
  } catch {
    return false;
  }
}

// GIGANTIC games: drag B, I and G off the BIG games title onto a game and it
// goes gigantic for good. In a gigantic game the main stuff (you, the
// stickmen, the player) stays normal size and everything else goes giant, like
// the camera is super zoomed out on a giant world.

const GIGANTIC_KEY = "big-games-gigantic";

export function giganticGames(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(GIGANTIC_KEY) ?? "[]");
    // It used to hold just one game's id.
    if (typeof stored === "string") return [stored];
    return Array.isArray(stored) ? stored : [];
  } catch {
    const single = localStorage.getItem(GIGANTIC_KEY);
    return single ? [single] : [];
  }
}

export function makeGigantic(id: string): void {
  const all = giganticGames();
  if (all.includes(id)) return;
  try {
    localStorage.setItem(GIGANTIC_KEY, JSON.stringify([...all, id]));
  } catch {
    // Then it can only be gigantic in your heart.
  }
}

/** Ask this from inside a game: is it gigantic right now? */
export function isGigantic(id: string): boolean {
  return new URLSearchParams(window.location.search).has("gigantic") || giganticGames().includes(id);
}
