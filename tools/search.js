/**
 * search.js — Global search across all scenes (Ctrl+Shift+F).
 * Searches dialogue text, node IDs, speaker names, and choice text.
 */
import { editorState } from './state.js';

let searchOverlay = null;

export function initSearch() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      toggleSearch();
    }
    if (e.key === 'Escape' && searchOverlay) {
      closeSearch();
    }
  });
}

function toggleSearch() {
  if (searchOverlay) {
    closeSearch();
  } else {
    openSearch();
  }
}

function openSearch() {
  const W = window.innerWidth;
  const H = window.innerHeight;

  searchOverlay = document.createElement('div');
  searchOverlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000;
    display:flex; justify-content:center; padding-top:80px;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background:var(--bg-panel); border:1px solid var(--border); border-radius:8px;
    width:600px; max-height:70vh; display:flex; flex-direction:column;
    box-shadow:0 10px 40px rgba(0,0,0,0.5);
  `;

  panel.innerHTML = `
    <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px;">
      <span style="font-size:14px; color:var(--text-muted)">🔍</span>
      <input id="search-input" type="text" placeholder="Search dialogue, nodes, speakers..."
        style="flex:1; background:var(--bg-input); border:1px solid var(--border); color:var(--text);
               padding:8px 12px; border-radius:4px; font-size:13px; outline:none;" />
      <span id="search-count" style="font-size:11px; color:var(--text-muted); white-space:nowrap"></span>
    </div>
    <div id="search-results" style="flex:1; overflow-y:auto; padding:8px;"></div>
    <div style="padding:8px 16px; border-top:1px solid var(--border); font-size:11px; color:var(--text-dim); display:flex; justify-content:space-between;">
      <span>↑↓ navigate · Enter to jump · Esc to close</span>
      <span id="search-scene-count"></span>
    </div>
  `;

  searchOverlay.appendChild(panel);
  document.body.appendChild(searchOverlay);

  // Close on backdrop click
  searchOverlay.addEventListener('click', (e) => {
    if (e.target === searchOverlay) closeSearch();
  });

  const input = panel.querySelector('#search-input');
  const resultsEl = panel.querySelector('#search-results');
  const countEl = panel.querySelector('#search-count');
  const sceneCountEl = panel.querySelector('#search-scene-count');

  let selectedIndex = -1;
  let results = [];

  function performSearch(query) {
    if (!query || query.length < 2) {
      resultsEl.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:12px;">Type at least 2 characters to search</div>`;
      countEl.textContent = '';
      sceneCountEl.textContent = '';
      results = [];
      selectedIndex = -1;
      return;
    }

    results = [];
    const q = query.toLowerCase();

    for (const [sceneId, sceneData] of Object.entries(editorState.scenes)) {
      const nodes = sceneData?.nodes || [];
      for (const node of nodes) {
        // Search node ID
        if (node.id && node.id.toLowerCase().includes(q)) {
          results.push({ sceneId, nodeId: node.id, field: 'id', value: node.id, type: node.type });
        }
        // Search dialogue text
        if (node.text && node.text.toLowerCase().includes(q)) {
          results.push({ sceneId, nodeId: node.id, field: 'text', value: node.text, type: node.type, speaker: node.speaker });
        }
        // Search speaker
        if (node.speaker && node.speaker.toLowerCase().includes(q)) {
          results.push({ sceneId, nodeId: node.id, field: 'speaker', value: node.speaker, type: node.type });
        }
        // Search choice text
        if (node.choices) {
          for (const choice of node.choices) {
            if (choice.text && choice.text.toLowerCase().includes(q)) {
              results.push({ sceneId, nodeId: node.id, field: 'choice', value: choice.text, type: node.type });
            }
          }
        }
        // Search prompt (choice nodes)
        if (node.prompt && node.prompt.toLowerCase().includes(q)) {
          results.push({ sceneId, nodeId: node.id, field: 'prompt', value: node.prompt, type: node.type });
        }
      }
    }

    // Deduplicate by sceneId+nodeId+field
    const seen = new Set();
    results = results.filter(r => {
      const key = `${r.sceneId}:${r.nodeId}:${r.field}:${r.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    countEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    const sceneSet = new Set(results.map(r => r.sceneId));
    sceneCountEl.textContent = `across ${sceneSet.size} scene${sceneSet.size !== 1 ? 's' : ''}`;

    renderResults(query);
  }

  function renderResults(query) {
    if (results.length === 0) {
      resultsEl.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-dim); font-size:12px;">No results found</div>`;
      return;
    }

    const q = query.toLowerCase();
    let html = '';
    let lastScene = '';

    results.forEach((r, i) => {
      if (r.sceneId !== lastScene) {
        html += `<div style="padding:6px 12px; font-size:11px; color:var(--accent); font-weight:bold; border-bottom:1px solid var(--border);">
          🎬 ${r.sceneId}
        </div>`;
        lastScene = r.sceneId;
      }

      const selected = i === selectedIndex ? 'background:var(--bg-elevated);' : '';
      const icon = r.type === 'dialogue' ? '💬' : r.type === 'choice' ? '🔀' : '📦';
      const fieldLabel = r.field === 'text' ? '' : `[${r.field}] `;
      const highlight = highlightMatch(r.value, q);

      html += `<div class="search-result" data-index="${i}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); ${selected}">
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
          <span style="font-size:11px">${icon}</span>
          <span style="font-size:11px; font-weight:bold; color:var(--text-bright)">${r.nodeId}</span>
          <span style="font-size:10px; color:var(--text-dim)">${r.type}</span>
          ${r.speaker ? `<span style="font-size:10px; color:var(--accent)">— ${r.speaker}</span>` : ''}
        </div>
        <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${fieldLabel}${highlight}
        </div>
      </div>`;
    });

    resultsEl.innerHTML = html;

    // Bind click handlers
    resultsEl.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        jumpToResult(results[idx]);
      });
      el.addEventListener('mouseenter', () => {
        selectedIndex = parseInt(el.dataset.index);
        renderResults(query);
      });
    });
  }

  function highlightMatch(text, query) {
    if (!text) return '';
    const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return escaped.slice(0, 60) + (text.length > 60 ? '…' : '');
    const before = escaped.slice(Math.max(0, idx - 20), idx);
    const match = escaped.slice(idx, idx + query.length);
    const after = escaped.slice(idx + query.length, idx + query.length + 40);
    return `${idx > 20 ? '…' : ''}<span style="color:var(--text-dim)">${before}</span><span style="background:rgba(0,204,255,0.3);color:var(--text-bright);border-radius:2px;padding:0 2px">${match}</span><span style="color:var(--text-dim)">${after}${text.length > idx + query.length + 40 ? '…' : ''}</span>`;
  }

  function jumpToResult(result) {
    if (!result) return;

    // Switch to the scene
    editorState.activeSceneId = result.sceneId;
    if (!editorState.expandedScenes) editorState.expandedScenes = new Set();
    editorState.expandedScenes.add(result.sceneId);

    // Select the node
    editorState.selectedItemId = result.nodeId;
    editorState.selectedItemType = 'node';

    // Switch to dialogue tab if not already
    editorState.activeWorkspaceTab = 'dialogue';

    // Trigger renders
    window.dispatchEvent(new CustomEvent('editor:render'));
    window.dispatchEvent(new CustomEvent('scene:changed', { detail: result.sceneId }));

    closeSearch();
  }

  input.addEventListener('input', (e) => performSearch(e.target.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(results.length - 1, selectedIndex + 1);
      renderResults(input.value);
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      renderResults(input.value);
      scrollSelectedIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        jumpToResult(results[selectedIndex]);
      }
    }
  });

  function scrollSelectedIntoView() {
    const selected = resultsEl.querySelector('.search-result[style*="background"]');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  setTimeout(() => input.focus(), 50);
}

function closeSearch() {
  if (searchOverlay) {
    searchOverlay.remove();
    searchOverlay = null;
  }
}
