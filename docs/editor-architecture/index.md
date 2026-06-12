# Phaser-NGE Editor v2 — Architecture Spec

**Status:** Design phase — define before implementing.
**Scope:** Editor tools only. The engine runtime (`src/`) is mature.
**Pattern:** Plugin-like modules with explicit contracts. No plugin framework — just a convention and a thin shell.

---

## Table of Contents

1. [Principles & Terminology](principles.md)
2. [Shell / Workspace](shell.md) — the structural skeleton
3. [Module Contract](module-contract.md) — what every module must export
4. [State Management](state.md) — scoped state, event bus, subscriptions
5. [Module: Scene Composer](modules/scene-composer.md) — layer stack, preview canvas, transforms
6. [Module: Node Graph](modules/node-graph.md) — narrative flow editor
7. [Module: Inspector](modules/inspector.md) — context-sensitive property editor
8. [Module: Asset Browser](modules/asset-browser.md) — media grid, import, drag
9. [Module: File Browser](modules/file-browser.md) — folder tree, file listing
10. [Module: Character Manager](modules/character-manager.md) — portraits, expressions, metadata
11. [Module: Variable Manager](modules/variable-editor.md) — flag/counter definitions
12. [Module: Scene Manager](modules/scene-manager.md) — scene list, creation, deletion
13. [Module: Dialogue Editor](modules/dialogue-editor.md) — content writing panel
14. [Module: Menu Editor](modules/menu-editor.md) — main menu configuration
15. [Module: Splash Editor](modules/splash-editor.md) — splash screen configuration
16. [Module: Script Editor](modules/script-editor.md) — inline code editing
17. [Module: Settings](modules/settings.md) — editor preferences
18. [Data Flow](data-flow.md) — file I/O, save/loss, dirty tracking
19. [Backend Services](backend.md) — Vite plugin, save API, asset API
20. [Editor Modes](modes.md) — Scene / Menu / Splash / Script
21. [Migration Plan](migration.md) — phased refactor from current state
