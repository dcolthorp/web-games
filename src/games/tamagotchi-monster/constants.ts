export const GAME_ID = "tamagotchiMonster";

export const LOGICAL_WIDTH = 800;
export const LOGICAL_HEIGHT = 600;

export const STORAGE_VERSION = 1;

export const STORAGE_KEYS = {
  version: `${GAME_ID}.version`,
  profilesIndex: `${GAME_ID}.profiles`,
  profile: (id: string) => `${GAME_ID}.profile.${id}`,
  monsterIndex: `${GAME_ID}.monsterIndex`,
  leschatAwakened: `${GAME_ID}.leschatAwakened`,
} as const;
