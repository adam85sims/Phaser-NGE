import { Registry } from '../../src/systems/Registry.js';

// --- DIALOGUE ---
Registry.extendNodeType('dialogue', {
  label: 'Dialogue',
  color: '#3b82f6',
  defaultData: () => ({ speaker: '', text: 'New dialogue', next: '' }),
  renderEditor: (node, ctx) => {
    const speakerOpts = Object.keys(ctx.characters || {}).map(k =>
      `<option value="${k}"${node.speaker===k?' selected':''}>${ctx.characters[k]?.name||k}</option>`
    ).join('');
    const nodeOpts = ctx.otherNodes.map(n =>
      `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`
    ).join('');

    // Position options
    const positions = ['left', 'center', 'right'];
    const posOpts = positions.map(p =>
      `<option value="${p}"${node.position===p?' selected':''}>${p}</option>`
    ).join('');

    // Language selector for localized text
    const langs = ctx.gameConfig?.localization?.availableLanguages || ['en'];
    const langNames = ctx.gameConfig?.localization?.languageNames || {};
    const hasLocalization = langs.length > 1;

    // Font options from theme
    const fonts = ctx.theme?.fonts || {};
    const fontOpts = Object.keys(fonts).map(f => `<option value="${f}">${f}</option>`).join('');

    return `
      <div class="form-group"><label>Text</label><textarea data-field="text" style="min-height:60px">${(node.text||'').replace(/</g,'&lt;')}</textarea>
        <button class="add-btn" id="tag-ref-btn" style="margin-top:4px;font-size:10px;padding:2px 6px">📋 Tag Reference</button>
        <div id="tag-ref-panel" style="display:none;margin-top:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;padding:8px;font-size:10px;line-height:1.6">
          <b>Formatting:</b> [b]bold[/b] [i]italic[/i] [color=#ff0000]red[/color]<br/>
          <b>Size:</b> [size=24]big[/size] [size=+4]relative+[/size] [size=-2]relative-[/size]<br/>
          <b>Font:</b> [font=serif]serif text[/font]<br/>
          <b>Effects:</b> [wave]wavy[/wave] [shake]shaking[/shake]<br/>
          <b>Typewriter:</b> [speed=80]slow[/speed] [delay=500]pause[/delay]<br/>
          <b>Special:</b> [playername] [show:layer] [hide:layer] [anim:target:key]<br/>
          <b>Conditional:</b> {if var == val}text{/if} {if cond}A{else}B{/if}
        </div>
      </div>
      ${hasLocalization ? `<div class="form-group"><label>Language</label><select data-field="textLang" id="text-lang-select">
        ${langs.map(l => `<option value="${l}"${(node._textLang||'en')===l?' selected':''}>${langNames[l]||l}</option>`).join('')}
      </select></div>` : ''}
      <div class="form-group"><label>Speaker</label><select data-field="speaker" id="speaker-select">
        <option value="">(narration)</option>${speakerOpts}</select></div>
      <div class="form-group"><label>Expression</label><select data-field="expression" id="expression-select">
        <option value="">— none —</option></select></div>
      ${fontOpts ? `<div class="form-group"><label>Font Override</label><select data-field="fontOverride" id="font-override-select">
        <option value="">— theme default —</option>${fontOpts}</select></div>` : ''}
      <div class="form-group"><label>Position</label><select data-field="position">
        <option value="">— default —</option>${posOpts}</select></div>
      <div class="form-group">
        <label>Background</label>
        <select data-field="background" id="background-select">
          <option value="">— none —</option>
        </select>
        <div id="background-thumb" style="margin-top:6px;min-height:60px;background:#0a0a1a;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${node.background ? `<img src="/assets/backgrounds/${node.background}.png" style="max-width:100%;max-height:80px" />` : '<span style="color:#666;font-size:10px">No background</span>'}
        </div>
      </div>
      <div class="form-group"><label>Z-Index</label><input type="number" value="${node.zIndex??0}" data-field="zIndex" data-type="number"/></div>
      <div class="form-group"><label>Voice (Audio Key)</label><select data-field="voice" id="voice-select"><option value="">— none —</option></select></div>
      <div class="form-group"><label>Blip Sound</label><select data-field="blipSound" id="blip-sound-select"><option value="">— none —</option></select></div>
      <div class="form-row"><div class="form-group"><label>Auto</label><select data-field="autoAdvance">
        <option value="false">No</option><option value="true"${node.autoAdvance?' selected':''}>Yes</option></select></div>
      <div class="form-group"><label>Wait ms</label><input type="number" value="${node.waitTime||2000}" data-field="waitTime" data-type="number"/></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  bindEditor: (node, container, ctx, helpers) => {
    // Tag reference toggle
    const tagRefBtn = container.querySelector('#tag-ref-btn');
    const tagRefPanel = container.querySelector('#tag-ref-panel');
    if (tagRefBtn && tagRefPanel) {
      tagRefBtn.addEventListener('click', () => {
        tagRefPanel.style.display = tagRefPanel.style.display === 'none' ? 'block' : 'none';
      });
    }

    const bgSelect = container.querySelector('#background-select');
    const bgThumb = container.querySelector('#background-thumb');
    const exprSelect = container.querySelector('#expression-select');
    const speakerSelect = container.querySelector('#speaker-select');
    const voiceSelect = container.querySelector('#voice-select');

    // Fetch assets and populate background dropdown
    if (bgSelect && ctx.backend) {
      ctx.backend.listAssets().then(assets => {
        // assets is a flat array of { name, path, type, ... }
        const bgAssets = (Array.isArray(assets) ? assets : [])
          .filter(f => f.path && f.path.startsWith('backgrounds/'))
          .map(f => f.name.replace(/\.[^.]+$/, ''));
        bgSelect.innerHTML = '<option value="">— none —</option>' +
          bgAssets.map(k => `<option value="${k}"${k === node.background ? ' selected' : ''}>${k}</option>`).join('');

        // Update thumbnail on change
        bgSelect.addEventListener('change', () => {
          helpers.captureUndoState();
          node.background = bgSelect.value;
          if (bgThumb) {
            if (bgSelect.value) {
              bgThumb.innerHTML = `<img src="/assets/backgrounds/${bgSelect.value}.png" style="max-width:100%;max-height:80px" />`;
            } else {
              bgThumb.innerHTML = '<span style="color:#666;font-size:10px">No background</span>';
            }
          }
          helpers.markDirty();
        });
      }).catch(() => {
        // Fallback to text input
        if (bgSelect.parentElement) {
          const fallback = document.createElement('input');
          fallback.value = node.background || '';
          fallback.dataset.field = 'background';
          fallback.placeholder = 'Enter background key…';
          fallback.addEventListener('change', () => {
            helpers.captureUndoState();
            node.background = fallback.value;
            helpers.markDirty();
          });
          bgSelect.replaceWith(fallback);
        }
      });
    }

    if (voiceSelect && ctx.backend) {
      ctx.backend.listAssets().then(assets => {
        const voiceAssets = (Array.isArray(assets) ? assets : [])
          .filter(f => f.path && f.path.startsWith('audio/voice/'))
          .map(f => f.name.replace(/\.[^.]+$/, ''));
        voiceSelect.innerHTML = '<option value="">— none —</option>' +
          voiceAssets.map(k => `<option value="${k}"${k === node.voice ? ' selected' : ''}>${k}</option>`).join('');

        voiceSelect.addEventListener('change', () => {
          helpers.captureUndoState();
          node.voice = voiceSelect.value;
          helpers.markDirty();
        });
      });
    }

    // Blip sound dropdown
    const blipSelect = container.querySelector('#blip-sound-select');
    if (blipSelect && ctx.backend) {
      ctx.backend.listAssets().then(assets => {
        const sfxAssets = (Array.isArray(assets) ? assets : [])
          .filter(f => f.path && f.path.startsWith('audio/sfx/'))
          .map(f => f.name.replace(/\.[^.]+$/, ''));
        blipSelect.innerHTML = '<option value="">— none —</option>' +
          sfxAssets.map(k => `<option value="${k}"${k === node.blipSound ? ' selected' : ''}>${k}</option>`).join('');

        blipSelect.addEventListener('change', () => {
          helpers.captureUndoState();
          node.blipSound = blipSelect.value;
          helpers.markDirty();
        });
      });
    }

    // Build character → expressions map from portraits
    const charExpressions = {};
    if (ctx.characters) {
      for (const [charId, charData] of Object.entries(ctx.characters)) {
        if (charData.portraits) {
          charExpressions[charId] = Object.keys(charData.portraits);
        }
      }
    }

    // Populate expression dropdown based on current speaker
    const populateExpressions = (speaker) => {
      const expressions = charExpressions[speaker] || [];
      if (expressions.length === 0) {
        exprSelect.innerHTML = '<option value="">— none —</option>';
      } else {
        exprSelect.innerHTML = '<option value="">— none —</option>' +
          expressions.map(e => `<option value="${e}"${e === node.expression ? ' selected' : ''}>${e}</option>`).join('');
      }
    };

    // Initial population
    populateExpressions(node.speaker);

    // Re-populate when speaker changes
    if (speakerSelect) {
      speakerSelect.addEventListener('change', () => {
        helpers.captureUndoState();
        node.speaker = speakerSelect.value;
        populateExpressions(node.speaker);
        // Clear expression if it's no longer valid
        const validExprs = charExpressions[node.speaker] || [];
        if (node.expression && !validExprs.includes(node.expression)) {
          node.expression = '';
          exprSelect.value = '';
        }
        helpers.markDirty();
      });
    }

    // Expression change
    if (exprSelect) {
      exprSelect.addEventListener('change', () => {
        helpers.captureUndoState();
        node.expression = exprSelect.value;
        helpers.markDirty();
      });
    }
  },
  executeRuntime: (node, controller) => {
    controller.showDialogue(node);
  }
});

// --- CHOICE ---
Registry.extendNodeType('choice', {
  label: 'Choice',
  color: '#f59e0b',
  defaultData: () => ({ prompt: '', choices: [{ text: 'Choice 1', next: '' }], next: '' }),
  getHeight: (node) => Math.max(64, 36 + (node.choices || []).length * 20),
  getOutputs: (node, sx, sy, sw, zoom) => {
    return (node.choices || []).map((c, i) => ({ x: sx + sw, y: sy + 14 + i * 20 * zoom }));
  },
  getConnections: (node) => {
    const conns = [];
    (node.choices || []).forEach((c, i) => { if (c.next) conns.push({ port: i, to: c.next }); });
    return conns;
  },
  renderEditor: (node, ctx) => `
    <div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/</g,'&lt;')}" data-field="prompt"/></div>
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
      <label>Choices (${(node.choices||[]).length})</label>
      <div id="choice-list"></div>
      <button class="add-btn" id="add-choice-btn">+ Add Choice</button>
    </div>
  `,
  bindEditor: (node, container, ctx, helpers) => {
    const choiceList = container.querySelector('#choice-list');
    const renderChoices = () => {
      if (!node.choices) node.choices = [];
      let chtml = '';
      node.choices.forEach((c, i) => {
        chtml += `<div style="background:var(--bg-elevated);border-radius:4px;padding:6px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:bold">Choice ${i+1}</span>
            <button class="icon-btn-sm" data-del-choice="${i}" style="color:#ef4444;font-size:10px">✕</button>
          </div>
          <div class="form-group"><input placeholder="Text..." value="${(c.text||'').replace(/</g,'&lt;')}" data-choice-idx="${i}" data-choice-field="text" style="font-size:11px;padding:4px"/></div>
          <div class="form-group"><label>Condition</label><input placeholder="e.g. rep > 5" value="${(c.condition||'').replace(/</g,'&lt;')}" data-choice-idx="${i}" data-choice-field="condition" style="font-size:11px;padding:4px"/></div>
          <div class="form-group"><label>Next</label><select data-choice-idx="${i}" data-choice-field="next" style="font-size:11px;padding:4px">
            <option value="">— none —</option>
            ${ctx.otherNodes.map(n => `<option value="${n.id}"${c.next===n.id?' selected':''}>${n.id}</option>`).join('')}
          </select></div>
        </div>`;
      });
      choiceList.innerHTML = chtml;
      choiceList.querySelectorAll('[data-choice-field]').forEach(el => {
        el.addEventListener('change', (e) => {
          const idx = parseInt(el.dataset.choiceIdx);
          let val = e.target.value;
          if (el.type === 'number') val = Number(val);
          node.choices[idx][el.dataset.choiceField] = val;
          helpers.markDirty();
          helpers.dispatchRender();
        });
      });
      choiceList.querySelectorAll('[data-del-choice]').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.delChoice);
          node.choices.splice(idx, 1);
          helpers.markDirty();
          renderChoices();
          helpers.dispatchRender();
        });
      });
    };
    renderChoices();
    container.querySelector('#add-choice-btn')?.addEventListener('click', () => {
      if (!node.choices) node.choices = [];
      node.choices.push({ text: 'New Choice', condition: '', next: '' });
      helpers.markDirty();
      renderChoices();
      helpers.dispatchRender();
    });
  },
  executeRuntime: (node, controller) => {
    controller.presentChoices(node);
  }
});

// --- CONDITION ---
Registry.extendNodeType('condition', {
  label: 'Condition',
  color: '#10b981',
  defaultData: () => ({ condition: 'flag == true', next: '', else: '' }),
  getHeight: () => 54,
  getOutputs: (node, sx, sy, sw, zoom) => {
    return [
      { x: sx + sw, y: sy + 54 * zoom * 0.35, label: 'TRUE', portIndex: 0 },
      { x: sx + sw, y: sy + 54 * zoom * 0.65, label: 'FALSE', portIndex: 1 }
    ];
  },
  getConnections: (node) => {
    const conns = [];
    if (node.next) conns.push({ port: 0, to: node.next, label: 'TRUE' });
    if (node.else) conns.push({ port: 1, to: node.else, label: 'FALSE' });
    return conns;
  },
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}">${n.id}</option>`).join('');
    return `
      <div class="form-group"><label>Condition Expression</label><input value="${(node.condition||'').replace(/"/g,'&quot;')}" data-field="condition" placeholder="e.g. flag == true"/></div>
      <div class="form-row">
        <div class="form-group"><label>True (Next)</label><select data-field="next"><option value="">— none —</option>${nodeOpts.replace(/value="([^"]+)"/g, (m, id) => node.next === id ? 'value="' + id + '" selected' : m)}</select></div>
        <div class="form-group"><label>False (Else)</label><select data-field="else"><option value="">— none —</option>${nodeOpts.replace(/value="([^"]+)"/g, (m, id) => node.else === id ? 'value="' + id + '" selected' : m)}</select></div>
      </div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.evaluateCondition(node);
  }
});

// --- EVENT ---
Registry.extendNodeType('event', {
  label: 'Event',
  color: '#8b5cf6',
  defaultData: () => ({ eventType: 'sfx', eventValue: '', next: '' }),
  getHeight: () => 54,
  renderEditor: (node, ctx) => {
    const evType = node.eventType || 'bgm';
    const isBGM  = evType === 'bgm';
    const isSFX  = evType === 'sfx';
    const isBG   = evType === 'bg_change';
    const isStop = evType === 'bgm_stop';
    const isCam  = evType === 'camera_shake' || evType === 'camera_flash';
    const isAnim = evType === 'play_animation';

    const volVal = node.eventVolume != null ? node.eventVolume : 1.0;
    const volRow = (isBGM || isSFX) ? `
      <div class="form-group">
        <label>Volume</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="range" min="0" max="1" step="0.05" value="${volVal}" data-field="eventVolume" data-type="number" style="flex:1" />
          <span id="ev-vol-label" style="font-size:11px;width:30px;text-align:right">${Math.round(volVal*100)}%</span>
        </div>
      </div>` : '';

    const camPlaceholder = evType === 'camera_shake' ? 'duration,intensity e.g. 500,0.01' : 'r,g,b e.g. 255,255,255';
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');

    return `
      <div class="form-group"><label>Event Type</label><select data-field="eventType" id="ev-type-select">
        <option value="bgm"${isBGM?' selected':''}>🎵 Play BGM</option>
        <option value="bgm_stop"${isStop?' selected':''}>⏹ Stop BGM</option>
        <option value="sfx"${isSFX?' selected':''}>🔊 Play SFX</option>
        <option value="bg_change"${isBG?' selected':''}>🖼️ Change Background</option>
        <option value="unlock_cg"${evType==='unlock_cg'?' selected':''}>🔓 Unlock CG</option>
        <option value="camera_shake"${evType==='camera_shake'?' selected':''}>📳 Camera Shake</option>
        <option value="camera_flash"${evType==='camera_flash'?' selected':''}>✨ Camera Flash</option>
        <option value="play_animation"${isAnim?' selected':''}>🎬 Play Animation</option>
      </select></div>
      <div id="ev-value-section">
        ${(isBGM || isSFX) ? `
          <div class="form-group">
            <label>${isBGM ? 'BGM Track' : 'SFX Clip'}</label>
            <select data-field="eventValue" id="ev-asset-select">
              <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
            </select>
          </div>
          ${volRow}` : ''}
        ${(isBG || evType === 'unlock_cg') ? `
          <div class="form-group">
            <label>${isBG ? 'Background' : 'Gallery Image'}</label>
            <select data-field="eventValue" id="ev-asset-select">
              <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
            </select>
          </div>` : ''}
        ${isCam ? `
          <div class="form-group">
            <label>Value</label>
            <input value="${node.eventValue||''}" data-field="eventValue" placeholder="${camPlaceholder}" />
          </div>` : ''}
        ${isAnim ? `
          <div class="form-group">
            <label>Target (Layer/Char ID)</label>
            <input value="${node.eventTarget||''}" data-field="eventTarget" placeholder="e.g. dave" />
          </div>
          <div class="form-group">
            <label>Animation Key</label>
            <select data-field="eventValue" id="ev-asset-select">
              <option value="${node.eventValue||''}">${node.eventValue || '— loading… —'}</option>
            </select>
          </div>` : ''}
      </div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  bindEditor: (node, container, ctx, helpers) => {
    const volRange = container.querySelector('input[data-field="eventVolume"]');
    const volLabel = container.querySelector('#ev-vol-label');
    if (volRange && volLabel) {
      volRange.addEventListener('input', () => {
        volLabel.textContent = `${Math.round(volRange.value * 100)}%`;
        node.eventVolume = Number(volRange.value);
        helpers.markDirty();
      });
    }

    const evTypeSelect = container.querySelector('#ev-type-select');
    if (evTypeSelect) {
      evTypeSelect.addEventListener('change', () => {
        node.eventType = evTypeSelect.value;
        node.eventValue = '';
        helpers.markDirty();
        window.dispatchEvent(new CustomEvent('inspector:refresh'));
      });
    }

    const assetSelect = container.querySelector('#ev-asset-select');
    if (assetSelect && ctx.backend) {
      ctx.backend.listAssets().then(assets => {
        // assets is a flat array of { name, path, type, ... }
        const evType = node.eventType || 'bgm';
        let items = [];
        const assetList = Array.isArray(assets) ? assets : [];
        if (evType === 'bgm')      items = assetList.filter(f => f.path && f.path.startsWith('audio/bgm/')).map(f => f.name.replace(/\.[^.]+$/, ''));
        else if (evType === 'sfx') items = assetList.filter(f => f.path && f.path.startsWith('audio/sfx/')).map(f => f.name.replace(/\.[^.]+$/, ''));
        else if (evType === 'bg_change') items = assetList.filter(f => f.path && f.path.startsWith('backgrounds/')).map(f => f.name.replace(/\.[^.]+$/, ''));
        else if (evType === 'unlock_cg') items = assetList.filter(f => f.path && f.path.startsWith('gallery/')).map(f => f.name.replace(/\.[^.]+$/, ''));

        const current = node.eventValue || '';
        assetSelect.innerHTML = `<option value="">— select —</option>` +
          items.map(k => `<option value="${k}"${k === current ? ' selected' : ''}>${k}</option>`).join('');

        assetSelect.addEventListener('change', () => {
          helpers.captureUndoState();
          node.eventValue = assetSelect.value;
          helpers.markDirty();
          helpers.dispatchRender();
        });
      }).catch(() => {
        if (assetSelect.parentElement) {
          const fallback = document.createElement('input');
          fallback.value = node.eventValue || '';
          fallback.dataset.field = 'eventValue';
          fallback.placeholder = 'Enter asset key…';
          fallback.addEventListener('change', () => {
            helpers.captureUndoState();
            node.eventValue = fallback.value;
            helpers.markDirty();
          });
          assetSelect.replaceWith(fallback);
        }
      });
    }
  },
  executeRuntime: (node, controller) => {
    controller.fireEvent(node);
  }
});

