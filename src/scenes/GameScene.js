import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { VariableSystem } from '../systems/VariableSystem.js';
import { SceneController } from '../systems/SceneController.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { CharacterSystem } from '../systems/CharacterSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Settings } from '../systems/SettingsSystem.js';
import { LayerSystem } from '../systems/LayerSystem.js';
import { LayoutSystem } from '../systems/LayoutSystem.js';
import { TransitionSystem } from '../systems/TransitionSystem.js';
import { ChapterSystem } from '../systems/ChapterSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

/**
 * GameScene — the main gameplay loop.
 * Wires together all engine systems and handles player input.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.W = 1280;
    this.H = 720;

    // ── Check for scene data passed from MenuScene (Continue) ──
    const initData = this.scene.settings.data || {};

    // Background layer (depth 0)
    this.layers = new LayerSystem(this);

    // UI layout system — applies named layouts (theme + layer objects)
    this.layouts = new LayoutSystem(this);

    // ── Initialize systems ──
    this.vars = new VariableSystem();
    if (initData.variables) {
      this.vars.deserialize(initData.variables);
    }
    this.sceneCtrl = new SceneController(this.vars, this);
    this.dialogue = new DialogueSystem(this);
    this.characters = new CharacterSystem(this);
    this.saveSys = new SaveSystem(this.vars, this.sceneCtrl);
    this.audio = new AudioSystem(this);
    this.chapter = new ChapterSystem(this);
    this.particles = new ParticleSystem(this);

    // ── Wire SceneController → Systems ──
    this._wireSceneController();

    // ── Input ──
    this._setupInput();

    // ── Start the game ──
    this._pendingEndText = null;
    this._pauseOpen = false;
    this._pauseContainer = null;
    this._menuOpen = false;
    this._choiceSelected = -1;
    const startScene = initData.loadScene || this._getStartScene();
    this.sceneCtrl.startScene(startScene, initData.nodeId);
  }

  /* ── SCENE CONTROLLER WIRING ───────────────── */

  _wireSceneController() {
    const ctrl = this.sceneCtrl;

    ctrl.events.on('dialogue', (data) => {
      if (data.speaker) {
        this.characters.show(data.speaker, data.expression || 'neutral', data.position || 'center', data.zIndex || 0);
      }

      if (data.voice) {
        this.audio.playVoice(data.voice);
      } else {
        this.audio.stopVoice(200);
      }

      this.dialogue.showDialogue(
        data.speaker, data.text, data.expression, null
      );
    });

    ctrl.events.on('choice', (data) => {
      this.characters.hideAll();
      this.dialogue.showChoices(
        data.prompt,
        data.choices,
        (choiceIndex) => {
          this.dialogue.hideChoices();
          ctrl.selectChoice(choiceIndex);
        }
      );
    });

    ctrl.events.on('textInput', (data) => {
      this._showTextInputOverlay(data.prompt, data.variable, data.maxLength);
    });

    ctrl.events.on('chapter', (data) => {
      this.dialogue.setVisible(false);
      this.characters.hideAll();
      this.chapter.showChapterCard(data.title, data.subtitle, data.duration, () => {
        ctrl.isRunning = true;
        if (data.next) {
          ctrl.jumpToId(data.next);
        } else {
          ctrl.advance();
        }
      });
    });

    ctrl.events.on('particles', (data) => {
      this.particles.handleEvent(data);
    });

    ctrl.events.on('sceneStart', (data) => {
      this.layers.loadSceneLayers(data.layers, data.background);
      if (data.music) this.audio.playBGM(data.music);

      // Apply layout if the scene specifies one
      if (data.layout) {
        this.layouts.apply(data.layout, { fade: true });
      }

      // Auto-save on scene transition (slot 9)
      this.saveSys.autoSave();
    });

    ctrl.events.on('sceneEnd', (data) => {
      this._cleanupUI();

      // If the scene end specifies a next scene, transition
      if (data.nextScene) {
        // Find if end node has transition type
        const endNode = Object.values(Data.scenes[ctrl.currentScene]?.nodes || {}).find(n => n.id === ctrl.currentNode?.id || (n.type === 'end' && n.nextScene === data.nextScene));
        const tType = endNode?.transition || 'fade';
        const tDur = endNode?.transitionDuration || 600;

        TransitionSystem.runTransition(this, tType, tDur,
          // onComplete
          () => {
            ctrl.startScene(data.nextScene);
          },
          // onMidpoint
          () => {
            this._cleanupUI();
          }
        );
      }
    });

    ctrl.events.on('action', (data) => {
      // Handle event nodes
      switch (data.type) {
        case 'sfx': {
          const playWithVol = () => {
            if (data.volume != null) {
              const prev = this.audio.sfxVolume;
              this.audio.sfxVolume = Math.max(0, Math.min(1, data.volume));
              this.audio.playSFX(data.value);
              this.audio.sfxVolume = prev;
            } else {
              this.audio.playSFX(data.value);
            }
          };
          if (!this.cache.audio.exists(data.value)) {
            this._loadAndPlay('sfx', data.value, playWithVol);
          } else {
            playWithVol();
          }
          break;
        }
        case 'bgm': {
          if (data.volume != null) this.audio.setBGMVolume(Math.max(0, Math.min(1, data.volume)));
          if (!this.cache.audio.exists(data.value)) {
            this._loadAndPlay('bgm', data.value, () => this.audio.playBGM(data.value));
          } else {
            this.audio.playBGM(data.value);
          }
          break;
        }
        case 'bgm_stop':
          this.audio.stopBGM(800);
          break;
        case 'bg_change':
          // Legacy support: re-load the single layer
          this.layers.loadSceneLayers([], data.value);
          break;
        case 'unlock_cg': {
          const globals = this.saveSys.getGlobals();
          if (!globals.unlockedCGs) globals.unlockedCGs = [];
          if (!globals.unlockedCGs.includes(data.value)) {
            globals.unlockedCGs.push(data.value);
            this.saveSys.saveGlobals(globals);
          }
          break;
        }
        case 'camera_shake':
          const [dur, int] = (data.value || '200,0.005').split(',').map(Number);
          this.cameras.main.shake(dur || 200, int || 0.005);
          break;
        case 'camera_flash':
          this.cameras.main.flash(200, 255, 255, 255);
          break;
        case 'play_animation': {
          const targetId = data.target;
          const animKey = data.value;
          let targetObj = null;
          
          if (this.layers.layers[targetId]) targetObj = this.layers.layers[targetId];
          else if (this.characters.portraits[targetId]) targetObj = this.characters.portraits[targetId];
          
          if (targetObj && Data.animations) {
            const animData = Data.animations[animKey];
            if (animData) {
              import('../systems/AnimationRunner.js').then(({ AnimationRunner }) => {
                AnimationRunner.play(this, targetObj, animData);
              });
            } else {
              console.warn(`Animation key not found: ${animKey}`);
            }
          } else {
            console.warn(`play_animation target not found: ${targetId}`);
          }
          break;
        }
      }

      // Show a small toast notification for visible events only.
      // Audio events (bgm, sfx, bgm_stop) are silent — no on-screen indicator needed.
      const _silentEventTypes = new Set(['bgm', 'sfx', 'bgm_stop', 'play_animation']);
      if (data.type && data.type !== 'camera_flash' && !_silentEventTypes.has(data.type)) {
        const toast = this.add.text(this.W / 2, this.H - 60, `⚡ ${data.type}${data.value ? ': ' + data.value : ''}`, {
          fontSize: '12px',
          fontFamily: 'monospace',
          color: '#ffaa44',
          backgroundColor: '#22224488',
          padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
          targets: toast,
          alpha: 0,
          y: this.H - 80,
          duration: 1500,
          delay: 800,
          onComplete: () => toast.destroy()
        });
      }
    });

    ctrl.events.on('wait', (data) => {
      // Show a brief "..." indicator
      this.dialogue.setVisible(false);
    });

    ctrl.events.on('choiceTimeout', () => {
      this.dialogue.hideChoices();
    });

    ctrl.events.on('backgroundChange', (key) => {
      // Legacy support
      this.layers.loadSceneLayers([], key);
    });
  }

  /* ── INPUT ──────────────────────────────────── */

  _setupInput() {
    this.input.keyboard.on('keydown-SPACE', () => this._handleAdvance());
    this.input.keyboard.on('keydown-ENTER', () => this._handleChoiceConfirm());
    this.input.on('pointerup', () => this._handleAdvance());

    // Number keys for choices
    for (let i = 0; i < 9; i++) {
      this.input.keyboard.on('keydown-' + (i + 1), () => {
        if (this.sceneCtrl.isAtChoice) {
          this.sceneCtrl.selectChoice(i);
          this.dialogue.hideChoices();
        }
      });
    }

    // Arrow keys for choice navigation
    this._choiceSelected = -1;
    this.input.keyboard.on('keydown-UP', () => {
      if (this.sceneCtrl.isAtChoice && this.dialogue.choices.length > 0) {
        this._choiceSelected = Math.max(0, this._choiceSelected - 1);
        this.dialogue.highlightChoice(this._choiceSelected);
      }
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.sceneCtrl.isAtChoice && this.dialogue.choices.length > 0) {
        this._choiceSelected = Math.min(this.dialogue.choices.length - 1, this._choiceSelected + 1);
        this.dialogue.highlightChoice(this._choiceSelected);
      }
    });

    // F1–F4: jump to dev/test scenes (only if they exist in loaded data)
    const devSceneHotkeys = {
      F1: 'sample',
      F2: 'test-conditions',
      F3: 'test-events',
      F4: 'node_test'
    };
    Object.entries(devSceneHotkeys).forEach(([key, sceneId]) => {
      this.input.keyboard.on(`keydown-${key}`, () => {
        if (Data.getScene(sceneId)) {
          this._switchScene(sceneId);
        } else {
          this._showToast(`Dev scene '${sceneId}' not loaded`);
        }
      });
    });

    // ESC: toggle pause menu
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._menuOpen) {
        // In save/load/settings sub-menu → go back to pause menu
        if (this._pauseContainer && !this._pauseOpen) {
          this._closePauseMenu();
          this._showPauseMenu();
        } else if (this._pauseOpen) {
          this._closePauseMenu();
        }
      } else {
        this._showPauseMenu();
      }
    });

    // H: toggle dialogue history
    this.input.keyboard.on('keydown-H', () => {
      this.dialogue.showHistory();
    });

    // S: toggle skip mode
    this.input.keyboard.on('keydown-S', () => {
      this.dialogue.toggleSkip();
      this._showToast(this.dialogue.skipMode ? 'Skip: ON' : 'Skip: OFF');
    });

    // A: toggle auto mode
    this.input.keyboard.on('keydown-A', () => {
      this.dialogue.toggleAuto();
      this._showToast(this.dialogue.autoMode ? 'Auto: ON' : 'Auto: OFF');
    });

    // F5: quick save (slot 0)
    this.input.keyboard.on('keydown-F5', () => {
      this.saveSys.quickSave();
      this._showToast('Quick Saved');
    });

    // F9: quick load (slot 0)
    this.input.keyboard.on('keydown-F9', () => {
      const loaded = this.saveSys.quickLoad();
      if (loaded && loaded.sceneId) {
        this._cleanupUI();
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.sceneCtrl.startScene(loaded.sceneId, loaded.nodeId);
        });
      } else {
        this._showToast('No quick save found');
      }
    });
  }

  _handleAdvance() {
    if (this._pauseOpen) return;
    if (!this.sceneCtrl.isRunning) return;
    if (this.sceneCtrl.isAtChoice) return;

    const node = this.sceneCtrl.currentNode;
    if (!node) return;

    if (node.type === 'dialogue') {
      const consumed = this.dialogue.advance();
      if (!consumed) {
        this.audio.stopVoice(200);
        this.sceneCtrl.advance();
      }
    } else if (node.type === 'event' || node.type === 'wait') {
      // Auto-advance through non-interactive nodes
      this.sceneCtrl.advance();
    } else if (node.type === 'end') {
      // Click to restart
      this.scene.restart();
    }
  }

  /** Handle ENTER during choice selection */
  _handleChoiceConfirm() {
    if (this._pauseOpen) return;
    if (this.sceneCtrl.isAtChoice) {
      if (this._choiceSelected >= 0 && this._choiceSelected < this.dialogue.choices.length) {
        this.sceneCtrl.selectChoice(this._choiceSelected);
        this.dialogue.hideChoices();
        this._choiceSelected = -1;
      } else {
        // No selection yet — advance through text if typing
        this._handleAdvance();
      }
    } else {
      this._handleAdvance();
    }
  }

  _switchScene(sceneId) {
    // Clean up and switch to a different scene
    this._cleanupUI();
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sceneCtrl.startScene(sceneId);
    });
  }



  _cleanupUI() {
    this.dialogue.setVisible(false);
    this.characters.hideAll();
    this.audio.stopVoice(200);
    if (this._pendingEndText) this._pendingEndText.destroy();
    this._pendingEndText = null;
  }

  /* ── PAUSE MENU ──────────────────────────────── */

  _showPauseMenu() {
    if (this._pauseOpen) return;
    this._pauseOpen = true;
    this._menuOpen = true;
    this.sceneCtrl.isRunning = false;

    const W = this.W;
    const H = this.H;
    const container = this.add.container(0, 0).setDepth(1000);
    this._pauseContainer = container;

    // Semi-transparent overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    container.add(overlay);

    // Title
    const title = this.add.text(W / 2, H * 0.25, 'PAUSED', {
      fontSize: '48px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    // Menu items
    const items = [
      { label: 'Resume',     action: () => this._closePauseMenu() },
      { label: 'Save Game',  action: () => { this._closePauseMenu(); this._showSaveMenu(); } },
      { label: 'Load Game',  action: () => { this._closePauseMenu(); this._showLoadMenu(); } },
      { label: 'Settings',   action: () => { this._closePauseMenu(); this._showSettingsMenu(); } },
      { label: 'Title Screen', action: () => { this._closePauseMenu(); this._returnToMenu(); } },
    ];

    let yPos = H * 0.4;
    items.forEach((item) => {
      const btn = this.add.text(W / 2, yPos, item.label, {
        fontSize: '24px', fontFamily: 'monospace', color: '#aaaaaa',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', () => btn.setColor('#ffffff'));
      btn.on('pointerout', () => btn.setColor('#aaaaaa'));
      btn.on('pointerup', item.action);
      container.add(btn);
      yPos += 50;
    });

    // ESC hint
    const hint = this.add.text(W / 2, H - 40, 'Press ESC to resume', {
      fontSize: '14px', fontFamily: 'monospace', color: '#666688'
    }).setOrigin(0.5);
    container.add(hint);
  }

  _closePauseMenu() {
    if (!this._pauseOpen) return;
    this._pauseOpen = false;
    this._menuOpen = false;
    if (this._pauseContainer) {
      this._pauseContainer.destroy();
      this._pauseContainer = null;
    }
    this.sceneCtrl.isRunning = true;
  }

  _returnToMenu() {
    this._cleanupUI();
    TransitionSystem.runTransition(this, 'fade', 600, null, () => {
      this.scene.start('MenuScene');
    });
  }

  /* ── SAVE MENU ──────────────────────────────── */

  _showSaveMenu() {
    this._menuOpen = true;
    const W = this.W;
    const H = this.H;
    const container = this.add.container(0, 0).setDepth(1000);
    this._pauseContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    container.add(overlay);

    const title = this.add.text(W / 2, 40, 'SAVE GAME', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    const slots = this.saveSys.getSlots();
    const slotCount = 10;
    const startY = 100;

    for (let i = 0; i < slotCount; i++) {
      const slot = slots[i];
      const y = startY + i * 50;
      const isAuto = i === 9;

      const slotBg = this.add.graphics();
      slotBg.fillStyle(0x222244, 0.8);
      slotBg.fillRoundedRect(W / 2 - 250, y - 15, 500, 40, 4);
      container.add(slotBg);

      const label = isAuto ? `[Auto] ` : `[${i + 1}] `;
      let detail = '— Empty —';
      if (slot && slot.timestamp) {
        detail = `${slot.sceneId || '?'} — ${this.saveSys.formatTimestamp(slot.timestamp)}`;
      }

      const slotText = this.add.text(W / 2 - 240, y, label + detail, {
        fontSize: '16px', fontFamily: 'monospace',
        color: slot ? '#cccccc' : '#666666'
      }).setOrigin(0, 0.5);
      container.add(slotText);

      if (!isAuto) {
        slotText.setInteractive({ useHandCursor: true });
        slotText.on('pointerover', () => slotText.setColor('#00ccff'));
        slotText.on('pointerout', () => slotText.setColor(slot ? '#cccccc' : '#666666'));
        slotText.on('pointerup', () => {
          this.saveSys.save(i);
          this._showToast(`Saved to slot ${i + 1}`);
          this._closePauseMenu();
        });
      }
    }

    // Back button
    const backBtn = this.add.text(W / 2, H - 50, '← Back (ESC)', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerup', () => {
      this._closePauseMenu();
      this._showPauseMenu();
    });
    container.add(backBtn);
  }

  /* ── LOAD MENU ──────────────────────────────── */

  _showLoadMenu() {
    this._menuOpen = true;
    const W = this.W;
    const H = this.H;
    const container = this.add.container(0, 0).setDepth(1000);
    this._pauseContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    container.add(overlay);

    const title = this.add.text(W / 2, 40, 'LOAD GAME', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    const slots = this.saveSys.getSlots();
    const slotCount = 10;
    const startY = 100;

    for (let i = 0; i < slotCount; i++) {
      const slot = slots[i];
      const y = startY + i * 50;
      const isAuto = i === 9;

      const slotBg = this.add.graphics();
      slotBg.fillStyle(0x222244, 0.8);
      slotBg.fillRoundedRect(W / 2 - 250, y - 15, 500, 40, 4);
      container.add(slotBg);

      const label = isAuto ? `[Auto] ` : `[${i + 1}] `;
      let detail = '— Empty —';
      if (slot && slot.timestamp) {
        detail = `${slot.sceneId || '?'} — ${this.saveSys.formatTimestamp(slot.timestamp)}`;
      }

      const slotText = this.add.text(W / 2 - 240, y, label + detail, {
        fontSize: '16px', fontFamily: 'monospace',
        color: slot ? '#cccccc' : '#666666'
      }).setOrigin(0, 0.5);
      container.add(slotText);

      if (slot) {
        slotText.setInteractive({ useHandCursor: true });
        slotText.on('pointerover', () => slotText.setColor('#00ccff'));
        slotText.on('pointerout', () => slotText.setColor(slot ? '#cccccc' : '#666666'));
        slotText.on('pointerup', () => {
          this._closePauseMenu();
          const loaded = this.saveSys.load(i);
          if (loaded && loaded.sceneId) {
            this._cleanupUI();
            this.cameras.main.fadeOut(200, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
              this.sceneCtrl.startScene(loaded.sceneId, loaded.nodeId);
            });
          }
        });
      }
    }

    // Back button
    const backBtn = this.add.text(W / 2, H - 50, '← Back (ESC)', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerup', () => {
      this._closePauseMenu();
      this._showPauseMenu();
    });
    container.add(backBtn);
  }

  /* ── SETTINGS MENU ──────────────────────────── */

  _showSettingsMenu() {
    this._menuOpen = true;
    const W = this.W;
    const H = this.H;
    const container = this.add.container(0, 0).setDepth(1000);
    this._pauseContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    container.add(overlay);

    const title = this.add.text(W / 2, 40, 'SETTINGS', {
      fontSize: '32px', fontFamily: 'monospace', color: '#ffffff'
    }).setOrigin(0.5);
    container.add(title);

    // Check for available languages
    const langs = Data.game?.localization?.availableLanguages || ['en'];
    const langNames = Data.game?.localization?.languageNames || {};
    const hasLocalization = langs.length > 1;

    const rowY = [140, 200, 260, 320, 380, hasLocalization ? 440 : null].filter(v => v !== null);
    const labels = ['Text Speed', 'BGM Volume', 'SFX Volume', 'Voice Volume', 'Fullscreen'];
    const getters = [
      () => `${Settings.textSpeed}ms`,
      () => `${Math.round(Settings.bgmVolume * 100)}%`,
      () => `${Math.round(Settings.sfxVolume * 100)}%`,
      () => `${Math.round(Settings.voiceVolume * 100)}%`,
      () => Settings.fullscreen ? 'On' : 'Off',
    ];
    const actions = [
      { inc: () => { Settings.textSpeed = Settings.clamp(Settings.textSpeed + 10, 10, 200); Settings.save(); this.dialogue.setTextSpeed(Settings.textSpeed); },
        dec: () => { Settings.textSpeed = Settings.clamp(Settings.textSpeed - 10, 10, 200); Settings.save(); this.dialogue.setTextSpeed(Settings.textSpeed); } },
      { inc: () => { Settings.bgmVolume = Settings.clamp(Settings.bgmVolume + 0.1, 0, 1); Settings.save(); this.audio.setBGMVolume(Settings.bgmVolume); },
        dec: () => { Settings.bgmVolume = Settings.clamp(Settings.bgmVolume - 0.1, 0, 1); Settings.save(); this.audio.setBGMVolume(Settings.bgmVolume); } },
      { inc: () => { Settings.sfxVolume = Settings.clamp(Settings.sfxVolume + 0.1, 0, 1); Settings.save(); this.audio.setSFXVolume(Settings.sfxVolume); },
        dec: () => { Settings.sfxVolume = Settings.clamp(Settings.sfxVolume - 0.1, 0, 1); Settings.save(); this.audio.setSFXVolume(Settings.sfxVolume); } },
      { inc: () => { Settings.voiceVolume = Settings.clamp(Settings.voiceVolume + 0.1, 0, 1); Settings.save(); this.audio.setVoiceVolume(Settings.voiceVolume); },
        dec: () => { Settings.voiceVolume = Settings.clamp(Settings.voiceVolume - 0.1, 0, 1); Settings.save(); this.audio.setVoiceVolume(Settings.voiceVolume); } },
      { inc: () => { Settings.fullscreen = true; Settings.save(); this.scale.startFullscreen(); },
        dec: () => { Settings.fullscreen = false; Settings.save(); this.scale.stopFullscreen(); } },
    ];

    // Add language picker if multiple languages available
    if (hasLocalization) {
      labels.push('Language');
      getters.push(() => langNames[Settings.language] || Settings.language);
      actions.push({
        inc: () => {
          const idx = langs.indexOf(Settings.language);
          Settings.language = langs[(idx + 1) % langs.length];
          Settings.save();
        },
        dec: () => {
          const idx = langs.indexOf(Settings.language);
          Settings.language = langs[(idx - 1 + langs.length) % langs.length];
          Settings.save();
        }
      });
    }

    const valueTexts = [];
    labels.forEach((label, i) => {
      container.add(this.add.text(W / 2 - 200, rowY[i], label, {
        fontSize: '18px', fontFamily: 'monospace', color: '#cccccc'
      }).setOrigin(0, 0.5));

      const minus = this.add.text(W / 2 + 100, rowY[i], '  −  ', {
        fontSize: '22px', fontFamily: 'monospace', color: '#ff6666',
        backgroundColor: '#331111', padding: { x: 6, y: 2 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const val = this.add.text(W / 2 + 165, rowY[i], getters[i](), {
        fontSize: '18px', fontFamily: 'monospace', color: '#00ccff',
        align: 'center', fixedWidth: 80
      }).setOrigin(0.5);
      valueTexts.push(val);

      const plus = this.add.text(W / 2 + 230, rowY[i], '  +  ', {
        fontSize: '22px', fontFamily: 'monospace', color: '#66ff66',
        backgroundColor: '#113311', padding: { x: 6, y: 2 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      minus.on('pointerup', () => { actions[i].dec(); val.setText(getters[i]()); });
      plus.on('pointerup', () => { actions[i].inc(); val.setText(getters[i]()); });
      container.add(minus);
      container.add(plus);
    });

    // Back button
    const backBtn = this.add.text(W / 2, H - 50, '← Back (ESC)', {
      fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerup', () => {
      this._closePauseMenu();
      this._showPauseMenu();
    });
    container.add(backBtn);
  }

  /* ── START SCENE ───────────────────────────── */

  _getStartScene() {
    return Data.game?.startScene || 'start';
  }

  /** Show a brief toast notification */
  _showToast(text) {
    const toast = this.add.text(this.W / 2, this.H / 2, text, {
      fontSize: '18px', fontFamily: 'monospace', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setDepth(500);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: (this.H / 2) - 20,
      duration: 1200,
      delay: 600,
      onComplete: () => toast.destroy(),
    });
  }

  /**
   * Runtime audio fallback — probe extensions, load on-the-fly, then play.
   * Used when a bgm/sfx key fires but isn't in the Phaser audio cache.
   * @param {'bgm'|'sfx'} type
   * @param {string} key
   * @param {Function} onReady - called once the audio is in cache
   */
  _loadAndPlay(type, key, onReady) {
    const subdir = type === 'bgm' ? 'bgm' : 'sfx';

    const tryLoad = async () => {
      // If it already has an extension, fetch directly
      if (key.includes('.')) {
        this.load.audio(key, `/assets/${key}`);
        this.load.once('complete', () => onReady());
        this.load.start();
        return;
      }

      const isFullPath = key.includes('/');
      const baseKey = isFullPath ? key : `audio/${subdir}/${key}`;
      
      const exts = ['mp3', 'ogg', 'wav', 'opus', 'm4a'];
      for (const ext of exts) {
        const url = `/assets/${baseKey}.${ext}`;
        try {
          const r = await fetch(url, { method: 'HEAD' });
          if (!r.ok) continue;
          // Register and start loader
          this.load.audio(key, url);
          this.load.once('complete', () => onReady());
          this.load.start();
          return;
        } catch { continue; }
      }
      console.warn(`[GameScene] _loadAndPlay: could not find audio '${key}'`);
      if (onReady) onReady();
    };

    tryLoad();
  }

  /* ── CLEANUP ───────────────────────────────── */

  shutdown() {
    this.dialogue.destroy();
    this.characters.destroy();
    this.audio.destroy();
    this.layers.destroy();
  }
}
