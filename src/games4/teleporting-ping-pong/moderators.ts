import {
  iAmCreator,
  isBadgeRole,
  isModeratorRole,
  makeGrant,
  makeRecordAction,
  myFingerprint,
  verifyGrant,
  verifyRecordAction,
  type BadgeRole,
  type Grant,
  type ModeratorRole,
  type RecordAction,
  type RecordActionKind,
} from "./identity";
import { isLeaderboardCategory, readJson, writeJson, type LeaderboardCategory } from "./stats";

const GRANT_KEY = "teleporting-ping-pong-moderator-grant";
const INBOX_KEY = "teleporting-ping-pong-inbox";
const OUTBOX_KEY = "teleporting-ping-pong-invites-to-send";
const CREATOR_BADGE_KEY = "teleporting-ping-pong-creator-badge";
const RECORD_ACTION_KEYS: Record<RecordActionKind, string> = {
  ban: "teleporting-ping-pong-bans",
  report: "teleporting-ping-pong-reports",
};
const MAX_RECORD_ACTIONS = 200;
const MAX_RECORD_ACTIONS_SHARED = 50;

export const BADGE_LABELS: Record<BadgeRole, string> = {
  creator: "Creator Moderator",
  moderator: "Moderator",
  elder: "Elder Moderator",
  leaderboard: "Leaderboard Moderator",
  dark: "Dark Moderator",
};

export interface Invite {
  grant: Grant;
  fromName: string;
}

interface PendingInvite {
  playerId: string;
  role: ModeratorRole;
}

let myGrant: Grant | null = null;

// Checks that the saved badge really traces back to the Creator before showing it or using its powers.
export async function loadModeratorRole(): Promise<void> {
  const fingerprint = myFingerprint();
  myGrant = fingerprint ? await verifyGrant(readJson(GRANT_KEY), fingerprint) : null;
}

// The Creator has every badge and can pick which one to show.
export function myBadge(): BadgeRole | null {
  if (iAmCreator()) {
    const choice = readJson(CREATOR_BADGE_KEY);
    return isBadgeRole(choice) ? choice : "creator";
  }
  return myGrant?.role ?? null;
}

// The badge whose powers you actually have, whichever one the Creator chooses to show.
export function myPowerRole(): BadgeRole | null {
  return iAmCreator() ? "creator" : (myGrant?.role ?? null);
}

export function grantToShare(): Grant | null {
  return iAmCreator() ? null : myGrant;
}

export function setCreatorBadge(role: BadgeRole): void {
  if (iAmCreator()) writeJson(CREATOR_BADGE_KEY, role);
}

export function createGrant(playerId: string, role: ModeratorRole): Promise<Grant | null> {
  return makeGrant(playerId, role, myGrant);
}

function isGrantShape(value: unknown): value is Grant {
  if (!value || typeof value !== "object") return false;
  const { playerId, role, issuedAt, signature } = value as Partial<Record<keyof Grant, unknown>>;
  return (
    typeof playerId === "string" && isModeratorRole(role) && typeof issuedAt === "number" && typeof signature === "string"
  );
}

export function inbox(): Invite[] {
  const saved = readJson(INBOX_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry: unknown) => {
    const { grant, fromName } = (entry ?? {}) as { grant?: unknown; fromName?: unknown };
    return isGrantShape(grant) && typeof fromName === "string" ? [{ grant, fromName }] : [];
  });
}

// Only add invites that verifyGrant has already checked.
export function addToInbox(invite: Invite): void {
  const others = inbox().filter((entry) => entry.grant.signature !== invite.grant.signature);
  writeJson(INBOX_KEY, [...others, invite].slice(-10));
}

export function answerInvite(invite: Invite, accept: boolean): void {
  writeJson(
    INBOX_KEY,
    inbox().filter((entry) => entry.grant.signature !== invite.grant.signature)
  );
  if (!accept) return;
  writeJson(GRANT_KEY, invite.grant);
  myGrant = invite.grant;
}

// Invites waiting to be sent. Each one goes out the next time you're matched with that player.
function pendingInvites(): PendingInvite[] {
  const saved = readJson(OUTBOX_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry: unknown) => {
    const { playerId, role } = (entry ?? {}) as { playerId?: unknown; role?: unknown };
    return typeof playerId === "string" && isModeratorRole(role) ? [{ playerId, role }] : [];
  });
}

export function pendingInviteFor(playerId: string): PendingInvite | null {
  return pendingInvites().find((invite) => invite.playerId === playerId) ?? null;
}

export function queueInvite(playerId: string, role: ModeratorRole): void {
  writeJson(OUTBOX_KEY, [...pendingInvites().filter((invite) => invite.playerId !== playerId), { playerId, role }]);
}

export function takeInvite(playerId: string): PendingInvite | null {
  const invite = pendingInviteFor(playerId);
  if (invite) writeJson(OUTBOX_KEY, pendingInvites().filter((pending) => pending.playerId !== playerId));
  return invite;
}

function isRecordActionShape(value: unknown): value is RecordAction {
  if (!value || typeof value !== "object") return false;
  const { playerId, category, issuedAt, issuer, signature } = value as Partial<Record<keyof RecordAction, unknown>>;
  return (
    typeof playerId === "string" &&
    typeof category === "string" &&
    typeof issuedAt === "number" &&
    typeof signature === "string" &&
    typeof issuer === "object" &&
    issuer !== null
  );
}

// Every ban and report saved here was checked when it was made or received.
function recordActions(kind: RecordActionKind): RecordAction[] {
  const saved = readJson(RECORD_ACTION_KEYS[kind]);
  return Array.isArray(saved) ? saved.filter(isRecordActionShape) : [];
}

function saveRecordAction(kind: RecordActionKind, action: RecordAction): void {
  const others = recordActions(kind).filter(
    (saved) => !(saved.playerId === action.playerId && saved.category === action.category)
  );
  writeJson(RECORD_ACTION_KEYS[kind], [...others, action].slice(-MAX_RECORD_ACTIONS));
}

export async function actOnRecord(
  kind: RecordActionKind,
  playerId: string,
  category: LeaderboardCategory
): Promise<boolean> {
  const action = await makeRecordAction(kind, playerId, category, myGrant);
  if (!action) return false;
  saveRecordAction(kind, action);
  return true;
}

export function flaggedPlayerIds(kind: RecordActionKind, category: LeaderboardCategory): Set<string> {
  return new Set(
    recordActions(kind)
      .filter((action) => action.category === category)
      .map((action) => action.playerId)
  );
}

export function flaggedCategories(kind: RecordActionKind, playerId: string): LeaderboardCategory[] {
  return recordActions(kind)
    .filter((action) => action.playerId === playerId)
    .map((action) => action.category)
    .filter(isLeaderboardCategory);
}

// Bans and reports spread from player to player whenever they meet in a tournament.
export function recordActionsToShare(kind: RecordActionKind): RecordAction[] {
  return recordActions(kind).slice(-MAX_RECORD_ACTIONS_SHARED);
}

export async function receiveRecordActions(kind: RecordActionKind, value: unknown): Promise<void> {
  if (!Array.isArray(value)) return;
  const known = new Set(recordActions(kind).map((action) => action.signature));
  for (const candidate of value.slice(0, MAX_RECORD_ACTIONS_SHARED)) {
    if (!isRecordActionShape(candidate) || known.has(candidate.signature)) continue;
    const action = await verifyRecordAction(kind, candidate);
    if (!action || !isLeaderboardCategory(action.category)) continue;
    saveRecordAction(kind, action);
    known.add(action.signature);
  }
}
