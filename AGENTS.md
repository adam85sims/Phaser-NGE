# Phaser NGE — Agent Guide

## Project Overview

A data-driven narrative game engine built on Phaser 4. Stories are written as JSON scene files. The engine reads these files and renders them as a visual novel–style game. A standalone dialogue editor tool (HTML/JS/CSS) lets writers create scenes visually.

**Two-person workflow:**
- **Agent (AI):** Owns `src/` (engine code), `vite.config.js`, `package.json`
- **User (Human):** Owns `data/` (story content), `tools/` (editors), `public/assets/` (media)

## Project Structure

```
Phaser-NGE/
├── src/                       # Engine code — agent territory
│   ├── main.js                # Phaser game config
│   ├── scenes/
│   │   ├── BootScene.js       # Fetches data JSON, populates Data store
│   │   └── GameScene.js       # Main loop, wires all systems
│   └── systems/
│       ├── DataLoader.js      # Global Data store (populated by BootScene)
│       ├── SceneController.js # Graph-based narrative state machine
│       ├── DialogueSystem.js  # Typewriter text box, nameplate, choices
│       ├── CharacterSystem.js # Portrait display, expressions, positioning
│       ├── VariableSystem.js  # Flag/counter tracking, condition evaluation
│       ├── SaveSystem.js      # LocalStorage save/load
│       └── AudioSystem.js     # BGM/SFX manager
│
├── data/                      # Story content — user territory
│   ├── game.json              # Master config (title, defaults, scene list)
│   ├── characters.json        # Character definitions
│   ├── variables.json         # Game state variables
│   └── scenes/                # One JSON file per scene
│       ├── sample.json
│       ├── test-conditions.json
│       └── test-events.json
│
├── tools/                     # Editors — user territory
│   └── dialogue-editor/
│       ├── index.html
│       ├── editor.css
│       └── editor.js
│
├── skills/                    # Agent skill files (per-module reference)
│   ├── overview/              #    — project overview
│   ├── scene-controller/      #    — graph state machine
│   ├── dialogue-system/       #    — typewriter / choices
│   ├── character-system/      #    — portraits / expressions
│   ├── variable-system/       #    — flags / conditions
│   ├── save-system/           #    — localStorage persistence
│   ├── audio-system/          #    — BGM / SFX
│   ├── data-loader/           #    — Data store / fetch
│   ├── boot-scene/            #    — data loading scene
│   ├── game-scene/            #    — main loop / wiring
│   └── editor-app/            #    — integrated editor shell
│
├── public/assets/             # Media files (images, audio, fonts)
├── index.html
├── package.json
└── vite.config.js
```

## Agent Skill Files

Each module in `skills/` has a `SKILL.md` with the module's API, architecture, gotchas, and working-with-agent notes — modeled after Phaser's own skill files in `node_modules/phaser/skills/`.

**How to use them:** Before modifying any module, open its skill file for the full contract. The overview skill covers the project as a whole and the two-person workflow.

## Data Schema

### Scene File (`data/scenes/<id>.json`)

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

- `entryNode`: ID of the first node to process (graph entry point)
- `nodes[]`: Array of all nodes in the scene
- `x`, `y`: Editor-only position data for the node graph canvas
- Navigation is **always explicit**: every node flows via `next`, `else`, or `choices[].next` fields — never sequential index advancement

### Node Types

| Type | Fields | Behavior |
|------|--------|----------|
| `dialogue` | `speaker`, `text`, `expression`, `autoAdvance`, `waitTime`, `next` | Character speaks. Waits for input unless autoAdvance |
| `choice` | `prompt`, `choices[]` | Player picks. Each choice: `text`, `next`, `condition`, `setFlag`, `setValue` |
| `condition` | `condition`, `next` (true), `else` (false) | System branch. No player interaction |
| `event` | `eventType`, `eventValue`, `next` | Fire-and-forget side effect (SFX, BGM, camera shake/flash) |
| `wait` | `duration`, `next` | Timed pause |
| `end` | `text`, `nextScene` | Terminal. Ends scene, optionally transitions to another |

All node types support optional variable actions: `setFlag`, `setValue`.

## Gotchas & Conventions

### Data Loading
- BootScene uses `fetch()` with **absolute paths** (`/data/...`) to load JSON
- Phaser's built-in JSON loader (`this.load.json`) has path resolution issues with Vite's dev server — do NOT use it
- Always use `fetch()` with explicit error handling: `if (!r.ok) throw new Error(...)`

### Vite Dev Server
- Vite serves files from the project root
- Subdirectory HTML files like `/tools/dialogue-editor/` are served as static pages
- Vite injects its HMR client into served HTML — this is normal and harmless
- The `vite.config.js` has `fs.strict: false` to allow serving the data directory

### Dialogue Editor Tool
- The editor is a standalone HTML/CSS/JS app, NOT a Phaser game
- Functions called from dynamically-generated HTML forms must be exposed on `window.*`
- Static buttons use `addEventListener()` in `editor.js`'s `bindUI()` function
- Template-generated editor forms use `window.__exportedFunctionName()` convention
- The canvas render loop catches errors silently per-frame to avoid crashes

### SceneController Architecture
- Navigation is entirely graph-based: `startScene()` → `jumpToId(entryNode)` → `processNode(node)` → `advance()` (`node.next`) → `jumpToId(nextId)`
- No sequential index advancement — every transition is an explicit jump via `next` field
- `advance()` reads `this.currentNode.next` and jumps, or ends the scene if no `next`
- The old sequential-increment approach was replaced during the graph refactor

### Adding a New Scene
1. Create the scene JSON in `data/scenes/<id>.json`
2. Add the scene ID to `data/game.json`'s `"scenes"` array
3. Add a `fetch()` call in `BootScene.create()` to load the new scene
4. The engine and editor pick it up automatically

### Variable Conditions
- Format: `"variable_name == value"` or `"variable_name >= 30"`
- Supported operators: `==`, `!=`, `>=`, `<=`, `>`, `<`
- Values can be: `true`, `false`, numbers, or quoted strings

### Event Types (for `event` nodes)
- `sfx`: Play sound effect (`eventValue`: key name)
- `bgm`: Play background music (`eventValue`: key name)
- `camera_shake`: Shake camera (`eventValue`: `"duration,intensity"` e.g. `"500,0.01"`)
- `camera_flash`: Flash screen white (`eventValue`: `"r,g,b"` e.g. `"255,255,255"`)
- `set_flag`: Set a variable (`setFlag`/`setValue` fields on the node, not `eventValue`)

## Testing
- `npm run dev` starts the dev server
- Game at `http://localhost:3000/` — F1 (sample), F2 (conditions), F3 (events)
- Editor at `http://localhost:3000/tools/dialogue-editor/`
- `npm run build` produces a production bundle in `dist/`
