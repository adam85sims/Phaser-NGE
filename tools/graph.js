import { editorState, markDirty, captureUndoState } from './state.js';
import { Registry } from '../src/systems/Registry.js';

const NODE_W = 200, NODE_H = 64, PORT_R = 6;

let canvas, ctx;
let contextMenu = null;
let graphState = {
  camera: { x: -300, y: 0 },
  zoom: 1,
  panning: false,
  panStart: { x: 0, y: 0 },
  dragging: null,
  connectionDraft: null,
  hoveredPort: null,
  // ── Marquee selection ──
  // null = inactive; when active holds screen-space start + current coords
  marquee: null,
  // Threshold in screen pixels before a mousedown-on-empty becomes a marquee
  // (prevents accidental marquee on tiny clicks)
  MARQUEE_THRESHOLD: 6,
  // IDs of all selected nodes (multi-select). The "primary" selection for the
  // inspector is still editorState.selectedItemId — this array tracks the full set.
  selectedNodeIds: []
};

export function mountGraph(container) {
  canvas = container.querySelector('#graph-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  const resizeCanvas = () => {
    if (!canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };
  
  resizeCanvas();
  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(canvas.parentElement);

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('wheel', e => { 
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    const oldZoom = graphState.zoom;
    let newZoom = Math.max(0.3, Math.min(2, oldZoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    
    const wHalf = canvas.width / 2;
    const hHalf = canvas.height / 2;
    graphState.camera.x += (sx - wHalf) / newZoom - (sx - wHalf) / oldZoom;
    graphState.camera.y += (sy - hHalf) / newZoom - (sy - hHalf) / oldZoom;
    graphState.zoom = newZoom;
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

  // Reset camera when scene changes
  if (!window.__graphSceneChangedListener) {
    window.__graphSceneChangedListener = () => {
      if (graphState) {
        graphState.zoom = 1;
        const scene = editorState.scenes[editorState.activeSceneId];
        const nodes = scene?.nodes || [];
        if (nodes.length > 0) {
          const last = nodes[nodes.length - 1];
          // Offset x by -150 so the node appears towards the left-center, leaving room on the right
          graphState.camera.x = -last.x - 150;
          graphState.camera.y = -last.y;
        } else {
          graphState.camera.x = -300;
          graphState.camera.y = 0;
        }
      }
    };
    window.addEventListener('scene:changed', window.__graphSceneChangedListener);
  }
  
  // Call it immediately if this is the first mount for the current scene
  if (graphState._lastCenteredSceneId !== editorState.activeSceneId) {
    graphState._lastCenteredSceneId = editorState.activeSceneId;
    window.__graphSceneChangedListener();
  }

  // ── Context menu ──
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY);
  });

  // Close context menu on any click
  document.addEventListener('click', closeContextMenu, false);
  document.addEventListener('contextmenu', closeContextMenu, false);

  // Keyboard: Delete/Backspace removes selected node, Cmd+Space / Ctrl+Space opens search palette
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input (unless it's the palette input itself and we're not deleting)
    const tag = document.activeElement ? document.activeElement.tagName : '';
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (inInput) return;
      if (canvas && canvas.offsetParent !== null) {
        deleteSelectedNode();
      }
    }

    // D: create dialogue node (quick create for the most common node type)
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (inInput) return;
      if (canvas && canvas.offsetParent !== null) {
        e.preventDefault();
        createNode('dialogue');
      }
    }

    if (e.code === 'Space' && (e.metaKey || e.ctrlKey)) {
      if (canvas && canvas.offsetParent !== null) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        // Center of the canvas
        showContextMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }
  });
}

/* ── Node CRUD ───────────────────────────── */

