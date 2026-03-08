import { STORAGE_KEYS } from "../constants";
import type { GrowthStage, MonsterIndexData } from "./types";
import { NORMAL_STAGE_ORDER, NU11_STAGE_ORDER } from "./types";

function loadIndex(): MonsterIndexData {
  const raw = localStorage.getItem(STORAGE_KEYS.monsterIndex);
  if (!raw) return { discoveredStages: [] };
  try {
    const parsed = JSON.parse(raw) as MonsterIndexData;
    if (!parsed || !Array.isArray(parsed.discoveredStages)) return { discoveredStages: [] };
    return { discoveredStages: parsed.discoveredStages };
  } catch {
    return { discoveredStages: [] };
  }
}

function saveIndex(data: MonsterIndexData): void {
  localStorage.setItem(STORAGE_KEYS.monsterIndex, JSON.stringify(data));
}

export type MonsterIndexEntry = {
  stage: GrowthStage;
  discovered: boolean;
};

export class MonsterIndexStore {
  discover(stage: GrowthStage): boolean {
    const data = loadIndex();
    if (data.discoveredStages.includes(stage)) return false;
    data.discoveredStages.push(stage);
    saveIndex(data);
    return true;
  }

  isDiscovered(stage: GrowthStage): boolean {
    return loadIndex().discoveredStages.includes(stage);
  }

  getAllStagesOrdered(): GrowthStage[] {
    const stages: GrowthStage[] = [...NORMAL_STAGE_ORDER];
    for (const stage of NU11_STAGE_ORDER) {
      if (!stages.includes(stage)) stages.push(stage);
    }
    return stages;
  }

  getEntries(): MonsterIndexEntry[] {
    const data = loadIndex();
    return this.getAllStagesOrdered().map((stage) => ({
      stage,
      discovered: data.discoveredStages.includes(stage),
    }));
  }

  isAllDiscovered(): boolean {
    const entries = this.getEntries();
    return entries.length > 0 && entries.every((e) => e.discovered);
  }
}

