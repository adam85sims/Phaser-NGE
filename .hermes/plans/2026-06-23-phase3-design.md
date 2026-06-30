# Phaser-NGE — Phase 3 Design Document

> Remaining engine features that move from "usable" to "first pick."

---

## Feature 1: Expanded Rich Text

### Goal

Writers can format dialogue text with inline tags for size, font, speed, delay, and visual effects — without leaving the dialogue text field.

### Current State

`RichTextHelper.js` supports: `[b]`, `[i]`, `[color=#hex]`, `[show:target]`, `[hide:target]`, `[anim:target:key]`

These are parsed by regex, stripped from displayed text, and rendered as DOM elements.

### New Tags

| Tag | Syntax | Behavior |
|-----|--------|----------|
| Size | `[size=24]` or `[size=+4]` or `[size=-2]` | Change font size. Absolute (24px) or relative (+4px from current). |
| Font | `[font=serif]` | Switch to a named font (must be loaded via Custom Font system). |
| Speed | `[speed=80]` | Change typewriter speed for subsequent text (ms per char). |
| Delay | `[delay=500]` | Pause typewriter for 500ms at this point in the text. |
| Wave | `[wave]` / `[/wave]` | Wavy text effect (CSS keyframe animation). |
| Shake | `[shake]` / `[/shake]` | Shaking text effect (CSS keyframe animation). |
| Reset | `[/size]` `[/font]` `[/speed]` | Return to defaults (size, font, speed). |

### Conditional Text

```
{if inventory contains sword}You draw your blade.{/if}
{if courage >= 100}Your spirit burns bright!{/if}
{if has_key == false}The door is locked. {/if}You need a key.
```

- `{if condition}text{/if}` — show text only if condition is true
- `{if condition}text{else}other text{/if}` — branch text
- Conditions use the same syntax as condition nodes (supports AND/OR/parens)
- Parsed at dialogue display time, not at node creation time (so variables are live)

### Player Name Variable

```
Hello, [playername]! Welcome to the kingdom.
```

- `[playername]` is shorthand for `{if player_name != ""}{player_name}{else}Adventurer{/if}`
- Actually just a special tag that reads `player_name` variable
- Falls back to "Adventurer" if unset

### UX: How the Writer Uses This

**In the editor dialogue text field:**

```
[size=24]Chapter One[/size]

The ancient door loomed before you. [delay=300][shake]BOOM![/shake]

{if inventory contains key}You used the key to unlock it.{else}It was locked tight. You needed a key.{/if}

[playername] stepped inside...
```

**Editor experience:**
- Writer types tags directly in the text textarea (same as existing [show:target] tags)
- No special UI needed — tags are inline text
- The existing text preview on nodes shows raw tags (writer sees what they typed)
- A "Tag Reference" button below the text field shows a cheat sheet popup

**Tag Reference Panel (new UI element in dialogue inspector):**

```
╔══════════════════════════════════════╗
║ Rich Text Tags                      ║
╠══════════════════════════════════════╣
║ [b]bold[/b]         [i]italic[/i]  ║
║ [color=#ff0000]red[/color]          ║
║ [size=24]big text[/size]            ║
║ [font=serif]fancy[/font]            ║
║ [speed=80]slow typing[/speed]       ║
║ [delay=500]pause[/delay]            ║
║ [wave]wavy text[/wave]              ║
║ [shake]shaking[/shake]              ║
║ [show:layer] [hide:layer]           ║
║ [anim:target:animation]             ║
║ [playername]                        ║
╠══════════════════════════════════════╣
║ {if var == val}text{/if}            ║
║ {if condition}A{else}B{/if}         ║
╚══════════════════════════════════════╝
```

### Data Schema

No schema changes. Tags are inline in the existing `node.text` field.

### Files to Modify

| File | Change |
|------|--------|
| `src/systems/RichTextHelper.js` | Add parsing for new tags, conditional text, player name |
| `src/systems/DialogueSystem.js` | Handle delay tags in typewriter, speed changes, wave/shake CSS |
| `tools/nodes/EditorNodes.js` | Add tag reference button below dialogue text field |

### Architecture

