---
name: scene-controller
description: "Graph-based narrative state machine — walks a scene's node graph by following explicit 'next' connections. No sequential advancement. Handles 6 node types (dialogue, choice, condition, event, wait, end) and routes them to callback functions wired by GameScene. Related triggers: narrative state machine, node graph navigation, scene flow, branching dialogue, sequence branching."
---

# SceneController

> The heart of the engine. Given a scene's node graph, walks from an entry point through connected nodes by following explicit edges (`next`, `else`, `choices[].next`). Every transition is a jump — there is no sequential index advancement.

**Source:** `src/systems/SceneController.js`
**Related skills:** `../variable-system/SKILL.md`, `../game-scene/SKILL.md`

## Constructor

```js
constructor(variableSystem)
```

Takes an instance of `VariableSystem` for condition evaluation and variable actions. Sets up callback slots that GameScene wires to the rendering systems.

### Callback Slots

| Property | Called when | Data shape |
|----------|-------------|------------|
| `onDialogue` | Dialogue node fires | `{ speaker, text, expression, autoAdvance, waitTime }` |
| `onChoice` | Choice node fires | `{ prompt, choices[] }` |
| `onSceneEnd` | Scene ends | `{ text, nextScene }` |
| `onAction` | Event node fires | `{ type, value, setFlag, setValue }` |
| `onSceneStart` | `startScene()` begins | `{ sceneId, background, music }` |
| `onWait` | Wait node fires | `{ duration }` |

## Public Methods

### `startScene(sceneId)`
Load a scene from `Data.getScene(sceneId)`, fire `onSceneStart`, and jump to the entry node. Sets `isRunning = true`.

### `processNode(node)`
The core dispatch. Reads `node.type` and routes to the appropriate handler. Applies variable actions first.

### `advance()`
Read `currentNode.next` and jump, or end the scene. Clears any pending auto-timer.

### `jumpToId(nodeId)`
Find a node by ID in the current scene and process it. If not found, ends the scene.

### `selectChoice(choiceIndex)`
Called when the player picks a choice. Applies the choice's variable actions, then follows `nextScene`, `next`, or `advance()`.

### `destroy()`
Clear timers, null references. Called on scene shutdown.

## Node Type Dispatch

| Type | Handler | Behavior |
|------|---------|----------|
| `dialogue` | `showDialogue()` | Fires `onDialogue` callback. If `autoAdvance`, starts a timer; otherwise waits for `advance()` call. |
| `choice` | `presentChoices()` | Filters choices by condition. If none pass, follows `node.next`. Otherwise fires `onChoice` with available choices. |
| `condition` | `evaluateCondition()` | Evaluates condition string via VariableSystem. Follows `next` (true) or `else` (false). |
| `event` | `fireEvent()` | Fires `onAction` callback for side effects (SFX, BGM, camera effects). |
| `wait` | `doWait()` | Fires `onWait`, then auto-advances after `duration` ms. |
| `end` | `endScene()` | Fires `onSceneEnd` with optional text and nextScene. Sets `isRunning = false`. |

## State Properties

| Property | Type | Description |
|----------|------|-------------|
| `currentScene` | Object | The loaded scene data |
| `currentNode` | Object | The node currently being processed |
| `isRunning` | Boolean | Whether a scene is active |
| `awaitingInput` | Boolean (getter) | True if current node is `dialogue` or `choice` |
| `isAtChoice` | Boolean (getter) | True if current node is `choice` and choices are pending |

## Navigation Architecture

```
startScene(id) → jumpToId(entryNode)
  → processNode(node)
    → advance() reads node.next
      → jumpToId(nextId)
        → processNode(node) ...
```

Every step is an explicit jump. The engine never assumes "next node in array." This keeps the data format compatible with visual editors that rearrange nodes arbitrarily.

## Gotchas

- **Always null-check** `currentScene` and `currentScene.nodes` before `jumpToId` — a missing scene or empty node list ends gracefully.
- **Auto-advance timer** (`_autoTimer`) must be cleared in `advance()` so clicking during an auto-advance doesn't double-trigger.
- **Choice filtering** — `presentChoices` filters by condition. If no choices pass, it follows `node.next` silently. The writer sees a seamless transition.
- **Choice `nextScene`** — when a choice has `nextScene` set, `selectChoice` calls `startScene(nextScene)` directly, creating a cross-scene jump.
