# Module: Inspector

**ID:** `inspector`
**File:** `tools/inspector.js`
**Lifecycle:** Singleton
**Panel:** Right sidebar (`#inspector`)

---

## Purpose

Context-sensitive property editor. Renders the right sidebar form based on the current selection. Handles both node editing (dialogue text, speaker, choices, conditions) and layer editing (transform, opacity, z-index, asset key).

---

## Contributions

```js
export const contributions = {
  panels: [
    { id: 'inspector', label: 'Inspector', area: 'sidebar' }
  ],
  publishes: ['selection:changed', 'scene:node-changed', 'scene:layer-changed', 'inspector:refresh'],
  subscribes: ['selection:changed']
};
```

---

## Selection → Inspector Mapping

| `selection.type` | What renders |
|---|---|
| `null` | "Select an item" placeholder |
| `'node'` | Node property form |
| `'layer'` | Layer property form |
| `'scene'` | Scene metadata form |
| `'character'` | Character editing (delegate to character-manager) |
| `'variable'` | Variable editing (delegate to variable-editor) |

---

## Node Inspector (selection.type === 'node')

### Sections

**1. Transform**
- X, Y (number inputs) — graph canvas position

**2. Identity**
- Type: dropdown (read-only for existing node, changeable on add)
- ID: text input (node identifier, used for graph navigation)
- Speaker: dropdown from `editorState.characters` keys
- Expression: text/autocomplete (matches character's expressions)
- Z-Index (number) — canvas z-order for this node's background layer

**3. Content** (type-dependent)

| Node Type | Content Fields |
|-----------|----------------|
| `dialogue` | Text (textarea), Auto-Advance (checkbox), Wait Time (number ms), Position (select: left/center/right) |
| `choice` | Prompt (textarea), Choices[] (list with add/remove/reorder — each: Text, Next, Condition, setFlag, setValue) |
| `condition` | Condition (text input, expression like `courage >= 50 AND has_key == true`), Next (true branch), Else (false branch) |
| `event` | Event Type (select: sfx/bgm/bg_change/camera_shake/camera_flash), Event Value (depends on type — audio key picker for sfx/bgm, duration/intensity for camera_shake, r,g,b for camera_flash) |
| `call_scene` | Scene ID (dropdown from scene list), Node ID (dropdown of target scene's nodes), Next (return node) |
| `wait` | Duration (number ms), Next |
| `end` | Text (optional ending text), Next Scene (optional scene transition) |
| `show_object` | Target (text — asset key), Wait (checkbox), Next |
| `hide_object` | Target (text), Next |
| `animate` | Target, Animation, Duration, Next |
| `camera` | Event Type, Event Value, Next |
| `set_variable` | Variable (dropdown from variableDefs), Operation (set/increment/toggle), Value |
| `timed_choice` | Prompt, Choices[], Duration, Timeout Next |
| `random_branch` | Prompt, Choices[] |

**4. Actions** (all node types)
- Set Flag (text)
- Set Value (number)
- Toggle Flag (checkbox)
- Add Flag (text)
- Delta (number)
- Background (asset key, optional)

**5. Connections**
- Next: dropdown of all nodes in current scene (with "(end)" for blank)
- Choices sub-list: each choice has its own "Next" field

**6. Node Controls**
- Duplicate Node
- Delete Node

### Editing Behavior

All text inputs use `oninput` (live capture, not `onchange`) to avoid data loss on rapid node switching. Number inputs update on both `input` (live preview) and `change` (blur commit).

---

## Layer Inspector (selection.type === 'layer')

### Sections

**1. Layer Identity**
- Layer ID (text input, show-only by default)
- Type (select: Background / Character / Prop)
- Asset Key (text input — updates preview URL)

**2. Transform**
- X, Y (number)
- Scale (number, step 0.1, range 0.1–5)
- Z-Index (number)

**3. Appearance**
- Opacity (range slider 0–1, step 0.05, with percentage display)

**4. Actions**
- Remove Layer (danger button — confirms then calls `scene-composer.removeLayer()`)

### Live Preview

All transform fields bind BOTH `input` and `change` events:
- `input`: live preview update as user types
- `change`: persistence on blur/Enter

Opacity slider uses `input` for live visual feedback.

---

## API

```js
/**
 * Render the inspector into the given container.
 * Inspects current selection and renders the appropriate form.
 */
renderInspectorContent(container: HTMLElement): void
```

---

## Data Binding

Node fields use `data-field` attributes for generic binding:

```html
<input type="number" value="${node.x ?? 0}" data-field="x" data-type="number" />
<input value="${node.speaker || ''}" data-field="speaker" />
<textarea data-field="text">${node.text}</textarea>
```

Layer fields use `data-field` + `data-layer="true"`:

```html
<input type="number" value="${layer.zIndex ?? 0}" data-field="zIndex" data-type="number" data-layer="true" />
```

The handler reads `el.dataset.field`, writes to the appropriate object (`node[field] = val` or `layer[field] = val`), then dispatches the appropriate event.

---

## Event-Driven Updates

- `selection:changed` → re-render the entire inspector form
- `inspector:refresh` → partial re-render (used when event type changes and the value field needs to swap)
- `scene:node-changed` → update displayed values without full re-render (for external edits like z-order reordering from graph)
