import { openGuest, openHost, type Link } from "./net";
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


interface RoomInfo {
  name: string;
  privacy: Privacy;
  code: string;
  difficulty: Difficulty;
  mode: Mode;
}

type Phase = "recording" | "typing" | "judging" | "done";

interface RoundView {
  order: string[];
  index: number;
  phase: Phase;
  guess: string;
  result: string;
}

interface Message {
  kind: string;
  [key: string]: unknown;
}

const ROOM_KEY = "telephone-room";
// A new key on purpose: the old list was filled under the old rule, where the
// last guesser took the ban instead of the liar.
const BANNED_KEY = "telephone-banned-liars";
const PLAYERS_NEEDED = 5;
const SELF = "self";

const micStatus = document.getElementById("mic-status");
const micRetry = document.getElementById("mic-retry");
const createPanel = document.getElementById("create-panel");
const createForm = document.getElementById("create-form");
const createYou = document.getElementById("create-you");
const groupName = document.getElementById("group-name");
const createCode = document.getElementById("create-code");
const createCodeRow = document.getElementById("create-code-row");
const createDifficulty = document.getElementById("create-difficulty");
const joinPanel = document.getElementById("join-panel");
const joinForm = document.getElementById("join-form");
const joinYou = document.getElementById("join-you");
const joinGroup = document.getElementById("join-group");
const joinCode = document.getElementById("join-code");
const joinLine = document.getElementById("join-line");
const roomPanel = document.getElementById("room-panel");
const roomName = document.getElementById("room-name");
const roomLine = document.getElementById("room-line");
const roomCode = document.getElementById("room-code");
const roomCodeRow = document.getElementById("room-code-row");
const roomDifficulty = document.getElementById("room-difficulty");
const closeRoom = document.getElementById("close-room");
const leaveRoomButton = document.getElementById("leave-room");
const playersPanel = document.getElementById("players-panel");
const playersLine = document.getElementById("players-line");
const playersList = document.getElementById("players-list");
const bannedLine = document.getElementById("banned-line");
const startRoundButton = document.getElementById("start-round");
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

// What this screen knows, whether it is the host's screen or a guest's.
let link: Link | null = null;
let isHost = false;
let me = "";
let roomInfo: RoomInfo | null = null;
let players: string[] = [];
let banned = loadNames(BANNED_KEY);
let roundView: RoundView | null = null;
let netStatus = "";
let myWord = "";
let myClipUrl = "";

// Host-only: the seat chart, and the answer nobody else gets to see.
const seats = new Map<string, string>();
let secretWord = "";

let createPrivacy: Privacy = "public";
let createMode: Mode = "words";
let micStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let pendingClip: Blob | undefined;

// The mic question comes first, the way a phone asks before it lets you talk.
void askForMicrophone();
restoreHostedRoom();

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
  if (!isHost || !roomInfo) return;
  roomInfo = { ...roomInfo, privacy: choice === "private" ? "private" : "public" };
  saveHostedRoom();
  broadcastState();
  if (roomInfo.privacy === "private" && roomCode instanceof HTMLInputElement) roomCode.focus();
});

wireToggle("room-mode", (choice) => {
  if (!isHost || !roomInfo) return;
  roomInfo = { ...roomInfo, mode: choice === "phrases" ? "phrases" : "words" };
  saveHostedRoom();
  broadcastState();
});

roomDifficulty?.addEventListener("change", () => {
  if (!isHost || !roomInfo) return;
  roomInfo = { ...roomInfo, difficulty: readDifficulty(roomDifficulty) };
  saveHostedRoom();
  broadcastState();
});

roomCode?.addEventListener("input", () => {
  if (!isHost || !roomInfo || !(roomCode instanceof HTMLInputElement)) return;
  roomInfo = { ...roomInfo, code: roomCode.value.trim() };
  saveHostedRoom();
  broadcastState();
});

createForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!(groupName instanceof HTMLInputElement) || !(createCode instanceof HTMLInputElement)) return;
  startHosting({
    name: groupName.value.trim() || "Untitled Group",
    privacy: createPrivacy,
    code: createPrivacy === "private" ? createCode.value.trim() : "",
    difficulty: readDifficulty(createDifficulty),
    mode: createMode,
  }, readName(createYou, "Host"));
});

joinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!(joinGroup instanceof HTMLInputElement)) return;
  const group = joinGroup.value.trim();
  if (!group) return;
  startJoining(group, readName(joinYou, "Guest"), joinCode instanceof HTMLInputElement ? joinCode.value.trim() : "");
});

closeRoom?.addEventListener("click", () => leaveRoom(true));
leaveRoomButton?.addEventListener("click", () => leaveRoom(true));

function startHosting(room: RoomInfo, name: string): void {
  isHost = true;
  me = name;
  roomInfo = room;
  seats.clear();
  seats.set(name, SELF);
  players = [name];
  saveHostedRoom();
  netStatus = "Opening the room…";
  link = openHost({ roomName: room.name, onMessage: handleHostMessage, onStatus: setNetStatus });
  render();
}

function startJoining(group: string, name: string, code: string): void {
  isHost = false;
  me = name;
  roomInfo = null;
  players = [];
  roundView = null;
  netStatus = "Knocking…";
  link = openGuest({
    roomName: group,
    onMessage: (_from, body) => handleFromHost(body),
    onStatus: setNetStatus,
    onReady: () => link?.send("", { kind: "hello", name, code }),
  });
  render();
}

function leaveRoom(clearSaved: boolean): void {
  endRoundLocally();
  link?.close();
  link = null;
  if (isHost && clearSaved) localStorage.removeItem(ROOM_KEY);
  isHost = false;
  roomInfo = null;
  players = [];
  seats.clear();
  roundView = null;
  netStatus = "";
  render();
}

function setNetStatus(text: string): void {
  netStatus = text;
  render();
}

// --- host side -------------------------------------------------------------

function handleHostMessage(from: string, value: unknown): void {
  const message = readMessage(value);
  if (!message || !roomInfo) return;

  if (message.kind === "hello") {
    const name = String(message["name"] ?? "").trim() || "Someone";
    if (banned.includes(name)) return sendTo(from, { kind: "rejected", reason: `${name} is banned forever. Nice try.` });
    if (roomInfo.privacy === "private" && String(message["code"] ?? "").trim() !== roomInfo.code) {
      return sendTo(from, { kind: "rejected", reason: "Wrong code." });
    }
    if (roundView) return sendTo(from, { kind: "rejected", reason: "They're in the middle of a round. Try again after." });
    if (seats.has(name) && seats.get(name) !== from) {
      return sendTo(from, { kind: "rejected", reason: `Somebody in there is already called ${name}.` });
    }
    seats.set(name, from);
    players = [...seats.keys()];
    sendTo(from, { kind: "welcome" });
    broadcastState();
    return;
  }

  if (message.kind === "clip") {
    if (!roundView || roundView.phase !== "recording") return;
    const current = roundView.order[roundView.index];
    const data = toArrayBuffer(message["data"]);
    if (!current || seats.get(current) !== from || !data) return;
    roundView.index += 1;
    // The last person in the chain types their answer instead of recording.
    roundView.phase = roundView.index === roundView.order.length - 1 ? "typing" : "recording";
    const next = roundView.order[roundView.index];
    // Only the next person in line ever hears it.
    if (next) sendTo(seats.get(next) ?? "", { kind: "clip", data });
    broadcastState();
    return;
  }

  if (message.kind === "guess") {
    if (!roundView || roundView.phase !== "typing") return;
    const last = roundView.order[roundView.order.length - 1];
    if (!last || seats.get(last) !== from) return;
    roundView.guess = String(message["text"] ?? "").trim();
    roundView.phase = "judging";
    const judge = roundView.order[0];
    // The judge needs the real word in front of them to rule on it.
    if (judge) sendTo(seats.get(judge) ?? "", { kind: "secret", word: secretWord });
    broadcastState();
    return;
  }

  if (message.kind === "judge") {
    if (!roundView || roundView.phase !== "judging") return;
    const judge = roundView.order[0];
    if (!judge || seats.get(judge) !== from) return;
    const saidCorrect = message["verdict"] === "correct";
    const reallyCorrect = sameAnswer(roundView.guess, secretWord);
    roundView.phase = "done";
    if (saidCorrect === reallyCorrect) {
      roundView.result = reallyCorrect
        ? `It really was "${secretWord}". Everybody wins!`
        : `It was "${secretWord}", not "${roundView.guess}". Everybody loses.`;
    } else {
      // Oscar's rule: the one who lies about it is the one who is out forever.
      if (!banned.includes(judge)) banned.push(judge);
      saveNames(BANNED_KEY, banned);
      seats.delete(judge);
      players = [...seats.keys()];
      roundView.result = `It was "${secretWord}" and the guess was "${roundView.guess}". ${judge} lied about it and is banned forever.`;
    }
    broadcastState();
  }
}

