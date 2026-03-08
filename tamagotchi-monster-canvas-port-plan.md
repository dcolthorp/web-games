# Tamagotchi Monster (Canvas) Port Plan for `/Users/colthorp/Developer/games`

## Goal (What “Done” Means)
Build a **separate, new implementation** of the Tamagotchi game using **Browser HTML5 Canvas2D** (vanilla TS/JS under Vite) in the `games` repo, following its structure:

- Game lives under `src/games/tamagotchi-monster/` with its own `index.html` + `main.ts`.
- Game appears in the main menu (`src/main.ts`).
- Vite builds it as a multi-page entry (update `vite.config.ts`).
- Feature scope: **full parity with the existing pygame Tamagotchi** as reference behavior (scenes, NU11, monster index, glitch effects, persistence), but **no shared code/runtime**.
- Additive enhancement: **time-based hunger + dental decay**, and **eating also reduces dental health** (see “Time-Based Stat Decay”).

## Repo-Conforming Structure (Files to Add/Change)

### 1) New game folder
Create:
- `src/games/tamagotchi-monster/index.html`
- `src/games/tamagotchi-monster/main.ts`

Recommended internal module layout (keep it all inside this game folder):
- `src/games/tamagotchi-monster/app/GameApp.ts`
- `src/games/tamagotchi-monster/app/Scene.ts`
- `src/games/tamagotchi-monster/app/Input.ts`
- `src/games/tamagotchi-monster/app/Time.ts`
- `src/games/tamagotchi-monster/app/Renderer.ts` (canvas scaling + clear + letterbox)
- `src/games/tamagotchi-monster/constants.ts`
- `src/games/tamagotchi-monster/model/types.ts`
- `src/games/tamagotchi-monster/model/ProfileStore.ts` (localStorage)
- `src/games/tamagotchi-monster/model/MonsterIndexStore.ts` (localStorage)
- `src/games/tamagotchi-monster/systems/*` (growth/feeding/dental/play/medical/theme)
- `src/games/tamagotchi-monster/scenes/*` (one file per scene)
- `src/games/tamagotchi-monster/ui/*` (Button/IconButton/HUD)
- `src/games/tamagotchi-monster/graphics/*` (sprites/animations/particles/glitch/decorations)

### 2) Register game in menu
Edit:
- `src/main.ts` to add a new entry (title + route/link to the game page).

### 3) Ensure Vite builds the new page
Edit:
- `vite.config.ts` to add `src/games/tamagotchi-monster/index.html` to `build.rollupOptions.input`.
  - Include `src/index.html` as an input too so the main menu builds.

## Core Architecture (Decision-Complete)

### Canvas coordinate system + scaling
- Use a **fixed logical resolution** matching the pygame version: `800x600` for layout parity.
- Render into `<canvas>` with `devicePixelRatio` scaling.
- Fit to viewport with letterboxing so the game **fills the browser / fullscreen** while maintaining aspect ratio; all input coordinates are converted from screen pixels -> logical coordinates.

### Main loop
- Use `requestAnimationFrame`.
- Compute `dtSeconds` from timestamps.
- Call:
  1) `scene.update(dtSeconds)`
  2) `scene.render(ctx)`
- Scene transitions handled by `GameApp.setScene(nextScene)`.

### Scene interface (key signatures)
Create `src/games/tamagotchi-monster/app/Scene.ts`:

```ts
export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;

  onPointerMove?(x: number, y: number): void;
  onPointerDown?(x: number, y: number): void;
  onPointerUp?(x: number, y: number): void;

  onKeyDown?(e: KeyboardEvent): void;
}
```

### Shared game state (single source of truth)
`GameApp` owns:
- `profileStore` (localStorage)
- `monsterIndexStore` (localStorage)
- `currentProfileId` + loaded `Profile`
- `theme` derived from profile (including NU11 detection)
- `preIndexScene` (for returning after monster index)

Scenes receive dependencies via constructor parameters (no globals).

## Data Model + Persistence (localStorage)

### Enums / types (TS)
In `model/types.ts` define string unions or `enum`s:
- `GrowthStage` (include normal + NU11 stages)
- `ColorTheme` (include BLACK)
- `PlayOutcome` and `PetCondition`

Define:

```ts
export interface PetState {
  stage: GrowthStage;
  hunger: number;
  dentalHealth: number;
  carePoints: number;
  hatchProgress: number;
  condition: PetCondition;
  lastUpdatedAtMs: number; // for time-based decay + offline catch-up
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  colorTheme: ColorTheme;
  pet: PetState;
}
```

### Storage keys + versioning
- `tamagotchiMonster.version` = `1`
- `tamagotchiMonster.profiles` = array of `{id,name}`
- `tamagotchiMonster.profile.<id>` = full `Profile`
- `tamagotchiMonster.monsterIndex` = `{ discoveredStages: string[] }`

