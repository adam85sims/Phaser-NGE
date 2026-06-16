---
name: editor-app
description: "The integrated editor v2 application (tools/index.html + tools/app.js + tools/inspector.js + tools/graph.js + tools/state.js + tools/editor-backend.js + tools/views/*.js). A single-page app with multi-mode support (Scene/Menu/Splash/Script/Animations), registry-driven inspector, backend API for disk persistence, asset browser with upload/DnD, transform gizmos, panel resizing, and project validation. Related triggers: editor application, project management, view routing, backend API, asset management, graph editor, inspector, scene composer, animation editor, node registry."
---

# Editor Application (Editor v2)

> The unified editor SPA for Phaser-NGE. Built on vanilla JS with a multi-mode architecture (Scene / Menu / Splash / Script / Animations). Integrates a registry-driven node type system shared with the runtime, a backend API for disk persistence (not localStorage), an asset browser with upload and drag-and-drop, transform gizmos on the scene canvas, interactive panel resizing, and save-time validation.

**Shell:** `tools/index.html` + `tools/app.js` (+ `tools/app.css`)
**Node Graph:** `tools/graph.js`
**Inspector:** `tools/inspector.js`
**State:** `tools/state.js`
**Backend:** `tools/editor-backend.js` (Vite plugin)
**Views:** `tools/views/*.js`
**See also:** `docs/editor-architecture/` — full architecture spec for the ongoing refactor

## Architecture

### Modes (topbar buttons)

| Mode | View File | Purpose |
|------|-----------|---------|
| **Scene** | `views/scene-composer.js` + `views/scenes.js` | Node-graph, layer/object preview, outline hierarchy |
| **Menu** | `views/menu-editor.js` | Title screen layout editor |
| **Splash** | `views/splash-editor.js` | Splash screen configuration |
| **Script** | `views/script-editor.js` | Monaco-powered JSON/script editor |
| **Animations** | `views/animations.js` | Keyframe animation timeline editor |
| **Assets** | `views/assets.js` | File browser, upload, drag-to-canvas |
| **Characters** | `views/characters.js` | Character/portrait manager |
| **Variables** | `views/variables.js` | Flag/counter definitions |
| **Settings** | `views/settings.js` | Editor preferences |

### Core Files

#### `app.js` — Editor Shell
- Boots the workspace, manages topbar event bindings
- Renders outline (`renderOutline()`), workspace (`renderWorkspace()`), scene preview (`renderScenePreview()`)
- Implements transform gizmos (Move, Scale, Rotate) on the canvas viewport
- Handles drag-and-drop from asset browser to canvas
- Interactive panel resizing handles
- Wires play-from-editor: `window.__playFromNode()` calls `forceSave()`, sets `localStorage.nge_debug_start`, opens `/`

#### `graph.js` — Node Graph Canvas
- Pan/zoom with mouse and scrollwheel
- Draws nodes as colored boxes with connection ports
- Hit-test for click/drag selection and connection editing
- `renderCanvas()` wrapped in try/catch to prevent per-frame crashes
- Node colors come from `Registry.getNodeType(node.type).color`

#### `inspector.js` — Context-Sensitive Property Panel
- Driven by `Registry` — for a selected node, calls `typeDef.renderEditor(node, ctx)` which returns HTML
- Complex node types (`choice`, `event`, `macro`) implement `bindEditor(node, container, ctx, helpers)` for post-render event wiring
- Context-aware fields: event node's inspector shows asset dropdown for BGM/SFX populated from `/api/list-assets`, volume slider, or camera value inputs depending on `eventType`
- Switching eventType dispatches `inspector:refresh` to re-render
- Character portrait dropdown populated dynamically from expressions map
- Background dropdown with thumbnail preview for dialogue nodes

#### `state.js` — Editor State
- `editorState` singleton: modules, selection, viewport, save tracking
- `loadProjectData()` — fetches all project data from `/data/*.json`
- `forceSave()` — POSTs to `/api/save`
- Debounced auto-save timer

