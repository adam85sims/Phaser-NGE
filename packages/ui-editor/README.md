# Layouteer

> **Engine-agnostic UI layout composer for game developers and narrative writers.**
> Export to NGE (Phaser 4), Godot, Unity, Unreal, LÖVE, MonoGame, and more via a universal JSON schema.

Designed for artists and writers who think in layout, not in code. Compose UI screens by dragging elements onto an artboard, tag them with semantic roles, and export the result as structured JSON that any engine adapter can consume.

---

## Quick Start

```bash
npm install
npm run dev     # → http://localhost:5173
npm run build   # → dist/
```

## Tech Stack

- **React 19** — UI rendering
- **Zustand 5** — State management with undo/redo (zundo temporal middleware)
- **Tailwind CSS 4** — Styling
- **Vite 8** — Dev server and build
- **lucide-react** — Icons

## Features (Phase 1 — Complete)

- **Canvas** with configurable resolution (HD, FHD, QHD, 4K presets)
- **Element hierarchy** — tree view with drag-to-order, add/delete
- **7 element types** — canvas, panel, text, image, button, scroll, spacer
- **Properties panel** — context-sensitive editing for each type
- **9-point anchor system** — pin elements to corners/edges/center
- **Role tags** — semantic labels (`dialogue_box`, `speaker_name`, `menu_title`, etc.) for engine mapping
- **Resize handles** — drag corners/edges to resize with snap-to-grid
- **Multi-select** — Ctrl+click for toggling, group drag
- **Undo/redo** — Ctrl+Z / Ctrl+Shift+Z with 50-step history
- **Zoom & pan** — scroll wheel zoom, middle-mouse pan, zoom controls
- **Save/load projects** — localStorage with auto-save
- **Export** — Universal JSON (`layouteer-ui`) or NGE Theme (`nge-theme`)
- **Asset URI virtualization** — `asset://` paths resolve per engine
- **Keyboard shortcuts** — Delete, Ctrl+D (duplicate), Ctrl+S (save), Escape (deselect)

## Export Adapters

| Adapter | Target | Status |
|---------|--------|--------|
| Universal JSON | Any engine via schema | ✅ Phase 1 |
| NGE (Phaser 4) | `theme.json` format | ✅ Phase 1 |
| Godot 4 | `.tscn` scene file | 🔜 Phase 2 |
| Unity | `.prefab` YAML | 🔜 Phase 2 |
| Unreal | UMG Python script | 🔜 Phase 2 |
| LÖVE / MonoGame | Lua / C# | 🔜 Phase 3 |

## Project Structure

```
src/
├── components/
│   ├── Canvas.jsx           # Artboard + element rendering + resize handles
│   ├── HierarchyPanel.jsx   # Element tree with layer ordering
│   └── PropertiesPanel.jsx  # Context-sensitive property editor + export
├── store/
│   └── useLayoutStore.js    # Zustand store (undo/redo via zundo)
├── hooks/
│   ├── useKeyboard.js       # Global keyboard shortcuts
│   └── useZoomPan.js        # Canvas zoom and pan
├── utils/
│   ├── exporter.js          # Universal JSON export
│   ├── projects.js          # Save/load to localStorage
│   └── adapters/
│       └── nge.js           # NGE (Phaser 4) adapter
├── App.jsx                  # Root layout (3-panel + dialogs)
├── main.jsx                 # Entry point
└── index.css                # Tailwind import
```

## Design Document

See `DESIGN.md` for the full architecture, data model, roadmap, and design decisions.
