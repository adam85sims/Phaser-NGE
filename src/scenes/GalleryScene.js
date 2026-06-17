import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { SaveSystem } from '../systems/SaveSystem.js';

export class GalleryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GalleryScene' });
  }

  init() {
    this.saveSys = new SaveSystem(null, null); // We only need getGlobals
    const globals = this.saveSys.getGlobals();
    this.unlockedCGs = new Set(globals.unlockedCGs || []);
    this.galleryItems = Data.game?.gallery || [];
  }

  preload() {
    if (this.galleryItems.length === 0) return;
    
    const txt = this.add.text(640, 360, 'LOADING GALLERY...', { color: '#fff', fontSize: '24px', fontFamily: 'monospace' }).setOrigin(0.5);
    for (const key of this.galleryItems) {
      const texKey = `gallery/${key}`;
      if (!this.textures.exists(texKey)) {
        this.load.image(texKey, `/assets/gallery/${key}.png`);
      }
    }
    this.load.on('complete', () => txt.destroy());
  }

  create() {
    this.add.rectangle(0, 0, 1280, 720, 0x111122).setOrigin(0);

    this.add.text(640, 50, 'CG GALLERY', {
      fontSize: '48px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);

    const backBtn = this.add.text(60, 50, '← BACK', {
      fontSize: '24px', fontFamily: 'monospace', color: '#00ccff'
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#00ccff'));

    this.gridContainer = this.add.container(0, 0);
    this.fullScreenContainer = this.add.container(0, 0).setDepth(100).setVisible(false);

    // Full screen image setup
    const fsBg = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9).setInteractive();
    this.fsImage = this.add.image(640, 360, '').setInteractive({ useHandCursor: true });
    
    fsBg.on('pointerdown', () => this.closeFullScreen());
    this.fsImage.on('pointerdown', () => this.closeFullScreen());

    this.fullScreenContainer.add([fsBg, this.fsImage]);

    this.createGrid();
  }

  createGrid() {
    const startX = 190;
    const startY = 180;
    const cols = 4;
    const xPad = 300;
    const yPad = 200;

    if (this.galleryItems.length === 0) {
      this.add.text(640, 360, 'No CGs found in game data.\\n(Put images in public/assets/gallery/ and save project)', { color: '#888', fontSize: '20px', align: 'center' }).setOrigin(0.5);
      return;
    }

    this.galleryItems.forEach((key, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * xPad;
      const y = startY + row * yPad;

      const isUnlocked = this.unlockedCGs.has(key);
      const texKey = `gallery/${key}`;

      // Thumbnail background
      this.add.rectangle(x, y, 260, 150, 0x000000).setStrokeStyle(2, 0x444455);

      if (isUnlocked) {
        // Thumbnail image
        if (this.textures.exists(texKey)) {
          const img = this.add.image(x, y, texKey);
          const scale = Math.min(256 / img.width, 146 / img.height);
          img.setScale(scale);
          img.setInteractive({ useHandCursor: true });
          
          img.on('pointerdown', () => this.openFullScreen(texKey));
          img.on('pointerover', () => img.setTint(0xddddff));
          img.on('pointerout', () => img.clearTint());
        }
      } else {
        // Locked placeholder
        this.add.text(x, y, '?', {
          fontSize: '64px', fontFamily: 'monospace', color: '#444455'
        }).setOrigin(0.5);
      }
    });
  }

  openFullScreen(texKey) {
    this.fsImage.setTexture(texKey);
    // Scale to fit 1280x720 keeping aspect ratio
    const scale = Math.min(1280 / this.fsImage.width, 720 / this.fsImage.height);
    this.fsImage.setScale(scale);
    this.fullScreenContainer.setVisible(true);
  }

  closeFullScreen() {
    this.fullScreenContainer.setVisible(false);
  }
}
