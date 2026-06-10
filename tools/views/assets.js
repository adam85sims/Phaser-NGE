/**
 * Assets — Visual asset browser with thumbnail grid, filtering, and drag-to-apply.
 * Browse images and audio with previews, search, and metadata.
 */
import { backend } from '../shared/backend-adapter.js';

let _app = null;
let _state = {
  scan: { backgrounds: [], music: [], sfx: [], portraits: [] },
  onDisk: { backgrounds: [], music: [], sfx: [], portraits: [], fonts: [] },
  verified: {},
  filter: 'all', // 'all', 'backgrounds', 'portraits', 'music', 'sfx', 'fonts'
  search: '',
  selectedAsset: null,
  viewMode: 'grid' // 'grid' or 'list'
};

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _scanSceneReferences();

  container.innerHTML = `
    <div class="view-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-sm ${_state.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="btn btn-sm ${_state.filter === 'backgrounds' ? 'active' : ''}" data-filter="backgrounds">🎨 Bg</button>
        <button class="btn btn-sm ${_state.filter === 'portraits' ? 'active' : ''}" data-filter="portraits">👤 Portraits</button>
        <button class="btn btn-sm ${_state.filter === 'music' ? 'active' : ''}" data-filter="music">🎵 Music</button>
        <button class="btn btn-sm ${_state.filter === 'sfx' ? 'active' : ''}" data-filter="sfx">🔊 SFX</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input id="asset-search" type="text" placeholder="Search assets..." style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;width:200px" />
        <button class="btn btn-sm" id="btn-refresh-assets">🔄 Refresh</button>
        <button class="btn btn-sm" id="btn-import-asset">📥 Import</button>
      </div>
    </div>
    
    <div style="display:flex;flex:1;min-height:400px;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <!-- Left: Asset Grid -->
      <div id="asset-grid" style="flex:1;background:var(--bg-base);overflow-y:auto;padding:16px;position:relative" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="event.preventDefault();this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');window.__assetDrop(event)">
        <div id="asset-grid-inner" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px"></div>
      </div>
      
      <!-- Right: Asset Detail Panel -->
      <div id="asset-detail" style="width:280px;flex-shrink:0;background:var(--bg-panel);border-left:1px solid var(--border);padding:16px;overflow-y:auto">
        <div class="text-dim" style="font-size:12px;text-align:center;padding:40px 0">Select an asset to view details</div>
      </div>
    </div>
    
    <div id="asset-status" class="text-dim" style="border-top:1px solid var(--border);padding:8px 12px;font-size:11px"></div>
    
    <!-- Hidden file input for import -->
    <input id="asset-file-input" type="file" multiple style="display:none" onchange="window.__assetDrop(event)" />
  `;

  // Bind filter buttons
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.filter = btn.dataset.filter;
      container.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _renderGrid();
    });
  });

  // Bind search
  container.querySelector('#asset-search')?.addEventListener('input', (e) => {
    _state.search = e.target.value.toLowerCase();
    _renderGrid();
  });

  // Bind import button
  container.querySelector('#btn-import-asset')?.addEventListener('click', () => {
    container.querySelector('#asset-file-input').click();
  });

  // Bind refresh button
  container.querySelector('#btn-refresh-assets')?.addEventListener('click', () => {
    const btn = container.querySelector('#btn-refresh-assets');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Scanning...';
    btn.disabled = true;
    _scanOnDisk().then(() => {
      _verifyOnDisk();
      _renderGrid();
      btn.textContent = originalText;
      btn.disabled = false;
    });
  });

  // Kick off disk scan and render grid
  _scanOnDisk().then(() => {
    _verifyOnDisk();
    _renderGrid();
  });
}

/* ─── SCAN SCENES FOR ASSET REFERENCES ─────────── */

