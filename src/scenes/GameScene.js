import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { VariableSystem } from '../systems/VariableSystem.js';
import { SceneController } from '../systems/SceneController.js';
import { DialogueSystem } from '../systems/DialogueSystem.js';
import { CharacterSystem } from '../systems/CharacterSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';

/**
 * GameScene — the main gameplay loop.
 * Wires together all engine systems and handles player input.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.W = 800;
    this.H = 600;

    // ── Background ──
    this.bg = this.add.graphics();
    this._drawBackground(null);

    // ── Initialize systems ──
    this.vars = new VariableSystem();
    this.sceneCtrl = new SceneController(this.vars);
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
    const startScene = this._getStartScene();
    this.sceneCtrl.startScene(startScene);
  }

  /* ── SCENE CONTROLLER WIRING ───────────────── */

  _wireSceneController() {
    const ctrl = this.sceneCtrl;

    ctrl.onDialogue = (data) => {
      if (data.speaker) {
        this.characters.show(data.speaker, data.expression || 'neutral', 'center');
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
      this._drawBackground(data.background);
      this.cameras.main.fadeIn(400, 0, 0, 0);
      if (data.music) this.audio.playBGM(data.music);
    };

    ctrl.onSceneEnd = (data) => {
      this.dialogue.setVisible(false);
      this.characters.hideAll();

      // Remove any previous end text
      if (this._pendingEndText) this._pendingEndText.destroy();

      if (data.text) {
        this._pendingEndText = this.add.text(
          this.W / 2, this.H / 2, data.text, {
            fontSize: '24px',
            fontFamily: 'monospace',
            color: '#ffd700'
          }
        ).setOrigin(0.5).setDepth(200);

        this.tweens.add({
          targets: this._pendingEndText,
          alpha: 0.3,
          duration: 1500,
          yoyo: true,
          repeat: -1
        });
      }

      // If the scene end specifies a next scene, transition after a pause
      if (data.nextScene) {
        this.time.addEvent({
          delay: 2500,
          callback: () => {
            if (this._pendingEndText) this._pendingEndText.destroy();
            this._pendingEndText = null;
            this.dialogue.setVisible(false);
            this.characters.hideAll();
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
        case 'sfx':
          this.audio.playSFX(data.value);
          break;
        case 'bgm':
          this.audio.playBGM(data.value);
          break;
        case 'camera_shake':
          const [dur, int] = (data.value || '200,0.005').split(',').map(Number);
          this.cameras.main.shake(dur || 200, int || 0.005);
          break;
        case 'camera_flash':
          this.cameras.main.flash(200, 255, 255, 255);
          break;
      }

      // Show a small toast notification for events
      if (data.type && data.type !== 'camera_flash') {
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

    // F1–F4: jump to test scenes
    this.input.keyboard.on('keydown-F1', () => {
      this._switchScene('sample');
    });
    this.input.keyboard.on('keydown-F2', () => {
      this._switchScene('test-conditions');
    });
    this.input.keyboard.on('keydown-F3', () => {
      this._switchScene('test-events');
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
    this.dialogue.setVisible(false);
    this.characters.hideAll();
    if (this._pendingEndText) {
      this._pendingEndText.destroy();
      this._pendingEndText = null;
    }
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.sceneCtrl.startScene(sceneId);
    });
  }

  /* ── BACKGROUND ────────────────────────────── */

  _drawBackground(key) {
    this.bg.clear();
    const colors = [0x0a0a1a, 0x0f0f2a, 0x1a0a2a];
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const ci = t < 0.5 ? 0 : (t < 0.8 ? 1 : 2);
      const next = ci < 2 ? ci + 1 : ci;
      const lt = (t - ci * 0.5) * 2;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(colors[ci]),
        Phaser.Display.Color.IntegerToColor(colors[next]),
        100, lt * 100
      );
      this.bg.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      this.bg.fillRect(0, (i / steps) * this.H, this.W, this.H / steps + 1);
    }
  }

  /* ── START SCENE ───────────────────────────── */

  _getStartScene() {
    return Data.game?.startScene || 'sample';
  }

  /* ── CLEANUP ───────────────────────────────── */

  shutdown() {
    this.dialogue.destroy();
    this.characters.destroy();
    this.audio.destroy();
  }
}
