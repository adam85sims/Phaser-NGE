# Module: Content Editors

## Dialogue Editor

**ID:** `dialogue-editor`
**File:** `tools/views/dialogue-editor.js`

Purpose: Inline dialogue editing panel. Shows a simplified view of the selected node's text for rapid writing. Used alongside the node graph.

State: None (reads from current scene and selection).

Events: Mutates node data directly on `editorState.scenes[id].nodes[]` and dispatches `project:modified`.

---

## Menu Editor

**ID:** `menu-editor`
**File:** `tools/views/menu-editor.js`

Purpose: Design the main menu screen. Edit menu items, background, title, and button layout.

Data: Menu config stored in project data (part of game.json or dedicated config).

Features:
- Background picker (opens asset browser filtered to backgrounds)
- Menu item list (New Game, Continue, Settings, Quit)
- Each item: label, action, enabled condition, icon

---

## Splash Editor

**ID:** `splash-editor`
**File:** `tools/views/splash-editor.js`

Purpose: Design the splash screen (studio logos, legal text, press-to-start).

Data: Splash config stored in project data.

Features:
- Ordered list of splash elements (images + text)
- Duration per element
- Fade transition configuration
- Audio prompt on press-to-start

---

## Script Editor

**ID:** `script-editor`
**File:** `tools/views/script-editor.js`

Purpose: Raw text editor for script files (JavaScript, JSON, CSS). Used for advanced users to directly edit code or generated content.

Features:
- File tree (left sidebar) for script files
- Textarea/code input (monospace)
- Syntax highlighting (future: Monaco integration)
- Save triggers project save

API:
```js
openFile(path, content): void     // Load file into editor
getCurrentContent(): string       // Get current editor content
```
