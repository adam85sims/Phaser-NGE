# Phaser-NGE Engine Audit

> **Scope**: Engine only (`src/`). Editor, tools, and launcher excluded.
> **Codebase**: 4,056 LOC across 17 files (12 systems, 4 scenes, 1 node registry)
> **Tests**: 191 passing, 5 test files, 1.15s — covering DataLoader, VariableSystem, SceneController, SaveSystem, SettingsSystem

---

## 1. Feature Inventory — What We Have

### ✅ Core Narrative Engine
| Feature | System | Status |
|---------|--------|--------|
| Graph-based scene traversal | [SceneController.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SceneController.js) | Solid |
| Dialogue typewriter w/ configurable speed | [DialogueSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/DialogueSystem.js) | Works |
| Inline scripting tags `[show:x] [hide:x] [anim:t:k]` | DialogueSystem | Works |
| Choice branching with conditions | SceneController | Works |
| Timed choices with countdown fallback | SceneController | Works |
| Random weighted branches | SceneController | Works |
| Compound condition evaluation (AND/OR/parens) | [VariableSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/VariableSystem.js) | Solid, well-tested |
| Sub-scene calls with call stack | SceneController | Works |
| Macro/prefab nodes with scoped arguments | SceneController + VariableSystem | Works |
| Variable set/add/toggle operations | VariableSystem | Works |
| Variable change listeners | VariableSystem | Works (unused by engine) |

### ✅ Visual Systems
| Feature | System | Status |
|---------|--------|--------|
| Multi-layer scene composition | [LayerSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/LayerSystem.js) | Works |
| Recursive container nesting | LayerSystem | Works |
| Legacy single-background migration | LayerSystem | Works |
| Character portraits with expressions | [CharacterSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/CharacterSystem.js) | Basic |
| 5-position portrait placement | CharacterSystem | Works |
| Procedural placeholder portraits | CharacterSystem | Works |
| Camera FX (shake/flash/fade/zoom/pan) | SceneController | Works |
| Animate nodes (tween any property) | SceneController | Works |
| Show/Hide object nodes | SceneController | Works |
| Keyframe animation runner | [AnimationRunner.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/AnimationRunner.js) | Works |
| Layout system (runtime UI themes) | [LayoutSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/LayoutSystem.js) | New, basic |

