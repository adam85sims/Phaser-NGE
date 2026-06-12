# State Management

**Responsibility:** Centralized state store with scoped namespaces, event-driven modification tracking, and persistence orchestration.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Event Bus                          │
│  window.dispatchEvent(new CustomEvent(name, detail)) │
└─────────────────────────────────────────────────────┘
         ▲                            │
         │ dispatch                   │ listen
    ┌────┴────┐              ┌───────┴────────┐
    │  Module  │── mutate ──▶│  editorState   │
    │  (owns   │             │  ┌──────────┐  │
    │  scoped  │             │  │ shell    │  │
    │  state)  │             │  │ modules  │  │
    └─────────┘              │  │  comp.   │  │
                             │  │  graph   │  │
                             │  │  ...     │  │
                             │  ├──────────┤  │
                             │  │ selection│  │
                             │  │ scenes   │  │
                             │  │ chars    │  │
                             │  │ vars     │  │
                             └─────────────┘  │
                                   └──────────┘
```

## State Shape

```js
editorState = {
  // ── Shell-owned ──
  shell: {
    activeSceneId: 'start' | null,
    activeWorkspaceTab: 'dialogue' | 'assets' | 'files' | 'scenes' | 'characters' | 'variables' | 'layouts',
    mode: 'scene' | 'menu' | 'splash' | 'script',
    dirty: false,
    expandedScenes: new Set(),
  },

  // ── Data (loaded from files, read-only unless saving) ──
  gameConfig: { title, version, startScene, scenes[], defaults },
  characters: { [id]: { name, color, portraits, defaultExpression } },
  variableDefs: { [id]: { type, defaultValue, description } },
  theme: { dialogue, menu, ... },
  scenes: { [id]: { id, entryNode, background, music, nodes[], layers[] } },

  // ── Selection ──
  selection: {
    type: 'node' | 'layer' | 'scene' | 'character' | 'variable' | null,
    id: string | null
  },

  // ── Per-module scoped state ──
  modules: {
    'scene-composer': {
      viewportWidth: 1280,
      viewportHeight: 720,
      previewPanX: 0,
      previewPanY: 0,
      previewZoom: 1,
      previewDragging: false,
      previewDragStart: { x: 0, y: 0 },
    },
    'node-graph': {
      camera: { x: -300, y: 0 },
      zoom: 1,
      panning: false,
      panStart: { x: 0, y: 0 },
      dragging: null,
      connectionDraft: null,
      contextMenu: null,
    },
    'asset-browser': {
      filter: 'all',
      search: '',
      selectedAsset: null,
      onDisk: { backgrounds: [], portraits: [], music: [], sfx: [], fonts: [] },
      scanLoading: false,
    },
    'character-manager': {
      selectedCharacterId: null,
    },
    'file-browser': {
      tree: [],
      expandedFolders: new Set(),
      selectedPath: null,
    },
    // ... other modules as they declare their state
  }
};
```

## State Normalization

The `scenes` map is keyed by scene ID. Each scene object holds both its data (`nodes[]`, `layers[]`, `background`, `music`) and editorial metadata.

Scene data is loaded on boot via `loadProjectData()`. The shell fetches all scenes listed in `gameConfig.scenes[]` and stores them by ID.

```js
editorState.scenes = {
  'start': { id: 'start', entryNode: 'start', nodes: [...], layers: [...] },
  'chapter_1': { id: 'chapter_1', entryNode: 'intro', nodes: [...], layers: [...] }
};
```

## Rules

### 1. Scoped Write
Only the owning module writes to `editorState.modules[moduleId]`. Cross-module reads are fine (e.g., Inspector reads scene data), but cross-module writes must go through the Event Bus.

```js
// ✅ Scene composer writes its own state
editorState.modules['scene-composer'].previewZoom = 1.5;

// ✅ Inspector reads scene data (read-only cross-module access)
const scene = editorState.scenes[editorState.shell.activeSceneId];

// ❌ Scene composer writes graph state
editorState.modules['node-graph'].zoom = 2;  // WRONG — dispatch event instead
```

### 2. Dirty Tracking via Events
Mutations that affect project data dispatch `project:modified`:
```js
editorState.scenes['start'].layers.push(newLayer);
ctx.eventBus.emit('project:modified', { sceneId: 'start', path: 'layers' });
```

The shell listens for `project:modified` and sets `shell.dirty = true`.

### 3. No Silent Saves
Always go through the shell's `save()` command. No module saves directly — this prevents partial saves and ensures the save button reflects actual state.

## Event Bus API

```js
const eventBus = {
  on(name, handler) {
    window.addEventListener(name, (e) => handler(e.detail));
  },
  off(name, handler) {
    window.removeEventListener(name, handler);
  },
  emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
};
```

### Event Catalog

| Event | Detail | Purpose |
|-------|--------|---------|
| `selection:changed` | `{ type, id }` | Selection changed in outline/graph |
| `scene:changed` | `sceneId` | Active scene switched |
| `scene:layer-changed` | `{ layerId, props }` | Layer property updated |
| `scene:node-changed` | `{ nodeId, props }` | Node data updated |
| `project:modified` | `{ sceneId?, path? }` | Any data mutation |
| `project:saved` | `{}` | Save completed |
| `asset:imported` | `{ category, name }` | New file imported |
| `mode:switched` | `modeName` | Mode toggle |
| `inspector:refresh` | `{}` | Inspector needs re-render |
| `scene:background-changed` | `{ layer }` | Background layer changed (legacy) |
| `editor:open-assets` | `{ filter? }` | Navigate to asset browser tab |

## Persistence

Save flow:
```
Module mutates state
  → dispatches 'project:modified'
  → Shell marks dirty
  → User clicks Save (or Ctrl+S)
  → Shell calls backend.saveProject(buildSavePayload())
  → Dispatches 'project:saved'
```

`buildSavePayload()` constructs a serializable object from current state:
```js
function buildSavePayload() {
  return {
    game: editorState.gameConfig,
    characters: editorState.characters,
    variables: editorState.variableDefs,
    theme: editorState.theme,
    scenes: Object.fromEntries(
      Object.entries(editorState.scenes).map(([id, s]) => [
        id, { id: s.id, entryNode: s.entryNode, background: s.background,
              music: s.music, nodes: s.nodes, layers: s.layers }
      ])
    )
  };
}
```
