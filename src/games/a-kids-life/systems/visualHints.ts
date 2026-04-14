import type { ActivityConfig, NeedKind, PersonState } from "../model/types";
import { getActivitiesForStage } from "./activities";
import { getLowestNeed, getVisibleNeeds } from "./needs";

const NEED_ICONS: Record<NeedKind, string> = {
  food: "🍎",
  fun: "🎈",
  energy: "⭐",
  clean: "🫧",
  love: "💗",
  learning: "📘",
  chores: "🏡",
  calm: "☁️",
};

export function getNeedIcon(need: NeedKind): string {
  return NEED_ICONS[need];
}

export function getMoodBubble(person: PersonState): string {
  const lowest = getLowestNeed(person);
  if (person.mood === "sad") {
    return NEED_ICONS[lowest];
  }
  if (person.mood === "okay") {
    return "…";
  }
  return "✨";
}

export function getRecommendedActivities(person: PersonState): ActivityConfig[] {
  const activities = getActivitiesForStage(person.lifeStage);
  const visibleNeeds = getVisibleNeeds(person.lifeStage);
  const rankedNeeds = [...visibleNeeds].sort((a, b) => person.needs[a] - person.needs[b]);

  const picks: ActivityConfig[] = [];
  for (const need of rankedNeeds) {
    const found = activities.find((activity) => activity.needFocus === need && !picks.some((item) => item.id === activity.id));
    if (found) {
      picks.push(found);
    }
    if (picks.length === 3) {
      return picks;
    }
  }

  for (const activity of activities) {
    if (!picks.some((item) => item.id === activity.id)) {
      picks.push(activity);
    }
    if (picks.length === 3) {
      break;
    }
  }

  return picks;
}
