---
name: save-system
description: "Serializes game state to localStorage. Each slot stores variable state plus current scene and node position for restore. Supports 10 save slots (0-9) with slot 0 for quick save, slot 9 for auto-save (written on every onSceneStart). Integrated with MenuScene for Continue functionality and F5/F9 hotkeys. Related triggers: save game, load game, save slots, localStorage persistence, game state serialization, quick save, auto save."
---

# SaveSystem

> localStorage-based save/load system. Each save slot captures the full variable state plus the current scene and node, allowing the game to resume exactly where the player left off. Supports quick save (slot 0), auto-save (slot 9, written on every scene start), and 8 manual save slots (1-8).

**Source:** `src/systems/SaveSystem.js`
**Related skills:** `../variable-system/SKILL.md`, `../scene-controller/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(variableSystem, sceneController)
```

Requires references to both `VariableSystem` (for state serialization) and `SceneController` (for current position). Uses `localStorage` with key `narrative_saves`.

## Public Methods

### `getSlots()`
Returns the full array of save slots (array of up to 10). Empty/missing slots are `undefined`.

### `save(slotIndex)`
Captures current state to a slot:

```js
{
  slot: slotIndex,
  timestamp: Date.now(),
  title: "Save N",
  sceneId: "current_scene_id",
  nodeId: "current_node_id",
  nodeIndex: current_node_index,    // legacy — informational only
  variables: { ... }               // from VariableSystem.serialize()
}
```

Writes the full slot array back to `localStorage['narrative_saves']`. Returns the save data object.

### `load(slotIndex)`
Restores variables from the slot via `VariableSystem.deserialize()`, then returns scene info:

```js
{ sceneId: "...", nodeId: "..." }
```

Returns `null` if the slot is empty.

### `delete(slotIndex)`
Removes a slot entry and writes the array back. Leaves `undefined` holes (doesn't re-index).

### `autoSave()`
Convenience method that saves to slot 9. Called by `GameScene.onSceneStart` on every scene transition.

### `formatTimestamp(ts)`
Formats a timestamp for save-slot display. Returns `"MM/DD/YYYY HH:MM"` style string.

## Save Slot Convention

| Slot | Purpose | Trigger |
|------|---------|---------|
| 0 | Quick save | F5 hotkey in-game |
| 1-8 | Manual save slots | Save menu |
| 9 | Auto-save | Written on every `onSceneStart` (scene transition) |

### Load Mapping

| Key | Action |
|-----|--------|
| F9 | Quick load from slot 0 |
| Continue (MenuScene) | Loads from slot 9 (auto-save) |
| Load menu | Select from any slot 0-8 |

## MenuScene Integration

`MenuScene` reads `localStorage['narrative_saves']` to determine if Continue is available. The `Continue` button checks `slots[9]` (auto-save). If present, it starts `GameScene` with `{ loadScene: sceneId, variables: slots[9].variables }`.

## Gotchas

- **Slots are an array, not an object** — `getSlots()` returns `[]` initially. `delete()` leaves `undefined` holes (doesn't re-index).
- **`nodeIndex` is legacy** — the engine uses graph-based navigation (node IDs). `nodeIndex` is informational only.
- **No quota check** — if localStorage is full (`~5MB`), `save()` will throw. The caller should handle this.
- **Not reactive** — SaveSystem doesn't auto-save except via explicit `autoSave()` call (wired to `onSceneStart`). Call `save()` explicitly for manual saves.
- **No compression** — saves are plain JSON.
- **`serialize()` saves global scope only** — Auto-save only captures the global variable scope. Sub-scope variables from macros are not persisted.
