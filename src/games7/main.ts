import { installForceRefreshHotkey } from "../shared/forceRefreshHotkey";
import { installOofShortcut } from "../shared/oofShortcut";
import { AHEG_TROPHY_LOCATION_KEY, GAMES7_TROPHY_SPOT, drawAhegTrophyGraphic } from "../shared/ahegTrophy";

// Same key the Games 1 menu uses to know the trophy is sitting there.
const HUB_TROPHY_KEY = "a-hard-easy-game-hub-trophy";

installOofShortcut();
installForceRefreshHotkey();

interface Game {
  id: string;
  name: string;
  path: string;
  genre: string;
  blurb: string;
}

const games: Game[] = [
  {
    id: "make-elements",
    name: "Make Elements",
    path: "./make-elements/index.html",
    genre: "Element Factory",
    blurb: "Spawners, conveyor belts and combiners. Mix elements into new ones and fill the Elemepiedia.",
  },
  {
    id: "destroy-the-game",
    name: "Destroy the Game",
    path: "./destroy-the-game/index.html",
    genre: "Sketchy Platformer",
    blurb: "Hit D to dash. Fly over spikes and smash through cracked walls.",
  },
  {
    id: "make-fractals",
    name: "Make Fractals",
    path: "./make-fractals/index.html",
    genre: "Fractal Maker",
    blurb: "Menger sponges, dragon curves, H-trees and more. Crank up the level, or make your own.",
  },
];

// Destroy the Game's card got smashed in the bottom-right corner, same as its
// title card: the corner is snapped off (clip-path in main.css) and these cracks
// spread out from where it hit. Drawn in percent so it fits any card size.
const BREAK_EDGE = "100,56 94,60 95,66 88,68 89,75 82,77 83,84 76,85 74,93 69,92 66,100";
const SMASH_CRACKS = [
  "86,81 78,74 71,70 62,61 55,58 46,47",
  "86,81 80,66 77,55 72,44 70,30",
  "86,81 74,80 64,83 52,80 41,84 30,82",
  "86,81 84,70 87,58 85,46",
  "86,81 77,88 68,96 60,100",
  "86,81 70,77 60,72",
  "78,74 80,66 84,70 78,74",
  "71,70 74,80 64,83",
  "62,61 64,72 60,72",
];
const SMASHED_CORNER = `
  <svg class="smashed-corner" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <radialGradient id="smash-dent" cx="0.86" cy="0.81" r="0.35">
      <stop offset="0" stop-color="#1b0606" stop-opacity="0.6" />
      <stop offset="1" stop-color="#1b0606" stop-opacity="0" />
    </radialGradient>
    <rect width="100" height="100" fill="url(#smash-dent)" />
    ${SMASH_CRACKS.map(
      (pts) => `<polyline class="crack-light" points="${pts}" transform="translate(0.4 0.6)" /><polyline class="crack" points="${pts}" />`
    ).join("")}
    <polyline class="break-edge" points="${BREAK_EDGE}" />
    <polyline class="break-edge-light" points="${BREAK_EDGE}" transform="translate(-0.8 -1.2)" />
  </svg>`;

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Oscar, you know what to do.</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) => `
      <li${game.id === "destroy-the-game" ? ' class="smashed-card-slot"' : ""}>
        <a class="game-card games7-game-card${game.id === "destroy-the-game" ? " smashed-card" : ""}" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top">
            <span class="game-tag">${game.genre}</span>
            <span class="game-arrow" aria-hidden="true">→</span>
          </span>
          <span class="game-title">${game.name}</span>
          <span class="game-blurb">${game.blurb}</span>
          ${game.id === "destroy-the-game" ? SMASHED_CORNER : ""}
        </a>
      </li>
    `
    )
    .join("");
}

// The caution tape is a gumball machine's crank. Every turn drops one gumball
// with a 7 on it into the tray. Seven gumballs fills the tray, and they all
// bounce and clear out to make room for more.
const COLORS = ["#ff5c5c", "#ffd23f", "#5fe0ff", "#7dffc8", "#ff9ad5", "#b58cff", "#ff9f43"];
const TRAY_SIZE = 7;

function installGumballMachine(): void {
  const crank = document.getElementById("games7-crank");
  const tray = document.getElementById("gumball-tray");
  if (!crank || !tray) return;
  let clearing = false;

  crank.addEventListener("click", () => {
    if (clearing) return;
    crank.classList.remove("is-turned");
    void crank.offsetWidth; // restart the little turn animation
    crank.classList.add("is-turned");

    const ball = document.createElement("span");
    ball.className = "gumball";
    ball.textContent = "7";
    ball.style.background = COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#ff5c5c";
    tray.append(ball);

    if (tray.children.length >= TRAY_SIZE) {
      clearing = true;
      tray.classList.add("is-full");
      window.setTimeout(() => {
        tray.replaceChildren();
        tray.classList.remove("is-full");
        clearing = false;
      }, 1400);
    }
  });
}

