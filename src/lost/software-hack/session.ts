// Software Hack: break into hostile AIs with little minigames, and patch your
// own antivirus when a vulnerability shows up. Ported from
// kids-games/software_hack.

export const SCREEN_WIDTH = 1000;
export const SCREEN_HEIGHT = 700;

export const INTRUSION_MAX = 40;
export const INTEGRITY_MAX = 100;
export const HEAT_MAX = 100;

export const BASE_VULN_CHANCE_PER_HACK = 0.14;
export const VULN_CHANCE_HEAT_BONUS = 0.28;

export const INTEGRITY_LOSS_ON_HACK_FAIL = 10;
export const INTEGRITY_LOSS_ON_AV_FAIL = 22;
export const INTEGRITY_GAIN_ON_AV_SUCCESS = 18;

export const HACK_INTRUSION_GAIN = 30;
export const JOB_COMPLETE_BONUS_COINS = 250;

export const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

export function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------- the money

export const DENOMINATIONS: [string, number][] = [
  ["Intergalactic Orb", 10000],
  ["Core of the Earth", 1000],
  ["Diamond", 100],
  ["Dollar", 10],
  ["Coin", 1],
];

export function formatCurrencyShort(coins: number): string {
  let remainder = Math.max(0, Math.trunc(coins));
  const parts: string[] = [];
  for (const [label, value] of [
    ["O", 10000],
    ["C", 1000],
    ["D", 100],
    ["$", 10],
    ["c", 1],
  ] as [string, number][]) {
    const count = Math.trunc(remainder / value);
    remainder -= count * value;
    if (count) parts.push(`${count}${label}`);
  }
  return parts.length > 0 ? parts.join(" ") : "0c";
}

export interface LootDrop {
  name: string;
  coins: number;
  count: number;
}

// The good stuff is rare on purpose.
export function rollHackLoot(random: () => number): LootDrop {
  const roll = random();
  if (roll < 0.001) return { name: "Intergalactic Orb", coins: 10000, count: 1 };
  if (roll < 0.007) return { name: "Core of the Earth", coins: 1000, count: 1 };
  if (roll < 0.027) return { name: "Diamond", coins: 100, count: 1 };
  if (roll < 0.147) {
    const count = 1 + (random() < 0.35 ? 1 : 0);
    return { name: "Dollar", coins: 10 * count, count };
  }
  const coins = 2 + Math.floor(random() * 7);
  return { name: "Coin", coins, count: coins };
}

export function formatDrop(drop: LootDrop): string {
  if (drop.count === 1) return `+1 ${drop.name}`;
  return `+${drop.count} ${drop.name === "Coin" ? "Coin" : `${drop.name}s`}`;
}

export function dropColor(drop: LootDrop): string {
  if (drop.coins >= 10000) return "#dc78ff";
  if (drop.coins >= 1000) return "#ff7850";
  if (drop.coins >= 100) return "#78d2ff";
  if (drop.coins >= 10) return "#78ff78";
  return "#ffd25a";
}

// --------------------------------------------------------------- the minigames

export interface MinigameResult {
  success: boolean;
  coins: number;
  intrusionDelta: number;
  integrityDelta: number;
  message: string;
}

export type PadIndex = 0 | 1 | 2 | 3;

export interface TimingTrace {
  kind: "timing";
  name: "Timing Trace";
  time: number;
  timeLimit: number;
  cursor: number;
  direction: number;
  cursorSpeed: number;
  windowCenter: number;
  windowSize: number;
  done: boolean;
  result: MinigameResult | null;
}

export type SimonPhase = "intro" | "show" | "ready" | "go" | "input";

export interface SimonPattern {
  kind: "simon";
  name: "Pattern Repeat";
  sequence: number[];
  phase: SimonPhase;
  time: number;
  showIndex: number;
  showTimer: number;
  flashOn: boolean;
  phaseTimer: number;
  inputIndex: number;
  inputTimer: number;
  selected: number;
  flashSeconds: number;
  gapSeconds: number;
  inputTimeLimit: number;
  done: boolean;
  result: MinigameResult | null;
}

export type IconShape = "circle" | "square" | "triangle" | "bolt";

export interface PatchMatch {
  kind: "patch";
  name: "AV Patch Match";
  time: number;
  timeLimit: number;
  strict: boolean;
  targetShape: IconShape;
  targetColor: string;
  choices: { shape: IconShape; color: string }[];
  correctIndex: number;
  done: boolean;
  result: MinigameResult | null;
}

