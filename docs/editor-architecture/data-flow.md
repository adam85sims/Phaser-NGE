# Data Flow

## Read Path (Boot)

```
User opens editor → index.html → app.js boot()
                                         │
                                         ▼
                         loadProjectData()
                           ├── fetchGameConfig()   → /data/game.json
                           ├── fetchCharacters()   → /data/characters.json
                           ├── fetchVariables()    → /data/variables.json
                           ├── fetchTheme()        → /data/theme.json
                           └── for each scene:
                                fetchScene(id)     → /data/scenes/{id}.json
                                         │
                                         ▼
                         editorState populated
                           ├── gameConfig
                           ├── characters
                           ├── variableDefs
                           ├── theme
                           └── scenes[id]
                                         │
                                         ▼
                         Module init()s
                         Render outline, workspace, preview
```

## Write Path (Save)

```
User edits data (any module)
         │
         ▼
  Module mutates state (editorState.scenes[id].layers.push(...))
         │
         ▼
  Event: project:modified  →  Shell sets dirty=true
         │
         ▼
  User clicks Save / Ctrl+S
         │
         ▼
  Shell calls forceSave()
         │
         ▼
  backend.saveProject(payload)
    POST /api/save
    Body: {
      game: editorState.gameConfig,
      characters: editorState.characters,
      variables: editorState.variableDefs,
      theme: editorState.theme,
      scenes: { [id]: { id, entryNode, background, music, nodes, layers } }
    }
         │
         ▼
  Event: project:saved  →  Shell sets dirty=false
```

---

## Asset Flow (Import + Drop)

```
User drags file into Asset Browser
         │
         ▼
  backend.uploadAsset(file, category)
    POST /api/upload-asset
         │
         ▼
  File saved to public/assets/{category}/{filename}
         │
         ▼
  Event: asset:imported  →  Asset Browser re-scans on disk
         │
         ▼
  User drags asset card to scene canvas
         │
         ▼
  Drop overlay → scene-composer.handleAssetDrop(category, key)
  → addImageLayer(key, { category, type })
  → editorState.scenes[id].layers.push(layer)
  → renderScenePreview()
  → renderOutline()
```

---

## Local Storage Bridge (Editor → Game Preview)

When "Play" is clicked, the editor saves current state to localStorage under `nge_editor_data`:

```js
localStorage.setItem('nge_editor_data', JSON.stringify({
  game: editorState.gameConfig,
  characters: editorState.characters,
  variables: editorState.variableDefs,
  scenes: editorState.scenes
}));
```

The game's `BootScene` checks this localStorage key before hitting the network. If valid data exists, it uses it. This enables the edit → play → iterate cycle without needing to save to disk first.

The debug start node is stored in a separate key:
```js
localStorage.setItem('nge_debug_start', JSON.stringify({
  sceneId: editorState.shell.activeSceneId,
  nodeId: editorState.selection.id
}));
```
