import type { GrowthStage, ColorTheme, PetState } from "../model/types";
import { NORMAL_STAGE_ORDER, NU11_STAGE_ORDER } from "../model/types";
import {
  EVOLUTION_THRESHOLDS,
  NU11_EVOLUTION_THRESHOLDS,
  NU11_STAGE_NAMES,
  MILLIONAIRE_STAGE_NAMES,
} from "./config";
import { isMillionaireMode, isNu11Mode } from "./theme";

export function getStageName(stage: GrowthStage, theme?: ColorTheme): string {
  if (isMillionaireMode(theme) && MILLIONAIRE_STAGE_NAMES[stage]) {
    return MILLIONAIRE_STAGE_NAMES[stage] as string;
  }
  if (isNu11Mode(theme) && NU11_STAGE_NAMES[stage]) {
    return NU11_STAGE_NAMES[stage] as string;
  }
  const names: Record<GrowthStage, string> = {
    egg: "Egg",
    baby: "Baby",
    child: "Child",
    teen: "Teen",
    monster: "Monster",
    shadow: "Shadow",
    specter: "Specter",
    wraith: "Wraith",
    phantom: "Phantom",
    revenant: "Revenant",
    nightmare: "Nightmare",
    void_walker: "Void Walker",
    abyss: "Abyss",
    eldritch: "Eldritch",
    corrupted: "Corrupted",
    xyy4: "XYY4$992WQERS",
  };
  return names[stage] ?? stage;
}

export function getEvolutionThreshold(stage: GrowthStage, theme?: ColorTheme): number {
  if (stage === "egg") return 0;
  if (isNu11Mode(theme)) {
    const value = NU11_EVOLUTION_THRESHOLDS[stage];
    return value === undefined ? Number.POSITIVE_INFINITY : value;
  }
  const value = EVOLUTION_THRESHOLDS[stage];
  return value === undefined ? Number.POSITIVE_INFINITY : value;
}

export function getNextStage(stage: GrowthStage, theme?: ColorTheme): GrowthStage | null {
  if (isNu11Mode(theme)) {
    const index = NU11_STAGE_ORDER.indexOf(stage);
    if (index >= 0 && index < NU11_STAGE_ORDER.length - 1) return NU11_STAGE_ORDER[index + 1] ?? null;
    return null;
  }
  const index = NORMAL_STAGE_ORDER.indexOf(stage);
  if (index >= 0 && index < NORMAL_STAGE_ORDER.length - 1) return NORMAL_STAGE_ORDER[index + 1] ?? null;
  return null;
}

export function getEvolutionProgress(pet: PetState, theme?: ColorTheme): number {
  if (pet.stage === "egg") return pet.hatchProgress / 100;
  const threshold = getEvolutionThreshold(pet.stage, theme);
  if (!Number.isFinite(threshold) || threshold <= 0) return 1;
  return Math.min(1, pet.carePoints / threshold);
}

export function checkEvolution(pet: PetState, theme?: ColorTheme): boolean {
  if (pet.stage === "egg") return false;
  const threshold = getEvolutionThreshold(pet.stage, theme);
  if (!Number.isFinite(threshold)) return false;
  if (pet.carePoints < threshold) return false;
  const next = getNextStage(pet.stage, theme);
  if (!next) return false;
  pet.stage = next;
  pet.carePoints = 0;
  return true;
}