export type Minigame = TimingTrace | SimonPattern | PatchMatch;

export const PAD_COLORS = ["#00eeff", "#ff46eb", "#78ff78", "#ffd25a"];
export const ICON_SHAPES: IconShape[] = ["circle", "square", "triangle", "bolt"];

export function makeTimingTrace(difficulty: number, random: () => number): TimingTrace {
  const d = clamp(difficulty, 0, 1);
  return {
    kind: "timing",
    name: "Timing Trace",
    time: 0,
    timeLimit: clamp(7 - 2 * d, 4.5, 7),
    cursor: 0,
    direction: 1,
    cursorSpeed: clamp(0.85 + 1.65 * d, 0.85, 2.5),
    windowCenter: 0.25 + random() * 0.5,
    windowSize: clamp(0.22 - 0.1 * d, 0.1, 0.22),
    done: false,
    result: null,
  };
}

export function makeSimon(difficulty: number, random: () => number): SimonPattern {
  const d = clamp(difficulty, 0, 1);
  const length = Math.trunc(3 + Math.round(4 * d));
  return {
    kind: "simon",
    name: "Pattern Repeat",
    sequence: Array.from({ length }, () => Math.floor(random() * 4)),
    phase: "intro",
    time: 0,
    showIndex: 0,
    showTimer: 0,
    flashOn: true,
    phaseTimer: 0,
    inputIndex: 0,
    inputTimer: 0,
    selected: 0,
    flashSeconds: clamp(0.55 - 0.2 * d, 0.3, 0.55),
    gapSeconds: clamp(0.25 - 0.08 * d, 0.14, 0.25),
    inputTimeLimit: clamp(9.5 - 3 * d, 6, 9.5),
    done: false,
    result: null,
  };
}

export function makePatchMatch(difficulty: number, random: () => number): PatchMatch {
  const d = clamp(difficulty, 0, 1);
  const strict = d >= 0.55;
  const targetShape = ICON_SHAPES[Math.floor(random() * 4)] ?? "circle";
  const targetColor = PAD_COLORS[Math.floor(random() * 4)] ?? "#00eeff";
  const correctIndex = Math.floor(random() * 4);

  const choices: { shape: IconShape; color: string }[] = [];
  for (let i = 0; i < 4; i += 1) {
    if (i === correctIndex) {
      choices.push({ shape: targetShape, color: targetColor });
      continue;
    }
    const otherShapes = ICON_SHAPES.filter((shape) => shape !== targetShape);
    const otherShape = otherShapes[Math.floor(random() * otherShapes.length)] ?? "square";
    if (!strict) {
      // Easy: the wrong ones are the wrong shape, same colour.
      choices.push({ shape: otherShape, color: targetColor });
      continue;
    }
    // Hard: the wrong ones match on one thing but never both.
    const otherColors = PAD_COLORS.filter((color) => color !== targetColor);
    const otherColor = otherColors[Math.floor(random() * otherColors.length)] ?? "#ff46eb";
    if (random() < 0.5) choices.push({ shape: targetShape, color: otherColor });
    else choices.push({ shape: otherShape, color: targetColor });
  }

  return {
    kind: "patch",
    name: "AV Patch Match",
    time: 0,
    timeLimit: clamp(7.5 - 2.5 * d, 4.8, 7.5),
    strict,
    targetShape,
    targetColor,
    choices,
    correctIndex,
    done: false,
    result: null,
  };
}

function finish(game: Minigame, result: MinigameResult): void {
  game.result = result;
  game.done = true;
}

