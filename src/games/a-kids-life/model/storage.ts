import { BOY_NAMES, GIRL_NAMES, SAVE_TITLES, STORAGE_KEYS, STORAGE_VERSION } from "../constants";
import type {
  CurrentRole,
  FamilySave,
  HomeStyle,
  KidGender,
  NeedKind,
  PersonState,
  SaveSummary,
  Trait,
} from "./types";

function loadJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function createNeeds(): Record<NeedKind, number> {
  return {
    food: 76,
    fun: 74,
    energy: 84,
    clean: 78,
    love: 88,
    learning: 68,
    chores: 64,
    calm: 72,
  };
}

const TRAIT_POOL: Trait[] = ["playful", "curious", "kind", "sleepy", "brave", "silly", "calm"];
const HOME_STYLES: HomeStyle[] = ["sunny", "peach", "mint"];

function pickTwoTraits(seed: number): Trait[] {
  const first = TRAIT_POOL[seed % TRAIT_POOL.length] ?? "playful";
  const second = TRAIT_POOL[(seed + 3) % TRAIT_POOL.length] ?? "kind";
  return first === second ? [first, "curious"] : [first, second];
}

function createPerson(opts: {
  name: string;
  gender: KidGender;
  lifeStage: PersonState["lifeStage"];
  birthOrder: number;
  currentRole: CurrentRole;
  parentIds?: string[];
}): PersonState {
  const seed = Math.floor(Math.random() * 1000);

  return {
    id: crypto.randomUUID(),
    name: opts.name,
    gender: opts.gender,
    lifeStage: opts.lifeStage,
    ageProgress: 0,
    needs: createNeeds(),
    traits: pickTwoTraits(seed),
    mood: "yay",
    currentRole: opts.currentRole,
    birthOrder: opts.birthOrder,
    parentIds: opts.parentIds ?? [],
    childIds: [],
    partnerName: null,
    lastUpdatedAtMs: Date.now(),
  };
}

function chooseDefaultTitle(index: number): string {
  return SAVE_TITLES[index % SAVE_TITLES.length] ?? "Happy Home";
}

export class SaveStore {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized(): void {
    const version = loadJson<number>(STORAGE_KEYS.version);
    if (version !== STORAGE_VERSION) {
      saveJson(STORAGE_KEYS.version, STORAGE_VERSION);
    }

    if (!loadJson<SaveSummary[]>(STORAGE_KEYS.saves)) {
      saveJson(STORAGE_KEYS.saves, []);
    }
  }

  listSummaries(): SaveSummary[] {
    return loadJson<SaveSummary[]>(STORAGE_KEYS.saves) ?? [];
  }

  loadSave(id: string): FamilySave | null {
    const save = loadJson<FamilySave>(STORAGE_KEYS.save(id));
    if (!save) {
      return null;
    }

    save.lastPlayedAt ||= nowIso();
    return save;
  }

  save(save: FamilySave): void {
    save.lastPlayedAt = nowIso();
    saveJson(STORAGE_KEYS.save(save.id), save);

    const summaries = this.listSummaries();
    const nextSummary = this.getSummary(save);
    const existingIndex = summaries.findIndex((item) => item.id === save.id);
    if (existingIndex >= 0) {
      summaries[existingIndex] = nextSummary;
    } else {
      summaries.push(nextSummary);
    }
    saveJson(STORAGE_KEYS.saves, summaries);
  }

  createSave(opts: { title?: string; babyName: string; gender: KidGender }): FamilySave {
    const summaries = this.listSummaries();
    const root = createPerson({
      name: opts.babyName,
      gender: opts.gender,
      lifeStage: "baby",
      birthOrder: 1,
      currentRole: "main-child",
    });

    const save: FamilySave = {
      id: crypto.randomUUID(),
      title: opts.title?.trim() || chooseDefaultTitle(summaries.length),
      createdAt: nowIso(),
      activePersonId: root.id,
      rootPersonId: root.id,
      people: {
        [root.id]: root,
      },
      generationCount: 1,
      hearts: 0,
      homeStyle: HOME_STYLES[summaries.length % HOME_STYLES.length] ?? "sunny",
      lastPlayedAt: nowIso(),
    };

    this.save(save);
    return save;
  }

  renameSave(id: string, title: string): void {
    const save = this.loadSave(id);
    if (!save) {
      return;
    }

    save.title = title.trim() || save.title;
    this.save(save);
  }

  deleteSave(id: string): void {
    localStorage.removeItem(STORAGE_KEYS.save(id));
    const summaries = this.listSummaries().filter((item) => item.id !== id);
    saveJson(STORAGE_KEYS.saves, summaries);
  }

  randomBabyName(gender: KidGender): string {
    const pool = gender === "boy" ? BOY_NAMES : GIRL_NAMES;
    return pool[Math.floor(Math.random() * pool.length)] ?? (gender === "boy" ? "Max" : "Luna");
  }

  private getSummary(save: FamilySave): SaveSummary {
    const active = save.people[save.activePersonId];
    return {
      id: save.id,
      title: save.title,
      activeChildName: active?.name ?? "Kid",
      currentGeneration: save.generationCount,
      lastPlayedAt: save.lastPlayedAt,
    };
  }
}
