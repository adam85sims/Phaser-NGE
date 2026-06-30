# Layouteer — Design Document

> **Engine-agnostic UI layout composer for game developers and narrative writers.**  
> Export to NGE (Phaser 4), Godot, Unity, Unreal, LÖVE, MonoGame, and more via a universal JSON schema.

---

## 1. Vision

Layouteer is a visual editor where **artists and writers** compose UI screens — dialogue boxes, menus, HUDs, title screens — by dragging elements onto an artboard, tagging them with semantic roles, and exporting the result as structured JSON. No code required.

The core insight: every game engine builds UI from the same primitives (containers, text labels, images, buttons, scroll regions), but each engine forces you to learn *its* API to do it. Layouteer replaces that API learning curve with a single, intuitive canvas. You design once, export anywhere.

**Target audience:** People who think in layout, not in code. Narrative designers, 2D artists, game writers, solo devs who just want a dialogue box that works.

---

## 2. Guiding Principles

1. **Artist-first, not developer-first.** Every feature must be understandable without reading documentation. Tooltips, visual cues, and safe defaults over power-user shortcuts.
2. **Semantic over specific.** Roles (dialogue_box, speaker_name) not engine targets. The export layer handles the mapping.
3. **WYSIWYG or bust.** What you see on the canvas is what ships. No "preview mode" separate from the editor.
4. **Zero friction export.** One button, one JSON file. Importers are small, separate packages.
5. **Small core, extensible edges.** Element types, role tags, and export adapters are all pluggable. The editor doesn't hardcode engine knowledge.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Layouteer App                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Hierarchy  │  │ Canvas   │  │  Properties      │  │
│  │Panel      │  │ (Artboard│  │  Panel           │  │
│  │           │  │  1280×720)│  │                  │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │              Zustand Store                     │   │
│  │  (flat node map + undo/redo history)           │   │
│  └─────────────────┬─────────────────────────────┘   │
│                    │                                 │
│         ┌──────────┴──────────┐                       │
│         │   Export Pipeline  │                        │
│         │                   │                        │
│         │  JSON Schema ◄───┤──► NGE Adapter         │
│         │                  ├──► Godot Adapter        │
│         │                  ├──► Unity Adapter        │
│         │                  └──► Unreal Adapter       │
│         └──────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
Canvas interaction → Zustand action → state update → React re-render
                                                        ↓
                                              Export: state → schema tree → adapter → engine format
