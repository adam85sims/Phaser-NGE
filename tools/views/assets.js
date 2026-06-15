/**
 * Assets — Visual asset browser with a free-form file tree and thumbnail grid.
 */
import { backend } from '../shared/backend-adapter.js';
import { editorState, markDirty } from '../state.js';

let _app = null;
let _state = {
  onDisk: [], // Flat list of { name, path, type, size, modified }
  usage: {}, // { path: { refs: [...] } }
  currentFolder: '', // '' means root
  search: '',
  selectedAsset: null,
};

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _scanSceneReferences();

  container.innerHTML = `
    <div class="view-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px" id="asset-breadcrumbs">
        <!-- Breadcrumbs injected here -->
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input id="asset-search" type="text" placeholder="Search..." style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;width:150px" />
        <button class="btn btn-sm" id="btn-new-folder">📁 New Folder</button>
        <button class="btn btn-sm" id="btn-import-asset">📥 Upload</button>
        <button class="btn btn-sm" id="btn-refresh-assets">🔄 Refresh</button>
      </div>
    </div>
    
    <div style="display:flex;flex:1;min-height:400px;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <!-- Left: Folder Tree -->
      <div id="asset-tree" style="width:200px;flex-shrink:0;background:var(--bg-panel);overflow-y:auto;padding:12px">
        <!-- Tree injected here -->
      </div>
      
      <!-- Center: Asset Grid -->
      <div id="asset-grid" style="flex:1;background:var(--bg-base);overflow-y:auto;padding:16px;position:relative" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="event.preventDefault();this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');window.__assetDrop(event)">
        <div id="asset-grid-inner" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px"></div>
      </div>
      
      <!-- Right: Asset Detail Panel -->
      <div id="asset-detail" style="width:250px;flex-shrink:0;background:var(--bg-panel);border-left:1px solid var(--border);padding:16px;overflow-y:auto">
        <div class="text-dim" style="font-size:12px;text-align:center;padding:40px 0">Select a file</div>
      </div>
    </div>
    
    <div id="asset-status" class="text-dim" style="border-top:1px solid var(--border);padding:8px 12px;font-size:11px"></div>
    
    <!-- Hidden file input for import -->
    <input id="asset-file-input" type="file" multiple style="display:none" onchange="window.__assetDrop(event)" />
  `;

  container.querySelector('#asset-search')?.addEventListener('input', (e) => {
    _state.search = e.target.value.toLowerCase();
    _renderGrid();
  });

  container.querySelector('#btn-import-asset')?.addEventListener('click', () => {
    container.querySelector('#asset-file-input').click();
  });

  container.querySelector('#btn-new-folder')?.addEventListener('click', async () => {
    const name = await window.promptAsync('New folder name:');
    if (name) {
      const targetDir = _state.currentFolder ? `${_state.currentFolder}/${name}` : name;
      try {
        await backend.request('/api/create-folder', { targetDir });
        await _scanOnDisk();
      } catch(e) { alert('Error: ' + e.message); }
    }
  });

  container.querySelector('#btn-refresh-assets')?.addEventListener('click', () => {
    _scanOnDisk();
  });

  _scanOnDisk();
}

function _scanSceneReferences() {
  _state.usage = {};
  const sceneData = _app.data.scenes || {};

  const addRef = (path, ref) => {
    if (!path) return;
    if (!_state.usage[path]) _state.usage[path] = { refs: [] };
    if (!_state.usage[path].refs.includes(ref)) _state.usage[path].refs.push(ref);
  };

  for (const [sid, scene] of Object.entries(sceneData)) {
    const data = scene.data || {};
    if (data.background) addRef(data.background, sid);
    if (data.music) addRef(data.music, sid);
    if (data.layers) {
      data.layers.forEach(l => addRef(l.asset, sid));
    }
    const nodes = data.nodes || [];
    for (const node of nodes) {
      if (node.type === 'event' && node.eventValue) {
        if (node.eventType === 'bgm' || node.eventType === 'sfx' || node.eventType === 'show_object' || node.eventType === 'hide_object') {
          addRef(node.eventValue, sid);
        }
      }
    }
  }

  // Characters
  for (const [id, c] of Object.entries(_app.data.characters || {})) {
    if (c.portraits) {
      for (const [expr, path] of Object.entries(c.portraits)) {
        addRef(path, `char:${id}/${expr}`);
      }
    }
  }
}

