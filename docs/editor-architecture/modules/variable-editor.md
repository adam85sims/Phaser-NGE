# Module: Variable Editor

**ID:** `variable-editor`
**File:** `tools/views/variables.js`
**Lifecycle:** Per-render
**Panel:** Workspace → Variables tab

---

## Purpose

Define game state variables (flags, counters) used in narrative conditions. Each variable has a type, default value, and description.

---

## Data Model

```json
{
  "courage": {
    "type": "number",
    "defaultValue": 50,
    "description": "Dave's courage level"
  },
  "has_key": {
    "type": "boolean",
    "defaultValue": false,
    "description": "Has the rusty key"
  },
  "visited_tavern": {
    "type": "flag",
    "defaultValue": false,
    "description": "Visited the tavern"
  }
}
```

---

## UI

```
┌──────────────────────┬──────────────────────────────┐
│  Variable List       │  Variable Details             │
│   (200px)            │  (flex: 1)                    │
│                      │                               │
│  🔢 courage          │  ID:          [________]      │
│  🚩 has_key          │  Type:        [number ▾]      │
│  🚩 visited_tavern   │  Default:     [________]      │
│                      │  Description: [________]      │
│  [+ Add Variable]    │                               │
│                      │  [Duplicate]  [Delete]        │
│                      │                               │
│                      │  Used in conditions:          │
│                      │  • start.json → node_3        │
│                      │  • chapter_2.json → node_7    │
└──────────────────────┴──────────────────────────────┘
```

---

## API

```js
init(app): void
render(container, app): void
```

Variable definitions are stored in `editorState.variableDefs` and saved as part of the project.
