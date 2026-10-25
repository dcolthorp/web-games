import { boing, chime, whoosh } from "../../shared/sfx";
import { ollySvg } from "./olly";
import { startMatrix } from "./matrix";
import { addWorldGems, startWorld, worldFighter, worldHasVaultKey, worldOllyLook } from "./world";

// Our own Fact Quest, rebuilt to work like the one Dad made: pick Oscar or
// Penelope, do a ten-minute daily quest with Olly the cat, and watch the facts
// go from Untested to Practicing to Fluent. Division also has a remainder box,
// and some division questions really do have a remainder. Progress is saved in
// this browser.

type LearnerId = "oscar" | "penelope";
type Op = "mul" | "div" | "add" | "sub";
type Mode = Op | "mix";
type Status = "untested" | "practicing" | "fluent";
type Feel = "easy" | "effortful" | null;

interface Fact {
  id: string;
  op: Op;
  a: number;
  b: number;
  answer: number;
  label: string;
}

interface FactRecord {
  attempts: number;
  correct: number;
  lastCorrect: boolean;
  // The days this fact was answered right and felt easy. Two different days
  // makes it fluent.
  easyDays: string[];
}

interface LearnerSave {
  facts: Record<string, FactRecord>;
  day: string;
  todayMs: number;
  xp: number;
  missions: number;
  // Best scores for Speed Round, Survival, Boss Rush and Endless runs.
  best?: Partial<Record<GameMode, number>>;
}

interface Question {
  fact: Fact;
  // Division with a remainder shows a bigger number than the fact itself.
  shownA: number;
  remainder: number;
  boss: boolean;
}

const LEARNERS: Record<LearnerId, { name: string; ops: Op[]; topic: string; range: string; go: string; tagline: string; footer: string }> = {
  oscar: {
    name: "Oscar",
    ops: ["mul", "div"],
    topic: "Multiplication & division",
    range: "Facts 1–12",
    go: "Let’s cook →",
    tagline: "Multiply. Divide. Level up.",
    footer: "1–12 · MULTIPLICATION & DIVISION",
  },
  penelope: {
    name: "Penelope",
    ops: ["add", "sub"],
    topic: "Addition & subtraction",
    range: "Numbers within 10",
    go: "Let’s explore →",
    tagline: "Add. Subtract. Level up.",
    footer: "WITHIN 10 · ADDITION & SUBTRACTION",
  },
};

const OP_NAMES: Record<Op, { verb: string; noun: string; sign: string }> = {
  mul: { verb: "Multiply", noun: "Multiplication", sign: "×" },
  div: { verb: "Divide", noun: "Division", sign: "÷" },
  add: { verb: "Add", noun: "Addition", sign: "+" },
  sub: { verb: "Subtract", noun: "Subtraction", sign: "−" },
};

const QUEST_MS = 10 * 60 * 1000;

const SPEED_MS = 60 * 1000;
const SURVIVAL_HEARTS = 3;
const BOSS_RUSH_BOSSES = 10;

type GameMode = "daily" | "endless" | "speed" | "survival" | "remainder" | "boss" | "quest";

// Set once the four math tiles have crashed into Olly. Stays unlocked for
// both explorers, and Olly stays blue on the home screen.
const QUEST_UNLOCKED_KEY = "fact-quest-6-quest-mode";

const GAME_MODES: { id: GameMode; name: string; icon: string; blurb: string; oscarOnly?: true; secret?: true }[] = [
  { id: "quest", name: "Quest Mode", icon: "⚔️", blurb: "A big world: find treasure, trade, feed pigs, fight castle enemies.", secret: true },
  { id: "daily", name: "Daily Quest", icon: "🗺️", blurb: "Ten minutes, then a final boss." },
  { id: "endless", name: "Endless", icon: "♾️", blurb: "Keep going forever. Every 10 minutes counts as a run." },
  { id: "speed", name: "Speed Round", icon: "⚡", blurb: "60 seconds. Answer as many as you can." },
  { id: "survival", name: "Survival", icon: "❤️", blurb: "3 hearts. Every wrong answer costs one." },
  { id: "remainder", name: "Remainder Rumble", icon: "🧮", blurb: "Every division question has a remainder.", oscarOnly: true },
  { id: "boss", name: "Boss Rush", icon: "👾", blurb: "10 bosses in a row. Only your trickiest facts." },
];

// Badges along the bottom of the home screen: how many missions each takes.
const MILESTONES: [number, string][] = [
  [1, "First quest"],
  [3, "Finding your flow"],
  [10, "Fact explorer"],
];
const SAVE_KEY = "fact-quest-6";
const LEARNER_KEY = "fact-quest-6-learner";
const MUTED_KEY = "fact-quest-6-muted";

// Where Oscar was in Dad's Fact Quest on 2026-10-23, so this one doesn't start
// him from zero: for each times table, the facts he was already practicing.
const OSCAR_STARTING_PRACTICE: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  2: [1, 2, 3, 4, 5, 6, 7, 8],
  3: [1, 2, 3, 4, 5, 6, 7, 9],
  4: [1, 2, 3, 4, 5, 6, 7, 9],
  5: [1, 2, 3, 4, 5, 7],
  6: [1, 2, 3, 4, 6, 7, 8],
  7: [1, 2, 8, 9],
  8: [1, 6, 7, 9],
  9: [5, 6, 7],
  12: [9],
};

const OLLY = ollySvg();

// ---------------------------------------------------------------------------
// Facts

