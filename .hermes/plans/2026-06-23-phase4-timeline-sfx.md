# Phase 4: Timeline Polish + Typewriter SFX

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Polish the existing timeline editor with draggable keyframes and add configurable typewriter sound effects to DialogueSystem.

**Architecture:** Two independent features. Timeline polish enhances the existing `tools/views/animations.js`. Typewriter SFX adds a blip sound system to `src/systems/DialogueSystem.js` with theme config.

**Tech Stack:** Vanilla JS (editor), Phaser 4 (runtime), existing AnimationRunner.

---

## Feature A: Typewriter SFX (Quick Win)

### Task 1: Add blip sound config to theme.json

**Objective:** Define the blip sound configuration in theme.json.

**Files:**
- Modify: `data/theme.json`

**Step 1:** Add to theme.json dialogue section:
```json
"blipSound": null,
"blipVolume": 0.3
```

**Step 2:** Run `cat data/theme.json | python3 -m json.tool` to validate JSON.

---

### Task 2: Add blip playback to DialogueSystem

**Objective:** Play a short blip sound on each typewriter character.

**Files:**
- Modify: `src/systems/DialogueSystem.js`

**Step 1:** In constructor, read blip config from theme:
```js
this._blipSound = theme.blipSound || null;
this._blipVolume = theme.blipVolume ?? 0.3;
```

**Step 2:** In `_typeNextChar()`, after incrementing `_charIndex` and before scheduling the next timer, play the blip:
```js
// Play blip sound (skip spaces and control chars)
if (this._blipSound && this.scene?.audio) {
  const lastChar = this._fullText?.[this._charIndex - 1];
  if (lastChar && lastChar !== ' ' && lastChar !== '\n') {
    this.scene.audio.playSFX(this._blipSound, this._blipVolume);
  }
}
```

**Step 3:** In `skipToEnd()`, reset blip state.

**Step 4:** Run `npm test` — no regressions expected (DialogueSystem not unit-tested).

---

### Task 3: Add blip sound to dialogue inspector

**Objective:** Let writers configure blip sound per-scene in the editor.

**Files:**
- Modify: `tools/nodes/EditorNodes.js`

**Step 1:** In dialogue `renderEditor`, add a blip sound dropdown after the Voice field:
```html
<div class="form-group"><label>Blip Sound</label>
  <select data-field="blipSound" id="blip-sound-select">
    <option value="">— none —</option>
  </select>
</div>
```

**Step 2:** In `bindEditor`, populate the dropdown with SFX assets (similar to voice select).

---

## Feature B: Timeline Keyframe Dragging

### Task 4: Add drag-to-reposition for keyframes

**Objective:** Allow keyframes to be dragged left/right on the timeline to change their time.

**Files:**
- Modify: `tools/views/animations.js`

**Step 1:** In `_renderTimeline`, add mousedown handler on keyframe elements:
```js
kfEl.addEventListener('mousedown', (e) => {
  e.stopPropagation();
  _selectedKeyframe = { track, index: idx };
  _draggingKeyframe = { track, index: idx, startX: e.clientX, startTime: kf.time };
  _renderTimeline(container, context);
  _renderProps(container, context);
});
```

**Step 2:** Add global mousemove/mouseup handlers for drag:
```js
document.addEventListener('mousemove', onDragMove);
document.addEventListener('mouseup', onDragEnd);
```

**Step 3:** In `onDragMove`, update keyframe time based on mouse delta:
```js
function onDragMove(e) {
  if (!_draggingKeyframe) return;
  const trackEl = document.querySelector(`.timeline-track[data-track="${_draggingKeyframe.track}"]`);
  if (!trackEl) return;
  
  const rect = trackEl.getBoundingClientRect();
  const dx = e.clientX - _draggingKeyframe.startX;
  const dt = (dx / rect.width) * anim.duration;
  let newTime = Math.round((_draggingKeyframe.startTime + dt) / 10) * 10;
  newTime = Math.max(0, Math.min(anim.duration, newTime));
  
  const kf = anim.tracks[_draggingKeyframe.track][_draggingKeyframe.index];
  if (kf) kf.time = newTime;
  
  markDirty();
  _renderTimeline(container, context);
}
```

**Step 4:** Clean up drag state on mouseup.

---

### Task 5: Add keyframe drag visual feedback

**Objective:** Show a ghost indicator while dragging a keyframe.

**Files:**
- Modify: `tools/views/animations.js`

**Step 1:** During drag, add a vertical guide line at the current time position.

**Step 2:** Highlight the time input field in the keyframe editor to show the live value.

---

## Verification

1. `npm test` — all 257 tests pass
2. Open `/tools/` → Animations mode → create animation → click track to add keyframe → drag keyframe left/right → time updates in real-time
3. Play animation → verify keyframes animate correctly
4. Add `blipSound` to theme.json → play game → hear blip on each character typed
5. In editor dialogue inspector → configure blip sound → verify it saves

## Files Modified

| File | Change |
|------|--------|
| `data/theme.json` | Add blipSound, blipVolume to dialogue |
| `src/systems/DialogueSystem.js` | Blip playback in typewriter |
| `tools/nodes/EditorNodes.js` | Blip sound dropdown in dialogue inspector |
| `tools/views/animations.js` | Draggable keyframes on timeline |
