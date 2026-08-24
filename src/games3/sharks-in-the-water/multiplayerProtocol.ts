/**
 * Versioned, host-authoritative multiplayer protocol for Sharks in the Water.
 *
 * This module deliberately does not import the game. The first migration can
 * put the existing SaveData object in SnapshotPayload.state, then replace it
 * with a dedicated co-op state model without changing the wire envelope.
 */

export const MULTIPLAYER_PROTOCOL_VERSION = 2 as const;
export const DEFAULT_COMMAND_RESULT_CACHE_CAPACITY = 512;
export const DEFAULT_HOST_PACKET_TIMEOUT_MS = 2_500;
export const MAX_MULTIPLAYER_IDENTIFIER_LENGTH = 160;
export const MAX_MULTIPLAYER_CRATES = 4_096;
export const MAX_MULTIPLAYER_COLLECTION_ITEMS = 10_000;
export const MAX_MULTIPLAYER_OBJECT_KEYS = 1_000;
export const MAX_MULTIPLAYER_VALUE_DEPTH = 12;
export const MAX_MULTIPLAYER_VALUE_NODES = 50_000;
export const MAX_MULTIPLAYER_COORDINATE = 100_000;
export const MAX_MULTIPLAYER_HEARTS = 100;

export type PlayerId = "p1" | "p2";
export type MovementAxis = -1 | 0 | 1;

export interface ReplicatedCrateMaterial {
  name: string;
  amount: number;
  color: string;
}

export interface ReplicatedCrate {
  /** Stable ID. Positions must never be used to claim a crate. */
  id: string;
  x: number;
  y: number;
  kind: string;
  /** Cosmetic supply-drop contents so guests can render the real crate. */
  material?: ReplicatedCrateMaterial;
}

export interface ReplicatedPlayerFrame {
  id: PlayerId;
  connected: boolean;
  x: number;
  y: number;
  hearts: number;
  shieldCharges: 0 | 1;
  invincibleUntilMs: number;
  carriedCrateCount: number;
}

export interface SnapshotPayload<State = Record<string, unknown>> {
  revision: number;
  hostTimeMs: number;
  /** True after the host has started the shared voyage. */
  started?: boolean;
  /** Opaque authoritative state. It may initially be the existing SaveData. */
  state: State;
  players: ReplicatedPlayerFrame[];
}

export interface HelloPayload {
  protocol: typeof MULTIPLAYER_PROTOCOL_VERSION;
  clientInstanceId: string;
  resumeToken?: string;
}

export interface WelcomePayload<State = Record<string, unknown>> {
  assignedPlayerId: "p2";
  resumeToken: string;
  snapshot: SnapshotPayload<State>;
}

export interface ReadyPayload {
  appliedRevision: number;
}

export interface MovementInputPayload {
  inputSeq: number;
  dx: MovementAxis;
  dy: MovementAxis;
  sprint: boolean;
}

export type SupportedCommandType =
  | "session.start"
  | "raft.expand"
  | "shield.craft"
  | "crate.collect"
  | "crate.deposit"
  | "food.eat";

export interface CommandPayload {
  commandId: string;
  baseRevision: number;
  type: string;
  payload: unknown;
}

export interface AcceptedCommandResult {
  commandId: string;
  status: "accepted";
  revision: number;
  notice?: string;
}

export interface RejectedCommandResult {
  commandId: string;
  status: "rejected";
  revision: number;
  reason: string;
}

export type CommandResultPayload = AcceptedCommandResult | RejectedCommandResult;

export interface StatePatchPayload<Patch = Record<string, unknown>> {
  baseRevision: number;
  revision: number;
  patch: Patch;
}

export interface WorldFramePayload<World = Record<string, unknown>> {
  revision: number;
  frameSeq: number;
  hostTimeMs: number;
  players: ReplicatedPlayerFrame[];
  crates: ReplicatedCrate[];
  /** Dynamic host-owned world data, such as shark and bot poses. */
  world: World;
}

export interface ResyncRequestPayload {
  knownRevision: number;
  reason: "revision-gap" | "reconnect" | "invalid-local-state";
}

