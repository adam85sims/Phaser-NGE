---
name: character-system
description: "Manages character portrait display, expression switching, and screen positioning on a 1280×720 canvas. Characters are rendered as positioned sprites on a dedicated depth layer (50) behind the dialogue box. Generates colored placeholder portraits when no texture is available. Portrait paths are resolved from data/characters.json. Related triggers: character portraits, expressions, character display, visual novel characters."
---

# CharacterSystem

> Places and manages character portraits on screen. Supports expression switching, 5 horizontal positions, and fade transitions. Generates procedural placeholder portraits when no asset texture is loaded. Portrait asset resolution uses `data/characters.json`'s `portraits` map (not filename patterns).

**Source:** `src/systems/CharacterSystem.js`
**Related skills:** `../dialogue-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Creates a Phaser container at depth `50` (behind dialogue box at depth 100, above layers at depth 0). Maintains an `activeSprites` map keyed by character ID.

## Public Methods

### `show(characterId, expression, position)`
- Looks up character data from `Data.getCharacter(characterId)`
- Destroys any existing portrait for the same character ID
- Resolves portrait asset key from `character.portraits[expression]` (a path like `characters/dave_neutral.png`), falling back to a procedural placeholder if the texture doesn't exist
- Places at one of 5 x-positions and fades in over 200ms
- Stores the image reference in `this.portraits[characterId]`

### `hide(characterId)`
Fades out over 150ms, then destroys the portrait image. Removes from `this.portraits`.

### `hideAll()`
Calls `hide()` for every visible character.

### `destroy()`
Destroys all portraits and the container.

## Positioning (1280×720 canvas)

Positions are mapped to x-coordinates on the 1280px canvas:

| Position | X (1280px) |
|----------|------------|
| `left` | 256 |
| `center-left` | 448 |
| `center` | 640 |
| `center-right` | 832 |
| `right` | 1024 |

Unknown positions default to `center` (640).

## Portrait Resolution

Portraits are resolved from `data/characters.json`:

```json
{
  "dave": {
    "name": "Dave",
    "color": "#ff6600",
    "portraits": {
      "neutral": "characters/dave_neutral.png",
      "happy": "characters/dave_happy.png",
      "angry": "characters/dave_angry.png"
    }
  }
}
```

The character's `portraits` map maps expression names to image paths. The engine checks if the texture exists in Phaser's cache (loaded by BootScene) and falls back to a procedural placeholder if missing.

## Placeholder Generation

When no portrait texture exists, `_generatePlaceholder()` creates a procedural canvas texture:

- Colored circle (uses character's `color` property) on transparent background
- Two black eye squares
- A neutral-expression mouth line

## Gotchas

- **Only one portrait per character** — calling `show()` for a character already on screen destroys the old image and creates a new one (destroy+create with fade, no smooth crossfade).
- **Placeholders overwrite loaded assets** — if a texture key doesn't exist, the system generates a placeholder. To use real assets, ensure BootScene preloads them.
- **Position is a string** — must be one of 5 valid positions. Unknown positions default to `center`.
- **Character data must exist** — `show()` returns early if `Data.getCharacter(characterId)` returns null/falsy. No error is thrown.
- **Portrait paths are NOT `portrait_{id}_{expression}`** — the old naming convention is gone. Paths now come from `data/characters.json`'s `portraits` map. The engine resolves them as-is (e.g., `characters/dave_neutral.png`).
- **Expression dropdown in editor** is populated dynamically from the character's `portraits` map keys. Changing speaker in the inspector re-populates the expression dropdown.
