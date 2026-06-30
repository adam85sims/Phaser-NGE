---
name: narrative-engine-overview
description: "Project-level guide for Phaser-NGE — a data-driven visual novel / branching-narrative engine built on Phaser 4 at 1280×720. Covers project structure, data schema, agent conventions, and how the skill files map to modules. Load this first when starting work on any part of the engine."
---

# Narrative Engine — Agent Overview

> A data-driven narrative game engine on Phaser 4. Stories are JSON scene files fed into a graph-based state machine with a Registry-based node system. The engine renders them as a visual-novel-style game at **1280×720**. A standalone editor SPA at `tools/index.html` lets writers build scenes visually (multi-mode: Scene / Menu / Splash / Script / Animations).

**Repo:** `Phaser-NGE/` (Phaser 4 + Vite)

The agent owns the full project — engine, data, tools, assets — and edits freely across all directories. Only ask before destructive changes to user-authored content.

## Project Structure

```
Phaser-NGE/
├── src/                        # Engine code
│   ├── main.js                 # Phaser config: 1280x720, scenes
│   ├── scenes/
│   │   ├── BootScene.js        # async fetch() all data, preload assets, debug start
│   │   ├── SplashScene.js      # optional logo splash (driven by theme.json ui.splash)
│   │   ├── MenuScene.js        # Title screen: Start / Continue / Settings
│   │   └── GameScene.js        # Main loop, wires all systems, input hotkeys
│   ├── systems/
│   │   ├── DataLoader.js       # Global Data store ({game, characters, variables, theme, scenes, animations})
│   │   ├── Registry.js         # Node type plugin registry (editor + runtime share)
│   │   ├── SceneController.js  # Graph-based narrative state machine + call stack
│   │   ├── DialogueSystem.js   # Typewriter, choices, inline tags, history, skip/auto
│   │   ├── CharacterSystem.js  # Portrait display, expressions, positioning
│   │   ├── LayerSystem.js      # Multi-layer scene composition (backgrounds, sprites, containers)
│   │   ├── AnimationRunner.js  # Keyframe animation runner (JSON tracks → Phaser tweens)
│   │   ├── VariableSystem.js   # Scoped flags, counters, condition eval (AND/OR/parens)
│   │   ├── SaveSystem.js       # localStorage save/load + quick/auto save
│   │   ├── AudioSystem.js      # BGM/SFX with crossfade
│   │   └── SettingsSystem.js   # Persistent settings (text speed, volume, fullscreen)
│   └── nodes/
│       └── CoreNodes.js        # Registers all built-in node types via Registry
│
├── data/                       # Story content
│   ├── game.json               # Master config: title, startScene, scenes[], animations[], defaults
│   ├── characters.json         # Character definitions (portraits, expressions, color)
│   ├── variables.json          # Game state variable definitions
│   ├── theme.json              # UI theme (dialogue box, menu, splash, toasts)
│   ├── scenes/<id>.json        # One JSON file per scene
│   └── animations/<id>.json    # Keyframe animation data (tracks, keyframes)
│
├── tools/                      # Editors
│   ├── index.html              # Editor v2 shell
│   ├── app.js, app.css         # Editor boot, render functions, topbar event bindings
│   ├── graph.js                # Node-graph canvas (pan/zoom, draw, hit-test)
│   ├── inspector.js            # Context-sensitive property panel (registry-driven)
│   ├── state.js                # editorState singleton + load/save/auto-save
│   ├── editor-backend.js       # Vite plugin: /api/* endpoints (save, list/upload assets, validate)
│   ├── import-asset.sh         # CLI asset import
│   ├── migrate-v2-assets.cjs   # One-off migration helper for asset folder layout
│   ├── shared/
│   │   ├── backend-adapter.js  # Wraps /api/* for editor views
│   │   └── utils.js            # fetchJSON, etc.
│   ├── views/                  # One module per editor mode
│   │   ├── assets.js           # Asset browser (file explorer, upload, DnD)
│   │   ├── animations.js       # Keyframe animation editor
│   │   ├── characters.js       # Character manager
│   │   ├── scene-composer.js   # Scene layer/object preview + transform gizmos
│   │   ├── scenes.js           # Scene list manager
│   │   ├── files.js            # File browser (scripts, data files)
│   │   ├── variables.js        # Variable editor
│   │   ├── menu-editor.js      # Main menu layout editor
│   │   ├── splash-editor.js    # Splash screen editor
│   │   ├── settings.js         # Editor settings
│   │   └── script-editor.js    # Monaco-powered JSON/script editor
│   └── dialogue-editor/        # Legacy standalone (kept for reference)
│
├── src-main/                   # Electron main process
│   ├── index.js                # Electron app entry
│   ├── preload.cjs             # Preload script (context bridge)
│   └── server.js               # Express server bundled with Electron
│
├── launcher/                   # Electron launcher UI
│   ├── index.html              # Launcher shell
│   └── launcher.js             # Launcher app logic
│
├── public/assets/              # Media (served at /assets/*)
│   ├── backgrounds/            # PNG/JPG, key = filename stem (no ext) or full path
│   ├── characters/             # Portrait images
│   └── audio/{bgm,sfx}/        # mp3/ogg/wav/opus/m4a
│
├── skills/                     # Per-module reference (load before editing)
│   ├── overview/               # This file
│   ├── scene-controller/       # Graph state machine
│   ├── dialogue-system/        # Typewriter / choices / inline tags
│   ├── character-system/       # Portraits / expressions
│   ├── variable-system/        # Scoped flags / conditions
│   ├── save-system/            # localStorage persistence
│   ├── audio-system/           # BGM / SFX
│   ├── data-loader/            # Data store / fetch
│   ├── boot-scene/             # Data loading scene
│   ├── game-scene/             # Main loop / wiring
│   └── editor-app/             # Editor app shell
│
├── tests/                      # Vitest (jsdom) — pure logic only
│   ├── vitest.config.js
│   ├── setup.js
│   └── systems/*.test.js
│
├── docs/                       # Long-form design docs
│   ├── qa-checklist.md         # Manual QA test plan
│   ├── qa-node-system.md       # Node system manual QA (14 node types)
│   ├── deferred-todo.md        # Nice-to-haves (some already shipped)
│   ├── inline-scripting.md     # Dialogue tag reference
│   ├── sprite-editor-design.md
│   ├── editor-v2-migration.md
│   └── editor-architecture/    # Editor v2 spec (module contract, state, modes…)
│
├── .brain/                     # Antigravity AI memory (read-only reference)
├── vite.config.js              # port 3000, fs.strict:false, editorBackend() plugin
└── package.json
```

