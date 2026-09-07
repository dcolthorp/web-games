export type KeyColour = "red" | "blue" | "gold";
export type Terrain = "water" | "ice" | "spike" | "crumble" | "wind";
export type EnemyKind =
  | "scarecrow" | "specimen" | "eel" | "glitch" | "wisp"
  | "skull" | "pixel" | "popup" | "watcher" | "wanderer";

export interface Rect { x: number; y: number; w: number; h: number }
export interface Vec { x: number; y: number }

export interface Palette {
  bg: string; floorA: string; floorB: string; wall: string; wallTop: string;
  water: string; ice: string; spike: string; crumble: string; wind: string; blob: string;
}

export interface EnemySpec {
  x: number; y: number; axis: "x" | "y"; low: number; high: number; speed: number; kind: EnemyKind;
}

export interface WorldSpec {
  index: number;
  name: string;
  hint: string;
  enemyName: string;
  gimmick: string;
  palette: Palette;
  rooms: Rect[];
  corridors: Rect[];
  doors: { x: number; y: number; colour: KeyColour }[];
  keys: { x: number; y: number; colour: KeyColour }[];
  signs: { x: number; y: number; words: string }[];
  enemies: EnemySpec[];
  patches: { rect: Rect; kind: Terrain; dir?: Vec }[];
  pads: { a: Vec; b: Vec }[];
  checkpoints: Vec[];
  start: Vec;
  treasure: Vec;
  playerSpeed: number;
  fog: number;
}

export const MAP_W = 40;
export const MAP_H = 28;
const TILE = 32;
const CRUMBLE_DELAY = 0.55;
const CRUMBLE_REGROW = 3.5;

export function buildGrid(spec: WorldSpec): string[][] {
  const grid: string[][] = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => "#"));
  const carve = (rect: Rect): void => {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) grid[y]![x] = ".";
      }
    }
  };
  spec.rooms.forEach(carve);
  spec.corridors.forEach(carve);
  return grid;
}