async function _scanOnDisk() {
  try {
    const res = await fetch('/api/list-assets');
    const data = await res.json();
    _state.onDisk = Array.isArray(data) ? data : [];
    _renderBreadcrumbs();
    _renderTree();
    _renderGrid();
    _renderDetailPanel();
  } catch (e) {
    console.warn('Failed to scan assets on disk:', e);
  }
}

function _renderBreadcrumbs() {
  const container = document.getElementById('asset-breadcrumbs');
  if (!container) return;
  
  const parts = _state.currentFolder ? _state.currentFolder.split('/') : [];
  let html = `<button class="btn btn-sm" onclick="window.__navFolder('')" style="background:none;border:none;padding:0;color:var(--accent)">Assets</button>`;
  
  let curPath = '';
  for (const part of parts) {
    if (!part) continue;
    curPath += (curPath ? '/' : '') + part;
    html += ` <span class="text-dim">/</span> <button class="btn btn-sm" onclick="window.__navFolder('${curPath}')" style="background:none;border:none;padding:0;color:var(--accent)">${part}</button>`;
  }
  
  container.innerHTML = html;
}

window.__navFolder = (path) => {
  _state.currentFolder = path;
  _state.selectedAsset = null;
  _renderBreadcrumbs();
  _renderTree();
  _renderGrid();
  _renderDetailPanel();
};

function _renderTree() {
  const container = document.getElementById('asset-tree');
  if (!container) return;

  const dirs = _state.onDisk.filter(f => f.type === 'directory').map(f => f.path);
  // Also construct implicit parent dirs just in case
  const allDirs = new Set(['']);
  for (const d of dirs) {
    let cur = '';
    for (const part of d.split('/')) {
      if (!part) continue;
      cur += (cur ? '/' : '') + part;
      allDirs.add(cur);
    }
  }

  const sortedDirs = Array.from(allDirs).sort();

  let html = '';
  for (const dir of sortedDirs) {
    const depth = dir ? dir.split('/').length : 0;
    const name = dir ? dir.split('/').pop() : 'assets (root)';
    const isSelected = _state.currentFolder === dir;
    html += `
      <div onclick="window.__navFolder('${dir}')" style="cursor:pointer;padding:4px 8px;padding-left:${depth * 12 + 8}px;background:${isSelected ? 'var(--accent)' : 'transparent'};color:${isSelected ? 'white' : 'var(--text)'};border-radius:4px;font-size:12px;margin-bottom:2px;display:flex;align-items:center;gap:6px">
        <span>📁</span> <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function _renderGrid() {
  const grid = document.getElementById('asset-grid-inner');
  if (!grid) return;

  // Filter items in current folder
  let items = _state.onDisk.filter(f => {
    if (_state.search) return f.name.toLowerCase().includes(_state.search);
    
    // Exact folder match
    if (f.type === 'directory') {
      const parentDir = f.path.substring(0, f.path.lastIndexOf('/'));
      return parentDir === _state.currentFolder;
    } else {
      const parentDir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
      return parentDir === _state.currentFolder;
    }
  });

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:40px">Empty folder</div>`;
    return;
  }

  // Sort dirs first, then files
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  grid.innerHTML = items.map(item => {
    const isSelected = _state.selectedAsset?.path === item.path;
    const isDir = item.type === 'directory';
    const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name);
    const isAudio = /\.(mp3|ogg|wav)$/i.test(item.name);
    
    let thumb = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">📁</div>`;
    if (!isDir) {
      if (isImage) {
        thumb = `<img src="/assets/${item.path}" style="width:100%;height:100%;object-fit:contain" loading="lazy" />`;
      } else if (isAudio) {
        thumb = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">🎵</div>`;
      } else {
        thumb = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">📄</div>`;
      }
    }

    return `
      <div class="asset-card ${isSelected ? 'selected' : ''}" style="background:var(--bg-elevated);border-radius:6px;overflow:hidden;border:2px solid ${isSelected ? 'var(--accent)' : 'transparent'};cursor:pointer"
           onclick="window.__selectAsset('${item.path}')"
           ondblclick="${isDir ? `window.__navFolder('${item.path}')` : `window.open('/assets/${item.path}', '_blank')`}"
           ${!isDir ? `draggable="true" ondragstart="event.dataTransfer.setData('application/json', JSON.stringify({path:'${item.path}', type:'${isImage?'image':'audio'}'}))"` : ''}>
        <div style="aspect-ratio:1;background:var(--bg-base);padding:4px">
          ${thumb}
        </div>
        <div style="padding:6px;font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${item.name}">${item.name}</div>
      </div>
    `;
  }).join('');
}

