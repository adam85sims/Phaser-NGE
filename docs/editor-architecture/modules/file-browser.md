# Module: File Browser

**ID:** `file-browser`
**File:** `tools/views/files.js`
**Lifecycle:** Per-render
**Panel:** Workspace → Files tab

---

## Purpose

Folder tree navigation and file management. Shows project file structure in a left tree + right grid layout. Supports expand/collapse, rename, delete, and file selection.

---

## UI Layout

```
┌───────────────────┬──────────────────────────┐
│   FILE TREE       │   FILE GRID              │
│                   │   (thumbnails / list)    │
│   📂 data/        │                          │
│   📂 public/      │  📄 game.json            │
│   📂 tools/       │  📄 characters.json      │
│   📄 app.js       │  📄 variables.json       │
│   📄 app.css      │  📄 theme.json           │
│   📂 views/       │  📂 scenes/              │
│                   │    📄 start.json         │
└───────────────────┴──────────────────────────┘
```

---

## API

```js
init(app): void
render(container, app): void
```

---

## Tree Node Structure

Each tree node is a `<div class="tree-node">` containing:
- A `.tree-item` row with chevron, icon, name
- A `.tree-children` block container (for folders)

The children container is **block-level**, not a flex sibling — this is critical for proper vertical alignment.

```html
<div class="tree-node">
  <div class="tree-item" data-path="${path}" data-type="${type}"
       style="padding-left:${depth * 16}px">
    <span class="tree-chevron ${expanded ? 'expanded' : ''}">▶</span>
    <span>${icon}</span>
    <span>${name}</span>
  </div>
  ${childrenHtml}
</div>
```

---

## Features

- **Expand/collapse** — folders toggle with chevron rotation
- **Expand All / Collapse All** — toolbar buttons
- **Context menu** — right-click on items: Open, Rename, Delete, Reveal in Files
- **Single click** — select file, show in grid
- **Drag** — (future) drag file into scene
