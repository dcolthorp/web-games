// Keep a game's saves in a file on this computer (saves/<name>.json, through
// the dev server's /api/save), not just in the browser. Restarting the Claude
// app wipes the Browser pane's storage, but not the file.
//
// It works on whatever the game already keeps in localStorage: every key that
// starts with `prefix` gets copied into the file, and copied back out when the
// game opens. So the game itself doesn't have to change, it just has to start
// after restoreSaveFile() finishes (see make-your-own-maze/boot.ts).
//
// Only at localhost. At 127.0.0.1 (for testing) or on another device it does
// nothing, so testing can never touch the real save.

const enabled = location.hostname === "localhost";
// If the file couldn't be read, never write over it.
let broken = false;

function collect(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // No storage at all.
  }
  return out;
}

/** Copies the file's saves into localStorage. Call before the game starts. */
export async function restoreSaveFile(name: string, prefix: string): Promise<void> {
  if (!enabled) return;
  try {
    const res = await fetch(`/api/save/${name}`);
    if (!res.ok) throw new Error(`save file: ${res.status}`);
    const data = (await res.json()) as { keys?: Record<string, string> } | null;
    // No file yet: whatever is in the browser gets written to it.
    if (!data?.keys) return;
    for (const k of Object.keys(collect(prefix))) {
      if (!(k in data.keys)) localStorage.removeItem(k);
    }
    for (const [k, v] of Object.entries(data.keys)) {
      if (k.startsWith(prefix)) localStorage.setItem(k, v);
    }
  } catch {
    broken = true;
  }
}

/** Writes the game's saves to the file every few seconds, and on leaving the page. */
export function keepSaveFile(name: string, prefix: string): void {
  if (!enabled) return;
  let last = "";
  const write = () => {
    if (broken) return;
    const json = JSON.stringify({ keys: collect(prefix) });
    if (json === last) return;
    last = json;
    fetch(`/api/save/${name}`, {
      method: "POST",
      body: json,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(() => {
      // The server's not there right now; try again next time.
      last = "";
    });
  };
  write();
  window.setInterval(write, 3000);
  window.addEventListener("pagehide", write);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") write();
  });
}