```

---

## 4. Core Data Model (Schema v2)

The flat node map in Zustand is the source of truth. The export format is a cleaned-up tree derived from it.

### 4.1 Node Shape

```typescript
interface LayoutNode {
  id: string;               // UUID v4
  type: ElementType;        // 'canvas' | 'panel' | 'text' | 'image' | 'button' | 'scroll' | 'spacer'
  name: string;             // Human-readable label
  role: RoleTag;             // Semantic tag for engine mapping ('none' = untagged)
  props: NodeProps;          // Geometry, styling, content
  children: string[];        // Ordered child IDs — **array order = back-to-front z-order**
  locked: boolean;           // Prevent accidental moves/edits
  visible: boolean;          // Toggle visibility (hides in export)
  anchor: Anchor;             // Pin position to a screen edge/corner (Phase 1 core)
  bindings?: VariableBinding[]; // Wire to game state (Phase 3)
}
```

> **Stacking order rule:** Within any parent node, `children[0]` is rendered *behind* `children[1]`, which is behind `children[2]`, etc. This is the **absolute rule** — importers MUST respect this array order as the z-index stack. A flat `elements[]` array in the export MUST preserve each parent's `children[]` ordering. If an engine needs an explicit z-index number, the adapter derives it from position in the `children` array (first = lowest, last = highest).

### 4.2 Element Types

| Type | Description | Key Props |
|------|-------------|-----------|
| `canvas` | Root container. Always present. Single instance. | width, height, backgroundColor |
| `panel` | Generic rectangular container. Equivalent to a `<div>`. | x, y, width, height, backgroundColor, borderRadius, opacity, padding |
| `text` | Text label. Can be plain or styled. | x, y, width, height, text, fontSize, fontFamily, color, textAlign, lineHeight |
| `image` | Bitmap/spritesheet display. | x, y, width, height, src, objectFit, opacity |
| `button` | Clickable element. Has states (normal, hover, pressed). | x, y, width, height, label, backgroundColor, color, borderRadius, hoverColor, pressedColor |
| `scroll` | Scrollable container. Clips overflow, shows scrollbar. | x, y, width, height, scrollDirection, backgroundColor |
| `spacer` | Invisible space-filler for layout. No visual output. | x, y, width, height |

### 4.3 Role Tags

Role tags are the **bridge between layout and engine**. They tell the runtime what a node *means*, not just what it *looks like*.

| Role Tag | Description | NGE Mapping | Godot Mapping | Unity Mapping |
|----------|-------------|-------------|---------------|---------------|
| `dialogue_box` | Main dialogue container | DialogueSystem container | PanelContainer | UnityEngine.UI.Image |
| `dialogue_text` | Speaker's words | Typewriter text | RichTextLabel | TMPro.TextMeshProUGUI |
| `speaker_name` | Speaker name label | DialogueSystem speaker | Label | TMPro.TextMeshProUGUI |
| `portrait_left` | Left-aligned character portrait | CharacterSystem left sprite | TextureRect | UnityEngine.UI.Image |
| `portrait_right` | Right-aligned character portrait | CharacterSystem right sprite | TextureRect | UnityEngine.UI.Image |
| `choice_container` | Holds choice buttons | DialogueSystem choices | VBoxContainer | Vertical Layout Group |
| `choice_button` | Individual choice | Choice button | Button | UnityEngine.UI.Button |
| `menu_background` | Menu/title screen BG | MenuScene background | TextureRect | UnityEngine.UI.Image |
| `menu_title` | Game title text | MenuScene title | Label | TMPro.TextMeshProUGUI |
| `menu_button` | Menu action button | MenuScene button | Button | UnityEngine.UI.Button |
| `hud_bar` | Health/mana/status bar | HP/MP bar | ProgressBar | UnityEngine.UI.Slider |
| `hud_icon` | Small icon (minimap, item) | Icon sprite | TextureRect | UnityEngine.UI.Image |
| `none` | No semantic meaning | Generic container | Control | RectTransform |

**Custom roles** can be added by users or engine adapters. The schema allows arbitrary strings — only known roles get special treatment in adapters.

### 4.4 Anchor System (Phase 1 Core)

Anchors pin an element to a screen edge or corner so it **stays in place when the canvas is resized or the game runs at a different resolution than the design resolution**. This is not optional — even a dialogue box pinned to the bottom-center needs to know it's pinned there, not just "at y=520".

```typescript
// The nine-point anchor grid. Default is 'top-left' (absolute positioning).
type Anchor = 'top-left' | 'top-center' | 'top-right' |
              'center-left' | 'center' | 'center-right' |
              'bottom-left' | 'bottom-center' | 'bottom-right';
```

**How anchors work in export:**

When `anchor` is set on an element, the adapter converts the element's `x, y` from design-resolution absolute coordinates into the target engine's anchor equivalent:

| Anchor | Meaning | NGE adapter behavior | Godot adapter behavior | Unity adapter behavior |
|--------|---------|---------------------|----------------------|----------------------|
| `top-left` | Default. Element stays pinned to top-left. | No transformation needed (0,0 origin). | anchor_left=0, anchor_top=0 | anchorMin(0,0) anchorMax(0,0) |
| `bottom-center` | E.g. dialogue box. | Re-map y relative to canvas bottom. | anchor_left=0.5, anchor_top=1 | anchorMin(0.5,1) anchorMax(0.5,1) |
| `center` | Centered overlay. | Re-map both x and y relative to canvas center. | anchor_left=0.5, anchor_top=0.5 | anchorMin(0.5,0.5) anchorMax(0.5,0.5) |

Elements with `anchor: 'top-left'` and absolute `x, y` behave exactly like the old Phase 1 model — no responsive behavior. The anchor field is **opt-in progressive enhancement**: start with top-left (static), add anchors as needed for dialogue boxes, HUDs, and menu elements.

**Advanced constraints** (stretch, min/max dimensions, pin rules) remain in Phase 3. The Phase 1 anchor system covers the 80% case: "this element belongs in this corner/edge/center."

### 4.5 Asset Path Virtualization

Image `src` fields in the export schema use **asset URIs**, not raw file paths:

```
asset://ui/portraits/hero.png
asset://backgrounds/BG_throne.png
```

The `asset://` scheme is a **virtual path** — it identifies the asset by a stable, engine-agnostic key. It is NOT a filesystem path.

