import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();

type Privacy = "public" | "private";
type Mode = "words" | "phrases";

// Borrowed off the Geometry Dash ladder: the harder the level, the more of a
// mouthful the thing you have to whisper.
const LEVELS = {
  "Auto": {
    words: ["cat", "dog", "hat", "sun", "bug"],
    phrases: ["the big cat", "a red hat", "my dog ran"],
  },
  "Easy": {
    words: ["apple", "banana", "purple", "rocket", "pickle"],
    phrases: ["eat the pickle", "purple banana rocket", "an apple in a box"],
  },
  "Normal": {
    words: ["dinosaur", "umbrella", "spaghetti", "telescope", "avalanche"],
    phrases: ["the dinosaur ate my umbrella", "spaghetti on a telescope", "an avalanche of socks"],
  },
  "Intermediate": {
    words: ["kaleidoscope", "rhinoceros", "helicopter", "refrigerator", "caterpillar"],
    phrases: [
      "a rhinoceros flying a helicopter",
      "a kaleidoscope in the refrigerator",
      "the caterpillar lost both shoes",
    ],
  },
  "Medium": {
    words: ["onomatopoeia", "hippopotamus", "extraordinary", "photosynthesis", "archaeologist"],
    phrases: [
      "a hippopotamus doing photosynthesis",
      "the archaeologist yelled onomatopoeia",
      "an extraordinary pancake emergency",
    ],
  },
  "Hard": {
    words: ["chrysanthemum", "pterodactyl", "worcestershire", "bureaucracy", "quesadilla"],
    phrases: [
      "a pterodactyl with worcestershire sauce",
      "chrysanthemum bureaucracy quesadilla",
      "the quesadilla filed a complaint",
    ],
  },
  "Insane": {
    words: ["sesquipedalian", "indistinguishable", "phenomenological", "incomprehensibility"],
    phrases: [
      "an indistinguishable sesquipedalian argument",
      "phenomenological incomprehensibility on a Tuesday",
    ],
  },
  "Demon": {
    words: ["antidisestablishmentarianism", "floccinaucinihilipilification", "honorificabilitudinitatibus"],
    phrases: [
      "antidisestablishmentarianism causes floccinaucinihilipilification",
      "honorificabilitudinitatibus, said the parrot",
    ],
  },
  "Extreme Demon": {
    words: [
      "supercalifragilisticexpialidocious",
      "pneumonoultramicroscopicsilicovolcanoconiosis",
      "hippopotomonstrosesquippedaliophobia",
      "pseudopseudohypoparathyroidism",
    ],
    phrases: [
      "supercalifragilisticexpialidocious pneumonoultramicroscopicsilicovolcanoconiosis",
      "hippopotomonstrosesquippedaliophobia and pseudopseudohypoparathyroidism",
    ],
  },
} as const;

type Level = keyof typeof LEVELS;
type Difficulty = Level | "All";

const LEVEL_NAMES = Object.keys(LEVELS) as Level[];
// "All" sits at the bottom of the list and reaches into every level at once.
const DIFFICULTIES: Difficulty[] = [...LEVEL_NAMES, "All"];

interface Room {
  name: string;
  privacy: Privacy;
  code: string;
  difficulty: Difficulty;
  mode: Mode;
  word: string;
}

const ROOM_KEY = "telephone-room";
const PLAYERS_KEY = "telephone-players";
const BANNED_KEY = "telephone-banned";
const PLAYERS_NEEDED = 5;

interface Round {
  order: string[];
  index: number;
  // One clip per recorded turn; the last player types instead of recording.
  clips: (string | undefined)[];
  guess: string;
  word: string;
  phase: "recording" | "typing" | "judging" | "done";
}

const micStatus = document.getElementById("mic-status");
const micRetry = document.getElementById("mic-retry");
const createPanel = document.getElementById("create-panel");
const createForm = document.getElementById("create-form");
const groupName = document.getElementById("group-name");
const createCode = document.getElementById("create-code");
const createCodeRow = document.getElementById("create-code-row");
const createDifficulty = document.getElementById("create-difficulty");
const roomPanel = document.getElementById("room-panel");
const roomName = document.getElementById("room-name");
const roomLine = document.getElementById("room-line");
const roomCode = document.getElementById("room-code");
const roomCodeRow = document.getElementById("room-code-row");
const roomDifficulty = document.getElementById("room-difficulty");
const closeRoom = document.getElementById("close-room");
const playersPanel = document.getElementById("players-panel");
const playersLine = document.getElementById("players-line");
const playersList = document.getElementById("players-list");
const addPlayerForm = document.getElementById("add-player-form");
const playerName = document.getElementById("player-name");
const bannedLine = document.getElementById("banned-line");
const startRound = document.getElementById("start-round");
const roundPanel = document.getElementById("round-panel");
const turnTitle = document.getElementById("turn-title");
const turnLine = document.getElementById("turn-line");
const roundWord = document.getElementById("round-word");
const previousClip = document.getElementById("previous-clip");
const micButton = document.getElementById("mic-button");
const guessRow = document.getElementById("guess-row");
const finalGuess = document.getElementById("final-guess");
const judgeRow = document.getElementById("judge-row");
const roundResult = document.getElementById("round-result");
const sendTurn = document.getElementById("send-turn");
const endRound = document.getElementById("end-round");

