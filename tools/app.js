/**
 * Narrative Engine — Integrated Editor
 * Main application: shared state, data loading, view routing,
 * localStorage persistence, project export/import.
 *
 * Views are modules in /tools/views/*.js that export:
 *   { init(app) → called once on app start }
 *   { render(container, app) → called when view becomes active }
 *   { destroy() → called when leaving the view (optional) }
 */

import { $, fetchJSON, setStatus } from './shared/utils.js';

/* ─── APP STATE ──────────────────────────────────── */

export const app = {
  data: {
    game: null,
    characters: null,
    variables: null,
    scenes: {}    // { sceneId: { data, stats } }
  },
  stats: {
    sceneCount: 0,
    nodeCount: 0,
    wordCount: 0,
    choiceCount: 0,
    charCount: 0,
    varCount: 0,
    recentScenes: []
  },
  currentView: null,
  views: {},      // registered view modules
  el: {}           // cached DOM refs
};

/* ─── VIEW REGISTRATION ──────────────────────────── */

export function registerView(name, module) {
  app.views[name] = module;
}

/* ─── NAVIGATION ─────────────────────────────────── */

const navConfig = [
  { id: 'dashboard',    icon: '◈', label: 'Dashboard' },
  { id: 'scenes',       icon: '✍', label: 'Scenes' },
  { id: 'dialogue',     icon: '◇', label: 'Dialogue Editor' },
  { id: 'characters',   icon: '👤', label: 'Characters' },
  { id: 'variables',    icon: '📊', label: 'Variables' },
  { id: 'assets',       icon: '🖼', label: 'Assets' },
  { id: 'layouts',      icon: '🎬', label: 'Layouts' },
  { id: 'settings',     icon: '⚙', label: 'Settings' },
];

export function navigateTo(viewId) {
  if (!app.views[viewId]) {
    console.warn(`View not found: ${viewId}`);
    return;
  }

  // Destroy current view
  if (app.currentView && app.views[app.currentView]?.destroy) {
    app.views[app.currentView].destroy();
  }

  app.currentView = viewId;
  window.location.hash = viewId;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });

  // Update breadcrumb
  const nav = navConfig.find(n => n.id === viewId);
  const breadcrumb = app.el.breadcrumb;
  if (breadcrumb) {
    breadcrumb.innerHTML = nav ? `${nav.icon} ${nav.label}` : viewId;
  }

  // Render view
  const container = app.el.content;
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  // Use requestAnimationFrame to let the spinner render before the view's potentially synchronous render
  requestAnimationFrame(() => {
    try {
      app.views[viewId].render(container, app);
    } catch (e) {
      console.error(`Error rendering view "${viewId}":`, e);
      container.innerHTML = `
        <div class="placeholder-view">
          <div class="big-icon">⚠</div>
          <h2>View Error</h2>
          <p>${e.message || 'An unexpected error occurred'}</p>
          <button class="btn" onclick="location.reload()">Reload</button>
        </div>`;
    }
  });
}

/* ════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage auto-save + project export/import
   ════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'narrative_engine_project';
const STORAGE_VERSION = 1;
let _projectDirty = false;
let _saveTimer = null;

/**
 * Serialise the entire in-memory project state to a portable object.
 */
function serializeProject() {
  const scenes = {};
  for (const [id, entry] of Object.entries(app.data.scenes || {})) {
    scenes[id] = entry.data;
  }
  return {
    version: STORAGE_VERSION,
    savedAt: Date.now(),
    title: app.data.game?.title || 'Untitled',
    game: app.data.game,
    characters: app.data.characters,
    variables: app.data.variables,
    scenes
  };
}

/**
 * Rebuild stats and top-bar from a loaded project snapshot.
 */
