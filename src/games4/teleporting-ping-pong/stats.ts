import { isBadgeRole, type BadgeRole } from "./identity";

const PROFILE_KEY = "teleporting-ping-pong-profile";
const PLAYERS_MET_KEY = "teleporting-ping-pong-players-met";
const MAX_PLAYERS_MET = 100;
const MAX_COUNT = 1_000_000;

const ADJECTIVES: readonly string[] = [
  "Speedy",
  "Sneaky",
  "Bouncy",
  "Glitchy",
  "Mighty",
  "Zippy",
  "Cosmic",
  "Turbo",
  "Wobbly",
  "Sparkly",
  "Spicy",
  "Quantum",
];
const NOUNS: readonly string[] = [
  "Paddle",
  "Banana",
  "Panda",
  "Rocket",
  "Noodle",
  "Wizard",
  "Toaster",
  "Comet",
  "Pickle",
  "Ninja",
  "Robot",
  "Otter",
];

// Bios are picked from these instead of typed, so nobody can put their real name, where they
// live, or anything mean in front of strangers.
export const BIO_PHRASES = {
  alt: "🥷 This is my alt account",
  main: "⭐ This is my main account",
  teleport: "🌀 I love teleporting",
  matrix: "🧮 I've been into the Matrix",
  banana: "🍌 Banana fan",
  space: "🌌 From outer space",
  fair: "🛡️ Here to keep the leaderboards fair",
  champion: "🏆 Tournament champion in training",
  swing: "⚡ Fastest swing around",
  cool: "😎 Too cool for the CPU",
  learning: "🐢 Still learning",
  fun: "🎮 Just playing for fun",
  goodGame: "🤝 Good game, every game",
  streak: "🔥 On a winning streak",
  newHere: "🎉 New here",
  pingPong: "🏓 Ping pong forever",
} as const;
export type BioPhrase = keyof typeof BIO_PHRASES;
export const MAX_BIO_PHRASES = 3;

export interface PlayerStats {
  id: string;
  name: string;
  teleports: number;
  gamesWon: number;
  tournamentsWon: number;
  bio: BioPhrase[];
}

export type LeaderboardCategory = "teleports" | "gamesWon" | "tournamentsWon";
export const LEADERBOARD_CATEGORIES: readonly LeaderboardCategory[] = ["teleports", "gamesWon", "tournamentsWon"];

export function isLeaderboardCategory(value: unknown): value is LeaderboardCategory {
  return typeof value === "string" && (LEADERBOARD_CATEGORIES as readonly string[]).includes(value);
}

export interface PlayerEntry {
  stats: PlayerStats;
  badge: BadgeRole | null;
  // Proved who they are with their secret key, so they can get moderator invites.
  verified: boolean;
  isYou: boolean;
}

export interface You {
  badge: BadgeRole | null;
  verified: boolean;
}

interface MetPlayer {
  stats: PlayerStats;
  badge: BadgeRole | null;
  verified: boolean;
}

type UnknownStats = Partial<Record<keyof PlayerStats, unknown>>;

function pick(words: readonly string[]): string {
  return words[Math.floor(Math.random() * words.length)] ?? "Mystery";
}

