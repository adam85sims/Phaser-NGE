# Phaser NGE — Agent Guide

Data-driven narrative game engine on Phaser 4. Stories are JSON scene files; the engine reads them and renders a visual-novel-style game at **1280×720**. A standalone editor SPA at `tools/index.html` lets writers build scenes visually (multi-mode: Scene / Menu / Splash / Script / Animations).

The agent owns the full project — engine, data, tools, assets — and edits freely across all directories. Only ask before destructive changes to user-authored content.

## Commands

```bash
npm install                    # one-time
npm run dev                    # Vite dev server on http://localhost:3000
npm test                       # Vitest + jsdom, ~190 unit tests in ~1.5s (pure logic only)
npm run test:watch             # Vitest watch mode
npm run build                  # Production bundle to dist/
npm run import-asset -- <type> <file>
                               # types: background|bg, portrait|port, bgm|music,
                               #        sfx|sound, font
./start.sh                     # npm run dev -- --open /tools/
```

`npm run import-asset` runs `tools/import-asset.sh` (copies into `public/assets/<subdir>/`, prompts before overwriting).

## Routes (dev server, port 3000)

| URL | Purpose |
|-----|---------|
| `/` | Phaser game — Boot → (Splash?) → Menu → Game |
| `/tools/index.html` | **Editor v2** — unified SPA, current editor |
| `/tools/dialogue-editor/` | Legacy standalone node-graph editor (kept for reference) |

## Project Structure

```
Phaser-NGE/
├── src/                        # Engine code
│   ├── main.js                 # Phaser config: 1280x720, scenes=[Boot, Splash, Menu, Game]
│   ├── scenes/
│   │   ├── BootScene.js        # async fetch() all data, preload assets, transition
│   │   ├── SplashScene.js      # optional logo splash (driven by theme.json ui.splash)
│   │   ├── MenuScene.js        # Title screen: Start / Continue / Settings
│   │   └── GameScene.js        # Main loop, wires all systems, input hotkeys
│   ├── systems/
│   │   ├── DataLoader.js       # Global Data store ({game, characters, variables, theme, scenes, animations})
│   │   ├── Registry.js         # Node type plugin registry (editor + runtime share)
│   │   ├── SceneController.js  # Graph-based narrative state machine
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
│   ├── characters.json         # Character definitions
│   ├── variables.json          # Game state variable definitions
│   ├── theme.json              # UI theme (dialogue box, menu, splash, toasts)
│   ├── scenes/<id>.json        # One JSON file per scene
│   └── animations/<id>.json    # Keyframe animation data
│
├── tools/                      # Editors
│   ├── index.html              # Editor v2 shell
│   ├── app.js, app.css         # Editor boot, render functions, topbar event bindings
│   ├── graph.js                # Node-graph canvas (pan/zoom, draw, hit-test)
│   ├── inspector.js            # Context-sensitive property panel
│   ├── state.js                # editorState singleton + load/save/auto-save
│   ├── editor-backend.js       # Vite plugin: /api/* endpoints (save, list/upload assets, project ops)
│   ├── import-asset.sh         # CLI asset import
│   ├── migrate-v2-assets.cjs   # One-off migration helper for asset folder layout
│   ├── shared/
│   │   ├── backend-adapter.js  # Wraps /api/* for editor views
│   │   └── utils.js            # fetchJSON, etc.
│   ├── views/                  # One module per editor mode (see Editor v2 section)
│   └── dialogue-editor/        # Legacy standalone editor (kept for reference)
│
├── skills/                     # Per-module reference (load before editing)
│   ├── overview/
│   ├── scene-controller/       #   — graph state machine
│   ├── dialogue-system/        #   — typewriter / choices / inline tags
│   ├── character-system/       #   — portraits / expressions
│   ├── variable-system/        #   — flags / conditions
│   ├── save-system/            #   — localStorage persistence
│   ├── audio-system/           #   — BGM / SFX
│   ├── data-loader/            #   — Data store / fetch
│   ├── boot-scene/             #   — data loading scene
│   ├── game-scene/             #   — main loop / wiring
│   └── editor-app/             #   — editor app shell
│
├── public/assets/              # Media (served at /assets/*)
│   ├── backgrounds/            # PNG/JPG, key = filename stem (no ext) or full path
│   ├── characters/             # Portrait images
│   └── audio/{bgm,sfx}/        # bg_<key> / audio/<subdir>/<key>.<ext>
│
├── tests/                      # Vitest (jsdom) — pure logic only
│   ├── vitest.config.js
│   ├── setup.js
│   └── systems/{DataLoader,VariableSystem,SceneController,SaveSystem,SettingsSystem}.test.js
│
├── docs/                       # Long-form design docs
│   ├── qa-checklist.md         # Manual QA test plan (Phaser-dependent systems)
│   ├── deferred-todo.md        # Nice-to-haves (some already shipped)
│   ├── inline-scripting.md     # Dialogue tag reference
│   ├── sprite-editor-design.md
│   ├── editor-v2-migration.md
│   └── editor-architecture/    # Editor v2 spec (module contract, state, modes…)
│
├── .brain/                     # Antigravity AI memory (read-only reference)
│   ├── map.json
│   ├── memory.md
│   └── session.md
│
└── vite.config.js              # port 3000, fs.strict:false, editorBackend() plugin
```

