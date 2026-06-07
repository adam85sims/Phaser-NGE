/**
 * Variables — Full variable editor with CRUD, inline editing,
 * usage search across scenes, and export.
 */
import { $, fetchJSON, setStatus } from '../shared/utils.js';

let _app = null;
let _state = {
  variables: {},
  usageCache: {},  // { varName: [{ sceneId, context }] }
  searchTerm: '',
  filterType: 'all'
};

export function init(app) {
  _app = app;
}

export function render(container, app) {
  _app = app;
  _state.variables = { ...(app.data.variables || {}) };
  _buildUsageCache();

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Variables</h1>
        <p id="var-subtitle">${Object.keys(_state.variables).length} variable${Object.keys(_state.variables).length !== 1 ? 's' : ''} tracking game state</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-sm" onclick="window.__varExport()">⬇ Export</button>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <input id="var-search" type="text" placeholder="Search variables..." style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;width:200px;font-family:inherit" />
      <select id="var-type-filter" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px">
        <option value="all">All types</option>
        <option value="boolean">Boolean</option>
        <option value="number">Number</option>
        <option value="string">String</option>
      </select>
      <button class="btn btn-sm" onclick="window.__varAdd()">+ Add Variable</button>
      <span class="text-dim" style="font-size:11px" id="var-count-badge">${Object.keys(_state.variables).length} total</span>
    </div>

    <div id="var-table-container">
      ${_renderTable()}
    </div>

    <div id="var-status" class="text-dim" style="font-size:11px;margin-top:8px"></div>
  `;

  // Bind search/filter
  const searchEl = document.getElementById('var-search');
  const filterEl = document.getElementById('var-type-filter');
  if (searchEl) searchEl.addEventListener('input', () => { _state.searchTerm = searchEl.value; _reRenderTable(); });
  if (filterEl) filterEl.addEventListener('change', () => { _state.filterType = filterEl.value; _reRenderTable(); });
}

/* ─── TABLE RENDERING ──────────────────────────── */

function _renderTable() {
  const entries = Object.entries(_state.variables);
  const filtered = entries.filter(([k, v]) => {
    if (_state.searchTerm && !k.toLowerCase().includes(_state.searchTerm.toLowerCase()) &&
        !(v.description || '').toLowerCase().includes(_state.searchTerm.toLowerCase())) return false;
    if (_state.filterType !== 'all' && v.type !== _state.filterType) return false;
    return true;
  });

  const countEl = document.getElementById('var-count-badge');
  if (countEl) countEl.textContent = `${filtered.length} of ${entries.length}`;

  if (filtered.length === 0) {
    return `<div class="text-dim" style="padding:20px;text-align:center">No variables match your search.</div>`;
  }

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:140px">Name</th>
          <th style="width:70px">Type</th>
          <th style="width:80px">Default</th>
          <th style="width:50px">Min</th>
          <th style="width:50px">Max</th>
          <th>Description</th>
          <th style="width:80px">Used In</th>
          <th style="width:40px"></th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(([k, v]) => `
          <tr>
            <td class="mono">
              <input class="inline-input" value="${k}" data-field="name" data-var="${k}" style="font-family:Consolas,monospace;font-size:12px" />
            </td>
            <td>
              <select class="inline-select" data-field="type" data-var="${k}" style="font-size:11px">
                <option value="boolean" ${v.type === 'boolean' ? 'selected' : ''}>boolean</option>
                <option value="number" ${v.type === 'number' ? 'selected' : ''}>number</option>
                <option value="string" ${v.type === 'string' ? 'selected' : ''}>string</option>
              </select>
            </td>
            <td><input class="inline-input" value="${_fmtDefault(v)}" data-field="default" data-var="${k}" style="width:60px;font-size:12px" /></td>
            <td><input class="inline-input" value="${v.min ?? ''}" data-field="min" data-var="${k}" style="width:40px;font-size:12px" /></td>
            <td><input class="inline-input" value="${v.max ?? ''}" data-field="max" data-var="${k}" style="width:40px;font-size:12px" /></td>
            <td><input class="inline-input" value="${(v.description || '').replace(/"/g,'&quot;')}" data-field="description" data-var="${k}" style="width:100%;font-size:12px" /></td>
            <td class="mono" style="font-size:11px">${_usageBadge(k)}</td>
            <td><button class="btn-icon" onclick="window.__varDelete('${k}')" title="Delete">✕</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function _reRenderTable() {
  const container = document.getElementById('var-table-container');
  if (container) container.innerHTML = _renderTable();
  _bindInlineEvents();
}

function _fmtDefault(v) {
  if (v.default === undefined || v.default === null) return '';
  if (typeof v.default === 'boolean') return v.default ? 'true' : 'false';
  return String(v.default);
}

function _parseDefault(v) {
  if (v.type === 'boolean') return v === 'true';
  if (v.type === 'number') return v === '' ? 0 : Number(v);
  return v;
}

/* ─── USAGE SEARCH ─────────────────────────────── */

