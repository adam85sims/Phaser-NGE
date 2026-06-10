# Phaser NGE — Agent Guide

Data-driven narrative game engine on Phaser 4. Stories are JSON scene files; the engine reads them and renders a visual-novel-style game. A standalone editor app at `tools/index.html` lets writers build scenes visually.

## Two-Person Workflow

| Role | Territory |
|------|-----------|
| **Agent (AI)** | `src/`, `vite.config.js`, `package.json` |
| **User (Human)** | `data/`, `tools/`, `public/assets/`, `skills/` |

The agent should **not** modify `data/` or `tools/` files without explicit direction. Engine runtime is the agent's job; story content and editor UX are the user's.

## Commands

```bash
npm install            # one-time
npm run dev            # Vite dev server on http://localhost:3000
npm test               # Vitest, ~180 unit tests in ~2s (jsdom)
npm run test:watch     # Vitest watch mode
npm run build          # Production bundle to dist/
npm run import-asset -- <type> <file>
                       # types: background|bg, portrait|port, bgm|music,
                       #        sfx|sound, font
./start.sh             # npm run dev -- --open /tools/
```

`npm run import-asset` runs `tools/import-asset.sh` (copies into `public/assets/<subdir>/`, prompts before overwriting).

## Routes (dev server, port 3000)

| URL | Purpose |
|-----|---------|
| `/` | Phaser game — boot → menu → start |
| `/tools/index.html` | **Editor v2** — unified SPA, current editor |
| `/tools/dialogue-editor/` | Legacy standalone node-graph editor (kept for reference) |

## Project Structure

```
Phaser-NGE/
├── src/                       # Engine — agent territory
│   ├── main.js                # Phaser config: 800x600, scenes=[Boot,Menu,Game]
│   ├── scenes/
│   │   ├── BootScene.js       # fetch() all data, populate Data store, transition
│   │   ├── MenuScene.js       # Title screen: Start / Continue / Settings
│   │   └── GameScene.js       # Main loop, wires all systems, input hotkeys
│   └── systems/
│       ├── DataLoader.js      # Global Data store ({game, characters, variables, theme, scenes})
│       ├── SceneController.js # Graph-based narrative state machine
│       ├── DialogueSystem.js  # Typewriter, choices, history, skip/auto
│       ├── CharacterSystem.js # Portrait display, expressions, positioning
│       ├── VariableSystem.js  # Flags, counters, condition eval (AND/OR/parens)
│       ├── SaveSystem.js      # localStorage save/load + quick/auto save
│       ├── AudioSystem.js     # BGM/SFX manager
│       └── SettingsSystem.js  # Persistent settings (text speed, volume, fullscreen)
│
├── data/                      # Story content — user territory
│   ├── game.json              # Master config: title, startScene, scenes[], defaults
│   ├── characters.json        # Character definitions
│   ├── variables.json         # Game state variable definitions
│   ├── theme.json             # UI theme (text box layout, fonts, colors)
│   └── scenes/<id>.json       # One JSON file per scene
│
├── tools/                     # Editors — user territory
│   ├── index.html             # Editor v2 shell (open this)
│   ├── app.js, app.css, graph.js, inspector.js, state.js
│   ├── views/                 # Editor v2 view modules
│   ├── shared/                # Shared editor utilities
│   ├── dialogue-editor/       # Legacy standalone editor
│   ├── editor-backend.js      # Vite plugin: /api/save, /api/list-assets, /api/upload-asset
│   └── import-asset.sh
│
├── skills/                    # Per-module reference (load before editing)
│   ├── overview/              #    — project overview + two-person workflow
│   ├── scene-controller/      #    — graph state machine
│   ├── dialogue-system/       #    — typewriter / choices
│   ├── character-system/      #    — portraits / expressions
│   ├── variable-system/       #    — flags / conditions
│   ├── save-system/           #    — localStorage persistence
│   ├── audio-system/          #    — BGM / SFX
│   ├── data-loader/           #    — Data store / fetch
│   ├── boot-scene/            #    — data loading scene
│   ├── game-scene/            #    — main loop / wiring
│   └── editor-app/            #    — editor app shell
│
├── public/assets/             # Media — user territory
│   ├── backgrounds/           # PNG/JPG, key = filename stem (no ext)
│   ├── characters/            # Portrait images
│   └── audio/{bgm,sfx}/
│
├── tests/                     # Vitest (jsdom) — pure logic only
│   ├── vitest.config.js
│   ├── setup.js
│   └── systems/{DataLoader,VariableSystem,SceneController,SaveSystem,SettingsSystem}.test.js
│
├── docs/
│   ├── qa-checklist.md        # Manual QA test plan (Phaser-dependent systems)
│   └── deferred-todo.md
│
├── .brain/                    # Antigravity AI memory (read-only reference)
│   ├── map.json               # Project component map
│   ├── memory.md              # Decision log & gotchas
│   └── session.md             # Session state
│
└── vite.config.js
```