function _scanSceneReferences() {
  _state.scan = { backgrounds: {}, music: {}, sfx: {}, portraits: {} };
  const sceneData = _app.data.scenes || {};

  for (const [sid, scene] of Object.entries(sceneData)) {
    const data = scene.data || {};
    if (data.background) _addRef('backgrounds', data.background, sid);
    if (data.music) _addRef('music', data.music, sid);
    const nodes = data.nodes || [];
    for (const node of nodes) {
      if (node.type === 'event') {
        if (node.eventType === 'bgm' && node.eventValue) _addRef('music', node.eventValue, sid);
        if (node.eventType === 'sfx' && node.eventValue) _addRef('sfx', node.eventValue, sid);
      }
    }
  }

  _state.scan.backgrounds = _toRefArray(_state.scan.backgrounds);
  _state.scan.music = _toRefArray(_state.scan.music);
  _state.scan.sfx = _toRefArray(_state.scan.sfx);
  _state.scan.portraits = _toRefArray(_state.scan.portraits);

  // Add character portraits
  for (const [id, c] of Object.entries(_app.data.characters || {})) {
    if (c.portraits) {
      for (const [expr, path] of Object.entries(c.portraits)) {
        if (path) _state.scan.portraits.push({ name: path, refs: [id + '/' + expr], status: 'unknown' });
      }
    }
  }
}

function _addRef(category, name, sceneId) {
  if (!_state.scan[category]) _state.scan[category] = {};
  if (!_state.scan[category][name]) _state.scan[category][name] = { name, refs: [], status: 'unknown' };
  if (!_state.scan[category][name].refs.includes(sceneId))
    _state.scan[category][name].refs.push(sceneId);
}

function _toRefArray(obj) {
  return Object.values(obj).sort((a, b) => a.name.localeCompare(b.name));
}

/* ─── GRID RENDERING ───────────────────────────── */

/**
 * Render the asset grid with thumbnails based on current filter and search.
 */
function _renderGrid() {
  const grid = document.getElementById('asset-grid-inner');
  if (!grid) return;

  const assets = _getFilteredAssets();
  
  if (assets.length === 0) {
    grid.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;color:var(--text-muted);grid-column:1/-1">
        <span style="font-size:48px;opacity:0.3;margin-bottom:16px">📂</span>
        <div style="font-size:14px">No assets found</div>
        <div style="font-size:12px;margin-top:4px">Import some files or adjust your filter</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = assets.map(asset => _renderAssetCard(asset)).join('');
  
  // Bind click handlers
  grid.querySelectorAll('.asset-card').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _selectAsset(el.dataset.category, el.dataset.name);
    });
    el.addEventListener('dblclick', () => {
      _previewAsset(el.dataset.category, el.dataset.name);
    });
    
    // Drag handlers for scene drop
    el.addEventListener('dragstart', (e) => {
      const dragData = { category: el.dataset.category, name: el.dataset.name };
      const dragDataStr = JSON.stringify(dragData);
      e.dataTransfer.setData('application/json', dragDataStr);
      e.dataTransfer.setData('text/plain', dragDataStr);
      e.dataTransfer.effectAllowed = 'copy';
      el.style.opacity = '0.5';
    });
    el.addEventListener('dragend', (e) => {
      el.style.opacity = '';
    });
  });
}

/**
 * Get all assets filtered by current filter and search.
 */