function rebuildStats(data) {
  const sceneIds = data.game?.scenes || [];
  app.stats.sceneCount = sceneIds.length;
  app.stats.charCount = Object.keys(data.characters || {}).length;
  app.stats.varCount = Object.keys(data.variables || {}).length;

  let totalNodes = 0, totalWords = 0, totalChoices = 0;
  const recentScenes = [];

  for (const id of sceneIds) {
    const s = app.data.scenes[id]?.data;
    if (s) {
      const nodes = s.nodes || [];
      const nc = nodes.length;
      totalNodes += nc;
      totalWords += countWordsInNodes(nodes);
      totalChoices += countChoicesInNodes(nodes);
      recentScenes.push({ id, nodes: nc, words: countWordsInNodes(nodes), choices: countChoicesInNodes(nodes) });
    }
  }

  app.stats.nodeCount = totalNodes;
  app.stats.wordCount = totalWords;
  app.stats.choiceCount = totalChoices;
  app.stats.recentScenes = recentScenes;

  if (app.el.projectName) {
    app.el.projectName.textContent = data.game?.title || 'Untitled';
  }
  if (app.el.statusBadge) {
    app.el.statusBadge.textContent = `${sceneIds.length} scenes · ${totalNodes} nodes`;
  }
}

/**
 * Apply a serialized project snapshot into app state.
 */
function applyProjectSnapshot(data) {
  app.data.game = data.game || { title: 'Untitled', version: '1.0.0', scenes: [], defaults: {} };
  app.data.characters = data.characters || {};
  app.data.variables = data.variables || {};
  app.data.scenes = {};
  if (data.scenes) {
    for (const [id, sceneData] of Object.entries(data.scenes)) {
      app.data.scenes[id] = { data: sceneData };
    }
  }
  rebuildStats(data);
}

/* ─── LOCALSTORAGE ──────────────────────────────── */

/**
 * Save the current project to localStorage.
 * Called on auto-save timer and explicitly on important actions.
 */
function saveProjectToStorage() {
  try {
    const data = serializeProject();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage full or disabled — silently degrade
    console.warn('Project save failed:', e);
  }
}

/**
 * Load a saved project from localStorage. Returns null if none exists.
 */
function loadProjectFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Helper shared by auto-save timer, explicit save, and pagehide:
 * persist state + clear dirty flag + remove the dirty visual indicator.
 */
function _finaliseSave() {
  saveProjectToStorage();
  _projectDirty = false;
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.remove('dirty');
}

/**
 * Mark the project as dirty and schedule an auto-save in 2 seconds.
 * Views call this whenever they modify project data.
 * The timer is reset on each call so rapid edits batch into one save.
 * Also lights up the Save button to signal unsaved changes.
 */
window.__markProjectDirty = () => {
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.add('dirty');

  clearTimeout(_saveTimer);
  _projectDirty = true;
  _saveTimer = setTimeout(_finaliseSave, 2000);
};

/* ─── EXPLICIT SAVE ──────────────────────────────── */

/**
 * Immediately persist project state to localStorage — bypasses the 2s
 * auto-save debounce. Shows a brief "✓ Saved" confirmation on the button.
 */
window.__saveProject = () => {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  _finaliseSave();

  // Flash feedback on the save button
  const btn = document.getElementById('btn-save');
  if (btn) {
    btn.classList.add('saved');
    btn.innerHTML = '✓ Saved';
    setTimeout(() => {
      btn.classList.remove('saved');
      btn.innerHTML = '💾 Save';
    }, 1500);
  }
};

/* ─── EXPORT ─────────────────────────────────────── */

/**
 * Trigger a browser download of a JSON object as a .json file.
 * Reused by export, new-project save, and any other flow that needs
 * to hand a file to the user's save dialog.
 */
