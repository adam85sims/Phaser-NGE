/**
 * Characters — Full character manager with CRUD, expressions,
 * color picker, portrait preview, usage tracking, and export.
 */
let _app = null;
let _container = null;
let _state = { characters: {}, selectedId: null, usageCache: {}, previews: {} };

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _container = container;
  _state.characters = JSON.parse(JSON.stringify(app.data.characters || {}));
  for (const c of Object.values(_state.characters)) {
    delete c.portraitPreview;
  }
  // Restore selection from app data, or pick first
  _state.selectedId = app.data._charSelectedId || null;
  const keys = Object.keys(_state.characters);
  if (!_state.selectedId || !_state.characters[_state.selectedId]) {
    _state.selectedId = keys[0] || null;
  }
  app.data._charSelectedId = _state.selectedId;
  _buildUsage();

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Characters</h1>
        <p id="char-subtitle">${Object.keys(_state.characters).length} character${Object.keys(_state.characters).length !== 1 ? 's' : ''} defined</p>
      </div>
      <button class="btn btn-sm" onclick="window.__charAdd()">+ Add Character</button>
    </div>

    <div style="display:flex;gap:20px;flex:1;min-height:400px">
      ${_renderSidebar()}
      ${_renderEditor()}
    </div>

    <div id="char-status" class="text-dim" style="font-size:11px;margin-top:8px"></div>
  `;
}

/* ─── SIDEBAR ──────────────────────────────────── */

function _renderSidebar() {
  const entries = Object.entries(_state.characters);
  return `
    <div style="width:220px;flex-shrink:0;border-right:1px solid var(--border);padding-right:12px;overflow-y:auto">
      ${entries.map(([id, c]) => `
        <div class="char-list-item ${id === _state.selectedId ? 'char-list-item-active' : ''}"
             onclick="window.__charSelect('${id}')"
             style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:4px;cursor:pointer;margin-bottom:2px;transition:all 0.15s ease;${id === _state.selectedId ? 'background:var(--accent-glow);border:1px solid var(--border)' : ''}">
          <div style="width:32px;height:32px;border-radius:50%;background:${c.color || '#666'};display:flex;align-items:center;justify-content:center;font-size:14px;color:#000;font-weight:bold;flex-shrink:0;box-shadow:inset 0 0 8px rgba(255,255,255,0.2)">
            ${(c.name || id)[0].toUpperCase()}
          </div>
          <div style="overflow:hidden">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;padding-right:4px">${c.name || '(unnamed)'}</div>
            <div style="font-size:10px;color:var(--text-dim)">${_usageCount(id)} refs</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ─── EDITOR PANEL ─────────────────────────────── */

function _renderEditor() {
  const id = _state.selectedId;
  const c = _state.characters[id];
  if (!c) return '<div class="text-dim" style="padding:20px">No character selected.</div>';

  const expressions = Object.keys(c.portraits || {});
  const allIds = Object.keys(_state.characters);

  return `
    <div style="flex:1;display:flex;gap:16px;padding:0">
      <!-- MIDDLE COLUMN: Character Properties -->
      <div style="flex:1;min-width:0">
        <div style="padding:14px 12px;background:rgba(255,255,255,0.015);border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:8px">Character Details</div>
        </div>

        <div style="padding:12px 14px">
          <!-- Character ID -->
          <div class="form-group">
            <label style="font-size:12px;font-weight:600;color:var(--text-dim)">Character ID (Key)</label>
            <input type="text" value="${id}" 
                   onchange="window.__charRename('${id}', this.value)"
                   style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:6px 8px;font-size:12px" />
          </div>

          <!-- Display Name -->
          <div class="form-group">
            <label style="font-size:12px;font-weight:600;color:var(--text-dim)">Display Name</label>
            <input type="text" value="${c.name || ''}" 
                   onchange="window.__charUpdate('${id}','name',this.value)"
                   placeholder="Optional display name"
                   style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:6px 8px;font-size:12px" />
          </div>

          <!-- Color Picker Row -->
          <div class="form-row">
            <div class="form-group">
              <label style="font-size:12px;font-weight:600;color:var(--text-dim)">Nameplate Color</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="color" value="${c.color || '#00ccff'}" 
                       onchange="window.__charUpdate('${id}','color',this.value);window.__charRefresh()"
                       style="width:42px;height:30px;padding:0;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer" />
                <input type="text" value="${c.color || '#00ccff'}" 
                       onchange="window.__charUpdate('${id}','color',this.value);window.__charRefresh()"
                       style="width:100%;font-family:monospace;font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:6px 8px" />
              </div>
            </div>
            <div class="form-group">
              <label style="font-size:12px;font-weight:600;color:var(--text-dim)">Default Expression</label>
              <select onchange="window.__charUpdate('${id}','defaultExpression',this.value)" 
                      style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:6px 8px;font-size:12px;width:100%">
                ${['neutral', ...expressions.filter(e => e !== 'neutral')].map(e =>
                  `<option value="${e}" ${(c.defaultExpression || 'neutral') === e ? 'selected' : ''}>${e}</option>`
                ).join('')}
                <option value="__new__" style="color:var(--accent)">+ New expression...</option>
              </select>
            </div>
          </div>

          <!-- Expressions Section -->
          <div class="form-group" style="margin-top:12px">
            <label style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;font-weight:600;color:var(--text-dim)">Expressions & Portraits</span>
              <button class="btn btn-sm" onclick="window.__charAddExpression('${id}')">+ Add</button>
            </label>
            
            <!-- No expressions placeholder -->
            ${expressions.length === 0 ? `
              <div style="padding:12px;background:rgba(255,255,255,0.03);border:1px dashed var(--border);border-radius:4px;margin-top:6px">
                <span style="font-size:11px;color:var(--text-dim)">No expressions defined. Add one to link character portraits.</span>
              </div>
            ` : ''}

            <!-- Expression list -->
            <div id="char-expr-list" style="margin-top:6px">
              ${expressions.map(expr => `
                <div style="display:flex;align-items:center;gap:6px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                  <!-- Expression name -->
                  <input type="text" value="${expr}" 
                         placeholder="happy, angry..."
                         onchange="window.__charRenameExpr('${id}','${expr}',this.value)"
                         style="width:110px;font-size:11px;font-family:monospace;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 6px" />
                  
                  <span style="font-size:10px;color:var(--text-dim)">→</span>

                  <!-- Portrait asset name -->
                  <input type="text" value="${c.portraits[expr] || ''}" 
                         placeholder="Enter portrait filename (e.g., hero_neutral.png)"
                         onchange="window.__charSetPortrait('${id}','${expr}',this.value)"
                         style="flex:1;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 6px" />

                  <!-- Action buttons -->
                  <button class="btn-icon" onclick="window.__charPreviewPortrait('${id}','${expr}')" title="Preview">👁</button>
                  <button class="btn-icon" onclick="window.__charRemoveExpr('${id}','${expr}')" title="Remove">✕</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Actions -->
          <div style="display:flex;justify-content:flex-end;margin-top:12px;gap:6px;padding:10px 8px;background:rgba(255,255,255,0.01);border-radius:4px">
            <button class="btn btn-sm" onclick="window.__charDuplicate('${id}')">Duplicate</button>
            <button class="btn btn-sm btn-danger" onclick="window.__charDelete('${id}')">Delete Character</button>
          </div>

          <!-- Usage tracking -->
          <div id="char-usage" class="hint-box mt-16" style="font-size:11px;margin-top:8px;padding:8px;background:rgba(255,255,255,0.02);border-radius:4px">
            <strong>Used in scenes:</strong>
            ${(_state.usageCache[id] || []).length === 0
              ? ' <span class="text-dim" style="color:var(--text-dim)">not referenced yet</span>'
              : '<br>' + (_state.usageCache[id].map(u =>
                  `<span style="color:var(--accent);cursor:pointer;text-decoration:underline" onclick="window.__navigate('dialogue')">${u.sceneId}</span>`
                ).join(', '))
            }
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Preview Card -->
      <div style="width:240px;border-left:1px solid var(--border);padding-left:14px;overflow-y:auto">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px">
          <!-- Portrait Preview -->
          ${_state.previews[id] ? `
            <div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:${c.color || '#555'};border-radius:8px;margin-bottom:8px;overflow:hidden;position:relative">
              ${_state.previews[id]}
              <div style="position:absolute;bottom:4px;left:0;right:0;font-size:9px;color:#fff;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.5)">${c.defaultExpression || 'neutral'}</div>
            </div>
          ` : `
            <div style="width:80px;height:80px;border-radius:50%;background:${c.color || '#666'};margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:36px;color:#000;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.3),inset 0 0 8px rgba(255,255,255,0.1)">
              ${(c.name || id)[0].toUpperCase()}
            </div>
          `}

          <!-- Character info -->
          <div style="font-size:13px;font-weight:600;text-align:center;margin-bottom:4px">${c.name || '(unnamed)'}</div>
          <div style="font-size:10px;color:var(--text-dim);text-align:center;word-break:break-all">${id}</div>

          <!-- Stats -->
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:10px">
              <span class="text-dim" style="color:var(--text-dim)">Nameplate:</span>
              <span style="color:${c.color || '#fff'}">${c.name || id}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:10px">
              <span class="text-dim" style="color:var(--text-dim)">Expressions:</span>
              <span>${Object.keys(c.portraits || {}).length || '0'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px">
              <span class="text-dim" style="color:var(--text-dim)">References:</span>
              <span>${(_state.usageCache[id] || []).length}</span>
            </div>
          </div>

          <!-- Select portrait button -->
          <button class="btn btn-sm btn-primary" onclick="window.__charSelectAsset('${id}')" 
                  style="width:100%;margin-top:8px;padding:6px;font-size:11px;background:var(--primary);border-color:var(--primary)">
            🖼️ Select from Assets
          </button>
          <div style="text-align:center;font-size:9px;color:var(--text-dim);margin-top:6px;">Upload new portraits via Asset Browser</div>
        </div>
      </div>
    </div>
  `;
}

/* ─── USAGE ────────────────────────────────────── */

function _buildUsage() {
  _state.usageCache = {};
  const sceneData = _app.data.scenes || {};
  for (const [sid, scene] of Object.entries(sceneData)) {
    const nodes = scene.data?.nodes || [];
    for (const node of nodes) {
      if (node.speaker) {
        if (!_state.usageCache[node.speaker]) _state.usageCache[node.speaker] = [];
        if (!_state.usageCache[node.speaker].find(u => u.sceneId === sid))
          _state.usageCache[node.speaker].push({ sceneId: sid });
      }
    }
  }
}

function _usageCount(id) { return (_state.usageCache[id] || []).length; }

/* ─── WINDOW EXPORTS ──────────────────────────── */

function _syncToApp() {
  Object.keys(_app.data.characters).forEach(k => delete _app.data.characters[k]);
  Object.assign(_app.data.characters, JSON.parse(JSON.stringify(_state.characters)));
  _app.stats.charCount = Object.keys(_state.characters).length;
  window.__markProjectDirty?.();
}

window.__charSelect = (id) => {
  _state.selectedId = id;
  _app.data._charSelectedId = id;
  _refresh();
};

window.__charUpdate = (id, field, value) => {
  const c = _state.characters[id];
  if (!c) return;
  c[field] = value;
  _syncToApp();
  _refresh();
};

window.__charRename = (oldId, newId) => {
  if (!newId || oldId === newId) return;
  if (_state.characters[newId]) return alert('ID already exists');
  _state.characters[newId] = _state.characters[oldId];
  delete _state.characters[oldId];
  _state.previews[newId] = _state.previews[oldId];
  delete _state.previews[oldId];
  _state.selectedId = newId;
  _syncToApp();
  _refresh();
};

window.__charAdd = () => {
  const name = prompt('Character name:');
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (_state.characters[id]) return alert('Character ID already exists');
  _state.characters[id] = { name, color: '#00ccff', portraits: {}, defaultExpression: 'neutral' };
  _state.selectedId = id;
  _syncToApp();
  _refresh();
};

window.__charDelete = (id) => {
  if (!confirm(`Delete character "${id}"?`)) return;
  delete _state.characters[id];
  delete _state.previews[id];
  const keys = Object.keys(_state.characters);
  _state.selectedId = keys.length > 0 ? keys[0] : null;
  _syncToApp();
  _refresh();
};

window.__charDuplicate = (id) => {
  const c = _state.characters[id];
  if (!c) return;
  const newId = id + '_copy';
  if (_state.characters[newId]) return alert('Copy exists');
  _state.characters[newId] = JSON.parse(JSON.stringify(c));
  _state.characters[newId].name = (c.name || id) + ' (copy)';
  _state.previews[newId] = _state.previews[id];
  _state.selectedId = newId;
  _syncToApp();
  _refresh();
};

window.__charAddExpression = (id) => {
  const c = _state.characters[id];
  if (!c) return;
  if (!c.portraits) c.portraits = {};
  const name = prompt('Expression name:', 'happy');
  if (!name || c.portraits[name]) return name ? alert('Already exists') : null;
  c.portraits[name] = '';
  _syncToApp();
  _refresh();
};

window.__charRenameExpr = (id, oldExpr, newExpr) => {
  if (!newExpr || oldExpr === newExpr) return;
  const c = _state.characters[id];
  if (!c?.portraits) return;
  if (c.portraits[newExpr] !== undefined) return alert('Expression exists');
  c.portraits[newExpr] = c.portraits[oldExpr];
  delete c.portraits[oldExpr];
  if (c.defaultExpression === oldExpr) c.defaultExpression = newExpr;
  _syncToApp();
  _refresh();
};

window.__charSetPortrait = (id, expr, value) => {
  const c = _state.characters[id];
  if (!c?.portraits) return;
  c.portraits[expr] = value;
  _syncToApp();
  _refresh();
};

window.__charRemoveExpr = (id, expr) => {
  const c = _state.characters[id];
  if (!c?.portraits) return;
  delete c.portraits[expr];
  if (c.defaultExpression === expr) c.defaultExpression = 'neutral';
  _syncToApp();
  _refresh();
};

window.__charRefresh = () => _refresh();

/* ─── PORTRAIT PREVIEW & UPLOAD ───────────────── */

/**
 * Preview a portrait image for an expression (loads from assets/characters/)
 */
window.__charPreviewPortrait = (id, expr) => {
  const c = _state.characters[id];
  if (!c || !c.portraits[expr]) return;

  const imgUrl = `/assets/characters/${c.portraits[expr]}`;

  const img = new Image();
  img.onload = () => {
    _state.previews[id] = `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover">`;
    _refresh();
  };
  img.onerror = () => {
    alert(`Portrait not found: ${c.portraits[expr]}`);
    _state.previews[id] = null;
    _refresh();
  };
  img.src = imgUrl;
};

/**
 * Opens an asset picker modal for selecting a portrait from the server's assets/characters directory.
 */
window.__charSelectAsset = async (id) => {
  const c = _state.characters[id];
  if (!c) return;

  if (!c.portraits) c.portraits = {};
  const expression = c.defaultExpression || 'neutral';
  
  // Create an overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;';
  
  const modal = document.createElement('div');
  modal.style.cssText = 'width:600px;max-width:90%;height:80vh;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);';
  
  modal.innerHTML = `
    <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--bg-elevated);">
      <h3 style="margin:0;font-size:14px;">Select Portrait for "${expression}"</h3>
      <button class="btn btn-sm" id="btn-close-asset-modal">Close</button>
    </div>
    <div id="asset-picker-grid" style="padding:16px;overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;background:var(--bg-base);align-content:start;">
      <div class="text-dim" style="grid-column:1/-1;text-align:center;padding:40px;">Loading assets...</div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  modal.querySelector('#btn-close-asset-modal').onclick = () => {
    document.body.removeChild(overlay);
  };
  
  // Fetch assets
  try {
    const res = await fetch('/api/list-assets');
    const data = await res.json();
    const portraits = data.portraits || [];
    
    const grid = modal.querySelector('#asset-picker-grid');
    if (portraits.length === 0) {
      grid.innerHTML = '<div class="text-dim" style="grid-column:1/-1;text-align:center;padding:40px;">No portrait assets found. Upload them via the Asset Browser.</div>';
    } else {
      grid.innerHTML = portraits.map(asset => `
        <div class="asset-picker-card" data-name="${asset.name}" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;overflow:hidden;cursor:pointer;transition:all 0.15s ease;"
             onmouseover="this.style.borderColor='var(--accent)';" onmouseout="this.style.borderColor='var(--border)';">
          <div style="aspect-ratio:1;overflow:hidden;background:var(--bg-base);display:flex;align-items:center;justify-content:center;">
            <img src="/assets/characters/${asset.name}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
          </div>
          <div style="padding:8px 6px;font-size:10px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${asset.name}">${asset.name}</div>
        </div>
      `).join('');
      
      grid.querySelectorAll('.asset-picker-card').forEach(card => {
        card.onclick = () => {
          const name = card.dataset.name;
          c.portraits[expression] = name;
          _syncToApp();
          window.__charPreviewPortrait(id, expression);
          document.body.removeChild(overlay);
        };
      });
    }
  } catch(e) {
    modal.querySelector('#asset-picker-grid').innerHTML = '<div style="grid-column:1/-1;color:var(--danger);padding:20px;text-align:center;">Failed to load assets.</div>';
  }
};

/* ─── INTERNAL ────────────────────────────────── */

function _refresh() {
  if (_container) render(_container, _app);
}
