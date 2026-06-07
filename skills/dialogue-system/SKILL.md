---
name: dialogue-system
description: "Renders the dialogue text box, speaker nameplate, typewriter effect, continue indicator, and choice list onto a Phaser scene. All coordinates are relative to a configurable text box area. Related triggers: typewriter text, dialogue box, visual novel text, choice menu, nameplate, continue arrow."
---

# DialogueSystem

> Renders and manages all in-game text UI — the dialogue box with typewriter animation, speaker nameplate, blinking continue arrow, and interactive choice lists.

**Source:** `src/systems/DialogueSystem.js`
**Related skills:** `../character-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Creates a Phaser container at depth 100 with all dialogue UI elements. Reads default text speed from `Data.getDefaultTextSpeed()`.

### Layout Constants

| Property | Default | Description |
|----------|---------|-------------|
| `box.x` | 40 | Left edge of text box |
| `box.y` | 420 | Top edge of text box |
| `box.w` | 720 | Width of text box |
| `box.h` | 150 | Height of text box |
| `box.padding` | 16 | Internal padding for text |
| `box.nameplateHeight` | 30 | Nameplate offset above box |

## Public Methods

### `showDialogue(speakerId, text, expression, onComplete)`
- Sets visible, updates nameplate from character data (with color), starts typewriter
- `onComplete` is called when the player advances past the text
- If speaker has no name, nameplate is hidden

### `advance()`
- If typewriter is still running → `skipToEnd()` (consumes the click to finish typing)
- If typewriter done → calls the `onComplete` callback and returns `false`
- Returns `true` if click was consumed (typewriter skipping), `false` if scene should advance

### `skipToEnd()`
Immediately reveals full text, shows continue arrow with blink tween.

### `showChoices(prompt, choices, onSelect)`
- Shows prompt text in nameplate position (gold color)
- Renders numbered choice labels (`[1] Choice text`) as interactive text objects
- `onSelect(index)` is called when player clicks a choice
- First choice gets accent color (`#00ccff`), others dim (`#aaaaaa`)
- Hover turns text white

### `hideChoices()`
Destroys all choice text objects, empties the choice container.

### `setVisible(visible)`
Show/hide the entire dialogue UI container.

### `destroy()`
Cleans up timer, tween, and container. Called on scene shutdown.

## Typewriter Animation

Characters are added one at a time via `scene.time.delayedCall(textSpeed)`. The speed is configurable via `Data.game.defaults.textSpeed` (default: 40ms). When typing completes, a blinking `▼` arrow appears at the bottom-right of the text box.

## Choice Interaction

Choices are `Phaser.GameObjects.Text` objects made interactive with `setInteractive({ useHandCursor: true })`. The `onSelect` callback is wired to `SceneController.selectChoice()` in GameScene.

## Gotchas

- **`advance()` return value is important** — the caller (GameScene) must check it. Returning `true` means "I consumed the click to finish typing, don't advance the scene yet." Returning `false` means "ready, advance the scene."
- **Nameplate visibility** — `showDialogue` hides the nameplate if the character has no name set (for narrator/ambient text without attribution).
- **Choice `prompt` can be null** — when `prompt` is `null` or empty, the choice screen shows no title text, just the list of options.
- **Choice objects are destroyed and recreated** every time choices are shown. Don't hold references to them across `hideChoices` calls.
- **Text speed** is read once at construction from `Data`. If the user changes text speed in settings, `DialogueSystem.textSpeed` needs to be updated manually.
