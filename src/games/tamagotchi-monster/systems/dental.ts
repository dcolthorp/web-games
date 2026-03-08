import type { ColorTheme, GrowthStage, PetState } from "../model/types";
import {
  DENTAL_CARE_POINTS,
  DENTAL_HEALTH_GAIN,
  DENTAL_SUPPLIES,
  MILLIONAIRE_DENTAL_SUPPLIES,
  MAX_DENTAL_HEALTH,
  NU11_DENTAL_SUPPLIES,
} from "./config";
import { isMillionaireMode, isNu11Mode } from "./theme";
import { clamp } from "./utils";

export function getDentalSupplies(stage: GrowthStage, theme?: ColorTheme) {
  if (isNu11Mode(theme)) return NU11_DENTAL_SUPPLIES;
  if (isMillionaireMode(theme)) {
    return (
      MILLIONAIRE_DENTAL_SUPPLIES[stage] ??
      MILLIONAIRE_DENTAL_SUPPLIES.child ??
      DENTAL_SUPPLIES.child ??
      NU11_DENTAL_SUPPLIES
    );
  }
  return DENTAL_SUPPLIES[stage] ?? DENTAL_SUPPLIES.child ?? NU11_DENTAL_SUPPLIES;
}

export function getWaterDescription(stage: GrowthStage, theme?: ColorTheme): string {
  return getDentalSupplies(stage, theme).waterName;
}

export function getToothpasteDescription(stage: GrowthStage, theme?: ColorTheme): string {
  return getDentalSupplies(stage, theme).toothpasteName;
}

export function brushTeeth(pet: PetState): boolean {
  if (pet.stage === "egg") return false;
  pet.dentalHealth = clamp(pet.dentalHealth + DENTAL_HEALTH_GAIN, 0, MAX_DENTAL_HEALTH);
  pet.carePoints += DENTAL_CARE_POINTS;
  return true;
}

export function getDentalHealthStatus(dentalHealth: number): string {
  if (dentalHealth >= 80) return "Sparkling";
  if (dentalHealth >= 60) return "Healthy";
  if (dentalHealth >= 40) return "Needs Care";
  if (dentalHealth >= 20) return "Cavity Risk";
  return "Critical";
}

export function getDentalHealthColor(dentalHealth: number): [number, number, number] {
  if (dentalHealth >= 80) return [100, 200, 100];
  if (dentalHealth >= 60) return [150, 210, 120];
  if (dentalHealth >= 40) return [220, 200, 100];
  if (dentalHealth >= 20) return [240, 160, 80];
  return [220, 80, 80];
}
