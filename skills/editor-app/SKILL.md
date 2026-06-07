---
name: editor-app
description: "The integrated editor application (tools/app.js, tools/index.html). A single-page app that manages shared state, view routing, localStorage persistence, and project export/import. Views are modules in tools/views/ that export init/render/destroy. Related triggers: editor application, project management, view routing, localStorage persistence, export project."
---

# Editor Application (App Shell)

> The integrated editor is a standalone SPA built on vanilla JS. It manages a shared project state, routes between 8 tool views, auto-saves to localStorage, and provides project export/import. The dialogue editor is accessible as a view within this app or standalone.

**Shell:** `tools/index.html` + `tools/app.js`
**Views:** `tools/views/*.js`
**Related skill files:** `../overview/SKILL.md` (for the two-person workflow)

## Architecture

### App State

```js
export const app = {
  data: {
    game: null,       // game.json content
    characters: null, // characters.json content
    variables: null,  // variables.json content
    scenes: {}        // { sceneId: { data: sceneJSON } }
  },
  stats: {
    sceneCount, nodeCount, wordCount, choiceCount,
    charCount, varCount, recentScenes
  },
  currentView: null,
  views: {},  // registered view modules
  el: {}      // cached DOM refs
}
```

### View Registration

Each view module exports:
- `init(app)` — called once on startup
- `render(container, app)` — called when the view becomes active
- `destroy()` — called when leaving the view (optional)

Register with `registerView(name, module)` in `index.html`'s `<script type="module">`.

### Navigation

```js
navigateTo(viewId)
```

1. Calls `destroy()` on current view
2. Updates sidebar active state and breadcrumb
3. Sets `container.innerHTML` to a spinner
4. In `requestAnimationFrame`, calls the new view's `render()`

Error handling: if `render()` throws, the error is caught and a user-friendly error view is displayed.

### Nav Configuration

```js
const navConfig = [
  { id: 'dashboard',    icon: '◈', label: 'Dashboard' },
  { id: 'scenes',       icon: '✍', label: 'Scenes' },
  { id: 'dialogue',     icon: '◇', label: 'Dialogue Editor' },
  { id: 'characters',   icon: '👤', label: 'Characters' },
  { id: 'variables',    icon: '📊', label: 'Variables' },
  { id: 'assets',       icon: '🖼', label: 'Assets' },
  { id: 'layouts',      icon: '🎬', label: 'Layouts' },
  { id: 'settings',     icon: '⚙', label: 'Settings' },
]
```

## Persistence

### Auto-Save (Debounced)

- `__markProjectDirty()` — marks state as dirty, adds `.dirty` class to Save button, schedules save in 2s
- `__saveProject()` — immediately persists to localStorage, shows "✓ Saved" flash on button
- `_finaliseSave()` — shared helper: persists, clears dirty flag, removes `.dirty` class
- `pagehide` event — ensures pending saves complete on tab close

Storage key: `localStorage['narrative_engine_project']`

### Export

`__exportProject()` — serializes the entire project to a downloadable JSON bundle via browser save dialog.

### Import

`__openImportProject()` / `__importProject(file)` — reads a project bundle, validates version, prompts for confirmation if current project has content, applies and navigates to dashboard.

## Boot Sequence

1. Cache DOM refs in `app.el`
2. Render sidebar nav items from `navConfig`
3. Bind import file input
4. Load project: prefer localStorage (user's working session) over disk fetch (sample defaults)
5. Navigate to dashboard (or follow URL hash)
6. Listen for hash changes

## Save Button

A `💾 Save` button is present in the top bar on all views:

| State | Visual | When |
|-------|--------|------|
| Default | Dim text, transparent border | No unsaved changes |
| `.dirty` | Cyan accent glow | Unsaved changes exist |
| `.saved` | Green flash for 1.5s | Just saved |

## New Project Flow

1. Click "✦ New Project" → modal appears with title field
2. Enter title, click "Create Project" →
   - Blank project template created in memory
   - Saved to localStorage
   - Download triggered (browser save dialog) for disk storage
   - Dashboard shown with fresh state

## Gotchas

- **`navigateTo` uses `requestAnimationFrame`** — this lets the spinner render before the (potentially synchronous) view render runs. If a view's `render()` is expensive, the user sees a brief spinner.
- **View `destroy()` is optional** — if not defined, `navigateTo` skips it gracefully.
- **Hash-based routing** — `window.location.hash` drives view selection. The boot sequence reads the hash to restore the last-visited view after page load. `hashchange` events are listened to for browser back/forward.
- **Import replaces current project** — the user is prompted with `confirm()` if the current project has any content. No undo is available.
- **Storage schema version** — `STORAGE_VERSION = 1`. Import validates this and rejects mismatched versions with an alert.
- **Views that write to `app.data`** should call `__markProjectDirty()` so auto-save and the Save button stay in sync.
