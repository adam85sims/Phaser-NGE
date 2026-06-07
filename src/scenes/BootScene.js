import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';

/**
 * BootScene — loads all game data JSON files using fetch()
 * (avoids Phaser's built-in loader which can have path issues with Vite).
 * Generates procedural textures. Transitions to GameScene when ready.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Generate procedural textures during preload
    this._generateTextures();
  }

  async create() {
    // Show loading state
    const loadText = this.add.text(400, 300, 'LOADING...', {
      fontSize: '20px', fontFamily: 'monospace', color: '#00ccff'
    }).setOrigin(0.5).setDepth(1000);

    try {
      // Fetch all data files with explicit absolute paths
      const [game, characters, variables, sceneSample, sceneConditions, sceneEvents] = await Promise.all([
        fetch('/data/game.json').then(r => { if (!r.ok) throw new Error(`game.json: ${r.status}`); return r.json(); }),
        fetch('/data/characters.json').then(r => { if (!r.ok) throw new Error(`characters.json: ${r.status}`); return r.json(); }),
        fetch('/data/variables.json').then(r => { if (!r.ok) throw new Error(`variables.json: ${r.status}`); return r.json(); }),
        fetch('/data/scenes/sample.json').then(r => { if (!r.ok) throw new Error(`sample.json: ${r.status}`); return r.json(); }),
        fetch('/data/scenes/test-conditions.json').then(r => { if (!r.ok) throw new Error(`test-conditions.json: ${r.status}`); return r.json(); }),
        fetch('/data/scenes/test-events.json').then(r => { if (!r.ok) throw new Error(`test-events.json: ${r.status}`); return r.json(); })
      ]);

      // Populate Data store
      Data.game = game;
      Data.characters = characters;
      Data.variables = variables;
      Data.scenes = {
        sample: sceneSample,
        'test-conditions': sceneConditions,
        'test-events': sceneEvents
      };

      // Ensure game.scenes list matches
      if (!Data.game.scenes) Data.game.scenes = [];
      ['sample', 'test-conditions', 'test-events'].forEach(id => {
        if (!Data.game.scenes.includes(id)) Data.game.scenes.push(id);
      });

      loadText.destroy();

      // Transition to game
      this.scene.start('GameScene');

    } catch (err) {
      loadText.setText('LOAD ERROR: ' + err.message);
      loadText.setColor('#ff4444');
      console.error('BootScene load error:', err);
    }
  }

  _generateTextures() {
    const tex = this.textures.createCanvas('ui_continue', 32, 16);
    const ctx = tex.context;
    ctx.fillStyle = '#00ccff';
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(28, 14);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.fill();
    tex.refresh();
  }
}
