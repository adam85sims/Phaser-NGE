# Phaser-NGE Memory & Decision Log

- *Gotcha:* The V2 editor backend relies on Vite dev-server plugins (`tools/editor-backend.js`) for things like `save` and `upload-asset`. This means right now it is coupled to Vite.
- *Decision:* Centralized backend API calls into `tools/shared/backend-adapter.js` to decouple the UI from raw `fetch` calls, preparing for an eventual Electron/desktop migration where IPC will be used.
- *Decision:* Replaced the hardcoded context menu in the visual node graph with a search palette (`Cmd+Space`) for better UX when adding nodes.
- *Gotcha:* The engine's starting scene is statically configured in `data/game.json` (`startScene`).
- *Decision:* To implement "Play from here", we write a debug target `{"sceneId", "nodeId"}` into `localStorage` (`nge_debug_start`) before opening a new window. `BootScene` intercepts this, parses it, and launches directly into `GameScene` with the debug parameters, bypassing the normal menu loop.
- *Gotcha:* Editor V2 `inspector.js` had incomplete DOM handling for `choice` nodes (it was just hardcoded to `...` for the choice list). We had to port choice list management (adding/removing branches, updating text/conditions/weights) over from the legacy standalone dialogue editor.
- *Gotcha:* Background rendering bug — `SceneController.onSceneStart` was not passing `layers` to GameScene. Scene data uses a `layers` array (new system) while legacy `background` field can be null. Without forwarding `layers`, `loadSceneLayers(undefined, null)` fell back to a gradient. Fix: add `layers: scene.layers` to both `onSceneStart` call sites in `SceneController.js`.

- *Gotcha:* Vite intercepts 404s and serves `index.html`. If the engine fetches a missing JSON file (like a deleted scene that is still listed in `game.json`), `r.ok` is still `true`, but parsing `r.json()` throws a SyntaxError (`Unexpected token '<'`).
- *Decision:* Wrapped the `fetch` calls in `BootScene` with a `safeFetchJson` that checks if the response text starts with `<` (HTML) and gracefully ignores it rather than crashing the game.
- *Decision:* Converted hardcoded Menu and Splash scenes into data-driven UI layouts powered by `data/theme.json` (`ui.menu` and `ui.splash`). Created visual drag-and-drop editors for these, providing a scalable foundation for a generic UI Builder.
