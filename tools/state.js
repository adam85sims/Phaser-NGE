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
  viewportWidth: 1280, // Updated on load
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

// Undo/Redo history
const MAX_HISTORY = 50;
let undoStack = [];
let redoStack = [];
let lastSnapshotTime = 0;
const SNAPSHOT_DEBOUNCE_MS = 500; // Don't snapshot more than once per 500ms

/**
 * Capture current project state for undo history.
 * Call this before making significant changes.
 * Debounced to avoid capturing every keystroke.
 */
export function captureUndoState(force = false) {
  const now = Date.now();
  if (!force && now - lastSnapshotTime < SNAPSHOT_DEBOUNCE_MS) {
    return; // Too soon, skip this snapshot
  }
  
  const snapshot = {
    timestamp: now,
    gameConfig: JSON.parse(JSON.stringify(editorState.gameConfig)),
    characters: JSON.parse(JSON.stringify(editorState.characters)),
    variableDefs: JSON.parse(JSON.stringify(editorState.variableDefs)),
    scenes: JSON.parse(JSON.stringify(editorState.scenes)),
    animations: JSON.parse(JSON.stringify(editorState.animations))
  };
  
  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift(); // Remove oldest
  }
  
  // Clear redo stack when new change is made
  redoStack = [];
  lastSnapshotTime = now;
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('editor:undoStateChanged'));
}

/**
 * Undo the last change by restoring previous state.
 */
export function undo() {
  if (undoStack.length === 0) return false;
  
  // Capture current state for redo
  const currentSnapshot = {
    timestamp: Date.now(),
    gameConfig: JSON.parse(JSON.stringify(editorState.gameConfig)),
    characters: JSON.parse(JSON.stringify(editorState.characters)),
    variableDefs: JSON.parse(JSON.stringify(editorState.variableDefs)),
    scenes: JSON.parse(JSON.stringify(editorState.scenes)),
    animations: JSON.parse(JSON.stringify(editorState.animations))
  };
  redoStack.push(currentSnapshot);
  
  // Restore previous state
  const previous = undoStack.pop();
  editorState.gameConfig = previous.gameConfig;
  editorState.characters = previous.characters;
  editorState.variableDefs = previous.variableDefs;
  editorState.scenes = previous.scenes;
  editorState.animations = previous.animations;
  
  // Mark dirty and trigger save
  markDirty(true); // Skip capturing undo state for this change
  
  window.dispatchEvent(new CustomEvent('editor:undoStateChanged'));
  window.dispatchEvent(new CustomEvent('editor:render'));
  
  return true;
}

/**
 * Redo the last undone change.
 */
export function redo() {
  if (redoStack.length === 0) return false;
  
  // Capture current state for undo
  const currentSnapshot = {
    timestamp: Date.now(),
    gameConfig: JSON.parse(JSON.stringify(editorState.gameConfig)),
    characters: JSON.parse(JSON.stringify(editorState.characters)),
    variableDefs: JSON.parse(JSON.stringify(editorState.variableDefs)),
    scenes: JSON.parse(JSON.stringify(editorState.scenes)),
    animations: JSON.parse(JSON.stringify(editorState.animations))
  };
  undoStack.push(currentSnapshot);
  
  // Restore next state
  const next = redoStack.pop();
  editorState.gameConfig = next.gameConfig;
  editorState.characters = next.characters;
  editorState.variableDefs = next.variableDefs;
  editorState.scenes = next.scenes;
  editorState.animations = next.animations;
  
  // Mark dirty and trigger save
  markDirty(true); // Skip capturing undo state for this change
  
  window.dispatchEvent(new CustomEvent('editor:undoStateChanged'));
  window.dispatchEvent(new CustomEvent('editor:render'));
  
  return true;
}

/**
 * Check if undo/redo is available.
 */
export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

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
    editorState.viewportWidth = game.width || 1280;
    editorState.viewportHeight = game.height || 720;
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
    return true;
  } catch (e) {
    if (e.message.startsWith('WARNINGS:')) {
      try {
        const warnings = JSON.parse(e.message.substring(9));
        alert('Project saved with validation warnings:\\n\\n' + warnings.join('\\n'));
        return false;
      } catch (err) {}
    } else {
      console.warn('Project save failed:', e);
      alert('Save failed: ' + e.message);
      return false;
    }
    return false;
  }
}

async function _finaliseSave() {
  await saveProjectToBackend();
  editorState.dirty = false;
  // Trigger UI update for save button
  window.dispatchEvent(new CustomEvent('editor:saved'));
}

export function markDirty(skipUndoCapture = false) {
  editorState.dirty = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_finaliseSave, 2000);
  window.dispatchEvent(new CustomEvent('editor:dirty'));
}

export async function forceSave() {
  clearTimeout(_saveTimer);
  _saveTimer = null;
  const success = await saveProjectToBackend();
  editorState.dirty = false;
  window.dispatchEvent(new CustomEvent('editor:saved'));
  return success;
}
