/**
 * Scene Composer — Visual scene composition with drag-to-apply assets.
 * Manages background layers, character positions, and scene preview.
 */
import { editorState, markDirty } from '../state.js';

let _currentSceneId = null;
let _layers = []; // Array of layer objects for current scene

/**
 * Initialize scene composer for a scene.
 */
export function initScene(sceneId) {
  _currentSceneId = sceneId;
  _loadLayers(sceneId);
  return _layers;
}

/**
 * Load layers from scene data (or initialize empty).
 */
function _loadLayers(sceneId) {
  const scene = editorState.scenes[sceneId];
  if (!scene) {
    _layers = [];
    return;
  }
  
  // Migrate old background field to layers array if needed
  if (scene.background && !scene.layers) {
    scene.layers = [{
      id: 'bg_1',
      type: 'background',
      asset: scene.background.replace(/\.[^.]+$/, ''), // strip extension
      x: 0,
      y: 0,
      scale: 1,
      zIndex: 0,
      opacity: 1
    }];
    scene.background = null; // clear old field
  }
  
  _layers = scene.layers || [];
}

/**
 * Save layers back to scene data.
 */
function _saveLayers() {
  if (!_currentSceneId) return;
  const scene = editorState.scenes[_currentSceneId];
  if (scene) {
    scene.layers = _layers;
    markDirty();
  }
}

/**
 * Add an image layer from an asset path (relative to /assets/).
 */
export function addImageLayer(assetPath, opts = {}) {
  const maxZ = _layers.reduce((m, l) => Math.max(m, l.zIndex ?? 0), 0);
  const layer = {
    id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    asset: assetPath,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    scale: opts.scale ?? 1,
    zIndex: opts.zIndex ?? (maxZ + 1),
    opacity: opts.opacity ?? 1
  };

  _layers.push(layer);
  _saveLayers();

  return layer;
}

/**
 * Legacy narrow add — used by menu-editor
 */
export function addBackground(assetPath) {
  return addImageLayer(assetPath);
}

/**
 * Update a layer's properties.
 */
export function updateLayer(layerId, props) {
  const layer = _layers.find(l => l.id === layerId);
  if (layer) {
    Object.assign(layer, props);
    _saveLayers();
  }
}

/**
 * Remove a layer.
 */
export function removeLayer(layerId) {
  const index = _layers.findIndex(l => l.id === layerId);
  if (index !== -1) {
    _layers.splice(index, 1);
    _saveLayers();
  }
}

/**
 * Get all layers for current scene.
 */
export function getLayers() {
  return _layers;
}

/**
 * Get a specific layer by ID.
 */
export function getLayer(layerId) {
  return _layers.find(l => l.id === layerId);
}

/**
 * Handle asset drop on scene canvas. Expects a relative path from the new free-form asset browser.
 */
export function handleAssetDrop(assetPath) {
  return addImageLayer(assetPath);
}

/**
 * Get the background asset key for preview.
 */
export function getCurrentBackground() {
  const bgLayer = _layers.find(l => l.type === 'background');
  return bgLayer ? bgLayer.asset : null;
}
