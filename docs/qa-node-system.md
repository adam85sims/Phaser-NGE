# Node System — Manual QA Test Plan

End-to-end manual tests for **every node type** registered in `src/nodes/CoreNodes.js`. Runs in a real browser against the Phaser engine. Each test is paired with a labelled node in the dedicated test scene — the scene walks you through every node type with clear `[SECTION N]` / `[PASS]` / `[FAIL]` markers.

> **Why a dedicated test scene?** The previous QA checklist referenced `sample`, `test-conditions`, and `test-events` scenes that no longer exist. This test plan builds a self-contained walkthrough that covers the full node surface (14 types), is safe to re-run, and works with the **F4 hotkey** added for it.

---

## Prerequisites

```bash
cd Phaser-NGE
npm install                  # one-time
npm run dev                  # starts Vite on http://localhost:3000
```

Open **`http://localhost:3000/`** in your browser.

### Recommended setup

1. **Open DevTools** (F12) → Console tab. Watch for warnings/errors as you walk the scene.
2. **Open DevTools → Application → Local Storage** to inspect `narrative_saves` if you want to verify save state.
3. **Optional:** DevTools → Network tab. Filter by `media` to see audio/image loads.

### How to run

| Action | How |
|---|---|
| Start the test scene | From the menu, click **Start Game** to enter the start scene, then press **F4** to jump to `node_test`. |
| Re-run from the start | Restart the browser tab, or open `http://localhost:3000/?t=<any>` to bust caches, then F4 again. |
| Re-run a specific section | Use the editor (`/tools/`) → select `node_test` → click any node → click ▶ Play to start from that node. |
| Reset all test variables | Reload the page (the global scope re-initializes from `data/variables.json`). |

> **Note:** `test_score` and `test_flag_bool` are reset only on full page reload (they live in the global scope, which is recreated by `VariableSystem` on `BootScene`). Variables mutated during the scene persist across `call_scene` / `macro` invocations because sub-scene scopes are pushed on top, but the global scope is not reset.

---

## How to interpret results

Each test below includes a **node ID** in the test scene. The node's dialogue will say `[PASS]`, `[FAIL]`, or `[INFO]`. Read the dialogue output to determine the result. For tests that fire visual/audio events, also watch the screen.

Some tests have **statistical** outcomes (random branch). For those, re-run the scene 5–10 times to verify both branches are reachable. The scene loops automatically via the `end.nextScene = "node_test"` tail.

---

## Test Inventory

The full node set, with runtime handlers and where to find them in source:

| Node Type | Runtime Handler | Editor Color |
|---|---|---|
| `dialogue` | `SceneController.showDialogue` | Blue `#3b82f6` |
| `choice` | `SceneController.presentChoices` | Amber `#f59e0b` |
| `timed_choice` | `SceneController.presentTimedChoice` | Orange `#d97706` |
| `random_branch` | `SceneController.evaluateRandomBranch` | Indigo `#6366f1` |
| `condition` | `SceneController.evaluateCondition` | Green `#10b981` |
| `event` | `SceneController.fireEvent` | Violet `#8b5cf6` |
| `set_variable` | `SceneController.setVariableNode` | Emerald `#059669` |
| `wait` | `SceneController.doWait` | Slate `#64748b` |
| `animate` | `SceneController.animateNode` | Sky `#0284c7` |
| `show_object` | `SceneController.showObjectNode` | Teal `#14b8a6` |
| `hide_object` | `SceneController.hideObjectNode` | Gray `#94a3b8` |
| `camera` | `SceneController.cameraNode` | Violet `#8b5cf6` |
| `call_scene` | `SceneController.callScene` | Pink `#ec4899` |
| `macro` | `SceneController.callScene` (with `args`) | Pink `#ec4899` |
| `end` | `SceneController.endScene` | Red `#ef4444` |

---

