import { describe, expect, it } from "vitest";
import {
  MULTIPLAYER_PROTOCOL_VERSION,
  createCommandResultCache,
  createHostLossRecovery,
  decidePatchAcceptance,
  decideSnapshotAcceptance,
  decideWorldFrameAcceptance,
  findCachedCommandResult,
  hasHostPacketTimedOut,
  parseMultiplayerMessage,
  recordCommandResult,
  shouldAcceptSequence,
  type MultiplayerMessagePayload,
  type MultiplayerEnvelope,
} from "./multiplayerProtocol";

const epoch = "epoch-1";

function envelope<Kind extends keyof MultiplayerMessagePayload>(
  kind: Kind,
  payload: MultiplayerMessagePayload[Kind],
): MultiplayerEnvelope<Kind> {
  return {
    protocol: MULTIPLAYER_PROTOCOL_VERSION,
    room: "ABC123",
    sessionEpoch: kind === "hello" ? undefined : epoch,
    senderSessionId: "session-guest",
    messageId: `message-${kind}`,
    sequence: 1,
    kind,
    payload,
  } as MultiplayerEnvelope<Kind>;
}

const guestPlayer = {
  id: "p2",
  connected: true,
  x: 100,
  y: 200,
  hearts: 3,
  shieldCharges: 1,
  invincibleUntilMs: 0,
  carriedCrateCount: 0,
} as const;

const hostPlayer = { ...guestPlayer, id: "p1" as const, x: 90 };
const players = [hostPlayer, guestPlayer];

const snapshot = {
  revision: 4,
  hostTimeMs: 1000,
  started: true,
  state: { raftLevel: 2 },
  players,
};

describe("multiplayer protocol validation", () => {
  it("accepts a complete snapshot and rejects malformed protocol input", () => {
    expect(parseMultiplayerMessage(envelope("snapshot", snapshot)).ok).toBe(true);
    const { started: _legacyStarted, ...legacySnapshot } = snapshot;
    expect(parseMultiplayerMessage(envelope("snapshot", legacySnapshot)).ok).toBe(true);
    const malformedStarted = { ...envelope("snapshot", snapshot), payload: { ...snapshot, started: "yes" } } as unknown;
    expect(parseMultiplayerMessage(malformedStarted)).toEqual({
      ok: false,
      reason: "invalid payload",
    });
    expect(parseMultiplayerMessage({ ...envelope("snapshot", snapshot), protocol: 1 })).toEqual({
      ok: false,
      reason: "unsupported protocol",
    });
    expect(parseMultiplayerMessage({ ...envelope("input", { inputSeq: 1, dx: 1, dy: 0, sprint: false }), payload: { inputSeq: 1, dx: 2, dy: 0, sprint: false } })).toEqual({
      ok: false,
      reason: "invalid payload",
    });
  });

  it("requires an epoch after hello and stable crate IDs in world frames", () => {
    const missingEpoch = { ...envelope("ready", { appliedRevision: 4 }), sessionEpoch: undefined };
    expect(parseMultiplayerMessage(missingEpoch)).toEqual({ ok: false, reason: "missing session epoch" });

    const invalidCrates = envelope("world-frame", {
      revision: 4,
      frameSeq: 8,
      hostTimeMs: 1000,
      players,
      crates: [
        { id: "crate-1", x: 2, y: 3, kind: "supply" },
        { id: "crate-1", x: 4, y: 5, kind: "supply" },
      ],
      world: { shark: { x: 1, y: 2 } },
    });
    expect(parseMultiplayerMessage(invalidCrates)).toEqual({ ok: false, reason: "invalid payload" });
  });

  it("replicates optional crate materials and rejects malformed ones", () => {
    const base = {
      revision: 4,
      frameSeq: 9,
      hostTimeMs: 1000,
      players,
      world: { shark: { x: 1, y: 2 } },
    };
    expect(parseMultiplayerMessage(envelope("world-frame", {
      ...base,
      crates: [{ id: "crate-1", x: 2, y: 3, kind: "supply", material: { name: "Gold", amount: 4, color: "#ffd84e" } }],
    })).ok).toBe(true);
    expect(parseMultiplayerMessage(envelope("world-frame", {
      ...base,
      crates: [{ id: "crate-1", x: 2, y: 3, kind: "supply" }],
    })).ok).toBe(true);
    expect(parseMultiplayerMessage(envelope("world-frame", {
      ...base,
      crates: [{ id: "crate-1", x: 2, y: 3, kind: "supply", material: { name: "Gold", amount: Number.NaN, color: "#ffd84e" } }],
    }))).toEqual({ ok: false, reason: "invalid payload" });
    expect(parseMultiplayerMessage(envelope("world-frame", {
      ...base,
      crates: [{ id: "crate-1", x: 2, y: 3, kind: "supply", material: { name: "", amount: 4, color: "#ffd84e" } }],
    }))).toEqual({ ok: false, reason: "invalid payload" });
  });

  it("requires both players and rejects malformed command payloads", () => {
    expect(parseMultiplayerMessage(envelope("snapshot", { ...snapshot, players: [guestPlayer] }))).toEqual({
      ok: false,
      reason: "invalid payload",
    });
    expect(parseMultiplayerMessage(envelope("world-frame", {
      revision: 4,
      frameSeq: 1,
      hostTimeMs: 1_000,
      players: [{ ...hostPlayer, x: 100_001 }, guestPlayer],
      crates: [],
      world: {},
    }))).toEqual({ ok: false, reason: "invalid payload" });
    expect(parseMultiplayerMessage(envelope("command", {
      commandId: "collect-1",
      baseRevision: 4,
      type: "crate.collect",
      payload: null,
    }))).toEqual({ ok: false, reason: "invalid payload" });
    expect(parseMultiplayerMessage(envelope("command", {
      commandId: "collect-2",
      baseRevision: 4,
      type: "crate.collect",
      payload: {},
    }))).toEqual({ ok: false, reason: "invalid payload" });
    // A bounded unknown command reaches the host so it can return a clear
    // unsupported-command result instead of failing without a reply.
    expect(parseMultiplayerMessage(envelope("command", {
      commandId: "future-1",
      baseRevision: 4,
      type: "future.command",
      payload: {},
    })).ok).toBe(true);
  });

  it("applies bounded-data checks and an application snapshot validator", () => {
    const valid = parseMultiplayerMessage(envelope("snapshot", snapshot), {
      validateSnapshotState: (state: unknown): state is { raftLevel: number } =>
        typeof state === "object" && state !== null && (state as { raftLevel?: unknown }).raftLevel === 2,
    });
    expect(valid.ok).toBe(true);

    const rejected = parseMultiplayerMessage(envelope("snapshot", snapshot), {
      validateSnapshotState: (_state: unknown): _state is { safe: true } => false,
    });
    expect(rejected).toEqual({ ok: false, reason: "invalid payload" });
    const throwing = parseMultiplayerMessage(envelope("snapshot", snapshot), {
      validateSnapshotState: (_state: unknown): _state is Record<string, unknown> => {
        throw new Error("bad application validator");
      },
    });
    expect(throwing).toEqual({ ok: false, reason: "invalid payload" });

    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(parseMultiplayerMessage(envelope("snapshot", { ...snapshot, state: circular }))).toEqual({
      ok: false,
      reason: "invalid payload",
    });
  });
});

