---
name: dialogue-system
description: "Renders the dialogue text box, speaker nameplate, typewriter effect, continue indicator, choice list, history panel, and skip/auto modes onto a Phaser scene at depth 100. All coordinates are theme-driven from data/theme.json. Supports inline tags [show/hide/anim] for synced visual events. Related triggers: typewriter text, dialogue box, visual novel text, choice menu, nameplate, continue arrow, history, inline tags."
---

# DialogueSystem

> Renders and manages all in-game text UI — the dialogue box with typewriter animation, speaker nameplate, blinking continue arrow, interactive choice lists, dialogue history panel, skip mode, and auto-advance mode. Inline tags (`[show:asset]`, `[hide:asset]`, `[anim:target:key]`) trigger visual events as the typewriter reaches them.

**Source:** `src/systems/DialogueSystem.js`
**Inline tags doc:** `docs/inline-scripting.md`
**Related skills:** `../character-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(scene)
```

Creates a Phaser container at depth 100 with all dialogue UI elements. Reads theme config from `Data.theme?.dialogue` (falls back to hardcoded defaults if theme is absent).

### Theme-Driven Layout

The dialogue box dimensions and style come from `data/theme.json`:

```json
{
  "dialogue": {
    "textBoxSize": { "width": 1180, "height": 180 },
    "textBoxPosition": { "x": 50, "y": 520 },
    "textSpeed": 40,
    "fontSize": 28,
    "fontFamily": "monospace",
    "textColor": "#ffffff",
    "backgroundColor": "#22224488",
    "padding": { "x": 30, "y": 20 },
    "transitionDuration": 300
  }
}
```

Defaults (if no theme): 1280x720 game size, text box at bottom of screen.

## Public Methods

### `showDialogue(speakerId, text, expression, onComplete)`
- Sets visible, updates nameplate from character data (with color), starts typewriter
- `onComplete` is called when the player advances past the text
- If speaker has no name, nameplate is hidden (narrator mode)
- Inline tags `[show:...]`, `[hide:...]`, `[anim:...:...]` are parsed by regex and fired when the typewriter hits their character offset

### `advance()`
- Typing in progress → `skipToEnd()` (consumes click, returns `true`)
- Typing done → calls `onComplete` callback, returns `false`
- Return value is critical: `true` = consumed click, `false` = ready to advance scene

### `skipToEnd()`
Immediately reveals full text, fires all pending inline tags instantly, shows continue arrow.

### `showChoices(prompt, choices, onSelect)`
- Shows prompt text in nameplate position (gold color)
- Renders numbered choice labels as interactive `Text` objects
- `onSelect(index)` calls `SceneController.selectChoice()`
- First choice gets accent color, others dim, hover turns white

### `hideChoices()`
Destroys all choice text objects.

### `showHistory()`
Toggles the dialogue history overlay. History is an array pushed on every `showDialogue()` call. Format: list of `{ speaker, text }` entries.

### `setSkipMode(bool)` / `toggleSkip()`
Skip mode: auto-advances dialogue on complete without waiting.

### `setAutoMode(bool)` / `toggleAuto()`
Auto mode: advances dialogue automatically after 2s pause following text completion.

### `setVisible(visible)`
Show/hide the entire dialogue UI container.

### `destroy()`
Cleans up timer, tween, and container.

## Inline Tags

Dialogue text supports three inline scripting tags:

```
[show:assetname]       — fades the named layer/asset in
[hide:assetname]       — fades it out
[anim:target:anim_key] — runs a keyframe animation on the target
```

Tags are **stripped from the displayed text** and fired sequentially as the typewriter reaches their position in the text. On `skipToEnd()`, all pending tags fire instantly.

**Target resolution:** `[show:...]` / `[hide:...]` look up by `assetName` (layer's `asset` field, e.g. `backgrounds/BG_forest.png`), not by layer `id`. `[anim:target:key]` resolves target via `LayerSystem` first, then `CharacterSystem.portraits`.

## Gotchas

- **`advance()` return value is important** — caller (GameScene) must check it. `true` = consumed to finish typing, don't advance scene. `false` = ready, advance scene.
- **Nameplate visibility** — hidden if character has no name (narrator/ambient text without attribution).
- **Choice `prompt` can be null** — no title text shown, just the list of options.
- **Choice objects are destroyed and recreated** each time — don't hold references across `hideChoices()` calls.
- **Text speed** read from theme or Data.defaults at construction. SettingsSystem can update `textSpeed` after construction.
- **Inline tag gotcha (LayerSystem.layers)** — `LayerSystem.layers` is a **plain object** (`{}`), not a `Map`. If `[anim:...]` tags fail on a layer, check whether code uses `.get()` on it (should be bracket notation `layers[id]`).
- **Skip-to-end fires pending tags** — all queued inline tags execute immediately when player clicks during typing. This ensures game state stays accurate.
