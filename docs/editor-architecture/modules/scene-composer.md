# Module: Scene Composer

**ID:** `scene-composer`
**File:** `tools/views/scene-composer.js`
**Lifecycle:** Singleton (runs entire editor session)
**Panel:** Scene preview (main workspace canvas)

---

## Purpose
The Scene Composer is the visual layer stack manager. It owns the `layers[]` array for each scene and renders the interactive preview canvas where layers appear as absolutely-positioned image divs with transforms.

---

## Contributions

```js
export const contributions = {
  panels: [
    { id: 'scene-preview', label: 'Scene', area: 'workspace' }
  ],
  outlineSections: [
    { id: 'layers', label: 'Layers', icon: '🎨' }
  ],
  publishes: ['scene:layer-changed', 'project:modified'],
  subscribes: ['selection:changed', 'scene:changed', 'asset:imported']
};
```

---

## Scoped State

```js
editorState.modules['scene-composer'] = {
  viewportWidth: 1280,
  viewportHeight: 720,
  previewPanX: 0,
  previewPanY: 0,
  previewZoom: 1,
  previewDragging: false,
  previewDragStart: { x: 0, y: 0 },
};
```

The layer data lives in `editorState.scenes[sceneId].layers[]` — not in module state. The Scene Composer reads/writes it there because layers are part of the scene data, not editor ephemera.

---

## Layer Data Model

```json
{
  "id": "layer_1749000000000_123",
  "type": "background",
  "category": "backgrounds",
  "asset": "lakeside_sunset",
  "x": 0,
  "y": 0,
  "scale": 1,
  "zIndex": 0,
  "opacity": 1
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | required | Unique layer ID (`layer_{timestamp}_{random}`) |
| `type` | `"background"` \| `"character"` \| `"prop"` | `"background"` | Semantic type — preserved for future anchor-to-speaker behaviors. Preview renderer is type-agnostic. |
| `category` | `"backgrounds"` \| `"portraits"` \| `"characters"` \| `"props"` | `"backgrounds"` | On-disk directory for image URL resolution |
| `asset` | string | required | Filename stem (no extension) |
| `x` | number | 0 | CSS translate-X |
| `y` | number | 0 | CSS translate-Y |
| `scale` | number | 1 | CSS scale factor |
| `zIndex` | number | highest+1 | CSS z-index for stacking order |
| `opacity` | number | 1 | CSS opacity 0–1 |

---

## API

```js
/**
 * Set active scene. Initialise layer cache from scene data.
 * Migrates legacy scene.background to layer on first access.
 */
initScene(sceneId: string): void

/**
 * Add an image layer. opts override defaults.
 * zIndex auto-increments above current max if not specified.
 */
addImageLayer(assetKey: string, opts?: LayerOpts): Layer

/**
 * Legacy — delegates to addImageLayer with type='background'.
 */
addBackground(assetKey: string): Layer

/**
 * Partially update a layer's properties. Fires scene:layer-changed.
 */
updateLayer(layerId: string, props: Partial<Layer>): void

/**
 * Remove a layer. Fires scene:layer-changed.
 */
removeLayer(layerId: string): void

/**
 * Get all layers for active scene, sorted by zIndex.
 */
getLayers(): Layer[]

/**
 * Get a single layer by ID.
 */
getLayer(layerId: string): Layer | undefined

/**
 * Handle asset drop from Asset Browser.
 * Maps category to type. Creates an image layer via addImageLayer.
 */
handleAssetDrop(category: string, assetKey: string): Layer | null

/**
 * Get the current background asset key (first background-type layer).
 */
getCurrentBackground(): string | null
```

---

## Preview Rendering

The scene preview renders inside `#scene-viewport`. The renderer is called from the shell's scene mode via `renderModule('scene-composer', container)`.

### Render Flow

```
1. Get active scene's layers
2. Sort layers by zIndex (ascending → lower z paints first, behind)
3. For each layer with an asset:
     a. Build URL from category → on-disk directory mapping
     b. Emit absolutely-positioned div with:
        - CSS z-index from layer.zIndex
        - transform: translate(x, y) scale(scale)
        - opacity
        - background-image with PNG/JPG fallback
4. Render rulers (top + left)
5. Render camera border (1280×720 game frame)
6. Render drop zone overlay
7. Overlay scene info (layer count, node count)
8. Overlay cursor position display
9. Bind events: drag-drop, pan, zoom, selection
```

### Category → Directory Mapping

| Category | URL Path |
|----------|----------|
| `backgrounds` | `/assets/backgrounds/{asset}.png` |
| `portraits` | `/assets/characters/{asset}.png` |
| `characters` | `/assets/characters/{asset}.png` |
| `props` | `/assets/props/{asset}.png` |

Fallback: if `category` is missing, default to `backgrounds`.

---

## Drop Handling

The drop overlay (`#scene-drop-overlay`) sits at z-index 100 on top of the canvas. It handles:

1. **dragover** — visual feedback (dashed border, blue tint, "+ DROP HERE" badge)
2. **dragleave** — clear visual feedback (with `relatedTarget` containment check)
3. **drop** — parse drag data (JSON or text/plain fallback), route to `handleAssetDrop()`

Drop data format from Asset Browser:
```json
{ "category": "backgrounds", "name": "lakeside_sunset.png" }
```

---

## Interactions

| User Action | What Happens |
|-------------|-------------|
| Drag asset onto canvas | Creates image layer, re-renders preview and outline |
| Click layer in outline | Sets `selection: { type: 'layer', id }`, inspector shows layer properties |
| Type X/Y/Scale/Z in inspector | `updateLayer()` → `scene:layer-changed` → re-render preview |
| Drag opacity slider | Live preview update via `input` event |
| Press Delete with layer selected | `removeLayer()` |
| Pan view (middle mouse/spacebar) | Update `previewPanX/Y` in scoped state |
| Scroll wheel | Zoom around cursor position |

---

## Legacy Migration

The migration from the old `scene.background` field to layers is handled in `initScene()`:
```js
if (scene.background && !scene.layers) {
  scene.layers = [{
    id: 'bg_1',
    type: 'background',
    category: 'backgrounds',
    asset: scene.background.replace(/\.[^.]+$/, ''),
    x: 0, y: 0, scale: 1, zIndex: 0, opacity: 1
  }];
  scene.background = null;
}
```

Existing layers without a `category` field default to `'backgrounds'` in the renderer for backwards compatibility.
