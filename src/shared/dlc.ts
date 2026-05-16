const CREDITS_KEY_PREFIX = "dlc-credits-";
const UNLOCKED_KEY_PREFIX = "dlc-unlocked-";
const PURCHASED_KEY_PREFIX = "dlc-purchased-";

export const OUMG_GAME_ID = "oscars-untitled-maze-game";
export const OUMG_MAZE_X_DLC_ID = "oumg-maze-x";

export function getBeatCredits(gameId: string): number {
  try {
    const raw = localStorage.getItem(CREDITS_KEY_PREFIX + gameId);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function setBeatCredits(gameId: string, n: number): void {
  try {
    localStorage.setItem(CREDITS_KEY_PREFIX + gameId, String(Math.max(0, n)));
  } catch {
    // ignore
  }
}

export function awardBeatCredit(gameId: string): void {
  setBeatCredits(gameId, getBeatCredits(gameId) + 1);
}

export function consumeBeatCredit(gameId: string): boolean {
  const have = getBeatCredits(gameId);
  if (have <= 0) return false;
  setBeatCredits(gameId, have - 1);
  return true;
}

export function isDlcUnlocked(dlcId: string): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY_PREFIX + dlcId) === "true";
  } catch {
    return false;
  }
}

export function unlockDlc(dlcId: string): void {
  try {
    localStorage.setItem(UNLOCKED_KEY_PREFIX + dlcId, "true");
    localStorage.setItem(PURCHASED_KEY_PREFIX + dlcId, "true");
  } catch {
    // ignore
  }
}

export function isDlcPurchased(dlcId: string): boolean {
  try {
    return localStorage.getItem(PURCHASED_KEY_PREFIX + dlcId) === "true";
  } catch {
    return false;
  }
}

export function setDlcEnabled(dlcId: string, enabled: boolean): void {
  try {
    localStorage.setItem(UNLOCKED_KEY_PREFIX + dlcId, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}
