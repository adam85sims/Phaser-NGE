---
name: rich-text-helper
description: "Parses dialogue text with BBCode tags, engine tags, control tags, conditional text, and player name substitution. Used by DialogueSystem for typewriter rendering. Supports [b], [i], [color], [size], [font], [wave], [shake], [speed], [delay], [playername], [show/hide/anim], and {if condition}text{/if} conditional blocks."
---

# RichTextHelper

> Pure-logic text parser that converts dialogue strings into renderable token sequences. No Phaser or DOM dependencies — safe for unit testing.

**Source:** `src/systems/RichTextHelper.js`
**Test:** `tests/systems/RichTextHelper.test.js` (33+ tests)
**Related skills:** `../dialogue-system/SKILL.md`

## Functions

### `parseRichText(text, vars?)`

Main entry point. Returns `{ tokens, engineTags, controlTags, totalChars }`.

**tokens** — ordered array of:
- `{ type: 'char', char }` — visible character
- `{ type: 'html', html, isClose, tagType }` — formatting tag to inject
- `{ type: 'playername' }` — placeholder resolved at render time

**engineTags** — `{ index, action, target, animKey }` for `[show/hide/anim]`
**controlTags** — `{ index, action, value }` for `[speed=X]` and `[delay=X]`
**totalChars** — count of visible characters (excludes tags)

### `resolveConditionals(text, vars?)`

Resolves `{if condition}text{/if}` and `{if condition}A{else}B{/if}` blocks using `vars.evaluate()`. Returns processed text string.

### `renderRichTextUpTo(tokens, maxChars, playername?)`

Generates HTML string up to `maxChars` visible characters. Auto-closes unclosed tags. Resolves `[playername]` tokens.

## Supported Tags

### Display Tags (produce HTML)
| Tag | Output |
|-----|--------|
| `[b]text[/b]` | `<b>text</b>` |
| `[i]text[/i]` | `<i>text</i>` |
| `[color=#hex]text[/color]` | `<span style="color:#hex">` |
| `[size=24]text[/size]` | `<span style="font-size:24px">` |
| `[size=+4]text[/size]` | `<span class="nge-size-rel" data-size-delta="+4">` |
| `[font=serif]text[/font]` | `<span style="font-family:serif">` |
| `[wave]text[/wave]` | `<span class="nge-wave">` |
| `[shake]text[/shake]` | `<span class="nge-shake">` |

### Control Tags (consumed by DialogueSystem)
| Tag | Effect |
|-----|--------|
| `[speed=80]` | Change typewriter speed to 80ms/char |
| `[delay=500]` | Pause typewriter for 500ms |
| `[playername]` | Insert player_name variable |

### Engine Tags (consumed by DialogueSystem)
| Tag | Effect |
|-----|--------|
| `[show:asset]` | Fade layer in |
| `[hide:asset]` | Fade layer out |
| `[anim:target:key]` | Play animation |

### Conditional Text
```
{if inventory contains sword}You draw your blade.{/if}
{if courage >= 100}Heroic!{else}Cautious...{/if}
```

## CSS Classes

DialogueSystem injects these animations on first construction:
- `.nge-wave` — vertical wave animation (0.6s, 4px amplitude)
- `.nge-shake` — horizontal shake animation (0.15s, 1px)

## Regex Pattern

```js
/\[(show|hide|anim):([^\]]+)\]|\[speed=(\d+)\]|\[delay=(\d+)\]|\[playername\]|\[\/?([a-z_]+(?:=[^\]]+)?)\]/gi
```

Order matters: engine tags → control tags → playername → generic display tags.

## Gotchas

- **`vars` parameter is optional** — if omitted, conditionals show true-text by default.
- **Tag regex order matters** — speed/delay must match before generic tags or they'll be consumed as display tags.
- **`[playername]` is resolved at render time** — the token is preserved in the token stream and resolved by `renderRichTextUpTo`.
- **Relative size tags** — `[size=+4]` stores the raw `+4` string in `data-size-delta`, not a parsed number.
- **Conditional text is resolved at parse time** — conditions are evaluated when `parseRichText` is called, using the current variable state.
