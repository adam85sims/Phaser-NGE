/**
 * app.js — Slim entry point. Wires modules together and boots the editor.
 */
import { editorState, loadProjectData, markDirty, forceSave, undo, redo, canUndo, canRedo, captureUndoState } from './state.js';
import '../src/nodes/RuntimeNodes.js';
import './nodes/EditorNodes.js';

import { renderOutline as _renderOutline } from './outline.js';
import { renderWorkspace } from './workspace.js';
import { renderInspectorContent } from './inspector.js';
import { renderScenePreview as _renderScenePreview, updateScenePreviewTransform } from './scene-preview.js';
import { initModeToggles } from './modes.js';
import { initResizers } from './resizers.js';
import { initSearch } from './search.js';

// ── Render helpers (pass callbacks to avoid circular deps) ──
function renderInspector() {
  const body = document.querySelector('#inspector .panel-body');
  if (!body) return;
  renderInspectorContent(body);
}

function renderScenePreview() {
  _renderScenePreview({ renderOutline: _renderOutline, renderInspector });
}

function renderOutline() {
  _renderOutline(renderInspector, renderScenePreview);
}

// ── Boot ───────────────────────────────────────────────
async function boot() {
  await loadProjectData();
  captureUndoState(true);

  if (editorState.activeSceneId) {
    const mod = await import('./views/scene-composer.js');
    mod.initScene(editorState.activeSceneId);
  }

  renderOutline();
  renderWorkspace();
  renderInspector();
  renderScenePreview();

  // ── Event wiring ──
  window.addEventListener('editor:render', () => {
    renderOutline();
    renderInspector();
    renderScenePreview();
  });

  window.addEventListener('scene:preview', () => {
    renderScenePreview();
  });

  window.addEventListener('inspector:refresh', () => {
    renderInspector();
  });

  window.addEventListener('editor:dirty', () => {
    document.body.dataset.dirty = 'true';
    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.textContent = '💾 Save*';
  });

  window.addEventListener('editor:saved', () => {
    document.body.dataset.dirty = 'false';
    const btnSave = document.getElementById('btn-save');
    if (btnSave) btnSave.textContent = '💾 Save';
  });

  window.addEventListener('scene:background-changed', () => {
    renderScenePreview();
    renderOutline();
  });

  // ── Topbar buttons ──
  document.getElementById('btn-play')?.addEventListener('click', async () => {
    const success = await forceSave();
    if (success) window.open('/', '_blank');
  });

  document.getElementById('btn-save')?.addEventListener('click', () => {
    forceSave();
  });

  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const settingsModal = document.getElementById('settings-modal');
  const exportModal = document.getElementById('export-modal');
  const btnExport = document.getElementById('btn-export');

  btnUndo?.addEventListener('click', () => undo());
  btnRedo?.addEventListener('click', () => redo());

  const updateUndoRedoButtons = () => {
    if (btnUndo) btnUndo.disabled = !canUndo();
    if (btnRedo) btnRedo.disabled = !canRedo();
  };
  window.addEventListener('editor:undoStateChanged', updateUndoRedoButtons);

  // ── Export Dialog ──
  // Single "Export" button opens a dialog with target cards (Web, EXE, Linux, APK).
  // Each card's Export button triggers the appropriate export handler.
  // Feature-detects window.electron for Electron-only targets.

  btnExport?.addEventListener('click', () => {
    if (exportModal) exportModal.showModal();
  });

  document.getElementById('btn-export-close')?.addEventListener('click', () => {
    exportModal?.close();
  });

  // Close on backdrop click
  exportModal?.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.close();
  });

  // Wire up all "Export" buttons inside the dialog cards
  exportModal?.querySelectorAll('.btn-export-go').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.dataset.target;
      exportModal.close();
      await handleExport(target);
    });
  });

  /**
   * Central export dispatcher. Saves first, then routes to the right export handler.
   * @param {'web'|'exe'|'linux'|'apk'} target - Export target type
   */
  async function handleExport(target) {
    try {
      await forceSave();

      switch (target) {
        case 'web':
          if (window.electron?.exportWebBuild) {
            const result = await window.electron.exportWebBuild();
            if (result?.success) alert('Web build exported successfully to:\n' + result.path);
            else if (result?.error) alert('Export failed:\n' + result.error);
          } else {
            await exportWebBrowser();
          }
          break;

        case 'exe':
          if (window.electron?.exportExeBuild) {
            const result = await window.electron.exportExeBuild();
            if (result?.success) alert('Windows EXE exported successfully to:\n' + result.path);
            else if (result?.error) alert('Export failed:\n' + result.error);
          } else {
            alert('EXE export requires the desktop app.\nRun Phaser-NGE in Electron to use this option.');
          }
          break;

        case 'linux':
        case 'apk':
          // Placeholder — these targets aren't wired up yet
          alert(`${target.toUpperCase()} export is coming soon.`);
          break;
      }
    } catch (err) {
      alert('Error during export:\n' + err.message);
    }
  }

  /**
   * Browser-side web export: fetches a ZIP from /api/export-web and triggers download.
   * Used when running in a browser without Electron.
   */
  async function exportWebBrowser() {
    const res = await fetch('/api/export-web');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Export failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game-web-export.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Web build exported! Check your downloads.');
  }

  // ── Settings modal ──
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    if (settingsModal) {
      document.getElementById('setting-project-name').value = editorState.gameConfig?.title || '';
      document.getElementById('setting-project-icon').value = editorState.gameConfig?.icon || '';
      document.getElementById('setting-viewport-w').value = editorState.gameConfig?.width || 1280;
      document.getElementById('setting-viewport-h').value = editorState.gameConfig?.height || 720;
      document.getElementById('setting-text-speed').value = editorState.gameConfig?.defaults?.textSpeed || 40;
      document.getElementById('setting-volume-bgm').value = editorState.gameConfig?.defaults?.bgmVolume || 0.7;
      document.getElementById('setting-volume-sfx').value = editorState.gameConfig?.defaults?.sfxVolume || 1;
      settingsModal.showModal();
    }
  });

  document.getElementById('btn-settings-close')?.addEventListener('click', () => settingsModal?.close());

  document.getElementById('btn-settings-save')?.addEventListener('click', () => {
    if (!editorState.gameConfig) editorState.gameConfig = {};
    if (!editorState.gameConfig.defaults) editorState.gameConfig.defaults = {};
    editorState.gameConfig.title = document.getElementById('setting-project-name').value;
    editorState.gameConfig.icon = document.getElementById('setting-project-icon').value;
    editorState.gameConfig.width = parseInt(document.getElementById('setting-viewport-w').value) || 1280;
    editorState.gameConfig.height = parseInt(document.getElementById('setting-viewport-h').value) || 720;
    editorState.gameConfig.defaults.textSpeed = parseInt(document.getElementById('setting-text-speed').value) || 40;
    editorState.gameConfig.defaults.bgmVolume = parseFloat(document.getElementById('setting-volume-bgm').value) || 0.7;
    editorState.gameConfig.defaults.sfxVolume = parseFloat(document.getElementById('setting-volume-sfx').value) || 1;
    editorState.viewportWidth = editorState.gameConfig.width;
    editorState.viewportHeight = editorState.gameConfig.height;
    settingsModal?.close();
    markDirty();
    renderScenePreview();
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  // ── Gizmo toolbar (top-level) ──
  ['pan', 'select', 'move', 'rotate', 'scale', 'origin'].forEach(mode => {
    document.getElementById(`tool-${mode}`)?.addEventListener('click', () => {
      editorState.toolMode = mode;
      ['pan', 'select', 'move', 'rotate', 'scale', 'origin'].forEach(m => {
        document.getElementById(`tool-${m}`)?.classList.toggle('active', m === mode);
      });
      renderScenePreview();
    });
  });

  document.getElementById('tool-snap')?.addEventListener('click', (e) => {
    editorState.snapEnabled = !editorState.snapEnabled;
    e.currentTarget.classList.toggle('active', editorState.snapEnabled);
  });

  // ── Workspace tab switching ──
  document.querySelectorAll('.workspace-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.textContent.toLowerCase();
      if (name.includes('dialogue')) editorState.activeWorkspaceTab = 'dialogue';
      else if (name.includes('files')) editorState.activeWorkspaceTab = 'files';
      else if (name.includes('scenes')) editorState.activeWorkspaceTab = 'scenes';
      else if (name.includes('characters')) editorState.activeWorkspaceTab = 'characters';
      else if (name.includes('variables')) editorState.activeWorkspaceTab = 'variables';
      else if (name.includes('asset')) editorState.activeWorkspaceTab = 'assets';
      renderWorkspace();
    });
  });

  // ── Asset browser hook ──
  window.addEventListener('editor:open-assets', (e) => {
    editorState.activeWorkspaceTab = 'assets';
    renderWorkspace();
    setTimeout(() => {
      const filter = e.detail?.filter;
      if (filter) document.querySelector(`[data-filter="${filter}"]`)?.click();
    }, 50);
  });

  // ── Play from node hook ──
  window.__playFromNode = (nodeId) => {
    if (editorState.activeSceneId) {
      forceSave().then((success) => {
        if (success) {
          localStorage.setItem('nge_debug_start', JSON.stringify({ sceneId: editorState.activeSceneId, nodeId }));
          window.open('/', '_blank');
        }
      });
    }
  };

  // ── Global scene switcher ──
  window.__setActiveScene = (sceneId) => {
    editorState.activeSceneId = sceneId;
    if (!editorState.expandedScenes) editorState.expandedScenes = new Set();
    editorState.expandedScenes.add(sceneId);
    editorState.selectedItemId = null;
    editorState.selectedItemType = null;
    renderOutline();
    renderScenePreview();
    import('./views/scene-composer.js').then(mod => mod.initScene(editorState.activeSceneId));
    window.dispatchEvent(new CustomEvent('scene:changed', { detail: sceneId }));
  };

  // ── Prevent accidental navigation ──
  window.addEventListener('mousedown', (e) => {
    if (e.button === 3 || e.button === 4) e.preventDefault();
  });
  history.pushState(null, document.title, location.href);
  window.addEventListener('popstate', () => history.pushState(null, document.title, location.href));

  // ── Init subsystems ──
  initResizers();
  initModeToggles(renderScenePreview);
  initSearch();
}

// ── Global prompt helper ──
window.promptAsync = (message, defaultText = '') => {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;';
    const modal = document.createElement('div');
    modal.style.cssText = 'background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:20px;width:400px;max-width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.5);';
    modal.innerHTML = `
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text-bright)">${message.replace(/</g, '&lt;')}</div>
      <input type="text" id="prompt-input" style="width:100%;background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:8px;border-radius:4px;margin-bottom:16px;font-size:13px;" value="${defaultText.replace(/"/g, '&quot;')}" />
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button id="prompt-cancel" class="btn">Cancel</button>
        <button id="prompt-ok" class="btn btn-primary">OK</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const input = modal.querySelector('#prompt-input');
    const btnOk = modal.querySelector('#prompt-ok');
    const btnCancel = modal.querySelector('#prompt-cancel');
    input.focus();
    input.select();

    const cleanup = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
    btnOk.onclick = () => { cleanup(); resolve(input.value); };
    btnCancel.onclick = () => { cleanup(); resolve(null); };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { cleanup(); resolve(input.value); }
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };
  });
};

boot();