function _buildUsageCache() {
  _state.usageCache = {};
  const scenes = _app.stats.recentScenes || [];
  const sceneData = _app.data.scenes || {};

  for (const [id, scene] of Object.entries(sceneData)) {
    const nodes = scene.data?.nodes || [];
    for (const node of nodes) {
      _checkNodeForUsage(id, node);
    }
  }
}

function _checkNodeForUsage(sceneId, node) {
  // Check condition
  if (node.condition) {
    const match = node.condition.match(/^(\w+)/);
    if (match) _addUsage(match[1], sceneId, 'condition');
  }
  // Check setFlag
  if (node.setFlag) _addUsage(node.setFlag, sceneId, 'set');
  // Check choices
  if (node.choices) {
    for (const c of node.choices) {
      if (c.condition) {
        const match = c.condition.match(/^(\w+)/);
        if (match) _addUsage(match[1], sceneId, 'condition');
      }
      if (c.setFlag) _addUsage(c.setFlag, sceneId, 'set');
    }
  }
}

function _addUsage(varName, sceneId, context) {
  if (!_state.usageCache[varName]) _state.usageCache[varName] = [];
  if (!_state.usageCache[varName].find(u => u.sceneId === sceneId)) {
    _state.usageCache[varName].push({ sceneId, context });
  }
}

function _usageBadge(varName) {
  const uses = _state.usageCache[varName];
  if (!uses || uses.length === 0) return '<span class="text-dim">—</span>';
  return uses.map(u => `<span style="color:var(--accent);cursor:pointer" onclick="window.__navigate('scenes')" title="${u.context}">${u.sceneId}</span>`).join(', ');
}

/* ─── INLINE EDITING ───────────────────────────── */

function _bindInlineEvents() {
  document.querySelectorAll('.inline-input[data-field="name"]').forEach(el => {
    el.onchange = () => _renameVar(el.dataset.var, el.value);
  });
  document.querySelectorAll('.inline-select[data-field="type"]').forEach(el => {
    el.onchange = () => _updateVarField(el.dataset.var, 'type', el.value);
  });
  document.querySelectorAll('.inline-input[data-field="default"]').forEach(el => {
    el.onchange = () => {
      const v = _state.variables[el.dataset.var];
      if (v) v.default = _parseDefault(el.value);
      _markDirty();
    };
  });
  document.querySelectorAll('.inline-input[data-field="min"]').forEach(el => {
    el.onchange = () => _updateVarField(el.dataset.var, 'min', el.value === '' ? undefined : Number(el.value));
  });
  document.querySelectorAll('.inline-input[data-field="max"]').forEach(el => {
    el.onchange = () => _updateVarField(el.dataset.var, 'max', el.value === '' ? undefined : Number(el.value));
  });
  document.querySelectorAll('.inline-input[data-field="description"]').forEach(el => {
    el.onchange = () => _updateVarField(el.dataset.var, 'description', el.value);
  });
}

function _renameVar(oldName, newName) {
  if (!newName || oldName === newName) return;
  if (_state.variables[newName]) return alert('Variable name already exists');
  _state.variables[newName] = _state.variables[oldName];
  delete _state.variables[oldName];
  _markDirty();
  _reRenderTable();
  _bindInlineEvents();
}

function _updateVarField(varName, field, value) {
  const v = _state.variables[varName];
  if (v) { v[field] = value; _markDirty(); }
}

/* ─── ADD / DELETE ─────────────────────────────── */

window.__varAdd = () => {
  const name = prompt('Variable name:');
  if (!name || _state.variables[name]) return name ? alert('Already exists') : null;
  _state.variables[name] = { type: 'boolean', default: false, description: '' };
  _markDirty();
  _reRenderTable();
  _bindInlineEvents();
};

window.__varDelete = (name) => {
  if (!confirm(`Delete variable "${name}"?`)) return;
  delete _state.variables[name];
  _markDirty();
  _reRenderTable();
  _bindInlineEvents();
};

/* ─── EXPORT ───────────────────────────────────── */

window.__varExport = () => {
  const data = {};
  for (const [k, v] of Object.entries(_state.variables)) {
    data[k] = { ...v };
    // Clean up empty fields
    if (data[k].min === undefined || data[k].min === '') delete data[k].min;
    if (data[k].max === undefined || data[k].max === '') delete data[k].max;
    if (!data[k].description) delete data[k].description;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'variables.json';
  a.click();
  URL.revokeObjectURL(url);

  // Update app data
  _app.data.variables = data;
  _app.stats.varCount = Object.keys(data).length;

  const el = document.getElementById('var-status');
  if (el) el.textContent = '✓ Exported variables.json — place it in data/variables.json';
};

function _markDirty() {
  // Write-through: immediately sync to app.data
  _app.data.variables = JSON.parse(JSON.stringify(_state.variables));
  _app.stats.varCount = Object.keys(_state.variables).length;
  window.__markProjectDirty?.();
  const el = document.getElementById('var-subtitle');
  if (el) el.textContent = `${Object.keys(_state.variables).length} variables (unsaved changes)`;
}