function buildFacts(op: Op): Fact[] {
  const facts: Fact[] = [];
  if (op === "mul") {
    for (let a = 1; a <= 12; a += 1) {
      for (let b = 1; b <= 12; b += 1) {
        facts.push({ id: `mul-${a}-${b}`, op, a, b, answer: a * b, label: `${a} × ${b}` });
      }
    }
  } else if (op === "div") {
    // One row for each number you divide by.
    for (let b = 1; b <= 12; b += 1) {
      for (let q = 1; q <= 12; q += 1) {
        const a = b * q;
        facts.push({ id: `div-${a}-${b}`, op, a, b, answer: q, label: `${a} ÷ ${b}` });
      }
    }
  } else if (op === "add") {
    for (let a = 0; a <= 10; a += 1) {
      for (let b = 0; a + b <= 10; b += 1) {
        facts.push({ id: `add-${a}-${b}`, op, a, b, answer: a + b, label: `${a} + ${b}` });
      }
    }
  } else {
    for (let a = 0; a <= 10; a += 1) {
      for (let b = 0; b <= a; b += 1) {
        facts.push({ id: `sub-${a}-${b}`, op, a, b, answer: a - b, label: `${a} − ${b}` });
      }
    }
  }
  return facts;
}

const FACTS: Record<Op, Fact[]> = {
  mul: buildFacts("mul"),
  div: buildFacts("div"),
  add: buildFacts("add"),
  sub: buildFacts("sub"),
};

function statusOf(record: FactRecord | undefined): Status {
  if (!record || record.attempts === 0) return "untested";
  if (record.lastCorrect && new Set(record.easyDays).size >= 2) return "fluent";
  return "practicing";
}

const STATUS_NAMES: Record<Status, string> = {
  untested: "Untested",
  practicing: "Practicing",
  fluent: "Fluent",
};

// ---------------------------------------------------------------------------
// Saving

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function emptySave(): LearnerSave {
  return { facts: {}, day: today(), todayMs: 0, xp: 0, missions: 0 };
}

function loadAll(): Partial<Record<LearnerId, LearnerSave>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const saves = loadAll();

function saveFor(learner: LearnerId): LearnerSave {
  let save = saves[learner];
  if (!save) {
    save = emptySave();
    if (learner === "oscar") {
      for (const [table, others] of Object.entries(OSCAR_STARTING_PRACTICE)) {
        for (const other of others) {
          save.facts[`mul-${table}-${other}`] = { attempts: 1, correct: 1, lastCorrect: true, easyDays: [] };
        }
      }
    }
    saves[learner] = save;
  }
  if (save.day !== today()) {
    save.day = today();
    save.todayMs = 0;
  }
  return save;
}

function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  } catch {
    // Nowhere to save; the quest still works, it just won't remember.
  }
}

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Same as above.
  }
}

// ---------------------------------------------------------------------------
// State

type Screen = "pick" | "home" | "quest" | "world" | "matrix" | "complete" | "progress";

const storedLearner = readSetting(LEARNER_KEY);
let learner: LearnerId | null = storedLearner === "oscar" || storedLearner === "penelope" ? storedLearner : null;
let screen: Screen = learner ? "home" : "pick";
let mode: Mode = "mix";
let progressOp: Op = "mul";
let muted = readSetting(MUTED_KEY) === "1";

// The quest in progress.
let question: Question | null = null;
let questionNumber = 0;
let questActiveMs = 0;
let questCorrect = 0;
let questAnswered = 0;
let questXp = 0;
let recent: string[] = [];
let feel: Feel = null;
let checked: { correct: boolean; gaveUp: boolean } | null = null;
let hintText = "";
let warning = "";
let lastTick = 0;
let timer = 0;
// Whose quest was paused, so it can be picked back up from the home screen.
let paused: LearnerId | null = null;
let resumeNote = "";
let gameMode: GameMode = "daily";
let hearts = SURVIVAL_HEARTS;
// Endless: how many 10-minute runs are done so far this time.
let runsDone = 0;
let runToast = "";
let newBest = false;
// Speed Round moves on by itself after showing the answer.
let autoNext = 0;
// Quest Mode's world (or the Matrix), while it's on screen: calling this stops
// and saves it.
let stopWorld: (() => void) | null = null;
// Olly just came back out of the Matrix: through its portal home, or blasted
// out by the vault's beam of light.
let backFromMatrix = false;
let beamedOut = false;
let questUnlocked = readSetting(QUEST_UNLOCKED_KEY) === "1";
// The tiles are busy spinning into Olly.
let orbiting = false;
let justUnlocked = false;

const top = document.getElementById("top")!;
const app = document.getElementById("app")!;
const footMode = document.getElementById("foot-mode")!;

function sound(play: () => void): void {
  if (!muted) play();
}

// ---------------------------------------------------------------------------
// Picking questions

function pickFact(boss: boolean): Fact {
  const save = saveFor(learner!);
  const ops: Op[] = gameMode === "remainder" ? ["div"] : mode === "mix" ? LEARNERS[learner!].ops : [mode];
  const pool = ops
    .flatMap((op) => FACTS[op])
    // Dividing by 1 never leaves a remainder.
    .filter((fact) => !(gameMode === "remainder" && fact.b === 1))
    .filter((fact) => !recent.includes(fact.id));

  // The final boss is the trickiest fact being practiced.
  if (boss) {
    const tricky = pool
      .filter((fact) => statusOf(save.facts[fact.id]) === "practicing")
      .sort((x, y) => {
        const rx = save.facts[x.id]!;
        const ry = save.facts[y.id]!;
        return rx.correct / rx.attempts - ry.correct / ry.attempts || x.answer - y.answer;
      });
    if (tricky.length > 0) return tricky[Math.floor(Math.random() * Math.min(5, tricky.length))]!;
  }

  // Tricky facts come back sooner. Familiar ones get room to breathe.
  const weights = pool.map((fact) => {
    const record = save.facts[fact.id];
    const status = statusOf(record);
    if (status === "fluent") return 1;
    if (status === "untested") return 3;
    return record!.lastCorrect ? 4 : 7;
  });
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index]!;
    if (roll <= 0) return pool[index]!;
  }
  return pool[pool.length - 1]!;
}

