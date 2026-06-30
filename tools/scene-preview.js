/**
 * scene-preview.js — Scene preview renderer, pan/zoom, gizmo handling.
 * Extracted from app.js (lines 528–1152).
 */
import { editorState, markDirty } from './state.js';

// ── Deferred panel refresh helpers ──────────────────────

/**
 * Deferred import helper: refreshes the Outline and Inspector panels.
 * Uses dynamic imports to avoid circular dependencies between
 * scene-preview ↔ outline ↔ inspector ↔ app.
 */
async function _refreshPanels() {
  try {
    const [outlineMod, inspectorMod] = await Promise.all([
      import('./outline.js'),
      import('./inspector.js'),
    ]);
    // outline.js renderInspector signature: (renderInspector, renderScenePreview)
    // We pass wrappers so it can call back into the correct modules.
    outlineMod.renderOutline(
      () => {
        const body = document.querySelector('#inspector .panel-body');
        if (body) inspectorMod.renderInspectorContent(body);
      },
      renderScenePreview
    );
  } catch (err) {
    console.warn('[scene-preview] panel refresh failed:', err);
  }
}

// ── Main render ─────────────────────────────────────────

export function renderScenePreview() {
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

  // Game camera frame matches viewport
  const GA = VW;
  const GB = VH;
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
  let portraitHTML = '';
  if (editorState.selectedItemType === 'node' && editorState.selectedItemId) {
    const node = sceneData?.nodes?.find(n => n.id === editorState.selectedItemId);
    if (node && node.type === 'dialogue') {
      const charId = node.speaker || '';
      const char = editorState.characters?.[charId];
      const charName = char ? char.name : (charId ? charId : '');
      
      const showPortrait = char && !char.invisible;
      const expressionKey = node.expression || char?.defaultExpression || 'neutral';
      const portraitAsset = char?.portraits?.[expressionKey] || `characters/${charId}_${expressionKey}`;
      const portraitUrl = showPortrait ? (portraitAsset.includes('.') ? `/assets/${portraitAsset}` : `/assets/${portraitAsset}.png`) : '';

      if (portraitUrl) {
        let leftPct = '50%';
        const pos = node.position || 'center';
        if (pos === 'left') {
          leftPct = '20%';
        } else if (pos === 'center-left') {
          leftPct = '35%';
        } else if (pos === 'center' || pos === '') {
          leftPct = '50%';
        } else if (pos === 'center-right') {
          leftPct = '65%';
        } else if (pos === 'right') {
          leftPct = '80%';
        }
        portraitHTML = `
          <div style="position:absolute; bottom:120px; left:${leftPct}; transform:translateX(-50%); z-index:45; pointer-events:none;">
            <img src="${portraitUrl}" onerror="this.style.display='none'" style="height:320px; display:block;" />
          </div>
        `;
      }

      dialogueHTML = `
        <div style="position:absolute;bottom:20px;left:20px;right:20px;background:rgba(0,0,0,0.85);border-radius:8px;padding:16px;border:1px solid var(--border);backdrop-filter:blur(4px);z-index:50">
          <div>
            ${charName ? `<div style="font-weight:bold;color:${char?.color || 'var(--accent)'};font-size:13px;margin-bottom:4px">${charName}</div>` : ''}
            <div style="font-size:16px;line-height:1.5;color:var(--text-bright)">${node.text || '...'}</div>
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

          ${portraitHTML}
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
              _refreshPanels();
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
        _refreshPanels();
        
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
      _refreshPanels();
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

// ── Transform / zoom helpers ────────────────────────────

export function updateScenePreviewTransform() {
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
