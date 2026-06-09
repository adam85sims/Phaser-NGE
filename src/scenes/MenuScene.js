import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { Settings } from '../systems/SettingsSystem.js';

/**
 * MenuScene — title screen with Start, Settings, and Continue buttons.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const W = 1280, H = 720;
    const title = Data.game?.title || 'Untitled';

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a3a, 0x1a0a3a, 1);
    bg.fillRect(0, 0, W, H);

    this._showMenu(W, H, title);
  }

  _showMenu(W, H, title) {
    // Clear any existing children (in case of re-entry)
    this.children.removeAll(true);

    // Redraw background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a3a, 0x1a0a3a, 1);
    bg.fillRect(0, 0, W, H);

    // Title
    this.add.text(W / 2, 220, title, {
      fontSize: '56px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, 280, '— Phaser NGE —', {
      fontSize: '18px', fontFamily: 'monospace', color: '#666688',
    }).setOrigin(0.5);

    // Start Game button
    const startBtn = this.add.text(W / 2, 420, '▶  Start Game', {
      fontSize: '22px', fontFamily: 'monospace', color: '#00ccff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#00ccff'));
    startBtn.on('pointerdown', () => this._sceneTransition('GameScene'));

    // Continue button
    const slots = JSON.parse(localStorage.getItem('narrative_saves') || '[]');
    const hasSave = slots.some(s => s !== null && s !== undefined);
    const continueBtn = this.add.text(W / 2, 480, '▶  Continue', {
      fontSize: '18px', fontFamily: 'monospace',
      color: hasSave ? '#88aa88' : '#444444',
    }).setOrigin(0.5);
    if (hasSave) {
      continueBtn.setInteractive({ useHandCursor: true });
      continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#88aa88'));
      continueBtn.on('pointerdown', () => this._loadAutoSave());
    }

    // Settings button
    const settingsBtn = this.add.text(W / 2, 540, '⚙  Settings', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    settingsBtn.on('pointerover', () => settingsBtn.setColor('#ffffff'));
    settingsBtn.on('pointerout', () => settingsBtn.setColor('#aaaaaa'));
    settingsBtn.on('pointerdown', () => this._showSettings(W, H));

    // Input
    this.input.keyboard.removeAllListeners();
    this.input.keyboard.on('keydown-SPACE', () => this._sceneTransition('GameScene'));
    this.input.keyboard.on('keydown-ENTER', () => this._sceneTransition('GameScene'));

    // Pulse on start
    this.tweens.add({ targets: startBtn, alpha: 0.6, duration: 1500, yoyo: true, repeat: -1 });
  }

  _showSettings(W, H) {
    this.children.removeAll(true);

    // Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a3a, 0x1a0a3a, 1);
    bg.fillRect(0, 0, W, H);

    // Title
    this.add.text(W / 2, 120, 'Settings', {
      fontSize: '36px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5);

    const rowY = [240, 310, 380, 450];
    const labels = ['Text Speed', 'BGM Volume', 'SFX Volume', 'Fullscreen'];
    const getters = [
      () => `${Settings.textSpeed}ms`,
      () => `${Math.round(Settings.bgmVolume * 100)}%`,
      () => `${Math.round(Settings.sfxVolume * 100)}%`,
      () => Settings.fullscreen ? 'On' : 'Off',
    ];
    const actions = [
      { inc: () => { Settings.textSpeed = Settings.clamp(Settings.textSpeed + 10, 10, 200); Settings.save(); },
        dec: () => { Settings.textSpeed = Settings.clamp(Settings.textSpeed - 10, 10, 200); Settings.save(); } },
      { inc: () => { Settings.bgmVolume = Settings.clamp(Settings.bgmVolume + 0.1, 0, 1); Settings.save(); },
        dec: () => { Settings.bgmVolume = Settings.clamp(Settings.bgmVolume - 0.1, 0, 1); Settings.save(); } },
      { inc: () => { Settings.sfxVolume = Settings.clamp(Settings.sfxVolume + 0.1, 0, 1); Settings.save(); },
        dec: () => { Settings.sfxVolume = Settings.clamp(Settings.sfxVolume - 0.1, 0, 1); Settings.save(); } },
      { inc: () => { Settings.fullscreen = true; Settings.save(); this.scale.startFullscreen(); },
        dec: () => { Settings.fullscreen = false; Settings.save(); this.scale.stopFullscreen(); } },
    ];

    const valueTexts = [];

    labels.forEach((label, i) => {
      this.add.text(W / 2 - 200, rowY[i], label, {
        fontSize: '18px', fontFamily: 'monospace', color: '#cccccc',
      }).setOrigin(0, 0.5);

      // Minus button
      const minus = this.add.text(W / 2 + 100, rowY[i], '  −  ', {
        fontSize: '22px', fontFamily: 'monospace', color: '#ff6666',
        backgroundColor: '#331111', padding: { x: 6, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      // Value display
      const val = this.add.text(W / 2 + 165, rowY[i], getters[i](), {
        fontSize: '18px', fontFamily: 'monospace', color: '#00ccff', align: 'center',
        fixedWidth: 80,
      }).setOrigin(0.5);
      valueTexts.push(val);

      // Plus button
      const plus = this.add.text(W / 2 + 230, rowY[i], '  +  ', {
        fontSize: '22px', fontFamily: 'monospace', color: '#66ff66',
        backgroundColor: '#113311', padding: { x: 6, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      minus.on('pointerdown', () => {
        actions[i].dec();
        val.setText(getters[i]());
      });
      plus.on('pointerdown', () => {
        actions[i].inc();
        val.setText(getters[i]());
      });
    });

    // Back button
    const backBtn = this.add.text(W / 2, 580, '← Back', {
      fontSize: '20px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerdown', () => this._showMenu(W, H));

    this.input.keyboard.removeAllListeners();
    this.input.keyboard.on('keydown-ESC', () => this._showMenu(W, H));
  }

  _sceneTransition(targetScene) {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(targetScene);
    });
  }

  _loadAutoSave() {
    try {
      const slots = JSON.parse(localStorage.getItem('narrative_saves') || '[]');
      const autoSave = slots[9];
      if (autoSave && autoSave.sceneId) {
        this.scene.start('GameScene', { loadScene: autoSave.sceneId, variables: autoSave.variables });
      } else {
        this._sceneTransition('GameScene');
      }
    } catch {
      this._sceneTransition('GameScene');
    }
  }
}
