/**
 * Pure, host-authoritative state for Sharks in the Water multiplayer.
 *
 * This module has no browser dependencies. The game adapter is responsible
 * for converting its current globals into this state and for rendering the
 * resulting snapshot. The host is the only caller that should accept
 * commands.
 */

import { MULTIPLAYER_PROTOCOL_VERSION, type PlayerId } from "./multiplayerProtocol";

export type { PlayerId } from "./multiplayerProtocol";
export type HealingValue = 1 | 99;

export interface CrateReward {
  inventory?: Record<string, number>;
  foodHealing?: HealingValue[];
}

export interface CrateState {
  id: string;
  x: number;
  y: number;
  kind: string;
  reward: CrateReward;
}

export interface PlayerState {
  id: PlayerId;
  x: number;
  y: number;
  hearts: number;
  maxHearts: number;
  shieldCharges: 0 | 1;
  invincibleUntil: number;
  carriedCrateIds: string[];
  online: boolean;
}

export interface SharedState {
  raftLevel: number;
  expansionCount: number;
  inventory: Record<string, number>;
  foodHealing: HealingValue[];
  crates: CrateState[];
  /** Stable catalogue retained while a crate is in a player's cargo. */
  crateCatalog: Record<string, CrateState>;
}

export interface MultiplayerState {
  protocolVersion: typeof MULTIPLAYER_PROTOCOL_VERSION;
  revision: number;
  serverTime: number;
  shared: SharedState;
  players: Record<PlayerId, PlayerState>;
}

export interface StateOverrides {
  revision?: number;
  serverTime?: number;
  shared?: Partial<SharedState>;
  players?: Partial<Record<PlayerId, Partial<PlayerState>>>;
}

export interface CommandBase {
  requestId: string;
  actor: PlayerId;
  /** The revision that the sender used to make this decision. */
  baseRevision?: number;
}

export interface RaftExpandCommand extends CommandBase {
  kind: "raft.expand";
}

export interface ShieldCraftCommand extends CommandBase {
  kind: "shield.craft";
}

export interface CrateCollectCommand extends CommandBase {
  kind: "crate.collect";
  crateId: string;
}

export interface CrateDepositCommand extends CommandBase {
  kind: "crate.deposit";
  crateId: string;
}

export interface FoodEatCommand extends CommandBase {
  kind: "food.eat";
}

export interface PlayerPositionCommand extends CommandBase {
  kind: "player.position";
  x: number;
  y: number;
}

export interface SharkHitCommand extends CommandBase {
  kind: "shark.hit";
  target: PlayerId;
  attackerId: string;
  attackId: string;
}

export type MultiplayerCommand =
  | RaftExpandCommand
  | ShieldCraftCommand
  | CrateCollectCommand
  | CrateDepositCommand
  | FoodEatCommand
  | PlayerPositionCommand
  | SharkHitCommand;

export type RejectCode =
  | "invalid-command"
  | "invalid-number"
  | "invalid-request-id"
  | "not-host"
  | "actor-offline"
  | "target-offline"
  | "stale-revision"
  | "insufficient-resources"
  | "maximum-expansion"
  | "crate-not-found"
  | "crate-too-far"
  | "crate-not-carried"
  | "crate-already-carried"
  | "crate-deposit-not-authorized"
  | "player-dead"
  | "player-invincible"
  | "shield-already-active"
  | "duplicate-attack"
  | "no-shield"
  | "no-food"
  | "hearts-full";

export interface CommandResult {
  requestId: string;
  accepted: boolean;
  revision: number;
  state: MultiplayerState;
  reason?: RejectCode;
  /** Present for a shield-blocked hit, which is an accepted state change. */
  effect?: "shield-blocked" | "damage";
}

export interface ReducerRuntime {
  hostId: PlayerId;
  now: number;
  /** A retry with the same request ID returns the original result. */
  processedRequests: Map<string, CommandResult>;
  /** Shark events are also idempotent when transports retry with a new ID. */
  processedAttacks: Map<string, true>;
  requestCacheCapacity: number;
  attackCacheCapacity: number;
  /** The adapter derives this from authoritative geometry, never guest data. */
  canDepositCrate: (state: MultiplayerState, actor: PlayerId, crate: CrateState) => boolean;
}

