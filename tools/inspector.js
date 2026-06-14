import { editorState, markDirty } from './state.js';
import { backend } from './shared/backend-adapter.js';
import { Registry } from '../src/systems/Registry.js';

export function renderInspectorContent(container) {
  // Handle layer selection
  if (editorState.selectedItemType === 'layer') {
    renderLayerInspector(container);
    return;
  }
  
  // Handle node selection (existing)
  if (editorState.selectedItemType !== 'node' || !editorState.selectedItemId) {
    container.innerHTML = `<div style="padding:10px; color:var(--text-muted); text-align:center">Select an item</div>`;
    return;
  }

  const sceneData = editorState.scenes[editorState.activeSceneId];
  const node = sceneData?.nodes?.find(n => n.id === editorState.selectedItemId);
  if (!node) return;

  const typeDef = Registry.getNodeType(node.type);

  let html = `
    <div class="inspector-section">
      <div class="section-header"><span>Transform</span></div>
      <div class="section-body">
        <div class="form-row">
          <div class="form-group">
            <label>X</label>
            <input type="number" value="${node.x ?? 0}" data-field="x" data-type="number" />
          </div>
          <div class="form-group">
            <label>Y</label>
            <input type="number" value="${node.y ?? 0}" data-field="y" data-type="number" />
          </div>
        </div>
      </div>
    </div>
    <div class="inspector-section">
      <div class="section-body">
        <div class="form-group">
          <label>Node ID</label>
          <input type="text" class="obj-name" value="${node.id}" data-field="id" />
        </div>
        <div class="form-group">
          <label>Type</label>
          <select data-field="type">
            ${Registry.getAllNodeTypes().map(t => `<option value="${t.id}"${node.type===t.id?' selected':''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Comment (internal)</label>
          <textarea style="height:40px;opacity:0.7;font-size:11px" placeholder="Writer's notes..." data-field="comment">${(node.comment||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>
    </div>
    <div class="inspector-section">
      <div class="section-header"><span>Properties</span></div>
      <div class="section-body">
  `;

  const ctx = {
    characters: editorState.characters,
    variableDefs: editorState.variableDefs,
    scenesObj: editorState.scenes,
    scenesList: editorState.gameConfig?.scenes || [],
    otherNodes: (sceneData?.nodes||[]).filter(n => n.id !== node.id),
    backend
  };

  if (typeDef && typeDef.renderEditor) {
    html += typeDef.renderEditor(node, ctx);
  } else {
    html += `<div style="padding:10px; color:#f87171">No editor defined for type ${node.type}</div>`;
  }

  html += `</div></div>`;
  container.innerHTML = html;

  // Bind change events
  container.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('change', (e) => {
      let val = e.target.value;
      if (el.dataset.type === 'number') val = Number(val);
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      
      const field = el.dataset.field;
      if (field === 'id') {
        const oldId = node.id;
        node.id = val;
        // update connections
        sceneData.nodes.forEach(n => {
          if (n.next === oldId) n.next = val;
          if (n.else === oldId) n.else = val;
        });
        editorState.selectedItemId = val;
      } else {
        node[field] = val;
      }
      markDirty();
      window.dispatchEvent(new CustomEvent('editor:render'));
    });
  });

  if (typeDef && typeDef.bindEditor) {
    typeDef.bindEditor(node, container, ctx, {
      markDirty,
      dispatchRender: () => window.dispatchEvent(new CustomEvent('editor:render'))
    });
  }
}

/* ─── LAYER INSPECTOR ─────────────────────────── */

/**
 * Render inspector content for a visual layer (background, character, prop).
 */
function renderLayerInspector(container) {
  const sceneData = editorState.scenes[editorState.activeSceneId];
  const layer = sceneData?.layers?.find(l => l.id === editorState.selectedItemId);
  if (!layer) {
    container.innerHTML = `<div style="padding:10px; color:var(--text-muted); text-align:center">Layer not found</div>`;
    return;
  }

  const isBackground = layer.type === 'background';
  const typeIcons = { background: '🖼️', character: '👤', prop: '📦' };

  let html = `
    <div class="inspector-section">
      <div class="section-header" style="display:flex;align-items:center;gap:6px">
        <span>${typeIcons[layer.type] || '📄'}</span>
        <span>Layer — ${layer.type}</span>
      </div>
      <div class="section-body">
        <div class="form-group">
          <label>Type</label>
          <select data-field="type" data-layer="true">
            <option value="background" ${layer.type === 'background' ? 'selected' : ''}>Background</option>
            <option value="character" ${layer.type === 'character' ? 'selected' : ''}>Character</option>
            <option value="prop" ${layer.type === 'prop' ? 'selected' : ''}>Prop</option>
          </select>
        </div>
        <div class="form-group">
          <label>Asset Key</label>
          <input type="text" value="${layer.asset || ''}" data-field="asset" data-layer="true" placeholder="e.g. lakeside_sunset" />
        </div>
      </div>
    </div>

    <div class="inspector-section">
      <div class="section-header"><span>Scripts</span></div>
      <div class="section-body">
        <div id="inspector-scripts" style="min-height:40px;border:1px dashed var(--border);border-radius:4px;padding:8px;margin-bottom:8px">
          ${(layer.scripts || []).map((s, idx) => `
            <div class="script-item" style="display:flex;justify-content:space-between;background:var(--bg-input);padding:4px 8px;margin-bottom:4px;border-radius:4px">
              <span style="font-size:11px">${s.split('/').pop()}</span>
              <button class="btn btn-sm" data-remove-script="${idx}" style="padding:0 4px">×</button>
            </div>
          `).join('')}
          ${(!layer.scripts || layer.scripts.length === 0) ? '<div class="text-dim" style="font-size:10px;text-align:center;margin-top:4px;pointer-events:none">Drag script files here</div>' : ''}
        </div>
      </div>
    </div>

    <div class="inspector-section">
      <div class="section-header"><span>Transform</span></div>
      <div class="section-body">
        <div class="form-row">
          <div class="form-group">
            <label>X</label>
            <input type="number" value="${layer.x ?? 0}" data-field="x" data-type="number" data-layer="true" />
          </div>
          <div class="form-group">
            <label>Y</label>
            <input type="number" value="${layer.y ?? 0}" data-field="y" data-type="number" data-layer="true" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Origin X</label>
            <input type="number" value="${layer.originX ?? 0.5}" data-field="originX" data-type="number" step="0.1" min="0" max="1" data-layer="true" />
          </div>
          <div class="form-group">
            <label>Origin Y</label>
            <input type="number" value="${layer.originY ?? 0.5}" data-field="originY" data-type="number" step="0.1" min="0" max="1" data-layer="true" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Scale</label>
            <input type="number" value="${layer.scale ?? 1}" data-field="scale" data-type="number" step="0.1" min="0.1" max="5" data-layer="true" />
          </div>
          <div class="form-group">
            <label>Rotation</label>
            <input type="number" value="${layer.rotation ?? 0}" data-field="rotation" data-type="number" step="15" data-layer="true" />
          </div>
          <div class="form-group">
            <label>Z-Index</label>
            <input type="number" value="${layer.zIndex ?? 0}" data-field="zIndex" data-type="number" data-layer="true" />
          </div>
        </div>
      </div>
    </div>

    <div class="inspector-section">
      <div class="section-header"><span>Appearance</span></div>
      <div class="section-body">
        <div class="form-group">
          <label>Opacity</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="range" min="0" max="1" step="0.05" value="${layer.opacity ?? 1}" data-field="opacity" data-type="number" data-layer="true" style="flex:1" />
            <span style="font-size:11px;width:30px;text-align:right">${Math.round((layer.opacity ?? 1) * 100)}%</span>
          </div>
        </div>
      </div>
    </div>

    <div class="inspector-section">
      <div class="section-body">
        <button class="btn btn-danger btn-sm" data-remove-layer="${layer.id}" style="width:100%;text-align:center">
          🗑 Remove Layer
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind change events for layer fields
  container.querySelectorAll('[data-field][data-layer]').forEach(el => {
    const updateLayerField = (isFinalChange) => {
      let val = el.value;
      if (el.dataset.type === 'number') val = Number(val);
      
      const field = el.dataset.field;
      layer[field] = val;
      
      // Sync opacity range display
      if (field === 'opacity') {
        const pct = el.parentElement?.querySelector('span');
        if (pct) pct.textContent = `${Math.round(val * 100)}%`;
      }
      
      // If asset changed, trigger scene preview update
      if (field === 'asset' || field === 'id') {
        window.dispatchEvent(new CustomEvent('scene:background-changed', { detail: { layer } }));
      }
      
      markDirty();
      
      // We do NOT want to tear down the inspector DOM while the user is typing in it
      // So on 'input' we just redraw the canvas. On 'change' (blur) we can do a full UI refresh.
      if (isFinalChange) {
        window.dispatchEvent(new CustomEvent('editor:render'));
      } else {
        // We only want to re-render the scene visually during live scrubbing
        window.dispatchEvent(new CustomEvent('scene:preview'));
      }
    };
    
    // Live preview on input (as you type)
    el.addEventListener('input', () => updateLayerField(false));
    // Also on change (blur/Enter) for completeness
    el.addEventListener('change', () => updateLayerField(true));
  });

  // Opacity range live update
  const opacityRange = container.querySelector('input[type="range"]');
  if (opacityRange) {
    opacityRange.addEventListener('input', (e) => {
      const pct = e.target.parentElement?.querySelector('span');
      if (pct) pct.textContent = `${Math.round(e.target.value * 100)}%`;
      layer.opacity = Number(e.target.value);
      window.dispatchEvent(new CustomEvent('scene:preview'));
    });
    opacityRange.addEventListener('change', (e) => {
      layer.opacity = Number(e.target.value);
      markDirty();
      window.dispatchEvent(new CustomEvent('editor:render'));
    });
  }

  // Scripts drag and drop
  const scriptsContainer = container.querySelector('#inspector-scripts');
  if (scriptsContainer) {
    scriptsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      scriptsContainer.style.background = 'var(--bg-input)';
    });
    scriptsContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      scriptsContainer.style.background = 'transparent';
    });
    scriptsContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      scriptsContainer.style.background = 'transparent';
      const scriptPath = e.dataTransfer.getData('text/plain');
      if (scriptPath && scriptPath.endsWith('.js')) {
        layer.scripts = layer.scripts || [];
        if (!layer.scripts.includes(scriptPath)) {
          layer.scripts.push(scriptPath);
          markDirty();
          window.dispatchEvent(new CustomEvent('editor:render'));
        }
      }
    });

    // Remove script buttons
    scriptsContainer.querySelectorAll('[data-remove-script]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.removeScript, 10);
        layer.scripts.splice(idx, 1);
        markDirty();
        window.dispatchEvent(new CustomEvent('editor:render'));
      });
    });
  }

  // Remove layer button
  container.querySelector('[data-remove-layer]')?.addEventListener('click', () => {
    import('./views/scene-composer.js').then(mod => {
      mod.removeLayer(layer.id);
      editorState.selectedItemId = null;
      editorState.selectedItemType = null;
      markDirty();
      window.dispatchEvent(new CustomEvent('editor:render'));
    });
  });
}