## Skills

Each module in `skills/` has a `SKILL.md` with the module's API, architecture, gotchas. **Before modifying a module, read its skill file** — they are the canonical contract.

## Data Schema

### `data/game.json`
```json
{
  "title": "...",
  "version": "1.0.0",
  "startScene": "start",
  "scenes": ["start"],
  "defaults": { "textSpeed": 40, "autoAdvance": false, "bgmVolume": 0.7, "sfxVolume": 1 }
}
```
- `startScene` is the entry point used by `GameScene._getStartScene()` if MenuScene doesn't pass `loadScene` via scene data.

### Scene File (`data/scenes/<id>.json`)
```json
{
  "id": "scene_id",
  "entryNode": "start",
  "background": null,
  "music": null,
  "nodes": [
    { "id": "start", "type": "dialogue", "speaker": "narrator", "text": "...", "next": "node2" }
  ]
}
```
- `entryNode`: graph entry point.
- `nodes[]`: every node. `x`/`y` are editor-only canvas positions.
- **Navigation is always explicit** — never rely on array index. Every transition is via `next`, `else`, or `choices[].next`.

### Node Types

| Type | Fields | Behavior |
|------|--------|----------|
| `dialogue` | `speaker`, `text`, `expression`, `position`, `autoAdvance`, `waitTime`, `background`, `next` | Character speaks. Waits for input unless `autoAdvance` (uses `waitTime` ms). |
| `choice` | `prompt`, `choices[]`, `background` | Player picks. Each choice: `text`, `next`, `condition`, `setFlag`, `setValue`. Filtered by `condition`. |
| `condition` | `condition`, `next` (true), `else` (false) | Auto branch on variable. |
| `event` | `eventType`, `eventValue`, `background`, `next` | Fire-and-forget side effect. |
| `wait` | `duration`, `next` | Timed pause (ms). |
| `call_scene` | `sceneId`, `next` | Calls sub-scene. Pushes current node onto a call stack; sub-scene's `end` node (without `nextScene`) returns here. Nested calls supported. |
| `end` | `text`, `nextScene` | Terminal. With `nextScene`, transitions to that scene (clears call stack). Without, pops call stack to caller. |

All nodes may carry: `setFlag`, `setValue` (variable writes), `background` (mid-scene bg change).

### Event Types

| eventType | eventValue | Behaviour |
|-----------|------------|-----------|
| `sfx` | audio key | Play sound effect once |
| `bgm` | audio key | Play / swap background music |
| `bg_change` | background key | Change background image |
| `camera_shake` | `"duration,intensity"` (e.g. `"500,0.01"`) | Shake camera |
| `camera_flash` | `"r,g,b"` (e.g. `"255,255,255"`) | Flash screen white-ish |

### Compound Conditions