```
RichTextHelper.parseRichText(text)
  → tokens[] (display tokens with style info)
  → engineTags[] (show/hide/anim)
  → conditionalSegments[] (condition + trueText + falseText)

DialogueSystem._typeNextChar()
  → checks for delay tags → pauses timer
  → checks for speed tags → updates textSpeed
  → applies wave/shake CSS classes to DOM elements

DialogueSystem.showDialogue()
  → evaluates conditional segments with VariableSystem
  → renders final text with conditions resolved
```

### Risks

- **Performance:** Evaluating conditions on every dialogue display adds overhead. Mitigate by caching condition compilation.
- **Complexity:** Conditional text in the editor is hard to preview. The writer sees raw `{if...}` syntax. Could add a "preview resolved" toggle later.
- **Wave/Shake animations:** CSS animations on individual `<span>` elements need careful implementation to avoid layout thrashing.

---

## Feature 2: Custom Font Loading

### Goal

Writers can import custom fonts and use them in dialogue text, UI elements, and node text — via theme config and inline tags.

### Current State

All text uses `'monospace'` hardcoded. No font loading mechanism exists.

### Design

**Font asset flow:**

```
1. Writer imports font:  npm run import-asset -- font ~/Downloads/NotoSans-Bold.ttf
   → copied to public/assets/fonts/NotoSans-Bold.ttf

2. Writer configures in theme.json:
   "fonts": {
     "primary": { "file": "NotoSans-Regular.ttf", "fallback": "sans-serif" },
     "secondary": { "file": "NotoSans-Bold.ttf", "fallback": "sans-serif" },
     "dialogue": { "file": "NotoSans-Regular.ttf", "fallback": "monospace" }
   }

3. BootScene preload:
   → injects @font-face rules for each font
   → waits for document.fonts.ready
   → fonts available globally

4. DialogueSystem uses theme.dialogue.fontFamily
   → writer can override per-text with [font=secondary]
```

### Theme Schema Addition

```json
{
  "fonts": {
    "primary": {
      "file": "NotoSans-Regular.ttf",
      "fallback": "sans-serif",
      "weights": [400, 700]
    },
    "secondary": {
      "file": "NotoSerif-Regular.ttf",
      "fallback": "serif",
      "weights": [400]
    }
  },
  "dialogue": {
    "fontFamily": "primary",
    "fontSize": 28
  }
}
```

### UX: How the Writer Uses This

**Step 1: Import the font**
```bash
npm run import-asset -- font ~/Downloads/NotoSans-Regular.ttf
```

**Step 2: Configure in theme.json (or editor settings)**
- Editor: Settings panel → Fonts section → Add Font
- Name: `primary`
- File: dropdown showing available fonts in `/assets/fonts/`
- Fallback: text input (e.g., `sans-serif`)
- Applied to: checkboxes (Dialogue, UI, Menu, Nameplate)

**Step 3: Use in dialogue**
- Default font comes from theme configuration
- Override inline: `[font=secondary]This text uses a different font[/font]`
- Combined with size: `[font=secondary][size=36]Big serif title[/size][/font]`

**Step 4: Preview in editor**
- Dialogue text in the editor renders with the configured font (if loaded)
- Font dropdown in dialogue inspector shows available fonts
- Preview shows how text will look with the selected font

### Editor UI: Font Manager

**New panel in Settings mode or standalone modal:**

```
╔══════════════════════════════════════════════╗
║ Font Manager                                ║
╠══════════════════════════════════════════════╣
║ Available Fonts:                            ║
║ ┌──────────────────────────────────────────┐ ║
║ │ Aa  NotoSans-Regular.ttf    [Delete]     │ ║
║ │ Aa  NotoSans-Bold.ttf       [Delete]     │ ║
║ │ Aa  NotoSerif-Regular.ttf   [Delete]     │ ║
║ └──────────────────────────────────────────┘ ║
║ [+ Import Font]                              ║
║                                              ║
║ Font Assignments:                            ║
║   Dialogue:  [primary    ▼]                  ║
║   Nameplate: [secondary  ▼]                  ║
║   Menu:      [primary    ▼]                  ║
║   UI:        [primary    ▼]                  ║
╚══════════════════════════════════════════════╝
```