function nextQuestion(boss: boolean): void {
  const fact = pickFact(boss);
  recent = [fact.id, ...recent].slice(0, 6);
  // About a third of division questions have something left over, and in
  // Remainder Rumble they all do.
  const withRemainder = fact.op === "div" && fact.b > 1 && (gameMode === "remainder" || Math.random() < 0.35);
  const remainder = withRemainder ? 1 + Math.floor(Math.random() * (fact.b - 1)) : 0;
  question = { fact, shownA: fact.a + remainder, remainder, boss };
  questionNumber += 1;
  runToast = "";
  feel = null;
  checked = null;
  hintText = "";
  warning = "";
}

function hintFor(q: Question): string {
  const { fact } = q;
  if (fact.op === "mul") {
    const steps = Array.from({ length: Math.min(fact.b, 3) }, (_, index) => fact.a * (index + 1));
    return `Count by ${fact.a}s, ${fact.b} times: ${steps.join(", ")}${fact.b > 3 ? ", …" : ""}`;
  }
  if (fact.op === "div") {
    return q.remainder
      ? `${fact.b} times what gets closest to ${q.shownA} without going over? Whatever is left is the remainder.`
      : `${fact.b} times what makes ${q.shownA}?`;
  }
  if (fact.op === "add") return `Start at ${Math.max(fact.a, fact.b)} and count up ${Math.min(fact.a, fact.b)}.`;
  return `Start at ${fact.a} and count back ${fact.b}.`;
}

function record(correct: boolean, easy: boolean): void {
  const save = saveFor(learner!);
  const fact = question!.fact;
  const rec = save.facts[fact.id] ?? { attempts: 0, correct: 0, lastCorrect: false, easyDays: [] };
  rec.attempts += 1;
  rec.lastCorrect = correct;
  if (correct) {
    rec.correct += 1;
    if (easy && !rec.easyDays.includes(today())) rec.easyDays = [...rec.easyDays, today()].slice(-5);
  }
  save.facts[fact.id] = rec;
  persist();
}

// ---------------------------------------------------------------------------
// Timer: only counts while the quest is on screen and the tab is visible.

function startTimer(): void {
  stopTimer();
  lastTick = performance.now();
  timer = window.setInterval(tick, 250);
}

function stopTimer(): void {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
  tick();
}

function tick(): void {
  const now = performance.now();
  const delta = document.hidden ? 0 : Math.min(now - lastTick, 1000);
  lastTick = now;
  questActiveMs += delta;
  if (learner) {
    saveFor(learner).todayMs += delta;
  }

  // Endless: every 10 minutes is another run done.
  if (gameMode === "endless" && learner && Math.floor(questActiveMs / QUEST_MS) > runsDone) {
    runsDone += 1;
    saveFor(learner).missions += 1;
    runToast = `Run ${runsDone} complete! Keep going!`;
    sound(chime);
    persist();
    const toast = document.getElementById("run-toast");
    if (toast) {
      toast.textContent = runToast;
      toast.hidden = false;
    }
  }

  const clock = document.getElementById("clock");
  if (clock) clock.textContent = clockLabel();
  const bar = document.getElementById("quest-bar");
  if (bar) bar.style.width = `${barPercent()}%`;

  // Speed Round is over when the minute runs out. (Only while the clock is
  // really running, not when a pause adds up the last bit of time.)
  if (gameMode === "speed" && timer && screen === "quest" && questActiveMs >= SPEED_MS) finishQuest();
}

function clockLabel(): string {
  if (gameMode === "speed") return `${clockText(Math.max(0, SPEED_MS - questActiveMs + 999))} left`;
  if (gameMode === "endless" || gameMode === "survival") return clockText(questActiveMs);
  return `${clockText(questActiveMs)} / 10:00`;
}

function barPercent(): number {
  if (gameMode === "speed") return Math.min(100, (questActiveMs / SPEED_MS) * 100);
  if (gameMode === "endless") return ((questActiveMs % QUEST_MS) / QUEST_MS) * 100;
  if (gameMode === "survival") return (hearts / SURVIVAL_HEARTS) * 100;
  if (gameMode === "boss") return ((questionNumber - 1) / BOSS_RUSH_BOSSES) * 100;
  return Math.min(100, (questActiveMs / QUEST_MS) * 100);
}

document.addEventListener("visibilitychange", () => {
  lastTick = performance.now();
  persist();
});