window.__selectAsset = (path) => {
  const item = _state.onDisk.find(f => f.path === path);
  if (item && item.type === 'file') {
    _state.selectedAsset = item;
    _renderGrid();
    _renderDetailPanel();
  }
};

function _renderDetailPanel() {
  const panel = document.getElementById('asset-detail');
  if (!panel || !_state.selectedAsset) {
    if (panel) panel.innerHTML = '<div class="text-dim" style="font-size:12px;text-align:center;padding:40px 0">Select a file</div>';
    return;
  }
  
  const asset = _state.selectedAsset;
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(asset.name);
  const isAudio = /\.(mp3|ogg|wav)$/i.test(asset.name);
  const refs = _state.usage[asset.path]?.refs || [];
  
  panel.innerHTML = `
    <div style="margin-bottom:16px;word-break:break-all">
      <div style="font-size:14px;font-weight:600">${asset.name}</div>
      <div style="font-size:10px;color:var(--text-muted)">${asset.path}</div>
    </div>
    
    <div style="aspect-ratio:1;background:var(--bg-elevated);border-radius:6px;overflow:hidden;margin-bottom:16px;display:flex;align-items:center;justify-content:center;padding:8px">
      ${isImage 
        ? `<img src="/assets/${asset.path}" style="max-width:100%;max-height:100%;object-fit:contain" />`
        : isAudio ? `<span style="font-size:64px">🎵</span>` : `<span style="font-size:64px">📄</span>`
      }
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted)">SIZE</div>
        <div style="font-size:12px;font-weight:500">${Math.round(asset.size/1024)} KB</div>
      </div>
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted)">USED IN</div>
        <div style="font-size:12px;font-weight:500">${refs.length} places</div>
      </div>
    </div>

    ${isAudio ? `<button class="btn" style="width:100%;margin-bottom:16px" onclick="new Audio('/assets/${asset.path}').play()">▶ Play Audio</button>` : ''}
    
    <div style="border-top:1px solid var(--border);padding-top:16px;display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${asset.path}')">📋 Copy Path</button>
      <button class="btn btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="window.__deleteAsset('${asset.path}')">🗑️ Delete</button>
    </div>
  `;
}

window.__deleteAsset = async (path) => {
  if (confirm(`Delete ${path}? This cannot be undone.`)) {
    try {
      await backend.request('/api/delete-asset', { targetPath: path });
      _state.selectedAsset = null;
      await _scanOnDisk();
    } catch(e) { alert('Error deleting: ' + e.message); }
  }
};

window.__assetDrop = async (event) => {
  const files = event.dataTransfer?.files || event.target?.files;
  if (!files || files.length === 0) return;

  const statusEl = document.getElementById('asset-status');
  if (statusEl) statusEl.textContent = `Uploading ${files.length} file(s)...`;

  let ok = 0, fail = 0;
  for (const file of files) {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await backend.request('/api/upload-asset', { targetDir: _state.currentFolder, filename: file.name, base64 });
      ok++;
    } catch (e) { fail++; }
  }

  if (statusEl) statusEl.textContent = `Upload complete: ${ok} succeeded, ${fail} failed.`;
  await _scanOnDisk();
};
