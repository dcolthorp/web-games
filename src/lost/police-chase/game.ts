// A run across the rooftops: the physics, the cops, and everything that can
// end it. Nothing here draws, so the chase can be tested on its own.

import {
  BASE_RUN_SPEED,
  COP_CHASE_SPEED_DELTA,
  COP_CHASE_SPEED_MAX,
  COP_CHASE_SPEED_MIN,
  COP_CHASE_TRIGGER_PX,
  DISTANCE_SCORE_RATE,
  GRAVITY_PX_S2,
  GROUND_Y,
  JUMP_CUT_VY_SCALE,
  JUMP_HOLD_GRAVITY_SCALE,
  JUMP_HOLD_MAX_S,
  JUMP_VELOCITY_PX_S,
  MAX_FALL_SPEED_PX_S,
  MAX_RUN_SPEED,
  PLAYER_ACCEL_PX_S2,
  PLAYER_FRICTION_PX_S2,
  PLAYER_LEFT_MARGIN_X,
  PLAYER_TARGET_SCREEN_X,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SPEED_RAMP_PX_S2,
  chimneyOpening,
  clamp,
  copRect,
  despawnBehind,
  ensureAhead,
  hits,
  lootRect,
  lootValue,
  makeBonusWorld,
  makeWorld,
  playerRect,
  randomFrom,
  resetBonus,
  resetWorld,
  roofAtX,
  roofUnder,
  type BonusWorld,
  type Player,
  type World,
} from "./world";

export interface Keys {
  left: boolean;
  right: boolean;
  down: boolean;
  jump: boolean;
}

export type Phase = "run" | "bonus" | "over";

export interface Chase {
  phase: Phase;
  player: Player;
  world: World;
  bonus: BonusWorld;
  camera: number;
  time: number;
  scoreFloat: number;
  score: number;
  highScore: number;
  distance: number;
  runSpeed: number;
  difficulty: number;
  reason: string;
  jumpWasPressed: boolean;
  random: () => number;
}

export function newChase(highScore = 0, seed = Math.floor(Math.random() * 1e9)): Chase {
  const random = randomFrom(seed);
  const world = makeWorld(random);
  const player: Player = {
    x: PLAYER_LEFT_MARGIN_X,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    grounded: false,
    jumpHold: 0,
    w: 26,
    h: 64,
  };
  resetWorld(world, player.x, GROUND_Y);
  return {
    phase: "run",
    player,
    world,
    bonus: makeBonusWorld(),
    camera: 0,
    time: 0,
    scoreFloat: 0,
    score: 0,
    highScore,
    distance: 0,
    runSpeed: BASE_RUN_SPEED,
    difficulty: 0,
    reason: "",
    jumpWasPressed: false,
    random,
  };
}

function gameOver(chase: Chase, reason: string): void {
  chase.reason = reason;
  chase.phase = "over";
  chase.highScore = Math.max(chase.highScore, chase.score);
}

export function step(chase: Chase, keys: Keys, seconds: number): void {
  if (chase.phase === "over") return;
  chase.time += seconds;

  // You get faster the longer you're out there, and so does everything else.
  chase.runSpeed = clamp(chase.runSpeed + SPEED_RAMP_PX_S2 * seconds, BASE_RUN_SPEED, MAX_RUN_SPEED);
  chase.difficulty = clamp(
    (chase.runSpeed - BASE_RUN_SPEED) / Math.max(1, MAX_RUN_SPEED - BASE_RUN_SPEED),
    0,
    1
  );

  const player = chase.player;

  let ax = 0;
  if (keys.left && !keys.right) ax = -PLAYER_ACCEL_PX_S2;
  else if (keys.right && !keys.left) ax = PLAYER_ACCEL_PX_S2;
  else if (player.vx > 0) ax = -PLAYER_FRICTION_PX_S2;
  else if (player.vx < 0) ax = PLAYER_FRICTION_PX_S2;

  player.vx = clamp(player.vx + ax * seconds, -chase.runSpeed * 0.72, chase.runSpeed);
  if (!keys.left && !keys.right && Math.abs(player.vx) < 22) player.vx = 0;
  player.x += player.vx * seconds;

  if (keys.jump && !chase.jumpWasPressed && player.grounded) {
    player.vy = -JUMP_VELOCITY_PX_S;
    player.grounded = false;
    player.jumpHold = 0;
  }
  // Letting go early cuts the jump short.
  if (!keys.jump && chase.jumpWasPressed && player.vy < 0) player.vy *= JUMP_CUT_VY_SCALE;

  let gravityScale = 1;
  if (keys.jump && player.vy < 0 && player.jumpHold < JUMP_HOLD_MAX_S) {
    gravityScale = JUMP_HOLD_GRAVITY_SCALE;
    player.jumpHold += seconds;
  }
  // Holding down drops you faster, which is how you get into a chimney.
  if (keys.down && !player.grounded && player.vy < MAX_FALL_SPEED_PX_S) {
    player.vy = Math.min(MAX_FALL_SPEED_PX_S, player.vy + GRAVITY_PX_S2 * seconds * 0.65);
  }
  player.vy = Math.min(MAX_FALL_SPEED_PX_S, player.vy + GRAVITY_PX_S2 * gravityScale * seconds);
  player.y += player.vy * seconds;
  chase.jumpWasPressed = keys.jump;

  // The camera only ever goes forward, and it drags you along with it.
  const oldCamera = chase.camera;
  const target = player.x - PLAYER_TARGET_SCREEN_X;
  if (target > chase.camera) chase.camera = target;
  const minPlayerX = chase.camera + PLAYER_LEFT_MARGIN_X;
  if (player.x < minPlayerX) {
    player.x = minPlayerX;
    if (player.vx < 0) player.vx = 0;
  }

  const cameraLeft = chase.camera;
  const cameraRight = chase.camera + SCREEN_WIDTH;
  const cameraDx = Math.max(0, chase.camera - oldCamera);
  chase.distance += cameraDx;
  chase.scoreFloat += cameraDx * DISTANCE_SCORE_RATE;

  if (chase.phase === "run") {
    stepRun(chase, keys, seconds, cameraLeft, cameraRight);
  } else {
    stepBonus(chase, cameraLeft);
  }

  chase.score = Math.trunc(chase.scoreFloat);
}