function randomNickname(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${Math.floor(Math.random() * 99) + 1}`;
}

// Players only ever show up under names built from the word lists above, so nobody
// in a tournament can put anything else on your screen.
function isNickname(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const [adjective, noun, number, ...rest] = value.split(" ");
  return (
    rest.length === 0 &&
    ADJECTIVES.includes(adjective ?? "") &&
    NOUNS.includes(noun ?? "") &&
    /^[1-9]\d?$/.test(number ?? "")
  );
}

function isBioPhrase(value: unknown): value is BioPhrase {
  return typeof value === "string" && Object.hasOwn(BIO_PHRASES, value);
}

function toBio(value: unknown): BioPhrase[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isBioPhrase))].slice(0, MAX_BIO_PHRASES);
}

function toCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(MAX_COUNT, Math.max(0, Math.floor(value)));
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Can't save right now, so this just won't be remembered.
  }
}

export function sanitizeStats(value: unknown): PlayerStats | null {
  if (!value || typeof value !== "object") return null;
  const { id, name, teleports, gamesWon, tournamentsWon, bio } = value as UnknownStats;
  if (typeof id !== "string" || id.length === 0 || id.length > 64 || !isNickname(name)) return null;
  return {
    id,
    name,
    teleports: toCount(teleports),
    gamesWon: toCount(gamesWon),
    tournamentsWon: toCount(tournamentsWon),
    bio: toBio(bio),
  };
}

export function loadProfile(): PlayerStats {
  const saved = readJson(PROFILE_KEY);
  const valid = sanitizeStats(saved);
  if (valid) return valid;

  const partial = (saved && typeof saved === "object" ? saved : {}) as UnknownStats;
  const profile: PlayerStats = {
    id: typeof partial.id === "string" && partial.id.length > 0 ? partial.id.slice(0, 64) : newId(),
    name: isNickname(partial.name) ? partial.name : randomNickname(),
    teleports: toCount(partial.teleports),
    gamesWon: toCount(partial.gamesWon),
    tournamentsWon: toCount(partial.tournamentsWon),
    bio: toBio(partial.bio),
  };
  writeJson(PROFILE_KEY, profile);
  return profile;
}

export function updateProfile(change: (profile: PlayerStats) => void): PlayerStats {
  const profile = loadProfile();
  change(profile);
  writeJson(PROFILE_KEY, profile);
  return profile;
}

export function renameProfile(): PlayerStats {
  return updateProfile((profile) => {
    profile.name = randomNickname();
  });
}

export function setBio(phrases: readonly BioPhrase[]): void {
  updateProfile((profile) => {
    profile.bio = toBio(phrases);
  });
}

export function setProfileId(id: string): void {
  if (loadProfile().id === id) return;
  updateProfile((profile) => {
    profile.id = id;
  });
}

function playersMet(): MetPlayer[] {
  const saved = readJson(PLAYERS_MET_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry: unknown) => {
    const { stats, badge, verified } = (entry ?? {}) as { stats?: unknown; badge?: unknown; verified?: unknown };
    const clean = sanitizeStats(stats);
    if (!clean) return [];
    const isVerified = verified === true;
    return [{ stats: clean, badge: isVerified && isBadgeRole(badge) ? badge : null, verified: isVerified }];
  });
}

// Everyone you face in a tournament gets saved with their latest stats. A player who
// couldn't prove who they are never replaces one who did.
export function rememberPlayer(stats: PlayerStats, badge: BadgeRole | null, verified: boolean): void {
  if (stats.id === loadProfile().id) return;
  const saved = playersMet();
  if (!verified && saved.some((player) => player.stats.id === stats.id)) return;
  const others = saved.filter((player) => player.stats.id !== stats.id);
  others.push({ stats, badge: verified ? badge : null, verified });
  writeJson(PLAYERS_MET_KEY, others.slice(-MAX_PLAYERS_MET));
}

function everyone(you: You): PlayerEntry[] {
  return [
    { stats: loadProfile(), badge: you.badge, verified: you.verified, isYou: true },
    ...playersMet().map((player) => ({ ...player, isYou: false })),
  ];
}

// Banned records are left off the board.
export function leaderboard(category: LeaderboardCategory, you: You, banned: ReadonlySet<string>): PlayerEntry[] {
  return everyone(you)
    .filter((entry) => !banned.has(entry.stats.id))
    .sort((a, b) => b.stats[category] - a.stats[category])
    .slice(0, 10);
}

// Suggestions while you type. Names that start with what you typed come first.
export function searchPlayers(query: string, you: You): PlayerEntry[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [];
  const startsWithTyped = (entry: PlayerEntry): number => (entry.stats.name.toLowerCase().startsWith(typed) ? 0 : 1);
  return everyone(you)
    .filter((entry) => entry.stats.name.toLowerCase().includes(typed))
    .sort((a, b) => startsWithTyped(a) - startsWithTyped(b) || a.stats.name.localeCompare(b.stats.name))
    .slice(0, 8);
}
