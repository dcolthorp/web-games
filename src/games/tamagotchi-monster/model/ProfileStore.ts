import { STORAGE_KEYS, STORAGE_VERSION } from "../constants";
import { NORMAL_STAGE_ORDER, type ColorTheme, type Profile, type ProfileSummary } from "./types";

export const CURS3D_PROFILE_NAME = "CURS3D";
export const LESCHAT_PROFILE_NAME = "LESCHAT";

function nowMs(): number {
  return Date.now();
}

function loadJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getThemeForName(upperName: string): ColorTheme {
  if (upperName === "OSCAR") return "blue";
  if (upperName === "PENELOPE") return "pink";
  if (upperName === "NU11") return "black";
  if (upperName === "MILLIONAIRE") return "green";
  return "blue";
}

export class ProfileStore {
  constructor() {
    this.ensureInitialized();
  }

  ensureInitialized(): void {
    const version = loadJson<number>(STORAGE_KEYS.version);
    if (version !== STORAGE_VERSION) {
      saveJson(STORAGE_KEYS.version, STORAGE_VERSION);
      if (!loadJson<ProfileSummary[]>(STORAGE_KEYS.profilesIndex)) {
        saveJson(STORAGE_KEYS.profilesIndex, []);
      }
    }
    this.ensurePresetProfiles();
  }

  listProfiles(): ProfileSummary[] {
    return loadJson<ProfileSummary[]>(STORAGE_KEYS.profilesIndex) ?? [];
  }

  loadProfile(id: string): Profile | null {
    const profile = loadJson<Profile>(STORAGE_KEYS.profile(id));
    if (!profile) return null;
    const upperName = profile.name?.toUpperCase?.() ?? "";
    if (!profile.colorTheme) {
      profile.colorTheme = getThemeForName(upperName);
    }
    if (profile.colorTheme === "green" && !NORMAL_STAGE_ORDER.includes(profile.pet.stage)) {
      profile.pet.stage = "monster";
    }
    if (!profile.pet.lastUpdatedAtMs) {
      profile.pet.lastUpdatedAtMs = nowMs();
    }
    return profile;
  }

  saveProfile(profile: Profile): void {
    saveJson(STORAGE_KEYS.profile(profile.id), profile);
    const index = this.listProfiles();
    const existingIdx = index.findIndex((p) => p.id === profile.id);
    const summary = { id: profile.id, name: profile.name };
    if (existingIdx >= 0) {
      index[existingIdx] = summary;
    } else {
      index.push(summary);
    }
    saveJson(STORAGE_KEYS.profilesIndex, index);
  }

  createProfile(name: string, theme?: ColorTheme): Profile {
    const upperName = name.trim().toUpperCase();
    if (!upperName) throw new Error("Profile name required");

    const index = this.listProfiles();
    const exists = index.some((p) => p.name.toUpperCase() === upperName);
    if (exists) throw new Error(`Profile '${upperName}' already exists`);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const colorTheme = theme ?? getThemeForName(upperName);
    const profile: Profile = {
      id,
      name: upperName,
      createdAt,
      colorTheme,
      pet: {
        stage: "egg",
        hunger: 50,
        dentalHealth: 100,
        carePoints: 0,
        hatchProgress: 0,
        condition: "none",
        lastUpdatedAtMs: nowMs(),
      },
    };
    this.saveProfile(profile);
    return profile;
  }

  deleteProfilesByName(name: string): number {
    const upperName = name.trim().toUpperCase();
    if (!upperName) return 0;
    const matches = this.listProfiles().filter((p) => p.name.toUpperCase() === upperName);
    matches.forEach((summary) => this.deleteProfile(summary.id));
    return matches.length;
  }

  isLeschatAwakened(): boolean {
    return loadJson<boolean>(STORAGE_KEYS.leschatAwakened) === true;
  }

  awakenLeschat(): void {
    saveJson(STORAGE_KEYS.leschatAwakened, true);
  }

  deleteProfile(id: string): void {
    localStorage.removeItem(STORAGE_KEYS.profile(id));
    const index = this.listProfiles().filter((p) => p.id !== id);
    saveJson(STORAGE_KEYS.profilesIndex, index);
  }

  ensurePresetProfiles(): void {
    const existing = this.listProfiles();
    const hasOscar = existing.some((p) => p.name.toUpperCase() === "OSCAR");
    const hasPenelope = existing.some((p) => p.name.toUpperCase() === "PENELOPE");
    if (!hasOscar) this.createProfile("OSCAR");
    if (!hasPenelope) this.createProfile("PENELOPE");
  }
}
