# Dialogue Editor Tool — Implementation Plan

> **For Hermes:** This is a planning-only document. Do not implement.
> Use subagent-driven-development skill to dispatch implementation.

**Goal:** Build a standalone dialogue editor tool that lets the user visually create and edit narrative scene files (`data/scenes/*.json`) without touching code.

**Architecture:** The tool is a self-contained HTML/JS page (no Phaser, no build step) served from the same Vite dev server as the game. It reads scene data from the `data/` directory via `fetch()` (same-origin), displays it as a node-based editor, and exports edited JSON as a downloadable file.

**Tech Stack:** Plain HTML + CSS + JavaScript (zero dependencies for the tool itself). Uses Canvas or DOM for the node graph, localStorage for session persistence, and the File System Access API (with download-blob fallback) for saving.

---

## 1. How the User Loads the Tool

**Key decision: same dev server, different URL path.**

The user runs `npm run dev` (single command). Two entry points exist:

| Mode | URL | What loads |
|------|-----|------------|
| Game | `http://localhost:3000/` | `index.html` → Phaser engine → BootScene → GameScene |
| Editor | `http://localhost:3000/tools/dialogue-editor/` | `tools/dialogue-editor/index.html` → dialogue editor UI |

**How this works technically:**
- Vite serves the root `index.html` at `/`
- The tool lives at `tools/dialogue-editor/index.html` — a completely separate HTML page
- Vite's dev server, by default, serves files from the project root. But it only treats root `index.html` as a special entry point. For subdirectory HTML files, we add a Vite middleware or use a simple workaround.
- **Approach:** The tool's HTML page loads as a static asset. We use Vite's `server.fs.allow` config to ensure the tools directory is served, and the tool uses `<script>` tags (not ES modules) to avoid Vite's module transform on standalone pages.

Actually, the cleanest approach:

**Recommended approach: "Vite multi-page app" mode.**

Add one line to `vite.config.js`:
```js
export default defineConfig({
  // ...
  build: {
    rollupOptions: {
      input: {
        main: '/index.html',
        editor: '/tools/dialogue-editor/index.html'
      }
    }
  }
});
```

But this only affects `vite build`, not `vite dev`. For dev, Vite serves static files from the project root. So `http://localhost:3000/tools/dialogue-editor/index.html` works out of the box if the file exists — Vite's dev server serves any file under the project root as a static asset.

**Verdict: Zero config needed. The tool loads at `/tools/dialogue-editor/` on the same dev server. One command (`npm run dev`), both experiences available.**

**The user workflow:**
1. `cd narrative-engine && npm run dev`
2. To write dialogue: open `http://localhost:3000/tools/dialogue-editor/` in a browser tab
3. To test the game: open `http://localhost:3000/` in another tab
4. Edit dialogue → export JSON → refresh game tab to see changes

---

## 2. Dialogue Editor — UI Layout

The editor is a single HTML page with three panels:

```
┌──────────────────────────────────────────────────────┐
│  [Scene: sample]  [+ Add Node]  [Save] [Export JSON] │  ← Toolbar
├──────────────────────────┬───────────────────────────┤
│                          │                           │
│    Node List             │    Node Editor             │
│    ──────────            │    ──────────              │
│                          │                           │
│    [start] ● dialogue    │    Type: [dialogue ▼]     │
│    [intro_hero] ● dial.  │    ID:  [start            │
│    [meet_stranger] ●     │    Speaker: [narrator ▼]  │
│    [stranger_speaks] ●   │    Expression: [neutral]  │
│    [choice_point] ●      │                           │
│      ├ "Who are you?"    │    ┌──────────────────┐   │
│      ├ "No time"         │    │ "A calm evening  │   │
│      └ "Reach weapon"    │    │  settles over... │   │
│    [who_are_you] ●       │    └──────────────────┘   │
│    [no_time] ●           │                           │
│    [reach_weapon] ●      │    Next: [               │
│    [choice_trust] ●      │                           │
│    ...                   │    [Delete Node]          │
│                          │                           │
├──────────────────────────┴───────────────────────────┤
│  [Preview Panel ▼]  "A calm evening settles over..."  │  ← Preview
└──────────────────────────────────────────────────────┘
```

### Panel 1: Node List (left sidebar)
- Scrollable list of all nodes in the current scene
- Each node shows its ID, type icon (💬 dialogue, ❓ choice, ⚡ action, 🏁 end)
- Choice nodes show their choices indented below
- Click a node to select and edit it — the Node Editor panel updates
- Nodes are color-coded by type
- Drag to reorder nodes (changes sequential flow)
- Right-click context menu: duplicate, delete, insert before/after

