export const AHEG_TROPHY_LOCATION_KEY = "a-hard-easy-game-trophy-location";
export const OUMG_DELETED_FROM_HUB_KEY = "oscars-untitled-maze-game-deleted-from-hub";
export const AKL_DELETED_FROM_HUB_KEY = "a-kids-life-deleted-from-hub";
export const TM_DELETED_FROM_HUB_KEY = "tamagotchi-monster-deleted-from-hub";

interface ImportedAhegTrophyOptions {
  onBeforeImpact?: () => void;
  onDrop?: () => void;
}

export function renderImportedAhegTrophy(gameId: string, options: ImportedAhegTrophyOptions = {}): void {
  if (localStorage.getItem(AHEG_TROPHY_LOCATION_KEY) !== gameId) {
    document.getElementById("imported-aheg-trophy")?.remove();
    return;
  }

  if (document.getElementById("imported-aheg-trophy")) {
    return;
  }

  const trophy = document.createElement("div");
  trophy.id = "imported-aheg-trophy";
  trophy.setAttribute("role", "img");
  trophy.setAttribute("aria-label", "A trophy dropped in from A Hard Easy Game");
  const savedPosition = readImportedTrophyPosition(gameId);
  const startX = savedPosition?.x ?? window.innerWidth - 70;
  const startY = savedPosition?.y ?? window.innerHeight - 78;
  Object.assign(trophy.style, {
    position: "fixed",
    left: `${clamp(startX, 0, window.innerWidth - 52)}px`,
    top: `${clamp(startY, 0, window.innerHeight - 60)}px`,
    width: "52px",
    height: "60px",
    zIndex: "1000",
    pointerEvents: "auto",
    touchAction: "none",
    cursor: "grab",
    filter: "drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42))",
  });

  const canvas = document.createElement("canvas");
  canvas.width = 52;
  canvas.height = 60;
  const renderCtx = canvas.getContext("2d");
  if (renderCtx instanceof CanvasRenderingContext2D) {
    drawAhegTrophyGraphic(renderCtx);
  }

  trophy.appendChild(canvas);
  document.body.appendChild(trophy);
  makeImportedTrophyDraggable(trophy, gameId, options);
}

export function drawAhegTrophyGraphic(renderCtx: CanvasRenderingContext2D): void {
  renderCtx.save();
  renderCtx.fillStyle = "#ffd86f";
  renderCtx.fillRect(10, 44, 32, 10);
  renderCtx.fillRect(20, 22, 12, 28);
  renderCtx.beginPath();
  renderCtx.roundRect(8, 6, 36, 24, 10);
  renderCtx.fill();

  renderCtx.strokeStyle = "#8b6400";
  renderCtx.lineWidth = 4;
  renderCtx.beginPath();
  renderCtx.arc(8, 18, 8, Math.PI * 0.5, Math.PI * 1.5, true);
  renderCtx.arc(44, 18, 8, Math.PI * 1.5, Math.PI * 0.5, true);
  renderCtx.stroke();

  renderCtx.fillStyle = "#fff0ae";
  renderCtx.font = "700 12px Trebuchet MS";
  renderCtx.textAlign = "center";
  renderCtx.fillText("LVL 2", 26, 22);
  renderCtx.restore();
}