**Adapter resolution rules:**

| Adapter | `asset://` resolution |
|---------|----------------------|
| NGE | Strip scheme: `ui/portraits/hero.png` → looked up in NGE's `public/assets/` directory |
| Godot | Replace with `res://assets/ui/portraits/hero.png` |
| Unity | Replace with `Assets/UI/Portraits/hero.png` |
| Unreal | Replace with `/Game/UI/Portraits/hero` (no extension — UE manages this) |
| LÖVE | Strip scheme: `ui/portraits/hero.png` |
| MonoGame | Strip scheme: `ui/portraits/hero.png` → `Content/UI/Portraits/hero` (no extension for pipeline) |

In Phase 1, the editor stores whatever path string the user enters. The `asset://` prefix is automatically prepended on export. Phase 2 adds an asset browser that normalizes and validates these paths.

### 4.6 Variable Bindings (Phase 3)

```typescript
interface VariableBinding {
  property: string;   // 'text' | 'visible' | 'width' | 'height' | 'color' | 'src'
  variable: string;   // Game state variable name (e.g. 'player_health')
  transform?: string; // Optional pipe: 'bool_to_visible' | 'int_to_bar' | 'key_to_sprite'
}
```

---

## 5. Export Schema (layouteer-ui v1)

This is the **universal interchange format** — the only thing importers need to understand.

```json
{
  "schemaVersion": "1.0",
  "exportType": "layouteer-ui",
  "canvas": {
    "width": 1280,
    "height": 720,
    "backgroundColor": "#0a0a1a"
  },
  "elements": [
    {
      "id": "abc123",
      "name": "Dialogue Box",
      "type": "panel",
      "role": "dialogue_box",
      "anchor": "bottom-center",
      "props": {
        "x": 50, "y": 520,
        "width": 1180, "height": 180,
        "backgroundColor": "#22224488",
        "borderRadius": 8,
        "opacity": 1,
        "padding": { "x": 30, "y": 20 }
      },
      "children": ["def456", "ghi789"]
    },
    {
      "id": "def456",
      "name": "Speaker Name",
      "type": "text",
      "role": "speaker_name",
      "anchor": "top-left",
      "props": {
        "x": 0, "y": 0,
        "width": 200, "height": 30,
        "text": "Speaker",
        "fontSize": 22,
        "fontFamily": "monospace",
        "color": "#00ccff",
        "textAlign": "left"
      }
    },
    {
      "id": "ghi789",
      "name": "Dialogue Text",
      "type": "text",
      "role": "dialogue_text",
      "anchor": "top-left",
      "props": {
        "x": 0, "y": 35,
        "width": 1120, "height": 125,
        "text": "Hello, world!",
        "fontSize": 28,
        "fontFamily": "monospace",
        "color": "#ffffff",
        "textAlign": "left"
      }
    },
    {
      "id": "img001",
      "name": "Hero Portrait",
      "type": "image",
      "role": "portrait_left",
      "anchor": "bottom-left",
      "props": {
        "x": 50, "y": 200,
        "width": 300, "height": 300,
        "src": "asset://characters/hero_happy.png",
        "objectFit": "contain",
        "opacity": 1
      }
    }
  ]
}
```

**Key design decisions:**

- **Flat `elements[]` array, not nested.** Children are referenced by ID. Importers build their own tree. This avoids deep nesting and simplifies diffing.
- **Stacking order is explicit.** Within any parent's `children[]` array, elements are rendered back-to-front: index 0 is the bottom layer, the last element is on top. This is the **canonical z-order rule** — adapters MUST derive any engine-specific z-index from this ordering.
- **No engine-specific data in the schema.** Role tags are semantic; engine mapping lives in the adapter, not the export.
- **Positions are absolute pixels** relative to the canvas origin (top-left). Adapters convert to their engine's coordinate system. Anchors provide responsive positioning hints.
- **Props are typed.** Numbers are numbers, colors are hex strings with optional alpha (`#RRGGBBAA`), fonts are font family names.
- **Asset paths use `asset://` virtual URIs.** No raw filesystem paths. Adapters resolve `asset://` to their engine's convention (`res://`, `Assets/`, `/Game/`, etc.).

