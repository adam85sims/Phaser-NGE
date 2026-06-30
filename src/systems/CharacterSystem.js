import { Data } from './DataLoader.js';

/**
 * CharacterSystem — manages character portrait display,
 * expression switching, and screen positioning.
 *
 * Characters are rendered as positioned sprites on a
 * dedicated depth layer, behind the dialogue box.
 */
export class CharacterSystem {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(50);
    this.portraits = {};  // { characterId: Phaser.GameObjects.Image }
  }

  /**
   * Show a character portrait on screen.
   * Positions: 'left' (x=160), 'center' (x=400), 'right' (x=640)
   * zIndex controls draw order within the portrait layer (higher = on top)
   */
  show(characterId, expression, position, zIndex = 0) {
    const charData = Data.getCharacter(characterId);
    if (!charData || charData.invisible) return;

    // Resolve expression → portrait texture key
    let texKey = null;
    const expr = expression || 'neutral';
    if (charData.portraits) {
      texKey = charData.portraits[expr]
            || charData.portraits.neutral
            || Object.values(charData.portraits)[0];
    }
    if (!texKey) {
      console.warn(`[CharacterSystem] No portrait for ${characterId}/${expr}`);
      return;
    }
    if (!this.scene.textures.exists(texKey)) {
      console.warn(`[CharacterSystem] Texture '${texKey}' not loaded for ${characterId}`);
      return;
    }

    const x = this._getPositionX(position || 'center');
    const scale = charData.scale ?? Data.theme?.portraits?.scale ?? 1;
    const baseY = Data.theme?.portraits?.baseY ?? 0.5;
    const y = this.scene.scale.height * baseY;

    const oldImg = this.portraits[characterId];
    const isSamePosition = oldImg && oldImg.x === x;

    const img = this.scene.add.image(x, y, texKey).setScale(scale);
    img.zIndex = zIndex;
    this.container.add(img);
    this.container.sort('zIndex');
    this.portraits[characterId] = img;

    if (oldImg) {
      if (isSamePosition) {
        // Cross-fade expression
        img.setAlpha(0);
        this.scene.tweens.add({
          targets: img,
          alpha: 1,
          duration: 200,
          onComplete: () => oldImg.destroy()
        });
      } else {
        // Different position, fade old out, slide new in
        this.scene.tweens.add({
          targets: oldImg,
          alpha: 0,
          duration: 150,
          onComplete: () => oldImg.destroy()
        });
        this._slideIn(img, position || 'center', x, scale);
      }
    } else {
      // Fresh appearance, slide in
      this._slideIn(img, position || 'center', x, scale);
    }
  }

  _slideIn(img, position, targetX, targetScale) {
    img.setAlpha(0);
    const W = this.scene.scale.width;
    
    // Start off-screen based on position
    if (position === 'left' || position === 'center-left') {
      img.x = -img.width * targetScale;
    } else if (position === 'right' || position === 'center-right') {
      img.x = W + img.width * targetScale;
    } else {
      // Center comes from bottom
      img.y += 100;
    }

    this.scene.tweens.add({
      targets: img,
      alpha: 1,
      x: targetX,
      y: img.y - (position === 'center' ? 100 : 0),
      duration: 300,
      ease: 'Power2'
    });
  }

  /** Hide a specific character */
  hide(characterId) {
    if (this.portraits[characterId]) {
      const img = this.portraits[characterId];
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          img.destroy();
          delete this.portraits[characterId];
        }
      });
    }
  }

  /** Hide all characters */
  hideAll() {
    Object.keys(this.portraits).forEach(id => this.hide(id));
  }

  /** Generate a colored circle as a placeholder portrait */
  _generatePlaceholder(characterId, expression, color, key) {
    const size = 64;

    const canvas = this.scene.textures.createCanvas(key, size, size);
    const ctx = canvas.context;

    // Background circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();

    // Simple face features
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 24, 6, 6);   // left eye
    ctx.fillRect(38, 24, 6, 6);   // right eye

    // Mouth varies by expression
    ctx.fillStyle = '#000000';
    ctx.fillRect(26, 42, 12, 3);  // neutral mouth

    canvas.refresh();
  }

  _getPositionX(position) {
    const W = this.scene.scale.width;
    const map = { left: W * 0.2, 'center-left': W * 0.35, center: W * 0.5, 'center-right': W * 0.65, right: W * 0.8 };
    return map[position] || (W * 0.5);
  }

  /** Clean up all portraits */
  destroy() {
    Object.values(this.portraits).forEach(img => img.destroy());
    this.portraits = {};
    this.container.destroy();
  }
}
