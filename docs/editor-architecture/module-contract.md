# Module Contract

Every editor module exports a consistent contract. This document defines the API shape.

---

## Module Manifest

Every module file in `tools/views/` exports the following:

```js
export const id = 'module-name';          // unique kebab-case ID
export const label = 'Module Name';       // human-readable label

export const contributions = {
  // Which panels this module has something to say about.
  // 'none' means it's a standalone tool (no panel link needed).
  panels: [
    // { id: '...', label: '...', area: 'sidebar' | 'workspace' | 'inspector' }
  ],
  
  // Right-click / command palette commands this module registers.
  commands: [
    // { id: 'module.addLayer', label: 'Add Layer', icon: '...' }
  ],

  // Sidebar sections this module populates (for outline).
  outlineSections: [
    // { id: 'layers', label: 'Layers', icon: '🎨' }
  ],
  
  // Events this module publishes.
  publishes: [
    // 'scene:layer-changed',
    // 'selection:changed',
  ],

  // Events this module listens to.
  subscribes: [
    // 'selection:changed',
    // 'scene:layer-changed',
  ]
};

// ── Lifecycle ────────────────────────────

/**
 * Called once when the editor boots and this module is first loaded.
 * Receives a context object { state, shell, eventBus, backend }.
 * Use this to set up scoped state, NOT to render DOM.
 */
export function init(ctx) {
  ctx.state.modules[id] = ctx.state.modules[id] || { /* defaults */ };
}

/**
 * Called every time this module's content needs to be rendered.
 * container is the DOM element to render into.
 * ctx is the same context object from init().
 */
export function render(container, ctx) { 
  // Write to container.innerHTML or manipulate DOM directly
}

/**
 * Called when this module needs to tear down (mode switch, editor close).
 * Release references, cancel timers, remove listeners added by this module.
 */
export function destroy() {
  // Clean up
}

// ── Event Handlers (optional) ────────────

/**
 * Called when an event this module subscribes to fires.
 * Event bus routes subscribed events here automatically.
 */
export function onEvent(name, detail) {
  switch (name) {
    case 'selection:changed':
      // re-render relevant part
      break;
  }
}
```

---

## Context Object

The `ctx` object passed to `init()` and `render()`:

```ts
interface ModuleContext {
  /** Editor state — owns scoped per-module state and shared shell state */
  state: {
    shell: {
      activeSceneId: string | null;
      activeWorkspaceTab: string;
      dirty: boolean;
      expandedScenes: Set<string>;
      mode: 'scene' | 'menu' | 'splash' | 'script';
    };
    modules: {
      [moduleId: string]: any;  // scoped per-module state
    };
    selection: {
      type: 'node' | 'layer' | 'scene' | 'character' | 'variable' | null;
      id: string | null;
    };
    // Current scene data (shortcut — owned by scene-composer)
    scenes: { [id: string]: SceneData };
    gameConfig: GameConfig;
    characters: CharacterMap;
    variableDefs: VariableMap;
    theme: Theme;
  };

  /** Event bus helpers */
  eventBus: {
    on(name: string, handler: (detail: any) => void): void;
    off(name: string, handler: (detail: any) => void): void;
    emit(name: string, detail?: any): void;
  };

  /** Backend API adapter */
  backend: {
    fetchGameConfig(): Promise<GameConfig>;
    fetchCharacters(): Promise<CharacterMap>;
    fetchVariables(): Promise<VariableMap>;
    fetchTheme(): Promise<Theme>;
    fetchScene(id: string): Promise<SceneData>;
    saveProject(data: SavePayload): Promise<void>;
    listAssets(): Promise<AssetList>;
    uploadAsset(file: File, category: string): Promise<void>;
  };

  /** Shell commands */
  shell: {
    navigate(mode: string): void;
    openFile(path: string): void;
    showSaveIndicator(dirty: boolean): void;
  };
}
```

---

## Panel Types

| Panel ID | Location | Owned By |
|----------|----------|----------|
| `outline` | Left sidebar | Shell (populated by module outline sections) |
| `inspector` | Right sidebar | Inspector module |
| `workspace` | Main content area | Shell (switches by mode) |
| `scene-preview` | Workspace → Scene mode | Scene Composer |
| `graph-canvas` | Workspace → Dialogue tab | Node Graph |

---

## Event Catalog

Standard events the event bus recognizes:

| Event | Payload | Triggered By | Subscribers |
|-------|---------|-------------|-------------|
| `selection:changed` | `{ type, id }` | Outline click, graph click | Inspector, Scene Preview |
| `scene:changed` | `sceneId` | Shell (scene switch) | Node Graph, Scene Composer |
| `scene:layer-changed` | `{ layerId, props }` | Scene Composer / Inspector | Scene Preview, Outline |
| `scene:node-changed` | `{ nodeId, props }` | Inspector / Node Graph | Node Graph, Outline |
| `project:modified` | `{ sceneId?, path? }` | Any mutating operation | Shell (dirty flag) |
| `project:saved` | (none) | Shell (save complete) | Shell (dirty flag clear) |
| `asset:imported` | `{ category, name }` | Asset Browser | Asset Browser (refresh) |
| `mode:switched` | `'scene' \| 'menu' \| 'splash' \| 'script'` | Shell (mode buttons) | All active modules |
| `inspector:refresh` | (none) | Inspector (event type change) | Inspector |

---

## Module Registration

The shell maintains a registry of all known modules:

```js
// In shell (app.js)
const _registry = [];

export function registerModule(mod) {
  _registry.push(mod);
}

export function getModule(id) {
  return _registry.find(m => m.id === id);
}

export function activateModule(id) {
  const mod = getModule(id);
  if (mod) mod.init(ctx);
}

export function renderModule(id, container) {
  const mod = getModule(id);
  if (mod) mod.render(container, ctx);
}
```

Modules are auto-registered when imported. Each view file calls `registerModule()` at module scope.