fillDifficultyOptions(createDifficulty);
fillDifficultyOptions(roomDifficulty);

let players = loadNames(PLAYERS_KEY);
let banned = loadNames(BANNED_KEY);
let round: Round | null = null;
// The live mic is held only while a round is running.
let roundStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let pendingClip: string | undefined;

let createPrivacy: Privacy = "public";
let createMode: Mode = "words";
let room = loadRoom();

// The mic question comes first, the way a phone asks before it lets you talk.
void askForMicrophone();

async function askForMicrophone(): Promise<void> {
  if (!micStatus) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setMicState("This browser won't hand over a microphone here.", true);
    return;
  }

  micStatus.textContent = "Asking your browser for the microphone…";
  if (micRetry) micRetry.hidden = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Let go of it again until there is an actual call to make, so the
    // recording light isn't on the whole time you're naming a room.
    for (const track of stream.getTracks()) track.stop();
    setMicState("Microphone: ready.", false);
  } catch {
    setMicState("No microphone yet. You can still set up a room.", true);
  }
}

function setMicState(text: string, showRetry: boolean): void {
  if (micStatus) micStatus.textContent = text;
  if (micRetry) micRetry.hidden = !showRetry;
  render();
}

micRetry?.addEventListener("click", () => void askForMicrophone());

wireToggle("create-privacy", (choice) => {
  createPrivacy = choice === "private" ? "private" : "public";
  render();
  if (createPrivacy === "private" && createCode instanceof HTMLInputElement) createCode.focus();
});

wireToggle("create-mode", (choice) => {
  createMode = choice === "phrases" ? "phrases" : "words";
  render();
});

wireToggle("room-privacy", (choice) => {
  if (!room) return;
  room = { ...room, privacy: choice === "private" ? "private" : "public" };
  saveRoom(room);
  render();
  if (room.privacy === "private" && roomCode instanceof HTMLInputElement) roomCode.focus();
});

// Swapping words for phrases (or the difficulty) means a new thing to whisper,
// so you can hear what you just signed up for.
wireToggle("room-mode", (choice) => {
  if (!room) return;
  const mode: Mode = choice === "phrases" ? "phrases" : "words";
  room = { ...room, mode, word: pickWord(room.difficulty, mode) };
  saveRoom(room);
  render();
});

roomDifficulty?.addEventListener("change", () => {
  if (!room) return;
  const difficulty = readDifficulty(roomDifficulty);
  room = { ...room, difficulty, word: pickWord(difficulty, room.mode) };
  saveRoom(room);
  render();
});

createForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!(groupName instanceof HTMLInputElement) || !(createCode instanceof HTMLInputElement)) return;
  const difficulty = readDifficulty(createDifficulty);
  room = {
    name: groupName.value.trim() || "Untitled Group",
    privacy: createPrivacy,
    code: createPrivacy === "private" ? createCode.value.trim() : "",
    difficulty,
    mode: createMode,
    word: pickWord(difficulty, createMode),
  };
  saveRoom(room);
  render();
});

roomCode?.addEventListener("input", () => {
  if (!room || !(roomCode instanceof HTMLInputElement)) return;
  room = { ...room, code: roomCode.value.trim() };
  saveRoom(room);
  if (roomLine) roomLine.textContent = describeRoom(room);
});

closeRoom?.addEventListener("click", () => {
  finishRound();
  room = null;
  localStorage.removeItem(ROOM_KEY);
  render();
});

function wireToggle(id: string, onPick: (choice: string) => void): void {
  document.getElementById(id)?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (button) onPick(button.dataset["choice"] ?? "");
  });
}

