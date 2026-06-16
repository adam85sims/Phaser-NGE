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

    // ── Wire SceneController → Systems ──
    this._wireSceneController();

    // ── Input ──
    this._setupInput();

    // ── Fade in ──
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // ── Start the game ──
    this._pendingEndText = null;
    const startScene = initData.loadScene || this._getStartScene();
    this.sceneCtrl.startScene(startScene, initData.nodeId);
  }

  /* ── SCENE CONTROLLER WIRING ───────────────── */

  _wireSceneController() {
    const ctrl = this.sceneCtrl;

    ctrl.onDialogue = (data) => {
      if (data.speaker) {
        this.characters.show(data.speaker, data.expression || 'neutral', data.position || 'center', data.zIndex || 0);
      }

      this.dialogue.showDialogue(
        data.speaker, data.text, data.expression, null
      );
    };

    ctrl.onChoice = (data) => {
      this.characters.hideAll();
      this.dialogue.showChoices(
        data.prompt,
        data.choices,
        (choiceIndex) => {
          this.dialogue.hideChoices();
          ctrl.selectChoice(choiceIndex);
        }
      );
    };

    ctrl.onSceneStart = (data) => {
      this.layers.loadSceneLayers(data.layers, data.background);
      this.cameras.main.fadeIn(400, 0, 0, 0);
      if (data.music) this.audio.playBGM(data.music);

      // Auto-save on scene transition (slot 9)
      this.saveSys.autoSave();
    };

    ctrl.onSceneEnd = (data) => {
      this._cleanupUI();

      // If the scene end specifies a next scene, transition after a pause
      if (data.nextScene) {
        this.time.addEvent({
          delay: 2500,
          callback: () => {
            this._cleanupUI();
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
              ctrl.startScene(data.nextScene);
            });
          },
          callbackScope: this
        });
      }
    };

    ctrl.onAction = (data) => {
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
          else if (this.characters.activeSprites && this.characters.activeSprites.get && this.characters.activeSprites.has(targetId)) targetObj = this.characters.activeSprites.get(targetId);
          
          if (targetObj && this.sys.game.scene.keys.BootScene.Data?.animations) {
            const animData = this.sys.game.scene.keys.BootScene.Data.animations[animKey];
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
    };

    ctrl.onWait = (data) => {
      // Show a brief "..." indicator
      this.dialogue.setVisible(false);
    };

    ctrl.onChoiceTimeout = () => {
      this.dialogue.hideChoices();
    };

    ctrl.onBackgroundChange = (key) => {
      // Legacy support
      this.layers.loadSceneLayers([], key);
    };
  }

  /* ── INPUT ──────────────────────────────────── */

  _setupInput() {
    this.input.keyboard.on('keydown-SPACE', () => this._handleAdvance());
    this.input.keyboard.on('keydown-ENTER', () => this._handleAdvance());
    this.input.on('pointerdown', () => this._handleAdvance());

    // Number keys for choices
    for (let i = 0; i < 9; i++) {
      this.input.keyboard.on('keydown-' + (i + 1), () => {
        if (this.sceneCtrl.isAtChoice) {
          this.sceneCtrl.selectChoice(i);
          this.dialogue.hideChoices();
        }
      });
    }

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

    // Escape: return to menu
    this.input.keyboard.on('keydown-ESC', () => {
      this._cleanupUI();
      this.dialogue.hideHistory();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('MenuScene');
      });
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
    if (!this.sceneCtrl.isRunning) return;
    if (this.sceneCtrl.isAtChoice) return;

    const node = this.sceneCtrl.currentNode;
    if (!node) return;

    if (node.type === 'dialogue') {
      const consumed = this.dialogue.advance();
      if (!consumed) {
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
    if (this._pendingEndText) this._pendingEndText.destroy();
    this._pendingEndText = null;
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
    const exts = ['mp3', 'ogg', 'wav', 'opus', 'm4a'];

    const tryLoad = async () => {
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
