# UI Alignment Issue (Windowed Mode)

## Problem Description
When the game runs in a windowed (non-fullscreen) mode, the HTML DOM elements (used for rendering the dialogue text) do not correctly align with the Phaser canvas graphics (used for the dialogue box background). In fullscreen mode, the alignment is perfect.

## Context
- We added `position: relative` to `#game-container` in `index.html` to fix the absolute positioning offset of Phaser's DOM container.
- We added `.setScrollFactor(0)` to the `DialogueSystem`'s UI elements (`container` and `textDOM`) to prevent camera movement from affecting them.
- Phaser's ScaleManager is configured with `mode: Phaser.Scale.FIT` and `autoCenter: Phaser.Scale.CENTER_BOTH`. 
- The text is rendered using an HTML `<div>` via `this.scene.add.dom()`. The background is a WebGL/Canvas `Phaser.GameObjects.Graphics` object.

## Potential Causes to Investigate
1. **DOM Container Scaling**: While the canvas is scaled down to fit the window (`FIT` mode), the CSS transform applied to the `Phaser.GameObjects.DOMElement` by the ScaleManager might not perfectly match the aspect ratio padding or offset.
2. **Padding/Margin Issues**: The CSS `transform: matrix(...)` applied by Phaser might be calculating `0,0` coordinates from the window rather than the correctly scaled bounds of the canvas, especially when resizing the window.
3. **Electron DPI Scaling**: The user was running the Electron app (`VITE_ELECTRON=true`), which might have OS-level DPI scaling issues on Linux vs. Windows.

## Next Steps
- Reproduce on Windows to confirm behavior.
- Check the CSS properties dynamically applied to `div.phaser-dom-container` during window resize.
- Consider using a `Resize` event listener to force DOM realignment if Phaser's auto-scale lags.