function clockText(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Drawing

function go(next: Screen): void {
  if ((screen === "world" || screen === "matrix") && next !== screen) {
    stopWorld?.();
    stopWorld = null;
  }
  if ((screen === "quest" || screen === "world") && next !== screen) {
    stopTimer();
    persist();
  }
  screen = next;
  render();
}

function render(): void {
  renderTop();
  footMode.textContent = learner ? LEARNERS[learner].footer : "";
  if (screen === "pick" || !learner) renderPick();
  else if (screen === "home") renderHome();
  else if (screen === "quest") renderQuest();
  else if (screen === "world") renderWorld();
  else if (screen === "matrix") renderMatrix();
  else if (screen === "complete") renderComplete();
  else renderProgress();
}

function renderTop(): void {
  const who = learner ? LEARNERS[learner] : null;
  top.innerHTML = `
    <button class="brand" type="button" data-go="${who ? "home" : "pick"}" aria-label="Fact Quest home">
      <span class="brand-icon">×</span>FACTQUEST
    </button>
    ${
      who
        ? `<nav class="nav">
            <button type="button" data-go="home" class="${screen === "progress" ? "" : "is-on"}">⚡ Play</button>
            <button type="button" data-go="progress" class="${screen === "progress" ? "is-on" : ""}">📊 Progress</button>
          </nav>
          <div class="who">
            <button class="switch" type="button" data-switch>Switch explorer</button>
            <span class="avatar">${who.name[0]}</span>
            <span class="who-name">${who.name}<small>MATH EXPLORER</small></span>
            <button class="mute" type="button" data-mute aria-label="${muted ? "Enable sounds" : "Mute sounds"}">${muted ? "🔇" : "🔊"}</button>
          </div>`
        : ""
    }
  `;
  for (const button of top.querySelectorAll<HTMLButtonElement>("[data-go]")) {
    button.addEventListener("click", () => go(button.dataset["go"] as Screen));
  }
  top.querySelector("[data-switch]")?.addEventListener("click", () => {
    learner = null;
    writeSetting(LEARNER_KEY, null);
    go("pick");
  });
  top.querySelector("[data-mute]")?.addEventListener("click", () => {
    muted = !muted;
    writeSetting(MUTED_KEY, muted ? "1" : null);
    renderTop();
  });
}

function renderPick(): void {
  app.innerHTML = `
    <section class="pick">
      <p class="eyebrow">Fact Quest · Family Math Arcade</p>
      <h1>Who’s practicing?</h1>
      <p>Pick your explorer. Your progress stays yours.</p>
      <div class="learner-choices">
        ${(Object.keys(LEARNERS) as LearnerId[])
          .map((id) => {
            const who = LEARNERS[id];
            return `
              <button type="button" data-learner="${id}">
                <span class="learner-avatar">${who.name[0]}</span>
                <strong>${who.name}</strong>
                <span>${who.topic}</span>
                <span>${who.range}</span>
                <em>${who.go}</em>
              </button>`;
          })
          .join("")}
      </div>
      <p class="small-note">Ten-minute adventures. No sign-in needed.</p>
    </section>
  `;
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-learner]")) {
    button.addEventListener("click", () => {
      learner = button.dataset["learner"] as LearnerId;
      writeSetting(LEARNER_KEY, learner);
      mode = "mix";
      progressOp = LEARNERS[learner].ops[0]!;
      go("home");
    });
  }
}

function fluentCount(): { fluent: number; total: number } {
  const save = saveFor(learner!);
  const facts = LEARNERS[learner!].ops.flatMap((op) => FACTS[op]);
  return { fluent: facts.filter((fact) => statusOf(save.facts[fact.id]) === "fluent").length, total: facts.length };
}

function renderHome(): void {
  const who = LEARNERS[learner!];
  const save = saveFor(learner!);
  const { fluent, total } = fluentCount();
  const done = save.todayMs >= QUEST_MS;
  const modes: Mode[] = ["mix", ...who.ops];
  const [firstOp, secondOp] = who.ops as [Op, Op];
  const modeLabel = (m: Mode): string =>
    m === "mix"
      ? `<span class="op">${OP_NAMES[firstOp].sign}</span> and <span class="op">${OP_NAMES[secondOp].sign}</span> Mix it up`
      : `<span class="op">${OP_NAMES[m].sign}</span> ${OP_NAMES[m].verb}`;
  app.innerHTML = `
    <section class="home-hero">
      <div>
        <p class="eyebrow dot">Your daily dose of big brain energy</p>
        <h1>Small missions.<br /><span>Big brain moves.</span> <span class="sparkle" aria-hidden="true">✳</span></h1>
        <p class="lead">${who.tagline}<br />Ten minutes of practice. One daily adventure.</p>
        <p class="checks"><span>✓ Made for your brain</span><span>✓ Go at your pace</span></p>
      </div>
      <figure class="olly-stage">
        <span class="bubble">${justUnlocked ? "⚔️ Quest Mode unlocked!" : `Ready to cook, ${who.name}?`}</span>
        <button type="button" class="tile tile-a" aria-label="Plus">+</button>
        <button type="button" class="tile tile-b" aria-label="Divide">÷</button>
        <button type="button" class="tile tile-c" aria-label="Times">×</button>
        <button type="button" class="tile tile-d" aria-label="Minus">−</button>
        <div class="olly-ring">${ollySvg(questUnlocked ? "blue" : "normal")}</div>
        <figcaption>Olly · Your quest companion</figcaption>
      </figure>
    </section>

    <section class="dashboard">
      <div class="main-column">
        <div class="quest-card">
          <div class="quest-card-top">
            <span class="pill">Today’s main quest</span>
            <span class="count">${String(save.missions + 1).padStart(2, "0")} / ∞</span>
          </div>
          <h2>${done ? "Daily goal complete!" : "Let’s get those facts."}</h2>
          <p>${done ? "Extra practice still makes your brain stronger." : "A little review. A little discovery. A whole lot of W."}</p>
          <div class="mode-buttons" role="group" aria-label="What to practice">
            ${modes
              .map(
                (m) =>
                  `<button type="button" data-mode="${m}" class="${m === mode ? "is-on" : ""}">${modeLabel(m)}${m === mode ? ' <span class="tick">✓</span>' : ""}</button>`
              )
              .join("")}
          </div>
          <button class="big-button start" type="button" data-start>Start my quest <span aria-hidden="true">→</span></button>
          <button class="text-link resume" type="button" data-resume>Resume an unfinished quest</button>
          ${resumeNote ? `<p class="resume-note">${resumeNote}</p>` : ""}
          <p class="quest-card-foot"><span>10 minutes</span><span>Your pace. Pauses welcome.</span><span>Progress saved</span></p>
        </div>
      <section class="adventure">
        <div>
          <p class="eyebrow">The adventure so far</p>
          <h2>Every quest is a step forward.</h2>
        </div>
        <div class="milestones">
          ${MILESTONES.map(
            ([count, name]) => `
            <div class="${save.missions >= count ? "is-done" : ""}">
              <span>${save.missions >= count ? "✓" : count}</span>
              <small>${name}</small>
            </div>`
          ).join("")}
        </div>
      </section>
      </div>
      <aside class="side">
        <div class="stat-card purple">
          <span class="stat-icon" aria-hidden="true">☆</span>
          <div>
            <b>${clockText(Math.min(save.todayMs, QUEST_MS))}<small> / 10:00</small></b>
            <span class="stat-label">Today’s practice</span>
            <span class="stat-note">Time adds up across sessions.</span>
          </div>
        </div>
        <div class="stat-card green">
          <span class="stat-icon" aria-hidden="true">◎</span>
          <div>
            <b>${fluent}<small> / ${total}</small></b>
            <span class="stat-label">Facts feeling fluent</span>
            <span class="stat-note">Small steps, stronger recall.</span>
          </div>
        </div>
        <p class="tip"><span aria-hidden="true">✨</span><span><b>Your quest learns with you.</b><br />Tricky facts return sooner. Familiar ones get room to breathe.</span></p>
        <div class="game-modes">
          <p class="eyebrow">Game mode selector</p>
          <h2>Pick your challenge.</h2>
          <div class="game-mode-list">
            ${GAME_MODES.filter((m) => (!m.oscarOnly || learner === "oscar") && (!m.secret || questUnlocked))
              .map(
                (m) => `
              <button type="button" class="game-mode game-mode-${m.id}${m.secret && justUnlocked ? " just-unlocked" : ""}" data-game="${m.id}">
                <span class="game-mode-icon" aria-hidden="true">${m.icon}</span>
                <span class="game-mode-text">
                  <strong>${m.name}</strong>
                  <span>${m.blurb}</span>
                  <small>${bestText(m.id, save)}</small>
                </span>
                <em aria-hidden="true">→</em>
              </button>`
              )
              .join("")}
          </div>
        </div>
      </aside>
    </section>
  `;
  // Olly's math tiles hop and glow when clicked (again from the start if
  // clicked mid-hop).
  for (const tile of app.querySelectorAll<HTMLButtonElement>(".tile")) {
    tile.addEventListener("click", () => {
      if (orbiting) return;
      tile.classList.remove("is-popping");
      void tile.offsetWidth;
      tile.classList.add("is-popping");
      const tiles = [...app.querySelectorAll<HTMLButtonElement>(".tile")];
      if (tiles.every((t) => t.classList.contains("is-popping"))) spinTilesIntoOlly(tiles);
    });
    tile.addEventListener("animationend", () => tile.classList.remove("is-popping"));
  }
  justUnlocked = false;
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-game]")) {
    button.addEventListener("click", () => startQuest(button.dataset["game"] as GameMode));
  }
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.addEventListener("click", () => {
      mode = button.dataset["mode"] as Mode;
      resumeNote = "";
      renderHome();
    });
  }
  app.querySelector("[data-start]")!.addEventListener("click", () => startQuest("daily"));
  app.querySelector("[data-resume]")!.addEventListener("click", () => {
    if (paused === learner && question) {
      go("quest");
      startTimer();
    } else {
      resumeNote = "No unfinished mission. Start a fresh quest!";
      renderHome();
    }
  });
}

