# Phaser NGE — Narrative Game Engine

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
| `http://localhost:3000/tools/dialogue-editor/` | **Write the story** — visual node graph editor |

Press **F1**, **F2**, **F3** in the game to switch between test scenes.

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

## Using the Dialogue Editor

1. Open `http://localhost:3000/tools/dialogue-editor/`
2. Pick a scene from the dropdown (or create a new one)
3. See your scene as a node graph — each block is a story beat
4. Click a node to edit its properties in the right panel
5. Drag between output ports (right circles) and input ports (left circles) to wire connections
6. Drag nodes to rearrange the layout
7. Click **Export** to download a `.json` file
8. Place the file in `data/scenes/`
9. Add the scene ID to `data/game.json`'s `"scenes"` array
10. Refresh the game to play your scene

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

1. **Write:** Open the dialogue editor, create a new scene, add nodes
2. **Export:** Click Export, download the JSON file
3. **Place:** Copy the file into `data/scenes/`
4. **Register:** Add the scene ID to `data/game.json`'s `"scenes"` array
5. **Test:** Refresh the game, press the hotkey or set `startScene` in game.json
6. **Iterate:** Edit in the editor, re-export, replace the file, refresh

---

## About

This engine was built to prove that game development can work without MCP middleware. The framework (Phaser 4) is the API — no extra servers, no plugins, no infrastructure. Tools are standalone HTML pages. Content is plain JSON. Everything is version-controllable, human-readable, and portable to other engines.
