# Phaser NGE — Export Pipeline Audit

> **Date:** 2026-06-29
> **Scope:** All export/build/package paths — Vite build, Electron web export, Electron EXE export, Layout Export Preview

---

## Executive Summary

There are **three export surfaces** in this project:

1. **Vite Build** (`npm run build`) — bundles engine + editor + launcher to `dist/`
2. **Electron Game Export** (`src-main/index.js`) — web export & EXE export for shipping games
3. **Layout Export Preview** (`packages/ui-editor`) — multi-engine UI export (JSON, NGE, Godot, Unity, Unreal)

The Vite build is solid. The Electron exports have structural bugs that would cause runtime failures. The Layout Export is a creative feature with untested adapters.

---

## 1. Vite Build (`npm run build`)

**Status: MOSTLY WORKING**

### What works
- Produces a clean `dist/` with hashed assets, launcher, editor, and game bundles
- Multi-entry rollup config correctly splits main (game), tools (editor), launcher
- Static assets (backgrounds, characters, gallery, audio) are copied to `dist/assets/`

### Issues

| # | Severity | Issue |
|---|----------|-------|
| V1 | LOW | `layout-mockup.png` (872KB dev artifact) ends up in `dist/` — not code-split or excluded |
| V2 | LOW | No `sourcemap: true` in build config — production debugging is blind |
| V3 | LOW | No `build.emptyOutDir: true` — stale files from prior builds can persist in `dist/` |
| V4 | INFO | Audio dir in dist is empty (`dist/assets/audio/` has no files) — the BGM in `public/assets/audio/bgm/` may not be getting copied |

---

## 2. Electron Game Export (`src-main/index.js`)

### 2A. Web Export (`project:exportWeb`)

**Status: BROKEN — will produce a non-functional game**

**How it works:**
1. Copies `dist/index.html` (with optional icon injection)
2. Copies `dist/assets/*` (engine JS bundles)
3. Copies `project/data/` → `dest/data/`
4. Copies `project/public/assets/*` → `dest/assets/` (merged with engine assets)

| # | Severity | Issue |
|---|----------|-------|
| W1 | **CRITICAL** | **Engine JS references `/data/` paths but export has no routing.** The exported `index.html` is a static file. `BootScene.create()` does `fetch('/data/game.json')` — this works in dev (Vite serves it) but in the exported folder, there's no web server. Opening `index.html` via `file://` will CORS-fail on `fetch()`. Opening via a simple HTTP server works only if the directory structure matches. **The export needs a note/instruction or a bundled lightweight server.** |
| W2 | **HIGH** | **Merged asset namespace collision.** Engine bundles (e.g. `assets/tools-rLEz9Y-4.js`) and project assets (e.g. `assets/backgrounds/BG_throne.png`) are merged into the same `assets/` dir. If a project has a file named `main-C7RiHZ1s.js` in its backgrounds, it would overwrite the engine bundle. Unlikely but architecturally fragile. |
| W3 | **MEDIUM** | **No offline/PWA support.** No service worker, no manifest. Game breaks without a web server. |
| W4 | **LOW** | Icon injection assumes game.json `icon` field is relative to `/assets/`. No validation. |
| W5 | **LOW** | No progress indicator or size report after export. |

### 2B. EXE Export (`project:exportExe`)

**Status: PARTIALLY WORKING on Linux dev, UNTESTED for production**

**How it works:**
1. User selects empty folder
2. Copies entire `win-unpacked/` Electron directory to dest
3. Creates `game-data/` subfolder with project data + assets
4. Renames `Phaser NGE.exe` → `<GameTitle>.exe`
5. Optionally patches icon via `rcedit` (requires `.ico`)

| # | Severity | Issue |
|---|----------|-------|
| E1 | **CRITICAL** | **`win-unpacked` path assumption broken in dev mode.** Line 179: `path.join(app.getAppPath(), '..', 'release', 'win-unpacked')` — `app.getAppPath()` in dev mode returns the project root (e.g. `/home/adam/Documents/Dev/Phaser-NGE`), so this looks for `release/win-unpacked` which exists (from a prior `npm run build:electron`). But if it doesn't exist, the user gets an opaque error message. **No automated build step — user must manually `npm run build:electron` first.** |
| E2 | **HIGH** | **No `electron-builder.yml` config.** The `build` key in `package.json` is minimal — no `asar`, no icon config, no compression settings, no `extraResources` for game data. |
| E3 | **HIGH** | **`game-data/` path not wired in engine.** The EXE export puts project files in `game-data/data/` and `game-data/public/assets/`, but `BootScene` fetches from `/data/game.json`. The Express server in `src-main/server.js` serves `/data` from `currentProjectRoot` — but `setProjectRoot()` is only called by the launcher's IPC handler or the standalone detection at lines 266-274. **If the standalone detection fails (e.g. wrong directory name), the EXE launches with no project loaded.** |
| E4 | **MEDIUM** | **rcedit only works with `.ico` files.** Game.json `icon` field could be `.png` — the export silently skips icon patching with a console warning. No conversion tool offered. |
| E5 | **MEDIUM** | **No Linux/macOS EXE export.** Only `win-unpacked` is referenced. No `.app` bundle for macOS, no AppImage for Linux. |
| E6 | **LOW** | **File size bloat.** Copies entire Electron distribution (~80MB+) including debug tools, ffmpeg.dll, etc. No pruning of unnecessary files. |

### 2C. Export Button Wiring (`tools/app.js`)

**Status: ELECTRON-ONLY — dead in browser**

