# VN Engine — UX & Feature Improvements

**Goal:** Add missing features that VN developers expect. High priority fixes workflow issues. Medium priority adds player-facing features.

**Architecture:** All features extend existing systems. No new modules — just enhancements to SceneController, DialogueSystem, VariableSystem, etc.

**Tech Stack:** Phaser 4.1.0, Vite 6.3, JavaScript (ESM), Vitest for tests.

---

## Task Order & Dependencies

```
1. Dynamic scene loading (foundational — other features depend on this)
2. Compound conditions (VariableSystem enhancement — used by menu/settings)
3. Background images (scene rendering)
4. Multi-character positioning (CharacterSystem enhancement)
5. Menu system (needs dynamic loading)
6. Settings UI (independent)
7. Dialogue history (independent)
8. Skip/auto modes (independent)
9. Quick save + auto-save (SaveSystem enhancement)
```

---

## Task 1: Dynamic Scene Loading

**Problem:** `BootScene.js` hardcodes fetch calls for each scene. Adding a new scene requires editing JavaScript.

**Solution:** Read `game.json`'s `scenes` array and dynamically fetch all scene files.

**Files:**
- Modify: `src/scenes/BootScene.js` — replace hardcoded fetches with dynamic loop
- Modify: `data/game.json` — ensure `scenes` array is complete

**Implementation:**

```js
// BootScene.create() — replace hardcoded fetches with:
const sceneIds = game.scenes || [];
const sceneFetches = sceneIds.map(id => 
  fetch(`/data/scenes/${id}.json`)
    .then(r => { 
      if (!r.ok) throw new Error(`${id}.json: ${r.status}`); 
      return r.json(); 
    })
    .then(data => ({ id, data }))
);

const results = await Promise.all([
  fetch('/data/game.json').then(r => r.json()),
  fetch('/data/characters.json').then(r => r.json()),
  fetch('/data/variables.json').then(r => r.json()),
  ...sceneFetches
]);

const [game, characters, variables, ...scenes] = results;

// Populate Data.scenes
Data.scenes = {};
scenes.forEach(({ id, data }) => {
  Data.scenes[id] = data;
});
```

**Testing:**
- Add a new scene to `data/scenes/`
- Add its ID to `data/game.json`'s `scenes` array
- Refresh game — scene should load without editing BootScene.js

**Gotchas:**
- If a scene file is missing, the entire boot fails. Should we catch individual fetch errors and continue? Or fail fast?
- Current behavior: fail fast (better for development). Could add a `try/catch` per scene and log warnings.

---

## Task 2: Compound Conditions (AND/OR)

**Problem:** Can only check one variable at a time: `courage >= 50`. Need `courage >= 50 AND has_key == true`.

**Solution:** Extend `VariableSystem.evaluate()` to parse compound conditions.

**Files:**
- Modify: `src/systems/VariableSystem.js` — enhance `evaluate()` method
- Modify: `tests/systems/VariableSystem.test.js` — add tests for compound conditions

**Implementation:**

```js
evaluate(condition) {
  if (!condition || condition.trim() === '') return true;
  
  const trimmed = condition.trim();
  
  // Check for AND/OR operators
  if (trimmed.includes(' AND ')) {
    const parts = trimmed.split(' AND ').map(p => p.trim());
    return parts.every(part => this.evaluate(part));
  }
  
  if (trimmed.includes(' OR ')) {
    const parts = trimmed.split(' OR ').map(p => p.trim());
    return parts.some(part => this.evaluate(part));
  }
  
  // Existing single-condition logic
  const match = trimmed.match(/^(\w+)\s*(==|!=|>=|<=|>|<|=)\s*(.+)$/);
  if (!match) return false;
  
  // ... rest of existing logic
}
```

**Syntax:**
- `courage >= 50 AND has_key == true`
- `courage >= 50 OR has_key == true`
- `(courage >= 50 AND has_key == true) OR is_hero == true` (nested with parens)

**Testing:**
- Unit tests for AND, OR, nested conditions
- Integration test: create a scene with compound conditions, verify branching

