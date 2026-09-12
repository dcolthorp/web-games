import { H, W, clamp, ctx, drawCaption, inRect, lerp, roundRect, type Point } from "./engine";
import type { BonusLevel } from "./bonus2";
import { sounds } from "./sound";

// The mirror maze behind the mirror in Hundred Logic's The Room With Nothing.
// Every wall is a mirror, so your reflection follows you around. It's three
// floors tall, each bigger than the one below, and dark: you can only see the
// squares near you, plus a dim memory of the ones you've already passed. Find
// the stairs up on each floor, then the way out on the top floor. The stairs
// and the exit are always far from where you arrive, both to walk and in a
// straight line, so they're never just the other side of a mirror. New mazes
// every visit. Walk with the arrow keys, WASD, or by clicking the next square.
// Go half a minute without getting any closer and glowing arrows show the way.

type Phase = "walking" | "stairs" | "done";

// Walls in the order up, right, down, left.
type Walls = [boolean, boolean, boolean, boolean];

interface Spot {
  col: number;
  row: number;
}

interface Floor {
  cols: number;
  rows: number;
  cell: number;
  ox: number;
  oy: number;
  walls: Walls[];
  start: Spot;
  // The stairs up, or on the top floor, the exit.
  goal: Spot;
  seen: Set<number>;
  // How many squares you'd have to walk from each square to get to the goal.
  toGoal: number[];
}

// Columns, rows, and square size for each floor, bottom to top.
const FLOOR_SIZES: [number, number, number][] = [
  [15, 9, 56],
  [19, 11, 44],
  [23, 13, 36],
];
const AREA_TOP = 66;
const AREA_HEIGHT = 504;
const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
// How many squares away you can see in the dark.
const LIGHT = 2.6;
const BACK_BUTTON = { x: 16, y: 14, w: 96, h: 36 };

const MOVE_MS = 120;
const BUMP_MS = 220;
const STAIRS_MS = 900;
const HINT_AFTER_MS = 30000;
const HINT_STEPS = 8;

// How many squares you'd have to walk from `from` to each square.
function walkDistances(walls: Walls[], cols: number, from: number): number[] {
  const distance = new Array<number>(walls.length).fill(-1);
  const queue = [from];
  distance[from] = 0;
  for (let q = 0; q < queue.length; q += 1) {
    const current = queue[q];
    if (current === undefined) continue;
    DIRS.forEach(([dx, dy], dir) => {
      if (walls[current]?.[dir]) return;
      const next = (Math.floor(current / cols) + dy) * cols + (current % cols) + dx;
      if (distance[next] !== -1) return;
      distance[next] = (distance[current] ?? 0) + 1;
      queue.push(next);
    });
  }
  return distance;
}

