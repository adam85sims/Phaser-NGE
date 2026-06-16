# Plan: Editor UX — Background Selector, Expression/Position Dropdowns, Test Scene

## Plan 1: Background Selector on Dialogue Nodes

**What:** Add a `<select>` dropdown for `background` on dialogue nodes, populated from the actual backgrounds asset folder. When a background is selected, show a small thumbnail preview beside the dropdown.

**Files to touch:**
- `src/nodes/CoreNodes.js` — add `background` field to dialogue node's `renderEditor()`, add a `bindEditor()` that fetches asset list and populates the dropdown, with a thumbnail preview
- `tools/inspector.js` — the generic `[data-field]` change handler already saves `node[field] = val` for any field, so the dropdown binding + save works for free once the HTML is in the DOM

**How it works:**
1. `renderEditor` adds `<select>` placeholder + thumbnail `<div>` in the node properties form
2. `bindEditor` calls `ctx.backend.listAssets()` (same as event node), filters `backgrounds/` entries, populates the select with `<option>` values
3. On change, the generic inspector handler writes `node.background = val` — the engine already reads this field
4. Thumbnail: when a background is selected, create a small `<img>` element pointing at `/assets/backgrounds/<key>.png`
5. Asset keys are inferred from filenames by stripping extension and path prefix (e.g., `BG_throne_00001_.png` → `BG_throne_00001_`)

**Edge cases:**
- Empty background = "none" (first option)
- Asset fetch fails → inline text input as fallback (same pattern as event node)
- Duplicate keys from different extensions → deduplicate by key

---

## Plan 2: Expression & Position Dropdowns on Dialogue Nodes

**What:** Replace the text `<input>` for `expression` with a `<select>` that shows only expressions that exist for the currently selected character. Add a `position` dropdown (`left` / `center` / `right`) on dialogue nodes.

**Determining available expressions per character:**
- Scan `public/assets/characters/` for files matching `CharacterName_expression.*`
- Parse the filename pattern: `Elena_neutral_00001_.png` → character "Elena", expression "neutral"
- Cache the mapping per character
- When speaker changes, rebuild the expressions dropdown with only that character's expressions
- Default/unknown expressions: if the selected character has no portrait assets, show a text input fallback

**Position dropdown:**
- Simple `<select>` with options: center (default), left, right
- Maps to `node.position` (already read by the engine's SceneController and CharacterSystem)

**Files to touch:**
- `src/nodes/CoreNodes.js` — modify dialogue `renderEditor()`: replace expression `<input>` with `<select>` + placeholder, add position `<select>`
- Same `bindEditor()` from Plan 1 handles fetching character assets + populating expression options

**Edge cases:**
- Speaker changes → expression dropdown must update (hard with template strings — need to re-render or use an onchange listener on the speaker field)
- Character has no portrait assets → fall back to text input for expression
- Expression field is blank/empty → show "expression?key=no%20expression" as default option
- Position field not set → default to "center"

---

## Plan 3: Test Scene with Real Assets

**What:** Create a test scene that uses actual character portraits and a background image, so we can verify the editor and engine work end-to-end with real assets.

**Data changes:**
- `data/characters.json` — add Elena, Lyra, Marcus with their expressions as `portraits` mapping
- `data/game.json` — add the test scene ID to the `scenes` array
- Create `data/scenes/editor-test.json` — a short scene with:
  - A background (`BG_throne_00001_` or `Lakeside_Sunset_1920x1080`)
  - Dialogue from Elena (neutral → smile)
  - Dialogue from Lyra
  - Dialogue from Marcus
  - A choice node
  - Different positions (left, center, right)

**What this exercises:**
- Background selector populates from real assets
- Expression dropdown shows only relevant expressions per character
- Position dropdown works
- Save → reload → game renders correctly with all assets

---

## Implementation order

1. First: add `bindEditor` to dialogue node type (both Plans 1 and 2 need this)
2. Plan 1: background dropdown + thumbnail
3. Plan 2: expression dropdown + position dropdown, with character-asset parsing
4. Plan 3: character data + test scene
5. Verification: open editor, create/test scene, verify game tab renders it