export interface NoticePayload {
  text: string;
}

export interface DisconnectPayload {
  reason: "normal" | "host-lost" | "replaced" | "protocol-error";
  recovery?: "wait-for-host" | "start-new-room" | "use-local-recovery";
}

export type MultiplayerMessagePayload<State = Record<string, unknown>, World = Record<string, unknown>> = {
  hello: HelloPayload;
  welcome: WelcomePayload<State>;
  ready: ReadyPayload;
  input: MovementInputPayload;
  command: CommandPayload;
  "command-result": CommandResultPayload;
  snapshot: SnapshotPayload<State>;
  "state-patch": StatePatchPayload;
  "world-frame": WorldFramePayload<World>;
  "resync-request": ResyncRequestPayload;
  notice: NoticePayload;
  disconnect: DisconnectPayload;
};

export type MultiplayerMessageKind = keyof MultiplayerMessagePayload;

export interface MultiplayerEnvelope<
  Kind extends MultiplayerMessageKind = MultiplayerMessageKind,
  State = Record<string, unknown>,
  World = Record<string, unknown>,
> {
  protocol: typeof MULTIPLAYER_PROTOCOL_VERSION;
  room: string;
  /** Every message after hello must belong to the active host epoch. */
  sessionEpoch?: string;
  senderSessionId: string;
  messageId: string;
  sequence: number;
  kind: Kind;
  payload: MultiplayerMessagePayload<State, World>[Kind];
}

/** A discriminated envelope union. Checking kind also narrows payload. */
export type AnyMultiplayerEnvelope<
  State = Record<string, unknown>,
  World = Record<string, unknown>,
> = {
  [Kind in MultiplayerMessageKind]: MultiplayerEnvelope<Kind, State, World>;
}[MultiplayerMessageKind];

export interface AuthorityCursor {
  sessionEpoch: string;
  revision: number;
}

export type RevisionDecision =
  | { action: "accept" }
  | { action: "ignore"; reason: "stale" }
  | { action: "resync"; reason: "revision-gap" | "missing-local-state" }
  | { action: "reject"; reason: "wrong-epoch" };

export interface HostLossRecovery<State = Record<string, unknown>> {
  kind: "host-lost";
  sessionEpoch: string;
  lastAcceptedRevision: number;
  snapshot: SnapshotPayload<State>;
  recovery: "wait-for-host" | "start-new-room" | "use-local-recovery";
}

export type ProtocolValidationResult<State = Record<string, unknown>, World = Record<string, unknown>> =
  | { ok: true; message: AnyMultiplayerEnvelope<State, World> }
  | { ok: false; reason: string };

export interface MultiplayerValidationOptions<State, World = Record<string, unknown>> {
  /** Add the application schema after the protocol's bounded-data check. */
  validateSnapshotState?: (state: unknown) => state is State;
  /** Add the application schema for dynamic world frames. */
  validateWorldFrameData?: (world: unknown) => world is World;
}

interface UnknownRecord {
  [key: string]: unknown;
  id?: unknown;
  connected?: unknown;
  x?: unknown;
  y?: unknown;
  hearts?: unknown;
  shieldCharges?: unknown;
  invincibleUntilMs?: unknown;
  carriedCrateCount?: unknown;
  kind?: unknown;
  players?: unknown;
  crates?: unknown;
  revision?: unknown;
  hostTimeMs?: unknown;
  started?: unknown;
  state?: unknown;
  protocol?: unknown;
  clientInstanceId?: unknown;
  resumeToken?: unknown;
  assignedPlayerId?: unknown;
  snapshot?: unknown;
  appliedRevision?: unknown;
  inputSeq?: unknown;
  dx?: unknown;
  dy?: unknown;
  sprint?: unknown;
  commandId?: unknown;
  baseRevision?: unknown;
  type?: unknown;
  status?: unknown;
  notice?: unknown;
  reason?: unknown;
  patch?: unknown;
  frameSeq?: unknown;
  world?: unknown;
  knownRevision?: unknown;
  text?: unknown;
  recovery?: unknown;
  room?: unknown;
  senderSessionId?: unknown;
  messageId?: unknown;
  sequence?: unknown;
  sessionEpoch?: unknown;
  payload?: unknown;
}

