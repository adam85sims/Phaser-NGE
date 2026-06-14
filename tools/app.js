import { editorState, loadProjectData, markDirty, forceSave } from './state.js';
import '../src/nodes/CoreNodes.js';

// ── Boot ───────────────────────────────────────────────
async function boot() {
  await loadProjectData();
  
  if (editorState.activeSceneId) {
    const mod = await import('./views/scene-composer.js');
    mod.initScene(editorState.activeSceneId);
  }
  
  renderOutline();
  renderWorkspace();
  renderInspector();
  renderScenePreview();
  
  // Bind topbar actions
  document.getElementById('btn-play')?.addEventListener('click', async () => {
    const success = await forceSave();
    if (success) {
      window.open('/', '_blank');
    }
  });

  window.addEventListener('editor:render', () => {
    renderOutline();
    renderInspector();
    renderScenePreview();
    // Don't re-render workspace, as it would destroy the canvas
  });

  window.addEventListener('scene:preview', () => {
    renderScenePreview();
  });

  // inspector:refresh re-renders just the inspector (e.g. event type change swaps value fields)
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

  document.getElementById('btn-save')?.addEventListener('click', () => {
    forceSave();
  });

  // Listen for background changes from asset apply
  window.addEventListener('scene:background-changed', () => {
    renderScenePreview();
    renderOutline(); // refresh layer list
  });

  // Gizmo Toolbar Setup
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

  // Init panel resize handles
  initResizers();

  // Asset Browser Hook
  window.addEventListener('editor:open-assets', (e) => {
    editorState.activeWorkspaceTab = 'assets';
    renderWorkspace();
    setTimeout(() => {
      const filter = e.detail?.filter;
      if (filter) {
        document.querySelector(`[data-filter="${filter}"]`)?.click();
      }
    }, 50);
  });

  // Play from node hook
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

  // Global scene switcher
  window.__setActiveScene = (sceneId) => {
    editorState.activeSceneId = sceneId;
    if (!editorState.expandedScenes) editorState.expandedScenes = new Set();
    editorState.expandedScenes.add(sceneId);
    editorState.selectedItemId = null;
    editorState.selectedItemType = null;
    renderOutline();
    renderScenePreview();
    
    // Initialize scene composer for this scene
    import('./views/scene-composer.js').then(mod => {
      mod.initScene(editorState.activeSceneId);
    });
    
    // Dispatch an event so graph.js can reset camera if needed
    window.dispatchEvent(new CustomEvent('scene:changed', { detail: sceneId }));
  };
}

// ── Render functions ───────────────────────────────────

function renderOutline() {
  const body = document.querySelector('#outline .panel-body');
  if (!body) return;

  const sceneId = editorState.activeSceneId;
  let html = '';

  if (!sceneId) {
    body.innerHTML = `<div class="text-dim" style="font-size:10px;padding:8px 6px;">No scene selected</div>`;
    return;
  }

  // Scene header
  html += `
    <div class="outline-section-header" style="display:flex;align-items:center;gap:4px;padding:6px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-bright);background:var(--bg-elevated);border-bottom:1px solid var(--border);">
      <span>🎬 ${sceneId}</span>
    </div>
  `;

  // OBJECTS section (formerly Layers)
  html += `
    <div class="outline-section-header" style="display:flex;align-items:center;gap:4px;padding:4px 6px;margin-top:4px;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-bottom:1px solid var(--border);">
      <span>🎨 Objects</span>
      <button class="icon-btn-sm" data-add-layer="container" title="Add Container" style="margin-left:auto;padding:2px 4px">📁</button>
      <button class="icon-btn-sm" data-add-layer="background" title="Add Background" style="padding:2px 4px">+</button>
    </div>
  `;

  const sceneData = editorState.scenes[sceneId];
  if (sceneData && sceneData.layers && sceneData.layers.length > 0) {
    const renderNode = (layer, depth = 0) => {
      const layerSelected = editorState.selectedItemId === layer.id && editorState.selectedItemType === 'layer';
      const isContainer = layer.type === 'container';
      const icon = isContainer ? '📁' : (layer.type === 'background' ? '🖼️' : '📦');
      const eyeIcon = layer.hidden ? '👁️‍🗨️' : '👁️';
      const opacity = layer.hidden ? '0.5' : '1';
      
      let nodeHtml = `<div class="tree-item ${layerSelected ? 'selected' : ''}" 
        data-layer="${layer.id}" 
        data-type="layer" 
        draggable="true"
        style="opacity:${opacity}; padding-right: 4px; padding-left: ${8 + depth * 12}px;">
        <span style="color:var(--text-dim);font-size:9px;width:14px">${icon}</span>
        <span style="font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;">${layer.asset || layer.id}</span>
        <button class="icon-btn-sm toggle-visibility" data-toggle-visibility="${layer.id}" title="Toggle Visibility" style="padding:0 4px;background:none;border:none;cursor:pointer;">${eyeIcon}</button>
      </div>`;
      
      if (isContainer && layer.children) {
        layer.children.forEach(child => {
          nodeHtml += renderNode(child, depth + 1);
        });
      }
      return nodeHtml;
    };
    
    sceneData.layers.forEach(layer => {
      html += renderNode(layer);
    });
  } else {
    html += `<div class="text-dim" style="font-size:10px;padding:8px 6px;opacity:0.5">No objects — drag assets to scene</div>`;
  }

  body.innerHTML = html;

  // Layer clicks
  body.querySelectorAll('.tree-item[data-type="layer"]').forEach(el => {
    el.addEventListener('click', (e) => {
      // ignore click if it was on the eye icon
      if (e.target.closest('.toggle-visibility')) return;
      e.stopPropagation();
      editorState.selectedItemId = el.dataset.layer;
      editorState.selectedItemType = 'layer';
      renderOutline();
      renderInspector();
    });
  });

  // Visibility toggle clicks
  body.querySelectorAll('.toggle-visibility').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const layerId = el.dataset.toggleVisibility;
      const layer = sceneData.layers.find(l => l.id === layerId);
      if (layer) {
        layer.hidden = !layer.hidden;
        markDirty();
        renderOutline();
        renderScenePreview();
      }
    });
  });

  // Add layer button
  body.querySelectorAll('[data-add-layer]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const layerType = el.dataset.addLayer;
      if (layerType === 'background') {
        // Open asset browser to backgrounds
        const assetTab = document.querySelector('[data-filter="backgrounds"]');
        if (assetTab) assetTab.click();
      } else if (layerType === 'container') {
        const mod = await import('./views/scene-composer.js');
        mod.addContainerLayer();
        markDirty();
        renderOutline();
      }
    });
  });

  // Drag and Drop reordering and parenting
  let draggedLayerId = null;

  body.querySelectorAll('.tree-item[data-type="layer"]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      draggedLayerId = el.dataset.layer;
      e.dataTransfer.effectAllowed = 'move';
      e.target.style.opacity = '0.5';
    });

    el.addEventListener('dragend', (e) => {
      e.target.style.opacity = '';
      body.querySelectorAll('.tree-item').forEach(n => n.classList.remove('drag-over'));
      draggedLayerId = null;
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.remove('drag-over');
      
      const targetLayerId = el.dataset.layer;
      if (!draggedLayerId || draggedLayerId === targetLayerId) return;

      const mod = await import('./views/scene-composer.js');
      mod.reparentLayer(draggedLayerId, targetLayerId);
      markDirty();
      renderOutline();
      renderScenePreview();
    });
  });
}