### Files to Modify

| File | Change |
|------|--------|
| `src/scenes/BootScene.js` | Inject @font-face rules, wait for fonts.ready |
| `src/systems/DialogueSystem.js` | Use theme font family, apply [font] tag overrides |
| `data/theme.json` | Add fonts section |
| `src/systems/RichTextHelper.js` | Parse [font] tags, output font-family CSS |
| `tools/nodes/EditorNodes.js` | Add font dropdown to dialogue inspector |
| `tools/views/settings.js` (or new) | Font manager panel |

### Architecture

```javascript
// BootScene.js — font injection
_loadFonts() {
  const fonts = Data.theme?.fonts || {};
  for (const [name, config] of Object.entries(fonts)) {
    const fontFace = new FontFace(name, `url(/assets/fonts/${config.file})`, {
      weight: config.weights?.join(' ') || '400'
    });
    document.fonts.add(fontFace);
    fontFace.load().catch(err => {
      console.warn(`Failed to load font "${name}":`, err);
    });
  }
  return document.fonts.ready;
}

// RichTextHelper.js — [font] tag parsing
// Adds font-family: X to the style object of affected spans

// DialogueSystem.js — font application
// Base font from Data.theme.dialogue.fontFamily
// Overridden by [font] tags inline
```

### Risks

- **Font file size:** WOFF2 is preferred for web. TTF works but is larger. Could add WOFF2 conversion to import-asset.
- **Loading time:** Large fonts delay boot. Mitigate by only loading fonts referenced in the active scene (lazy loading).
- **Font fallback:** If a font fails to load, the fallback font is used. No crash, but text may look different.

---

## Feature 3: Localization / i18n

### Goal

Writers can author dialogue in multiple languages, switch languages at runtime, and export translation files.

### Current State

Single-language. `node.text` is a plain string.

### Design

**Dual-format text:** Dialogue text can be either a plain string (backwards compatible) or a language object:

```json
// Plain string (existing — still works)
{ "text": "Hello, world!" }

// Language object (new)
{ "text": { "en": "Hello, world!", "ja": "こんにちは世界！", "es": "¡Hola mundo!" } }
```

**Language configuration:**

```json
// game.json addition
{
  "localization": {
    "defaultLanguage": "en",
    "availableLanguages": ["en", "ja", "es"],
    "languageNames": { "en": "English", "ja": "日本語", "es": "Español" }
  }
}
```

### Runtime Flow

```
1. Game starts → SettingsSystem loads preferred language from localStorage
2. DialogueSystem checks node.text type:
   - string → display as-is (backwards compatible)
   - object → resolve node.text[currentLanguage] || node.text[defaultLanguage]
3. Player changes language in Settings menu → all future dialogue uses new language
4. Already-displayed text is not re-rendered (historical consistency)
```

### UX: How the Writer Uses This

**In the editor dialogue text field:**

**Scenario A: Single language (default — no change)**
Writer types plain text. Works exactly as before.

**Scenario B: Multi-language authoring**
Writer toggles the language selector in the dialogue inspector:

```
╔══════════════════════════════════════╗
║ Language: [English ▼] [+ Add Lang]  ║
╠══════════════════════════════════════╣
║ Text:                               ║
║ ┌──────────────────────────────────┐ ║
║ │ The ancient door loomed before   │ ║
║ │ you. It radiated an eerie glow. │ ║
║ └──────────────────────────────────┘ ║
║ [Tags ▼] [Preview]                   ║
╠══════════════════════════════════════╣
║ Translation Status:                  ║
║ ✓ English (source)                  ║
║ ✓ 日本語 (translated)               ║
║ ✗ Español (missing)                 ║
╚══════════════════════════════════════╝
```

**How it works:**
1. Writer authors in their primary language (English) — plain text field
2. Clicks "+ Add Lang" → adds Japanese tab
3. Switches to Japanese tab → same text field, but now editing `text.ja`
4. Types the translation
5. Can switch back and forth between languages to compare

**The inspector shows:**
- Language dropdown at the top
- Translation status (which languages have text, which are missing)
- The text field always shows the currently selected language