#### `editor-backend.js` — Vite Plugin
All under `/api/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/save` | POST | Write all project files to disk. **Validates** for missing node references and missing assets. Returns `{ success, warnings }`. |
| `/api/list-assets` | GET | Recursive scan of `public/assets/` → `{ name, path, type, size, modified }` |
| `/api/upload-asset` | POST | `{ targetDir, filename, base64 }` → write to disk |
| `/api/delete-asset` | POST | `{ targetPath }` → rm file/dir (rejects `..` paths) |
| `/api/project/new` | POST | Wipes data dirs and writes fresh template |
| `/api/create-folder` | POST | `{ targetPath }` → mkdir (project-relative, rejects `..`) |
| `/api/create-file` | POST | `{ targetPath, content }` → write file |

Save payload: `{ game, characters, variables, theme, scenes: {id: data}, animations: {id: data} }`. Scenes/animations arrays are **cleared and rewritten** each save (deletions honored).

### View Modules (module contract)
Each view in `tools/views/` exports:
```js
export function init(app) {}          // one-time setup
export function render(container) {}  // called when view becomes active
export function destroy() {}          // cleanup (optional)
```
Views are registered in `app.js` and switched via `navigateTo(viewId)`.

### Event System
The editor uses `CustomEvent` on `window`:

| Event | Payload | Purpose |
|-------|---------|---------|
| `editor:render` | — | Full re-render (firehose — being phased out for granular events) |
| `editor:dirty` | — | Mark project as having unsaved changes |
| `editor:saved` | — | Save complete notification |
| `scene:changed` | — | Scene data changed |
| `scene:background-changed` | — | Background asset changed |
| `scene:node-changed` | `{ nodeId }` | Node properties changed |
| `scene:layer-changed` | `{ layerId }` | Layer properties changed |
| `selection:changed` | `{ type, id }` | Selection changed in outline/graph |
| `inspector:refresh` | — | Force re-render the inspector panel |
| `editor:open-assets` | `{ filter? }` | Open asset browser with optional filter |

### Editor → Game Bridge
- **Play from editor**: `window.__playFromNode(nodeId)` → `forceSave()` → `localStorage.nge_debug_start = { sceneId, nodeId }` → open `/`
- **Save button** (`btn-save`) → `forceSave()` → POST to `/api/save`

### Key Features
- **Transform Gizmos**: Move, Scale, Rotate handles on canvas viewport. Drag delta calculated relative to viewport zoom/pan.
- **Panel Resizing**: Drag handles between panels (outline/inspector/canvas).
- **Asset Drag-and-Drop**: Drag files from asset browser → canvas creates layers. Asset paths prefixed with `/assets/` for correct resolution.
- **Animation Timeline Editor**: Pure HTML/CSS DOM loop (`requestAnimationFrame`) simulating Phaser tweens for 1:1 preview.
- **Script Mode**: Monaco editor for raw JSON editing.
- **Save Validation**: `/api/save` checks for orphaned nodes and missing assets before writing.

## Gotchas

- **`navigateTo()` uses `requestAnimationFrame`** — lets spinner render before view render runs.
- **View `destroy()` is optional** — skipped gracefully if undefined.
- **Functions from innerHTML must be on `window.*`** — Vite wraps inline `<script>` in module scope. Editor uses `window.__playFromNode`, `window.__setActiveScene`, etc.
- **Asset path prefix** — when dragging from asset browser to canvas, paths must be prefixed with `/assets/` for correct CSS `url()` resolution (browser resolves relative to `/tools/` otherwise).
- **`0` is falsy in `||` fallback** — when parsing float values for CSS transforms, use explicit `isNaN(parseFloat(val))` instead of `val || defaultValue`.
- **LayerSystem.layers is a plain object** — `this.layers.layers[targetId]`, not `.get()`.
- **`registerNodeType` is additive** — new node types can be added by importing a file that calls `Registry.registerNodeType()` from `main.js` or `app.js`.
- **Save is NOT mocked** — it POSTs to `/api/save`. The old README's "save is mocked" claim is stale.
- **`nge_editor_data` localStorage key is removed** — editor only reads/writes via `/api/save`.