function makeFloor([cols, rows, cell]: [number, number, number], start: Spot): Floor {
  const index = (col: number, row: number): number => row * cols + col;
  const walls: Walls[] = Array.from({ length: cols * rows }, () => [true, true, true, true]);

  // Carve a maze with exactly one way between any two squares.
  const visited = new Array<boolean>(cols * rows).fill(false);
  const stack = [index(start.col, start.row)];
  visited[index(start.col, start.row)] = true;
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (current === undefined) break;
    const col = current % cols;
    const row = Math.floor(current / cols);
    const options = DIRS.map(([dx, dy], dir) => ({ dir, col: col + dx, row: row + dy })).filter(
      (o) => o.col >= 0 && o.col < cols && o.row >= 0 && o.row < rows && !visited[index(o.col, o.row)]
    );
    const pick = options[Math.floor(Math.random() * options.length)];
    if (!pick) {
      stack.pop();
      continue;
    }
    const next = index(pick.col, pick.row);
    const here = walls[current];
    const there = walls[next];
    if (here) here[pick.dir] = false;
    if (there) there[(pick.dir + 2) % 4] = false;
    visited[next] = true;
    stack.push(next);
  }

  // The goal goes on whichever square is the longest walk from the start.
  const distance = new Array<number>(cols * rows).fill(-1);
  const queue = [index(start.col, start.row)];
  distance[index(start.col, start.row)] = 0;
  let far = index(start.col, start.row);
  for (let q = 0; q < queue.length; q += 1) {
    const current = queue[q];
    if (current === undefined) continue;
    const here = distance[current] ?? 0;
    if (here > (distance[far] ?? 0)) far = current;
    DIRS.forEach(([dx, dy], dir) => {
      if (walls[current]?.[dir]) return;
      const next = index((current % cols) + dx, Math.floor(current / cols) + dy);
      if (distance[next] !== -1) return;
      distance[next] = here + 1;
      queue.push(next);
    });
  }

  // The longest walk can end up right next to you through a mirror, which looks
  // like no walk at all. So only squares at least 60% as far away in a straight
  // line as the farthest square count, and of those, the longest walk wins.
  const straight = (i: number): number => Math.hypot((i % cols) - start.col, Math.floor(i / cols) - start.row);
  let farthestStraight = 0;
  for (let i = 0; i < cols * rows; i += 1) farthestStraight = Math.max(farthestStraight, straight(i));
  let goal = far;
  let longestWalk = -1;
  for (let i = 0; i < cols * rows; i += 1) {
    const walk = distance[i] ?? -1;
    if (straight(i) >= farthestStraight * 0.6 && walk > longestWalk) {
      longestWalk = walk;
      goal = i;
    }
  }

  return {
    cols,
    rows,
    cell,
    ox: (W - cols * cell) / 2,
    oy: AREA_TOP + (AREA_HEIGHT - rows * cell) / 2,
    walls,
    start,
    goal: { col: goal % cols, row: Math.floor(goal / cols) },
    seen: new Set(),
    toGoal: walkDistances(walls, cols, goal),
  };
}