**Translation Export/Import:**

```
File → Export Translations → saves as JSON:
{
  "scenes": {
    "start": {
      "node_1": {
        "text": {
          "en": "Hello!",
          "ja": "こんにちは！"
        }
      },
      "node_2": {
        "text": {
          "en": "Goodbye!",
          "ja": "さようなら！"
        }
      }
    }
  }
}
```

- Writer sends this file to translators
- Translator fills in missing languages
- Writer imports the updated file → all translations updated

**In the settings menu (runtime):**

```
╔══════════════════════════════════════╗
║ Settings                             ║
╠══════════════════════════════════════╣
║ Text Speed:     [====|----]  40ms   ║
║ BGM Volume:     [======--]  75%     ║
║ SFX Volume:     [========]  100%    ║
║ Language:       [English ▼]         ║
║   ┌──────────────────────────┐      ║
║   │ English                  │      ║
║   │ 日本語                   │      ║
║   │ Español                  │      ║
║   └──────────────────────────┘      ║
║ Fullscreen:     [Off]               ║
╚══════════════════════════════════════╝
```

- Language picker only appears if multiple languages are configured
- Changing language takes effect on next dialogue advance
- Current language is saved to localStorage

### Data Schema Changes

**`data/game.json` addition:**
```json
{
  "localization": {
    "defaultLanguage": "en",
    "availableLanguages": ["en", "ja", "es"],
    "languageNames": { "en": "English", "ja": "日本語", "es": "Español" }
  }
}
```

**`node.text` field:** Can be string or `{ [lang]: string }` object.

**`data/characters.json` names:** Could also be localized:
```json
{
  "elena": {
    "name": { "en": "Elena", "ja": "エレナ" },
    "color": "#ff6b9d"
  }
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/systems/SettingsSystem.js` | Add `language` setting, getter/setter |
| `src/systems/DialogueSystem.js` | Resolve text by current language |
| `src/systems/DataLoader.js` | Parse localization config from game.json |
| `src/scenes/MenuScene.js` | Add language picker to settings UI |
| `src/scenes/GameScene.js` | Pass language to DialogueSystem |
| `data/game.json` | Add localization section |
| `tools/nodes/EditorNodes.js` | Add language selector to dialogue inspector |
| `tools/views/settings.js` | Language configuration UI |
| `tools/shared/backend-adapter.js` | Export/import translation endpoints |

### Architecture

```javascript
// DialogueSystem.js — language resolution
_resolveText(text, language) {
  if (typeof text === 'string') return text;           // backwards compatible
  if (typeof text === 'object' && text !== null) {
    return text[language] || text[this.defaultLanguage] || Object.values(text)[0] || '';
  }
  return String(text || '');
}

// SettingsSystem.js
get language() { return this._settings.language || 'en'; }
set language(lang) { this._settings.language = lang; this.save(); }

// CharacterSystem.js — localized names
_getCharacterName(charData, language) {
  if (typeof charData.name === 'string') return charData.name;
  if (typeof charData.name === 'object') return charData.name[language] || charData.name.en || '';
  return '';
}
```

### Backwards Compatibility

- Plain string text works exactly as before — no migration needed
- Characters with string names work as before
- If `localization` section is missing from game.json, single-language mode (no UI changes)
- Existing projects don't break

### Risks

- **Translation burden:** Writers must translate all text. Mitigate by making translation optional — missing translations fall back to default language.
- **Editor complexity:** Language switching in the editor adds cognitive load. Mitigate by making it opt-in — only show language UI when multiple languages are configured.
- **Text length differences:** German text is often 30% longer than English. Dialogue box sizing may need adjustment. Could add auto-sizing later.
- **Conditional text + localization:** `{if condition}text{/if}` needs to work in all languages. The condition is language-agnostic; only the display text is localized.

---

## Feature 4: Expanded Transitions

### Goal

Writers can choose from a rich set of visual transitions between scenes, configured per-scene or per-node.

### Current State

`TransitionSystem.js` supports: `none`, `fade`, `white_fade`, `slide_left`, `slide_right`

### New Transition Types