// --- TEXT INPUT ---
Registry.extendNodeType('text_input', {
  label: 'Text Input',
  color: '#e879f9',
  defaultData: () => ({ prompt: 'Enter text:', variable: 'player_name', maxLength: 50, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/"/g, '&quot;')}" data-field="prompt"/></div>
      <div class="form-row">
        <div class="form-group"><label>Variable</label><input value="${node.variable||'player_name'}" data-field="variable"/></div>
        <div class="form-group"><label>Max Length</label><input type="number" value="${node.maxLength||50}" data-field="maxLength" data-type="number"/></div>
      </div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  }
});

// --- CHAPTER ---
Registry.extendNodeType('chapter', {
  label: 'Chapter Title',
  color: '#f59e0b',
  defaultData: () => ({ title: 'Chapter 1', subtitle: 'A New Beginning', duration: 3000, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-group"><label>Title</label><input value="${(node.title||'').replace(/"/g, '&quot;')}" data-field="title"/></div>
      <div class="form-group"><label>Subtitle</label><input value="${(node.subtitle||'').replace(/"/g, '&quot;')}" data-field="subtitle"/></div>
      <div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||3000}" data-field="duration" data-type="number"/></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  }
});

// --- PARTICLES ---
Registry.extendNodeType('particles', {
  label: 'Particle Effect',
  color: '#10b981',
  defaultData: () => ({ action: 'start', particleId: 'snow', duration: 0, wait: false, config: '{}', next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-row"><div class="form-group"><label>Action</label><select data-field="action">
        <option value="start"${node.action==='start'?' selected':''}>Start</option>
        <option value="stop"${node.action==='stop'?' selected':''}>Stop</option>
      </select></div>
      <div class="form-group"><label>Effect ID</label><input value="${node.particleId||''}" data-field="particleId" placeholder="e.g. snow, rain"/></div></div>
      <div class="form-group"><label>Config (JSON)</label><textarea data-field="config" rows="3" placeholder='{"speed": 100, "scale": 0.5}'>${(node.config||'{}').replace(/</g, '&lt;')}</textarea></div>
      <div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||0}" data-field="duration" data-type="number"/></div>
      <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait</label></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  }
});

// --- CALL_SCENE ---
Registry.extendNodeType('call_scene', {
  label: 'Call Scene',
  color: '#ec4899',
  defaultData: () => ({ sceneId: '', next: '' }),
  renderEditor: (node, ctx) => {
    const targetSceneId = node.sceneId;
    const targetScene = ctx.scenesObj ? ctx.scenesObj[targetSceneId] : null;
    const targetNodes = targetScene?.nodes || [];
    const nodeOpts2 = targetNodes.map(n => `<option value="${n.id}"${node.nodeId === n.id ? ' selected' : ''}>${n.id}</option>`).join('');
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    
    return `
      <div class="form-group"><label>Target Scene</label><select data-field="sceneId">
        <option value="">— none —</option>${ctx.scenesList.map(s => `<option value="${s}"${node.sceneId===s?' selected':''}>${s}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Start Node</label><select data-field="nodeId">
        <option value="">— entry point —</option>${nodeOpts2}
      </select></div>
      <div class="form-group"><label>Next (Return)</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.callScene(node);
  }
});

// --- MACRO ---
Registry.extendNodeType('macro', {
  label: 'Macro / Prefab',
  color: '#ec4899',
  defaultData: () => ({ sceneId: '', args: {}, next: '' }),
  renderEditor: (node, ctx) => {
    const targetSceneId = node.sceneId;
    const targetScene = ctx.scenesObj ? ctx.scenesObj[targetSceneId] : null;
    const targetNodes = targetScene?.nodes || [];
    const nodeOpts2 = targetNodes.map(n => `<option value="${n.id}"${node.nodeId === n.id ? ' selected' : ''}>${n.id}</option>`).join('');
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    
    // Build arguments list
    let argsHtml = '';
    if (node.args) {
      for (const [k, v] of Object.entries(node.args)) {
        argsHtml += `<div style="display:flex; gap:4px; margin-bottom:4px">
          <input value="${k}" data-arg-key="${k}" style="width:40%" placeholder="Var Name" />
          <input value="${v}" data-arg-val="${k}" style="width:50%" placeholder="Value" />
          <button class="icon-btn-sm" data-del-arg="${k}" style="color:#ef4444">✕</button>
        </div>`;
      }
    }

    return `
      <div class="form-group"><label>Target Macro Scene</label><select data-field="sceneId">
        <option value="">— none —</option>${ctx.scenesList.map(s => `<option value="${s}"${node.sceneId===s?' selected':''}>${s}</option>`).join('')}
      </select></div>
      <div class="form-group"><label>Start Node</label><select data-field="nodeId">
        <option value="">— entry point —</option>${nodeOpts2}
      </select></div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
        <label>Arguments (Passed to Sub-Scene)</label>
        <div id="args-list">${argsHtml}</div>
        <button class="add-btn" id="add-arg-btn">+ Add Argument</button>
      </div>
      <div class="form-group"><label>Next (Return)</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  bindEditor: (node, container, ctx, helpers) => {
    container.querySelector('#add-arg-btn')?.addEventListener('click', () => {
      if (!node.args) node.args = {};
      const newKey = 'arg' + Object.keys(node.args).length;
      node.args[newKey] = '';
      helpers.markDirty();
      helpers.dispatchRender();
    });

    container.querySelectorAll('[data-del-arg]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.delArg;
        delete node.args[k];
        helpers.markDirty();
        helpers.dispatchRender();
      });
    });

    container.querySelectorAll('[data-arg-key]').forEach(input => {
      input.addEventListener('change', (e) => {
        const oldKey = input.dataset.argKey;
        const newKey = e.target.value.trim();
        if (newKey && newKey !== oldKey) {
          node.args[newKey] = node.args[oldKey];
          delete node.args[oldKey];
          helpers.markDirty();
          helpers.dispatchRender();
        }
      });
    });

    container.querySelectorAll('[data-arg-val]').forEach(input => {
      input.addEventListener('change', (e) => {
        const key = input.dataset.argVal;
        let val = e.target.value;
        if (/^\\d+\\.?\\d*$/.test(val)) val = Number(val);
        else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        node.args[key] = val;
        helpers.markDirty();
      });
    });
  },
  executeRuntime: (node, controller) => {
    controller.callScene(node);
  }
});

// --- WAIT ---
Registry.extendNodeType('wait', {
  label: 'Wait',
  color: '#64748b',
  defaultData: () => ({ duration: 1000, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.doWait(node);
  }
});

// --- END ---
Registry.extendNodeType('end', {
  label: 'End Scene',
  color: '#ef4444',
  defaultData: () => ({ text: '', nextScene: '', transition: 'fade', transitionDuration: 600 }),
  getOutputs: () => [], // Ends don't output visually
  renderEditor: (node, ctx) => `
    <div class="form-group"><label>Ending text</label><input value="${(node.text||'').replace(/</g,'&lt;')}" data-field="text"/></div>
    <div class="form-group"><label>Next scene</label><select data-field="nextScene">
      <option value="">— end —</option>${ctx.scenesList.map(s => `<option value="${s}"${node.nextScene===s?' selected':''}>${s}</option>`).join('')}
    </select></div>
    <div class="form-row">
      <div class="form-group"><label>Transition</label><select data-field="transition">
        <option value="fade"${node.transition==='fade'?' selected':''}>Fade to Black</option>
        <option value="white_fade"${node.transition==='white_fade'?' selected':''}>Fade to White</option>
        <option value="slide_left"${node.transition==='slide_left'?' selected':''}>Slide Left</option>
        <option value="slide_right"${node.transition==='slide_right'?' selected':''}>Slide Right</option>
        <option value="none"${node.transition==='none'?' selected':''}>None</option>
      </select></div>
      <div class="form-group"><label>Duration</label><input type="number" value="${node.transitionDuration||600}" data-field="transitionDuration" data-type="number"/></div>
    </div>
  `,
  executeRuntime: (node, controller) => {
    controller.endScene(node);
  }
});

// --- SET VARIABLE ---
Registry.extendNodeType('set_variable', {
  label: 'Set Variable',
  color: '#059669',
  defaultData: () => ({ variable: '', value: '', operation: 'set', next: '' }),
  renderEditor: (node, ctx) => {
    const varOpts = Object.keys(ctx.variableDefs || {}).map(k => {
      const def = ctx.variableDefs[k];
      const typeLabel = def?.type === 'array' ? ' [array]' : '';
      return `<option value="${k}"${node.variable===k?' selected':''}>${k}${typeLabel}</option>`;
    }).join('');
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');

    // Check if selected variable is an array type
    const selectedDef = ctx.variableDefs?.[node.variable];
    const isArray = selectedDef?.type === 'array';

    const scalarOps = `
      <option value="set"${node.operation==='set'?' selected':''}>Set</option>
      <option value="add"${node.operation==='add'?' selected':''}>Add</option>
      <option value="toggle"${node.operation==='toggle'?' selected':''}>Toggle</option>
    `;
    const arrayOps = `
      <option value="append"${node.operation==='append'?' selected':''}>Append</option>
      <option value="remove"${node.operation==='remove'?' selected':''}>Remove</option>
      <option value="clear"${node.operation==='clear'?' selected':''}>Clear</option>
    `;

    const opOpts = isArray ? arrayOps : scalarOps;

    // Hide value field for 'clear' and 'toggle' operations
    const showValue = node.operation !== 'clear' && node.operation !== 'toggle';
    const valueLabel = isArray ? 'Item' : 'Value';

    return `
      <div class="form-group"><label>Variable</label><select data-field="variable" id="sv-variable">
        <option value="">— select —</option>${varOpts}</select></div>
      <div class="form-group"><label>Operation</label><select data-field="operation" id="sv-operation">
        ${opOpts}
      </select></div>
      ${showValue ? `<div class="form-group"><label>${valueLabel}</label><input value="${node.value||''}" data-field="value" id="sv-value"/></div>` : ''}
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  bindEditor: (node, container, ctx, helpers) => {
    const varSelect = container.querySelector('#sv-variable');
    const opSelect = container.querySelector('#sv-operation');

    if (varSelect) {
      varSelect.addEventListener('change', () => {
        helpers.captureUndoState();
        node.variable = varSelect.value;
        // Switch operation list based on variable type
        const selectedDef = ctx.variableDefs?.[node.variable];
        const isArray = selectedDef?.type === 'array';
        if (isArray) {
          // If current op is scalar-only, switch to append
          if (!['append', 'remove', 'clear'].includes(node.operation)) {
            node.operation = 'append';
          }
        } else {
          // If current op is array-only, switch to set
          if (['append', 'remove', 'clear'].includes(node.operation)) {
            node.operation = 'set';
          }
        }
        helpers.markDirty();
        helpers.dispatchRender();
      });
    }

    if (opSelect) {
      opSelect.addEventListener('change', () => {
        helpers.captureUndoState();
        node.operation = opSelect.value;
        helpers.markDirty();
        helpers.dispatchRender();
      });
    }
  },
  executeRuntime: (node, controller) => {
    controller.setVariableNode(node);
  }
});

// --- TIMED CHOICE ---
Registry.extendNodeType('timed_choice', {
  label: 'Timed Choice',
  color: '#d97706',
  defaultData: () => ({ duration: 5000, default_next: '', prompt: '', choices: [], next: '' }),
  getHeight: (node) => Math.max(64, 36 + (node.choices || []).length * 20),
  getOutputs: (node, sx, sy, sw, zoom) => {
    return (node.choices || []).map((c, i) => ({ x: sx + sw, y: sy + 14 + i * 20 * zoom }));
  },
  getConnections: (node) => {
    const conns = [];
    (node.choices || []).forEach((c, i) => { if (c.next) conns.push({ port: i, to: c.next }); });
    return conns;
  },
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.default_next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-row"><div class="form-group"><label>Duration (ms)</label><input type="number" value="${node.duration||5000}" data-field="duration" data-type="number"/></div>
      <div class="form-group"><label>Default Next</label><select data-field="default_next"><option value="">— none —</option>${nodeOpts}</select></div></div>
      <div class="form-group"><label>Prompt</label><input value="${(node.prompt||'').replace(/</g,'&lt;')}" data-field="prompt"/></div>
      <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
      <label>Choices (${(node.choices||[]).length})</label>
      <div id="choice-list"></div>
      <button class="add-btn" id="add-choice-btn">+ Add Choice</button></div>
    `;
  },
  bindEditor: (node, container, ctx, helpers) => {
    // Re-use choice binding logic
    Registry.getNodeType('choice').bindEditor(node, container, ctx, helpers);
  },
  executeRuntime: (node, controller) => {
    controller.presentTimedChoice(node);
  }
});

// --- RANDOM BRANCH ---
Registry.extendNodeType('random_branch', {
  label: 'Random Branch',
  color: '#6366f1',
  defaultData: () => ({ choices: [], next: '' }),
  getHeight: (node) => Math.max(64, 36 + (node.choices || []).length * 20),
  getOutputs: (node, sx, sy, sw, zoom) => {
    return (node.choices || []).map((c, i) => ({ x: sx + sw, y: sy + 14 + i * 20 * zoom }));
  },
  getConnections: (node) => {
    const conns = [];
    (node.choices || []).forEach((c, i) => { if (c.next) conns.push({ port: i, to: c.next }); });
    return conns;
  },
  renderEditor: (node, ctx) => `
    <div class="form-group" style="border-top:1px solid var(--border);padding-top:8px">
      <label>Branches (${(node.choices||[]).length})</label>
      <div id="choice-list"></div>
      <button class="add-btn" id="add-choice-btn">+ Add Branch</button>
    </div>
  `,
  bindEditor: (node, container, ctx, helpers) => {
    const choiceList = container.querySelector('#choice-list');
    const renderChoices = () => {
      if (!node.choices) node.choices = [];
      let chtml = '';
      node.choices.forEach((c, i) => {
        chtml += `<div style="background:var(--bg-elevated);border-radius:4px;padding:6px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:10px;font-weight:bold">Branch ${i+1}</span>
            <button class="icon-btn-sm" data-del-choice="${i}" style="color:#ef4444;font-size:10px">✕</button>
          </div>
          <div class="form-group"><label>Weight</label><input type="number" value="${c.weight||1}" data-choice-idx="${i}" data-choice-field="weight" style="font-size:11px;padding:4px"/></div>
          <div class="form-group"><label>Next</label><select data-choice-idx="${i}" data-choice-field="next" style="font-size:11px;padding:4px">
            <option value="">— none —</option>
            ${ctx.otherNodes.map(n => `<option value="${n.id}"${c.next===n.id?' selected':''}>${n.id}</option>`).join('')}
          </select></div>
        </div>`;
      });
      choiceList.innerHTML = chtml;
      choiceList.querySelectorAll('[data-choice-field]').forEach(el => {
        el.addEventListener('change', (e) => {
          const idx = parseInt(el.dataset.choiceIdx);
          let val = e.target.value;
          if (el.type === 'number') val = Number(val);
          node.choices[idx][el.dataset.choiceField] = val;
          helpers.markDirty();
          helpers.dispatchRender();
        });
      });
      choiceList.querySelectorAll('[data-del-choice]').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.delChoice);
          node.choices.splice(idx, 1);
          helpers.markDirty();
          renderChoices();
          helpers.dispatchRender();
        });
      });
    };
    renderChoices();
    container.querySelector('#add-choice-btn')?.addEventListener('click', () => {
      if (!node.choices) node.choices = [];
      node.choices.push({ weight: 1, next: '' });
      helpers.markDirty();
      renderChoices();
      helpers.dispatchRender();
    });
  },
  executeRuntime: (node, controller) => {
    controller.evaluateRandomBranch(node);
  }
});

// --- ANIMATE ---
Registry.extendNodeType('animate', {
  label: 'Animate',
  color: '#0284c7',
  defaultData: () => ({ target: '', property: 'x', value: 0, duration: 1000, easing: 'Linear', wait: false, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-row"><div class="form-group"><label>Target</label><input value="${node.target||''}" data-field="target"/></div>
      <div class="form-group"><label>Property</label><select data-field="property">
        <option value="x"${node.property==='x'?' selected':''}>X Position</option>
        <option value="y"${node.property==='y'?' selected':''}>Y Position</option>
        <option value="alpha"${node.property==='alpha'?' selected':''}>Alpha (Opacity)</option>
        <option value="scale"${node.property==='scale'?' selected':''}>Scale</option>
        <option value="angle"${node.property==='angle'?' selected':''}>Angle</option>
        <option value="zoom"${node.property==='zoom'?' selected':''}>Zoom (Camera)</option>
      </select></div></div>
      <div class="form-row"><div class="form-group"><label>Value</label><input type="number" value="${node.value||0}" data-field="value" data-type="number"/></div>
      <div class="form-group"><label>Duration</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div></div>
      <div class="form-row"><div class="form-group"><label>Easing</label><select data-field="easing">
        <option value="Linear"${node.easing==='Linear'?' selected':''}>Linear</option>
        <option value="Sine.easeInOut"${node.easing==='Sine.easeInOut'?' selected':''}>Smooth In/Out</option>
        <option value="Bounce.easeOut"${node.easing==='Bounce.easeOut'?' selected':''}>Bounce</option>
      </select></div>
      <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.animateNode(node);
  }
});

// --- SHOW OBJECT ---
Registry.extendNodeType('show_object', {
  label: 'Show Object',
  color: '#14b8a6',
  defaultData: () => ({ target: '', duration: 0, wait: false, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-group"><label>Target (ID)</label><input value="${node.target||''}" data-field="target"/></div>
      <div class="form-row"><div class="form-group"><label>Fade Duration (ms)</label><input type="number" value="${node.duration||0}" data-field="duration" data-type="number"/></div>
      <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.showObjectNode(node);
  }
});

// --- HIDE OBJECT ---
Registry.extendNodeType('hide_object', {
  label: 'Hide Object',
  color: '#94a3b8',
  defaultData: () => ({ target: '', duration: 0, wait: false, next: '' }),
  renderEditor: (node, ctx) => {
    // Re-use show_object render since it's identical
    return Registry.getNodeType('show_object').renderEditor(node, ctx);
  },
  executeRuntime: (node, controller) => {
    controller.hideObjectNode(node);
  }
});

// --- CAMERA ---
Registry.extendNodeType('camera', {
  label: 'Camera',
  color: '#8b5cf6',
  defaultData: () => ({ action: 'shake', value: '', duration: 1000, wait: false, next: '' }),
  renderEditor: (node, ctx) => {
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-row"><div class="form-group"><label>Action</label><select data-field="action">
          <option value="shake"${node.action==='shake'?' selected':''}>Shake</option>
          <option value="flash"${node.action==='flash'?' selected':''}>Flash</option>
          <option value="fade_in"${node.action==='fade_in'?' selected':''}>Fade In</option>
          <option value="fade_out"${node.action==='fade_out'?' selected':''}>Fade Out</option>
          <option value="zoom"${node.action==='zoom'?' selected':''}>Zoom</option>
          <option value="pan"${node.action==='pan'?' selected':''}>Pan</option>
        </select></div>
        <div class="form-group"><label>Value</label><input value="${node.value||''}" data-field="value" placeholder="e.g. 0.05 or 400,300"/></div></div>
      <div class="form-row"><div class="form-group"><label>Duration</label><input type="number" value="${node.duration||1000}" data-field="duration" data-type="number"/></div>
      <div class="form-group"><label style="margin-top:20px"><input type="checkbox" data-field="wait" ${node.wait?'checked':''}/> Wait for finish</label></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.cameraNode(node);
  }
});
