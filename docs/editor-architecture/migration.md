# Migration Plan

## Current State → Target Architecture

This document maps every current file to its target state and defines the phased refactor.

---

## File Inventory

### Core Shell Files

| Current File | Target | Notes |
|-------------|--------|-------|
| `tools/index.html` | Keep | Static shell, minimal changes |
| `tools/app.css` | Split per-module | Extract module-specific CSS, keep shared vars/layout in `app.css` |
| `tools/app.js` | → `shell/` | Split into: `shell/boot.js`, `shell/layout.js`, `shell/mode-switcher.js`, `shell/registry.js` |
| `tools/state.js` | Split | → `shell/state.js` (core state) + module-scoped state (inline in modules) |
| `tools/graph.js` | → `modules/node-graph/` | Keep as single file, add module contract exports |
| `tools/inspector.js` | → `modules/inspector/` | Keep as single file, add module contract exports |
| `tools/editor-backend.js` | Keep | Vite plugin, stays at top level |

### View Modules

| Current File | Target | Notes |
|-------------|--------|-------|
| `tools/views/assets.js` | → `modules/asset-browser/` | Add module contract |
| `tools/views/characters.js` | → `modules/character-manager/` | Add module contract |
| `tools/views/scene-composer.js` | → `modules/scene-composer/` | Already best-structured, add contract |
| `tools/views/scenes.js` | → `modules/scene-manager/` | Add module contract |
| `tools/views/files.js` | → `modules/file-browser/` | Add module contract |
| `tools/views/variables.js` | → `modules/variable-editor/` | Add module contract |
| `tools/views/dialogue-editor.js` | → `modules/dialogue-editor/` | Add module contract |
| `tools/views/menu-editor.js` | → `modules/menu-editor/` | Add module contract |
| `tools/views/splash-editor.js` | → `modules/splash-editor/` | Add module contract |
| `tools/views/script-editor.js` | → `modules/script-editor/` | Add module contract |
| `tools/views/layouts.js` | → `modules/layout-manager/` | Add module contract |
| `tools/views/dashboard.js` | → `modules/dashboard/` | Add module contract |
| `tools/views/settings.js` | → `modules/settings/` | Add module contract |

### Shared Files

| Current File | Target | Notes |
|-------------|--------|-------|
| `tools/shared/backend-adapter.js` | Keep | No change needed |
| `tools/shared/utils.js` | Keep | General utilities, no change needed |

---

## Phase 1: State Scoping (No Behavioral Change)

**Goal:** Restructure `state.js` into scoped namespaces without breaking any existing code. Everything still works exactly as before.

1. Update `state.js` → `shell/state.js`
   - Define `editorState.modules = {}` for scoped module state
   - Move module-specific fields from root to `modules.{id}`:
     - `viewportWidth`, `viewportHeight`, `previewPanX/Y`, `previewZoom`, `previewDragging`, `previewDragStart` → `modules['scene-composer']`
     - Graph/camera fields → `modules['node-graph']`
     - Asset browser fields → `modules['asset-browser']`
     - Selection fields → `editorState.selection`
   - Add getter/setter wrappers for backwards compat: `editorState.viewportWidth = 1280` still works but writes to `modules['scene-composer'].viewportWidth`
   - Keep `loadProjectData()`, `markDirty()`, `forceSave()` signatures identical

2. Add `shell/event-bus.js`
   - `eventBus.on()`, `eventBus.off()`, `eventBus.emit()` wrapper around CustomEvent
   - Migrate all `window.dispatchEvent` calls to use eventBus

**Files changed:** `state.js` → `shell/state.js` (restructure), new `shell/event-bus.js`
**Imports affected:** `app.js`, `graph.js`, `inspector.js` — update import paths
**Testing:** All existing functionality identical

---

## Phase 2: Module Contract Adoption (Structural Change)

**Goal:** Every view module exports the standard module contract (`id`, `label`, `contributions`, `init`, `render`, `destroy`, `onEvent`). No behavioral changes yet — modules still work the same way, just better organized.

For each view file:
1. Add `export const id = 'module-name'`
2. Add `export const label = 'Human Readable Name'`
3. Add `export const contributions = { ... }` with declared events
4. Wrap existing init/render in `init(ctx)` / `render(container, ctx)` signatures
5. Add `destroy()` if cleanup is needed
6. Add `onEvent(name, detail)` stub that handles subscribed events
7. Each module calls `registerModule(self)` at import time

**Example (scene-composer.js):**
```js
// At end of file
registerModule({ id, label, contributions, init, render, destroy, onEvent });
```

**Files changed:** All `views/*.js` files
**No behavioral regressions** — the shell still calls `module.init()`, `module.render()` at the same points

---

## Phase 3: Shell Refactor (Architectural Change)

**Goal:** Split `app.js` into focused shell modules.

### Breaking Down `app.js` (914 lines)