// All four tiles lit at once: they circle Olly, closer and closer, until they
// touch him. Then he turns blue with red eyes and a red mohawk, and Quest Mode
// appears.
function spinTilesIntoOlly(tiles: HTMLButtonElement[]): void {
  const ring = app.querySelector<HTMLElement>(".olly-ring");
  if (!ring) return;
  orbiting = true;
  sound(() => whoosh(3.6));
  const ringBox = ring.getBoundingClientRect();
  const centerX = ringBox.left + ringBox.width / 2;
  const centerY = ringBox.top + ringBox.height / 2;
  // Where Olly's head is: close enough that the tiles touch him.
  const touchRadius = ringBox.width * 0.32;
  const starts = tiles.map((tile) => {
    // Where the tile is now, mid-hop...
    const box = tile.getBoundingClientRect();
    const x = box.left + box.width / 2 - centerX;
    const y = box.top + box.height / 2 - centerY;
    tile.classList.remove("is-popping");
    tile.classList.add("is-orbiting");
    tile.style.transform = "none";
    // ...and where it sits without the hop, which the moves are measured from.
    const home = tile.getBoundingClientRect();
    const homeX = home.left + home.width / 2 - centerX;
    const homeY = home.top + home.height / 2 - centerY;
    return { tile, homeX, homeY, radius: Math.hypot(x, y), angle: Math.atan2(y, x) };
  });

  const duration = 3600;
  const began = performance.now();
  const step = (now: number): void => {
    const progress = Math.min(1, (now - began) / duration);
    // Faster and faster around, closer and closer in.
    const spin = Math.PI * 2 * 3 * progress * progress;
    const pull = progress * progress;
    for (const start of starts) {
      const radius = start.radius + (touchRadius - start.radius) * pull;
      const angle = start.angle + spin;
      const dx = Math.cos(angle) * radius - start.homeX;
      const dy = Math.sin(angle) * radius - start.homeY;
      start.tile.style.transform = `translate(${dx}px, ${dy}px) rotate(${spin * 2}rad)`;
    }
    if (progress < 1) {
      requestAnimationFrame(step);
      return;
    }
    // Touch! The tiles vanish into Olly and he changes.
    for (const start of starts) start.tile.classList.add("is-absorbed");
    ring.classList.add("is-transforming");
    ring.innerHTML = ollySvg("blue");
    sound(chime);
    const firstTime = !questUnlocked;
    questUnlocked = true;
    writeSetting(QUEST_UNLOCKED_KEY, "1");
    window.setTimeout(() => {
      orbiting = false;
      justUnlocked = firstTime;
      if (screen === "home") renderHome();
    }, 1600);
  };
  requestAnimationFrame(step);
}