function renderWorkspace() {
  // Update active tab visuals
  document.querySelectorAll('.workspace-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent.toLowerCase().includes(editorState.activeWorkspaceTab));
  });

  const body = document.querySelector('.workspace-body');
  if (!body) return;

  if (editorState.activeWorkspaceTab === 'dialogue') {
    body.innerHTML = `
      <div id="graph-container" style="position:relative; width:100%; height:100%; overflow:hidden;">
        <!-- Graph toolbar -->
        <div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:6px">
          <button id="btn-graph-add-node" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px">+ Node</button>
          <button id="btn-graph-del-node" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:#ef4444">Delete</button>
        </div>
        <button id="btn-graph-fullscreen" class="btn" style="position:absolute; top:8px; right:8px; z-index:10; background:var(--bg-elevated); border:1px solid var(--border);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          Fullscreen
        </button>
        <canvas id="graph-canvas"></canvas>
      </div>
    `;
    // Lazy load and mount graph module
    import('./graph.js').then(module => {
      module.mountGraph(document.getElementById('graph-container'));

      // Wire graph toolbar buttons
      const addBtn = document.getElementById('btn-graph-add-node');
      const delBtn = document.getElementById('btn-graph-del-node');
      if (addBtn) addBtn.addEventListener('click', () => module.createNode('dialogue'));
      if (delBtn) delBtn.addEventListener('click', () => module.deleteSelectedNode());
    });

    const fullscreenBtn = document.getElementById('btn-graph-fullscreen');
    const graphContainer = document.getElementById('graph-container');
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        graphContainer.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });
  } else {
    // Render view modules for other tabs
    const viewMap = {
      'files': () => import('./views/files.js'),
      'assets': () => import('./views/assets.js'),
      'scenes': () => import('./views/scenes.js'),
      'characters': () => import('./views/characters.js'),
      'variables': () => import('./views/variables.js')
    };
    
    const viewLoader = viewMap[editorState.activeWorkspaceTab];
    if (viewLoader) {
      viewLoader().then(module => {
        // Build app context from editorState
        const recentScenes = Object.keys(editorState.scenes).map(id => {
          const scene = editorState.scenes[id];
          const nodes = scene?.nodes || [];
          return {
            id,
            nodes: nodes.length,
            words: _countWords(nodes),
            choices: _countChoices(nodes)
          };
        });

        const appContext = {
          data: {
            game: editorState.gameConfig,
            scenes: editorState.scenes,
            characters: editorState.characters,
            variables: editorState.variableDefs
          },
          stats: {
            sceneCount: editorState.stats.sceneCount,
            nodeCount: editorState.stats.nodeCount,
            charCount: Object.keys(editorState.characters).length,
            varCount: Object.keys(editorState.variableDefs).length,
            recentScenes
          }
        };
        
        // Initialize view if it has init
        if (module.init) module.init(appContext);
        module.render(body, appContext);
        
        // Expose navigation helper for views
        window.__navigate = (tab) => {
          editorState.activeWorkspaceTab = tab;
          renderWorkspace();
        };
        window.__markProjectDirty = markDirty;
      });
    } else {
      body.innerHTML = `<div style="padding:20px; color:var(--text-muted)">${editorState.activeWorkspaceTab} module coming soon...</div>`;
    }
  }
}

function renderInspector() {
  const body = document.querySelector('#inspector .panel-body');
  if (!body) return;

  import('./inspector.js').then(module => {
    module.renderInspectorContent(body);
  });
}

