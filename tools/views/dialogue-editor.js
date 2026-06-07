/**
 * Dialogue Editor — Launch the standalone node graph editor.
 * The editor lives at /tools/dialogue-editor/ as a full-page app.
 * This view embeds it in an iframe and syncs project state via postMessage.
 */
export function init(app) {}

export function render(container, app) {
  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h1>Dialogue Editor</h1>
        <p>Visual node graph editor for branching dialogue trees</p>
      </div>
      <a href="../tools/dialogue-editor/" target="_blank" class="btn btn-primary btn-sm">↗ Open in new tab</a>
    </div>

    <div style="position:relative;width:100%;height:calc(100vh - 180px);border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <iframe
        id="dialogue-editor-frame"
        src="../tools/dialogue-editor/"
        style="width:100%;height:100%;border:none;background:#0a0a14"
        title="Dialogue Editor"
      ></iframe>
    </div>

    <div class="hint-box mt-8">
      <strong>Using the Dialogue Editor:</strong><br>
      • <strong>Drag nodes</strong> to rearrange the graph layout<br>
      • <strong>Click a node</strong> to edit its properties in the right panel<br>
      • <strong>Drag from output ports</strong> (right circles) to connect nodes<br>
      • <strong>Scene dropdown</strong> in the toolbar switches between scenes<br>
      • <strong>Export</strong> saves your scene as a <code>.json</code> file to place in <code>data/scenes/</code><br>
      • See the <a href="../tools/dialogue-editor/SKILL.md" target="_blank">Editor SKILL.md</a> for full documentation
    </div>
  `;

  // Sync project state to the iframe once it loads
  const iframe = document.getElementById('dialogue-editor-frame');
  if (iframe) {
    const onLoad = () => {
      // Build a snapshot of the current project state from the app
      const scenes = {};
      for (const [id, entry] of Object.entries(app.data.scenes || {})) {
        scenes[id] = entry.data;
      }
      const msg = {
        type: 'project-state',
        game: app.data.game,
        characters: app.data.characters,
        variables: app.data.variables,
        scenes
      };
      try {
        iframe.contentWindow.postMessage(msg, '*');
      } catch (e) {
        // Cross-origin or iframe not ready — ignore
      }
    };
    iframe.addEventListener('load', onLoad);
  }
}
