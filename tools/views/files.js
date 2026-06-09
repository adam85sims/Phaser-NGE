/**
 * Files — Project file explorer with Unity-style two-panel layout.
 * Left: Folder tree for navigation
 * Right: Grid of file thumbnails with preview + filename
 */
let _app = null;
let _state = {
  tree: null,
  selectedFolder: 'data',
  selectedFile: null,
  contextMenuPath: null,
  expandedFolders: new Set(['data', 'public', 'public/assets']),
  searchTerm: '',
  viewMode: 'grid' // 'grid' or 'list'
};

// Project structure (known directories)
const PROJECT_ROOTS = [
  { name: 'data', path: 'data', type: 'folder' },
  { name: 'tools', path: 'tools', type: 'folder' },
  { name: 'public', path: 'public', type: 'folder' },
  { name: 'src', path: 'src', type: 'folder' },
  { name: 'tests', path: 'tests', type: 'folder' },
  { name: 'docs', path: 'docs', type: 'folder' }
];

export function init(app) {
  _app = app;
}

export function render(container, app) {
  _app = app;
  
  container.innerHTML = `
    <div class="view-toolbar" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-sm" id="btn-create-folder" title="Create Folder">+ 📁</button>
        <button class="btn btn-sm" id="btn-create-file" title="Create File">+ 📄</button>
        <span class="text-dim" style="font-size:11px" id="breadcrumb">Assets</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input id="file-search" type="text" placeholder="Search assets..." style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;width:200px" />
        <select id="view-mode" style="background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 6px;font-size:12px">
          <option value="grid">▦ Grid</option>
          <option value="list">☰ List</option>
        </select>
      </div>
    </div>
    
    <div style="display:flex;flex:1;min-height:400px;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <!-- Left: Folder Tree -->
      <div id="folder-tree" style="width:220px;flex-shrink:0;background:var(--bg-panel);overflow-y:auto;padding:8px"></div>
      
      <!-- Right: File Grid -->
      <div id="file-grid" style="flex:1;background:var(--bg-base);overflow-y:auto;padding:16px;position:relative"></div>
    </div>
    
    <div id="file-info" style="border-top:1px solid var(--border);padding:8px 12px;font-size:11px;display:flex;justify-content:space-between;align-items:center">
      <span id="selection-info" class="text-dim">No selection</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" id="btn-open" disabled>Open</button>
        <button class="btn btn-sm" id="btn-reveal" disabled>Reveal</button>
      </div>
    </div>
    
    <!-- Context Menu (hidden by default) -->
    <div id="file-context-menu" style="position:fixed;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:1000;display:none;min-width:150px;overflow:hidden">
      <div class="context-menu-item" data-action="open" style="padding:8px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <span>📄</span>
        <span>Open</span>
      </div>
      <div class="context-menu-item" data-action="reveal" style="padding:8px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px">
        <span>📁</span>
        <span>Reveal in Folder</span>
      </div>
      <div style="border-top:1px solid var(--border);margin:4px 0"></div>
      <div class="context-menu-item" data-action="delete" style="padding:8px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--danger)">
        <span>🗑️</span>
        <span>Delete</span>
      </div>
    </div>
  `;
  
  // Build tree
  _buildTree().then(() => {
    _renderTree();
    _renderFileGrid();
    _bindEvents();
  });
}

/* ─── TREE BUILDING ───────────────────────────── */

async function _buildTree() {
  _state.tree = PROJECT_ROOTS.map(root => {
    if (root.type === 'file') return root;
    return { ...root, children: _getFolderChildren(root.path) };
  });
}

