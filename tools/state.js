import { fetchJSON } from './shared/utils.js';
import { backend } from './shared/backend-adapter.js';

export const editorState = {
  // Project Data
  gameConfig: null,
  characters: {},
  variableDefs: {},
  scenes: {},
  theme: {},
  animations: {},
  
  // UI State
  selectedItemId: null,
  selectedItemType: null, // 'scene', 'node', 'character', 'variable'
  activeSceneId: null,
  expandedScenes: new Set(),
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
  
  // Transform Gizmo Settings
  toolMode: 'select', // 'select', 'move', 'rotate', 'scale'
  snapEnabled: false,
  
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
    const [game, chars, vars, theme] = await Promise.all([
      backend.fetchGameConfig(),
      backend.fetchCharacters(),
      backend.fetchVariables(),
      backend.fetchTheme()
    ]);

    editorState.gameConfig = game;
    editorState.characters = chars;
    editorState.variableDefs = vars;
    editorState.theme = theme;
    editorState.stats.sceneCount = (game.scenes || []).length;

    let totalNodes = 0;
    
    // Load scenes
    const validScenes = [];
    for (const id of (game.scenes || [])) {
      try {
        const scene = await backend.fetchScene(id);
        editorState.scenes[id] = scene;
        totalNodes += (scene.nodes || []).length;
        validScenes.push(id);
      } catch (e) {
        console.warn('Skipping missing scene:', id);
      }
    }
    // Self-heal: purge missing scenes from the registry
    if (validScenes.length !== (game.scenes || []).length) {
      editorState.gameConfig.scenes = validScenes;
      markDirty();
    }
    
    // Load animations
    const validAnims = [];
    for (const id of (game.animations || [])) {
      try {
        const anim = await backend.fetchAnimation(id);
        editorState.animations[id] = anim;
        validAnims.push(id);
      } catch (e) {
        console.warn('Skipping missing animation:', id);
      }
    }
    if (validAnims.length !== (game.animations || []).length) {
      editorState.gameConfig.animations = validAnims;
      markDirty();
    }
    
    editorState.stats.nodeCount = totalNodes;
    
    // Select first scene by default
    if (game.scenes?.length > 0) {
      editorState.activeSceneId = game.scenes[0];
      editorState.expandedScenes.add(game.scenes[0]);
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
    theme: editorState.theme,
    scenes: editorState.scenes,
    animations: editorState.animations
  };
}

export async function saveProjectToBackend() {
  try {
    const data = serializeProject();
    await backend.saveProject(data);
    // Clear legacy local storage save so engine loads fresh disk files
    localStorage.removeItem('nge_editor_data');
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
