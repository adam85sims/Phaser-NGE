# Principles & Terminology

## Core Principles

### 1. The Shell is Thin
The shell (`app.js`) owns:
- Panel layout — where each panel goes
- Module lifecycle — loading, activating, deactivating
- Shared commands — save, play, fullscreen
- Resizer logic for panel sizing

The shell does NOT own:
- Scene rendering (→ Scene Composer)
- Property editing (→ Inspector)
- Graph rendering (→ Node Graph)
- Asset scanning (→ Asset Browser)

### 2. Modules Own Their Domain
Each module is the sole authority over its data domain:
- **Scene Composer** owns the `layers[]` array — no other module writes to it directly
- **Node Graph** owns the graph canvas — no other module paints on it
- **Inspector** owns the property form — no other module renders into the right sidebar

Modules communicate through the **Event Bus** (`window.dispatchEvent`), not by importing each other's internals.

### 3. Event Granularity Over Firehose
Current anti-pattern:
```js
// BAD: every change fires the same event, everything re-renders
window.addEventListener('editor:render', () => {
  renderOutline();     // ran but nothing changed
  renderInspector();   // ran but nothing changed
  renderScenePreview();// ran but nothing changed
});
```

Target pattern:
```js
// GOOD: scoped events
window.addEventListener('scene:layer-changed', ({ detail }) => {
  renderScenePreview();  // only re-renders the canvas
});
window.addEventListener('selection:changed', ({ detail }) => {
  renderInspector();     // only re-renders the inspector
});
```

### 4. State is Scoped
Current anti-pattern:
```js
// BAD: any module writes any field
editorState.viewportWidth = 1280;    // Scene Composer's domain
editorState.selectedItemId = null;   // Selection state — shared but declared inline
editorState.previewPanX = 0;         // Scene Composer's domain
editorState.activeWorkspaceTab = 'assets';  // Shell's domain
```

Target: each module gets a **scoped namespace** within the state object. Module boundaries are explicit:
```js
editorState.modules['scene-composer'] = {
  viewportWidth: 1280,
  viewportHeight: 720,
  previewPanX: 0,
  previewPanY: 0,
  previewZoom: 1,
  layers: []
};
editorState.modules['node-graph'] = {
  camera: { x: -300, y: 0 },
  zoom: 1,
  graph: {}
};
editorState.selection = { type: null, id: null };
editorState.shell = {
  activeSceneId: null,
  activeWorkspaceTab: 'dialogue',
  dirty: false
};
```

### 5. Lifecycles are Explicit
Every module has a defined lifecycle:
- `init(ctx)` — called once when the module is first loaded
- `render(container)` — called when the module's panel needs to be drawn
- `destroy()` — called when the module is unloaded or the editor switches modes
- `onEvent(name, detail)` — handles events the module subscribes to

No more `let _app = null;` at module level — the context is passed properly.

## Terminology

| Term | Meaning |
|------|---------|
| **Shell** | The editor skeleton — layout, resizers, mode switching, top bar. `app.js`. |
| **Panel** | A visual region (outline sidebar, inspector sidebar, workspace body). |
| **Module** | A self-contained feature with a `contributions` declaration. Exists as one JS file + optional template. |
| **Plugin** | (Not used yet) A future bundle of one or more modules, with a `plugin.json` manifest. |
| **Event Bus** | Global event dispatch via `CustomEvent` on `window`. |
| **Scoped State** | State stored under `editorState.modules[moduleId]` — only the owning module writes to it. |
| **Mode** | A high-level workspace mode: Scene, Menu, Splash, Script. Each mode activates a different set of modules. |
| **Contribution** | Something a module provides to the shell — a panel, a command, a toolbar button, a sidebar section. |
| **Workspace** | The main content area — switches content based on active mode and active tab. |
| **Outline** | The left sidebar — tree view of scenes, nodes, layers. |
| **Inspector** | The right sidebar — context-sensitive property editor. |

## Module ID Convention

Module IDs use kebab-case matching the file name:
- `scene-composer` → `views/scene-composer.js`
- `asset-browser` → `views/assets.js`
- `character-manager` → `views/characters.js`

Scoped state key matches the module ID:
```js
editorState.modules['scene-composer'].viewportWidth = 1280;
```