startRoundButton?.addEventListener("click", () => {
  if (!isHost || !roomInfo || roundView || players.length < PLAYERS_NEEDED) return;
  // Shuffled, so whoever goes first is nobody's choice.
  const order = shuffle(players);
  secretWord = pickWord(roomInfo.difficulty, roomInfo.mode);
  roundView = { order, index: 0, phase: "recording", guess: "", result: "" };
  const starter = order[0];
  if (starter) sendTo(seats.get(starter) ?? "", { kind: "secret", word: secretWord });
  broadcastState();
});

endRound?.addEventListener("click", () => {
  if (!isHost) return;
  roundView = null;
  broadcastState();
});

function sendTo(route: string, message: Message): void {
  if (route === SELF) handleFromHost(message);
  else link?.send(route, message);
}

function broadcastState(): void {
  link?.send("*", { kind: "state", room: roomInfo, players, banned, round: roundView });
  if (!roundView) clearMyRoundSecrets();
  render();
}

// --- guest side (and the host's own copy of targeted messages) --------------

function handleFromHost(value: unknown): void {
  const message = readMessage(value);
  if (!message) return;

  if (message.kind === "welcome") {
    netStatus = "You're in.";
    render();
    return;
  }
  if (message.kind === "rejected") {
    const reason = String(message["reason"] ?? "They wouldn't let you in.");
    leaveRoom(false);
    netStatus = reason;
    render();
    return;
  }
  if (message.kind === "state") {
    const room = message["room"] as RoomInfo | null;
    roomInfo = room ?? null;
    players = Array.isArray(message["players"]) ? message["players"].map(String) : [];
    banned = Array.isArray(message["banned"]) ? message["banned"].map(String) : [];
    const round = (message["round"] ?? null) as RoundView | null;
    if (!round) clearMyRoundSecrets();
    roundView = round;
    render();
    return;
  }
  if (message.kind === "secret") {
    myWord = String(message["word"] ?? "");
    render();
    return;
  }
  if (message.kind === "clip") {
    const data = toArrayBuffer(message["data"]);
    if (!data) return;
    if (myClipUrl) URL.revokeObjectURL(myClipUrl);
    myClipUrl = URL.createObjectURL(new Blob([data], { type: "audio/webm" }));
    render();
  }
}

function sendToHost(message: Message): void {
  if (isHost) handleHostMessage(SELF, message);
  else link?.send("", message);
}

// --- taking your turn ------------------------------------------------------

micButton?.addEventListener("click", () => void toggleRecording());

async function toggleRecording(): Promise<void> {
  if (!(micButton instanceof HTMLButtonElement)) return;
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  const stream = await ensureMicStream();
  if (!stream) {
    setNetStatus("No microphone, no whispering. Let the browser use it first.");
    return;
  }
  recordedChunks = [];
  recorder = new MediaRecorder(stream);
  recorder.addEventListener("dataavailable", (event) => recordedChunks.push(event.data));
  recorder.addEventListener("stop", () => {
    pendingClip = new Blob(recordedChunks, { type: "audio/webm" });
    micButton.setAttribute("aria-pressed", "false");
    micButton.textContent = "🎤";
    render();
  });
  recorder.start();
  micButton.setAttribute("aria-pressed", "true");
  micButton.textContent = "◼";
}

async function ensureMicStream(): Promise<MediaStream | null> {
  if (micStream) return micStream;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    micStream = null;
  }
  return micStream;
}

sendTurn?.addEventListener("click", () => void sendMyTurn());

async function sendMyTurn(): Promise<void> {
  if (!roundView) return;
  if (roundView.phase === "typing") {
    sendToHost({ kind: "guess", text: finalGuess instanceof HTMLInputElement ? finalGuess.value.trim() : "" });
    return;
  }
  if (!pendingClip) return;
  const data = await pendingClip.arrayBuffer();
  pendingClip = undefined;
  sendToHost({ kind: "clip", data });
}

judgeRow?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-judge]");
  if (!button) return;
  sendToHost({ kind: "judge", verdict: button.dataset["judge"] });
});

