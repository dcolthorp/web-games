import type { PetState, PetCondition, PetMood, ColorTheme } from "../model/types";
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

const MEHH_AT = 40;
const SAD_AT = 60;
const FACELESS_AT = 80;

// How badly the pet is doing, from 0 (great) to 100 (terrible). The worst stat wins.
function getMoodBadness(pet: PetState): number {
  return Math.max(pet.hunger, MAX_DENTAL_HEALTH - pet.dentalHealth);
}

// Starving or rotten teeth wipe the face off completely.
export function getPetMood(pet: PetState): PetMood {
  const badness = getMoodBadness(pet);
  if (badness > FACELESS_AT) return "faceless";
  if (badness > SAD_AT || pet.condition !== "none") return "sad";
  if (badness > MEHH_AT) return "mehh";
  return "happy";
}

// Both bars run from 0 to 1. `worse` fills up as the pet gets close to `nextWorse`, its next-worse face.
// `happy` is only completely full when the pet is actually happy.
export function getMoodBars(pet: PetState): { happy: number; worse: number; nextWorse: PetMood } {
  const badness = getMoodBadness(pet);
  const mood = getPetMood(pet);
  const [from, to] = mood === "happy" ? [0, MEHH_AT] : mood === "mehh" ? [MEHH_AT, SAD_AT] : [SAD_AT, FACELESS_AT];
  const worse = mood === "faceless" ? 1 : clamp((badness - from) / (to - from), 0, 1);
  const happy = mood === "happy" ? 1 : Math.min(0.9, clamp((100 - badness) / (100 - MEHH_AT), 0, 1));
  const nextWorse = mood === "happy" ? "mehh" : mood === "mehh" ? "sad" : "faceless";
  return { happy, worse, nextWorse };
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

