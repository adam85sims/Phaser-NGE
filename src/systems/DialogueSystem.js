import { Data } from './DataLoader.js';

/**
 * DialogueSystem — renders text boxes, typewriter effect,
 * speaker nameplates, and choice lists onto a Phaser scene.
 *
 * All coordinates are relative to a configurable text box area.
 */
export class DialogueSystem {
  constructor(scene) {
    this.scene = scene;

    // Layout (will be configurable via layout tool)
    this.box = {
      x: 40,
      y: 420,
      w: 720,
      h: 150,
      padding: 16,
      nameplateHeight: 30
    };

    // Container for all dialogue UI elements
    this.container = scene.add.container(0, 0).setDepth(100);

    // Text speed (ms between characters)
    this.textSpeed = Data.getDefaultTextSpeed();

    // Typewriter state
    this._fullText = '';
    this._displayedText = '';
    this._charIndex = 0;
    this._timer = null;
    this._isTyping = false;
    this._callback = null;  // called when typewriter finishes or is skipped

    // Build the UI
    this._buildUI();
  }

  /* ── Build the text box ─────────────────────── */

  _buildUI() {
    const { x, y, w, h, padding, nameplateHeight } = this.box;

    // Text box background (procedural)
    this.bg = this.scene.add.graphics();
    this._drawTextBox();
    this.container.add(this.bg);

    // Nameplate label
    this.nameplate = this.scene.add.text(x + padding, y - nameplateHeight + 4, '', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffffff',
      backgroundColor: '#222244',
      padding: { x: 8, y: 4 }
    });
    this.container.add(this.nameplate);

    // Dialogue text
    this.text = this.scene.add.text(x + padding, y + padding, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#e0e0e0',
      wordWrap: { width: w - padding * 2 },
      lineSpacing: 6
    });
    this.container.add(this.text);

    // Continue indicator (blinking arrow)
    this.continueArrow = this.scene.add.text(
      x + w - padding, y + h - padding, '▼', {
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

    // Nameplate
    const charData = Data.getCharacter(speakerId);
    if (charData && charData.name) {
      this.nameplate.setText(charData.name);
      this.nameplate.setStyle({ color: charData.color || '#ffffff' });
      this.nameplate.setVisible(true);
    } else {
      this.nameplate.setVisible(false);
    }

    // Start typewriter
    this._fullText = text || '';
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
    const { x, y, w, padding } = this.box;
    const startY = y + padding + 10;

    choices.forEach((c, i) => {
      const label = `[${i + 1}] ${c.text}`;
      const choiceText = this.scene.add.text(x + padding, startY + i * 30, label, {
        fontSize: '15px',
        fontFamily: 'monospace',
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

  /* ── Cleanup ───────────────────────────────── */

  destroy() {
    if (this._timer) this._timer.remove();
    if (this._arrowTween) this._arrowTween.destroy();
    this.container.destroy();
  }
}
