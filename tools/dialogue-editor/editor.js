// ══════════════════════════════════════════════════════════════
//  Dialogue Editor — Narrative Engine
//  Standalone node graph editor for scene JSON files.
// ══════════════════════════════════════════════════════════════

// ─── STATE ──────────────────────────────────────────────────

const TYPE_COLORS = {
  dialogue: '#2563eb', choice: '#d97706', condition: '#7c3aed',
  event: '#059669', wait: '#6b7280', end: '#dc2626'
};
const TYPE_LABELS = {
  dialogue: '💬 Dialogue', choice: '◇ Choice', condition: '△ Condition',
  event: '⚡ Event', wait: '◻ Wait', end: '■ End'
};

let state = {
  gameConfig: null, characters: {}, variableDefs: {},
  sceneId: '', sceneData: null, nodes: [],
  selectedNodeId: null,
  camera: { x: 0, y: 0 }, zoom: 1,
  dragging: null, panning: false, panStart: { x: 0, y: 0 },
  connectionDraft: null,
  dirty: false, previewOpen: false,
  allNodeIds: new Set()
};

let canvas, ctx;
const NODE_W = 170, NODE_H = 44, PORT_R = 5;

// Suppress auto-save after user dismisses draft restore dialog
let _draftSuppressed = false;

// ─── INIT ───────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  initCanvas();

  const draft = localStorage.getItem('dialogue_editor_draft');
  if (draft) {
    try {
      const d = JSON.parse(draft);
      if (confirm(`Restore unsaved draft? (Scene: ${d.sceneId}, ${d.nodes?.length || 0} nodes)`)) {
        state.nodes = d.nodes || [];
        state.sceneId = d.sceneId;
        state.gameConfig = d.gameConfig;
        state.characters = d.characters || {};
        state.variableDefs = d.variableDefs || {};
        state.allNodeIds = new Set(state.nodes.map(n => n.id));
        state.selectedNodeId = null;
        state.dirty = true;
        renderAll();
        setStatus('Restored draft', 'dirty');
        const sel = document.getElementById('scene-select');
        if (sel) sel.value = d.sceneId;
        return;
      }
      // User dismissed the restore dialog — clear draft and suppress future saves
      localStorage.removeItem('dialogue_editor_draft');
      _draftSuppressed = true;
    } catch(e) { /* ignore corrupt draft */ }
    localStorage.removeItem('dialogue_editor_draft');
  }

  // Listen for project state from the integrated editor (postMessage)
  // If embedded in an iframe inside the integrated editor, the parent sends
  // the current project state so we don't read stale data from disk.
  // Timeout: fall back to disk fetch if no parent message arrives.
  let parentMsgReceived = false;

  window.addEventListener('message', function onMsg(e) {
    if (e.data?.type === 'project-state') {
      parentMsgReceived = true;
      window.removeEventListener('message', onMsg);
      applyProjectState(e.data);
    }
  });

  setTimeout(() => {
    if (!parentMsgReceived) {
      loadGameData(); // fallback: load from disk (standalone mode)
    }
  }, 300);
});

function bindUI() {
  const byId = id => document.getElementById(id);
  byId('btn-new-scene')?.addEventListener('click', newScene);
  byId('btn-delete-scene')?.addEventListener('click', deleteScene);
  byId('btn-add-node')?.addEventListener('click', addNode);
  byId('btn-list-add-node')?.addEventListener('click', addNode);
  byId('btn-auto-layout')?.addEventListener('click', autoLayout);
  byId('btn-fit-view')?.addEventListener('click', fitView);
  byId('btn-fit')?.addEventListener('click', fitView);
  byId('btn-preview')?.addEventListener('click', togglePreview);
  byId('btn-close-preview')?.addEventListener('click', togglePreview);
  byId('btn-export')?.addEventListener('click', exportScene);
  byId('btn-zoom-in')?.addEventListener('click', zoomIn);
  byId('btn-zoom-out')?.addEventListener('click', zoomOut);
  byId('scene-select')?.addEventListener('change', onSceneSelect);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); exportScene(); }
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); addNode(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId &&
        !e.target.closest('input,textarea,select')) {
      e.preventDefault();
      deleteNode();
    }
    if (e.key === 'Escape') { state.selectedNodeId = null; renderAll(); }
  });
}