**Gotchas:**
- Operator precedence: AND before OR (standard logic)
- Parentheses for grouping
- Should we support NOT? Probably not for now — keep it simple

---

## Task 3: Background Image Support

**Problem:** Scenes only have a procedural gradient background. VNs need actual background images.

**Solution:** Add `background` field to scene JSON. Load image from `public/assets/backgrounds/`.

**Files:**
- Modify: `src/scenes/GameScene.js` — `_drawBackground()` should check for image
- Modify: `data/scenes/sample.json` — add `background: "city_night"` example
- Create: `public/assets/backgrounds/` — directory for background images
- Modify: `src/scenes/BootScene.js` — preload background images

**Implementation:**

```js
// BootScene.preload() — preload all backgrounds
const bgIds = Object.values(Data.scenes).map(s => s.background).filter(Boolean);
bgIds.forEach(id => {
  this.load.image(`bg_${id}`, `/assets/backgrounds/${id}.png`);
});

// GameScene._drawBackground(key) — replace gradient with image
_drawBackground(key) {
  this.bg.clear();
  
  if (key && this.textures.exists(`bg_${key}`)) {
    // Show background image
    if (!this.bgSprite) {
      this.bgSprite = this.add.image(400, 300, `bg_${key}`);
    } else {
      this.bgSprite.setTexture(`bg_${key}`);
    }
  } else {
    // Fallback to gradient
    if (this.bgSprite) {
      this.bgSprite.destroy();
      this.bgSprite = null;
    }
    // ... existing gradient code
  }
}
```

**Data Schema:**
```json
{
  "id": "scene_id",
  "background": "city_night",  // loads /assets/backgrounds/city_night.png
  "nodes": [...]
}
```

**Testing:**
- Add a background image to `public/assets/backgrounds/`
- Set `background: "city_night"` in a scene
- Verify image displays correctly

**Gotchas:**
- Image sizing: should scale to fit 800x600
- Transition between backgrounds: fade or instant?
- Missing image: fallback to gradient (graceful)

---

## Task 4: Multi-Character Positioning

**Problem:** Can only show one character at center. VNs show 2-3 characters (left, center, right).

**Solution:** Extend dialogue nodes with `position` field. CharacterSystem already supports positions.

**Files:**
- Modify: `src/systems/SceneController.js` — pass `position` to onDialogue callback
- Modify: `src/scenes/GameScene.js` — use position when showing character
- Modify: `data/scenes/sample.json` — add position examples

**Implementation:**

```js
// SceneController.showDialogue() — include position
showDialogue(node) {
  if (this.onDialogue) {
    this.onDialogue({
      speaker: node.speaker,
      text: node.text,
      expression: node.expression || null,
      position: node.position || 'center',  // NEW
      autoAdvance: node.autoAdvance || false,
      waitTime: node.waitTime || 0
    });
  }
  // ...
}

// GameScene._wireSceneController() — use position
ctrl.onDialogue = (data) => {
  if (data.speaker) {
    this.characters.show(data.speaker, data.expression || 'neutral', data.position);
  }
  // ...
};
```

**Data Schema:**
```json
{
  "id": "dialogue_node",
  "type": "dialogue",
  "speaker": "hero",
  "text": "Hello!",
  "position": "left",  // NEW: left, center-left, center, center-right, right
  "next": "next_node"
}
```

**Testing:**
- Create a scene with 2-3 characters at different positions
- Verify all characters display simultaneously

**Gotchas:**
- CharacterSystem already has `_getPositionX()` for left/center/right
- Should characters fade out when not speaking? Or stay on screen?
- Multiple characters speaking in sequence: should previous character disappear?

---

## Task 5: Menu System (Title Screen, Restart, Return to Menu)

**Problem:** No way to restart a scene or return to a title screen. Stuck after end node.

**Solution:** Add a `MenuScene` that appears on game start. Add "restart" and "return to menu" buttons.

**Files:**
- Create: `src/scenes/MenuScene.js` — title screen with "Start Game" button
- Modify: `src/main.js` — add MenuScene to scene list
- Modify: `src/scenes/GameScene.js` — add "return to menu" button, restart button
- Modify: `data/game.json` — add `title` field for menu display