### ✅ Audio
| Feature | System | Status |
|---------|--------|--------|
| BGM with crossfade | [AudioSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/AudioSystem.js) | Works |
| SFX one-shot playback | AudioSystem | Works |
| Per-event volume control | GameScene + AudioSystem | Works |
| Runtime audio fallback (probe & load) | [GameScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/GameScene.js#L378-L404) | Works |
| Missing audio dedup warnings | AudioSystem | Works |

### ✅ Persistence
| Feature | System | Status |
|---------|--------|--------|
| 10-slot save/load (localStorage) | [SaveSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SaveSystem.js) | Works |
| Quick save/load (F5/F9) | GameScene | Works |
| Auto-save on scene transition | GameScene | Works |
| Persistent settings | [SettingsSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SettingsSystem.js) | Works |
| Settings menu (text speed, volume, fullscreen) | [MenuScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/MenuScene.js) | Works |

### ✅ Boot & Flow
| Feature | System | Status |
|---------|--------|--------|
| Parallel data/asset loading | [BootScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/BootScene.js) | Works |
| Safe HTML-rejection fetching | BootScene | Works |
| Data-driven splash screen | [SplashScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/SplashScene.js) | Works |
| Data-driven menu screen | MenuScene | Works |
| "Play from editor" debug bridge | BootScene | Works |
| 14 registered node types | [CoreNodes.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/nodes/CoreNodes.js) | Works |
| Plugin registry for nodes | [Registry.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/Registry.js) | Clean |

---

## 2. Code Quality Issues 🔴

### 2A. Critical Bugs

#### `DialogueSystem._typeNextChar` — stale `.has()` call on plain object
[DialogueSystem.js:206](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/DialogueSystem.js#L206-L207)
```js
if (this.scene.layers?.layers?.has(tag.target)) // ← BUG: .layers is a plain {}, not a Map
```
This was already identified in memory.md (line 31) for a different file, but the **same bug persists here**. `layers.layers` is a plain object (`{}`), not a `Map`. `.has()` will throw, silently killing all inline `[anim:...]` tags.

#### `play_animation` handler in GameScene — wrong Data access path
[GameScene.js:173](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/GameScene.js#L173-L174)
```js
if (targetObj && this.sys.game.scene.keys.BootScene.Data?.animations) {
  const animData = this.sys.game.scene.keys.BootScene.Data.animations[animKey];
```
`BootScene` doesn't have a `Data` property. Animations are stored on the global `Data` singleton (`Data.animations`). This path will **always** evaluate to `undefined`, making `play_animation` events silently fail at runtime.

#### `_loadAndPlay` — shadowed `exts` variable
[GameScene.js:380-386](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/GameScene.js#L380-L386)
```js
const exts = ['mp3', 'ogg', 'wav', 'opus', 'm4a']; // line 380 — outer, unused
const tryLoad = async () => {
  // ...
  const exts = ['mp3', 'ogg', 'wav', 'opus', 'm4a']; // line 386 — inner shadows outer
```
The outer `exts` is declared but never used — the inner one shadows it. Not a runtime error but dead code that signals a messy refactor.

#### `MenuScene` — stale `bg_` prefix on texture lookup
[MenuScene.js:31-32](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/MenuScene.js#L31-L32)
```js
if (config?.background && this.textures.exists(`bg_${config.background}`)) {
  this.add.image(W/2, H/2, `bg_${config.background}`)
```
Memory.md (line 21) says the engine moved away from `bg_` prefixes. `BootScene` caches images under their raw path keys — not `bg_` prefixed. **The menu background will never load.** Same issue in [SplashScene.js:36-37](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/SplashScene.js#L36-L37).

Additionally, the current `theme.json` stores the menu background as a **full localhost URL** (`http://localhost:3000/assets/...`) — this is wrong. It should be a relative asset path.

#### `SplashScene` — same `bg_` prefix bug
[SplashScene.js:36](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/SplashScene.js#L36)
```js
if (config.logo && this.textures.exists(`bg_${config.logo}`)) {
```
Same issue as MenuScene. Also, the current `theme.json` stores `logo` as a **JSON-stringified object** (`"{\"category\":\"backgrounds\",...}"`), which will never match a texture key.

---

### 2B. Structural Smells

#### `SceneController` is a 616-line God Object
[SceneController.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SceneController.js) contains the graph walker **and** the runtime behavior for 8 node types (`showDialogue`, `presentChoices`, `evaluateCondition`, `fireEvent`, `doWait`, `animateNode`, `showObjectNode`, `hideObjectNode`, `cameraNode`, `setVariableNode`, `evaluateRandomBranch`, `presentTimedChoice`). These methods should live in the node type definitions via `executeRuntime`, but instead the `executeRuntime` callbacks just bounce back: `(node, ctrl) => ctrl.showDialogue(node)`.

**Impact**: The whole point of the Registry decoupling was to remove this. The methods are still on SceneController as the single source of truth, defeating the purpose.

#### `GameScene` is a 415-line wiring switchboard
[GameScene.js:121-209](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/GameScene.js#L121-L209) — the `onAction` handler is an 89-line switch with inline tween logic, audio fallback, and toast rendering. This should be delegated to the respective systems.

#### `CoreNodes.js` is 766 lines of mixed concerns
This file registers 14 node types, each containing both **editor UI rendering** (HTML template strings) and **runtime execution**. The editor-only code (DOM manipulation, `ctx.backend.listAssets()`, etc.) is bundled into the production game build unnecessarily.

> [!WARNING]
> **CoreNodes.js adds ~36KB** of editor-only HTML templates and DOM binding logic to the game bundle. This code never runs at runtime but inflates the build.

#### `DialogueSystem` hardcodes visual layout
[DialogueSystem.js:64-103](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/DialogueSystem.js#L64-L103) — The text box, nameplate, and continue arrow are built with magic numbers and hardcoded styles. `_drawTextBox()` ignores `theme.backgroundColor` entirely — it always draws `0x0a0a1a`. The theme's `backgroundColor: "#22224488"` is never read.

#### `VariableSystem` initializes from `Data` in constructor
[VariableSystem.js:29-33](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/VariableSystem.js#L29-L33) — `_initFromData()` reads `Data.variables` at construction time. But `Data.variables` stores defaults as **strings** (`"120"`, `"0"`) rather than typed values. The description field for `path_flags` says `default: false` but `type: "number"` — this is an invalid type/default mismatch that will cause subtle bugs.

#### `jumpToId` uses linear `.find()` on every node lookup
[SceneController.js:549](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SceneController.js#L549)
```js
const node = this.currentScene.nodes.find(n => n.id === nodeId);
```
This is O(n) per jump. In a scene with 200+ nodes, this is measurably slow for rapid event chains. Should build a `Map<id, node>` once on `startScene`.

#### No event emitter — hooks are nullable callbacks
SceneController uses 7 nullable callbacks (`onDialogue`, `onChoice`, `onSceneStart`, etc.) set by GameScene. This pattern is fragile — there's no way for multiple systems to observe events, and forgetting to wire one causes silent no-ops.

---

### 2C. Data Integrity Issues

#### `variables.json` has wrong types and stale descriptions
```json
"time_left": { "type": "number", "default": "120" }    // ← string "120", not number
"path_flags": { "type": "number", "default": false }    // ← boolean default for number type
"inventory": { "type": "string", "default": false }     // ← boolean default for string type
```
The descriptions contain TODOs: *"We shouldn't need a default here?"*, *"should probably be an array?"*

#### `theme.json` has broken values
- `ui.menu.background` is a full `http://localhost:3000/...` URL instead of a relative path
- `ui.splash.logo` is a JSON-stringified object instead of a path string
- `dialogue.backgroundColor` (`"#22224488"`) is read nowhere in the engine

---

## 3. Missing Features for a Killer Engine 🚀

### Tier 1 — Table Stakes (every VN engine has these)

| Feature | Impact | Effort |
|---------|--------|--------|
| **Text input node** — player types name, answers | Core gameplay mechanic | Medium |
| **Rich text in dialogue** — bold, italic, color, size | Basic expressiveness | Medium |
| **Portrait transitions** — slide in/out, not just fade | Visual polish | Low |
| **Voice acting support** — `.ogg` per dialogue node | Premium feel | Medium |
| **CG Gallery / Unlockables** — scene recollection, art gallery | Replay value | Medium |
| **Backlog scrolling** — full scrollable history, not truncated 22 lines | UX essential | Low |
| **Text speed per-line** — override global speed on specific dialogue | Writer control | Low |
| **Screen effects** — rain, snow, particles via node | Atmosphere | Medium |

### Tier 2 — Differentiators (what makes it *killer*)

| Feature | Impact | Effort |
|---------|--------|--------|
| **Sprite/Live2D character expressions** — not just static portraits | Modern VN standard | High |
| **Dialogue response system** — NPC affinity / reputation tracking | Depth & replayability | Medium |
| **Scene transitions** — wipe, dissolve, iris, curtain (not just fade) | Cinematic feel | Medium |
| **Inventory / Item system** — usable items, key items, collectibles | Gameplay expansion | Medium |
| **Map / Location nodes** — visual map with clickable locations | Exploration | Medium |
| **Parallel event tracks** — simultaneous animations + dialogue | Cinematic sequences | High |
| **Chapter system** — chapter titles, progress tracking, jump | Game structure | Low |
| **Achievement system** — tracked across playthroughs | Engagement | Medium |
| **Localization / i18n** — multi-language dialogue | Reach | High |

### Tier 3 — Power User / Engine Maturity

| Feature | Impact | Effort |
|---------|--------|--------|
| **Undo/redo for gameplay** — rewind last N choices | QoL | Medium |
| **Flowchart viewer** — in-game route map showing visited paths | Meta-engagement | High |
| **Conditional BGM layers** — layer instruments based on variables | Dynamic audio | High |
| **Plugin API** — user-defined node types loaded at runtime | Extensibility | Medium |
| **Export to web/desktop** — self-contained build (no dev server) | Distribution | Medium |
| **Save to cloud** — IndexedDB or server-backed saves | Persistence | Medium |

---

## 4. Prioritized Roadmap

### Phase 1: Fix the Foundation 🔧
*Goal: Zero bugs, clean architecture, production-ready.*

- [ ] **Fix `bg_` prefix bugs** in MenuScene + SplashScene — use raw texture keys
- [ ] **Fix `DialogueSystem` `.has()` bug** — use `in` operator or bracket access
- [ ] **Fix `play_animation` Data path** — use `Data.animations[key]` not `BootScene.Data`
- [ ] **Fix theme.json broken values** — relative paths, clean splash logo
- [ ] **Fix variables.json type mismatches** — proper typed defaults
- [ ] **Remove shadowed `exts`** in `_loadAndPlay`
- [ ] **Build node lookup Map** in `startScene()` — O(1) instead of O(n)
- [ ] **Apply `theme.backgroundColor`** in DialogueSystem `_drawTextBox()`
- [ ] **Split CoreNodes.js** — separate `runtime/` and `editor/` registrations so editor HTML doesn't ship in the game build

### Phase 2: Core Quality 💎
*Goal: Every existing feature works beautifully.*

- [ ] **Event emitter system** — replace nullable callbacks with a typed emitter
- [ ] **Extract node behaviors from SceneController** — move runtime logic into each node type's `executeRuntime`, completing the Registry decoupling
- [ ] **Rich dialogue history** — scrollable, full-length, searchable
- [ ] **Portrait transitions** — slide-in from edges, expressions cross-fade
- [ ] **Scene transition effects** — fade, wipe, dissolve
- [ ] **Theme actually works end-to-end** — every `theme.json` field is respected by the engine (text color, bg color, fonts, spacing, border radius)

### Phase 3: Feature Expansion 🚀
*Goal: Features that make writers choose this engine.*

- [ ] **Text input node** — player name, puzzle answers
- [ ] **Rich text** — bold, italic, color spans in dialogue
- [ ] **Voice acting** — optional `.ogg` per dialogue, with lip-sync placeholder
- [ ] **Screen effects** — particle emitter node (rain, snow, fireflies, dust)
- [ ] **Chapter system** — chapter titles, progress tracking
- [ ] **Inventory system** — key items, collectibles, conditions on items
- [ ] **Localization** — string table per language, runtime switch

### Phase 4: Killer Differentiators ⚡
*Goal: Features that make this engine stand out.*

- [ ] **CG Gallery / Scene recollection** — unlockable art + replay scenes
- [ ] **Flowchart viewer** — in-game route visualization
- [ ] **Achievement system** — cross-playthrough tracking
- [ ] **Parallel event tracks** — simultaneous animations during dialogue
- [ ] **Plugin API** — external node type registration
- [ ] **Export pipeline** — production build that works without Vite

---

## 5. Test Coverage Gaps

| System | Tested? | Gap |
|--------|---------|-----|
| DataLoader | ✅ | Minimal (just the accessor methods) |
| VariableSystem | ✅ | Good coverage |
| SceneController | ✅ | Excellent (44KB test file) |
| SaveSystem | ✅ | Good coverage |
| SettingsSystem | ✅ | Good coverage |
| **DialogueSystem** | ❌ | **Zero tests** — typewriter, tags, skip, auto, history |
| **CharacterSystem** | ❌ | **Zero tests** — show/hide, positioning, expressions |
| **AudioSystem** | ❌ | **Zero tests** — crossfade, fallback, mute |
| **LayerSystem** | ❌ | **Zero tests** — layer tree, show/hide, fallback gradient |
| **AnimationRunner** | ❌ | **Zero tests** — keyframe parsing, relative values, chains |
| **LayoutSystem** | ❌ | **Zero tests** — theme replacement, layer building |
| **Registry** | ❌ | Not tested (trivial Map wrapper, low priority) |

> [!IMPORTANT]
> **5 of 12 systems have zero test coverage.** DialogueSystem (489 LOC), LayerSystem (206 LOC), and AnimationRunner (102 LOC) are the highest-risk untested systems.

---

## 6. File-by-File Verdict

| File | LOC | Verdict | Notes |
|------|-----|---------|-------|
| [main.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/main.js) | 34 | ✅ Clean | Config-driven, reads width/height from game.json |
| [BootScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/BootScene.js) | 251 | ⚠️ OK | Duplicated `safeFetchJson` pattern (3×). Some fetch logic could be extracted. |
| [SplashScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/SplashScene.js) | 75 | 🔴 Bug | `bg_` prefix. Broken `theme.json` logo value. |
| [MenuScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/MenuScene.js) | 201 | 🔴 Bug | `bg_` prefix. Full URL in theme. Settings screen is nice. |
| [GameScene.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/scenes/GameScene.js) | 415 | ⚠️ Messy | God-class wiring. `onAction` is a tangled switch. Dead code in `_loadAndPlay`. Wrong `Data` access in `play_animation`. |
| [SceneController.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SceneController.js) | 616 | ⚠️ Refactor | Solid logic, but too many responsibilities. Node behaviors should move out. Linear node lookup. |
| [DialogueSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/DialogueSystem.js) | 489 | ⚠️ Messy | `.has()` bug. Ignores theme colors. History is truncated. No tests. |
| [CharacterSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/CharacterSystem.js) | 113 | ⚠️ Basic | Works but minimal. Hard-coded `.setScale(2)`. No slide transitions. |
| [LayerSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/LayerSystem.js) | 206 | ✅ Good | Clean recursive tree builder. Promise-based show/hide. |
| [LayoutSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/LayoutSystem.js) | 206 | ⚠️ Early | Works but `image` type strips extension from key, may not match BootScene cache key. |
| [VariableSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/VariableSystem.js) | 232 | ✅ Solid | Well-tested, clean scoping. Minor: `==` instead of `===` in condition eval (intentional for type coercion?). |
| [AudioSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/AudioSystem.js) | 161 | ✅ Good | Clean crossfade logic. Dedup warnings. |
| [SaveSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SaveSystem.js) | 87 | ✅ Clean | Simple and correct. |
| [SettingsSystem.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/SettingsSystem.js) | 52 | ✅ Clean | Minimal, works. |
| [DataLoader.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/DataLoader.js) | 31 | ✅ Clean | Tiny singleton. |
| [Registry.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/Registry.js) | 37 | ✅ Clean | Tiny, does its job. |
| [AnimationRunner.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/systems/AnimationRunner.js) | 102 | ✅ Good | Clean keyframe-to-tween logic. Handles relative values. |
| [CoreNodes.js](file:///home/adam/Documents/Dev/Phaser-NGE/src/nodes/CoreNodes.js) | 766 | ⚠️ Split needed | Editor HTML pollutes the game build. |

---

## Summary

The engine has a **solid architectural foundation**: graph-based scene traversal, scoped variables, a plugin-ready node registry, and decent test coverage on the core logic. The problems are execution-level: several bugs that have gone unnoticed because they're in paths that aren't exercised by the current test scene (menu backgrounds, inline animation tags, play_animation events), and structural debt from growing organically.

The biggest bang-for-buck work is:
1. **Fix the 4 critical bugs** (30 min each)
2. **Split CoreNodes** into runtime-only and editor-only (1-2 hours)
3. **Complete the Registry decoupling** — move node behaviors out of SceneController (half day)
4. **Add tests for DialogueSystem and LayerSystem** (half day)
5. **Scene transitions & portrait animations** — immediate visual upgrade (few hours)

What's your priority? Happy to start on the bug fixes right now, or we can discuss the feature roadmap first.
