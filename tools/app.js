import { editorState, loadProjectData, markDirty, forceSave } from './state.js';

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
  document.getElementById('btn-play')?.addEventListener('click', () => {
    window.open('/', '_blank');
  });

  window.addEventListener('editor:render', () => {
    renderOutline();
    renderInspector();
    renderScenePreview();
    // Don't re-render workspace, as it would destroy the canvas
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
}

// ── Render functions ───────────────────────────────────

function renderOutline() {
  const body = document.querySelector('#outline .panel-body');
  if (!body) return;

  const scenes = editorState.gameConfig?.scenes || [];
  let html = '';

  scenes.forEach(sceneId => {
    const isSelected = editorState.activeSceneId === sceneId;
    html += `
      <div class="tree-item tree-parent ${isSelected ? 'selected' : ''}" data-scene="${sceneId}">
        <svg class="tree-chevron" viewBox="0 0 20 20" fill="currentColor" style="transform: ${isSelected ? 'rotate(0)' : 'rotate(-90deg)'}">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
        </svg>
        <span>${sceneId}</span>
      </div>
    `;

    if (isSelected) {
      html += `<div class="tree-children">`;
      const sceneData = editorState.scenes[sceneId];
      
      // NODES section
      html += `
        <div class="outline-section-header" style="display:flex;align-items:center;gap:4px;padding:4px 6px;margin-top:4px;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
          <span>📝 Nodes</span>
        </div>
      `;
      
      if (sceneData && sceneData.nodes) {
        sceneData.nodes.forEach(node => {
          const nodeSelected = editorState.selectedItemId === node.id && editorState.selectedItemType === 'node';
          html += `<div class="tree-item ${nodeSelected ? 'selected' : ''}" data-node="${node.id}" data-type="node">
            <span style="color:var(--text-dim);font-size:9px;width:14px">${node.type.substring(0,1).toUpperCase()}</span>
            <span style="font-size:11px">${node.id}</span>
          </div>`;
        });
      }
      
      // LAYERS section
      html += `
        <div class="outline-section-header" style="display:flex;align-items:center;gap:4px;padding:4px 6px;margin-top:4px;font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
          <span>🎨 Layers</span>
          <button class="icon-btn-sm" data-add-layer="background" title="Add Background" style="margin-left:auto;padding:2px 4px">+</button>
        </div>
      `;
      
      if (sceneData && sceneData.layers) {
        sceneData.layers.forEach(layer => {
          const layerSelected = editorState.selectedItemId === layer.id && editorState.selectedItemType === 'layer';
          const icon = layer.type === 'background' ? '🖼️' : layer.type === 'character' ? '👤' : '📦';
          html += `<div class="tree-item ${layerSelected ? 'selected' : ''}" data-layer="${layer.id}" data-type="layer">
            <span style="color:var(--text-dim);font-size:9px;width:14px">${icon}</span>
            <span style="font-size:11px">${layer.asset || layer.characterId || layer.id}</span>
          </div>`;
        });
      } else {
        html += `<div class="text-dim" style="font-size:10px;padding:4px 6px;opacity:0.5">No layers — drag assets to scene</div>`;
      }
      
      html += `</div>`;
    }
  });

  body.innerHTML = html;

  // Bind outline clicks
  body.querySelectorAll('.tree-parent').forEach(el => {
    el.addEventListener('click', (e) => {
      editorState.activeSceneId = el.dataset.scene;
      editorState.selectedItemId = null;
      editorState.selectedItemType = null;
      renderOutline();
      renderScenePreview();
      
      // Initialize scene composer for this scene
      import('./views/scene-composer.js').then(mod => {
        mod.initScene(editorState.activeSceneId);
      });
    });
  });

  // Node clicks
  body.querySelectorAll('.tree-item[data-type="node"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      editorState.selectedItemId = el.dataset.node;
      editorState.selectedItemType = 'node';
      renderOutline();
      renderInspector();
    });
  });

  // Layer clicks
  body.querySelectorAll('.tree-item[data-type="layer"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      editorState.selectedItemId = el.dataset.layer;
      editorState.selectedItemType = 'layer';
      renderOutline();
      renderInspector();
    });
  });

  // Add layer button
  body.querySelectorAll('[data-add-layer]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const layerType = el.dataset.addLayer;
      if (layerType === 'background') {
        // Open asset browser to backgrounds
        const assetTab = document.querySelector('[data-filter="backgrounds"]');
        if (assetTab) assetTab.click();
      }
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
      'characters': () => import('./views/characters.js'),
      'variables': () => import('./views/variables.js')
    };
    
    const viewLoader = viewMap[editorState.activeWorkspaceTab];
    if (viewLoader) {
      viewLoader().then(module => {
        // Build app context from editorState
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
            recentScenes: Object.keys(editorState.scenes)
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
  const bgLayer = sceneData?.layers?.find(l => l.type === 'background');
  const bgKey = bgLayer?.asset;
  const bgOpacity = bgLayer?.opacity ?? 1;
  const bgX = bgLayer?.x ?? 0;
  const bgY = bgLayer?.y ?? 0;
  const bgScale = bgLayer?.scale ?? 1;

  const VW = editorState.viewportWidth || 1280;
  const VH = editorState.viewportHeight || 720;
  const RULER_SIZE = 24;

  // Game camera frame (1280x720 inside viewport)
  const GA = 1280;  // game area width
  const GB = 720;  // game area height
  const camLeft = Math.round((VW - GA) / 2);
  const camTop = Math.round((VH - GB) / 2);

  // Build background style
  const bgStyle = bgKey 
    ? `background: #111; background-image: url(/assets/backgrounds/${bgKey}.png), url(/assets/backgrounds/${bgKey}.jpg); background-size: cover; background-position: center; transform: translate(${bgX}px, ${bgY}px) scale(${bgScale}); transform-origin: top left;`
    : 'background: #1a1a2e;';

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
          <!-- Background layer -->
          <div style="position:absolute;left:0;top:0;width:${VW}px;height:${VH}px;opacity:${bgOpacity};${bgStyle}"></div>

          ${bgKey ? '' : '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-size:14px;pointer-events:none">🎬 <span style="margin-top:8px">Drop a background here</span></div>'}

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
            ${bgKey ? `<span>🎨 ${bgKey}</span>` : ''}
            <span>📄 ${sceneData?.nodes?.length || 0} nodes</span>
          </div>

          <!-- Drop zone overlay -->
          <div id="scene-drop-overlay" style="position:absolute;inset:0;border:2px dashed transparent;transition:border-color 0.15s,background-color 0.15s;pointer-events:auto;display:flex;align-items:center;justify-content:center;z-index:100">
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
  const dropOverlay = document.getElementById('scene-drop-overlay');
  const dropHint = document.getElementById('scene-drop-hint');
  if (dropOverlay && dropHint) {
    dropOverlay.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      dropOverlay.style.borderColor = 'var(--accent)';
      dropOverlay.style.backgroundColor = 'rgba(99, 179, 237, 0.1)';
      dropHint.style.opacity = '1';
      dropHint.style.transform = 'scale(1)';
    });
    dropOverlay.addEventListener('dragleave', (e) => {
      if (!dropOverlay.contains(e.relatedTarget)) {
        dropOverlay.style.borderColor = 'transparent';
        dropOverlay.style.backgroundColor = 'transparent';
        dropHint.style.opacity = '0';
        dropHint.style.transform = 'scale(0.9)';
      }
    });
    dropOverlay.addEventListener('drop', (e) => {
      e.preventDefault();
      dropOverlay.style.borderColor = 'transparent';
      dropOverlay.style.backgroundColor = 'transparent';
      dropHint.style.opacity = '0';
      dropHint.style.transform = 'scale(0.9)';
      let dragDataStr = e.dataTransfer.getData('application/json');
      if (!dragDataStr) dragDataStr = e.dataTransfer.getData('text/plain');
      try {
        const dragData = JSON.parse(dragDataStr || '{}');
        if (dragData.category === 'backgrounds' && dragData.name) {
          const key = dragData.name.replace(/\.[^.]+$/, '');
          import('./views/scene-composer.js').then(mod => {
            const layer = mod.handleAssetDrop('backgrounds', key);
            if (layer) {
              markDirty();
              renderScenePreview();
              renderOutline();
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

  // Middle-button pan
  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      editorState.previewDragging = true;
      editorState.previewDragStartX = e.clientX - editorState.previewPanX * editorState.previewZoom;
      editorState.previewDragStartY = e.clientY - editorState.previewPanY * editorState.previewZoom;
      viewport.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (editorState.previewDragging) {
      e.preventDefault();
      const z = editorState.previewZoom;
      editorState.previewPanX = (e.clientX - editorState.previewDragStartX) / z;
      editorState.previewPanY = (e.clientY - editorState.previewDragStartY) / z;
      updateScenePreviewTransform();
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
    if (e.button === 1 && editorState.previewDragging) {
      editorState.previewDragging = false;
      viewport.style.cursor = 'grab';
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
        <button class="icon-btn" title="Pan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg></button>
        <button class="icon-btn" title="Select"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z"/></svg></button>
        <button class="icon-btn" title="Move"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M12 2l-4 4M12 2l4 4M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4M12 22l-4-4M12 22l4-4"/></svg></button>
      </div>
      <div class="tool-sep"></div>
      <div class="tool-group">
        <button class="icon-btn" title="Rotate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round"/></svg></button>
        <button class="icon-btn" title="Scale"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h7v2H5v5H3V3zm11 0h7v7h-2V5h-5V3zM3 14h2v5h5v2H3v-7zm16 0h2v7h-7v-2h5v-5z"/></svg></button>
        <button class="icon-btn" title="Grid Snap"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg></button>
      </div>
      <div class="tool-sep"></div>
      <div class="tool-group">
        <button class="icon-btn" title="Zoom Out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/></svg></button>
        <button class="icon-btn" title="Zoom In"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg></button>
        <button class="icon-btn" title="Reset View"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button>
        <button class="icon-btn" title="Volume"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg></button>
      </div>
    </div>
  `;
  
  // Render scene preview with background
  renderScenePreview();
}

boot();
