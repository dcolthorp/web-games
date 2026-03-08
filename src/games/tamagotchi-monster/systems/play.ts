import type { ColorTheme, GrowthStage, PlayOutcome, PetCondition } from "../model/types";
import {
  NU11_PLAY_ACTIVITIES,
  MILLIONAIRE_PLAY_ACTIVITIES,
  PLAY_ACTIVITIES,
  PLAY_OUTCOME_WEIGHTS,
  PLAY_SUCCESS_CARE_POINTS,
} from "./config";
import { isMillionaireMode, isNu11Mode } from "./theme";
import { weightedChoice } from "./utils";

export function getActivitiesForStage(stage: GrowthStage, theme?: ColorTheme) {
  if (isNu11Mode(theme)) return NU11_PLAY_ACTIVITIES;
  if (isMillionaireMode(theme)) return MILLIONAIRE_PLAY_ACTIVITIES[stage] ?? [];
  return PLAY_ACTIVITIES[stage] ?? [];
}

export function getActivityById(stage: GrowthStage, activityId: string, theme?: ColorTheme) {
  const activities = getActivitiesForStage(stage, theme);
  return activities.find((activity) => activity.id === activityId);
}

export function determinePlayOutcome(): PlayOutcome {
  const outcomes = Object.keys(PLAY_OUTCOME_WEIGHTS) as PlayOutcome[];
  const weights = outcomes.map((key) => PLAY_OUTCOME_WEIGHTS[key]);
  return weightedChoice(outcomes, weights);
}

export function outcomeToCondition(outcome: PlayOutcome): PetCondition {
  if (outcome === "minor_ouchie") return "minor_ouchie";
  if (outcome === "bigger_injury") return "bigger_injury";
  if (outcome === "dental_problem") return "dental_problem";
  return "none";
}

export function getOutcomeCarePoints(outcome: PlayOutcome): number {
  if (outcome === "success") return PLAY_SUCCESS_CARE_POINTS;
  return 0;
}

export function getOutcomeMessage(outcome: PlayOutcome, stage: GrowthStage, theme?: ColorTheme): string {
  if (isMillionaireMode(theme)) {
    if (outcome === "success") {
      if (stage === "baby" || stage === "child") return "Yay! That was fun!";
      if (stage === "teen") return "Nice! That was premium!";
      return "Excellent. Absolutely deluxe!";
    }
    if (outcome === "minor_ouchie") {
      if (stage === "baby" || stage === "child") return "Ouch! Need a bandage...";
      if (stage === "teen") return "Ow. That'll leave a mark.";
      return "Unacceptable. Apply a bandage.";
    }
    if (outcome === "bigger_injury") {
      if (stage === "baby" || stage === "child") return "Waah! Need a doctor...";
      if (stage === "teen") return "Oof. Time for the doctor.";
      return "Call the concierge doctor.";
    }
    if (stage === "baby" || stage === "child") return "Owie! My tooth!";
    if (stage === "teen") return "Ow. Need a dentist.";
    return "My tooth! Summon the dentist.";
  }
  if (outcome === "success") {
    if (stage === "baby" || stage === "child") return "Yay! That was so much fun!";
    if (stage === "teen") return "Cool! That was awesome!";
    return "Mwahahaha! Excellent!";
  }
  if (outcome === "minor_ouchie") {
    if (stage === "baby" || stage === "child") return "Ouch! Got a little boo-boo...";
    if (stage === "teen") return "Ow! That's gonna leave a mark...";
    return "Grr... a minor scratch...";
  }
  if (outcome === "bigger_injury") {
    if (stage === "baby" || stage === "child") return "Waah! That really hurts!";
    if (stage === "teen") return "Ooof! Need to see a doctor...";
    return "Argh! Even monsters need doctors...";
  }
  if (stage === "baby" || stage === "child") return "Owie! My tooth!";
  if (stage === "teen") return "Ugh! Chipped a tooth...";
  return "My fang! Need a dentist...";
}

export function isSpookyStage(stage: GrowthStage, theme?: ColorTheme): boolean {
  if (isNu11Mode(theme)) return true;
  if (isMillionaireMode(theme)) return false;
  return stage === "teen" || stage === "monster";
}