export function updateMinigame(game: Minigame, seconds: number): void {
  if (game.done) return;
  game.time += seconds;

  if (game.kind === "timing") {
    game.cursor += game.direction * game.cursorSpeed * seconds;
    if (game.cursor >= 1) {
      game.cursor = 1;
      game.direction = -1;
    } else if (game.cursor <= 0) {
      game.cursor = 0;
      game.direction = 1;
    }
    if (game.time >= game.timeLimit) {
      finish(game, {
        success: false,
        coins: 0,
        intrusionDelta: 0,
        integrityDelta: 0,
        message: "Trace timed out.",
      });
    }
    return;
  }

  if (game.kind === "patch") {
    if (game.time >= game.timeLimit) {
      finish(game, {
        success: false,
        coins: 0,
        intrusionDelta: 0,
        integrityDelta: -INTEGRITY_LOSS_ON_AV_FAIL,
        message: "Too slow!",
      });
    }
    return;
  }

  // The pattern: watch it flash, then repeat it.
  if (game.phase === "intro") {
    if (game.time >= 0.9) {
      game.phase = "show";
      game.showIndex = 0;
      game.showTimer = 0;
      game.flashOn = true;
    }
    return;
  }
  if (game.phase === "show") {
    game.showTimer += seconds;
    const limit = game.flashOn ? game.flashSeconds : game.gapSeconds;
    if (game.showTimer < limit) return;
    game.showTimer = 0;
    if (game.flashOn) {
      game.flashOn = false;
      return;
    }
    game.flashOn = true;
    game.showIndex += 1;
    if (game.showIndex >= game.sequence.length) {
      game.phase = "ready";
      game.phaseTimer = 0;
    }
    return;
  }
  if (game.phase === "ready") {
    game.phaseTimer += seconds;
    if (game.phaseTimer >= 0.75) {
      game.phase = "go";
      game.phaseTimer = 0;
    }
    return;
  }
  if (game.phase === "go") {
    game.phaseTimer += seconds;
    if (game.phaseTimer >= 0.55) {
      game.phase = "input";
      game.inputTimer = 0;
    }
    return;
  }
  game.inputTimer += seconds;
  if (game.inputTimer >= game.inputTimeLimit) {
    finish(game, {
      success: false,
      coins: 0,
      intrusionDelta: 0,
      integrityDelta: 0,
      message: "Too slow.",
    });
  }
}

// A pad press, a space bar, or an arrow key, depending on the minigame.
export function pressMinigame(game: Minigame, key: string): void {
  if (game.done) return;

  if (game.kind === "timing") {
    if (key !== " " && key !== "Enter") return;
    const half = game.windowSize / 2;
    const success = game.cursor >= game.windowCenter - half && game.cursor <= game.windowCenter + half;
    finish(game, {
      success,
      coins: success ? 40 : 0,
      intrusionDelta: success ? HACK_INTRUSION_GAIN : 0,
      integrityDelta: 0,
      message: success ? "Exploit locked." : "Trace failed.",
    });
    return;
  }

  if (game.kind === "patch") {
    const chosen = "1234".indexOf(key);
    if (chosen < 0) return;
    const success = chosen === game.correctIndex;
    finish(game, {
      success,
      coins: success ? 30 : 0,
      intrusionDelta: 0,
      integrityDelta: success ? INTEGRITY_GAIN_ON_AV_SUCCESS : -INTEGRITY_LOSS_ON_AV_FAIL,
      message: success ? "AV updated!" : "Wrong patch!",
    });
    return;
  }

  if (game.phase !== "input") return;

  const padFromNumber = "1234".indexOf(key);
  if (padFromNumber >= 0) {
    game.selected = padFromNumber;
    commitSimon(game);
    return;
  }

  let row = Math.trunc(game.selected / 2);
  let col = game.selected % 2;
  if (key === "ArrowLeft" || key === "a") col = 0;
  else if (key === "ArrowRight" || key === "d") col = 1;
  else if (key === "ArrowUp" || key === "w") row = 0;
  else if (key === "ArrowDown" || key === "s") row = 1;
  else if (key === " " || key === "Enter") {
    commitSimon(game);
    return;
  }
  game.selected = row * 2 + col;
}

export function commitSimon(game: SimonPattern): void {
  if (game.selected !== game.sequence[game.inputIndex]) {
    finish(game, {
      success: false,
      coins: 0,
      intrusionDelta: 0,
      integrityDelta: 0,
      message: "Pattern mismatch.",
    });
    return;
  }
  game.inputIndex += 1;
  if (game.inputIndex >= game.sequence.length) {
    finish(game, {
      success: true,
      coins: 85,
      intrusionDelta: HACK_INTRUSION_GAIN,
      integrityDelta: 0,
      message: "Pattern accepted.",
    });
  }
}

// ------------------------------------------------------------------ the session

export type SessionPhase = "hack" | "vulnBanner" | "av" | "over";

export interface Toast {
  text: string;
  color: string;
  remaining: number;
}

export interface Session {
  phase: SessionPhase;
  minigame: Minigame | null;
  coins: number;
  highScore: number;
  intrusion: number;
  integrity: number;
  heat: number;
  job: number;
  hacksSinceVuln: number;
  bannerTime: number;
  toast: Toast | null;
  time: number;
  random: () => number;
}

