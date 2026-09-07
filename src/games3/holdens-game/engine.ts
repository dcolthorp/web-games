export type KeyColour = "red" | "blue" | "gold";
export type Terrain = "water" | "ice" | "spike";

export interface Rect { x: number; y: number; w: number; h: number }

export interface Palette {
  bg: string;
  floorA: string;
  floorB: string;
  wall: string;
  wallTop: string;
  water: string;
  ice: string;
  spike: string;
  blob: string;
}

export interface WorldSpec {
  index: number;
  name: string;
  hint: string;
  palette: Palette;
  rooms: Rect[];
  corridors: Rect[];
  doors: { x: number; y: number; colour: KeyColour }[];
  keys: { x: number; y: number; colour: KeyColour }[];
  signs: { x: number; y: number; words: string }[];
  blobs: { x: number; y: number; axis: "x" | "y"; low: number; high: number; speed: number }[];
  patches: { rect: Rect; kind: Terrain }[];
  start: { x: number; y: number };
  treasure: { x: number; y: number };
  playerSpeed: number;
  fog: number;
}

export const MAP_W = 40;
export const MAP_H = 28;
const TILE = 32;

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

  const grid = buildGrid(spec);

  // Terrain sits on top of the floor: water drags, ice slides, spikes bite.
  const terrain: (Terrain | null)[][] = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => null));
  spec.patches.forEach(({ rect, kind }) => {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        if (grid[y]?.[x] === ".") terrain[y]![x] = kind;
      }
    }
  });

  const keys = spec.keys.map((key) => ({ ...key, taken: false }));
  const blobs = spec.blobs.map((blob) => ({ ...blob, dir: 1 }));
  const openedDoors = new Set<string>();
  const held = new Set<KeyColour>();
  const player = { x: spec.start.x, y: spec.start.y, r: 0.34, vx: 0, vy: 0 };
  let won = false;
  let flashUntil = 0;
  let lastSign = "";

  const doorAt = (x: number, y: number): boolean =>
    spec.doors.some((door) => door.x === x && door.y === y && !openedDoors.has(`${door.x},${door.y}`));

  const blocked = (x: number, y: number): boolean => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    return grid[ty]?.[tx] === "#" || doorAt(tx, ty);
  };

  const hitsWall = (x: number, y: number, r: number): boolean =>
    blocked(x - r, y - r) || blocked(x + r, y - r) || blocked(x - r, y + r) || blocked(x + r, y + r);

  const terrainUnder = (): Terrain | null => terrain[Math.floor(player.y)]?.[Math.floor(player.x)] ?? null;

  const say = (words: string): void => { if (messageText) messageText.textContent = words; };

  const refreshKeyHud = (): void => {
    document.querySelectorAll<HTMLElement>(".key-slot").forEach((slot) => {
      const colour = slot.dataset["key"] as KeyColour;
      const used = spec.keys.some((key) => key.colour === colour);
      slot.hidden = !used;
      slot.classList.toggle("is-found", held.has(colour));
    });
  };

  const resetToStart = (reason: string): void => {
    player.x = spec.start.x;
    player.y = spec.start.y;
    player.vx = 0;
    player.vy = 0;
    flashUntil = performance.now() + 400;
    say(reason);
  };

  const finish = (): void => {
    won = true;
    onCleared();
    if (banner && bannerTitle && bannerText) {
      bannerTitle.textContent = `${spec.name} cleared`;
      bannerText.textContent = spec.hint;
      banner.hidden = false;
    }
  };

  const restart = (): void => {
    won = false;
    held.clear();
    openedDoors.clear();
    keys.forEach((key) => { key.taken = false; });
    player.x = spec.start.x;
    player.y = spec.start.y;
    player.vx = 0;
    player.vy = 0;
    if (banner) banner.hidden = true;
    refreshKeyHud();
    say("Arrow keys or WASD to move.");
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

  let lastFrame = performance.now();

  function update(now: number): void {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (won) return;

    let dx = 0;
    let dy = 0;
    if (wants("arrowleft", "a", "left")) dx -= 1;
    if (wants("arrowright", "d", "right")) dx += 1;
    if (wants("arrowup", "w", "up")) dy -= 1;
    if (wants("arrowdown", "s", "down")) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

    const under = terrainUnder();
    const speed = spec.playerSpeed * (under === "water" ? 0.5 : 1);
    // Ice keeps whatever momentum you had, so stopping takes planning.
    const grip = under === "ice" ? 0.045 : 0.34;
    player.vx += (dx * speed - player.vx) * grip;
    player.vy += (dy * speed - player.vy) * grip;

    const nextX = player.x + player.vx * dt;
    if (hitsWall(nextX, player.y, player.r)) player.vx = 0; else player.x = nextX;
    const nextY = player.y + player.vy * dt;
    if (hitsWall(player.x, nextY, player.r)) player.vy = 0; else player.y = nextY;

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

    if (under === "spike") resetToStart("Spikes. Back to the start.");

    for (const blob of blobs) {
      if (blob.axis === "x") {
        blob.x += blob.dir * blob.speed * dt;
        if (blob.x < blob.low || blob.x > blob.high) blob.dir *= -1;
      } else {
        blob.y += blob.dir * blob.speed * dt;
        if (blob.y < blob.low || blob.y > blob.high) blob.dir *= -1;
      }
      if (Math.hypot(player.x - blob.x, player.y - blob.y) < 0.75) {
        resetToStart("Caught. Back to the start, keys and all.");
      }
    }

    if (Math.hypot(player.x - spec.treasure.x, player.y - spec.treasure.y) < 0.8) finish();
  }

  const doorColours: Record<KeyColour, string> = { red: "#ff5d5d", blue: "#57b6ff", gold: "#ffcc45" };

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
        const kind = terrain[y]?.[x];
        context.fillStyle = kind === "water" ? spec.palette.water
          : kind === "ice" ? spec.palette.ice
          : kind === "spike" ? spec.palette.spike
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

    blobs.forEach((blob) => {
      const squish = Math.sin(now / 180 + blob.x) * 2;
      context.fillStyle = spec.palette.blob;
      context.beginPath();
      context.ellipse(blob.x * TILE, blob.y * TILE, 11 + squish, 11 - squish, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgb(0 0 0 / .7)";
      context.fillRect(blob.x * TILE - 5, blob.y * TILE - 3, 3, 4);
      context.fillRect(blob.x * TILE + 2, blob.y * TILE - 3, 3, 4);
    });

    const hurt = now < flashUntil;
    context.fillStyle = hurt ? "#ff8a8a" : "#f0efe6";
    context.beginPath();
    context.arc(player.x * TILE, player.y * TILE, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#1b2630";
    context.fillRect(player.x * TILE - 5, player.y * TILE - 3, 3, 4);
    context.fillRect(player.x * TILE + 2, player.y * TILE - 3, 3, 4);

    context.restore();

    // Fog is drawn last, in screen space, so it follows the player exactly.
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
  say("Arrow keys or WASD to move.");
  window.requestAnimationFrame(loop);
}
