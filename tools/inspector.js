import { editorState, markDirty } from './state.js';
import { backend } from './shared/backend-adapter.js';

const TYPE_LABELS = { dialogue: 'Dialogue', choice: 'Choice', condition: 'Condition', event: 'Event', call_scene: 'Call Scene', wait: 'Wait', end: 'End', set_variable: 'Set Variable', timed_choice: 'Timed Choice', random_branch: 'Random Branch' };

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
        <div class="form-row"><div class="form-group"><label>Z-Index</label><input type="number" value="${node.zIndex??0}" data-field="zIndex" data-type="number"/></div></div>
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
        <div id="choice-list"></div>
        <button class="add-btn" id="add-choice-btn">+ Add Choice</button></div>`;
      break;
    case 'timed_choice':
      html += `<div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||5000}" data-field="duration" data-type="number"/></div>
        <div class="form-group"><label>Default Next</label><select data-field="default_next"><option value="">— none —</option>${nodeOpts}</select></div></div>
        <div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/</g,'&lt;')}" data-field="prompt"/></div>
        <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
        <label>Choices (${(node.choices||[]).length})</label>
        <div id="choice-list"></div>
        <button class="add-btn" id="add-choice-btn">+ Add Choice</button></div>`;
      break;
    case 'random_branch':
      html += `<div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
        <label>Branches (${(node.choices||[]).length})</label>
        <div id="choice-list"></div>
        <button class="add-btn" id="add-choice-btn">+ Add Branch</button></div>`;
      break;
    case 'set_variable':
      html += `<div class="form-group"><label>Variable</label><select data-field="variable">
        <option value="">— select —</option>${varOpts}</select></div>
        <div class="form-group"><label>Value</label><input value="${node.value||''}" data-field="value"/></div>
        <div class="form-group"><label>Operation</label><select data-field="operation">
          <option value="set"${node.operation==='set'?' selected':''}>Set</option>
          <option value="add"${node.operation==='add'?' selected':''}>Add</option>
          <option value="toggle"${node.operation==='toggle'?' selected':''}>Toggle</option>
        </select></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'condition':
      html += `<div class="form-group"><label>Condition Expression</label><input value="${(node.condition||'').replace(/"/g,'&quot;')}" data-field="condition" placeholder="e.g. flag == true"/></div>
        <div class="form-row">
          <div class="form-group"><label>True (Next)</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
          <div class="form-group"><label>False (Else)</label><select data-field="else"><option value="">— none —</option>${nodeOpts.replace(/data-field="next"/g, 'data-field="else"')}</select></div>
        </div>`;
      break;
    case 'call_scene': {
      const targetSceneId = node.sceneId;
      const targetScene = editorState.scenes[targetSceneId];
      const targetNodes = targetScene?.nodes || [];
      const nodeOpts2 = targetNodes.map(n => `<option value="${n.id}"${node.nodeId === n.id ? ' selected' : ''}>${n.id}</option>`).join('');
      html += `
        <div class="form-group"><label>Target Scene</label><select data-field="sceneId">
          <option value="">— none —</option>${(editorState.gameConfig?.scenes||[]).map(s => `<option value="${s}"${node.sceneId===s?' selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Start Node</label><select data-field="nodeId">
          <option value="">— entry point —</option>${nodeOpts2}
        </select></div>
        <div class="form-group"><label>Next (Return)</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    }
    case 'event': {
      const evType = node.eventType || 'bgm';
      const isBGM  = evType === 'bgm';
      const isSFX  = evType === 'sfx';
      const isBG   = evType === 'bg_change';
      const isStop = evType === 'bgm_stop';
      const isCam  = evType === 'camera_shake' || evType === 'camera_flash';
      const isAnim = evType === 'play_animation';

      // Volume field for audio events
      const volVal = node.eventVolume != null ? node.eventVolume : 1.0;
      const volRow = (isBGM || isSFX) ? `
        <div class="form-group">
          <label>Volume</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="range" min="0" max="1" step="0.05" value="${volVal}" data-field="eventVolume" data-type="number" style="flex:1" />
            <span id="ev-vol-label" style="font-size:11px;width:30px;text-align:right">${Math.round(volVal*100)}%</span>
          </div>
        </div>` : '';

      // Camera value hint
      const camPlaceholder = evType === 'camera_shake' ? 'duration,intensity e.g. 500,0.01' : 'r,g,b e.g. 255,255,255';

      html += `
        <div class="form-group"><label>Event Type</label><select data-field="eventType" id="ev-type-select">
          <option value="bgm"${isBGM?' selected':''}>🎵 Play BGM</option>
          <option value="bgm_stop"${isStop?' selected':''}>⏹ Stop BGM</option>
          <option value="sfx"${isSFX?' selected':''}>🔊 Play SFX</option>
          <option value="bg_change"${isBG?' selected':''}>🖼️ Change Background</option>
          <option value="camera_shake"${evType==='camera_shake'?' selected':''}>📳 Camera Shake</option>
          <option value="camera_flash"${evType==='camera_flash'?' selected':''}>✨ Camera Flash</option>
          <option value="play_animation"${isAnim?' selected':''}>🎬 Play Animation</option>
        </select></div>

        <div id="ev-value-section">
          ${(isBGM || isSFX) ? `
            <div class="form-group">
              <label>${isBGM ? 'BGM Track' : 'SFX Clip'}</label>
              <select data-field="eventValue" id="ev-asset-select">
                <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
              </select>
            </div>
            ${volRow}` : ''}
          ${isBG ? `
            <div class="form-group">
              <label>Background</label>
              <select data-field="eventValue" id="ev-asset-select">
                <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
              </select>
            </div>` : ''}
          ${isCam ? `
            <div class="form-group">
              <label>Value</label>
              <input value="${node.eventValue||''}" data-field="eventValue" placeholder="${camPlaceholder}" />
            </div>` : ''}
          ${isAnim ? `
            <div class="form-group">
              <label>Target (Layer/Char ID)</label>
              <input value="${node.eventTarget||''}" data-field="eventTarget" placeholder="e.g. dave" />
            </div>
            <div class="form-group">
              <label>Animation Key</label>
              <select data-field="eventValue" id="ev-asset-select">
                <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
              </select>
            </div>` : ''}
        </div>

        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    }
    case 'animate':
      html += `<div class="form-row"><div class="form-group"><label>Target</label><input value="${node.target||''}" data-field="target"/></div>
        <div class="form-group"><label>Property</label><select data-field="property">
          <option value="x"${node.property==='x'?' selected':''}>X Position</option>
          <option value="y"${node.property==='y'?' selected':''}>Y Position</option>
          <option value="alpha"${node.property==='alpha'?' selected':''}>Alpha (Opacity)</option>
          <option value="scale"${node.property==='scale'?' selected':''}>Scale</option>
          <option value="angle"${node.property==='angle'?' selected':''}>Angle</option>
          <option value="zoom"${node.property==='zoom'?' selected':''}>Zoom (Camera)</option>
        </select></div></div>
        <div class="form-row"><div class="form-group"><label>Value</label><input type="number" value="${node.value||0}" data-field="value" data-type="number"/></div>
        <div class="form-group"><label>Duration</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div></div>
        <div class="form-row"><div class="form-group"><label>Easing</label><select data-field="easing">
          <option value="Linear"${node.easing==='Linear'?' selected':''}>Linear</option>
          <option value="Sine.easeInOut"${node.easing==='Sine.easeInOut'?' selected':''}>Smooth In/Out</option>
          <option value="Bounce.easeOut"${node.easing==='Bounce.easeOut'?' selected':''}>Bounce</option>
        </select></div>
        <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'show_object':
    case 'hide_object':
      html += `<div class="form-group"><label>Target (ID)</label><input value="${node.target||''}" data-field="target"/></div>
        <div class="form-row"><div class="form-group"><label>Fade Duration (ms)</label><input type="number" value="${node.duration||0}" data-field="duration" data-type="number"/></div>
        <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'camera':
      html += `<div class="form-row"><div class="form-group"><label>Action</label><select data-field="action">
          <option value="shake"${node.action==='shake'?' selected':''}>Shake</option>
          <option value="flash"${node.action==='flash'?' selected':''}>Flash</option>
          <option value="fade_in"${node.action==='fade_in'?' selected':''}>Fade In</option>
          <option value="fade_out"${node.action==='fade_out'?' selected':''}>Fade Out</option>
          <option value="zoom"${node.action==='zoom'?' selected':''}>Zoom</option>
          <option value="pan"${node.action==='pan'?' selected':''}>Pan</option>
        </select></div>
        <div class="form-group"><label>Value</label><input value="${node.value||''}" data-field="value" placeholder="e.g. 0.05 or 400,300"/></div></div>
        <div class="form-row"><div class="form-group"><label>Duration</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div>
        <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
        <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'wait':
      html += `<div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div></div>
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
  // Render choices if applicable
  const choiceList = container.querySelector('#choice-list');
  if (choiceList) {
    const renderChoices = () => {
      if (!node.choices) node.choices = [];
      let chtml = '';
      node.choices.forEach((c, i) => {
        const isRandom = node.type === 'random_branch';
        chtml += `<div style="background:var(--bg-elevated);border-radius:4px;padding:6px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:bold">${isRandom ? 'Branch' : 'Choice'} ${i+1}</span>
            <button class="icon-btn-sm" data-del-choice="${i}" style="color:#ef4444;font-size:10px">✕</button>
          </div>
          ${!isRandom ? `<div class="form-group"><input placeholder="Text..." value="${(c.text||'').replace(/</g,'&lt;')}" data-choice-idx="${i}" data-choice-field="text" style="font-size:11px;padding:4px"/></div>` : ''}
          ${isRandom ? `<div class="form-group"><label>Weight</label><input type="number" value="${c.weight||1}" data-choice-idx="${i}" data-choice-field="weight" style="font-size:11px;padding:4px"/></div>` : ''}
          ${!isRandom ? `<div class="form-group"><label>Condition</label><input placeholder="e.g. rep > 5" value="${(c.condition||'').replace(/</g,'&lt;')}" data-choice-idx="${i}" data-choice-field="condition" style="font-size:11px;padding:4px"/></div>` : ''}
          <div class="form-group"><label>Next</label><select data-choice-idx="${i}" data-choice-field="next" style="font-size:11px;padding:4px">
            <option value="">— none —</option>
            ${(sceneData?.nodes||[]).filter(n => n.id !== node.id).map(n => `<option value="${n.id}"${c.next===n.id?' selected':''}>${n.id}</option>`).join('')}
          </select></div>
        </div>`;
      });
      choiceList.innerHTML = chtml;
      
      // Bind choice fields
      choiceList.querySelectorAll('[data-choice-field]').forEach(el => {
        el.addEventListener('change', (e) => {
          const idx = parseInt(el.dataset.choiceIdx);
          let val = e.target.value;
          if (el.type === 'number') val = Number(val);
          node.choices[idx][el.dataset.choiceField] = val;
          markDirty();
          window.dispatchEvent(new CustomEvent('editor:render'));
        });
      });

      // Bind choice delete
      choiceList.querySelectorAll('[data-del-choice]').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.delChoice);
          node.choices.splice(idx, 1);
          markDirty();
          renderChoices();
          window.dispatchEvent(new CustomEvent('editor:render'));
        });
      });
    };
    renderChoices();

    container.querySelector('#add-choice-btn')?.addEventListener('click', () => {
      if (!node.choices) node.choices = [];
      node.choices.push(node.type === 'random_branch' ? { weight: 1, next: '' } : { text: 'New Choice', condition: '', next: '' });
      markDirty();
      renderChoices();
      window.dispatchEvent(new CustomEvent('editor:render'));
    });
  }

  // ── Event node: async asset hydration ───────────────────────────
  if (node.type === 'event') {
    // Live volume label
    const volRange = container.querySelector('input[data-field="eventVolume"]');
    const volLabel = container.querySelector('#ev-vol-label');
    if (volRange && volLabel) {
      volRange.addEventListener('input', () => {
        volLabel.textContent = `${Math.round(volRange.value * 100)}%`;
        node.eventVolume = Number(volRange.value);
        markDirty();
      });
    }

    // When event type changes: re-render inspector to show appropriate value fields
    const evTypeSelect = container.querySelector('#ev-type-select');
    if (evTypeSelect) {
      evTypeSelect.addEventListener('change', () => {
        node.eventType = evTypeSelect.value;
        node.eventValue = '';
        markDirty();
        // Full re-render so the value section updates
        window.dispatchEvent(new CustomEvent('inspector:refresh'));
      });
    }

    // Hydrate asset dropdown from backend
    const assetSelect = container.querySelector('#ev-asset-select');
    if (assetSelect) {
      backend.listAssets().then(assets => {
        const evType = node.eventType || 'bgm';
        let items = [];
        if (evType === 'bgm')      items = (assets.music      || []).map(f => f.name.replace(/\.[^.]+$/, ''));
        else if (evType === 'sfx') items = (assets.sfx        || []).map(f => f.name.replace(/\.[^.]+$/, ''));
        else if (evType === 'bg_change') items = (assets.backgrounds || []).map(f => f.name.replace(/\.[^.]+$/, ''));

        const current = node.eventValue || '';
        assetSelect.innerHTML = `<option value="">— select —</option>` +
          items.map(k => `<option value="${k}"${k === current ? ' selected' : ''}>${k}</option>`).join('');

        // Re-bind change since we replaced innerHTML
        assetSelect.addEventListener('change', () => {
          node.eventValue = assetSelect.value;
          markDirty();
          window.dispatchEvent(new CustomEvent('editor:render'));
        });
      }).catch(() => {
        // If asset listing fails, fall back to a plain text input
        if (assetSelect.parentElement) {
          const fallback = document.createElement('input');
          fallback.value = node.eventValue || '';
          fallback.dataset.field = 'eventValue';
          fallback.placeholder = 'Enter asset key…';
          fallback.addEventListener('change', () => {
            node.eventValue = fallback.value;
            markDirty();
          });
          assetSelect.replaceWith(fallback);
        }
      });
    }
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
