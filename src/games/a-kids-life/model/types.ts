export type LifeStage = "baby" | "toddler" | "kid" | "teen" | "grownup" | "parent" | "grandparent";

export type KidGender = "boy" | "girl";

export type NeedKind = "food" | "fun" | "energy" | "clean" | "love" | "learning" | "chores" | "calm";

export type ActivityId =
  | "bottle"
  | "nap"
  | "bath"
  | "peek"
  | "rock"
  | "cuddle"
  | "snack"
  | "blocks"
  | "dance"
  | "story"
  | "wash"
  | "walk"
  | "breakfast"
  | "dress"
  | "school"
  | "playground"
  | "art"
  | "clean-room"
  | "lunch"
  | "homework"
  | "music"
  | "sport"
  | "hobby"
  | "help-home"
  | "chill"
  | "work"
  | "cook"
  | "shop"
  | "care"
  | "home"
  | "family-fun"
  | "rest"
  | "garden"
  | "bake"
  | "story-time"
  | "craft"
  | "bird-walk"
  | "baby-sit"
  | "relax";

export type Trait = "playful" | "curious" | "kind" | "sleepy" | "brave" | "silly" | "calm";

export type Mood = "yay" | "okay" | "sad";

export type CurrentRole = "main-child" | "parent" | "grandparent";

export type HomeStyle = "sunny" | "peach" | "mint";

export interface PersonState {
  id: string;
  name: string;
  gender: KidGender;
  lifeStage: LifeStage;
  ageProgress: number;
  needs: Record<NeedKind, number>;
  traits: Trait[];
  mood: Mood;
  currentRole: CurrentRole;
  birthOrder: number;
  parentIds: string[];
  childIds: string[];
  partnerName: string | null;
  lastUpdatedAtMs: number;
}

export interface FamilySave {
  id: string;
  title: string;
  createdAt: string;
  activePersonId: string;
  rootPersonId: string;
  people: Record<string, PersonState>;
  generationCount: number;
  hearts: number;
  homeStyle: HomeStyle;
  lastPlayedAt: string;
}

export interface SaveSummary {
  id: string;
  title: string;
  activeChildName: string;
  currentGeneration: number;
  lastPlayedAt: string;
}

export type MiniGameType = "tap-fill" | "hold-fill" | "drag-track" | "timing" | "pick-three" | "collect";

export interface ActivityConfig {
  id: ActivityId;
  label: string;
  icon: string;
  stages: LifeStage[];
  needFocus: NeedKind;
  boosts: Partial<Record<NeedKind, number>>;
  starReward: number;
  heartReward: number;
  miniGame: MiniGameType;
  roomHint: string;
  accent: string;
}

export interface Milestone {
  type: "stage-up" | "partner" | "new-baby";
  personId: string;
  title: string;
  note: string;
  newStage?: LifeStage;
  newBabyId?: string;
}
