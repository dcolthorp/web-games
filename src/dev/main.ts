import { isDevZeroRebuilt } from "../shared/devZero";

// dev.1's own hub. dev.0 was the very first Oscar's Games; once it's been
// rebuilt it watches over every hub that got built on top of it. Before then
// there's nothing here but a broken page.

interface System {
  name: string;
  path: string;
}

const SYSTEMS: System[] = [
  { name: "Oscar's Games", path: "../index.html" },
  { name: "Penelope's Games", path: "../penelope/index.html" },
  { name: "BIG games", path: "../big-games/index.html" },
  { name: "Games 2", path: "../games2/index.html" },
  { name: "Games 3", path: "../games3/index.html" },
  { name: "Games 4", path: "../games4/index.html" },
  { name: "Games 5", path: "../games5/index.html" },
  { name: "Mods & DLCs", path: "../mods/index.html" },
];

const hello = document.getElementById("dev-hello");
const monitor = document.getElementById("dev-monitor");

if (!isDevZeroRebuilt()) {
  document.body.classList.add("is-broken");
  if (hello) hello.textContent = "ERROR: dev.0 is still broken. Go back and fix it.";
} else {
  typeOut("Hi. It's me, dev.1. I was here first. Pick a system and I'll boot it up for you.");
  renderMonitor();
}

function typeOut(text: string): void {
  if (!hello) return;
  let shown = 0;
  const step = (): void => {
    shown += 1;
    hello.textContent = text.slice(0, shown);
    if (shown < text.length) window.setTimeout(step, 30);
  };
  step();
}

function renderMonitor(): void {
  if (!monitor) return;
  SYSTEMS.forEach((system, index) => {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.className = "dev-system";
    link.href = system.path;
    // Each one "boots" a moment after the last, like a computer starting up.
    link.style.animationDelay = `${0.4 + index * 0.25}s`;

    const name = document.createElement("span");
    name.className = "dev-system-name";
    name.textContent = system.name;
    const status = document.createElement("span");
    status.className = "dev-system-status";
    status.textContent = "RUNNING";

    link.append(name, status);
    row.appendChild(link);
    monitor.appendChild(row);
  });
}
