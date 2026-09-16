import { describe, expect, it } from "vitest";
import {
  BOSS_HEALTH,
  LADDER_HOLDS_MS,
  PHASE_MS,
  bossHasCaught,
  makeBossArena,
  newBoss,
  phaseFor,
  rotLadder,
  throwShard,
  updateBoss,
  updateShards,
  type Boss,
} from "./bossFight";
import { newPlayer, type Player } from "./player";
import { LADDER, blockAt, isSolid } from "./world";

function fight(): { world: ReturnType<typeof makeBossArena>["world"]; boss: Boss; player: Player } {
  const arena = makeBossArena(30);
  const player = newPlayer(arena.spawn);
  const boss = newBoss({ x: 15.5, y: 1, z: 15.5 }, 0);
  return { world: arena.world, boss, player };
}

describe("the boss's room", () => {
  it("is walled in, with ladders up its pillars", () => {
    const arena = makeBossArena(30);
    expect(isSolid(blockAt(arena.world, 0, 3, 15))).toBe(true);
    let ladders = 0;
    for (let x = 0; x < 30; x += 1) {
      for (let z = 0; z < 30; z += 1) {
        for (let y = 0; y < 8; y += 1) if (blockAt(arena.world, x, y, z) === LADDER) ladders += 1;
      }
    }
    expect(ladders).toBeGreaterThan(10);
  });
});

describe("THE WHOLE", () => {
  it("takes a turn at being each kind of glitch, in order", () => {
    const { boss } = fight();
    expect(phaseFor(boss, 0)).toBe("stalker");
    expect(phaseFor(boss, PHASE_MS + 10)).toBe("stopframe");
    expect(phaseFor(boss, PHASE_MS * 2 + 20)).toBe("flicker");
    expect(phaseFor(boss, PHASE_MS * 3 + 30)).toBe("mimic");
    expect(phaseFor(boss, PHASE_MS * 4 + 40)).toBe("stalker");
  });

  it("only freezes when you look at it during its watching turn", () => {
    const { world, boss, player } = fight();
    boss.phase = "stalker";
    updateBoss(world, boss, player, 1 / 60, 0, true);
    expect(boss.frozen).toBe(false);
    boss.phase = "stopframe";
    boss.phaseFrom = 0;
    updateBoss(world, boss, player, 1 / 60, 10, true);
    expect(boss.frozen).toBe(true);
    updateBoss(world, boss, player, 1 / 60, 20, false);
    expect(boss.frozen).toBe(false);
  });

  it("comes after you", () => {
    const { world, boss, player } = fight();
    player.x = 25.5;
    player.z = 15.5;
    const startedAt = boss.x;
    for (let step = 0; step < 60; step += 1) updateBoss(world, boss, player, 1 / 60, step * 16, false);
    expect(boss.x).toBeGreaterThan(startedAt);
  });

  it("catches you when it reaches you", () => {
    const { boss, player } = fight();
    player.x = boss.x + 1;
    player.z = boss.z;
    player.y = boss.y;
    expect(bossHasCaught(boss, player)).toBe(true);
    player.y = boss.y + 4;
    expect(bossHasCaught(boss, player)).toBe(false);
  });
});

describe("shards of the forged crystal", () => {
  it("hurt it while it's frozen", () => {
    const { world, boss, player } = fight();
    boss.frozen = true;
    player.x = boss.x - 4;
    player.z = boss.z;
    player.yaw = Math.atan2(boss.x - player.x, boss.z - player.z);
    let shards = [throwShard(player, 0)];
    let hits = 0;
    for (let step = 0; step < 60 && shards.length > 0; step += 1) {
      const flying = updateShards(world, shards, boss, 1 / 60, step * 16);
      shards = flying.shards;
      hits += flying.hits;
    }
    expect(hits).toBe(1);
    expect(boss.health).toBe(BOSS_HEALTH - 1);
  });

  it("bounce off it while it isn't", () => {
    const { world, boss, player } = fight();
    boss.frozen = false;
    player.x = boss.x - 4;
    player.z = boss.z;
    player.yaw = Math.atan2(boss.x - player.x, boss.z - player.z);
    let shards = [throwShard(player, 0)];
    let bounces = 0;
    for (let step = 0; step < 60 && shards.length > 0; step += 1) {
      const flying = updateShards(world, shards, boss, 1 / 60, step * 16);
      shards = flying.shards;
      bounces += flying.bounces;
    }
    expect(bounces).toBe(1);
    expect(boss.health).toBe(BOSS_HEALTH);
  });
});

describe("the ladders in the boss's room", () => {
  it("hold you for a moment and then get taken away", () => {
    const arena = makeBossArena(30);
    const player = newPlayer(arena.spawn);
    // Stand at the ladder up the first pillar.
    let laddersBefore = 0;
    let ladderSpot = { x: 0, y: 0, z: 0 };
    for (let x = 0; x < 30; x += 1) {
      for (let z = 0; z < 30; z += 1) {
        for (let y = 0; y < 8; y += 1) {
          if (blockAt(arena.world, x, y, z) !== LADDER) continue;
          laddersBefore += 1;
          if (laddersBefore === 1) ladderSpot = { x, y, z };
        }
      }
    }
    player.x = ladderSpot.x + 0.5;
    player.z = ladderSpot.z + 0.5;
    player.y = 2;

    expect(rotLadder(arena.world, player, 1000, 1000 + LADDER_HOLDS_MS - 100)).toBe(false);
    expect(rotLadder(arena.world, player, 1000, 1000 + LADDER_HOLDS_MS + 100)).toBe(true);
  });
});
