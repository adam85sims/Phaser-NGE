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
 * Add a background layer from asset key.
 */
export function addBackground(assetKey) {
  const layer = {
    id: `bg_${Date.now()}`,
    type: 'background',
    asset: assetKey,
    x: 0,
    y: 0,
    scale: 1,
    zIndex: 0,
    opacity: 1
  };
  
  _layers.push(layer);
  _saveLayers();
  
  return layer;
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
 * Handle asset drop on scene canvas.
 */
export function handleAssetDrop(category, assetKey) {
  if (category === 'backgrounds') {
    const layer = addBackground(assetKey);
    return layer;
  }
  
  // Future: handle character portraits, props, etc.
  console.log('Dropped asset:', category, assetKey);
  return null;
}

/**
 * Get the background asset key for preview.
 */
export function getCurrentBackground() {
  const bgLayer = _layers.find(l => l.type === 'background');
  return bgLayer ? bgLayer.asset : null;
}