export interface ReducerRuntimeOptions {
  requestCacheCapacity?: number;
  attackCacheCapacity?: number;
  canDepositCrate?: ReducerRuntime["canDepositCrate"];
}

export const RAFT_EXPANSION_WOOD_COST = 8;
export const RAFT_EXPANSION_STONE_COST = 2;
export const SHIELD_TECHNOLOGY_SHARD_COST = 5;
export const MAX_EXPANSIONS = 12;
export const PICKUP_RADIUS = 40;
export const MAX_COORDINATE = 100_000;
export const MAX_REQUEST_ID_LENGTH = 128;
export const MAX_COMMAND_IDENTIFIER_LENGTH = 160;
export const DEFAULT_REQUEST_CACHE_CAPACITY = 1_024;
export const DEFAULT_ATTACK_CACHE_CAPACITY = 2_048;

const DEFAULT_PLAYER_HEARTS = 3;

export function createPlayerState(id: PlayerId, overrides: Partial<PlayerState> = {}): PlayerState {
  const {
    id: _ignoredId,
    shieldCharges: requestedShieldCharges,
    carriedCrateIds: requestedCarriedCrateIds,
    ...otherOverrides
  } = overrides;
  const result: PlayerState = {
    id,
    x: 0,
    y: 0,
    hearts: DEFAULT_PLAYER_HEARTS,
    maxHearts: DEFAULT_PLAYER_HEARTS,
    shieldCharges: 0,
    invincibleUntil: 0,
    carriedCrateIds: [],
    online: true,
  };
  Object.assign(result, otherOverrides);
  result.shieldCharges = requestedShieldCharges === 1 ? 1 : 0;
  result.carriedCrateIds = [...(requestedCarriedCrateIds ?? [])];
  return result;
}

export function createSharedState(overrides: Partial<SharedState> = {}): SharedState {
  const {
    inventory: requestedInventory,
    foodHealing: requestedFoodHealing,
    crates: requestedCrates,
    crateCatalog: requestedCrateCatalog,
    ...otherOverrides
  } = overrides;
  const crates = (requestedCrates ?? []).map(cloneCrate);
  const crateCatalog = Object.fromEntries(
    Object.entries(requestedCrateCatalog ?? {}).map(([id, crate]) => [id, cloneCrate(crate)]),
  );
  for (const crate of crates) crateCatalog[crate.id] = cloneCrate(crate);
  return Object.assign({
    raftLevel: 1,
    expansionCount: 0,
    inventory: {},
    foodHealing: [],
    crates: [],
    crateCatalog: {},
  }, otherOverrides, {
    inventory: { ...(requestedInventory ?? {}) },
    foodHealing: [...(requestedFoodHealing ?? [])],
    crates,
    crateCatalog,
  });
}

export function createInitialState(overrides: StateOverrides = {}): MultiplayerState {
  return {
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    revision: overrides.revision ?? 0,
    serverTime: overrides.serverTime ?? 0,
    shared: createSharedState(overrides.shared),
    players: {
      p1: createPlayerState("p1", overrides.players?.p1),
      p2: createPlayerState("p2", overrides.players?.p2),
    },
  };
}

export function createReducerRuntime(
  hostId: PlayerId,
  now = 0,
  options: ReducerRuntimeOptions = {},
): ReducerRuntime {
  const requestCacheCapacity = validCapacity(options.requestCacheCapacity, DEFAULT_REQUEST_CACHE_CAPACITY);
  const attackCacheCapacity = validCapacity(options.attackCacheCapacity, DEFAULT_ATTACK_CACHE_CAPACITY);
  return {
    hostId,
    now,
    processedRequests: new Map(),
    processedAttacks: new Map(),
    requestCacheCapacity,
    attackCacheCapacity,
    canDepositCrate: options.canDepositCrate ?? (() => false),
  };
}

/**
 * Apply one command to the canonical host state.
 *
 * The reducer is intentionally immutable. A rejected command returns the
 * same state and revision. A durable accepted command returns a new state
 * with one higher revision. Position updates are presence data and do not
 * advance the durable revision.
 */