## How the Agent Skills Map to Modules

| Skill directory | Source file | Purpose |
|----------------|-------------|---------|
| `scene-controller/` | `src/systems/SceneController.js` | Graph-based narrative state machine + call stack |
| `dialogue-system/` | `src/systems/DialogueSystem.js` | Typewriter text, choices, rich text, localization, history |
| `rich-text-helper/` | `src/systems/RichTextHelper.js` | Tag parser: BBCode, conditionals, control tags |
| `transition-system/` | `src/systems/TransitionSystem.js` | 15 transition types (fade, wipe, crossfade, iris, zoom) |
| `character-system/` | `src/systems/CharacterSystem.js` | Portrait display, expressions, 5-position layout |
| `variable-system/` | `src/systems/VariableSystem.js` | Scoped flags, arrays, compound conditions, contains |
| `save-system/` | `src/systems/SaveSystem.js` | LocalStorage save/load, quick/auto save |
| `audio-system/` | `src/systems/AudioSystem.js` | BGM/SFX manager with crossfade |
| `data-loader/` | `src/systems/DataLoader.js` | Data store, fetch-based loading |
| `boot-scene/` | `src/scenes/BootScene.js` | Boot, fetch, font preload, populate Data, debug start |
| `game-scene/` | `src/scenes/GameScene.js` | Main loop, 10-system wiring, language picker, 12+ hotkeys |
| `editor-app/` | `tools/app.js` + `tools/*.js` | Unified editor SPA, registry-driven |

