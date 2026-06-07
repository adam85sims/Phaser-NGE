---
name: character-system
description: "Manages character portrait display, expression switching, and screen positioning. Characters are rendered as positioned sprites on a dedicated depth layer (50) behind the dialogue box. Generates colored placeholder portraits when no texture is available. Related triggers: character portraits, expressions, character display, visual novel characters."
---

# CharacterSystem

> Places and manages character portraits on screen. Supports expression switching, 5 horizontal positions, and fade transitions. Generates procedural placeholder portraits when no asset texture is loaded.

**Source:** `src/systems/CharacterSystem.js`
**Related skills:** `../dialogue-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Creates a Phaser container at depth 50 (behind the dialogue box at depth 100). Maintains a `portraits` map keyed by character ID.

## Public Methods

### `show(characterId, expression, position)`
- Looks up character data from `Data.getCharacter(characterId)`
- Destroys any existing portrait for the same character ID
- If no texture exists for `portrait_{id}_{expression}`, generates a colored placeholder
- Places at one of 5 x-positions and fades in over 200ms
- Stores the image reference in `this.portraits[characterId]`

### `hide(characterId)`
Fades out over 150ms, then destroys the portrait image. Removes from the `portraits` map.

### `hideAll()`
Calls `hide()` for every visible character.

### `destroy()`
Destroys all portraits and the container. Called on scene shutdown.

## Positioning

Positions are mapped to x-coordinates on the 800px canvas:

| Position | X |
|----------|---|
| `left` | 160 |
| `center-left` | 280 |
| `center` | 400 |
| `center-right` | 520 |
| `right` | 640 |

## Placeholder Generation

When no portrait texture exists (no asset loaded), `_generatePlaceholder()` creates a procedural canvas texture:

- Colored circle (uses character's `color` property) on transparent background
- Two black eye squares
- A neutral-expression mouth line
- Texture key format: `portrait_{characterId}_{expression}`

## Gotchas

- **Only one portrait per character** — calling `show()` for a character that's already on screen destroys the old image and creates a new one. No smooth transition between expressions (currently destroy+create with fade).
- **Placeholders overwrite loaded assets** — if a texture key for `portrait_{id}_{expression}` doesn't exist, the system generates a placeholder. To use real assets, preload textures with matching keys.
- **Position is a string** — must be one of the 5 valid positions. Unknown positions default to `center` (400).
- **Character data must exist** — `show()` returns early if `Data.getCharacter(characterId)` returns null/falsy. No error is thrown.
