---
name: data-loader
description: "Global data store — the single source of truth for all game content. Populated by BootScene after fetch() calls load game.json, characters.json, variables.json, and scene files. Tools write to disk, the engine reads via this module at runtime. Related triggers: data store, game data, scene data, character data, content loading."
---

# Data Loader (Data Store)

> A simple singleton object that holds all game content at runtime. BootScene populates it via `fetch()`, and every engine system reads from it. There's no reactivity or change detection — it's a static snapshot loaded at boot.

**Source:** `src/systems/DataLoader.js`
**Related skills:** `../boot-scene/SKILL.md`, `../variable-system/SKILL.md`, `../character-system/SKILL.md`

## Data Structure

```js
export const Data = {
  game: null,         // from game.json
  characters: null,   // from characters.json
  variables: null,    // from variables.json
  scenes: {}          // { sceneId: sceneData }
}
```

## Public Methods

### `Data.getScene(id)`
Returns the scene data object for the given ID, or `null` if not found. Looks up from `Data.scenes[id]`.

### `Data.getCharacter(id)`
Returns the character definition object for the given ID, or `null` if not found. Looks up from `Data.characters[id]`.

The character definition typically has:
```json
{
  "narrator": { "name": null, "color": "#ffffff" },
  "hero": { "name": "Lena", "color": "#00ccff", "portrait": "lena_neutral" }
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
  → fetch('/data/scenes/{id}.json') for each scene
  → Data.game = game
  → Data.characters = characters
  → Data.variables = variables
  → Data.scenes[id] = sceneData
  → scene.start('GameScene')
```

## Gotchas

- **Populated by BootScene, consumed by everyone** — Data should not be modified after BootScene completes. If a system needs mutable state (like VariableSystem), it copies from Data at construction.
- **Not reactive** — changing `Data.game.title` after boot has no effect. Systems that depend on Data read it once at setup.
- **`getCharacter()` returns `null` for missing IDs** — callers must null-check. Systems like CharacterSystem and DialogueSystem handle this gracefully (hide nameplate, skip portrait).
- **`getScene()` returns `null` for missing scenes** — SceneController handles this by logging a warning and refusing to start.