function makeImportedTrophyDraggable(
  trophy: HTMLElement,
  gameId: string,
  options: ImportedAhegTrophyOptions
): void {
  let dragging = false;
  let activePointerId: number | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let fallFrameId: number | null = null;
  let fallLastTimestamp = 0;
  let fallVelocityY = 0;
  let beforeImpactCalled = false;

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
    trophy.style.cursor = "grabbing";
    trophy.style.filter = "drop-shadow(0 22px 22px rgba(0, 0, 0, 0.5))";
    trophy.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  trophy.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== activePointerId) {
      return;
    }

    const nextX = clamp(event.clientX - offsetX, 0, window.innerWidth - trophy.offsetWidth);
    const nextY = clamp(event.clientY - offsetY, 0, window.innerHeight - trophy.offsetHeight);
    trophy.style.left = `${nextX}px`;
    trophy.style.top = `${nextY}px`;
  });

  trophy.addEventListener("pointerup", (event) => {
    if (activePointerId !== null && trophy.hasPointerCapture(activePointerId)) {
      trophy.releasePointerCapture(activePointerId);
    }

    if (event.pointerId === activePointerId) {
      startImportedTrophyFall(true);
    }

    dragging = false;
    activePointerId = null;
    trophy.style.cursor = "grab";
    trophy.style.filter = "drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42))";
  });

  trophy.addEventListener("pointercancel", () => {
    if (activePointerId !== null && trophy.hasPointerCapture(activePointerId)) {
      trophy.releasePointerCapture(activePointerId);
    }

    dragging = false;
    activePointerId = null;
    trophy.style.cursor = "grab";
    trophy.style.filter = "drop-shadow(0 16px 18px rgba(0, 0, 0, 0.42))";
    startImportedTrophyFall(false);
  });

  window.addEventListener("resize", () => {
    const nextX = clamp(trophy.offsetLeft, 0, window.innerWidth - trophy.offsetWidth);
    const nextY = clamp(trophy.offsetTop, 0, window.innerHeight - trophy.offsetHeight);
    trophy.style.left = `${nextX}px`;
    trophy.style.top = `${nextY}px`;
    saveImportedTrophyPosition(gameId, trophy);
  });

  function startImportedTrophyFall(countAsDrop: boolean): void {
    if (fallFrameId !== null) {
      cancelAnimationFrame(fallFrameId);
    }

    fallVelocityY = 80;
    beforeImpactCalled = false;
    fallLastTimestamp = performance.now();
    fallFrameId = requestAnimationFrame((timestamp) => updateImportedTrophyFall(timestamp, countAsDrop));
  }

  function updateImportedTrophyFall(timestamp: number, countAsDrop: boolean): void {
    const rawDeltaSeconds = Math.min((timestamp - fallLastTimestamp) / 1000, 0.05);
    const deltaSeconds = beforeImpactCalled && options.onBeforeImpact ? rawDeltaSeconds * 0.32 : rawDeltaSeconds;
    fallLastTimestamp = timestamp;

    const groundY = window.innerHeight - trophy.offsetHeight;
    const distanceToGround = Math.max(0, groundY - trophy.offsetTop);
    const timeToImpact =
      fallVelocityY > 0 ? distanceToGround / Math.max(fallVelocityY, 1) : Number.POSITIVE_INFINITY;
    if (!beforeImpactCalled && countAsDrop && options.onBeforeImpact && timeToImpact <= 1) {
      beforeImpactCalled = true;
      options.onBeforeImpact();
    }

    fallVelocityY += 1800 * deltaSeconds;
    const nextY = trophy.offsetTop + fallVelocityY * deltaSeconds;

    if (nextY >= groundY) {
      trophy.style.top = `${groundY}px`;
      fallVelocityY = 0;
      fallFrameId = null;
      saveImportedTrophyPosition(gameId, trophy);
      if (countAsDrop) {
        options.onDrop?.();
      }
      return;
    }

    trophy.style.top = `${nextY}px`;
    fallFrameId = requestAnimationFrame((nextTimestamp) => updateImportedTrophyFall(nextTimestamp, countAsDrop));
  }
}

function importedTrophyPositionKey(gameId: string): string {
  return `a-hard-easy-game-trophy-position.${gameId}`;
}

function readImportedTrophyPosition(gameId: string): { x: number; y: number } | null {
  const rawPosition = localStorage.getItem(importedTrophyPositionKey(gameId));
  if (!rawPosition) {
    return null;
  }

  try {
    const position = JSON.parse(rawPosition) as { x?: number; y?: number };
    if (typeof position.x === "number" && typeof position.y === "number") {
      return { x: position.x, y: position.y };
    }
  } catch {
    return null;
  }

  return null;
}

function saveImportedTrophyPosition(gameId: string, trophy: HTMLElement): void {
  localStorage.setItem(
    importedTrophyPositionKey(gameId),
    JSON.stringify({
      x: trophy.offsetLeft,
      y: trophy.offsetTop,
    })
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
