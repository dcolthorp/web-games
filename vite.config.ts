import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    {
      name: "dom-gallery-everywhere",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace("</body>", '  <script type="module" src="/shared/domGallery.ts"></script>\n  </body>');
        },
      },
    },
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
        games4: resolve(__dirname, "src/games4/index.html"),
        makeYourOwnBeatboxerThingy: resolve(
          __dirname,
          "src/games3/make-your-own-beatboxer-thingy/index.html"
        ),
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
        clairsGame: resolve(__dirname, "src/games3/clairs-game/index.html"),
        holdensGame: resolve(__dirname, "src/games3/holdens-game/index.html"),
        holdensGameActual: resolve(__dirname, "src/games3/holdens-game/game.html"),
        holdensShop: resolve(__dirname, "src/games3/holdens-game/shop.html"),
        holdensWorld0: resolve(__dirname, "src/games3/holdens-game/world-0.html"),
        holdensWorldMinus1: resolve(__dirname, "src/games3/holdens-game/world--1.html"),
        holdensWorld1: resolve(__dirname, "src/games3/holdens-game/world-1.html"),
        holdensWorld2: resolve(__dirname, "src/games3/holdens-game/world-2.html"),
        holdensWorld3: resolve(__dirname, "src/games3/holdens-game/world-3.html"),
        holdensWorld4: resolve(__dirname, "src/games3/holdens-game/world-4.html"),
        holdensWorld5: resolve(__dirname, "src/games3/holdens-game/world-5.html"),
        holdensWorld6: resolve(__dirname, "src/games3/holdens-game/world-6.html"),
        holdensWorld7: resolve(__dirname, "src/games3/holdens-game/world-7.html"),
        holdensWorld8: resolve(__dirname, "src/games3/holdens-game/world-8.html"),
        holdensWorld9: resolve(__dirname, "src/games3/holdens-game/world-9.html"),
        holdensWorld10: resolve(__dirname, "src/games3/holdens-game/world-10.html"),
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
