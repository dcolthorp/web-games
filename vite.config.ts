import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    {
      name: "sharks-multiplayer-rooms",
      configureServer(server) {
        server.ws.on("sharks:room-message", (data: unknown) => {
          server.ws.send("sharks:room-message", data);
        });
      },
    },
  ],
  root: "src",
  base: "./",
  server: {
    host: true,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        menu: resolve(__dirname, "src/index.html"),
        penelope: resolve(__dirname, "src/penelope/index.html"),
        penelopeNested: resolve(__dirname, "src/games/penelope/index.html"),
        games2: resolve(__dirname, "src/games2/index.html"),
        games3: resolve(__dirname, "src/games3/index.html"),
        mods: resolve(__dirname, "src/mods/index.html"),
        corruptedGames: resolve(__dirname, "src/corrupted-games/index.html"),
        bioTech: resolve(__dirname, "src/corrupted-games/bio-tech/index.html"),
        drawingBossMania: resolve(__dirname, "src/games2/drawing-boss-mania/index.html"),
        stickmanFight: resolve(__dirname, "src/games2/stickman-fight/index.html"),
        aHardEasyGame: resolve(__dirname, "src/games/a-hard-easy-game/index.html"),
        catMath: resolve(__dirname, "src/games/cat-math/index.html"),
        oscarsUntitledMazeGame: resolve(
          __dirname,
          "src/games/oscars-untitled-maze-game/index.html"
        ),
        aKidsLife: resolve(__dirname, "src/games/a-kids-life/index.html"),
        tamagotchiMonster: resolve(__dirname, "src/games/tamagotchi-monster/index.html"),
        theSettingsGame: resolve(__dirname, "src/games/the-settings-game/index.html"),
        feedYourFire: resolve(__dirname, "src/games2/feed-your-fire/index.html"),
        sharksInTheWater: resolve(__dirname, "src/games3/sharks-in-the-water/index.html"),
        zeroPlayerGame: resolve(__dirname, "src/games3/zero-player-game/index.html"),
        gameTime: resolve(__dirname, "src/games3/game-time/index.html"),
        totallyNotGeometryDash: resolve(
          __dirname,
          "src/games3/totally-not-a-geometry-dash-rip-off/index.html"
        ),
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