const messageKinds = new Set<MultiplayerMessageKind>([
  "hello",
  "welcome",
  "ready",
  "input",
  "command",
  "command-result",
  "snapshot",
  "state-patch",
  "world-frame",
  "resync-request",
  "notice",
  "disconnect",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown, maximumLength = MAX_MULTIPLAYER_IDENTIFIER_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "p1" || value === "p2";
}

function isMovementAxis(value: unknown): value is MovementAxis {
  return value === -1 || value === 0 || value === 1;
}

function isReplicatedPlayerFrame(value: unknown): value is ReplicatedPlayerFrame {
  if (!isRecord(value)) return false;
  return isPlayerId(value.id)
    && typeof value.connected === "boolean"
    && isFiniteNumber(value.x)
    && Math.abs(value.x) <= MAX_MULTIPLAYER_COORDINATE
    && isFiniteNumber(value.y)
    && Math.abs(value.y) <= MAX_MULTIPLAYER_COORDINATE
    && isRevision(value.hearts)
    && value.hearts <= MAX_MULTIPLAYER_HEARTS
    && (value.shieldCharges === 0 || value.shieldCharges === 1)
    && isFiniteNumber(value.invincibleUntilMs)
    && value.invincibleUntilMs >= 0
    && isRevision(value.carriedCrateCount)
    && value.carriedCrateCount <= MAX_MULTIPLAYER_CRATES;
}

function hasUniquePlayerIds(players: ReplicatedPlayerFrame[]): boolean {
  return players.length === 2
    && players.some((player) => player.id === "p1")
    && players.some((player) => player.id === "p2")
    && new Set(players.map((player) => player.id)).size === players.length;
}

function isReplicatedCrateMaterial(value: unknown): value is ReplicatedCrateMaterial {
  if (!isRecord(value)) return false;
  return isIdentifier(value["name"], 80)
    && isFiniteNumber(value["amount"])
    && (value["amount"] as number) >= 0
    && isIdentifier(value["color"], 32);
}

function isReplicatedCrate(value: unknown): value is ReplicatedCrate {
  if (!isRecord(value)) return false;
  return isIdentifier(value.id)
    && isFiniteNumber(value.x)
    && Math.abs(value.x) <= MAX_MULTIPLAYER_COORDINATE
    && isFiniteNumber(value.y)
    && Math.abs(value.y) <= MAX_MULTIPLAYER_COORDINATE
    && isIdentifier(value.kind, 64)
    && (value["material"] === undefined || isReplicatedCrateMaterial(value["material"]));
}

function hasUniqueCrateIds(crates: ReplicatedCrate[]): boolean {
  return new Set(crates.map((crate) => crate.id)).size === crates.length;
}

function isBoundedData(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const budget = { nodes: MAX_MULTIPLAYER_VALUE_NODES };
  const visit = (candidate: unknown, depth: number): boolean => {
    budget.nodes -= 1;
    if (budget.nodes < 0 || depth > MAX_MULTIPLAYER_VALUE_DEPTH) return false;
    if (candidate === null || typeof candidate === "boolean") return true;
    if (typeof candidate === "number") return Number.isFinite(candidate);
    if (typeof candidate === "string") return candidate.length <= 20_000;
    if (typeof candidate !== "object") return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      return candidate.length <= MAX_MULTIPLAYER_COLLECTION_ITEMS
        && candidate.every((item) => visit(item, depth + 1));
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const entries = Object.entries(candidate);
    return entries.length <= MAX_MULTIPLAYER_OBJECT_KEYS
      && entries.every(([key, item]) =>
        key.length <= MAX_MULTIPLAYER_IDENTIFIER_LENGTH
        && key !== "__proto__"
        && key !== "prototype"
        && key !== "constructor"
        && visit(item, depth + 1)
      );
  };
  try {
    return visit(value, 0);
  } catch {
    return false;
  }
}

function passesStateValidator<State>(
  state: unknown,
  validateState?: (state: unknown) => state is State,
): boolean {
  if (validateState === undefined) return true;
  try {
    return validateState(state);
  } catch {
    return false;
  }
}

function isSnapshotPayload<State>(
  value: unknown,
  validateState?: (state: unknown) => state is State,
): value is SnapshotPayload<State> {
  if (!isRecord(value) || !Array.isArray(value.players)) return false;
  const players = value.players;
  return isRevision(value.revision)
    && isFiniteNumber(value.hostTimeMs)
    && value.hostTimeMs >= 0
    && (value.started === undefined || typeof value.started === "boolean")
    && isRecord(value.state)
    && isBoundedData(value.state)
    && passesStateValidator(value.state, validateState)
    && players.every(isReplicatedPlayerFrame)
    && hasUniquePlayerIds(players);
}

function isHelloPayload(value: unknown): value is HelloPayload {
  if (!isRecord(value)) return false;
  return value.protocol === MULTIPLAYER_PROTOCOL_VERSION
    && isIdentifier(value.clientInstanceId)
    && (value.resumeToken === undefined || isIdentifier(value.resumeToken));
}

function isWelcomePayload<State>(
  value: unknown,
  validateState?: (state: unknown) => state is State,
): value is WelcomePayload<State> {
  return isRecord(value)
    && value.assignedPlayerId === "p2"
    && isIdentifier(value.resumeToken)
    && isSnapshotPayload(value.snapshot, validateState);
}

function isReadyPayload(value: unknown): value is ReadyPayload {
  return isRecord(value) && isRevision(value.appliedRevision);
}

function isMovementInputPayload(value: unknown): value is MovementInputPayload {
  return isRecord(value)
    && isRevision(value.inputSeq)
    && isMovementAxis(value.dx)
    && isMovementAxis(value.dy)
    && typeof value.sprint === "boolean";
}

function isCommandPayload(value: unknown): value is CommandPayload {
  if (!isRecord(value)
    || !isIdentifier(value.commandId)
    || !isRevision(value.baseRevision)
    || !isIdentifier(value.type, 80)
    || !("payload" in value)
    || !isBoundedData(value.payload)) return false;
  if (!isRecord(value.payload)) return false;
  if (value.type === "crate.collect" || value.type === "crate.deposit") {
    return isIdentifier(value.payload["crateId"]);
  }
  // Known argument-free commands accept a bounded object. Unknown commands
  // also pass this transport layer so the host can return "unsupported".
  return true;
}

function isCommandResultPayload(value: unknown): value is CommandResultPayload {
  if (!isRecord(value) || !isIdentifier(value.commandId) || !isRevision(value.revision)) return false;
  if (value.status === "accepted") return value.notice === undefined || (typeof value.notice === "string" && value.notice.length <= 500);
  return value.status === "rejected" && typeof value.reason === "string" && value.reason.length > 0 && value.reason.length <= 500;
}

function isStatePatchPayload(value: unknown): value is StatePatchPayload {
  return isRecord(value)
    && isRevision(value.baseRevision)
    && isRevision(value.revision)
    && value.revision > value.baseRevision
    && isRecord(value.patch)
    && isBoundedData(value.patch);
}

function isWorldFramePayload<World>(
  value: unknown,
  validateWorld?: (world: unknown) => world is World,
): value is WorldFramePayload<World> {
  if (!isRecord(value) || !Array.isArray(value.players) || !Array.isArray(value.crates)) return false;
  const players = value.players;
  const crates = value.crates;
  return isRevision(value.revision)
    && isRevision(value.frameSeq)
    && isFiniteNumber(value.hostTimeMs)
    && value.hostTimeMs >= 0
    && players.every(isReplicatedPlayerFrame)
    && hasUniquePlayerIds(players)
    && crates.length <= MAX_MULTIPLAYER_CRATES
    && crates.every(isReplicatedCrate)
    && hasUniqueCrateIds(crates)
    && isRecord(value.world)
    && isBoundedData(value.world)
    && passesStateValidator(value.world, validateWorld);
}

function isResyncRequestPayload(value: unknown): value is ResyncRequestPayload {
  return isRecord(value)
    && isRevision(value.knownRevision)
    && (value.reason === "revision-gap" || value.reason === "reconnect" || value.reason === "invalid-local-state");
}

function isNoticePayload(value: unknown): value is NoticePayload {
  return isRecord(value) && typeof value.text === "string" && value.text.length <= 500;
}

function isDisconnectPayload(value: unknown): value is DisconnectPayload {
  if (!isRecord(value)) return false;
  const validReason = value.reason === "normal"
    || value.reason === "host-lost"
    || value.reason === "replaced"
    || value.reason === "protocol-error";
  const validRecovery = value.recovery === undefined
    || value.recovery === "wait-for-host"
    || value.recovery === "start-new-room"
    || value.recovery === "use-local-recovery";
  return validReason && validRecovery;
}

function isPayloadForKind<State, World>(
  kind: MultiplayerMessageKind,
  payload: unknown,
  validateState?: (state: unknown) => state is State,
  validateWorld?: (world: unknown) => world is World,
): boolean {
  switch (kind) {
    case "hello": return isHelloPayload(payload);
    case "welcome": return isWelcomePayload(payload, validateState);
    case "ready": return isReadyPayload(payload);
    case "input": return isMovementInputPayload(payload);
    case "command": return isCommandPayload(payload);
    case "command-result": return isCommandResultPayload(payload);
    case "snapshot": return isSnapshotPayload(payload, validateState);
    case "state-patch": return isStatePatchPayload(payload);
    case "world-frame": return isWorldFramePayload(payload, validateWorld);
    case "resync-request": return isResyncRequestPayload(payload);
    case "notice": return isNoticePayload(payload);
    case "disconnect": return isDisconnectPayload(payload);
  }
}

/** Parse untrusted PeerJS data into a protocol-v2 message. */
export function parseMultiplayerMessage<State = Record<string, unknown>, World = Record<string, unknown>>(
  value: unknown,
  options: MultiplayerValidationOptions<State, World> = {},
): ProtocolValidationResult<State, World> {
  if (!isRecord(value)) return { ok: false, reason: "message is not an object" };
  if (value.protocol !== MULTIPLAYER_PROTOCOL_VERSION) return { ok: false, reason: "unsupported protocol" };
  if (!isIdentifier(value.room, 64)) return { ok: false, reason: "invalid room" };
  if (!isIdentifier(value.senderSessionId)) return { ok: false, reason: "invalid sender session" };
  if (!isIdentifier(value.messageId)) return { ok: false, reason: "invalid message ID" };
  if (!isRevision(value.sequence)) return { ok: false, reason: "invalid sequence" };
  if (typeof value.kind !== "string" || !messageKinds.has(value.kind as MultiplayerMessageKind)) {
    return { ok: false, reason: "unknown message kind" };
  }
  const kind = value.kind as MultiplayerMessageKind;
  if (kind === "hello") {
    if (value.sessionEpoch !== undefined && !isIdentifier(value.sessionEpoch)) {
      return { ok: false, reason: "invalid session epoch" };
    }
  } else if (!isIdentifier(value.sessionEpoch)) {
    return { ok: false, reason: "missing session epoch" };
  }
  if (!isPayloadForKind(kind, value.payload, options.validateSnapshotState, options.validateWorldFrameData)) {
    return { ok: false, reason: "invalid payload" };
  }
  return { ok: true, message: value as unknown as AnyMultiplayerEnvelope<State, World> };
}

/** Only accept strictly newer messages from one known session. */
export function shouldAcceptSequence(lastSequence: number | undefined, incomingSequence: number): boolean {
  return isRevision(incomingSequence) && (lastSequence === undefined || incomingSequence > lastSequence);
}

/** A guest must stop simulation when its authoritative host goes silent. */
export function hasHostPacketTimedOut(
  lastAcceptedAtMs: number,
  nowMs: number,
  timeoutMs = DEFAULT_HOST_PACKET_TIMEOUT_MS,
): boolean {
  return Number.isFinite(lastAcceptedAtMs)
    && Number.isFinite(nowMs)
    && Number.isFinite(timeoutMs)
    && timeoutMs > 0
    && lastAcceptedAtMs >= 0
    && nowMs - lastAcceptedAtMs > timeoutMs;
}

/** A full snapshot may skip revisions because it replaces all state. */
export function decideSnapshotAcceptance(
  cursor: AuthorityCursor | null,
  sessionEpoch: string,
  revision: number,
): RevisionDecision {
  if (!isIdentifier(sessionEpoch) || !isRevision(revision)) return { action: "resync", reason: "missing-local-state" };
  if (cursor === null) return { action: "accept" };
  if (cursor.sessionEpoch !== sessionEpoch) return { action: "reject", reason: "wrong-epoch" };
  return revision >= cursor.revision ? { action: "accept" } : { action: "ignore", reason: "stale" };
}

/** A patch is safe only when it extends the exact local revision. */
export function decidePatchAcceptance(
  cursor: AuthorityCursor | null,
  sessionEpoch: string,
  baseRevision: number,
  revision: number,
): RevisionDecision {
  if (cursor === null) return { action: "resync", reason: "missing-local-state" };
  if (cursor.sessionEpoch !== sessionEpoch) return { action: "reject", reason: "wrong-epoch" };
  if (!isRevision(baseRevision) || !isRevision(revision) || revision <= baseRevision) {
    return { action: "resync", reason: "revision-gap" };
  }
  if (revision <= cursor.revision) return { action: "ignore", reason: "stale" };
  return baseRevision === cursor.revision
    ? { action: "accept" }
    : { action: "resync", reason: "revision-gap" };
}

/** World frames are disposable, but a newer durable revision requires a snapshot. */
export function decideWorldFrameAcceptance(
  cursor: AuthorityCursor | null,
  sessionEpoch: string,
  revision: number,
): RevisionDecision {
  if (cursor === null) return { action: "resync", reason: "missing-local-state" };
  if (cursor.sessionEpoch !== sessionEpoch) return { action: "reject", reason: "wrong-epoch" };
  if (!isRevision(revision)) return { action: "resync", reason: "revision-gap" };
  if (revision < cursor.revision) return { action: "ignore", reason: "stale" };
  return revision === cursor.revision
    ? { action: "accept" }
    : { action: "resync", reason: "revision-gap" };
}

export interface CommandResultCacheEntry {
  senderSessionId: string;
  result: CommandResultPayload;
}

export interface CommandResultCache {
  capacity: number;
  entries: readonly CommandResultCacheEntry[];
}

export function createCommandResultCache(capacity = DEFAULT_COMMAND_RESULT_CACHE_CAPACITY): CommandResultCache {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Command-result cache capacity must be a positive integer.");
  return { capacity, entries: [] };
}

export function findCachedCommandResult(
  cache: CommandResultCache,
  senderSessionId: string,
  commandId: string,
): CommandResultPayload | undefined {
  return cache.entries.find((entry) =>
    entry.senderSessionId === senderSessionId && entry.result.commandId === commandId
  )?.result;
}

/**
 * Return a new bounded cache. Existing results always win, so a retry gets the
 * original outcome rather than a second resource spend or a changed response.
 */
export function recordCommandResult(
  cache: CommandResultCache,
  senderSessionId: string,
  result: CommandResultPayload,
): CommandResultCache {
  if (findCachedCommandResult(cache, senderSessionId, result.commandId)) return cache;
  const entries = [...cache.entries, { senderSessionId, result }];
  return { capacity: cache.capacity, entries: entries.slice(-cache.capacity) };
}

export function createHostLossRecovery<State>(
  sessionEpoch: string,
  snapshot: SnapshotPayload<State>,
): HostLossRecovery<State> {
  return {
    kind: "host-lost",
    sessionEpoch,
    lastAcceptedRevision: snapshot.revision,
    snapshot,
    recovery: "wait-for-host",
  };
}
