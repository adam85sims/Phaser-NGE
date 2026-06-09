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
    if (!charData) return;

    // Hide existing portrait for this character if present
    if (this.portraits[characterId]) {
      this.portraits[characterId].destroy();
    }

    // Check if we have a portrait texture loaded
    // If not, generate a colored placeholder
    const texKey = `portrait_${characterId}_${expression || 'neutral'}`;
    if (!this.scene.textures.exists(texKey)) {
      this._generatePlaceholder(characterId, expression || 'neutral', charData.color || '#ffffff');
    }

    const x = this._getPositionX(position || 'center');
    const img = this.scene.add.image(x, this.scene.scale.height * 0.5, texKey).setScale(2);
    img.zIndex = zIndex;
    this.container.add(img);
    this.container.sort('zIndex');
    this.portraits[characterId] = img;

    // Fade in
    img.setAlpha(0);
    this.scene.tweens.add({
      targets: img,
      alpha: 1,
      duration: 200
    });
  }

  /** Hide a specific character */
  hide(characterId) {
    if (this.portraits[characterId]) {
      const img = this.portraits[characterId];
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: 150,
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
  _generatePlaceholder(characterId, expression, color) {
    const key = `portrait_${characterId}_${expression}`;
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
