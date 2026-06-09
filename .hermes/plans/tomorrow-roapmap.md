# Tomorrow's Roadmap — Features & Improvements

## 1. Background Selector / Changer
**Status:** Not implemented
**Description:** A method to change/select backgrounds in the dialogue editor and scene editor. Currently backgrounds are set manually via node fields (`node.background = "key"`). We need a proper selector.

**Ideas:**
- In the dialogue editor's node properties, when `background` is set on a node, show a dropdown/picker of available background images from `public/assets/backgrounds/`
- Scan the backgrounds directory at app start (or when entering the editor) to populate the list
- Show a thumbnail preview of the selected background
- Apply to the preview panel so the writer can see it in context
- Could also add a "scene background" quick-set in the toolbar (like a paint bucket icon that sets the current scene's default background)

**Files to touch:**
- `tools/views/dialogue-editor.js` — add background picker to toolbar or node editor
- `tools/dialogue-editor/editor.js` — add background field handler, populate from disk scan
- `tools/views/assets.js` — already scans asset references, could expose the background list
- Maybe a new `tools/views/backgrounds.js` view

## 2. Full Scene Preview
**Status:** Basic preview exists (text-only in preview panel)
**Description:** The current preview shows speaker name + dialogue text. We should build something more like a game engine scene preview — showing backgrounds, character portraits, choices, animations.

**Ideas:**
- Replace the current text-only preview with an actual Phaser game instance embedded in a canvas/iframe
- Show character portraits positioned correctly
- Show background behind the text
- Allow click-through to test dialogue flow
- Support choice selection in the preview
- Could be a dedicated "Preview" tool view rather than a panel

**Files to touch:**
- `tools/views/dialogue-editor.js` — expand/hide preview area
- `tools/dialogue-editor/editor.js` — enhance preview data sent
- `tools/dialogue-editor/preview.html` — the preview page loaded in the iframe
- Potentially new `tools/scene-preview/` directory

## 3. Expanded Nodes / Visual Scripting
**Status:** 7 node types exist. Connections are visual.
**Description:** Consider expanding what nodes can do or adding a visual scripting layer. Current limitation: nodes have limited fields and we can't fully control engine behavior from the editor.

**Ideas:**
- **New node types:** `increment` (modify variable), `if/else compound` (multiple branches), `random` (weighted branch), `subroutine` (call sub-graph)
- **Visual scripting on nodes:** Add a "Script" section to each node where you can chain simple actions (set var → play SFX → wait → continue)
- **Node pins for variables:** Show variable read/write as pin connections
- **Inline conditions on choices:** Already partially supported (`condition` field on choice options) — could be visualized
- **Node groups / collapsible regions:** Organize large graphs

**Files to touch:**
- `tools/dialogue-editor/editor.js` — new fields, new rendering for expanded node types
- `src/systems/SceneController.js` — new node type handlers in the engine
- `data/scenes/` — updated schema

## 4. Main Menu Modification
**Status:** Basic menu exists (Start, Continue, Settings, Exit)
**Description:** Need a plan to modify the main menu — probably for game branding, options layout, and boot screen.

**Ideas:**
- Configurable menu items from `game.json` or a menu config file
- Animated background on the menu (parallax, particle effects)
- Custom fonts, title animation
- "New Game" / "Continue" / "Load" / "Settings" / "Extras" / "Credits"
- Menu theming support (per-game color/font/background)

**Files to touch:**
- `src/scenes/MenuScene.js` — main menu scene
- `data/game.json` — menu config

## 5. Boot Screen Options
**Status:** Game loads directly into the menu
**Description:** Options for a boot/splash screen — engine logo, publisher logo, press-start screen.

**Ideas:**
- Configurable splash screen sequence in `game.json`
- Engine logo → Press Start → Main Menu flow
- Skip-able on subsequent visits
- Animated transitions between screens

**Files to touch:**
- `src/scenes/BootScene.js` — currently just loads data, could become the splash screen
- `data/game.json` — splash screen config
- New `src/scenes/SplashScene.js`

---

## Notes from today's session
- Integrated dialogue editor runs inline (no iframe), single save through top bar
- Auto-saving on every keystroke (oninput events)
- Prefix-based asset upload (bg_*, port_*, music_*, sfx_*, font_*)
- Layout optimized — no double sidebar margin, content fills viewport
- The `--save` CLI flag approach was never implemented, we use the top-bar save