**Implementation:**

```js
// MenuScene.js
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const title = Data.game?.title || 'Untitled';
    this.add.text(400, 200, title, {
      fontSize: '48px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0.5);

    const startBtn = this.add.text(400, 350, 'Start Game', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#00ccff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }
}

// main.js — add MenuScene
const config = {
  // ...
  scene: [BootScene, MenuScene, GameScene]
};

// BootScene — transition to MenuScene instead of GameScene
this.scene.start('MenuScene');
```

**Testing:**
- Game starts at menu
- Click "Start Game" → loads GameScene
- Add a "return to menu" button in GameScene → returns to MenuScene

**Gotchas:**
- Should menu have "Continue" (load last save)?
- Should menu have "Settings"?
- Menu background: use a default or allow customization?

---

## Task 6: Settings UI

**Problem:** No way to adjust text speed, volume, fullscreen. All hardcoded.

**Solution:** Add a Settings overlay accessible from menu and in-game.

**Files:**
- Create: `src/systems/SettingsSystem.js` — manages settings state, persists to localStorage
- Create: `src/ui/SettingsOverlay.js` — UI for settings (Phaser text/buttons)
- Modify: `src/scenes/MenuScene.js` — add "Settings" button
- Modify: `src/scenes/GameScene.js` — add "Settings" button (pause menu)
- Modify: `src/systems/DialogueSystem.js` — use settings.textSpeed
- Modify: `src/systems/AudioSystem.js` — use settings.bgmVolume, settings.sfxVolume

**Data Schema:**
```json
// localStorage key: "narrative_settings"
{
  "textSpeed": 40,        // ms per character
  "bgmVolume": 0.7,       // 0.0 - 1.0
  "sfxVolume": 1.0,       // 0.0 - 1.0
  "fullscreen": false
}
```

**Implementation:**

```js
// SettingsSystem.js
export const Settings = {
  textSpeed: 40,
  bgmVolume: 0.7,
  sfxVolume: 1.0,
  fullscreen: false,

  load() {
    const raw = localStorage.getItem('narrative_settings');
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(this, saved);
    }
  },

  save() {
    localStorage.setItem('narrative_settings', JSON.stringify({
      textSpeed: this.textSpeed,
      bgmVolume: this.bgmVolume,
      sfxVolume: this.sfxVolume,
      fullscreen: this.fullscreen
    }));
  }
};

// SettingsOverlay.js — simple UI with +/- buttons
// ... (Phaser text objects for labels, buttons for adjust)
```

**Testing:**
- Adjust text speed → verify typewriter speed changes
- Adjust volume → verify BGM/SFX volume changes
- Toggle fullscreen → verify game goes fullscreen
- Settings persist across page reload

**Gotchas:**
- Settings overlay should pause the game (disable input)
- Should settings be accessible via a hotkey (e.g., Escape)?

---

## Task 7: Dialogue History (Scrollback)

**Problem:** Can't re-read past dialogue. Players want to scroll back.

**Solution:** Store dialogue history in DialogueSystem. Add a "history" overlay (press H or click button).

**Files:**
- Modify: `src/systems/DialogueSystem.js` — store history array, add `showHistory()` method
- Create: `src/ui/HistoryOverlay.js` — scrollable list of past dialogue
- Modify: `src/scenes/GameScene.js` — add hotkey (H) to toggle history

**Implementation:**

```js
// DialogueSystem.js
constructor(scene) {
  // ...
  this.history = [];  // [{ speaker, text, timestamp }]
}

showDialogue(speakerId, text, expression, onComplete) {
  // ... existing code
  
  // Add to history
  this.history.push({
    speaker: speakerId,
    text: text,
    timestamp: Date.now()
  });
}

showHistory() {
  // Create overlay with scrollable list
  // ...
}
```

**Testing:**
- Play through dialogue
- Press H → history overlay appears with all past lines
- Scroll through history
- Close overlay → game resumes

**Gotchas:**
- History should be limited (e.g., last 100 lines) to avoid memory issues
- Should history persist across saves? Probably not — just current session