function _getFolderChildren(folderPath) {
  const structures = {
    'data': [
      { name: 'game.json', path: 'data/game.json', type: 'file' },
      { name: 'characters.json', path: 'data/characters.json', type: 'file' },
      { name: 'variables.json', path: 'data/variables.json', type: 'file' },
      { name: 'scenes', path: 'data/scenes', type: 'folder', children: _getSceneFiles() }
    ],
    'tools': [
      { name: 'index.html', path: 'tools/index.html', type: 'file' },
      { name: 'app.js', path: 'tools/app.js', type: 'file' },
      { name: 'app.css', path: 'tools/app.css', type: 'file' },
      { name: 'state.js', path: 'tools/state.js', type: 'file' },
      { name: 'graph.js', path: 'tools/graph.js', type: 'file' },
      { name: 'inspector.js', path: 'tools/inspector.js', type: 'file' },
      { name: 'views', path: 'tools/views', type: 'folder', children: [
        { name: 'dashboard.js', path: 'tools/views/dashboard.js', type: 'file' },
        { name: 'files.js', path: 'tools/views/files.js', type: 'file' },
        { name: 'scenes.js', path: 'tools/views/scenes.js', type: 'file' },
        { name: 'characters.js', path: 'tools/views/characters.js', type: 'file' },
        { name: 'variables.js', path: 'tools/views/variables.js', type: 'file' },
        { name: 'assets.js', path: 'tools/views/assets.js', type: 'file' },
        { name: 'settings.js', path: 'tools/views/settings.js', type: 'file' }
      ]},
      { name: 'shared', path: 'tools/shared', type: 'folder', children: [
        { name: 'utils.js', path: 'tools/shared/utils.js', type: 'file' }
      ]}
    ],
    'public': [
      { name: 'assets', path: 'public/assets', type: 'folder', children: [
        { name: 'backgrounds', path: 'public/assets/backgrounds', type: 'folder', children: [] },
        { name: 'characters', path: 'public/assets/characters', type: 'folder', children: [] },
        { name: 'audio', path: 'public/assets/audio', type: 'folder', children: [
          { name: 'bgm', path: 'public/assets/audio/bgm', type: 'folder', children: [] },
          { name: 'sfx', path: 'public/assets/audio/sfx', type: 'folder', children: [] }
        ]}
      ]}
    ],
    'src': [
      { name: 'main.js', path: 'src/main.js', type: 'file' },
      { name: 'scenes', path: 'src/scenes', type: 'folder', children: [
        { name: 'BootScene.js', path: 'src/scenes/BootScene.js', type: 'file' },
        { name: 'MenuScene.js', path: 'src/scenes/MenuScene.js', type: 'file' },
        { name: 'GameScene.js', path: 'src/scenes/GameScene.js', type: 'file' }
      ]},
      { name: 'systems', path: 'src/systems', type: 'folder', children: [
        { name: 'DataLoader.js', path: 'src/systems/DataLoader.js', type: 'file' },
        { name: 'SceneController.js', path: 'src/systems/SceneController.js', type: 'file' },
        { name: 'DialogueSystem.js', path: 'src/systems/DialogueSystem.js', type: 'file' },
        { name: 'CharacterSystem.js', path: 'src/systems/CharacterSystem.js', type: 'file' },
        { name: 'VariableSystem.js', path: 'src/systems/VariableSystem.js', type: 'file' },
        { name: 'SaveSystem.js', path: 'src/systems/SaveSystem.js', type: 'file' },
        { name: 'AudioSystem.js', path: 'src/systems/AudioSystem.js', type: 'file' },
        { name: 'SettingsSystem.js', path: 'src/systems/SettingsSystem.js', type: 'file' }
      ]}
    ],
    'tests': [
      { name: 'vitest.config.js', path: 'tests/vitest.config.js', type: 'file' },
      { name: 'setup.js', path: 'tests/setup.js', type: 'file' },
      { name: 'systems', path: 'tests/systems', type: 'folder', children: [] }
    ],
    'docs': [
      { name: 'qa-checklist.md', path: 'docs/qa-checklist.md', type: 'file' },
      { name: 'deferred-todo.md', path: 'docs/deferred-todo.md', type: 'file' },
      { name: 'editor-v2-migration.md', path: 'docs/editor-v2-migration.md', type: 'file' }
    ]
  };
  
  return structures[folderPath] || [];
}

function _getSceneFiles() {
  const scenes = _app?.data?.scenes || {};
  return Object.keys(scenes).map(id => ({
    name: `${id}.json`,
    path: `data/scenes/${id}.json`,
    type: 'file'
  }));
}

/* ─── FOLDER TREE ──────────────────────────────── */

function _renderTree() {
  const container = document.getElementById('folder-tree');
  if (!container) return;
  
  const filtered = _filterTree(_state.tree);
  container.innerHTML = filtered.map(item => _renderTreeNode(item, 0)).join('');
  
  // Bind click handlers
  container.querySelectorAll('.tree-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = el.dataset.path;
      const type = el.dataset.type;
      
      if (type === 'folder') {
        _selectFolder(path);
      }
    });
  });
}

