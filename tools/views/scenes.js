/**
 * Scenes — Full scene manager with stats, search, duplicate,
 * delete, rename, set as start scene, and open in editor.
 */
import { editorState } from '../state.js';

let _app = null;
let _state = { scenes: [], searchTerm: '', viewMode: 'grid' };

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _state.scenes = [...(app.stats.recentScenes || [])];

  container.innerHTML = `
    <div class="view-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:600;font-size:14px">Scenes</span>
        <span class="text-dim" style="font-size:11px" id="scene-subtitle">${_state.scenes.length} scene${_state.scenes.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input id="scene-search" type="text" placeholder="Search scenes..." style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;width:200px" />
        <span class="text-dim" style="font-size:11px;margin-right:8px" id="scene-count-badge">${_state.scenes.length} total</span>
        <button class="btn btn-sm" onclick="window.__sceneToggleView()">${_state.viewMode === 'grid' ? '⊞ List' : '⊟ Grid'}</button>
        <button class="btn btn-sm" onclick="window.__sceneAdd()">+ New Scene</button>
      </div>
    </div>

    <div style="display:flex;flex:1;min-height:400px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;overflow-y:auto;padding:16px;">
      <div id="scene-container" style="width:100%">
      ${_state.scenes.length === 0
        ? '<div class="text-dim" style="padding:20px;text-align:center">No scenes yet. Create one or add it in Settings.</div>'
        : _state.viewMode === 'grid'
          ? '<div class="scene-grid">' + _state.scenes.map(s => _sceneCard(s)).join('') + '</div>'
          : _renderListTable(_state.scenes)
      }
      </div>
    </div>
  `;

  const searchEl = document.getElementById('scene-search');
  if (searchEl) searchEl.addEventListener('input', () => {
    _state.searchTerm = searchEl.value.toLowerCase();
    _reRenderScenes();
  });
}

function _getFiltered() {
  if (!_state.searchTerm) return _state.scenes;
  return _state.scenes.filter(s =>
    s.id.toLowerCase().includes(_state.searchTerm)
  );
}

function _reRenderScenes() {
  const container = document.getElementById('scene-container');
  if (!container) return;
  const filtered = _getFiltered();
  const badge = document.getElementById('scene-count-badge');
  if (badge) badge.textContent = `${filtered.length} of ${_state.scenes.length}`;

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-dim" style="padding:20px;text-align:center">No scenes match your search.</div>';
    return;
  }

  container.innerHTML = _state.viewMode === 'grid'
    ? '<div class="scene-grid">' + filtered.map(s => _sceneCard(s)).join('') + '</div>'
    : '<table class="data-table">' +
      '<thead><tr><th>Name</th><th>Nodes</th><th>Words</th><th>Choices</th><th></th></tr></thead><tbody>' +
      filtered.map(s => `<tr>
        <td class="mono clickable" onclick="window.__setActiveScene('${s.id}'); window.__navigate('dialogue')">${s.id}${_app.data.game?.startScene === s.id ? ' ★' : ''}</td>
        <td>${s.nodes}</td>
        <td>~${s.words}</td>
        <td>${s.choices}</td>
        <td style="text-align:right">${_actionButtons(s.id)}</td>
      </tr>`).join('') +
      '</tbody></table>';
}

function _sceneCard(s) {
  const isStart = _app.data.game?.startScene === s.id;
  return `
    <div class="scene-card" style="position:relative">
      ${isStart ? '<span style="position:absolute;top:6px;right:8px;font-size:10px;color:var(--success)">★ START</span>' : ''}
      <div class="scene-name clickable" onclick="window.__setActiveScene('${s.id}'); window.__navigate('dialogue')">${s.id}</div>
      <div class="scene-meta">
        <span>📄 ${s.nodes} nodes</span>
        <span>💬 ~${s.words} words</span>
        <span>◇ ${s.choices} choices</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="window.__setActiveScene('${s.id}'); window.__navigate('dialogue')">✍ Edit</button>
        ${!isStart ? `<button class="btn btn-sm" onclick="window.__sceneSetStart('${s.id}')">★ Set Start</button>` : ''}
        <button class="btn btn-sm" onclick="window.__sceneDuplicate('${s.id}')">Copy</button>
        <button class="btn btn-sm btn-danger" onclick="window.__sceneDelete('${s.id}')">Delete</button>
      </div>
    </div>
  `;
}

function _renderListTable(scenes) {
  const isStart = id => _app.data.game?.startScene === id;
  return '<table class="data-table">' +
    '<thead><tr><th>Name</th><th>Nodes</th><th>Words</th><th>Choices</th><th></th></tr></thead><tbody>' +
    scenes.map(s => `<tr>
      <td class="mono clickable" onclick="window.__setActiveScene('${s.id}'); window.__navigate('dialogue')">${s.id}${isStart(s.id) ? ' ★' : ''}</td>
      <td>${s.nodes}</td>
      <td>~${s.words}</td>
      <td>${s.choices}</td>
      <td style="text-align:right">${_actionButtons(s.id)}</td>
    </tr>`).join('') +
    '</tbody></table>';
}

