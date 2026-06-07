---
name: save-system
description: "Serializes game state to localStorage. Each slot stores variable state plus current scene and node position for restore. Supports up to 10 save slots (0-9). Related triggers: save game, load game, save slots, localStorage persistence, game state serialization."
---

# SaveSystem

> Simple localStorage-based save/load system. Each save slot captures the full variable state plus the current scene and node, allowing the game to resume exactly where the player left off.

**Source:** `src/systems/SaveSystem.js`
**Related skills:** `../variable-system/SKILL.md`, `../scene-controller/SKILL.md`

## Constructor

```js
constructor(variableSystem, sceneController)
```

Requires references to both `VariableSystem` (for state serialization) and `SceneController` (for current position). Uses `localStorage` with key `narrative_saves`.

## Public Methods

### `getSlots()`
Returns the full array of save slots (up to index 9). Empty/missing slots are `undefined` in the array.

### `save(slotIndex)`
Captures current state to a slot:

```js
{
  slot: slotIndex,
  timestamp: Date.now(),
  title: "Save N",
  sceneId: "current_scene_id",
  nodeId: "current_node_id",
  nodeIndex: current_node_index,
  variables: { ... }     // from VariableSystem.serialize()
}
```

Writes the full slot array back to `localStorage['narrative_saves']`. Returns the save data object.

### `load(slotIndex)`
Restores variables from the slot, then returns scene info:

```js
{ sceneId: "...", nodeIndex: N }
```

Returns `null` if the slot is empty.

### `delete(slotIndex)`
Removes a slot entry and writes the array back.

### `formatTimestamp(ts)`
Formats a timestamp for save-slot display. Returns `"MM/DD/YYYY HH:MM"` style string.

## Gotchas

- **Slots are an array, not an object** — `getSlots()` returns `[]` initially. `delete()` leaves `undefined` holes in the array (doesn't re-index).
- **`nodeIndex` is legacy** — the current engine uses graph-based navigation (node IDs, not indices). `nodeIndex` in the save data is informational only; restore uses `sceneId` to call `startScene()`.
- **No quota check** — if localStorage is full (`~5MB`), `save()` will throw. The caller should handle this.
- **Not reactive** — `SaveSystem` doesn't auto-save. Call `save()` explicitly from a save menu or checkpoint node.
- **No compression** — saves are plain JSON. Large variable objects will consume proportionally more localStorage space.
