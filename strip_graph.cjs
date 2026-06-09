const fs = require('fs');
const content = fs.readFileSync('tools/graph.js', 'utf8');

// We want to keep everything from line 273 (const TYPE_COLORS) to line 633 (hitTest end)
// And we want to wrap it in an ES module structure.

const lines = content.split('\n');

const typeColorsIdx = lines.findIndex(l => l.includes('const TYPE_COLORS ='));
const hitTestEndIdx = lines.findIndex(l => l.includes('return null;') && lines[lines.indexOf(l)+1].includes('}')) + 1;

let canvasLogic = lines.slice(typeColorsIdx, hitTestEndIdx + 1).join('\n');

const out = `import { editorState, markDirty } from './state.js';

const TYPE_COLORS = { dialogue: '#3b82f6', choice: '#f59e0b', condition: '#10b981', event: '#8b5cf6', call_scene: '#ec4899', wait: '#64748b', end: '#ef4444' };
const NODE_W = 200, NODE_H = 64, PORT_R = 6;

let canvas, ctx;
let graphState = {
  camera: { x: -300, y: 0 },
  zoom: 1,
  panning: false,
  panStart: { x: 0, y: 0 },
  dragging: null,
  connectionDraft: null
};

export function mountGraph(container) {
  canvas = container.querySelector('#graph-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  const resizeCanvas = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('wheel', e => { 
    e.preventDefault();
    graphState.zoom = Math.max(0.3, Math.min(2, graphState.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
  }, { passive: false });

  // Touch
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e.touches[0]); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); onPointerMove(e.touches[0]); });
  canvas.addEventListener('touchend', e => { e.preventDefault(); onPointerUp(e); });

  const renderLoop = () => {
    try { renderCanvas(); } catch(e) { console.error('Render error:', e); }
    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);
}

function getNodes() {
  if (!editorState.activeSceneId) return [];
  const scene = editorState.scenes[editorState.activeSceneId];
  return scene ? (scene.nodes || []) : [];
}

function worldToScreen(wx, wy) {
  return {
    x: (wx + graphState.camera.x) * graphState.zoom + canvas.width / 2,
    y: (wy + graphState.camera.y) * graphState.zoom + canvas.height / 2
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2) / graphState.zoom - graphState.camera.x,
    y: (sy - canvas.height / 2) / graphState.zoom - graphState.camera.y
  };
}

// === CANVAS RENDER AND INPUT ===
${canvasLogic.replace(/state\.nodes/g, 'getNodes()')
             .replace(/state\.camera/g, 'graphState.camera')
             .replace(/state\.zoom/g, 'graphState.zoom')
             .replace(/state\.connectionDraft/g, 'graphState.connectionDraft')
             .replace(/state\.selectedNodeId/g, '(editorState.selectedItemType==="node"?editorState.selectedItemId:null)')
             .replace(/state\.dragging/g, 'graphState.dragging')
             .replace(/state\.panning/g, 'graphState.panning')
             .replace(/state\.panStart/g, 'graphState.panStart')
             .replace(/renderAll\(\);/g, '/* renderAll */')
             .replace(/renderEditor\(\); renderNodeList\(\);/g, '/* update */ window.dispatchEvent(new CustomEvent("editor:render"));')
             .replace(/selectNode\(hit\.nodeId\);/g, 'editorState.selectedItemId = hit.nodeId; editorState.selectedItemType = "node"; window.dispatchEvent(new CustomEvent("editor:render"));')
             .replace(/const TYPE_COLORS.*?;/s, '')
             .replace(/const NODE_W =.*?;/s, '')
             .replace(/let canvas, ctx;/s, '')
             .replace(/function worldToScreen.*?}/s, '')
             .replace(/function screenToWorld.*?}/s, '')}
`;

fs.writeFileSync('tools/graph.js', out);
console.log('Graph extracted');
