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

      let loadedFromStorage = false;

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

          if (Data.game) loadedFromStorage = true;
        } catch(e) {
          console.warn('BootScene: corrupt editor data in localStorage, falling back to disk', e);
          localStorage.removeItem('nge_editor_data');
        }
      }

      if (!loadedFromStorage) {
        // Fallback: load from disk (standalone / no editor data)
        const t = Date.now();
        const safeFetchJson = async (url) => {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`${url}: ${r.status}`);
          const text = await r.text();
          if (text.trim().startsWith('<')) throw new Error(`${url} returned HTML (file likely missing)`);
          return JSON.parse(text);
        };

        const [game, characters, variables, theme] = await Promise.all([
          safeFetchJson(`/data/game.json?t=${t}`),
          safeFetchJson(`/data/characters.json?t=${t}`),
          safeFetchJson(`/data/variables.json?t=${t}`),
          safeFetchJson(`/data/theme.json?t=${t}`).catch(() => ({})) // theme is optional
        ]);

        // Step 2: Fetch all scenes listed in game.json
        const sceneIds = game.scenes || [];
        const t2 = Date.now();
        const sceneFetches = sceneIds.map(id =>
          fetch(`/data/scenes/${id}.json?t=${t2}`)
            .then(async r => {
              if (!r.ok) return null;
              const text = await r.text();
              if (text.trim().startsWith('<')) return null;
              try { return JSON.parse(text); } catch (e) { return null; }
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
          if (data) Data.scenes[id] = data;
        });
      }

      // Preload background images referenced by scenes (and legacy background field)
      const bgKeys = new Set();
      Object.values(Data.scenes).forEach(scene => {
        if (scene.background) bgKeys.add(scene.background);
        if (scene.layers) {
          scene.layers.forEach(layer => {
            if (layer.type === 'background' && layer.asset) {
              bgKeys.add(layer.asset);
            }
          });
        }
      });

      if (Data.theme?.ui?.splash?.logo) bgKeys.add(Data.theme.ui.splash.logo);
      if (Data.theme?.ui?.menu?.background) bgKeys.add(Data.theme.ui.menu.background);

      if (bgKeys.size > 0) {
        const bgFetches = [...bgKeys].map(key =>
          fetch(`/assets/backgrounds/${key}.png`)
            .then(r => {
              if (!r.ok) throw new Error(`${key}.png: ${r.status}`);
              return r.blob();
            })
            .then(blob => {
              return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ key, bitmap: img });
                img.onerror = () => reject(new Error('Image decode failed'));
                img.src = URL.createObjectURL(blob);
              });
            })
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

      // Check for debug start from editor
      const debugStart = localStorage.getItem('nge_debug_start');
      if (debugStart) {
        localStorage.removeItem('nge_debug_start');
        try {
          const debugData = JSON.parse(debugStart);
          this.scene.start('GameScene', { loadScene: debugData.sceneId, nodeId: debugData.nodeId });
          return;
        } catch (e) { console.warn('Failed to parse debug start data'); }
      }

      // Transition to splash or menu
      if (Data.theme?.ui?.splash?.enabled) {
        this.scene.start('SplashScene');
      } else {
        this.scene.start('MenuScene');
      }

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
