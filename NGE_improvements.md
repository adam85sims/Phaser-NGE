# Phaser-NGE Architectural Improvements
*Lessons learned from modernizing Phaser Editor 2D*

Having thoroughly examined both the `Phaser Editor 2D` (v3) architecture and the `Phaser-NGE` engine, there are several key structural patterns in Editor 2D that could significantly elevate the maintainability, scalability, and performance of NGE.

While Phaser Editor 2D is a complex, generalized IDE and NGE is a specialized narrative engine, adopting scaled-down versions of Editor 2D's paradigms can resolve current bottlenecks in NGE's monolithic `app.js` and pure-runtime interpretation graph.

---

## 1. Scene Handling: CodeDOM Generation vs. Runtime Interpretation

**The Current NGE Approach:**
NGE scenes are JSON graphs interpreted entirely at runtime by `SceneController.js`. The engine loops through `nodes`, looking up the next node by ID. This is extremely flexible but pushes all validation, type-checking, and branching logic to the moment the player clicks "Next".

**The Phaser Editor 2D Approach:**
Editor 2D uses a visual scene builder but crucially implements a **CodeDOM (Code Document Object Model)**. When a `.scene` file is saved, `JavaScriptUnitCodeGenerator` physically writes a native `Phaser.Scene` class. The runtime engine runs pure JavaScript, not a JSON interpreter.

**Improvement for NGE: "Pre-compiled" Narratives**
While full code generation might be overkill for a visual novel, NGE would benefit from a "compilation/validation" step in the editor rather than raw JSON interpretation:
1. **Validation Hook:** Add an export hook to `editor-backend.js` that traverses the graph, checking for orphaned nodes, missing `next` links on non-terminal nodes, and validating asset keys against the `public/assets` directory.
2. **Flattening:** Instead of searching `nodes.find(n => n.id === nextId)` at runtime (which is O(N) per step), the editor could "compile" the JSON so that nodes use fast-indexed arrays or direct references, speeding up long scenes.

---

## 2. Functions & Reusability: Prefabs vs. Call Stacks

**The Current NGE Approach:**
Reusability is achieved via `call_scene` nodes, which push the current state to a `_callStack` in `SceneController.js`. While this allows for branching out to modular dialogue, it lacks parameterization (passing specific arguments into the sub-scene) and makes scoping difficult (variables mutated in a sub-scene remain globally mutated).

**The Phaser Editor 2D Approach:**
Editor 2D utilizes **Prefabs** and **ScriptNodes**. Prefabs are discrete, reusable objects with exposed "User Properties". When a Prefab is instantiated, it can be customized without altering the base definition. 

**Improvement for NGE: Narrative Macros & Scoping**
1. **Narrative Prefabs (Macros):** Allow writers to create reusable "Node Clusters" in the editor (e.g., a "merchant shop" loop). Instead of treating it as a global `call_scene`, treat it as an instantiable Macro node where the user can map input properties (e.g., passing "Sword" as `ItemA` into the Macro).
2. **Local Variable Scoping:** Update `VariableSystem.js` to support local scopes. When `call_scene` fires, push a new variable context to the stack. This prevents a modular "combat" scene from accidentally clobbering the main storyline's variables.

---

## 3. UI and Editor Architecture: Plugins vs. Monolith

**The Current NGE Approach:**
The NGE Editor is built as a single SPA. `tools/app.js` (at over 1000 lines) handles everything from booting the workspace to rendering the HTML DOM for the outliner, managing drag-and-drop, and intercepting Gizmo interactions on the canvas. 

**The Phaser Editor 2D Approach:**
Editor 2D is built on `colibri`, a robust Eclipse-style framework. *Everything* is a plugin. If the editor needs an animation view, it creates `phasereditor2d.animations` which hooks into `ExtensionRegistry` to provide an `EditorFactory` and menu commands. The core system doesn't know about animations.

**Improvement for NGE: Lightweight Extension Registry**
The NGE Editor is nearing the point where adding new node types (like minigames, QTEs, or advanced RPG mechanics) will make `app.js` unmanageable.
1. **Decouple the Graph:** Extract the visual rendering of nodes out of `app.js` and into a modular `GraphRenderer` class. 
2. **Node Type Plugins:** Implement a lightweight `Registry.js`. When defining a new node type (e.g., `timed_choice`), it should register itself:
   ```javascript
   Registry.registerNodeType('timed_choice', {
       renderEditor: (node) => { /* Draw HTML form for inspector */ },
       drawCanvas: (node, ctx) => { /* Draw visual graph node */ },
       executeRuntime: (node, controller) => { /* Runtime behavior */ }
   });
   ```
   This immediately strips hundreds of lines of `switch/case` statements out of `app.js`, `inspector.js`, and `SceneController.js`.

---

## 4. Visual Hierarchy vs. Flat Node Arrays

**The Current NGE Approach:**
In `app.js`, layers and characters are rendered as flat DOM overlays (`scene-layer-wrapper`). While they have `zIndex`, they cannot be grouped or parented.

**The Phaser Editor 2D Approach:**
True scene graphs. Containers can hold Sprites, which can hold text. Moving the container moves the children.

**Improvement for NGE: Visual Grouping**
As narrative scenes become more complex (e.g., a crowd of 5 characters, or a complex multi-layered background), NGE needs grouping. 
Update `LayerSystem.js` and the editor's outline to support `Containers`. This allows the `SceneController` to run an `animate` node on a "Crowd" container, fading all 5 characters simultaneously, rather than requiring 5 separate `hide_object` nodes in the JSON graph.


## Overall improvements ##
There are currently some issues in regard to what we're looking at in the scene view and what we get in the actual game. We need to make sure that the Outline properly reflects what the user is going to see when they press the play button to preview the game.

Drag and drop assets into the engine. We can't do it yet. When the user tries to drag and drop an asset into the file browser, the user should be able to sort the object into its respective folder - audio and image - no matter what the object is named.

File explorer - we have a script editor, so lets let the users create scripts. We need a context menu - allow the user to create new folders and scripts

Inspector - Layer ID doesn't mean a thing to the user. The object name / asset key should be fine by its self.
If the user wants to use a script on an object, we should let them drag the script onto the object through the inspector (like Unity).

We need to improve the scene-toolbar - add visual wigits to move on the x and y axis. Changes also currently don't take place until the mouse button is lifted - making resizing difficult.