---

## 6. Export Adapters

### 6.1 Adapter Contract

Each adapter is a standalone module that takes the export JSON and produces engine-native output.

```typescript
interface ExportAdapter {
  name: string;          // 'nge' | 'godot' | 'unity' | 'unreal' | 'love' | 'monogame'
  label: string;         // 'NGE (Phaser 4)' | 'Godot 4' | etc.
  fileExtension: string; // '.json' | '.tscn' | '.prefab' | etc.
  export(layout: LayouteerSchema): string | Blob;
}
```

Adapters are **build-time or CLI-time** tools. They are NOT loaded into the editor at runtime. The editor exports the universal JSON; the adapter runs as a separate step.

### 6.2 Adapter Table

| Adapter | Target | Output | Status | Notes |
|---------|--------|--------|--------|-------|
| NGE | Phaser 4 (NGE engine) | JSON → theme/scene patch | **Phase 1** | Maps roles to NGE's DialogueSystem, MenuScene, CharacterSystem |
| Godot 4 | Godot 4.x | `.tscn` file (text format) | Phase 2 | Controls, TextureRects, RichTextLabels |
| Unity | Unity 2022+ | `.prefab` (YAML text) | Phase 2 | RectTransform hierarchy, TMPro, Canvas |
| Unreal | UE5 | JSON → UMG Widget Blueprint import | Phase 2 | Generates Python script for Editor Utility Widget |
| LÖVE | LÖVE2D | Lua table dump | Phase 3 | Simple x/y/w/h rectangle definitions |
| MonoGame | MonoGame | C# partial class | Phase 3 | Generates `InitializeComponent()` style code |

### 6.3 NGE Adapter (Phase 1 Detail)

The NGE adapter is the first one built, since Layouteer lives inside the NGE repo. It converts the export JSON into two things:

1. **Theme patch** — merges element positions/sizes into `data/theme.json` format for DialogueSystem and MenuScene
2. **Scene layer definitions** — generates `layers[]` entries for a scene's visual composition

```javascript
// Example: NGE adapter output for a dialogue_box role
{
  "dialogue": {
    "textBoxSize": { "width": 1180, "height": 180 },
    "textBoxPosition": { "x": 50, "y": 520 },
    "fontSize": 28,
    "fontFamily": "monospace",
    "textColor": "#ffffff",
    "backgroundColor": "#22224488",
    "padding": { "x": 30, "y": 20 }
  }
}
```

The adapter is a pure function — no Phaser imports, no DOM. It can run in Node.js or the browser.

---

