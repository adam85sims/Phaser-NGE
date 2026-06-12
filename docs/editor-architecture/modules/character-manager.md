# Module: Character Manager

**ID:** `character-manager`
**File:** `tools/views/characters.js`
**Lifecycle:** Per-render
**Panel:** Workspace → Characters tab

---

## Purpose

Manage character definitions: display name, nameplate color, portrait expressions. Links characters to their portrait images.

---

## UI Layout (Three Columns)

```
┌─────────────────────┬──────────────────────────┬──────────────┐
│  Character List     │  Character Details        │ Preview Card │
│   (220px)           │  (flex: 1)               │   (240px)    │
│                     │                           │              │
│  👤 Dave            │  ID:     [________]      │  ┌────────┐  │
│    0 refs           │  Name:   [________]      │  │   D    │  │
│  👤 Narrator        │  Color:  [■] [#00ccff]   │  └────────┘  │
│    0 refs           │  Expr:   [neutral   ▾]   │  Dave        │
│                     │                           │  ID: dave    │
│                     │  Expressions & Portraits  │  Exprs: 1    │
│                     │  [neutral → dave_n.png] 👁│  Refs: 0     │
│                     │  [happy   → dave_h.png] 👁│              │
│                     │                           │  [📤 Upload] │
│                     │  [Duplicate] [Delete]     │              │
│                     │  Used in: scene1, scene2  │              │
└─────────────────────┴──────────────────────────┴──────────────┘
```

---

## Data Model

```json
{
  "dave": {
    "name": "Dave",
    "color": "#00ccff",
    "portraits": {
      "neutral": "dave_neutral.png",
      "happy": "dave_happy.png",
      "angry": "dave_angry.png"
    },
    "defaultExpression": "neutral"
  }
}
```

---

## API

```js
init(app): void
render(container, app): void
```

Character data is stored in `editorState.characters` and saved as part of the project.

---

## Portrait Integration

Portraits live in `public/assets/characters/`. The character editor links expressions to filenames:

1. Upload via drag or file picker → `/assets/characters/{id}_{expr}.png`
2. Preview loads via `new Image()` to preload and check success
3. On load error, the expression assignment is cleared

---

## Usage Tracking

`_buildUsage()` scans all scene nodes' `speaker` fields to count references. Displayed as "Used in scenes: start, chapter1". Scene names are clickable and navigate to that scene in the dialogue editor.
