# Shell / Workspace

**Responsibility:** Structural skeleton — panel layout, module lifecycle, mode switching, save orchestration.

---

## Layout

```
┌──────────────────────────────────────────────────────────┐
│ TOP BAR (40px) — mode toggle, save, title, workspace tab │
├─────────┬────────────────────────────────────┬───────────┤
│         │                                    │           │
│         │   WORKSPACE BODY                   │ INSPECTOR │
│ OUTLINE │   (switches by mode:               │ (260px)   │
│ (240px) │    Scene / Menu / Splash / Script) │           │
│         │                                    │           │
│         ├────────────────────────────────────┤           │
│         │   BOTTOM WORKSPACE (33vh)          │           │
│         │   (varies by mode)                 │           │
└─────────┴────────────────────────────────────┴───────────┘
```

### Elements

1. **Top Bar** (`#topbar`):
   - Mode buttons: Scene, Menu, Splash, Script
   - Save button (dirty indicator)
   - Play button
   - Brand / title
   - Workspace tab bar (Dialogue Editor, Asset Browser, Files, etc.) — only in Scene mode

2. **Outline** (`#outline`):
   - Scene tree (scenes → nodes + layers)
   - Populated by module outline sections
   - Selection triggers `selection:changed`

3. **Workspace Body** (`#workspace-body`):
   - Renders the active mode's primary panel
   - Scene mode: scene preview canvas (top) + workspace panel (bottom)
   - Menu/Splash/Script mode: dedicated editor panel

4. **Inspector** (`#inspector`):
   - Context-sensitive property editor
   - Rendered by Inspector module

### Resizers

Three drag handles:
- Between outline & workspace body — resizes `--sidebar-w`
- Between workspace body & inspector — resizes `--inspector-w`
- Between top workspace & bottom workspace — resizes `--workspace-h`

---

## Shell API

```js
// Shell module — app.js
export const id = 'shell';

export function boot() {
  // 1. Load Project Data
  await loadProjectData();
  
  // 2. Register all modules (import + registerModule)
  const modules = [
    await import('./views/scene-composer.js'),
    await import('./views/assets.js'),
    await import('./views/characters.js'),
    // ... all view modules call registerModule() at import time
  ];
  
  // 3. Initialise modules
  modules.forEach(m => {
    m.init(ctx);
    // Subscribe module to its declared events
    m.contributions.subscribes.forEach(event => {
      ctx.eventBus.on(event, (detail) => m.onEvent?.(event, detail));
    });
  });
  
  // 4. Render initial layout
  renderOutline();
  renderWorkspace();
  renderModule('inspector', document.querySelector('#inspector .panel-body'));
  
  // 5. Register global shortcuts
  registerGlobalShortcuts();
}

// Called by save button
export async function save() {
  ctx.state.shell.dirty = false;
  ctx.eventBus.emit('project:saved');
  await ctx.backend.saveProject(buildSavePayload());
}
```

## Mode Switching

Each mode activates a different set of modules and renders different workspace content.

### Scene Mode (Primary)

```
Workspace layout:
┌─────────────────────────────────────────┐
│          SCENE CANVAS (flex:1)          │
│     Layer stack preview + rulers        │
│     Pan/zoom/select toolbar             │
├─────────────────────────────────────────┤
│  🔲 TOOLBAR (40px) — Pan, Select, Move, │
│  Rotate, Scale, Grid, Zoom, Volume, Reset│
├─────────────────────────────────────────┤
│  BOTTOM WORKSPACE (33vh)                │
│  ┌──────────┬──────────┬──────────────┐ │
│  │Dialogue  │Assets    │Files  ...    │← tabs
│  │Graph     │Browser   │Tree          │ │
│  └──────────┴──────────┴──────────────┘ │
└─────────────────────────────────────────┘
```

Active modules in Scene mode:
- Scene Composer (preview canvas)
- Node Graph (dialogue tab)
- Asset Browser (assets tab)
- File Browser (files tab)
- Character Manager (characters tab)
- Variable Editor (variables tab)
- Scene Manager (scenes tab)
- Layout Manager (layouts tab)

### Menu Mode

```
Workspace: Full-height menu editor
Sidebars: Outlines (hideable), Inspector (menu item properties)
```

Active modules: Menu Editor, Inspector

### Splash Mode

```
Workspace: Full-height splash screen editor
Sidebars: Outlines (hideable), Inspector (splash element properties)
```

Active modules: Splash Editor, Inspector

### Script Mode

```
Workspace: Code editor (Monaco-like text area) + file tree
Sidebars: File Browser (left), no inspector
```

Active modules: Script Editor, File Browser

## Global Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo (future) |
| `Delete` | Delete selected item |
| `F5` | Play from start |
| `F6` | Play from current node |
| `Esc` | Deselect |

## Dirty State

The shell manages the dirty flag:
- `project:modified` → set `shell.dirty = true`, show `*` on save button
- `project:saved` → set `shell.dirty = false`, clear `*`
- Before `Play`: prompt to save if dirty
- Before `Close`: prompt to save if dirty (future)

## Init Sequence

```
1. shell.boot()
2.   loadProjectData()           — fetch JSON from backend
3.   renderHTML()                — index.html is static, just mount
4.   renderWorkspace()           — create panel DOM
5.   Module.init(ctx)            — for each registered module
6.   renderOutline()             — populate scene tree
7.   SceneComposer.render()      — render preview canvas
8.   Inspector.render()          — render property panel
9. Register event listeners     — wire up event bus
```
