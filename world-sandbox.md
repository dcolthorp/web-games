# World Sandbox

A game on the Games 4 hub. It isn't built yet. This note has everything decided so far.

## What it is

A create-your-own-world sandbox. In the designer's words: "The possibilities are endless."

- **Life:** spawn life forms, any type.
- **Land:** add trees, hills, mountains, anything.
- **Disasters:** add volcanoes and tsunamis. Tsunamis can only be placed in water.
- **Caves:** add caves and fill them with any mineral or ore, for example:
  - diamonds, gold, diorite, calcite, emerald
  - the beautiful rainbow crystal from the book *Planet Earth*
- **Tribes:** create tribes, and make tribes fight against each other.
- **People:** create people, name them, and give them traits.
- **Celestial beings:** they go around causing chaos and teleporting.
- **Creatures:** dragons and other mythical creatures.
- **The matrix:** you can break physics and go into the matrix.

## Decisions made

- **View: top-down map.** You look down from space at a map of land and ocean, which makes it easy to see lots of tribes and villages spread out. Caves open in their own zoomed-in view when you click a mountain. (Side view was the other option; top-down was chosen.)

## How you unlock it

1. **Switch:** in Zero Logic Escape Rooms, the three bonus levels give three switch pieces. Build the switch on the Games 4 hub, then flip it to Hundred Logic Escape Rooms.
2. **Earth Fragments:** Hundred Logic Escape Rooms has four secret bonus levels, and each gives one Earth Fragment (a quarter of the Earth):
   1. **Mirror maze:** break the mirror in The Room With Nothing with the pickaxe.
   2. **Tool Wall:** scrape the paint off the hidden door in Workbench with plywood, then open it with the wrench.
   3. **Comic box:** open the drawer in Comical a second time, use the shrinker machine, and climb into the comic box.
   4. **Number pool:** use the door key on the secret keyhole in the Chalkboard's chalkboard.
3. **Put the Earth together:** back on the Games 4 hub with all four fragments, you put the Earth together. That unlocks World Sandbox.

## What's already in the code

- **`src/games4/earthAssembly.ts`:** the Put the Earth Together screen, plus `hasAllEarthFragments()` and `earthIsBuilt()`.
- **localStorage keys:** `zero-logic-escape-rooms-earth-fragment-1` … `-4` for the fragments, and `zero-logic-escape-rooms-earth-built` once the Earth is put together.
- **`src/games4/main.ts`:** `WORLD_SANDBOX_CARD` is a "Coming soon" card that only shows up when `earthIsBuilt()` is true. It isn't a link yet.
- **`src/styles/main.css`:** the `.is-coming-soon` card style.

## Plan for building it

- **Files:** put the game in `src/games4/world-sandbox/` (`index.html`, `main.ts`, `styles.css`), like the other Games 4 games. Add it to `vite.config.ts` under `build.rollupOptions.input`.
- **Hub card:** turn the World Sandbox card into a real link to the game, still only when `earthIsBuilt()`.
- **Tech:** Canvas 2D, no game engine, same as the rest of the repo.
- **First version:**
  - a top-down world map of ocean and land
  - a toolbar of things to place: trees, hills, mountains, volcanoes, tsunamis (water only), and life forms
- **Add after that:**
  - caves with ores (a zoomed-in view from a mountain)
  - tribes and fighting
  - named people with traits
  - dragons and mythical creatures
  - celestial beings
  - breaking physics and going into the matrix
