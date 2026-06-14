import { Registry } from '../systems/Registry.js';

// --- DIALOGUE ---
Registry.registerNodeType('dialogue', {
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

    return `
      <div class="form-group"><label>Speaker</label><select data-field="speaker">
        <option value="">(narration)</option>${speakerOpts}</select></div>
      <div class="form-group"><label>Expression</label><input value="${node.expression||''}" data-field="expression"/></div>
      <div class="form-row"><div class="form-group"><label>Z-Index</label><input type="number" value="${node.zIndex??0}" data-field="zIndex" data-type="number"/></div></div>
      <div class="form-group"><label>Text</label><textarea data-field="text">${(node.text||'').replace(/</g,'&lt;')}</textarea></div>
      <div class="form-row"><div class="form-group"><label>Auto</label><select data-field="autoAdvance">
        <option value="false">No</option><option value="true"${node.autoAdvance?' selected':''}>Yes</option></select></div>
      <div class="form-group"><label>Wait ms</label><input type="number" value="${node.waitTime||2000}" data-field="waitTime" data-type="number"/></div></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.showDialogue(node);
  }
});

// --- CHOICE ---
Registry.registerNodeType('choice', {
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
Registry.registerNodeType('condition', {
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
Registry.registerNodeType('event', {
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
        ${isBG ? `
          <div class="form-group">
            <label>Background</label>
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
        const evType = node.eventType || 'bgm';
        let items = [];
        if (evType === 'bgm')      items = (assets.music      || []).map(f => f.name.replace(/\\.[^.]+$/, ''));
        else if (evType === 'sfx') items = (assets.sfx        || []).map(f => f.name.replace(/\\.[^.]+$/, ''));
        else if (evType === 'bg_change') items = (assets.backgrounds || []).map(f => f.name.replace(/\\.[^.]+$/, ''));

        const current = node.eventValue || '';
        assetSelect.innerHTML = `<option value="">— select —</option>` +
          items.map(k => `<option value="${k}"${k === current ? ' selected' : ''}>${k}</option>`).join('');

        assetSelect.addEventListener('change', () => {
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

// --- CALL_SCENE ---
Registry.registerNodeType('call_scene', {
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
Registry.registerNodeType('macro', {
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
Registry.registerNodeType('wait', {
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
Registry.registerNodeType('end', {
  label: 'End Scene',
  color: '#ef4444',
  defaultData: () => ({ text: '', nextScene: '' }),
  getOutputs: () => [], // Ends don't output visually
  renderEditor: (node, ctx) => `
    <div class="form-group"><label>Ending text</label><input value="${(node.text||'').replace(/</g,'&lt;')}" data-field="text"/></div>
    <div class="form-group"><label>Next scene</label><select data-field="nextScene">
      <option value="">— end —</option>${ctx.scenesList.map(s => `<option value="${s}"${node.nextScene===s?' selected':''}>${s}</option>`).join('')}
    </select></div>
  `,
  executeRuntime: (node, controller) => {
    controller.endScene(node);
  }
});

// --- SET VARIABLE ---
Registry.registerNodeType('set_variable', {
  label: 'Set Variable',
  color: '#059669',
  defaultData: () => ({ variable: '', value: '', operation: 'set', next: '' }),
  renderEditor: (node, ctx) => {
    const varOpts = Object.keys(ctx.variableDefs || {}).map(k => `<option value="${k}"${node.variable===k?' selected':''}>${k}</option>`).join('');
    const nodeOpts = ctx.otherNodes.map(n => `<option value="${n.id}"${node.next===n.id?' selected':''}>${n.id}</option>`).join('');
    return `
      <div class="form-group"><label>Variable</label><select data-field="variable">
        <option value="">— select —</option>${varOpts}</select></div>
      <div class="form-group"><label>Value</label><input value="${node.value||''}" data-field="value"/></div>
      <div class="form-group"><label>Operation</label><select data-field="operation">
        <option value="set"${node.operation==='set'?' selected':''}>Set</option>
        <option value="add"${node.operation==='add'?' selected':''}>Add</option>
        <option value="toggle"${node.operation==='toggle'?' selected':''}>Toggle</option>
      </select></div>
      <div class="form-group"><label>Next</label><select data-field="next"><option value="">— none —</option>${nodeOpts}</select></div>
    `;
  },
  executeRuntime: (node, controller) => {
    controller.setVariableNode(node);
  }
});

// --- TIMED CHOICE ---
Registry.registerNodeType('timed_choice', {
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
Registry.registerNodeType('random_branch', {
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
Registry.registerNodeType('animate', {
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
Registry.registerNodeType('show_object', {
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
Registry.registerNodeType('hide_object', {
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
Registry.registerNodeType('camera', {
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