function bestText(id: GameMode, save: LearnerSave): string {
  const best = save.best?.[id] ?? 0;
  if (id === "speed") return best ? `Best: ${best} in 60 seconds` : "No best yet";
  if (id === "survival") return best ? `Best: ${best} survived` : "No best yet";
  if (id === "boss") return best ? `Best: ${best} / ${BOSS_RUSH_BOSSES} bosses` : "No best yet";
  if (id === "endless") return best ? `Best: ${best} run${best === 1 ? "" : "s"} in a row` : "No best yet";
  if (id === "remainder") return "Division only";
  if (id === "quest") return "Walk around with arrow keys / WASD";
  return `${save.missions} mission${save.missions === 1 ? "" : "s"} done`;
}

function startQuest(chosen: GameMode): void {
  gameMode = chosen;
  paused = null;
  resumeNote = "";
  questionNumber = 0;
  questActiveMs = 0;
  questCorrect = 0;
  questAnswered = 0;
  questXp = 0;
  hearts = SURVIVAL_HEARTS;
  runsDone = 0;
  runToast = "";
  newBest = false;
  recent = [];
  // Quest Mode is a whole world to walk around in; fights there ask the
  // questions.
  if (gameMode === "quest") {
    go("world");
    startTimer();
    return;
  }
  nextQuestion(gameMode === "boss");
  go("quest");
  startTimer();
}

// Questions for fights in Quest Mode's world and in the Matrix.
function fightQuestion(): { text: string; answer: number; remainder: number; isDiv: boolean; hint: string } {
  nextQuestion(false);
  const q = question!;
  return {
    text: `${q.shownA} ${OP_NAMES[q.fact.op].sign} ${q.fact.b}`,
    answer: q.fact.answer,
    remainder: q.remainder,
    isDiv: q.fact.op === "div",
    hint: hintFor(q),
  };
}

function recordFightAnswer(correct: boolean): void {
  record(correct, false);
  questAnswered += 1;
  if (correct) {
    questCorrect += 1;
    saveFor(learner!).xp += 10;
    persist();
  }
}

function renderWorld(): void {
  app.innerHTML = `<section class="world"></section>`;
  stopWorld = startWorld(app.querySelector<HTMLElement>(".world")!, {
    learner: learner!,
    newQuestion: fightQuestion,
    recordAnswer: recordFightAnswer,
    muted: () => muted,
    leave: () => go("home"),
    enterMatrix: () => go("matrix"),
    backFromMatrix,
    beamedOut,
  });
  backFromMatrix = false;
  beamedOut = false;
}

function renderMatrix(): void {
  app.innerHTML = `<section class="world matrix"></section>`;
  stopWorld = startMatrix(app.querySelector<HTMLElement>(".matrix")!, {
    learner: learner!,
    newQuestion: fightQuestion,
    recordAnswer: recordFightAnswer,
    fighter: () => worldFighter(learner!),
    look: () => worldOllyLook(learner!),
    hasVaultKey: () => worldHasVaultKey(learner!),
    muted: () => muted,
    addGems: (gems) => addWorldGems(learner!, gems),
    escape: () => {
      backFromMatrix = true;
      go("world");
    },
    beamOut: () => {
      beamedOut = true;
      go("world");
    },
    leave: () => go("home"),
  });
}

// Whether the question on screen is the last one of this game.
function isLastQuestion(): boolean {
  if (gameMode === "daily" || gameMode === "remainder") return question!.boss;
  if (gameMode === "boss") return questionNumber >= BOSS_RUSH_BOSSES;
  if (gameMode === "survival") return hearts === 0;
  return false;
}

function pillText(q: Question): string {
  if (gameMode === "boss") return `BOSS ${questionNumber} / ${BOSS_RUSH_BOSSES}`;
  if (q.boss) return "FINAL BOSS";
  if (gameMode === "endless") return `ENDLESS · RUN ${runsDone + 1}`;
  if (gameMode === "speed") return "SPEED ROUND";
  if (gameMode === "survival") return "SURVIVAL";
  if (gameMode === "remainder") return "REMAINDER RUMBLE";
  return "DAILY QUEST";
}

