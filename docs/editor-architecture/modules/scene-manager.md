# Module: Scene Manager

**ID:** `scene-manager`
**File:** `tools/views/scenes.js`
**Lifecycle:** Per-render
**Panel:** Workspace → Scenes tab

---

## Purpose

List, create, delete, and rename scenes. Shows metadata per scene (node count, word count, choice count, last modified).

---

## UI

```
┌───────────────────────────────────────────┐
│ Scenes                   [+ Add Scene]    │
├───────────────────────────────────────────┤
│  🎬 start                                 │
│     📄 5 nodes   📝 120 words   🔀 2 choices │
│     Last modified: 2h ago                  │
│     [Duplicate] [Rename] [Delete] [Export] │
├───────────────────────────────────────────┤
│  🎬 chapter_1                              │
│     📄 12 nodes  📝 340 words  🔀 5 choices │
│     ...                                    │
└───────────────────────────────────────────┘
```

---

## API

```js
init(app): void
render(container, app): void
```

Scene list data comes from `editorState.gameConfig.scenes[]`. Individual scene stats (node/word/choice counts) are computed from `editorState.scenes[id]`.