function _getFilteredAssets() {
  const categories = _state.filter === 'all' 
    ? ['backgrounds', 'portraits', 'music', 'sfx', 'fonts']
    : [_state.filter];
  
  const assets = [];
  for (const cat of categories) {
    const onDisk = _state.onDisk[cat] || [];
    for (const file of onDisk) {
      if (_state.search && !file.name.toLowerCase().includes(_state.search)) {
        continue;
      }
      assets.push({ ...file, category: cat });
    }
  }
  
  return assets.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Render a single asset card with thumbnail.
 */
function _renderAssetCard(asset) {
  const isSelected = _state.selectedAsset?.category === asset.category && _state.selectedAsset?.name === asset.name;
  const isImage = ['backgrounds', 'portraits', 'fonts'].includes(asset.category);
  const isAudio = ['music', 'sfx'].includes(asset.category);
  
  const icon = {
    backgrounds: '🎨',
    portraits: '👤',
    music: '🎵',
    sfx: '🔊',
    fonts: '🔤'
  }[asset.category];
  
  const path = _getAssetPath(asset.category, asset.name);
  
  return `
    <div class="asset-card ${isSelected ? 'selected' : ''}" data-category="${asset.category}" data-name="${asset.name}" draggable="true">
      <div class="asset-thumbnail" style="position:relative;width:100%;aspect-ratio:1;overflow:hidden;background:var(--bg-elevated);border-radius:4px">
        ${isImage 
          ? `<img src="${path}" style="width:100%;height:100%;object-fit:cover" alt="${asset.name}" loading="lazy" />`
          : isAudio
            ? `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted)">
                 <span style="font-size:32px">${icon}</span>
                 <span style="font-size:10px;margin-top:4px">${asset.duration ? _formatDuration(asset.duration) : 'Audio'}</span>
               </div>`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">${icon}</div>`
        }
        ${isAudio ? `
          <button class="asset-play-btn" data-category="${asset.category}" data-name="${asset.name}" data-path="${path}"
                  style="position:absolute;bottom:8px;right:8px;width:28px;height:28px;border-radius:50%;background:var(--accent);border:none;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px"
                  title="Play preview">▶</button>
        ` : ''}
      </div>
      <div class="asset-info" style="padding:6px 4px;min-height:40px">
        <div class="asset-name" style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${asset.name}">${asset.name}</div>
        <div class="asset-meta" style="font-size:9px;color:var(--text-dim)">${_formatSize(asset.size)}</div>
      </div>
    </div>
  `;
}

/**
 * Select an asset and show its details in the side panel.
 */
function _selectAsset(category, name) {
  _state.selectedAsset = { category, name };
  _renderGrid();
  _renderDetailPanel();
}

/**
 * Render the asset detail panel.
 */
function _renderDetailPanel() {
  const panel = document.getElementById('asset-detail');
  if (!panel || !_state.selectedAsset) return;
  
  const { category, name } = _state.selectedAsset;
  const asset = (_state.onDisk[category] || []).find(f => f.name === name);
  
  if (!asset) {
    panel.innerHTML = '<div class="text-dim" style="font-size:12px">Asset not found</div>';
    return;
  }
  
  const path = _getAssetPath(category, name);
  const isImage = ['backgrounds', 'portraits', 'fonts'].includes(category);
  const isAudio = ['music', 'sfx'].includes(category);
  
  // Count usage in scenes
  const usageCount = _countAssetUsage(category, name);
  
  panel.innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">${category}</div>
      <div style="font-size:14px;font-weight:600;word-break:break-all">${name}</div>
    </div>
    
    <div style="aspect-ratio:16/9;background:var(--bg-elevated);border-radius:6px;overflow:hidden;margin-bottom:16px;display:flex;align-items:center;justify-content:center">
      ${isImage 
        ? `<img src="${path}" style="max-width:100%;max-height:100%;object-fit:contain" alt="${name}" />`
        : isAudio
          ? `<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px">
               <span style="font-size:48px">🎵</span>
               <button class="detail-play-btn" data-path="${path}" data-category="${category}" data-name="${name}"
                       style="padding:8px 24px;background:var(--accent);border:none;border-radius:6px;color:white;font-weight:600;cursor:pointer">
                 ▶ Play
               </button>
             </div>`
          : `<span style="font-size:64px">🔤</span>`
      }
    </div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">File Size</div>
        <div style="font-size:12px;font-weight:500">${_formatSize(asset.size)}</div>
      </div>
      ${asset.modified ? `
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Modified</div>
        <div style="font-size:12px;font-weight:500">${new Date(asset.modified).toLocaleDateString()}</div>
      </div>
      ` : ''}
      ${asset.duration ? `
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Duration</div>
        <div style="font-size:12px;font-weight:500">${_formatDuration(asset.duration)}</div>
      </div>
      ` : ''}
      <div style="background:var(--bg-elevated);border-radius:4px;padding:8px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Used In</div>
        <div style="font-size:12px;font-weight:500">${usageCount} scene${usageCount !== 1 ? 's' : ''}</div>
      </div>
    </div>
    
    <div style="border-top:1px solid var(--border);padding-top:16px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:8px">Actions</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-sm" onclick="window.__copyAssetKey('${category}', '${name}')" style="text-align:left">📋 Copy Asset Key</button>
        ${category === 'backgrounds' ? `<button class="btn btn-sm" onclick="window.__applyBackground('${name}')" style="text-align:left">🖼️ Apply to Scene</button>` : ''}
        <button class="btn btn-sm" onclick="window.__revealInFiles('${category}', '${name}')" style="text-align:left">📁 Show in Files</button>
      </div>
    </div>
  `;
  
  // Bind play button for audio
  panel.querySelector('.detail-play-btn')?.addEventListener('click', (e) => {
    _toggleAudioPlay(e.target.dataset.path, e.target);
  });
}

