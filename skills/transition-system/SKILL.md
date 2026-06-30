---
name: transition-system
description: "Handles scene transition effects — fade, wipe, crossfade, iris, zoom, pixelate. Used by SceneController and GameScene for visual transitions between scenes. Supports 15 transition types configured per-scene or per-node. Related triggers: scene transitions, fade, wipe, crossfade, iris, zoom, pixelate, visual effects."
---

# TransitionSystem

> Static class providing scene transition effects. Called by SceneController on scene start/end and by GameScene for debug scene jumps.

**Source:** `src/systems/TransitionSystem.js`
**Related skills:** `../game-scene/SKILL.md`, `../scene-controller/SKILL.md`

## Static Methods

### `runTransition(scene, type, duration, onComplete?, onMidpoint?)`

Runs a transition effect. `onMidpoint` fires at the halfway point (when the scene should be swapped). `onComplete` fires when the transition finishes.

### `getAvailableTypes()`

Returns array of `{ id, label }` objects for UI dropdowns.

## Transition Types

| Type | Effect |
|------|--------|
| `none` | Instant — calls callbacks immediately |
| `fade` | Fade to black (default) |
| `white_fade` | Fade to white |
| `slide_left` | Black bar slides left across screen |
| `slide_right` | Black bar slides right across screen |
| `wipe_left` | Directional wipe from right to left |
| `wipe_right` | Directional wipe from left to right |
| `wipe_up` | Directional wipe from bottom to top |
| `wipe_down` | Directional wipe from top to bottom |
| `crossfade` | Black fade-out then fade-in |
| `iris_in` | Circular reveal (open to center) |
| `iris_out` | Circular conceal (close from edges) |
| `zoom_in` | Camera zoom in then reset |
| `zoom_out` | Camera zoom out then reset |
| `pixelate` | Zoom-based pixelation effect |

## Scene JSON Configuration

```json
{
  "transitions": {
    "enter": { "type": "crossfade", "duration": 800 },
    "exit": { "type": "wipe_left", "duration": 600 }
  }
}
```

- `enter` plays when the scene starts
- `exit` plays when leaving the scene
- If `transitions` is missing, engine defaults to `fade` with 500ms

## Implementation Notes

- **Wipes** use a moving black rectangle (Phaser Graphics)
- **Crossfade** is implemented as a fade-to-black then fade-in (true crossfade would need render textures)
- **Iris** uses alpha-based overlay (simpler than circular mask)
- **Zoom/Pixelate** animate camera zoom to simulate the effect
- All transitions use Phaser tweens — no custom shaders required

## Gotchas

- **`onMidpoint` is when the scene swap happens** — GameScene should destroy old content and load new scene content at this callback.
- **Missing type defaults to fade** — `null` or unrecognized types fall back to fade-to-black.
- **`none` type skips everything** — callbacks fire immediately, no visual effect.
- **Duration is total** — each half (out + in) gets `duration / 2` ms.