## 1. Dialogue Node — Basics

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 1.1 | Speaker nameplate appears for `Dave` (a character in `data/characters.json`) | "Dave" nameplate with default character color, **visible** | ☐ |
| 1.2 | Narrator has no nameplate | "narrator" has `invisible: true` → no portrait, no nameplate | ☐ |
| 1.3 | Click/Space during typewriter | Full text appears immediately (no wait) | ☐ |
| 1.4 | Click/Space after typewriter | Advances to `next` node | ☐ |
| 1.5 | Continue indicator (▼) | Blinking arrow appears at bottom-right of text box after typewriter finishes | ☐ |
| 1.6 | Portrait placeholder | Since no portrait asset for `Dave`, a procedural placeholder circle should appear at the `position` (default: `center`) | ☐ |

**Scene node:** `section_dialogue_basic`

---

## 2. Dialogue Node — Inline Tags

Inline tags are parsed by `DialogueSystem` regex `\[(show|hide|anim):([^\]]+)\]` and fire as the typewriter reaches them. They are stripped from the displayed text.

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 2.1 | `[show:asset]` tag matches a layer's `assetName` | The named layer fades in (300ms) when the typewriter reaches the tag | ☐ |
| 2.2 | `[hide:asset]` tag | The named layer fades out when reached | ☐ |
| 2.3 | Tags never visible in text | No `[show:...]` characters appear on screen | ☐ |
| 2.4 | Tag for non-existent layer | No visible effect, no console error (lookup returns `null` silently) | ☐ |
| 2.5 | Skip-to-end during typing | All remaining tags fire immediately, full text shows, no tags leaked | ☐ |

**Scene node:** `section_dialogue_inline_tags`

> **Gotcha:** The `show:...` / `hide:...` tag target must be the layer's `assetName` (the full path as written in `layers[].asset`, e.g. `backgrounds/BG_forest_00001_.png`), **not** the layer's `id`. The editor's "Asset Names" hint in the docs is misleading on this point. Verify by inspecting `LayerSystem.layers[<id>].assetName` in DevTools.

---

## 3. Dialogue Node — `autoAdvance`

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 3.1 | `autoAdvance: true` with `waitTime: 2000` | Dialogue disappears after 2s without user input | ☐ |
| 3.2 | Click during auto-advance countdown | The auto-timer is cleared (no double-advance) — the `advance()` method removes `_autoTimer` before walking the next edge | ☐ |
| 3.3 | `autoAdvance: false` (default) | Waits for player input | ☐ |

**Scene node:** `section_dialogue_autoadvance`

---

## 4. set_variable Node

The `set_variable` node has three operations: `set`, `add`, `toggle`. The variable must be defined in `data/variables.json` to have a default — undefined variables are written into the local (top) scope.

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 4.1 | `operation: "set"` with value | Variable is set to the literal value (type-coerced by `VariableSystem._parseValue`) | ☐ |
| 4.2 | `operation: "add"` with numeric value | Numeric add; non-numeric value coerced via `Number() || 0` | ☐ |
| 4.3 | `operation: "toggle"` | Toggles boolean regardless of `value` (the value field is ignored) | ☐ |
| 4.4 | Missing `variable` field | Node silently no-ops, advances (see `setVariableNode` guard `if (node.variable)`) | ☐ |
| 4.5 | Chained set+add result | `test_score` should be 15 after the chain (10 set, then 5 added) — verified by the `condition` section | ☐ |

**Scene nodes:** `section_set_variable` → `section_set_variable_add` → `section_set_variable_toggle`

---

## 5. condition Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 5.1 | Condition evaluates to TRUE → follows `next` | "PASS" dialogue appears | ☐ |
| 5.2 | Condition evaluates to FALSE → follows `else` | "FAIL" dialogue appears | ☐ |
| 5.3 | Both `next` and `else` are present | Branching works as expected | ☐ |
| 5.4 | Only `next`, no `else` | FALSE result ends the scene (via `endScene()`) | ☐ |
| 5.5 | Empty condition string | Treated as TRUE (see `VariableSystem.evaluate`) | ☐ |
| 5.6 | Compound with AND/OR/parens | `(test_score >= 10 AND test_flag_bool == true) OR chaos_points >= 1000` → TRUE | ☐ |

**Scene nodes:** `section_condition_true`, `section_condition_compound`

