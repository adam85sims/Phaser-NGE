/**
 * workspace.js — Right workspace tabs: dialogue graph, files, assets, scenes, characters, variables.
 */
import { editorState, markDirty } from './state.js';

export function renderWorkspace() {
  // Update active tab visuals
  document.querySelectorAll('.workspace-tab').forEach(tab => {
    tab.classList.toggle('active', tab.textContent.toLowerCase().includes(editorState.activeWorkspaceTab));
  });

  const body = document.querySelector('.workspace-body');
  if (!body) return;

  if (editorState.activeWorkspaceTab === 'dialogue') {
    body.innerHTML = `
      <div id="graph-container" style="position:relative; width:100%; height:100%; overflow:hidden;">
        <div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:6px">
          <button id="btn-graph-add-node" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px">+ Node</button>
          <button id="btn-graph-del-node" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:#ef4444">Delete</button>
        </div>
        <button id="btn-graph-fullscreen" class="btn" style="position:absolute; top:8px; right:8px; z-index:10; background:var(--bg-elevated); border:1px solid var(--border);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          Fullscreen
        </button>
        <canvas id="graph-canvas"></canvas>
      </div>
    `;
    import('./graph.js').then(module => {
      module.mountGraph(document.getElementById('graph-container'));

      const addBtn = document.getElementById('btn-graph-add-node');
      const delBtn = document.getElementById('btn-graph-del-node');
      if (addBtn) addBtn.addEventListener('click', () => module.createNode('dialogue'));
      if (delBtn) delBtn.addEventListener('click', () => module.deleteSelectedNode());
    });

    const fullscreenBtn = document.getElementById('btn-graph-fullscreen');
    const graphContainer = document.getElementById('graph-container');
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        graphContainer.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    });
  } else {
    const viewMap = {
      'files': () => import('./views/files.js'),
      'assets': () => import('./views/assets.js'),
      'scenes': () => import('./views/scenes.js'),
      'characters': () => import('./views/characters.js'),
      'variables': () => import('./views/variables.js')
    };

    const viewLoader = viewMap[editorState.activeWorkspaceTab];
    if (viewLoader) {
      viewLoader().then(module => {
        const recentScenes = Object.keys(editorState.scenes).map(id => {
          const scene = editorState.scenes[id];
          const nodes = scene?.nodes || [];
          return {
            id,
            nodes: nodes.length,
            words: countWords(nodes),
            choices: countChoices(nodes)
          };
        });

        const appContext = {
          data: {
            game: editorState.gameConfig,
            scenes: editorState.scenes,
            characters: editorState.characters,
            variables: editorState.variableDefs
          },
          stats: {
            sceneCount: editorState.stats.sceneCount,
            nodeCount: editorState.stats.nodeCount,
            charCount: Object.keys(editorState.characters).length,
            varCount: Object.keys(editorState.variableDefs).length,
            recentScenes
          }
        };

        if (module.init) module.init(appContext);
        module.render(body, appContext);

        window.__navigate = (tab) => {
          editorState.activeWorkspaceTab = tab;
          renderWorkspace();
        };
        window.__markProjectDirty = markDirty;
      });
    } else {
      body.innerHTML = `<div style="padding:20px; color:var(--text-muted)">${editorState.activeWorkspaceTab} module coming soon...</div>`;
    }
  }
}

export function countWords(nodes) {
  let c = 0;
  for (const n of nodes || []) {
    if (n.text) c += n.text.split(/\s+/).filter(Boolean).length;
    if (n.choices) for (const ch of n.choices) if (ch.text) c += ch.text.split(/\s+/).filter(Boolean).length;
  }
  return c;
}

export function countChoices(nodes) {
  return (nodes || []).reduce((s, n) => s + (n.choices?.length || 0), 0);
}