export function createNode(type = 'dialogue', wx = null, wy = null) {
  captureUndoState(); // Capture before creation
  const sceneData = editorState.scenes[editorState.activeSceneId];
  if (!sceneData) return null;

  // Generate unique ID
  const existingIds = new Set((sceneData.nodes || []).map(n => n.id));
  let id = type + '_' + 1;
  let counter = 1;
  while (existingIds.has(id)) {
    counter++;
    id = type + '_' + counter;
  }

  // Place in center of viewport or at given world coords
  if (wx === null || wy === null) {
    wx = -graphState.camera.x;
    wy = -graphState.camera.y;
  }

  const node = {
    id,
    type,
    x: Math.round(wx / 20) * 20,
    y: Math.round(wy / 20) * 20
  };

  const def = Registry.getNodeType(type);
  if (def && def.defaultData) Object.assign(node, def.defaultData());

  if (!sceneData.nodes) sceneData.nodes = [];
  sceneData.nodes.push(node);
  markDirty();

  // Select the new node
  editorState.selectedItemId = node.id;
  editorState.selectedItemType = 'node';
  window.dispatchEvent(new CustomEvent('editor:render'));

  // Auto-focus the text field for dialogue nodes (the most common action)
  if (type === 'dialogue') {
    setTimeout(() => {
      const textarea = document.querySelector('[data-field="text"]');
      if (textarea) {
        textarea.focus();
        textarea.select();
      }
    }, 50);
  }

  return node;
}

export function deleteNode(nodeId) {
  captureUndoState(); // Capture before deletion
  const sceneData = editorState.scenes[editorState.activeSceneId];
  if (!sceneData || !sceneData.nodes) return;

  const idx = sceneData.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return;

  sceneData.nodes.splice(idx, 1);

  // Remove all connections pointing to this node
  sceneData.nodes.forEach(n => {
    if (n.next === nodeId) n.next = '';
    if (n.else === nodeId) n.else = '';
    if (n.choices) {
      n.choices.forEach(c => { if (c.next === nodeId) c.next = ''; });
    }
  });

  // Deselect if selected
  if (editorState.selectedItemId === nodeId) {
    editorState.selectedItemId = null;
    editorState.selectedItemType = null;
  }

  markDirty();
  window.dispatchEvent(new CustomEvent('editor:render'));
}

export function deleteSelectedNode() {
  // Multi-select: delete all selected nodes
  if (graphState.selectedNodeIds.length > 1) {
    captureUndoState();
    // Delete all but the primary (which deleteNode handles)
    const toDelete = graphState.selectedNodeIds.filter(id => id !== editorState.selectedItemId);
    toDelete.forEach(id => deleteNodeNoUndo(id));
    // Delete the primary last
    if (editorState.selectedItemType === 'node' && editorState.selectedItemId) {
      deleteNode(editorState.selectedItemId);
    }
    graphState.selectedNodeIds = [];
    return;
  }
  // Single select
  if (editorState.selectedItemType === 'node' && editorState.selectedItemId) {
    graphState.selectedNodeIds = [];
    deleteNode(editorState.selectedItemId);
  }
}

/**
 * Internal: delete a node without capturing undo (used for batch multi-delete).
 * The caller is responsible for calling captureUndoState() once before the batch.
 */
function deleteNodeNoUndo(nodeId) {
  const sceneData = editorState.scenes[editorState.activeSceneId];
  if (!sceneData || !sceneData.nodes) return;

  const idx = sceneData.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return;

  sceneData.nodes.splice(idx, 1);

  // Remove all connections pointing to this node
  sceneData.nodes.forEach(n => {
    if (n.next === nodeId) n.next = '';
    if (n.else === nodeId) n.else = '';
    if (n.choices) {
      n.choices.forEach(c => { if (c.next === nodeId) c.next = ''; });
    }
  });
}

/* ── Context Menu ────────────────────────── */

