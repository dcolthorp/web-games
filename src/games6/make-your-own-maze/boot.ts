import { keepSaveFile, restoreSaveFile } from "../../shared/saveFile";

// Get the saves back from saves/make-your-own-maze.json before the game reads
// them, then start the game and keep the file up to date.
const NAME = "make-your-own-maze";
const PREFIX = "make-your-own-maze:";

void restoreSaveFile(NAME, PREFIX).then(async () => {
  await import("./main");
  keepSaveFile(NAME, PREFIX);
});