## 7. UI Specification

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Layouteer   │  1280×720  │  Snap: 20px ☑  │  Export ▼  │
├────────┬──────────────────────────────────┬────────────────┤
│ ELEMENT│                                  │  PROPERTIES    │
│        │                                  │                │
│ ▼ Root │     ┌────────────────────┐       │  Name: [...]   │
│   □  Dial│     │                    │       │  Type: panel   │
│   □  Spe│     │  [Dialogue Box]    │       │  Role: dialogu │
│   □  Dia│     │  "Hello, world!"   │       │                │
│   □  Por│     │                    │       │  ── Geometry ──│
│        │     └────────────────────┘       │  X: 50  Y: 520│
│ ────── │                                  │  W: 1180  H:180│
│ +ADD ▼ │     1280 × 720 Canvas            │                │
│        │                                  │  ── Style ──   │
│        │                                  │  Bg: #22224488 │
│        │                                  │  Radius: 8     │
│        │                                  │  Opacity: 1    │
├────────┴──────────────────────────────────┴────────────────┤
│  ◄ Elements: 4  │  Selected: Dialogue Box  │  1280×720    │
└─────────────────────────────────────────────────────────────┘
```

Standard three-panel editor layout:
- **Left panel (240px):** Element hierarchy tree + add controls
- **Center canvas:** Artboard with grid, snap, zoom, pan
- **Right panel (320px):** Context-sensitive properties

### 7.2 Top Toolbar

| Control | Type | Description |
|---------|------|-------------|
| Resolution | Dropdown | Presets: 1280×720 (HD), 1920×1080 (FHD), 2560×1440 (QHD), 3840×2160 (4K), Custom |
| Snap toggle | Checkbox | Enable/disable grid snapping |
| Grid size | Dropdown | 5/10/20/40/50/100px |
| Zoom | Slider + % label | 25%–400%, fit-to-canvas default |
| Undo / Redo | Buttons | Ctrl+Z / Ctrl+Shift+Z |
| Save | Button | Save project to IndexedDB |
| Export ▼ | Dropdown button | Export JSON / Export for NGE / Export for Godot / etc. |

### 7.3 Element Hierarchy Panel (Left)

- Tree view of all nodes with expand/collapse
- Click to select, double-click to rename
- Per-node icon by type (panel=□, text=T, image=🖼, button=☑, scroll=↕, spacer=blank)
- Drag-and-drop to reorder / reparent
- Context menu: Duplicate, Delete, Lock, Hide
- "Add Element" dropdown at bottom: Panel, Text, Image, Button, Scroll Region, Spacer

### 7.4 Canvas

- Fixed-size artboard matching the configured resolution
- Grid overlay (when snap enabled): dotted lines at gridSize intervals
- Element rendering:
  - Panels: colored rectangles with optional border-radius
  - Text: rendered text with actual font/size (fallback to system fonts)
  - Images: placeholder rectangles with aspect-ratio-locked preview (asset loading in Phase 2)
  - Buttons: panel + centered label, hover state preview
  - Scroll regions: dashed border to indicate overflow container
  - Spacers: hatched/transparent rectangles (not exported)
- **Interaction:**
  - Click to select (shows resize handles)
  - Drag to move (with snap)
  - Resize handles on corners and edges (8 handles)
  - Double-click text elements to edit inline
  - Right-click for context menu
  - Click empty space to deselect
- **Zoom & Pan:**
  - Scroll wheel to zoom (centered on cursor)
  - Middle-mouse-drag to pan
  - Ctrl+0 to reset view

### 7.5 Properties Panel (Right)

Context-sensitive: shows properties for the selected element type. Common sections:

**Identity:**
- Name (text input)
- Type (read-only badge)
- Role (dropdown — the semantic tag list)

**Geometry:**
- X, Y, Width, Height (number inputs with scroll-step)
- Anchor — 9-point grid selector visual (click a dot to set anchor). Default: top-left.

**Style (type-dependent):**
- Panels: backgroundColor, borderRadius, opacity, padding, borderWidth, borderColor
- Text: text content, fontSize, fontFamily, color, textAlign, lineHeight, bold, italic
- Images: src (file picker), objectFit (contain/cover/fill), opacity
- Buttons: all of panel + label, hoverColor, pressedColor
- Scroll: scrollDirection (vertical/horizontal/both), backgroundColor

**Layout (Phase 3):**
- Stretch options (fill parent width/height)
- Pin X/Y independently
- Min/max size constraints

**Bindings (Phase 3):**
- Variable bindings list
- Add/remove binding controls

---

## 8. Phased Feature Plan

### Phase 1 — Foundation (Current → MVP)

Goal: A usable layout editor that can export NGE-compatible theme JSON.

- [x] Canvas with configurable resolution
- [x] Hierarchy panel with add/delete
- [x] Properties panel with role tags
- [x] Snap-to-grid with configurable size
- [x] Drag to position elements
- [x] Zustand flat node store
- [x] Basic JSON export
- [x] **Resize handles** — drag corners/edges to resize elements
- [x] **Element types: image, button** — complete the type palette
- [x] **Layer ordering** — z-index control (reorder within `children[]`), bring forward/send backward
- [x] **Anchoring** — nine-point anchor grid on every element (top-left default). Properties panel gets an anchor selector. Export includes `anchor` field.
- [x] **Multi-select** — shift-click, group move
- [x] **Save/load projects** — IndexedDB persistence with project list
- [x] **Undo/redo** — Zustand temporal middleware
- [x] **NGE adapter** — export role-tagged JSON → theme.json patch
- [x] **Asset URI export** — `src` fields use `asset://` virtual paths in export
- [x] **Resolution presets** — dropdown for common game resolutions + custom
- [x] **Inline text editing** — double-click to edit text content directly on canvas
- [x] **Keyboard shortcuts** — Delete, Ctrl+Z/Y, Ctrl+D (duplicate), arrow keys (nudge)
- [x] **Zoom & pan** — scroll wheel zoom, middle-drag pan, fit-to-canvas button

