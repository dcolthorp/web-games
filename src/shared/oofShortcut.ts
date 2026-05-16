import { MOD_OOF_KEY, isModEnabled } from "./mods";

let installed = false;
const RESET_MS = 2500;
const TRIGGER = "/oof";

export function installOofShortcut(): void {
  if (installed) return;
  installed = true;

  let buffer = "";
  let lastInputTime = 0;

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (!isModEnabled(MOD_OOF_KEY)) {
        buffer = "";
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const now = performance.now();
      if (now - lastInputTime > RESET_MS) buffer = "";
      lastInputTime = now;

      const key = event.key;
      if (key === "/") {
        buffer = "/";
        return;
      }
      if (!buffer.startsWith("/")) return;
      if (key === "Backspace") {
        buffer = buffer.slice(0, -1);
        return;
      }
      if (key.length === 1 && /^[a-z0-9]$/i.test(key)) {
        buffer += key.toLowerCase();
      }
      if (buffer === TRIGGER) {
        buffer = "";
        window.location.href = "https://www.roblox.com/";
      } else if (!TRIGGER.startsWith(buffer)) {
        buffer = "";
      }
    },
    true
  );
}