function _triggerDownload(jsonData, baseFilename) {
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseFilename.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download the entire project as a single portable JSON bundle.
 * This is the sharing + git-friendly export format.
 * Drop the file into a colleague's editor via Import to restore everything.
 */
window.__exportProject = () => {
  const data = serializeProject();
  const title = data.title?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project';
  _triggerDownload(data, `${title}-narrative-project`);
};

/* ─── IMPORT ─────────────────────────────────────── */

/**
 * Open a file picker, read a project bundle, and apply it.
 */
window.__openImportProject = () => {
  const input = document.getElementById('import-file-input');
  if (!input) return;
  input.value = '';   // reset so the same file can be re-picked
  input.click();
};

window.__importProject = async (file) => {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.version !== STORAGE_VERSION) {
      alert(`Unsupported project version: ${data.version}. Expected version ${STORAGE_VERSION}.`);
      return;
    }
    if (!data.game || !data.characters) {
      alert('Invalid project bundle: missing game or characters data.');
      return;
    }

    // Confirm before replacing
    const hasContent = app.stats.sceneCount > 0 || app.stats.charCount > 1 || app.stats.varCount > 0;
    if (hasContent && !confirm(`Replace current project "${app.data.game?.title || 'Untitled'}" with "${data.title || 'Untitled'}"? Unsaved changes will be lost.`)) {
      return;
    }

    // Apply and persist
    applyProjectSnapshot(data);
    saveProjectToStorage();
    _projectDirty = false;

    // Update the status badge to reflect saved state
    if (app.el.statusBadge) {
      app.el.statusBadge.textContent = `${app.stats.sceneCount} scenes · ${app.stats.nodeCount} nodes`;
    }

    navigateTo('dashboard');
  } catch (e) {
    console.error('Import error:', e);
    alert('Failed to import project: ' + e.message);
  }
};

/* ─── DATA LOADING (disk fallback) ────────────────── */

export async function loadProjectData() {
  try {
    const [game, chars, vars] = await Promise.all([
      fetchJSON('/data/game.json'),
      fetchJSON('/data/characters.json'),
      fetchJSON('/data/variables.json')
    ]);

    app.data.game = game;
    app.data.characters = chars;
    app.data.variables = vars;
    app.stats.charCount = Object.keys(chars || {}).length;
    app.stats.varCount = Object.keys(vars || {}).length;

    // Load scenes
    const sceneIds = game.scenes || [];
    app.stats.sceneCount = sceneIds.length;
    let totalNodes = 0, totalWords = 0, totalChoices = 0;
    const recentScenes = [];

    for (const id of sceneIds) {
      try {
        const scene = await fetchJSON(`/data/scenes/${id}.json`);
        const nodes = scene.nodes || [];
        app.data.scenes[id] = { data: scene };

        const nodeCount = nodes.length;
        const wordCount = countWordsInNodes(nodes);
        const choiceCount = countChoicesInNodes(nodes);
        totalNodes += nodeCount;
        totalWords += wordCount;
        totalChoices += choiceCount;

        recentScenes.push({
          id,
          nodes: nodeCount,
          words: wordCount,
          choices: choiceCount
        });
      } catch (e) {
        // Scene file not found — skip
      }
    }

    app.stats.nodeCount = totalNodes;
    app.stats.wordCount = totalWords;
    app.stats.choiceCount = totalChoices;
    app.stats.recentScenes = recentScenes;

    // Update top bar
    if (app.el.projectName) {
      app.el.projectName.textContent = game.title || 'Untitled';
    }
    if (app.el.statusBadge) {
      app.el.statusBadge.textContent = `${sceneIds.length} scenes · ${totalNodes} nodes`;
    }

  } catch (e) {
    console.error('Failed to load project data:', e);
    if (app.el.projectName) app.el.projectName.textContent = 'Loading Error';
  }
}

/* ─── NEW PROJECT WIZARD ────────────────────────── */

/** Template for a blank project */
function emptyProjectTemplate(title) {
  return {
    game: {
      title: title || 'Untitled Narrative',
      version: '1.0.0',
      startScene: '',
      scenes: [],
      defaults: { textSpeed: 40, autoAdvance: false, bgmVolume: 0.7, sfxVolume: 1.0 }
    },
    characters: {
      narrator: { name: null, color: '#ffffff' }
    },
    variables: {}
  };
}

window.__showNewProjectModal = () => {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  // Focus and select the input text for easy replacement
  const input = document.getElementById('new-project-name');
  if (input) {
    input.focus();
    input.select();
  }
};

window.__hideNewProjectModal = () => {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
};

/**
 * Closes the modal and resets all in-memory project state to a clean template.
 * Persists the empty project to localStorage immediately so the next page load
 * shows the blank project, not the sample data from disk.
 */
