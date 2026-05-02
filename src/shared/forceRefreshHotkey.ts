let installed = false;
let triggerReload: (() => void) | null = null;

interface ForceRefreshHotkeyOptions {
  beforeReload?: () => void;
}

export function installForceRefreshHotkey(options?: ForceRefreshHotkeyOptions): void {
  if (installed) {
    triggerReload = () => {
      options?.beforeReload?.();
      window.location.reload();
    };
    return;
  }

  installed = true;
  triggerReload = () => {
    options?.beforeReload?.();
    window.location.reload();
  };

  const handleForceRefreshHotkey = (event: KeyboardEvent): void => {
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
    const code = typeof event.code === "string" ? event.code.toLowerCase() : "";
    const functionKeyCode = event.keyCode === 115 || event.which === 115;
    const isForceRefreshHotkey =
      event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      (key === "f4" || code === "f4" || functionKeyCode);

    if (!isForceRefreshHotkey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    triggerReload?.();
  };

  window.addEventListener("keydown", handleForceRefreshHotkey, { capture: true });
  document.addEventListener("keydown", handleForceRefreshHotkey, { capture: true });
  window.addEventListener("keyup", handleForceRefreshHotkey, { capture: true });
}