// ─── DATA LOADING ──────────────────────────────────────────

async function loadGameData() {
  try {
    const [game, chars, vars] = await Promise.all([
      fetchData('/data/game.json'),
      fetchData('/data/characters.json'),
      fetchData('/data/variables.json')
    ]);
    state.gameConfig = game;
    state.characters = chars;
    state.variableDefs = vars;

    const sel = document.getElementById('scene-select');
    sel.innerHTML = '';
    (game.scenes || []).forEach(id => {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = id;
      sel.appendChild(opt);
    });

    if (game.scenes?.length > 0) {
      sel.value = game.scenes[0];
      await loadScene(game.scenes[0]);
    }
    setStatus('Loaded ' + (game.scenes || []).length + ' scenes', 'saved');
  } catch(e) {
    console.error('Data load error:', e);
    setStatus('Error loading data', 'dirty');
  }
}

async function loadScene(sceneId) {
  try {
    const resp = await fetch(`/data/scenes/${sceneId}.json`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    state.sceneId = sceneId;
    state.sceneData = data;
    state.nodes = data.nodes || [];
    state.selectedNodeId = null;
    state.dirty = false;
    state.allNodeIds = new Set(state.nodes.map(n => n.id));
    state.nodes.forEach((n, i) => {
      if (n.x === undefined) n.x = 400 + Math.random() * 60;
      if (n.y === undefined) n.y = 30 + i * 100;
    });
    renderAll();
    setStatus(`Scene: ${sceneId} (${state.nodes.length} nodes)`, 'saved');
    document.getElementById('scene-select').value = sceneId;
  } catch(e) {
    console.error('Scene load error:', e);
    setStatus(`Error loading: ${sceneId}`, 'dirty');
  }
}

async function fetchData(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

/**
 * Apply project state received via postMessage from the integrated editor.
 * Populates the scene selector and loads the first scene from in-memory data.
 */
function applyProjectState(data) {
  state.gameConfig = data.game || { scenes: [], title: 'New Project', defaults: {} };
  state.characters = data.characters || {};
  state.variableDefs = data.variables || {};

  const sel = document.getElementById('scene-select');
  sel.innerHTML = '';
  const scenes = data.game?.scenes || [];

  if (scenes.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = '— No scenes —';
    sel.appendChild(opt);
    state.nodes = [];
    state.selectedNodeId = null;
    state.allNodeIds = new Set();
    renderAll();
    setStatus('New project — 0 scenes', 'saved');
    return;
  }

  scenes.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = id;
    sel.appendChild(opt);
  });

  sel.value = scenes[0];
  const sceneData = data.scenes?.[scenes[0]];
  if (sceneData) {
    applySceneData(scenes[0], sceneData);
  } else {
    // Scene registered but not in memory — load from disk (shouldn't normally happen)
    loadScene(scenes[0]);
  }
}

/**
 * Load scene data into editor state (from in-memory data, not disk).
 */
function applySceneData(sceneId, data) {
  state.sceneId = sceneId;
  state.sceneData = data;
  state.nodes = data.nodes || [];
  state.selectedNodeId = null;
  state.dirty = false;
  state.allNodeIds = new Set(state.nodes.map(n => n.id));
  state.nodes.forEach((n, i) => {
    if (n.x === undefined) n.x = 400 + Math.random() * 60;
    if (n.y === undefined) n.y = 30 + i * 100;
  });
  renderAll();
  setStatus(`Scene: ${sceneId} (${state.nodes.length} nodes)`, 'saved');
  const sel = document.getElementById('scene-select');
  if (sel) sel.value = sceneId;
}

function onSceneSelect(e) {
  if (state.dirty && !confirm('Discard unsaved changes?')) return;
  loadScene(e.target.value);
}

// ─── CANVAS ─────────────────────────────────────────────────

function initCanvas() {
  canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('wheel', e => { e.preventDefault();
    state.zoom = Math.max(0.3, Math.min(2, state.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
  }, { passive: false });

  // Touch
  canvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e.touches[0]); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); onPointerMove(e.touches[0]); });
  canvas.addEventListener('touchend', e => { e.preventDefault(); onPointerUp(e); });

  requestAnimationFrame(renderLoop);
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function renderLoop() {
  try { renderCanvas(); } catch(e) { console.error('Render error:', e); }
  requestAnimationFrame(renderLoop);
}

