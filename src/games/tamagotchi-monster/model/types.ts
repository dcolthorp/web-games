export type GrowthStage =
  | "egg"
  | "baby"
  | "child"
  | "teen"
  | "monster"
  | "shadow"
  | "specter"
  | "wraith"
  | "phantom"
  | "revenant"
  | "nightmare"
  | "void_walker"
  | "abyss"
  | "eldritch"
  | "corrupted"
  | "xyy4";

export const NORMAL_STAGE_ORDER: GrowthStage[] = ["egg", "baby", "child", "teen", "monster"];

export const NU11_STAGE_ORDER: GrowthStage[] = [
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

export type PetCondition = "none" | "minor_ouchie" | "bigger_injury" | "dental_problem";

export type PlayOutcome = "success" | "minor_ouchie" | "bigger_injury" | "dental_problem";

export type ColorTheme = "blue" | "pink" | "green" | "purple" | "orange" | "black";

export type PetState = {
  stage: GrowthStage;
  hunger: number;
  dentalHealth: number;
  carePoints: number;
  hatchProgress: number;
  condition: PetCondition;
  lastUpdatedAtMs: number;
};

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
  colorTheme: ColorTheme;
  pet: PetState;
};

export type ProfileSummary = { id: string; name: string };

export type MonsterIndexData = { discoveredStages: GrowthStage[] };