/**
 * Preview an asset (double-click action).
 */
function _previewAsset(category, name) {
  if (category === 'backgrounds' || category === 'portraits') {
    // Open in new tab for full-size view
    const path = _getAssetPath(category, name);
    window.open(path, '_blank');
  } else if (category === 'music' || category === 'sfx') {
    // Play audio
    const path = _getAssetPath(category, name);
    _toggleAudioPlay(path);
  }
}

/**
 * Toggle audio playback.
 */
let _currentAudio = null;
let _currentPlayBtn = null;

function _toggleAudioPlay(path, btn) {
  // Stop current audio if playing
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    if (_currentPlayBtn) {
      _currentPlayBtn.textContent = '▶';
    }
    _currentAudio = null;
    _currentPlayBtn = null;
    
    // If clicking the same button, just stop
    if (btn && btn.dataset.path === path) {
      return;
    }
  }
  
  // If no button provided, just play without UI update
  if (!btn) {
    const audio = new Audio(path);
    audio.play();
    audio.onended = () => { audio = null; };
    return;
  }
  
  // Start new audio
  const audio = new Audio(path);
  audio.play();
  btn.textContent = '⏹';
  
  _currentAudio = audio;
  _currentPlayBtn = btn;
  
  audio.onended = () => {
    btn.textContent = '▶';
    _currentAudio = null;
    _currentPlayBtn = null;
  };
}

/**
 * Count how many scenes use this asset.
 */
function _countAssetUsage(category, name) {
  let count = 0;
  const sceneData = _app.data.scenes || {};
  
  for (const scene of Object.values(sceneData)) {
    const data = scene.data || {};
    
    if (category === 'backgrounds' && data.background === name) count++;
    if (category === 'music' && data.music === name) count++;
    
    const nodes = data.nodes || [];
    for (const node of nodes) {
      if (node.type === 'event') {
        if (category === 'music' && node.eventType === 'bgm' && node.eventValue === name) count++;
        if (category === 'sfx' && node.eventType === 'sfx' && node.eventValue === name) count++;
      }
    }
  }
  
  return count;
}

/**
 * Get the URL path for an asset.
 */
function _getAssetPath(category, name) {
  const paths = {
    backgrounds: '/assets/backgrounds/',
    portraits: '/assets/characters/',
    music: '/assets/audio/bgm/',
    sfx: '/assets/audio/sfx/',
    fonts: '/assets/fonts/'
  };
  return (paths[category] || '/assets/') + name;
}

/**
 * Format duration in seconds to MM:SS.
 */
function _formatDuration(seconds) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ─── FILE EXISTENCE CHECKING ───────────────────── */

/**
 * Scan actual files on disk via the backend API.
 * Populates _state.onDisk with files that exist in each asset directory.
 */
async function _scanOnDisk() {
  try {
    const data = await backend.listAssets();
    _state.onDisk = {
      backgrounds: data.backgrounds || [],
      portraits: data.portraits || [],
      music: data.music || [],
      sfx: data.sfx || [],
      fonts: data.fonts || [],
    };
  } catch (e) {
    console.warn('Failed to scan assets on disk:', e);
  }
}

let _verifying = false;

/**
 * Fire-and-forget HEAD requests to see which referenced assets exist on disk.
 * Updates _state.verified and re-renders status badges.
 */
