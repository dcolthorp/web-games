# Repository Guidelines

## Project Structure & Module Organization
- `src/index.html` and `src/main.ts` power the main menu that lists available games.
- `src/games/<game-name>/` is the home for each game (expected to contain its own `index.html` and entry file such as `main.ts`).
- `src/styles/main.css` contains shared menu styling.
- `dist/` is the build output (generated).
- `node_modules/` contains dependencies (generated).
- `vite.config.ts` configures Vite; when adding multi-page builds, add entries under `build.rollupOptions.input`.

## Build, Test, and Development Commands
- `npm run dev`: Start the Vite dev server with hot reload.
- `npm run build`: Type-check and build into `dist/`.
- `npm run preview`: Serve the production build locally.

## Coding Style & Naming Conventions
- TypeScript + Vite, ES modules.
- Indentation is 2 spaces (match existing files).
- Prefer `camelCase` for variables/functions, `PascalCase` for types/interfaces, and `kebab-case` for game directory names (e.g., `src/games/space-runner/`).
- No formatter or linter is configured yet; keep edits consistent with the surrounding file style.

## Testing Guidelines
- No testing framework or `npm test` script is configured.
- If adding tests, document the framework and add a script to `package.json` (e.g., `npm test`).

## Commit & Pull Request Guidelines
- There is no Git history yet, so no established commit message convention exists.
- Recommended: short, imperative subjects (e.g., “Add snake menu entry”). Include scope if helpful.
- PRs should include a clear description of changes and screenshots for UI-facing updates.

## Architecture Notes
- Games use the Canvas API directly (no game engine). Keep dependencies minimal and implementations straightforward.
- Register new games in `src/main.ts` so they appear in the menu.

## Agent Notes
- Follow `CLAUDE.md` for repo-specific guidance and expected workflows.