## Skills

Each module in `skills/` has a `SKILL.md` with the module's API, architecture, gotchas. **Before modifying a module, read its skill file** — they are the canonical contract.

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
- `startScene` is used by `GameScene._getStartScene()` if `MenuScene` doesn't pass `loadScene` via scene data.
- `animations[]` lists animation IDs; their JSON lives in `data/animations/<id>.json`.

### Scene File (`data/scenes/<id>.json`)
```json
{
  "id": "scene_id",
  "entryNode": "start",
  "background": null,
  "music": null,
  "layers": [
    { "id": "bg", "type": "background", "asset": "backgrounds/BG_throne.png",
      "x": 640, "y": 360, "scale": 1, "zIndex": 1, "opacity": 1 }
  ],
  "nodes": [
    { "id": "start", "type": "dialogue", "speaker": "narrator", "text": "...", "next": "node2" }
  ]
}
```
- `entryNode`: graph entry point.
- `nodes[]`: every node. `x`/`y` are editor-only canvas positions.
- `layers[]` (optional) — multi-layer scene composition. If empty/absent, `LayerSystem` migrates a single `background` into a legacy layer on the fly.
- **Navigation is always explicit** — never rely on array index. Every transition is via `next`, `else`, `choices[].next`, or `node.args` for macros.

### Node Types (registered in `src/nodes/CoreNodes.js`)

The set of node types is **not hardcoded** in the engine — both editor and runtime look them up via `Registry.getNodeType(typeId)`. New node types are added by calling `Registry.registerNodeType()`.

| Type | Color | Fields | Behavior |
|------|-------|--------|----------|
| `dialogue` | blue | `speaker`, `text`, `expression`, `position`, `zIndex`, `autoAdvance`, `waitTime`, `next` | Character speaks. Waits for input unless `autoAdvance` (uses `waitTime` ms). Inline tags in `text` trigger visual events. |
| `choice` | amber | `prompt`, `choices[]`, `next` | Player picks. Each choice: `text`, `next`, `condition`, `setFlag`, `setValue`. Filtered by `condition`. |
| `timed_choice` | orange | `duration`, `default_next`, `prompt`, `choices[]` | Choice with a countdown; expires into `default_next`. |
| `random_branch` | indigo | `choices[]` (each with `weight`, `next`) | Weighted random pick of one branch. |
| `condition` | green | `condition`, `next` (true), `else` (false) | Auto branch on variable. |
| `event` | violet | `eventType`, `eventValue`, `eventVolume`, `eventTarget`, `next` | Fire-and-forget side effect (see Event Types). |
| `set_variable` | emerald | `variable`, `value`, `operation` (`set`/`add`/`toggle`), `next` | Mutate a variable. |
| `wait` | slate | `duration`, `next` | Timed pause (ms). |
| `animate` | sky | `target`, `property`, `value`, `duration`, `easing`, `wait`, `next` | Tween a target's `x`/`y`/`alpha`/`scale`/`angle`/`zoom`. `target: 'camera'` addresses the camera. |
| `show_object` | teal | `target`, `duration`, `wait`, `next` | Fade a layer/character in. |
| `hide_object` | gray | `target`, `duration`, `wait`, `next` | Fade a layer/character out. |
| `camera` | violet | `action` (`shake`/`flash`/`fade_in`/`fade_out`/`zoom`/`pan`), `value`, `duration`, `wait`, `next` | Camera FX. |
| `call_scene` | pink | `sceneId`, `nodeId` (optional entry), `next` | Sub-scene; pushes call stack; returns to `next` on `end`. |
| `macro` | pink | `sceneId`, `nodeId`, `args{}`, `next` | Sub-scene with `args` injected via `vars.pushScope(node.args)`. |
| `end` | red | `text`, `nextScene` | Terminal. With `nextScene`, transitions (clears call stack). Without, pops call stack. |

