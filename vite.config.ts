import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        menu: resolve(__dirname, "src/index.html"),
        games2: resolve(__dirname, "src/games2/index.html"),
        mods: resolve(__dirname, "src/mods/index.html"),
        drawingBossMania: resolve(__dirname, "src/games2/drawing-boss-mania/index.html"),
        stickmanFight: resolve(__dirname, "src/games2/stickman-fight/index.html"),
        aHardEasyGame: resolve(__dirname, "src/games/a-hard-easy-game/index.html"),
        oscarsUntitledMazeGame: resolve(
          __dirname,
          "src/games/oscars-untitled-maze-game/index.html"
        ),
        aKidsLife: resolve(__dirname, "src/games/a-kids-life/index.html"),
        tamagotchiMonster: resolve(__dirname, "src/games/tamagotchi-monster/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
