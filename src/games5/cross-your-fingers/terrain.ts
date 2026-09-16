// A piece of land, made up fresh every time. You only ever get one screenful of
// it, so whether there's anything worth having in there is luck.

export const TILE = 24;
export const COLS = 40;
export const ROWS = 25;

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
// Water you can swim through, so it isn't solid, but it isn't nothing either.
export const WATER = 4;

export const isSolid = (tile: number): boolean => tile !== AIR && tile !== WATER;
export const isWater = (tile: number): boolean => tile === WATER;

// What each kind of coin is worth.
export const COIN_VALUES = { plain: 1, blue: 3, red: 5, black: 10 } as const;
export type CoinKind = keyof typeof COIN_VALUES;

// How likely each kind is. Black game coins are the ones you cross your fingers for.
const COIN_CHANCES: [CoinKind, number][] = [
  ["plain", 0.58],
  ["blue", 0.26],
  ["red", 0.13],
  ["black", 0.03],
];

export interface Coin {
  kind: CoinKind;
  // In tiles, the middle of the coin.
  x: number;
  y: number;
  taken: boolean;
  // Which run of coins this one belongs to. Coins come in trails that start
  // somewhere, arc up, and come down somewhere else.
  trail: number;
}

export interface Piece {
  seed: number;
  tiles: Uint8Array;
  // The row the water comes up to, or ROWS when this piece came out dry.
  waterLevel: number;
  coins: Coin[];
  // Where you start, in pixels.
  spawnX: number;
  spawnY: number;
}

function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const tileAt = (piece: Piece, x: number, y: number): number => {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return STONE;
  return piece.tiles[y * COLS + x] ?? AIR;
};

const setTile = (tiles: Uint8Array, x: number, y: number, tile: number): void => {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
  tiles[y * COLS + x] = tile;
};

// The top of the ground in this column, or ROWS if the column is empty.
export function groundIn(piece: Piece, x: number): number {
  for (let y = 0; y < ROWS; y += 1) {
    if (isSolid(tileAt(piece, x, y))) return y;
  }
  return ROWS;
}

// Every open space you could actually get to, worked out by spreading out from
// the sky. Sealed-off pockets deep in the rock don't count, so nothing ends up
// somewhere you can never reach.
export function reachable(piece: Piece): boolean[] {
  const open = new Array<boolean>(COLS * ROWS).fill(false);
  const queue: number[] = [];
  for (let x = 0; x < COLS; x += 1) {
    if (isSolid(tileAt(piece, x, 0))) continue;
    open[x] = true;
    queue.push(x);
  }
  while (queue.length > 0) {
    const at = queue.pop() ?? 0;
    const x = at % COLS;
    const y = Math.floor(at / COLS);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (nextX < 0 || nextY < 0 || nextX >= COLS || nextY >= ROWS) continue;
      const next = nextY * COLS + nextX;
      if (open[next] || isSolid(tileAt(piece, nextX, nextY))) continue;
      open[next] = true;
      queue.push(next);
    }
  }
  return open;
}

function pickKind(roll: number): CoinKind {
  let sofar = 0;
  for (const [kind, chance] of COIN_CHANCES) {
    sofar += chance;
    if (roll < sofar) return kind;
  }
  return "plain";
}

