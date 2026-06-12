# Backend Services

**File:** `tools/editor-backend.js`
**Type:** Vite plugin (transforms requests to filesystem operations)

The backend is a Vite dev server plugin that intercepts API calls from the editor and performs filesystem operations. It is the only bridge between the editor and the file system.

---

## API Endpoints

### `POST /api/save`

Save project data to disk. Receives the full project state as JSON body.

```
Request Body: {
  game: GameConfig,
  characters: CharacterMap,
  variables: VariableMap,
  theme: Theme,
  scenes: { [id]: SceneData }
}
```

Behavior:
- Writes each data file to `data/{filename}.json`
- Writes each scene to `data/scenes/{id}.json`
- Returns 200 on success, 500 on error

### `GET /api/list-assets`

List all asset files on disk, grouped by category.

```
Response: {
  backgrounds: [{ name, size, modified }],
  portraits: [{ name, size, modified }],
  music: [{ name, size, modified }],
  sfx: [{ name, size, modified }],
  fonts: [{ name, size, modified }]
}
```

Directories mapped from categories:

| Category | Directory |
|----------|-----------|
| `backgrounds` | `public/assets/backgrounds/` |
| `portraits` | `public/assets/characters/` |
| `music` | `public/assets/audio/bgm/` |
| `sfx` | `public/assets/audio/sfx/` |
| `fonts` | `public/assets/fonts/` |

### `POST /api/upload-asset`

Upload a file to an asset directory.

```
Body (multipart): { file: File, category: string }
```

Behavior:
- Strips prefix from filename if present (`bg_` → backgrounds, `port_` → portraits, etc.)
- Saves to `public/assets/{resolved_dir}/{resolved_filename}`
- Returns 200 + file metadata on success

---

## Backend Adapter (Client-Side)

**File:** `tools/shared/backend-adapter.js`

Centralizes all API calls into a single `backend` object. Makes it possible to swap transport (e.g., from Vite/fetch to Electron IPC) by replacing this single file.

```js
export const backend = {
  fetchGameConfig(): Promise<GameConfig>,
  fetchCharacters(): Promise<CharacterMap>,
  fetchVariables(): Promise<VariableMap>,
  fetchTheme(): Promise<Theme>,
  fetchScene(id): Promise<SceneData>,
  saveProject(data): Promise<void>,
  listAssets(): Promise<AssetList>,
  uploadAsset(file, category): Promise<void>
};
```
