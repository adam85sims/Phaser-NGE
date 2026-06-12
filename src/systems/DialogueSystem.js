import { Data } from './DataLoader.js';
import { Settings } from './SettingsSystem.js';

/**
 * DialogueSystem — renders text boxes, typewriter effect,
 * speaker nameplates, and choice lists onto a Phaser scene.
 *
 * All coordinates are relative to a configurable text box area.
 */
export class DialogueSystem {
  constructor(scene) {
    this.scene = scene;

    // Layout (configurable via theme.json)
    const theme = Data.theme?.dialogue || {};
    this.box = {
      x: theme.textBoxPosition?.x ?? 40,
      y: theme.textBoxPosition?.y ?? 420,
      w: theme.textBoxSize?.width ?? 720,
      h: theme.textBoxSize?.height ?? 150,
      paddingX: theme.padding?.x ?? 16,
      paddingY: theme.padding?.y ?? 16,
      nameplateHeight: theme.nameplateHeight ?? 30
    };

    // Container for all dialogue UI elements
    this.container = scene.add.container(0, 0).setDepth(100);

    // Styling from theme
    this.textStyle = {
      fontSize: theme.fontSize ? `${theme.fontSize}px` : '16px',
      fontFamily: theme.fontFamily ?? 'monospace',
      color: theme.textColor ?? '#e0e0e0',
      wordWrap: { width: this.box.w - this.box.paddingX * 2 },
      lineSpacing: theme.lineSpacing ?? 6
    };

    this.textSpeed = theme.textSpeed ?? Settings.textSpeed;

    // Typewriter state
    this._fullText = '';
    this._displayedText = '';
    this._charIndex = 0;
    this._timer = null;
    this._isTyping = false;
    this._callback = null;  // called when typewriter finishes or is skipped

    // ── Dialogue history ──
    this.history = [];      // [{ speaker, text }]

    // ── Skip mode ──
    this.skipMode = false;

    // ── Auto mode ──
    this.autoMode = false;
    this._autoModeTimer = null;

    // Build the UI
    this._buildUI();
  }

  /* ── Build the text box ─────────────────────── */

