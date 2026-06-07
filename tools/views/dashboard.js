/**
 * Dashboard — Project overview with stats, recent scenes, and tool cards.
 */
export function init(app) {}

export function render(container, app) {
  const s = app.stats;
  const g = app.data.game;

  const isEmpty = s.sceneCount === 0 && s.charCount <= 1;

  container.innerHTML = `
    <div class="view-header">
      <h1>${g?.title || 'Untitled'}</h1>
      <p>
        ${s.sceneCount} scene${s.sceneCount !== 1 ? 's' : ''} ·
        ${s.nodeCount} node${s.nodeCount !== 1 ? 's' : ''} ·
        ~${s.wordCount} word${s.wordCount !== 1 ? 's' : ''} ·
        ${s.choiceCount} choice${s.choiceCount !== 1 ? 's' : ''} ·
        ${s.charCount} character${s.charCount !== 1 ? 's' : ''}
      </p>
    </div>

    ${isEmpty ? `
      <div class="hint-box" style="margin-bottom:20px">
        <strong>✦ Welcome to your new project!</strong>
        <p style="margin-top:6px">
          Your project <strong>"${g?.title || 'Untitled'}"</strong> is ready. Start building:
        </p>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="window.__navigate('scenes')">
            + Create Your First Scene
          </button>
          <button class="btn" onclick="window.__navigate('characters')">
            👤 Define Characters
          </button>
          <button class="btn" onclick="window.__navigate('settings')">
            ⚙ Settings & Defaults
          </button>
        </div>
      </div>
    ` : ''}

    <div class="card-grid">
      <a class="card" href="#scenes">
        <div class="icon">✍</div>
        <div class="card-title">Scenes</div>
        <div class="card-desc">Browse, create, and manage your story scenes</div>
        <span class="card-stat">${s.sceneCount} scenes</span>
      </a>

      <a class="card" href="#dialogue">
        <div class="icon">◇</div>
        <div class="card-title">Dialogue Editor</div>
        <div class="card-desc">Build branching dialogue trees with a visual node graph</div>
        <span class="card-stat">${s.nodeCount} nodes</span>
      </a>

      <a class="card" href="#characters">
        <div class="icon">👤</div>
        <div class="card-title">Characters</div>
        <div class="card-desc">Define characters, expressions, and assign portraits</div>
        <span class="card-stat">${s.charCount} characters</span>
      </a>

      <a class="card" href="#variables">
        <div class="icon">📊</div>
        <div class="card-title">Variables</div>
        <div class="card-desc">Track flags, counters, and story state</div>
        <span class="card-stat">${s.varCount} variables</span>
      </a>

      <a class="card" href="#assets">
        <div class="icon">🖼</div>
        <div class="card-title">Assets</div>
        <div class="card-desc">Browse and manage images, audio, and fonts</div>
        <span class="card-stat">${s.sceneCount} scenes use them</span>
      </a>

      <a class="card" href="#layouts">
        <div class="icon">🎬</div>
        <div class="card-title">Layouts</div>
        <div class="card-desc">Compose scenes with backgrounds and character positions</div>
        <span class="card-stat">Configure</span>
      </a>

      <a class="card" href="#settings">
        <div class="icon">⚙</div>
        <div class="card-title">Settings</div>
        <div class="card-desc">Project name, defaults, text speed, volume</div>
        <span class="card-stat">Configure</span>
      </a>
    </div>

    <h3>Recent Scenes</h3>
    ${s.recentScenes.length === 0
      ? '<div class="text-dim" style="padding:12px 0">No scenes yet. Create one in the Scenes tab.</div>'
      : `<div class="recent-list">
          ${s.recentScenes.map(sc => `
            <div class="recent-item" onclick="window.__navigate('scenes')">
              <span class="name">${sc.id}</span>
              <span class="meta">${sc.nodes} nodes · ${sc.words} words · ${sc.choices} choices</span>
            </div>
          `).join('')}
        </div>`
    }

    ${!isEmpty ? `
    <div class="hint-box mt-16">
      <strong>💡 Tip:</strong>
      Use the sidebar to navigate between tools.
      The <strong>Dialogue Editor</strong> lets you build branching dialogue visually.
    </div>` : ''}
  `;
}
