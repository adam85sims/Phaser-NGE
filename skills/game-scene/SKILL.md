---
name: game-scene
description: "The main gameplay loop scene. Instantiates all engine systems (VariableSystem, SceneController, DialogueSystem, CharacterSystem, LayerSystem, SaveSystem, AudioSystem, SettingsSystem, AnimationRunner), wires SceneController callbacks to the rendering systems, handles player input (12+ hotkeys), manages scene transitions with fade effects, and supports crossfade, auto-save, skip/auto modes, dialogue history, and debug scene jumps. Related triggers: main scene, gameplay loop, system wiring, player input, scene transitions, hotkeys, crossfade, auto-save, debug start."
---

# GameScene

> The main gameplay scene — creates and wires all systems, handles all player input, manages background rendering and scene transitions. The central hub that connects the narrative state machine to the rendering systems.

**Source:** `src/scenes/GameScene.js`
**Related skills:** `../scene-controller/SKILL.md`, `../dialogue-system/SKILL.md`, `../character-system/SKILL.md`, `../variable-system/SKILL.md`, `../save-system/SKILL.md`, `../audio-system/SKILL.md`

## Scene Key

```
'GameScene'
```

## `create()` Flow

1. **Background** — creates a LayerSystem for multi-layer scene composition
2. **Systems** — instantiates all 8 systems:
   ```js
   this.vars = new VariableSystem()
   this.sceneCtrl = new SceneController(this.vars, this)
   this.dialogue = new DialogueSystem(this)
   this.characters = new CharacterSystem(this)
   this.layers = new LayerSystem(this)         // NEW: multi-layer scene composition
   this.saveSys = new SaveSystem(this.vars, this.sceneCtrl)
   this.audio = new AudioSystem(this)
   this.settings = new SettingsSystem()
   ```
3. **Wiring** — connects `SceneController` callbacks to rendering systems (see table)
4. **Input** — binds keyboard and mouse handlers (12+ hotkeys)
5. **Fade in** — `cameras.main.fadeIn(500)`
6. **Start** — resolves start scene: reads scene data passed from MenuScene (if Continue was used), or from `Data.game.startScene`, or `nge_debug_start` from localStorage

## SceneController Wiring

| Callback | What it does |
|----------|-------------|
| `onDialogue` | Shows character portrait via `characters.show()` + runs dialogue typewriter |
| `onChoice` | Hides characters, shows choice list with prompt |
| `onChoiceTimeout` | Calls `dialogue.hideChoices()` when timed choice expires |
| `onSceneStart` | Calls `layers.loadSceneLayers()` with scene layers/background, fades camera, starts BGM, calls `saveSys.autoSave()` |
| `onSceneEnd` | Hides UI, optionally shows ending text, auto-transitions to nextScene after 2.5s |
| `onAction` | Routes to `AudioSystem.playBGM/playSFX/stopBGM`, camera shake/flash, `bg_change` via layers, or `play_animation` via AnimationRunner. Audio events are silent (no toast); non-silent events show a brief toast |
| `onWait` | Hides dialogue box (shows silence) |
| `onBackgroundChange` | Calls `layers.loadSceneLayers()` with legacy background key |

## Input Handling

| Key | Action |
|-----|--------|
| Space / Enter / Click | Advance dialogue (skip typewriter) |
| 1-9 | Select choice by number |
| **H** | Toggle dialogue history |
| **S** | Toggle skip mode (with toast) |
| **A** | Toggle auto mode (with toast) |
| **F5** | Quick save to slot 0 |
| **F9** | Quick load from slot 0 |
| **Esc** | Return to MenuScene with fade |
| **F1** | Jump to 'sample' scene (dev only) |
| **F2** | Jump to 'test-conditions' scene (dev only) |
| **F3** | Jump to 'test-events' scene (dev only) |
| **F4** | Jump to 'node_test' scene (dev/test scene) |

The `_handleAdvance()` method:
- Ignores input if scene is not running or at a choice
- For dialogue: calls `dialogue.advance()` — if it returns `false` (typing done), calls `sceneCtrl.advance()`
- For event nodes: auto-advances immediately
- For wait nodes: auto-advances when timer completes
- For end nodes: restarts the scene via `this.scene.restart()`

## Scene Switching

`_switchScene(sceneId)` handles debug scene jumps (F1-F4):
1. Hides dialogue and characters
2. Destroys any end text
3. Fades out camera
4. On fade complete, calls `ctrl.startScene(sceneId)`

`getStartScene()` reads scene data passed by MenuScene (`{ loadScene, nodeId, variables }`) for Continue/load functionality. Falls back to `Data.game.startScene` (default: `'sample'` if not set).

## Debug Start (Play from Editor)

When `BootScene` passes `{ loadScene, nodeId, variables }` in the scene data:
- `startScene()` is called with the specified scene and node
- `VariableSystem.deserialize(variables)` restores state from auto-save
- This is how the editor's "Play from here" feature and Continue button work

## Runtime Audio Fallback

`_loadAndPlay(type, key, onReady)` probes audio extensions (`mp3/ogg/wav/opus/m4a`) via HEAD requests and loads the file on-the-fly via Phaser's loader. Called when an `event` node fires an audio key that wasn't preloaded by BootScene.

## Gotchas

- **Input is prioritized** — `isAtChoice` check happens before any other input. When choices are visible, Space/Enter/clicks don't advance dialogue.
- **Typewriter click consumption** — `dialogue.advance()` return value is critical. Returns `true` if typing was skipped (consumed input); `false` if ready to advance scene.
- **Scene end auto-transition** — `onSceneEnd` uses `cameras.main.once('fadeoutcomplete', ...)` to detect when the transition finishes before starting the next scene.
- **F1-F4 are debug shortcuts** — they check `Data.getScene(sceneId)` first. If the scene isn't loaded, shows a toast warning.
- **Auto-save on scene start** — `onSceneStart` calls `saveSys.autoSave()` to slot 9, which is used by MenuScene's Continue button.
- **Silent event types** — audio events (bgm/sfx/bgm_stop/play_animation) and `camera_flash` do NOT show a toast. All other event types show a brief notification.
- **`_pendingEndText`** — stored as instance property so it can be cleaned up on scene switch.
- **Shutdown** — the `shutdown()` lifecycle method destroys all systems.
- **Settings menu language picker** — only appears if `game.localization.availableLanguages` has more than one entry. Cycles through available languages with +/- buttons.
