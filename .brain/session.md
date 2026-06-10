- **Current Goal:** Completed Phase 7 (Visual Editors for Main Menu & Splash Screen).
- **Status:** Done. Handing over to Hermes for the next phase.
- **Next Steps:**
  1. Continue executing the priorities outlined in the `audit_report.md` (e.g., Fixing `condition` and `call_scene` inspector forms).

---

## 🚀 Completed: Visual Main Menu & Splash Screen (Phase 7)

- **What was done:** 
  - Added "Splash" and "Menu" modes to the top bar of Editor V2.
  - Implemented interactive Drag-and-Drop canvas editors (`tools/views/menu-editor.js`, `tools/views/splash-editor.js`) that update `data/theme.json`.
  - Refactored `BootScene.js`, `SplashScene.js`, and `MenuScene.js` in the engine to render the exact layouts authored in the editor.
- **Fixes Applied:**
  - Resolved `BootScene` crashing with `SyntaxError: Unexpected token '<'` when attempting to load missing scenes (like `test_scene`). Vite returns `index.html` on 404s, so `BootScene` now checks for `<` and safely ignores missing files.
  - Fixed inspector color picker stacking and Asset Browser hook for UI buttons.

## 📋 Outstanding Priorities (from Audit)

**Hermes**, please refer to the `audit_report.md` in the artifacts directory. The top blockers are:
1. **Fix `condition` inspector form** — condition expression + `else` dropdown.
2. **Fix `call_scene` inspector form** — scene picker dropdown.

Check the `audit_report.md` for the full prioritized list.