function showContextMenu(mx, my) {
  closeContextMenu();

  const rect = canvas.getBoundingClientRect();
  const canvasX = mx - rect.left;
  const canvasY = my - rect.top;

  const hit = hitTest(canvasX, canvasY);
  const onNode = hit && hit.type === 'node';

  const menu = document.createElement('div');
  menu.id = 'graph-context-menu';
  menu.style.cssText = `
    position: fixed; left: ${mx}px; top: ${my}px; z-index: 9999;
    background: #1a1a2e; border: 1px solid #333; border-radius: 6px;
    padding: 6px; min-width: 200px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-size: 12px; font-family: sans-serif;
    display: flex; flex-direction: column; gap: 6px;
  `;

  // Search input
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search nodes...';
  input.style.cssText = `
    background: var(--bg-input); color: var(--text-bright);
    border: 1px solid var(--border); border-radius: 4px;
    padding: 6px; outline: none; font-size: 12px;
  `;
  menu.appendChild(input);

  const list = document.createElement('div');
  list.style.cssText = 'max-height: 250px; overflow-y: auto; display: flex; flex-direction: column;';
  menu.appendChild(list);

  const wpos = screenToWorld(canvasX, canvasY);

  const nodeTypes = Registry.getAllNodeTypes().map(t => ({ label: t.label, type: t.id }));

  function renderList(filter = '') {
    list.innerHTML = '';
    const f = filter.toLowerCase();
    
    // Add Node actions
    nodeTypes.filter(n => n.label.toLowerCase().includes(f) || n.type.includes(f)).forEach(n => {
      const item = document.createElement('div');
      item.textContent = '+ ' + n.label;
      item.style.cssText = `
        padding: 6px 8px; cursor: pointer; color: #ccc; border-radius: 4px;
        transition: background 0.1s;
      `;
      item.addEventListener('mouseenter', () => { item.style.background = '#2a2a44'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        createNode(n.type, wpos.x, wpos.y); 
        closeContextMenu(); 
      });
      list.appendChild(item);
    });

    // Node specific actions (Delete)
    if (onNode && 'delete'.includes(f)) {
      const div = document.createElement('div');
      div.style.cssText = 'height:1px; background:#333; margin:4px 0;';
      list.appendChild(div);

      const del = document.createElement('div');
      del.textContent = 'Delete Node "' + hit.nodeId + '"';
      del.style.cssText = `
        padding: 6px 8px; cursor: pointer; color: #ef4444; border-radius: 4px;
        transition: background 0.1s;
      `;
      del.addEventListener('mouseenter', () => { del.style.background = '#2a2a44'; });
      del.addEventListener('mouseleave', () => { del.style.background = 'transparent'; });
      del.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        deleteNode(hit.nodeId); 
        closeContextMenu(); 
      });
      list.appendChild(del);
    }
  }

  renderList();

  input.addEventListener('input', (e) => renderList(e.target.value));
  
  // Handle enter key in input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector('div[style*="cursor: pointer"]');
      if (first) first.click();
    }
  });

  // Prevent closing menu when clicking inside
  menu.addEventListener('click', (e) => e.stopPropagation());

  contextMenu = menu;
  document.body.appendChild(menu);
  
  // Adjust position to keep menu fully visible
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let finalX = mx;
  let finalY = my;
  
  // If menu would overflow right edge, shift left
  if (menuRect.right > viewportWidth) {
    finalX = mx - menuRect.width;
  }
  
  // If menu would overflow bottom edge, shift up
  if (menuRect.bottom > viewportHeight) {
    finalY = my - menuRect.height;
  }
  
  // Ensure we don't go negative (menu larger than viewport)
  finalX = Math.max(0, finalX);
  finalY = Math.max(0, finalY);
  
  menu.style.left = finalX + 'px';
  menu.style.top = finalY + 'px';
  
  // Focus search
  setTimeout(() => input.focus(), 10);
}

function closeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
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

