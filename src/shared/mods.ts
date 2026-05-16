export const MOD_TM_MORE_ANIMATIONS_KEY = "mod-tm-more-animations";
export const MOD_TM_DANCER_KEY = "mod-tm-dancer";
export const MOD_OOF_KEY = "mod-oof";

export function isModEnabled(key: string): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

export function setModEnabled(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}
