/**
 * Characters — Full character manager with CRUD, expressions,
 * color picker, portrait preview, usage tracking, and export.
 */
let _app = null;
let _state = { characters: {}, selectedId: null, usageCache: {} };

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _state.characters = JSON.parse(JSON.stringify(app.data.characters || {}));
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
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="window.__charAdd()">+ Add Character</button>
        <button class="btn btn-primary btn-sm" onclick="window.__charExport()">⬇ Export</button>
      </div>
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
    <div style="width:200px;flex-shrink:0;border-right:1px solid var(--border);padding-right:12px;overflow-y:auto">
      ${entries.map(([id, c]) => `
        <div class="char-list-item ${id === _state.selectedId ? 'char-list-item-active' : ''}"
             onclick="window.__charSelect('${id}')"
             style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:4px;cursor:pointer;margin-bottom:2px;transition:background 0.1s;
                    ${id === _state.selectedId ? 'background:var(--accent-glow)' : ''}">
          <div style="width:28px;height:28px;border-radius:50%;background:${c.color || '#555'};display:flex;align-items:center;justify-content:center;font-size:12px;color:#000;font-weight:bold;flex-shrink:0">
            ${(c.name || id)[0].toUpperCase()}
          </div>
          <div style="overflow:hidden">
            <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis">${c.name || '(unnamed)'}</div>
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
    <div style="flex:1;display:flex;gap:20px">
      <div style="flex:1;max-width:400px">
        <div class="form-group">
          <label>Character ID (key)</label>
          <input type="text" value="${id}" onchange="window.__charRename('${id}', this.value)" />
        </div>
        <div class="form-group">
          <label>Display Name</label>
          <input type="text" value="${c.name || ''}" onchange="window.__charUpdate('${id}','name',this.value)" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nameplate Color</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input type="color" value="${c.color || '#00ccff'}" onchange="window.__charUpdate('${id}','color',this.value);window.__charRefresh()" style="width:36px;height:28px;padding:1px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer" />
              <input type="text" value="${c.color || '#00ccff'}" onchange="window.__charUpdate('${id}','color',this.value);window.__charRefresh()" style="width:90px;font-family:monospace;font-size:12px" />
            </div>
          </div>
          <div class="form-group">
            <label>Default Expression</label>
            <select onchange="window.__charUpdate('${id}','defaultExpression',this.value)" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 6px;font-size:12px;width:100%">
              ${['neutral', ...expressions.filter(e => e !== 'neutral')].map(e =>
                `<option value="${e}" ${(c.defaultExpression || 'neutral') === e ? 'selected' : ''}>${e}</option>`
              ).join('')}
              <option value="__new__" style="color:var(--accent)">+ New expression...</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top:12px">
          <label style="display:flex;justify-content:space-between;align-items:center">
            <span>Expressions & Portraits</span>
            <button class="btn btn-sm" onclick="window.__charAddExpression('${id}')">+ Add</button>
          </label>
          ${expressions.length === 0 ? '<div class="text-dim" style="font-size:11px">No expressions defined. Add one to assign portraits.</div>' : ''}
          <div id="char-expr-list" style="margin-top:6px">
            ${expressions.map(expr => `
              <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <input type="text" value="${expr}" style="width:100px;font-size:11px;font-family:monospace;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px"
                       onchange="window.__charRenameExpr('${id}','${expr}',this.value)" />
                <span style="font-size:10px;color:var(--text-dim)">→</span>
                <input type="text" value="${c.portraits[expr] || ''}" placeholder="portrait key" style="flex:1;font-size:11px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px"
                       onchange="window.__charSetPortrait('${id}','${expr}',this.value)" />
                <button class="btn-icon" onclick="window.__charRemoveExpr('${id}','${expr}')" title="Remove expression">✕</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:6px">
          <button class="btn btn-sm" onclick="window.__charDuplicate('${id}')">Duplicate</button>
          <button class="btn btn-sm btn-danger" onclick="window.__charDelete('${id}')">Delete Character</button>
        </div>

        <div id="char-usage" class="hint-box mt-16" style="font-size:11px">
          <strong>Used in scenes:</strong>
          ${(_state.usageCache[id] || []).length === 0
            ? ' <span class="text-dim">not referenced yet</span>'
            : '<br>' + _state.usageCache[id].map(u =>
                `<span style="color:var(--accent);cursor:pointer" onclick="window.__navigate('dialogue')">${u.sceneId}</span>`
              ).join(', ')
          }
        </div>
      </div>

      <div style="width:240px;flex-shrink:0">
        <label style="font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:6px;display:block">Preview</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:16px;text-align:center">
          <div style="width:72px;height:72px;border-radius:50%;background:${c.color || '#555'};margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:32px;color:#000;font-weight:bold;box-shadow:0 0 12px ${c.color || '#555'}44">
            ${(c.name || id)[0].toUpperCase()}
          </div>
          <div style="font-size:15px;font-weight:600">${c.name || '(unnamed)'}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">ID: ${id}</div>
          <div style="font-size:11px;color:var(--text-dim)">${c.defaultExpression || 'neutral'}</div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;text-align:left">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span class="text-dim">Nameplate:</span>
              <span style="color:${c.color || '#fff'}">${c.name || id}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span class="text-dim">Expressions:</span>
              <span>${Object.keys(c.portraits || {}).length || '0'}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span class="text-dim">References:</span>
              <span>${(_state.usageCache[id] || []).length}</span>
            </div>
          </div>
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
  _app.data.characters = JSON.parse(JSON.stringify(_state.characters));
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
  _markDirty();
};

window.__charRename = (oldId, newId) => {
  if (!newId || oldId === newId) return;
  if (_state.characters[newId]) return alert('ID already exists');
  _state.characters[newId] = _state.characters[oldId];
  delete _state.characters[oldId];
  _state.selectedId = newId;
  _syncToApp();
  _markDirty();
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
  _markDirty();
  _refresh();
};

window.__charDelete = (id) => {
  if (!confirm(`Delete character "${id}"?`)) return;
  delete _state.characters[id];
  const keys = Object.keys(_state.characters);
  _state.selectedId = keys.length > 0 ? keys[0] : null;
  _syncToApp();
  _markDirty();
  _refresh();
};

window.__charDuplicate = (id) => {
  const c = _state.characters[id];
  if (!c) return;
  const newId = id + '_copy';
  if (_state.characters[newId]) return alert('Copy exists');
  _state.characters[newId] = JSON.parse(JSON.stringify(c));
  _state.characters[newId].name = (c.name || id) + ' (copy)';
  _state.selectedId = newId;
  _syncToApp();
  _markDirty();
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
  _markDirty();
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
  _markDirty();
  _refresh();
};

window.__charSetPortrait = (id, expr, value) => {
  const c = _state.characters[id];
  if (!c?.portraits) return;
  c.portraits[expr] = value;
  _syncToApp();
  _markDirty();
};

window.__charRemoveExpr = (id, expr) => {
  const c = _state.characters[id];
  if (!c?.portraits) return;
  delete c.portraits[expr];
  if (c.defaultExpression === expr) c.defaultExpression = 'neutral';
  _syncToApp();
  _markDirty();
  _refresh();
};

window.__charRefresh = () => _refresh();

window.__charExport = () => {
  const data = {};
  for (const [k, v] of Object.entries(_state.characters)) {
    data[k] = { ...v };
    if (!data[k].portraits || Object.keys(data[k].portraits).length === 0) delete data[k].portraits;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'characters.json';
  a.click(); URL.revokeObjectURL(url);

  _app.data.characters = data;
  _app.stats.charCount = Object.keys(data).length;
  const el = document.getElementById('char-status');
  if (el) el.textContent = '✓ Exported characters.json';
};

function _refresh() {
  const container = document.getElementById('content');
  if (container) render(container, _app);
}

function _markDirty() {
  const el = document.getElementById('char-subtitle');
  if (el) el.textContent = `${Object.keys(_state.characters).length} characters (unsaved)`;
}