function renderCanvas() {
  if (!canvas || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gs = 40 * graphState.zoom;
  const ox = (graphState.camera.x * graphState.zoom + W / 2) % gs;
  const oy = (graphState.camera.y * graphState.zoom + H / 2) % gs;
  for (let x = ox - gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = oy - gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Collect connections
  const conns = [];
  getNodes().forEach(n => {
    const def = Registry.getNodeType(n.type);
    if (def && def.getConnections) {
      def.getConnections(n).forEach(c => conns.push({ from: n.id, ...c }));
    } else {
      if (n.next) conns.push({ from: n.id, port: 0, to: n.next });
    }
  });

  // Draw connections
  conns.forEach(c => {
    const fn = getNodes().find(x => x.id === c.from);
    const tn = getNodes().find(x => x.id === c.to);
    if (!fn || !tn) return;
    const fr = getNodeRect(fn);
    const tr = getNodeRect(tn);
    const fs = worldToScreen(fr.x + fr.w, fr.y + getPortY(fn, c.port));
    const ts = worldToScreen(tr.x, tr.y + tr.h / 2);
    ctx.beginPath();
    ctx.moveTo(fs.x, fs.y);
    const cp = (fs.x + ts.x) / 2;
    ctx.bezierCurveTo(cp, fs.y, cp, ts.y, ts.x, ts.y);
    ctx.strokeStyle = c.label === 'TRUE' ? '#22c55e' : c.label === 'FALSE' ? '#ef4444' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Arrow
    const ang = Math.atan2(ts.y - fs.y, ts.x - cp);
    ctx.beginPath();
    ctx.moveTo(ts.x, ts.y);
    ctx.lineTo(ts.x - 6, ts.y - 4);
    ctx.lineTo(ts.x - 6, ts.y + 4);
    ctx.closePath();
    ctx.fillStyle = c.label === 'TRUE' ? '#22c55e' : c.label === 'FALSE' ? '#ef4444' : 'rgba(255,255,255,0.25)';
    ctx.fill();
    if (c.label) {
      ctx.fillStyle = c.label === 'TRUE' ? '#22c55e' : '#ef4444';
      ctx.font = '10px sans-serif';
      ctx.fillText(c.label, (fs.x + ts.x) / 2 - 12, (fs.y + ts.y) / 2 - 6);
    }
  });

  // Connection draft
  if (graphState.connectionDraft) {
    const fn = getNodes().find(x => x.id === graphState.connectionDraft.fromId);
    if (fn) {
      const fr = getNodeRect(fn);
      const fs = worldToScreen(fr.x + fr.w, fr.y + getPortY(fn, graphState.connectionDraft.portIndex));
      ctx.beginPath();
      ctx.moveTo(fs.x, fs.y);
      ctx.bezierCurveTo((fs.x + graphState.connectionDraft.mx) / 2, fs.y, (fs.x + graphState.connectionDraft.mx) / 2, graphState.connectionDraft.my, graphState.connectionDraft.mx, graphState.connectionDraft.my);
      ctx.strokeStyle = 'rgba(0,204,255,0.4)';
      ctx.lineWidth = 2; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
    }
    // Highlight drop target input port
    if (graphState.connectionDraft.dropTarget) {
      const tn = getNodes().find(x => x.id === graphState.connectionDraft.dropTarget);
      if (tn) {
        const tr = getNodeRect(tn);
        const ts = worldToScreen(tr.x, tr.y);
        const th = tr.h * graphState.zoom;
        ctx.beginPath(); ctx.arc(ts.x, ts.y + th / 2, (PORT_R + 4) * graphState.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }

  const selectedNodeId = editorState.selectedItemType === 'node' ? editorState.selectedItemId : null;

  // ── Multi-select set for fast lookup ──
  const multiSelected = new Set(graphState.selectedNodeIds);

  // Draw nodes
  getNodes().forEach(node => {
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * graphState.zoom;
    const sh = r.h * graphState.zoom;
    const selected = node.id === selectedNodeId || multiSelected.has(node.id);
    const def = Registry.getNodeType(node.type);
    const color = def?.color || '#666';
    const radius = 6;

    ctx.shadowColor = selected ? 'rgba(0,204,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = selected ? 12 : 4;
    roundRect(ctx, s.x, s.y, sw, sh, radius);
    ctx.fillStyle = '#1a1a2e'; ctx.fill();
    ctx.shadowBlur = 0;

    // Top bar
    roundRect(ctx, s.x, s.y, sw, 6, { tl: radius, tr: radius });
    ctx.fillStyle = color; ctx.fill();
    roundRect(ctx, s.x, s.y + 6, sw, sh - 6, { bl: radius, br: radius });
    ctx.fillStyle = selected ? 'rgba(0,204,255,0.08)' : 'rgba(255,255,255,0.02)'; ctx.fill();

    // Border
    roundRect(ctx, s.x, s.y, sw, sh, radius);
    ctx.strokeStyle = selected ? '#00ccff' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = selected ? 2 : 1; ctx.stroke();

    // ID + type
    ctx.fillStyle = '#e0e0e8';
    ctx.font = `bold ${11 * graphState.zoom}px Consolas, monospace`;
    ctx.fillText(node.id, s.x + 8 * graphState.zoom, s.y + 22 * graphState.zoom);
    ctx.fillStyle = color;
    ctx.font = `${9 * graphState.zoom}px sans-serif`;
    ctx.fillText(node.type.toUpperCase(), s.x + 8 * graphState.zoom, s.y + 35 * graphState.zoom);

    // Play button
    const playBtnX = s.x + sw - 20 * graphState.zoom - (node.comment ? 20 * graphState.zoom : 0);
    const playBtnY = s.y + 22 * graphState.zoom;
    ctx.fillStyle = '#22c55e';
    ctx.font = `${10 * graphState.zoom}px sans-serif`;
    ctx.fillText('▶', playBtnX, playBtnY);

    // Comment indicator
    if (node.comment) {
      ctx.fillStyle = '#fde047';
      ctx.font = `${10 * graphState.zoom}px sans-serif`;
      ctx.fillText('📝', s.x + sw - 20 * graphState.zoom, s.y + 22 * graphState.zoom);
    }

    // Preview snippet — show speaker + truncated text
    let snippet = '';
    if (node.type === 'dialogue') {
      const speaker = node.speaker ? node.speaker + ': ' : '';
      const text = node.text || '';
      if (text.length > 0) {
        const maxLen = Math.max(18, Math.floor(36 * graphState.zoom));
        snippet = speaker + (text.length > maxLen ? text.slice(0, maxLen) + '…' : text);
      } else {
        snippet = speaker + '(click to add dialogue…)';
      }
    }
    if (node.type === 'choice' && node.prompt) snippet = node.prompt.slice(0, 22) + '…';
    if (snippet) {
      ctx.fillStyle = node.type === 'dialogue' && !node.text ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)';
      ctx.font = `${9 * graphState.zoom}px sans-serif`;
      ctx.fillText(snippet, s.x + 8 * graphState.zoom, s.y + sh - 6 * graphState.zoom);
    }

    // Input port
    ctx.beginPath(); ctx.arc(s.x, s.y + sh / 2, PORT_R * graphState.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a40'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();

    // Output ports
    const oports = getOutputPorts(node, s.x, s.y, sw);
    oports.forEach((p, i) => {
      const isHovered = graphState.hoveredPort?.nodeId === node.id && graphState.hoveredPort?.portIndex === i;
      ctx.beginPath(); ctx.arc(p.x, p.y, PORT_R * graphState.zoom, 0, Math.PI * 2);
      let pc = 'rgba(255,255,255,0.2)';
      if (p.label === 'TRUE') pc = '#22c55e';
      else if (p.label === 'FALSE') pc = '#ef4444';
      else if (node.type === 'choice' || node.type === 'timed_choice' || node.type === 'random_branch') pc = '#d97706';
      ctx.fillStyle = pc; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      // Hover highlight ring
      if (isHovered) {
        ctx.beginPath(); ctx.arc(p.x, p.y, (PORT_R + 4) * graphState.zoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2; ctx.stroke();
      }
    });
  });

  // ── Marquee selection rectangle ──
  if (graphState.marquee) {
    const m = graphState.marquee;
    const sx = Math.min(m.startX, m.currentX);
    const sy = Math.min(m.startY, m.currentY);
    const sw = Math.abs(m.currentX - m.startX);
    const sh = Math.abs(m.currentY - m.startY);

    ctx.fillStyle = 'rgba(0, 204, 255, 0.08)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(0, 204, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
  }
}

function roundRect(ctx, x, y, w, h, radii) {
  const r = typeof radii === 'number' ? radii : 0;
  const tl = radii?.tl ?? r, tr = radii?.tr ?? r, bl = radii?.bl ?? r, br = radii?.br ?? r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

function getNodeRect(node) {
  return { x: node.x, y: node.y, w: NODE_W, h: getNodeHeight(node) };
}

function getNodeHeight(node) {
  const def = Registry.getNodeType(node.type);
  if (def && def.getHeight) return def.getHeight(node);
  return NODE_H;
}

function getPortY(node, portIdx) {
  const def = Registry.getNodeType(node.type);
  if (def && def.getOutputs) {
    const outputs = def.getOutputs(node, 0, 0, 0, 1);
    if (outputs[portIdx]) return outputs[portIdx].y;
  }
  return getNodeHeight(node) / 2;
}

function getOutputPorts(node, sx, sy, sw) {
  const def = Registry.getNodeType(node.type);
  if (def && def.getOutputs) return def.getOutputs(node, sx, sy, sw, graphState.zoom);
  const h = getNodeHeight(node) * graphState.zoom;
  return [{ x: sx + sw, y: sy + h / 2 }];
}

function onPointerDown(e) {
  e.stopPropagation();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = hitTest(mx, my);

  if (hit?.type === 'port') {
    captureUndoState(); // Capture before starting connection drag
    graphState.connectionDraft = { fromId: hit.nodeId, portIndex: hit.portIndex, mx, my };
    return;
  }
  if (hit?.type === 'node') {
    // ── Multi-select: Shift+click toggles node in selection ──
    if (e.shiftKey) {
      const idx = graphState.selectedNodeIds.indexOf(hit.nodeId);
      if (idx >= 0) {
        graphState.selectedNodeIds.splice(idx, 1);
      } else {
        graphState.selectedNodeIds.push(hit.nodeId);
      }
      // Update primary selection to the last clicked node
      editorState.selectedItemId = hit.nodeId;
      editorState.selectedItemType = 'node';
    } else {
      // Normal click: select this node (and only this, unless it's already in a multi-selection)
      if (!graphState.selectedNodeIds.includes(hit.nodeId)) {
        graphState.selectedNodeIds = [hit.nodeId];
      }
      editorState.selectedItemId = hit.nodeId;
      editorState.selectedItemType = 'node';
    }
    window.dispatchEvent(new CustomEvent('editor:render'));

    // ── Multi-node drag: drag all selected nodes together ──
    const allSelected = graphState.selectedNodeIds.length > 0
      ? graphState.selectedNodeIds
      : [hit.nodeId];

    const nodeOffsets = allSelected.map(id => {
      const n = getNodes().find(x => x.id === id);
      return n ? { nodeId: id, ox: n.x, oy: n.y } : null;
    }).filter(Boolean);

    captureUndoState(); // Capture before starting node drag
    graphState.dragging = {
      nodeId: hit.nodeId,
      startX: mx,
      startY: my,
      nodeOffsets
    };
    return;
  }
  if (hit?.type === 'play-btn') {
    if (window.__playFromNode) {
      window.__playFromNode(hit.nodeId);
    }
    return;
  }

  // ── Click on empty space: candidate for marquee or pan ──
  // Don't start panning yet — wait for mouse move to decide.
  // Record the starting position so onPointerMove can threshold-check.
  graphState.panStart = {
    x: mx - graphState.camera.x * graphState.zoom,
    y: my - graphState.camera.y * graphState.zoom
  };
  graphState._emptyDownX = mx;
  graphState._emptyDownY = my;
  graphState._emptyDownShift = e.shiftKey;
}

function onPointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Update cursor and hovered port based on what we're hovering
  if (!graphState.connectionDraft && !graphState.dragging && !graphState.panning && !graphState.marquee && !graphState._emptyDownX) {
    const hit = hitTest(mx, my);
    if (hit?.type === 'port') {
      canvas.style.cursor = 'crosshair';
      graphState.hoveredPort = { nodeId: hit.nodeId, portIndex: hit.portIndex };
    } else if (hit?.type === 'play-btn') {
      canvas.style.cursor = 'pointer';
      graphState.hoveredPort = null;
    } else if (hit?.type === 'node') {
      canvas.style.cursor = 'grab';
      graphState.hoveredPort = null;
    } else {
      canvas.style.cursor = 'default';
      graphState.hoveredPort = null;
    }
  } else if (graphState.dragging) {
    canvas.style.cursor = 'grabbing';
    graphState.hoveredPort = null;
  } else if (graphState.connectionDraft) {
    canvas.style.cursor = 'crosshair';
    graphState.hoveredPort = null;
  } else if (graphState.marquee) {
    canvas.style.cursor = 'crosshair';
  }

  // ── Empty-space mousedown pending: decide between marquee and pan ──
  if (graphState._emptyDownX != null && !graphState.panning && !graphState.marquee) {
    const dx = mx - graphState._emptyDownX;
    const dy = my - graphState._emptyDownY;
    if (Math.abs(dx) > graphState.MARQUEE_THRESHOLD || Math.abs(dy) > graphState.MARQUEE_THRESHOLD) {
      // Threshold exceeded — this is a marquee drag
      graphState.marquee = {
        startX: graphState._emptyDownX,
        startY: graphState._emptyDownY,
        currentX: mx,
        currentY: my,
        additive: graphState._emptyDownShift
      };
      // Clear pending state so we don't re-evaluate
      delete graphState._emptyDownX;
      delete graphState._emptyDownY;
      delete graphState._emptyDownShift;
    }
    return;
  }

  // ── Active marquee: update rectangle + compute selected nodes ──
  if (graphState.marquee) {
    graphState.marquee.currentX = mx;
    graphState.marquee.currentY = my;

    // Compute the screen-space bounding box
    const m = graphState.marquee;
    const sx = Math.min(m.startX, m.currentX);
    const sy = Math.min(m.startY, m.currentY);
    const sw = Math.abs(m.currentX - m.startX);
    const sh = Math.abs(m.currentY - m.startY);

    // Find all nodes whose screen-space rects intersect the marquee
    const hitIds = [];
    getNodes().forEach(node => {
      const r = getNodeRect(node);
      const s = worldToScreen(r.x, r.y);
      const nw = r.w * graphState.zoom;
      const nh = r.h * graphState.zoom;
      // AABB intersection
      if (s.x < sx + sw && s.x + nw > sx && s.y < sy + sh && s.y + nh > sy) {
        hitIds.push(node.id);
      }
    });

    // If additive (Shift held), merge with existing selection; otherwise replace
    if (m.additive) {
      const merged = new Set(graphState.selectedNodeIds);
      hitIds.forEach(id => merged.add(id));
      graphState.selectedNodeIds = [...merged];
    } else {
      graphState.selectedNodeIds = hitIds;
    }

    // Update primary selection for inspector (last in list, or null)
    const primary = graphState.selectedNodeIds.length > 0
      ? graphState.selectedNodeIds[graphState.selectedNodeIds.length - 1]
      : null;
    editorState.selectedItemId = primary;
    editorState.selectedItemType = primary ? 'node' : null;
    window.dispatchEvent(new CustomEvent('editor:render'));
    return;
  }

  if (graphState.connectionDraft) { graphState.connectionDraft.mx = mx; graphState.connectionDraft.my = my;
    // Track nearest valid drop target for visual feedback
    const dropRadius = Math.max(30, 20 * graphState.zoom);
    let closest = null, closestDist = Infinity;
    getNodes().forEach(node => {
      if (node.id === graphState.connectionDraft.fromId) return;
      const r = getNodeRect(node);
      const s = worldToScreen(r.x, r.y);
      const sh = r.h * graphState.zoom;
      const d = Math.sqrt((mx - s.x) ** 2 + (my - (s.y + sh / 2)) ** 2);
      if (d < dropRadius && d < closestDist) { closestDist = d; closest = node.id; }
    });
    graphState.connectionDraft.dropTarget = closest;
    return;
  }
  if (graphState.dragging) {
    const d = graphState.dragging;
    const dx = (mx - d.startX) / graphState.zoom;
    const dy = (my - d.startY) / graphState.zoom;
    // Snap delta to 20px grid
    const snapDx = Math.round(dx / 20) * 20;
    const snapDy = Math.round(dy / 20) * 20;
    // Move all nodes in the drag group by their original offset + delta
    d.nodeOffsets.forEach(off => {
      const node = getNodes().find(n => n.id === off.nodeId);
      if (node) {
        node.x = off.ox + snapDx;
        node.y = off.oy + snapDy;
      }
    });
    markDirty();
    return;
  }
  if (graphState.panning) {
    graphState.camera.x = (mx - graphState.panStart.x) / graphState.zoom;
    graphState.camera.y = (my - graphState.panStart.y) / graphState.zoom;
  }
}

function onPointerUp(e) {
  // ── Finalize marquee selection ──
  if (graphState.marquee) {
    graphState.marquee = null;
    window.dispatchEvent(new CustomEvent('editor:render'));
    return;
  }

  // ── Pending empty-space click (no drag happened): deselect + start panning ──
  if (graphState._emptyDownX != null) {
    // It was a click, not a drag — deselect everything (unless Shift held)
    delete graphState._emptyDownX;
    delete graphState._emptyDownY;
    const wasShift = graphState._emptyDownShift;
    delete graphState._emptyDownShift;

    if (!wasShift) {
      graphState.selectedNodeIds = [];
      editorState.selectedItemId = null;
      editorState.selectedItemType = null;
      window.dispatchEvent(new CustomEvent('editor:render'));
    }
    // Start panning from this point
    graphState.panning = true;
    return;
  }

  if (graphState.connectionDraft) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dropRadius = Math.max(30, 20 * graphState.zoom);
    let closest = null, closestDist = Infinity;
    getNodes().forEach(node => {
      if (node.id === graphState.connectionDraft.fromId) return;
      const r = getNodeRect(node);
      const s = worldToScreen(r.x, r.y);
      const sh = r.h * graphState.zoom;
      const d = Math.sqrt((mx - s.x) ** 2 + (my - (s.y + sh / 2)) ** 2);
      if (d < dropRadius && d < closestDist) { closestDist = d; closest = node.id; }
    });
    if (closest) {
      const fn = getNodes().find(n => n.id === graphState.connectionDraft.fromId);
      if (fn) {
        const portIndex = graphState.connectionDraft.portIndex;
        if (fn.type === 'condition' && portIndex === 0) fn.next = closest;
        else if (fn.type === 'condition' && portIndex === 1) fn.else = closest;
        else if ((fn.type === 'choice' || fn.type === 'timed_choice' || fn.type === 'random_branch') && fn.choices?.[portIndex]) {
          fn.choices[portIndex].next = closest;
        }
        else fn.next = closest;
        markDirty();
      }
    }
    graphState.connectionDraft = null;
    window.dispatchEvent(new CustomEvent("editor:render"));
    return;
  }
  graphState.dragging = null;
  graphState.panning = false;
}

function hitTest(mx, my) {
  // Port hit radius scales with zoom, with a generous minimum for usability
  const portHitRadius = Math.max(12, PORT_R * graphState.zoom) + 4;
  
  // First pass: check output ports (they extend beyond node bounds, so check independently)
  for (let i = getNodes().length - 1; i >= 0; i--) {
    const node = getNodes()[i];
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * graphState.zoom;
    const oports = getOutputPorts(node, s.x, s.y, sw);
    for (let p = 0; p < oports.length; p++) {
      const dx = mx - oports[p].x, dy = my - oports[p].y;
      if (dx * dx + dy * dy < portHitRadius * portHitRadius) {
        return { type: 'port', nodeId: node.id, portIndex: p };
      }
    }
  }
  
  // Second pass: check node bodies and play buttons
  for (let i = getNodes().length - 1; i >= 0; i--) {
    const node = getNodes()[i];
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * graphState.zoom;
    const sh = r.h * graphState.zoom;
    if (mx >= s.x && mx <= s.x + sw && my >= s.y && my <= s.y + sh) {
      // Play btn hit box
      const playBtnX = s.x + sw - 20 * graphState.zoom - (node.comment ? 20 * graphState.zoom : 0);
      const playBtnY = s.y + 22 * graphState.zoom;
      const dxPlay = mx - (playBtnX + 5 * graphState.zoom);
      const dyPlay = my - (playBtnY - 4 * graphState.zoom);
      if (dxPlay * dxPlay + dyPlay * dyPlay < 144) return { type: 'play-btn', nodeId: node.id };

      return { type: 'node', nodeId: node.id };
    }
  }
  return null;
}
