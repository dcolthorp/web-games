// The words that go in the frames, kept away from the canvas so the room's
// one rule can be checked on its own.

export const WORDS = ["", "BLANK", "BLANKITY"] as const;
export type Word = (typeof WORDS)[number];

// What the room is called is also the answer. Nobody says so.
export const WANTED: Word[] = ["BLANK", "BLANK", "BLANKITY", "BLANK"];

export function nextWord(word: Word): Word {
  return WORDS[(WORDS.indexOf(word) + 1) % WORDS.length] ?? "";
}

export function frameIsRight(index: number, word: Word): boolean {
  return WANTED[index] === word;
}

export function phraseSolved(words: Word[]): boolean {
  return WANTED.every((wanted, index) => words[index] === wanted);
}

export function readPhrase(words: Word[]): string {
  const shown = words.map((word) => word || "______");
  return `${shown[0]}, ${shown[1]}, ${shown[2]} ${shown[3]}`;
}
