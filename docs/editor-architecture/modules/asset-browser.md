# Module: Asset Browser

**ID:** `asset-browser`
**File:** `tools/views/assets.js`
**Lifecycle:** Per-render (re-initializes each time tab is selected)
**Panel:** Workspace → Assets tab

---

## Purpose

Visual media browser. Shows all assets (backgrounds, portraits, music, SFX, fonts) in a grid with thumbnails. Supports filtering, search, drag-to-canvas, and apply-to-scene operations.

---

## Contributions

```js
export const contributions = {
  panels: [
    { id: 'asset-browser', label: 'Assets', area: 'workspace' }
  ],
  publishes: ['asset:imported'],
  subscribes: []
};
```

---

## Scoped State

```js
editorState.modules['asset-browser'] = {
  filter: 'all',          // 'all' | 'backgrounds' | 'portraits' | 'music' | 'sfx' | 'fonts'
  search: '',             // lowercase live search query
  selectedAsset: null,    // { category, name } | null
  onDisk: {
    backgrounds: [],      // [{ name, size, modified, category }]
    portraits: [],
    music: [],
    sfx: [],
    fonts: []
  },
  scanLoading: false
};
```

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ Filter: [All] [Bg] [Portraits] [Music] [SFX] [Fonts]│
│ Search: [__________________]      [⟳ Refresh] [Import]│
├────────────────────────────┬────────────────────────┤
│                            │ Detail Panel (280px)    │
│  Asset Grid                │  ┌────────────────┐     │
│  CSS Grid auto-fill        │  │   Large Preview │     │
│  minmax(140px, 1fr)        │  └────────────────┘     │
│                            │  Name: lakeside_sunset  │
│  ┌────┐ ┌────┐ ┌────┐     │  Size: 2.3MB            │
│  │ 🎨 │ │ 🎨 │ │ 🎨 │     │  Modified: 2h ago        │
│  └────┘ └────┘ └────┘     │  Used in: start.json     │
│                            │  ┌──────────────────┐   │
│                            │  │ 📋 Copy Asset Key  │   │
│                            │  │ 🖼️ Apply to Scene │   │
│                            │  │ 📁 Show in Files   │   │
│                            │  └──────────────────┘   │
└────────────────────────────┴────────────────────────┘
```

---

## Asset Card

```html
<div class="asset-card ${selected ? 'selected' : ''}"
     data-category="${category}" data-name="${name}" draggable="true">
  <div class="asset-thumbnail">
    ${image ? `<img src="${path}" style="object-fit:cover">` : audio ? `<div>icon</div>` : `<div>icon</div>`}
    ${audio ? `<button class="asset-play-btn">▶</button>` : ''}
  </div>
  <div class="asset-info">
    <div class="asset-name">${name}</div>
    <div class="asset-meta">${size}</div>
  </div>
</div>
```

### Drag Data

```
dragstart: setData('application/json', JSON.stringify({category, name}))
           setData('text/plain', JSON.stringify({category, name}))
```

Dual MIME types ensure cross-context drag survives browser restrictions.

---

## API

```js
/**
 * Scan files on disk via backend API.
 * Populates _state.onDisk and updates grid.
 */
scanOnDisk(): Promise<void>

/**
 * Render the full asset browser into container.
 */
render(container: HTMLElement, ctx: ModuleContext): void

/**
 * Init — called once on first load.
 */
init(ctx: ModuleContext): void
```

---

## Filtering

| Filter | Returns |
|--------|---------|
| All | backgrounds + portraits + music + sfx + fonts |
| Bg | backgrounds only |
| Portraits | portraits only |
| Music | music only (audio play buttons) |
| SFX | sfx only (audio play buttons) |
| Fonts | fonts only (no drop to scene) |

Search is case-insensitive, filtered by asset name.

---

## Audio Preview

- Singleton audio player — only one track plays at a time
- Click play → plays, button changes to stop (⏹)
- Click stop or on-ended → resets to play (▶)
- Both card overlay and detail panel play buttons use the same `_toggleAudioPlay()` function

---

## Global Helpers

```js
/**
 * Apply an asset to the current scene as a layer.
 * Routes through scene-composer.handleAssetDrop with the asset's category.
 */
window.__applyToScene(category: string, name: string): void

/**
 * Legacy — delegates to __applyToScene with category='backgrounds'.
 */
window.__applyBackground(name: string): void

/**
 * Copy asset key to clipboard.
 */
window.__copyAssetKey(category: string, name: string): void
```
