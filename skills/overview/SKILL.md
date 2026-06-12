---
name: narrative-engine-overview
description: "Project-level guide for the Narrative Engine — a data-driven visual novel / branching-narrative engine built on Phaser 4. Covers project structure, data schema, agent conventions, and how the skill files map to modules. Load this first when starting work on any part of the engine."
---

# Narrative Engine — Agent Overview

> A data-driven narrative game engine on Phaser 4. Stories are JSON scene files fed into a graph-based state machine. The engine renders them as a visual novel / branching-narrative game. A standalone dialogue editor lets writers build scenes visually.

**Repo:** `narrative-engine/` (Phaser 4 + Vite)

The agent owns the full project — engine, data, tools, assets — and edits freely across all directories. Only ask before destructive changes to user-authored content.

## Project Structure

```
narrative-engine/
├── src/                    # Engine code
│   ├── main.js             # Phaser game config
│   ├── scenes/
│   │   ├── BootScene.js    # Fetches JSON, populates Data store
│   │   └── GameScene.js    # Main loop, wires all systems
│   └── systems/
│       ├── DataLoader.js      # Global Data store
│       ├── SceneController.js # Graph narrative state machine
│       ├── DialogueSystem.js  # Typewriter text box, choices
│       ├── CharacterSystem.js # Portrait display, expressions
│       ├── VariableSystem.js  # Flags/counters, conditions
│       ├── SaveSystem.js      # LocalStorage save/load
│       └── AudioSystem.js     # BGM/SFX manager
├── data/                   # Story content
│   ├── game.json           # Master config
│   ├── characters.json     # Character defs
│   ├── variables.json      # Variable defs
│   └── scenes/*.json       # One JSON file per scene
├── tools/                  # Editors
│   └── dialogue-editor/    # Standalone node graph editor
├── skills/                 # Agent skill files (per-module)
└── index.html
```

## How the Agent Skills Map to Modules

| Skill directory | Source file | Purpose |
|----------------|-------------|---------|
| `scene-controller/` | `src/systems/SceneController.js` | Graph-based narrative state machine |
| `dialogue-system/` | `src/systems/DialogueSystem.js` | Typewriter text, choices, nameplates |
| `character-system/` | `src/systems/CharacterSystem.js` | Portrait display, expressions |
| `variable-system/` | `src/systems/VariableSystem.js` | Flags, counters, condition evaluation |
| `save-system/` | `src/systems/SaveSystem.js` | LocalStorage save/load |
| `audio-system/` | `src/systems/AudioSystem.js` | BGM/SFX manager |
| `data-loader/` | `src/systems/DataLoader.js` | Data store, fetch-based loading |
| `boot-scene/` | `src/scenes/BootScene.js` | Boot, fetch, populate Data |
| `game-scene/` | `src/scenes/GameScene.js` | Main loop, system wiring, input |
| `editor-app/` | `tools/app.js` | Integrated editor application |

The dialogue editor at `tools/dialogue-editor/SKILL.md` is already documented in-repo.

## Data Schema (Quick Reference)

### Scene JSON
```json
{
  "id": "scene_id",
  "entryNode": "start",
  "background": null,
  "music": null,
  "nodes": [
    { "id": "start", "type": "dialogue", "speaker": "narrator", "text": "...", "next": "node2", "x": 400, "y": 30 }
  ]
}
```

**Node types:** `dialogue`, `choice`, `condition`, `event`, `wait`, `end`

**Navigation is always explicit** — every node flows via `next`, `else`, or `choices[].next` fields. Never sequential index.

### Condition Format
```
"variable_name == value"
"variable_name >= 30"
"has_flag == true"
```
Operators: `==` `!=` `>=` `<=` `>` `<`. Values can be booleans, numbers, or quoted strings.

## Key Conventions

- **Use `fetch()` not Phaser's loader** — Phaser's built-in JSON loader has path issues with Vite's dev server. Always use `fetch()` with absolute paths (`/data/...`).
- **Vite `fs.strict: false`** — needed to serve the `data/` directory.
- **Functions from innerHTML** — must be exposed on `window.*` because Vite wraps inline `<script>` in module scope.
- **New scene?** Add the JSON to `data/scenes/`, register it in `game.json`'s scene list, and add a `fetch()` call in `BootScene.create()`.

## Related Skills

See each module's skill for detailed API docs. Start with the system you're modifying and load that skill.
