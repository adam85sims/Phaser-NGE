/**
 * outline.js — Left sidebar: scene layer tree, visibility toggles, drag reorder.
 */
import { editorState, markDirty } from './state.js';

export function renderOutline(renderInspector, renderScenePreview) {
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

  // OBJECTS section
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
      if (e.target.closest('.toggle-visibility')) return;
      e.stopPropagation();
      editorState.selectedItemId = el.dataset.layer;
      editorState.selectedItemType = 'layer';
      renderOutline(renderInspector, renderScenePreview);
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
        renderOutline(renderInspector, renderScenePreview);
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
        const assetTab = document.querySelector('[data-filter="backgrounds"]');
        if (assetTab) assetTab.click();
      } else if (layerType === 'container') {
        const mod = await import('./views/scene-composer.js');
        mod.addContainerLayer();
        markDirty();
        renderOutline(renderInspector, renderScenePreview);
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

    el.addEventListener('dragend', () => {
      el.style.opacity = '';
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
      renderOutline(renderInspector, renderScenePreview);
      renderScenePreview();
    });
  });
}
