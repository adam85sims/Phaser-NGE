import { editorState, markDirty } from './state.js';

const TYPE_LABELS = { dialogue: 'Dialogue', choice: 'Choice', condition: 'Condition', event: 'Event', call_scene: 'Call Scene', wait: 'Wait', end: 'End' };

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

  const speakerOpts = Object.keys(editorState.characters || {}).map(k =>
    `<option value="${k}"${node.speaker===k?' selected':''}>${editorState.characters[k]?.name||k}</option>`
  ).join('');
  const varOpts = Object.keys(editorState.variableDefs || {}).map(k =>
    `<option value="${k}">${k}</option>`
  ).join('');
  const nodeOpts = (sceneData?.nodes||[]).filter(n => n.id !== node.id).map(n =>
    `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`
  ).join('');

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
            ${Object.entries(TYPE_LABELS).map(([k,v]) => `<option value="${k}"${node.type===k?' selected':''}>${v}</option>`).join('')}
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

  switch (node.type) {
    case 'dialogue':
      html += `<div class="form-group"><label>Speaker</label><select data-field="speaker">
        <option value="">(narration)</option>${speakerOpts}</select></div>
        <div class="form-group"><label>Expression</label><input value="${node.expression||''}" data-field="expression"/></div>
        <div class="form-group"><label>Text</label><textarea data-field="text">${(node.text||'').replace(/</g,'&lt;')}</textarea></div>
        <div class="form-row"><div class="form-group"><label>Auto</label><select data-field="autoAdvance">
          <option value="false">No</option><option value="true"${node.autoAdvance?' selected':''}>Yes</option></select></div>
        <div class="form-group"><label>Wait ms</label><input type="number" value="${node.waitTime||2000}" data-field="waitTime" data-type="number"/></div></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'choice':
      html += `<div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/</g,'&lt;')}" data-field="prompt"/></div>
        <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
        <label>Choices (${(node.choices||[]).length})</label>
        <div id="choice-list">...</div>
        <button class="add-btn">+ Add Choice</button></div>`;
      break;
    case 'event':
      html += `<div class="form-group"><label>Event Type</label><select data-field="eventType">
        <option value="sfx"${node.eventType==='sfx'?' selected':''}>Play SFX</option>
        <option value="bgm"${node.eventType==='bgm'?' selected':''}>Play BGM</option>
        <option value="camera_shake"${node.eventType==='camera_shake'?' selected':''}>Camera Shake</option>
        <option value="camera_flash"${node.eventType==='camera_flash'?' selected':''}>Camera Flash</option>
        <option value="bg_change"${node.eventType==='bg_change'?' selected':''}>Background</option></select></div>
        <div class="form-group"><label>Value</label><input value="${node.eventValue||''}" data-field="eventValue"/></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'end':
      html += `<div class="form-group"><label>Ending text</label><input value="${(node.text||'').replace(/</g,'&lt;')}" data-field="text"/></div>
        <div class="form-group"><label>Next scene</label><select data-field="nextScene">
          <option value="">— end —</option>${(editorState.gameConfig?.scenes||[]).map(s => `<option value="${s}"${node.nextScene===s?' selected':''}>${s}</option>`).join('')}
        </select></div>`;
      break;
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
          <label>Layer ID</label>
          <input type="text" class="obj-name" value="${layer.id}" data-field="id" data-layer="true" />
        </div>
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
            <label>Scale</label>
            <input type="number" value="${layer.scale ?? 1}" data-field="scale" data-type="number" step="0.1" min="0.1" max="5" data-layer="true" />
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
    const updateLayerField = () => {
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
      window.dispatchEvent(new CustomEvent('editor:render'));
    };
    
    // Live preview on input (as you type)
    el.addEventListener('input', updateLayerField);
    // Also on change (blur/Enter) for completeness
    el.addEventListener('change', updateLayerField);
  });

  // Opacity range live update
  container.querySelector('input[type="range"]')?.addEventListener('input', (e) => {
    const pct = e.target.parentElement?.querySelector('span');
    if (pct) pct.textContent = `${Math.round(e.target.value * 100)}%`;
    layer.opacity = Number(e.target.value);
    window.dispatchEvent(new CustomEvent('editor:render'));
  });

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
