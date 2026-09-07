export interface World {
  name: string;
  page: string | null;
}

// The run, in order. A null page is a world that has not been built yet.
export const worlds: World[] = [
  { name: "Death Farms", page: "./world-1.html" },
  { name: "Devil Labs", page: "./world-2.html" },
  { name: "Sunken Castle", page: "./world-3.html" },
  { name: "M@tr1x 45", page: "./world-4.html" },
  { name: "Whiteout", page: "./world-5.html" },
  { name: "Blood Temple", page: "./world-6.html" },
  { name: "V1D30 game", page: "./world-7.html" },
  { name: "Internet run Lol <3", page: "./world-8.html" },
  { name: "do not enter", page: "./world-9.html" },
  { name: "The end...?", page: "./world-10.html" },
]

export const CLEARED_KEY = "holdens-game-cleared-v1";

export function clearedWorlds(): number {
  const raw = Number(localStorage.getItem(CLEARED_KEY) ?? "0");
  return Number.isFinite(raw) ? Math.max(0, Math.min(worlds.length, Math.floor(raw))) : 0;
}

export function markCleared(index: number): void {
  if (clearedWorlds() < index + 1) localStorage.setItem(CLEARED_KEY, String(index + 1));
}
