/**
 * Layouts — Visual scene composer.
 * Canvas mockup of the game screen. Drag characters,
 * set backgrounds, configure text box position and style.
 */
let _app = null;
let _state = {
  config: {
    textBox: { x: 40, y: 410, width: 720, height: 150, padding: 16, opacity: 0.92, rounded: true },
    nameplate: { position: 'above', fontSize: 14, attached: true },
    characterPositions: { left: 160, 'center-left': 280, center: 400, 'center-right': 520, right: 640 },
    choiceStyle: { alignment: 'left', numbered: true, accentColor: '#00ccff' },
    backgroundFit: 'cover',
    bgColor: '#0a0a1a'
  },
  previewChar: null,
  selectedChar: null,
  dragging: null
};

export function init(app) { _app = app; }

export function render(container, app) {
  _app = app;
  const ch = _state.config;

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1>Layouts</h1>
        <p>Compose your scene layout — text box, character positions, backgrounds</p>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm" onclick="window.__layoutReset()">↺ Reset</button>
        <button class="btn btn-primary btn-sm" onclick="window.__layoutExport()">⬇ Export Layout</button>
      </div>
    </div>

    <div style="display:flex;gap:16px">
      <div style="flex:1;max-width:560px">
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden">
          <div style="background:var(--panel);padding:6px 10px;font-size:11px;color:var(--text-dim);display:flex;justify-content:space-between">
            <span>800 × 600 Preview</span>
            <span id="layout-coords"></span>
          </div>
          <canvas id="layout-canvas" width="800" height="600" style="width:100%;height:auto;display:block;cursor:crosshair"></canvas>
        </div>

        <div class="hint-box mt-8" style="font-size:11px">
          <strong>Click</strong> a character portrait slot to assign a character.
          <strong>Drag</strong> the text box handle to reposition.
          Layout preview does not reflect final game rendering exactly.
        </div>
      </div>

      <div style="width:260px;flex-shrink:0">
        <div class="form-group">
          <label>Background Color</label>
          <div style="display:flex;gap:6px">
            <input type="color" value="${ch.bgColor}" onchange="window.__layoutSet('bgColor',this.value);_layoutRender()" style="width:36px;height:28px;padding:1px;background:var(--bg);border:1px solid var(--border);border-radius:3px" />
            <input type="text" value="${ch.bgColor}" onchange="window.__layoutSet('bgColor',this.value);_layoutRender()" style="flex:1;font-family:monospace;font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px 6px" />
          </div>
        </div>

        <h3 style="font-size:12px;margin-bottom:6px">Text Box</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Y Position</label>
            <input type="number" value="${ch.textBox.y}" onchange="window.__layoutTextBox('y',+this.value)" style="font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px 6px;width:100%" />
          </div>
          <div class="form-group">
            <label>Height</label>
            <input type="number" value="${ch.textBox.height}" onchange="window.__layoutTextBox('height',+this.value)" style="font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px 6px;width:100%" />
          </div>
        </div>
        <div class="form-group">
          <label>Opacity</label>
          <input type="range" min="0.3" max="1" step="0.05" value="${ch.textBox.opacity}" oninput="window.__layoutTextBox('opacity',+this.value);_layoutRender()" style="width:100%" />
        </div>

        <div class="form-group">
          <label>Style Preset</label>
          <select onchange="window.__layoutPreset(this.value)" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:4px 6px;font-size:12px">
            <option value="classic">Classic (bottom-center)</option>
            <option value="minimal">Minimal (small, bottom-right)</option>
            <option value="cinematic">Cinematic (full-width overlay)</option>
            <option value="custom">Custom (current)</option>
          </select>
        </div>

        <h3 style="font-size:12px;margin-bottom:6px;margin-top:10px">Character Positions</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
          ${Object.entries(ch.characterPositions).map(([pos, val]) => `
            <div style="display:flex;align-items:center;gap:4px;padding:2px 0">
              <span style="width:80px;color:var(--text-dim)">${pos}</span>
              <span class="mono">${val}px</span>
            </div>
          `).join('')}
        </div>
        <p class="text-dim mt-8" style="font-size:10px">Character positions are managed in the Character Manager.</p>

        <h3 style="font-size:12px;margin-bottom:6px;margin-top:10px">Choice Style</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Alignment</label>
            <select onchange="window.__layoutSetChoice('alignment',this.value)" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px 6px;font-size:11px">
              <option value="left" ${ch.choiceStyle.alignment==='left'?'selected':''}>Left</option>
              <option value="center" ${ch.choiceStyle.alignment==='center'?'selected':''}>Center</option>
            </select>
          </div>
          <div class="form-group">
            <label>Numbered</label>
            <select onchange="window.__layoutSetChoice('numbered',this.value==='true')" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px 6px;font-size:11px">
              <option value="true" ${ch.choiceStyle.numbered?'selected':''}>Yes</option>
              <option value="false" ${!ch.choiceStyle.numbered?'selected':''}>No</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div id="layout-status" class="text-dim mt-8" style="font-size:11px"></div>
  `;

  _initCanvas();
}

/* ─── CANVAS RENDER ────────────────────────────── */

function _initCanvas() {
  const cvs = document.getElementById('layout-canvas');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');

  // Mouse interaction
  cvs.onmousedown = (e) => {
    const rect = cvs.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;

    // Check if clicking a character position button
    const ch = _state.config;
    const btnSize = 36;
    const positions = Object.entries(ch.characterPositions);
    for (const [pos, px] of positions) {
      const by = 180;
      if (mx > px - btnSize / 2 && mx < px + btnSize / 2 && my > by - btnSize / 2 && my < by + btnSize / 2) {
        _state.selectedChar = pos;
        _selectCharacterForPosition(pos);
        _layoutRender();
        return;
      }
    }

    // Check if clicking text box (drag y)
    if (mx > ch.textBox.x && mx < ch.textBox.x + ch.textBox.width &&
        my > ch.textBox.y && my < ch.textBox.y + ch.textBox.height) {
      _state.dragging = 'textbox';
    }
  };

  cvs.onmousemove = (e) => {
    if (!_state.dragging) return;
    const rect = cvs.getBoundingClientRect();
    const scaleX = 800 / rect.width;
    const my = (e.clientY - rect.top) * scaleX;
    if (_state.dragging === 'textbox') {
      const ch = _state.config.textBox;
      ch.y = Math.max(200, Math.min(550, my));
      window.__markProjectDirty?.();
      _layoutRender();
      const el = document.getElementById('layout-coords');
      if (el) el.textContent = `TextBox y: ${ch.y}`;
    }
  };

  cvs.onmouseup = () => { _state.dragging = null; };
  cvs.onmouseleave = () => { _state.dragging = null; };

  window._layoutRender = () => {
    const ch = _state.config;
    const ctx2 = cvs.getContext('2d');
    const W = 800, H = 600;

    // Background
    ctx2.fillStyle = ch.bgColor;
    ctx2.fillRect(0, 0, W, H);

    // Stars (simplified)
    ctx2.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 60; i++) {
      ctx2.beginPath();
      ctx2.arc(Math.random() * W, Math.random() * H, 0.5 + Math.random(), 0, Math.PI * 2);
      ctx2.fill();
    }

    // Character position circles
    const positions = Object.entries(ch.characterPositions);
    positions.forEach(([pos, px]) => {
      const py = 200;
      const isSelected = _state.selectedChar === pos;
      ctx2.beginPath();
      ctx2.arc(px, py, 30, 0, Math.PI * 2);
      ctx2.fillStyle = isSelected ? 'rgba(0,204,255,0.2)' : 'rgba(255,255,255,0.05)';
      ctx2.fill();
      ctx2.strokeStyle = isSelected ? '#00ccff' : 'rgba(255,255,255,0.15)';
      ctx2.lineWidth = isSelected ? 2 : 1;
      ctx2.stroke();

      // Label
      ctx2.fillStyle = isSelected ? '#00ccff' : 'rgba(255,255,255,0.3)';
      ctx2.font = '9px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(pos, px, py + 45);

      // Character initial or ?
      const charId = _state[`_posChar_${pos}`] || '?';
      ctx2.fillStyle = '#c8c8d0';
      ctx2.font = '14px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillText(charId[0].toUpperCase(), px, py);
      ctx2.textBaseline = 'alphabetic';
    });

    // Text Box
    const tb = ch.textBox;
    ctx2.fillStyle = `rgba(10,10,26,${tb.opacity})`;
    if (tb.rounded) {
      _roundRect(ctx2, tb.x, tb.y, tb.width, tb.height, 8);
      ctx2.fill();
      ctx2.strokeStyle = 'rgba(51,85,136,0.6)';
      ctx2.lineWidth = 1.5;
      ctx2.stroke();
    } else {
      ctx2.fillRect(tb.x, tb.y, tb.width, tb.height);
    }

    // Nameplate position indicator
    if (ch.nameplate.attached) {
      ctx2.fillStyle = '#222244';
      _roundRect(ctx2, tb.x + 8, tb.y - 24, 100, 20, 4);
      ctx2.fill();
      ctx2.fillStyle = '#00ccff';
      ctx2.font = '11px sans-serif';
      ctx2.textAlign = 'left';
      ctx2.fillText('Speaker', tb.x + 14, tb.y - 10);
    }

    // Sample text
    ctx2.fillStyle = 'rgba(200,200,208,0.5)';
    ctx2.font = '14px Courier New, monospace';
    ctx2.textAlign = 'left';
    ctx2.fillText('Sample dialogue text appears here...', tb.x + 14, tb.y + 30);
    ctx2.fillText('with a blinking cursor ▎', tb.x + 14, tb.y + 52);

    // Choice preview
    ctx2.fillStyle = 'rgba(0,204,255,0.3)';
    ctx2.font = '13px Courier New, monospace';
    ctx2.fillText('▸ [1] Choice option one', tb.x + 14, tb.y + 90);
    ctx2.fillText('▸ [2] Choice option two', tb.x + 14, tb.y + 110);

    // Dimensions label
    ctx2.fillStyle = 'rgba(255,255,255,0.1)';
    ctx2.font = '9px monospace';
    ctx2.textAlign = 'right';
    ctx2.fillText('800×600', 790, 590);
  };

  _layoutRender();
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ─── HELPERS ──────────────────────────────────── */

function _selectCharacterForPosition(pos) {
  const chars = Object.keys(_app.data.characters || {});
  if (chars.length === 0) return;
  const current = _state[`_posChar_${pos}`];
  const idx = current ? chars.indexOf(current) : -1;
  const next = chars[(idx + 1) % chars.length];
  _state[`_posChar_${pos}`] = next;
}

window.__layoutSet = (field, value) => {
  _state.config[field] = value;
  window.__markProjectDirty?.();
};

window.__layoutTextBox = (field, value) => {
  _state.config.textBox[field] = value;
  _state.dragging = null;
  window.__markProjectDirty?.();
  if (document.getElementById('layout-canvas')) _layoutRender();
};

window.__layoutSetChoice = (field, value) => {
  _state.config.choiceStyle[field] = value;
  window.__markProjectDirty?.();
  if (document.getElementById('layout-canvas')) _layoutRender();
};

window.__layoutPreset = (preset) => {
  const ch = _state.config;
  switch (preset) {
    case 'classic':
      ch.textBox = { x: 40, y: 410, width: 720, height: 150, padding: 16, opacity: 0.92, rounded: true };
      ch.nameplate = { position: 'above', fontSize: 14, attached: true };
      ch.backgroundFit = 'cover';
      break;
    case 'minimal':
      ch.textBox = { x: 440, y: 460, width: 330, height: 110, padding: 12, opacity: 0.85, rounded: true };
      ch.nameplate = { position: 'above', fontSize: 12, attached: true };
      ch.backgroundFit = 'cover';
      break;
    case 'cinematic':
      ch.textBox = { x: 40, y: 440, width: 720, height: 130, padding: 20, opacity: 0.95, rounded: false };
      ch.nameplate = { position: 'above', fontSize: 16, attached: true };
      ch.backgroundFit = 'cover';
      break;
  }
  window.__markProjectDirty?.();
  if (document.getElementById('layout-canvas')) _layoutRender();
};

window.__layoutReset = () => {
  _state.config = {
    textBox: { x: 40, y: 410, width: 720, height: 150, padding: 16, opacity: 0.92, rounded: true },
    nameplate: { position: 'above', fontSize: 14, attached: true },
    characterPositions: { left: 160, 'center-left': 280, center: 400, 'center-right': 520, right: 640 },
    choiceStyle: { alignment: 'left', numbered: true, accentColor: '#00ccff' },
    backgroundFit: 'cover',
    bgColor: '#0a0a1a'
  };
  window.__markProjectDirty?.();
  if (document.getElementById('layout-canvas')) _layoutRender();
};

window.__layoutExport = () => {
  const data = JSON.parse(JSON.stringify(_state.config));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'layout-config.json';
  a.click(); URL.revokeObjectURL(url);
  window.__markProjectDirty?.();
  const el = document.getElementById('layout-status');
  if (el) el.textContent = '✓ Exported layout-config.json';
};