  _buildUI() {
    const { x, y, w, h, paddingX, paddingY, nameplateHeight } = this.box;

    // Text box background (procedural)
    this.bg = this.scene.add.graphics();
    this._drawTextBox();
    this.container.add(this.bg);

    // Nameplate label
    this.nameplate = this.scene.add.text(x + paddingX, y - nameplateHeight + 4, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 8, y: 4 }
    });
    this.container.add(this.nameplate);

    // Dialogue text
    this.text = this.scene.add.text(x + paddingX, y + paddingY, '', this.textStyle);
    this.container.add(this.text);

    // Continue indicator (blinking arrow)
    this.continueArrow = this.scene.add.text(
      x + w - paddingX, y + h - paddingY, '▼', {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: '#00ccff'
      }
    ).setOrigin(1, 1).setAlpha(0);
    this.container.add(this.continueArrow);

    // Choice container (hidden by default)
    this.choices = [];
    this.choiceContainer = this.scene.add.container(0, 0).setVisible(false);
    this.container.add(this.choiceContainer);

    // Initially hidden
    this.setVisible(false);
  }

  _drawTextBox() {
    const { x, y, w, h } = this.box;
    const g = this.bg;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x + 3, y + 3, w, h, 8);

    // Main panel
    g.fillStyle(0x0a0a1a, 0.92);
    g.fillRoundedRect(x, y, w, h, 8);

    // Border
    g.lineStyle(2, 0x335588, 0.8);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  /* ── Public API ────────────────────────────── */

  setVisible(visible) {
    this.container.setVisible(visible);
  }

  /**
   * Begin displaying a dialogue line.
   * Calls onComplete when the player advances past it.
   */
  showDialogue(speakerId, text, expression, onComplete) {
    this.setVisible(true);
    this._callback = onComplete;

    // Record history
    this.history.push({ speaker: speakerId, text: text });

    // Nameplate
    const charData = Data.getCharacter(speakerId);
    if (charData && charData.name) {
      this.nameplate.setText(charData.name);
      this.nameplate.setStyle({ color: charData.color || '#ffffff' });
      this.nameplate.setVisible(true);
    } else {
      this.nameplate.setVisible(false);
    }

    // Extract tags
    this._tags = [];
    let cleanText = '';
    let match;
    const regex = /\[(show|hide|anim):([^\]]+)\]/gi;
    let lastIdx = 0;
    const strText = text || '';
    
    while ((match = regex.exec(strText)) !== null) {
      cleanText += strText.slice(lastIdx, match.index);
      
      const action = match[1].toLowerCase();
      let target = match[2].trim();
      let animKey = null;
      
      if (action === 'anim') {
        const parts = target.split(':');
        if (parts.length >= 2) {
          target = parts[0].trim();
          animKey = parts[1].trim();
        }
      }

      this._tags.push({
        index: cleanText.length,
        action: action,
        target: target,
        animKey: animKey
      });
      lastIdx = regex.lastIndex;
    }
    cleanText += strText.slice(lastIdx);

    // Start typewriter
    this._fullText = cleanText;
    this._displayedText = '';
    this._charIndex = 0;
    this._isTyping = true;
    this.continueArrow.setAlpha(0);
    this.hideChoices();

    // Clear and start
    this.text.setText('');
    this._typeNextChar();
  }

  _typeNextChar() {
    // Check if any tags trigger at the current charIndex
    while (this._tags.length > 0 && this._tags[0].index === this._charIndex) {
      const tag = this._tags.shift();
      if (this.scene) {
        if (tag.action === 'show' && this.scene.layers) this.scene.layers.showLayerByAsset(tag.target, 300);
        else if (tag.action === 'hide' && this.scene.layers) this.scene.layers.hideLayerByAsset(tag.target, 300);
        else if (tag.action === 'anim' && tag.target && tag.animKey) {
          // Play inline animation
          let targetObj = null;
          if (this.scene.layers?.layers?.has(tag.target)) targetObj = this.scene.layers.layers.get(tag.target).image;
          else if (this.scene.characters?.activeSprites?.has(tag.target)) targetObj = this.scene.characters.activeSprites.get(tag.target);
          
          if (targetObj && this.scene.sys.game.scene.keys.BootScene.Data?.animations) {
            const animData = this.scene.sys.game.scene.keys.BootScene.Data.animations[tag.animKey];
            if (animData) {
              import('./AnimationRunner.js').then(({ AnimationRunner }) => {
                AnimationRunner.play(this.scene, targetObj, animData);
              });
            }
          }
        }
      }
    }

    if (this._charIndex >= this._fullText.length) {
      this._isTyping = false;
      this.continueArrow.setAlpha(1);
      // Blink the arrow
      if (this._arrowTween) this._arrowTween.destroy();
      this._arrowTween = this.scene.tweens.add({
        targets: this.continueArrow,
        alpha: 0.2,
        duration: 600,
        yoyo: true,
        repeat: -1
      });
      return;
    }

    this._charIndex++;
    this._displayedText = this._fullText.slice(0, this._charIndex);
    this.text.setText(this._displayedText);

    this._timer = this.scene.time.delayedCall(this.textSpeed, () => {
      this._typeNextChar();
    });
  }

  /** Skip the typewriter animation immediately */
  skipToEnd() {
    if (!this._isTyping) return;
    if (this._timer) this._timer.remove();

    // Execute all remaining tags instantly
    while (this._tags.length > 0) {
      const tag = this._tags.shift();
      if (this.scene && this.scene.layers) {
        if (tag.action === 'show') this.scene.layers.showLayerByAsset(tag.target);
        else if (tag.action === 'hide') this.scene.layers.hideLayerByAsset(tag.target);
      }
    }

    this._charIndex = this._fullText.length;
    this._displayedText = this._fullText;
    this.text.setText(this._fullText);
    this._isTyping = false;
    this.continueArrow.setAlpha(1);
    if (this._arrowTween) this._arrowTween.destroy();
    this._arrowTween = this.scene.tweens.add({
      targets: this.continueArrow,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1
    });
  }

  /** Player clicked/advanced past current text */
  advance() {
    if (this._isTyping) {
      this.skipToEnd();
      return true;  // consumed the click to finish typing
    }

    // Remove arrow tween
    if (this._arrowTween) {
      this._arrowTween.destroy();
      this._arrowTween = null;
    }
    this.continueArrow.setAlpha(0);

    // Fire callback
    if (this._callback) {
      const cb = this._callback;
      this._callback = null;
      cb();
    }
    return false;  // click passed through to advance scene
  }

  /* ── Choices ────────────────────────────────── */

  showChoices(prompt, choices, onSelect) {
    this.setVisible(true);

    // Show prompt
    if (prompt) {
      this.nameplate.setText(prompt);
      this.nameplate.setStyle({ color: '#ffd700' });
      this.nameplate.setVisible(true);
    } else {
      this.nameplate.setVisible(false);
    }

    // Hide main text
    this.text.setText('');

    // Build choice buttons
    this.hideChoices();
    const { x, y, w, paddingX, paddingY } = this.box;
    const startY = y + paddingY + 10;

    choices.forEach((c, i) => {
      const label = `[${i + 1}] ${c.text}`;
      const choiceText = this.scene.add.text(x + paddingX, startY + i * 30, label, {
        fontSize: this.textStyle.fontSize,
        fontFamily: this.textStyle.fontFamily,
        color: c.index === 0 ? '#00ccff' : '#aaaaaa'
      });
      choiceText.setInteractive({ useHandCursor: true });
      choiceText.on('pointerover', () => choiceText.setColor('#ffffff'));
      choiceText.on('pointerout', () => choiceText.setColor(c.index === 0 ? '#00ccff' : '#aaaaaa'));
      choiceText.on('pointerdown', () => {
        if (onSelect) onSelect(i);
      });

      this.choiceContainer.add(choiceText);
      this.choices.push(choiceText);
    });

    this.choiceContainer.setVisible(true);
  }

  hideChoices() {
    this.choices.forEach(c => c.destroy());
    this.choices = [];
    this.choiceContainer.removeAll(true);
    this.choiceContainer.setVisible(false);
  }

  /* ── Skip / Auto Modes ─────────────────────────── */

  setSkipMode(enabled) {
    this.skipMode = enabled;
  }

  setAutoMode(enabled) {
    this.autoMode = enabled;
    // If enabling while not typing, schedule auto-advance
    if (enabled && !this._isTyping) {
      this._scheduleAutoAdvance();
    }
  }

  toggleSkip() {
    this.setSkipMode(!this.skipMode);
  }

  toggleAuto() {
    this.setAutoMode(!this.autoMode);
  }

  setTextSpeed(ms) {
    this.textSpeed = ms;
  }

  _scheduleAutoAdvance() {
    this._cancelAutoAdvance();
    if (!this.autoMode) return;
    this._autoModeTimer = this.scene.time.delayedCall(2000, () => {
      // Advance if still in auto mode and not at a choice
      if (this.autoMode && !this._isTyping) {
        // Signal to the game scene to advance
        if (this._callback) {
          const cb = this._callback;
          this._callback = null;
          cb();
        }
      }
    });
  }

  _cancelAutoAdvance() {
    if (this._autoModeTimer) {
      this._autoModeTimer.remove();
      this._autoModeTimer = null;
    }
  }

  /* ── History ──────────────────────────────────── */

  getHistory() {
    return this.history;
  }

  showHistory() {
    if (this._historyContainer) {
      this._historyContainer.destroy();
      this._historyContainer = null;
      return;
    }

    const { x, y, w, h } = this.box;
    const container = this.scene.add.container(0, 0).setDepth(300);

    const W = this.scene.scale.width;
    const H = this.scene.scale.height;

    // Semi-transparent overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, W, H);
    container.add(overlay);

    // Title
    const title = this.scene.add.text(W / 2, 20, 'Dialogue History', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 0);
    container.add(title);

    // History lines (last 50, reversed so newest at bottom)
    const lines = this.history.slice(-50);
    const lineHeight = 22;
    const startY = 60;
    const maxVisible = Math.min(lines.length, 22);

    for (let i = 0; i < maxVisible; i++) {
      const entry = lines[i];
      const speakerName = entry.speaker ? Data.getCharacter(entry.speaker)?.name || entry.speaker : 'Narrator';
      const color = entry.speaker ? Data.getCharacter(entry.speaker)?.color || '#cccccc' : '#666688';
      const label = `${speakerName}: ${entry.text || ''}`;
      // Truncate long lines
      const displayText = label.length > 80 ? label.slice(0, 77) + '...' : label;

      const line = this.scene.add.text(40, startY + i * lineHeight, displayText, {
        fontSize: '12px', fontFamily: 'monospace', color: color,
        wordWrap: { width: W - 80 },
      });
      container.add(line);
    }

    // Close hint
    const hint = this.scene.add.text(W / 2, H - 20, 'Press H or click to close', {
      fontSize: '14px', fontFamily: 'monospace', color: '#666688',
    }).setOrigin(0.5);
    container.add(hint);

    // Click anywhere to close
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => {
      container.destroy();
      this._historyContainer = null;
    });

    this._historyContainer = container;

    // Allow keyboard to close too — wire via scene
    this.scene.input.keyboard.on('keydown-H', () => {
      if (this._historyContainer) {
        this._historyContainer.destroy();
        this._historyContainer = null;
      }
    }, { once: true });
  }

  hideHistory() {
    if (this._historyContainer) {
      this._historyContainer.destroy();
      this._historyContainer = null;
    }
  }

  /* ── Cleanup ───────────────────────────────── */

  destroy() {
    this._cancelAutoAdvance();
    if (this._timer) this._timer.remove();
    if (this._arrowTween) this._arrowTween.destroy();
    this.hideHistory();
    this.container.destroy();
  }
}