export function newSession(highScore = 0, seed = Math.floor(Math.random() * 1e9)): Session {
  const random = randomFrom(seed);
  const session: Session = {
    phase: "hack",
    minigame: null,
    coins: 0,
    highScore,
    intrusion: 0,
    integrity: INTEGRITY_MAX,
    heat: 0,
    job: 1,
    hacksSinceVuln: 0,
    bannerTime: 0,
    toast: null,
    time: 0,
    random,
  };
  startHack(session);
  return session;
}

export function currentDifficulty(session: Session): number {
  const base = clamp((session.job - 1) / 8, 0, 1);
  return clamp(base + 0.55 * clamp(session.heat / HEAT_MAX, 0, 1), 0, 1);
}

export function startHack(session: Session): void {
  const difficulty = currentDifficulty(session);
  session.minigame =
    session.random() < 0.5
      ? makeTimingTrace(difficulty, session.random)
      : makeSimon(difficulty, session.random);
  session.phase = "hack";
}

export function startAv(session: Session): void {
  session.minigame = makePatchMatch(currentDifficulty(session), session.random);
  session.phase = "av";
}

function toast(session: Session, text: string, color: string, seconds = 1.1): void {
  session.toast = { text, color, remaining: seconds };
}

// The more noise you make, the more likely your own machine springs a leak.
export function shouldTriggerVulnerability(session: Session): boolean {
  if (session.hacksSinceVuln <= 0) return false;
  const chance = clamp(
    BASE_VULN_CHANCE_PER_HACK + VULN_CHANCE_HEAT_BONUS * clamp(session.heat / HEAT_MAX, 0, 1),
    0,
    0.75
  );
  return session.random() < chance;
}

export function applyResult(session: Session): void {
  const game = session.minigame;
  if (!game || !game.done || !game.result) return;
  const result = game.result;
  const wasHack = session.phase === "hack";

  session.coins = Math.max(0, session.coins + result.coins);
  session.intrusion = clamp(session.intrusion + result.intrusionDelta, 0, INTRUSION_MAX);
  session.integrity = clamp(session.integrity + result.integrityDelta, 0, INTEGRITY_MAX);

  let extra = "";
  let extraColor = "";

  if (wasHack) {
    if (result.success) {
      session.heat = clamp(session.heat + 7, 0, HEAT_MAX);
      session.hacksSinceVuln += 1;
      const drop = rollHackLoot(session.random);
      session.coins += drop.coins;
      extra = `Loot: ${formatDrop(drop)}`;
      extraColor = dropColor(drop);
    } else {
      session.integrity = clamp(session.integrity - INTEGRITY_LOSS_ON_HACK_FAIL, 0, INTEGRITY_MAX);
      session.heat = clamp(session.heat + 11, 0, HEAT_MAX);
    }
  } else if (result.success) {
    session.heat = clamp(session.heat - 14, 0, HEAT_MAX);
  }

  if (result.message && extra) toast(session, `${result.message}  ${extra}`, extraColor, 1.35);
  else if (result.message) toast(session, result.message, result.success ? "#78ff78" : "#ff5460");
  else if (extra) toast(session, extra, extraColor, 1.25);

  session.minigame = null;

  // Integrity gone means your own computer got hacked.
  if (session.integrity <= 0) {
    session.phase = "over";
    session.highScore = Math.max(session.highScore, session.coins);
    return;
  }

  if (session.intrusion >= INTRUSION_MAX) {
    session.coins += JOB_COMPLETE_BONUS_COINS;
    toast(session, `AI hacked. +${JOB_COMPLETE_BONUS_COINS}c`, "#ff46eb", 1.35);
    session.job += 1;
    session.intrusion = 0;
    session.heat = clamp(session.heat * 0.5, 0, HEAT_MAX);
    session.hacksSinceVuln = 0;
  }

  if (shouldTriggerVulnerability(session)) {
    session.phase = "vulnBanner";
    session.bannerTime = 0.65;
    session.hacksSinceVuln = 0;
  } else {
    startHack(session);
  }
}

export function stepSession(session: Session, seconds: number): void {
  if (session.phase === "over") return;
  session.time += seconds;

  if (session.toast) {
    session.toast.remaining -= seconds;
    if (session.toast.remaining <= 0) session.toast = null;
  }

  if (session.phase === "vulnBanner") {
    session.bannerTime -= seconds;
    if (session.bannerTime <= 0) startAv(session);
    return;
  }

  if (!session.minigame) return;
  updateMinigame(session.minigame, seconds);
  if (session.minigame.done) applyResult(session);
}

export function pressSession(session: Session, key: string): void {
  if (session.phase === "over" || !session.minigame) return;
  pressMinigame(session.minigame, key);
  if (session.minigame.done) applyResult(session);
}
