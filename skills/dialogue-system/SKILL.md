---
name: dialogue-system
description: "Renders the dialogue text box, speaker nameplate, typewriter effect, continue indicator, choice list, history panel, and skip/auto modes onto a Phaser scene at depth 100. Supports rich text tags [b/i/color/size/font/wave/shake], control tags [speed/delay], conditional text {if}, [playername], and localization. Related triggers: typewriter text, dialogue box, visual novel text, choice menu, nameplate, continue arrow, history, inline tags, rich text, localization."
---

# DialogueSystem

> Renders and manages all in-game text UI — the dialogue box with typewriter animation, speaker nameplate, blinking continue arrow, interactive choice lists, dialogue history panel, skip mode, and auto-advance mode. Supports rich text formatting, control tags for typewriter behavior, conditional text, player name substitution, and multi-language localization.

**Source:** `src/systems/DialogueSystem.js`
**Related skills:** `../character-system/SKILL.md`, `../game-scene/SKILL.md`, `../rich-text-helper/SKILL.md`

## Constructor

```js
constructor(scene)
```

Creates a Phaser container at depth 100 with all dialogue UI elements. Reads theme config from `Data.theme?.dialogue`. Injects CSS for `.nge-wave` and `.nge-shake` animations.

## Public Methods

### `showDialogue(speakerId, text, expression, onComplete)`
- Resolves localized text via `resolveText(text, Settings.language)`
- Sets visible, updates nameplate from character data (with color), starts typewriter
- `onComplete` is called when the player advances past the text
- Inline tags and control tags are parsed and fired during typewriter

### `advance()`
- Typing in progress → `skipToEnd()` (consumes click, returns `true`)
- Typing done → calls `onComplete` callback, returns `false`

### `skipToEnd()`
Immediately reveals full text, fires all pending inline tags instantly, shows continue arrow. Discards remaining control tags and resets speed.

### `showChoices(prompt, choices, onSelect)`
Shows prompt text in nameplate position (gold color). Renders numbered choice labels as interactive `Text` objects.

### `showHistory()` / `hideHistory()`
Toggles the dialogue history overlay with scroll support.

### `setSkipMode(bool)` / `setAutoMode(bool)`
Skip mode auto-advances on complete. Auto mode advances after 1.5s–4s (text-length dependent).

### `setTextSpeed(ms)`
Updates the base typewriter speed.

## Inline Tags (via RichTextHelper)

```
[show:assetname]       — fades the named layer/asset in
[hide:assetname]       — fades it out
[anim:target:anim_key] — runs a keyframe animation on the target
```

Tags are stripped from displayed text and fired sequentially as the typewriter reaches their position.

## Rich Text Tags

```
[b]bold[/b]                    — bold text
[i]italic[/i]                  — italic text
[color=#ff0000]red[/color]     — colored text
[size=24]big text[/size]        — absolute font size
[size=+4]bigger[/size]          — relative font size
[font=serif]fancy text[/font]   — font family override
[wave]wavy text[/wave]          — wavy animation
[shake]shaking text[/shake]     — shaking animation
```

## Control Tags

```
[speed=80]text     — slower typewriter (ms per char)
[speed=20]text     — faster typewriter
[delay=500]text    — pause typewriter for 500ms
[playername]       — insert player_name variable or "Adventurer" fallback
```

## Conditional Text

```
{if inventory contains sword}You draw your blade.{/if}
{if courage >= 100}Heroic!{else}Cautious...{/if}
```

Conditions use the same syntax as condition nodes (AND/OR/parens, contains for arrays).

## Localization

Dialogue text can be either a plain string (backwards compatible) or a language object:

```json
{ "en": "Hello", "ja": "こんにちは" }
```

`showDialogue` resolves text via `Settings.language`. Falls back to `en`, then first available value.

Character names can also be localized: `{ "en": "Elena", "ja": "エレナ" }`

## Theme-Driven Layout

```json
{
  "dialogue": {
    "textBoxSize": { "width": 1180, "height": 180 },
    "textBoxPosition": { "x": 50, "y": 520 },
    "textSpeed": 40,
    "fontSize": 28,
    "fontFamily": "monospace",
    "textColor": "#ffffff",
    "backgroundColor": "#22224488"
  },
  "fonts": {
    "primary": { "file": "NotoSans.ttf", "weight": 400 }
  }
}
```

## Gotchas

- **`advance()` return value is important** — `true` = consumed to finish typing, `false` = ready to advance scene.
- **Nameplate visibility** — hidden if character has no name (narrator mode).
- **Control tags reset per dialogue line** — `_currentSpeed` resets to `textSpeed` at the start of `showDialogue`.
- **Skip-to-end fires pending tags** — all queued inline tags execute immediately when player clicks during typing.
- **CSS animations injected once** — `#nge-dialogue-styles` style element is created on first construction, reused on subsequent instances.
- **Localization is backwards-compatible** — plain string text works exactly as before. Language objects are only resolved when present.
- **`[playername]` resolved at render time** — the token is preserved in the token stream and resolved by `renderRichTextUpTo`.