function renderQuest(): void {
  const q = question!;
  const { fact } = q;
  const who = LEARNERS[learner!];
  const isDiv = fact.op === "div";
  let ollySays = checked ? (checked.correct ? "Big brain moves." : "Every quest is a step forward.") : "You’ve got this.";
  if (!checked && gameMode === "boss") ollySays = "Boss incoming. Lock in!";
  else if (!checked && q.boss) ollySays = "Last one. Lock in!";
  else if (!checked && gameMode === "speed") ollySays = "Go go go!";
  else if (checked && gameMode === "survival" && !checked.correct) ollySays = hearts > 0 ? "Ouch! Keep going." : "Out of hearts!";

  let body: string;
  if (!checked) {
    body = `
      <form class="answer-form" autocomplete="off">
        <div class="answers">
          <input class="answer-box" id="answer" inputmode="numeric" maxlength="4" placeholder="?" aria-label="Your answer" />
          ${
            isDiv
              ? `<span class="remainder">
                  <span class="r" aria-hidden="true">R</span>
                  <input class="answer-box" id="remainder" inputmode="numeric" maxlength="3" placeholder="0" aria-label="Remainder" />
                </span>`
              : ""
          }
        </div>
        ${isDiv ? `<div class="answer-labels"><span>Answer</span><span>Remainder</span></div>` : ""}
        <div class="feel">How did it feel? (optional)</div>
        <div class="feel-buttons">
          <button type="button" data-feel="easy" class="${feel === "easy" ? "is-on" : ""}">Knew it!</button>
          <button type="button" data-feel="effortful" class="${feel === "effortful" ? "is-on" : ""}">Worked it out</button>
        </div>
        ${warning ? `<p class="warn">${warning}</p>` : ""}
        <button class="big-button check" type="submit">Check answer →</button>
        <div class="under-links">
          <button class="text-link" type="button" data-hint>A little hint?</button>
          <button class="text-link" type="button" data-unsure>I’m not sure yet</button>
        </div>
        ${hintText ? `<p class="hint">💡 ${hintText}</p>` : ""}
      </form>`;
  } else {
    const fullAnswer = `${q.shownA} ${OP_NAMES[fact.op].sign} ${fact.b} = ${fact.answer}${isDiv ? ` R${q.remainder}` : ""}`;
    const last = isLastQuestion();
    let tag: string;
    let title: string;
    if (checked.correct) {
      tag = "CORRECT FIRST TRY";
      title = `That’s a W, ${who.name}!`;
    } else if (checked.gaveUp) {
      tag = "SMALL STEPS, STRONGER RECALL";
      title = "Here’s how it goes.";
    } else {
      tag = "NEEDS ANOTHER LOOK";
      title = "Another step forward.";
    }
    body = `
      <div class="feedback ${checked.correct ? "good" : "oops"}">
        <div class="tag">${tag}</div>
        <h2>${title}</h2>
        <p>${checked.correct && feel === "easy" ? "That one felt automatic. " : ""}${fullAnswer}</p>
        ${gameMode === "speed" ? "" : `<button class="big-button check" type="button" data-next>${last ? "See my results →" : "Next question →"}</button>`}
      </div>`;
  }

  const heartRow =
    gameMode === "survival"
      ? `<span class="hearts" aria-label="${hearts} hearts left">${"❤️".repeat(hearts)}${"🤍".repeat(SURVIVAL_HEARTS - hearts)}</span> · `
      : "";


  app.innerHTML = `
    <section class="quest">
      <div class="quest-links">
        <button class="text-link" type="button" data-pause>← Pause quest</button>
        ${gameMode === "endless" ? `<button class="text-link" type="button" data-end>End run</button>` : ""}
      </div>
      <div class="quest-top">
        <span class="pill ${q.boss ? "boss" : ""}">${pillText(q)}</span>
        <span>${heartRow}Question ${questionNumber} · <b id="clock">${clockLabel()}</b></span>
      </div>
      <div class="bar ${gameMode}"><span id="quest-bar" style="width:${barPercent()}%"></span></div>
      <p class="run-toast" id="run-toast" ${runToast ? "" : "hidden"}>${runToast}</p>
      <div class="question-card ${q.boss ? "boss" : ""}">
        <div class="olly-says">${OLLY}<span>${ollySays}</span></div>
        <div class="equation">${q.shownA} ${OP_NAMES[fact.op].sign} ${fact.b} <span class="q">= ?</span></div>
        ${body}
      </div>
      <p class="take-your-time">${gameMode === "speed" ? "Quick! The clock is ticking." : "Take your time. Thinking is part of learning."}</p>
    </section>
  `;

  app.querySelector("[data-pause]")!.addEventListener("click", () => {
    window.clearTimeout(autoNext);
    paused = learner;
    go("home");
  });
  app.querySelector("[data-end]")?.addEventListener("click", finishQuest);

  if (!checked) {
    const form = app.querySelector<HTMLFormElement>(".answer-form")!;
    const answerInput = app.querySelector<HTMLInputElement>("#answer")!;
    const remainderInput = app.querySelector<HTMLInputElement>("#remainder");
    for (const input of [answerInput, remainderInput]) {
      input?.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
      });
    }
    // Typing "r" jumps from the answer to the remainder box.
    answerInput.addEventListener("keydown", (event) => {
      if (remainderInput && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        remainderInput.focus();
      }
    });
    answerInput.focus();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      checkAnswer(answerInput.value, remainderInput?.value ?? "");
    });
    for (const button of app.querySelectorAll<HTMLButtonElement>("[data-feel]")) {
      button.addEventListener("click", () => {
        const picked = button.dataset["feel"] as Feel;
        feel = feel === picked ? null : picked;
        keepTyping(answerInput.value, remainderInput?.value ?? "");
      });
    }
    app.querySelector("[data-hint]")!.addEventListener("click", () => {
      hintText = hintFor(q);
      keepTyping(answerInput.value, remainderInput?.value ?? "");
    });
    app.querySelector("[data-unsure]")!.addEventListener("click", () => {
      record(false, false);
      answered(false, true);
    });
  } else {
    // Speed Round has no Next button; it moves on by itself.
    const next = app.querySelector<HTMLButtonElement>("[data-next]");
    next?.focus();
    next?.addEventListener("click", afterFeedback);
  }
}

// Redraw the question without losing what's already typed.
function keepTyping(answer: string, remainder: string): void {
  renderQuest();
  const answerInput = app.querySelector<HTMLInputElement>("#answer");
  const remainderInput = app.querySelector<HTMLInputElement>("#remainder");
  if (answerInput) answerInput.value = answer;
  if (remainderInput) remainderInput.value = remainder;
}

function checkAnswer(answerText: string, remainderText: string): void {
  const q = question!;
  if (answerText === "") {
    warning = "Type a whole number first.";
    keepTyping(answerText, remainderText);
    return;
  }
  // An empty remainder box means nothing left over.
  const remainder = remainderText === "" ? 0 : Number(remainderText);
  const correct = Number(answerText) === q.fact.answer && (q.fact.op !== "div" || remainder === q.remainder);
  record(correct, feel !== "effortful" && (feel === "easy" || !hintText));
  if (correct) {
    questXp += q.boss ? 20 : 10;
    sound(chime);
  } else {
    sound(boing);
  }
  answered(correct, false);
}

