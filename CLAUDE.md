# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start Vite dev server with hot reload
- `npm run build` - TypeScript check and build to `dist/`
- `npm run preview` - Preview built output

## Architecture

This is a collection of browser-based games built with TypeScript, Vite, and the Canvas API (no game engine).

### Project Structure

- `src/index.html` + `src/main.ts` - Main menu that lists all available games
- `src/games/` - Each game lives in its own subdirectory with its own `index.html` and entry TypeScript file
- `src/styles/main.css` - Shared styles for the menu

### Adding a New Game

1. Create a new directory under `src/games/<game-name>/`
2. Add `index.html` and `main.ts` (or similar entry point)
3. Register the game in `src/main.ts` by adding to the `games` array
4. For multi-page builds, add the entry to `vite.config.ts` under `build.rollupOptions.input`

### Game Implementation

Games use the Canvas API directly (no PixiJS, Phaser, etc.). This keeps dependencies minimal and code straightforward for AI-assisted development.