### Phase 2 — Engine Adapters & Visual Polish

Goal: Export to real engines; make the editor feel professional.

- [x] **Godot 4 adapter** — `.tscn` scene file generation
- [x] **Unity adapter** — `.prefab` YAML generation
- [x] **Asset panel** — side panel or tab to browse/manage imported images
- [x] **Image element rendering** — show actual images on canvas (not just placeholders)
- [x] **Font preview** — render text with the actual selected font (web fonts loaded from assets)
- [x] **Alignment toolbar** — align left/center/right, distribute horizontally/vertically
- [x] **Color picker** — visual color picker instead of hex string input
- [x] **Project templates** — start from presets (Visual Novel, RPG Menu, FPS HUD, etc.)
- [x] **Drag-and-drop reparenting** in hierarchy tree
- [ ] **Export preview** — show what each adapter will produce before exporting
- [x] **Unreal adapter** — Python UMG generation script

### Phase 3 — Advanced Features

Goal: Animation, variable bindings, and advanced responsive layout for production workflows.

- [ ] **Advanced constraints** — stretch-to-fill, min/max dimensions, pin X/Y independently
- [ ] **Variable bindings** — wire element properties to game state variables
- [ ] **Animation timeline** — keyframe animations for UI transitions (enter/exit/hover)
- [ ] **Style theming** — global color palette, font sets, apply across project
- [ ] **Component library** — save and reuse element groups as components
- [ ] **LÖVE and MonoGame adapters** — Lua table and C# class generation
- [ ] **Plugin system** — custom element types and role tags via extensions
- [ ] **Multi-canvas support** — multiple screens in one project (title, menu, game HUD, pause)
- [ ] **Responsive preview** — test at different resolutions with anchor system
- [ ] **Import from engine** — reverse adapters that parse Godot scenes, Unity prefabs, etc. into Layouteer format

---

## 9. Technical Decisions

### 9.1 Why Zustand?

- **Flat node map** — O(1) lookups by ID, no tree traversal needed for updates
- **Temporal middleware** — free undo/redo with a single middleware add
- **Minimal boilerplate** — no reducers, no actions objects, just functions
- **Small bundle** — ~1KB for the core; critical for a tool that may be embedded

### 9.2 Why Not Canvas/WebGL Rendering?

The editor renders elements as DOM nodes (`<div>`, `<span>`) because:
- **Hit testing is free** — no need to implement selection logic, CSS does it
- **Text rendering matches the browser** — WYSIWYG for text is near-perfect
- **Accessibility** — DOM nodes support screen readers, keyboard nav, ARIA
- **Simplicity** — way less code than a custom Canvas renderer

The *game runtime* uses Phaser/Unity/Godot's own renderers. The editor just needs to look right, not run at 60fps.

**When we need pixel-perfect preview** (Phase 2), we'll add a "Preview" tab that runs the actual NGE scene in an iframe — not try to replicate its rendering in the editor.

### 9.3 Why Flat Export Schema?

Nested trees look intuitive but cause problems:
- **Diffing is hard** — two exports can have the same visual output but different tree shapes
- **IDs are stable** — flat with IDs means elements survive reorderings
- **Adapters are simpler** — loop over `elements[]`, look up children by ID, build engine tree
- **Partial updates** — NGE can patch just one element without replacing the whole theme

### 9.4 Why Separate Adapters?

- **Editor stays small** — no Phaser/Unity/Godot code in the editor bundle
- **Adapters can be language-specific** — Godot adapter can be Python, Unity adapter C#
- **Version independence** — engine adapters update on engine release schedules
- **Community contributions** — anyone can write an adapter without touching the editor core

### 9.5 Position System: Absolute Pixels + Anchors

The canvas uses **absolute pixel positioning** (top-left origin, Y-down) as the primary coordinate system. This matches:
- NGE's coordinate system (1280×720)
- CSS absolute positioning (direct DOM rendering)
- Most 2D game engines' coordinate systems

**However, absolute pixels alone are brittle.** A dialogue box at y=520 stays at y=520 no matter the screen size. That's why **anchors ship in Phase 1** — every element gets an `anchor` field (default: `top-left`) that tells adapters how to re-map its position when the output resolution differs from the design resolution.