// leave is called from the Back button and after walking out.
export function createMirrorMaze(leave: () => void): BonusLevel {
  let phase: Phase = "walking";
  let phaseStart = 0;
  let floorStart = 0;
  let floors: Floor[] = [];
  let floorIndex = 0;
  let player: Spot = { col: 0, row: 0 };
  let from: Spot = { ...player };
  let movedAt = -Infinity;
  let bumpAt = -Infinity;
  let bumpDir = 0;
  let climbed = false;
  let active = false;
  // For the hint: the closest you've walked to the goal on this floor, when you
  // last got closer, and when the arrows came on.
  let closestToGoal = Infinity;
  let closerAt = 0;
  let hintAt: number | null = null;

  const floor = (): Floor => floors[floorIndex] ?? makeFloor([3, 3, 56], { col: 0, row: 0 });
  const onTopFloor = (): boolean => floorIndex === FLOOR_SIZES.length - 1;

  function setPhase(next: Phase, now: number): void {
    phase = next;
    phaseStart = now;
  }

  function arrive(start: Spot, now: number): void {
    const size = FLOOR_SIZES[floorIndex] ?? [15, 9, 56];
    floors[floorIndex] = makeFloor(size, start);
    player = { ...start };
    from = { ...start };
    movedAt = -Infinity;
    floorStart = now;
    closestToGoal = floor().toGoal[start.row * floor().cols + start.col] ?? Infinity;
    closerAt = now;
    hintAt = null;
    reveal();
  }

  function reset(now: number): void {
    setPhase("walking", now);
    floors = [];
    floorIndex = 0;
    arrive({ col: 0, row: Math.floor((FLOOR_SIZES[0]?.[1] ?? 9) / 2) }, now);
    active = true;
  }

  function exitLevel(): void {
    active = false;
    leave();
  }

  // Squares close enough to you to see right now.
  function inLight(f: Floor, i: number): boolean {
    const col = i % f.cols;
    const row = Math.floor(i / f.cols);
    return Math.hypot(col - player.col, row - player.row) <= LIGHT;
  }

  function reveal(): void {
    const f = floor();
    for (let i = 0; i < f.cols * f.rows; i += 1) if (inLight(f, i)) f.seen.add(i);
  }

  const wallAt = (spot: Spot, dir: number): boolean => floor().walls[spot.row * floor().cols + spot.col]?.[dir] ?? true;

  function tryMove(dir: number): void {
    const now = performance.now();
    if (phase !== "walking") return;
    if (wallAt(player, dir)) {
      bumpAt = now;
      bumpDir = dir;
      sounds.tink();
      return;
    }
    const [dx, dy] = DIRS[dir] ?? [0, 0];
    from = { ...player };
    player = { col: player.col + dx, row: player.row + dy };
    movedAt = now;
    reveal();
    const left = floor().toGoal[player.row * floor().cols + player.col] ?? Infinity;
    if (left < closestToGoal) {
      closestToGoal = left;
      closerAt = now;
    }
    const { goal } = floor();
    if (player.col !== goal.col || player.row !== goal.row) return;
    if (onTopFloor()) {
      sounds.chime();
      setPhase("done", now);
    } else {
      sounds.whoosh(STAIRS_MS / 1000);
      climbed = false;
      setPhase("stairs", now);
    }
  }

  const KEYS: Record<string, number> = {
    ArrowUp: 0,
    w: 0,
    W: 0,
    ArrowRight: 1,
    d: 1,
    D: 1,
    ArrowDown: 2,
    s: 2,
    S: 2,
    ArrowLeft: 3,
    a: 3,
    A: 3,
  };

  window.addEventListener("keydown", (event) => {
    if (!active || phase !== "walking") return;
    const dir = KEYS[event.key];
    if (dir === undefined) return;
    event.preventDefault();
    tryMove(dir);
  });

  // The direction of the square you clicked, if it's right next to you.
  function clickedDir(p: Point): number | null {
    const f = floor();
    const col = Math.floor((p.x - f.ox) / f.cell);
    const row = Math.floor((p.y - f.oy) / f.cell);
    const dir = DIRS.findIndex(([dx, dy]) => player.col + dx === col && player.row + dy === row);
    return dir >= 0 ? dir : null;
  }

  const overBack = (p: Point): boolean => inRect(p, BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h);

  function pointerDown(p: Point): void {
    if (phase === "done" || overBack(p)) {
      sounds.tink();
      exitLevel();
      return;
    }
    const dir = clickedDir(p);
    if (dir !== null) tryMove(dir);
  }

  function pointerMove(): void {}

  function cursor(p: Point): string {
    if (phase === "done" || overBack(p)) return "pointer";
    if (phase === "stairs") return "wait";
    const dir = clickedDir(p);
    return dir !== null && !wallAt(player, dir) ? "pointer" : "default";
  }

  function update(now: number): void {
    // Half a minute without getting any closer, and the way lights up.
    if (phase === "walking" && hintAt === null && now - closerAt >= HINT_AFTER_MS) hintAt = now;
    if (phase !== "stairs") return;
    const elapsed = now - phaseStart;
    // Halfway through the fade, you're upstairs, standing about where the stairs were.
    if (!climbed && elapsed >= STAIRS_MS / 2) {
      climbed = true;
      const below = floor();
      floorIndex += 1;
      const [cols, rows] = FLOOR_SIZES[floorIndex] ?? [15, 9];
      arrive(
        {
          col: Math.round((player.col / (below.cols - 1)) * (cols - 1)),
          row: Math.round((player.row / (below.rows - 1)) * (rows - 1)),
        },
        now
      );
    }
    if (elapsed >= STAIRS_MS) setPhase("walking", now);
  }

  // ---------- drawing ----------

  function drawMirrorWall(x1: number, y1: number, x2: number, y2: number, scale: number): void {
    ctx.lineCap = "round";
    ctx.strokeStyle = "#5f7f93";
    ctx.lineWidth = 9 * scale;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "#cfe6f2";
    ctx.lineWidth = 5 * scale;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  function drawPerson(x: number, y: number, scale: number, alpha: number, flip: boolean): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(flip ? -scale : scale, scale);
    ctx.fillStyle = "#3d7bd9";
    roundRect(-11, -2, 22, 20, 7);
    ctx.fill();
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(0, -10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(3.5, -11, 1.8, 0, Math.PI * 2);
    ctx.arc(-3.5, -11, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGoal(f: Floor, now: number): void {
    const x = f.ox + f.goal.col * f.cell;
    const y = f.oy + f.goal.row * f.cell;
    const cx = x + f.cell / 2;
    const cy = y + f.cell / 2;
    const pulse = 0.5 + 0.5 * Math.sin(now / 300);
    const color = onTopFloor() ? "111, 207, 95" : "255, 210, 63";
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, f.cell);
    glow.addColorStop(0, `rgba(${color}, ${0.5 + 0.25 * pulse})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - f.cell, cy - f.cell, f.cell * 2, f.cell * 2);
    ctx.fillStyle = `rgb(${color})`;
    if (onTopFloor()) {
      ctx.font = `bold ${Math.round(f.cell * 0.34)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("EXIT", cx, cy);
    } else {
      // Steps going up
      for (let i = 0; i < 4; i += 1) {
        const w = f.cell * (0.3 + i * 0.15);
        ctx.fillRect(cx - w / 2, y + f.cell * (0.72 - i * 0.16), w, f.cell * 0.1);
      }
    }
  }

  // The next few steps toward the stairs or exit, as glowing arrows, even
  // through the dark.
  function drawHint(f: Floor, now: number): void {
    let spot = { ...player };
    ctx.strokeStyle = `rgba(157, 255, 138, ${0.55 + 0.35 * Math.sin(now / 250)})`;
    ctx.lineWidth = Math.max(2, 4 * (f.cell / 56));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let step = 0; step < HINT_STEPS; step += 1) {
      const i = spot.row * f.cols + spot.col;
      const here = f.toGoal[i] ?? 0;
      if (here <= 0) break;
      const dir = DIRS.findIndex(
        ([dx, dy], d) => !f.walls[i]?.[d] && f.toGoal[(spot.row + dy) * f.cols + spot.col + dx] === here - 1
      );
      const offset = DIRS[dir];
      if (!offset) break;
      const [dx, dy] = offset;
      const size = f.cell * 0.18;
      ctx.save();
      ctx.translate(f.ox + (spot.col + 0.5 + dx * 0.5) * f.cell, f.oy + (spot.row + 0.5 + dy * 0.5) * f.cell);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(-size, -size);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size);
      ctx.stroke();
      ctx.restore();
      spot = { col: spot.col + dx, row: spot.row + dy };
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }

  function draw(now: number): void {
    const f = floor();
    const scale = f.cell / 56;
    ctx.fillStyle = "#0a0d16";
    ctx.fillRect(0, 0, W, H);

    // Where you are, sliding between squares and nudging into mirrors you walk into.
    const t = clamp((now - movedAt) / MOVE_MS, 0, 1);
    const centerOf = (s: Spot): Point => ({ x: f.ox + s.col * f.cell + f.cell / 2, y: f.oy + s.row * f.cell + f.cell / 2 });
    const a = centerOf(from);
    const b = centerOf(player);
    const bump = now - bumpAt < BUMP_MS ? Math.sin(((now - bumpAt) / BUMP_MS) * Math.PI) * 8 * scale : 0;
    const [bx, by] = DIRS[bumpDir] ?? [0, 0];
    const px = lerp(a.x, b.x, t) + bx * bump;
    const py = lerp(a.y, b.y, t) + by * bump;

    // Only the squares you've seen are drawn: bright near you, dim further off.
    for (const i of f.seen) {
      const col = i % f.cols;
      const row = Math.floor(i / f.cols);
      const x = f.ox + col * f.cell;
      const y = f.oy + row * f.cell;
      ctx.globalAlpha = inLight(f, i) ? 1 : 0.3;
      ctx.fillStyle = "rgba(40, 52, 80, 0.6)";
      ctx.fillRect(x, y, f.cell, f.cell);
      const w = f.walls[i];
      if (w?.[0]) drawMirrorWall(x, y, x + f.cell, y, scale);
      if (w?.[1]) drawMirrorWall(x + f.cell, y, x + f.cell, y + f.cell, scale);
      if (w?.[2]) drawMirrorWall(x, y + f.cell, x + f.cell, y + f.cell, scale);
      if (w?.[3]) drawMirrorWall(x, y, x, y + f.cell, scale);
    }
    ctx.globalAlpha = 1;
    if (f.seen.has(f.goal.row * f.cols + f.goal.col)) drawGoal(f, now);
    if (hintAt !== null && phase === "walking") drawHint(f, now);

    const light = ctx.createRadialGradient(px, py, 4, px, py, LIGHT * f.cell);
    light.addColorStop(0, "rgba(220, 240, 255, 0.12)");
    light.addColorStop(1, "rgba(220, 240, 255, 0)");
    ctx.fillStyle = light;
    ctx.fillRect(px - LIGHT * f.cell, py - LIGHT * f.cell, LIGHT * f.cell * 2, LIGHT * f.cell * 2);

    // Your reflection in each mirror right next to you, on the far side of it.
    DIRS.forEach(([dx, dy], dir) => {
      if (wallAt(player, dir)) drawPerson(px + dx * f.cell, py + dy * f.cell, scale, 0.28, dx !== 0);
    });
    drawPerson(px, py, scale, 1, false);

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 8);
    ctx.fill();
    ctx.fillStyle = "#f5efe6";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("← Back", BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);
    ctx.fillStyle = "#cfe6f2";
    ctx.font = "bold 22px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
    ctx.fillText(`MIRROR MAZE · FLOOR ${floorIndex + 1} OF ${FLOOR_SIZES.length}`, W / 2, 34);
    ctx.fillStyle = "#c77dff";
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("BONUS LEVEL", W - 22, 34);

    if (phase === "walking") {
      const text = onTopFloor()
        ? "Top floor. Find the way out."
        : floorIndex === 0
          ? "It's dark in here. Find the stairs up."
          : "Another floor, bigger this time. Find the stairs up.";
      if (hintAt !== null && now - hintAt < 5000) drawCaption("Stuck? Follow the glowing arrows.", (now - hintAt) / 1000);
      else drawCaption(text, (now - floorStart) / 1000);
    } else if (phase === "stairs") {
      // Fade out, climb, fade back in.
      const s = (now - phaseStart) / STAIRS_MS;
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.abs(s * 2 - 1)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1 - Math.abs(s * 2 - 1);
      ctx.fillStyle = "#ffd23f";
      ctx.font = "48px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`FLOOR ${Math.min(floorIndex + (climbed ? 1 : 2), FLOOR_SIZES.length)}`, W / 2, H / 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.7, (now - phaseStart) / 500)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#000";
      ctx.font = "54px Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif";
      ctx.strokeText("YOU GOT THROUGH THE MIRROR MAZE!", W / 2, H / 2 - 20);
      ctx.fillStyle = "#ffcf5a";
      ctx.fillText("YOU GOT THROUGH THE MIRROR MAZE!", W / 2, H / 2 - 20);
      ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = "#f5efe6";
      ctx.fillText("All three floors. Click to go back.", W / 2, H / 2 + 40);
    }
  }

  return { reset, update, draw, pointerDown, pointerMove, cursor };
}