function _actionButtons(id) {
  const isStart = _app.data.game?.startScene === id;
  return `
    <button class="btn btn-sm" onclick="window.__setActiveScene('${id}'); window.__navigate('dialogue')" title="Edit">✍</button>
    ${!isStart ? `<button class="btn btn-sm" onclick="window.__sceneSetStart('${id}')" title="Set as start">★</button>` : ''}
    <button class="btn btn-sm" onclick="window.__sceneDuplicate('${id}')" title="Duplicate">⧉</button>
    <button class="btn btn-sm btn-danger" onclick="window.__sceneDelete('${id}')" title="Delete">✕</button>
  `;
}

/* ─── ACTIONS ──────────────────────────────────── */

window.__sceneAdd = () => {
  const id = prompt('New scene ID:', 'scene_' + Date.now());
  if (!id) return;
  if ((_app.data.game?.scenes || []).includes(id)) return alert('Scene already exists');

  // Create empty scene in memory (no auto-download — export from editor)
  const data = { id, entryNode: 'start', nodes: [{ id: 'start', type: 'dialogue', speaker: 'narrator', text: 'New scene.', x: 400, y: 30 }] };

  // Register in game config
  if (!_app.data.game.scenes) _app.data.game.scenes = [];
  _app.data.game.scenes.push(id);
  _app.data.scenes[id] = data;
  _app.stats.recentScenes.push({ id, nodes: 1, words: 2, choices: 0 });

  // Refresh settings data too
  _state.scenes = [...(_app.stats.recentScenes || [])];
  _reRenderScenes();
  const el = document.getElementById('scene-subtitle');
  if (el) el.textContent = `${_state.scenes.length} scenes`;
  window.__markProjectDirty?.();
  window.dispatchEvent(new CustomEvent('editor:render'));
};

window.__sceneDuplicate = (id) => {
  const scene = _app.data.scenes[id];
  if (!scene) return alert('Scene not loaded');
  const newId = id + '_copy';
  if (_app.data.scenes[newId]) return alert('Copy exists');

  const data = JSON.parse(JSON.stringify(scene.data));
  data.id = newId;
  // No auto-download — user exports from editor when ready

  _app.data.game.scenes.push(newId);
  _app.data.scenes[newId] = data;
  const stats = { id: newId, nodes: data.nodes?.length || 0, words: _countWords(data.nodes), choices: _countChoices(data.nodes) };
  _app.stats.recentScenes.push(stats);
  _state.scenes = [...(_app.stats.recentScenes || [])];
  _reRenderScenes();
  window.__markProjectDirty?.();
};

window.__sceneDelete = (id) => {
  if (!confirm(`Delete scene "${id}"? Removes it from the registry. The JSON file stays on disk.`)) return;
  _app.data.game.scenes = (_app.data.game.scenes || []).filter(s => s !== id);
  delete _app.data.scenes[id];
  _app.stats.recentScenes = (_app.stats.recentScenes || []).filter(s => s.id !== id);
  if (_app.data.game.startScene === id) _app.data.game.startScene = _app.data.game.scenes[0] || '';
  _state.scenes = [...(_app.stats.recentScenes || [])];
  // If the deleted scene was active, cleanly switch to the next available scene
  if (editorState.activeSceneId === id) {
    editorState.selectedItemId = null;
    editorState.selectedItemType = null;
    const nextScene = _app.data.game.scenes[0] || null;
    if (nextScene && window.__setActiveScene) {
      window.__setActiveScene(nextScene);
    } else {
      editorState.activeSceneId = null;
    }
  }
  _reRenderScenes();
  const el = document.getElementById('scene-subtitle');
  if (el) el.textContent = `${_state.scenes.length} scenes`;
  window.__markProjectDirty?.();
  window.dispatchEvent(new CustomEvent('editor:render'));
};

window.__sceneSetStart = (id) => {
  _app.data.game.startScene = id;
  _reRenderScenes();
  window.__markProjectDirty?.();
};

window.__sceneToggleView = () => {
  _state.viewMode = _state.viewMode === 'grid' ? 'list' : 'grid';
  _reRenderScenes();
};

function _countWords(nodes) {
  let c = 0;
  for (const n of nodes || []) {
    if (n.text) c += n.text.split(/\s+/).filter(Boolean).length;
    if (n.choices) for (const ch of n.choices) if (ch.text) c += ch.text.split(/\s+/).filter(Boolean).length;
  }
  return c;
}

function _countChoices(nodes) {
  return (nodes || []).reduce((s, n) => s + (n.choices?.length || 0), 0);
}