export function makePiece(seed: number): Piece {
  const random = randomFrom(seed);
  const tiles = new Uint8Array(COLS * ROWS);

  // Hills: a few waves of different sizes added together, so no two pieces of
  // land come out the same shape.
  const waves = [
    { size: 3.2 + random() * 2.5, length: 9 + random() * 8, from: random() * 6.3 },
    { size: 1.6 + random() * 1.6, length: 4 + random() * 4, from: random() * 6.3 },
    { size: 0.8, length: 2 + random() * 2, from: random() * 6.3 },
  ];
  const middle = 11 + Math.floor(random() * 5);

  const heights: number[] = [];
  for (let x = 0; x < COLS; x += 1) {
    let height = middle;
    for (const wave of waves) height += Math.sin(x / wave.length + wave.from) * wave.size;
    heights.push(Math.max(4, Math.min(ROWS - 3, Math.round(height))));
  }

  for (let x = 0; x < COLS; x += 1) {
    const top = heights[x] ?? middle;
    for (let y = top; y < ROWS; y += 1) {
      setTile(tiles, x, y, y === top ? GRASS : y < top + 4 ? DIRT : STONE);
    }
  }

  const piece: Piece = { seed, tiles, waterLevel: ROWS, coins: [], spawnX: 0, spawnY: 0 };

  // Caves, chewed out underground. Some of the best coins end up down here.
  const caves = 2 + Math.floor(random() * 4);
  for (let cave = 0; cave < caves; cave += 1) {
    let x = 3 + random() * (COLS - 6);
    let y = (heights[Math.floor(x)] ?? middle) + 3 + random() * 8;
    const length = 12 + random() * 26;
    let heading = random() * Math.PI * 2;
    for (let step = 0; step < length; step += 1) {
      heading += (random() - 0.5) * 0.9;
      x += Math.cos(heading);
      y += Math.sin(heading) * 0.6;
      const wide = 1 + Math.round(random());
      for (let dx = -wide; dx <= wide; dx += 1) {
        for (let dy = -wide; dy <= wide; dy += 1) {
          const atX = Math.round(x) + dx;
          const atY = Math.round(y) + dy;
          // Never dig the grass away from under the sky, so the hills stay hills.
          if (atY <= (heights[atX] ?? middle)) continue;
          setTile(tiles, atX, atY, AIR);
        }
      }
    }
  }

  // Bedrock: the caves can chew through anything except the very bottom, so the
  // land always has a floor.
  for (let x = 0; x < COLS; x += 1) setTile(tiles, x, ROWS - 1, STONE);

  // Water. Some pieces come out dry, some have a sea in the dips, and the caves
  // under the water line flood.
  const lowest = Math.max(...heights);
  const highest = Math.min(...heights);
  if (random() < 0.7 && lowest > highest + 2) {
    piece.waterLevel = highest + 2 + Math.floor(random() * Math.max(1, lowest - highest - 1));
    for (let x = 0; x < COLS; x += 1) {
      for (let y = piece.waterLevel; y < ROWS; y += 1) {
        if (tileAt(piece, x, y) === AIR) setTile(tiles, x, y, WATER);
      }
    }
  }

  // Where you land: on dry ground near the middle if there is any, so you don't
  // start out of your depth.
  let start = Math.floor(COLS / 2);
  for (let step = 0; step < COLS; step += 1) {
    const tryX = (Math.floor(COLS / 2) + (step % 2 === 0 ? step / 2 : -(step + 1) / 2) + COLS) % COLS;
    if ((heights[tryX] ?? middle) < piece.waterLevel) {
      start = tryX;
      break;
    }
  }
  piece.spawnX = (start + 0.5) * TILE;
  piece.spawnY = ((heights[start] ?? middle) - 2) * TILE;

  // The coins come in trails: each one starts above a spot on the ground, arcs
  // up over whatever is in between, and comes down somewhere else. Following a
  // trail is the game — and a trail that arcs over deep water is one you ride
  // the water up to reach.
  const openSpace = reachable(piece);
  const canHoldCoin = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return false;
    if (isSolid(tileAt(piece, x, y))) return false;
    return openSpace[y * COLS + x] === true;
  };

  // Few enough that a poor piece of land is still a real possibility.
  const trails = 1 + Math.floor(random() * 3);
  for (let trail = 0; trail < trails; trail += 1) {
    const from = 2 + Math.floor(random() * (COLS - 12));
    const span = 5 + Math.floor(random() * 8);
    const to = Math.min(COLS - 3, from + span);
    const fromTop = heights[from] ?? middle;
    const toTop = heights[to] ?? middle;
    // How high the middle of the arc goes above the higher end of it.
    const lift = 2 + Math.floor(random() * 4);
    const peak = Math.min(fromTop, toTop) - lift;

    // One kind for the whole trail, and something better waiting at the top.
    const everyday = pickKind(random() * 0.85);
    const prize = pickKind(0.85 + random() * 0.15);

    const howMany = Math.max(3, Math.min(6, to - from));
    for (let step = 0; step <= howMany; step += 1) {
      const along = step / howMany;
      const x = Math.round(from + (to - from) * along);
      // A curve: down at the ends, up in the middle.
      const straight = fromTop - 1 + (toTop - fromTop) * along;
      const curve = Math.sin(along * Math.PI) * (straight - peak);
      const y = Math.round(straight - curve);
      if (!canHoldCoin(x, y)) continue;
      const atTheTop = step === Math.round(howMany / 2);
      piece.coins.push({ kind: atTheTop ? prize : everyday, x: x + 0.5, y: y + 0.5, taken: false, trail });
    }
  }

  // And one or two on their own, tucked down in the caves.
  const strays = Math.floor(random() * 2);
  for (let stray = 0; stray < strays; stray += 1) {
    const x = 2 + Math.floor(random() * (COLS - 4));
    const top = heights[x] ?? middle;
    for (let y = top + 2; y < ROWS - 1; y += 1) {
      if (!canHoldCoin(x, y)) continue;
      piece.coins.push({ kind: pickKind(random()), x: x + 0.5, y: y + 0.5, taken: false, trail: -1 });
      break;
    }
  }

  return piece;
}

// What this piece of land is worth if you can reach every coin on it.
export const pieceWorth = (piece: Piece): number =>
  piece.coins.reduce((total, coin) => total + COIN_VALUES[coin.kind], 0);
