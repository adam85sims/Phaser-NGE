# Editor v2 Migration Summary

**For Hermes Agent**: This document summarizes the recent architectural refactor of the Phaser-NGE editor tooling. The old standalone `tools/dialogue-editor` has been completely ported into the new unified `editor-v2` shell, which now serves as the primary IDE for the project.

## 1. Directory Restructuring

The `tools/` directory has been flattened and simplified.
- **Removed**: `tools/editor-v2/` subdirectory (its contents were moved to the `tools/` root).
- **Entry Point**: `tools/index.html` now loads the new shell.
- **Styles**: `tools/app.css` (formerly `editor-v2.css`) drives the entire IDE interface.

## 2. Centralized State Management

Previously, the `dialogue-editor` relied on a localized `state` variable that was difficult to sync with external UI components. We introduced a centralized store:

- **File**: `tools/state.js`
- **Purpose**: Acts as the single source of truth for the entire IDE. It maintains the `editorState` object which tracks:
  - `activeSceneId`: The currently loaded scene.
  - `selectedItemId` / `selectedItemType`: The currently selected entity (e.g., node, character).
  - `scenes`, `characters`, `variableDefs`: In-memory copies of the project data.
- **Event Bus**: Instead of manual DOM manipulation on every change, any state mutation calls `markDirty()`, which fires the `editor:dirty` event. Visual components listen for the custom `editor:render` event to re-sync themselves against `editorState`.

## 3. Modular App Controller

- **File**: `tools/app.js` (now loaded as a standard ES module `<script type="module">`).
- **Purpose**: Manages the shell UI layout, initializes the editor, and acts as the event dispatcher.
- **Features**:
  - **Outline Panel (Left Sidebar)**: Dynamically reads `editorState.gameConfig.scenes` and `editorState.scenes` to build the collapsible tree view. Clicking an item updates `editorState.selectedItemId` and fires an `editor:render` event.
  - **Scene View (Center Panel)**: Renders a live visual preview of the currently selected node. If a `dialogue` node is selected, it displays a mock dialogue box with the character's portrait, name, and text.

## 4. Inspector Module

- **File**: `tools/inspector.js`
- **Purpose**: A dedicated module that handles rendering the context-sensitive properties panel (Right Sidebar).
- **Mechanism**: It reads the currently selected node from `editorState`, builds a dynamic HTML form using the node's properties (Text, Speaker, Wait time, Conditions, Next node, etc.), and sets up event listeners. When an input changes, it directly mutates `editorState` and dispatches `editor:render`.

## 5. Node Graph Module

- **File**: `tools/graph.js`
- **Purpose**: The interactive HTML5 Canvas node graph, ported entirely from the old `dialogue-editor/editor.js`.
- **Refactoring Details**:
  - Stripped out all HTML-generation and file-loading logic. The module is now *purely* a canvas renderer and pointer-event handler.
  - Reads data dynamically via `editorState.scenes[editorState.activeSceneId]?.nodes`.
  - Mutates `editorState` directly when nodes are dragged or connections are drawn.
  - **Fullscreen feature**: Added a "Fullscreen" button overlaid on the graph container inside `app.js`. It utilizes the native browser Fullscreen API (`requestFullscreen`) to allow the user to pop out the graph to a second monitor or maximize workspace visibility.

## 6. Next Steps & Known Pending Tasks

The core plumbing is complete and the Dialogue Editor tab is fully functional. The following tasks remain for the IDE implementation:

1. **Workspace Tabs**: The `Files`, `Asset Browser`, `Characters`, and `Variables` tabs in the bottom workspace currently render placeholder text ("module coming soon..."). These need to be wired up to their respective data structures in `editorState`.
2. **Contextual Inspector Types**: The Inspector (`inspector.js`) currently only renders forms for `node` types. It should be expanded to render property forms when a `character` or `variable` is selected in the future tabs.
3. **Save/Load Pipeline**: The `forceSave()` function in `app.js` is currently mocked. It needs to be wired up to an API endpoint or the file-system bridge to actually save the mutated `editorState` back to the JSON files in the `data/` directory.
