# Sprite Editor — Design Document

## Objective
Build a visual Sprite Editor tool for managing sprite metadata: **origin points** and **9-slice bounds**. This enables precise control over how sprites pivot, scale, and anchor — critical for expanding beyond VN-style into RPG, point-and-click, and other narrative-driven genres.

## Problem Statement
Currently, all sprite origins default to center-point (or unspecified). This works for simple portrait display but breaks down when:
- Characters need foot-based anchoring (RPG overworld sprites)
- Objects need corner/corner-based pivots (point-and-click interactables)
- UI elements need 9-slice scaling (dialogue boxes, buttons, panels)
- Animated sprites need consistent pivot points across frames

## Implementation Status
**Phase 1 (Complete — Debugging):** Origin point editor widget integrated into scene toolbar
- Toolbar button added: Origin Edit (crosshair icon, between Scale and Snap) ✓
- Visual origin handle rendered on selected layers when Origin tool is active ✓
- Red crosshair handle with guide lines showing current origin position ✓
- Inspector fields: Origin X/Y numeric inputs (0–1 normalized) in Transform section ✓ WORKING
- Origin stored per-layer in `layers[].originX` and `layers[].originY` (normalized 0–1) ✓
- Default origin: 0.5, 0.5 (center) for backward compatibility ✓
- Drag-to-edit: click and drag the origin handle to reposition ⚠️ NOT WORKING (handles not clickable)
- Snap-to-grid: when snap is enabled, origin snaps to 0, 0.25, 0.5, 0.75, 1.0 ⚠️ NOT TESTED

**Known Issue:** On-screen handles (origin, scale, rotate) don't respond to mouse clicks. Inspector fields work perfectly. Pointer-events fix was applied to gizmo-box but mousedown handler may not be detecting the handles correctly.

**Phase 2 (Future):** 9-slice bounds editor

### 1. Origin Point Editor
- Load a sprite sheet or single image
- Visual grid overlay with draggable origin handle
- Preset anchors: top-left, top-center, top-right, mid-left, center, mid-right, bottom-left, bottom-center (feet), bottom-right
- Custom X/Y numeric input for pixel-perfect placement
- Preview: show how sprite pivots/scales from chosen origin
- Export: write to `sprites.json` or per-sprite metadata file

### 2. 9-Slice Bounds Editor (Future)
- Define 4 slice lines: left, right, top, bottom
- Corner regions (non-stretchable) vs edge/center regions (stretchable)
- Preview scaling behavior at different sizes
- Export: slice bounds as `{ left, right, top, bottom }` in sprite metadata

### 3. Metadata Schema
```json
{
  "key": "character_elen",
  "source": "public/assets/characters/elen.png",
  "origin": { "x": 64, "y": 128 },
  "originPreset": "bottom-center",
  "slice9": { "left": 10, "right": 10, "top": 10, "bottom": 10 },
  "frameWidth": 128,
  "frameHeight": 128,
  "frames": 4
}
```

## Integration Points
- **Engine**: `CharacterSystem` / `SpriteSystem` reads origin + slice9 metadata on load
- **Editor**: New tab in `tools/index.html` alongside Graph/Inspector
- **Asset Import**: `npm run import-asset` could prompt for sprite metadata, or we add a post-import step

## Tech Stack
- Pure HTML5 Canvas (no Phaser in the editor — same pattern as Graph view)
- Drag-to-position origin handle
- Zoom/pan for high-res sprites
- Export via `/api/save` (same backend as scene editor)

## Phased Rollout
1. **Phase 1**: Origin point editor only (this weekend's focus)
2. **Phase 2**: 9-slice bounds + preview
3. **Phase 3**: Batch editor for sprite sheets / animation frames
4. **Phase 4**: Engine integration — consume metadata in `CharacterSystem` / new `SpriteSystem`

## Open Questions
- Store metadata in a single `sprites.json` or per-sprite sidecar files (e.g., `elen.json` next to `elen.png`)?
- Should origin be stored as absolute pixels or normalized (0–1)?
- Do we need to support multi-frame sprite sheets in V1, or single images only?

---
*Created: 2026-06-14 — Initial brain dump from Antigravity widget task context*
