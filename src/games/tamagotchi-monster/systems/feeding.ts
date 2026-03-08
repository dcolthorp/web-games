import type { ColorTheme, GrowthStage, PetState } from "../model/types";
import { FOODS, NU11_FOODS, MILLIONAIRE_FOODS, type Food } from "./config";
import { isMillionaireMode, isNu11Mode } from "./theme";
import { clamp } from "./utils";
import { MAX_DENTAL_HEALTH, MAX_HUNGER } from "./config";
import { randomChoice, weightedChoice } from "./utils";

function getCarePoints(food: Food): number {
  if (food.carePointsWeights) {
    const values = food.carePointsWeights.map((pair) => pair[0]);
    const weights = food.carePointsWeights.map((pair) => pair[1]);
    return weightedChoice(values, weights);
  }
  return food.carePoints ?? 0;
}

function isFoodAvailableForStage(food: Food, stage: GrowthStage): boolean {
  if (!food.minStage) return true;
  const order: GrowthStage[] = [
    "egg",
    "child",
    "teen",
    "monster",
    "shadow",
    "specter",
    "wraith",
    "phantom",
    "revenant",
    "nightmare",
    "void_walker",
    "abyss",
    "eldritch",
    "corrupted",
    "xyy4",
  ];
  const minIdx = order.indexOf(food.minStage);
  const curIdx = order.indexOf(stage);
  if (minIdx === -1 || curIdx === -1) return true;
  return curIdx >= minIdx;
}

export function getAvailableFoods(stage: GrowthStage, theme?: ColorTheme): Food[] {
  if (stage === "egg") return [];
  if (isNu11Mode(theme)) {
    return Object.values(NU11_FOODS).filter((food) => isFoodAvailableForStage(food, stage));
  }
  if (isMillionaireMode(theme)) {
    return Object.values(MILLIONAIRE_FOODS).filter((food) => food.stages?.includes(stage));
  }
  return Object.values(FOODS).filter((food) => food.stages?.includes(stage));
}

export function feedPet(pet: PetState, foodId: string, theme?: ColorTheme): boolean {
  if (pet.stage === "egg") return false;
  const pool = isNu11Mode(theme) ? NU11_FOODS : isMillionaireMode(theme) ? MILLIONAIRE_FOODS : FOODS;
  const food = pool[foodId];
  if (!food) return false;
  if (isNu11Mode(theme) && !isFoodAvailableForStage(food, pet.stage)) return false;
  if (!isNu11Mode(theme) && food.stages && !food.stages.includes(pet.stage)) return false;

  const carePoints = getCarePoints(food);
  pet.hunger = clamp(pet.hunger - food.hungerReduction, 0, MAX_HUNGER);
  pet.carePoints += carePoints;
  pet.dentalHealth = clamp(pet.dentalHealth - (food.dentalDamage ?? 0), 0, MAX_DENTAL_HEALTH);
  return true;
}

export function getHungerStatus(hunger: number): string {
  if (hunger <= 20) return "Full";
  if (hunger <= 40) return "Content";
  if (hunger <= 60) return "Hungry";
  if (hunger <= 80) return "Very Hungry";
  return "Starving!";
}

export function getHungerColor(hunger: number): [number, number, number] {
  if (hunger <= 30) return [100, 200, 100];
  if (hunger <= 60) return [200, 200, 100];
  return [200, 100, 100];
}

export function getRandomFood(stage: GrowthStage, theme?: ColorTheme): Food | null {
  const available = getAvailableFoods(stage, theme);
  if (available.length === 0) return null;
  return randomChoice(available);
}
