import { editorState, markDirty } from './state.js';

const TYPE_COLORS = { dialogue: '#3b82f6', choice: '#f59e0b', condition: '#10b981', event: '#8b5cf6', call_scene: '#ec4899', wait: '#64748b', end: '#ef4444', set_variable: '#059669', timed_choice: '#d97706', random_branch: '#6366f1', animate: '#0284c7', show_object: '#14b8a6', hide_object: '#94a3b8', camera: '#8b5cf6' };
const NODE_W = 200, NODE_H = 64, PORT_R = 6;

let canvas, ctx;
let contextMenu = null;
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
  window.addEventListener('scene:changed', () => {
    if (graphState) {
      graphState.camera.x = -300;
      graphState.camera.y = 0;
      graphState.zoom = 1;
    }
  });

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

  // Type-specific defaults
  if (type === 'dialogue') {
    node.speaker = '';
    node.text = 'New dialogue';
    node.next = '';
  } else if (type === 'choice') {
    node.prompt = '';
    node.choices = [{ text: 'Choice 1', next: '' }];
    node.next = '';
  } else if (type === 'condition') {
    node.condition = 'flag == true';
    node.next = '';
    node.else = '';
  } else if (type === 'event') {
    node.eventType = 'sfx';
    node.eventValue = '';
    node.next = '';
  } else if (type === 'call_scene') {
    node.sceneId = '';
    node.next = '';
  } else if (type === 'wait') {
    node.duration = 1000;
    node.next = '';
  } else if (type === 'end') {
    node.text = '';
    node.nextScene = '';
  }

  if (!sceneData.nodes) sceneData.nodes = [];
  sceneData.nodes.push(node);
  markDirty();

  // Select the new node
  editorState.selectedItemId = node.id;
  editorState.selectedItemType = 'node';
  window.dispatchEvent(new CustomEvent('editor:render'));

  return node;
}

export function deleteNode(nodeId) {
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
  if (editorState.selectedItemType === 'node' && editorState.selectedItemId) {
    deleteNode(editorState.selectedItemId);
  }
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

  const nodeTypes = [
    { label: 'Dialogue', type: 'dialogue' },
    { label: 'Choice', type: 'choice' },
    { label: 'Condition', type: 'condition' },
    { label: 'Event', type: 'event' },
    { label: 'Wait', type: 'wait' },
    { label: 'End Scene', type: 'end' },
    { label: 'Set Variable', type: 'set_variable' },
    { label: 'Timed Choice', type: 'timed_choice' },
    { label: 'Random Branch', type: 'random_branch' },
    { label: 'Animate', type: 'animate' },
    { label: 'Show Object', type: 'show_object' },
    { label: 'Hide Object', type: 'hide_object' },
    { label: 'Camera', type: 'camera' }
  ];

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
    if (n.next) conns.push({ from: n.id, port: 0, to: n.next });
    if (n.type === 'choice') (n.choices || []).forEach((c, i) => { if (c.next) conns.push({ from: n.id, port: i, to: c.next }); });
    if (n.type === 'condition') {
      if (n.next) conns.push({ from: n.id, port: 0, to: n.next, label: 'TRUE' });
      if (n.else) conns.push({ from: n.id, port: 1, to: n.else, label: 'FALSE' });
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
  }

  const selectedNodeId = editorState.selectedItemType === 'node' ? editorState.selectedItemId : null;

  // Draw nodes
  getNodes().forEach(node => {
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * graphState.zoom;
    const sh = r.h * graphState.zoom;
    const selected = node.id === selectedNodeId;
    const color = TYPE_COLORS[node.type] || '#666';
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

    // Preview snippet
    let snippet = '';
    if (node.type === 'dialogue' && node.text) snippet = node.text.slice(0, 22) + '…';
    if (node.type === 'choice' && node.prompt) snippet = node.prompt.slice(0, 18) + '…';
    if (snippet) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
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
      ctx.beginPath(); ctx.arc(p.x, p.y, PORT_R * graphState.zoom, 0, Math.PI * 2);
      let pc = 'rgba(255,255,255,0.2)';
      if (node.type === 'condition') pc = i === 0 ? '#22c55e' : '#ef4444';
      if (node.type === 'choice') pc = '#d97706';
      ctx.fillStyle = pc; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    });
  });
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
  if (node.type === 'choice') return Math.max(NODE_H, 36 + (node.choices || []).length * 20);
  if (node.type === 'condition' || node.type === 'event') return 54;
  return NODE_H;
}

