/**
 * Dialogue Editor — Embedded node graph editor.
 * The full editor runs inline (no iframe) so there's a single save flow
 * through the parent app's save button. No postMessage bridge needed.
 */
export function init(app) {}

export function render(container, app) {
  // Expand content area — override #content padding/overflow so the editor
  // fills the full viewport. Restored in destroy().
  container.style.padding = '0';
  container.style.overflow = 'hidden';

  // Load the editor's stylesheet
  if (!document.getElementById('dialogue-editor-css')) {
    const link = document.createElement('link');
    link.id = 'dialogue-editor-css';
    link.rel = 'stylesheet';
    link.href = '../tools/dialogue-editor/editor.css';
    document.head.appendChild(link);
  }

  container.innerHTML = `
    <div id="editor-shell" style="display:flex;flex-direction:column;height:100%">
      <!-- Toolbar (no Save button — top bar handles it) -->
      <div id="toolbar" style="padding:6px 12px;display:flex;align-items:center;gap:8px;background:var(--panel);border-bottom:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">
        <span style="font-weight:700;font-size:14px;color:var(--accent);margin-right:12px">◆ Dialogue Editor</span>
        <select id="scene-select" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px"></select>
        <button id="btn-new-scene" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">+ New</button>
        <button id="btn-delete-scene" class="danger" style="background:#1e1e32;color:#ef4444;border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">Delete</button>
        <div style="flex:1"></div>
        <button id="btn-add-node" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">+ Node</button>
        <button id="btn-auto-layout" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">⟐ Auto Layout</button>
        <button id="btn-fit-view" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">⊡ Fit</button>
        <button id="btn-preview" style="background:#1e1e32;color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">☰ Preview</button>
        <span class="status" id="status" style="font-size:11px;color:var(--text-dim)">
          <span class="dot saved" id="status-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:4px"></span>
          <span id="status-text">Ready</span>
        </span>
      </div>

      <!-- Main layout -->
      <div style="display:flex;flex:1;overflow:hidden;min-height:0">
        <!-- Left: Node List -->
        <div id="node-list" style="width:200px;background:var(--panel);border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0">
          <div class="header" style="padding:8px 10px;font-size:11px;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span>Nodes</span>
            <button id="btn-list-add-node" style="background:none;border:1px solid var(--border);color:var(--text);border-radius:3px;padding:2px 6px;font-size:11px;cursor:pointer">+</button>
          </div>
          <div id="node-list-items"></div>
        </div>

        <!-- Center: Graph Canvas -->
        <div id="graph" style="flex:1;position:relative;overflow:hidden;background:#0a0a14">
          <canvas id="graph-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:grab"></canvas>
          <div class="graph-controls" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;z-index:20">
            <button id="btn-zoom-in" style="background:#1e1e32;border:1px solid var(--border);color:var(--text);border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer">+</button>
            <button id="btn-zoom-out" style="background:#1e1e32;border:1px solid var(--border);color:var(--text);border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer">−</button>
            <button id="btn-fit" style="background:#1e1e32;border:1px solid var(--border);color:var(--text);border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer">⊡</button>
          </div>
        </div>

        <!-- Right: Node Editor (slightly thinner) -->
        <div id="node-editor" style="width:280px;background:var(--panel);border-left:1px solid var(--border);overflow-y:auto;flex-shrink:0">
          <div class="header" style="padding:8px 12px;font-size:11px;text-transform:uppercase;color:var(--text-dim);border-bottom:1px solid var(--border)">Node Properties</div>
          <div id="editor-content"><div class="empty" style="padding:24px 12px;color:var(--text-dim);text-align:center;font-style:italic">Select a node to edit</div></div>
        </div>
      </div>

      <!-- Preview -->
      <div id="preview" style="height:0;background:var(--panel);border-top:1px solid var(--border);overflow:hidden;transition:height 0.2s;flex-shrink:0">
        <div class="header" style="display:flex;justify-content:space-between;align-items:center;padding:4px 12px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border)">
          <span>Preview</span>
          <button id="btn-close-preview" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:11px">✕</button>
        </div>
        <div id="preview-box" style="position:absolute;top:28px;left:0;right:0;bottom:0;margin:0;background:#000;border:none;border-radius:0;overflow:hidden">
          <div id="preview-speaker" style="font-size:12px;font-weight:600;margin-bottom:4px"></div>
          <div id="preview-text" style="font-size:14px;font-family:'Courier New',monospace;line-height:1.5;color:#d0d0d8"></div>
        </div>
      </div>
    </div>
  `;

  // Prepare the editor bridge: pass project data and a save callback
  // instead of using the postMessage iframe bridge
  window.__editorBridge = {
    app,
    onSave: (sceneId, sceneData) => {
      // Update app.data directly
      if (!app.data.scenes) app.data.scenes = {};
      if (!app.data.scenes[sceneId]) {
        app.data.scenes[sceneId] = { data: sceneData };
      } else {
        app.data.scenes[sceneId].data = sceneData;
      }
      // Mark project dirty — top bar save handles persistence
      if (window.__markProjectDirty) {
        window.__markProjectDirty();
      }
    }
  };

  // Load the editor script — it will detect __editorBridge and skip postMessage
  if (!document.getElementById('dialogue-editor-script')) {
    const script = document.createElement('script');
    script.id = 'dialogue-editor-script';
    script.src = '../tools/dialogue-editor/editor.js';
    container.appendChild(script);
  }
}

export function destroy() {
  // Restore content area padding when leaving the editor view
  const container = document.getElementById('content');
  if (container) {
    container.style.padding = '';
    container.style.overflow = '';
  }
  // Clean up the editor script so it re-inits fresh next time
  const script = document.getElementById('dialogue-editor-script');
  if (script) script.remove();
  const css = document.getElementById('dialogue-editor-css');
  if (css) css.remove();
  delete window.__editorBridge;
}