---

## Task 8: Skip/Auto Modes

**Problem:** No way to fast-forward or auto-advance. Players want to skip seen text.

**Solution:** Add "skip" (fast-forward) and "auto" (auto-advance) modes.

**Files:**
- Modify: `src/systems/DialogueSystem.js` — add skip/auto state, adjust typewriter speed
- Modify: `src/scenes/GameScene.js` — add hotkeys (S for skip, A for auto)

**Implementation:**

```js
// DialogueSystem.js
constructor(scene) {
  // ...
  this.skipMode = false;
  this.autoMode = false;
}

setSkipMode(enabled) {
  this.skipMode = enabled;
  if (enabled) {
    this.textSpeed = 5;  // very fast
  } else {
    this.textSpeed = Data.getDefaultTextSpeed();
  }
}

setAutoMode(enabled) {
  this.autoMode = enabled;
}

// In showDialogue() — if autoMode, set autoAdvance
if (this.autoMode) {
  // Auto-advance after text finishes
  this._autoAdvanceTimer = this.scene.time.delayedCall(2000, () => {
    // Trigger advance
  });
}
```

**Testing:**
- Press S → skip mode (text types very fast)
- Press A → auto mode (text auto-advances)
- Press S/A again to toggle off

**Gotchas:**
- Skip mode: should it skip choices? Or pause at choices?
- Auto mode: how long to wait before advancing? Configurable?
- Should skip/auto be indicated visually (icon in corner)?

---

## Task 9: Quick Save + Auto-Save

**Problem:** Only manual save slots. Players expect F5/F9 quick save/load. Auto-save on scene transitions.

**Solution:** Add quick save (slot 0) and auto-save (slot 9). Add hotkeys.

**Files:**
- Modify: `src/scenes/GameScene.js` — add F5 (quick save), F9 (quick load), auto-save on scene transition
- Modify: `src/systems/SaveSystem.js` — add `quickSave()`, `quickLoad()`, `autoSave()` methods

**Implementation:**

```js
// SaveSystem.js
quickSave() {
  return this.save(0);  // slot 0 = quick save
}

quickLoad() {
  return this.load(0);
}

autoSave() {
  return this.save(9);  // slot 9 = auto save
}

// GameScene.js
_setupInput() {
  // ... existing hotkeys
  
  this.input.keyboard.on('keydown-F5', () => {
    this.saveSys.quickSave();
    // Show "Quick Saved" toast
  });
  
  this.input.keyboard.on('keydown-F9', () => {
    const loaded = this.saveSys.quickLoad();
    if (loaded) {
      this.sceneCtrl.startScene(loaded.sceneId);
    }
  });
}

// Auto-save on scene transition
ctrl.onSceneStart = (data) => {
  this.saveSys.autoSave();
  // ... existing code
};
```

**Testing:**
- Press F5 → quick save (slot 0)
- Press F9 → quick load (restores from slot 0)
- Scene transition → auto-save (slot 9)
- Verify quick save/load works correctly

**Gotchas:**
- Quick save should overwrite without confirmation
- Auto-save should be silent (no toast)
- Should auto-save be configurable (on/off)?

---

## Summary

| Task | Priority | Complexity | Dependencies |
|------|----------|------------|--------------|
| Dynamic scene loading | HIGH | Low | None |
| Compound conditions | HIGH | Medium | None |
| Background images | HIGH | Medium | None |
| Multi-character positioning | HIGH | Low | None |
| Menu system | MEDIUM | Medium | Dynamic loading |
| Settings UI | MEDIUM | Medium | None |
| Dialogue history | MEDIUM | Low | None |
| Skip/auto modes | MEDIUM | Low | None |
| Quick save + auto-save | MEDIUM | Low | None |

**Total:** 4 high-priority + 5 medium-priority tasks

**Nice-to-have (deferred):**
- Timed choices
- Jump-to-scene node
- Random node
- Voice acting support
- Gallery/unlockables system
- Text input node
- Music fade in/out
- Scene tags/labels
- Node comments
- Subroutine/macro nodes
- Variable increment in choices
