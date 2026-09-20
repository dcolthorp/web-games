// The line of words under the game: "There is no door. There is no window.
// There is no logic. Click things." In Escape Room 4 it means it. Go near the
// door and a hand comes up out of that sentence and throws the door off the
// screen, and the word "door" is very pleased with itself every time.
//
// Which is the way out: take the word off the page and the sentence has
// nothing left to enforce.

const SENTENCE = "There is no door. There is no window. There is no logic. Click things.";

let line: HTMLElement | null = null;
let word: HTMLElement | null = null;
let gone = false;
let onGone: (() => void) | null = null;

function find(): HTMLElement | null {
  line ??= document.querySelector<HTMLElement>(".instructions");
  return line;
}

/** Puts the word "door" in a span of its own so it can be picked on. */
export function armNoDoorLine(whenGone: () => void): void {
  const element = find();
  if (!element) return;
  onGone = whenGone;
  if (gone) return;
  element.innerHTML = SENTENCE.replace(
    "door",
    '<span class="the-word" id="the-word" role="button" tabindex="0" title="It is only a word.">door</span>'
  );
  word = document.getElementById("the-word");
  word?.addEventListener("click", knockWordOff);
  word?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") knockWordOff();
  });
}

/** The sentence goes back to being a sentence when you leave the room. */
export function resetNoDoorLine(): void {
  const element = find();
  if (!element) return;
  element.classList.remove("is-shaking");
  element.textContent = SENTENCE;
  word = null;
  gone = false;
}

export function wordIsGone(): boolean {
  return gone;
}

/** Called the moment the hand grabs a door: the sentence gloats. */
export function gloat(): void {
  const element = find();
  if (!element || gone) return;
  element.classList.remove("is-shaking");
  // Restarting the animation needs the class to actually leave first.
  void element.offsetWidth;
  element.classList.add("is-shaking");
  word?.classList.remove("is-smug");
  void word?.offsetWidth;
  word?.classList.add("is-smug");
}

function knockWordOff(): void {
  if (gone || !word) return;
  gone = true;
  word.classList.add("is-falling");
  const blank = document.createElement("span");
  blank.className = "the-blank";
  blank.textContent = "______";
  word.after(blank);
  window.setTimeout(() => word?.remove(), 700);
  onGone?.();
}
