const KEYS_KEY = "teleporting-ping-pong-keys";
// Proofs, badges, and bans are each signed with their own label, so nobody can trick a
// player into signing one thing that works as another.
const PROOF_LABEL = "teleporting-ping-pong-proof";
const GRANT_LABEL = "teleporting-ping-pong-grant";
const BAN_LABEL = "teleporting-ping-pong-ban";
const REPORT_LABEL = "teleporting-ping-pong-report";
const RECORD_ACTION_LABELS: Record<RecordActionKind, string> = { ban: BAN_LABEL, report: REPORT_LABEL };
// A badge can be handed down this many moderators deep before it stops counting.
const MAX_GRANT_CHAIN = 5;

export type ModeratorRole = "moderator" | "elder" | "leaderboard" | "dark";
export type BadgeRole = "creator" | ModeratorRole;
export const MODERATOR_ROLES: readonly ModeratorRole[] = ["moderator", "elder", "leaderboard", "dark"];
export const BADGE_ROLES: readonly BadgeRole[] = ["creator", ...MODERATOR_ROLES];

// Which badges each kind of moderator can hand out. Only the Creator can give a badge as strong as their own.
const GRANTABLE_ROLES: Record<BadgeRole, readonly ModeratorRole[]> = {
  creator: MODERATOR_ROLES,
  dark: ["moderator", "leaderboard", "elder"],
  elder: ["moderator", "leaderboard"],
  leaderboard: [],
  moderator: [],
};

export interface PublicKeyParts {
  x: string;
  y: string;
}

export interface Grant {
  playerId: string;
  role: ModeratorRole;
  issuedAt: number;
  signature: string;
  // Badges from the Creator leave these out. Anyone else's include who gave it and the badge that let them.
  issuer?: PublicKeyParts;
  parent?: Grant;
}

export type RecordActionKind = "ban" | "report";

// A ban or a report on one player's record in one leaderboard.
export interface RecordAction {
  playerId: string;
  category: string;
  issuedAt: number;
  issuer: PublicKeyParts;
  // The badge that let the issuer do this. The Creator doesn't need one.
  grant?: Grant;
  signature: string;
}

// The public half of the Creator's key. The secret half only lives in the Creator's own
// browser. Every moderator badge traces back to it, so nobody else can hand out badges
// from nothing or pretend to be the Creator. It belongs to Cosmic Banana 64.
const CREATOR_PUBLIC_KEY = {
  x: "3AbrrO9U7vE5xV2NPktSyRLc7FEwoYTCwpTX3QZQcIY",
  y: "wxuxBmX1kqmNiU84quUbE6p5HVme-OoIZDrxBHbSxoI",
} as PublicKeyParts | null;

const KEY_ALGORITHM: EcKeyGenParams = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_ALGORITHM: EcdsaParams = { name: "ECDSA", hash: "SHA-256" };

interface Identity {
  publicKey: PublicKeyParts;
  privateKey: CryptoKey;
  fingerprint: string;
}

interface SavedKeys {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

let identity: Identity | null = null;
let creatorFingerprint: string | null = null;
const encoder = new TextEncoder();

function cryptoAvailable(): boolean {
  return Boolean(globalThis.crypto?.subtle);
}

function toBase64Url(data: ArrayBuffer | Uint8Array): string {
  let binary = "";
  new Uint8Array(data).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function isBase64Url(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(value);
}

export function isModeratorRole(value: unknown): value is ModeratorRole {
  return typeof value === "string" && (MODERATOR_ROLES as readonly string[]).includes(value);
}

export function isBadgeRole(value: unknown): value is BadgeRole {
  return typeof value === "string" && (BADGE_ROLES as readonly string[]).includes(value);
}

export function grantableRoles(role: BadgeRole | null): readonly ModeratorRole[] {
  return role ? GRANTABLE_ROLES[role] : [];
}

export function canBanRecords(role: BadgeRole | null): boolean {
  return role === "leaderboard" || role === "dark" || role === "creator";
}

// Any moderator can report a record that looks hacked, so a Leaderboard Moderator can take a look.
export function canReportRecords(role: BadgeRole | null): boolean {
  return role !== null;
}

function canActOnRecords(kind: RecordActionKind, role: BadgeRole | null): boolean {
  return kind === "ban" ? canBanRecords(role) : canReportRecords(role);
}

export function sanitizePublicKey(value: unknown): PublicKeyParts | null {
  if (!value || typeof value !== "object") return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return isBase64Url(x, 64) && isBase64Url(y, 64) ? { x, y } : null;
}

export async function fingerprintOf(publicKey: PublicKeyParts): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${publicKey.x}.${publicKey.y}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function creatorId(): Promise<string | null> {
  if (!CREATOR_PUBLIC_KEY || !cryptoAvailable()) return null;
  creatorFingerprint ??= await fingerprintOf(CREATOR_PUBLIC_KEY);
  return creatorFingerprint;
}

function readSavedKeys(): SavedKeys | null {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<SavedKeys>) : null;
    return saved?.publicJwk && saved.privateJwk ? { publicJwk: saved.publicJwk, privateJwk: saved.privateJwk } : null;
  } catch {
    return null;
  }
}

