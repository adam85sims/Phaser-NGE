---
name: boot-scene
description: "Initial scene that loads all game data JSON files using fetch() instead of Phaser's loader (avoids Vite path issues). Generates procedural UI textures. Populates the global Data store, then transitions to GameScene. Related triggers: boot, initialization, data loading, procedural textures."
---

# BootScene

> The first Phaser scene to run. Fetches all game data from `/data/` using `fetch()` with absolute paths, populates the `Data` store, generates procedural textures, then hands off to `GameScene`.

**Source:** `src/scenes/BootScene.js`
**Related skills:** `../data-loader/SKILL.md`, `../game-scene/SKILL.md`

## Scene Key

```
'BootScene'
```

## Lifecycle

### `preload()`
Generates procedural textures used by the game:
- `ui_continue` — a small cyan arrow for the continue indicator

### `create()`
1. Shows "LOADING..." text centered on screen
2. Fetches all data files in parallel with `Promise.all`:
   - `/data/game.json`
   - `/data/characters.json`
   - `/data/variables.json`
   - `/data/scenes/sample.json`
   - `/data/scenes/test-conditions.json`
   - `/data/scenes/test-events.json`
3. Each fetch checks `r.ok` and throws with status code on failure
4. Populates `Data.game`, `Data.characters`, `Data.variables`, `Data.scenes`
5. Ensures `Data.game.scenes` includes all loaded scene IDs
6. Destroys loading text
7. Transitions: `this.scene.start('GameScene')`

### Error Handling

If any fetch fails, the loading text changes to `"LOAD ERROR: {message}"` in red and logs to console. The game doesn't transition.

### Audio Preloading

After scenes are populated, `BootScene` walks every scene and registers audio files with the Phaser loader:

- `scene.music` (legacy scene-level BGM)
- `event` nodes with `eventType: 'bgm'` or `'sfx'` and a non-empty `eventValue`

Each unique key is HEAD-probed at `/assets/audio/{bgm,sfx}/<key>.<ext>` for `mp3, ogg, wav, opus, m4a` (in order), and the first match is registered via `this.load.audio()`. The Phaser loader is then started and awaited before the scene transitions out — so by the time `GameScene` mounts, every referenced audio file is in `scene.cache.audio` and `AudioSystem.playBGM/playSFX` will find them. Missing files emit a `console.warn` but do not block boot.

## Procedural Textures

Generated in `preload()`:

```js
// ui_continue — 32×16 cyan arrow
_textures.createCanvas('ui_continue', 32, 16)
// draw triangle, call .refresh()
```

## Adding a New Scene

To register a new scene, the user must:
1. Create the scene JSON in `data/scenes/{id}.json`
2. Add the ID to `data/game.json`'s `"scenes"` array
3. **Also add a `fetch()` call in `BootScene.create()`** for the new scene

Step 3 is manual because BootScene currently fetches each scene explicitly rather than reading the scene list dynamically.

## Gotchas

- **Hardcoded scene fetches** — BootScene currently fetches exactly 3 scene files. New scenes require adding another `fetch()` call. A future improvement would dynamically iterate `game.scenes` and fetch each.
- **`fetch()` not Phaser loader** — intentional. Phaser's built-in JSON loader has path resolution issues with Vite's dev server. Always use `fetch()` with absolute paths from the project root.
- **Error is thrown, not returned** — failed fetches throw with a status-code message, caught by the outer try/catch. The user sees a red error on screen.
- **`Data.game.scenes` is synced** — BootScene ensures the array includes all loaded scene IDs even if the JSON didn't have them. This keeps the editor's scene list accurate.
