/**
 * Assets — Browse referenced assets, verify they exist on disk,
 * track asset usage across scenes, stage new file references.
 *
 * NOTE: This is a browser-based tool served by Vite. The staging area
 * tracks files you intend to add but cannot write them to disk.
 * Download the manifest to track what needs to be placed in public/assets/.
 */
let _app = null;
let _state = {
  scan: { backgrounds: [], music: [], sfx: [], portraits: [] },
  staged: [],
  verified: {}  // { assetName: true/false } — cached existence checks
};

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  _scanSceneReferences();
  _verifyOnDisk();  // fire-and-forget existence checks

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Assets</h1>
        <p id="asset-subtitle">Images, audio, and fonts referenced by your project</p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="window.__assetExport()">⬇ Export Manifest</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      ${_renderCategoryCard('🎨', 'Backgrounds', 'public/assets/backgrounds/', _state.scan.backgrounds, '#1a3a2a')}
      ${_renderCategoryCard('👤', 'Portraits', 'public/assets/characters/', _state.scan.portraits, '#2a1a3a')}
      ${_renderCategoryCard('🎵', 'Music (BGM)', 'public/assets/audio/bgm/', _state.scan.music, '#1a2a3a')}
      ${_renderCategoryCard('🔊', 'Sound Effects', 'public/assets/audio/sfx/', _state.scan.sfx, '#3a2a1a')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <h3>Directory Structure</h3>
        <div class="hint-box" style="font-family:Consolas,monospace;font-size:11px;line-height:1.8">
          <span style="color:var(--accent)">public/assets/</span><br>
          ├── <span id="dir-bg">backgrounds/</span>  ← Scene backgrounds<br>
          ├── <span id="dir-char">characters/</span>  ← Character portraits<br>
          ├── <span id="dir-bgm">audio/bgm/</span>    ← Background music<br>
          ├── <span id="dir-sfx">audio/sfx/</span>    ← Sound effects<br>
          └── <span id="dir-fonts">fonts/</span>      ← Custom fonts
        </div>
        <p class="text-dim mt-8" style="font-size:11px">
          Place your asset files in these directories. The engine loads them at boot.
          Supported: PNG, JPG, MP3, OGG, WAV, TTF, WOFF2.
        </p>
      </div>

      <div>
        <h3>Staging Area</h3>
        <p class="text-dim" style="font-size:11px;margin-bottom:8px">
          Drag files here to add them to the manifest. (Files stay in your browser;
          download the manifest to know what to copy into <code>public/assets/</code>.)
        </p>
        <div id="asset-dropzone" class="asset-dropzone"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="event.preventDefault();this.classList.remove('drag-over')"
             ondrop="event.preventDefault();this.classList.remove('drag-over');window.__assetDrop(event)">
          <div style="font-size:32px;margin-bottom:8px;opacity:0.4">📁</div>
          <div style="font-size:13px;color:var(--text-dim)">
            Drop files here or
            <span style="color:var(--accent);cursor:pointer" onclick="document.getElementById('asset-file-input').click()">browse</span>
          </div>
          <input id="asset-file-input" type="file" multiple style="display:none"
                 onchange="window.__assetDrop(event)" />
        </div>
        <div id="asset-staged-list" class="mt-8"></div>
      </div>
    </div>

    <div id="asset-status" class="text-dim mt-8" style="font-size:11px"></div>
  `;
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

/* ─── FILE EXISTENCE CHECKING ───────────────────── */

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

function _renderCategoryCard(icon, label, path, items, tint) {
  const count = items.length;
  return `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:20px">${icon}</span>
        <span style="font-weight:600;font-size:13px">${label}</span>
        <span class="text-dim" style="font-size:11px">${count} referenced</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">${path}</div>
      ${count === 0
        ? '<div class="text-dim" style="font-size:11px;padding:4px 0">No assets referenced yet</div>'
        : `<div style="max-height:120px;overflow-y:auto">
            ${items.slice(0, 12).map(a => `
              <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.03)">
                <span style="font-family:Consolas,monospace;flex:1">${a.name}</span>
                <span class="asset-status-badge" data-asset-name="${a.name}"
                      style="color:${a.status === 'found' ? 'var(--success)' : a.status === 'missing' ? 'var(--danger)' : 'var(--warn)'};font-size:10px">
                  ${a.status === 'found' ? '✓' : a.status === 'missing' ? '✗' : '?'}
                </span>
                <span class="text-dim" style="font-size:10px">${a.refs.length} scene${a.refs.length > 1 ? 's' : ''}</span>
              </div>
            `).join('')}
            ${count > 12 ? `<div class="text-dim" style="font-size:10px;padding:2px 0">+ ${count - 12} more</div>` : ''}
          </div>`
      }
    </div>
  `;
}

/* ─── STAGING ──────────────────────────────────── */

function _syncToApp() {
  _app.data._assetStaged = JSON.parse(JSON.stringify(_state.staged));
  window.__markProjectDirty?.();
}

/**
 * Handle file drop or file input change. Adds files to the staging list.
 * Does NOT upload anywhere — browser cannot write to disk.
 * Download the manifest to track what files to place in public/assets/.
 */
window.__assetDrop = (event) => {
  const files = event.dataTransfer?.files || event.target?.files;
  if (!files || files.length === 0) return;

  for (const file of files) {
    _state.staged.push({ name: file.name, size: file.size, type: file.type || 'unknown' });
  }
  _syncToApp();
  _renderStagedList();

  const el = document.getElementById('asset-status');
  if (el) el.textContent = `+ ${files.length} file${files.length !== 1 ? 's' : ''} staged`;
};

/**
 * Clear all staged files.
 */
window.__assetClearStaged = () => {
  _state.staged = [];
  _syncToApp();
  _renderStagedList();
  const el = document.getElementById('asset-status');
  if (el) el.textContent = 'Staging cleared';
};

/**
 * Commit staged files to the manifest (marks them as known).
 * The actual files still need to be placed in public/assets/ manually.
 */
window.__assetSaveStaged = () => {
  _syncToApp();
  const count = _state.staged.length;
  _renderStagedList();
  const el = document.getElementById('asset-status');
  if (el) el.textContent = `✓ ${count} file${count !== 1 ? 's' : ''} saved to manifest`;
};

function _renderStagedList() {
  const list = document.getElementById('asset-staged-list');
  if (!list) return;

  if (_state.staged.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = `
    <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">
      ${_state.staged.length} file${_state.staged.length !== 1 ? 's' : ''} staged:
    </div>
    ${_state.staged.map(f => `
      <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.03)">
        <span style="flex:1;font-family:Consolas,monospace">${f.name}</span>
        <span class="text-dim">${(f.size / 1024).toFixed(1)} KB</span>
      </div>
    `).join('')}
    <div style="display:flex;gap:6px;margin-top:8px">
      <button class="btn btn-sm btn-primary" onclick="window.__assetSaveStaged()">💾 Save to Manifest</button>
      <button class="btn btn-sm" onclick="window.__assetClearStaged()">Clear</button>
    </div>
  `;
}

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
    },
    staged: _state.staged.map(f => ({ name: f.name, sizeBytes: f.size, type: f.type }))
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'asset-manifest.json';
  a.click(); URL.revokeObjectURL(url);
  const el = document.getElementById('asset-status');
  if (el) el.textContent = '✓ Exported asset-manifest.json (place files in public/assets/ accordingly)';
};