| # | Severity | Issue |
|---|----------|-------|
| B1 | **HIGH** | **Export buttons call `window.electron.*` unconditionally.** Lines 104-120: clicking "Export Web" or "Export EXE" in a browser context hits `window.electron.exportWebBuild()` which throws `TypeError: Cannot read properties of undefined`. **No feature detection, no graceful fallback, no disabling of buttons when `window.electron` is absent.** |
| B2 | **MEDIUM** | **No web-based export alternative.** The Vite dev server has the editor-backend plugin with full `/api/save` capability — there could be a `/api/export` endpoint that zips the project for download. Currently there is no browser-path export at all. |

---

## 3. Layout Export Preview (`packages/ui-editor`)

**Status: PREVIEW-ONLY — copy-to-clipboard, no file download**

### What works
- 5-format export: Raw JSON, NGE theme, Godot .tscn, Unity C# script, Unreal Python script
- Clean UI with tabs and copy button
- Adapters are pure functions (no DOM deps) — testable

### Issues

| # | Severity | Issue |
|---|----------|-------|
| L1 | **MEDIUM** | **No file download.** Only clipboard copy. For 300+ line Unity/Unreal scripts, users need a `.cs`/`.py` file, not clipboard. Missing "Download" button. |
| L2 | **MEDIUM** | **Adapters have no tests.** Complex multi-format codegen with no unit tests. The NGE adapter's `adaptToNGE()` function destructures without null checks — `const { theme, layers } = adaptToNGE(exportJson)` will throw if layout is empty. |
| L3 | **LOW** | **NGE adapter name mismatch.** The file exports `adaptToNGE` and `exportToNGE`, but the `ExportPreviewDialog` imports `exportToNGE` — this works, but the adapter also has dead code (`extractElements` function at line 42-59 is never called). |
| L4 | **LOW** | **Godot adapter** has a `buildParentMap()` function (line 287) that's called but never actually used in the output generation. Dead code. |
| L5 | **LOW** | **Unity adapter** uses `float` for `opacity` in `NodeProps` but JSON values could be `null` — Unity's `JsonUtility` would default to 0, making elements invisible. |
| L6 | **INFO** | All adapters duplicate `flattenElements()` and `groupByRole()` — could be a shared utility. |

---

## 4. Code Duplication

**Status: SIGNIFICANT**

The API server is implemented **twice**:

| Endpoint | `tools/editor-backend.js` (Vite plugin) | `src-main/server.js` (Express) |
|----------|----------------------------------------|-------------------------------|
| `/api/save` | Full validation (orphan detection, missing refs, missing assets, BFS) | Partial validation (missing refs only, no BFS, no orphan detection) |
| `/api/save` | Auto-compiles gallery list | **Missing** |
| `/api/list-assets` | Identical | Identical |
| `/api/upload-asset` | Identical | Identical |
| `/api/project/new` | Full (with gallery auto-compile) | Partial (no gallery) |
| `/api/create-folder` | Identical | Identical |
| `/api/move-asset` | Identical | Identical |
| `/api/create-file` | Identical | Identical |
| `/api/delete-asset` | Identical | Identical |

The Vite plugin version is **more complete** than the Express version. This means:
- Browser dev mode gets full validation
- Electron mode gets partial validation
- Any fix to one must be manually ported to the other

**Recommendation:** Extract shared logic into a `tools/shared/api-handler.js` module that both backends import.

---

## 5. Priority Fixes

### P0 — Would block a release

1. **B1**: Disable/grey export buttons when `window.electron` is absent, or add a fallback
2. **E3**: Verify `game-data/` standalone detection works reliably (add `BootScene` logging)
3. **W1**: Add export instructions or a bundled server for web export

### P1 — Would cause user confusion

4. **E2**: Create proper `electron-builder.yml` with icon, compression, asar config
5. **B2**: Add `/api/export` endpoint for browser-based ZIP export
6. **DUP**: Unify the two backend implementations

### P2 — Polish

7. **L1**: Add file download to Layout Export Preview
8. **L2**: Add unit tests for export adapters
9. **V3**: Add `emptyOutDir: true` to Vite config
10. **E5**: Consider Linux/macOS export targets

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    EXPORT PIPELINES                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── Vite Build ──────────────────────────────────┐   │
│  │  npm run build → dist/                           │   │
│  │  • index.html (game)                             │   │
│  │  • tools/index.html (editor)                     │   │
│  │  • launcher/index.html                           │   │
│  │  • assets/ (hashed bundles + static assets)      │   │
│  └──────────────────────────────────────────────────┘   │
│           │                                             │
│           ▼                                             │
│  ┌─── Electron Web Export ─────────────────────────┐   │
│  │  project:exportWeb IPC                           │   │
│  │  1. Copy dist/ engine files                      │   │
│  │  2. Copy project data/                           │   │
│  │  3. Copy project assets/ → merged assets/        │   │
│  │  4. Inject favicon                               │   │
│  │  Result: static folder (needs HTTP server)       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── Electron EXE Export ─────────────────────────┐   │
│  │  project:exportExe IPC                           │   │
│  │  1. Copy win-unpacked/ Electron runtime          │   │
│  │  2. Create game-data/ with project files         │   │
│  │  3. Rename + rcedit EXE                          │   │
│  │  Result: standalone Windows folder               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── Layout Export (UI Editor) ───────────────────┐   │
│  │  ExportPreviewDialog                             │   │
│  │  • Raw JSON (Layouteer format)                   │   │
│  │  • NGE theme JSON                                │   │
│  │  • Godot .tscn                                   │   │
│  │  • Unity C# Editor script                        │   │
│  │  • Unreal Python script                          │   │
│  │  Result: clipboard copy only                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