| Lines | Function | Target |
|-------|----------|--------|
| 1–99 | `boot()` — init sequence | `shell/boot.js` |
| 22–69 | Event listeners | `shell/boot.js` (wired in boot) |
| 103–230 | `renderOutline()` | `shell/layout.js` or `modules/outline/` |
| 232–338 | `renderWorkspace()` | `shell/mode-switcher.js` |
| 347–640 | `renderScenePreview()` | `modules/scene-composer/` (already lives there conceptually) |
| 641–655 | `updateScenePreviewTransform()` | `modules/scene-composer/` |
| 657–745 | `_rebuildRulers()` | `modules/scene-composer/` |
| 746–796 | `_renderScriptMode()`, `_renderMenuMode()`, `_renderSplashMode()` | `shell/mode-switcher.js` |
| 797–836 | `renderSceneMode()` | `shell/mode-switcher.js` (calls module renders) |
| 838–849 | `_countWords()`, `_countChoices()` | `shared/utils.js` (or keep in shell) |
| 852–914 | `initResizers()` | `shell/layout.js` |

### New Shell Files

```
tools/shell/
  boot.js          — init sequence, module loading, event registration
  layout.js        — panel layout DOM, resizers, outline rendering
  mode-switcher.js — mode switching, workspace body render
  state.js         — scoped state store, dirty tracking, save orchestration
  event-bus.js     — event dispatch wrapper
  registry.js      — module registry (registerModule, getModule, activateModule)
  index.js         — re-exports all shell functions (app.js imports from here)
```

---

## Phase 4: Event Granularity (Optimization)

**Goal:** Replace `CustomEvent('editor:render')` firehose with granular events. Each subscriber only re-renders when something it cares about changes.

### Current Firehose
```js
window.addEventListener('editor:render', () => {
  renderOutline();      // runs even when nothing changed in outline
  renderInspector();    // runs even when nothing changed in inspector
  renderScenePreview(); // runs even when nothing changed in preview
});
```

### Target Granularity
```js
ctx.eventBus.on('selection:changed', () => renderInspector());
ctx.eventBus.on('scene:layer-changed', () => renderScenePreview());
ctx.eventBus.on('scene:changed', () => { renderOutline(); renderScenePreview(); });
ctx.eventBus.on('project:modified', () => showDirtyIndicator());
```

**Event mapping:**
- Selection change → Outline (re-highlight) + Inspector (re-render form)
- Layer change → Scene Preview (re-paint) + Outline (re-list layers)
- Node data change → Node Graph (re-paint) + Outline (re-list)
- Scene switch → Outline (re-build tree) + Preview (new scene) + Graph (new scene)
- Asset import → Asset Browser (refresh grid) only
- Project modified → Save button (dirty indicator) only

---

## Phase 5: Directory Restructure (Naming)

**Goal:** Rename files and directories to match the architecture. This is a mechanical step once the module contract is adopted.

```
tools/
  index.html
  app.css                           ← shared theme vars + layout only
  editor-backend.js                 ← Vite plugin
  
  shell/                            ← was top-level .js files
    state.js                        ← was state.js
    event-bus.js
    registry.js
    layout.js                       ← resizers, outline HTML
    mode-switcher.js                ← workspace body render
    index.js                        ← re-exports
    boot.js                         ← init sequence from app.js
  
  modules/                          ← was views/
    scene-composer.js               ← was views/scene-composer.js
    node-graph.js                   ← was graph.js
    inspector.js                    ← was inspector.js
    asset-browser.js                ← was views/assets.js
    character-manager.js            ← was views/characters.js
    variable-editor.js              ← was views/variables.js
    scene-manager.js                ← was views/scenes.js
    file-browser.js                 ← was views/files.js
    dialogue-editor.js              ← was views/dialogue-editor.js
    menu-editor.js                  ← was views/menu-editor.js
    splash-editor.js                ← was views/splash-editor.js
    script-editor.js                ← was views/script-editor.js
    layout-manager.js               ← was views/layouts.js
    settings.js                     ← was views/settings.js
    dashboard.js                    ← was views/dashboard.js
  
  shared/                           ← keep
    backend-adapter.js
    utils.js
```

---

## Priority Order

1. **Phase 1** (State scoping) — lowest risk, highest clarity gain. Do this first.
2. **Phase 3a** (Event granularity) — decouples the firehose. Can be done alongside Phase 2.
3. **Phase 2** (Module contract) — structural. Touch every file, but mechanical.
4. **Phase 3b** (Shell split) — architectural. Requires Phase 1 + 2 to be stable.
5. **Phase 5** (Rename) — cosmetic. Do last.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Broken imports during restructure | Use Vite's dev server to test each phase immediately |
| Lost state when scoping | Writable getters preserve backwards compat (Phase 1) |
| Module contract changes break render flow | Each module keeps its existing render function, just wraps it in contract shape |
| Event granularity causes missed updates | Phase 4 is last — Phase 1–3 keep firehose as safety net, Phase 4 replaces selectively |
