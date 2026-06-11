import Phaser from 'phaser';
import { Data } from '../systems/DataLoader.js';
import { Settings } from '../systems/SettingsSystem.js';

/**
 * BootScene — loads all game data JSON files using fetch() from disk.
 * (Avoids Phaser's built-in loader which has path issues with Vite.)
 * Generates procedural textures. Preloads audio and background images.
 * Transitions to SplashScene → MenuScene → GameScene when ready.
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

      // Load from disk (V2 editor saves to disk via /api/save)
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

      // Preload BGM/SFX audio files referenced by scenes so AudioSystem
      // can find them in scene.cache.audio. Discovery covers:
      //   - scene.music           (legacy scene-level BGM)
      //   - event nodes with eventType 'bgm' / 'sfx'  (per-node triggers)
      // We HEAD-probe common formats and register the first one that 200s,
      // so a single missing format extension doesn't 404 four times.
      const audioRefs = new Set();
      Object.values(Data.scenes).forEach(scene => {
        if (scene.music) audioRefs.add(`bgm|${scene.music}`);
        (scene.nodes || []).forEach(node => {
          if (node.type !== 'event' || !node.eventValue) return;
          if (node.eventType === 'bgm') audioRefs.add(`bgm|${node.eventValue}`);
          else if (node.eventType === 'sfx') audioRefs.add(`sfx|${node.eventValue}`);
        });
      });

      if (audioRefs.size > 0) {
        const probe = async (url) => {
          try {
            const r = await fetch(url, { method: 'HEAD' });
            return r.ok;
          } catch { return false; }
        };
        const registerAudio = async (type, key) => {
          const subdir = type === 'bgm' ? 'bgm' : 'sfx';
          for (const ext of ['mp3', 'ogg', 'wav', 'opus', 'm4a']) {
            const url = `/assets/audio/${subdir}/${key}.${ext}`;
            if (await probe(url)) {
              this.load.audio(key, url);
              return true;
            }
          }
          console.warn(`AudioSystem preload: ${type} '${key}' not found in public/assets/audio/${subdir}/`);
          return false;
        };
        await Promise.all([...audioRefs].map(ref => {
          const [type, key] = ref.split('|');
          return registerAudio(type, key);
        }));

        // Kick the Phaser loader and wait for it to finish before transitioning.
        if (this.load.totalToLoad > 0) {
          await new Promise((resolve) => {
            this.load.once('complete', resolve);
            this.load.start();
          });
        }
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
