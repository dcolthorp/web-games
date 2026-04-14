import type { FamilySave, LifeStage, Mood, NeedKind, PersonState } from "../model/types";

const ACTIVE_NEEDS: Record<LifeStage, NeedKind[]> = {
  baby: ["food", "energy", "clean", "love"],
  toddler: ["food", "fun", "clean", "energy"],
  kid: ["food", "fun", "learning", "love"],
  teen: ["food", "fun", "calm", "learning"],
  grownup: ["food", "chores", "calm", "love"],
  parent: ["food", "chores", "energy", "love"],
  grandparent: ["food", "calm", "fun", "love"],
};

const NEED_DECAY: Record<LifeStage, Partial<Record<NeedKind, number>>> = {
  baby: { food: 0.9, energy: 0.8, clean: 0.75, love: 0.45 },
  toddler: { food: 0.8, fun: 0.65, clean: 0.55, energy: 0.55 },
  kid: { food: 0.7, fun: 0.65, learning: 0.45, love: 0.3 },
  teen: { food: 0.6, fun: 0.55, calm: 0.42, learning: 0.32 },
  grownup: { food: 0.55, chores: 0.4, calm: 0.3, love: 0.2 },
  parent: { food: 0.6, chores: 0.55, energy: 0.5, love: 0.25 },
  grandparent: { food: 0.48, calm: 0.25, fun: 0.2, love: 0.18 },
};

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function getVisibleNeeds(stage: LifeStage): NeedKind[] {
  return ACTIVE_NEEDS[stage];
}

export function updateMood(person: PersonState): Mood {
  const visible = getVisibleNeeds(person.lifeStage);
  const lowest = Math.min(...visible.map((key) => person.needs[key]));
  if (lowest < 34) {
    return "sad";
  }
  if (lowest < 62) {
    return "okay";
  }
  return "yay";
}

export function applyNeedBoosts(person: PersonState, boosts: Partial<Record<NeedKind, number>>): void {
  const keys = Object.keys(boosts) as NeedKind[];
  for (const key of keys) {
    const amount = boosts[key];
    if (typeof amount !== "number") {
      continue;
    }
    person.needs[key] = clampNeed(person.needs[key] + amount);
  }
  person.mood = updateMood(person);
  person.lastUpdatedAtMs = Date.now();
}

export function applyNeedDecay(person: PersonState, elapsedSeconds: number): void {
  const rates = NEED_DECAY[person.lifeStage];
  const keys = Object.keys(rates) as NeedKind[];
  for (const key of keys) {
    const rate = rates[key];
    if (typeof rate !== "number") {
      continue;
    }
    person.needs[key] = clampNeed(person.needs[key] - rate * elapsedSeconds);
  }

  person.mood = updateMood(person);
  person.lastUpdatedAtMs += elapsedSeconds * 1000;
}

export function applyOfflineCatchup(save: FamilySave): void {
  const now = Date.now();
  const maxMs = 1000 * 60 * 60 * 6;
  for (const person of Object.values(save.people)) {
    const elapsedMs = Math.max(0, Math.min(maxMs, now - person.lastUpdatedAtMs));
    applyNeedDecay(person, elapsedMs / 1000);
    person.lastUpdatedAtMs = now;
  }
}

export function getLowestNeed(person: PersonState): NeedKind {
  const visible = getVisibleNeeds(person.lifeStage);
  return visible.reduce((lowest, key) => {
    return person.needs[key] < person.needs[lowest] ? key : lowest;
  }, visible[0] ?? "food");
}