| Transition | Visual | Config |
|------------|--------|--------|
| `wipe_left` | Directional wipe from right to left | `duration` |
| `wipe_right` | Directional wipe from left to right | `duration` |
| `wipe_up` | Directional wipe from bottom to top | `duration` |
| `wipe_down` | Directional wipe from top to bottom | `duration` |
| `crossfade` | Blend between old and new scene | `duration` |
| `pixelate` | Pixelation dissolve | `duration`, `pixelSize` (default 16) |
| `iris_in` | Circular reveal (small to full) | `duration` |
| `iris_out` | Circular conceal (full to small) | `duration` |
| `zoom_in` | Camera zoom into center | `duration` |
| `zoom_out` | Camera zoom out from center | `duration` |

### UX: How the Writer Uses This

**Per-scene transitions (in scene inspector):**

```
╔══════════════════════════════════════╗
║ Scene: forest_path                   ║
╠══════════════════════════════════════╣
║ Entry Node: [start ▼]               ║
║                                      ║
║ ── Transitions ──                    ║
║ Enter: [crossfade ▼]  Duration: [800]║
║ Exit:  [wipe_left ▼]  Duration: [600]║
║                                      ║
║ [Preview Transition]                 ║
║                                      ║
║ ── Layers ──                         ║
║ ┌──────────────────────────────────┐ ║
║ │ ▼ BG_forest     [eye] [≡]       │ ║
║ │ ▶ Character_elena [eye] [≡]     │ ║
║ └──────────────────────────────────┘ ║
╚══════════════════════════════════════╝
```

**Writer workflow:**
1. Select a scene in the outline
2. In the scene inspector, find "Transitions" section
3. Choose "Enter" transition (what plays when this scene starts)
4. Choose "Exit" transition (what plays when leaving this scene)
5. Adjust duration if needed
6. Click "Preview Transition" to see it in the canvas

**Per-node transitions (in event node):**

The existing `camera` node could be extended, but it's cleaner to add a dedicated transition event type:

```
Event Type: [🎬 Transition ▼]
Transition: [crossfade ▼]
Duration: [800] ms
Wait: [✓]
```

Or writer can use the scene-level transitions and let the engine handle it automatically.

**Transition Preview in Editor:**

Click "Preview Transition" → editor shows a 2-second animation in the canvas:
- Current scene content fades/wipes to a test pattern
- Writer sees exactly what the transition looks like
- Can adjust duration and type before committing

### Data Schema Changes

**Scene file addition:**
```json
{
  "id": "forest_path",
  "entryNode": "start",
  "transitions": {
    "enter": { "type": "crossfade", "duration": 800 },
    "exit": { "type": "wipe_left", "duration": 600 }
  },
  "layers": [...],
  "nodes": [...]
}
```

**Backwards compatible:** If `transitions` is missing, engine defaults to `fade` with 500ms duration (current behavior).

### Files to Modify

| File | Change |
|------|--------|
| `src/systems/TransitionSystem.js` | Implement new transition types |
| `src/scenes/GameScene.js` | Apply enter/exit transitions on scene change |
| `src/systems/SceneController.js` | Emit transition events on scene start/end |
| `data/scenes/*.json` | Add transitions field (optional) |
| `tools/nodes/EditorNodes.js` | Add transition picker to scene inspector |
| `tools/views/scene-preview.js` | Add transition preview functionality |

### Architecture