async function createKeys(): Promise<SavedKeys> {
  const pair = await crypto.subtle.generateKey(KEY_ALGORITHM, true, ["sign", "verify"]);
  const keys = {
    publicJwk: await crypto.subtle.exportKey("jwk", pair.publicKey),
    privateJwk: await crypto.subtle.exportKey("jwk", pair.privateKey),
  };
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
  return keys;
}

// Every player gets their own secret key the first time they play. Their player id comes from it.
export async function loadIdentity(): Promise<string | null> {
  if (!cryptoAvailable()) return null;
  try {
    const keys = readSavedKeys() ?? (await createKeys());
    const publicKey = sanitizePublicKey(keys.publicJwk);
    if (!publicKey) return null;
    const privateKey = await crypto.subtle.importKey("jwk", keys.privateJwk, KEY_ALGORITHM, false, ["sign"]);
    identity = { publicKey, privateKey, fingerprint: await fingerprintOf(publicKey) };
    return identity.fingerprint;
  } catch {
    return null;
  }
}

export function myPublicKey(): PublicKeyParts | null {
  return identity?.publicKey ?? null;
}

export function myFingerprint(): string | null {
  return identity?.fingerprint ?? null;
}

export function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function signText(text: string): Promise<string | null> {
  if (!identity) return null;
  try {
    return toBase64Url(await crypto.subtle.sign(SIGN_ALGORITHM, identity.privateKey, encoder.encode(text)));
  } catch {
    return null;
  }
}

async function verifyText(publicKey: PublicKeyParts, text: string, signature: unknown): Promise<boolean> {
  if (!cryptoAvailable() || !isBase64Url(signature, 200)) return false;
  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: publicKey.x, y: publicKey.y, ext: true },
      KEY_ALGORITHM,
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(SIGN_ALGORITHM, key, signatureBytes, encoder.encode(text));
  } catch {
    return false;
  }
}

// The other player sends random letters; signing them proves we really own our key.
export async function proveNonce(nonce: unknown): Promise<string | null> {
  if (!isBase64Url(nonce, 64)) return null;
  return signText(`${PROOF_LABEL}|${nonce}`);
}

export function checkProof(publicKey: PublicKeyParts, nonce: string, signature: unknown): Promise<boolean> {
  return verifyText(publicKey, `${PROOF_LABEL}|${nonce}`, signature);
}

export function isCreatorKey(publicKey: PublicKeyParts): boolean {
  return CREATOR_PUBLIC_KEY !== null && publicKey.x === CREATOR_PUBLIC_KEY.x && publicKey.y === CREATOR_PUBLIC_KEY.y;
}

export function iAmCreator(): boolean {
  return identity !== null && isCreatorKey(identity.publicKey);
}

function grantText(playerId: string, role: ModeratorRole, issuedAt: number, issuerId: string | null): string {
  const text = `${GRANT_LABEL}|${playerId}|${role}|${issuedAt}`;
  return issuerId ? `${text}|${issuerId}` : text;
}