function _verifyOnDisk() {
  if (_verifying) return;
  _verifying = true;

  const allAssets = [
    ..._state.scan.backgrounds,
    ..._state.scan.music,
    ..._state.scan.sfx,
    ..._state.scan.portraits
  ];

  let checked = 0;
  for (const asset of allAssets) {
    // Guess a path based on category to check
    const path = _guessAssetPath(asset);
    if (!path) {
      _setAssetStatus(asset, 'unknown');
      continue;
    }
    fetch(path, { method: 'HEAD' })
      .then(r => {
        _setAssetStatus(asset, r.ok ? 'found' : 'missing');
      })
      .catch(() => {
        _setAssetStatus(asset, 'missing');
      })
      .finally(() => {
        checked++;
        // Re-render status text when all done
        if (checked >= allAssets.length) {
          _verifying = false;
          _updateStatusBadges();
        }
      });
  }

  // If no assets at all, mark done immediately
  if (allAssets.length === 0) _verifying = false;
}

function _guessAssetPath(asset) {
  // Map category names to their URL paths
  const dirMap = {
    backgrounds: '/assets/backgrounds/',
    music: '/assets/audio/bgm/',
    sfx: '/assets/audio/sfx/',
    portraits: '/assets/characters/'
  };

  // Find which category contains this asset (reference check — same object)
  for (const [key, arr] of Object.entries(_state.scan)) {
    if (!Array.isArray(arr)) continue;
    if (arr.includes(asset)) {
      const prefix = dirMap[key];
      return prefix ? prefix + asset.name : null;
    }
  }
  return null;
}

function _setAssetStatus(asset, status) {
  // Update status in all category arrays
  for (const cat of ['backgrounds', 'music', 'sfx', 'portraits']) {
    const arr = _state.scan[cat];
    if (!arr) continue;
    for (const item of arr) {
      if (item === asset) item.status = status;
    }
  }
}

function _updateStatusBadges() {
  // Find all asset status badges and update them
  document.querySelectorAll('.asset-status-badge').forEach(el => {
    const name = el.dataset.assetName;
    // Find the asset in any category
    for (const cat of ['backgrounds', 'music', 'sfx', 'portraits']) {
      for (const a of (_state.scan[cat] || [])) {
        if (a.name === name) {
          el.textContent = a.status === 'found' ? '✓' : '?';
          el.style.color = a.status === 'found' ? 'var(--success)' : 'var(--warn)';
          break;
        }
      }
    }
  });
}

/* ─── CATEGORY CARD ───────────────────────────── */

/**
 * Re-render the asset grid after upload.
 */
function _refreshAssetCards() {
  _renderGrid();
}

/**
 * Format file size for display
 */
function _formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Merge referenced assets with on-disk files for display.
 * Returns a combined array with status info for each asset.
 */
function _mergeAssets(referenced, onDisk) {
  const merged = [];
  const seen = new Set();

  // Add referenced assets first
  for (const ref of referenced) {
    const onDiskMatch = onDisk.find(f => f.name === ref.name);
    merged.push({
      name: ref.name,
      refs: ref.refs,
      status: ref.status,
      onDisk: !!onDiskMatch,
      size: onDiskMatch ? onDiskMatch.size : null,
      modified: onDiskMatch ? onDiskMatch.modified : null,
    });
    seen.add(ref.name);
  }

  // Add on-disk files that aren't referenced
  for (const file of onDisk) {
    if (!seen.has(file.name)) {
      merged.push({
        name: file.name,
        refs: [],
        status: 'unused',
        onDisk: true,
        size: file.size,
        modified: file.modified,
      });
    }
  }

  return merged;
}

