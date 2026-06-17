export class TransitionSystem {
  /**
   * Run a scene transition using cameras or shaders.
   * Options:
   * - type: 'fade' | 'slide' | 'wipe' | 'crossfade' | 'pixelate'
   * - duration: ms
   * - color: hex for fade
   */
  static runTransition(scene, type, duration, onComplete, onMidpoint) {
    if (!type || type === 'fade') {
      this._fadeTransition(scene, duration, 0x000000, onComplete, onMidpoint);
      return;
    }

    switch (type) {
      case 'white_fade':
        this._fadeTransition(scene, duration, 0xffffff, onComplete, onMidpoint);
        break;
      case 'slide_left':
      case 'slide_right':
        this._slideTransition(scene, type, duration, onComplete, onMidpoint);
        break;
      default:
        this._fadeTransition(scene, duration, 0x000000, onComplete, onMidpoint);
        break;
    }
  }

  static _fadeTransition(scene, duration = 800, color = 0x000000, onComplete, onMidpoint) {
    const half = duration / 2;
    const r = (color >> 16) & 255;
    const g = (color >> 8) & 255;
    const b = color & 255;

    scene.cameras.main.fadeOut(half, r, g, b);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      if (onMidpoint) onMidpoint();
      scene.cameras.main.fadeIn(half, r, g, b);
      scene.cameras.main.once('camerafadeincomplete', () => {
        if (onComplete) onComplete();
      });
    });
  }

  static _slideTransition(scene, type, duration = 800, onComplete, onMidpoint) {
    const half = duration / 2;
    const W = scene.scale.width;
    
    // Create a colored block that slides across the screen
    const rect = scene.add.graphics();
    rect.fillStyle(0x000000, 1);
    rect.fillRect(0, 0, W, scene.scale.height);
    rect.setDepth(1000);
    
    const startX = type === 'slide_left' ? W : -W;
    const midX = 0;
    const endX = type === 'slide_left' ? -W : W;

    rect.x = startX;

    scene.tweens.add({
      targets: rect,
      x: midX,
      duration: half,
      ease: 'Power2',
      onComplete: () => {
        if (onMidpoint) onMidpoint();
        scene.tweens.add({
          targets: rect,
          x: endX,
          duration: half,
          ease: 'Power2',
          onComplete: () => {
            rect.destroy();
            if (onComplete) onComplete();
          }
        });
      }
    });
  }
}
