/**
 * Settings — Project configuration editor.
 * Edit title, start scene, scene list, and defaults.
 * Export updated game.json.
 */
let _app = null;
let _state = { config: {} };

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _state.config = JSON.parse(JSON.stringify(app.data.game || {}));
  if (!_state.config.defaults) _state.config.defaults = { textSpeed: 40, autoAdvance: false, bgmVolume: 0.7, sfxVolume: 1.0 };

  // Expose state and dirty marker so inline event handlers in the template
  // (which run in global scope) can access them. Re-set on each render so
  // they always point at the current module state.
  window.__settingsState = _state;
  window.__settingsMarkDirty = _markDirty;

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Project Settings</h1>
        <p id="set-subtitle">Configure your project</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-sm" onclick="window.__setExport()">⬇ Export game.json</button>
      </div>
    </div>

    <div style="max-width:560px">
      <div class="form-group">
        <label>Project Title</label>
        <input type="text" id="set-title" value="${_state.config.title || ''}" onchange="window.__settingsState.config.title=this.value;window.__settingsMarkDirty()" />
      </div>

      <div class="form-group">
        <label>Start Scene</label>
        <select id="set-start-scene" onchange="window.__settingsState.config.startScene=this.value;window.__settingsMarkDirty()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:5px 8px;font-size:12px;width:100%">
          ${(_state.config.scenes || []).map(s => `<option value="${s}" ${_state.config.startScene === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label style="display:flex;justify-content:space-between;align-items:center">
          <span>Registered Scenes (${(_state.config.scenes || []).length})</span>
          <button class="btn btn-sm" onclick="window.__setAddScene()">+ Add Scene</button>
        </label>
        <div id="set-scene-list" style="margin-top:4px">
          ${(_state.config.scenes || []).map(s => `
            <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <span class="mono" style="flex:1;font-size:12px">${s}</span>
              <span class="text-dim" style="font-size:10px">${_app.data.scenes[s]?.data?.nodes?.length || 0} nodes</span>
              <button class="btn-icon" onclick="window.__setRemoveScene('${s}')" title="Remove scene">✕</button>
            </div>
          `).join('')}
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px">
          Add a scene ID here to register it. The file must exist in <code>data/scenes/</code>.
        </div>
      </div>

      <h3 style="margin-top:20px;margin-bottom:12px">Defaults</h3>

      <div class="form-group">
        <label>Text Speed: <span id="set-textspeed-val">${_state.config.defaults.textSpeed || 40}</span> ms</label>
        <input type="range" min="10" max="150" value="${_state.config.defaults.textSpeed || 40}"
               oninput="document.getElementById('set-textspeed-val').textContent=this.value;window.__settingsState.config.defaults.textSpeed=parseInt(this.value);window.__settingsMarkDirty()"
               style="width:100%" />
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim)">
          <span>Fast (10ms)</span>
          <span>Slow (150ms)</span>
        </div>
      </div>

      <div class="form-group" style="display:flex;align-items:center;gap:10px">
        <label style="margin:0">Auto-Advance Dialogue</label>
        <select onchange="window.__settingsState.config.defaults.autoAdvance=this.value==='true';window.__settingsMarkDirty()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 8px;font-size:12px">
          <option value="false" ${!_state.config.defaults.autoAdvance ? 'selected' : ''}>Off</option>
          <option value="true" ${_state.config.defaults.autoAdvance ? 'selected' : ''}>On</option>
        </select>
      </div>

      <div class="form-group">
        <label>BGM Volume: <span id="set-bgm-val">${Math.round((_state.config.defaults.bgmVolume || 0.7) * 100)}</span>%</label>
        <input type="range" min="0" max="100" value="${Math.round((_state.config.defaults.bgmVolume || 0.7) * 100)}"
               oninput="document.getElementById('set-bgm-val').textContent=this.value;window.__settingsState.config.defaults.bgmVolume=this.value/100;window.__settingsMarkDirty()"
               style="width:100%" />
      </div>

      <div class="form-group">
        <label>SFX Volume: <span id="set-sfx-val">${Math.round((_state.config.defaults.sfxVolume || 1.0) * 100)}</span>%</label>
        <input type="range" min="0" max="100" value="${Math.round((_state.config.defaults.sfxVolume || 1.0) * 100)}"
               oninput="document.getElementById('set-sfx-val').textContent=this.value;window.__settingsState.config.defaults.sfxVolume=this.value/100;window.__settingsMarkDirty()"
               style="width:100%" />
      </div>
    </div>

    <div id="set-status" class="text-dim" style="font-size:11px;margin-top:12px"></div>
  `;
}

/* ─── SCENE LIST MANAGEMENT ────────────────────── */

function _syncToApp() {
  _app.data.game = JSON.parse(JSON.stringify(_state.config));
  window.__markProjectDirty?.();
}

window.__setAddScene = () => {
  const name = prompt('New scene ID:');
  if (!name) return;
  if (!_state.config.scenes) _state.config.scenes = [];
  if (_state.config.scenes.includes(name)) return alert('Scene already registered');
  _state.config.scenes.push(name);
  _markDirty();
  _refresh();
};

window.__setRemoveScene = (id) => {
  if (!confirm(`Remove "${id}" from the scene list? (File won't be deleted.)`)) return;
  _state.config.scenes = (_state.config.scenes || []).filter(s => s !== id);
  if (_state.config.startScene === id) _state.config.startScene = _state.config.scenes[0] || '';
  _markDirty();
  _refresh();
};

/* ─── EXPORT ───────────────────────────────────── */

window.__setExport = () => {
  const data = { ..._state.config };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'game.json';
  a.click(); URL.revokeObjectURL(url);

  _app.data.game = data;
  window.__markProjectDirty?.();
  const el = document.getElementById('set-status');
  if (el) el.textContent = '✓ Exported game.json';
};

function _markDirty() {
  _syncToApp();
  const el = document.getElementById('set-subtitle');
  if (el) el.textContent = 'Unsaved changes';
}

function _refresh() {
  const container = document.getElementById('content');
  if (container) render(container, _app);
}