function answered(correct: boolean, gaveUp: boolean): void {
  questAnswered += 1;
  if (correct) questCorrect += 1;
  else if (gameMode === "survival") hearts = Math.max(0, hearts - 1);
  checked = { correct, gaveUp };
  renderQuest();
  // Speed Round shows the answer for a moment, then moves on by itself.
  if (gameMode === "speed") {
    window.clearTimeout(autoNext);
    autoNext = window.setTimeout(() => {
      if (screen === "quest" && checked) afterFeedback();
    }, correct ? 450 : 1300);
  }
}

function afterFeedback(): void {
  if (isLastQuestion()) {
    finishQuest();
    return;
  }
  const bossNext = gameMode === "boss" || ((gameMode === "daily" || gameMode === "remainder") && questActiveMs >= QUEST_MS);
  nextQuestion(bossNext);
  renderQuest();
}

function finishQuest(): void {
  window.clearTimeout(autoNext);
  const save = saveFor(learner!);
  save.xp += questXp;
  // Daily quests, Remainder Rumble and Boss Rush are missions. Endless already
  // counted one for every 10 minutes.
  if (gameMode === "daily" || gameMode === "remainder" || gameMode === "boss") save.missions += 1;
  const score = gameMode === "endless" ? runsDone : questCorrect;
  if (gameMode !== "daily" && gameMode !== "remainder") {
    const best = (save.best ??= {});
    newBest = score > 0 && score > (best[gameMode] ?? 0);
    if (newBest) best[gameMode] = score;
  }
  paused = null;
  persist();
  sound(chime);
  go("complete");
}

function resultTitle(): { eyebrow: string; title: string } {
  if (gameMode === "speed") return { eyebrow: "Time’s up!", title: `${questCorrect} right in 60 seconds. Zoom zoom.` };
  if (gameMode === "survival") return { eyebrow: "Out of hearts", title: `You survived ${questCorrect} question${questCorrect === 1 ? "" : "s"}. Brave explorer.` };
  if (gameMode === "boss") return { eyebrow: "Boss Rush complete", title: `${questCorrect} of ${BOSS_RUSH_BOSSES} bosses beaten. Tricky facts, faced.` };
  if (gameMode === "endless")
    return { eyebrow: "Endless run over", title: `${runsDone} run${runsDone === 1 ? "" : "s"} done and ${clockText(questActiveMs)} of practice. Legend.` };
  if (gameMode === "remainder") return { eyebrow: "Remainder Rumble complete", title: "Ten minutes of leftovers. Nothing left over in your brain." };
  return { eyebrow: "Mission complete", title: "Ten minutes. A stronger brain. Nice work showing up." };
}

function renderComplete(): void {
  const { eyebrow, title } = resultTitle();
  app.innerHTML = `
    <section class="complete">
      <div class="big-star" aria-hidden="true">${GAME_MODES.find((m) => m.id === gameMode)?.icon ?? "★"}</div>
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      ${newBest ? `<p class="new-best">🏆 New best!</p>` : ""}
      <div class="complete-stats">
        <div class="stat"><small>QUESTIONS</small><b>${questAnswered}</b></div>
        <div class="stat"><small>CORRECT</small><b>${questCorrect}</b></div>
        <div class="stat"><small>QUEST XP</small><b>+${questXp}</b></div>
      </div>
      <div class="complete-buttons">
        <button class="big-button" type="button" data-again>Play again</button>
        <button class="big-button light" type="button" data-go="progress">See my results →</button>
        <button class="big-button light" type="button" data-go="home">Back to base</button>
      </div>
    </section>
  `;
  app.querySelector("[data-again]")!.addEventListener("click", () => startQuest(gameMode));
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-go]")) {
    button.addEventListener("click", () => go(button.dataset["go"] as Screen));
  }
}

function renderProgress(): void {
  const who = LEARNERS[learner!];
  const save = saveFor(learner!);
  if (!who.ops.includes(progressOp)) progressOp = who.ops[0]!;
  const facts = FACTS[progressOp];
  const counts: Record<Status, number> = { untested: 0, practicing: 0, fluent: 0 };
  for (const fact of facts) counts[statusOf(save.facts[fact.id])] += 1;

  app.innerHTML = `
    <section class="progress">
      <p class="eyebrow">The adventure so far</p>
      <h1>Watch the facts click.</h1>
      <p>Tricky facts return sooner. Familiar ones get room to breathe.</p>
      <div class="stats">
        <div class="stat"><small>FLUENT</small><b>${counts.fluent}</b></div>
        <div class="stat"><small>PRACTICING</small><b>${counts.practicing}</b></div>
        <div class="stat"><small>UNTESTED</small><b>${counts.untested}</b></div>
      </div>
      <div class="grid-top">
        <div class="modes" role="tablist">
          ${who.ops
            .map((op) => `<button type="button" role="tab" data-op="${op}" class="${op === progressOp ? "is-on" : ""}">${OP_NAMES[op].noun}</button>`)
            .join("")}
        </div>
        <div class="legend">
          <span><i></i>Untested</span>
          <span class="practicing"><i></i>Practicing</span>
          <span class="fluent"><i></i>Fluent</span>
        </div>
      </div>
      <div class="fact-grid">
        ${facts
          .map((fact) => {
            const status = statusOf(save.facts[fact.id]);
            return `<div class="${status}" title="${fact.label} = ${fact.answer}"><b>${fact.label}</b><span>${STATUS_NAMES[status]}</span></div>`;
          })
          .join("")}
      </div>
    </section>
  `;
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-op]")) {
    button.addEventListener("click", () => {
      progressOp = button.dataset["op"] as Op;
      renderProgress();
    });
  }
}

window.addEventListener("pagehide", () => {
  if (screen === "quest" || screen === "world") stopTimer();
  stopWorld?.();
  persist();
});

render();