export function reduceCommand(
  state: MultiplayerState,
  value: unknown,
  runtime: ReducerRuntime,
): CommandResult {
  const command = parseCommand(value);
  const requestId = command?.requestId ?? "";
  const requestKey = command ? scopedRequestKey(command) : "";
  if (requestKey && runtime.processedRequests.has(requestKey)) {
    const cached = runtime.processedRequests.get(requestKey)!;
    // An old cached result must never return an old snapshot and roll the
    // caller back after another command has advanced the room. The original
    // acceptance/rejection is stable, while the current state is authoritative.
    return cached.state === state ? cached : { ...cached, state, revision: state.revision };
  }

  const result = command
    ? reduceValidCommand(state, command, runtime)
    : reject(state, requestId, "invalid-command");

  if (command && result.requestId) {
    recordBounded(runtime.processedRequests, requestKey, result, runtime.requestCacheCapacity);
  }
  return result;
}

function reduceValidCommand(
  state: MultiplayerState,
  command: MultiplayerCommand,
  runtime: ReducerRuntime,
): CommandResult {
  if (command.kind === "shark.hit") {
    return reduceSharkHit(state, command, runtime);
  }

  const actor = state.players[command.actor];
  if (!actor?.online) return reject(state, command.requestId, "actor-offline");
  if (command.baseRevision !== undefined) {
    if (!Number.isInteger(command.baseRevision) || command.baseRevision !== state.revision) {
      return reject(state, command.requestId, "stale-revision");
    }
  }

  switch (command.kind) {
    case "raft.expand":
      return reduceRaftExpansion(state, command);
    case "shield.craft":
      return reduceShieldCraft(state, command);
    case "crate.collect":
      return reduceCrateCollect(state, command);
    case "crate.deposit":
      return reduceCrateDeposit(state, command, runtime);
    case "food.eat":
      return reduceFoodEat(state, command);
    case "player.position":
      return reducePlayerPosition(state, command);
  }
  return reject(state, "", "invalid-command");
}

function reduceRaftExpansion(state: MultiplayerState, command: RaftExpandCommand): CommandResult {
  if (state.shared.expansionCount >= MAX_EXPANSIONS) {
    return reject(state, command.requestId, "maximum-expansion");
  }
  const woodCost = RAFT_EXPANSION_WOOD_COST * 2 ** state.shared.expansionCount;
  const stoneCost = RAFT_EXPANSION_STONE_COST * 2 ** state.shared.expansionCount;
  if (!canAfford(state.shared.inventory, [["Wood", woodCost], ["Stone", stoneCost]])) {
    return reject(state, command.requestId, "insufficient-resources");
  }

  const next = cloneState(state);
  spend(next.shared.inventory, [["Wood", woodCost], ["Stone", stoneCost]]);
  next.shared.expansionCount += 1;
  next.shared.raftLevel = next.shared.expansionCount + 1;
  next.revision += 1;
  return accept(next, command.requestId);
}

function reduceShieldCraft(state: MultiplayerState, command: ShieldCraftCommand): CommandResult {
  if (state.players[command.actor].shieldCharges > 0) {
    return reject(state, command.requestId, "shield-already-active");
  }
  if (!canAfford(state.shared.inventory, [["Technology Shards", SHIELD_TECHNOLOGY_SHARD_COST]])) {
    return reject(state, command.requestId, "insufficient-resources");
  }

  const next = cloneState(state);
  spend(next.shared.inventory, [["Technology Shards", SHIELD_TECHNOLOGY_SHARD_COST]]);
  next.players[command.actor].shieldCharges = 1;
  next.revision += 1;
  return accept(next, command.requestId);
}

function reduceCrateCollect(state: MultiplayerState, command: CrateCollectCommand): CommandResult {
  const crateIndex = state.shared.crates.findIndex((crate) => crate.id === command.crateId);
  if (crateIndex < 0) return reject(state, command.requestId, "crate-not-found");
  const actor = state.players[command.actor];
  if (actor.carriedCrateIds.includes(command.crateId)) {
    return reject(state, command.requestId, "crate-already-carried");
  }
  const crate = state.shared.crates[crateIndex];
  if (!crate || distance(actor.x, actor.y, crate.x, crate.y) > PICKUP_RADIUS) {
    return reject(state, command.requestId, "crate-too-far");
  }

  const next = cloneState(state);
  next.shared.crates.splice(crateIndex, 1);
  next.players[command.actor].carriedCrateIds.push(command.crateId);
  next.revision += 1;
  return accept(next, command.requestId);
}

