---
name: game-scene
description: "The main gameplay loop scene. Instantiates all engine systems (VariableSystem, SceneController, DialogueSystem, CharacterSystem, SaveSystem, AudioSystem), wires SceneController callbacks to the rendering systems, handles player input (keyboard + mouse), and manages scene transitions with fade effects. Related triggers: main scene, gameplay loop, system wiring, player input, scene transitions."
---

# GameScene

> The main gameplay scene — creates and wires all systems, handles all player input, manages background rendering and scene transitions.

**Source:** `src/scenes/GameScene.js`
**Related skills:** `../scene-controller/SKILL.md`, `../dialogue-system/SKILL.md`, `../character-system/SKILL.md`, `../variable-system/SKILL.md`, `../save-system/SKILL.md`, `../audio-system/SKILL.md`

## Scene Key

```
'GameScene'
```

## `create()` Flow

1. **Background** — creates a Phaser Graphics object, draws a gradient background
2. **Systems** — instantiates all 6 systems:
   ```js
   this.vars = new VariableSystem()
   this.sceneCtrl = new SceneController(this.vars)
   this.dialogue = new DialogueSystem(this)
   this.characters = new CharacterSystem(this)
   this.saveSys = new SaveSystem(this.vars, this.sceneCtrl)
   this.audio = new AudioSystem(this)
   ```
3. **Wiring** — connects `SceneController` callbacks to the rendering systems
4. **Input** — binds keyboard and mouse handlers
5. **Fade in** — `cameras.main.fadeIn(500)`
6. **Start** — resolves start scene from `Data.game.startScene` (falls back to `'sample'`) and calls `sceneCtrl.startScene()`

## SceneController Wiring

| Callback | What it does |
|----------|-------------|
| `onDialogue` | Shows character portrait + runs dialogue text |
| `onChoice` | Hides characters, shows choice list |
| `onSceneStart` | Redraws background, fades camera, starts BGM |
| `onSceneEnd` | Hides UI, optionally shows ending text, auto-transitions to nextScene after 2.5s |
| `onAction` | Routes to AudioSystem or camera shake/flash |
| `onWait` | Hides dialogue box (shows silence) |

## Input Handling

| Key | Action |
|-----|--------|
| Space / Enter / Click | Advance dialogue, skip typewriter |
| 1-9 | Select choice by number |
| F1 | Jump to 'sample' scene |
| F2 | Jump to 'test-conditions' scene |
| F3 | Jump to 'test-events' scene |

The `_handleAdvance()` method:
- Ignores input if scene is not running or at a choice
- For dialogue: calls `dialogue.advance()` — if it returns `false` (typing done), calls `sceneCtrl.advance()`
- For event/wait: auto-advances immediately
- For end: restarts the scene

## Scene Switching

`_switchScene(sceneId)` handles the F-key debug scene jumps:
1. Hides dialogue and characters
2. Destroys any end text
3. Fades out camera
4. On fade complete, calls `ctrl.startScene(sceneId)`

## Background

`_drawBackground(key)` draws a vertical gradient using three colors (`#0a0a1a`, `#0f0f2a`, `#1a0a2a`). The `key` parameter is reserved for future background asset loading — currently the gradient is always drawn regardless of the key.

## Gotchas

- **Input is prioritized** — `isAtChoice` check happens before any other input handling. When choices are visible, Space/Enter/clicks don't advance dialogue — they're ignored.
- **Typewriter click consumption** — the `dialogue.advance()` return value is critical. When `true` (typing was in progress), `_handleAdvance()` returns without calling `sceneCtrl.advance()`. When `false` (typing done), the scene advances.
- **Scene end auto-transition** — `onSceneEnd` uses a 2.5s delay before fading and starting the next scene. The camera's `fadeoutcomplete` event is used as the signal to start the new scene.
- **`_pendingEndText`** — stored as an instance property so it can be cleaned up when switching scenes. Must be null-checked in `_switchScene()`.
- **F1-F3 are debug shortcuts** — they directly call `_switchScene()` which bypasses normal story flow. Remove in production builds.
- **Shutdown** — the `shutdown()` lifecycle method destroys all systems. This is called automatically when the scene is stopped or restarted.
