# Phaser NGE — Agent Guide

## Project Overview

A data-driven narrative game engine built on Phaser 4. Stories are written as JSON scene files. The engine reads these files and renders them as a visual novel–style game. A standalone dialogue editor tool (HTML/JS/CSS) lets writers create scenes visually.

Now includes: menu system, settings UI, dialogue history, skip/auto modes, quick save/load, background images, multi-character positioning, compound conditions, and an asset import tool.

**Two-person workflow:**
- **Agent (AI):** Owns `src/` (engine code), `vite.config.js`, `package.json`
- **User (Human):** Owns `data/` (story content), `tools/` (editors), `public/assets/` (media)

## Project Structure

```
Phaser-NGE/
├── src/                       # Engine code — agent territory
│   ├── main.js                # Phaser game config
│   ├── scenes/
│   │   ├── BootScene.js       # Loads all data, preloads backgrounds, transitions to Menu
│   │   ├── MenuScene.js       # Title screen with Start/Continue/Settings
│   │   └── GameScene.js       # Main loop, wires all systems
│   └── systems/
│       ├── DataLoader.js      # Global Data store (populated by BootScene)
│       ├── SceneController.js # Graph-based narrative state machine
│       ├── DialogueSystem.js  # Typewriter, choices, history, skip/auto
│       ├── CharacterSystem.js # Portrait display, expressions, positioning
│       ├── VariableSystem.js  # Flags, counters, condition eval (inc. AND/OR)
│       ├── SaveSystem.js      # LocalStorage save/load + quick/auto save
│       ├── AudioSystem.js     # BGM/SFX manager
│       └── SettingsSystem.js  # Persistent settings (text speed, volume, fullscreen)
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
│   ├── dialogue-editor/       # Visual node graph editor
│   └── import-asset.sh        # CLI tool: import-asset bg|bgm|sfx <file>
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
├── public/assets/             # Media files — user territory
│   ├── backgrounds/           # PNG images, referenced by scene.background
│   └── audio/
│       ├── bgm/               # Background music (mp3/ogg)
│       └── sfx/               # Sound effects (wav/ogg/mp3)
│
├── tests/                     # Automated tests (Vitest)
│   ├── vitest.config.js
│   ├── setup.js
│   └── systems/
│       ├── DataLoader.test.js
│       ├── VariableSystem.test.js
│       ├── SceneController.test.js
│       ├── SaveSystem.test.js
│       └── SettingsSystem.test.js
│
├── docs/
│   ├── qa-checklist.md        # Manual QA test plan
│   └── deferred-todo.md       # Nice-to-have features for later
│
├── .hermes/plans/             # Implementation plans
├── .gitignore
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
| `dialogue` | `speaker`, `text`, `expression`, `position`, `autoAdvance`, `waitTime`, `background`, `next` | Character speaks. Waits for input unless autoAdvance. Can change background. |
| `choice` | `prompt`, `choices[]`, `background` | Player picks. Each choice: `text`, `next`, `condition`, `setFlag`, `setValue` |
| `condition` | `condition`, `next` (true), `else` (false) | System branch. No player interaction |
| `event` | `eventType`, `eventValue`, `background`, `next` | Fire-and-forget side effect (SFX, BGM, bg_change, camera shake/flash) |
| `wait` | `duration`, `next` | Timed pause |
| `call_scene` | `sceneId`, `next` | Calls a sub-scene by ID. Saves current position on call stack. When the sub-scene ends (via an `end` node), control returns to this scene at `next`. Supports nested calls. `end` nodes with `nextScene` override the stack return. |
| `end` | `text`, `nextScene` | Terminal. Ends scene, optionally transitions to another |

All node types support optional:
- `setFlag`, `setValue` — variable actions
- `background` — change scene background mid-scene (key references `public/assets/backgrounds/<key>.png`)

### Event Types

| eventType | eventValue | Behaviour |
|-----------|------------|-----------|
| `sfx` | Audio key | Play sound effect once |
| `bgm` | Audio key | Play / swap background music |
| `bg_change` | Background key | Change scene background image |
| `camera_shake` | `"duration,intensity"` | Shake camera (e.g. `"500,0.01"`) |
| `camera_flash` | `"r,g,b"` | Flash screen (e.g. `"255,255,255"`) |

### Compound Conditions

Supports AND/OR with parentheses:
```
courage >= 50 AND has_key == true
courage >= 100 OR is_hero == true
(courage >= 50 AND has_key == true) OR is_hero == true
```

AND has higher precedence than OR. Parentheses override.

### Background Images

Any node can specify `"background": "key"` to change the scene background.
- Image file goes in `public/assets/backgrounds/<key>.png`
- If the image doesn't exist, engine falls back to the procedural gradient
- `"background": null` also falls back to gradient

## Asset Import

```bash
# Import a background image
npm run import-asset -- bg ~/Downloads/city_night.png

# Import background music
npm run import-asset -- bgm ~/Music/theme.mp3

# Import a sound effect
npm run import-asset -- sfx ~/Downloads/click.wav
```

Files are copied to the right `public/assets/` subdirectory automatically.

## Hotkeys

| Key | Action |
|-----|--------|
| Space / Enter / Click | Advance dialogue |
| 1-9 | Select choice |
| F1-F3 | Jump to test scenes (sample, conditions, events) |
| **H** | Toggle dialogue history |
| **S** | Toggle skip mode |
| **A** | Toggle auto mode |
| **F5** | Quick save (slot 0) |
| **F9** | Quick load (slot 0) |
| **Escape** | Return to menu |

## Gotchas & Conventions (from original)

### Data Loading
- BootScene uses `fetch()` with **absolute paths** (`/data/...`) to load JSON
- Phaser's built-in JSON loader (`this.load.json`) has path resolution issues with Vite's dev server — do NOT use it
- Always use `fetch()` with explicit error handling: `if (!r.ok) throw new Error(...)`
- Scenes are now loaded **dynamically** from `game.json`'s `scenes` array — no more hardcoded fetches

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
- Any node with a `background` field fires `onBackgroundChange` to set a new background mid-scene

### Adding a New Scene
1. Create the scene JSON in `data/scenes/<id>.json`
2. Add the scene ID to `data/game.json`'s `"scenes"` array
3. Refresh the game — BootScene loads it automatically

### Variable Conditions
- Format: `"variable_name == value"` or `"courage >= 30"`
- Supported operators: `==`, `!=`, `>=`, `<=`, `>`, `<`
- Supports compound: `"courage >= 50 AND has_key == true"`, `"x == 1 OR y == 2"`
- Supports parentheses: `"(a==1 OR b==1) AND c==1"`
- Values can be: `true`, `false`, numbers, or quoted strings

## Testing
- `npm run dev` starts the dev server
- Game at `http://localhost:3000/` — menu → start → F1-F3 for test scenes
- Editor at `http://localhost:3000/tools/dialogue-editor/`
- `npm test` runs 170+ unit tests in ~2s
- `npm run build` produces a production bundle in `dist/`
