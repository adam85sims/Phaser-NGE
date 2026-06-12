# Module: Node Graph

**ID:** `node-graph`
**File:** `tools/graph.js`
**Lifecycle:** Singleton
**Panel:** Workspace → Dialogue tab (bottom workspace)

---

## Purpose

The node graph is the visual narrative flow editor. It renders a Canvas 2D scene graph showing dialogue nodes, choices, conditions, and events, with draggable connections between them.

---

## Contributions

```js
export const contributions = {
  panels: [
    { id: 'graph-canvas', label: 'Graph', area: 'workspace' }
  ],
  commands: [
    { id: 'graph.addNode', label: 'Add Node', shortcut: 'Shift+A' },
    { id: 'graph.deleteSelection', label: 'Delete Selected', shortcut: 'Delete' },
    { id: 'graph.fitView', label: 'Fit All', shortcut: 'F' },
  ],
  publishes: ['selection:changed', 'scene:node-changed', 'project:modified'],
  subscribes: ['scene:changed', 'scene:node-changed']
};
```

---

## Scoped State

```js
editorState.modules['node-graph'] = {
  camera: { x: -300, y: 0 },
  zoom: 1,
  panning: false,
  panStart: { x: 0, y: 0 },
  dragging: null,       // { nodeId, startX, startY, mouseX, mouseY } | null
  connectionDraft: null, // { fromNodeId, fromPort, mouseX, mouseY } | null
  contextMenu: null,     // { x, y, nodeId? } | null
};
```

---

## Render Model

The graph renders on a raw HTML5 Canvas (2D context). It is not a DOM-based scene.

### Node Visuals

Each node is a rounded rectangle with:

```
┌───────────────────────┐
│ ○ (output port)       │
│  ┌─────────────────┐  │
│  │ Dialogue         │  │  ← type badge
│  │ "Hello world"    │  │  ← truncated text
│  │                  │  │
│  └─────────────────┘  │
│ ● (choice ports)      │
└───────────────────────┘
```

Dimensions: `NODE_W=200`, `NODE_H=64` minimum (grows with choices)

### Node Colors by Type

| Type | Color |
|------|-------|
| `dialogue` | `#3b82f6` (blue) |
| `choice` | `#f59e0b` (amber) |
| `condition` | `#10b981` (green) |
| `event` | `#8b5cf6` (purple) |
| `call_scene` | `#ec4899` (pink) |
| `wait` | `#64748b` (slate) |
| `end` | `#ef4444` (red) |
| `show_object` | `#14b8a6` (teal) |
| `hide_object` | `#94a3b8` (gray) |
| `animate` | `#0284c7` (sky) |
| `camera` | `#8b5cf6` (purple) |
| `set_variable` | `#059669` (emerald) |
| `timed_choice` | `#d97706` (orange) |
| `random_branch` | `#6366f1` (indigo) |

### Ports

- **Output port** (bottom center, `○`): connects to `node.next`
- **Choice ports** (right side, `●`): one per choice, connects to `choice.next`
- **Condition ports**: "True" (right) and "False" (left) for condition nodes

### Wires

Bezier curves between output and input ports. Rendered as `<path>` or canvas quadratic curves with arrow heads.

---

## API

```js
/**
 * Mount the canvas into a container element.
 * Sets up ResizeObserver, event listeners, and render loop.
 */
mountGraph(container: HTMLElement): void

/**
 * Create a new node of the given type at (x, y).
 * Adds to current scene's nodes array and re-renders.
 */
createNode(type: string, x?: number, y?: number): Node

/**
 * Delete the currently selected node.
 */
deleteSelectedNode(): void

/**
 * Select a node by ID (from outline/graph click).
 * Dispatches selection:changed.
 */
selectNode(nodeId: string): void

/**
 * Reset camera to show all nodes.
 */
fitView(): void

/**
 * Render the full graph (called on each frame change).
 */
render(): void
```

---

## Interactions

| User Action | System Behavior |
|-------------|----------------|
| Click empty space | Deselect, focus away |
| Click node | Select node, dispatch `selection:changed` |
| Drag node | Update node x/y in scene data, re-render |
| Drag from output port | Create connection draft (bezier wire) |
| Release on input port | Set `node.next = targetNode.id` |
| Scroll wheel | Zoom (centered on cursor) |
| Middle mouse / Space+drag | Pan camera |
| Click context menu item | Execute command |
| Delete key | Delete selected node |

---

## Context Menu

Right-click on canvas or a node shows a context menu:

**On empty space:**
- Add Dialogue
- Add Choice
- Add Condition
- Add Event
- Add Call Scene
- Add Wait
- Add End
- (separator)
- Fit View (F)

**On a node:**
- Edit Properties
- Duplicate
- Delete
- Play from Here

The menu is a custom DOM overlay (not native): positioned at click coordinates, closed by clicking elsewhere.

---

## Graph Search

A mini search bar (Ctrl+F / Shift+F) filters the node list in a dropdown overlay. Typing filters by node ID. Selecting a node centers the camera on it and selects it.

---

## Full-Screen Mode

The graph canvas can be expanded to fill the entire editor (hiding sidebars and workspace tabs). The fullscreen button toggles this state — applying a CSS class that hides outline, inspector, and workspace tabs while making the graph container fill the viewport.
