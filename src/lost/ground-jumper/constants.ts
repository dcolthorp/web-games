// Ground Jumper's numbers, straight from the Python version
// (kids-games/ground_jumper/constants.py).

export const WINDOW_WIDTH = 960;
export const WINDOW_HEIGHT = 540;

// Three lanes, stacked up the screen: the one you stand in front is 0.
export const LANE_FOREGROUND = 0;
export const LANE_MIDGROUND = 1;
export const LANE_BACKGROUND = 2;
export const LANE_ORDER = [LANE_FOREGROUND, LANE_MIDGROUND, LANE_BACKGROUND] as const;

export const LANE_COLORS: Record<number, string> = {
  [LANE_FOREGROUND]: "#4080ff",
  [LANE_MIDGROUND]: "#f0c840",
  [LANE_BACKGROUND]: "#dc4040",
};

// The farther back a lane is, the slower it slides past.
export const LANE_SCROLL_SPEED: Record<number, number> = {
  [LANE_FOREGROUND]: 1.0,
  [LANE_MIDGROUND]: 0.72,
  [LANE_BACKGROUND]: 0.52,
};

export const LANE_BAND_HEIGHT = 60;
export const LANE_GAP = 40;
export const LANE_BASE_TOP = WINDOW_HEIGHT - 80;
export const LANE_GROUND_MARGIN = 12;

export const LANE_TOP_Y: Record<number, number> = {};
export const LANE_GROUND_Y: Record<number, number> = {};
LANE_ORDER.forEach((lane, index) => {
  const top = LANE_BASE_TOP - index * (LANE_BAND_HEIGHT + LANE_GAP);
  LANE_TOP_Y[lane] = top;
  LANE_GROUND_Y[lane] = top + LANE_BAND_HEIGHT - LANE_GROUND_MARGIN;
});

// How far into the lane the player and everything else sits.
export const LANE_X_OFFSET: Record<number, number> = {
  [LANE_FOREGROUND]: 140,
  [LANE_MIDGROUND]: 115,
  [LANE_BACKGROUND]: 95,
};

export const WORLD_BASE_SPEED = 320;
export const DIFFICULTY_RAMP = 0.025;
export const MIN_SPAWN_INTERVAL = 0.45;
export const MAX_SPAWN_INTERVAL = 1.3;
export const INVULNERABILITY_TIME = 1.1;
export const FLASH_DURATION = 0.18;

export const GRAVITY = 2000;
export const JUMP_VELOCITY = -650;
export const PLAYER_HORIZONTAL_SPEED = 240;
export const PLAYER_MAX_JUMP_DURATION = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;
export const PLAYER_MAX_JUMP_DISTANCE = PLAYER_HORIZONTAL_SPEED * PLAYER_MAX_JUMP_DURATION;
export const TRAP_REQUIRED_CLEARANCE = PLAYER_MAX_JUMP_DISTANCE * 0.5;

// How far ahead the spawner looks before it drops something in your way, and
// how much runway it leaves you to jump. It gets meaner as you go.
export const LOOKAHEAD_FLOOR_EASY = 2.0;
export const LOOKAHEAD_FLOOR_MEDIUM = 1.5;
export const LOOKAHEAD_FLOOR_HARD = 1.0;
export const MIN_RUNWAY_EASY = 1.0;
export const MIN_RUNWAY_MEDIUM = 0.66;
export const MIN_RUNWAY_HARD = 0.33;

export const OBSTACLE_TYPE_FULL_SIZE = "full_size";
export const OBSTACLE_TYPE_JUMPABLE = "jumpable";
export const OBSTACLE_TYPE_HIGH = "high";

export const STARTING_HEARTS = 3;
export const MAX_HEARTS = 5;

// The Lost Levels swap hearts for a bar that refills while you stand still.
export const DAMAGE_BAR_MAX_VALUE = 100;
export const DAMAGE_BAR_REGEN_RATE_PER_SECOND = 15;
export const DAMAGE_BAR_COLLISION_DAMAGE = 25;

// Get this far in the runner and the Dressing Room opens up.
export const DRESSING_ROOM_UNLOCK_SCORE = 500;