### Panel 2: Node Editor (center)
- Form that changes based on the selected node's type
- Common fields: Node ID (auto-generated, editable), type selector
- **Dialogue type:** Speaker dropdown (populated from `characters.json`), expression dropdown, text textarea, auto-advance toggle, next node selector
- **Choice type:** Prompt text, add/remove choices. Each choice has: text, next node (autocomplete from node IDs), condition (variable expression builder), set flag/value
- **Action type:** Flag/variable to set, value
- **Scene end type:** Ending text, next scene selector

### Panel 3: Preview (bottom panel, collapsible)
- Renders the selected node as it would appear in-game
- Dialogue type: shows text box with nameplate + typewriter animation
- Choice type: shows prompt + choice buttons
- Lets the user test the flow by clicking through nodes
- Loads actual character colors from `characters.json`

---

## 3. Data Flow

```
data/scenes/sample.json ──fetch──→ Dialogue Editor (load)
                                        │
                                    User edits nodes
                                    Adds/removes/reorders
                                        │
                                    Preview renders live
                                        │
                              User clicks "Export JSON"
                                        │
                                    Download .json file
                                        │
                              User places file in data/scenes/
                                        │
                              Refresh game → SceneController
                              reads updated JSON from cache
```

### Loading scene data
1. Tool starts, fetches `/data/game.json` to get scene list + defaults
2. Fetches `/data/characters.json` to populate speaker/expression dropdowns
3. Fetches `/data/variables.json` to populate condition builder
4. Fetches `/data/scenes/<scene>.json` for the currently active scene
5. Parses all data into the editor state

If any `fetch()` fails (e.g. first run, no scenes yet), the tool initialises with an empty template:
```json
{
  "id": "new_scene",
  "background": null,
  "music": null,
  "nodes": [
    {
      "id": "start",
      "type": "dialogue",
      "speaker": null,
      "text": "Start writing your story here."
    }
  ]
}
```

### Saving / Exporting
- **Export JSON button:** Generates the current scene as JSON, triggers a browser download via `Blob` + `URL.createObjectURL()` + `<a download>`
- **Save button:** Uses File System Access API (`showSaveFilePicker`) where available — lets user pick a location to save directly
- **Session auto-save:** The editor state (draft, unsaved changes) is saved to `localStorage` every 30 seconds and on tab close. Reopening the editor restores the last session.

---

## 4. Implementation Tasks

### Task 1: Create the tool landing page

**Objective:** Standalone HTML page at `tools/dialogue-editor/index.html` that loads and displays on the dev server.

**Files:**
- Create: `tools/dialogue-editor/index.html`

**Content:** Minimal HTML skeleton with three-panel layout, CSS grid, dark theme. Include a status bar showing connected state (data loaded / no data).

**Verification:** Open `http://localhost:3000/tools/dialogue-editor/index.html` — page renders with the three-panel layout but empty state.

---

### Task 2: Data loader module

**Objective:** Fetch game data files and parse them into the editor's state.

**Files:**
- Modify: `tools/dialogue-editor/index.html` (add inline `<script>` section with the loader)

**Features:**
- `loadGameData()` — fetches game.json, characters.json, variables.json
- `loadScene(sceneId)` — fetches a scene file from `data/scenes/<id>.json`
- `getSceneList()` — reads the scene array from game.json, populates a scene dropdown
- Error handling: toast notification if a file is missing, with graceful fallback

**Verification:** Tool loads and displays "Loaded: sample (12 nodes)" in the status bar. Switching scenes in the dropdown loads different scene data.

---

### Task 3: Node list panel (left sidebar)

**Objective:** Render a scrollable list of all nodes in the current scene.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- Each node shows: type icon (💬❓⚡🏁), node ID, truncated text preview
- Choice nodes show their choices indented below with → arrows
- Color coding: dialogue=blue, choice=amber, action=purple, scene_end=red
- Click to select — highlights the selected node
- Selected node's data populates the Node Editor panel
- Up/down arrow buttons to reorder nodes (changes array index)

**Verification:** Click a node → it highlights → Node Editor panel shows that node's data.

---

### Task 4: Node editor form (center panel)

