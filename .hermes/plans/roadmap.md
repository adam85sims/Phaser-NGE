# Phaser-NGE Roadmap — Editor v2 Features

## Current State (as of June 2026)

**Completed:**
- ✅ Integrated editor shell (no iframe, single save flow)
- ✅ Monaco-based script editor with context menu file operations
- ✅ Files tab with Unity-style two-panel layout (folder tree + file grid)
- ✅ Right-click context menus on files (Open, Reveal, Delete placeholders)
- ✅ Scene preview panel that responds to selected dialogue nodes
- ✅ Inspector panel for node properties
- ✅ Graph-based dialogue editor with 7 node types
- ✅ Auto-save on every keystroke
- ✅ Asset import CLI tool (`npm run import-asset`)

---

## 1. Scene Composition Panel (Outline Split)
**Status:** Planned — High Priority
**Description:** Split the Outline panel into two halves to support both narrative and visual scene authoring.

**Left Half — Narrative Outline:**
- Scene list (expandable)
- Node list for selected scene (dialogue, choice, condition, etc.)
- Quick navigation to nodes

**Right Half — Scene Composition:**
- Visual layer list for the current scene
- Background layers (ordered, with visibility toggles)
- Character layers (positioned sprites with expression states)
- Prop/foreground layers (optional decorative elements)
- Add/remove/reorder layers via drag-drop

**Workflow:**
1. User selects a scene in the Narrative Outline
2. Scene Composition panel shows all visual elements for that scene
3. User can add backgrounds, position characters, set default expressions
4. Changes reflect in the scene preview and are saved to the scene JSON

**Files to touch:**
- `tools/app.js` — split outline rendering
- `tools/views/outline.js` — new dual-panel structure
- `tools/views/scene-composer.js` — new visual layer manager
- `tools/inspector.js` — layer property editing
- `data/scenes/*.json` — may need schema expansion for layer data

---

## 2. Background Manager & Picker
**Status:** Partial — needs integration
**Description:** A proper background selector for both scene composition and dialogue nodes.

**Features:**
- Scan `public/assets/backgrounds/` for available backgrounds
- Thumbnail grid picker in the Scene Composition panel
- Drag-to-apply on scene canvas
- Dropdown picker in node inspector for `node.background` field
- Preview background in scene canvas before committing

**Files to touch:**
- `tools/views/scene-composer.js` — background layer UI
- `tools/views/assets.js` — expose background list
- `tools/inspector.js` — background field widget
- `src/systems/CharacterSystem.js` — background rendering

---

## 3. Character Positioning & Layering
**Status:** Engine supports it, editor needs UI
**Description:** Visual tools for placing and managing characters in the scene.

**Features:**
- Drag characters on scene canvas to set position
- Left/center/right presets (matching engine's `position` field)
- Expression picker (dropdown of available expressions per character)
- Layer ordering (which character appears in front)
- Visibility toggles per character

**Files to touch:**
- `tools/views/scene-composer.js` — character layer UI
- `tools/inspector.js` — character property editing
- `src/systems/CharacterSystem.js` — already has positioning logic

---

## 4. Enhanced Scene Preview
**Status:** Basic text preview exists
**Description:** Upgrade the scene preview from text-only to a full visual representation.

**Features:**
- Render actual background image
- Show character portraits with correct expressions and positions
- Display dialogue text with speaker name
- Show choice buttons when at choice nodes
- Click-to-advance (test the flow without launching the game)
- Sync with node selection in the graph

**Files to touch:**
- `tools/app.js` — `renderScenePreview()` enhancement
- `tools/views/scene-composer.js` — preview integration
- `src/` — may need to expose rendering helpers for editor use

---

## 5. Visual Scripting Enhancements
**Status:** Core graph exists
**Description:** Expand the node graph with more visual scripting capabilities.

**Ideas:**
- New node types: `increment`, `random`, `subroutine`, `loop`
- Visual connections for variable read/write
- Inline condition editor with AND/OR support
- Node groups / collapsible regions for large graphs
- Mini-map for navigating large graphs

**Files to touch:**
- `tools/graph.js` — new node rendering, connection logic
- `tools/dialogue-editor/editor.js` — new node type handlers
- `src/systems/SceneController.js` — new node type execution

---

## 6. Main Menu & Boot Screen Customization
**Status:** Basic menu exists
**Description:** Configurable menu and splash screens for game branding.

**Features:**
- Menu config in `game.json` (items, order, labels)
- Animated background (parallax, particles)
- Custom title/logo placement
- Boot screen sequence (engine logo → press start → menu)
- Skip-able splash on subsequent visits

**Files to touch:**
- `src/scenes/MenuScene.js` — configurable menu
- `src/scenes/BootScene.js` — splash sequence
- `data/game.json` — menu/boot config schema

---

## 7. Asset Browser Improvements
**Status:** Basic grid view exists
**Description:** Make asset browsing and management more powerful.

**Features:**
- Filter by type (backgrounds, characters, audio, fonts)
- Search by name
- Drag-to-apply assets onto scene/nodes
- Bulk import/delete
- Asset metadata display (dimensions, duration, etc.)

**Files to touch:**
- `tools/views/assets.js` — enhanced filtering and actions
- `tools/views/scene-composer.js` — drag-drop integration

---

## Deferred / Nice-to-Have

- **Version history / undo stack** — revert to previous saves
- **Collaborative editing** — multiple users in the editor
- **Export/import scene packages** — share scenes between projects
- **Plugin system** — custom node types, inspector widgets
- **Localization tools** — multi-language dialogue editing
- **Animation timeline** — for character animations and transitions

---

## Notes

- Editor runs at `/tools/` — Scene mode for visual, Script mode for code
- Monaco editor loaded via CDN (`@monaco-editor/loader`)
- All data lives in `tools/state.js` (`editorState`)
- Save flow: topbar Save button → writes to `data/` directory
- Asset import: `npm run import-asset bg|bgm|sfx <file>`
