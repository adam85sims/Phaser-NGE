import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { Settings } from '../systems/SettingsSystem.js';

/**
 * BootScene — loads all game data JSON files using fetch()
 * (avoids Phaser's built-in loader which can have path issues with Vite).
 * Generates procedural textures. Transitions to GameScene when ready.
 *
 * Checks localStorage for editor-saved data first (from the dialogue editor's
 * "Save to Game" / Export button). If available, uses that instead of disk files.
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
      // Load persistent settings
      Settings.load();

      // Check for editor-saved data in localStorage (from dialogue editor Export)
      const editorDataRaw = localStorage.getItem('nge_editor_data');
      if (editorDataRaw) {
        try {
          const editorData = JSON.parse(editorDataRaw);
          Data.game = editorData.game || null;
          Data.characters = editorData.characters || null;
          Data.variables = editorData.variables || null;
          Data.scenes = editorData.scenes || {};
          // Theme still needs to be fetched (editor doesn't touch theme.json)
          try {
            const themeResp = await fetch('/data/theme.json');
            if (themeResp.ok) Data.theme = await themeResp.json();
          } catch { Data.theme = null; }

          if (Data.game) {
            loadText.destroy();
            this.scene.start('MenuScene');
            return;
          }
        } catch(e) {
          console.warn('BootScene: corrupt editor data in localStorage, falling back to disk', e);
          localStorage.removeItem('nge_editor_data');
        }
      }

      // Fallback: load from disk (standalone / no editor data)
      const [game, characters, variables, theme] = await Promise.all([
        fetch('/data/game.json').then(r => { if (!r.ok) throw new Error(`game.json: ${r.status}`); return r.json(); }),
        fetch('/data/characters.json').then(r => { if (!r.ok) throw new Error(`characters.json: ${r.status}`); return r.json(); }),
        fetch('/data/variables.json').then(r => { if (!r.ok) throw new Error(`variables.json: ${r.status}`); return r.json(); }),
        fetch('/data/theme.json').then(r => { if (!r.ok) throw new Error(`theme.json: ${r.status}`); return r.json(); })
      ]);

      // Step 2: Fetch all scenes listed in game.json
      const sceneIds = game.scenes || [];
      const sceneFetches = sceneIds.map(id =>
        fetch(`/data/scenes/${id}.json`)
          .then(r => {
            if (!r.ok) throw new Error(`${id}.json: ${r.status}`);
            return r.json();
          })
          .then(data => ({ id, data }))
      );

      const sceneResults = await Promise.all(sceneFetches);

      // Populate Data store
      Data.game = game;
      Data.characters = characters;
      Data.variables = variables;
      Data.theme = theme;
      Data.scenes = {};
      sceneResults.forEach(({ id, data }) => {
        Data.scenes[id] = data;
      });

      // Preload background images referenced by scenes
      const bgKeys = new Set();
      Object.values(Data.scenes).forEach(scene => {
        if (scene.background) bgKeys.add(scene.background);
      });

      if (bgKeys.size > 0) {
        const bgFetches = [...bgKeys].map(key =>
          fetch(`/assets/backgrounds/${key}.png`)
            .then(r => {
              if (!r.ok) throw new Error(`${key}.png: ${r.status}`);
              return r.blob();
            })
            .then(blob => createImageBitmap(blob).then(bitmap => ({ key, bitmap })))
            .catch(err => {
              console.warn(`Background image not found: ${key} (${err.message})`);
              return null;
            })
        );

        const bgResults = await Promise.all(bgFetches);
        bgResults.filter(Boolean).forEach(({ key, bitmap }) => {
          this.textures.addImage(`bg_${key}`, bitmap);
        });
      }

      loadText.destroy();

      // Transition to menu
      this.scene.start('MenuScene');

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
