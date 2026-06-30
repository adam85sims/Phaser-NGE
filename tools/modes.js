/**
 * modes.js — Mode toggle rendering: Scene, Script, Animations, Menu, Splash.
 */
import { editorState } from './state.js';

let _scriptEditorModule = null;
let _animationsEditorModule = null;
let _menuEditorModule = null;
let _splashEditorModule = null;

export function initModeToggles(renderScenePreview) {
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.id.replace('mode-', '');
      document.body.dataset.mode = mode;
      editorState.activeMode = mode;

      const sceneView = document.getElementById('scene-view');
      if (mode === 'script') {
        renderScriptMode(sceneView);
      } else if (mode === 'animations') {
        renderAnimationsMode(sceneView);
      } else if (mode === 'menu') {
        renderMenuMode(sceneView);
      } else if (mode === 'splash') {
        renderSplashMode(sceneView);
      } else {
        renderSceneMode(sceneView, renderScenePreview);
      }
    });
  });
}

async function renderScriptMode(container) {
  if (!container) return;

  container.innerHTML = `
    <div id="script-editor-container" style="height:100%;display:flex;flex-direction:column">
      <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
        <div style="text-align:center">
          <span style="font-size:48px;opacity:0.3;display:block;margin-bottom:16px">📜</span>
          <div style="font-size:14px">Script Mode</div>
          <div style="font-size:12px;margin-top:8px;color:var(--text-dim)">
            Open a file from the Files tab to edit
          </div>
        </div>
      </div>
    </div>
  `;

  if (!_scriptEditorModule) {
    _scriptEditorModule = await import('./views/script-editor.js');
    _scriptEditorModule.init({ data: editorState, stats: editorState.stats });
    _scriptEditorModule.render(container, { data: editorState, stats: editorState.stats });
  }
}

async function renderAnimationsMode(container) {
  if (!container) return;
  if (!_animationsEditorModule) {
    _animationsEditorModule = await import('./views/animations.js');
  }
  _animationsEditorModule.render(container, { data: editorState });
}

async function renderMenuMode(container) {
  if (!container) return;
  container.innerHTML = `<div id="menu-editor-container" style="height:100%;display:flex;flex-direction:column;position:relative"></div>`;
  if (!_menuEditorModule) _menuEditorModule = await import('./views/menu-editor.js');
  if (_menuEditorModule.init) _menuEditorModule.init({ data: editorState });
  _menuEditorModule.render(document.getElementById('menu-editor-container'), { data: editorState });
}

async function renderSplashMode(container) {
  if (!container) return;
  container.innerHTML = `<div id="splash-editor-container" style="height:100%;display:flex;flex-direction:column;position:relative"></div>`;
  if (!_splashEditorModule) _splashEditorModule = await import('./views/splash-editor.js');
  if (_splashEditorModule.init) _splashEditorModule.init({ data: editorState });
  _splashEditorModule.render(document.getElementById('splash-editor-container'), { data: editorState });
}

function renderSceneMode(container, renderScenePreview) {
  if (!container) return;

  container.innerHTML = `
    <div id="canvas-area">
      <div class="grid-background"></div>
      <div class="canvas-content">
        <div class="preview-sprite">🦖</div>
        <div class="canvas-label">
          <h1>Phaser 4 + NGE</h1>
          <p>Vite + TypeScript</p>
        </div>
      </div>
    </div>
    <div id="scene-toolbar">
      <div class="tool-group">
        <button class="icon-btn ${editorState.toolMode === 'pan' ? 'active' : ''}" data-tool="pan" title="Pan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg></button>
        <button class="icon-btn ${editorState.toolMode === 'select' ? 'active' : ''}" data-tool="select" title="Select"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg></button>
        <button class="icon-btn ${editorState.toolMode === 'move' ? 'active' : ''}" data-tool="move" title="Move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M12 2l-4 4M12 2l4 4M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4M12 22l-4-4M12 22l4-4"/></svg></button>
      </div>
      <div class="tool-sep"></div>
      <div class="tool-group">
        <button class="icon-btn ${editorState.toolMode === 'rotate' ? 'active' : ''}" data-tool="rotate" title="Rotate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round"/></svg></button>
        <button class="icon-btn ${editorState.toolMode === 'scale' ? 'active' : ''}" data-tool="scale" title="Scale"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm16 0h2v7h-7v-2h5v-5z"/></svg></button>
        <button class="icon-btn ${editorState.toolMode === 'origin' ? 'active' : ''}" data-tool="origin" title="Origin"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-10-10h4m12 0h4" stroke="currentColor" stroke-width="2"/></svg></button>
        <button class="icon-btn ${editorState.snapEnabled ? 'active' : ''}" data-tool="snap" title="Grid Snap"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg></button>
      </div>
      <div class="tool-sep"></div>
      <div class="tool-group">
        <button class="icon-btn" data-tool="zoom-out" title="Zoom Out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/></svg></button>
        <button class="icon-btn" data-tool="zoom-in" title="Zoom In"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg></button>
        <button class="icon-btn" data-tool="zoom-reset" title="Reset View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
      </div>
    </div>
  `;

  // Bind toolbar clicks
  const tb = container.querySelector('#scene-toolbar');
  if (tb) {
    tb.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-btn');
      if (!btn) return;
      const tool = btn.dataset.tool;
      if (['pan', 'select', 'move', 'rotate', 'scale', 'origin'].includes(tool)) {
        editorState.toolMode = tool;
        renderSceneMode(container, renderScenePreview);
      } else if (tool === 'snap') {
        editorState.snapEnabled = !editorState.snapEnabled;
        renderSceneMode(container, renderScenePreview);
      } else if (tool === 'zoom-in') {
        editorState.previewZoom = Math.min(2, editorState.previewZoom + 0.1);
        renderScenePreview();
      } else if (tool === 'zoom-out') {
        editorState.previewZoom = Math.max(0.2, editorState.previewZoom - 0.1);
        renderScenePreview();
      } else if (tool === 'zoom-reset') {
        editorState.previewZoom = 1;
        editorState.previewPanX = 0;
        editorState.previewPanY = 0;
        renderScenePreview();
      }
    });
  }

  renderScenePreview();
}