function clearMyRoundSecrets(): void {
  if (myClipUrl) URL.revokeObjectURL(myClipUrl);
  myClipUrl = "";
  myWord = "";
  pendingClip = undefined;
  if (finalGuess instanceof HTMLInputElement) finalGuess.value = "";
}

function endRoundLocally(): void {
  clearMyRoundSecrets();
  for (const track of micStream?.getTracks() ?? []) track.stop();
  micStream = null;
  recorder = null;
}

// --- drawing ---------------------------------------------------------------

function render(): void {
  const micAnswered = Boolean(micStatus && !micStatus.textContent?.startsWith("Asking"));
  const inRoom = roomInfo !== null;
  if (createPanel) createPanel.hidden = !micAnswered || inRoom;
  if (joinPanel) joinPanel.hidden = !micAnswered || inRoom;
  if (joinLine && netStatus && !inRoom) joinLine.textContent = netStatus;

  setToggle("create-privacy", createPrivacy);
  setToggle("create-mode", createMode);
  if (createCodeRow) createCodeRow.hidden = createPrivacy !== "private";
  // A private room without its code would lock everyone out, so the browser
  // asks for one before the form will submit.
  if (createCode instanceof HTMLInputElement) createCode.required = createPrivacy === "private";

  if (roomPanel) roomPanel.hidden = !inRoom || roundView !== null;
  if (playersPanel) playersPanel.hidden = !inRoom || roundView !== null;
  renderRound();
  if (!roomInfo) return;

  setToggle("room-privacy", roomInfo.privacy);
  setToggle("room-mode", roomInfo.mode);
  if (roomName) roomName.textContent = roomInfo.name;
  if (roomLine) roomLine.textContent = netStatus || describeRoom(roomInfo);
  if (roomCodeRow) roomCodeRow.hidden = roomInfo.privacy !== "private";
  if (roomCode instanceof HTMLInputElement && roomCode.value !== roomInfo.code) roomCode.value = roomInfo.code;
  if (roomDifficulty instanceof HTMLSelectElement) roomDifficulty.value = roomInfo.difficulty;
  // Only the host gets to change the deal; guests just see it.
  for (const control of [roomCode, roomDifficulty]) {
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.disabled = !isHost;
  }
  for (const id of ["room-privacy", "room-mode"]) {
    for (const button of document.getElementById(id)?.querySelectorAll("button") ?? []) button.disabled = !isHost;
  }
  if (closeRoom) closeRoom.hidden = !isHost;
  if (leaveRoomButton) leaveRoomButton.hidden = isHost;

  if (playersLine) {
    const missing = PLAYERS_NEEDED - players.length;
    playersLine.textContent = missing > 0
      ? `${missing} more ${missing === 1 ? "person" : "people"} needed to start a whisper.`
      : "Enough people. Let's whisper.";
  }
  if (playersList) {
    playersList.replaceChildren();
    for (const name of players) {
      const item = document.createElement("li");
      item.textContent = name === me ? `${name} (you)` : name;
      playersList.append(item);
    }
  }
  if (bannedLine) {
    bannedLine.hidden = banned.length === 0;
    bannedLine.textContent = `Banned forever for lying: ${banned.join(", ")}`;
  }
  if (startRoundButton) startRoundButton.hidden = !isHost || players.length < PLAYERS_NEEDED || roundView !== null;
}