function reduceCrateDeposit(
  state: MultiplayerState,
  command: CrateDepositCommand,
  runtime: ReducerRuntime,
): CommandResult {
  const actor = state.players[command.actor];
  const carriedIndex = actor.carriedCrateIds.indexOf(command.crateId);
  if (carriedIndex < 0) return reject(state, command.requestId, "crate-not-carried");

  // The crate reward is part of the crate identity. The host never rolls a
  // reward on the client, so a retry cannot create a second random reward.
  const crate = findCarriedCrate(state, command.crateId);
  if (!crate) return reject(state, command.requestId, "crate-not-found");
  if (!isValidCrateReward(crate.reward)) return reject(state, command.requestId, "invalid-number");
  if (!runtime.canDepositCrate(state, command.actor, crate)) {
    return reject(state, command.requestId, "crate-deposit-not-authorized");
  }

  const next = cloneState(state);
  next.players[command.actor].carriedCrateIds.splice(carriedIndex, 1);
  for (const [name, amount] of Object.entries(crate.reward.inventory ?? {})) {
    next.shared.inventory[name] = (next.shared.inventory[name] ?? 0) + amount;
  }
  next.shared.foodHealing.push(...(crate.reward.foodHealing ?? []));
  next.revision += 1;
  return accept(next, command.requestId);
}

function reduceFoodEat(state: MultiplayerState, command: FoodEatCommand): CommandResult {
  const actor = state.players[command.actor];
  if (actor.hearts <= 0) return reject(state, command.requestId, "player-dead");
  if (state.shared.foodHealing.length === 0) return reject(state, command.requestId, "no-food");
  if (actor.hearts >= actor.maxHearts) return reject(state, command.requestId, "hearts-full");

  const next = cloneState(state);
  // Mirror the single-player rule: 99 is a full meal, everything else +1.
  const healing = next.shared.foodHealing.shift() ?? 1;
  const player = next.players[command.actor];
  player.hearts = healing >= 3 ? player.maxHearts : Math.min(player.maxHearts, player.hearts + healing);
  next.revision += 1;
  return accept(next, command.requestId);
}

function reducePlayerPosition(state: MultiplayerState, command: PlayerPositionCommand): CommandResult {
  const next = cloneState(state);
  next.players[command.actor].x = command.x;
  next.players[command.actor].y = command.y;
  // Position is a high-frequency presence update. It is sent with its own
  // sequence number by the transport and does not invalidate a craft command.
  return accept(next, command.requestId);
}

function reduceSharkHit(
  state: MultiplayerState,
  command: SharkHitCommand,
  runtime: ReducerRuntime,
): CommandResult {
  if (command.actor !== runtime.hostId) return reject(state, command.requestId, "not-host");
  const attackKey = `${command.attackerId}\u0000${command.attackId}`;
  if (runtime.processedAttacks.has(attackKey)) {
    return reject(state, command.requestId, "duplicate-attack");
  }
  recordBounded(runtime.processedAttacks, attackKey, true, runtime.attackCacheCapacity);
  const target = state.players[command.target];
  if (!target?.online) return reject(state, command.requestId, "target-offline");
  if (target.hearts <= 0) return reject(state, command.requestId, "player-dead");

  const next = cloneState(state);
  const protectedByInvincibility = target.invincibleUntil > runtime.now;
  if (protectedByInvincibility) return reject(state, command.requestId, "player-invincible");
  if (target.shieldCharges > 0) {
    next.players[command.target].shieldCharges -= 1;
    next.players[command.target].invincibleUntil = Math.max(
      target.invincibleUntil,
      runtime.now + 1.5,
    );
    next.revision += 1;
    return accept(next, command.requestId, "shield-blocked");
  }

  next.players[command.target].hearts = Math.max(0, target.hearts - 1);
  next.players[command.target].invincibleUntil = runtime.now + 1.5;
  next.revision += 1;
  return accept(next, command.requestId, "damage");
}

function findCarriedCrate(state: MultiplayerState, crateId: string): CrateState | undefined {
  return state.shared.crateCatalog[crateId];
}

