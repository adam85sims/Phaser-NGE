import { Data } from './DataLoader.js';
import { Settings } from './SettingsSystem.js';
import { parseRichText, renderRichTextUpTo } from './RichTextHelper.js';

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
    this.container = scene.add.container(0, 0).setDepth(100).setScrollFactor(0);

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
    const theme = Data.theme?.dialogue || {};

    // Text box background (procedural)
    this.bg = this.scene.add.graphics();
    this._drawTextBox();
    this.container.add(this.bg);

    // Nameplate label
    this.nameplate = this.scene.add.text(x + paddingX, y - nameplateHeight + 4, '', {
      fontSize: theme.nameplateSize ? `${theme.nameplateSize}px` : '14px',
      fontFamily: theme.nameplateFont ?? 'monospace',
      color: '#ffffff',
      backgroundColor: theme.nameplateColor ?? '#222244',
      padding: { x: 8, y: 4 }
    });
    this.container.add(this.nameplate);

    // Dialogue text using DOM for Rich Text
    this.textDOM = this.scene.add.dom(x + paddingX, y + paddingY, 'div');
    this.textDOM.setOrigin(0, 0);
    this.textDOM.setScrollFactor(0);
    this.textDOM.node.style.width = `${w - paddingX * 2}px`;
    this.textDOM.node.style.height = `${h - paddingY * 2}px`;
    this.textDOM.node.style.fontFamily = this.textStyle.fontFamily;
    this.textDOM.node.style.fontSize = this.textStyle.fontSize;
    this.textDOM.node.style.color = this.textStyle.color;
    this.textDOM.node.style.lineHeight = '1.4';
    this.textDOM.node.style.overflow = 'hidden';
    this.textDOM.node.style.pointerEvents = 'none';
    // Do NOT add to container, as nested DOMElements break under CSS scale transforms
    // this.container.add(this.textDOM);

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
    this.container.setAlpha(0);
    this.container.setVisible(false);
    this.textDOM.setAlpha(0);
    this.textDOM.setVisible(false);
  }

  _drawTextBox() {
    const { x, y, w, h } = this.box;
    const g = this.bg;
    g.clear();

    // Parse theme background color (supports #RRGGBB or #RRGGBBAA)
    const theme = Data.theme?.dialogue || {};
    const bgColorStr = theme.backgroundColor || '#0a0a1a';
    const hexPart = bgColorStr.slice(1, 7);
    const alphaPart = bgColorStr.length === 9 ? parseInt(bgColorStr.slice(7, 9), 16) / 255 : 0.92;
    const bgColor = parseInt(hexPart, 16) || 0x0a0a1a;

    const borderColorStr = theme.borderColor || '#335588';
    const borderColor = parseInt(borderColorStr.slice(1, 7), 16) || 0x335588;
    const borderRadius = theme.borderRadius ?? 8;

    // Shadow
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(x + 3, y + 3, w, h, borderRadius);

    // Main panel
    g.fillStyle(bgColor, alphaPart);
    g.fillRoundedRect(x, y, w, h, borderRadius);

    // Border
    g.lineStyle(2, borderColor, 0.8);
    g.strokeRoundedRect(x, y, w, h, borderRadius);
  }

  /* ── Public API ────────────────────────────── */

  setVisible(visible) {
    const theme = Data.theme?.dialogue || {};
    const duration = theme.transitionDuration ?? 0;

    if (duration > 0) {
      if (visible && (!this.container.visible || this.container.alpha === 0)) {
        this.container.setAlpha(0);
        this.container.setVisible(true);
        this.textDOM.setAlpha(0);
        this.textDOM.setVisible(true);
        this.scene.tweens.add({
          targets: [this.container, this.textDOM],
          alpha: 1,
          duration: duration
        });
      } else if (!visible && this.container.visible) {
        this.scene.tweens.add({
          targets: [this.container, this.textDOM],
          alpha: 0,
          duration: duration,
          onComplete: () => {
            this.container.setVisible(false);
            this.textDOM.setVisible(false);
          }
        });
      }
    } else {
      this.container.setAlpha(1);
      this.container.setVisible(visible);
      this.textDOM.setAlpha(1);
      this.textDOM.setVisible(visible);
    }
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

    // Parse tags and prepare tokens
    const parsed = parseRichText(text || '');
    this._tokens = parsed.tokens;
    this._tags = parsed.engineTags;
    this._totalChars = parsed.totalChars;

    // Start typewriter
    this._charIndex = 0;
    this._isTyping = true;
    this.continueArrow.setAlpha(0);
    this.hideChoices();

    // Clear and start
    this.textDOM.node.innerHTML = '';
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
          if (this.scene.layers?.layers?.[tag.target]) targetObj = this.scene.layers.layers[tag.target];
          else if (this.scene.characters?.portraits?.[tag.target]) targetObj = this.scene.characters.portraits[tag.target];
          
          if (targetObj) {
            const animData = Data.animations?.[tag.animKey];
            if (animData) {
              import('./AnimationRunner.js').then(({ AnimationRunner }) => {
                AnimationRunner.play(this.scene, targetObj, animData);
              });
            }
          }
        }
      }
    }

    if (this._charIndex >= this._totalChars) {
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
    this.textDOM.node.innerHTML = renderRichTextUpTo(this._tokens, this._charIndex);

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

    this._charIndex = this._totalChars;
    this.textDOM.node.innerHTML = renderRichTextUpTo(this._tokens, this._totalChars);
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
      choiceText.on('pointerup', () => {
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
      fontSize: '24px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 0);
    container.add(title);

    // Scrolling Area
    const margin = 80;
    const scrollY = 80;
    const scrollHeight = H - 160;
    
    const maskGraphics = this.scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillRect(margin, scrollY, W - margin * 2, scrollHeight);
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, maskGraphics);
    
    const scrollContainer = this.scene.add.container(0, scrollY);
    scrollContainer.setMask(mask);
    container.add(scrollContainer);

    // Build history content (top-to-bottom)
    let currentY = 0;
    for (const entry of this.history) {
      const speakerName = entry.speaker ? Data.getCharacter(entry.speaker)?.name || entry.speaker : 'Narrator';
      const color = entry.speaker ? Data.getCharacter(entry.speaker)?.color || '#cccccc' : '#8888aa';
      
      const nameText = this.scene.add.text(margin, currentY, speakerName, {
        fontSize: '16px', fontFamily: 'monospace', color: color, fontStyle: 'bold'
      });
      scrollContainer.add(nameText);
      currentY += nameText.height + 4;

      const bodyText = this.scene.add.text(margin + 20, currentY, entry.text || '', {
        fontSize: '18px', fontFamily: 'monospace', color: '#e0e0e0',
        wordWrap: { width: W - margin * 2 - 40 },
        lineSpacing: 6
      });
      scrollContainer.add(bodyText);
      currentY += bodyText.height + 16;
      
      // Separator
      const sep = this.scene.add.graphics();
      sep.lineStyle(1, 0xffffff, 0.1);
      sep.beginPath();
      sep.moveTo(margin + 20, currentY);
      sep.lineTo(W - margin - 20, currentY);
      sep.strokePath();
      scrollContainer.add(sep);
      
      currentY += 16;
    }

    // Scroll logic
    let scrollOffset = 0;
    const maxScroll = Math.max(0, currentY - scrollHeight);
    
    // Start scrolled to bottom
    scrollOffset = -maxScroll;
    scrollContainer.y = scrollY + scrollOffset;

    const updateScroll = (dy) => {
      scrollOffset -= dy;
      scrollOffset = Phaser.Math.Clamp(scrollOffset, -maxScroll, 0);
      scrollContainer.y = scrollY + scrollOffset;
    };

    // Mouse wheel
    this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      if (this._historyContainer) updateScroll(deltaY);
    });

    // Drag scroll
    let isDragging = false;
    let lastDragY = 0;
    
    // We make a hit area over the scrollable region
    const hitArea = this.scene.add.zone(W/2, scrollY + scrollHeight/2, W, scrollHeight).setInteractive();
    container.add(hitArea);

    hitArea.on('pointerdown', (pointer) => {
      isDragging = true;
      lastDragY = pointer.y;
    });
    this.scene.input.on('pointerup', () => { isDragging = false; });
    this.scene.input.on('pointermove', (pointer) => {
      if (!isDragging || !this._historyContainer) return;
      const dy = pointer.y - lastDragY;
      updateScroll(-dy);
      lastDragY = pointer.y;
    });

    // Close hint
    const hint = this.scene.add.text(W / 2, H - 30, 'Press H or click outside to close', {
      fontSize: '14px', fontFamily: 'monospace', color: '#666688',
    }).setOrigin(0.5);
    container.add(hint);

    // Click anywhere outside hit area to close
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', (pointer) => {
      if (pointer.y < scrollY || pointer.y > scrollY + scrollHeight) {
        this.hideHistory();
      }
    });

    this._historyContainer = container;

    this.scene.input.keyboard.on('keydown-H', () => {
      this.hideHistory();
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
    if (this.textDOM) this.textDOM.destroy();
  }
}