describe("message ordering and revisions", () => {
  it("accepts only newer per-sender sequence numbers", () => {
    expect(shouldAcceptSequence(undefined, 0)).toBe(true);
    expect(shouldAcceptSequence(8, 9)).toBe(true);
    expect(shouldAcceptSequence(8, 8)).toBe(false);
    expect(shouldAcceptSequence(8, 7)).toBe(false);
  });

  it("handles snapshots, patches, gaps, stale messages, and wrong epochs", () => {
    const cursor = { sessionEpoch: epoch, revision: 4 };
    expect(decideSnapshotAcceptance(cursor, epoch, 7)).toEqual({ action: "accept" });
    expect(decideSnapshotAcceptance(cursor, epoch, 3)).toEqual({ action: "ignore", reason: "stale" });
    expect(decidePatchAcceptance(cursor, epoch, 4, 5)).toEqual({ action: "accept" });
    expect(decidePatchAcceptance(cursor, epoch, 3, 5)).toEqual({ action: "resync", reason: "revision-gap" });
    expect(decidePatchAcceptance(cursor, "old-epoch", 4, 5)).toEqual({ action: "reject", reason: "wrong-epoch" });
    expect(decideWorldFrameAcceptance(cursor, epoch, 5)).toEqual({ action: "resync", reason: "revision-gap" });
    expect(decideWorldFrameAcceptance(cursor, epoch, 3)).toEqual({ action: "ignore", reason: "stale" });
  });
});

describe("host authority watchdog", () => {
  it("times out only after the allowed silence window", () => {
    expect(hasHostPacketTimedOut(1_000, 3_500, 2_500)).toBe(false);
    expect(hasHostPacketTimedOut(1_000, 3_501, 2_500)).toBe(true);
    expect(hasHostPacketTimedOut(-1, 4_000, 2_500)).toBe(false);
  });
});

describe("duplicate command result cache", () => {
  it("replays the first result and stays bounded", () => {
    let cache = createCommandResultCache(2);
    const first = { commandId: "craft-1", status: "accepted" as const, revision: 5 };
    cache = recordCommandResult(cache, "guest", first);
    cache = recordCommandResult(cache, "guest", { commandId: "craft-1", status: "rejected", revision: 5, reason: "should not replace" });
    expect(findCachedCommandResult(cache, "guest", "craft-1")).toEqual(first);

    cache = recordCommandResult(cache, "guest", { commandId: "craft-2", status: "rejected", revision: 5, reason: "no wood" });
    cache = recordCommandResult(cache, "guest", { commandId: "craft-3", status: "accepted", revision: 6 });
    expect(findCachedCommandResult(cache, "guest", "craft-1")).toBeUndefined();
    expect(cache.entries).toHaveLength(2);
  });
});

describe("host-loss recovery", () => {
  it("keeps the last accepted snapshot without continuing the simulation", () => {
    const recovery = createHostLossRecovery(epoch, snapshot);
    expect(recovery).toMatchObject({
      kind: "host-lost",
      sessionEpoch: epoch,
      lastAcceptedRevision: 4,
      recovery: "wait-for-host",
    });
    expect(recovery.snapshot).toBe(snapshot);
  });
});