function render(): void {
  const micAnswered = Boolean(micStatus && !micStatus.textContent?.startsWith("Asking"));
  if (createPanel) createPanel.hidden = !micAnswered || room !== null;
  if (roomPanel) roomPanel.hidden = room === null || round !== null;

  setToggle("create-privacy", createPrivacy);
  setToggle("create-mode", createMode);
  if (createCodeRow) createCodeRow.hidden = createPrivacy !== "private";
  // A private room without its code would lock everyone out, so the browser
  // asks for one before the form will submit.
  if (createCode instanceof HTMLInputElement) createCode.required = createPrivacy === "private";

  renderPlayers();
  renderRound();

  if (!room) return;
  setToggle("room-privacy", room.privacy);
  setToggle("room-mode", room.mode);
  if (roomName) roomName.textContent = room.name;
  if (roomLine) roomLine.textContent = describeRoom(room);
  if (roomCodeRow) roomCodeRow.hidden = room.privacy !== "private";
  if (roomCode instanceof HTMLInputElement && roomCode.value !== room.code) roomCode.value = room.code;
  if (roomDifficulty instanceof HTMLSelectElement) roomDifficulty.value = room.difficulty;
  renderPlayers();
  renderRound();
}

function renderPlayers(): void {
  if (playersPanel) playersPanel.hidden = room === null || round !== null;
  if (playersLine) {
    const missing = PLAYERS_NEEDED - players.length;
    playersLine.textContent = missing > 0
      ? `Add ${missing} more ${missing === 1 ? "person" : "people"} to start a whisper.`
      : `${players.length} people. Ready to whisper.`;
  }
  if (playersList) {
    playersList.innerHTML = "";
    for (const name of players) {
      const item = document.createElement("li");
      const remove = document.createElement("button");
      item.textContent = name;
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${name}`);
      remove.addEventListener("click", () => {
        players = players.filter((player) => player !== name);
        saveNames(PLAYERS_KEY, players);
        render();
      });
      item.append(remove);
      playersList.append(item);
    }
  }
  if (bannedLine) {
    bannedLine.hidden = banned.length === 0;
    bannedLine.textContent = `Banned forever: ${banned.join(", ")}`;
  }
  if (startRound) startRound.hidden = players.length < PLAYERS_NEEDED;
}

addPlayerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!(playerName instanceof HTMLInputElement)) return;
  const name = playerName.value.trim();
  if (!name) return;
  if (banned.includes(name)) {
    if (playersLine) playersLine.textContent = `${name} is banned forever. Nice try.`;
    return;
  }
  if (!players.includes(name)) players.push(name);
  saveNames(PLAYERS_KEY, players);
  playerName.value = "";
  render();
});

startRound?.addEventListener("click", () => void beginRound());

async function beginRound(): Promise<void> {
  if (!room || players.length < PLAYERS_NEEDED) return;
  try {
    roundStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    if (playersLine) playersLine.textContent = "No microphone, no whispering. Let the browser use it first.";
    return;
  }
  // Shuffled, so whoever goes first is nobody's choice.
  const order = shuffle(players);
  round = { order, index: 0, clips: [], guess: "", word: room.word, phase: "recording" };
  render();
}

function renderRound(): void {
  if (roundPanel) roundPanel.hidden = round === null;
  if (!round) return;

  const current = round.order[round.index] ?? "";
  const isFirst = round.index === 0;
  const isLast = round.index === round.order.length - 1;
  const judging = round.phase === "judging";
  const done = round.phase === "done";

  if (turnTitle) turnTitle.textContent = judging || done ? round.order[0] ?? "" : `${current}'s turn`;
  if (turnLine) {
    turnLine.textContent = done
      ? ""
      : judging
        ? `They guessed "${round.guess}". Was that it?`
        : isFirst
          ? "Hold the mic button and say the word."
          : isLast
            ? "Listen, then type what you think it was."
            : "Listen, then say what you think you heard.";
  }

  // The real word is only ever shown to the person who starts, and to the
  // judge at the end.
  if (roundWord) {
    roundWord.hidden = !(isFirst && round.phase === "recording") && !judging && !done;
    roundWord.textContent = round.word;
  }

  const previous = round.clips[round.index - 1];
  if (previousClip instanceof HTMLAudioElement) {
    previousClip.hidden = !previous || (round.phase !== "recording" && round.phase !== "typing");
    if (previous && previousClip.src !== previous) previousClip.src = previous;
  }

  if (micButton) micButton.hidden = round.phase !== "recording";
  if (guessRow) guessRow.hidden = round.phase !== "typing";
  if (judgeRow) judgeRow.hidden = !judging;
  if (roundResult) roundResult.hidden = !done;
  if (endRound) endRound.hidden = !done;
  if (sendTurn) {
    sendTurn.hidden = judging || done;
    (sendTurn as HTMLButtonElement).disabled = round.phase === "recording" && pendingClip === undefined;
  }
}

micButton?.addEventListener("click", () => {
  if (!roundStream) return;
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  recordedChunks = [];
  recorder = new MediaRecorder(roundStream);
  recorder.addEventListener("dataavailable", (event) => recordedChunks.push(event.data));
  recorder.addEventListener("stop", () => {
    pendingClip = URL.createObjectURL(new Blob(recordedChunks));
    micButton.setAttribute("aria-pressed", "false");
    micButton.textContent = "🎤";
    renderRound();
  });
  recorder.start();
  micButton.setAttribute("aria-pressed", "true");
  micButton.textContent = "◼";
});

sendTurn?.addEventListener("click", () => {
  if (!round) return;
  if (round.phase === "typing") {
    round.guess = finalGuess instanceof HTMLInputElement ? finalGuess.value.trim() : "";
    round.phase = "judging";
    renderRound();
    return;
  }
  if (pendingClip === undefined) return;
  round.clips[round.index] = pendingClip;
  pendingClip = undefined;
  round.index += 1;
  // The last person in the chain types their answer instead of recording.
  round.phase = round.index === round.order.length - 1 ? "typing" : "recording";
  renderRound();
});

judgeRow?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-judge]");
  if (!button || !round) return;
  const correct = button.dataset["judge"] === "correct";
  const lastPlayer = round.order[round.order.length - 1] ?? "";
  if (!correct) {
    // Oscar's rule: get it wrong and you are out of this game forever.
    if (!banned.includes(lastPlayer)) banned.push(lastPlayer);
    players = players.filter((player) => player !== lastPlayer);
    saveNames(BANNED_KEY, banned);
    saveNames(PLAYERS_KEY, players);
  }
  round.phase = "done";
  if (roundResult) {
    roundResult.textContent = correct
      ? `It was "${round.word}". Everybody wins!`
      : `It was "${round.word}", not "${round.guess}". ${lastPlayer} is banned forever.`;
  }
  render();
});