function renderRound(): void {
  if (roundPanel) roundPanel.hidden = roundView === null;
  if (!roundView) return;

  const current = roundView.order[roundView.index] ?? "";
  const judge = roundView.order[0] ?? "";
  const isMyTurn = current === me;
  const judging = roundView.phase === "judging";
  const done = roundView.phase === "done";
  const myJudgement = judging && judge === me;

  if (turnTitle) turnTitle.textContent = done ? "That's the round" : judging ? `${judge} is judging` : `${current}'s turn`;
  if (turnLine) {
    turnLine.textContent = done
      ? ""
      : myJudgement
        ? `They ended up with "${roundView.guess}". Was that it?`
        : judging
          ? `Waiting for ${judge} to rule on "${roundView.guess}".`
          : !isMyTurn
            ? `Waiting for ${current}. No peeking.`
            : roundView.index === 0
              ? "Hold the mic button and say the word."
              : roundView.index === roundView.order.length - 1
                ? "Listen, then type what you think it was."
                : "Listen, then say what you think you heard.";
  }

  // The word only ever reaches the person who starts and the person judging.
  if (roundWord) {
    roundWord.hidden = !myWord || !(isMyTurn || myJudgement);
    roundWord.textContent = myWord;
  }

  if (previousClip instanceof HTMLAudioElement) {
    previousClip.hidden = !myClipUrl || !isMyTurn;
    if (myClipUrl && previousClip.src !== myClipUrl) previousClip.src = myClipUrl;
  }

  if (micButton) micButton.hidden = !(isMyTurn && roundView.phase === "recording");
  if (guessRow) guessRow.hidden = !(isMyTurn && roundView.phase === "typing");
  if (judgeRow) judgeRow.hidden = !myJudgement;
  if (roundResult) {
    roundResult.hidden = !done;
    roundResult.textContent = roundView.result;
  }
  if (endRound) endRound.hidden = !done || !isHost;
  if (sendTurn instanceof HTMLButtonElement) {
    sendTurn.hidden = !isMyTurn || judging || done;
    sendTurn.disabled = roundView.phase === "recording" && pendingClip === undefined;
  }
}

function describeRoom(current: RoomInfo): string {
  if (current.privacy === "public") return "Public room. Anyone who knows the name can walk in.";
  return current.code
    ? `Private room. The code is ${current.code}.`
    : "Private room. Pick a code or nobody can get in.";
}

// --- odds and ends ---------------------------------------------------------

function wireToggle(id: string, onPick: (choice: string) => void): void {
  document.getElementById(id)?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (button) onPick(button.dataset["choice"] ?? "");
  });
}

function setToggle(id: string, choice: string): void {
  const group = document.getElementById(id);
  for (const button of group?.querySelectorAll<HTMLButtonElement>("[data-choice]") ?? []) {
    button.setAttribute("aria-pressed", String(button.dataset["choice"] === choice));
  }
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

function readDifficulty(select: HTMLElement | null): Difficulty {
  const value = select instanceof HTMLSelectElement ? select.value : "";
  return isDifficulty(value) ? value : "Normal";
}

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as string[]).includes(value);
}

function readName(input: HTMLElement | null, fallback: string): string {
  const value = input instanceof HTMLInputElement ? input.value.trim() : "";
  return value || fallback;
}

function readMessage(value: unknown): Message | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Message;
  return typeof message.kind === "string" ? message : null;
}

// Peer sends binary as a view over a buffer; the channel sends it whole.
function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return null;
}

// Spelling and punctuation don't decide it; the word does.
function sameAnswer(a: string, b: string): boolean {
  const tidy = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return tidy(a) === tidy(b) && tidy(a).length > 0;
}

// "All" pools every level, so an Auto word and an Extreme Demon word are
// equally likely to land on you.
function pickWord(difficulty: Difficulty, mode: Mode): string {
  const pool = difficulty === "All"
    ? LEVEL_NAMES.flatMap((level) => [...LEVELS[level][mode]])
    : [...LEVELS[difficulty][mode]];
  return pool[Math.floor(Math.random() * pool.length)] ?? "";
}

function shuffle(names: string[]): string[] {
  const copy = [...names];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = copy[index] as string;
    copy[index] = copy[swap] as string;
    copy[swap] = held;
  }
  return copy;
}

function saveHostedRoom(): void {
  if (!isHost || !roomInfo) return;
  localStorage.setItem(ROOM_KEY, JSON.stringify({ ...roomInfo, host: me }));
}

function restoreHostedRoom(): void {
  const raw = localStorage.getItem(ROOM_KEY);
  if (!raw) return;
  try {
    const saved = JSON.parse(raw) as Partial<RoomInfo> & { host?: string };
    if (typeof saved.name !== "string" || typeof saved.host !== "string") return;
    startHosting({
      name: saved.name,
      privacy: saved.privacy === "private" ? "private" : "public",
      code: typeof saved.code === "string" ? saved.code : "",
      difficulty: typeof saved.difficulty === "string" && isDifficulty(saved.difficulty) ? saved.difficulty : "Normal",
      mode: saved.mode === "phrases" ? "phrases" : "words",
    }, saved.host);
  } catch {
    localStorage.removeItem(ROOM_KEY);
  }
}

function loadNames(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveNames(key: string, names: string[]): void {
  localStorage.setItem(key, JSON.stringify(names));
}

render();