renderGameList();
installGumballMachine();

// The gumball machine's floor is covered in chewed gum. Grab it and drag and it
// stretches after you. Let go and it snaps back. Every seventh pull, a gumball
// pops out into the tray.
//
// Secret: carry the A Hard Easy Game trophy over from the Games 1 menu (drop it
// on "Games 7" in the dropdown). Line its bottom up with the top edge of the
// floor and rub it back and forth over the gum to scrape it off for good.
const GUM_SNAP_LINES = ["SNAP!", "IT'S SO STICKY", "GET IT OFF ME", "STOP CHEWING ON ME", "THWAP!", "GROSS"];
const GUM_PULLS_PER_GUMBALL = 7;
const GUM_SCRAPED_KEY = "games7-gum-scraped";
const CLEAN_FLOOR_TEXT = "SPARKLING CLEAN. NOW YOU CAN TRUST ME.";

function isGumScraped(): boolean {
  try {
    return localStorage.getItem(GUM_SCRAPED_KEY) === "true";
  } catch {
    return false;
  }
}

function installGumFloor(): void {
  const floor = document.getElementById("trap-floor-7");
  const label = floor?.querySelector<HTMLElement>(".gum-floor-label");
  if (!(floor instanceof HTMLButtonElement) || !label) return;
  let start: { x: number; y: number } | null = null;
  let pulled = false;
  let pulls = 0;

  if (isGumScraped()) {
    floor.classList.add("is-clean");
    label.textContent = CLEAN_FLOOR_TEXT;
  }

  floor.addEventListener("pointerdown", (event) => {
    if (floor.classList.contains("is-clean")) return;
    start = { x: event.clientX, y: event.clientY };
    pulled = false;
    try {
      floor.setPointerCapture(event.pointerId);
    } catch {
      // Already let go before we could grab on. The drag still works without it.
    }
    floor.classList.remove("is-snapping");
    floor.classList.add("is-stretching");
  });

  floor.addEventListener("pointermove", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Gum gives a little and then fights back harder the further you pull.
    const pullX = Math.sign(dx) * Math.min(Math.abs(dx) * 0.45, 160);
    const pullY = Math.sign(dy) * Math.min(Math.abs(dy) * 0.45, 140);
    const stretch = 1 + Math.min(Math.hypot(dx, dy) / 400, 0.6);
    floor.style.transform = `translate(${pullX}px, ${pullY}px) scale(${1 / Math.sqrt(stretch)}, ${stretch})`;
    if (Math.hypot(dx, dy) > 30 && !pulled) {
      pulled = true;
      label.textContent = "IT'S STUCK TO YOU!";
    }
  });

  const letGo = (): void => {
    if (!start) return;
    start = null;
    floor.classList.remove("is-stretching");
    floor.classList.add("is-snapping");
    floor.style.transform = "";
    if (!pulled) {
      label.textContent = "GRAB IT AND PULL";
      return;
    }
    pulls += 1;
    if (pulls % GUM_PULLS_PER_GUMBALL === 0) {
      label.textContent = "A GUMBALL CAME OUT!";
      document.getElementById("games7-crank")?.click();
    } else {
      label.textContent = GUM_SNAP_LINES[(pulls - 1) % GUM_SNAP_LINES.length] ?? "SNAP!";
    }
  };
  floor.addEventListener("pointerup", letGo);
  floor.addEventListener("pointercancel", letGo);
}

// How lined up the trophy's bottom has to be with the floor's top edge, and how
// much rubbing each blob of gum takes.
const SCRAPE_ALIGN_PX = 10;
const SCRAPE_RUB_PX = 160;
const TROPHY_POSITION_KEY = "games7-trophy-position";

