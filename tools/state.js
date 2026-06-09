import { fetchJSON } from './shared/utils.js';

export const editorState = {
  // Project Data
  gameConfig: null,
  characters: {},
  variableDefs: {},
  scenes: {},
  
  // UI State
  selectedItemId: null,
  selectedItemType: null, // 'scene', 'node', 'character', 'variable'
  activeSceneId: null,
  activeWorkspaceTab: 'dialogue',
  dirty: false,

  // Scene Preview
  viewportWidth: 1280,
  viewportHeight: 720,
  previewPanX: 0,
  previewPanY: 0,
  previewZoom: 1,
  previewDragging: false,
  previewDragStartX: 0,
  previewDragStartY: 0,
  
  // Stats
  stats: {
    sceneCount: 0,
    nodeCount: 0
  }
};

const STORAGE_VERSION = 1;
let _saveTimer = null;

export async function loadProjectData() {
  try {
    const [game, chars, vars] = await Promise.all([
      fetchJSON('/data/game.json'),
      fetchJSON('/data/characters.json'),
      fetchJSON('/data/variables.json')
    ]);

    editorState.gameConfig = game;
    editorState.characters = chars;
    editorState.variableDefs = vars;
    editorState.stats.sceneCount = (game.scenes || []).length;

    let totalNodes = 0;
    
    // Load scenes
    for (const id of (game.scenes || [])) {
      try {
        const scene = await fetchJSON(`/data/scenes/${id}.json`);
        editorState.scenes[id] = scene;
        totalNodes += (scene.nodes || []).length;
      } catch (e) {
        console.warn('Skipping missing scene:', id);
      }
    }
    
    editorState.stats.nodeCount = totalNodes;
    
    // Select first scene by default
    if (game.scenes?.length > 0) {
      editorState.activeSceneId = game.scenes[0];
    }
    
  } catch (e) {
    console.error('Failed to load project data:', e);
  }
}

export function serializeProject() {
  return {
    version: STORAGE_VERSION,
    savedAt: Date.now(),
    title: editorState.gameConfig?.title || 'Untitled',
    game: editorState.gameConfig,
    characters: editorState.characters,
    variables: editorState.variableDefs,
    scenes: editorState.scenes
  };
}

export async function saveProjectToBackend() {
  try {
    const data = serializeProject();
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Save failed');
  } catch (e) {
    console.warn('Project save failed:', e);
  }
}

async function _finaliseSave() {
  await saveProjectToBackend();
  editorState.dirty = false;
  // Trigger UI update for save button
  window.dispatchEvent(new CustomEvent('editor:saved'));
}

export function markDirty() {
  editorState.dirty = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_finaliseSave, 2000);
  window.dispatchEvent(new CustomEvent('editor:dirty'));
}

export async function forceSave() {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  await _finaliseSave();
}
