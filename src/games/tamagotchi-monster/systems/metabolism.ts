import type { PetState } from "../model/types";
import {
  DENTAL_DECAY_PER_MINUTE,
  DENTAL_PROBLEM_THRESHOLD,
  HUNGER_INCREASE_PER_MINUTE,
  MAX_DENTAL_HEALTH,
  MAX_HUNGER,
  OFFLINE_CATCHUP_MAX_SECONDS,
} from "./config";
import { clamp } from "./utils";

const SECONDS_PER_MINUTE = 60;

function applyDecay(pet: PetState, elapsedSeconds: number): void {
  const hungerIncrease = (HUNGER_INCREASE_PER_MINUTE / SECONDS_PER_MINUTE) * elapsedSeconds;
  const dentalDecay = (DENTAL_DECAY_PER_MINUTE / SECONDS_PER_MINUTE) * elapsedSeconds;
  pet.hunger = clamp(pet.hunger + hungerIncrease, 0, MAX_HUNGER);
  pet.dentalHealth = clamp(pet.dentalHealth - dentalDecay, 0, MAX_DENTAL_HEALTH);
  if (pet.condition === "none" && pet.dentalHealth <= DENTAL_PROBLEM_THRESHOLD) {
    pet.condition = "dental_problem";
  }
}

export function applyMetabolism(pet: PetState, dtSeconds: number): void {
  if (dtSeconds <= 0) return;
  applyDecay(pet, dtSeconds);
  pet.lastUpdatedAtMs = Date.now();
}

export function applyOfflineCatchup(pet: PetState, nowMs = Date.now()): void {
  const elapsedSeconds = Math.max(0, (nowMs - pet.lastUpdatedAtMs) / 1000);
  const clamped = Math.min(elapsedSeconds, OFFLINE_CATCHUP_MAX_SECONDS);
  if (clamped > 0) {
    applyDecay(pet, clamped);
  }
  pet.lastUpdatedAtMs = nowMs;
}

