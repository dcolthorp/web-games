const ESCAPED_AHEG_PLAYER_KEY = "a-hard-easy-game-escaped-player";
const ESCAPED_PLAYER_SPEED = 260;

interface EscapedPlayerState {
  x: number;
  y: number;
}

interface InitEscapedPlayerOptions {
  interactionCanvas?: HTMLCanvasElement | null;
}

export function initEscapedAhegPlayer(options: InitEscapedPlayerOptions = {}): void {
  const existingState = normalizeEscapedPlayerState(readEscapedPlayerState());
  if (!existingState) {
    document.getElementById("escaped-aheg-player")?.remove();
    return;
  }

  writeEscapedPlayerState(existingState);

  installEscapedPlayerStyle();

  const playerEl = document.getElementById("escaped-aheg-player") ?? createEscapedPlayerElement();
  const interactionCanvas = options.interactionCanvas ?? null;
  const keys = new Set<string>();
  let lastTimestamp = performance.now();
  let active = true;
  let wasMovingLastFrame = false;

  positionEscapedPlayer(playerEl, existingState);

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (isMovementKey(key)) {
      event.preventDefault();
      keys.add(key);
      return;
    }

  };

  const onKeyUp = (event: KeyboardEvent) => {
    keys.delete(event.key.toLowerCase());
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const loop = (timestamp: number) => {
    if (!active) {
      return;
    }

    const state = normalizeEscapedPlayerState(readEscapedPlayerState());
    if (!state) {
      cleanup();
      return;
    }

    const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
    lastTimestamp = timestamp;
    const movement = readMovementVector(keys);
    const isMoving = movement.x !== 0 || movement.y !== 0;
    if (movement.x !== 0 || movement.y !== 0) {
      const magnitude = Math.hypot(movement.x, movement.y) || 1;
      state.x = clamp(
        state.x + (movement.x / magnitude) * ESCAPED_PLAYER_SPEED * deltaSeconds,
        0,
        window.innerWidth - 28
      );
      state.y = clamp(
        state.y + (movement.y / magnitude) * ESCAPED_PLAYER_SPEED * deltaSeconds,
        0,
        window.innerHeight - 28
      );
    }

    writeEscapedPlayerState(state);
    positionEscapedPlayer(playerEl, state);
    if (isMoving) {
      pressAtPlayerCenter(playerEl, interactionCanvas);
    } else if (wasMovingLastFrame) {
      clearEscapedPlayerPressMarkers();
    }
    wasMovingLastFrame = isMoving;
    maybeNavigateFromEscapedPlayer(playerEl);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);

  function cleanup(): void {
    active = false;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    playerEl.remove();
  }
}

export function activateEscapedAhegPlayer(viewportX: number, viewportY: number): void {
  writeEscapedPlayerState({
    x: clamp(viewportX - 14, 0, window.innerWidth - 28),
    y: clamp(viewportY - 14, 0, window.innerHeight - 28),
  });
}

export function clearEscapedAhegPlayer(): void {
  localStorage.removeItem(ESCAPED_AHEG_PLAYER_KEY);
  document.getElementById("escaped-aheg-player")?.remove();
}

export function isEscapedAhegPlayerActive(): boolean {
  return readEscapedPlayerState() !== null;
}

function createEscapedPlayerElement(): HTMLDivElement {
  const playerEl = document.createElement("div");
  playerEl.id = "escaped-aheg-player";
  playerEl.setAttribute("aria-hidden", "true");
  playerEl.innerHTML = `<span class="escaped-aheg-player-core"></span>`;
  document.body.appendChild(playerEl);
  return playerEl;
}

