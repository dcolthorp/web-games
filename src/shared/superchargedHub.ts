// Which hub dev.1's "System" supercharged last. That hub stays blue and
// SUPERCHARGED from then on, until another one takes its place.

const SUPERCHARGED_HUB_KEY = "dev1-supercharged-hub";
// The games that hub links to, written down each time the hub is visited, so
// they glow too however you get to them.
const SUPERCHARGED_GAMES_KEY = "dev1-supercharged-games";
// The Supercharged Paradox: walk from a supercharged hub to another hub and the
// charge comes with you. These are the hubs it has spread to.
const PARADOX_HUBS_KEY = "dev1-paradox-hubs";
// Set just before you walk through, so the hub you arrive at can say so.
const PARADOX_ARRIVAL_KEY = "dev1-paradox-arrival";

// "/games2/" and "/games2/index.html" are the same page.
function normalise(pathname: string): string {
  return pathname.replace(/index\.html$/, "");
}

export function rememberSuperchargedHub(url: string): void {
  try {
    localStorage.setItem(SUPERCHARGED_HUB_KEY, normalise(new URL(url, window.location.href).pathname));
    // A new hub means a new set of games; the hub fills it in on its next visit.
    // The paradox starts over from the new hub too.
    localStorage.removeItem(SUPERCHARGED_GAMES_KEY);
    localStorage.removeItem(PARADOX_HUBS_KEY);
  } catch {
    // Can't remember it, so the charge wears off.
  }
}

export function isThisHubSupercharged(): boolean {
  const here = normalise(window.location.pathname);
  try {
    return localStorage.getItem(SUPERCHARGED_HUB_KEY) === here || readList(PARADOX_HUBS_KEY).includes(here);
  } catch {
    return false;
  }
}

/** Carry the supercharge from this hub to the hub at `url`. */
export function spreadSuperchargeTo(url: string): void {
  const path = normalise(new URL(url, window.location.href).pathname);
  try {
    const hubs = readList(PARADOX_HUBS_KEY);
    if (!hubs.includes(path) && localStorage.getItem(SUPERCHARGED_HUB_KEY) !== path) {
      localStorage.setItem(PARADOX_HUBS_KEY, JSON.stringify([...hubs, path]));
      sessionStorage.setItem(PARADOX_ARRIVAL_KEY, path);
    }
  } catch {
    // Then the charge stays where it was.
  }
}

/** True once, on the first visit to a hub the paradox just spread to. */
export function justArrivedThroughParadox(): boolean {
  try {
    if (sessionStorage.getItem(PARADOX_ARRIVAL_KEY) !== normalise(window.location.pathname)) return false;
    sessionStorage.removeItem(PARADOX_ARRIVAL_KEY);
    return true;
  } catch {
    return false;
  }
}

function readList(key: string): string[] {
  const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
  return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
}

// Adds to the list rather than replacing it, so games a hub only shows some
// of the time (behind a filter, or a secret door) stay supercharged.
export function rememberSuperchargedGames(urls: string[]): void {
  const paths = urls.map((url) => normalise(new URL(url, window.location.href).pathname));
  try {
    const known = readList(SUPERCHARGED_GAMES_KEY);
    localStorage.setItem(SUPERCHARGED_GAMES_KEY, JSON.stringify([...new Set([...known, ...paths])]));
  } catch {
    // Then only the hub itself glows.
  }
}

export function isThisGameSupercharged(): boolean {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SUPERCHARGED_GAMES_KEY) ?? "[]");
    return Array.isArray(stored) && stored.includes(normalise(window.location.pathname));
  } catch {
    return false;
  }
}