function _renderTreeNode(node, depth) {
  const isExpanded = _state.expandedFolders.has(node.path);
  const isSelected = _state.selectedFolder === node.path;
  const icon = node.type === 'folder' ? '📁' : _getFileIcon(node.name);
  const indent = depth * 12;
  
  const childrenHtml = node.type === 'folder' && isExpanded && node.children
    ? node.children.map(child => _renderTreeNode(child, depth + 1)).join('')
    : '';
  
  const chevron = node.type === 'folder'
    ? `<svg class="tree-chevron ${isExpanded ? 'expanded' : ''}" viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;flex-shrink:0"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>`
    : '<span style="width:14px;height:14px;display:inline-block;flex-shrink:0"></span>';
  
  return `
    <div class="tree-item ${isSelected ? 'selected' : ''}" data-path="${node.path}" data-type="${node.type}">
      <div style="display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:4px;cursor:pointer">
        ${chevron}
        <span style="font-size:13px">${icon}</span>
        <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${node.name}</span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

/* ─── FILE GRID ────────────────────────────────── */

function _renderFileGrid() {
  const container = document.getElementById('file-grid');
  if (!container) return;
  
  const folderContents = _getFolderContents(_state.selectedFolder);
  const filtered = _filterContents(folderContents);
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;color:var(--text-muted)">
        <span style="font-size:48px;opacity:0.3;margin-bottom:16px">📂</span>
        <div style="font-size:14px">This folder is empty</div>
        <div style="font-size:12px;margin-top:4px">Add files to see them here</div>
      </div>
    `;
    return;
  }
  
  if (_state.viewMode === 'grid') {
    container.innerHTML = `
      <div class="file-grid">
        ${filtered.map(item => _renderFileCard(item)).join('')}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="file-list">
        ${filtered.map(item => _renderFileListItem(item)).join('')}
      </div>
    `;
  }
  
  // Bind selection
  container.querySelectorAll('.file-card, .file-list-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _selectFile(el.dataset.path);
    });
    el.addEventListener('dblclick', () => {
      _openFile(el.dataset.path);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      _selectFile(el.dataset.path);
      _showContextMenu(e.clientX, e.clientY, el.dataset.path);
    });
  });
  
  _updateStatusBar();
}

function _renderFileCard(item) {
  const isSelected = _state.selectedFile === item.path;
  const icon = _getFileIcon(item.name);
  const preview = _getPreview(item);
  
  return `
    <div class="file-card ${isSelected ? 'selected' : ''}" data-path="${item.path}">
      <div class="file-preview">${preview}</div>
      <div class="file-info">
        <span class="file-icon">${icon}</span>
        <span class="file-name" title="${item.name}">${item.name}</span>
      </div>
    </div>
  `;
}

function _renderFileListItem(item) {
  const isSelected = _state.selectedFile === item.path;
  const icon = _getFileIcon(item.name);
  
  return `
    <div class="file-list-item ${isSelected ? 'selected' : ''}" data-path="${item.path}">
      <span class="file-icon">${icon}</span>
      <span class="file-name">${item.name}</span>
      <span class="file-meta text-dim">${item.type === 'folder' ? 'Folder' : _getExt(item.name)}</span>
    </div>
  `;
}

function _getPreview(item) {
  if (item.type === 'folder') {
    return '<span style="font-size:48px">📁</span>';
  }
  
  const ext = item.name.split('.').pop()?.toLowerCase();
  
  // Image preview
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return `<img src="/assets/${item.path.replace('public/assets/', '')}" style="width:100%;height:100%;object-fit:cover" alt="${item.name}" />`;
  }
  
  // Audio preview
  if (['mp3', 'ogg', 'wav'].includes(ext)) {
    return '<span style="font-size:32px">🎵</span>';
  }
  
  // Document preview
  if (['json', 'js', 'html', 'css', 'md'].includes(ext)) {
    return '<span style="font-size:32px">📄</span>';
  }
  
  return '<span style="font-size:32px">📄</span>';
}

function _getFolderContents(folderPath) {
  return _getFolderChildren(folderPath) || [];
}

function _filterContents(contents) {
  if (!_state.searchTerm) return contents;
  
  const term = _state.searchTerm.toLowerCase();
  return contents.filter(item => item.name.toLowerCase().includes(term));
}

function _filterTree(tree) {
  if (!_state.searchTerm) return tree;
  
  const term = _state.searchTerm.toLowerCase();
  
  function filterNode(node) {
    if (node.name.toLowerCase().includes(term)) {
      return { ...node, children: node.children?.map(filterNode).filter(Boolean) };
    }
    if (node.type === 'folder' && node.children) {
      const filteredChildren = node.children.map(filterNode).filter(Boolean);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
    }
    return null;
  }
  
  return tree.map(filterNode).filter(Boolean);
}

/* ─── INTERACTIONS ─────────────────────────────── */

function _selectFolder(path) {
  _state.selectedFolder = path;
  _state.selectedFile = null;
  _renderTree();
  _renderFileGrid();
  _updateBreadcrumb();
}

function _selectFile(path) {
  _state.selectedFile = path;
  _renderFileGrid();
  _updateStatusBar();
}

