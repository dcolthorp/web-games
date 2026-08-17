import { describe, expect, it } from "vitest";
import {
  createInitialState,
  createReducerRuntime,
  reduceCommand,
  type MultiplayerState,
} from "./multiplayerState";

function makeState(overrides: Parameters<typeof createInitialState>[0] = {}): MultiplayerState {
  return createInitialState({
    shared: {
      inventory: { Wood: 0, Stone: 0, "Technology Shards": 0 },
      ...overrides.shared,
    },
    ...overrides,
  });
}

describe("multiplayer authoritative state", () => {
  it("persists a guest raft upgrade and does not apply a duplicate request", () => {
    let state = makeState({
      shared: { inventory: { Wood: 8, Stone: 2 } },
    });
    const runtime = createReducerRuntime("p1");
    const command = {
      kind: "raft.expand" as const,
      requestId: "guest-upgrade-1",
      actor: "p2" as const,
      baseRevision: 0,
    };

    const first = reduceCommand(state, command, runtime);
    expect(first.accepted).toBe(true);
    expect(first.revision).toBe(1);
    state = first.state;
    expect(state.shared.raftLevel).toBe(2);
    expect(state.shared.expansionCount).toBe(1);
    expect(state.shared.inventory).toMatchObject({ Wood: 0, Stone: 0 });

    const duplicate = reduceCommand(state, command, runtime);
    expect(duplicate.accepted).toBe(true);
    expect(duplicate.revision).toBe(1);
    expect(duplicate.state.shared.raftLevel).toBe(2);
    expect(duplicate.state.shared.inventory).toMatchObject({ Wood: 0, Stone: 0 });
  });

  it("makes a guest shield visible in the shared snapshot and consumes it once", () => {
    let state = makeState({
      shared: { inventory: { "Technology Shards": 10 } },
      players: { p2: { hearts: 3, maxHearts: 3 } },
    });
    const runtime = createReducerRuntime("p1");

    const crafted = reduceCommand(state, {
      kind: "shield.craft",
      requestId: "guest-shield-1",
      actor: "p2",
      baseRevision: 0,
    }, runtime);
    expect(crafted.accepted).toBe(true);
    state = crafted.state;
    expect(state.players.p2.shieldCharges).toBe(1);
    expect(state.shared.inventory["Technology Shards"]).toBe(5);

    const secondShield = reduceCommand(state, {
      kind: "shield.craft",
      requestId: "guest-shield-2",
      actor: "p2",
      baseRevision: 1,
    }, runtime);
    expect(secondShield.accepted).toBe(false);
    expect(secondShield.reason).toBe("shield-already-active");
    expect(secondShield.revision).toBe(1);
    expect(secondShield.state.shared.inventory["Technology Shards"]).toBe(5);

    // This is the exact snapshot that Player 1 uses for remote rendering.
    expect(crafted.state.players.p2.shieldCharges).toBe(1);

    const hit = reduceCommand(state, {
      kind: "shark.hit",
      requestId: "bite-1",
      actor: "p1",
      target: "p2",
      attackerId: "shark-1",
      attackId: "shark-1-bite-1",
    }, runtime);
    expect(hit.accepted).toBe(true);
    expect(hit.effect).toBe("shield-blocked");
    expect(hit.state.players.p2.hearts).toBe(3);
    expect(hit.state.players.p2.shieldCharges).toBe(0);

    const retryWithNewRequestId = reduceCommand(hit.state, {
      kind: "shark.hit",
      requestId: "bite-1-retry",
      actor: "p1",
      target: "p2",
      attackerId: "shark-1",
      attackId: "shark-1-bite-1",
    }, runtime);
    expect(retryWithNewRequestId.accepted).toBe(false);
    expect(retryWithNewRequestId.reason).toBe("duplicate-attack");
    expect(retryWithNewRequestId.state.players.p2.shieldCharges).toBe(0);
  });

  it("reports invincibility when a second bite arrives during the grace period", () => {
    let state = makeState({
      players: { p2: { hearts: 3, maxHearts: 3 } },
    });
    const runtime = createReducerRuntime("p1", 10);
    const first = reduceCommand(state, {
      kind: "shark.hit",
      requestId: "damage-1",
      actor: "p1",
      target: "p2",
      attackerId: "shark-1",
      attackId: "bite-a",
    }, runtime);
    expect(first.accepted).toBe(true);
    state = first.state;
    expect(state.players.p2.hearts).toBe(2);

    const second = reduceCommand(state, {
      kind: "shark.hit",
      requestId: "damage-2",
      actor: "p1",
      target: "p2",
      attackerId: "shark-2",
      attackId: "bite-b",
    }, runtime);
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe("player-invincible");
    expect(second.revision).toBe(first.revision);
    expect(second.state.players.p2.hearts).toBe(2);
  });

  it("rejects reordered stale requests without corrupting the canonical state", () => {
    let state = makeState({
      shared: { inventory: { Wood: 16, Stone: 4 } },
    });
    const runtime = createReducerRuntime("p1");

    // Both requests were made against revision 0, but request B reaches the
    // host first. The host accepts B and rejects the reordered stale request A.
    const requestB = reduceCommand(state, {
      kind: "raft.expand",
      requestId: "request-b",
      actor: "p2",
      baseRevision: 0,
    }, runtime);
    expect(requestB.accepted).toBe(true);
    state = requestB.state;

    const requestA = reduceCommand(state, {
      kind: "raft.expand",
      requestId: "request-a",
      actor: "p1",
      baseRevision: 0,
    }, runtime);
    expect(requestA.accepted).toBe(false);
    expect(requestA.reason).toBe("stale-revision");
    expect(requestA.revision).toBe(1);
    expect(requestA.state.shared.expansionCount).toBe(1);
    expect(requestA.state.shared.inventory["Wood"]).toBe(8);

    // An old retry must not return an old snapshot and roll the room back.
    const staleRetry = reduceCommand(state, {
      kind: "raft.expand",
      requestId: "request-a",
      actor: "p1",
      baseRevision: 0,
    }, runtime);
    expect(staleRetry.state.revision).toBe(1);
    expect(staleRetry.state.shared.expansionCount).toBe(1);
  });

  it("serializes simultaneous spending and never creates negative inventory", () => {
    let state = makeState({
      shared: { inventory: { Wood: 12, Stone: 2 } },
    });
    const runtime = createReducerRuntime("p1");

    const first = reduceCommand(state, {
      kind: "raft.expand",
      requestId: "simultaneous-1",
      actor: "p1",
    }, runtime);
    expect(first.accepted).toBe(true);
    state = first.state;

    const second = reduceCommand(state, {
      kind: "raft.expand",
      requestId: "simultaneous-2",
      actor: "p2",
    }, runtime);
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe("insufficient-resources");
    expect(second.state.shared.expansionCount).toBe(1);
    expect(second.state.shared.inventory["Wood"]).toBe(4);
    expect(second.state.shared.inventory["Stone"]).toBe(0);
    expect(Object.values(second.state.shared.inventory).every((amount) => amount >= 0)).toBe(true);
  });

  it("collects and deposits a stable-ID crate exactly once", () => {
    let state = makeState({
      shared: {
        crates: [{
          id: "crate-1",
          x: 100,
          y: 100,
          kind: "wooden",
          reward: { inventory: { Wood: 2 }, foodHealing: [1] },
        }],
      },
      players: { p2: { x: 100, y: 100 } },
    });
    const runtime = createReducerRuntime("p1", 0, {
      canDepositCrate: (_state, actor) => actor === "p2",
    });

    const collected = reduceCommand(state, {
      kind: "crate.collect",
      requestId: "collect-1",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 0,
    }, runtime);
    expect(collected.accepted).toBe(true);
    state = collected.state;
    expect(state.shared.crates).toHaveLength(0);
    expect(state.players.p2.carriedCrateIds).toEqual(["crate-1"]);

    const duplicateCollect = reduceCommand(state, {
      kind: "crate.collect",
      requestId: "collect-1",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 0,
    }, runtime);
    expect(duplicateCollect.accepted).toBe(true);
    expect(duplicateCollect.state.players.p2.carriedCrateIds).toEqual(["crate-1"]);

    const deposited = reduceCommand(state, {
      kind: "crate.deposit",
      requestId: "deposit-1",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 1,
    }, runtime);
    expect(deposited.accepted).toBe(true);
    state = deposited.state;
    expect(state.players.p2.carriedCrateIds).toEqual([]);
    expect(state.shared.inventory["Wood"]).toBe(2);
    expect(state.shared.foodHealing).toEqual([1]);

    const duplicateDeposit = reduceCommand(state, {
      kind: "crate.deposit",
      requestId: "deposit-1",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 1,
    }, runtime);
    expect(duplicateDeposit.accepted).toBe(true);
    expect(duplicateDeposit.state.shared.inventory["Wood"]).toBe(2);

    const newRequestForAlreadyDepositedCrate = reduceCommand(state, {
      kind: "crate.deposit",
      requestId: "deposit-2",
      actor: "p2",
      crateId: "crate-1",
    }, runtime);
    expect(newRequestForAlreadyDepositedCrate.accepted).toBe(false);
    expect(newRequestForAlreadyDepositedCrate.reason).toBe("crate-not-carried");
  });

  it("retains the latest canonical snapshot across reconnect", () => {
    const state = makeState({
      revision: 7,
      serverTime: 42,
      shared: {
        inventory: { Wood: 3 },
        crates: [{
          id: "crate-carried",
          x: 20,
          y: 20,
          kind: "supply",
          reward: { inventory: { Stone: 1 } },
        }],
      },
      players: {
        p2: {
          x: 20,
          y: 20,
          hearts: 2,
          maxHearts: 3,
          shieldCharges: 1,
          carriedCrateIds: ["crate-carried"],
          online: true,
        },
      },
    });
    expect(state.protocolVersion).toBe(2);

    // This is the value a client writes to its local recovery store. A new
    // client session can restore it without importing the browser game module.
    const resumed = createInitialState({
      revision: state.revision,
      serverTime: state.serverTime,
      shared: state.shared,
      players: state.players,
    });
    expect(resumed.revision).toBe(7);
    expect(resumed.serverTime).toBe(42);
    expect(resumed.shared.inventory["Wood"]).toBe(3);
    expect(resumed.players.p2.hearts).toBe(2);
    expect(resumed.players.p2.shieldCharges).toBe(1);
    expect(resumed.players.p2.carriedCrateIds).toEqual(["crate-carried"]);

    const runtime = createReducerRuntime("p1");
    const staleCommand = reduceCommand(resumed, {
      kind: "raft.expand",
      requestId: "after-reconnect-stale",
      actor: "p2",
      baseRevision: 6,
    }, runtime);
    expect(staleCommand.accepted).toBe(false);
    expect(staleCommand.reason).toBe("stale-revision");
    expect(staleCommand.state.revision).toBe(7);
  });

  it("lets a guest eat shared food exactly once per request", () => {
    let state = makeState({
      shared: { foodHealing: [1, 99] },
      players: { p2: { hearts: 1, maxHearts: 3 } },
    });
    const runtime = createReducerRuntime("p1");

    const snack = reduceCommand(state, {
      kind: "food.eat",
      requestId: "eat-1",
      actor: "p2",
      baseRevision: 0,
    }, runtime);
    expect(snack.accepted).toBe(true);
    state = snack.state;
    expect(state.players.p2.hearts).toBe(2);
    expect(state.shared.foodHealing).toEqual([99]);

    const duplicate = reduceCommand(state, {
      kind: "food.eat",
      requestId: "eat-1",
      actor: "p2",
      baseRevision: 0,
    }, runtime);
    expect(duplicate.state.players.p2.hearts).toBe(2);
    expect(duplicate.state.shared.foodHealing).toEqual([99]);

    const meal = reduceCommand(state, {
      kind: "food.eat",
      requestId: "eat-2",
      actor: "p2",
      baseRevision: 1,
    }, runtime);
    expect(meal.accepted).toBe(true);
    expect(meal.state.players.p2.hearts).toBe(3);
    expect(meal.state.shared.foodHealing).toEqual([]);
  });

  it("rejects eating without food, at full hearts, or while dead", () => {
    const runtime = createReducerRuntime("p1");
    const noFood = reduceCommand(makeState({ players: { p2: { hearts: 1, maxHearts: 3 } } }), {
      kind: "food.eat",
      requestId: "eat-no-food",
      actor: "p2",
    }, runtime);
    expect(noFood.accepted).toBe(false);
    expect(noFood.reason).toBe("no-food");

    const fullHearts = reduceCommand(makeState({
      shared: { foodHealing: [1] },
      players: { p2: { hearts: 3, maxHearts: 3 } },
    }), {
      kind: "food.eat",
      requestId: "eat-full",
      actor: "p2",
    }, runtime);
    expect(fullHearts.accepted).toBe(false);
    expect(fullHearts.reason).toBe("hearts-full");
    expect(fullHearts.state.shared.foodHealing).toEqual([1]);

    const dead = reduceCommand(makeState({
      shared: { foodHealing: [99] },
      players: { p2: { hearts: 0, maxHearts: 3 } },
    }), {
      kind: "food.eat",
      requestId: "eat-dead",
      actor: "p2",
    }, runtime);
    expect(dead.accepted).toBe(false);
    expect(dead.reason).toBe("player-dead");
  });

  it("rejects non-finite positions before they enter player state", () => {
    const state = makeState();
    const runtime = createReducerRuntime("p1");
    const result = reduceCommand(state, {
      kind: "player.position",
      requestId: "bad-position",
      actor: "p2",
      x: Number.NaN,
      y: 10,
    }, runtime);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("invalid-command");
    expect(result.state.players.p2.x).toBe(0);
  });

  it("scopes duplicate request IDs by actor and bounds the request cache", () => {
    let state = makeState();
    const runtime = createReducerRuntime("p1", 0, { requestCacheCapacity: 2 });
    const first = reduceCommand(state, {
      kind: "player.position",
      requestId: "shared-id",
      actor: "p1",
      x: 10,
      y: 11,
    }, runtime);
    state = first.state;
    const second = reduceCommand(state, {
      kind: "player.position",
      requestId: "shared-id",
      actor: "p2",
      x: 20,
      y: 21,
    }, runtime);
    state = second.state;
    expect(state.players.p1.x).toBe(10);
    expect(state.players.p2.x).toBe(20);

    state = reduceCommand(state, {
      kind: "player.position",
      requestId: "third-id",
      actor: "p1",
      x: 30,
      y: 31,
    }, runtime).state;
    expect(runtime.processedRequests.size).toBe(2);
    expect([...runtime.processedRequests.keys()]).toEqual(["p2\u0000shared-id", "p1\u0000third-id"]);
  });

  it("requires trusted host authorization before a carried crate is deposited", () => {
    const state = makeState({
      shared: {
        crateCatalog: {
          "crate-1": { id: "crate-1", x: 100, y: 100, kind: "wooden", reward: { inventory: { Wood: 2 } } },
        },
      },
      players: { p2: { x: 100, y: 100, carriedCrateIds: ["crate-1"] } },
    });
    const denied = reduceCommand(state, {
      kind: "crate.deposit",
      requestId: "deposit-denied",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 0,
    }, createReducerRuntime("p1"));
    expect(denied.accepted).toBe(false);
    expect(denied.reason).toBe("crate-deposit-not-authorized");

    const allowed = reduceCommand(state, {
      kind: "crate.deposit",
      requestId: "deposit-allowed",
      actor: "p2",
      crateId: "crate-1",
      baseRevision: 0,
    }, createReducerRuntime("p1", 0, { canDepositCrate: () => true }));
    expect(allowed.accepted).toBe(true);
    expect(allowed.state.shared.inventory["Wood"]).toBe(2);
  });

  it("rejects oversized command identifiers", () => {
    const state = makeState();
    const runtime = createReducerRuntime("p1");
    const result = reduceCommand(state, {
      kind: "crate.collect",
      requestId: "valid-request",
      actor: "p2",
      crateId: "x".repeat(161),
    }, runtime);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("invalid-command");
  });
});
