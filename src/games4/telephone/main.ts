import { installOofShortcut } from "../../shared/oofShortcut";

installOofShortcut();

type Privacy = "public" | "private";

interface Room {
  name: string;
  privacy: Privacy;
  code: string;
}

const ROOM_KEY = "telephone-room";

const micStatus = document.getElementById("mic-status");
const micRetry = document.getElementById("mic-retry");
const createPanel = document.getElementById("create-panel");
const createForm = document.getElementById("create-form");
const groupName = document.getElementById("group-name");
const createCode = document.getElementById("create-code");
const createCodeRow = document.getElementById("create-code-row");
const roomPanel = document.getElementById("room-panel");
const roomName = document.getElementById("room-name");
const roomLine = document.getElementById("room-line");
const roomCode = document.getElementById("room-code");
const roomCodeRow = document.getElementById("room-code-row");
const closeRoom = document.getElementById("close-room");

let createPrivacy: Privacy = "public";
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

wirePrivacyToggle("create-privacy", (privacy) => {
  createPrivacy = privacy;
  render();
  if (privacy === "private" && createCode instanceof HTMLInputElement) createCode.focus();
});

wirePrivacyToggle("room-privacy", (privacy) => {
  if (!room) return;
  room = { ...room, privacy };
  saveRoom(room);
  render();
  if (privacy === "private" && roomCode instanceof HTMLInputElement) roomCode.focus();
});

createForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!(groupName instanceof HTMLInputElement) || !(createCode instanceof HTMLInputElement)) return;
  room = {
    name: groupName.value.trim() || "Untitled Group",
    privacy: createPrivacy,
    code: createPrivacy === "private" ? createCode.value.trim() : "",
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

function wirePrivacyToggle(id: string, onPick: (privacy: Privacy) => void): void {
  const group = document.getElementById(id);
  group?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-privacy]");
    if (!button) return;
    onPick(button.dataset["privacy"] === "private" ? "private" : "public");
  });
}

function render(): void {
  const micAnswered = Boolean(micStatus && !micStatus.textContent?.startsWith("Asking"));
  if (createPanel) createPanel.hidden = !micAnswered || room !== null;
  if (roomPanel) roomPanel.hidden = room === null;

  setToggle("create-privacy", createPrivacy);
  if (createCodeRow) createCodeRow.hidden = createPrivacy !== "private";
  // A private room without its code would lock everyone out, so the browser
  // asks for one before the form will submit.
  if (createCode instanceof HTMLInputElement) createCode.required = createPrivacy === "private";

  if (!room) return;
  setToggle("room-privacy", room.privacy);
  if (roomName) roomName.textContent = room.name;
  if (roomLine) roomLine.textContent = describeRoom(room);
  if (roomCodeRow) roomCodeRow.hidden = room.privacy !== "private";
  if (roomCode instanceof HTMLInputElement && roomCode.value !== room.code) roomCode.value = room.code;
}

function describeRoom(current: Room): string {
  if (current.privacy === "public") return "Public room. Anyone can walk in.";
  return current.code
    ? `Private room. The code is ${current.code}.`
    : "Private room. Pick a code or nobody can get in.";
}

function setToggle(id: string, privacy: Privacy): void {
  const group = document.getElementById(id);
  for (const button of group?.querySelectorAll<HTMLButtonElement>("[data-privacy]") ?? []) {
    button.setAttribute("aria-pressed", String(button.dataset["privacy"] === privacy));
  }
}

function loadRoom(): Room | null {
  const raw = localStorage.getItem(ROOM_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Room>;
    if (typeof parsed.name !== "string") return null;
    return {
      name: parsed.name,
      privacy: parsed.privacy === "private" ? "private" : "public",
      code: typeof parsed.code === "string" ? parsed.code : "",
    };
  } catch {
    return null;
  }
}

function saveRoom(current: Room): void {
  localStorage.setItem(ROOM_KEY, JSON.stringify(current));
}

render();