function renderScenePreview() {
  const canvasArea = document.getElementById('canvas-area');
  if (!canvasArea) return;

  const sceneData = editorState.scenes[editorState.activeSceneId];
  // Layers are ordered by zIndex ascending → lower z paints first (behind), higher z paints last (in front).
  // Every layer with an `asset` is rendered as an absolutely-positioned image div. The `type` field is
  // preserved in data for future use (anchor-to-speaker, expression binding, etc.) but the preview
  // renderer is type-agnostic — all layers behave like image layers.
  const layers = (sceneData?.layers || [])
    .slice()
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  const VW = editorState.viewportWidth || 1280;
  const VH = editorState.viewportHeight || 720;
  const RULER_SIZE = 24;

  // Game camera frame (1280x720 inside viewport)
  const GA = 1280;  // game area width
  const GB = 720;  // game area height
  const camLeft = Math.round((VW - GA) / 2);
  const camTop = Math.round((VH - GB) / 2);

  // Build a stack of layer divs. Each layer paints full-viewport, transformed by its own x/y/scale
  // and stacked via CSS z-index.
  const layerHTML = layers.map(layer => {
    if (!layer.asset) return '';
    const x = layer.x ?? 0;
    const y = layer.y ?? 0;
    const scale = layer.scale ?? 1;
    const opacity = layer.hidden ? 0 : (layer.opacity ?? 1);
    const z = layer.zIndex ?? 0;
    const rot = layer.rotation ?? 0;
    const displayStyle = layer.hidden ? 'display:none;' : '';
    const isSelected = editorState.selectedItemId === layer.id && editorState.selectedItemType === 'layer';
    
    const invScale = scale === 0 ? 1 : 1 / Math.abs(scale);
    let handlesHTML = '';
    
    if (isSelected) {
      if (editorState.toolMode === 'scale') {
        const hStyle = `position:absolute; width:8px; height:8px; background:#fff; border:1px solid var(--accent); pointer-events:auto; transform: scale(${invScale});`;
        handlesHTML += `
          <div class="gizmo-handle scale-handle" data-corner="tl" style="${hStyle} left:0; top:0; margin-left:-4px; margin-top:-4px; cursor:nwse-resize"></div>
          <div class="gizmo-handle scale-handle" data-corner="tr" style="${hStyle} right:0; top:0; margin-right:-4px; margin-top:-4px; cursor:nesw-resize"></div>
          <div class="gizmo-handle scale-handle" data-corner="bl" style="${hStyle} left:0; bottom:0; margin-left:-4px; margin-bottom:-4px; cursor:nesw-resize"></div>
          <div class="gizmo-handle scale-handle" data-corner="br" style="${hStyle} right:0; bottom:0; margin-right:-4px; margin-bottom:-4px; cursor:nwse-resize"></div>
        `;
      } else if (editorState.toolMode === 'rotate') {
        const hStyle = `position:absolute; width:10px; height:10px; background:var(--accent); border-radius:50%; pointer-events:auto; transform: scale(${invScale});`;
        handlesHTML += `
          <div style="position:absolute; left:50%; top:-20px; width:1px; height:20px; background:var(--accent); pointer-events:none; transform: scaleY(${invScale}); transform-origin: bottom;"></div>
          <div class="gizmo-handle rotate-handle" style="${hStyle} left:50%; top:-20px; margin-left:-5px; margin-top:-5px; cursor:crosshair"></div>
        `;
      } else if (editorState.toolMode === 'origin') {
        const originX = layer.originX ?? 0.5;
        const originY = layer.originY ?? 0.5;
        const originXPct = Math.round(originX * 100);
        const originYPct = Math.round(originY * 100);
        const originHandleStyle = `position:absolute; width:12px; height:12px; background:#ff6b6b; border:2px solid #fff; border-radius:50%; pointer-events:auto; transform: translate(-50%, -50%) scale(${invScale}); box-shadow: 0 0 4px rgba(0,0,0,0.5); cursor: move;`;
        handlesHTML += `
          <div class="gizmo-handle origin-handle" data-layer-id="${layer.id}" style="${originHandleStyle} left:${originXPct}%; top:${originYPct}%"></div>
          <div style="position:absolute; left:${originXPct}%; top:${originYPct}%; width:1px; height:100%; background:rgba(255,107,107,0.3); pointer-events:none; transform: translateX(-50%);"></div>
          <div style="position:absolute; left:${originXPct}%; top:${originYPct}%; width:100%; height:1px; background:rgba(255,107,107,0.3); pointer-events:none; transform: translateY(-50%);"></div>
        `;
      } else if (editorState.toolMode === 'move') {
        const hStyleX = `position:absolute; width:30px; height:6px; background:#ff3366; pointer-events:auto; transform: scale(${invScale}); cursor: ew-resize; border-radius:3px;`;
        const hStyleY = `position:absolute; width:6px; height:30px; background:#33cc66; pointer-events:auto; transform: scale(${invScale}); cursor: ns-resize; border-radius:3px;`;
        handlesHTML += `
          <div class="gizmo-handle move-x-handle" data-layer-id="${layer.id}" data-axis="x" style="${hStyleX} left:50%; top:50%; margin-top:-3px;"></div>
          <div class="gizmo-handle move-y-handle" data-layer-id="${layer.id}" data-axis="y" style="${hStyleY} left:50%; top:50%; margin-left:-3px; margin-top:-30px;"></div>
        `;
      }
    }

    let boxStyle = 'position:absolute;inset:0; ';
    const isGizmoTool = ['move', 'scale', 'rotate', 'origin'].includes(editorState.toolMode);
    
    if (isSelected) {
      boxStyle += `border:1px solid var(--accent); ${isGizmoTool ? 'pointer-events:auto; cursor:move;' : (editorState.toolMode === 'select' ? 'pointer-events:auto; cursor:pointer;' : 'pointer-events:none;')}`;
    } else {
      if (editorState.toolMode === 'select' || isGizmoTool) {
        boxStyle += 'pointer-events:auto; cursor:pointer;';
      } else {
        boxStyle += 'pointer-events:none;';
      }
    }

    const originX = layer.originX ?? 0.5;
    const originY = layer.originY ?? 0.5;

    return `
      <div class="scene-layer-wrapper" data-layer-id="${layer.id}" style="position:absolute;left:0;top:0;opacity:${opacity};${displayStyle}z-index:${z};transform:translate(calc(${x}px - ${originX * 100}%), calc(${y}px - ${originY * 100}%)) scale(${scale}) rotate(${rot}deg);transform-origin:center center; display:inline-block;">
        <img src="/assets/${layer.asset}" onerror="this.style.display='none'" style="display:block; pointer-events:none;" />
        <div class="gizmo-box" data-layer-id="${layer.id}" style="${boxStyle}">
          ${handlesHTML}
        </div>
      </div>
    `;
  }).join('');

  const layerCount = layers.filter(l => l.asset).length;

  // ── Ruler ticks with pan/zoom ──
  const { previewPanX, previewPanY, previewZoom } = editorState;
  const majorStep = 100;
  const minorStep = 20;

  function generateHRuler() {
    const ticks = [];
    const visibleW = VW * previewZoom;
    const startX = -previewPanX;
    const endX = -previewPanX + visibleW;
    // Extend range so ticks fill the ruler area
    const from = Math.floor(startX / minorStep) * minorStep;
    const to = Math.ceil(endX / minorStep) * minorStep;
    for (let wx = from; wx <= to; wx += minorStep) {
      const screenX = (wx + previewPanX) * previewZoom;
      const isMajor = wx % majorStep === 0;
      const height = isMajor ? 12 : 6;
      ticks.push(`<div style="position:absolute;left:${screenX}px;bottom:0;width:1px;height:${height}px;background:var(--border)"></div>`);
      if (isMajor) {
        ticks.push(`<div style="position:absolute;left:${screenX + 2}px;bottom:2px;font-size:9px;color:var(--text-muted);pointer-events:none">${wx}</div>`);
      }
    }
    return ticks.join('');
  }

  function generateVRuler() {
    const ticks = [];
    const visibleH = VH * previewZoom;
    const startY = -previewPanY;
    const endY = -previewPanY + visibleH;
    const from = Math.floor(startY / minorStep) * minorStep;
    const to = Math.ceil(endY / minorStep) * minorStep;
    for (let wy = from; wy <= to; wy += minorStep) {
      const screenY = (wy + previewPanY) * previewZoom;
      const isMajor = wy % majorStep === 0;
      const width = isMajor ? 12 : 6;
      ticks.push(`<div style="position:absolute;top:${screenY}px;right:0;height:1px;width:${width}px;background:var(--border)"></div>`);
      if (isMajor) {
        ticks.push(`<div style="position:absolute;top:${screenY + 2}px;right:2px;font-size:9px;color:var(--text-muted);pointer-events:none">${wy}</div>`);
      }
    }
    return ticks.join('');
  }

  // ── Dialogue overlay for selected node ──
  let dialogueHTML = '';
  if (editorState.selectedItemType === 'node' && editorState.selectedItemId) {
    const node = sceneData?.nodes?.find(n => n.id === editorState.selectedItemId);
    if (node && node.type === 'dialogue') {
      const charId = node.speaker || '';
      const char = editorState.characters?.[charId];
      const charName = char ? char.name : (charId ? charId : '');
      const portrait = char && node.expression ? `/assets/portraits/${charId}_${node.expression}.png` : '';

      dialogueHTML = `
        <div style="position:absolute;bottom:20px;left:20px;right:20px;background:rgba(0,0,0,0.85);border-radius:8px;padding:16px;border:1px solid var(--border);backdrop-filter:blur(4px);z-index:50">
          <div style="display:flex;align-items:flex-end;gap:12px">
            ${portrait ? `<img src="${portrait}" style="height:100px;border-radius:4px" />` : ''}
            <div style="flex:1">
              ${charName ? `<div style="font-weight:bold;color:${char?.color || 'var(--accent)'};font-size:13px;margin-bottom:4px">${charName}</div>` : ''}
              <div style="font-size:16px;line-height:1.5;color:var(--text-bright)">${node.text || '...'}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // ── Build HTML ──
  canvasArea.innerHTML = `
    <!-- Ruler corner -->
    <div style="position:absolute;left:0;top:0;width:${RULER_SIZE}px;height:${RULER_SIZE}px;background:var(--bg-panel);border-right:1px solid var(--border);border-bottom:1px solid var(--border);z-index:20;display:flex;align-items:center;justify-content:center">
      <span style="font-size:8px;color:var(--text-dim)" id="zoom-display">${Math.round(previewZoom * 100)}%</span>
    </div>

    <!-- X-axis ruler -->
    <div style="position:absolute;left:${RULER_SIZE}px;top:0;right:0;height:${RULER_SIZE}px;background:var(--bg-panel);border-bottom:1px solid var(--border);overflow:hidden;z-index:20">
      <div style="position:relative;width:100%;height:100%">${generateHRuler()}</div>
    </div>

    <!-- Y-axis ruler -->
    <div style="position:absolute;left:0;top:${RULER_SIZE}px;width:${RULER_SIZE}px;bottom:0;background:var(--bg-panel);border-right:1px solid var(--border);overflow:hidden;z-index:20">
      <div style="position:relative;width:100%;height:100%">${generateVRuler()}</div>
    </div>

    <!-- Viewport container (handles middle-button pan + wheel zoom) -->
    <div id="canvas-viewport" style="position:absolute;left:${RULER_SIZE}px;top:${RULER_SIZE}px;right:0;bottom:0;overflow:hidden;cursor:grab;background:var(--bg-base)">
      <div id="canvas-transform" style="transform-origin:0 0;transform:translate(${previewPanX * previewZoom}px, ${previewPanY * previewZoom}px) scale(${previewZoom})">
        <!-- Scene viewport canvas -->
        <div id="scene-viewport" style="width:${VW}px;height:${VH}px;position:relative;background:#111;overflow:hidden">
          ${layerHTML}

          ${layerCount === 0 ? '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;pointer-events:none">🎬 <span style="margin-top:8px">Drop assets here</span></div>' : ''}

          ${dialogueHTML}

          <!-- Camera border — shows the in-game viewport (800x600) -->
          <div style="position:absolute;left:${camLeft}px;top:${camTop}px;width:${GA}px;height:${GB}px;border:2px solid rgba(0,204,255,0.5);pointer-events:none;z-index:40;box-shadow:inset 0 0 30px rgba(0,204,255,0.08)">
            <!-- Corner brackets -->
            <div style="position:absolute;left:-2px;top:-2px;width:16px;height:2px;background:#00ccff"></div>
            <div style="position:absolute;left:-2px;top:-2px;width:2px;height:16px;background:#00ccff"></div>
            <div style="position:absolute;right:-2px;top:-2px;width:16px;height:2px;background:#00ccff"></div>
            <div style="position:absolute;right:-2px;top:-2px;width:2px;height:16px;background:#00ccff"></div>
            <div style="position:absolute;left:-2px;bottom:-2px;width:16px;height:2px;background:#00ccff"></div>
            <div style="position:absolute;left:-2px;bottom:-2px;width:2px;height:16px;background:#00ccff"></div>
            <div style="position:absolute;right:-2px;bottom:-2px;width:16px;height:2px;background:#00ccff"></div>
            <div style="position:absolute;right:-2px;bottom:-2px;width:2px;height:16px;background:#00ccff"></div>
          </div>
          <div style="position:absolute;left:${camLeft}px;top:${camTop - 18}px;font-size:9px;color:rgba(0,204,255,0.6);background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:3px;pointer-events:none;z-index:40;white-space:nowrap">🎥 ${GA}×${GB} (game view)</div>

          <!-- Scene info overlay -->
          <div style="position:absolute;top:8px;right:8px;display:flex;gap:6px;font-size:9px;color:var(--text-muted);background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;pointer-events:none;z-index:30">
            <span>🎨 ${layerCount} layer${layerCount === 1 ? '' : 's'}</span>
            <span>📄 ${sceneData?.nodes?.length || 0} nodes</span>
          </div>

          <!-- Drop zone overlay -->
          <div id="scene-drop-overlay" style="position:absolute;inset:0;border:2px dashed transparent;transition:border-color 0.15s,background-color 0.15s;pointer-events:none;display:flex;align-items:center;justify-content:center;z-index:100">
            <div id="scene-drop-hint" style="background:var(--accent);color:#000;padding:8px 16px;border-radius:6px;font-weight:bold;font-size:13px;opacity:0;transform:scale(0.9);transition:all 0.15s;pointer-events:none">+ DROP HERE</div>
          </div>

          <!-- Cursor position display -->
          <div style="position:absolute;bottom:8px;left:8px;font-size:9px;color:var(--text-muted);background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;pointer-events:none;z-index:30" id="cursor-pos-display">X: 0, Y: 0</div>
        </div>
      </div>
    </div>
  `;

  // ── Event bindings ──

  // Drop zone
  const sceneViewport = document.getElementById('scene-viewport');
  const dropOverlay = document.getElementById('scene-drop-overlay');
  const dropHint = document.getElementById('scene-drop-hint');
  if (sceneViewport && dropOverlay && dropHint) {
    sceneViewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropOverlay.style.borderColor = 'var(--accent)';
      dropOverlay.style.backgroundColor = 'rgba(99, 179, 237, 0.1)';
      dropHint.style.opacity = '1';
      dropHint.style.transform = 'scale(1)';
    });
    sceneViewport.addEventListener('dragleave', (e) => {
      if (!sceneViewport.contains(e.relatedTarget)) {
        dropOverlay.style.borderColor = 'transparent';
        dropOverlay.style.backgroundColor = 'transparent';
        dropHint.style.opacity = '0';
        dropHint.style.transform = 'scale(0.9)';
      }
    });
    sceneViewport.addEventListener('drop', (e) => {
      e.preventDefault();
      dropOverlay.style.borderColor = 'transparent';
      dropOverlay.style.backgroundColor = 'transparent';
      dropHint.style.opacity = '0';
      dropHint.style.transform = 'scale(0.9)';
      let dragDataStr = e.dataTransfer.getData('application/json');
      if (!dragDataStr) dragDataStr = e.dataTransfer.getData('text/plain');
      try {
        const dragData = JSON.parse(dragDataStr || '{}');
        // Scene canvas accepts any image drop.
        if (dragData.type === 'image' && dragData.path) {
          import('./views/scene-composer.js').then(mod => {
            const layer = mod.handleAssetDrop(dragData.path);
            if (layer) {
              editorState.selectedItemId = layer.id;
              editorState.selectedItemType = 'layer';
              markDirty();
              renderScenePreview();
              renderOutline();
              renderInspector();
            }
          });
        }
      } catch (err) { console.warn('[drop] failed:', err); }
    });
  }

  // ── Middle-button pan + wheel zoom ──
  const viewport = document.getElementById('canvas-viewport');
  const transform = document.getElementById('canvas-transform');
  if (!viewport || !transform) return;

  // ── Mouse Interaction ──
  let activeGizmo = null; // { type, layerId, startX, startY, initX, initY, initScale, initRot, corner }

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;

    // 1. Middle-button pan or 'pan' tool
    if (e.button === 1 || (e.button === 0 && editorState.toolMode === 'pan')) {
      e.preventDefault();
      editorState.previewDragging = true;
      editorState.previewDragStartX = e.clientX - editorState.previewPanX * editorState.previewZoom;
      editorState.previewDragStartY = e.clientY - editorState.previewPanY * editorState.previewZoom;
      viewport.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    // 2. Select mode handling
    const isGizmoMode = ['move', 'scale', 'rotate', 'origin'].includes(editorState.toolMode);
    if ((editorState.toolMode === 'select' || isGizmoMode) && e.target.classList.contains('gizmo-box')) {
      const layerId = e.target.getAttribute('data-layer-id');
      if (layerId && editorState.selectedItemId !== layerId) {
        editorState.selectedItemId = layerId;
        editorState.selectedItemType = 'layer';
        renderScenePreview();
        renderOutline();
        renderInspector();
        
        // If we're in a gizmo mode, we probably want to fall through to start dragging immediately
        if (editorState.toolMode === 'select') return;
      }
    }

    // 3. Gizmo handling
    const isMoveBox = e.target.classList.contains('gizmo-box') && editorState.toolMode === 'move';
    const isMoveX = e.target.classList.contains('move-x-handle');
    const isMoveY = e.target.classList.contains('move-y-handle');
    const isMove = isMoveBox || isMoveX || isMoveY;
    const isScale = e.target.classList.contains('scale-handle');
    const isRotate = e.target.classList.contains('rotate-handle');
    const isOrigin = e.target.classList.contains('origin-handle');

    if (isMove || isScale || isRotate || isOrigin) {
      e.preventDefault();
      e.stopPropagation();
      
      const layerId = isMoveBox ? e.target.getAttribute('data-layer-id') : e.target.closest('.scene-layer-wrapper').getAttribute('data-layer-id');
      const sceneData = editorState.scenes[editorState.activeSceneId];
      const layer = sceneData?.layers?.find(l => l.id === layerId);
      if (!layer) return;

      activeGizmo = {
        type: isMove ? 'move' : (isScale ? 'scale' : (isRotate ? 'rotate' : 'origin')),
        axis: isMoveX ? 'x' : (isMoveY ? 'y' : 'all'),
        layerId,
        layer,
        startX: e.clientX,
        startY: e.clientY,
        initX: layer.x ?? 0,
        initY: layer.y ?? 0,
        initScale: layer.scale ?? 1,
        initRot: layer.rotation ?? 0,
        initOriginX: layer.originX ?? 0.5,
        initOriginY: layer.originY ?? 0.5,
        corner: e.target.getAttribute('data-corner')
      };
      
      if (isRotate) {
        const rect = e.target.closest('.scene-layer-wrapper').getBoundingClientRect();
        activeGizmo.centerX = rect.left + rect.width / 2;
        activeGizmo.centerY = rect.top + rect.height / 2;
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (editorState.previewDragging) {
      e.preventDefault();
      const z = editorState.previewZoom;
      editorState.previewPanX = (e.clientX - editorState.previewDragStartX) / z;
      editorState.previewPanY = (e.clientY - editorState.previewDragStartY) / z;
      updateScenePreviewTransform();
    } else if (activeGizmo) {
      e.preventDefault();
      const dx = (e.clientX - activeGizmo.startX) / editorState.previewZoom;
      const dy = (e.clientY - activeGizmo.startY) / editorState.previewZoom;
      const l = activeGizmo.layer;
      
      if (activeGizmo.type === 'move') {
        let nx = activeGizmo.initX + dx;
        let ny = activeGizmo.initY + dy;
        if (editorState.snapEnabled) {
          nx = Math.round(nx / 10) * 10;
          ny = Math.round(ny / 10) * 10;
        }
        if (activeGizmo.axis === 'x') {
          l.x = nx;
        } else if (activeGizmo.axis === 'y') {
          l.y = ny;
        } else {
          l.x = nx;
          l.y = ny;
        }
        
        // Continuous resizing Inspector sync
        const inputX = document.querySelector('input[data-field="x"][data-layer="true"]');
        const inputY = document.querySelector('input[data-field="y"][data-layer="true"]');
        if (inputX) inputX.value = l.x;
        if (inputY) inputY.value = l.y;
      } else if (activeGizmo.type === 'scale') {
        const corner = activeGizmo.corner;
        const dir = (corner === 'tr' || corner === 'br') ? 1 : -1;
        let ns = activeGizmo.initScale + (dx * dir * 0.01);
        if (editorState.snapEnabled) ns = Math.round(ns * 10) / 10;
        l.scale = ns;
        
        const inputScale = document.querySelector('input[data-field="scale"][data-layer="true"]');
        if (inputScale) inputScale.value = Number(l.scale).toFixed(2);
      } else if (activeGizmo.type === 'rotate') {
        const angle1 = Math.atan2(activeGizmo.startY - activeGizmo.centerY, activeGizmo.startX - activeGizmo.centerX);
        const angle2 = Math.atan2(e.clientY - activeGizmo.centerY, e.clientX - activeGizmo.centerX);
        let dAngle = (angle2 - angle1) * 180 / Math.PI;
        let nr = activeGizmo.initRot + dAngle;
        if (editorState.snapEnabled) nr = Math.round(nr / 15) * 15;
        l.rotation = nr;
        
        const inputRot = document.querySelector('input[data-field="rotation"][data-layer="true"]');
        if (inputRot) inputRot.value = Math.round(l.rotation);
      } else if (activeGizmo.type === 'origin') {
        // Calculate new origin position relative to the layer's bounding box
        const layerEl = document.querySelector(`.scene-layer-wrapper[data-layer-id="${activeGizmo.layerId}"]`);
        if (layerEl) {
          const rect = layerEl.getBoundingClientRect();
          const localX = (e.clientX - rect.left) / editorState.previewZoom;
          const localY = (e.clientY - rect.top) / editorState.previewZoom;
          const imgWidth = layerEl.querySelector('img')?.naturalWidth || rect.width / editorState.previewZoom;
          const imgHeight = layerEl.querySelector('img')?.naturalHeight || rect.height / editorState.previewZoom;
          let newOriginX = localX / imgWidth;
          let newOriginY = localY / imgHeight;
          if (editorState.snapEnabled) {
            newOriginX = Math.round(newOriginX * 4) / 4; // Snap to 0, 0.25, 0.5, 0.75, 1
            newOriginY = Math.round(newOriginY * 4) / 4;
          }
          newOriginX = Math.max(0, Math.min(1, newOriginX));
          newOriginY = Math.max(0, Math.min(1, newOriginY));
          l.originX = newOriginX;
          l.originY = newOriginY;
          
          const inputOx = document.querySelector('input[data-field="originX"][data-layer="true"]');
          const inputOy = document.querySelector('input[data-field="originY"][data-layer="true"]');
          if (inputOx) inputOx.value = Number(l.originX).toFixed(2);
          if (inputOy) inputOy.value = Number(l.originY).toFixed(2);
        }
      }
        // Update inline styles instead of full renderScenePreview()
        const layerEl = document.querySelector(`.scene-layer-wrapper[data-layer-id="${activeGizmo.layerId}"]`);
        if (layerEl) {
          const ox = l.originX ?? 0.5;
          const oy = l.originY ?? 0.5;
          layerEl.style.transform = `translate(calc(${l.x}px - ${ox * 100}%), calc(${l.y}px - ${oy * 100}%)) scale(${l.scale}) rotate(${l.rotation}deg)`;
          
          if (activeGizmo.type === 'origin') {
            const originXPct = Math.round(l.originX * 100);
            const originYPct = Math.round(l.originY * 100);
            const originHandle = layerEl.querySelector('.origin-handle');
            if (originHandle) {
              originHandle.style.left = `${originXPct}%`;
              originHandle.style.top = `${originYPct}%`;
              // Also update the lines
              const vLine = originHandle.nextElementSibling;
              const hLine = vLine?.nextElementSibling;
              if (vLine) { vLine.style.left = `${originXPct}%`; vLine.style.top = `${originYPct}%`; }
              if (hLine) { hLine.style.left = `${originXPct}%`; hLine.style.top = `${originYPct}%`; }
            }
          }
        }
        
        // Live sync inspector values if inspector is open
        if (editorState.selectedItemId === activeGizmo.layerId) {
          const inspectorPane = document.querySelector('#inspector .panel-body');
          if (inspectorPane) {
            const xInput = inspectorPane.querySelector('input[data-field="x"]');
            const yInput = inspectorPane.querySelector('input[data-field="y"]');
            const scaleInput = inspectorPane.querySelector('input[data-field="scale"]');
            const rotInput = inspectorPane.querySelector('input[data-field="rotation"]');
            const originXInput = inspectorPane.querySelector('input[data-field="originX"]');
            const originYInput = inspectorPane.querySelector('input[data-field="originY"]');
            
            if (xInput && activeGizmo.type === 'move') xInput.value = l.x;
            if (yInput && activeGizmo.type === 'move') yInput.value = l.y;
            if (scaleInput && activeGizmo.type === 'scale') scaleInput.value = l.scale;
            if (rotInput && activeGizmo.type === 'rotate') rotInput.value = l.rotation;
            if (originXInput && activeGizmo.type === 'origin') originXInput.value = l.originX;
            if (originYInput && activeGizmo.type === 'origin') originYInput.value = l.originY;
          }
        }
      } else {
      // Mouse position tracker
      const sViewport = document.getElementById('scene-viewport');
      const posDisplay = document.getElementById('cursor-pos-display');
      if (sViewport && posDisplay) {
        const rect = sViewport.getBoundingClientRect();
        const z = editorState.previewZoom;
        const origX = (e.clientX - rect.left) / z;
        const origY = (e.clientY - rect.top) / z;
        posDisplay.textContent = `X: ${Math.round(origX)}, Y: ${Math.round(origY)}`;
      }
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (editorState.previewDragging) {
      editorState.previewDragging = false;
      viewport.style.cursor = 'grab';
    }
    if (activeGizmo) {
      activeGizmo = null;
      markDirty();
      renderScenePreview();
      renderOutline();
      renderInspector();
    }
  });

  // Prevent default middle-click scroll/autoscroll
  viewport.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

  // Wheel zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldZoom = editorState.previewZoom;
    let newZoom = oldZoom * (e.deltaY > 0 ? 0.92 : 1.08);
    newZoom = Math.max(0.1, Math.min(5, newZoom));

    // Zoom towards mouse position
    editorState.previewPanX = editorState.previewPanX + (mx / newZoom) - (mx / oldZoom);
    editorState.previewPanY = editorState.previewPanY + (my / newZoom) - (my / oldZoom);
    editorState.previewZoom = newZoom;

    updateScenePreviewTransform();
  }, { passive: false });

  // Prevent context menu on the viewport (let right-click through to graph)
  viewport.addEventListener('contextmenu', (e) => e.preventDefault());
}

function updateScenePreviewTransform() {
  const transform = document.getElementById('canvas-transform');
  const zoomDisplay = document.getElementById('zoom-display');
  const { previewPanX, previewPanY, previewZoom } = editorState;
  if (transform) {
    transform.style.transform = `translate(${previewPanX * previewZoom}px, ${previewPanY * previewZoom}px) scale(${previewZoom})`;
  }
  if (zoomDisplay) {
    zoomDisplay.textContent = `${Math.round(previewZoom * 100)}%`;
  }

  // Re-render rulers by re-running the scene preview portion
  // Instead of full re-render, just rebuild ruler ticks
  _rebuildRulers();
}

function _rebuildRulers() {
  const { previewPanX, previewPanY, previewZoom, viewportWidth: VW, viewportHeight: VH } = editorState;
  const majorStep = 100, minorStep = 20;

  function hTicks() {
    const ticks = [];
    const visibleW = VW * previewZoom;
    const from = Math.floor((-previewPanX) / minorStep) * minorStep;
    const to = Math.ceil((-previewPanX + visibleW) / minorStep) * minorStep;
    for (let wx = from; wx <= to; wx += minorStep) {
      const screenX = (wx + previewPanX) * previewZoom;
      const isMajor = wx % majorStep === 0;
      const height = isMajor ? 12 : 6;
      ticks.push(`<div style="position:absolute;left:${screenX}px;bottom:0;width:1px;height:${height}px;background:var(--border)"></div>`);
      if (isMajor) {
        ticks.push(`<div style="position:absolute;left:${screenX + 2}px;bottom:2px;font-size:9px;color:var(--text-muted);pointer-events:none">${wx}</div>`);
      }
    }
    return ticks.join('');
  }

  function vTicks() {
    const ticks = [];
    const visibleH = VH * previewZoom;
    const from = Math.floor((-previewPanY) / minorStep) * minorStep;
    const to = Math.ceil((-previewPanY + visibleH) / minorStep) * minorStep;
    for (let wy = from; wy <= to; wy += minorStep) {
      const screenY = (wy + previewPanY) * previewZoom;
      const isMajor = wy % majorStep === 0;
      const width = isMajor ? 12 : 6;
      ticks.push(`<div style="position:absolute;top:${screenY}px;right:0;height:1px;width:${width}px;background:var(--border)"></div>`);
      if (isMajor) {
        ticks.push(`<div style="position:absolute;top:${screenY + 2}px;right:2px;font-size:9px;color:var(--text-muted);pointer-events:none">${wy}</div>`);
      }
    }
    return ticks.join('');
  }

  // Find ruler containers
  const rulers = document.querySelectorAll('#canvas-area > div');
  // X-ruler is the second child (after corner), Y-ruler is the third
  // Let's find by position: the X ruler is at position relative to canvas-area
  const xRuler = document.querySelector('#canvas-area > div:nth-child(2) > div');
  const yRuler = document.querySelector('#canvas-area > div:nth-child(3) > div');
  if (xRuler) xRuler.innerHTML = hTicks();
  if (yRuler) yRuler.innerHTML = vTicks();
}

// ── Workspace tab switching ────────────────────────────
document.querySelectorAll('.workspace-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
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

// ── Mode toggle (Scene / Script) ───────────────────────
const modeButtons = document.querySelectorAll('.mode-btn');
modeButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    modeButtons.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    const mode = btn.id.replace('mode-', '');
    document.body.dataset.mode = mode;
    editorState.activeMode = mode;
    
    // Switch center panel content
    const sceneView = document.getElementById('scene-view');
    if (mode === 'script') {
      _renderScriptMode(sceneView);
    } else if (mode === 'animations') {
      _renderAnimationsMode(sceneView);
    } else if (mode === 'menu') {
      _renderMenuMode(sceneView);
    } else if (mode === 'splash') {
      _renderSplashMode(sceneView);
    } else {
      _renderSceneMode(sceneView);
    }
  });
});

let _scriptEditorModule = null;

async function _renderScriptMode(container) {
  if (!container) return;
  
  // Show script editor placeholder
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
  
  // Lazy load script editor module
  if (!_scriptEditorModule) {
    _scriptEditorModule = await import('./views/script-editor.js');
    _scriptEditorModule.init({
      data: editorState,
      stats: editorState.stats
    });
    // Render the Monaco editor in the container
    _scriptEditorModule.render(container, {
      data: editorState,
      stats: editorState.stats
    });
  }
}

let _animationsEditorModule = null;

async function _renderAnimationsMode(container) {
  if (!container) return;
  
  if (!_animationsEditorModule) {
    _animationsEditorModule = await import('./views/animations.js');
  }
  
  _animationsEditorModule.render(container, { data: editorState });
}

let _menuEditorModule = null;
async function _renderMenuMode(container) {
  if (!container) return;
  container.innerHTML = `<div id="menu-editor-container" style="height:100%;display:flex;flex-direction:column;position:relative"></div>`;
  if (!_menuEditorModule) _menuEditorModule = await import('./views/menu-editor.js');
  if (_menuEditorModule.init) _menuEditorModule.init({ data: editorState });
  _menuEditorModule.render(document.getElementById('menu-editor-container'), { data: editorState });
}

let _splashEditorModule = null;
async function _renderSplashMode(container) {
  if (!container) return;
  container.innerHTML = `<div id="splash-editor-container" style="height:100%;display:flex;flex-direction:column;position:relative"></div>`;
  if (!_splashEditorModule) _splashEditorModule = await import('./views/splash-editor.js');
  if (_splashEditorModule.init) _splashEditorModule.init({ data: editorState });
  _splashEditorModule.render(document.getElementById('splash-editor-container'), { data: editorState });
}

function _renderSceneMode(container) {
  if (!container) return;
  
  // Restore scene view
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
        renderSceneMode();
      } else if (tool === 'snap') {
        editorState.snapEnabled = !editorState.snapEnabled;
        renderSceneMode();
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

  // Render scene preview with background
  renderScenePreview();
}

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

// ── Panel resize logic ──────────────────────────────────
function initResizers() {
  document.querySelectorAll('.resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const type = resizer.dataset.resize;  // 'outline', 'inspector', 'workspace'
      const isHorizontal = type === 'workspace';
      const startPos = isHorizontal ? e.clientY : e.clientX;
      const root = document.documentElement;

      // Read starting size from CSS custom property
      const propMap = {
        outline:   '--sidebar-w',
        inspector: '--inspector-w',
        workspace: '--workspace-h'
      };
      const prop = propMap[type];
      const startSize = parseInt(getComputedStyle(root).getPropertyValue(prop)) || 0;

      // Min/max in px
      const bounds = {
        outline:   [120, 600],
        inspector: [120, 600],
        workspace: [60, window.innerHeight - 80]
      };
      const [minSize, maxSize] = bounds[type];

      resizer.classList.add('active');
      document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const curPos = isHorizontal ? ev.clientY : ev.clientX;
        const delta = curPos - startPos;

        let newSize;
        if (type === 'outline') {
          newSize = startSize + delta;
        } else if (type === 'inspector') {
          newSize = startSize - delta;
        } else {
          // workspace: drag down shrinks it
          newSize = startSize - delta;
        }

        newSize = Math.max(minSize, Math.min(maxSize, newSize));
        root.style.setProperty(prop, newSize + 'px');
      };

      const onUp = () => {
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

boot();
