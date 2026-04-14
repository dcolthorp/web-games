import { BOY_NAMES, GIRL_NAMES } from "../constants";
import type { CurrentRole, FamilySave, KidGender, Milestone, PersonState } from "../model/types";

function randomGender(): KidGender {
  return Math.random() < 0.5 ? "boy" : "girl";
}

function randomName(gender: KidGender): string {
  const pool = gender === "boy" ? BOY_NAMES : GIRL_NAMES;
  return pool[Math.floor(Math.random() * pool.length)] ?? (gender === "boy" ? "Max" : "Luna");
}

function createBaby(opts: { birthOrder: number; parentIds: string[]; gender?: KidGender; name?: string }): PersonState {
  const gender = opts.gender ?? randomGender();
  return {
    id: crypto.randomUUID(),
    name: opts.name ?? randomName(gender),
    gender,
    lifeStage: "baby",
    ageProgress: 0,
    needs: {
      food: 84,
      fun: 70,
      energy: 88,
      clean: 78,
      love: 92,
      learning: 60,
      chores: 52,
      calm: 80,
    },
    traits: ["playful", "kind"],
    mood: "yay",
    currentRole: "main-child",
    birthOrder: opts.birthOrder,
    parentIds: opts.parentIds,
    childIds: [],
    partnerName: null,
    lastUpdatedAtMs: Date.now(),
  };
}

export function renamePerson(save: FamilySave, personId: string, name: string): void {
  const person = save.people[personId];
  if (!person) {
    return;
  }

  person.name = name.trim() || person.name;
}

export function getPerson(save: FamilySave, personId: string): PersonState | null {
  return save.people[personId] ?? null;
}

export function setActivePerson(save: FamilySave, personId: string): void {
  if (!save.people[personId]) {
    return;
  }
  save.activePersonId = personId;
}

export function getFamilyMembers(save: FamilySave): PersonState[] {
  return Object.values(save.people).sort((a, b) => a.birthOrder - b.birthOrder);
}

export function birthNextBaby(save: FamilySave, parentId: string): Milestone | null {
  const parent = save.people[parentId];
  if (!parent) {
    return null;
  }

  const baby = createBaby({
    birthOrder: getFamilyMembers(save).length + 1,
    parentIds: [parent.id],
  });

  save.people[baby.id] = baby;
  save.activePersonId = baby.id;
  save.generationCount += 1;
  parent.childIds.push(baby.id);
  parent.lifeStage = "parent";
  parent.currentRole = "parent";
  parent.ageProgress = 0;

  for (const grandId of parent.parentIds) {
    const grand = save.people[grandId];
    if (!grand) {
      continue;
    }
    grand.lifeStage = "grandparent";
    grand.currentRole = "grandparent";
    grand.ageProgress = 0;
  }

  return {
    type: "new-baby",
    personId: parent.id,
    title: "Baby",
    note: "New baby!",
    newBabyId: baby.id,
  };
}

export function ensurePartner(person: PersonState): string {
  if (person.partnerName) {
    return person.partnerName;
  }

  const options = ["Ari", "Sam", "Kit", "Jules", "Pip", "Sky"];
  person.partnerName = options[Math.floor(Math.random() * options.length)] ?? "Sam";
  return person.partnerName;
}

export function getRoleTag(person: PersonState): CurrentRole {
  if (person.lifeStage === "grandparent") {
    return "grandparent";
  }
  if (person.lifeStage === "parent") {
    return "parent";
  }
  return "main-child";
}