function parseCommand(value: unknown): MultiplayerCommand | null {
  if (!value || typeof value !== "object") return null;
  const command = value as Partial<MultiplayerCommand> & { kind?: unknown };
  if (!isPlayerId(command.actor) || typeof command.requestId !== "string") return null;
  if (!isValidRequestId(command.requestId)) return null;
  if (command.baseRevision !== undefined && !isFiniteNonNegativeInteger(command.baseRevision)) return null;

  if (command.kind === "raft.expand" || command.kind === "shield.craft" || command.kind === "food.eat") return command as MultiplayerCommand;
  if (command.kind === "crate.collect" || command.kind === "crate.deposit") {
    return typeof command.crateId === "string"
      && command.crateId.length > 0
      && command.crateId.length <= MAX_COMMAND_IDENTIFIER_LENGTH
      ? command as MultiplayerCommand
      : null;
  }
  if (command.kind === "player.position") {
    return isFiniteCoordinate(command.x) && isFiniteCoordinate(command.y)
      ? command as MultiplayerCommand
      : null;
  }
  if (command.kind === "shark.hit") {
    return isPlayerId(command.target)
      && typeof command.attackerId === "string"
      && command.attackerId.length > 0
      && command.attackerId.length <= MAX_COMMAND_IDENTIFIER_LENGTH
      && typeof command.attackId === "string"
      && command.attackId.length > 0
      && command.attackId.length <= MAX_COMMAND_IDENTIFIER_LENGTH
      ? command as MultiplayerCommand
      : null;
  }
  return null;
}

function accept(
  state: MultiplayerState,
  requestId: string,
  effect?: CommandResult["effect"],
): CommandResult {
  return effect ? { requestId, accepted: true, revision: state.revision, state, effect } : { requestId, accepted: true, revision: state.revision, state };
}

function reject(state: MultiplayerState, requestId: string, reason: RejectCode): CommandResult {
  return { requestId, accepted: false, revision: state.revision, state, reason };
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "p1" || value === "p2";
}

function isValidRequestId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_REQUEST_ID_LENGTH;
}

function scopedRequestKey(command: MultiplayerCommand): string {
  return `${command.actor}\u0000${command.requestId}`;
}

function validCapacity(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? value! : fallback;
}

function recordBounded<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  value: Value,
  capacity: number,
): void {
  if (map.has(key)) return;
  map.set(key, value);
  while (map.size > capacity) {
    const oldest = map.keys().next().value as Key | undefined;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
}

function canAfford(inventory: Record<string, number>, costs: Array<[string, number]>): boolean {
  return costs.every(([name, amount]) => {
    const available = inventory[name] ?? 0;
    return Number.isFinite(available) && available >= amount;
  });
}

function isValidCrateReward(reward: CrateReward): boolean {
  const inventoryIsValid = Object.entries(reward.inventory ?? {}).every(([name, amount]) =>
    name.length > 0
    && name.length <= MAX_COMMAND_IDENTIFIER_LENGTH
    && Number.isSafeInteger(amount)
    && amount >= 0
  );
  return inventoryIsValid
    && (reward.foodHealing ?? []).every((healing) => healing === 1 || healing === 99);
}

function spend(inventory: Record<string, number>, costs: Array<[string, number]>): void {
  for (const [name, amount] of costs) inventory[name] = Math.max(0, (inventory[name] ?? 0) - amount);
}

function cloneState(state: MultiplayerState): MultiplayerState {
  return {
    protocolVersion: MULTIPLAYER_PROTOCOL_VERSION,
    revision: state.revision,
    serverTime: state.serverTime,
    shared: createSharedState({
      ...state.shared,
      inventory: state.shared.inventory,
      foodHealing: state.shared.foodHealing,
      crates: state.shared.crates,
    }),
    players: {
      p1: createPlayerState("p1", state.players.p1),
      p2: createPlayerState("p2", state.players.p2),
    },
  };
}

function cloneCrate(crate: CrateState): CrateState {
  return {
    ...crate,
    reward: {
      inventory: crate.reward.inventory ? { ...crate.reward.inventory } : undefined,
      foodHealing: crate.reward.foodHealing ? [...crate.reward.foodHealing] : undefined,
    },
  };
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}
