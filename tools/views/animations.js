import { editorState, markDirty } from '../state.js';

export function render(container, context) {
  let html = `
    <div style="display:flex; width:100%; height:100%; overflow:hidden;">
      <!-- LEFT PANEL: Animation List -->
      <div style="width:250px; background:var(--bg-panel); border-right:1px solid var(--border); display:flex; flex-direction:column;">
        <div style="padding:10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:12px; text-transform:uppercase; color:var(--text-muted)">Animations</strong>
          <button id="btn-add-anim" class="icon-btn-sm" title="New Animation">➕</button>
        </div>
        <div id="anim-list" style="flex:1; overflow-y:auto; padding:10px;">
          <!-- Items will be generated here -->
        </div>
      </div>

      <!-- MAIN AREA: Preview and Timeline -->
      <div style="flex:1; display:flex; flex-direction:column; background:var(--bg-base);">
        
        <!-- TOP: Toolbar / Properties -->
        <div style="height:50px; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 20px; gap:20px; background:var(--bg-panel);">
           <div id="anim-props-header" style="display:flex; gap:20px; flex:1;">
             <span style="color:var(--text-muted); font-style:italic;">Select an animation from the list</span>
           </div>
        </div>

        <!-- CENTER: Preview Canvas -->
        <div style="flex:1; position:relative; overflow:hidden; display:flex; justify-content:center; align-items:center;">
          <div class="grid-background" style="position:absolute; inset:0; opacity:0.5; z-index:0;"></div>
          
          <div id="anim-preview-box" style="position:relative; width:400px; height:400px; border:2px dashed var(--border); z-index:1; display:flex; justify-content:center; align-items:center; background:#111122aa;">
             <!-- Preview target dummy -->
             <div id="anim-preview-target" style="width:64px; height:64px; background:var(--accent); border-radius:8px; background-size:contain; background-repeat:no-repeat; background-position:center;"></div>
          </div>
        </div>

        <!-- BOTTOM: Timeline -->
        <div style="height:250px; border-top:1px solid var(--border); background:var(--bg-panel); display:flex; flex-direction:column;">
          <div style="padding:10px; border-bottom:1px solid var(--border); font-size:12px; font-weight:bold; color:var(--text-muted); display:flex; justify-content:space-between;">
            <span>Timeline</span>
            <div id="timeline-controls" style="display:none; gap:10px;">
               <button id="btn-play-anim" class="btn btn-sm">▶ Play</button>
               <button id="btn-stop-anim" class="btn btn-sm">⏹ Stop</button>
            </div>
          </div>
          <div id="anim-timeline-body" style="flex:1; position:relative; overflow-y:auto; overflow-x:hidden; background:var(--bg-base); display:flex; flex-direction:column;">
             <!-- Timeline tracks will go here -->
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  
  _renderList(container, context);
  _renderProps(container, context);
  _renderTimeline(container, context);

  // Bind add button
  const addBtn = container.querySelector('#btn-add-anim');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const id = prompt("Enter new animation ID (e.g. fade_in):");
      if (!id) return;
      if (editorState.animations[id]) {
         alert("Animation ID already exists.");
         return;
      }
      editorState.animations[id] = {
         id: id,
         duration: 1000,
         loop: 0,
         tracks: {
           x: [], y: [], alpha: [], scale: [], rotation: []
         }
      };
      if (!editorState.gameConfig.animations) editorState.gameConfig.animations = [];
      if (!editorState.gameConfig.animations.includes(id)) {
        editorState.gameConfig.animations.push(id);
      }
      editorState.selectedItemId = id;
      editorState.selectedItemType = 'animation';
      markDirty();
      render(container, context); // re-render
    });
  }

  // Setup drag and drop for preview target
  const previewBox = container.querySelector('#anim-preview-box');
  const targetDummy = container.querySelector('#anim-preview-target');
  
  if (previewBox && targetDummy) {
    // Restore preview asset if it exists for this animation
    if (editorState.selectedItemId && editorState.animations[editorState.selectedItemId]) {
      const anim = editorState.animations[editorState.selectedItemId];
      if (anim.previewAsset) {
        targetDummy.style.backgroundImage = `url('${anim.previewAsset}')`;
        targetDummy.style.backgroundColor = 'transparent';
        targetDummy.style.width = '128px'; // Make it a bit bigger for images
        targetDummy.style.height = '128px';
      }
    }

    previewBox.addEventListener('dragover', e => {
      e.preventDefault();
      previewBox.style.borderColor = 'var(--accent)';
    });
    
    previewBox.addEventListener('dragleave', e => {
      previewBox.style.borderColor = 'var(--border)';
    });
    
    previewBox.addEventListener('drop', e => {
      e.preventDefault();
      previewBox.style.borderColor = 'var(--border)';
      
      try {
        const dataStr = e.dataTransfer.getData('application/json');
        if (dataStr) {
          const data = JSON.parse(dataStr);
          if (data.type === 'image' && data.path) {
            // data.path is the URL to the image e.g. /assets/characters/dave.png
            const assetUrl = data.path.startsWith('/assets/') ? data.path : `/assets/${data.path}`;
            targetDummy.style.backgroundImage = `url('${assetUrl}')`;
            targetDummy.style.backgroundColor = 'transparent';
            targetDummy.style.width = '128px';
            targetDummy.style.height = '128px';
            
            // Save to animation data so it persists
            if (editorState.selectedItemId && editorState.animations[editorState.selectedItemId]) {
              editorState.animations[editorState.selectedItemId].previewAsset = assetUrl;
              markDirty();
            }
          }
        }
      } catch (err) {
        // Not valid JSON or drag data
      }
    });
  }
}

function _renderList(container, context) {
  const listEl = container.querySelector('#anim-list');
  if (!listEl) return;
  
  let html = '';
  for (const id of Object.keys(editorState.animations || {})) {
    const isSel = (editorState.selectedItemType === 'animation' && editorState.selectedItemId === id);
    html += `
      <div class="anim-list-item ${isSel ? 'active' : ''}" data-id="${id}" style="padding:8px; margin-bottom:4px; border-radius:4px; cursor:pointer; background:${isSel ? 'var(--accent)' : 'var(--bg-elevated)'};">
        ${id}
      </div>
    `;
  }
  listEl.innerHTML = html;

  listEl.querySelectorAll('.anim-list-item').forEach(el => {
    el.addEventListener('click', () => {
      editorState.selectedItemId = el.dataset.id;
      editorState.selectedItemType = 'animation';
      _selectedKeyframe = null; // reset keyframe selection
      render(container, context);
    });
  });
}

let _selectedKeyframe = null; // { track: 'x', index: 1 }

function _renderProps(container, context) {
  const header = container.querySelector('#anim-props-header');
  if (!header) return;
  
  if (editorState.selectedItemType !== 'animation' || !editorState.selectedItemId) {
    header.innerHTML = `<span style="color:var(--text-muted); font-style:italic;">Select an animation from the list</span>`;
    return;
  }
  
  const anim = editorState.animations[editorState.selectedItemId];
  if (!anim) return;
  
  header.innerHTML = `
    <div class="form-group" style="margin:0; width:150px;">
      <label>Duration (ms)</label>
      <input type="number" id="anim-prop-duration" value="${anim.duration || 1000}" step="100" min="100" />
    </div>
    <div class="form-group" style="margin:0; width:100px;">
      <label>Loop</label>
      <select id="anim-prop-loop">
        <option value="0" ${anim.loop === 0 ? 'selected' : ''}>0 (Once)</option>
        <option value="-1" ${anim.loop === -1 ? 'selected' : ''}>-1 (Infinite)</option>
        <option value="1" ${anim.loop === 1 ? 'selected' : ''}>1 Time</option>
      </select>
    </div>
    <div class="form-group" style="margin:0; width:100px;">
      <label>Yoyo</label>
      <select id="anim-prop-yoyo">
        <option value="false" ${!anim.yoyo ? 'selected' : ''}>False</option>
        <option value="true" ${anim.yoyo ? 'selected' : ''}>True</option>
      </select>
    </div>
    <div style="flex:1"></div>
    <div id="kf-editor" style="display:none; gap:15px; padding:0 15px; border-left:1px solid var(--border); border-right:1px solid var(--border); align-items:center;">
      <strong style="font-size:11px; color:var(--accent);">KEYFRAME</strong>
      <div class="form-group" style="margin:0; width:80px;">
        <label>Time</label>
        <input type="number" id="kf-time" step="10" min="0" />
      </div>
      <div class="form-group" style="margin:0; width:100px;">
        <label>Value</label>
        <input type="text" id="kf-val" />
      </div>
      <div class="form-group" style="margin:0; width:120px;">
        <label>Ease</label>
        <select id="kf-ease">
          <option value="Linear">Linear</option>
          <option value="Sine.easeInOut">Sine InOut</option>
          <option value="Sine.easeIn">Sine In</option>
          <option value="Sine.easeOut">Sine Out</option>
          <option value="Quad.easeInOut">Quad InOut</option>
          <option value="Cubic.easeInOut">Cubic InOut</option>
          <option value="Bounce.easeOut">Bounce Out</option>
          <option value="Back.easeOut">Back Out</option>
        </select>
      </div>
      <button id="btn-del-kf" class="icon-btn-sm" title="Delete Keyframe" style="color:#ef4444;">🗑</button>
    </div>
    <div style="flex:1"></div>
    <button id="btn-del-anim" class="btn" style="color:#ef4444; border-color:#ef4444;">Delete Animation</button>
  `;
  
  // Update Keyframe Editor Data
  const kfEditor = container.querySelector('#kf-editor');
  if (_selectedKeyframe && anim.tracks[_selectedKeyframe.track]) {
    const kf = anim.tracks[_selectedKeyframe.track][_selectedKeyframe.index];
    if (kf) {
      kfEditor.style.display = 'flex';
      container.querySelector('#kf-time').value = kf.time;
      container.querySelector('#kf-val').value = kf.value;
      container.querySelector('#kf-ease').value = kf.ease || 'Linear';
      
      container.querySelector('#kf-time').addEventListener('change', e => {
        kf.time = Math.max(0, Math.min(anim.duration, parseInt(e.target.value) || 0));
        markDirty();
        _renderTimeline(container, context);
      });
      container.querySelector('#kf-val').addEventListener('change', e => {
        kf.value = e.target.value;
        markDirty();
      });
      container.querySelector('#kf-ease').addEventListener('change', e => {
        kf.ease = e.target.value;
        markDirty();
      });
      container.querySelector('#btn-del-kf').addEventListener('click', () => {
        anim.tracks[_selectedKeyframe.track].splice(_selectedKeyframe.index, 1);
        _selectedKeyframe = null;
        markDirty();
        _renderTimeline(container, context);
        _renderProps(container, context);
      });
    }
  }

  // Bind events
  container.querySelector('#anim-prop-duration').addEventListener('change', e => {
    anim.duration = parseInt(e.target.value) || 1000;
    markDirty();
    _renderTimeline(container, context); // re-render timeline scale
  });
  
  container.querySelector('#anim-prop-loop').addEventListener('change', e => {
    anim.loop = parseInt(e.target.value) || 0;
    markDirty();
  });
  
  container.querySelector('#anim-prop-yoyo').addEventListener('change', e => {
    anim.yoyo = e.target.value === 'true';
    markDirty();
  });
  
  container.querySelector('#btn-del-anim').addEventListener('click', () => {
    if (confirm('Delete this animation?')) {
      delete editorState.animations[editorState.selectedItemId];
      editorState.gameConfig.animations = editorState.gameConfig.animations.filter(id => id !== editorState.selectedItemId);
      editorState.selectedItemId = null;
      editorState.selectedItemType = null;
      markDirty();
      render(container, context);
    }
  });
}

function _renderTimeline(container, context) {
  const tBody = container.querySelector('#anim-timeline-body');
  const tCtrls = container.querySelector('#timeline-controls');
  if (!tBody) return;
  
  if (editorState.selectedItemType !== 'animation' || !editorState.selectedItemId) {
    tBody.innerHTML = '';
    if (tCtrls) tCtrls.style.display = 'none';
    return;
  }
  
  const anim = editorState.animations[editorState.selectedItemId];
  if (!anim) return;
  
  if (tCtrls) tCtrls.style.display = 'flex';
  
  // Create track rows
  const tracks = ['x', 'y', 'scale', 'rotation', 'alpha'];
  let html = '';
  
  // Timeline Ruler
  html += `
    <div style="height:24px; border-bottom:1px solid var(--border); display:flex; background:var(--bg-panel); position:sticky; top:0; z-index:10;">
      <div style="width:120px; border-right:1px solid var(--border); padding-left:10px; line-height:24px; font-size:10px; color:var(--text-muted);">TRACKS</div>
      <div id="timeline-ruler" style="flex:1; position:relative; overflow:hidden;">
        <!-- Ticks generated in JS -->
        <div id="timeline-scrubber" style="position:absolute; left:0; top:0; bottom:0; width:2px; background:red; z-index:20; display:none;"></div>
      </div>
    </div>
  `;
  
  tracks.forEach(track => {
    html += `
      <div style="height:40px; border-bottom:1px solid var(--border); display:flex; align-items:center;">
        <div style="width:120px; border-right:1px solid var(--border); padding-left:10px; font-size:12px; font-weight:bold; color:var(--text-bright); text-transform:uppercase;">
          ${track}
        </div>
        <div class="timeline-track" data-track="${track}" style="flex:1; height:100%; position:relative; background:#111122; cursor:crosshair;">
          <!-- Keyframes -->
        </div>
      </div>
    `;
  });
  
  tBody.innerHTML = html;
  
  // Render keyframes inside tracks
  const duration = anim.duration || 1000;
  tracks.forEach(track => {
    const trackEl = tBody.querySelector(`.timeline-track[data-track="${track}"]`);
    if (!trackEl) return;
    
    const kfs = anim.tracks[track] || [];
    kfs.forEach((kf, idx) => {
      const pct = Math.max(0, Math.min(100, (kf.time / duration) * 100));
      const isSel = _selectedKeyframe?.track === track && _selectedKeyframe?.index === idx;
      
      const kfEl = document.createElement('div');
      kfEl.style.cssText = `
        position: absolute;
        left: ${pct}%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(45deg);
        width: 12px; height: 12px;
        background: ${isSel ? '#ffffff' : 'var(--accent)'};
        border: 2px solid #000;
        cursor: pointer;
        z-index: 5;
      `;
      kfEl.title = `Time: ${kf.time}ms\nValue: ${kf.value}\nEase: ${kf.ease || 'Linear'}`;
      
      kfEl.addEventListener('click', (e) => {
        e.stopPropagation();
        _selectedKeyframe = { track, index: idx };
        _renderTimeline(container, context);
        _renderProps(container, context);
      });
      
      trackEl.appendChild(kfEl);
    });
    
    // Add keyframe on track click
    trackEl.addEventListener('click', (e) => {
      const rect = trackEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      const time = Math.round((pct * duration) / 10) * 10; // snap to 10ms
      
      if (!anim.tracks[track]) anim.tracks[track] = [];
      
      // Default value based on track
      let defVal = "0";
      if (track === 'scale' || track === 'alpha') defVal = "1";
      
      anim.tracks[track].push({ time, value: defVal, ease: 'Linear' });
      markDirty();
      _selectedKeyframe = { track, index: anim.tracks[track].length - 1 };
      _renderTimeline(container, context);
      _renderProps(container, context);
    });
  });

  // Render ticks
  const rulerEl = container.querySelector('#timeline-ruler');
  if (rulerEl) {
    const tickCount = Math.max(10, Math.ceil(duration / 100)); // Tick every 100ms
    for (let i=0; i<=tickCount; i++) {
      const time = i * 100;
      if (time > duration) break;
      const pct = (time / duration) * 100;
      const tick = document.createElement('div');
      tick.style.cssText = `position:absolute; left:${pct}%; top:10px; bottom:0; width:1px; background:var(--border);`;
      const label = document.createElement('div');
      label.style.cssText = `position:absolute; left:${pct}%; top:0; font-size:9px; color:var(--text-dim); transform:translateX(-50%);`;
      label.textContent = (time / 1000).toFixed(1) + 's';
      rulerEl.appendChild(tick);
      rulerEl.appendChild(label);
    }
  }

  // Playback Logic
  const btnPlay = container.querySelector('#btn-play-anim');
  const btnStop = container.querySelector('#btn-stop-anim');
  let playAnimFrame = null;
  let startTime = null;

  if (btnPlay && btnStop) {
    // We bind it by replacing the element to avoid duplicate listeners
    const newBtnPlay = btnPlay.cloneNode(true);
    btnPlay.parentNode.replaceChild(newBtnPlay, btnPlay);
    const newBtnStop = btnStop.cloneNode(true);
    btnStop.parentNode.replaceChild(newBtnStop, btnStop);
    
    newBtnPlay.addEventListener('click', () => {
      if (window._playAnimFrame) cancelAnimationFrame(window._playAnimFrame);
      startTime = performance.now();
      const scrubber = container.querySelector('#timeline-scrubber');
      if (scrubber) scrubber.style.display = 'block';
      
      const targetEl = container.querySelector('#anim-preview-target');
      if (targetEl) {
        targetEl.style.transition = 'none'; // disable CSS transitions during manual interpolation
      }
      
      function loop(now) {
        const elapsed = now - startTime;
        let t = elapsed;
        
        if (anim.loop === -1) {
          t = t % duration;
        } else if (t >= duration) {
          t = duration;
          if (scrubber) scrubber.style.left = '100%';
          _applyInterpolation(anim, duration, targetEl);
          window._playAnimFrame = null;
          return;
        }
        
        if (scrubber) scrubber.style.left = `${(t / duration) * 100}%`;
        
        _applyInterpolation(anim, t, targetEl);
        
        window._playAnimFrame = requestAnimationFrame(loop);
      }
      window._playAnimFrame = requestAnimationFrame(loop);
    });
    
    newBtnStop.addEventListener('click', () => {
      if (window._playAnimFrame) cancelAnimationFrame(window._playAnimFrame);
      window._playAnimFrame = null;
      const scrubber = container.querySelector('#timeline-scrubber');
      if (scrubber) scrubber.style.display = 'none';
      
      // Reset target
      const targetEl = container.querySelector('#anim-preview-target');
      if (targetEl) targetEl.style.transform = '';
      if (targetEl) targetEl.style.opacity = '1';
    });
  }
}

function _applyInterpolation(anim, t, el) {
  if (!el) return;
  
  const getInterpolatedValue = (trackName, defaultValue) => {
    const kfs = anim.tracks[trackName];
    if (!kfs || kfs.length === 0) return defaultValue;
    
    const parseVal = (v) => {
      const n = parseFloat(v);
      return isNaN(n) ? defaultValue : n;
    };
    
    // Sort by time
    const sorted = [...kfs].sort((a,b) => a.time - b.time);
    
    if (t <= sorted[0].time) return parseVal(sorted[0].value);
    if (t >= sorted[sorted.length-1].time) return parseVal(sorted[sorted.length-1].value);
    
    for (let i=0; i<sorted.length-1; i++) {
      const start = sorted[i];
      const end = sorted[i+1];
      if (t >= start.time && t < end.time) {
        // Simple linear interpolation for preview
        const progress = (t - start.time) / (end.time - start.time);
        const sVal = parseVal(start.value);
        const eVal = parseVal(end.value);
        return sVal + (eVal - sVal) * progress;
      }
    }
    return defaultValue;
  };
  
  const x = getInterpolatedValue('x', 0);
  const y = getInterpolatedValue('y', 0);
  const scale = getInterpolatedValue('scale', 1);
  const rotation = getInterpolatedValue('rotation', 0);
  const alpha = getInterpolatedValue('alpha', 1);
  
  const transformStr = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;
  
  // Apply
  el.style.transform = transformStr;
  el.style.opacity = alpha;
  
  // Debug output
  console.log(`[Anim Preview] t=${Math.round(t)}ms, transform: ${transformStr}, alpha: ${alpha}`);
}