```
courage >= 50 AND has_key == true
courage >= 100 OR is_hero == true
(a == 1 OR b == 1) AND c == 1
```
AND has higher precedence than OR. Parens override. Values: booleans, numbers, or quoted strings. Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`.

### Backgrounds
- Any node with `background: "<key>"` fires `onBackgroundChange`. Key = filename stem in `public/assets/backgrounds/`.
- Missing image → engine falls back to procedural gradient. `background: null` also falls back.

## Hotkeys (in-game)

| Key | Action |
|-----|--------|
| Space / Enter / Click | Advance dialogue (skip typewriter) |
| 1–9 | Select choice |
| **H** | Toggle dialogue history |
| **S** | Toggle skip mode |
| **A** | Toggle auto mode |
| **F5** | Quick save (slot 0) |
| **F9** | Quick load (slot 0) |
| **Esc** | Return to menu |
| F1 / F2 / F3 | Jump to test scenes: `sample`, `test-conditions`, `test-events` |

**Note:** F1–F3 are hardcoded scene IDs in `src/scenes/GameScene.js`. The current `data/game.json` only lists `start`, so pressing F1–F3 will fail unless those scenes are added back to `game.scenes` and the corresponding `data/scenes/*.json` files exist.

## Architecture Notes

### Boot & Data Loading
- `BootScene.create()` is `async`. It uses `fetch()` with **absolute paths** (`/data/...`) — Phaser's built-in `this.load.json` has Vite path-resolution issues, do NOT use it.
- Check for `localStorage.getItem('nge_editor_data')` first (editor "Save to Game" / Export writes here). If present, uses that and only fetches `theme.json` separately. Falls back to disk files otherwise.
- Scenes are loaded **dynamically** by iterating `Data.game.scenes[]` and fetching each `/data/scenes/<id>.json`.
- Background images are prefetched as blobs, converted via `createImageBitmap`, and added as textures under key `bg_<key>`.

### Vite Dev Server
- `server.port: 3000`, `fs.strict: false` (required to serve `data/`).
- `tools/editor-backend.js` is a Vite plugin exposing `/api/save`, `/api/list-assets`, `/api/upload-asset` (POST only, except list-assets). The editor uses these to persist content to disk.
- Vite injects HMR client into served HTML — harmless, ignore.

### Editor App
- `tools/index.html` + `tools/app.js` is the unified Editor v2 SPA. `tools/dialogue-editor/` is the legacy standalone.
- Functions invoked from dynamically-generated HTML must be exposed on `window.*` (Vite wraps inline `<script>` in module scope).
- Static buttons: `addEventListener` in `app.js`. Template-rendered forms: `window.__exportedFn()`.
- Canvas render loop in `graph.js` wraps `renderCanvas()` in try/catch to avoid per-frame crashes.

### SceneController
- Pure graph traversal. `startScene(id) → jumpToId(entryNode) → processNode(node) → advance() → jumpToId(currentNode.next)`.
- No sequential index. Missing `next` ends the scene.
- Hooks: `onDialogue`, `onChoice`, `onSceneStart`, `onSceneEnd`, `onAction`, `onWait`, `onBackgroundChange` — set by `GameScene._wireSceneController()`.
- Call stack (`_callStack`) backs `call_scene`/`end` interaction. `end.nextScene` overrides stack return.

### VariableSystem
- Compiles conditions once per call into a small expression tree; supports AND/OR with parens.
- Values typed as boolean / number / string. JSON `null` becomes `null` (treats as falsy in `==`/`!=`).

### SaveSystem
- localStorage key `nge_save_<slot>`. Slot 0 = quick, slot 9 = auto (saved on every `onSceneStart`).
- `quickLoad()` returns `{ sceneId, nodeId, variables, timestamp }` or `null`. GameScene re-calls `sceneCtrl.startScene(loaded.sceneId, loaded.nodeId)` and rehydrates variables.

### Theme
- `data/theme.json` shape (consumed by `DialogueSystem`):
  ```json
  {
    "dialogue": {
      "textBoxSize": {"width": 700, "height": 150},
      "textBoxPosition": {"x": 50, "y": 450},
      "textSpeed": 40, "fontSize": 24, "fontFamily": "monospace",
      "textColor": "#ffffff", "backgroundColor": "#22224488",
      "padding": {"x": 20, "y": 10}, "transitionDuration": 300
    }
  }
  ```

## Adding a New Scene
1. Create `data/scenes/<id>.json` with `entryNode` and `nodes[]`.
2. Add the scene ID to the `scenes` array in `data/game.json`.
3. Refresh — `BootScene` picks it up automatically. (No code change to `BootScene` needed.)

## Asset Import

```bash
npm run import-asset -- background ~/Downloads/city.png     # → public/assets/backgrounds/
npm run import-asset -- portrait   ~/Downloads/elena.png     # → public/assets/characters/
npm run import-asset -- bgm        ~/Music/theme.mp3          # → public/assets/audio/bgm/
npm run import-asset -- sfx        ~/Downloads/click.wav      # → public/assets/audio/sfx/
npm run import-asset -- font       ~/Downloads/NotoSans.ttf   # → public/assets/fonts/
```
Or use the editor's asset browser (uploads via `/api/upload-asset`).

## Testing

- `npm test` — Vitest with jsdom, ~180 tests in ~2s. **Only pure-logic systems are covered:** DataLoader, VariableSystem, SceneController, SaveSystem, SettingsSystem.
- Phaser-dependent systems (DialogueSystem, CharacterSystem, AudioSystem) are tested via the manual `docs/qa-checklist.md`.
- `tests/setup.js` polyfills `localStorage` (jsdom already provides it) and silences `console.warn`/`console.error` per-test (exposes `getWarnings()` / `getErrors()` helpers).
- Test config sets reporter to `verbose` locally, `default` in CI (`process.env.CI`).
- A single test file: `npx vitest run --config tests/vitest.config.js tests/systems/VariableSystem.test.js`.

## Common Pitfalls
- Don't add a `fetch()` call in `BootScene` for new scenes — it's already data-driven from `game.scenes`.
- Don't use `this.load.json` / Phaser loader for game data — Vite path issues.
- Don't reference `setFlag`/`setValue` for read-only conditions — they mutate the variable, they're not predicates.
- Background keys are filename **stems**, not full filenames (`cloudsnight` for `cloudsnight.png`).
- Editor's "Save" button is **not** mock-only now — it POSTs to `/api/save` (handled by `tools/editor-backend.js`). The README's "save is mocked" claim is stale.
- The two stray root scripts (`run_puppeteer.cjs`, `strip_graph.cjs`) are one-off dev tools, not part of the dev workflow. Don't `require` them from new code.

## `.brain/` — Antigravity AI Memory

The `.brain/` folder (managed by Antigravity) stores AI session context and project memory. It is **read-only reference** for the agent — do not modify its contents.

```
.brain/
├── map.json    # Project component map
├── memory.md   # Decision log & gotchas (append-only)
└── session.md  # Per-session state
```

If Antigravity adds new files or schemas to `.brain/`, update this section accordingly.
