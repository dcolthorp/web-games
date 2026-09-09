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
const roomWord = document.getElementById("room-word");
const newWord = document.getElementById("new-word");
const closeRoom = document.getElementById("close-room");

fillDifficultyOptions(createDifficulty);
fillDifficultyOptions(roomDifficulty);

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

newWord?.addEventListener("click", () => {
  if (!room) return;
  room = { ...room, word: pickWord(room.difficulty, room.mode) };
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
  if (roomPanel) roomPanel.hidden = room === null;

  setToggle("create-privacy", createPrivacy);
  setToggle("create-mode", createMode);
  if (createCodeRow) createCodeRow.hidden = createPrivacy !== "private";
  // A private room without its code would lock everyone out, so the browser
  // asks for one before the form will submit.
  if (createCode instanceof HTMLInputElement) createCode.required = createPrivacy === "private";

  if (!room) return;
  setToggle("room-privacy", room.privacy);
  setToggle("room-mode", room.mode);
  if (roomName) roomName.textContent = room.name;
  if (roomLine) roomLine.textContent = describeRoom(room);
  if (roomCodeRow) roomCodeRow.hidden = room.privacy !== "private";
  if (roomCode instanceof HTMLInputElement && roomCode.value !== room.code) roomCode.value = room.code;
  if (roomDifficulty instanceof HTMLSelectElement) roomDifficulty.value = room.difficulty;
  if (roomWord) roomWord.textContent = room.word;
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