Add lightweight migration logic if version is missing/older (initialize empty).

### Preset profiles + NU11 trigger
- On first run, auto-create profiles `OSCAR`, `PENELOPE` if missing.
- Creating a profile named `NU11` (case-insensitive) sets `colorTheme = BLACK` and activates NU11 behavior across systems.

## Feature Parity Map (What to Port)

Implement the pygame Tamagotchi behaviors (reference) as these scenes:

1) `ProfileSelectScene`
- List profiles with a small pet preview (render sprite at stage).
- Create new profile.
- Open profile settings per profile.
- Select profile -> `MainGameScene`.

2) `MainGameScene`
- Draw background based on stage/theme (and transitions during evolution).
- Draw decorations behind pet.
- Draw pet sprite with idle bounce/blink/wobble, plus evolve scaling.
- HUD (hunger, dental, care points, stage text).
- Buttons:
  - Feed, Brush, Play (hidden when egg or evolving; Play hidden when condition blocks play).
  - Switch profile (always visible).
  - Conditional care buttons (Band-aid / Doctor / Dentist depending on `condition`).
- Egg interaction: clicking pet increments hatch progress; when hatched triggers evolution (NU11 adds glitch sequence + skips Baby).
- Global key: `i` opens Monster Index from Profile Select or Main Game.

3) `FeedingMenuScene` (overlay)
- Menu panel + buttons for foods based on stage/theme (NU11 uses horror foods).
- Hover info text.
- Selecting food calls `feedPet(...)` and closes.

4) `DentalCareScene`
- Canvas interaction representing brushing progress.
- On completion, calls `brushTeeth(...)`.

5) `PlayMenuScene` + `PlayActivityScene`
- Choose an activity by stage/theme.
- Activity runs an animation/timer, then returns `PlayOutcome`.
- Outcomes:
  - SUCCESS: award care points + happy particles
  - otherwise: set condition + require corresponding care scene

6) `BandAidScene`, `DoctorVisitScene`, `DentistVisitScene`
- Simple interaction to complete treatment and clear condition; awards care points / dental restore, then returns to main.

7) `ProfileSettingsScene` + `ResetConfirmScene` + `DeleteConfirmScene`
- Reset pet (keeps monster index global).
- Delete profile.

8) `MonsterIndexScene`
- List all stages ordered (normal then NU11).
- Show discovered/unknown states.
- Allow teleport to a discovered stage (sets current profile pet stage directly).
- Close returns to the prior scene.
- Include the pygame version’s easter eggs/secrets (skull/vent/dark-baby chain, NU11-specific surprises).

### Systems to implement (pure logic first)
In `systems/` replicate the rules from the pygame version:
- `theme.ts`: colors per stage + per theme, and helpers `isNu11Mode(theme)`
- `growth.ts`: thresholds + next-stage logic (normal and NU11 order)
- `feeding.ts`: foods list + “available foods” for stage/theme + apply feed
- `dental.ts`: brushing effect on dental health/care points
- `play.ts`: activities list per stage + weighted random outcome -> condition
- `medical.ts`: indicator/button text per condition + apply bandaid/doctor/dentist effects

Keep these modules **canvas-agnostic** (no DOM).

## Rendering Details (Canvas2D Replacements)

### Sprites + UI drawing
- Replace `pygame.draw.*` with Canvas primitives:
  - `ctx.fillRect`, `ctx.strokeRect`, `ctx.beginPath` + `arc`, `ellipse`, `lineTo`, etc.
- Implement `drawPet(ctx, stage, x, y, size, {blink,wobble,theme})`.
- Buttons use rect hit-testing; hover tracked via pointer move.

### Animations
Implement `AnimationController` similar to pygame:
- `current: "idle" | "eat" | "brush" | "happy" | "evolve" | ...`
- `t: number` timer
- Helpers:
  - `getBounceOffset()`
  - `getScaleFactor()`
  - `getWobble()`
  - `getIsBlinking()`
  - `getEvolveProgress()`
  - `isEvolveComplete()`

### Particles + decorations
- `ParticleSystem` holds small particles with position/velocity/lifetime; draw as circles/lines with alpha.
- `DecorationManager` draws stage-appropriate background elements (hearts/sparkles -> cobwebs/bones; NU11 overlays creepy symbols/eyes).

### Glitch effects (NU11)
Implement a `GlitchManager` that can:
- Trigger `STATIC`: draw random noise rectangles/pixels (fast path: small random rects).
- `SCREEN_TEAR`: draw the already-rendered frame into horizontal slices offset by a sinusoid.
- `COLOR_PULSE`: overlay a tinted rect with alpha and/or use `globalCompositeOperation`.
- Glitched hatching sequence: timed composition of these effects plus garbled text flashes.

