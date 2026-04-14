import { STAGE_THRESHOLDS } from "../constants";
import type { FamilySave, LifeStage, Milestone, PersonState } from "../model/types";
import { birthNextBaby, ensurePartner, getRoleTag } from "./family";

function nextStage(stage: LifeStage): LifeStage | null {
  switch (stage) {
    case "baby":
      return "toddler";
    case "toddler":
      return "kid";
    case "kid":
      return "teen";
    case "teen":
      return "grownup";
    default:
      return null;
  }
}

function stageTitle(stage: LifeStage): string {
  switch (stage) {
    case "toddler":
      return "Toddler";
    case "kid":
      return "Kid";
    case "teen":
      return "Teen";
    case "grownup":
      return "Grown Up";
    case "parent":
      return "Parent";
    case "grandparent":
      return "Grand";
    default:
      return "Baby";
  }
}

export function addCareStars(save: FamilySave, person: PersonState, amount: number): Milestone | null {
  person.ageProgress += amount;

  const next = nextStage(person.lifeStage);
  if (next) {
    const limit = STAGE_THRESHOLDS[person.lifeStage];
    if (person.ageProgress >= limit) {
      person.lifeStage = next;
      person.ageProgress = 0;
      person.currentRole = getRoleTag(person);
      return {
        type: "stage-up",
        personId: person.id,
        title: stageTitle(next),
        note: `${person.name} grew!`,
        newStage: next,
      };
    }
    return null;
  }

  if (person.lifeStage === "grownup") {
    if (!person.partnerName && person.ageProgress >= STAGE_THRESHOLDS.grownup) {
      ensurePartner(person);
      person.ageProgress = 0;
      return {
        type: "partner",
        personId: person.id,
        title: "Love",
        note: `${person.name} found love!`,
      };
    }

    if (person.partnerName && person.childIds.length === 0 && person.ageProgress >= STAGE_THRESHOLDS.grownup) {
      person.ageProgress = 0;
      return birthNextBaby(save, person.id);
    }
  }

  if (person.lifeStage === "parent" && person.ageProgress >= STAGE_THRESHOLDS.parent) {
    person.ageProgress = 0;
    save.hearts += 12;
  }

  if (person.lifeStage === "grandparent" && person.ageProgress >= STAGE_THRESHOLDS.grandparent) {
    person.ageProgress = 0;
    save.hearts += 14;
  }

  return null;
}