```javascript
// TransitionSystem.js — expanded
static TRANSITIONS = {
  none: (scene, duration) => Promise.resolve(),
  fade: (scene, duration) => { /* existing */ },
  white_fade: (scene, duration) => { /* existing */ },
  slide_left: (scene, duration) => { /* existing */ },
  slide_right: (scene, duration) => { /* existing */ },
  wipe_left: (scene, duration) => { /* new */ },
  wipe_right: (scene, duration) => { /* new */ },
  wipe_up: (scene, duration) => { /* new */ },
  wipe_down: (scene, duration) => { /* new */ },
  crossfade: (scene, duration) => { /* new — blend old and new */ },
  pixelate: (scene, duration, config) => { /* new — pixelation shader */ },
  iris_in: (scene, duration) => { /* new — circular reveal */ },
  iris_out: (scene, duration) => { /* new — circular conceal */ },
  zoom_in: (scene, duration) => { /* new — camera zoom */ },
  zoom_out: (scene, duration) => { /* new — camera zoom */ },
};

// SceneController.js — transition triggers
onSceneStart(sceneData) {
  const enter = sceneData.transitions?.enter;
  if (enter) {
    TransitionSystem.play(scene, enter.type, enter.duration);
  }
}

// GameScene.js — exit transition before scene change
_switchScene(sceneId) {
  const current = Data.scenes[this.currentSceneId];
  const exit = current?.transitions?.exit;
  if (exit) {
    TransitionSystem.play(this, exit.type, exit.duration).then(() => {
      this.sceneCtrl.startScene(sceneId);
    });
  } else {
    this.sceneCtrl.startScene(sceneId);
  }
}
```

### Implementation Notes

**Wipe transitions:** Use a Phaser Graphics mask that moves across the screen.

**Crossfade:** Render both scenes simultaneously with alpha blending. Requires capturing the current scene as a texture before transition.

**Pixelate:** Use a Phaser pipeline shader (pixelation post-FX). Available in Phaser 4.

**Iris:** Use a circular mask that grows/shrinks. Phaser's Graphics can draw filled circles with blend modes.

**Zoom:** Animate camera zoom. Simple tween on `camera.zoom`.

### Risks

- **Crossfade complexity:** Requires rendering two scenes simultaneously. May need a render texture to capture the outgoing scene. Performance impact on low-end devices.
- **Pixelate shader:** Phaser 4 supports custom pipelines, but shader code is platform-specific (WebGL only, no Canvas fallback). Need graceful degradation.
- **Iris mask:** Circular masks can be expensive on large canvases. Consider using a simple alpha circle overlay instead.
- **Transition preview:** Rendering a full transition in the editor requires a mini Phaser instance in the preview panel. Significant engineering effort.

---

## Implementation Order

Based on dependencies and risk:

### 1. Expanded Rich Text (Low risk, high impact)
- Foundation for font loading and localization
- No schema changes
- Pure additive to existing text system

### 2. Custom Font Loading (Low risk, medium impact)
- Pairs with rich text [font] tags
- Self-contained feature
- Minimal schema changes

### 3. Expanded Transitions (Medium risk, medium impact)
- Standalone visual feature
- No dependencies on text/language
- Some complexity with shaders

### 4. Localization / i18n (Medium risk, high impact)
- Biggest structural change
- Benefits from stable text system
- Must maintain backwards compatibility

---

## Testing Strategy

### Rich Text
- Unit tests for new tag parsing in RichTextHelper
- Unit tests for conditional text evaluation
- Integration test: dialogue with mixed tags renders correctly

### Font Loading
- Unit test: BootScene font injection (mock FontFace API)
- Integration test: dialogue renders with custom font
- Manual QA: import font → configure → verify in game

### Transitions
- Unit tests for each new transition type (mock Phaser tweens)
- Integration test: scene change triggers correct transition
- Manual QA: preview transitions in editor

### Localization
- Unit tests for text resolution (string vs object)
- Unit tests for language switching
- Integration test: full dialogue flow with language change
- Manual QA: author in 2 languages → export → import → verify

---

## Open Questions

1. **Rich Text:** Should `[wave]` and `[shake]` use CSS animations or Phaser tweens? CSS is simpler but less controllable. Phaser tweens are more consistent but require DOM element references.

2. **Fonts:** Should we support WOFF2 conversion during import? TTF works but is larger. Could add `npm run import-asset -- font --format woff2` later.

3. **Localization:** Should character names be localized? Adds complexity but is common in translated games. Could defer to a later phase.

4. **Transitions:** Should crossfade be a "scene transition" or a "camera effect"? Scene transition is cleaner but requires capturing the outgoing scene. Camera effect is simpler but less visually impressive.

5. **Conditional text:** Should the editor show a preview of resolved conditions, or just the raw `{if...}` syntax? Preview is helpful but complex to implement (would need to evaluate conditions with current variable state).