Implementation approach:
- Render scene normally to an offscreen canvas, then apply glitch compositor steps when active.

## Concrete Implementation Steps (Order)

1) **Scaffold Vite multi-page game entry**
- Add `src/games/tamagotchi-monster/index.html` with a canvas element + minimal UI wrapper.
- Add `src/games/tamagotchi-monster/main.ts` that boots `GameApp`.

2) **Wire the game into repo navigation**
- Update `src/main.ts` to list the new game and link to its page.
- Update `vite.config.ts` to include the game HTML as a build input.

3) **Build the engine skeleton**
- Implement `Renderer` (resize, DPR scaling, coordinate transforms).
- Implement `Input` (pointer events + keyboard).
- Implement `Scene` interface + `GameApp` state + scene switching.

4) **Implement persistence**
- `ProfileStore` CRUD with presets and name collision rules.
- `MonsterIndexStore` with discovered stage tracking.

5) **Port core model + systems**
- `constants.ts` with all stage orders, thresholds, foods, theme palettes, play outcomes, etc.
- Pure functions: `getNextStage`, `checkEvolution`, `getAvailableFoods`, `applyFeed` (includes dental impact), `applyBrush`, `rollPlayOutcome`, etc.

### Time-Based Stat Decay (Additive Enhancement)
Implement “metabolism” updates as **pure logic** and drive it from the main loop:
- Hunger increases over time (toward starving).
- Dental health decays over time (toward 0).
- Feeding reduces hunger and also reduces dental health (food-dependent).
- Low dental health can trigger `DENTAL_PROBLEM`, blocking play until treated.

Recommended approach:
- Add `lastUpdatedAtMs` to `PetState`.
- On load (or when selecting a profile), compute `elapsedSeconds = (nowMs - lastUpdatedAtMs) / 1000` and apply catch-up once (then set `lastUpdatedAtMs = nowMs`).
- During runtime, apply `dtSeconds` each frame and periodically persist.
- Clamp catch-up (e.g., max 24h) to avoid extreme jumps if someone returns after weeks.

Recommended initial tuning (adjust after playtesting):
- Hunger increase rate: `+1 per minute` (cap at `MAX_HUNGER`).
- Dental decay rate: `-0.5 per minute` (floor at `0`).
- Dental problem threshold: if `dentalHealth <= 25` and `condition === NONE`, set `condition = DENTAL_PROBLEM` (no extra dwell timer).
- Feeding dental impact: per-food `dentalDamage` (default `0` if omitted).

6) **Implement graphics primitives**
- Buttons, HUD, and the pet sprite drawing for at least Egg/Baby/Child/Teen/Monster.
- Add NU11 visual theme overrides.

7) **Implement scenes in flow order**
- ProfileSelect -> MainGame -> overlays (feeding/play) -> care scenes -> settings/confirm scenes -> monster index.
  - Start at `ProfileSelect` on page load (do not auto-resume last profile).

8) **Add glitch + ambient effects**
- Glitch manager, hatching sequence, ambient triggers.
- Verify performance stays smooth.

9) **Polish parity details**
- Ensure button visibility rules match.
- Ensure teleport behavior matches (stage set directly).
- Ensure discovered stages recorded appropriately.

## Manual Test Scenarios (Acceptance Checklist)
Run via `npm run dev` and verify:

- Profile creation: OSCAR/PENELOPE exist on first run; name collision prevented; NU11 triggers black theme.
- Egg: click-to-hatch progress; normal mode hatches to Baby; NU11 hatches with glitch and skips to Child.
- Main loop: buttons show/hide correctly; Switch returns to profile select.
- Feeding: menu shows correct foods; feeding updates hunger/care; closes properly.
- Dental: brushing completes and updates dental/care.
- Play: activity outcomes include success + condition-setting; condition blocks play until treated.
- Band-aid/Doctor/Dentist: completing clears condition; updates care/dental.
- Evolution: thresholds cause stage advance; evolution animation plays; stage-dependent visuals update; NU11 stage chain works.
- Monster Index (`i`): opens from profile select and main; discovered/unknown display; teleport works; close returns to prior scene.
- Persistence: refresh tab retains profiles/pet state/monster index.
- Time-based stats: letting the game idle increases hunger / reduces dental health; feeding reduces hunger and also reduces dental health; refresh retains timers and stats.

## Assumptions (Explicit Defaults)
- The game directory name is `tamagotchi-monster` (kebab-case).
- Canvas runs at logical `800x600` with responsive scaling.
- Persistence is **localStorage only** (no file sharing with the pygame version).
- “Parity” means parity with the **current pygame implementation’s behavior and content**, not necessarily every item described in older specs.
- No new test framework is added; verification is via the manual checklist + `npm run build`.