function stepRun(chase: Chase, keys: Keys, seconds: number, cameraLeft: number, cameraRight: number): void {
  const player = chase.player;
  const world = chase.world;

  ensureAhead(world, {
    cameraRight,
    playerSpeed: chase.runSpeed,
    roofY: GROUND_Y,
    difficulty: chase.difficulty,
  });
  despawnBehind(world, cameraLeft);

  const playerRoof = roofUnder(world, player.x, player.y);
  if (playerRoof && player.vy >= 0 && player.y >= playerRoof.y) {
    player.y = playerRoof.y;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  // Miss a roof and that's the run.
  if (player.y > SCREEN_HEIGHT + 140) {
    gameOver(chase, "You fell.");
    return;
  }

  const box = playerRect(player);

  // Green chimneys are the bonus. Every other chimney is a mistake.
  for (const chimney of world.chimneys) {
    if (!hits(box, chimneyOpening(chimney))) continue;
    if (!keys.down && player.vy <= 200) continue;
    if (chimney.isBonus) {
      chase.phase = "bonus";
      resetBonus(chase.bonus, player.x, GROUND_Y, chase.random);
      world.cops = [];
      world.chimneys = [];
      return;
    }
    gameOver(chase, "Wrong chimney.");
    return;
  }

  for (const cop of [...world.cops]) {
    if (cop.state === "chase") {
      const speed = clamp(
        chase.runSpeed - COP_CHASE_SPEED_DELTA,
        COP_CHASE_SPEED_MIN,
        COP_CHASE_SPEED_MAX
      );
      cop.x += (player.x >= cop.x ? 1 : -1) * speed * seconds;
    } else {
      const roof = roofAtX(world, cop.x);
      if (roof) {
        const left = roof.startX + cop.w * 0.4;
        const right = roof.endX - cop.w * 0.4;
        cop.x += cop.patrolDir * cop.patrolSpeed * seconds;
        if (cop.x <= left) {
          cop.x = left;
          cop.patrolDir = 1;
        } else if (cop.x >= right) {
          cop.x = right;
          cop.patrolDir = -1;
        }
      }
      // Step onto a cop's roof and they'll come after you.
      if (playerRoof && roof === playerRoof && Math.abs(player.x - cop.x) <= COP_CHASE_TRIGGER_PX) {
        cop.state = "chase";
      }
    }

    cop.vy = Math.min(MAX_FALL_SPEED_PX_S, cop.vy + GRAVITY_PX_S2 * seconds);
    cop.y += cop.vy * seconds;
    const under = roofUnder(world, cop.x, cop.y);
    if (under && cop.vy >= 0 && cop.y >= under.y) {
      cop.y = under.y;
      cop.vy = 0;
      cop.grounded = true;
    } else {
      cop.grounded = false;
    }

    // A cop who runs off the edge chasing you is gone for good.
    if (cop.y > SCREEN_HEIGHT + 140) {
      world.cops = world.cops.filter((other) => other !== cop);
      continue;
    }

    if (hits(box, copRect(cop))) {
      gameOver(chase, "Caught by the cops.");
      return;
    }
  }

  world.loot = world.loot.filter((item) => {
    if (!hits(box, lootRect(item))) return true;
    chase.scoreFloat += lootValue(item.kind);
    return false;
  });
}

function stepBonus(chase: Chase, cameraLeft: number): void {
  const player = chase.player;
  if (player.y >= GROUND_Y && player.vy >= 0) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  const cutoff = cameraLeft - 300;
  chase.bonus.loot = chase.bonus.loot.filter((item) => item.x >= cutoff);

  const box = playerRect(player);
  chase.bonus.loot = chase.bonus.loot.filter((item) => {
    if (!hits(box, lootRect(item))) return true;
    chase.scoreFloat += lootValue(item.kind);
    return false;
  });

  // Run out the far end of the bonus roof and you're back on the rooftops.
  if (player.x >= chase.bonus.endX) {
    chase.phase = "run";
    resetWorld(chase.world, player.x, GROUND_Y);
  }
}