window.__confirmNewProject = () => {
  const input = document.getElementById('new-project-name');
  const title = input ? input.value.trim() || 'Untitled Narrative' : 'Untitled Narrative';

  // Create clean template
  const blank = emptyProjectTemplate(title);

  // Reset app state
  app.data.game = blank.game;
  app.data.characters = blank.characters;
  app.data.variables = blank.variables;
  app.data.scenes = {};

  app.stats.sceneCount = 0;
  app.stats.nodeCount = 0;
  app.stats.wordCount = 0;
  app.stats.choiceCount = 0;
  app.stats.charCount = Object.keys(blank.characters).length;
  app.stats.varCount = 0;
  app.stats.recentScenes = [];

  // Update top bar
  if (app.el.projectName) {
    app.el.projectName.textContent = blank.game.title;
  }
  if (app.el.statusBadge) {
    app.el.statusBadge.textContent = '0 scenes · 0 nodes';
  }

  // Persist to localStorage immediately
  _finaliseSave();

  // Trigger a download so the user can choose a save location on disk
  _triggerDownload(serializeProject(), `${title}-narrative-project`);

  // Hide the modal and show the fresh state
  window.__hideNewProjectModal();
  navigateTo('dashboard');
};

/* ─── UTILITY ────────────────────────────────────── */

function countWordsInNodes(nodes) {
  let count = 0;
  for (const n of nodes) {
    if (n.text) count += n.text.split(/\s+/).filter(Boolean).length;
    if (n.choices) {
      for (const c of n.choices) {
        if (c.text) count += c.text.split(/\s+/).filter(Boolean).length;
      }
    }
  }
  return count;
}

function countChoicesInNodes(nodes) {
  return nodes.reduce((sum, n) => sum + (n.choices?.length || 0), 0);
}

/* ─── BOOT ───────────────────────────────────────── */

let _booted = false;

export async function boot() {
  if (_booted) return;
  _booted = true;
  // Cache DOM refs
  app.el.content = $('content');
  app.el.sidebar = $('sidebar');
  app.el.breadcrumb = $('breadcrumb');
  app.el.projectName = $('project-name');
  app.el.statusBadge = $('status-badge');

  // Check if we can render
  if (!app.el.content) {
    console.error('Content area not found. Is #content present in the HTML?');
    return;
  }

  // Render sidebar nav items into the dedicated #nav-list container
  const navList = document.querySelector('#sidebar #nav-list');
  if (navList) {
    navList.innerHTML = navConfig.map(n =>
      `<div class="nav-item" data-view="${n.id}" onclick="window.__navigate('${n.id}')">
        <span class="icon">${n.icon}</span> ${n.label}
      </div>`
    ).join('');
  }

  // Bind the import file input
  const importInput = document.getElementById('import-file-input');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) window.__importProject(file);
    });
  }

  // Load project: prefer localStorage (user's working session) over disk (sample defaults)
  const stored = loadProjectFromStorage();
  if (stored) {
    applyProjectSnapshot(stored);
  } else {
    await loadProjectData();
    // Seed localStorage with the freshly loaded project so the user's first save
    // doesn't get blown away by a reload before they've made any edits
    saveProjectToStorage();
  }

  // Mark as clean after initial load
  _projectDirty = false;

  // Start on the dashboard, or follow the hash
  const startView = window.location.hash?.slice(1) || 'dashboard';
  navigateTo(app.views[startView] ? startView : 'dashboard');

  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const id = window.location.hash?.slice(1) || 'dashboard';
    if (id !== app.currentView && app.views[id]) {
      navigateTo(id);
    }
  });
}

// Expose navigate globally so nav items can use onclick
window.__navigate = navigateTo;

// Save on page unload so refreshes and tab-closes don't lose the last 2-second debounce
window.addEventListener('pagehide', () => {
  if (_projectDirty) {
    clearTimeout(_saveTimer);
    _finaliseSave();
  }
});

// NOTE: boot() is called from index.html's <script type="module"> block
// AFTER all views are registered, to avoid a race where navigateTo runs
// before registerView calls have completed.