The combination works like this:
- **x, y** = position relative to the anchor point
- **anchor** = which corner/edge/center of the canvas the element is pinned to
- Adapters convert `(anchor, x, y)` into their engine's native position system

This means Phase 1 exports are **not brittle** — a `bottom-center` anchored dialogue box will correctly position at the bottom of the screen regardless of resolution, even before Phase 3's stretch/min-max constraints.

---

## 10. Coordinate System & Resolution Handling

### 10.1 Design Resolution vs. Display Resolution

- **Design resolution** is the canvas size (default 1280×720). All node positions are in this coordinate space.
- **Display resolution** is whatever the player uses. That's the adapter's problem.
- The editor always works in design resolution. Export format always records design resolution.
- **Every element records its anchor**, so adapters know how to reposition when the display resolution differs.

### 10.2 Responsive Behavior

Phase 1 includes **basic anchoring** (nine-point grid). An element pinned to `bottom-center` (like a dialogue box) will stay at the bottom-center regardless of display resolution. This covers the 80% case for game UI.

Phase 3 adds **advanced constraints** for the remaining 20%:
- **Stretch** — elements that fill available space (e.g. health bars that scale with panel width)
- **Pin X/Y independently** — anchor the X axis to one edge but the Y to another
- **Min/max constraints** — elements that scale within bounds but won't exceed maximums

---

## 11. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Delete / Backspace | Delete selected element |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+D | Duplicate selected element |
| Ctrl+S | Save project |
| Ctrl+E | Export (opens dropdown) |
| Arrow keys | Nudge selected element by 1px (10px with Shift) |
| Escape | Deselect / close inline editing |
| Ctrl+A | Select all elements |
| Ctrl+0 | Reset zoom (fit to canvas) |
| +/- | Zoom in/out |
| H | Toggle selected element visibility |
| L | Toggle selected element lock |

---

## 12. File & Project Structure

```
packages/ui-editor/
├── src/
│   ├── main.jsx                  # Entry point
│   ├── App.jsx                    # Root layout (3-panel)
│   ├── App.css                    # Global styles
│   ├── index.css                  # Tailwind + reset
│   ├── components/
│   │   ├── Canvas.jsx             # Artboard + element rendering
│   │   ├── CanvasNode.jsx         # Individual element on canvas
│   │   ├── HierarchyPanel.jsx     # Element tree + add/delete
│   │   ├── PropertiesPanel.jsx    # Context-sensitive prop editor
│   │   ├── Toolbar.jsx            # Top toolbar (resolution, snap, zoom)
│   │   ├── StatusBar.jsx          # Bottom status bar
│   │   ├── ColorPicker.jsx        # Inline color picker (Phase 2)
│   │   └── AssetPanel.jsx         # Asset browser (Phase 2)
│   ├── store/
│   │   └── useLayoutStore.js      # Zustand store + undo/redo
│   ├── hooks/
│   │   ├── useDrag.js             # Drag-to-move logic
│   │   ├── useResize.js           # Resize handle logic
│   │   ├── useKeyboard.js         # Global shortcut handler
│   │   └── useZoomPan.js          # Canvas zoom/pan
│   ├── utils/
│   │   ├── exporter.js            # Universal JSON export
│   │   ├── adapters/
│   │   │   ├── nge.js             # NGE (Phaser 4) adapter
│   │   │   ├── godot.js           # Godot 4 adapter
│   │   │   ├── unity.js           # Unity adapter
│   │   │   └── unreal.js           # Unreal UMG adapter
│   │   └── geometry.js            # Snap, bounds, intersection helpers
│   └── constants/
│       ├── elementTypes.js         # Element type definitions
│       └── roleTags.js             # Role tag registry
├── public/
│   └── templates/                  # Starter project templates (Phase 2)
├── package.json
├── vite.config.js
└── DESIGN.md                       # This file
```

---

## 13. Style System (Phase 2)

A style is a named collection of properties that can be applied to multiple elements:

```json
{
  "styles": {
    "dialog-text": {
      "fontSize": 28,
      "fontFamily": "monospace",
      "color": "#ffffff",
      "lineHeight": 1.4
    },
    "button-primary": {
      "backgroundColor": "#3b82f6",
      "color": "#ffffff",
      "borderRadius": 8,
      "padding": { "x": 16, "y": 8 }
    }
  }
}
```

