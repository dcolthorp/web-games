import { isGigantic } from "../../shared/bigGames";

// GIGANTIC Tamagotchi Monster: your monster stays its normal size, and the
// stuff around it (decorations, sparkles, toys, brushes, band-aids) goes giant.
export const GIGANTIC = isGigantic("tamagotchi-monster");
export const GIANT = GIGANTIC ? 3 : 1;
export const GAME_TITLE = GIGANTIC ? "GIGANTIC Tamagotchi Monster" : "Tamagotchi Monster";