async function _openFile(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  const codeExtensions = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'json', 'html', 'css', 'md', 'yaml', 'yml'];
  
  // Open code files in Script mode
  if (codeExtensions.includes(ext)) {
    try {
      // Fetch file content
      const response = await fetch(`/${path}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const content = await response.text();
      
      // Switch to Script mode if not already
      const scriptModeBtn = document.getElementById('mode-script');
      if (scriptModeBtn && document.body.dataset.mode !== 'script') {
        scriptModeBtn.click();
        // Wait for Monaco to initialize (it's async)
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Open in Monaco editor (script-editor exports to window.__openScript)
      if (window.__openScript) {
        window.__openScript(path, content);
      } else {
        console.warn('Script editor not initialized');
        alert('Script editor not loaded yet. Please try again.');
      }
    } catch (err) {
      console.error('Failed to open file:', path, err);
      alert(`Failed to open ${path}: ${err.message}`);
    }
  } else {
    // Non-code files: just show info
    console.log('Open file:', path);
    alert(`Opening ${ext.toUpperCase()} files not yet implemented`);
  }
}

function _bindEvents() {
  // Search
  const searchEl = document.getElementById('file-search');
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      _state.searchTerm = e.target.value;
      _renderTree();
      _renderFileGrid();
    });
  }
  
  // View mode
  const viewModeEl = document.getElementById('view-mode');
  if (viewModeEl) {
    viewModeEl.addEventListener('change', (e) => {
      _state.viewMode = e.target.value;
      _renderFileGrid();
    });
  }
  
  // Buttons
  document.getElementById('btn-open')?.addEventListener('click', () => {
    if (_state.selectedFile) _openFile(_state.selectedFile);
  });
  
  document.getElementById('btn-reveal')?.addEventListener('click', () => {
    if (_state.selectedFile) console.log('Reveal:', _state.selectedFile);
  });
  
  // Context menu items
  document.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      _handleContextMenuAction(item.dataset.action);
    });
  });
  
  // Global click to dismiss context menu
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('file-context-menu');
    if (menu && menu.style.display === 'block') {
      // Don't close if clicking inside the menu
      if (!menu.contains(e.target)) {
        _hideContextMenu();
      }
    }
  });
  
  // Escape key to dismiss context menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      _hideContextMenu();
    }
  });
}

function _updateBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  if (el) {
    const parts = _state.selectedFolder.split('/');
    el.textContent = parts.join(' > ');
  }
}

function _updateStatusBar() {
  const infoEl = document.getElementById('selection-info');
  const openBtn = document.getElementById('btn-open');
  const revealBtn = document.getElementById('btn-reveal');
  
  if (_state.selectedFile) {
    const name = _state.selectedFile.split('/').pop();
    infoEl.textContent = `1 item selected: ${name}`;
    infoEl.classList.remove('text-dim');
    openBtn.disabled = false;
    revealBtn.disabled = false;
  } else {
    const contents = _getFolderContents(_state.selectedFolder);
    infoEl.textContent = `${contents.length} item${contents.length !== 1 ? 's' : ''} in folder`;
    infoEl.classList.add('text-dim');
    openBtn.disabled = true;
    revealBtn.disabled = true;
  }
}

/* ─── CONTEXT MENU ─────────────────────────────── */

function _showContextMenu(x, y, filePath) {
  const menu = document.getElementById('file-context-menu');
  if (!menu) return;
  
  // Store the file path for context menu actions
  _state.contextMenuPath = filePath;
  
  // Position menu (ensure it stays within viewport)
  const menuWidth = 150;
  const menuHeight = 120;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let posX = x;
  let posY = y;
  
  // Adjust if menu would go off right edge
  if (x + menuWidth > viewportWidth) {
    posX = viewportWidth - menuWidth - 10;
  }
  
  // Adjust if menu would go off bottom edge
  if (y + menuHeight > viewportHeight) {
    posY = viewportHeight - menuHeight - 10;
  }
  
  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  menu.style.display = 'block';
}

function _hideContextMenu() {
  const menu = document.getElementById('file-context-menu');
  if (menu) {
    menu.style.display = 'none';
  }
  _state.contextMenuPath = null;
}

function _handleContextMenuAction(action) {
  if (!_state.contextMenuPath) return;
  
  switch (action) {
    case 'open':
      _openFile(_state.contextMenuPath);
      break;
    case 'reveal':
      console.log('Reveal:', _state.contextMenuPath);
      // Future: open file explorer at file location
      break;
    case 'delete':
      console.log('Delete:', _state.contextMenuPath);
      // Future: show delete confirmation dialog
      break;
  }
  
  _hideContextMenu();
}

/* ─── FILE ICONS ───────────────────────────────── */

function _getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const icons = {
    'json': '📄',
    'js': '📜',
    'html': '🌐',
    'css': '🎨',
    'md': '📝',
    'png': '🖼️',
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'gif': '🎬',
    'webp': '🖼️',
    'mp3': '🎵',
    'ogg': '🎵',
    'wav': '🎵',
    'ttf': '🔤',
    'woff': '🔤',
    'woff2': '🔤'
  };
  
  return icons[ext] || '📄';
}

function _getExt(name) {
  return name.split('.').pop()?.toUpperCase() || '';
}
