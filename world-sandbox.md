# World Sandbox

A game on the Games 4 hub. The full version is built. This note has everything decided so far.

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

- **Everything is pixel art.** The world is a 320 × 200 pixel map blown up to fill the screen, and every tree, animal, person, wave, flame, and icon is drawn on that same pixel grid. No emoji, no smooth shapes. The toolbar uses a pixel font too.
- **You choose what you add.** Every category has its own list to pick from. Nothing is picked at random for you.
- **View: top-down map.** You look down from space at land and ocean. Caves open in their own view when you click a mountain.
- **Where things go:** land things go on land, sea creatures and tsunamis go in water, and flying things go anywhere. Land animals stay on land, sea creatures stay in water.
- **Your world is saved** (land, brush strokes, things, tribes, people, and caves). **New World** makes a different map and clears everything. The Matrix switches are not saved.

## The toolbar

- **Land:** oak tree, pine tree, palm tree, bush, flowers, rock, hill, mountain. **Raise Land** and **Sink Land** are brushes: drag them to make new islands or sink land into the sea.
- **Life:** sheep, cow, pig, chicken, rabbit, fox, wolf, bear, deer, horse, elephant, giraffe, lion (land); fish, shark, whale, dolphin, octopus, turtle, crab, jellyfish (sea); bird, butterfly, bat (fly anywhere).
- **People:** pick a tribe (or No Tribe), click the land, and name the person and pick their traits. Click a person later to change them, or point at one to see who they are.
  - **Brave:** charges at enemies from further away.
  - **Strong:** hits harder and takes more hits.
  - **Fast:** moves twice as fast.
  - **Peaceful:** never starts a fight.
  - **Explorer:** wanders far from home.
  - **Builder:** sometimes builds a new village.
  - **Healer:** heals hurt people from their tribe.
- **Tribes:** **New Tribe** picks a name and colour. Click the land to build that tribe's villages. **Edit Tribe and Wars** picks who they're at war with (war goes both ways).
  - Every village sometimes grows a new person, up to 6 people per village.
  - People from tribes at war hunt each other down and burn each other's villages.
  - People only walk in straight lines, so they won't chase an enemy across water.
- **Caves:** click a mountain to go inside. The mountain gets a dark doorway once it has a cave.
  - **Dig** makes tunnels and **Rock** fills them in.
  - Coal, iron, gold, diamond, emerald, amethyst, diorite, calcite, and rainbow crystal go in the rock walls. Rainbow crystal's colours ripple.
  - Lava and water go in the tunnels.
- **Disasters:**
  - **Volcano:** smokes and glows.
  - **Tsunami:** a ring of foam that rolls out over the water and a little way onto land. It washes away plants, animals, and people near the shore. Hills, mountains, rocks, volcanoes, villages, sea creatures, and flyers survive it. An island in the way blocks it.
- **Creatures:**
  - **Dragon:** burns plants, animals, and people near it.
  - **Unicorn:** leaves a rainbow trail.
  - **Phoenix:** leaves a fire trail.
  - **Kraken:** eats sea creatures.
  - **Griffin, yeti, and sea serpent:** just roam.
  - Creatures never attack each other.
- **Celestial:** star, moon, and void beings teleport around. Wherever they land, they turn something into something else, teleport something away, or summon a tsunami.
- **Matrix:** **Copy** duplicates whatever you click. The switches break physics:
  - **The Matrix:** turns everything into green code.
  - **Freeze Time** and **Fast Time:** stop time, or make it go five times as fast.
  - **No Walls:** anything can go anywhere.
  - **No Gravity:** everything floats up off the map and comes back at the bottom.

## Still to decide

- Should volcanoes erupt and do something?
- Should there be an eraser for single things? (People can already be removed from their panel.)
- What happens to trees and animals when you sink the land under them? Right now they stay put, and animals get stuck.
- Should people find a way around lakes to reach enemies?

## How you unlock it

1. **Switch:** in Zero Logic Escape Rooms, the three bonus levels give three switch pieces. Build the switch on the Games 4 hub, then flip it to Hundred Logic Escape Rooms.
2. **Earth Fragments:** Hundred Logic Escape Rooms has four secret bonus levels, and each gives one Earth Fragment (a quarter of the Earth):
   1. **Mirror maze:** break the mirror in The Room With Nothing with the pickaxe.
   2. **Tool Wall:** scrape the paint off the hidden door in Workbench with plywood, then open it with the wrench.
   3. **Comic box:** open the drawer in Comical a second time, use the shrinker machine, and climb into the comic box.
   4. **Number pool:** use the door key on the secret keyhole in the Chalkboard's chalkboard.
3. **Put the Earth together:** back on the Games 4 hub with all four fragments, you put the Earth together. That unlocks World Sandbox, and its card on the hub becomes a link.

## What's in the code

All in `src/games4/world-sandbox/`:

- **World:**
  - `world.ts`: map size, making land from a seed, land brushes, and where tsunamis reach.
  - `state.ts`: everything in the world right now, plus saving and loading (localStorage key `world-sandbox-world`).
- **Pixel art:**
  - `sprites.ts`: the palette and how letter-grid art becomes sprites.
  - `land.ts`, `life.ts`, `folk.ts`, `creatures.ts`, `ores.ts`, `matrix.ts`: the pixel art for each category.
  - `catalog.ts`: the toolbar categories.
- **What things do:**
  - `nature.ts`: wandering, tsunamis, creatures, and celestial chaos.
  - `people.ts`: tribes, villages, people, traits, and fighting.
  - `caves.ts`: cave rock, tunnels, ores, and saving caves as text.
  - `matrix.ts`: the physics switches and the green code view.
- **Screen:**
  - `draw.ts`: draws the world and caves.
  - `main.ts`: the toolbar, clicking, the pop-up panels, and the game loop.
- **Tests:** `world.test.ts` and `caves.test.ts`. Run them with `npm test`.