### Condition syntax reference

```
courage >= 50 AND has_key == true
courage >= 100 OR is_hero == true
(a == 1 OR b == 1) AND c == 1
```

- **AND** has higher precedence than **OR**
- Parens override precedence
- Values: booleans (`true`/`false`), numbers (`42`, `3.14`), or quoted strings (`"foo"`)
- Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`, `=`

---

## 6. choice Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 6.1 | All choices visible when no `condition` | Path A appears (no condition), Path C hidden (condition false) | ☐ |
| 6.2 | Conditional filtering | A choice whose `condition` evaluates FALSE is filtered out and not shown | ☐ |
| 6.3 | Number-key selection | Press 1, 2, … to select | ☐ |
| 6.4 | Click selection | Click on a choice text | ☐ |
| 6.5 | Hover highlight | Text turns white on hover (DialogueSystem) | ☐ |
| 6.6 | `setFlag`/`setValue` on choice | Applies variable action before navigation (`SceneController.selectChoice` calls `vars.applyAction`) | ☐ |
| 6.7 | `addFlag`/`delta` on choice | Numeric increment | ☐ |
| 6.8 | `toggleFlag` on choice | Boolean flip | ☐ |
| 6.9 | No valid choices → falls to `next` | If all choices are filtered out, `presentChoices` jumps to `node.next` (the `choice_fallback` node in the scene) | ☐ |

**Scene node:** `section_choice`

---

## 7. timed_choice Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 7.1 | Click a choice before timer expires | Selects that choice, jumps to its `next` | ☐ |
| 7.2 | Let the timer expire | Jumps to `default_next` (if set) or `node.next` | ☐ |
| 7.3 | `duration` countdown visible in UI | DialogueSystem renders a visible countdown; if not, at least verify the timing is correct | ☐ |
| 7.4 | `_choiceTimer` cleanup | Calling `selectChoice` clears the pending timer (no leak / double-fire) | ☐ |

**Scene node:** `section_timed_choice`

---

## 8. random_branch Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 8.1 | Weighted selection | Weight 1 vs weight 3 → ~25% / ~75% over many runs | ☐ |
| 8.2 | No `choices` array (empty) | Falls through to `node.next` (the `random_default` node) | ☐ |
| 8.3 | Single branch with weight 1 | Always selects that branch | ☐ |
| 8.4 | All weights 0 (degenerate) | First branch is selected (Math.random() × 0 = 0) — note as a known quirk | ☐ |

**Scene node:** `section_random_branch` (re-run 5–10 times via the auto-loop)

---

## 9. event Node

The `event` node fires a side effect via `SceneController.fireEvent` → `GameScene.onAction` switch. Each eventType has different handling.

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 9.1 | `eventType: "bgm"` with `eventValue: "audio/bgm/..."` | BGM starts (or swaps via crossfade if another track is playing) | ☐ |
| 9.2 | `eventType: "sfx"` | Plays a one-shot SFX (will warn and skip if asset isn't in the audio cache) | ☐ |
| 9.3 | `eventType: "bgm_stop"` | Fades out and stops BGM (800ms) | ☐ |
| 9.4 | `eventType: "bg_change"` | Replaces the single background layer (legacy) with the named asset | ☐ |
| 9.5 | `eventType: "camera_shake"` with `eventValue: "500,0.01"` | Camera shakes for 500ms at intensity 0.01 | ☐ |
| 9.6 | `eventType: "camera_flash"` with `eventValue: "255,255,255"` | White flash overlay | ☐ |
| 9.7 | `eventType: "play_animation"` with `eventTarget` + `eventValue` | AnimationRunner plays the named animation on the target GameObject | ☐ |
| 9.8 | `eventType: "play_animation"` with non-existent target | Console warning, scene continues | ☐ |
| 9.9 | `eventType: "play_animation"` with non-existent animation key | Console warning, scene continues (no crash) | ☐ |
| 9.10 | Missing `eventType` (defaults to `"sfx"`) | Fails silently because no `eventValue` | ☐ |
| 9.11 | Event toast (non-silent types) | Camera/bg_change events show a brief on-screen toast; audio events (bgm/sfx/bgm_stop/play_animation) and `camera_flash` are **silent** (no toast) — see GameScene `_silentEventTypes` | ☐ |

**Scene nodes:** `section_event_bgm` → … → `section_event_bgm_stop`

---

## 10. wait Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 10.1 | Pauses for full `duration` ms | 2000ms delay before advancing | ☐ |
| 10.2 | Dialogue box hidden during wait | `onWait` callback hides the dialogue container | ☐ |
| 10.3 | Click during wait is ignored | The wait timer is the only way to advance (GameScene's `_handleAdvance` calls `advance()` for `wait` nodes — verify click behaviour) | ☐ |

**Scene node:** `section_wait`

---

## 11. animate Node

Tweens a target's property. Targets resolve through `LayerSystem` → `CharacterSystem.portraits` → `camera` (special case).

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 11.1 | `target: "test_layer_bg"`, `property: "x"`, `value: 200` | Layer slides from current X to 200 over 1.5s | ☐ |
| 11.2 | `wait: true` | Scene waits for the tween to complete before advancing | ☐ |
| 11.3 | `wait: false` (default) | Scene advances immediately while the tween continues | ☐ |
| 11.4 | `easing: "Sine.easeInOut"` | Tween uses smooth easing | ☐ |
| 11.5 | `property: "alpha"` | Fades target from current alpha to the value | ☐ |
| 11.6 | `property: "scale"` | Scales target (uniform) | ☐ |
| 11.7 | `property: "zoom"` with `target: "camera"` | Camera zoom (only valid with `target: "camera"`) | ☐ |
| 11.8 | Unknown property (e.g. `tint`) | Tween silently no-ops; `_resolveTarget` returns the target but the `else if` branches don't fire | ☐ |
| 11.9 | Non-existent target | Console warning, scene continues | ☐ |

**Scene nodes:** `section_animate_tween`

> **Tip:** Open DevTools → Sources → add a breakpoint in `SceneController.animateNode` to inspect the resolved target.

---

## 12. show_object / hide_object Nodes

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 12.1 | `show_object` with `duration: 500`, `wait: true` | Target fades in over 500ms, scene waits | ☐ |
| 12.2 | `hide_object` with `duration: 500`, `wait: true` | Target fades out over 500ms, scene waits | ☐ |
| 12.3 | `duration: 0` (default) | Instant show/hide (alpha → 1 or 0) | ☐ |
| 12.4 | `wait: false` | Scene advances while the tween runs | ☐ |
| 12.5 | Target resolution | First looks in `LayerSystem.layers`, then `CharacterSystem.portraits` | ☐ |

**Scene nodes:** `section_show_object`, `section_hide_object`

---

## 13. call_scene Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 13.1 | `sceneId: "node_test_sub"` starts the sub-scene | Enters `node_test_sub` at its `entryNode` | ☐ |
| 13.2 | Sub-scene `end` with no `nextScene` pops the call stack | Returns to the caller's `next` (`section_call_scene_returned`) | ☐ |
| 13.3 | Nested call (sub-scene calls another) | Should work (the call stack supports nesting) | ☐ |
| 13.4 | Missing `sceneId` | Console warning, scene continues | ☐ |
| 13.5 | Missing sub-scene file | Sub-scene is null, `startScene` warns and returns; current scene continues | ☐ |
| 13.6 | Sub-scene with no `next` on its call node | Falls back to `currentNode.next` then `entryNode` (per `endScene` logic) | ☐ |

**Scene node:** `section_call_scene`

> **Visual cue:** You should see the sub-scene's dialogue appear, then control returns.

---

## 14. macro Node

Like `call_scene` but pushes `args` into a new variable scope before entering the sub-scene.

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 14.1 | `args: { greeting: "...", count: 42 }` pushed via `vars.pushScope(args)` | Sub-scene's `condition` check on `greeting`/`count` passes | ☐ |
| 14.2 | Args shadow globals | If `greeting` is also a global, the macro-local value takes precedence while in the sub-scene | ☐ |
| 14.3 | Scope popped on return | `vars.popScope()` is called when the sub-scene ends; calling-scene variables are unchanged | ☐ |
| 14.4 | Args with quoted-string values | Macro args support string values; the sub-scene's condition uses string equality | ☐ |
| 14.5 | No `args` field | Treated as empty `{}` — equivalent to `call_scene` | ☐ |

**Scene node:** `section_macro`

**Sub-scene nodes:** `sub_greeting_check`, `sub_count_check` — both should print `[SUB — PASS]`.

---

## 15. Inline setFlag / setValue on Any Node

Any node can carry `setFlag` + `setValue` (or `toggleFlag` / `addFlag`+`delta`). They are applied by `SceneController.processNode` *before* the node's own behavior runs (via `vars.applyAction(node)`).

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 15.1 | `setFlag` + `setValue` on a `set_variable` node | Both are applied — `set_variable` runs its operation **and** the inline `setFlag` writes | ☐ |
| 15.2 | Order of application | `applyAction` runs first, then the node's handler — so a subsequent `condition` node sees the updated value | ☐ |

**Scene nodes:** `section_set_flag_inline` (writes `test_log`), `section_set_flag_check` (reads it back)

---

## 16. end Node

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 16.1 | `end` with `nextScene: "node_test"` (tail of test scene) | After ~2.5s, the scene transitions to `node_test` from the top (loops the test scene) | ☐ |
| 16.2 | `end` with no `nextScene` and call stack empty (sub-scene's `sub_end`) | Scene ends, `onSceneEnd` fires, returns to caller | ☐ |
| 16.3 | Click on `end` node (terminal) | `GameScene._handleAdvance` calls `this.scene.restart()` for `end` nodes | ☐ |
| 16.4 | `end` with `text` set | "To be continued..." (or `sub_end`'s message) appears briefly | ☐ |
| 16.5 | `end` in sub-scene with `nextScene` set | `nextScene` takes priority over the call stack — clears scopes and transitions | ☐ |

**Scene node:** `section_end_with_next_scene` (main scene tail)

**Sub-scene node:** `sub_end`

---

## 17. Cross-cutting: Variable Scope Behavior

These tests span the scene but verify the `VariableSystem` scoping model end-to-end.

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 17.1 | Global vars survive sub-scene entry/exit | `test_score` is still 15 after returning from `call_scene` (the sub-scene didn't write to it) | ☐ |
| 17.2 | Macro args are read-only from the caller's perspective | Inside the sub-scene, `greeting` is `"Hello from macro!"`; after returning, `greeting` is undefined in the caller's scope | ☐ |
| 17.3 | Global defaults applied on boot | On page reload, `test_score` is 0 and `test_flag_bool` is false (per `data/variables.json`) | ☐ |
| 17.4 | `toggleFlag` on a non-existent variable | Creates it in the local scope as `!undefined` = `true` (no warning) | ☐ |
| 17.5 | `set` on a non-existent variable | Creates it in the local scope with the literal value | ☐ |

---

## 18. Editor / Save Integration

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 18.1 | Open the editor at `/tools/` | Scene list shows `start`, `node_test`, `node_test_sub` | ☐ |
| 18.2 | Open `node_test` in the graph view | All 30+ nodes render with their assigned colors per the table above | ☐ |
| 18.3 | Click any node | Inspector shows its fields; edits mark the project dirty | ☐ |
| 18.4 | Save the project | POSTs to `/api/save`. Verify response: `{ success: true, warnings: [] }` (or with warnings for missing assets) | ☐ |
| 18.5 | Play from a specific node (right-click → "Play from here" or use the play button) | Editor sets `nge_debug_start` in localStorage and opens `/`; `BootScene` reads it and starts `GameScene` at that node | ☐ |
| 18.6 | Auto-save on scene transition | `GameScene.onSceneStart` calls `this.saveSys.autoSave()` → slot 9 of `narrative_saves` is populated | ☐ |
| 18.7 | F9 quick load after auto-save | Reloads the last `onSceneStart` checkpoint | ☐ |

---

## 19. Error Handling & Edge Cases

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 19.1 | Missing `next` field on a non-terminal node | SceneController's `advance()` calls `endScene()` — silent end | ☐ |
| 19.2 | `next` points to a non-existent node | Console warning "Node not found", scene ends gracefully | ☐ |
| 19.3 | `else` points to a non-existent node | Same as above | ☐ |
| 19.4 | Empty `nodes[]` array | `startScene` falls through to `endScene()` immediately | ☐ |
| 19.5 | Unknown `type` field on a node | `Registry.getNodeType` returns undefined → `processNode` warns and calls `advance()` | ☐ |
| 19.6 | `condition` references an undefined variable | `evaluate` returns false (no crash); the FALSE branch is taken | ☐ |
| 19.7 | `set_variable` with a string `value` when the variable is a number | Stored as string in JS — be aware of type coercion in subsequent comparisons | ☐ |
| 19.8 | `macro` with no `args` and the sub-scene expects args | Treated as `{}`; sub-scene's condition checks fail gracefully (`undefined == "expected"` is false) | ☐ |
| 19.9 | Inline `[anim:foo:bar]` where `bar` is not a registered animation | No crash, no visual effect (the `if (animData)` guard) | ☐ |
| 19.10 | Reload page mid-scene | Boot reloads fresh from disk; any in-memory variable changes are lost; auto-save (slot 9) is still in localStorage | ☐ |
| 19.11 | Two F4 presses in quick succession | Both should resolve; the second one starts a new scene run | ☐ |
| 19.12 | Press F4 from a sub-scene (`node_test_sub`) | Switches to `node_test`; any in-progress sub-scene scope is dropped | ☐ |

---

## 20. Performance Sanity

| # | Test | Expected | Pass/Fail |
|---|------|----------|-----------|
| 20.1 | Walk the whole scene once | No noticeable FPS drops, no console warnings | ☐ |
| 20.2 | Auto-loop 5+ times | No memory growth (DevTools → Memory → take heap snapshots) | ☐ |
| 20.3 | Run with DevTools Performance recording | Main thread not blocked on dialogue / tween / scene transitions | ☐ |

---

## Summary Checklist

After completing the walkthrough, you should have:

- [ ] All 14 node types exercised at least once
- [ ] All 9 eventType variants verified (or at least the relevant ones for the assets you have)
- [ ] Variable scoping verified (global vs macro scope)
- [ ] No console errors during the run (warnings about missing audio assets are expected and acceptable)
- [ ] Auto-loop confirmed (end.nextScene re-triggers the scene)

## Filing Bugs

For each failing test, record:

1. **Test #** (e.g. `5.6` or `9.7`)
2. **What happened** vs **expected**
3. **Browser console output** (full stack trace if an error)
4. **Steps to reproduce** (which section, which choice, etc.)
5. **Scene/node ID** (e.g. `data/scenes/node_test.json#section_event_play_animation`)

## Resetting the Test Scene

If `test_score` or `test_flag_bool` get into a weird state:

1. Open DevTools → Console
2. Run: `localStorage.clear(); location.reload()`
3. This clears all save data and reloads from disk

To re-run individual sections without restarting, use the editor:

1. Open `/tools/`
2. Select `node_test` in the outline
3. Right-click the section's first node (e.g. `section_event_bgm`)
4. Click **Play from here** (or use the toolbar play button with a node selected)

This sets `localStorage.nge_debug_start` and opens the game at that exact node.

---

## Related Files

- `data/scenes/node_test.json` — main test scene
- `data/scenes/node_test_sub.json` — sub-scene for `call_scene` / `macro`
- `data/animations/test_anim.json` — sample keyframe animation
- `data/variables.json` — adds `test_score` and `test_flag_bool`
- `data/game.json` — registers scenes + animation
- `src/scenes/GameScene.js` — F4 hotkey binding (line ~236)
- `src/nodes/CoreNodes.js` — node type definitions
- `src/systems/SceneController.js` — runtime dispatch
- `src/systems/Registry.js` — node type registry
- `docs/qa-checklist.md` — broader manual QA plan (cross-scene, save, editor)
