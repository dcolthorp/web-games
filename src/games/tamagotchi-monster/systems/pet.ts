import type { PetState, PetCondition, ColorTheme } from "../model/types";
import {
  BANDAID_CARE_POINTS,
  DOCTOR_CARE_POINTS,
  DENTIST_CARE_POINTS,
  HATCH_PROGRESS_PER_CLICK,
  HATCH_THRESHOLD,
  MAX_DENTAL_HEALTH,
} from "./config";
import { isNu11Mode } from "./theme";
import { clamp } from "./utils";

export function interactEgg(pet: PetState, theme?: ColorTheme): boolean {
  if (pet.stage !== "egg") return false;
  pet.hatchProgress = clamp(pet.hatchProgress + HATCH_PROGRESS_PER_CLICK, 0, HATCH_THRESHOLD);
  if (pet.hatchProgress >= HATCH_THRESHOLD) {
    pet.stage = isNu11Mode(theme) ? "child" : "baby";
    pet.hatchProgress = HATCH_THRESHOLD;
    return true;
  }
  return false;
}

export function setCondition(pet: PetState, condition: PetCondition): void {
  pet.condition = condition;
}

export function applyBandAid(pet: PetState): boolean {
  if (pet.condition !== "minor_ouchie") return false;
  pet.condition = "none";
  pet.carePoints += BANDAID_CARE_POINTS;
  return true;
}

export function completeDoctorVisit(pet: PetState): boolean {
  if (pet.condition !== "bigger_injury") return false;
  pet.condition = "none";
  pet.carePoints += DOCTOR_CARE_POINTS;
  return true;
}

export function completeDentistVisit(pet: PetState): boolean {
  if (pet.condition !== "dental_problem") return false;
  pet.condition = "none";
  pet.dentalHealth = MAX_DENTAL_HEALTH;
  pet.carePoints += DENTIST_CARE_POINTS;
  return true;
}

export function canPlay(pet: PetState): boolean {
  return pet.stage !== "egg" && pet.condition === "none";
}

export function resetPet(pet: PetState): void {
  pet.stage = "egg";
  pet.hunger = 50;
  pet.dentalHealth = 100;
  pet.carePoints = 0;
  pet.hatchProgress = 0;
  pet.condition = "none";
  pet.lastUpdatedAtMs = Date.now();
}

