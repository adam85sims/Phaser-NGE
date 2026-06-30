---
name: boot-scene
description: "Initial scene that loads all game data JSON files using fetch() (avoids Vite path issues). Dynamically discovers scenes from game.scenes array, preloads audio and images, generates procedural UI textures, populates the global Data store, checks nge_debug_start for editor play-from-here, then transitions to SplashScene/MenuScene/GameScene. Related triggers: boot, initialization, data loading, procedural textures, debug start, asset preloading, animation loading."
---

# BootScene

> The first Phaser scene to run. Fetches all game data from `/data/` using `fetch()` with absolute paths, populates the `Data` store, generates procedural textures, preloads audio and images referenced by scenes, then hands off to the appropriate next scene (Splash → Menu → Game, or direct to GameScene for debug starts).

**Source:** `src/scenes/BootScene.js`
**Related skills:** `../data-loader/SKILL.md`, `../game-scene/SKILL.md`

## Scene Key

```
'BootScene'
```

## Lifecycle

### `preload()`
Generates procedural textures:
- `ui_continue` — 32×16 cyan arrow for the continue indicator
- Any other textures needed before scenes load

### `create()` (async)
1. Shows "LOADING..." text centered on screen
2. Fetches data files:
   - `/data/game.json` — required
   - `/data/characters.json` — required
   - `/data/variables.json` — required
   - `/data/theme.json` — optional (fetch errors are swallowed)
3. **Dynamically iterates** `game.scenes[]` to fetch each scene file: `/data/scenes/{id}.json`
4. **Dynamically iterates** `game.animations[]` to fetch each animation: `/data/animations/{id}.json`
5. **Preloads custom fonts** from `theme.fonts` config — injects `@font-face` rules, awaits `document.fonts.ready`
6. Populates `Data.game`, `Data.characters`, `Data.variables`, `Data.theme`, `Data.scenes[id]`, `Data.animations[id]`
7. **SafeFetchJson** — any fetch response that starts with `<` (HTML fallback page from Vite 404) is silently ignored with a console.warn instead of crashing
8. **Image preloading** — walks all scene layers and character portraits, fetches images as blobs, creates `Image` objects, and caches them as Phaser textures. Missing images log a warning and continue.
9. **Audio preloading** — walks all scene/event nodes for `bgm`/`sfx` event values, probes extensions via HEAD, registers via `this.load.audio()`, awaits `load.start()`. Missing audio emits a one-time warning.
10. Destroys loading text
11. Checks `nge_debug_start` in localStorage (set by editor's "Play from here" feature) — if present, parses `{ sceneId, nodeId }`, clears the key, and transitions directly to `GameScene` with debug params
12. Otherwise transitions to `SplashScene` (if `theme.ui.splash.enabled`) or `MenuScene`

### Error Handling
If any required fetch fails, the loading text changes to `"LOAD ERROR: {message}"` in red. `theme.json` errors are silently swallowed (theme is optional).

## Debug Start (Play from Editor)

The editor's "Play from here" feature writes `localStorage.nge_debug_start` as JSON `{ sceneId, nodeId }` before opening the game. BootScene reads and clears this key, then starts `GameScene` directly with `{ loadScene: sceneId, nodeId }`.

## Gotchas

- **`fetch()` not Phaser loader** — intentional. Phaser's built-in JSON loader has path resolution issues with Vite's dev server. Always use `fetch()` with absolute paths.
- **Auto-scene discovery** — BootScene dynamically iterates `Data.game.scenes`, so adding a new scene is just: create the JSON + register ID in `game.json`. No code changes needed.
- **`theme.json` is optional** — fetch errors for theme are silently swallowed. Missing theme → hardcoded fallback layouts.
- **`safeFetchJson` handles 404s gracefully** — Vite's dev server intercepts 404s and returns `index.html` (starts with `<`). `safeFetchJson` checks for this and returns null instead of crashing.
- **Audio preloading is automatic** — walks every scene and registers `eventType: 'bgm'` / `'sfx'` event values. Extensions probed in order: `mp3, ogg, wav, opus, m4a`.
- **Images use raw asset keys** — NOT prefixed `bg_`. The `bg_` prefix is only for theme splash/menu backgrounds. Scene layers and characters use the raw path as the key.
- **`nge_debug_start` is cleared on read** — prevents stale debug starts on page reload.
- **Font loading** — custom fonts are loaded from `theme.fonts` config via `@font-face`. Failed font loads log a warning but don't block boot. `document.fonts.ready` is awaited after all font loads attempt.
