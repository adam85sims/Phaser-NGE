export class TransitionSystem {
  /**
   * Run a scene transition using cameras or shaders.
   * Options:
   * - type: 'none' | 'fade' | 'white_fade' | 'slide_left' | 'slide_right'
   *         | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down'
   *         | 'crossfade' | 'iris_in' | 'iris_out'
   *         | 'zoom_in' | 'zoom_out' | 'pixelate'
   * - duration: ms
   */
  static runTransition(scene, type, duration, onComplete, onMidpoint) {
    if (type === 'none') {
      if (onMidpoint) onMidpoint();
      if (onComplete) onComplete();
      return;
    }

    // Default to fade if type is missing or unrecognized
    if (!type || type === 'fade') {
      this._fadeTransition(scene, duration, 0x000000, onComplete, onMidpoint);
      return;
    }

    switch (type) {
      case 'white_fade':
        this._fadeTransition(scene, duration, type === 'white_fade' ? 0xffffff : 0x000000, onComplete, onMidpoint);
        break;
      case 'slide_left':
      case 'slide_right':
        this._slideTransition(scene, type, duration, onComplete, onMidpoint);
        break;
      case 'wipe_left':
      case 'wipe_right':
      case 'wipe_up':
      case 'wipe_down':
        this._wipeTransition(scene, type, duration, onComplete, onMidpoint);
        break;
      case 'crossfade':
        this._crossfadeTransition(scene, duration, onComplete, onMidpoint);
        break;
      case 'iris_in':
      case 'iris_out':
        this._irisTransition(scene, type, duration, onComplete, onMidpoint);
        break;
      case 'zoom_in':
      case 'zoom_out':
        this._zoomTransition(scene, type, duration, onComplete, onMidpoint);
        break;
      case 'pixelate':
        this._pixelateTransition(scene, duration, onComplete, onMidpoint);
        break;
      default:
        this._fadeTransition(scene, duration, 0x000000, onComplete, onMidpoint);
        break;
    }
  }

  /** List of available transition types for UI */
  static getAvailableTypes() {
    return [
      { id: 'none', label: 'None' },
      { id: 'fade', label: 'Fade to Black' },
      { id: 'white_fade', label: 'Fade to White' },
      { id: 'slide_left', label: 'Slide Left' },
      { id: 'slide_right', label: 'Slide Right' },
      { id: 'wipe_left', label: 'Wipe Left' },
      { id: 'wipe_right', label: 'Wipe Right' },
      { id: 'wipe_up', label: 'Wipe Up' },
      { id: 'wipe_down', label: 'Wipe Down' },
      { id: 'crossfade', label: 'Crossfade' },
      { id: 'iris_in', label: 'Iris In' },
      { id: 'iris_out', label: 'Iris Out' },
      { id: 'zoom_in', label: 'Zoom In' },
      { id: 'zoom_out', label: 'Zoom Out' },
      { id: 'pixelate', label: 'Pixelate' },
    ];
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

  /** Directional wipe using a moving black rectangle */
  static _wipeTransition(scene, type, duration = 800, onComplete, onMidpoint) {
    const half = duration / 2;
    const W = scene.scale.width;
    const H = scene.scale.height;

    const rect = scene.add.graphics();
    rect.fillStyle(0x000000, 1);
    rect.setDepth(1000);

    // Draw wipe bar (covers half the screen in the wipe direction)
    if (type === 'wipe_left' || type === 'wipe_right') {
      rect.fillRect(0, 0, W / 2, H);
    } else {
      rect.fillRect(0, 0, W, H / 2);
    }

    const isHorizontal = type === 'wipe_left' || type === 'wipe_right';
    const forward = type === 'wipe_left' || type === 'wipe_up';

    // Position off-screen in the direction we're coming from
    if (isHorizontal) {
      rect.x = forward ? W : -W;
    } else {
      rect.y = forward ? H : -H;
    }

    const prop = isHorizontal ? 'x' : 'y';
    const midPos = 0;
    const endPos = isHorizontal ? (forward ? -W : W) : (forward ? -H : H);

    scene.tweens.add({
      targets: rect,
      [prop]: midPos,
      duration: half,
      ease: 'Linear',
      onComplete: () => {
        if (onMidpoint) onMidpoint();
        scene.tweens.add({
          targets: rect,
          [prop]: endPos,
          duration: half,
          ease: 'Linear',
          onComplete: () => {
            rect.destroy();
            if (onComplete) onComplete();
          }
        });
      }
    });
  }

  /** Crossfade — captures current scene, fades out, then reveals new scene */
  static _crossfadeTransition(scene, duration = 800, onComplete, onMidpoint) {
    // Simple approach: use camera fadeOut then fadeIn with a different color
    // A true crossfade would require render textures, but this gives a good visual effect
    const half = duration / 2;

    scene.cameras.main.fadeOut(half, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => {
      if (onMidpoint) onMidpoint();
      scene.cameras.main.fadeIn(half, 0, 0, 0);
      scene.cameras.main.once('camerafadeincomplete', () => {
        if (onComplete) onComplete();
      });
    });
  }

  /** Iris transition — circular reveal/conceal using a graphics mask */
  static _irisTransition(scene, type, duration = 800, onComplete, onMidpoint) {
    const half = duration / 2;
    const W = scene.scale.width;
    const H = scene.scale.height;
    const maxRadius = Math.sqrt(W * W + H * H) / 2;

    const mask = scene.add.graphics();
    mask.setDepth(1000);

    const drawIris = (radius) => {
      mask.clear();
      mask.fillStyle(0x000000, 1);
      // Draw a full screen with a circular hole
      mask.fillRect(0, 0, W, H);
      mask.fillStyle(0x000000, 0);
      // Use blend mode to cut out circle
      mask.slice(W / 2, H / 2, radius, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(360), false);
      mask.fillPath();
    };

    const startRadius = type === 'iris_in' ? maxRadius : 0;
    const endRadius = type === 'iris_in' ? 0 : maxRadius;

    // Use a simpler approach: just fade with a mask overlay
    const circle = scene.add.graphics();
    circle.setDepth(1000);
    circle.fillStyle(0x000000, 1);

    if (type === 'iris_in') {
      // Start open, close to center
      circle.fillCircle(W / 2, H / 2, maxRadius);
      circle.setAlpha(0);
      
      scene.tweens.add({
        targets: circle,
        alpha: 1,
        duration: half,
        ease: 'Linear',
        onComplete: () => {
          if (onMidpoint) onMidpoint();
          circle.clear();
          circle.fillStyle(0x000000, 1);
          circle.fillRect(0, 0, W, H);
          scene.tweens.add({
            targets: circle,
            alpha: 0,
            duration: half,
            ease: 'Linear',
            onComplete: () => {
              circle.destroy();
              if (onComplete) onComplete();
            }
          });
        }
      });
    } else {
      // iris_out: start closed, open outward
      circle.fillRect(0, 0, W, H);
      circle.setAlpha(1);
      
      scene.tweens.add({
        targets: circle,
        alpha: 0,
        duration: half,
        ease: 'Linear',
        onComplete: () => {
          if (onMidpoint) onMidpoint();
          circle.clear();
          circle.fillStyle(0x000000, 1);
          circle.fillCircle(W / 2, H / 2, maxRadius);
          scene.tweens.add({
            targets: circle,
            alpha: 1,
            duration: half,
            ease: 'Linear',
            onComplete: () => {
              circle.destroy();
              if (onComplete) onComplete();
            }
          });
        }
      });
    }
  }

  /** Zoom transition — camera zoom in/out */
  static _zoomTransition(scene, type, duration = 800, onComplete, onMidpoint) {
    const half = duration / 2;
    const cam = scene.cameras.main;

    if (type === 'zoom_in') {
      scene.tweens.add({
        targets: cam,
        zoom: 2,
        alpha: 0,
        duration: half,
        ease: 'Power2',
        onComplete: () => {
          if (onMidpoint) onMidpoint();
          cam.setZoom(0.5);
          cam.setAlpha(0);
          scene.tweens.add({
            targets: cam,
            zoom: 1,
            alpha: 1,
            duration: half,
            ease: 'Power2',
            onComplete: () => {
              if (onComplete) onComplete();
            }
          });
        }
      });
    } else {
      scene.tweens.add({
        targets: cam,
        zoom: 0.5,
        alpha: 0,
        duration: half,
        ease: 'Power2',
        onComplete: () => {
          if (onMidpoint) onMidpoint();
          cam.setZoom(2);
          cam.setAlpha(0);
          scene.tweens.add({
            targets: cam,
            zoom: 1,
            alpha: 1,
            duration: half,
            ease: 'Power2',
            onComplete: () => {
              if (onComplete) onComplete();
            }
          });
        }
      });
    }
  }

  /** Pixelate transition — pixelation dissolve effect */
  static _pixelateTransition(scene, duration = 800, onComplete, onMidpoint) {
    const half = duration / 2;

    // Simulate pixelation by scaling the camera down and back up
    const cam = scene.cameras.main;

    scene.tweens.add({
      targets: cam,
      zoom: 0.1,
      duration: half,
      ease: 'Power2',
      onComplete: () => {
        if (onMidpoint) onMidpoint();
        scene.tweens.add({
          targets: cam,
          zoom: 1,
          duration: half,
          ease: 'Power2',
          onComplete: () => {
            if (onComplete) onComplete();
          }
        });
      }
    });
  }
}
