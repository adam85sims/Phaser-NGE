// Splash Screen Editor Module
let _container = null;
let _context = null;

function getSplashConfig() {
  const theme = _context.data.theme;
  if (!theme.ui) theme.ui = {};
  if (!theme.ui.splash) {
    theme.ui.splash = {
      enabled: false,
      background: "#0a0a1a",
      logo: null,
      logoScale: 1.0,
      fadeIn: 1000,
      hold: 2000,
      fadeOut: 1000,
      skipOnClick: true
    };
  }
  return theme.ui.splash;
}

export function init(context) {
  _context = context;
}

export function render(container, context) {
  _context = context;
  _container = container;
  
  const config = getSplashConfig();
  const vw = _context.data.game?.width || 1280;
  const vh = _context.data.game?.height || 720;

  container.innerHTML = `
    <!-- Top toolbar -->
    <div style="position:absolute;top:8px;left:8px;z-index:10;display:flex;gap:6px;align-items:center;">
      <label style="color:var(--text);font-size:13px;display:flex;align-items:center;gap:6px;background:var(--bg-elevated);padding:4px 10px;border-radius:4px;border:1px solid var(--border);">
        <input type="checkbox" id="splash-enabled-cb" ${config.enabled ? 'checked' : ''}/>
        Enable Splash Screen
      </label>
      <button id="btn-splash-logo" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px">🖼️ Set Logo Asset</button>
      <button id="btn-splash-clear" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:#ef4444" ${!config.logo ? 'style="display:none"' : ''}>✕ Clear Logo</button>
      <button id="btn-splash-play" class="btn" style="background:var(--bg-elevated);border:1px solid var(--border);padding:4px 10px;font-size:11px;cursor:pointer;border-radius:4px;color:#00ccff">▶ Preview Animation</button>
    </div>

    <!-- The Editor Canvas -->
    <div id="splash-canvas-wrapper" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-dark);overflow:auto;opacity:${config.enabled ? '1' : '0.5'};pointer-events:${config.enabled ? 'auto' : 'none'};">
      <div id="splash-canvas" style="position:relative;width:${vw}px;height:${vh}px;background:${config.background};transform-origin:center;box-shadow:0 10px 30px rgba(0,0,0,0.5);overflow:hidden;display:flex;align-items:center;justify-content:center;">
        ${config.logo ? `<img id="splash-logo-img" src="/assets/backgrounds/${config.logo}.png" style="transform:scale(${config.logoScale});max-width:100%;max-height:100%;object-fit:contain;" onerror="this.src='/assets/characters/${config.logo}.png'; this.onerror=null;"/>` : '<span style="color:#ffffff44;font-family:monospace;">(No Logo Selected)</span>'}
      </div>
    </div>
  `;

  _bindCanvasEvents();
  _bindToolbarEvents();
  _renderSplashInspector();
}

function _bindCanvasEvents() {
  const canvas = document.getElementById('splash-canvas');
  const wrapper = document.getElementById('splash-canvas-wrapper');
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
}

function _bindToolbarEvents() {
  document.getElementById('splash-enabled-cb')?.addEventListener('change', (e) => {
    getSplashConfig().enabled = e.target.checked;
    window.__markProjectDirty?.();
    render(_container, _context);
  });

  document.getElementById('btn-splash-logo')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('editor:open-assets', { detail: { filter: 'backgrounds' } }));
    window.__handleMenuAssetDrop = (assetKey) => {
      getSplashConfig().logo = assetKey;
      window.__markProjectDirty?.();
      render(_container, _context);
    };
  });

  document.getElementById('btn-splash-clear')?.addEventListener('click', () => {
    getSplashConfig().logo = null;
    window.__markProjectDirty?.();
    render(_container, _context);
  });

  document.getElementById('btn-splash-play')?.addEventListener('click', () => {
    const img = document.getElementById('splash-logo-img');
    if (!img) return;
    const config = getSplashConfig();
    
    img.style.transition = 'none';
    img.style.opacity = '0';
    
    setTimeout(() => {
      img.style.transition = `opacity \${config.fadeIn}ms linear`;
      img.style.opacity = '1';
      
      setTimeout(() => {
        img.style.transition = `opacity \${config.fadeOut}ms linear`;
        img.style.opacity = '0';
        
        setTimeout(() => {
          img.style.transition = 'none';
          img.style.opacity = '1';
        }, config.fadeOut + 100);
      }, config.fadeIn + config.hold);
    }, 50);
  });
}

function _renderSplashInspector() {
  const inspectorBody = document.querySelector('#inspector .panel-body');
  if (!inspectorBody) return;

  const config = getSplashConfig();

  inspectorBody.innerHTML = `
    <div class="inspector-section">
      <div class="section-header"><span>Visuals</span></div>
      <div class="section-body">
        <div class="form-row">
          <div class="form-group"><label>Background Color</label>
            <div style="display:flex;gap:4px">
              <input type="color" data-field="background" value="${config.background}" style="width:24px;padding:0;border:none"/>
              <input value="${config.background}" style="flex:1" readonly/>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Logo Scale</label>
            <input type="number" step="0.1" data-field="logoScale" value="${config.logoScale}"/>
          </div>
        </div>
      </div>
    </div>
    
    <div class="inspector-section">
      <div class="section-header"><span>Animation Timings (ms)</span></div>
      <div class="section-body">
        <div class="form-group"><label>Fade In</label><input type="number" data-field="fadeIn" value="${config.fadeIn}"/></div>
        <div class="form-group"><label>Hold Duration</label><input type="number" data-field="hold" value="${config.hold}"/></div>
        <div class="form-group"><label>Fade Out</label><input type="number" data-field="fadeOut" value="${config.fadeOut}"/></div>
      </div>
    </div>

    <div class="inspector-section">
      <div class="section-header"><span>Settings</span></div>
      <div class="section-body">
        <div class="form-group"><label style="margin-top:8px"><input type="checkbox" data-field="skipOnClick" ${config.skipOnClick?'checked':''}/> Skip on Click</label></div>
      </div>
    </div>
  `;

  // Bind inspector inputs
  inspectorBody.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      if (input.type === 'checkbox') {
        config[field] = input.checked;
      } else if (input.type === 'number') {
        config[field] = parseFloat(input.value) || 0;
      } else {
        config[field] = input.value;
      }
      window.__markProjectDirty?.();
      render(_container, _context);
    });
  });
}
