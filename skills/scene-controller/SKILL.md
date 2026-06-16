---
name: scene-controller
description: "Graph-based narrative state machine — walks a scene's node graph by following explicit 'next' connections. Uses Registry-based dispatch for 14 node types, supports sub-scene call stack (call_scene/macro), and hooks into all rendering systems via callbacks. Related triggers: narrative state machine, node graph navigation, scene flow, branching dialogue, call stack, sub-scene."
---

# SceneController

> The heart of the engine. Given a scene's node graph, walks from an entry point through connected nodes by following explicit edges. Uses `Registry.getNodeType(node.type)` to dispatch runtime behavior. Supports a call stack for `call_scene` / `macro` sub-scenes with scoped variables. Every transition is a jump — there is no sequential index advancement.

**Source:** `src/systems/SceneController.js`
**Node registry:** `src/nodes/CoreNodes.js` (calls `Registry.registerNodeType` at import)
**Node type system:** `src/systems/Registry.js`
**Related skills:** `../variable-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(variableSystem, scene)
```

Takes an instance of `VariableSystem` and a Phaser `Scene` reference (for camera/tweens access). Sets up callback slots that `GameScene` wires to the rendering systems.

### Callback Slots

| Property | Called when | Data shape |
|----------|-------------|------------|
| `onDialogue` | Dialogue node fires | `{ speaker, text, expression, position, zIndex, autoAdvance, waitTime }` |
| `onChoice` | Choice / timed_choice node fires | `{ prompt, choices[], duration? }` |
| `onChoiceTimeout` | Timed choice expires | `fn()` |
| `onSceneEnd` | Scene ends | `{ text, nextScene }` |
| `onAction` | Event node fires | `{ type, value, target, volume, setFlag, setValue, toggleFlag, addFlag, delta }` |
| `onSceneStart` | `startScene()` begins | `{ sceneId, background, layers?, music }` |
| `onWait` | Wait node fires | `{ duration }` |
| `onBackgroundChange` | Any node has `background` field | `fn(backgroundKey)` |

## Public Methods

### `startScene(sceneId, [targetNodeId])`
Load a scene from `Data.getScene(sceneId)`, fire `onSceneStart`, jump to `targetNodeId` or `entryNode`. Sets `isRunning = true`.

### `callScene(node)`
Push `{ scene, returnNode }` to `_callStack`, push variable scope via `vars.pushScope(node.args)`, then call `startScene(node.sceneId, node.nodeId)`.

### `processNode(node)`
The core dispatch. Reads `node.type`, applies variable actions via `vars.applyAction(node)`, checks `node.background` for mid-scene background changes, then calls `typeDef.executeRuntime(node, this)` from the Registry.

### `advance()`
Read `currentNode.next` and `jumpToId()`. Clears auto-timer. Missing `next` calls `endScene()`.

### `jumpToId(nodeId)`
Find node by ID in current scene and `processNode()`. Warns and `endScene()` if not found.

### `selectChoice(choiceIndex)`
Applies choice's variable actions, follows `nextScene` / `next` / `advance()`.

### `endScene(node)`
- If `node.nextScene`: clears call stack and scopes, fires `onSceneEnd` with transition
- If `_callStack.length > 0`: pops stack, pops variable scope, restores calling scene via `onSceneStart`, jumps to return node
- Otherwise: `isRunning = false`, fires `onSceneEnd`

### `destroy()`
Clear timers, null references.

## Node Type Runtime Dispatch

Each node type registered in `CoreNodes.js` has an `executeRuntime(node, controller)` method. The controller provides these handler methods:

