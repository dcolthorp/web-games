/**
 * Quest bookkeeping, kept away from the drawing code so the rules can be
 * tested. A quest walks unstarted -> active -> ready -> claimed, and only the
 * giver can move it the last step.
 */

export type QuestStatus = "unstarted" | "active" | "ready" | "claimed";

export type QuestDef = {
  id: string;
  /** NPC who hands it out and takes it back. */
  giver: string;
  title: string;
  /** What the giver says when you first talk to them. */
  ask: string;
  /** Nudge shown in the log while you're working on it. */
  hint: string;
  goal: number;
  /** What the goal is counted in — "patients", "seconds", "farts". */
  unit: string;
  reward: number;
  /** What the giver says when you bring it back. */
  thanks: string;
  /** What they say afterwards, forever. */
  after: string;
};

export type QuestState = { status: QuestStatus; progress: number };
export type QuestLog = Record<string, QuestState>;

export function createLog(defs: QuestDef[]): QuestLog {
  const log: QuestLog = {};
  for (const def of defs) log[def.id] = { status: "unstarted", progress: 0 };
  return log;
}

export function statusOf(log: QuestLog, id: string): QuestStatus {
  return log[id]?.status ?? "unstarted";
}

/** Hand the quest out. Talking to the giver again must not restart it. */
export function offer(log: QuestLog, id: string): boolean {
  const state = log[id];
  if (!state || state.status !== "unstarted") return false;
  state.status = "active";
  state.progress = 0;
  return true;
}

/**
 * Count something toward a quest. Only counts while it's active, so you can't
 * bank progress before you're asked or after you've been paid.
 */
export function record(log: QuestLog, def: QuestDef, amount = 1): boolean {
  const state = log[def.id];
  if (!state || state.status !== "active") return false;
  state.progress = Math.min(def.goal, state.progress + amount);
  if (state.progress >= def.goal) {
    state.status = "ready";
    return true;
  }
  return false;
}

/** For quests you can spoil — the bakery one starts over if you let one rip. */
export function resetProgress(log: QuestLog, id: string): void {
  const state = log[id];
  if (state && state.status === "active") state.progress = 0;
}

/** Turn it in. Returns the coins earned, or 0 if it wasn't ready. */
export function claim(log: QuestLog, def: QuestDef): number {
  const state = log[def.id];
  if (!state || state.status !== "ready") return 0;
  state.status = "claimed";
  return def.reward;
}

export function coinsEarned(log: QuestLog, defs: QuestDef[]): number {
  return defs.reduce((sum, def) => (statusOf(log, def.id) === "claimed" ? sum + def.reward : sum), 0);
}

export function coinsAvailable(defs: QuestDef[]): number {
  return defs.reduce((sum, def) => sum + def.reward, 0);
}

/** Everything worth showing in the log: what you're on, and what you finished. */
export function openQuests(log: QuestLog, defs: QuestDef[]): QuestDef[] {
  return defs.filter((def) => {
    const status = statusOf(log, def.id);
    return status === "active" || status === "ready";
  });
}