**Objective:** Render an editable form for the selected node, with fields that change by node type.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- **For all types:** ID field (auto-generated UUID-like, editable), type dropdown (dialogue/choice/action/wait/condition/jump/scene_end)
- **Dialogue type:** Speaker dropdown (populated from characters.json keys), expression text field (autocomplete from character's expressions), text textarea (large, monospace), auto-advance checkbox, wait-time field (ms, shown when auto-advance checked), next node field (autocomplete dropdown from all other node IDs in scene)
- **Choice type:** Prompt text field, choice list with add/remove. Each choice row: text field, next node (autocomplete), condition field (with variable picker from variables.json), set flag/variable dropdown, set value field
- **Action type:** Action type radio (setFlag/toggleFlag/addFlag), flag name (autocomplete from variables.json), value
- **Wait type:** duration field (ms)
- **Scene end type:** Ending text field, next scene (autocomplete from game.json scene list)

**Verification:** Select a dialogue node → all dialogue fields appear populated. Change type to "choice" → fields switch dynamically. Edit a field → node list preview updates live.

---

### Task 5: Node graph / flow visualization (canvas overlay)

**Objective:** Show a visual flow diagram connecting the nodes so the user can see branching paths.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- A small "Flow View" toggle button in the toolbar
- When toggled, the left panel switches from list view to graph view
- Nodes are rendered as boxes on a canvas
- Arrow lines connect nodes based on `next` fields and choice `next` fields
- Choice nodes fork into multiple outgoing arrows
- Click a node in the graph to select it (syncs with Node Editor)
- Zoom + pan via scroll and drag

**Note:** This is a "nice to have" for iteration 1. The list view is functional. The graph view adds visual clarity for complex branching.

---

### Task 6: Preview panel

**Objective:** Render a live preview of the selected node as it would appear in-game.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- Bottom panel, collapsible via a toggle
- For dialogue nodes: renders the text box (dark panel, 16px monospace text, speaker nameplate above with character color)
- Click "Play" to see typewriter animation
- Click "Skip" to show full text immediately
- Arrow buttons: Previous Node / Next Node to step through the scene linearly
- For choice nodes: renders prompt + choice buttons as they'd appear in-game
- Uses actual character colors from characters.json
- Preview panel can also run through a full scene flow:
  - "Play Scene" button starts from node 0
  - Click to advance through each node
  - At choices, click a choice to follow that branch
  - Shows current variable state as an overlay (courage=55, etc.)

**Verification:** Select a node → preview shows rendered text. Click "Play" → typewriter effect runs. Click through a sequence → preview advances correctly.

---

### Task 7: Export / Save functionality

**Objective:** Export the edited scene as a downloadable JSON file.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- "Export" button in toolbar: serializes current scene state to JSON (pretty-printed, 2-space indent), triggers browser download as `<sceneId>.json`
- "Save" button: uses File System Access API if available, falls back to download
- "Save to data/": If the user has granted permission (via File System Access), saves directly to the `data/scenes/` directory
- Auto-save to localStorage: every 30 seconds, saves editor state (scene data + UI state) to localStorage key `dialogue_editor_draft`
- On load: checks for localStorage draft, offers to restore or discard
- Unsaved changes indicator: "● Unsaved changes" dot in the toolbar, greyed out when saved

**Verification:** Edit a node → click Export → .json file downloads → open the file → changes are reflected. Close tab → reopen → "Restore unsaved draft?" prompt appears.

---

### Task 8: Node type: Condition

**Objective:** Add support for editing condition nodes in the editor.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- When node type is "condition", show: condition field (with variable picker + operator dropdown + value field), "true" branch (next node), "false" branch (else node)
- Operator dropdown: ==, !=, >=, <=, >, <
- Variable picker: dropdown populated from variables.json keys
- Validates condition syntax before export

---

### Task 9: New scene creation

**Objective:** Let the user create a new scene from scratch.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- "New Scene" button in toolbar
- Prompts for scene ID (default: `new_scene_<timestamp>`)
- Creates empty scene with one starter dialogue node
- Adds scene to the scene list dropdown
- On export, creates the file as a new scene JSON

---

### Task 10: Integration — updating game.json scene list

**Objective:** When a new scene is created, also update the scene list in game.json.

**Files:**
- Modify: `tools/dialogue-editor/index.html`

**Features:**
- After exporting a new scene, offer to update the scene registry
- Generate an updated `game.json` with the new scene ID added to the `scenes` array
- Download as `game.json` (user replaces the existing file)
- Also generate the `BootScene.js` load line as a copy-paste snippet

---

## 5. Tool Structure

The entire editor is a single HTML file (`tools/dialogue-editor/index.html`) with embedded CSS and JavaScript. No build step, no dependencies, no npm install. This keeps it zero-friction.

```
tools/dialogue-editor/index.html   ← ≈800-1000 lines, everything inline
```

**Internal structure of the HTML file:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Three-panel layout (CSS Grid)
     * Dark theme (matching the game's aesthetic)
     * Node list styling
     * Form styling
     * Preview panel styling
     * Toast notifications
     * Node graph canvas styling */
  </style>
</head>
<body>
  <!-- Toolbar -->
  <!-- Node List (left) -->
  <!-- Node Editor (center) -->
  <!-- Preview Panel (bottom) -->
  
  <script>
    // State management
    // Data loading
    // Node list rendering
    // Node editor rendering + form logic
    // Preview rendering
    // Export/save
    // localStorage auto-save
    // Keyboard shortcuts
  </script>
</body>
</html>
```

---

## 6. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+S` | Save/export current scene |
| `Ctrl+N` | New node |
| `Ctrl+Shift+N` | New scene |
| `Ctrl+Z` | Undo (track last 20 state snapshots) |
| `Delete` / `Backspace` | Delete selected node (with confirmation) |
| `↑` `↓` | Navigate between nodes in list |
| `Enter` | Focus the selected node's first editable field |
| `Escape` | Close preview panel / deselect node |
| `Space` | Play preview (when preview panel has a node loaded) |

---

## 7. State Management

The editor state is a single plain object:

```js
let state = {
  gameConfig: null,          // from game.json
  characters: {},            // from characters.json
  variableDefs: {},          // from variables.json
  scenes: [],                // list from game.json
  
  currentSceneId: 'sample',
  sceneData: { id: 'sample', background: null, music: null, nodes: [] },
  
  selectedNodeIndex: 0,
  selectedNodeId: 'start',
  
  hasUnsavedChanges: false,
  lastSaved: null,           // timestamp
  
  previewMode: false,        // collapsed or expanded
  previewStepIndex: 0,
  
  flowView: false,           // list view vs graph view
  
  undoStack: [],             // last 20 state snapshots
  undoIndex: -1
};
```

A helper function `serializeScene()` rebuilds the scene JSON from state before export:

```js
function serializeScene() {
  return {
    id: state.sceneData.id,
    background: state.sceneData.background,
    music: state.sceneData.music,
    nodes: state.sceneData.nodes  // already in the correct array format
  };
}
```

---

## 8. Risks and Tradeoffs

| Risk | Mitigation |
|------|------------|
| **File write permissions** — browser can't write to filesystem without File System Access API | Primary export is download-based. File System Access API is a progressive enhancement. User manually places file in `data/scenes/`. |
| **Large scenes** — 200+ nodes could lag the UI | Virtual scrolling for node list. Canvas-based graph view only renders visible nodes. |
| **Undo complexity** — deep-cloning state for every edit is expensive | Debounce undo snapshots (500ms). Store only diffs for large states. |
| **Preview accuracy** — in-browser preview won't match game rendering 100% | Preview uses the same CSS font sizes, colors, and text box dimensions as the game's DialogueSystem. Document the minor differences. |
| **Vite serving subdirectory HTML** — might need config | Test: Vite serves any file under the project root as static. If it doesn't work, add a `server.fs.allow` config or use a simple Python HTTP server fallback. |
| **Session restore** — localStorage data could be stale if scenes are edited externally | Add "Reload from disk" button that re-fetches the scene file. Show last-saved timestamp. |

---

## 9. Open Questions

1. **Node graph vs list view** — Is the canvas-based graph view essential for v1, or is the list view sufficient? The list view is faster to build and more reliable. Graph view can be v2.

2. **Multi-scene editing** — Should the editor support editing multiple scenes in one session (tabs), or one scene at a time? One scene at a time is simpler for v1. The scene dropdown in the toolbar lets you switch.

3. **Variable/character editing in the dialogue tool** — Should the dialogue editor also let you edit characters and variables, or keep those as separate tools? For v1, the dialogue editor reads characters/variables but doesn't edit them. The Variable Editor tool handles that.

4. **WASD / mouse middle-click for canvas pan** — Minor UX detail for the graph view. Defer to v2.

---

## 10. Verification Checklist

- [ ] `http://localhost:3000/tools/dialogue-editor/` loads the editor page
- [ ] Tool fetches and displays data from sample.json
- [ ] Left panel shows all 14 nodes with type icons
- [ ] Clicking a node populates the center editor panel
- [ ] Editing a field updates the node list preview in real-time
- [ ] Changing node type switches the editor form
- [ ] Export downloads a valid .json file
- [ ] Exported file can be placed in `data/scenes/` and loaded by the game
- [ ] Preview panel shows rendered text with correct colors
- [ ] Preview typewriter effect works
- [ ] Preview can step through multiple nodes
- [ ] localStorage auto-save restores draft on reload
- [ ] Keyboard shortcuts work (Ctrl+S, Ctrl+Z, ↑↓, Delete)
- [ ] Character dropdown shows hero, narrator, mystery_man
- [ ] Variable picker shows courage, has_weapon_permit, etc.
- [ ] Condition builder generates valid condition strings
- [ ] New scene creation produces a valid scene file
- [ ] Empty state works (no scenes yet, first-run experience)
