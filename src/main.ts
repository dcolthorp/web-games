import {
  AKL_DELETED_FROM_HUB_KEY,
  AHEG_TROPHY_LOCATION_KEY,
  OUMG_DELETED_FROM_HUB_KEY,
  TM_DELETED_FROM_HUB_KEY,
  drawAhegTrophyGraphic,
} from "./shared/ahegTrophy";
import { initEscapedAhegPlayer } from "./shared/escapedAhegPlayer";

interface Game {
  id: string;
  name: string;
  path: string;
  menuLabel?: string;
  genre: string;
  blurb: string;
}

interface TrophyDropTarget {
  id: string;
  href: string;
}

const LINKED_ROTATION_CURSE_KEY = "linked-rotation-curse";
const HUB_TROPHY_KEY = "a-hard-easy-game-hub-trophy";
const HUB_TROPHY_POSITION_KEY = "a-hard-easy-game-hub-trophy-position";
const OUMG_LEVEL_THREE_REACHED_KEY = "oscars-untitled-maze-game-level-three-reached";
const OUMG_TROPHY_DROP_COUNT_KEY = "oscars-untitled-maze-game-trophy-drop-count";
const OUMG_TROPHY_DOOM_STARTED_KEY = "oscars-untitled-maze-game-trophy-doom-started";

const games: Game[] = [
  // Add games here as you create them
  // { id: "snake", name: "Snake", path: "./games/snake/" },
  {
    id: "a-hard-easy-game",
    name: "A Hard Easy Game",
    menuLabel: 'A <span class="crossed-out-word">Hard</span> Easy Game',
    path: "./games/a-hard-easy-game/",
    genre: "Trap Course",
    blurb: "A dramatic obstacle run where most of the danger is just showing off.",
  },
  {
    id: "oscars-untitled-maze-game",
    name: "Oscar's Untitled Maze Game",
    path: "./games/oscars-untitled-maze-game/",
    genre: "Maze Trollery",
    blurb: "Sneaky rules, twisted levels, and a maze that keeps changing the deal.",
  },
  {
    id: "tamagotchi-monster",
    name: "Tamagotchi Monster",
    path: "./games/tamagotchi-monster/",
    genre: "Pet Chaos",
    blurb: "Raise a weird little creature and keep its glitchy little life on track.",
  },
  {
    id: "a-kids-life",
    name: "A Kid's Life",
    path: "./games/a-kids-life/",
    genre: "Life Sim",
    blurb: "Raise a sweet kid, grow a whole family tree, and keep each home cozy.",
  },
];

function renderGameList(): void {
  const list = document.getElementById("game-list");
  if (!list) return;

  if (games.length === 0) {
    list.innerHTML = '<li class="empty-state">No games yet. Time to build some!</li>';
    return;
  }

  list.innerHTML = games
    .map(
      (game) =>
        isGameDeletedFromHub(game.id)
          ? `
      <li>
        <div class="game-hole" aria-label="A missing game slot">
          ${renderGameHoleControls(game.id)}
        </div>
      </li>
    `
          : `
      <li>
        <a class="game-card hub-asset" data-asset-id="card-${game.id}" data-game-id="${game.id}" href="${game.path}" aria-label="${game.name}">
          <span class="game-card-top hub-asset" data-asset-id="card-top-${game.id}">
            <span class="game-tag hub-asset" data-asset-id="card-tag-${game.id}">${game.genre}</span>
            <span class="game-arrow hub-asset" data-asset-id="card-arrow-${game.id}" aria-hidden="true">→</span>
          </span>
          <span class="game-title hub-asset" data-asset-id="card-title-${game.id}">${game.menuLabel ?? game.name}</span>
          <span class="game-blurb hub-asset" data-asset-id="card-blurb-${game.id}">${game.blurb}</span>
        </a>
      </li>
    `
    )
    .join("");

  applyRotationCurseStyling(list);
}

renderGameList();
renderHubTrophy();
attachOumgRestoreButton();
initEscapedAhegPlayer();

