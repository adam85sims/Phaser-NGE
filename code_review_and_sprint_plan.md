# Phaser NGE: Code Review & Sprint Plan

## Executive Summary

The Phaser-NGE project demonstrates a very strong architectural foundation for a data-driven visual novel engine. The implementation heavily favors explicit state and separation of concerns, which is excellent. Systems are well modularized (`SceneController`, `DialogueSystem`, `CharacterSystem`, `VariableSystem`, `SaveSystem`), and the data-driven design using JSON scene files is robust.

However, there are a few critical architectural bugs remaining from previous iterations (such as dead `nodeIndex` state in the save system) and some Phaser-specific implementation details that need to be addressed before scaling the feature set.

## Code Review & Architectural Findings

### 🔴 Critical Issues (All Fixed)

1. ~~**Save/Load System Reverts Progress to Scene Start**~~ ✅ **FIXED**
   * `SaveSystem.js` now persists `nodeId` (not `nodeIndex`), and `load()` returns `{ sceneId, nodeId }` for direct graph jumps. Verified — 0 references to `nodeIndex` remain in `src/`.

2. ~~**Native Timeout Desyncs (`SceneController.js`)**~~ ✅ **FIXED**
   * No `setTimeout`/`clearTimeout` calls remain in `SceneController.js` — timing is handled through Phaser's tween system and scene lifecycle. Verified — 0 `setTimeout` references in `src/`.

### 🟡 Technical Debt & Refactoring

1. **Hardcoded UI/Layouts (`DialogueSystem.js`)**
   * **Issue:** The `this.box` layout config inside `DialogueSystem.js` is currently hardcoded. There are developer comments mentioning a future layout tool, but at present, changing the dialogue box size requires altering the source code.
   * **Improvement:** Externalize these magic layout numbers into a configurable `theme.json` loaded at runtime.

2. **Repetitive UI Cleanup (`GameScene.js`)**
   * **Issue:** In multiple places (e.g., transitioning scenes, returning to menu, F-keys, `onSceneEnd`), the same teardown code is duplicated (`this.dialogue.setVisible(false); this.characters.hideAll(); this._pendingEndText.destroy();`, etc.).
   * **Improvement:** Extract this into a unified private `_cleanupUI()` method.

3. **Background Image Caching (`GameScene.js`)**
   * **Issue:** When a node triggers an `onBackgroundChange`, the engine uses `this.textures.exists(texKey)` and falls back to a procedural gradient if the texture isn't found. This assumes the texture was loaded by `BootScene`. As scenes grow larger, loading all backgrounds in `BootScene` will slow down initial boot time.
   * **Improvement:** Introduce dynamic mid-scene loading for background textures to optimize memory usage and loading times.

---

## Proposed Sprint Plan

Based on the code review and the `deferred-todo.md` features, here is a structured 2-sprint plan:

### Sprint 1: Stabilization & Core Improvements

**Goal: Fix existing tech debt, repair broken saves, and solidify the engine's core flow.**

* **Task 1:** Fix the `SaveSystem` bug so that saves correctly track `nodeId` and load players exactly where they left off mid-scene.
* **Task 2:** Refactor `SceneController.js` to use Phaser's `time.delayedCall` rather than native JS timeouts to eliminate background-tab desync issues.
* **Task 3:** Refactor `GameScene.js` to centralize UI teardown methods and reduce code duplication.
* **Task 4:** Create a `theme.json` configuration handler in `DataLoader` to allow external styling/positioning of the DialogueSystem (text speed, padding, text box size, text colors).
* **Task 5 (Editor):** Implement "Node comments" so writers can leave notes on complex graph nodes inside the dialogue editor.

### Sprint 2: Polish & Advanced Narrative Mechanics

**Goal: Deliver features that significantly enhance the UX and capabilities of the engine.**

* **Task 1 (Audio Polish):** Enhance `AudioSystem.js` to support crossfading, fade-in, and fade-out for background music instead of abrupt stops. 
* **Task 2 (Advanced Logic):** Implement Variable Delta (e.g., `addFlag`, `delta` in `choices`) and Compound Variable updates so writers can dynamically increment numbers (e.g., `courage + 5`) instead of just hard-setting them.
* **Task 3 (Complex Flow):** Add a **Jump / Call Scene node** type. This will allow the game to branch entirely out to a sub-scene (like a "shop" menu or an "investigation" sequence) and then jump back into the middle of the current scene's graph.
* **Task 4 (Editor UX):** Add a "Scene Preview" feature inside the Dialogue editor that lets the developer instantly boot the game inside an iframe dynamically loaded with the current draft graph data.

---
| *Let me know if you agree with this assessment, or if you'd prefer to adjust priorities. We can immediately knock out the critical Save System and Timeouts bugs if you are ready!*

---

## ✅ Completed Since This Plan Was Written

| Feature | Sprint | Status |
|---------|--------|--------|
| Save/Load uses `nodeId` (not `nodeIndex`) | Sprint 1 | ✅ |
| SceneController uses Phaser tweens (not `setTimeout`) | Sprint 1 | ✅ |
| Voice Acting (quick fade, settings, audio channel) | Sprint 2 | ✅ |
| CG Gallery (auto-compilation, global persistence, grid) | Sprint 2 | ✅ |
| Event volume control (`eventVolume` on event nodes) | Sprint 2 | ✅ |
| `eventType`-aware inspector (asset dropdown, context fields) | Sprint 1 | ✅ |
| Runtime audio fallback (`_loadAndPlay` probe) | Sprint 1 | ✅ |
| Variable delta (`addFlag`/`delta` on choices) | Sprint 2 | ✅ |
| `call_scene`/`macro` nodes with scoped args | Sprint 1 | ✅ |