function getPortY(node, portIdx) {
  const h = getNodeHeight(node);
  if (node.type === 'choice') return 14 + (portIdx || 0) * 20;
  if (node.type === 'condition') return portIdx === 0 ? h * 0.35 : h * 0.65;
  return h / 2;
}

function getOutputPorts(node, sx, sy, sw) {
  const ports = [];
  const h = getNodeHeight(node) * graphState.zoom;
  if (node.type === 'choice') {
    (node.choices || []).forEach((c, i) => ports.push({ x: sx + sw, y: sy + 14 + i * 20 * graphState.zoom }));
  } else if (node.type === 'condition') {
    ports.push({ x: sx + sw, y: sy + h * 0.35 });
    ports.push({ x: sx + sw, y: sy + h * 0.65 });
  } else if (node.type !== 'end') {
    ports.push({ x: sx + sw, y: sy + h / 2 });
  }
  return ports;
}

function onPointerDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = hitTest(mx, my);

  if (hit?.type === 'port') {
    graphState.connectionDraft = { fromId: hit.nodeId, portIndex: hit.portIndex, mx, my };
    return;
  }
  if (hit?.type === 'node') {
    editorState.selectedItemId = hit.nodeId; 
    editorState.selectedItemType = "node"; 
    window.dispatchEvent(new CustomEvent("editor:render"));
    
    const node = getNodes().find(n => n.id === hit.nodeId);
    graphState.dragging = { nodeId: hit.nodeId, startX: mx, startY: my, nodeX: node?.x, nodeY: node?.y };
    return;
  }
  if (hit?.type === 'play-btn') {
    if (window.__playFromNode) {
      window.__playFromNode(hit.nodeId);
    }
    return;
  }
  graphState.panning = true;
  graphState.panStart = { x: mx - graphState.camera.x * graphState.zoom, y: my - graphState.camera.y * graphState.zoom };
  
  // Deselect on empty click
  editorState.selectedItemId = null;
  editorState.selectedItemType = null;
  window.dispatchEvent(new CustomEvent("editor:render"));
}

function onPointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (graphState.connectionDraft) { graphState.connectionDraft.mx = mx; graphState.connectionDraft.my = my; return; }
  if (graphState.dragging) {
    const d = graphState.dragging;
    const node = getNodes().find(n => n.id === d.nodeId);
    if (node) {
      node.x = Math.round((d.nodeX + (mx - d.startX) / graphState.zoom) / 20) * 20;
      node.y = Math.round((d.nodeY + (my - d.startY) / graphState.zoom) / 20) * 20;
      markDirty();
    }
    return;
  }
  if (graphState.panning) {
    graphState.camera.x = (mx - graphState.panStart.x) / graphState.zoom;
    graphState.camera.y = (my - graphState.panStart.y) / graphState.zoom;
  }
}

function onPointerUp(e) {
  if (graphState.connectionDraft) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let closest = null, closestDist = Infinity;
    getNodes().forEach(node => {
      if (node.id === graphState.connectionDraft.fromId) return;
      const r = getNodeRect(node);
      const s = worldToScreen(r.x, r.y);
      const sh = r.h * graphState.zoom;
      const d = Math.sqrt((mx - s.x) ** 2 + (my - (s.y + sh / 2)) ** 2);
      if (d < 30 && d < closestDist) { closestDist = d; closest = node.id; }
    });
    if (closest) {
      const fn = getNodes().find(n => n.id === graphState.connectionDraft.fromId);
      if (fn) {
        if (fn.type === 'condition' && graphState.connectionDraft.portIndex === 0) fn.next = closest;
        else if (fn.type === 'condition' && graphState.connectionDraft.portIndex === 1) fn.else = closest;
        else if (fn.type === 'choice' && fn.choices?.[graphState.connectionDraft.portIndex]) fn.choices[graphState.connectionDraft.portIndex].next = closest;
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
  for (let i = getNodes().length - 1; i >= 0; i--) {
    const node = getNodes()[i];
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * graphState.zoom;
    const sh = r.h * graphState.zoom;
    if (mx >= s.x && mx <= s.x + sw && my >= s.y && my <= s.y + sh) {
      const oports = getOutputPorts(node, s.x, s.y, sw);
      for (let p = 0; p < oports.length; p++) {
        const dx = mx - oports[p].x, dy = my - oports[p].y;
        if (dx * dx + dy * dy < 100) return { type: 'port', nodeId: node.id, portIndex: p };
      }
      
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