Elements reference styles by name: `"style": "dialog-text"`. Inline props override style defaults. This is the Phase 2 version of "CSS for game UI."

---

## 14. NGE Integration Path

Layouteer lives in `packages/ui-editor/` inside the NGE monorepo. The integration path:

1. **Phase 1:** Editor exports universal JSON → user manually copies values into `data/theme.json` and scene files
2. **Phase 1.5:** NGE adapter generates `theme.json`-compatible JSON directly (one-click export)
3. **Phase 2:** Editor communicates with NGE dev server via API — export writes directly to `data/theme.json` and `data/scenes/`

The NGE adapter's role mapping:

```
dialogue_box  → theme.json: dialogue.textBoxSize, textBoxPosition, backgroundColor, padding
dialogue_text → theme.json: dialogue.fontSize, fontFamily, textColor
speaker_name  → (new) theme.json: dialogue.speakerNameColor, speakerNameSize
portrait_*    → character metadata: portrait position/size
menu_*        → theme.json: ui.menu.*
choice_*      → (runtime) DialogueSystem choice rendering
```

---

## 15. Open Questions — Resolved

1. **Inline editing UX:** Properties panel is primary for v1. Inline double-click editing is visual polish for later — it requires handling contentEditable focus, font-scaling, and keystroke leaks to global shortcuts. Build panel inputs first; add inline editing as a Phase 2 enhancement.

2. **Multi-canvas scope:** One canvas per file for v1. A canvas = a "screen" or "scene." Users who need a main menu and a gameplay HUD create two separate Layouteer projects. A project-wide catalog linking multiple screens can be added in Phase 3.

3. **Asset management:** External only for Phase 1. Images are referenced by path string. The editor reads whatever the user enters; the export normalizes it to `asset://` URIs. No built-in asset tracking until Phase 2's asset panel.

4. **Live preview:** Phase 2 iframe preview for NGE only. Other engines require export + manual import. Not a Phase 1 concern.

5. **Custom role tags:** v1 ships with the built-in set only. Phase 2 adds a string input for custom roles so writers can define engine-specific tags.

6. **Stacking order:** **Resolved.** `children[]` array order is the canonical back-to-front z-order. Index 0 = bottom, last = top. Adapters MUST derive z-index from this ordering. No separate z-index field.

7. **Asset path virtualization:** **Resolved.** All image `src` fields use `asset://` URI scheme. Adapters resolve to engine-native paths on export. No raw filesystem paths in the schema.

8. **Anchoring in Phase 1:** **Resolved.** Basic 9-point anchoring ships in Phase 1. Default `top-left` means no responsive behavior (backward compatible with pure absolute positioning). Advanced constraints (stretch, pin X/Y independently, min/max) are Phase 3.

---

## 16. Glossary

| Term | Definition |
|------|-----------|
| **Anchor** | A nine-point grid position (corner/edge/center) that pins an element to a screen region. Determines how the element repositions when display resolution changes. |
| **Artboard** | The fixed-size canvas where elements are placed. Matches the game's design resolution. |
| **Asset URI** | A virtual path using the `asset://` scheme (e.g. `asset://characters/hero.png`). Adapters resolve these to engine-native paths on export. |
| **Adapter** | A module that converts Layouteer JSON into an engine-specific format. |
| **Canvas** | The root element. All other elements are its descendants. |
| **Constraints** | Advanced responsive rules (stretch, pin X/Y independently, min/max dimensions). Phase 3. |
| **Element** | A single UI component on the canvas (panel, text, image, button, scroll, spacer). |
| **Export** | The process of converting the editor's state into the universal JSON format. |
| **Node** | Internal representation of an element in the Zustand store. |
| **Project** | A saved Layouteer workspace — canvas size, elements, styles, and bindings. |
| **Role Tag** | A semantic label (e.g. `dialogue_box`) that tells the runtime adapter what an element means. |
| **Schema** | The Layouteer JSON format specification. Versioned independently of the editor. |
| **Stacking order** | The back-to-front rendering order of children within a parent. `children[0]` = bottom, `children[last]` = top. |

---

*Last updated: 2026-06-16 (rev 2 — stacking order, anchors to Phase 1, asset URIs)*
*Author: Layouteer design sessions (Adam + Hermes)*