| Type | Handler in SceneController | Behavior |
|------|---------------------------|----------|
| `dialogue` | `showDialogue(node)` | Fires `onDialogue`. If `autoAdvance`, starts timer; otherwise waits for `advance()` |
| `choice` | `presentChoices(node)` | Filters by condition. Fires `onChoice`. No valid choices → `node.next` |
| `timed_choice` | `presentTimedChoice(node)` | Like choice but with countdown. Expires → `default_next` or `node.next` |
| `random_branch` | `evaluateRandomBranch(node)` | Weighted random pick from `choices[]`. All weight 0 → first branch |
| `condition` | `evaluateCondition(node)` | Evaluates via `vars.evaluate()`. TRUE → `next`, FALSE → `else` |
| `event` | `fireEvent(node)` | Fires `onAction` for side effects. Then follows `node.next` |
| `set_variable` | `setVariableNode(node)` | Applies set/add/toggle on `node.variable`. Then `advance()` |
| `wait` | `doWait(node)` | Fires `onWait`, auto-advances after `duration` ms. Click is ignored during wait |
| `animate` | `animateNode(node)` | Tweens resolved target's property. `wait: true` blocks scene until tween completes |
| `show_object` | `showObjectNode(node)` | Fade resolved target in. `wait: true` blocks |
| `hide_object` | `hideObjectNode(node)` | Fade resolved target out. `wait: true` blocks |
| `camera` | `cameraNode(node)` | Camera FX: shake/flash/fade_in/fade_out/zoom/pan. Supports `wait` |
| `call_scene` | `callScene(node)` | Push stack + scope, start sub-scene |
| `macro` | `callScene(node)` | Same as call_scene but with `args` pushed as variable scope |
| `end` | `endScene(node)` | Terminal. nextScene transitions; otherwise pops call stack |

### Target Resolution (`_resolveTarget(targetId)`)

Used by `animate`, `show_object`, `hide_object` nodes:
1. If `targetId === 'camera'` → `this.scene.cameras.main`
2. Check `LayerSystem.getLayer(targetId)` 
3. Fallback: lookup by `assetName` in LayerSystem layers
4. Check `CharacterSystem.portraits[targetId]`
5. If nothing found → `console.warn` and return `null`

## State Properties

| Property | Type | Description |
|----------|------|-------------|
| `currentScene` | Object | The loaded scene data |
| `currentNode` | Object | The node currently being processed |
| `isRunning` | Boolean | Whether a scene is active |
| `_callStack` | Array | Stack of `{ scene, returnNode }` for sub-scene returns |
| `_autoTimer` | Timer | Auto-advance timer (cleared on manual advance) |
| `_choiceTimer` | Timer | Timed-choice expiry timer |
| `_pendingChoices` | Array | Filtered choices awaiting player input |

## Navigation Architecture

```
startScene(id) → jumpToId(entryNode)
  → processNode(node) via Registry.executeRuntime
    → advance() reads node.next
      → jumpToId(nextId)
        → processNode(node) ...
```

Call stack (sub-scenes):
```
processNode(call_scene) → caller pushed to stack → startScene(subSceneId)
  → ... sub-scene runs ...
  → endScene() pops stack → restores calling scene → jumps to returnNode
```

## Gotchas

- **Call stack `endScene` logic** — `node.nextScene` on an end node takes priority over call stack returns and clears all scopes. Use with caution in sub-scenes.
- **`background: null` is truthy-guarded** — `node.background` is checked with `if (node.background && this.onBackgroundChange)`, so `null` does NOT clear the screen mid-scene. Only a string value triggers a change.
- **Auto-advance timer** (`_autoTimer`) must be cleared in `advance()` so clicking during an auto-advance doesn't double-trigger.
- **Choice filtering** — `presentChoices` filters by condition. If none pass, it follows `node.next` silently (seamless transition).
- **Choice `nextScene`** — when a choice has `nextScene`, `selectChoice` calls `startScene(nextScene)` directly (cross-scene jump, clears stack).
- **Unknown node types** — `Registry.getNodeType` returns undefined → `processNode` warns and calls `advance()`.
- **Missing `next` leads to `endScene()`** — the `advance()` method checks `currentNode.next` and ends if it's falsy. Always set `next` on non-terminal nodes.
- **Variable scope for macros** — `callScene()` calls `vars.pushScope(node.args)`. `endScene()` pops via `vars.popScope()` when returning from a sub-scene. `end.nextScene` clears ALL scopes.
