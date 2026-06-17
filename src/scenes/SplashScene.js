import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';

export class SplashScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SplashScene' });
  }

  create() {
    const W = 1280, H = 720;
    const config = Data.theme?.ui?.splash;

    if (!config || !config.enabled) {
      this.scene.start('MenuScene');
      return;
    }

    // Background
    const bg = this.add.graphics();
    try {
      if (config.background && config.background.startsWith('#')) {
        const color = Phaser.Display.Color.HexStringToColor(config.background).color;
        bg.fillStyle(color, 1);
        bg.fillRect(0, 0, W, H);
      } else {
        bg.fillStyle(0x000000, 1);
        bg.fillRect(0, 0, W, H);
      }
    } catch(e) {
      bg.fillStyle(0x000000, 1);
      bg.fillRect(0, 0, W, H);
    }

    // Logo
    let logoImg = null;
    if (config.logo && this.textures.exists(config.logo)) {
      logoImg = this.add.image(W/2, H/2, config.logo);
      logoImg.setScale(config.logoScale || 1.0);
      logoImg.setAlpha(0);
    } else {
      // No logo, just wait
    }

    const startMenu = () => {
      this.scene.start('MenuScene');
    };

    if (config.skipOnClick) {
      this.input.once('pointerdown', startMenu);
    }

    if (logoImg) {
      this.tweens.add({
        targets: logoImg,
        alpha: 1,
        duration: config.fadeIn || 1000,
        ease: 'Linear',
        onComplete: () => {
          this.time.delayedCall(config.hold || 2000, () => {
            this.tweens.add({
              targets: logoImg,
              alpha: 0,
              duration: config.fadeOut || 1000,
              ease: 'Linear',
              onComplete: startMenu
            });
          });
        }
      });
    } else {
      this.time.delayedCall((config.fadeIn || 1000) + (config.hold || 2000) + (config.fadeOut || 1000), startMenu);
    }
  }
}