endRound?.addEventListener("click", () => {
  finishRound();
  render();
});

function finishRound(): void {
  for (const clip of round?.clips ?? []) if (clip) URL.revokeObjectURL(clip);
  for (const track of roundStream?.getTracks() ?? []) track.stop();
  roundStream = null;
  recorder = null;
  pendingClip = undefined;
  round = null;
  if (finalGuess instanceof HTMLInputElement) finalGuess.value = "";
}

function shuffle(names: string[]): string[] {
  const copy = [...names];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a !== undefined && b !== undefined) {
      copy[i] = b;
      copy[j] = a;
    }
  }
  return copy;
}

function loadNames(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function saveNames(key: string, names: string[]): void {
  localStorage.setItem(key, JSON.stringify(names));
}

function describeRoom(current: Room): string {
  if (current.privacy === "public") return "Public room. Anyone can walk in.";
  return current.code
    ? `Private room. The code is ${current.code}.`
    : "Private room. Pick a code or nobody can get in.";
}

function fillDifficultyOptions(select: HTMLElement | null): void {
  if (!(select instanceof HTMLSelectElement)) return;
  for (const difficulty of DIFFICULTIES) {
    const option = document.createElement("option");
    option.value = difficulty;
    option.textContent = difficulty;
    select.append(option);
  }
  select.value = "Normal";
}

function setToggle(id: string, choice: string): void {
  const group = document.getElementById(id);
  for (const button of group?.querySelectorAll<HTMLButtonElement>("[data-choice]") ?? []) {
    button.setAttribute("aria-pressed", String(button.dataset["choice"] === choice));
  }
}

function readDifficulty(select: HTMLElement | null): Difficulty {
  const value = select instanceof HTMLSelectElement ? select.value : "";
  return isDifficulty(value) ? value : "Normal";
}

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as string[]).includes(value);
}

// "All" pools every level, so an Auto word and an Extreme Demon word are
// equally likely to land on you.
function pickWord(difficulty: Difficulty, mode: Mode): string {
  const pool = difficulty === "All"
    ? LEVEL_NAMES.flatMap((level) => [...LEVELS[level][mode]])
    : [...LEVELS[difficulty][mode]];
  return pool[Math.floor(Math.random() * pool.length)] ?? "";
}

function loadRoom(): Room | null {
  const raw = localStorage.getItem(ROOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Room>;
    if (typeof parsed.name !== "string") return null;
    const difficulty = typeof parsed.difficulty === "string" && isDifficulty(parsed.difficulty)
      ? parsed.difficulty
      : "Normal";
    const mode: Mode = parsed.mode === "phrases" ? "phrases" : "words";
    return {
      name: parsed.name,
      privacy: parsed.privacy === "private" ? "private" : "public",
      code: typeof parsed.code === "string" ? parsed.code : "",
      difficulty,
      mode,
      word: typeof parsed.word === "string" && parsed.word ? parsed.word : pickWord(difficulty, mode),
    };
  } catch {
    return null;
  }
}

function saveRoom(current: Room): void {
  localStorage.setItem(ROOM_KEY, JSON.stringify(current));
}

render();