// `myGrant` is the badge that lets a moderator who isn't the Creator hand out badges.
export async function makeGrant(playerId: string, role: ModeratorRole, myGrant: Grant | null): Promise<Grant | null> {
  if (!identity) return null;
  const issuedAt = Date.now();
  if (iAmCreator()) {
    const signature = await signText(grantText(playerId, role, issuedAt, null));
    return signature ? { playerId, role, issuedAt, signature } : null;
  }
  if (!myGrant || !grantableRoles(myGrant.role).includes(role)) return null;
  const signature = await signText(grantText(playerId, role, issuedAt, identity.fingerprint));
  return signature ? { playerId, role, issuedAt, signature, issuer: identity.publicKey, parent: myGrant } : null;
}

// Hands back the badge only if it really traces back to the Creator, for this exact player,
// through moderators who were each allowed to give the next badge.
export async function verifyGrant(value: unknown, playerId: string, depth = 0): Promise<Grant | null> {
  if (!CREATOR_PUBLIC_KEY || depth >= MAX_GRANT_CHAIN || !value || typeof value !== "object") return null;
  const { playerId: grantedTo, role, issuedAt, signature, issuer, parent } = value as Partial<
    Record<keyof Grant, unknown>
  >;
  if (grantedTo !== playerId || !isModeratorRole(role)) return null;
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt) || typeof signature !== "string") return null;

  if (issuer === undefined || issuer === null) {
    const valid = await verifyText(CREATOR_PUBLIC_KEY, grantText(playerId, role, issuedAt, null), signature);
    return valid ? { playerId, role, issuedAt, signature } : null;
  }

  const issuerKey = sanitizePublicKey(issuer);
  if (!issuerKey) return null;
  const issuerId = await fingerprintOf(issuerKey);
  const issuerGrant = await verifyGrant(parent, issuerId, depth + 1);
  if (!issuerGrant || !grantableRoles(issuerGrant.role).includes(role)) return null;
  const valid = await verifyText(issuerKey, grantText(playerId, role, issuedAt, issuerId), signature);
  return valid ? { playerId, role, issuedAt, signature, issuer: issuerKey, parent: issuerGrant } : null;
}

function recordActionText(
  kind: RecordActionKind,
  playerId: string,
  category: string,
  issuedAt: number,
  issuerId: string
): string {
  return `${RECORD_ACTION_LABELS[kind]}|${playerId}|${category}|${issuedAt}|${issuerId}`;
}

export async function makeRecordAction(
  kind: RecordActionKind,
  playerId: string,
  category: string,
  myGrant: Grant | null
): Promise<RecordAction | null> {
  if (!identity) return null;
  const creator = iAmCreator();
  if (!creator && !(myGrant && canActOnRecords(kind, myGrant.role))) return null;
  if (playerId === (await creatorId())) return null;
  const issuedAt = Date.now();
  const signature = await signText(recordActionText(kind, playerId, category, issuedAt, identity.fingerprint));
  if (!signature) return null;
  const action: RecordAction = { playerId, category, issuedAt, issuer: identity.publicKey, signature };
  if (!creator && myGrant) action.grant = myGrant;
  return action;
}

// A ban or report only counts if a moderator who's allowed to do it really signed it.
// Nobody can ban or report the Creator.
export async function verifyRecordAction(kind: RecordActionKind, value: unknown): Promise<RecordAction | null> {
  if (!cryptoAvailable() || !value || typeof value !== "object") return null;
  const { playerId, category, issuedAt, issuer, grant, signature } = value as Partial<
    Record<keyof RecordAction, unknown>
  >;
  if (typeof playerId !== "string" || playerId.length === 0 || playerId.length > 64) return null;
  if (typeof category !== "string" || !/^[A-Za-z]{1,32}$/.test(category)) return null;
  if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt) || typeof signature !== "string") return null;
  const issuerKey = sanitizePublicKey(issuer);
  if (!issuerKey || playerId === (await creatorId())) return null;

  const issuerId = await fingerprintOf(issuerKey);
  let issuerGrant: Grant | null = null;
  if (!isCreatorKey(issuerKey)) {
    issuerGrant = await verifyGrant(grant, issuerId);
    if (!issuerGrant || !canActOnRecords(kind, issuerGrant.role)) return null;
  }
  const valid = await verifyText(issuerKey, recordActionText(kind, playerId, category, issuedAt, issuerId), signature);
  if (!valid) return null;
  const action: RecordAction = { playerId, category, issuedAt, issuer: issuerKey, signature };
  if (issuerGrant) action.grant = issuerGrant;
  return action;
}