function _renderCategoryCard(icon, label, path, items, tint) {
  // Map category key to onDisk state key
  const categoryMap = {
    '🎨': 'backgrounds',
    '👤': 'portraits',
    '🎵': 'music',
    '🔊': 'sfx',
  };
  const diskKey = categoryMap[icon] || 'backgrounds';
  const merged = _mergeAssets(items, _state.onDisk[diskKey] || []);
  const count = items.length;
  const onDiskCount = (_state.onDisk[diskKey] || []).length;
  const unusedCount = onDiskCount - count;

  return `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:20px">${icon}</span>
        <span style="font-weight:600;font-size:13px">${label}</span>
        <span class="text-dim" style="font-size:11px">${count} referenced${unusedCount > 0 ? `, ${unusedCount} on disk` : `, ${onDiskCount} on disk`}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">${path}</div>
      ${merged.length === 0
        ? '<div class="text-dim" style="font-size:11px;padding:4px 0">No assets yet — upload some!</div>'
        : `<div style="max-height:140px;overflow-y:auto">
            ${merged.map(a => `
              <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.03)">
                <span style="font-family:Consolas,monospace;flex:1;${a.status === 'unused' ? 'opacity:0.5' : ''}">${a.name}</span>
                <span class="asset-status-badge" data-asset-name="${a.name}"
                      style="color:${a.status === 'found' ? 'var(--success)' : a.status === 'missing' ? 'var(--danger)' : a.status === 'unused' ? 'var(--text-dim)' : 'var(--warn)'};font-size:10px">
                  ${a.status === 'found' ? '✓' : a.status === 'missing' ? '✗' : a.status === 'unused' ? '○' : '?'}
                </span>
                ${a.size ? `<span class="text-dim" style="font-size:10px">${_formatSize(a.size)}</span>` : ''}
                ${a.refs.length > 0 ? `<span class="text-dim" style="font-size:10px">${a.refs.length} scene${a.refs.length > 1 ? 's' : ''}</span>` : '<span class="text-dim" style="font-size:9px;opacity:0.4">unused</span>'}
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;
}

/* ─── UPLOADING ──────────────────────────────────── */

/**
 * Prefix → directory mapping for auto-routing uploaded files.
 * bg_*       → backgrounds/
 * port_*     → characters/
 * music_*    → audio/bgm/
 * sfx_*      → audio/sfx/
 * font_*     → fonts/
 *
 * Fallback: MIME type + extension heuristics.
 */
const PREFIX_MAP = {
  bg:    { category: 'backgrounds', dir: 'backgrounds' },
  port:  { category: 'portraits',   dir: 'characters' },
  music: { category: 'bgm',         dir: 'audio/bgm' },
  sfx:   { category: 'sfx',         dir: 'audio/sfx' },
  font:  { category: 'fonts',       dir: 'fonts' },
};

/**
 * Determine category and clean filename from a file's name + MIME type.
 * Returns { category, dir, cleanName } where cleanName has the prefix stripped.
 */
function _resolveAssetTarget(filename, mimeType) {
  const nameLower = filename.toLowerCase();

  // Check prefix-based routing first
  for (const [prefix, mapping] of Object.entries(PREFIX_MAP)) {
    if (nameLower.startsWith(prefix + '_')) {
      const cleanName = filename.slice(prefix.length + 1); // strip "bg_" etc.
      return { category: mapping.category, dir: mapping.dir, cleanName };
    }
  }

  // Fallback: MIME type heuristics
  if (mimeType.startsWith('audio/')) {
    const isMusic = nameLower.includes('bgm') || nameLower.includes('theme') || nameLower.includes('music');
    return { category: isMusic ? 'bgm' : 'sfx', dir: isMusic ? 'audio/bgm' : 'audio/sfx', cleanName: filename };
  }
  if (mimeType.startsWith('image/')) {
    const isPortrait = nameLower.includes('portrait') || nameLower.includes('char') || nameLower.includes('face');
    return { category: isPortrait ? 'portraits' : 'backgrounds', dir: isPortrait ? 'characters' : 'backgrounds', cleanName: filename };
  }
  if (mimeType.startsWith('font/') || /\.(ttf|otf|woff2?)$/i.test(filename)) {
    return { category: 'fonts', dir: 'fonts', cleanName: filename };
  }

  // Default: dump in backgrounds for images, sfx for audio, or reject
  if (mimeType.startsWith('image/')) return { category: 'backgrounds', dir: 'backgrounds', cleanName: filename };
  if (mimeType.startsWith('audio/')) return { category: 'sfx', dir: 'audio/sfx', cleanName: filename };

  return null; // unrecognized
}

/**
 * Handle file drop or file input change. Uploads files with prefix-based routing.
 */
window.__assetDrop = async (event) => {
  const files = event.dataTransfer?.files || event.target?.files;
  if (!files || files.length === 0) return;

  const statusEl = document.getElementById('asset-status');
  if (statusEl) statusEl.textContent = `Uploading ${files.length} file(s)...`;

  const results = []; // { name, category, cleanName, ok, error }

  for (const file of files) {
    const target = _resolveAssetTarget(file.name, file.type);
    if (!target) {
      results.push({ name: file.name, category: '?', cleanName: file.name, ok: false, error: 'unrecognized type' });
      continue;
    }

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        await backend.uploadAsset(target.category, target.cleanName, base64);
        results.push({ name: file.name, category: target.category, cleanName: target.cleanName, ok: true });
      } catch (err) {
        results.push({ name: file.name, category: target.category, cleanName: target.cleanName, ok: false, error: err.message });
      }
    } catch (e) {
      results.push({ name: file.name, category: target.category, cleanName: target.cleanName, ok: false, error: e.message });
    }
  }

  // Build status message
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  let msg = `✓ ${ok.length} uploaded`;
  if (ok.length > 0) {
    const byCategory = {};
    ok.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });
    msg += ' → ' + Object.entries(byCategory).map(([c, n]) => `${c}(${n})`).join(', ');
  }
  if (fail.length > 0) msg += ` · ✗ ${fail.length} failed`;
  if (statusEl) statusEl.textContent = msg;

  // Reset input
  const input = document.getElementById('asset-file-input');
  if (input) input.value = '';

  // Re-scan on disk to reflect new uploads
  await _scanOnDisk();
  _verifying = false;
  _verifyOnDisk();
  _refreshAssetCards();
};

/* ─── EXPORT ───────────────────────────────────── */

window.__assetExport = () => {
  const manifest = {
    generated: new Date().toISOString(),
    project: _app.data.game?.title || 'Untitled',
    directories: {
      backgrounds: '/public/assets/backgrounds/',
      portraits: '/public/assets/characters/',
      music: '/public/assets/audio/bgm/',
      sfx: '/public/assets/audio/sfx/',
      fonts: '/public/assets/fonts/'
    },
    references: {
      backgrounds: _state.scan.backgrounds.map(a => ({ name: a.name, scenes: a.refs, status: a.status })),
      music: _state.scan.music.map(a => ({ name: a.name, scenes: a.refs, status: a.status })),
      sfx: _state.scan.sfx.map(a => ({ name: a.name, scenes: a.refs, status: a.status })),
      portraits: _state.scan.portraits.map(a => ({ name: a.name, refs: a.refs, status: a.status }))
    }
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'asset-manifest.json';
  a.click(); URL.revokeObjectURL(url);
  const el = document.getElementById('asset-status');
  if (el) el.textContent = '✓ Exported asset-manifest.json (place files in public/assets/ accordingly)';
};

/* ─── GLOBAL HELPERS ───────────────────────────── */

/**
 * Copy asset key to clipboard (for pasting into JSON or nodes).
 */
window.__copyAssetKey = (category, name) => {
  // Strip extension for the key
  const key = name.replace(/\.[^.]+$/, '');
  navigator.clipboard.writeText(key).then(() => {
    const status = document.getElementById('asset-status');
    if (status) status.textContent = `✓ Copied asset key: ${key}`;
    setTimeout(() => { if (status) status.textContent = ''; }, 2000);
  });
};

/**
 * Apply background to current scene.
 */
window.__applyBackground = (name) => {
  const key = name.replace(/\.[^.]+$/, '');
  console.log('Apply background:', key);
  
  // Import scene composer and add layer
  import('./scene-composer.js').then(module => {
    const layer = module.handleAssetDrop('backgrounds', key);
    if (layer) {
      const status = document.getElementById('asset-status');
      if (status) status.textContent = `✓ Applied background "${key}" to scene`;
      // Trigger scene preview update
      window.dispatchEvent(new CustomEvent('scene:background-changed', { detail: { layer } }));
    }
  });
};

/**
 * Reveal asset in Files tab.
 */
window.__revealInFiles = (category, name) => {
  const paths = {
    backgrounds: 'public/assets/backgrounds/' + name,
    portraits: 'public/assets/characters/' + name,
    music: 'public/assets/audio/bgm/' + name,
    sfx: 'public/assets/audio/sfx/' + name,
    fonts: 'public/assets/fonts/' + name
  };
  const filePath = paths[category];
  if (!filePath) return;
  
  console.log('Reveal in Files:', filePath);
  const status = document.getElementById('asset-status');
  if (status) status.textContent = `File: ${filePath}`;
  // Future: switch to Files tab and select this file
};