export function startWorld(spec: WorldSpec, onCleared: () => void): void {
  const canvas = document.querySelector<HTMLCanvasElement>("#world");
  const context = canvas?.getContext("2d") ?? null;
  const messageText = document.querySelector<HTMLParagraphElement>("#message");
  const banner = document.querySelector<HTMLDivElement>("#banner");
  const bannerTitle = document.querySelector<HTMLParagraphElement>("#banner-title");
  const bannerText = document.querySelector<HTMLParagraphElement>("#banner-text");
  const bannerButton = document.querySelector<HTMLButtonElement>("#banner-button");
  if (!canvas || !context) return;

  // Inline styles beat any stylesheet, cached or otherwise, so the win screen
  // cannot show itself before it is won.
  const showBanner = (show: boolean): void => {
    if (!banner) return;
    banner.hidden = !show;
    banner.style.display = show ? "flex" : "none";
  };
  showBanner(false);

  const grid = buildGrid(spec);
  const terrain: (Terrain | null)[][] = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => null));
  const winds: (Vec | null)[][] = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => null));
  spec.patches.forEach(({ rect, kind, dir }) => {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (grid[y]?.[x] !== ".") continue;
        terrain[y]![x] = kind;
        if (kind === "wind" && dir) winds[y]![x] = dir;
      }
    }
  });

  const keys = spec.keys.map((key) => ({ ...key, taken: false }));
  const enemies = spec.enemies.map((enemy) => ({
    ...enemy,
    dir: 1,
    homeX: enemy.x,
    homeY: enemy.y,
    phase: Math.random() * Math.PI * 2,
    timer: 0,
    visible: true,
  }));
  const openedDoors = new Set<string>();
  const held = new Set<KeyColour>();
  const player = { x: spec.start.x, y: spec.start.y, r: 0.34, vx: 0, vy: 0 };
  // Crumbling tiles: how long they have been stood on, and when they regrow.
  const standing = new Map<string, number>();
  const holes = new Map<string, number>();
  let padCooldown = 0;
  // You come back to the last flag you touched, not the front door.
  const litCheckpoints = new Set<number>();
  let respawn: Vec = { x: spec.start.x, y: spec.start.y };
  let won = false;
  let flashUntil = 0;
  let lastSign = "";
  let clock = 0;

  const doorShut = (x: number, y: number): boolean =>
    spec.doors.some((door) => door.x === x && door.y === y && !openedDoors.has(`${door.x},${door.y}`));

  const isWall = (x: number, y: number): boolean => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return grid[ty]?.[tx] === "#" || doorShut(tx, ty);
  };

  const blockedForPlayer = (x: number, y: number): boolean =>
    isWall(x, y) || holes.has(`${Math.floor(x)},${Math.floor(y)}`);

  const hitsWall = (x: number, y: number, r: number): boolean =>
    blockedForPlayer(x - r, y - r) || blockedForPlayer(x + r, y - r) ||
    blockedForPlayer(x - r, y + r) || blockedForPlayer(x + r, y + r);

  const tileAt = (v: Vec): Terrain | null => terrain[Math.floor(v.y)]?.[Math.floor(v.x)] ?? null;

  const say = (words: string): void => { if (messageText) messageText.textContent = words; };

  const refreshKeyHud = (): void => {
    document.querySelectorAll<HTMLElement>(".key-slot").forEach((slot) => {
      const colour = slot.dataset["key"] as KeyColour;
      slot.hidden = !spec.keys.some((key) => key.colour === colour);
      slot.classList.toggle("is-found", held.has(colour));
    });
  };

  const sendBack = (reason: string): void => {
    player.x = respawn.x;
    player.y = respawn.y;
    player.vx = 0;
    player.vy = 0;
    flashUntil = performance.now() + 400;
    say(litCheckpoints.size > 0 ? `${reason} Back to your last flag.` : reason);
  };

  const finish = (): void => {
    won = true;
    onCleared();
    if (bannerTitle && bannerText) {
      bannerTitle.textContent = `${spec.name} cleared`;
      bannerText.textContent = spec.hint;
      showBanner(true);
    }
  };

  const restart = (): void => {
    won = false;
    held.clear();
    openedDoors.clear();
    keys.forEach((key) => { key.taken = false; });
    holes.clear();
    standing.clear();
    litCheckpoints.clear();
    respawn = { x: spec.start.x, y: spec.start.y };
    enemies.forEach((enemy, i) => {
      const source = spec.enemies[i];
      if (!source) return;
      enemy.x = source.x;
      enemy.y = source.y;
      enemy.dir = 1;
      enemy.visible = true;
    });
    player.x = spec.start.x;
    player.y = spec.start.y;
    player.vx = 0;
    player.vy = 0;
    showBanner(false);
    refreshKeyHud();
    say(spec.gimmick);
  };

  const pressed = new Set<string>();
  const touched = new Set<string>();

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
    pressed.add(key);
  });
  window.addEventListener("keyup", (event) => pressed.delete(event.key.toLowerCase()));
  window.addEventListener("blur", () => pressed.clear());

  document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
    const direction = button.dataset["move"] ?? "";
    const begin = (event: Event): void => { event.preventDefault(); touched.add(direction); };
    const end = (): void => { touched.delete(direction); };
    button.addEventListener("pointerdown", begin);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointerleave", end);
    button.addEventListener("pointercancel", end);
  });

  bannerButton?.addEventListener("click", restart);

  const wants = (...names: string[]): boolean => names.some((name) => pressed.has(name) || touched.has(name));

  function moveEnemy(enemy: typeof enemies[number], dt: number): void {
    const patrol = (): void => {
      if (enemy.axis === "x") {
        enemy.x += enemy.dir * enemy.speed * dt;
        if (enemy.x < enemy.low || enemy.x > enemy.high) enemy.dir *= -1;
      } else {
        enemy.y += enemy.dir * enemy.speed * dt;
        if (enemy.y < enemy.low || enemy.y > enemy.high) enemy.dir *= -1;
      }
    };
    const chase = (rate: number): void => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      const stepX = (dx / length) * rate * dt;
      const stepY = (dy / length) * rate * dt;
      if (!isWall(enemy.x + stepX, enemy.y)) enemy.x += stepX;
      if (!isWall(enemy.x, enemy.y + stepY)) enemy.y += stepY;
    };

    enemy.timer += dt;

    switch (enemy.kind) {
      case "specimen": {
        // Ambles until you get close, then hurries.
        const near = Math.hypot(player.x - enemy.x, player.y - enemy.y) < 6;
        if (near) chase(enemy.speed * 1.25); else patrol();
        break;
      }
      case "eel": {
        patrol();
        const sway = Math.sin(clock * 2.4 + enemy.phase) * 1.15;
        if (enemy.axis === "x") enemy.y = enemy.homeY + sway; else enemy.x = enemy.homeX + sway;
        break;
      }
      case "glitch": {
        patrol();
        // Flickers out of existence, and cannot catch you while gone.
        enemy.visible = Math.sin(clock * 3 + enemy.phase) > -0.35;
        break;
      }
      case "wisp": {
        if (enemy.timer > 1.4) {
          enemy.timer = 0;
          enemy.phase = Math.random() * Math.PI * 2;
        }
        const stepX = Math.cos(enemy.phase) * enemy.speed * dt;
        const stepY = Math.sin(enemy.phase) * enemy.speed * dt;
        if (!isWall(enemy.x + stepX, enemy.y)) enemy.x += stepX; else enemy.phase = Math.PI - enemy.phase;
        if (!isWall(enemy.x, enemy.y + stepY)) enemy.y += stepY; else enemy.phase = -enemy.phase;
        break;
      }
      case "skull": {
        // Lines itself up, then charges down the row it shares with you.
        const alignedY = Math.abs(player.y - enemy.y) < 0.9;
        const alignedX = Math.abs(player.x - enemy.x) < 0.9;
        if (alignedY || alignedX) chase(enemy.speed * 2.1); else patrol();
        break;
      }
      case "pixel": {
        // Walks a rectangle rather than a line.
        const leg = Math.floor(enemy.timer / 1.1) % 4;
        const step = enemy.speed * dt;
        if (leg === 0) enemy.x += step;
        else if (leg === 1) enemy.y += step;
        else if (leg === 2) enemy.x -= step;
        else enemy.y -= step;
        if (isWall(enemy.x, enemy.y)) { enemy.x = enemy.homeX; enemy.y = enemy.homeY; }
        break;
      }
      case "popup": {
        if (enemy.timer > 1.9) {
          enemy.timer = 0;
          const span = enemy.high - enemy.low;
          if (enemy.axis === "x") enemy.x = enemy.low + Math.random() * span;
          else enemy.y = enemy.low + Math.random() * span;
        }
        enemy.visible = enemy.timer > 0.25;
        break;
      }
      case "watcher": chase(enemy.speed); break;
      case "wanderer": {
        const drift = Math.sin(clock * 0.7 + enemy.phase) * enemy.speed * dt;
        if (enemy.axis === "x") enemy.x += drift; else enemy.y += drift;
        break;
      }
      default: patrol();
    }
  }

  let lastFrame = performance.now();

  function update(now: number): void {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (won) return;
    clock += dt;
    padCooldown = Math.max(0, padCooldown - dt);

    let dx = 0;
    let dy = 0;
    if (wants("arrowleft", "a", "left")) dx -= 1;
    if (wants("arrowright", "d", "right")) dx += 1;
    if (wants("arrowup", "w", "up")) dy -= 1;
    if (wants("arrowdown", "s", "down")) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    const under = tileAt(player);
    const speed = spec.playerSpeed * (under === "water" ? 0.5 : 1);
    const grip = under === "ice" ? 0.045 : 0.34;
    player.vx += (dx * speed - player.vx) * grip;
    player.vy += (dy * speed - player.vy) * grip;

    let pushX = 0;
    let pushY = 0;
    const gust = winds[Math.floor(player.y)]?.[Math.floor(player.x)];
    if (gust) { pushX = gust.x * 2.4; pushY = gust.y * 2.4; }

    const nextX = player.x + (player.vx + pushX) * dt;
    if (hitsWall(nextX, player.y, player.r)) player.vx = 0; else player.x = nextX;
    const nextY = player.y + (player.vy + pushY) * dt;
    if (hitsWall(player.x, nextY, player.r)) player.vy = 0; else player.y = nextY;

    // Crumbling floor: stand too long and it drops away beneath you.
    const footId = `${Math.floor(player.x)},${Math.floor(player.y)}`;
    if (under === "crumble" && !holes.has(footId)) {
      const held = (standing.get(footId) ?? 0) + dt;
      standing.set(footId, held);
      if (held >= CRUMBLE_DELAY) {
        standing.delete(footId);
        holes.set(footId, clock + CRUMBLE_REGROW);
        sendBack("The floor gave way.");
      }
    } else {
      standing.forEach((value, id) => {
        const cooled = value - dt * 1.6;
        if (cooled <= 0) standing.delete(id); else standing.set(id, cooled);
      });
    }
    holes.forEach((regrowAt, id) => { if (clock >= regrowAt) holes.delete(id); });

    if (padCooldown === 0) {
      for (const pad of spec.pads) {
        const onA = Math.hypot(player.x - pad.a.x, player.y - pad.a.y) < 0.6;
        const onB = Math.hypot(player.x - pad.b.x, player.y - pad.b.y) < 0.6;
        if (!onA && !onB) continue;
        const target = onA ? pad.b : pad.a;
        player.x = target.x;
        player.y = target.y;
        player.vx = 0;
        player.vy = 0;
        padCooldown = 0.7;
        say("Through the pad.");
        break;
      }
    }

    for (const door of spec.doors) {
      const id = `${door.x},${door.y}`;
      if (openedDoors.has(id) || !held.has(door.colour)) continue;
      const near = Math.abs(player.x - (door.x + 0.5)) < 1.1 && Math.abs(player.y - (door.y + 0.5)) < 1.1;
      if (!near) continue;
      spec.doors.filter((other) => other.colour === door.colour).forEach((other) => openedDoors.add(`${other.x},${other.y}`));
      say(`The ${door.colour} door swings open.`);
      break;
    }

    for (const key of keys) {
      if (key.taken) continue;
      if (Math.hypot(player.x - (key.x + 0.5), player.y - (key.y + 0.5)) < 0.7) {
        key.taken = true;
        held.add(key.colour);
        refreshKeyHud();
        say(`You picked up the ${key.colour} key.`);
      }
    }

    const sign = spec.signs.find((entry) => Math.hypot(player.x - (entry.x + 0.5), player.y - (entry.y + 0.5)) < 1.2);
    if (sign && sign.words !== lastSign) {
      lastSign = sign.words;
      say(sign.words);
    } else if (!sign) {
      lastSign = "";
    }

    spec.checkpoints.forEach((flag, i) => {
      if (litCheckpoints.has(i)) return;
      if (Math.hypot(player.x - flag.x, player.y - flag.y) > 0.8) return;
      litCheckpoints.add(i);
      respawn = { x: flag.x, y: flag.y };
      say("Checkpoint reached.");
    });

    if (under === "spike") sendBack("Spikes.");

    for (const enemy of enemies) {
      moveEnemy(enemy, dt);
      if (!enemy.visible) continue;
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 0.75) {
        sendBack(`The ${spec.enemyName} got you.`);
      }
    }

    if (Math.hypot(player.x - spec.treasure.x, player.y - spec.treasure.y) < 0.8) finish();
  }

  const doorColours: Record<KeyColour, string> = { red: "#ff5d5d", blue: "#57b6ff", gold: "#ffcc45" };

  function drawEnemy(enemy: typeof enemies[number], now: number): void {
    if (!context || !enemy.visible) return;
    const px = enemy.x * TILE;
    const py = enemy.y * TILE;
    const wobble = Math.sin(now / 180 + enemy.phase) * 2;
    context.fillStyle = spec.palette.blob;

    switch (enemy.kind) {
      case "scarecrow":
        context.fillRect(px - 3, py - 4, 6, 18);
        context.fillRect(px - 12, py - 2, 24, 4);
        context.beginPath();
        context.arc(px, py - 10, 8, 0, Math.PI * 2);
        context.fill();
        break;
      case "specimen":
        context.beginPath();
        context.ellipse(px, py, 12 + wobble, 10 - wobble, 0, 0, Math.PI * 2);
        context.fill();
        context.fillRect(px - 11, py + 4, 4, 8);
        context.fillRect(px + 7, py + 4, 4, 8);
        break;
      case "eel":
        context.beginPath();
        context.ellipse(px, py, 16, 6, Math.sin(now / 200) * 0.4, 0, Math.PI * 2);
        context.fill();
        break;
      case "glitch":
        for (let i = 0; i < 4; i += 1) {
          context.fillRect(px - 12 + i * 7, py - 11 + ((i * 5 + Math.floor(now / 90)) % 3) * 7, 6, 8);
        }
        break;
      case "wisp":
        context.globalAlpha = 0.85;
        context.beginPath();
        context.arc(px, py, 10 + wobble, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.35;
        context.beginPath();
        context.arc(px, py, 17, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        break;
      case "skull":
        context.beginPath();
        context.arc(px, py - 2, 10, 0, Math.PI * 2);
        context.fill();
        context.fillRect(px - 8, py + 4, 16, 7);
        context.fillStyle = "rgb(0 0 0 / .75)";
        context.fillRect(px - 6, py - 4, 4, 5);
        context.fillRect(px + 2, py - 4, 4, 5);
        return;
      case "pixel":
        context.fillRect(px - 10, py - 10, 20, 20);
        context.fillStyle = spec.palette.bg;
        context.fillRect(px - 6, py - 6, 4, 4);
        context.fillRect(px + 2, py - 6, 4, 4);
        return;
      case "popup":
        context.fillRect(px - 14, py - 11, 28, 22);
        context.fillStyle = "rgb(0 0 0 / .55)";
        context.fillRect(px - 14, py - 11, 28, 6);
        context.fillStyle = spec.palette.bg;
        context.font = "bold 10px monospace";
        context.fillText("lol", px - 8, py + 6);
        return;
      case "watcher":
        context.beginPath();
        context.arc(px, py, 12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fff";
        context.beginPath();
        context.arc(px, py, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#000";
        context.beginPath();
        context.arc(px + (player.x > enemy.x ? 2 : -2), py, 2.5, 0, Math.PI * 2);
        context.fill();
        return;
      case "wanderer":
        context.globalAlpha = 0.7;
        context.beginPath();
        context.arc(px, py, 11 + wobble, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 1;
        break;
      default:
        context.beginPath();
        context.arc(px, py, 11, 0, Math.PI * 2);
        context.fill();
    }

    context.fillStyle = "rgb(0 0 0 / .7)";
    context.fillRect(px - 5, py - 3, 3, 4);
    context.fillRect(px + 2, py - 3, 3, 4);
  }

  function draw(now: number): void {
    if (!canvas || !context) return;
    const viewW = canvas.width / TILE;
    const viewH = canvas.height / TILE;
    const camX = Math.max(0, Math.min(MAP_W - viewW, player.x - viewW / 2));
    const camY = Math.max(0, Math.min(MAP_H - viewH, player.y - viewH / 2));

    context.fillStyle = spec.palette.bg;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(-camX * TILE, -camY * TILE);

    const x0 = Math.floor(camX);
    const y0 = Math.floor(camY);
    const x1 = Math.ceil(camX + viewW) + 1;
    const y1 = Math.ceil(camY + viewH) + 1;

    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (grid[y]?.[x] !== ".") continue;
        const id = `${x},${y}`;
        if (holes.has(id)) {
          context.fillStyle = spec.palette.bg;
          context.fillRect(x * TILE, y * TILE, TILE, TILE);
          continue;
        }
        const kind = terrain[y]?.[x];
        context.fillStyle = kind === "water" ? spec.palette.water
          : kind === "ice" ? spec.palette.ice
          : kind === "spike" ? spec.palette.spike
          : kind === "crumble" ? spec.palette.crumble
          : kind === "wind" ? spec.palette.wind
          : (x + y) % 2 === 0 ? spec.palette.floorA : spec.palette.floorB;
        context.fillRect(x * TILE, y * TILE, TILE, TILE);

        if (kind === "spike") {
          context.fillStyle = "rgb(0 0 0 / .45)";
          for (let i = 0; i < 3; i += 1) {
            context.beginPath();
            context.moveTo(x * TILE + 5 + i * 9, y * TILE + 26);
            context.lineTo(x * TILE + 9 + i * 9, y * TILE + 8);
            context.lineTo(x * TILE + 13 + i * 9, y * TILE + 26);
            context.fill();
          }
        }
        if (kind === "crumble") {
          const strain = standing.get(id) ?? 0;
          context.strokeStyle = `rgb(0 0 0 / ${(0.25 + strain).toFixed(2)})`;
          context.lineWidth = 1 + strain * 3;
          context.beginPath();
          context.moveTo(x * TILE + 4, y * TILE + 22);
          context.lineTo(x * TILE + 14, y * TILE + 9);
          context.lineTo(x * TILE + 22, y * TILE + 25);
          context.stroke();
        }
        if (kind === "wind") {
          const gust = winds[y]?.[x];
          context.strokeStyle = "rgb(255 255 255 / .22)";
          context.lineWidth = 2;
          const drift = ((now / 14) % TILE);
          context.beginPath();
          for (let i = 0; i < 2; i += 1) {
            const offset = (drift + i * 16) % TILE;
            const sx = x * TILE + (gust?.x ? offset : 8 + i * 12);
            const sy = y * TILE + (gust?.y ? offset : 8 + i * 12);
            context.moveTo(sx, sy);
            context.lineTo(sx + (gust?.x ?? 0) * 9, sy + (gust?.y ?? 0) * 9);
          }
          context.stroke();
        }
      }
    }

    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (grid[y]?.[x] !== "#") continue;
        const touchesFloor = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
          .some(([ox, oy]) => grid[y + (oy ?? 0)]?.[x + (ox ?? 0)] === ".");
        if (!touchesFloor) continue;
        context.fillStyle = spec.palette.wall;
        context.fillRect(x * TILE, y * TILE, TILE, TILE);
        context.fillStyle = spec.palette.wallTop;
        context.fillRect(x * TILE, y * TILE, TILE, 4);
      }
    }

    spec.pads.forEach((pad) => {
      [pad.a, pad.b].forEach((spot) => {
        const pulse = 6 + Math.sin(now / 220 + spot.x) * 2;
        context.strokeStyle = "#9df";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(spot.x * TILE, spot.y * TILE, pulse + 5, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = "rgb(150 220 255 / .3)";
        context.beginPath();
        context.arc(spot.x * TILE, spot.y * TILE, pulse, 0, Math.PI * 2);
        context.fill();
      });
    });

    spec.checkpoints.forEach((flag, i) => {
      const lit = litCheckpoints.has(i);
      const px = flag.x * TILE;
      const py = flag.y * TILE;
      context.fillStyle = lit ? "#8a7a5e" : "#4b4740";
      context.fillRect(px - 1, py - 14, 3, 26);
      const wave = lit ? Math.sin(now / 220 + i) * 2 : 0;
      context.fillStyle = lit ? "#ffcc45" : "#5d574d";
      context.beginPath();
      context.moveTo(px + 2, py - 14);
      context.lineTo(px + 16, py - 9 + wave);
      context.lineTo(px + 2, py - 4);
      context.fill();
      if (lit) {
        context.strokeStyle = "rgb(255 204 69 / .35)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(px, py + 11, 9, 0, Math.PI * 2);
        context.stroke();
      }
    });

    spec.signs.forEach((sign) => {
      context.fillStyle = "#6b5334";
      context.fillRect(sign.x * TILE + 11, sign.y * TILE + 8, 10, 18);
      context.fillStyle = "#c9a86a";
      context.fillRect(sign.x * TILE + 5, sign.y * TILE + 5, 22, 13);
    });

    spec.doors.forEach((door) => {
      if (openedDoors.has(`${door.x},${door.y}`)) return;
      context.fillStyle = doorColours[door.colour];
      context.fillRect(door.x * TILE + 2, door.y * TILE + 2, TILE - 4, TILE - 4);
      context.fillStyle = "rgb(0 0 0 / .35)";
      context.fillRect(door.x * TILE + 2, door.y * TILE + TILE / 2 - 2, TILE - 4, 4);
    });

    keys.forEach((key) => {
      if (key.taken) return;
      const bob = Math.sin(now / 260 + key.x) * 2;
      context.fillStyle = doorColours[key.colour];
      context.beginPath();
      context.arc(key.x * TILE + 16, key.y * TILE + 14 + bob, 6, 0, Math.PI * 2);
      context.fill();
      context.fillRect(key.x * TILE + 14, key.y * TILE + 18 + bob, 4, 9);
      context.fillRect(key.x * TILE + 18, key.y * TILE + 23 + bob, 4, 3);
    });

    const glow = 0.5 + Math.sin(now / 300) * 0.2;
    context.fillStyle = `rgb(255 204 69 / ${glow.toFixed(2)})`;
    context.beginPath();
    context.arc(spec.treasure.x * TILE, spec.treasure.y * TILE, 22, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#a9752a";
    context.fillRect(spec.treasure.x * TILE - 10, spec.treasure.y * TILE - 4, 20, 15);
    context.fillStyle = "#ffcc45";
    context.fillRect(spec.treasure.x * TILE - 10, spec.treasure.y * TILE - 8, 20, 6);

    enemies.forEach((enemy) => drawEnemy(enemy, now));

    const hurt = now < flashUntil;
    context.fillStyle = hurt ? "#ff8a8a" : "#f0efe6";
    context.beginPath();
    context.arc(player.x * TILE, player.y * TILE, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1b2630";
    context.fillRect(player.x * TILE - 5, player.y * TILE - 3, 3, 4);
    context.fillRect(player.x * TILE + 2, player.y * TILE - 3, 3, 4);

    context.restore();

    if (spec.fog > 0) {
      const px = (player.x - camX) * TILE;
      const py = (player.y - camY) * TILE;
      const radius = spec.fog * TILE;
      const shade = context.createRadialGradient(px, py, radius * 0.35, px, py, radius);
      shade.addColorStop(0, "rgb(0 0 0 / 0)");
      shade.addColorStop(1, "rgb(0 0 0 / .96)");
      context.fillStyle = shade;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function loop(now: number): void {
    update(now);
    draw(now);
    window.requestAnimationFrame(loop);
  }

  refreshKeyHud();
  say(spec.gimmick);
  window.requestAnimationFrame(loop);
}
