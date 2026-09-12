# World Sandbox

A game on the Games 4 hub. The first version is built. This note has everything decided so far.

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
- **Land things go on land.** Trees, hills, mountains, and volcanoes can only be placed on land. Tsunamis can only be placed in water.
- **Life fits where you put it.** Click land and you get a land animal (sheep, cow, rabbit, fox, elephant, giraffe, pig, or deer). Click water and you get a sea creature (fish, octopus, whale, turtle, crab, or dolphin). They wander around and stay on their own kind of ground.
- **Tsunamis roll out from where you click.** The wave spreads out in a ring over the water and pushes a little way up onto the land. It washes away trees and land animals near the shore. Hills, mountains, volcanoes, and sea creatures stay. A big island in the way blocks the wave.
- **Your world is saved.** It's still there when you come back. **New World** makes a different map and clears everything off it.

## Still to decide

- Can you erase one thing without making a whole new world?
- Should volcanoes erupt and do something, or just smoke?
- Can you paint new land into the ocean, or dig water into the land?

## How you unlock it

1. **Switch:** in Zero Logic Escape Rooms, the three bonus levels give three switch pieces. Build the switch on the Games 4 hub, then flip it to Hundred Logic Escape Rooms.
2. **Earth Fragments:** Hundred Logic Escape Rooms has four secret bonus levels, and each gives one Earth Fragment (a quarter of the Earth):
   1. **Mirror maze:** break the mirror in The Room With Nothing with the pickaxe.
   2. **Tool Wall:** scrape the paint off the hidden door in Workbench with plywood, then open it with the wrench.
   3. **Comic box:** open the drawer in Comical a second time, use the shrinker machine, and climb into the comic box.
   4. **Number pool:** use the door key on the secret keyhole in the Chalkboard's chalkboard.
3. **Put the Earth together:** back on the Games 4 hub with all four fragments, you put the Earth together. That unlocks World Sandbox.

## What's in the code

- **`src/games4/world-sandbox/`:** the game (Canvas 2D, no game engine).
  - `world.ts` makes the land and sea from a seed number, and works out where a tsunami can reach.
  - `world.test.ts` checks those. Run it with `npm test`.
  - `main.ts` has the toolbar, placing things, wandering animals, tsunamis, drawing, and saving.
- **`src/games4/earthAssembly.ts`:** the Put the Earth Together screen, plus `hasAllEarthFragments()` and `earthIsBuilt()`.
- **`src/games4/main.ts`:** `WORLD_SANDBOX_CARD` links to the game. It only shows up when `earthIsBuilt()` is true.
- **localStorage keys:**
  - `zero-logic-escape-rooms-earth-fragment-1` … `-4` for the fragments
  - `zero-logic-escape-rooms-earth-built` once the Earth is put together
  - `world-sandbox-world` for the saved world: its seed and everything placed on it

## Plan

- **Done, first version:**
  - a top-down world map of ocean and land
  - a toolbar of things to place: trees, hills, mountains, volcanoes, tsunamis (water only), and life forms
- **Add next:**
  - caves with ores (a zoomed-in view from a mountain)
  - tribes and fighting
  - named people with traits
  - dragons and mythical creatures
  - celestial beings
  - breaking physics and going into the matrix