function installEscapedPlayerStyle(): void {
  if (document.getElementById("escaped-aheg-player-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "escaped-aheg-player-style";
  style.textContent = `
    #escaped-aheg-player {
      position: fixed;
      left: 0;
      top: 0;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      pointer-events: none;
      z-index: 12000;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 34% 34%, #b9ecff 0 22%, #6dd3ff 24% 68%, #2b7dac 100%);
      box-shadow:
        0 0 0 2px rgba(255, 255, 255, 0.12),
        0 12px 24px rgba(0, 0, 0, 0.34),
        0 0 18px rgba(109, 211, 255, 0.56);
    }

    #escaped-aheg-player .escaped-aheg-player-core {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #07111d;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
    }
  `;
  document.head.appendChild(style);
}

function positionEscapedPlayer(playerEl: HTMLElement, state: EscapedPlayerState): void {
  playerEl.style.left = `${state.x}px`;
  playerEl.style.top = `${state.y}px`;
}

function maybeNavigateFromEscapedPlayer(playerEl: HTMLElement): void {
  const playerRect = playerEl.getBoundingClientRect();
  const candidates = [
    ...document.querySelectorAll<HTMLAnchorElement>(".back-link, .game-card, a[href='../../']"),
  ];
  const target = candidates.find((candidate) => rectsOverlap(playerRect, candidate.getBoundingClientRect()));
  if (!target) {
    return;
  }

  window.location.href = target.href;
}

function pressAtPlayerCenter(playerEl: HTMLElement, canvas: HTMLCanvasElement | null): void {
  const playerRect = playerEl.getBoundingClientRect();
  const pointX = playerRect.left + playerRect.width / 2;
  const pointY = playerRect.top + playerRect.height / 2;
  const target = document.elementFromPoint(pointX, pointY);
  const interactive = target?.closest<HTMLElement>(
    'button, a, [role="button"], input, select, textarea, summary, label'
  );
  if (interactive) {
    if (interactive.dataset["escapedAhegPressed"] === "true") {
      return;
    }

    interactive.dataset["escapedAhegPressed"] = "true";
    interactive.click();
    return;
  }

  if (!canvas) {
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  if (
    pointX < canvasRect.left ||
    pointX > canvasRect.right ||
    pointY < canvasRect.top ||
    pointY > canvasRect.bottom
  ) {
    return;
  }

  const eventInit = {
    bubbles: true,
    clientX: pointX,
    clientY: pointY,
    pointerId: 67,
    pointerType: "mouse",
  };
  canvas.dispatchEvent(new PointerEvent("pointermove", eventInit));
  canvas.dispatchEvent(new PointerEvent("pointerdown", eventInit));
  canvas.dispatchEvent(new PointerEvent("pointerup", eventInit));
  canvas.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: pointX, clientY: pointY }));
  canvas.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: pointX, clientY: pointY }));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: pointX, clientY: pointY }));
  canvas.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: pointX, clientY: pointY }));
}

function clearEscapedPlayerPressMarkers(): void {
  for (const element of document.querySelectorAll<HTMLElement>("[data-escaped-aheg-pressed]")) {
    delete element.dataset["escapedAhegPressed"];
  }
}

function readEscapedPlayerState(): EscapedPlayerState | null {
  const rawState = localStorage.getItem(ESCAPED_AHEG_PLAYER_KEY);
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as { x?: number; y?: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    return null;
  }

  return null;
}

function writeEscapedPlayerState(state: EscapedPlayerState): void {
  localStorage.setItem(ESCAPED_AHEG_PLAYER_KEY, JSON.stringify(state));
}

function normalizeEscapedPlayerState(state: EscapedPlayerState | null): EscapedPlayerState | null {
  if (!state) {
    return null;
  }

  const maxX = Math.max(0, window.innerWidth - 28);
  const maxY = Math.max(0, window.innerHeight - 28);
  const normalizedX = Number.isFinite(state.x) ? clamp(state.x, 0, maxX) : Math.min(maxX, window.innerWidth * 0.5);
  const normalizedY = Number.isFinite(state.y) ? clamp(state.y, 0, maxY) : Math.min(maxY, window.innerHeight * 0.5);

  return {
    x: normalizedX,
    y: normalizedY,
  };
}

function readMovementVector(keys: Set<string>): { x: number; y: number } {
  let x = 0;
  let y = 0;

  if (keys.has("arrowleft") || keys.has("a")) x -= 1;
  if (keys.has("arrowright") || keys.has("d")) x += 1;
  if (keys.has("arrowup") || keys.has("w")) y -= 1;
  if (keys.has("arrowdown") || keys.has("s")) y += 1;

  return { x, y };
}

function isMovementKey(key: string): boolean {
  return ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key);
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