const trapFloorElement = document.getElementById("trap-floor");
if (trapFloorElement instanceof HTMLButtonElement) {
  trapFloorElement.addEventListener("click", () => {
    window.location.replace("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
}

function renderOumgRestoreButton(): string {
  if (localStorage.getItem(OUMG_LEVEL_THREE_REACHED_KEY) !== "true") {
    return "";
  }

  return `
    <button id="restore-oumg-btn" class="restore-oumg-btn" type="button">
      Pull Oscar's Game Back
    </button>
  `;
}

function renderGameHoleControls(gameId: string): string {
  return gameId === "oscars-untitled-maze-game" ? renderOumgRestoreButton() : "";
}

function isGameDeletedFromHub(gameId: string): boolean {
  if (gameId === "oscars-untitled-maze-game") {
    return localStorage.getItem(OUMG_DELETED_FROM_HUB_KEY) === "true";
  }

  if (gameId === "a-kids-life") {
    return localStorage.getItem(AKL_DELETED_FROM_HUB_KEY) === "true";
  }

  if (gameId === "tamagotchi-monster") {
    return localStorage.getItem(TM_DELETED_FROM_HUB_KEY) === "true";
  }

  return false;
}

function attachOumgRestoreButton(): void {
  const restoreButton = document.getElementById("restore-oumg-btn");
  if (!(restoreButton instanceof HTMLButtonElement)) {
    return;
  }

  restoreButton.addEventListener("click", () => {
    localStorage.removeItem(OUMG_DELETED_FROM_HUB_KEY);
    localStorage.removeItem(OUMG_TROPHY_DROP_COUNT_KEY);
    localStorage.removeItem(OUMG_TROPHY_DOOM_STARTED_KEY);
    renderGameList();
    renderHubTrophy();
    attachOumgRestoreButton();
  });
}

function applyRotationCurseStyling(root: HTMLElement): void {
  const cursed = localStorage.getItem(LINKED_ROTATION_CURSE_KEY) === "rotated";
  const ahegCard = root.querySelector<HTMLAnchorElement>('a[href="./games/a-hard-easy-game/"]');
  if (!ahegCard) {
    return;
  }

  ahegCard.classList.toggle("game-card-cursed", cursed);
  const blurb = ahegCard.querySelector(".game-blurb");
  if (blurb) {
    blurb.textContent = cursed
      ? "AHHH WHATS HAPENING"
      : "A dramatic obstacle run where most of the danger is just showing off.";
  }
}

function renderHubTrophy(): void {
  const shell = document.querySelector<HTMLElement>(".menu-shell");
  const ahegCard = document.querySelector<HTMLElement>('a[href="./games/a-hard-easy-game/"]');
  if (!shell || !ahegCard) {
    return;
  }

  const existing = document.getElementById("hub-trophy");
  if (localStorage.getItem(HUB_TROPHY_KEY) !== "true" || localStorage.getItem(AHEG_TROPHY_LOCATION_KEY)) {
    existing?.remove();
    return;
  }

  const trophy = existing ?? document.createElement("div");
  trophy.id = "hub-trophy";
  trophy.className = "hub-trophy";
  trophy.setAttribute("role", "img");
  trophy.setAttribute("aria-label", "Teleported trophy");
  if (!existing) {
    const trophyCanvas = document.createElement("canvas");
    trophyCanvas.width = 52;
    trophyCanvas.height = 60;
    const trophyContext = trophyCanvas.getContext("2d");
    if (trophyContext instanceof CanvasRenderingContext2D) {
      drawAhegTrophyGraphic(trophyContext);
    }
    trophy.appendChild(trophyCanvas);
    shell.appendChild(trophy);
    makeHubTrophyDraggable(trophy, shell);
  }

  const shellRect = shell.getBoundingClientRect();
  const cardRect = ahegCard.getBoundingClientRect();
  const savedPosition = readHubTrophyPosition();
  trophy.style.left = `${savedPosition?.x ?? cardRect.right - shellRect.left - 54}px`;
  trophy.style.top = `${savedPosition?.y ?? cardRect.top - shellRect.top - 18}px`;
}

function makeHubTrophyDraggable(trophy: HTMLElement, shell: HTMLElement): void {
  const trapFloor = document.getElementById("trap-floor");
  let dragging = false;
  let activePointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let fallFrameId: number | null = null;
  let fallLastTimestamp = 0;
  let fallVelocityY = 0;

  trophy.addEventListener("pointerdown", (event) => {
    if (fallFrameId !== null) {
      cancelAnimationFrame(fallFrameId);
      fallFrameId = null;
    }
    dragging = true;
    activePointerId = event.pointerId;
    fallVelocityY = 0;
    const trophyRect = trophy.getBoundingClientRect();
    offsetX = event.clientX - trophyRect.left;
    offsetY = event.clientY - trophyRect.top;
    trophy.classList.add("is-dragging");
    trophy.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  trophy.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const nextX = clamp(event.clientX - shellRect.left - offsetX, 0, shellRect.width - trophy.offsetWidth);
    const nextY = clamp(event.clientY - shellRect.top - offsetY, 0, shellRect.height - trophy.offsetHeight);
    trophy.style.left = `${nextX}px`;
    trophy.style.top = `${nextY}px`;
  });

  trophy.addEventListener("pointerup", (event) => {
    if (activePointerId !== null && trophy.hasPointerCapture(activePointerId)) {
      trophy.releasePointerCapture(activePointerId);
    }
    if (event.pointerId === activePointerId) {
      const dropTarget = findTrophyDropTarget(trophy);
      if (dropTarget) {
        dragging = false;
        activePointerId = null;
        trophy.classList.remove("is-dragging");
        dropHubTrophyIntoGame(dropTarget, trophy);
        return;
      }
      startHubTrophyFall(trophy, shell);
    }
    dragging = false;
    activePointerId = null;
    trophy.classList.remove("is-dragging");
  });

  trophy.addEventListener("pointercancel", () => {
    if (activePointerId !== null && trophy.hasPointerCapture(activePointerId)) {
      trophy.releasePointerCapture(activePointerId);
    }
    dragging = false;
    activePointerId = null;
    trophy.classList.remove("is-dragging");
    startHubTrophyFall(trophy, shell);
  });

  function startHubTrophyFall(target: HTMLElement, container: HTMLElement): void {
    if (fallFrameId !== null) {
      cancelAnimationFrame(fallFrameId);
    }
    fallVelocityY = 80;
    fallLastTimestamp = performance.now();
    fallFrameId = requestAnimationFrame((timestamp) => updateHubTrophyFall(timestamp, target, container));
  }

  function updateHubTrophyFall(timestamp: number, target: HTMLElement, container: HTMLElement): void {
    const deltaSeconds = Math.min((timestamp - fallLastTimestamp) / 1000, 0.05);
    fallLastTimestamp = timestamp;

    const groundY = getHubTrophyGroundY(target, container, trapFloor);
    const currentY = target.offsetTop;
    fallVelocityY += 1800 * deltaSeconds;
    const nextY = currentY + fallVelocityY * deltaSeconds;

    if (nextY >= groundY) {
      target.style.top = `${groundY}px`;
      fallVelocityY = 0;
      fallFrameId = null;
      shakeHub(container);
      saveHubTrophyPosition(target);
      return;
    }

    target.style.top = `${nextY}px`;
    fallFrameId = requestAnimationFrame((nextTimestamp) => updateHubTrophyFall(nextTimestamp, target, container));
  }
}

function findTrophyDropTarget(trophy: HTMLElement): TrophyDropTarget | null {
  const trophyRect = trophy.getBoundingClientRect();
  const trophyCenterX = trophyRect.left + trophyRect.width / 2;
  const trophyCenterY = trophyRect.top + trophyRect.height / 2;
  const cards = document.querySelectorAll<HTMLAnchorElement>(".game-card[data-game-id]");

  for (const card of cards) {
    const cardRect = card.getBoundingClientRect();
    if (
      trophyCenterX >= cardRect.left &&
      trophyCenterX <= cardRect.right &&
      trophyCenterY >= cardRect.top &&
      trophyCenterY <= cardRect.bottom
    ) {
      const id = card.dataset["gameId"];
      if (id) {
        return { id, href: card.href };
      }
    }
  }

  return null;
}

function dropHubTrophyIntoGame(target: TrophyDropTarget, trophy: HTMLElement): void {
  localStorage.removeItem(HUB_TROPHY_KEY);
  localStorage.removeItem(HUB_TROPHY_POSITION_KEY);

  if (target.id === "a-hard-easy-game") {
    localStorage.removeItem(AHEG_TROPHY_LOCATION_KEY);
  } else {
    localStorage.setItem(AHEG_TROPHY_LOCATION_KEY, target.id);
  }

  trophy.remove();
  window.location.href = target.href;
}

function shakeHub(shell: HTMLElement): void {
  shell.classList.remove("hub-impact-shake");
  void shell.offsetWidth;
  shell.classList.add("hub-impact-shake");
}

function getHubTrophyGroundY(
  trophy: HTMLElement,
  shell: HTMLElement,
  trapFloor: HTMLElement | null
): number {
  if (!trapFloor) {
    return Math.max(0, shell.clientHeight - trophy.offsetHeight);
  }

  const shellRect = shell.getBoundingClientRect();
  const floorRect = trapFloor.getBoundingClientRect();
  return clamp(floorRect.top - shellRect.top - trophy.offsetHeight, 0, shell.clientHeight - trophy.offsetHeight);
}

function readHubTrophyPosition(): { x: number; y: number } | null {
  const rawPosition = localStorage.getItem(HUB_TROPHY_POSITION_KEY);
  if (!rawPosition) {
    return null;
  }

  try {
    const position = JSON.parse(rawPosition) as { x?: number; y?: number };
    if (typeof position.x === "number" && typeof position.y === "number") {
      return position as { x: number; y: number };
    }
  } catch {
    return null;
  }

  return null;
}

function saveHubTrophyPosition(trophy: HTMLElement): void {
  localStorage.setItem(
    HUB_TROPHY_POSITION_KEY,
    JSON.stringify({
      x: trophy.offsetLeft,
      y: trophy.offsetTop,
    })
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