All nodes may carry: `setFlag`, `setValue` (variable writes), `background` (mid-scene bg change → `onBackgroundChange`).

### Event Types (`eventType` on `event` nodes)

| eventType | eventValue | Behaviour |
|-----------|------------|-----------|
| `bgm` | audio key (e.g. `audio/bgm/theme.mp3` or stem) | Play / swap background music. |
| `bgm_stop` | — | Fade out and stop BGM. |
| `sfx` | audio key | Play sound effect once (with optional `eventVolume`). |
| `bg_change` | background asset path | Change background (re-loads single layer). |
| `camera_shake` | `"duration,intensity"` (e.g. `"500,0.01"`) | Shake camera. |
| `camera_flash` | `"r,g,b"` (e.g. `"255,255,255"`) | Flash screen. |
| `play_animation` | animation key | Run a keyframe animation on `eventTarget` (layer id or character id). |

### Compound Conditions

```
courage >= 50 AND has_key == true
courage >= 100 OR is_hero == true
(a == 1 OR b == 1) AND c == 1
```
AND has higher precedence than OR. Parens override. Values: booleans, numbers, or quoted strings. Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`, `=`.

### Backgrounds & Layers
- A scene can have either a legacy single `background` field OR a structured `layers[]` array. `LayerSystem` auto-migrates legacy `background` into a single layer if `layers[]` is empty.
- Layer shape: `{ id, type, asset, x, y, scale, rotation, opacity, hidden, zIndex, originX, originY, children? }`. Type is `background` / `image` / `container`. Containers nest children.
- Any node with `background: "<key>"` fires `onBackgroundChange`. Missing image → engine falls back to procedural gradient. `background: null` does NOT clear the screen mid-scene (truthy guard).

### Inline Dialogue Tags

Dialogue text supports inline scripting tags that trigger visual events as the typewriter reaches them. See `docs/inline-scripting.md`.

```
Here is the ancient relic you asked for. [show:ancient_relic] [anim:ancient_relic:pulse]
```
- `[show:assetname]` — fades the named layer/asset in (lookup by asset name, not layer id).
- `[hide:assetname]` — fades it out.
- `[anim:target:animation_key]` — runs a keyframe animation (from `data/animations/<id>.json`) on the target.

Tags are stripped from the displayed text. If the player skips the typewriter, pending tags fire instantly.

### Animations (`data/animations/<id>.json`)

```json
{
  "duration": 1000,
  "loop": 0,
  "tracks": {
    "x": [{ "time": 0, "value": 0, "ease": "Linear" }, { "time": 1000, "value": 100 }],
    "alpha": [{ "time": 0, "value": 1 }, { "time": 500, "value": 0.5 }]
  }
}
```
- Each track is a property name → array of keyframes `{ time, value, ease? }`.
- Value strings can be `+N` / `-N` for relative motion.
- `loop`: 0 = once, -1 = infinite.
- Run via `event` node (`eventType: "play_animation"`) or inline tag `[anim:target:key]`. See `src/systems/AnimationRunner.js`.

### Theme (`data/theme.json`)

```json
{
  "dialogue": {
    "textBoxSize": { "width": 1180, "height": 180 },
    "textBoxPosition": { "x": 50, "y": 520 },
    "textSpeed": 40, "fontSize": 28, "fontFamily": "monospace",
    "textColor": "#ffffff", "backgroundColor": "#22224488",
    "padding": { "x": 30, "y": 20 }, "transitionDuration": 300
  },
  "ui": {
    "menu": { "background": "...", "title": {...}, "subtitle": {...}, "buttons": [...] },
    "splash": { "enabled": false, "background": "#0a0a1a", "logo": "...", "logoScale": 1,
                "fadeIn": 1000, "hold": 2000, "fadeOut": 1000, "skipOnClick": true }
  }
}
```

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
| F1 / F2 / F3 / F4 | Jump to dev scenes: `sample`, `test-conditions`, `test-events`, `node_test` (only if loaded) |

**Note:** F1–F4 are hardcoded in `src/scenes/GameScene.js`. The current `data/game.json` registers `start`, `node_test`, and `node_test_sub` — so F4 works, and F1–F3 will toast a warning. See `docs/qa-node-system.md` for the node-system test scene.

## Editor v2 — Module Architecture

The editor is a single-page app with multiple **modes** (Scene / Menu / Splash / Script / Animations) and a **module-contract** system. See `docs/editor-architecture/module-contract.md` for the full spec.

### Editor Modes (topbar buttons)
- **Scene** — node-graph + layer/object preview (default mode)
- **Menu** — title screen layout editor
- **Splash** — splash screen configuration
- **Script** — Monaco-powered JSON/script editor (uses `@monaco-editor/loader`)
- **Animations** — keyframe animation editor

### Module Contract (for `tools/views/*.js`)

```js
export const id = 'module-name';
export const label = 'Module Name';
export const contributions = { panels: [...], commands: [...], outlineSections: [...],
                                publishes: [...], subscribes: [...] };
export function init(ctx) { /* setup scoped state */ }
export function render(container, ctx) { /* render into container */ }
export function destroy() { /* cleanup */ }
export function onEvent(name, detail) { /* event handler */ }
```

`ctx` provides `{ state, eventBus, backend, shell }`. The `backend` adapter (`tools/shared/backend-adapter.js`) wraps `/api/*` calls. The event bus uses `CustomEvent` on `window` (e.g. `scene:layer-changed`, `selection:changed`, `editor:dirty`).

### Standard Events
- `editor:render`, `editor:dirty`, `editor:saved`
- `scene:changed`, `scene:background-changed`, `scene:node-changed`, `scene:layer-changed`
- `selection:changed` (item type/id)
- `inspector:refresh` (force re-render the inspector)
- `editor:open-assets` (open asset browser with optional `detail.filter`)

### Editor → Game bridge
- **Play from editor**: `window.__playFromNode(nodeId)` calls `forceSave()` then sets `localStorage.nge_debug_start = { sceneId, nodeId }` and opens `/`. `BootScene` reads and clears that key, then starts `GameScene` at the specified node. (See `tools/app.js:96` and `BootScene.create`.)
- **Save button** (`btn-save`) is wired in `app.js:54` and calls `forceSave()` which POSTs to `/api/save`.

## Editor Backend API (`tools/editor-backend.js` — Vite plugin)

All under `/api/`. The editor uses these to persist content to disk.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/save` | POST | Write all project files (`game`, `characters`, `variables`, `theme`, `scenes`, `animations`) to disk. Returns `{ success, warnings }`. **Validates** for missing node references and missing assets in layers before writing. |
| `/api/list-assets` | GET | Recursive scan of `public/assets/` returning `{ name, path, type, size, modified }`. |
| `/api/upload-asset` | POST | `{ targetDir, filename, base64 }` → write to `public/assets/<targetDir>/`. |
| `/api/delete-asset` | POST | `{ targetPath }` → rm file or directory. Rejects `..` paths. |
| `/api/project/new` | POST | Wipes `data/` + `data/scenes/` + `data/animations/` and writes a fresh template. |
| `/api/create-folder` | POST | `{ targetPath }` mkdir (project-root relative, rejects `..`). |
| `/api/create-file` | POST | `{ targetPath, content }` write. |

`/api/save` accepts a single JSON payload: `{ game, characters, variables, theme, scenes: {id: sceneData}, animations: {id: animData} }`. Scenes and animations arrays are **cleared and rewritten** each save (deletions are honored).

## Adding a New Scene
1. Create `data/scenes/<id>.json` with `entryNode`, `nodes[]`, optionally `layers[]`.
2. Add the scene ID to `scenes` in `data/game.json`.
3. Refresh — `BootScene` picks it up automatically. No code changes needed.

## Adding a New Node Type
1. Add a `Registry.registerNodeType(typeId, { ... })` call in `src/nodes/CoreNodes.js` (or a new file imported from `main.js` / `app.js`).
2. The registry entry needs: `label`, `color`, `defaultData()`, `renderEditor(node, ctx)`, `executeRuntime(node, controller)`. Optional: `getHeight`, `getOutputs`, `getConnections`, `bindEditor`.
3. Add a runtime handler in `src/systems/SceneController.js` (or call `controller.advance()` from `executeRuntime`).
4. The editor and runtime share the same registry — one source of truth.

## Asset Import

```bash
npm run import-asset -- background ~/Downloads/city.png     # → public/assets/backgrounds/
npm run import-asset -- portrait   ~/Downloads/elena.png     # → public/assets/characters/
npm run import-asset -- bgm        ~/Music/theme.mp3          # → public/assets/audio/bgm/
npm run import-asset -- sfx        ~/Downloads/click.wav      # → public/assets/audio/sfx/
npm run import-asset -- font       ~/Downloads/NotoSans.ttf   # → public/assets/fonts/
```
Or use the editor's asset browser (uploads via `/api/upload-asset`).

Asset keys can be:
- A bare stem: `cloudsnight` (resolves to `cloudsnight.png` for images, or probed `mp3/ogg/wav/opus/m4a` for audio).
- A relative path: `backgrounds/BG_throne_00001_.png` or `audio/bgm/theme`.

## Architecture Notes

### Boot & Data Loading
- `BootScene.create()` is `async`. It uses `fetch()` with **absolute paths** (`/data/...`, `/assets/...`) — Phaser's built-in `this.load.json` has Vite path-resolution issues, do NOT use it.
- `safeFetchJson()` rejects any response that starts with `<` (HTML fallback page), preventing 404 → parse errors.
- All scenes listed in `game.scenes[]` are fetched in parallel, plus all `game.animations[]` from `data/animations/`.
- Images are prefetched as blobs → `Image` → cached under their full asset key (NOT prefixed `bg_` — that's only for theme splash/menu backgrounds). Missing images log a warning and continue.
- Audio is preloaded via `this.load.audio(key, url)` (so Phaser's `cache.audio.exists()` works at runtime), then `load.start()` is awaited. Missing audio logs once via `AudioSystem._warnedKeys` (no spam).
- `nge_debug_start` localStorage key is checked at end of boot — if set, `GameScene` is started directly at that node (used by the editor's "play from here" feature).

### Splash / Menu / Game Flow
- `Boot → (Splash if `theme.ui.splash.enabled`) → Menu → Game`
- `SplashScene` reads `Data.theme?.ui?.splash` and fades in/out a logo. Click to skip if `skipOnClick: true`. If no logo, just waits the combined fadeIn+hold+fadeOut.
- `MenuScene` reads `Data.theme?.ui?.menu` to render the title screen. Falls back to a hardcoded UI if theme is missing. `Continue` is disabled if no save exists in `localStorage.narrative_saves[9]`.
- `GameScene.create()` reads scene data passed by `MenuScene` (`{ loadScene, nodeId, variables }`) and rehydrates `VariableSystem.deserialize()`.

### Editor App
- `tools/index.html` + `tools/app.js` is the unified Editor v2 SPA. `tools/dialogue-editor/` is the legacy standalone.
- Functions invoked from dynamically-generated HTML must be exposed on `window.*` (Vite wraps inline `<script>` in module scope). Editor uses `window.__playFromNode`, `window.__setActiveScene`, etc.
- Static buttons: `addEventListener` in `app.js`. Template-rendered forms: `window.__exportedFn()`.
- Canvas render loop in `graph.js` wraps `renderCanvas()` in try/catch to avoid per-frame crashes.
- `state.js` owns the global `editorState` and a debounced auto-save timer (`_saveTimer`).

### SceneController
- Pure graph traversal. `startScene(id, [nodeId]) → jumpToId(entryNode) → processNode(node) → typeDef.executeRuntime(node, this) → advance() → jumpToId(currentNode.next)`.
- No sequential index. Missing `next` ends the scene.
- Hooks: `onDialogue`, `onChoice`, `onChoiceTimeout`, `onSceneStart`, `onSceneEnd`, `onAction`, `onWait`, `onBackgroundChange` — set by `GameScene._wireSceneController()`.
- Call stack (`_callStack`) backs `call_scene`/`macro`/`end` interaction. `end.nextScene` overrides stack return and clears scopes. `macro` pushes `node.args` via `vars.pushScope(args)`; `end` pops via `vars.popScope()`.
- Animation/visibility node handlers resolve targets through `LayerSystem` first, then `CharacterSystem.portraits`, with `camera` as a special case.

### Registry & Node System
- `src/systems/Registry.js` is a tiny static class. `Registry.registerNodeType(typeId, config)` is called once at module load time.
- Both the runtime (`SceneController.processNode`) and the editor (inspector) look up node types by ID — **one source of truth**.
- A node type's `executeRuntime(node, controller)` is what actually runs at runtime. `renderEditor(node, ctx)` is what the inspector shows. Both can share state via the same `node` object.
- `bindEditor(node, container, ctx, helpers)` (optional) lets complex editors (e.g. `choice`, `event` with dynamic asset dropdown) wire post-render event handlers.

### VariableSystem
- Scoped variables: `scopes[]` with index 0 = global. `pushScope(initialVars)` for `macro`/`call_scene` args, `popScope()` on return. `get()` searches top-to-bottom; `set()` writes to the scope that first defines the name (or top scope if undefined).
- Compiles conditions once per call into a small expression tree; supports AND/OR with parens.
- Values typed as boolean / number / string. JSON `null` becomes `null` (treats as falsy in `==`/`!=`).
- `applyAction(node)` handles `setFlag`+`setValue`, `toggleFlag`, and `addFlag`+`delta`.
- `serialize()` returns only the global scope; `deserialize(data)` replaces `scopes[0]`.

### SaveSystem
- localStorage key `narrative_saves` (a JSON array). Slot 0 = quick save, slot 9 = auto-save (written on every `onSceneStart`).
- `save(slotIndex)` returns `{ slot, timestamp, title, sceneId, nodeId, variables }`.
- `load(slotIndex)` rehydrates variables into `VariableSystem` and returns `{ sceneId, nodeId }` for the caller to navigate.
- `MenuScene._loadAutoSave()` reads `slots[9]` and starts `GameScene` with `{ loadScene, variables }`.

### SettingsSystem
- localStorage key `narrative_settings`. `textSpeed` (10–200ms, default 40), `bgmVolume`, `sfxVolume` (0–1), `fullscreen`.
- `clamp(v, min, max)` helper. `save()` is called from `MenuScene`'s settings panel on every inc/dec click.

### AudioSystem
- BGM crossfades via tweens: fades out old channel, fades in new channel simultaneously over `fadeDuration` ms (default 800ms). Same-track restart is skipped.
- `stopBGM(duration)` fades out then destroys. `duration: 0` = instant stop.
- `_warnedKeys` Set deduplicates missing-key warnings.
- `GameScene._loadAndPlay(type, key, onReady)` is a runtime fallback that probes `mp3/ogg/wav/opus/m4a` extensions and registers via Phaser's loader, then calls `onReady`. Used when an `event` node fires an audio key that wasn't in the preloaded cache.

### DialogueSystem
- Built once per `GameScene.create()` from theme config. Container at `depth=100` (above characters at `depth=50` and layers at `depth=0`).
- Typewriter: each char added after `textSpeed` ms. Inline tags parsed by regex `\[(show|hide|anim):([^\]]+)\]` and fired when the typewriter hits their `index` offset.
- `[anim:target:key]` resolves target via `layers.layers.get(targetId).image` first, then `characters.activeSprites.get(targetId)`. Note: `LayerSystem.layers` is a plain object (not a Map) — there's a known bug here; if anim tags fail, check whether your code uses `.get()` on it. **Update: this was fixed — uses bracket access `layers?.[tag.target]` and `portraits?.[tag.target]` now.**
- Skip-to-end (`advance()` while typing) immediately fires all pending tags, sets full text, shows the continue arrow.
- History: `history = []`, pushed on `showDialogue()`. `H` toggles `showHistory()` (implementation in `DialogueSystem`).
- Skip/auto modes: `setSkipMode(bool)`, `setAutoMode(bool)`, `toggleSkip()`, `toggleAuto()`. Auto-advance fires the dialogue callback after 2s.

## Testing

- `npm test` — Vitest with jsdom. **Only pure-logic systems are covered:** DataLoader, VariableSystem, SceneController, SaveSystem, SettingsSystem, TransitionSystem.
- Phaser-dependent systems (DialogueSystem, CharacterSystem, LayerSystem, AudioSystem, AnimationRunner) are tested via the manual `docs/qa-checklist.md`.
- `tests/setup.js` polyfills `localStorage` (jsdom already provides it) and silences `console.warn`/`console.error` per-test, exposing `getWarnings()` / `getErrors()` helpers.
- Test reporter is `verbose` locally, `default` in CI (`process.env.CI`).
- Run a single test file: `npx vitest run --config tests/vitest.config.js tests/systems/VariableSystem.test.js`.

## Common Pitfalls
- Don't add a `fetch()` call in `BootScene` for new scenes — it's already data-driven from `game.scenes`.
- Don't use `this.load.json` / Phaser loader for game data — Vite path issues.
- Don't reference `setFlag`/`setValue` for read-only conditions — they mutate the variable, they're not predicates.
- Background keys can be a bare stem (`cloudsnight`) or a relative path (`backgrounds/BG_throne_00001_.png`). Both work. The stem form auto-appends `.png` (or probes audio extensions).
- The `bg_` texture prefix is only used for `theme.ui.splash.logo` and `theme.ui.menu.background` (legacy). Scene layers and characters use the raw asset key.
- The two node-resolution paths for animation targets (`LayerSystem.layers` as object vs `Map`) are inconsistent. If a `[anim:...]` tag fails on a layer, double-check whether `.get()` is being used on what is actually a plain object.
- F1–F4 hotkeys are hardcoded in `GameScene._setupInput` and reference scene IDs that must exist in `Data.scenes` to work. F4 → `node_test` is the only one currently wired to a real scene.
- The editor's "Save" button is **not** mock-only — it POSTs to `/api/save`. The README's "save is mocked" claim is stale.
- The legacy `nge_editor_data` localStorage path has been removed — the editor only reads from disk via `/api/save` and `/data/*.json`.
- `Migrate-v2-assets.cjs` is a one-off script for reorganizing the assets folder layout, not part of the dev workflow. Don't `require` it from new code.
- `data/theme.json` is **optional** — `BootScene` swallows fetch errors for it. If theme is missing, the engine falls back to hardcoded layouts.
- `GameScene._getStartScene()` defaults to `'start'` as a fallback (line 399). If your game doesn't have a `start` scene, change this or set `game.startScene` in `data/game.json`.

## `.brain/` — Antigravity AI Memory

The `.brain/` folder (managed by Antigravity) stores AI session context and project memory. It is **read-only reference** for the agent — do not modify its contents.

```
.brain/
├── map.json    # Project component map
├── memory.md   # Decision log & gotchas (append-only)
└── session.md  # Per-session state
```

If Antigravity adds new files or schemas to `.brain/`, update this section accordingly.
