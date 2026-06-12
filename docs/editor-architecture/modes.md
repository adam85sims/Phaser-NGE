# Editor Modes

The editor supports four modes, toggled by the top bar buttons. Each mode activates a different workspace layout and set of modules.

---

## Mode: Scene

**Active modules:** Scene Composer, Node Graph, Asset Browser, File Browser, Character Manager, Variable Editor, Scene Manager, Inspector

**Workspace layout:** Split pane — top scene canvas + bottom tabbed workspace (Dialogue/Assets/Files/Scenes/Characters/Variables/Layouts)

**Purpose:** Primary game development mode. Compose scenes visually, write dialogue, manage narrative flow, import assets.

**Outline:** Scene tree with nodes + layers per scene.

---

## Mode: Menu

**Active modules:** Menu Editor, Inspector

**Workspace layout:** Full-height menu editor panel.

**Purpose:** Design the main menu screen (title, buttons, background, audio).

**Outline:** Hide outline (or collapsed).

---

## Mode: Splash

**Active modules:** Splash Editor, Inspector

**Workspace layout:** Full-height splash screen editor panel.

**Purpose:** Design splash screens (studio logos, press-to-start, legal text).

**Outline:** Hide outline (or collapsed).

---

## Mode: Script

**Active modules:** Script Editor, File Browser

**Workspace layout:** Left file tree + right code editor (full height, no split).

**Purpose:** Direct code editing for advanced users.

**Outline:** Hide outline. No inspector.

---

## Mode Switching Flow

```
User clicks mode button in top bar
         │
         ▼
  Shell sets editorState.shell.mode = 'scene' | 'menu' | 'splash' | 'script'
         │
         ▼
  Event: 'mode:switched' (modeName)
         │
         ▼
  For each module that subscribes to 'mode:switched':
    - If module belongs to old mode → module.destroy()
    - If module belongs to new mode → module.init(ctx) + module.render(container, ctx)
         │
         ▼
  Shell re-renders workspace body for new mode
```

---

## Per-Mode Module Map

| Module | Scene | Menu | Splash | Script |
|--------|-------|------|--------|--------|
| Scene Composer | ✓ | | | |
| Node Graph | ✓ | | | |
| Inspector | ✓ | ✓ | ✓ | |
| Asset Browser | ✓ | | | |
| File Browser | ✓ | | | ✓ |
| Character Manager | ✓ | | | |
| Variable Editor | ✓ | | | |
| Scene Manager | ✓ | | | |
| Dialogue Editor | ✓ | | | |
| Menu Editor | | ✓ | | |
| Splash Editor | | | ✓ | |
| Script Editor | | | | ✓ |
| Layout Manager | ✓ | | | |
| Settings | ✓ | ✓ | ✓ | ✓ |
