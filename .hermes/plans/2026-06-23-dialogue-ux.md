# Phaser-NGE Phase 2: Dialogue UX Overhaul

> **Goal:** Make writing dialogue the fastest, most friction-free action in the editor.

---

## The Problem

Current flow to write a single dialogue line:
1. Right-click canvas → search "Dialogue" → click to create
2. Move mouse to inspector panel (right side)
3. SCROLL DOWN past: Transform, Node ID, Type, Comment, Speaker, Expression, Position, Background, Z-Index, Voice
4. Finally reach the Text textarea at the BOTTOM
5. Click → type → click back to canvas → repeat

For a 50-line scene, that's 50× unnecessary travel. Writers will hate this.

---

## The Solution: 4 Changes

### Change 1: Reorder Dialogue Inspector — Text First

**File:** `tools/nodes/EditorNodes.js` (line 22-45)

Move the Text field to the TOP of the dialogue inspector, before Speaker. The field order should be:

```
Text (textarea, auto-growing)
Speaker (dropdown)
Expression (dropdown)
Position (dropdown)
Background (dropdown + thumbnail)
Z-Index
Voice
Auto/Wait
Next
```

This puts the most-used field first. The `renderEditor` function on line 22 needs reordering.

### Change 2: Auto-Focus Text on Node Creation

**File:** `tools/graph.js` (line 128-168, `createNode` function)

After creating a dialogue node and dispatching `editor:render`, wait for the inspector DOM to update, then focus the text textarea and select its content. This way the writer can immediately start typing.

Implementation: After `window.dispatchEvent(new CustomEvent('editor:render'))` on line 165, add a small `setTimeout` (50ms) to let the inspector render, then query `document.querySelector('[data-field="text"]')` and call `.focus()` + `.select()` on it.

### Change 3: Keyboard Shortcut for Dialogue Node

**File:** `tools/graph.js` (line 102-123, keydown handler)

Add a 'D' key shortcut that creates a dialogue node at the current canvas center (similar to how Cmd+Space opens the search palette). This is the #1 node type in a narrative engine — it should be instant.

In the `keydown` handler, add:
```javascript
if (e.key === 'd' || e.key === 'D') {
  if (inInput) return; // Don't trigger while typing in inspector
  if (canvas && canvas.offsetParent !== null) {
    createNode('dialogue');
  }
}
```

### Change 4: Inline Text Preview on Node (already exists, enhance)

**File:** `tools/graph.js` (line 501-508)

The node already shows a 22-char snippet. Enhance it:
- Show more text (40 chars) when zoomed in
- Add a visual "empty" state when text is empty ("Click to add dialogue...")
- Consider showing the speaker name on the node if set

---

## Implementation Order

### Task 1: Reorder dialogue inspector fields
- Edit `tools/nodes/EditorNodes.js` `renderEditor` for dialogue type
- Move Text textarea to position 0 (before Speaker)
- Verify in browser that text field appears first

### Task 2: Auto-focus text on creation
- Edit `tools/graph.js` `createNode` function
- After node creation + render dispatch, setTimeout 50ms → focus text field
- Test: create dialogue node → text field should be focused and text selected

### Task 3: Add D shortcut for dialogue creation
- Edit `tools/graph.js` keydown handler
- Add 'D' key binding to create dialogue node
- Test: press D in graph → dialogue node appears, text field focused

### Task 4: Enhanced node text preview
- Edit `tools/graph.js` `renderCanvas` snippet section
- Show "Empty dialogue..." when text is empty
- Show speaker name if set
- Adjust snippet length based on zoom level

---

## Files Changed

| File | Change |
|------|--------|
| `tools/nodes/EditorNodes.js` | Reorder dialogue `renderEditor` fields |
| `tools/graph.js` | Auto-focus on create, D shortcut, enhanced preview |

---

## Verification

1. `npm run dev` → open `/tools/`
2. Create dialogue node via context menu → text field should be focused
3. Press D in graph → dialogue node appears
4. Type text → node shows updated snippet
5. Text field should be first in inspector, not buried at bottom
6. All existing editor functionality still works

---

## Why Not a Floating Inline Editor?

A double-click-to-edit on the canvas node itself would be ideal, but:
- The graph is a `<canvas>` element — no native DOM inputs
- Adding a floating textarea on double-click is possible but complex (positioning, zoom tracking, blur handling)
- The auto-focus + reorder approach gives 80% of the benefit with 20% of the effort
- Could be added as a future enhancement (Task 5 in a later phase)
