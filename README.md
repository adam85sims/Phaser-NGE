# Phaser NGE — Narrative Game Engine

## ⚠️ Status: Active Development (WIP)

**It's a work in progress. Dear god, it's a work in progress.** Don't try to actually use this on something serious yet.

**What works:**
- ✅ Visual node graph editing (drag, connect, rearrange)
- ✅ Inspector with live state sync
- ✅ Character editor (CRUD, expressions, portraits, color picker)
- ✅ Variable editor (inline editing, filtering, usage tracking)
- ✅ File explorer (Unity-style two-panel layout)
- ✅ Asset browser (drag-drop upload, usage tracking)
- ✅ Game engine (dialogue, choices, conditions, events, save/load)

**What's pending:**
- 🔲 Backend API for file persistence (save button is mocked)
- 🔲 Script mode code editor
- 🔲 Full asset upload pipeline (needs backend endpoint)
- 🔲 Polish & QA

Use at your own risk. The editor UI is functional but changes don't persist to disk yet.

---

A data-driven narrative game engine for dialogue-based games. Write your story in a visual node editor, or directly in JSON. The engine handles the rest.

**Built with Phaser 4 · Zero middleware · Standalone tools**

---

## Quick Start

```bash
cd Phaser-NGE
npm install
npm run dev
```

This starts a dev server. Two URLs open up:

| URL | What it is |
|-----|-----------|
| `http://localhost:3000/` | **Play the game** — test your story, see it come to life |
| `http://localhost:3000/tools/index.html` | **Editor v2** — unified IDE for all content creation |

Press **F1**, **F2**, **F3** in the game to switch between test scenes.

> **Note:** The editor's Save button is currently mocked. Export your work manually by copying JSON from the console or using the Export buttons in Characters/Variables tabs.

---

## How It Works

```
Write dialogue → Export JSON → Drop in data/scenes/ → Refresh game → Play
```

**You write the story.** The engine renders it.

Everything your story needs lives in the `data/` folder:

| File | What it is |
|------|-----------|
| `data/game.json` | Game settings — title, default text speed, scene list |
| `data/characters.json` | Who's in your story — names, colors, portrait keys |
| `data/variables.json` | Game state variables — flags, counters, strings |
| `data/scenes/*.json` | Your scenes — one file per scene, full node tree |

---

## Using the Editor v2

1. Open `http://localhost:3000/tools/index.html`
2. The editor has a Unity-style layout:
   - **Left sidebar**: Scene outline (click to select nodes)
   - **Center**: Visual preview or node graph
   - **Right**: Inspector (edit properties)
   - **Bottom workspace**: Tabbed panels
3. **Workspace tabs:**
   - **Files**: Browse project structure (folder tree + file grid)
   - **Asset Browser**: Manage images, audio, fonts
   - **Dialogue Editor**: Node graph for visual scripting
   - **Characters**: Define characters, expressions, portraits
   - **Variables**: Track game state flags and counters
4. Click a node in the graph or outline to edit its properties
5. Drag nodes to rearrange, drag wires to connect
6. Change X/Y in inspector to move nodes (live sync with graph)
7. Click **Save** (currently mocked — exports to console)

**Pro tips:**
- Press **3** in the scene view to toggle 3D grid mode (future hook)
- Double-click files in the Files tab to open (future: code editor)
- Use the graph fullscreen button for focused editing

**Node types at a glance:**

| Node | Color | What it does |
|------|-------|-------------|
| 💬 Dialogue | Blue | Character says something. Typewriter text. |
| ◇ Choice | Amber | Player picks an option. Each branch can have conditions. |
| △ Condition | Purple | System checks a variable, branches automatically. |
| ⚡ Event | Green | Plays sound, shakes camera, sets a variable. |
| ◻ Wait | Grey | Pauses for a duration. |
| ■ End | Red | Ends the scene. Can transition to another scene. |

---

## Writing Scenes Directly (No Editor)

You don't need the editor. Scene files are plain JSON. Create `data/scenes/my_scene.json`:

```json
{
  "id": "my_scene",
  "entryNode": "start",
  "nodes": [
    {
      "id": "start",
      "type": "dialogue",
      "speaker": "narrator",
      "text": "It was a dark and stormy night."
    },
    {
      "id": "decision",
      "type": "choice",
      "prompt": "What do you do?",
      "choices": [
        {
          "text": "Light a candle",
          "next": "candle_scene",
          "setFlag": "courage",
          "setValue": 5
        },
        {
          "text": "Hide under the bed",
          "next": "hide_scene",
          "condition": "courage < 30"
        }
      ]
    }
  ]
}
```

Then add `"my_scene"` to the `"scenes"` array in `data/game.json`.

---

## Characters

Define characters in `data/characters.json`:

```json
{
  "hero": {
    "name": "Lena",
    "color": "#00ccff",
    "portraits": {},
    "defaultExpression": "neutral"
  },
  "narrator": {
    "name": null,
    "color": "#ffffff"
  }
}
```

- Set `"name"` to `null` for narration (no nameplate shown)
- Add portrait images to `public/assets/characters/` and reference them in `"portraits"`
- If no portrait image exists, the engine generates a colored placeholder

---

## Variables & Conditions

Variables are defined in `data/variables.json`:

```json
{
  "courage": {
    "type": "number",
    "default": 50,
    "min": 0,
    "max": 100
  },
  "has_weapon_permit": {
    "type": "boolean",
    "default": false
  }
}
```

Use conditions on choice options or condition nodes:

```
courage >= 30
has_weapon_permit == true
player_name == "Lena"
```

---

## Play Controls

| Key | Action |
|-----|--------|
| Space / Enter / Click | Advance text, skip typewriter |
| 1-9 | Select a choice |
| F1 | Load sample scene |
| F2 | Load condition test scene |
| F3 | Load event test scene |

---

## Project Structure

```
narrative-engine/
├── src/           # Engine code (you don't need to touch this)
├── data/          # Your story (characters, scenes, variables)
├── tools/         # Editors for creating content
├── public/assets/ # Images, audio, fonts
├── index.html
├── package.json
└── vite.config.js
```

---

## Building for Production

```bash
npm run build
```

Output goes to `dist/` — a standalone HTML/JS bundle you can host anywhere.

---

## Creating a New Scene Workflow

1. **Write:** Open Editor v2, go to Dialogue Editor tab, create nodes
2. **Edit:** Select nodes, change properties in inspector, drag to rearrange
3. **Connect:** Drag wires between output ports and input ports
4. **Export:** (Pending) For now, manually copy scene JSON from `data/scenes/`
5. **Register:** Add the scene ID to `data/game.json`'s `"scenes"` array
6. **Test:** Refresh the game, press the hotkey or set `startScene` in game.json
7. **Iterate:** Edit in the editor, re-export, replace the file, refresh

> **Tip:** Use the Files tab to browse and verify your scene JSON files. Double-click to open (future: in-editor code view).

---

## About

This engine was built to prove that game development can work without MCP middleware. The framework (Phaser 4) is the API — no extra servers, no plugins, no infrastructure. Tools are standalone HTML pages. Content is plain JSON. Everything is version-controllable, human-readable, and portable to other engines.