// ─── COORDINATE HELPERS ────────────────────────────────────

function worldToScreen(wx, wy) {
  return {
    x: (wx + state.camera.x) * state.zoom + canvas.width / 2,
    y: (wy + state.camera.y) * state.zoom + canvas.height / 2
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2) / state.zoom - state.camera.x,
    y: (sy - canvas.height / 2) / state.zoom - state.camera.y
  };
}

// ─── CANVAS RENDER ─────────────────────────────────────────

function renderCanvas() {
  if (!canvas || !ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const gs = 40 * state.zoom;
  const ox = (state.camera.x * state.zoom + W / 2) % gs;
  const oy = (state.camera.y * state.zoom + H / 2) % gs;
  for (let x = ox - gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = oy - gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Collect connections
  const conns = [];
  state.nodes.forEach(n => {
    if (n.next) conns.push({ from: n.id, port: 0, to: n.next });
    if (n.type === 'choice') (n.choices || []).forEach((c, i) => { if (c.next) conns.push({ from: n.id, port: i, to: c.next }); });
    if (n.type === 'condition') {
      if (n.next) conns.push({ from: n.id, port: 0, to: n.next, label: 'TRUE' });
      if (n.else) conns.push({ from: n.id, port: 1, to: n.else, label: 'FALSE' });
    }
  });

  // Draw connections
  conns.forEach(c => {
    const fn = state.nodes.find(x => x.id === c.from);
    const tn = state.nodes.find(x => x.id === c.to);
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
  if (state.connectionDraft) {
    const fn = state.nodes.find(x => x.id === state.connectionDraft.fromId);
    if (fn) {
      const fr = getNodeRect(fn);
      const fs = worldToScreen(fr.x + fr.w, fr.y + getPortY(fn, state.connectionDraft.portIndex));
      ctx.beginPath();
      ctx.moveTo(fs.x, fs.y);
      ctx.bezierCurveTo((fs.x + state.connectionDraft.mx) / 2, fs.y, (fs.x + state.connectionDraft.mx) / 2, state.connectionDraft.my, state.connectionDraft.mx, state.connectionDraft.my);
      ctx.strokeStyle = 'rgba(0,204,255,0.4)';
      ctx.lineWidth = 2; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Draw nodes
  state.nodes.forEach(node => {
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * state.zoom;
    const sh = r.h * state.zoom;
    const selected = node.id === state.selectedNodeId;
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
    ctx.font = `bold ${11 * state.zoom}px Consolas, monospace`;
    ctx.fillText(node.id, s.x + 8 * state.zoom, s.y + 22 * state.zoom);
    ctx.fillStyle = color;
    ctx.font = `${9 * state.zoom}px sans-serif`;
    ctx.fillText(node.type.toUpperCase(), s.x + 8 * state.zoom, s.y + 35 * state.zoom);

    // Preview snippet
    let snippet = '';
    if (node.type === 'dialogue' && node.text) snippet = node.text.slice(0, 22) + '…';
    if (node.type === 'choice' && node.prompt) snippet = node.prompt.slice(0, 18) + '…';
    if (snippet) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = `${9 * state.zoom}px sans-serif`;
      ctx.fillText(snippet, s.x + 8 * state.zoom, s.y + sh - 6 * state.zoom);
    }

    // Input port
    ctx.beginPath(); ctx.arc(s.x, s.y + sh / 2, PORT_R * state.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2a40'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.stroke();

    // Output ports
    const oports = getOutputPorts(node, s.x, s.y, sw);
    oports.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, PORT_R * state.zoom, 0, Math.PI * 2);
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
  const h = getNodeHeight(node) * state.zoom;
  if (node.type === 'choice') {
    (node.choices || []).forEach((c, i) => ports.push({ x: sx + sw, y: sy + 14 + i * 20 * state.zoom }));
  } else if (node.type === 'condition') {
    ports.push({ x: sx + sw, y: sy + h * 0.35 });
    ports.push({ x: sx + sw, y: sy + h * 0.65 });
  } else if (node.type !== 'end') {
    ports.push({ x: sx + sw, y: sy + h / 2 });
  }
  return ports;
}

// ─── CANVAS INPUT ──────────────────────────────────────────

function onPointerDown(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const hit = hitTest(mx, my);

  if (hit?.type === 'port') {
    state.connectionDraft = { fromId: hit.nodeId, portIndex: hit.portIndex, mx, my };
    return;
  }
  if (hit?.type === 'node') {
    selectNode(hit.nodeId);
    const node = state.nodes.find(n => n.id === hit.nodeId);
    state.dragging = { nodeId: hit.nodeId, startX: mx, startY: my, nodeX: node?.x, nodeY: node?.y };
    return;
  }
  state.panning = true;
  state.panStart = { x: mx - state.camera.x * state.zoom, y: my - state.camera.y * state.zoom };
  state.selectedNodeId = null;
  renderAll();
}

function onPointerMove(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (state.connectionDraft) { state.connectionDraft.mx = mx; state.connectionDraft.my = my; return; }
  if (state.dragging) {
    const d = state.dragging;
    const node = state.nodes.find(n => n.id === d.nodeId);
    if (node) {
      node.x = Math.round((d.nodeX + (mx - d.startX) / state.zoom) / 20) * 20;
      node.y = Math.round((d.nodeY + (my - d.startY) / state.zoom) / 20) * 20;
      markDirty();
    }
    return;
  }
  if (state.panning) {
    state.camera.x = (mx - state.panStart.x) / state.zoom;
    state.camera.y = (my - state.panStart.y) / state.zoom;
  }
}

function onPointerUp(e) {
  if (state.connectionDraft) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let closest = null, closestDist = Infinity;
    state.nodes.forEach(node => {
      if (node.id === state.connectionDraft.fromId) return;
      const r = getNodeRect(node);
      const s = worldToScreen(r.x, r.y);
      const sh = r.h * state.zoom;
      const d = Math.sqrt((mx - s.x) ** 2 + (my - (s.y + sh / 2)) ** 2);
      if (d < 30 && d < closestDist) { closestDist = d; closest = node.id; }
    });
    if (closest) {
      const fn = state.nodes.find(n => n.id === state.connectionDraft.fromId);
      if (fn) {
        if (fn.type === 'condition' && state.connectionDraft.portIndex === 0) fn.next = closest;
        else if (fn.type === 'condition' && state.connectionDraft.portIndex === 1) fn.else = closest;
        else if (fn.type === 'choice' && fn.choices?.[state.connectionDraft.portIndex]) fn.choices[state.connectionDraft.portIndex].next = closest;
        else fn.next = closest;
        markDirty();
      }
    }
    state.connectionDraft = null;
    renderEditor(); renderNodeList();
    return;
  }
  state.dragging = null;
  state.panning = false;
}

function hitTest(mx, my) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const node = state.nodes[i];
    const r = getNodeRect(node);
    const s = worldToScreen(r.x, r.y);
    const sw = r.w * state.zoom;
    const sh = r.h * state.zoom;
    if (mx >= s.x && mx <= s.x + sw && my >= s.y && my <= s.y + sh) {
      const oports = getOutputPorts(node, s.x, s.y, sw);
      for (let p = 0; p < oports.length; p++) {
        const dx = mx - oports[p].x, dy = my - oports[p].y;
        if (dx * dx + dy * dy < 100) return { type: 'port', nodeId: node.id, portIndex: p };
      }
      return { type: 'node', nodeId: node.id };
    }
  }
  return null;
}

// ─── NODE LIST ──────────────────────────────────────────────

function renderNodeList() {
  const container = document.getElementById('node-list-items');
  if (!container) return;
  container.innerHTML = '';
  state.nodes.forEach(node => {
    const el = document.createElement('div');
    el.className = 'node-item' + (node.id === state.selectedNodeId ? ' selected' : '');
    el.innerHTML = `<div class="type-badge" style="background:${TYPE_COLORS[node.type]||'#666'}"></div>
      <span class="node-id">${node.id}</span>
      <span class="node-preview">${node.type}${node.type==='dialogue'&&node.text?': '+node.text.slice(0,18):''}</span>`;
    el.addEventListener('click', () => selectNode(node.id));
    container.appendChild(el);
  });
}

// ─── NODE EDITOR ────────────────────────────────────────────

function renderEditor() {
  const container = document.getElementById('editor-content');
  if (!container) return;
  const node = state.nodes.find(n => n.id === state.selectedNodeId);
  if (!node) { container.innerHTML = '<div class="empty">Select a node to edit</div>'; return; }

  const speakerOpts = Object.keys(state.characters).map(k =>
    `<option value="${k}"${node.speaker===k?' selected':''}>${state.characters[k]?.name||k}</option>`
  ).join('');
  const varOpts = Object.keys(state.variableDefs).map(k =>
    `<option value="${k}">${k}</option>`
  ).join('');
  const nodeOpts = state.nodes.filter(n => n.id !== node.id).map(n =>
    `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`
  ).join('');

  let html = `<div class="form-group">
    <label>Node ID</label>
    <input type="text" value="${node.id}" onchange="window.__updateField('id', this.value)" />
  </div>
  <div class="form-group">
    <label>Type</label>
    <select onchange="window.__updateType(this.value)">
      ${Object.entries(TYPE_LABELS).map(([k,v]) => `<option value="${k}"${node.type===k?' selected':''}>${v}</option>`).join('')}
    </select>
  </div>`;

  switch (node.type) {
    case 'dialogue':
      html += `<div class="form-group"><label>Speaker</label><select onchange="window.__updateField('speaker',this.value)">
        <option value="">(narration)</option>${speakerOpts}</select></div>
        <div class="form-group"><label>Expression</label><input value="${node.expression||''}" onchange="window.__updateField('expression',this.value)"/></div>
        <div class="form-group"><label>Text</label><textarea onchange="window.__updateField('text',this.value)">${(node.text||'').replace(/</g,'&lt;')}</textarea></div>
        <div class="form-row"><div class="form-group"><label>Auto</label><select onchange="window.__updateField('autoAdvance',this.value==='true')">
          <option value="false">No</option><option value="true"${node.autoAdvance?' selected':''}>Yes</option></select></div>
        <div class="form-group"><label>Wait ms</label><input type="number" value="${node.waitTime||2000}" onchange="window.__updateField('waitTime',+this.value||2000)"/></div></div>
        <div class="form-group"><label>Next</label><select onchange="window.__updateField('next',this.value)"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'choice':
      html += `<div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/</g,'&lt;')}" onchange="window.__updateField('prompt',this.value)"/></div>
        <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
        <label>Choices (${(node.choices||[]).length})</label>
        <div id="choice-list">${(node.choices||[]).map((c,i)=>window.__choiceRow(i,c)).join('')}</div>
        <button class="add-btn" onclick="window.__addChoice()">+ Add Choice</button></div>`;
      break;
    case 'condition':
      html += `<div class="form-group"><label>Condition</label>
        <div class="form-row"><select style="flex:1" onchange="window.__rebuildCondition()"><option value="">— variable —</option>${varOpts}</select>
        <select style="width:60px" onchange="window.__rebuildCondition()">
          <option value="==">==</option><option value="!=">!=</option><option value=">=">&gt;=</option>
          <option value="<=">&lt;=</option><option value=">">&gt;</option><option value="<">&lt;</option></select>
        <input style="width:60px" placeholder="val" onchange="window.__rebuildCondition()"/></div></div>
        <div class="form-group"><label>TRUE →</label><select onchange="window.__updateField('next',this.value)"><option value="">— none —</option>${nodeOpts}</select></div>
        <div class="form-group"><label>FALSE →</label><select onchange="window.__updateField('else',this.value)"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'event':
      html += `<div class="form-group"><label>Event Type</label><select onchange="window.__updateField('eventType',this.value)">
        <option value="sfx"${node.eventType==='sfx'?' selected':''}>Play SFX</option>
        <option value="bgm"${node.eventType==='bgm'?' selected':''}>Play BGM</option>
        <option value="camera_shake"${node.eventType==='camera_shake'?' selected':''}>Camera Shake</option>
        <option value="camera_flash"${node.eventType==='camera_flash'?' selected':''}>Camera Flash</option>
        <option value="set_flag"${node.eventType==='set_flag'?' selected':''}>Set Variable</option></select></div>
        <div class="form-group"><label>Value</label><input value="${node.eventValue||''}" onchange="window.__updateField('eventValue',this.value)"/></div>
        <div class="form-group"><label>Next</label><select onchange="window.__updateField('next',this.value)"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'wait':
      html += `<div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||1000}" onchange="window.__updateField('duration',+this.value||1000)"/></div>
        <div class="form-group"><label>Next</label><select onchange="window.__updateField('next',this.value)"><option value="">— none —</option>${nodeOpts}</select></div>`;
      break;
    case 'end':
      html += `<div class="form-group"><label>Ending text</label><input value="${(node.text||'').replace(/</g,'&lt;')}" onchange="window.__updateField('text',this.value)"/></div>
        <div class="form-group"><label>Next scene</label><select onchange="window.__updateField('nextScene',this.value)">
          <option value="">— end —</option>${(state.gameConfig?.scenes||[]).map(s => `<option value="${s}"${node.nextScene===s?' selected':''}>${s}</option>`).join('')}
        </select></div>`;
      break;
  }

  // Variable actions (all types)
  html += `<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:6px">
    <div class="form-row"><div class="form-group"><label>Set var</label><select onchange="window.__updateField('setFlag',this.value||undefined)">
      <option value="">— none —</option>${varOpts}</select></div>
    <div class="form-group"><label>Value</label><input value="${node.setValue??''}" onchange="window.__updateField('setValue',window.__parseVal(this.value))"/></div></div></div>`;
  html += `<button class="delete-btn" onclick="window.__deleteNode()">✕ Delete Node</button>`;

  container.innerHTML = html;
}

function selectNode(id) {
  state.selectedNodeId = id;
  renderNodeList();
  renderEditor();
  updatePreview();
}

// ─── WINDOW EXPORTS (for dynamically-generated HTML) ───────

window.__getNode = () => state.nodes.find(n => n.id === state.selectedNodeId);

window.__updateField = (field, value) => {
  const node = window.__getNode();
  if (!node) return;
  if (field === 'id' && value !== node.id) {
    if (state.nodes.find(n => n.id === value)) return alert('ID exists');
    const old = node.id;
    state.nodes.forEach(n => {
      if (n.next === old) n.next = value;
      if (n.else === old) n.else = value;
      if (n.choices) n.choices.forEach(c => { if (c.next === old) c.next = value; });
    });
    state.allNodeIds.delete(old); state.allNodeIds.add(value);
    state.selectedNodeId = value;
  }
  if (field === 'setFlag' && !value) { delete node.setFlag; delete node.setValue; }
  else node[field] = value;
  markDirty();
};

window.__updateType = newType => {
  const node = window.__getNode();
  if (!node) return;
  // Clear type-specific fields
  ['speaker','expression','text','autoAdvance','waitTime','prompt','choices','condition','else',
   'eventType','eventValue','duration','nextScene'].forEach(f => delete node[f]);
  node.type = newType;
  markDirty();
};

window.__addChoice = () => {
  const node = window.__getNode();
  if (!node) return;
  if (!node.choices) node.choices = [];
  node.choices.push({ text: 'New option', next: '' });
  markDirty();
};

window.__removeChoice = idx => {
  const node = window.__getNode();
  if (!node?.choices) return;
  node.choices.splice(idx, 1);
  markDirty();
};

window.__updateChoice = (idx, field, value) => {
  const node = window.__getNode();
  if (!node?.choices?.[idx]) return;
  if (field === 'setFlag' && !value) { delete node.choices[idx].setFlag; delete node.choices[idx].setValue; }
  else node.choices[idx][field] = value;
  markDirty();
};

window.__choiceRow = (index, choice) => {
  const nodeOpts = state.nodes.filter(n => n.id !== state.selectedNodeId).map(n =>
    `<option value="${n.id}"${choice.next===n.id?' selected':''}>${n.id}</option>`).join('');
  const varOpts = Object.keys(state.variableDefs).map(k =>
    `<option value="${k}"${choice.setFlag===k?' selected':''}>${k}</option>`).join('');
  return `<div class="choice-row">
    <div class="choice-header"><span class="choice-label">Choice ${index+1}</span>
      <button onclick="window.__removeChoice(${index})">✕</button></div>
    <input value="${(choice.text||'').replace(/</g,'&lt;')}" placeholder="Option text" onchange="window.__updateChoice(${index},'text',this.value)"/>
    <select style="width:100%;margin:3px 0" onchange="window.__updateChoice(${index},'next',this.value)">
      <option value="">→ next</option>${nodeOpts}</select>
    <div class="form-row"><select style="flex:1" onchange="window.__updateChoice(${index},'setFlag',this.value||undefined)">
      <option value="">— set var —</option>${varOpts}</select>
      <input style="width:60px" value="${choice.setValue??''}" placeholder="val" onchange="window.__updateChoice(${index},'setValue',window.__parseVal(this.value))"/></div>
  </div>`;
};

window.__rebuildCondition = () => {
  const node = window.__getNode();
  if (!node) return;
  const container = document.getElementById('editor-content');
  if (!container) return;
  const selects = container.querySelectorAll('.form-row select, .form-row input');
  if (selects.length >= 3) {
    const v = selects[0]?.value, o = selects[1]?.value, vl = selects[2]?.value;
    node.condition = v && o ? `${v} ${o} ${vl||''}` : undefined;
    markDirty();
  }
};

window.__parseVal = v => {
  if (v === 'true') return true; if (v === 'false') return false;
  if (v === '' || v == null) return undefined;
  return isNaN(Number(v)) ? v : Number(v);
};

window.__deleteNode = () => deleteNode();

// ─── ACTIONS ────────────────────────────────────────────────

function addNode() {
  const baseId = 'node_' + (state.nodes.length + 1);
  let id = baseId, c = 1;
  while (state.nodes.find(n => n.id === id)) id = baseId + '_' + c++;
  state.nodes.push({ id, type: 'dialogue', speaker: null, text: 'New node', x: 400 + Math.random() * 100, y: 30 + state.nodes.length * 90 });
  state.allNodeIds.add(id);
  state.selectedNodeId = id;
  markDirty();
}

function deleteNode() {
  if (!state.selectedNodeId || !confirm(`Delete "${state.selectedNodeId}"?`)) return;
  const id = state.selectedNodeId;
  state.nodes.forEach(n => {
    if (n.next === id) n.next = null;
    if (n.else === id) n.else = null;
    if (n.choices) n.choices.forEach(c => { if (c.next === id) c.next = null; });
  });
  state.nodes = state.nodes.filter(n => n.id !== id);
  state.allNodeIds.delete(id);
  state.selectedNodeId = null;
  markDirty();
}

function newScene() {
  const id = prompt('Scene ID:', 'new_scene_' + Date.now());
  if (!id) return;
  state.nodes = [{ id: 'start', type: 'dialogue', speaker: 'narrator', text: 'Start writing here.', x: 400, y: 30 }];
  state.allNodeIds = new Set(['start']);
  state.sceneId = id;
  state.selectedNodeId = 'start';
  state.dirty = true;
  if (state.gameConfig) {
    if (!state.gameConfig.scenes) state.gameConfig.scenes = [];
    if (!state.gameConfig.scenes.includes(id)) state.gameConfig.scenes.push(id);
  }
  renderAll();
  const sel = document.getElementById('scene-select');
  const opt = document.createElement('option');
  opt.value = id; opt.textContent = id;
  sel.appendChild(opt); sel.value = id;
  setStatus('New scene: ' + id, 'dirty');
}

function deleteScene() {
  if (!state.sceneId || !confirm(`Delete scene "${state.sceneId}"?`)) return;
  if (state.gameConfig?.scenes) state.gameConfig.scenes = state.gameConfig.scenes.filter(s => s !== state.sceneId);
  const sel = document.getElementById('scene-select');
  const idx = sel.selectedIndex;
  sel.remove(idx);
  if (sel.options.length > 0) {
    sel.selectedIndex = Math.min(idx, sel.options.length - 1);
    loadScene(sel.value);
  } else newScene();
}

// ─── EXPORT ────────────────────────────────────────────────

function exportScene() {
  const data = {
    id: state.sceneId,
    entryNode: state.nodes[0]?.id || 'start',
    background: state.sceneData?.background || null,
    music: state.sceneData?.music || null,
    nodes: state.nodes.map(n => {
      const c = { ...n };
      // Strip empty fields
      Object.keys(c).forEach(k => { if (c[k] === null || c[k] === undefined || c[k] === '' || (k === 'choices' && Array.isArray(c[k]) && c[k].length === 0)) delete c[k]; });
      if (c.choices) c.choices = c.choices.filter(x => x.text).map(x => { Object.keys(x).forEach(k => { if (!x[k] && k !== 'text') delete x[k]; }); return x; });
      if (!c.setFlag) { delete c.setFlag; delete c.setValue; }
      c.x = Math.round(c.x) || 400; c.y = Math.round(c.y) || 30;
      return c;
    })
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = state.sceneId + '.json';
  a.click();
  URL.revokeObjectURL(url);
  state.dirty = false;
  _draftSuppressed = false;
  setStatus('Exported: ' + state.sceneId + '.json', 'saved');
}

// ─── AUTO LAYOUT ────────────────────────────────────────────

function autoLayout() {
  if (state.nodes.length === 0) return;
  const cols = Math.ceil(Math.sqrt(state.nodes.length * 1.5));
  state.nodes.forEach((node, i) => {
    node.x = 80 + (i % cols) * 240;
    node.y = 40 + Math.floor(i / cols) * 100;
  });
  markDirty();
}

function fitView() {
  if (state.nodes.length === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.nodes.forEach(n => { if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y; if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y; });
  const pad = 100, w = (maxX - minX) + pad * 2, h = (maxY - minY) + pad * 2;
  state.zoom = Math.max(0.3, Math.min(canvas.width / w, canvas.height / h, 1.5));
  state.camera.x = -(minX + (maxX - minX) / 2);
  state.camera.y = -(minY + (maxY - minY) / 2);
}

function zoomIn() { state.zoom = Math.min(2, state.zoom * 1.2); }
function zoomOut() { state.zoom = Math.max(0.3, state.zoom / 1.2); }

// ─── PREVIEW ───────────────────────────────────────────────

function togglePreview() {
  state.previewOpen = !state.previewOpen;
  document.getElementById('preview').className = state.previewOpen ? 'open' : '';
  updatePreview();
}

function updatePreview() {
  if (!state.previewOpen) return;
  const node = state.nodes.find(n => n.id === state.selectedNodeId);
  const box = document.getElementById('preview-box');
  const speaker = document.getElementById('preview-speaker');
  const text = document.getElementById('preview-text');
  if (!box || !speaker || !text) return;

  if (!node) { speaker.innerHTML = ''; text.innerHTML = '<span style="color:var(--text-dim)">Select a node</span>'; return; }

  if (node.type === 'dialogue') {
    const charData = state.characters[node.speaker];
    speaker.innerHTML = node.speaker && charData?.name
      ? `<span style="color:${charData.color||'#fff'}">${charData.name}</span>`
      : '<span style="color:var(--text-dim)">Narration</span>';
    text.innerHTML = (node.text||'').replace(/\n/g,'<br>') + '<span class="cursor"></span>';
  } else if (node.type === 'choice') {
    speaker.innerHTML = `<span style="color:var(--node-choice)">${node.prompt||'Choose:'}</span>`;
    text.innerHTML = '<div class="choice-list">' + (node.choices||[]).map((c,i) => `<div class="choice-item">[${i+1}] ${c.text||'...'}</div>`).join('') + '</div>';
  } else if (node.type === 'end') {
    speaker.innerHTML = '<span style="color:var(--node-end)">Scene End</span>';
    text.innerHTML = node.text || 'The End';
  } else {
    speaker.innerHTML = '';
    text.innerHTML = `<span style="color:var(--text-dim)">${node.type.toUpperCase()}${node.next?' → '+node.next:''}</span>`;
  }
}

// ─── UI HELPERS ─────────────────────────────────────────────

function renderAll() { renderNodeList(); renderEditor(); updatePreview(); }

function markDirty() {
  state.dirty = true;
  setStatus('Unsaved changes', 'dirty');
  renderNodeList();
  renderEditor();
  updatePreview();
  if (_draftSuppressed) return;
  try {
    localStorage.setItem('dialogue_editor_draft', JSON.stringify({
      sceneId: state.sceneId, nodes: state.nodes, gameConfig: state.gameConfig,
      characters: state.characters, variableDefs: state.variableDefs
    }));
  } catch(e) { /* storage full, ignore */ }
}

function setStatus(text, dotClass) {
  const el = document.getElementById('status-text');
  const dot = document.getElementById('status-dot');
  if (el) el.textContent = text;
  if (dot) dot.className = 'dot ' + dotClass;
}