function installGames7Trophy(): void {
  let location: string | null = null;
  try {
    location = localStorage.getItem(AHEG_TROPHY_LOCATION_KEY);
  } catch {
    return;
  }
  if (location !== GAMES7_TROPHY_SPOT) return;

  const shell = document.querySelector<HTMLElement>(".menu-shell");
  const floor = document.getElementById("trap-floor-7");
  const label = floor?.querySelector<HTMLElement>(".gum-floor-label");
  const homeArrow = document.querySelector<HTMLElement>(".hub-toggle");
  if (!shell || !floor || !label) return;

  const trophy = document.createElement("div");
  trophy.className = "hub-trophy";
  trophy.setAttribute("role", "img");
  trophy.setAttribute("aria-label", "The trophy from A Hard Easy Game");
  const canvas = document.createElement("canvas");
  canvas.width = 52;
  canvas.height = 60;
  const ctx = canvas.getContext("2d");
  if (ctx) drawAhegTrophyGraphic(ctx);
  trophy.append(canvas);
  shell.append(trophy);

  const blobs = Array.from(floor.querySelectorAll<HTMLElement>(".gum-blob"));
  const rubbed = blobs.map(() => 0);

  const groundY = (): number => {
    const shellRect = shell.getBoundingClientRect();
    return floor.getBoundingClientRect().top - shellRect.top - trophy.offsetHeight;
  };

  const saved = readTrophyPosition();
  const floorRect = floor.getBoundingClientRect();
  const shellRect = shell.getBoundingClientRect();
  trophy.style.left = `${saved?.x ?? floorRect.left - shellRect.left + 20}px`;
  trophy.style.top = `${saved?.y ?? groundY()}px`;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let lastX = 0;
  let fallFrame = 0;

  trophy.addEventListener("pointerdown", (event) => {
    cancelAnimationFrame(fallFrame);
    dragging = true;
    const rect = trophy.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    lastX = trophy.offsetLeft;
    trophy.classList.add("is-dragging");
    try {
      trophy.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already gone; dragging still follows it while it's over the trophy.
    }
    event.preventDefault();
  });

  trophy.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const rect = shell.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left - offsetX, 0, rect.width - trophy.offsetWidth);
    const y = clamp(event.clientY - rect.top - offsetY, 0, rect.height - trophy.offsetHeight);
    trophy.style.left = `${x}px`;
    trophy.style.top = `${y}px`;
    scrape(Math.abs(x - lastX));
    lastX = x;
  });

  const release = (): void => {
    if (!dragging) return;
    dragging = false;
    trophy.classList.remove("is-dragging");
    if (homeArrow && overlaps(trophy, homeArrow)) {
      sendTrophyHome();
      return;
    }
    fall();
  };
  trophy.addEventListener("pointerup", release);
  trophy.addEventListener("pointercancel", release);

  // Only counts when the trophy's bottom is sitting right on the floor's edge.
  const scrape = (moved: number): void => {
    if (floor.classList.contains("is-clean") || moved === 0) return;
    const aligned = Math.abs(trophy.offsetTop - groundY()) <= SCRAPE_ALIGN_PX;
    floor.classList.toggle("is-being-scraped", aligned);
    if (!aligned) return;

    const trophyRect = trophy.getBoundingClientRect();
    blobs.forEach((blob, index) => {
      if (blob.classList.contains("is-scraped")) return;
      const blobRect = blob.getBoundingClientRect();
      if (trophyRect.right < blobRect.left || trophyRect.left > blobRect.right) return;
      rubbed[index] = (rubbed[index] ?? 0) + moved;
      const left = Math.max(0, 1 - (rubbed[index] ?? 0) / SCRAPE_RUB_PX);
      blob.style.setProperty("--left", String(left));
      label.textContent = "SCRAPE SCRAPE SCRAPE";
      if (left === 0) blob.classList.add("is-scraped");
    });

    if (blobs.every((blob) => blob.classList.contains("is-scraped"))) {
      floor.classList.remove("is-being-scraped");
      floor.classList.add("is-clean", "is-just-cleaned");
      label.textContent = CLEAN_FLOOR_TEXT;
      try {
        localStorage.setItem(GUM_SCRAPED_KEY, "true");
      } catch {
        // Can't save it. Clean for now, anyway.
      }
    }
  }

  const fall = (): void => {
    let velocity = 80;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      velocity += 1800 * dt;
      const target = groundY();
      const next = trophy.offsetTop + velocity * dt;
      if (next >= target || trophy.offsetTop > target) {
        trophy.style.top = `${Math.min(target, Math.max(trophy.offsetTop, target))}px`;
        floor.classList.remove("is-being-scraped");
        saveTrophyPosition(trophy);
        return;
      }
      trophy.style.top = `${next}px`;
      fallFrame = requestAnimationFrame(step);
    };
    fallFrame = requestAnimationFrame(step);
  }

  const sendTrophyHome = (): void => {
    try {
      localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
      localStorage.removeItem(TROPHY_POSITION_KEY);
      localStorage.setItem(HUB_TROPHY_KEY, "true");
    } catch {
      return;
    }
    trophy.remove();
    window.location.href = "../index.html";
  }
}

function overlaps(a: HTMLElement, b: HTMLElement): boolean {
  const ar = a.getBoundingClientRect();
  const br = b.getBoundingClientRect();
  return ar.left < br.right && ar.right > br.left && ar.top < br.bottom && ar.bottom > br.top;
}

function readTrophyPosition(): { x: number; y: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TROPHY_POSITION_KEY) ?? "null") as { x?: unknown; y?: unknown } | null;
    return raw && typeof raw.x === "number" && typeof raw.y === "number" ? { x: raw.x, y: raw.y } : null;
  } catch {
    return null;
  }
}

function saveTrophyPosition(trophy: HTMLElement): void {
  try {
    localStorage.setItem(TROPHY_POSITION_KEY, JSON.stringify({ x: trophy.offsetLeft, y: trophy.offsetTop }));
  } catch {
    // Not saved; it'll land back on the floor next time.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

installGumFloor();
installGames7Trophy();
