---
name: data-loader
description: "Global data store — the single source of truth for all game content. Populated by BootScene after fetch() calls load game.json, characters.json, variables.json, theme.json, scene files, and animation files. Tools write to disk, the engine reads via this module at runtime. Related triggers: data store, game data, scene data, character data, content loading, animation data, theme data."
---

# Data Loader (Data Store)

> A simple singleton object that holds all game content at runtime. BootScene populates it via `fetch()`, and every engine system reads from it. Stores game config, characters, variables, theme, scenes, and animation data. There's no reactivity or change detection — it's a static snapshot loaded at boot.

**Source:** `src/systems/DataLoader.js`
**Related skills:** `../boot-scene/SKILL.md`, `../variable-system/SKILL.md`, `../character-system/SKILL.md`

## Data Structure

```js
export const Data = {
  game: null,         // from game.json    — title, scenes[], animations[], defaults
  characters: null,   // from characters.json — character defs with portraits map
  variables: null,    // from variables.json — variable definitions with defaults
  theme: null,        // from theme.json    — UI theme (dialogue, menu, splash)
  scenes: {},         // { sceneId: sceneData } — each scene's graph + layers
  animations: {}      // { animId: animData }  — keyframe animation tracks
}
```

## Public Methods

### `Data.getScene(id)`
Returns the scene data object for the given ID. Looks up from `Data.scenes[id]`. Returns `null` if not found.

### `Data.getCharacter(id)`
Returns the character definition for the given ID. Looks up from `Data.characters[id]`. Returns `null` if not found.

Character definition shape:
```json
{
  "dave": {
    "name": "Dave",
    "color": "#ff6600",
    "portraits": {
      "neutral": "characters/dave_neutral.png",
      "happy": "characters/dave_happy.png"
    }
  },
  "narrator": {
    "name": null,
    "color": "#ffffff",
    "invisible": true
  }
}
```

### `Data.getDefaultTextSpeed()`
Returns `Data.game.defaults.textSpeed` or falls back to `40` if not configured.

## Boot Flow

```
BootScene.create()
  → fetch('/data/game.json')
  → fetch('/data/characters.json')
  → fetch('/data/variables.json')
  → fetch('/data/theme.json')          // optional — error swallowed
  → fetch('/data/scenes/{id}.json')    // for each scene in game.scenes[]
  → fetch('/data/animations/{id}.json') // for each anim in game.animations[]
  → Populate Data.*
  → Audio preloading walks scene/event nodes
  → Image preloading caches background/character assets
  → Check nge_debug_start localStorage key
  → Transition to SplashScene or MenuScene or GameScene
```

## Gotchas

- **Populated by BootScene, consumed by everyone** — Data should not be modified after BootScene completes. Systems that need mutable state (like VariableSystem) copy from Data at construction.
- **Not reactive** — changing `Data.game.title` after boot has no effect. Systems read it once at setup.
- **`getCharacter()` returns `null` for missing IDs** — callers must null-check. DialogueSystem handles this gracefully (hides nameplate).
- **`getScene()` returns `null` for missing scenes** — SceneController handles this by logging a warning and refusing to start.
- **`Data.theme` can be null** — theme.json is optional. BootScene swallows fetch errors for it. Engine falls back to hardcoded layouts if theme is missing.
- **`Data.animations` is populated from `game.animations[]`** — each animation ID must have a corresponding `data/animations/<id>.json` file.