## Commands

```bash
npm install                    # one-time
npm run dev                    # Vite dev server on http://localhost:3000
npm test                       # Vitest + jsdom (~257 tests)
npm run test:watch             # Vitest watch mode
npm run build                  # Production bundle to dist/
npm run import-asset -- <type> <file>
                               # types: background|bg, portrait|port, bgm|music, sfx|sound, font
./start.sh                     # npm run dev -- --open /tools/
```

## Routes

| URL | Purpose |
|-----|---------|
| `/` | Phaser game — Boot → (Splash?) → Menu → Game |
| `/tools/index.html` | **Editor v2** — unified SPA |
| `/tools/dialogue-editor/` | Legacy standalone (kept for reference) |

## Data Schema

### `data/game.json`
```json
{
  "title": "...",
  "schemaVersion": "1.0",
  "version": "1.0.0",
  "startScene": "start",
  "scenes": ["start"],
  "animations": ["intro"],
  "defaults": { "textSpeed": 40, "autoAdvance": false, "bgmVolume": 0.7, "sfxVolume": 1 }
}
```

### Scene File
```json
{
  "id": "scene_id",
  "entryNode": "start",
  "background": null,
  "music": null,
  "layers": [ /* optional — multi-layer composition */ ],
  "nodes": [ /* graph nodes */ ]
}
```

### Node Types (14 total, registered via `Registry`)

| Type | Color | Behavior |
|------|-------|----------|
| `dialogue` | blue | Character speaks with typewriter. Inline tags, autoAdvance, expression, position, zIndex |
| `choice` | amber | Player picks from filtered choices (condition, setFlag, setValue, toggleFlag, addFlag) |
| `timed_choice` | orange | Choice with countdown -> default_next on expiry |
| `random_branch` | indigo | Weighted random pick of one branch |
| `condition` | green | Auto branch on variable (AND/OR/parens supported) |
| `event` | violet | Fire-and-forget: BGM, SFX, bg_change, camera_shake, camera_flash, play_animation |
| `set_variable` | emerald | Mutate via set/add/toggle |
| `wait` | slate | Timed pause (ms) |
| `animate` | sky | Tween target property (x/y/alpha/scale/angle/zoom) |
| `show_object` | teal | Fade layer/character in |
| `hide_object` | gray | Fade layer/character out |
| `camera` | violet | shake/flash/fade_in/fade_out/zoom/pan |
| `call_scene` | pink | Sub-scene (call stack, pops on end) |
| `macro` | pink | Sub-scene with args (pushScope/popScope on VariableSystem) |
| `end` | red | Terminal — nextScene transitions, otherwise pops call stack |

### Event Types (on `event` nodes)

| eventType | Behaviour |
|-----------|-----------|
| `bgm` | Play / swap BGM (with crossfade) |
| `bgm_stop` | Fade out and stop BGM |
| `sfx` | Play sound effect once |
| `bg_change` | Change background |
| `camera_shake` | `"duration,intensity"` |
| `camera_flash` | `"r,g,b"` |
| `play_animation` | Run keyframe animation on target |

## Key Conventions

- **Use `fetch()` not Phaser's loader** for JSON — Vite path issues. Absolute paths (`/data/...`).
- **Vite `fs.strict: false`** — needed to serve the `data/` directory.
- **Functions from innerHTML** — must be exposed on `window.*` (Vite wraps inline `<script>` in module scope).
- **New scene?** Create `data/scenes/<id>.json`, add ID to `game.json` → BootScene auto-discovers it.
- **New node type?** Add `Registry.registerNodeType()` in `CoreNodes.js` — engine and editor both read the registry.
- **Navigation is always explicit** — never rely on array index. Every transition via `next`, `else`, `choices[].next`.
- **Node types are not hardcoded** — both editor and runtime look up via `Registry.getNodeType(typeId)`.
