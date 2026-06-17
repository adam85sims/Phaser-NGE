// Menu Editor Module
let _container = null;
let _context = null;

function getMenuConfig() {
  const theme = _context.data.theme;
  if (!theme.ui) theme.ui = {};
  if (!theme.ui.menu) {
    theme.ui.menu = {
      background: null,
      title: { text: "Untitled Game", x: 640, y: 220, font: "monospace", size: 56, color: "#ffffff" },
      subtitle: { text: "— Phaser NGE —", x: 640, y: 280, font: "monospace", size: 18, color: "#666688" },
      buttons: [
        { id: "start", label: "▶ Start Game", x: 640, y: 420, font: "monospace", size: 22, color: "#00ccff", hoverColor: "#ffffff" },
        { id: "continue", label: "▶ Continue", x: 640, y: 480, font: "monospace", size: 18, color: "#444444", hoverColor: "#88aa88" },
        { id: "settings", label: "▶ Settings", x: 640, y: 540, font: "monospace", size: 18, color: "#888888", hoverColor: "#ffffff" }
      ]
    };
  }
  return theme.ui.menu;
}

export function init(context) {
  _context = context;
}

export function render(container, context) {
  _context = context;
  _container = container;
  
  const menuConfig = getMenuConfig();
  const vw = _context.data.game?.width || 1280;
  const vh = _context.data.game?.height || 720;

  container.innerHTML = `
    <!-- Scene Toolbar for Background -->
    <div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:6px">
      <button id="btn-menu-bg" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px">🖼️ Set Background</button>
      <button id="btn-menu-clear-bg" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:#ef4444" ${!menuConfig.background ? 'style="display:none"' : ''}>✕ Clear BG</button>
    </div>

    <!-- The Editor Canvas -->
    <div id="menu-canvas-wrapper" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-dark);overflow:auto;">
      <div id="menu-canvas" style="position:relative;width:${vw}px;height:${vh}px;background:#0a0a1a;transform-origin:center;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;">
        ${menuConfig.background ? `<img src="/assets/${menuConfig.background}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;opacity:0.6;" onerror="this.style.display='none'"/>` : ''}
        
        <!-- Elements -->
        <div class="menu-el" data-id="title" style="position:absolute;left:${menuConfig.title.x}px;top:${menuConfig.title.y}px;transform:translate(-50%, -50%);font-family:${menuConfig.title.font};font-size:${menuConfig.title.size}px;color:${menuConfig.title.color};white-space:nowrap;cursor:move;user-select:none;text-align:center;">
          ${menuConfig.title.text.replace(/</g,'&lt;')}
        </div>
        
        <div class="menu-el" data-id="subtitle" style="position:absolute;left:${menuConfig.subtitle.x}px;top:${menuConfig.subtitle.y}px;transform:translate(-50%, -50%);font-family:${menuConfig.subtitle.font};font-size:${menuConfig.subtitle.size}px;color:${menuConfig.subtitle.color};white-space:nowrap;cursor:move;user-select:none;text-align:center;">
          ${menuConfig.subtitle.text.replace(/</g,'&lt;')}
        </div>
        
        ${menuConfig.buttons.map((btn, i) => `
          <div class="menu-el" data-id="button_${i}" style="position:absolute;left:${btn.x}px;top:${btn.y}px;transform:translate(-50%, -50%);font-family:${btn.font};font-size:${btn.size}px;color:${btn.color};white-space:nowrap;cursor:move;user-select:none;text-align:center;">
            ${btn.label.replace(/</g,'&lt;')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  _bindCanvasEvents();
  _bindToolbarEvents();
  _bindCanvasDropEvents();
  
  // Default to selecting Title
  window._menuSelectedId = window._menuSelectedId || 'title';
  _updateSelectionStyle();
  _renderMenuInspector();
}

let _isDragging = false;
let _dragTarget = null;
let _dragStart = { x: 0, y: 0, elX: 0, elY: 0 };

function _bindCanvasEvents() {
  const canvas = document.getElementById('menu-canvas');
  const elements = canvas.querySelectorAll('.menu-el');

  // Scale canvas to fit
  const wrapper = document.getElementById('menu-canvas-wrapper');
  const updateScale = () => {
    if (!wrapper || !canvas) return;
    const padding = 40;
    const vw = _context?.data?.game?.width || 1280;
    const vh = _context?.data?.game?.height || 720;
    const scaleX = (wrapper.clientWidth - padding) / vw;
    const scaleY = (wrapper.clientHeight - padding) / vh;
    const scale = Math.min(1, scaleX, scaleY);
    canvas.style.transform = `scale(\${scale})`;
    canvas.dataset.scale = scale;
  };
  window.addEventListener('resize', updateScale);
  updateScale();

  elements.forEach(el => {
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      _isDragging = true;
      _dragTarget = el;
      window._menuSelectedId = el.dataset.id;
      _updateSelectionStyle();
      _renderMenuInspector();

      const scale = parseFloat(canvas.dataset.scale || 1);
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top) / scale;
      
      const config = _getElementConfig(el.dataset.id);
      _dragStart = { x: mx, y: my, elX: config.x, elY: config.y };
    });
  });

  window.addEventListener('mousemove', (e) => {
    if (!_isDragging || !_dragTarget) return;
    const scale = parseFloat(canvas.dataset.scale || 1);
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    const dx = mx - _dragStart.x;
    const dy = my - _dragStart.y;
    
    let newX = Math.round(_dragStart.elX + dx);
    let newY = Math.round(_dragStart.elY + dy);
    
    // Snap to grid
    if (!e.altKey) {
      newX = Math.round(newX / 10) * 10;
      newY = Math.round(newY / 10) * 10;
    }

    _dragTarget.style.left = `\${newX}px`;
    _dragTarget.style.top = `\${newY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (_isDragging && _dragTarget) {
      const config = _getElementConfig(_dragTarget.dataset.id);
      config.x = parseInt(_dragTarget.style.left);
      config.y = parseInt(_dragTarget.style.top);
      window.__markProjectDirty?.();
      _renderMenuInspector(); // update coordinates
    }
    _isDragging = false;
    _dragTarget = null;
  });

  canvas.addEventListener('mousedown', () => {
    window._menuSelectedId = null;
    _updateSelectionStyle();
    _renderMenuInspector();
  });
}

function _bindToolbarEvents() {
  document.getElementById('btn-menu-bg')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('editor:open-assets', { detail: { filter: 'backgrounds' } }));
    // Overriding handleAssetDrop temporarily for this mode
    window.__handleMenuAssetDrop = (assetKey) => {
      const config = getMenuConfig();
      config.background = assetKey;
      window.__markProjectDirty?.();
      render(_container, _context);
    };
  });

  document.getElementById('btn-menu-clear-bg')?.addEventListener('click', () => {
    const config = getMenuConfig();
    config.background = null;
    window.__markProjectDirty?.();
    render(_container, _context);
  });
}

function _updateSelectionStyle() {
  if (!_container) return;
  _container.querySelectorAll('.menu-el').forEach(el => {
    if (el.dataset.id === window._menuSelectedId) {
      el.style.outline = '2px dashed #00ccff';
      el.style.outlineOffset = '4px';
    } else {
      el.style.outline = 'none';
    }
  });
}

function _getElementConfig(id) {
  const config = getMenuConfig();
  if (id === 'title') return config.title;
  if (id === 'subtitle') return config.subtitle;
  if (id && id.startsWith('button_')) {
    const idx = parseInt(id.split('_')[1]);
    return config.buttons[idx];
  }
  return null;
}

function _renderMenuInspector() {
  const inspectorBody = document.querySelector('#inspector .panel-body');
  if (!inspectorBody) return;

  const config = _getElementConfig(window._menuSelectedId);
  
  if (!config) {
    inspectorBody.innerHTML = '<div class="text-dim" style="padding:16px;text-align:center">Select an element on the canvas to edit.</div>';
    return;
  }

  const isButton = window._menuSelectedId.startsWith('button_');

  inspectorBody.innerHTML = `
    <div class="inspector-section">
      <div class="section-header"><span>Transform</span></div>
      <div class="section-body">
        <div class="form-row">
          <div class="form-group"><label>X</label><input type="number" data-field="x" value="${config.x}"/></div>
          <div class="form-group"><label>Y</label><input type="number" data-field="y" value="${config.y}"/></div>
        </div>
      </div>
    </div>
    
    <div class="inspector-section">
      <div class="section-header"><span>Text Styling</span></div>
      <div class="section-body">
        <div class="form-group"><label>Text / Label</label><input data-field="${isButton ? 'label' : 'text'}" value="${(isButton ? config.label : config.text).replace(/"/g,'&quot;')}"/></div>
        
        <div class="form-row">
          <div class="form-group"><label>Size (px)</label><input type="number" data-field="size" value="${config.size}"/></div>
          <div class="form-group"><label>Font</label><input data-field="font" value="${config.font}"/></div>
        </div>

        <div class="form-group"><label>Color</label>
          <div style="display:flex;gap:4px">
            <input type="color" data-field="color" value="${config.color}" style="width:24px;padding:0;border:none"/>
            <input value="${config.color}" style="flex:1" readonly/>
          </div>
        </div>
        ${isButton ? `
        <div class="form-group"><label>Hover Color</label>
            <div style="display:flex;gap:4px">
              <input type="color" data-field="hoverColor" value="${config.hoverColor}" style="width:24px;padding:0;border:none"/>
              <input value="${config.hoverColor}" style="flex:1" readonly/>
            </div>
        </div>` : ''}
      </div>
    </div>
  `;

  // Bind inspector inputs
  inspectorBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      let val = e.target.value;
      if (e.target.type === 'number') val = parseInt(val) || 0;
      
      config[field] = val;
      window.__markProjectDirty?.();
      render(_container, _context); // Full re-render to update canvas text/style instantly
    });
  });
}

// Global hook for asset browser dragging
function _bindCanvasDropEvents() {
  const canvas = document.getElementById('menu-canvas');
  if (!canvas) return;

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvas.style.outline = '4px dashed var(--accent)';
    canvas.style.outlineOffset = '-4px';
  });

  canvas.addEventListener('dragleave', (e) => {
    e.preventDefault();
    canvas.style.outline = 'none';
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.style.outline = 'none';
    
    let dragDataStr = e.dataTransfer.getData('application/json');
    if (!dragDataStr) dragDataStr = e.dataTransfer.getData('text/plain');
    if (!dragDataStr) return;
    
    try {
      const dragData = JSON.parse(dragDataStr);
      if (dragData.type === 'image' && dragData.path) {
        if (window.__handleMenuAssetDrop) {
            window.__handleMenuAssetDrop(dragData.path);
        } else {
            const config = getMenuConfig();
            config.background = dragData.path;
            window.__markProjectDirty?.();
            render(_container, _context);
        }
      }
    } catch (err) {
      console.warn('Failed to parse dropped asset data:', err);
    }
  });
}
